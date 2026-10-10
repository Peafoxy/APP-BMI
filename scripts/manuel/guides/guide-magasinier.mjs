// ============================================================
// GUIDE PAR POSTE — LE MAGASINIER (01/10/2026, « Lance »).
//
// « Ma journée » reprend le livret du 22/09/2026, RELU dans le code le
// 01/10/2026 : les transferts de stock reçus se valident dans 📦 Stocks
// (le magasinier n'a pas l'onglet 🔁 Transfert — `DemandesTransfertRecues`
// est montée dans Stocks.jsx), la sortie d'outils se fait par lot
// (« 📤 Sortir un ou plusieurs outils », case « Outils assignés »,
// « 📤 Enregistrer la sortie »), l'appel se fait par lieu (« Faire l'appel
// de … », « Enregistrer l'appel »), et ajouter un outil reste à
// l'administrateur. Boutons relus : Stocks.jsx, Ravitaillement.jsx,
// Outillage.jsx, Travaux.jsx.
// ============================================================
export const GUIDE = {
  id: "magasinier",
  poste: "Magasinier",
  roles: ["magasinier"],
  public: "Les magasiniers du magasin BMI",
  duree: "2 jours : la journée et les chapitres le premier jour, l'examen le second",
  onglets: ["stocks", "salaire", "primes_recues", "messages", "whatsapp", "nouveau_client", "travaux", "outillage"],
  chapitres: [1, 3, 8, 9, 10, 15, 16, 18, 19, 20, 24, 25],

  journee: [
    ["p", "Le magasinier tient **le stock du magasin**, **sert les boutiques** et **tient le registre du matériel de travail**. Il ne vend pas et ne touche pas à la caisse. Les mots entre guillemets sont ceux des boutons ; le chapitre du manuel est indiqué entre parenthèses."],
    ["table", { entetes: ["Mes onglets", "À quoi ils me servent"], largeurs: [3300, 6000], lignes: [
      ["📦 Stocks", "Le stock du magasin, les entrées, l'inventaire, les demandes des boutiques, les bons de ravitaillement, les transferts reçus (chapitres 8, 9 et 10)."],
      ["🧰 Outillage", "Le registre du matériel de travail : sorties, retours, boîtes à outils, appel de la semaine (chapitre 19)."],
      ["🛠 Travaux à crédit", "Sortir un article du stock pour un chantier ouvert par le gérant (chapitre 15)."],
      ["🙋 Créer un client", "Créer le compte d'un client qui se présente (chapitre 3)."],
      ["💬 Messages · 📲 WhatsApp · 💵 Salaire", "L'équipe, les clients, ma paie (chapitres 18 et 20)."],
      ["💰 Primes reçues", "Toutes mes primes : sur chantier, sur salaire — en attente, déjà payées (chapitre 16)."],
    ] }],

    ["h3", "Le matin"],
    ["etapes", [
      { titre: "Je me connecte", texte: "Barre **bleue** = réel, **violette** = formation. Je regarde 💬 Messages : une demande de ravitaillement arrive aussi en notification « 🚚 Demande de ravitaillement » (chapitres 1 et 20)." },
      { titre: "📦 Stocks, sur mon magasin", texte: "Je choisis le **magasin** en haut. L'encadré « 📥 Demandes des boutiques » montre ce que les boutiques attendent ; l'encadré « Alertes de stock dans les boutiques » dit ce qui est passé sous le seuil chez chacune, du plus urgent au moins urgent (chapitre 9)." },
      { titre: "🧰 Outillage", texte: "Le carré « En retard » dit quels outils auraient dû rentrer. Si la bande ambre « 📋 L'appel de l'outillage n'a pas encore été fait cette semaine » s'affiche, je fais l'appel de mon magasin (chapitre 19)." },
    ]],

    ["h3", "Le stock du magasin — 📦 Stocks"],
    ["ul", [
      "**« + Entrée »** sur la ligne d'un article quand une livraison d'un fournisseur arrive. **« 📥 Importer un fichier Excel »** pour une grosse livraison (une feuille par boutique).",
      "**« 📋 Faire l'inventaire »** régulièrement : je compte, je tape, puis **« ✅ Valider l'inventaire »**. Chaque écart devient un ajustement, tracé, jamais effacé.",
      "Une fiche d'article se corrige par **« ✏️ Corriger »** ; la quantité initiale et les prix restent à l'administrateur (les cases sont grisées).",
      "Au magasin, « ⚠ À réapprovisionner » ne regarde que le **seuil** : un magasin ne vend pas, il ravitaille.",
    ]],

    ["h3", "Servir les boutiques — le ravitaillement"],
    ["etapes", [
      { titre: "Une demande arrive", texte: "Dans « 📥 Demandes des boutiques », **« 📋 Préparer le bon »** charge les articles demandés dans « 🚚 Ravitailler une boutique » ; ou **« Refuser »** avec un motif que la boutique lira." },
      { titre: "« à associer »", texte: "Si la boutique a nommé un article autrement que moi, ou s'il est à zéro chez moi, il apparaît « à associer » : je dis à quel article de mon magasin il correspond (« Associer »), ou « Ignorer »." },
      { titre: "Je complète le bon", texte: "« Boutique à ravitailler », « Article du magasin », « Quantité », « + Ajouter au bon »." },
      { titre: "« ✅ Valider le ravitaillement »", texte: "**Le stock quitte mon magasin et entre dans la boutique à cet instant.** Le bon de ravitaillement (RAV-…) s'imprime et part avec la marchandise ; la demande est marquée servie. **La boutique n'a rien à valider.**" },
    ]],
    ["note", "Je peux ravitailler **sans attendre une demande** : l'encadré « Alertes de stock dans les boutiques » me dit qui en a besoin."],
    ["attention", "Le bon fait foi : le stock a déjà bougé quand la marchandise part. Si un article manque au moment de charger le camion, je corrige le bon **avant** de valider, jamais après."],

    ["h3", "Les transferts de stock"],
    ["ul", [
      "**« ⇄ Transfert »** sur la ligne d'un article : j'envoie vers une boutique ; **l'article ne bouge pas** tant qu'elle n'a pas validé la réception.",
      "Un transfert que **je reçois** apparaît dans 📦 Stocks, encadré **« 📦 Transferts de stock à valider »** : **« ✅ Valider la réception »** quand le colis est là, sinon **« Refuser »** avec le motif. Tant que je n'ai pas validé, l'article est resté chez l'envoyeur (chapitre 9).",
    ]],

    ["h3", "Le matériel de travail — 🧰 Outillage"],
    ["regle", "**Un outil est TOUJOURS sous le nom de quelqu'un.** Pas « sur le chantier de MR ERIC » : un chantier ne perd pas une perceuse, une personne la perd. Le chantier est noté à côté."],
    ["etapes", [
      { titre: "« 📤 Sortir un ou plusieurs outils »", texte: "Je tape le nom ou le numéro gravé dans « Outil » et je clique la proposition : l'outil s'ajoute à la case « Outils assignés ». Puis « Qui le prend », le chantier (choisi ou tapé librement), « Retour prévu le », et **« 📤 Enregistrer la sortie »**. La personne reçoit un message." },
      { titre: "📥 Le retour", texte: "Le bouton rond 📥 sur la ligne de l'outil : je dis où il est rangé, puis s'il revient en bon état ou abîmé (ce qui est abîmé se décrit)." },
      { titre: "Une boîte à outils", texte: "Elle **se compte au retour** : le formulaire s'ouvre sur le comptage (« 🧰 Compter et enregistrer le retour »). Ce qui manque se voit, et peut être déclaré perdu." },
      { titre: "L'appel de la semaine", texte: "« Faire l'appel de » mon magasin : je coche ce que j'ai **physiquement** sous la main, puis « Enregistrer l'appel ». Un appel est une photo : il ne se corrige pas." },
    ]],
    ["note", "Ajouter un outil au registre, le réformer ou le supprimer reste à l'administrateur (c'est du matériel acheté). Le numéro gravé s'attribue tout seul (BMI-001, BMI-002…)."],

    ["h3", "Les travaux à crédit — 🛠 Travaux à crédit"],
    ["p", "Sur la fiche d'un chantier ouvert par le gérant, je tape le nom de l'article, **un clic sur la proposition le lie**, je mets la quantité, puis **« 📦 Sortir du stock »** : le stock baisse tout de suite. Retirer une ligne remet l'article en stock, tant que les travaux ne sont pas facturés (chapitre 15)."],

    ["h3", "Le soir"],
    ["p", "Je vérifie que chaque demande servie a son bon, que les outils sortis du jour ont leur nom et leur date de retour, et que les transferts reçus sont validés. Je n'ai pas de clôture de caisse : ce n'est pas mon geste."],
  ],

  examen: {
    intro: "L'examen se passe **dans l'espace de formation** (barre violette), avec le formateur à côté. La personne fait chaque épreuve seule ; le formateur regarde l'écran et coche. Une épreuve est réussie quand on voit à l'écran ce que dit la colonne « Ce qu'on doit voir ». Le formateur prépare avant : une demande de ravitaillement d'une boutique, un transfert envoyé vers le magasin, un outil et une boîte à outils au registre.",
    epreuves: [
      { titre: "Entrée de stock", consigne: "Sur le magasin, enregistrer une entrée de 20 unités sur un article.", attendu: "Le reste de l'article monte de 20 ; le mouvement apparaît dans son historique." },
      { titre: "Inventaire", consigne: "Faire l'inventaire en comptant 2 unités de moins sur un article, puis valider.", attendu: "L'écart de −2 est enregistré et le stock de l'article baisse de 2." },
      { titre: "Servir une demande", consigne: "Dans « 📥 Demandes des boutiques », préparer le bon de la demande préparée par le formateur, puis valider le ravitaillement.", attendu: "Le stock du magasin baisse, celui de la boutique monte ; le bon RAV-… s'imprime ; la demande est marquée servie." },
      { titre: "Refuser une demande", consigne: "Refuser une demande de ravitaillement avec un motif.", attendu: "La demande disparaît des demandes en attente ; la boutique lit le motif." },
      { titre: "Ravitailler sans demande", consigne: "Depuis « Alertes de stock dans les boutiques », ravitailler une boutique de 3 unités d'un article sous son seuil.", attendu: "Le stock passe du magasin à la boutique à la validation ; la boutique n'a rien à valider." },
      { titre: "Transfert reçu", consigne: "Valider la réception du transfert envoyé par le formateur.", attendu: "Le stock de l'envoyeur baisse et celui du magasin monte à cet instant ; l'encadré « 📦 Transferts de stock à valider » se vide." },
      { titre: "Sortie de deux outils", consigne: "Sortir deux outils en une seule fois pour un technicien, sur un chantier, avec une date de retour.", attendu: "Les deux sont « Sorti » chez le technicien, chacun avec sa propre ligne ; un seul message part au technicien." },
      { titre: "Retour d'un outil", consigne: "Enregistrer le retour d'un des deux outils, en bon état.", attendu: "L'outil est rangé au magasin ; l'autre reste dehors ; un clic sur la ligne montre qui l'a pris et à qui il a été rendu." },
      { titre: "Boîte à outils", consigne: "Sortir la boîte, puis enregistrer son retour en comptant une pièce de moins.", attendu: "Le retour s'ouvre sur le comptage ; le manque est signalé sur la ligne de la boîte." },
      { titre: "Appel de la semaine", consigne: "Faire l'appel du magasin.", attendu: "L'appel est enregistré pour la semaine ; un outil non coché est dit « pas vu »." },
      { titre: "Travaux à crédit", consigne: "Sur une fiche de travaux ouverte par le formateur, sortir 2 unités d'un article en tapant son nom.", attendu: "L'article est lié (✓), le stock baisse de 2 tout de suite." },
    ],
    questions: [
      "Un ravitaillement validé : à quel moment le stock bouge-t-il, et la boutique doit-elle valider quelque chose ?",
      "Un ⇄ Transfert envoyé : quand l'article quitte-t-il réellement le magasin ?",
      "Pourquoi un outil est-il toujours sous le nom d'une personne, jamais d'un chantier ?",
      "Que se passe-t-il au retour d'une boîte à outils ?",
      "Qui peut ajouter un nouvel outil au registre ?",
    ],
  },
};
