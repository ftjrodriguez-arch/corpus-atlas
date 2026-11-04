# Pruebas de Corpus Atlas

Antes de publicar una versión, ejecuta:

    npx playwright install chromium   # solo la primera vez
    python -m http.server 8765        # en la carpeta de la app
    node pruebas.js http://localhost:8765/index.html

Comprueba: carga de modelos, las 51 piezas nuevas, búsqueda (la estructura sale primero),
ficha con secciones, barra «⋯», contracción en el sitio y vuelta a la forma, «Aislar» orienta la cámara,
cabecera sin desbordar, traducción al inglés, cuerpo de mujer (piezas ocultas y visibles),
teléfono (hoja inferior, sin desplazamiento horizontal, zonas táctiles ≥ 24 px) y ausencia de errores.
Sale con código 1 si algo falla.
