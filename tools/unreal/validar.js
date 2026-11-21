#!/usr/bin/env node
// Validador de datos de Corpus Atlas (web y edición Unreal). Solo informa: no corrige nada.
// Uso: node tools/unreal/validar.js  → informe en consola y en unreal/validacion.json.
// Código de salida 1 si hay errores (rompen algo); los avisos no cambian el código.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.resolve(__dirname, '..', '..');
const R = (...p) => path.join(RAIZ, ...p);
const DATOS_UE = R('unreal', 'CorpusAtlas', 'Importar', 'datos');
const CONTENT_UE = R('unreal', 'CorpusAtlas', 'Content', 'Datos');
const SALIDA = R('unreal', 'validacion.json');
const LANGS = ['es', 'en', 'pt', 'fr', 'de'];

const errores = [], avisos = [], omitidos = [];
const err = (tipo, archivo, clave, msg) => errores.push({ tipo, archivo, clave: String(clave), msg });
const avi = (tipo, archivo, clave, msg) => avisos.push({ tipo, archivo, clave: String(clave), msg });
const rel = p => path.relative(RAIZ, p).replace(/\\/g, '/');

function leer(p, obligatorio = true) {
  if (!fs.existsSync(p)) {
    if (obligatorio) err('archivo', rel(p), '-', 'no existe');
    else omitidos.push(rel(p) + ': no existe');
    return null;
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); }
  catch (e) { err('archivo', rel(p), '-', 'JSON no válido: ' + e.message); return null; }
}

// ───────────────────────── 1. Catálogo ─────────────────────────
const catalogo = leer(R('data', 'catalog.json')) || [];
const fem = leer(R('data', 'fem.json')) || {};
const LADOS = new Set(['derecho', 'izquierdo', '']);
const PAPELES = new Set(['origen', 'inserción']);
const IDS = new Map();          // id → fila
const NOMBRES = new Set();      // nombres en inglés de todas las piezas (hombre y mujer)

function revisarCatalogo(filas, archivo) {
  const vistos = new Map();
  filas.forEach((r, i) => {
    if (!Array.isArray(r) || r.length < 7) { err('catalogo', archivo, `fila ${i}`, `fila con ${Array.isArray(r) ? r.length : 0} campos (se esperan 7)`); return; }
    const [id, en, es, , sys, lado, papel] = r;
    if (vistos.has(id)) err('catalogo', archivo, id, `id duplicado (filas ${vistos.get(id)} y ${i})`);
    else vistos.set(id, i);
    if (IDS.has(id) && IDS.get(id).archivo !== archivo) avi('catalogo', archivo, id, `id también presente en ${IDS.get(id).archivo}`);
    if (!IDS.has(id)) IDS.set(id, { fila: r, archivo });
    if (!String(en || '').trim()) err('catalogo', archivo, id, 'sin nombre en inglés');
    if (!String(es || '').trim()) err('catalogo', archivo, id, `sin nombre en español (inglés: «${en}»)`);
    if (!LADOS.has(lado)) err('catalogo', archivo, id, `lado «${lado}» no válido (derecho, izquierdo o vacío)`);
    if (sys === 'insercion' && !PAPELES.has(papel)) err('catalogo', archivo, id, `capa insercion: séptimo campo «${papel}» (se espera origen o inserción)`);
    if (sys !== 'insercion' && papel) avi('catalogo', archivo, id, `séptimo campo «${papel}» fuera de la capa insercion`);
    if (en) NOMBRES.add(en);
  });
  // Piezas pares: mismo sistema, mismo nombre (y mismo papel en insercion), con un lado y sin el otro.
  const grupos = new Map();
  for (const r of filas) {
    if (!Array.isArray(r) || !r[5]) continue;
    const k = [r[4], r[1], r[4] === 'insercion' ? r[6] : ''].join('|');
    if (!grupos.has(k)) grupos.set(k, { derecho: [], izquierdo: [] });
    const g = grupos.get(k); if (g[r[5]]) g[r[5]].push(r[0]);
  }
  for (const [k, g] of grupos) {
    const [sys, en, papel] = k.split('|');
    if (g.derecho.length && !g.izquierdo.length) avi('pares', archivo, g.derecho.join(','), `«${en}» (${sys}${papel ? ', ' + papel : ''}) solo tiene lado derecho`);
    else if (g.izquierdo.length && !g.derecho.length) avi('pares', archivo, g.izquierdo.join(','), `«${en}» (${sys}${papel ? ', ' + papel : ''}) solo tiene lado izquierdo`);
    else if (g.derecho.length !== g.izquierdo.length) avi('pares', archivo, [...g.derecho, ...g.izquierdo].join(','), `«${en}» (${sys}${papel ? ', ' + papel : ''}): ${g.derecho.length} derecho(s) frente a ${g.izquierdo.length} izquierdo(s)`);
  }
}
revisarCatalogo(catalogo, 'data/catalog.json');
if (Array.isArray(fem.cat)) revisarCatalogo(fem.cat, 'data/fem.json → cat');
else err('catalogo', 'data/fem.json', 'cat', 'falta la tabla cat');
// fem.full (catálogo completo del Visible Human Female): sus nombres también valen como referencia.
if (Array.isArray(fem.full)) for (const r of fem.full) if (Array.isArray(r) && r[1]) { NOMBRES.add(r[1]); if (!IDS.has(r[0])) IDS.set(r[0], { fila: r, archivo: 'data/fem.json → full' }); }

