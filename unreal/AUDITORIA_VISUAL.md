# Auditoría visual y de proporciones (2026-11-21)

Segunda opinión de Codex (GPT, solo lectura) sobre materiales, luz y proporciones, revisada por Claude. Las líneas citadas se refieren a `corpus_importar.py` en el commit 4c93906 y pueden haberse movido. Nada de esto está aplicado todavía: se probará con capturas antes y después cuando termine la corrección del glúteo, que toca el mismo archivo.

**Comentario de Claude:** la estatura de la mujer (+7 % frente a ANSUR II) es consecuencia de una decisión de diseño de la web: el cuerpo de mujer es el esqueleto masculino con la pelvis deformada (`tools/pelvis_warp.py`). Corregirlo es una decisión del usuario. Las relaciones músculo/hueso por cajas no miden volumen y no justifican por sí solas deformar mallas.

## 1. Materiales y luz

**Medido en código:** las líneas citadas son del archivo [corpus_importar.py](CorpusAtlas/Content/Python/corpus_importar.py). Las propuestas son valores de partida para un estudio de atlas; requieren revisión visual en el mapa porque las luces, Lumen y la exposición se afectan entre sí. `rug` = rugosidad, `esp` = especular, `sss` = dispersión, `poro` = grano, `esc` = escala de estría.

| Tejido y línea | Actual → propuesto | Motivo y riesgo |
|---|---|---|
| Hueso, 52 | `ece2cb`, rug `.62`, esp `.35`, sss `.10`, poro `.55` → `e0d4bb`, `.70`, `.32`, `.06`, `.28` | Menos aspecto de cera y menos ruido fino; conserva un marfil cálido. Riesgo: con iluminación fría podría verse gris. |
| Cartílago articular, 54 | `d3dde6`, rug `.30`, sss `.30`, fibra `.55`, anis `.70` → `c7d3d3`, `.26`, `.22`, `.25`, `.25` | El cartílago debe leerse liso, pero no como plástico azul; el código ya suprime fibra y anisotropía donde la máscara B indica cartílago. Riesgo: podría perder contraste contra el hueso claro. |
| Ligamento, hoy comparte `articular`, 54 | `rug .30`, `sss .30` → crear perfil propio: color `b7a58a`, rug `.42`, sss `.18`, anis `.25` | Evita que ligamento y cartílago compartan respuesta de superficie. **Supuesto:** requiere asignar/remapear esos elementos a un nuevo tejido; el catálogo no define un perfil de ligamento independiente. Riesgo: trabajo de clasificación y diferencias visuales en datos existentes. |
| Tendón, mezcla por vértice, 500–501 y 557 | color `efe6d6`, rugosidad efectiva `.22` → color `d8cbb5`, rugosidad efectiva `.30` | El tono nacarado actual puede quemarse con la luz. Mantendría el brillo, pero con menos blanco. Riesgo: tendones menos distinguibles sobre fascia pálida. |
| Fascia, 56 | `cdb594`, rug `.35`, sss `.35`, fibra `.35`, anis `.50` → `c5b49e`, `.48`, `.22`, `.18`, `.25` | La vuelve una lámina fibrosa mate, con menos brillo sedoso. Riesgo: podría confundirse con tendón si ambos quedan demasiado mates. |
| Músculo, 53 | `a3392f`, rug `.50`, fibra `.85`, anis `.55`, sss `.30`, poro `.10`, esc `9`; `Desaturar .24` (73) → `8f4038`, `.56`, `.55`, `.35`, `.24`, `.04`, `6`; `Desaturar .35` | Rojo más profundo y menos uniforme; reduce rayado fino y brillo al alejar la cámara. Riesgo: músculos pequeños o en sombra pueden parecer demasiado oscuros. |
| Arteria, 57 | `c53a2f`, rug `.28`, esp `.60`, sss `.40`, anis `.30` → `a9433b`, `.38`, `.45`, `.28`, `.22` | Menos plástico y menos rojo saturado; conserva un matiz cálido para distinguirla de la vena. Riesgo: color demasiado parecido al músculo si se reduce mucho la saturación. |
| Vena, 58 | `3f62ad`, rug `.30`, esp `.60`, sss `.40`, anis `.30` → `465b83`, `.40`, `.45`, `.26`, `.22` | Azul más sobrio y superficie menos brillante. Riesgo: bajo una luz azul puede bajar demasiado el contraste con el fondo. |
| Nervio periférico, 61 | `e3c23f`, rug `.40`, sss `.30`, anis `.45` → `c6a95f`, `.48`, `.22`, `.30` | Reduce el amarillo intenso sin quitarle identidad cromática. Riesgo: debe comprobarse la lectura en nervios delgados y sobre vasos. |
| Órganos, 62–68 | Respiratorio `d99b9b` → `c88f8d`; digestivo `c98b67` → `b77e62`; urinario `a65d4c` → `955e51`; reproductor `c48aa0` → `ae8290`; endocrino `9a6bc2` → `886eaa`. En general, rugosidad `.30–.40` → `.42–.52`; sss `.45–.55` → `.30–.42` | Paleta menos saturada y menos cerosa, aún separable por sistema. Riesgo: algunos órganos podrían perder separación cromática; revisar en vistas por sistema. |

