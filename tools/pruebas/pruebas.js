/* Batería de pruebas de Corpus Atlas.
   Uso: node pruebas.js http://localhost:8765/index.html
   Sale con código 1 si algo falla. Cada prueba imprime ✔ o ✘ con el detalle. */
const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8765/index.html';
const ARGS={args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']};
let fallos=0;const ok=(c,n,d='')=>{console.log((c?'✔ ':'✘ ')+n+(d?'  — '+d:''));if(!c)fallos++;};
const espera=ms=>new Promise(r=>setTimeout(r,ms));
async function abrir(b,W,H){const p=await b.newPage({viewport:{width:W,height:H},locale:'es-ES'});const errs=[],bad=[];
  p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400&&!/importado\.txt/.test(r.url()))bad.push(r.status()+' '+r.url().split('/').slice(-2).join('/'));});
  await p.goto(URL);await p.waitForFunction(()=>window.__corpus&&__corpus.meshes&&__corpus.meshes.length>500,null,{timeout:120000});
  await p.evaluate(()=>{const w=document.querySelector('#welcome');if(w)w.hidden=true;document.body.classList.remove('wopen');});
  return {p,errs,bad};}
const buscar=(p,t)=>p.evaluate(async t=>{const q=document.querySelector('#q');q.value=t;q.dispatchEvent(new Event('input'));await new Promise(r=>setTimeout(r,250));
  return [...document.querySelectorAll('#results button')].map(b=>({t:b.textContent.trim(),est:!!b.dataset.est}));},t);
