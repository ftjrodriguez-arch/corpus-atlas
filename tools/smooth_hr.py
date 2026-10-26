import os,shutil,json,numpy as np
from binio import read_bin
from repack import write_bin
from split_rectum import enc
from taubin import taubin
cat={r[0]:r for r in json.load(open('../corpus/data/catalog.json'))}
def go(src,txt,it,q,only_mus=False):
    bak=src+'.pre_smooth'
    if not os.path.exists(bak):shutil.copy(src,bak)
    out=[]
    for nid,V,T,C in read_bin(bak):
        ok=len(T)>=60 and not nid.startswith(('g','x'))
        if only_mus:ok=ok and nid in cat and cat[nid][4]=='muscular'
        if ok:V=taubin(V,T,it).astype(np.float32)
        out.append((nid,V,T,C))
    write_bin(src,out);enc(src,txt,q);print(txt,flush=True)
go('../hr/lr_in2/muscular.bin','../corpus/m2/muscular.txt',12,13)
go('../hr/f_ovr/muscular__f.bin','../corpus/m2/muscular__f.txt',12,13)
for r in ['superior','inferior','tronco','cabeza']:
    go(f'../hr/in2/{r}_loc.bin',f'../corpus/hr/{r}_loc.txt',10,14,only_mus=True)
