"""Cuerpo femenino completo sobre el atlas de Z-Anatomy:
- mismos huesos, músculos, ligamentos, vasos, nervios y vísceras que el hombre (salvo los órganos masculinos);
- órganos genitales femeninos, vasos uterinos y glándula mamaria del Visible Human Female (HuBMAP HRA, CC BY 4.0),
  registrados a la pelvis y al tórax del atlas;
- piel femenina: la piel del atlas remodelada sobre las mamas y en la región urogenital."""
import pickle,json,re,numpy as np
from scipy.spatial import cKDTree
from reg import icp,umeyama
M=pickle.load(open('../work/vhf_raw.pkl','rb'));raw=pickle.load(open('../work/raw3.pkl','rb'))
cat=json.load(open('../corpus/data/catalog.json'));fem=json.load(open('../corpus/data/fem.json'))
FC={r[0]:r for r in fem['cat']}
rng=np.random.default_rng(0)
samp=lambda P,n:P[rng.choice(len(P),min(n,len(P)),replace=False)]
# ---- registro de la pelvis (escala moderada para que los órganos quepan en esta pelvis)
H=np.concatenate([M[i]['V'] for i,m in enumerate(M) if re.search(r'(pubis|ilium|ischium)_compact',m['name'])])
Zp=np.concatenate([raw[i]['V'] for i in (153,268)]).astype(float)
(s1,R1,t1),e=icp(samp(H,5000),samp(Zp,8000),iters=60,scale=True,init=(1.0,np.eye(3),Zp.mean(0)-H.mean(0)))
c=H.mean(0);m=s1*R1@c+t1;sP=0.88;TP=(sP,R1,m-sP*R1@c);print('pelvis scale',round(s1,3),'->',sP,'err',round(e*1000,1))
# ---- registro del tórax por los pulmones
L=np.concatenate([M[i]['V'] for i,m in enumerate(M) if 'bronchopulmonary_segment' in m['name']])
ZL=np.concatenate([raw[i]['V'] for i in (3546,3547,3548,3549,3550)]).astype(float)
TT,e2=icp(samp(L,5000),samp(ZL,8000),iters=60,scale=True,init=(1.0,np.eye(3),ZL.mean(0)-L.mean(0)));print('thorax',round(TT[0],3),'err',round(e2*1000,1))
ap=lambda T,V:T[0]*V@T[1].T+T[2]
# ---- piezas femeninas
repro=[i for i,m in enumerate(M) if len(m['path'])>2 and m['path'][2] in('VH_F_vagina','VH_F_fallopian_tube','VH_F_ligaments_of_uterus_and_ovaries','VH_F_ovary','VH_F_uterus')]
repro+=[i for i,m in enumerate(M) if re.search(r'uterine_(artery|vein)|ovarian_(artery|vein)',m['name'])]
mama=[i for i,m in enumerate(M) if len(m['path'])>2 and m['path'][2]=='VH_F_mammary_gland']
out={'reproductor_f':[],'mama':[],'piel_f':[]}
for i in repro: out['reproductor_f'].append((f'w{i}',ap(TP,M[i]['V']),M[i]['T']))
BV={i:ap(TT,M[i]['V']) for i in mama}
# las mamas del Visible Human (mujer de 59 años) son grandes para este tórax: se reducen al 82 % sobre su base
for side in 'LR':
    ids=[i for i in mama if M[i]['name'].endswith('_'+side)]
    A=np.concatenate([BV[i] for i in ids]);base=np.array([A[:,0].mean(),A[:,1].mean(),np.percentile(A[:,2],5)])
    for i in ids: BV[i]=base+(BV[i]-base)*0.82
# apoyar la mama sobre el pectoral mayor: la cara profunda de la grasa mamaria, 4 mm por delante del músculo
pec=np.concatenate([raw[i]['V'] for i in (1619,1620,1621,1622,1623,1624)]).astype(float)
for side in 'LR':
    ids=[i for i in mama if M[i]['name'].endswith('_'+side)]
    fat=[i for i in ids if 'fat' in M[i]['name']][0];F=BV[fat]
    # superficie anterior del pectoral bajo la huella de la mama (máximo z por celda xy)
    tree=cKDTree(pec[:,:2]);d,j=tree.query(F[:,:2],k=6,distance_upper_bound=0.03)
    ok=np.isfinite(d).all(1)
    zpec=np.where(ok,np.max(np.where(np.isfinite(d),pec[np.minimum(j,len(pec)-1),2],-9),axis=1),np.nan)
    gap=F[:,2]-zpec;deep=np.nanpercentile(gap,3)
    dz=0.004-deep;print(side,'breast shift z mm',round(dz*1000,1))
    for i in ids: BV[i]=BV[i]+np.array([0,0,dz])
