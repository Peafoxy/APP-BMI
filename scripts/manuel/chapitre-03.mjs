// ============================================================
// MANUEL DE FORMATION — CHAPITRE 3 : Clients
//
// Des MOTS, rien d'autre. Chaque bouton, chaque règle vient du code :
// screens/Clients.jsx (🙋 Créer un client, 👤 Clients), screens/Utilisateurs.jsx
// (la création par l'administrateur, le logo WhatsApp et le mot de fidélité),
// screens/Prospects.jsx (✅ Convertir en client), screens/EspaceClient.jsx et
// screens/MesDonnees.jsx (ce que le client voit), lib/comptesClients.js
// (identifiantClient, resoudreMotDePasseClient, fabriquerCompteClient,
// messagesNouveauClient, motDePasseConnu, MESSAGE_FIDELITE_DEFAUT),
// lib/identiteClient.js (motDePasseClient, memeNumero — les 8 derniers
// chiffres), lib/clientsConnus.js (la liste de 👤 Clients et les propositions
// de 💰 Ventes), lib/calculs.js (compteClientPour, comptesAvecCeNumero,
// ONGLETS_ROLE), lib/whatsappModeles.js (le modèle « espace »).
// ============================================================
export const CHAPITRE = {
  numero: 3,
  titre: "Clients",
  sousTitre: "Ouvrir un accès à un client, le retrouver, lui écrire — et ce qu'il voit de son côté",
  public: "Tout le personnel qui reçoit un client : vendeur, gérant, magasinier, commercial, technicien, comptable, administrateur",
  duree: "45 minutes, puis l'exercice en espace formation",
  prerequis: "Le chapitre 1 (se connecter). Pour l'administrateur : le chapitre 2 (👥 Utilisateurs).",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, la personne sait :"],
      ["ul", [
        "**ouvrir un compte à un client** depuis 🙋 Créer un client, avec son nom et son numéro seulement — l'identifiant et le mot de passe se fabriquent tout seuls et partent par WhatsApp ;",
        "reconnaître un client **déjà enregistré** avant de créer un doublon, et lui **renvoyer ses accès** ;",
        "lire la liste **👤 Clients** d'une boutique : combien de fois il est venu, ce qu'il a acheté, ce qu'il doit encore ;",
        "**lui écrire** sur WhatsApp depuis l'application, avec le mot de fidélité de la maison ;",
        "expliquer au client **ce qu'il verra dans son espace** : ses devis, son installation, son mot de passe, ses données.",
      ]],
      ["note", "Un client, dans l'application, c'est **deux choses différentes** : un **compte** (il peut se connecter et suivre ses devis) et une **ligne dans 👤 Clients** (il a acheté ou doit quelque chose à la boutique). L'un n'entraîne pas l'autre : c'est le **numéro de téléphone** qui relie les deux. Tout ce chapitre tourne autour de cette idée."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [5200, 4100], lignes: [
        ["🙋 Créer un client (onglet à part) et « ↻ Renvoyer ses accès »", "Vendeur, gérant, magasinier, commercial, technicien, technicien BMI, responsable commercial. Le comptable voit l'onglet mais ne peut rien créer : son compte est en lecture seule."],
        ["Créer un client depuis 👥 Utilisateurs (rôle « Client »)", "**L'administrateur** (chapitre 2)"],
        ["✅ Convertir un prospect en client (🧲 Prospects)", "Le commercial **qui suit ce prospect**, et l'administrateur"],
        ["🤝 Parrainer un proche (depuis son espace)", "**Le client lui-même** (chapitre 16)"],
        ["Ouvrir 👤 Clients (la liste d'une boutique) et le bouton WhatsApp", "Vendeur, gérant, comptable, administrateur"],
        ["Le logo WhatsApp avec le mot de fidélité, sous le numéro d'un client", "L'administrateur, dans 👥 Utilisateurs"],
        ["Changer le mot de passe d'un client", "Le client, dans son espace (« 🔑 Mon mot de passe ») ; l'administrateur principal (chapitre 2)"],
        ["Corriger le nom ou le numéro d'un client, effacer ses données", "Le numéro : jamais depuis 👥 Utilisateurs (voir la rubrique 9). L'effacement : l'administrateur principal, ⚙ Paramètres → 🔒 Données personnelles (chapitre 23)"],
      ]}],
      ["regle", "**Créer un client ne donne aucune commission.** L'application note simplement qui l'a amené (« Les clients que j'ai amenés »), pour la traçabilité. La commission d'un commercial vient de la vente ou du chantier, jamais de la création du compte."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3300, 6000], lignes: [
        ["**🙋 Créer un client**", "Le formulaire « 🙋 Créer un compte client » (nom, numéro WhatsApp, « Ce contact est… »), le bouton « 🙋 Créer + envoyer », puis le cadre « Les clients que j'ai amenés » avec « ↻ Renvoyer ses accès »."],
        ["**👤 Clients**", "La liste des clients **de la boutique regardée** : pastilles de boutique en haut (pour qui n'a pas de boutique attitrée), « Clients — NOM DE LA BOUTIQUE (N) », la ligne « Rechercher un client… », le tableau, 50 lignes par page."],
        ["**👥 Utilisateurs** (administrateur)", "Tous les comptes, clients compris : le « 📞 numéro » sous le nom avec le logo WhatsApp, « 👁 Voir le mot de passe » (principal), « Autoriser chat libre »."],
        ["**🧲 Prospects**", "« ✅ Convertir en client » sur la ligne d'un prospect qui a dit oui."],
        ["**💰 Ventes**, **🧾 Dettes**, **🛠 Travaux à crédit**", "La case « Client » et la case « Numéro du client » proposent les clients que la boutique connaît déjà : un clic remplit les deux."],
        ["**⚙ Paramètres** (administrateur)", "« 💬 Mot de fidélité envoyé au client » ; « 🔒 Données personnelles » (principal)."],
      ]}],
      ["note", "Sur téléphone, les onglets sont dans la barre du bas ; on la fait défiler avec le doigt. Un onglet qui manque n'est pas une panne : il n'est pas dans le rôle de la personne, ou il lui a été retiré dans 🔐 Pouvoirs (chapitre 2)."],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Ouvrir un compte à un client — 🙋 Créer un client"],
      ["etapes", [
        { titre: "Ouvrir l'onglet 🙋 Créer un client", texte: "Le cadre « 🙋 Créer un compte client » s'affiche. Il dit ce qu'il fait : « Le nom et le numéro suffisent — le mot de passe est généré, et ses identifiants partent par WhatsApp. »" },
        { titre: "Taper le « Nom du client »", texte: "Exemple : KOFFI AMA. Il sera écrit en majuscules quoi qu'on tape. C'est ce nom qui deviendra son **identifiant** de connexion." },
        { titre: "Taper le « Numéro WhatsApp »", texte: "Exemple : +228 90 55 44 33. **Au moins 4 chiffres**, en pratique les 8 chiffres du numéro togolais. C'est ce numéro qui recevra les accès, et qui rattachera ses achats à son compte." },
        { titre: "Lire le cadre ambre, s'il apparaît", texte: "Dès que le numéro est reconnu, une ligne « ⚠ Déjà client : NOM — numéro » s'affiche sous la case. **Ce client existe déjà : on ne le recrée pas.** Un clic sur la ligne remet son nom et son numéro dans les cases — utile pour lui renvoyer ses accès depuis 👥 Utilisateurs, ou simplement pour s'arrêter là." },
        { titre: "Choisir « Ce contact est… »", texte: "« **Client décidé** — il va suivre son devis / son installation. Pas de relance. » (coché d'office) ou « **Prospect** — un compte est créé ET il entre dans la file de relance de vos commerciaux. » Voir la rubrique 6 pour ce que change le second choix." },
        { titre: "Vérifier l'aperçu vert", texte: "Sous le bouton : « Sera créé — 👤 KOFFI AMA · 🔑 ****** ». L'identifiant et le mot de passe se lisent **avant** de cliquer. Si l'identifiant porte des chiffres (KOFFI AMA90), c'est qu'un autre compte a déjà ce nom." },
        { titre: "Cliquer « 🙋 Créer + envoyer »", texte: "Une confirmation reprend l'identifiant et le mot de passe : « Créer le compte de KOFFI AMA ? … Ses identifiants lui seront envoyés par WhatsApp. » On valide." },
        { titre: "Laisser partir les accès", texte: "Le message part **du numéro BMI** (+228 99 96 84 88) : l'écran dit « ✅ Identifiants envoyés du numéro BMI à KOFFI AMA. » Si le numéro BMI ne peut pas envoyer (formation, pas de réseau, refus de WhatsApp), **WhatsApp s'ouvre sur votre appareil** avec le message complet : on appuie sur Envoyer. Le cadre vert « ✅ KOFFI AMA créé — 👤 … · 🔑 … » reste à l'écran pour relire les accès." },
      ]],
      ["attention", "**On ne crée un compte qu'avec le numéro WhatsApp du client lui-même.** Un compte créé sur le numéro d'un tiers enverrait les accès à la mauvaise personne, et les achats du client ne se rattacheraient jamais à lui."],

      ["h3", "B. Renvoyer ses accès à un client"],
      ["ol", [
        "Dans 🙋 Créer un client, le cadre « **Les clients que j'ai amenés (N)** » liste ceux que **vous** avez créés, avec leur numéro.",
        "Sur sa ligne, « **↻ Renvoyer ses accès** » : l'application **recalcule** son mot de passe (il n'est écrit nulle part en clair) et l'envoie comme à la création — du numéro BMI, sinon WhatsApp s'ouvre.",
        "Si le client a **changé** son mot de passe depuis son espace : « Ce compte a un mot de passe personnalisé, impossible de le régénérer ici. » Seul l'administrateur principal peut lui en poser un nouveau (👥 Utilisateurs → 🔑 Mot de passe, chapitre 2).",
        "Un client créé par quelqu'un d'autre n'est pas dans votre cadre : l'administrateur le retrouve dans 👥 Utilisateurs (recherche par le nom **ou le numéro**) et lui renvoie ses accès de là.",
      ]],

      ["h3", "C. Retrouver un client dans 👤 Clients"],
      ["etapes", [
        { titre: "Choisir la boutique", texte: "Les pastilles du haut (pour qui n'a pas de boutique attitrée). La liste est **celle de la boutique regardée** : un client de DEMAKPOE n'apparaît pas dans APESSITO. La boutique choisie est mémorisée pour cet écran." },
        { titre: "Taper dans « Rechercher un client… »", texte: "Le nom **ou le numéro** : « koffi », « 90 55 », « +228 90 ». La règle est celle de toute recherche dans l'application : sans accents ni majuscules, chaque mot tapé dans n'importe quel ordre." },
        { titre: "Lire la ligne", texte: "Client · Téléphone · Achats (combien de fois) · Total acheté · Dette en cours (**en rouge** s'il doit encore quelque chose, en vert sinon) · Dernier achat. Les clients sont rangés du **plus gros total acheté** au plus petit." },
        { titre: "Cliquer « WhatsApp »", texte: "Au bout de la ligne, si un numéro est connu. WhatsApp s'ouvre sur une conversation **vide** avec ce client, depuis votre appareil. Sans numéro : « Aucun numéro enregistré pour ce client. »" },
      ]],
      ["note", "**Cette liste ne vient pas des comptes** : elle est construite à partir des **ventes et des dettes** de la boutique. Un client qui a un compte mais n'a encore rien acheté n'y figure pas ; un client de passage, enregistré sur une vente sans compte, y figure. Pour les comptes, c'est 👥 Utilisateurs (administrateur)."],

      ["h3", "D. Écrire à un client avec le mot de fidélité (administrateur)"],
      ["ol", [
        "👥 Utilisateurs → retrouver le client → sous son nom, la ligne « 📞 numéro » porte le **logo vert WhatsApp**.",
        "Un clic ouvre WhatsApp avec le **mot de fidélité** de la maison déjà écrit : « Bonjour KOFFI AMA.. c'est TIMO, l'administrateur chez BMI … MERCI POUR VOTRE CONFIANCE … Consultez aussi notre site Web bmitogo.com ».",
        "**WhatsApp n'envoie jamais tout seul** : le texte arrive dans la case de saisie, on le complète ou on l'efface, puis on appuie sur Envoyer.",
        "Sur la fiche d'un **employé**, le même logo ouvre une conversation vide : le mot de fidélité est réservé aux clients.",
        "Le texte se règle dans ⚙ Paramètres → « 💬 Mot de fidélité envoyé au client », avec un aperçu « Ce que le client recevra » et « ↺ Rétablir le texte d'origine ». Trois mots se remplacent tout seuls : {client}, {auteur}, {role}.",
      ]],
    ]},

    // ── 5
    { titre: "Explication de chaque bouton et champ", blocs: [
      ["h3", "🙋 Créer un client"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Nom du client", "Le nom tel qu'on l'appelle. Il devient son identifiant (en majuscules). S'il est déjà pris, des chiffres du numéro s'y accolent."],
        ["Numéro WhatsApp", "Le numéro du client, celui qui reçoit ses accès. Au moins 4 chiffres. Dès qu'il est reconnu : « ⚠ Déjà client : … »."],
        ["Client décidé", "Un compte, rien d'autre. Le client suivra son devis ou son installation."],
        ["Prospect", "Un compte **et** une fiche dans 🧲 Prospects (statut « Favorable », intérêt « Intéressé », note « Amené par VOUS »). Il entre dans la file de relance des commerciaux et en sort à son paiement."],
        ["🙋 Créer + envoyer", "Crée le compte, prévient les administrateurs, envoie les accès."],
        ["Sera créé — 👤 … · 🔑 …", "L'aperçu de l'identifiant et du mot de passe, avant de cliquer."],
        ["✅ NOM créé — 👤 … · 🔑 …", "Le récapitulatif après création, avec la façon dont les accès sont partis."],
        ["Les clients que j'ai amenés (N)", "Vos clients à vous, avec « ↻ Renvoyer ses accès »."],
      ]}],
      ["h3", "👤 Clients"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Pastilles de boutique", "La boutique dont on lit les clients. Absentes pour un vendeur ou un gérant rattaché à une boutique : c'est la sienne."],
        ["Rechercher un client…", "Filtre la liste par le nom ou le numéro."],
        ["Achats", "Le nombre de ventes de cette boutique à ce client."],
        ["Total acheté", "La somme de ces ventes."],
        ["Dette en cours", "Ce qui reste à payer sur ses dettes ordinaires (les réservations prépayées ne sont pas une dette). Rouge si > 0."],
        ["Dernier achat", "La date de sa vente ou de sa dette la plus récente. C'est aussi cette ligne-là qui dit comment son nom s'écrit aujourd'hui."],
        ["WhatsApp", "Ouvre une conversation vide avec lui, depuis votre appareil."],
        ["Pagination", "50 clients par page."],
      ]}],
      ["h3", "Dans 💰 Ventes (et 🧾 Dettes, 🛠 Travaux à crédit)"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Client", "Taper un nom ou un numéro : la liste propose les clients que **cette boutique** connaît, avec leur numéro, leur dernier passage et ce qu'ils doivent encore. **Un clic remplit le nom ET le numéro.** Ce qu'on tape n'est jamais transformé : un client de passage se saisit librement."],
        ["Numéro du client", "La même proposition, par le numéro. Trois chiffres suffisent à réduire la liste."],
        ["⚠ 2 clients à ce nom, vérifiez le numéro", "Deux clients s'écrivent pareil : la liste ne montre que le plus récent et le dit. On vérifie le numéro avant de choisir."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["h3", "À la création du compte"],
      ["ul", [
        "**L'identifiant** = le nom en majuscules. S'il est déjà pris par un autre compte (client ou employé), l'application y accole les **2 premiers chiffres** du numéro (KOFFI AMA90), puis 4, puis un compteur. Un identifiant ne se prend jamais deux fois.",
        "**Le mot de passe** = **6 caractères** pris dans les chiffres de son numéro et les lettres de son nom, mélangés toujours de la même façon pour ce client. Si un autre client tombe sur le même mot de passe, l'application en essaie une autre variante, puis l'allonge. Il n'est **jamais écrit en clair** : la fiche garde de quoi le **recalculer** — c'est ce qui permet « ↻ Renvoyer ses accès » et « 👁 Voir le mot de passe ».",
        "**Le compte naît dans l'espace où l'on est** (réel ou formation), avec le rôle « client », sans boutique. Un client de formation ne reçoit jamais un vrai message : en formation, le numéro BMI n'envoie rien, WhatsApp s'ouvre sur l'appareil.",
        "**Les administrateurs sont prévenus** par un message dans 💬 Messages : « 🙋 Nouveau client créé par VOUS : KOFFI AMA (+228 90 55 44 33). » — ceux de l'espace du client, et l'administrateur principal toujours. Celui qui crée n'est pas prévenu de son propre geste.",
        "**Le journal** (📜 Historique) note « Compte CLIENT « KOFFI AMA » créé par VOUS » — « (+ prospect à relancer) » si la case Prospect était cochée.",
        "**Les accès partent par le modèle WhatsApp « espace »**, approuvé par Meta, du numéro BMI : « Bonjour Mr/Mme KOFFI AMA, BIENVENUE SUR https://gestion.bmitogo.com votre espace avec : KOFFI AMA et ****** À bientôt ! BMI TOGO ». Coût : environ 4 F par compte. En repli (formation, réseau, refus), WhatsApp s'ouvre avec le texte long d'avant (👤 Identifiant / 🔑 Mot de passe, et le conseil de changer le mot de passe).",
        "**« Amené par »** est écrit sur la fiche (votre nom). C'est une trace, pas une commission.",
      ]],
      ["h3", "Le numéro relie tout"],
      ["ul", [
        "Deux numéros sont **le même** s'ils ont les mêmes **8 derniers chiffres** : « +228 90 11 22 33 » et « 90112233 » sont la même personne. C'est ainsi que l'application refuse un doublon, retrouve un compte, rattache une vente.",
        "**Une vente, une dette, un devis se rattachent au compte du client par son numéro** (sinon par son nom écrit exactement pareil). Un numéro tapé de travers sur la vente, et le client ne la voit pas dans ses données. D'où la proposition automatique dans 💰 Ventes : un clic, et le numéro est le bon.",
        "**👤 Clients regroupe les lignes par numéro** (le nom à défaut) : c'est la ligne la plus récente qui dit comment le client s'écrit aujourd'hui.",
      ]],
      ["h3", "Ce que le client voit, de son côté"],
      ["table", { entetes: ["Son onglet", "Ce qu'il y trouve"], largeurs: [2600, 6700], lignes: [
        ["🏠 Mon espace", "« 🏠 Bienvenue, NOM ». Sa **fiche d'installation** quand elle existe (type, date, prochain entretien, le chef d'équipe avec « ✉️ Écrire au chef d'équipe »), sinon « Votre fiche d'installation n'est pas encore disponible ». **📋 Mes devis** : chaque devis avec « ✅ JE VALIDE », « ✏️ Demander une modification », « ❌ Rejeter ce devis », puis le suivi du paiement, « 📄 Télécharger mon contrat », le PV à signer. **🤝 Parrainez vos proches** (chapitre 16). **🔑 Mon mot de passe** → « Changer mon mot de passe ». Un **🎁 cadeau** s'il lui en a été offert un."],
        ["💬 Messages", "Son fil avec BMI : « Vos messages sont transmis à l'équipe BMI Togo (administration, techniciens et votre commercial). » « Autoriser chat libre » (👥 Utilisateurs) lui ouvre en plus des conversations en 1-à-1 avec l'équipe."],
        ["🔒 Mes données", "« 🖨 Télécharger mes données (PDF) » — tout ce que BMI détient sur lui, achats compris —, ses droits en toutes lettres, « Demander une correction », « Demander la suppression » (chapitre 23)."],
        ["📄 Mes contrats", "Ses contrats d'installation. **L'onglet n'apparaît que le jour où il a signé au moins un contrat**, pas avant."],
      ]}],
      ["note", "**Ses achats en boutique ne s'affichent pas dans 🏠 Mon espace** : cet écran suit les devis et l'installation. Ils sont dans le document de 🔒 Mes données. Sur son appareil, la base ne contient **que ses données** : il ne voit ni les autres clients, ni les employés, ni les prix du stock."],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**💰 Ventes, 🧾 Dettes, 🛠 Travaux à crédit** : la case Client propose les clients connus de la boutique ; la vente encaissée nourrit 👤 Clients et se rattache au compte par le numéro.",
        "**☀️ Dimensionnement / 📋 Tous les devis** : un devis se fait **pour un compte client** ; il apparaît dans 📋 Mes devis de son espace, et sa relance part du numéro BMI. Sans compte, pas de devis à suivre : d'où 🙋 Créer un client **avant** le devis.",
        "**🧲 Prospects** : « Prospect » coché à la création pose une fiche liée ; « ✅ Convertir en client » fait l'inverse (le compte à partir du prospect). Au premier paiement, le prospect sort de la file.",
        "**🤝 Parrainage** (chapitre 16) : le client crée lui-même le compte de son filleul depuis son espace ; le message part du **téléphone du parrain**, jamais du numéro BMI — c'est lui qui recommande.",
        "**👥 Utilisateurs** (chapitre 2) : le même compte, vu par l'administrateur — 👁 Voir le mot de passe, 🔑 en poser un nouveau, ⛔ Bloquer, « Autoriser chat libre ». **Un compte client ne change jamais de rôle** : s'il devient employé, on lui crée un compte d'employé.",
        "**💬 Messages** (chapitre 20) : la création prévient les administrateurs ; le client écrit au support et à son chef d'équipe.",
        "**📲 WhatsApp** : une conversation est rangée **sous le numéro**, qu'il ait un compte ou non. Le premier message d'un client sans compte va au support.",
        "**⚙ Paramètres → 🔒 Données personnelles** (chapitre 23) : le dossier d'accès, l'effacement (nom retiré des factures, compte supprimé), la durée de conservation. Supprimer un compte dans 👥 Utilisateurs **n'efface pas** son nom des ventes : c'est ce panneau qui le fait.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Le numéro est celui du **client lui-même**, à 8 chiffres, relu avec lui avant de cliquer.",
        "Aucune ligne « ⚠ Déjà client » sous le numéro — sinon on s'arrête : le compte existe.",
        "L'aperçu vert montre l'identifiant attendu ; s'il porte des chiffres, on sait pourquoi (un autre compte a ce nom) et on le dit au client.",
        "Le message est bien parti : « ✅ Identifiants envoyés du numéro BMI » — ou, si WhatsApp s'est ouvert, on a appuyé sur Envoyer.",
        "Le client a **reçu** le message et peut ouvrir gestion.bmitogo.com : on le vérifie avec lui s'il est devant nous.",
        "Dans 💰 Ventes, on **clique** sur la proposition du client plutôt que de retaper son numéro.",
        "Dans 👤 Clients, on regarde la **bonne boutique** avant de conclure qu'un client est inconnu.",
        "Chaque semaine (gérant) : la colonne « Dette en cours » de 👤 Clients — les rouges se relancent depuis 🧾 Dettes.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3300], lignes: [
        ["Nom ou numéro incomplet", "« Indiquez le nom du client et son numéro (au moins 4 chiffres). »", "Compléter. Un numéro togolais fait 8 chiffres."],
        ["Recréer un client qui existe", "« Un compte existe déjà pour ce numéro : NOM. Rien n'a été recréé. »", "Lui renvoyer ses accès (👥 Utilisateurs, ou votre cadre « Les clients que j'ai amenés »)."],
        ["Le client ne trouve pas le message", "Les accès sont partis sur le numéro tapé ; s'il est faux, ils sont partis chez quelqu'un d'autre.", "Vérifier le numéro sur sa fiche (👥 Utilisateurs). S'il est faux : c'est l'administrateur principal qui règle (le numéro fabrique l'identifiant et le mot de passe)."],
        ["Vouloir corriger le numéro d'un client dans ⋯ Gérer → 📞", "« Le numéro d'un CLIENT ne se change pas ici : son identifiant et son mot de passe en dépendent, il ne pourrait plus se connecter. »", "Voir avec l'administrateur principal."],
        ["« ↻ Renvoyer ses accès » refusé", "« Ce compte a un mot de passe personnalisé, impossible de le régénérer ici. »", "Le client l'a changé lui-même. L'administrateur principal lui en pose un nouveau (🔑 Mot de passe)."],
        ["WhatsApp s'ouvre sur l'appareil au lieu de partir du numéro BMI", "C'est le **repli** : formation, pas de réseau, ou WhatsApp a refusé (le motif s'affiche en français).", "Appuyer sur Envoyer : le client reçoit le même message, de votre numéro. Rien n'est perdu."],
        ["Le client a un compte mais n'apparaît pas dans 👤 Clients", "La liste vient des ventes et des dettes de la boutique regardée, pas des comptes.", "Il n'a encore rien acheté ici, ou on regarde une autre boutique. Les comptes sont dans 👥 Utilisateurs."],
        ["Le même client sur deux lignes de 👤 Clients", "Une vente porte son numéro, l'autre pas (ou un numéro différent) : l'application ne peut pas les réunir.", "Toujours **cliquer** sur la proposition dans 💰 Ventes. Les lignes déjà faites se corrigent par l'administrateur."],
        ["Vouloir donner un rôle d'employé à un client", "« Un compte client ne change jamais de rôle. »", "Créer un compte d'employé (chapitre 2)."],
        ["Supprimer le compte pour « faire disparaître » un client", "Seul l'accès part ; son nom reste sur les ventes, les dettes, les chantiers.", "⚙ Paramètres → 🔒 Données personnelles (chapitre 23), administrateur principal."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Une cliente, AMA, achète deux panneaux au comptant et demande à suivre sa future installation. Elle n'a jamais eu de compte.", reponse: "Avant ou après la vente, 🙋 Créer un client : son nom, son numéro, « Client décidé », « 🙋 Créer + envoyer ». Elle reçoit ses accès du numéro BMI. Dans 💰 Ventes, on **clique** sur sa proposition pour que la vente porte le bon numéro : elle la retrouvera dans 🔒 Mes données." },
        { situation: "Un homme se présente pour un devis. En tapant son numéro, la ligne « ⚠ Déjà client : ESSO — +228 90 11 22 33 » apparaît.", reponse: "On ne crée rien. Il a déjà un compte, probablement créé par un collègue. S'il ne se souvient plus de ses accès, l'administrateur les lui renvoie depuis 👥 Utilisateurs (ou le collègue qui l'a amené, depuis son cadre). Le devis se fait sur ce compte-là." },
        { situation: "KOSSI, technicien, rencontre sur un chantier un voisin intéressé mais pas décidé.", reponse: "🙋 Créer un client avec « **Prospect** » coché : le voisin a un compte pour recevoir un devis, ET une fiche dans 🧲 Prospects que les commerciaux relanceront. KOSSI ne touche rien pour cette création ; sa commission viendra du chantier s'il l'installe." },
        { situation: "Le gérant veut savoir quels clients de DEMAKPOE doivent encore de l'argent.", reponse: "👤 Clients, pastille DEMAKPOE : la colonne « Dette en cours » en rouge. Il les relance depuis 🧾 Dettes (bouton « Relancer », du numéro BMI). 👤 Clients sert à voir, 🧾 Dettes sert à agir." },
        { situation: "Une cliente a changé son mot de passe depuis son espace, l'a oublié, et le vendeur clique « ↻ Renvoyer ses accès ».", reponse: "Refusé : « mot de passe personnalisé ». Le vendeur ne peut rien faire de plus ; il prévient l'administrateur principal, qui lui en pose un nouveau dans 👥 Utilisateurs → 🔑 Mot de passe et le lui envoie." },
        { situation: "En formation, un stagiaire crée un client avec son propre numéro pour s'entraîner.", reponse: "Le compte naît en formation (badge 🎓). Le numéro BMI n'envoie rien : WhatsApp s'ouvre sur l'appareil — le stagiaire peut fermer sans envoyer. Rien ne part vers un vrai client, et ce compte n'existera jamais en réel." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "**En espace formation**, avec un formateur qui regarde l'écran :"],
      ["ol", [
        "Créer un client « TEST AMA » avec un numéro de formation convenu. Lire à voix haute l'aperçu vert **avant** de cliquer : quel sera son identifiant, combien de caractères a son mot de passe.",
        "Recommencer avec le **même numéro** et un autre nom : montrer la ligne « ⚠ Déjà client » et expliquer pourquoi on s'arrête.",
        "Créer un second client « TEST KOSSI » avec « Prospect » coché, puis le retrouver dans 🧲 Prospects (note « Amené par … »).",
        "Dans 💰 Ventes, commencer une vente en tapant « test » dans la case Client : choisir TEST AMA d'un clic, montrer que le numéro s'est rempli tout seul. Encaisser la vente.",
        "Ouvrir 👤 Clients : retrouver TEST AMA (1 achat), expliquer pourquoi TEST KOSSI **n'y est pas**.",
        "Depuis « Les clients que j'ai amenés », cliquer « ↻ Renvoyer ses accès » de TEST AMA et dire par quel chemin le message est parti (numéro BMI, ou WhatsApp ouvert — et pourquoi, en formation).",
        "Se connecter avec le compte de TEST AMA sur un autre appareil : montrer 🏠 Mon espace, 🔑 Mon mot de passe, 🔒 Mes données → « 🖨 Télécharger mes données (PDF) », et retrouver la vente dans le document.",
      ]],
      ["note", "Le formateur vérifie surtout deux réflexes : **cliquer** sur la proposition dans Ventes plutôt que retaper, et **s'arrêter** devant « ⚠ Déjà client »."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "crée un client avec le nom et le numéro, et sait lire l'aperçu de ses accès ;",
        "reconnaît un client déjà enregistré et ne le recrée pas ;",
        "sait renvoyer des accès, et à qui s'adresser quand c'est refusé ;",
        "explique la différence entre un compte (👥 Utilisateurs) et une ligne de 👤 Clients ;",
        "choisit le client par un clic dans 💰 Ventes, et sait pourquoi le numéro compte ;",
        "sait ce que le client voit dans son espace, et où sont ses achats.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Un client n'a jamais rien acheté mais a un compte. Où le retrouve-t-on : 👤 Clients ou 👥 Utilisateurs ? Pourquoi ?",
        "Que se passe-t-il si le nom tapé est déjà l'identifiant d'un autre compte ?",
        "« +228 90 11 22 33 » et « 90112233 » : un client ou deux ? Sur quoi l'application se fonde-t-elle ?",
        "« ↻ Renvoyer ses accès » répond « mot de passe personnalisé ». Que s'est-il passé, et qui peut agir ?",
        "WhatsApp s'ouvre sur votre téléphone au lieu que le message parte du numéro BMI. Est-ce une panne ? Que faites-vous ?",
        "Créer un client donne-t-il une commission ? D'où vient la commission d'un commercial ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Crée un client avec le nom et le numéro, et lit l'aperçu de ses accès",
      "Reconnaît un client déjà enregistré (« ⚠ Déjà client ») et ne le recrée pas",
      "Renvoie des accès, et sait à qui s'adresser quand c'est refusé",
      "Distingue un compte (👥 Utilisateurs) d'une ligne de 👤 Clients",
      "Choisit le client par un clic dans 💰 Ventes",
      "Sait ce que le client voit dans son espace, et où sont ses achats",
      "Répond juste aux six questions de la rubrique 12",
    ],
  },
};
