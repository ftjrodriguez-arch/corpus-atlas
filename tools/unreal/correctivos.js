#!/usr/bin/env node
/* Corpus Atlas → Unreal: correctivos por postura de los músculos del hombro.

   El reparto de pesos (movimiento.js) no da para todos los movimientos: al encoger el hombro el dorsal se rasga, en la
   rotación externa el pectoral se retuerce… Aquí cada músculo se resuelve como un cuerpo elástico:
     · Rejilla: una caja de nodos alrededor del músculo (celdas de 1,5–3 cm). El músculo se mueve con la rejilla
       (interpolación trilineal de la posición de reposo), así que el resultado es continuo por construcción: los
       fascículos sueltos de la malla no pueden separarse ni cruzarse, y Nanite no lo estropea al simplificar.
     · Anclajes: los vértices del músculo que tocan sus áreas de origen e inserción (capa «insercion» del atlas) siguen
       rígidamente al hueso más cercano, colocado con las posturas de movimiento.json.
     · Entre los anclajes, la rejilla se deforma lo más rígidamente posible (ARAP por celdas): el estiramiento y el giro
       se reparten por todo el vientre.
     · No atraviesa los huesos: contorno de la parrilla costal (torax.js) y distancia con signo a húmero, escápula y
       clavícula; cada punto conserva, como mínimo, la holgura que tenía en reposo (hasta 2,5 mm).
     · No atraviesa los músculos de debajo: cada superficial (dorsal, pectoral mayor, trapecio, deltoides) conserva su
       holgura de reposo con sus profundos vecinos (correctivos_capas.json), medida hacia fuera del tórax o desde la cabeza
       del húmero. Los profundos se resuelven antes y se toman con su correctivo (o con sus pesos si no lo tienen).
   Salida (node tools/unreal/correctivos.js hornear): Importar/datos/correctivos.json + correctivos.bin, que Unreal
   reproduce en el material (la rejilla de cada músculo en una textura; ACorpusCuerpo interpola entre posturas).

   Uso:  node tools/unreal/correctivos.js anclas [hombre|mujer] [R|L]          lista los anclajes de cada músculo
         node tools/unreal/correctivos.js prueba <id> <rom> <mov> <R|L> <grados>   resuelve uno y dice cuánto corrige
         node tools/unreal/correctivos.js hornear [hombre,mujer]                todo, para Unreal
   Como módulo lo usa blender/posar.js (variable CORR=1) para ver el resultado en Blender. */
'use strict';
const fs = require('fs'), path = require('path');
const PO = require('./postura.js');
const TX = PO.TX, TC = PO.TC;

/* músculos con correctivo (nombre en inglés del catálogo) y movimientos en los que se aplica */
const MUSCULOS = /^((Ascending|Descending|Transverse) part of trapezius muscle|Levator scapulae|Rhomboid (major|minor) muscle|Latissimus dorsi muscle|(Clavicular head|Sternocostal head|Abdominal part) of pectoralis major muscle|Pectoralis minor muscle|Subclavius muscle|Serratus anterior muscle|(Acromial|Clavicular|Scapular spinal) part of deltoid muscle|Subscapularis muscle|Supraspinatus muscle|Infraspinatus muscle|Teres (minor|major) muscle|(Long|Short) head of biceps brachii|Coracobrachialis muscle|Long head of triceps brachii)$/;
const ROMS = ['hombro', 'escapula'];
const HUESOS_SDF = /^(Humerus|Scapula|Clavicle)$/;
const MARGEN = 0.0025;
/* capas entre músculos y extremos sin área de inserción en el atlas: datos en correctivos_capas.json */
const CAPAS = JSON.parse(fs.readFileSync(path.join(__dirname, 'correctivos_capas.json'), 'utf8')), CT = CAPAS.contacto;
const EXTREMOS = CAPAS.extremos.map(e => [new RegExp(e.musculo), new RegExp(e.hueso), e.distancia, e.soloAbajo || 0]);
const GRUPOS = CAPAS.capas.map(c => ({ sup: new RegExp(c.superficial), prof: new RegExp(c.profundos), forma: c.forma, hr: c.huesoRadial ? new RegExp(c.huesoRadial) : null }));
const esProfundo = en => GRUPOS.some(g => g.prof.test(en));
/* CORPUS_CAPAS=0 apaga el contacto entre músculos (para medir antes y después); CORPUS_CAPAS_PESOS=1 toma los profundos
   solo con sus pesos aunque tengan correctivo resuelto */
const OPC = { capas: process.env.CORPUS_CAPAS !== '0', pesos: process.env.CORPUS_CAPAS_PESOS === '1' };

/* ───────── utilidades ───────── */
const clave = (x, y, z, c) => Math.floor(x / c) + ',' + Math.floor(y / c) + ',' + Math.floor(z / c);
function rejillaPuntos(c) { return { c, H: new Map() }; }
function mete(G, x, y, z, dato) { const k = clave(x, y, z, G.c); let l = G.H.get(k); if (!l) G.H.set(k, l = []); l.push(x, y, z, dato); }
/* punto más cercano a menos de r (r ≤ tamaño de celda) */
function cerca(G, x, y, z, r) {
  const c = G.c, fx = Math.floor(x / c), fy = Math.floor(y / c), fz = Math.floor(z / c); let bd = r * r, b = -1;
  for (let a = -1; a <= 1; a++) for (let e = -1; e <= 1; e++) for (let f = -1; f <= 1; f++) { const l = G.H.get((fx + a) + ',' + (fy + e) + ',' + (fz + f)); if (!l) continue;
    for (let t = 0; t < l.length; t += 4) { const d = (l[t] - x) ** 2 + (l[t + 1] - y) ** 2 + (l[t + 2] - z) ** 2; if (d < bd) { bd = d; b = l[t + 3]; } } }
  return b < 0 ? null : [b, Math.sqrt(bd)];
}
const LD = S => S === 'R' ? 'derecho' : 'izquierdo';
const nucleo = en => en.toLowerCase().replace(/ muscle$/, '');

/* piezas de una capa. La mujer solo trae las piezas que cambian (pelvis, brazo…): el resto son las del hombre */
function piezasDe(cuerpo, sistema) {
  const L = [], propias = new Set();
  for (const c of cuerpo === 'hombre' ? ['hombre'] : [cuerpo, 'hombre']) { let C; try { C = PO.capa(c + '/' + sistema); } catch (e) { continue; }
    for (const nd of C.g.nodes) { if (nd.mesh === undefined || propias.has(nd.name)) continue; const pz = PO.pieza(c + '/' + sistema, nd.name); if (!pz) continue; pz.capa = c + '/' + sistema; if (c === cuerpo) propias.add(nd.name); L.push(pz); } }
  return L;
}
/* ───────── huesos: puntos para anclar y campos de distancia ───────── */
const _H = {};
function huesos(cuerpo) {
  if (_H[cuerpo]) return _H[cuerpo];
  const capa = cuerpo + '/oseo', pzs = [], G = rejillaPuntos(0.015);
  for (const pz of piezasDe(cuerpo, 'oseo')) { const pi = pzs.length; pzs.push(pz);
    const visto = new Set();
    for (let i = 0; i < pz.nv; i++) { const x = pz.P[i * 3], y = pz.P[i * 3 + 1], z = pz.P[i * 3 + 2], k = clave(x, y, z, 0.003); if (visto.has(k)) continue; visto.add(k); mete(G, x, y, z, pi * 4194304 + i); } }
  return _H[cuerpo] = { capa, pzs, G };
}
const pesosDe = (pz, i) => [pz.U[0][i * 2], pz.U[0][i * 2 + 1], pz.U[1][i * 2], pz.U[1][i * 2 + 1], pz.U[2][i * 2], pz.U[2][i * 2 + 1], pz.U[3][i * 2], pz.U[3][i * 2 + 1], 0];
/* transformación rígida de un hueso en una postura: p → R·p + t (R por columnas) */
function rigido(pz, J) { const ws = pesosDe(pz, 0), f = p => PO.vertice(pz, J, p, ws, { abrazo: false }); const o = f([0, 0, 0]), ex = f([1, 0, 0]), ey = f([0, 1, 0]), ez = f([0, 0, 1]);
  return { R: [ex[0] - o[0], ex[1] - o[1], ex[2] - o[2], ey[0] - o[0], ey[1] - o[1], ey[2] - o[2], ez[0] - o[0], ez[1] - o[1], ez[2] - o[2]], t: o }; }
