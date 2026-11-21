#!/usr/bin/env node
/* Corpus Atlas → Unreal: pesos de la cadera para toda la capa muscular (mejora sobre la web, Sprint 1 K y L).

   Antes cada músculo traía su propio reparto: los del muslo, los pesos de la web con mezcla lineal (a 90° de flexión se
   encogían hacia la articulación y se abrían en tiras, cada uno con un reparto distinto); los glúteos, un reparto
   armónico sobre su malla en el que la cara profunda se quedaba con la pelvis y la superficial resbalaba hacia abajo
   (la «bolsa» colgando). Aquí hay UN solo campo de peso para toda la región, igual para todas las piezas:

     · Campo armónico en una rejilla de 5 mm alrededor de la cadera (ecuación de Laplace): vale 0 sobre la pelvis (coxal,
       sacro, cóccix, lumbares), 1 sobre el fémur, y 1 en todo lo que queda por debajo del pliegue glúteo (plano
       perpendicular al fémur a PLIEGUE metros de la cabeza femoral): el muslo entero va rígido con el fémur y la
       transición ocurre solo alrededor de la articulación. Dos puntos vecinos de dos músculos distintos reciben el
       mismo peso, así que se mueven juntos: la masa sigue continua, sin huecos ni piezas que se cruzan.
     · El hueco de la cadera gira en arco (peso × ángulo alrededor de la cabeza femoral) mezclado con la cuerda recta
       (movimiento.json → cadera; postura.js, simular.js y @CAD_CUERDA@ del material): el tejido que se estira por detrás al flexionar se adelgaza
       hacia la articulación en vez de conservar su radio y aumentar de volumen.

   Uso:  node tools/unreal/cadera.js aplicar [hombre,mujer]     reescribe el peso de cadera en muscular.glb (TEXCOORD) y
                                                                los huecos en movimiento.json; después hay que volver a
                                                                aplicar tendones.js (no cambia: va en el color) y reimportar
         node tools/unreal/cadera.js medir [hombre]             volumen, cuánto sobresale por detrás y por debajo y pliegues
                                                                de los glúteos, y huecos entre los músculos del muslo
         node tools/unreal/cadera.js campo [hombre] [R]         corte sagital del campo, para verlo
   movimiento.js lo llama al terminar los pesos de la capa muscular. Variables: CORPUS_IMP (otra carpeta Importar) y
   CORPUS_CUERDA (ver postura.js), para medir el estado anterior. */
'use strict';
const fs = require('fs'), path = require('path');
const PO = require('./postura.js');

const CERO = /^(Hip bone|Sacrum|Coccyx|Vertebra L\d+)$/, UNO = /^(Femur|Patella|Tibia|Fibula)$/;
/* parámetros del material para los huecos de cadera (van en movimiento.json → cadera; los leen postura.js, simular.js y
   corpus_importar.py): mezcla arco/cuerda, radio de la esfera de los huesos de la cadera (m) y cuánto se adelgaza lo que
   queda por fuera: grosor / (1 + adelgaza · ángulo · 6,75·w²·(1 − w)), máximo donde el tejido se acerca al muslo (w = 2/3) */
/* Medido con el glúteo mayor derecho (cuerda / adelgaza → volumen a 90° y 120°, radio posteroinferior a 120°):
   0/0 → 156 %, 174 %, 10,7 cm (arco puro: la bolsa) · 0,5/1 → 91 %, 95 %, 8,4 cm · 1/1 → 90 %, 83 %, 7,4 cm, sin
   tejido bajo la tuberosidad isquiática desde 120° · 1/2 → 81 %, 77 % (adelgaza demasiado). */
const PARAM = { cuerda: 1.0, radio: 0.075, adelgaza: 1.0 };
const H = 0.005;            // celda de la rejilla (m)
const PLIEGUE = 0.105;      // distancia de la cabeza femoral, a lo largo del fémur, a partir de la cual todo va con el fémur
const LD = S => S === 'R' ? 'derecho' : 'izquierdo';
const sat = x => x < 0 ? 0 : x > 1 ? 1 : x;

