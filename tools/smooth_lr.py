"""Suaviza (Taubin, sin encoger) las mallas ligeras que la reducción por agrupamiento dejó arrugadas."""
import os,shutil,numpy as np
from binio import read_bin
from repack import write_bin
from split_rectum import enc
from taubin import taubin
SYSL=['muscular','oseo','articular','fascia','arterial','venoso','nervioso_periferico','digestivo','urinario','respiratorio','bolsas']
def go(src,txt,it):
    bak=src+'.pre_smooth'
    if not os.path.exists(bak):shutil.copy(src,bak)
    out=[]
    for nid,V,T,C in read_bin(bak):
        if len(T)>=60 and not nid.startswith(('g','x')):V=taubin(V,T,it).astype(np.float32)
        out.append((nid,V,T,C))
    write_bin(src,out);enc(src,txt,13);print(txt,len(out),flush=True)
for s in SYSL:
    it=5 if s in('muscular','oseo','articular','fascia','bolsas') else 3
    go(f'../hr/lr_in2/{s}.bin',f'../corpus/m2/{s}.txt',it)
    f=f'../hr/f_ovr/{s}__f.bin'
    if os.path.exists(f):go(f,f'../corpus/m2/{s}__f.txt',it)
