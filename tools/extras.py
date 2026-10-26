import pickle,json,numpy as np,sys,re;sys.path.insert(0,'.')
from scipy.spatial import cKDTree
from names import base,side,ta
raw=pickle.load(open('../work/raw.pkl','rb'))
cat=json.load(open('../work/pub/data/catalog.json')); rig=json.load(open('../work/rig.json'))
bpath=json.load(open('../work/bonuspath.json'))
# ---- landmarks
lm=pickle.load(open('../work/lm3.pkl','rb'))
bones={i:o for i,o in enumerate(raw) if o['group'].startswith('1') and not o['name'].endswith('.g')}
keys=list(bones);V=np.concatenate([bones[k]['V'] for k in keys]);own=np.concatenate([np.full(len(bones[k]['V']),k) for k in keys]);T=cKDTree(V)
LM={}
for name,p,bn,d in lm:
    if d>0.015: continue
    for sx in (1,-1):
        q=np.array(p);q[0]*=sx
        dd,ix=T.query(q)
        if dd>0.02: continue
        oi=own[ix];bid=f'n{oi}'
        en=name.strip('()')
        r=ta(en); es=r[4] if r else None
        LM.setdefault(bid,[]).append([es or en,en,[round(float(x),4) for x in q]])
# dedupe per bone
for k in LM:
    seen=set();u=[]
    for e in LM[k]:
        if e[1] in seen: continue
        seen.add(e[1]);u.append(e)
    LM[k]=sorted(u,key=lambda e:e[0])
print('bones with landmarks',len(LM),'total',sum(len(v) for v in LM.values()),'sin es',sum(1 for v in LM.values() for e in v if e[0]==e[1]))
# ---- depth for muscles + region for all
P=lambda k:np.array(rig[k])
segs={'spineLow':('pelvis','l3'),'spineUp':('l3','c7'),'head':('c7','headtop')}
for S in 'RL':
    segs.update({f'clav_{S}':('c7',f'shoulder_{S}'),f'arm_{S}':(f'shoulder_{S}',f'elbow_{S}'),f'fore_{S}':(f'elbow_{S}',f'wrist_{S}'),f'hand_{S}':(f'wrist_{S}',f'hand_{S}'),
      f'pelv_{S}':('pelvis',f'hip_{S}'),f'thigh_{S}':(f'hip_{S}',f'knee_{S}'),f'leg_{S}':(f'knee_{S}',f'ankle_{S}'),f'foot_{S}':(f'ankle_{S}',f'toe_{S}'),f'heel_{S}':(f'ankle_{S}',f'heel_{S}')})
def sd(p,a,b):
    a,b=P(a),P(b);ab=b-a;t=np.clip(np.dot(p-a,ab)/np.dot(ab,ab),0,1);return np.linalg.norm(p-(a+ab*t))
def region(c):
    best=min(segs,key=lambda k:sd(c,*segs[k]))
    b=best.split('_')[0]
    if b=='head': return 'Cabeza' if c[1]>1.56 else 'Cuello'
    if b=='spineUp': return 'Tórax' if c[1]>1.2 else 'Abdomen'
    if b=='spineLow': return 'Abdomen' if c[2]>0 and c[1]>0.95 else 'Pelvis y región lumbar'
    return {'clav':'Hombro y cintura escapular','arm':'Brazo','fore':'Antebrazo','hand':'Mano','pelv':'Cadera y región glútea','thigh':'Muslo','leg':'Pierna','foot':'Pie','heel':'Pie'}[b]
bonesV=V
rng=np.random.default_rng(0);pts=[]
for k in keys:
    o=bones[k];A=o['V'][o['T'][:,0]];Bv=o['V'][o['T'][:,1]];C=o['V'][o['T'][:,2]]
    for _ in range(4):
        u=rng.random((len(A),1));v=rng.random((len(A),1));m=(u+v)>1;u[m]=1-u[m];v[m]=1-v[m];pts.append(A+(Bv-A)*u+(C-A)*v)
TS=cKDTree(np.concatenate(pts+[V]))
dep={};reg={}
for r in cat:
    i=int(r[0][1:]);o=raw[i];c=o['V'].mean(0);reg[r[0]]=region(c)
    if r[4]=='muscular':
        sup=any('Superficial muscles' in p for p in bpath.get(o['name'],[]))
        if sup: dep[r[0]]='s'
        else:
            samp=o['V'][::max(1,len(o['V'])//400)];d,_=TS.query(samp);dep[r[0]]='p' if (np.mean(d<0.006)>0.3 or np.median(d)<0.009) else 'i'
import collections;print(collections.Counter(dep.values()));print(collections.Counter(reg.values()).most_common())
names={r[0]:r[1] for r in cat}
for k in list(dep)[:0]: pass
for nm in ['Supinator','Brachialis muscle','Biceps brachii muscle','Long head of biceps brachii','Soleus muscle','Vastus intermedius muscle','Rectus femoris muscle','Subscapularis muscle','Multifidus lumborum muscle','Pectoralis minor muscle']:
    ks=[k for k in dep if names[k]==nm]; print(nm,[dep[k] for k in ks])
json.dump({'lm':LM,'dep':dep,'reg':reg},open('../work/pub/data/extras.json','w'),ensure_ascii=False,separators=(',',':'))
