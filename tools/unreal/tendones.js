// Corpus Atlas (edición Unreal) — comprueba que cada músculo llega en tendón a sus inserciones.
// Lee los GLB exportados (Importar/hombre/muscular.glb e insercion.glb), y por cada músculo mide el canal G del color
// por vértice (tendón/aponeurosis, 0–255) en los vértices que quedan a menos de RADIO de sus áreas de origen e inserción
// (piezas de la capa «insercion» con el mismo nombre y lado).
//   node --max-old-space-size=12000 tools/unreal/tendones.js [cuerpo]            → informe en unreal/tendones_informe.json
//   node --max-old-space-size=12000 tools/unreal/tendones.js [cuerpo] --aplicar  → además corrige el GLB (solo sube G)
// Corrección: todo músculo acaba en tendón o aponeurosis. Junto a cada área de origen e inserción el canal G sube a 255 y
// se funde con el vientre (zona = 5 % de la longitud de la pieza, entre 3 y 20 mm; fundido hasta 2,2 veces esa distancia).
// Las piezas sin área propia usan la del músculo del que forman parte (mismo nombre antes de la coma) y, si tampoco la
// hay y la pieza es alargada, sus dos extremos. Se escribe en el propio GLB (los pesos de movimiento de TEXCOORD no se
// tocan); después hay que reimportar la capa muscular en Unreal. Va detrás de exportar.js y movimiento.js.
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const CUERPO = process.argv.slice(2).find(a => !a.startsWith('--')) || 'hombre';
const APLICAR = process.argv.includes('--aplicar');
const IMP = path.join(RAIZ, 'unreal', 'CorpusAtlas', 'Importar', CUERPO);
const RADIO = 0.006, UMBRAL = 128;
const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }, NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function leer(archivo, guardar) {
  const buf = fs.readFileSync(archivo);
  const lj = buf.readUInt32LE(12), js = JSON.parse(buf.slice(20, 20 + lj).toString('utf8')), bin = buf.slice(20 + lj + 8);
  const acc = i => { const a = js.accessors[i], v = js.bufferViews[a.bufferView], T = CT[a.componentType], nc = NC[a.type];
    const off = (v.byteOffset || 0) + (a.byteOffset || 0); const out = new T(a.count * nc);
    const paso = v.byteStride || nc * T.BYTES_PER_ELEMENT, dv = new DataView(bin.buffer, bin.byteOffset + off);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < nc; c++) { const p = k * paso + c * T.BYTES_PER_ELEMENT;
      out[k * nc + c] = T === Float32Array ? dv.getFloat32(p, true) : T === Uint8Array ? dv.getUint8(p) : T === Uint16Array ? dv.getUint16(p, true) : dv.getUint32(p, true); }
    return { arr: out, nc, norm: a.normalized, T }; };
  const piezas = {};
  for (const n of js.nodes) { if (n.mesh == null) continue; const m = js.meshes[n.mesh], id = n.name || m.name;
    for (const pr of m.primitives) { const P = acc(pr.attributes.POSITION).arr; let G = null;
      if (pr.attributes.COLOR_0 != null) { const c = acc(pr.attributes.COLOR_0), k = c.T === Float32Array ? 255 : c.T === Uint16Array ? 255 / 65535 : 1; G = new Uint8Array(P.length / 3); for (let i = 0; i < G.length; i++) G[i] = Math.round(c.arr[i * c.nc + 1] * k); }
      let gOff = -1, gPaso = 0;
      if (pr.attributes.COLOR_0 != null) { const a = js.accessors[pr.attributes.COLOR_0], v = js.bufferViews[a.bufferView]; if (a.componentType === 5121) { gOff = 20 + lj + 8 + (v.byteOffset || 0) + (a.byteOffset || 0) + 1; gPaso = v.byteStride || NC[a.type]; } }
      (piezas[id] = piezas[id] || []).push({ P, G, gOff, gPaso }); } }
  if (guardar) piezas.__buf = buf;
  return piezas;
}
const cat = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'catalog.json'), 'utf8'));
const fem = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'fem.json'), 'utf8')).cat || [];
const info = {}; for (const r of [...cat, ...fem]) info[r[0]] = { en: r[1], es: r[2], sis: r[4], lado: r[5] };
console.log('leyendo inserciones…'); const INS = leer(path.join(IMP, 'insercion.glb'));
console.log('leyendo músculos…'); const MUS = leer(path.join(IMP, 'muscular.glb'), APLICAR);
const BUF = MUS.__buf; delete MUS.__buf;
// áreas de inserción por nombre + lado
const areas = {};
for (const id of Object.keys(INS)) { const c = info[id]; if (!c) continue; const k = c.en + '|' + c.lado; (areas[k] = areas[k] || []).push(...INS[id].map(p => p.P)); }
const celda = RADIO, clave = (x, y, z) => Math.floor(x / celda) + ',' + Math.floor(y / celda) + ',' + Math.floor(z / celda);
const filas = [];
for (const id of Object.keys(MUS)) {
  const c = info[id]; if (!c) continue;
  let n = 0, nT = 0; for (const p of MUS[id]) if (p.G) for (let i = 0; i < p.G.length; i++) { n++; if (p.G[i] >= UMBRAL) nT++; }
  const A = areas[c.en + '|' + c.lado];
  const f = { id, en: c.en, es: c.es, lado: c.lado, vertices: n, tendon: n ? +(nT / n).toFixed(3) : 0, areas: A ? A.length : 0 };
  if (A) {
    const H = new Set(); for (const P of A) for (let i = 0; i < P.length; i += 3) H.add(clave(P[i], P[i + 1], P[i + 2]));
    let m = 0, mT = 0, sum = 0;
    for (const p of MUS[id]) { if (!p.G) continue; for (let i = 0; i < p.G.length; i++) { const x = p.P[i * 3], y = p.P[i * 3 + 1], z = p.P[i * 3 + 2]; let cerca = false;
      for (let a = -1; a <= 1 && !cerca; a++) for (let b = -1; b <= 1 && !cerca; b++) for (let d = -1; d <= 1 && !cerca; d++) if (H.has(clave(x + a * celda, y + b * celda, z + d * celda))) cerca = true;
      if (cerca) { m++; sum += p.G[i]; if (p.G[i] >= UMBRAL) mT++; } } }
    f.junto = m; f.juntoTendon = m ? +(mT / m).toFixed(3) : null; f.juntoG = m ? Math.round(sum / m) : null;
  }
  filas.push(f);
}
const conArea = filas.filter(f => f.junto > 0), sinArea = filas.filter(f => !f.junto);
const mal = conArea.filter(f => f.juntoTendon < 0.5).sort((a, b) => a.juntoTendon - b.juntoTendon);
console.log(`músculos: ${filas.length} · con inserción localizada: ${conArea.length} · sin área de inserción: ${sinArea.length}`);
console.log(`llegan en tendón (≥50 % de los vértices junto a la inserción): ${conArea.length - mal.length} · NO llegan: ${mal.length}`);
const h = [0, 0, 0, 0, 0]; for (const f of conArea) h[Math.min(4, Math.floor(f.juntoTendon * 5))]++;
console.log('reparto del tendón junto a la inserción [0–20, 20–40, 40–60, 60–80, 80–100 %]:', h.join(' · '));
console.log('sin nada de tendón en toda la pieza:', filas.filter(f => f.tendon === 0).length);
console.log('peores:', [...new Set(mal.slice(0, 60).map(f => f.es + ' ' + Math.round(f.juntoTendon * 100) + '%'))].slice(0, 45).join(' | '));
console.log('sin área:', [...new Set(sinArea.map(f => f.es))].slice(0, 40).join(' | '));
fs.writeFileSync(path.join(RAIZ, 'unreal', 'tendones_informe.json'), JSON.stringify({ cuerpo: CUERPO, radio: RADIO, filas }, null, 0));

