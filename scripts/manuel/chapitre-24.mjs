// ============================================================
// MANUEL DE FORMATION — CHAPITRE 24 : Hors connexion
//
// Des MOTS, rien d'autre. Chaque bouton, chaque phrase vient du code :
// App.jsx (le badge 🟢 En ligne / 🔌 Hors ligne et son compteur, la bande
// rouge « opération(s) n'arrivent pas à partir », 🗑 Abandonner ce geste
// refusé, la bande orange « Rétablir », « 📤 N à envoyer — se déconnecter »,
// la réparation des numéros de reçu), src/sync.js (la file d'envoi, l'essai
// toutes les 20 secondes, au retour du réseau et au réveil de l'appareil),
// src/db.js (la copie locale, compterEnAttente), screens/Connexion.jsx
// (la connexion sans réseau), src/push.js (la file des notifications,
// 24 h), src/whatsapp.js (le repli WhatsApp), src/main.jsx (« Nouvelle
// version disponible »), screens/Parametres.jsx (🔁 Synchronisation forcée).
// Le verrou et la session sécurisée sont au chapitre 1.
// ============================================================
export const CHAPITRE = {
  numero: 24,
  titre: "Hors connexion",
  sousTitre: "Travailler quand internet coupe : ce qui continue, ce qui attend, ce qui demande le réseau, et comment tout repart sans rien perdre",
  public: "Tout le personnel",
  duree: "45 min, avec un téléphone dont on coupe les données",
  prerequis: "Le chapitre 1 (Connexion, sécurité et navigation) : la session sécurisée, le verrou.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "lire le badge **🟢 En ligne / 🔌 Hors ligne** et son compteur d'opérations en attente ;",
        "continuer à vendre, encaisser et saisir sans internet ;",
        "dire ce qui **demande** internet, et ce qui se passe quand il manque ;",
        "réagir à la bande **rouge** (un envoi qui ne part pas) et à la bande **orange** (session à rétablir) ;",
        "se déconnecter sans rien perdre, et faire la mise à jour de l'application.",
      ]],
      ["regle", "**Rien n'est perdu quand internet coupe.** Chaque geste est enregistré d'abord sur l'appareil, puis envoyé au serveur dès qu'il répond. La seule façon de perdre une saisie : **effacer les données du navigateur** pendant qu'il reste des opérations à envoyer."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4800, 4500], lignes: [
        ["Travailler hors ligne", "Tout compte qui s'est **déjà connecté une fois avec internet sur cet appareil**."],
        ["Lire le badge et le compteur", "Tout le monde."],
        ["🗑 Abandonner ce geste refusé", "**L'administrateur principal seul.**"],
        ["🔁 Tout retélécharger depuis le serveur", "L'administrateur (⚙ Paramètres → 💾 Données), avec internet."],
      ]}],
      ["note", "La **première** connexion d'un compte sur un appareil demande internet : « Première connexion sur cet appareil : connectez-vous au réseau une fois. Ensuite, l'application fonctionnera hors ligne. »"],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y lit"], largeurs: [3100, 6200], lignes: [
        ["Le badge sous le menu (ordinateur) ou en haut (téléphone)", "**🟢 En ligne** ou **🔌 Hors ligne**, et le nombre d'opérations « à envoyer » / « en attente »."],
        ["La bande rouge en haut de l'écran", "« ⚠ N opération(s) n'arrivent pas à partir vers le serveur », avec le motif."],
        ["La bande orange tout en haut", "« ⚠ Votre session sécurisée a expiré. Vos saisies restent sur cet appareil. » et **Rétablir**."],
        ["Le bouton de déconnexion", "« 📤 N à envoyer — se déconnecter » quand il reste des envois."],
        ["Une fenêtre au centre", "« 🔄 Nouvelle version disponible » et **🔄 Recharger maintenant**."],
        ["La bande bleue au démarrage", "« ⏳ Synchronisation avec le serveur — les données arrivent… »"],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Quand internet coupe"],
      ["etapes", [
        { titre: "Le badge passe à 🔌 Hors ligne", texte: "Rien à faire : on continue de travailler. Chaque geste s'ajoute au compteur « N en attente »." },
        { titre: "On vend, on encaisse, on saisit", texte: "Ventes, reçus, dettes et versements, dépenses, clôture du jour, stock, messages internes : tout s'enregistre sur l'appareil. Le reçu s'imprime normalement." },
        { titre: "Internet revient", texte: "L'application envoie tout, **dans l'ordre**, toute seule — au retour du réseau, toutes les 20 secondes, et quand on revient sur l'application. Le badge repasse à 🟢 En ligne et le compteur redescend à zéro." },
      ]],
      ["attention", "**Hors ligne, l'appareil ne voit pas ce que font les autres.** Le stock affiché est celui de la dernière synchronisation : une boutique qui vend le même article au même moment ne le saura qu'au retour du réseau."],

      ["h3", "B. Ce qui demande internet"],
      ["table", { entetes: ["Le geste", "Sans internet"], largeurs: [3800, 5500], lignes: [
        ["La première connexion d'un compte sur un appareil", "Refusée, avec la phrase qui le dit."],
        ["Un message du numéro WhatsApp BMI (reçu, devis, relance…)", "Ne part pas du numéro BMI. Selon le geste, WhatsApp s'ouvre sur l'appareil avec le texte (il partira quand le téléphone aura du réseau), ou une note sous le titre le dit (reçu automatique)."],
        ["Répondre à un client dans 📲 WhatsApp", "Refusé : la réponse doit partir du numéro BMI."],
        ["Les notifications des autres appareils", "Elles attendent sur l'appareil, **24 heures au plus**, et partent au retour du réseau."],
        ["Parrainer un filleul (espace client)", "« Le parrainage demande une connexion internet. »"],
        ["🔁 Tout retélécharger, 🧨 Réinitialiser", "Refusé : « Vous êtes hors ligne. »"],
        ["Voir une photo reçue dans 📲 WhatsApp", "Elle se charge depuis WhatsApp : impossible sans réseau."],
      ]}],

      ["h3", "C. La bande rouge : un envoi qui ne part pas"],
      ["p", "Elle n'apparaît qu'**en ligne**, quand des opérations restent bloquées. Deux cas, et la bande dit lequel :"],
      ["ul", [
        "**Le serveur ne répond pas** (réseau trop faible) : « L'application réessaie toute seule toutes les 20 secondes. Rien n'est perdu. » On attend.",
        "**Une règle du serveur refuse le geste** (⛔ « Le serveur REFUSE cet enregistrement… se reconnecter n'y changera rien ») : ce qui attend derrière reste aussi sur l'appareil. On **prévient l'administrateur principal** en lui montrant le message ; lui seul peut **🗑 Abandonner ce geste refusé** — l'appareil revient à l'état d'avant, puis on refait le geste correctement.",
      ]],

      ["h3", "D. La bande orange : la session sécurisée a expiré"],
      ["etapes", [
        { titre: "« Rétablir »", texte: "La fenêtre de verrouillage s'ouvre." },
        { titre: "Taper son mot de passe", texte: "La session se rouvre, les opérations en attente partent aussitôt. Sans réseau, on déverrouille quand même et on continue de travailler." },
      ]],

      ["h3", "E. Se déconnecter avec des opérations en attente"],
      ["p", "Le bouton dit « 📤 N à envoyer — se déconnecter ». L'application tente un dernier envoi, puis demande : « N opération(s) ne sont pas encore envoyées au serveur. Se déconnecter quand même ? » **Oui** : elles restent sur CET appareil et partiront à la prochaine connexion. **N'effacez pas les données du navigateur d'ici là.**"],

      ["h3", "F. Deux reçus du même numéro"],
      ["p", "Deux appareils hors ligne peuvent donner le même numéro de reçu. Au retour du réseau, l'application **renumérote toute seule** l'une des deux ventes, de la même façon sur tous les appareils, et garde l'ancien numéro : le reçu réimprimé porte « Annule et remplace le reçu n° … », et 🕘 Historique le note."],

      ["h3", "G. Mettre à jour l'application"],
      ["etapes", [
        { titre: "« 🔄 Nouvelle version disponible »", texte: "La fenêtre donne le numéro de la version. Elle apparaît à l'ouverture, au retour sur l'application, ou au bout de 15 minutes." },
        { titre: "« 🔄 Recharger maintenant »", texte: "L'application se recharge sur la nouvelle version. Ce qui attendait d'être envoyé reste sur l'appareil." },
      ]],
      ["note", "La version en cours s'affiche en haut de l'écran : comparez-la avec celle annoncée pour savoir si l'appareil est à jour."],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton / signe", "Où", "Ce qu'il fait"], largeurs: [2900, 2200, 4200], lignes: [
        ["🟢 En ligne · N à envoyer", "Badge", "Le serveur répond ; N gestes partent."],
        ["🔌 Hors ligne · N en attente", "Badge", "Pas de serveur ; N gestes attendent sur l'appareil."],
        ["🗑 Abandonner ce geste refusé", "Bande rouge", "Retire le geste refusé de la file et remet l'appareil comme avant (principal)."],
        ["Rétablir", "Bande orange", "Ouvre le verrou pour rouvrir la session."],
        ["📤 N à envoyer — se déconnecter", "Menu", "Se déconnecter en gardant les envois sur l'appareil."],
        ["🔄 Recharger maintenant", "Fenêtre de mise à jour", "Passe à la nouvelle version."],
        ["🔁 Tout retélécharger depuis le serveur", "⚙ Paramètres → 💾 Données", "Recharge toutes les données (administrateur, en ligne)."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Chaque geste est écrit deux fois** : dans la copie de l'appareil, et dans une file d'envoi qui garde l'ordre.",
        "**L'envoi se retente** au retour du réseau, toutes les 20 secondes, et au réveil de l'appareil ; la session est renouvelée au passage.",
        "**À chaque synchronisation**, l'appareil reçoit ce que les autres ont fait, et retire ce que le serveur ne lui accorde plus.",
        "**Après une mise à jour**, chaque appareil se resynchronise en entier au premier démarrage.",
        "**Les heures écrites** sont celles de Lomé, même si l'appareil est mal réglé.",
        "**Les numéros de reçu en double** sont renumérotés tout seuls, avec une trace.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**Connexion** (chapitre 1) : la session sécurisée, la fenêtre de verrouillage.",
        "**💰 Ventes** (chapitre 5) : le reçu imprimé hors ligne, le reçu WhatsApp qui attend le réseau.",
        "**🔒 Caisse** (chapitre 6) : la clôture se fait hors ligne ; ses chiffres sont ceux de l'appareil.",
        "**📦 Stocks** (chapitre 8) : le stock vu est celui de la dernière synchronisation.",
        "**📲 WhatsApp** (chapitre 20) : rien ne part du numéro BMI sans réseau.",
        "**⚙ Paramètres** (chapitre 23) : la sauvegarde et la synchronisation forcée.",
        "**Incidents** (chapitre 25) : quand ça ne repart pas.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Avant de fermer la boutique : le compteur est à **zéro** (rien « à envoyer »).",
        "Avant la clôture du jour : le badge est 🟢 si possible, pour clôturer avec les ventes des autres appareils.",
        "Chaque matin : la version affichée est la dernière annoncée.",
        "Une bande rouge qui reste plus d'une heure : prévenir l'administrateur principal.",
        "Un appareil neuf : la première connexion se fait avec internet.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["Erreur", "Ce qu'il faut faire"], largeurs: [4200, 5100], lignes: [
        ["Vider les données du navigateur pour « réparer » l'application.", "**Jamais** tant qu'il reste des envois : ils seraient perdus. Prévenir l'administrateur."],
        ["Ressaisir une vente parce qu'elle n'apparaît pas sur un autre appareil.", "Attendre que le compteur de l'appareil qui l'a saisie redescende à zéro : sinon la vente compte deux fois."],
        ["Se déconnecter et se reconnecter devant une bande rouge « le serveur REFUSE ».", "Ça n'y change rien : prévenir l'administrateur principal avec le message."],
        ["Ignorer « Nouvelle version disponible ».", "Recharger dès que possible : une vieille version peut ne pas connaître une règle nouvelle."],
        ["Croire qu'un reçu WhatsApp est parti hors ligne.", "Lire la note sous le titre ; renvoyer depuis la ligne de la vente une fois en ligne."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Coupure d'internet à DEMAKPOE en pleine matinée.", reponse: "On continue de vendre : 🔌 Hors ligne · 6 en attente. Au retour du réseau, le compteur redescend tout seul ; rien à ressaisir." },
        { situation: "Une vente à crédit est saisie hors ligne ; le client veut son reçu WhatsApp.", reponse: "Le reçu imprimé part tout de suite. Le message du numéro BMI attendra : une fois en ligne, bouton WhatsApp sur la ligne de la vente." },
        { situation: "La bande rouge dit « ⛔ Le serveur REFUSE cet enregistrement (ventes) ».", reponse: "Montrer le message à l'administrateur principal : 🗑 Abandonner ce geste refusé, puis refaire la vente correctement." },
        { situation: "La bande orange « Votre session sécurisée a expiré » apparaît.", reponse: "Rétablir → mot de passe. Les envois repartent aussitôt." },
        { situation: "Fin de journée, « 📤 3 à envoyer — se déconnecter ».", reponse: "Attendre le réseau si possible ; sinon se déconnecter : les 3 opérations partiront à la prochaine connexion sur CE téléphone." },
        { situation: "Deux téléphones hors ligne ont émis le reçu BMID-2026-0040.", reponse: "Au retour du réseau, l'un devient 0041 tout seul ; son reçu réimprimé dit « Annule et remplace le reçu n° BMID-2026-0040 »." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "Dans l'espace de formation, sur un téléphone :"],
      ["ol", [
        "Couper les données mobiles et le Wi-Fi ; lire le badge.",
        "Faire deux ventes d'entraînement et une dépense ; lire le compteur.",
        "Imprimer ou partager le reçu d'une des ventes.",
        "Rallumer le réseau ; regarder le compteur redescendre à zéro.",
        "Vérifier sur un autre appareil que les deux ventes y sont.",
      ]],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "lit le badge et le compteur ;",
        "travaille hors ligne et voit ses saisies partir au retour du réseau ;",
        "dit ce qui demande internet ;",
        "réagit juste à la bande rouge et à la bande orange ;",
        "sait pourquoi on ne vide jamais les données du navigateur.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Que veut dire « 🔌 Hors ligne · 4 en attente » ?",
        "Quand l'application réessaie-t-elle d'envoyer ?",
        "Que faut-il pour la première connexion sur un appareil neuf ?",
        "Que fait un reçu WhatsApp quand internet manque ?",
        "Que faire devant « ⛔ Le serveur REFUSE cet enregistrement » ?",
        "Que faire devant la bande orange ?",
        "Que deviennent les opérations en attente si l'on se déconnecte ?",
        "Pourquoi le stock affiché hors ligne peut-il être faux ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Lit le badge et le compteur d'envoi",
      "Travaille hors ligne sans rien perdre",
      "Connaît ce qui demande internet",
      "Réagit à la bande rouge et à la bande orange",
      "Se déconnecte sans perdre d'envoi",
      "Fait la mise à jour de l'application",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
