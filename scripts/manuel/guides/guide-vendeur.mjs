// ============================================================
// GUIDE PAR POSTE — LE VENDEUR (01/10/2026, Timo : « 1 oui, 2 oui,
// 3 entiers, 4 oui »).
//
// Un guide = trois parties : « Ma journée » (ce fichier), les CHAPITRES
// du manuel tels quels (listés dans `chapitres`, jamais recopiés), puis
// l'EXAMEN pratique (ce fichier). Les chapitres sont ceux des onglets du
// vendeur dans App.jsx — le banc compare les deux (`onglets`).
//
// « Ma journée » reprend le livret de formation du 22/09/2026, RELU dans
// le code le 01/10/2026 : le vendeur n'a plus 📤 Dépenses (15/09), il a
// 🏠 Clients installés (pose seule), et une vente sans numéro demande
// d'abord (25/09). Boutons relus : Ventes.jsx, Dettes.jsx, Caisse.jsx,
// Ravitaillement.jsx, Commandes.jsx, PrimesRemises.jsx, Partages.jsx.
// ============================================================
export const GUIDE = {
  id: "vendeur",
  poste: "Vendeur / vendeuse",
  roles: ["vendeur"],
  public: "Les vendeurs et vendeuses des boutiques BMI",
  duree: "2 jours : la journée et les chapitres le premier jour, l'examen le second",
  onglets: ["ventes", "commandes", "dimensionnement", "tous_devis", "ravitaillement", "parc", "travaux", "dettes", "clients", "caisse", "salaire", "messages", "whatsapp", "nouveau_client", "primes_remises", "contrats"],
  chapitres: [1, 3, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 18, 20, 24, 25],

  journee: [
    ["p", "Cette partie raconte une journée de vendeur, dans l'ordre où elle se passe. Les mots entre guillemets sont ceux des boutons de l'application. Pour le détail d'un geste, le chapitre du manuel est indiqué entre parenthèses."],
    ["table", { entetes: ["Mes onglets", "À quoi ils me servent"], largeurs: [3300, 6000], lignes: [
      ["💰 Ventes", "Vendre, faire une proforma, retrouver une vente et réimprimer son reçu (chapitre 5)."],
      ["📥 Commandes reçues", "Les commandes des commerciaux à encaisser, et les **🔧 Poses à encaisser** (chapitre 5)."],
      ["☀️ Dimensionnement · 📋 Tous les devis", "Faire un devis solaire, portail ou autre, et le suivre (chapitres 11, 12, 13)."],
      ["📄 Contrats", "Les contrats signés par les clients (chapitre 14)."],
      ["🚚 Ravitaillement", "Demander de la marchandise au magasin (chapitre 9)."],
      ["🏠 Clients installés · 🛠 Travaux à crédit", "Encaisser une pose ; facturer des travaux (chapitre 15)."],
      ["🧾 Dettes · 👤 Clients · 🙋 Créer un client", "Les clients qui doivent, les clients qui ont acheté, et la création d'un compte client (chapitres 3 et 7)."],
      ["🔒 Caisse", "La clôture du jour (chapitre 6)."],
      ["💰 Primes remises", "Payer la prime d'installation d'un technicien depuis la caisse (chapitre 16)."],
      ["💬 Messages · 📲 WhatsApp", "Parler à l'équipe ; répondre aux clients qui écrivent au numéro BMI (chapitre 20)."],
      ["💵 Salaire", "Ma fiche de paie, mes avances (chapitre 18)."],
    ] }],
    ["note", "Le vendeur **n'a pas 📤 Dépenses** et **ne verse pas les fonds** : c'est le gérant. Le vendeur encaisse, et il **clôture le jour**."],

    ["h3", "Le matin"],
    ["etapes", [
      { titre: "Je me connecte", texte: "Mon nom, mon mot de passe, « Se connecter ». La barre est **bleue** : je suis dans l'espace réel. **Violette**, c'est l'espace de formation (chapitre 1)." },
      { titre: "J'ouvre 💰 Ventes", texte: "Si un bandeau dit « 🔒 Vente impossible : la journée du … n'a pas été clôturée », je vais d'abord dans 🔒 Caisse clôturer ce jour-là. Sans ça, je ne peux pas encaisser aujourd'hui (chapitre 6)." },
      { titre: "Je vérifie la boutique", texte: "La boutique affichée en haut de l'écran doit être la mienne. L'application s'en souvient, écran par écran." },
      { titre: "Je regarde 💬 Messages et 📲 WhatsApp", texte: "Un client a peut-être écrit pendant la nuit. Le chiffre à côté de l'onglet dit combien de messages attendent." },
    ]],

    ["h3", "Une vente"],
    ["etapes", [
      { titre: "« Rechercher un article »", texte: "Je tape quelques lettres : la fenêtre montre le nom, le **prix de vente** et ce qui reste en stock. Je choisis, je mets la quantité, « Ajouter au panier »." },
      { titre: "Le client", texte: "Je tape son nom et son **numéro**. S'il n'a pas de numéro, l'application me le demande avant d'encaisser : « ✏️ Ajouter le client (nom et numéro) » ou « Continuer sans les informations du client ». Sans numéro, il ne recevra pas son reçu sur WhatsApp et une dette ne pourra pas être relancée." },
      { titre: "La remise, s'il y en a une", texte: "Sur un article **ou** sur le total, jamais les deux. Au-delà de 3 %, seul un administrateur peut l'accorder." },
      { titre: "Le moyen de paiement", texte: "Espèces, Flooz, Mixx/T-Money, virement, ou **Crédit (dette)** avec l'avance versée aujourd'hui." },
      { titre: "« 💳 Encaisser la vente »", texte: "Le reçu sort : je l'imprime. S'il y a un numéro, le reçu part **tout seul** au client depuis le numéro WhatsApp de BMI. Une vente à crédit donne le **reçu de sa dette**, pas un reçu de vente." },
    ]],
    ["note", "Un client qui veut d'abord un prix : « 🧾 Proforma WhatsApp ». Quand il revient, « 🛒 Vendre » sur la ligne de la proforma remplit le panier tel quel ; il reste à encaisser."],
    ["attention", "Un article en panne ou que le client ne veut plus : **je ne supprime rien**. Le 🔁 Retour sous garantie est fait par le gérant ; la ↩ Reprise par l'administrateur principal."],

    ["h3", "Un client qui vient payer"],
    ["etapes", [
      { titre: "Sa dette", texte: "Dans 🧾 Dettes, je retrouve le client par son nom ou son numéro. Le bouton **💵** (« + Paiement ») : le montant et le moyen. Le reçu de versement sort ; quand tout est payé, c'est le **reçu définitif** (chapitre 7)." },
      { titre: "Une pose (installation sans matériel)", texte: "Dans 📥 Commandes reçues, le bloc « 🔧 Poses à encaisser » : les **70 %** à payer avant l'installation. Le même encaissement existe dans 🏠 Clients installés (chapitre 15)." },
      { titre: "Une dette qui traîne", texte: "Le bouton WhatsApp de la ligne **relance** le client depuis le numéro BMI, après une question de confirmation." },
    ]],

    ["h3", "Un client qui veut un devis"],
    ["p", "Dans ☀️ Dimensionnement : le volet **Solaire** calcule l'installation à partir des appareils du client ; **Portail** et **Autre** (vidéosurveillance, électricité, forage) listent le matériel. Je choisis le client, puis « 📲 Envoyer ce devis au client », ou « 📝 Enregistrer un brouillon » pour le reprendre plus tard (chapitres 11, 12, 13)."],

    ["h3", "Il manque un article"],
    ["p", "Dans 🚚 Ravitaillement : le bouton « 🚚 Demander un ravitaillement » ouvre le formulaire ; l'« Article souhaité », la « Quantité », « + Ajouter », puis « 📤 Envoyer la demande ». « Mes demandes » dit où en est chacune : en attente (je peux encore l'annuler), servie, ou refusée avec le motif. **Le stock de ma boutique monte quand le magasinier valide le bon**, pas avant (chapitre 9)."],

    ["h3", "Un technicien vient chercher sa prime"],
    ["p", "Dans 💰 Primes remises, la demande de paiement adressée à ma caisse : « ✓ Valider et payer ». L'argent sort de la caisse et le technicien est prévenu (chapitre 16)."],

    ["h3", "Le soir — clôturer le jour"],
    ["etapes", [
      { titre: "En dernier", texte: "Je clôture quand la boutique ferme. Une vente faite **après** la clôture fait apparaître un bandeau orange dans 🔒 Caisse : il faut recompter et clôturer de nouveau cette journée." },
      { titre: "Je lis le bloc « Ventes du jour — tous moyens de paiement »", texte: "Ce qui a été **vendu** et ce qui a été **encaissé**, moyen par moyen. La ligne Espèces « encaissé » est ma recette en billets." },
      { titre: "Je compte les billets du tiroir", texte: "Je tape le total dans « Montant du tiroir ». L'application affiche l'écart. Le **fonds de caisse** (l'enveloppe) n'est **pas** dans ce compte, et Flooz / Mixx non plus : ils n'ont jamais été des billets." },
      { titre: "« Clôturer le jour »", texte: "S'il y a un écart, j'écris pourquoi dans la remarque. Si le bouton est grisé, une dépense en espèces attend la validation du DG : je préviens le gérant." },
    ]],
    ["regle", "**Clôturer en dernier, jamais avant la fermeture.** Et la journée d'hier doit être clôturée pour vendre aujourd'hui."],
  ],

  examen: {
    intro: "L'examen se passe **dans l'espace de formation** (barre violette), sur l'appareil de travail, avec le formateur à côté. La personne fait chaque épreuve seule ; le formateur regarde l'écran et coche. Une épreuve est réussie quand on voit à l'écran ce que dit la colonne « Ce qu'on doit voir ».",
    epreuves: [
      { titre: "Se connecter et se repérer", consigne: "Se connecter, dire dans quel espace on est et quelle boutique est affichée.", attendu: "Barre violette ; la bonne boutique en haut de 💰 Ventes." },
      { titre: "Vente au comptant", consigne: "Vendre deux articles différents en espèces à un client avec son nom et son numéro ; imprimer le reçu.", attendu: "Le reçu porte un numéro, les deux articles et le total ; le stock des deux articles a baissé." },
      { titre: "Vente sans numéro", consigne: "Commencer une vente sans numéro de client et encaisser.", attendu: "La question apparaît ; « ✏️ Ajouter le client » ramène au formulaire sans rien enregistrer." },
      { titre: "Vente à crédit", consigne: "Vendre à crédit 100 000 F avec une avance de 30 000 F en espèces.", attendu: "Le reçu de la dette ; dans 🧾 Dettes, la dette montre 70 000 F restants." },
      { titre: "Paiement d'une dette", consigne: "Sur la dette de l'épreuve 4, encaisser 70 000 F.", attendu: "Le reçu dit « REÇU DÉFINITIF — DETTE SOLDÉE » ; la dette passe à payée." },
      { titre: "Proforma puis vente", consigne: "Faire une proforma de deux articles, puis la reprendre avec « 🛒 Vendre » et encaisser.", attendu: "Le panier se remplit avec les mêmes articles et prix ; la proforma dit « ✅ Encaissée »." },
      { titre: "Demande de ravitaillement", consigne: "Demander 5 unités d'un article au magasin.", attendu: "La demande apparaît « ⏳ En attente » dans « Mes demandes »." },
      { titre: "Devis solaire", consigne: "Faire un devis pour 10 ampoules de 15 W (12 h), une télévision de 100 W (6 h) et un congélateur de 200 W (24 h) ; l'enregistrer en brouillon.", attendu: "Le calcul affiche environ 7 200 Wh par jour ; le brouillon apparaît dans 📝 Mes brouillons." },
      { titre: "Clôture du jour", consigne: "Clôturer la journée en comptant un tiroir de 1 000 F de moins que prévu, et écrire pourquoi.", attendu: "L'écart de −1 000 F est affiché et la clôture est enregistrée avec la remarque." },
      { titre: "Vente après la clôture", consigne: "Faire une petite vente en espèces, puis retourner dans 🔒 Caisse.", attendu: "Le bandeau orange dit que la caisse a bougé après la clôture ; la personne recompte et clôture de nouveau." },
    ],
    questions: [
      "Pourquoi une vente peut-elle être impossible le matin, et que faut-il faire ?",
      "Qui fait un retour sous garantie ? Qui fait une reprise ?",
      "Pourquoi le Flooz n'entre-t-il pas dans le montant du tiroir ?",
      "Quand le stock de la boutique monte-t-il après une demande de ravitaillement ?",
      "Que fait-on devant une remise de 5 % demandée par un client ?",
    ],
  },
};
