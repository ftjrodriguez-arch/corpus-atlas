// Corpus Atlas (edición Unreal) — tendones: canal G del color por vértice de la capa muscular (0–255, tendón o aponeurosis).
//
//   node --max-old-space-size=12000 tools/unreal/tendones.js [hombre|mujer]              → mide e informa (unreal/tendones_informe.json)
//   node --max-old-space-size=12000 tools/unreal/tendones.js [hombre|mujer] --restaurar  → devuelve al GLB el canal G de la web
//   node --max-old-space-size=12000 tools/unreal/tendones.js [hombre|mujer] --aplicar    → G = máx(G de la web, regla de tendones)
//
// --restaurar: recalcula solo el color de la capa muscular con las mismas funciones de exportar.js (sin reexportar nada),
//   comprueba pieza por pieza que el número, el orden y la posición de los vértices coinciden con el GLB y, solo entonces,
//   parchea el canal G. Antes guarda en Importar/canal_g/ el canal que había y el original de la web.
// --aplicar: parte SIEMPRE del canal original guardado (se puede repetir sin acumular) y pinta de tendón la unión de cada
//   músculo con sus áreas de origen e inserción (piezas de la capa «insercion» con el mismo nombre y lado), pero solo si esa
//   unión es tendinosa o aponeurótica. Lo decide tools/unreal/tendones_reglas.json: entrada explícita por músculo (cadera,
//   muslo y rodilla, y las excepciones evidentes del resto) y, para los demás, una regla geométrica: si la zona del área
//   cubre una fracción grande de la pieza, el origen es carnoso y no se pinta. No toca los pesos de movimiento (TEXCOORD).
//   Al final aplica las láminas aponeuróticas de tendones_reglas.json → «laminas» (hoy el dorsal ancho, con la función de
//   aponeurosis_dorsal.js) sobre el canal recién pintado y reescribe su copia: ya no hay que ejecutar aponeurosis_dorsal.js
//   después. Después hay que reimportar la capa muscular en Unreal.
//
// Piezas separadas (separar.js, ids <madre>_<n>: intercostales, subcostales, interóseos, lumbricales, rotadores): no están en
//   la web, pero cada vértice suyo es copia exacta de un vértice de la madre, que sigue en el GLB fuera de la escena.
//   --restaurar las empareja con la madre (posición y normal idénticas, desempate por triángulos: `emparejar`) y les da el G
//   de la web de ese vértice; el índice de canal_g incluye «grupos» (pieza → madre). --aplicar les pinta el plan de la madre.
//
// Orden completo (por cuerpo, hombre y mujer):
//   exportar.js → movimiento.js → [cadera.js aplicar] → separar.js aplicar → tendones.js <cuerpo> --restaurar → --aplicar
//   → reimportar la capa muscular. --restaurar hay que repetirlo siempre que cambie la disposición del GLB (reexportar o
//   separar); si no, --aplicar lo avisa («el canal guardado no corresponde a este GLB»).
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const CUERPO = process.argv.slice(2).find(a => !a.startsWith('--')) || 'hombre';
const APLICAR = process.argv.includes('--aplicar'), RESTAURAR = process.argv.includes('--restaurar');
const IMPORTAR = path.join(RAIZ, 'unreal', 'CorpusAtlas', 'Importar');
const IMP = path.join(IMPORTAR, CUERPO), CANAL = path.join(IMPORTAR, 'canal_g');
const RADIO = 0.006, UMBRAL = 128;
const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }, NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/* piezas de un GLB en su orden: posiciones, canal G y dónde está cada G dentro del archivo (para parchearlo) */
function leer(archivo, guardar) {
  const buf = fs.readFileSync(archivo);
  const lj = buf.readUInt32LE(12), js = JSON.parse(buf.slice(20, 20 + lj).toString('utf8')), bin = buf.slice(20 + lj + 8);
  const acc = i => { const a = js.accessors[i], v = js.bufferViews[a.bufferView], T = CT[a.componentType], nc = NC[a.type];
    const off = (v.byteOffset || 0) + (a.byteOffset || 0); const out = new T(a.count * nc);
    const paso = v.byteStride || nc * T.BYTES_PER_ELEMENT, dv = new DataView(bin.buffer, bin.byteOffset + off);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < nc; c++) { const p = k * paso + c * T.BYTES_PER_ELEMENT;
      out[k * nc + c] = T === Float32Array ? dv.getFloat32(p, true) : T === Uint8Array ? dv.getUint8(p) : T === Uint16Array ? dv.getUint16(p, true) : dv.getUint32(p, true); }
    return { arr: out, nc, norm: a.normalized, T }; };
  const piezas = {}, orden = [], grupo = {}, modelado = {};
  for (const n of js.nodes) { if (n.mesh == null) continue; const m = js.meshes[n.mesh], id = n.name || m.name;
    if (n.extras && n.extras.grupo) grupo[id] = n.extras.grupo;   // pieza separada por separar.js: id de su pieza madre
    if (n.extras && n.extras.modelado) modelado[id] = n.extras.modelado;   // malla propia (p. ej. aponeurosis_palmar.js): no es la de la web
    for (const pr of m.primitives) { const P = acc(pr.attributes.POSITION).arr; let G = null;
      if (pr.attributes.COLOR_0 != null) { const c = acc(pr.attributes.COLOR_0), k = c.T === Float32Array ? 255 : c.T === Uint16Array ? 255 / 65535 : 1; G = new Uint8Array(P.length / 3); for (let i = 0; i < G.length; i++) G[i] = Math.round(c.arr[i * c.nc + 1] * k); }
      let gOff = -1, gPaso = 0, cNc = 0;
      if (pr.attributes.COLOR_0 != null) { const a = js.accessors[pr.attributes.COLOR_0], v = js.bufferViews[a.bufferView]; cNc = NC[a.type]; if (a.componentType === 5121) { gOff = 20 + lj + 8 + (v.byteOffset || 0) + (a.byteOffset || 0) + 1; gPaso = v.byteStride || NC[a.type]; } }
      if (!piezas[id]) orden.push(id);
      (piezas[id] = piezas[id] || []).push({ P, G, gOff, gPaso, cNc, pr }); } }
  /* normales e índices solo cuando hacen falta (emparejar piezas separadas con su madre) */
  const normales = p => p.pr.attributes.NORMAL != null ? acc(p.pr.attributes.NORMAL).arr : null;
  const indices = p => p.pr.indices != null ? acc(p.pr.indices).arr : Uint32Array.from({ length: p.P.length / 3 }, (_, i) => i);
  return { piezas, orden, grupo, modelado, normales, indices, buf: guardar ? buf : null };
}