// ───────────────────────── 2. Integridad referencial ─────────────────────────
let comprobados = 0;
function nombre(archivo, clave, en, tipo = 'referencia') {
  comprobados++;
  if (typeof en !== 'string' || !en) { err(tipo, archivo, clave, `nombre vacío o no es texto (${JSON.stringify(en)})`); return; }
  if (!NOMBRES.has(en)) err(tipo, archivo, clave, `«${en}» no existe en el catálogo`);
}
const lista = (archivo, clave, v) => { if (v == null) return; if (!Array.isArray(v)) { err('referencia', archivo, clave, 'no es una lista'); return; } v.forEach(n => nombre(archivo, clave, n)); };

// Lecciones (las cinco lenguas)
const lecciones = {};
for (const f of fs.readdirSync(R('data')).filter(f => /^lessons(_\w+)?\.json$/.test(f))) {
  const L = leer(R('data', f)); if (!Array.isArray(L)) continue;
  lecciones[f] = L;
  for (const l of L) {
    (l.steps || []).forEach((s, i) => lista('data/' + f, `${l.id} paso ${i + 1} show`, s.show));
    (l.q || []).forEach((q, i) => {
      if (q.en != null) nombre('data/' + f, `${l.id} pregunta ${i + 1} en`, q.en);
      if (!Array.isArray(q.o) || !Number.isInteger(q.a) || q.a < 0 || q.a >= q.o.length)
        err('pregunta', 'data/' + f, `${l.id} pregunta ${i + 1}`, `respuesta ${q.a} fuera de las ${Array.isArray(q.o) ? q.o.length : 0} opciones`);
    });
  }
}
// Mismos ids, pasos y preguntas en todas las lenguas de las lecciones
if (lecciones['lessons.json']) {
  const base = new Map(lecciones['lessons.json'].map(l => [l.id, l]));
  for (const [f, L] of Object.entries(lecciones)) {
    if (f === 'lessons.json') continue;
    const ids = new Set(L.map(l => l.id));
    for (const id of base.keys()) if (!ids.has(id)) err('idiomas', 'data/' + f, id, 'falta la lección (está en lessons.json)');
    for (const l of L) {
      const b = base.get(l.id);
      if (!b) { err('idiomas', 'data/' + f, l.id, 'lección que no está en lessons.json'); continue; }
      if ((l.steps || []).length !== (b.steps || []).length) err('idiomas', 'data/' + f, l.id, `${(l.steps || []).length} pasos frente a ${(b.steps || []).length} en español`);
      if ((l.q || []).length !== (b.q || []).length) err('idiomas', 'data/' + f, l.id, `${(l.q || []).length} preguntas frente a ${(b.q || []).length} en español`);
    }
  }
}

// Kinesiología y biomecánica
const bio = leer(R('data', 'bio.json')) || [];
for (const b of bio) lista('data/bio.json', `${b.id} tg`, b.tg);

// Glosario: ej[].s → catálogo; ej[].lm → relieve de extras.json; ej[].org → organs.json
const glos = leer(R('data', 'glossary.json')) || [];
const extras = leer(R('data', 'extras.json')) || {};
const lmEn = new Set(); for (const id in (extras.lm || {})) for (const l of extras.lm[id]) lmEn.add(l[1]);
const organos = leer(R('data', 'organs.json'), false);
const orgIds = new Set(); (Array.isArray(organos) ? organos : []).forEach(o => o && o.id && orgIds.add(o.id));
for (const g of glos) (g.ej || []).forEach((x, i) => {
  if (x.s != null) nombre('data/glossary.json', `${g.t} ej ${i + 1} s`, x.s);
  if (x.lm != null && !lmEn.has(x.lm)) err('referencia', 'data/glossary.json', `${g.t} ej ${i + 1} lm`, `relieve «${x.lm}» no existe en extras.json → lm`);
  if (x.org != null && orgIds.size && !orgIds.has(x.org)) err('referencia', 'data/glossary.json', `${g.t} ej ${i + 1} org`, `órgano «${x.org}» no existe en organs.json`);
});
if (!orgIds.size) omitidos.push('glossary.json ej[].org: organs.json sin ids reconocibles, no se comprueba');

