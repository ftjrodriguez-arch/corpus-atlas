// Corpus Atlas (edición Unreal) — láminas aponeuróticas en el canal G (tendón) de la capa muscular: hoy, el dorsal ancho.
//
//   node tools/unreal/aponeurosis_dorsal.js [hombre|mujer]            → pinta (repetible: no acumula)
//   node tools/unreal/aponeurosis_dorsal.js [hombre|mujer] --deshacer → devuelve el canal guardado
//
// NO hace falta ejecutarlo a mano después de tendones.js: `tendones.js <cuerpo> --aplicar` lo llama al final (función
// `aplicarLaminas`) sobre el canal que acaba de pintar, antes de escribir el GLB. Ejecutado solo sirve para probar otra
// frontera sin repetir tendones.js.
//
// La malla del dorsal ancho llega hasta la línea media desde el sacro hasta T7: incluye su origen aponeurótico (apófisis
// espinosas T7–L5 y sacro por la hoja posterior de la fascia toracolumbar, y cresta ilíaca). tendones.js solo pinta junto a las
// áreas de inserción y dejaba toda esa lámina granate, cuando en los atlas es el rombo blanco lumbar (referencias del usuario,
// 2026-11-22). La frontera músculo–aponeurosis, el fundido, la fuente y el estado están en tools/unreal/tendones_reglas.json →
// «laminas» (PENDIENTE DE REVISIÓN PROFESIONAL). G = máx(G de partida, aponeurosis).
//
// Copia: Importar/canal_g/<cuerpo>_dorsal_g_antes.json = canal G de cada lámina ANTES de pintarla. Para no contradecir a
// tendones.js, la copia solo se usa como punto de partida si el GLB todavía tiene ese canal o el que sale de pintarlo; si el
// GLB cambió por otro lado (tendones.js --restaurar o --aplicar, reexportación), se parte del canal del GLB y se reescribe la copia.
// Luego reimportar:  .\unreal\py.ps1 'ci.copiar_datos(); ci.importar_mallas(["<cuerpo>/muscular"])' -Limite 3000
'use strict';
const fs = require('fs'), path = require('path');
const IMPORTAR = path.join(__dirname, '..', '..', 'unreal', 'CorpusAtlas', 'Importar');
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const copiaDe = cuerpo => path.join(IMPORTAR, 'canal_g', `${cuerpo}_dorsal_g_antes.json`);

/* fracción del ancho que es aponeurosis a la altura relativa h (−1: nada) */
function ancho(FR, h) {
  if (h <= FR[0][0]) return FR[0][1];
  for (let i = 1; i < FR.length; i++) if (h <= FR[i][0]) {
    const [h0, w0] = FR[i - 1], [h1, w1] = FR[i]; return w0 + (w1 - w0) * (h - h0) / (h1 - h0); }
  return -1;
}
const igual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/* pinta en `buf` (GLB entero, se modifica en su sitio; no escribe el archivo) las láminas de tendones_reglas.json.
   Devuelve { piezas, pintados, partida } y mantiene la copia de canal_g coherente con el GLB. */
