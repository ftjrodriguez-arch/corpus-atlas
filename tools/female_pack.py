import pickle,json,numpy as np,os
from scipy.spatial import cKDTree
from repack import decimate,write_bin
out=pickle.load(open('../work/fem_full.pkl','rb'));raw=pickle.load(open('../work/raw3.pkl','rb'));cat=json.load(open('../corpus/data/catalog.json'))
S={int(r[0][1:]):r[4] for r in cat if r[0].startswith('n')}
rng=np.random.default_rng(3)
def samp(V,T,d):
    a,b,c=V[T[:,0]],V[T[:,1]],V[T[:,2]];ar=0.5*np.linalg.norm(np.cross(b-a,c-a),axis=1)
    n=np.maximum(0,np.round(ar*d+rng.random(len(ar))-0.5)).astype(int);idx=np.repeat(np.arange(len(T)),n)
    u=rng.random((len(idx),1));v=rng.random((len(idx),1));m=(u+v)>1;u[m]=1-u[m];v[m]=1-v[m]
    return a[idx]+(b[idx]-a[idx])*u+(c[idx]-a[idx])*v
def vn(V,T):
    a,b,c=V[T[:,0]],V[T[:,1]],V[T[:,2]];fn=np.cross(b-a,c-a);n=np.zeros_like(V)
    for k in range(3):np.add.at(n,T[:,k],fn)
    if np.einsum('ij,ij->',a,np.cross(b,c))<0:n=-n
    return n/(np.linalg.norm(n,axis=1,keepdims=True)+1e-12)
zpts={}
def zlayer(sys):
    if sys not in zpts:zpts[sys]=np.concatenate([samp(raw[i]['V'].astype(float),raw[i]['T'],2.5e5) for i,s in S.items() if s==sys])
    return zpts[sys]
OCC={'piel_f':['piel_f'],'mama':['mama','#muscular'],'reproductor_f':['reproductor_f','#oseo','#digestivo','#urinario']}
RATIO={'piel_f':.8,'mama':.25,'reproductor_f':.7}
own={k:np.concatenate([samp(V.astype(float),T,2.5e5 if k!='piel_f' else 6e4) for _,V,T in v]) for k,v in out.items()}
R=0.011;os.makedirs('../hr/w_in',exist_ok=True)
for k,items in out.items():
    tr=cKDTree(np.concatenate([own[o] if not o.startswith('#') else zlayer(o[1:]) for o in OCC[k]]))
    res=[];tt=0
    for nid,V,T in items:
        V=V.astype(float);u=np.unique(T);rm=-np.ones(len(V),int);rm[u]=np.arange(len(u));V=V[u];T=rm[T]
        N=vn(V,T);d,_=tr.query(V+N*R*1.05,k=40,distance_upper_bound=R);cnt=np.isfinite(d).sum(1)
        d2,_=tr.query(V+N*R*0.45,k=24,distance_upper_bound=R*0.42);cnt2=np.isfinite(d2).sum(1)
        occ=np.clip(cnt/26,0,1)*0.65+np.clip(cnt2/12,0,1)*0.35;ao=1-0.62*occ**1.3
        if k=='piel_f':ao=np.maximum(ao,0.85)
        C=np.zeros((len(V),3));C[:,0]=ao*255
        Vd,Td,Cd=decimate(V,T,C,int(len(T)*(0.3 if nid.startswith('s') else RATIO[k])));res.append((nid,Vd,Td,Cd));tt+=len(Td)
    write_bin(f'../hr/w_in/{k}.bin',res);print(k,len(res),tt)
