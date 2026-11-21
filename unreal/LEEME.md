# Corpus Atlas · edición Unreal Engine

Versión de escritorio de alta calidad gráfica. La web (`index.html`) sigue siendo la versión gratuita, ligera y sin conexión;
esta carpeta no se usa en la web.

**Estado (2026-11-20): Fase 1 compilada, importada y probada en el PC con Unreal Engine 5.8**, con capturas en
`unreal/capturas/`. Detalle y pendientes más abajo.

## Pasos en el PC (Windows, Unreal Engine 5.x, Node.js)

1. En la raíz del repositorio: `node tools/unreal/exportar.js`
   Crea `unreal/CorpusAtlas/Importar/` (43 GLB, 5.150 piezas, 12,3 M de triángulos, ~380 MB; no se sube al repositorio).
   Después, con `python -m http.server 8765` en otra consola: `node tools/unreal/movimiento.js` (pesos y posturas del
   movimiento, calculados por la web; necesita Playwright).
2. Clic derecho en `unreal/CorpusAtlas/CorpusAtlas.uproject` → *Generate Visual Studio project files*, y abrirlo (compila el módulo).
   Si tu versión no es la 5.8, cambia `EngineAssociation` en el `.uproject`.
3. En el editor, consola de Python:
   ```python
   import corpus_importar as ci
   ci.todo()
   ```
   Copia los datos a `Content/Datos`, crea los materiales, importa las mallas con Nanite y crea el mapa `Atlas`.
4. Pulsar *Jugar*.

## Qué hay en esta fase

| Parte | Archivo | Qué hace |
|---|---|---|
| Exportador | `tools/unreal/exportar.js` | Mismos modelos que la web con la mejor geometría de cada pieza (corazón HRA > alta resolución > capa ligera), costuras corregidas, piezas de Blender, cuerpo de mujer y Visible Human. Añade normales suaves y la dirección de fibra como tangente. |
| Datos | `CorpusDatos` | Catálogo, 30 capas (tabla `SYS`), fichas, buscador sin tildes y los 5 idiomas, leyendo los mismos JSON que la web. |
| Cuerpo | `CorpusCuerpo` | Una malla Nanite por estructura con el color propio de cada órgano (mismas tablas que la web); capas, opacidad, hombre / mujer / Visible Human, seleccionar, ocultar, aislar, color de estado por pieza. |
| Cámara y control | `CorpusJugador` | Órbita, desplazamiento, rueda, clic para seleccionar, doble clic o F para encuadrar, H ocultar, I aislar, 1–6 vistas. |
| Interfaz | `CorpusInterfaz` | Panel de capas, cuerpo e idioma; buscador; ficha de la estructura. |
| Gráficos | `Content/Python/corpus_importar.py` | Materiales por tejido y estudio de luz (Lumen, sombras virtuales, trazado de rayos). |

### Mejora gráfica de músculos, huesos y ligamentos
El material `M_CorpusTejido` usa lo que cada vértice ya lleva (oclusión, tendón, cartílago y dirección de fibra):
- **Músculo:** estrías en relieve a dos escalas (fascículos y fibras) que siguen la fibra real, brillo húmedo alargado
  (anisotropía), dispersión de la luz bajo la superficie y transición al tendón nacarado.
- **Hueso:** marfil con poro fino, cartílago articular liso y azulado, sombreado de relieves con la oclusión.
- **Ligamento y fascia:** fibra fina y brillante con anisotropía alta.
Los valores de cada tejido están en la tabla `TEJIDOS` del script; se afinan mirando el resultado en el PC.

## Fase 1 comprobada en el PC (2026-11-20, Unreal Engine 5.8, RTX 3080 Ti)
Exportación (43 GLB, 5.150 piezas), compilación de `CorpusAtlasEditor`, importación completa y juego en marcha,
con capturas en `unreal/capturas/` (anterior, posterior, lateral, esqueleto, piel translúcida, selección y ficha,
buscador, inglés, alemán, mujer y Visible Human). Comprobado: orientación (de pie, mirando a la cámara), color propio
de cada órgano, luces del estudio, capas, selección, ficha, buscador sin tildes, cuerpos e idiomas.

Lo que hubo que corregir del código escrito a ciegas:
- **Interchange (UE 5.x)** deja cada malla en `<sistema>/<archivo>/StaticMeshes/<id>`: `_aplanar()` las mueve a `<sistema>/<id>`, donde las busca el C++.
- `StaticMeshEditorSubsystem` no existe en modo comando: Nanite se aplica con `ajustar_mallas()` desde el editor completo (`todo()` ya lo llama).
- Luz direccional: la propiedad es `light_source_angle`. En el material, el alfa de un `VectorParameter` se toma de su salida «A» (la máscara sobre la salida RGB no compila), y la entrada del ruido y de `OneMinus` no tiene nombre (`""`).
- Exposición: con la cámara física (EV ≈ 10), +10,5 dejaba la imagen blanca; ahora `EXPOSICION = 2.0`. Bloom 0,08. Parámetro `Albedo` por tejido (`ALBEDO`: hueso 0,30) porque el tinte casi blanco del hueso saturaba.
- Encuadre: `FieldOfView` es horizontal; en pantallas apaisadas manda el vertical (cortaba la cabeza).
- Nanite no dibuja materiales translúcidos: las capas con opacidad < 1 usan la malla clásica (`bDisallowNanite`). El translúcido usa luz volumétrica y un velo emisivo de su color (con luz «por píxel» salía negro).
- Mayúsculas de la interfaz con `FText::ToUpper` (`FString::ToUpper` dejaba «CIRCULACIóN»). La barra hombre / mujer / Visible Human se rehace al cambiar de cuerpo.

