"""Genitales externos femeninos, tejido eréctil y periné superficial: modelo paramétrico (esquemático) construido
sobre la pelvis femenina del atlas con medidas de referencia:
labios mayores ~9 cm, labios menores ~6 × 2 cm, glande del clítoris ~5,5 mm (Lloyd y cols., BJOG 2005);
cuerpo del clítoris 2–4 cm y pilares 5–9 cm adosados a las ramas isquiopubianas; bulbos del vestíbulo ~3,5 cm;
glándulas vestibulares mayores ~1 cm (Moore; O'Connell y cols.)."""
import pickle,numpy as np
from scipy.spatial import cKDTree
ovr=pickle.load(open('../work/f_ovr.pkl','rb'));fl=pickle.load(open('../work/f_layers_warped.pkl','rb'))
g=lambda lst,nid:[x for x in lst if x[0]==nid][0][1].astype(float)
S=np.concatenate([V for nid,V,T,C in fl['piel_f']]).astype(float)
Hs={'R':g(ovr['oseo'],'n153'),'L':g(ovr['oseo'],'n268')}
BL=g(ovr['urinario'],'n3553');VG=g(fl['reproductor_f'],'w405')
X=np.array([1.0,0,0])
# --- curva media de la vulva sobre la piel
mid=S[(np.abs(S[:,0])<0.005)&(S[:,1]>0.76)&(S[:,1]<0.86)&(S[:,2]>-0.02)&(S[:,2]<0.08)]
mt=cKDTree(mid)
A=np.array([0,0.836,0.064]);B=np.array([0,0.796,0.006])
ts=np.linspace(0,1,41);C=[]
for t in ts:
    p=A+(B-A)*t;d,j=mt.query(p,k=6);C.append(mid[j].mean(0)*0.6+p*0.4)
C=np.array(C);C[:,0]=0
for _ in range(20):C[1:-1]=0.5*C[1:-1]+0.25*(C[:-2]+C[2:])
Tg=np.gradient(C,axis=0);Tg/=np.linalg.norm(Tg,axis=1,keepdims=True)
N=np.cross(Tg,X);N/=np.linalg.norm(N,axis=1,keepdims=True)
if (N[:,2].mean()-N[:,1].mean())<0:N=-N   # hacia fuera: delante/abajo
Lc=np.linalg.norm(np.diff(C,axis=0),axis=1).sum();print('vulva length mm',round(Lc*1000,1))
def at(t,arr):
    t=np.clip(t,0,1)*(len(ts)-1);i=int(min(np.floor(t),len(ts)-2));f=t-i;v=arr[i]*(1-f)+arr[i+1]*f
    return v/np.linalg.norm(v) if arr is not C else v
def pt(t,lat=0.0,nrm=0.0):
    c=at(t,C);n=at(t,N);x=X
    if t<0 or t>1:  # extrapolación lineal
        tt=at(0 if t<0 else 1,Tg);c=c+tt*(t if t<0 else t-1)*Lc
    return c+x*lat+n*nrm
# --- generadores de mallas
def sweep(P,Fn,Fb,ra,rb,seg=18,caps=True):
    P=np.asarray(P);n=len(P);ang=np.linspace(0,2*np.pi,seg,endpoint=False)
    V=[];T=[]
    for i in range(n):
        for a in ang:V.append(P[i]+Fn[i]*np.cos(a)*rb[i]+Fb[i]*np.sin(a)*ra[i])
    for i in range(n-1):
        for k in range(seg):
            a=i*seg+k;b=i*seg+(k+1)%seg;c=a+seg;d=b+seg;T+= [[a,b,d],[a,d,c]]
    V=np.array(V)
    if caps:
        V=np.vstack([V,P[0],P[-1]]);s0=len(V)-2;s1=len(V)-1
        for k in range(seg):T.append([s0,(k+1)%seg,k]);a=(n-1)*seg;T.append([s1,a+k,a+(k+1)%seg])
    return V.astype(np.float32),np.array(T,np.int64)
def frames(P,up=None):
    P=np.asarray(P);Tt=np.gradient(P,axis=0);Tt/=np.linalg.norm(Tt,axis=1,keepdims=True)
    ref=np.array([1.0,0,0]) if up is None else up
    B=np.cross(Tt,ref);bad=np.linalg.norm(B,axis=1)<1e-3;B[bad]=np.cross(Tt[bad],[0,1,0]);B/=np.linalg.norm(B,axis=1,keepdims=True)
    Nn=np.cross(B,Tt);return Nn,B
