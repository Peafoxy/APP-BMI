// ============================================================
// GUIDE PAR POSTE — L'ADMINISTRATEUR (01/10/2026, « Non... Il. Faut. Le
// guide de l'administrateur aussi. Ensuite l'examen »).
//
// La décision « 1 oui » du même jour (pas de guide administrateur : il a
// le manuel complet) est RETOURNÉE par Timo : l'administrateur a SON guide,
// comme les autres — sa journée, les 25 chapitres, puis son examen.
// Deux niveaux, dans des encadrés : l'administrateur, et l'administrateur
// PRINCIPAL (le DG), seul à traverser le mur formation / réel.
// Boutons relus : Depenses.jsx (« ⏳ Dépenses à valider par le DG »),
// Caisse.jsx (« 💸 Versements à valider par le DG »), Utilisateurs.jsx
// (« Créer un compte employé », 🔐 Pouvoirs, 🎭 Rôle, ⛔ Bloquer, Nommer
// chef, 🏦 Crédits BMI), ClientsInstalles.jsx (📅 Programmer, 🔧 Frais,
// « ✅ Valider la répartition », « Forcer sans signature », « ✅ Entretien
// fait »), Ventes.jsx (↩ Reprise), Salaires.jsx (💸 Payer le salaire, 🖨 Bulletin,
// 🏦 CNSS), Dashboard.jsx et CompteExploitant.jsx (➕ Apport, ➖
// Prélèvement), Parametres.jsx (👁 Je regarde, ses sept onglets), App.jsx.
// ============================================================
export const GUIDE = {
  id: "administrateur",
  poste: "Administrateur",
  roles: ["admin"],
  public: "Les administrateurs de BMI, et l'administrateur principal (le DG)",
  duree: "4 jours : la journée et les chapitres les trois premiers jours, l'examen le quatrième",
  onglets: ["dashboard", "rentabilite", "ventes", "commandes", "dimensionnement", "tous_devis", "contrats", "depenses", "chez_comptable", "dettes", "clients", "caisse", "stocks", "fournisseurs", "commerciaux", "equipe", "prospects", "parc", "travaux", "outillage", "messages", "whatsapp", "salaires", "users", "historique", "parametres"],
  chapitres: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],

  journee: [
    ["p", "L'administrateur **voit tout son espace et fait tout ce que font les autres** — vendre, encaisser, tenir le stock, faire un devis. Il porte en plus **les gestes qu'aucun autre rôle n'a** : les comptes et leurs pouvoirs, les prix, les suppressions, les remises au-delà de 3 %, les chantiers, la paie, les réglages. Les mots entre guillemets sont ceux des boutons ; le chapitre du manuel est indiqué entre parenthèses."],
    ["regle", "**Il y a deux niveaux.** L'**administrateur** a tous les onglets. L'**administrateur principal** — le DG, un seul — a en plus les gestes « moi seul » : traverser le mur formation / réel, valider les dépenses et les versements, le mot de passe et le rôle d'un autre compte, la reprise d'un article, la corbeille, les données personnelles, le compte de l'exploitant. Ces gestes sont dans les encadrés « Seulement pour l'administrateur principal »."],
    ["table", { entetes: ["Mes onglets", "À quoi ils me servent"], largeurs: [3300, 6000], lignes: [
      ["📊 Tableau de bord · 📈 Rentabilité · 🕘 Historique", "Les chiffres par boutique et par période, les caisses centrales, les exports ; qui a fait quoi (chapitre 22)."],
      ["💰 Ventes · 📥 Commandes reçues · 🧾 Dettes · 👤 Clients · 🔒 Caisse", "La vente et l'argent qui entre, comme en boutique (chapitres 3, 5, 6 et 7)."],
      ["☀️ Dimensionnement · 📋 Tous les devis · 📄 Contrats · 🧲 Prospects", "Les devis et les contrats de tout le monde, les prospects de l'espace (chapitres 4, 11 à 14)."],
      ["📤 Dépenses · 🧾 Chez le comptable · 💵 Salaires", "L'argent qui sort, la caisse du comptable, la paie et la CNSS (chapitres 17 et 18)."],
      ["📦 Stocks · 🚚 Fournisseurs", "Les articles, leurs prix, le magasin, les fournisseurs (chapitres 8, 9 et 10)."],
      ["🏠 Clients installés · 🛠 Travaux à crédit · 🧰 Outillage", "Les chantiers, leur programmation, leurs frais ; les travaux à crédit ; le registre des outils (chapitres 15 et 19)."],
      ["🎯 Commerciaux · 👑 Équipe", "Les objectifs, les commissions, les chefs d'équipe, les apporteurs externes (chapitre 16)."],
      ["💬 Messages · 📲 WhatsApp", "L'équipe, et toutes les conversations du numéro BMI (chapitre 20)."],
      ["👥 Utilisateurs · ⚙ Paramètres", "Les comptes, les rôles, les pouvoirs ; les boutiques et tous les réglages (chapitres 2 et 23)."],
    ] }],

    ["h3", "Le matin — ce qui m'attend"],
    ["etapes", [
      { titre: "La couleur", texte: "Barre **bleue** = réel, **violette** = formation. Ce que je crée naît dans l'espace que je regarde." },
      { titre: "Les chiffres à côté des onglets", texte: "📥 Commandes reçues, 📋 Tous les devis, 📦 Stocks (transferts à valider), 🏠 Clients installés, 👥 Utilisateurs (demandes de crédit), 📲 WhatsApp : chacun compte ce qui m'attend." },
      { titre: "📊 Tableau de bord", texte: "« Aujourd'hui » d'office. Les pastilles en haut : **TOUTES**, chaque boutique, TERRAIN, 🧾 COMPTABLE, les comptes 📱 FLOOZ / MIXX. Une pastille choisie filtre tout l'écran (chapitre 22)." },
      { titre: "🔒 Caisse", texte: "La bande orange d'une boutique dont la journée n'est **pas clôturée** : ses ventes sont bloquées tant qu'elle ne l'est pas. Une clôture **dépassée** (une vente après la clôture) se signale et se refait (chapitre 6)." },
      { titre: "🏠 Clients installés", texte: "Les chantiers **📅 À programmer**, les entretiens qui arrivent, les réceptions en attente (chapitre 15)." },
    ]],
    ["note", "**Seulement pour l'administrateur principal** : deux cadres permanents l'attendent chaque matin, **« ⏳ Dépenses à valider par le DG »** dans 📤 Dépenses (à partir de 5 000 F) et **« 💸 Versements à valider par le DG »** dans 🔒 Caisse (Chez le DG, BANQUE), boutique par boutique. « ✅ Valider » ou « ✖ Rejeter » avec un motif. **Une dépense en espèces qui attend bloque la clôture de sa boutique** : la valider avant la fermeture."],

    ["h3", "Les comptes — 👥 Utilisateurs"],
    ["ul", [
      "**Créer un compte** : le formulaire en haut de l'écran — nom, **prénom**, téléphone, mot de passe, rôle, boutique —, puis « Créer ». Un identifiant déjà pris est refusé, avec un nom libre proposé. Les accès partent sur WhatsApp depuis mon téléphone (chapitre 2).",
      "**🔐 Pouvoirs** : retirer à quelqu'un un onglet ou une action (« Onglets accessibles », « Actions autorisées »), sans changer son rôle ; « Tout rétablir ».",
      "**⛔ Bloquer / ✅ Réactiver**, **🆔 Identité**, **📞 Téléphone**, **🏦 Banque**, **🏬 Boutique**, **Nommer chef** (⭐), les taux de commission — dans « ⋯ Gérer ».",
      "**🏦 Crédits BMI** : les demandes de crédit des employés, et leurs retenues.",
      "⚠ **Tout changement de rôle, de boutique ou de pouvoir prend effet à la prochaine connexion** de la personne.",
    ]],
    ["note", "**Seulement pour l'administrateur principal** : **🔑 le mot de passe** d'un autre compte, **🎭 Rôle** (changer le rôle d'un compte — jamais un client, jamais sa propre fiche), le **transfert du rôle** de principal."],

    ["h3", "L'argent"],
    ["ul", [
      "**Supprimer** une vente, une dette, une dépense, un article : l'administrateur seul, avec une trace au journal (chapitres 5, 7, 8, 17).",
      "**Une remise au-delà de 3 %** (devis, vente, proforma, commande) : l'administrateur seul. Une remise sur un article ET une remise générale ensemble : refusé pour tout le monde, administrateur compris.",
      "**💵 Salaires** : la paie du mois par employé, **« 💸 Payer le salaire »**, **« 🖨 Bulletin »**, et l'onglet **🏦 CNSS** (« 📥 Générer le fichier DRC (Excel) ») (chapitre 18).",
      "**🚚 Fournisseurs**, **🎯 Commerciaux** et **👑 Équipe** : les commandes et règlements, les objectifs, les commissions (payées seulement après réception **et** solde du client), les apporteurs externes (« ✓ Payer », « ✏️ Moyen ») (chapitres 10 et 16).",
      "**🔒 Caisse → « 💼 Avances de frais à rembourser »** : en espèces, avec le salaire, ou par le DG.",
    ]],
    ["note", "**Seulement pour l'administrateur principal** : la **↩ Reprise** d'un article vendu (le client ne le veut plus) dans 💰 Ventes ; la **✏️ modification** de la catégorie ou de la description d'une dépense ; le **💼 fonds de caisse** de chaque boutique (⚙ Paramètres → 🏪 Boutiques, le NOUVEAU montant : le DG apporte ou reprend la différence) ; les pastilles **👤 DG** et **🏦 BANQUE** du tableau de bord, et dans 👤 DG le **compte de l'exploitant** : « ➕ Apport », « ➖ Prélèvement » (motif obligatoire, jamais une charge)."],

    ["h3", "Le stock"],
    ["p", "Dans 📦 Stocks, l'administrateur est le seul à fixer le **prix d'achat**, le **prix de vente** et la **quantité initiale** d'un article. Il voit tous les magasins et toutes les boutiques de son espace, fait les entrées, l'inventaire, les transferts, et valide les transferts reçus (chapitres 8 et 9)."],

    ["h3", "Les chantiers — 🏠 Clients installés"],
    ["etapes", [
      { titre: "« 📅 Programmer l'installation »", texte: "La date, l'équipe et son chef ⭐ (avec le responsable commercial). Une pose seule attend ses 70 % : l'application refuse sinon." },
      { titre: "La fiche du chantier", texte: "Adresse, garantie, délai, entretien, cadeau, frais, primes, lien du PV, avenant : **l'administrateur seul** les écrit." },
      { titre: "« 🏁 Marquer terminé » et la réception", texte: "Le chef du chantier ou l'administrateur. Si le client ne signe jamais : **« Forcer sans signature »** — un cas exceptionnel, qui laisse sa trace." },
      { titre: "« 🔧 Frais » puis « ✅ Valider la répartition »", texte: "La part de BMI d'abord, puis le reste entre les techniciens présents, le chef à +7 % ; les petites dépenses rattachées sont déduites avant le partage." },
      { titre: "« ✅ Entretien fait »", texte: "La date faite, la prochaine proposée à +6 mois ; la tâche automatique de l'entretien se ferme." },
    ]],
    ["p", "Dans 🧰 Outillage, l'administrateur **ajoute** un outil (le numéro gravé s'attribue tout seul), le **réforme**, le corrige, déclare une **perte** et décide d'une retenue (chapitre 19)."],

    ["h3", "Le mur formation / réel — ⚙ Paramètres"],
    ["regle", "**Un compte, une boutique, une donnée appartiennent à UN espace.** L'administrateur placé en formation ne voit jamais les chiffres réels. **Seul l'administrateur principal traverse le mur**, par **« 👁 Je regarde »** en haut de ⚙ Paramètres : l'application devient violette, et c'est l'espace REGARDÉ qui décide de tout ce qu'il voit et crée."],
    ["ul", [
      "**🏪 Boutiques** : créer une boutique ou un magasin (et dire s'il est loué : la fiche du loyer), ses comptes mobiles, ses banques, le prix du rail, la durée de stock à prévoir (chapitre 23).",
      "**🗂 Catalogue & devis** : les métiers, les frais, l'**🤖 Assistant du numéro WhatsApp BMI** (le principal le coupe ou change son mode), la demande d'avis Google.",
      "**🔌 Appareils** : le catalogue du volet solaire, et les appareils « à classer ».",
      "**💾 Données** : exporter une sauvegarde ; **🔐 Sécurité** : les gestes lourds, en dernier.",
    ]],
    ["note", "**Seulement pour l'administrateur principal** : **🎨 Apparence** (l'écran de connexion, le cachet), **🔒 Données personnelles** (le dossier d'un client ou d'un employé, l'effacement d'un client, la durée de conservation), **🗑 Corbeille** (restaurer un chantier, un devis, des travaux supprimés depuis moins de 30 jours), la restauration d'une sauvegarde."],

    ["h3", "Quand quelque chose bloque"],
    ["ul", [
      "**Une bande rouge « opération(s) n'arrivent pas à partir »** : le serveur a refusé un geste, et tout le lot attend derrière. L'administrateur principal peut **« 🗑 Abandonner ce geste refusé »** après avoir lu le motif (chapitres 24 et 25).",
      "**🕘 Historique** : retrouver qui a fait quoi et quand avant de corriger quoi que ce soit.",
      "**Une règle qui change côté serveur** (un script à coller dans Supabase) : on le colle soi-même, jamais un tiers ; l'effet arrive à la prochaine connexion de chacun.",
    ]],

    ["h3", "Le soir"],
    ["p", "Je vérifie que chaque boutique a clôturé sa journée, que les dépenses et les versements en attente du DG sont traités, que les conversations WhatsApp confiées ont une réponse avant la fin de leurs 24 h, et que les chantiers terminés avancent vers leur réception."],
  ],

  examen: {
    intro: "L'examen se passe **dans l'espace de formation** (barre violette), avec le formateur à côté ; pour l'administrateur principal, il bascule d'abord avec « 👁 Je regarde ». La personne fait chaque épreuve seule ; le formateur regarde l'écran et coche. Une épreuve est réussie quand on voit à l'écran ce que dit la colonne « Ce qu'on doit voir ». Les épreuves 11 à 14 sont pour l'administrateur principal. Les épreuves de vente, de stock et de devis des autres guides peuvent être ajoutées.",
    epreuves: [
      { titre: "Créer un employé", consigne: "Créer un compte vendeur dans une boutique de formation, avec un identifiant déjà pris par un autre compte.", attendu: "Le refus nomme qui détient l'identifiant et propose un nom libre ; avec le nom proposé, le compte est créé." },
      { titre: "Retirer un pouvoir", consigne: "Retirer l'onglet 🔒 Caisse à ce vendeur, puis « Tout rétablir ».", attendu: "La case se décoche puis revient ; le chiffre des pouvoirs retirés suit." },
      { titre: "Nommer un chef", consigne: "Nommer chef d'équipe un commercial de formation.", attendu: "L'étoile ⭐ apparaît sur sa pastille ; il aura 👑 Mon équipe à sa prochaine connexion." },
      { titre: "Prix d'un article", consigne: "Corriger le prix de vente d'un article dans 📦 Stocks.", attendu: "La confirmation dit l'ancien et le nouveau prix ; le journal le garde." },
      { titre: "Remise de 5 %", consigne: "Faire un devis avec une remise générale de 5 %, puis ajouter aussi une remise sur un article.", attendu: "La remise de 5 % passe ; les deux remises ensemble sont refusées." },
      { titre: "Programmer un chantier", consigne: "Programmer un chantier « 📅 À programmer » avec une équipe et son chef ⭐.", attendu: "Le chantier quitte « 📅 À programmer », avec sa date et son équipe." },
      { titre: "Répartir les frais", consigne: "Sur un chantier réceptionné, ouvrir « 🔧 Frais », mettre 60 % pour BMI, puis valider la répartition.", attendu: "Les parts des techniciens font 40 % au total, le chef un peu plus que les autres ; la répartition est enregistrée." },
      { titre: "Forcer une réception", consigne: "Sur un chantier terminé sans signature, forcer la réception.", attendu: "Le chantier passe réceptionné ; la fiche garde qui a forcé et quand." },
      { titre: "Un salaire", consigne: "Dans 💵 Salaires, imprimer le bulletin d'un employé de formation.", attendu: "Le bulletin sort avec la base, les primes, les avances et la retenue CNSS s'il est assujetti." },
      { titre: "Ajouter un outil", consigne: "Ajouter un outil au registre de 🧰 Outillage.", attendu: "Le numéro gravé s'attribue tout seul (BMI-…), en lecture seule." },
      { titre: "Je regarde (principal)", consigne: "Basculer en réel puis revenir en formation par « 👁 Je regarde ».", attendu: "L'application change de couleur ; le choix survit au F5." },
      { titre: "Valider et rejeter (principal)", consigne: "Valider une dépense de 12 000 F en attente, puis rejeter un versement avec un motif.", attendu: "La dépense compte ; le versement revient « jamais versé » et son auteur reçoit un message." },
      { titre: "Fonds de caisse (principal)", consigne: "Monter le fonds de caisse d'une boutique de formation de 20 000 F.", attendu: "La fenêtre dit d'où vient la différence ; le tiroir des ventes de la boutique n'est pas touché." },
      { titre: "Corbeille (principal)", consigne: "Supprimer un chantier de formation, puis le restaurer depuis ⚙ Paramètres → 🗑 Corbeille.", attendu: "Le chantier disparaît de 🏠 Clients installés, puis revient tel qu'il était." },
    ],
    questions: [
      "Qui seul peut voir les deux espaces, et comment le fait-il ?",
      "Quand un changement de rôle ou de pouvoir prend-il effet ?",
      "Pourquoi une dépense en espèces non validée bloque-t-elle la clôture ?",
      "Quelles sont les deux conditions pour qu'une commission soit due ?",
      "Que se passe-t-il dans la base quand on colle un script SQL, et qui le colle ?",
      "Un prélèvement de l'exploitant est-il une charge ? Pourquoi ?",
      "Que faire devant la bande rouge « opération(s) n'arrivent pas à partir » ?",
    ],
  },
};
