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
- Modelo femenino: realineado al sistema de coordenadas del atlas masculino (traslación), reducido y comprimido; pelvis ósea masculina deformada (thin-plate spline) con las medidas de la pelvis del Visible Human Female.
- Músculos modelados en Blender para Corpus (v140, v141 y v143: músculos de la lengua y del paladar, del oído medio, del periné, auriculares, subcostales, escaleno mínimo y otros), CC BY-SA 4.0.

## Contenido redactado para Corpus · Original content (CC BY-SA 4.0)
- Fichas clínicas, glosario, lecciones guiadas con objetivos y exámenes, casos y razonamiento clínico, kinesiología y biomecánica
  (preguntas, explicaciones y distractores), biblioteca de ejercicios, variantes anatómicas, escenas de ergonomía y nombres en español,
  inglés, portugués, francés y alemán.
- Las cifras citadas en esos textos proceden de la literatura científica indicada en cada uno (p. ej. Bergman's Encyclopedia of Human
  Anatomic Variation para las variantes; Nachemson y Wilke para la presión intradiscal); los hechos no tienen derechos de autor y los textos son propios.

## Datos · Data
- **CDC Normal Joint Range of Motion Study** (Soucie JM et al., *Haemophilia* 2011;17:500-7): rangos articulares por edad y sexo. Obra del Gobierno de EE. UU., dominio público. https://www.cdc.gov/ncbddd/jointrom/

## Software y tipografías · Software and fonts
- three.js r147 (MIT), decodificador Draco de Google (Apache 2.0) y tipografías Spectral, Public Sans y JetBrains Mono (SIL OFL 1.1), incluidos en la app: ver `THIRD_PARTY_LICENSES.md`.

## Privacidad · Privacy
- Sin cuentas ni servidor propio: el progreso se guarda solo en el dispositivo de cada persona.
- Recuento anónimo de visitas con GoatCounter (sin cookies ni datos personales), solo en el sitio público.