// Variantes
for (const v of leer(R('data', 'variants.json')) || []) lista('data/variants.json', `${v.id} en`, v.en);

// Casos clínicos
const casos = {};
for (const f of fs.readdirSync(R('data')).filter(f => /^cases(_\w+)?\.json$/.test(f))) {
  const C = leer(R('data', f)); if (!Array.isArray(C)) continue; casos[f] = C;
  for (const c of C) for (const k of ['lesion', 'afectados', 'relacionados']) lista('data/' + f, `${c.id} ${k}`, c[k]);
}

// movimiento.json (rangos, marcha, ejercicios)
const MOV_P = path.join(DATOS_UE, 'movimiento.json');
const mov = leer(MOV_P, false);
const movF = mov ? rel(MOV_P) : null;
if (mov) {
  for (const r of mov.rom || []) for (const m of r.movs || []) lista(movF, `rom ${r.id} · ${m.n} ag`, m.ag);
  const ma = mov.marcha || {};
  (ma.grupos || []).forEach((g, i) => lista(movF, `marcha grupo ${i + 1} (${g.n}) en`, g.en));
  for (const p of ma.patrones || []) { lista(movF, `marcha ${p.id} debiles`, p.debiles); lista(movF, `marcha ${p.id} espasticos`, p.espasticos); }
  for (const e of (mov.ejercicios || {}).lista || []) (e.grupos || []).forEach((g, i) => lista(movF, `ejercicio ${e.id} grupo ${i + 1} en`, g.en));
  // ids de piezas citados por id
  for (const cuerpo in mov.piezas || {}) for (const id in mov.piezas[cuerpo]) if (!IDS.has(id)) err('referencia', movF, `piezas.${cuerpo}.${id}`, 'id que no está en el catálogo');
  for (const cuerpo in mov.abrazo || {}) for (const id of mov.abrazo[cuerpo]) if (!IDS.has(id)) err('referencia', movF, `abrazo.${cuerpo}.${id}`, 'id que no está en el catálogo');
  for (const cuerpo in mov.insercion || {}) for (const id in mov.insercion[cuerpo]) if (!IDS.has(id)) err('referencia', movF, `insercion.${cuerpo}.${id}`, 'id que no está en el catálogo');
}

// rangos_extra.json (agonistas)
const RX_P = R('tools', 'unreal', 'rangos_extra.json');
const rx = leer(RX_P, false);
if (rx) (rx.rangos || []).forEach((r, i) => lista(rel(RX_P), `rangos[${i}] ${r.rom} · ${(r.n || {}).es} ag`, r.ag));

// tendones_reglas.json (músculos)
const TR_P = R('tools', 'unreal', 'tendones_reglas.json');
const tr = leer(TR_P, false);
if (tr) for (const m in tr.musculos || {}) nombre(rel(TR_P), `musculos.${m}`, m);

// extras.json: claves lm, dep, reg = ids existentes; relieves cerca de su hueso (cajas del manifiesto)
for (const k of ['lm', 'dep', 'reg']) {
  if (!extras[k]) { err('referencia', 'data/extras.json', k, 'falta la tabla'); continue; }
  for (const id in extras[k]) if (!IDS.has(id)) err('referencia', 'data/extras.json', `${k}.${id}`, 'id que no está en el catálogo');
}
const DEP_OK = new Set(['s', 'i', 'p']);
for (const id in extras.dep || {}) if (!DEP_OK.has(extras.dep[id])) err('referencia', 'data/extras.json', `dep.${id}`, `profundidad «${extras.dep[id]}» (se espera s, i o p)`);
const manif = leer(R('unreal', 'CorpusAtlas', 'Importar', 'manifiesto.json'), false) || leer(path.join(CONTENT_UE, 'manifiesto.json'), false);
const LM_AVISO = 0.01, LM_ERROR = 0.04; // metros fuera de la caja del hueso
if (manif && manif.piezas) {
  const fuera = p => (b) => { let d2 = 0; for (let a = 0; a < 3; a++) { const d = Math.max(b[0][a] - p[a], 0, p[a] - b[1][a]); d2 += d * d; } return Math.sqrt(d2); };
  for (const id in extras.lm || {}) {
    const pz = manif.piezas[id];
    if (!pz) { avi('relieves', 'data/extras.json', `lm.${id}`, 'la pieza no está en el manifiesto: no se puede comprobar la posición'); continue; }
    const cajas = Object.values(pz).map(c => c.b).filter(Boolean);
    const sys = IDS.has(id) ? IDS.get(id).fila[4] : '?';
    if (sys !== 'oseo') avi('relieves', 'data/extras.json', `lm.${id}`, `relieves sobre una pieza de la capa «${sys}», no sobre un hueso`);
    for (const l of extras.lm[id]) {
      if (!Array.isArray(l[2]) || l[2].length !== 3) { err('relieves', 'data/extras.json', `lm.${id} «${l[0]}»`, 'sin coordenadas'); continue; }
      const d = Math.min(...cajas.map(fuera(l[2])));
      const nm = IDS.has(id) ? IDS.get(id).fila[2] : id;
      if (d > LM_ERROR) err('relieves', 'data/extras.json', `lm.${id} «${l[0]}»`, `a ${(d * 100).toFixed(1)} cm fuera de la caja de ${nm}`);
      else if (d > LM_AVISO) avi('relieves', 'data/extras.json', `lm.${id} «${l[0]}»`, `a ${(d * 100).toFixed(1)} cm fuera de la caja de ${nm}`);
    }
  }
} else omitidos.push('extras.json lm: sin manifiesto.json (cajas de las piezas), no se comprueba la posición de los relieves');