## Pruebas automáticas y capturas (equivalente a `?qa` de la web)
`ACorpusJugador` acepta `-QaPasos="…"`: espera a que terminen los shaders (sin cocinar se compilan al vuelo y, mientras,
todo sale gris), ejecuta los pasos y cierra. Desde PowerShell:
```
.\unreal\captura.ps1 -Pasos "esperar 8; foto inicio; sel n1394; encuadrar; foto ficha; buscar biceps; foto buscador"
.\unreal\captura.ps1 -Exposicion 2.0 -Pasos "foto expo"
.\unreal\captura.ps1 -Py "ci.ajustar_luces(sol=200, relleno=2000)" -Pasos "foto luces"
```
Pasos: `foto <nombre>` · `sel <id>` (vacío = ninguna) · `encuadrar` · `aislar` · `ocultar` · `todo` · `vista <0-5>` ·
`capa <clave> <0|1>` · `opacidad <clave> <valor>` · `cuerpo <hombre|mujer|vh>` · `idioma <es|en|pt|fr|de>` ·
`buscar <texto>` · `esperar <s>` · cualquier otro texto se ejecuta como comando de consola (p. ej. `viewmode unlit`).
Las fotos quedan en `unreal/capturas/` con la interfaz incluida.

### Pendientes de la Fase 1 resueltos (2026-11-20)
- **Piel del Visible Human:** el GLB `vh/f_piel` tiene una sola malla e Interchange la llamaba como el archivo (`f_piel`) en vez de
  con su id (`f0`), así que el C++ no la encontraba. `_aplanar(destino, ids)` renombra la malla que no coincide con ningún id de la capa.
- **Traducciones:** el lector JSON de Unreal no distingue mayúsculas en las claves; en `i18n_de.json` hay `"urinario": "digestivo"`,
  por eso «Urinario» salía como «digestivo», y «Hombre»/«hombre» se fundían. `T()` busca ahora como `trW()` de la web, con claves exactas
  (`FTablaTr`): interfaz → nombres (fr/de) → tabla propia `TR_PROPIA` (capas de vísceras, vistas, subtítulo, buscador, campos de la ficha)
  → interfaz sin distinguir mayúsculas → inglés.
- **Hueso quemado:** con el sol a 6 lux solo iluminaban las dos rectangulares (9000 / 14000), planas y fortísimas. Tabla `LUCES`
  (sol 200 lux como luz principal, relleno 2000, contraluz 6000, cielo 1,0) y `ajustar_luces()` para cambiarlas sin rehacer el mapa.
- **Muaré:** a cuerpo entero había más de un ciclo de estría por píxel. Cada escala se apaga con `|ddx|+|ddy|` de la fase
  entre 0,25 y 0,5 ciclos por píxel.
- **Buscador:** los orígenes e inserciones (mismo nombre que el músculo) van al final de la lista.
- `captura.ps1 -Py "ci.ajustar_luces(sol=…)"` ejecuta Python sobre el mapa antes de jugar.

## Pendiente de la Fase 1
- Probar con el ratón real (clic, doble clic, arrastrar) y los atajos H, I, F, 1–6: las capturas usan las mismas funciones, pero no el ratón.
- Resuelto (2026-11-20): las piezas pequeñas se encuadran con 5 cm de radio mínimo (`f2_ojo`) y al cambiar de cuerpo la cámara reencuadra (`f2_mujer`, `f2_vh`). Pasos de prueba nuevos: `enfocar id1,id2` y `acercar <factor>`.
- La piel del Visible Human opaca sale algo anaranjada; afinar su tinte si hace falta.

## Fase 2 · Movimiento: rangos articulares (2026-11-20)
El movimiento no se ha vuelto a programar: lo calcula la propia web y Unreal solo lo dibuja.
1. `node tools/unreal/movimiento.js` (con `python -m http.server 8765` en marcha y Playwright) abre la web sin ventana con `?qa`:
   - **Pesos:** `weightsFor()` de la web para cada vértice de las 5.066 mallas del hombre y la mujer (5,6 M de vértices) y
     27 articulaciones (sin los dedos). Cada pieza usa hasta 8 «huecos» en el orden de `deform()`; la articulación de cada
     hueco va en `movimiento.json → piezas` (± a + 32·b + 1024·c: hasta 3 articulaciones seguidas con el mismo peso;
     negativo = interpolación lineal, `u.lin` de la web) y Unreal la pone en los datos primitivos 12–19. Por vértice solo
     van los 8 pesos, en `TEXCOORD_0…3`. **No mezclar índice y peso en un UV:** Nanite y la malla de reserva promedian los
     UV al simplificar, y «16,98» promediado con «0» da otra articulación (salían astillas en los músculos del hombro).
     Solo el nervio cubital (hombre y mujer) necesita 10 y pierde las 2 de menos peso.
   - **Posturas:** `applyPose()` de la web con `deform()` interceptado, cada 5°, lado derecho e izquierdo, para los
     14 rangos de la tabla ROM (hombro, escápula, codo, antebrazo, muñeca, cadera, rodilla, tobillo, cervical, ATM,
     cervical alta, tronco, torácica, lumbar). Así salen ya el ritmo escapulohumeral (ISB), la escápula sobre las costillas,
     el deslizamiento de la rodilla (`kneeTr`) y el tobillo separado en talocrural y subastragalina (`ankleSplit`).
     Salida: `Importar/datos/movimiento.json` (eje, ángulo, pivote y traslación en glTF).
