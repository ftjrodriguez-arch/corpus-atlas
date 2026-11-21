// Corpus Atlas (edición Unreal) — módulos de estudio: convierte los datos de la web a un formato único que lee el panel
// «Estudiar» de Unreal (SCorpusInterfaz). Un archivo por idioma: Importar/datos/estudio_<es|en|pt|fr|de>.json, más
// estudio_vistas.json (lo que enseña cada paso de los recorridos: capas, piezas, cuerpo y cámara) y la carpeta estudio_img.
//
//   node tools/unreal/estudio.js            → genera en Importar/datos y copia a Content/Datos
//
// Entradas: data/*.json (lecciones, bio, glosario, casos, rc, protocolos, variantes, i18n, content_fr/de),
// tools/unreal/recorridos_web.json y tablas_web.json (los saca de la web tools/unreal/recorridos.js) y
// unreal/patologias/ (imágenes con licencia abierta y atribuciones.json, de tools/unreal/patologias_img.js).
//
// Formato:  { ui:{clave:texto}, aviso, modulos:[ {id, n, grupos:[ {n, items:[ ITEM ]} ]} ] }
// ITEM:     { id, t, sub?, secs:[[título, texto]…], pasos:[{t, x, show?:[nombres en inglés], view?, ver?:clave de vistas}],
//             q:[{p, o:[…], a:índice, x?}], show?:[…], view?:0–5, lado?:'d'|'i', img?, cred? }
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const DATA = path.join(RAIZ, 'data');
const IMPORTAR = path.join(RAIZ, 'unreal', 'CorpusAtlas', 'Importar', 'datos');
const CONTENT = path.join(RAIZ, 'unreal', 'CorpusAtlas', 'Content', 'Datos');
const PATO = path.join(RAIZ, 'unreal', 'patologias');
const J = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const JT = f => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const LANGS = ['es', 'en', 'pt', 'fr', 'de'];

// ── Traducción: mismo orden que la web (interfaz → textos largos FR/DE → inglés) ──
const i18n = J('i18n.json');
const UI = { en: i18n.ui.en, pt: i18n.ui.pt, fr: J('i18n_fr.json').ui, de: J('i18n_de.json').ui };
const CONT = { fr: J('content_fr.json'), de: J('content_de.json') };
const tiene = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k) && typeof o[k] === 'string' && o[k];
function tr(es, l) {
  if (l === 'es' || !es) return es;
  if (tiene(UI[l], es)) return UI[l][es];
  if (tiene(CONT[l], es)) return CONT[l][es];
  if ((l === 'fr' || l === 'de') && tiene(UI.en, es)) return UI.en[es];
  return es;
}
// [es, en, pt] de la web → idioma (FR/DE: por el texto español; si falta, inglés)
function L3(a, l) {
  if (a == null) return '';
  if (typeof a === 'string') return tr(a, l);
  if (l === 'es') return a[0] || '';
  if (l === 'en') return a[1] || a[0] || '';
  if (l === 'pt') return a[2] || a[0] || '';
  return tiene(CONT[l], a[0]) ? CONT[l][a[0]] : tiene(UI[l], a[0]) ? UI[l][a[0]] : (a[1] || a[0] || '');
}
// textos propios de esta edición: [es, en, pt, fr, de]
const L5 = (a, l) => a[LANGS.indexOf(l)] || a[0];

const VISTA = { ant: 0, anterior: 0, post: 1, posterior: 1, latd: 2, lateral: 2, lati: 3, medial: 3, sup: 4, superior: 4, inf: 5, inferior: 5 };
const vista = v => (v != null && VISTA[v] != null) ? VISTA[v] : undefined;
const limpio = o => { for (const k of Object.keys(o)) { if (o[k] === undefined || o[k] === '' || (Array.isArray(o[k]) && !o[k].length)) delete o[k]; } return o; };
const sec = (h, x) => (x && String(x).trim()) ? [[h, String(x).trim()]] : [];
const lista = a => (a || []).filter(Boolean).map(s => '• ' + s).join('\n');
const agrupar = (items, clave, orden) => {
  const g = new Map();
  for (const k of orden || []) g.set(k, []);
  for (const it of items) { const k = clave(it); if (!g.has(k)) g.set(k, []); g.get(k).push(it); }
  return [...g.entries()].filter(e => e[1].length);
};
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

