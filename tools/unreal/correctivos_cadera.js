#!/usr/bin/env node
/* Corpus Atlas → Unreal: correctivo elástico del glúteo mayor en la flexión de cadera y en los ejercicios que la flexionan
   (Sprint 1 K, segunda parte).

   Con los pesos (cadera.js: campo común, fracción de fibra armónica, cuerda y adelgazamiento) el glúteo mayor ya no se
   hincha (volumen 89 % a 90°, 77 % a 120°), pero cada vértice sigue siendo «su punto de reposo girado una fracción del
   ángulo alrededor de la cabeza femoral»: la forma de la sección no cambia, solo gira y se encoge hacia la articulación.
   Por eso a 90–120° conserva el contorno redondeado de la nalga en reposo (las «bolsas») en vez de estirarse como una
   lámina tensa del sacro al trocánter. Ningún reparto de pesos lo arregla (barrido en el LEEME, punto K): hace falta que
   el vientre se alargue a lo largo de la fibra y adelgace de través, y que no atraviese el hueso, que es lo que hace el
   correctivo elástico del hombro.

   Aquí se usa el mismo resolutor (correctivos.js: rejilla ARAP por músculo, fibra que se alarga conservando el volumen,
   choque con hueso) con lo propio de la cadera, todo en correctivos_cadera.json:
     · Anclajes: las áreas de la capa «insercion» (para el glúteo mayor solo hay dos: ilion y tuberosidad glútea) más
       sacro y cóccix, ilion posterior por encima de la cabeza femoral y tracto iliotibial por debajo del trocánter
       (va con el fémur). La tuberosidad isquiática y el trocánter mayor no se anclan: el músculo resbala sobre ellos.
     · Choque con coxal, sacro, cóccix y fémur (no con las costillas). Cada punto conserva el 85 % de su holgura de reposo
       (hasta 18 mm): entre el glúteo mayor y el hueso están los rotadores y el glúteo medio, que no se resuelven aquí.
   Salida: Importar/datos/correctivos_cadera.json + .bin, con el MISMO formato que correctivos.json/.bin. UCorpusDatos
   los junta con los del hombro en una sola textura y ACorpusCuerpo solo usa la rejilla de las piezas que están en el
   movimiento puesto (las demás van con sus pesos): por eso no hace falta tocar correctivos.js ni el material.

   Uso:  node tools/unreal/correctivos_cadera.js anclas [hombre|mujer] [R|L]       anclajes, rejilla y huesos de choque
         node tools/unreal/correctivos_cadera.js medir  [hombre|mujer] [R|L]       pesos frente a correctivo (sonda)
         node tools/unreal/correctivos_cadera.js hornear [hombre,mujer]            todo, para Unreal
   Hay que hornearlo después de movimiento.js / cadera.js aplicar (usa los pesos de los huesos y las posturas de
   movimiento.json) y no depende del orden respecto a correctivos.js. CORPUS_IMP mide otra carpeta Importar. */
'use strict';
const fs = require('fs'), path = require('path');
const PO = require('./postura.js');
const CO = require('./correctivos.js');
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'correctivos_cadera.json'), 'utf8'));

const LD = S => S === 'R' ? 'derecho' : 'izquierdo';
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MUSCULOS = new RegExp('^(' + CFG.musculos.map(m => esc(m.en)).join('|') + ')$');
const HUESOS = new RegExp(CFG.huesos_colision);
const HOLG = CFG.holgura, RAD = 0.024;
if (!(HOLG.maxima_m < RAD)) throw new Error('correctivos_cadera.json: holgura.maxima_m debe ser menor que ' + RAD + ' m (alcance del campo de distancia)');

