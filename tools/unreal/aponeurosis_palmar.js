// Corpus Atlas (edición Unreal) — aponeurosis palmar modelada: sustituye la malla de Z-Anatomy por una propia.
//
//   node tools/unreal/aponeurosis_palmar.js [hombre|mujer]            → genera y pone la pieza nueva (n1784 y n1794)
//   node tools/unreal/aponeurosis_palmar.js [hombre|mujer] --deshacer → vuelve a la malla original
//   Después: tendones.js <cuerpo> --restaurar y --aplicar, y .\unreal\py.ps1 'ci.copiar_datos(); ci.importar_mallas(["<cuerpo>/muscular"])'
//
// La pieza de Z-Anatomy cubría en bloque la palma y las eminencias tenar e hipotenar, con una lengüeta al pulgar, cuatro
// tiras hasta la falange media y una ranura transversal (hueco de la malla). Recortarla dejaba bordes dentados (749
// vértices). Aquí se construye de nuevo según el director clínico (2026-11-23; Gray 42.ª, Moore 8.ª, Netter 7.ª) y las
// referencias que mandó el usuario:
//   · parte central triangular: vértice de ~10 mm en el pliegue distal de la muñeca (sobre el 3.er–4.º metacarpiano, donde
//     se abre el tendón del palmar largo) y base en las cabezas de los metacarpianos 2.º–5.º;
//   · fibras longitudinales en abanico desde el vértice y fibras transversas en el cuarto distal (estrías en el canal R);
//   · cuatro bandas pretendinosas (2.º–5.º) que a la altura de la cabeza se parten en dos lengüetas a los lados de la vaina
//     flexora y terminan en el 30 % proximal de la falange proximal; entre ellas, las aberturas comisurales;
//   · ligamento natatorio: cinta transversa fina en las comisuras;
//   · sin lengüeta al pulgar y sin fascia tenar ni hipotenar (finas y traslúcidas: se ve el músculo, como en los atlas).
// Los límites salen de los huesos de la mano; la superficie, de la malla original (se proyecta sobre ella, así sigue la
// curva de la palma y rellena su ranura). Pesos de movimiento (UV), oclusión y alfa: del vértice original más cercano.
// El canal G es 255 (aponeurosis). PENDIENTE DE REVISIÓN PROFESIONAL.
'use strict';
const fs = require('fs'), path = require('path');
const PO = require('./postura.js');
const CUERPO = process.argv.slice(2).find(a => !a.startsWith('--')) || 'hombre', DESHACER = process.argv.includes('--deshacer');
const F = path.join(PO.IMP, CUERPO, 'muscular.glb'), DIR = path.join(PO.IMP, 'recortes'), COPIA = path.join(DIR, `${CUERPO}_aponeurosis_palmar_original.json`);
const M = {   // medidas (m) y proporciones; revisar con el director clínico
  vertice_ancho: 0.010, vertice_sobre_base_mc: 0.004, base_sobre_cabeza: 0.004,
  banda_ancho: 0.009, lengueta_ancho: 0.0025, lengueta_sep: 0.004, banda_hasta_falange: 0.30, solape: 0.003,
  natatorio_alto: 0.0025, estria_long: 16, estria_trans_paso: 0.003, estria_fuerza: 0.22, cuarto_distal: 0.70,
  // oclusión de base (canal R): la de la malla original oscurecía la lámina hasta un beis rosado; blanco nacarado como
  // los demás tendones · separación sobre la superficie original (en la mujer asomaba el músculo de debajo)
  oclusion: 238, separacion: 0.001,
};
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }, CT = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

/* ── GLB ── */
const buf = fs.readFileSync(F), lj = buf.readUInt32LE(12), js = JSON.parse(buf.slice(20, 20 + lj).toString('utf8'));
let bin = Buffer.from(buf.slice(20 + lj + 8));
function leeAcc(i) { const a = js.accessors[i], v = js.bufferViews[a.bufferView], T = CT[a.componentType], nc = NC[a.type], off = (v.byteOffset || 0) + (a.byteOffset || 0);
  const paso = v.byteStride || nc * T.BYTES_PER_ELEMENT, out = new T(a.count * nc);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < nc; c++) { const p = off + k * paso + c * T.BYTES_PER_ELEMENT;
    out[k * nc + c] = T === Float32Array ? bin.readFloatLE(p) : T === Uint8Array ? bin[p] : T === Uint16Array ? bin.readUInt16LE(p) : bin.readUInt32LE(p); }
  return out; }
