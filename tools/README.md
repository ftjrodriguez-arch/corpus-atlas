# Pipeline de datos

Scripts en Python 3 (numpy, scipy, Pillow) y Node (codificador Draco de three.js r128, `examples/js/libs/draco/draco_encoder.js`, Apache 2.0).
No requieren Blender.

## Modelo masculino (Z-Anatomy)
1. Descarga `Startup.blend` de https://github.com/Z-Anatomy/Models-of-human-anatomy (≈307 MB).
2. `extract.py` — lee el .blend con `blend.py` (lector SDNA propio), aplica modificadores espejo y gancho, convierte curvas (vasos, nervios) en tubos → `work/raw.pkl`.
3. `names.py` + `pack.py` — clasifica cada objeto en su sistema y genera el catálogo con nombres TA (español/latín).
4. `subdiv.py` — subdivisión de Loop en estructuras con *Subsurf* y en los huesos → `work/raw3.pkl`.
5. `vattr.py` (+ `tten2.py`) — atributos por vértice: R oclusión ambiental, G tendón (grosor local), B cartílago articular.
6. `repack.py` — capas ligeras por sistema y paquetes regionales de alta resolución (`.bin`).
7. `encode.js` — `node encode.js entrada.bin salida.glb 13` → glTF con KHR_draco_mesh_compression (POSITION + COLOR_0). `verify.js` comprueba la decodificación.
8. `base64 -w0 salida.glb > m2/<sistema>.txt`
9. `bundle.py`, `extras.py` — fichas (`data/info.json`), relieves óseos, profundidad muscular y regiones (`data/extras.json`).

## Modelo femenino (Human Reference Atlas)
1. Descarga `VH_Female/v1.3/VH_F_United.glb.zip` de https://github.com/hubmapconsortium/ccf-3d-reference-object-library y descomprímelo.
2. `vhf_read.py` + `vhf_pack.py` — lee el glb, alinea al marco del atlas, calcula oclusión ambiental, reduce y agrupa en capas `f_*`.
3. `encode.js` y base64 como arriba.
4. `vhf_data.py` — genera `data/fem.json` (catálogo y fichas en español).
