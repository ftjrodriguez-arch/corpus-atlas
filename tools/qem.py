"""Simplificación por contracción de aristas con error cuadrático (Garland–Heckbert), con bordes protegidos."""
import numpy as np,heapq
def simplify(V,T,target):
    V=np.asarray(V,float).copy();T=np.asarray(T,np.int64).copy();n=len(V)
    if len(T)<=target:return V,T
    alive_f=np.ones(len(T),bool);vf=[set() for _ in range(n)]
    for f,t in enumerate(T):
        for v in t:vf[v].add(f)
    def fplane(f):
        a,b,c=V[T[f]];nn=np.cross(b-a,c-a);ar=np.linalg.norm(nn)
        if ar<1e-20:return None,0
        nn/=ar;return np.append(nn,-nn@a),ar
    Q=np.zeros((n,4,4))
    for f in range(len(T)):
        p,ar=fplane(f)
        if p is None:continue
        K=np.outer(p,p)*ar
        for v in T[f]:Q[v]+=K
    # bordes
    E=np.sort(np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]]),1);ue,inv,cnt=np.unique(E,axis=0,return_inverse=True,return_counts=True)
    for (a,b),c in zip(ue,cnt):
        if c==1:
            fs=list(vf[a]&vf[b])
            if not fs:continue
            p,_=fplane(fs[0])
            if p is None:continue
            e=V[b]-V[a];nn=np.cross(e,p[:3]);l=np.linalg.norm(nn)
            if l<1e-20:continue
            nn/=l;pp=np.append(nn,-nn@V[a]);K=np.outer(pp,pp)*1e3*np.dot(e,e)
            Q[a]+=K;Q[b]+=K
    ver=np.zeros(n,np.int64);alive_v=np.ones(n,bool)
    def cost(a,b):
        Qs=Q[a]+Q[b];best=None
        for p in (V[a],V[b],(V[a]+V[b])/2):
            h=np.append(p,1.0);c=h@Qs@h
            if best is None or c<best[0]:best=(c,p)
        return best
    H=[]
    for a,b in ue:
        c,p=cost(a,b);H.append((c,int(a),int(b),0,0))
    heapq.heapify(H);nf=int(alive_f.sum())
    while nf>target and H:
        c,a,b,va,vb=heapq.heappop(H)
        if not(alive_v[a] and alive_v[b]) or va!=ver[a] or vb!=ver[b]:continue
        c2,p=cost(a,b)
        # comprobar inversión de caras
        ok=True;shared=vf[a]&vf[b]
        for f in (vf[a]|vf[b])-shared:
            t=T[f];old=V[t];new=old.copy();new[t==a]=p;new[t==b]=p
            n0=np.cross(old[1]-old[0],old[2]-old[0]);n1=np.cross(new[1]-new[0],new[2]-new[0])
            if np.dot(n0,n1)<=0.2*np.linalg.norm(n0)*np.linalg.norm(n1):ok=False;break
        if not ok:continue
        V[a]=p;Q[a]+=Q[b];alive_v[b]=False
        for f in shared:alive_f[f]=False;nf-=1
        for f in vf[b]-shared:
            T[f][T[f]==b]=a;vf[a].add(f)
        vf[a]-=shared
        for v in set(T[list(vf[a])].ravel())-{a} if vf[a] else []:vf[v]-=shared
        ver[a]+=1
        nb=set(T[list(vf[a])].ravel())-{a} if vf[a] else set()
        for v in nb:
            if alive_v[v]:
                c3,_=cost(a,v);x,y=(a,v);heapq.heappush(H,(c3,x,y,int(ver[x]),int(ver[y])))
    keep=np.where(alive_f)[0];T2=T[keep];used=np.unique(T2);remap=-np.ones(n,np.int64);remap[used]=np.arange(len(used))
    return V[used],remap[T2]
