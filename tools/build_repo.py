"""Genera index.html del repositorio a partir de la página del artifact."""
import os,json,sys
S='/tmp/claude-0/-home-claude/125c3fcb-e177-579b-8d30-1c53ba4af93d/scratchpad'
R=sys.argv[1] if len(sys.argv)>1 else '/home/claude/corpus-atlas'
s=open(S+'/corpus/corpus-atlas.html').read()
head='''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Atlas anatómico 3D libre y gratuito en español: 4.700 estructuras del cuerpo humano masculino y femenino, disección por capas, orígenes e inserciones, rangos articulares, ciclo de la marcha y fichas clínicas.">
<meta name="theme-color" content="#0d1117">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/icon-192.png">
'''
s=s.replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')
files=sorted(['m2/'+f for f in os.listdir(R+'/m2')]+['hr/'+f for f in os.listdir(R+'/hr')])
mb=sum(os.path.getsize(R+'/'+f) for f in files)/1e6
V=open(R+'/sw.js').read().split("const V='")[1].split("'")[0]
off='''
<script>
/* Descarga completa para estudiar sin conexión (solo en la versión publicada en la web) */
(()=>{if(!('serviceWorker' in navigator)||location.protocol==='file:')return;
 const FILES=%s;const box=document.createElement('div');box.className='card';
 box.innerHTML='<h3>Usar sin conexión</h3><p class="muted small">Guarda todos los modelos (hombre, mujer y alta resolución, unos %d MB) en este dispositivo. Después el atlas funciona sin internet, también instalado como app desde el menú del navegador.</p><button class="btn" id="offBtn">Descargar todo</button> <span class="muted small" id="offTxt"></span>';
 const host=document.querySelector('#hrCard');if(host)host.after(box);
 const btn=box.querySelector('#offBtn'),txt=box.querySelector('#offTxt');
 btn.onclick=async()=>{btn.disabled=true;let n=0;const c=await caches.open('%s');
   for(const f of FILES){try{if(!(await c.match(f))){const r=await fetch(f);if(r.ok)await c.put(f,r);}}catch(e){}n++;txt.textContent=` ${n} de ${FILES.length} archivos`;}
   txt.textContent=' Listo: el atlas ya funciona sin conexión.';};
})();
</script>
<script>
if('serviceWorker' in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
</script>
'''%(json.dumps(files),round(mb),V)
open(R+'/index.html','w').write(head+s+off)
print('index.html', len(s), V)
