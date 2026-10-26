import pickle,json,glob,os,re,numpy as np
from pelvis_warp import warp
from binio import read_bin
from repack import write_bin
os.makedirs('../hr/f_ovr',exist_ok=True)
# 1) versiones femeninas (deformadas) de las mallas ligeras del atlas cerca de la pelvis
ovr={}
for f in sorted(glob.glob('../hr/lr_in2/*.bin')):
    s=os.path.basename(f)[:-4];items=[]
    for nid,V,T,C in read_bin(f):
        W=warp(V)
        if np.abs(W-V).max()>0.0005:items.append((nid,W.astype(np.float32),T,C))
    if items:ovr[s]=items;print(s,len(items))
pickle.dump(ovr,open('../work/f_ovr.pkl','wb'),protocol=4)
# 2) capas femeninas propias, también deformadas
fl={}
for s in ('piel_f','mama','reproductor_f'):
    fl[s]=[(nid,warp(V).astype(np.float32),T,C) for nid,V,T,C in read_bin(f'../hr/w_in/{s}.bin')]
pickle.dump(fl,open('../work/f_layers_warped.pkl','wb'),protocol=4)
print('ok')
