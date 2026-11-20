#!/usr/bin/env node
/* Corpus Atlas → Unreal: repite en la CPU la cuenta del nodo «Postura» del material (HLSL_POSTURA de corpus_importar.py)
   sobre una pieza de los GLB exportados, para medir sin abrir Unreal dónde se pliega o se da la vuelta una malla.

   Uso: node tools/unreal/simular.js <cuerpo/sistema> <id> <rom> <nº mov> <R|L> <grados> [sin-abrazo] [sin-cubrir]
   Ej.: node tools/unreal/simular.js hombre/muscular n1610 hombro 2 R 150
   Salida: desplazamiento máximo, triángulos invertidos (normal girada más de 90° respecto a la esperada) por tramos de
   altura, y los peores estiramientos. Si se cambia el HLSL, hay que cambiar esto igual. */
'use strict';
const fs = require('fs'), path = require('path');
const IMP = path.resolve(__dirname, '..', '..', 'unreal', 'CorpusAtlas', 'Importar');
const [capa, id, rom, mi, lado, grados, ...ops] = process.argv.slice(2);
const SIN_ABRAZO = ops.includes('sin-abrazo'), SIN_CUBRIR = ops.includes('sin-cubrir'), FIBO = ops.includes('fib');
const QP = +((ops.find(o => o.startsWith('Q=')) || '').slice(2)) || 2, C1 = +((ops.find(o => o.startsWith('C1=')) || '').slice(3)) || 0.20, KR = +((ops.find(o => o.startsWith('KR=')) || '').slice(3)) || 1.0;
const HL = +((ops.find(o => o.startsWith('HL=')) || '').slice(3)) || 0.03, HK = +((ops.find(o => o.startsWith('HK=')) || '').slice(3)) || 1.03;
const HE = +((ops.find(o => o.startsWith('HE=')) || '').slice(3)) || 6;
const SUAVE = ops.includes('suave');
const RR = +((ops.find(o => o.startsWith('R=')) || '').slice(2)) || 0, R0 = +((ops.find(o => o.startsWith('R0=')) || '').slice(3)) || 0.02;
const M = JSON.parse(fs.readFileSync(path.join(IMP, 'datos', 'movimiento.json'), 'utf8'));
const rig = JSON.parse(fs.readFileSync(path.join(IMP, 'datos', 'rig.json'), 'utf8'));
const NA = M.articulaciones.length, arts = M.articulaciones.map(a => a.id), cuerpo = capa.split('/')[0];
const mv = M.rom.find(r => r.id === rom).movs[+mi], F = mv[lado], fr = F[Math.min(F.length - 1, Math.round(+grados / mv.paso))];
const J = arts.map((_, i) => ({ e: [0, 0, 0], a: 0, t: [0, 0, 0], p: M.articulaciones[i].pivote }));
for (let k = 0; k < fr.length; k += 8) { const j = J[fr[k]]; j.e = [fr[k + 1], fr[k + 2], fr[k + 3]]; j.a = fr[k + 4]; j.t = [fr[k + 5], fr[k + 6], fr[k + 7]]; }
const b = fs.readFileSync(path.join(IMP, capa + '.glb')), lj = b.readUInt32LE(12), g = JSON.parse(b.slice(20, 20 + lj)), bin = b.slice(20 + lj + 8);
const acc = i => { const a = g.accessors[i], v = g.bufferViews[a.bufferView], nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], o = bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
  if (a.componentType === 5126) return new Float32Array(bin.buffer.slice(o, o + a.count * nc * 4)); if (a.componentType === 5125) return new Uint32Array(bin.buffer.slice(o, o + a.count * 4)); return new Uint16Array(bin.buffer.slice(o, o + a.count * 2)); };