/* distancia con signo a un hueso en una rejilla de 3 mm (signo por la normal del vértice más cercano) */
const _SDF = {};
function sdf(cuerpo, pz) {
  const kk = cuerpo + '/' + pz.id; if (_SDF[kk]) return _SDF[kk];
  const C = PO.capa(pz.capa || cuerpo + '/oseo'), pr = C.g.meshes[C.porId[pz.id].mesh].primitives[0], N = pr.attributes.NORMAL !== undefined ? C.acc(pr.attributes.NORMAL) : null;
  const h = 0.003, RAD = 0.024, b0 = [1e9, 1e9, 1e9], b1 = [-1e9, -1e9, -1e9];
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
/* distancia y gradiente (en el espacio de reposo del hueso) */
function sdfEn(S, p, g) {
  const fx = (p[0] - S.o[0]) / S.h, fy = (p[1] - S.o[1]) / S.h, fz = (p[2] - S.o[2]) / S.h, n = S.n;
  if (fx < 1 || fy < 1 || fz < 1 || fx > n[0] - 2 || fy > n[1] - 2 || fz > n[2] - 2) return S.RAD;
  const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz), tx = fx - ix, ty = fy - iy, tz = fz - iz, D = S.D, q = ix + n[0] * (iy + n[1] * iz), sy = n[0], sz = n[0] * n[1];
  const c000 = D[q], c100 = D[q + 1], c010 = D[q + sy], c110 = D[q + sy + 1], c001 = D[q + sz], c101 = D[q + sz + 1], c011 = D[q + sz + sy], c111 = D[q + sz + sy + 1];
  const x00 = c000 + (c100 - c000) * tx, x10 = c010 + (c110 - c010) * tx, x01 = c001 + (c101 - c001) * tx, x11 = c011 + (c111 - c011) * tx, y0 = x00 + (x10 - x00) * ty, y1 = x01 + (x11 - x01) * ty;
  if (g) { g[0] = ((c100 - c000) * (1 - ty) + (c110 - c010) * ty) * (1 - tz) + ((c101 - c001) * (1 - ty) + (c111 - c011) * ty) * tz; g[1] = (x10 - x00) * (1 - tz) + (x11 - x01) * tz; g[2] = y1 - y0;
    const l = Math.hypot(g[0], g[1], g[2]) || 1; g[0] /= l; g[1] /= l; g[2] /= l; }
  return y0 + (y1 - y0) * tz;
}

/* ───────── anclajes de un músculo ───────── */
const _INS = {};
function parches(cuerpo, S) {
  const kk = cuerpo + S; if (_INS[kk]) return _INS[kk];
  return _INS[kk] = piezasDe(cuerpo, 'insercion').filter(pz => !pz.lado || pz.lado === LD(S));
}
function anclajes(cuerpo, mus, S) {
  const H = huesos(cuerpo), nm = nucleo(mus.en), G = rejillaPuntos(0.006);
  /* cada punto del área de inserción pertenece al hueso sobre el que está dibujada */
  for (const pa of parches(cuerpo, S)) { const np = nucleo(pa.en); if (np !== nm && !(nm.endsWith(' ' + np) || nm.includes(' of ' + np))) continue;
    for (let i = 0; i < pa.nv; i++) { const hb = cerca(H.G, pa.P[i * 3], pa.P[i * 3 + 1], pa.P[i * 3 + 2], 0.012); if (hb) mete(G, pa.P[i * 3], pa.P[i * 3 + 1], pa.P[i * 3 + 2], hb[0]); } }
  const ins = ((PO.M.insercion || {})[cuerpo] || {})[mus.id] || null, LAT = /^Latissimus/.test(mus.en), linea = /trapezius|Rhomboid|Latissimus|pectoralis major/.test(mus.en);
  /* extremos sin área dibujada en el atlas (correctivos_capas.json → extremos): [músculo, hueso, distancia al hueso, solo los últimos cm por abajo] */
  const EXTRA = EXTREMOS.filter(e => e[0].test(mus.en));
  let ymin = 1e9; for (let i = 0; i < mus.nv; i++) if (mus.P[i * 3 + 1] < ymin) ymin = mus.P[i * 3 + 1];
  const HX = EXTRA.map(e => { const g = rejillaPuntos(Math.max(0.015, e[2])); H.pzs.forEach((pz, pi) => { if (!e[1].test(pz.en) || (pz.lado && pz.lado !== LD(S))) return; const vs = new Set();
    for (let i = 0; i < pz.nv; i++) { const k = clave(pz.P[i * 3], pz.P[i * 3 + 1], pz.P[i * 3 + 2], 0.003); if (vs.has(k)) continue; vs.add(k); mete(g, pz.P[i * 3], pz.P[i * 3 + 1], pz.P[i * 3 + 2], pi * 4194304 + i); } }); return g; });
  const A = [], visto = new Set(), porHueso = {};
  for (let i = 0; i < mus.nv; i++) { const x = mus.P[i * 3], y = mus.P[i * 3 + 1], z = mus.P[i * 3 + 2], kv = clave(x, y, z, 0.003); if (visto.has(kv)) continue;
    const pa = cerca(G, x, y, z, 0.006); let si = !!pa, solo = null, b = pa ? [pa[0], 0] : null, tr = false;
    if (!si) EXTRA.forEach((e, n) => { if (si || (e[3] && y > ymin + e[3])) return; const hb = cerca(HX[n], x, y, z, e[2]); if (hb) { si = true; b = hb; } });
    if (!si && ins && Math.hypot(x - ins[0], y - ins[1], z - ins[2]) < 0.02) { si = true; solo = /^Humerus$/; }       /* tendón de inserción en el húmero (dorsal y pectoral) */
    if (!si && linea && Math.abs(x) < 0.02) { si = true; solo = /^(Vertebra|Sacrum|Sternum|Manubrium|Body of sternum|Xiphoid|Occipital)/; }   /* origen en la línea media */
    if (!si && LAT && y < 1.0) { si = true; solo = /^(Hip bone|Sacrum|Vertebra L)/; }                                    /* cresta ilíaca y fascia toracolumbar */
    if (!si) continue; visto.add(kv);
    if (!b) { b = cerca(H.G, x, y, z, 0.015); if (b && solo && !solo.test(H.pzs[Math.floor(b[0] / 4194304)].en)) b = null; }
    if (!b) { if (solo && !/Humerus/.test(solo.source)) tr = true; else continue; }        /* origen aponeurótico lejos del hueso: se queda con el tronco */
    const pi = tr ? -1 : Math.floor(b[0] / 4194304), vi = tr ? 0 : b[0] % 4194304, nb = tr ? 'tronco' : H.pzs[pi].en;
    if (LAT && nb === 'Scapula') continue;      /* el dorsal resbala sobre el ángulo inferior de la escápula: no va cosido a él */
    porHueso[nb] = (porHueso[nb] || 0) + 1; A.push({ v: i, pi, vi }); }
  return { A, porHueso };
}

/* ───────── contacto entre músculos ─────────
   Cada músculo superficial (correctivos_capas.json → capas) no puede quedar por dentro de sus profundos vecinos más de lo
   que estaba en reposo. Se mide en una dirección «hacia fuera» fija por cuadro: radio alrededor del eje del tórax (forma
   «tronco») o desde la cabeza del húmero («hombro»). Los profundos se toman como se ven en Unreal: con su correctivo si
   ya está resuelto en este movimiento (se resuelven antes) o solo con sus pesos (postura.js). */
