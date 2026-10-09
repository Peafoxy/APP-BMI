// ============================================================
// GUIDE PAR POSTE — LE GÉRANT DE BOUTIQUE (01/10/2026, « lance le guide
// du gérant »).
//
// « Ma journée » reprend le livret du 22/09/2026, RELU dans le code le
// 01/10/2026 : le gérant a l'onglet 🔁 Transfert (le livret l'oubliait),
// la fiche d'article se crée par « Ajouter à BOUTIQUE » (pas « + Ajouter »),
// et il voit le cadre du loyer dans 📤 Dépenses (25/09). Boutons relus :
// Depenses.jsx, Caisse.jsx, Stocks.jsx, Ravitaillement.jsx (transferts
// reçus), Fournisseurs.jsx, Travaux.jsx, Ventes.jsx (retour sous garantie).
// ============================================================
export const GUIDE = {
  id: "gerant",
  poste: "Gérant de boutique",
  roles: ["gerant"],
  public: "Les gérants des boutiques BMI",
  duree: "3 jours : la journée et les chapitres les deux premiers jours, l'examen le troisième",
  onglets: ["ventes", "commandes", "dimensionnement", "tous_devis", "contrats", "stocks", "transfert", "depenses", "dettes", "clients", "caisse", "fournisseurs", "salaire", "messages", "whatsapp", "nouveau_client", "travaux", "primes_remises"],
  chapitres: [1, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 24, 25],

  journee: [
    ["p", "Le gérant fait **tout ce que fait un vendeur** — vendre, encaisser une dette, faire un devis, clôturer le jour — et il tient en plus **l'argent qui sort, le stock et les fournisseurs** de sa boutique. Les mots entre guillemets sont ceux des boutons ; le chapitre du manuel est indiqué entre parenthèses."],
    ["table", { entetes: ["Mes onglets", "À quoi ils me servent"], largeurs: [3300, 6000], lignes: [
      ["💰 Ventes · 📥 Commandes reçues", "Vendre, faire une proforma, faire un **🔁 Retour sous garantie** ; encaisser les commandes des commerciaux et les poses (chapitre 5)."],
      ["☀️ Dimensionnement · 📋 Tous les devis · 📄 Contrats", "Les devis et les contrats (chapitres 11 à 14)."],
      ["📦 Stocks", "Les articles, les entrées, l'inventaire, le transfert, la demande de ravitaillement (chapitres 8 et 9)."],
      ["🔁 Transfert", "Ce que les autres boutiques m'envoient ou me demandent (chapitre 9)."],
      ["📤 Dépenses", "L'argent qui sort, le loyer du local (chapitre 17)."],
      ["🧾 Dettes · 👤 Clients · 🙋 Créer un client", "Les clients (chapitres 3 et 7)."],
      ["🔒 Caisse", "La clôture du jour, le **versement des fonds**, les avances de frais à rembourser (chapitre 6)."],
      ["🚚 Fournisseurs", "Ce que la boutique doit à ses fournisseurs, et ce qu'elle leur paie (chapitre 10)."],
      ["🛠 Travaux à crédit", "Les chantiers qu'on avance avant de facturer (chapitre 15)."],
      ["💰 Primes remises", "Payer la part d'installation d'un technicien quand l'administrateur la demande à la caisse de ma boutique (chapitre 16)."],
      ["💬 Messages · 📲 WhatsApp · 💵 Salaire", "L'équipe, les clients, ma paie (chapitres 18 et 20)."],
    ] }],

    ["h3", "Le matin"],
    ["etapes", [
      { titre: "Comme le vendeur", texte: "Je me connecte (barre **bleue** = réel), je vérifie que la journée d'hier est clôturée (sinon 💰 Ventes est bloqué), je regarde 💬 Messages et 📲 WhatsApp (chapitres 1, 6, 20)." },
      { titre: "🔁 Transfert", texte: "Le chiffre à côté de l'onglet dit ce qui m'attend. **« 📦 Transferts de stock à valider »** : une autre boutique m'envoie des articles ; tant que je n'ai pas cliqué « ✅ Valider la réception », ils restent dans SON stock. Je valide quand le colis est bien arrivé, sinon « Refuser » avec le motif. Plus bas, les **demandes de transfert** d'une boutique qui a besoin de mes articles : « ✅ Valider » si je les ai (chapitre 9)." },
      { titre: "📦 Stocks → « ⚠ À réapprovisionner »", texte: "Ce qui est sous le seuil, le plus urgent en tête, avec ce qu'il faudrait commander d'après les ventes des 30 derniers jours (chapitre 8)." },
    ]],

    ["h3", "L'argent qui sort — 📤 Dépenses"],
    ["etapes", [
      { titre: "La catégorie, le montant, la description", texte: "Aucune catégorie n'est choisie d'office : je la choisis toujours." },
      { titre: "« Payé avec »", texte: "**La caisse de** ma boutique (ou d'une autre : la dépense est enregistrée sur la boutique dont la caisse a payé), **une avance personnelle** (quelqu'un a payé de sa poche : il sera remboursé), **de l'argent remis par le DG**, ou **le fonds de caisse** — ce dernier n'apparaît que si le tiroir ne suffit pas." },
      { titre: "« Chantier à rattacher »", texte: "Si la dépense (carburant, nourriture…) concerne un chantier en cours, je le choisis : elle sera déduite des frais d'installation avant le partage (chapitres 15 et 17)." },
      { titre: "« Enregistrer la dépense »", texte: "**À partir de 5 000 F**, elle attend la validation du DG : elle ne compte nulle part avant, et une dépense en espèces payée par la caisse **bloque la clôture** tant qu'elle attend. Je la fais valider avant la fermeture." },
    ]],
    ["attention", "On ne sort pas du tiroir plus qu'il ne contient (tiroir + ce qui reste dans l'enveloppe du fonds de caisse). Si ça ne suffit pas, l'application refuse et propose l'**avance personnelle**."],
    ["note", "En haut de 📤 Dépenses, le cadre du **loyer** du local dit si le mois est payé, en attente ou en retard. « 💵 Payer le loyer » demande le mois, le moyen, la caisse qui paie, puis enregistre la dépense ; elle suit les mêmes règles que toute dépense (chapitre 17)."],

    ["h3", "Verser les fonds — 🔒 Caisse"],
    ["etapes", [
      { titre: "« Fonds à verser »", texte: "Le carré dit ce que le tiroir contient : la recette. Le fonds de caisse est gardé à part, il n'est pas dedans et **ne se verse jamais**." },
      { titre: "« 💸 Verser les fonds »", texte: "Le bouton « 💸 Faire un versement » ouvre le formulaire. « D'où part l'argent ? » : le tiroir (espèces, d'office) ou un compte Flooz / Mixx de la boutique. La destination : **Chez le DG** (d'office), **BANQUE** (nom de la banque et numéro de bordereau), **Chez le comptable**." },
      { titre: "Un montant différent", texte: "Si je verse autre chose que le montant attendu, la note devient obligatoire : « Justifiez pourquoi le montant n'est pas … »." },
      { titre: "Ensuite", texte: "Le DG valide (ou le comptable pointe « ✅ Encaissé »). Un versement **rejeté** revient comme s'il n'avait jamais eu lieu : l'argent est de nouveau à verser." },
    ]],
    ["note", "Dans le même écran, « 💼 Avances de frais à rembourser » : je peux rembourser **en espèces depuis la caisse** une personne qui a avancé une dépense de sa poche — jamais moi-même (chapitres 6 et 17)."],

    ["h3", "Le stock — 📦 Stocks"],
    ["ul", [
      "**« + Entrée »** sur la ligne d'un article quand la marchandise arrive **d'un fournisseur**. Jamais pour un ravitaillement venu du magasin : la quantité est déjà entrée.",
      "**« Ajouter à » ma boutique** : une nouvelle fiche d'article. **« ✏️ Corriger »** une fiche : le nom, la catégorie, le seuil… La quantité initiale et les prix sont réservés à l'administrateur (les cases sont grisées).",
      "**« 📋 Faire l'inventaire »**, je compte, puis **« ✅ Valider l'inventaire »** : chaque écart devient un ajustement, tracé.",
      "**« ⇄ Transfert »** vers une autre boutique : l'article **ne bouge pas** tant que l'autre boutique n'a pas validé la réception.",
    ]],

    ["h3", "Le ravitaillement"],
    ["p", "Dans 📦 Stocks, sous « ⚠ À réapprovisionner », **« 🚚 Demander ce ravitaillement »** prépare la demande au magasin avec ces articles et ces quantités ; je retire ou j'ajoute une ligne, puis « 📤 Envoyer la demande ». En bas de l'écran, « 🚚 Demander un ravitaillement au magasin » fait la même chose à la main. **C'est le magasinier qui valide le bon** : le stock entre dans ma boutique à ce moment-là, je n'ai rien à valider. Je contrôle la marchandise contre le bon qui l'accompagne (chapitre 9)."],

    ["h3", "Les fournisseurs — 🚚 Fournisseurs"],
    ["p", "**« + Commande »** quand la boutique s'engage auprès d'un fournisseur ; **« + Règlement »** quand je le paie — la dépense « Achat marchandises » est créée toute seule. On ne règle jamais plus que ce qui est dû (chapitre 10)."],

    ["h3", "Le service après-vente"],
    ["p", "Un article défectueux sous garantie : sur la ligne de la vente dans 💰 Ventes, le bouton **🔁** (« Retour / échange sous garantie »). Un échange n'est **jamais** une vente ; le défectueux part dans un stock SAV à part ; un **bon de retour** sort pour le client. La **↩ Reprise** (le client ne veut plus l'article) reste à l'administrateur principal (chapitre 5)."],

    ["h3", "Les travaux à crédit — 🛠 Travaux à crédit"],
    ["p", "J'ouvre la fiche du chantier, on sort les articles de la boutique (le stock baisse tout de suite), j'ajoute les articles HB achetés dehors, je fixe les frais de prestation, puis « 🧾 Facturer le client (vers 💰 Ventes) » : l'encaissement se fait dans 💰 Ventes, comme une vente (chapitre 15)."],

    ["h3", "Le soir"],
    ["p", "La **clôture du jour** dans 🔒 Caisse, en dernier, exactement comme le vendeur : je lis les ventes par moyen de paiement, je compte les billets, je tape le « Montant du tiroir », j'explique un écart (chapitre 6). Si le bouton est grisé, une dépense en espèces attend le DG."],
    ["regle", "**Une grosse dépense en espèces se fait valider AVANT la fermeture**, sinon la journée ne se clôture pas, et le lendemain personne ne peut vendre."],
  ],

  examen: {
    intro: "L'examen se passe **dans l'espace de formation** (barre violette), avec le formateur à côté. La personne fait chaque épreuve seule ; le formateur regarde l'écran et coche. Une épreuve est réussie quand on voit à l'écran ce que dit la colonne « Ce qu'on doit voir ». Les épreuves de vente du guide du vendeur peuvent être ajoutées si la personne n'a jamais vendu.",
    epreuves: [
      { titre: "Petite dépense", consigne: "Enregistrer une dépense de 3 000 F de carburant, payée avec la caisse de la boutique.", attendu: "La dépense apparaît dans la liste et compte tout de suite dans « Ce mois »." },
      { titre: "Dépense à valider", consigne: "Enregistrer une dépense de 12 000 F en espèces payée avec la caisse, puis aller dans 🔒 Caisse.", attendu: "La dépense attend le DG ; le bouton « Clôturer le jour » est grisé avec le motif en rouge." },
      { titre: "Avance personnelle", consigne: "Enregistrer une dépense de 4 000 F « payée avec une avance personnelle », puis essayer de se la rembourser en espèces dans 🔒 Caisse.", attendu: "Elle apparaît dans « 💼 Avances de frais à rembourser » ; le remboursement est refusé : « On ne se rembourse pas soi-même : demandez à l'administrateur. »" },
      { titre: "Versement des fonds", consigne: "Verser chez le DG 1 000 F de moins que le montant attendu.", attendu: "La note « Justifiez pourquoi le montant n'est pas … » est obligatoire ; le versement attend la validation du DG." },
      { titre: "Entrée de stock", consigne: "Enregistrer une entrée de 10 unités sur un article.", attendu: "Le reste de l'article monte de 10 ; le mouvement apparaît dans son historique." },
      { titre: "Inventaire", consigne: "Faire l'inventaire en comptant 1 unité de moins sur un article, puis valider.", attendu: "L'écart de −1 est enregistré et le stock de l'article baisse de 1." },
      { titre: "Transfert de stock", consigne: "Transférer 2 unités vers une autre boutique de formation, puis regarder le stock.", attendu: "L'article n'a pas bougé ; il apparaît dans « ⏳ Transferts de stock envoyés, en attente de validation »." },
      { titre: "Ravitaillement", consigne: "Depuis « ⚠ À réapprovisionner », préparer et envoyer la demande au magasin.", attendu: "La demande apparaît « ⏳ En attente » dans « Mes demandes »." },
      { titre: "Fournisseur", consigne: "Créer un fournisseur, lui enregistrer une commande de 50 000 F, puis un règlement de 20 000 F.", attendu: "Il reste 30 000 F dus ; une dépense « Achat marchandises » de 20 000 F est créée." },
      { titre: "Retour sous garantie", consigne: "Sur une vente, faire un retour sous garantie gratuit d'un article.", attendu: "Le bon de retour est proposé ; aucune nouvelle vente n'apparaît." },
      { titre: "Travaux à crédit", consigne: "Ouvrir une fiche de travaux, sortir un article de la boutique, puis facturer.", attendu: "Le stock baisse à la sortie ; « Facturer » ouvre 💰 Ventes avec l'article et les frais de prestation." },
      { titre: "Clôture du jour", consigne: "Après validation de la dépense de l'épreuve 2 par l'administrateur principal (le DG), clôturer le jour.", attendu: "La clôture s'enregistre avec l'écart éventuel expliqué." },
    ],
    questions: [
      "À partir de quel montant une dépense attend-elle le DG, et que bloque-t-elle en attendant ?",
      "Quand « Le fonds de caisse » apparaît-il dans « Payé avec » ?",
      "Un ravitaillement venu du magasin : faut-il faire « + Entrée » ? Pourquoi ?",
      "Un ⇄ Transfert envoyé : quand l'article quitte-t-il réellement ma boutique ?",
      "Que devient un versement rejeté par le DG ?",
      "Quelle différence entre un 🔁 Retour et une ↩ Reprise, et qui fait chacun ?",
    ],
  },
};
