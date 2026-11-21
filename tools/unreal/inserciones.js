// Corpus Atlas (edición Unreal) — mapa de origen e inserción: sobre qué hueso está dibujada cada área de la capa
// «insercion» (705 piezas con el nombre de su músculo; el catálogo dice si es «origen» o «inserción», pero no el hueso).
//
//   node tools/unreal/inserciones.js      → Importar/datos/inserciones.json y copia a Content/Datos (no hace falta el editor)
//
// Regla: cada vértice del área vota por el hueso (capa «oseo»: huesos, cartílagos y dientes) que tiene más cerca, a menos
// de 15 mm; el área es del hueso más votado. Las que no tocan hueso (membranas, ligamentos, otros músculos) quedan fuera.
// Salida: { hombre: { idÁrea: idHueso }, mujer: { … } }. La lee UCorpusDatos::CargarInserciones.
'use strict';
const fs = require('fs'), path = require('path');
const PO = require('./postura.js');
const CONTENT = path.join(__dirname, '..', '..', 'unreal', 'CorpusAtlas', 'Content', 'Datos');
const R = 0.015;

const clave = (x, y, z, c) => Math.floor(x / c) + ',' + Math.floor(y / c) + ',' + Math.floor(z / c);
/* piezas de una capa: la mujer solo trae las que cambian; el resto son las del hombre */
function piezasDe(cuerpo, sistema) {
  const L = [], vistas = new Set();
  for (const c of cuerpo === 'hombre' ? ['hombre'] : [cuerpo, 'hombre']) {
    let C; try { C = PO.capa(c + '/' + sistema); } catch (e) { continue; }
    for (const nd of C.g.nodes) {
      if (nd.mesh === undefined || vistas.has(nd.name)) continue;
      const pz = PO.pieza(c + '/' + sistema, nd.name); if (!pz) continue;
      vistas.add(nd.name); L.push(pz);
    }
  }
  return L;
}

const salida = {}, resumen = [];
for (const cuerpo of ['hombre', 'mujer']) {
  // rejilla con los vértices de todos los huesos (uno por cada 3 mm)
  const H = new Map(), huesos = piezasDe(cuerpo, 'oseo');
  huesos.forEach((pz, hi) => {
    const visto = new Set();
    for (let i = 0; i < pz.nv; i++) {
      const x = pz.P[i * 3], y = pz.P[i * 3 + 1], z = pz.P[i * 3 + 2], k3 = clave(x, y, z, 0.003);
      if (visto.has(k3)) continue; visto.add(k3);
      const k = clave(x, y, z, R); let l = H.get(k); if (!l) H.set(k, l = []); l.push(x, y, z, hi);
    }
  });
  const cerca = (x, y, z) => {
    const fx = Math.floor(x / R), fy = Math.floor(y / R), fz = Math.floor(z / R); let bd = R * R, b = -1;
    for (let a = -1; a <= 1; a++) for (let e = -1; e <= 1; e++) for (let f = -1; f <= 1; f++) {
      const l = H.get((fx + a) + ',' + (fy + e) + ',' + (fz + f)); if (!l) continue;
      for (let t = 0; t < l.length; t += 4) { const d = (l[t] - x) ** 2 + (l[t + 1] - y) ** 2 + (l[t + 2] - z) ** 2; if (d < bd) { bd = d; b = l[t + 3]; } }
    }
    return b;
  };
  const mapa = salida[cuerpo] = {};
  let sin = 0; const areas = piezasDe(cuerpo, 'insercion');
  for (const pz of areas) {
    const votos = new Map(), paso = Math.max(1, Math.floor(pz.nv / 400));
    for (let i = 0; i < pz.nv; i += paso) { const h = cerca(pz.P[i * 3], pz.P[i * 3 + 1], pz.P[i * 3 + 2]); if (h >= 0) votos.set(h, (votos.get(h) || 0) + 1); }
    let mejor = -1, n = 0; for (const [h, v] of votos) if (v > n) { n = v; mejor = h; }
    if (mejor < 0) { sin++; continue; }
    mapa[pz.id] = huesos[mejor].id;
  }
  resumen.push(`${cuerpo}: ${areas.length} áreas, ${Object.keys(mapa).length} con hueso, ${sin} sin hueso cerca`);
}
const txt = JSON.stringify(salida);
for (const dir of [path.join(PO.IMP, 'datos'), CONTENT]) { if (fs.existsSync(dir)) fs.writeFileSync(path.join(dir, 'inserciones.json'), txt); }
console.log(resumen.join('\n'));
// comprobación rápida: áreas sobre el fémur derecho (n152)
const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'catalog.json'), 'utf8'));
const porId = Object.fromEntries(cat.map(r => [r[0], r]));
const fem = Object.entries(salida.hombre).filter(e => e[1] === 'n152').map(e => porId[e[0]]).filter(Boolean);
console.log('Fémur derecho:', fem.length, 'áreas');
for (const t of ['origen', 'inserción']) console.log(' ', t + ':', fem.filter(r => r[6] === t).map(r => r[2]).join(' · '));