### Ajustes del grafo maestro

- **Grano que lava el músculo:** línea 565 multiplica color por `1 + grano × 0.25` → probar `0.08`; línea 588 suma el grano a la pendiente normal con `0.6` → `0.25`. El comentario del código ya registra el lavado rosa a cuerpo entero (534–541). **Riesgo:** se pierde algo de microdetalle en primeros planos.
- **Grano a distancia:** línea 600 añade hasta `0.30` a la rugosidad → `0.15`. Reduce el cambio brusco entre primer plano y vista general. **Riesgo:** reflejos algo más visibles de lejos.
- **Oclusión de color:** línea 566 interpola entre `.45` y `1.0` → probar `.60` y `1.0`; el AO de postproceso está en `.7` (906), que bajaría a `.45`. Esto evita pliegues ennegrecidos. **Riesgo:** menos separación en cavidades profundas.
- **Subsurface:** la inversión `opacidad = 1 − dispersión` ya está implementada en 612–616; no la cambiaría. Con los perfiles propuestos, reduzco SSS en hueso, músculo y cartílago para conservar volumen frontal.

### Luz y postproceso

| Archivo:línea | Actual → propuesto | Motivo y riesgo |
|---|---|---|
| `corpus_importar.py`: 809, 879–881 | Principal `200` → `500` de intensidad; color `255,244,230` → `255,248,240`; ángulo de fuente efectivo `6°` → `5°` | Un relleno más moderado dejaría que la luz principal describa el relieve; tono menos naranja. El método `quitar_sol` fija el ángulo en 6° (843), aunque el mapa lo crea inicialmente en 3°. Riesgo: sombras más marcadas y variación de exposición percibida. |
| 809, 883–891 | Relleno `2000` → `1000`; `214,228,255` → `230,236,248`; contraluz `6000` → `1800` | El contraluz actual puede dominar el borde y el relleno frío teñir los tejidos. Mantendría sus posiciones actuales. Riesgo: siluetas menos separadas del fondo. |
| 809, 893–897 | Cielo `1.0` → `.55`; niebla: sin parámetros explícitos → mantenerla muy tenue | Menos luz ambiente plana; evita que la niebla desature la silueta. **No medido:** los valores de color/densidad de niebla no aparecen en este código. Riesgo: sombras más cerradas. |
| 810, 902–905 | Exposición `+2.0` → `+1.5 EV`; viñeta `.35` → `.18`; bloom `.08` → `.03` | La viñeta actual puede oscurecer demasiado el fondo azul casi negro; el bloom puede velar huesos y tendones. Riesgo: la imagen puede quedar oscura; revisar primero con una captura fija. |
| 907 y 900–912 | Gradación no configurada → saturación global `.95`, contraste `1.03`, elevación de sombras neutra | Da una separación tonal más elegante sin depender de un tinte fuerte; el azul del fondo puede conservarse aparte. **Propuesta nueva**, no valor existente. Riesgo: bajar demasiado la saturación afectaría también vasos y órganos. |
| 896–897 | Cielo/atmósfera y niebla, sin color de fondo explícito | Mantendría el fondo azul oscuro, pero subiría ligeramente su nivel para que no se funda con las sombras: azul carbón, no negro puro. **No hay valor actual codificado aquí**; el tono observado proviene de la escena/capturas. Riesgo: si se eleva demasiado, reduce el contraste de venas y nervios. |

## 2. Proporciones

**Método medido:** `manifiesto.json` contiene cajas `b` por pieza, en metros, y está minificado en una línea; `catalog.json` también está en una línea. Usé el eje vertical de la caja para la longitud de huesos largos y la unión de cajas para la columna y el cráneo. Las cajas no son longitudes osteométricas sobre la superficie del hueso. La caja envolvente del músculo **no es su volumen anatómico**: incluye huecos y puede contener varias piezas. Es útil para detectar señales, no para validar el volumen real.

El manifiesto registra **3.944 piezas para hombre y 1.173 para mujer**. Las piezas femeninas incluyen piel y músculos, pero faltan cajas femeninas de muchos huesos y músculos. Por ello, varios valores de mujer no se pueden medir con el mismo alcance.

| Medida (cm) | Hombre | Mujer | Nota |
|---|---:|---:|---|
| Estatura, caja total | 174.4 | 174.4 | La caja femenina también llega a la cabeza y los pies, pero es un conjunto de piezas más incompleto. |
| Fémur, eje vertical | 45.4 | 45.2 | En cajas de ambos lados. |
| Tibia | 35.8 | — | No hay caja femenina para tibia. |
| Peroné | 36.2 | — | No hay caja femenina para peroné. |
| Húmero | 31.7 | 32.0 | Caja de ambos lados; el mayor rango horizontal no es la longitud. |
| Radio | 23.7 | 23.5 | Eje vertical. |
| Cúbito | 25.5 | 25.4 | Eje vertical. |
| Clavícula | 18.0 por lado, diagonal de caja | — | No hay caja femenina de clavícula. |
| Columna C1–sacro | 68.9 | No calculable | Mujer: solo el tramo lumbar disponible mide 32.8 cm; falta la mayor parte de la columna. |
| Anchura biacromial | 34.7, proxy de caja escapular | No calculable | No hay caja de acromion como hito ni cajas femeninas de escápula/clavícula. No equivale a la medición clínica acromion–acromion. |
| Anchura bicrestal | 26.9, proxy de caja de ambos huesos coxales | 27.4, proxy de caja | Es anchura de caja, no distancia entre los puntos de las crestas ilíacas. |
| Cráneo: altura × anchura de caja | 15.7 × 14.8 | No calculable | Unión de huesos craneales listados; no es una medida de cabeza externa. |