/* huesos de la región: la mujer trae sus piezas propias (pelvis) y el resto son las del hombre */
function huesosDe(cuerpo) {
  const L = [], propias = new Set();
  for (const c of cuerpo === 'hombre' ? ['hombre'] : [cuerpo, 'hombre']) { let C; try { C = PO.capa(c + '/oseo'); } catch (e) { continue; }
    for (const nd of C.g.nodes) { if (nd.mesh === undefined || propias.has(nd.name)) continue; const en = (nd.extras || {}).en || ''; if (!CERO.test(en) && !UNO.test(en)) continue;
      L.push(PO.pieza(c + '/oseo', nd.name)); if (c === cuerpo) propias.add(nd.name); } }
  return L;
}
/* ───────── campo de peso de una cadera ───────── */
const _F = {};
function campo(cuerpo, S) {
  const kk = cuerpo + S; if (_F[kk]) return _F[kk];
  const C = PO.M.articulaciones[PO.arts.indexOf('hip_' + S)].pivote, K = PO.M.articulaciones[PO.arts.indexOf('knee_' + S)].pivote;
  let a = K.map((v, i) => v - C[i]); const la = Math.hypot(...a); a = a.map(v => v / la);
  const sg = S === 'R' ? -1 : 1, xl = C[0] + sg * 0.21, xm = C[0] - sg * 0.115;      // lateral y medial (3 cm más allá de la línea media)
  const b0 = [Math.min(xl, xm), C[1] - 0.22, -0.21], b1 = [Math.max(xl, xm), C[1] + 0.27, 0.20], huesos = huesosDe(cuerpo);
  const nivel = (h, prev, its, om) => {
    const n = b0.map((v, k) => Math.ceil((b1[k] - v) / h) + 1), nn = n[0] * n[1] * n[2], val = new Float32Array(nn), fijo = new Uint8Array(nn), sy = n[0], sz = n[0] * n[1], med = sg < 0 ? n[0] - 1 : 0;
    const en = p => { const fx = Math.min(n[0] - 1.0001, Math.max(0, (p[0] - b0[0]) / h)), fy = Math.min(n[1] - 1.0001, Math.max(0, (p[1] - b0[1]) / h)), fz = Math.min(n[2] - 1.0001, Math.max(0, (p[2] - b0[2]) / h));
      const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz), tx = fx - ix, ty = fy - iy, tz = fz - iz, q = ix + sy * iy + sz * iz;
      const x00 = val[q] + (val[q + 1] - val[q]) * tx, x10 = val[q + sy] + (val[q + sy + 1] - val[q + sy]) * tx, x01 = val[q + sz] + (val[q + sz + 1] - val[q + sz]) * tx, x11 = val[q + sz + sy] + (val[q + sz + sy + 1] - val[q + sz + sy]) * tx;
      const y0 = x00 + (x10 - x00) * ty, y1 = x01 + (x11 - x01) * ty; return y0 + (y1 - y0) * tz; };
    for (let iz = 0; iz < n[2]; iz++) for (let iy = 0; iy < n[1]; iy++) for (let ix = 0; ix < n[0]; ix++) { const q = ix + sy * iy + sz * iz, p = [b0[0] + ix * h, b0[1] + iy * h, b0[2] + iz * h];
      const s = (p[0] - C[0]) * a[0] + (p[1] - C[1]) * a[1] + (p[2] - C[2]) * a[2];
      if (s > PLIEGUE) { fijo[q] = 1; val[q] = 1; } else if (iy === n[1] - 1 || ix === med) { fijo[q] = 1; val[q] = 0; } else val[q] = prev ? prev(p) : sat(s / PLIEGUE); }
    /* huesos: se muestrea cada triángulo y se fija el nodo más cercano; el fémur después (manda en el acetábulo) */
    for (const pasada of [0, 1]) for (const pz of huesos) { const uno = UNO.test(pz.en); if (uno !== !!pasada || (uno && pz.lado !== LD(S))) continue; const P = pz.P, I = pz.I;
      for (let t = 0; t < I.length; t += 3) { const i0 = I[t] * 3, i1 = I[t + 1] * 3, i2 = I[t + 2] * 3;
        const l = Math.max(Math.hypot(P[i0] - P[i1], P[i0 + 1] - P[i1 + 1], P[i0 + 2] - P[i1 + 2]), Math.hypot(P[i0] - P[i2], P[i0 + 1] - P[i2 + 1], P[i0 + 2] - P[i2 + 2])), m = Math.max(1, Math.ceil(l / (h * 0.6)));
        for (let u = 0; u <= m; u++) for (let v = 0; v <= m - u; v++) { const fu = u / m, fv = v / m, fw = 1 - fu - fv;
          const ix = Math.round((P[i0] * fw + P[i1] * fu + P[i2] * fv - b0[0]) / h), iy = Math.round((P[i0 + 1] * fw + P[i1 + 1] * fu + P[i2 + 1] * fv - b0[1]) / h), iz = Math.round((P[i0 + 2] * fw + P[i1 + 2] * fu + P[i2 + 2] * fv - b0[2]) / h);
          if (ix < 0 || iy < 0 || iz < 0 || ix >= n[0] || iy >= n[1] || iz >= n[2]) continue; const q = ix + sy * iy + sz * iz; fijo[q] = 1; val[q] = pasada; } } }
    /* Gauss-Seidel con sobrerrelajación; las caras de la caja sin valor fijo no dejan pasar flujo */
    let it = 0, dmax = 1;
    for (; it < its && dmax > 2e-5; it++) { dmax = 0;
      for (let iz = 0; iz < n[2]; iz++) for (let iy = 0; iy < n[1]; iy++) { let q = sy * iy + sz * iz;
        for (let ix = 0; ix < n[0]; ix++, q++) { if (fijo[q]) continue; let s = 0, c = 0;
          if (ix > 0) { s += val[q - 1]; c++; } if (ix < n[0] - 1) { s += val[q + 1]; c++; } if (iy > 0) { s += val[q - sy]; c++; } if (iy < n[1] - 1) { s += val[q + sy]; c++; } if (iz > 0) { s += val[q - sz]; c++; } if (iz < n[2] - 1) { s += val[q + sz]; c++; }
          const d = (s / c - val[q]) * om; val[q] += d; if (d > dmax) dmax = d; else if (-d > dmax) dmax = -d; } } }
    return { en, n, its: it, dmax };
  };
  const t0 = Date.now(), g1 = nivel(H * 2, null, 1500, 1.9), g2 = nivel(H, g1.en, 600, 1.9);
  const F = { C, a, b0, b1, n: g2.n, en: p => sat(g2.en(p)), info: `campo ${cuerpo} ${S}: ${g2.n.join('×')} nodos de ${H * 1000} mm, ${g1.its}+${g2.its} pasadas (resto ${g2.dmax.toExponential(1)}), ${Date.now() - t0} ms` };
  return _F[kk] = F;
}