// ── Textos de interfaz del panel ──
const TXT = {
  'Estudiar': ['Estudiar', 'Study', 'Estudar', 'Étudier', 'Lernen'],
  'Volver': ['← Volver', '← Back', '← Voltar', '← Retour', '← Zurück'],
  'Cerrar': ['Cerrar', 'Close', 'Fechar', 'Fermer', 'Schließen'],
  'Buscar': ['Buscar en este módulo…', 'Search this module…', 'Buscar neste módulo…', 'Chercher dans ce module…', 'In diesem Modul suchen…'],
  'Siguiente': ['Siguiente →', 'Next →', 'Próximo →', 'Suivant →', 'Weiter →'],
  'Anterior': ['← Anterior', '← Previous', '← Anterior', '← Précédent', '← Zurück'],
  'Paso': ['Paso', 'Step', 'Passo', 'Étape', 'Schritt'],
  'Ver': ['Ver en el modelo', 'Show on the model', 'Ver no modelo', 'Voir sur le modèle', 'Am Modell zeigen'],
  'Todo': ['Mostrar todo', 'Show all', 'Mostrar tudo', 'Tout afficher', 'Alles zeigen'],
  'Preguntas': ['Preguntas', 'Questions', 'Perguntas', 'Questions', 'Fragen'],
  'Correcto': ['Correcto', 'Correct', 'Correto', 'Correct', 'Richtig'],
  'Incorrecto': ['Incorrecto', 'Incorrect', 'Incorreto', 'Incorrect', 'Falsch'],
  'Aciertos': ['Aciertos', 'Score', 'Acertos', 'Score', 'Ergebnis'],
  'Imagen': ['Imagen', 'Image', 'Imagem', 'Image', 'Bild'],
  'Resultados': ['resultados', 'results', 'resultados', 'résultats', 'Ergebnisse'],
  'Nada': ['Sin resultados', 'No results', 'Sem resultados', 'Aucun résultat', 'Keine Ergebnisse'],
  'Entradas': ['entradas', 'entries', 'entradas', 'entrées', 'Einträge'],
};
const AVISO = ['Contenido educativo: no sustituye el diagnóstico ni el tratamiento de un profesional sanitario.',
  'Educational content: it does not replace diagnosis or treatment by a health professional.',
  'Conteúdo educativo: não substitui o diagnóstico nem o tratamento de um profissional de saúde.',
  'Contenu éducatif : il ne remplace ni le diagnostic ni le traitement par un professionnel de santé.',
  'Lehrinhalt: ersetzt weder die Diagnose noch die Behandlung durch medizinisches Fachpersonal.'];