def vnorm(V,T):
    a,b,c=V[T[:,0]],V[T[:,1]],V[T[:,2]];fn=np.cross(b-a,c-a);n=np.zeros_like(V)
    for k in range(3):np.add.at(n,T[:,k],fn)
    n/=np.linalg.norm(n,axis=1,keepdims=True)+1e-12
    if (n*(V-V.mean(0))).sum(1).mean()<0:n=-n
    return n
for i in mama:
    nm=M[i]['name']
    if re.search(r'nipple|areola',nm):
        fat=[k for k in mama if 'fat' in M[k]['name'] and M[k]['name'][-1]==nm[-1]][0]
        ft=cKDTree(BV[fat]);_,jn=ft.query(BV[i]);FNn=vnorm(BV[fat],M[fat]['T'])
        out['piel_f'].append((f'w{i}',BV[i]+FNn[jn]*0.005,M[i]['T']))
    else:
        out['mama'].append((f'w{i}',BV[i],M[i]['T']))
    if 'fat' in nm:
        # piel de la mama: la superficie de la grasa desplazada 2,5 mm hacia fuera
        Vf=BV[i];Nf=vnorm(Vf,M[i]['T']);out['piel_f'].append((f's{i}',Vf+Nf*0.0045,M[i]['T']))
# ---- piel femenina
skin_ids=[int(r[0][1:]) for r in cat if r[4]=='piel']
from subdiv import weld,loop
import subdiv as SD
def subdivide(V,T,lv):
    V,T=weld(V.astype(np.float64),T)
    for _ in range(lv):
        nv=len(V);E=np.sort(np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]]),1);ue,cnt=np.unique(E,axis=0,return_counts=True);b=np.unique(ue[cnt==1]);B0=V[b].copy()
        V,T=loop(V,T);V[b]=B0
    return V.astype(np.float32),T
_fp=np.concatenate([BV[i] for i in mama]);fx0,fx1=np.abs(_fp[:,0]).min()-0.06,np.abs(_fp[:,0]).max()+0.05;fy0,fy1=_fp[:,1].min()-0.05,_fp[:,1].max()+0.05
nsub=0
for i in skin_ids:
    V=raw[i]['V'];ax=np.abs(V[:,0])
    if False:
        V2,T2=subdivide(V,raw[i]['T'],2);raw[i]=dict(raw[i],V=V2,T=T2);nsub+=1
print('skin regions subdivided',nsub)
male_ext=[int(r[0][1:]) for r in cat if r[1] in('Glans penis','Corpus cavernosum of penis','Corpus spongiosum of penis','Testis','Epididymis')]
MX=np.concatenate([raw[i]['V'] for i in male_ext]).astype(float);mtree=cKDTree(MX)
fatV=np.concatenate([BV[i] for i in mama if 'fat' in M[i]['name']]);ftree=cKDTree(fatV)
areV=np.concatenate([BV[i] for i in mama if re.search('areola',M[i]['name'])]);atree=cKDTree(areV[:,:2])
# normales de la grasa mamaria (para empujar la piel hacia fuera)
allS=np.concatenate([raw[i]['V'] for i in skin_ids]).astype(float)
disp_pts=[];disp=[]
fat_n=np.zeros_like(fatV);fc=fatV.mean(0)
for i in mama:
    if 'fat' not in M[i]['name']:continue
for k,(i) in enumerate([0]):pass
# desplazamiento bruto: la piel queda al menos 6 mm por fuera de la grasa mamaria (a lo largo de su normal)
fatT=[];off_=0
for i in mama:
    if 'fat' in M[i]['name']:fatT.append(M[i]['T']+off_);off_+=len(M[i]['V'])
