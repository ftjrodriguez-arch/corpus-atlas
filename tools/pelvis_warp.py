import pickle,numpy as np
d=pickle.load(open('../work/pelvis_lm.pkl','rb'));LZ,LH=d['LZ'],d['LHa']
MIR=np.array([-1,1,1])
use=['asis','crest_lat','crest_top','psis','spine','tuber','sym_bot']
src=[];dst=[]
for k in use:
    dR=LH[k+'_R']-LZ[k+'_R'];dL=LH[k+'_L']-LZ[k+'_L']
    dsym=(dR+dL*MIR)/2               # desplazamiento medio, expresado para el lado derecho
    dsym=np.clip(dsym,-0.02,0.02)
    for s,dd in (('R',dsym),('L',dsym*MIR)):
        src.append(LZ[k+'_'+s]);dst.append(LZ[k+'_'+s]+dd)
# sínfisis en la línea media: arco subpúbico más abierto (los ramos inferiores se separan, la sínfisis apenas cambia)
for s,sg in (('R',-1),('L',1)):
    p=LZ['ramus_'+s];src.append(p);dst.append(p+np.array([sg*0.008,0.004,0.0]))
# anclas fijas: acetábulos, promontorio, alas del sacro, columna lumbar y fémures
fixed=[LZ['ac_R'],LZ['ac_L'],LZ['promontory'],LZ['ala_R'],LZ['ala_L'],LZ['sym_top_R'],LZ['sym_top_L'],
       np.array([0,1.10,-0.03]),np.array([0,1.20,-0.03]),np.array([-0.10,0.62,0.0]),np.array([0.10,0.62,0.0]),np.array([0,0.70,-0.06]),np.array([0,0.75,0.08])]
for p in fixed:src.append(p);dst.append(p)
src=np.array(src);dst=np.array(dst)
# TPS 3D (núcleo r)
n=len(src);K=np.linalg.norm(src[:,None]-src[None],axis=2);P=np.c_[np.ones(n),src]
A=np.zeros((n+4,n+4));A[:n,:n]=K;A[:n,n:]=P;A[n:,:n]=P.T
Y=np.zeros((n+4,3));Y[:n]=dst-src
W=np.linalg.solve(A+np.eye(n+4)*np.r_[np.full(n,1e-6),np.zeros(4)],Y)
lo=np.array([-0.16,0.76,-0.12]);hi=np.array([0.16,1.04,0.10])
def warp(V):
    V=np.asarray(V,float);out=V.copy()
    # peso: 1 dentro de la caja pélvica, cae a 0 a 9 cm fuera
    dx=np.maximum(np.maximum(lo-V,V-hi),0);dist=np.linalg.norm(dx,axis=1);w=np.clip(1-dist/0.09,0,1);w=w*w*(3-2*w)
    m=w>0
    if m.any():
        X=V[m];K2=np.linalg.norm(X[:,None]-src[None],axis=2);D=K2@W[:n]+np.c_[np.ones(len(X)),X]@W[n:]
        out[m]=X+D*w[m,None]
    return out
if __name__=='__main__':
    for a,b in zip(src,dst):print(np.round(a*1000).astype(int),np.round((b-a)*1000).astype(int))
    print('check fixed:',np.abs(warp(np.array(fixed))-np.array(fixed)).max())
    pickle.dump({'src':src,'W':W,'lo':lo,'hi':hi},open('../work/pelvis_tps.pkl','wb'))
