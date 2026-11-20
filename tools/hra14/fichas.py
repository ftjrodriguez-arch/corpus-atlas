#!/usr/bin/env python3
"""Nombres (pt, fr, de) y fichas (es, en, pt, fr, de) de las estructuras nuevas de HRA v1.4.
Uso: python3 tools/hra14/fichas.py   (desde la raíz; se puede repetir, no duplica)."""
import json

# nombre inglés del catálogo → (es, la, pt, fr, de)
N = {
 'Fovea centralis': ('Fóvea central', 'Fovea centralis', 'Fóvea central', 'Fovéa centrale', 'Fovea centralis'),
 'Macula lutea': ('Mácula lútea', 'Macula lutea', 'Mácula lútea', 'Macula lutea (tache jaune)', 'Gelber Fleck (Macula lutea)'),
 'Optic disc': ('Disco del nervio óptico', 'Discus nervi optici', 'Disco do nervo óptico', 'Disque du nerf optique (papille optique)', 'Sehnervenpapille'),
 'Choroid': ('Coroides', 'Choroidea', 'Coroide', 'Choroïde', 'Aderhaut'),
 'Ora serrata': ('Ora serrata', 'Ora serrata', 'Ora serrata', 'Ora serrata', 'Ora serrata'),
 'Ciliary body': ('Cuerpo ciliar', 'Corpus ciliare', 'Corpo ciliar', 'Corps ciliaire', 'Ziliarkörper'),
 'Ciliary processes': ('Procesos ciliares', 'Processus ciliares', 'Processos ciliares', 'Procès ciliaires', 'Ziliarfortsätze'),
 'Ciliary muscle': ('Músculo ciliar', 'Musculus ciliaris', 'Músculo ciliar', 'Muscle ciliaire', 'Ziliarmuskel'),
 'Zonular fibres (suspensory ligament of lens)': ('Zónula ciliar (ligamento suspensorio del cristalino)', 'Zonula ciliaris', 'Zônula ciliar (ligamento suspensor do cristalino)', 'Zonule ciliaire (ligament suspenseur du cristallin)', 'Zonulafasern (Aufhängeband der Linse)'),
 'Trabecular meshwork': ('Retículo trabecular', 'Reticulum trabeculare', 'Retículo trabecular', 'Réseau trabéculaire', 'Trabekelwerk'),
 "Schlemm's canal (scleral venous sinus)": ('Conducto de Schlemm (seno venoso de la esclera)', 'Sinus venosus sclerae', 'Canal de Schlemm (seio venoso da esclera)', 'Canal de Schlemm (sinus veineux de la sclère)', 'Schlemm-Kanal (Sinus venosus sclerae)'),
 'Limbus (corneoscleral junction)': ('Limbo esclerocorneal', 'Limbus corneae', 'Limbo esclerocorneano', 'Limbe scléro-cornéen', 'Limbus corneae (Hornhautrand)'),
 'Bulbar conjunctiva': ('Conjuntiva bulbar', 'Tunica conjunctiva bulbi', 'Conjuntiva bulbar', 'Conjonctive bulbaire', 'Bindehaut des Augapfels'),
 'Tracheal cartilages': ('Cartílagos traqueales', 'Cartilagines tracheales', 'Cartilagens traqueais', 'Cartilages trachéaux', 'Trachealknorpel'),
}
TIPO = {'es': 'órgano sensorial', 'en': 'sensory organ', 'pt': 'órgão sensorial', 'fr': 'organe sensoriel', 'de': 'Sinnesorgan'}
TIPO_C = {'es': 'cartílago', 'en': 'cartilage', 'pt': 'cartilagem', 'fr': 'cartilage', 'de': 'Knorpel'}

