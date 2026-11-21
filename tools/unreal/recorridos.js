// Corpus Atlas (edición Unreal) — saca de la web los recorridos narrados (tabla TOURS) a tools/unreal/recorridos_web.json.
// Además de los textos, abre cada paso en la web y anota lo que la web enseña en él: capas encendidas y su opacidad,
// piezas aisladas (phyIso), piezas ocultas, cuerpo (m/f) y cámara (órbita). Unreal reproduce eso mismo.
// Uso (con `python -m http.server 8765` en marcha):  node tools/unreal/recorridos.js [url] [--solo=heart,resp]
// Solo hace falta repetirlo si cambian los recorridos de la web; estudio.js lee el JSON ya guardado.
const fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('Falta playwright (NODE_PATH al node_modules que lo tenga).'); process.exit(1); }
const URL = process.argv.slice(2).find(a => /^http/.test(a)) || 'http://localhost:8765/index.html';
const SOLO = (process.argv.find(a => a.startsWith('--solo=')) || '').slice(7).split(',').filter(Boolean);
const sal = path.join(__dirname, 'recorridos_web.json');
const espera = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=8192'] });
  const p = await b.newPage();
  p.setDefaultTimeout(600000);
  await p.goto(URL + '?qa');
  await p.waitForFunction(() => window.__qa && __qa.ready, null, { timeout: 300000 });
  const T = JSON.parse(await p.evaluate(() => __qa.ev(`JSON.stringify(Object.keys(TOURS).map(k=>({id:k,n:TOURS[k].n,need:TOURS[k].need,steps:TOURS[k].steps.map(s=>({id:s.id,es:s.es,en:s.en,pt:s.pt}))})))`)));
  // tablas de la web que usan los módulos de estudio: pruebas y ejercicios (CTESTS) y regiones de kinesiología (BIO_R)
  const tablas = JSON.parse(await p.evaluate(() => __qa.ev(`JSON.stringify({bio_r:BIO_R,ctests:CTESTS.map(c=>({id:c.id,n:c.n,r:c.r,tg:c.tg,view:c.view,ex:c.ex,how:c.how,pos:c.pos,fx:c.fx}))})`)));
  fs.writeFileSync(path.join(__dirname, 'tablas_web.json'), JSON.stringify(tablas));
  console.log('tablas: ' + tablas.ctests.length + ' pruebas y ejercicios');
  if (process.argv.includes('--tablas')) { await b.close(); return; }
  // lo ya anotado en una pasada anterior se conserva (la pasada completa tarda: dibujo por software)
  let antes = {};
  try { for (const t of JSON.parse(fs.readFileSync(sal, 'utf8'))) antes[t.id] = t; } catch (e) {}
  for (const t of T) {
    const a = antes[t.id];
    if (a && a.steps.length === t.steps.length && a.steps.every(s => s.ver) && !SOLO.includes(t.id)) { t.steps.forEach((s, i) => { s.ver = a.steps[i].ver; }); continue; }
    if (SOLO.length && !SOLO.includes(t.id)) continue;
    const t0 = Date.now();
    try {
      await p.evaluate(async id => { await __qa.ev('phyStart')(id, 0); }, t.id);
      await p.waitForFunction(() => __qa.ev('PHY.ready') === true, null, { timeout: 600000 });
      for (let i = 0; i < t.steps.length; i++) {
        await p.evaluate(i => { __qa.ev('phyGo')(i); }, i);
        await espera(1200);
        t.steps[i].ver = JSON.parse(await p.evaluate(() => __qa.ev(`JSON.stringify({
          capas:Object.fromEntries(Object.keys(SYS).filter(k=>SYS[k].on).map(k=>[k,+(+SYS[k].op).toFixed(2)])),
          iso:(isoOnly&&isoSet)?[...isoSet]:null, ocultas:[...hiddenIds], cuerpo:BODY,
          cam:{th:+orb.T.th.toFixed(3),ph:+orb.T.ph.toFixed(3),r:+orb.T.r.toFixed(3),tgt:orb.T.tgt.toArray().map(v=>+v.toFixed(3))}})`)));
      }
      await p.evaluate(() => { __qa.ev('phyStop')(); });
      await espera(500);
      console.log(t.id, t.steps.length, 'pasos', ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    } catch (e) { console.log(t.id, 'ERROR', String(e).slice(0, 200)); }
    fs.writeFileSync(sal, JSON.stringify(T));
  }
  fs.writeFileSync(sal, JSON.stringify(T));
  console.log('recorridos:', T.length, 'con vista:', T.filter(t => t.steps.every(s => s.ver)).length, '→', sal);
  await b.close();
})();
