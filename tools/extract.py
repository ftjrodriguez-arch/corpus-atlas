"""Extract Z-Anatomy mesh + curve objects to world-space triangle meshes (Y-up, metres)."""
import sys, re, json, pickle, numpy as np
sys.path.insert(0, '.')
from blend import Blend

B = Blend('../zanat/ex/Z-Anatomy/Startup.blend')
F = B.fields
idname = lambda b: B.get('ID', b[5], 'name')[2:]

def listbase(base_off, owner_idx, typ):
    p = B.get('ListBase', base_off, 'first'); out = []
    while p:
        b = B.block(p, owner_idx)
        if b is None: break
        out.append(b); p = B.get(typ, b[5], 'next')
    return out

def cd_layers(cd_off, owner_idx):
    lp = B.get('CustomData', cd_off, 'layers'); n = B.get('CustomData', cd_off, 'totlayer')
    if not lp or not n: return []
    lb = B.block(lp, owner_idx); out = []
    for i in range(n):
        o = lb[5] + i * 120
        dptr = B.get('CustomDataLayer', o, 'data')
        out.append((B.get('CustomDataLayer', o, 'type'), B.get('CustomDataLayer', o, 'name'), B.block(dptr, owner_idx)))
    return out

def mesh_arrays(meb):
    i0 = B.index_of(meb); o = meb[5]
    tv, tp, tl = (B.get('Mesh', o, k) for k in ('totvert', 'totpoly', 'totloop'))
    V = P = L = None
    for t, name, blk in cd_layers(o + F('Mesh')['vdata'][1], i0):
        if blk is None: continue
        if t == 0 or name == 'position':
            stride = blk[1] // max(blk[4], 1)
            arr = np.frombuffer(B.data, dtype=np.uint8, count=blk[1], offset=blk[5]).reshape(blk[4], stride)
            V = arr[:, :12].copy().view(np.float32).reshape(-1, 3)
    for t, name, blk in cd_layers(o + F('Mesh')['pdata'][1], i0):
        if blk is not None and t == 25:
            arr = np.frombuffer(B.data, dtype=np.uint8, count=blk[1], offset=blk[5]).reshape(blk[4], 12)
            P = arr[:, :8].copy().view(np.int32).reshape(-1, 2)
    for t, name, blk in cd_layers(o + F('Mesh')['ldata'][1], i0):
        if blk is not None and t == 26:
            arr = np.frombuffer(B.data, dtype=np.uint8, count=blk[1], offset=blk[5]).reshape(blk[4], 8)
            L = arr[:, :4].copy().view(np.int32).reshape(-1)
    if V is None or P is None or L is None or len(V) != tv: return None
    tris = []
    ls, lc = P[:, 0], P[:, 1]
    for k in range(3, lc.max() + 1 if len(lc) else 3):
        sel = lc == k
        if not sel.any(): continue
        st = ls[sel]
        for j in range(1, k - 1):
            tris.append(np.stack([L[st], L[st + j], L[st + j + 1]], 1))
    if not tris: return None
    T = np.concatenate(tris).astype(np.int32)
    return V, T

def obmat(obb):
    return np.array(B.get('Object', obb[5], 'obmat'), dtype=np.float64).reshape(4, 4)

def to_world(V, M):
    return (np.c_[V.astype(np.float64), np.ones(len(V))] @ M)[:, :3]

def mirrors(obb):
    res = []
    for mb in listbase(obb[5] + F('Object')['modifiers'][1], B.index_of(obb), 'ModifierData'):
        if B.sdna_name(mb) == 'MirrorModifierData':
            flag = B.get('MirrorModifierData', mb[5], 'flag')
            axes = [a for a, bit in ((0, 1 << 3), (1, 1 << 4), (2, 1 << 5)) if flag & bit]
            if not axes and flag & 0: axes = [0]
            mob = B.get('MirrorModifierData', mb[5], 'mirror_ob')
            res.append((axes or [0], mob))
    return res

def mods(obb):
    return [B.sdna_name(mb) for mb in listbase(obb[5] + F('Object')['modifiers'][1], B.index_of(obb), 'ModifierData')]

