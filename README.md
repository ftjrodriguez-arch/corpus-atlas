# Corpus · Atlas anatómico 3D libre

**Un atlas del cuerpo humano en 3D, gratuito, abierto y en español, para todos los estudiantes y profesionales de la salud.**

👉 **Abrir el atlas:** https://ftjrodriguez-arch.github.io/corpus-atlas/

Funciona en el navegador del ordenador, la tableta o el móvil, sin instalar nada ni crear cuenta. Se puede instalar como app y usar **sin conexión**.

## Qué incluye

- **Hombre** (Z-Anatomy / BodyParts3D): 3.849 estructuras — huesos, músculos con **origen e inserción**, ligamentos, cápsulas, bolsas, fascias, arterias, venas, nervios, linfáticos, encéfalo, médula, vísceras y piel.
- **Mujer** (Visible Human Female, Human Reference Atlas): 866 estructuras — piel, mama y glándula mamaria, pelvis femenina, columna, aparato reproductor, órganos, vasos, encéfalo, médula y ojos.
- **Disección por capas**: de la piel al hueso, paso a paso.
- **Fichas en español** con nombre latino: origen, inserción, inervación, irrigación, acción, biomecánica por plano y eje, prueba muscular manual (Daniels) y nota clínica.
- **Movimiento**: rangos articulares de referencia (AAOS), simulador con deformación del modelo, agonistas, goniometría y registro de mediciones.
- **Planos y ejes** (sagital, frontal, transversal) con cortes, vista de rayos X, modo estudio, relieves óseos, lecciones guiadas y práctica de identificación.
- **Alta resolución** por regiones con las mallas originales del atlas.

## Usar sin conexión

En la pestaña *Capas*, pulsa **«Descargar todo»** (≈47 MB). Después el atlas abre sin internet. Desde el menú del navegador puedes **instalarlo como aplicación**.

## Ejecutar en tu ordenador

```bash
git clone https://github.com/ftjrodriguez-arch/corpus-atlas.git
cd corpus-atlas
python3 -m http.server 8000
# abre http://localhost:8000
```

No hace falta compilar nada: es una sola página (`index.html`) con three.js.

## Estructura

| Carpeta | Contenido |
|---|---|
| `index.html` | La aplicación completa |
| `m2/` | Capas ligeras por sistema (glTF + Draco, en base64) · `f_*` = modelo femenino |
| `hr/` | Mallas originales por región (alta resolución) |
| `data/` | Catálogo, fichas, rig articular, lecciones, relieves óseos, modelo femenino |
| `draco/` | Decodificador Draco |
| `tools/` | Scripts que generan todo lo anterior a partir de las fuentes (ver `tools/README.md`) |

## Cómo contribuir

Este proyecto es un regalo para la humanidad y mejora con cada aporte:

- **Anatomistas, médicos, fisioterapeutas**: revisen las fichas (`data/info.json`, `data/fem.json`) y abran un *issue* o *pull request* con correcciones.
- **Traductores**: ayuden a llevar el atlas al portugués, inglés y otras lenguas.
- **Desarrolladores**: rendimiento, accesibilidad, nuevas lecciones.
- **Docentes**: compartan cómo lo usan en clase.

## Licencias

- **Código** (`index.html`, `sw.js`, `tools/`): MIT — ver `LICENSE`.
- **Modelos y datos** (`m2/`, `hr/`, `data/`): CC BY-SA 4.0 — ver `LICENSE-DATA.md` y `ATTRIBUTION.md`.

Puedes usarlo, copiarlo y adaptarlo libremente, incluso en tu propia app o curso, citando la fuente y compartiendo las mejoras con la misma licencia.

## Aviso

Corpus es un recurso **educativo**. No sustituye la formación clínica, la bibliografía de referencia ni el criterio profesional, y no debe usarse para diagnóstico ni tratamiento.

---

## English

**Corpus** is a free, open 3D human anatomy atlas in Spanish: a male body (Z-Anatomy / BodyParts3D, 3,849 structures with muscle origins and insertions) and a female body (HuBMAP Human Reference Atlas, Visible Human Female, 866 structures), layer-by-layer dissection, clinical cards, joint ranges of motion, planes and axes, and offline use. Code: MIT. Models & data: CC BY-SA 4.0. Run locally with any static web server. Contributions — especially expert review and translations — are very welcome.
