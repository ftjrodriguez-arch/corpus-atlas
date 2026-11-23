#!/usr/bin/env node
/* Corpus Atlas → Unreal: separa los músculos que la web trae agrupados en una sola malla (decisión del usuario,
   2026-11-22: «separarlos uno a uno»). Solo toca la copia de Unreal (Importar/), nunca data/ de la web.

   Los grupos ya vienen como piezas sueltas dentro de su malla (componentes conexos): 11 intercostales externos, 4
   lumbricales y 4 interóseos dorsales de la mano, etc. Cada componente pasa a ser una pieza propia con su id
   (<id del grupo>_<número>), su nombre en el catálogo y los mismos pesos de movimiento que el grupo. El número
   anatómico sale de los huesos vecinos (costillas, metacarpianos, metatarsianos), no del orden en el archivo.

   Uso:  node tools/unreal/separar.js medir [hombre]      solo informa (componentes, número y huesos vecinos)
         node tools/unreal/separar.js aplicar [hombre,mujer]
   Escribe: Importar/<cuerpo>/muscular.glb (piezas nuevas, el grupo sale de la escena), Importar/manifiesto.json,
   Importar/datos/movimiento.json (pesos copiados) e Importar/datos/catalog.json (filas nuevas: el nombre en inglés
   del grupo en la columna 2, para que la ficha y la profundidad de disección del grupo sigan valiendo, y el nombre
   propio en la columna 8). Copia de lo anterior en Importar/antes_separar/. Después: tendones.js <cuerpo> --restaurar y
   --aplicar (empareja cada pieza con su madre: por eso la madre se deja en el GLB, fuera de la escena, y cada vértice y
   triángulo nuevo es copia exacta del de la madre) y reimportar la capa muscular. */
'use strict';
const fs = require('fs'), path = require('path');
const PO = require('./postura.js');
const IMP = PO.IMP;

const ORD = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'];
const ord_es = n => n + (n === 1 || n === 3 ? '.er' : '.º');
const ord_en = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
const roman = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][n];

/* huesos de referencia: nombre en inglés → número */
const COSTILLA = new RegExp('^(' + ORD.slice(1).join('|') + ') rib$');
const METACARPO = new RegExp('^(First|Second|Third|Fourth|Fifth) metacarpal bone$');
const METATARSO = new RegExp('^(First|Second|Third|Fourth|Fifth) metatarsal bone$');
const VERT = [''].concat([1, 2, 3, 4, 5, 6, 7].map(n => 'C' + n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => 'T' + n), [1, 2, 3, 4, 5].map(n => 'L' + n));
const numDe = en => { const v = /^Vertebra ([CTL]\d+)$/.exec(en); return v ? VERT.indexOf(v[1]) : ORD.indexOf(en.split(' ')[0]); };

/* grupos: en = nombre del grupo en inglés · ref = huesos vecinos · num = número anatómico a partir de los dos huesos más
   cercanos (o del más cercano, uno: true) · nombres por número */
