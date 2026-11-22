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

### F · Vínculo en los dos sentidos (estructura → Estudiar)
- Con el panel Estudiar cerrado, la ficha de la pieza seleccionada trae «Estudiar (N)»: un botón por cada entrada del
  glosario, de patologías o de lecciones que la nombra (campo `show` de la entrada o de uno de sus pasos en
  `estudio_<idioma>.json`), con el módulo y el grupo debajo. Se enseñan diez, por turnos entre los tres módulos, y «+ N»
  si hay más. Al pulsar se abre Estudiar en esa entrada (y en el paso que nombra la estructura) y el panel la enseña en el
  modelo; al cerrar vuelven capas, opacidades y cámara, como siempre.
- `SCorpusInterfaz::EnlacesDe` hace el índice nombre en inglés → entradas una vez por idioma (la primera selección lee
  `estudio_<idioma>.json`, unos 2 MB: se nota un instante). `AbrirEnlace` abre la entrada. El sentido inverso (entrada →
  modelo) ya estaba en `EnsenarEstudio`.
- Pruebas: `sel n152; enlace <n>` (enésimo botón de la ficha). Capturas `s1_f_*` (ficha del fémur y del glúteo mayor,
  entrada del glosario, patología, lección, vuelta al cerrar, e inglés).
- Falta: ver las entradas que no caben en los diez botones; enlazar también casos, kinesiología y variantes; los relieves
  óseos (`lm`) y los órganos (`org`) de los ejemplos del glosario no se enlazan (solo `s`); glosario sin francés ni alemán.
- Sin revisar por el agente `director-clinico`: los puntos C y D enseñan datos ya existentes (`extras.json`, catálogo),
  pero su contenido sigue pendiente de revisión profesional.

### G · Rodilla: extensión, rotaciones tibiales y rotación automática
- **Los tres rangos ya venían de la web.** La auditoría leyó solo la tabla `ROM` principal (rodilla = «Flexión»), pero
  `ROM_ADD` de `index.html` añade «Extensión» (10°, cuádriceps), «Rotación interna» (30°) y «Rotación externa» (40°, ambas
  con la rodilla a 90°), y `movimiento.json` ya los traía. No se han duplicado.
- `tools/unreal/rangos_extra.json` (datos, cinco idiomas): rangos propios de la edición (`rangos`), notas bajo el
  goniómetro (`notas`) y la regla de la rotación automática. `movimiento.js` hornea cada rango propio con `applyPose()`
  de la web (`__movPose` admite un movimiento que no está en la tabla ROM); si la web ya trae ese movimiento (mismo eje,
  sentido y máximo) no lo repite: compara las posturas (las tres salieron idénticas) y solo le añade nombre y nota por idioma.
  Un rango que la web no tenga se añade con una entrada más en el JSON, sin tocar código.
- **Rotación automática (screw-home):** la malla de reposo es la rodilla extendida y bloqueada. En los primeros 15° de
  flexión la tibia rota hacia dentro hasta 10° alrededor de su eje largo, de forma progresiva (al revés: en los últimos
  15° de extensión rota hacia fuera). Se compone después del giro de la web (q · q_axial) en las 174 posturas de los
  rangos que flexionan la rodilla (flexión de rodilla y de cadera, rotaciones de cadera y de rodilla). **No se aplica en
  la marcha ni en la sentadilla:** con el pie apoyado quien gira es el fémur y el pie resbalaría sobre el suelo; haría
  falta repartir el giro en la cadera.
- C++: `FCorpusMovimiento::Nombres` / `Notas`, `UCorpusDatos::NombreMov` y `NotaMov`; el panel enseña la nota bajo los
  botones del movimiento.
- Regenerar: `python -m http.server 8765` y `node tools/unreal/movimiento.js --sin-pesos` (12 min: lo lento es la marcha),
  y copiar `Importar/datos/movimiento.json` a `Content/Datos`.
- Capturas `s1_g_*` y `s1_g_hoja.png`: flexión de lado y de frente (0, 34, 68, 101, 135°), esqueleto de frente a 0, 5, 10,
  15 y 30° (la tibia gira y el peroné asoma), extensión 0–10°, rotación interna 0–30° y externa 0–40° vistas por detrás,
  y la interna en alemán.
- Se ve mal / dudoso: en la flexión de rodilla (con la cadera acompañando) los músculos del muslo se abren en tiras con
  huecos entre ellas desde unos 60° (ya pasaba antes; es el reparto de pesos de la cadera, no la rodilla). Los 10° y los 15°
  son valores de libro (Kapandji, Neumann), no medidos sobre este modelo; la rotación gira alrededor del eje largo de la
  tibia, no del eje real (que pasa por el cóndilo medial). En las rotaciones a 90° el neutro ya lleva los 10° internos del
  desbloqueo. En alemán y francés los nombres de varias articulaciones salen mal («cadera» por Knie): fallo anterior del
  lector de `i18n_de/fr` (claves «Rodilla» y «rodilla» fundidas), sin tocar aquí. Pendiente de revisión profesional y del
  informe del agente `director-clinico`.