/* celda de un punto y su radio (en F.r) */
function celdaCapa(F, x, y, z) {
  if (F.forma === 'tronco') { const h = Math.floor((y - F.y0) / CT.alto); F.r = 0; if (h < 0 || h >= F.nh) return -1; const dz = z - TC.zc; F.r = Math.hypot(x, dz);
    return h * CT.sectores + Math.floor(((Math.atan2(dz, x) + Math.PI) / (2 * Math.PI)) * CT.sectores) % CT.sectores; }
  const dx = x - F.c[0], dy = y - F.c[1], dz = z - F.c[2], ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz), G = CT.cubo; F.r = Math.hypot(dx, dy, dz); if (F.r < 1e-6) return -1;
  let cara, u, v, m;
  if (ax >= ay && ax >= az) { cara = dx > 0 ? 0 : 1; u = dy; v = dz; m = ax; } else if (ay >= az) { cara = dy > 0 ? 2 : 3; u = dx; v = dz; m = ay; } else { cara = dz > 0 ? 4 : 5; u = dx; v = dy; m = az; }
  const a = Math.min(G - 1, Math.floor((u / m + 1) / 2 * G)), b = Math.min(G - 1, Math.floor((v / m + 1) / 2 * G));
  return (cara * G + a) * G + b;
}
/* mapa de celdas → radios de los puntos (pts: x, y, z seguidos) */
function mapaCapa(forma, c, pts) {
  const F = forma === 'tronco' ? { forma, y0: CT.y[0], nh: Math.ceil((CT.y[1] - CT.y[0]) / CT.alto) } : { forma, c };
  const n = forma === 'tronco' ? F.nh * CT.sectores : 6 * CT.cubo * CT.cubo, np = pts.length / 3, cel = new Int32Array(np), rr = new Float32Array(np), ini = new Int32Array(n + 1);
  for (let i = 0; i < np; i++) { const k = celdaCapa(F, pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); cel[i] = k; rr[i] = F.r; if (k >= 0) ini[k + 1]++; }
  for (let k = 0; k < n; k++) ini[k + 1] += ini[k];
  const val = new Float32Array(ini[n]), pos = ini.slice(0, n);
  for (let i = 0; i < np; i++) if (cel[i] >= 0) val[pos[cel[i]]++] = rr[i];
  F.ini = ini; F.val = val; return F;
}
/* radio máximo de los profundos en la celda k sin pasar de r + ven (-1 si no hay ninguno) */
function techo(F, k, r, ven) { let m = -1; for (let q = F.ini[k], e = F.ini[k + 1]; q < e; q++) { const v = F.val[q]; if (v <= r + ven && v > m) m = v; } return m; }
/* centro de la cabeza del húmero en una postura */
function centroHombro(cap, J) { const T = rigido(cap.hz, J), A = cap.c0, R = T.R; return [0, 1, 2].map(i => R[i] * A[0] + R[3 + i] * A[1] + R[6 + i] * A[2] + T.t[i]); }
/* piezas musculares que son profundas de algún grupo (la mujer: las suyas y, si no las tiene, las del hombre) */
const _MUS = {};
function profundosDe(cuerpo) {
  if (_MUS[cuerpo]) return _MUS[cuerpo]; const L = [], propias = new Set();
  for (const c of cuerpo === 'hombre' ? ['hombre'] : [cuerpo, 'hombre']) { let C; try { C = PO.capa(c + '/muscular'); } catch (e) { continue; }
    for (const nd of C.g.nodes) { if (nd.mesh === undefined || propias.has(nd.name) || !esProfundo((nd.extras || {}).en || '')) continue; const pz = PO.pieza(c + '/muscular', nd.name); if (!pz) continue;
      pz.capa = c + '/muscular'; if (c === cuerpo) propias.add(nd.name); L.push(pz); } }
  return _MUS[cuerpo] = L;
}
/* puntos de un profundo: un vértice cada CT.muestra */
const _PROF = {};
function muestrasProf(pz) {
  const kk = pz.capa.split('/')[0] + '/' + pz.id; if (_PROF[kk]) return _PROF[kk]; const L = [], vs = new Set();
  for (let i = 0; i < pz.nv; i++) { const k = clave(pz.P[i * 3], pz.P[i * 3 + 1], pz.P[i * 3 + 2], CT.muestra); if (vs.has(k)) continue; vs.add(k); L.push(i); }
  const P0 = new Float32Array(L.length * 3); L.forEach((i, n) => { P0[n * 3] = pz.P[i * 3]; P0[n * 3 + 1] = pz.P[i * 3 + 1]; P0[n * 3 + 2] = pz.P[i * 3 + 2]; });
  return _PROF[kk] = { pz, clave: kk, idx: Int32Array.from(L), P0 };
}
/* ¿ninguna de las articulaciones de la pieza se mueve en esta postura? (entonces está en reposo) */
function quieto(pz, J) {
  for (let k = 0; k < 9; k++) { const jv = pz.js[k]; if (jv === 0) break; let code = Math.round(Math.abs(jv)); if (code === 31) continue;
    for (let t = 0; t < 3; t++) { const j = (code & 31) - 1; code >>= 5; if (j < 0) break; const o = J[j]; if (o.a || o.t[0] || o.t[1] || o.t[2]) return false; } }
  return true;
}
/* correctivos ya resueltos en el movimiento en curso («cuerpo/id» → {rom, mi, S, grs, X por cuadro, PR}) */
const RES = new Map();
const _POS = new Map(); let _POSk = '';
function posProf(D, rom, mi, S, gr, J) {
  const km = rom + '|' + mi + '|' + S; if (km !== _POSk) { _POS.clear(); _POSk = km; }
  const k = D.clave + '|' + gr, R = OPC.pesos ? null : RES.get(D.clave) || null, hit = _POS.get(k); if (hit && hit.R === R) return hit.P; let P = null;
  if (R && R.rom === rom && R.mi === mi && R.S === S) { const f = R.grs.indexOf(gr);
    if (f >= 0) { const X = R.X[f], RJ = R.PR.RJ, pz = D.pz; if (D.triDe !== R.PR) { D.tri = Array.from(D.idx, i => RJ.tri(pz.P[i * 3], pz.P[i * 3 + 1], pz.P[i * 3 + 2])); D.triDe = R.PR; }
      P = new Float32Array(D.idx.length * 3);
      D.tri.forEach((t, n) => { let a = 0, b = 0, c = 0; for (let q = 0; q < 8; q++) { const w = t.W[q], o = t.I[q] * 3; a += w * X[o]; b += w * X[o + 1]; c += w * X[o + 2]; } P[n * 3] = a; P[n * 3 + 1] = b; P[n * 3 + 2] = c; }); } }
  if (!P) { if (quieto(D.pz, J)) P = D.P0;
    else { P = new Float32Array(D.idx.length * 3); D.idx.forEach((i, n) => P.set(PO.vertice(D.pz, J, [D.pz.P[i * 3], D.pz.P[i * 3 + 1], D.pz.P[i * 3 + 2]], pesosDe(D.pz, i)), n * 3)); } }
  _POS.set(k, { P, R }); return P;
}
/* mapa de los profundos de un músculo en una postura */
function mapaProf(cap, rom, mi, S, gr, J) {
  const Ps = cap.prof.map(D => posProf(D, rom, mi, S, gr, J)), pts = new Float32Array(Ps.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of Ps) { pts.set(p, o); o += p.length; }
  return mapaCapa(cap.forma, cap.forma === 'hombro' ? centroHombro(cap, J) : null, pts);
}

/* ───────── rejilla ───────── */
function rejilla(mus) {
  const b0 = [1e9, 1e9, 1e9], b1 = [-1e9, -1e9, -1e9];
  for (let i = 0; i < mus.nv; i++) for (let k = 0; k < 3; k++) { const v = mus.P[i * 3 + k]; if (v < b0[k]) b0[k] = v; if (v > b1[k]) b1[k] = v; }
  const pad = 0.004, o = b0.map(v => v - pad), tam = b1.map((v, k) => v + pad - o[k]);
  let h = 0.015; const dims = hh => tam.map(t => Math.max(2, Math.ceil(t / hh) + 1));
  while (dims(h).reduce((a, c) => a * c, 1) > 4096) h *= 1.08;
  const n = dims(h), nn = n[0] * n[1] * n[2], cel = new Uint8Array((n[0] - 1) * (n[1] - 1) * (n[2] - 1)), ci = (a, e, f) => a + (n[0] - 1) * (e + (n[1] - 1) * f);
  for (let i = 0; i < mus.nv; i++) { const a = Math.min(n[0] - 2, Math.floor((mus.P[i * 3] - o[0]) / h)), e = Math.min(n[1] - 2, Math.floor((mus.P[i * 3 + 1] - o[1]) / h)), f = Math.min(n[2] - 2, Math.floor((mus.P[i * 3 + 2] - o[2]) / h)); cel[ci(a, e, f)] = 1; }
  const ni = (a, e, f) => a + n[0] * (e + n[1] * f), act = new Int32Array(nn).fill(-1), nodos = [], celdas = [], celI = new Int32Array(cel.length).fill(-1);
  const celDe = (x, y, z) => celI[ci(Math.min(n[0] - 2, Math.floor((x - o[0]) / h)), Math.min(n[1] - 2, Math.floor((y - o[1]) / h)), Math.min(n[2] - 2, Math.floor((z - o[2]) / h)))];
  for (let f = 0; f < n[2] - 1; f++) for (let e = 0; e < n[1] - 1; e++) for (let a = 0; a < n[0] - 1; a++) { if (!cel[ci(a, e, f)]) continue; const c8 = []; celI[ci(a, e, f)] = celdas.length;
    for (let k = 0; k < 8; k++) { const q = ni(a + (k & 1), e + ((k >> 1) & 1), f + ((k >> 2) & 1)); if (act[q] < 0) { act[q] = nodos.length; nodos.push(q); } c8.push(act[q]); } celdas.push(c8); }
  const x0 = new Float64Array(nodos.length * 3); nodos.forEach((q, i) => { const a = q % n[0], e = Math.floor(q / n[0]) % n[1], f = Math.floor(q / (n[0] * n[1])); x0[i * 3] = o[0] + a * h; x0[i * 3 + 1] = o[1] + e * h; x0[i * 3 + 2] = o[2] + f * h; });
  /* pesos trilineales de un punto de reposo: 8 nodos activos */
  const tri = (x, y, z) => { const fx = Math.min(n[0] - 1.0001, Math.max(0, (x - o[0]) / h)), fy = Math.min(n[1] - 1.0001, Math.max(0, (y - o[1]) / h)), fz = Math.min(n[2] - 1.0001, Math.max(0, (z - o[2]) / h));
    const a = Math.floor(fx), e = Math.floor(fy), f = Math.floor(fz), tx = fx - a, ty = fy - e, tz = fz - f, I = [], W = [];
    for (let k = 0; k < 8; k++) { const q = act[ni(a + (k & 1), e + ((k >> 1) & 1), f + ((k >> 2) & 1))]; I.push(q); W.push(((k & 1) ? tx : 1 - tx) * (((k >> 1) & 1) ? ty : 1 - ty) * (((k >> 2) & 1) ? tz : 1 - tz)); }
    return { I, W }; };
  return { o, h, n, act, nodos, celdas, celDe, x0, tri, N: nodos.length };
}
/* pares de nodos de cada celda: 12 aristas y 4 diagonales */
const PARES = (() => { const L = []; for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) { const d = a ^ b; if (d === 1 || d === 2 || d === 4 || d === 7) L.push([a, b]); } return L; })();

