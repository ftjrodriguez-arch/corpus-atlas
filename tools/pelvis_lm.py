"""Puntos de referencia de la pelvis ósea (automáticos) para el atlas (hombre) y el Visible Human Female."""
import numpy as np
def sphere_fit(P):
    A=np.c_[2*P,np.ones(len(P))];b=(P**2).sum(1);x=np.linalg.lstsq(A,b,rcond=None)[0];c=x[:3];return c,np.sqrt(x[3]+c@c)
def femhead(F):
    top=F[F[:,1]>F[:,1].max()-0.035]
    # la cabeza está en el lado medial de la parte alta
    med=top[np.abs(top[:,0])<np.percentile(np.abs(top[:,0]),45)]
    c,r=sphere_fit(med);return c
def hip_lm(H,ac,side):
    """H: vértices de un hueso coxal; ac: centro del acetábulo; side +1 izq (x>0), -1 der."""
    s=np.sign(ac[0]);ax=H[:,0]*s
    L={}
    up=H[H[:,1]>ac[1]+0.03];L['asis']=up[np.argmax(up[:,2])]
    L['crest_top']=H[np.argmax(H[:,1])]
    L['crest_lat']=H[np.argmax(ax)]
    L['tuber']=H[np.argmin(H[:,1])]
    band=H[(H[:,2]<ac[2]-0.015)&(H[:,1]<ac[1]-0.005)&(H[:,1]>ac[1]-0.07)];L['spine']=band[np.argmin(band[:,0]*s)]
    sym=H[ax<np.percentile(ax,3)];L['sym_top']=sym[np.argmax(sym[:,1])];L['sym_bot']=sym[np.argmin(sym[:,1])]
    yb,yt=L['tuber'][1],L['sym_bot'][1];ym=(yb+yt)/2
    ram=H[(np.abs(H[:,1]-ym)<0.006)&(H[:,2]>L['tuber'][2]-0.01)];L['ramus']=ram[np.argmin(ram[:,0]*s)] if len(ram) else L['sym_bot']
    post=H[H[:,2]<np.percentile(H[:,2],4)];L['psis']=post[np.argmax(post[:,1])]
    return L
def sacrum_lm(S):
    L={};top=S[S[:,1]>S[:,1].max()-0.02];L['promontory']=top[np.argmax(top[:,2])]
    L['apex']=S[np.argmin(S[:,1])]
    t2=S[S[:,1]>S[:,1].max()-0.05];L['ala_R']=t2[np.argmin(t2[:,0])];L['ala_L']=t2[np.argmax(t2[:,0])]
    return L