2. `M_CorpusTejido` y `M_CorpusTranslucido`: nodo *Custom* «Postura» en el World Position Offset que repite el bucle de
   `deform()` (comprobado en Node contra la web: mismos desplazamientos máximos en dorsal, pectoral, iliocostal e
   intercostales) leyendo la postura de una textura de 32×4 (fila 0 eje + ángulo, 1 pivote, 2 traslación). El giro total del
   vértice pasa al píxel (*VertexInterpolator*) y gira la normal (local → glTF → local), así la luz cae bien sobre el brazo
   levantado. Las estrías usan la posición de reposo (`LocalPosition` sin desplazamientos). UV a precisión completa.
3. `ACorpusCuerpo::PonerRango()` interpola entre los fotogramas (slerp), sube la textura, agranda los límites de las piezas
   (`BoundsScale`, para que Nanite y las sombras no recorten la pieza movida; `Caja()` lo descuenta) y pinta los agonistas de
   naranja (`#f0a040`, como el estado «ag» de la web). Reproducir: ida y vuelta a 45°/s.
4. Interfaz: botón «Movimiento» → panel inferior con articulación, movimiento, lado, deslizador de grados, reproducir y reposo.
   Pruebas: paso `rom <id> <nº de movimiento> <R|L> <grados>` (`rom` solo = reposo).

Capturas: `unreal/capturas/mov_00…10` (hombro, codo, cadera, rodilla, tronco, cuello, solo esqueleto y mujer).
Color del músculo: parámetro `Desaturar` (tabla `DESATURAR`, músculo 0,30) y menos dispersión roja; antes salía rojo puro.
Reimportar las mallas (`importar_mallas`) tarda 1 h 45 min; `_aplanar` sustituye la malla anterior por la recién importada.

### Mejoras sobre la web (2026-11-20, a petición del usuario: «anatómicamente el cuerpo no es así»)
- **Columna toracolumbar repartida:** en la web todo el giro de «tronco» ocurre en L3 y la zona lumbar hace joroba.
  `movimiento.js` lo reparte entre S1 (`lumb`), L3 (`trunk`) y T12 (`thor`) con la tabla `REPARTO` (flexión 42/26/32 %,
  extensión 45/25/30, inclinación 30/28/42, rotación 8/17/75).
- **Dorsal ancho, pectoral mayor y redondo mayor:** los pesos de la web dejan que medio vientre muscular gire con el brazo
  (y van a escalones; la web lo arregla relajando la malla en la CPU). Aquí solo la zona del tendón sigue al húmero: peso
  suave por distancia al punto de inserción (tabla `TD` de `movimiento.js`); el vientre queda sobre el tórax y se estira.
- **Pegados a la parrilla costal** (`abrazo` en `movimiento.json`, dato primitivo 20): fila 3 de la textura de postura =
  contorno del tórax cada 1,25 cm (centro z, radio x, radio z). Antes de girar el tronco, el material devuelve cada punto a
  su distancia de reposo al contorno, con holgura creciente hacia el húmero (misma regla que `latHug`, sin corte brusco).
- **Músculos elásticos anclados a sus huesos** (tabla `HARM`: trapecio, romboides, elevador, serrato, pectoral menor,
  subclavio, deltoides y manguito). En la web el trapecio y los romboides no acompañaban a la escápula y lo de debajo los
  atravesaba. Cada vértice a menos de 12 mm de un hueso queda anclado a él y entre los anclajes el peso es armónico
  (Laplace sobre la malla): el estiramiento se reparte de forma continua por toda la fibra.
- **La escápula resbala pegada a las costillas:** con las posturas de la web el ángulo inferior se despegaba (hacían
  falta hasta 20° para devolverlo). `movimiento.js` añade a la acromioclavicular la báscula mínima que lo deja a su
  distancia de reposo del contorno del tórax y recalcula la glenohumeral (188 posturas). El dorsal ancho (dato primitivo
  20 = 2) pasa además por fuera del ángulo inferior en cada postura.
- **Bucle de la abducción (tercera pasada):**
  - `tools/unreal/simular.js` repite en la CPU la cuenta del material sobre una pieza y cuenta los pliegues (aristas que
    se cierran), la separación del tórax y si el dorsal cubre el ángulo inferior de la escápula. Sirve para afinar sin
    esperar a Unreal. **Si se cambia `HLSL_POSTURA`, hay que cambiar `simular.js` igual.**
  - `tools/unreal/torax.js`: contorno real de las costillas (radio por altura y sector angular, filas 4… de la textura
    de postura, ahora de 32×36). La elipse por altura engañaba: la caja torácica es más cuadrada por detrás. Con la
    medida buena la báscula añadida a la escápula llega a 25° (204 posturas) y su ángulo inferior queda a k ≈ 1,07.
  - **Fibra tensa** (dorsal ancho y pectoral mayor; inserción en los datos primitivos 21–23, `movimiento.json →
    insercion`): el vientre no gira con el húmero, se desplaza y se estira hacia donde va la inserción; solo el tendón
    gira (peso²). Con giro, el dorsal a 150° tenía 580 pliegues; con fibra tensa y fracción de fibra, 152.
  - **Fracción de fibra:** el peso de esos músculos es armónico entre la inserción (1) y el origen (0: línea media y
    cresta ilíaca en el dorsal, borde esternal en el pectoral, clavícula o escápula donde nacen de ellas). Con el peso
    «por distancia a la inserción» el origen del dorsal se iba detrás del brazo.
  - Pegado al tórax con límite suave (`tanh`) y límite inferior que conserva el grosor del músculo.
  - Paso de pruebas `solo id1,id2…` (`ACorpusCuerpo::VerSolo`) para ver un grupo de piezas.
  - El editor a veces se queda colgado al cerrarse tras `-ExecutePythonScript`: esperar a `CORPUS_RUN_OK` en el registro
    y cerrar el proceso.