/* Piezas separadas por separar.js (<madre>_<n>): cada vértice de la hija es una copia exacta (mismos bytes de todos los
   atributos) de un vértice de la madre, y cada triángulo de la hija es un triángulo de la madre con sus vértices en el
   mismo orden. Se empareja por posición y normal idénticas (igualdad exacta de Float32, sin tolerancia) y, donde la madre
   tiene vértices repetidos con la misma posición y normal, se decide por los triángulos: solo vale el candidato que forma
   con sus vecinos un triángulo de la madre. Devuelve { mapa (vértice de la hija → vértice de la madre), dudas, tris } o
   { error }. `fuente` = { P, N, I } de la madre; `h` = { P, N, I } de la hija. */
function emparejar(fuente, h) {
  const usaN = !!(fuente.N && h.N);
  const clave = (P, N, i) => P[i * 3] + ',' + P[i * 3 + 1] + ',' + P[i * 3 + 2] + (usaN ? '|' + N[i * 3] + ',' + N[i * 3 + 1] + ',' + N[i * 3 + 2] : '');
  const porClave = new Map(), nm = fuente.P.length / 3, nh = h.P.length / 3;
  for (let i = 0; i < nm; i++) { const k = clave(fuente.P, fuente.N, i), l = porClave.get(k); if (l) l.push(i); else porClave.set(k, [i]); }
  const cand = new Array(nh);
  for (let j = 0; j < nh; j++) { const l = porClave.get(clave(h.P, h.N, j)); if (!l) return { error: `vértice ${j} sin pareja exacta (posición${usaN ? ' y normal' : ''}) en la madre` }; cand[j] = l; }
  const tri = new Map(), Im = fuente.I, Ih = h.I; for (let t = 0; t < Im.length; t += 3) tri.set(Im[t] + ',' + Im[t + 1] + ',' + Im[t + 2], t / 3);
  const ok = new Array(nh).fill(null), tris = new Set();
  for (let t = 0; t < Ih.length; t += 3) {
    const v = [Ih[t], Ih[t + 1], Ih[t + 2]], S = [new Set(), new Set(), new Set()]; let hallado = -1;
    for (const x of cand[v[0]]) for (const y of cand[v[1]]) for (const z of cand[v[2]]) { const q = tri.get(x + ',' + y + ',' + z);
      if (q !== undefined) { S[0].add(x); S[1].add(y); S[2].add(z); hallado = q; } }
    if (hallado < 0) return { error: `triángulo ${t / 3} sin triángulo igual en la madre` };
    tris.add(hallado);
    for (let e = 0; e < 3; e++) ok[v[e]] = ok[v[e]] ? new Set([...ok[v[e]]].filter(x => S[e].has(x))) : S[e];
  }
  const mapa = new Int32Array(nh), dudas = [];
  for (let j = 0; j < nh; j++) { const l = ok[j] ? [...ok[j]] : cand[j];
    if (!l.length) return { error: `vértice ${j}: sus triángulos no coinciden con un mismo vértice de la madre` };
    mapa[j] = l[0]; if (l.length > 1) dudas.push([j, l]); }
  return { mapa, dudas, tris };
}
const fBin = n => path.join(CANAL, CUERPO + '_muscular_' + n + '.bin'), fIdx = path.join(CANAL, CUERPO + '_muscular.json');
/* canal G de todas las piezas, una detrás de otra en el orden del GLB */
function canalDe(M, de) { let n = 0; for (const id of M.orden) for (const p of M.piezas[id]) n += p.P.length / 3;
  const out = new Uint8Array(n); let o = 0; for (const id of M.orden) for (const p of M.piezas[id]) { const m = p.P.length / 3; for (let i = 0; i < m; i++) out[o + i] = de(p, i); o += m; } return out; }
