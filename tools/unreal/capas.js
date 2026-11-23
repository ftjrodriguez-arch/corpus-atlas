#!/usr/bin/env node
/* Corpus Atlas → Unreal: ¿qué pieza queda por fuera? Compara dos piezas de la capa muscular vistas desde detrás
   (o desde delante) en una postura, con la misma cuenta que el material (postura.js) o con el correctivo elástico.

   Uso: node tools/unreal/capas.js <id de fuera> <id de dentro> [rom mov lado grados] [--frente] [--corr] [--celda=4] [--cuerpo=mujer]
   Ej.: node tools/unreal/capas.js n1598 n1610                    trapecio inferior sobre dorsal ancho, en reposo
        node tools/unreal/capas.js n1598 n1610 hombro 2 R 150 --corr
   Salida: celdas (mm de lado) donde están las dos piezas, en cuántas la de «dentro» asoma por fuera de la de «fuera»,
   cuánto (máximo y mediana) y a qué altura. También el desplazamiento máximo de cada pieza respecto al reposo. */
'use strict';
const PO = require('./postura.js');
const arg = process.argv.slice(2), ops = arg.filter(a => a.startsWith('--')), pos = arg.filter(a => !a.startsWith('--'));
const [idF, idD, rom, mi, lado, grados] = pos;
const op = n => { const o = ops.find(x => x.startsWith('--' + n + '=')); return o ? o.split('=')[1] : null; };
const FRENTE = ops.includes('--frente'), CORR = ops.includes('--corr'), CEL = (+op('celda') || 4) / 1000, cuerpo = op('cuerpo') || 'hombre';
const pieza = id => PO.pieza(cuerpo + '/muscular', id) || PO.pieza('hombre/muscular', id);
const J = PO.articulaciones(rom || null, mi, lado, grados);
let CO = null; if (CORR) CO = require('./correctivos.js');
function posada(id) {
  const pz = pieza(id); if (!pz) { console.error('no está ' + id); process.exit(1); }
  let D = null; if (CORR && rom) D = CO.deformar(cuerpo, id, rom, +mi, lado, +grados);
  if (!D) D = PO.deformar(pz, J);
  let mx = 0; for (let i = 0; i < pz.nv; i++) mx = Math.max(mx, Math.hypot(D[i * 3] - pz.P[i * 3], D[i * 3 + 1] - pz.P[i * 3 + 1], D[i * 3 + 2] - pz.P[i * 3 + 2]));
  return { pz, D, mx };
}
/* profundidad de la cara de fuera por celda (x, y): detrás = z mínima; delante = z máxima. Se muestrea cada triángulo. */
function mapa(o) {
  const { pz, D } = o, m = new Map(), sg = FRENTE ? -1 : 1;
  const pon = (x, y, z) => { const k = Math.floor(x / CEL) + ',' + Math.floor(y / CEL), v = m.get(k); if (v === undefined || sg * z < sg * v) m.set(k, z); };
  for (let t = 0; t < pz.I.length; t += 3) { const a = pz.I[t] * 3, b = pz.I[t + 1] * 3, c = pz.I[t + 2] * 3;
    const l = Math.max(Math.hypot(D[a] - D[b], D[a + 1] - D[b + 1]), Math.hypot(D[a] - D[c], D[a + 1] - D[c + 1]), Math.hypot(D[b] - D[c], D[b + 1] - D[c + 1])), n = Math.max(1, Math.ceil(l / (CEL * 0.5)));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) { const u = i / n, v = j / n, w = 1 - u - v; pon(D[a] * w + D[b] * u + D[c] * v, D[a + 1] * w + D[b + 1] * u + D[c + 1] * v, D[a + 2] * w + D[b + 2] * u + D[c + 2] * v); } }
  return m;
}
const F = posada(idF), Dn = posada(idD), mF = mapa(F), mD = mapa(Dn), sg = FRENTE ? -1 : 1;
let comunes = 0; const mal = [];
for (const [k, zf] of mF) { const zd = mD.get(k); if (zd === undefined) continue; comunes++; const e = sg * (zf - zd); if (e > 1e-5) mal.push([e, k]); }
mal.sort((a, b) => b[0] - a[0]);
console.log('%s (%s) por fuera de %s (%s) · %s · vista %s · celdas de %d mm%s', idF, F.pz.en, idD, Dn.pz.en, rom ? `${rom} ${mi} ${lado} ${grados}°` : 'reposo', FRENTE ? 'anterior' : 'posterior', CEL * 1000, CORR ? ' · con correctivo' : '');
console.log('  desplazamiento máximo respecto al reposo: %s %s mm · %s %s mm', idF, (F.mx * 1000).toFixed(3), idD, (Dn.mx * 1000).toFixed(3));
console.log('  celdas comunes %d · la de dentro asoma en %d (%s %%) · máximo %s mm · mediana %s mm · más de 1 mm: %d', comunes, mal.length, comunes ? (100 * mal.length / comunes).toFixed(1) : '0',
  mal.length ? (mal[0][0] * 1000).toFixed(2) : '0', mal.length ? (mal[mal.length >> 1][0] * 1000).toFixed(2) : '0', mal.filter(x => x[0] > 0.001).length);
if (mal.length) console.log('  peores (x, y en m → mm): ' + mal.slice(0, 6).map(x => { const [a, b] = x[1].split(',').map(Number); return `(${((a + 0.5) * CEL).toFixed(3)}, ${((b + 0.5) * CEL).toFixed(3)}) ${(x[0] * 1000).toFixed(2)}`; }).join('  '));
