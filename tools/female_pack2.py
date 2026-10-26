import pickle,json,os,numpy as np
from repack import write_bin
ovr=pickle.load(open('../work/f_ovr.pkl','rb'));fl=pickle.load(open('../work/f_layers_warped.pkl','rb'));vul=pickle.load(open('../work/vulva.pkl','rb'))
os.makedirs('../hr/f_ovr',exist_ok=True)
newL={'piel_f':[],'reproductor_f':[],'muscular':[]}
for nid,layer,en,es,la,side,V,T,ten in vul:
    C=np.zeros((len(V),3));C[:,0]=225;C[:,1]=255 if ten else 0
    newL[layer].append((nid,V,T,C))
for s in ('piel_f','mama','reproductor_f'):
    items=fl[s]+newL.get(s,[]);write_bin(f'../hr/f_ovr/{s}.bin',items);print(s,len(items))
sysl=[]
for s,items in ovr.items():
    if s in('piel','reproductor'):continue
    items=items+(newL['muscular'] if s=='muscular' else []);write_bin(f'../hr/f_ovr/{s}__f.bin',items);sysl.append(s);print(s+'__f',len(items))
fem=json.load(open('../corpus/data/fem.json'))
have={r[0] for r in fem['full']}
for nid,layer,en,es,la,side,V,T,ten in vul:
    if nid not in have:fem['full'].append([nid,en,es,la,layer,side,''])
fem['fonly']=[x[0] for x in vul if x[1]=='muscular'];fem['ovr']=sorted(sysl)
json.dump(fem,open('../corpus/data/fem.json','w'),ensure_ascii=False,separators=(',',':'))
print(fem['ovr'])
