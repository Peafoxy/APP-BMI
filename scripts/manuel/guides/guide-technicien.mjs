// ============================================================
// GUIDE PAR POSTE — LE TECHNICIEN (à commission et technicien BMI)
// (01/10/2026, « Lance » ; décision « 2 oui » : un seul guide pour les
// deux, avec des encadrés « seulement pour… »).
//
// « Ma journée » reprend le livret du 22/09/2026, RELU dans le code le
// 01/10/2026. Le livret se trompait sur le chef qui tient le registre de
// l'outillage : ce n'est pas « le technicien BMI » seulement, c'est TOUT
// technicien qui porte l'étoile ⭐, à commission ou salarié
// (peutTenirOutillage, 18/09/2026). Il oubliait aussi le dossier de
// chantier (photos, observations), l'explication d'un retard d'outil
// (« Envoyer l'explication ») et le 🛒 Nouvelle commande du technicien à
// commission. Boutons relus : ClientsInstalles.jsx, Outillage.jsx,
// Depenses.jsx, PrimesRecues.jsx, MaCommission.jsx, MesTaches.jsx,
// MonEquipe.jsx, App.jsx.
// ============================================================
export const GUIDE = {
  id: "technicien",
  poste: "Technicien (à commission et technicien BMI)",
  roles: ["technicien", "technicien_bmi"],
  public: "Les techniciens de BMI : à commission (payés par part d'installation) et techniciens BMI (salariés)",
  duree: "2 jours : la journée et les chapitres le premier jour, l'examen le second",
  onglets: ["commande", "dimensionnement", "tous_devis", "contrats", "prospects", "parc", "taches", "equipe", "outillage", "depenses", "commission", "primes_recues", "messages", "whatsapp", "salaire", "nouveau_client"],
  chapitres: [1, 3, 4, 5, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 24, 25],

  journee: [
    ["p", "Le technicien **pose les installations**, tient **le dossier de ses chantiers**, répond **des outils qu'il emporte** et note **ses dépenses de chantier**. Il peut aussi trouver des clients et faire des devis, comme un commercial. Il y a deux façons d'être technicien chez BMI : **à commission** (payé par part d'installation) et **technicien BMI** (salarié). Les mots entre guillemets sont ceux des boutons ; le chapitre du manuel est indiqué entre parenthèses."],
    ["table", { entetes: ["Mes onglets", "À quoi ils me servent"], largeurs: [3300, 6000], lignes: [
      ["🏠 Clients installés · ✅ Mes tâches", "Mes chantiers, leur dossier, la fin des travaux ; ce qu'on me confie (chapitre 15)."],
      ["🧰 Mes outils", "Ce que je détiens, le chantier où je l'utilise, l'explication d'un retard (chapitre 19)."],
      ["📤 Dépenses", "« Mes dépenses » : carburant, nourriture, petit matériel, rattachés à un chantier (chapitre 17)."],
      ["💰 Primes reçues", "**À commission** : mes parts d'installation, payées et à percevoir (chapitre 16)."],
      ["💵 Ma commission", "Ce que m'apportent les clients que j'amène ; **technicien BMI** : aussi mes primes d'installation (chapitre 16)."],
      ["💵 Salaire", "**Technicien BMI** : ma paie (chapitre 18)."],
      ["🧲 Prospects · ☀️ Dimensionnement · 📋 Tous les devis · 📄 Contrats", "Trouver un client et lui faire un devis, comme un commercial (chapitres 4 et 11 à 14)."],
      ["🛒 Nouvelle commande", "**À commission** : envoyer le panier d'un client à la boutique (chapitre 5)."],
      ["👑 Mon équipe", "**Seulement si je suis chef ⭐** : suivre mes hommes et leur donner des tâches (chapitre 16)."],
      ["🙋 Créer un client · 💬 Messages · 📲 WhatsApp", "Les clients et les conversations (chapitres 3 et 20)."],
    ] }],

    ["h3", "Le matin"],
    ["etapes", [
      { titre: "Je me connecte", texte: "Barre **bleue** = réel, **violette** = formation. Je regarde 💬 Messages : une sortie d'outil à mon nom, une tâche, une prime payée m'y sont annoncées (chapitres 1 et 20)." },
      { titre: "✅ Mes tâches", texte: "Ce que mon chef ou la direction m'a confié, avec l'échéance." },
      { titre: "🏠 Clients installés", texte: "Les chantiers où je suis dans l'équipe : l'adresse, « 📍 Carte » pour s'y rendre, la date prévue, ce qui est à poser (« ▸ Dossier »)." },
      { titre: "🧰 Mes outils", texte: "Ce que j'ai en main. Si l'onglet porte un chiffre, des outils sont **en retard** : je dois dire pourquoi." },
    ]],

    ["h3", "Sur le chantier — le dossier"],
    ["p", "« ▸ Dossier » sur la ligne du chantier. **Tous les membres de l'équipe** peuvent y écrire :"],
    ["ul", [
      "**« + Ajouter une photo »** : avant, pendant, après. Elles restent dans le dossier du chantier.",
      "**« + Ajouter une observation »** : difficulté d'accès, matériel particulier, conseil donné au client. C'est ce qui servira au prochain technicien, par exemple pour l'entretien.",
    ]],

    ["h3", "La fin des travaux"],
    ["etapes", [
      { titre: "« 🏁 Marquer terminé »", texte: "**Le chef de CE chantier** — celui que l'étoile ⭐ désigne dans l'équipe, à la programmation — (ou l'administrateur), quand tout est posé. Le lien de signature du PV part au client du numéro BMI." },
      { titre: "La réception", texte: "Le client **signe le PV** depuis son espace ou par le lien ; sans signature, BMI peut constater la réception. **C'est la réception qui débloque les parts** de l'équipe et les commissions." },
      { titre: "Ma part", texte: "L'administrateur répartit les frais d'installation entre les techniciens présents (le chef touche un peu plus). La part est payée par la caisse d'une boutique ; je suis prévenu dans 💬 Messages." },
    ]],
    ["note", "**Seulement pour le technicien à commission** : ma part se lit dans **💰 Primes reçues** (« ⏳ En attente de paiement », « ✅ Déjà payé »). **Seulement pour le technicien BMI** : dans **💵 Ma commission** (« ⏳ À percevoir »), en plus de son salaire."],

    ["h3", "Mes dépenses de chantier — 📤 Dépenses"],
    ["ul", [
      "L'écran s'appelle **« Mes dépenses »** : je ne vois que les miennes.",
      "Je choisis la catégorie (Carburant, Nourriture…), le montant, et **« Payé avec »** — souvent **une avance personnelle** si j'ai payé de ma poche : on me la remboursera.",
      "**« Chantier à rattacher »** : je choisis le chantier. La dépense sera retirée des frais d'installation **avant** le partage entre les techniciens.",
      "À partir de 5 000 F, la dépense attend la validation du DG.",
    ]],

    ["h3", "Mes outils — 🧰 Mes outils"],
    ["regle", "**Un outil est toujours sous le nom de quelqu'un.** Quand je l'emporte, il est sous le MIEN jusqu'à ce que je le rende — pas sous le nom du chantier."],
    ["ul", [
      "Je vois chaque outil que je détiens, pour quel chantier, qui me l'a remis, et le retour prévu.",
      "**« 🏗 Changer le chantier »** : je passe au chantier suivant **sans ramener l'outil**. Il reste chez moi, avec la même date de retour.",
      "**En retard** : une bande rouge le dit ; j'écris pourquoi dans « Pourquoi l'outil n'est pas encore rentré » puis **« Envoyer l'explication »**.",
      "**Une boîte à outils** : **« 🧰 Compter la boîte »** avant de la rendre — je valide moi-même ce que je ramène. Ce qui manque se voit.",
      "**Le retour lui-même** est enregistré par celui qui tient le registre (magasinier, chef ⭐, administrateur), jamais par moi : sinon la trace ne vaudrait rien.",
    ]],
    ["attention", "Un outil **perdu** est déclaré par celui qui tient le registre, avec un motif. L'administrateur peut demander un remboursement : **à commission**, il est retenu sur ma **prochaine part d'installation** ; **technicien BMI**, sur mon **salaire** (comme une avance du mois). Il peut aussi décider que la perte reste à la charge de BMI."],

    ["h3", "Trouver un client et faire un devis"],
    ["p", "Comme un commercial : 🧲 Prospects (« Nouveau prospect », « 📱 Relancer », « ✅ Convertir en client »), ☀️ Dimensionnement et « 📲 Envoyer par WhatsApp » — tout part du numéro BMI —, puis 📋 Tous les devis pour suivre. Une commission n'est due qu'après la **réception des travaux ET le solde** du client (chapitres 4, 11 à 13, 16)."],
    ["note", "**Seulement pour le technicien à commission** : 🛒 Nouvelle commande, pour envoyer le panier d'un client à la boutique, qui encaisse (chapitre 5)."],

    ["h3", "Si je suis chef ⭐"],
    ["p", "L'administrateur peut nommer chef d'équipe un technicien, **à commission ou BMI**. Le chef :"],
    ["ul", [
      "a **👑 Mon équipe** : il suit ses hommes, leur donne une tâche (« ✅ Tâche »), la valide (« ✅ Valider ») ou la rouvre (« ↩ Rouvrir ») ;",
      "**tient le registre de 🧰 Outillage** avec le magasinier et l'administrateur : sorties, retours, comptage des boîtes, appel de la semaine (l'onglet s'appelle alors « 🧰 Outillage ») ;",
    ]],

    ["h3", "Le soir"],
    ["p", "Je saisis mes dépenses du jour et je les rattache au chantier, j'ajoute mes photos et mes observations au dossier, je termine mes tâches (« ✅ Terminer »), et si un outil ne rentre pas à la date prévue, j'explique pourquoi."],
  ],

  examen: {
    intro: "L'examen se passe **dans l'espace de formation** (barre violette), avec le formateur à côté. La personne fait chaque épreuve seule ; le formateur regarde l'écran et coche. Une épreuve est réussie quand on voit à l'écran ce que dit la colonne « Ce qu'on doit voir ». Le formateur prépare avant : un chantier programmé avec la personne dans l'équipe, un outil et une boîte à outils sortis à son nom (un des deux avec une date de retour passée), une tâche. L'épreuve 10 demande que la personne soit le chef de ce chantier ; la 11, qu'elle soit chef d'équipe ⭐ (nommée par l'administrateur) — deux choses différentes.",
    epreuves: [
      { titre: "Trouver son chantier", consigne: "Retrouver le chantier préparé et ouvrir son dossier.", attendu: "Le chantier apparaît ; « ▸ Dossier » s'ouvre à l'écran, avec l'adresse et ce qui est à poser." },
      { titre: "Photo et observation", consigne: "Ajouter une photo et une observation au dossier.", attendu: "La photo apparaît dans « 📷 Photos du chantier » ; l'observation dans « 📝 Observations du technicien », avec le nom de la personne." },
      { titre: "Dépense de chantier", consigne: "Enregistrer 3 000 F de carburant payés avec une avance personnelle, rattachés au chantier.", attendu: "La dépense apparaît dans « Mes dépenses » avec le chantier ; l'avance est due à la personne." },
      { titre: "Changer de chantier", consigne: "Passer l'outil sorti à un autre chantier sans le ramener.", attendu: "L'outil reste chez la personne, avec la même date de retour, et le nouveau chantier." },
      { titre: "Expliquer un retard", consigne: "Expliquer le retard de l'outil dont la date de retour est passée.", attendu: "La bande rouge disparaît pour cet outil ; l'explication se lit dans le registre (vue « En retard »)." },
      { titre: "Compter une boîte", consigne: "Compter la boîte à outils avant de la rendre, en indiquant une pièce manquante.", attendu: "Le comptage est enregistré ; le manque est signalé sur la boîte. L'outil n'est pas encore rentré." },
      { titre: "Terminer une tâche", consigne: "Terminer la tâche préparée avec une photo.", attendu: "La tâche part en validation chez celui qui l'a donnée." },
      { titre: "Ma part", consigne: "Ouvrir 💰 Primes reçues (à commission) ou 💵 Ma commission (BMI) et expliquer une ligne en attente.", attendu: "La personne dit ce qu'on attend : la réception des travaux, ou le paiement par la caisse." },
      { titre: "Un prospect", consigne: "Enregistrer un prospect rencontré sur un chantier, avec son projet.", attendu: "La fiche est créée à son nom dans 🧲 Prospects." },
      { titre: "Marquer terminé (chef du chantier)", consigne: "Sur un chantier dont la personne est le chef, marquer les travaux terminés.", attendu: "Le chantier passe « terminé » ; le lien de signature du PV est préparé pour le client." },
      { titre: "Sortie d'outil (chef d'équipe)", consigne: "Sortir un outil pour un autre technicien, puis enregistrer son retour.", attendu: "L'outil est sous le nom du technicien, puis rangé ; un clic sur la ligne montre qui l'a pris et à qui il a été rendu." },
    ],
    questions: [
      "Qu'est-ce qui débloque ma part d'installation ?",
      "Pourquoi un outil reste-t-il à mon nom tant que je ne l'ai pas rendu ?",
      "Je finis le chantier A et je pars sur le chantier B avec la perceuse : que fais-je dans l'application ?",
      "À quoi sert de rattacher une dépense à un chantier ?",
      "Qui enregistre le retour d'un outil, et pourquoi pas moi ?",
    ],
  },
};
