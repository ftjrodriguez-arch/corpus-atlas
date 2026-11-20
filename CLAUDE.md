# Corpus Atlas — guía para Claude Code

Atlas anatómico 3D libre (three.js r147, una sola página `index.html`). Web pública: https://ftjrodriguez-arch.github.io/corpus-atlas/
(GitHub Pages desde `main`). Versión actual: **v169**.

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
- Idiomas: es, en, pt, fr y de completos (fichas largas FR/DE desde v166 en `data/info_fr.json` / `info_de.json`, mismas claves que `info_en.json`; flujo de traducción en /home/claude/trad_info con validar.py). Los recorridos también están en FR/DE desde v168 (`pTx` busca el texto español en `content_fr/de` con `TLX`; si falta, inglés). Flujo de traducción de recorridos en /home/claude/trad_tours (lotes, validar.py, meta_es.json).

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

## Valoración clínica y sin internet (v152)
- Goniómetro manipulable (`GONI`, `setGoni`, `renderGoniCard`): lo coloca el usuario; nunca colocarlo automáticamente (decisión del usuario).
- ASIA (`ASIA_PTS`, `asiaCompute`, `renderAsia`): puntos calculados sobre los huesos y proyectados a la piel con rayos cortos.
- Lecciones FR/DE en `data/lessons_fr.json` y `lessons_de.json` (validar con lec/validar_trad.py del flujo de Claude).
- Tipografías locales en `fonts/`; `fusion_web.py` debe sustituir el enlace de Google Fonts por `fonts/fonts.css`.
- Sin internet: `ABRIR CORPUS - Windows.bat` → `tools/servidor_local.ps1`; Mac `.command`; Linux `abrir-corpus-linux.sh`. El .zip es el de GitHub (main).

## v153
- ECOE (`ECOE`, `ecoeMk`, `ecoeShow`, `renderEcoe`): estaciones generadas a partir de los datos existentes; guarda y restaura las capas.
- `printLesson(L)`: vista imprimible (`#printArea`, `body.printing`).
- Protocolos en `data/protocols.json` (`renderProt`), casos en `data/rc.json` agrupados por `r` (deporte, neuro, pediatria, geriatria…).

## v154 (rendimiento)
- Dibujo agrupado `BATCH` (junto a `needDraw`/`frame0`): `batchBegin` antes de `renderer.render` y `batchEnd` después de `aoRender` (siempre en `finally`). No agrupa transparentes ni piezas con transformación distinta de la identidad, renderOrder, grupos o morph. `?nobatch` lo desactiva; con `?qa`, `window.__batch` (on, stats).
- Al comparar capturas, hazlo en la misma sesión (`__batch.on=false`): la aparición de capas y otras transiciones avanzan por fotograma y dos sesiones casi nunca coinciden.
- `loadSys` y `loadHR` preparan las piezas por tandas de ~12 ms; `fetchB64` usa `Uint8Array.fromBase64` o `fetch(data:)` antes del bucle con `atob`.
- Los observadores de emojis y de traducción solo recorren los nodos que cambiaron.
- v155: sombras en caché `SHC` (`shcBegin`/`shcEnd` alrededor del dibujo principal; firma en `shcSig`). Si añades algo que cambie las sombras sin pasar por geometría, material, matriz, visibilidad, luces o `clipArr`, inclúyelo en `shcSig`. Etiquetas a ~8 Hz en reposo (`frame0.lt`).
- Portugués: siempre de Brasil (patela, quadril, controle, esporte, celular, tela, muletas). Al corregir textos, cambia solo cadenas en portugués: «rótula», «fémur», «crónica» son correctas en español. Ojo con el género al cambiar sustantivos (anca f. → quadril m.). Script de apoyo del flujo de Claude: detecta portugués antes de reemplazar.
- v158: encuadre en `fitNow` (kf 0,32 teléfono / 0,34 escritorio, distancia mínima 0,25) y `fitUsable` descuenta `#qbar` arriba y `#actbar` abajo. Recorridos en Estudiar: `details.toursec` (primero, abierto; título con `toursSum`). Estilos nuevos en `<style id="v158">` antes de `<header>` (v159 añade ahí lo del teléfono, con selectores fuertes `html body.mnav #stage #qbar.qbar …` porque hay reglas posteriores con !important). `focusMesh` usa `fitMeshes`. Contadores de la bienvenida en `fixCounts` (la app arranca después de «load»).
- Con dibujo por software (swiftshader) la prueba «Inglés: sistema traducido» puede fallar por tiempo: la traducción va en el siguiente fotograma y cada uno tarda segundos.

