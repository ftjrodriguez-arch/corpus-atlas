# Ajustes propuestos para los skills `ue5-anatomia-biomecanica-aaa` y `ue5-motor-y-calidad-visual`

Están en la cuenta de claude.ai del usuario y Claude no puede editarlos. Estos son los cambios para que no contradigan
lo aprobado en `CLAUDE.md` («Edición Unreal: reglas de producción», fases «adaptadas» del 2026-11-20). Basta con
sustituir los párrafos indicados.

## En los dos skills, apartado «0. Antes de empezar»
Sustituir la ruta y el archivo de pendientes por:
> El proyecto está en `X:\corpus atlas`, rama `ccr-2f1bf474-vuby5r` (la carpeta `C:\Users\Admin\Documents\Proyectos
> Claude\corpus-atlas` es una copia de `main` con la web y no tiene la edición Unreal). Leer `PENDIENTES.md`,
> `unreal/LEEME.md` y `unreal/PLAN_SPRINTS.md` antes de tocar nada.

## `ue5-anatomia-biomecanica-aaa`
- **§1 Arquitectura de datos.** Cambiar «Todo va en JSON bajo `Content/Data/` y se importa a `UDataTable`» por:
  > Todo va en JSON: los de `data/` (compartidos con la web) y los generados por `tools/unreal/*.js` en
  > `Content/Datos`, que lee `UCorpusDatos`. No se convierten a `UDataTable` (romperían el vínculo con la web).
  > El validador es `node tools/unreal/validar.js`.
  Las tablas `DT_*` pasan a describir **qué campos** debe tener cada JSON, no recursos de Unreal.
- **§3 Biomecánica.** Cambiar «Control Rig» por:
  > El movimiento se hornea desde la web (`tools/unreal/movimiento.js`) y la GPU deforma las mallas Nanite. Las reglas
  > de acoplamiento (ritmo escapulohumeral, rotación automática de la rodilla) van en ese generador y en sus JSON.
- **§4 Musculación.** `DT_Ejercicios` → `tools/unreal/ejercicios.json`.

## `ue5-motor-y-calidad-visual`
- **§1 Sockets.** Las áreas de origen e inserción ya existen como piezas de la capa `insercion` (y `inserciones.json`
  dice a qué hueso pertenece cada una); no hace falta crear Sockets en Blender.
- **§1 Modularidad.** Mantener las cuatro clases actuales (`UCorpusDatos`, `ACorpusCuerpo`, `ACorpusJugador`,
  `SCorpusInterfaz`) y separar en módulos solo cuando una crezca demasiado.
- **§1 Plano de corte.** Ya existe como `MPC_Corte` (no `MPC_ClippingPlane`).
- **§2 Interfaz y cámara.** Cambiar «CommonUI / UMG» y «Enhanced Input» por:
  > Interfaz en Slate (`SCorpusInterfaz`) y cámara con entrada directa (`ACorpusJugador`). No migrar sin una razón medible.
  Cambiar «tablas de cadenas (String Tables)» por: textos traducidos con `UCorpusDatos::T()` desde los JSON de idioma de la web.
- **§3 Capturas.** Las capturas se guardan en `unreal/capturas/` (no en `Verificacion/`), con `unreal/captura.ps1`,
  `hoja.ps1` y `mosaico.ps1`.
- **§4 Graphify.** El script `_graphify\actualizar_grafos.py --proyecto corpus-atlas` construye el grafo desde la copia de
  `C:`; para que refleje la edición Unreal hay que actualizar esa copia o apuntar el script a `X:\corpus atlas`.

Lo que estos skills aportan y ya se ha incorporado a `.claude/skills/ue5-anatomia-aaa` y `ue5-visual-qa`: TA2,
`fuente` y `estado` por dato clínico, validador, color nunca como única señal (daltonismo), medir rendimiento con
`stat unit` / `stat gpu`, probar la interfaz en varias resoluciones y antes/después lado a lado.
