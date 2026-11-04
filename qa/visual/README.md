# Verificación visual

Antes de publicar cualquier cambio de movimiento se pasa este bucle: capturas desde varias cámaras y fases,
métricas por código y corrección hasta que todo cumple (ver los criterios en `CEREBRO.md`).

```bash
python3 -m http.server 8765            # desde la raíz del repositorio
python3 qa/visual/run.py qa/visual/squat.js salida/ 700 900
python3 qa/visual/contact.py salida/ sq_par salida/contacto.jpg
python3 qa/visual/ui_squat.py salida_ui/   # la tarjeta en teléfono y ordenador, en es/en/pt
```

`run.py` abre la app con `?qa`, que activa `window.__qa` (solo existe con ese parámetro): evalúa código dentro
de la app y dibuja el lienzo para guardarlo. Necesita Chrome y Playwright.
