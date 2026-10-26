"""Reconstruye las mallas ligeras (m2) a partir de las de alta resolución con simplificación QEM,
manteniendo el mismo presupuesto de triángulos (+15 %). Regenera también las versiones femeninas (deformación de la pelvis)."""
import os,sys,glob,shutil,json,time,numpy as np
from multiprocessing import Pool
from scipy.spatial import cKDTree
from binio import read_bin
from repack import write_bin
from split_rectum import enc
from qem import simplify
from taubin import taubin
from pelvis_warp import warp
LAYERS=['muscular','oseo','articular','fascia','arterial','venoso','nervioso_periferico','digestivo','urinario','respiratorio','bolsas','linfatico','endocrino','reproductor']
HR={}
for f in glob.glob('../hr/in2/*.bin'):
    for nid,V,T,C in read_bin(f):
        if nid not in HR or len(T)>len(HR[nid][1]):HR[nid]=(V,T,C)
cat={r[0]:r for r in json.load(open('../corpus/data/catalog.json'))}
def job(a):
    nid,ntri,tenG,smooth=a;Vh,Th,Ch=HR[nid]
    try:V2,T2=simplify(Vh,Th,max(int(ntri*1.15),120))
    except Exception as e:return nid,None
    if smooth:V2=taubin(V2,T2,2)
    _,j=cKDTree(Vh).query(V2);C2=Ch[j].copy()
    if tenG:C2[:,1]=255
    return nid,(V2.astype(np.float32),T2,C2)
if __name__=='__main__':
    t0=time.time();NEW={}
    for s in LAYERS:
        src=f'../hr/lr_in2/{s}.bin'
        if not os.path.exists(src):continue
        bak=src+'.pre_qem'
        if not os.path.exists(bak):shutil.copy(src,bak)
        items=read_bin(bak);jobs=[]
        for nid,V,T,C in items:
            if nid in HR and not nid.startswith(('g','x')) and len(HR[nid][1])>len(T)*1.25:
                jobs.append((nid,len(T),C[:,1].mean()>200,s!='muscular'))
        with Pool(2) as P:res=dict(P.map(job,jobs,chunksize=4))
        out=[]
        for nid,V,T,C in items:
            r=res.get(nid)
            if r is not None:out.append((nid,)+r);NEW[nid]=r
            else:out.append((nid,V,T,C))
        write_bin(src,out);enc(src,f'../corpus/m2/{s}.txt',13)
        print(s,'rebuilt',sum(1 for v in res.values() if v is not None),'of',len(items),round(time.time()-t0),'s',flush=True)
        fo=f'../hr/f_ovr/{s}__f.bin'
        if os.path.exists(fo) and s!='oseo':
            fb=fo+'.pre_qem'
            if not os.path.exists(fb):shutil.copy(fo,fb)
            fo_items=[];k=0
            for nid,V,T,C in read_bin(fb):
                if nid in NEW:V2,T2,C2=NEW[nid];fo_items.append((nid,warp(V2.astype(float)).astype(np.float32),T2,C2));k+=1
                else:fo_items.append((nid,V,T,C))
            write_bin(fo,fo_items);enc(fo,f'../corpus/m2/{s}__f.txt',13);print(' ',s,'__f',k,flush=True)
    print('done',round(time.time()-t0),'s')