const extra = [];
function ponAcc(arr, plantilla, minmax) {   // añade los datos al final del binario y devuelve el índice del accesor nuevo
  let off = bin.length + extra.reduce((s, b) => s + b.length, 0); const pad = (4 - off % 4) % 4; if (pad) { extra.push(Buffer.alloc(pad)); off += pad; }
  const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); extra.push(Buffer.from(b));
  js.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: b.length }); const a = { bufferView: js.bufferViews.length - 1, componentType: plantilla.componentType, count: arr.length / NC[plantilla.type], type: plantilla.type };
  if (plantilla.normalized) a.normalized = true; if (minmax) Object.assign(a, minmax); js.accessors.push(a); return js.accessors.length - 1; }

/* ── huesos de la mano (capa ósea del hombre: la mujer comparte el esqueleto y la mano está en el mismo sitio) ── */
function huesos(lado) {
  const C = PO.capa('hombre/oseo'), H = {};
  for (const n of C.g.nodes) { const ex = n.extras || {}; if (n.mesh === undefined || ex.lado !== lado) continue;
    const m = /^(First|Second|Third|Fourth|Fifth) metacarpal bone$/.exec(ex.en) || /^Proximal phalanx of (first|second|third|fourth|fifth) finger of hand$/.exec(ex.en);
    if (!m) continue; const b = PO.pieza('hombre/oseo', n.name), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < b.nv; i++) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], b.P[i * 3 + c]); hi[c] = Math.max(hi[c], b.P[i * 3 + c]); }
    H[(/metacarpal/.test(ex.en) ? 'mc' : 'fp') + (['first', 'second', 'third', 'fourth', 'fifth'].indexOf(m[1].toLowerCase()) + 1)] = { lo, hi, cx: (lo[0] + hi[0]) / 2 }; }
  return H;
}

/* ── plantilla 2D (x, y en el plano frontal) → lista de quads en rejilla: cada parte da puntos y triángulos ── */
function plantilla(H) {
  const V = [], T = [], info = [];   // info: { parte, fase de estría }
  const rejilla = (nu, nv, f, parte) => { const b = V.length;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = i / nu, v = j / nv; V.push(f(u, v)); info.push({ parte, u, v }); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = b + j * (nu + 1) + i; T.push([a, a + 1, a + nu + 2], [a, a + nu + 2, a + nu + 1]); } };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const lejos = b => Math.abs(b.lo[0]) > Math.abs(b.hi[0]) ? b.lo[0] : b.hi[0], cerca = b => Math.abs(b.lo[0]) < Math.abs(b.hi[0]) ? b.lo[0] : b.hi[0];
  const A = [(H.mc3.cx + H.mc4.cx) / 2, Math.max(H.mc3.hi[1], H.mc4.hi[1]) + M.vertice_sobre_base_mc];
  const B = [lejos(H.mc2), H.mc2.lo[1] + M.base_sobre_cabeza], C = [cerca(H.mc5), H.mc5.lo[1] + M.base_sobre_cabeza];
  const sB = Math.sign(B[0] - A[0]), A1 = [A[0] + sB * M.vertice_ancho / 2, A[1]], A2 = [A[0] - sB * M.vertice_ancho / 2, A[1]];
  // parte central (u: de B a C · v: del vértice a la base)
  rejilla(64, 72, (u, v) => lerp(lerp(A1, B, v), lerp(A2, C, v), u), 'central');
  const baseY = x => B[1] + (C[1] - B[1]) * (x - B[0]) / (C[0] - B[0]);
  // bandas pretendinosas y lengüetas
  const cortes = {};
  for (const k of [2, 3, 4, 5]) { const mc = H['mc' + k], fp = H['fp' + k], x0 = mc.cx, y0 = baseY(x0) + M.solape, yH = mc.lo[1];
    const yC = fp.hi[1] - M.banda_hasta_falange * (fp.hi[1] - fp.lo[1]), xC = fp.cx; cortes[k] = [xC, yC];
    const xH = x0 + (xC - x0) * (y0 - yH) / (y0 - yC);
    rejilla(8, 18, (u, v) => { const c = lerp([x0, y0], [xH, yH], v); return [c[0] + (u - 0.5) * M.banda_ancho * (1 - 0.15 * v), c[1]]; }, 'banda');
    for (const s of [-1, 1]) rejilla(3, 10, (u, v) => { const c = lerp([xH, yH + 0.001], [xC, yC], v), w = M.lengueta_ancho * (1 - 0.4 * v);
      return [c[0] + s * M.lengueta_sep * (0.6 + 0.4 * v) + (u - 0.5) * w, c[1]]; }, 'lengueta'); }
  // ligamento natatorio: cinta transversa de la banda 2 a la 5, en las comisuras
  const pts = [2, 3, 4, 5].map(k => [cortes[k][0], cortes[k][1] + 0.006]);
  for (let q = 0; q < 3; q++) rejilla(12, 3, (u, v) => { const c = lerp(pts[q], pts[q + 1], u); return [c[0], c[1] - (v - 0.5) * M.natatorio_alto]; }, 'natatorio');
  return { V, T, info, A, B, C };
}

