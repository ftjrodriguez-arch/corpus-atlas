import numpy as np
from scipy.sparse import coo_matrix,diags
def taubin(V,T,it=6,lam=0.5,mu=-0.53,fix_boundary=True):
    V=np.asarray(V,float).copy();n=len(V)
    E=np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]]);E=np.concatenate([E,E[:,::-1]])
    A=coo_matrix((np.ones(len(E)),(E[:,0],E[:,1])),shape=(n,n)).tocsr();A.data[:]=1
    deg=np.asarray(A.sum(1)).ravel();deg[deg==0]=1;W=diags(1/deg)@A
    fixed=np.zeros(n,bool)
    if fix_boundary:
        Es=np.sort(np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]]),1);u,c=np.unique(Es,axis=0,return_counts=True);fixed[u[c==1].ravel()]=True
    for _ in range(it):
        for f in (lam,mu):
            D=W@V-V;D[fixed]=0;V+=f*D
    return V