(async()=>{const b=await chromium.launch(ARGS);
 /* ── escritorio ── */
 const {p,errs,bad}=await abrir(b,1280,900);
 await p.waitForFunction(()=>__corpus.meshes.some(m=>m.userData.c.id==='x51'),null,{timeout:60000}).catch(()=>{});
 ok(await p.evaluate(()=>__corpus.SYS.muscular.state==='loaded'&&__corpus.SYS.oseo.state==='loaded'),'Carga de músculos y huesos');
 const nx=await p.evaluate(()=>{const s=new Set(__corpus.meshes.map(m=>m.userData.c.id));let n=0;for(let i=1;i<=51;i++)if(s.has('x'+i))n++;return n;});
 ok(nx===51,'Las 51 piezas nuevas están en la escena',nx+'/51');
 for(const [t,esp] of [['psoas menor','psoas menor'],['semiespinoso de la cabeza','semiespinoso de la cabeza'],['esfínter externo de la uretra','esfínter externo'],['bíceps braquial','bíceps']]){
   const r=await buscar(p,t);ok(r.length&&r[0].est&&r[0].t.toLowerCase().includes(esp),'Búsqueda «'+t+'»: la estructura sale primero',r[0]&&r[0].t.slice(0,50));}
 const f=await p.evaluate(async()=>{document.querySelector('#results button').click();await new Promise(r=>setTimeout(r,800));
   return {h:(document.querySelector('#infoBox h2')||{}).textContent,kv:document.querySelectorAll('#infoBox dl.kv dt').length,sec:document.querySelectorAll('#infoBox details.fsec').length,mas:!!document.querySelector('#aMoreBtn')&&!document.querySelector('#aMoreBtn').hidden};});
 ok(f.h&&f.kv>=4&&f.sec>=2,'Ficha con datos y secciones plegables',`${f.kv} datos, ${f.sec} secciones`);ok(f.mas,'Barra de acciones con menú ⋯');
 const c=await p.evaluate(async()=>{const m=__corpus.meshes.find(x=>x.userData.c.id==='x3');__corpus.select(m);await new Promise(r=>setTimeout(r,300));document.querySelector('#aCon').click();await new Promise(r=>setTimeout(r,300));
   const t=document.querySelector('#conChip').textContent,on=!!__corpus.contraction;document.querySelector('#aCon').click();await new Promise(r=>setTimeout(r,200));const back=m.matrixAutoUpdate&&m.matrix.equals(new m.matrix.constructor());return {t,on,back};});
 ok(c.on&&/lengua/.test(c.t),'Contracción en el sitio (estilogloso)',c.t.slice(0,60));ok(c.back,'Al parar, la malla vuelve a su forma');
 const iso=await p.evaluate(async()=>{const m=__corpus.meshes.find(x=>x.userData.c.id==='x2');__corpus.select(m);await new Promise(r=>setTimeout(r,300));const th0=__corpus.orb.T.th;document.querySelector('#iIso').click();const th=((__corpus.orb.T.th%(2*Math.PI))+2*Math.PI)%(2*Math.PI);return Math.round(th*57.3);});
 ok(iso>100&&iso<260,'Aislar orienta la cámara hacia la nuca (semiespinoso)',iso+'°');
 const hdr=await p.evaluate(()=>{const h=document.querySelector('header');return h.scrollWidth-h.clientWidth;});ok(hdr<=0,'Cabecera sin desbordar a 1280 px');
 await p.evaluate(()=>document.querySelector('#langSeg [data-lang="en"]').click());await espera(2500);
 const en=await buscar(p,'femur');ok(en.length&&/Bones|Ligaments|Brain/.test(en.map(x=>x.t).join(' ')),'Inglés: sistema traducido en la búsqueda',en[0]&&en[0].t.slice(0,50));
 await p.evaluate(()=>document.querySelector('#langSeg [data-lang="es"]').click());await espera(1500);
 await p.evaluate(()=>document.querySelector('#b-f').click());await espera(9000);
 const fem=await p.evaluate(()=>{const v=o=>{if(!o.visible)return false;let q=o.parent;while(q){if(!q.visible)return false;q=q.parent;}return true;};
   const M=['x29','x33','x35','x37','x39','x41','x44'],ok=['x1','x3','x42','x46'];const g=i=>__corpus.meshes.find(m=>m.userData.c.id===i);
   return {ocultos:M.filter(i=>g(i)&&!v(g(i))).length,deM:M.length,vis:ok.filter(i=>g(i)&&v(g(i))).length,deV:ok.length};});
 ok(fem.ocultos===fem.deM,'Mujer: se ocultan las piezas de pelvis/fémur masculinos',fem.ocultos+'/'+fem.deM);ok(fem.vis===fem.deV,'Mujer: se ven las de cabeza y cuello',fem.vis+'/'+fem.deV);
 ok(!errs.length,'Sin errores de JavaScript (escritorio)',errs.slice(0,2).join(' | '));ok(!bad.length,'Sin descargas fallidas',bad.slice(0,3).join(' | '));
 await p.close();
 /* ── teléfono ── */
 const m=await abrir(b,390,844);
 const mv=await m.p.evaluate(()=>{const pn=document.querySelector('.panel').getBoundingClientRect();const big=[...document.querySelectorAll('button,[role=switch]')].filter(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height||e.closest('[hidden]'))return false;const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')return false;return document.documentElement.scrollWidth>innerWidth;});
   return {hoja:Math.round(pn.height),ancho:document.documentElement.scrollWidth-innerWidth};});
 ok(mv.hoja>0&&mv.hoja<200,'Teléfono: hoja inferior en reposo',mv.hoja+' px');ok(mv.ancho<=0,'Teléfono: sin desplazamiento horizontal');
 const peq=await m.p.evaluate(()=>{window.__corpus.showTab('sistemas');const out=[];for(const e of document.querySelectorAll('#tab-sistemas button,#tab-sistemas [role=switch]')){const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;const b=getComputedStyle(e,'::before');let w=r.width,h=r.height;if(b.content!=='none'&&b.position==='absolute'){w-=2*parseFloat(b.left||0);h-=2*parseFloat(b.top||0);}if(w<24||h<24)out.push(Math.round(w)+'x'+Math.round(h)+' '+(e.textContent.trim().slice(0,15)||e.getAttribute('aria-label')));}return out;});
 ok(!peq.length,'Teléfono: zonas táctiles ≥ 24 px en Capas',peq.slice(0,3).join(' | '));
 ok(!m.errs.length,'Sin errores de JavaScript (teléfono)',m.errs.slice(0,2).join(' | '));
 await b.close();
 console.log(fallos?`\n${fallos} prueba(s) fallida(s)`:'\nTodas las pruebas pasan');process.exit(fallos?1:0);})();