const nodo = g.nodes.find(n => n.name === id); if (!nodo) { console.error('no está ' + id); process.exit(1); }
const pr = g.meshes[nodo.mesh].primitives[0], P = acc(pr.attributes.POSITION), I = acc(pr.indices), U = [0, 1, 2, 3].map(c => acc(pr.attributes['TEXCOORD_' + c]));
const js = (M.piezas[cuerpo][id] || []).concat([0, 0, 0, 0, 0, 0, 0, 0, 0]).slice(0, 9);
const en = nodo.extras.en, HUG = (M.abrazo[cuerpo] || []).includes(id) ? (/^Latissimus/.test(en) ? 2 : 1) : 0;
const Sd = nodo.extras.lado === 'derecho' ? 'R' : 'L';
const TX = require('./torax.js');
const leeG = f => { const bb = fs.readFileSync(f), l = bb.readUInt32LE(12); return { j: JSON.parse(bb.slice(20, 20 + l)), bin: bb.slice(20 + l + 8) }; };
const visG = (gl, i) => { const a = gl.j.accessors[i], v = gl.j.bufferViews[a.bufferView], o = gl.bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0); return new Float32Array(gl.bin.buffer.slice(o, o + a.count * 12)); };
const TC = M.torax && M.torax.r ? M.torax : TX.contorno(leeG, visG, path.join(IMP, 'hombre', 'oseo.glb'));
const KM = +((ops.find(o => o.startsWith('KM=')) || '').slice(3)) || 0.6, MG = +((ops.find(o => o.startsWith('MG=')) || '').slice(3)) || 0.004;
const punta = () => { const ja = J[arts.indexOf('acr_' + Sd)], jc = J[arts.indexOf('sc_' + Sd)]; let bb = rig['scapBot_' + Sd].slice(); bb = gira(bb, ja.p, ja.e, ja.a); return gira(bb, jc.p, jc.e, jc.a); };
const T = M.torax, cont = y => { const h = Math.max(0, Math.min(31, (y - T.y0) / T.dy)), a = Math.floor(h), A = T.filas[a], B = T.filas[Math.min(a + 1, 31)], f = h - a; return A.map((v, i) => v + (B[i] - v) * f); };
const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]], dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
const gira = (p, pv, e, an) => { const s = Math.sin(an), c = Math.cos(an), d = p.map((x, i) => x - pv[i]), cr = cross(e, d), dt = dot(e, d); return d.map((x, i) => x * c + cr[i] * s + e[i] * dt * (1 - c) + pv[i]); };
const sat = x => Math.max(0, Math.min(1, x)), ss = (a, c, x) => { const t = sat((x - a) / (c - a)); return t * t * (3 - 2 * t); };
function postura(g0, ws) {
  let gg = g0.slice(), hecho = false, wl = 0, ip = INS.slice(); const info = {};
  for (let k = 0; k < 9; k++) {
    const jv = js[k]; let code = Math.round(Math.abs(jv)); const tronco = jv === 0 || (code & 31) >= NA - 2;
    if (!hecho && tronco) { hecho = true;
      if (HUG > 0 && wl > 0.0005 && !SIN_ABRAZO) {
        const k0 = TX.k(TC, g0), k1 = TX.k(TC, gg), R1 = TX.radio(TC, gg);
        const libre = sat((wl - 0.25) / 0.6), l3 = libre ** 3, kmax = k0 + (0.006 + libre * libre * 0.07 + libre * HL + Math.pow(libre, HE) * 1.5) / R1;
        const kmin = k0 < 1 ? k0 : 1 + (k0 - 1) * KM, kt = Math.max(kmin, SUAVE ? (k1 > k0 ? k0 + (kmax - k0) * Math.tanh((k1 - k0) / (kmax - k0)) : k1) : Math.min(k1, kmax)), hy = (gg[1] - TC.y0) / TC.dy, val = sat(hy) * sat(TC.nh - 1 - hy) * sat(HUG), s = 1 + (kt / Math.max(k1, 1e-4) - 1) * val;
        info.k0 = k0; info.k1 = k1; info.kt = kt; info.val = val; info.libre = libre;
        gg[0] *= s; gg[2] = TC.zc + (gg[2] - TC.zc) * s;
        if (HUG > 1.5 && !SIN_CUBRIR) { const bb = punta(), kb = TX.k(TC, bb) + MG / TX.radio(TC, bb), kg = TX.k(TC, gg);
          const cerca = 1 - ss(0.04, C1, Math.hypot(gg[0] - bb[0], gg[1] - bb[1], gg[2] - bb[2])), s2 = (kg + cerca * Math.max(0, kb - KR)) / Math.max(kg, 1e-4); info.cubre = s2 - 1;
          gg[0] *= s2; gg[2] = TC.zc + (gg[2] - TC.zc) * s2; } } }
    if (jv === 0) break;
    const w = sat(ws[k]); if (k === 0 && !tronco) wl = w; if (w < 0.0005) continue; const lin = jv < 0;
    for (let t = 0; t < 3; t++) { const j = (code & 31) - 1; code >>= 5; if (j < 0) break; const o = J[j]; if (!o.a && !o.t.some(x => x)) continue;
      if (FIB && lin) { const r = gira(gg, o.p, o.e, o.a), ri = gira(ip, o.p, o.e, o.a), q = Math.pow(w, QP); gg = gg.map((x, i) => { const tx = x + w * (ri[i] - ip[i]); return tx + (r[i] - tx) * q; }); ip = ri; continue; }
      const r = gira(gg, o.p, o.e, lin ? o.a : o.a * w); gg = lin ? gg.map((x, i) => x + (r[i] - x) * w) : r; gg = gg.map((x, i) => x + o.t[i] * w); }
  }
  return [gg, info];
}
const nv = P.length / 3, D = new Float32Array(nv * 3), INF = new Array(nv);
const A = rig['shoulder_' + Sd], B = rig['elbow_' + Sd], ab = B.map((x, i) => x - A[i]), L2 = dot(ab, ab);
let bi = 0, bd = 1e9; for (let i = 0; i < nv; i++) { const pp = [P[i * 3] - A[0], P[i * 3 + 1] - A[1], P[i * 3 + 2] - A[2]]; let tt = sat(dot(pp, ab) / L2); const d = pp.map((x, q) => x - ab[q] * tt), dd = dot(d, d) + (tt < 0.06 ? 0.0004 : 0); if (dd < bd) { bd = dd; bi = i; } }
const INS = ((M.insercion || {})[cuerpo] || {})[id] || [P[bi * 3], P[bi * 3 + 1], P[bi * 3 + 2]], FIB = FIBO || !!(((M.insercion || {})[cuerpo] || {})[id]);
if (RR) for (let i = 0; i < nv; i++) U[0][i * 2] = 1 - ss(0, 1, (Math.hypot(P[i * 3] - INS[0], P[i * 3 + 1] - INS[1], P[i * 3 + 2] - INS[2]) - R0) / RR);
for (let i = 0; i < nv; i++) { const ws = [U[0][i * 2], U[0][i * 2 + 1], U[1][i * 2], U[1][i * 2 + 1], U[2][i * 2], U[2][i * 2 + 1], U[3][i * 2], U[3][i * 2 + 1], 0]; const [q, inf] = postura([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], ws); D.set(q, i * 3); inf.w = ws[0]; INF[i] = inf; }
let mx = 0; for (let i = 0; i < nv * 3; i += 3) mx = Math.max(mx, Math.hypot(D[i] - P[i], D[i + 1] - P[i + 1], D[i + 2] - P[i + 2]));
/* triángulos que se dan la vuelta: la normal deformada mira al lado contrario que las de sus vecinos en reposo */
const nrm = (A, a, c, d) => cross([A[c * 3] - A[a * 3], A[c * 3 + 1] - A[a * 3 + 1], A[c * 3 + 2] - A[a * 3 + 2]], [A[d * 3] - A[a * 3], A[d * 3 + 1] - A[a * 3 + 1], A[d * 3 + 2] - A[a * 3 + 2]]);
/* arista compartida: el ángulo diedro entre dos caras vecinas cambia de signo o se cierra más de 120° respecto al reposo */
const ar = new Map(); for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) { const a = I[t + e], c = I[t + (e + 1) % 3], k = a < c ? a + '_' + c : c + '_' + a; if (!ar.has(k)) ar.set(k, []); ar.get(k).push(t); }
let plieg = 0; const porAltura = {}, ej = [];
for (const [k, ts] of ar) { if (ts.length !== 2) continue; const t0 = ts[0], t1 = ts[1];
  const n0 = nrm(P, I[t0], I[t0 + 1], I[t0 + 2]), n1 = nrm(P, I[t1], I[t1 + 1], I[t1 + 2]), m0 = nrm(D, I[t0], I[t0 + 1], I[t0 + 2]), m1 = nrm(D, I[t1], I[t1 + 1], I[t1 + 2]);
  const cr = dot(n0, n1) / (Math.hypot(...n0) * Math.hypot(...n1) + 1e-20), cd = dot(m0, m1) / (Math.hypot(...m0) * Math.hypot(...m1) + 1e-20);
  if (cr > 0.5 && cd < -0.3) { plieg++; const v = I[t0], y = D[v * 3 + 1], hk = (Math.round(y * 20) / 20).toFixed(2); porAltura[hk] = (porAltura[hk] || 0) + 1; if (ej.length < 400) ej.push(v); } }