const GRUPOS = [
  { en: 'External intercostal muscles', ref: COSTILLA, num: (a, b) => Math.min(a, b),
    es: n => `Músculo intercostal externo del ${ord_es(n)} espacio`, enN: n => `External intercostal muscle (${ord_en(n)} space)`, la: n => `Musculus intercostalis externus (spatium ${roman(n)})` },
  { en: 'Internal intercostal muscles', ref: COSTILLA, num: (a, b) => Math.min(a, b),
    es: n => `Músculo intercostal interno del ${ord_es(n)} espacio`, enN: n => `Internal intercostal muscle (${ord_en(n)} space)`, la: n => `Musculus intercostalis internus (spatium ${roman(n)})` },
  { en: 'Innermost intercostal muscles', ref: COSTILLA, num: (a, b) => Math.min(a, b),
    es: n => `Músculo intercostal íntimo del ${ord_es(n)} espacio`, enN: n => `Innermost intercostal muscle (${ord_en(n)} space)`, la: n => `Musculus intercostalis intimus (spatium ${roman(n)})` },
  { en: 'Subcostales muscles', ref: COSTILLA, num: (a, b) => Math.min(a, b),
    es: n => `Músculo subcostal (${ord_es(n)} espacio)`, enN: n => `Subcostalis muscle (${ord_en(n)} space)`, la: n => `Musculus subcostalis (spatium ${roman(n)})` },
  { en: 'Dorsal interossei muscles of hand', ref: METACARPO, num: (a, b) => Math.min(a, b),
    es: n => `${ord_es(n)} músculo interóseo dorsal de la mano`, enN: n => `${ord_en(n)} dorsal interosseous muscle of hand`, la: n => `Musculus interosseus dorsalis manus ${roman(n)}` },
  { en: 'Lumbrical muscles of hand', ref: METACARPO, num: a => a - 1, uno: true,
    es: n => `${ord_es(n)} músculo lumbrical de la mano`, enN: n => `${ord_en(n)} lumbrical muscle of hand`, la: n => `Musculus lumbricalis manus ${roman(n)}` },
  { en: 'Dorsal interossei muscles of foot', ref: METATARSO, num: (a, b) => Math.min(a, b),
    es: n => `${ord_es(n)} músculo interóseo dorsal del pie`, enN: n => `${ord_en(n)} dorsal interosseous muscle of foot`, la: n => `Musculus interosseus dorsalis pedis ${roman(n)}` },
  { en: 'Plantar interossei muscles', ref: METATARSO, num: a => a - 2, uno: true,
    es: n => `${ord_es(n)} músculo interóseo plantar`, enN: n => `${ord_en(n)} plantar interosseous muscle`, la: n => `Musculus interosseus plantaris ${roman(n)}` },
  /* una sola pieza en la malla de la web: se corta por el hueso más cercano a cada triángulo (corte: true) */
  /* interóseos palmares (174 triángulos) y lumbricales del pie (dos trozos) no se cortan: la malla de la web no trae sus
     formas por separado; quedan como grupo hasta modelarlos */
  { en: 'Rotatores', ref: /^Vertebra [CTL]\d+$/, corte: true, num: a => a,
    es: n => `Músculos rotadores de ${VERT[n]}`, enN: n => `Rotatores (${VERT[n]})`, la: n => `Musculi rotatores (${VERT[n]})` },
];
const MIN_TRI = 40;   // componentes menores se unen al componente grande más cercano

/* componentes conexos de una pieza (vértices soldados por posición) */
function componentes(pz) {
  const P = pz.P, I = pz.I, n = pz.nv, m = new Map(), rep = new Int32Array(n);
  for (let i = 0; i < n; i++) { const k = Math.round(P[i * 3] * 1e5) + ',' + Math.round(P[i * 3 + 1] * 1e5) + ',' + Math.round(P[i * 3 + 2] * 1e5); if (!m.has(k)) m.set(k, i); rep[i] = m.get(k); }
  const par = new Int32Array(n).map((_, i) => i), f = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < I.length; t += 3) { const a = f(rep[I[t]]), b = f(rep[I[t + 1]]), c = f(rep[I[t + 2]]); par[a] = b; par[f(c)] = f(b); }
  const C = new Map(); for (let t = 0; t < I.length; t += 3) { const r = f(rep[I[t]]); if (!C.has(r)) C.set(r, []); C.get(r).push(t); }
  const L = [...C.values()].map(ts => { let x = 0, y = 0, z = 0; for (const t of ts) { const v = I[t] * 3; x += P[v]; y += P[v + 1]; z += P[v + 2]; } return { ts, c: [x / ts.length, y / ts.length, z / ts.length] }; });
  const grandes = L.filter(c => c.ts.length >= MIN_TRI), chicos = L.filter(c => c.ts.length < MIN_TRI);
  for (const ch of chicos) { let best = null, bd = 1e9; for (const g of grandes) { const d = Math.hypot(g.c[0] - ch.c[0], g.c[1] - ch.c[1], g.c[2] - ch.c[2]); if (d < bd) { bd = d; best = g; } } if (best) best.ts.push(...ch.ts); }
  return grandes;
}

