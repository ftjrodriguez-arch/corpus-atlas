"""Decimate and pack the Z-Anatomy structures into one quantized .glb per system."""
import sys, re, json, pickle, struct, numpy as np, collections
sys.path.insert(0, '.')
from names import base, side, kind_ins, ta

objs = pickle.load(open('../work/raw.pkl', 'rb'))
bpath = json.load(open('../work/bonuspath.json'))

def sub(o):
    p = bpath.get(o['name'], [''])[0]
    return p.split(' > ')[2] if p.count(' > ') >= 2 else ''

def system(o):
    g = o['group'][:1]; n = base(o['name']).lower(); s = sub(o)
    if g == '1': return 'oseo'
    if g == '2': return 'insercion'
    if g == '3': return 'articular'
    if g == '4':
        if s in ('Bursae', 'Tendon sheaths') or 'bursa' in n or 'sheath' in n: return 'bolsas'
        if s in ('Fascia', 'Main divisions') or any(w in n for w in ('fascia', 'retinacul', 'septum', 'aponeurosis', 'tract', 'linea alba')): return 'fascia'
        return 'muscular'
    if g == '5':
        if re.search(r'\bvein|\bveins|venous|sinus|vena|venae', n) and 'sinus node' not in n: return 'venoso'
        return 'arterial'
    if g == '6': return 'linfatico'
    if g == '7':
        if s == 'Peripheral nervous system' or re.search(r'nerve|plexus|ganglion|branch', n): return 'nervioso_periferico'
        return 'nervioso_central'
    if g == '8':
        m = {'Digestive system': 'digestivo', 'Respiratory system': 'respiratorio', 'Urinary system': 'urinario', "Genital systems'": 'reproductor', 'Endocrine glands': 'endocrino'}
        if s in m: return m[s]
        if re.search(r'bronch|lung|trache|laryn|pleura|nasal', n): return 'respiratorio'
        if re.search(r'renal|kidney|ureter|bladder|urethra', n): return 'urinario'
        if re.search(r'thyroid|parathyroid|suprarenal|pituitar|hypophys|pineal', n): return 'endocrino'
        if re.search(r'penis|testis|ovary|uter|vagin|prostat|seminal|deferens|epididym|ejaculat|scrot', n): return 'reproductor'
        return 'digestivo'
    if g == '9': return 'piel'
    return 'otro'

# triangles budget ratio per system
RATIO = {'oseo': .5, 'insercion': 1.0, 'articular': .7, 'muscular': .45, 'fascia': .25, 'bolsas': .5, 'arterial': .3, 'venoso': .3,
         'linfatico': .45, 'nervioso_central': .18, 'nervioso_periferico': .35, 'digestivo': .6, 'respiratorio': .6, 'urinario': .7,
         'reproductor': .6, 'endocrino': .8, 'piel': .8}
MINT = 80

def normals(V, T):
    a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    fn = np.cross(b - a, c - a)
    vn = np.zeros_like(V)
    for k in range(3): np.add.at(vn, T[:, k], fn)
    return vn / (np.linalg.norm(vn, axis=1, keepdims=True) + 1e-12)

def cluster(V, T, N, cell):
    q = np.floor((V - V.min(0)) / cell).astype(np.int64)
    nb = np.round(N * 1.2).astype(np.int64) + 2  # normal bin keeps opposite faces apart
    key = ((q[:, 0] * 100003 + q[:, 1]) * 100003 + q[:, 2]) * 125 + nb[:, 0] * 25 + nb[:, 1] * 5 + nb[:, 2]
    uniq, inv = np.unique(key, return_inverse=True)
    nV = np.zeros((len(uniq), 3)); np.add.at(nV, inv, V); nV /= np.bincount(inv)[:, None]
    T2 = inv[T]
    keep = (T2[:, 0] != T2[:, 1]) & (T2[:, 1] != T2[:, 2]) & (T2[:, 0] != T2[:, 2])
    T2 = T2[keep]
    if len(T2):
        s = np.sort(T2, 1); _, idx = np.unique(s, axis=0, return_index=True); T2 = T2[np.sort(idx)]
    used = np.unique(T2); remap = np.full(len(nV), -1); remap[used] = np.arange(len(used))
    return nV[used], remap[T2]

