# Corpus Atlas · edición Unreal Engine

Versión de escritorio de alta calidad gráfica. La web (`index.html`) sigue siendo la versión gratuita, ligera y sin conexión;
esta carpeta no se usa en la web.

**Estado (2026-11-20): Fase 1 compilada, importada y probada en el PC con Unreal Engine 5.8**, con capturas en
`unreal/capturas/`. Detalle y pendientes más abajo.

## Pasos en el PC (Windows, Unreal Engine 5.x, Node.js)

1. En la raíz del repositorio: `node tools/unreal/exportar.js`
   Crea `unreal/CorpusAtlas/Importar/` (43 GLB, 5.150 piezas, 12,3 M de triángulos, ~380 MB; no se sube al repositorio).
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
```
Pasos: `foto <nombre>` · `sel <id>` (vacío = ninguna) · `encuadrar` · `aislar` · `ocultar` · `todo` · `vista <0-5>` ·
`capa <clave> <0|1>` · `opacidad <clave> <valor>` · `cuerpo <hombre|mujer|vh>` · `idioma <es|en|pt|fr|de>` ·
`buscar <texto>` · `esperar <s>` · cualquier otro texto se ejecuta como comando de consola (p. ej. `viewmode unlit`).
Las fotos quedan en `unreal/capturas/` con la interfaz incluida.

## Pendiente de la Fase 1
- **Piel del Visible Human** (`f_piel`, una sola malla): no se ve ni opaca ni translúcida; la piel del hombre sí. Revisar esa malla (escala, normales o Nanite).
- **Traducciones de la interfaz Unreal:** vistas («Anterior»…), subtítulo y texto del buscador siguen en español; en alemán las capas de vísceras
  salen sin traducir y «Urinario» aparece como «digestivo» (búsqueda aproximada de `T()`).
- Hueso todavía muy claro de frente con la luz principal; afinar con `ALBEDO`/luces mirando capturas.
- Muaré leve de las estrías al acercarse mucho a un músculo (`EscalaFibra`, factor 2,3).
- Probar con el ratón real (clic, doble clic, arrastrar) y los atajos H, I, F, 1–6: las capturas usan las mismas funciones, pero no el ratón.

## Pendiente de pasar desde la web (por fases)
1. **Atlas:** membranas y piezas semitransparentes, etiquetas y pines, relieves óseos,
   planos de corte, disección por profundidad, piezas solo masculinas por nombre (`MALE_ONLY`), contorno de selección.
2. **Movimiento:** rig (`data/rig.json`, `buildRig`), `deform`, rangos articulares y goniómetro, marcha con datos de
   laboratorio y suelo, sentadilla en cadena cerrada, ejercicios funcionales, actividad muscular por intensidad.
3. **Fisiología:** corazón que late, respiración con costillas, acino pulmonar, zonas de West y segmentos broncopulmonares, recorridos narrados.
4. **Estudio y clínica:** lecciones, kinesiología y biomecánica, casos, protocolos, ECOE, ASIA, variantes, perfil de movilidad, glosario, exámenes.
5. **Acabado:** texturas esculpidas en Blender para músculo y hueso, piel realista, empaquetado e instalador.
