"""Pasa a la capa de músculos las aponeurosis y retináculos que un atlas muestra junto a la musculatura
(cintilla iliotibial, fascia toracolumbar, retináculos, aponeurosis palmar y plantar, galea)."""
import json,shutil,os,re
from binio import read_bin
from repack import write_bin
from split_rectum import enc
RX=re.compile(r'^(Iliotibial tract|Posterior layer of thoracolumbar fascia|Extensor retinaculum of wrist|Flexor retinaculum of wrist|Palmar aponeurosis|(Lateral|Medial) patellar retinaculum|(Superior|Inferior) extensor retinaculum of ankle|(Superior|Inferior) fibular retinaculum|Plantar aponeurosis|Flexor retinaculum of ankle|Epicranial aponeurosis)$')
cp='../corpus/data/catalog.json';cat=json.load(open(cp))
ids={r[0] for r in cat if r[4]=='fascia' and RX.match(r[1])}
print(len(ids),sorted({r[1] for r in cat if r[0] in ids}))
def ten(C):C=C.copy();C[:,1]=255;return C
def move(fsrc,ftxt,msrc,mtxt):
    for s in (fsrc,msrc):
        if not os.path.exists(s+'.pre_promote'):shutil.copy(s,s+'.pre_promote')
    F=read_bin(fsrc);M=read_bin(msrc);mv=[(a,V,T,ten(C)) for a,V,T,C in F if a in ids]
    F=[x for x in F if x[0] not in ids];M=[x for x in M if x[0] not in ids]+mv
    write_bin(fsrc,F);write_bin(msrc,M);enc(fsrc,ftxt,13);enc(msrc,mtxt,13);print(fsrc,'moved',len(mv))
move('../hr/lr_in2/fascia.bin','../corpus/m2/fascia.txt','../hr/lr_in2/muscular.bin','../corpus/m2/muscular.txt')
move('../hr/f_ovr/fascia__f.bin','../corpus/m2/fascia__f.txt','../hr/f_ovr/muscular__f.bin','../corpus/m2/muscular__f.txt')
for r in cat:
    if r[0] in ids:r[4]='muscular'
json.dump(cat,open(cp,'w'),ensure_ascii=False,separators=(',',':'))
