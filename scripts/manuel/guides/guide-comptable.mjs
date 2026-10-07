// ============================================================
// GUIDE PAR POSTE — LE COMPTABLE (01/10/2026, « Lance »).
//
// « Ma journée » reprend le livret du 22/09/2026, RELU dans le code le
// 01/10/2026. En vérifiant ses vrais onglets, un DÉFAUT a été trouvé et
// réparé le jour même (2.101.403) : App.jsx lui donnait encore 📲 WhatsApp,
// retiré par Timo le 20/09/2026 (« 2a ») — l'onglet s'ouvrait vide. Un
// contrôle du banc compare désormais les onglets affichés de chaque rôle
// à ONGLETS_ROLE. Le livret, lui, était juste sur les onglets ; il oubliait
// le journal comptable (SYSCOHADA), les exports et le fait que la caisse
// « Chez le comptable » n'existe qu'en réel. Boutons relus : Depenses.jsx
// (ChezComptable : « 💰 Décaissements de ma caisse », « ✅ Encaissé » /
// « ✅ Remis », « ✖ Rejeter »), Dashboard.jsx (pastilles, exports,
// « 📒 Journal comptable (SYSCOHADA) »), CarteCaisse.jsx, Caisse.jsx.
// ============================================================
export const GUIDE = {
  id: "comptable",
  poste: "Comptable",
  roles: ["comptable"],
  public: "Le comptable de BMI",
  duree: "1 jour et demi : la journée et les chapitres le premier jour, l'examen ensuite",
  onglets: ["dashboard", "rentabilite", "depenses", "chez_comptable", "dettes", "caisse", "stocks", "clients", "historique", "messages", "salaire", "nouveau_client"],
  chapitres: [1, 3, 6, 7, 8, 17, 18, 20, 22, 24, 25],

  journee: [
    ["p", "Le comptable **lit tout ce qui touche à l'argent et l'exporte**. Il est **en lecture seule** partout, sauf pour un geste qui est le sien : **pointer ce qui passe par sa caisse**, « Chez le comptable ». Les mots entre guillemets sont ceux des boutons ; le chapitre du manuel est indiqué entre parenthèses."],
    ["table", { entetes: ["Mes onglets", "À quoi ils me servent"], largeurs: [3300, 6000], lignes: [
      ["🧾 Chez le comptable", "**Ma caisse** : ce qu'on m'a versé, ce que je remets ; le pointage, mon seul geste (chapitre 17)."],
      ["📊 Tableau de bord · 📈 Rentabilité · 🕘 Historique", "Les chiffres par boutique et par période, mon relevé, les exports et le journal comptable ; qui a fait quoi et quand (chapitre 22)."],
      ["📤 Dépenses · 🔒 Caisse", "Les dépenses de chaque boutique, leurs clôtures du jour, leurs versements — en lecture (chapitres 6 et 17)."],
      ["🧾 Dettes · 👤 Clients · 📦 Stocks", "Ce que les clients doivent, qui a acheté, ce qu'il y a en stock — en lecture (chapitres 3, 7 et 8)."],
      ["💬 Messages · 💵 Salaire", "L'équipe, et ma paie (chapitres 18 et 20)."],
      ["🙋 Créer un client", "L'onglet s'affiche, mais je ne peux rien y créer : mon compte est en lecture seule (chapitre 3)."],
    ] }],
    ["note", "**Je n'ai pas 📲 WhatsApp** (décision de la direction du 20/09/2026) : les conversations avec les clients ne me concernent pas. Je garde 💬 Messages pour l'équipe."],

    ["h3", "Le matin — ma caisse"],
    ["etapes", [
      { titre: "🧾 Chez le comptable", texte: "En haut, **« 💰 Décaissements de ma caisse »** : à remettre (en ambre) et déjà remis, avec leur nombre." },
      { titre: "Un versement arrivé", texte: "Une ligne « 💵 entrée de caisse » : une boutique m'a versé ses fonds. Quand j'ai **réellement** l'argent en main, **« ✅ Encaissé »**. Tant que je ne l'ai pas fait, le versement reste en attente pour la boutique." },
      { titre: "Une remise", texte: "Une commission, un salaire, ou une dépense d'une boutique **payée avec ma caisse** : quand j'ai remis les billets ou fait le virement, **« ✅ Remis »**." },
      { titre: "Un versement qui ne devrait pas exister", texte: "**« ✖ Rejeter »**, avec un motif obligatoire. L'argent redevient « jamais versé » : il est de nouveau à verser par la boutique, et celui qui a fait le versement reçoit un message avec le motif." },
    ]],
    ["attention", "**Un pointage se fait quand l'argent a réellement bougé**, jamais « pour avancer ». Je ne peux pas l'annuler moi-même : seul l'administrateur le peut."],
    ["regle", "**La caisse « Chez le comptable » est réelle et n'a pas de jumelle en formation.** On ne peut donc pas s'y exercer : on s'y forme avec le formateur, sur les vrais pointages."],

    ["h3", "Mon relevé — 📊 Tableau de bord"],
    ["etapes", [
      { titre: "La pastille 🧾 COMPTABLE", texte: "En haut, à côté des boutiques. Elle ne montre que ma caisse, en **relevé** sur la période choisie : solde au début, + entrées, − sorties, solde à la fin, puis les mouvements." },
      { titre: "La période", texte: "Le sélecteur « Période » commande tout l'écran : aujourd'hui, ce mois, une période passée…" },
      { titre: "« 🖨 Imprimer le relevé (PDF) » · « Exporter (CSV) »", texte: "Le même relevé, mêmes chiffres, à garder ou à remettre." },
    ]],
    ["note", "Les pastilles **📱 FLOOZ** et **📱 MIXX/T-MONEY** donnent de la même façon le solde des comptes mobiles des boutiques. Ce solde vient des **saisies**, pas de l'opérateur : s'il diffère du téléphone, un mouvement n'a pas été saisi."],

    ["h3", "Les exports et le journal"],
    ["ul", [
      "**« Exporter les données (Excel / CSV) »** dans 📊 Tableau de bord : Ventes, Dépenses, Versements, Dettes, Stocks — sur la boutique ou la pastille choisie.",
      "**« 📒 Journal comptable (SYSCOHADA) »** : les écritures en partie double de la période (ventes, dépenses, règlements de dettes, apports et prélèvements de l'exploitant en compte 104), avec les comptes de base. Je peux adapter les codes.",
      "**Un versement n'est jamais une dépense**, un apport ou un prélèvement de l'exploitant non plus : ils ne sont pas comptés dans les charges. Une dépense **en attente du DG** ou **rejetée** ne compte nulle part.",
      "**📈 Rentabilité** : la marge par article = prix vendu moins le prix d'achat **actuel** de la fiche.",
    ]],

    ["h3", "Lire sans toucher"],
    ["ul", [
      "**📤 Dépenses** : par boutique, avec leur statut (validée, en attente du DG, rejetée) et ce qui a payé (« Payé avec »).",
      "**🔒 Caisse** : les clôtures du jour de chaque boutique (ventes par moyen de paiement, tiroir compté, écart expliqué), les versements, l'enveloppe du fonds de caisse. **La clôture n'est pas mon geste** : vendeur, gérant, administrateur.",
      "**🧾 Dettes** : ce que chaque client doit, ses versements, ses reçus.",
      "**🕘 Historique** : le journal de tout ce qui a été fait, par qui et quand. C'est ma pièce à conviction.",
      "Tout geste d'écriture me répond : « Votre compte est en lecture seule ».",
    ]],

    ["h3", "Le soir"],
    ["p", "Je vérifie que tout ce qui est passé dans mes mains ce jour-là est pointé, et que les versements que je n'ai pas reçus restent bien « à remettre ». En fin de mois, j'imprime mon relevé et j'exporte le journal comptable de la période."],
  ],

  examen: {
    intro: "Les épreuves 1 à 7 se passent **dans l'espace de formation** (barre violette), avec le formateur à côté. ⚠ **Les épreuves 8 et 9 se passent en RÉEL** : la caisse « Chez le comptable » n'existe pas en formation. Le formateur les fait faire le jour où un vrai versement arrive, et regarde sans toucher. Une épreuve est réussie quand on voit à l'écran ce que dit la colonne « Ce qu'on doit voir ».",
    epreuves: [
      { titre: "Lecture seule", consigne: "Essayer d'enregistrer une dépense dans 📤 Dépenses.", attendu: "Le refus : « Votre compte est en lecture seule : vous pouvez consulter et exporter, mais pas modifier les données. »" },
      { titre: "Chiffres d'une période", consigne: "Dans 📊 Tableau de bord, choisir le mois dernier et une boutique, puis lire les ventes, les dépenses et le résultat.", attendu: "Les cartes nomment la période et ne comptent que la boutique choisie. La personne refait le Résultat avec la ligne sous les cartes : ventes − prix d'achat des articles vendus − dépenses (hors achats de marchandises), et dit ce que veut l'avertissement ambre s'il apparaît." },
      { titre: "Exports", consigne: "Exporter les ventes et les dépenses du mois dernier.", attendu: "Deux fichiers CSV, qui s'ouvrent dans Excel avec leurs colonnes." },
      { titre: "Journal comptable", consigne: "Exporter le journal comptable du mois dernier.", attendu: "Un fichier d'écritures en partie double ; aucun versement n'y est écrit comme une charge." },
      { titre: "Une clôture", consigne: "Dans 🔒 Caisse, ouvrir la clôture d'un jour passé d'une boutique et expliquer son écart.", attendu: "La personne lit les ventes par moyen de paiement, le montant attendu dans le tiroir et l'écart." },
      { titre: "Une dette", consigne: "Retrouver dans 🧾 Dettes un client qui doit encore de l'argent et dire combien il a versé.", attendu: "Le montant, le versé et le reste sont lus sur sa ligne." },
      { titre: "L'historique", consigne: "Retrouver dans 🕘 Historique qui a enregistré une dépense donnée, et quand.", attendu: "La ligne du journal avec l'auteur et la date." },
      { titre: "Pointer un versement (réel)", consigne: "Le jour où un versement « Chez le comptable » arrive, compter l'argent puis cliquer « ✅ Encaissé ».", attendu: "La ligne passe dans « remis » ; la pastille 🧾 COMPTABLE compte l'entrée à la date du pointage." },
      { titre: "Mon relevé (réel)", consigne: "Imprimer le relevé de la caisse 🧾 COMPTABLE du mois en cours.", attendu: "Le PDF reprend le solde au début, les entrées, les sorties et le solde à la fin, comme l'écran." },
    ],
    questions: [
      "Quel est le seul geste d'écriture du comptable ?",
      "Quand clique-t-on « ✅ Encaissé » — à l'annonce du versement, ou quand l'argent est en main ?",
      "Que devient un versement rejeté ?",
      "Pourquoi un versement n'apparaît-il pas dans les charges ?",
      "Une dépense en attente du DG compte-t-elle dans le résultat ?",
      "Pourquoi ne peut-on pas s'exercer au pointage en formation ?",
    ],
  },
};
