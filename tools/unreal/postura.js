/* Corpus Atlas → Unreal: la cuenta del nodo «Postura» del material (HLSL_POSTURA de corpus_importar.py) en la CPU,
   como módulo. La usan simular.js (medir pliegues) y blender/posar.js (dar a Blender huesos y músculos ya colocados).
   Si se cambia el HLSL, hay que cambiar esto igual. */
'use strict';
const fs = require('fs'), path = require('path');
const TX = require('./torax.js');
/* CORPUS_IMP: otra carpeta Importar (p. ej. una copia de antes de un cambio, para medir antes y después) */
const IMP = process.env.CORPUS_IMP ? path.resolve(process.env.CORPUS_IMP) : path.resolve(__dirname, '..', '..', 'unreal', 'CorpusAtlas', 'Importar');
const M = JSON.parse(fs.readFileSync(path.join(IMP, 'datos', 'movimiento.json'), 'utf8'));
const rig = JSON.parse(fs.readFileSync(path.join(IMP, 'datos', 'rig.json'), 'utf8'));
const NA = M.articulaciones.length, arts = M.articulaciones.map(a => a.id), TC = M.torax;
const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]], dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
const gira = (p, pv, e, an) => { if (!an) return p.slice(); const s = Math.sin(an), c = Math.cos(an), d = [p[0] - pv[0], p[1] - pv[1], p[2] - pv[2]], cr = cross(e, d), dt = dot(e, d); return [0, 1, 2].map(i => d[i] * c + cr[i] * s + e[i] * dt * (1 - c) + pv[i]); };
/* Cadera: mezcla entre girar en arco (0) y la cuerda recta (1) en los huecos de cadera que giran en arco. Igual que
   @CAD_CUERDA@ de HLSL_POSTURA (corpus_importar.py); CORPUS_CUERDA la cambia para probar (0 = como antes del Sprint 1 K). */
const CAD = Object.assign({ cuerda: 0, radio: 0.075, adelgaza: 0 }, M.cadera || {}); for (const k of ['cuerda', 'radio', 'adelgaza']) { const v = process.env['CORPUS_' + k.toUpperCase()]; if (v !== undefined) CAD[k] = +v; }
const CUERDA = CAD.cuerda, HIPS = [arts.indexOf('hip_R'), arts.indexOf('hip_L')];
const GRAD_K = 0.005;      /* gradiente del peso (1/m) → 0,5 + g · GRAD_K en el hueco de datos */
const sat = x => Math.max(0, Math.min(1, x)), ss = (a, c, x) => { const t = sat((x - a) / (c - a)); return t * t * (3 - 2 * t); };

