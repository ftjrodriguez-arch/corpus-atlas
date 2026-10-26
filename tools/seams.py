import numpy as np
from scipy.spatial import cKDTree
def bverts(T):
    E=np.sort(np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]]),1);ue,c=np.unique(E,axis=0,return_counts=True);return np.unique(ue[c==1].ravel())
def weld(items,rad=0.006,skip=()):
    """Acerca cada vértice de borde al punto medio con el vértice de borde más cercano de otra malla."""
    items=[(a,np.array(V,float),T,C) for a,V,T,C in items];P=[];own=[];idx=[]
    for k,(nid,V,T,C) in enumerate(items):
        b=bverts(T);P.append(V[b]);own+=[k]*len(b);idx+=list(b)
    P=np.concatenate(P);own=np.array(own);idx=np.array(idx);tr=cKDTree(P);d,J=tr.query(P,k=16,distance_upper_bound=rad)
    moved=0;new=P.copy()
    for i in range(len(P)):
        for dd,jj in zip(d[i],J[i]):
            if jj>=len(P):break
            if own[jj]!=own[i]:new[i]=(P[i]+P[jj])/2;moved+=1;break
    for i in range(len(P)):items[own[i]][1][idx[i]]=new[i]
    return [(a,V.astype(np.float32),T,C) for a,V,T,C in items],moved
def gapstat(items):
    P=[];own=[]
    for k,(nid,V,T,C) in enumerate(items):b=bverts(T);P.append(np.asarray(V)[b]);own+=[k]*len(b)
    P=np.concatenate(P);own=np.array(own);tr=cKDTree(P);d,j=tr.query(P,k=8)
    best=np.array([min([dd for dd,jj in zip(d[i],j[i]) if own[jj]!=own[i]]+[1]) for i in range(len(P))])
    return np.percentile(best[best<0.02],[50,90,99]).round(4),(best<0.0005).mean().round(3)
def bedges(T):
    E=np.sort(np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]]),1);ue,c=np.unique(E,axis=0,return_counts=True);return ue[c==1]
def project(items,rad=0.006):
    """Lleva cada vértice de borde al punto más cercano de un borde abierto de otra malla (cierra las uniones en T)."""
    items=[(a,np.array(V,float),T,C) for a,V,T,C in items];A=[];B=[];own=[]
    for k,(nid,V,T,C) in enumerate(items):
        e=bedges(T);A.append(V[e[:,0]]);B.append(V[e[:,1]]);own+=[k]*len(e)
    A=np.concatenate(A);B=np.concatenate(B);own=np.array(own);tr=cKDTree((A+B)/2);moved=0
    for k,(nid,V,T,C) in enumerate(items):
        b=bverts(T)
        if not len(b):continue
        X=V[b];d,J=tr.query(X,k=12,distance_upper_bound=rad*4)
        newX=X.copy()
        for r in range(len(b)):
            best=rad;bp=None
            for jj in J[r]:
                if jj>=len(A) or own[jj]==k:continue
                a,bb=A[jj],B[jj];ab=bb-a;t=np.clip(np.dot(X[r]-a,ab)/max(np.dot(ab,ab),1e-12),0,1);p=a+t*ab;dd=np.linalg.norm(p-X[r])
                if dd<best:best=dd;bp=p
            if bp is not None:newX[r]=bp;moved+=1
        V[b]=newX
    return [(a,V.astype(np.float32),T,C) for a,V,T,C in items],moved
