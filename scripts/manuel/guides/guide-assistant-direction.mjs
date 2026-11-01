// ============================================================
// GUIDE PAR POSTE — L'ASSISTANT(E) DE DIRECTION (01/11/2026, « Lance »).
//
// Le rôle naît ce jour-là (Timo : « A a oui, B b, Cb », « D a », puis
// « Salaire prendre B a pour le moment… Assistant de direction peut être un
// homme »). Boutons relus : App.jsx (ses onglets), components/TachesConfiees.jsx
// (« ➕ » d'un gérant, ✅ Valider, ↩ Rouvrir), lib/assistantDirection.js (la
// garde de lecture seule et son message), screens/MesTaches.jsx.
// ============================================================
export const GUIDE = {
  id: "assistant-direction",
  poste: "Assistant(e) de direction",
  roles: ["assistant_direction"],
  public: "L'assistant ou l'assistante de direction de BMI",
  duree: "1 jour et demi : la journée et les chapitres le premier jour, l'examen ensuite",
  onglets: ["dashboard", "taches", "ventes", "commandes", "tous_devis", "dettes", "clients", "caisse", "stocks", "fournisseurs", "depenses", "parc", "rendez_vous", "messages", "whatsapp", "salaire", "primes_recues"],
  chapitres: [1, 3, 5, 6, 7, 8, 10, 13, 15, 16, 17, 18, 20, 22, 26, 24, 25],

  journee: [
    ["p", "L'assistant(e) de direction **suit l'activité de toutes les boutiques et fait avancer le travail des gérants**. Il ou elle **regarde tout** (ventes, caisse, dettes, stock, dépenses, devis, chantiers) **sans rien modifier**, et **agit** sur trois choses : les **tâches des gérants**, ses **rendez-vous**, ses **messages** (💬 et 📲 WhatsApp). Les mots entre guillemets sont ceux des boutons ; le chapitre du manuel est indiqué entre parenthèses."],
    ["table", { entetes: ["Mes onglets", "À quoi ils me servent"], largeurs: [3300, 6000], lignes: [
      ["✅ Tâches", "**Mon outil principal** : donner une tâche à un gérant, valider ou rouvrir ce qu'il a terminé, et mes propres tâches (chapitre 15)."],
      ["📊 Tableau de bord", "Les chiffres de chaque boutique, sur la période choisie (chapitre 22)."],
      ["💰 Ventes · 📥 Commandes reçues · 📋 Tous les devis", "Les ventes, l'inventaire de chaque boutique, les commandes et tous les devis — en lecture (chapitres 5 et 13)."],
      ["🔒 Caisse · 📤 Dépenses · 🧾 Dettes", "Les clôtures du jour, les versements, les dépenses et leur validation par le DG, ce que les clients doivent — en lecture (chapitres 6, 7 et 17)."],
      ["📦 Stocks · 🚚 Fournisseurs · 👤 Clients · 🏠 Clients installés", "Le stock et les transferts, les fournisseurs, les clients, les chantiers — en lecture (chapitres 3, 8, 10 et 15)."],
      ["📅 Rendez-vous", "Mes rendez-vous pro et privés, et ceux de l'équipe (chapitre 26)."],
      ["💬 Messages · 📲 WhatsApp", "L'équipe, et les conversations des clients qui ne sont confiées à personne d'autre (chapitre 20)."],
      ["💵 Salaire · 💰 Primes reçues", "Ma propre paie et mes primes (chapitres 16 et 18). Je ne vois pas la paie des autres."],
    ] }],
    ["regle", "**Je ne sors jamais d'argent.** Pas de dépense, pas de paiement, pas de versement, pas de vente ni d'encaissement, pas de prix ni de stock modifié, rien de supprimé. Tout bouton de ce genre me répond : « 🔒 Assistant(e) de direction : vous consultez cet écran en lecture seule… ». La base de données refuse la même chose."],
    ["note", "Le nom de mon poste suit ma fiche : « Assistant de direction » pour un homme, « Assistante de direction » pour une femme. Si le sexe n'est pas renseigné, l'application écrit « Assistant(e) de direction »."],

    ["h3", "Le matin — faire le tour"],
    ["etapes", [
      { titre: "Les notifications de la nuit", texte: "Je reçois les avis « pour information » des boutiques : caisse d'hier non clôturée, dette de plus de 30 jours, devis à relancer, stock au seuil, ravitaillement et transferts, clôture dépassée. **Je ne reçois pas** ce qui attend une décision de l'administrateur (dépense à valider, remise à autoriser) : je ne peux pas y répondre." },
      { titre: "🔒 Caisse", texte: "Chaque boutique a-t-elle clôturé hier ? Un écart est-il expliqué ? Le bouton « 📊 RÉSUMÉ » donne toutes les caisses d'un coup (chapitre 6)." },
      { titre: "📊 Tableau de bord", texte: "Les ventes, les dépenses et le résultat d'hier ou du mois, boutique par boutique (chapitre 22)." },
    ]],

    ["h3", "Donner une tâche à un gérant — ✅ Tâches"],
    ["etapes", [
      { titre: "« 📋 Tâches confiées aux gérants »", texte: "En haut de l'onglet, un bouton par gérant de l'espace : « ➕ ANGELE · BMI DEMAKPOE »." },
      { titre: "Le titre, les détails, l'échéance", texte: "Le titre est obligatoire ; les détails et l'échéance sont facultatifs." },
      { titre: "Ce qui se passe", texte: "La tâche apparaît dans l'onglet **✅ Mes tâches** du gérant, avec une notification et un message WhatsApp du numéro BMI." },
      { titre: "Quand il a terminé", texte: "La tâche revient chez moi « ⏳ À valider » (l'onglet ✅ Tâches en affiche le nombre). **« ✅ Valider »** la clôt ; **« ↩ Rouvrir »** la lui renvoie avec un motif obligatoire, qu'il lit en rouge." },
    ]],
    ["attention", "Je ne donne des tâches **qu'aux gérants**. Pour un autre employé, je passe par l'administrateur."],

    ["h3", "Dans la journée"],
    ["ul", [
      "**📅 Rendez-vous** : je planifie les visites et réunions ; un rendez-vous pro prévient l'équipe (chapitre 26).",
      "**📲 WhatsApp** : je réponds aux clients dans les conversations libres ; une conversation confiée à un collègue reste grisée (chapitre 20).",
      "**📋 Tous les devis** et **🏠 Clients installés** : je vois où en est chaque client, pour relancer le bon gérant ou commercial par une tâche ou un message.",
    ]],

    ["h3", "Le soir"],
    ["p", "Je vérifie les tâches « ⏳ À valider » et je les valide ou les rouvre, puis je regarde que chaque boutique a bien clôturé sa journée (🔒 Caisse)."],
  ],

  examen: {
    intro: "Toutes les épreuves se passent **dans l'espace de formation** (barre violette), avec le formateur à côté. Une épreuve est réussie quand on voit à l'écran ce que dit la colonne « Ce qu'on doit voir ».",
    epreuves: [
      { titre: "Lecture seule", consigne: "Essayer d'enregistrer une dépense dans 📤 Dépenses.", attendu: "Le refus : « 🔒 Assistant(e) de direction : vous consultez cet écran en lecture seule… » — rien n'est enregistré." },
      { titre: "Donner une tâche", consigne: "Dans ✅ Tâches, donner à un gérant la tâche « Compter le stock des batteries », pour demain.", attendu: "La tâche apparaît dans « Tâches confiées aux gérants » (« À faire ») et, sur le compte du gérant, dans ✅ Mes tâches." },
      { titre: "Valider une tâche", consigne: "Le gérant (le formateur) déclare la tâche terminée ; la valider.", attendu: "L'onglet ✅ Tâches montre le nombre à valider ; après « ✅ Valider », la pastille passe « ✅ Validée »." },
      { titre: "Rouvrir une tâche", consigne: "Rouvrir une tâche terminée en donnant un motif.", attendu: "Sans motif, le refus. Avec le motif, la tâche repasse « À faire » et le gérant lit le motif en rouge." },
      { titre: "Le tour des caisses", consigne: "Dans 🔒 Caisse, ouvrir « 📊 RÉSUMÉ » et dire quelle boutique n'a pas clôturé hier.", attendu: "La personne lit les quatre carrés de chaque boutique et le retard de clôture en rouge." },
      { titre: "Une dette", consigne: "Retrouver dans 🧾 Dettes un client qui doit encore de l'argent et dire combien il a versé.", attendu: "Le montant, le versé et le reste sont lus sur sa ligne." },
      { titre: "Un rendez-vous", consigne: "Planifier dans 📅 Rendez-vous une réunion pro avec un gérant.", attendu: "Le rendez-vous apparaît dans la liste, le gérant y est participant." },
    ],
    questions: [
      "À qui l'assistant(e) de direction peut-il ou elle donner une tâche ?",
      "Que se passe-t-il si l'on clique sur « 💳 Encaisser » dans 💰 Ventes ?",
      "Pourquoi ne reçoit-on pas la notification « dépense à valider » ?",
      "Un motif est-il obligatoire pour rouvrir une tâche ? Pourquoi ?",
      "Voit-on la paie des autres employés ?",
    ],
  },
};