### H · Modo «Ejercicio»: sentadilla en cadena cerrada
- **Datos:** `tools/unreal/ejercicios.json` (una entrada por ejercicio: `fuente`, variantes, duración, vista, tipo de
  contracción de cada fase; textos de interfaz en cinco idiomas y las traducciones al francés y al alemán que la web no
  tiene). `movimiento.js` lo hornea en `movimiento.json → ejercicios` = `{ui, lista:[{id, n, paso, duracion, vista,
  inicial, fases, grupos, medidas, variantes:[{id, n, frames, raiz, med}], textos}]}`.
- **Sentadilla** (`fuente: "sentadilla"`): se llama a `applyPose()` de la web con su módulo `SQ` puesto, cada 2 % del
  ciclo y para las tres profundidades (media, paralela, profunda; perfil por defecto: hombre de 30 años). Sale lo mismo
  que en la web: piernas resueltas en cadena cerrada, pelvis y **raíz del cuerpo** (pies fijos en el suelo), brazos de
  contrapeso, fases (`SQ_PH`, `SQ_PHN`, `SQ_PHG`), los 11 grupos de `SQ_M` con su tipo de contracción por fase y su
  intensidad (`sqLevel`), los ángulos de cadera, rodilla, tobillo y tronco de cada instante, y los textos de `CTESTS`
  (ex, how, pos) y `EJ_TXT` (errores, progresiones, precauciones). Comprobado en Node con los datos horneados: talón y
  punta del pie no se mueven en todo el ciclo.
- **Idiomas:** `tools/unreal/idiomas.js` (mismo criterio que `estudio.js`: [es, en, pt] de la web; fr y de por el texto
  español en `content_fr/de` e `i18n_fr/de`; si falta, inglés). A la sentadilla le faltaban 30 textos en francés y alemán:
  están en `ejercicios.json → traducciones` (propias de esta edición, pendientes de revisión).
- **Unreal:** `FCorpusEjercicio` y compañía en `UCorpusDatos` (`Ejercicios()`, `Tx()`, `TEj()`);
  `ACorpusCuerpo::PonerEjercicio(ejercicio, variante, % del ciclo)` interpola los instantes, mueve el actor con la raíz
  (como la marcha) y pinta cada grupo con su intensidad, amarillo → magenta. Un ciclo dura 4 s (16 s a cámara lenta).
  Panel de movimiento, tercer modo **«Ejercicio»**: ejercicio y profundidad, fase con su tipo (excéntrica al bajar,
  isométrica abajo, concéntrica al subir) y su explicación, ángulos, deslizador, reproducir / pausa, cámara lenta, reposo,
  y dos pestañas: «Músculos activos» (barra de intensidad y tipo de contracción) y «Técnica y errores».
- **Añadir un ejercicio:** una entrada más en `ejercicios.json` y volver a hornear; Unreal no cambia. Hoy solo existe la
  fuente `sentadilla`. Los otros 27 ejercicios funcionales de `CTESTS` (postura final + `anchor`) necesitan una fuente
  `ct` en `movimiento.js` (repetir la cuenta de `ctTick`: unas 20 líneas) y, en su entrada, las fases, los grupos y los
  niveles, que la web no tiene para ellos. **No está hecha.**
- **Nanite recortaba los pies** (arreglado, y afectaba también a los rangos al hacer zoom): Nanite descarta grupos de
  triángulos con su caja de reposo; con el cuerpo bajado por la raíz, la caja de reposo de los pies queda bajo el borde
  de la pantalla y desaparecían desde el 36 % del ciclo. Los dos materiales maestros declaran ahora
  `max_world_position_offset_displacement = 220` cm (`corpus_importar.py`; después `ci.crear_materiales()`).
- Regenerar: `python -m http.server 8765`, `node tools/unreal/movimiento.js --solo-ejercicios` (7 s; deja rangos, marcha
  y pesos como están) y copiar `movimiento.json` a `Content/Datos`.
- Pruebas: `ejercicio <id> [variante|-] [%]` · `ejercicio` (salir) · `tecnica <0|1>`. Capturas `s1_h_*` y `s1_h_hoja.png`
  (0, 26, 50, 74 y 96 % de lado y de frente; fondo de la media y la profunda; por detrás; esqueleto; técnica; alemán y francés).
- Se ve mal / dudoso: **el glúteo mayor se hincha como un globo en el fondo** (cadera a 126°; es el defecto ya anotado de
  los pesos de la cadera por encima de 90°); los muslos y la pared abdominal se atraviesan en el fondo; las rodillas quedan
  muy abiertas vistas de frente (lo da el resolutor de la web con 14° de rotación externa y 9° de abducción de partida);
  la «paralela» baja a 126° de cadera y 127° de rodilla y la «profunda» apenas más (132°, tope de rodilla del perfil), así
  que casi no se distinguen; la intensidad no depende de la profundidad elegida (`sqLevel` solo mira la fase) y es una
  estimación, no EMG; sin el perfil de movilidad de la persona, sin avisos de tope de tobillo o cadera y sin flecha de
  fuerzas. Sin rotación automática de rodilla (ver G). Textos pendientes de revisión profesional y del `director-clinico`.

