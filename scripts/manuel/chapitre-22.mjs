// ============================================================
// MANUEL DE FORMATION — CHAPITRE 22 : Rentabilité, tableau de bord, historique
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// App.jsx (onglets 📊 Tableau de bord, 📈 Rentabilité, 🕘 Historique :
// administrateur et comptable), screens/Dashboard.jsx (les pastilles TOUTES /
// boutiques / TERRAIN / 📱 FLOOZ / 📱 MIXX/T-MONEY / 👤 DG / 🏦 BANQUE /
// 🧾 COMPTABLE, les cartes, « Période : », Personnalisée, le graphique des
// 6 derniers mois, 🏆 Top 5, 💳 Répartition des paiements, Synthèse par
// période, les exports et 📒 Journal comptable (SYSCOHADA), les cartes par
// boutique), components/CarteCaisse.jsx (le relevé : 🖨 Imprimer le relevé
// (PDF), Exporter (CSV)), components/CompteExploitant.jsx (➕ Apport,
// ➖ Prélèvement), lib/caissesCentrales.js (releve), lib/caissesMobiles.js,
// lib/compteExploitant.js, screens/Rentabilite.jsx (Période, Trier par, les
// quatre cartes, Produits vendus, 😴 Produits dormants, 📄 Exporter),
// screens/Historique.jsx, lib/core.js (caVente, caLigneVente, lignesJournal).
// Les caisses elles-mêmes (versements, clôture) sont au chapitre 6.
// ============================================================
export const CHAPITRE = {
  numero: 22,
  titre: "Rentabilité, tableau de bord et historique",
  sousTitre: "Lire les chiffres de BMI : ventes, dépenses, résultat, caisses centrales, marges par article, et le journal de tout ce qui s'est fait",
  public: "Administrateur, comptable",
  duree: "1 h, dans l'espace de formation puis dans le réel",
  prerequis: "Le chapitre 6 (Caisse) : le tiroir, les versements, la clôture. Le chapitre 17 (Dépenses) : la validation par le DG.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "lire le **📊 Tableau de bord** : ventes, dépenses, résultat, dettes, commissions, sur la période choisie ;",
        "regarder **une seule boutique**, ou **une caisse** (👤 DG, 🏦 BANQUE, 🧾 COMPTABLE, 📱 FLOOZ, 📱 MIXX/T-MONEY), et en **imprimer le relevé** ;",
        "sortir les **exports** (ventes, dépenses, versements, dettes, stocks) et le **📒 Journal comptable** pour le comptable ;",
        "lire la **📈 Rentabilité** : la marge de chaque article, les produits qui dorment en stock ;",
        "retrouver **qui a fait quoi, et quand**, dans **🕘 Historique**.",
      ]],
      ["regle", "**Ces trois écrans ne font que LIRE.** Aucun chiffre ne s'y tape (sauf l'apport et le prélèvement du DG). Si un chiffre paraît faux, c'est une saisie qu'il faut retrouver : une vente, une dépense, un versement."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4300, 5000], lignes: [
        ["Ouvrir 📊 Tableau de bord, 📈 Rentabilité, 🕘 Historique", "**L'administrateur et le comptable.** Aucun autre rôle n'a ces onglets."],
        ["Les pastilles 👤 DG et 🏦 BANQUE", "**L'administrateur principal seul** (le DG). Les autres ne les voient pas."],
        ["La pastille 🧾 COMPTABLE", "L'administrateur et le comptable, dans le réel."],
        ["➕ Apport / ➖ Prélèvement (pastille 👤 DG)", "**L'administrateur principal seul.**"],
        ["Les exports et le journal comptable", "Tous ceux qui ont l'onglet."],
      ]}],
      ["note", "**L'espace regardé décide de tout.** En formation, ces écrans ne montrent que les boutiques d'entraînement ; dans le réel, que les vraies. L'administrateur principal change d'espace par ⚙ Paramètres → 👁 Je regarde — un bandeau ambre le rappelle en haut de l'écran."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Onglet", "Ce qu'on y trouve"], largeurs: [2600, 6700], lignes: [
        ["📊 Tableau de bord", "La rangée de pastilles en haut, les cartes de chiffres, « Période : », le graphique, le Top 5, la répartition des paiements, la synthèse, les exports, une carte par boutique."],
        ["📈 Rentabilité", "« 📈 Rentabilité par produit » : période, tri, quatre cartes, le tableau « Produits vendus », puis « 😴 Produits dormants »."],
        ["🕘 Historique", "« Historique des actions (500 dernières) » : date et heure, utilisateur, action, avec une ligne de recherche."],
      ]}],
      ["p", "Le tableau de bord est le **premier onglet** de l'administrateur et du comptable : c'est lui qui s'ouvre à la connexion."],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Lire le tableau de bord"],
      ["etapes", [
        { titre: "Choisir la pastille", texte: "**TOUTES** (d'office) ou une boutique, TERRAIN, un compte mobile, une caisse. Une boutique choisie : « Tout l'écran ne compte que X. » Le choix est gardé pour la prochaine fois." },
        { titre: "La première rangée de cartes", texte: "**Depuis le début** : Total des ventes, Total des dépenses, Total des dettes, Commissions dues (non payées), Commissions déjà payées, Clients uniques ; et, s'il y en a, « Frais d'installation/transport encaissés » et « Avances clients à livrer »." },
        { titre: "« Période : »", texte: "**Aujourd'hui** d'office, puis Cette semaine, Ce mois, Cette année, Depuis le début, ou **Personnalisée** (deux dates ; le **Résultat** s'affiche à droite)." },
        { titre: "Les cartes de la période", texte: "**Ventes — …**, **Dépenses — …**, **Résultat — …** (vert ou rouge) et **Dettes en cours** (elle, ne dépend pas de la période). **Le Résultat = ventes − prix d'achat des articles vendus − dépenses**, et le calcul est écrit chiffre par chiffre juste en dessous. Les dépenses « Achat marchandises » (dont les règlements de fournisseurs) n'y entrent pas : le prix d'achat les compte déjà." },
        { titre: "L'avertissement en ambre", texte: "« ⚠ N articles vendus sans prix d'achat… le bénéfice est surestimé » : ces articles n'ont pas de prix d'achat sur leur fiche, ils sont comptés comme s'ils n'avaient rien coûté. Les nommer, puis **📦 Stocks → ✏️ Corriger** leur prix d'achat : le résultat se corrige tout seul, ventes passées comprises. Un service (frais d'installation, de prestation) n'a pas de prix d'achat et n'est jamais signalé." },
        { titre: "Plus bas", texte: "**Ventes des 6 derniers mois** (une couleur par boutique), **🏆 Top 5 des produits** et **💳 Répartition des paiements** (période choisie), **Synthèse par période** (les cinq périodes côte à côte), puis une carte par boutique : dettes clients, alertes stock, valeur du stock au prix d'achat et au prix de vente." },
      ]],
      ["note", "**Un dépôt** ne vend rien : sa pastille ne montre que ses dépenses et son stock. **TERRAIN** n'a pas de stock."],

      ["h3", "B. Lire le relevé d'une caisse"],
      ["etapes", [
        { titre: "Choisir la pastille", texte: "👤 DG, 🏦 BANQUE, 🧾 COMPTABLE, 📱 FLOOZ ou 📱 MIXX/T-MONEY. **Rien d'autre ne s'affiche** que le relevé de cette caisse." },
        { titre: "Choisir la période", texte: "Le relevé se lit en quatre cases : **Solde au début** (tout ce qui précède), **+ Entrées de la période**, **− Sorties de la période**, **Solde à la fin**." },
        { titre: "Lire les mouvements", texte: "Date, mouvement (ENTRÉE en vert, SORTIE en rouge), boutique, montant. L'écran montre **les 100 plus récents** et le dit s'il y en a plus." },
        { titre: "🖨 Imprimer le relevé (PDF) / Exporter (CSV)", texte: "Le même relevé, même période, mêmes chiffres, avec **tous** les mouvements. À remettre au comptable." },
      ]],
      ["table", { entetes: ["Pastille", "Ce qui entre", "Ce qui sort"], largeurs: [1900, 3700, 3700], lignes: [
        ["👤 DG — caisse de BMI chez le DG", "Les versements « Chez le DG » **validés**, les fonds de caisse repris, ses apports.", "Les dépenses « payées avec de l'argent remis par le DG », les fonds de caisse remis, les avances remboursées par lui, ses prélèvements. **Jamais négative.**"],
        ["👤 DG — 📒 compte de l'exploitant", "Ses **apports** (et ce qu'il a payé de sa poche).", "Ses **prélèvements**. Peut être négatif : la phrase sous le solde le dit."],
        ["🏦 BANQUE", "Les versements « BANQUE » validés.", "Les dépenses payées par virement bancaire."],
        ["🧾 COMPTABLE", "Les versements qu'il a pointés « Encaissé ».", "Ce qu'il a pointé « Remis ». Ce qui attend son pointage est dit à part."],
        ["📱 FLOOZ / MIXX", "Les ventes et règlements de dettes encaissés par ce moyen.", "Les dépenses payées par ce moyen, les versements partis de ce compte."],
      ]}],
      ["attention", "**Le solde d'un compte mobile vient des SAISIES**, pas du téléphone. S'il diffère du solde lu sur le téléphone, un mouvement n'a pas été saisi."],

      ["h3", "C. L'apport et le prélèvement du DG (administrateur principal)"],
      ["etapes", [
        { titre: "➕ Apport ou ➖ Prélèvement", texte: "Pastille 👤 DG. Montant, **date** (libre, jamais dans le futur), un mot ou un **motif obligatoire**." },
        { titre: "Confirmer", texte: "La fenêtre redit ce que c'est : un apport est l'argent du DG mis dans BMI ; un prélèvement est l'argent de BMI pris pour lui. **Ni l'un ni l'autre n'est une dépense.**" },
      ]],
      ["note", "**On ne prélève pas plus que la caisse de BMI chez le DG.** Rien ne s'efface : une erreur se corrige par le geste inverse."],

      ["h3", "D. Les exports et le journal comptable"],
      ["p", "Bas du tableau de bord, « Exporter les données (Excel / CSV) » : **Ventes**, **Dépenses**, **Versements**, **Dettes**, **Stocks** (classé par boutique, catégorie, puis le plus urgent) et **📒 Journal comptable (SYSCOHADA)**. Les fichiers suivent la pastille choisie et l'espace regardé. Le journal couvre **la période choisie** : ventes, dépenses, règlements de dettes, apports et prélèvements du DG, en partie double."],

      ["h3", "E. La rentabilité par produit"],
      ["etapes", [
        { titre: "Période et tri", texte: "Aujourd'hui, Cette semaine, **Ce mois** (d'office), Cette année ; trier par Marge, Taux de marge, Chiffre d'affaires ou Quantités vendues." },
        { titre: "Les cartes", texte: "**Chiffre d'affaires**, **Marge brute**, **Taux de marge global** (ambre sous 15 %), **Capital dormant** ; et le **Coût des échanges garantie (SAV)** s'il y en a eu." },
        { titre: "« Produits vendus — … »", texte: "Par article : catégorie, vendus, CA, coût, **marge** (rouge si négative), **taux** (orange sous 15 %). Ligne TOTAL. **📄 Exporter.**" },
        { titre: "« 😴 Produits dormants »", texte: "Les articles **en stock mais pas vendus** sur la période, du plus lourd au plus léger, avec la valeur immobilisée au prix d'achat. Les 25 plus lourds sont listés ; le titre le dit s'il y en a plus." },
      ]],
      ["regle", "**La marge = prix auquel l'article a été vendu** (remises déduites, articles repris retirés) **− son prix d'achat ACTUEL**, celui de sa fiche. Si le prix d'achat a changé depuis la vente, la marge d'une vente ancienne se recalcule avec le nouveau."],
      ["note", "Un article **sans prix d'achat** sur sa fiche passerait à 100 % de marge : l'écran le DIT en ambre, avec le nom de l'article, comme le tableau de bord."],

      ["h3", "F. Retrouver un geste dans l'historique"],
      ["etapes", [
        { titre: "🕘 Historique", texte: "Les 500 dernières actions, la plus récente en haut : date et heure, utilisateur, action." },
        { titre: "Rechercher", texte: "Un nom, un mot de l'action (« clôture », « dépense », le nom d'un client) : la liste se resserre." },
      ]],
      ["p", "Chaque vente, dépense, dette, mouvement de stock, clôture et geste sur les comptes y laisse sa ligne, avec l'utilisateur et l'heure. **Rien ne s'y modifie.**"],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton", "Où", "Ce qu'il fait"], largeurs: [2900, 2200, 4200], lignes: [
        ["TOUTES / une pastille", "📊 Tableau de bord", "Tout l'écran ne compte que la boutique ou la caisse choisie."],
        ["Période : (et Personnalisée)", "📊 Tableau de bord", "Commande les cartes de la période, le Top 5, la répartition, les relevés et le journal."],
        ["🖨 Imprimer le relevé (PDF)", "Une pastille de caisse", "Le relevé imprimable, tous les mouvements."],
        ["Exporter (CSV)", "Une pastille de caisse", "Le même relevé pour Excel."],
        ["➕ Apport / ➖ Prélèvement", "👤 DG", "Le compte de l'exploitant (principal seul)."],
        ["Ventes, Dépenses, Versements, Dettes, Stocks", "Bas du tableau de bord", "Les fichiers Excel de ce qui est affiché."],
        ["📒 Journal comptable (SYSCOHADA)", "Bas du tableau de bord", "Les écritures de la période, pour le comptable."],
        ["Période / Trier par", "📈 Rentabilité", "La période et l'ordre du tableau."],
        ["📄 Exporter", "📈 Rentabilité", "Le tableau des marges en Excel."],
        ["Rechercher (utilisateur, action)…", "🕘 Historique", "Filtre le journal."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Les chiffres se recalculent** à chaque ouverture, depuis les ventes, dépenses, dettes et versements : rien n'est rangé à part, donc rien ne peut « se désynchroniser ».",
        "**Le chiffre d'affaires** retire les remises, le rabais du commercial et les articles repris ; il ne compte ni les articles **hors boutique (HB)**, ni les frais d'installation et de transport (ils ont leur carte).",
        "**Seules les dépenses qui comptent** entrent : une dépense en attente du DG ou rejetée n'y est pas. **Un versement n'est jamais une dépense** : il a son export à part.",
        "**Une vente à crédit** compte dans les ventes dès qu'elle est faite ; ce qui reste dû est dans « Dettes ».",
        "**Les caisses se lisent, elles ne s'écrivent pas** : un versement validé fait monter 👤 DG ou 🏦 BANQUE, une dépense « payée avec » le fait descendre. Une dépense payée de la poche du DG au-delà de sa caisse devient un **apport automatique**.",
        "**L'historique s'écrit tout seul**, à chaque geste enregistré, avec l'espace (réel ou formation) dans lequel il a été fait.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**💰 Ventes** (chapitre 5) : les ventes, leurs remises, leurs reprises.",
        "**🔒 Caisse** (chapitre 6) : les versements vers le DG, la banque, le comptable ; leur validation fait bouger les relevés.",
        "**🧾 Dettes** (chapitre 7) : « Total des dettes », « Dettes en cours », les règlements dans le journal.",
        "**📦 Stocks** (chapitre 8) : la valeur du stock, les alertes, l'export Stocks, les produits dormants.",
        "**🚚 Fournisseurs** (chapitre 10) : le prix d'achat de la fiche fait la marge.",
        "**Commissions et primes** (chapitre 16) : les commissions dues et payées.",
        "**📤 Dépenses** (chapitre 17) : les dépenses, leur validation, « Payé avec ».",
        "**⚙ Paramètres** (chapitre 23) : 👁 Je regarde, les numéros Flooz et Mixx de chaque boutique.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Chaque matin : **Ventes — Aujourd'hui** correspond à ce que les boutiques annoncent.",
        "Chaque semaine : le relevé **📱 FLOOZ / MIXX** de chaque boutique égale le solde lu sur le téléphone.",
        "Chaque mois : le relevé **🏦 BANQUE** égale le relevé de la banque ; le relevé **🧾 COMPTABLE** égale ce que le comptable a en main.",
        "Chaque mois : la **📈 Rentabilité** — un taux de marge en orange ou une marge rouge veut dire un prix d'achat ou de vente à revoir.",
        "Chaque mois : les **😴 Produits dormants** — l'argent immobilisé.",
        "En cas de doute : **🕘 Historique** dit qui a fait le geste, et quand.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["Erreur", "Ce qu'il faut faire"], largeurs: [4200, 5100], lignes: [
        ["Croire que la première rangée de cartes suit la période.", "Non : elle compte **depuis le début**. Ce sont les cartes « Ventes — … », « Dépenses — … », « Résultat — … » qui suivent la période."],
        ["Regarder le tableau de bord avec une boutique choisie et croire voir toute l'entreprise.", "Revenir sur **TOUTES**. Le choix est gardé d'une fois sur l'autre."],
        ["Chercher une dépense en attente du DG dans les totaux.", "Elle n'y est pas tant qu'elle n'est pas validée (chapitre 17)."],
        ["Lire un versement comme une dépense.", "Un versement est un déplacement d'argent, pas une charge : il est dans l'export « Versements » et dans les relevés."],
        ["Un solde Flooz qui ne correspond pas au téléphone.", "Chercher la saisie manquante (une vente, une dépense, un versement par ce moyen)."],
        ["Croire que le Résultat vaut « ventes moins dépenses ».", "Il retire aussi le **prix d'achat des articles vendus**, et laisse de côté les achats de marchandises. La ligne sous les cartes donne les trois chiffres."],
        ["Laisser l'avertissement ambre « sans prix d'achat ».", "Le résultat est trop beau tant qu'il est là : renseigner le prix d'achat des articles nommés (📦 Stocks → ✏️ Corriger)."],
        ["Prendre de l'argent chez le DG en le saisissant comme une dépense.", "C'est un **➖ Prélèvement**, pas une dépense : il ne baisse pas le résultat."],
        ["Être en formation et croire lire les vrais chiffres.", "Le bandeau ambre le dit. Revenir au réel par ⚙ Paramètres → 👁 Je regarde."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Le DG veut savoir ce qu'il reste sur le T-Money de DEMAKPOE.", reponse: "Pastille **📱 MIXX/T-MONEY**, période « Depuis le début » : **Solde à la fin**. La colonne Boutique dit quel numéro." },
        { situation: "Une vente de 2 panneaux à 100 000 F avec 20 000 F de remise générale.", reponse: "Le Top 5 et la Rentabilité comptent **180 000 F** pour cet article : la remise est répartie sur les articles." },
        { situation: "Aujourd'hui : 195 000 F de ventes, dont 2 panneaux achetés 60 000 F pièce ; 10 000 F de carburant et 50 000 F d'achat de marchandises.", reponse: "**Résultat = 195 000 − 120 000 − 10 000 = 65 000 F.** Les 50 000 F d'achat de marchandises n'y sont pas : le prix d'achat des panneaux les compte déjà." },
        { situation: "Le comptable demande les écritures de septembre.", reponse: "Pastille **TOUTES**, Période **Personnalisée** du 1er au 30 septembre, **📒 Journal comptable (SYSCOHADA)**." },
        { situation: "Le DG a payé 30 000 F de carburant pour BMI de sa poche, et sa caisse BMI est vide.", reponse: "La dépense « payée avec de l'argent remis par le DG » devient toute seule un **apport** de 30 000 F dans son compte de l'exploitant." },
        { situation: "Un article à 50 000 F en stock depuis trois mois n'apparaît pas dans « Produits vendus ».", reponse: "Il est dans **😴 Produits dormants**, avec sa valeur immobilisée au prix d'achat." },
        { situation: "Un client dit qu'une remise lui a été accordée sans accord.", reponse: "**🕘 Historique**, rechercher son nom : la vente, l'heure, et qui l'a enregistrée." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "Dans l'espace de formation :"],
      ["ol", [
        "Ouvrir 📊 Tableau de bord ; lire Ventes, Dépenses, Résultat d'Aujourd'hui puis de Ce mois.",
        "Choisir une boutique d'entraînement, puis revenir sur TOUTES.",
        "Ouvrir un relevé de caisse, changer la période, imprimer le relevé.",
        "Exporter les ventes et le journal comptable de la semaine.",
        "Ouvrir 📈 Rentabilité ; trier par taux de marge ; trouver l'article le moins rentable.",
        "Ouvrir 🕘 Historique et retrouver la dernière vente faite.",
      ]],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "lit les cartes du tableau de bord et dit lesquelles suivent la période ;",
        "lit et imprime le relevé d'une caisse ;",
        "sort le journal comptable d'une période choisie ;",
        "explique la marge d'un article et ce qu'est un produit dormant ;",
        "retrouve un geste dans l'historique.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Qui a les onglets 📊, 📈 et 🕘 ? Qui voit les pastilles 👤 DG et 🏦 BANQUE ?",
        "Quelles cartes suivent la période ? Lesquelles comptent depuis le début ?",
        "Une dépense en attente du DG compte-t-elle dans le tableau de bord ?",
        "Un versement est-il une dépense ?",
        "D'où vient le solde d'un compte Flooz ?",
        "Quelle est la différence entre un apport et un prélèvement ?",
        "Quel prix d'achat sert à calculer la marge ?",
        "Combien d'actions l'historique montre-t-il ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Lit le tableau de bord et la période",
      "Choisit une boutique, une caisse, revient sur TOUTES",
      "Lit, imprime et exporte un relevé",
      "Sort les exports et le journal comptable",
      "Explique la marge et les produits dormants",
      "Retrouve un geste dans l'historique",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