- **Blender como visor y banco de pruebas (cuarta pasada):** `tools/unreal/postura.js` es la cuenta del material como
  módulo; `tools/unreal/blender/posar.js <ids> <rom> <mov> <lado> <grados>` deja huesos y músculos ya colocados y
  `blender -b --python tools/unreal/blender/simular_musculo.py -- <carpeta> sinsim` los dibuja en 1 s (frente a 6 min de
  una captura de Unreal). Blender 5.2 está en `X:\software\Blender 5.2`.
  - Sin `sinsim` simula el músculo como tela con colisión: **no sirve tal cual** (14 min por postura y el dorsal se hace
    jirones, porque en reposo ya roza los músculos profundos). Haría falta una escena preparada (solo huesos, malla
    limpia); queda como vía abierta junto con Chaos Flesh + ML Deformer (instalados, pero sin Nanite) y el modelo
    OpenSim de Seth 2019 (CC BY 4.0, simtk.org/projects/thoracoscapular) como guía de trayectorias.
  - Lo que sí destapó: **la malla de cada músculo son varios fascículos sueltos (islas)**. Una isla sin anclaje de origen
    giraba entera con el húmero (el «tendón suelto» del dorsal a 150°). `movimiento.js` fija ahora, isla por isla, el
    extremo que le falte.
  - **Cintura escapular con el brazo colgando:** en la web, al elevar la escápula 40° el brazo se abría 40°; ahora la
    glenohumeral compensa (32 posturas).
  - Pendiente visto en el visor: deltoides algo retorcido al encoger el hombro, bíceps cruzado en la rotación externa
    a 90°, solapa en el borde del dorsal en la extensión a 60°.
- Referencias del ritmo escapulohumeral: Braman et al. 2009 (0,43° de rotación superior por grado de elevación, relación
  2,3:1) y Ludewig et al. 2009 (báscula posterior ≈ 19°, rotación posterior de la clavícula ≈ 31°); la tabla `ST_UR` de la
  web ya los sigue en los huesos.
- `node tools/unreal/movimiento.js --sin-pesos` rehace solo las posturas; `--solo=muscular` rehace los pesos de una capa
  (luego `ci.importar_mallas(["hombre/muscular", "mujer/muscular"])`, unos 12 minutos).
- Pendiente de este repaso: pliegues finos en la axila (deltoides, bíceps, tríceps largo y manguito se cruzan), el brazo
  levantado de la mujer sale pálido, y revisar de cerca los demás rangos (rotaciones del hombro, escápula, cadera).

Queda fuera de este paso (la web lo hace después de deformar, en la CPU): `musPost` (músculos del hombro que no atraviesan la
cabeza humeral ni el tórax), `latHug`, `kneePush`, la deformación por fibras del pectoral y el dorsal, y los dedos de la mano
y del pie (no caben en 8 pares sin otro grupo como `ax`). El clic del ratón usa la colisión de reposo.

## Fase 2 · Correctivos elásticos del hombro (2026-11-20)
El reparto de pesos no daba para todos los movimientos (dorsal rasgado al encoger el hombro, pectoral retorcido en la
rotación externa). Ahora 25 músculos por lado (trapecio, romboides, elevador, serrato, dorsal, pectorales, subclavio,
deltoides, manguito, redondos, bíceps, coracobraquial y cabeza larga del tríceps) se resuelven fuera como cuerpos elásticos
y Unreal solo reproduce el resultado. Solo en los rangos `hombro` y `escapula`; en la marcha y el tronco siguen los pesos.
- `tools/unreal/correctivos.js`:
  - **Rejilla** de nodos de 15 mm alrededor de cada músculo; el vértice se mueve con los 8 nodos de su celda (trilineal
    sobre la posición de reposo). Es continuo por construcción (los fascículos sueltos no se separan) y Nanite no lo estropea.
  - **Anclajes reales:** los vértices que tocan las áreas de origen e inserción de la capa `insercion` siguen rígidamente
    al hueso sobre el que está dibujada el área. Extremos sin área en el atlas: tabla `EXTRA` (redondo mayor,
    coracobraquial, bíceps corto), tendón del dorsal y del pectoral (`insercion` de movimiento.json), línea media y cresta
    ilíaca. El dorsal no va cosido al ángulo inferior de la escápula: resbala sobre él.
  - **Elasticidad:** ARAP por celdas con la fibra libre (tangente de la malla): a lo largo de la fibra el músculo se alarga
    o se acorta casi sin oponerse y engorda o adelgaza para conservar el volumen (`BETA`).
  - **Sin atravesar huesos:** contorno de la parrilla costal y distancia con signo a húmero, escápula y clavícula.
  - **Brazo:** bíceps, tríceps largo y coracobraquial van sujetos al húmero de lado pero deslizan a lo largo de él.
  - Órdenes: `anclas` (qué hueso sujeta cada músculo), `prueba`, `medir` (pliegues, vértices dentro de hueso y
    estiramiento, material frente a correctivo, en 14 posturas) y `hornear`.
  - Medido en el lado derecho: pliegues 22.214 → 5.231; vértices dentro de hueso 32.206 → 19.968 (los que quedan son
    de zonas ancladas a un hueso que a su vez entra en el contorno del tórax).
