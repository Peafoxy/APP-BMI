// ============================================================
// MANUEL DE FORMATION — CHAPITRE 1 : Connexion, sécurité et navigation
//
// Des MOTS, rien d'autre : la mise en page vit dans scripts/manuel-formation.mjs.
// Chaque bouton, chaque chiffre vient du code (Connexion.jsx, EcranVerrou.jsx,
// lib/verrou.js, api/_verrouillage.js, App.jsx, main.jsx) — jamais de mémoire.
// Le **gras** s'écrit entre deux étoiles.
// ============================================================
export const CHAPITRE = {
  numero: 1,
  titre: "Connexion, sécurité et navigation",
  sousTitre: "Entrer dans BMI-Gestion, protéger son compte, se repérer dans l'application",
  public: "Tout le monde : employés de BMI et clients",
  duree: "45 minutes, puis l'exercice",
  prerequis: "Un compte créé par l'administrateur (nom et mot de passe reçus par WhatsApp), et un téléphone ou un ordinateur avec Chrome.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, la personne sait :"],
      ["ul", [
        "se connecter avec **son** compte, sur un téléphone comme sur un ordinateur, la première fois et les suivantes ;",
        "reconnaître d'un coup d'œil **l'espace** dans lequel elle travaille (réel ou formation) et **la boutique** affichée ;",
        "verrouiller l'application quand elle s'éloigne, la déverrouiller au mot de passe ou à l'empreinte ;",
        "se repérer dans les onglets, les ranger dans son ordre, chercher un client ou un article ;",
        "se déconnecter proprement, et savoir ce qui se passe quand le réseau manque.",
      ]],
      ["note", "Ce chapitre ne parle d'aucun métier en particulier. Ce qu'on apprend ici sert à tout le monde, tous les jours."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["p", "**Tout le monde.** Chaque personne a un compte à son nom, créé par l'administrateur dans 👥 Utilisateurs : vendeur, gérant, magasinier, commercial, technicien, comptable, administrateur… et chaque client qui a acheté chez BMI."],
      ["table", { entetes: ["Qui", "Ce qu'il voit après la connexion"], lignes: [
        ["Un employé", "Les onglets de son métier (le rôle décide lesquels ; l'administrateur peut en retirer dans 🔐 Pouvoirs)."],
        ["Un client", "Son espace : ses achats, ses dettes, ses devis, ses messages, ses données personnelles."],
        ["L'administrateur principal", "Tout, et en plus le choix de l'espace regardé (réel ou formation) dans ⚙ Paramètres → 👁 Je regarde."],
      ]}],
      ["regle", "Un compte, une personne. On ne se connecte jamais avec le compte d'un collègue : tout ce qui est fait dans l'application est enregistré au nom du compte connecté (ventes, dépenses, sorties de stock, messages)."],
    ]},

    // ── 3
    { titre: "Accès dans BMI-Gestion", blocs: [
      ["ul", [
        "**Adresse** : gestion.bmitogo.com, dans Chrome (téléphone ou ordinateur).",
        "**Sur le téléphone**, on l'ajoute à l'écran d'accueil comme une application : elle s'ouvre alors plein écran, avec le logo BMI.",
        "**Pas de compte de départ** dans l'application : c'est l'administrateur qui crée chaque compte et envoie l'identifiant et le mot de passe par WhatsApp.",
        "**Première fois sur un appareil** : il faut le réseau une fois, pour que l'appareil télécharge le compte. Ensuite l'application fonctionne aussi hors ligne.",
      ]],
      ["attention", "L'identifiant d'un employé, c'est son **nom** tel qu'il a été créé (par exemple « ESSO »). Celui d'un client est fabriqué à partir de son nom et, s'il le faut, des chiffres de son numéro. Les majuscules ne comptent pas."],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Se connecter"],
      ["etapes", [
        { titre: "Ouvrir l'application", texte: "L'écran de connexion s'affiche, avec le logo de BMI." },
        { titre: "Champ « Utilisateur »", texte: "Taper son nom (« Votre nom »)." },
        { titre: "Champ « Mot de passe »", texte: "Taper son mot de passe. L'œil à droite du champ l'affiche ou le masque : utile sur un téléphone, pour vérifier une faute de frappe." },
        { titre: "« Se connecter »", texte: "Le bouton affiche « Connexion… » le temps de vérifier. Sur un téléphone, à ce moment, le téléphone peut demander l'autorisation d'afficher les notifications : répondre **Autoriser** pour recevoir les messages et les rappels de BMI." },
        { titre: "L'application s'ouvre", texte: "Sur le **dernier onglet** utilisé sur cet appareil. Un bandeau « ⏳ Synchronisation avec le serveur » peut passer quelques secondes : les données arrivent." },
      ]],
      ["h3", "B. La toute première ouverture"],
      ["p", "Une seule fois, un mot de bienvenue explique en quelques lignes ce que BMI garde comme informations sur la personne, et qui peut les voir. Il se ferme avec **« J'ai compris »**. Il ne revient pas."],
      ["h3", "C. Se repérer"],
      ["table", { entetes: ["Sur ordinateur", "Sur téléphone"], lignes: [
        ["La **barre latérale** à gauche : le logo, la version, « 🔍 Rechercher… », la liste des onglets, et en bas votre nom, votre boutique, « ⟳ Synchroniser » et « Se déconnecter ».", "La **barre du bas** fait défiler les onglets ; en haut, le titre de l'écran, le cadenas 🔐, la loupe 🔍 et l'état du réseau."],
        ["En haut à droite : le bouton **« Verrouiller »**.", "La pastille violette **« 🎓 Formation »** apparaît quand on regarde l'espace formation."],
      ]}],
      ["ul", [
        "**« 🟢 En ligne »** ou **« 🔌 Hors ligne »** : l'état du réseau, avec le nombre d'opérations qui attendent d'être envoyées (« 3 à envoyer »).",
        "**La boutique** affichée en haut de chaque écran : l'application se souvient de la boutique choisie **écran par écran**. Vérifiez-la avant d'agir.",
        "**« 🔍 Rechercher… »** cherche un client, une vente, un article (avec son prix et son stock), un devis, un prospect, en tapant quelques lettres dans n'importe quel ordre.",
      ]],
      ["h3", "D. Ranger ses onglets dans son ordre"],
      ["p", "On **tient** un onglet une demi-seconde sans bouger : il vibre et se soulève. On le glisse à la place voulue, on relâche. L'ordre est le vôtre seul, il vous suit sur tous vos appareils. Un doigt qui part tout de suite fait défiler comme d'habitude ; un clic reste un clic."],
      ["h3", "E. Verrouiller"],
      ["p", "Dès qu'on s'éloigne de l'appareil : **« Verrouiller »** en haut à droite sur ordinateur, le cadenas **🔐** sur la ligne du titre sur téléphone. Une petite carte couvre l'écran ; personne ne peut lire ce qui est derrière."],
      ["h3", "F. Déverrouiller"],
      ["etapes", [
        { titre: "Au mot de passe", texte: "Taper son mot de passe dans la carte, puis **« 🔓 Déverrouiller »**. C'est le mot de passe de **votre** compte, celui qui est connecté." },
        { titre: "À l'empreinte", texte: "Si l'empreinte a été activée sur cet appareil, le téléphone la demande **tout seul** à l'ouverture de la carte. Sinon, on pose le doigt en appuyant sur le rond bleu sous le champ. Le champ du mot de passe reste toujours là : les deux portes se voient ensemble." },
        { titre: "Doigt non reconnu", texte: "Ce n'est pas une faute de mot de passe : rien n'est compté. On réessaie, ou on tape le mot de passe." },
      ]],
      ["h3", "G. Activer l'empreinte sur un téléphone"],
      ["p", "La proposition apparaît **dans la carte de verrouillage**, sous le champ, sur un appareil qui a un capteur : on tape son mot de passe, puis **« 👆 Activer l'empreinte »** ; le téléphone demande le doigt. **« Non merci »** retire la proposition pour de bon sur cet appareil. Pour l'enlever plus tard : **« Retirer l'empreinte de cet appareil »**, au même endroit."],
      ["note", "L'application ne lit jamais votre empreinte. C'est le téléphone qui compare et répond oui ou non ; BMI ne garde qu'une clé propre à cet appareil. Il n'y a aucune empreinte chez BMI, parce qu'il n'y en a aucune."],
      ["h3", "H. Se déconnecter"],
      ["p", "**« Se déconnecter »**, en bas de la barre latérale (ordinateur) ou de l'en-tête (téléphone), et aussi dans la carte de verrouillage (bouton rouge pâle). À faire **en fin de journée** et **avant de prêter l'appareil** à quelqu'un d'autre. S'il reste des opérations à envoyer, l'application le dit et demande confirmation : elles restent sur l'appareil et partiront à la prochaine connexion."],
    ]},

    // ── 5
    { titre: "Explication de chaque bouton et champ", blocs: [
      ["table", { entetes: ["Bouton ou champ", "Où", "À quoi il sert"], largeurs: [2600, 2300, 4460], lignes: [
        ["« Utilisateur »", "Écran de connexion", "Votre nom, tel qu'il a été créé. Les majuscules ne comptent pas."],
        ["« Mot de passe » + œil", "Écran de connexion, carte de verrouillage", "Le mot de passe ; l'œil l'affiche pour vérifier ce qu'on tape."],
        ["« Se connecter »", "Écran de connexion", "Vérifie le compte et ouvre l'application. Affiche « Connexion… » pendant la vérification."],
        ["« J'ai compris »", "Mot de bienvenue", "Ferme le mot d'information de la première ouverture."],
        ["« Verrouiller » / 🔐", "En haut (ordinateur / téléphone)", "Couvre l'écran tout de suite. La session reste ouverte derrière."],
        ["« 🔓 Déverrouiller »", "Carte de verrouillage", "Rouvre l'écran avec le mot de passe du compte connecté."],
        ["Rond bleu 👆", "Carte de verrouillage", "Déverrouille avec l'empreinte, si elle est activée sur cet appareil."],
        ["« 👆 Activer l'empreinte » / « Non merci »", "Carte de verrouillage", "Pose une clé d'empreinte sur cet appareil, ou refuse pour de bon."],
        ["« Retirer l'empreinte de cet appareil »", "Carte de verrouillage", "Enlève la clé ; le mot de passe seul rouvrira."],
        ["« Se déconnecter »", "Bas de la barre latérale, en-tête du téléphone, carte de verrouillage", "Ferme la session. Prévient s'il reste des opérations à envoyer."],
        ["« ⟳ Synchroniser »", "Bas de la barre latérale", "Redemande les données au serveur tout de suite, sans attendre."],
        ["« 🔍 Rechercher… »", "Barre latérale / loupe du téléphone", "Cherche clients, ventes, articles, devis, prospects."],
        ["« 🟢 En ligne » / « 🔌 Hors ligne »", "Barre latérale / en-tête", "L'état du réseau et le nombre d'opérations en attente."],
        ["« 🎓 Formation »", "En-tête", "Rappelle qu'on regarde l'espace formation (l'écran est violet)."],
        ["« Rétablir »", "Bande orange en haut", "Rouvre la session sécurisée avec le mot de passe, sans rien perdre."],
        ["« 🔄 Recharger maintenant »", "Fenêtre « Nouvelle version disponible »", "Installe la mise à jour et recharge l'application."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["table", { entetes: ["Quand", "Ce que l'application fait toute seule"], largeurs: [2900, 6460], lignes: [
        ["**10 minutes** sans aucun geste", "La carte de verrouillage couvre l'écran (téléphone et ordinateur). Elle survit à un rechargement de la page : on rouvre verrouillé."],
        ["**30 minutes** sans aucun geste", "La session se ferme, verrouillée ou non. Message : « Session expirée : 30 minutes sans activité. Reconnectez-vous. » Le mot de passe ne la rouvre pas : on se reconnecte."],
        ["**5 mots de passe faux** dans la carte", "La session se ferme. Chaque erreur dit combien d'essais restent."],
        ["Trop d'essais à la **connexion**", "Le serveur bloque l'appareil quelques minutes : 5 échecs → 1 minute, 10 → 15 minutes, 20 → 1 heure. Message : « Trop d'essais. Réessayez dans N minute(s). » Une heure sans échec remet le compteur à zéro."],
        ["Deux comptes portent le **même nom**", "C'est le mot de passe qui départage : chacun entre avec le sien. L'application propose un autre nom à la création d'un employé si le nom est déjà pris."],
        ["La **session sécurisée** tombe (veille, coupure)", "Une bande orange « ⚠ Votre session sécurisée a expiré » avec « Rétablir » : le mot de passe rouvre la session. Jamais de verrou par surprise, rien n'est perdu."],
        ["Connexion sur un téléphone", "L'appareil est rattaché à la personne pour les notifications ; il est **détaché à la déconnexion**. Un téléphone partagé ne vibre jamais pour l'ancien occupant."],
        ["Chaque ouverture", "Le dernier onglet utilisé se rouvre ; la boutique de chaque écran est celle qu'on y avait choisie. Un onglet déplacé reste à sa place sur tous vos appareils."],
        ["Une **nouvelle version** est en ligne", "Une fenêtre « Nouvelle version disponible » propose « 🔄 Recharger maintenant ». Un clic, et l'application est à jour. Le numéro de version se lit dans la barre latérale."],
        ["Réseau coupé", "On continue à travailler : chaque geste est gardé sur l'appareil (« N en attente ») et part **dans l'ordre** au retour du réseau. Voir le chapitre 24."],
      ]}],
      ["attention", "L'empreinte n'ouvre **que** le verrou d'inactivité. Après 30 minutes, ou quand la session sécurisée est tombée, c'est le mot de passe qu'il faut : lui seul rouvre une session. L'empreinte est une commodité, pas une sécurité."],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**Le rôle décide des onglets** (chapitre 2). Un pouvoir retiré dans 🔐 Pouvoirs fait disparaître l'onglet ou le bouton. ⚠ Tout changement de rôle, de boutique ou de pouvoir prend effet **à la prochaine connexion** de la personne : on lui demande de se déconnecter et de se reconnecter.",
        "**L'espace** (réel ou formation) est fixé sur le compte. Ce qu'on crée naît dans l'espace où l'on est. Seul l'administrateur principal change d'espace, dans ⚙ Paramètres → 👁 Je regarde (chapitre 23).",
        "**Un mot de passe changé** par l'administrateur principal (chapitre 2) : à la connexion suivante l'appareil dit « Ce compte n'existe plus, ou le mot de passe a changé. Rapprochez-vous de l'administrateur. » Il faut le réseau pour retrouver le compte.",
        "**Un compte bloqué** dans 👥 Utilisateurs : « Ce compte a été bloqué par l'administrateur. » Rien d'autre à faire que le voir.",
        "**Les notifications** (chapitre 20) ne partent que vers les appareils sur lesquels la personne est connectée.",
        "**Le travail hors ligne** (chapitre 24) : les gestes en attente partent à la reconnexion, dans l'ordre. Se déconnecter n'efface rien ; vider les données du navigateur, si.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["p", "À chaque ouverture, en dix secondes :"],
      ["cases", [
        "C'est bien **mon nom** en bas de la barre latérale (ou dans l'en-tête du téléphone).",
        "La couleur : **bleu = réel**, **violet = formation** (avec la pastille « 🎓 Formation »).",
        "La **boutique** affichée en haut de l'écran est la bonne.",
        "« 🟢 En ligne » ; s'il y a « N en attente », attendre qu'ils partent avant de se déconnecter.",
        "Avant de laisser l'appareil : **verrouiller** ; en fin de journée : **se déconnecter**.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3360], lignes: [
        ["Se connecter avec le compte d'un collègue", "Les ventes, les dépenses, les messages sont enregistrés à **son** nom. Le journal ment.", "Chacun son compte. Si le vôtre ne marche pas, voir l'administrateur."],
        ["Travailler en formation en croyant être en réel", "Rien n'est enregistré dans les vrais chiffres.", "Regarder la couleur et la pastille « 🎓 Formation » avant chaque geste d'argent."],
        ["Agir sur la mauvaise boutique", "La vente, la dépense ou l'article vont dans une autre caisse.", "Vérifier la boutique en haut de l'écran ; l'application la mémorise par écran."],
        ["Taper 5 mots de passe faux dans la carte", "La session se ferme.", "Utiliser l'œil pour relire ce qu'on tape ; au doute, réessayer avec l'empreinte."],
        ["Insister après « Trop d'essais »", "Le blocage s'allonge (1 min, puis 15, puis 60).", "Attendre le délai affiché, ou appeler l'administrateur si le mot de passe est oublié."],
        ["Laisser une session ouverte au comptoir", "N'importe qui peut vendre ou lire des chiffres sous votre nom.", "« Verrouiller » (ou 🔐) dès qu'on s'éloigne. Le verrou vient seul à 10 minutes, mais dix minutes, c'est long."],
        ["Vider les données du navigateur", "Les opérations en attente sont perdues ; la clé d'empreinte aussi.", "Ne jamais le faire tant que « N en attente » n'est pas à zéro. Réactiver l'empreinte ensuite."],
        ["Refaire une vente parce qu'elle « n'apparaît pas » sur l'autre téléphone", "Elle est comptée deux fois.", "Regarder « N en attente » sur l'appareil qui a vendu ; « ⟳ Synchroniser » sur l'autre."],
        ["Ignorer « Nouvelle version disponible »", "L'appareil garde une vieille version : des boutons manquent, des règles diffèrent.", "« 🔄 Recharger maintenant », tout de suite."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "AMA, vendeuse, reçoit son nouveau téléphone de boutique. Elle tape son nom et son mot de passe, et l'écran dit : « Première connexion sur cet appareil : connectez-vous au réseau une fois. »", reponse: "Le téléphone n'a jamais vu son compte. Elle active les données mobiles ou le Wi-Fi, recommence : le compte descend, et ensuite l'application marchera sans réseau." },
        { situation: "KOSSI quitte le comptoir cinq minutes pour aider un client au dépôt. Il ne verrouille pas.", reponse: "Pendant cinq minutes, n'importe qui peut vendre ou lire la caisse sous son nom. Le verrou automatique ne vient qu'à 10 minutes. Le bon geste : « Verrouiller » avant de partir, « 🔓 Déverrouiller » en revenant, ou l'empreinte." },
        { situation: "Sur le PC du gérant, la carte de verrouillage dit « Session expirée : 30 minutes sans activité. Reconnectez-vous. » Il tape son mot de passe, ça ne rouvre pas.", reponse: "C'est normal : à 30 minutes la session est finie, le mot de passe ne la ressuscite pas. Il se reconnecte sur l'écran de connexion. Rien n'est perdu." },
        { situation: "Deux comptes s'appellent ESSO : un technicien et un client. Le technicien tape « ESSO » et son mot de passe.", reponse: "L'application essaie les deux comptes avec ce mot de passe et ouvre celui qui correspond. Chacun entre avec le sien. Si l'écran dit que le mot de passe est incorrect, c'est qu'il l'est vraiment." },
        { situation: "Le réseau tombe en pleine journée. Trois ventes sont encaissées. L'en-tête dit « 🔌 Hors ligne · 3 ». Le soir, AMA veut se déconnecter.", reponse: "L'application prévient : « 3 opération(s) ne sont pas encore envoyées… Se déconnecter quand même ? » Elle peut : les ventes restent sur le téléphone et partiront à la prochaine connexion avec réseau. Ce qu'elle ne doit surtout pas faire : vider les données du navigateur." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "Sur son propre appareil, devant le formateur, sans aide :"],
      ["ol", [
        "Se connecter avec son compte. Dire à voix haute son rôle, sa boutique, et si l'écran est en réel ou en formation.",
        "Trouver le numéro de version dans la barre latérale (ou l'en-tête).",
        "Avec « 🔍 Rechercher… », retrouver un article et lire son prix et son stock.",
        "Déplacer un onglet (par exemple ramener 🔒 Caisse juste après 💰 Ventes), fermer l'application, la rouvrir : l'ordre est resté.",
        "Verrouiller, puis déverrouiller au mot de passe.",
        "Sur téléphone : activer l'empreinte, verrouiller, déverrouiller au doigt. Puis « Retirer l'empreinte de cet appareil » et vérifier que le mot de passe rouvre toujours.",
        "Taper un mot de passe faux dans la carte et lire le message : combien d'essais restent ?",
        "Se déconnecter, puis se reconnecter.",
      ]],
      ["note", "Cet exercice se fait avec le vrai compte de la personne : il n'écrit aucune vente, aucune dépense. Aucun risque pour les chiffres."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "Le formateur coche **« Acquis »** seulement s'il a **vu** le geste. Une case « À revoir » renvoie à la rubrique 4 de ce chapitre ; on refait l'exercice le lendemain."],
      ["questions", [
        "Quelle est la différence entre l'espace réel et l'espace formation, et comment la voit-on à l'écran ?",
        "Pourquoi ne faut-il jamais se connecter avec le compte d'un collègue ?",
        "Que se passe-t-il après 10 minutes sans geste ? Et après 30 minutes ?",
        "Que faire quand l'écran dit « Trop d'essais. Réessayez dans 15 minute(s) » ?",
        "Une vente encaissée hors ligne n'apparaît pas sur le téléphone du gérant. Que vérifie-t-on avant de la refaire ?",
        "L'empreinte rouvre-t-elle une session expirée après 30 minutes ? Pourquoi ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Se connecte seul, sur téléphone et sur ordinateur",
      "Sait dire l'espace (réel / formation), la boutique et son rôle",
      "Verrouille avant de s'éloigner, déverrouille au mot de passe",
      "Active et retire l'empreinte (téléphone), sait qu'elle n'ouvre que le verrou",
      "Utilise la recherche et range ses onglets",
      "Lit l'état du réseau et les opérations en attente",
      "Se déconnecte en fin de journée et avant de prêter l'appareil",
      "Répond juste aux six questions de la rubrique 12",
    ],
  },
};
