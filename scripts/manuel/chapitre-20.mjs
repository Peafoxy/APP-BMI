// ============================================================
// MANUEL DE FORMATION — CHAPITRE 20 : Messagerie et WhatsApp
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// screens/Messagerie.jsx (💬 Conversations : 🔴 Nouveaux messages, Équipe,
// Groupes + Nouveau, Clients qui vous ont écrit, Mes clients (chef
// d'équipe), Support clients ; 🛟 Écrire à BMI Togo côté client ; Membres,
// Supprimer, 👥 Nouveau groupe de discussion, Créer le groupe ; Envoyer),
// lib/calculs.js (peutVoirFilClient), lib/conversations.js (separerNonLues),
// screens/Utilisateurs.jsx (Autoriser / Retirer chat libre),
// screens/Whatsapp.jsx (📲 WhatsApp : ✍️ Écrire, Rechercher une
// conversation…, Conversations, Conversations anciennes, 🔁 Confier,
// ✏️ Nommer, 🔓 Rendre à tous, la bande de la fenêtre de 24 h, ✍️ Lui écrire quand
// même, 🤖 Assistant BMI TOGO, 👨‍💼 attend un conseiller, ✓ ✓✓ ❌),
// lib/whatsappConversations.js (aAccesWhatsapp, libelleFenetre,
// motifVerrouillee, critiqueReponse, MOTIF_WA_FORMATION), src/whatsapp.js
// (envoyerModele, repondreWhatsApp), lib/whatsappModeles.js (les modèles),
// App.jsx (les onglets et leurs compteurs).
// Les envois depuis un devis, une dette ou une vente sont décrits dans
// leurs chapitres (5, 7, 13) ; le réglage de l'assistant au chapitre 23.
// ============================================================
export const CHAPITRE = {
  numero: 20,
  titre: "Messagerie et WhatsApp",
  sousTitre: "Écrire à l'équipe dans 💬 Messages, et répondre aux clients du numéro WhatsApp BMI dans 📲 WhatsApp : la fenêtre de 24 h, les conversations confiées, l'assistant",
  public: "Tout le personnel ; l'administrateur pour les groupes, « 🔁 Confier » et « 🔓 Rendre à tous »",
  duree: "1 h, puis l'exercice en espace formation (💬 Messages) et en réel avec le formateur (📲 WhatsApp)",
  prerequis: "Le chapitre 1 (Connexion) : les onglets et le mur formation / réel. Le chapitre 3 (Clients) : un compte client.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "faire la différence entre **💬 Messages** (la messagerie INTERNE de l'application) et **📲 WhatsApp** (les vrais WhatsApp des clients, sur le numéro BMI **+228 99 96 84 88**) ;",
        "écrire à un collègue, à un groupe, et répondre au **support** d'un client dans 💬 Messages ;",
        "lire et répondre à une conversation dans 📲 WhatsApp, **dans la fenêtre de 24 h** ;",
        "**écrire le premier** à quelqu'un du numéro BMI (« ✍️ Écrire ») ;",
        "comprendre une conversation **confiée** (ligne grisée) et un client qui **attend un conseiller** ;",
        "lire les coches **✓ / ✓✓ / ✓✓ bleu / ❌** d'un message parti du numéro BMI.",
      ]],
      ["regle", "**Tout ce qui part du numéro BMI parle au nom de BMI TOGO.** On relit avant d'envoyer, on reste poli, et on ne donne jamais par WhatsApp ce qui appartient à l'espace client du client (ses codes, sa dette en détail) sans y être invité."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4300, 5000], lignes: [
        ["💬 Messages : écrire à un collègue", "Tout le personnel (les comptes de l'espace où l'on est)."],
        ["💬 Messages : lire et répondre au support d'un client", "**L'administrateur** ; **le technicien de l'équipe de SON chantier** ; **le commercial** qui l'a apporté (et son chef d'équipe). Un vendeur, un gérant ou un magasinier ne voient aucun fil de client."],
        ["💬 Messages : créer un groupe, changer ses membres, le supprimer", "**L'administrateur.** Un client n'entre jamais dans un groupe."],
        ["💬 Messages : un client écrit à BMI", "Le client, par « 🛟 Écrire à BMI Togo », et à **son chef d'équipe**. Écrire à toute l'équipe : seulement si l'administrateur lui a donné le **chat libre** (👥 Utilisateurs → ⋯ Gérer)."],
        ["📲 WhatsApp : l'onglet", "Tout le personnel **sauf le comptable** (et jamais un client)."],
        ["📲 WhatsApp : lire une conversation", "Une conversation **non confiée** (le support) : tout le personnel qui a l'onglet. Une conversation **confiée** : la personne à qui elle est confiée, et **l'administrateur** (qui voit tout)."],
        ["📲 WhatsApp : 🔁 Confier, 🔓 Rendre à tous, ✏️ Nommer", "**L'administrateur.**"],
        ["📲 WhatsApp : 📇 Enregistrer dans les contacts BMI", "**Tout le personnel qui a l'onglet**, sur une conversation qu'il peut ouvrir (pas une conversation confiée à un collègue)."],
      ]}],
      ["attention", "**📲 WhatsApp n'existe qu'en RÉEL.** Une conversation WhatsApp est un vrai client sur le vrai numéro BMI : en formation, l'écran dit « aucune conversation » et rien ne part. On s'entraîne sur 💬 Messages ; WhatsApp se montre en réel, avec le formateur."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3100, 6200], lignes: [
        ["💬 Messages (N)", "À gauche « 💬 Conversations », à droite le fil ouvert. **N** = les messages non lus. Sur téléphone, la liste se cache quand un fil est ouvert (← pour revenir)."],
        ["📲 WhatsApp (N)", "Présenté comme WhatsApp sur un téléphone ou sur Windows. **Sur ordinateur** : à gauche « 📲 Discussions » (« ✍️ Écrire », la recherche, les filtres, la liste), à droite le fil. **Sur téléphone** : la liste prend tout l'écran ; un toucher sur une conversation l'ouvre en plein écran, la flèche **←** revient à la liste. **N** = les non lus des conversations qu'on a le droit d'ouvrir."],
        ["Les notifications du téléphone", "Un nouveau message de 💬 Messages prévient son destinataire. Un message WhatsApp entrant prévient **la personne à qui la conversation est confiée**, sinon **les administrateurs**."],
      ]}],
      ["table", { entetes: ["Bloc de 💬 Conversations", "Ce qu'il contient"], largeurs: [3100, 6200], lignes: [
        ["🔴 Nouveaux messages", "Toute conversation qui a un non lu, **la plus récente en tête**. Une fois lue, elle redescend dans son bloc."],
        ["👤 Équipe", "Chaque collègue, avec son rôle."],
        ["👥 Groupes", "Les groupes dont on est membre (l'administrateur les voit tous, « + Nouveau »)."],
        ["👤 Clients qui vous ont écrit", "Un client qui vous a écrit directement."],
        ["👷 Mes clients (chef d'équipe)", "Les clients des chantiers dont on est le chef ⭐."],
        ["🛟 Support clients", "Les fils de support qu'on a le droit de lire."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. 💬 Messages — écrire à un collègue ou à un groupe"],
      ["etapes", [
        { titre: "Cliquer la conversation", texte: "Dans la liste de gauche. Ses messages non lus sont marqués **lus** à l'ouverture, et le fil s'ouvre sur **le dernier message**." },
        { titre: "Écrire puis « Envoyer »", texte: "Dans « Votre message… » (Entrée envoie aussi). Le message part avec la synchronisation : il arrive chez l'autre dès que son appareil se met à jour." },
        { titre: "Un groupe (administrateur)", texte: "« + Nouveau » à côté de 👥 Groupes : « Nom du groupe » (ex. : Chantier Agoè), puis cocher les membres, « Créer le groupe ». Dans un groupe ouvert : « Membres » pour en ajouter ou en retirer, « Supprimer » efface le groupe **et tous ses messages**, sans retour." },
      ]],

      ["h3", "B. 💬 Messages — le support d'un client"],
      ["etapes", [
        { titre: "Le client écrit", texte: "Dans son espace, « 🛟 Écrire à BMI Togo ». L'écran lui dit que son message va « à l'administration, les techniciens de votre chantier et votre commercial »." },
        { titre: "On répond", texte: "Le fil est dans 🛟 Support clients (ou 🔴 Nouveaux messages). La réponse est lue par le client **et** par tous ceux qui voient ce fil." },
      ]],

      ["h3", "C. 📲 WhatsApp — comprendre la fenêtre de 24 h"],
      ["p", "C'est **la règle de Meta**, pas la nôtre : on peut répondre **librement** à un client pendant **24 h après SON dernier message**. Passé ce délai, seul un **message approuvé** (un modèle) peut partir."],
      ["table", { entetes: ["La bande en haut du fil", "Ce qu'elle veut dire"], largeurs: [4300, 5000], lignes: [
        ["Verte : « Il reste 6 h 20 pour répondre librement. »", "La case de réponse est ouverte."],
        ["Ambre : « Plus de 24 h depuis son dernier message : WhatsApp n'accepte plus qu'un modèle approuvé. »", "La case disparaît ; « ✍️ Lui écrire quand même » envoie un modèle."],
        ["Ambre : « Ce client ne vous a pas encore écrit… »", "Une conversation qu'on a ouverte nous-mêmes : rien ne part librement tant qu'il n'a pas répondu."],
      ]}],
      ["attention", "**Nos réponses ne rallongent pas la fenêtre d'une minute.** Elle court depuis le dernier message **du client**. Répondre dix fois ne gagne rien."],

      ["h3", "D. 📲 WhatsApp — répondre"],
      ["etapes", [
        { titre: "Ouvrir la conversation", texte: "Chaque ligne : les **initiales** du client dans un rond, son **nom** en gras et l'**heure** du dernier message à droite (« Hier », ou la date), **le numéro juste sous le nom**, puis le début du dernier message (avec ses coches ✓✓ s'il vient de BMI) et, s'il y a des non lus, une **pastille verte** avec leur nombre. Toutes les conversations sont rangées **par dernier message** — une non lue n'est jamais rangée aux archives. Trois filtres au-dessus : **Toutes**, **Non lues**, **👨‍💼 Attendent un conseiller**. Les conversations sans activité depuis plus de 3 mois (au-delà des 20 plus récentes) passent dans **« 📁 Archivées (N) »**, en haut de la liste ; « ◂ Retour aux conversations » revient. « Rechercher une conversation… » cherche le nom **ou le numéro**, archives comprises. **Le nom d'une conversation** : celui donné par l'administrateur (✏️ Nommer), sinon le compte BMI du client, sinon **le nom que le client s'est donné dans son WhatsApp**, marqué « (nom WhatsApp) » — c'est lui qui l'a choisi, ce n'est pas un client vérifié —, sinon le numéro. **Le numéro reste toujours écrit avec le nom** (sous lui dans la liste, à côté en haut du fil). ⚠ Les noms du **répertoire du téléphone BMI** n'arrivent jamais dans l'application : WhatsApp ne les donne pas. Le fil s'ouvre sur **le dernier message** ; pour relire le début, on remonte dans le fil. **En haut du fil** : le nom, le numéro, et à qui la conversation est confiée (ou « 🛟 Support »). **Un clic sur le nom ouvre « Infos du contact »** (comme dans WhatsApp) : son nom et d'où il vient, son numéro, son compte BMI s'il en a un, à qui la conversation est confiée, depuis quand il écrit, son dernier message, le nombre de messages, la fenêtre de 24 h — le bouton 📇 Enregistrer dans les contacts BMI (tout le personnel), et les gestes de l'administrateur (✏️ Nommer, 🔓 Rendre à tous, 🔁 Confier). La flèche **←** revient au fil. Les messages sont des **bulles** : celles du client à gauche (blanches), celles de BMI à droite (vertes, avec le nom du collègue qui a écrit, l'heure et les coches), celles de l'assistant marquées « 🤖 »." },
        { titre: "Écrire « Votre réponse, envoyée du numéro BMI… » puis « Envoyer »", texte: "Le message part **du numéro BMI**. Il ne s'écrit dans le fil **que s'il est vraiment parti** ; sinon l'écran dit pourquoi, en français." },
        { titre: "📎 Joindre un fichier (facultatif)", texte: "Le bouton **📎** à gauche de la case : photo, PDF, Word, Excel, PowerPoint, texte, vidéo MP4 ou son, **3 Mo au plus**. Une photo de téléphone est **réduite toute seule** avant de partir. Le fichier choisi s'affiche au-dessus (✕ pour le retirer) ; la case devient « Phrase facultative… » : on peut l'envoyer **sans un mot**. Un son part sans phrase (WhatsApp n'en porte pas). Le fil garde « 📎 nom du fichier — envoyé » : **le fichier n'est pas rangé dans l'application**, sa copie reste sur le téléphone BMI." },
        { titre: "Lire les coches", texte: "**✓** parti · **✓✓ gris** arrivé sur son téléphone · **✓✓ bleu** lu · **❌ Non reçu** avec le motif. Un client qui a coupé les confirmations de lecture reste à ✓✓ gris." },
      ]],
      ["attention", "**Un fichier est une réponse** : il ne part que **dans les 24 h** après le dernier message du client, comme un texte. Fenêtre fermée, on écrit d'abord par « ✍️ Lui écrire quand même » ; le fichier partira quand le client aura répondu. Un PDF de plus de 3 Mo est refusé : on l'enregistre en « taille réduite »."],
      ["note", "**Répondre ne s'approprie pas une conversation** : elle reste au support, visible de tous. Une photo, une note vocale ou un document du client s'ouvrent dans le fil ; WhatsApp les efface au bout de **30 jours**."],

      ["h3", "E. 📲 WhatsApp — écrire le premier (✍️ Écrire)"],
      ["etapes", [
        { titre: "« ✍️ Écrire » en haut de la liste", texte: "« À qui ? » (un client de la liste, son numéro suit, ou un nom tapé), « Numéro », « De quoi s'agit-il ? » (ex. : votre installation solaire)." },
        { titre: "Relire l'aperçu", texte: "Le cadre blanc montre **le message exact** : « Bonjour …, c'est VOTRE NOM de BMI Togo. Nous revenons vers vous concernant … »." },
        { titre: "« Envoyer du numéro BMI »", texte: "Une question de confirmation, puis le message part. **La conversation vous est confiée** : la réponse du client arrivera chez vous." },
      ]],
      ["note", "Si le numéro BMI ne peut pas envoyer, l'écran le dit d'abord, puis WhatsApp s'ouvre sur **votre** téléphone : la réponse du client n'arrivera alors **pas** dans l'application."],

      ["h3", "F. Confier, rendre (administrateur)"],
      ["etapes", [
        { titre: "🔁 Confier", texte: "Dans la conversation ouverte, clic sur le nom en haut (Infos du contact) : choisir la personne. Une ligne « 🔁 Conversation confiée à … par … » se pose dans le fil. Désormais **seuls cette personne et l'administrateur** peuvent l'ouvrir ; les autres voient **la ligne grisée**, avec le nom de la personne." },
        { titre: "Une ligne grisée", texte: "Un clic dit : « Cette conversation est confiée à KOSSI. Seule cette personne, ou un administrateur, peut l'ouvrir. » Aucun aperçu, aucun compteur." },
        { titre: "✏️ Nommer", texte: "Dans Infos du contact : taper le nom voulu (« PLOMBIER AGOÈ »), comme dans un répertoire. Il passe **avant** le compte BMI et le nom WhatsApp, **pour tout le personnel**, ligne grisée comprise. Rien ne s'ajoute au fil et la conversation ne remonte pas. **Laisser vide** retire le nom donné." },
        { titre: "📇 Enregistrer dans les contacts BMI", texte: "Dans Infos du contact, en bas : relire le nom proposé (on peut le changer), puis valider. L'application enregistre le contact **directement dans les contacts Google de BMI** (bmitogo.info@gmail.com) ; si le téléphone BMI suit ce compte, WhatsApp Business y affiche ensuite le nom. Si le numéro y est déjà, **rien n'est créé en double** et l'écran le dit. Le profil garde la trace : « 📇 Enregistré sous le nom … le … par … ». **Tout le personnel qui a 📲 WhatsApp**, sur une conversation qu'il peut ouvrir : une conversation confiée à un collègue reste à cette personne et à l'administrateur." },
        { titre: "🔓 Rendre à tous", texte: "Quand la personne est absente : la conversation repart au support, visible de tous (« 🔓 Conversation rendue à tout le personnel par … »). On peut la reconfier ensuite." },
        { titre: "🗑 Supprimer une conversation (administrateur principal seul)", texte: "Dans la liste, **garder le doigt (ou le clic) une demi-seconde** sur la conversation. Une question nomme le client et le nombre de messages. Confirmée, la conversation **disparaît de 📲 WhatsApp pour tout le monde** et part à la **corbeille pendant 30 jours** (⚙ Paramètres → 🗑 Corbeille → ♻ Restaurer). Le téléphone BMI et le client gardent leur copie : rien n'est effacé chez WhatsApp. Si le client réécrit, une **nouvelle** conversation commence, au support, et l'assistant se présente de nouveau. Chez les autres comptes, l'appui long ne fait rien." },
      ]],

      ["h3", "G. L'assistant du numéro BMI"],
      ["ul", [
        "Quand un client écrit et que personne ne s'occupe de lui, **l'assistant** lui répond. Ses lignes sont dans un cadre clair, avec « **🤖 Assistant BMI TOGO** » (« (IA) » quand c'est la conversation par intelligence artificielle).",
        "Il **se tait** dès qu'une conversation est confiée, ou qu'un employé a répondu il y a moins de 24 h.",
        "Quand le client demande une personne, la ligne porte « **👨‍💼 Attend un conseiller depuis 12 min** » et le fil une bande ambre. **Répondez-lui** : la bande disparaît dès qu'une personne écrit.",
        "Une demande de devis prise par l'assistant arrive dans 🧲 Prospects (chapitre 4).",
        "En conversation par IA, il peut donner **un total** (« 3 panneaux 400 W ») : c'est **l'application** qui le calcule au prix du stock, boutique par boutique, **articles seuls, hors pose et transport** — jamais l'IA. Il conseille selon **« Nos choix BMI »** quand la direction les a écrits (chapitre 23), sinon en général.",
        "**Pour toute question dans nos métiers**, il renseigne d'abord le client **de manière générale**, puis il **propose des articles de notre stock** (prix et « disponible / sur commande » tels que la fiche les donne) et une suite : un total, une demande de devis ou un conseiller. Il connaît **nos métiers et leurs familles** réglés dans ⚙ Paramètres (« Forage : Pompe, Tuyaux… ») et **la fiche de chaque article** (chapitre 8) — jamais le prix d'achat, le fournisseur ni les notes internes.",
        "**Pour une pompe de forage**, il demande le **niveau de l'eau pendant le pompage** (donné par le foreur), la hauteur du réservoir, la longueur de tuyau et le besoin en litres par jour ; l'application calcule la hauteur à faire monter (avec les frottements réglés dans ⚙ Paramètres) et il propose **les pompes du stock qui montent assez haut**. Il ne promet **jamais un débit à une profondeur** : le débit maximal d'une fiche est celui en surface. Une pompe dont la profondeur maximale n'est pas renseignée n'est pas proposée.",
        "**Combien de panneaux pour une pompe solaire** : l'application calcule la puissance de la pompe × 1,3, divisée par le panneau le plus puissant du stock, arrondi au panneau supérieur, avec le prix de ces panneaux dans chaque boutique. C'est une estimation : le câblage peut demander un ajustement.",
        "**Il reste dans la conversation** : il ne propose un conseiller que si le client le demande ou si le sujet l'exige (panne, argent, compte), et une demande de devis une fois, au bon moment. Une réponse refusée par le contrôle est réécrite une fois ; au milieu d'une conversation, le menu à chiffres ne coupe plus la parole.",
        "**Après un relais vers un conseiller, le client peut revenir** : il écrit « **assistant** », et l'assistant reprend la conversation là où elle en était. Le message de relais le lui dit.",
        "Il cherche aussi par la **tension** : « batterie 48 V » trouve une lithium 51,2 V (c'est la même famille), et ce que la fiche dit en Tension.",
      ]],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton", "Où", "Ce qu'il fait"], largeurs: [2600, 2400, 4300], lignes: [
        ["Envoyer", "💬 Messages, 📲 WhatsApp", "Envoie le message (📲 : du numéro BMI, dans la fenêtre de 24 h)."],
        ["+ Nouveau / Créer le groupe", "💬 Groupes (admin)", "Crée un groupe et choisit ses membres."],
        ["Membres / Supprimer", "Groupe ouvert (admin)", "Change les membres / efface le groupe et ses messages."],
        ["🛟 Écrire à BMI Togo", "💬 Messages du client", "Son fil de support."],
        ["Autoriser / Retirer chat libre", "👥 Utilisateurs → ⋯ Gérer (admin)", "Laisse un client écrire à toute l'équipe."],
        ["✍️ Écrire / Envoyer du numéro BMI", "📲 WhatsApp", "Premier message du numéro BMI, par un modèle approuvé."],
        ["✍️ Lui écrire quand même", "📲, fenêtre fermée", "Ouvre « ✍️ Écrire » prérempli avec son nom et son numéro."],
        ["🔁 Confier / 🔓 Rendre à tous", "📲, Infos du contact (admin)", "Donne la conversation à quelqu'un / la rend au support."],
        ["Appui long sur une conversation", "📲 WhatsApp, la liste (administrateur principal)", "La met à la corbeille 30 jours, pour tout le monde."],
        ["✏️ Nommer", "📲, Infos du contact (admin)", "Donne un nom à la conversation, pour tout le personnel ; vide = le retire."],
        ["Clic sur le nom en haut du fil", "📲 WhatsApp", "Ouvre Infos du contact ; ← revient au fil."],
        ["📇 Enregistrer dans les contacts BMI", "📲, Infos du contact (tout le personnel)", "Enregistre le client dans les contacts Google de bmitogo.info@gmail.com, sans doublon."],
        ["Rechercher une conversation…", "📲 WhatsApp", "Nom (donné, compte, WhatsApp) ou numéro, archives comprises."],
        ["Toutes / Non lues / 👨‍💼 Attendent un conseiller", "📲 WhatsApp, au-dessus de la liste", "Ne montre que les conversations de ce filtre."],
        ["📁 Archivées (N) / ◂ Retour", "📲 WhatsApp, en haut de la liste", "Ouvre les conversations de plus de 3 mois, rangées par mois / revient à la liste."],
        ["← (téléphone)", "📲 WhatsApp, en haut du fil", "Revient à la liste des conversations."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Les messages envoyés par l'application du numéro BMI entrent dans 📲 WhatsApp** : reçu de vente, relance de devis ou de dette, accès d'un client, mot de fidélité… La conversation remonte en tête. Un reçu de vente ou un bon n'y montre son détail qu'au vendeur et à l'administrateur principal.",
        "**Les codes d'un client n'y sont jamais écrits** : le message d'accès montre « •••••• » à tout autre que son créateur et l'administrateur.",
        "**Un message ne se modifie jamais** : confier ou rendre pose une ligne de plus.",
        "**Rien ne s'écrit dans le fil tant que WhatsApp n'a pas accepté le message.**",
        "**Les coches avancent toutes seules** quand Meta prévient (envoyé, arrivé, lu, échec) ; elles ne reculent jamais.",
        "**Le mur** : 💬 Messages ne montre que les comptes de l'espace regardé ; 📲 WhatsApp ne montre rien en formation.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["table", { entetes: ["Module", "Le lien"], largeurs: [3100, 6200], lignes: [
        ["👥 Utilisateurs (ch. 2)", "Le rôle décide qui voit quoi ; le chat libre d'un client ; le numéro d'un compte."],
        ["🧲 Prospects (ch. 4)", "L'accueil et la relance d'un prospect partent du numéro BMI ; la réponse revient au commercial."],
        ["💰 Ventes, 🧾 Dettes, 📋 Devis (ch. 5, 7, 13)", "Les reçus, relances et devis envoyés du numéro BMI entrent dans 📲 WhatsApp, avec leurs coches."],
        ["🏠 Chantiers (ch. 15)", "Le lien du PV et l'avenant partent du numéro BMI ; le chef ⭐ d'un chantier voit le fil de ses clients."],
        ["Espace client (ch. 21)", "« 🛟 Écrire à BMI Togo » ; 🔒 Mes données écrit au numéro BMI."],
        ["⚙ Paramètres (ch. 23)", "Le réglage de l'assistant, l'alerte WhatsApp à l'administrateur."],
      ]}],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Le bloc **🔴 Nouveaux messages** de 💬 Messages et le filtre **Non lues** de 📲 WhatsApp sont vides en fin de journée.",
        "Le filtre **👨‍💼 Attendent un conseiller** est vide : aucun client n'attend sans réponse.",
        "Les fenêtres **vertes** sont utilisées avant de se fermer.",
        "Une conversation **confiée** à quelqu'un d'absent est rendue ou reconfiée.",
        "Les **❌ Non reçu** sont lus, et le client joint autrement si besoin.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "La bonne façon"], largeurs: [4300, 5000], lignes: [
        ["Chercher un client WhatsApp dans 💬 Messages.", "💬 = l'équipe et le support de l'espace client ; 📲 = les WhatsApp du numéro BMI."],
        ["Taper une réponse quand la bande est ambre.", "Elle ne partira pas : « ✍️ Lui écrire quand même » (un modèle)."],
        ["Croire qu'en répondant on prolonge la fenêtre.", "Seul un message du client la rouvre."],
        ["Répondre depuis son téléphone personnel.", "Le message partirait d'un autre numéro : on répond dans 📲 WhatsApp."],
        ["Chercher WhatsApp en formation.", "Il n'existe qu'en réel."],
        ["Laisser une conversation confiée à un collègue en congé.", "L'administrateur la rend (🔓) ou la reconfie (🔁)."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Un client écrit au numéro BMI à 9 h : « Mon onduleur sonne. »", reponse: "📲 WhatsApp : la conversation est en tête, avec sa pastille verte (ou filtre « Non lues ») ; on ouvre, la bande verte dit « Il reste 23 h 58 ». On répond. La conversation reste au support." },
        { situation: "Le même client réécrit le lendemain à 11 h, mais personne ne lui a répondu depuis la veille 10 h.", reponse: "Son message rouvre la fenêtre : 24 h à partir de 11 h." },
        { situation: "Un prospect vu au salon n'a jamais écrit à BMI.", reponse: "« ✍️ Écrire », son nom, son numéro, « votre installation solaire » : le modèle part, la conversation vous est confiée, la bande dit qu'il n'a pas encore écrit." },
        { situation: "Une conversation est grisée « confiée à KOSSI », KOSSI est en congé.", reponse: "On demande à l'administrateur : 🔓 Rendre à tous, ou 🔁 Confier à un autre." },
        { situation: "La ligne d'un client porte « 👨‍💼 Attend un conseiller depuis 25 min ».", reponse: "On ouvre et on répond : la bande disparaît, l'assistant reste muet 24 h." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "En **espace formation** pour 💬 Messages, puis en **réel avec le formateur** pour 📲 WhatsApp :"],
      ["ol", [
        "Écrire à un collègue dans 💬 Messages ; lui faire répondre ; constater 🔴 Nouveaux messages.",
        "(Administrateur) Créer un groupe de trois, écrire, retirer un membre.",
        "(Compte client d'entraînement) « 🛟 Écrire à BMI Togo » ; répondre depuis le support.",
        "Avec le formateur, en réel : ouvrir une conversation WhatsApp, lire la bande de la fenêtre, répondre, lire les coches.",
        "Expliquer à voix haute ce qui se passe quand la bande est ambre.",
      ]],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "distingue 💬 Messages et 📲 WhatsApp ;",
        "répond dans la fenêtre de 24 h et sait quoi faire quand elle est fermée ;",
        "écrit le premier du numéro BMI ;",
        "explique une ligne grisée et qui peut l'ouvrir ;",
        "réagit à « 👨‍💼 Attend un conseiller » ;",
        "lit les coches d'un message.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Quelle différence entre 💬 Messages et 📲 WhatsApp ?",
        "Qui voit le fil de support d'un client dans 💬 Messages ?",
        "Depuis quand se comptent les 24 h de la fenêtre ? Nos réponses la prolongent-elles ?",
        "Que faire quand la bande est ambre ?",
        "Que veut dire une ligne grisée « confiée à … » ? Qui peut l'ouvrir ?",
        "Pourquoi 📲 WhatsApp est-il vide en formation ?",
        "Que signifient ✓, ✓✓ gris, ✓✓ bleu et ❌ ?",
        "Quand l'assistant se tait-il ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Distingue 💬 Messages et 📲 WhatsApp",
      "Écrit à un collègue, à un groupe, au support",
      "Répond dans la fenêtre de 24 h",
      "Écrit le premier du numéro BMI",
      "Explique une conversation confiée",
      "Réagit à un client qui attend un conseiller",
      "Lit les coches d'un message",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