- `node tools/unreal/correctivos.js hornear` (90 s) escribe `Importar/datos/correctivos.json` + `correctivos.bin` (88 MB,
  no se sube): por movimiento, lado y cuadro (cada 5°), desplazamiento y giro de cada nodo en enteros de 16 bits.
  La mujer solo trae sus piezas propias (dorsal y cabezas largas); el resto son las del hombre.
- Unreal: `UCorpusDatos::CargarCorrectivos`, `ACorpusCuerpo::PonerCorrectivo` (interpola los dos cuadros vecinos y sube la
  textura `Correctivo`: mitad superior desplazamientos, inferior giros; texel 0 = activo) y, en `HLSL_POSTURA`, el bloque
  «Correctivo elástico» (datos primitivos 24–31: base, nodos por eje, esquina y celda). Con la rejilla activa no se
  ejecuta el bucle de pesos. Tras cambiar el HLSL: `.\unreal\py.ps1 "ci.copiar_datos(); ci.crear_materiales()"`.
- Visor: `.\unreal\hojas_hombro.ps1 -Corr` (14 posturas en Blender, 75 s) y sin `-Corr` para comparar con el material.
  Capturas de Unreal: `unreal/capturas/cz_*`.
- Pendiente: capas entre músculos (el pectoral mayor no «sabe» que debajo está el menor), hueco bajo la clavícula al
  elevar 40°, pliegue del dorsal junto al ángulo inferior de la escápula en abducción de 150°, y llevar lo mismo a la cadera.

## Fase 2 · Marcha de laboratorio (2026-11-20)
- `movimiento.js` hornea la marcha de la web cada 2 % del ciclo para sus 8 patrones (normal, Trendelenburg, steppage,
  antiálgica, hemiparética, en tijera, parkinsoniana y rodilla rígida): llama a `applyPose()` con la marcha puesta, así salen
  los ángulos de laboratorio (Fukuchi 2018, Schreiber 2019, Lencioni 2019), la pelvis, el centro de masas, el braceo y la raíz
  del cuerpo después de `gaitFloor()` (pie apoyado en el suelo). También guarda las 8 fases con su texto, los 11 grupos
  musculares con su curva de intensidad y la explicación de cada patrón (`movimiento.json → marcha`).
- `ACorpusCuerpo::PonerMarcha(patrón, % del ciclo)` interpola los instantes, mueve el actor con la raíz (glTF → Unreal:
  posición (x, z, y)·100 y cuaternión (−x, −z, −y, w)) y pinta la actividad muscular de amarillo a magenta; músculos débiles del
  patrón en turquesa y espásticos en naranja. Un ciclo dura 1,1 s (4,4 s a cámara lenta).
- Interfaz: el panel de movimiento tiene dos modos, «Rango articular» y «Marcha» (patrones, fase y su explicación,
  deslizador del ciclo, reproducir, cámara lenta). El panel va abajo a la derecha para no tapar las piernas.
  Pruebas: `marcha <id del patrón> <% del ciclo>` (`marcha` solo = salir). Capturas `unreal/capturas/marcha_*` y
  `mosaico_marcha.png`.
- Leyenda de la marcha: los 11 grupos con su barra de intensidad en ese instante y el tipo de contracción (excéntrica,
  concéntrica, isométrica) del miembro derecho (`f2_marcha10`, `f2_marcha60`).
- Falta respecto a la web: la extensión de los dedos del pie en el despegue (los dedos aún no están en el rig), la cinta del
  suelo y las gráficas de ángulos y fuerzas.

### Cadera (misma pasada)
- Glúteos y pelvitrocantéreos (`HARMC` en `movimiento.js`) anclados a pelvis (0) y fémur (1), girando en arco: en la web
  estaban fijos a la pelvis y en la flexión de cadera el glúteo mayor quedaba como una bola. Se probó el glúteo mayor como
  fibra tensa y se descartó (atraviesa la pelvis).
- `blender/posar.js` admite `re:<expresión>` para ver un grupo de músculos por nombre; `unreal/hoja.ps1` junta muchas
  imágenes en una hoja de contactos (12 posturas de hombro, 12 de pierna revisadas así).
- Fuentes y lista inicial del futuro módulo de patologías: `unreal/PATOLOGIAS_FUENTES.md`.

## Fase 2 · Estudiar: lecciones, recorridos, kinesiología, casos, patologías y glosario (2026-11-20)
Botón **Estudiar** (barra izquierda): panel a la derecha con nueve módulos, los cinco idiomas y la misma forma para todos
(módulo → grupo → entrada → ficha con pasos, imagen, secciones y preguntas que se corrigen al contestar).

| Módulo | Entradas | De dónde sale |
|---|---|---|
| Lecciones | 83 | `data/lessons*.json` (pasos que aíslan las estructuras y 5 preguntas) |
| Recorridos | 84 (369 pasos) | tabla `TOURS` de la web, incluido «Sinapsis e impulso nervioso» |
| Kinesiología y biomecánica | 463 | `data/bio.json` |
| Pruebas y ejercicios | 92 | tabla `CTESTS` de la web (texto y estructuras; sin la postura) |
| Casos clínicos | 90 | `data/cases*.json` y `data/rc.json` |
| Protocolos | 8 | `data/protocols.json` |
| Variantes anatómicas | 32 | `data/variants.json` |
| Patologías | 172 en 10 sistemas | glosario (enfermedades y lesiones) + ilustraciones de Commons |
| Glosario | 1.503 | `data/glossary.json` (FR/DE en inglés: no está traducido) |