function aplicarLaminas(buf, cuerpo, { deshacer = false, log = console.log } = {}) {
  const REGLAS = JSON.parse(fs.readFileSync(path.join(__dirname, 'tendones_reglas.json'), 'utf8'));
  const LAM = {}; for (const l of REGLAS.laminas || []) LAM[l.en] = l;
  const COPIA = copiaDe(cuerpo), copia = fs.existsSync(COPIA) ? JSON.parse(fs.readFileSync(COPIA, 'utf8')) : null;
  const lj = buf.readUInt32LE(12), js = JSON.parse(buf.slice(20, 20 + lj).toString('utf8')), base = 20 + lj + 8;
  const antes = {}; let piezas = 0, pintados = 0, nuevaCopia = false; const partida = {};
  for (const n of js.nodes) {
    if (n.mesh == null) continue;
    const en = (n.extras || {}).en || (js.meshes[n.mesh].extras || {}).en || '', L = LAM[en];
    if (!L) continue;
    const pr = js.meshes[n.mesh].primitives[0];
    if (pr.attributes.COLOR_0 == null) { log('sin COLOR_0: ' + n.name); continue; }
    const ap = js.accessors[pr.attributes.POSITION], vp = js.bufferViews[ap.bufferView];
    const pOff = base + (vp.byteOffset || 0) + (ap.byteOffset || 0), pPaso = vp.byteStride || 12;
    const ac = js.accessors[pr.attributes.COLOR_0], vc = js.bufferViews[ac.bufferView];
    if (ac.componentType !== 5121) { log('COLOR_0 no es byte: ' + n.name); continue; }
    const gOff = base + (vc.byteOffset || 0) + (ac.byteOffset || 0) + 1, gPaso = vc.byteStride || NC[ac.type];
    piezas++;
    const actual = Uint8Array.from({ length: ac.count }, (_, i) => buf[gOff + i * gPaso]);
    let guardado = copia && copia[n.name] ? new Uint8Array(Buffer.from(copia[n.name], 'base64')) : null;
    if (guardado && guardado.length !== ac.count) { log(n.name + ': la copia es de otra malla (vértices distintos): se parte del GLB'); guardado = null; }
    if (deshacer) {
      if (!guardado) { log('sin copia para ' + n.name); continue; }
      for (let i = 0; i < ac.count; i++) buf[gOff + i * gPaso] = guardado[i];
      log(n.name + ' restaurado'); continue;
    }
    // aponeurosis por vértice (solo depende de la posición)
    const P = []; let y0 = 1e9, y1 = -1e9, xm = 0;
    for (let i = 0; i < ap.count; i++) { const x = buf.readFloatLE(pOff + i * pPaso), y = buf.readFloatLE(pOff + i * pPaso + 4);
      P.push([x, y]); y0 = Math.min(y0, y); y1 = Math.max(y1, y); xm = Math.max(xm, Math.abs(x)); }
    const V = new Uint8Array(ac.count);
    for (let i = 0; i < ac.count; i++) { const w = ancho(L.frontera, (P[i][1] - y0) / (y1 - y0));
      if (w >= 0) { const d = Math.abs(P[i][0]) - w * xm, t = d <= 0 ? 1 : d >= L.fundido ? 0 : 1 - d / L.fundido; V[i] = Math.round(255 * t * t * (3 - 2 * t)); } }
    const pinta = g0 => g0.map((g, i) => Math.max(g, V[i]));
    // punto de partida: la copia, si el GLB aún tiene ese canal o el que sale de pintarlo; si no, el canal del GLB
    let g0;
    if (guardado && (igual(actual, guardado) || igual(actual, pinta(guardado)))) { g0 = guardado; partida[n.name] = 'copia'; }
    else { g0 = actual; partida[n.name] = guardado ? 'GLB (cambió desde la copia)' : 'GLB (sin copia)'; nuevaCopia = true; }
    const g = pinta(g0);
    for (let i = 0; i < ac.count; i++) { buf[gOff + i * gPaso] = g[i]; if (V[i] > 128) pintados++; }
    antes[n.name] = Buffer.from(g0).toString('base64');
    log(`${n.name} (${en}): ${ac.count} vértices, alto ${y0.toFixed(3)}–${y1.toFixed(3)} m, ancho ${xm.toFixed(3)} m · parte de ${partida[n.name]}`);
  }
  if (!deshacer && piezas && (nuevaCopia || !copia)) { fs.mkdirSync(path.dirname(COPIA), { recursive: true }); fs.writeFileSync(COPIA, JSON.stringify(Object.assign({}, copia || {}, antes))); }
  return { piezas, pintados, partida, copia: COPIA };
}
module.exports = { aplicarLaminas, copiaDe };

if (require.main === module) {
  const CUERPO = process.argv.slice(2).find(a => !a.startsWith('--')) || 'hombre', DESHACER = process.argv.includes('--deshacer');
  const F = path.join(IMPORTAR, CUERPO, 'muscular.glb'), buf = fs.readFileSync(F);
  const r = aplicarLaminas(buf, CUERPO, { deshacer: DESHACER });
  if (!r.piezas) { console.log('no hay ninguna pieza de «laminas» (tendones_reglas.json) en', F); process.exit(1); }
  fs.writeFileSync(F, buf);
  console.log(DESHACER ? 'canal restaurado' : `aponeurosis: ${r.pintados} vértices (G > 128) en ${r.piezas} piezas; canal de partida en ${r.copia}`);
}