// ───────── corrección ─────────
if (APLICAR) {
  const NO = /orbicular|sphincter|constrictor|arytenoid|tarsus|platysma|trochlea|tendon|aponeurosis|galea|diaphragm/i;
  const base = s => s.split(',')[0].trim();
  const areasBase = {}; for (const k of Object.keys(areas)) { const [en, lado] = k.split('|'); const kb = base(en) + '|' + lado; (areasBase[kb] = areasBase[kb] || []).push(...areas[k]); }
  let porArea = 0, porBase = 0, porExtremos = 0, sin = 0, subidos = 0;
  for (const id of Object.keys(MUS)) {
    const c = info[id]; if (!c) continue;
    // caja y longitud de la pieza
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], nv = 0, cen = [0, 0, 0];
    for (const p of MUS[id]) for (let i = 0; i < p.P.length; i += 3) for (let k = 0; k < 3; k++) { const v = p.P[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; cen[k] += v; if (k === 2) nv++; }
    if (!nv) continue; cen = cen.map(v => v / nv);
    const L = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
    const d0 = Math.min(0.02, Math.max(0.003, 0.05 * L)), d1 = 2.2 * d0;
    let A = areas[c.en + '|' + c.lado], modo = 'area';
    if (!A) { A = areasBase[base(c.en) + '|' + c.lado]; modo = 'base'; }
    let dist = null;   // función distancia de un punto al extremo tendinoso
    if (A) {
      const cel = d1, H = new Map();
      for (const P of A) for (let i = 0; i < P.length; i += 3) { const k = Math.floor(P[i] / cel) + ',' + Math.floor(P[i + 1] / cel) + ',' + Math.floor(P[i + 2] / cel); let l = H.get(k); if (!l) H.set(k, l = []); l.push(P[i], P[i + 1], P[i + 2]); }
      dist = (x, y, z) => { let m = 1e9; const cx = Math.floor(x / cel), cy = Math.floor(y / cel), cz = Math.floor(z / cel);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) { const l = H.get((cx + a) + ',' + (cy + b) + ',' + (cz + d)); if (!l) continue;
          for (let i = 0; i < l.length; i += 3) { const q = (l[i] - x) ** 2 + (l[i + 1] - y) ** 2 + (l[i + 2] - z) ** 2; if (q < m) m = q; } }
        return Math.sqrt(m); };
      if (modo === 'area') porArea++; else porBase++;
    } else if (!NO.test(c.en)) {
      // sin área: eje principal por iteración de potencias; si la pieza es alargada, sus dos extremos son tendón
      let C = [0, 0, 0, 0, 0, 0];
      for (const p of MUS[id]) for (let i = 0; i < p.P.length; i += 3) { const x = p.P[i] - cen[0], y = p.P[i + 1] - cen[1], z = p.P[i + 2] - cen[2]; C[0] += x * x; C[1] += x * y; C[2] += x * z; C[3] += y * y; C[4] += y * z; C[5] += z * z; }
      let e = [1, 1, 1]; for (let it = 0; it < 40; it++) { const r = [C[0] * e[0] + C[1] * e[1] + C[2] * e[2], C[1] * e[0] + C[3] * e[1] + C[4] * e[2], C[2] * e[0] + C[4] * e[1] + C[5] * e[2]]; const n = Math.hypot(...r) || 1; e = r.map(v => v / n); }
      const l1 = C[0] * e[0] * e[0] + C[3] * e[1] * e[1] + C[5] * e[2] * e[2] + 2 * (C[1] * e[0] * e[1] + C[2] * e[0] * e[2] + C[4] * e[1] * e[2]);
      const resto = C[0] + C[3] + C[5] - l1;
      if (l1 > 3 * resto) {
        let a = 1e9, b = -1e9; for (const p of MUS[id]) for (let i = 0; i < p.P.length; i += 3) { const s = (p.P[i] - cen[0]) * e[0] + (p.P[i + 1] - cen[1]) * e[1] + (p.P[i + 2] - cen[2]) * e[2]; if (s < a) a = s; if (s > b) b = s; }
        dist = (x, y, z) => { const s = (x - cen[0]) * e[0] + (y - cen[1]) * e[1] + (z - cen[2]) * e[2]; return Math.min(s - a, b - s) - d0 * 0.5; };
        porExtremos++;
      }
    }
    if (!dist) { sin++; continue; }
    for (const p of MUS[id]) { if (p.gOff < 0) continue; const n = p.P.length / 3;
      for (let i = 0; i < n; i++) { const d = dist(p.P[i * 3], p.P[i * 3 + 1], p.P[i * 3 + 2]); if (d >= d1) continue;
        let w = d <= d0 ? 1 : 1 - (d - d0) / (d1 - d0); w = w * w * (3 - 2 * w);
        const g = Math.round(255 * w), o = p.gOff + i * p.gPaso; if (g > BUF[o]) { BUF[o] = g; subidos++; } } }
  }
  fs.writeFileSync(path.join(IMP, 'muscular.glb'), BUF);
  console.log(`corregido: ${porArea} con su área · ${porBase} con el área del músculo entero · ${porExtremos} por sus extremos · ${sin} sin cambios · ${subidos} vértices subidos`);
}