### I · Tendones: origen carnoso frente a inserción tendinosa
Resuelve el «defecto conocido» del apartado de tendones (orígenes anchos pintados de blanco).
- **Canal original recuperado sin reexportar.** `exportar.js` es ahora también un módulo (`fuentes`, `capaBase`,
  `capaMujer`, `conDraco`, `SOLO_COLOR`; usado desde la consola hace lo mismo que antes). `tendones.js <cuerpo> --restaurar`
  recalcula con esas funciones solo el color de la capa muscular, comprueba pieza por pieza que número, orden y posición
  de los vértices coinciden con `muscular.glb` (hombre: 582 piezas y 1.006.301 vértices; mujer: 185 y 340.185; todos
  iguales) y parchea el canal G. Tarda 6 s. Si algo no coincide, no escribe y lo dice. Los pesos (TEXCOORD) no se tocan,
  así que no hubo que rehacer pesos ni correctivos.
- **Copias** en `unreal/CorpusAtlas/Importar/canal_g/` (no se sube, como el resto de `Importar`): `<cuerpo>_muscular_g_original.bin`
  (la web), `…_g_pintado_antes.bin` (lo que había, la primera vez), `…_g_aplicado.bin` (lo último aplicado) y
  `<cuerpo>_muscular.json` (piezas y vértices, en el orden del GLB). Un byte por vértice.
- **`--aplicar` parte siempre del original** (se puede repetir sin acumular) y decide unión por unión (músculo × área de la
  capa `insercion`) con `tools/unreal/tendones_reglas.json`:
  1. `musculos`: entrada explícita para 34 músculos de cadera, muslo y rodilla (origen e inserción: `tendon`,
     `aponeurosis`, `mixto` = borde fino, `carnoso` = no se pinta), con su nota y `revisado: false`. Criterio de Gray y
     Moore, **pendiente de revisión profesional**.
  2. `patrones`: excepciones del resto del cuerpo (manguito rotador, redondo mayor, deltoides, trapecio, romboides,
     dorsal ancho, pectorales, serrato, braquial, tríceps, temporal, profundos del antebrazo, músculos de la pierna,
     recto y oblicuos del abdomen, esternocleidomastoideo) y las piezas que son enteras tendón, aponeurosis o retináculo
     (`todo`: tracto iliotibial, retináculos, aponeurosis palmar y plantar, línea alba…).
  3. Geometría para lo demás: si la zona del área cubre ≥ 25 % de los vértices de la pieza, carnosa; 15–25 %, mixta;
     menos, tendón.
  - `hueso` (expresión regular sobre el hueso del área, de `inserciones.json`) manda sobre el papel del catálogo, que
    falla a menudo (pectoral mayor, trapecio, serrato, dorsal ancho figuran al revés).
  - Si la regla da un extremo tendinoso y el atlas no tiene área para él (vastos, recto femoral, ilíaco, glúteo menor,
    obturadores, gemelos…), se pinta el extremo de la pieza opuesto a las áreas que sí hay; sin ninguna área (piriforme,
    psoas, aductor corto, bíceps corto), el que mira hacia `insercion_hacia`.
- Resultado en el hombre: 632 uniones → 346 tendón, 12 aponeurosis, 94 mixtas y 180 carnosas; de las tendinosas con área
  llegan en tendón 284 de 288. El tendón pasa del 12,9 % de los vértices (web) al 28 % (antes del arreglo era bastante más:
  infraespinoso 67 % → 23 %, vasto medial 74 % → 10 %, vasto intermedio 100 % → 25 %, ilíaco 65 % → 25 %).
- Orden: `tendones.js <cuerpo> --restaurar` (una vez, o tras reexportar) → `--aplicar` → reimportar la capa muscular
  (`.\unreal\py.ps1 'ci.importar_mallas(["hombre/muscular", "mujer/muscular"])' -Limite 3000`: 626 s y 546 s las dos veces).
  `--lista` enseña la decisión de cada unión; el informe queda en `unreal/tendones_informe.json`.
- Capturas `s1_i_*`, `s1_i_hoja.png` y `mosaico_tendones.png` (el mismo juego): frente, espalda, hombro y escápula,
  deltoides de lado, glúteos, muslo anterior y posterior, rodilla y pierna (frente, detrás, lado), las mismas zonas sin
  los músculos superficiales, mujer y abducción del hombro a 120° (los correctivos siguen bien: la geometría no cambió).
- Se ve mal / dudoso:
  - Una primera pasada dejó una mancha blanca sobre la escápula que no era el infraespinoso sino el **dorsal ancho**
    (su área del ángulo inferior, que el catálogo marca como inserción): corregido con su patrón. Puede haber más casos
    así en zonas que no se han mirado de cerca (antebrazo, mano, pie, cara, cuello).
  - 23 uniones carnosas siguen blancas porque lo trae **el canal de la web**, que aquí no se rebaja: ilíaco, pectíneo,
    gemelo superior, pectoral mayor esternocostal, serrato anterior, oblicuo interno, extensor largo de los dedos, fibular
    largo, pterigoideo medial… Hay que decidir si se corrige en la web o se permite a las reglas bajar el canal.
  - El aductor mayor queda con borde fino en toda la línea áspera y sin su tendón del tubérculo del aductor; el vasto
    lateral, con borde fino donde Gray describe una aponeurosis ancha; glúteo mayor sin la parte aponeurótica de su origen.
  - Sigue siendo una regla, no una disección: la longitud de cada tendón no está modelada (zona = 5 % de la pieza, 3–20 mm)
    y 201 piezas sin área usan sus dos extremos. El trapecio conserva blanco en acromion y espina (borde mixto).
  - Sin informe del agente `director-clinico`.