def ellipsoid(c,ax,seg=20,rings=12):
    V=[];T=[]
    for i in range(rings+1):
        th=np.pi*i/rings
        for j in range(seg):
            ph=2*np.pi*j/seg;u=np.array([np.sin(th)*np.cos(ph),np.sin(th)*np.sin(ph),np.cos(th)]);V.append(c+ax@u)
    for i in range(rings):
        for j in range(seg):
            a=i*seg+j;b=i*seg+(j+1)%seg;T+=[[a,a+seg,b],[b,a+seg,b+seg]]
    return np.array(V,np.float32),np.array(T,np.int64)
def torus(c,n_,u_,a,b,r,seg=24,tseg=10):
    v_=np.cross(n_,u_);V=[];T=[]
    for i in range(seg):
        ph=2*np.pi*i/seg;ctr=c+u_*a*np.cos(ph)+v_*b*np.sin(ph);rd=(u_*a*np.cos(ph)+v_*b*np.sin(ph));rd/=np.linalg.norm(rd)
        for j in range(tseg):
            th=2*np.pi*j/tseg;V.append(ctr+rd*r*np.cos(th)+n_*r*np.sin(th))
    for i in range(seg):
        for j in range(tseg):
            a0=i*tseg+j;b0=i*tseg+(j+1)%tseg;c0=((i+1)%seg)*tseg+j;d0=((i+1)%seg)*tseg+(j+1)%tseg;T+=[[a0,c0,d0],[a0,d0,b0]]
    return np.array(V,np.float32),np.array(T,np.int64)
out=[]  # (nid, layer, en, es, la, side, V, T, tendon)
def add(nid,layer,en,es,la,side,VT,ten=0):out.append((nid,layer,en,es,la,side,VT[0],VT[1],ten))
# labios mayores (piel)
for side,sg in (('derecho',-1),('izquierdo',1)):
    tt=np.linspace(-0.12,1.1,40);P=[pt(t,sg*0.0135,0.0005) for t in tt];prof=np.sin(np.clip((tt+0.12)/1.22,0,1)*np.pi)**0.6
    Fn=np.array([at(np.clip(t,0,1),N) for t in tt]);Fb=np.tile(X,(len(tt),1))
    add('gLM'+side[0],'piel_f','Labium majus','Labio mayor','Labium majus pudendi',side,sweep(P,Fn,Fb,0.0105*prof+0.001,0.0075*prof+0.001))
# labios menores
for side,sg in (('derecho',-1),('izquierdo',1)):
    tt=np.linspace(0.08,0.82,30);prof=np.sin((tt-0.08)/0.74*np.pi)**0.8
    P=[pt(t,sg*0.0046,-0.0022) for t in tt];Fn=np.array([at(t,N) for t in tt]);Fb=np.tile(X,(len(tt),1))
    add('gLm'+side[0],'reproductor_f','Labium minus','Labio menor','Labium minus pudendi',side,sweep(P,Fn,Fb,0.0014*prof+0.0004,0.0068*prof+0.0006))
