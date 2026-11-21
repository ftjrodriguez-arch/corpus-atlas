#!/usr/bin/env python3
"""Piezas del HuBMAP Human Reference Atlas v1.4 (Visible Human Male, CC BY 4.0) ajustadas al cuerpo de Corpus.

Uso:
  git clone --filter=blob:none https://github.com/hubmapconsortium/ccf-3d-reference-object-library HRA
  node tools/unreal/exportar.js SALIDA_GLB            # mallas actuales de Corpus (anclas del ajuste)
  python3 tools/hra14/construir.py HRA/VH_Male/v1.4 SALIDA_GLB/hombre trabajo/
  npx @gltf-transform/cli draco trabajo/hra14_plano.glb data/hra14.glb

Genera trabajo/hra14_plano.glb (una malla por pieza, con el id del catálogo como nombre) y trabajo/hra14_reg.json
(registro: transformaciones, triángulos y piezas nuevas). Las entradas del catálogo están en tools/hra14/piezas.json.

Ajuste:
  · Ojo: semejanza (escala uniforme + traslación) de la esclera HRA a la esclera de Corpus, por lado. Se sustituye la
    geometría de las piezas que ya existían (para que todo el ojo sea coherente) y se añaden las nuevas.
  · Cartílagos traqueales y carina: deformación de tubo. Cada vértice se expresa respecto al eje de la tráquea HRA
    (posición a lo largo y desvío radial) y se recoloca sobre el eje y el radio de la tráquea de Corpus.
  · Tonsila palatina: semejanza al centro de la de Corpus, con la escala de la cabeza (la misma del ojo).
"""
import json, os, sys
import numpy as np
import trimesh
import fast_simplification

SRC, CORPUS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
AQUI = os.path.dirname(os.path.abspath(__file__))
PIEZAS = json.load(open(os.path.join(AQUI, 'piezas.json'), encoding='utf-8'))
os.makedirs(OUT, exist_ok=True)


def cargar(f):
    s = trimesh.load(f, process=False)
    out = {}
    for nombre in s.graph.nodes_geometry:
        T, g = s.graph[nombre]
        m = s.geometry[g].copy()
        m.apply_transform(T)
        out[nombre] = m
    return out


def limpiar(m, max_tris):
    """Suelda vértices, quita caras degeneradas y reduce a max_tris."""
    m = trimesh.Trimesh(m.vertices, m.faces, process=True)
    m.merge_vertices(digits_vertex=6)
    m.update_faces(m.nondegenerate_faces())
    m.remove_unreferenced_vertices()
    V, F = np.asarray(m.vertices, np.float32), np.asarray(m.faces, np.int64)
    if len(F) > max_tris:
        V, F = fast_simplification.simplify(V, F, target_count=int(max_tris))
    return trimesh.Trimesh(V, F, process=False)


REG = {'fuente': 'HuBMAP Human Reference Atlas, 3D Reference Object Library, VH_Male v1.4 (CC BY 4.0)', 'piezas': {}}
SALIDA = {}


def guardar(pid, malla, origen, nota):
    SALIDA[pid] = malla
    REG['piezas'][pid] = {'hra': origen, 'tris': int(len(malla.faces)), 'ajuste': nota}


# ───────── ojos ─────────
nc = cargar(os.path.join(CORPUS, 'nervioso_central.glb'))
escala_cabeza = []
for lado, suf in (('izquierdo', 'L'), ('derecho', 'R')):
    ojo = cargar(os.path.join(SRC, '3d-vh-m-eye-%s.glb' % suf.lower()))
    ancla = next(p for p in PIEZAS if p.get('ancla') == 'esclera' and p['lado'] == lado)
    a, b = ojo['VH_M_sclera_' + suf], nc[ancla['id']]
    s = float(np.mean(b.extents / a.extents))
    t = b.bounds.mean(0) - s * a.bounds.mean(0)
    escala_cabeza.append(s)
    for p in PIEZAS:
        if p['grupo'] != 'ojo' or p['lado'] != lado:
            continue
        m = limpiar(ojo['VH_M_%s_%s' % (p['hra'], suf)], p.get('tris', 4000))
        m.vertices = m.vertices * s + t
        guardar(p['id'], m, 'eye-%s/%s' % (suf.lower(), p['hra']), 'semejanza s=%.4f t=%s' % (s, np.round(t, 5).tolist()))
S_CABEZA = float(np.mean(escala_cabeza))