### J · El dorsal ancho tapaba la punta inferior del trapecio en reposo
- **Causa:** el paso «cubrir el ángulo inferior de la escápula» de `HLSL_POSTURA` (dato primitivo 20 = 2, solo el dorsal)
  sumaba al dorsal todo lo que la punta de la escápula sobresale del contorno costal (k − 1 ≈ 0,05 → hasta **11,3 mm**
  hacia fuera) también con la postura a cero. En reposo el dorsal salía por encima del trapecio inferior (n1598 / n1601)
  desde T8–T10: la línea dentada. En los rangos de hombro y cintura escapular no se veía porque ahí manda el correctivo
  elástico; sí en reposo, tronco, marcha y sentadilla. No eran ni la fibra tensa, ni `Empuje` (0 en el músculo), ni el
  límite `tanh` (en reposo daba factor 1).
- **Arreglo:** el dorsal sube solo lo que la punta sube **respecto al reposo**
  (`max(0, cerca·max(0, kb − 1) − cerca0·max(0, kb0 − 1))`), `Gira` devuelve el punto exacto si el ángulo es 0 y `k1 = k0`
  si el punto no se ha movido: **sin postura el desplazamiento es exactamente 0** (medido en la CPU para dorsal, trapecio,
  pectoral y redondo mayor). Mismo cambio en `postura.js` y `simular.js`; después `.\unreal\py.ps1 "ci.crear_materiales()"`.
- **`tools/unreal/capas.js <fuera> <dentro> [rom mov lado grados] [--corr] [--frente] [--celda=4]`**: celdas vistas desde
  detrás donde la pieza de dentro asoma por fuera de la otra, con la cuenta del material o con el correctivo.
  Trapecio inferior sobre dorsal, celdas de 4 mm: reposo 2 de 368 (hasta 2,4 mm; antes, con los 11 mm, casi todo el
  solape); abducción 90° 2 de 446, 150° 13 de 596 (hasta 6,4 mm junto a la espina de la escápula, x = −0,10, y = 1,35);
  flexión 90° 2 de 384, 150° 2 de 427. Las 2 celdas fijas son la malla original: la punta del trapecio es un tendón de
  1–2 mm de ancho sobre la línea media (y = 1,12–1,13) y el dorsal de al lado queda 0,9 mm más atrás (con celdas de 1 mm).
  No se ve en las capturas y **no se ha tocado la malla** ni el exportador.
- **Nombres del trapecio:** el catálogo ya tiene bien «Ascending part» (n1598 / n1601, fibras inferiores) y «Descending
  part» (n1597 / n1600). `correctivos.js` y `tendones_reglas.json` tratan igual las tres porciones. `movimiento.js` sí
  distingue la descendente (no copia el peso de la esternoclavicular a la acromioclavicular: va a la clavícula) y leía el
  nombre grabado en el GLB al exportar, con el cruce antiguo; ahora lo toma de `data/catalog.json`. Los GLB de `Importar`
  siguen con el nombre antiguo en `extras.en` hasta que se vuelva a exportar (solo lo usa `postura.js` para «Latissimus»).
- Capturas `s1_j_*`, `s1_j_hoja.png` y `s1_j_mosaico.png` (antes / después): reposo con n1598 y con n1601 seleccionados
  (el resalte llega a la punta), dorsal seleccionado, abducción y flexión a 90° y 150°, flexión y rotación del tronco.
- Se ve mal / dudoso: en abducción y flexión a 150° queda la solapa del borde del dorsal en la axila (ya anotada en los
  correctivos; no es de este arreglo) y las 13 celdas junto a la espina de la escápula. Entre el dorsal y el trapecio no
  hay colisión: el orden lo da la malla de reposo.

### K · Glúteo mayor: ya no se hincha ni cuelga al flexionar la cadera
Rechazado dos veces por el usuario (fisioterapeuta): «parecen dos bolsas que le colgaran al modelo». En reposo el glúteo
mayor es la malla de la web (Z-Anatomy, 420 cm³, 10,7 cm por detrás de la cabeza femoral): no se ha tocado su forma. El
defecto era solo de la deformación.
- **Causa:** cada pieza traía su propio peso de cadera y el hueco giraba en arco alrededor de la cabeza femoral. El tejido
  de peso intermedio (la mitad baja del glúteo) conservaba su radio (hasta 14 cm) y barría por debajo del isquion: a 90°
  el glúteo mayor tenía el 138 % de su volumen de reposo, a 120° el 151 % y en el fondo de la sentadilla el 135 %.
