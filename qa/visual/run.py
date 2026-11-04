"""Arnés de verificación visual de Corpus.

Abre la app en Chrome sin interfaz con ?qa, espera a que cargue el modelo y ejecuta un
script JS. El script corre como cuerpo de una función async y dispone de:
  E(src)          evalúa código dentro del ámbito de la app (JOINTS, meshes, orb, camera...)
  shot(nombre)    dibuja el lienzo 3D y lo guarda como <salida>/<nombre>.jpg
  wait(ms)        espera
Devuelve un objeto JSON que se imprime (métricas).

Uso: python3 qa/visual/run.py <script.js> <carpeta_salida> [ancho] [alto]
Requiere un servidor local: python3 -m http.server 8765 (desde la raíz del repositorio).
"""
import asyncio, sys, json, base64, os
from playwright.async_api import async_playwright

async def main():
    js = open(sys.argv[1], encoding='utf8').read()
    out = sys.argv[2]
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 800
    h = int(sys.argv[4]) if len(sys.argv) > 4 else 900
    os.makedirs(out, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=[
            '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': w, 'height': h}, locale='es-ES')
        errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:400]))
        pg.on('console', lambda m: errs.append('console.error: ' + m.text[:400]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)

        async def save(name, data):
            with open(os.path.join(out, name + '.jpg'), 'wb') as f:
                f.write(base64.b64decode(data.split(',', 1)[1]))
        await pg.expose_function('__save', save)
        await pg.goto('http://localhost:8765/index.html?qa', wait_until='load')
        for _ in range(120):
            await pg.wait_for_timeout(1000)
            if await pg.evaluate("()=>!!(window.__qa&&__qa.ready)"):
                break
        else:
            print('La app no terminó de cargar'); await b.close(); return
        await pg.wait_for_timeout(1500)
        wrapped = """async()=>{const E=s=>__qa.ev(s);const wait=ms=>new Promise(r=>setTimeout(r,ms));
          const shot=async n=>{await wait(60);await window.__save(n,__qa.render());};
          """ + js + "}"
        res = await pg.evaluate(wrapped)
        print(json.dumps(res, ensure_ascii=False, indent=1)[:30000])
        if errs:
            print('ERRORES (' + str(len(errs)) + '):', *errs[:15], sep='\n  ')
        await b.close()

asyncio.run(main())
