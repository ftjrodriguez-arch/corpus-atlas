# Módulo «Patologías»: fuentes abiertas, clasificación y lista inicial

Investigación del 2026-11-20 (solo web). Todavía no hay nada programado ni descargado. Cada licencia va marcada como
**[V]** leída en la página o en la API oficial, **[B]** vista solo en resultados de búsqueda, **[I]** de memoria.
Antes de usar un medio, comprobar su licencia en su ficha y anotarla en `ATTRIBUTION.md`.

## Lo que cambia el plan
- **OpenStax ya no es CC BY**: Anatomy & Physiology 2e dice hoy CC BY-NC-SA 4.0 [V]. Sus figuras subidas a Wikimedia
  Commons en 2013–2016 siguen siendo CC BY 3.0/4.0 [V]: cogerlas de Commons, no de openstax.org.
- **No sirven**: Radiopaedia (CC BY-NC-SA modificada [B]), StatPearls (prohíbe redistribuir [B]), imágenes A.D.A.M. de
  MedlinePlus [V], WikiDoc (licencia contradictoria [B]), textos de Orphanet (sin verificar).
- **ICD-11 es CC BY-ND 3.0 IGO** [V]: se puede citar el código, no adaptar ni traducir el árbol.
- **Mejor fuente de vídeo**: animaciones de Osmosis en Commons, CC BY-SA 4.0 [V]. Pesan decenas de MB: pocos y recomprimidos.
- Recomendación: **excluir todo lo NC**, no mantenerlo aparte (la edición de escritorio podría considerarse comercial).

## Fuentes de imagen, por orden de uso
1. **Blausen Medical en Commons** (archivos «Blausen NNNN …»), CC BY 3.0 [V]: cubre unas 40 de las ~100 patologías con estilo uniforme.
2. **Figuras OpenStax A&P en Commons** (autor «OpenStax College»), CC BY 3.0/4.0 [V].
3. **Dominio público de EE. UU.**: CDC PHIL (cada ficha dice «Public Domain» o «Copyright Protected» [V]), NIH/NHLBI/NCI [B].
4. **Servier Medical Art** (smart.servier.com), CC BY 4.0 [V]: para digestivo, renal y endocrino.
5. Diagramas de M. Häggström (CC0/PD) y de Cancer Research UK (CC BY-SA 4.0 [I]) en Commons.
6. Vídeos de Osmosis en Commons (CC BY-SA 4.0 [V]).
- Filtro en Commons: `haslicense:unrestricted`, `haslicense:attribution`, `haslicense:share-alike`. Licencia por archivo:
  `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&iiextmetadatafilter=LicenseShortName|Artist&titles=File:…`
  (sirve para generar las atribuciones).
- **3D**: en Sketchfab hay fracturas, escoliosis y aneurismas con CC Attribution, pero muchos salen de TC de pacientes sin
  consentimiento visible. Mejor **modelar la patología en Blender sobre las mallas propias** (hernia discal, placa de ateroma,
  osteofitos, fractura).

## Texto
- **MedlinePlus** (resúmenes de temas de salud): dominio público [V], en inglés y español. La enciclopedia A.D.A.M. queda fuera.
- **Wikipedia** (CC BY-SA 4.0 [I]) en los 5 idiomas: exige atribuir e indicar cambios; lo derivado queda CC BY-SA.
- **Wikidata** (CC0 [I]): nombres en los 5 idiomas e identificadores.
- Propuesta: descripciones propias de 60–100 palabras con un campo `src` por entrada.

## Clasificación
Árbol propio por sistemas (los del atlas). Cada entrada con `mesh` (descriptor MeSH, redistribuible citando a NLM [V]),
`wd` (Wikidata) e `icd11` opcional (solo el código, sin modificar, con la cita de la OMS).

## Lista inicial (patología → estructuras del atlas que se resaltan)
- **Neurológica:** ictus isquémico (arteria cerebral media, carótida interna), ictus hemorrágico (ganglios basales, ventrículos),
  Parkinson (sustancia negra, estriado), esclerosis múltiple (sustancia blanca, nervio óptico, médula), lesión medular (médula y
  vértebras por nivel; enlazar con ASIA), ELA, parálisis cerebral, Alzheimer (hipocampo), túnel carpiano (nervio mediano,
  retináculo flexor), lesiones periféricas (radial, cubital, peroneo, plexo braquial), ciática (raíces L4–S1), aneurisma cerebral.
- **Musculoesquelética:** rotura del manguito rotador, capsulitis adhesiva, epicondilitis lateral, rotura del LCA, lesión
  meniscal, esguince de tobillo, tendinopatía aquílea, fascitis plantar, rotura de isquiosurales, síndrome femoropatelar,
  Dupuytren, distrofia muscular.
- **Esquelética y articular:** hernia discal lumbar, escoliosis, artrosis de rodilla y cadera, artritis reumatoide, osteoporosis,
  fracturas por tipo, fractura de cadera, fractura de Colles, espondilitis anquilosante, gota, espondilolistesis, hipercifosis.
- **Cardíaca:** infarto, enfermedad coronaria, insuficiencia cardíaca, estenosis aórtica, valvulopatía mitral, miocardiopatía
  dilatada, fibrilación auricular, taponamiento y pericarditis, cardiopatías congénitas, endocarditis.