const indice = M => M.orden.map(id => [id, M.piezas[id].reduce((s, p) => s + p.P.length / 3, 0)]);

// ───────── --restaurar: el canal G tal como lo da la web ─────────
if (RESTAURAR) {
  const EX = require('./exportar.js'); EX.SOLO_COLOR = true;
  const t0 = Date.now();
  console.log('leyendo ' + CUERPO + '/muscular.glb…'); const M = leer(path.join(IMP, 'muscular.glb'), true);
  console.log('recalculando el color de la capa muscular con exportar.js (m2, alta resolución y piezas de Blender)…');
  EX.conDraco(dm => { try {
    const P = CUERPO === 'hombre' ? (EX.capaBase(dm, EX.fuentes(dm), 'muscular') || {}).P : EX.capaMujer(dm, 'muscular');
    if (!P || !P.length) throw new Error('exportar.js no da piezas de la capa muscular para ' + CUERPO);
    // comprobación: mismas piezas, mismo número de vértices y mismas posiciones (mismo orden)
    const mal = [], W = {}, hijas = [];
    for (const p of P) W[p.id] = p;
    for (const id of M.orden) { const w = W[id], g = M.piezas[id];
      if (M.modelado[id]) continue;   // malla propia: su canal G es el que trae (no hay vértices de la web con los que comparar)
      if (!w && M.grupo[id]) {   // pieza separada: se comprueba después, contra su madre
        if (g.length !== 1) mal.push(id + ': ' + g.length + ' primitivas en el GLB');
        else if (g[0].gOff < 0) mal.push(id + ': color que no es de 8 bits');
        else if (!W[M.grupo[id]]) mal.push(id + ': su pieza madre ' + M.grupo[id] + ' no está en la web');
        else hijas.push(id);
        continue; }
      if (!w) { mal.push(id + ': no está en la web'); continue; }
      if (g.length !== 1) { mal.push(id + ': ' + g.length + ' primitivas en el GLB'); continue; }
      const a = g[0].P, b = w.pos;
      if (a.length !== b.length) { mal.push(id + ': ' + a.length / 3 + ' vértices en el GLB y ' + b.length / 3 + ' en la web'); continue; }
      if (g[0].gOff < 0) { mal.push(id + ': color que no es de 8 bits'); continue; }
      let d = 0; for (let i = 0; i < a.length; i++) { const e = Math.abs(a[i] - b[i]); if (e > d) d = e; }
      if (d > 2e-6) mal.push(id + ': posiciones distintas (hasta ' + (d * 1000).toFixed(3) + ' mm)'); }
    for (const p of P) if (!M.piezas[p.id]) mal.push(p.id + ': está en la web y no en el GLB');
    const nMod = Object.keys(M.modelado).length; if (nMod) console.log(`piezas modeladas (canal G propio, sin comparar con la web): ${Object.keys(M.modelado).join(', ')}`);
    // piezas separadas (separar.js): cada vértice toma el G de la web del vértice de la madre del que es copia
    const MAPA = {}, porMadre = {}; let nDudas = 0;
    const malos = new Set(mal.map(s => s.split(':')[0]));
    for (const id of hijas) { const madre = M.grupo[id], w = W[madre];
      if (malos.has(madre)) { mal.push(id + ': su pieza madre ' + madre + ' no coincide con la web'); continue; }
      // fuente: la madre tal como sigue en el GLB (fuera de la escena; mismas posiciones y orden que la web, ya comprobado), con
      // sus normales; si separar.js la hubiera quitado del GLB, la malla de la web (posiciones en Float32, sin normales)
      const gm = M.piezas[madre] && M.piezas[madre][0];
      const fuente = gm ? { P: gm.P, N: M.normales(gm), I: M.indices(gm) } : { P: Float32Array.from(w.pos), N: null, I: w.idx };
      const h = M.piezas[id][0], r = emparejar(fuente, { P: h.P, N: fuente.N ? M.normales(h) : null, I: M.indices(h) });
      if (r.error) { mal.push(id + ' (madre ' + madre + '): ' + r.error); continue; }
      // vértices repetidos en la madre que ni los triángulos separan: valen si la web les da el mismo G
      for (const [j, l] of r.dudas) { const gs = new Set(l.map(i => w.col[i * 3 + 1])); if (gs.size > 1) { mal.push(id + ': vértice ' + j + ' ambiguo (' + l.length + ' vértices de la madre con G distinto)'); break; } nDudas++; }
      MAPA[id] = r.mapa;
      const pm = porMadre[madre] = porMadre[madre] || { hijas: 0, v: new Set(), t: new Set(), nv: fuente.P.length / 3, nt: fuente.I.length / 3, repes: 0 };
      pm.hijas++; for (const i of r.mapa) { if (pm.v.has(i)) pm.repes++; pm.v.add(i); } for (const t of r.tris) pm.t.add(t); }
    if (mal.length) { console.log('NO se restaura: el GLB y la web no coinciden en ' + mal.length + ' piezas:\n  ' + mal.slice(0, 30).join('\n  ') +
      '\nHay que reexportar la capa (exportar.js) y rehacer sus pesos (movimiento.js --solo=muscular); si son piezas separadas, repetir separar.js.'); process.exit(2); }
    for (const [madre, pm] of Object.entries(porMadre))
      console.log(`  ${madre} → ${pm.hijas} piezas separadas: ${pm.v.size} de ${pm.nv} vértices y ${pm.t.size} de ${pm.nt} triángulos de la madre` + (pm.repes ? ` · ${pm.repes} vértices compartidos entre piezas` : ''));
    if (hijas.length) console.log(`piezas separadas emparejadas con su madre: ${hijas.length} (vértices repetidos resueltos por igualdad de G: ${nDudas})`);
    fs.mkdirSync(CANAL, { recursive: true });
    const actual = canalDe(M, (p, i) => p.G ? p.G[i] : 0);
    const origen = new Uint8Array(actual.length); { let o = 0; for (const id of M.orden) {
      if (M.modelado[id]) { const p = M.piezas[id][0], n = p.P.length / 3; for (let i = 0; i < n; i++) origen[o + i] = p.G ? p.G[i] : 0; o += n; continue; }
      if (MAPA[id]) { const c = W[M.grupo[id]].col, m = MAPA[id]; for (let i = 0; i < m.length; i++) origen[o + i] = c[m[i] * 3 + 1]; o += m.length; continue; }
      const c = W[id].col, n = c.length / 3; for (let i = 0; i < n; i++) origen[o + i] = c[i * 3 + 1]; o += n; } }
    // lo que había antes de restaurar se guarda una sola vez por disposición del GLB (no se pisa en las repeticiones); si la
    // copia es de otra disposición (antes de separar.js), se aparta con su número de vértices en el nombre en vez de pisarla
    const fAntes = fBin('g_pintado_antes'), nAntes = fs.existsSync(fAntes) ? fs.statSync(fAntes).size : -1;
    if (nAntes >= 0 && nAntes !== actual.length) { const otro = fBin('g_pintado_antes_' + nAntes + 'v');
      if (!fs.existsSync(otro)) fs.renameSync(fAntes, otro); console.log(`copia g_pintado_antes de otra disposición (${nAntes} vértices) → ${path.basename(otro)}`); }
    if (nAntes !== actual.length) fs.writeFileSync(fAntes, actual);
    fs.writeFileSync(fBin('g_original'), origen);
    fs.writeFileSync(fIdx, JSON.stringify({ cuerpo: CUERPO, capa: 'muscular', nota: 'canal G (tendón) por vértice, piezas en el orden del GLB: [id, vértices]. g_original = web (las piezas separadas por separar.js toman el G del vértice de su madre del que son copia: «grupos» = pieza → madre); g_pintado_antes = lo que había en el GLB la primera vez que se restauró con esta disposición.', fecha: new Date().toISOString(), vertices: actual.length, piezas: indice(M), grupos: M.grupo }));
    // R (oclusión), B (cartílago) y A de las piezas separadas: copia exacta del vértice de la madre en el GLB. separar.js copiaba
    // COLOR_0 (8 bits) como si fuera de 16 y lo dejaba desordenado; G lo pone después el bucle de abajo (web)
    let rbaCambian = 0, rbaPiezas = 0;
    for (const id of Object.keys(MAPA)) { const h = M.piezas[id][0], gm = M.piezas[M.grupo[id]] && M.piezas[M.grupo[id]][0], m = MAPA[id];
      if (!gm || gm.gOff < 0 || gm.cNc !== h.cNc) { console.log('aviso: ' + id + ' sin color de la madre en el GLB: R, B y A no se reponen'); continue; }
      rbaPiezas++;
      for (let i = 0; i < m.length; i++) for (let k = 0; k < h.cNc; k++) { if (k === 1) continue;
        const a = h.gOff - 1 + i * h.gPaso + k, b = M.buf[gm.gOff - 1 + m[i] * gm.gPaso + k]; if (M.buf[a] !== b) { rbaCambian++; M.buf[a] = b; } } }
    if (rbaPiezas) console.log(`R, B y A de ${rbaPiezas} piezas separadas copiados de su madre: ${rbaCambian} bytes corregidos`);
    let cambian = 0, o = 0; for (const id of M.orden) { const p = M.piezas[id][0], n = p.P.length / 3; for (let i = 0; i < n; i++) { if (M.buf[p.gOff + i * p.gPaso] !== origen[o + i]) cambian++; M.buf[p.gOff + i * p.gPaso] = origen[o + i]; } o += n; }
    fs.writeFileSync(path.join(IMP, 'muscular.glb'), M.buf);
    let conT = 0; for (let i = 0; i < origen.length; i++) if (origen[i] >= UMBRAL) conT++;
    console.log(`restaurado: ${M.orden.length} piezas, ${actual.length} vértices comprobados uno a uno; ${cambian} vértices vuelven a su valor de la web (${(100 * conT / origen.length).toFixed(1)} % son tendón en la web). Copias en ${path.relative(RAIZ, CANAL)}. ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    process.exit(0);
  } catch (e) { console.error(e); process.exit(1); } });
  return;
}

// ───────── datos comunes ─────────
const cat = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'catalog.json'), 'utf8'));
const fem = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'fem.json'), 'utf8')).cat || [];
const info = {}; for (const r of [...cat, ...fem]) if (!info[r[0]]) info[r[0]] = { en: r[1], es: r[2], sis: r[4], lado: r[5], rol: /^or/i.test(r[6] || '') ? 'origen' : 'insercion' };
let HUESO = {}; try { HUESO = JSON.parse(fs.readFileSync(path.join(IMPORTAR, 'datos', 'inserciones.json'), 'utf8'))[CUERPO] || {}; } catch (e) { console.log('aviso: sin inserciones.json (node tools/unreal/inserciones.js): las reglas «hueso» no se aplican'); }
const REGLAS = JSON.parse(fs.readFileSync(path.join(__dirname, 'tendones_reglas.json'), 'utf8'));
console.log('leyendo inserciones…');
// la mujer solo trae las áreas que cambian; el resto son las del hombre
const INS = leer(path.join(IMP, 'insercion.glb')).piezas;
if (CUERPO !== 'hombre') { const H = leer(path.join(IMPORTAR, 'hombre', 'insercion.glb')).piezas; for (const id of Object.keys(H)) if (!INS[id]) INS[id] = H[id]; }
console.log('leyendo músculos…'); const MG = leer(path.join(IMP, 'muscular.glb'), APLICAR), MUS = MG.piezas, BUF = MG.buf;
// áreas por nombre + lado: cada una con su papel (catálogo) y el hueso sobre el que está (inserciones.json)
const areas = {};
for (const id of Object.keys(INS)) { const c = info[id]; if (!c) continue; const k = c.en + '|' + c.lado;
  (areas[k] = areas[k] || []).push({ id, rol: c.rol, hueso: HUESO[id] && info[HUESO[id]] ? info[HUESO[id]].en : '', P: INS[id].map(p => p.P) }); }
const base = s => s.split(',')[0].trim();
const areasBase = {}; for (const k of Object.keys(areas)) { const [en, lado] = k.split('|'); const kb = base(en) + '|' + lado; (areasBase[kb] = areasBase[kb] || []).push(...areas[k]); }

/* distancia de un punto a un área (rejilla de celda cel) */
function distancia(A, cel) { const H = new Map();
  for (const P of A.P) for (let i = 0; i < P.length; i += 3) { const k = Math.floor(P[i] / cel) + ',' + Math.floor(P[i + 1] / cel) + ',' + Math.floor(P[i + 2] / cel); let l = H.get(k); if (!l) H.set(k, l = []); l.push(P[i], P[i + 1], P[i + 2]); }
  return (x, y, z) => { let m = 1e9; const cx = Math.floor(x / cel), cy = Math.floor(y / cel), cz = Math.floor(z / cel);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) { const l = H.get((cx + a) + ',' + (cy + b) + ',' + (cz + d)); if (!l) continue;
      for (let i = 0; i < l.length; i += 3) { const q = (l[i] - x) ** 2 + (l[i + 1] - y) ** 2 + (l[i + 2] - z) ** 2; if (q < m) m = q; } }
    return Math.sqrt(m); }; }
/* regla de una unión músculo–área: entrada explícita (por hueso o por papel) → patrones → geometría */
const PAT = (REGLAS.patrones || []).map(p => Object.assign({}, p, { rx: new RegExp(p.re, 'i') }));
/* la entrada del músculo y el primer patrón que acierta (cualquiera puede faltar) */
const reglaDe = en => ({ m: (REGLAS.musculos || {})[en] || null, p: PAT.find(p => p.rx.test(en)) || null });
/* «hueso»: las claves son expresiones regulares sobre el nombre en inglés del hueso del área */
const porHueso = (r, hueso) => { if (!r || !r.hueso || !hueso) return null; for (const k of Object.keys(r.hueso)) if (new RegExp(k, 'i').test(hueso)) return r.hueso[k]; return null; };
function tipoDe(en, A, fraccion) {
  const { m, p } = reglaDe(en); let t;
  if ((t = porHueso(m, A.hueso))) return [t, 'músculo·hueso']; if (m && m[A.rol]) return [m[A.rol], 'músculo'];
  if ((t = porHueso(p, A.hueso))) return [t, 'patrón·hueso']; if (p && p[A.rol]) return [p[A.rol], 'patrón'];
  const D = REGLAS.defecto;
  return [fraccion >= D.fraccion_carnosa ? 'carnoso' : fraccion >= D.fraccion_mixta ? 'mixto' : 'tendon', 'geometría'];
}

// ───────── medición y decisión por músculo ─────────
const NO = new RegExp(REGLAS.defecto.sin_extremos, 'i');
const filas = [], planes = {};
for (const id of MG.orden) {
  const c = info[id]; if (!c) continue;
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], nv = 0, cen = [0, 0, 0], nT = 0;
  for (const p of MUS[id]) { for (let i = 0; i < p.P.length; i += 3) for (let k = 0; k < 3; k++) { const v = p.P[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; cen[k] += v; if (k === 2) nv++; }
    if (p.G) for (let i = 0; i < p.G.length; i++) if (p.G[i] >= UMBRAL) nT++; }
  if (!nv) continue; cen = cen.map(v => v / nv);
  const L = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
  const d0 = Math.min(0.02, Math.max(0.003, 0.05 * L));   // zona de tendón: 5 % de la longitud de la pieza, entre 3 y 20 mm
  let A = areas[c.en + '|' + c.lado], modo = 'area';
  if (!A) { A = areasBase[base(c.en) + '|' + c.lado]; modo = 'base'; }
  const f = { id, en: c.en, es: c.es, lado: c.lado, vertices: nv, tendon: +(nT / nv).toFixed(3), modo: A ? modo : 'sin área', uniones: [] };
  const plan = { d0, uniones: [], extremos: null, todo: null };
  const RG = reglaDe(c.en), regla = RG.m || RG.p;
  if (regla && regla.todo) { plan.todo = regla.todo; f.modo = 'todo'; filas.push(f); planes[id] = plan; continue; }   // pieza entera tendinosa
  const cA = [0, 0, 0]; let nA = 0;   // centro de las áreas que tocan la pieza
  if (A) for (const a of A) {
    const dist = distancia(a, 2.2 * d0); let n0 = 0, nR = 0, nRT = 0;
    for (const p of MUS[id]) for (let i = 0; i < p.P.length / 3; i++) { const d = dist(p.P[i * 3], p.P[i * 3 + 1], p.P[i * 3 + 2]); if (d <= d0) n0++; if (d <= RADIO) { nR++; if (p.G && p.G[i] >= UMBRAL) nRT++; } }
    if (!n0 && !nR) continue;   // el área no toca esta pieza (áreas del músculo entero repartidas entre sus partes)
    const fr = n0 / nv, [tipo, por] = tipoDe(c.en, a, fr);
    f.uniones.push({ area: a.id, rol: a.rol, hueso: a.hueso, fraccion: +fr.toFixed(3), tipo, por, junto: nR, juntoTendon: nR ? +(nRT / nR).toFixed(3) : null });
    plan.uniones.push({ dist, tipo });
    for (const P of a.P) for (let i = 0; i < P.length; i += 3) { cA[0] += P[i]; cA[1] += P[i + 1]; cA[2] += P[i + 2]; nA++; }
  }
  /* eje principal de la pieza (iteración de potencias) y sus dos extremos */
  const eje = () => { let C = [0, 0, 0, 0, 0, 0];
    for (const p of MUS[id]) for (let i = 0; i < p.P.length; i += 3) { const x = p.P[i] - cen[0], y = p.P[i + 1] - cen[1], z = p.P[i + 2] - cen[2]; C[0] += x * x; C[1] += x * y; C[2] += x * z; C[3] += y * y; C[4] += y * z; C[5] += z * z; }
    let e = [1, 1, 1]; for (let it = 0; it < 40; it++) { const r = [C[0] * e[0] + C[1] * e[1] + C[2] * e[2], C[1] * e[0] + C[3] * e[1] + C[4] * e[2], C[2] * e[0] + C[4] * e[1] + C[5] * e[2]]; const n = Math.hypot(...r) || 1; e = r.map(v => v / n); }
    const pr = (x, y, z) => (x - cen[0]) * e[0] + (y - cen[1]) * e[1] + (z - cen[2]) * e[2];
    let a = 1e9, b = -1e9; for (const p of MUS[id]) for (let i = 0; i < p.P.length; i += 3) { const s = pr(p.P[i], p.P[i + 1], p.P[i + 2]); if (s < a) a = s; if (s > b) b = s; }
    return { e, pr, a, b }; };
  const extremo = (E, s0, tipo, rol) => { plan.uniones.push({ dist: (x, y, z) => Math.abs(E.pr(x, y, z) - s0), tipo }); f.uniones.push({ area: 'extremo', rol, hueso: '', fraccion: 0, tipo, por: 'extremo sin área', junto: 0, juntoTendon: null }); };
  const pinta = t => t && t !== 'carnoso';
  if (regla && plan.uniones.length && nA) {
    // extremo sin área en el atlas: el opuesto a las áreas que sí hay, si la regla dice que es tendinoso
    const roles = new Set(f.uniones.map(u => u.rol)); let t = regla.extremo || null;
    for (const rol of ['origen', 'insercion']) if (!t && !roles.has(rol) && pinta(regla[rol])) t = regla[rol];
    if (pinta(t)) { const E = eje(), sc = E.pr(cA[0] / nA, cA[1] / nA, cA[2] / nA); extremo(E, Math.abs(E.a - sc) > Math.abs(E.b - sc) ? E.a : E.b, t, roles.has('insercion') && !roles.has('origen') ? 'origen' : 'insercion'); }
  } else if (regla && !plan.uniones.length && regla.insercion_hacia && !regla.sin_extremos) {
    // sin ninguna área: la inserción es el extremo que mira hacia «insercion_hacia»; el otro, el origen
    const lat = c.lado === 'izquierdo' ? 1 : -1, DIR = { abajo: [0, -1, 0], arriba: [0, 1, 0], lateral: [lat, 0, 0], medial: [-lat, 0, 0], delante: [0, 0, 1], detras: [0, 0, -1] }[regla.insercion_hacia] || [0, -1, 0];
    const E = eje(), haciaB = E.e[0] * DIR[0] + E.e[1] * DIR[1] + E.e[2] * DIR[2] > 0;
    if (pinta(regla.insercion)) extremo(E, haciaB ? E.b : E.a, regla.insercion, 'insercion');
    if (pinta(regla.origen)) extremo(E, haciaB ? E.a : E.b, regla.origen, 'origen');
    f.modo = 'regla sin área';
  }
  if (!plan.uniones.length && !NO.test(c.en) && !(regla && regla.sin_extremos)) {
    // sin área: eje principal por iteración de potencias; si la pieza es alargada, sus dos extremos son tendón
    let C = [0, 0, 0, 0, 0, 0];
    for (const p of MUS[id]) for (let i = 0; i < p.P.length; i += 3) { const x = p.P[i] - cen[0], y = p.P[i + 1] - cen[1], z = p.P[i + 2] - cen[2]; C[0] += x * x; C[1] += x * y; C[2] += x * z; C[3] += y * y; C[4] += y * z; C[5] += z * z; }
    let e = [1, 1, 1]; for (let it = 0; it < 40; it++) { const r = [C[0] * e[0] + C[1] * e[1] + C[2] * e[2], C[1] * e[0] + C[3] * e[1] + C[4] * e[2], C[2] * e[0] + C[4] * e[1] + C[5] * e[2]]; const n = Math.hypot(...r) || 1; e = r.map(v => v / n); }
    const l1 = C[0] * e[0] * e[0] + C[3] * e[1] * e[1] + C[5] * e[2] * e[2] + 2 * (C[1] * e[0] * e[1] + C[2] * e[0] * e[2] + C[4] * e[1] * e[2]);
    if (l1 > 3 * (C[0] + C[3] + C[5] - l1)) {
      let a = 1e9, b = -1e9; for (const p of MUS[id]) for (let i = 0; i < p.P.length; i += 3) { const s = (p.P[i] - cen[0]) * e[0] + (p.P[i + 1] - cen[1]) * e[1] + (p.P[i + 2] - cen[2]) * e[2]; if (s < a) a = s; if (s > b) b = s; }
      plan.extremos = (x, y, z) => { const s = (x - cen[0]) * e[0] + (y - cen[1]) * e[1] + (z - cen[2]) * e[2]; return Math.min(s - a, b - s) - d0 * 0.5; };
      f.modo = 'extremos';
    }
  }
  filas.push(f); planes[id] = plan;
}
const U = filas.flatMap(f => f.uniones.map(u => Object.assign({ es: f.es, en: f.en, lado: f.lado }, u)));
const cuenta = k => U.filter(u => u.tipo === k).length;
console.log(`piezas enteras de tendón o aponeurosis: ${filas.filter(f => f.modo === 'todo').map(f => f.en).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`);
console.log(`músculos: ${filas.length} · con áreas: ${filas.filter(f => f.uniones.length).length} · por sus extremos: ${filas.filter(f => f.modo === 'extremos').length} · sin tendón añadido: ${filas.filter(f => !f.uniones.length && f.modo !== 'extremos').length}`);
console.log(`uniones músculo–área: ${U.length} → tendón ${cuenta('tendon')} · aponeurosis ${cuenta('aponeurosis')} · mixta ${cuenta('mixto')} · carnosa ${cuenta('carnoso')}  (por regla explícita ${U.filter(u => u.por !== 'geometría').length}, por geometría ${U.filter(u => u.por === 'geometría').length})`);
if (process.argv.includes('--lista')) for (const f of filas) if (f.lado !== 'izquierdo' && f.uniones.length) console.log(f.en.padEnd(52), f.uniones.map(u => `${u.rol.slice(0, 3)}@${u.hueso || '?'} ${Math.round(u.fraccion * 100)}%→${u.tipo}${u.por === 'geometría' ? '*' : ''}`).join(' | '));

// ───────── --aplicar ─────────
if (APLICAR) {
  if (!fs.existsSync(fBin('g_original')) || !fs.existsSync(fIdx)) { console.log('Falta el canal original guardado: primero  node tools/unreal/tendones.js ' + CUERPO + ' --restaurar'); process.exit(2); }
  const ORI = fs.readFileSync(fBin('g_original')), IDX = JSON.parse(fs.readFileSync(fIdx, 'utf8')).piezas, ahora = indice(MG);
  if (IDX.length !== ahora.length || IDX.some((x, i) => x[0] !== ahora[i][0] || x[1] !== ahora[i][1])) { console.log('El canal guardado no corresponde a este GLB (piezas o vértices distintos): repetir --restaurar.'); process.exit(2); }
  const TIPOS = REGLAS.tipos; let o = 0, subidos = 0, total = 0, blancos = 0;
  // las piezas separadas (separar.js) usan el plan de su madre: mismas posiciones, así que cada vértice recibe lo mismo que
  // recibía dentro del grupo (la madre sigue en el GLB, fuera de la escena, y se mide como antes de separar)
  for (const id of MG.orden) { const plan = planes[id] || planes[MG.grupo[id]];
    for (const p of MUS[id]) { const n = p.P.length / 3;
      for (let i = 0; i < n; i++) { let g = ORI[o + i];
        if (plan && plan.todo) { const v = Math.round(255 * (TIPOS[plan.todo] || TIPOS.tendon).intensidad); if (v > g) g = v; }
        else if (plan) { const x = p.P[i * 3], y = p.P[i * 3 + 1], z = p.P[i * 3 + 2];
          for (const u of plan.uniones) { const T = TIPOS[u.tipo]; if (!T || !T.zona) continue; const a0 = plan.d0 * T.zona, a1 = 2.2 * a0, d = u.dist(x, y, z); if (d >= a1) continue;
            let w = d <= a0 ? 1 : 1 - (d - a0) / (a1 - a0); w = w * w * (3 - 2 * w); const v = Math.round(255 * T.intensidad * w); if (v > g) g = v; }
          if (plan.extremos) { const d = plan.extremos(x, y, z), a0 = plan.d0, a1 = 2.2 * a0; if (d < a1) { let w = d <= a0 ? 1 : 1 - (d - a0) / (a1 - a0); w = w * w * (3 - 2 * w); const v = Math.round(255 * w); if (v > g) g = v; } } }
        if (g !== ORI[o + i]) subidos++; if (g >= UMBRAL) blancos++; total++;
        if (p.gOff >= 0) BUF[p.gOff + i * p.gPaso] = g; }
      o += n; } }
  console.log(`aplicado sobre el canal original: ${subidos} vértices subidos; tendón en el ${(100 * blancos / total).toFixed(1)} % de los vértices de la capa`);
  // láminas aponeuróticas (tendones_reglas.json → «laminas», hoy el dorsal ancho) sobre lo recién pintado, antes de escribir:
  // así aponeurosis_dorsal.js no hace falta a mano y su copia (canal_g/<cuerpo>_dorsal_g_antes.json) queda igual a este canal
  const separadas = MG.orden.filter(id => MG.grupo[id]).length;
  if (separadas) console.log(`piezas separadas con el plan de su madre: ${separadas} (${MG.orden.filter(id => MG.grupo[id] && planes[MG.grupo[id]]).length} con plan)`);
  const LAM = require('./aponeurosis_dorsal.js').aplicarLaminas(BUF, CUERPO, { log: s => console.log('  ' + s) });
  console.log(`láminas aponeuróticas: ${LAM.pintados} vértices (G > 128) en ${LAM.piezas} piezas`);
  fs.writeFileSync(path.join(IMP, 'muscular.glb'), BUF);
  fs.writeFileSync(fBin('g_aplicado'), canalDe({ orden: MG.orden, piezas: MUS }, (p, i) => BUF[p.gOff + i * p.gPaso]));
}
// cuántos músculos llegan en tendón a sus uniones tendinosas (con el GLB tal como estaba al leerlo)
{ const tend = U.filter(u => (u.tipo === 'tendon' || u.tipo === 'aponeurosis') && u.junto > 0), ok = tend.filter(u => u.juntoTendon >= 0.5).length;
  console.log(`uniones tendinosas que ya llegaban en tendón en el GLB leído: ${ok} de ${tend.length}` + (APLICAR ? ' (medido antes de aplicar; repetir sin --aplicar para medir el resultado)' : ''));
  const car = U.filter(u => u.tipo === 'carnoso' && u.junto > 0), bl = car.filter(u => u.juntoTendon >= 0.5);
  console.log(`uniones carnosas que salen blancas (≥50 % de tendón junto al área): ${bl.length} de ${car.length}` + (bl.length ? ' → ' + [...new Set(bl.map(u => u.es))].slice(0, 25).join(' | ') : '')); }
fs.writeFileSync(path.join(RAIZ, 'unreal', 'tendones_informe.json'), JSON.stringify({ cuerpo: CUERPO, radio: RADIO, reglas: 'tools/unreal/tendones_reglas.json', filas }, null, 0));
