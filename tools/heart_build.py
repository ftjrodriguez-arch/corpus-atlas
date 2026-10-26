"""Completa las válvulas auriculoventriculares del atlas: valva anterior de la mitral, valva anterior de la tricúspide
(con sus cuerdas tendinosas) y el músculo papilar anterior (anterolateral) del ventrículo izquierdo."""
import numpy as np,pickle
from scipy.spatial import cKDTree
from heartlib import H,ring_of,tube

def frame(R,vent_c):
    C=R.mean(0);u,s,vt=np.linalg.svd(R-C);n=vt[2]
    if np.dot(vent_c-C,n)<0:n=-n
    return C,n
def free_arc(R,leafs,tol=0.0028):
    pts=np.concatenate([H[k][0] for k in leafs]);d,_=cKDTree(pts).query(R)
    cov=d<tol;N=len(R);best=(0,0)
    for i in range(N):
        if cov[i]:continue
        if not cov[i-1]:continue
        j=i
        while not cov[j%N] and j-i<N:j+=1
        if j-i>best[1]-best[0]:best=(i,j)
    i,j=best;return [(k%N) for k in range(i-2,j+2)]
def resample(P,n):
    d=np.r_[0,np.cumsum(np.linalg.norm(np.diff(P,axis=0),axis=1))];s=np.linspace(0,d[-1],n)
    return np.stack([np.interp(s,d,P[:,k]) for k in range(3)],1)
def leaflet(arc,C,n,hmax,ns=36,nt=14,th=0.0007,bill=0.12):
    A=resample(arc,ns);S=np.zeros((ns,nt,3))
    for i,R in enumerate(A):
        s=i/(ns-1);h=hmax*(0.3+0.7*np.sin(np.pi*s)**0.8)
        inw=C-R;inw-=n*np.dot(inw,n);inw/=np.linalg.norm(inw);d=0.78*n+0.62*inw;d/=np.linalg.norm(d)
        for j in range(nt):
            t=j/(nt-1);S[i,j]=R+t*h*d-n*bill*h*np.sin(np.pi*t)*np.sin(np.pi*s)
    # normales de la lámina y engrosado a dos caras
    du=np.gradient(S,axis=0);dv=np.gradient(S,axis=1);N=np.cross(du,dv);N/=np.linalg.norm(N,axis=2,keepdims=True)+1e-12
    top=S+N*th/2;bot=S-N*th/2;V=np.concatenate([top.reshape(-1,3),bot.reshape(-1,3)]);o=ns*nt;T=[]
    idx=lambda i,j:i*nt+j
    for i in range(ns-1):
        for j in range(nt-1):
            a,b,c,d=idx(i,j),idx(i+1,j),idx(i+1,j+1),idx(i,j+1);T+=[[a,b,c],[a,c,d],[o+a,o+c,o+b],[o+a,o+d,o+c]]
    ring=[idx(i,0) for i in range(ns)]+[idx(ns-1,j) for j in range(1,nt)]+[idx(i,nt-1) for i in range(ns-2,-1,-1)]+[idx(0,j) for j in range(nt-2,0,-1)]
    for k in range(len(ring)):
        a,b=ring[k],ring[(k+1)%len(ring)];T+=[[a,o+a,o+b],[a,o+b,b]]
    return V,np.array(T),S[:,-1]
def tip(k,C):
    V=H[k][0];return V[np.argmin(np.linalg.norm(V-C,axis=1))]
def chordae(edge,tips,nch=8,r=0.00035):
    out=[];idx=np.linspace(2,len(edge)-3,nch).astype(int)
    for i in idx:
        p=edge[i];end=edge[0] if i<len(edge)/2 else edge[-1];tp=min(tips,key=lambda q:np.linalg.norm(q-end))
        mid=(p+tp)/2;P=np.stack([p+(tp-p)*t for t in np.linspace(0,1,10)])
        out.append(tube(P,r,6))
        # bifurcación cerca de la valva: dos ramillas
        for off in (-1,1):
            j=np.clip(i+off,0,len(edge)-1);q=edge[j];m=p+(tp-p)*0.25
            out.append(tube(np.stack([m+(q-m)*t for t in np.linspace(0,1,5)]),r*0.7,5))
    return out
def merge(parts):
    Vs=[];Ts=[];o=0
    for V,T in parts:Vs.append(V);Ts.append(T+o);o+=len(V)
    return np.concatenate(Vs),np.concatenate(Ts)

out={}
# ── mitral ──
mr=ring_of('n2079',np.array([0.024,1.286,-0.004]));LVc=H['n2079'][0].mean(0)
Cm,nm=frame(mr,LVc);arc=mr[free_arc(mr,['n2065'])]
print('mitral free arc',len(arc),'of',len(mr))
# papilar anterolateral: el posteromedial girado alrededor del eje largo del VI (anillo → punta) hasta quedar bajo la otra comisura
ap=H['n2079'][0];apex=ap[np.argmax((ap-Cm)@nm)];ax=apex-Cm;ax/=np.linalg.norm(ax)
def angl(p):
    e1=np.cross(ax,[0,1,0]);e1/=np.linalg.norm(e1);e2=np.cross(ax,e1);q=p-Cm;return np.arctan2(q@e2,q@e1)
t0=tip('n2078',Cm);a1,a2=angl(arc[0]),angl(arc[-1])
near,far=(a1,a2) if abs(np.angle(np.exp(1j*(a1-angl(t0)))))<abs(np.angle(np.exp(1j*(a2-angl(t0))))) else (a2,a1)
dth=far-near
def rodr(V,th):
    q=V-Cm;return Cm+q*np.cos(th)+np.cross(ax,q)*np.sin(th)+np.outer(q@ax,ax)*(1-np.cos(th))
Vp,Tp=H['n2078'];Vr=rodr(Vp,dth)
# ajustar al muro: desplazar hacia fuera/dentro para que la base toque la pared del VI
tw=cKDTree(ap);base=Vr[np.argsort((Vr-Cm)@ax)[-40:]];d,_=tw.query(base);print('base to wall',np.median(d))
out['xLVpa']=(Vr,Tp.copy())
tips_m=[t0,Vr[np.argmin(np.linalg.norm(Vr-Cm,axis=1))]]
V,T,edge=leaflet(arc,Cm,nm,0.022)
out['xMVa']=merge([(V,T)]+chordae(edge,tips_m))
# ── tricúspide ──
tr=ring_of('n2076',np.array([-0.010,1.284,0.030]));RVc=H['n2076'][0].mean(0)
Ct,nt_=frame(tr,RVc);arc=tr[free_arc(tr,['n2063','n2064'])]
print('tric free arc',len(arc),'of',len(tr))
V,T,edge=leaflet(arc,Ct,nt_,0.02)
out['xTVa']=merge([(V,T)]+chordae(edge,[tip(k,Ct) for k in ['n2073','n2074','n2075']]))
pickle.dump(out,open('../work/heart_new.pkl','wb'))
for k,(V,T) in out.items():print(k,len(V),len(T),V.mean(0).round(3))