- `tools/unreal/recorridos.js` abre la web sin ventana y, por cada paso de cada recorrido, anota lo que la web enseña:
  capas y opacidad, piezas aisladas (`isoSet`), ocultas, cuerpo y órbita de la cámara → `recorridos_web.json`; también saca
  `CTESTS` y `BIO_R` a `tablas_web.json`. Unreal reproduce eso (`ACorpusCuerpo::PonerVista`, `ACorpusCamara::OrbitaWeb`).
  Solo se repite si cambian los recorridos de la web (con `python -m http.server 8765` y Playwright en `NODE_PATH`).
- `tools/unreal/estudio.js` genera `estudio_<idioma>.json`, `estudio_vistas.json` y `estudio_img/` en `Importar/datos` y
  en `Content/Datos` (no hace falta el editor). FR/DE usan `content_fr/de.json` como la web; si falta, inglés.
- **Patologías:** sistemas en la tabla `SIS` de `estudio.js` (encéfalo y médula, nervios periféricos, músculos-tendones-ligamentos,
  huesos y articulaciones, corazón, vasos, pulmón y pleura, digestivo, riñón-urinario-reproductor, sentidos-endocrino).
  `tools/unreal/patologias_img.js` baja de Wikimedia Commons solo archivos con licencia CC BY, CC BY-SA, CC0 o dominio
  público (la pregunta a la API archivo por archivo) y guarda la atribución en `unreal/patologias/atribuciones.json`;
  `patologias_jpg.ps1` las pasa a JPG. Hay 24 ilustraciones (rótulos en inglés); el resto de patologías resalta las
  estructuras en el modelo. Aviso fijo: contenido educativo. Con Node 26 hace falta `--dns-result-order=ipv4first`.
- C++: `UCorpusDatos::Estudio()`, `TE()`, `VistaDePaso()`; `ACorpusCuerpo::IdsDeNombres`, `Ensenar`, `PonerVista`,
  `GuardarEstado` / `RestaurarEstado` (al cerrar el panel vuelven capas, opacidades, cuerpo y cámara); panel en
  `SCorpusInterfaz::RehacerEstudio`. Pruebas: `estudio <módulo> [grupo] [entrada] [paso]`, `estudio <módulo> buscar <texto>`,
  `estudio responder <pregunta> <opción>`, `estudio bajar <px>`, `estudio` (cerrar). Capturas `est_*`, `fin_*` y `mosaico_estudio.png`.
- **No está:** los recorridos no tienen las animaciones de la web (latido, partículas, respiración, gráficos, etiquetas);
  las pruebas y ejercicios no colocan la postura; sin vídeo; kinesiología sin los movimientos `mv`; sin repaso espaciado
  ni progreso guardado; contenido clínico pendiente de revisión profesional.

### Material: hueso plano, músculo lavado y capas de inicio (misma pasada, a petición del usuario)
- El parámetro «Dispersion» iba directo a la opacidad del modelo Subsurface, que significa lo contrario: con 0,10 el hueso
  era casi cera translúcida y de frente quedaba como una silueta blanca sin relieve; el músculo se lavaba a rosa. Ahora
  opacidad = 1 − dispersión. Hueso `Albedo` 0,40; músculo rug 0,50, esp 0,35, dispersión 0,30 (`8a3026`), `DESATURAR` 0,24.
- El grano fino se apaga cuando mide menos de un píxel y, de lejos, sube la rugosidad y baja la anisotropía (`lejos`).
- Arrancan encendidos «Ligamentos, cápsulas y discos» y «Bolsas sinoviales y vainas» (en la web van apagados). Las fascias
  siguen apagadas: las de envoltura tapan los músculos. Todas las piezas de la web están importadas salvo 10 del corazón.
- **Pendiente:** separar aponeurosis y retináculos de las fascias de envoltura para poder encenderlos al inicio.

### Tendones en los extremos de cada músculo (2026-11-20, a petición del usuario)
«Todos los músculos terminan en tendones, no en el mismo músculo.» El canal G del color por vértice (tendón) viene de la
web y estaba casi vacío: de 582 piezas musculares, 305 sin nada de tendón, y de las 267 con área de inserción localizada
solo 33 llegaban a ella en tendón.
- `tools/unreal/tendones.js [hombre|mujer]` mide; con `--aplicar` corrige el propio `muscular.glb` (solo sube G, no toca
  los pesos de movimiento): junto a las áreas de origen e inserción de la capa `insercion` (mismo nombre y lado) el
  músculo pasa a tendón y se funde con el vientre (5 % de la longitud de la pieza, entre 3 y 20 mm; fundido hasta 2,2×).
  Las piezas sin área (218 en el hombre) usan sus dos extremos si son alargadas; esfínteres, orbiculares y constrictores
  se dejan como están. Resultado: 253 de 267 llegan en tendón. Informe en `unreal/tendones_informe.json`.
- Orden: `exportar.js` → `movimiento.js` → `tendones.js --aplicar` (hombre y mujer) → reimportar la capa muscular
  (`.\unreal\py.ps1 'ci.importar_mallas(["hombre/muscular", "mujer/muscular"])'`, unos 12 min).
- Es una regla geométrica, no una disección: la longitud real de cada tendón (largo en el antebrazo, corto en el glúteo)
  no está modelada, y en las piezas sin área de inserción el extremo se decide por la forma. Pendiente de revisión anatómica.
