# Corpus Atlas · pendientes

Índice corto. El detalle está en `unreal/LEEME.md` (estado técnico de la edición Unreal), `unreal/PLAN_SPRINTS.md`
(sprints) y `unreal/AUDITORIA_CADERA_RODILLA.md` (hallazgos clínicos). Trabajo en `X:\corpus atlas`, rama
`ccr-2f1bf474-vuby5r`. La carpeta `C:\Users\Admin\Documents\Proyectos Claude\corpus-atlas` es una copia de `main`
(web v168) y no tiene la edición Unreal: Graphify se construye desde ella.

## Sprint 1 (fémur, cadera y rodilla) — en curso
- [x] Plano de corte, fantasma, pelar capas, panel plegable
- [x] Relieves óseos del fémur y mapa de origen e inserción
- [x] Goniómetro y reproducción suave; vínculo ficha → Estudiar
- [x] Rodilla: rotación automática en los rangos; sentadilla en modo Ejercicio
- [x] Tendones: origen carnoso frente a inserción tendinosa
- [x] Trapecio inferior por encima del dorsal ancho; nombres de sus porciones corregidos en el catálogo
- [ ] Glúteo mayor sin hincharse ni colgar en flexión de cadera y sentadilla
- [x] Muslo continuo en flexión de rodilla: campo común de peso de rodilla (huecos > 5 mm a 135°: 62 → 33; sentadilla 71 → 43). Pendiente de revisión visual del usuario
- [x] Validador de datos (`tools/unreal/validar.js`): 0 errores
- [x] Nombres en francés y alemán: 59 traducciones erróneas de claves en minúscula corregidas (p. ej. «rodilla» → «cadera» en alemán); avisos de mayúsculas 104 → 53, los que quedan son significados distintos

## Sprint 2 (aparato locomotor) — en curso
- [x] Músculos agrupados separados uno a uno (`tools/unreal/separar.js`): intercostales, subcostales, interóseos dorsales de mano y pie, lumbricales de la mano, interóseos plantares y rotadores (C3–L5)
- [ ] Interóseos palmares y lumbricales del pie: modelarlos en Blender (la malla de la web no trae sus formas)
- [x] 10 ejercicios nuevos con postura (zancada, peso muerto, sentarse y levantarse, abducción de cadera, curl, elevación lateral y frontal, press, remo, patada de glúteo), horneados el 2026-11-22 (capturas `ej_*`)
- [x] Francés y alemán de los 30 textos de técnica, progresiones y precauciones de los ejercicios (`ejercicios.json → traducciones`;
      también aplicados al `movimiento.json` horneado). Pendientes de revisión de un nativo.
- [ ] Pruebas ortopédicas con postura (las de paciente tumbado necesitan la raíz del cuerpo acostado)
- [ ] Dedos de mano y pie con movimiento (el rig solo tiene 27 articulaciones y 5 bits por hueco)
- [ ] Cinta de suelo y gráficas de la marcha

## Trabajo repartido en otros chats (anotado el 2026-11-22)
El usuario siguió por error el trabajo de Corpus en otros chats en paralelo a la sesión «Corpus Atlas Unreal compilación
y pruebas». Todo está en la misma rama; esto es lo que cada uno dejó a medias.

**Chat del teléfono (claude.ai, sesión `session_01DmC7U1BKkg61unuu5pmdvd`, 22 nov., commits f916243…929d614)**
Hizo Sprint 1 L2/N, Sprint 2 (músculos separados, 10 ejercicios), 59 traducciones FR/DE y dejó `TRASPASO_CLAUDE_CODE.md`.
- [x] Dorsal ancho deformado en elevación lateral y press: correctivos del hombro también en el modo Ejercicio.
      Revisado el 2026-11-22 en `hoja_dorsal.png` y `hoja_dorsal_cerca.png`: continuo y sin abultarse en elevación
      lateral, press y remo. En abducción de 150° sigue el pliegue junto al ángulo inferior (anotado abajo).
- [x] Capturas `unreal/capturas/col_*` (color del músculo antes/después) subidas.
- [x] Aponeurosis del dorsal ancho (rombo blanco lumbar, como en los atlas que envió el usuario): `tools/unreal/aponeurosis_dorsal.js`
      pinta el canal G del propio dorsal (frontera T10 → cresta ilíaca) y `tendones_reglas.json` incluye ya la hoja posterior de la
      fascia toracolumbar. Hombre y mujer reimportados; capturas `hoja_fascia_toracolumbar.png` y `hoja_aponeurosis_dorsal.png`.
      Pendiente de revisión profesional. Si se repite `tendones.js --aplicar`, volver a ejecutar `aponeurosis_dorsal.js` después.
