import numpy as np
from scipy.spatial import cKDTree
def umeyama(A,B,scale=True):
    ma,mb=A.mean(0),B.mean(0);a,b=A-ma,B-mb;C=b.T@a/len(A);U,S,Vt=np.linalg.svd(C);D=np.eye(3)
    if np.linalg.det(U@Vt)<0:D[2,2]=-1
    R=U@D@Vt;s=(S*np.diag(D)).sum()/((a**2).sum()/len(A)) if scale else 1.0;t=mb-s*R@ma;return s,R,t
def icp(src,dst,iters=40,scale=True,trim=0.8,init=None):
    tree=cKDTree(dst);s,R,t=init if init else (1.0,np.eye(3),dst.mean(0)-src.mean(0))
    for it in range(iters):
        P=s*src@R.T+t;d,j=tree.query(P);keep=d<=np.quantile(d,trim)
        s2,R2,t2=umeyama(src[keep],dst[j[keep]],scale);s,R,t=s2,R2,t2
    P=s*src@R.T+t;d,_=tree.query(P);return (s,R,t),float(np.median(d))
def apply(T,V):s,R,t=T;return s*V@R.T+t