# nombre inglés → idioma → (descripción, función, clínica)
F = {
 'Fovea centralis': {
  'es': ('Depresión central de la mácula, de unos 1,5 mm, donde la retina se adelgaza y solo hay conos.', 'Punto de máxima agudeza visual y de la visión del color en detalle.', 'Su lesión (degeneración macular, agujero macular) produce un escotoma central con visión periférica conservada.'),
  'en': ('Central depression of the macula, about 1.5 mm wide, where the retina thins and contains only cones.', 'Point of highest visual acuity and of detailed colour vision.', 'Damage (macular degeneration, macular hole) causes a central scotoma with preserved peripheral vision.'),
  'pt': ('Depressão central da mácula, com cerca de 1,5 mm, onde a retina se afina e só há cones.', 'Ponto de máxima acuidade visual e da visão de cores em detalhe.', 'Sua lesão (degeneração macular, buraco macular) causa escotoma central com visão periférica preservada.'),
  'fr': ('Dépression centrale de la macula, d\'environ 1,5 mm, où la rétine s\'amincit et ne contient que des cônes.', 'Point d\'acuité visuelle maximale et de vision fine des couleurs.', 'Sa lésion (dégénérescence maculaire, trou maculaire) entraîne un scotome central avec vision périphérique conservée.'),
  'de': ('Zentrale Vertiefung der Makula von etwa 1,5 mm, in der die Netzhaut dünner wird und nur Zapfen enthält.', 'Stelle des schärfsten Sehens und des feinen Farbensehens.', 'Eine Schädigung (Makuladegeneration, Makulaforamen) führt zu einem Zentralskotom bei erhaltenem peripherem Sehen.')},
 'Macula lutea': {
  'es': ('Zona ovalada amarillenta de la retina posterior, de unos 5,5 mm, lateral al disco óptico; contiene la fóvea.', 'Visión central, de detalle y de color.', 'La degeneración macular asociada a la edad es la primera causa de pérdida de visión central en mayores de 60 años.'),
  'en': ('Yellowish oval area of the posterior retina, about 5.5 mm across, lateral to the optic disc; it contains the fovea.', 'Central, detailed and colour vision.', 'Age-related macular degeneration is the leading cause of central vision loss in people over 60.'),
  'pt': ('Área oval amarelada da retina posterior, com cerca de 5,5 mm, lateral ao disco óptico; contém a fóvea.', 'Visão central, de detalhes e de cores.', 'A degeneração macular relacionada à idade é a principal causa de perda da visão central após os 60 anos.'),
  'fr': ('Zone ovale jaunâtre de la rétine postérieure, d\'environ 5,5 mm, latérale au disque optique ; elle contient la fovéa.', 'Vision centrale, des détails et des couleurs.', 'La dégénérescence maculaire liée à l\'âge est la première cause de perte de la vision centrale après 60 ans.'),
  'de': ('Gelbliches ovales Areal der hinteren Netzhaut von etwa 5,5 mm, lateral der Sehnervenpapille; enthält die Fovea.', 'Zentrales Sehen, Detail- und Farbensehen.', 'Die altersbedingte Makuladegeneration ist die häufigste Ursache für den Verlust des zentralen Sehens jenseits des 60. Lebensjahres.')},
 'Optic disc': {
  'es': ('Zona circular de unos 1,5 mm, medial a la mácula, por donde los axones de las células ganglionares salen del ojo y entran los vasos centrales de la retina.', 'Salida del nervio óptico; carece de fotorreceptores y corresponde al punto ciego.', 'El papiledema indica hipertensión intracraneal; la excavación aumentada sugiere glaucoma.'),
  'en': ('Circular area about 1.5 mm wide, medial to the macula, where ganglion cell axons leave the eye and the central retinal vessels enter.', 'Exit of the optic nerve; it has no photoreceptors and corresponds to the blind spot.', 'Papilloedema indicates raised intracranial pressure; increased cupping suggests glaucoma.'),
  'pt': ('Área circular com cerca de 1,5 mm, medial à mácula, por onde os axônios das células ganglionares saem do olho e entram os vasos centrais da retina.', 'Saída do nervo óptico; não tem fotorreceptores e corresponde ao ponto cego.', 'O papiledema indica hipertensão intracraniana; a escavação aumentada sugere glaucoma.'),
  'fr': ('Zone circulaire d\'environ 1,5 mm, médiale à la macula, par où les axones des cellules ganglionnaires quittent l\'œil et où entrent les vaisseaux centraux de la rétine.', 'Sortie du nerf optique ; dépourvue de photorécepteurs, elle correspond à la tache aveugle.', 'L\'œdème papillaire signe une hypertension intracrânienne ; une excavation augmentée évoque un glaucome.'),
  'de': ('Rundes Areal von etwa 1,5 mm medial der Makula, an dem die Axone der Ganglienzellen das Auge verlassen und die zentralen Netzhautgefäße eintreten.', 'Austritt des Sehnervs; ohne Photorezeptoren, entspricht dem blinden Fleck.', 'Eine Stauungspapille weist auf erhöhten Hirndruck hin; eine vergrößerte Exkavation spricht für ein Glaukom.')},
 'Choroid': {
  'es': ('Capa vascular y pigmentada situada entre la esclera y la retina; forma la parte posterior de la úvea.', 'Nutre las capas externas de la retina y absorbe la luz dispersa.', 'Asiento de coroiditis y del melanoma de coroides, el tumor intraocular primario más frecuente del adulto.'),
  'en': ('Vascular, pigmented layer between the sclera and the retina; it forms the posterior part of the uvea.', 'Nourishes the outer layers of the retina and absorbs stray light.', 'Site of choroiditis and of choroidal melanoma, the most common primary intraocular tumour in adults.'),
  'pt': ('Camada vascular e pigmentada entre a esclera e a retina; forma a parte posterior da úvea.', 'Nutre as camadas externas da retina e absorve a luz dispersa.', 'Sede de coroidites e do melanoma de coroide, o tumor intraocular primário mais comum do adulto.'),
  'fr': ('Couche vasculaire et pigmentée située entre la sclère et la rétine ; elle forme la partie postérieure de l\'uvée.', 'Nourrit les couches externes de la rétine et absorbe la lumière diffusée.', 'Siège des choroïdites et du mélanome choroïdien, tumeur intraoculaire primitive la plus fréquente de l\'adulte.'),
  'de': ('Gefäßreiche, pigmentierte Schicht zwischen Sklera und Netzhaut; bildet den hinteren Teil der Uvea.', 'Ernährt die äußeren Netzhautschichten und absorbiert Streulicht.', 'Sitz der Chorioiditis und des Aderhautmelanoms, des häufigsten primären intraokularen Tumors des Erwachsenen.')},
 'Ora serrata': {
  'es': ('Borde anterior dentado de la retina, donde la retina sensorial termina y se continúa con el epitelio del cuerpo ciliar.', 'Límite entre la retina óptica y la porción ciliar, no visual.', 'Las diálisis y desgarros periféricos de la retina aparecen junto a ella.'),
  'en': ('Serrated anterior edge of the retina, where the sensory retina ends and continues as the epithelium of the ciliary body.', 'Boundary between the optic retina and the non-visual ciliary part.', 'Retinal dialyses and peripheral tears occur next to it.'),
  'pt': ('Borda anterior serrilhada da retina, onde a retina sensorial termina e continua como epitélio do corpo ciliar.', 'Limite entre a retina óptica e a porção ciliar, não visual.', 'As diálises e as rupturas periféricas da retina surgem junto a ela.'),
  'fr': ('Bord antérieur dentelé de la rétine, où la rétine sensorielle se termine et se poursuit par l\'épithélium du corps ciliaire.', 'Limite entre la rétine optique et la partie ciliaire, non visuelle.', 'Les dialyses et les déchirures périphériques de la rétine siègent à son voisinage.'),
  'de': ('Gezackter vorderer Rand der Netzhaut, an dem die sensorische Netzhaut endet und in das Epithel des Ziliarkörpers übergeht.', 'Grenze zwischen dem lichtempfindlichen und dem ziliaren, nicht sehenden Teil der Netzhaut.', 'Netzhautdialysen und periphere Netzhautrisse liegen in ihrer Nähe.')},
 'Ciliary body': {
  'es': ('Anillo de la úvea situado entre el iris y la coroides; contiene el músculo ciliar y los procesos ciliares.', 'Produce el humor acuoso y modifica la forma del cristalino para la acomodación.', 'Su inflamación es la ciclitis (uveítis intermedia); varios fármacos del glaucoma reducen su producción de humor acuoso.'),
  'en': ('Ring of the uvea between the iris and the choroid; it contains the ciliary muscle and the ciliary processes.', 'Produces aqueous humour and changes the shape of the lens for accommodation.', 'Its inflammation is cyclitis (intermediate uveitis); several glaucoma drugs reduce its aqueous production.'),
  'pt': ('Anel da úvea entre a íris e a coroide; contém o músculo ciliar e os processos ciliares.', 'Produz o humor aquoso e modifica a forma do cristalino para a acomodação.', 'Sua inflamação é a ciclite (uveíte intermediária); vários fármacos do glaucoma reduzem a produção de humor aquoso.'),
  'fr': ('Anneau de l\'uvée situé entre l\'iris et la choroïde ; il contient le muscle ciliaire et les procès ciliaires.', 'Sécrète l\'humeur aqueuse et modifie la forme du cristallin pour l\'accommodation.', 'Son inflammation est la cyclite (uvéite intermédiaire) ; plusieurs médicaments du glaucome réduisent sa sécrétion d\'humeur aqueuse.'),
  'de': ('Ring der Uvea zwischen Iris und Aderhaut; enthält den Ziliarmuskel und die Ziliarfortsätze.', 'Bildet das Kammerwasser und verändert die Linsenform für die Akkommodation.', 'Seine Entzündung ist die Zyklitis (intermediäre Uveitis); mehrere Glaukommedikamente senken die Kammerwasserproduktion.')},
 'Ciliary processes': {
  'es': ('Unos 70 pliegues radiales de la cara interna del cuerpo ciliar, muy vascularizados, donde se fijan las fibras de la zónula.', 'Su epitelio secreta el humor acuoso hacia la cámara posterior.', 'Diana de los inhibidores de la anhidrasa carbónica y de los betabloqueantes en el glaucoma.'),
  'en': ('About 70 highly vascular radial folds on the inner surface of the ciliary body, where the zonular fibres attach.', 'Their epithelium secretes aqueous humour into the posterior chamber.', 'Target of carbonic anhydrase inhibitors and beta-blockers in glaucoma.'),
  'pt': ('Cerca de 70 pregas radiais muito vascularizadas da face interna do corpo ciliar, onde se fixam as fibras da zônula.', 'Seu epitélio secreta o humor aquoso para a câmara posterior.', 'Alvo dos inibidores da anidrase carbônica e dos betabloqueadores no glaucoma.'),
  'fr': ('Environ 70 replis radiaires très vascularisés de la face interne du corps ciliaire, où s\'insèrent les fibres zonulaires.', 'Leur épithélium sécrète l\'humeur aqueuse dans la chambre postérieure.', 'Cible des inhibiteurs de l\'anhydrase carbonique et des bêtabloquants dans le glaucome.'),
  'de': ('Etwa 70 stark durchblutete radiäre Falten an der Innenseite des Ziliarkörpers, an denen die Zonulafasern ansetzen.', 'Ihr Epithel sezerniert das Kammerwasser in die hintere Augenkammer.', 'Angriffspunkt der Carboanhydrasehemmer und Betablocker beim Glaukom.')},
 'Ciliary muscle': {
  'es': ('Músculo liso anular del cuerpo ciliar, con fibras meridionales, radiales y circulares; inervado por fibras parasimpáticas del nervio oculomotor a través del ganglio ciliar.', 'Al contraerse relaja la zónula y el cristalino se abomba para enfocar de cerca (acomodación).', 'La presbicia reduce su eficacia; los ciclopléjicos (atropina, ciclopentolato) lo paralizan.'),
  'en': ('Ring of smooth muscle in the ciliary body, with meridional, radial and circular fibres; supplied by parasympathetic fibres of the oculomotor nerve through the ciliary ganglion.', 'Its contraction relaxes the zonule so the lens becomes more convex for near vision (accommodation).', 'Presbyopia reduces its effect; cycloplegic drugs (atropine, cyclopentolate) paralyse it.'),
  'pt': ('Músculo liso anular do corpo ciliar, com fibras meridionais, radiais e circulares; inervado por fibras parassimpáticas do nervo oculomotor através do gânglio ciliar.', 'Ao contrair, relaxa a zônula e o cristalino fica mais convexo para a visão de perto (acomodação).', 'A presbiopia reduz sua eficácia; os cicloplégicos (atropina, ciclopentolato) o paralisam.'),
  'fr': ('Muscle lisse annulaire du corps ciliaire, à fibres méridiennes, radiaires et circulaires ; innervé par des fibres parasympathiques du nerf oculomoteur via le ganglion ciliaire.', 'Sa contraction relâche la zonule et le cristallin se bombe pour la vision de près (accommodation).', 'La presbytie en réduit l\'efficacité ; les cycloplégiques (atropine, cyclopentolate) le paralysent.'),
  'de': ('Ringförmiger glatter Muskel des Ziliarkörpers mit meridionalen, radiären und zirkulären Fasern; parasympathisch innerviert über den N. oculomotorius und das Ganglion ciliare.', 'Seine Kontraktion entspannt die Zonulafasern, die Linse wölbt sich für das Nahsehen (Akkommodation).', 'Bei Presbyopie lässt seine Wirkung nach; Zykloplegika (Atropin, Cyclopentolat) lähmen ihn.')},
 'Zonular fibres (suspensory ligament of lens)': {
  'es': ('Sistema de fibras finas de fibrilina que van de los procesos ciliares al ecuador del cristalino.', 'Mantiene el cristalino centrado y le transmite la tensión del músculo ciliar.', 'Su debilidad (síndrome de Marfan, traumatismos, seudoexfoliación) causa subluxación del cristalino.'),
  'en': ('System of fine fibrillin fibres running from the ciliary processes to the equator of the lens.', 'Keeps the lens centred and transmits the tension of the ciliary muscle to it.', 'Weakness (Marfan syndrome, trauma, pseudoexfoliation) causes lens subluxation.'),
  'pt': ('Sistema de fibras finas de fibrilina que vão dos processos ciliares ao equador do cristalino.', 'Mantém o cristalino centrado e transmite a ele a tensão do músculo ciliar.', 'Sua fraqueza (síndrome de Marfan, traumas, pseudoexfoliação) causa subluxação do cristalino.'),
  'fr': ('Système de fines fibres de fibrilline tendues des procès ciliaires à l\'équateur du cristallin.', 'Maintient le cristallin centré et lui transmet la tension du muscle ciliaire.', 'Sa faiblesse (syndrome de Marfan, traumatisme, pseudo-exfoliation) entraîne une subluxation du cristallin.'),
  'de': ('System feiner Fibrillinfasern von den Ziliarfortsätzen zum Linsenäquator.', 'Hält die Linse zentriert und überträgt die Spannung des Ziliarmuskels auf sie.', 'Eine Schwäche (Marfan-Syndrom, Trauma, Pseudoexfoliation) führt zur Linsensubluxation.')},
 'Trabecular meshwork': {
  'es': ('Tejido esponjoso situado en el ángulo iridocorneal, entre la cámara anterior y el conducto de Schlemm.', 'Vía principal de drenaje del humor acuoso; su resistencia determina la presión intraocular.', 'El aumento de su resistencia causa el glaucoma primario de ángulo abierto; la trabeculoplastia láser y la trabeculectomía actúan sobre él.'),
  'en': ('Spongy tissue in the iridocorneal angle, between the anterior chamber and Schlemm\'s canal.', 'Main drainage route of aqueous humour; its resistance sets the intraocular pressure.', 'Increased resistance causes primary open-angle glaucoma; laser trabeculoplasty and trabeculectomy act on it.'),
  'pt': ('Tecido esponjoso situado no ângulo iridocorneano, entre a câmara anterior e o canal de Schlemm.', 'Principal via de drenagem do humor aquoso; sua resistência determina a pressão intraocular.', 'O aumento da sua resistência causa o glaucoma primário de ângulo aberto; a trabeculoplastia a laser e a trabeculectomia atuam sobre ele.'),
  'fr': ('Tissu spongieux de l\'angle irido-cornéen, entre la chambre antérieure et le canal de Schlemm.', 'Principale voie d\'évacuation de l\'humeur aqueuse ; sa résistance détermine la pression intraoculaire.', 'L\'augmentation de sa résistance provoque le glaucome primitif à angle ouvert ; la trabéculoplastie au laser et la trabéculectomie agissent sur lui.'),
  'de': ('Schwammartiges Gewebe im Kammerwinkel zwischen vorderer Augenkammer und Schlemm-Kanal.', 'Hauptabflussweg des Kammerwassers; sein Widerstand bestimmt den Augeninnendruck.', 'Ein erhöhter Widerstand verursacht das primäre Offenwinkelglaukom; Lasertrabekuloplastik und Trabekulektomie setzen hier an.')},
 "Schlemm's canal (scleral venous sinus)": {
  'es': ('Conducto anular revestido de endotelio, situado en la esclera junto al limbo, por fuera del retículo trabecular.', 'Recoge el humor acuoso y lo lleva a las venas epiesclerales por los conductos colectores.', 'Objetivo de la canaloplastia y de los dispositivos de cirugía mínimamente invasiva del glaucoma.'),
  'en': ('Endothelium-lined circular channel in the sclera next to the limbus, outside the trabecular meshwork.', 'Collects aqueous humour and carries it to the episcleral veins through collector channels.', 'Target of canaloplasty and of minimally invasive glaucoma surgery devices.'),
  'pt': ('Canal anular revestido de endotélio, situado na esclera junto ao limbo, por fora do retículo trabecular.', 'Recolhe o humor aquoso e o leva às veias episclerais pelos canais coletores.', 'Alvo da canaloplastia e dos dispositivos de cirurgia minimamente invasiva do glaucoma.'),
  'fr': ('Canal annulaire tapissé d\'endothélium, situé dans la sclère près du limbe, en dehors du réseau trabéculaire.', 'Recueille l\'humeur aqueuse et la conduit vers les veines épisclérales par les canaux collecteurs.', 'Cible de la canaloplastie et des dispositifs de chirurgie mini-invasive du glaucome.'),
  'de': ('Ringförmiger, mit Endothel ausgekleideter Kanal in der Sklera am Limbus, außen vom Trabekelwerk.', 'Nimmt das Kammerwasser auf und leitet es über Sammelkanäle in die episkleralen Venen.', 'Ziel der Kanaloplastik und der minimalinvasiven Glaukomchirurgie.')},
 'Limbus (corneoscleral junction)': {
  'es': ('Zona de transición de 1–2 mm entre la córnea transparente y la esclera opaca.', 'Contiene las células madre del epitelio corneal y las vías de drenaje del humor acuoso.', 'La insuficiencia de células madre limbares opacifica la córnea; es la zona habitual de las incisiones de la cirugía de catarata.'),
  'en': ('Transition zone 1–2 mm wide between the transparent cornea and the opaque sclera.', 'Contains the corneal epithelial stem cells and the aqueous drainage pathways.', 'Limbal stem cell deficiency makes the cornea opaque; it is the usual site of cataract surgery incisions.'),
  'pt': ('Zona de transição de 1–2 mm entre a córnea transparente e a esclera opaca.', 'Contém as células-tronco do epitélio corneano e as vias de drenagem do humor aquoso.', 'A deficiência de células-tronco limbares opacifica a córnea; é o local habitual das incisões da cirurgia de catarata.'),
  'fr': ('Zone de transition de 1 à 2 mm entre la cornée transparente et la sclère opaque.', 'Contient les cellules souches de l\'épithélium cornéen et les voies d\'évacuation de l\'humeur aqueuse.', 'L\'insuffisance en cellules souches limbiques opacifie la cornée ; c\'est le site habituel des incisions de la chirurgie de la cataracte.'),
  'de': ('1–2 mm breite Übergangszone zwischen der durchsichtigen Hornhaut und der undurchsichtigen Sklera.', 'Enthält die Stammzellen des Hornhautepithels und die Abflusswege des Kammerwassers.', 'Eine Limbusstammzellinsuffizienz trübt die Hornhaut; hier liegen meist die Schnitte der Kataraktoperation.')},
 'Bulbar conjunctiva': {
  'es': ('Mucosa fina y transparente que cubre la parte anterior de la esclera hasta el limbo y se continúa con la conjuntiva de los párpados en los fórnices.', 'Protege y lubrica la superficie ocular; sus células caliciformes aportan la mucina de la lágrima.', 'Se enrojece en la conjuntivitis; el pterigión y la hemorragia subconjuntival se asientan en ella.'),
  'en': ('Thin, transparent mucosa covering the anterior sclera up to the limbus and continuous with the eyelid conjunctiva at the fornices.', 'Protects and lubricates the ocular surface; its goblet cells supply the mucin of the tear film.', 'It reddens in conjunctivitis; pterygium and subconjunctival haemorrhage occur in it.'),
  'pt': ('Mucosa fina e transparente que cobre a parte anterior da esclera até o limbo e continua com a conjuntiva das pálpebras nos fórnices.', 'Protege e lubrifica a superfície ocular; suas células caliciformes fornecem a mucina da lágrima.', 'Fica vermelha na conjuntivite; o pterígio e a hemorragia subconjuntival ocorrem nela.'),
  'fr': ('Muqueuse fine et transparente recouvrant la partie antérieure de la sclère jusqu\'au limbe, en continuité avec la conjonctive des paupières au niveau des culs-de-sac.', 'Protège et lubrifie la surface oculaire ; ses cellules caliciformes fournissent la mucine du film lacrymal.', 'Elle rougit dans la conjonctivite ; le ptérygion et l\'hémorragie sous-conjonctivale y siègent.'),
  'de': ('Dünne, durchsichtige Schleimhaut, die den vorderen Teil der Sklera bis zum Limbus bedeckt und an den Umschlagfalten in die Lidbindehaut übergeht.', 'Schützt und befeuchtet die Augenoberfläche; ihre Becherzellen liefern das Muzin des Tränenfilms.', 'Sie rötet sich bei Konjunktivitis; Pterygium und Hyposphagma liegen in ihr.')},
 'Tracheal cartilages': {
  'es': ('De 16 a 20 anillos de cartílago hialino en forma de C, abiertos por detrás, donde los cierra el músculo traqueal.', 'Mantienen abierta la vía aérea y permiten que el esófago se expanda hacia delante al tragar.', 'Referencia para la traqueotomía (entre el 2.º y el 4.º anillo); su debilidad causa traqueomalacia.'),
  'en': ('Sixteen to twenty C-shaped rings of hyaline cartilage, open posteriorly, where the trachealis muscle closes them.', 'Keep the airway open and let the oesophagus expand forwards during swallowing.', 'Landmark for tracheostomy (between the 2nd and 4th rings); their weakness causes tracheomalacia.'),
  'pt': ('De 16 a 20 anéis de cartilagem hialina em forma de C, abertos atrás, onde o músculo traqueal os fecha.', 'Mantêm a via aérea aberta e permitem que o esôfago se expanda para a frente na deglutição.', 'Referência para a traqueostomia (entre o 2.º e o 4.º anel); sua fraqueza causa traqueomalácia.'),
  'fr': ('Seize à vingt anneaux de cartilage hyalin en forme de C, ouverts en arrière, où le muscle trachéal les ferme.', 'Maintiennent la voie aérienne ouverte et laissent l\'œsophage se dilater vers l\'avant lors de la déglutition.', 'Repère de la trachéotomie (entre le 2e et le 4e anneau) ; leur faiblesse provoque une trachéomalacie.'),
  'de': ('Sechzehn bis zwanzig C-förmige Spangen aus hyalinem Knorpel, hinten offen und dort vom M. trachealis verschlossen.', 'Halten den Atemweg offen und lassen der Speiseröhre beim Schlucken Raum nach vorn.', 'Orientierung bei der Tracheotomie (zwischen 2. und 4. Spange); ihre Schwäche führt zur Tracheomalazie.')},
}
assert set(N) == set(F)
CFG = dict(ensure_ascii=False, separators=(',', ':'))


