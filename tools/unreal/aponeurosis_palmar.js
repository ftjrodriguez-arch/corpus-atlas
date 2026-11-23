// Corpus Atlas (edición Unreal) — aponeurosis palmar con forma anatómica: recorte de la malla de Z-Anatomy.
//
//   node tools/unreal/aponeurosis_palmar.js [hombre|mujer]            → recorta (siempre desde los índices guardados)
//   node tools/unreal/aponeurosis_palmar.js [hombre|mujer] --deshacer → devuelve los triángulos originales
//
// La pieza de Z-Anatomy («Palmar aponeurosis», n1784 / n1794) cubría en bloque la palma, las eminencias tenar e hipotenar
// (con una lengüeta hasta el pulgar) y cuatro tiras hasta la falange media. Según el director clínico (2026-11-23; Gray 42.ª,
// Moore 8.ª, Netter 7.ª): la aponeurosis propiamente dicha es la parte central, un triángulo con el vértice en el pliegue
// distal de la muñeca (delante del retináculo flexor, donde se abre el tendón del palmar largo) y la base en las cabezas de
// los metacarpianos 2.º–5.º; de ahí salen cuatro bandas pretendinosas que se anclan en la base de la falange proximal (nada
// distal al ~30 % de esa falange); al pulgar no va banda constante y las fascias tenar e hipotenar son finas y traslúcidas
// (aquí se quitan para que se vea el músculo, como en los atlas). Los límites salen de los huesos de la propia mano, no de
// cifras fijas. Solo cambian los índices de los triángulos: vértices, pesos y colores quedan igual. PENDIENTE DE REVISIÓN.
// Después: .\unreal\py.ps1 'ci.copiar_datos(); ci.importar_mallas(["<cuerpo>/muscular"])' -Limite 3000
// ESTADO (2026-11-23): probado y DESHECHO. La malla de Z-Anatomy es demasiado basta (749 vértices): el recorte deja bordes
// dentados, las bandas digitales casi desaparecen y la ranura transversal (hueco de la malla original) sigue. Hace falta
// modelar la pieza en Blender con las medidas de arriba; este guion queda como referencia de los límites óseos.
'use strict';
const fs = require('fs'), path = require('path');
const PO = require('./postura.js');
const CUERPO = process.argv.slice(2).find(a => !a.startsWith('--')) || 'hombre', DESHACER = process.argv.includes('--deshacer');
const F = path.join(PO.IMP, CUERPO, 'muscular.glb'), DIR = path.join(PO.IMP, 'recortes'), COPIA = path.join(DIR, `${CUERPO}_aponeurosis_palmar.json`);
const P = { banda: 0.30, margen: 0.003, ancho_vertice: 0.006, holgura_banda: 0.002 };   // fracción de la falange; metros