/* ───────── utilidades (las mismas que correctivos.js, que no las exporta) ───────── */
const clave = (x, y, z, c) => Math.floor(x / c) + ',' + Math.floor(y / c) + ',' + Math.floor(z / c);
const rejillaPuntos = c => ({ c, H: new Map() });
function mete(G, x, y, z, dato) { const k = clave(x, y, z, G.c); let l = G.H.get(k); if (!l) G.H.set(k, l = []); l.push(x, y, z, dato); }
function cerca(G, x, y, z, r) {
  const c = G.c, fx = Math.floor(x / c), fy = Math.floor(y / c), fz = Math.floor(z / c); let bd = r * r, b = -1;
  for (let a = -1; a <= 1; a++) for (let e = -1; e <= 1; e++) for (let f = -1; f <= 1; f++) { const l = G.H.get((fx + a) + ',' + (fy + e) + ',' + (fz + f)); if (!l) continue;
    for (let t = 0; t < l.length; t += 4) { const d = (l[t] - x) ** 2 + (l[t + 1] - y) ** 2 + (l[t + 2] - z) ** 2; if (d < bd) { bd = d; b = l[t + 3]; } } }
  return b < 0 ? null : [b, Math.sqrt(bd)];
}
const pesosDe = (pz, i) => [pz.U[0][i * 2], pz.U[0][i * 2 + 1], pz.U[1][i * 2], pz.U[1][i * 2 + 1], pz.U[2][i * 2], pz.U[2][i * 2 + 1], pz.U[3][i * 2], pz.U[3][i * 2 + 1], 0];
const pivote = n => PO.M.articulaciones[PO.arts.indexOf(n)].pivote;
/* piezas de una capa: la mujer solo trae las que cambian; el resto son las del hombre */
function piezasDe(cuerpo, sistema) {
  const L = [], propias = new Set();
  for (const c of cuerpo === 'hombre' ? ['hombre'] : [cuerpo, 'hombre']) { let C; try { C = PO.capa(c + '/' + sistema); } catch (e) { continue; }
    for (const nd of C.g.nodes) { if (nd.mesh === undefined || propias.has(nd.name)) continue; const pz = PO.pieza(c + '/' + sistema, nd.name); if (!pz) continue; pz.capa = c + '/' + sistema; if (c === cuerpo) propias.add(nd.name); L.push(pz); } }
  return L;
}
/* distancia con signo a un hueso en una rejilla de 3 mm (signo por la normal del vértice más cercano), como correctivos.js */
const _SDF = {};
function sdf(cuerpo, pz) {
  const kk = cuerpo + '/' + pz.id; if (_SDF[kk]) return _SDF[kk];
  const C = PO.capa(pz.capa || cuerpo + '/oseo'), pr = C.g.meshes[C.porId[pz.id].mesh].primitives[0], N = pr.attributes.NORMAL !== undefined ? C.acc(pr.attributes.NORMAL) : null;
  const h = 0.003, b0 = [1e9, 1e9, 1e9], b1 = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pz.nv; i++) for (let k = 0; k < 3; k++) { const v = pz.P[i * 3 + k]; if (v < b0[k]) b0[k] = v; if (v > b1[k]) b1[k] = v; }
  const o = b0.map(v => v - RAD - h), n = b1.map((v, k) => Math.ceil((v + RAD + h - o[k]) / h) + 1), D = new Float32Array(n[0] * n[1] * n[2]).fill(RAD), A = new Float32Array(D.length).fill(RAD);
  const visto = new Set(), rv = Math.ceil(RAD / h);
  for (let i = 0; i < pz.nv; i++) { const x = pz.P[i * 3], y = pz.P[i * 3 + 1], z = pz.P[i * 3 + 2], k = clave(x, y, z, 0.0015); if (visto.has(k)) continue; visto.add(k);
    const nx = N ? N[i * 3] : 0, ny = N ? N[i * 3 + 1] : 0, nz = N ? N[i * 3 + 2] : 0, cx = Math.round((x - o[0]) / h), cy = Math.round((y - o[1]) / h), cz = Math.round((z - o[2]) / h);
    for (let a = Math.max(0, cx - rv); a <= Math.min(n[0] - 1, cx + rv); a++) for (let e = Math.max(0, cy - rv); e <= Math.min(n[1] - 1, cy + rv); e++) for (let f = Math.max(0, cz - rv); f <= Math.min(n[2] - 1, cz + rv); f++) {
      const dx = o[0] + a * h - x, dy = o[1] + e * h - y, dz = o[2] + f * h - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz), q = a + n[0] * (e + n[1] * f);
      if (d < A[q]) { A[q] = d; D[q] = (dx * nx + dy * ny + dz * nz) < 0 ? -d : d; } } }
  return _SDF[kk] = { o, n, h, D, RAD };
}
function sdfEn(S, p) {
  const fx = (p[0] - S.o[0]) / S.h, fy = (p[1] - S.o[1]) / S.h, fz = (p[2] - S.o[2]) / S.h, n = S.n;
  if (fx < 1 || fy < 1 || fz < 1 || fx > n[0] - 2 || fy > n[1] - 2 || fz > n[2] - 2) return S.RAD;
  const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz), tx = fx - ix, ty = fy - iy, tz = fz - iz, D = S.D, q = ix + n[0] * (iy + n[1] * iz), sy = n[0], sz = n[0] * n[1];
  const c000 = D[q], c100 = D[q + 1], c010 = D[q + sy], c110 = D[q + sy + 1], c001 = D[q + sz], c101 = D[q + sz + 1], c011 = D[q + sz + sy], c111 = D[q + sz + sy + 1];
  const x00 = c000 + (c100 - c000) * tx, x10 = c010 + (c110 - c010) * tx, x01 = c001 + (c101 - c001) * tx, x11 = c011 + (c111 - c011) * tx, y0 = x00 + (x10 - x00) * ty, y1 = x01 + (x11 - x01) * ty;
  return y0 + (y1 - y0) * tz;
}
/* pares de nodos de cada celda (12 aristas y 4 diagonales), como correctivos.js */
const PARES = (() => { const L = []; for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) { const d = a ^ b; if (d === 1 || d === 2 || d === 4 || d === 7) L.push([a, b]); } return L; })();

