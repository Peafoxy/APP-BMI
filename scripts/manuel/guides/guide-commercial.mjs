// ============================================================
// GUIDE PAR POSTE — LE COMMERCIAL ET LE RESPONSABLE COMMERCIAL
// (01/10/2026, « Lance » ; décision « 2 oui » : un seul guide pour les
// deux, avec des encadrés « seulement pour le responsable commercial »).
//
// « Ma journée » reprend le livret du 22/09/2026, RELU dans le code le
// 01/10/2026. Le livret était faux sur trois points :
//  - « le premier message d'un client part de mon téléphone avec ses
//    identifiants » : depuis le 25/09, ses ACCÈS (modèle espace) puis le
//    DEVIS (devis_disponible) partent du numéro BMI, en deux messages ;
//  - « 📱 Relancer ouvre WhatsApp » : depuis le 01/10, une question puis le
//    numéro BMI, et le projet de la fiche est demandé s'il manque ; le
//    bouton n'apparaît que sur une relance EN RETARD ;
//  - le livret ne disait rien du responsable commercial : 💰 Ventes (pas
//    🛒 Nouvelle commande), 👑 Mon équipe d'office, 💵 Salaire, la
//    programmation des installations.
// Boutons relus : Prospects.jsx, dimensionnement/Partages.jsx,
// TousLesDevis.jsx, Commandes.jsx, MesTaches.jsx, MonEquipe.jsx,
// MaCommission.jsx, ClientsInstalles.jsx, Whatsapp.jsx, App.jsx.
// ============================================================
export const GUIDE = {
  id: "commercial",
  poste: "Commercial et responsable commercial",
  roles: ["commercial", "resp_commercial"],
  public: "Les commerciaux de BMI, et le responsable commercial",
  duree: "3 jours : la journée et les chapitres les deux premiers jours, l'examen le troisième",
  onglets: ["commande", "ventes", "dimensionnement", "tous_devis", "contrats", "prospects", "parc", "taches", "equipe", "messages", "whatsapp", "commission", "salaire", "nouveau_client"],
  chapitres: [1, 3, 4, 5, 11, 12, 13, 14, 15, 16, 18, 20, 24, 25],

  journee: [
    ["p", "Le commercial **trouve les clients, fait les devis et suit ses chantiers jusqu'à la commission**. Le responsable commercial fait la même chose et, en plus, **dirige l'équipe commerciale** et **programme les installations**. Les mots entre guillemets sont ceux des boutons ; le chapitre du manuel est indiqué entre parenthèses."],
    ["table", { entetes: ["Mes onglets", "À quoi ils me servent"], largeurs: [3300, 6000], lignes: [
      ["🧲 Prospects", "Les contacts, leurs relances, leur conversion en client (chapitre 4)."],
      ["☀️ Dimensionnement · 📋 Tous les devis · 📄 Contrats", "Faire un devis, le suivre, le contrat signé (chapitres 11 à 14)."],
      ["🛒 Nouvelle commande", "**Commercial** : composer le panier d'un client et l'envoyer à la boutique qui encaisse (chapitre 5)."],
      ["💰 Ventes", "**Responsable commercial** : vendre, faire une proforma, reprendre une vente pour en faire un devis (chapitre 5)."],
      ["🏠 Clients installés · ✅ Mes tâches", "Le chantier après la signature ; les tâches qu'on me donne (chapitre 15)."],
      ["👑 Mon équipe", "**Responsable commercial**, et **commercial chef d'équipe ⭐** : les membres, leurs commissions, les apporteurs externes, les tâches (chapitre 16)."],
      ["💵 Ma commission", "Ce qui m'est dû, et pourquoi c'est encore en attente (chapitre 16)."],
      ["🙋 Créer un client · 💬 Messages · 📲 WhatsApp", "Les clients et les conversations (chapitres 3 et 20)."],
      ["💵 Salaire", "**Responsable commercial** : sa paie (chapitre 18)."],
    ] }],

    ["h3", "Le matin"],
    ["etapes", [
      { titre: "Je me connecte", texte: "Barre **bleue** = réel, **violette** = formation. Je regarde 💬 Messages et 📲 WhatsApp : une conversation qui m'est confiée a son compteur à côté de l'onglet, et **la fenêtre de 24 h** pour répondre librement court depuis le dernier message du client (chapitres 1 et 20)." },
      { titre: "🧲 Prospects", texte: "Les lignes en **orange** sont des relances en retard : c'est là que le bouton « 📱 Relancer » apparaît. Une **🤖 Demande de l'assistant WhatsApp** se prend avec « 🙋 Prendre en charge » : le premier qui clique en devient le commercial (chapitre 4)." },
      { titre: "📋 Tous les devis", texte: "Ce que mes devis sont devenus : ⏳ Proposé, ✅ Validé, 💰 Payé, ❌ Rejeté. Une pastille « ⌛ Offre expirée — prix à confirmer » au-delà de 15 jours (chapitre 13)." },
      { titre: "✅ Mes tâches", texte: "Ce que mon responsable m'a donné ; « ✅ Terminer » l'envoie en validation chez lui, avec une photo si possible (chapitre 15)." },
    ]],

    ["h3", "Un nouveau contact — 🧲 Prospects"],
    ["etapes", [
      { titre: "« Nouveau prospect »", texte: "Catégorie, **Projet**, nom, numéro, localisation, le besoin (mes notes : il ne part jamais au client), l'avis, l'intérêt, la date de relance. Puis « ➕ Enregistrer le prospect »." },
      { titre: "Le mot d'accueil part tout seul", texte: "Du **numéro WhatsApp BMI**. S'il ne peut pas partir (formation, réseau, modèle pas encore approuvé), l'écran le dit d'abord, puis WhatsApp s'ouvre sur mon téléphone avec le même texte." },
      { titre: "« 📱 Relancer »", texte: "Sur une relance en retard : une question, puis le message part du numéro BMI **en nommant le projet** de la fiche (s'il manque, l'application le demande une fois)." },
      { titre: "« ✅ Convertir en client »", texte: "Quand il dit oui : sa fiche devient un compte client, ses accès partent du numéro BMI. Rien n'est retapé." },
    ]],
    ["note", "Pour écrire **le premier** à quelqu'un qui n'est pas un prospect : 📲 WhatsApp → « ✍️ Écrire ». Le message part du numéro BMI, et la réponse du client arrive chez moi."],

    ["h3", "Un devis — ☀️ Dimensionnement"],
    ["etapes", [
      { titre: "Le volet", texte: "Solaire (le calcul part des appareils du client), Portail, ou Autre (vidéosurveillance, électricité, forage…). L'application propose le matériel **de la boutique choisie**, au prix du stock (chapitres 11 et 12)." },
      { titre: "Le client", texte: "Dans le cadre « 📲 Envoyer ce devis au client » : un client de l'espace, ou « ➕ Nouveau client » (nom, **prénom obligatoire**, numéro WhatsApp). La case « 🏢 Entreprise cliente » s'il paie au nom d'une société." },
      { titre: "« 📝 Enregistrer un brouillon »", texte: "Si je dois m'interrompre : je le retrouve dans « 📝 Mes brouillons »." },
      { titre: "« 📲 Envoyer par WhatsApp »", texte: "Tout part du **numéro BMI**. Un client qui n'a pas encore ses accès reçoit **deux messages** : ses accès à son espace, puis le devis. S'il les a déjà, le devis part seul." },
    ]],
    ["ul", [
      "**Une remise au-delà de 3 %** est réservée à l'administrateur ; une remise sur un article ET une remise générale ensemble, c'est refusé pour tout le monde.",
      "**« 🤝 Un apporteur externe »** en fin de devis : 3 % d'office, la case est grisée ; seul l'administrateur principal change le taux (sur un brouillon).",
      "Une faute vue après l'envoi : « ✏️ Modifier et renvoyer » (devis ⏳ Proposé) ; un devis **signé** ne se corrige qu'avec l'accord du client (« Demander une modification »). Un devis sans suite : « 📁 Classer sans suite ».",
      "Au bout de 15 jours sans réponse, « Relancer » dans 📋 Tous les devis — avec une question avant l'envoi.",
    ]],

    ["h3", "Une commande pour un client — 🛒 Nouvelle commande (commercial)"],
    ["p", "Je choisis la boutique qui servira, je compose le panier (seulement ce qui est en stock), et « 📤 Envoyer la commande à la boutique ». **C'est la boutique qui encaisse** (« ✅ Valider et encaisser »). Un rabais que j'accorde de moi-même est **pris sur ma commission**, jamais au-delà (chapitre 5)."],
    ["note", "**Seulement pour le responsable commercial** : il n'a pas 🛒 Nouvelle commande mais **💰 Ventes**. Il vend et encaisse comme un vendeur, fait une proforma, et peut reprendre n'importe quelle vente pour en faire un devis d'installation (📋 Devis)."],

    ["h3", "Le chantier — 🏠 Clients installés"],
    ["ul", [
      "Quand le client a signé et payé, le chantier apparaît dans 🏠 Clients installés, catégorie **📅 À programmer**.",
      "Je vois mes propres fiches et les chantiers où je suis dans l'équipe. Je peux **supprimer** un chantier que j'ai apporté : il part à la corbeille 30 jours.",
    ]],
    ["note", "**Seulement pour le responsable commercial** (et l'administrateur) : « 📅 Programmer l'installation » — la date, l'équipe et son chef ⭐. Une **pose seule** ne se programme pas tant que les 70 % ne sont pas versés : l'application le refuse en le disant. Il peut aussi encaisser une pose."],

    ["h3", "Ma commission — 💵 Ma commission"],
    ["regle", "**Une commission n'est due qu'après DEUX choses** : la réception des travaux par le client **et** le solde de sa dette. « Un franc ne sort pas de la caisse avant d'y être entré. »"],
    ["p", "L'écran le dit ligne par ligne : ⏳ en attente de la réception, 💰 réceptionnée mais pas encore payée par le client. Le chiffre affiché est une **estimation** ; le paiement est validé par l'administration ou le chef d'équipe (chapitre 16)."],

    ["h3", "Diriger une équipe — 👑 Mon équipe"],
    ["p", "**Le responsable commercial l'a toujours ; un commercial seulement s'il est chef d'équipe ⭐** (c'est l'administrateur qui nomme un chef)."],
    ["ul", [
      "La vue d'ensemble : chaque membre, son chiffre d'affaires, sa commission due et pourquoi elle attend.",
      "**« ✅ Tâche »** sur la ligne d'un membre lui donne un travail ; quand il l'a terminée, je la **« ✅ Valider »**, ou « ↩ Rouvrir » si elle n'est pas faite.",
      "**🤝 Apporteurs externes** : « ✓ Payer » — le moyen de paiement est celui par lequel le client a payé, la confirmation le dit ; « ✏️ Moyen » pour en choisir un autre.",
      "**Réassigner** un prospect à un collègue (congé, départ) : 🧲 Prospects, bouton « Réassigner », avec le pouvoir « 🔁 Réaffecter les prospects ».",
    ]],

    ["h3", "Le soir"],
    ["p", "Je mets à jour mes prospects (contacté, date de relance), je range mes brouillons, et je réponds aux conversations dont la fenêtre de 24 h se ferme. Je n'ai pas de caisse à clôturer : ce n'est pas mon geste."],
  ],

  examen: {
    intro: "L'examen se passe **dans l'espace de formation** (barre violette), avec le formateur à côté. La personne fait chaque épreuve seule ; le formateur regarde l'écran et coche. Une épreuve est réussie quand on voit à l'écran ce que dit la colonne « Ce qu'on doit voir ». En formation, rien ne part du numéro BMI : WhatsApp s'ouvre sur le téléphone, c'est normal. Les épreuves 11 et 12 sont pour le responsable commercial (ou un commercial chef d'équipe pour la 12) ; l'épreuve 6 est pour le commercial.",
    epreuves: [
      { titre: "Nouveau prospect", consigne: "Enregistrer un prospect avec un projet « solaire » et une date de relance à hier.", attendu: "La fiche est à son nom ; la ligne est en orange (relance en retard) et porte « 📱 Relancer »." },
      { titre: "Relancer", consigne: "Relancer ce prospect.", attendu: "Une question est posée avant l'envoi ; le message nomme le projet ; l'historique de la fiche note la relance." },
      { titre: "Devis solaire", consigne: "Faire un devis solaire pour 10 ampoules de 15 W pendant 12 h et un congélateur de 200 W pendant 24 h, pour un nouveau client (nom, prénom, numéro).", attendu: "Le matériel est proposé ; le devis apparaît « ⏳ Proposé » dans 📋 Tous les devis, chez le client créé." },
      { titre: "Brouillon", consigne: "Commencer un devis, l'enregistrer en brouillon, puis le reprendre et l'envoyer.", attendu: "Le brouillon apparaît dans « 📝 Mes brouillons », puis disparaît une fois envoyé." },
      { titre: "Corriger un devis proposé", consigne: "Sur le devis de l'épreuve 3, « ✏️ Modifier et renvoyer » en ajoutant une ampoule.", attendu: "Le même devis est remplacé (pas de doublon) et porte la trace de la modification." },
      { titre: "Commande (commercial)", consigne: "Composer une commande de deux articles pour un client et l'envoyer à la boutique.", attendu: "La commande apparaît dans 📥 Commandes reçues de la boutique ; rien n'est encaissé." },
      { titre: "Remise au-delà de 3 %", consigne: "Essayer d'envoyer un devis avec une remise générale de 5 %.", attendu: "L'envoi est refusé : au-delà de 3 %, c'est l'administrateur." },
      { titre: "Convertir un prospect", consigne: "Convertir le prospect de l'épreuve 1 en client.", attendu: "La fiche est marquée convertie ; le client existe dans l'espace avec son prénom." },
      { titre: "Ma commission", consigne: "Ouvrir 💵 Ma commission et expliquer une ligne en attente.", attendu: "La personne dit si elle attend la réception (⏳) ou le paiement du client (💰)." },
      { titre: "Une tâche", consigne: "Terminer une tâche donnée par le formateur, avec une photo.", attendu: "La tâche part en validation chez celui qui l'a donnée." },
      { titre: "Programmer (responsable commercial)", consigne: "Programmer l'installation d'un chantier « 📅 À programmer » avec une équipe et son chef ⭐.", attendu: "Le chantier quitte « 📅 À programmer », avec sa date d'installation et son équipe ; le chef porte l'étoile ⭐." },
      { titre: "Équipe (responsable ou chef)", consigne: "Donner une tâche à un membre depuis 👑 Mon équipe, puis réassigner un prospect à un autre commercial.", attendu: "La tâche apparaît chez le membre ; le prospect change de commercial et la fiche le dit." },
    ],
    questions: [
      "Quelles sont les deux conditions pour qu'une commission soit due ?",
      "Un nouveau client reçoit combien de messages à l'envoi de son premier devis, et lesquels ?",
      "Qui peut accorder une remise de 5 % ?",
      "Pourquoi la case « Nature du chantier / besoin » ne part-elle jamais au client ?",
      "Un devis déjà signé contient une erreur : que fait-on ?",
      "Pourquoi ne peut-on plus répondre librement à un client après 24 h ?",
    ],
  },
};