/* corte de una pieza de un solo componente: cada triángulo va con el hueso de referencia más cercano a su centro;
   los trozos de menos de MIN_TRI triángulos se unen al trozo vecino más cercano */
function cortar(pz, H, G) {
  const P = pz.P, I = pz.I, por = new Map();
  for (let t = 0; t < I.length; t += 3) { const c = [0, 1, 2].map(k => (P[I[t] * 3 + k] + P[I[t + 1] * 3 + k] + P[I[t + 2] * 3 + k]) / 3);
    let bn = -1, bd = 1e9; for (const h of H) { for (let i = 0; i < h.P.length; i += 6) { const d = (h.P[i] - c[0]) ** 2 + (h.P[i + 1] - c[1]) ** 2 + (h.P[i + 2] - c[2]) ** 2; if (d < bd) { bd = d; bn = h.n; } } }
    const n = G.num(bn); if (!por.has(n)) por.set(n, { ts: [], n, voto: 'corte ' + bn, c: [0, 0, 0] }); const o = por.get(n); o.ts.push(t); for (let k = 0; k < 3; k++) o.c[k] += c[k]; }
  let L = [...por.values()]; for (const o of L) o.c = o.c.map(v => v / o.ts.length);
  const chicos = L.filter(o => o.ts.length < MIN_TRI); L = L.filter(o => o.ts.length >= MIN_TRI);
  for (const ch of chicos) { let best = null, bd = 1e9; for (const g of L) { const d = Math.hypot(...g.c.map((v, k) => v - ch.c[k])); if (d < bd) { bd = d; best = g; } } if (best) best.ts.push(...ch.ts); }
  return L;
}
/* huesos de referencia del lado de la pieza */
function huesosRef(cuerpo, re, lado) {
  const L = []; for (const c of cuerpo === 'hombre' ? ['hombre'] : [cuerpo, 'hombre']) { let C; try { C = PO.capa(c + '/oseo'); } catch (e) { continue; }
    for (const nd of C.g.nodes) { if (nd.mesh === undefined) continue; const e = nd.extras || {}; if (!re.test(e.en || '') || ((e.lado || '') !== lado && (e.lado || '') !== '') || L.some(h => h.en === e.en)) continue; const pz = PO.pieza(c + '/oseo', nd.name); L.push({ en: e.en, n: numDe(e.en), P: pz.P }); } }
  return L;
}
/* número anatómico: voto de los huesos más cercanos a (hasta 600) vértices del componente */
function numerar(pz, comp, H, G) {
  const votos = new Map(), P = pz.P, I = pz.I, vist = new Set();
  for (const t of comp.ts) for (let e = 0; e < 3; e++) { const v = I[t + e]; if (vist.has(v) || vist.size > 600) continue; vist.add(v);
    const d = H.map(h => { let b = 1e9; for (let i = 0; i < h.P.length; i += 9) { const dd = (h.P[i] - P[v * 3]) ** 2 + (h.P[i + 1] - P[v * 3 + 1]) ** 2 + (h.P[i + 2] - P[v * 3 + 2]) ** 2; if (dd < b) b = dd; } return [b, h.n]; }).sort((a, b) => a[0] - b[0]);
    const k = G.uno ? String(d[0][1]) : [d[0][1], d[1][1]].sort((a, b) => a - b).join('-'); votos.set(k, (votos.get(k) || 0) + 1); }
  const porNum = new Map(); for (const [k, c] of votos) { const t = k.split('-').map(Number), n = G.uno ? G.num(t[0]) : G.num(t[0], t[1]); porNum.set(n, (porNum.get(n) || 0) + c); }
  const top = [...votos.entries()].sort((a, b) => b[1] - a[1])[0][0].split('-').map(Number);
  return { n: G.uno ? G.num(top[0]) : G.num(top[0], top[1]), voto: top.join('-'), porNum, total: vist.size };
}
/* números repetidos: reparto conjunto que maximiza los votos (permutaciones; grupos de hasta 6 piezas) */
function repartir(comps) {
  const ns = comps.map(c => c.n); if (new Set(ns).size === ns.length || comps.length > 6) return;
  const cand = [...new Set([...comps.flatMap(c => [...c.porNum.keys()]), ...Array.from({ length: comps.length + 1 }, (_, i) => i + 1)])].filter(n => n >= 1 && n <= 12);
  let mejor = null, mv = -1;
  const rec = (i, usados, suma, asig) => { if (i === comps.length) { if (suma > mv) { mv = suma; mejor = asig.slice(); } return; }
    for (const n of cand) { if (usados.has(n)) continue; usados.add(n); asig.push(n); rec(i + 1, usados, suma + (comps[i].porNum.get(n) || 0) / comps[i].total, asig); asig.pop(); usados.delete(n); } };
  rec(0, new Set(), 0, []);
  /* solo vale si los números quedan seguidos (1-2-3-4), como en la anatomía */
  if (mejor) { const o = mejor.slice().sort((a, b) => a - b); if (o.every((v, i) => i === 0 || v === o[i - 1] + 1)) comps.forEach((c, i) => { if (c.n !== mejor[i]) c.voto += '→' + mejor[i]; c.n = mejor[i]; }); }
}