/* ───────── fracción de fibra (glúteo mayor) ─────────
   El glúteo mayor es superficial y resbala sobre lo que tiene debajo: con el campo común su parte baja y medial (fibras
   que nacen del cóccix) se iba entera con el fémur y colgaba bajo el muslo. Su peso es la posición a lo largo de la
   fibra, igual en todo el grosor: 0 en la línea de origen (cresta ilíaca posterior, sacro y cóccix), 1 en la inserción
   (tuberosidad glútea y tracto iliotibial). Dirección de la fibra: del centro de los vértices pegados a la pelvis al
   centro de los pegados al fémur. Girando en arco alrededor de la cabeza femoral, la fibra envuelve la cadera por detrás. */
const FIBRA = /^Gluteus maximus muscle$/, FIB_A = 0.12, FIB_B = 0.88;
function pesosFibra(cuerpo, pz, S) {
  const c = 0.015, G = [new Map(), new Map()];
  for (const h of huesosDe(cuerpo)) { const uno = UNO.test(h.en); if (/Vertebra|Patella|Tibia|Fibula/.test(h.en) || (uno && h.lado !== LD(S))) continue; const g = G[uno ? 1 : 0];
    for (let i = 0; i < h.P.length; i += 3) { const k = Math.floor(h.P[i] / c) + ',' + Math.floor(h.P[i + 1] / c) + ',' + Math.floor(h.P[i + 2] / c); let l = g.get(k); if (!l) g.set(k, l = []); l.push(h.P[i], h.P[i + 1], h.P[i + 2]); } }
  const cerca = (g, x, y, z) => { const fx = Math.floor(x / c), fy = Math.floor(y / c), fz = Math.floor(z / c); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) { const l = g.get((fx + a) + ',' + (fy + b) + ',' + (fz + e)); if (!l) continue; for (let t = 0; t < l.length; t += 3) if ((l[t] - x) ** 2 + (l[t + 1] - y) ** 2 + (l[t + 2] - z) ** 2 < c * c) return true; } return false; };
  const O = [0, 0, 0, 0], I = [0, 0, 0, 0], P = pz.P;
  for (let i = 0; i < pz.nv; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (cerca(G[1], x, y, z)) { I[0] += x; I[1] += y; I[2] += z; I[3]++; } else if (cerca(G[0], x, y, z)) { O[0] += x; O[1] += y; O[2] += z; O[3]++; } }
  if (O[3] < 4 || I[3] < 4) return null;
  let u = [I[0] / I[3] - O[0] / O[3], I[1] / I[3] - O[1] / O[3], I[2] / I[3] - O[2] / O[3]]; const lu = Math.hypot(...u); u = u.map(v => v / lu);
  const s = new Float32Array(pz.nv); let s0 = 1e9, s1 = -1e9; for (let i = 0; i < pz.nv; i++) { const v = P[i * 3] * u[0] + P[i * 3 + 1] * u[1] + P[i * 3 + 2] * u[2]; s[i] = v; if (v < s0) s0 = v; if (v > s1) s1 = v; }
  const W = new Float32Array(pz.nv), dw = new Float32Array(pz.nv), kk = 1 / ((s1 - s0) * (FIB_B - FIB_A)); for (let i = 0; i < pz.nv; i++) { const t = sat(((s[i] - s0) / (s1 - s0) - FIB_A) / (FIB_B - FIB_A)); W[i] = t * t * (3 - 2 * t); dw[i] = 6 * t * (1 - t) * kk; }
  W.grad = i => [u[0] * dw[i], u[1] * dw[i], u[2] * dw[i]];
  return W;
}