const H = {   // títulos de sección
  obj: ['Objetivos', 'Objectives', 'Objetivos', 'Objectifs', 'Lernziele'],
  resp: ['Respuesta', 'Answer', 'Resposta', 'Réponse', 'Antwort'],
  expl: ['Explicación', 'Explanation', 'Explicação', 'Explication', 'Erklärung'],
  nota: ['Nota', 'Note', 'Nota', 'Note', 'Hinweis'],
  def: ['Definición', 'Definition', 'Definição', 'Définition', 'Definition'],
  etim: ['Etimología', 'Etymology', 'Etimologia', 'Étymologie', 'Etymologie'],
  sin: ['Sinónimos', 'Synonyms', 'Sinônimos', 'Synonymes', 'Synonyme'],
  rel: ['Términos relacionados', 'Related terms', 'Termos relacionados', 'Termes associés', 'Verwandte Begriffe'],
  estr: ['Estructuras', 'Structures', 'Estruturas', 'Structures', 'Strukturen'],
  pres: ['Presentación', 'Presentation', 'Apresentação', 'Présentation', 'Vorstellung'],
  anat: ['Anatomía', 'Anatomy', 'Anatomia', 'Anatomie', 'Anatomie'],
  sign: ['Signos', 'Signs', 'Sinais', 'Signes', 'Zeichen'],
  prue: ['Pruebas', 'Tests', 'Testes', 'Tests', 'Tests'],
  fisio: ['Fisioterapia', 'Physiotherapy', 'Fisioterapia', 'Kinésithérapie', 'Physiotherapie'],
  hist: ['Historia', 'History', 'História', 'Histoire', 'Anamnese'],
  plan: ['Plan de tratamiento', 'Treatment plan', 'Plano de tratamento', 'Plan de traitement', 'Behandlungsplan'],
  dx: ['¿Cuál es el diagnóstico más probable?', 'What is the most likely diagnosis?', 'Qual é o diagnóstico mais provável?', 'Quel est le diagnostic le plus probable ?', 'Was ist die wahrscheinlichste Diagnose?'],
  intro: ['Introducción', 'Introduction', 'Introdução', 'Introduction', 'Einführung'],
  objf: ['Objetivo', 'Goal', 'Objetivo', 'Objectif', 'Ziel'],
  ej: ['Ejercicios', 'Exercises', 'Exercícios', 'Exercices', 'Übungen'],
  crit: ['Criterios para avanzar', 'Criteria to progress', 'Critérios para avançar', 'Critères de progression', 'Kriterien zum Fortschreiten'],
  prec: ['Precauciones', 'Precautions', 'Precauções', 'Précautions', 'Vorsichtsmaßnahmen'],
  red: ['Signos de alarma', 'Red flags', 'Sinais de alarme', "Signes d'alerte", 'Warnzeichen'],
  ref: ['Referencias', 'References', 'Referências', 'Références', 'Literatur'],
  prev: ['Frecuencia', 'Prevalence', 'Frequência', 'Fréquence', 'Häufigkeit'],
  clin: ['Importancia clínica', 'Clinical relevance', 'Importância clínica', 'Intérêt clinique', 'Klinische Bedeutung'],
  expl2: ['Qué explora', 'What it tests', 'O que avalia', "Ce qu'il explore", 'Was geprüft wird'],
  como: ['Cómo se hace', 'How to perform', 'Como se faz', 'Réalisation', 'Durchführung'],
  posi: ['Qué observar', 'What to look for', 'O que observar', 'Que rechercher', 'Worauf achten'],
};
const MOD = {
  lecciones: ['Lecciones', 'Lessons', 'Lições', 'Leçons', 'Lektionen'],
  recorridos: ['Recorridos', 'Tours', 'Percursos', 'Parcours', 'Touren'],
  kinesio: ['Kinesiología y biomecánica', 'Kinesiology and biomechanics', 'Cinesiologia e biomecânica', 'Kinésiologie et biomécanique', 'Kinesiologie und Biomechanik'],
  pruebas: ['Pruebas y ejercicios', 'Tests and exercises', 'Testes e exercícios', 'Tests et exercices', 'Tests und Übungen'],
  casos: ['Casos clínicos', 'Clinical cases', 'Casos clínicos', 'Cas cliniques', 'Klinische Fälle'],
  protocolos: ['Protocolos', 'Protocols', 'Protocolos', 'Protocoles', 'Protokolle'],
  variantes: ['Variantes anatómicas', 'Anatomical variants', 'Variantes anatômicas', 'Variantes anatomiques', 'Anatomische Varianten'],
  patologias: ['Patologías', 'Pathologies', 'Patologias', 'Pathologies', 'Pathologien'],
  glosario: ['Glosario', 'Glossary', 'Glossário', 'Glossaire', 'Glossar'],
};