- **`tools/unreal/cadera.js`** (mejora sobre la web; lo llama `movimiento.js` al rehacer los pesos de la capa muscular):
  - **Un solo campo de peso** de cadera para toda la región (Laplace en una rejilla de 5 mm: 0 en pelvis, sacro, cóccix y
    lumbares, 1 en el fémur y en todo lo que queda a más de 10,5 cm de la cabeza femoral a lo largo del fémur). Dos
    músculos vecinos reciben el mismo peso y se mueven juntos.
  - **Glúteo mayor: fracción de fibra armónica** (Laplace en una rejilla de 5 mm alrededor del músculo: 0 en los
    vértices pegados a pelvis, sacro y cóccix, 1 en los pegados al fémur y al tracto iliotibial por debajo del
    trocánter; igual en todo el grosor): resbala como una banda en vez de dejar la cara superficial colgando. La primera
    versión proyectaba sobre una sola dirección origen → inserción y las fibras bajas del cóccix (casi horizontales) se
    quedaban con peso 0: a 120° dejaban una solapa y destapaban la tuberosidad isquiática, la bolsa isquiática del
    glúteo mayor (azul) y los tendones del obturador interno y el gemelo inferior: el «gancho» que colgaba por detrás
    (`CORPUS_FIBRA=proy` la recupera para comparar). La armónica sobre la propia malla (1.663 vértices) salió arrugada.
  - **Arco y cuerda** (`cuerda`) y **adelgazamiento** (`adelgaza`): en los huecos de cadera con peso intermedio el punto
    va por la cuerda recta entre reposo y giro completo (la banda tensa se pega a la articulación) y lo que queda fuera
    de una esfera de 7,5 cm alrededor de la cabeza femoral se acerca a ella tanto como se estira el tejido
    (estiramiento = ángulo · ∇peso · (eje × radio)). El gradiente del peso viaja en tres huecos de datos (código 31)
    detrás del de la cadera. Parámetros en `movimiento.json → cadera` = `{cuerda: 1, radio: 0.075, adelgaza: 0.7}`; los
    leen `postura.js`, `simular.js` y `HLSL_POSTURA` (`@CAD_CUERDA@`, `@CAD_RADIO@`, `@CAD_ADELGAZA@`). Con postura cero
    el desplazamiento sigue siendo exactamente 0 (sin giro no se entra en el bucle y `lam > 1` protege el adelgazamiento).
  - Órdenes: `node tools/unreal/cadera.js aplicar [hombre,mujer]` (reescribe los TEXCOORD de `muscular.glb` y los huecos
    de `movimiento.json`; se puede repetir) · `medir [cuerpo] [R|L]` (volumen, grosor, pliegues y huecos en 7 posturas) ·
    `campo` (corte sagital del campo). `CORPUS_IMP=<copia de Importar>`, `CORPUS_CUERDA` y `CORPUS_ADELGAZA` miden otro
    estado sin tocar nada (la copia de antes está en `Importar/antes_kl`, no se sube).
  - `movimiento.js --sin-pesos` y `--solo=<capa>` conservan ahora `movimiento.json → cadera`. `copiar_datos()` salta las
    carpetas (`estudio_img` cortaba la copia con PermissionError).
- **Medido (hombre, lado derecho; antes → primera pasada → final):** volumen del glúteo mayor a 60/90/120° de flexión y
  en el fondo de la sentadilla 125/138/151/135 % → 90/90/83/80 % → **94/89/77/75 %**; glúteo medio a 120° 166 % → 71 % →
  75 %; tejido del glúteo mayor por debajo de la tuberosidad isquiática 4,2 cm → 0,5 cm a 90° y 0 a 120° → 0,8 cm a 90° y
  0 a 120°; pliegues (aristas que se cierran) del glúteo mayor a 120° 44 → 3 → 23 y en la sentadilla 69 → 4 → 43 (la
  banda arruga algo su borde medial bajo). Sin cambio en extensión (82 %) ni en abducción.
- Barrido de parámetros (volumen a 90°/120°): arco puro con el campo nuevo 156/174 %; `cuerda 0,5 · adelgaza 1` 91/95 %;
  `1 · 1` 90/83 % (primera pasada); `1 · 2` 81/77 %; `0 · 4` 56 %. Con la fibra armónica: `1 · 1` 86/75 % (sentadilla
  73 %), **`1 · 0,7` 89/77 %, sentadilla 75 % (elegido)**.
- **El otro «apéndice» que asoma bajo la nalga en la sentadilla de lado** es el cremáster (x34, capa muscular): está en
  su sitio, no se mueve con la cadera (y = 0,733 en reposo y en la postura) y antes lo tapaba el glúteo hinchado. No es
  un defecto de la deformación.
- Regenerar: `node tools/unreal/cadera.js aplicar hombre,mujer` (o `movimiento.js --solo=muscular`), después
  `tendones.js <cuerpo> --aplicar` y `.\unreal\py.ps1 'ci.copiar_datos(); ci.crear_materiales(); ci.importar_mallas(["hombre/muscular", "mujer/muscular"])' -Limite 3000`
  (unos 10 min). Cambiar solo `cuerda`/`adelgaza` no necesita reimportar: basta `movimiento.json` y `ci.crear_materiales()`.
- Capturas `antes_k_*` (antes) y `s1_k_*`: flexión de cadera 0–120° y sentadilla profunda de lado, por detrás y de frente
  (`s1_k_cad_hoja.png`, `s1_k_sq_hoja.png`), y `s1_k_mosaico.png` (antes / después). Comprobaciones de que no se rompió
  lo anterior (`s1_k_control_hoja.png`, `s1_k_control_mos.png`): reposo por detrás igual que antes (sin postura el
  desplazamiento es 0), abducción del hombro a 120° con correctivos y el trapecio ascendente (n1598) seleccionado en
  reposo con el resalte hasta su punta inferior (punto J).
