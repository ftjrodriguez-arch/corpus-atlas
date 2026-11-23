# Corpus Atlas · pendientes

Índice corto. El detalle está en `unreal/LEEME.md` (estado técnico de la edición Unreal), `unreal/PLAN_SPRINTS.md`
(sprints) y `unreal/AUDITORIA_CADERA_RODILLA.md` (hallazgos clínicos). Trabajo en `X:\corpus atlas`, rama
`ccr-2f1bf474-vuby5r`. La carpeta `C:\Users\Admin\Documents\Proyectos Claude\corpus-atlas` es una copia de `main`
(web v168) y no tiene la edición Unreal: Graphify se construye desde ella.

## Esquema de trabajo y orden (2026-11-23)
Cada bloque se cierra con: compilar · hornear lo que toque · capturas revisadas (frente, lado, detalle, tira de movimiento)
· informe del `director-clinico` · commit. Quién: **S** = esta sesión (compila, hornea, captura, integra), **A** = agente
`arquitecto-ue5` (código y generadores), **D** = agente `director-clinico` (rigor, solo lectura).

**Bloque 1 · Tejidos de la mano y el pie**
- [ ] Aponeurosis palmar más fisiológica (S, D). Especificación del director lista (triángulo central del palmar largo a las
      cabezas del 2.º–5.º metacarpiano, 4 bandas hasta el 30 % de la falange proximal, fascículos transversos, 3 aberturas
      comisurales, ligamento natatorio, sin lengüeta al pulgar, tenar e hipotenar finas). Probado recortar la malla de
      Z-Anatomy (`aponeurosis_palmar.js`): bordes dentados y ranura original → deshecho. **Hay que modelarla en Blender.**
- [ ] Aponeurosis plantar con el mismo criterio (S, D): falta captura desde abajo; especificación del director anotada
      (5 bandas, el dedo gordo sí tiene; banda lateral calcaneometatarsiana)
- [x] Reglas de tendones de mano, pie y antebrazo revisadas (D) y añadidas a `tendones_reglas.json` (20 patrones nuevos:
      lumbricales, interóseos, tenar, hipotenar, oponentes, aductor del pulgar, flexor corto de los dedos, cuadrado plantar,
      abductores del pie, pedio, flexor cubital y extensor cubital del carpo, pronador redondo, braquiorradial, radiales,
      flexor superficial, palmar largo, ancóneo). Pendiente de revisión profesional.
- [x] `tendones.js` funciona con los músculos separados (A); además arregló `separar.js`, que había desordenado el color por
      vértice (oclusión, tendón, cartílago) de las 140 piezas separadas del hombre y las 104 de la mujer.

**Bloque 2 · Músculos en movimiento**
- [x] Choques entre músculos en los correctivos (A, S): `correctivos_capas.json` (vecinos profundos del dorsal, pectoral y
      deltoides). Remo: celdas en que asoma un músculo profundo 170 → 16 (> 5 mm: 69 → 0). Capturas `hoja_v3.png`.
      El trapecio queda fuera (`_capas_pendientes`): con el empuje radial se plegaba (10 → 82 pliegues a 40° de elevación).
- [x] Revisión del director clínico aplicada: glúteo anclado también al ligamento sacrotuberoso (22 anclajes, libre junto a
      la tuberosidad isquiática); dorsal sin el redondo mayor como vecino profundo (junto al húmero la relación se invierte)
      y con los oblicuos; pectoral con recto y oblicuo externo; deltoides con cabeza larga del tríceps y redondo mayor.
      Primeros planos `hoja_cerca.png`.
- [ ] Contacto del trapecio con otra dirección de empuje (cuello y escápula), con el dorsal, el supraespinoso y la parte
      medial del infraespinoso como vecinos; pliegues del dorsal en el remo (348 → 374)