console.log('%s %s (%s) · %s %s %s %s° · HUG=%d%s%s', capa, id, en, rom, mv.n, lado, grados, HUG, SIN_ABRAZO ? ' sin abrazo' : '', SIN_CUBRIR ? ' sin cubrir' : '');
console.log('  vértices %d · desplazamiento máximo %s m · pliegues (aristas que se cierran) %d de %d', nv, mx.toFixed(3), plieg, ar.size);
{ const bb = punta(), kt = TX.k(TC, bb), k00 = TX.k(TC, rig['scapBot_' + Sd]); let n = 0, kmn = 9, kmx = 0; for (let i = 0; i < nv; i++) { const p = [D[i * 3], D[i * 3 + 1], D[i * 3 + 2]]; if (Math.hypot(p[0] - bb[0], p[1] - bb[1], p[2] - bb[2]) > 0.035) continue; const kk = TX.k(TC, p); n++; kmn = Math.min(kmn, kk); kmx = Math.max(kmx, kk); }
  console.log('  ángulo inferior de la escápula: k=%s (reposo %s) · músculo a menos de 3,5 cm: %d vértices, k de %s a %s', kt.toFixed(3), k00.toFixed(3), n, kmn.toFixed(3), kmx.toFixed(3)); }
{ let sep = 0, des = 0; for (let i = 0; i < nv; i++) { const p0 = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], p1 = [D[i * 3], D[i * 3 + 1], D[i * 3 + 2]]; if (p1[1] < TC.y0 || p1[1] > TC.y0 + TC.dy * (TC.nh - 1)) continue; const w = U[0][i * 2]; if (w > 0.6) continue; const dk = (TX.k(TC, p1) - TX.k(TC, p0)) * TX.radio(TC, p1); if (dk > sep) sep = dk; if (w < 0.02) des = Math.max(des, Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2])); }
  console.log('  separación máxima del tórax (vientre, peso < 0,6): %s cm · desplazamiento máximo del origen (peso < 0,02): %s cm', (sep * 100).toFixed(1), (des * 100).toFixed(1)); }
console.log('  por altura (m):', Object.keys(porAltura).sort().map(k => k + ':' + porAltura[k]).join('  '));
if (ej.length) { const med = c => { const a = ej.map(v => INF[v][c]).filter(x => x !== undefined).sort((x, y) => x - y); return a.length ? a[a.length >> 1].toFixed(3) : '-'; };
  console.log('  en los pliegues (mediana): peso %s · libre %s · k0 %s · k1 %s · kt %s · val %s · cubre %s', med('w'), med('libre'), med('k0'), med('k1'), med('kt'), med('val'), med('cubre')); }
