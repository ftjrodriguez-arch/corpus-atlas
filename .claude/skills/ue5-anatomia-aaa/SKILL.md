---
name: ue5-anatomia-aaa
description: Usar en Corpus Atlas (edición Unreal) al crear o cambiar capas anatómicas, materiales por tejido, orígenes e inserciones, biomecánica articular, ejercicios de musculación, talleres de fisiología o el glosario y examen práctico.
---

# Corpus Atlas · anatomía, biomecánica y fisiología en Unreal

Lee antes `CLAUDE.md` (sección «Edición Unreal») y `unreal/LEEME.md`. Este skill dice **qué debe cumplir** cada pieza y
**dónde se toca**. La arquitectura es la que ya funciona: mallas Nanite sueltas, datos en JSON, movimiento calculado por
la web y deformado en la GPU. No introducir esqueletos, Control Rig, DataTables ni CommonUI sin acordarlo con el usuario.

## Dónde vive cada cosa
| Qué | Dónde |
|---|---|
| Catálogo, fichas, lecciones, glosario, casos | `data/*.json` (fuente de verdad, compartida con la web) |
| Mallas | `tools/unreal/exportar.js` → `unreal/CorpusAtlas/Importar/<cuerpo>/<capa>.glb` → `corpus_importar.py` |
| Color por vértice | R oclusión · G tendón o aponeurosis · B cartílago articular (`tools/unreal/tendones.js` corrige G) |
| Materiales | tabla `TEJIDOS` y `_maestro()` en `Content/Python/corpus_importar.py` (`M_CorpusTejido`, `M_CorpusTranslucido`) |
| Movimiento | `tools/unreal/movimiento.js` → `movimiento.json`; correctivos del hombro en `correctivos.js` |
| Estudio | `tools/unreal/recorridos.js` + `estudio.js` → `estudio_<idioma>.json` |
| C++ | `UCorpusDatos` (datos), `ACorpusCuerpo` (modelo), `ACorpusJugador`/`ACorpusCamara`, `SCorpusInterfaz` (Slate) |

## Materiales por tejido (objetivo y estado)
Todos salen de un maestro; cada capa es una instancia con sus valores en `TEJIDOS`. En el modelo Subsurface la
**opacidad es lo contrario de la dispersión** (opacidad = 1 − dispersión): invertirlo deja el hueso como cera plana.

- **Hueso.** Marfil con poro fino; cortical lisa frente a zonas rugosas de inserción (línea áspera, trocánteres,
  tuberosidad glútea, epicóndilos). *Falta:* máscara de rugosidad por accidente óseo y mapa activable rojo (origen) /
  azul (inserción) proyectando la capa `insercion` sobre el hueso. Los relieves están en `data/extras.json` (`lm`).
- **Cartílago hialino.** Canal B: blanco azulado, liso (rugosidad 0,08–0,16), brillo húmedo. *Falta:* capa de barniz.
- **Ligamentos y tendones.** Fibra fina nacarada con anisotropía alta. Todo músculo llega a su inserción en tendón
  (canal G). Distinguir **inserción tendinosa** de **origen carnoso ancho** (fosas de la escápula, ilíaco): el segundo no
  se pinta de blanco.
- **Fascias y membranas.** Translúcidas, con opacidad regulable por capa. *Falta:* borde tipo Fresnel y separar las
  fascias de envoltura de aponeurosis y retináculos para poder encender estos al inicio.
- **Músculo.** Estrías en dos escalas siguiendo la fibra real (tangente), dispersión bajo la superficie y estado de
  color por pieza (datos primitivos 0–3). Códigos: agonista naranja, actividad amarillo → magenta, débil turquesa.
  *Falta:* cuatro papeles a la vez (agonista, sinergista, antagonista, estabilizador) desde datos.
- **Vasos y nervios.** Arteria roja, vena azul, nervio amarillo. *Falta:* flujo direccional y pulso emisivo.
- **Plano de corte.** *Falta entero:* tres planos (sagital, coronal, axial) con una colección de parámetros leída por
  los dos maestros; el corte usa máscara de opacidad (Nanite la admite) y tapa de sección.