// ───────────────────────── 3. Rangos ─────────────────────────
function rango(archivo, clave, m, conFotogramas) {
  const max = m.max, min = m.min == null ? 0 : m.min;
  if (typeof max !== 'number' || !(max > 0)) err('rangos', archivo, clave, `máximo ${max} (debe ser > 0)`);
  if (typeof min !== 'number' || !(min < max)) err('rangos', archivo, clave, `mínimo ${min} no es menor que el máximo ${max}`);
  if (m.paso != null) {
    if (!(m.paso > 0) || m.paso > max - min) err('rangos', archivo, clave, `paso ${m.paso} no coherente con el rango ${min}–${max}`);
    else if (Math.abs((max - min) / m.paso - Math.round((max - min) / m.paso)) > 1e-6) err('rangos', archivo, clave, `el rango ${min}–${max} no es múltiplo del paso ${m.paso}`);
  }
  if (conFotogramas) for (const lado of ['R', 'L']) {
    if (m[lado] == null) continue;
    const esp = Math.round((max - min) / m.paso) + 1;
    if (!Array.isArray(m[lado]) || m[lado].length !== esp) err('rangos', archivo, `${clave} ${lado}`, `${Array.isArray(m[lado]) ? m[lado].length : 0} fotogramas; se esperan máximo/paso+1 = ${esp}`);
  }
}
if (mov) {
  if (!(mov.paso > 0)) err('rangos', movF, 'paso', `paso global ${mov.paso}`);
  for (const r of mov.rom || []) for (const m of r.movs || []) {
    rango(movF, `rom ${r.id} · ${m.n}`, m, true);
    if (m.paso !== mov.paso) avi('rangos', movF, `rom ${r.id} · ${m.n}`, `paso ${m.paso} distinto del global ${mov.paso}`);
    if (m.R == null && m.L == null) err('rangos', movF, `rom ${r.id} · ${m.n}`, 'sin fotogramas R ni L');
    if (r.lados && (m.R == null) !== (m.L == null)) avi('rangos', movF, `rom ${r.id} · ${m.n}`, 'rango con lados que solo trae uno');
  }
  // Marcha y ejercicios: ciclo de 0 a 100 % con su paso (el 100 % es el 0 %, así que no se repite)
  const ciclo = (clave, frames, paso) => {
    const esp = Math.round(100 / paso);
    if (!Array.isArray(frames) || frames.length !== esp) err('rangos', movF, clave, `${Array.isArray(frames) ? frames.length : 0} fotogramas; se esperan 100/paso = ${esp}`);
  };
  const ma = mov.marcha || {};
  for (const p of ma.patrones || []) { ciclo(`marcha ${p.id}`, p.frames, ma.paso); if (p.raiz && p.raiz.length !== p.frames.length) err('rangos', movF, `marcha ${p.id} raiz`, `${p.raiz.length} raíces para ${p.frames.length} fotogramas`); }
  for (const e of (mov.ejercicios || {}).lista || []) for (const v of e.variantes || []) {
    ciclo(`ejercicio ${e.id} · ${v.id}`, v.frames, e.paso);
    if (v.raiz && v.raiz.length !== v.frames.length) err('rangos', movF, `ejercicio ${e.id} · ${v.id} raiz`, `${v.raiz.length} raíces para ${v.frames.length} fotogramas`);
  }
}
if (rx) (rx.rangos || []).forEach((r, i) => {
  const clave = `rangos[${i}] ${r.rom} · ${(r.n || {}).es}`;
  rango(rel(RX_P), clave, r, false);
  if (mov) {
    const rom = (mov.rom || []).find(x => x.id === r.rom);
    if (!rom) err('rangos', rel(RX_P), clave, `rango «${r.rom}» no existe en movimiento.json`);
    else {
      const m = rom.movs.find(x => x.n === (r.n || {}).es);
      if (!m) avi('rangos', rel(RX_P), clave, 'movimiento sin hornear en movimiento.json (falta volver a ejecutar movimiento.js)');
      else if (m.max !== r.max) err('rangos', rel(RX_P), clave, `máximo ${r.max} distinto del horneado (${m.max}): vuelve a ejecutar movimiento.js`);
    }
  }
});
if (rx) (rx.notas || []).forEach((n, i) => {
  if (!mov) return;
  const rom = (mov.rom || []).find(x => x.id === n.rom);
  if (!rom || !rom.movs.find(x => x.n === n.mov)) err('rangos', rel(RX_P), `notas[${i}] ${n.rom} · ${n.mov}`, 'la nota apunta a un movimiento que no existe');
});