/* ───────── pesos nuevos de una pieza: null si la cadera no la toca ───────── */
function pesosPieza(cuerpo, pz) {
  const nv = pz.nv, slots = [];
  for (let k = 0; k < 8; k++) { const jv = pz.js[k]; if (!jv) break; let code = Math.round(Math.abs(jv)); const W = new Float32Array(nv), u = pz.U[k >> 1], o = k & 1; for (let i = 0; i < nv; i++) W[i] = u[i * 2 + o];
    if (code === 31) continue;      /* huecos de datos de una pasada anterior: se rehacen */
    for (let t = 0; t < 3; t++) { const j = code & 31; code >>= 5; if (!j) break; slots.push({ j, W, lin: jv < 0 }); } }
  let toca = false;
  for (const S of ['R', 'L']) { const ji = PO.arts.indexOf('hip_' + S) + 1, e = slots.find(s => s.j === ji); if (!e) continue;
    const F = campo(cuerpo, S), Wf = FIBRA.test(pz.en) && pz.lado === LD(S) ? pesosFibra(cuerpo, pz, S) : null, Wn = new Float32Array(nv); let mn = 1, mx = 0;
    for (let i = 0; i < nv; i++) { let w = Wf ? Wf[i] : F.en([pz.P[i * 3], pz.P[i * 3 + 1], pz.P[i * 3 + 2]]); w = w < 0.002 ? 0 : w > 0.998 ? 1 : w; Wn[i] = w; if (w < mn) mn = w; if (w > mx) mx = w; }
    if (mn >= 1) { let igual = true; for (let i = 0; i < nv && igual; i++) if (e.W[i] < 0.998) igual = false; if (igual) continue; }   // ya iba entera con el fémur
    e.W = Wn; e.lin = false; e.mx = mx; toca = true;
    /* gradiente del peso (para adelgazar lo que se estira): diferencias de 4 mm del campo, o de la fracción de fibra */
    const hh = 0.004, GR = [new Float32Array(nv), new Float32Array(nv), new Float32Array(nv)];
    for (let i = 0; i < nv; i++) { const p = [pz.P[i * 3], pz.P[i * 3 + 1], pz.P[i * 3 + 2]]; for (let c = 0; c < 3; c++) { let g; if (Wf) g = Wf.grad(i)[c]; else { const a = p.slice(), b = p.slice(); a[c] += hh; b[c] -= hh; g = (F.en(a) - F.en(b)) / (2 * hh); } GR[c][i] = sat(0.5 + g * PO.GRAD_K); } }
    e.grad = GR; }
  if (!toca) return null;
  const igual = (A, B) => { for (let v = 0; v < nv; v++) if (Math.abs(A[v] - B[v]) >= 0.01) return false; return true; };
  const G = []; for (const s of slots) { if (s.mx !== undefined && s.mx < 0.002) continue; const g = G[G.length - 1]; if (g && !g.fijo && g.js.length < 3 && g.lin === s.lin && igual(g.W, s.W)) g.js.push(s.j); else G.push({ js: [s.j], W: s.W, lin: s.lin, grad: s.grad }); }
  if (G.length > 8) return { sobra: G.length };
  /* tres huecos de datos (código 31) detrás del de la cadera, si caben y la pieza tiene una sola cadera */
  { const con = G.filter(g => g.grad); if (con.length === 1 && G.length + 3 <= 8 && con[0].js.length === 1) { const k = G.indexOf(con[0]); con[0].fijo = true; G.splice(k + 1, 0, ...con[0].grad.map(W => ({ js: [31], W, lin: false, fijo: true }))); } }
  return { huecos: G.map(g => (g.lin ? -1 : 1) * (g.js[0] + 32 * (g.js[1] || 0) + 1024 * (g.js[2] || 0))), W: G.map(g => g.W) };
}
/* escribe los TEXCOORD de una pieza en su sitio dentro del GLB (los accesores ya existen: 4 pares por vértice) */
function aplicar(cuerpos) {
  const jf = path.join(PO.IMP, 'datos', 'movimiento.json'), M = JSON.parse(fs.readFileSync(jf, 'utf8'));
  for (const cuerpo of cuerpos) { const C = PO.capa(cuerpo + '/muscular'), f = path.join(PO.IMP, cuerpo, 'muscular.glb');
    for (const S of ['R', 'L']) console.log('  ' + campo(cuerpo, S).info);
    const cab = Buffer.alloc(20), fd = fs.openSync(f, 'r+'); fs.readSync(fd, cab, 0, 20, 0); const base = 20 + cab.readUInt32LE(12) + 8; let np = 0, nvt = 0; const sobra = [];
    for (const nd of C.g.nodes) { if (nd.mesh === undefined) continue; const pz = PO.pieza(cuerpo + '/muscular', nd.name), r = pesosPieza(cuerpo, pz); if (!r) continue;
      if (r.sobra) { sobra.push(nd.name + ' (' + pz.en + '): ' + r.sobra); continue; }
      const pr = C.g.meshes[nd.mesh].primitives[0];
      for (let c = 0; c < 4; c++) { const ac = C.g.accessors[pr.attributes['TEXCOORD_' + c]], bv = C.g.bufferViews[ac.bufferView]; if (bv.byteStride && bv.byteStride !== 8) throw new Error('TEXCOORD intercalado en ' + nd.name);
        const uv = new Float32Array(pz.nv * 2), A = r.W[c * 2], B = r.W[c * 2 + 1]; for (let i = 0; i < pz.nv; i++) { uv[i * 2] = A ? A[i] : 0; uv[i * 2 + 1] = B ? B[i] : 0; }
        fs.writeSync(fd, Buffer.from(uv.buffer), 0, uv.byteLength, base + (bv.byteOffset || 0) + (ac.byteOffset || 0)); }
      M.piezas[cuerpo][nd.name] = r.huecos; np++; nvt += pz.nv; }
    fs.closeSync(fd);
    console.log('  %s/muscular.glb: peso de cadera nuevo en %d piezas (%d vértices)%s', cuerpo, np, nvt, sobra.length ? ' · SIN TOCAR por pasar de 8 huecos: ' + sobra.join('; ') : ''); }
  M.cadera = PARAM;
  fs.writeFileSync(jf, JSON.stringify(M));
  console.log('  huecos de las piezas en datos/movimiento.json (copiar a Content/Datos)');
}

