// ============================================================
// MANUEL DE FORMATION — CHAPITRE 21 : Espace client
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// App.jsx (les onglets d'un client : 🏠 Mon espace, 💬 Messages,
// 🔒 Mes données, et 📄 Mes contrats le jour du premier contrat signé),
// screens/EspaceClient.jsx (🎁 Un cadeau vous attend, 🤝 Parrainez vos
// proches, 📋 Mes devis — ✅ JE VALIDE, ✏️ Demander une modification,
// ❌ Rejeter ce devis, ⭐ Envoyer mon avis, ⏳ Validé — en attente de votre
// paiement, 🔧 Validé — votre chantier est créé (pose seule, 05/10/2026), 💰 Où en est votre paiement, ✅ Payé, 📄 Télécharger mon
// contrat ; 🏠 Bienvenue : la fiche d'installation, ✉️ Écrire au chef
// d'équipe, 🔔 Votre installation est terminée, 📄 Lire et signer le PV,
// ✅ Travaux réceptionnés, ⚠ Vous avez signalé un problème, 📄 Lire et
// signer l'avenant ; 🔑 Mon mot de passe), screens/MesDonnees.jsx,
// screens/Messagerie.jsx (🛟 Écrire à BMI Togo), screens/ContratsInstallation.jsx,
// lib/reglement.js (resumePlan, prochaineEcheance), lib/rappels.js (offre
// expirée), lib/dossierPersonnel.js, lib/calculs.js (tauxParrain).
// La validation, la modification et le plan de règlement sont détaillés aux
// chapitres 13 et 14 ; la réception (PV) au chapitre 15.
// ============================================================
export const CHAPITRE = {
  numero: 21,
  titre: "Espace client",
  sousTitre: "Ce que le client voit et fait dans son espace : ses devis, son contrat, son paiement, son installation, ses messages, ses données — pour savoir l'accompagner",
  public: "Tout le personnel qui accompagne un client (vendeur, commercial, chef de chantier, administrateur)",
  duree: "45 min, avec un compte client d'entraînement",
  prerequis: "Le chapitre 3 (Clients) : créer un compte client et lui envoyer ses accès. Les chapitres 13 à 15 : devis, contrats, chantiers.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "dire **comment un client entre** dans son espace (gestion.bmitogo.com, ses accès reçus du numéro BMI) ;",
        "lui montrer **où lire un devis**, comment le **valider**, en **demander la modification** ou le **rejeter** ;",
        "lui expliquer **où en est son paiement** et son **plan de règlement** ;",
        "l'accompagner pour **signer le PV** de réception, ou signaler un problème ;",
        "lui montrer **💬 Messages**, **🔒 Mes données** et **le parrainage**.",
      ]],
      ["regle", "**Le téléphone du client ne contient QUE ses données.** Il ne voit ni les autres clients, ni les employés, ni les prix du stock. C'est le serveur qui le garantit, pas l'écran."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4300, 5000], lignes: [
        ["Entrer dans l'espace client", "**Le client**, avec l'identifiant et le mot de passe reçus à la création de son compte (chapitre 3)."],
        ["Valider, faire modifier ou rejeter un devis ; signer le contrat et le PV", "Le client, depuis son espace."],
        ["Écrire au chef d'équipe de son chantier", "Le client, s'il a un chef d'équipe nommé."],
        ["Écrire à toute l'équipe en 1-à-1", "Seulement si l'administrateur lui a donné le **chat libre** (👥 Utilisateurs → ⋯ Gérer)."],
        ["Changer son mot de passe", "Le client, à tout moment (🔑 Mon mot de passe)."],
      ]}],
      ["note", "**Un compte client de formation** voit les mêmes écrans ; ses documents portent le bandeau de formation, et ses demandes ne partent jamais vers le vrai numéro BMI."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Onglet du client", "Ce qu'on y trouve"], largeurs: [3100, 6200], lignes: [
        ["🏠 Mon espace", "De haut en bas : 🎁 le cadeau (s'il y en a un), 🤝 le parrainage, 📋 Mes devis, 🏠 Bienvenue (sa fiche d'installation, son chef d'équipe, la réception), 🔑 Mon mot de passe."],
        ["💬 Messages", "« 🛟 Écrire à BMI Togo » (son fil de support) et, s'il en a un, son chef d'équipe."],
        ["🔒 Mes données", "Ce que BMI garde sur lui, « 🖨 Télécharger mes données (PDF) », ses droits, « Demander une correction » / « Demander la suppression »."],
        ["📄 Mes contrats", "**N'apparaît que le jour où il a signé un premier contrat.**"],
      ]}],
      ["note", "Un devis neuf porte la pastille **« 🆕 Nouveau »** tant que le client ne l'a pas ouvert."],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Lire et valider un devis"],
      ["etapes", [
        { titre: "📋 Mes devis", texte: "« Les propositions d'installation préparées pour vous par BMI Togo. » Chaque devis montre son type (Installation solaire, Motorisation portail/garage, ou sa catégorie), son montant, sa date et qui l'a établi. Un clic le déplie : l'équipement, les quantités, les prix, la remarque **« NB : … »** si le vendeur en a écrit une, le TOTAL." },
        { titre: "« Ce devis vous convient ? »", texte: "Si l'offre a plus de 15 jours, une bande ambre prévient que **les prix sont à confirmer** : le client peut quand même valider." },
        { titre: "✅ JE VALIDE", texte: "Le client choisit **la boutique où il passera régler** (« — Choisir la boutique — »), puis **lit et signe le contrat** à l'écran, et choisit comment régler le solde (en une fois, ou un plan de versements). Le vendeur de cette boutique est prévenu." },
        { titre: "Un devis « à compléter après la visite »", texte: "Si des lignes portent **« Cf. visite »**, le devis n'a qu'un **TOTAL PROVISOIRE** : une bande ambre le dit, et **✅ JE VALIDE n'apparaît pas** — « Vous pourrez le valider dès qu'il sera complété ». Après la visite technique, BMI complète le devis et le renvoie : il se valide alors normalement." },
        { titre: "Ou bien", texte: "**✏️ Demander une modification** (avec ce qu'il veut changer) ou **❌ Rejeter ce devis** (avec son motif). Le motif est lu par BMI." },
      ]],
      ["note", "**Une pose seule** (pas de matériel fourni par BMI) : « Validez-le pour signer le contrat. Nos équipes vous contacteront pour programmer l'intervention. » Le contrat dit **70 % avant les travaux, 30 % au PV** (chapitre 15)."],

      ["h3", "B. Quand BMI demande à modifier un devis déjà signé"],
      ["etapes", [
        { titre: "« ✏️ BMI souhaite modifier votre devis »", texte: "Le motif de BMI s'affiche. **✅ J'accepte la modification** ouvre la porte ; **❌ Je refuse** : « votre devis reste exactement tel que vous l'avez signé »." },
        { titre: "« 🔄 Votre devis a été corrigé — votre accord est demandé »", texte: "L'ancien et le nouveau montant. **✅ J'accepte et je re-signe** (même numéro de contrat, plan de règlement à revalider) ou **❌ Je refuse** (le devis est alors rejeté). Trois aller-retour au plus (chapitre 13)." },
      ]],

      ["h3", "C. Payer, et suivre son paiement"],
      ["etapes", [
        { titre: "« ⏳ Validé — en attente de votre paiement »", texte: "« Passez à la boutique X pour régler … Le vendeur vous attend. » Avec l'adresse, le téléphone et « 🗺️ Voir l'itinéraire sur la carte » si la boutique les a dans ⚙ Paramètres." },
        { titre: "« 💰 Où en est votre paiement »", texte: "Montant total, acompte prévu avant travaux, déjà versé, **Reste à payer**, et chaque versement avec sa date. Avec un plan : « Votre engagement », son état (⏳ en attente de l'accord de BMI TOGO, ❌ refusé avec le motif) et « **Prochain versement** : montant le date » — en rouge « ⚠ Versement en retard » si la date est passée." },
        { titre: "Une pose seule : « 🔧 Validé — votre chantier est créé »", texte: "« Pour que nos équipes programment l'intervention, réglez l'acompte de 70 % : X F, à la boutique Y ou au chef d'équipe sur le terrain. » Puis : « Le solde de 30 % (Z F) se règle à la signature du procès-verbal de réception, ou dans les 3 jours qui suivent. » Dessous, **« 💰 Où en est votre paiement »** : montant total, acompte de 70 %, déjà versé, **Reste à payer**. Les 70 % versés : « ✅ Acompte reçu — nos équipes vous appellent pour programmer l'intervention. » Tout versé : « ✅ Soldé — merci ! »" },
        { titre: "« ✅ Payé — installation programmée »", texte: "« Nos équipes vous contacteront pour convenir de la date. » et **📄 Télécharger mon contrat**." },
      ]],

      ["h3", "D. L'installation et sa réception"],
      ["etapes", [
        { titre: "🏠 Bienvenue", texte: "Type d'installation, date d'installation, **prochain entretien**, téléphone ; le **chef d'équipe** et « ✉️ Écrire au chef d'équipe ». Tant que la fiche n'existe pas : « Elle apparaîtra ici une fois créée par nos équipes. »" },
        { titre: "« 🔔 Votre installation est terminée »", texte: "« Vérifiez l'installation, puis confirmez ci-dessous. » Le lien de signature est parti du numéro WhatsApp BMI ; le client peut aussi **📄 Lire et signer le PV directement ici**. Il signe sans réserve, ou signale un problème." },
        { titre: "Après", texte: "**✅ Travaux réceptionnés** (la date de sa confirmation) ; ou **⚠ Vous avez signalé un problème** (« Nos équipes ont été prévenues et vous recontacteront »), puis, les réserves corrigées, **📄 Lire et signer l'avenant directement ici**." },
      ]],
      ["note", "Sans signature, la réception se fait **toute seule 7 jours** après la déclaration de fin de travaux (chapitre 15)."],

      ["h3", "E. Noter celui qui est venu"],
      ["p", "Sous un devis : « ⭐ Comment s'est passée votre rencontre avec … ? » Une note de 1 à 5 étoiles par critère, un commentaire facultatif, **⭐ Envoyer mon avis**. « Votre avis est anonyme pour lui — il ne sert qu'à la direction de BMI Togo. » On ne note qu'une fois."],

      ["h3", "F. Parrainer"],
      ["etapes", [
        { titre: "🤝 Parrainez vos proches", texte: "« Nom de votre filleul », « Son numéro », « Son besoin (facultatif) », puis **🤝 Parrainer** : un compte est créé pour le filleul, et WhatsApp s'ouvre **sur le téléphone du client** pour le prévenir — c'est lui qui recommande." },
        { titre: "Ses gains", texte: "Il touche **le pourcentage affiché** du montant de l'installation du filleul, **quand elle est réceptionnée ET entièrement payée**. Trois cases : À vous verser, En attente de réception, Déjà reçu ; et « Mes filleuls » avec l'état de chacun." },
      ]],

      ["h3", "G. Ses messages, son mot de passe, ses données"],
      ["ul", [
        "**💬 Messages → 🛟 Écrire à BMI Togo** : son message va à l'administration, aux techniciens de son chantier et à son commercial (chapitre 20).",
        "**🔑 Mon mot de passe → Changer mon mot de passe** : « Ne le partagez avec personne. » Il se connecte toujours avec son NOM.",
        "**🔒 Mes données** : le résumé, « 🖨 Télécharger mes données (PDF) » (jamais son mot de passe dedans), ses droits et combien de temps on garde ses données. **« Demander une correction » / « Demander la suppression »** ouvrent WhatsApp **sur son téléphone**, vers le **numéro WhatsApp BMI** : sa demande arrive dans 📲 WhatsApp de l'application.",
        "**🎁 Un cadeau vous attend !** : ce que BMI lui offre, et la boutique où le retirer.",
      ]],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton", "Où", "Ce qu'il fait"], largeurs: [2900, 2200, 4200], lignes: [
        ["✅ JE VALIDE", "Un devis proposé", "Boutique de paiement, lecture et signature du contrat, plan de règlement."],
        ["✏️ Demander une modification / ❌ Rejeter ce devis", "Un devis proposé", "Demande un changement ou refuse, avec un motif."],
        ["✅ J'accepte la modification / ❌ Je refuse", "Un devis signé que BMI veut modifier", "Ouvre ou ferme la porte à la correction."],
        ["✅ J'accepte et je re-signe / ❌ Je refuse", "Un devis corrigé", "Re-signe, ou rejette le devis."],
        ["⭐ Envoyer mon avis", "Sous un devis", "Note celui qui est venu, une fois."],
        ["🗺️ Voir l'itinéraire sur la carte", "Devis validé", "Ouvre la boutique de paiement sur la carte."],
        ["📄 Télécharger mon contrat", "Devis payé", "Le contrat signé."],
        ["✉️ Écrire au chef d'équipe", "🏠 Bienvenue", "Ouvre 💬 Messages."],
        ["📄 Lire et signer le PV / l'avenant directement ici", "Installation terminée / réserves", "La signature dans l'espace, sans le lien."],
        ["🤝 Parrainer", "Parrainage", "Crée le compte du filleul et le prévient du téléphone du client."],
        ["Changer mon mot de passe", "🔑 Mon mot de passe", "Un nouveau mot de passe."],
        ["🖨 Télécharger mes données (PDF)", "🔒 Mes données", "Le dossier de tout ce que BMI garde sur lui."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Valider un devis prévient** le vendeur de la boutique choisie ; un devis validé ou corrigé laisse sa trace (date, signature archivée).",
        "**La dette du client** se crée à la validation (ou à l'encaissement) : c'est elle que lit « 💰 Où en est votre paiement ».",
        "**Le prochain versement** se calcule depuis son plan accepté et ce qu'il a déjà versé.",
        "**Les informations de la boutique** (adresse, téléphone, carte) sont lues en direct sur sa fiche dans ⚙ Paramètres.",
        "**Un devis classé sans suite** se lit « 📁 Ce devis n'est plus d'actualité » — jamais le motif interne.",
        "**Son espace ne télécharge que ses données** : le serveur refuse le reste.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["table", { entetes: ["Module", "Le lien"], largeurs: [3100, 6200], lignes: [
        ["🙋 Créer un client / 👥 Utilisateurs (ch. 2, 3)", "Le compte, ses accès, le chat libre."],
        ["📋 Tous les devis (ch. 13)", "Ce qu'il valide, demande, refuse arrive là ; la relance du 8e jour vient de là."],
        ["📄 Contrats (ch. 14)", "Le contrat qu'il signe, son plan de règlement à accepter."],
        ["🏠 Clients installés (ch. 15)", "Sa fiche d'installation, le PV, les réserves, l'avenant, l'entretien."],
        ["Commissions (ch. 16)", "Sa part de parrain."],
        ["💬 Messages / 📲 WhatsApp (ch. 20)", "Ses messages ; ses demandes 🔒 Mes données arrivent dans 📲."],
        ["⚙ Paramètres (ch. 23)", "La durée de conservation des données, les fiches des boutiques."],
      ]}],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Le client a reçu ses accès et sait se connecter.",
        "Son devis porte la bonne boutique de paiement.",
        "La boutique de paiement a son adresse et son téléphone dans ⚙ Paramètres.",
        "Son plan de règlement est accepté (pas « ⏳ En attente de l'accord de BMI TOGO »).",
        "Sa fiche d'installation existe, avec son chef d'équipe.",
        "Le PV est signé, ou les réserves suivies.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "La bonne façon"], largeurs: [4300, 5000], lignes: [
        ["Dire au client de se connecter avec son numéro.", "Il se connecte avec son NOM (l'identifiant reçu) et son mot de passe."],
        ["Lui faire valider un devis sans choisir la boutique.", "La boutique de paiement est demandée : c'est là que le vendeur l'attend."],
        ["Chercher « 📄 Mes contrats » chez un client qui n'a rien signé.", "L'onglet n'apparaît qu'après un premier contrat signé."],
        ["Lui dire que sa part de parrain arrive à la réception.", "Réception ET paiement complet du filleul."],
        ["Laisser une demande « Mes données » sur un téléphone de boutique.", "Elle arrive maintenant dans 📲 WhatsApp : on y répond."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "M. KOFFI reçoit un devis solaire de 850 000 F et veut payer en trois fois.", reponse: "📋 Mes devis → ✅ JE VALIDE → boutique BMI DEMAKPOE → il lit et signe le contrat → il choisit un plan de versements. « ⏳ En attente de l'accord de BMI TOGO » jusqu'à ce que BMI accepte." },
        { situation: "Il demande combien il doit encore.", reponse: "« 💰 Où en est votre paiement » : Reste à payer, et « Prochain versement : montant le date »." },
        { situation: "Les travaux sont finis, mais un panneau est mal fixé.", reponse: "Il ouvre le PV (lien WhatsApp ou « 📄 Lire et signer le PV directement ici ») et signale la réserve. Une fois corrigé, il signe l'avenant." },
        { situation: "Il veut faire corriger son adresse dans ses données.", reponse: "🔒 Mes données → « Demander une correction » : WhatsApp s'ouvre sur son téléphone vers le numéro BMI ; la demande arrive dans 📲 WhatsApp." },
        { situation: "Il présente son voisin AMA.", reponse: "🤝 Parrainez vos proches : nom, numéro, besoin, 🤝 Parrainer. Il touchera sa part quand l'installation d'AMA sera réceptionnée et payée." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "En **espace formation**, avec un compte client d'entraînement :"],
      ["ol", [
        "Se connecter avec le compte client ; parcourir les trois onglets.",
        "Ouvrir un devis, constater « 🆕 Nouveau », le valider avec une boutique et un plan.",
        "(Côté BMI) Accepter le plan ; (côté client) lire « Prochain versement ».",
        "Changer le mot de passe du client, se reconnecter.",
        "Télécharger le dossier de 🔒 Mes données ; lire ce qu'il contient.",
        "Parrainer un filleul d'entraînement.",
      ]],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "guide un client jusqu'à la validation d'un devis ;",
        "lui explique « Où en est votre paiement » ;",
        "l'accompagne pour signer le PV ou signaler un problème ;",
        "lui montre 💬 Messages, 🔒 Mes données et le parrainage ;",
        "sait ce que le client voit, et ce qu'il ne voit pas.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Avec quoi un client se connecte-t-il ?",
        "Quels onglets voit un client ? Quand « 📄 Mes contrats » apparaît-il ?",
        "Que choisit le client en validant un devis ?",
        "Que dit une offre de plus de 15 jours ?",
        "Où le client lit-il son prochain versement ?",
        "Comment signe-t-il le PV ? Que se passe-t-il s'il ne signe pas ?",
        "Quand le parrain touche-t-il sa part ?",
        "Où arrive une demande de 🔒 Mes données ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Guide la connexion d'un client",
      "Guide la validation d'un devis",
      "Explique le suivi du paiement",
      "Accompagne la signature du PV",
      "Montre Messages, Mes données, parrainage",
      "Sait ce que le client voit et ne voit pas",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
