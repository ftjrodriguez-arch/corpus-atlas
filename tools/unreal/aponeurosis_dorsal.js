// Corpus Atlas (edición Unreal) — aponeurosis del dorsal ancho en el canal G (tendón) de la capa muscular.
//
//   node tools/unreal/aponeurosis_dorsal.js [hombre|mujer]            → pinta (siempre desde el canal guardado: repetible)
//   node tools/unreal/aponeurosis_dorsal.js [hombre|mujer] --deshacer → devuelve el canal guardado
//
// La malla del dorsal ancho llega hasta la línea media desde el sacro hasta T7: incluye su origen aponeurótico (apófisis
// espinosas T7–L5 y sacro por la hoja posterior de la fascia toracolumbar, y cresta ilíaca). tendones.js solo pinta junto a las
// áreas de inserción y dejaba toda esa lámina granate, cuando en los atlas es el rombo blanco lumbar (referencias del usuario,
// 2026-11-22). Frontera músculo–aponeurosis, en fracciones de la caja de la pieza (alto desde abajo, ancho desde la línea media):
//   alto ≤ 0.17 (cresta ilíaca, L4) → ancho 0.46 · alto 0.65 (T10) → ancho 0.07 · hasta alto 0.82 (T7) → 0.07 · más arriba, nada.
// Fundido de 1,5 cm hacia fuera. G = máx(G guardado, aponeurosis). Gray 42.ª ed. y Moore: PENDIENTE DE REVISIÓN PROFESIONAL.
// Si se vuelve a ejecutar tendones.js --aplicar, repetir esto después. Luego reimportar:
//   .\unreal\py.ps1 'ci.copiar_datos(); ci.importar_mallas(["<cuerpo>/muscular"])' -Limite 3000
'use strict';
const fs = require('fs'), path = require('path');
const CUERPO = process.argv.slice(2).find(a => !a.startsWith('--')) || 'hombre', DESHACER = process.argv.includes('--deshacer');
const IMPORTAR = path.join(__dirname, '..', '..', 'unreal', 'CorpusAtlas', 'Importar');
const F = path.join(IMPORTAR, CUERPO, 'muscular.glb'), COPIA = path.join(IMPORTAR, 'canal_g', `${CUERPO}_dorsal_g_antes.json`);
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const FRONTERA = [[0.17, 0.46], [0.65, 0.07], [0.82, 0.07]], FUNDIDO = 0.015;

const buf = fs.readFileSync(F), lj = buf.readUInt32LE(12), js = JSON.parse(buf.slice(20, 20 + lj).toString('utf8')), base = 20 + lj + 8;
const copia = fs.existsSync(COPIA) ? JSON.parse(fs.readFileSync(COPIA, 'utf8')) : null;
function ancho(h) {                                   // fracción del ancho que es aponeurosis a la altura relativa h (−1: nada)
  if (h <= FRONTERA[0][0]) return FRONTERA[0][1];
  for (let i = 1; i < FRONTERA.length; i++) if (h <= FRONTERA[i][0]) {
    const [h0, w0] = FRONTERA[i - 1], [h1, w1] = FRONTERA[i]; return w0 + (w1 - w0) * (h - h0) / (h1 - h0); }
  return -1;
}
const antes = {};
let piezas = 0, pintados = 0;
for (const n of js.nodes) {
  if (n.mesh == null) continue;
  const en = (n.extras || {}).en || (js.meshes[n.mesh].extras || {}).en || '';
  if (en !== 'Latissimus dorsi muscle') continue;
  const pr = js.meshes[n.mesh].primitives[0];
  if (pr.attributes.COLOR_0 == null) { console.log('sin COLOR_0:', n.name); continue; }
  const ap = js.accessors[pr.attributes.POSITION], vp = js.bufferViews[ap.bufferView];
  const pOff = base + (vp.byteOffset || 0) + (ap.byteOffset || 0), pPaso = vp.byteStride || 12;
  const ac = js.accessors[pr.attributes.COLOR_0], vc = js.bufferViews[ac.bufferView];
  if (ac.componentType !== 5121) { console.log('COLOR_0 no es byte:', n.name); continue; }
  const gOff = base + (vc.byteOffset || 0) + (ac.byteOffset || 0) + 1, gPaso = vc.byteStride || NC[ac.type];
  piezas++;
  const guardado = copia && copia[n.name] ? Buffer.from(copia[n.name], 'base64') : null;
  if (guardado && guardado.length !== ac.count) { console.log(n.name, ': la copia no corresponde (vértices distintos); bórrala y repite'); process.exit(1); }
  if (DESHACER) {
    if (!guardado) { console.log('sin copia para', n.name); continue; }
    for (let i = 0; i < ac.count; i++) buf[gOff + i * gPaso] = guardado[i];
    console.log(n.name, 'restaurado'); continue;
  }
  const g0 = guardado || Buffer.from(Array.from({ length: ac.count }, (_, i) => buf[gOff + i * gPaso]));
  const P = []; let y0 = 1e9, y1 = -1e9, xm = 0;
  for (let i = 0; i < ap.count; i++) { const x = buf.readFloatLE(pOff + i * pPaso), y = buf.readFloatLE(pOff + i * pPaso + 4);
    P.push([x, y]); y0 = Math.min(y0, y); y1 = Math.max(y1, y); xm = Math.max(xm, Math.abs(x)); }
  for (let i = 0; i < ac.count; i++) {
    let v = 0; const w = ancho((P[i][1] - y0) / (y1 - y0));
    if (w >= 0) { const d = Math.abs(P[i][0]) - w * xm, t = d <= 0 ? 1 : d >= FUNDIDO ? 0 : 1 - d / FUNDIDO; v = Math.round(255 * t * t * (3 - 2 * t)); }
    buf[gOff + i * gPaso] = Math.max(g0[i], v); if (v > 128) pintados++;
  }
  antes[n.name] = g0.toString('base64');
  console.log(`${n.name}: ${ac.count} vértices, alto ${y0.toFixed(3)}–${y1.toFixed(3)} m, ancho ${xm.toFixed(3)} m`);
}
if (!piezas) { console.log('no hay dorsal ancho en', F); process.exit(1); }
if (!DESHACER && !copia) fs.writeFileSync(COPIA, JSON.stringify(antes));
fs.writeFileSync(F, buf);
console.log(DESHACER ? 'canal restaurado' : `aponeurosis: ${pintados} vértices (G > 128) en ${piezas} piezas; canal anterior en ${COPIA}`);
