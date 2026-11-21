# Auditoría clínica · fémur, cadera y rodilla (2026-11-20)

Hecha por el agente `director-clinico` leyendo los datos (no vio el modelo). Revisó 33 fichas musculares, 107 relieves
óseos, 7 movimientos de la tabla ROM, 24 ligamentos y 41 entradas del glosario. Fuentes citadas: Gray 42.ª ed., Moore,
Neumann, Kapandji, AAOS, Terminologia Anatomica. **Pendiente de validación por un profesional.**

## Corregido en `data/extras.json` (relieves óseos)
- Líneas supracondíleas lateral y medial del fémur: tenían las posiciones intercambiadas (comprobado con las coordenadas
  de los epicóndilos).
- «Cara semilunar» e «Incisura acetabular» estaban en la lista del fémur: pasan al coxal. La posición de la incisura
  parece demasiado lateral; hay que comprobarla en una captura.
- Sin traducir al español: «Labio lateral / medial de la línea áspera» (además «apera» → «aspera» en inglés),
  «Tercer trocánter (inconstante)» y «Tubérculo obturador posterior».

## Pendiente (no corregido todavía)
**Faltan datos**
- La rótula no tiene relieves (base, vértice, cara anterior, cara articular con sus facetas, bordes).
- No hay ficha del ligamento rotuliano ni del tendón del cuádriceps en `data/info.json`.
- Falta el agujero obturado entre los relieves del coxal.
- La rodilla solo tiene «Flexión» (135°) en la tabla ROM: faltan extensión / hiperextensión (0–10°, cuádriceps) y las
  rotaciones tibiales con la rodilla a 90° (interna 30°, externa 40°).

**Imprecisiones en `data/info.json`** (hay que cambiarlas en los cinco idiomas)
- Gemelo inferior: se inserta en la cara medial del trocánter mayor, no en la fosa trocantérica (esa es del obturador externo).
- Ligamento pubofemoral: se funde con la cápsula y el iliofemoral hacia el cuello, cerca del trocánter menor.
- Aductor mínimo: medial a la tuberosidad glútea, en lo alto de la línea áspera; no figura entre los agonistas de la aducción.
- Psoas mayor: origen T12–L5 según Gray y Moore (la ficha dice T12–L4, que es el criterio de Rouvière).
- Glúteo medio: las fibras anteriores rotan medialmente y las posteriores lateralmente. Sartorio: falta la rotación medial
  de la rodilla flexionada.
- Raíces sin unificar: obturador interno (L5–S2) frente a gemelo superior (L5–S1); reflejo rotuliano L3–L4 en las fichas
  y L2–L4 en el glosario.
- «Tensor fasciae latae» aparece dos veces, una con tipo «otro».

**Imprecisiones en `data/glossary.json`** (español, inglés y portugués)
- Isquiotibiales: debe decir «cabeza larga del bíceps femoral» (la corta no nace en el isquion ni actúa sobre la cadera).
- Rotadores de la cadera: falta el obturador externo; título más exacto «Rotadores laterales de la cadera».
- Condromalacia rotuliana no es sinónimo de síndrome femoropatelar (van como términos relacionados).
- Síndrome de la cintilla iliotibial: «fricción o compresión» (Fairclough 2006).
- Pubalgia: «hernia del deportista» no es sinónimo. Reflejo rotuliano: «Cuádriceps» enlaza solo al recto femoral.

**Terminología sin unificar**
- «Patela / rótula», «fíbula / peroné», «patelar / rotuliano» según el archivo.
- «trocantérea / trocantérica», «intercondilar / intercondílea», «fibula» sin tilde, «ramo» por «rama», «Hueso Fémur»
  con mayúscula, «Tubérculo aductor», «Plano tibial» por «Meseta tibial».

## Lo que encontró correcto
Origen, inserción, nervio y raíces de las 33 fichas musculares (salvo lo anterior); rangos de cadera y flexión de rodilla
iguales a los de la AAOS; agonistas principales; ligamentos cruzados, colaterales, de la cadera y meniscos; y las
entradas clínicas del glosario (Trendelenburg, Lachman, cajones, McMurray, Thomas, Ober, coxartrosis, gonartrosis,
roturas de ligamentos, lesión meniscal, fractura de cadera).

## Sin revisar
Campos `prueba` y `biomecanica`, irrigación, fichas en otros idiomas, relieves distales de tibia y peroné, unas 9
entradas del glosario, `bio.json`, lecciones, casos, marcha y ejercicios, y todo lo visual (tendones, deformaciones).
