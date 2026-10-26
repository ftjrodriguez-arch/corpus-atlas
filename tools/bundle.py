import json,re,os
W='../work/'
cat=json.load(open(W+'catalog.json'))
db={}
for i in range(4): db.update(json.load(open(W+f'db_mus_{i}.json')))
import glob as _g
for f in sorted(_g.glob(W+'db_test_*.json')):
    for k,v in json.load(open(f)).items():
        if k in db: db[k].update({kk:vv for kk,vv in v.items() if vv})
lig={}
for i in range(2): lig.update(json.load(open(W+f'db_lig_{i}.json')))
bone=json.load(open(W+'db_bone.json')) if os.path.exists(W+'db_bone.json') else {}
import glob
rest={}
for f in sorted(glob.glob(W+'db_rest_b*.json')):
    try: rest.update(json.load(open(f)))
    except Exception as e: print('bad',f,e)
print('rest entries',len(rest))
ORD={'first':('primer','primera',1),'second':('segundo','segunda',2),'third':('tercer','tercera',3),'fourth':('cuarto','cuarta',4),'fifth':('quinto','quinta',5),'sixth':('sexto','sexta',6),'seventh':('séptimo','séptima',7),'eighth':('octavo','octava',8),'ninth':('noveno','novena',9),'tenth':('décimo','décima',10),'eleventh':('undécimo','undécima',11),'twelfth':('duodécimo','duodécima',12)}
DED={1:'primer dedo',2:'segundo dedo',3:'tercer dedo',4:'cuarto dedo',5:'quinto dedo'}
TEETH={'medial incisor':'Incisivo central','lateral incisor':'Incisivo lateral','canine':'Canino','first premolar':'Primer premolar','second premolar':'Segundo premolar','first molar tooth':'Primer molar','second molar tooth':'Segundo molar'}
def es_fallback(en):
    m=re.match(r'Costal cartilage of (\w+) rib',en)
    if m: return f'Cartílago costal de la {ORD[m.group(1).lower()][2]}.ª costilla'
    m=re.match(r'(\w+) rib$',en)
    if m and m.group(1).lower() in ORD: return f'{ORD[m.group(1).lower()][2]}.ª costilla'
    m=re.match(r'(Distal|Middle|Proximal) phalanx of (\w+) finger of (hand|foot)',en)
    if m:
        t={'Distal':'distal','Middle':'media','Proximal':'proximal'}[m.group(1)]; n=ORD[m.group(2).lower()][2]
        return f'Falange {t} del {DED[n]} de {"la mano" if m.group(3)=="hand" else "el pie"}'.replace('de el','del')
    m=re.match(r'(\w+) (metacarpal|metatarsal) bone',en)
    if m: return f'{ORD[m.group(1).lower()][0].capitalize()} {"metacarpiano" if m.group(2)=="metacarpal" else "metatarsiano"}'
    m=re.match(r'(Upper|Lower) (.+)$',en)
    if m and m.group(2) in TEETH: return f'{TEETH[m.group(2)]} {"superior" if m.group(1)=="Upper" else "inferior"}'
    m=re.match(r'Vertebra ([CTL]\d+)',en)
    if m: return f'Vértebra {m.group(1)}'
    return None
def fam(n):
    n=re.sub(r'^(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|Twelfth) ','',n)
    n=re.sub(r' of (first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) (rib|finger)',r' of \2',n)
    n=re.sub(r'Vertebra [CTL]\d+','Vertebra',n); return n
out=[]; miss=0
for c in cat:
    en=c['en']; es=None; la=c['la']
    if en in db: es=db[en].get('es') or es; la=db[en].get('la') or la
    elif en in lig: es=lig[en].get('es'); la=lig[en].get('la') or la
    es=es or c['es'] or es_fallback(en)
    if c['sys']=='oseo' and not es and fam(en) in bone: es=bone[fam(en)]['es']
    if en in rest:
        es=es or rest[en].get('es'); la=la or rest[en].get('la')
    if not es: es=en; miss+=1
    out.append([c['id'],en,es,la or '',c['sys'],c['side'],c['ins']])
print('no spanish:',miss,'of',len(out))
os.makedirs(W+'pub/data',exist_ok=True)
json.dump(out,open(W+'pub/data/catalog.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump({'mus':db,'lig':lig,'bone':bone,'rest':rest},open(W+'pub/data/info.json','w'),ensure_ascii=False,separators=(',',':'))
os.system(f'cp {W}rig.json {W}pub/data/rig.json; mkdir -p {W}pub/glb; cp {W}glb/*.glb {W}pub/glb/; du -sh {W}pub/*; ls -la {W}pub/data')