function plan(cuerpo) {
  const C = PO.capa(cuerpo + '/muscular'), R = [], hechos = new Set(C.g.nodes.map(x => (x.extras || {}).grupo).filter(Boolean));
  for (const nd of C.g.nodes) { if (nd.mesh === undefined) continue; const e = nd.extras || {}, G = GRUPOS.find(g => g.en === e.en); if (!G || e.grupo || hechos.has(nd.name)) continue;   /* ya separado en una pasada anterior */
    const pz = PO.pieza(cuerpo + '/muscular', nd.name);
    if (G.corte) { const H = huesosRef(cuerpo, G.ref, e.lado || ''), comps = cortar(pz, H, G); R.push({ nd, G, pz, comps, nota: comps.length < 2 ? 'el corte dio una sola parte: sin separar' : '' }); continue; }
    const comps = componentes(pz); if (comps.length < 2) { R.push({ nd, G, pz, comps, nota: 'un solo componente: sin separar' }); continue; }
    const H = huesosRef(cuerpo, G.ref, e.lado || ''); for (const c of comps) Object.assign(c, numerar(pz, c, H, G));
    repartir(comps);
    const ns = comps.map(c => c.n), rep = ns.filter((v, i) => ns.indexOf(v) !== i), malos = ns.filter(v => !(v >= 1 && v <= 24));
    R.push({ nd, G, pz, comps, nota: rep.length ? 'números repetidos ' + rep.join(',') + ': sin separar' : malos.length ? 'números fuera de rango: sin separar' : '' }); }
  return R;
}

function medir(cuerpo) {
  for (const r of plan(cuerpo)) console.log(`${r.nd.name} ${r.G.en} (${r.pz.lado}): ${r.comps.length} componentes · ${r.comps.map(c => c.n !== undefined ? c.n + '[' + c.voto + ']:' + c.ts.length : c.ts.length).join(' ')} ${r.nota}`);
}