# prepucio y glande del clítoris
tt=np.linspace(-0.02,0.13,12);P=[pt(t,0,0.0002) for t in tt];prof=np.sin((tt+0.02)/0.15*np.pi)**0.7
add('gPrep','reproductor_f','Prepuce of clitoris','Prepucio del clítoris','Preputium clitoridis','',sweep(P,np.array([at(max(t,0),N) for t in tt]),np.tile(X,(len(tt),1)),0.0042*prof+0.0005,0.0030*prof+0.0005))
gl=pt(0.085,0,-0.0018);add('gGlans','reproductor_f','Glans of clitoris','Glande del clítoris','Glans clitoridis','',ellipsoid(gl,np.eye(3)*0.0028))
# vestíbulo, orificios
vc=pt(0.5,0,-0.0062);Tv=at(0.5,Tg);Nv=at(0.5,N)
add('gVest','reproductor_f','Vestibule of vagina','Vestíbulo de la vagina','Vestibulum vaginae','',ellipsoid(vc,np.c_[Tv*0.021,X*0.0062,Nv*0.0014]))
uo=pt(0.36,0,-0.0052);add('gUO','reproductor_f','External urethral orifice','Orificio externo de la uretra','Ostium urethrae externum feminae','',torus(uo,at(0.36,N),at(0.36,Tg),0.002,0.0016,0.0007))
io=pt(0.64,0,-0.0062);Ni=at(0.64,N);Ti=at(0.64,Tg)
add('gIO','reproductor_f','Vaginal orifice','Orificio de la vagina (introito)','Ostium vaginae','',torus(io,Ni,Ti,0.0105,0.0065,0.0018))
# conexión vagina–introito
vlow=VG[np.argmin(VG[:,1])];P=[io+(vlow-io)*s for s in np.linspace(0,1,10)];Fn,Fb=frames(P)
add('gVcan','reproductor_f','Vaginal canal (lower part)','Porción inferior de la vagina','Pars inferior vaginae','',sweep(P,Fn,Fb,np.linspace(0.0085,0.011,10),np.linspace(0.006,0.008,10)))
# uretra femenina
bn=BL[np.argmin(BL[:,1])]+np.array([0,0.002,0]);P=[uo+(bn-uo)*s+np.array([0,0,0.004])*np.sin(np.pi*s) for s in np.linspace(0,1,14)];Fn,Fb=frames(P)
add('gUreth','reproductor_f','Female urethra','Uretra femenina','Urethra feminina','',sweep(P,Fn,Fb,np.full(14,0.003),np.full(14,0.003)))
# cuerpo y pilares del clítoris a lo largo de las ramas isquiopubianas
H=np.concatenate([Hs['R'],Hs['L']]);sym=H[np.abs(H[:,0])<0.02];sb=sym[np.argmin(sym[:,1])];junc=np.array([0,sb[1]-0.008,sb[2]+0.002])
P=[gl+(junc-gl)*s+Nv*0.0*s for s in np.linspace(0,1,12)];Fn,Fb=frames(P)
add('gBody','reproductor_f','Body of clitoris','Cuerpo del clítoris','Corpus clitoridis','',sweep(P,Fn,Fb,np.linspace(0.0032,0.0045,12),np.linspace(0.003,0.004,12)))
crura={}
for side,sg in (('derecho',-1),('izquierdo',1)):
    Hb=Hs['R' if sg<0 else 'L'];tub=Hb[np.argmin(Hb[:,1])]
    path=[];a=junc;b=np.array([tub[0]-sg*0.006,tub[1]+0.004,tub[2]+0.012])
    for s in np.linspace(0,1,14):
        q=a+(b-a)*s;d=np.linalg.norm(Hb-q,axis=1);near=Hb[np.argsort(d)[:30]].mean(0)
        dirv=q-near;dirv/=np.linalg.norm(dirv)+1e-9;path.append(near+dirv*0.006 if s>0.1 else q)
    path=np.array(path)
    for _ in range(10):path[1:-1]=0.5*path[1:-1]+0.25*(path[:-2]+path[2:])
    Fn,Fb=frames(path);r=0.0045*np.sin(np.linspace(0.25,1,14)*np.pi*0.5)**0.5*np.linspace(1,0.45,14)+0.0008
    crura[side]=(path,Fn,Fb,r)
    add('gCrus'+side[0],'reproductor_f','Crus of clitoris','Pilar del clítoris','Crus clitoridis',side,sweep(path,Fn,Fb,r,r))
    # bulbo del vestíbulo
    bc=pt(0.52,sg*0.0105,-0.010);ax=np.c_[at(0.52,Tg)*0.0175,X*0.0058,at(0.52,N)*0.0072]
    add('gBulb'+side[0],'reproductor_f','Bulb of vestibule','Bulbo del vestíbulo','Bulbus vestibuli',side,ellipsoid(bc,ax))
    # glándula vestibular mayor (Bartholin)
    add('gBart'+side[0],'reproductor_f','Greater vestibular gland','Glándula vestibular mayor (de Bartholin)','Glandula vestibularis major',side,ellipsoid(pt(0.82,sg*0.0085,-0.012),np.c_[at(0.82,Tg)*0.0055,X*0.0035,at(0.82,N)*0.0035]))
    # músculos
    add('gIsc'+side[0],'muscular','Ischiocavernosus muscle','Músculo isquiocavernoso','Musculus ischiocavernosus',side,sweep(path[3:],Fn[3:],Fb[3:],r[3:]+0.0018,r[3:]+0.0018))
    add('gBsp'+side[0],'muscular','Bulbospongiosus muscle','Músculo bulboesponjoso','Musculus bulbospongiosus',side,ellipsoid(bc+X*sg*0.001+at(0.52,N)*0.0006,np.c_[at(0.52,Tg)*0.022,X*0.0075,at(0.52,N)*0.0088]))
    pb=pt(1.02,0,-0.010);tq=np.array([tub[0]-sg*0.004,tub[1]+0.006,tub[2]+0.004]);P=[tq+(pb-tq)*s for s in np.linspace(0,1,10)];Fn2,Fb2=frames(P)
    add('gSTP'+side[0],'muscular','Superficial transverse perineal muscle','Músculo transverso superficial del periné','Musculus transversus perinei superficialis',side,sweep(P,Fn2,Fb2,np.full(10,0.0028),np.full(10,0.0022)))
add('gPB','muscular','Perineal body','Cuerpo perineal (centro tendinoso del periné)','Corpus perineale','',ellipsoid(pt(1.03,0,-0.011),np.eye(3)*np.array([0.007,0.006,0.007])),ten=1)
pickle.dump(out,open('../work/vulva.pkl','wb'))
for o in out:print(o[0],o[1],o[3],len(o[6]),len(o[7]))