**Comparación con referencias y señales de desproporción:**

- **Estatura:** frente a la media ANSUR II de 175.6 cm para hombres y 162.8 cm para mujeres, el modelo hombre está **−0.7%** y el modelo mujer **+7.1%**. ANSUR II estudió 4.082 hombres y 1.986 mujeres militares; sirve como referencia adulta, pero no representa toda la población civil. [ANSUR II y sus datos](https://www.openlab.psu.edu/datasets/ansur2/), [medias de estatura ANSUR II](https://ergoassessment.cam/ansur-2-data-explorer/).
- **Fémur frente a estatura:** como comprobación aproximada, las ecuaciones Trotter–Gleser 1958 (hombres) y 1952 (mujeres) estiman desde longitud femoral máxima. Con las cajas del modelo dan 170.9 cm para hombre y 165.7 cm para mujer. Frente a la estatura de caja, el modelo resulta **+2.0%** y **+5.2%**, respectivamente, respecto a esas estimaciones. El error estándar publicado es de varios centímetros y la caja vertical no es la longitud osteométrica máxima; por tanto, es una señal para revisar, no prueba de desproporción. [Ecuaciones y error estándar](https://academic.oup.com/view-large/408184385), [Trotter–Gleser y límites de la estimación](https://pmc.ncbi.nlm.nih.gov/articles/PMC10213042/).
- **Anchuras:** ANSUR II sí incluye mediciones directas de biacromial y bicristal, pero aquí solo hay cajas óseas; faltan los hitos exactos. No asignaría un porcentaje de desproporción a esos proxies. La medición biacromial de referencia se toma entre ambos acromion, no entre extremos de la caja de las escápulas. [Definiciones de medidas ANSUR II](https://storage.googleapis.com/kagglesdsdata/datasets/504308/932986/ANSUR%20II%20Databases%20Overview.pdf).

**Cajas musculares comparadas con la caja del hueso asociado** —solo hombre salvo glúteo; cifras en litros aproximados (cm³/1.000):

| Músculo | Caja muscular | Caja del hueso asociado | Relación de cajas |
|---|---:|---:|---:|
| Glúteo mayor | 7.69 L | fémures 10.44 L | 0.74; mujer: 7.10 / 10.35 = 0.69 |
| Cuádriceps | No disponible como pieza de sistema muscular | — | El catálogo solo identifica piezas de inserción, que no miden el vientre muscular. |
| Gastrocnemio | 7.10 L | tibias + peronés 8.53 L | 0.83 |
| Deltoides | 9.99 L | húmeros 8.20 L | 1.22 |
| Pectoral mayor | 13.34 L | clavículas 1.13 L | 11.78; la comparación con clavícula sola es anatómicamente pobre, porque no cubre sus inserciones esternales y costales. |

Estas relaciones **no son proporciones anatómicas de volumen**: comparar cajas puede inflar mucho la cifra, especialmente si las piezas están separadas o si el hueso elegido no representa todas las inserciones. Sirven para localizar casos que merecen revisar las mallas.

## 3. Plan priorizado

1. Bajar el grano que afecta al color y a la normal, líneas 565 y 588; el músculo es el caso más evidente en las capturas.
2. Reducir contraluz y relleno, líneas 809–891; mantener la luz principal como fuente dominante.
3. Bajar viñeta y bloom, líneas 904–905; recuperar detalle en el contorno y en hueso/tendón.
4. Llevar hueso a un marfil menos blanco y reducir SSS/poro, línea 52.
5. Desaturar y oscurecer ligeramente músculo, y reducir su fibra/anisotropía, líneas 53 y 73.
6. Separar el perfil de ligamento del perfil de cartílago; ahora se comparte `articular`, línea 54.
7. Suavizar arterias y venas por material, líneas 57–58, preservando una diferencia clara de color.
8. Revisar las proporciones de estatura y fémur contra la referencia: la diferencia femenina es la más marcada, pero las ecuaciones no sustituyen una medición osteométrica.
9. Añadir mediciones directas entre hitos de hombro y pelvis; las cajas actuales no permiten validar biacromial ni bicrestal.
10. Completar o documentar la cobertura femenina de huesos y músculos antes de comparar ambas anatomías.
11. Ajustar la gradación de color y el nivel del fondo después de estabilizar materiales y luces.
12. Validar primero un conjunto de vistas cercano, medio y de cuerpo entero; el grano y la exposición ya muestran dependencia de la distancia de cámara.
