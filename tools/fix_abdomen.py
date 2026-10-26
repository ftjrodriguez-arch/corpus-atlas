"""Corrige la pared abdominal: separa la vaina del recto (aponeurosis de los oblicuos y del transverso)
de las mallas musculares, para que el recto del abdomen quede expuesto en la línea media como en la disección clásica."""
import pickle,json,numpy as np
raw=pickle.load(open('../work/raw3.pkl','rb'))
PAIRS={'derecho':dict(rect=1646,eo=1650,io=1652,ta=1654),'izquierdo':dict(rect=1647,eo=1651,io=1653,ta=1655)}
BIN=0.006
def profile(V):
    yb=np.floor(V[:,1]/BIN).astype(int);P={}
    for b in np.unique(yb):
        m=yb==b;ax=np.abs(V[m,0]);P[b]=(ax.max(),V[m,2].max(),V[m,2].min(),np.median(V[m,2]))
    return P
def smooth_get(P,y,k):
    b=int(np.floor(y/BIN));vals=[P[c][k] for c in range(b-2,b+3) if c in P]
    return np.mean(vals) if vals else None
new=[];report={}
for side,ids in PAIRS.items():
    R=raw[ids['rect']]['V'].astype(float);P=profile(R);ylo,yhi=R[:,1].min(),R[:,1].max()
    for key in ('eo','io','ta'):
        i=ids[key];o=raw[i];V=o['V'].astype(float);T=o['T']
        # vertex classification
        inreg=np.zeros(len(V),bool);ant=np.zeros(len(V),bool)
        for vi,(x,y,z) in enumerate(V):
            if y<ylo-0.004 or y>yhi+0.004: continue
            xr=smooth_get(P,y,0)
            if xr is None: continue
            if abs(x)<=xr+0.003:
                inreg[vi]=True;zm=smooth_get(P,y,3);ant[vi]=z>zm
        cen_in=inreg[T].all(1)
        a_tri=cen_in&ant[T].all(1);p_tri=cen_in&~ant[T].any(1)
        keep=~(a_tri|p_tri)
        report[f'{key}_{side}']=(int(a_tri.sum()),int(p_tri.sum()),int(keep.sum()),len(T))
        def sub(mask):
            TT=T[mask];u=np.unique(TT);rm=-np.ones(len(V),int);rm[u]=np.arange(len(u));return V[u].astype(np.float32),rm[TT]
        if a_tri.any(): new.append(('ant',side,key,*sub(a_tri)))
        if p_tri.any(): new.append(('post',side,key,*sub(p_tri)))
        Vk,Tk=sub(keep);raw[i]=dict(o,V=Vk,T=Tk)
print(report)
# merge sheath pieces per side and lamina
out={}
for lam,side,key,V,T in new:
    k=(lam,side);Vs,Ts=out.get(k,([],[]));off=sum(len(v) for v in Vs);Vs.append(V);Ts.append(T+off);out[k]=(Vs,Ts)
cat=json.load(open('../corpus/data/catalog.json'));ex=json.load(open('../corpus/data/extras.json'))
NAMES={'ant':('Anterior layer of rectus sheath','Hoja anterior de la vaina del músculo recto del abdomen','Lamina anterior vaginae musculi recti abdominis'),
       'post':('Posterior layer of rectus sheath','Hoja posterior de la vaina del músculo recto del abdomen','Lamina posterior vaginae musculi recti abdominis')}
added=[]
for (lam,side),(Vs,Ts) in sorted(out.items()):
    idx=len(raw);V=np.concatenate(Vs);T=np.concatenate(Ts)
    raw.append({'name':NAMES[lam][0]+('.r' if side=='derecho' else '.l'),'V':V,'T':T,'group':'4'})
    nid=f'n{idx}';cat.append([nid,NAMES[lam][0],NAMES[lam][1],NAMES[lam][2],'fascia',side,''])
    ex['reg'][nid]='Abdomen';added.append((nid,lam,side,len(T)))
# depth: el recto y el piramidal son superficiales (bajo la vaina); el transverso es el plano profundo
for i in (1646,1647,1657,1659): ex['dep'][f'n{i}']='s'
for i in (1652,1653): ex['dep'][f'n{i}']='i'
for i in (1654,1655): ex['dep'][f'n{i}']='p'
print(added)
pickle.dump(raw,open('../work/raw3.pkl','wb'),protocol=4)
json.dump(cat,open('../corpus/data/catalog.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump(cat,open('../work/pub/data/catalog.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump(ex,open('../corpus/data/extras.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump(added,open('../work/sheath_ids.json','w'))