# ───────── tráquea: deformación de tubo ─────────
resp = cargar(os.path.join(CORPUS, 'respiratorio.glb'))
tra = cargar(os.path.join(SRC, '3d-vh-m-trachea.glb'))
T_C = resp[next(p['id'] for p in PIEZAS if p.get('ancla') == 'traquea')]
T_H = tra['VH_M_trachea']


def eje(m, n=40):
    """Centro y radio de la tráquea por rebanadas a lo largo de Y (centro y semiejes de la caja de cada rebanada), suavizados."""
    y0, y1 = m.bounds[:, 1]
    h = (y1 - y0) / n
    ys, C, R = [], [], []
    for i in range(n):
        y = y0 + (i + 0.5) * h
        s = m.vertices[np.abs(m.vertices[:, 1] - y) < h]
        if len(s) < 8:
            continue
        lo, hi = s.min(0), s.max(0)
        ys.append(y); C.append([(lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2]); R.append([(hi[0] - lo[0]) / 2, (hi[2] - lo[2]) / 2])
    ys, C, R = np.array(ys), np.array(C), np.array(R)
    suav = lambda a: np.convolve(np.pad(a, 2, mode='edge'), np.ones(5) / 5, mode='valid')
    C = np.stack([suav(C[:, 0]), suav(C[:, 1])], 1); R = np.stack([suav(R[:, 0]), suav(R[:, 1])], 1)
    cen = lambda y: np.stack([np.interp(y, ys, C[:, 0]), np.interp(y, ys, C[:, 1])], 1)
    rad = lambda y: np.stack([np.interp(y, ys, R[:, 0]), np.interp(y, ys, R[:, 1])], 1)
    return (y0, y1), cen, rad


(yh0, yh1), ch, rh = eje(T_H)
(yc0, yc1), cc, rc = eje(T_C)
CART = tra['VH_M_tracheal_cartilage']
ya0, ya1 = CART.bounds[:, 1]
# Los anillos ocupan toda la tráquea de Corpus (del cricoides a la bifurcación), dejando un margen en los extremos
K0, K1 = 0.05, 0.93


def tubo(V):
    yc = yc0 + (K0 + (K1 - K0) * np.clip((V[:, 1] - ya0) / (ya1 - ya0), 0.0, 1.0)) * (yc1 - yc0)
    d = (V[:, [0, 2]] - ch(V[:, 1])) / rh(V[:, 1])          # desvío respecto al eje, en radios de la tráquea HRA
    xz = cc(yc) + d * rc(yc)
    return np.stack([xz[:, 0], yc, xz[:, 1]], 1)


for p in PIEZAS:
    if p['grupo'] != 'traquea' or p.get('ancla'):
        continue
    m = limpiar(tra['VH_M_' + p['hra']], p.get('tris', 8000))
    m.vertices = tubo(np.asarray(m.vertices, float))
    guardar(p['id'], m, 'trachea/' + p['hra'], 'tubo sobre la tráquea de Corpus (eje y radios por rebanadas)')

# ───────── tonsilas palatinas ─────────
lin = cargar(os.path.join(CORPUS, 'linfatico.glb'))
for p in PIEZAS:
    if p['grupo'] != 'tonsila':
        continue
    suf = 'L' if p['lado'] == 'izquierdo' else 'R'
    src = cargar(os.path.join(SRC, '3d-vh-m-palatine-tonsil-%s.glb' % suf.lower()))['VH_M_palatine_tonsil_' + suf]
    m = limpiar(src, p.get('tris', 3000))
    s = S_CABEZA * p.get('escala', 1.0)
    m.vertices = (m.vertices - src.bounds.mean(0)) * s + lin[p['id']].bounds.mean(0)
    guardar(p['id'], m, 'palatine-tonsil-%s' % suf.lower(), 'semejanza s=%.4f centrada en la tonsila de Corpus' % s)

# ───────── salida ─────────
escena = trimesh.Scene()
for pid, m in SALIDA.items():
    m.visual = trimesh.visual.ColorVisuals(m)
    escena.add_geometry(m, node_name=pid, geom_name=pid)
escena.export(os.path.join(OUT, 'hra14_plano.glb'))
REG['escala_cabeza'] = S_CABEZA
REG['triangulos'] = int(sum(len(m.faces) for m in SALIDA.values()))
json.dump(REG, open(os.path.join(OUT, 'hra14_reg.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('%d piezas, %d triángulos → %s' % (len(SALIDA), REG['triangulos'], os.path.join(OUT, 'hra14_plano.glb')))
