import re
TA={}
for line in open('../zanat/TA2.csv',encoding='utf-8-sig'):
    line=line.strip()
    if line.startswith('"') and line.endswith('"'): line=line[1:-1]
    r=[x.replace('""','"') for x in line.split(';')]
    if len(r)>=5 and r[0].isdigit():
        TA.setdefault(r[1].strip().lower(),r)
def base(n):
    n=re.sub(r'\.(o|e)\d*[lr]?$','',n); n=re.sub(r'\.[lrgji]$','',n)
    n=n.replace('*','').strip()
    if n.startswith('(') and n.endswith(')'): n=n[1:-1]
    if n.startswith('[') and n.endswith(']'): n=n[1:-1]
    return n.strip()
def side(n):
    m=re.search(r'\.(?:[oe]\d*)?([lr])$',n)
    return {'l':'izquierdo','r':'derecho'}.get(m.group(1)) if m else None
def kind_ins(n):
    m=re.search(r'\.([oe])\d*[lr]?$',n); return {'o':'origen','e':'inserción'}.get(m.group(1)) if m else None
def ta(n):
    b=base(n).lower()
    for c in [b,b.replace(' muscle',''),b+' muscle',b.replace(' muscles',' muscle'),re.sub(r' \(.*\)$','',b),b.replace('fibular','peroneal')]:
        if c in TA: return TA[c]
    return None