// ── Patologías: sistemas y a cuál pertenece cada término del glosario ──
const SIS = [
  ['enc', ['Encéfalo y médula espinal', 'Brain and spinal cord', 'Encéfalo e medula espinal', 'Encéphale et moelle épinière', 'Gehirn und Rückenmark'],
    'Ictus isquémico|Ictus hemorrágico|Accidente isquémico transitorio|Hemorragia subaracnoidea|Hematoma epidural|Hematoma subdural|Esclerosis múltiple|Enfermedad de Parkinson|Esclerosis lateral amiotrófica|Lesión medular|Síndrome de Brown-Séquard|Síndrome de la cola de caballo|Migraña|Epilepsia|Hidrocefalia|Meningitis|Mielopatía|Espina bífida'],
  ['nerv', ['Nervios periféricos', 'Peripheral nerves', 'Nervos periféricos', 'Nerfs périphériques', 'Periphere Nerven'],
    'Parálisis de Bell|Neuralgia del trigémino|Síndrome de Guillain-Barré|Parálisis de Erb|Parálisis de Klumpke|Lesión del nervio radial|Pie caído|Escápula alada|Síndrome del piramidal|Meralgia parestésica|Síndrome de Horner|Mano en garra|Síndrome del túnel cubital|Síndrome del pronador redondo|Síndrome del túnel tarsiano|Síndrome del desfiladero torácico|Síndrome del canal de Guyon|Síndrome del túnel carpiano|Ciática|Radiculopatía|Neuroma de Morton'],
  ['mus', ['Músculos, tendones y ligamentos', 'Muscles, tendons and ligaments', 'Músculos, tendões e ligamentos', 'Muscles, tendons et ligaments', 'Muskeln, Sehnen und Bänder'],
    'Síndrome subacromial|Lesión del manguito rotador|Hombro congelado|Epicondilitis|Epitrocleítis|Tenosinovitis de De Quervain|Dedo en gatillo|Contractura de Dupuytren|Lumbalgia|Cervicalgia|Latigazo cervical|Rotura del ligamento cruzado anterior|Rotura del ligamento cruzado posterior|Rotura del ligamento colateral medial de la rodilla|Lesión meniscal|Síndrome de la cintilla iliotibial|Tendinopatía rotuliana|Síndrome de dolor trocantéreo|Pubalgia|Esguince de tobillo|Rotura del tendón calcáneo|Fascitis plantar|Síndrome compartimental|Fibromialgia|Quiste de Baker|Bursitis prepatelar|Tendinopatía|Bursitis|Rotura fibrilar'],
  ['oseo', ['Huesos y articulaciones', 'Bones and joints', 'Ossos e articulações', 'Os et articulations', 'Knochen und Gelenke'],
    'Hernia discal|Escoliosis|Cifosis|Espondilólisis|Espondilolistesis|Estenosis de canal lumbar|Artrosis|Coxartrosis|Gonartrosis|Condromalacia rotuliana|Artritis|Artritis reumatoide|Espondilitis anquilosante|Gota|Osteoporosis|Fractura de cadera|Fractura de Colles|Fractura de escafoides|Fractura de clavícula|Fractura del cuello quirúrgico del húmero|Fractura supracondílea de húmero|Fractura de la cabeza del radio|Fractura de Monteggia|Fractura de Galeazzi|Fractura de Pott|Fractura de Jones|Fractura de Jefferson|Fractura de costilla|Luxación glenohumeral|Luxación acromioclavicular|Osteonecrosis de cabeza femoral|Enfermedad de Osgood-Schlatter|Osteomielitis|Enfermedad de Paget del hueso|Osteosarcoma|Pie zambo|Pie plano|Pie cavo|Hallux valgus|Genu valgo|Genu varo'],
  ['cor', ['Corazón', 'Heart', 'Coração', 'Cœur', 'Herz'],
    'Infarto agudo de miocardio|Angina de pecho|Insuficiencia cardiaca|Fibrilación auricular|Estenosis aórtica|Pericarditis|Taponamiento cardiaco|Comunicación interauricular|Persistencia del conducto arterioso'],
  ['vas', ['Vasos sanguíneos y linfáticos', 'Blood and lymph vessels', 'Vasos sanguíneos e linfáticos', 'Vaisseaux sanguins et lymphatiques', 'Blut- und Lymphgefäße'],
    'Aterosclerosis|Hipertensión arterial|Aneurisma|Aneurisma de aorta abdominal|Disección aórtica|Trombosis venosa profunda|Varices|Enfermedad arterial periférica|Linfedema'],
  ['pul', ['Pulmón y pleura', 'Lung and pleura', 'Pulmão e pleura', 'Poumon et plèvre', 'Lunge und Pleura'],
    'Asma|Enfermedad pulmonar obstructiva crónica|Neumonía|Neumotórax|Derrame pleural|Hemotórax|Embolia pulmonar|Cáncer de pulmón'],
  ['dig', ['Aparato digestivo', 'Digestive system', 'Sistema digestório', 'Appareil digestif', 'Verdauungssystem'],
    'Enfermedad por reflujo gastroesofágico|Hernia de hiato|Úlcera péptica|Hepatitis|Cirrosis|Hipertensión portal|Colelitiasis|Colecistitis|Pancreatitis|Apendicitis|Enfermedad de Crohn|Colitis ulcerosa|Diverticulitis|Peritonitis|Cáncer colorrectal|Hemorroides|Hernia inguinal|Hernia femoral|Hernia umbilical|Ruptura esplénica'],
  ['uro', ['Riñón, vías urinarias y aparato reproductor', 'Kidney, urinary tract and reproductive system', 'Rim, vias urinárias e sistema reprodutor', 'Rein, voies urinaires et appareil reproducteur', 'Niere, Harnwege und Fortpflanzungsorgane'],
    'Litiasis renal|Hidronefrosis|Infección urinaria|Hiperplasia benigna de próstata|Cáncer de próstata|Torsión testicular|Varicocele|Incontinencia urinaria de esfuerzo|Prolapso uterino|Endometriosis|Cáncer de mama'],
  ['otros', ['Órganos de los sentidos, endocrino y otros', 'Sense organs, endocrine and others', 'Órgãos dos sentidos, endócrino e outros', 'Organes des sens, endocrinien et autres', 'Sinnesorgane, endokrines System und andere'],
    'Otitis media|Sinusitis|Catarata|Desprendimiento de retina|Amigdalitis|Bocio'],
];
// vista y capas con las que se enseña cada sistema en el modelo
const SIS_CAPAS = { enc: ['nervioso_central', 'oseo'], nerv: ['nervioso_periferico', 'oseo', 'muscular'], mus: ['muscular', 'oseo', 'articular'], oseo: ['oseo', 'articular'],
  cor: ['arterial', 'venoso'], vas: ['arterial', 'venoso', 'oseo'], pul: ['respiratorio', 'oseo'], dig: ['digestivo', 'oseo'], uro: ['urinario', 'oseo'], otros: [] };