- **Defecto conocido** (mosaico_tendones.png): los orígenes anchos y carnosos (infraespinoso y supraespinoso en sus fosas,
  deltoides, glúteos) quedan demasiado blancos, porque toda el área de origen se trata como tendón. Hay que distinguir
  inserción tendinosa de origen carnoso (por ejemplo, bajar la intensidad cuando el área cubre gran parte de la pieza).
  --aplicar solo sube G y no guarda el valor original: para rehacerlo hay que volver a exportar la capa muscular
  (exportar.js + movimiento.js) o guardar antes una copia del canal.
- **Recuento** (2026-11-20): la capa ósea tiene los 206 huesos (208 piezas: el esternón va en tres) más 31 cartílagos y 28
  dientes (faltan las muelas del juicio). La capa muscular tiene 582 piezas: unas 54 son tendones, aponeurosis y
  retináculos; quedan unos 234 músculos con nombre por lado, y varios múltiples van en una sola malla (intercostales,
  interóseos, lumbricales, rotadores, elevadores de las costillas). Estimación, no cotejo con la Terminologia Anatomica.
  No encontrados: condrogloso, intertransversos torácicos y mediales lumbares, cricofaríngeo, compresor de la uretra.
## Sprint 1 · corte vertical (2026-11-21)
Capturas finales: `unreal/capturas/s1_*` (una hoja de contactos por punto: `s1_<punto>_hoja.png`).

### A · Plano de corte en vivo
- `corpus_importar.py`: colección de parámetros `MPC_Corte` (`_coleccion_corte`: «Activo» y «Plano» = normal del mundo en
  xyz y posición en w, en cm) leída por los dos maestros (`_corte`). El opaco pasa a **enmascarado** (máscara de opacidad;
  Nanite lo admite y el modelo Subsurface sigue igual) y el translúcido multiplica su opacidad. La posición es la del mundo
  ya con la postura (World Position Offset incluido): el corte atraviesa el cuerpo tal como se ve, también en movimiento.
  **Tapa de la sección:** con el corte activo, las caras de dentro se pintan lisas con el color del tejido (`TAPA_CORTE`).
  La colección se crea una sola vez (sus identificadores quedan grabados en los materiales): no borrarla sin rehacerlos.
- `ACorpusCuerpo::PonerCorte(eje, posición 0–1)`, `InvertirCorte`, `QuitarCorte`, `Cortado(punto)`. La posición recorre la
  caja de lo que se ve en ese eje (X sagital, Y coronal, Z axial). El clic del ratón atraviesa la mitad quitada
  (`ACorpusJugador::PlayerTick` repite el rayo hasta dar con algo que se ve).
- Interfaz: «Plano de corte» en el panel izquierdo (Sagital, Coronal, Axial; otra vez sobre el activo lo apaga; deslizador
  de posición, Invertir y Quitar corte). Delegado nuevo `AlCambiarHerramientas`.
- Pruebas: `corte <sagital|coronal|axial> <0–1>` · `corte invertir` · `corte off`. Capturas `s1_a_*` (sagital, coronal,
  axial, con el hombro en abducción de 100°, invertido en inglés y apagado).
- Falta: tapa de sección de verdad (la de ahora es el interior de cada pieza pintado liso: las piezas huecas o abiertas,
  como las fascias, no quedan macizas), plano oblicuo y arrastrar el plano con el ratón sobre el modelo.

### B · Panel plegable, fantasma y pelar capas
- **Panel izquierdo plegable:** botón ««» junto al título; plegado queda solo el botón «» Capas» (`bPanelPlegado`).
- **Fantasma** (`ACorpusCuerpo::Fantasma`): las capas a la vista pasan a opacidad 0,25 menos la de la pieza seleccionada
  (sin selección, menos los huesos); al apagarlo vuelve la opacidad que tenía cada una. Las capas fantasma no se tocan con
  el ratón: el clic llega a la capa sólida. Se apaga solo al cambiar de cuerpo y al entrar en Estudiar.
- **Pelar capas:** `UCorpusDatos::CargarExtras` lee `extras.json` → `dep` (545 músculos: s, i, p) y `lm`. Tres botones bajo
  la capa «Músculos» (Superficiales, Intermedios, Profundos; encendido = se ve), como `DEPTH_OFF` en la web
  (`ACorpusCuerpo::PelarProfundidad`, aplicado en `AplicarVisibilidad`).
- Pruebas: `panel <0|1>` · `fantasma <0|1>` · `pelar <s|i|p> [0]` · `pelar` (todos a la vista). Capturas `s1_b_*`.
- Falta: los músculos sin clasificar en `dep` (unas 37 piezas del hombre: se ven en `s1_b_pelar_sip`) no se pelan nunca;
  habría que completarlos en `data/extras.json`. El fantasma no sigue a la selección: hay que apagarlo y encenderlo.
  Los paneles de la derecha (ficha, movimiento, estudio) no se pliegan.

### C · Relieves óseos
- Datos: `data/extras.json` → `lm` (64 huesos; el fémur, n152 / n267, tiene 29), leídos por `UCorpusDatos::CargarExtras`
  (`Relieves(id)`, `NombreRelieve`). Nada en C++: nombres y puntos salen del JSON.
- Ficha del hueso: «Accidentes óseos (N)» con un botón por relieve, «Mostrar todos» y «Ocultar marcas». Un relieve solo:
  la cámara se acerca y el rótulo va junto al punto. Todos: rótulos en dos columnas a los lados del hueso unidos a su
  punto por una línea (`SCorpusMarcas`, dibujado en Slate encima del modelo, como la web sin prueba de profundidad).
  Mientras hay marcas se enciende el fantasma (lo que tapa el hueso queda translúcido) y se apaga al quitarlas.