/* ── proyección sobre la malla original: z de la superficie anterior en (x, y) ── */
function proyector(P, I) {
  const tris = []; for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3; tris.push([P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]]); }
  return (x, y) => { let z = -1e9;
    for (const [ax, ay, az, bx, by, bz, cx, cy, cz] of tris) { const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(d) < 1e-14) continue;
      const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue; const zz = l1 * az + l2 * bz + l3 * cz; if (zz > z) z = zz; }
    if (z > -1e8) return z;
    let bd = 1e9; for (let i = 0; i < P.length; i += 3) { const d = (P[i] - x) ** 2 + (P[i + 1] - y) ** 2; if (d < bd) { bd = d; z = P[i + 2]; } } return z; };   // hueco de la malla: el vecino
}

/* ── por pieza ── */
const copia = fs.existsSync(COPIA) ? JSON.parse(fs.readFileSync(COPIA, 'utf8')) : {};
let n = 0;
for (const nodo of js.nodes) {
  if (nodo.mesh == null) continue; const ex = nodo.extras || {}; if (ex.en !== 'Palmar aponeurosis') continue;
  const pr = js.meshes[nodo.mesh].primitives[0];
  if (!copia[nodo.name]) copia[nodo.name] = { attributes: Object.assign({}, pr.attributes), indices: pr.indices };
  const orig = copia[nodo.name];
  if (DESHACER) { pr.attributes = Object.assign({}, orig.attributes); pr.indices = orig.indices; delete ex.modelado; nodo.extras = ex; console.log(nodo.name, 'vuelve a la malla original'); n++; continue; }
  const P0 = leeAcc(orig.attributes.POSITION), I0 = leeAcc(orig.indices), nv0 = P0.length / 3, A0 = {};
  for (const k of Object.keys(orig.attributes)) if (k !== 'POSITION') A0[k] = leeAcc(orig.attributes[k]);
  const H = huesos(ex.lado), PL = plantilla(H), z = proyector(P0, I0), NV = PL.V.length;
  const P = new Float32Array(NV * 3);
  PL.V.forEach(([x, y], i) => { P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z(x, y) + M.separacion; });
  // triángulos con la normal hacia delante (la palma mira a +z)
  const I = new Uint32Array(PL.T.length * 3);
  PL.T.forEach(([a, b, c], t) => { const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1];
    const nz = ux * vy - uy * vx; I.set(nz >= 0 ? [a, b, c] : [a, c, b], t * 3); });
  // normales por vértice
  const N = new Float32Array(NV * 3);
  for (let t = 0; t < I.length; t += 3) { const [a, b, c] = [I[t], I[t + 1], I[t + 2]], u = [0, 1, 2].map(k => P[b * 3 + k] - P[a * 3 + k]), v = [0, 1, 2].map(k => P[c * 3 + k] - P[a * 3 + k]);
    const nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; for (const q of [a, b, c]) for (let k = 0; k < 3; k++) N[q * 3 + k] += nn[k]; }
  for (let i = 0; i < NV; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; for (let k = 0; k < 3; k++) N[i * 3 + k] /= l; if (N[i * 3 + 2] < 0) for (let k = 0; k < 3; k++) N[i * 3 + k] *= -1; }
  // vecino original más cercano (pesos de movimiento, oclusión, alfa)
  const vecino = new Int32Array(NV);
  for (let i = 0; i < NV; i++) { let bd = 1e9, b = 0; for (let j = 0; j < nv0; j++) { const d = (P0[j * 3] - P[i * 3]) ** 2 + (P0[j * 3 + 1] - P[i * 3 + 1]) ** 2 + (P0[j * 3 + 2] - P[i * 3 + 2]) ** 2; if (d < bd) { bd = d; b = j; } } vecino[i] = b; }
  // estrías: abanico desde el vértice (longitudinales) y transversas en el cuarto distal; en bandas y lengüetas, a lo largo
  const ang = (x, y) => Math.atan2(x - PL.A[0], PL.A[1] - y), aB = ang(PL.B[0], PL.B[1]), aC = ang(PL.C[0], PL.C[1]), K = 2 * Math.PI * M.estria_long / Math.abs(aC - aB);
  const fino = c => Math.pow(0.5 + 0.5 * Math.cos(c), 6), ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const atr = {};
  for (const k of Object.keys(A0)) { const src = A0[k], nc = src.length / nv0, out = new src.constructor(NV * nc);
    for (let i = 0; i < NV; i++) for (let c = 0; c < nc; c++) out[i * nc + c] = src[vecino[i] * nc + c]; atr[k] = out; }
  const COL = atr.COLOR_0, TAN = atr.TANGENT;
  for (let i = 0; i < NV; i++) { const x = P[i * 3], y = P[i * 3 + 1], inf = PL.info[i];
    let s;
    if (inf.parte === 'central') { const lon = fino(ang(x, y) * K), tr = fino(2 * Math.PI * y / M.estria_trans_paso) * ss(M.cuarto_distal - 0.05, M.cuarto_distal + 0.1, inf.v); s = Math.max(lon * (1 - 0.6 * ss(0.65, 0.85, inf.v)), tr); }
    else if (inf.parte === 'natatorio') s = fino(2 * Math.PI * x / 0.0015) * 0.35;
    else s = fino(2 * Math.PI * inf.u * 3) * 0.8;
    if (COL) { COL[i * 4] = Math.round(M.oclusion * (1 - M.estria_fuerza * s)); COL[i * 4 + 1] = 255; COL[i * 4 + 2] = 0; }
    // tangente = dirección de la fibra (anisotropía del material): radial desde el vértice; transversa en el natatorio
    if (TAN) { let dx = x - PL.A[0], dy = y - PL.A[1]; if (inf.parte === 'natatorio') { dx = 1; dy = 0; } const l = Math.hypot(dx, dy) || 1; TAN[i * 4] = dx / l; TAN[i * 4 + 1] = dy / l; TAN[i * 4 + 2] = 0; TAN[i * 4 + 3] = 1; } }
  if (atr.NORMAL) atr.NORMAL = N;
  // accesores nuevos
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < NV; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i * 3 + k]); hi[k] = Math.max(hi[k], P[i * 3 + k]); }
  const nuevos = { POSITION: ponAcc(P, js.accessors[orig.attributes.POSITION], { min: lo, max: hi }) };
  for (const k of Object.keys(atr)) nuevos[k] = ponAcc(atr[k], js.accessors[orig.attributes[k]]);
  pr.attributes = nuevos; pr.indices = ponAcc(I, { componentType: 5125, type: 'SCALAR' });
  ex.modelado = 'aponeurosis_palmar.js 2026-11-23'; nodo.extras = ex;
  console.log(`${nodo.name} (${ex.lado}): ${nv0} vértices de Z-Anatomy → ${NV} vértices y ${I.length / 3} triángulos propios`); n++;
}
if (!n) { console.log('no hay aponeurosis palmar en', F); process.exit(1); }
fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(COPIA, JSON.stringify(copia));
bin = Buffer.concat([bin, ...extra]); const padB = (4 - bin.length % 4) % 4; if (padB) bin = Buffer.concat([bin, Buffer.alloc(padB)]);
js.buffers[0].byteLength = bin.length;
let J = Buffer.from(JSON.stringify(js), 'utf8'); J = Buffer.concat([J, Buffer.alloc((4 - J.length % 4) % 4, 0x20)]);
const cab = Buffer.alloc(12), cj = Buffer.alloc(8), cb = Buffer.alloc(8);
cj.writeUInt32LE(J.length, 0); cj.writeUInt32LE(0x4E4F534A, 4); cb.writeUInt32LE(bin.length, 0); cb.writeUInt32LE(0x004E4942, 4);
cab.writeUInt32LE(0x46546C67, 0); cab.writeUInt32LE(2, 4); cab.writeUInt32LE(12 + 8 + J.length + 8 + bin.length, 8);
fs.writeFileSync(F, Buffer.concat([cab, cj, J, cb, bin]));
console.log(DESHACER ? 'malla original repuesta' : 'aponeurosis palmar modelada; accesores originales en ' + COPIA);