- [x] Remo al 100 % (= 0 % del ciclo): el serrato y el redondo mayor atravesaban el dorsal ancho. Causa: `correctivos.js` trataba
      el cuadro 0 de cada ejercicio como reposo (una iteración y sin colisiones). Corregido y horneado de nuevo (todos los
      ejercicios); celdas atravesadas en el cuadro 0 del remo 451 → 30. Capturas `hoja_cuadro0.png`, `hoja_row0_cerca.png`.
- [ ] Queda un punto pequeño del redondo mayor junto a la axila en el remo (8–13 mm): los músculos no chocan entre sí (ver abajo).
- [x] `correctivos.js hornear-ejercicios` ya compacta el .bin (antes crecía en cada horneado); comprobado byte a byte.
- [ ] Graphify no se actualiza: falta el paquete `graphify` en Python 3.12 (instalarlo desde `_graphify\wheels` con permiso).
- [ ] `tendones.js --restaurar` ya no funciona con los músculos separados (n1633_4… no están en la web): adaptarlo a `separar.js`.
- [ ] El resto de su lista ya está arriba en el Sprint 2 (FR/DE de ejercicios, pruebas ortopédicas, interóseos y
      lumbricales, dedos, cinta y gráficas) y en `unreal/PLAN_SPRINTS.md`.

**Chat «?» (local, 20 nov.): correctivos elásticos del hombro y leyenda de la marcha** (hecho y subido)
- [ ] Al elevar la escápula 40° se abre un hueco bajo la clavícula.
- [ ] El dorsal hace un pliegue junto al ángulo inferior de la escápula en abducción de 150°.
- [ ] Los músculos no chocan entre sí, solo con los huesos.
- [x] Correctivos de la mujer comprobados en capturas (abducción y flexión de 150°, `hoja_mujer_hombro.png`): hombro continuo
      y color normal.
- [ ] Llevar los correctivos a la cadera (glúteo mayor en flexión > 90°; ver también el punto K del LEEME).
- [ ] Piel del Visible Human algo anaranjada.
- [ ] Post-procesos de la web sin pasar: `musPost`, `latHug`, `kneePush`.

**Este chat (interfaz Slate, 21–22 nov., commits ced53f1…bdd71b0)** (fases 1–3 hechas y subidas)
- [ ] Probar en el PC con el ratón real: clic y doble clic con la cámara descentrada, menús que se cierran al pulsar fuera, Tab entre botones.
- [ ] Comprobar si el filtro de visión de color tiñe también el modelo 3D (no sale en las capturas).
- [x] Detalles menores del director clínico en la ficha: tipo y «Función estabilizadora» en ligamentos, bloque «Funktion und
      Biomechanik» en alemán, «Región» (13 regiones en 5 idiomas) y «Plano muscular», «Clinical» en inglés y columna de
      rótulos más ancha («Blutversorgung» se cortaba). Capturas `hoja_ficha_director.png`, `hoja_ficha_mujer.png`.
- [ ] La web tiene el mismo rótulo erróneo «Referencias» en los huesos (Unreal ya dice «Palpación e imagen»): corregirlo en rama aparte.
- [ ] `data/hoja_rotulos.png` es una copia suelta creada por error (la buena está en `unreal/capturas/`): borrarla con permiso del usuario.

**Chat «Mejora general» (21 nov.)**: no es de Corpus (Grok, Codex, NVIDIA y el juego del robot). Ahí quedó
pendiente guardar la clave `NVIDIA_API_KEY` y averiguar por qué Grok no termina las preguntas largas.

## Contenido clínico pendiente de revisión profesional
- Reglas de tendones (`tools/unreal/tendones_reglas.json`), notas de rodilla (`rangos_extra.json`), sentadilla y sus
  traducciones FR/DE (`ejercicios.json`), imprecisiones de `unreal/AUDITORIA_CADERA_RODILLA.md`.

## Siguientes sprints
Ver `unreal/PLAN_SPRINTS.md`: resto del aparato locomotor, talleres de fisiología, examen práctico, empaquetado y
llevar las correcciones a la web en rama aparte.

## Decisiones del usuario (2026-11-22)
- Músculos agrupados (intercostales, interóseos, lumbricales, rotadores): **separarlos uno a uno**.
- Talleres de fisiología: **activar Niagara**.
- Oído interno y riñón de Z-Anatomy (no comercial): **sustituir por modelos con licencia libre**.
- Color del músculo: **rojo más natural, tipo disección** (granate algo apagado).
- Pendiente: quién hace la revisión profesional del contenido.
- Candidatos para sustituir las piezas no comerciales (buscado el 2026-11-22, falta descargar y comprobar):
  riñón de **BodyParts3D 4.0** (DBCLS, licencia actual **CC BY 4.0**, https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html);
  oído interno «Cochlea and vestibular system from MRI data» de NIH 3D (3DPX-002432, **CC BY**) o el laberinto de BodyParts3D.
  Los de Z-Anatomy son el «Anatomy of the Inner Ear» de Dundee (CC BY-NC-SA) y el «Kidney» de Lissie Cowley (CC BY-NC).
