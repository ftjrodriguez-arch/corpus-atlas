/* Contorno real de la parrilla costal, para medir cuánto se separa un punto de las costillas.
   Coordenadas cilíndricas alrededor del eje vertical (x = 0, z = zc): por cada altura (NH filas desde y0, cada dy) y
   cada sector angular (NS), el radio de la superficie externa de costillas, cartílagos, esternón y vértebras torácicas.
   k = r / R(θ, y): 1 sobre las costillas, > 1 por fuera. Una elipse por altura no vale: la caja torácica es más
   cuadrada por detrás y el ángulo inferior de la escápula «parecía» despegado sin estarlo.
   Lo usan movimiento.js (postura de la escápula), simular.js y el material de Unreal (filas 4… de la textura de postura). */
'use strict';
const NH = 32, NS = 32;
function contorno(leeGLB, vista, archivoOseo) {
  const g = leeGLB(archivoOseo), y0 = 1.06, dy = 0.0125, P = [];
  for (const nodo of g.j.nodes) {
    if (nodo.mesh === undefined || !/\brib\b|^Costal cartilage|sternum|Xiphoid|^Vertebra T\d+/i.test((nodo.extras || {}).en || '')) continue;
    const a = vista(g, g.j.meshes[nodo.mesh].primitives[0].attributes.POSITION); for (let i = 0; i < a.length; i += 3) P.push(a[i], a[i + 1], a[i + 2]);
  }
  let z0 = 1e9, z1 = -1e9; for (let i = 0; i < P.length; i += 3) { if (P[i + 1] < 1.15 || P[i + 1] > 1.35) continue; if (P[i + 2] < z0) z0 = P[i + 2]; if (P[i + 2] > z1) z1 = P[i + 2]; }
  const zc = Math.round((z0 + z1) / 2 * 1e4) / 1e4, R = Array.from({ length: NH }, () => new Float32Array(NS));
  for (let i = 0; i < P.length; i += 3) {
    const h = Math.round((P[i + 1] - y0) / dy); if (h < 0 || h >= NH) continue;
    const x = P[i], z = P[i + 2] - zc, r = Math.hypot(x, z), s = Math.floor(((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * NS) % NS;
    if (r > R[h][s]) R[h][s] = r;
  }
  /* huecos (entre costillas, o sectores sin hueso): se rellenan con los vecinos; después se suaviza */
  for (let pasada = 0; pasada < 40; pasada++) { let quedan = 0;
    for (let h = 0; h < NH; h++) for (let s = 0; s < NS; s++) { if (R[h][s] > 0) continue; let a = 0, n = 0;
      for (const [dh, ds] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const hh = h + dh; if (hh < 0 || hh >= NH) continue; const v = R[hh][(s + ds + NS) % NS]; if (v > 0) { a += v; n++; } }
      if (n) R[h][s] = -a / n; else quedan++; }
    for (let h = 0; h < NH; h++) for (let s = 0; s < NS; s++) if (R[h][s] < 0) R[h][s] = -R[h][s];
    if (!quedan) break; }
  for (let pasada = 0; pasada < 2; pasada++) { const C = R.map(f => Float32Array.from(f));
    for (let h = 0; h < NH; h++) for (let s = 0; s < NS; s++) { let a = 0, n = 0, mx = 0;
      for (let dh = -1; dh <= 1; dh++) for (let ds = -1; ds <= 1; ds++) { const hh = h + dh; if (hh < 0 || hh >= NH) continue; const v = C[hh][(s + ds + NS) % NS]; a += v; n++; if (v > mx) mx = v; }
      R[h][s] = 0.5 * (a / n) + 0.5 * mx; } }   /* envolvente: más cerca del máximo que de la media (los espacios intercostales no cuentan) */
  return { y0, dy, zc, nh: NH, ns: NS, r: R.map(f => Array.from(f, v => Math.round(v * 1e4) / 1e4)) };
}
/* radio de las costillas en la dirección de p, interpolado en altura y ángulo */
function radio(T, p) {
  const h = Math.max(0, Math.min(T.nh - 1, (p[1] - T.y0) / T.dy)), h0 = Math.floor(h), h1 = Math.min(h0 + 1, T.nh - 1), fh = h - h0;
  const a = ((Math.atan2(p[2] - T.zc, p[0]) + Math.PI) / (2 * Math.PI)) * T.ns - 0.5, a0 = Math.floor(a), fa = a - a0, s0 = ((a0 % T.ns) + T.ns) % T.ns, s1 = (s0 + 1) % T.ns;
  return (T.r[h0][s0] * (1 - fa) + T.r[h0][s1] * fa) * (1 - fh) + (T.r[h1][s0] * (1 - fa) + T.r[h1][s1] * fa) * fh;
}
const k = (T, p) => Math.hypot(p[0], p[2] - T.zc) / radio(T, p);
module.exports = { contorno, radio, k, NH, NS };