- Pruebas: `sel n152; relieve todos` · `relieve <n | parte del nombre>` · `relieve off`. Capturas `s1_c_*`.
- Falta: nombres en francés y alemán (no están en los datos: salen en inglés); las marcas son de reposo y se esconden
  con una postura puesta; no se puede hacer clic en una marca; el relieve no se resalta como zona sobre la malla (solo
  punto y rótulo); con muchos rótulos el último puede salirse por abajo; enlazar los relieves (`lm`) del glosario.

### D · Mapa de origen (rojo) e inserción (azul)
- Datos: las áreas son las 705 mallas de la capa `insercion`; el catálogo (`data/catalog.json`, séptimo campo) dice si cada
  una es «origen» o «inserción» (`FCorpusPieza::Rol`) y llevan el nombre y el lado de su músculo. Lo que no decía ningún
  dato es **sobre qué hueso** está cada área: lo calcula `node tools/unreal/inserciones.js` (cada vértice vota por el hueso
  más cercano a menos de 15 mm) → `inserciones.json` en `Importar/datos` y `Content/Datos` (705 de 705 con hueso, hombre y
  mujer). Repetirlo si cambian los huesos o las áreas (`exportar.js`).
- `ACorpusCuerpo::MapaInserciones`: con un **hueso** seleccionado enciende todas las áreas dibujadas sobre él; con un
  **músculo**, las suyas. Rojo = origen, azul = inserción (color de estado por pieza); lo que tapa el hueso queda fantasma
  y la pieza seleccionada pierde su tinte azul (queda el contorno). Se apaga al elegir otra pieza que no sea una de sus áreas.
- Ficha: botón «Orígenes e inserciones» (solo si la pieza tiene áreas) y, encendido, la leyenda con los músculos que nacen
  y los que terminan ahí. La ficha de un área dice si es origen o inserción.
- Material: parámetro `Empuje` (tabla `EMPUJE`, 0,6 mm para `insercion`): separa las áreas del hueso para que no parpadeen;
  `insercion` sin dispersión (la verde teñía de naranja el rojo).
- Pruebas: `sel n152; mapa 1` · `mapa 0`. Capturas `s1_d_*` (fémur anterior y posterior, glúteo mayor, inglés, apagado).
- Falta / dudoso: la clasificación origen-inserción es la del catálogo de la web y hay que revisarla (en el fémur la cabeza
  corta del bíceps femoral figura como «inserción» y es un origen; faltan áreas del glúteo menor, obturadores y aductor
  corto); es un color por área, no una proyección pintada sobre la malla del hueso; sin rugosidad diferenciada en las zonas
  de inserción; el mapa no sigue todavía a varias piezas a la vez (una región entera).

### E · Goniómetro en pantalla y reproducción suave
- `SCorpusGonio` (Slate, en lo alto del panel de movimiento): transportador de 180°, brazo fijo a 0°, brazo móvil en el
  ángulo actual, arco recorrido en naranja y tope del rango marcado; al lado, el ángulo en grande, el máximo y el
  porcentaje del rango, con articulación, movimiento y lado. Lee `Grados()` y `GradosMax()` de `ACorpusCuerpo`.
- Reproducción: `ACorpusCuerpo::Tick` ya no va a 45°/s constantes. Avanza una fase 0–1 y el ángulo es
  máx · (1 − cos(π·fase)) / 2: arranca despacio, pasa por el centro del rango a la velocidad máxima y frena en el tope
  (media de 45°/s; mínimo 1,2 s por recorrido). `Reproducir()` arranca desde el ángulo en que esté el deslizador.
- Pruebas: `rom rodilla 0 R 68` · `reproducir <0|1>` · `grados [s]` (anota el ángulo en el registro). Medido en la
  flexión de rodilla cada 0,25 s: 0 → 3 → 11 → 23 → 38 → 55 → 73 → 91 → 106 → 120 → 129 → 134 → 135°.
  Capturas `s1_e_*` (rodilla a 0, 34, 68, 101 y 135°, abducción de cadera a 45° en español e inglés, reposo).
- Falta: el goniómetro es un indicador, no el goniómetro manipulable de la web (colocado por el usuario sobre el modelo);
  no se dibuja sobre la articulación; rotación automática de la rodilla, sentadilla y prueba en valgo (otra tarea: hay que
  volver a hornear el movimiento desde la web).

## Pendiente de pasar desde la web (por fases)
1. **Atlas:** membranas y piezas semitransparentes, etiquetas y pines, relieves óseos,
   planos de corte, disección por profundidad, piezas solo masculinas por nombre (`MALE_ONLY`), contorno de selección.
2. **Movimiento:** rig (`data/rig.json`, `buildRig`), `deform`, rangos articulares y goniómetro, marcha con datos de
   laboratorio y suelo, sentadilla en cadena cerrada, ejercicios funcionales, actividad muscular por intensidad.
3. **Fisiología:** corazón que late, respiración con costillas, acino pulmonar, zonas de West y segmentos broncopulmonares, recorridos narrados.
4. **Estudio y clínica:** lecciones, kinesiología y biomecánica, casos, protocolos, ECOE, ASIA, variantes, perfil de movilidad, glosario, exámenes.
5. **Acabado:** texturas esculpidas en Blender para músculo y hueso, piel realista, empaquetado e instalador.
