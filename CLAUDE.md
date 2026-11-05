# Corpus Atlas — guía para Claude Code

Atlas anatómico 3D libre (three.js r147, una sola página `index.html`). Web pública: https://ftjrodriguez-arch.github.io/corpus-atlas/
(GitHub Pages desde `main`). Versión actual: **v150**.

Lee primero `CEREBRO.md` (visión, arquitectura del movimiento, criterios, decisiones) y `README.md` (historial por versión).

## Fuente de verdad
- Desde el 2026-11-04 se trabaja **directamente en este repositorio**. El artefacto de claude.ai (versión 217) era una copia
  con three.js desde CDN; no hace falta mantenerlo salvo que el usuario lo pida.
- La web usa `lib/` (three.js local), `sw.js` (PWA sin conexión) y un bloque propio al final de `index.html`
  (botón Instalar, descarga completa y aviso «Hay una versión nueva»). Conserva esos bloques.

## Publicar una versión (vNNN)
1. Sube `const V='corpus-vNNN'` en `sw.js` **y** `const APP_V='corpus-vNNN'` en `index.html` (deben coincidir: el aviso de actualización los compara).
   `MV` solo cambia si cambian las mallas (m2/, hr/, draco/).
2. Añade un párrafo «En vNNN …» al README.
3. Pruebas: `python -m http.server 8765` y `node tools/pruebas/pruebas.js http://localhost:8765/index.html` (todas en ✔).
4. Verificación visual de cualquier cambio de movimiento: `qa/visual/` (`?qa` activa `window.__qa` con `ev` y `render`).
5. Commit en español («vNNN: …»), push a `main`, comprueba en la web que `sw.js` sirve la versión nueva, y actualiza Graphify.

## Datos y modelos
- `data/catalog.json` (ids, nombres en/es/la, sistema, lado), `data/nuevos.json` (piezas modeladas en Blender, formato v3:
  {id,o,p,i,w,f?}, ids impares izquierda / pares derecha), `data/fem.json` (cuerpo de mujer: cat, info, ovr, fonly).
- El cuerpo de mujer es el esqueleto masculino con la pelvis deformada (tools/pelvis_warp.py) más órganos del Visible Human Female.
  `MALE_NEW` oculta en la mujer las piezas solo masculinas (x29–x34, x37, x38).
- Modelado en Blender: scripts en `C:\claude_vision\cw\` (modelar_*.py, importar_za.py, cw_util.py, escenas Corpus_*.blend,
  export_*.json). Coordenadas: atlas (x,y,z) = Z-Anatomy (x,z,−y).
- Idiomas: es, en, pt completos; fr y de para interfaz y nombres (`data/i18n_fr.json`, `data/i18n_de.json`), fichas largas en inglés.

## Movimiento (resumen; detalle en CEREBRO.md)
- `deform(active)` deforma las mallas reales; `applyPose()` decide marcha, sentadilla (`SQ`, cadena cerrada) o rango articular.
- Ejercicios funcionales: entradas `fx:1` en `CTESTS` (pose, tg, ex/how/pos en es/en/pt). Con `anchor` los pies quedan fijos
  moviendo el grupo `body` entero (CT.root), igual que la sentadilla.
- Músculos que trabajan en ejercicios: estado `sq` (magenta #e23fbf). Agonistas del rango articular: naranja.
- Post-procesos: `kneePush` (gemelos/isquios fuera del hueso en flexión profunda de rodilla) y `latHug`
  (dorsal ancho y redondo mayor pegados al tórax al elevar el brazo).

## Contenido educativo (v149)
- Lecciones en `data/lessons*.json` (es/en/pt, mismos ids y pasos): `{id,t,r,a,obj,steps[{t,x,show,view}],q:[5 preguntas]}`; `a` = asignatura.
  Los nombres de `show` y `en` deben existir en el catálogo del modelo. Fallar una pregunta con `en` la manda al repaso espaciado.
- Kinesiología y biomecánica (`renderBio`, `bioShow`, `bioMove`, `bioExam`): banco en `data/bio.json` `{id,r,q,a,x,tg,d?,nota?,mv?,view?,nuevo?}`.
  `d` = 3 distractores [es,en,pt]; `mv` = `{ct:'<id de CTESTS>'}` o `{pose,anchor}` (mismos signos que CTESTS). Si cambia el tamaño de bio.json,
  actualiza su entrada en `BG_FILES`.
- Variantes anatómicas en `data/variants.json` (incluido en el CORE de `sw.js`).
- Textos de técnica de ejercicios en `EJ_TXT` (errores, progresiones, precauciones) y escenas de ergonomía en `CTESTS` con `r:'ergonomia'`.

## Pendiente
- Decisión del usuario: NUNCA servidor propio, cuentas ni base de datos. Todo debe funcionar en local y sin conexión (GitHub Pages solo sirve los archivos estáticos).
- Interfaz móvil nueva programada en v147–v148 (barra inferior, capas en fila, hoja de estructura tocada): recoger opiniones y pulir.
- Al fusionar el artefacto con la web, los bloques nuevos al principio o al final del archivo se pierden: ponerlos en mitad (p. ej. antes de `<header>`).
- Revisión por un fisioterapeuta de los parámetros de la sentadilla.
- Dividir `index.html` en módulos sin romper el modo sin conexión.
- Ideas: perfil de movilidad desde las mediciones del paciente; puente de glúteo; activación muscular continua.

## Atribución de commits
Termina los mensajes de commit con:
Co-Authored-By: Claude <noreply@anthropic.com>