/* ───────── escritura del GLB ───────── */
const TA = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
/* datos de un accessor tal como están en el binario (copia), con su tipo de componente */
function crudo(g, bin, ai) {
  const a = g.accessors[ai], v = g.bufferViews[a.bufferView], nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type], T = TA[a.componentType], tam = nc * T.BYTES_PER_ELEMENT;
  if (v.byteStride && v.byteStride !== tam) throw new Error('accessor ' + ai + ' intercalado (byteStride ' + v.byteStride + '): separar.js no lo admite');
  const o = bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
  return new T(bin.buffer.slice(o, o + a.count * tam));
}
function aplicar(cuerpos) {
  const bk = path.join(IMP, 'antes_separar'); fs.mkdirSync(path.join(bk, 'datos'), { recursive: true });
  const fMan = path.join(IMP, 'manifiesto.json'), fMov = path.join(IMP, 'datos', 'movimiento.json'), fCat = path.join(IMP, 'datos', 'catalog.json');
  for (const f of [fMan, fMov, fCat]) { const d = path.join(bk, path.relative(IMP, f)); if (!fs.existsSync(d)) fs.copyFileSync(f, d); }
  const MAN = JSON.parse(fs.readFileSync(fMan, 'utf8')), MOV = JSON.parse(fs.readFileSync(fMov, 'utf8')), CAT = JSON.parse(fs.readFileSync(fCat, 'utf8'));
  const enCat = new Set(CAT.map(r => r[0]));
  for (const cuerpo of cuerpos) {
    const fG = path.join(IMP, cuerpo, 'muscular.glb'), dB = path.join(bk, cuerpo); fs.mkdirSync(dB, { recursive: true });
    if (!fs.existsSync(path.join(dB, 'muscular.glb'))) fs.copyFileSync(fG, path.join(dB, 'muscular.glb'));
    const R = plan(cuerpo).filter(r => !r.nota); if (!R.length) { console.log(cuerpo + ': nada que separar'); continue; }
    const b = fs.readFileSync(fG), lj = b.readUInt32LE(12), g = JSON.parse(b.slice(20, 20 + lj)), bin0 = b.slice(20 + lj + 8, 20 + lj + 8 + b.readUInt32LE(20 + lj));
    const extra = []; let off = bin0.length; const pad4 = () => { const r = (4 - (off % 4)) % 4; if (r) { extra.push(Buffer.alloc(r)); off += r; } };
    const nuevaVista = buf => { pad4(); const bv = g.bufferViews.length; g.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length }); extra.push(buf); off += buf.length; return bv; };
    const C = PO.capa(cuerpo + '/muscular'), escena = g.scenes[g.scene || 0], quitar = new Set();
    let nPz = 0;
    for (const r of R) {
      const nd = r.nd, ndi = g.nodes.findIndex(x => x.name === nd.name && x.mesh === nd.mesh), pr = g.meshes[nd.mesh].primitives[0], man = MAN.piezas[nd.name] && MAN.piezas[nd.name][cuerpo];
      /* atributos en su tipo real: PO.acc solo distingue Float32 y Uint32 y lee lo demás como Uint16, lo que desordenaba
         COLOR_0 (UNSIGNED_BYTE VEC4: oclusión, tendón, cartílago). Las pasadas anteriores las repara tendones.js --restaurar. */
      const atr = Object.entries(pr.attributes).map(([k, ai]) => { const a = g.accessors[ai], nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type]; return { k, a, nc, d: crudo(g, bin0, ai) }; });
      const padre = g.nodes.find(x => (x.children || []).includes(ndi));
      for (const c of r.comps.sort((x, y) => x.n - y.n)) {
        const id = nd.name + '_' + c.n, mapa = new Map(), I = r.pz.I, idx = new Uint32Array(c.ts.length * 3);
        let k = 0; for (const t of c.ts) for (let e = 0; e < 3; e++) { const v = I[t + e]; if (!mapa.has(v)) mapa.set(v, mapa.size); idx[k++] = mapa.get(v); }
        const nv = mapa.size, viejos = [...mapa.keys()], attrs = {}, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (const A of atr) {
          const out = new A.d.constructor(nv * A.nc); viejos.forEach((v, j) => { for (let q = 0; q < A.nc; q++) out[j * A.nc + q] = A.d[v * A.nc + q]; });
          const acc = { bufferView: nuevaVista(Buffer.from(out.buffer, out.byteOffset, out.byteLength)), componentType: A.a.componentType, count: nv, type: A.a.type }; if (A.a.normalized) acc.normalized = true;
          if (A.k === 'POSITION') { for (let j = 0; j < nv; j++) for (let q = 0; q < 3; q++) { mn[q] = Math.min(mn[q], out[j * 3 + q]); mx[q] = Math.max(mx[q], out[j * 3 + q]); } acc.min = mn.slice(); acc.max = mx.slice(); }
          attrs[A.k] = g.accessors.length; g.accessors.push(acc); }
        const ia = g.accessors.length; g.accessors.push({ bufferView: nuevaVista(Buffer.from(idx.buffer)), componentType: 5125, count: idx.length, type: 'SCALAR' });
        const mi = g.meshes.length; g.meshes.push({ name: id, primitives: [Object.assign({}, pr, { attributes: attrs, indices: ia })] });
        const nodo = JSON.parse(JSON.stringify(g.nodes[ndi])); nodo.name = id; nodo.mesh = mi; delete nodo.children; nodo.extras = Object.assign({}, nodo.extras, { grupo: nd.name, numero: c.n });
        const ni = g.nodes.length; g.nodes.push(nodo); if (padre) padre.children.push(ni); else escena.nodes.push(ni);
        if (man) { MAN.piezas[id] = MAN.piezas[id] || {}; MAN.piezas[id][cuerpo] = Object.assign({}, man, { t: idx.length / 3, v: nv, c: mn.map((v, q) => +((v + mx[q]) / 2).toFixed(5)), b: [mn.map(v => +v.toFixed(5)), mx.map(v => +v.toFixed(5))] }); }
        if (MOV.piezas[cuerpo] && MOV.piezas[cuerpo][nd.name]) MOV.piezas[cuerpo][id] = MOV.piezas[cuerpo][nd.name].slice();
        if (!enCat.has(id)) { const fila = CAT.find(x => x[0] === nd.name) || [nd.name, r.G.en, '', '', 'muscular', (nd.extras || {}).lado || '', ''];
          CAT.push([id, fila[1], r.G.es(c.n), r.G.la(c.n), 'muscular', fila[5], '', r.G.enN(c.n)]); enCat.add(id); }
        nPz++; }
      quitar.add(ndi);
      if (MAN.piezas[nd.name]) { delete MAN.piezas[nd.name][cuerpo]; if (!Object.keys(MAN.piezas[nd.name]).length) delete MAN.piezas[nd.name]; }
    }
    for (const x of g.nodes) if (x.children) x.children = x.children.filter(i => !quitar.has(i));
    escena.nodes = escena.nodes.filter(i => !quitar.has(i));
    pad4(); const bin = Buffer.concat([bin0, ...extra]); g.buffers[0].byteLength = bin.length;
    let js = Buffer.from(JSON.stringify(g)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
    const binP = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
    const cab = Buffer.alloc(12); cab.writeUInt32LE(0x46546C67, 0); cab.writeUInt32LE(2, 4); cab.writeUInt32LE(12 + 8 + js.length + 8 + binP.length, 8);
    const hj = Buffer.alloc(8); hj.writeUInt32LE(js.length, 0); hj.writeUInt32LE(0x4E4F534A, 4);
    const hb = Buffer.alloc(8); hb.writeUInt32LE(binP.length, 0); hb.writeUInt32LE(0x004E4942, 4);
    fs.writeFileSync(fG + '.tmp', Buffer.concat([cab, hj, js, hb, binP])); fs.renameSync(fG + '.tmp', fG);
    console.log(`${cuerpo}/muscular.glb: ${R.length} grupos → ${nPz} piezas`);
  }
  for (const a of MAN.archivos || []) a.piezas = Object.values(MAN.piezas).filter(p => Object.values(p).some(m => m.a === a.archivo)).length;   /* lo comprueba importar_mallas */
  fs.writeFileSync(fMan, JSON.stringify(MAN)); fs.writeFileSync(fMov, JSON.stringify(MOV)); fs.writeFileSync(fCat, JSON.stringify(CAT));
  console.log('manifiesto, movimiento y catálogo de Importar actualizados (copiar_datos() los lleva a Content/Datos)');
}

if (require.main === module) {
  const [orden, a1] = process.argv.slice(2);
  if (orden === 'medir') medir(a1 || 'hombre');
  else if (orden === 'aplicar') aplicar((a1 || 'hombre,mujer').split(','));
  else console.log('Uso: node tools/unreal/separar.js medir [hombre] | aplicar [hombre,mujer]');
}
module.exports = { componentes, plan };
