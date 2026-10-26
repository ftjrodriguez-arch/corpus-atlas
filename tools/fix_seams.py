import shutil,os,sys
from binio import read_bin;from repack import write_bin;from seams import weld,project
from split_rectum import enc
for src,txt,q in [('../hr/lr_in2/piel.bin','../corpus/m2/piel.txt',13),('../hr/f_ovr/piel_f.bin','../corpus/m2/piel_f.txt',13)]:
    bak=src+'.orig'
    if not os.path.exists(bak):shutil.copy(src,bak)
    it=read_bin(bak);g=[x for x in it if not x[0].startswith('g')];v=[x for x in it if x[0].startswith('g')]
    w,m=weld(g,0.008);w,m2=project(w,0.008);w,m3=project(w,0.008);print(src,m,m2,m3)
    write_bin(src,w+v);enc(src,txt,q)