/* ───────── medidas ───────── */
const POSTURAS = [['cad60', 'cadera', 0, 60], ['cad90', 'cadera', 0, 90], ['cad120', 'cadera', 0, 120], ['ext30', 'cadera', 1, 30], ['abd45', 'cadera', 2, 45], ['rod135', 'rodilla', 0, 135], ['sent50', 'ej:squat', 'prof', 50]];
const GLUTEOS = /^Gluteus (maximus|medius|minimus) muscle$/;
const MUSLO = /^(Rectus femoris|Vastus (lateralis|medialis|intermedius)|Sartorius|Adductor (magnus|longus|brevis|minimus)|Gracilis|Pectineus|(Long|Short) head of biceps femoris|Semimembranosus|Semitendinosus|Tensor fasciae latae|Gluteus (maximus|medius|minimus))( muscle)?$/;
const volumen = (A, I) => { let v = 0; for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3; v += A[a] * (A[b + 1] * A[c + 2] - A[b + 2] * A[c + 1]) + A[a + 1] * (A[b + 2] * A[c] - A[b] * A[c + 2]) + A[a + 2] * (A[b] * A[c + 1] - A[b + 1] * A[c]); } return v / 6; };
function pliegues(pz, D) { const P = pz.P, I = pz.I;
  if (!pz.ar) { pz.ar = new Map(); for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) { const a = I[t + e], c = I[t + (e + 1) % 3], k = a < c ? a * 4194304 + c : c * 4194304 + a, l = pz.ar.get(k); if (l) l.push(t); else pz.ar.set(k, [t]); } }
  const nr = (A, a, b, c) => { const ux = A[b * 3] - A[a * 3], uy = A[b * 3 + 1] - A[a * 3 + 1], uz = A[b * 3 + 2] - A[a * 3 + 2], vx = A[c * 3] - A[a * 3], vy = A[c * 3 + 1] - A[a * 3 + 1], vz = A[c * 3 + 2] - A[a * 3 + 2]; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
  const cs = (a, b) => (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b) + 1e-20); let n = 0;
  for (const ts of pz.ar.values()) { if (ts.length !== 2) continue; const [t0, t1] = ts; if (cs(nr(P, I[t0], I[t0 + 1], I[t0 + 2]), nr(P, I[t1], I[t1 + 1], I[t1 + 2])) > 0.5 && cs(nr(D, I[t0], I[t0 + 1], I[t0 + 2]), nr(D, I[t1], I[t1 + 1], I[t1 + 2])) < -0.3) n++; }
  return n; }
