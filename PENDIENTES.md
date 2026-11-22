# Corpus Atlas · pendientes

Índice corto. El detalle está en `unreal/LEEME.md` (estado técnico de la edición Unreal), `unreal/PLAN_SPRINTS.md`
(sprints) y `unreal/AUDITORIA_CADERA_RODILLA.md` (hallazgos clínicos). Trabajo en `X:\corpus atlas`, rama
`ccr-2f1bf474-vuby5r`. La carpeta `C:\Users\Admin\Documents\Proyectos Claude\corpus-atlas` es una copia de `main`
(web v168) y no tiene la edición Unreal: Graphify se construye desde ella.

## Sprint 1 (fémur, cadera y rodilla) — en curso
- [x] Plano de corte, fantasma, pelar capas, panel plegable
- [x] Relieves óseos del fémur y mapa de origen e inserción
- [x] Goniómetro y reproducción suave; vínculo ficha → Estudiar
- [x] Rodilla: rotación automática en los rangos; sentadilla en modo Ejercicio
- [x] Tendones: origen carnoso frente a inserción tendinosa
- [x] Trapecio inferior por encima del dorsal ancho; nombres de sus porciones corregidos en el catálogo
- [ ] Glúteo mayor sin hincharse ni colgar en flexión de cadera y sentadilla
- [x] Muslo continuo en flexión de rodilla: campo común de peso de rodilla (huecos > 5 mm a 135°: 62 → 33; sentadilla 71 → 43). Pendiente de revisión visual del usuario
- [x] Validador de datos (`tools/unreal/validar.js`): 0 errores
- [x] Nombres en francés y alemán: 59 traducciones erróneas de claves en minúscula corregidas (p. ej. «rodilla» → «cadera» en alemán); avisos de mayúsculas 104 → 53, los que quedan son significados distintos

## Sprint 2 (aparato locomotor) — en curso
- [x] Músculos agrupados separados uno a uno (`tools/unreal/separar.js`): intercostales, subcostales, interóseos dorsales de mano y pie, lumbricales de la mano, interóseos plantares y rotadores (C3–L5)
- [ ] Interóseos palmares y lumbricales del pie: modelarlos en Blender (la malla de la web no trae sus formas)
- [x] 10 ejercicios nuevos con postura (zancada, peso muerto, sentarse y levantarse, abducción de cadera, curl, elevación lateral y frontal, press, remo, patada de glúteo), horneados el 2026-11-22 (capturas `ej_*`)
- [ ] Francés y alemán de 30 textos de técnica, progresiones y precauciones de esos ejercicios (salen en inglés): añadirlos a `ejercicios.json → traducciones` y volver a hornear
- [ ] Pruebas ortopédicas con postura (las de paciente tumbado necesitan la raíz del cuerpo acostado)
- [ ] Dedos de mano y pie con movimiento (el rig solo tiene 27 articulaciones y 5 bits por hueco)
- [ ] Cinta de suelo y gráficas de la marcha

## Contenido clínico pendiente de revisión profesional
- Reglas de tendones (`tools/unreal/tendones_reglas.json`), notas de rodilla (`rangos_extra.json`), sentadilla y sus
  traducciones FR/DE (`ejercicios.json`), imprecisiones de `unreal/AUDITORIA_CADERA_RODILLA.md`.

## Siguientes sprints
Ver `unreal/PLAN_SPRINTS.md`: resto del aparato locomotor, talleres de fisiología, examen práctico, empaquetado y
llevar las correcciones a la web en rama aparte.

## Decisiones del usuario (2026-11-22)
- Músculos agrupados (intercostales, interóseos, lumbricales, rotadores): **separarlos uno a uno**.
- Talleres de fisiología: **activar Niagara**.
- Oído interno y riñón de Z-Anatomy (no comercial): **sustituir por modelos con licencia libre**.
- Color del músculo: **rojo más natural, tipo disección** (granate algo apagado).
- Pendiente: quién hace la revisión profesional del contenido.
- Candidatos para sustituir las piezas no comerciales (buscado el 2026-11-22, falta descargar y comprobar):
  riñón de **BodyParts3D 4.0** (DBCLS, licencia actual **CC BY 4.0**, https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html);
  oído interno «Cochlea and vestibular system from MRI data» de NIH 3D (3DPX-002432, **CC BY**) o el laberinto de BodyParts3D.
  Los de Z-Anatomy son el «Anatomy of the Inner Ear» de Dundee (CC BY-NC-SA) y el «Kidney» de Lissie Cowley (CC BY-NC).
