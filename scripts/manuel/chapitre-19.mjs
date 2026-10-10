// ============================================================
// MANUEL DE FORMATION — CHAPITRE 19 : Outillage
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// screens/Outillage.jsx (🧰 Le matériel de travail de BMI : les cinq carrés
// Outils / Dehors / En retard / En réparation / Perdus / Hors d'usage, le
// filtre des lieux, ➕ Ajouter un outil, 📤 Sortir un ou plusieurs outils,
// la case « Outils assignés », 📋 l'appel de la semaine, les boutons ronds
// 📥 🏗 🔧 ⚠ ✏️ 🧰 🔢 🗑 ✖ 💵, le comptage d'une boîte, 🗑 Fiches retirées ;
// MesOutils : 🧰 Mes outils, 🏗 Changer le chantier, 🧰 Compter la boîte,
// Envoyer l'explication), lib/outillage.js (peutTenirOutillage,
// ROLES_OUTILLAGE, ROLES_CHEF_OUTILLAGE, ETATS_OUTIL, enRetard,
// critiqueSortieLot, critiqueRetour, critiquePerte, modeRetenue,
// prochainNumeroOutil, appelAFaire, lieuDeRangement, critiqueOutilRange),
// lib/validationDepenses.js (la dépense « Réparation d'outillage »),
// lib/calculs.js (chantiersOuvertsPourOutil, retenueOutilPourPrime), App.jsx
// (l'onglet « 🧰 Outillage » / « 🧰 Mes outils (N) »).
// La paie (avances du mois) est au chapitre 18 ; les parts d'installation au
// chapitre 16 ; les dépenses au chapitre 17.
// ============================================================
export const CHAPITRE = {
  numero: 19,
  titre: "Outillage",
  sousTitre: "Tenir le registre du matériel de travail : ajouter un outil, le sortir sous le nom de quelqu'un, le rentrer, le réparer, compter une boîte, faire l'appel, déclarer une perte",
  public: "Administrateur, magasinier, chef des techniciens (⭐) ; tout technicien pour « 🧰 Mes outils »",
  duree: "1 h, puis l'exercice en espace formation",
  prerequis: "Le chapitre 2 (Utilisateurs) : les rôles et l'étoile ⭐ chef d'équipe. Le chapitre 17 (Dépenses) : une réparation est une dépense.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "dire **pourquoi l'outillage n'est pas du stock** : un outil ne se vend pas, il part et il revient ;",
        "appliquer **la règle qui empêche la perte** : un outil est **toujours sous le nom de quelqu'un** ;",
        "**sortir** un ou plusieurs outils, **changer leur chantier** sans les ramener, et **enregistrer leur retour** ;",
        "envoyer un outil **en réparation** et payer la réparation ;",
        "**compter une caisse à outils** au retour ;",
        "faire **l'appel de la semaine** de son lieu ;",
        "(administrateur) **déclarer un outil perdu**, décider de ce qu'on demande à la personne, et le **retenir** sur son salaire.",
      ]],
      ["regle", "**Un outil est TOUJOURS sous le nom de QUELQU'UN.** Pas « sur le chantier de MR ERIC » : un chantier ne perd pas une perceuse, une personne la perd. Le chantier est noté à côté. Et **un mouvement ne s'efface jamais** : l'histoire d'un outil se lit d'un clic."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4300, 5000], lignes: [
        ["Tenir le registre : sortie, retour, réparation, changement de chantier, comptage, appel, déclarer perdu", "**L'administrateur, le magasinier, et le chef des techniciens** — un technicien (à commission ou salarié) qui porte l'étoile **⭐**."],
        ["« 🧰 Mes outils » : voir ce qu'on détient, changer son chantier, compter sa boîte, justifier un retard", "**Tout technicien** qui ne tient pas le registre (sans l'étoile)."],
        ["➕ Ajouter un outil, ✏️ corriger sa fiche, régler le contenu d'une caisse, 🗑 réformer", "**L'administrateur** (c'est du matériel acheté)."],
        ["Fixer ce qu'une perte doit rembourser, 💵 retenir sur un salaire", "**L'administrateur.**"],
        ["✖ Retirer une fiche du registre, ♻️ la remettre", "**L'administrateur principal.**"],
      ]}],
      ["attention", "**Un technicien sans étoile n'enregistre pas ses propres sorties et retours** : sinon la trace ne vaudrait rien. Le **vendeur**, le **gérant**, le **commercial** et le **comptable** n'ont pas l'onglet."],
      ["note", "**Le mur formation / réel s'applique** : le registre réunit les boutiques et magasins **de l'espace regardé**. Un numéro gravé peut exister une fois en réel et une fois en formation : ce sont deux mondes."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3100, 6200], lignes: [
        ["🧰 Outillage (celui qui tient le registre)", "« 🧰 Le matériel de travail de BMI » : **cinq carrés** qui s'ouvrent chacun sur sa liste, la bande ambre de l'appel, la liste choisie avec son filtre de lieu, puis « 📤 Sortir un ou plusieurs outils » et « 💸 Pertes »."],
        ["🧰 Mes outils (N) (un technicien sans étoile)", "Ce qu'il détient : pris le…, pour quel chantier, remis par qui, retour prévu ; 🏗 Changer le chantier, 🧰 Compter la boîte, et la case pour expliquer un retard. **N** = ses retards à justifier."],
        ["📤 Dépenses (ch. 17)", "Chaque réparation payée, catégorie « Réparation d'outillage »."],
        ["💵 Salaire (ch. 18)", "Une retenue pour un outil perdu apparaît dans les avances du mois."],
      ]}],
      ["table", { entetes: ["Le carré", "Ce qu'il montre"], largeurs: [2600, 6700], lignes: [
        ["Outils", "📒 Le registre entier, avec « Rechercher un outil… » et « ➕ Ajouter un outil »."],
        ["Dehors", "🧰 Ce qui est dehors : chez qui, pour quel chantier, depuis quand, retour prévu. **Ouvert d'office** : c'est ce qu'on regarde chaque jour."],
        ["En retard", "⏰ La date de retour est passée : chez qui, la date promise, le retard en jours, **pourquoi** (ou « ⏳ Pas encore justifié »)."],
        ["En réparation", "🔧 Chez quel réparateur, **son numéro** (logo WhatsApp), la panne, le prix, depuis quand."],
        ["Perdus / Hors d'usage", "⚠ Les perdus d'abord (qui, pourquoi, valeur, à rembourser, déjà retenu, reste à payer), puis 🗑 les hors d'usage."],
      ]}],
      ["note", "Le carré regardé porte un **cadre épais**. La liste déroulante « **Tous les lieux (N)** » filtre les cinq vues par boutique ou magasin. **Un clic sur une ligne** ouvre l'histoire de l'outil."],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Ajouter un outil (administrateur)"],
      ["etapes", [
        { titre: "Carré « Outils » → ➕ Ajouter un outil", texte: "« Nom de l'outil », « Où est-il rangé ? » (une boutique ou un magasin, **obligatoire**), « Catégorie », « Acheté le », « Prix d'achat (F) »." },
        { titre: "Le numéro gravé s'attribue tout seul", texte: "Le champ « Numéro gravé » affiche **BMI-001, BMI-002…** : on ne le tape pas, on le **grave** sur l'outil. Deux outils ne peuvent pas porter le même, même une fiche retirée garde le sien." },
        { titre: "Caisse ou boîte à outils ?", texte: "Cocher « **C'est une caisse ou une boîte à outils** » SEULEMENT pour une caisse : sa fiche portera la liste de ce qu'elle contient, et on la comptera à chaque retour. Une perceuse, non." },
      ]],
      ["note", "Le prix d'achat sert de **valeur proposée** le jour où l'outil est perdu."],

      ["h3", "B. Sortir un ou plusieurs outils"],
      ["etapes", [
        { titre: "« Outil »", texte: "Taper le nom ou le numéro gravé, puis **cliquer** une proposition : l'outil s'ajoute à la case « **Outils assignés** », avec une ✕ pour le retirer. Un nom tapé **exactement** propose « ＋ Ajouter « … » »." },
        { titre: "Le refus se dit tout de suite", texte: "Un outil déjà sorti (« il est chez KOSSI »), en réparation, perdu ou réformé n'entre pas dans la case. Une caisse incomplète y entre, mais sa pastille le dit en rouge : « ⚠ Elle repart INCOMPLÈTE… »." },
        { titre: "« Qui le prend », « Chantier », « Retour prévu le »", texte: "La personne est **obligatoire** (choisie dans la liste, jamais tapée), la date de retour aussi. Le chantier est facultatif : la liste propose les chantiers **en cours** et les 🛠 travaux à crédit non soldés ; un nom tapé librement passe toujours." },
        { titre: "📤 Enregistrer la sortie", texte: "**Un mouvement par outil**, sur sa fiche : la perceuse pourra rentrer pendant que l'échelle reste dehors. La personne reçoit **un seul message** qui liste ses outils et la date de retour." },
      ]],

      ["h3", "C. Changer de chantier sans ramener l'outil"],
      ["etapes", [
        { titre: "Le bouton 🏗", texte: "Sur la ligne d'un outil sorti (registre), ou « 🏗 Changer le chantier » dans 🧰 Mes outils (celui qui le détient). « … part maintenant sur quel chantier ? » : un chantier en cours, ou « ✏️ Saisir un chantier (nom libre) »." },
        { titre: "Ce qui ne bouge pas", texte: "L'outil reste **chez la même personne**, avec la **même date de retour**. Un chantier **terminé** n'est plus proposé (« on n'y affecte plus d'outil ») ; le nom libre reste la porte de sortie." },
      ]],

      ["h3", "D. Le retour"],
      ["etapes", [
        { titre: "Le bouton 📥", texte: "Sur la ligne d'un outil sorti. **Celui qui reçoit range** : un gérant ou un magasinier le range chez lui ; sans lieu attitré (administrateur, chef technicien), l'application **demande** « Où rangez-vous … ? »." },
        { titre: "Bon état ou abîmé", texte: "« … vous est rendu — reçu par VOUS, rangé à … Revient-il en bon état ? » OK = bon état · Annuler = abîmé, et on dit ce qui est abîmé. L'histoire dira « rendu à VOUS »." },
        { titre: "Une caisse à outils ne rentre pas sans être comptée", texte: "Si la boîte n'a pas été comptée depuis sa sortie, 📥 **ouvre le comptage** : une ligne par matériel, « attendu : N », une case « combien ? ». Ce qui manque s'affiche à mesure. « 🧰 Compter et enregistrer le retour » fait les deux d'un coup." },
      ]],
      ["note", "Le technicien qui rend peut **compter sa boîte lui-même** dans 🧰 Mes outils (« 🧰 Compter la boîte ») : il valide ce qu'il ramène. Mais le **retour** reste le geste de celui qui tient le registre."],

      ["h3", "E. La réparation"],
      ["etapes", [
        { titre: "Le bouton 🔧 (outil rangé)", texte: "« Chez quel réparateur » et « La panne » sont **obligatoires** ; « Son numéro » et « Prix de réparation (F) » si on les connaît." },
        { titre: "Le prix connu au dépôt", texte: "On choisit le « Moyen de paiement » et « Payé avec » : une **dépense « Réparation d'outillage »** s'écrit, avec toutes les règles d'une dépense — validation du DG à partir de 5 000 F, limite du tiroir en espèces. ⚠ Seuls le gérant et l'administrateur choisissent une caisse : le magasinier et le chef technicien ne peuvent saisir qu'**une avance personnelle** (payée de leur poche, remboursée ensuite)." },
        { titre: "Le prix inconnu au dépôt", texte: "On laisse vide : **au retour**, 📥 ouvre « Combien a coûté la réparation ? ». 0 F = garantie ou geste du réparateur : l'outil rentre, aucune dépense." },
      ]],
      ["attention", "**Une réparation ne s'écrit qu'UNE fois** en dépense : au dépôt OU au retour. Un montant à corriger se corrige dans 📤 Dépenses."],

      ["h3", "F. Le retard, et sa justification"],
      ["etapes", [
        { titre: "Quand un outil est-il en retard ?", texte: "Le **lendemain** de sa date de retour prévue, s'il n'est pas rentré. Il passe dans le carré « En retard »." },
        { titre: "Celui qui le détient explique", texte: "Dans 🧰 Mes outils, une bande rouge : « Dites pourquoi. » Il écrit dans « Pourquoi l'outil n'est pas encore rentré » puis « **Envoyer l'explication** ». Une explication vide est refusée. Le carré « En retard » la montre, ou dit « ⏳ Pas encore justifié »." },
      ]],

      ["h3", "G. L'appel de la semaine"],
      ["etapes", [
        { titre: "La bande ambre", texte: "« 📋 L'appel de l'outillage n'a pas encore été fait cette semaine » : un bouton **par lieu** (« Faire l'appel de BMI DEMAKPOE (12) »). Chaque boutique et chaque magasin fait **le sien**." },
        { titre: "Cocher ce qu'on a sous la main", texte: "Les outils rangés là sont cochés d'office ; un outil sorti ne l'est pas (il est chez quelqu'un). On décoche ce qu'on ne voit pas. « Enregistrer l'appel » : « ✅ Sous la main : N · ❓ Pas vus : N »." },
        { titre: "Une photo", texte: "**Un appel ne se corrige pas.** Ce qui n'a pas été vu est écrit en rouge sous la bande (« Pas vus : … »). La semaine se compte du lundi au dimanche." },
      ]],

      ["h3", "H. Un outil perdu"],
      ["etapes", [
        { titre: "Le bouton ⚠", texte: "« Déclarer … PERDU. Il était sous la responsabilité de KOSSI. Que s'est-il passé ? » — **le motif est obligatoire**. Puis la **valeur** (le prix d'achat est proposé) : elle entre dans les **pertes de l'année**." },
        { titre: "Faire rembourser ? (administrateur)", texte: "« Faire rembourser cette perte à KOSSI ? » OK = oui · Annuler = **la perte reste à la charge de BMI**. Si oui : « Combien demander ? » — on peut demander **moins** que la valeur." },
        { titre: "Deux façons de rembourser", texte: "**Un salarié** (technicien BMI, magasinier, gérant…) : une retenue sur le **salaire**, maintenant ou plus tard, mois par mois (bouton 💵 du carré Perdus). **Un technicien à commission, un commercial** : la retenue se prend **toute seule sur sa prochaine part d'installation** ; l'écran qui paie la part l'annonce." },
      ]],
      ["attention", "**Une perte déclarée ne se défait pas, une retenue enregistrée non plus.** On ne retient jamais plus que ce qui reste dû. La personne reçoit un message."],
      ["note", "**Le matériel qui manque dans une caisse** (au comptage) se déclare perdu de la même façon : 🧰 sur la ligne de la caisse → « ⚠ Déclarer ce manque perdu ». On saura « il manque 2 tournevis depuis le chantier de MR ERIC », jamais « c'est le tournevis n° 7 »."],

      ["h3", "I. Corriger, réformer, retirer (administrateur)"],
      ["ol", [
        "**✏️ Corriger la fiche** (outil rangé) : nom, numéro gravé (unique dans toute la maison), catégorie, date et prix d'achat. Le **lieu** ne se corrige pas ici : pour le ranger ailleurs, une sortie puis son retour.",
        "**🧰 Le contenu d'une caisse** (rangée) : ➕ Ajouter à la liste (matériel, combien, valeur d'une pièce), ✏️ corriger une ligne, 🗑 la retirer. « ↩ Ce n'est plus une caisse » n'apparaît que si la liste est vide.",
        "**🗑 Réformer** (usé, cassé) : motif obligatoire ; l'outil part dans « Hors d'usage », il ne sort plus.",
        "**✖ Retirer du registre** (principal, outil rangé) : pour une fiche créée **par erreur**. Motif obligatoire ; rien n'est jeté : « ♻️ Remettre au registre » sous « 🗑 Fiches retirées du registre ».",
      ]],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton", "Quand il apparaît", "Ce qu'il fait"], largeurs: [2300, 2900, 4100], lignes: [
        ["📥", "Outil sorti ou en réparation", "Enregistre le retour (ou le retour de réparation, avec son prix)."],
        ["🏗", "Outil sorti", "Change son chantier, sans le ramener."],
        ["🔧", "Outil rangé", "L'envoie en réparation."],
        ["⚠", "Outil ni perdu ni réformé", "Le déclare perdu."],
        ["🧰", "Une caisse", "Ouvre ce qu'elle doit contenir, le dernier comptage, « ⚠ Déclarer ce manque perdu »."],
        ["🔢", "Une caisse sortie", "La compte sans la rentrer."],
        ["✏️", "Registre, outil rangé (admin) / carré Perdus (admin)", "Corrige la fiche / fixe ce que la perte doit rembourser."],
        ["💵", "Carré Perdus, un salarié qui doit encore (admin)", "Pose une retenue sur un mois de salaire."],
        ["🗑", "Outil ni perdu ni réformé (admin)", "Le réforme (hors d'usage)."],
        ["✖", "Outil rangé (principal)", "Retire la fiche du registre."],
        ["📤 Enregistrer la sortie (N)", "Sous « Outils assignés »", "Sort tous les outils de la case, au nom de la personne."],
        ["Faire l'appel de … / Enregistrer l'appel", "Bande ambre", "L'appel de la semaine d'un lieu."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**L'état d'un outil se déduit** de son dernier mouvement : Rangé, Sorti, En réparation, Perdu, Réformé. Personne ne l'écrit à la main.",
        "**Le lieu d'un outil se déduit** : celui de son dernier retour, sinon celui de sa création. « Rangé », jamais « en boutique » : un magasin est un lieu aussi.",
        "**La personne qui prend un outil reçoit un message** ; celle qui en répondait est prévenue d'une perte et d'une retenue.",
        "**Une réparation payée devient une dépense** « Réparation d'outillage », qui passe par la validation du DG à partir de 5 000 F.",
        "**Une retenue sur salaire** devient une avance du mois (chapitre 18) ; **une retenue sur commission** diminue la prochaine part d'installation versée (chapitre 16).",
        "**L'onglet compte les retards** à justifier du technicien : « 🧰 Mes outils (1) ».",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["table", { entetes: ["Module", "Le lien"], largeurs: [3100, 6200], lignes: [
        ["👥 Utilisateurs (ch. 2)", "Le rôle et l'étoile ⭐ décident qui tient le registre."],
        ["🏠 Chantiers / 🛠 Travaux (ch. 15)", "Les chantiers en cours et les travaux à crédit non soldés sont proposés à la sortie et au changement de chantier."],
        ["Commissions et primes (ch. 16)", "La retenue d'un technicien à commission se prend sur sa prochaine part d'installation."],
        ["📤 Dépenses (ch. 17)", "Une réparation payée est une dépense ordinaire."],
        ["💵 Salaires (ch. 18)", "La retenue d'un salarié est une avance du mois."],
        ["📦 Stocks (ch. 8)", "**Aucun lien** : l'outillage n'entre ni dans la valeur du stock, ni dans les alertes."],
      ]}],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Chaque outil a **son numéro gravé** sur lui.",
        "Le carré **Dehors** chaque matin : chaque outil a un nom et une date de retour.",
        "Le carré **En retard** : chaque retard a son explication.",
        "**L'appel** de chaque lieu est fait chaque semaine ; les « pas vus » sont retrouvés.",
        "Chaque **caisse** est comptée à son retour.",
        "Les réparations en cours ont un **réparateur et un numéro**.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "La bonne façon"], largeurs: [4300, 5000], lignes: [
        ["Sortir un outil « au nom du chantier ».", "Il sort au nom d'une PERSONNE ; le chantier est noté à côté."],
        ["Ramener l'outil au magasin pour changer de chantier.", "🏗 : il reste chez la même personne."],
        ["Rentrer une caisse sans la compter.", "Impossible : 📥 ouvre le comptage, rien ne rentre sans lui."],
        ["Le technicien qui veut enregistrer lui-même son retour.", "C'est le geste de son chef, du magasinier ou de l'administrateur. Lui peut compter sa boîte et justifier un retard."],
        ["Saisir la réparation deux fois (au dépôt et au retour).", "Une seule dépense : l'application ne redemande le prix au retour que s'il n'a pas été saisi au dépôt."],
        ["Réformer un outil qu'on a perdu.", "Perdu = ⚠ (avec sa valeur dans les pertes) ; réformé = usé ou cassé."],
        ["Retirer du registre un vieil outil cassé.", "✖ est pour une fiche créée par erreur ; un vieil outil se réforme (🗑)."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Le chef ⭐ KOSSI part sur le chantier de MR ERIC avec une perceuse, une échelle et la caisse n° 3, pour 5 jours.", reponse: "📤 : les trois outils dans « Outils assignés », « Qui le prend » KOSSI, chantier de MR ERIC, retour dans 5 jours. Trois mouvements, un seul message à KOSSI." },
        { situation: "Le chantier de MR ERIC est fini ; KOSSI enchaîne chez Mme AMA avec la même échelle.", reponse: "🏗 sur l'échelle (ou dans son 🧰 Mes outils) : chantier de Mme AMA. Elle reste chez KOSSI, même date de retour." },
        { situation: "La caisse n° 3 revient : il manque 2 tournevis plats sur 6.", reponse: "📥 ouvre le comptage, on tape 4 : « il en manque 2 ». Le retour s'enregistre ; la caisse repartira incomplète tant qu'on ne les remplace pas. L'administrateur peut déclarer ce manque perdu." },
        { situation: "La perceuse BMI-004 (prix d'achat 45 000 F) est perdue chez KOSSI, technicien BMI salarié. L'administrateur demande 30 000 F, 10 000 F par mois.", reponse: "⚠, motif, valeur 45 000, OK pour rembourser, 30 000 demandés, 10 000 maintenant sur le mois en cours. Puis 💵 chaque mois jusqu'à « reste à payer : 0 F »." },
        { situation: "La meuleuse part chez ATELIER KODJO, prix inconnu.", reponse: "🔧, réparateur et panne, prix vide. Au retour, 📥 demande le prix : 8 000 F en espèces, caisse de la boutique → une dépense qui attend la validation du DG (dès 5 000 F)." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "En **espace formation**, avec le formateur :"],
      ["ol", [
        "(Administrateur) Ajouter deux outils et une caisse ; régler trois lignes de contenu dans la caisse.",
        "Sortir les trois au nom d'un technicien, avec un chantier et une date de retour d'hier.",
        "(Le technicien) Ouvrir 🧰 Mes outils, justifier le retard, compter la caisse en déclarant un manque.",
        "Changer le chantier d'un outil sans le ramener.",
        "Enregistrer le retour des trois ; constater le comptage de la caisse.",
        "Envoyer un outil en réparation sans prix, puis le rentrer avec un prix.",
        "Faire l'appel de son lieu.",
      ]],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "explique pourquoi l'outillage n'est pas du stock ;",
        "sort plusieurs outils au nom d'une personne ;",
        "change un chantier sans ramener l'outil ;",
        "rentre une caisse en la comptant ;",
        "envoie un outil en réparation et en paie le prix ;",
        "fait l'appel de son lieu ;",
        "(administrateur) déclare une perte et choisit comment elle se rembourse.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Pourquoi un outil sort-il au nom d'une personne et pas d'un chantier ?",
        "Qui peut enregistrer une sortie ? Un technicien sans étoile le peut-il ?",
        "Que fait le bouton 🏗, et qu'est-ce qui ne change pas ?",
        "Pourquoi une caisse ne rentre-t-elle pas sans être comptée ?",
        "Quand un outil est-il « en retard », et qui doit l'expliquer ?",
        "Une réparation payée devient quoi ? Peut-elle être saisie deux fois ?",
        "Comment se rembourse la perte d'un salarié ? Et celle d'un technicien à commission ?",
        "Quelle différence entre réformer (🗑) et retirer du registre (✖) ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Explique la règle « toujours sous le nom de quelqu'un »",
      "Sort plusieurs outils en une fois",
      "Change un chantier sans ramener l'outil",
      "Rentre une caisse en la comptant",
      "Envoie en réparation et paie la réparation",
      "Fait l'appel de la semaine",
      "Déclare une perte et sa retenue (administrateur)",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
