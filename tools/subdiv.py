import numpy as np
def weld(V,T,eps=1e-7):
    q=np.round(V/eps).astype(np.int64);_,idx,inv=np.unique(q,axis=0,return_index=True,return_inverse=True)
    inv=inv.reshape(-1);T2=inv[T];ok=(T2[:,0]!=T2[:,1])&(T2[:,1]!=T2[:,2])&(T2[:,0]!=T2[:,2]);return V[idx],T2[ok]
def loop(V,T):
    nv=len(V);E=np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]]);opp=np.concatenate([T[:,2],T[:,0],T[:,1]])
    Es=np.sort(E,1);key=Es[:,0]*nv+Es[:,1];uk,einv,ecnt=np.unique(key,return_inverse=True,return_counts=True)
    ne=len(uk);ea=uk//nv;eb=uk%nv
    # edge points
    oppsum=np.zeros((ne,3));np.add.at(oppsum,einv,V[opp])
    interior=ecnt==2
    EP=np.where(interior[:,None],0.375*(V[ea]+V[eb])+0.125*oppsum,0.5*(V[ea]+V[eb]))
    # vertex update
    bnd_e=~interior
    nsum=np.zeros((nv,3));ncnt=np.zeros(nv)
    np.add.at(nsum,ea,V[eb]);np.add.at(nsum,eb,V[ea]);np.add.at(ncnt,ea,1);np.add.at(ncnt,eb,1)
    bsum=np.zeros((nv,3));bcnt=np.zeros(nv)
    np.add.at(bsum,ea[bnd_e],V[eb[bnd_e]]);np.add.at(bsum,eb[bnd_e],V[ea[bnd_e]]);np.add.at(bcnt,ea[bnd_e],1);np.add.at(bcnt,eb[bnd_e],1)
    n=np.maximum(ncnt,1);beta=np.where(n>3,3/(8*n),3/16)
    VP=(1-n*beta)[:,None]*V+beta[:,None]*nsum
    isb=bcnt==2
    VP[isb]=0.75*V[isb]+0.125*bsum[isb]
    odd=bcnt>2;VP[odd]=V[odd]
    NV=np.concatenate([VP,EP]);e=einv.reshape(3,-1).T+nv  # edges per tri: (0-1),(1-2),(2-0)
    a,b,c=T[:,0],T[:,1],T[:,2];m01,m12,m20=e[:,0],e[:,1],e[:,2]
    NT=np.concatenate([np.stack([a,m01,m20],1),np.stack([m01,b,m12],1),np.stack([m20,m12,c],1),np.stack([m01,m12,m20],1)])
    return NV,NT
def subdivide(V,T,levels):
    V,T=weld(V.astype(np.float64),T)
    for _ in range(levels): V,T=loop(V,T)
    return V.astype(np.float32),T.astype(np.int64)
