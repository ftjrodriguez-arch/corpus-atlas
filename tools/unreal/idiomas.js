// Corpus Atlas (edición Unreal) — textos en cinco idiomas con el mismo criterio que tools/unreal/estudio.js y que la web:
// la web escribe [es, en, pt]; francés y alemán se buscan por el texto español en la interfaz (i18n_fr/de) y en los textos
// largos (content_fr/de); si faltan, inglés. Lo usan los generadores que guardan los textos dentro de sus datos
// (movimiento.js: ejercicios).
'use strict';
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, '..', '..', 'data');
const J = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const LANGS = ['es', 'en', 'pt', 'fr', 'de'];
let T = null;
function tablas() {
  if (T) return T;
  T = { ui: { fr: J('i18n_fr.json').ui, de: J('i18n_de.json').ui }, cont: { fr: J('content_fr.json'), de: J('content_de.json') } };
  return T;
}
const tiene = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k) && typeof o[k] === 'string' && o[k];
const faltan = { fr: new Set(), de: new Set() };   // textos que salieron en inglés (para el informe)
/* texto en español → francés o alemán: primero la tabla exacta; si lleva cifras, la plantilla «#…{n}…» (TLX de la web) */
function frde(es, l) {
  const t = tablas();
  if (tiene(t.cont[l], es)) return t.cont[l][es];
  if (tiene(t.ui[l], es)) return t.ui[l][es];
  if (/\d/.test(es)) {
    const nums = [], clave = '#' + es.replace(/\d+(?:[.,]\d+)?/g, m => { nums.push(m); return '{n}'; });
    for (const o of [t.cont[l], t.ui[l]]) if (tiene(o, clave)) { let i = 0; return o[clave].replace(/\{n\}/g, () => nums[i++] ?? ''); }
  }
  return null;
}
/** [es, en, pt] de la web → { es, en, pt, fr, de } */
function cinco(a) {
  if (a == null) return null;
  if (typeof a === 'string') a = [a, a, a];
  if (!Array.isArray(a)) return a;                   // ya viene por idiomas
  if (a.length >= 5) return { es: a[0], en: a[1], pt: a[2], fr: a[3], de: a[4] };
  const o = { es: a[0] || '', en: a[1] || a[0] || '', pt: a[2] || a[0] || '' };
  for (const l of ['fr', 'de']) { const x = frde(o.es, l); if (x) o[l] = x; else { o[l] = o.en; if (o.es) faltan[l].add(o.es); } }
  return o;
}
module.exports = { LANGS, cinco, faltan };