/* cajas de los huesos de la mano de un lado (capa ósea del hombre: la mujer comparte el esqueleto) */
function huesos(lado) {
  const C = PO.capa('hombre/oseo'), H = {};
  for (const n of C.g.nodes) { const ex = n.extras || {}; if (n.mesh === undefined || ex.lado !== lado) continue;
    const m = /^(First|Second|Third|Fourth|Fifth) metacarpal bone$/.exec(ex.en) || /^Proximal phalanx of (first|second|third|fourth|fifth) finger of hand$/.exec(ex.en);
    if (!m) continue; const b = PO.pieza('hombre/oseo', n.name), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < b.nv; i++) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], b.P[i * 3 + c]); hi[c] = Math.max(hi[c], b.P[i * 3 + c]); }
    const k = ['first', 'second', 'third', 'fourth', 'fifth'].indexOf(m[1].toLowerCase()) + 1; H[(/metacarpal/.test(ex.en) ? 'mc' : 'fp') + k] = { lo, hi }; }
  return H;
}
/* ¿el punto (x, y) está en la aponeurosis? (proyección frontal: la palma mira hacia delante) */
function dentro(H, x, y) {
  const cx = b => (b.lo[0] + b.hi[0]) / 2, lejos = b => Math.abs(b.lo[0]) > Math.abs(b.hi[0]) ? b.lo[0] : b.hi[0], cerca = b => Math.abs(b.lo[0]) < Math.abs(b.hi[0]) ? b.lo[0] : b.hi[0];
  // triángulo central: vértice sobre la base del 3.er–4.º metacarpiano; base de la cabeza del 2.º (borde radial) a la del 5.º (borde cubital)
  const A = [(cx(H.mc3) + cx(H.mc4)) / 2, Math.max(H.mc3.hi[1], H.mc4.hi[1]) + 0.004];
  const B = [lejos(H.mc2), H.mc2.lo[1] + 0.004], Cc = [cerca(H.mc5), H.mc5.lo[1] + 0.004];
  const lado = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]), s0 = Math.sign(lado(A, B, Cc)), m = P.margen;
  const d = (p, q) => lado(p, q, [x, y]) / Math.hypot(q[0] - p[0], q[1] - p[1]) * s0;   // distancia con signo al borde (> 0 dentro)
  const t = Math.max(0, Math.min(1, (A[1] - y) / (A[1] - Math.min(B[1], Cc[1]))));      // 0 en el vértice, 1 en la base
  const ensanche = P.ancho_vertice * (1 - t);                                            // el vértice tiene ancho (8–12 mm), no es un punto
  if (d(A, B) > -m - ensanche && d(B, Cc) > -m && d(Cc, A) > -m - ensanche && y <= A[1] + m) return true;
  // bandas pretendinosas 2.º–5.º: de la cabeza del metacarpiano al 30 % de la falange proximal
  for (const k of [2, 3, 4, 5]) { const f = H['fp' + k], mc = H['mc' + k], corte = f.hi[1] - P.banda * (f.hi[1] - f.lo[1]);
    if (y >= corte && y <= mc.lo[1] + 0.012 && x >= Math.min(f.lo[0], mc.lo[0]) - P.holgura_banda && x <= Math.max(f.hi[0], mc.hi[0]) + P.holgura_banda) return true; }
  return false;
}
/* GLB: leer, cambiar los índices de las piezas y volver a escribir el trozo JSON con relleno */
const buf = fs.readFileSync(F), lj = buf.readUInt32LE(12), js = JSON.parse(buf.slice(20, 20 + lj).toString('utf8'));
const binCab = Buffer.from(buf.slice(20 + lj, 20 + lj + 8)), bin = Buffer.from(buf.slice(20 + lj + 8));
const copia = fs.existsSync(COPIA) ? JSON.parse(fs.readFileSync(COPIA, 'utf8')) : {};
const CT = { 5121: 1, 5123: 2, 5125: 4 };
let piezas = 0;
for (const n of js.nodes) {
  if (n.mesh == null) continue; const ex = n.extras || js.meshes[n.mesh].extras || {};
  if (ex.en !== 'Palmar aponeurosis') continue;
  const pr = js.meshes[n.mesh].primitives[0], ai = js.accessors[pr.indices], bv = js.bufferViews[ai.bufferView], tam = CT[ai.componentType];
  const off = (bv.byteOffset || 0) + (ai.byteOffset || 0), lee = i => tam === 4 ? bin.readUInt32LE(off + i * 4) : tam === 2 ? bin.readUInt16LE(off + i * 2) : bin[off + i];
  const pon = (i, v) => tam === 4 ? bin.writeUInt32LE(v, off + i * 4) : tam === 2 ? bin.writeUInt16LE(v, off + i * 2) : (bin[off + i] = v);
  let orig = copia[n.name] ? copia[n.name].indices : null;
  if (!orig) { orig = []; for (let i = 0; i < ai.count; i++) orig.push(lee(i)); copia[n.name] = { indices: orig }; }
  if (DESHACER) { orig.forEach((v, i) => pon(i, v)); ai.count = orig.length; console.log(n.name, 'restaurado:', orig.length / 3, 'triángulos'); piezas++; continue; }
  const pz = PO.pieza(CUERPO + '/muscular', n.name), H = huesos(ex.lado);
  const ok = v => dentro(H, pz.P[v * 3], pz.P[v * 3 + 1]);
  const keep = []; for (let t = 0; t < orig.length; t += 3) if (ok(orig[t]) && ok(orig[t + 1]) && ok(orig[t + 2])) keep.push(orig[t], orig[t + 1], orig[t + 2]);
  keep.forEach((v, i) => pon(i, v));
  ai.count = keep.length;
  console.log(`${n.name} (${ex.lado}): ${orig.length / 3} → ${keep.length / 3} triángulos`); piezas++;
}
if (!piezas) { console.log('no hay aponeurosis palmar en', F); process.exit(1); }
fs.mkdirSync(DIR, { recursive: true }); if (!fs.existsSync(COPIA)) fs.writeFileSync(COPIA, JSON.stringify(copia));
let J = Buffer.from(JSON.stringify(js), 'utf8'); J = Buffer.concat([J, Buffer.alloc((4 - J.length % 4) % 4, 0x20)]);
const cab = Buffer.alloc(12), cj = Buffer.alloc(8);
cj.writeUInt32LE(J.length, 0); cj.writeUInt32LE(0x4E4F534A, 4);
cab.writeUInt32LE(0x46546C67, 0); cab.writeUInt32LE(2, 4); cab.writeUInt32LE(12 + 8 + J.length + 8 + bin.length, 8);
fs.writeFileSync(F, Buffer.concat([cab, cj, J, binCab, bin]));
console.log(DESHACER ? 'triángulos originales devueltos' : 'recorte hecho; índices originales en ' + COPIA);
