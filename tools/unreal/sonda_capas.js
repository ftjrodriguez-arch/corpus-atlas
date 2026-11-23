#!/usr/bin/env node
/* Corpus Atlas → Unreal: sonda de las capas entre músculos de los correctivos del hombro (correctivos_capas.json).
   Resuelve los correctivos dos veces, sin y con el contacto entre músculos, y por cada músculo superficial cuenta las celdas
   en que un profundo vecino asoma por fuera de su cara externa: alrededor del tórax (altura 12,5 mm × 64 sectores, como la
   sonda del remo) o, en el deltoides, en un cubo de 16 × 16 celdas por cara alrededor de la cabeza del húmero.
   Da también pliegues (aristas que se cierran, como `correctivos.js medir`) y cuánto se mueve el superficial entre las dos
   soluciones (media y máximo, mm): si el contacto hunde o abomba el músculo, se ve ahí.

   Uso:  node tools/unreal/sonda_capas.js <rom|ej:id> <mov|variante|-> [cuadros] [cuerpo] [filtro] [--pesos] [--L]
     rangos: cuadros en grados («hombro 2 90,150», «escapula 0 40»); ejercicios: índices de cuadro («ej:row - 0,25,49»).
     filtro: expresión regular sobre el nombre en inglés del superficial («Latissimus»).
     --pesos: mide los profundos solo con sus pesos (como la sonda antigua) aunque tengan correctivo. --L: lado izquierdo. */
'use strict';
const CO = require('./correctivos.js'), PO = require('./postura.js'), TC = PO.TC;
const args = process.argv.slice(2), PESOS = args.includes('--pesos'), LADO = args.includes('--L') ? 'L' : 'R', pos = args.filter(a => !a.startsWith('--'));
const [rom, mov = '-', lst = '', cuerpo = 'hombre', filtro = ''] = pos;
if (!rom) { console.log('uso: node tools/unreal/sonda_capas.js <rom|ej:id> <mov|variante|-> [cuadros] [cuerpo] [filtro] [--pesos] [--L]'); process.exit(1); }
const EJ = rom.startsWith('ej:'); let mi, gs, idx;
if (EJ) { const e = PO.M.ejercicios.lista.find(x => x.id === rom.slice(3)), v = mov === '-' ? (e.variantes[e.inicial] || e.variantes[0]) : e.variantes.find(x => x.id === mov); mi = v.id; gs = v.frames.map((_, k) => k * e.paso);
  idx = (lst || '0,' + Math.round((gs.length - 1) / 2) + ',' + (gs.length - 1)).split(',').map(Number); }
else { mi = +mov; const L = (lst || String(PO.M.rom.find(r => r.id === rom).movs[mi].max)).split(',').map(Number), max = Math.max(...L); gs = []; for (let g = 0; g < max; g += 5) gs.push(g); gs.push(max);
  for (const g of L) if (!gs.includes(g)) gs.push(g); gs.sort((a, b) => a - b); idx = L.map(g => gs.indexOf(g)); }
const lados = EJ ? ['R', 'L'] : [LADO], t0 = Date.now();
const PRs = [].concat(...lados.map(S => CO.ids(cuerpo, S).map(id => CO.preparar(cuerpo, id, S)))).filter(Boolean).sort((x, y) => (y.profundo ? 1 : 0) - (x.profundo ? 1 : 0));
const re = filtro ? new RegExp(filtro) : null, SUP = PRs.filter(PR => PR.capa && PR.capa.prof.length && (!re || re.test(PR.mus.en)));
console.log('%s %s · %d cuadros · %d piezas, %d superficiales · preparar %d s', rom, mi, gs.length, PRs.length, SUP.length, Math.round((Date.now() - t0) / 1000));
const resolverTodo = () => { const sol = new Map(); for (const PR of PRs) sol.set(PR, CO.resolver(PR, rom, mi, gs)); return sol; };
CO.OPC.capas = false; const S0 = resolverTodo(), t1 = Date.now();
CO.OPC.capas = true; const S1 = resolverTodo(), t2 = Date.now();
console.log('resolver: sin capas %d s · con capas %d s', Math.round((t1 - t0) / 1000), Math.round((t2 - t1) / 1000));