const GLB = {};
function capa(nombre) {
  if (GLB[nombre]) return GLB[nombre];
  const b = fs.readFileSync(path.join(IMP, nombre + '.glb')), lj = b.readUInt32LE(12), g = JSON.parse(b.slice(20, 20 + lj)), bin = b.slice(20 + lj + 8);
  const acc = i => { const a = g.accessors[i], v = g.bufferViews[a.bufferView], nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], o = bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
    if (a.componentType === 5126) return new Float32Array(bin.buffer.slice(o, o + a.count * nc * 4)); if (a.componentType === 5125) return new Uint32Array(bin.buffer.slice(o, o + a.count * 4)); return new Uint16Array(bin.buffer.slice(o, o + a.count * 2)); };
  const porId = {}; for (const n of g.nodes) if (n.mesh !== undefined) porId[n.name] = n;
  return GLB[nombre] = { g, acc, porId };
}
/* pieza: posiciones de reposo, índices, pesos por hueco y datos por pieza (los mismos que ACorpusCuerpo pone en los datos primitivos) */
function pieza(nombreCapa, id) {
  const C = capa(nombreCapa), nodo = C.porId[id]; if (!nodo) return null;
  const cuerpo = nombreCapa.split('/')[0], pr = C.g.meshes[nodo.mesh].primitives[0];
  const P = C.acc(pr.attributes.POSITION), I = C.acc(pr.indices), U = [0, 1, 2, 3].map(c => pr.attributes['TEXCOORD_' + c] !== undefined ? C.acc(pr.attributes['TEXCOORD_' + c]) : new Float32Array(P.length / 3 * 2));
  const en = (nodo.extras || {}).en || '', lado = (nodo.extras || {}).lado || '';
  return { id, en, lado, P, I, U, nv: P.length / 3, js: ((M.piezas[cuerpo] || {})[id] || []).concat([0, 0, 0, 0, 0, 0, 0, 0, 0]).slice(0, 9),
    hug: ((M.abrazo || {})[cuerpo] || []).includes(id) ? (/^Latissimus/.test(en) ? 2 : 1) : 0, ins: ((M.insercion || {})[cuerpo] || {})[id] || null };
}
/* articulaciones de una postura de la tabla ROM */
function articulaciones(rom, mi, lado, grados) {
  const J = arts.map((_, i) => ({ e: [0, 0, 0], a: 0, t: [0, 0, 0], p: M.articulaciones[i].pivote }));
  /* «ej:<id del ejercicio>» con la variante en mi y el % del ciclo en grados: un instante de un ejercicio horneado */
  if (rom && rom.startsWith('ej:')) { const e = M.ejercicios.lista.find(x => x.id === rom.slice(3)), v = e.variantes.find(x => x.id === mi) || e.variantes[e.inicial], fr = v.frames[Math.min(v.frames.length - 1, Math.round(+grados / e.paso))];
    for (let k = 0; k < fr.length; k += 8) { const j = J[fr[k]]; j.e = [fr[k + 1], fr[k + 2], fr[k + 3]]; j.a = fr[k + 4]; j.t = [fr[k + 5], fr[k + 6], fr[k + 7]]; } return J; }
  if (rom) { const mv = M.rom.find(r => r.id === rom).movs[+mi], F = mv[lado] || mv.R, x = Math.min(+grados, mv.max) / mv.paso, i0 = Math.min(Math.floor(x), F.length - 1), fr = F[Math.min(Math.round(x), F.length - 1)];
    for (let k = 0; k < fr.length; k += 8) { const j = J[fr[k]]; j.e = [fr[k + 1], fr[k + 2], fr[k + 3]]; j.a = fr[k + 4]; j.t = [fr[k + 5], fr[k + 6], fr[k + 7]]; } }
  return J;
}
/* un vértice: opciones {abrazo:false} o {cubrir:false} apagan esos pasos */
function vertice(pz, J, g0, ws, op) {
  op = op || {}; let gg = g0.slice(), hecho = false, wl = 0, ip = pz.ins ? pz.ins.slice() : null; const fibra = !!ip, Sd = g0[0] < 0 ? 'R' : 'L';
  for (let k = 0; k < 9; k++) {
    const jv = pz.js[k]; let code = Math.round(Math.abs(jv)); if (code === 31) continue;      /* hueco de datos (gradiente del peso de cadera), no es una articulación */
    const tronco = jv === 0 || (code & 31) >= NA - 2;
    if (!hecho && tronco) { hecho = true;
      if (pz.hug > 0 && wl > 0.0005 && op.abrazo !== false) {
        const quieto = gg[0] === g0[0] && gg[1] === g0[1] && gg[2] === g0[2], k0 = TX.k(TC, g0), R1 = TX.radio(TC, gg), k1 = quieto ? k0 : Math.hypot(gg[0], gg[2] - TC.zc) / R1, libre = sat((wl - 0.25) / 0.6), l4 = libre ** 4;
        const kmax = k0 + (0.006 + libre * libre * 0.07 + libre * 0.03 + l4 * l4 * 1.5) / R1, kmin = k0 < 1 ? k0 : 1 + (k0 - 1) * 0.6;
        const kt = Math.max(kmin, k1 > k0 ? k0 + (kmax - k0) * Math.tanh((k1 - k0) / (kmax - k0)) : k1), hy = (gg[1] - TC.y0) / TC.dy, val = sat(hy) * sat(TC.nh - 1 - hy) * sat(pz.hug), s = 1 + (kt / Math.max(k1, 1e-4) - 1) * val;
        gg[0] *= s; gg[2] = TC.zc + (gg[2] - TC.zc) * s;
        /* cubrir la punta de la escápula: solo lo que la punta sube respecto al reposo (en reposo la malla ya la cubre: desplazamiento cero) */
        if (pz.hug > 1.5 && op.cubrir !== false) { const ja = J[arts.indexOf('acr_' + Sd)], jc = J[arts.indexOf('sc_' + Sd)], b0 = rig['scapBot_' + Sd]; let bb = b0.slice(); bb = gira(bb, ja.p, ja.e, ja.a); bb = gira(bb, jc.p, jc.e, jc.a);
          const kb = TX.k(TC, bb) + 0.004 / TX.radio(TC, bb), kg = TX.k(TC, gg), cerca = 1 - ss(0.04, 0.20, Math.hypot(gg[0] - bb[0], gg[1] - bb[1], gg[2] - bb[2])), 
            kb0 = TX.k(TC, b0) + 0.004 / TX.radio(TC, b0), cerca0 = 1 - ss(0.04, 0.20, Math.hypot(g0[0] - b0[0], g0[1] - b0[1], g0[2] - b0[2])), s2 = (kg + Math.max(0, cerca * Math.max(0, kb - 1.0) - cerca0 * Math.max(0, kb0 - 1.0))) / Math.max(kg, 1e-4);
          gg[0] *= s2; gg[2] = TC.zc + (gg[2] - TC.zc) * s2; } } }
    if (jv === 0) break;
    const w = sat(ws[k]); if (k === 0 && !tronco) wl = w; const lin = jv < 0;
    for (let t = 0; t < 3; t++) { const j = (code & 31) - 1; code >>= 5; if (j < 0) break; const o = J[j]; if (!o.a && !o.t.some(x => x)) continue;
      if (fibra && lin) { const ri = gira(ip, o.p, o.e, o.a); if (w >= 0.0005) { const r = gira(gg, o.p, o.e, o.a), q = w * w; gg = gg.map((x, i) => { const tx = x + w * (ri[i] - ip[i]); return tx + (r[i] - tx) * q; }); } ip = ri; }
      else if (w >= 0.0005) { const r = gira(gg, o.p, o.e, lin ? o.a : o.a * w);
        if (lin) gg = gg.map((x, i) => x + (r[i] - x) * w);
        else if ((CUERDA > 0 || CAD.adelgaza > 0) && w < 0.9995 && HIPS.includes(j)) { const rc = gira(gg, o.p, o.e, o.a); gg = gg.map((x, i) => r[i] + (x + (rc[i] - x) * w - r[i]) * CUERDA);
          /* lo que queda por fuera de la esfera de los huesos de la cadera se adelgaza hacia ella: el tejido que se estira no engorda */
          /* estiramiento local = ángulo · ∇w · (eje × radio): cuánto se alarga el tejido en la dirección del giro. El gradiente del
             peso va en los tres huecos de datos (código 31) que siguen al de la cadera. */
          if (CAD.adelgaza > 0 && Math.abs(pz.js[k + 1]) === 31 && Math.abs(pz.js[k + 2]) === 31 && Math.abs(pz.js[k + 3]) === 31) { const gr = [ws[k + 1], ws[k + 2], ws[k + 3]].map(v => (v - 0.5) / GRAD_K), q0 = g0.map((x, i) => x - o.p[i]), vel = cross(o.e, q0);
            const lam = Math.max(1, Math.min(3.5, 1 + CAD.adelgaza * o.a * dot(gr, vel))), d = gg.map((x, i) => x - o.p[i]), rr = Math.hypot(d[0], d[1], d[2]);
            if (lam > 1 && rr > CAD.radio) { const s = (CAD.radio + (rr - CAD.radio) / lam) / rr; gg = d.map((x, i) => o.p[i] + x * s); } } }
        else gg = r; }
      if (w < 0.0005) continue; gg = gg.map((x, i) => x + o.t[i] * w); }
  }
  return gg;
}
function deformar(pz, J, op) {
  const D = new Float32Array(pz.nv * 3);
  for (let i = 0; i < pz.nv; i++) { const ws = [pz.U[0][i * 2], pz.U[0][i * 2 + 1], pz.U[1][i * 2], pz.U[1][i * 2 + 1], pz.U[2][i * 2], pz.U[2][i * 2 + 1], pz.U[3][i * 2], pz.U[3][i * 2 + 1], 0]; D.set(vertice(pz, J, [pz.P[i * 3], pz.P[i * 3 + 1], pz.P[i * 3 + 2]], ws, op), i * 3); }
  return D;
}
module.exports = { GRAD_K, CAD, CUERDA, IMP, M, rig, TC, TX, arts, pieza, capa, articulaciones, deformar, vertice, gira };
