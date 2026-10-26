import json,os,shutil,numpy as np,time
from scipy.spatial import cKDTree
from binio import read_bin
from repack import write_bin
from split_rectum import enc
from qem import simplify
hr={nid:(V,T,C) for nid,V,T,C in read_bin('../hr/in2/cabeza_nv.bin')}
src='../hr/lr_in2/nervioso_central.bin';bak=src+'.pre_qem'
if not os.path.exists(bak):shutil.copy(src,bak)
out=[];t0=time.time();n=0
for nid,V,T,C in read_bin(bak):
    if nid in hr and len(hr[nid][1])>len(T)*1.2:
        Vh,Th,Ch=hr[nid];V2,T2=simplify(Vh,Th,max(int(len(T)*1.4),300));_,j=cKDTree(Vh).query(V2);out.append((nid,V2.astype(np.float32),T2,Ch[j]));n+=1
    else:out.append((nid,V,T,C))
print('rebuilt',n,round(time.time()-t0),'s',sum(len(x[2]) for x in out))
write_bin(src,out);enc(src,'../corpus/m2/nervioso_central.txt',13)
