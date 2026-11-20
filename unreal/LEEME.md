# Corpus Atlas · edición Unreal Engine

Versión de escritorio de alta calidad gráfica. La web (`index.html`) sigue siendo la versión gratuita, ligera y sin conexión;
esta carpeta no se usa en la web.

**Estado: primera fase escrita en la nube, sin compilar ni abrir en Unreal todavía.** El exportador de modelos sí está
ejecutado y comprobado. El código C++ y el script de Python hay que compilarlos y ajustarlos en el PC con Unreal.

## Pasos en el PC (Windows, Unreal Engine 5.x, Node.js)

1. En la raíz del repositorio: `node tools/unreal/exportar.js`
   Crea `unreal/CorpusAtlas/Importar/` (43 GLB, 5.123 piezas, 12,1 M de triángulos, ~380 MB; no se sube al repositorio).
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
| Cuerpo | `CorpusCuerpo` | Una malla Nanite por estructura; capas, opacidad, hombre / mujer / Visible Human, seleccionar, ocultar, aislar, color de estado por pieza. |
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

## Dudas que solo se resuelven al abrirlo
- Compilación del C++ (API de la versión instalada) y del grafo del material.
- Orientación: se supone que el importador glTF deja el cuerpo mirando a +Y con la cabeza en +Z.
- Que la importación conserve el color por vértice sin corrección de gamma y la tangente con Nanite.
- Exposición e intensidad de las luces.

## Pendiente de pasar desde la web (por fases)
1. **Atlas:** color propio de cada órgano (`TINT`), membranas y piezas semitransparentes, etiquetas y pines, relieves óseos,
   planos de corte, disección por profundidad, piezas solo masculinas por nombre (`MALE_ONLY`), contorno de selección.
2. **Movimiento:** rig (`data/rig.json`, `buildRig`), `deform`, rangos articulares y goniómetro, marcha con datos de
   laboratorio y suelo, sentadilla en cadena cerrada, ejercicios funcionales, actividad muscular por intensidad.
3. **Fisiología:** corazón que late, respiración con costillas, acino pulmonar, zonas de West y segmentos broncopulmonares, recorridos narrados.
4. **Estudio y clínica:** lecciones, kinesiología y biomecánica, casos, protocolos, ECOE, ASIA, variantes, perfil de movilidad, glosario, exámenes.
5. **Acabado:** texturas esculpidas en Blender para músculo y hueso, piel realista, empaquetado e instalador.