const NS = 64, DY = 0.0125, Y0 = 0.6, NH = 104;
function medida(PR, sol, k, Dsup) {
  const J = PO.articulaciones(rom, mi, PR.S, gs[k]), cap = PR.capa, F = cap.forma === 'tronco' ? null : { forma: cap.forma, c: CO.centroHombro(cap, J) };
  let R_ = 0; const cel = (x, y, z) => { if (!F) { const h = Math.floor((y - Y0) / DY); if (h < 0 || h >= NH) return -1; const dz = z - TC.zc; R_ = Math.hypot(x, dz); return h * NS + Math.floor(((Math.atan2(dz, x) + Math.PI) / (2 * Math.PI)) * NS) % NS; }
    const c = CO.celdaCapa(F, x, y, z); R_ = F.r; return c; };
  const Lmax = new Float32Array(NH * NS).fill(-1);
  for (let q = 0; q < PR.mus.nv; q++) { const c = cel(Dsup[q * 3], Dsup[q * 3 + 1], Dsup[q * 3 + 2]); if (c >= 0 && R_ > Lmax[c]) Lmax[c] = R_; }
  const peor = {}; let n1 = 0, n5 = 0, hondo = 0;
  for (const D of cap.prof) { const dPR = PESOS ? null : PRs.find(q => q.claveRes === D.clave), P = dPR ? CO.aplicar(dPR, sol.get(dPR)[k].X) : PO.deformar(D.pz, J), vistas = new Set();
    for (let q = 0; q < D.pz.nv; q++) { const c = cel(P[q * 3], P[q * 3 + 1], P[q * 3 + 2]); if (c < 0 || Lmax[c] < 0 || vistas.has(c)) continue; const d = R_ - Lmax[c];
      if (d > 0.001) { vistas.add(c); n1++; if (d > 0.005) n5++; if (d > hondo) hondo = d; peor[D.pz.en] = Math.max(peor[D.pz.en] || 0, d); } } }
  return { n1, n5, hondo, peor, plieg: CO.medir(PR, Dsup, J).plieg };
}
const tot = [[0, 0, 0], [0, 0, 0]];
for (const PR of SUP) for (const k of idx) {
  const D0 = CO.aplicar(PR, S0.get(PR)[k].X), D1 = CO.aplicar(PR, S1.get(PR)[k].X), m0 = medida(PR, S0, k, D0), m1 = medida(PR, S1, k, D1);
  let sm = 0, mx = 0; for (let q = 0; q < PR.mus.nv; q++) { const d = Math.hypot(D1[q * 3] - D0[q * 3], D1[q * 3 + 1] - D0[q * 3 + 1], D1[q * 3 + 2] - D0[q * 3 + 2]); sm += d; if (d > mx) mx = d; }
  tot[0][0] += m0.n1; tot[0][1] += m0.n5; tot[0][2] += m0.plieg; tot[1][0] += m1.n1; tot[1][1] += m1.n5; tot[1][2] += m1.plieg;
  const nom = PR.mus.en.replace(/ muscle| part of| head of/g, '').slice(0, 24) + ' ' + PR.S;
  console.log('%s cuadro %d (%s): asoman %d→%d celdas (>5 mm %d→%d, hondo %s→%s mm) · pliegues %d→%d · movido media %s / máx %s mm%s', nom.padEnd(27), k, gs[k], m0.n1, m1.n1, m0.n5, m1.n5,
    (m0.hondo * 1000).toFixed(0), (m1.hondo * 1000).toFixed(0), m0.plieg, m1.plieg, (sm / PR.mus.nv * 1000).toFixed(1), (mx * 1000).toFixed(1),
    m1.n1 ? ' · quedan: ' + Object.entries(m1.peor).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a, b]) => a.replace(/ muscle/, '') + ' ' + (b * 1000).toFixed(0) + ' mm').join(', ') : ''); }
console.log('TOTAL: asoman %d→%d celdas (>5 mm %d→%d) · pliegues %d→%d', tot[0][0], tot[1][0], tot[0][1], tot[1][1], tot[0][2], tot[1][2]);