/* ───────── anclajes: áreas del atlas + reglas de correctivos_cadera.json ───────── */
function anclajesCadera(cuerpo, mus, S) {
  const base = CO.anclajes(cuerpo, mus, S), H = CO.huesos(cuerpo), hip = pivote('hip_' + S), P = mus.P;
  const visto = new Set(base.A.map(a => clave(P[a.v * 3], P[a.v * 3 + 1], P[a.v * 3 + 2], 0.003)));
  const lado = pz => !pz.lado || pz.lado === LD(S);
  const reglas = CFG.anclajes_extra.map(r => {
    const g = rejillaPuntos(Math.max(0.015, r.distancia_m)), reH = new RegExp(r.hueso);
    if (r.tipo === 'hueso') { H.pzs.forEach((pz, pi) => { if (!reH.test(pz.en) || !lado(pz)) return; const vs = new Set();
        for (let i = 0; i < pz.nv; i++) { const k = clave(pz.P[i * 3], pz.P[i * 3 + 1], pz.P[i * 3 + 2], 0.003); if (vs.has(k)) continue; vs.add(k); mete(g, pz.P[i * 3], pz.P[i * 3 + 1], pz.P[i * 3 + 2], pi * 4194304 + i); } });
      return { r, g, nombre: null }; }
    /* «pieza»: puntos de otra pieza blanda (tracto iliotibial) que van con un hueso */
    const hi = H.pzs.findIndex(pz => reH.test(pz.en) && lado(pz)); if (hi < 0) { console.log('  aviso: sin hueso %s para la regla %s', r.hueso, r.pieza); return null; }
    const reP = new RegExp(r.pieza); let n = 0;
    for (const T of piezasDe(cuerpo, r.capa || 'muscular')) { if (!reP.test(T.en) || !lado(T)) continue;   /* «capa»: el ligamento sacrotuberoso está en la articular */ for (let i = 0; i < T.nv; i++) { mete(g, T.P[i * 3], T.P[i * 3 + 1], T.P[i * 3 + 2], hi * 4194304); n++; } }
    if (!n) console.log('  aviso: ninguna pieza %s en %s', r.pieza, cuerpo);
    return { r, g, nombre: r.pieza.replace(/[\^$]/g, '') + ' → ' + H.pzs[hi].en };
  }).filter(Boolean);
  const A = base.A.slice(), porHueso = Object.assign({}, base.porHueso);
  for (let i = 0; i < mus.nv; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], kv = clave(x, y, z, 0.003); if (visto.has(kv)) continue;
    for (const { r, g, nombre } of reglas) {
      if (r.sobre_cadera_m !== undefined && y < hip[1] + r.sobre_cadera_m) continue;
      if (r.bajo_cadera_m !== undefined && y > hip[1] - r.bajo_cadera_m) continue;
      const hb = cerca(g, x, y, z, r.distancia_m); if (!hb) continue;
      const pi = Math.floor(hb[0] / 4194304), vi = hb[0] % 4194304, nb = nombre || H.pzs[pi].en;
      visto.add(kv); A.push({ v: i, pi, vi }); porHueso[nb] = (porHueso[nb] || 0) + 1; break; } }
  return { A, porHueso, areas: base.A.length };
}