// ───────────────────────── 4. Idiomas (estudio_<lang>.json) ─────────────────────────
const est = {};
for (const l of LANGS) est[l] = leer(path.join(DATOS_UE, `estudio_${l}.json`), false);
const TXT_CLAVES = new Set(['n', 't', 'x', 'p', 'o', 'sub', 'secs', 'aviso', 'ui']);
const SIN_TRAD = { fr: { es: [], en: [] }, de: { es: [], en: [] } };
const TIENE_LETRAS = /[A-Za-zÀ-ÿ]{3}/;
const PALABRAS = new Map(Object.entries({
  es: 'el los las del y con al su sus alrededor pero cuando está hacia una muy más también',
  en: 'the of and with from is are to by which this that its around about into when',
  pt: 'e da do das dos em uma na nas nos ao pela pelo não é são torno também mais',
  fr: 'le les du et dans avec une est sont au aux sur pour par autour qui',
  de: 'der die das und mit ist sind den dem von zu bei auf nicht eine ein im wird',
}).flatMap(([l, s]) => s.split(' ').map(w => [w, l])));
function compararTexto(ruta, vs) {
  const es = vs.es, en = vs.en;
  if (typeof es !== 'string' || es.length < 4 || !TIENE_LETRAS.test(es) || es === en) return;
  for (const l of ['fr', 'de']) {
    if (vs[l] === es) SIN_TRAD[l].es.push(ruta);
    else if (vs[l] === en && typeof en === 'string') SIN_TRAD[l].en.push(ruta);
  }
}
// Recorre a la vez los cinco árboles; solo compara hojas de texto bajo claves de texto.
function recorrer(ruta, vs, enTexto) {
  const b = vs.es;
  if (typeof b === 'string') { if (enTexto) compararTexto(ruta, vs); return; }
  if (Array.isArray(b)) { b.forEach((_, i) => recorrer(`${ruta}[${i}]`, Object.fromEntries(LANGS.map(l => [l, Array.isArray(vs[l]) ? vs[l][i] : undefined])), enTexto)); return; }
  if (b && typeof b === 'object') for (const k of Object.keys(b)) {
    if (k === 'show' || k === 'img' || k === 'cred' || k === 'id' || k === 'capas') continue;
    recorrer(ruta ? `${ruta}.${k}` : k, Object.fromEntries(LANGS.map(l => [l, vs[l] && typeof vs[l] === 'object' ? vs[l][k] : undefined])), enTexto || TXT_CLAVES.has(k));
  }
}
if (LANGS.every(l => est[l])) {
  const archivo = l => rel(path.join(DATOS_UE, `estudio_${l}.json`));
  const base = est.es;
  const ids = m => (m.modulos || []).map(x => x.id).join(',');
  for (const l of LANGS) {
    const E = est[l];
    if (ids(E) !== ids(base)) { err('idiomas', archivo(l), 'modulos', `módulos «${ids(E)}» frente a «${ids(base)}» en español`); continue; }
    E.modulos.forEach((m, mi) => {
      const mb = base.modulos[mi];
      if (m.grupos.length !== mb.grupos.length) err('idiomas', archivo(l), m.id, `${m.grupos.length} grupos frente a ${mb.grupos.length} en español`);
      const nE = m.grupos.reduce((a, g) => a + g.items.length, 0), nB = mb.grupos.reduce((a, g) => a + g.items.length, 0);
      if (nE !== nB) err('idiomas', archivo(l), m.id, `${nE} entradas frente a ${nB} en español`);
      m.grupos.forEach((g, gi) => {
        const gb = mb.grupos[gi];
        if (gb && g.items.length !== gb.items.length) err('idiomas', archivo(l), `${m.id} · grupo ${gi + 1} (${g.n})`, `${g.items.length} entradas frente a ${gb.items.length} en español («${gb.n}»)`);
        g.items.forEach((it, ii) => {
          const ib = gb && gb.items[ii];
          if (ib && it.id !== ib.id) err('idiomas', archivo(l), `${m.id} · ${it.id}`, `en la posición ${ii + 1} del grupo, en español está «${ib.id}»`);
          if (ib && (it.pasos || []).length !== (ib.pasos || []).length) err('idiomas', archivo(l), `${m.id} · ${it.id}`, `${(it.pasos || []).length} pasos frente a ${(ib.pasos || []).length} en español`);
          if (ib && (it.q || []).length !== (ib.q || []).length) err('idiomas', archivo(l), `${m.id} · ${it.id}`, `${(it.q || []).length} preguntas frente a ${(ib.q || []).length} en español`);
          (it.q || []).forEach((q, qi) => {
            if (!Array.isArray(q.o) || !Number.isInteger(q.a) || q.a < 0 || q.a >= q.o.length)
              err('pregunta', archivo(l), `${m.id} · ${it.id} pregunta ${qi + 1}`, `respuesta ${q.a} fuera de las ${Array.isArray(q.o) ? q.o.length : 0} opciones`);
            const qb = ib && (ib.q || [])[qi];
            if (qb && Array.isArray(q.o) && Array.isArray(qb.o)) {
              if (q.o.length !== qb.o.length) err('idiomas', archivo(l), `${m.id} · ${it.id} pregunta ${qi + 1}`, `${q.o.length} opciones frente a ${qb.o.length} en español`);
              if (q.a !== qb.a) err('idiomas', archivo(l), `${m.id} · ${it.id} pregunta ${qi + 1}`, `respuesta ${q.a} frente a ${qb.a} en español`);
            }
          });
        });
      });
    });
  }
  recorrer('', est, false);
  for (const l of ['fr', 'de']) for (const o of ['es', 'en']) {
    const todos = SIN_TRAD[l][o]; if (!todos.length) continue;
    // Las frases (3 palabras o más) son lo que de verdad queda sin traducir; los términos cortos
    // suelen ser nombres latinos o internacionales iguales en varias lenguas (Vomer, Maxilla…).
    const v = todos.filter(r => String(valor(r, l)).trim().split(/\s+/).length >= 3);
    if (!v.length) continue;
    const porMod = {};
    for (const r of v) { const m = /^modulos\[(\d+)\]/.exec(r); const k = m ? base.modulos[+m[1]].id : r.split(/[.[]/)[0]; porMod[k] = (porMod[k] || 0) + 1; }
    avi('sin_traducir', archivo(l), `en ${o === 'es' ? 'español' : 'inglés'}`, `${v.length} frases iguales al ${o === 'es' ? 'español' : 'inglés'} (más ${todos.length - v.length} términos cortos): ` + Object.entries(porMod).map(([k, n]) => `${k} ${n}`).join(', ') + ` (p. ej. ${v.slice(0, 3).map(r => describir(r, l)).join(' | ')})`);
  }

  // Opciones de las preguntas de kinesiología frente a bio.json (la web usa d[idioma][k]).
  const bioPorId = new Map(bio.map(b => [b.id, b]));
  const malBio = { es: [], en: [], pt: [] };
  ['es', 'en', 'pt'].forEach((l, li) => {
    const mod = est[l].modulos.find(m => m.id === 'kinesio'); if (!mod) return;
    for (const g of mod.grupos) for (const it of g.items) {
      const b = bioPorId.get(String(it.id).replace(/^bio_/, '')); if (!b || !b.d || !it.q || !it.q[0]) continue;
      const esp = new Set([b.a[li], ...(b.d[li] || [])]);
      const q = it.q[0];
      const ajenas = q.o.filter(o => !esp.has(o));
      if (ajenas.length) malBio[l].push(`${it.id} «${ajenas[0].slice(0, 45)}»`);
      else if (q.o[q.a] !== b.a[li]) err('pregunta', archivo(l), `kinesio · ${it.id}`, 'la opción marcada como correcta no es la respuesta de bio.json');
    }
  });
  for (const l of Object.keys(malBio)) if (malBio[l].length)
    err('pregunta', archivo(l), 'kinesio', `${malBio[l].length} preguntas con opciones que no son las de bio.json en este idioma (distractores de otra lengua: estudio.js lee d[k][idioma] y la web d[idioma][k]); p. ej. ${malBio[l].slice(0, 3).join(' | ')}`);

  // Idioma de cada frase (palabras vacías propias de cada lengua)
  const otro = {};
  for (const l of LANGS) (function rec(o, ruta, enTexto) {
    if (typeof o === 'string') {
      if (!enTexto) return;
      const d = idioma(o); if (!d || d === l || ((l === 'fr' || l === 'de') && d === 'en')) return;
      const k = l + (/\.q\[\d+\]\.o\[\d+\]$/.test(ruta) ? '|q' : '');
      (otro[k] = otro[k] || []).push([ruta, d, o]);
      return;
    }
    if (Array.isArray(o)) o.forEach((x, i) => rec(x, `${ruta}[${i}]`, enTexto));
    else if (o && typeof o === 'object') for (const k in o) if (!['show', 'img', 'cred', 'id', 'capas'].includes(k)) rec(o[k], ruta ? `${ruta}.${k}` : k, enTexto || TXT_CLAVES.has(k));
  })(est[l], '', false);
  for (const k of Object.keys(otro)) {
    const [l, q] = k.split('|'), v = otro[k];
    const porMod = {}; for (const [r] of v) { const m = /^modulos\[(\d+)\]/.exec(r); const id = m ? est.es.modulos[+m[1]].id : r.split(/[.[]/)[0]; porMod[id] = (porMod[id] || 0) + 1; }
    const porL = {}; for (const [, d] of v) porL[d] = (porL[d] || 0) + 1;
    avi('otro_idioma', archivo(l), q ? 'opciones de pregunta' : 'textos',
      `${v.length} frases que parecen escritas en otra lengua (${Object.entries(porL).map(([d, n]) => `${d} ${n}`).join(', ')}; ${Object.entries(porMod).map(([m, n]) => `${m} ${n}`).join(', ')}); p. ej. ` +
      v.slice(0, 3).map(([r, d, s]) => `${r.replace(/modulos\[(\d+)\]/, (_, i) => est.es.modulos[+i].id)} [${d}] «${s.slice(0, 45)}…»`).join(' | '));
  }
} else omitidos.push('estudio_<lang>.json: faltan idiomas en Importar/datos, no se comparan');
function valor(ruta, l) { let o = est[l]; for (const p of ruta.match(/[^.[\]]+/g)) o = o == null ? o : o[/^\d+$/.test(p) ? +p : p]; return o; }
// Detector sencillo por palabras vacías exclusivas de cada lengua (solo frases de 6 palabras o más).
function idioma(s) {
  const w = s.toLowerCase().match(/[a-zà-ÿß]+/g); if (!w || w.length < 6) return null;
  const n = {}; for (const x of w) { const l = PALABRAS.get(x); if (l) n[l] = (n[l] || 0) + 1; }
  const o = Object.entries(n).sort((a, b) => b[1] - a[1]);
  if (!o.length || o[0][1] < 3 || (o[1] && o[0][1] < 3 * o[1][1])) return null;
  return o[0][0];
}
function describir(ruta, l) {
  let o = est[l]; for (const p of ruta.match(/[^.[\]]+/g)) o = o == null ? o : o[/^\d+$/.test(p) ? +p : p];
  const s = String(o); return `${ruta.replace(/modulos\[(\d+)\]/, (_, i) => est.es.modulos[+i].id)} «${s.length > 50 ? s.slice(0, 50) + '…' : s}»`;
}
// Textos multilingües de movimiento.json ({es,en,pt,fr,de})
if (mov) {
  const cnt = { faltan: [], fr_es: [], de_es: [], fr_en: [], de_en: [] };
  (function rec(o, ruta) {
    if (!o || typeof o !== 'object') return;
    if (!Array.isArray(o) && typeof o.es === 'string' && typeof o.en === 'string') {
      for (const l of LANGS) if (typeof o[l] !== 'string' || !o[l].trim()) cnt.faltan.push(`${ruta} (${l})`);
      if (o.es !== o.en && o.es.length >= 4 && TIENE_LETRAS.test(o.es)) for (const l of ['fr', 'de']) {
        if (o[l] === o.es) cnt[l + '_es'].push(ruta); else if (o[l] === o.en) cnt[l + '_en'].push(ruta);
      }
      return;
    }
    if (Array.isArray(o)) { if (o.length > 200 && typeof o[0] !== 'object') return; o.forEach((x, i) => rec(x, `${ruta}[${i}]`)); }
    else for (const k in o) { if (k === 'piezas' || k === 'torax' || k === 'frames' || k === 'R' || k === 'L') continue; rec(o[k], ruta ? `${ruta}.${k}` : k); }
  })(mov, '');
  if (cnt.faltan.length) err('idiomas', movF, cnt.faltan.slice(0, 5).join('; '), `${cnt.faltan.length} textos sin alguno de los cinco idiomas`);
  for (const k of ['fr_es', 'de_es', 'fr_en', 'de_en']) if (cnt[k].length) {
    const [l, o] = k.split('_');
    avi('sin_traducir', movF, `${l} en ${o === 'es' ? 'español' : 'inglés'}`, `${cnt[k].length} textos en ${l} iguales al ${o === 'es' ? 'español' : 'inglés'} (p. ej. ${cnt[k].slice(0, 3).join(' | ')})`);
  }
}

// ───────────────────────── 5. Claves que solo cambian en mayúsculas ─────────────────────────
// El lector JSON de Unreal (FJsonObject) no distingue mayúsculas: dos claves así se funden en una.
let mayIguales = 0;
function mayusculas(archivo, tabla, pares) {
  const g = new Map();
  for (const [k, v] of pares) { const c = String(k).toLowerCase(); if (!g.has(c)) g.set(c, []); g.get(c).push([k, v]); }
  for (const [, ps] of g) {
    const distintas = [...new Set(ps.map(p => p[0]))];
    if (distintas.length < 2) {
      if (ps.length > 1 && new Set(ps.map(p => JSON.stringify(p[1]))).size > 1) avi('mayusculas', archivo, `${tabla} «${ps[0][0]}»`, `clave repetida ${ps.length} veces con valores distintos: ` + ps.map(p => JSON.stringify(p[1])).join(' / '));
      continue;
    }
    const vals = new Set(ps.map(p => String(p[1]).toLowerCase()));
    if (vals.size < 2) { mayIguales++; continue; }
    avi('mayusculas', archivo, `${tabla}: ` + distintas.map(k => `«${k}»`).join(' / '), ps.map(p => `«${p[0]}» → ${JSON.stringify(p[1])}`).join(' · '));
  }
}
const aPares = o => Array.isArray(o) ? o.filter(p => Array.isArray(p) && p.length >= 2) : Object.entries(o || {});
for (const f of fs.readdirSync(R('data')).filter(f => /^(i18n(_\w+)?|content_\w+)\.json$/.test(f))) {
  const o = leer(R('data', f)); if (!o) continue;
  if (/^content_/.test(f)) { mayusculas('data/' + f, 'raíz', aPares(o)); continue; }
  for (const t of Object.keys(o)) {
    const ps = aPares(o[t]);
    // i18n.json → ui es una lista [idioma, {texto: traducción}]
    if (ps.length && ps.every(p => typeof p[1] === 'object' && p[1] && !Array.isArray(p[1]) && LANGS.includes(p[0])))
      for (const [l, sub] of ps) mayusculas('data/' + f, `${t}.${l}`, aPares(sub));
    else mayusculas('data/' + f, t, ps);
  }
}

// ───────────────────────── 6. Copias en Content/Datos ─────────────────────────
// estudio.js / movimiento.js copian lo generado a Content/Datos; si difiere, Unreal lee datos viejos.
if (fs.existsSync(DATOS_UE) && fs.existsSync(CONTENT_UE)) {
  const h = p => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
  for (const f of fs.readdirSync(DATOS_UE).filter(f => f.endsWith('.json'))) {
    const c = path.join(CONTENT_UE, f);
    if (!fs.existsSync(c)) avi('copias', rel(c), f, 'no está copiado en Content/Datos');
    else if (h(c) !== h(path.join(DATOS_UE, f))) avi('copias', rel(c), f, `distinto de Importar/datos/${f} (falta copiar: ci.copiar_datos())`);
  }
}

// ───────────────────────── Informe ─────────────────────────
const porTipo = lst => lst.reduce((a, x) => (a[x.tipo] = (a[x.tipo] || 0) + 1, a), {});
const informe = {
  fecha: new Date().toISOString(),
  resumen: { errores: errores.length, avisos: avisos.length, nombres_comprobados: comprobados, errores_por_tipo: porTipo(errores), avisos_por_tipo: porTipo(avisos), mayusculas_mismo_valor: mayIguales },
  omitido: omitidos,
  errores, avisos,
};
fs.writeFileSync(SALIDA, JSON.stringify(informe, null, 1) + '\n');

const MAX = 12;
function imprimir(titulo, lst) {
  console.log(`\n${titulo}: ${lst.length}`);
  const t = porTipo(lst);
  for (const tipo of Object.keys(t)) {
    console.log(`  [${tipo}] ${t[tipo]}`);
    lst.filter(x => x.tipo === tipo).slice(0, MAX).forEach(x => console.log(`    ${x.archivo} · ${x.clave}: ${x.msg}`));
    if (t[tipo] > MAX) console.log(`    … y ${t[tipo] - MAX} más`);
  }
}
console.log(`Validador de datos de Corpus Atlas (${comprobados} nombres en inglés comprobados contra el catálogo)`);
imprimir('ERRORES', errores);
imprimir('AVISOS', avisos);
if (mayIguales) console.log(`\n(${mayIguales} grupos de claves que solo cambian en mayúsculas con la misma traducción: no se listan)`);
if (omitidos.length) { console.log('\nNo comprobado:'); omitidos.forEach(o => console.log('  ' + o)); }
console.log(`\nInforme completo: ${rel(SALIDA)}`);
process.exitCode = errores.length ? 1 : 0;
