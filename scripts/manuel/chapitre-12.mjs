// ============================================================
// MANUEL DE FORMATION — CHAPITRE 12 : Portail et devis sans calcul
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// screens/dimensionnement/Garage.jsx (« 🚪 Besoins du client » : Type
// d'installation — TYPES_PORTAIL, cinq types —, Largeur à motoriser (m),
// Hauteur (m), Poids du vantail / de la porte (kg), Nombre de vantaux (battant
// seul), Fréquence d'usage quotidienne — LABEL_FREQUENCE et FACTEUR_FREQUENCE
// 1,1 / 1,25 / 1,5 —, Télécommandes souhaitées (2 d'office), Électricité
// disponible à proximité ? ; les quatre carrés Poids à motoriser / Catégorie de
// moteur / Crémaillère / Télécommandes ; la ligne Porte au m² et PRIX_PORTE_M2 ;
// ROLES_EQUIPEMENT_GARAGE — moteur en kg, crémaillère en m, largeur + 1 m, 2
// cellules, 1 clignotant, 1 déverrouillage ; le moteur = le plus petit qui
// couvre le poids, sinon le plus gros ; « ☀️ Ajouter un kit solaire autonome »,
// « 🔋 Ajouter une batterie de secours (externe) » ; « Autres équipements
// (coffret de commande, câblage…) »), screens/dimensionnement/Autre.jsx (le
// bandeau d'un domaine sans article rattaché ; « 💧 Quelle pompe pour ce
// forage ? » ; le tableau « Besoin du client · Article proposé · Quantité ·
// Prix unit. · Sous-total · HB », « Cliquez ou tapez le besoin… », « Choisissez
// le besoin à gauche… », « Aucun article pour ce besoin chez … », « ➕ Ajouter
// un besoin », « Retirer » ; le métier ouvert en tête, le reste du stock
// dessous, détail « Autre métier — stock de … »), lib/pompes.js (niveau
// dynamique, frottements 5 % d'office, 6 heures de soleil, les pompes qui
// conviennent / écartées / non renseignées, AVERTISSEMENT_COURBE),
// lib/choixSolaire.js (specDepuisNom : la caractéristique lue dans le nom),
// screens/dimensionnement/index.jsx (un bouton par domaine), src/pdf.js
// (besoinPortail : « VOTRE PORTAIL COULISSANT », Dimensions / Poids retenu /
// Usage quotidien ; aucun bloc « Votre demande » pour un devis sans calcul),
// screens/Parametres.jsx (🗂 Domaines de produits et leurs familles ; « 💧
// Forage — frottements dans le tuyau (%) »), lib/calculs.js (DOMAINES_DEFAUT).
// La fin du devis (pose seule, remise, installation, transport, acompte,
// délai, envoi, brouillon, conversion) est la MÊME que le solaire : chapitre 11.
// ============================================================
export const CHAPITRE = {
  numero: 12,
  titre: "Portail et devis sans calcul",
  sousTitre: "Chiffrer la motorisation d'un portail ou d'une porte de garage, et établir un devis pour les métiers sans calcul — vidéosurveillance, électricité, forage…",
  public: "Administrateur, responsable commercial, commercial, technicien, technicien BMI, gérant, vendeur",
  duree: "1 h, puis l'exercice en espace formation",
  prerequis: "Le chapitre 11 (Dimensionnement solaire) : la boutique de travail, la case HB, « ✏️ Saisir un article hors stock », les autres équipements, la fin du devis, l'envoi, les brouillons et la conversion en vente s'y apprennent — ils sont IDENTIQUES ici. Le chapitre 8 (Stocks) : le domaine, la catégorie et le nom d'un article décident de ce qui est proposé.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "**noter les besoins d'un portail ou d'une porte de garage** — le type, les dimensions, le poids, l'usage quotidien, les télécommandes, l'électricité sur place ;",
        "**lire les quatre chiffres** que l'application en tire : le poids à motoriser, la catégorie de moteur, la longueur de crémaillère, le nombre de télécommandes ;",
        "**vérifier le matériel proposé** (moteur, crémaillère, télécommandes, photocellules, lampe clignotante, déverrouillage) et le **prix de la porte au m²** ;",
        "**établir un devis sans calcul** (vidéosurveillance, électricité, forage, ou tout métier créé dans ⚙ Paramètres) : un **besoin du client**, puis **l'article proposé** ;",
        "utiliser **« 💧 Quelle pompe pour ce forage ? »** sans jamais promettre un débit ;",
        "terminer, envoyer, garder ou vendre le devis **exactement comme au chapitre 11**.",
      ]],
      ["regle", "**Deux sortes de volets, une seule fin de devis.** Le solaire et le portail CALCULENT ; les autres métiers ne calculent rien — le vendeur choisit. Mais la fin est la même partout : pose seule, remise, installation, transport, acompte, délai, envoi par WhatsApp, brouillon, conversion en vente. Ce qu'on sait faire au chapitre 11, on le sait faire ici."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [5000, 4300], lignes: [
        ["Voir l'onglet ☀️ Dimensionnement et ses volets", "**Administrateur, responsable commercial, commercial, technicien, technicien BMI, gérant, vendeur** — les mêmes qu'au chapitre 11. Le magasinier, le comptable et le client ne l'ont pas."],
        ["Envoyer un devis au client", "Tout compte qui a l'onglet et qui a **enregistré sa signature** (📄 Contrats)."],
        ["Accorder une remise de plus de 3 %", "**Administrateur seul**, comme partout."],
        ["Créer un domaine (un métier), lui ajouter ou retirer des familles", "**Administrateur**, dans ⚙ Paramètres → 🗂 Domaines de produits et leurs familles."],
        ["Régler l'estimation des frottements dans le tuyau d'un forage", "**Administrateur**, dans ⚙ Paramètres (« 💧 Forage — frottements dans le tuyau (%) »)."],
        ["Renseigner la fiche d'une pompe (puissance, profondeur, débit, tension, hybride)", "Ceux qui corrigent un article dans 📦 Stocks (chapitre 8)."],
      ]}],
      ["note", "**Le mur formation / réel s'applique ici aussi** : les boutiques et les clients proposés sont ceux de l'espace regardé. Un devis établi depuis une boutique de formation reste un devis de formation, et rien ne part du numéro WhatsApp BMI."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3100, 6200], lignes: [
        ["**☀️ Dimensionnement**, en haut", "Un bouton par **domaine** réglé dans ⚙ Paramètres. D'office : **☀️ Solaire** (chapitre 11), **🚪 Garage** (portail et porte de garage — ce chapitre), **📦 Autre** ; plus tout domaine créé par l'administrateur (📹 Caméra, 💧 Forage, ⚡ Électricité…), tous **sans calcul**. Puis **« 📝 Mes brouillons »**."],
        ["**🚪 Besoins du client** (volet Garage)", "**Type d'installation** · **Largeur à motoriser (m)** · **Hauteur (m)** · **Poids du vantail / de la porte (kg)** · **Nombre de vantaux** (portail battant seulement) · **Fréquence d'usage quotidienne** · **Télécommandes souhaitées** · **Électricité disponible à proximité ?**"],
        ["Les quatre carrés (Garage)", "**Poids à motoriser** · **Catégorie de moteur** · **Crémaillère** · **Télécommandes**."],
        ["**Équipements proposés (stock de …)** (Garage)", "**Catégorie · Article · Besoin calculé · Quantité · Prix unit. · Sous-total · HB**. Première ligne, sur fond clair : **Porte**, au m², prix modifiable. Puis Moteur / motorisation, Crémaillère (coulissant seulement), Télécommande, Photocellules, Lampe clignotante, Déverrouillage manuel. Sous le tableau : **☀️ kit solaire autonome**, **🔋 batterie de secours**, **Autres équipements (coffret de commande, câblage…)**."],
        ["**💧 Quelle pompe pour ce forage ?** (volet sans calcul)", "Un cadre bleu repliable, **seulement si le métier ouvert a des pompes en stock** dans la boutique."],
        ["**Besoins du client → articles** (volet sans calcul)", "**Besoin du client · Article proposé · Quantité · Prix unit. · Sous-total · HB · Retirer** ; **« ➕ Ajouter un besoin »** ; puis **Autres équipements**."],
        ["La fin du devis et l'envoi", "Identiques au chapitre 11 : Pose seule, Remise %, Frais d'installation %, Transport / livraison %, Total, 🛒 Convertir en vente, Acompte, Délai ; 📲 Envoyer ce devis au client, 📝 Enregistrer un brouillon."],
        ["**⚙ Paramètres** (administrateur)", "🗂 **Domaines de produits et leurs familles** (créer un métier, ses familles) ; **💧 Forage — frottements dans le tuyau (%)**."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Le portail ou la porte de garage : noter les besoins"],
      ["etapes", [
        { titre: "Ouvrir ☀️ Dimensionnement → 🚪 Garage", texte: "Vérifier la boutique de travail : ce sont **son stock et ses prix** qui seront proposés." },
        { titre: "Type d'installation", texte: "**Portail coulissant** (d'office), **Portail battant**, **Porte de garage sectionnelle**, **Porte de garage basculante**, **Rideau métallique**. Le type change le prix de la porte au m² et décide de la crémaillère (coulissant seulement)." },
        { titre: "Largeur et hauteur", texte: "**Largeur à motoriser** et **Hauteur**, en mètres. La largeur donne la crémaillère ; largeur × hauteur donne la surface de la porte." },
        { titre: "Le poids", texte: "**Poids du vantail / de la porte (kg)** : c'est lui qui choisit le moteur. Le demander, le mesurer ou l'estimer avec le client — jamais le laisser vide." },
        { titre: "Nombre de vantaux", texte: "Pour un **portail battant** seulement : 1 (vantail unique) ou 2 (double vantail)." },
        { titre: "Fréquence d'usage", texte: "**Faible (< 10 cycles/j)**, **Moyenne (10 à 30 cycles/j)** (d'office), **Intensive (> 30 cycles/j)**. Un cycle = une ouverture et une fermeture. Plus le portail travaille, plus on prend de marge sur le moteur." },
        { titre: "Télécommandes et électricité", texte: "**Télécommandes souhaitées** : 2 d'office. **Électricité disponible à proximité ?** : si « Non — prévoir une alimentation autonome », l'écran recommande le kit solaire plus bas." },
      ]],
      ["h3", "B. Lire les quatre chiffres"],
      ["etapes", [
        { titre: "Poids à motoriser", texte: "Le poids saisi **majoré selon l'usage** : × 1,1 en faible, × 1,25 en moyenne, × 1,5 en intensive, arrondi au kilo supérieur. 400 kg en usage moyen → **500 kg**." },
        { titre: "Catégorie de moteur", texte: "D'après ce poids : **Léger** (jusqu'à 300 kg), **Standard** (300 à 500 kg), **Robuste** (500 à 800 kg), **Industriel** (plus de 800 kg)." },
        { titre: "Crémaillère", texte: "**Largeur + 1 m**, arrondi au mètre supérieur, pour un portail coulissant. Pour les autres types : « — (non requise) »." },
        { titre: "Télécommandes", texte: "Le nombre demandé (« × 2 »)." },
      ]],
      ["h3", "C. Vérifier le matériel et la porte"],
      ["etapes", [
        { titre: "La ligne Porte", texte: "Surface = largeur × hauteur, facturée **au m²**. Le prix du m² part d'une valeur d'office selon le type (voir rubrique 6) et **se corrige dans la case** pour ce devis. Si largeur ou hauteur manque, la surface vaut 0 et la ligne ne compte pas." },
        { titre: "Le moteur", texte: "L'application prend **le plus petit moteur du stock qui porte au moins le poids à motoriser**. Si aucun n'est assez fort, elle propose **le plus gros** qu'elle trouve — à vérifier : il est peut-être trop faible. La liste déroulante montre chaque moteur avec sa capacité (« (600kg) »)." },
        { titre: "La crémaillère", texte: "Le plus long modèle du stock, en autant de pièces qu'il faut pour couvrir la longueur calculée (des barres d'1 m pour 5 m → 5)." },
        { titre: "Les accessoires", texte: "**Télécommande** × le nombre demandé ; **Photocellules** × 2 ; **Lampe clignotante** × 1 ; **Déverrouillage manuel** × 1. Pour chacun, le premier article trouvé dans le stock : le changer dans la liste s'il en existe plusieurs." },
        { titre: "Corriger, saisir hors stock, revenir au calcul", texte: "Comme au chapitre 11 : changer d'article dans la liste, corriger la quantité, **« ✏️ Saisir un article hors stock »** (Nom, Prix, Valider), **« Annuler (revenir à la sélection automatique) »**. La case **HB** exclut la ligne du chiffre d'affaires et des commissions." },
        { titre: "Pas d'électricité ? Coupures fréquentes ?", texte: "Cocher **« ☀️ Ajouter un kit solaire autonome pour la motorisation »** (l'écran écrit « recommandé » quand on a répondu Non à l'électricité) et saisir son **prix**. **« 🔋 Ajouter une batterie de secours (externe) »** : en option, avec son prix. Ces deux lignes sont des lignes libres : elles ne font sortir aucun stock." },
        { titre: "Autres équipements", texte: "Coffret de commande, câblage, gaine… **« ➕ Ajouter un équipement »** : un article du stock remplit son prix et se lie au stock ; un nom libre coche HB d'office. Ce qui ne se chiffre qu'après la visite : **« ➕ Élément à compléter (cf. visite) »** (chapitre 13, section I)." },
      ]],
      ["h3", "D. Un devis SANS calcul (caméra, électricité, forage, Autre…)"],
      ["etapes", [
        { titre: "Ouvrir le bon métier", texte: "☀️ Dimensionnement → le bouton du métier (📹 Caméra, 💧 Forage, 📦 Autre…). Si aucun article de la boutique n'est encore rangé dans ce métier, un bandeau jaune le dit : **tout le stock** est alors proposé." },
        { titre: "Choisir le besoin du client", texte: "Colonne **Besoin du client** : cliquer dans la case ouvre toute la liste, taper la filtre (« came » → Caméras). **Les besoins du métier ouvert viennent en tête**, puis **tout le reste du stock de la boutique** (marqué « Autre métier — stock de … ») : un panneau solaire pour un forage se trouve donc toujours." },
        { titre: "Choisir l'article proposé", texte: "Colonne **Article proposé** : l'application propose d'office **le premier article** de ce besoin. Cliquer ouvre la liste des articles de ce besoin (prix et catégorie sous chaque nom) ; **un clic choisit**. Un nom tapé ne lie l'article que s'il est écrit **exactement** comme au stock." },
        { titre: "Quantité, HB, Retirer", texte: "**Quantité** (1 au moins), **HB** si la ligne ne vient pas du stock de BMI, **Retirer** pour enlever la ligne. **« ➕ Ajouter un besoin »** pour la ligne suivante." },
        { titre: "Un article qui n'est pas au stock", texte: "**« ✏️ Saisir un article hors stock »** sur la ligne : nom, prix, **Valider**. « Annuler (revenir à la recherche automatique) » rend la ligne au premier article du besoin." },
        { titre: "Terminer et envoyer", texte: "Autres équipements, puis la fin du devis et l'envoi **comme au chapitre 11**." },
      ]],
      ["h3", "E. Le forage : « 💧 Quelle pompe pour ce forage ? »"],
      ["etapes", [
        { titre: "Ouvrir le cadre", texte: "Dans le volet du forage, **« ▼ Ouvrir »**. Le cadre n'apparaît que si le métier ouvert a des pompes (catégorie qui contient « pompe ») dans le stock de la boutique." },
        { titre: "Les quatre questions", texte: "**Niveau dynamique (m)**, **Hauteur du réservoir (m)**, **Longueur de tuyau (m)**, **Besoin en eau (litres / jour)**. ⚠ Le **niveau dynamique**, pas la profondeur du forage : la profondeur où l'eau se stabilise **pendant** le pompage. **C'est le foreur qui le donne.** Sans lui, l'écran refuse de calculer et le dit." },
        { titre: "Lire le résultat", texte: "**Hauteur totale à vaincre** = l'eau + le réservoir + les frottements (**estimés** à 5 % de la longueur du tuyau d'office). **Débit nécessaire** = les litres ÷ 6 heures de soleil, en m³/h." },
        { titre: "Lire les pompes", texte: "« Pompes de … qui montent à … m ou plus » : celles qui conviennent, de la plus juste à la plus forte, avec leur fiche et leur prix. En dessous : celles **écartées** parce qu'elles ne montent pas assez haut, et en ambre celles **non renseignées** (sans profondeur maximale), qui ne peuvent pas être proposées." },
        { titre: "Ajouter la pompe choisie", texte: "L'étude **ne s'enregistre pas** : elle aide à choisir. On ajoute ensuite la pompe retenue comme un article ordinaire, dans la liste des besoins (besoin « Pompe »)." },
      ]],
      ["attention", "**Une pompe ne donne PAS son débit maximal à sa profondeur maximale.** Une pompe « 90 m · 3 m³/h » donne 3 m³/h en surface, beaucoup moins à 56 m. L'écran le rappelle en ambre à chaque étude : **avant de promettre un débit au client, le vérifier sur la fiche du fabricant, à cette hauteur-là.** L'application ne promet jamais un débit."],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3100, 6200], lignes: [
        ["Type d'installation", "Cinq types ; décide du prix de la porte au m² et de la crémaillère."],
        ["Fréquence d'usage quotidienne", "La marge sur le poids : × 1,1 / × 1,25 / × 1,5."],
        ["Électricité disponible à proximité ?", "« Non » fait recommander le kit solaire autonome ; il ne le coche pas tout seul."],
        ["Ligne Porte — prix du m²", "Se corrige pour ce devis ; revient à la valeur d'office si on change de type."],
        ["Liste déroulante d'une ligne d'équipement", "Un autre article du stock de la même famille ; « — Aucun — » retire la ligne."],
        ["✏️ Saisir un article hors stock → Valider", "Un article absent du stock : nom et prix. Aucune sortie de stock à la vente."],
        ["Annuler (revenir à la sélection / recherche automatique)", "Rend la ligne au calcul (Garage) ou au premier article du besoin (sans calcul)."],
        ["HB", "Hors boutique : facturé, mais exclu du chiffre d'affaires et des commissions."],
        ["☀️ Kit solaire autonome / 🔋 Batterie de secours", "Une ligne libre, au prix saisi, catégorie « Alimentation » sur le devis."],
        ["Besoin du client (champ à propositions)", "Les besoins du métier ouvert, puis tout le reste du stock de la boutique."],
        ["Article proposé (champ à propositions)", "Les articles de ce besoin, avec prix ; un clic choisit."],
        ["➕ Ajouter un besoin / Retirer", "Une ligne de plus, ou de moins."],
        ["💧 Quelle pompe pour ce forage ? — ▼ Ouvrir / ▲ Replier", "L'étude de hauteur et de débit ; ne s'enregistre pas."],
        ["Fin du devis, 📲 Envoyer par WhatsApp, 📝 Enregistrer un brouillon, 🛒 Convertir en vente", "Voir chapitre 11 : identiques."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Le prix de la porte au m², d'office** : portail coulissant **80 000 F**, portail battant **55 000 F**, porte sectionnelle **130 000 F**, porte basculante **80 000 F**, rideau métallique **95 000 F**. Ce sont des valeurs de départ, à corriger selon le chantier.",
        "**Le moteur se reconnaît à son poids écrit dans le nom** : « Moteur portail 600kg » est lu 600 kg. Un moteur dont le nom ou la catégorie ne porte pas de « kg » **n'est jamais proposé**. De même, une crémaillère doit porter sa longueur en « m » (« Crémaillère 1m »).",
        "**L'application reconnaît un article du portail** par son rangement (domaine Garage et la bonne famille : Moteur / motorisation, Crémaillère, Télécommande, Photocellules…) ou, s'il n'est pas rangé, par un mot de son nom (« moteur portail », « crémaillère », « télécommande », « cellule », « clignotant », « déverrouillage manuel »).",
        "**Le nombre de vantaux n'entre pas dans le calcul** : il est seulement noté sur le devis. Pour un double vantail, vérifier que le moteur choisi est bien un kit pour deux vantaux, ou corriger la quantité.",
        "**Rien n'est perdu au F5** : les deux volets gardent leurs besoins, leurs choix, leurs quantités, les options et les autres équipements, pour ce compte, jusqu'à l'envoi ou la conversion. Un devis repris prime toujours sur ce brouillon.",
        "**Le matériel du portail se recalcule** à chaque changement de type, de largeur, de poids, d'usage, de télécommandes ou de boutique — sauf les lignes choisies à la main.",
        "**Le devis PDF du portail** commence par un bloc au nom du projet — **« VOTRE PORTAIL COULISSANT »**, « VOTRE RIDEAU MÉTALLIQUE »… — avec trois grandes cases (Dimensions, Poids retenu, Usage quotidien) et une ligne de détail (surface, poids mesuré, télécommandes). **Un devis sans calcul** commence directement par l'équipement : **chaque ligne porte son besoin**, qui titre son groupe dès qu'il compte au moins deux lignes.",
        "**Un devis ne touche pas le stock.** C'est l'encaissement dans 💰 Ventes qui fait sortir les articles liés ; la porte au m², le kit solaire, la batterie de secours et les articles hors stock ne font rien sortir.",
        "**Un domaine créé par l'administrateur** apparaît tout de suite dans ☀️ Dimensionnement, comme un volet sans calcul. Seuls le Solaire et le Garage calculent.",
        "**Les frottements du forage** (5 % d'office) sont une **estimation** : le chiffre exact dépend du diamètre du tuyau, que l'application ne demande pas. L'administrateur la règle dans ⚙ Paramètres.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**📦 Stocks** (chapitre 8) : le **domaine**, la **catégorie** et le **nom** d'un article décident s'il est proposé. Un moteur sans « kg » dans son nom, un article rangé dans le mauvais domaine, une pompe sans profondeur maximale : autant de lignes vides ici. La fiche d'une pompe (puissance, profondeur, débit, tension, hybride) se renseigne dans 📦 Stocks → ✏️ Corriger.",
        "**☀️ Dimensionnement solaire** (chapitre 11) : même boutique de travail, même fin de devis, même envoi, mêmes brouillons.",
        "**💰 Ventes** (chapitre 5) : « 🛒 Convertir en vente » y envoie le panier ; l'encaissement fait sortir le stock.",
        "**📋 Tous les devis** et **📄 Contrats** (chapitres 13 et 14) : le devis envoyé y apparaît, s'y relance, s'y corrige (« Modifier et renvoyer » rouvre le bon volet), se valide et devient un contrat.",
        "**🙋 Clients / espace client** (chapitres 3 et 21) : le compte est créé à l'envoi s'il n'existe pas ; le client voit le devis et peut le valider.",
        "**⚙ Paramètres** (chapitre 23) : les domaines et leurs familles, l'estimation des frottements du forage.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "La **boutique de travail** est celle d'où partira le matériel.",
        "Portail : le **type**, la **largeur**, la **hauteur** et le **poids** sont renseignés — le poids n'est jamais laissé vide.",
        "Le **moteur** proposé porte **au moins** le poids à motoriser (sinon : un plus gros, ou un article hors stock).",
        "La **crémaillère** couvre la largeur + 1 m (coulissant) ; les **accessoires** ont le bon nombre.",
        "Le **prix de la porte au m²** correspond à ce chantier.",
        "Sans électricité sur place : le **kit solaire** est ajouté avec son prix, ou l'écart est expliqué au client.",
        "Devis sans calcul : chaque ligne a un **besoin** ET un **article** ; aucune ligne « Choisissez le besoin à gauche… » ne reste vide.",
        "Forage : le **niveau dynamique** vient du foreur ; **aucun débit** n'a été promis sans la fiche du fabricant.",
        "Les lignes qui ne viennent pas du stock ont **HB** coché ; la **remise** ne dépasse pas 3 % (sinon l'administrateur).",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3300], lignes: [
        ["Laisser le poids vide", "Poids à motoriser 0 kg, catégorie « — » : **aucun moteur n'est proposé**.", "Demander ou estimer le poids du vantail avec le client."],
        ["Choisir « Faible » pour un portail d'immeuble", "La marge est trop petite : moteur sous-dimensionné, qui s'usera vite.", "Compter les ouvertures par jour : au-delà de 30, « Intensive »."],
        ["« Aucun article correspondant » sur le moteur alors qu'il y a des moteurs au stock", "Le nom du moteur ne porte pas sa capacité en « kg », ou il est rangé dans un autre domaine.", "Corriger le nom ou le rangement dans 📦 Stocks (« Moteur portail 600kg »)."],
        ["Le moteur proposé est plus faible que le poids", "Aucun moteur assez fort en stock : l'application a pris le plus gros.", "Choisir un moteur hors stock adapté, ou en commander un."],
        ["Oublier le kit solaire là où il n'y a pas d'électricité", "Le client paie un portail qui ne pourra pas être alimenté.", "Répondre honnêtement à « Électricité disponible ? » et suivre la recommandation."],
        ["Double vantail laissé avec un moteur simple", "Le nombre de vantaux n'entre pas dans le calcul.", "Vérifier le kit (deux bras) ou corriger la quantité."],
        ["Chercher un panneau solaire dans le volet Forage et croire qu'il n'y en a pas", "Il est rangé sous « Autre métier », plus bas dans la liste.", "Descendre dans la liste des besoins, ou taper « panneau »."],
        ["Taper un nom d'article approximatif", "Un nom qui n'est pas exactement celui du stock **ne lie pas** l'article : la ligne n'a pas de prix.", "Cliquer sur la proposition."],
        ["Donner la profondeur du forage au lieu du niveau dynamique", "La hauteur à vaincre est fausse, la pompe aussi.", "Demander le niveau dynamique au foreur."],
        ["Promettre au client le débit maximal écrit sur la pompe", "À la hauteur réelle, la pompe donne beaucoup moins : installation ratée, client mécontent.", "Vérifier le débit à cette hauteur sur la fiche du fabricant."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Un client veut motoriser un **portail coulissant de 4 m × 2 m**, d'environ **400 kg**, ouvert une vingtaine de fois par jour. La boutique a des moteurs de 400 kg, 600 kg et 1 000 kg, et des crémaillères d'1 m.", reponse: "Usage **Moyenne** : 400 × 1,25 = **500 kg** à motoriser, catégorie **Standard (300 à 500 kg)**. Moteur proposé : **600 kg** (le plus petit qui porte 500). Crémaillère : 4 + 1 = **5 m** → **5 crémaillères d'1 m**. Télécommandes × 2, photocellules × 2, clignotant × 1, déverrouillage × 1. Porte : 4 × 2 = **8 m²** × 80 000 F = **640 000 F**." },
        { situation: "Même portail, mais c'est l'entrée d'une résidence : plus de 30 passages par jour.", reponse: "Usage **Intensive** : 400 × 1,5 = **600 kg**, catégorie **Robuste (500 à 800 kg)**. Le moteur de 600 kg convient encore — tout juste. Avec 450 kg, il faudrait 675 kg : le moteur de 1 000 kg." },
        { situation: "Un portail **battant à deux vantaux** de 250 kg chacun.", reponse: "Crémaillère « — (non requise) ». Le poids saisi est celui d'**un vantail** : 250 × 1,25 = 313 kg (Standard). Le nombre de vantaux n'est pas calculé : vérifier que le moteur est un kit deux vantaux." },
        { situation: "Le terrain n'a **pas d'électricité**.", reponse: "« Électricité disponible à proximité ? » → Non : l'écran écrit « (recommandé — pas d'électricité à proximité) » à côté du kit solaire. Le cocher et saisir son prix." },
        { situation: "Un client veut **4 caméras** et un enregistreur. Le métier 📹 Caméra existe.", reponse: "☀️ Dimensionnement → 📹 Caméra. Ligne 1 : besoin « Caméras », article choisi dans la liste, quantité 4. ➕ Ajouter un besoin : « Enregistreurs », quantité 1. Câbles et alimentation dans Autres équipements. Sur le PDF, chaque ligne porte son besoin." },
        { situation: "**Forage** : niveau dynamique 45 m, réservoir sur une tour de 8 m, 60 m de tuyau, 3 000 litres par jour. En stock : pompes de 40 m, 60 m et 90 m renseignées, une quatrième sans fiche.", reponse: "Hauteur à vaincre : 45 + 8 + 3 (60 m × 5 %, estimés) = **56 m**. Débit : 3 000 ÷ 1 000 ÷ 6 h = **0,5 m³/h**. Conviennent : **60 m** puis **90 m**. Écartée : la 40 m. En ambre : la pompe sans fiche. Avant de promettre 0,5 m³/h, vérifier la courbe du fabricant à 56 m." },
        { situation: "Dans le volet Forage, le vendeur ne trouve pas le **panneau solaire** de la pompe.", reponse: "Il est rangé dans le métier Solaire : il est dans la liste des besoins, **plus bas**, marqué « Autre métier — stock de … ». Taper « panneau » le fait remonter." },
        { situation: "Le client veut un **coffret de marque X** que BMI n'a pas.", reponse: "« ✏️ Saisir un article hors stock » sur la ligne (ou dans Autres équipements) : nom et prix. HB se coche d'office dans Autres équipements ; aucune sortie de stock. Il faudra le commander." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "**En espace formation**, sur une boutique de formation qui a quelques moteurs (avec « kg » dans le nom), des crémaillères, des accessoires et au moins un métier sans calcul avec du stock :"],
      ["ol", [
        "Saisir le portail du premier cas pratique ; retrouver 500 kg, Standard, 5 m et le moteur de 600 kg.",
        "Passer l'usage en Intensive, puis en Faible : noter ce qui change dans les carrés et dans le tableau.",
        "Passer en portail battant : lire « — (non requise) » sur la crémaillère ; revenir en coulissant.",
        "Corriger le prix de la porte au m², puis changer de type et constater qu'il revient à la valeur d'office.",
        "Répondre « Non » à l'électricité ; ajouter le kit solaire avec un prix ; ajouter une batterie de secours.",
        "Choisir un autre moteur dans la liste, puis revenir au calcul par « Annuler (revenir à la sélection automatique) ».",
        "Ouvrir un métier sans calcul ; établir trois lignes (deux du métier, une « Autre métier »), dont une saisie hors stock.",
        "Si le métier forage a des pompes : faire l'étude du cas pratique et lire les trois listes.",
        "Enregistrer un brouillon, le reprendre, l'envoyer à un client de formation ; puis refaire un devis et le convertir en vente, sans encaisser.",
      ]],
      ["note", "Le formateur vérifie surtout : l'employé **demande le poids et l'usage** du portail, **sait dire pourquoi** un moteur est ou n'est pas proposé, **trouve un article d'un autre métier**, et **ne promet jamais un débit** de pompe."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "note les besoins d'un portail (type, dimensions, poids, usage, télécommandes, électricité) ;",
        "explique les quatre carrés : poids à motoriser, catégorie de moteur, crémaillère, télécommandes ;",
        "vérifie le moteur, la crémaillère, les accessoires et le prix de la porte au m² ;",
        "ajoute un kit solaire ou une batterie de secours quand il le faut ;",
        "établit un devis sans calcul : besoin, article, quantité, HB, article hors stock ;",
        "fait une étude de pompe et explique pourquoi on ne promet pas de débit ;",
        "termine, envoie ou convertit le devis comme au chapitre 11.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Un portail de 300 kg, usage moyen : quel poids à motoriser, quelle catégorie de moteur ?",
        "Quelle longueur de crémaillère pour un portail coulissant de 5,4 m ?",
        "Pourquoi un moteur en stock peut-il ne jamais être proposé ?",
        "Quels accessoires l'application ajoute-t-elle d'office, et en quelle quantité ?",
        "Dans un volet sans calcul, où trouve-t-on un article rangé dans un autre métier ?",
        "Qu'est-ce que le niveau dynamique, et qui le donne ?",
        "Pourquoi l'application ne promet-elle jamais le débit d'une pompe ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Note les besoins complets d'un portail",
      "Explique les quatre carrés du portail",
      "Vérifie moteur, crémaillère, accessoires et prix de la porte",
      "Ajoute kit solaire ou batterie de secours à bon escient",
      "Établit un devis sans calcul (besoin, article, hors stock)",
      "Trouve un article rangé dans un autre métier",
      "Fait une étude de pompe sans promettre de débit",
      "Termine, envoie ou convertit le devis",
      "Répond juste aux sept questions de la rubrique 12",
    ],
  },
};