- Se ve mal / dudoso: visto por detrás a 90–120° el glúteo mayor se lee mejor como lámina diagonal del sacro al
  trocánter y ya tapa la tuberosidad, pero conserva el contorno redondeado de la malla de reposo (no es la banda plana y
  tensa de una disección: haría falta un correctivo elástico como el del hombro, horneado por postura, también para la
  sentadilla); el glúteo medio baja al 66–75 % a 120° y en la sentadilla; los pliegues de los músculos del muslo suben (a
  90°, 823 → 1.074, isquiosurales y grácil a media altura, por la combinación con el peso de rodilla de la web) aunque no
  se ven en las capturas. Pendiente de revisión profesional y del `director-clinico`.

### L · Muslo: la masa sigue continua al flexionar la cadera
- Mismo cambio que K (un solo campo de peso de cadera para todos los músculos de la región): antes cada músculo del muslo
  traía su reparto propio de la web, con mezcla lineal, y a partir de unos 60° se abrían en tiras.
- **Medido (hombre, derecho):** parejas de puntos de dos músculos distintos que en reposo están a menos de 3 mm y se
  separan más de 5 mm: flexión de cadera 90° 128 → 37, 120° 167 → 56; flexión de rodilla 135° (con la cadera) 141 → 62;
  fondo de la sentadilla 192 → 71. Separación máxima 58 → 20 mm (120°) y 58 → 20 mm (sentadilla). Los huecos de la ingle
  y de la pelvis (glúteo medio con tracto iliotibial, pectíneo con aductores, glúteo medio con menor) desaparecen.
- Los que quedan (máximo 17 mm) están junto a la rótula a 135° de rodilla (recto femoral con los vastos) y son iguales
  antes y después: los da el peso de rodilla de la web, distinto en cada músculo. Haría falta un campo común también
  para la rodilla.
- **Muslo y abdomen en el fondo de la sentadilla: no resuelto.** No hay colisión entre el muslo y la pared abdominal; con
  la cuenta de puntos del muslo por dentro de la cara anterior de la pared (> 3 mm; 700 ya en reposo, junto a la ingle)
  sale 1.012 → 1.154 en la sentadilla y 1.273 → 1.932 a 120° de cadera (aductores, pectíneo y grácil junto al pubis). En las
  capturas de lado no se ve el cruce, de frente lo tapan los muslos. Haría falta un plano o una superficie de contacto
  (ingle) en el material.
- **Se ve todavía:** la cámara «lado» ve la cara interna del muslo que se mueve; a 101° y 135° siguen viéndose líneas
  oscuras entre grácil, sartorio y aductores que convergen hacia la ingle (`s1_l_mosaico.png`), parecidas a las de antes.
  La medida dice que ya no se separan más de 5 mm, así que son sobre todo el surco entre músculos que se abren en abanico
  y su sombra, pero a la vista no es la «masa continua» pedida. No se da por resuelto.
- Capturas `antes_l_*` y `s1_l_*`: flexión de rodilla 0–135° de lado, por detrás y de frente (`s1_l_rod_hoja.png`) y
  `s1_l_mosaico.png`.

## Interfaz · Fase 1 de `PLAN_INTERFAZ.md`: legibilidad y sistema visual (2026-11-22) — SIN COMPILAR NI CAPTURAR
Código escrito en una sesión sin consola (no se pudo compilar, ejecutar `captura.ps1` ni descargar Inter). Hay que
compilar, capturar y revisar antes de darlo por bueno.
- **Escala:** `SCorpusInterfaz` envuelve todo en un `SDPIScaler`. En `Tick` se mide la ventana en píxeles (tamaño local ×
  escala acumulada del motor), se aplica la curva por lado corto 720 → 0,9 · 1080 → 1,0 · 1440 → 1,25 · 2160 → 1,6
  (`EscalaPorLado`) × «Tamaño del texto» y se divide por la escala que ya pone el motor (su curva de `DefaultEngine.ini`
  no se toca). Tope: la interfaz nunca baja de 1.320 unidades de ancho (`ANCHO_MIN_PANELES`), para que capas, buscador y
  ficha no se pisen; con 125–150 % en ventanas estrechas el ajuste se nota menos.
- **Tamaño del texto:** fila 90 · 100 · 125 · 150 % en el panel izquierdo; se guarda en `GameUserSettings.ini`
  (`[CorpusAtlas.Interfaz] TamTexto`), nunca en `DefaultEngine.ini`. Prueba: `texto <90|100|125|150>`.
- **Sistema visual** al principio de `CorpusInterfaz.cpp`: paleta (`C_*`, tinta #E6EAF0, gris #7F8C9E, ámbar #F0A040,
  convertidos a lineal), espaciado (`E_1`…`E_6`, margen 16, relleno de panel 20, botón 12 × 8), escala tipográfica
  (`T_GONIO` 32 · `T_TITULO` 18 · `T_SECCION` 13 · `T_CUERPO` 10,5 · `T_NOTA` 11 · `T_SECUNDARIO` 10 · `T_ETIQUETA` 9 con
  espaciado), `Letra()` con Inter (`FuenteInter`, respaldo Roboto) y `Etiqueta()`. Ya no queda ningún `FLinearColor` suelto
  fuera de la paleta ni tamaños de 8–9 pt en texto de lectura (leyendas y créditos a 10, notas clínicas y fichas a 11).
