// ============================================================
// MANUEL DE FORMATION — CHAPITRE 17 : Dépenses
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// screens/Depenses.jsx (📤 Dépenses : Nouvelle dépense — Catégorie
// « — Choisir — », Description, Montant, Paiement, Payé avec, Chantier à
// rattacher ; Enregistrer la dépense ; ⏳ Dépenses à valider par le DG,
// ✅ Valider, ✖ Rejeter ; 🏠 Loyer de la boutique, 💵 Payer le loyer /
// 💵 Payer d'avance ; ✏️ Modifier, Suppr. ; « Mes dépenses » ; 🧾 Chez le
// comptable — ✅ Remis / ✅ Encaissé, ✖ Rejeter, annuler),
// lib/validationDepenses.js (SEUIL_VALIDATION_DEPENSE = 5000, PAYE_AVEC,
// optionsPayeAvec, fondsProposable, ROLES_FONDS_CAISSE, construireDepenseSaisie,
// critiqueDecision, validerDepense, rejeterDepense, depensesBloquantCloture,
// MOYENS_REMBOURSEMENT, ROLES_REMB_CAISSE, critiqueRemboursement,
// neVoitQueSesDepenses, motifNonModifiable, critiqueModifDepense),
// lib/versements.js (critiqueSortieTiroir, MSG_AVANCE_PERSONNELLE),
// lib/depensesChantier.js (chantiersRattachables, critiqueRattachement,
// fraisAPartager), lib/loyer.js (etatLoyer, formulaireLoyer,
// critiquePaiementLoyer), lib/constants.js (CATEGORIES, PAIEMENTS,
// CATEGORIES_HORS_CHARGES, depensesComptees), screens/Caisse.jsx
// (💼 Avances de frais à rembourser, blocage de la clôture), App.jsx
// (onglets). Le fonds de caisse et les versements sont au chapitre 6 ; la
// part d'un chantier au chapitre 15 ; la réparation d'un outil au 19.
// ============================================================
export const CHAPITRE = {
  numero: 17,
  titre: "Dépenses",
  sousTitre: "Saisir une dépense, dire avec quel argent elle a été payée, la faire valider par le DG, et retrouver chaque franc — boutique, chantier, loyer, avances de poche",
  public: "Gérant, administrateur, administrateur principal (le DG) ; technicien et technicien BMI (leurs propres dépenses) ; comptable (lecture et pointage)",
  duree: "1 h, puis l'exercice en espace formation",
  prerequis: "Le chapitre 6 (Caisse) : le tiroir, l'enveloppe du fonds de caisse, la clôture du jour. Le chapitre 15 (Chantiers) pour le rattachement d'une dépense.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "**saisir une dépense** complète : catégorie, description, montant, moyen de paiement ;",
        "dire **avec quel argent** elle a été payée (« Payé avec ») — et savoir que ce choix décide **quelle caisse** la voit ;",
        "comprendre pourquoi une dépense de **5 000 F et plus attend le DG** et ne compte nulle part avant ;",
        "savoir quand l'application **refuse** une dépense (le tiroir ne contient pas assez) et quelle est la porte de sortie ;",
        "**rattacher** une petite dépense à un chantier, **payer le loyer** d'un local, **se faire rembourser** une avance de poche ;",
        "reconnaître ce qui **n'est pas une dépense** : un versement, un fonds de caisse, un remboursement de reprise, un prêt au personnel.",
      ]],
      ["regle", "**Seules les dépenses validées comptent** (Timo, 12/09/2026). À partir de **5 000 F**, une dépense attend la validation du DG : tant qu'il n'a pas dit oui, elle ne sort ni du tiroir, ni du tableau de bord, ni du « Ce mois »."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4300, 5000], lignes: [
        ["Voir 📤 Dépenses et saisir une dépense", "**Le gérant, l'administrateur**. Le **technicien** et le **technicien BMI** aussi, mais ils ne voient que **leurs propres dépenses** (titre « Mes dépenses »)."],
        ["Le vendeur", "**N'a pas l'onglet 📤 Dépenses** (15/09/2026) : il clôture la caisse, il ne dépense pas."],
        ["Le comptable", "Voit 📤 Dépenses **en lecture seule** ; son seul geste est le pointage dans 🧾 Chez le comptable."],
        ["✅ Valider / ✖ Rejeter une dépense", "**Le DG = l'administrateur principal**, seul."],
        ["« Le fonds de caisse » dans « Payé avec »", "**Le gérant et l'administrateur**, et seulement quand le tiroir ne suffit pas."],
        ["Rattacher une dépense à un chantier", "Le gérant, l'administrateur, ou **la personne qui a saisi la dépense**."],
        ["🏠 Voir et payer le loyer", "**Le gérant et l'administrateur.** La fiche du loyer se règle dans ⚙ Paramètres par l'administrateur seul."],
        ["✏️ Modifier (catégorie, description)", "**L'administrateur principal**, seul."],
        ["Suppr.", "**L'administrateur.**"],
        ["Rembourser une avance de poche", "En espèces : **le gérant et l'administrateur** ; avec le salaire ou par le DG : **l'administrateur**. Jamais soi-même (sauf l'administrateur)."],
        ["🧾 Chez le comptable : ✅ Remis / ✅ Encaissé", "**Le comptable.** L'administrateur peut annuler un pointage."],
      ]}],
      ["note", "**Le mur formation / réel s'applique** : « Payé avec » ne propose que les caisses de l'espace regardé, et « La caisse du comptable » n'existe qu'en réel (elle n'a pas de jumelle de formation)."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3100, 6200], lignes: [
        ["📤 Dépenses", "En haut, les pastilles des boutiques ; le cadre **⏳ Dépenses à valider par le DG** (chez le DG) ; le cadre **🏠 Loyer de la boutique** (local loué) ; la **Nouvelle dépense** ; la liste « Dépenses — boutique » avec « Ce mois »."],
        ["🧾 Chez le comptable", "Les **décaissements de sa caisse** : à remettre, déjà remis ; puis la liste des sorties confiées au comptable."],
        ["🔒 Caisse", "Le cadre **💼 Avances de frais à rembourser**, et le message qui **bloque la clôture** tant qu'une dépense en espèces attend le DG (chapitre 6)."],
        ["📊 Tableau de bord", "Les dépenses de la période, et l'export « Dépenses » ; les versements ont leur export à part."],
        ["💵 Mon salaire", "« Mes avances de frais » : l'employé y suit ce qu'on lui doit."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Saisir une dépense"],
      ["etapes", [
        { titre: "Choisir la boutique en haut", texte: "La pastille de la boutique dont on parle (le gérant rattaché à une boutique n'a pas de pastilles : c'est la sienne)." },
        { titre: "Catégorie", texte: "Elle part sur **« — Choisir — »** : **aucune catégorie n'est proposée d'office** (25/09/2026 — une dépense de 5 000 F était tombée en « Loyer » sans que personne y touche). Sans catégorie, l'application refuse : « Choisissez la catégorie de la dépense. »" },
        { titre: "Description", texte: "Ce qui a été acheté, pour qui, pourquoi. C'est ce que le DG lira avant de valider." },
        { titre: "Montant (F)", texte: "Plus que zéro. **À partir de 5 000 F**, un message ambre prévient : la dépense sera soumise au DG." },
        { titre: "Paiement", texte: "Espèces, Mobile Money (Flooz), Mobile Money (Mixx/T-Money), Virement bancaire. Seules les **espèces** sortent du tiroir." },
        { titre: "Payé avec", texte: "**D'où vient l'argent** (partie B). « La caisse de » la boutique regardée est proposée en premier." },
        { titre: "Chantier à rattacher", texte: "« — Aucun — » d'office. Choisir un chantier seulement pour un frais **du chantier** (partie D)." },
        { titre: "Enregistrer la dépense", texte: "Lire la confirmation : montant, catégorie, caisse qui paie, et ce qui va se passer (validation du DG, autre boutique, chantier, fonds de caisse)." },
      ]],
      ["attention", "Une dépense **ne se paie jamais « à crédit »** : une dépense qui n'est pas encore payée n'est pas une dépense. On la saisit **le jour où l'argent sort**, avec le vrai moyen — la liste ne propose d'ailleurs pas « Crédit (dette) », et l'application le refuse."],

      ["h3", "B. « Payé avec » : le choix qui décide de la caisse"],
      ["table", { entetes: ["Le choix", "Ce que ça veut dire", "Ce qui bouge"], largeurs: [2700, 3300, 3300], lignes: [
        ["**La caisse de X** (une ligne par boutique)", "L'argent est sorti du tiroir de la boutique X.", "La dépense est **enregistrée sur X** — même si l'écran regardait une autre boutique. Sa clôture et ses fonds à verser la voient."],
        ["**Le fonds de caisse (l'enveloppe)**", "Le tiroir ne suffit pas : l'enveloppe complète.", "Le tiroir paie ce qu'il a, l'enveloppe le reste ; les prochaines recettes la remboursent (chapitre 6)."],
        ["**Une avance personnelle (j'ai payé de ma poche)**", "L'employé a avancé l'argent.", "Rien ne sort du tiroir ; une **somme à lui rembourser** naît (partie F)."],
        ["**De l'argent remis par le DG**", "L'argent de BMI que le DG avait en main.", "Rien ne sort du tiroir ; la caisse **👤 DG** du tableau de bord diminue."],
        ["**La caisse du comptable** (réel seulement)", "Le comptable a payé.", "Rien ne sort du tiroir ; elle sort de sa caisse quand il pointe **✅ Remis**."],
      ]}],
      ["note", "« **Le fonds de caisse** » n'apparaît **jamais « au cas où »** : il faut être gérant ou administrateur, que l'enveloppe contienne quelque chose, qu'un montant soit saisi, et que **le tiroir ne suffise pas**. Un message ambre l'annonce alors : « Le tiroir paiera … et l'enveloppe … »."],

      ["h3", "C. Quand l'application refuse une dépense en espèces"],
      ["p", "On ne sort pas du tiroir plus qu'il ne contient. La limite est **le tiroir plus ce qu'il reste dans l'enveloppe du fonds de caisse**. Le contrôle est fait trois fois : à la **saisie**, à la **validation** du DG (valider, c'est faire sortir l'argent), et au **remboursement d'une avance** en espèces."],
      ["p", "Le refus dit le montant, ce qu'il y a dans le tiroir, et la porte de sortie : « Attendez une recette. Sinon, choisissez « une avance personnelle » dans « Payé avec » : la personne qui a payé de sa poche sera remboursée ensuite (🔒 Caisse → Avances de frais à rembourser). »"],
      ["attention", "Un paiement par **Flooz, Mixx, virement**, une **avance personnelle**, **l'argent du DG** ou **la caisse du comptable** ne touche pas le tiroir : ce contrôle ne s'applique pas à eux."],

      ["h3", "D. Rattacher une dépense à un chantier"],
      ["etapes", [
        { titre: "Pour quoi", texte: "Les petits frais d'une installation : carburant, nourriture, petit matériel. Elle reste une dépense ordinaire (seuil, DG, caisse)." },
        { titre: "Quels chantiers sont proposés", texte: "Ceux de l'espace regardé, **pas encore réceptionnés**, dont **les frais d'installation n'ont pas encore été payés** aux techniciens, et les 🛠 travaux à crédit non soldés. Sans chantier ouvert, la liste le dit." },
        { titre: "Ce qui se passe ensuite", texte: "Au partage des frais (🏠 Clients installés → 🔧 Frais), les techniciens se partagent **les frais facturés moins les dépenses rattachées qui comptent** (ni en attente du DG, ni rejetées) — jamais moins de zéro. La colonne « Chantier » de la liste montre le rattachement." },
      ]],

      ["h3", "E. Le DG valide ou rejette (administrateur principal)"],
      ["etapes", [
        { titre: "Il est prévenu", texte: "Un message « ⏳ Dépense à valider : … » arrive dans 💬 Messages dès la saisie." },
        { titre: "Le cadre ⏳ Dépenses à valider par le DG", texte: "En haut de 📤 Dépenses, **pour la boutique regardée seule** ; « Ailleurs, en attente : … » dit où il en reste. Vide, il le dit." },
        { titre: "✅ Valider", texte: "Confirmation, puis la dépense **compte** : tiroir, tableau de bord, « Ce mois ». Pour des espèces de la caisse, le tiroir est revérifié à cet instant." },
        { titre: "✖ Rejeter", texte: "**Motif obligatoire.** Le montant passe à 0 F (l'origine est gardée), la ligne devient rouge « ✖ rejetée le … », et l'auteur est prévenu. Si l'argent était sorti du tiroir, il est **toujours dû à la caisse** : le manque se voit à la clôture." },
      ]],
      ["regle", "**Une décision du DG ne se défait pas.** Une dépense saisie par le DG lui-même est validée d'office."],

      ["h3", "F. L'avance de poche et son remboursement"],
      ["etapes", [
        { titre: "Saisir", texte: "« Payé avec » : **Une avance personnelle (j'ai payé de ma poche)**. Un petit texte rappelle qu'elle sera remboursée une fois qu'elle compte." },
        { titre: "Elle devient due", texte: "Dès qu'elle compte : validée par le DG, ou sous 5 000 F. Elle apparaît dans 🔒 Caisse → **💼 Avances de frais à rembourser**, et dans « Mes avances de frais » de 💵 Mon salaire." },
        { titre: "Rembourser — trois boutons", texte: "**💵 Rembourser en espèces** (gérant, administrateur : une sortie du tiroir, contrôlée comme une dépense) ; **🧾 Avec le salaire** (administrateur : ajouté au net du mois, hors CNSS) ; **👤 Par le DG** (administrateur : rien ne bouge dans la caisse)." },
      ]],
      ["attention", "**On ne se rembourse pas soi-même** (sauf l'administrateur). Un remboursement ne se défait pas."],

      ["h3", "G. Le loyer d'un local loué (gérant, administrateur)"],
      ["etapes", [
        { titre: "Le cadre 🏠 Loyer de la boutique", texte: "Il n'apparaît que si l'administrateur a coché « Ce local est loué » (⚙ Paramètres). Il dit : montant, échéance, propriétaire, **Dernier mois payé**, et l'état — ✅ payé, ⏳ à payer avant le …, ⚠ **Arriérés** (nombre de mois, total, jours de retard)." },
        { titre: "💵 Payer le loyer / 💵 Payer d'avance", texte: "Trois choix : **le mois le plus ancien**, **tous les mois dus**, ou **payer d'avance** (1 à 24 mois). Le bouton **ne fait que remplir** le formulaire : catégorie Loyer, montant, description." },
        { titre: "Enregistrer", texte: "Vérifier « Payé avec », puis **Enregistrer la dépense** : elle passe par toutes les règles (DG au-delà de 5 000 F, tiroir). Un mois déjà payé ou déjà saisi est **refusé** : jamais deux fois." },
      ]],
      ["note", "« **Déjà compté** » sous le cadre dit quelles dépenses « Loyer » ont été comptées, par qui. Un chiffre qui surprend vient souvent d'une dépense mise en « Loyer » par erreur : l'administrateur la supprime et la ressaisit dans la bonne catégorie."],

      ["h3", "H. Corriger une dépense"],
      ["etapes", [
        { titre: "✏️ Modifier (administrateur principal)", texte: "**La catégorie et la description, rien d'autre.** Le montant, le paiement et « Payé avec » portent de l'argent : un montant faux se **supprime et se ressaisit**. La ligne garde « modifiée le … par … »." },
        { titre: "Ce qui ne se modifie pas", texte: "Les versements, fonds de caisse, apports et prélèvements du DG, remboursements, les dépenses **automatiques** (salaires, commissions, CNSS, primes…) et les dépenses **rejetées**." },
        { titre: "Suppr. (administrateur)", texte: "Confirmation. Une dépense née d'un paiement (commission, prime…) annule aussi son statut « payé » : l'écran le dit. Certaines ont leur propre porte de sortie, et l'application y renvoie." },
      ]],

      ["h3", "I. 🧾 Chez le comptable"],
      ["etapes", [
        { titre: "Ce qui y arrive", texte: "Les sorties payées « Chez le comptable » (commissions, salaires…), les dépenses de boutique « payées avec la caisse du comptable », et les versements reçus des boutiques." },
        { titre: "✅ Remis / ✅ Encaissé (le comptable)", texte: "Il pointe ce qu'il a **réellement** remis ou encaissé. C'est ce pointage qui fait bouger sa caisse (🧾 COMPTABLE du tableau de bord)." },
        { titre: "✖ Rejeter (un versement)", texte: "Motif obligatoire : l'argent redevient « jamais versé » dans la boutique (chapitre 6)." },
      ]],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton", "Où", "Ce qu'il fait"], largeurs: [2800, 2300, 4200], lignes: [
        ["Enregistrer la dépense", "📤 Dépenses", "Vérifie, demande confirmation, enregistre ; au-delà de 5 000 F, prévient le DG."],
        ["✅ Valider / ✖ Rejeter", "⏳ Dépenses à valider par le DG", "La décision du DG ; le rejet demande un motif."],
        ["💵 Payer le loyer / 💵 Payer d'avance", "🏠 Loyer de la boutique", "Remplit le formulaire pour un ou plusieurs mois."],
        ["✏️ Modifier", "Liste des dépenses", "Change la catégorie et la description (administrateur principal)."],
        ["Suppr.", "Liste des dépenses", "Supprime une dépense (administrateur)."],
        ["💵 Rembourser en espèces / 🧾 Avec le salaire / 👤 Par le DG", "🔒 Caisse → 💼 Avances", "Rembourse une avance de poche."],
        ["✅ Remis / ✅ Encaissé", "🧾 Chez le comptable", "Pointage du comptable."],
        ["✖ Rejeter", "🧾 Chez le comptable", "Rejette un versement en attente (comptable)."],
        ["annuler", "🧾 Chez le comptable", "Annule un pointage (administrateur)."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Une dépense en attente ne compte nulle part** : ni dans le tiroir, ni dans le tableau de bord, ni dans « Ce mois » — la liste le dit à côté (« en attente de validation (non comptées) »).",
        "**La clôture du jour est bloquée** tant qu'une dépense **en espèces payée avec la caisse** attend le DG, jusqu'au jour clôturé inclus. Flooz, avances et argent du DG ne bloquent pas.",
        "**Un versement n'est jamais une dépense** : ni lui, ni le fonds de caisse remis par le DG, ni un remboursement de reprise n'apparaissent dans 📤 Dépenses. L'écran dit où les retrouver : 🔒 Caisse et l'export « Versements ».",
        "**Un prêt au personnel** (un crédit BMI, que l'employé rend) **se lit dans la liste**, avec la mention « n'est pas une charge » — et « ↩ argent rentré dans la caisse » pour un remboursement : il fait bouger la caisse, on doit le voir. Il ne compte pas dans « Ce mois ». Son suivi est dans 👥 Utilisateurs → 🏦 Crédits BMI, et « Prêt au personnel » ne se choisit pas comme catégorie.",
        "**Une dépense payée par Flooz ou Mixx** descend le solde de ce compte mobile (carrés 📱 de 🔒 Caisse, chapitre 6).",
        "**La liste s'archive toute seule** : 10 lignes visibles puis on défile ; au-delà des 20 plus récentes, les lignes de plus de 3 mois passent dans « 📁 Dépenses archivées », rangées par mois. Rien n'est effacé.",
        "**Un paiement fait ailleurs crée sa dépense tout seul** : commission (chapitre 16), prime d'installation, salaire (chapitre 18), réparation d'un outil (chapitre 19), règlement d'un fournisseur (chapitre 10).",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["table", { entetes: ["Module", "Le lien"], largeurs: [3100, 6200], lignes: [
        ["🔒 Caisse (ch. 6)", "Le tiroir, l'enveloppe, la clôture bloquée, les avances à rembourser."],
        ["🏠 Chantiers (ch. 15)", "Les dépenses rattachées sont déduites des frais avant le partage."],
        ["Commissions et primes (ch. 16)", "Chaque paiement est une dépense « Commissions » ou « Prime d'installation »."],
        ["💵 Salaires (ch. 18)", "Une avance remboursée « avec le salaire » s'ajoute au net du mois."],
        ["🧰 Outillage (ch. 19)", "Le prix d'une réparation devient une dépense « Réparation d'outillage »."],
        ["📊 Tableau de bord", "Les dépenses qui comptent font le résultat ; les caisses 👤 DG et 🧾 COMPTABLE suivent leurs sorties."],
        ["⚙ Paramètres (ch. 23)", "La fiche du loyer, les boutiques de l'espace."],
      ]}],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "La **boutique** en haut est la bonne, et « Payé avec » nomme **la caisse qui a vraiment payé**.",
        "La **catégorie** est la bonne (surtout pas « Loyer » pour autre chose).",
        "La **description** permet au DG de comprendre sans appeler.",
        "Une grosse dépense en espèces est **validée avant la fermeture** — sinon la caisse ne se clôture pas.",
        "Les frais d'une installation sont **rattachés au chantier** avant le partage des frais.",
        "Les avances de poche sont **remboursées** et disparaissent du cadre 💼.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "La bonne façon"], largeurs: [4300, 5000], lignes: [
        ["Laisser la caisse de la boutique regardée alors que c'est une autre caisse qui a payé.", "Choisir « La caisse de » la boutique qui a payé : la dépense s'y range."],
        ["Saisir une dépense de 30 000 F en espèces avec 20 000 F dans le tiroir.", "Refusé : attendre une recette, prendre le fonds de caisse (gérant), ou noter une avance personnelle."],
        ["Faire une grosse dépense en espèces à 17 h et vouloir clôturer à 18 h.", "La faire valider par le DG avant la fermeture."],
        ["Saisir le versement au DG dans 📤 Dépenses.", "Un versement se fait dans 🔒 Caisse → 💸 Verser les fonds : ce n'est pas une dépense."],
        ["Corriger un montant faux avec ✏️ Modifier.", "Le montant ne se modifie pas : supprimer (administrateur) et ressaisir."],
        ["Payer le loyer d'un mois déjà payé.", "L'application refuse ; lire « Dernier mois payé » et « Déjà compté »."],
        ["Rattacher le carburant après le paiement des frais aux techniciens.", "Trop tard : le chantier n'est plus proposé. Rattacher au moment de la saisie."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Le gérant de DEMAKPOE achète 3 000 F de carburant en espèces pour le chantier de MR ERIC, avec la caisse de DEMAKPOE.", reponse: "Sous 5 000 F : elle compte tout de suite. Rattachée au chantier, elle sera retirée des frais avant le partage entre techniciens." },
        { situation: "Il achète un disjoncteur à 12 000 F en espèces.", reponse: "À partir de 5 000 F : **en attente du DG**. Elle ne sort pas encore du tiroir ; la clôture du soir sera bloquée tant que le DG n'a pas tranché." },
        { situation: "Le tiroir contient 20 000 F, l'enveloppe du fonds de caisse 50 000 F, et il faut payer 30 000 F.", reponse: "Le gérant peut choisir « Le fonds de caisse » : le tiroir paie 20 000 F, l'enveloppe 10 000 F ; il y restera 40 000 F, remboursés par les prochaines recettes." },
        { situation: "Le technicien KOSSI paie 8 000 F de nourriture de sa poche.", reponse: "Avance personnelle, en attente du DG. Une fois validée, elle apparaît dans 💼 Avances de frais à rembourser ; le gérant la rembourse en espèces (ou l'administrateur avec le salaire)." },
        { situation: "Le loyer de 90 000 F n'a pas été payé en août ni en septembre ; on est le 20 septembre, échéance le 5.", reponse: "Le cadre dit « ⚠ Arriérés : 2 mois … 180 000 F dus ». « 💵 Payer le loyer » → « Tous les mois dus (2) » remplit 180 000 F." },
        { situation: "La caisse d'APESSITO a payé une dépense, mais l'écran regardait DEMAKPOE.", reponse: "Choisir « La caisse de APESSITO » : la dépense est enregistrée sur APESSITO, et l'écran le dit." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "En **espace formation**, avec le formateur :"],
      ["ol", [
        "Saisir une dépense de 3 000 F en espèces, catégorie Carburant, rattachée à un chantier d'entraînement.",
        "Saisir une dépense de 15 000 F ; constater « ⏳ à valider par le DG » et « non comptées » dans « Ce mois ».",
        "(Administrateur principal) La valider ; constater qu'elle compte.",
        "Saisir une dépense plus grosse que le tiroir ; lire le refus ; la ressaisir en avance personnelle.",
        "Dans 🔒 Caisse, rembourser l'avance en espèces (gérant).",
        "(Si le local est loué) Payer un mois de loyer avec « 💵 Payer le loyer » ; constater « Dernier mois payé ».",
      ]],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "saisit une dépense complète, avec la bonne catégorie ;",
        "choisit le bon « Payé avec » et sait quelle caisse bouge ;",
        "explique le seuil de 5 000 F et ce que « en attente » veut dire ;",
        "sait quoi faire quand le tiroir ne suffit pas ;",
        "rattache une dépense à un chantier ;",
        "fait rembourser une avance de poche ;",
        "distingue une dépense d'un versement.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "À partir de quel montant une dépense attend-elle le DG, et que se passe-t-il avant ?",
        "Pourquoi la catégorie n'est-elle jamais proposée d'office ?",
        "Que veut dire « La caisse de APESSITO » quand l'écran regarde DEMAKPOE ?",
        "Quand « Le fonds de caisse » apparaît-il dans « Payé avec » ?",
        "Quels paiements ne sont pas limités par le tiroir ?",
        "Qu'est-ce qui empêche la clôture du soir ?",
        "Que peut-on modifier sur une dépense, et qui ?",
        "Pourquoi un versement n'apparaît-il pas dans 📤 Dépenses ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Saisit une dépense complète, bonne catégorie",
      "Choisit le bon « Payé avec »",
      "Explique le seuil de 5 000 F et la validation du DG",
      "Sait quoi faire quand le tiroir ne suffit pas",
      "Rattache une dépense à un chantier",
      "Fait rembourser une avance de poche",
      "Paie le loyer par le cadre 🏠",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
