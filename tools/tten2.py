import pickle,numpy as np
from scipy.spatial import cKDTree
raw=None if __name__!="__main__" else pickle.load(open('../work/raw3.pkl','rb'))
rng=np.random.default_rng(1)
def vn(V,T):
    a,b,c=V[T[:,0]],V[T[:,1]],V[T[:,2]];fn=np.cross(b-a,c-a);n=np.zeros_like(V)
    for k in range(3): np.add.at(n,T[:,k],fn)
    return n/(np.linalg.norm(n,axis=1,keepdims=True)+1e-12)
def ssn(V,T,d):
    a,b,c=V[T[:,0]],V[T[:,1]],V[T[:,2]];fn=np.cross(b-a,c-a);ar=0.5*np.linalg.norm(fn,axis=1)
    n=np.maximum(0,np.round(ar*d+rng.random(len(ar))-0.5)).astype(int);idx=np.repeat(np.arange(len(T)),n)
    u=rng.random((len(idx),1));v=rng.random((len(idx),1));m=(u+v)>1;u[m]=1-u[m];v[m]=1-v[m]
    return a[idx]+(b[idx]-a[idx])*u+(c[idx]-a[idx])*v, fn[idx]/(np.linalg.norm(fn[idx],axis=1,keepdims=True)+1e-12)
def thick(V,T):
    N=vn(V,T);S,SN=ssn(V,T,2e5);st=cKDTree(S)
    d,k=st.query(V,k=min(128,len(S)),distance_upper_bound=0.03)
    ok=np.isfinite(d);k=np.minimum(k,len(S)-1)
    dots=np.einsum('vkj,vj->vk',SN[k],N)
    opp=ok&(dots<-0.5)&(d>0.0004)
    return np.where(opp,d,0.03).min(1)
if __name__=='__main__':
    ids=[1713,1714,1872,1868]+[k for k in range(len(raw)) if raw[k]['name'].startswith(('Biceps brachii muscle.r','Gastrocnemius','Tibialis anterior muscle.r','Flexor digitorum superficialis.r','Extensor digitorum muscle.r'))]
    for i in ids:
        o=raw[i];V=o['V'].astype(float);T=o['T'];th=thick(V,T)
        print(i,o['name'],len(V),'thick pct',np.percentile(th,[5,10,25,50,90]).round(4))
