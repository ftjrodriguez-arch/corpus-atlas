"""Rebuild light (m2) and full-res regional (hr) inputs from raw3 + vertex attributes (AO, tendon, cartilage)."""
import pickle, json, struct, glob, os, numpy as np
from pack import normals, RATIO, MINT
raw = pickle.load(open('../work/raw3.pkl', 'rb')); raw0 = pickle.load(open('../work/raw.pkl', 'rb'))
A = pickle.load(open('../work/vattr.pkl', 'rb'))
BOOST = {'oseo': 2.0, 'muscular': 1.25, 'articular': 1.4, 'insercion': 1.0}

def ids_of(f):
    b = open(f, 'rb').read(); n = struct.unpack_from('<I', b, 0)[0]; o = 4; out = []
    for _ in range(n):
        l = struct.unpack_from('<I', b, o)[0]; o += 4; out.append(b[o:o + l].decode()); o += l
        nv, nt = struct.unpack_from('<II', b, o); o += 8 + nv * 12 + nt * 12
    return out

def cluster(V, T, N, C, cell):
    q = np.floor((V - V.min(0)) / cell).astype(np.int64)
    nb = np.round(N * 1.2).astype(np.int64) + 2
    key = ((q[:, 0] * 100003 + q[:, 1]) * 100003 + q[:, 2]) * 125 + nb[:, 0] * 25 + nb[:, 1] * 5 + nb[:, 2]
    uniq, inv = np.unique(key, return_inverse=True); inv = inv.reshape(-1); cnt = np.bincount(inv)[:, None]
    nV = np.zeros((len(uniq), 3)); np.add.at(nV, inv, V); nV /= cnt
    nC = np.zeros((len(uniq), 3)); np.add.at(nC, inv, C.astype(float)); nC /= cnt
    T2 = inv[T]; keep = (T2[:, 0] != T2[:, 1]) & (T2[:, 1] != T2[:, 2]) & (T2[:, 0] != T2[:, 2]); T2 = T2[keep]
    if len(T2):
        s = np.sort(T2, 1); _, idx = np.unique(s, axis=0, return_index=True); T2 = T2[np.sort(idx)]
    used = np.unique(T2); remap = np.full(len(nV), -1); remap[used] = np.arange(len(used))
    return nV[used], remap[T2], nC[used]

def decimate(V, T, C, target):
    target = max(MINT, target)
    if len(T) <= target: return V, T, C
    V = V.astype(np.float64); N = normals(V, T); ext = (V.max(0) - V.min(0)).max(); lo, hi = ext * 1e-4, ext / 3; best = (V, T, C)
    for _ in range(16):
        mid = np.sqrt(lo * hi); r = cluster(V, T, N, C, mid)
        if len(r[1]) > target: lo = mid; best = r
        else: hi = mid
        if abs(len(r[1]) - target) < target * 0.06: best = r; break
    return best

def write_bin(path, items):
    with open(path, 'wb') as f:
        f.write(struct.pack('<I', len(items)))
        for nid, V, T, C in items:
            b = nid.encode(); f.write(struct.pack('<I', len(b))); f.write(b)
            f.write(struct.pack('<II', len(V), len(T)))
            f.write(np.asarray(V, np.float32).tobytes()); f.write(np.asarray(T, np.uint32).tobytes())
            f.write(np.clip(np.round(C), 0, 255).astype(np.uint8).tobytes())

cat = json.load(open('../work/pub/data/catalog.json')); SYS = {r[0]: r[4] for r in cat}
os.makedirs('../hr/lr_in2', exist_ok=True); os.makedirs('../hr/in2', exist_ok=True)
for f in sorted(glob.glob('../hr/lr_in/*.bin')):
    s = os.path.basename(f)[:-4]; items = []; tt = 0
    for nid in ids_of(f):
        i = int(nid[1:]); o = raw[i]
        tgt = int(len(raw0[i]['T']) * RATIO.get(s, .5) * BOOST.get(s, 1.0))
        V, T, C = decimate(o['V'], o['T'], A[i], tgt); items.append((nid, V, T, C)); tt += len(T)
    write_bin('../hr/lr_in2/' + s + '.bin', items); print('lr', s, len(items), tt, flush=True)
for f in sorted(glob.glob('../hr/in/*.bin')):
    items = []; tt = 0
    for nid in ids_of(f):
        i = int(nid[1:]); o = raw[i]; items.append((nid, o['V'], o['T'], A[i])); tt += len(o['T'])
    write_bin('../hr/in2/' + os.path.basename(f), items); print('hr', os.path.basename(f), len(items), tt, flush=True)
