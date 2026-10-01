// ============================================================
// MANUEL DE FORMATION — CHAPITRE 25 : Incidents
//
// Des MOTS, rien d'autre. Chaque message cité vient du code :
// screens/Connexion.jsx (les refus de connexion), lib/verrou.js (10 min,
// 5 erreurs, 30 min), components/EcranVerrou.jsx, App.jsx (la bande orange
// « Rétablir », la bande rouge et 🗑 Abandonner, la réparation des numéros
// de reçu), lib/cloture.js (la vente bloquée par une journée non clôturée,
// la clôture dépassée), lib/validationDepenses.js et lib/versements.js (la
// dépense en attente qui bloque la clôture, le tiroir qui ne suffit pas),
// src/whatsapp.js et lib/whatsappModeles.js (le refus de WhatsApp dit en
// français, le repli), lib/caissesMobiles.js (le solde Flooz / Mixx qui
// découle des saisies), screens/Parametres.jsx (les notifications bloquées,
// 🔁 Tout retélécharger), src/main.jsx (« Nouvelle version disponible »).
// Ce chapitre ne refait pas les autres : il dit QUOI FAIRE quand ça coince,
// et renvoie au chapitre où le geste est expliqué.
// ============================================================
export const CHAPITRE = {
  numero: 25,
  titre: "Incidents",
  sousTitre: "Quand quelque chose coince : lire le message, faire le bon geste, savoir quand prévenir l'administrateur",
  public: "Tout le personnel ; l'administrateur principal pour les gestes qui lui sont réservés",
  duree: "1 h, avec un téléphone et l'espace de formation",
  prerequis: "Les chapitres 1 (Connexion), 6 (Caisse) et 24 (Hors connexion).",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "**lire le message** affiché : l'application dit presque toujours ce qui se passe, et quoi faire ;",
        "régler seul les incidents courants : connexion refusée, verrou, bande orange, vente bloquée, clôture dépassée, WhatsApp qui ne part pas ;",
        "reconnaître ce qui est **réservé à l'administrateur**, et le prévenir **avec une capture d'écran** ;",
        "ne jamais aggraver un incident (données du navigateur effacées, vente saisie deux fois, mot de passe partagé).",
      ]],
      ["regle", "**Devant un incident, on lit le message en entier avant de cliquer.** Il nomme la cause et la porte de sortie. Quand il ne suffit pas, on fait une **capture d'écran** et on l'envoie à l'administrateur : plusieurs corrections importantes de l'application sont parties d'une capture."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4800, 4500], lignes: [
        ["Lire un message, recharger la page, rétablir sa session", "Tout le monde."],
        ["Débloquer un compte, changer un mot de passe oublié", "Débloquer : l'administrateur. Le mot de passe d'un autre compte : **l'administrateur principal seul**."],
        ["Clôturer une journée en retard, reclôturer une journée dépassée", "Vendeur, gérant, administrateur (comme la clôture du jour)."],
        ["Valider ou rejeter une dépense en attente", "**L'administrateur principal (le DG)**."],
        ["🗑 Abandonner ce geste refusé", "**L'administrateur principal seul.**"],
        ["🔁 Tout retélécharger depuis le serveur", "L'administrateur (⚙ Paramètres → 💾 Données), avec internet."],
      ]}],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["p", "Un incident se montre toujours au même genre d'endroit :"],
      ["table", { entetes: ["Où", "Ce qu'on y lit"], largeurs: [3100, 6200], lignes: [
        ["Sous le champ de l'écran de connexion", "Le refus de connexion, en rouge."],
        ["La fenêtre de verrouillage", "Le mot de passe demandé, le nombre d'essais, l'empreinte."],
        ["Une bande en haut de l'écran", "**Orange** : session à rétablir. **Rouge** : des opérations n'arrivent pas à partir."],
        ["En tête de 💰 Ventes", "« 🔒 Vente impossible : la journée du … de … n'a pas été clôturée »."],
        ["En tête de 🔒 Caisse", "La journée à clôturer, la clôture dépassée (bandeau orange), la dépense qui bloque la clôture."],
        ["Une fenêtre au centre", "Un refus expliqué, une confirmation, « Nouvelle version disponible »."],
        ["Discrètement sous le titre d'un écran", "Un reçu WhatsApp qui n'est pas parti, et pourquoi."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "La méthode, pour tout incident"],
      ["etapes", [
        { titre: "Lire le message en entier", texte: "Il dit la cause (« n'a pas été clôturée », « bloqué par l'administrateur », « le serveur ne répond pas ») et souvent le geste à faire." },
        { titre: "Faire le geste indiqué", texte: "Clôturer la journée, rétablir la session, attendre le réseau, recharger la page…" },
        { titre: "Si le message dit « administrateur », ou si rien ne change", texte: "Faire une **capture d'écran** du message entier et l'envoyer à l'administrateur par 💬 Messages ou WhatsApp, avec une phrase : ce qu'on faisait, à quelle heure." },
        { titre: "Ne pas contourner", texte: "Ne pas ressaisir une vente « pour voir », ne pas changer de boutique, ne pas vider les données du navigateur, ne pas emprunter le compte d'un collègue." },
      ]],

      ["h3", "Je n'arrive pas à me connecter"],
      ["table", { entetes: ["Le message", "Ce qu'il faut faire"], largeurs: [4200, 5100], lignes: [
        ["« Entrez votre nom d'utilisateur. »", "La case du nom est vide : taper son nom."],
        ["« Mot de passe incorrect. »", "Vérifier les majuscules, l'œil 👁 pour voir ce qu'on tape. Oublié : l'administrateur principal en donne un nouveau."],
        ["« Ce compte a été bloqué par l'administrateur. »", "Seul l'administrateur peut le réactiver. Lui demander."],
        ["« Ce compte n'existe plus, ou le mot de passe a changé. Rapprochez-vous de l'administrateur. »", "Le compte a été supprimé, ou son mot de passe changé depuis un autre appareil : demander à l'administrateur."],
        ["« Utilisateur introuvable. »", "Le nom est mal écrit, ou ce compte n'a jamais été créé."],
        ["« Première connexion sur cet appareil : connectez-vous au réseau une fois… »", "Trouver internet pour cette première fois ; ensuite l'appareil fonctionne hors ligne."],
      ]}],
      ["note", "**Deux comptes du même nom** (deux ESSO, par exemple) : c'est le **mot de passe** qui choisit le bon. Chacun tape son propre mot de passe et entre dans son propre compte. Un nouvel employé ne peut plus recevoir un nom déjà pris : l'application propose un nom libre."],

      ["h3", "La fenêtre de verrouillage"],
      ["etapes", [
        { titre: "Après 10 minutes sans geste", texte: "La fenêtre couvre l'écran : taper son mot de passe (ou l'empreinte, si elle est activée sur cet appareil). Rien n'est perdu." },
        { titre: "5 erreurs de mot de passe", texte: "La session se ferme : il faut se reconnecter depuis l'écran de connexion. Un doigt non reconnu ne compte **pas** dans les 5 essais." },
        { titre: "30 minutes sans geste", texte: "« Session expirée : 30 minutes sans activité » : la session est finie, même verrouillée. Le mot de passe ne la rouvre pas : on se reconnecte. Les opérations en attente restent sur l'appareil." },
      ]],

      ["h3", "« 🔒 Vente impossible : la journée du … n'a pas été clôturée »"],
      ["etapes", [
        { titre: "Aller dans 🔒 Caisse", texte: "La journée en retard est proposée (la plus ancienne d'abord)." },
        { titre: "Compter le tiroir et clôturer cette journée", texte: "La clôture d'un jour passé se fait comme celle du jour (chapitre 6)." },
        { titre: "Revenir dans 💰 Ventes", texte: "La vente passe. S'il reste une autre journée en retard, recommencer." },
      ]],
      ["attention", "Si la clôture est **grisée** avec un message rouge, une **dépense en espèces payée avec la caisse** attend la validation du DG : il faut qu'il la valide ou la rejette (📤 Dépenses) avant de pouvoir clôturer."],

      ["h3", "« ⚠ La caisse du … a bougé APRÈS la clôture »"],
      ["etapes", [
        { titre: "Lire le bandeau orange de 🔒 Caisse", texte: "Il dit ce qui a bougé, ce qui avait été compté, et ce que le tiroir devrait contenir maintenant pour ce jour-là." },
        { titre: "Recompter et reclôturer cette journée", texte: "La nouvelle clôture remplace l'ancienne ; l'ancienne reste gardée dans l'historique." },
      ]],
      ["regle", "**On clôture en dernier, à la fermeture, jamais avant.** Une vente faite après la clôture ne se perd pas, mais elle oblige à reclôturer."],

      ["h3", "Je ne reçois plus de notifications"],
      ["p", "Si le téléphone a répondu **Bloquer** à la question des notifications, seul son réglage peut revenir dessus : réglages du téléphone ou du navigateur → Notifications → BMI Gestion → autoriser, **puis recharger la page (F5) ou rouvrir l'application**. Une déconnexion n'est pas nécessaire."],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton", "Ce qu'il fait"], largeurs: [3400, 5900], lignes: [
        ["**Rétablir** (bande orange)", "Ouvre la fenêtre de verrouillage : le mot de passe rouvre la session sécurisée, les envois repartent."],
        ["👆 (fenêtre de verrouillage)", "Ouvre le verrou d'inactivité par l'empreinte, sur l'appareil où elle est activée. Le mot de passe reste toujours possible."],
        ["**🔄 Recharger maintenant**", "Installe la nouvelle version de l'application."],
        ["**🗑 Abandonner ce geste refusé**", "Retire de la file un geste que le serveur refuse, pour que le reste parte. **Administrateur principal.**"],
        ["**🔁 Tout retélécharger depuis le serveur**", "Envoie d'abord ce qui attend, puis relit toutes les données du serveur. Pour un appareil qui semble incomplet. Administrateur, avec internet."],
        ["**F5** (ordinateur) / rouvrir l'application (téléphone)", "Recharge l'écran. Sans danger : rien de saisi n'est perdu, la boutique de chaque écran est gardée."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Les envois réessaient tout seuls** toutes les 20 secondes, au retour du réseau et au réveil de l'appareil.",
        "**Deux reçus au même numéro** (deux téléphones hors ligne) : l'un reçoit tout seul le numéro suivant ; l'ancien numéro reste noté sur la vente et dans 🕘 Historique.",
        "**La session sécurisée est renouvelée** au réveil de l'appareil et avant son expiration : la bande orange reste rare.",
        "**Un refus de WhatsApp est traduit en français** (« pas encore approuvé », « numéro illisible »…). Un motif inconnu reste tel quel, précédé de « WhatsApp a refusé le message : ».",
        "**Un envoi du numéro BMI qui ne part pas** : la plupart du temps, WhatsApp s'ouvre sur l'appareil avec le texte complet, après une fenêtre qui dit pourquoi. **Un reçu automatique après encaissement ne s'ouvre jamais** : la note sous le titre le dit, et le bouton WhatsApp de la ligne reste là.",
        "**Le solde Flooz / Mixx affiché découle des saisies**, pas du téléphone de l'opérateur : l'application ne parle ni à Flooz ni à Moov.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["table", { entetes: ["Incident", "Chapitre à relire"], largeurs: [5000, 4300], lignes: [
        ["Connexion, verrou, empreinte, session sécurisée", "Chapitre 1 — Connexion, sécurité et navigation."],
        ["Compte bloqué, mot de passe d'un employé", "Chapitre 2 — Utilisateurs et rôles."],
        ["Vente bloquée, clôture, écart, clôture dépassée, solde Flooz / Mixx", "Chapitre 6 — Caisse et encaissements."],
        ["Dépense en attente du DG, tiroir qui ne suffit pas", "Chapitre 17 — Dépenses."],
        ["WhatsApp refusé, fenêtre de 24 h fermée, coches ❌", "Chapitre 20 — Messagerie et WhatsApp."],
        ["Notifications, 🔁 Tout retélécharger", "Chapitre 23 — Paramètres."],
        ["Bande rouge, hors ligne, nouvelle version", "Chapitre 24 — Hors connexion."],
      ]}],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Chaque matin : le badge est **🟢 En ligne** et le compteur à **0** avant d'ouvrir.",
        "Aucune bande rouge ou orange en haut de l'écran.",
        "🔒 Caisse : pas de journée en retard, pas de bandeau « a bougé APRÈS la clôture ».",
        "La version affichée en haut est la dernière annoncée.",
        "Avant de prêter ou de rendre un téléphone : se déconnecter, compteur à zéro.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["Erreur", "Ce qu'il faut faire"], largeurs: [4200, 5100], lignes: [
        ["Vider les données du navigateur pour « réparer ».", "**Jamais** tant qu'il reste des envois : ils seraient perdus. Prévenir l'administrateur."],
        ["Ressaisir une vente qui « n'apparaît pas » sur un autre appareil.", "Attendre que le compteur de l'appareil qui l'a saisie redescende à zéro. Sinon, la vente compte deux fois."],
        ["Se connecter avec le compte d'un collègue parce que le sien est bloqué.", "Interdit : chaque geste porte le nom de celui qui le fait. Demander le déblocage."],
        ["Clôturer à 16 h puis continuer à vendre.", "Clôturer en dernier. Sinon, reclôturer la journée dans 🔒 Caisse."],
        ["Taper la recette du jour dans « Montant du tiroir ».", "On compte les **billets du tiroir**. L'application le signale en rouge, avec le calcul."],
        ["Écrire « ça ne marche pas » sans capture.", "Une capture du message entier, l'heure, ce qu'on faisait : l'administrateur comprend tout de suite."],
        ["Croire que le solde Mixx affiché vient de l'opérateur.", "Il vient des saisies. Un écart avec le téléphone veut dire qu'un mouvement n'a pas été saisi."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Le matin, 💰 Ventes affiche « 🔒 Vente impossible : la journée du 30/09/2026 de BMI DEMAKPOE n'a pas été clôturée ».", reponse: "🔒 Caisse → compter le tiroir → clôturer le 30/09 → revenir vendre." },
        { situation: "La clôture est grisée : une dépense de 12 000 F en espèces attend le DG.", reponse: "Prévenir le DG : il la valide ou la rejette dans 📤 Dépenses, puis on clôture." },
        { situation: "Une vendeuse revient de pause : « Session expirée : 30 minutes sans activité ».", reponse: "Elle se reconnecte depuis l'écran de connexion. Ses ventes en attente partent à la connexion." },
        { situation: "Un technicien tape trois fois un faux mot de passe sur la fenêtre de verrouillage.", reponse: "Il lui reste deux essais. Au cinquième, la session se ferme et il se reconnecte. Oublié : l'administrateur principal lui en donne un nouveau." },
        { situation: "Le reçu WhatsApp d'une vente ne part pas : la note dit « pas encore approuvé ».", reponse: "Le modèle de message n'est pas encore accepté par Meta. Bouton WhatsApp de la ligne : le reçu complet s'ouvre sur l'appareil." },
        { situation: "Le compte Mixx de la boutique affiche 120 000 F, le téléphone 135 000 F.", reponse: "Un encaissement de 15 000 F par Mixx n'a pas été saisi (ou saisi en espèces) : le retrouver et le corriger." },
        { situation: "Un téléphone de travail est perdu.", reponse: "Prévenir l'administrateur tout de suite : il peut bloquer le compte. Ce qui n'était pas encore envoyé depuis ce téléphone est perdu." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "Dans l'espace de formation :"],
      ["ol", [
        "Laisser le téléphone 10 minutes sans le toucher ; déverrouiller avec le mot de passe.",
        "Faire une vente d'entraînement **après** avoir clôturé le jour ; lire le bandeau de 🔒 Caisse, puis reclôturer.",
        "Couper internet, faire une vente, lire le compteur ; rallumer et le regarder redescendre.",
        "Faire une capture d'écran d'un message et l'envoyer au formateur dans 💬 Messages, avec une phrase d'explication.",
      ]],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "lit un message d'incident en entier et dit la cause ;",
        "règle seul une connexion refusée, un verrou, une bande orange ;",
        "débloque ses ventes en clôturant la journée en retard ;",
        "reclôture une journée dépassée ;",
        "sait ce qui est réservé à l'administrateur et le prévient avec une capture ;",
        "ne vide jamais les données du navigateur et ne ressaisit pas une vente « pour voir ».",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Que fait-on devant « Ce compte a été bloqué par l'administrateur » ?",
        "Au bout de combien de temps la fenêtre de verrouillage apparaît-elle ? Et la session se ferme-t-elle ?",
        "Combien d'erreurs de mot de passe ferment la session ? Un doigt non reconnu compte-t-il ?",
        "Pourquoi une vente peut-elle être impossible le matin ?",
        "Que faire quand la caisse a bougé après la clôture ?",
        "Pourquoi la clôture peut-elle être grisée ?",
        "D'où vient le solde Flooz / Mixx affiché ?",
        "Que doit contenir un signalement à l'administrateur ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Lit le message et dit la cause",
      "Règle une connexion refusée et le verrou",
      "Débloque les ventes par la clôture en retard",
      "Reclôture une journée dépassée",
      "Prévient l'administrateur avec une capture",
      "N'aggrave jamais un incident",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