/* ───────── resolución de un músculo en un movimiento ───────── */
/* giro que mejor explica S (suma de x·Xᵀ): iteración de Müller et al. 2016, partiendo del cuaternión anterior */
function polar(S, q) {
  for (let it = 0; it < 8; it++) {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const r0 = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)], r1 = [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)], r2 = [2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)];
    /* columnas de S: a0, a1, a2 (S[fila*3+col]) */
    const a0 = [S[0], S[3], S[6]], a1 = [S[1], S[4], S[7]], a2 = [S[2], S[5], S[8]];
    const om = [r0[1] * a0[2] - r0[2] * a0[1] + r1[1] * a1[2] - r1[2] * a1[1] + r2[1] * a2[2] - r2[2] * a2[1], r0[2] * a0[0] - r0[0] * a0[2] + r1[2] * a1[0] - r1[0] * a1[2] + r2[2] * a2[0] - r2[0] * a2[2], r0[0] * a0[1] - r0[1] * a0[0] + r1[0] * a1[1] - r1[1] * a1[0] + r2[0] * a2[1] - r2[1] * a2[0]];
    const den = Math.abs(r0[0] * a0[0] + r0[1] * a0[1] + r0[2] * a0[2] + r1[0] * a1[0] + r1[1] * a1[1] + r1[2] * a1[2] + r2[0] * a2[0] + r2[1] * a2[1] + r2[2] * a2[2]) + 1e-12;
    const ox = om[0] / den, oy = om[1] / den, oz = om[2] / den, an = Math.hypot(ox, oy, oz); if (an < 1e-7) break;
    const s = Math.sin(an / 2) / an, c = Math.cos(an / 2), px = ox * s, py = oy * s, pz = oz * s;
    const nx = c * x + px * w + py * z - pz * y, ny = c * y + py * w + pz * x - px * z, nz = c * z + pz * w + px * y - py * x, nw = c * w - px * x - py * y - pz * z, l = Math.hypot(nx, ny, nz, nw);
    q[0] = nx / l; q[1] = ny / l; q[2] = nz / l; q[3] = nw / l;
  }
  return q;
}
function preparar(cuerpo, id, S) {
  const mus = PO.pieza(cuerpo + '/muscular', id); if (!mus) return null;
  const H = huesos(cuerpo), an = anclajes(cuerpo, mus, S), RJ = rejilla(mus), N = RJ.N;
  /* Músculos largos del brazo (bíceps, tríceps, coracobraquial): del tercio proximal hacia abajo van con el húmero
     (en estos movimientos el codo no se mueve); solo el extremo del hombro queda libre para acomodarse. */
  if (/biceps brachii|triceps brachii|Coracobrachialis/.test(mus.en)) { const A = PO.rig['shoulder_' + S], B = PO.rig['elbow_' + S], ab = B.map((v, k) => v - A[k]), L = Math.hypot(...ab), hi = H.pzs.findIndex(p => p.en === 'Humerus' && p.lado === LD(S)), ya = new Set(an.A.map(a => a.v)), visto = new Set();
    for (let i = 0; i < mus.nv; i++) { if (ya.has(i)) continue; const x = mus.P[i * 3], y = mus.P[i * 3 + 1], z = mus.P[i * 3 + 2], t = ((x - A[0]) * ab[0] + (y - A[1]) * ab[1] + (z - A[2]) * ab[2]) / (L * L); if (t < 0.22 || t > 0.9) continue;
      /* fracción del brazo: libre junto al hombro y junto al codo (en las rotaciones el codo va flexionado) */
      const k = clave(x, y, z, 0.004); if (visto.has(k)) continue; visto.add(k); const u = Math.min(1, (t - 0.22) / 0.2, (0.9 - t) / 0.15); an.A.push({ v: i, pi: hi, vi: 0, wa: 0.02 + 0.98 * u * u * (3 - 2 * u), desl: 1 }); an.porHueso.brazo = (an.porHueso.brazo || 0) + 1; } }
  /* dirección de la fibra en cada celda (tangente de la malla): a lo largo de ella el músculo se alarga o se acorta
     sin oponerse (y engorda o adelgaza para conservar el volumen); en las demás direcciones conserva la forma */
  const C = PO.capa(cuerpo + '/muscular'), pr = C.g.meshes[C.porId[id].mesh].primitives[0], T = pr.attributes.TANGENT !== undefined ? C.acc(pr.attributes.TANGENT) : null, fib = new Float64Array(RJ.celdas.length * 3), tot = [0, 0, 0];
  if (T) { for (let i = 0; i < mus.nv; i++) { const c = RJ.celDe(mus.P[i * 3], mus.P[i * 3 + 1], mus.P[i * 3 + 2]); if (c < 0) continue; let tx = T[i * 4], ty = T[i * 4 + 1], tz = T[i * 4 + 2];
      if (tx * tot[0] + ty * tot[1] + tz * tot[2] < 0) { tx = -tx; ty = -ty; tz = -tz; } fib[c * 3] += tx; fib[c * 3 + 1] += ty; fib[c * 3 + 2] += tz; tot[0] += tx; tot[1] += ty; tot[2] += tz; }
    const lt = Math.hypot(...tot) || 1; for (let c = 0; c < RJ.celdas.length; c++) { const l = Math.hypot(fib[c * 3], fib[c * 3 + 1], fib[c * 3 + 2]); if (l > 1e-6) { fib[c * 3] /= l; fib[c * 3 + 1] /= l; fib[c * 3 + 2] /= l; } else { fib[c * 3] = tot[0] / lt; fib[c * 3 + 1] = tot[1] / lt; fib[c * 3 + 2] = tot[2] / lt; } } }
  /* matriz fija: rigidez de las celdas + anclajes */
  const filas = Array.from({ length: N }, () => new Map()), suma = (i, j, v) => { const f = filas[i]; f.set(j, (f.get(j) || 0) + v); };
  for (const c of RJ.celdas) for (const [a, b] of PARES) { const i = c[a], j = c[b]; suma(i, i, 1); suma(j, j, 1); suma(i, j, -1); suma(j, i, -1); }
  const KA = 30, anc = an.A.map(a => Object.assign({ t: RJ.tri(mus.P[a.v * 3], mus.P[a.v * 3 + 1], mus.P[a.v * 3 + 2]) }, a));
  for (const a of anc) { if (a.wa === undefined) a.wa = 1; for (let p = 0; p < 8; p++) for (let q = 0; q < 8; q++) suma(a.t.I[p], a.t.I[q], KA * a.wa * a.t.W[p] * a.t.W[q]); }
  const GA = rejillaPuntos(0.008); for (const a of anc) if (a.wa > 0.5) mete(GA, mus.P[a.v * 3], mus.P[a.v * 3 + 1], mus.P[a.v * 3 + 2], 0);
  /* muestras para las colisiones: un vértice por cada 5 mm */
  const mue = [], visto = new Set(), sdfs = H.pzs.map((pz, pi) => ({ pz, pi })).filter(o => HUESOS_SDF.test(o.pz.en) && o.pz.lado === LD(S)).map(o => Object.assign(o, { S: sdf(cuerpo, o.pz) }));
  const yMax = TC.y0 + TC.dy * (TC.nh - 1);
  /* capas: profundos vecinos (mismo lado) y su mapa en reposo */
  const grp = GRUPOS.find(q => q.sup.test(mus.en)); let capa = null, F0 = null;
  if (grp) { const prof = profundosDe(cuerpo).filter(pz => pz.id !== id && grp.prof.test(pz.en) && (!pz.lado || pz.lado === LD(S))).map(muestrasProf);
    capa = { forma: grp.forma, hr: grp.hr, prof, hz: H.pzs.find(p => p.en === 'Humerus' && p.lado === LD(S)), c0: PO.rig['shoulder_' + S] };
    if (prof.length) { const pts = new Float32Array(prof.reduce((s, D) => s + D.P0.length, 0)); let o = 0; for (const D of prof) { pts.set(D.P0, o); o += D.P0.length; } F0 = mapaCapa(capa.forma, capa.c0, pts); } }
  for (let i = 0; i < mus.nv; i++) { const p = [mus.P[i * 3], mus.P[i * 3 + 1], mus.P[i * 3 + 2]], k = clave(p[0], p[1], p[2], 0.005); if (visto.has(k)) continue; visto.add(k);
    if (cerca(GA, p[0], p[1], p[2], 0.008)) continue;      /* lo anclado va con su hueso, choque o no */
    const k0 = TX.k(TC, p), d0 = sdfs.map(o => Math.min(MARGEN, sdfEn(o.S, p)));
    /* holgura con los profundos en reposo (como d0 con los huesos): si allí un profundo ya queda por fuera, este punto no es
       superficial en esa zona (borde que se mete por debajo, tendón que pasa bajo otro) y no se restringe (hc = null) */
    let hc = null; if (F0) { const kc = celdaCapa(F0, p[0], p[1], p[2]), r0 = F0.r; if (kc >= 0) { const t = techo(F0, kc, r0, CT.busca); hc = t > r0 + CT.encima ? null : t >= 0 ? Math.min(MARGEN, r0 - t) : MARGEN; } }
    mue.push({ p, t: RJ.tri(p[0], p[1], p[2]), kmin: k0 < 1 ? k0 - 0.004 : 1 + (k0 - 1) * 0.6, d0, hc }); }
  return { cuerpo, id, S, mus, H, an, anc, RJ, filas, KA, mue, sdfs, yMax, fib: T ? fib : null, brazo: /biceps brachii|triceps brachii|Coracobrachialis/.test(mus.en),
    capa, profundo: esProfundo(mus.en), claveRes: cuerpo + '/' + id };
}
/* resuelve los cuadros de un movimiento; devuelve por cuadro posiciones de los nodos (Float32Array N·3) y cuaterniones (N·4) */
function resolver(PR, rom, mi, grados) {
  const { mus, H, anc, RJ, filas, KA, mue, sdfs, S, fib } = PR, N = RJ.N, x0 = RJ.x0, NC = RJ.celdas.length, est = new Float64Array(RJ.celdas.length).fill(1), BETA = +(process.env.BETA || 0.85);
  const X = Float64Array.from(x0), qc = new Float64Array(NC * 4); for (let c = 0; c < NC; c++) qc[c * 4 + 3] = 1;
  const KC = 20, fuera = [], diag = new Float64Array(N), B = [new Float64Array(N), new Float64Array(N), new Float64Array(N)];
  const fijos = filas.map(f => { const I = new Int32Array(f.size), V = new Float64Array(f.size); let k = 0; for (const [j, v] of f) { I[k] = j; V[k++] = v; } return { I, V }; });
  const r = new Float64Array(N), z = new Float64Array(N), p = new Float64Array(N), Ap = new Float64Array(N), x = new Float64Array(N);
  let col = [];
  const aplica = (v, out) => { for (let i = 0; i < N; i++) { const f = fijos[i]; let s = 0; for (let k = 0; k < f.I.length; k++) s += f.V[k] * v[f.I[k]]; out[i] = s; }
    for (const c of col) { let s = 0; for (let k = 0; k < 8; k++) s += c.t.W[k] * v[c.t.I[k]]; s *= KC; for (let k = 0; k < 8; k++) out[c.t.I[k]] += c.t.W[k] * s; } };
  const cg = (b, eje, its) => { for (let i = 0; i < N; i++) x[i] = X[i * 3 + eje]; aplica(x, Ap); let rz = 0;
    for (let i = 0; i < N; i++) { r[i] = b[i] - Ap[i]; z[i] = r[i] / diag[i]; p[i] = z[i]; rz += r[i] * z[i]; }
    for (let it = 0; it < its && rz > 1e-18; it++) { aplica(p, Ap); let pa = 0; for (let i = 0; i < N; i++) pa += p[i] * Ap[i]; const al = rz / pa; let rz2 = 0;
      for (let i = 0; i < N; i++) { x[i] += al * p[i]; r[i] -= al * Ap[i]; z[i] = r[i] / diag[i]; rz2 += r[i] * z[i]; } const be = rz2 / rz; rz = rz2; for (let i = 0; i < N; i++) p[i] = z[i] + be * p[i]; }
    for (let i = 0; i < N; i++) X[i * 3 + eje] = x[i]; };
  const en = (t, k) => { let s = 0; for (let q = 0; q < 8; q++) s += t.W[q] * X[t.I[q] * 3 + k]; return s; };
  const g = [0, 0, 0], cuadros = [];
  for (const gr of grados) {
    const J = PO.articulaciones(rom, mi, S, gr);
    /* objetivos de los anclajes: el vértice sigue rígidamente a su hueso */
    const obj = anc.map(a => a.pi < 0 ? [mus.P[a.v * 3], mus.P[a.v * 3 + 1], mus.P[a.v * 3 + 2]] : PO.vertice(H.pzs[a.pi], J, [mus.P[a.v * 3], mus.P[a.v * 3 + 1], mus.P[a.v * 3 + 2]], pesosDe(H.pzs[a.pi], a.vi), { abrazo: false }));
    const RB = sdfs.map(o => rigido(o.pz, J));
    /* 0° es el reposo solo en los rangos: el instante 0 de un ejercicio («ej:») ya es una postura (en el remo, tronco
       inclinado y brazos colgando). Antes se resolvía con una iteración y sin colisiones y el dorsal quedaba con su forma
       de reposo, atravesado por el serrato y el redondo mayor. Ese primer cuadro parte del reposo: más iteraciones. */
    const reposo = gr === 0 && !String(rom).startsWith('ej:'), primero = gr === grados[0];
    const ITS = reposo ? 1 : primero ? 40 : 14;
    /* capas: dónde están los profundos en este cuadro (fijos durante las iteraciones) */
    const cap = OPC.capas && !reposo ? PR.capa : null, FC = cap && cap.prof.length ? mapaProf(cap, rom, mi, S, gr, J) : null, HR = cap && cap.hr ? sdfs.map(o => cap.hr.test(o.pz.en)) : null;
    /* anclajes deslizantes (vientres del brazo): sujetos al húmero de lado, libres a lo largo de él: así el vientre puede
       acortarse cuando se flexiona el codo o se acerca el origen */
    const rig0 = anc.some(a => a.desl) ? obj.map(o => o.slice()) : null; let eje = null;
    if (rig0) { const hz = H.pzs.find(p => p.en === 'Humerus' && p.lado === LD(S)), T = rigido(hz, J), A = PO.rig['shoulder_' + S], Bq = PO.rig['elbow_' + S], d = Bq.map((v, k) => v - A[k]), R = T.R;
      eje = [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]]; const l = Math.hypot(...eje); eje = eje.map(v => v / l); }
    for (let it = 0; it < ITS; it++) {
      if (rig0 && !reposo) anc.forEach((a, n) => { if (!a.desl) return; const r = rig0[n], s = (en(a.t, 0) - r[0]) * eje[0] + (en(a.t, 1) - r[1]) * eje[1] + (en(a.t, 2) - r[2]) * eje[2]; obj[n] = [r[0] + eje[0] * s, r[1] + eje[1] * s, r[2] + eje[2] * s]; });
      /* colisiones con la posición actual */
      col = [];
      if (!reposo) for (const m of mue) { let px = en(m.t, 0), py = en(m.t, 1), pz = en(m.t, 2), toca = false;
        if (!PR.brazo && py > TC.y0 && py < PR.yMax) { const pp = [px, py, pz], k1 = TX.k(TC, pp); if (k1 < m.kmin) { const s = m.kmin / Math.max(k1, 1e-4); px *= s; pz = TC.zc + (pz - TC.zc) * s; toca = true; } }
        for (let b = 0; b < sdfs.length; b++) { const T = RB[b], R = T.R, dx = px - T.t[0], dy = py - T.t[1], dz = pz - T.t[2];
          const loc = [R[0] * dx + R[1] * dy + R[2] * dz, R[3] * dx + R[4] * dy + R[5] * dz, R[6] * dx + R[7] * dy + R[8] * dz], d = sdfEn(sdfs[b].S, loc, g);
          if (d < m.d0[b] - 1e-5) { const e = m.d0[b] - d, gx = R[0] * g[0] + R[3] * g[1] + R[6] * g[2], gy = R[1] * g[0] + R[4] * g[1] + R[7] * g[2], gz = R[2] * g[0] + R[5] * g[1] + R[8] * g[2]; toca = true;
            /* huesoRadial (dorsal sobre la escápula): salir hacia fuera del tórax, no por el gradiente, que junto a la punta del
               ángulo inferior abre en abanico y arruga la lámina */
            const rh = HR && HR[b] ? Math.hypot(px, pz - TC.zc) : 0, ux = rh ? px / rh : 0, uz = rh ? (pz - TC.zc) / rh : 0, gu = gx * ux + gz * uz;
            if (rh > 1e-4 && gu > 0.3) { const s = Math.min(e / gu, 2 * e); px += ux * s; pz += uz * s; }
            else { px += gx * e; py += gy * e; pz += gz * e; } } }
        /* capas: no quedar por dentro de los profundos más que en reposo */
        if (FC && m.hc !== null) { const kc = celdaCapa(FC, px, py, pz);
          if (kc >= 0) { const r = FC.r, t = techo(FC, kc, r, CT.ventana);
            if (t >= 0 && r < t + m.hc - 1e-5) { const s = (t + m.hc) / Math.max(r, 1e-6);
              if (FC.forma === 'tronco') { px *= s; pz = TC.zc + (pz - TC.zc) * s; } else { px = FC.c[0] + (px - FC.c[0]) * s; py = FC.c[1] + (py - FC.c[1]) * s; pz = FC.c[2] + (pz - FC.c[2]) * s; }
              toca = true; } } }
        if (toca) col.push({ t: m.t, o: [px, py, pz] }); }
      /* local: giro de cada celda */
      for (let c = 0; c < NC; c++) { const c8 = RJ.celdas[c], Sm = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (const [a, b] of PARES) { const i = c8[a] * 3, j = c8[b] * 3, ex = x0[i] - x0[j], ey = x0[i + 1] - x0[j + 1], ez = x0[i + 2] - x0[j + 2], dx = X[i] - X[j], dy = X[i + 1] - X[j + 1], dz = X[i + 2] - X[j + 2];
          /* A = Σ d·eᵀ (deformado · reposoᵀ): A[fila*3+col] */
          Sm[0] += dx * ex; Sm[1] += dx * ey; Sm[2] += dx * ez; Sm[3] += dy * ex; Sm[4] += dy * ey; Sm[5] += dy * ez; Sm[6] += dz * ex; Sm[7] += dz * ey; Sm[8] += dz * ez; }
        const q = polar(Sm, qc.subarray(c * 4, c * 4 + 4));
        if (fib) { /* alargamiento a lo largo de la fibra: s = (R·f)ᵀ·A·f / fᵀ·(Σ e·eᵀ)·f */
          const fx = fib[c * 3], fy = fib[c * 3 + 1], fz = fib[c * 3 + 2], ax = Sm[0] * fx + Sm[1] * fy + Sm[2] * fz, ay = Sm[3] * fx + Sm[4] * fy + Sm[5] * fz, az = Sm[6] * fx + Sm[7] * fy + Sm[8] * fz;
          const tx = 2 * (q[1] * fz - q[2] * fy), ty = 2 * (q[2] * fx - q[0] * fz), tz = 2 * (q[0] * fy - q[1] * fx), rx = fx + q[3] * tx + q[1] * tz - q[2] * ty, ry = fy + q[3] * ty + q[2] * tx - q[0] * tz, rz = fz + q[3] * tz + q[0] * ty - q[1] * tx;
          let den = 0; for (const [a, b] of PARES) { const i = c8[a] * 3, j = c8[b] * 3, ef = (x0[i] - x0[j]) * fx + (x0[i + 1] - x0[j + 1]) * fy + (x0[i + 2] - x0[j + 2]) * fz; den += ef * ef; }
          const s = Math.max(0.5, Math.min(1.8, (rx * ax + ry * ay + rz * az) / den)); est[c] = 1 + BETA * (s - 1); } }
      /* global */
      for (let k = 0; k < 3; k++) B[k].fill(0);
      for (let c = 0; c < NC; c++) { const c8 = RJ.celdas[c], qx = qc[c * 4], qy = qc[c * 4 + 1], qz = qc[c * 4 + 2], qw = qc[c * 4 + 3];
        const su = fib ? est[c] : 1, sk = 1 / Math.sqrt(su), fx = fib ? fib[c * 3] : 0, fy = fib ? fib[c * 3 + 1] : 0, fz = fib ? fib[c * 3 + 2] : 0;
        for (const [a, b] of PARES) { const i = c8[a], j = c8[b]; let ex = x0[i * 3] - x0[j * 3], ey = x0[i * 3 + 1] - x0[j * 3 + 1], ez = x0[i * 3 + 2] - x0[j * 3 + 2];
          if (fib) { const ef = ex * fx + ey * fy + ez * fz, m = (su - sk) * ef; ex = sk * ex + m * fx; ey = sk * ey + m * fy; ez = sk * ez + m * fz; }
          const tx = 2 * (qy * ez - qz * ey), ty = 2 * (qz * ex - qx * ez), tz = 2 * (qx * ey - qy * ex), rx = ex + qw * tx + qy * tz - qz * ty, ry = ey + qw * ty + qz * tx - qx * tz, rz = ez + qw * tz + qx * ty - qy * tx;
          B[0][i] += rx; B[0][j] -= rx; B[1][i] += ry; B[1][j] -= ry; B[2][i] += rz; B[2][j] -= rz; } }
      anc.forEach((a, n) => { const o = obj[n]; for (let q = 0; q < 8; q++) { const w = KA * a.wa * a.t.W[q], i = a.t.I[q]; B[0][i] += w * o[0]; B[1][i] += w * o[1]; B[2][i] += w * o[2]; } });
      for (let i = 0; i < N; i++) diag[i] = filas[i].get(i);
      for (const c of col) for (let q = 0; q < 8; q++) { const w = KC * c.t.W[q], i = c.t.I[q]; B[0][i] += w * c.o[0]; B[1][i] += w * c.o[1]; B[2][i] += w * c.o[2]; diag[i] += KC * c.t.W[q] * c.t.W[q]; }
      for (let k = 0; k < 3; k++) cg(B[k], k, 40);
    }
    /* giro por nodo: media de los de sus celdas (para la normal) */
    const Q = new Float32Array(N * 4);
    for (let c = 0; c < NC; c++) { const c8 = RJ.celdas[c]; for (let k = 0; k < 8; k++) { const i = c8[k] * 4; for (let q = 0; q < 4; q++) Q[i + q] += qc[c * 4 + q]; } }
    for (let i = 0; i < N; i++) { const l = Math.hypot(Q[i * 4], Q[i * 4 + 1], Q[i * 4 + 2], Q[i * 4 + 3]) || 1; for (let q = 0; q < 4; q++) Q[i * 4 + q] /= l; }
    cuadros.push({ gr, X: Float32Array.from(X), Q, col: col.length });
  }
  /* los profundos de algún grupo se guardan para que los superficiales del mismo movimiento los vean como en Unreal */
  if (PR.profundo) RES.set(PR.claveRes, { rom, mi, S, grs: grados.slice(), X: cuadros.map(c => c.X), PR });
  return cuadros;
}
/* posiciones de todos los vértices del músculo con la rejilla X */
function aplicar(PR, X) {
  const { mus, RJ } = PR, D = new Float32Array(mus.nv * 3);
  for (let i = 0; i < mus.nv; i++) { const t = RJ.tri(mus.P[i * 3], mus.P[i * 3 + 1], mus.P[i * 3 + 2]); let a = 0, b = 0, c = 0;
    for (let q = 0; q < 8; q++) { const w = t.W[q], n = t.I[q] * 3; a += w * X[n]; b += w * X[n + 1]; c += w * X[n + 2]; } D[i * 3] = a; D[i * 3 + 1] = b; D[i * 3 + 2] = c; }
  return D;
}
function ids(cuerpo, S) { return PO.capa(cuerpo + '/muscular').g.nodes.filter(n => n.mesh !== undefined && MUSCULOS.test((n.extras || {}).en || '') && (n.extras || {}).lado === LD(S)).map(n => n.name); }
/* para el visor: el músculo en una postura, resuelto desde el reposo cada 10° */
const _PR = {};
function deformar(cuerpo, id, rom, mi, S, grados) {
  if (!ROMS.includes(rom)) return null; const k = cuerpo + id; const PR = _PR[k] || (_PR[k] = preparar(cuerpo, id, S)); if (!PR || !MUSCULOS.test(PR.mus.en)) return null;
  const gs = []; for (let g = 0; g < +grados; g += 10) gs.push(g); gs.push(+grados);
  const C = resolver(PR, rom, mi, gs); return aplicar(PR, C[C.length - 1].X);
}
/* medidas de una malla deformada: pliegues (aristas cuyas dos caras se cierran) y vértices dentro de un hueso o del tórax */
function medir(PR, D, J) {
  const { mus, sdfs } = PR, P = mus.P, I = mus.I, nr = (A, a, b, c) => { const ux = A[b * 3] - A[a * 3], uy = A[b * 3 + 1] - A[a * 3 + 1], uz = A[b * 3 + 2] - A[a * 3 + 2], vx = A[c * 3] - A[a * 3], vy = A[c * 3 + 1] - A[a * 3 + 1], vz = A[c * 3 + 2] - A[a * 3 + 2]; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
  if (!PR.ar) { PR.ar = new Map(); for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) { const a = I[t + e], c = I[t + (e + 1) % 3], k = a < c ? a * 4194304 + c : c * 4194304 + a; const l = PR.ar.get(k); if (l) l.push(t); else PR.ar.set(k, [t]); } }
  let plieg = 0; const cs = (a, b) => (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b) + 1e-20);
  for (const ts of PR.ar.values()) { if (ts.length !== 2) continue; const [t0, t1] = ts; if (cs(nr(P, I[t0], I[t0 + 1], I[t0 + 2]), nr(P, I[t1], I[t1 + 1], I[t1 + 2])) > 0.5 && cs(nr(D, I[t0], I[t0 + 1], I[t0 + 2]), nr(D, I[t1], I[t1 + 1], I[t1 + 2])) < -0.3) plieg++; }
  const RB = sdfs.map(o => rigido(o.pz, J)); let dentro = 0, hondo = 0, est = 0;
  for (let i = 0; i < mus.nv; i++) { const p = [D[i * 3], D[i * 3 + 1], D[i * 3 + 2]], p0 = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; let mal = 0;
    if (p[1] > TC.y0 && p[1] < PR.yMax) { const k0 = TX.k(TC, p0), k1 = TX.k(TC, p), e = (Math.min(k0, 1) - k1) * TX.radio(TC, p); if (e > 0.004) mal = Math.max(mal, e); }
    for (let b = 0; b < sdfs.length; b++) { const T = RB[b], R = T.R, dx = p[0] - T.t[0], dy = p[1] - T.t[1], dz = p[2] - T.t[2], d = sdfEn(sdfs[b].S, [R[0] * dx + R[1] * dy + R[2] * dz, R[3] * dx + R[4] * dy + R[5] * dz, R[6] * dx + R[7] * dy + R[8] * dz]), d0 = Math.min(0, sdfEn(sdfs[b].S, p0));
      if (d < d0 - 0.003) mal = Math.max(mal, d0 - d); }
    if (mal) { dentro++; if (mal > hondo) hondo = mal; } }
  /* estiramiento máximo de arista (percentil 99) */
  { const L = []; let n = 0; for (let t = 0; t < I.length; t += 3) { if ((n++ & 3)) continue; const a = I[t], b = I[t + 1], l0 = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]); if (l0 > 1e-5) L.push(Math.hypot(D[a * 3] - D[b * 3], D[a * 3 + 1] - D[b * 3 + 1], D[a * 3 + 2] - D[b * 3 + 2]) / l0); } L.sort((x, y) => x - y); est = L[Math.floor(L.length * 0.99)] || 1; }
  return { plieg, dentro, hondo, est };
}
const POSTURAS = [['flex90', 'hombro', 0, 90], ['flex150', 'hombro', 0, 150], ['ext60', 'hombro', 1, 60], ['abd90', 'hombro', 2, 90], ['abd150', 'hombro', 2, 150], ['adu30', 'hombro', 3, 30], ['rotint70', 'hombro', 4, 70], ['rotext90', 'hombro', 5, 90],
  ['abdhor45', 'hombro', 6, 45], ['aduhor120', 'hombro', 7, 120], ['elev40', 'escapula', 0, 40], ['depr10', 'escapula', 1, 10], ['protr15', 'escapula', 2, 15], ['retr15', 'escapula', 3, 15]];