def rw(f, fn):
    j = json.load(open(f, encoding='utf-8')); fn(j)
    open(f, 'w', encoding='utf-8').write(json.dumps(j, **CFG))


def ficha(en, lang):
    es, la, pt, fr, de = N[en]
    nombre = {'es': es, 'en': en, 'pt': pt, 'fr': fr, 'de': de}[lang]
    d, fu, cl = F[en][lang]
    tipo = (TIPO_C if en == 'Tracheal cartilages' else TIPO)[lang]
    return {'es': nombre, 'la': la, 'tipo': tipo, 'descripcion': d, 'origen': None, 'destino': None, 'ramas': None, 'territorio': None, 'funcion': fu, 'clinica': cl}


rw('data/info.json', lambda j: [j['rest'].__setitem__(en, ficha(en, 'es')) for en in N])
for lang in ('en', 'pt', 'fr', 'de'):
    rw('data/info_%s.json' % lang, lambda j, lang=lang: [j.__setitem__('rest|' + en, ficha(en, lang)) for en in N])
rw('data/i18n.json', lambda j: [j['names'].__setitem__(N[en][0], N[en][2]) for en in N if N[en][0] != N[en][2]])
rw('data/i18n_fr.json', lambda j: [j['names'].__setitem__(N[en][0], N[en][3]) for en in N])
rw('data/i18n_de.json', lambda j: [j['names'].__setitem__(N[en][0], N[en][4]) for en in N])
print('fichas y nombres de', len(N), 'estructuras escritos en 5 idiomas')