- De lejos el grano se apaga y sube la rugosidad (`lejos`): no quitarlo, evita el velo blanco a cuerpo entero.

## Biomecánica (lo que debe cumplir cualquier postura)
El eje y el rango salen de la tabla ROM de la web; aquí solo se corrige en `movimiento.js` y se documenta para llevarlo
a la web. Comprobar siempre en tira de movimiento (0, 25, 50, 75 y 100 % del rango).

| Articulación | Rango y regla |
|---|---|
| Hombro | Flexión y abducción 0–180°. Ritmo escapulohumeral 2:1 desde unos 30°; rotación externa del húmero por encima de 90° de abducción; la escápula no se despega de las costillas |
| Codo | Flexión 0–145° conservando el ángulo de carga (valgo 10–15° en extensión) |
| Antebrazo | Pronación y supinación 0–85/90° con el radio girando sobre el cúbito |
| Cadera | Flexión 0–120°, extensión 0–20°, abducción 0–45°, rotaciones 0–45°; centro en la cabeza femoral |
| Rodilla | Flexión 0–140°; rotación automática (screw-home) en los últimos 15° de extensión; sin abducción salvo en la prueba de estrés en valgo |
| Tobillo | Dorsiflexión 0–20°, flexión plantar 0–50° sobre el eje bimaleolar oblicuo; inversión y eversión en la subastragalina |
| Columna | Reparto por regiones (`REPARTO` en `movimiento.js`); los paravertebrales no se abomban en flexión |

Reglas de deformación: ningún músculo atraviesa hueso ni se despega del cuerpo; dorsal ancho y redondo mayor pegados al
tórax al elevar el brazo; pliegues contados con `tools/unreal/simular.js`; el hombro usa correctivos elásticos.
*Falta:* dedos de mano y pie, goniómetro en pantalla, curvas de entrada y salida suaves en la reproducción.

## Musculación
Cada ejercicio es una entrada de datos (tabla `CTESTS` de la web, `fx:1`): postura, anclaje de pies, músculos que
trabajan, técnica, errores y progresiones. En Unreal hoy se ve el texto y las estructuras. *Falta:* hornear la postura
de cada ejercicio como los rangos, fases concéntrica / excéntrica / isométrica, reclutamiento en vivo y flecha del
vector de tracción con su brazo de momento.

## Talleres de fisiología
Hoy: 84 recorridos narrados con las capas, piezas y cámara de la web, sin animación. Cada taller nuevo necesita
reproducir y pausar, línea de tiempo arrastrable, paso a paso, velocidad de 0,25× a 2× y al menos un parámetro
fisiológico manipulable. Orden propuesto: (1) nodo sinusal y conducción con ECG, (2) circulación mayor y menor con
saturación de O₂, (3) intercambio alvéolo-capilar, (4) nefrona, (5) sinapsis y placa motora. Los textos ya existen en
los recorridos `heart`, `resp`, `renal`, `syn` y `micro`. Las escenas microscópicas se modelan en Blender.

## Diccionario, glosario y examen
`data/glossary.json` (1.503 términos): `t`, `cat`, `def`, `etim`, `sin`, `rel`, `ej[{txt, s|lm|org}]` y traducciones.
`s` = nombre en inglés del catálogo, `lm` = relieve óseo. En Unreal, `estudio.js` los convierte al formato único del
panel. *Falta:* clic en una estructura → su entrada; relieves óseos (`lm`) resaltados sobre el hueso; examen práctico
de identificación en 3D con puntuación; glosario en francés y alemán.

## Antes de dar algo por hecho
1. El dato está en JSON, no en C++. 2. Compila. 3. Capturas con `ue5-visual-qa`. 4. Informe del agente
`director-clinico` sin errores abiertos. 5. `unreal/LEEME.md` actualizado con lo hecho y lo que falta.
