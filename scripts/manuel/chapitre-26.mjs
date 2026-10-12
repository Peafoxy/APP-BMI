// ============================================================
// MANUEL DE FORMATION — CHAPITRE 26 : Rendez-vous
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// screens/RendezVous.jsx (📅 Rendez-vous : la liste « 💼 Rendez-vous pro /
// 🔒 Rendez-vous privé », « ➕ Nouveau rendez-vous pro / privé », Date,
// Heure, Objet, Lieu, « 🔎 C'est une visite », 🔧 Techniciens / 👥 Autre
// personnel, « Chef de la visite », « Client ou prospect », « Son numéro »,
// la bande des conflits, les groupes Aujourd'hui / Demain / Cette semaine /
// Plus tard, 🕘 Passés, faits ou annulés ; les boutons ✅ Fait, ✏️ Modifier,
// ✖ Annuler, 🗑 Supprimer), lib/rendezVous.js (peutModifierRdv,
// peutMarquerFait, critiqueRendezVous, conflitsRendezVous,
// changementsRendezVous, rappelsRendezVous), lib/whatsappModeles.js (les cinq
// messages), api/_rendezVous.js (les rappels de 14 h et de 7 h),
// lib/notifications.js (la notification au reste du personnel),
// screens/Prospects.jsx (« 📅 Planifier une visite »), App.jsx (l'onglet
// « 📅 Rendez-vous (N) »), supabase/rendez-vous-1-table.sql (qui voit quoi).
// ============================================================
export const CHAPITRE = {
  numero: 26,
  titre: "Rendez-vous",
  sousTitre: "Noter ses rendez-vous pro et privés, organiser une visite avec les techniciens, prévenir l'équipe et le client, rendre compte",
  public: "Tout le personnel (le comptable lit les rendez-vous pro, il n'en crée pas)",
  duree: "30 min, puis l'exercice en espace formation",
  prerequis: "Le chapitre 2 (Utilisateurs) : le numéro de téléphone de chaque fiche. Le chapitre 4 (Prospects) pour les visites.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "noter un **rendez-vous privé**, que personne d'autre ne voit ;",
        "fixer un **rendez-vous pro**, surtout une **visite**, et choisir **qui y va** ;",
        "rattacher une visite à un **prospect** ou à un **client**, et prévenir ce client ;",
        "lire un **conflit** (quelqu'un déjà pris ce jour-là) avant d'enregistrer ;",
        "marquer un rendez-vous **fait** avec son **compte rendu**, le **modifier** ou l'**annuler**.",
      ]],
      ["regle", "**Un rendez-vous PRIVÉ ne se voit que par celui qui l'a noté — l'administrateur non plus.** Ce n'est pas l'écran qui le cache, c'est le serveur qui ne le fait descendre que sur SES appareils."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4300, 5000], lignes: [
        ["Voir les rendez-vous pro de son espace", "**Tout le personnel**, comptable compris."],
        ["Créer un rendez-vous pro ou privé", "**Tout le personnel**, toujours à son propre nom — sauf le comptable (compte en lecture seule)."],
        ["✏️ Modifier, ✖ Annuler un rendez-vous pro", "**Celui qui l'a créé, et l'administrateur.**"],
        ["✅ Marquer un rendez-vous pro fait, écrire le compte rendu", "Son auteur, l'administrateur, **et les participants**."],
        ["Voir, modifier, ✅ Fait, 🗑 Supprimer un rendez-vous privé", "**Son auteur seul.**"],
      ]}],
      ["attention", "Un participant ne peut **que** marquer le rendez-vous fait et écrire le compte rendu : changer la date, le lieu, les participants ou l'annuler lui est refusé — par l'écran et par le serveur."],
      ["note", "**Le mur formation / réel s'applique.** Un rendez-vous créé en regardant la formation naît en formation ; aucun message WhatsApp n'en part jamais."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3100, 6200], lignes: [
        ["📅 Rendez-vous (N)", "**N** = vos rendez-vous d'AUJOURD'HUI encore à venir (vous en êtes l'auteur ou un participant). En haut, la liste « 💼 Rendez-vous pro / 🔒 Rendez-vous privé »."],
        ["🧲 Prospects (ch. 4)", "Sur la ligne d'un prospect : « **📅 Planifier une visite** » (administrateur ou son commercial). Sous la ligne : chaque visite et son **compte rendu**."],
        ["📲 WhatsApp (ch. 20)", "Les avis envoyés du numéro BMI (participant ajouté, changement, visite au client) s'y lisent."],
      ]}],
      ["note", "La liste se range par jour : **Aujourd'hui, Demain, Cette semaine, Plus tard**. Plus bas, « 🕘 Passés, faits ou annulés » garde l'historique (les plus anciens dans les archives)."],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Noter un rendez-vous privé"],
      ["etapes", [
        { titre: "Choisir « 🔒 Rendez-vous privé »", texte: "Dans la liste en haut de l'écran." },
        { titre: "➕ Nouveau rendez-vous privé", texte: "« Date », « Heure », « Objet » (obligatoires), « Lieu (facultatif) »." },
        { titre: "📅 Enregistrer le rendez-vous", texte: "Une confirmation résume le rendez-vous. Il ne prévient personne. La veille à 14 h et le jour même à 7 h, un WhatsApp du numéro BMI vous le rappelle **sans dire l'objet** : « vous avez un rendez-vous personnel le … à … »." },
      ]],
      ["h3", "B. Fixer une visite (rendez-vous pro)"],
      ["etapes", [
        { titre: "Choisir « 💼 Rendez-vous pro » → ➕ Nouveau rendez-vous pro", texte: "Date, heure, objet (« Visite chez MR ERIC »), lieu." },
        { titre: "Cocher « 🔎 C'est une visite »", texte: "Le cadre « 🔧 Techniciens » vient en premier, puis « 👥 Autre personnel » (le commercial du prospect, par exemple). On coche qui y va : **au moins une personne** pour une visite." },
        { titre: "« Chef de la visite »", texte: "Choisi parmi les cochés (le premier d'office). C'est son nom et son numéro que le client recevra." },
        { titre: "« Client ou prospect »", texte: "Taper un nom ou des chiffres du numéro, puis **cliquer** une proposition (👤 compte client ou 🧲 prospect) : le nom, le numéro et le lieu se remplissent. Un nom tapé sans cliquer reste libre." },
        { titre: "Lire la bande ⚠ des conflits", texte: "« KOSSI a déjà un rendez-vous ce jour-là à 10 h… », « … est programmé ce jour-là sur l'installation de … ». **Ce n'est pas un refus** : la confirmation le répète, on enregistre quand même ou on change l'heure." },
        { titre: "📅 Enregistrer le rendez-vous", texte: "Chaque participant reçoit un WhatsApp du numéro BMI (« … vous a ajouté à un rendez-vous BMI TOGO… ») ; **le reste du personnel** reçoit une notification sur son téléphone. Puis, pour une visite avec un numéro : « Prévenir … de la visite… par WhatsApp du numéro BMI ? » — OK envoie la confirmation au client avec le chef de la visite et les contacts de BMI ; Annuler n'envoie rien." },
      ]],
      ["h3", "C. Depuis 🧲 Prospects"],
      ["etapes", [
        { titre: "📅 Planifier une visite", texte: "Ouvre 📅 Rendez-vous avec une visite pro déjà remplie : objet « Visite chez … », le lieu du prospect, le prospect rattaché. Il reste à choisir la date, l'heure et qui y va." },
      ]],
      ["h3", "D. Après le rendez-vous"],
      ["etapes", [
        { titre: "✅ Fait", texte: "Une visite demande son **compte rendu** (ce qui a été vu, la suite : devis à faire…). Il s'affiche sur le rendez-vous et sous la ligne du prospect." },
        { titre: "✏️ Modifier", texte: "Date, heure, lieu, participants. Ceux qui sont concernés reçoivent « changement pour le rendez-vous… : il est déplacé au … », « nouveau lieu », ou « vous n'en faites plus partie » ; un nouveau participant reçoit l'avis complet." },
        { titre: "✖ Annuler (pro)", texte: "**Motif obligatoire** : il est dit aux participants dans leur WhatsApp. Le rendez-vous reste, marqué « ✖ Annulé »." },
        { titre: "🗑 Supprimer (privé)", texte: "Un privé se supprime ; un pro ne se supprime pas, il s'annule (les participants doivent le savoir)." },
      ]],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton", "Quand il apparaît", "Ce qu'il fait"], largeurs: [2300, 2900, 4100], lignes: [
        ["➕ Nouveau rendez-vous pro / privé", "En haut, selon la liste choisie", "Ouvre le formulaire."],
        ["📅 Enregistrer le rendez-vous", "Dans le formulaire", "Vérifie, montre les conflits, enregistre, prévient."],
        ["✅ Fait", "Rendez-vous à venir", "Le marque fait, avec le compte rendu."],
        ["✏️ Modifier", "Pro : auteur, administrateur — Privé : auteur", "Rouvre le formulaire rempli."],
        ["✖ Annuler", "Pro : auteur, administrateur", "L'annule avec un motif, prévient les participants."],
        ["🗑 Supprimer", "Privé : son auteur", "Le retire."],
        ["📅 Planifier une visite", "🧲 Prospects", "Ouvre une visite pro déjà rattachée au prospect."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**La veille à 14 h** et **le jour même à 7 h**, le serveur envoie un rappel WhatsApp du numéro BMI à l'auteur et aux participants (un privé : à son auteur seul, sans l'objet). L'heure exacte peut glisser dans l'heure (14 h 00 à 14 h 59).",
        "**Un participant ajouté** reçoit l'avis complet ; **un changement ou une annulation** est dit à ceux qui sont concernés. Celui qui fait le geste n'est jamais prévenu de son propre geste.",
        "**Le reste du personnel** est informé d'un rendez-vous pro par une notification (rien dans 💬 Messages).",
        "**Rien ne part** pour un rendez-vous de formation, ni vers une fiche sans numéro (l'écran le dit et nomme la fiche à compléter).",
        "Les messages au personnel sont des messages de service (**environ 4 F** chacun). Tant que Meta ne les a pas approuvés, rien ne part et l'écran le dit.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["table", { entetes: ["Module", "Le lien"], largeurs: [3100, 6200], lignes: [
        ["👥 Utilisateurs (ch. 2)", "Le numéro de chaque fiche : sans lui, ni avis ni rappel."],
        ["🧲 Prospects (ch. 4)", "« 📅 Planifier une visite » ; le compte rendu de la visite sous la ligne du prospect."],
        ["🏠 Chantiers (ch. 15)", "Une installation programmée le même jour est signalée comme conflit."],
        ["📲 WhatsApp (ch. 20)", "Les avis partent du numéro BMI et s'y lisent."],
      ]}],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Chaque participant a un **numéro** sur sa fiche.",
        "Chaque visite a un **chef** et, si possible, le **numéro du client**.",
        "Les **conflits** affichés ont été regardés avant d'enregistrer.",
        "Chaque visite faite a son **compte rendu**.",
        "Un rendez-vous qui n'aura pas lieu est **annulé avec un motif**, jamais laissé « à venir ».",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "La bonne façon"], largeurs: [4300, 5000], lignes: [
        ["Noter une visite de chantier en « privé ».", "Tout ce qui concerne BMI est **pro** : sinon personne ne le voit et l'équipe n'est pas prévenue."],
        ["Mettre un détail sensible dans l'objet d'un privé en pensant qu'il partira par WhatsApp.", "Le rappel d'un privé ne dit **jamais** l'objet : c'est voulu, la copie se lit sur le téléphone BMI."],
        ["Se cocher soi-même parmi les participants.", "Inutile : l'auteur est déjà prévenu et rappelé."],
        ["Supprimer un rendez-vous pro qui n'a pas lieu.", "✖ Annuler, avec le motif : les participants le reçoivent."],
        ["Changer la date d'une visite dont on est seulement participant.", "Demander à son auteur ou à l'administrateur : un participant ne fait que ✅ Fait."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "KOSSI (commercial) veut une visite chez le prospect MR ERIC jeudi à 9 h avec le technicien AGBEKO comme chef.", reponse: "🧲 Prospects → 📅 Planifier une visite ; date, 09:00 ; coche AGBEKO (chef d'office) ; Enregistrer. AGBEKO reçoit l'avis ; « Prévenir MR ERIC ? » → OK. Mercredi 14 h et jeudi 7 h, KOSSI et AGBEKO reçoivent le rappel." },
        { situation: "Le jeudi, AGBEKO est déjà programmé sur une installation.", reponse: "La bande ⚠ le dit à KOSSI avant d'enregistrer : il choisit un autre technicien ou une autre heure." },
        { situation: "La visite est faite : toiture saine, 3 kW à prévoir.", reponse: "AGBEKO (participant) clique ✅ Fait et écrit le compte rendu ; KOSSI le lit sous la ligne de MR ERIC dans 🧲 Prospects." },
        { situation: "ANGELE (vendeuse) a un rendez-vous à la banque mardi à 11 h.", reponse: "🔒 Rendez-vous privé, objet « Banque ». Personne d'autre ne le voit ; son rappel dira seulement « un rendez-vous personnel le mardi … à 11 h »." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "En **espace formation**, avec le formateur :"],
      ["ol", [
        "Noter un rendez-vous privé pour demain, puis le modifier et le supprimer.",
        "Fixer une visite pro avec deux participants et un chef, rattachée à un prospect.",
        "Ajouter un participant déjà programmé ce jour-là : lire le conflit.",
        "Se connecter comme participant : marquer la visite faite avec un compte rendu.",
        "Annuler une autre visite avec un motif.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Qui voit un rendez-vous privé ? Et un rendez-vous pro ?",
        "Quand partent les rappels, et que dit celui d'un privé ?",
        "Qui peut changer la date d'un rendez-vous pro ?",
        "Que peut faire un participant ?",
        "Un conflit empêche-t-il d'enregistrer ?",
        "Pourquoi annuler plutôt que supprimer un rendez-vous pro ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Distingue un rendez-vous pro d'un privé",
      "Note un privé et sait ce que dit son rappel",
      "Fixe une visite avec participants et chef",
      "Rattache une visite à un prospect et prévient le client",
      "Lit un conflit avant d'enregistrer",
      "Marque fait avec compte rendu, modifie, annule",
      "Répond juste aux six questions de la rubrique 11",
    ],
  },
};