## v160 (francés y alemán)
- `data/content_fr.json` / `content_de.json`: texto en español → traducción; `setLang` los mezcla en `I18N.ui[l]` (no pisa la interfaz). `TL` busca primero el texto y, si lleva cifras, la plantilla `#…{n}…` (`TLX`). Casos clínicos en `cases_fr.json` / `cases_de.json` (si falta, inglés). Variantes y distractores del ECOE pasan por `TL`.
- Al añadir textos nuevos a bio/rc/protocols/variants/cases, añade también su traducción FR/DE (si no, se ve en inglés).

## v161 (serie narrada más real)
- Corazón HRA: `data/heart_hra.glb` (Draco, 32 mallas con el nombre exacto de la pieza del atlas) + `data/heart_hra_hide.json` (piezas que quedan sin dibujar). `hraLoad()` se lanza al cargar arterial/venoso, pone la geometría en `HRGEO[id]` (la alta resolución no la pisa: `HRA.ids`) y oculta con `drawRange 0` (`hraHideGeo`). GLTFLoader cambia espacios por «_» en los nombres. Fuente y registro en el flujo de Claude (/home/claude/heart_build: reg.json, v2.py).
- Deformación por vértices `VD` (`vdDeform`, `vdResetAll`; `userData.nobatch` saca la pieza del dibujo agrupado). Tórax: `thxPose(A,desc,{dia,lungs})` (costillas rígidas sobre el eje cabeza→tubérculo, esternón ajustado a las costillas 1–2 y 6–7, cartílagos e intercostales mezclados entre huesos). Corazón: `hfBuild`/`hfPose` (campo continuo base→punta). `phyResetPose` y `animReset` llaman a `thxReset`.
- Prueba en vivo con GPU real: rama `prueba-*` y página en iframe srcdoc desde raw.githubusercontent con el SHA del commit (la rama se cachea 5 min); `iframe.name='qa'` expone `__thx`; `window.__bFix` fija la fase de la respiración.

## v163 (marcha con datos abiertos)
- `GAIT_K` (cadera, rodilla, tobillo cada 2 %) y `GN` (pelvis obl/rot, tórax−pelvis, brazo, centro de masas, GRF) salen de /home/claude/gait_src/normativa.json (Fukuchi 2018, Schreiber 2019, Lencioni 2019). `gN(tabla,p)` interpola. `gaitRoot(p)` mueve el grupo `body` (pelvis + centro de masas) y `gaitRootOff()` lo devuelve; no actúa con la sentadilla. El tórax contrarrota con la articulación `trunk` (eje y).

## v164 (pulmones por dentro)
- `micro/acino.html` + `micro/acino.bin` (generador en el flujo de Claude: /home/claude/lung_build/acino_gen.py y /home/claude/acino_prod/tools/acino_bin.py). Parámetros `v`, `lang`, `embed`, `lite`; postMessage `{acino:'view'|'lang'}`. En la app: `acinoShow(v)` / `acinoHide()` (llamado desde `phyResetPose`), capa `#acinoFrame` sobre `#stage`.
- Paso `gas` de `resp`: arterias segmentarias teñidas de azul y venas de rojo; `phyPulmRoutes()` añade rutas de partículas por cada vaso segmentario.
- `PHY.ready`/`PHY.pend`: `phyGo` espera a que termine la carga del recorrido.