/* ───────── preparación de un músculo: lo mismo que CO.preparar con anclajes y choques de cadera ───────── */
function preparar(cuerpo, id, S) {
  const mus = PO.pieza(cuerpo + '/muscular', id); if (!mus) return null;
  const H = CO.huesos(cuerpo), an = anclajesCadera(cuerpo, mus, S), RJ = CO.rejilla(mus), N = RJ.N;
  /* dirección de la fibra en cada celda (tangente de la malla): a lo largo de ella el vientre se alarga sin oponerse */
  const C = PO.capa(cuerpo + '/muscular'), pr = C.g.meshes[C.porId[id].mesh].primitives[0], T = pr.attributes.TANGENT !== undefined ? C.acc(pr.attributes.TANGENT) : null, fib = new Float64Array(RJ.celdas.length * 3), tot = [0, 0, 0];
  if (T) { for (let i = 0; i < mus.nv; i++) { const c = RJ.celDe(mus.P[i * 3], mus.P[i * 3 + 1], mus.P[i * 3 + 2]); if (c < 0) continue; let tx = T[i * 4], ty = T[i * 4 + 1], tz = T[i * 4 + 2];
      if (tx * tot[0] + ty * tot[1] + tz * tot[2] < 0) { tx = -tx; ty = -ty; tz = -tz; } fib[c * 3] += tx; fib[c * 3 + 1] += ty; fib[c * 3 + 2] += tz; tot[0] += tx; tot[1] += ty; tot[2] += tz; }
    const lt = Math.hypot(...tot) || 1; for (let c = 0; c < RJ.celdas.length; c++) { const l = Math.hypot(fib[c * 3], fib[c * 3 + 1], fib[c * 3 + 2]); if (l > 1e-6) { fib[c * 3] /= l; fib[c * 3 + 1] /= l; fib[c * 3 + 2] /= l; } else { fib[c * 3] = tot[0] / lt; fib[c * 3 + 1] = tot[1] / lt; fib[c * 3 + 2] = tot[2] / lt; } } }
  /* matriz fija: rigidez de las celdas + anclajes */
  const filas = Array.from({ length: N }, () => new Map()), suma = (i, j, v) => { const f = filas[i]; f.set(j, (f.get(j) || 0) + v); };
  for (const c of RJ.celdas) for (const [a, b] of PARES) { const i = c[a], j = c[b]; suma(i, i, 1); suma(j, j, 1); suma(i, j, -1); suma(j, i, -1); }
  const KA = CFG.rigidez_anclaje || 30, anc = an.A.map(a => Object.assign({ t: RJ.tri(mus.P[a.v * 3], mus.P[a.v * 3 + 1], mus.P[a.v * 3 + 2]), wa: 1 }, a));
  for (const a of anc) for (let p = 0; p < 8; p++) for (let q = 0; q < 8; q++) suma(a.t.I[p], a.t.I[q], KA * a.wa * a.t.W[p] * a.t.W[q]);
  const GA = rejillaPuntos(0.008); for (const a of anc) mete(GA, mus.P[a.v * 3], mus.P[a.v * 3 + 1], mus.P[a.v * 3 + 2], 0);
  /* choques: coxal, sacro, cóccix y fémur del lado; muestras cada 5 mm fuera de los anclajes */
  const sdfs = H.pzs.map((pz, pi) => ({ pz, pi })).filter(o => HUESOS.test(o.pz.en) && (!o.pz.lado || o.pz.lado === LD(S))).map(o => Object.assign(o, { S: sdf(cuerpo, o.pz) }));
  const mue = [], visto = new Set();
  for (let i = 0; i < mus.nv; i++) { const p = [mus.P[i * 3], mus.P[i * 3 + 1], mus.P[i * 3 + 2]], k = clave(p[0], p[1], p[2], 0.005); if (visto.has(k)) continue; visto.add(k);
    if (cerca(GA, p[0], p[1], p[2], 0.008)) continue;
    /* holgura que se conserva: una fracción de la de reposo (lo que ya estaba dentro del hueso puede seguir igual de dentro) */
    const d0 = sdfs.map(o => { const d = sdfEn(o.S, p); return d <= 0 ? d : Math.min(HOLG.maxima_m, d * HOLG.fraccion); });
    mue.push({ p, t: RJ.tri(p[0], p[1], p[2]), kmin: 0, d0 }); }
  /* yMax = −∞: el resolutor no aplica el contorno de las costillas (es para los músculos del hombro) */
  return { cuerpo, id, S, mus, H, an, anc, RJ, filas, KA, mue, sdfs, yMax: -Infinity, fib: T ? fib : null, brazo: false };
}
function ids(cuerpo, S) { return PO.capa(cuerpo + '/muscular').g.nodes.filter(n => n.mesh !== undefined && MUSCULOS.test((n.extras || {}).en || '') && (n.extras || {}).lado === LD(S)).map(n => n.name); }

