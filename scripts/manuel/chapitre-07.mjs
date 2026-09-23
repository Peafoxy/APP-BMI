// ============================================================
// MANUEL DE FORMATION — CHAPITRE 7 : Dettes et paiements
//
// Des MOTS, rien d'autre. Chaque bouton, chaque règle vient du code :
// screens/Dettes.jsx (Nouvelle dette client, 💵 Paiement, la relance, la
// réservation prépayée, 📦 Livrer, Annuler, 🗑, la liste), lib/core.js
// (prochainNumeroDette, numeroRecuDette, titreRecuDette, documentDeVente,
// lignesDette), lib/impression.js (imprimerRecuVersement : le reçu de dette,
// de versement, définitif ; filigrane NON LIVRÉ ; bandeau MARCHANDISE DÉJÀ
// LIVRÉE ; duplicata), lib/calculs.js (estReservation, resteAPayer,
// dettesClassiques, partParrainBloquee, espaceDeLaDette, refuserSaufAdmin),
// lib/rappels.js (RETARD_DETTE_JOURS = 30, detteEnRetard, dettePasseEnRetard,
// la tournée du matin), lib/whatsappModeles.js (envoiRappelDette,
// rappel_dette, rappel_echeance, texteRappelDette, texteRappelEcheance,
// traceEnvoi, libelleTrace), lib/reglement.js (soldeApresAcompte,
// echeancier, critiquePlan, resumePlan, prochaineEcheance, PLAN_EN_ATTENTE /
// PLAN_ACCEPTE / PLAN_REJETE), screens/EspaceClient.jsx (« Comment allez-vous
// régler le solde », « 💰 Où en est votre paiement »), screens/TousLesDevis.jsx
// (« 💰 Plan de règlement proposé par le client », ✅ Accepter / ❌ Rejeter),
// screens/Ventes.jsx (la dette née d'une vente à crédit), lib/validationDevis.js
// (la dette « Prestation de pose » dans la caisse TERRAIN),
// lib/effacementClient.js (une dette non soldée ferme l'effacement).
// ============================================================
export const CHAPITRE = {
  numero: 7,
  titre: "Dettes et paiements",
  sousTitre: "Suivre ce que les clients doivent, encaisser un versement et remettre le bon reçu, relancer du numéro BMI, livrer une réservation prépayée — et le plan de règlement d'une installation",
  public: "Vendeur, gérant, administrateur ; administrateur principal pour le plan de règlement ; comptable en lecture",
  duree: "1 h 15, puis l'exercice en espace formation",
  prerequis: "Les chapitres 5 (les ventes à crédit et les réservations) et 6 (la caisse : un versement en espèces entre dans le tiroir du jour).",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "d'où viennent les dettes de l'écran 🧾 Dettes : une **vente à crédit**, une **dette saisie à la main**, des **frais de SAV**, une **prestation de pose** — et ce qu'est une **réservation prépayée** ;",
        "**encaisser un versement** avec le bon moyen de paiement, et remettre le bon reçu : **REÇU DE DETTE**, **REÇU DE VERSEMENT** ou **REÇU DÉFINITIF — DETTE SOLDÉE** ;",
        "lire la liste : Dette · Payé · Reste, les pastilles **En cours / Partielle / Payée**, l'ancienneté et le **⚠ retard à 30 jours** ;",
        "**relancer** un client du numéro BMI, et ce que dit la trace 📲 sous la ligne ;",
        "suivre une **réservation prépayée** : versements, **📦 Livrer** (c'est là que le stock sort), Annuler ;",
        "pour l'administrateur principal : **accepter ou rejeter le plan de règlement** qu'un client propose en signant son contrat, et ce que le client lit ensuite dans son espace.",
      ]],
      ["regle", "**Une dette, c'est de l'argent que BMI attend ; un versement, c'est de l'argent qui entre dans la caisse du jour.** Un versement en espèces se retrouve le soir dans « Recette du jour (espèces) » de 🔒 Caisse ; un versement par Mixx monte le solde du compte mobile. Le moyen de paiement saisi ici décide de tout ça."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [5200, 4100], lignes: [
        ["Ouvrir 🧾 Dettes, lire la liste, 🖨 imprimer un reçu", "Vendeur, gérant, administrateur, comptable (en lecture seule : son compte n'écrit rien)"],
        ["« Enregistrer la dette » (une dette saisie à la main), « 💵 Paiement », « + Versement »", "**Vendeur, gérant, administrateur**"],
        ["Relancer par WhatsApp (bouton au logo vert)", "**Vendeur, gérant, administrateur** — le message part du numéro BMI"],
        ["« ✅ Créer la réservation », « 📦 Livrer », « Annuler » une réservation", "**Vendeur, gérant, administrateur**"],
        ["🗑 Supprimer une dette", "**L'administrateur seul** — le bouton n'apparaît que pour lui"],
        ["« ✅ Accepter » / « ❌ Rejeter » un plan de règlement (📋 Tous les devis)", "**L'administrateur PRINCIPAL seul** — les autres lisent « Seul l'administrateur PRINCIPAL peut accepter ou rejeter ce plan. »"],
        ["Proposer un plan de règlement", "**Le client**, dans son espace, au moment de signer le contrat (chapitres 14 et 21)"],
      ]}],
      ["note", "Un vendeur ou un gérant **rattaché à une boutique** ne voit que les dettes de la sienne. L'administrateur choisit la boutique en haut ; elle est mémorisée pour cet écran. Le technicien et le commercial n'ont pas l'onglet 🧾 Dettes."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3300, 6000], lignes: [
        ["**🧾 Dettes**, cadre vert « 💰 Réservation prépayée »", "Client · Téléphone · Article (« — Choisir — ») · Quantité · « + Ajouter » ; le panier réservé (TOTAL RÉSERVÉ) ; Avance versée aujourd'hui · Moyen de paiement · Livraison prévue (facultatif) · « ✅ Créer la réservation » ; puis la liste des réservations : Client · Articles réservés · Total · Versé · Reste · Statut (⏳ En cours · 💰 Soldée — à livrer · ✅ Livrée le …) · 🖨 Reçu · + Versement · 📦 Livrer · Annuler."],
        ["**🧾 Dettes**, bande rouge", "« ⚠ N dette(s) de plus de 30 jours à relancer » — seulement s'il y en a."],
        ["**🧾 Dettes**, cadre « Nouvelle dette client »", "Client · Téléphone · Article / Motif · Montant dette (F) · Déjà payé (F) · (si un acompte) Payé comment ? · « Enregistrer la dette »."],
        ["**🧾 Dettes**, la liste « Dettes — BOUTIQUE · Reste total : X »", "Colonnes Date (numéro dessous) · Client (téléphone dessous) · Motif (un article par ligne, deux au plus, « + N autres », la suite au clic) · Dette · Payé · Reste · Statut (pastille + ancienneté, et la trace 📲) · Actions (🖨 · 💵 · logo WhatsApp · 🗑). 50 lignes par page."],
        ["**💰 Ventes**", "Paiement « Crédit (dette) » : c'est là que naissent la plupart des dettes, et les réservations quand le stock manque (chapitre 5)."],
        ["**📋 Tous les devis**", "Sur un devis déplié : « 💰 Plan de règlement proposé par le client », ✅ Accepter / ❌ Rejeter (administrateur principal)."],
        ["**L'espace du client**", "À la signature du contrat : « Comment allez-vous régler le solde de X F ? » ; ensuite « 💰 Où en est votre paiement » avec le reste, les versements et le prochain versement (chapitre 21)."],
        ["**👤 Clients**", "La colonne « Dette en cours » de chaque client (chapitre 3)."],
        ["**📊 Tableau de bord**", "La carte « Dettes en cours » (elle ne dépend pas de la période)."],
        ["**🔒 Caisse**", "Le versement du jour se lit dans « Recette du jour (espèces) · encaissements » et dans « Détail des encaissements du … — qui a payé quoi » (chapitre 6)."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Encaisser un versement sur une dette"],
      ["etapes", [
        { titre: "Trouver la dette", texte: "Dans la liste, la ligne du client : son **Reste** en orange, sa pastille **En cours** (rien versé) ou **Partielle**. Cliquer sur la ligne déplie les articles s'il y en a plus de deux." },
        { titre: "💵 Paiement", texte: "Le bouton rond vert. Une question : « Montant reçu de KOSSI (F) — reste dû : 150 000 F », le reste proposé d'office. Un montant supérieur au reste est refusé : « Le montant dépasse le reste dû (150 000 F). »" },
        { titre: "Le moyen de paiement", texte: "Quatre boutons : Espèces · Mobile Money (Flooz) · Mobile Money (Mixx/T-Money) · Virement bancaire. **Choisir celui par lequel l'argent est vraiment entré** : c'est ce qui décide de la caisse du soir." },
        { titre: "Confirmer", texte: "« Confirmer le versement de 50 000 F de KOSSI ? » → « Versement enregistré ! ». La ligne se met à jour (Payé, Reste, pastille), le journal note « Paiement dette 50 000 F de KOSSI — BOUTIQUE »." },
        { titre: "Le reçu sort tout seul", texte: "À chaque versement, le reçu s'ouvre avec **tout l'historique des versements** (date, moyen, reçu par, montant), le montant total dû, le total versé et **RESTE À PAYER en rouge**. Si ce versement solde la dette, le titre devient **REÇU DÉFINITIF — DETTE SOLDÉE** avec le bandeau « ✔ CETTE DETTE EST INTÉGRALEMENT SOLDÉE — AUCUN MONTANT NE RESTE DÛ ». On l'imprime ou on le partage (📤 sur téléphone)." },
      ]],
      ["h3", "B. Enregistrer une dette à la main"],
      ["etapes", [
        { titre: "Quand ?", texte: "Quand l'argent dû ne vient pas d'une vente encaissée dans 💰 Ventes : un ancien crédit repris dans l'application, une prestation convenue, un reliquat. **Une vente à crédit ne se saisit jamais ici** : elle passe par 💰 Ventes, qui crée sa dette avec ses articles et sort le stock." },
        { titre: "Le formulaire", texte: "Client et Téléphone : les clients connus de la boutique se proposent, **un clic remplit les deux**. Article / Motif : ce qui est dû, en clair (« 2 × Batterie 200Ah, 1 × Régulateur » se lit ensuite article par article). Montant dette (F). Déjà payé (F) : l'acompte du jour, s'il y en a un — la case **« Payé comment ? »** apparaît alors." },
        { titre: "« Enregistrer la dette »", texte: "Sans nom ou sans montant : « Veuillez saisir le nom du client et le montant. » Sinon « Dette enregistrée avec succès ! », la ligne apparaît avec son numéro (APE-DET-2026-0003), et l'acompte est écrit comme **un premier versement** avec son moyen — il entre dans la caisse du jour." },
      ]],
      ["h3", "C. Relancer un client"],
      ["etapes", [
        { titre: "Le bouton au logo WhatsApp", texte: "Sur toute dette non payée. Le message part **du numéro BMI** (modèle approuvé par Meta) : « Bonjour KOSSI, ici BMI Togo. Concernant votre achat du 03/09/2026, il reste 150 000 F à régler sur un total de 250 000 F. Vous pouvez passer en boutique ou répondre directement à ce message. Merci de votre confiance. BMI Togo »." },
        { titre: "Une dette d'installation avec un plan accepté", texte: "Si la dette est celle d'un chantier dont le client a un **plan de règlement accepté**, c'est le rappel d'échéance qui part : « une échéance de votre plan de règlement BMI TOGO arrive le 30/09/2026. Montant attendu : 60 000 F. Reste à régler : … »." },
        { titre: "Ce qui s'affiche après", texte: "« ✅ Message envoyé du numéro BMI à KOSSI. » et, sous la pastille de statut, la trace **📲** (qui, quand, quel modèle). Si le numéro BMI ne peut pas envoyer (réseau, refus de WhatsApp), WhatsApp s'ouvre sur l'appareil avec le même texte, et l'écran dit pourquoi : « … WhatsApp s'est ouvert avec le texte : le message part de VOTRE numéro. » En espace formation, WhatsApp s'ouvre sans rien dire : c'est la règle, pas une panne. Aucune trace n'est écrite dans ces cas." },
        { titre: "Une dette soldée", texte: "« Cette dette est soldée : il n'y a rien à relancer. » — le bouton n'apparaît d'ailleurs plus sur une dette Payée." },
      ]],
      ["h3", "D. Une réservation prépayée"],
      ["etapes", [
        { titre: "La créer", texte: "Cadre vert. Client, Téléphone, puis Article (« — Choisir — », la liste de la boutique avec le prix) et Quantité, « + Ajouter » : le panier se remplit (« 2 × Panneau 400W », TOTAL RÉSERVÉ). Avance versée aujourd'hui, Moyen de paiement, Livraison prévue (facultatif), « ✅ Créer la réservation ». Confirmation : Total · Avance versée · Reste à payer · « La marchandise ne sortira du stock qu'à la livraison. »" },
        { titre: "Les versements", texte: "« + Versement » sur sa ligne : la même question, le même reçu — avec le **filigrane NON LIVRÉ** tant que la marchandise n'est pas partie. Quand tout est versé : statut « 💰 Soldée — à livrer »." },
        { titre: "📦 Livrer", texte: "**C'est ici que le stock sort et que la vente existe** (numéro de reçu de vente, journal « Livraison de la réservation de … »). Si un article manque : « Stock insuffisant pour : … Ravitaillez la boutique avant de livrer. » Le reçu de vente s'imprime." },
        { titre: "Livrer avant que ce soit soldé", texte: "L'application prévient : « ⚠ KOSSI n'a pas tout payé : il reste 50 000 F. Ce n'est plus une réservation prépayée si elle est livrée maintenant — elle va devenir une DETTE CLASSIQUE (elle quittera la liste des réservations pour rejoindre « Dettes », avec son historique de versements conservé). Continuer ? » Si oui, la fiche passe dans la liste des dettes avec le motif « Vente livrée avant solde (ex-réservation) », et le reçu de vente porte l'avance et RESTE À PAYER." },
        { titre: "Annuler", texte: "« Annuler » : si le client a déjà versé, l'écran le rappelle — « Vous devrez lui rembourser cette somme À LA MAIN (enregistrez-la en dépense). » La réservation disparaît de la liste ; l'argent rendu se saisit dans 📤 Dépenses." },
      ]],
      ["h3", "E. Le plan de règlement d'une installation (administrateur principal)"],
      ["etapes", [
        { titre: "Le client propose en signant", texte: "Dans son espace, si un solde reste dû après l'acompte, la question est obligatoire : « Comment allez-vous régler le solde de X F ? » — **la totalité** à la signature du procès-verbal de réception (ou dans les 3 jours), ou **chaque fin de mois** un montant, à partir d'une date. L'écran lui calcule : « → 6 versement(s), le dernier de 40 000 F le 28/02/2027 »." },
        { titre: "Décider dans 📋 Tous les devis", texte: "Sur le devis déplié, le cadre « 💰 Plan de règlement proposé par le client — en attente » : le solde concerné, la phrase du plan (« 60 000 F chaque fin de mois à partir du 2026-10-31 — 6 versement(s), solde le 2027-03-31 »), et **ce que le contrat prévoyait** (« Contrat : 30 % avant les travaux, le solde à la signature du procès-verbal »). « ✅ Accepter » (« Le client sera engagé sur cet échéancier. ») ou « ❌ Rejeter » avec un motif que le client lira." },
        { titre: "Ce que le client lit ensuite", texte: "« 💰 Où en est votre paiement » : montant total, acompte, déjà versé, **Reste à payer**, ses versements, son engagement, puis « ⏳ En attente de l'accord de BMI TOGO », « ❌ Refusé par BMI TOGO : motif. Rapprochez-vous de votre commercial… », ou « Prochain versement : 60 000 F le 31/10/2026 » — en rouge « ⚠ Versement en retard » si la date est passée — et « ✅ Soldé — merci ! » à la fin." },
      ]],
    ]},

    // ── 5
    { titre: "Explication de chaque bouton et champ", blocs: [
      ["h3", "La liste des dettes"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Reste total : X", "Dans le titre : la somme de ce qui reste dû sur la boutique, réservations exclues."],
        ["Date / numéro", "La date de la dette, et son numéro (APE-DET-2026-0003 ; FOR- devant en formation). Colonne figée pendant le défilement."],
        ["Client / téléphone", "Le nom en gras, le numéro dessous."],
        ["Motif", "Les articles de la vente à crédit (avec les frais d'installation et de transport d'un devis), ou le motif tapé. Deux lignes au plus, « + N autres », la suite au clic."],
        ["Dette · Payé · Reste", "Le montant dû, le total versé (vert), ce qui reste (orange ; vert à 0)."],
        ["Statut", "**En cours** (rouge, rien versé) · **Partielle** (ambre) · **Payée** (vert). Dessous : « N jours » depuis la dette ; **rouge avec ⚠ au-delà de 30 jours** s'il reste à payer. Et la trace « 📲 … » de la dernière relance partie du numéro BMI."],
        ["🖨", "Réimprime le reçu de la dette : de dette, de versement ou définitif selon ce qui a été versé ; « 📦 MARCHANDISE DÉJÀ LIVRÉE LE … » si elle vient d'une vente livrée."],
        ["💵", "« + Paiement : enregistrer un versement du client ». Absent sur une dette Payée."],
        ["Logo WhatsApp", "« Relancer le client par WhatsApp », du numéro BMI. Absent sur une dette Payée."],
        ["🗑", "« Supprimer cette dette » — administrateur seul, après confirmation. Rien ne revient au stock, aucune dépense n'est créée : c'est un effacement, à réserver à une saisie fausse."],
        ["Pagination", "50 dettes par page."],
      ]}],
      ["h3", "Le formulaire « Nouvelle dette client »"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Client / Téléphone", "Les clients connus de la boutique se proposent (« Nom, ou numéro du client », « +228 … ») ; un clic remplit les deux. Le numéro rattache la dette au compte du client : elle apparaît dans son espace et dans 👤 Clients."],
        ["Article / Motif", "Texte libre. Une liste « 2 × A, 3 × B » est relue article par article dans la colonne Motif."],
        ["Montant dette (F)", "Le total dû. Obligatoire."],
        ["Déjà payé (F) / Payé comment ?", "L'acompte du jour, écrit comme un premier versement avec son moyen. Sans moyen choisi, tout serait compté en espèces : la case apparaît dès qu'un montant est saisi."],
        ["Enregistrer la dette", "Le geste. Le numéro DET- est attribué, le journal l'écrit avec l'acompte et son moyen."],
      ]}],
      ["h3", "Le cadre « 💰 Réservation prépayée »"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Article / Quantité / + Ajouter", "La liste des articles de la boutique, avec leur prix de vente ; le prix est **bloqué** à la réservation."],
        ["TOTAL RÉSERVÉ / Retirer", "Le panier, ligne par ligne."],
        ["Avance versée aujourd'hui / Moyen de paiement", "Le premier versement ; l'avance ne peut pas dépasser le total. Pas de « Crédit » dans la liste des moyens."],
        ["Livraison prévue (facultatif)", "Une date indicative, affichée sous le client (« prévu 30/09/2026 »)."],
        ["Statut", "⏳ En cours · 💰 Soldée — à livrer · ✅ Livrée le …"],
        ["🖨 Reçu", "Le reçu de versement avec le filigrane NON LIVRÉ tant qu'elle n'est pas livrée."],
        ["+ Versement / 📦 Livrer / Annuler", "Encaisser ; sortir le stock et créer la vente (bascule en dette si pas soldée) ; annuler (le remboursement se fait à la main, en dépense)."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**D'où viennent les dettes.** Une vente « Crédit (dette) » dans 💰 Ventes crée sa dette avec les articles, les frais d'installation et de transport d'un devis, l'avance comme premier versement, et le lien vers la vente. Un devis « pose seule » signé crée une dette « Prestation de pose — contrat … » dans la caisse **TERRAIN**. Un 🔁 Retour sous garantie avec frais crée une dette « SAV RET-… ». Et le formulaire de cet écran crée les autres.",
        "**Le numéro** : trois lettres de la boutique + « DET » + l'année + un compteur (APE-DET-2026-0003), sa propre série, jamais confondue avec un numéro de reçu de vente. FOR- devant en formation. Le compteur ne redescend jamais.",
        "**Le reçu a trois titres, décidés par ce qui a été versé** : rien d'encaissé → **REÇU DE DETTE** (« Date », « Établi par », « Aucun versement à ce jour ») ; au moins un versement, l'avance du premier jour comprise → **REÇU DE VERSEMENT** (« Date du versement », « Reçu par ») ; tout versé → **REÇU DÉFINITIF — DETTE SOLDÉE**. Le document ne choisit jamais lui-même : c'est une règle, la même pour 🧾 Dettes, 💰 Ventes et les réservations. « RESTE À PAYER » est en rouge. Une boutique réglée en « duplicata » sort deux exemplaires (« DUPLICATA — EXEMPLAIRE BOUTIQUE »).",
        "**Chaque versement entre dans la caisse du jour** avec son moyen : en espèces, dans « Recette du jour (espèces) · encaissements » et dans le tiroir attendu ; par Flooz ou Mixx, dans le solde du compte mobile ; par virement, dans BANQUE. Un règlement en espèces rend la journée « active » : elle devra être clôturée.",
        "**Le retard** : une dette est en retard **au-delà de 30 jours** depuis sa date, tant qu'il reste à payer. Le 31e jour, la **tournée du matin** (7 h) prévient les vendeurs et le gérant de la boutique, plus les administrateurs : « 📋 Dette en retard — BOUTIQUE : 1 dette passe les 30 jours aujourd'hui : KOSSI (reste 150 000 F). À relancer. » Une seule fois par dette.",
        "**La relance choisit son modèle toute seule** : une dette ordinaire part avec le rappel de dette (client, date, reste, total) ; une dette de chantier dont le devis porte un **plan accepté** part avec le rappel d'échéance (prochaine date, montant attendu, reste, boutique). Un plan seulement proposé ne compte pas : on n'annonce jamais une échéance qui n'engage personne. Le texte de repli (WhatsApp ouvert sur l'appareil) est **mot pour mot** celui du modèle.",
        "**La trace 📲 ne s'écrit que si le message est parti du numéro BMI**, et ne dit jamais « livré » ni « lu » : on ne le sait pas. Relancer ne change pas le propriétaire de la conversation dans 📲 WhatsApp.",
        "**La commission attend le solde** : la commission du commercial, la part du parrain, celle de l'apporteur externe ne sont dues qu'après réception des travaux **et** dette soldée. Le dernier versement libère la commission (chapitre 16).",
        "**Le plan de règlement** vit sur le devis du client (proposé à la signature, décidé par l'administrateur principal dans 📋 Tous les devis). L'échéancier est calculé : un montant par fin de mois, le dernier ajusté pour tomber juste ; la prochaine échéance se lit en cumul (un client qui paie deux mensualités d'un coup passe à la troisième). Un devis corrigé et re-signé remet le plan « à valider ». La date de première échéance est libre.",
        "**Un client avec une dette non soldée ne peut pas être effacé** (⚙ Paramètres → 🔒 Données personnelles) : « Ce client doit encore X (N dette(s) en cours). … Soldez la dette (ou passez-la en perte) d'abord. »",
        "**Une réservation ne touche pas le stock** avant « 📦 Livrer » ; livrée sans être soldée, elle devient une dette classique (même numéro, historique conservé) et sa vente porte « Crédit (dette) » avec l'avance déjà versée. Le commercial et l'apporteur d'une réservation créée depuis 💰 Ventes sont reportés sur la vente à la livraison.",
        "**Le journal** (🕘 Historique) garde chaque dette, chaque versement (« Paiement dette » / « Versement réservation »), chaque relance partie du numéro BMI, chaque livraison, annulation et suppression.",
        "**Le mur** : les dettes de la boutique regardée seulement ; la relance passe l'espace de la dette, jamais celui de la personne qui clique — une dette d'entraînement n'envoie jamais un vrai message.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**💰 Ventes** (chapitre 5) : la vente à crédit crée la dette ; la réservation prépayée peut y naître quand le stock manque ; le reçu d'une vente à crédit est le reçu de sa dette.",
        "**🔒 Caisse** (chapitre 6) : chaque versement compte dans la recette du jour selon son moyen ; « Détail des encaissements du … — qui a payé quoi » liste les règlements de dettes du jour.",
        "**📦 Stocks** (chapitre 8) : une réservation ne sort le stock qu'à la livraison ; « Stock insuffisant » bloque la livraison.",
        "**📋 Tous les devis / 📄 Contrats** (chapitres 13 et 14) : le plan de règlement, proposé à la signature, décidé par l'administrateur principal ; l'échéance de la relance vient de là.",
        "**🏠 Clients installés** (chapitre 15) : la dette d'un chantier (vente à crédit ou pose seule) ; la réception **et** le solde libèrent les commissions.",
        "**👑 Mon équipe / 💵 Ma commission** (chapitre 16) : la commission attend la dette soldée.",
        "**📤 Dépenses** (chapitre 17) : le remboursement d'une réservation annulée se saisit là, à la main.",
        "**📲 WhatsApp** (chapitre 20) : la réponse du client à une relance arrive dans 📲 WhatsApp (support, ou l'auteur du devis).",
        "**L'espace du client** (chapitre 21) : « Où en est votre paiement », le plan, les versements, le prochain versement.",
        "**👤 Clients** (chapitre 3) et **📊 Tableau de bord** (chapitre 22) : « Dette en cours » par client, la carte « Dettes en cours ».",
        "**⚙ Paramètres** (chapitre 23) : l'effacement d'un client est refusé tant qu'une dette reste.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Le **moyen de paiement** du versement est celui par lequel l'argent est vraiment entré.",
        "Le montant saisi est **ce que le client a remis**, pas ce qu'il reste : le reste est proposé d'office, on le corrige si le client paie moins.",
        "Le reçu remis porte le **bon titre** (dette / versement / définitif) et le bon RESTE À PAYER.",
        "Une dette saisie à la main porte le **client choisi dans la liste** (pas retapé), son numéro, un motif clair.",
        "Une vente à crédit n'a **pas** été saisie ici en double : elle vient de 💰 Ventes.",
        "Les dettes **⚠ en retard** (plus de 30 jours) ont été relancées, et la trace 📲 le montre.",
        "Une réservation n'est livrée qu'une fois **soldée** — sinon on sait qu'elle devient une dette.",
        "Le soir, le « Reste total » de la boutique a été lu : il doit baisser quand on encaisse.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3300], lignes: [
        ["Saisir un versement supérieur au reste", "« Le montant dépasse le reste dû (150 000 F). »", "Saisir au plus le reste ; le surplus est un autre geste (une autre dette, ou rien)."],
        ["Un versement Mixx enregistré « Espèces »", "La caisse du soir réclame des billets qui ne sont jamais entrés ; le solde Mixx est trop bas.", "Toujours choisir le vrai moyen. Une erreur passée s'explique dans les Remarques de la clôture ; l'administrateur corrige."],
        ["Saisir à la main la dette d'une vente à crédit déjà encaissée", "Deux dettes pour le même achat ; le stock n'est pas sorti par la seconde.", "🗑 Supprimer la dette saisie en double (administrateur). La vente à crédit crée toujours la sienne."],
        ["Enregistrer une dette avec un acompte sans « Payé comment ? »", "La case apparaît dès qu'un montant est saisi : elle est proposée à Espèces.", "Vérifier le moyen avant « Enregistrer la dette »."],
        ["Relancer une dette Payée", "« Cette dette est soldée : il n'y a rien à relancer. » — le bouton a d'ailleurs disparu.", "Rien à faire."],
        ["« WhatsApp s'est ouvert… le message part de VOTRE numéro »", "Le numéro BMI n'a pas pu envoyer (réseau, refus dit en français, formation). Le texte est le même.", "Envoyer depuis WhatsApp ; aucune trace 📲 ne s'écrit. Réessayer plus tard si c'était le réseau."],
        ["Livrer une réservation dont un article manque", "« Stock insuffisant pour : … Ravitaillez la boutique avant de livrer. »", "Ravitaillement ou transfert (chapitre 9), puis 📦 Livrer."],
        ["Livrer une réservation pas soldée « parce que le client insiste »", "Elle devient une DETTE CLASSIQUE, l'écran prévient.", "C'est permis ; la relance se fait ensuite comme pour toute dette."],
        ["Annuler une réservation avec des versements", "La réservation disparaît ; l'argent n'est pas rendu par l'application.", "Enregistrer le remboursement dans 📤 Dépenses, à la main."],
        ["Supprimer une dette pour « la solder »", "Elle disparaît sans versement : la recette du jour ne bouge pas, le client n'a aucun reçu définitif.", "Une dette se solde par 💵 Paiement. 🗑 ne sert qu'à une saisie fausse (administrateur)."],
        ["Chercher la dette d'un client qui a acheté dans une autre boutique", "Elle n'est pas dans la liste : les dettes sont par boutique.", "Changer la boutique en haut (administrateur), ou aller dans 👤 Clients."],
        ["Effacer un client qui doit encore", "« Ce client doit encore X (N dette(s) en cours)… Soldez la dette (ou passez-la en perte) d'abord. »", "Solder ou passer en perte, puis effacer."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "AMA a acheté hier une batterie de 250 000 F à crédit avec 100 000 F d'avance par Mixx. Elle passe aujourd'hui payer 100 000 F en espèces.", reponse: "🧾 Dettes → sa ligne (Partielle, Reste 150 000). 💵 Paiement → 100 000 → Espèces → confirmer. Le reçu est un **REÇU DE VERSEMENT** : historique (hier 100 000 Mixx, aujourd'hui 100 000 Espèces), total versé 200 000, RESTE À PAYER 50 000 en rouge. Ce soir, 🔒 Caisse compte 100 000 F dans « encaissements »." },
        { situation: "AMA revient solder les 50 000 F restants par Flooz.", reponse: "💵 Paiement, 50 000 proposé d'office, Flooz. Le reçu devient **REÇU DÉFINITIF — DETTE SOLDÉE** avec le bandeau vert. La pastille passe à Payée. Si un commercial avait apporté cette vente, sa commission devient payable (chapitre 16). Le tiroir ne bouge pas : c'est le solde Flooz qui monte." },
        { situation: "KOFFI doit 80 000 F depuis 35 jours et n'est pas revenu.", reponse: "Sa ligne est en rouge « 35 jours ⚠ », la bande rouge du haut le compte. Le bouton WhatsApp envoie du numéro BMI : « … il reste 80 000 F à régler sur un total de 80 000 F… ». La trace « 📲 … » apparaît sous la pastille. S'il répond, sa réponse arrive dans 📲 WhatsApp." },
        { situation: "Un client veut un onduleur qui n'est pas en stock et laisse 60 000 F aujourd'hui pour le bloquer, sur 180 000 F.", reponse: "Cadre vert : le client, l'onduleur, quantité 1, « + Ajouter », Avance 60 000, moyen, « ✅ Créer la réservation ». Le reçu porte le filigrane NON LIVRÉ. À l'arrivée de l'onduleur et une fois les 120 000 F versés (« 💰 Soldée — à livrer »), « 📦 Livrer » : le stock sort, la vente existe, le reçu de vente s'imprime." },
        { situation: "Le même client veut emporter l'onduleur alors qu'il lui reste 40 000 F à payer.", reponse: "« 📦 Livrer » prévient : elle devient une DETTE CLASSIQUE. On accepte : la fiche rejoint la liste des dettes (« Vente livrée avant solde (ex-réservation) »), le reçu de vente porte l'avance et RESTE À PAYER 40 000, et on relance comme une dette ordinaire." },
        { situation: "Un client a signé son contrat en proposant 60 000 F par mois pour un solde de 360 000 F.", reponse: "Administrateur principal, 📋 Tous les devis, le devis déplié : « 💰 Plan de règlement proposé par le client — en attente », « 60 000 F chaque fin de mois à partir du … — 6 versement(s), solde le … », et « Contrat : 30 % avant les travaux, le solde à la signature du procès-verbal ». « ✅ Accepter ». Le client lit « Prochain versement : 60 000 F le … ». Les relances de sa dette partent ensuite avec le rappel d'échéance." },
        { situation: "Le même plan proposait 10 000 F par mois.", reponse: "L'écran du client l'aurait déjà refusé au-delà de dix ans (« Ce montant étalerait les versements sur plus de dix ans. Augmentez-le. »). Sinon : « ❌ Rejeter », motif « Échéancier trop long ». Le client lit « ❌ Refusé par BMI TOGO : Échéancier trop long. Rapprochez-vous de votre commercial pour convenir d'un autre échéancier. » et peut reproposer." },
        { situation: "Un ancien crédit de 45 000 F, accordé avant l'application, doit être suivi.", reponse: "« Nouvelle dette client » : le client (proposé s'il est connu), Article / Motif « Régulateur 60A — crédit d'août », Montant 45 000, Déjà payé 0, « Enregistrer la dette ». Elle prend son numéro DET-, apparaît « En cours », et se relance comme les autres." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "**En espace formation**, avec un formateur qui regarde l'écran. Faire d'abord, dans 💰 Ventes, une vente à crédit avec une avance par Mixx :"],
      ["ol", [
        "Ouvrir 🧾 Dettes, retrouver cette dette : lire son numéro, ses articles, Payé et Reste, sa pastille. Cliquer 🖨 et dire pourquoi le reçu s'appelle « REÇU DE VERSEMENT ».",
        "Encaisser **une partie** du reste en espèces avec 💵 : lire la question, le moyen, la confirmation, puis le reçu (historique à deux lignes, RESTE À PAYER).",
        "Encaisser **le solde** par Flooz : montrer le titre « REÇU DÉFINITIF — DETTE SOLDÉE » et la pastille Payée ; montrer que 💵 et le bouton WhatsApp ont disparu.",
        "Enregistrer une **dette à la main** avec un acompte de 5 000 F : montrer la case « Payé comment ? », le numéro DET- attribué, le premier versement dans le reçu.",
        "**Relancer** cette dette : en formation, WhatsApp s'ouvre sur l'appareil avec le texte (rien ne part du numéro BMI, et aucune trace 📲 ne s'écrit) — lire le texte et expliquer ce qui se passerait en réel.",
        "Créer une **réservation** de deux articles avec une avance ; ajouter un versement ; ouvrir 🖨 Reçu et montrer le filigrane NON LIVRÉ ; solder puis « 📦 Livrer » ; retrouver la vente dans 💰 Ventes.",
        "Créer une seconde réservation et la **livrer sans la solder** : lire l'avertissement, accepter, la retrouver dans la liste des dettes.",
        "Aller dans 🔒 Caisse et montrer où les versements en espèces du jour apparaissent (« encaissements », « Détail des encaissements »).",
        "**Avec le compte administrateur principal de formation**, dans 📋 Tous les devis : accepter ou rejeter un plan de règlement en attente, s'il y en a un, et lire la phrase du plan et celle du contrat.",
      ]],
      ["note", "Le formateur vérifie surtout : le **moyen de paiement** de chaque versement, le **titre du reçu** remis, et le réflexe « une vente à crédit se fait dans 💰 Ventes, pas ici »."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "sait d'où vient chaque dette de la liste et ne saisit jamais à la main une vente à crédit ;",
        "encaisse un versement avec le bon moyen et remet le reçu au bon titre ;",
        "lit la liste (Reste, pastilles, ancienneté, ⚠ 30 jours, trace 📲) ;",
        "relance un client et sait ce qui s'est passé (numéro BMI, ou WhatsApp ouvert) ;",
        "crée, encaisse, livre et annule une réservation, et sait ce qu'une livraison avant solde change ;",
        "(administrateur principal) accepte ou rejette un plan de règlement en comparant au contrat ;",
        "sait que chaque versement compte dans la caisse du jour, et que la commission attend le solde.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Citez trois façons dont une dette apparaît dans 🧾 Dettes.",
        "Quel titre porte le reçu d'une dette sans aucun versement ? Avec une avance le premier jour ? Une fois soldée ?",
        "Un client verse 50 000 F par Mixx : où cet argent apparaît-il ce soir dans 🔒 Caisse ?",
        "À partir de combien de jours une dette est-elle en retard, et qui est prévenu le matin ?",
        "Que se passe-t-il pour le stock quand on crée une réservation ? Et quand on clique « 📦 Livrer » ?",
        "Que devient une réservation livrée avant d'être soldée ?",
        "Qui accepte un plan de règlement, et où le client lit-il la décision ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Sait d'où viennent les dettes et n'en saisit pas en double",
      "Encaisse un versement avec le bon moyen de paiement",
      "Remet le reçu au bon titre (dette / versement / définitif)",
      "Lit la liste : Reste, pastilles, retard à 30 jours, trace 📲",
      "Relance un client et sait ce qui s'est passé",
      "Crée, encaisse, livre et annule une réservation prépayée",
      "Accepte ou rejette un plan de règlement (administrateur principal)",
      "Répond juste aux sept questions de la rubrique 12",
    ],
  },
};
