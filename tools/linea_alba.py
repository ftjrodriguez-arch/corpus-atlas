"""Línea alba (rafe medio entre los rectos, con anillo umbilical) e intersecciones tendinosas del recto del abdomen,
construidas sobre la superficie de los músculos rectos del atlas."""
import numpy as np,pickle
from scipy.spatial import cKDTree
from binio import read_bin
R={nid:V for nid,V,T,C in read_bin('../hr/in2/tronco_loc.bin') if nid in('n1646','n1647')}
if len(R)<2:R={nid:V for nid,V,T,C in read_bin('../hr/lr_in2/muscular.bin') if nid in('n1646','n1647')}
ALL=np.concatenate(list(R.values()));TR=cKDTree(ALL[:,:2])
Y_UMB=1.018
def zfront(x,y,r=0.004):
    idx=TR.query_ball_point([x,y],r)
    if not idx:idx=TR.query([x,y],k=8)[1]
    return ALL[idx][:,2].max()
def medial(y):
    out=[]
    for V in R.values():
        m=abs(V[:,1]-y)<0.004
        if m.sum()<3:return None
        out.append(np.abs(V[m][:,0]).min())
    return np.mean(out)
def slab(G,th):
    ny,nx,_=G.shape;du=np.gradient(G,axis=1);dv=np.gradient(G,axis=0);N=np.cross(du,dv);N/=np.linalg.norm(N,axis=2,keepdims=True)+1e-12
    N*=np.sign(N[...,2:3]+1e-9)
    top=G+N*th*0.5;bot=G-N*th*0.5;V=np.concatenate([top.reshape(-1,3),bot.reshape(-1,3)]);o=ny*nx;T=[];I=lambda j,i:j*nx+i
    for j in range(ny-1):
        for i in range(nx-1):
            a,b,c,d=I(j,i),I(j,i+1),I(j+1,i+1),I(j+1,i);T+=[[a,b,c],[a,c,d],[o+a,o+c,o+b],[o+a,o+d,o+c]]
    ring=[I(0,i) for i in range(nx)]+[I(j,nx-1) for j in range(1,ny)]+[I(ny-1,i) for i in range(nx-2,-1,-1)]+[I(j,0) for j in range(ny-2,0,-1)]
    for k in range(len(ring)):
        a,b=ring[k],ring[(k+1)%len(ring)];T+=[[a,o+b,o+a],[a,b,o+b]]
    return V,np.array(T)
def torus(c,R_,r,n=28,m=8):
    V=[];T=[]
    for i in range(n):
        u=2*np.pi*i/n
        for j in range(m):
            v=2*np.pi*j/m;V.append(c+np.array([(R_+r*np.cos(v))*np.cos(u),(R_+r*np.cos(v))*np.sin(u),r*np.sin(v)]))
    for i in range(n):
        for j in range(m):
            a=i*m+j;b=((i+1)%n)*m+j;cc=((i+1)%n)*m+(j+1)%m;d=i*m+(j+1)%m;T+=[[a,b,cc],[a,cc,d]]
    return np.array(V),np.array(T)
out={}
# ── línea alba ──
ys=np.linspace(0.852,1.245,90);rows=[]
W=np.array([medial(y) or 0.004 for y in ys]);W=np.minimum(W,0.0095)
W=np.convolve(np.pad(W,4,mode='edge'),np.ones(9)/9,mode='valid')
for y,w in zip(ys,W):
    w=max(w+0.0022,0.0042 if y<Y_UMB-0.01 else 0.008)
    if y>1.215:w*=1-0.55*(y-1.215)/0.03
    xs=np.linspace(-w,w,7);zc=max(zfront(-w,y),zfront(w,y))
    rows.append([[x,y,zc-0.0004-0.0015*(1-(x/w)**2)+0.0006] for x in xs])
G=np.array(rows);V,T=slab(G,0.0016)
# anillo umbilical
zu=G[np.argmin(abs(ys-Y_UMB)),3,2]+0.0004;Vt,Tt=torus(np.array([0.0,Y_UMB,zu]),0.0042,0.0011)
out['xLA']=(np.concatenate([V,Vt]),np.concatenate([T,Tt+len(V)]))
# ── intersecciones tendinosas (3 por lado: xifoidea, intermedia, umbilical) ──
for side,nid in (('d','n1646'),('i','n1647')):
    Vr=R[nid];sg=-1 if Vr[:,0].mean()<0 else 1
    for k,y0 in enumerate([1.155,1.086,1.029]):
        m=abs(Vr[:,1]-y0)<0.004;xa=np.abs(Vr[m][:,0]);x0,x1=xa.min()-0.001,xa.max()+0.0005
        xs=np.linspace(x0,x1,22);rows=[]
        for dy in np.linspace(-0.0032,0.0032,4):
            row=[]
            for x in xs:
                yy=y0+dy+0.0025*np.sin((x-x0)/(x1-x0)*np.pi*2.2)+0.003*((x-x0)/(x1-x0))*0.5
                row.append([sg*x,yy,zfront(sg*x,yy)+0.0005])
            rows.append(row)
        G=np.array(rows)
        if sg<0:G=G[:,::-1]
        out[f'xTI{side}{k}']=slab(G,0.0012)
pickle.dump(out,open('../work/linea_alba.pkl','wb'))
for k,(V,T) in out.items():print(k,len(V),len(T),V.min(0).round(3),V.max(0).round(3))
