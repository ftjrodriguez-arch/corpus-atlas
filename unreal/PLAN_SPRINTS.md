# Corpus Atlas · edición Unreal — auditoría y plan de sprints (2026-11-20)

Pendiente de aprobación del usuario. Hasta entonces no se programa el Sprint 1.

## Fase 1 · Auditoría

### 1. Qué hay en la web que se rescata (y qué está ya migrado)
| De la web (`index.html`, `data/`) | En Unreal |
|---|---|
| Catálogo de 5.158 estructuras, 30 capas, fichas en 5 idiomas, buscador | Migrado |
| Hombre, mujer y Visible Human; corazón HRA; piezas de Blender | Migrado (faltan 10 piezas del corazón) |
| Rangos articulares (14 articulaciones) y agonistas | Migrado y mejorado (tronco repartido, hombro con correctivos) |
| Marcha de laboratorio, 8 patrones, actividad muscular | Migrado (sin cinta de suelo ni gráficas) |
| Lecciones (83), kinesiología (463), casos (90), protocolos (8), variantes (32), glosario (1.503) | Migrado al panel Estudiar |
| Recorridos narrados (84, con sinapsis, nefrona, corazón, respiración) | Solo texto, capas y cámara; **sin animación** |
| Pruebas ortopédicas y ejercicios (`CTESTS`, 92) con técnica y errores (`EJ_TXT`) | Solo texto y estructuras; **sin postura** |
| Relieves óseos (`extras.json` → `lm`, 64 huesos), profundidad de disección (`dep`), regiones (`reg`) | **Sin migrar** |
| Planos de corte, etiquetas y pines, goniómetro manipulable, sentadilla en cadena cerrada | **Sin migrar** |
| ECOE, ASIA, perfil de movilidad, repaso espaciado, exámenes, impresión de lecciones | **Sin migrar** |
| Escenas microscópicas (acino pulmonar), embriones Carnegie, zonas de West y segmentos | **Sin migrar** |

### 2. Estado de Unreal
- Unreal 5.8, un módulo C++ (`CorpusAtlas`, unas 3.000 líneas en 4 clases) e interfaz en Slate. Plugins: Python,
  Interchange, utilidades de edición y modelado. Sin Niagara, CommonUI, Control Rig ni Enhanced Input.
- DX12, Nanite, Lumen con trazado de rayos por hardware y sombras virtuales. Un mapa (`Atlas`) con luz de estudio.
- Flujo de datos reproducible por guiones (`tools/unreal/*.js`, `corpus_importar.py`) y pruebas con capturas
  (`captura.ps1`). Sin empaquetar: solo se ha ejecutado desde el editor.

### 3. Deudas técnicas y gráficas
1. **Sin animación de fisiología** (latido, flujo, respiración, potencial de acción): es el mayor hueco frente a la web.
2. **Sin plano de corte, etiquetas ni goniómetro en pantalla.**
3. **Tendones:** la regla es geométrica; los orígenes carnosos anchos salen blancos y la herramienta no guarda el original.
4. **Músculos agrupados** en una sola malla (intercostales, interóseos, lumbricales, rotadores).
5. **Dedos de mano y pie sin movimiento;** el clic usa la colisión de reposo cuando hay postura.
6. **Materiales:** sin máscara de accidentes óseos, sin mapa de origen e inserción sobre el hueso, sin Fresnel en fascias,
   vasos y nervios sin flujo. El color del músculo aún no está validado por el usuario.
7. **Interfaz:** el panel izquierdo es fijo y ancho, sin paneles plegables; el clic en una estructura no lleva al glosario.
8. **Rendimiento y entrega:** sin medir fotogramas ni memoria; sin empaquetado ni instalador; `correctivos.bin` pesa 92 MB.
9. **Contenido:** sin revisión profesional; glosario sin francés ni alemán; ilustraciones de patologías en inglés.
10. **Web:** las correcciones biomecánicas de Unreal no se han llevado a la web.

## Fase 3 · Plan de sprints
Cada sprint acaba con capturas revisadas, informe del agente `director-clinico` y un commit. Duraciones orientativas.

### Sprint 1 — Corte vertical: fémur y complejo cadera-rodilla
Objetivo: una región completa con la calidad final, que sirva de patrón para el resto del cuerpo.
1. **Entorno y disección.** Plano de corte en vivo (sagital, coronal, axial) en los dos materiales maestros; botón
   «fantasma»; pelar capas por profundidad con `extras.json` → `dep`; paneles plegables para que el modelo ocupe más pantalla.
2. **Fémur piloto.** Relieves óseos de `extras.json` resaltables y con etiqueta (cabeza, cuello, trocánteres, línea
   áspera, tuberosidad glútea, cóndilos, epicóndilos, tróclea); mapa rojo (origen) / azul (inserción) proyectado sobre
   el hueso desde la capa `insercion`; rugosidad diferenciada en las zonas de inserción.
3. **Capas de la región.** Cartílago, ligamentos (cruzados, colaterales, iliofemoral), meniscos, cápsulas, bolsas,
   fascia lata y tracto iliotibial, músculos, arterias, venas y nervios femorales y ciáticos, todos activables, con los
   tendones revisados uno a uno en esta región (origen carnoso frente a inserción tendinosa).
4. **Biomecánica.** Flexión y extensión de rodilla con rotación automática en los últimos 15°, y abducción de cadera,
   con goniómetro en pantalla y reproducción con aceleración suave. Prueba de estrés en valgo como modo aparte.
5. **Musculación.** La sentadilla de la web conectada: postura horneada, fases excéntrica / isométrica / concéntrica,
   músculos por intensidad y texto de técnica y errores.
6. **Diccionario.** Las 40 primeras entradas de la región enlazadas en los dos sentidos (clic en la estructura → entrada;
   término → cámara, capa y resalte), incluidos los relieves óseos.
Criterio de aceptación: tira de capturas de cada punto, lista de comprobación de `ue5-visual-qa` sin fallos e informe
clínico sin errores abiertos.

### Sprint 2 — Extender el patrón a todo el aparato locomotor
Relieves y mapa de origen e inserción en todos los huesos; tendones revisados por regiones; músculos agrupados separados
en Blender; dedos de mano y pie; resto de ejercicios y pruebas ortopédicas con postura; cinta de suelo y gráficas de la marcha.

### Sprint 3 — Talleres de fisiología
Motor común (reproducir, línea de tiempo, paso a paso, velocidad, un parámetro manipulable) y los cinco talleres:
conducción cardíaca con ECG, circulación con saturación de O₂, intercambio alvéolo-capilar, nefrona y sinapsis.
Requiere activar Niagara y modelar las escenas microscópicas en Blender.

### Sprint 4 — Examen práctico y clínica
Examen de identificación en 3D con puntuación, repaso espaciado y progreso guardado en local; ECOE, ASIA y perfil de
movilidad; patologías con modelos propios (hernia discal, placa de ateroma, fracturas) y vídeo opcional.

### Sprint 5 — Acabado y entrega
Medición de rendimiento, empaquetado e instalador para Windows, glosario en francés y alemán, revisión profesional del
contenido, y las correcciones biomecánicas llevadas a la web en rama aparte (se publica solo con aprobación).

## Decisiones que necesito del usuario
1. Criterio de recuento de músculos (¿separar intercostales, interóseos y lumbricales uno a uno?).
2. Color del músculo: validar el actual o dar una referencia.
3. Si se activa Niagara para los talleres (Sprint 3).
4. Quién hará la revisión profesional del contenido.
