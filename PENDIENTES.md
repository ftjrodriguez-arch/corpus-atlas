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
- [ ] Muslo continuo (sin tiras) en flexión de rodilla
- [ ] Validador de datos (`tools/unreal/validar.js`)
- [ ] Nombres de articulaciones en francés y alemán (claves que solo difieren en mayúsculas)

## Contenido clínico pendiente de revisión profesional
- Reglas de tendones (`tools/unreal/tendones_reglas.json`), notas de rodilla (`rangos_extra.json`), sentadilla y sus
  traducciones FR/DE (`ejercicios.json`), imprecisiones de `unreal/AUDITORIA_CADERA_RODILLA.md`.

## Siguientes sprints
Ver `unreal/PLAN_SPRINTS.md`: resto del aparato locomotor, talleres de fisiología, examen práctico, empaquetado y
llevar las correcciones a la web en rama aparte.

## Decisiones del usuario pendientes
- Criterio de recuento de músculos (separar intercostales, interóseos y lumbricales).
- Color del músculo. Activar Niagara para los talleres. Quién revisa el contenido.
- Piezas de Z-Anatomy con licencia no comercial (oído interno, riñón): sustituir o dejar declaradas.
