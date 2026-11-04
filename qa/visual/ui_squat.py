"""Captura de la tarjeta «Sentadilla» en el panel, en teléfono (375 px) y ordenador (1280 px), en es/en/pt.
Uso: python3 qa/visual/ui_squat.py <carpeta_salida>"""
import asyncio, sys, os
from playwright.async_api import async_playwright

async def one(b, out, w, h, lang, mobile):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, locale='es-ES', is_mobile=mobile, has_touch=mobile, device_scale_factor=1)
    pg = await ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    await pg.goto('http://localhost:8765/index.html?qa', wait_until='load')
    for _ in range(120):
        await pg.wait_for_timeout(1000)
        if await pg.evaluate("()=>!!(window.__qa&&__qa.ready)"): break
    await pg.evaluate(f"""()=>__qa.ev(`(async()=>{{ if('{lang}'!=='es') await setLang('{lang}');
        const w=document.getElementById('welcome')||document.querySelector('.welcome');if(w)w.hidden=true;
        document.querySelectorAll('dialog[open]').forEach(d=>d.close());
        showTab('mov');setSq(true);SQ.play=false;SQ.p=50;sqUpdate();
        const d=document.querySelector('#sqCard details');if(d)d.open=true;
        /* para la captura: la tarjeta se coloca en una capa fija, con el mismo ancho que tiene en el panel */
        const c=document.getElementById('sqCard'),cw=c.getBoundingClientRect().width||Math.min(380,innerWidth-24);
        const h=document.createElement('div');h.id='qaHost';h.style.cssText='position:fixed;left:0;top:0;z-index:99999;background:var(--bg);padding:12px;width:'+(cw+24)+'px;max-height:none;overflow:visible';
        c.parentNode.insertBefore(document.createComment('sq'),c);h.appendChild(c);document.body.appendChild(h);}})()`)""")
    await pg.set_viewport_size({'width': w, 'height': 2400})
    await pg.wait_for_timeout(2500)
    card = await pg.query_selector('#qaHost')
    await card.screenshot(path=os.path.join(out, f'ui_{lang}_{w}.png'), timeout=300000)
    box = await card.bounding_box()
    overflow = await pg.evaluate("()=>{const c=document.getElementById('sqCard');return {cardW:c.scrollWidth,clientW:c.clientWidth,docOverflow:document.documentElement.scrollWidth>window.innerWidth}}")
    print(lang, w, 'caja', box, overflow, 'errores:', errs[:5])
    await ctx.close()

async def main():
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        await one(b, out, 1280, 900, 'es', False)
        await one(b, out, 375, 812, 'es', True)
        await one(b, out, 375, 812, 'en', True)
        await one(b, out, 1280, 900, 'pt', False)
        await b.close()
asyncio.run(main())