- [ ] Tendón bilaminar del pectoral mayor (porción clavicular por delante cerca de la inserción) y relación dorsal–redondo
      mayor junto al húmero (necesita reglas por zona en `correctivos_capas.json`)
- [ ] Glúteo a 120°: el director espera un contorno más ancho y aplanado, con el borde inferior subido (hoy redondeado);
      choque del glúteo con isquiotibiales, aductor mayor, piriforme, gemelos y vasto lateral (capas en la cadera)
- [x] Hueco bajo la clavícula al elevar la escápula 40° (A, S): la porción clavicular del pectoral no tenía área de
      inserción en el atlas; ahora va anclada a la clavícula (`extremos`). Captura `v_elev40.png`.
- [x] Glúteo mayor en flexión de cadera y sentadilla (A, S): correctivo elástico propio (`correctivos_cadera.js/.json`,
      C++ une los dos archivos). Volumen a 90° / 120° / fondo de sentadilla: 89 / 77 / 75 % → 104 / 102 / 103 %, 0 vértices
      dentro del hueso. Unreal carga 60 músculos en 37 movimientos. Capturas `hoja_v4.png`. Pendiente de revisión clínica.
- [x] `tendones.js` funcionando con los músculos separados (`--restaurar` / `--aplicar`, que ya incluye el dorsal) (A)

**Bloque 3 · Módulos de aprendizaje**
- [x] Revisión clínica de los textos de ejercicios en FR/DE (D): 32 correcciones aplicadas (Landmine, Trap-Bar, Hüft-TEP,
      lombo-radiculalgie…).
- [ ] El texto español de la web dice «restricciones de abducción tras artroplastia de cadera»: lo clásico es la aducción
      (vía posterior). Corregirlo en la web en rama aparte (con permiso) y luego sus traducciones.
- [x] Panel Estudiar revisado en capturas (S): la cámara se quedaba dentro del cuerpo en las entradas sin estructuras
      (kinesiología, lista del glosario); ahora vuelve al cuerpo entero (`hoja_estudiar2.png`).

**Bloque 4 · Grandes (siguientes sesiones)**
- [ ] Pruebas ortopédicas con postura y cuerpo acostado · dedos con movimiento · cinta y gráficas de la marcha
- [ ] Interóseos palmares y lumbricales del pie en Blender · post-procesos `musPost`, `latHug`, `kneePush` · piel del VH
- [ ] Sprint 3 (fisiología con Niagara) · Sprint 4 (examen 3D, ECOE, ASIA) · Sprint 5 (empaquetado, instalador)

**Con permiso del usuario:** instalar `graphify` (ruedas locales) · borrar `data/hoja_rotulos.png`, `X:\tmp\corr_ref.*`
y `Importar/antes_correctivos_cuadro0/` · descargar riñón (BodyParts3D) y oído interno (NIH 3D).

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
      Pendiente de revisión profesional. `tendones.js --aplicar` ya la vuelve a pintar (frontera en `tendones_reglas.json → laminas`).
- [x] Remo al 100 % (= 0 % del ciclo): el serrato y el redondo mayor atravesaban el dorsal ancho. Causa: `correctivos.js` trataba
      el cuadro 0 de cada ejercicio como reposo (una iteración y sin colisiones). Corregido y horneado de nuevo (todos los
      ejercicios); celdas atravesadas en el cuadro 0 del remo 451 → 30. Capturas `hoja_cuadro0.png`, `hoja_row0_cerca.png`.
- [ ] Queda un punto pequeño del redondo mayor junto a la axila en el remo (8–13 mm): los músculos no chocan entre sí (ver abajo).
- [x] `correctivos.js hornear-ejercicios` ya compacta el .bin (antes crecía en cada horneado); comprobado byte a byte.
- [ ] Graphify no se actualiza: falta el paquete `graphify` en Python 3.12 (instalarlo desde `_graphify\wheels` con permiso).
- [x] `tendones.js --restaurar` ya funciona con los músculos separados (2026-11-23).
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