// ── Recorridos: grupo según las capas que usan ──
const GR_REC = [
  [['Aparato locomotor', 'Musculoskeletal system', 'Aparelho locomotor', 'Appareil locomoteur', 'Bewegungsapparat'], /^(muscular|oseo|articular|fascia|bolsas|piel)$/],
  [['Sistema nervioso y sentidos', 'Nervous system and senses', 'Sistema nervoso e sentidos', 'Système nerveux et sens', 'Nervensystem und Sinne'], /^nervioso/],
  [['Corazón, vasos y linfa', 'Heart, vessels and lymph', 'Coração, vasos e linfa', 'Cœur, vaisseaux et lymphe', 'Herz, Gefäße und Lymphe'], /^(arterial|venoso|linfatico)$/],
  [['Respiración, digestión y otros órganos', 'Breathing, digestion and other organs', 'Respiração, digestão e outros órgãos', 'Respiration, digestion et autres organes', 'Atmung, Verdauung und andere Organe'], /./],
];

function generar(l) {
  const mods = [];
  const M = (id, grupos) => mods.push({ id, n: L5(MOD[id], l), grupos: grupos.filter(g => g.items.length) });

  // 1 · Lecciones (cada idioma tiene su archivo, con los mismos ids y pasos)
  {
    const Ls = J(l === 'es' ? 'lessons.json' : `lessons_${l}.json`);
    const items = Ls.map(L => limpio({
      id: 'lec_' + L.id, t: L.t, sub: L.r, _g: L.a,
      secs: sec(L5(H.obj, l), lista(L.obj)),
      pasos: (L.steps || []).map(s => limpio({ t: s.t, x: s.x, show: s.show, view: vista(s.view) })),
      q: (L.q || []).map(q => limpio({ p: q.p, o: q.o, a: q.a, show: q.en ? [q.en] : undefined })),
    }));
    M('lecciones', agrupar(items, it => it._g).map(([n, its]) => ({ n, items: its })));
  }

  // 2 · Recorridos narrados (textos de la web; lo que enseña cada paso está en estudio_vistas.json)
  {
    const Ts = JT('recorridos_web.json');
    const grupos = GR_REC.map(g => ({ n: L5(g[0], l), items: [] }));
    for (const T of Ts) {
      const gi = GR_REC.findIndex(g => g[1].test(T.need[0] || ''));
      grupos[gi < 0 ? GR_REC.length - 1 : gi].items.push(limpio({
        id: 'rec_' + T.id, t: L3([T.n.es, T.n.en, T.n.pt], l),
        pasos: T.steps.map(s => { const a = [s.es, s.en, s.pt]; return limpio({ t: L3(a.map(v => v && v[0]), l), x: L3(a.map(v => v && v[1]), l), ver: s.ver ? T.id + '/' + s.id : undefined }); }),
      }));
    }
    M('recorridos', grupos);
  }

  // 3 · Kinesiología y biomecánica (banco de preguntas con explicación)
  const TAB = JT('tablas_web.json');
  {
    const items = J('bio.json').map(b => {
      const ops = [L3(b.a, l), ...(b.d || []).map(d => L3(d, l))];
      const giro = ops.length > 1 ? hash(b.id) % ops.length : 0;   // la correcta no siempre la primera
      const o = ops.map((_, i) => ops[(i + ops.length - giro) % ops.length]);
      return limpio({
        id: 'bio_' + b.id, t: L3(b.q, l), _g: b.r,
        // con pregunta de opciones, la respuesta y la explicación salen al contestar (no antes)
        secs: [...(ops.length > 1 ? [] : [...sec(L5(H.resp, l), L3(b.a, l)), ...sec(L5(H.expl, l), L3(b.x, l))]), ...sec(L5(H.nota, l), b.nota ? L3(b.nota, l) : '')],
        q: ops.length > 1 ? [{ p: L3(b.q, l), o, a: giro, x: L3(b.x, l) }] : undefined,
        show: b.tg, view: vista(b.view),
      });
    });
    M('kinesio', agrupar(items, it => it._g, Object.keys(TAB.bio_r)).map(([k, its]) => ({ n: TAB.bio_r[k] ? L3(TAB.bio_r[k], l) : k, items: its })));
  }

  // 4 · Pruebas ortopédicas y ejercicios (tabla CTESTS de la web; aquí sin la postura)
  {
    const GR = { funcional: 'Ejercicios funcionales', ergonomia: 'Ergonomía', rodilla: 'Rodilla', cadera: 'Cadera', hombro: 'Hombro', 'muñeca': 'Muñeca y mano', neural: 'Pruebas neurales', codo: 'Codo', tobillo: 'Tobillo y pie', columna: 'Columna', cuello: 'Cuello' };
    const items = TAB.ctests.map(c => limpio({
      id: 'ct_' + c.id, t: L3(c.n, l), _g: c.r,
      secs: [...sec(L5(H.expl2, l), L3(c.ex, l)), ...sec(L5(H.como, l), L3(c.how, l)), ...sec(L5(H.posi, l), L3(c.pos, l))],
      show: c.tg, view: vista(c.view),
    }));
    M('pruebas', agrupar(items, it => it._g, Object.keys(GR)).map(([k, its]) => ({ n: tr(GR[k] || k, l), items: its })));
  }

  // 5 · Casos clínicos: anatomía clínica (cases) y razonamiento clínico (rc)
  {
    const Cs = J(l === 'es' ? 'cases.json' : `cases_${l}.json`);
    const grupos = [];
    grupos.push({ n: L5(['Anatomía clínica', 'Clinical anatomy', 'Anatomia clínica', 'Anatomie clinique', 'Klinische Anatomie'], l), items: Cs.map(c => limpio({
      id: 'caso_' + c.id, t: c.titulo, sub: c.region,
      secs: [...sec(L5(H.pres, l), c.presentacion), ...sec(L5(H.anat, l), c.anatomia), ...sec(L5(H.sign, l), lista(c.signos)), ...sec(L5(H.prue, l), lista(c.pruebas)), ...sec(L5(H.fisio, l), c.fisioterapia)],
      show: [...(c.lesion || []), ...(c.afectados || []), ...(c.relacionados || [])], view: vista(c.camara),
      lado: /^der|^right|^direit|^droit|^recht/i.test(c.side || '') ? 'd' : /^izq|^left|^esquerd|^gauche|^link/i.test(c.side || '') ? 'i' : undefined,
    })) });
    const RR = { deporte: 'Fisioterapia deportiva', rodilla: 'Rodilla', tobillo: 'Tobillo y pie', cadera: 'Cadera', hombro: 'Hombro', codo: 'Codo', mano: 'Mano y muñeca', columna: 'Columna', neuro: 'Neurología', pediatria: 'Pediatría', geriatria: 'Geriatría' };
    const nombreCt = id => { const c = TAB.ctests.find(c => c.id === id); return c ? L3(c.n, l) : id; };
    const rc = J('rc.json').map(c => limpio({
      id: c.id, t: L3(c.t, l), _g: c.r,
      secs: [...sec(L5(H.hist, l), L3(c.h, l)),
        ...(c.tests || []).flatMap(t => sec(L5(H.prue, l).replace(/s$/, '') + ' · ' + nombreCt(t.ct), [L3(t.why, l), L3(t.res, l)].filter(Boolean).join('\n'))),
        ...(c.dx ? [] : sec(L5(H.plan, l), L3(c.plan, l)))],
      // el plan delata el diagnóstico: se lee al contestar
      q: c.dx ? [{ p: L5(H.dx, l), o: c.dx.o.map(o => L3(o, l)), a: c.dx.a, x: [L3(c.x, l), c.plan ? L5(H.plan, l) + ': ' + L3(c.plan, l) : ''].filter(Boolean).join('\n\n') }] : undefined,
      show: (c.tests || []).flatMap(t => (TAB.ctests.find(x => x.id === t.ct) || {}).tg || []),
    }));
    for (const [k, its] of agrupar(rc, it => it._g, Object.keys(RR))) grupos.push({ n: L5(['Razonamiento clínico', 'Clinical reasoning', 'Raciocínio clínico', 'Raisonnement clinique', 'Klinisches Denken'], l) + ' · ' + tr(RR[k] || k, l), items: its });
    M('casos', grupos);
  }

  // 6 · Protocolos de rehabilitación
  {
    const items = J('protocols.json').map(p => limpio({
      id: 'prot_' + p.id, t: L3(p.t, l),
      secs: [...sec(L5(H.intro, l), L3(p.intro, l)),
        ...(p.phases || []).flatMap(f => sec(L3(f.n, l), [
          L5(H.objf, l) + ': ' + L3(f.obj, l),
          L5(H.ej, l) + ':\n' + lista((f.ej || []).map(e => L3(e.n, l) + (e.dos ? ' — ' + L3(e.dos, l) : ''))),
          f.crit ? L5(H.crit, l) + ': ' + L3(f.crit, l) : '', f.prec ? L5(H.prec, l) + ': ' + L3(f.prec, l) : ''].filter(Boolean).join('\n\n'))),
        ...sec(L5(H.red, l), L3(p.red, l)), ...sec(L5(H.ref, l), L3(p.ref, l))],
    }));
    M('protocolos', [{ n: L5(MOD.protocolos, l), items }]);
  }

  // 7 · Variantes anatómicas
  {
    const items = J('variants.json').map(v => limpio({
      id: 'var_' + v.id, t: L3(v.t, l),
      secs: [...sec(L5(H.def, l), L3(v.x, l)), ...sec(L5(H.prev, l), L3(v.prev, l)), ...sec(L5(H.clin, l), L3(v.clin, l))],
      show: v.en, view: vista(v.view),
    }));
    M('variantes', [{ n: L5(MOD.variantes, l), items }]);
  }

  // 8 y 9 · Glosario y patologías (las patologías salen del glosario, ordenadas por sistema y con imagen si la hay)
  {
    const G = J('glossary.json');
    const gl = (g, c) => l === 'es' ? g[c] : l === 'pt' ? (g[c + '_pt'] || g[c]) : (g[c + '_en'] || g[c]);      // FR/DE: inglés (el glosario no está traducido)
    const nombre = g => l === 'es' ? g.t : l === 'pt' ? (g.pt || g.t) : (g.en || g.t);
    const porNombre = new Map(G.map(g => [g.t, g]));
    const entrada = (g, pre) => limpio({
      id: pre + hash(g.t).toString(36), t: nombre(g), sub: l === 'es' ? undefined : g.t, _g: g.cat,
      secs: [...sec(L5(H.def, l), gl(g, 'def')), ...sec(L5(H.etim, l), gl(g, 'etim')),
        ...sec(L5(H.sin, l), l === 'es' ? (g.sin || []).join(' · ') : ''),
        ...sec(L5(H.rel, l), (g.rel || []).map(r => porNombre.has(r) ? nombre(porNombre.get(r)) : r).join(' · ')),
        ...sec(L5(H.estr, l), l === 'es' ? lista((g.ej || []).map(e => e.txt)) : '')],
      show: (g.ej || []).map(e => e.s).filter(Boolean),
    });
    const items = G.map(g => entrada(g, 'glo_'));
    M('glosario', agrupar(items, it => it._g).map(([n, its]) => ({ n: tr(n, l), items: its })));

    let atr = {};
    try { atr = JSON.parse(fs.readFileSync(path.join(PATO, 'atribuciones.json'), 'utf8')); } catch (e) {}
    const usados = new Set(), grupos = [];
    for (const [clave, n5, lista_] of SIS) {
      const its = [];
      for (const t of lista_.split('|')) {
        const g = porNombre.get(t);
        if (!g) { if (l === 'es') console.log('  patologías: falta en el glosario «' + t + '»'); continue; }
        usados.add(t);
        const it = entrada(g, 'pat_');
        it.capas = SIS_CAPAS[clave];
        const a = atr[t];
        if (a && fs.existsSync(path.join(PATO, 'img', a.archivo))) { it.img = a.archivo; it.cred = `${a.titulo} — ${a.autor} · ${a.licencia} · Wikimedia Commons`; }
        its.push(limpio(it));
      }
      grupos.push({ n: L5(n5, l), items: its });
    }
    if (l === 'es') { const sin = G.filter(g => g.cat === 'Enfermedades y lesiones' && !usados.has(g.t)).map(g => g.t); if (sin.length) console.log('  patologías sin sistema:', sin.join(' | ')); }
    // las patologías van antes que el glosario
    const pat = { id: 'patologias', n: L5(MOD.patologias, l), grupos: grupos.filter(g => g.items.length) };
    mods.splice(mods.length - 1, 0, pat);
  }

  for (const m of mods) for (const g of m.grupos) for (const it of g.items) delete it._g;
  const ui = {}; for (const k of Object.keys(TXT)) ui[k] = L5(TXT[k], l);
  return { ui, aviso: L5(AVISO, l), modulos: mods };
}

