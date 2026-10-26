/* Corpus — service worker: funciona sin conexión una vez descargado. */
const V='corpus-v25';
const CORE=['./','index.html','manifest.webmanifest','icons/icon.svg','icons/icon-192.png',
 'data/catalog.json','data/info.json','data/rig.json','data/lessons.json','data/extras.json','data/fem.json','data/cases.json',
 'draco/draco_wasm_wrapper.js','draco/draco_decoder.wasm','draco/draco_decoder.js',
 'm2/oseo.txt','m2/muscular.txt'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  // la página: primero la red (para recibir actualizaciones), si no hay red, la copia guardada
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put('index.html',cp));return res;}).catch(()=>caches.match('index.html')));return;}
  // modelos, datos, librerías y fuentes: primero la copia guardada
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{
    if(res&&(res.ok||res.type==='opaque')){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));}
    return res;})));
});
