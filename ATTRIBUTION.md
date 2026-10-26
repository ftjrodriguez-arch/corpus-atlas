# Atribución · Attribution

## Modelo masculino · Male model
- **Z-Anatomy** — *Models of human anatomy*, CC BY-SA 4.0. https://github.com/Z-Anatomy/Models-of-human-anatomy
- Derivado de **BodyParts3D**, © The Database Center for Life Science (DBCLS), licenciado por CC Atribución-CompartirIgual 2.1 Japón (versiones posteriores de BodyParts3D: CC BY 4.0). https://dbarchive.biosciencedbc.jp/en/bodyparts3d/
- Nombres en español y latín: Terminologia Anatomica (FIPAT), vía la tabla TA2 incluida en Z-Anatomy.

## Modelo femenino · Female model
- **HuBMAP Human Reference Atlas — 3D Reference Object Library**, *Visible Human Female, VH_F_United v1.3*, CC BY 4.0.
  https://github.com/hubmapconsortium/ccf-3d-reference-object-library · https://humanatlas.io
  Basado en el conjunto de datos *Visible Human Project®* de la U.S. National Library of Medicine.
  Placenta y modelo de ganglio linfático de Yao excluidos.

## Adaptaciones realizadas por Corpus · Adaptations
- Extracción de las mallas del archivo `Startup.blend` de Z-Anatomy con un lector propio (sin Blender), aplicación de modificadores espejo y gancho.
- Subdivisión de Loop en las estructuras que el atlas define con superficie de subdivisión y en los huesos.
- Reducción de mallas por agrupamiento de vértices para la versión ligera; mallas originales en `hr/`.
- Atributos por vértice calculados para Corpus: oclusión ambiental, tendón/aponeurosis y cartílago articular.
- Compresión Draco (KHR_draco_mesh_compression) y codificación base64.
- Modelo femenino: realineado al sistema de coordenadas del atlas masculino (traslación), reducido y comprimido.
- Fichas clínicas, biomecánica, pruebas musculares, lecciones y nombres en español redactados para Corpus (CC BY-SA 4.0).

## Software
- three.js r128 (MIT) y su decodificador Draco (Apache 2.0, Google), cargados desde cdnjs/jsDelivr y `draco/`.
