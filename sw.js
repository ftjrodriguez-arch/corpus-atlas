/* Corpus — service worker: app instalable que funciona sin conexión.
   V  = versión de la aplicación (página, librerías y datos JSON): cambia en cada publicación.
   MV = versión de los modelos 3D (m2/, hr/, draco/): cambiarla solo cuando cambien las mallas,
        así una actualización de la app no obliga a volver a descargar ~50 MB. */
const V='corpus-v89';
const MV='3';
const SHELL='corpus-shell-'+V, MODELS='corpus-models-'+MV;
const CORE=['./','index.html','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png',
 'lib/three.min.js','lib/GLTFLoader.js','lib/RoomEnvironment.js','lib/DRACOLoader.js',
 'data/catalog.json','data/info.json','data/rig.json','data/lessons.json','data/extras.json','data/fem.json','data/cases.json','data/glossary.json','data/organs.json','data/i18n.json',
 'data/info_en.json','data/info_pt.json','data/lessons_en.json','data/lessons_pt.json','data/cases_en.json','data/cases_pt.json'];
const MODEL_CORE=['draco/draco_wasm_wrapper.js','draco/draco_decoder.wasm','draco/draco_decoder.js','m2/oseo.txt','m2/muscular.txt'];
self.addEventListener('install',e=>{e.waitUntil(Promise.all([
  caches.open(SHELL).then(c=>Promise.all(CORE.map(u=>c.add(u).catch(()=>{})))),
  caches.open(MODELS).then(c=>Promise.all(MODEL_CORE.map(u=>c.match(u).then(h=>h||c.add(u).catch(()=>{})))))
 ]).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==SHELL&&k!==MODELS&&k.startsWith('corpus-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
const isModel=p=>/\/(m2|hr|draco)\//.test(p);
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(SHELL).then(c=>c.put('index.html',cp));return res;}).catch(()=>caches.match('index.html',{ignoreSearch:true})));return;}
  const store=isModel(u.pathname)?MODELS:SHELL;
  e.respondWith(caches.match(r,{ignoreSearch:u.origin===location.origin}).then(hit=>hit||fetch(r).then(res=>{
    if(res&&(res.ok||res.type==='opaque')){const cp=res.clone();caches.open(store).then(c=>c.put(r,cp));}
    return res;})));
});
/* Descarga completa en segundo plano: la página envía la lista y el SW la guarda informando del progreso */
self.addEventListener('message',e=>{const d=e.data||{};if(d.type!=='download')return;
  const post=m=>self.clients.matchAll().then(cs=>cs.forEach(c=>c.postMessage(m)));
  e.waitUntil((async()=>{const c=await caches.open(MODELS);const q=d.files.slice();let n=0,fail=0;const tot=q.length;
    const work=async()=>{while(q.length){const f=q.shift();try{if(!(await c.match(f))){const r=await fetch(f,{cache:'reload'});if(r.ok)await c.put(f,r);else fail++;}}catch(err){fail++;}n++;post({type:'dl-progress',n,tot});}};
    await Promise.all([work(),work(),work(),work()]);post({type:'dl-done',n,tot,fail});})());});