/* cuadros de un rango, alineados con los fotogramas de movimiento.json (ACorpusCuerpo interpola entre I0 e I1 de esos) */
const cuadrosRango = (mv, S) => (mv[S] || mv.R).map((_, k) => Math.min(k * mv.paso, mv.max));
const HIPS = new Set(['hip_R', 'hip_L'].map(n => PO.arts.indexOf(n)));
const usaCadera = v => { const u = CFG.ejercicios.umbral_giro_cadera_grados * Math.PI / 180; return v.frames.some(fr => { for (let k = 0; k < fr.length; k += 8) if (HIPS.has(fr[k]) && Math.abs(fr[k + 4]) > u) return true; return false; }); };

/* ───────── medidas (sonda) ───────── */
const volumen = (A, I) => { let v = 0; for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3; v += A[a] * (A[b + 1] * A[c + 2] - A[b + 2] * A[c + 1]) + A[a + 1] * (A[b + 2] * A[c] - A[b] * A[c + 2]) + A[a + 2] * (A[b] * A[c + 1] - A[b + 1] * A[c]); } return v / 6; };
/* distancia de cada vértice al hueso más cercano (vértices de los huesos de choque ya colocados), hasta 6 cm */
function distHueso(Bs, D) {
  const c = 0.01, G = new Map(); for (const B of Bs) for (let i = 0; i < B.length; i += 6) { const k = clave(B[i], B[i + 1], B[i + 2], c); let l = G.get(k); if (!l) G.set(k, l = []); l.push(B[i], B[i + 1], B[i + 2]); }
  const out = new Float32Array(D.length / 3);
  for (let v = 0; v < out.length; v++) { const x = D[v * 3], y = D[v * 3 + 1], z = D[v * 3 + 2], fx = Math.floor(x / c), fy = Math.floor(y / c), fz = Math.floor(z / c); let bd = 1e9;
    for (let r = 1; r <= 6 && bd > ((r - 1) * c) ** 2; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let e = -r; e <= r; e++) { if (r > 1 && Math.max(Math.abs(a), Math.abs(b), Math.abs(e)) !== r) continue;
      const l = G.get((fx + a) + ',' + (fy + b) + ',' + (fz + e)); if (!l) continue; for (let t = 0; t < l.length; t += 3) { const d = (l[t] - x) ** 2 + (l[t + 1] - y) ** 2 + (l[t + 2] - z) ** 2; if (d < bd) bd = d; } }
    out[v] = Math.min(0.06, Math.sqrt(bd)); }
  return out;
}
function sonda(PR, D, J) {
  const { mus, sdfs } = PR, SN = CFG.sonda, m = CO.medir(PR, D, J);
  const fem = sdfs.find(o => /^Femur$/.test(o.pz.en)), hip = pivote('hip_' + PR.S), c = fem ? PO.vertice(fem.pz, J, hip, pesosDe(fem.pz, 0), { abrazo: false }) : hip;
  const B0 = sdfs.map(o => o.pz.P), B1 = sdfs.map(o => PO.deformar(o.pz, J, { abrazo: false })), d0 = PR._d0 || (PR._d0 = distHueso(B0, mus.P)), d1 = distHueso(B1, D);
  let desp = 0, bolsa = 0, rmax0 = 0, rmax1 = 0;
  for (let i = 0; i < mus.nv; i++) { if (d1[i] - d0[i] > SN.despegue_m) desp++;
    const r0 = Math.hypot(mus.P[i * 3] - hip[0], mus.P[i * 3 + 1] - hip[1], mus.P[i * 3 + 2] - hip[2]), r1 = Math.hypot(D[i * 3] - c[0], D[i * 3 + 1] - c[1], D[i * 3 + 2] - c[2]);
    if (r1 > r0 * (1 + SN.radio_crece)) bolsa++; if (r0 > rmax0) rmax0 = r0; if (r1 > rmax1) rmax1 = r1; }
  return { 'vol %': Math.round(volumen(D, mus.I) / volumen(mus.P, mus.I) * 100), dentro: m.dentro, 'hondo mm': +(m.hondo * 1000).toFixed(1), despegados: desp, bolsa, 'radio máx cm': +(rmax1 * 100).toFixed(1) + ' (' + (rmax0 * 100).toFixed(1) + ')', pliegues: m.plieg, 'estir. p99': +m.est.toFixed(2) };
}
function medir(cuerpo, S) {
  const L = ids(cuerpo, S); if (!L.length) { console.log('ningún músculo de %s en %s/muscular', CFG.musculos.map(m => m.en).join(', '), cuerpo); return; }
  for (const id of L) { const t0 = Date.now(), PR = preparar(cuerpo, id, S); console.log('%s %s %s · %d vértices · %d anclajes (%d de áreas del atlas) · %d muestras de choque con %s · %d ms',
      cuerpo, id, PR.mus.en, PR.mus.nv, PR.anc.length, PR.an.areas, PR.mue.length, PR.sdfs.map(o => o.pz.en).join(', '), Date.now() - t0);
    const filas = [];
    for (const [nm, rom, mi, gr] of CFG.sonda.posturas) { const J = PO.articulaciones(rom, mi, S, gr);
      let gs = []; if (String(rom).startsWith('ej:')) { const e = PO.M.ejercicios.lista.find(x => x.id === rom.slice(3)); for (let g = 0; g < gr; g += e.paso) gs.push(g); }
      else { const mv = PO.M.rom.find(r => r.id === rom).movs[+mi]; for (let g = 0; g < gr; g += mv.paso) gs.push(g); }
      gs.push(gr); const t1 = Date.now(), Cq = CO.resolver(PR, rom, mi, gs), Dc = CO.aplicar(PR, Cq[Cq.length - 1].X);
      filas.push(Object.assign({ postura: nm, cuenta: 'pesos' }, sonda(PR, PO.deformar(PR.mus, J), J)));
      filas.push(Object.assign({ postura: nm, cuenta: 'correctivo' }, sonda(PR, Dc, J), { 'en contacto': Cq[Cq.length - 1].col, ms: Date.now() - t1 })); }
    console.table(filas); }
  console.log('  vol % = volumen del reposo · dentro = vértices más de 3 mm por dentro de un hueso que en reposo (hondo = el peor) · despegados = se alejan del hueso más de %s mm · bolsa = su distancia a la cabeza femoral crece más del %d %% · radio máx = la mayor (entre paréntesis, en reposo) · pliegues = aristas cuyas caras se cierran',
    CFG.sonda.despegue_m * 1000, CFG.sonda.radio_crece * 100);
}

