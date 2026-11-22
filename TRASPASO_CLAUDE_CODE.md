# Traspaso a Claude Code · Corpus Atlas edición Unreal (2026-11-22)

Viene de una conversación de Claude en el chat (desde el teléfono del usuario). Todo lo hecho está en git (rama
`ccr-2f1bf474-vuby5r`), en `PENDIENTES.md`, en `unreal/LEEME.md` y en la memoria de Graphify. **Escribir siempre en español.**

## Lo primero: terminar el arreglo del dorsal ancho (sin compilar todavía)
El usuario vio el dorsal ancho deformado en la elevación lateral y el press. Causa: los correctivos elásticos del hombro
solo se aplicaban en el modo Rango articular. Ya está hecho, falta compilar y comprobar:
- `CorpusCuerpo.cpp/.h`: `PonerCorrectivo(const FString& Rom, …)`; en `PonerEjercicio` se llama con `"ej:" + E->Id`
  (los dos lados a la vez) y se apaga al salir del ejercicio.
- `tools/unreal/correctivos.js`: orden nueva `hornear-ejercicios [ids]`; ya horneados latraise, press, frontraise, row,
  deadlift y curl (`Importar/datos/correctivos.*`, 230 MB; copia anterior en `Importar/antes_correctivos/`).
- Ejecutar `unreal\claude_tarea.ps1` (compila, `ci.copiar_datos()` y capturas `dor_*`). Revisar las capturas por detrás y
  por delante: el dorsal no debe abultarse. Comprobar que `dor_rom_abd150` sigue igual que antes.

## Hecho hoy
- Rodilla con campo común de pesos (`cadera.js → campoRodilla`): huecos del muslo a 135° 62 → 33.
- Músculos agrupados separados uno a uno (`tools/unreal/separar.js`; C++ `FCorpusPieza::EnPropio`).
- Color del músculo granate de disección (`ALBEDO 0.62`, `DESATURAR 0.36`).
- Correcciones clínicas de cadera y rodilla en 5 idiomas; 59 traducciones FR/DE arregladas.
- 10 ejercicios nuevos con postura (fuente «ct» en `movimiento.js`, `ejercicios.json`), horneados y comprobados.
  Para volver a hornearlos: `unreal/claude_tarea` de esa tarea está en git (commit a4b007d): servidor `py -m http.server 8765`,
  Playwright en `%LOCALAPPDATA%\corpus-playwright` (`NODE_PATH`), `node tools/unreal/movimiento.js --solo-ejercicios`.

## Siguiente (por orden)
1. Francés y alemán de 30 textos de los ejercicios (`ejercicios.json → traducciones`) y volver a hornear.
2. Pruebas ortopédicas con postura (las de paciente tumbado necesitan la raíz acostada).
3. Interóseos palmares y lumbricales del pie: modelarlos en Blender.
4. Dedos con movimiento; cinta de suelo y gráficas de la marcha.
5. Sprint 3 (talleres de fisiología con Niagara), Sprint 4 (examen 3D, ECOE, ASIA, patologías), Sprint 5 (sustituir
   riñón y oído interno por BodyParts3D / NIH 3D, empaquetar e instalador). Ver `unreal/PLAN_SPRINTS.md`.

## Decisiones del usuario (2026-11-22)
Separar músculos uno a uno · activar Niagara · sustituir las piezas no comerciales · granate de disección.
Pendiente de su revisión visual: glúteo mayor en flexión de cadera (punto K del LEEME).

## Reglas del usuario
- Tras cada cambio: `python "X:\proyectos claude\_graphify\actualizar_grafos.py" --proyecto corpus-atlas --nota "qué y por qué"`.
- Antes de dar algo por bueno: compilar, capturar y mirar las capturas.
