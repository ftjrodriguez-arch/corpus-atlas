import json,os,re
ids=json.load(open('../work/vhf_ids.json'))
N=json.load(open('../work/vhf_names.json')) if os.path.exists('../work/vhf_names.json') else {}
I=json.load(open('../work/vhf_info.json')) if os.path.exists('../work/vhf_info.json') else {}
def clean(n):
    n=re.sub(r'^(VH_F_|Allen_)','',n);n=re.sub(r' \(\d+\)$','',n);n=re.sub(r'_(L|R|left|right)(_[a-z])?$','',n);n=re.sub(r'_[a-z]$','',n)
    return n.replace('_',' ').strip().capitalize()
def side(n):
    if re.search(r'_L(_[a-z])?$|_left\b|\bleft_',n): return 'izquierdo'
    if re.search(r'_R(_[a-z])?$|_right\b|\bright_',n): return 'derecho'
    return ''
cat=[]
for fid,(name,L) in ids.items():
    e=N.get(name,{})
    cat.append([fid,e.get('en') or clean(name),e.get('es') or clean(name),e.get('la') or '',L,e.get('side',side(name)) if e else side(name),''])
os.makedirs('../corpus/data',exist_ok=True)
json.dump({'cat':cat,'info':I},open('../corpus/data/fem.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(cat),'with es',sum(1 for r in cat if r[2]!=r[1]),'info',len(I))