- **Pulmonar:** EPOC y enfisema (enlazar con `micro/acino.html`), asma, neumonía, neumotórax, embolia pulmonar, cáncer de pulmón,
  fibrosis pulmonar, fibrosis quística, derrame pleural, tuberculosis.
- **Digestiva:** reflujo y hernia de hiato, úlcera péptica, cirrosis, colelitiasis, pancreatitis, Crohn y colitis ulcerosa,
  apendicitis, diverticulosis, cáncer colorrectal, hernia inguinal.
- **Renal y urinaria:** litiasis, enfermedad renal crónica, poliquistosis, hidronefrosis, pielonefritis, hiperplasia de próstata,
  incontinencia y suelo pélvico, síndrome nefrótico, cáncer de vejiga, vejiga neurógena.
- **Endocrina:** diabetes 1 y 2, bocio e hipertiroidismo, hipotiroidismo, Cushing, Addison, acromegalia, hiperparatiroidismo,
  síndrome metabólico.
- **Vascular:** aterosclerosis, aneurisma de aorta abdominal, disección aórtica, trombosis venosa profunda, varices, arteriopatía
  periférica, hipertensión, linfedema, estenosis carotídea, Raynaud.
- **Otras:** cáncer de mama, metástasis óseas, linfoma, quemaduras, dolor crónico.

## Imágenes ya localizadas (Commons; licencia leída por la API)
`https://commons.wikimedia.org/wiki/File:` + nombre. Blausen = CC BY 3.0 salvo que se indique.
- Neuro: Blausen_0836_Stroke.png · 1602_The_Hemorrhagic_Stroke-02.jpg (CC BY 3.0) · MCA_Territory_Infarct.svg (CC BY-SA 3.0) ·
  Blausen_0704_ParkinsonsDisease.png · Blausen_0017_AlzheimersDisease.png · Symptoms_of_multiple_sclerosis.svg (PD) ·
  Carpal_Tunnel_Syndrome.png · Multiple_sclerosis.webm (CC BY-SA 4.0) · CDC_video_about_stroke_2.ogv (PD).
- Esquelética: Blausen_0484_HerniatedLumbarDisc.png · Blausen_0785_Scoliosis_01.png · Osteoarthritis_left_knee.jpg (CC BY-SA 3.0) ·
  Blausen_0686_Osteoporosis_01.png · 612_Types_of_Fractures.jpg (CC BY 4.0) · 613_Stages_of_Fracture_Repair.jpg (CC BY 3.0) ·
  Hip_fracture_classification.png (CC0) · Colles_fracture.JPG (CC BY 3.0).
- Partes blandas: Ankle_sprain.jpg (CC BY-SA 2.0) · Dupuytren's_contracture.jpg (CC BY-SA 3.0) · Knee_diagram.svg (PD).
  `Rotator_cuff_tear.jpg` tiene procedencia dudosa: no usar sin revisar.
- Cardíaca: Blausen_0463_HeartAttack.png · Blausen_0259_CoronaryArteryDisease_02.png · Blausen_0040_AorticStenosis.png ·
  Blausen_0648_MitralValveStenosis.png · Blausen_0165_Cardiomyopathy_Dilated.png · Heart_failure.webm (CC BY-SA 4.0).
- Pulmonar: Blausen_0343_Emphysema.png · Copd_2010Side.JPG (PD) · Blausen_0742_Pneumothorax.png · Blausen_0619_LungCancer.png ·
  Pulmonary_embolism.jpg (CC BY 2.0).
- Renal: Kidney_stones.jpg (CC BY-SA 4.0) · Polycystic_kidneys,_gross_pathology_CDC_PHIL.png (PD) · Hydronephrosis.png (CC BY-SA 3.0).
- Endocrina: Main_symptoms_of_diabetes.svg (PD) · Blausen_0534_Goiter.png · Cushing's_syndrome.png (CC0).
- Vascular: 2113ab_Atherosclerosis.jpg (CC BY 3.0) · Aortic_aneurysm.jpg (PD) · Deep_vein_thrombosis_of_the_right_leg.jpg
  (CC BY-SA 3.0) · Varicose_veins.jpg (PD).
- **Sin imagen todavía**: casi todo el digestivo, ELA, lesión medular, LCA, menisco, Aquiles, fascitis plantar, gota,
  fibrilación auricular, neumonía, tuberculosis, acromegalia, disección aórtica. Se pueden resolver resaltando las estructuras
  en el propio atlas.

## Riesgos
- Aviso fijo en los 5 idiomas: contenido educativo, no sustituye el diagnóstico ni el tratamiento profesional.
- Nada de fotos con rostro o tatuajes, radiografías con datos del paciente ni modelos de TC sin consentimiento.
- Guardar por cada medio: URL, autor, licencia y fecha de consulta (las licencias cambian; la copia obtenida conserva la suya).
- Los recortes y traducciones de imágenes CC BY-SA quedan CC BY-SA.
- Vídeos fuera del núcleo sin conexión (descarga opcional, como las mallas de alta resolución).

## Sin verificar
Radiopaedia, StatPearls, Open-i, NCI Visuals, Orphanet y Wellcome no se pudieron abrir (datos de búsqueda o de memoria).
La licencia de cada modelo de Sketchfab solo se vio por la API. No se descargó ni se inspeccionó ningún archivo.
