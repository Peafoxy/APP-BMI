// ============================================================
// MANUEL DE FORMATION — CHAPITRE 16 : Commissions et primes
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// lib/calculs.js (commissionBloquee — réception ET solde de la dette ;
// commissionBrute — CA × taux, moins le rabais ; motifBlocageCommission ;
// repartirCommissions ; repartirCommissionEquipe ; SEUIL_CHEF_EQUIPE = 5,
// TAUX_EQUIPE_DEFAUT = 10 ; filleulsDe ; estChefEquipe ; partParrainBloquee ;
// posesAvecApporteur ; moyenDuClientPourApporteur ; poserMoyenApporteur ;
// debloquerCommissionsReception ; SEUIL_COMMERCIAL = 5 ;
// TAUX_PARRAINAGE_CLIENT = 3, tauxParrainageDefaut ; ACTIONS_POUVOIR —
// act_commission ; choisirBoutiqueDebitG ; construirePaiementPrime,
// primeDejaPayee, primesEnAttente, primesDeTechnicien, retenueOutilPourPrime),
// screens/MonEquipe.jsx (👑 Équipe / 👑 Mon équipe — Performances par
// commercial, ✓ Marquer payé, ↩ Annuler paiement ; ⭐ Chefs d'équipe, ✓ Payer ;
// 🤝 Apporteurs externes, ✓ Payer, ✏️ Moyen, 🎖 Promouvoir commercial),
// screens/MaCommission.jsx (💵 Ma commission), screens/Commerciaux.jsx
// (🎯 Commerciaux), screens/PrimesRemises.jsx (💰 Primes remises),
// screens/PrimesRecues.jsx (💰 Primes reçues), screens/Ventes.jsx (Commercial,
// Rabais offert, 🤝 apporteur externe, parrain du client),
// screens/Utilisateurs.jsx (💰 Commission, ⭐ Équipe, Nommer chef, 🤝 Parrain),
// screens/Parametres.jsx (🤝 Taux de parrainage par défaut),
// screens/EspaceClient.jsx (🤝 Parrainez vos proches), App.jsx (onglets).
// Les frais d'installation se répartissent au chapitre 15 ; l'apporteur
// nommé dans un devis au chapitre 13 ; la retenue d'un outil perdu au 19.
// ============================================================
export const CHAPITRE = {
  numero: 16,
  titre: "Commissions et primes",
  sousTitre: "Qui touche quoi, quand l'argent devient dû, et comment il sort de la caisse — commerciaux, chefs d'équipe, apporteurs, parrains, primes d'installation",
  public: "Administrateur, responsable commercial, chefs d'équipe ; commercial, technicien, technicien BMI (leur propre commission) ; vendeur (les primes à payer par sa boutique)",
  duree: "1 h 15, puis l'exercice en espace formation",
  prerequis: "Le chapitre 5 (Ventes) : c'est la vente qui porte le commercial, le rabais et l'apporteur. Le chapitre 7 (Dettes) : une commission attend le solde du client. Le chapitre 15 (Chantiers) : la réception et les parts d'installation.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "dire **qui peut toucher de l'argent** sur une vente : le commercial, son responsable, le chef d'équipe, l'apporteur externe, le client parrain, le technicien de chantier ;",
        "calculer une **commission** : chiffre d'affaires × taux, **moins le rabais** que le commercial a offert ;",
        "expliquer **pourquoi une commission attend** : la réception des travaux, **et** le solde du client ;",
        "**payer** une commission, une commission d'équipe, un apporteur externe, depuis 👑 Équipe ;",
        "suivre **sa propre commission** dans 💵 Ma commission ;",
        "faire payer une **prime d'installation** par la bonne boutique (💰 Primes remises) et la suivre (💰 Primes reçues).",
      ]],
      ["regle", "**Un franc ne sort pas de la caisse avant d'y être entré** (Timo, 29/08/2026). Une commission, une part de parrain ou d'apporteur ne devient due qu'après **deux** choses : la **réception** des travaux (quand il y a un chantier) **et** le **solde** de la dette du client."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4300, 5000], lignes: [
        ["Voir 👑 Équipe (tout)", "**L'administrateur** (onglet « 👑 Équipe »)."],
        ["Voir 👑 Mon équipe", "**Le responsable commercial** ; le **commercial, le technicien, le technicien BMI** seulement s'il est **chef d'équipe ⭐**."],
        ["✓ Marquer payé / ✓ Payer / ✏️ Moyen", "Ceux qui ont l'écran **et** le pouvoir « 💰 Valider / payer les commissions » (retirable dans 🔐 Pouvoirs)."],
        ["↩ Annuler paiement", "**L'administrateur.**"],
        ["🎖 Promouvoir commercial (un apporteur externe)", "**L'administrateur.**"],
        ["💵 Ma commission", "Commercial, technicien, technicien BMI, responsable commercial — et **tout employé qui a un taux ou des ventes à son nom**."],
        ["🎯 Commerciaux (agents, performance)", "**L'administrateur.**"],
        ["Fixer un taux de commission, un taux d'équipe, nommer un chef, donner un parrain", "**L'administrateur** (👥 Utilisateurs → ⋯ Gérer)."],
        ["Taux de parrainage par défaut", "**L'administrateur** (⚙ Paramètres)."],
        ["💰 Primes remises (payer une prime d'installation)", "**Le vendeur** de la boutique désignée ; l'administrateur paie aussi depuis 🏠 Clients installés."],
        ["💰 Primes reçues", "**Le technicien** (à commission)."],
      ]}],
      ["note", "**Le mur formation / réel s'applique** : 👑 Équipe et 💵 Ma commission ne montrent que les personnes et les ventes de l'espace regardé ; la caisse qui paie est choisie dans cet espace."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3100, 6200], lignes: [
        ["👑 Équipe / 👑 Mon équipe", "Période (Ce mois / Cette année / Depuis le début) ; les tâches à valider ; **Performances par commercial** ; **⭐ Chefs d'équipe** ; **🤝 Apporteurs externes**."],
        ["💵 Ma commission", "Chiffre d'affaires non réglé, taux, commission à payer ; les sommes en attente ; mon équipe ; mes paiements reçus ; mes primes d'installation ; le détail des ventes."],
        ["🎯 Commerciaux", "Les agents, leur zone, leur objectif mensuel, et un classement par chiffre d'affaires."],
        ["💰 Primes remises", "Les demandes de prime adressées à la caisse de SA boutique, et l'historique des primes payées."],
        ["💰 Primes reçues", "Les parts d'installation du technicien : en attente, déjà payées."],
        ["💰 Ventes (formulaire)", "Le **Commercial** de la vente, le **Rabais offert**, la case **🤝 apporteur externe**."],
        ["🏠 Mon espace (client)", "Le cadre **🤝 Parrainez vos proches** et ses gains."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Les six façons de toucher de l'argent"],
      ["table", { entetes: ["Qui", "Sur quoi", "Combien"], largeurs: [2600, 3400, 3300], lignes: [
        ["Le **commercial** d'une vente", "La vente où il est nommé « Commercial »", "Chiffre d'affaires × **son taux** (👥 Utilisateurs), **moins le rabais** qu'il a offert."],
        ["Le **responsable** associé", "Une vente où il est nommé responsable", "Chiffre d'affaires × son taux (il ne paie pas le rabais du commercial)."],
        ["Le **chef d'équipe ⭐**", "Les ventes de ses **recrues**", "**10 %** de la commission de chaque recrue d'office (« ⭐ Équipe », réglable)."],
        ["L'**apporteur externe** 🤝", "La vente (ou la pose seule) qu'il a amenée", "**3 %** du total d'office ; jamais un montant fixe, sauf l'administrateur principal (chapitre 5)."],
        ["Le **client parrain**", "L'installation de son filleul", "**3 %** du total d'office (⚙ Paramètres → 🤝 Taux de parrainage par défaut, ou un taux personnel)."],
        ["Le **technicien de chantier**", "Les frais d'installation", "Sa **part** de la répartition (chapitre 15, rubrique 4 G)."],
      ]}],
      ["h3", "B. Quand une commission devient due"],
      ["etapes", [
        { titre: "Vente au comptoir, payée comptant", texte: "Due **tout de suite** : pas de chantier, pas de dette." },
        { titre: "Vente à crédit", texte: "Due quand la **dette est soldée**. Tant que le client doit, la ligne dit « 💰 + … — client doit … »." },
        { titre: "Vente née d'un devis d'installation", texte: "Gelée jusqu'à la **réception** du chantier (PV signé, forcé, ou réception automatique à 7 jours) — **puis** jusqu'au solde de la dette. La ligne dit « ⏳ + … à la réception »." },
        { titre: "Le jour venu", texte: "Rien à faire : la commission **s'ajoute d'elle-même** à la colonne « Commission due ». Le parrain reçoit un message dans son espace." },
      ]],
      ["h3", "C. Payer la commission d'un commercial (👑 Équipe)"],
      ["etapes", [
        { titre: "Choisir la période", texte: "Ce mois, Cette année, ou Depuis le début. La commission due ne compte que les ventes **pas encore réglées** et **exigibles**." },
        { titre: "✓ Marquer payé", texte: "Sur la ligne du commercial. Choisir le **moyen de paiement** (la banque de sa fiche est rappelée), puis **la caisse débitée** (une boutique de l'espace, ou « Chez le comptable » en réel)." },
        { titre: "Lire la confirmation", texte: "Montant, nombre de ventes, taux ; et ce qui **n'est pas** payé aujourd'hui (⏳ réception, 💰 client qui doit encore). **Action définitive** pour ces ventes." },
        { titre: "Ce qui s'écrit", texte: "Une dépense **« Commissions »** dans la caisse choisie ; le montant exact est inscrit sur chaque vente ; le commercial reçoit un message ; le vendeur (ou le comptable) de la caisse est prévenu." },
      ]],
      ["attention", "**Seules les ventes exigibles sont marquées payées.** Une vente gelée reste en attente : le jour de la réception, sa commission revient d'elle-même dans « Commission due ». Si un paiement a été fait par erreur, **↩ Annuler paiement** (administrateur) remet les ventes « à payer » et retire la dépense — **depuis la même période** que celle du paiement, sinon l'application refuse (« Depuis le début » pour tout annuler)."],
      ["h3", "D. Le chef d'équipe ⭐"],
      ["etapes", [
        { titre: "Devenir chef", texte: "**Automatiquement à 5 recrues** (commerciaux ou techniciens dont il est le parrain — 👥 Utilisateurs → 🤝 Parrain), ou **nommé** par l'administrateur (« Nommer chef »). Un technicien BMI peut être nommé chef." },
        { titre: "Sa part", texte: "Un pourcentage de la commission de chaque recrue (**10 %** d'office, « ⭐ Équipe … % »). Même règle de gel : rien tant que la vente de la recrue est gelée." },
        { titre: "✓ Payer (cadre ⭐ Chefs d'équipe)", texte: "Moyen, caisse, confirmation : une dépense « Commissions » (commission d'équipe), un message au chef." },
      ]],
      ["h3", "E. L'apporteur externe 🤝"],
      ["etapes", [
        { titre: "Il se déclare sur la vente ou dans le devis", texte: "Nom, téléphone, **3 %** grisé (chapitres 5 et 13). Il n'a **pas de compte** : il n'existe que sur ses ventes." },
        { titre: "✓ Payer (cadre 🤝 Apporteurs externes)", texte: "**Aucune question sur le moyen** : il est payé **par le moyen avec lequel le client a payé** (« 💳 Mobile Money (Flooz) — comme le client a payé »). La confirmation le nomme." },
        { titre: "✏️ Moyen", texte: "Pour le payer autrement : on choisit une fois, c'est retenu (« choisi »)." },
        { titre: "🎖 Promouvoir commercial (administrateur)", texte: "À partir de **5 clients apportés** (« 🎖 Éligible commercial ») : un compte commercial est créé, avec identifiant, mot de passe provisoire et taux." },
      ]],
      ["h3", "F. Le client parrain"],
      ["etapes", [
        { titre: "Le client parraine", texte: "🏠 Mon espace → **🤝 Parrainez vos proches** : nom et numéro du proche ; un compte est créé pour lui, et WhatsApp s'ouvre pour le prévenir." },
        { titre: "Le filleul achète une installation", texte: "À l'encaissement du devis, le parrain est posé comme **apporteur** de la vente, à son taux (3 % d'office)." },
        { titre: "Il voit ses gains", texte: "« À vous verser », « En attente », « Déjà reçu » dans son espace. Il est payé comme un apporteur externe, depuis 👑 Équipe." },
      ]],
      ["h3", "G. Les primes d'installation"],
      ["etapes", [
        { titre: "La répartition (administrateur)", texte: "🏠 Clients installés → 🔧 Frais (chapitre 15)." },
        { titre: "📤 Demander le paiement", texte: "L'administrateur choisit **la boutique qui paiera** : la demande apparaît dans **💰 Primes remises** de cette boutique." },
        { titre: "✓ Valider et payer (le vendeur de la boutique)", texte: "Moyen de paiement, confirmation, sortie de caisse ; le technicien est prévenu. Une part **déjà payée** (par l'administrateur, ou sur un autre appareil) est refusée : la caisse n'est jamais débitée deux fois." },
        { titre: "Outil perdu", texte: "Un technicien **à commission** qui doit un outil perdu voit la retenue **annoncée** et prise sur sa part ; « Il reçoit : … » (chapitre 19)." },
        { titre: "💰 Primes reçues (technicien)", texte: "« En attente de paiement », « Déjà payé », et pour chaque chantier : répartition enregistrée, demandée au vendeur de …, ou payée le …" },
      ]],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton", "Où", "Ce qu'il fait"], largeurs: [2800, 2300, 4200], lignes: [
        ["Ce mois / Cette année / Depuis le début", "👑 Équipe, 💵 Ma commission", "Choisit la période des ventes comptées."],
        ["✓ Marquer payé", "👑 Équipe → Performances", "Paie la commission due d'un commercial ; dépense « Commissions »."],
        ["↩ Annuler paiement", "👑 Équipe → Performances", "Remet les ventes réglées de la période « à payer » et retire la dépense (administrateur)."],
        ["✅ Tâche / 🗂 voir", "👑 Équipe → Performances", "Assigne une tâche ; montre les tâches d'un membre."],
        ["✓ Payer", "⭐ Chefs d'équipe", "Paie la commission d'équipe d'un chef."],
        ["✓ Payer", "🤝 Apporteurs externes", "Paie l'apporteur par le moyen du client (ou son moyen choisi)."],
        ["✏️ Moyen", "🤝 Apporteurs externes", "Change le moyen de paiement d'un apporteur ; retenu ensuite."],
        ["🎖 Promouvoir commercial", "🤝 Apporteurs externes", "Crée un compte commercial à un apporteur de 5 clients ou plus."],
        ["📄 Exporter les commissions", "🎯 Commerciaux", "Exporte le classement de la période (CSV)."],
        ["Modifier / Désactiver / Suppr.", "🎯 Commerciaux", "Taux et objectif d'un agent ; activer ou retirer."],
        ["✓ Valider et payer", "💰 Primes remises", "Paie une prime d'installation depuis la caisse de la boutique."],
        ["💰 Commission … % / ⭐ Équipe … % / Nommer chef / 🤝 Parrain", "👥 Utilisateurs → ⋯ Gérer", "Taux de commission, taux d'équipe, chef, recruteur."],
      ]}],
      ["attention", "**Deux taux existent, et un seul paie.** Le taux qui sert au **paiement** est celui de la fiche de l'employé (👥 Utilisateurs → 💰 Commission). Celui de 🎯 Commerciaux (« Modifier ») ne sert qu'au **classement** et à l'estimation « Commissions estimées (CA × taux) ». Changez le taux dans 👥 Utilisateurs."],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**À la réception** d'un chantier (PV signé, forcé, ou automatique à 7 jours), la commission du commercial et la part du parrain ou de l'apporteur sont **débloquées**. Le parrain reçoit un message : « maintenant due » si son filleul a fini de payer, sinon « deviendra due dès que votre filleul aura fini de payer ».",
        "**Au solde de la dette**, la commission gelée « 💰 » passe d'elle-même dans « Commission due ».",
        "**Un rattrapage**, à l'ouverture de l'application, débloque les chantiers déjà réceptionnés dont la vente était restée gelée.",
        "**Chaque paiement** crée une dépense (« Commissions », « Prime d'installation »), prévient le bénéficiaire et le vendeur ou le comptable de la caisse qui paie.",
        "**Un paiement relit la base** juste avant d'écrire : si quelqu'un a payé la même chose sur un autre appareil, rien n'est enregistré.",
        "**Le montant versé est inscrit sur la vente** : changer un taux plus tard ne change pas ce qui a déjà été payé.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["table", { entetes: ["Module", "Le lien"], largeurs: [3100, 6200], lignes: [
        ["💰 Ventes (ch. 5)", "La vente porte le commercial, le rabais (pris sur sa commission, plafonné à elle) et l'apporteur externe."],
        ["📋 Dettes (ch. 7)", "Une commission attend le solde de la dette de sa vente."],
        ["Devis (ch. 13)", "L'apporteur externe nommé dans le devis suit jusqu'à la vente ou à la pose seule."],
        ["🏠 Chantiers (ch. 15)", "La réception débloque ; les frais d'installation deviennent des primes."],
        ["📤 Dépenses (ch. 17)", "Chaque paiement est une dépense de la caisse choisie."],
        ["💵 Salaires (ch. 18)", "Le technicien BMI est salarié : sa commission sur une vente s'ajoute à part."],
        ["🧰 Outillage (ch. 19)", "Une retenue d'outil perdu se prend sur la part d'un technicien à commission."],
      ]}],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "La vente porte le bon **Commercial** (ou l'apporteur) avant l'encaissement.",
        "Le **taux** de chaque commercial est à jour dans 👥 Utilisateurs.",
        "Avant de payer, lire les lignes ⏳ et 💰 : elles ne sont pas payées aujourd'hui.",
        "La **caisse débitée** est la bonne, et elle contient l'argent.",
        "Le moyen de l'apporteur externe convient (sinon ✏️ Moyen).",
        "Une prime d'installation est demandée à la bonne boutique.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "La bonne façon"], largeurs: [4300, 5000], lignes: [
        ["Promettre sa commission à un commercial dès la signature du devis.", "Elle attend la réception **et** le solde du client."],
        ["Changer le taux dans 🎯 Commerciaux en croyant changer la paie.", "Le taux payé est celui de 👥 Utilisateurs → 💰 Commission."],
        ["Accorder un gros rabais « au nom de BMI ».", "Le rabais est pris sur **la commission du commercial**, plafonné à elle : ce n'est pas une remise."],
        ["Annuler un paiement depuis « Ce mois » alors qu'il couvrait plusieurs mois.", "Refusé : se mettre sur « Depuis le début », puis annuler."],
        ["Payer deux fois une prime (administrateur et vendeur).", "L'application refuse la seconde : la part est déjà payée."],
        ["Chercher un apporteur externe dans 👥 Utilisateurs.", "Il n'a pas de compte : il est dans 👑 Équipe → 🤝 Apporteurs externes."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "KOFFI (taux 5 %) vend 1 000 000 F d'articles au comptoir, comptant, et offre 10 000 F de rabais au client.", reponse: "Le client paie 990 000 F. Commission : 1 000 000 × 5 % = 50 000 F, moins les 10 000 F de rabais = **40 000 F**, due tout de suite." },
        { situation: "La même vente est née d'un devis d'installation, et le client a payé 300 000 F.", reponse: "Gelée : « ⏳ à la réception ». Après le PV, toujours gelée : « 💰 — client doit 690 000 F ». Due le jour où la dette est soldée." },
        { situation: "KOFFI a été recruté par AMA, chef d'équipe à 10 %.", reponse: "AMA touche 10 % des 40 000 F = **4 000 F**, dans le cadre ⭐ Chefs d'équipe, aux mêmes conditions de gel." },
        { situation: "Un apporteur externe amène une vente comptant de 600 000 F payée par Flooz.", reponse: "3 % = **18 000 F**, payés par Flooz sans question (✏️ Moyen pour changer)." },
        { situation: "Le technicien KOSSI a une part de 26 532 F et doit 10 000 F pour un outil perdu.", reponse: "Au paiement dans 💰 Primes remises, la retenue est annoncée : il reçoit **16 532 F**, la caisse sort 16 532 F." },
        { situation: "Un commercial dit : « ma commission est en attente de réception, mais le client a signé le PV hier ».", reponse: "Regarder 💵 Ma commission : si le cadre dit « 💰 en attente du paiement du client », c'est la dette qui n'est pas soldée." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "En **espace formation**, avec le formateur :"],
      ["ol", [
        "(Administrateur) Fixer à 5 % le taux d'un commercial d'entraînement dans 👥 Utilisateurs.",
        "Encaisser une vente comptant à son nom avec un rabais ; calculer la commission à la main, puis la lire dans 👑 Équipe.",
        "Encaisser une vente à crédit à son nom ; constater « 💰 client doit … » ; solder la dette ; constater que la commission est due.",
        "Payer la commission (✓ Marquer payé) ; retrouver la dépense et le paiement dans 💵 Ma commission du commercial.",
        "Encaisser une vente avec un apporteur externe par Mobile Money ; le payer ; lire le moyen repris.",
        "(Administrateur) Demander le paiement d'une prime d'installation à une boutique ; (vendeur) la valider dans 💰 Primes remises.",
      ]],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "nomme les six façons de toucher de l'argent ;",
        "calcule une commission avec rabais ;",
        "explique les deux conditions (réception, solde) et lit ⏳ et 💰 ;",
        "paie une commission, une commission d'équipe, un apporteur, en choisissant la bonne caisse ;",
        "sait où se change le taux qui paie ;",
        "fait payer et suit une prime d'installation.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Sur quelle base se calcule une commission, et que retire-t-on ?",
        "Quelles sont les deux conditions pour qu'une commission de devis soit due ?",
        "À combien de recrues devient-on chef d'équipe automatiquement ?",
        "Par quel moyen un apporteur externe est-il payé, sans question ?",
        "Où change-t-on le taux qui sert au paiement ?",
        "Qui paie une prime d'installation demandée à une boutique ?",
        "Que fait ↩ Annuler paiement, et pourquoi faut-il la même période ?",
        "Que voit un client parrain dans son espace ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Nomme qui peut toucher de l'argent sur une vente",
      "Calcule une commission avec rabais",
      "Explique réception ET solde, lit ⏳ et 💰",
      "Paie commission, commission d'équipe, apporteur",
      "Choisit la bonne caisse et le bon moyen",
      "Sait où se règle le taux qui paie",
      "Fait payer et suit une prime d'installation",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
