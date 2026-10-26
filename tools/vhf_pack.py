"""Visible Human Female (HRA, CC BY 4.0) -> atlas frame, decimated layers with baked AO, bins for Draco."""
import pickle,json,re,struct,os,numpy as np
from scipy.spatial import cKDTree
from repack import decimate, write_bin
M=pickle.load(open('../work/vhf_raw.pkl','rb'))
EX=('VH_F_placenta','Yao_lymph_node')
OFF=np.array([0.006,0.79476,0.078])
def layer(m):
    p=m['path'];n=m['name'].lower();g=p[2] if len(p)>2 else ''
    if g=='VH_F_skin': return 'f_piel'
    if g=='VH_F_mammary_gland': return 'f_mama'
    if g in('VH_F_pelvis','VH_F_vertebrae','VH_F_lower_limb'):
        return 'f_articular' if re.search(r'ligament|menisc|cartilage|disc|tendon|capsule|bursa',n) else 'f_oseo'
    if g in('VH_F_muscles_of_eye','VH_F_muscles_of_knee'): return 'f_muscular'
    if g in('VH_F_vagina','VH_F_fallopian_tube','VH_F_ligaments_of_uterus_and_ovaries','VH_F_ovary','VH_F_uterus'): return 'f_reproductor'
    if g in('VH_F_heart','VH_F_blood_vasculature'): return 'f_vasos'
    if g in('VH_F_eyes',): return 'f_ojos'
    if g in('Allen_brain','VH_F_spinal_cord','VH_F_nerves_of_eye'): return 'f_nervioso'
    return 'f_visceras'
RATIO={'f_piel':.4,'f_mama':.12,'f_oseo':.45,'f_articular':.6,'f_muscular':.6,'f_reproductor':.7,'f_vasos':.35,'f_ojos':.06,'f_nervioso':.25,'f_visceras':.4}
def vnorm(V,T):
    a,b,c=V[T[:,0]],V[T[:,1]],V[T[:,2]];fn=np.cross(b-a,c-a);n=np.zeros_like(V)
    for k in range(3): np.add.at(n,T[:,k],fn)
    return n/(np.linalg.norm(n,axis=1,keepdims=True)+1e-12)
rng=np.random.default_rng(2)
def samp(V,T,d):
    a,b,c=V[T[:,0]],V[T[:,1]],V[T[:,2]];ar=0.5*np.linalg.norm(np.cross(b-a,c-a),axis=1)
    n=np.maximum(0,np.round(ar*d+rng.random(len(ar))-0.5)).astype(int);idx=np.repeat(np.arange(len(T)),n)
    u=rng.random((len(idx),1));v=rng.random((len(idx),1));m=(u+v)>1;u[m]=1-u[m];v[m]=1-v[m]
    return a[idx]+(b[idx]-a[idx])*u+(c[idx]-a[idx])*v
items={};pts={}
for i,m in enumerate(M):
    if any(e in m['path'] for e in EX): continue
    L=layer(m);V=m['V']+OFF;T=m['T']
    # drop unreferenced / degenerate
    used=np.unique(T);rm=np.full(len(V),-1);rm[used]=np.arange(len(used));V=V[used];T=rm[T]
    items.setdefault(L,[]).append(['f'+str(i),m['name'],V,T])
    pts.setdefault(L,[]).append(samp(V,T,2.5e5 if L!='f_piel' else 6e4))
pts={k:np.concatenate(v) for k,v in pts.items()}
OCC={'f_piel':['f_piel'],'f_mama':['f_mama','f_piel'],'f_oseo':['f_oseo','f_articular'],'f_articular':['f_oseo','f_articular','f_muscular'],'f_muscular':['f_muscular','f_oseo'],
     'f_reproductor':['f_reproductor','f_visceras','f_oseo','f_vasos'],'f_vasos':['f_vasos','f_visceras','f_oseo'],'f_ojos':['f_ojos','f_muscular'],'f_nervioso':['f_nervioso','f_oseo'],'f_visceras':['f_visceras','f_reproductor','f_vasos','f_oseo']}
os.makedirs('../hr/f_in',exist_ok=True);names={}
R=0.011
for L,its in items.items():
    tr=cKDTree(np.concatenate([pts[k] for k in OCC[L] if k in pts]))
    out=[];tt=0
    for nid,name,V,T in its:
        N=vnorm(V,T)
        if np.einsum('ij,ij->',V[T[:,0]],np.cross(V[T[:,1]],V[T[:,2]]))<0: N=-N
        d,_=tr.query(V+N*R*1.05,k=40,distance_upper_bound=R);cnt=np.isfinite(d).sum(1)
        d2,_=tr.query(V+N*R*0.45,k=24,distance_upper_bound=R*0.42);cnt2=np.isfinite(d2).sum(1)
        occ=np.clip(cnt/26,0,1)*0.65+np.clip(cnt2/12,0,1)*0.35;ao=1-0.62*occ**1.3
        C=np.zeros((len(V),3));C[:,0]=ao*255
        Vd,Td,Cd=decimate(V,T,C,int(len(T)*RATIO[L]))
        out.append((nid,Vd,Td,Cd));tt+=len(Td);names[nid]=[name,L]
    write_bin(f'../hr/f_in/{L}.bin',out);print(L,len(out),tt,flush=True)
json.dump(names,open('../work/vhf_ids.json','w'))
