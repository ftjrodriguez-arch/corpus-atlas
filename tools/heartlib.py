import pickle,numpy as np
from seams import bedges
from collections import defaultdict
H=pickle.load(open('../work/heart_hr.pkl','rb'))
def loops(T):
  E=bedges(T);adj=defaultdict(list)
  for a,b in E:adj[a].append(b);adj[b].append(a)
  seen=set();out=[]
  for s in adj:
    if s in seen:continue
    L=[s];seen.add(s);cur=s
    while True:
      nx=[n for n in adj[cur] if n not in seen]
      if not nx:break
      cur=nx[0];seen.add(cur);L.append(cur)
    out.append(L)
  return out
def ring_of(k,center,tol=0.005):
  V,T=H[k]
  for l in loops(T):
    if np.linalg.norm(V[l].mean(0)-center)<tol:return V[l]
def tube(P,r=0.0008,seg=8,closed=False):
  P=np.asarray(P);n=len(P);Vs=[];Ts=[]
  for i in range(n):
    t=P[min(i+1,n-1)]-P[max(i-1,0)];t/=np.linalg.norm(t)+1e-12
    a=np.cross(t,[0,0,1.0]);
    if np.linalg.norm(a)<1e-3:a=np.cross(t,[1.0,0,0])
    a/=np.linalg.norm(a);b=np.cross(t,a);rr=r[i] if hasattr(r,'__len__') else r
    for j in range(seg):
      ang=2*np.pi*j/seg;Vs.append(P[i]+rr*(np.cos(ang)*a+np.sin(ang)*b))
  m=n if closed else n-1
  for i in range(m):
    i2=(i+1)%n
    for j in range(seg):
      j2=(j+1)%seg;a,b,c,d=i*seg+j,i*seg+j2,i2*seg+j2,i2*seg+j;Ts+=[[a,b,c],[a,c,d]]
  V=np.array(Vs);T=np.array(Ts)
  if not closed:
    V=np.vstack([V,P[0],P[-1]]);s0,s1=len(V)-2,len(V)-1
    for j in range(seg):
      j2=(j+1)%seg;T=np.vstack([T,[s0,j2,j],[s1,(n-1)*seg+j,(n-1)*seg+j2]])
  return V,T
def sphere(c,r,n=10):
  Vs=[];Ts=[]
  for i in range(n+1):
    th=np.pi*i/n
    for j in range(2*n):
      ph=np.pi*j/n;Vs.append(c+r*np.array([np.sin(th)*np.cos(ph),np.cos(th),np.sin(th)*np.sin(ph)]))
  for i in range(n):
    for j in range(2*n):
      j2=(j+1)%(2*n);a,b,cc,d=i*2*n+j,i*2*n+j2,(i+1)*2*n+j2,(i+1)*2*n+j;Ts+=[[a,b,cc],[a,cc,d]]
  return np.array(Vs),np.array(Ts)