function medir(cuerpo, S) {
  const C = PO.capa(cuerpo + '/muscular'), pzs = C.g.nodes.filter(n => n.mesh !== undefined && MUSLO.test((n.extras || {}).en || '') && n.extras.lado === LD(S)).map(n => PO.pieza(cuerpo + '/muscular', n.name));
  const hip = PO.M.articulaciones[PO.arts.indexOf('hip_' + S)].pivote;
  /* parejas de contacto: vértices de dos músculos distintos a menos de 3 mm en reposo. Si en una postura se separan, hay hueco. */
  const cs = 0.003, G = new Map(); pzs.forEach((pz, pi) => { for (let i = 0; i < pz.nv; i += 2) { const k = Math.floor(pz.P[i * 3] / cs) + ',' + Math.floor(pz.P[i * 3 + 1] / cs) + ',' + Math.floor(pz.P[i * 3 + 2] / cs); let l = G.get(k); if (!l) G.set(k, l = []); l.push(pi, i); } });
  const pares = []; pzs.forEach((pz, pi) => { for (let i = 0; i < pz.nv; i += 3) { const x = pz.P[i * 3], y = pz.P[i * 3 + 1], z = pz.P[i * 3 + 2], fx = Math.floor(x / cs), fy = Math.floor(y / cs), fz = Math.floor(z / cs); let bd = cs * cs, bp = -1, bi = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const l = G.get((fx + a) + ',' + (fy + b) + ',' + (fz + c)); if (!l) continue; for (let t = 0; t < l.length; t += 2) { if (l[t] <= pi) continue; const q = pzs[l[t]].P, j = l[t + 1] * 3, d = (q[j] - x) ** 2 + (q[j + 1] - y) ** 2 + (q[j + 2] - z) ** 2; if (d < bd) { bd = d; bp = l[t]; bi = l[t + 1]; } } }
    if (bp >= 0) pares.push([pi, i, bp, bi, Math.sqrt(bd)]); } });
  /* grosor: distancia de cada vértice del glúteo mayor al hueso más cercano (pelvis quieta, fémur en su postura) */
  const hs = huesosDe(cuerpo).filter(h => !/Patella|Tibia|Fibula|Vertebra/.test(h.en) && (!h.lado || h.lado === LD(S)));
  const grosor = (D, J) => { const c = 0.02, Hh = new Map(); for (const h of hs) { const B = UNO.test(h.en) ? PO.deformar(h, J) : h.P; for (let i = 0; i < B.length; i += 6) { const k = Math.floor(B[i] / c) + ',' + Math.floor(B[i + 1] / c) + ',' + Math.floor(B[i + 2] / c); let l = Hh.get(k); if (!l) Hh.set(k, l = []); l.push(B[i], B[i + 1], B[i + 2]); } }
    const ds = []; for (let i = 0; i < D.length; i += 3) { const fx = Math.floor(D[i] / c), fy = Math.floor(D[i + 1] / c), fz = Math.floor(D[i + 2] / c); let bd = 1e9;
      for (let r = 1; r <= 6 && bd > ((r - 1) * c) ** 2; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let e = -r; e <= r; e++) { if (Math.max(Math.abs(a), Math.abs(b), Math.abs(e)) !== r && r > 1) continue; const l = Hh.get((fx + a) + ',' + (fy + b) + ',' + (fz + e)); if (!l) continue; for (let t = 0; t < l.length; t += 3) { const d = (l[t] - D[i]) ** 2 + (l[t + 1] - D[i + 1]) ** 2 + (l[t + 2] - D[i + 2]) ** 2; if (d < bd) bd = d; } }
      ds.push(Math.sqrt(bd)); } ds.sort((x, y) => x - y); return [ds[Math.floor(ds.length * 0.5)], ds[Math.floor(ds.length * 0.95)], ds[ds.length - 1]]; };
  const gl = pzs.filter(p => GLUTEOS.test(p.en)), gm = gl.find(p => /maximus/.test(p.en));
  const ext = D => { let zmin = 9, ymin = 9, rmax = 0; for (let i = 0; i < D.length; i += 3) { if (D[i + 2] < zmin) zmin = D[i + 2]; if (D[i + 1] < ymin) ymin = D[i + 1]; const r = Math.hypot(D[i + 1] - hip[1], D[i + 2] - hip[2]); if (r > rmax) rmax = r; } return [zmin, ymin, rmax]; };
  const v0 = gl.map(p => volumen(p.P, p.I)), e0 = ext(gm.P), g0 = grosor(gm.P, PO.articulaciones(null));
  console.log('%s %s · cadera %j · %d músculos de cadera y muslo, %d parejas de contacto · glúteo mayor en reposo: %s cm³, %s cm por detrás de la cabeza femoral, borde inferior %s cm por debajo',
    cuerpo, S, PO.CAD, pzs.length, pares.length, (v0[gl.indexOf(gm)] * 1e6).toFixed(0), ((hip[2] - e0[0]) * 100).toFixed(1), ((hip[1] - e0[1]) * 100).toFixed(1));
  console.log('  radio máximo del glúteo mayor en reposo (distancia a la cabeza femoral en el plano sagital): %s cm', (e0[2] * 100).toFixed(1));
  console.log('  grosor del glúteo mayor en reposo (distancia al hueso): mediana %s, p95 %s, máximo %s cm', ...g0.map(v => (v * 100).toFixed(1)));
  const filas = [];
  for (const [nm, rom, mi, gr] of POSTURAS) { const J = PO.articulaciones(rom, mi, S, gr), D = pzs.map(p => PO.deformar(p, J));
    const gro = grosor(D[pzs.indexOf(gm)], J), vol = gl.map((p, k) => volumen(D[pzs.indexOf(p)], p.I) / v0[k]), Dm = D[pzs.indexOf(gm)], e = ext(Dm), pl = gl.map(p => pliegues(p, D[pzs.indexOf(p)]));
    const sep = pares.map(([a, i, b, j, d0]) => Math.hypot(D[a][i * 3] - D[b][j * 3], D[a][i * 3 + 1] - D[b][j * 3 + 1], D[a][i * 3 + 2] - D[b][j * 3 + 2]) - d0).sort((x, y) => x - y);
    let plm = 0; pzs.forEach((p, k) => { if (!GLUTEOS.test(p.en)) plm += pliegues(p, D[k]); });
    const f = { postura: nm, 'vol. mayor %': Math.round(vol[gl.indexOf(gm)] * 100), 'vol. medio/menor %': gl.filter(p => p !== gm).map(p => Math.round(vol[gl.indexOf(p)] * 100)).join('/'),
      'grosor med/p95/máx cm': gro.map(v => (v * 100).toFixed(1)).join(' / '), 'radio máx cm': +(e[2] * 100).toFixed(1), 'detrás cm': +((e0[0] - e[0]) * 100).toFixed(1), 'debajo cm': +((e0[1] - e[1]) * 100).toFixed(1), 'pliegues glúteos': pl.join('/'), 'pliegues muslo': plm,
      'huecos >5 mm': sep.filter(x => x > 0.005).length, 'hueco p95 mm': +(sep[Math.floor(sep.length * 0.95)] * 1000).toFixed(1), 'hueco máx mm': +(sep[sep.length - 1] * 1000).toFixed(0) };
    filas.push(f); }
  console.table(filas);
  console.log('  detrás / debajo: cuánto más atrás (−z) y más abajo (−y) que en reposo llega el glúteo mayor, en el marco de la pelvis. Volumen: malla cerrada, % del reposo.');
  return filas;
}

module.exports = { campo, pesosPieza, aplicar, medir, PLIEGUE, H };
if (require.main === module) {
  const [orden, a1, a2] = process.argv.slice(2);
  if (orden === 'aplicar') aplicar((a1 || 'hombre,mujer').split(','));
  else if (orden === 'medir') medir(a1 || 'hombre', a2 || 'R');
  else if (orden === 'campo') { const F = campo(a1 || 'hombre', a2 || 'R'); console.log(F.info);
    /* corte sagital por la cabeza femoral: filas de arriba abajo, columnas de atrás adelante, peso × 9 */
    for (let y = F.b1[1]; y >= F.b0[1]; y -= 0.015) { let s = ''; for (let z = F.b0[2]; z <= F.b1[2]; z += 0.0075) s += Math.round(F.en([F.C[0], y, z]) * 9); console.log(y.toFixed(3) + ' ' + s); } }
  else console.log('uso: node tools/unreal/cadera.js aplicar|medir|campo …');
}
