"""Per-vertex attributes on the original meshes: R = ambient occlusion, G = tendon, B = articular cartilage."""
import pickle, json, numpy as np, re, sys, time
from scipy.spatial import cKDTree
raw = pickle.load(open('../work/raw3.pkl', 'rb'))
cat = json.load(open('../work/pub/data/catalog.json'))
SYS = {int(r[0][1:]): r[4] for r in cat}
rng = np.random.default_rng(1)

def vnormals(V, T):
    a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    fn = np.cross(b - a, c - a)
    vn = np.zeros_like(V)
    for k in range(3): np.add.at(vn, T[:, k], fn)
    vol = np.einsum('ij,ij->', a, np.cross(b, c))
    if vol < 0: vn = -vn
    return vn / (np.linalg.norm(vn, axis=1, keepdims=True) + 1e-12)

def sample_surface(V, T, density):
    a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    n = np.maximum(0, np.round(area * density + rng.random(len(area)) - 0.5)).astype(int)
    idx = np.repeat(np.arange(len(T)), n)
    u = rng.random((len(idx), 1)); v = rng.random((len(idx), 1)); m = (u + v) > 1; u[m] = 1 - u[m]; v[m] = 1 - v[m]
    return a[idx] + (b[idx] - a[idx]) * u + (c[idx] - a[idx]) * v

from tten2 import thick
DENS = 2.5e5   # samples per m^2 (1 per 4 mm^2)
groups = {}
for i, s in SYS.items(): groups.setdefault(s, []).append(i)
pts = {}
t0 = time.time()
for s, ids in groups.items():
    P = [sample_surface(raw[i]['V'].astype(np.float64), raw[i]['T'], DENS if s != 'piel' else DENS / 4) for i in ids]
    pts[s] = np.concatenate(P) if P else np.zeros((0, 3))
print('sampled', {k: len(v) for k, v in pts.items()}, round(time.time() - t0, 1), 's', flush=True)

OCC = {'muscular': ['muscular', 'oseo'], 'fascia': ['muscular', 'fascia', 'oseo'], 'bolsas': ['bolsas', 'muscular', 'oseo'],
       'oseo': ['oseo'], 'articular': ['articular', 'oseo'], 'insercion': ['oseo'],
       'arterial': ['arterial', 'venoso', 'oseo', 'nervioso_periferico'], 'venoso': ['venoso', 'arterial', 'oseo', 'nervioso_periferico'],
       'nervioso_periferico': ['nervioso_periferico', 'arterial', 'venoso', 'oseo'], 'nervioso_central': ['nervioso_central'],
       'linfatico': ['linfatico', 'oseo'], 'piel': ['piel']}
VISC = ['digestivo', 'respiratorio', 'urinario', 'reproductor', 'endocrino']
for v in VISC: OCC[v] = VISC + ['oseo', 'arterial', 'venoso']
trees = {}
def tree(key):
    if key not in trees:
        trees[key] = cKDTree(np.concatenate([pts[s] for s in OCC[key] if s in pts and len(pts[s])]))
    return trees[key]

R = 0.011   # occlusion probe radius (m)
attr = {}
bones_tree = None
bone_owner = None
# bone surface points with owner for cartilage
bpts = []; bown = []
for i in groups.get('oseo', []):
    P = sample_surface(raw[i]['V'].astype(np.float64), raw[i]['T'], DENS); bpts.append(P); bown.append(np.full(len(P), i))
bpts = np.concatenate(bpts); bown = np.concatenate(bown); btree = cKDTree(bpts)
skip_cart = re.compile(r'tooth|incisor|canine|molar|premolar|Frontal bone|Parietal|Occipital|Temporal bone|Sphenoid|Ethmoid|Maxilla|Zygomatic|Nasal|Lacrimal|Palatine|Vomer|concha|Costal cartilage|cartilage', re.I)

for s, ids in groups.items():
    tr = tree(s) if s in OCC else None
    for i in ids:
        o = raw[i]; V = o['V'].astype(np.float64); T = o['T']
        N = vnormals(V, T)
        out = np.zeros((len(V), 3), np.uint8)
        # --- ambient occlusion: occluder samples inside a probe sphere set above the surface
        if tr is not None and len(V):
            d, _ = tr.query(V + N * R * 1.05, k=40, distance_upper_bound=R)
            cnt = np.isfinite(d).sum(1)
            d2, _ = tr.query(V + N * R * 0.45, k=24, distance_upper_bound=R * 0.42)
            cnt2 = np.isfinite(d2).sum(1)
            occ = np.clip(cnt / 26.0, 0, 1) * 0.65 + np.clip(cnt2 / 12.0, 0, 1) * 0.35
            ao = 1.0 - 0.62 * occ ** 1.3
            out[:, 0] = np.clip(ao * 255, 0, 255).astype(np.uint8)
        else:
            out[:, 0] = 255
        # --- tendon: locally thin parts (inscribed radius) at the ends of muscles that have a thick belly
        if s == 'muscular' and len(V) > 30:
            th = thick(V, T)
            belly = np.percentile(th[th < 0.03], 90) if (th < 0.03).sum() > 10 else 0
            if belly > 0.006:
                c = V.mean(0); X = V - c; w, ev = np.linalg.eigh(X.T @ X); t = X @ ev[:, -1]
                tn = (t - t.min()) / (np.ptp(t) + 1e-9); endp = np.minimum(tn, 1 - tn)
                ten = np.clip((0.42 * belly - th) / (0.14 * belly), 0, 1) * np.clip((0.42 - endp) / 0.18, 0, 1)
                # smooth over the mesh to remove speckle
                E = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
                for _ in range(3):
                    acc = np.zeros(len(V)); cnt = np.zeros(len(V))
                    np.add.at(acc, E[:, 0], ten[E[:, 1]]); np.add.at(cnt, E[:, 0], 1)
                    np.add.at(acc, E[:, 1], ten[E[:, 0]]); np.add.at(cnt, E[:, 1], 1)
                    ten = 0.5 * ten + 0.5 * acc / np.maximum(cnt, 1)
                out[:, 1] = (np.clip(ten * 1.15, 0, 1) * 255).astype(np.uint8)
        if re.search(r'tendon|aponeuros|retinacul|tendinous', o['name'], re.I):
            out[:, 1] = 235
        # --- cartilage: bone surface close to another bone
        if s == 'oseo' and not skip_cart.search(o['name']):
            d, k = btree.query(V, k=8, distance_upper_bound=0.007)
            other = np.zeros(len(V))
            for j in range(8):
                ok = np.isfinite(d[:, j]) & (bown[np.minimum(k[:, j], len(bown) - 1)] != i)
                other = np.maximum(other, np.where(ok, 1 - np.clip((d[:, j] - 0.0015) / 0.0055, 0, 1), 0))
            out[:, 2] = (other * 255).astype(np.uint8)
        attr[i] = out
    print(s, 'done', round(time.time() - t0, 1), 's', flush=True)
pickle.dump(attr, open('../work/vattr.pkl', 'wb'), protocol=4)
