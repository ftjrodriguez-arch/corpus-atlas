// Corpus Atlas (edición Unreal) — ilustraciones del módulo de patologías, de Wikimedia Commons.
// Por cada archivo pregunta a la API su licencia y autor; solo baja los de licencia abierta que permite uso comercial
// (CC BY, CC BY-SA, CC0 o dominio público) y guarda una miniatura de 900 px en unreal/patologias/img, con la atribución
// en unreal/patologias/atribuciones.json (la lee tools/unreal/estudio.js).
//   node tools/unreal/patologias_img.js           → baja lo que falte
//   node tools/unreal/patologias_img.js --buscar "Blausen asthma"   → lista candidatos de Commons con su licencia
const fs = require('fs'), path = require('path');
const DEST = path.join(__dirname, '..', '..', 'unreal', 'patologias');
const IMG = path.join(DEST, 'img');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = { 'User-Agent': 'AtlasAnatomiaEducativo/1.0 (herramienta de atribucion de imagenes)' };
// término del glosario (español) → archivo de Commons
const TABLA = {
  'Ictus isquémico': 'Blausen_0836_Stroke.png',
  'Ictus hemorrágico': '1602_The_Hemorrhagic_Stroke-02.jpg',
  'Enfermedad de Parkinson': 'Blausen_0704_ParkinsonsDisease.png',
  'Esclerosis múltiple': 'Symptoms_of_multiple_sclerosis.svg',
  'Síndrome del túnel carpiano': 'Carpal_Tunnel_Syndrome.png',
  'Hernia discal': 'Blausen_0484_HerniatedLumbarDisc.png',
  'Escoliosis': 'Blausen_0785_Scoliosis_01.png',
  'Gonartrosis': 'Osteoarthritis_left_knee.jpg',
  'Osteoporosis': 'Blausen_0686_Osteoporosis_01.png',
  'Fractura de cadera': 'Hip_fracture_classification.png',
  'Fractura de Colles': 'Colles_fracture.JPG',
  'Contractura de Dupuytren': "Dupuytren's_contracture.jpg",
  'Infarto agudo de miocardio': 'Blausen_0463_HeartAttack.png',
  'Angina de pecho': 'Blausen_0259_CoronaryArteryDisease_02.png',
  'Estenosis aórtica': 'Blausen_0040_AorticStenosis.png',
  'Enfermedad pulmonar obstructiva crónica': 'Blausen_0343_Emphysema.png',
  'Neumotórax': 'Blausen_0742_Pneumothorax.png',
  'Cáncer de pulmón': 'Blausen_0619_LungCancer.png',
  'Embolia pulmonar': 'Pulmonary_embolism.jpg',
  'Hidronefrosis': 'Hydronephrosis.png',
  'Bocio': 'Blausen_0534_Goiter.png',
  'Aterosclerosis': '2113ab_Atherosclerosis.jpg',
  'Aneurisma de aorta abdominal': 'Aortic_aneurysm.jpg',
  'Varices': 'Varicose_veins.jpg',
};
try { Object.assign(TABLA, JSON.parse(fs.readFileSync(path.join(DEST, 'tabla_extra.json'), 'utf8'))); } catch (e) {}

const LIBRE = /^(CC BY(-SA)? [0-9.]+( [a-z]+)?|CC0( 1\.0)?|Public domain|PD.*|CC-PD-Mark|No restrictions)$/i;
const sinHtml = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
async function info(titulos) {
  const u = API + '?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=900&iiextmetadatafilter=LicenseShortName|Artist|ObjectName&titles=' + encodeURIComponent(titulos.map(t => 'File:' + t).join('|'));
  const r = await fetch(u, { headers: UA });
  const j = await r.json();
  const sal = {};
  const norm = {}; for (const n of (j.query.normalized || [])) norm[n.to] = n.from;
  for (const p of Object.values(j.query.pages || {})) {
    const ii = p.imageinfo && p.imageinfo[0];
    const clave = (norm[p.title] || p.title).replace(/^File:/, '');
    sal[clave] = ii ? { url: ii.thumburl || ii.url, pagina: ii.descriptionurl, licencia: sinHtml(ii.extmetadata.LicenseShortName && ii.extmetadata.LicenseShortName.value), autor: sinHtml(ii.extmetadata.Artist && ii.extmetadata.Artist.value).slice(0, 120), titulo: p.title.replace(/^File:/, '').replace(/_/g, ' ') } : null;
  }
  return sal;
}
(async () => {
  const ib = process.argv.indexOf('--buscar');
  if (ib > 0) {
    const r = await fetch(API + '?action=query&format=json&list=search&srnamespace=6&srlimit=12&srsearch=' + encodeURIComponent(process.argv[ib + 1]), { headers: UA });
    const ts = ((await r.json()).query.search || []).map(s => s.title.replace(/^File:/, ''));
    const I = ts.length ? await info(ts) : {};
    for (const t of ts) { const i = I[t] || I[t.replace(/ /g, '_')]; console.log((i ? i.licencia : '?').padEnd(16), t); }
    return;
  }
  fs.mkdirSync(IMG, { recursive: true });
  const fAtr = path.join(DEST, 'atribuciones.json');
  let atr = {}; try { atr = JSON.parse(fs.readFileSync(fAtr, 'utf8')); } catch (e) {}
  const pend = Object.keys(TABLA).filter(t => !(atr[t] && atr[t].origen === TABLA[t] && fs.existsSync(path.join(IMG, atr[t].archivo))));
  for (let k = 0; k < pend.length; k += 20) {
    const lote = pend.slice(k, k + 20);
    const I = await info(lote.map(t => TABLA[t]));
    for (const t of lote) {
      const f = TABLA[t], i = I[f] || I[f.replace(/_/g, ' ')];
      if (!i) { console.log('NO EXISTE   ', f); continue; }
      if (!LIBRE.test(i.licencia)) { console.log('LICENCIA NO ', f, '→', i.licencia); continue; }
      const ext = (i.url.match(/\.(png|jpe?g)(?:$|\?)/i) || [0, 'png'])[1].toLowerCase().replace('jpeg', 'jpg');
      const archivo = f.replace(/\.[a-z]+$/i, '').replace(/[^A-Za-z0-9]+/g, '_').toLowerCase() + '.' + ext;
      const r = await fetch(i.url, { headers: UA });
      if (!r.ok) { console.log('ERROR ' + r.status, f); continue; }
      const b = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(path.join(IMG, archivo), b);
      atr[t] = { archivo, origen: f, titulo: i.titulo, autor: i.autor || 'Wikimedia Commons', licencia: i.licencia, pagina: i.pagina, consulta: new Date().toISOString().slice(0, 10) };
      console.log('ok', (b.length / 1024).toFixed(0).padStart(5) + ' kB', i.licencia.padEnd(14), f);
      await new Promise(r => setTimeout(r, 400));
    }
  }
  fs.writeFileSync(fAtr, JSON.stringify(atr, null, 1));
  console.log(Object.keys(atr).length + ' imágenes con atribución en ' + fAtr);
})();