- **Botones** (`ECorpusBoton`): `Principal` = acento con texto oscuro #0B1320 (≈ 7,5:1; antes blanco 2,46:1), una por
  panel (Encuadrar en la ficha, Reproducir en movimiento, Siguiente —o Ver si no hay pasos— en Estudiar); `Seleccionado`
  = borde de 1,5 px y texto en acento sin relleno (cuerpo, idioma, tamaño, fantasma, corte, profundidad, articulación,
  movimiento, lado, patrón, ejercicio, módulo, relieves); `Normal`. Mínimo 32 × 36 (`ConFoco`), anillo de foco de 2 px
  claro solo cuando el foco llega por teclado. Respuestas del examen: verde o rojo solo en el borde (`EstiloRespuesta`).
- **Controles:** casilla de 18 px con borde gris de 1,5 px y la fila entera (color + nombre) clicable; deslizadores con
  barra de 4 px, tirador de 14 px y el valor en % en el ToolTip (opacidad: 96 de ancho, paso 0,05); buscador con fondo
  PANEL2, borde de foco y letra de 12; barras de desplazamiento de 6 px gris al 50 %.
- **Teclado** (`CorpusJugador.cpp`): Ctrl+F lleva al buscador; F, H, I y 1–6 no actúan mientras un cuadro de texto tiene
  el foco (`SCorpusInterfaz::Escribiendo`); Esc cierra resultados → ficha → Estudiar (`CerrarConEsc`) y, si no queda nada,
  muestra todo como antes; Esc dentro del buscador borra la búsqueda. Pruebas: `esc`.
- **Geometría:** las marcas de relieves ya no usan 360 / `Tam.X − 430` / 74 fijos: `Tick` les pasa el borde real del
  panel izquierdo (o del plegado), el ancho de la ficha y el alto del buscador, y cada columna de rótulos se aparta lo que
  mide su rótulo más ancho (antes los de la izquierda podían quedar bajo el panel de capas). La altura máxima de la ficha
  usa `TamVista` en unidades de dentro del escalador. Entradas de los paneles con desplazamiento ≤ 12 px.
- **Movimiento:** la fila de lado (derecho/izquierdo o «hacia la derecha/izquierda») va en su propia fila: junto al
  deslizador se salía del panel. Panel de movimiento para capturas: `movimiento 1` (nuevo), o `rom rodilla 0 R 68`,
  o `ejercicio squat` (el id es `squat`, no `sentadilla`).
- **Inter:** `Content/Slate/Fuentes/` (ver `LEEME.txt` de esa carpeta) con `Inter-Regular.ttf`, `Inter-SemiBold.ttf`,
  `Inter-Bold.ttf` y `LICENSE.txt` de https://github.com/rsms/inter/releases (OFL 1.1). **Aún no están:** hay que bajarlos.
  `DefaultGame.ini` empaqueta la carpeta (`DirectoriesToAlwaysStageAsNonUFS`); atribución en `ATTRIBUTION.md`.
- **Falta de esta fase:** compilar; capturas `ui_f1_*` (inicio · `sel n1394` ficha · `buscar biceps` · `estudio 0 0 0` ·
  `movimiento 1`/`rom`) a 1280×720, 1600×900 y 2560×1440 y hoja antes/después; lupa del buscador (no hay icono propio);
  comprobar que Tab mueve el foco entre botones en la ventana del juego.

## Interfaz · Fase 2 de `PLAN_INTERFAZ.md`: orden y espacio para el modelo (2026-11-22) — SIN COMPILAR NI CAPTURAR
Escrito en una sesión sin consola (solo lectura y escritura de archivos): falta compilar, capturar y revisar. Se apoya en el
sistema visual de la Fase 1 (`C_*`, `E_*`, `T_*`, `Letra`, `ECorpusBoton`, `ConFoco`, `TxtLinea`); los anchos de los paneles
pasan a constantes (`ANCHO_IZQ` 360 · `ANCHO_FICHA` 400 · `ANCHO_EST` 500 · `ANCHO_MOV` 520 · `ANCHO_BUSCADOR` 460).
- **Barra de modos** Explorar · Movimiento · Estudiar encima del panel izquierdo (`RehacerModos`, `PonerModo`, `ModoActivo`):
  pestañas iguales (`SUniformGridPanel`) y subrayado de acento que `Tick` desliza en 180 ms con salida suave. Sustituye a
  los botones «Movimiento» y «Estudiar» del panel. Movimiento queda desactivado en el Visible Human. El borde del panel
  derecho del modo activo se tiñe (`PanelModo`): ficha en Explorar, movimiento en Movimiento, estudio en Estudiar.
  Salir de Movimiento devuelve el cuerpo al reposo; entrar en Estudiar también.
- **Barra flotante de disección** abajo, centrada en la zona libre (`RehacerHerramientas`, `BotonBarra`, píldora de 44 de
  alto y radio 22): Aislar · Ocultar (desactivados sin selección; la ayuda dice qué falta) | Fantasma | − nivel + (pelar
  músculos: superficiales → intermedios → profundos, con `PelarProfundidad`) | S · C · A (inicial del plano en el idioma),
  y con un corte activo su deslizador e Invertir | Restablecer (muestra todo y quita corte, fantasma, pelado y marcas).
  Se aparta de la cruceta y de lo que llega al pie; si no cabe junto al panel de movimiento sube por encima; en último caso
  se encoge (`SScaleBox` solo hacia abajo). No sale en Estudiar.
