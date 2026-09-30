// ============================================================
// MANUEL DE FORMATION — CHAPITRE 14 : Contrats
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// screens/ContratsInstallation.jsx (l'onglet « 📄 Contrats » / « 📄 Mes
// contrats » ; le cadre « ✍️ Ma signature » — ✍️ Enregistrer ma signature,
// Modifier ma signature, Effacer, ✍️ Enregistrer, Annuler ; la liste des
// contrats — numéro, client, type, « Signé le … », « par … », montant, les
// pastilles ⏳ En attente de paiement, 📝 Signé sur papier, 🏪 Signé en
// boutique ; 📄 Voir le contrat, 📄 Voir le PV, et leurs refus tant que le
// règlement n'est pas soldé ; contratRegle), screens/EspaceClient.jsx (« Ce
// devis vous convient ? », « Boutique où je vais payer », ✅ JE VALIDE, le
// contrat à lire, « Comment allez-vous régler le solde de … F ? », ✍️ Signer et
// valider ; « 💰 Où en est votre paiement », « Votre engagement », ⏳ En
// attente de l'accord de BMI TOGO / ❌ Refusé / Prochain versement / ✅ Soldé ;
// 📄 Télécharger mon contrat ; ✅ J'accepte et je re-signe), screens/
// TousLesDevis.jsx (« Le client est en boutique et n'utilise pas
// l'application ? » — ✍️ Faire signer ici, 🖨 Imprimer pour signature papier,
// 📝 Signé sur papier ; « Le client paiera à : » ; ✍️ Enregistrer la
// signature et valider / 📝 Confirmer la signature papier et valider ; le
// cadre « 💰 Plan de règlement proposé par le client » — ✅ Accepter,
// ❌ Rejeter), lib/contrat.js (numeroContrat CTR-année-…, planReglementSigne),
// lib/reglement.js (soldeApresAcompte, echeancier, critiquePlan, resumePlan,
// engagementDuContrat, prochaineEcheance), lib/validationDevis.js (commande en
// attente ; pose seule → chantier et dette, 70 % attendus), lib/poseSeule.js
// (ACOMPTE_POSE_PCT = 70), lib/impression.js (le contrat imprimé : « CONTRAT
// DE FOURNITURE D'INSTALLATION… » ou « CONTRAT DE PRESTATION DE POSE »,
// « Fait à Lomé », signature de l'initiateur et cachet), dimensionnement/
// Partages.jsx (aucun devis ne part sans la signature personnelle), App.jsx
// (les rôles qui ont l'onglet ; « 📄 Mes contrats » dès le premier contrat).
// Le PV de réception, l'avenant et la programmation sont au chapitre 15 ;
// l'encaissement d'une commande au chapitre 5 ; la dette et ses versements au 7.
// ============================================================
export const CHAPITRE = {
  numero: 14,
  titre: "Contrats",
  sousTitre: "Du devis accepté au contrat signé — par le client sur son téléphone ou en boutique — et le plan de règlement du solde",
  public: "Administrateur, responsable commercial, commercial, technicien, technicien BMI, gérant, vendeur ; et ce que voit le client",
  duree: "1 h 15, puis l'exercice en espace formation",
  prerequis: "Le chapitre 13 (Devis et proformas) : les statuts d'un devis et la validation. Le chapitre 5 (Ventes et commandes) : l'encaissement d'une commande. Le chapitre 7 (Dettes) : les versements.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "**enregistrer sa signature** une fois pour toutes — sans elle, aucun devis ne part ;",
        "expliquer au client **comment il signe** son contrat depuis son espace ;",
        "savoir **qui peut faire signer en boutique**, à l'écran ou sur papier ;",
        "lire le **plan de règlement** du solde, et savoir **qui l'accepte** ;",
        "retrouver un contrat dans **📄 Contrats** et savoir **quand il se télécharge** ;",
        "distinguer le **contrat d'installation** (BMI fournit et installe) du **contrat de pose seule** (le client fournit le matériel).",
      ]],
      ["regle", "**Un devis validé est un contrat.** Le client ne dit pas oui d'un clic : il **lit le contrat, le signe**, et s'engage sur la façon dont il réglera le solde. À partir de là, le devis ne se modifie plus sans son accord (chapitre 13)."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4300, 5000], lignes: [
        ["L'onglet 📄 Contrats", "**Administrateur, responsable commercial, commercial, technicien, technicien BMI, gérant, vendeur.** Pas le magasinier, pas le comptable."],
        ["Voir les contrats", "**Administrateur et responsable commercial** : tous. **Les autres** : seulement les contrats de **leurs propres devis**, jamais ceux d'un collègue."],
        ["✍️ Enregistrer ma signature", "Chacun pour lui-même, dans 📄 Contrats."],
        ["Signer son contrat (✅ JE VALIDE)", "**Le client**, depuis son espace."],
        ["Faire signer en boutique (✍️ Faire signer ici, 🖨 Imprimer pour signature papier, 📝 Signé sur papier)", "**L'administrateur principal seul**, pour l'instant."],
        ["Accepter ou rejeter un plan de règlement", "**L'administrateur principal seul** (« moi seul », décision de Timo)."],
        ["Télécharger un contrat", "**L'administrateur** toujours ; **les autres et le client** une fois le règlement **soldé**."],
        ["📄 Mes contrats", "**Le client**, dès qu'il a au moins un contrat signé."],
      ]}],
      ["note", "**Le mur formation / réel s'applique** : un contrat signé en formation n'apparaît jamais dans la liste d'un compte réel, ni l'inverse. Le client, lui, voit toujours les siens — le PDF d'un contrat de formation porte son bandeau."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3100, 6200], lignes: [
        ["📄 Contrats → ✍️ Ma signature", "Votre signature personnelle : l'enregistrer, la voir, la modifier."],
        ["📄 Contrats → Contrats d'installation", "La liste des contrats signés, du plus récent au plus ancien, avec 📄 Voir le contrat et 📄 Voir le PV."],
        ["📋 Tous les devis → la ligne d'un devis Proposé", "Le cadre « Le client est en boutique et n'utilise pas l'application ? » (administrateur principal)."],
        ["📋 Tous les devis → la ligne d'un devis signé", "Le cadre « 💰 Plan de règlement proposé par le client » et ses boutons ✅ Accepter / ❌ Rejeter."],
        ["Espace client → 🏠 Mon espace", "Le devis, « ✅ JE VALIDE », puis « 💰 Où en est votre paiement »."],
        ["Espace client → 📄 Mes contrats", "Ses contrats signés, téléchargeables une fois réglés."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Enregistrer sa signature (une seule fois)"],
      ["etapes", [
        { titre: "Ouvrir 📄 Contrats", texte: "Le premier cadre s'appelle **✍️ Ma signature**." },
        { titre: "✍️ Enregistrer ma signature", texte: "Signer avec le doigt (ou la souris) dans le cadre. **Effacer** pour recommencer." },
        { titre: "✍️ Enregistrer", texte: "Message : « ✅ Signature enregistrée — elle sera utilisée automatiquement sur vos futurs contrats. » Elle apparaît sur le contrat **à côté du cachet de BMI Togo**, et sur le PDF de vos devis." },
      ]],
      ["attention", "**Sans signature enregistrée, aucun devis ne part.** Le volet du devis l'annonce en ambre (« ✍️ Votre signature manque ») et l'envoi est refusé en renvoyant vers 📄 Contrats. On s'en occupe **le premier jour**, pas devant le client."],
      ["h3", "B. Le client signe depuis son espace"],
      ["etapes", [
        { titre: "Le client ouvre son devis", texte: "Dans « Ce devis vous convient ? ». Pour un devis d'installation, il choisit d'abord **« Boutique où je vais payer »** — sans elle, l'application le lui demande." },
        { titre: "✅ JE VALIDE", texte: "Le **contrat complet** s'ouvre : il le lit." },
        { titre: "S'il restera un solde après l'acompte", texte: "Il répond à **« Comment allez-vous régler le solde de … F ? »** : **la totalité** à la signature du procès-verbal de réception (ou dans les 3 jours qui suivent), **ou** un montant **chaque fin de mois**, à partir d'une date qu'il choisit. Le calcul s'affiche pendant qu'il tape (« → N versement(s), le dernier de … F le … »)." },
        { titre: "Il signe du doigt, puis ✍️ Signer et valider", texte: "Une dernière question récapitule : le montant, la boutique où il passera payer (adresse, itinéraire, téléphone). Il confirme." },
        { titre: "Ce qui se passe", texte: "Le devis passe **✅ Validé**, le contrat reçoit son **numéro CTR-année-…**, et une **commande en attente** part dans la boutique choisie : le vendeur l'encaissera dans 💰 Ventes (chapitre 5). L'installation est programmée **après le paiement**." },
      ]],
      ["h3", "C. Le cas de la pose seule"],
      ["etapes", [
        { titre: "Pas de boutique à choisir", texte: "Le client a déjà son matériel : BMI ne fait que la pose. Le contrat s'appelle **« CONTRAT DE PRESTATION DE POSE »**." },
        { titre: "À la signature", texte: "La question dit : « **70 %** du montant sont à régler avant que l'intervention soit programmée, le solde à la réception des travaux (au technicien ou en boutique). »" },
        { titre: "Ce qui se passe", texte: "Le **chantier** et sa **dette** naissent tout de suite. Les 70 % s'encaissent dans 🧾 Commandes de la boutique du devis ou depuis le chantier (🏠 Clients installés) ; **on ne peut pas programmer l'intervention avant** (chapitre 15)." },
      ]],
      ["h3", "D. Faire signer en boutique (administrateur principal)"],
      ["etapes", [
        { titre: "Le client est en face de vous, sans l'application", texte: "📋 Tous les devis → le devis **Proposé** → cadre « Le client est en boutique et n'utilise pas l'application ? »." },
        { titre: "Signature à l'écran : ✍️ Faire signer ici", texte: "Le contrat s'affiche sur votre appareil. Pour un devis d'installation, choisir **« Le client paiera à : »**. Remplir le plan de règlement s'il reste un solde. Le client signe du doigt, puis **✍️ Enregistrer la signature et valider**." },
        { titre: "Signature sur papier : 🖨 Imprimer pour signature papier", texte: "Le contrat complet s'imprime, cases vides. **Son numéro est attribué dès l'impression** et gardé : le papier et l'application portent le même." },
        { titre: "Puis 📝 Signé sur papier", texte: "Une fois le papier signé : choisir la boutique de paiement, le plan de règlement, puis **📝 Confirmer la signature papier et valider**. **L'original signé reste archivé à la boutique.**" },
        { titre: "La trace", texte: "Le contrat porte « Signé en boutique X, devant Y » ou « Signé sur papier — original archivé à X (reçu par Y) ». Dans la liste : pastille **🏪 Signé en boutique** ou **📝 Signé sur papier**." },
      ]],
      ["h3", "E. Accepter ou rejeter le plan de règlement (administrateur principal)"],
      ["etapes", [
        { titre: "Ouvrir le devis dans 📋 Tous les devis", texte: "Le cadre **« 💰 Plan de règlement proposé par le client — en attente »** donne le solde concerné, le plan en une phrase, et **ce que le contrat prévoyait** (« Contrat : 70 % avant les travaux, le solde à la signature du procès-verbal »)." },
        { titre: "✅ Accepter", texte: "La question répète le plan : « Le client sera engagé sur cet échéancier. »" },
        { titre: "❌ Rejeter", texte: "Un motif est demandé : **le client le lit** dans son espace, et se rapproche de son commercial pour convenir d'un autre échéancier." },
        { titre: "Ce que voit le client", texte: "« ⏳ En attente de l'accord de BMI TOGO », puis « Prochain versement : … F le … » (en rouge « ⚠ Versement en retard » si la date est passée), jusqu'à « ✅ Soldé — merci ! »." },
      ]],
      ["h3", "F. Retrouver et télécharger un contrat"],
      ["etapes", [
        { titre: "📄 Contrats", texte: "Chaque ligne : le numéro, le client, le type (installation solaire, motorisation portail/garage, ou la catégorie), « Signé le … », « par … », le montant." },
        { titre: "📄 Voir le contrat", texte: "S'ouvre si le règlement est **soldé** (l'administrateur, toujours). Sinon, un message dit pourquoi : le client n'est pas encore passé payer." },
        { titre: "📄 Voir le PV", texte: "Apparaît quand le procès-verbal de réception est signé ; même règle de paiement." },
      ]],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton", "Où", "Ce qu'il fait"], largeurs: [2800, 2300, 4200], lignes: [
        ["✍️ Enregistrer ma signature / Modifier ma signature", "📄 Contrats", "Enregistre la signature personnelle, utilisée sur tous vos contrats et devis."],
        ["📄 Voir le contrat", "📄 Contrats", "Ouvre le contrat imprimable, une fois le règlement soldé."],
        ["📄 Voir le PV", "📄 Contrats", "Ouvre le procès-verbal de réception signé, une fois soldé."],
        ["✅ JE VALIDE", "Espace client", "Ouvre le contrat à lire et à signer."],
        ["✍️ Signer et valider", "Espace client", "Enregistre la signature et le plan, valide le devis."],
        ["✅ J'accepte et je re-signe", "Espace client", "Pour un devis signé puis corrigé : re-signature, même numéro de contrat."],
        ["✍️ Faire signer ici", "📋 Tous les devis", "Signature du client sur votre appareil (administrateur principal)."],
        ["🖨 Imprimer pour signature papier", "📋 Tous les devis", "Imprime le contrat et lui attribue son numéro."],
        ["📝 Signé sur papier", "📋 Tous les devis", "Enregistre qu'un papier a été signé ; l'original reste à la boutique."],
        ["✅ Accepter / ❌ Rejeter", "📋 Tous les devis", "Décide du plan de règlement (administrateur principal)."],
        ["📄 Télécharger mon contrat", "Espace client", "Le client télécharge son contrat une fois payé."],
      ]}],
      ["h3", "Les pastilles d'un contrat"],
      ["table", { entetes: ["Pastille", "Ce qu'elle dit"], largeurs: [3100, 6200], lignes: [
        ["En attente de paiement (ambre)", "Le règlement n'est pas soldé : pour un devis d'installation, il n'est pas encore encaissé ; pour une pose seule, sa dette n'est pas à zéro."],
        ["📝 Signé sur papier", "L'original est archivé à la boutique indiquée (au survol)."],
        ["🏪 Signé en boutique", "Signé à l'écran, devant l'administrateur principal."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Le numéro de contrat** (CTR-année-8 caractères) est attribué à la signature — ou dès l'impression pour un papier — puis **ne change plus**, même après une correction.",
        "**Le contrat imprimé** porte : pour BMI, le rôle de celui qui a établi le devis (« Le Commercial », « Le Vendeur »…), **sa signature personnelle et le cachet** ; pour le client, sa signature (ou « Signé sur papier ») ; « Fait à Lomé, le … », et la boutique de paiement pour un contrat d'installation.",
        "**Deux textes de contrat** : « CONTRAT DE FOURNITURE D'INSTALLATION… » (solaire, motorisation, autre) et « CONTRAT DE PRESTATION DE POSE » (le matériel est au client ; 70 % avant les travaux, 30 % au PV ou dans les 3 jours).",
        "**Une entreprise cliente** : le contrat la nomme, avec son téléphone, NIF et RCCM, « représentée par » la personne qui signe (chapitre 13).",
        "**Validation d'un devis d'installation** : une commande en attente dans la boutique choisie, le prospect marqué « a dit oui ». **Pose seule** : le chantier et la dette, 70 % attendus.",
        "**Le plan de règlement** n'est demandé **que s'il reste un solde** après l'acompte. Un devis sans acompte défini se paie en totalité d'avance : aucune question.",
        "**L'échéancier** tombe juste : la dernière mensualité est ajustée (900 000 F à 200 000 F/mois = quatre fois 200 000 et une fois 100 000). Il se compte **en cumul** : un client qui verse deux mensualités d'un coup a pour prochaine échéance la troisième.",
        "**Une offre expirée** (plus de 15 jours) se signe quand même : la question le dit, et le devis garde la marque « ⌛ Validé après expiration » pour le vendeur (chapitre 13).",
        "**Un devis signé puis corrigé** : le client re-signe ; même numéro, **l'ancienne signature est archivée**, le **plan de règlement repart à valider**.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["table", { entetes: ["Module", "Le lien"], largeurs: [3100, 6200], lignes: [
        ["☀️ Dimensionnement (ch. 11-12)", "Le devis naît là. Sans signature personnelle, il ne part pas."],
        ["📋 Tous les devis (ch. 13)", "Le statut Validé, la signature en boutique, le plan de règlement, la demande de modification d'un devis signé."],
        ["💰 Ventes / 🧾 Commandes (ch. 5)", "La commande en attente s'encaisse ; le devis passe Payé et le chantier est créé."],
        ["📋 Dettes (ch. 7)", "Le solde vit sur une dette ; un plan accepté donne ses dates aux rappels WhatsApp (rappel d'échéance)."],
        ["🏠 Clients installés (ch. 15)", "Programmation, PV de réception, avenant ; le 📄 Voir le PV de la liste des contrats."],
        ["Espace client (ch. 21)", "Signature, suivi du paiement, 📄 Mes contrats."],
      ]}],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Ma signature est enregistrée dans 📄 Contrats.",
        "Pour un devis d'installation, la boutique de paiement est la bonne.",
        "S'il reste un solde, le plan de règlement est rempli et lisible (montant, nombre de versements, dernière date).",
        "Une signature papier porte **le même numéro** que l'application, et l'original est rangé à la boutique.",
        "Un plan en attente est décidé par l'administrateur principal, sans tarder.",
        "La pastille « En attente de paiement » disparaît une fois le règlement soldé.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "La bonne façon"], largeurs: [4300, 5000], lignes: [
        ["Attendre le jour du devis pour enregistrer sa signature.", "L'enregistrer le premier jour : sans elle, l'envoi est refusé."],
        ["Promettre au client qu'il téléchargera son contrat tout de suite.", "Il se télécharge **une fois le règlement soldé** (l'administrateur, toujours)."],
        ["Faire signer un papier sans l'avoir imprimé depuis l'application.", "**🖨 Imprimer pour signature papier** d'abord : le numéro est attribué et conservé. Sinon un numéro est donné au moment de 📝 Signé sur papier, et il faut le reporter à la main."],
        ["Jeter l'original papier une fois « 📝 Signé sur papier » enregistré.", "L'original est **archivé à la boutique** : c'est la preuve."],
        ["Dire au client que son plan mensuel est accepté.", "Seul l'**administrateur principal** accepte ; tant que ce n'est pas fait, le client lit « En attente de l'accord »."],
        ["Programmer une pose seule avant les 70 %.", "Refusé par l'application : encaisser d'abord l'acompte (chapitre 15)."],
        ["Chercher le contrat d'un collègue dans 📄 Contrats.", "Chacun ne voit que ses devis ; l'administrateur et le responsable commercial voient tout."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Un nouveau commercial veut envoyer son premier devis ; l'envoi est refusé.", reponse: "Sa signature n'est pas enregistrée. 📄 Contrats → **✍️ Enregistrer ma signature**, signer, **✍️ Enregistrer** ; puis renvoyer le devis." },
        { situation: "Devis solaire de 3 000 000 F, acompte 70 % (2 100 000 F). Le client choisit 200 000 F chaque fin de mois à partir du 31/10/2026.", reponse: "Solde : **900 000 F**. Échéancier : 200 000 F les 31/10, 30/11, 31/12/2026 et 31/01/2027, puis **100 000 F le 28/02/2027** — « 5 versement(s), solde le 28/02/2027 ». S'il a déjà versé 450 000 F, sa prochaine échéance est **200 000 F le 31/12/2026**." },
        { situation: "Même devis, le client propose 5 000 F par mois.", reponse: "Refusé à la signature : « Ce montant étalerait les versements sur plus de dix ans. Augmentez-le. » À 1 000 000 F par mois : « Ce montant mensuel dépasse le solde restant : versez plutôt la totalité. »" },
        { situation: "Un client âgé vient en boutique, il n'a pas de smartphone.", reponse: "L'administrateur principal : **🖨 Imprimer pour signature papier**, le client signe, puis **📝 Signé sur papier** avec la boutique de paiement. L'original est rangé à la boutique." },
        { situation: "Un vendeur voit « En attente de paiement » sur un contrat et ne peut pas l'ouvrir.", reponse: "Le client n'a pas encore payé : le message le dit. Une fois la commande encaissée dans 💰 Ventes, le contrat s'ouvre." },
        { situation: "Pose seule de 400 000 F : le client a tout réglé en deux fois.", reponse: "Sa dette est à zéro : la pastille « En attente de paiement » disparaît et **📄 Voir le contrat** s'ouvre, pour lui comme pour le commercial." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "En **espace formation**, avec le formateur :"],
      ["ol", [
        "Enregistrer sa signature dans 📄 Contrats, puis la modifier.",
        "Envoyer un devis solaire à un client de formation, avec acompte de 70 %.",
        "Se connecter en tant que ce client, choisir la boutique, **✅ JE VALIDE**, proposer un plan mensuel, signer.",
        "Retrouver le contrat dans 📄 Contrats : lire sa pastille, essayer **📄 Voir le contrat**, noter le message.",
        "(Avec l'administrateur principal) accepter le plan ; revenir côté client et lire « Prochain versement ».",
        "Encaisser la commande dans 💰 Ventes, puis rouvrir le contrat.",
      ]],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "a enregistré sa signature et sait pourquoi elle est exigée ;",
        "accompagne un client dans la signature depuis son espace ;",
        "sait qui fait signer en boutique, et comment (écran ou papier) ;",
        "lit un plan de règlement et calcule un échéancier simple ;",
        "sait qui accepte un plan, et ce que le client voit ensuite ;",
        "retrouve un contrat et explique quand il se télécharge ;",
        "distingue contrat d'installation et contrat de pose seule.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Pourquoi un devis ne part-il pas sans votre signature ?",
        "Quand le client doit-il choisir la boutique où il paiera ? Et pour une pose seule ?",
        "Quelles sont les deux façons de régler le solde ?",
        "Qui accepte un plan de règlement ?",
        "Pourquoi imprimer le contrat depuis l'application avant une signature papier ?",
        "Quand un contrat devient-il téléchargeable ?",
        "Que prévoit le contrat de pose seule pour le paiement ?",
        "Un devis signé est corrigé : que devient le numéro de contrat ? Et le plan ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Signature personnelle enregistrée",
      "Accompagne la signature depuis l'espace client",
      "Connaît la signature en boutique (écran, papier)",
      "Lit et calcule un plan de règlement",
      "Sait qui accepte un plan",
      "Retrouve un contrat ; sait quand il se télécharge",
      "Distingue installation et pose seule",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
