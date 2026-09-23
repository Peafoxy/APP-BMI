// ============================================================
// MANUEL DE FORMATION — CHAPITRE 10 : Fournisseurs et entrées de stock
//
// Des MOTS, rien d'autre. Chaque bouton, chaque règle vient du code :
// screens/Fournisseurs.jsx (« Nouveau fournisseur » : Nom, Téléphone,
// Adresse, Site web, Produits, Dû (F), Réglé (F), « Enregistrer » ; le
// tableau « Fournisseurs · Reste à régler : … » ; « + Commande »,
// « + Règlement », « Suppr. » ; le refus « Le montant dépasse le reste dû… » ;
// la dépense « Achat marchandises » créée par un règlement, avec la
// question « Boutique dont la caisse est débitée ? »), screens/Stocks.jsx
// (la liste « Fournisseur » du formulaire d'article — « — Aucun — » ; la
// colonne Fournisseur avec « — Définir — » ; « + Entrée » et « Quantité reçue
// pour « … » » ; « 📥 Importer un fichier Excel », « 📄 Modèle Excel » et le
// choix « ➕ Entrées de stock (marchandise reçue pour des articles
// existants) »), lib/importStock.js (COLONNES_ENTREES = Nom, Quantité reçue,
// Prix d'achat ; analyserEntrees, resumeEntrees, appliquerEntrees ; le
// fournisseur inconnu à l'import d'articles), lib/calculs.js
// (ROLES_FOURNISSEURS = gérant, administrateur ; ROLES_STOCK = magasinier,
// gérant, administrateur ; choisirBoutiqueDebitG ; TABLES_PAR_MARQUE),
// components/ui.jsx (demanderMoyenPaiement : les quatre moyens en boutons),
// lib/constants.js (catégorie « Achat marchandises », compte 601),
// lib/validationDepenses.js (une dépense sans « Payé avec » = la caisse de
// la boutique), App.jsx (onglet 🚚 Fournisseurs : administrateur, gérant).
// ============================================================
export const CHAPITRE = {
  numero: 10,
  titre: "Fournisseurs et entrées de stock",
  sousTitre: "Tenir la fiche de chaque fournisseur, son ardoise et ses règlements — et faire entrer la marchandise reçue, une ligne à la fois ou par fichier",
  public: "Gérant, administrateur (fournisseurs et règlements) ; magasinier, gérant, administrateur (entrées de stock)",
  duree: "45 min, puis l'exercice en espace formation",
  prerequis: "Le chapitre 8 (Stocks) : la formule du stock, la fiche d'un article, ✏️ Corriger. Le chapitre 9 (Ravitaillement) : ce qui arrive par bon ou par transfert ne se saisit pas en entrée.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "**créer la fiche d'un fournisseur** (nom, téléphone, adresse, site, produits) et lire son ardoise : Dû, Réglé, Reste ;",
        "**enregistrer une commande à crédit** (« + Commande ») et **un règlement** (« + Règlement »), et ce que le règlement écrit derrière : une dépense « Achat marchandises » qui sort d'une caisse précise ;",
        "**rattacher un article à son fournisseur** dans 📦 Stocks, à la création de la fiche ou après coup ;",
        "**faire entrer la marchandise reçue** : « + Entrée » sur une ligne, ou d'un coup par fichier Excel en mode « ➕ Entrées de stock » ;",
        "distinguer ce qui se saisit en entrée (ce qui vient d'un fournisseur) de ce qui arrive par bon de ravitaillement ou transfert (jamais en entrée).",
      ]],
      ["regle", "**Deux gestes, deux écrans, jamais l'un à la place de l'autre.** L'**argent** dû et réglé à un fournisseur se tient dans 🚚 Fournisseurs ; la **marchandise** reçue entre dans 📦 Stocks par « + Entrée » ou par fichier. L'application ne relie pas les deux automatiquement : une entrée de stock ne crée pas de dette fournisseur, et un règlement ne fait pas entrer d'article. C'est l'employé qui fait les deux, l'un après l'autre."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [5200, 4100], lignes: [
        ["Voir l'onglet 🚚 Fournisseurs", "**Administrateur et gérant** seulement. Le vendeur, le magasinier, le technicien ne l'ont pas."],
        ["Créer un fournisseur (« Enregistrer »), « + Commande », « + Règlement », « Suppr. »", "**Gérant et administrateur** (règle du 04/09/2026 : « gérant + admin : fournisseurs »). Le refus nomme le geste : « Créer un fournisseur », « Régler un fournisseur », « Enregistrer une dette fournisseur », « Supprimer un fournisseur »."],
        ["Choisir le fournisseur d'un article (formulaire « Nouvel article », lien « — Définir — » dans le tableau)", "Ceux qui écrivent dans 📦 Stocks : magasinier, gérant, administrateur — et tout compte qui n'est pas en lecture seule pour le lien de la colonne."],
        ["« + Entrée » sur une ligne, importer un fichier « ➕ Entrées de stock »", "**Magasinier, gérant, administrateur** (les rôles du stock). Refus : « Enregistrer une entrée de stock »."],
        ["Mettre à jour un **prix d'achat** par le fichier d'entrées", "**Administrateur seul** (décision du 04/09/2026). Pour les autres, la colonne « Prix d'achat » du fichier est ignorée, et l'écran le dit."],
        ["Le compte en lecture seule (comptable)", "Rien de tout cela : chaque geste répond que la base est en lecture seule."],
      ]}],
      ["note", "Un fournisseur appartient à **un espace** : ceux de l'espace formation et ceux du réel sont deux listes étanches (demande du 19/08/2026). Un compte de formation ne voit jamais les vrais fournisseurs, ne peut ni gonfler leur ardoise ni les supprimer. Chacun crée les siens."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3300, 6000], lignes: [
        ["**🚚 Fournisseurs**", "En haut, le cadre **« Nouveau fournisseur »** : Nom · Téléphone · Adresse · Site web · Produits · Dû (F) · Réglé (F), et le bouton **« Enregistrer »**. Dessous, le tableau **« Fournisseurs · Reste à régler : … »** : Nom · Téléphone · Adresse · Site (« Visiter ») · Produits · Dû · Réglé · Reste, et sur chaque ligne **« + Commande »**, **« + Règlement »**, **« Suppr. »**."],
        ["**📦 Stocks**, formulaire d'article", "La liste déroulante **« Fournisseur »** (« — Aucun — », puis les fournisseurs de l'espace). Elle ne propose que des fiches déjà créées dans 🚚 Fournisseurs."],
        ["**📦 Stocks**, tableau", "La colonne **« Fournisseur »** : le nom du fournisseur de l'article, ou **« — Définir — »**. Un clic ouvre la question « Fournisseur de « … » ? » avec la liste des fournisseurs enregistrés. La colonne **« Entrées »** cumule tout ce qui est entré depuis la création de la fiche."],
        ["**📦 Stocks**, sur la ligne d'un article", "**« + Entrée »** : « Quantité reçue pour « … » : »."],
        ["**📦 Stocks**, sous le formulaire", "**« 📥 Importer un fichier Excel »** (puis le choix « 📦 Nouveaux articles » / « ➕ Entrées de stock »), **« 📄 Modèle Excel »** (le même choix, pour télécharger le modèle vide), **« 📋 Coller du texte »** (nouveaux articles seulement)."],
        ["**📤 Dépenses**", "Chaque règlement de fournisseur y apparaît : catégorie **« Achat marchandises »**, description « Règlement fournisseur X », sur la boutique dont la caisse a payé."],
        ["**📊 Tableau de bord**, pastille 🏦 BANQUE", "Un règlement par virement bancaire sort de la caisse BANQUE (chapitre 6)."],
        ["**🕘 Historique**", "« Paiement fournisseur X (montant) — BOUTIQUE », « Entrée stock +N « article » — BOUTIQUE », « Fournisseur de « article » : X », et l'import d'entrées ligne par ligne."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Créer un fournisseur"],
      ["etapes", [
        { titre: "Ouvrir 🚚 Fournisseurs", texte: "Le cadre « Nouveau fournisseur » est en haut. Le **Nom** est le seul champ obligatoire (« Veuillez saisir un nom. »). Téléphone (« +228 … »), Adresse, Site web (« https://… »), Produits (ce qu'il vend, en clair : « panneaux, batteries ») sont facultatifs mais utiles : c'est ce que l'équipe lira." },
        { titre: "Reprendre une ardoise existante", texte: "**Dû (F)** et **Réglé (F)** servent à reprendre l'historique d'un fournisseur qu'on connaît déjà : ce qu'on lui doit au total, ce qu'on lui a déjà versé. Pour un fournisseur neuf, on laisse vide. ⚠ Ces deux montants de départ **ne créent aucune dépense** : ils décrivent le passé, avant l'application." },
        { titre: "Enregistrer", texte: "**« Enregistrer »** → « Fournisseur ajouté ! ». La fiche naît dans l'espace regardé (réel ou formation) et apparaît dans le tableau, avec son Reste = Dû − Réglé, en rouge s'il reste quelque chose, en vert sinon." },
      ]],
      ["h3", "B. Enregistrer une commande à crédit"],
      ["etapes", [
        { titre: "« + Commande » sur la ligne", texte: "« Nouvelle commande à crédit chez X — montant (F) : ». On saisit le montant de la facture du fournisseur. → « Commande de … enregistrée ! » : le **Dû** augmente d'autant, le Reste aussi. Rien d'autre ne bouge : ni le stock, ni les dépenses." },
        { titre: "Puis faire entrer la marchandise", texte: "La commande enregistre l'**argent** dû. La **marchandise** reçue entre dans 📦 Stocks par « + Entrée » ou par fichier (partie D). Les deux gestes se font l'un après l'autre : l'application ne devine pas l'un à partir de l'autre." },
      ]],
      ["h3", "C. Régler un fournisseur"],
      ["etapes", [
        { titre: "« + Règlement » sur la ligne", texte: "« Montant réglé à X (F) — reste dû : Y : », pré-rempli avec le reste dû. On peut régler moins (un acompte), jamais plus : « Le montant dépasse le reste dû à X (Y). Si vous lui devez plus que ce qui est enregistré, enregistrez d'abord la commande (« + Commande »), puis réglez. »" },
        { titre: "Le moyen de paiement", texte: "« Moyen de paiement à X : » — quatre boutons : **Espèces** (proposé en premier), Mobile Money (Flooz), Mobile Money (Mixx/T-Money), Virement bancaire. Jamais « crédit » : on paie, on ne s'endette pas ici." },
        { titre: "La caisse qui paie", texte: "« Paiement de … à X — Boutique dont la caisse est débitée ? » : la liste des boutiques de vente de l'espace regardé, plus « Chez le comptable » en réel. S'il n'y a qu'une caisse possible, la question n'est pas posée." },
        { titre: "Ce qui est écrit", texte: "« Paiement de … enregistré ! (dépense créée — sortie de caisse : BOUTIQUE) ». Le **Réglé** du fournisseur augmente, et une **dépense « Achat marchandises »** est créée à la date du jour, description « Règlement fournisseur X », avec le moyen choisi, sur la boutique choisie. En espèces, elle sort du tiroir de cette boutique et compte dans sa clôture du jour." },
      ]],
      ["h3", "D. Faire entrer la marchandise reçue"],
      ["etapes", [
        { titre: "Une ligne à la fois : « + Entrée »", texte: "📦 Stocks, sur la boutique ou le magasin qui reçoit, bouton **« + Entrée »** sur la ligne de l'article → « Quantité reçue pour « … » : » → « N … ajoutés au stock ! ». La colonne **Entrées** monte, le Stock aussi. Le journal garde « Entrée stock +N « article » — BOUTIQUE »." },
        { titre: "D'un coup, par fichier : le modèle", texte: "**« 📄 Modèle Excel »** → « Quel modèle Excel voulez-vous ? » → **« ➕ Entrées de stock (marchandise reçue pour des articles existants) »**. Le fichier téléchargé (« Modele_entrees_stock_BOUTIQUE.xlsx ») a trois colonnes : **Nom · Quantité reçue · Prix d'achat**, avec une ligne d'exemple. On le remplit, une ligne par article, le Nom **tel qu'il est écrit dans 📦 Stocks** (majuscules et accents ne comptent pas)." },
        { titre: "Importer", texte: "**« 📥 Importer un fichier Excel »** → choisir le fichier → « Que contient « fichier » ? » → **« ➕ Entrées de stock … »**. Si le fichier a plusieurs feuilles : « Ce fichier a N feuilles. Seule la première, « … », sera lue — pour BOUTIQUE. Continuer ? » (une feuille par boutique, toujours)." },
        { titre: "Lire le résumé avant de confirmer", texte: "« Enregistrer N entrée(s) de stock dans BOUTIQUE (T pièce(s) au total) ? », suivi de **« ⚠ N ligne(s) NON importée(s) »** avec la raison de chacune, et **« ℹ N prix d'achat mis à jour »** (administrateur seulement : « article : ancien → nouveau »). On lit les refus avant de dire oui : une ligne refusée **ne sera pas entrée**." },
        { titre: "Après", texte: "« ✅ N entrée(s) de stock enregistrée(s) dans BOUTIQUE. » 🕘 Historique nomme chaque article entré et le fichier. Une ligne refusée se corrige dans le fichier (ou l'article se crée d'abord en mode « 📦 Nouveaux articles »), puis on réimporte **seulement les lignes refusées** — réimporter tout le fichier compterait deux fois les autres." },
      ]],
      ["h3", "E. Rattacher un article à son fournisseur"],
      ["etapes", [
        { titre: "À la création de la fiche", texte: "Dans le formulaire « Nouvel article », la liste **« Fournisseur »** propose « — Aucun — » et les fournisseurs de l'espace. Le journal le dit : « Nouvel article « … » — BOUTIQUE (fournisseur : X) »." },
        { titre: "Après coup, dans le tableau", texte: "Colonne Fournisseur, cliquer **« — Définir — »** (ou le nom actuel) : « Fournisseur de « … » ? » avec la liste des fournisseurs enregistrés. On tape un nom de la liste (majuscules libres) ; **vide = retirer le fournisseur**. Un nom hors liste est refusé : « Ce fournisseur n'existe pas. Créez-le d'abord dans 🚚 Fournisseurs. » Sans aucun fournisseur : « Aucun fournisseur enregistré. Créez-le d'abord dans l'onglet 🚚 Fournisseurs. »" },
        { titre: "Par l'import d'articles", texte: "En mode « 📦 Nouveaux articles », la colonne Fournisseur du fichier doit porter un nom **déjà enregistré** : un fournisseur inconnu n'est pas créé (on ne crée pas un fournisseur par faute de frappe), l'article est importé **sans** fournisseur et le résumé le dit." },
      ]],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["h3", "🚚 Fournisseurs"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Nouveau fournisseur → Enregistrer", "Crée la fiche dans l'espace regardé. Nom obligatoire ; Dû / Réglé de départ pour reprendre une ardoise ancienne, sans dépense."],
        ["Reste à régler : … (en tête du tableau)", "La somme de tous les restes (Dû − Réglé) des fournisseurs de l'espace. Ce que BMI doit encore, toutes fiches confondues."],
        ["Site → « Visiter »", "Ouvre le site du fournisseur dans un nouvel onglet (« https:// » ajouté s'il manque)."],
        ["Reste (rouge / vert)", "Rouge : il reste à payer. Vert : à jour. Jamais négatif — un règlement ne peut pas dépasser le reste."],
        ["+ Commande", "Ajoute une commande à crédit au Dû. N'écrit ni stock ni dépense."],
        ["+ Règlement", "Demande le montant (plafonné au reste), le moyen (quatre boutons), la caisse ; augmente le Réglé et crée la dépense « Achat marchandises »."],
        ["Suppr.", "« Supprimer le fournisseur « X » ? » : la fiche part avec son ardoise. Les dépenses déjà créées restent dans 📤 Dépenses ; les articles gardent le nom en colonne Fournisseur tant qu'on ne le change pas."],
      ]}],
      ["h3", "📦 Stocks — la part fournisseur et les entrées"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Fournisseur (liste du formulaire)", "Le fournisseur de la fiche à sa création. Seules les fiches de 🚚 Fournisseurs sont proposées."],
        ["— Définir — (colonne Fournisseur)", "Pose ou change le fournisseur d'un article existant, parmi ceux enregistrés. Vide pour retirer."],
        ["Entrées (colonne)", "Le cumul des « + Entrée » et des entrées importées. Il n'entre dans le stock que par ces deux gestes — jamais par ✏️ Corriger."],
        ["+ Entrée", "Une réception, une quantité, un article. « Quantité reçue pour « … » : »."],
        ["📄 Modèle Excel → ➕ Entrées de stock", "Le fichier vide à trois colonnes (Nom, Quantité reçue, Prix d'achat) au nom de la boutique regardée."],
        ["📥 Importer un fichier Excel → ➕ Entrées de stock", "Toutes les réceptions d'un coup, pour des articles **existants** ; ne crée jamais d'article."],
        ["📋 Coller du texte", "Nouveaux articles seulement (huit colonnes). Pas d'entrées par ce chemin."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Un règlement = une dépense.** Catégorie « Achat marchandises » (compte 601 du journal comptable), date du jour, moyen de paiement choisi, auteur, sur la boutique choisie. Elle compte dans le total des dépenses, le résultat du tableau de bord, l'export « Dépenses » et le journal comptable.",
        "**En espèces, elle sort du tiroir** de la boutique choisie et pèse sur sa clôture du jour (une sortie justifiée, pas un écart). Par virement, elle sort de la caisse 🏦 BANQUE ; par Flooz ou Mixx, du compte mobile de la boutique (chapitre 6).",
        "**Cette dépense ne passe pas par la validation du DG** : elle est écrite directement par le geste « + Règlement » et compte tout de suite, quel que soit le montant — au contraire d'une dépense saisie dans 📤 Dépenses (seuil de 5 000 F). Le règlement est réservé au gérant et à l'administrateur, c'est là qu'est le contrôle.",
        "**Le Réglé ne dépasse jamais le Dû** : le refus le dit et renvoie à « + Commande ». Le Reste est toujours Dû − Réglé, jamais négatif.",
        "**Une entrée ajoute à la colonne Entrées** de l'article, et le stock se recalcule : Initial + Entrées − Vendus + Ajustements (chapitre 8). Aucun ajustement n'est écrit pour une entrée : c'est la fiche qui porte le cumul.",
        "**L'import d'entrées ne crée jamais d'article** : un nom inconnu dans la boutique est refusé (« aucun article de ce nom dans BOUTIQUE — créez-le d'abord (mode « Nouveaux articles ») »). Un article en double dans le fichier est refusé ; une quantité vide ou nulle aussi.",
        "**Le prix d'achat du fichier met à jour la fiche** — administrateur seul. Pour un gérant ou un magasinier, la colonne est ignorée et le résumé l'annonce : « Colonne « Prix d'achat » ignorée : corriger un prix est réservé à l'administrateur. » Le prix de vente ne se touche pas par ce chemin.",
        "**Le mur** : les fournisseurs proposés (formulaire, colonne, import) sont ceux de l'espace de la boutique regardée ; la caisse qui paie un règlement est une caisse de l'espace regardé, et « Chez le comptable » n'est proposée qu'en réel.",
        "**Le journal** (🕘 Historique) garde le paiement avec sa caisse, chaque « + Entrée » avec sa quantité, chaque changement de fournisseur — et, pour un import, une ligne qui nomme chaque article entré et le fichier.",
        "**Aucune notification** n'est envoyée par ces gestes : ni le règlement ni l'entrée ne préviennent quelqu'un.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**📦 Stocks** (chapitre 8) : la colonne Fournisseur, la colonne Entrées, le prix d'achat qui nourrit la valeur du stock et « ⚠ À réapprovisionner » (l'export nomme le fournisseur de chaque article en manque).",
        "**🚚 Ravitaillement** (chapitre 9) : ce que le magasin reçoit du fournisseur (« + Entrée » au magasin) est ce qu'il pourra ravitailler. Ce qui arrive en boutique par RAV-… ou TRF-… **ne se saisit jamais en entrée**.",
        "**📤 Dépenses** (chapitre 17) : chaque règlement y est une ligne « Achat marchandises ». Une dépense ne se modifie pas : l'administrateur la supprime (« Suppr. ») et en saisit une juste.",
        "**🔒 Caisse** (chapitre 6) : un règlement en espèces est une sortie justifiée de la clôture du jour ; par virement, il apparaît dans le relevé 🏦 BANQUE ; par Flooz ou Mixx, dans le solde du compte mobile.",
        "**📈 Rentabilité** (chapitre 22) : le prix d'achat de chaque article — celui de la fiche, mis à jour par l'administrateur ou par le fichier d'entrées — fait la marge.",
        "**⚙ Paramètres** (chapitre 23) : les boutiques et magasins qui peuvent recevoir une entrée ou débiter une caisse.",
        "**🕘 Historique** (chapitre 22) : chaque geste, avec son auteur.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Chaque fournisseur a une fiche **avant** qu'on rattache des articles ou qu'on importe : la colonne Fournisseur d'un fichier ne crée rien.",
        "Une facture reçue à crédit est enregistrée par **« + Commande »** le jour même, pour que le Reste dise la vérité.",
        "Avant « + Règlement », le Reste affiché correspond à ce que le fournisseur réclame ; sinon « + Commande » d'abord.",
        "Au règlement, **le moyen et la caisse** sont ceux réellement utilisés : un virement enregistré en espèces creuse la caisse d'un montant qui n'en est jamais sorti.",
        "La marchandise est **comptée au déballage**, puis saisie : « + Entrée » pour une ligne, le fichier pour un arrivage.",
        "Le résumé de l'import est **lu jusqu'au bout** : les lignes « NON importée(s) » sont corrigées et réimportées seules.",
        "Aucune « + Entrée » pour un article arrivé par bon de ravitaillement ou par transfert.",
        "Le prix d'achat qui change est mis à jour par l'administrateur (fichier ou ✏️ Corriger), sinon la marge de 📈 Rentabilité ment.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3300], lignes: [
        ["Régler plus que le reste dû", "« Le montant dépasse le reste dû à X (…). Si vous lui devez plus que ce qui est enregistré, enregistrez d'abord la commande (« + Commande »), puis réglez. »", "« + Commande » du montant manquant, puis « + Règlement »."],
        ["Choisir « Espèces » pour un virement", "La dépense sort du tiroir ; la clôture du soir montre un manque de ce montant.", "L'administrateur supprime la dépense dans 📤 Dépenses et en saisit une juste (Achat marchandises, virement, même boutique). Le Réglé du fournisseur, lui, est bon."],
        ["Débiter la mauvaise boutique", "La dépense pèse sur la caisse et le résultat d'une boutique qui n'a rien payé.", "L'administrateur supprime la dépense dans 📤 Dépenses et la ressaisit sur la bonne boutique ; à la question « Boutique dont la caisse est débitée ? », regarder d'où l'argent est vraiment sorti."],
        ["Saisir une « + Entrée » pour un article arrivé par RAV-… ou TRF-…", "L'article est compté deux fois : par le mouvement et par l'entrée.", "± Ajuster avec un motif clair (chapitre 8) ; ne saisir en entrée que ce qui vient d'un fournisseur."],
        ["Importer des entrées pour un article qui n'existe pas encore", "« aucun article de ce nom dans BOUTIQUE — créez-le d'abord (mode « Nouveaux articles ») » : la ligne n'entre pas.", "Créer la fiche (formulaire ou import « 📦 Nouveaux articles »), puis réimporter cette ligne."],
        ["Un nom écrit autrement que dans 📦 Stocks (« Panneau 400 W » pour « PANNEAU 400W »)", "Les majuscules et accents ne comptent pas, mais un espace ou un mot en plus fait un nom inconnu : ligne refusée.", "Copier le nom depuis 📦 Stocks (ou depuis l'export) dans le fichier."],
        ["Réimporter tout le fichier après avoir corrigé deux lignes", "Les lignes déjà entrées le sont une seconde fois.", "N'importer que les lignes refusées, ou corriger par ± Ajuster."],
        ["Un gérant met un prix d'achat dans le fichier", "« Colonne « Prix d'achat » ignorée : corriger un prix est réservé à l'administrateur. » Les quantités entrent, le prix ne bouge pas.", "Transmettre le nouveau prix à l'administrateur (✏️ Corriger ou son propre import)."],
        ["Taper un fournisseur inconnu dans « — Définir — »", "« Ce fournisseur n'existe pas. Créez-le d'abord dans 🚚 Fournisseurs. »", "Créer la fiche, puis revenir sur l'article."],
        ["Supprimer un fournisseur qui a encore un Reste", "L'ardoise disparaît avec la fiche ; personne ne rappellera ce qui est dû.", "Régler ou noter le reste avant, ou garder la fiche."],
        ["Mettre le montant d'une facture dans « Dû (F) » d'une fiche existante", "Ce champ n'existe qu'à la création. Après, c'est « + Commande ».", "« + Commande » sur la ligne."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "BMI achète pour la première fois chez SOLARIS : 20 panneaux 400W, facture de 900 000 F payable dans 30 jours.", reponse: "🚚 Fournisseurs → « Nouveau fournisseur » : SOLARIS, téléphone, produits « panneaux » → « Enregistrer ». Puis « + Commande » : 900 000 → Dû 900 000, Reste 900 000 en rouge. Ensuite 📦 Stocks, sur le magasin : « + Entrée » sur PANNEAU 400W → 20. Deux gestes, l'argent puis la marchandise." },
        { situation: "Trente jours plus tard, le gérant paie SOLARIS par virement depuis la banque.", reponse: "« + Règlement » : 900 000 (pré-rempli) → « Moyen de paiement à SOLARIS » : **Virement bancaire** → caisse : la boutique concernée. Reste 0, en vert. Dans 📤 Dépenses : « Achat marchandises — Règlement fournisseur SOLARIS », 900 000, virement. Dans le tableau de bord, 🏦 BANQUE montre la sortie." },
        { situation: "Le gérant tape 950 000 par erreur.", reponse: "« Le montant dépasse le reste dû à SOLARIS (900 000 F)… » : rien n'est écrit. Il reprend avec 900 000." },
        { situation: "Un arrivage de 14 articles différents pour DEMAKPOE, avec la facture.", reponse: "📦 Stocks sur DEMAKPOE → « 📄 Modèle Excel » → « ➕ Entrées de stock » ; remplir Nom (copié depuis l'écran), Quantité reçue, et le prix d'achat si l'administrateur fait l'import ; « 📥 Importer un fichier Excel » → « ➕ Entrées de stock » → lire le résumé → confirmer. Puis 🚚 Fournisseurs → « + Commande » du montant de la facture." },
        { situation: "Dans le résumé : « ⚠ 2 ligne(s) NON importée(s) — Ligne 7 (Cable 6mm) : aucun article de ce nom dans DEMAKPOE — créez-le d'abord ; Ligne 12 (Batterie 200Ah) : quantité reçue manquante ou nulle ».", reponse: "Confirmer quand même : les 12 autres entrent. Puis créer « Câble solaire 6 mm² » (ou corriger le nom dans le fichier), mettre la quantité de la batterie, et réimporter **ces deux lignes seules**." },
        { situation: "Le magasinier a mis les nouveaux prix d'achat dans son fichier d'entrées.", reponse: "Les quantités entrent ; le résumé dit « Colonne « Prix d'achat » ignorée : corriger un prix est réservé à l'administrateur. » Il transmet les prix à l'administrateur, qui les met à jour (✏️ Corriger, ou le même fichier importé par lui)." },
        { situation: "Un panneau est arrivé à APESSITO par bon de ravitaillement RAV-…, et le gérant veut « faire une entrée pour que le stock soit juste ».", reponse: "Non : le stock a déjà bougé à la validation du bon (chapitre 9). Une « + Entrée » le compterait deux fois. Il vérifie « Derniers mouvements » : le RAV-… y est." },
        { situation: "L'administrateur veut savoir ce que BMI doit à tous ses fournisseurs.", reponse: "🚚 Fournisseurs, en tête du tableau : « Reste à régler : … », et la colonne Reste, en rouge fiche par fiche." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "**En espace formation**, avec un magasin et une boutique de formation, un compte gérant et un compte administrateur :"],
      ["ol", [
        "Créer un fournisseur complet (nom, téléphone, site, produits) ; vérifier qu'il apparaît avec Reste 0 en vert.",
        "« + Commande » de 150 000 ; lire Dû, Réglé, Reste et « Reste à régler » en tête.",
        "Dans 📦 Stocks, rattacher deux articles à ce fournisseur : l'un par « — Définir — », l'autre à la création d'une nouvelle fiche.",
        "« + Entrée » de 5 sur le premier article ; lire la colonne Entrées et le Stock.",
        "Télécharger le modèle « ➕ Entrées de stock », y mettre trois lignes dont une avec un nom faux ; importer ; lire le résumé (une ligne refusée) ; confirmer ; corriger la ligne et la réimporter seule.",
        "Avec le compte **gérant**, importer un fichier d'entrées avec un prix d'achat : lire l'avertissement « ignorée ». Refaire avec l'**administrateur** : lire « prix d'achat mis à jour ».",
        "« + Règlement » de 100 000 en Flooz, sur la boutique de formation ; ouvrir 📤 Dépenses et retrouver « Achat marchandises — Règlement fournisseur … » ; revenir : Reste 50 000.",
        "Essayer « + Règlement » de 60 000 : lire le refus. Puis « + Commande » de 10 000 et régler 60 000 : Reste 0.",
      ]],
      ["note", "Le formateur vérifie surtout : l'employé sait que **la commande enregistre l'argent et l'entrée enregistre la marchandise**, qu'un règlement **crée une dépense sur une caisse précise** avec le vrai moyen de paiement, et qu'il **ne fait jamais d'entrée** pour ce qui arrive par bon ou transfert."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "crée une fiche fournisseur complète et lit son ardoise (Dû, Réglé, Reste) ;",
        "enregistre une commande à crédit le jour de la facture ;",
        "règle un fournisseur avec le bon moyen et la bonne caisse, et retrouve la dépense dans 📤 Dépenses ;",
        "rattache un article à son fournisseur, à la création ou après ;",
        "saisit une réception par « + Entrée » et un arrivage par fichier, et lit le résumé avant de confirmer ;",
        "ne réimporte que les lignes refusées, jamais tout le fichier ;",
        "ne fait jamais d'entrée pour une marchandise arrivée par RAV-… ou TRF-….",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Que change « + Commande » ? Et « + Règlement » ? Lequel des deux crée une dépense ?",
        "Pourquoi l'application refuse-t-elle un règlement supérieur au reste dû, et que faut-il faire ?",
        "Un règlement en espèces : où se voit-il le soir même ?",
        "Une entrée de stock crée-t-elle une dette chez le fournisseur ?",
        "Quelles sont les trois colonnes du fichier d'entrées, et que devient une ligne dont le nom n'existe pas dans la boutique ?",
        "Qui peut mettre à jour un prix d'achat par le fichier ? Que se passe-t-il pour les autres ?",
        "Un article arrivé par bon de ravitaillement : « + Entrée » ou non ? Pourquoi ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Crée une fiche fournisseur et lit Dû / Réglé / Reste",
      "Enregistre une commande à crédit (+ Commande)",
      "Règle un fournisseur avec le bon moyen et la bonne caisse",
      "Retrouve la dépense « Achat marchandises » dans 📤 Dépenses",
      "Rattache un article à son fournisseur",
      "Saisit une entrée par ligne et un arrivage par fichier",
      "Lit le résumé de l'import et ne réimporte que les lignes refusées",
      "Ne fait jamais d'entrée pour une marchandise arrivée par RAV-… / TRF-…",
      "Répond juste aux sept questions de la rubrique 12",
    ],
  },
};
