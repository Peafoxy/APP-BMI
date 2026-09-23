// ============================================================
// MANUEL DE FORMATION — CHAPITRE 8 : Stocks
//
// Des MOTS, rien d'autre. Chaque bouton, chaque règle vient du code :
// screens/Stocks.jsx (les cinq carrés, ⚠ À réapprovisionner, le formulaire
// « Nouvel article », ✏️ Corriger et CHAMPS_CORRIGEABLES, + Entrée,
// ± Ajuster, ⇄ Transfert, Suppr., Code, 🖨 Étiquette, 📋 Faire l'inventaire,
// 🔧 Défectueux / SAV, le tableau, Derniers mouvements, l'import Excel),
// lib/calculs.js (stockActuel = initial + entrées − vendus + ajustements,
// stockVendu, stockAjuste, articlesAReapprovisionner, alertesBoutiques,
// articlesSimilaires, refusMouvementEntreEspaces, ROLES_STOCK,
// domainesDefinis, famillesDuDomaine, estDepot, retoursEnSav),
// lib/transfertsStock.js (critiqueEnvoi, critiqueValidation, TRF-…),
// lib/importStock.js (COLONNES_IMPORT, MODES_IMPORT, resumeImport,
// resumeEntrees), lib/impression.js (imprimerEtiquetteProduit : 60 × 30 mm,
// largeurBarreMm, BARRE_LA_PLUS_FINE_MM, LONGUEUR_MAX_CODE = 17),
// lib/pompes.js (estPompe, CHAMPS_POMPE, ficheLisible), lib/notifications.js
// (« ⚠ Stock au seuil — BOUTIQUE »), screens/Ravitaillement.jsx
// (📦 Transferts de stock à valider : « ✅ Valider la réception »).
// ============================================================
export const CHAPITRE = {
  numero: 8,
  titre: "Stocks",
  sousTitre: "Créer et corriger un article, enregistrer ce qui entre, ajuster, compter, lire ce qu'il faut réapprovisionner — et pourquoi un stock juste vaut plus qu'un stock plein",
  public: "Magasinier, gérant, administrateur ; comptable en lecture",
  duree: "1 h 30, puis l'exercice en espace formation",
  prerequis: "Le chapitre 1 (se connecter). Le chapitre 5 (les ventes) aide à comprendre d'où viennent les « Vendus ». Le chapitre 9 prend la suite : ravitaillement et transferts.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "lire l'écran 📦 Stocks : les carrés du haut, la liste **⚠ À réapprovisionner**, le tableau et sa formule **Initial + Entrées − Vendus + Ajustements = Stock** ;",
        "**créer une fiche d'article** complète (fournisseur, domaine, catégorie, seuil, prix, code-barres, garanties), et reprendre en un clic une fiche qui existe déjà dans une autre boutique ;",
        "**corriger** une fiche sans rien perdre, et savoir ce qui reste réservé à l'administrateur ;",
        "enregistrer une **entrée** de marchandise, un **ajustement** avec son motif, et faire un **inventaire** qui aligne le stock sur le comptage ;",
        "poser un **code-barres** et imprimer une **étiquette** ; importer un fichier Excel ;",
        "savoir ce que deviennent les **articles défectueux** rendus sous garantie, et ce que les cinq renseignements d'une **pompe** changent.",
      ]],
      ["regle", "**Le stock est calculé, jamais tapé.** Ce qu'il y a en rayon = ce qui est entré − ce qui est vendu ± ce qui a été ajusté. On ne « change » pas un stock : on enregistre une entrée, un ajustement motivé, ou un inventaire. C'est ce qui permet de savoir, des mois après, pourquoi un chiffre a bougé."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [5200, 4100], lignes: [
        ["Ouvrir 📦 Stocks, lire les carrés, le tableau, les mouvements", "Magasinier, gérant, administrateur, comptable (en lecture seule). **Le vendeur n'a pas l'onglet** : il voit le stock dans la fenêtre « Rechercher un article » de 💰 Ventes (prix en bleu, « dispo »)."],
        ["« Ajouter à BOUTIQUE » (une fiche d'article), « ✏️ Corriger » le nom, le fournisseur, la catégorie, le seuil, le code, les garanties", "Magasinier, gérant, administrateur"],
        ["Corriger la **quantité initiale**, le **prix d'achat**, le **prix de vente**", "**L'administrateur seul** — les cases sont grisées pour les autres : « 🔒 Quantité initiale et prix : réservés à l'administrateur. Vous pouvez corriger le reste. »"],
        ["« + Entrée », « ± Ajuster », « ⇄ Transfert », « 📋 Faire l'inventaire », valider un bon de ravitaillement, valider un transfert reçu", "**Magasinier, gérant, administrateur** — le serveur applique la même règle"],
        ["« Suppr. » un article", "**L'administrateur seul**, et seulement si l'article n'a **aucune vente** enregistrée"],
        ["🔧 Défectueux / SAV : « 📦 Renvoyé au fournisseur », « 🗑 Rebut »", "**L'administrateur seul** (le cadre ne s'affiche que pour lui)"],
        ["« Code », « 🖨 Étiquette », changer le fournisseur d'un article, importer un fichier", "Magasinier, gérant, administrateur"],
        ["Créer un domaine de produits, une boutique, un magasin", "L'administrateur, dans ⚙ Paramètres (chapitre 23)"],
      ]}],
      ["note", "Un magasinier ou un gérant **rattaché à un site** ne voit que le stock de sa boutique ou de son magasin, sans pastille de choix (« 🏭 Magasin : … » ou « 🏪 Boutique : … » en haut). L'administrateur choisit le site en haut ; TERRAIN n'apparaît jamais, elle ne détient pas de stock."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3300, 6000], lignes: [
        ["**📦 Stocks**, les carrés", "Articles référencés · Unités en stock · Valeur du stock (au prix d'achat) · À réapprovisionner · (magasin) Sorties ce mois."],
        ["**📦 Stocks**, cadre « ⚠ À réapprovisionner (N) »", "Tous les articles au seuil ou en dessous, du plus urgent au moins urgent : Article · Catégorie · Fournisseur · Reste · Seuil · Manque. « 📤 Exporter », et sur une boutique « 🚚 Demander ce ravitaillement »."],
        ["**📦 Stocks**, cadres des mouvements entre sites", "« ⏳ Transferts de stock envoyés, en attente de validation » (Annuler) ; « 📦 Transferts de stock à valider » (✅ Valider la réception · Refuser) ; sur un **magasin** : « 📥 Demandes des boutiques » (📋 Préparer le bon · Refuser), « ⚠ Alertes de stock dans les boutiques », « 🚚 Ravitailler une boutique depuis 🏭 … » ; sur une **boutique** : la demande de ravitaillement au magasin. Tout cela est le chapitre 9."],
        ["**📦 Stocks**, cadre « Nouvel article dans BOUTIQUE »", "Nom · Fournisseur · Domaine · Catégorie · Initial · Seuil · Prix achat (F) · Prix vente (F) · Code-barres (facultatif) · (batterie, convertisseur) Tension · « ▸ Autres informations (garanties, notes...) » · (pompe) 💧 Caractéristiques de la pompe · « Ajouter à BOUTIQUE » · « 📥 Importer un fichier Excel » · « 📄 Modèle Excel » · « 📋 Coller du texte ». Le même cadre devient « ✏️ Correction de « … » » avec « ✅ Enregistrer la correction » / « Annuler »."],
        ["**📦 Stocks**, « 📋 Inventaire physique »", "Article · Stock théorique · Quantité comptée · Écart · Valeur écart ; « ✅ Valider l'inventaire » / « Annuler »."],
        ["**📦 Stocks**, « 🔧 Défectueux / SAV »", "Administrateur : les articles rendus en panne lors d'un 🔁 Retour, « 📦 Renvoyé au fournisseur » / « 🗑 Rebut »."],
        ["**📦 Stocks**, le tableau « Stocks — BOUTIQUE »", "« Catégorie : Toutes (N) », « 📋 Faire l'inventaire », « 🔍 Rechercher un article par son nom… » ; colonnes Article (figée) · Fournisseur · Catégorie · Code · Initial · Entrées · Vendus · Ajust. · Stock · Seuil · État · P. achat · P. vente · boutons ✏️ Corriger · Code · 🖨 Étiquette · + Entrée · ± Ajuster · ⇄ Transfert · Suppr."],
        ["**📦 Stocks**, « Derniers mouvements — BOUTIQUE »", "Les 20 derniers ajustements : Date · Article · Qté · Motif · Par."],
        ["**💰 Ventes**", "La fenêtre « 🔍 Rechercher un article » lit ce stock (« dispo : N ») ; la vente le fait baisser (chapitre 5)."],
        ["**⚙ Paramètres**", "Les domaines de produits et leurs familles, les boutiques et magasins, le prix du rail et la longueur d'une barre (chapitre 23)."],
        ["**📊 Tableau de bord**", "L'export « Stocks » classé par boutique, catégorie et urgence (chapitre 22)."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Créer un article"],
      ["etapes", [
        { titre: "Taper le nom", texte: "Dès la première lettre, l'application propose **les articles du même nom déjà enregistrés ailleurs** (une liste sous la case). Ses boutiques vendent le même matériel : c'est le cas normal, pas une anomalie. **Un clic reprend toute la fiche** — fournisseur, domaine, catégorie, seuil, prix, code, garanties — sauf la quantité initiale, propre à chaque boutique. On peut ensuite changer ce qu'on veut : le clic sert de modèle, il ne corrige jamais la fiche d'origine." },
        { titre: "Fournisseur, Domaine, Catégorie", texte: "Le fournisseur se choisit dans la liste de 🚚 Fournisseurs (chapitre 10) — « — Aucun — » sinon. Le domaine (solaire, forage, vidéo…) vient de ⚙ Paramètres ; choisi, il propose **ses familles** dans Catégorie ; sans domaine, toutes les familles connues. La catégorie reste une saisie libre assistée." },
        { titre: "Initial, Seuil, Prix", texte: "**Initial** = ce qu'il y a en rayon au moment où on crée la fiche. **Seuil** = la quantité en dessous de laquelle l'article passe « ⚠ Réappro. » et déclenche la notification. **Prix achat** sert à la valeur du stock et aux marges ; **Prix vente** est pré-rempli dans 💰 Ventes." },
        { titre: "Code-barres, Tension, Autres informations", texte: "Code-barres (facultatif) : on scanne dans la case ou on tape. Pour une **batterie ou un convertisseur**, une case Tension (12V · 24V · 48V) apparaît. « ▸ Autres informations » ouvre 🏪 Garantie boutique (imprimée sur le reçu), 🏭 Garantie fabricant (pour le devis, le contrat, le SAV), 📄 Conditions de garantie, 🔗 Fiche technique (un lien), 📝 Notes internes." },
        { titre: "Une pompe", texte: "Si la catégorie contient le mot « pompe », le cadre « 💧 Caractéristiques de la pompe » apparaît : Puissance (kW), Profondeur max (m), Débit max (m³/h), Tension (V), case « Hybride (solaire + secteur) ». Le débit maximal est celui **en surface** : le débit réel à une hauteur donnée se lit sur la fiche du fabricant. Ces renseignements s'affichent ensuite partout où on choisit l'article, et sur le devis." },
        { titre: "« Ajouter à BOUTIQUE »", texte: "Sans nom : « Veuillez saisir un nom d'article. » Si le nom existe déjà **dans cette boutique** : une ligne ambre le dit avant, et le bouton refuse (« … existe déjà dans BOUTIQUE. Pour modifier sa fiche, utilisez ✏️ Corriger… »). Jamais deux fiches pour le même article au même endroit : le stock serait coupé en deux. Sinon « Article ajouté ! »." },
      ]],
      ["h3", "B. Corriger une fiche"],
      ["etapes", [
        { titre: "✏️ Corriger sur la ligne", texte: "Le formulaire du haut se remplit avec la fiche et devient « ✏️ Correction de « … » ». Le volet des garanties s'ouvre tout seul s'il contient déjà quelque chose. Pour le magasinier et le gérant, Initial et les deux prix sont grisés." },
        { titre: "« ✅ Enregistrer la correction »", texte: "Rien de changé : « Rien n'a été modifié. » Sinon la confirmation liste **champ par champ** ce qui change (« Seuil d'alerte : 3 → 5 », « Profondeur max : 0 m → 95 m », chaque mesure avec son unité, les prix en francs) et ajoute **À SAVOIR** : un nom changé garde l'ancien nom sur les reçus déjà émis ; une quantité initiale changée dit le stock avant et après ; un prix d'achat changé recalcule les marges des ventes passées. Puis « Article corrigé. » et une ligne de journal." },
        { titre: "Ce qui ne se corrige pas ici", texte: "Les **Entrées** : elles viennent de « + Entrée » et des ravitaillements. Le stock lui-même : il est calculé." },
      ]],
      ["h3", "C. Une entrée, un ajustement"],
      ["etapes", [
        { titre: "« + Entrée »", texte: "De la marchandise reçue **pour un article existant** (un achat livré, un retour). « Quantité reçue pour « … » : » → la colonne Entrées monte, le stock aussi. Journal : « Entrée stock +10 « … » — BOUTIQUE ». Pour toute une livraison d'un coup : « 📥 Importer un fichier Excel » en mode « ➕ Entrées de stock »." },
        { titre: "« ± Ajuster »", texte: "Une correction du réel, dans les deux sens : « Quantité (+ pour ajouter, − pour retirer, ex : -2) », puis **« Motif : »** (casse, perte, erreur de saisie, don…). Le mouvement apparaît dans « Derniers mouvements » avec son motif et son auteur, et dans la colonne Ajust. **Ce n'est pas une vente** : rien n'entre en caisse." },
        { titre: "Ce qu'une entrée n'est pas", texte: "Un article qui **arrive du magasin** n'est pas une « + Entrée » : c'est le ravitaillement qui l'écrit (chapitre 9), sinon il serait compté deux fois." },
      ]],
      ["h3", "D. L'inventaire"],
      ["etapes", [
        { titre: "« 📋 Faire l'inventaire »", texte: "Le cadre « 📋 Inventaire physique — BOUTIQUE » liste tous les articles du site avec leur **Stock théorique**. « Comptez les articles un par un et saisissez la quantité réelle. Laissez vide ce que vous ne comptez pas. » L'écart s'affiche au fur et à mesure (rouge = manquant, ambre = excédent) avec sa valeur au prix d'achat." },
        { titre: "« ✅ Valider l'inventaire »", texte: "Sans aucune quantité saisie : « Saisissez au moins une quantité comptée. » Aucun écart : on propose d'enregistrer quand même l'inventaire dans l'historique. Des écarts : la confirmation récapitule (« N article(s) comptés, N écart(s) : N manquant(s), N excédent(s), Valeur de l'écart : … », les huit premiers détaillés) et prévient : **« Le stock sera aligné sur le comptage (ajustements définitifs). »** Chaque écart devient un ajustement « Inventaire du … (théorique X → compté Y) »." },
        { titre: "Après", texte: "« ✅ Inventaire validé. N ajustement(s) enregistré(s). » Les articles non comptés n'ont pas bougé. Un inventaire ne se défait pas : une erreur se corrige par un nouvel ajustement, avec son motif." },
      ]],
      ["h3", "E. Code-barres et étiquette"],
      ["etapes", [
        { titre: "« Code »", texte: "« Code-barres de « … » (scannez dans le champ) : » — le lecteur tape le code, ou on le saisit. Vide = retiré. Un article garde **toujours le même code**, quelle que soit la quantité : c'est l'identifiant du modèle, pas un numéro de série." },
        { titre: "« 🖨 Étiquette »", texte: "Une étiquette **60 × 30 mm** : la boutique en haut, l'article en bas, le code-barres au milieu. Sans code, l'application en fabrique un (ART… sur 12 caractères) et l'enregistre. Un code de **plus de 17 caractères** fait des barres trop fines : l'écran prévient (« … ses barres ne feront que 0,22 mm — en dessous de 0,25 mm, un lecteur ordinaire commence à refuser… ») et propose de raccourcir avec « Code »." },
      ]],
      ["h3", "F. Importer un fichier"],
      ["etapes", [
        { titre: "« 📄 Modèle Excel »", texte: "Deux modèles : **📦 Nouveaux articles** (colonnes Nom, Fournisseur, Domaine, Catégorie, Initial, Seuil, Prix d'achat, Prix de vente) ou **➕ Entrées de stock** (Nom, Quantité reçue, Prix d'achat facultatif). L'ordre des colonnes est libre, les titres se reconnaissent sans accents ni majuscules." },
        { titre: "« 📥 Importer un fichier Excel »", texte: "On choisit le fichier (.xlsx ou .csv), on dit ce qu'il contient. **Une feuille par boutique** : si le fichier en a plusieurs, seule la première est lue, et l'écran le dit. La confirmation nomme ce qui sera créé, **et chaque ligne refusée avec sa raison** — on ne découvre pas un manque des semaines plus tard. Un article déjà présent dans la boutique n'est pas créé en double." },
        { titre: "« 📋 Coller du texte »", texte: "La même chose en collant des lignes (un copier-coller depuis Excel marche), dans l'ordre des colonnes indiqué ; « Laissez vide entre deux virgules ce que vous ne connaissez pas. »" },
      ]],
      ["h3", "G. Le défectueux (administrateur)"],
      ["etapes", [
        { titre: "Le cadre « 🔧 Défectueux / SAV »", texte: "Il n'apparaît que s'il y a des articles rendus en panne lors d'un **🔁 Retour** sous garantie (chapitre 5). Ils **ne sont pas dans le stock vendable** : la ligne dit la quantité, l'article, la référence RET-… et la panne." },
        { titre: "Leur sort", texte: "« 📦 Renvoyé au fournisseur » (garantie fabricant) ou « 🗑 Rebut » (irrécupérable). Confirmation, ligne de journal « 🔧 SAV RET-… ». Aucun des deux ne remet l'article en rayon." },
      ]],
    ]},

    // ── 5
    { titre: "Explication de chaque bouton et champ", blocs: [
      ["h3", "Les carrés et la liste à réapprovisionner"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Articles référencés / Unités en stock", "Le nombre de fiches du site, et la somme des stocks."],
        ["Valeur du stock", "Somme de stock × prix d'achat. C'est l'argent immobilisé en rayon."],
        ["À réapprovisionner", "Le nombre d'articles au seuil ou en dessous — rouge s'il y en a."],
        ["Sorties ce mois", "Magasin seulement : les unités parties en ravitaillement ce mois-ci."],
        ["⚠ À réapprovisionner (N)", "La liste complète, **du plus urgent au moins urgent** (le plus loin sous son seuil d'abord). Reste en rouge à 0, en orange sinon. « Manque = seuil − reste » (au moins 1) : la quantité proposée dans la demande. Cadre de dix lignes qui défile, colonne Article figée."],
        ["📤 Exporter", "La liste en fichier (Boutique, Article, Catégorie, Fournisseur, Reste, Seuil, Manque)."],
        ["🚚 Demander ce ravitaillement", "Boutique seulement, s'il existe un magasin : pré-remplit la demande au magasin avec les manques, modifiable avant l'envoi (chapitre 9)."],
      ]}],
      ["h3", "Le formulaire d'article"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Nom", "Obligatoire. Les articles du même nom ailleurs se proposent dès la première lettre ; « ⚠ Existe déjà dans BOUTIQUE » s'il est déjà là."],
        ["Fournisseur", "La liste de 🚚 Fournisseurs de l'espace regardé. Se change aussi sur la ligne du tableau (« — Définir — »), où un nom absent de la liste est refusé."],
        ["Domaine / Catégorie", "Le métier (⚙ Paramètres) et la famille. Le domaine choisi ne montre que ses familles, plus les catégories des articles déjà rangés dans ce domaine."],
        ["Initial", "Le stock au moment de la création. Corrigeable ensuite par l'administrateur seul."],
        ["Seuil", "Déclenche « ⚠ Réappro. », la liste à réapprovisionner, les alertes du magasin et la notification. À 0, l'article n'est jamais en alerte."],
        ["Prix achat (F) / Prix vente (F)", "Administrateur seul en correction. Le prix de vente est celui proposé au comptoir et sur les devis sans calcul."],
        ["Code-barres (facultatif)", "Scanné ou tapé. Sert au lecteur de 💰 Ventes et à l'étiquette."],
        ["Tension — batterie/convertisseur", "N'apparaît que si la catégorie parle de batterie, lithium, convertisseur, onduleur… 12V · 24V · 48V. Sert au dimensionnement solaire."],
        ["💧 Caractéristiques de la pompe", "Catégorie « pompe » seulement : puissance, profondeur max, débit max (en surface), tension, hybride. Lisibles sous le nom dans le tableau, dans « Rechercher un article » et sur le devis ; c'est ce que lit « 💧 Quelle pompe pour ce forage ? » (chapitre 12)."],
        ["🏪 Garantie boutique", "Imprimée sur le reçu et la facture, à côté de l'article, si elle est renseignée."],
        ["🏭 Garantie fabricant / 📄 Conditions", "Pour le devis, le contrat et le SAV — jamais sur le reçu."],
        ["🔗 Fiche technique / 📝 Notes internes", "Un lien et un texte, lisibles sous le nom dans le tableau."],
        ["Ajouter à BOUTIQUE", "Crée la fiche dans le site regardé. Une fiche par site : le même article dans deux boutiques = deux fiches, deux stocks."],
        ["📥 Importer un fichier Excel / 📄 Modèle Excel / 📋 Coller du texte", "Voir la procédure F."],
      ]}],
      ["h3", "Le tableau"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Catégorie : Toutes (N)", "Une liste déroulante, ordre alphabétique, le nombre d'articles de chaque catégorie. « Toutes » d'office."],
        ["🔍 Rechercher un article par son nom", "Par le nom ou le code, toutes catégories confondues ; le nombre de résultats s'affiche dessous."],
        ["Initial · Entrées · Vendus · Ajust. · Stock", "La formule, colonne par colonne : Initial + Entrées − Vendus + Ajust. = **Stock** (en gras). Ajust. en rouge si négatif."],
        ["Seuil · État", "« ⚠ Réappro. » en rouge (ligne rose) quand Stock ≤ Seuil, « OK » sinon."],
        ["P. achat · P. vente", "Les deux prix de la fiche."],
        ["✏️ Corriger", "Ouvre la fiche dans le formulaire du haut."],
        ["Code / 🖨 Étiquette", "Poser ou retirer le code-barres ; imprimer l'étiquette 60 × 30 mm."],
        ["+ Entrée / ± Ajuster", "Marchandise reçue ; correction motivée dans les deux sens."],
        ["Transfert (le bouton de la ligne)", "Envoyer une quantité à une autre boutique **du même espace** : on choisit la boutique, la quantité (« disponible : N »), et l'envoi attend la validation de la boutique qui reçoit — l'article ne bouge pas avant (chapitre 9)."],
        ["Suppr.", "Administrateur seul ; refusé si l'article a des ventes (« Cet article a des ventes enregistrées : impossible de le supprimer. »). Un article qui ne se vend plus se met à 0 par ± Ajuster, il ne se supprime pas."],
        ["Derniers mouvements", "Les 20 derniers ajustements du site, avec leur motif et leur auteur : inventaire, ravitaillement, transfert, retour sous garantie, reprise, sortie de travaux…"],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Le stock est recalculé à chaque affichage** : Initial + Entrées − Vendus + Ajustements. « Vendus » vient des ventes encaissées (une proforma ne compte pas, une réservation ne compte qu'à la livraison) ; « Ajustements » regroupe tout le reste : ± Ajuster, inventaire, ravitaillement, transfert, reprise, retour sous garantie, sortie vers des 🛠 Travaux à crédit.",
        "**Le seuil déclenche une notification** le jour où l'article **passe** au seuil (pas tous les jours) : « ⚠ Stock au seuil — BOUTIQUE : Panneau 400W (reste 2)… À réapprovisionner. », aux vendeurs et au gérant de la boutique (au magasinier pour un magasin), plus les administrateurs.",
        "**Une fiche par site.** Un ravitaillement ou un transfert vers une boutique qui n'a pas encore l'article **crée sa fiche** (même nom, catégorie, seuil, prix, code) avec un initial à 0 : la marchandise arrive par un ajustement positif.",
        "**Le mur** : un transfert ou un ravitaillement entre une boutique réelle et une boutique d'entraînement est refusé (« 🚫 Mouvement impossible… La marchandise réelle et celle d'entraînement ne doivent jamais se mélanger »). Les fournisseurs proposés sont ceux de l'espace regardé. La proposition d'articles similaires ne montre que les boutiques que le compte a le droit de voir.",
        "**Un transfert de stock n'écrit rien avant la validation** de la boutique qui reçoit ; l'article reste vendable chez l'envoyeur, et la validation revérifie le stock (« Stock insuffisant chez … il a peut-être été vendu entre-temps »). Le numéro TRF-… n'existe qu'à cet instant. Un bon de ravitaillement, lui, sort du magasin et entre en boutique **à la validation du magasinier**, avec un numéro RAV-… et un bon imprimé (chapitre 9).",
        "**La correction garde l'histoire** : les ventes et les ajustements sont rattachés à l'identifiant de la fiche, pas à son nom. Un nom corrigé ne réécrit pas les reçus déjà émis ; un prix d'achat corrigé recalcule les marges passées (l'écran 📈 Rentabilité change) ; une quantité initiale corrigée déplace le stock d'autant, et la confirmation le dit.",
        "**Le retour sous garantie** (🔁 Retour, 💰 Ventes) sort l'article de remplacement par un ajustement « Échange garantie » et met le défectueux dans un stock SAV à part, jamais en rayon. Une ↩ Reprise remet l'article en stock normal.",
        "**Le rail solaire** : le stock compte des barres de 4,2 m ; le devis calcule en mètres, arrondit aux barres entamées et sort ce nombre de barres à l'encaissement (chapitre 11).",
        "**Le journal** (🕘 Historique) garde chaque fiche créée, chaque correction champ par champ, chaque entrée, chaque ajustement avec son motif, chaque inventaire (« N comptés, N écart(s), valeur … »), chaque import, chaque décision SAV.",
        "**La valeur du stock** entre dans l'export « Stocks » du tableau de bord, classé par boutique, catégorie et urgence.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**💰 Ventes** (chapitre 5) : la vente fait baisser « Vendus » ; le prix de vente et « dispo » viennent d'ici ; « Stock insuffisant » à l'encaissement propose réservation, ravitaillement ou transfert.",
        "**🚚 Ravitaillement / 🔁 Transfert** (chapitre 9) : la demande au magasin, le bon de ravitaillement, le transfert de stock validé par la boutique qui reçoit — tous écrivent des ajustements lisibles ici.",
        "**🚚 Fournisseurs** (chapitre 10) : la liste des fournisseurs et les entrées de marchandise.",
        "**☀️ Dimensionnement et devis sans calcul** (chapitres 11 et 12) : le stock de la boutique nourrit les propositions, la tension des batteries, les supports de rail, les pompes ; l'encaissement du devis sort le matériel.",
        "**🛠 Travaux à crédit** (chapitre 15) : sortir un article vers un chantier baisse le stock tout de suite (ajustement « sortie de travaux »).",
        "**🧾 Dettes** (chapitre 7) : une réservation prépayée ne sort le stock qu'à « 📦 Livrer ».",
        "**📊 Tableau de bord / 📈 Rentabilité** (chapitre 22) : la valeur du stock, l'export Stocks, les marges au prix d'achat.",
        "**⚙ Paramètres** (chapitre 23) : domaines et familles, boutiques et magasins, rail.",
        "**🔔 Notifications** : « ⚠ Stock au seuil ».",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Avant de créer un article, on a **cliqué la proposition** s'il existe ailleurs : même nom, même prix, même catégorie d'une boutique à l'autre.",
        "Chaque fiche a un **seuil** qui a un sens (0 = jamais d'alerte).",
        "Une marchandise reçue passe par **+ Entrée** (ou l'import « Entrées de stock »), jamais par ± Ajuster ni par Initial.",
        "Chaque **ajustement porte un motif** clair : on doit pouvoir le relire dans six mois.",
        "La liste **⚠ À réapprovisionner** est vide, ou la demande au magasin est partie.",
        "L'inventaire est fait **article par article, en rayon**, pas de mémoire ; les écarts sont expliqués avant de valider.",
        "Les codes-barres font **17 caractères ou moins** ; l'étiquette se scanne avant d'imprimer le rouleau.",
        "Le cadre **🔧 Défectueux / SAV** ne traîne pas : chaque article a reçu son sort.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3300], lignes: [
        ["Créer deux fois le même article dans la même boutique", "Refusé : « … existe déjà dans BOUTIQUE. Pour modifier sa fiche, utilisez ✏️ Corriger… »", "✏️ Corriger la fiche existante, ou donner un autre nom s'il s'agit vraiment d'un autre article."],
        ["Enregistrer une livraison en changeant « Initial »", "Le stock bouge sans trace de réception ; réservé à l'administrateur de toute façon.", "« + Entrée » sur la ligne, ou l'import « ➕ Entrées de stock »."],
        ["Corriger un prix en tant que gérant", "Les cases sont grisées : « 🔒 Quantité initiale et prix : réservés à l'administrateur. »", "Demander à l'administrateur."],
        ["Supprimer un article qui s'est déjà vendu", "« Cet article a des ventes enregistrées : impossible de le supprimer. »", "Le mettre à 0 par ± Ajuster avec un motif ; la fiche reste pour l'historique."],
        ["Ajuster sans motif", "Le motif vide devient « Ajustement » : personne ne saura pourquoi.", "Toujours écrire le motif (casse, perte, erreur…)."],
        ["Laisser le seuil à 0", "L'article n'est jamais en alerte, il disparaît des listes à réapprovisionner.", "Mettre un seuil réaliste sur chaque fiche."],
        ["Valider un inventaire de mémoire", "Les ajustements sont définitifs, à la valeur du prix d'achat.", "Compter en rayon ; laisser vide ce qu'on ne compte pas."],
        ["Transférer vers une boutique d'entraînement", "« 🚫 Mouvement impossible : … boutique réel … boutique entraînement »", "Les deux espaces ne se mélangent jamais."],
        ["Croire qu'un ⇄ Transfert a déplacé l'article", "« En attente de validation par … L'article reste dans le stock de … jusque-là. »", "La boutique qui reçoit valide dans 🔁 Transfert (chapitre 9) ; l'envoyeur peut annuler avant."],
        ["Un code-barres de 20 caractères", "Avertissement : barres trop fines, le lecteur refuse.", "Raccourcir avec « Code » (17 caractères au plus)."],
        ["Importer un classeur de trois feuilles", "« Seule la première, « … », sera lue — pour BOUTIQUE. Continuer ? »", "Une feuille par boutique : enregistrer chaque feuille à part, ou changer de boutique entre deux imports."],
        ["Chercher un article dans la mauvaise catégorie", "La recherche est « toutes catégories confondues » : elle trouve.", "Taper le nom dans 🔍 plutôt que dérouler les catégories."],
        ["Remplir la fiche d'une pompe dans « Notes »", "Le calcul de forage ne lit que les cinq cases du cadre 💧.", "Renseigner Puissance, Profondeur max, Débit max, Tension, Hybride — la catégorie doit contenir « pompe »."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "APESSITO reçoit pour la première fois un onduleur que DEMAKPOE vend déjà.", reponse: "Sur APESSITO, taper les premières lettres du nom : la fiche de DEMAKPOE se propose, un clic reprend tout (prix, catégorie, garanties, code). Saisir Initial = la quantité reçue, « Ajouter à APESSITO ». Deux fiches, deux stocks, mêmes prix." },
        { situation: "Le fournisseur livre 20 batteries pour une fiche qui existe.", reponse: "« + Entrée » sur la ligne → 20. La colonne Entrées monte de 20, le Stock aussi. Pour une livraison de trente références, « 📥 Importer un fichier Excel » → « ➕ Entrées de stock » avec le modèle." },
        { situation: "Une lampe est tombée du rayon et s'est cassée.", reponse: "« ± Ajuster » → « -1 » → Motif « cassée en rayon ». Ajust. passe à −1, le Stock baisse, « Derniers mouvements » garde qui, quand, pourquoi. Aucune vente, aucune caisse." },
        { situation: "Le gérant remarque que le nom d'une batterie est mal écrit (« BZTTERIE »).", reponse: "« ✏️ Corriger » → corriger le nom → « ✅ Enregistrer la correction ». La confirmation prévient que les reçus déjà émis gardent l'ancien nom. Le stock et l'historique suivent la fiche." },
        { situation: "Fin de mois : le magasinier compte son magasin.", reponse: "« 📋 Faire l'inventaire », saisir chaque quantité comptée en passant dans les rayons, laisser vide ce qui n'est pas compté. Lire les écarts et leur valeur ; « ✅ Valider l'inventaire » : chaque écart devient un ajustement « Inventaire du … ». Un manquant de valeur se signale à l'administrateur." },
        { situation: "Un article est à 2 pour un seuil de 5.", reponse: "La ligne est rose « ⚠ Réappro. », il est dans « ⚠ À réapprovisionner » avec Manque = 3, et la notification « ⚠ Stock au seuil » est partie le jour où il est passé à 5. Sur une boutique, « 🚚 Demander ce ravitaillement » prépare la demande au magasin avec 3." },
        { situation: "Un client rend un régulateur en panne, remplacé sous garantie dans 💰 Ventes.", reponse: "Le régulateur neuf est sorti du stock ; le défectueux apparaît dans « 🔧 Défectueux / SAV » (administrateur). Selon le cas : « 📦 Renvoyé au fournisseur » ou « 🗑 Rebut ». Il ne revient jamais en rayon." },
        { situation: "On renseigne une pompe « 0,4 kW / 95 m / 1,5 m³/h ».", reponse: "Catégorie contenant « pompe » → cadre 💧 : Puissance 0.4, Profondeur max 95, Débit max 1.5, Tension, Hybride si c'est le cas. La confirmation de correction écrit « Débit max : 0 m³/h → 1,5 m³/h » (jamais en francs). La fiche se lit sous le nom, et dans le devis de forage." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "**En espace formation**, avec un formateur qui regarde l'écran :"],
      ["ol", [
        "Créer un article **en reprenant une fiche proposée** (taper le début du nom, cliquer), mettre un Initial et un Seuil, « Ajouter ». Essayer de le créer une seconde fois : lire le refus.",
        "Créer un article **pompe** avec ses cinq renseignements ; montrer qu'ils se lisent sous le nom dans le tableau.",
        "Faire une **+ Entrée** de 10, puis un **± Ajuster** de −2 avec un motif ; lire les colonnes Entrées, Ajust., Stock, et « Derniers mouvements ».",
        "Corriger le **nom** et le **seuil** d'une fiche ; lire la confirmation champ par champ. Avec un compte gérant : montrer les cases de prix grisées.",
        "Mettre un seuil au-dessus du stock d'un article : montrer « ⚠ Réappro. », la liste « ⚠ À réapprovisionner » et le Manque ; « 📤 Exporter ».",
        "Faire un **inventaire** sur trois articles avec un écart ; lire le récapitulatif ; valider ; retrouver les ajustements « Inventaire du … ».",
        "Poser un **Code** et imprimer une **🖨 Étiquette** ; scanner l'étiquette dans 💰 Ventes.",
        "Télécharger le **📄 Modèle Excel** « Nouveaux articles », y mettre deux lignes, l'importer ; lire le récapitulatif.",
        "Lancer un **⇄ Transfert** vers une autre boutique de formation ; montrer « ⏳ Transferts de stock envoyés » et que le stock n'a pas bougé ; annuler.",
      ]],
      ["note", "Le formateur vérifie surtout : le réflexe **proposition → clic** avant de créer, **+ Entrée** pour une réception (jamais Initial ni Ajuster), et le **motif** sur chaque ajustement."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "explique la formule du stock et retrouve d'où vient chaque colonne ;",
        "crée une fiche complète, en reprenant une fiche existante quand elle existe, et sait pourquoi le doublon est refusé ;",
        "distingue une entrée, un ajustement et un inventaire, et sait lequel employer ;",
        "corrige une fiche et sait ce qui reste réservé à l'administrateur ;",
        "lit la liste à réapprovisionner et sait ce qui déclenche l'alerte ;",
        "pose un code-barres, imprime une étiquette lisible, importe un fichier ;",
        "sait ce que devient un article défectueux, et qu'un transfert n'écrit rien avant la validation.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Un article a Initial 10, Entrées 20, Vendus 12, Ajust. −1 : quel est le stock ?",
        "On reçoit 15 pièces d'un article : quel bouton, et pourquoi pas « Initial » ?",
        "Que se passe-t-il si on tape le nom d'un article qui existe déjà dans une autre boutique ? Et dans la même boutique ?",
        "Qui peut corriger un prix d'achat, et que change cette correction sur les ventes passées ?",
        "Que déclenche le seuil, et qui reçoit la notification ?",
        "Après « ✅ Valider l'inventaire », que devient chaque écart ?",
        "Un ⇄ Transfert envoyé : l'article a-t-il quitté le stock ? Qui le fait bouger ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Explique la formule Initial + Entrées − Vendus + Ajust. = Stock",
      "Crée une fiche en reprenant une proposition, avec seuil et prix",
      "Enregistre une entrée, un ajustement motivé, un inventaire",
      "Corrige une fiche et connaît les champs réservés à l'administrateur",
      "Lit ⚠ À réapprovisionner et sait ce qui déclenche l'alerte",
      "Pose un code-barres, imprime une étiquette, importe un fichier",
      "Sait le sort d'un défectueux et qu'un transfert attend la validation",
      "Répond juste aux sept questions de la rubrique 12",
    ],
  },
};
