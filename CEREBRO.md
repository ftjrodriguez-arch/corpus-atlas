# CEREBRO — Corpus · Atlas anatómico 3D libre

Archivo de memoria del proyecto. Se lee completo antes de cada tarea y se actualiza al terminarla.
Si algo de aquí cambia, se escribe una decisión nueva en lugar de borrar la anterior.

## Visión
Atlas del cuerpo humano en 3D, gratuito, abierto y en español (también inglés y portugués), para estudiantes y
profesionales de la salud. Funciona en el navegador y sin conexión, sin cuenta. Objetivo: que el movimiento
(rangos articulares, marcha, ejercicio) se vea con realismo y con base científica.

## Usuarios y casos de uso
- Estudiantes de medicina, fisioterapia y ciencias del deporte: explorar, disecar por capas, estudiar, examinarse.
- Fisioterapeutas y entrenadores: rangos articulares, goniometría, marcha normal y patológica, ejercicio funcional, registro de mediciones por paciente.
- Docentes: modo clase, enlaces que abren una vista exacta, exámenes compartidos.

## Stack decidido
- Una sola página `index.html` (≈2,8 MB) con three.js r147 (`lib/`), GLTFLoader y decodificador Draco. Sin compilación.
- Modelos por sistema en `m2/*.txt` (glTF + Draco en base64); mallas de alta resolución por región en `hr/`.
- PWA: `sw.js` (versión `V` de la app y `MV` de los modelos) y `manifest.webmanifest`.
- Publicación: GitHub Pages desde `main` (`.github/workflows/pages.yml`) → https://ftjrodriguez-arch.github.io/corpus-atlas/
- `dev/index.html`: copia de pruebas con `window.__T` para medir en el navegador (sin indexar).
- Datos generados por scripts Python/Node en `tools/` (ver `tools/README.md`), sin Blender.

## Design system
- Tokens en CSS variables (`--bg`, `--panel`, `--panel2`, `--ink`, `--muted`, `--line`, `--accent`, `--ok`, `--warn`, `--bad`, colores de planos `--sag`, `--fro`, `--tra`).
- Componentes: `.card`, `.btn`, `.chips`, `.patchips` (selector en píldoras), `.seg`, `.tbl`, `.gaitBar` (barra de fases), `.gm` + `.ty.exc|con|iso` (músculo y tipo de contracción), `.refs` (fuentes).
- Estilo «Atlas» (predeterminado en equipos capaces): fondo negro, piel fantasma, músculo rojo con fibras, tendones nacarados, hueso marfil.
- Tipos de contracción: excéntrica naranja `#f0a040`, concéntrica `--ok`, isométrica `--accent`.

## Modelo de datos
- `data/catalog.json`: lista `[id, en, es, la, sistema, lado, …]` de 4.715 estructuras.
- `data/rig.json`: puntos articulares y marcas (hombro, codo, muñeca, cadera, rodilla, tobillo, talón, punta del pie, escápula, columna, ATM…).
- `data/info*.json` fichas (es/en/pt), `lessons*.json`, `cases*.json`, `glossary.json`, `extras.json` (relieves, profundidad, regiones), `fem.json` (modelo femenino).
- Almacenamiento local (`store`): preferencias, registro de mediciones por paciente (`log`), perfil de movilidad de la sentadilla (`sqProf`).

## Arquitectura del movimiento
- `buildRig()` crea `JOINTS[nombre]` con pivote y ejes (ISB en hombro; rodilla en los cóndilos; tobillo de Inman y subastragalina).
- `qOf(joint,{x,y,z,w})`: orden clínico flexión → abducción → rotación sobre el eje largo ya colocado.
- `deform(active)`: deforma las mallas reales alrededor de cada pivote; huesos rígidos; músculos que cruzan la articulación se curvan y no atraviesan el hueso (hombro v134).
- `applyPose()` decide quién manda: marcha (`gaitActive`), sentadilla (`sqActive`) o el simulador de rango (`comps(angle)`).
- La pelvis es la raíz del rig. En la sentadilla la anteversión pélvica se aplica girando el grupo `body` entero y desplazándolo para que los pies no se muevan (`sqRoot`).
- Módulos de movimiento: Rango articular (ROM, ROM_ADD, ROM_NEW, ROM_LIG), Ciclo de la marcha (GAIT_K/PH/M + patrones), Sentadilla (SQ_*), Pruebas clínicas (CT), Fisiología animada (PHY).

## Assets 3D
| Fuente | Uso | Licencia | Estado |
|---|---|---|---|
| Z-Anatomy (`Startup.blend`) | Modelo masculino completo, 3.849 estructuras | CC BY-SA 4.0 | Integrado (extracción propia, sin Blender) |
| HuBMAP VH_F_United v1.3 | Modelo femenino, 866 estructuras | CC BY 4.0 (redistribuido CC BY-SA) | Integrado; sin esqueleto articulado |
| BodyParts3D | Origen del anterior | CC BY-SA 2.1 JP / CC BY 4.0 | Vía Z-Anatomy |
| Mixamo | No se usa | — | Descartado por ahora: el rig propio ya mueve las mallas reales |

## Criterios de movimiento

