// ============================================================
// MANUEL DE FORMATION — CHAPITRE 2 : Utilisateurs, rôles et pouvoirs
//
// Des MOTS, rien d'autre. Chaque bouton, chaque règle vient du code :
// screens/Utilisateurs.jsx, screens/Parametres.jsx (👑 Administrateur
// principal), lib/calculs.js (ONGLETS_ROLE, ACTIONS_POUVOIR, aDroit,
// estAdminPrincipal), lib/constants.js (SALARIES), lib/comptesClients.js.
// ============================================================
export const CHAPITRE = {
  numero: 2,
  titre: "Utilisateurs, rôles et pouvoirs",
  sousTitre: "Créer les comptes, donner à chacun son métier, retirer un pouvoir, bloquer, transmettre le rôle principal",
  public: "L'administrateur, et l'administrateur principal pour les gestes qui lui sont réservés",
  duree: "1 heure, puis l'exercice en espace formation",
  prerequis: "Le chapitre 1. Un compte administrateur. Pour l'exercice : une boutique de formation créée dans ⚙ Paramètres → Boutiques.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'administrateur sait :"],
      ["ul", [
        "créer un compte d'**employé** (avec son rôle, sa boutique, son taux) et un compte de **client** (identifiant et mot de passe fabriqués par l'application) ;",
        "lire la liste des utilisateurs et retrouver quelqu'un par son nom ou son numéro ;",
        "**retirer un pouvoir** à un compte sans changer son rôle (un onglet, une action), et le rétablir ;",
        "**bloquer** un compte, le réactiver, le supprimer ; corriger son identité, son téléphone, sa banque ;",
        "ce que seul l'**administrateur principal** peut faire : changer un mot de passe, un rôle, un espace, transférer le rôle principal.",
      ]],
      ["note", "La paie (salaire, primes, avances, virements, crédits) se règle aussi depuis cet écran, dans « ⋯ Gérer ». Elle a son propre chapitre, le 18 : ici on ne fait que la situer."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [5200, 4100], lignes: [
        ["Ouvrir 👥 Utilisateurs, créer un compte, 🆔 Identité, 📞 Téléphone, 🏦 Banque, 🏬 Boutique, 🔐 Pouvoirs, ⛔ Bloquer / ✅ Réactiver, 🗑 Supprimer, Nommer chef, les taux de commission", "**Tout administrateur**"],
        ["🔑 Changer le mot de passe, 🎭 changer le rôle, 🎓 passer un compte de réel en formation (et l'inverse), 👁 Voir le mot de passe, ⚠ Actions groupées", "**L'administrateur principal seul**"],
        ["👑 Transférer le rôle d'administrateur principal (⚙ Paramètres)", "**L'administrateur principal seul**"],
        ["🙋 Créer un client (onglet à part, sans passer par 👥 Utilisateurs)", "Vendeur, gérant, magasinier, commercial, technicien, comptable, administrateur"],
      ]}],
      ["regle", "Un administrateur voit et modifie tout, **sauf ce qui est réservé au principal**. Le principal est unique : c'est lui qui donne les mots de passe, change les rôles et décide qui voit l'espace formation. Ce n'est pas un pouvoir qu'on coche, c'est ce qu'il est."],
    ]},

    // ── 3
    { titre: "Accès dans BMI-Gestion", blocs: [
      ["ul", [
        "**👥 Utilisateurs** : l'onglet, réservé à l'administrateur. En haut, le formulaire de création ; en dessous, la liste, avec une pastille par rôle (« Vendeur (3) », « Client (42) »…) et la ligne de recherche.",
        "**🔐 Pouvoirs** : le bouton rond violet sur la ligne d'un compte.",
        "**⋯ Gérer** : le bouton gris à droite de la ligne, qui ouvre un panneau sous le compte, rangé par thème (Compte, Paie, Commercial, Client).",
        "**⚙ Paramètres → 👑 Administrateur principal** : le transfert du rôle principal.",
        "**🙋 Créer un client** : l'onglet de tous les employés pour créer un client en trente secondes.",
      ]],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Les rôles, et ce que chacun voit"],
      ["table", { entetes: ["Rôle (tel qu'il s'affiche)", "Métier", "Ses onglets"], largeurs: [2500, 2100, 4700], lignes: [
        ["Vendeur", "Vend en boutique, clôture le jour", "Ventes, Commandes reçues, Dimensionnement, Tous les devis, Ravitaillement, Dépenses (lecture), Dettes, Clients, Caisse, Salaire, Messages, WhatsApp, Créer un client, Primes remises, Contrats, Travaux à crédit"],
        ["Gérant de boutique", "Tient la boutique : stock, dépenses, versements", "Comme le vendeur, plus Stocks et Fournisseurs ; sans Ravitaillement ni Primes remises"],
        ["Magasinier", "Tient le magasin et l'outillage", "Stocks, Salaire, Messages, WhatsApp, Créer un client, Travaux à crédit, Outillage"],
        ["Commercial", "À commission, apporte des clients", "Nouvelle commande, Dimensionnement, Tous les devis, Prospects, Clients installés, Mes tâches, Messages, WhatsApp, Ma commission, Équipe (s'il est chef), Créer un client, Contrats"],
        ["Technicien (commission)", "Installe, à commission", "Comme le commercial, plus Primes reçues, Dépenses (les siennes), Outillage"],
        ["Technicien BMI (salarié)", "Installe, salarié ; peut être chef des techniciens", "Dimensionnement, Tous les devis, Clients installés, Prospects, Mes tâches, Équipe (s'il est chef), Ma commission, Messages, WhatsApp, Salaire, Créer un client, Contrats, Dépenses, Outillage"],
        ["Responsable Commercial (salarié)", "Dirige les commerciaux", "Équipe, Prospects, Mes tâches, Clients installés, Dimensionnement, Tous les devis, Contrats, Messages, WhatsApp, Ma commission, Salaire, Créer un client"],
        ["Comptable (lecture seule)", "Consulte, exporte, pointe les décaissements", "Tableau de bord, Rentabilité, Dépenses, Chez le comptable, Dettes, Caisse, Stocks, Clients, Historique, Messages, Salaire, Créer un client"],
        ["Administrateur", "Dirige", "Tout, y compris Salaires (tous), Utilisateurs, Historique, Paramètres"],
        ["Client", "A acheté chez BMI", "Mon espace, Messages, Mes données, Mes contrats"],
      ]}],
      ["note", "**Salariés** (sur le bulletin de paie) : vendeur, gérant, magasinier, technicien BMI, responsable commercial, comptable. Le commercial et le technicien à commission ne sont pas sur la paie : ils touchent une commission. Le vendeur, le gérant et le magasinier sont **rattachés à une boutique** ; les autres couvrent toutes les boutiques."],

      ["h3", "B. Créer un compte d'employé"],
      ["etapes", [
        { titre: "« Nom »", texte: "Le nom avec lequel la personne se connectera (par exemple ESSO). **Il doit être libre** : si un employé le porte déjà, l'application refuse, nomme qui l'a, et propose un nom libre (le prénom accolé, « ESSO KOSSI », sinon les chiffres du numéro)." },
        { titre: "« Mot de passe »", texte: "Tapé par vous, 6 caractères au moins. Vous ne pourrez plus le relire ensuite : il est rangé chiffré. Notez-le pour le remettre à la personne." },
        { titre: "« Prénom »", texte: "Comme sur la pièce d'identité. Il remplit le **nom complet** qui va sur le bulletin de paie et la déclaration CNSS. Il ne change pas l'identifiant de connexion." },
        { titre: "« Téléphone »", texte: "Son numéro : il sert à lui envoyer ses identifiants par WhatsApp, et il reste sur sa fiche (📞 dans ⋯ Gérer)." },
        { titre: "« Rôle »", texte: "Choisir dans la liste. Selon le rôle, d'autres cases apparaissent : **« Boutique »** (vendeur, gérant, magasinier), **« Taux de commission (%) »** (commercial, technicien ; facultatif pour responsable commercial et technicien BMI), **« Taux d'avancement annuel (%) »** (les salariés), et la case **« Chef d'équipe »** (commercial : responsable commercial ; technicien : chef des techniciens)." },
        { titre: "La phrase de l'espace", texte: "Sous le formulaire, une phrase dit dans quel espace le compte va naître : « Ce compte sera créé dans l'espace RÉEL » ou « 🎓 … D'ENTRAÎNEMENT ». C'est l'espace que vous regardez qui décide. Lisez-la avant de cliquer." },
        { titre: "« Créer »", texte: "Le compte existe. Si un numéro a été saisi, l'application propose : « Envoyer ces identifiants à … par WhatsApp ? » — WhatsApp s'ouvre avec le nom et le mot de passe, vous n'avez qu'à appuyer sur Envoyer." },
      ]],
      ["attention", "Un compte de formation rattaché à une boutique exige une boutique **de formation**. S'il n'en existe aucune, la création est refusée et l'écran dit où en créer une (⚙ Paramètres → Boutiques, en regardant 🎓 Formation). Sans ce refus, un compte « formation » aurait travaillé pour de bon sur une vraie boutique."],

      ["h3", "C. Créer un compte de client"],
      ["etapes", [
        { titre: "Rôle « Client »", texte: "Le formulaire se réduit à **« Nom »** et **« Numéro de téléphone »**. Rien d'autre à taper." },
        { titre: "Le mot de passe se fabrique tout seul", texte: "**6 caractères pris dans les chiffres de son numéro et les lettres de son nom**, mélangés toujours de la même façon pour ce client — donc recalculables, jamais écrits en clair. L'identifiant, c'est le nom ; si un autre client le porte déjà, l'application y accole des chiffres du numéro. Les deux s'affichent en bleu avant même de cliquer." },
        { titre: "« Créer », puis la confirmation", texte: "« Créer le compte client de … ? 👤 Identifiant … 🔑 Mot de passe … Remettez-lui ces identifiants. » Puis : « Envoyer ces identifiants au client par WhatsApp ? »" },
      ]],
      ["note", "Parce qu'il est fabriqué par une règle, le mot de passe d'un client **se retrouve** : « 👁 Voir le mot de passe » (administrateur principal) le recalcule et vous pouvez le lui renvoyer. Celui d'un employé, non : il faut en poser un nouveau avec 🔑."],

      ["h3", "D. Lire la liste"],
      ["ul", [
        "**Une pastille par rôle** au-dessus de la liste, avec le nombre : cliquer filtre. La ligne de recherche trouve par le **nom** comme par le **numéro** (« 90112233 », « +228 90 11 22 33 » et « 228 » trouvent le même compte).",
        "Sur chaque ligne : le nom (le nom complet dessous), **📞 le numéro** avec le logo WhatsApp (sur un client, le clic prépare le mot de fidélité), le rôle en pastille (avec « ⭐ Chef », le taux de commission), la boutique (« Toutes » pour un rôle sans boutique), le statut, et **🎓 Formation** pour un compte d'entraînement.",
        "**« ⚠ Identité »** en orange : la pièce d'identité n'est pas renseignée. Bouton 🆔.",
      ]],

      ["h3", "E. Les quatre boutons ronds"],
      ["table", { entetes: ["Bouton", "Ce qu'il fait", "Qui"], largeurs: [2300, 5000, 2000], lignes: [
        ["🔐 Pouvoirs", "Ouvre la fenêtre « 🔐 Pouvoirs de … » : deux listes de cases, **« Onglets accessibles »** et **« Actions autorisées »**. Décocher retire ; « Tout rétablir » remet tout. Le chiffre sur le bouton dit combien de pouvoirs sont retirés.", "Administrateur"],
        ["🆔 Identité", "Nom et prénoms officiels (bulletin de paie), type et numéro de la pièce d'identité.", "Administrateur"],
        ["🔑 Mot de passe", "Pose un nouveau mot de passe (6 caractères au moins). Prend effet à la prochaine connexion de la personne.", "Principal"],
        ["⛔ Bloquer / ✅ Réactiver", "Un compte bloqué ne peut plus se connecter (« Ce compte a été bloqué par l'administrateur. »). Rien n'est effacé ; on réactive d'un clic.", "Administrateur"],
      ]}],

      ["h3", "F. « ⋯ Gérer » — le panneau sous la ligne"],
      ["table", { entetes: ["Ligne", "Boutons", "Qui"], largeurs: [1700, 5600, 2000], lignes: [
        ["Compte", "🎭 Rôle · 🎓 Formation / Réel · 🏬 Boutique · 📞 Téléphone · 🎂 Anniversaire (jour et mois seulement) · 👁 Voir le mot de passe · 🗑 Supprimer", "Rôle, espace et mot de passe : principal ; le reste : administrateur"],
        ["Paie", "💵 Salaire · 📈 Taux % · + Prime · − Avance · 🏦 Banque · 💸 Virement · Annuler virement · les crédits (Approuver / Refuser / + Remboursement)", "Administrateur — voir le chapitre 18"],
        ["Commercial", "💰 Commission (taux) · 🤝 Parrain · ⭐ Équipe (taux du chef) · Nommer chef / Retirer chef", "Administrateur — voir le chapitre 16"],
        ["Client", "Autoriser chat libre / Retirer chat libre", "Administrateur — voir le chapitre 20"],
      ]}],

      ["h3", "G. Changer le rôle d'un compte (principal)"],
      ["etapes", [
        { titre: "⋯ Gérer → 🎭 Rôle", texte: "Choisir le nouveau rôle dans la liste. Jamais sur un client (« Un compte client ne change jamais de rôle ») et jamais sur sa propre fiche." },
        { titre: "La boutique suit le rôle", texte: "Vers vendeur, gérant ou magasinier sans boutique : l'application demande laquelle. Vers un rôle sans boutique : le rattachement est retiré, et la confirmation le dit." },
        { titre: "Confirmer", texte: "Le changement prend effet **à sa prochaine connexion**. L'ancien rôle reste noté sur la fiche (survol du bouton 🎭)." },
      ]],

      ["h3", "H. Bloquer, supprimer"],
      ["ul", [
        "**⛔ Bloquer** : immédiat pour la prochaine tentative de connexion. Impossible sur soi-même, sur le **dernier administrateur actif**, et sur **l'administrateur principal** (« Transférez d'abord ce rôle »).",
        "**🗑 Supprimer** (⋯ Gérer) : « Supprimer définitivement le compte … ? Ses ventes et actions passées restent enregistrées. » Le compte disparaît, l'histoire reste. Pour effacer aussi le nom d'un client de partout, c'est un autre geste : ⚙ Paramètres → 🔒 Données personnelles (chapitre 23).",
      ]],

      ["h3", "I. Transférer le rôle d'administrateur principal"],
      ["p", "⚙ Paramètres → **👑 Administrateur principal** : choisir un autre administrateur dans la liste, **« ⚠ Transférer »**, confirmer. C'est **immédiat** : vous perdez à l'instant les gestes réservés au principal, et la personne les gagne. À faire avant un départ en congé, jamais à la légère."],
    ]},

    // ── 5
    { titre: "Explication de chaque bouton et champ", blocs: [
      ["table", { entetes: ["Bouton ou champ", "Où", "À quoi il sert"], largeurs: [2600, 2200, 4500], lignes: [
        ["« Nom »", "Formulaire de création", "L'identifiant de connexion. Unique parmi les employés."],
        ["« Mot de passe »", "Formulaire (employé)", "Tapé par l'administrateur, 6 caractères au moins, jamais relisible."],
        ["« Prénom »", "Formulaire (employé)", "Remplit le nom complet de la paie et de la CNSS."],
        ["« Téléphone » / « Numéro de téléphone »", "Formulaire", "Pour envoyer les identifiants par WhatsApp ; sur un client, il fabrique le mot de passe."],
        ["« Rôle »", "Formulaire", "Le métier : il décide des onglets, de la boutique, de la paie ou de la commission."],
        ["« Boutique »", "Formulaire (vendeur, gérant, magasinier)", "La boutique de rattachement, dans l'espace où le compte naît."],
        ["« Taux de commission (%) »", "Formulaire (commercial, technicien…)", "Le pourcentage sur chaque vente qui lui est attribuée. 0 = aucune."],
        ["« Taux d'avancement annuel (%) »", "Formulaire (salariés)", "Sert à proposer le nouveau salaire au moment d'un avancement (💵 Salaire)."],
        ["« Chef d'équipe »", "Formulaire (commercial, techniciens)", "Donne 👑 Équipe et ✅ Mes tâches : il suit ses hommes et leur donne du travail. Un commercial devient chef aussi tout seul à partir de 5 filleuls."],
        ["« Créer »", "Formulaire", "Crée le compte et propose l'envoi WhatsApp des identifiants."],
        ["Pastilles de rôle, ligne de recherche", "Liste", "Filtrer par rôle ; chercher par nom ou par numéro."],
        ["🔐 Pouvoirs → cases, « Tout rétablir »", "Fenêtre des pouvoirs", "Retirer ou rendre un onglet ou une action, sans changer le rôle."],
        ["🆔 Identité", "Ligne", "Nom complet, type et numéro de pièce."],
        ["🔑 Mot de passe", "Ligne (principal)", "Nouveau mot de passe."],
        ["⛔ Bloquer / ✅ Réactiver", "Ligne", "Ferme ou rouvre l'accès."],
        ["« ⋯ Gérer »", "Ligne", "Ouvre le panneau Compte / Paie / Commercial / Client."],
        ["🎭 Rôle · 🎓 Formation / Réel", "⋯ Gérer → Compte (principal)", "Changer le métier ; passer le compte d'un espace à l'autre."],
        ["🏬 Boutique · 📞 · 🎂", "⋯ Gérer → Compte", "Changer la boutique d'un salarié de boutique ; saisir ou corriger le numéro ; l'anniversaire (jour/mois)."],
        ["👁 Voir le mot de passe", "⋯ Gérer → Compte (principal)", "Recalcule le mot de passe d'un client. Pour un employé : « pas consultable, et c'est voulu »."],
        ["🗑 Supprimer", "⋯ Gérer → Compte", "Retire le compte ; l'histoire reste."],
        ["« 🎓 Passer tous les comptes actuels en formation d'un coup (sauf vous) »", "⚠ Actions groupées (principal)", "Le geste de départ pour une répétition générale : tout le monde en formation, vous en réel."],
        ["« 🔒 Retirer Historique + Paramètres aux autres admins »", "⚠ Actions groupées (principal, pastille Administrateur)", "Les autres administrateurs perdent ces deux onglets, d'un coup."],
        ["« ⚠ Transférer »", "⚙ Paramètres → 👑 Administrateur principal", "Donne le rôle principal à un autre administrateur. Immédiat."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["table", { entetes: ["Quand", "Ce que l'application fait toute seule"], largeurs: [2900, 6400], lignes: [
        ["Un compte est créé", "Il naît dans **l'espace regardé** (réel ou formation), avec l'étiquette qui va avec. Un commercial ou un technicien apparaît aussi dans la liste 🎯 Commerciaux. Le mot de passe d'un employé est rangé **chiffré** ; celui d'un client est recalculable."],
        ["Un nom d'employé est déjà pris", "Refus, avec le nom de qui le détient et une proposition libre. Un client, lui, reçoit un identifiant complété par des chiffres de son numéro."],
        ["Un rôle, une boutique, un pouvoir, un mot de passe change", "**Rien ne bouge pour la personne tant qu'elle ne s'est pas reconnectée** : ce qu'elle voit est fixé à la connexion. Demandez-lui de se déconnecter puis de se reconnecter."],
        ["On coche « Chef d'équipe » ou « Nommer chef »", "Le compte gagne 👑 Équipe et ✅ Mes tâches, l'étoile ⭐ sur sa pastille, et les trois pouvoirs d'un chef (assigner des tâches, valider les commissions, réaffecter les prospects) que 🔐 Pouvoirs permet de retirer un à un."],
        ["On retire un pouvoir", "Le compte perd l'onglet ou le bouton, à sa prochaine connexion. **Votre propre fiche est protégée** (« vous ne pouvez pas modifier vos pouvoirs ») et **le principal garde toujours tous les siens** : sans ça, on pourrait s'enfermer dehors."],
        ["On retire « ✏️ Créer / modifier / supprimer »", "Le compte passe en **lecture seule** : il consulte et exporte, mais tout geste répond « Votre compte est en lecture seule ». Le comptable l'est de nature."],
        ["On bloque un compte", "Sa prochaine connexion est refusée. Interdit sur le dernier administrateur actif et sur le principal."],
        ["La base vérifie de son côté", "Le serveur refuse lui-même un changement de rôle qui ne vient pas du principal, et une modification des champs de gestion (salaire, taux, banque, identité, boutique…) qui ne vient pas d'un administrateur — même si un écran essayait."],
        ["Le rôle principal est transféré", "Immédiat pour les deux comptes. Le journal 🕘 Historique garde « 👑 Rôle d'administrateur principal transféré de … à … »."],
        ["Un compte est supprimé", "Ses ventes, dettes, dépenses et messages restent, à son nom. Seul l'accès disparaît."],
      ]}],
      ["attention", "**Le numéro de compte bancaire ne se lit jamais en entier** sur une fiche : seuls les quatre derniers chiffres s'affichent (« …4321 »). Il vit dans la fiche de paie, que seuls l'administrateur, le comptable et l'intéressé reçoivent. Ce n'est pas un affichage masqué : les autres appareils ne le téléchargent pas."],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**Chapitre 1 (connexion)** : le rôle et les pouvoirs sont lus à la connexion ; tout changement attend la reconnexion.",
        "**Chapitre 3 (clients)** : 🙋 Créer un client est le chemin quotidien ; 👥 Utilisateurs sert à retrouver un client sans achat, son numéro, et à recalculer son mot de passe.",
        "**Chapitre 16 (commissions)** : le taux, le parrain, la case chef d'équipe et le taux d'équipe se posent ici.",
        "**Chapitre 18 (salaires)** : l'identité, la banque, le salaire de base, le taux d'avancement, primes, avances, virements et crédits se posent ici, dans ⋯ Gérer → Paie.",
        "**Chapitre 20 (messagerie)** : « Autoriser chat libre » ouvre à un client la conversation avec l'équipe au-delà de ses réponses.",
        "**Chapitre 23 (paramètres)** : le transfert du rôle principal, les boutiques de formation nécessaires aux comptes de formation, l'effacement des données d'un client.",
        "**Chapitre 25 (incidents)** : un compte bloqué à tort, un mot de passe oublié, un principal parti sans transférer.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Avant de créer un compte : **quel espace** je regarde ? La phrase sous le formulaire le dit.",
        "Le **rôle** choisi correspond au métier réel (technicien salarié = « Technicien BMI », pas « Technicien (commission) »).",
        "Vendeur, gérant, magasinier : la **bonne boutique** est choisie.",
        "Le **numéro** est saisi : sans lui, pas d'envoi WhatsApp, et le numéro manque sur la fiche.",
        "Après un changement de rôle ou de pouvoir : la personne s'est **reconnectée** ?",
        "Une fois par mois : la pastille « Client » ne contient pas de comptes en double ; les « ⚠ Identité » sont renseignées pour les salariés.",
        "Le principal a désigné un remplaçant **avant** de partir en congé (⚙ Paramètres → 👑).",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3300], lignes: [
        ["Créer un employé en regardant la formation", "Le compte naît en formation : il ne verra jamais les vraies boutiques.", "Le principal le passe en réel (⋯ Gérer → 🎓), en vérifiant qu'une vraie boutique existe pour lui."],
        ["Donner « Technicien (commission) » à un salarié", "Il n'est pas sur la paie ; il touche des commissions.", "Rôle « Technicien BMI (salarié) », par le principal (🎭 Rôle)."],
        ["Changer un pouvoir et attendre l'effet tout de suite", "Rien ne change à l'écran de la personne.", "Elle se déconnecte et se reconnecte."],
        ["Retirer « ✏️ Créer / modifier / supprimer » par erreur", "La personne ne peut plus rien enregistrer.", "🔐 Pouvoirs → recocher, ou « Tout rétablir »."],
        ["Vouloir relire le mot de passe d'un employé", "« Pas consultable, et c'est voulu. »", "🔑 Mot de passe : en poser un nouveau et le lui envoyer."],
        ["Bloquer le principal ou le dernier administrateur", "Refusé.", "Transférer le rôle principal d'abord, ou créer un autre administrateur."],
        ["Supprimer un client pour « nettoyer »", "Seul l'accès part ; son nom reste sur toutes les factures.", "Pour un vrai effacement : ⚙ Paramètres → 🔒 Données personnelles (chapitre 23)."],
        ["Créer deux fois le même client", "Deux comptes, deux historiques d'achats.", "Chercher par le numéro avant de créer ; l'application propose déjà « ESSO99 » si le nom est pris, ce n'est pas une invitation à doubler."],
        ["Transférer le rôle principal « pour voir »", "Immédiat : vous n'avez plus les gestes du principal.", "Ne le faire que pour de bon, à quelqu'un de présent."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Une nouvelle vendeuse, AFI, commence lundi à la boutique DEMAKPOE. L'administrateur regarde l'espace réel.", reponse: "👥 Utilisateurs : Nom AFI, un mot de passe, son prénom, son numéro, rôle Vendeur, boutique DEMAKPOE, taux d'avancement si convenu. La phrase dit « espace RÉEL ». « Créer », puis « Envoyer ces identifiants… par WhatsApp ? » : oui. Lundi, elle se connecte (chapitre 1)." },
        { situation: "KOSSI, technicien salarié, est nommé chef des techniciens. Son compte est « Technicien BMI (salarié) ».", reponse: "⋯ Gérer → Commercial → « Nommer chef ». Il gagne 👑 Équipe, ✅ Mes tâches et l'étoile ⭐ à sa prochaine connexion. Aucun changement de rôle : c'est le bon rôle pour un salarié." },
        { situation: "Le gérant d'APESSITO ne doit plus pouvoir enregistrer de dépense, seulement les voir, le temps d'un contrôle.", reponse: "🔐 Pouvoirs → « Onglets accessibles » → décocher 📤 Dépenses lui retire l'écran entier ; s'il doit encore le voir, garder l'onglet et retirer plutôt « ✏️ Créer / modifier / supprimer » dans « Actions autorisées » (il passe alors en lecture seule partout). Il se reconnecte." },
        { situation: "Un client dit avoir perdu son mot de passe.", reponse: "Le principal : chercher le client par son numéro, ⋯ Gérer → « 👁 Voir le mot de passe » : il est recalculé, et se renvoie par WhatsApp depuis 📞 sur sa ligne. Rien à changer." },
        { situation: "L'administrateur principal part trois semaines en voyage. Un autre administrateur, DODO, reste.", reponse: "⚙ Paramètres → 👑 Administrateur principal → DODO → « ⚠ Transférer ». Immédiat. Au retour, DODO fait le même geste dans l'autre sens. Sans ça, pendant trois semaines personne ne peut changer un mot de passe ni valider un versement." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "L'administrateur en formation, en regardant l'espace **formation** (⚙ Paramètres → 👁 Je regarde), devant le formateur :"],
      ["ol", [
        "Créer une vendeuse de formation « TEST AFI » sur une boutique de formation, avec un numéro. Lire la phrase de l'espace à voix haute avant de cliquer.",
        "Créer un client « TEST CLIENT » avec un numéro ; dire d'où vient son mot de passe.",
        "Retrouver les deux comptes par le numéro dans la ligne de recherche.",
        "Retirer à TEST AFI l'onglet 🔒 Caisse dans 🔐 Pouvoirs, puis « Tout rétablir ».",
        "Bloquer TEST AFI, se connecter avec elle sur un autre appareil et lire le message, la réactiver.",
        "Renseigner son 🆔 Identité et son 📞.",
        "Si le stagiaire est le principal : changer le rôle de TEST AFI en Gérant, lire ce que la confirmation dit de la boutique et de la prochaine connexion.",
        "Supprimer les deux comptes de test.",
      ]],
      ["note", "Tout se passe en formation : aucun vrai compte, aucune vraie boutique n'est touchée. Le transfert du rôle principal ne se répète pas en exercice : on le lit, on ne le fait pas."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "Le formateur coche **« Acquis »** seulement s'il a **vu** le geste."],
      ["questions", [
        "Quelle différence entre changer le rôle d'un compte et lui retirer un pouvoir ? Qui peut faire l'un, qui peut faire l'autre ?",
        "D'où vient le mot de passe d'un client ? Et celui d'un employé, peut-on le relire ?",
        "Quand un changement de rôle ou de pouvoir prend-il effet ?",
        "Quels rôles sont rattachés à une boutique ? Lesquels sont sur la paie ?",
        "Pourquoi l'application refuse-t-elle de bloquer le principal ou le dernier administrateur ?",
        "Que doit faire le principal avant de partir en congé ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Crée un employé dans le bon espace, avec le bon rôle et la bonne boutique",
      "Crée un client et explique d'où vient son mot de passe",
      "Retrouve un compte par son nom ou son numéro",
      "Retire et rétablit un pouvoir dans 🔐 Pouvoirs",
      "Bloque et réactive un compte ; sait ce qu'un blocage ne fait pas",
      "Renseigne l'identité et le téléphone d'un employé",
      "Sait quels gestes sont réservés au principal, et que l'effet attend la reconnexion",
      "Répond juste aux six questions de la rubrique 12",
    ],
  },
};
