"""Divide la malla 'Sigmoid colon' de Z-Anatomy (que incluye recto y conducto anal) en tres estructuras."""
import numpy as np,subprocess,base64,json,shutil,os
from binio import read_bin
from repack import write_bin
Y_RECT,Y_ANAL=0.893,0.829
def sub(V,T,C,mask):
    T2=T[mask];u=np.unique(T2);r=np.full(len(V),-1);r[u]=np.arange(len(u));return V[u],r[T2],C[u]
def split(items,yr=Y_RECT,ya=Y_ANAL):
    out=[]
    for nid,V,T,C in items:
        if nid!='n3503':out.append((nid,V,T,C));continue
        cy=V[T][:,:,1].mean(1)
        for new,m in (('n3503',cy>=yr),('xRect',(cy<yr)&(cy>=ya)),('xAnal',cy<ya)):
            out.append((new,)+sub(V,T,C,m));print(new,m.sum())
    return out
def enc(binp,txt,q):
    g=binp[:-4]+'.glb';subprocess.run(['node','../hr/encode.js',binp,g,str(q)],check=True,stdout=subprocess.DEVNULL)
    open(txt,'w').write(base64.b64encode(open(g,'rb').read()).decode())
if __name__=='__main__':
    for src,q,txt,yr,ya in [('../hr/lr_in2/digestivo.bin',13,'../corpus/m2/digestivo.txt',Y_RECT,Y_ANAL),
                       ('../hr/in2/tronco_nv.bin',14,'../corpus/hr/tronco_nv.txt',Y_RECT,Y_ANAL),
                       ('../hr/f_ovr/digestivo__f.bin',13,'../corpus/m2/digestivo__f.txt',None,None)]:
        bak=src+'.orig'
        if not os.path.exists(bak):shutil.copy(src,bak)
        items=read_bin(bak)
        if yr is None:  # pelvis femenina deformada: usar los cortes trasladados por la deformación
            import pickle;from pelvis_warp import warp
            P=warp(np.array([[0,Y_RECT,-0.05],[0,Y_ANAL,-0.047]]));yr,ya=P[0,1],P[1,1];print('f cuts',yr,ya)
        write_bin(src,split(items,yr,ya));enc(src,txt,q);print('ok',txt)
