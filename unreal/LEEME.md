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
- Al encuadrar una pieza pequeña (p. ej. un músculo del ojo) la cámara queda muy cerca; y cambiar de cuerpo no reencuadra.
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

## Pendiente de pasar desde la web (por fases)
1. **Atlas:** membranas y piezas semitransparentes, etiquetas y pines, relieves óseos,
   planos de corte, disección por profundidad, piezas solo masculinas por nombre (`MALE_ONLY`), contorno de selección.
2. **Movimiento:** rig (`data/rig.json`, `buildRig`), `deform`, rangos articulares y goniómetro, marcha con datos de
   laboratorio y suelo, sentadilla en cadena cerrada, ejercicios funcionales, actividad muscular por intensidad.
3. **Fisiología:** corazón que late, respiración con costillas, acino pulmonar, zonas de West y segmentos broncopulmonares, recorridos narrados.
4. **Estudio y clínica:** lecciones, kinesiología y biomecánica, casos, protocolos, ECOE, ASIA, variantes, perfil de movilidad, glosario, exámenes.
5. **Acabado:** texturas esculpidas en Blender para músculo y hueso, piel realista, empaquetado e instalador.