def decimate(V, T, ratio):
    target = max(MINT, int(len(T) * ratio))
    if len(T) <= target: return V, T
    V = V.astype(np.float64); N = normals(V, T)
    ext = (V.max(0) - V.min(0)).max()
    lo, hi = ext * 1e-4, ext / 3
    best = (V, T)
    for _ in range(14):
        mid = np.sqrt(lo * hi)
        v2, t2 = cluster(V, T, N, mid)
        if len(t2) > target: lo = mid; best = (v2, t2)
        else: hi = mid
        if abs(len(t2) - target) < target * 0.08: best = (v2, t2); break
    return best

def write_glb(path, items):
    """items: list of (node_name, extras, V float32 (n,3), T int (m,3))"""
    bin_ = bytearray(); bufviews = []; accessors = []; meshes = []; nodes = []
    def add_view(data, target):
        while len(bin_) % 4: bin_.append(0)
        bufviews.append({'buffer': 0, 'byteOffset': len(bin_), 'byteLength': len(data), 'target': target})
        bin_.extend(data); return len(bufviews) - 1
    for name, extras, V, T in items:
        mn = V.min(0); mx = V.max(0); scale = np.maximum(mx - mn, 1e-6) / 32767.0
        Q = np.round((V - mn) / scale).astype(np.int16)
        Qp = np.c_[Q, np.zeros(len(Q), np.int16)]  # pad to 8 bytes per vertex (4-byte alignment)
        bv = add_view(Qp.tobytes(), 34962)
        bufviews[bv]['byteStride'] = 8
        accessors.append({'bufferView': bv, 'componentType': 5122, 'count': len(Q), 'type': 'VEC3',
                          'min': Q.min(0).tolist(), 'max': Q.max(0).tolist()})
        pa = len(accessors) - 1
        idx_t = np.uint16 if len(V) < 65536 else np.uint32
        bv = add_view(T.astype(idx_t).tobytes(), 34963)
        accessors.append({'bufferView': bv, 'componentType': 5123 if idx_t == np.uint16 else 5125, 'count': int(T.size), 'type': 'SCALAR'})
        ia = len(accessors) - 1
        meshes.append({'primitives': [{'attributes': {'POSITION': pa}, 'indices': ia}]})
        nodes.append({'name': name, 'mesh': len(meshes) - 1, 'translation': mn.tolist(), 'scale': scale.tolist(), 'extras': extras})
    gl = {'asset': {'version': '2.0', 'generator': 'Corpus pack (Z-Anatomy, CC BY-SA 4.0)'},
          'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
          'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
          'accessors': accessors, 'bufferViews': bufviews, 'buffers': [{'byteLength': len(bin_)}]}
    js = json.dumps(gl, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    while len(js) % 4: js += b' '
    while len(bin_) % 4: bin_.append(0)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bytes(bin_))

if __name__ == '__main__':
    bysys = collections.defaultdict(list)
    catalog = []
    for i, o in enumerate(objs):
        if o['name'].endswith('.g') or o['V'][:, 0].min() < -0.6 or base(o['name']) in ('Muscular system', 'Skeletal system'): continue
        s = system(o)
        V, T = decimate(o['V'], o['T'], RATIO.get(s, .5))
        if len(T) == 0: continue
        V = V.astype(np.float32)
        b = base(o['name']); r = ta(o['name'])
        nid = f'n{i}'
        extras = {'k': b, 's': side(o['name']) or '', 'i': kind_ins(o['name']) or ''}
        bysys[s].append((nid, extras, V, T))
        catalog.append({'id': nid, 'en': b, 'sys': s, 'side': extras['s'], 'ins': extras['i'],
                        'es': r[4] if r else None, 'la': r[2] if r else None, 'tris': int(len(T))})
        if i % 400 == 0: print(i, flush=True)
    import os; os.makedirs('../work/glb', exist_ok=True)
    for s, items in bysys.items():
        write_glb(f'../work/glb/{s}.glb', items)
        print(s, len(items), 'tris', sum(len(t) for *_, t in items), 'MB', round(os.path.getsize(f'../work/glb/{s}.glb') / 1e6, 2))
    json.dump(catalog, open('../work/catalog.json', 'w'), ensure_ascii=False)