- **Cruceta de vistas** abajo a la izquierda, sobre el visor (`RehacerVistas`): Sup. arriba, Dcha. · Ant. · Izda. en medio
  (la derecha del cuerpo a la izquierda de quien mira de frente), Inf. abajo y Post. en la esquina; ayuda con el nombre
  completo y la tecla (1–6). Sigue al borde del panel izquierdo mientras se pliega.
- **Cabecera del panel izquierdo:** idioma y «Aa» (Tamaño del texto) en menús desplegables (`SComboButton` con
  `EPopupMethod::UseCurrentWindow`: el menú se dibuja dentro de la ventana, sale en las capturas y respeta la escala) y «
  para plegar. El panel queda con cabecera, cuerpo (control segmentado Hombre · Mujer · Visible Human) y capas.
- **Capas:** grupos plegables con chevrón y contador «2/6» (capas a la vista del grupo); la opacidad (deslizador de 96 y
  su %) solo aparece al pasar el ratón por la fila o mientras se arrastra, y si no el nombre usa todo el ancho; degradado
  de 24 px al pie de la lista mientras quede lista por debajo (`SCorpusDegradado`). Pelar salió de la fila de Músculos.
- **Plegado automático:** abrir una ficha o Estudiar pliega el panel izquierdo (`PlegadoAutomatico`); al cerrarlos vuelve
  si lo plegaron ellos. Abrirlo a mano con » se respeta hasta que se cierren.
- **Encuadre con paneles:** `ACorpusCamara::CalcCamera` descentra la proyección (`FMinimalViewInfo::OffCenterProjectionOffset`)
  para que el objetivo quede en el centro de la zona libre, con suavidad, y `Encuadrar` ajusta la distancia al ancho libre
  (`PonerZonaLibre`, que la interfaz llama en cada `Tick` y antes de encuadrar desde la ficha, el buscador o Estudiar).
  La órbita sigue girando alrededor del objetivo y el clic usa la misma matriz (`DeprojectMousePositionToWorld`).
- **Buscador:** centrado entre la barra de modos y los paneles de la derecha; se encoge si no cabe (ya no pisa la ficha ni
  Estudiar en ventanas estrechas).
- **Textos nuevos** en `TR_PROPIA` (`CorpusDatos.cpp`) en en/pt/fr/de. No es contenido clínico nuevo (rótulos de interfaz).
- **Pruebas nuevas:** `modo <explorar|movimiento|estudiar>` · `menu <idioma|ajustes> <0|1>` · `grupo <clave de capa o
  nombre del grupo> <0|1>` (1 = abierto) · `verop <clave|off>` (deja a la vista la opacidad de una fila) · `zona` (anota en
  el registro la zona libre y los bordes). `movimiento <0|1>` y `panel <0|1>` siguen y pasan por los mismos caminos que los
  botones.
- **Capturas por hacer** (1280×720, 1600×900 y 2560×1440; `ui_f2_*`):
  ```powershell
  .\unreal\captura.ps1 -Pasos "esperar 4; foto ui_f2_inicio; sel n1394; esperar 1; foto ui_f2_ficha; esc; modo estudiar; esperar 2; foto ui_f2_estudio; modo movimiento; rom rodilla 0 R 68; foto ui_f2_movimiento; modo explorar; corte sagital 0.5; fantasma 1; pelar s; foto ui_f2_diseccion; todo; corte off; fantasma 0; pelar; menu idioma 1; esperar 1; foto ui_f2_menu_idioma; menu idioma 0; grupo muscular 0; verop oseo; foto ui_f2_grupo; grupo muscular 1; verop off; texto 150; esperar 1; foto ui_f2_texto150; texto 100; zona"
  ```
- **Falta / riesgos:** compilar; comprobar el signo del descentrado (si el cuerpo se va hacia los paneles en lugar de
  apartarse, cambiar el signo en `CalcCamera`) y que Lumen y las sombras no cambian con la proyección descentrada; que el
  ratón encima de la fila (`SBorder::IsHovered`) enciende la opacidad sin parpadeo; que el menú desplegable se cierra al
  pulsar fuera; que «›» girado se ve bien con Inter; FR/DE en la barra de modos y en la barra de disección sin «…».

## Pendiente de pasar desde la web (por fases)
1. **Atlas:** membranas y piezas semitransparentes, etiquetas y pines, relieves óseos,
   planos de corte, disección por profundidad, piezas solo masculinas por nombre (`MALE_ONLY`), contorno de selección.
2. **Movimiento:** rig (`data/rig.json`, `buildRig`), `deform`, rangos articulares y goniómetro, marcha con datos de
   laboratorio y suelo, sentadilla en cadena cerrada, ejercicios funcionales, actividad muscular por intensidad.
3. **Fisiología:** corazón que late, respiración con costillas, acino pulmonar, zonas de West y segmentos broncopulmonares, recorridos narrados.
4. **Estudio y clínica:** lecciones, kinesiología y biomecánica, casos, protocolos, ECOE, ASIA, variantes, perfil de movilidad, glosario, exámenes.
5. **Acabado:** texturas esculpidas en Blender para músculo y hueso, piel realista, empaquetado e instalador.
