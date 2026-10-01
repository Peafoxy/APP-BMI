// ============================================================
// MANUEL DE FORMATION — CHAPITRE 23 : Paramètres
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// screens/Parametres.jsx (les onglets 🏪 Boutiques, 🗂 Catalogue & devis,
// 🔌 Appareils, 🎨 Apparence, 💾 Données, 🔒 Données personnelles,
// 🗑 Corbeille, 🔐 Sécurité ; 👁 Je regarde ; Ajouter une boutique, 🖼 Logo,
// 📍 Infos reçu, 📌 Position GPS, Couleur, 🏠 Loyer, 💼 Fonds de caisse,
// 📱 Comptes mobiles, Suppr. / Suppr. avec ses données, préfixe des reçus ;
// 🤝 Taux de parrainage, 🗂 Domaines, 🔩 rail, 📦 stock à prévoir,
// 💧 frottements, 🏦 Banques, 🤖 Assistant, 👨‍💼 Alerte, ⭐ Avis Google,
// ☀️ Note ; 💾 Sauvegarde, ⏱ Sauvegarde automatique, 🔁 Synchronisation
// forcée ; 👑 Administrateur principal, 🔐 Sécurité Supabase, 🧨 Zone
// dangereuse), App.jsx (l'onglet réservé à l'administrateur, le rappel de
// sauvegarde après 7 jours), lib/calculs.js (changerEspaceRegarde),
// lib/conservation.js, lib/effacementClient.js, lib/corbeille.js.
// Le fonds de caisse est détaillé au chapitre 6, le loyer au chapitre 17,
// le dimensionnement au chapitre 11, WhatsApp au chapitre 20.
// ============================================================
export const CHAPITRE = {
  numero: 23,
  titre: "Paramètres",
  sousTitre: "Régler l'application : les boutiques et leurs caisses, le catalogue, l'assistant WhatsApp, les sauvegardes, les données personnelles et la sécurité",
  public: "Administrateur ; l'administrateur principal pour les réglages qui lui sont réservés",
  duree: "1 h 30, dans l'espace de formation",
  prerequis: "Le chapitre 2 (Utilisateurs, rôles et pouvoirs) et le chapitre 6 (Caisse : tiroir, fonds de caisse, versements).",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'administrateur sait :"],
      ["ul", [
        "créer une boutique ou un magasin, régler ses coordonnées de reçu, son logo, sa couleur, sa position, son loyer, son fonds de caisse et ses comptes mobiles ;",
        "régler ce que les devis et le stock utilisent : domaines et familles, prix et longueur du rail, stock à prévoir, banques, appareils du volet solaire ;",
        "régler l'assistant du numéro WhatsApp BMI, l'alerte conseiller et la demande d'avis Google ;",
        "faire une sauvegarde, la rendre automatique, et forcer une synchronisation ;",
        "pour l'administrateur principal : changer d'espace, remettre ou effacer les données d'une personne, vider la corbeille, régler l'écran de connexion et le cachet.",
      ]],
      ["regle", "**⚙ Paramètres n'est ouvert qu'à l'administrateur.** Et plusieurs réglages ne répondent qu'à l'**administrateur principal** : un autre administrateur les voit grisés, ou ne les voit pas."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le réglage", "Qui"], largeurs: [4800, 4500], lignes: [
        ["Ouvrir ⚙ Paramètres", "**L'administrateur.** Aucun autre rôle n'a cet onglet."],
        ["Boutiques (création, infos reçu, logo, couleur, GPS, loyer, comptes mobiles, préfixe), catalogue, banques, appareils, note du dimensionnement, sauvegarde, synchronisation", "Tout administrateur."],
        ["💼 Fonds de caisse ; 👁 Je regarde ; supprimer une boutique **avec ses données** ; restaurer une sauvegarde", "**L'administrateur principal seul.**"],
        ["🤖 Assistant WhatsApp (couper, changer de mode), 👨‍💼 Alerte, ⭐ Avis Google", "**L'administrateur principal seul** (les autres lisent l'état)."],
        ["Onglets 🎨 Apparence, 🔒 Données personnelles, 🗑 Corbeille", "**L'administrateur principal seul** : ces onglets n'existent pas pour les autres."],
        ["👑 Transférer le rôle de principal ; 🧨 réinitialiser", "**L'administrateur principal seul.**"],
      ]}],
      ["note", "Chaque geste revérifie le droit au moment où on clique : un bouton visible n'est pas une permission. Un administrateur ordinaire qui tente un réglage du principal reçoit un refus qui le dit."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["p", "**⚙ Paramètres** est le dernier onglet de l'administrateur. L'écran est rangé en onglets, du plus courant au plus lourd :"],
      ["table", { entetes: ["Onglet", "Ce qu'on y règle"], largeurs: [2700, 6600], lignes: [
        ["🏪 Boutiques", "👁 Je regarde (principal), Ajouter une boutique, le tableau des boutiques et leurs boutons."],
        ["🗂 Catalogue & devis", "Taux de parrainage, domaines et familles, rail, stock à prévoir, frottements du forage, banques, assistant WhatsApp, note du dimensionnement."],
        ["🔌 Appareils", "La liste des appareils du volet solaire, et « À classer » (le nombre s'affiche sur l'onglet)."],
        ["🎨 Apparence", "L'écran de connexion, la fenêtre de verrouillage, le cachet (principal)."],
        ["💾 Données", "Sauvegarde de secours, sauvegarde automatique toutes les heures, synchronisation forcée."],
        ["🔒 Données personnelles", "Le dossier ou l'effacement d'un client, le dossier d'un employé, la durée de conservation (principal)."],
        ["🗑 Corbeille", "Les fiches supprimées, 30 jours (principal)."],
        ["🔐 Sécurité", "L'administrateur principal, la sécurité Supabase, la zone dangereuse."],
      ]}],
      ["note", "Changer d'onglet ne perd rien : un formulaire à moitié rempli est toujours là quand on revient."],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Changer d'espace (administrateur principal)"],
      ["etapes", [
        { titre: "👁 Je regarde", texte: "En haut de 🏪 Boutiques — seulement s'il existe des boutiques d'entraînement. **💼 Le réel** ou **🎓 L'entraînement**." },
        { titre: "Confirmer", texte: "« Passer dans l'espace D'ENTRAÎNEMENT ? … La page va se recharger. » L'application devient **violette** ; tout ce que vous voyez et créez appartient à l'entraînement. Le réglage survit au rechargement et revient au réel à la déconnexion." },
      ]],

      ["h3", "B. Créer une boutique ou un magasin"],
      ["etapes", [
        { titre: "Ajouter une boutique", texte: "Nom, localisation et téléphone (facultatifs), couleur. Cocher **🏭 magasin (dépôt)** pour un lieu qui stocke sans vendre." },
        { titre: "Ce local est loué ?", texte: "La case fait apparaître montant, échéance, propriétaire, son numéro, début du bail, caution, dernier mois payé (chapitre 17)." },
        { titre: "Lire la phrase sous le formulaire", texte: "Elle dit dans quel espace la boutique sera créée : **celui que vous regardez**. Puis **Créer**." },
      ]],

      ["h3", "C. Les boutons d'une boutique"],
      ["table", { entetes: ["Bouton", "Ce qu'il règle"], largeurs: [2600, 6700], lignes: [
        ["🖼 Logo / Retirer", "Le logo imprimé sur les reçus de cette boutique (sinon le logo BMI)."],
        ["📍 Infos reçu", "Adresse, téléphone, e-mail, message en bas du reçu, et **1 ou 2 exemplaires** (client + DUPLICATA boutique)."],
        ["modifier (numéros de reçu)", "Le préfixe des reçus (2 à 5 lettres ou chiffres). Les reçus déjà émis gardent leur numéro ; les suivants repartent de 1. Un ⚠ signale deux boutiques qui partagent le même préfixe."],
        ["📌 Position GPS", "Un clic sur la carte : c'est le lien envoyé au client pour venir payer."],
        ["Couleur", "La pastille de la boutique dans tous les écrans."],
        ["🏠 Loyer", "La fiche du loyer du local (chapitre 17)."],
        ["💼 Fonds de caisse", "Le nouveau montant de l'enveloppe ; le DG apporte la différence, ou la reprend (chapitre 6). Principal seul."],
        ["📱 Comptes mobiles", "Le numéro Flooz et le numéro Mixx/T-Money de la boutique."],
        ["→ En faire un magasin / une boutique", "Change le type. Une boutique qui a déjà des ventes le demande d'abord."],
        ["Suppr.", "Une boutique **vide** seulement ; il en reste toujours au moins une."],
        ["Suppr. avec ses données", "Principal seul : tout est effacé, sur tous les appareils, après avoir **retapé le nom** exact."],
      ]}],
      ["attention", "**Sans téléphone sur la fiche**, le reçu WhatsApp automatique indique le numéro BMI principal : le tableau le signale en ambre."],

      ["h3", "D. Le catalogue et les devis"],
      ["ul", [
        "**🤝 Taux de parrainage par défaut** : ce que touche un client parrain sur l'installation de son filleul, **dû quand l'installation est réceptionnée ET entièrement payée**. Un taux personnel sur la fiche du client prime.",
        "**🗂 Domaines et familles** : Solaire et Garage savent calculer ; un domaine créé est **sans calcul** et apparaît tout de suite dans ☀️ Dimensionnement. Ajouter une famille (Entrée), la retirer (×). Seul un domaine libre se supprime.",
        "**🔩 Rail** : le prix du mètre et la longueur d'une barre (4,2 m d'office) ; l'exemple « 10 panneaux → 22 m → 6 barres » se recalcule sous vos yeux. Les devis déjà envoyés gardent leur prix.",
        "**📦 Stock à prévoir** : le nombre de jours de ventes que propose « À réapprovisionner » (21 d'office).",
        "**💧 Frottements dans le tuyau (%)** : l'estimation ajoutée à la hauteur à vaincre dans « Quelle pompe pour ce forage ? ».",
        "**🏦 Banques** : la liste proposée au versement vers BANQUE et sur la fiche des employés.",
        "**☀️ Note sous le dimensionnement** : le texte sous « Équipements proposés » ; « ↺ Rétablir le texte d'origine ».",
      ]],

      ["h3", "E. L'assistant du numéro WhatsApp BMI (principal)"],
      ["etapes", [
        { titre: "État", texte: "« ● En service » ou « ○ Coupé » ; **Couper l'assistant** / **Remettre l'assistant**." },
        { titre: "Façon de répondre", texte: "**🗣 Conversation par IA** (d'office) ou **🔢 Menu à chiffres**. L'IA a besoin de deux réglages côté serveur : sans eux, le menu répond à sa place." },
        { titre: "👨‍💼 Alerte", texte: "Votre numéro WhatsApp personnel : le numéro BMI vous prévient une fois par demande de conseiller. Vide = coupée." },
        { titre: "⭐ Avis Google", texte: "Le lien de votre fiche Google ; **Couper** arrête les demandes d'avis." },
      ]],
      ["note", "Ce que l'assistant dit et ne dit pas est au chapitre 20."],

      ["h3", "F. Les appareils du volet solaire"],
      ["p", "🔌 Appareils : **➕ Ajouter un appareil**, **✏️ Corriger**, **Retirer**. Chaque appareil a sa puissance et ses autres noms (« tv », « télé »). **À classer** liste ce que les vendeurs ont tapé et que la liste ne connaît pas, avec la puissance la plus saisie : **➕ Ajouter à la liste**."],

      ["h3", "G. Sauvegarder"],
      ["etapes", [
        { titre: "💾 Exporter une sauvegarde complète", texte: "Un fichier de toutes les données de cet appareil. Un rappel s'affiche si la dernière date de plus de 7 jours. À garder sur une clé USB ou un Drive." },
        { titre: "⏱ Sauvegarde automatique", texte: "📁 Choisir un dossier (Chrome ou Edge, sur ordinateur) : le même fichier y est réécrit toutes les heures tant que l'application est ouverte. « En pause » si le navigateur a oublié l'autorisation : ⏱ Sauvegarder maintenant la redonne." },
        { titre: "♻ Restaurer une sauvegarde", texte: "**Principal seul** : peut effacer, sur tous les appareils, ce qui a été enregistré depuis la date du fichier." },
        { titre: "🔁 Tout retélécharger depuis le serveur", texte: "Quand un appareil semble ne pas avoir les données des autres. Demande internet." },
      ]],
      ["attention", "Le fichier de sauvegarde emporte **tout** ce que l'appareil a reçu (clients, paie, et les deux espaces chez le principal). Il se range comme un document confidentiel."],

      ["h3", "H. Les données personnelles (principal)"],
      ["ul", [
        "**Un client** : le chercher, puis **🖨 Dossier personnel (PDF)** / **Exporter (CSV)** — sans jamais son mot de passe ; ou l'effacer avec un **motif obligatoire**. Une dette non soldée ou un chantier non réceptionné empêchent l'effacement.",
        "**Un employé** : son dossier seulement (sa paie se garde par la loi : pas d'effacement).",
        "**⏳ Durée de conservation** : 6 ans d'office ; la phrase que lit le client s'affiche. Les clients dépassés, et les clients sans suite archivés depuis plus d'un an, sont **proposés**, jamais effacés tout seuls.",
      ]],

      ["h3", "I. La corbeille (principal)"],
      ["p", "Une fiche supprimée y reste **30 jours** : **♻ Restaurer** la remet telle qu'elle était, **Supprimer définitivement** l'efface tout de suite."],

      ["h3", "J. L'apparence (principal)"],
      ["ul", [
        "**🎉 Écran de connexion** : texte du bandeau, couleurs, transparence des cadres, ciel étoilé, bulles, messages qui montent (6 au plus), anniversaires du jour, image de fond. **↺ Revenir à l'écran normal**.",
        "**🔒 Fenêtre de verrouillage** : couleur et transparence de sa carte.",
        "**🏷️ Cachet BMI Togo** : un seul cachet, posé sur tous les contrats et devis.",
      ]],

      ["h3", "K. La sécurité"],
      ["ul", [
        "**👑 Administrateur principal** : son nom ; lui seul peut **⚠ Transférer** son rôle à un autre administrateur — il perd alors tous ses gestes réservés.",
        "**🔐 Sécurité Supabase** : la base n'accepte que les appareils connectés avec une session sécurisée. **🔍 Vérifier qui est prêt** liste les utilisateurs actifs qui doivent se reconnecter ; dessous, le format des mots de passe enregistrés.",
        "**🧨 Zone dangereuse** : **Réinitialiser toutes les données** (principal, en ligne, sauvegarde téléchargée, code recopié, mot de passe) — les comptes restent ; **🎓 Réinitialiser uniquement la formation** efface tout ce qui appartient à l'entraînement, jamais le réel.",
      ]],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton", "Où", "Ce qu'il fait"], largeurs: [2900, 2200, 4200], lignes: [
        ["💼 Le réel / 🎓 L'entraînement", "🏪 Boutiques", "Change l'espace regardé (principal) ; la page se recharge."],
        ["Créer", "Ajouter une boutique", "Crée la boutique dans l'espace regardé."],
        ["📍 Infos reçu", "Ligne d'une boutique", "Adresse, téléphone, e-mail, message, 1 ou 2 exemplaires."],
        ["💼 Fonds de caisse", "Ligne d'une boutique", "Le montant de l'enveloppe (principal)."],
        ["📱 Comptes mobiles", "Ligne d'une boutique", "Numéros Flooz et Mixx/T-Money."],
        ["✅ Enregistrer le taux / le prix / la longueur", "🗂 Catalogue & devis", "Règle parrainage, rail, stock à prévoir, frottements."],
        ["Créer le domaine", "🗂 Catalogue & devis", "Un métier sans calcul de plus."],
        ["Couper / Remettre l'assistant", "🗂 Catalogue & devis", "Allume ou éteint l'assistant WhatsApp (principal)."],
        ["➕ Ajouter à la liste", "🔌 Appareils", "Range un appareil tapé dans les devis."],
        ["💾 Exporter une sauvegarde complète", "💾 Données", "Télécharge un fichier de toutes les données."],
        ["🔁 Tout retélécharger depuis le serveur", "💾 Données", "Resynchronise l'appareil."],
        ["🖨 Dossier personnel (PDF)", "🔒 Données personnelles", "Le document à remettre à la personne."],
        ["♻ Restaurer", "🗑 Corbeille", "Remet une fiche supprimée."],
        ["⚠ Transférer", "🔐 Sécurité", "Donne le rôle de principal à un autre administrateur."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Un réglage vaut pour tout le monde**, sur tous les appareils, dès leur prochaine synchronisation : il est rangé sur les fiches des boutiques.",
        "**Chaque changement laisse sa ligne dans 🕘 Historique**, avec son auteur.",
        "**Une boutique naît dans l'espace regardé** : en formation, elle ne compte jamais dans les chiffres réels.",
        "**Le nouveau préfixe** ne touche pas les reçus déjà émis ; les suivants repartent de 1.",
        "**La sauvegarde automatique** réécrit le même fichier toutes les heures ; un rappel s'affiche après 7 jours sans sauvegarde manuelle.",
        "**Après une mise à jour**, chaque appareil se resynchronise tout seul au premier démarrage.",
        "**La corbeille se vide seule** après 30 jours.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**🔒 Caisse** (chapitre 6) : le fonds de caisse, les comptes mobiles, la liste des banques au versement.",
        "**📦 Stocks** (chapitre 8) : domaines et familles, stock à prévoir.",
        "**☀️ Dimensionnement** (chapitres 11 et 12) : rail, appareils, note, domaines, frottements du forage.",
        "**Commissions** (chapitre 16) : le taux de parrainage.",
        "**📤 Dépenses** (chapitre 17) : le loyer.",
        "**📲 WhatsApp** (chapitre 20) : l'assistant, l'alerte, la demande d'avis, le téléphone de la boutique sur les reçus.",
        "**Espace client** (chapitre 21) : la durée de conservation et la demande de données.",
        "**Hors connexion** (chapitre 24) : sauvegarde et synchronisation forcée.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Chaque boutique a son téléphone, son adresse et sa position GPS.",
        "Aucun ⚠ « préfixe partagé » dans le tableau des boutiques.",
        "Chaque semaine : une sauvegarde exportée, ou la sauvegarde automatique « ACTIVE ».",
        "Le lien d'avis Google et l'alerte conseiller sont « ● » en service.",
        "« À classer » est vidé de temps en temps.",
        "Après l'arrivée d'un nouvel employé : 🔍 Vérifier qui est prêt.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["Erreur", "Ce qu'il faut faire"], largeurs: [4200, 5100], lignes: [
        ["Créer une boutique en regardant la formation alors qu'on la voulait réelle.", "Lire la phrase sous le formulaire avant de cliquer ; changer « 👁 Je regarde » d'abord."],
        ["Changer le préfixe en croyant renuméroter les anciens reçus.", "Les anciens gardent leur numéro ; seuls les prochains changent."],
        ["Supprimer une boutique qui a des données.", "« Suppr. » refuse ; « Suppr. avec ses données » efface tout pour de bon (principal, nom retapé)."],
        ["Garder la sauvegarde sur l'ordinateur de la boutique.", "La mettre sur une clé USB ou un Drive : un ordinateur volé emporte la sauvegarde avec lui."],
        ["Chercher l'onglet 🎨 Apparence ou 🔒 Données personnelles avec un compte administrateur ordinaire.", "Ils n'existent que pour l'administrateur principal."],
        ["Transférer le rôle de principal « pour essayer ».", "Le transfert est immédiat : seul le nouveau principal peut le rendre."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "BMI ouvre une boutique à Kégué.", reponse: "🏪 Boutiques → Ajouter une boutique : nom, localisation, téléphone, couleur ; « Ce local est loué » si besoin ; vérifier la phrase d'espace ; Créer. Puis 📌 Position GPS et 📱 Comptes mobiles." },
        { situation: "Deux boutiques AGOÈ NORD et AGOÈ SUD ont des reçus « AGO-… ».", reponse: "« modifier » sur l'une : un préfixe à elle (ex. AGN). Le ⚠ disparaît." },
        { situation: "Le prix du mètre de rail augmente.", reponse: "🗂 Catalogue & devis → 🔩 Prix du mètre → Enregistrer. Les devis déjà envoyés gardent l'ancien prix." },
        { situation: "Un client demande ce que BMI garde sur lui.", reponse: "🔒 Données personnelles (principal) → le chercher → 🖨 Dossier personnel (PDF), à lui remettre en main propre." },
        { situation: "Un chantier supprimé par erreur hier.", reponse: "🗑 Corbeille → ♻ Restaurer (moins de 30 jours)." },
        { situation: "Un téléphone n'a pas les ventes saisies sur l'ordinateur.", reponse: "💾 Données → 🔁 Tout retélécharger depuis le serveur, avec internet." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "Dans l'espace de formation :"],
      ["ol", [
        "Créer une boutique d'entraînement, lui poser une couleur, un téléphone et une position GPS.",
        "Changer son préfixe de reçu.",
        "Ajouter une banque à la liste, puis la retirer.",
        "Ajouter un appareil « À classer » à la liste.",
        "Exporter une sauvegarde complète.",
        "Lire l'état de l'assistant WhatsApp et dire ce que fait chaque mode.",
      ]],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'administrateur, sans aide :"],
      ["cases", [
        "crée une boutique dans le bon espace et règle ses coordonnées de reçu ;",
        "dit quels réglages sont réservés à l'administrateur principal ;",
        "règle le rail, les banques et les appareils ;",
        "exporte une sauvegarde et explique la sauvegarde automatique ;",
        "sait où remettre ou effacer les données d'un client.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Qui a l'onglet ⚙ Paramètres ? Quels onglets sont réservés au principal ?",
        "Dans quel espace naît une boutique créée ?",
        "Que devient la numérotation quand on change un préfixe ?",
        "Quand un client parrain touche-t-il sa part ?",
        "Que fait l'assistant si la conversation par IA n'est pas réglée côté serveur ?",
        "Que contient un fichier de sauvegarde, et où le garder ?",
        "Combien de temps une fiche reste-t-elle dans la corbeille ?",
        "Que se passe-t-il quand le principal transfère son rôle ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Crée et règle une boutique",
      "Distingue réglages administrateur et principal",
      "Règle le catalogue et les devis",
      "Lit et règle l'assistant WhatsApp",
      "Sauvegarde et resynchronise",
      "Connaît données personnelles et corbeille",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