module.exports = { CFG, preparar, ids, anclajesCadera, sonda, MUSCULOS };

if (require.main === module) {
  const [orden, ...a] = process.argv.slice(2);
  if (orden === 'anclas') { const cuerpo = a[0] || 'hombre', S = a[1] || 'R';
    for (const id of ids(cuerpo, S)) { const PR = preparar(cuerpo, id, S);
      console.log('%s %s · %d vértices · rejilla %s (%d nodos, %s mm) · anclajes %d (%d de áreas del atlas): %s · choque con %s · %d muestras',
        id, PR.mus.en, PR.mus.nv, PR.RJ.n.join('×'), PR.RJ.N, (PR.RJ.h * 1000).toFixed(0), PR.anc.length, PR.an.areas, Object.entries(PR.an.porHueso).map(([k, v]) => k + ' ' + v).join(', '), PR.sdfs.map(o => o.pz.en).join(', '), PR.mue.length); } }
  else if (orden === 'medir') medir(a[0] || 'hombre', a[1] || 'R');
  else if (orden === 'hornear') {
    /* mismo formato que correctivos.json/.bin (ver correctivos.js → hornear): piezas «cuerpo/id» → {base, n, o, h, act, ai, lado};
       movs [{rom, mov, lado, cuadros, piezas}]. Las bases empiezan en 1 (el texel 0 es la cabecera): UCorpusDatos las coloca
       detrás de las del hombro al juntar los dos archivos. */
    const cuerpos = (a[0] || 'hombre,mujer').split(','), partes = [], piezas = {}, movs = []; let base = 1, pos = 0; const t0 = Date.now();
    const dir = path.join(PO.IMP, 'datos');
    let ANCHO = 512, ESCALA = 20000;
    try { const cab = fs.readFileSync(path.join(dir, 'correctivos.json'), 'utf8').slice(0, 200), ma = /"ancho":(\d+)/.exec(cab), me = /"escala":(\d+)/.exec(cab); if (ma) ANCHO = +ma[1]; if (me) ESCALA = +me[1]; } catch (e) { /* sin hombro: valores por defecto */ }
    const pon = buf => { const o = pos; partes.push(buf); pos += buf.length; const pad = (4 - pos % 4) % 4; if (pad) { partes.push(Buffer.alloc(pad)); pos += pad; } return o; };
    const PRs = [];
    for (const cuerpo of cuerpos) for (const S of ['R', 'L']) for (const id of ids(cuerpo, S)) { const PR = preparar(cuerpo, id, S), RJ = PR.RJ, n = RJ.n, nn = n[0] * n[1] * n[2];
      /* anillo: nodos inactivos junto a alguno activo (se rellenan por extrapolación) */
      const anillo = [], vec = []; for (let q = 0; q < nn; q++) { if (RJ.act[q] >= 0) continue; const x = q % n[0], y = Math.floor(q / n[0]) % n[1], z = Math.floor(q / (n[0] * n[1])), l = [];
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy, Z = z + dz; if (X < 0 || Y < 0 || Z < 0 || X >= n[0] || Y >= n[1] || Z >= n[2]) continue; const k = RJ.act[X + n[0] * (Y + n[1] * Z)]; if (k >= 0) l.push(k); }
        if (l.length) { anillo.push(q); vec.push(l); } }
      const lista = Uint32Array.from(RJ.nodos.concat(anillo));
      PR.anillo = vec; PR.clave = cuerpo + '/' + id; PRs.push(PR);
      piezas[PR.clave] = { base, n, o: RJ.o.map(v => Math.round(v * 1e6) / 1e6), h: Math.round(RJ.h * 1e6) / 1e6, act: lista.length, ai: pon(Buffer.from(lista.buffer)), lado: S };
      console.log('  %s %s %s: %d anclajes (%d de áreas), %d nodos', PR.clave, S, PR.mus.en, PR.anc.length, PR.an.areas, RJ.N); base += nn; }
    if (!PRs.length) throw new Error('ningún músculo de correctivos_cadera.json en ' + cuerpos.join(','));
    const cuadros = (PR, rom, mi, gs) => { const C = CO.resolver(PR, rom, mi, gs), N = PR.RJ.N, NA = N + PR.anillo.length, buf = new Int16Array(gs.length * NA * 7), prev = new Float32Array(NA * 4); for (let i = 0; i < NA; i++) prev[i * 4 + 3] = 1;
      C.forEach((c, k) => { const x0 = PR.RJ.x0, D = new Float32Array(NA * 3), Q = new Float32Array(NA * 4);
        for (let i = 0; i < N; i++) { D[i * 3] = c.X[i * 3] - x0[i * 3]; D[i * 3 + 1] = c.X[i * 3 + 1] - x0[i * 3 + 1]; D[i * 3 + 2] = c.X[i * 3 + 2] - x0[i * 3 + 2]; for (let q = 0; q < 4; q++) Q[i * 4 + q] = c.Q[i * 4 + q]; }
        PR.anillo.forEach((l, j) => { const i = N + j; for (const v of l) { for (let q = 0; q < 3; q++) D[i * 3 + q] += D[v * 3 + q] / l.length; const sg = (Q[v * 4] * Q[l[0] * 4] + Q[v * 4 + 1] * Q[l[0] * 4 + 1] + Q[v * 4 + 2] * Q[l[0] * 4 + 2] + Q[v * 4 + 3] * Q[l[0] * 4 + 3]) < 0 ? -1 : 1; for (let q = 0; q < 4; q++) Q[i * 4 + q] += sg * Q[v * 4 + q]; } });
        for (let i = 0; i < NA; i++) { let l = Math.hypot(Q[i * 4], Q[i * 4 + 1], Q[i * 4 + 2], Q[i * 4 + 3]) || 1; if (Q[i * 4] * prev[i * 4] + Q[i * 4 + 1] * prev[i * 4 + 1] + Q[i * 4 + 2] * prev[i * 4 + 2] + Q[i * 4 + 3] * prev[i * 4 + 3] < 0) l = -l;   /* mismo signo que en el cuadro anterior */
          const o = (k * NA + i) * 7; for (let q = 0; q < 3; q++) buf[o + q] = Math.max(-32767, Math.min(32767, Math.round(D[i * 3 + q] * ESCALA)));
          for (let q = 0; q < 4; q++) { const v = Q[i * 4 + q] / l; prev[i * 4 + q] = v; buf[o + 3 + q] = Math.round(v * 32767); } } });
      return pon(Buffer.from(buf.buffer)); };
    /* rangos de cadera: un lado cada vez (el otro se queda con sus pesos, en reposo) */
    for (const r of CFG.rangos) { const R = PO.M.rom.find(x => x.id === r.rom); if (!R) { console.log('  aviso: rango %s no está en movimiento.json', r.rom); continue; }
      R.movs.forEach((mv, mi) => { if (r.movs && !r.movs.includes(mi)) return; for (const S of ['R', 'L']) { if (!mv[S]) continue;
        const gs = cuadrosRango(mv, S), M = { rom: r.rom, mov: mi, lado: S, cuadros: gs.length, piezas: {} };
        for (const PR of PRs) { if (PR.S !== S) continue; M.piezas[PR.clave] = cuadros(PR, r.rom, mi, gs); }
        movs.push(M); console.log('  %s %d %s (%s): %d cuadros · %d s', r.rom, mi, S, mv.n, gs.length, Math.round((Date.now() - t0) / 1000)); } }); }
    /* ejercicios que giran la cadera: los dos lados a la vez (rom «ej:<id>», mov = índice de la variante, lado R), igual
       que los del hombro; si el ejercicio también está en correctivos.json, UCorpusDatos junta las piezas de los dos */
    for (const e of ((PO.M.ejercicios || {}).lista || [])) (e.variantes || []).forEach((v, vi) => { if (!usaCadera(v)) return;
      const gs = v.frames.map((_, k) => k * e.paso), M = { rom: 'ej:' + e.id, mov: vi, lado: 'R', cuadros: gs.length, piezas: {} };
      for (const PR of PRs) M.piezas[PR.clave] = cuadros(PR, M.rom, v.id, gs);
      movs.push(M); console.log('  ejercicio %s/%s: %d cuadros, los dos lados · %d s', e.id, v.id, gs.length, Math.round((Date.now() - t0) / 1000)); });
    fs.writeFileSync(path.join(dir, 'correctivos_cadera.bin'), Buffer.concat(partes));
    fs.writeFileSync(path.join(dir, 'correctivos_cadera.json'), JSON.stringify({ version: 1, ancho: ANCHO, texeles: base, escala: ESCALA, fuente: 'tools/unreal/correctivos_cadera.js', piezas, movs }));
    console.log('correctivos_cadera.json + .bin (%s MB, %d piezas, %d movimientos) en %s', (pos / 1048576).toFixed(1), PRs.length, movs.length, dir); }
  else console.log('uso: node tools/unreal/correctivos_cadera.js anclas|medir|hornear …');
}