module.exports = { MUSCULOS, ROMS, medir, POSTURAS, ids, preparar, resolver, aplicar, deformar, anclajes, rejilla, huesos,
  OPC, GRUPOS, celdaCapa, mapaCapa, mapaProf, centroHombro, posProf, profundosDe, muestrasProf };

if (require.main === module) {
  const [orden, ...a] = process.argv.slice(2);
  if (orden === 'anclas') { const cuerpo = a[0] || 'hombre', S = a[1] || 'R';
    for (const id of ids(cuerpo, S)) { const mus = PO.pieza(cuerpo + '/muscular', id), an = anclajes(cuerpo, mus, S), RJ = rejilla(mus);
      console.log('%s %s · %d vértices · rejilla %s (%d nodos, %s mm) · anclajes %d: %s', id, mus.en, mus.nv, RJ.n.join('×'), RJ.N, (RJ.h * 1000).toFixed(0), an.A.length, Object.entries(an.porHueso).map(([k, v]) => k + ' ' + v).join(', ')); } }
  else if (orden === 'medir') { /* material de hoy frente a correctivo, en las 14 posturas: pliegues / vértices dentro de hueso (mm de hondo) / estiramiento p99 */
    const cuerpo = 'hombre', S = a[0] || 'R', solo = a[1] ? a[1].split(',') : null, L = ids(cuerpo, S), PRs = L.map(id => preparar(cuerpo, id, S)).sort((x, y) => (y.profundo ? 1 : 0) - (x.profundo ? 1 : 0)), tot = {};
    for (const [nm, rom, mi, gr] of POSTURAS) { if (solo && !solo.includes(nm)) continue; const J = PO.articulaciones(rom, mi, S, gr), gs = []; for (let g = 0; g < gr; g += 10) gs.push(g); gs.push(gr); const T = [0, 0, 0, 0], peor = [];
      for (const PR of PRs) { const C = resolver(PR, rom, mi, gs), m0 = medir(PR, PO.deformar(PR.mus, J), J), m1 = medir(PR, aplicar(PR, C[C.length - 1].X), J); T[0] += m0.plieg; T[1] += m1.plieg; T[2] += m0.dentro; T[3] += m1.dentro;
        peor.push([m1.plieg + m1.dentro, `${PR.mus.en.replace(/ muscle| part of| head of/g, '').slice(0, 22)} ${m0.plieg}→${m1.plieg} / ${m0.dentro}(${(m0.hondo * 1000).toFixed(0)})→${m1.dentro}(${(m1.hondo * 1000).toFixed(0)}) / ${m0.est.toFixed(2)}→${m1.est.toFixed(2)}`]); }
      peor.sort((x, y) => y[0] - x[0]); console.log('%s: pliegues %d→%d · dentro %d→%d\n    %s', nm.padEnd(9), T[0], T[1], T[2], T[3], peor.slice(0, 5).map(x => x[1]).join('\n    ')); tot.p0 = (tot.p0 || 0) + T[0]; tot.p1 = (tot.p1 || 0) + T[1]; tot.d0 = (tot.d0 || 0) + T[2]; tot.d1 = (tot.d1 || 0) + T[3]; }
    console.log('TOTAL: pliegues %d→%d · dentro %d→%d', tot.p0, tot.p1, tot.d0, tot.d1); }
  else if (orden === 'hornear' || orden === 'hornear-ejercicios') {
    /* hornear-ejercicios [ids separados por comas]: no rehace los rangos; añade (o sustituye) los correctivos de esos
       ejercicios al final de correctivos.json/.bin que ya existen (mismas piezas, mismas rejillas). */
    const SOLO_EJ = orden === 'hornear-ejercicios', LISTA_EJ = SOLO_EJ && a[0] ? a[0].split(',') : null; if (SOLO_EJ) a.length = 0;
    /* correctivos.json: piezas «cuerpo/id» → {base (primer texel en la textura), n, o, h, act (nodos guardados), ai (dónde está su lista en el .bin)}
       y movs [{rom, mov, lado, cuadros, piezas: {«cuerpo/id»: posición en el .bin}}].
       correctivos.bin: listas de nodos (uint32, índice en la rejilla completa) y, por cuadro y nodo, 7 enteros de 16 bits:
       desplazamiento xyz (1/20000 m) y giro xyzw (1/32767). Los nodos vecinos de los activos se rellenan por extrapolación. */
    const cuerpos = (a[0] || 'hombre,mujer').split(','), PASO = 5, partes = [], piezas = {}, movs = []; let base = 1, pos = 0; const t0 = Date.now();
    const dirD = path.join(PO.IMP, 'datos'), VIEJO = SOLO_EJ ? JSON.parse(fs.readFileSync(path.join(dirD, 'correctivos.json'), 'utf8')) : null;
    if (SOLO_EJ) { const bin0 = fs.readFileSync(path.join(dirD, 'correctivos.bin')); partes.push(bin0); pos = bin0.length; }
    const pon = buf => { const o = pos; partes.push(buf); pos += buf.length; const pad = (4 - pos % 4) % 4; if (pad) { partes.push(Buffer.alloc(pad)); pos += pad; } return o; };
    const PRs = [];
    for (const cuerpo of cuerpos) for (const S of ['R', 'L']) for (const id of ids(cuerpo, S)) { const PR = preparar(cuerpo, id, S), RJ = PR.RJ, n = RJ.n, nn = n[0] * n[1] * n[2];
      /* anillo: nodos inactivos junto a alguno activo */
      const anillo = [], vec = []; for (let q = 0; q < nn; q++) { if (RJ.act[q] >= 0) continue; const x = q % n[0], y = Math.floor(q / n[0]) % n[1], z = Math.floor(q / (n[0] * n[1])), l = [];
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy, Z = z + dz; if (X < 0 || Y < 0 || Z < 0 || X >= n[0] || Y >= n[1] || Z >= n[2]) continue; const k = RJ.act[X + n[0] * (Y + n[1] * Z)]; if (k >= 0) l.push(k); }
        if (l.length) { anillo.push(q); vec.push(l); } }
      const lista = Uint32Array.from(RJ.nodos.concat(anillo));
      PR.anillo = vec; PR.clave = cuerpo + '/' + id; PRs.push(PR);
      piezas[PR.clave] = SOLO_EJ ? VIEJO.piezas[PR.clave] : { base, n, o: RJ.o.map(v => Math.round(v * 1e6) / 1e6), h: Math.round(RJ.h * 1e6) / 1e6, act: lista.length, ai: pon(Buffer.from(lista.buffer)), lado: S };
      if (SOLO_EJ && (!piezas[PR.clave] || piezas[PR.clave].act !== lista.length)) throw new Error('la rejilla de ' + PR.clave + ' no coincide con correctivos.json: hay que hornear todo'); base += nn; }
    console.log('%d piezas, %d texeles por mapa', PRs.length, base);
    /* los profundos de las capas se resuelven antes que los superficiales en cada movimiento (no cambia el orden del .bin) */
    const ORDEN = PRs.slice().sort((x, y) => (y.profundo ? 1 : 0) - (x.profundo ? 1 : 0));
    const cuadros = (PR, rom, mi, gs) => { const C = resolver(PR, rom, mi, gs), N = PR.RJ.N, NA = N + PR.anillo.length, buf = new Int16Array(gs.length * NA * 7), prev = new Float32Array(NA * 4); for (let i = 0; i < NA; i++) prev[i * 4 + 3] = 1;
      C.forEach((c, k) => { const x0 = PR.RJ.x0, D = new Float32Array(NA * 3), Q = new Float32Array(NA * 4);
        for (let i = 0; i < N; i++) { D[i * 3] = c.X[i * 3] - x0[i * 3]; D[i * 3 + 1] = c.X[i * 3 + 1] - x0[i * 3 + 1]; D[i * 3 + 2] = c.X[i * 3 + 2] - x0[i * 3 + 2]; for (let q = 0; q < 4; q++) Q[i * 4 + q] = c.Q[i * 4 + q]; }
        PR.anillo.forEach((l, j) => { const i = N + j; for (const v of l) { for (let q = 0; q < 3; q++) D[i * 3 + q] += D[v * 3 + q] / l.length; const sg = (Q[v * 4] * Q[l[0] * 4] + Q[v * 4 + 1] * Q[l[0] * 4 + 1] + Q[v * 4 + 2] * Q[l[0] * 4 + 2] + Q[v * 4 + 3] * Q[l[0] * 4 + 3]) < 0 ? -1 : 1; for (let q = 0; q < 4; q++) Q[i * 4 + q] += sg * Q[v * 4 + q]; } });
        for (let i = 0; i < NA; i++) { let l = Math.hypot(Q[i * 4], Q[i * 4 + 1], Q[i * 4 + 2], Q[i * 4 + 3]) || 1; if (Q[i * 4] * prev[i * 4] + Q[i * 4 + 1] * prev[i * 4 + 1] + Q[i * 4 + 2] * prev[i * 4 + 2] + Q[i * 4 + 3] * prev[i * 4 + 3] < 0) l = -l;   /* mismo signo que en el cuadro anterior */
          const o = (k * NA + i) * 7; for (let q = 0; q < 3; q++) buf[o + q] = Math.max(-32767, Math.min(32767, Math.round(D[i * 3 + q] * 20000)));
          for (let q = 0; q < 4; q++) { const v = Q[i * 4 + q] / l; prev[i * 4 + q] = v; buf[o + 3 + q] = Math.round(v * 32767); } } });
      return pon(Buffer.from(buf.buffer)); };
    if (SOLO_EJ) movs.push(...VIEJO.movs.filter(m => !(m.rom.startsWith('ej:') && (!LISTA_EJ || LISTA_EJ.includes(m.rom.slice(3))))));
    for (const rom of SOLO_EJ ? [] : ROMS) { const R = PO.M.rom.find(r => r.id === rom); R.movs.forEach((mv, mi) => { for (const S of ['R', 'L']) { if (!mv[S]) continue;
      const gs = []; for (let g = 0; g <= mv.max + 1e-6; g += PASO) gs.push(Math.min(g, mv.max)); if (mv.max % PASO) gs.push(mv.max);
      const M = { rom, mov: mi, lado: S, cuadros: gs.length, piezas: {} }; let pl = 0, de = 0;
      for (const PR of ORDEN) { if (PR.S !== S) continue; M.piezas[PR.clave] = cuadros(PR, rom, mi, gs); }
      movs.push(M); console.log('  %s %d %s (%s): %d cuadros · %d s', rom, mi, S, mv.n, gs.length, Math.round((Date.now() - t0) / 1000)); } }); }
    /* ejercicios que mueven el hombro o la cintura escapular (movimiento.json → ejercicios): un correctivo por instante, con
       los músculos de los DOS lados a la vez (rom «ej:<id>», mov = índice de la variante, lado R). Sin esto el dorsal
       ancho volvía a deformarse en la elevación lateral, el press y el remo (Unreal los usaba solo en los rangos). */
    const HOMBRO = new Set(['shoulder_R', 'shoulder_L', 'sc_R', 'sc_L', 'acr_R', 'acr_L'].map(n => PO.arts.indexOf(n)));
    const usaHombro = v => v.frames.some(fr => { for (let k = 0; k < fr.length; k += 8) if (HOMBRO.has(fr[k]) && Math.abs(fr[k + 4]) > 0.05) return true; return false; });
    for (const e of ((PO.M.ejercicios || {}).lista || [])) (e.variantes || []).forEach((v, vi) => { if (!usaHombro(v) || (LISTA_EJ && !LISTA_EJ.includes(e.id))) return;
      const gs = v.frames.map((_, k) => k * e.paso), M = { rom: 'ej:' + e.id, mov: vi, lado: 'R', cuadros: gs.length, piezas: {} };
      for (const PR of ORDEN) M.piezas[PR.clave] = cuadros(PR, M.rom, v.id, gs);
      movs.push(M); console.log('  ejercicio %s/%s: %d cuadros, los dos lados · %d s', e.id, v.id, gs.length, Math.round((Date.now() - t0) / 1000)); });
    const dir = path.join(PO.IMP, 'datos');
    let BIN = Buffer.concat(partes);
    if (SOLO_EJ) { /* compactar: el .bin viejo seguía entero al principio y crecía en cada horneado; se copian solo los tramos
                      a los que apunta el JSON (lista de nodos de cada pieza y cuadros de cada movimiento) */
      const nuevos = [], mover = (o, n) => { const p = nuevos.reduce((s, b) => s + b.length, 0); nuevos.push(BIN.subarray(o, o + n)); const pad = (4 - n % 4) % 4; if (pad) nuevos.push(Buffer.alloc(pad)); return p; };
      for (const k in piezas) piezas[k].ai = mover(piezas[k].ai, piezas[k].act * 4);
      for (const m of movs) for (const k in m.piezas) m.piezas[k] = mover(m.piezas[k], m.cuadros * piezas[k].act * 7 * 2);
      const antes = BIN.length; BIN = Buffer.concat(nuevos); pos = BIN.length; console.log('compactado: %s → %s MB', (antes / 1048576).toFixed(1), (pos / 1048576).toFixed(1)); }
    fs.writeFileSync(path.join(dir, 'correctivos.bin'), BIN);
    fs.writeFileSync(path.join(dir, 'correctivos.json'), JSON.stringify({ version: 1, paso: PASO, ancho: 512, texeles: base, escala: 20000, piezas, movs }));
    console.log('correctivos.json + correctivos.bin (%s MB) en %s', (pos / 1048576).toFixed(1), dir); }
  else if (orden === 'prueba') { const [id, rom, mi, S, gr] = a, t0 = Date.now(), PR = preparar('hombre', id, S), t1 = Date.now();
    const gs = []; for (let g = 0; g < +gr; g += 5) gs.push(g); gs.push(+gr); const C = resolver(PR, rom, +mi, gs), t2 = Date.now();
    const D = aplicar(PR, C[C.length - 1].X), M0 = PO.deformar(PR.mus, PO.articulaciones(rom, mi, S, +gr)); let mx = 0, sm = 0;
    for (let i = 0; i < PR.mus.nv; i++) { const d = Math.hypot(D[i * 3] - M0[i * 3], D[i * 3 + 1] - M0[i * 3 + 1], D[i * 3 + 2] - M0[i * 3 + 2]); sm += d; if (d > mx) mx = d; }
    console.log('%s %s · %s %s %s %s° · preparar %d ms, resolver %d cuadros en %d ms · %d nodos, %d anclajes, %d muestras, %d en contacto · diferencia con el material: media %s mm, máxima %s mm',
      id, PR.mus.en, rom, mi, S, gr, t1 - t0, gs.length, t2 - t1, PR.RJ.N, PR.anc.length, PR.mue.length, C[C.length - 1].col, (sm / PR.mus.nv * 1000).toFixed(1), (mx * 1000).toFixed(1)); }
}