## v165
- Suelo de la marcha: `gaitFloor()` (después de `deform` en `applyPose` y en los recorridos de marcha) sube o baja `body` para que el punto más bajo de los huesos del pie quede en `GF.floor`; `gaitGrid` dibuja la cinta (`GF.v` = velocidad medida del pie de apoyo). En `applyPose` no se llama a `sqApplyRoot` mientras hay marcha (antes deshacía la raíz). Extensión de las MTF en `gaitActive`. `window.__gaitFix` fija la fase en el recorrido para pruebas.
- Paso `vq` en `resp`: `vqQ`/`vqV`/`vqAt` (West 1962), `vqCol`, `phyTintFn` (tinte por vértice) y el gráfico `phyDrawVQ`.

## v166
- `loadInfoTr` carga `info_fr`/`info_de` (si falta, inglés). Botón `#vqPos` (de pie / tumbado) en el paso `vq`; `PHY.vqSup`.

## v167
- Segmentos broncopulmonares: `VQSEG` (lóbulo, bronquio, código S1–S10), `vqSegBuild` (asignación angular desde el hilio de cada lóbulo; caché en `userData.vqSeg`, se rehace si cambia la geometría) y `vqSegPaint`. Botón `#vqSegB` en el paso `vq` (`PHY.vqSegOn`); oculta las costillas con `hiddenIds`.

## v168
- Estados de color continuos `lv1`–`lv5` (`u.lv` 0–1, en `refreshState` después de `hint`): amarillo → naranja → magenta (no usar rojo: se confunde con el músculo).
- Marcha: `GAIT_LV` (curvas por grupo de `GAIT_M`, Perry/Winter aproximado), `lvAt`; sentadilla: `SQ_LVB`/`sqLevel`. Interruptor `ACT_LV` (`store 'actLv'`), leyenda `actLegend` en `#gaitLeg` y `#sqLeg`.
- Perfil de movilidad: `MOB`, `renderMob` (`#mobCard`), datos en `store 'mob'` ({cur,list:[{id,name,date,v:{'joint|move|S':grados}}]}), `mobPaint` colorea agonistas de los movimientos <80 %. `window.goniReading`.
- Puente de glúteo: `CTESTS` id `bridge` con `lie:1` (el encuadre usa la caja en coordenadas del mundo).
- Contador: las URL con `?qa`, `?prueba` o `?v=` no cuentan. Informe semanal de GoatCounter activado (cuenta ft.jrodriguez@gmail.com, panel en español).

## v169 (HuBMAP HRA v1.4)
- `data/hra14.glb` (Draco, mallas con el id del catálogo): ojo completo, cartílagos traqueales y tonsilas palatinas. `hra14Load()` se lanza al cargar `nervioso_central`, `respiratorio` o `linfatico`; `hra14Apply()` cambia la geometría de las piezas que existen (`HRGEO`, `HRA.ids`) y crea las nuevas (ids `h1`–`h27`).
- Se regenera con `tools/hra14/construir.py` (necesita numpy, trimesh, fast-simplification y las mallas de `tools/unreal/exportar.js` como anclas) y `npx @gltf-transform/cli draco`; piezas en `piezas.json`, nombres y fichas en `fichas.py`, registro del ajuste en `registro.json`.
- Descartado por ahora: carina, cartílagos bronquiales y segmentos pulmonares de HRA (el árbol bronquial de Corpus tiene otra forma y sus arterias segmentarias lo siguen), laringe (la de Corpus tiene más detalle).
- Pendiente de decisión del usuario: Z-Anatomy declara dos modelos de origen con licencia no comercial (oído interno de Dundee, CC BY-NC-SA; riñón de L. Cowley, CC BY-NC) que `ATTRIBUTION.md` aún no menciona.

## Edición Unreal Engine (en curso, aparte de la web)
- Decisión del usuario (2026-11-20): la web se mantiene; Unreal es una edición de escritorio aparte, de más calidad gráfica.
- `tools/unreal/exportar.js` exporta todos los modelos a GLB sin comprimir en `unreal/CorpusAtlas/Importar/` (no se sube); proyecto en `unreal/CorpusAtlas/` (C++ + `Content/Python/corpus_importar.py`). Estado, pasos y fases pendientes en `unreal/LEEME.md`.
- En la nube no hay Unreal: compilar, ver y afinar materiales se hace en el PC del usuario.

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