# ---- curves (vessels, nerves) -> tubes
def curve_tubes(cub, M):
    i0 = B.index_of(cub); o = cub[5]
    depth = B.get('Curve', o, 'ext2')  # bevel depth
    if depth <= 0: depth = 0.0
    out_V, out_T = [], []
    off = 0
    for nb in listbase(o + F('Curve')['nurb'][1], i0, 'Nurb'):
        n_off = nb[5]
        typ = B.get('Nurb', n_off, 'type'); pntsu = B.get('Nurb', n_off, 'pntsu')
        resu = max(2, B.get('Nurb', n_off, 'resolu'))
        pts, rad = [], []
        if typ == 1:  # bezier
            bb = B.block(B.get('Nurb', n_off, 'bezt'), i0)
            if bb is None: continue
            sz = bb[1] // max(bb[4], 1)
            fv = F('BezTriple')['vec'][1]; fr = F('BezTriple')['radius'][1]
            ctrl = []
            for k in range(bb[4]):
                base = bb[5] + k * sz
                vec = np.frombuffer(B.data, np.float32, 9, base + fv).reshape(3, 3)
                r = np.frombuffer(B.data, np.float32, 1, base + fr)[0]
                ctrl.append((vec, r))
            res = min(resu, 6)
            for k in range(len(ctrl) - 1):
                (a, ra), (b, rb) = ctrl[k], ctrl[k + 1]
                p0, p1, p2, p3 = a[1], a[2], b[0], b[1]
                for s in range(res):
                    t = s / res; u = 1 - t
                    pts.append(u**3*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t**3*p3); rad.append(ra*u + rb*t)
            if ctrl: pts.append(ctrl[-1][0][1]); rad.append(ctrl[-1][1])
        else:  # poly / nurbs: use control points
            bb = B.block(B.get('Nurb', n_off, 'bp'), i0)
            if bb is None: continue
            sz = bb[1] // max(bb[4], 1)
            fv = F('BPoint')['vec'][1]; fr = F('BPoint')['radius'][1]
            for k in range(bb[4]):
                base = bb[5] + k * sz
                pts.append(np.frombuffer(B.data, np.float32, 3, base + fv).copy())
                rad.append(np.frombuffer(B.data, np.float32, 1, base + fr)[0])
        if len(pts) < 2 or depth <= 0: continue
        Pw = to_world(np.array(pts), M)
        scale = np.cbrt(abs(np.linalg.det(M[:3, :3])))
        R = np.maximum(np.array(rad) * depth * scale, 1e-5)
        V, T = tube(Pw, R, 8)
        out_V.append(V); out_T.append(T + off); off += len(V)
    if not out_V: return None
    return np.concatenate(out_V), np.concatenate(out_T)

def tube(P, R, seg):
    n = len(P)
    tang = np.gradient(P, axis=0); tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-12
    ref = np.array([0, 0, 1.0]) if abs(tang[0, 2]) < 0.9 else np.array([1.0, 0, 0])
    N = []; nrm = np.cross(tang[0], ref); nrm /= np.linalg.norm(nrm) + 1e-12
    for i in range(n):
        nrm = nrm - tang[i] * np.dot(nrm, tang[i]); nrm /= np.linalg.norm(nrm) + 1e-12; N.append(nrm.copy())
    N = np.array(N); Bn = np.cross(tang, N)
    ang = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    V = (P[:, None, :] + R[:, None, None] * (np.cos(ang)[None, :, None] * N[:, None, :] + np.sin(ang)[None, :, None] * Bn[:, None, :])).reshape(-1, 3)
    T = []
    for i in range(n - 1):
        for j in range(seg):
            a = i * seg + j; b = i * seg + (j + 1) % seg; c = a + seg; d = b + seg
            T += [(a, c, b), (b, c, d)]
    return V, np.array(T, np.int32)

# ---- walk main collections
SKIP={}
def main():
    out = []
    groups = [g for g in B.blocks_of(b'GR\0\0') if re.match(r'\d: ', idname(g))]
    stats = {}
    for g in groups:
        gname = idname(g)
        for cb in listbase(g[5] + F('Collection')['gobject'][1], B.index_of(g), 'CollectionObject'):
            obb = B.block(B.get('CollectionObject', cb[5], 'ob'), B.index_of(cb))
            if obb is None: SKIP['noob']=SKIP.get('noob',0)+1; continue
            typ = B.get('Object', obb[5], 'type')
            if typ not in (1, 2): continue
            name = idname(obb); M = obmat(obb)
            db = B.block(B.get('Object', obb[5], 'data'))
            if db is None: SKIP.setdefault('nodata',[]).append(name); continue
            res = None
            if typ == 1 and db[0] == b'ME\0\0':
                r = mesh_arrays(db)
                if r is None: SKIP.setdefault('mesh_fail',[]).append(name); continue
                V, T = r
                W = to_world(V, M)
                for axes, mob in mirrors(obb):
                    for ax in axes:
                        if mob:
                            mb = B.block(mob); MM = obmat(mb); inv = np.linalg.inv(MM)
                            loc = to_world(W, inv); loc[:, ax] *= -1; W2 = to_world(loc, MM)
                        else:
                            loc = V.astype(np.float64).copy(); loc[:, ax] *= -1; W2 = to_world(loc, M)
                        T = np.concatenate([T, T[:, ::-1] + len(W)]); W = np.concatenate([W, W2])
                res = (W, T)
            elif typ == 2 and db[0] == b'CU\0\0':
                res = curve_tubes(db, M)
            if res is None: SKIP.setdefault('nores',[]).append((name,typ)); continue
            W, T = res
            if np.linalg.det(M[:3, :3]) < 0 and typ == 1: T = T[:, ::-1]
            W = np.stack([W[:, 0], W[:, 2], -W[:, 1]], 1).astype(np.float32)  # Z-up -> Y-up
            out.append(dict(name=name, group=gname, type=typ, mods=mods(obb), V=W, T=T))
            stats[gname] = stats.get(gname, 0) + len(T)
    print({k: v for k, v in stats.items()}, 'objects', len(out))
    allV = np.concatenate([o['V'] for o in out]); print('bbox', allV.min(0), allV.max(0))
    pickle.dump(out, open('../work/raw.pkl', 'wb'), protocol=4)

if __name__=='__main__': main()
