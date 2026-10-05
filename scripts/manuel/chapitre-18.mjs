// ============================================================
// MANUEL DE FORMATION — CHAPITRE 18 : Salaires
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// screens/Salaires.jsx (💵 Salaires de l'administrateur : 💵 Salaires /
// 🏦 CNSS, Masse salariale, Détail par employé, 💸 Virement, 🖨 Bulletin,
// 📄 Exporter ; PanneauCNSS : 💾 Enregistrer, 📥 Générer le fichier DRC
// (Excel), 💸 Enregistrer le paiement CNSS du mois ; Salaire : 💵 Mon salaire,
// 🖨 Imprimer mon bulletin de paie, ✅ confirmer un virement, Mes avances de
// frais, 🏦 Crédit BMI, 📈 Mon avancement, Mes informations CNSS),
// lib/calculs.js (paieMois, envoyerVirementG, libelleMoisFR,
// choisirBoutiqueDebitG, retenueCreditMois), lib/cnss.js (TAUX_CNSS_SALARIE,
// cotisationsCNSS, repartitionCNSS, genererFichierDRC), lib/paie.js (la fiche
// de paie à part), screens/Utilisateurs.jsx (⋯ Gérer → Paie : 💵 Salaire,
// 📈 Taux %, + Prime, − Avance, 🏦 Banque, 💸 Virement, Annuler virement ;
// 🏦 Crédits BMI : Approuver, Refuser, + Remboursement), lib/impression.js
// (imprimerBulletin), lib/comptesClients.js (LIBELLE_ROLE_EMPLOYE),
// lib/validationDepenses.js (avancesDe), App.jsx (onglets).
// Les avances de frais (dépenses de poche) sont au chapitre 17 ; la retenue
// d'un outil perdu au chapitre 19.
// ============================================================
export const CHAPITRE = {
  numero: 18,
  titre: "Salaires",
  sousTitre: "Fixer un salaire, poser une prime ou une avance, verser le mois, faire confirmer la réception, accorder un crédit BMI, déclarer et payer la CNSS",
  public: "Administrateur ; vendeur, gérant, magasinier, technicien BMI, responsable commercial, comptable (leur propre salaire)",
  duree: "1 h, puis l'exercice en espace formation",
  prerequis: "Le chapitre 2 (Utilisateurs) : la fiche d'un employé et son menu ⋯ Gérer. Le chapitre 17 (Dépenses) : chaque versement est une dépense de la caisse choisie.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "dire **qui est sur la paie** chez BMI, et qui ne l'est pas ;",
        "lire **le calcul du net** : salaire de base + primes − avances − retenue crédit − retenue CNSS ;",
        "(administrateur) **fixer un salaire**, poser une **prime** ou une **avance**, envoyer un **virement**, accorder un **crédit BMI** ;",
        "(employé) **lire sa paie**, **confirmer** qu'il a reçu son argent, demander un **crédit** ;",
        "(administrateur) préparer la **déclaration CNSS** du mois et enregistrer son **paiement**.",
      ]],
      ["regle", "**La fiche de paie est protégée** : salaire, primes, avances, virements, crédits, pièce d'identité et informations CNSS vivent dans une partie à part que **seuls l'administrateur, le comptable et l'employé lui-même** peuvent lire. Un collègue ne la reçoit pas du tout sur son téléphone."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4300, 5000], lignes: [
        ["Être sur la paie", "**Vendeur, gérant, magasinier, technicien BMI, responsable commercial, comptable.** Le technicien **à commission** et le commercial n'y sont pas : ils sont payés à la commission (chapitre 16)."],
        ["Onglet 💵 Salaires (tout le personnel)", "**L'administrateur.**"],
        ["Onglet 💵 Salaire (sa propre paie)", "Chaque salarié."],
        ["Fixer le salaire, le taux d'avancement, une prime, une avance", "**L'administrateur** (👥 Utilisateurs → ⋯ Gérer → Paie)."],
        ["Envoyer un virement de salaire, en annuler un non confirmé", "**L'administrateur.**"],
        ["Confirmer la réception d'un virement", "**L'employé lui-même.**"],
        ["Demander un crédit BMI / l'annuler tant qu'il est en attente", "L'employé."],
        ["Approuver, refuser un crédit, noter un remboursement", "**L'administrateur** (👥 Utilisateurs → 🏦 Crédits BMI)."],
        ["La CNSS (informations, fichier DRC, paiement)", "**L'administrateur** (💵 Salaires → 🏦 CNSS)."],
      ]}],
      ["note", "**Le mur formation / réel s'applique** : 💵 Salaires ne liste que les employés de l'espace regardé."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3100, 6200], lignes: [
        ["💵 Salaires → 💵 Salaires", "Le mois ; les cinq cases (masse salariale, déjà versé, reste à verser, à confirmer par l'employé, encours crédits BMI) ; le **Détail par employé** avec 💸 Virement et 🖨 Bulletin ; 📄 Exporter."],
        ["💵 Salaires → 🏦 CNSS", "Une ligne par employé : assujetti, matricule, n° d'assurance, type, date d'embauche, jours travaillés, nature de rémunération, et les cotisations ; les trois boutons de la déclaration."],
        ["👥 Utilisateurs → ⋯ Gérer → Paie", "💵 Salaire, 📈 Taux %, 📅 Paie suivie depuis, 📅 Embauche, 📄 Contrat, 🚪 Sortie, + Prime, − Avance, 🏦 Banque, 💸 Virement, Annuler virement."],
        ["👥 Utilisateurs → 🏦 Crédits BMI", "Toutes les demandes et tous les crédits en cours."],
        ["💵 Salaire (l'employé)", "« 💵 Mon salaire — nom » : le mois, les cases, les virements à confirmer, le détail, ses avances de frais, 🏦 Crédit BMI, 📈 Mon avancement, ses informations CNSS."],
      ]}],
      ["note", "Le nom de l'onglet affiche un nombre quand quelque chose attend l'employé — un virement à confirmer, une décision de crédit — : « 💵 Salaire (1) »."],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Le calcul du net du mois"],
      ["table", { entetes: ["Ligne", "D'où elle vient", "Effet"], largeurs: [2600, 3900, 2800], lignes: [
        ["Salaire de base", "La fiche (💵 Salaire)", "+"],
        ["Primes du mois", "« + Prime » posé pour ce mois", "+"],
        ["Avances perçues", "« − Avance » posé pour ce mois", "−"],
        ["Retenue crédit BMI", "L'échéance du mois d'un crédit remboursé sur salaire", "−"],
        ["Retenue CNSS (9 %)", "Seulement si l'employé est coché « Assujetti CNSS »", "−"],
        ["**Net à percevoir**", "Le résultat", "="],
      ]}],
      ["note", "La retenue CNSS se calcule sur **la base plus les primes**. Un remboursement d'avance de frais porté sur la paie (chapitre 17) s'ajoute au net **sans entrer dans la CNSS** : ce n'est pas une rémunération."],

      ["h3", "B. Fixer le salaire (administrateur)"],
      ["etapes", [
        { titre: "👥 Utilisateurs → ⋯ Gérer → 💵 Salaire", texte: "Le nouveau salaire de base mensuel. Si un **taux d'avancement** est fixé (📈 Taux %), l'application propose le salaire augmenté de ce taux." },
        { titre: "Le motif", texte: "Quand un salaire déjà fixé change, l'application demande le motif (ancienneté, promotion, mérite…). Chaque changement est **archivé** avec l'ancien et le nouveau montant : l'employé le lit dans « 📈 Mon avancement »." },
        { titre: "L'avis d'avancement, du numéro WhatsApp BMI", texte: "Quand le salaire **augmente**, l'application demande : « Envoyer l'avis d'avancement à … ? ». Oui : l'employé reçoit l'ancien et le nouveau salaire, le mois et le motif (sans motif : « décision de la Direction »). Répondez **Annuler** si ce n'était qu'une correction de saisie. Une baisse ou une première saisie n'envoie rien ; une fiche sans numéro non plus (l'écran le dit). Dans 📲 WhatsApp, la ligne est cachée : seuls celui qui l'a envoyé et l'administrateur principal en lisent le détail." },
        { titre: "📅 Paie suivie depuis", texte: "Le **premier mois de paie suivi dans l'application**. Les mois d'avant ne sont plus proposés, ni dans 💵 Mon salaire de l'employé ni dans 💵 Salaires : ils ont été payés **hors de l'application**, et un bulletin de ces mois-là aurait affiché « reste à percevoir » à tort. Laissée vide, la case prend le premier versement, la première prime ou la première avance enregistrés ; sans rien d'enregistré, seul le mois en cours est proposé. Un mois à venir est refusé, et un argent déjà enregistré avant ce mois n'est jamais caché (la liste commence alors à lui)." },
        { titre: "📅 Embauche", texte: "La **date d'embauche** de l'employé, pour **tout** salarié, déclaré ou non à la CNSS. Le bouton l'affiche (« 📅 Embauche · 01/03/2025 », ou « à saisir ») ; un clic la demande, vide pour l'effacer. C'est la même date que la colonne « Date d'embauche » de 💵 Salaires → 🏦 CNSS : la changer d'un côté la change de l'autre. Elle s'imprime sur le bulletin de paie et figure dans le dossier de l'employé." },
        { titre: "📄 Contrat", texte: "Le **type de contrat** : CDI, CDD, apprentissage ou stage. Pour un **CDD**, la **date de fin** est obligatoire ; pour un apprentissage ou un stage, elle est facultative ; un CDI n'en a pas. Le bouton l'affiche (« 📄 Contrat · CDD jusqu'au 31/12/2026 », ou « à saisir »). C'est le **même code** que la colonne « Type » de 💵 Salaires → 🏦 CNSS : le changer d'un côté le change de l'autre. Il s'imprime sur le bulletin (« Contrat : CDD jusqu'au 31/12/2026 ») ; un type jamais saisi ne s'imprime pas. Sous le nom de l'employé, la fin d'un CDD se lit : « 📄 CDD — fin le 31/12/2026 (dans 15 j) », en ambre à 15 jours ou moins, en rouge une fois dépassée. **15 jours avant la fin, puis la veille**, l'administrateur principal reçoit une notification à 7 h (« 📄 Fin de contrat… Renouveler, ou saisir la date de sortie »). Pour renouveler, on rouvre 📄 Contrat et on porte la nouvelle date de fin." },
        { titre: "🚪 Sortie", texte: "La **date de sortie** et son **motif** (fin de contrat, démission, licenciement…), ceux de la déclaration CNSS. Vide : l'employé fait toujours partie du personnel. Une fois la sortie saisie, plus aucun rappel de fin de contrat ; « 🚪 Sorti le … » se lit sous son nom. La sortie ne bloque pas le compte : pour l'empêcher de se connecter, ⛔ Bloquer." },
      ]],
      ["note", "Dans 💵 Salaires, un employé pas encore suivi le mois regardé n'apparaît pas : il n'est ni « 🔴 Non payé » ni compté dans la masse salariale, et une ligne le dit au-dessus du tableau."],

      ["h3", "C. Une prime ou une avance (administrateur)"],
      ["etapes", [
        { titre: "+ Prime", texte: "Le mois, le montant, un motif. **Rien ne sort de la caisse** : la prime est payée avec le salaire du mois." },
        { titre: "− Avance", texte: "Le mois, le montant, un motif, puis le **moyen de paiement** (la banque de la fiche est rappelée) et **« D'où sort l'argent ? »** : la caisse d'une boutique de l'espace (en espèces, pas plus que ce qu'elle contient), et en réel 👤 Chez le DG ou 🧾 Chez le comptable ; un **virement bancaire** demande aussi d'où il part — 🏦 BANQUE, et en réel 👤 Chez le DG ou 🧾 Chez le comptable. **C'est la seule question** : payée chez le DG, par la BANQUE ou chez le comptable, la dépense reste dans CETTE caisse — elle ne sort du tiroir d'aucune boutique et ne pèse sur le résultat d'aucune ; elle se lit dans 📤 Dépenses (cadre « 👤 Payées chez le DG · 🏦 par la BANQUE », ou « Chez le comptable ») et dans le relevé de la caisse. En formation, un virement part de la BANQUE et demande à quelle boutique compter la charge. L'argent part **tout de suite** : une dépense « Salaires » est écrite, et l'avance sera retirée du net de ce mois." },
      ]],

      ["h3", "D. Verser le salaire (administrateur)"],
      ["etapes", [
        { titre: "💸 Virement", texte: "Depuis la ligne de l'employé dans 💵 Salaires (le mois est déjà choisi) ou depuis ⋯ Gérer (on choisit le mois)." },
        { titre: "Le montant", texte: "La fenêtre détaille le calcul — base, primes, avances, retenue crédit, **retenue CNSS**, net — puis ce qui a déjà été envoyé ce mois et le **reste à verser**, proposé d'office. On peut verser en plusieurs fois." },
        { titre: "Moyen, référence, d'où sort l'argent", texte: "Le moyen (« Virement bancaire » d'office), une référence facultative, puis **« D'où sort l'argent ? »** : la caisse d'une boutique de l'espace (en espèces, pas plus que ce qu'elle contient), et en réel 👤 Chez le DG ou 🧾 Chez le comptable ; un **virement bancaire** demande aussi d'où il part — 🏦 BANQUE, et en réel 👤 Chez le DG ou 🧾 Chez le comptable. **C'est la seule question** : payée chez le DG, par la BANQUE ou chez le comptable, la dépense reste dans CETTE caisse — elle ne sort du tiroir d'aucune boutique et ne pèse sur le résultat d'aucune ; elle se lit dans 📤 Dépenses (cadre « 👤 Payées chez le DG · 🏦 par la BANQUE », ou « Chez le comptable ») et dans le relevé de la caisse. En formation, un virement part de la BANQUE et demande à quelle boutique compter la charge. La confirmation dit d'où l'argent sort." },
        { titre: "Ce qui s'écrit", texte: "Une dépense **« Salaires »**, et si une échéance de crédit tombe ce mois-là, son remboursement est noté. Le virement reste **⏳ En attente** jusqu'à ce que l'employé confirme." },
        { titre: "📲 L'avis part du numéro BMI", texte: "Juste après, l'employé reçoit **tout seul** un message WhatsApp du numéro BMI : son salaire du mois, la date, le montant et le moyen, la référence (celle tapée, sinon le N° du bulletin), le rôle et le numéro de celui qui a payé — et, un mois où une échéance de crédit BMI est retenue, le salaire, la retenue, le versé et ce qui reste à rembourser sur le crédit, et l'invitation à confirmer dans l'onglet « Salaire ». Aucune question, WhatsApp ne s'ouvre pas. Sans numéro sur sa fiche, rien ne part et la confirmation le dit (👥 Utilisateurs → ⋯ Gérer → 📞). Dans 📲 WhatsApp, la ligne ne montre pas le salaire : seuls celui qui a payé et l'administrateur principal en lisent le détail." },
      ]],
      ["note", "**Payé « Chez le DG »** : l'argent sort de la caisse de BMI chez le DG ; s'il n'y en a pas assez, le reste devient un apport de l'exploitant (📊 Tableau de bord → 👤 DG). Une retenue de crédit BMI s'y lit en entrée. **Payé depuis une boutique** : seul le vendeur ou le gérant de CETTE boutique est prévenu."],
      ["attention", "**Annuler virement** ne vaut que pour un virement **pas encore confirmé** par l'employé ; ses écritures de caisse sont retirées avec lui."],

      ["h3", "E. L'employé confirme qu'il a reçu son argent"],
      ["etapes", [
        { titre: "Le cadre 💸 Virement reçu de l'administration", texte: "En haut de 💵 Mon salaire : montant, mois, moyen, date d'envoi, qui l'a envoyé. « Vérifiez que l'argent est bien arrivé, puis confirmez la réception. »" },
        { titre: "Confirmer", texte: "Une question : « Confirmez-vous avoir bien reçu … ? ». La confirmation est enregistrée et **visible par l'administration** : dans 💵 Salaires, le statut passe de ⏳ À confirmer à ✅ Payé & confirmé." },
      ]],

      ["h3", "F. Le crédit BMI"],
      ["etapes", [
        { titre: "La demande (l'employé)", texte: "💵 Mon salaire → 🏦 Crédit BMI : montant souhaité, **motif** obligatoire, et le remboursement — **par retenue sur salaire** (1 à 36 mensualités) ou **libre**. Une seule demande en examen à la fois ; elle s'annule tant qu'elle attend." },
        { titre: "La décision (administrateur)", texte: "👥 Utilisateurs → 🏦 Crédits BMI → **Approuver** : le montant accordé, le nombre de mensualités, un commentaire, le moyen de remise et « D'où sort l'argent ? » (la même question que le salaire). Une dépense « Prêt au personnel » est écrite. **Refuser** demande un motif, que l'employé lit." },
        { titre: "Le remboursement", texte: "Sur salaire : chaque mois, l'échéance est retirée du net et notée payée au virement. Libre : **+ Remboursement** enregistre ce que l'employé rend (jamais plus que le reste dû)." },
        { titre: "📥 Crédit d'avant l'application (administrateur)", texte: "Pour un prêt remis AVANT l'application : bouton **📥 Crédit d'avant l'application** en tête de 🏦 Crédits BMI. L'employé, ce qui **reste dû aujourd'hui** (pas le montant d'origine), le remboursement (mensualités et premier mois, ou libre), un motif. **Aucune caisse ne bouge** : l'argent est sorti avant. La ligne porte « 📥 D'avant l'application »." },
        { titre: "↩ Date d'avant l'application", texte: "Un ancien prêt saisi par erreur avec **Approuver** a écrit une sortie de caisse datée du jour. Sur sa ligne, tant qu'il n'a **aucun remboursement versé en caisse** (une retenue sur salaire ne compte pas) : **↩ Date d'avant l'application** retire cette sortie et garde le crédit, ce qui reste dû et les retenues." },
        { titre: "🗑 Retirer (administrateur principal)", texte: "Un crédit saisi par erreur — un doublon, un faux « + Remboursement » pour annuler une sortie qui n'a pas eu lieu. Motif obligatoire. Le crédit part **avec ses lignes d'argent** : la sortie du prêt et ses remboursements versés en caisse, quelle que soit la caisse ; la confirmation les liste. **Une retenue déjà prise sur un salaire ne disparaît pas** : l'application demande à quel autre crédit la rattacher (son reste dû ne change pas, le bulletin du mois la compte toujours). Une ligne reste dans 🕘 Historique." },
        { titre: "↪ Rattacher la retenue", texte: "S'affiche sur un crédit accordé quand une retenue sur salaire n'est plus portée par aucun crédit (un crédit retiré avant la version 2.101.417). Un clic la rattache : le reste dû ne bouge pas, le bulletin du mois recompte la retenue et son « reste à percevoir » redevient juste." },
      ]],
      ["note", "**Un prêt au personnel n'est pas une charge** : l'argent doit revenir (compte 421, une créance sur l'employé). Il sort bien de la caisse, mais il ne baisse ni le résultat ni les dépenses du tableau de bord ; dans 📤 Dépenses il se lit avec la mention « n'est pas une charge ». Le journal comptable l'écrit en 421 ; un **crédit d'avant l'application** y reçoit une ligne d'ouverture (journal AN : débit 421 / crédit 471, compte d'attente) que le comptable rapproche de ses livres."],
      ["note", "**Un salaire avec une retenue de crédit** garde son montant entier dans 📤 Dépenses (c'est la charge réelle : 60 000 F), avec dessous « sorti de la caisse : 35 000 F — 25 000 F retenus sur le crédit ». La caisse ne perd que ce qui a été remis à l'employé."],

      ["h3", "G. La CNSS du mois (administrateur)"],
      ["etapes", [
        { titre: "💵 Salaires → 🏦 CNSS", texte: "Cocher **Assujetti CNSS** pour chaque employé déclaré. Le n° d'assurance, la date d'embauche et le type se renseignent **une fois** (la date d'embauche et le type restent modifiables même case décochée — le type se règle aussi dans 👥 Utilisateurs → ⋯ Gérer → Paie → 📄 Contrat —, et se saisit aussi dans 👥 Utilisateurs → ⋯ Gérer → Paie → 📅 Embauche) ; les **jours travaillés** et la nature de rémunération, **chaque mois**." },
        { titre: "💾 Enregistrer", texte: "Tant que ce n'est pas enregistré, un bandeau rouge le dit, et le fichier comme le paiement sont **bloqués**." },
        { titre: "📥 Générer le fichier DRC (Excel)", texte: "La Déclaration des Rémunérations et des Cotisations, mensuelle, à déposer sur le portail de la CNSS. Un employé incomplet (n° d'assurance, date d'embauche, jours) est **exclu** et l'écran le dit." },
        { titre: "💸 Enregistrer le paiement CNSS du mois", texte: "Les trois cases : part patronale (22,5 %), part salariale déjà retenue (9 %), total à reverser. Moyen (« Virement bancaire » d'office), caisse, confirmation : une dépense **« Cotisations CNSS »**. Un second paiement du même mois demande confirmation." },
      ]],
      ["attention", "**Si un assujetti est incomplet, le paiement ne le couvre pas** : l'application le dit avant de valider (« vous déclarerez et paierez donc moins que ce que vous devez »). On complète d'abord."],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton", "Où", "Ce qu'il fait"], largeurs: [2800, 2300, 4200], lignes: [
        ["💵 Salaire", "⋯ Gérer → Paie", "Fixe le salaire de base ; un changement est archivé dans l'avancement, avec son motif."],
        ["📈 Taux %", "⋯ Gérer → Paie", "Taux d'avancement annuel, proposé au prochain changement de salaire."],
        ["📅 Paie suivie depuis", "⋯ Gérer → Paie", "Premier mois de paie suivi dans l'application : les mois d'avant ne sont plus proposés (payés hors de l'application)."],
        ["📅 Embauche", "⋯ Gérer → Paie", "Date d'embauche de tout salarié, la même que la colonne de 🏦 CNSS ; imprimée sur le bulletin."],
        ["📄 Contrat", "⋯ Gérer → Paie", "CDI, CDD (avec sa date de fin), apprentissage, stage ; le même code que la colonne « Type » de 🏦 CNSS ; imprimé sur le bulletin ; rappel 15 jours avant la fin et la veille."],
        ["🚪 Sortie", "⋯ Gérer → Paie", "Date et motif de sortie (déclaration CNSS) ; arrête le rappel de fin de contrat."],
        ["+ Prime / − Avance", "⋯ Gérer → Paie", "Ajoute une prime (payée avec le salaire) ou une avance (sortie de caisse immédiate)."],
        ["🏦 Banque", "⋯ Gérer → Paie", "Nom de la banque et numéro de compte (jamais affiché en entier)."],
        ["💸 Virement", "⋯ Gérer → Paie ; aussi la ligne de 💵 Salaires", "Verse tout ou partie du net du mois."],
        ["Annuler virement", "⋯ Gérer → Paie", "Retire le dernier virement non confirmé."],
        ["🖨 Bulletin", "💵 Salaires", "Pour le moment, **seule l'administration imprime le bulletin** : dans 💵 Mon salaire, l'employé lit « Votre bulletin de paie s'obtient auprès de l'administration » au lieu du bouton. Le bulletin du mois choisi : nom, fonction, affectation (sa boutique ; pour un employé sans boutique, le **📍 lieu d'affectation** écrit par l'administrateur dans 👥 Utilisateurs, sinon rien), et ce que la fiche porte — matricule, n° d'assuré CNSS, date d'embauche, type de contrat (et la fin d'un CDD), banque avec le numéro de compte réduit à ses quatre derniers chiffres (« …9379 ») ; une ligne non renseignée n'est pas imprimée. Puis les éléments de paie en **deux colonnes, Gains et Retenues** (un remboursement de frais avancés est écrit « hors brut », une avance « déjà versée »), la ligne **TOTAUX**, le **net à percevoir** ; sous le tableau : **salaire brut**, **base CNSS** (« Non assujetti » pour un employé non coché), total des gains et des retenues. Puis les **cumuls de l'année** — du 1er janvier, ou du premier mois de paie suivi s'il est plus tard, au mois du bulletin : brut, CNSS retenue, net, versé, mois avec versement. Enfin les versements et le crédit BMI en cours. L'impôt sur le salaire (IRPP) n'y figure pas."],
        ["📄 Exporter", "💵 Salaires", "Le détail du mois (CSV)."],
        ["Approuver / Refuser / + Remboursement", "🏦 Crédits BMI", "La vie d'un crédit BMI."],
        ["💾 Enregistrer / 📥 Générer le fichier DRC (Excel) / 💸 Enregistrer le paiement CNSS du mois", "🏦 CNSS", "La déclaration et le paiement du mois."],
        ["Envoyer ma demande / Annuler", "🏦 Crédit BMI (employé)", "Demande ou retire une demande de crédit."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Le net se recalcule** à chaque prime, avance, échéance de crédit ou case CNSS changée.",
        "**Chaque sortie d'argent s'écrit** : « Salaires » (virement, avance), « Prêt au personnel » (crédit accordé), « Cotisations CNSS ». Ce sont des écritures automatiques : elles ne passent pas par la validation du DG et ne se modifient pas dans 📤 Dépenses. Le prêt au personnel, lui, n'est pas une charge : il ne compte pas dans le résultat.",
        "**La personne qui tient la caisse est prévenue** quand l'argent en sort pour un salaire, une avance ou un crédit.",
        "**Le numéro de compte bancaire ne descend jamais en entier** sur une dépense : seuls les quatre derniers chiffres y figurent.",
        "**Un outil perdu** par un salarié peut être retenu sous forme d'avance du mois (chapitre 19) : il apparaît dans les avances.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["table", { entetes: ["Module", "Le lien"], largeurs: [3100, 6200], lignes: [
        ["👥 Utilisateurs (ch. 2)", "La fiche, le rôle (qui est salarié), l'identité (nom complet sur le bulletin et la CNSS), la banque."],
        ["Commissions (ch. 16)", "Le commercial et le technicien à commission ne sont pas sur la paie ; un technicien BMI touche sa commission à part."],
        ["📤 Dépenses (ch. 17)", "Chaque versement est une dépense ; une avance de frais peut être remboursée avec le salaire."],
        ["🧰 Outillage (ch. 19)", "La retenue d'un outil perdu passe par une avance du mois."],
        ["⚙ Paramètres → 🔒 Données personnelles (ch. 23)", "Le dossier d'accès d'un employé reprend sa paie."],
      ]}],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Chaque salarié a son **salaire de base** et son **identité** (nom complet).",
        "Les primes et avances sont posées sur **le bon mois**.",
        "Les employés déclarés sont cochés **Assujetti CNSS**, avec leur n° d'assurance.",
        "Chaque virement est **confirmé** par l'employé (aucun ⏳ qui traîne).",
        "Les **jours travaillés** du mois sont saisis avant le fichier DRC.",
        "Le paiement CNSS est enregistré **une fois** par mois.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "La bonne façon"], largeurs: [4300, 5000], lignes: [
        ["Poser une avance sur le mauvais mois.", "Le mois est demandé en premier : c'est lui qui décide de quel net elle sort."],
        ["Chercher un commercial dans 💵 Salaires.", "Il n'est pas salarié : sa rémunération est dans 👑 Équipe et 💵 Ma commission."],
        ["Oublier de confirmer un virement reçu.", "L'administration le voit « ⏳ À confirmer » : l'employé confirme dans 💵 Mon salaire."],
        ["Générer le fichier DRC avant d'avoir enregistré.", "Bloqué : 💾 Enregistrer d'abord."],
        ["Payer la CNSS avec un assujetti incomplet.", "L'application prévient qu'il est exclu : compléter ses informations."],
        ["Annuler un virement déjà confirmé.", "Impossible : seul un virement non confirmé s'annule."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "AMA, vendeuse, salaire de base 100 000 F, reçoit une prime de 10 000 F et une avance de 20 000 F en septembre. Elle est assujettie à la CNSS.", reponse: "Retenue CNSS : 9 % de 110 000 = 9 900 F. Net : 100 000 + 10 000 − 20 000 − 9 900 = **80 100 F**. Les 20 000 F sont déjà sortis de la caisse le jour de l'avance." },
        { situation: "L'administrateur verse 50 000 F à AMA le 30, puis le reste le 5.", reponse: "Deux virements du même mois ; « Reste à verser » tombe à 30 100 F puis à 0. Chacun attend sa confirmation." },
        { situation: "KOFFI, magasinier, demande un crédit de 60 000 F remboursé en 3 mensualités.", reponse: "Une fois approuvé, 20 000 F sont retirés de son net pendant 3 mois ; la caisse a sorti 60 000 F en « Prêt au personnel » — sans toucher au résultat, puisque l'argent revient." },
        { situation: "ANGELE devait encore 400 000 F d'un prêt reçu avant l'application.", reponse: "📥 Crédit d'avant l'application : 400 000 F restants, ses mensualités, son premier mois. Aucune caisse ne bouge. Si on l'avait approuvé par erreur avec « Approuver », ↩ Date d'avant l'application retire la sortie de caisse." },
        { situation: "Pour septembre, la base CNSS d'AMA est 110 000 F.", reponse: "Part salariale 9 900 F (déjà retenue), part patronale 22,5 % = 24 750 F : environ **34 650 F** à reverser pour elle." },
        { situation: "Un employé est coché assujetti mais sans n° d'assurance.", reponse: "Il est exclu du fichier et du paiement, et l'écran le dit en ambre : on complète avant de déclarer." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "En **espace formation**, avec le formateur :"],
      ["ol", [
        "(Administrateur) Fixer le salaire d'un employé d'entraînement, avec un motif.",
        "Poser une prime et une avance sur le mois en cours ; lire le net dans 💵 Salaires.",
        "Envoyer un virement partiel ; (l'employé) le confirmer dans 💵 Mon salaire.",
        "(L'employé) Demander un crédit sur 3 mois ; (administrateur) l'approuver ; constater la retenue.",
        "(Administrateur) Cocher l'employé assujetti CNSS, saisir ses informations, enregistrer, générer le fichier DRC.",
        "Imprimer le bulletin du mois.",
      ]],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "nomme les six rôles salariés ;",
        "calcule un net avec prime, avance, crédit et CNSS ;",
        "distingue une prime (payée avec le salaire) d'une avance (sortie tout de suite) ;",
        "verse et fait confirmer un virement ;",
        "suit un crédit BMI de la demande au remboursement ;",
        "prépare la CNSS du mois.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Qui est sur la paie chez BMI, et qui ne l'est pas ?",
        "De quoi se compose le net à percevoir ?",
        "Sur quelle somme se calcule la retenue CNSS de 9 % ?",
        "Pourquoi une avance sort-elle de la caisse tout de suite, et pas une prime ?",
        "Que faut-il pour qu'un virement passe « ✅ Payé & confirmé » ?",
        "Qui peut lire la fiche de paie d'un employé ?",
        "Qu'est-ce qui bloque le fichier DRC ?",
        "Quelle dépense écrit un crédit BMI accordé ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Nomme les rôles salariés",
      "Calcule un net (prime, avance, crédit, CNSS)",
      "Distingue prime et avance",
      "Verse un virement et le fait confirmer",
      "Suit un crédit BMI",
      "Prépare et paie la CNSS du mois",
      "Imprime un bulletin",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