### Rangos de referencia por edad y sexo (CDC Normal Joint ROM Study, Soucie et al. 2011; media de grupo, grados)
| Movimiento | M 20–44 | F 20–44 | M 45–69 | F 45–69 |
|---|---|---|---|---|
| Flexión de cadera | 130,4 | 133,8 | 127,2 | 130,8 |
| Extensión de cadera | 17,4 | 18,1 | 13,5 | 16,7 |
| Flexión de rodilla | 137,7 | 141,9 | 132,9 | 137,8 |
| Dorsiflexión (pasiva, sin carga) | 12,7 | 13,8 | 11,9 | 11,6 |
| Flexión plantar | 54,6 | 62,1 | 49,4 | 56,5 |
| Flexión de hombro | 168,8 | 172,0 | 164,0 | 168,1 |
| Flexión de codo | 144,6 | 150,0 | 143,5 | 148,3 |
| Pronación | 76,9 | 82,0 | 77,7 | 80,8 |
| Supinación | 85,0 | 90,6 | 82,4 | 87,2 |
Grupos 2–8 y 9–19 también en el código (`SQ_CDC`). Los máximos del simulador siguen la AAOS (tabla `ROM`).

### Sentadilla con peso corporal (bilateral, talones apoyados, pies a la anchura de hombros)
Modelo: tobillo = 27 % de la flexión de rodilla hasta el tope en carga de la persona; muslo θ = K − A; cadera tal que el
centro de masas (Winter) quede sobre el centro del pie; pelvis T = H − θ; si la cadera llega a su tope, la columna lumbar aporta el resto.
| Criterio | Objetivo | Cómo se mide |
|---|---|---|
| Pies quietos | deslizamiento < 5 mm, despegue < 5 mm en talón y punta | marcas `heel_*`, `toe_*` en coordenadas de mundo |
| Profundidad «paralela» | muslo ≈ horizontal (θ ≈ 90°) | ángulo cadera–rodilla respecto a la horizontal |
| Rodilla (paralela) | 110–125° | solver |
| Dorsiflexión en el fondo | 25–38° (tope personal) | solver |
| Inclinación del tronco | 30–50° respecto a la vertical | solver (T + flexión lumbar) |
| Columna | neutra salvo tope de cadera (aviso) | flexión lumbar L |
| Rodillas | sobre la línea del pie (sin valgo) | distancia lateral rodilla–línea talón→punta |
| Equilibrio | centro de masas sobre el centro del pie ±20 mm | `sqCOM` |
| Malla | sin NaN; músculos del muslo y pierna < 3 % de vértices dentro del hueso | prueba de `dev/musq.js` adaptada |
Pendiente de revisión clínica: el 27 %, el 38° de dorsiflexión en carga y las tolerancias. Algunas fuentes de cinemática de la sentadilla no se pudieron leer completas (PMC bloquea lectores automáticos).

## Convenciones
- Idioma de la interfaz y del código comentado: español; textos visibles con `TL(es,en,pt)`.
- Nombres de estructuras: los del atlas en inglés (`c.en`) como clave; nombres TA en español/latín para mostrar.
- Versiones: cada publicación sube `vNNN` en el commit, en `const V` de `sw.js` y en el README.
- Commits pequeños y descriptivos en español («v140: …»).
- Verificación visual obligatoria antes de publicar cualquier cambio de movimiento (`qa/visual/`).

## Decisiones
- 2026-11-03 · Sentadilla en cadena cerrada dentro de Movimiento, con la pelvis como raíz que gira y se desplaza · Motivo: pies fijos, que es lo que define el ejercicio · Descartado: animación de marcha in situ (los pies se deslizarían).
- 2026-11-03 · Postura resuelta por equilibrio del centro de masas y topes personales, no por fotogramas fijos · Motivo: que cada persona vea su propia sentadilla (tobillo rígido → más inclinación; cadera limitada → flexión lumbar) · Descartado: curvas promedio de un estudio.
- 2026-11-03 · Rangos por edad y sexo del CDC (Soucie 2011) · Motivo: datos abiertos de >600 personas sanas, por grupo de edad y sexo · Descartado: solo AAOS (no distingue edad ni sexo).
- 2026-11-03 · Gancho `window.__qa` solo con `?qa` en la URL · Motivo: medir y capturar sin exponer nada al usuario normal.

## Registro de verificación
(fecha · elemento · iteraciones · defectos corregidos · pendientes)

## Estado actual
- Hecho (v139): atlas completo, disección, fichas, glosario, lecciones, casos, pruebas clínicas, rangos articulares con goniómetro, marcha normal y patológica, fisiología animada, 3 idiomas, PWA.
- En curso: sentadilla personalizada (v140) con bucle de verificación visual.
- Siguiente: usar las mediciones guardadas del paciente para rellenar su perfil de movilidad; más ejercicios en cadena cerrada (zancada, peso muerto, puente); intensidad de activación muscular continua (no solo activo/inactivo).

## Deuda y riesgos
- `index.html` de 2,8 MB en un solo archivo: difícil de mantener; dividir en módulos cuando se pueda sin romper la app sin conexión.
- El modelo femenino no tiene rig: la sentadilla y la marcha solo funcionan en el masculino.
- Fichas en inglés y portugués con traducción automática pendiente de revisión.
- Las tolerancias de la sentadilla necesitan revisión de un fisioterapeuta.