fatT=np.concatenate(fatT);a,b,c_=fatV[fatT[:,0]],fatV[fatT[:,1]],fatV[fatT[:,2]];fn=np.cross(b-a,c_-a);FN=np.zeros_like(fatV)
for k in range(3):np.add.at(FN,fatT[:,k],fn)
FN/=np.linalg.norm(FN,axis=1,keepdims=True)+1e-12
if (FN[:,2]*(fatV[:,2]-fatV[:,2].mean())).mean()<0:FN=-FN
d,j=ftree.query(allS,distance_upper_bound=0.05);near=np.isfinite(d)
raw_vec=np.zeros_like(allS)
jj=np.minimum(j,len(fatV)-1);P=fatV[jj];Nn=FN[jj];sd=np.einsum('ij,ij->i',allS-P,Nn)
need=near&(sd<0.006)&(allS[:,2]>0.0)
raw_vec[need]=(P[need]+Nn[need]*0.006)-allS[need]
raw_disp=np.linalg.norm(raw_vec,axis=1)
# suavizado espacial del campo (gaussiano 2 cm) para evitar aristas y grietas entre regiones
st=cKDTree(allS);idx=np.where(raw_disp>0)[0]
cand=st.query_ball_point(allS[idx],0.05)
aff=np.unique(np.concatenate([np.array(c_) for c_ in cand])) if len(idx) else np.array([],int)
smv=np.zeros_like(allS)
if len(aff):
    nb=st.query_ball_point(allS[aff],0.02)
    for a,lst in zip(aff,nb):
        lst=np.array(lst);w=np.exp(-np.sum((allS[lst]-allS[a])**2,1)/(2*0.008**2));v=(raw_vec[lst]*w[:,None]).sum(0)/w.sum()
        smv[a]=raw_vec[a] if raw_disp[a]>np.linalg.norm(v) else v
sm=np.linalg.norm(smv,axis=1)
print('skin verts displaced',(sm>0.0005).sum(),'max mm',round(sm.max()*1000,1))
# ---- región urogenital: relajación conjunta de ambos lados (sin pene ni escroto) + hendidura vulvar
ug=[i for i in skin_ids if raw[i]['name'].startswith('Urogenital region')]
Vs=[raw[i]['V'].astype(float) for i in ug];Ts=[raw[i]['T'] for i in ug];offs=np.cumsum([0]+[len(v) for v in Vs])
VA=np.concatenate(Vs);TA=np.concatenate([t+o for t,o in zip(Ts,offs)])
q=np.round(VA/1e-6).astype(np.int64);_,first,inv=np.unique(q,axis=0,return_index=True,return_inverse=True);inv=inv.reshape(-1)
W=VA[first];TW=inv[TA]
E=np.sort(np.concatenate([TW[:,[0,1]],TW[:,[1,2]],TW[:,[2,0]]]),1);ue,cnt=np.unique(E,axis=0,return_counts=True);bnd=set(ue[cnt==1].ravel())
dm,_=mtree.query(W);free=np.array([v for v in np.where(dm<0.03)[0] if v not in bnd])
nbr=[[] for _ in range(len(W))]
for a_,b_ in ue:nbr[a_].append(b_);nbr[b_].append(a_)
for it in range(600):W[free]=np.array([W[nbr[v]].mean(0) for v in free])
Zf=W[free];y0,y1=Zf[:,1].min(),Zf[:,1].max()
wgt=np.clip(1-np.abs(Zf[:,0])/0.012,0,1)*np.clip((y1-0.015-Zf[:,1])/0.02,0,1);W[free,2]-=0.007*wgt**1.5
VA=W[inv]
for k,i in enumerate(ug):raw[i]=dict(raw[i],V=VA[offs[k]:offs[k+1]].astype(np.float32))
print('urogenital joint relax',len(free))
off=0
for i in skin_ids:
    V=raw[i]['V'].astype(float).copy();n=len(V);off+=n;T=raw[i]['T']
    name=raw[i]['name']
    if re.search(r'Urogenital region|Pubic hairs',name):
        dm,_=mtree.query(V)
        if 'Pubic' in name:
            T=T[~(dm[T]<0.02).any(1)]
    out['piel_f'].append((f'F{i}',V,T))
pickle.dump(out,open('../work/fem_full.pkl','wb'),protocol=4)
print({k:len(v) for k,v in out.items()})
