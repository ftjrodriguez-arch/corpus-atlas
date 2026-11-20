#!/usr/bin/env node
/* Corpus Atlas → Blender: prepara una simulación de músculo.
   Uso: node tools/unreal/blender/posar.js <id del músculo> <rom> <nº mov> <R|L> <grados> [paso=10] [salida]
   Ej.: node tools/unreal/blender/posar.js n1610 hombro 2 R 150
   Escribe en unreal/CorpusAtlas/Saved/sim/<id>_<rom><mov><lado>/ :
     info.json            pasos (grados), nº de vértices, piezas del colisionador
     musculo_idx.u32      triángulos del músculo          musculo_w.f32   fracción de fibra (0 origen … 1 inserción)
     musculo_<k>.f32      el músculo como lo deja el material de Unreal en el paso k (guía y posición de los anclajes)
     colision_idx.u32     triángulos de huesos y músculos profundos fundidos en una malla
     colision_<k>.f32     esa malla en el paso k
   Todo en glTF (metros, Y arriba), como los GLB de Importar/. */
'use strict';
const fs = require('fs'), path = require('path');
const PO = require('../postura.js');
const [id, rom, mi, lado, grados, pasoArg, salArg] = process.argv.slice(2);
const paso = +pasoArg || 10, LD = lado === 'R' ? 'derecho' : 'izquierdo';
const dir = salArg || path.join(PO.IMP, '..', 'Saved', 'sim', `${id.includes(',') ? 'grupo' : id}_${rom}${mi}${lado}`);
fs.mkdirSync(dir, { recursive: true });
/* varios músculos separados por comas se funden en una malla (para verlos juntos; la simulación es de uno) */
const ids = id.split(','), partes = ids.map(i => PO.pieza('hombre/muscular', i)); if (partes.some(p => !p)) { console.error('no está ' + id); process.exit(1); }
const mus = partes[0];

/* colisionador: huesos del tórax y de la cintura escapular del lado, y los músculos profundos sobre los que resbala */
const HUESO = /\brib\b|^Costal cartilage|sternum|Xiphoid|^Vertebra [TL]\d+|^Scapula$|^Humerus$|^Clavicle$|^Hip bone$|^Sacrum$/i;
const PROFUNDO = /^(Serratus anterior muscle|External intercostal muscles|Internal intercostal muscles|Teres major muscle|Teres minor muscle|Infraspinatus muscle|Subscapularis muscle|Iliocostalis thoracis muscle|Longissimus thoracis muscle|Serratus posterior inferior muscle|External abdominal oblique muscle)$/;
const piezas = [];
for (const [capa, re] of [['hombre/oseo', HUESO], ['hombre/muscular', PROFUNDO]]) {
  const C = PO.capa(capa);
  for (const nd of C.g.nodes) { if (nd.mesh === undefined || ids.includes(nd.name)) continue; const ex = nd.extras || {};
    if (!re.test(ex.en || '')) continue; if (ex.lado && ex.lado !== LD) continue; piezas.push(PO.pieza(capa, nd.name)); }
}
let nvc = 0; const idx = [];
for (const p of piezas) { for (let i = 0; i < p.I.length; i++) idx.push(p.I[i] + nvc); nvc += p.nv; }
fs.writeFileSync(path.join(dir, 'colision_idx.u32'), Buffer.from(Uint32Array.from(idx).buffer));
const nvm = partes.reduce((a, p) => a + p.nv, 0), im = []; { let o = 0; for (const p of partes) { for (let i = 0; i < p.I.length; i++) im.push(p.I[i] + o); o += p.nv; } }
fs.writeFileSync(path.join(dir, 'musculo_idx.u32'), Buffer.from(Uint32Array.from(im).buffer));
const w = new Float32Array(nvm); { let o = 0; for (const p of partes) { for (let i = 0; i < p.nv; i++) w[o + i] = p.U[0][i * 2]; o += p.nv; } }
fs.writeFileSync(path.join(dir, 'musculo_w.f32'), Buffer.from(w.buffer));

const pasos = []; for (let g = 0; g < +grados; g += paso) pasos.push(g); pasos.push(+grados);
pasos.forEach((g, k) => {
  const J = PO.articulaciones(rom, mi, lado, g);
  { const a = new Float32Array(nvm * 3); let o = 0; for (const p of partes) { a.set(PO.deformar(p, J), o); o += p.nv * 3; } fs.writeFileSync(path.join(dir, `musculo_${k}.f32`), Buffer.from(a.buffer)); }
  const col = new Float32Array(nvc * 3); let o = 0; for (const p of piezas) { col.set(PO.deformar(p, J), o); o += p.nv * 3; }
  fs.writeFileSync(path.join(dir, `colision_${k}.f32`), Buffer.from(col.buffer));
});
fs.writeFileSync(path.join(dir, 'info.json'), JSON.stringify({ id, en: mus.en, rom, mov: +mi, lado, pasos, nv: mus.nv, nvc, colision: piezas.map(p => p.id + ' ' + p.en) }, null, 1));
console.log('%s (%s): %d pasos, músculo %d vértices, colisión %d piezas y %d vértices → %s', id, mus.en, pasos.length, mus.nv, piezas.length, nvc, dir);