// ── Salida ──
for (const d of [IMPORTAR, CONTENT]) fs.mkdirSync(d, { recursive: true });
const escribir = (nombre, texto) => { for (const d of [IMPORTAR, CONTENT]) fs.writeFileSync(path.join(d, nombre), texto); };
for (const l of LANGS) {
  const E = generar(l);
  const txt = JSON.stringify(E);
  escribir(`estudio_${l}.json`, txt);
  console.log(l + ': ' + E.modulos.map(m => m.n + ' ' + m.grupos.reduce((a, g) => a + g.items.length, 0)).join(' · ') + '  (' + (txt.length / 1e6).toFixed(1) + ' MB)');
}
{
  const V = {};
  for (const T of JT('recorridos_web.json')) for (const s of T.steps) if (s.ver) V[T.id + '/' + s.id] = s.ver;
  escribir('estudio_vistas.json', JSON.stringify(V));
  console.log('vistas de recorridos: ' + Object.keys(V).length + ' pasos');
}
{
  const org = path.join(PATO, 'img');
  let n = 0;
  if (fs.existsSync(org)) for (const d of [IMPORTAR, CONTENT]) { const dst = path.join(d, 'estudio_img'); fs.mkdirSync(dst, { recursive: true }); for (const f of fs.readdirSync(org)) { fs.copyFileSync(path.join(org, f), path.join(dst, f)); n++; } }
  console.log('imágenes: ' + n / 2);
}
