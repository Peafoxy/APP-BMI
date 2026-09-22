// ============================================================
// MANUEL DE FORMATION — CHAPITRE 6 : Caisse et encaissements
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// screens/Caisse.jsx (la clôture du jour, 💸 Verser les fonds, les carrés,
// 📊 RÉSUMÉ, 💼 Avances de frais à rembourser, l'historique des clôtures),
// lib/cloture.js (activiteDuJour, ventesParMoyen, phraseDuJour,
// alerteSaisieRecette, joursAClôturer, motifBlocageVente, clotureDepassee,
// messageClotureDepassee, DEBUT_REGLE_CLOTURE), lib/versements.js
// (deuxPoches, fondsAVerser, totalVerse, resumeCaisses, critiqueVersement,
// destinationsPour, DEST_DG / DEST_BANQUE / DEST_COMPTABLE / DEST_TIROIR,
// ROLES_VERSEMENT, messageJustification, libelleEcart, critiqueRejet,
// rejeterVersement, messagesVersement, critiqueSortieTiroir,
// planFondsCaisse), lib/validationDepenses.js (SEUIL_VALIDATION_DEPENSE,
// depensesBloquantCloture, motifBlocageCloture, rejetsDuJour,
// avancesARembourser, MOYENS_REMBOURSEMENT, ROLES_REMB_CAISSE,
// ROLES_REMB_AUTRES, critiqueRemboursement), lib/caissesMobiles.js
// (soldesMobiles, phraseNumeroMobile), lib/calculs.js (ROLES_CAISSE,
// periodes), screens/Depenses.jsx (le pointage « ✅ Encaissé » du comptable
// dans 🧾 Chez le comptable), screens/Parametres.jsx (💼 Fonds de caisse).
// ============================================================
export const CHAPITRE = {
  numero: 6,
  titre: "Caisse et encaissements",
  sousTitre: "Compter le tiroir chaque soir, verser les fonds, garder le fonds de caisse à part, rembourser une avance — et lire le solde des comptes Flooz et Mixx",
  public: "Vendeur et gérant (la clôture), gérant (le versement), administrateur principal (la validation, le fonds de caisse), comptable (son pointage)",
  duree: "1 h 30, puis l'exercice en espace formation",
  prerequis: "Les chapitres 1 (se connecter) et 5 (les ventes). Savoir ce qu'est une dépense en espèces (chapitre 17) aide, sans être obligatoire.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "faire **la clôture du jour** : compter les billets du tiroir, saisir le montant, comprendre l'écart — et pourquoi la clôture se fait **en dernier** ;",
        "lire le bloc **« 📊 Ventes du jour — tous moyens de paiement »** et ne jamais confondre **vendu** et **encaissé** ;",
        "savoir que **la journée d'hier non clôturée bloque les ventes**, et comment débloquer ;",
        "**verser les fonds** (gérant) : d'où part l'argent, où il va, pourquoi une note est parfois obligatoire, et ce qu'« en attente » veut dire ;",
        "pour l'administrateur principal : **valider ou rejeter** un versement, régler le **fonds de caisse**, rembourser une **avance de frais** ;",
        "lire les carrés du haut — Fonds à verser, 💼 Fonds de caisse, Total versé, Entrées, Sorties, 📱 Flooz / Mixx — et le **📊 RÉSUMÉ** de toutes les boutiques.",
      ]],
      ["regle", "**Le tiroir ne contient que des billets.** Ce qui est payé par Flooz, Mixx ou virement n'y entre jamais : ça s'affiche, ça ne se compte pas. L'écart de caisse compare ce qu'on a compté avec ce que les espèces seules doivent laisser. Retenir cette phrase évite la moitié des erreurs du soir."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [5200, 4100], lignes: [
        ["Ouvrir 🔒 Caisse, lire les carrés, l'historique des clôtures", "Vendeur, gérant, administrateur, comptable (en lecture : son compte n'écrit rien ici)"],
        ["« Clôturer le jour », clôturer un jour en retard, reclôturer une journée dépassée", "**Vendeur, gérant, administrateur** — la même caisse, une seule clôture par jour et par boutique"],
        ["« 💸 Verser » les fonds (tiroir ou compte mobile)", "**Gérant et administrateur** — le vendeur lit « Le versement des fonds est fait par le gérant. »"],
        ["« ✅ Valider » / « ✖ Rejeter » un versement Chez le DG ou BANQUE", "**L'administrateur PRINCIPAL seul** (le DG) — le serveur applique la même règle"],
        ["Pointer « ✅ Encaissé » ou rejeter un versement Chez le comptable", "**Le comptable**, dans 🧾 Chez le comptable"],
        ["« 💵 Rembourser en espèces » une avance de frais", "**Gérant et administrateur**"],
        ["« 🧾 Avec le salaire » / « 👤 Par le DG » une avance de frais", "**L'administrateur**"],
        ["Régler, augmenter, diminuer le 💼 fonds de caisse ; corriger la date d'une remise", "**L'administrateur PRINCIPAL seul**, dans ⚙ Paramètres → Boutiques"],
        ["📊 RÉSUMÉ, Période", "Qui n'est pas rattaché à une boutique (administrateur, comptable) : la rangée des boutiques s'affiche pour lui"],
      ]}],
      ["note", "Un vendeur ou un gérant **rattaché à une boutique** ne voit que la sienne, sans pastille de choix. L'administrateur choisit la boutique en haut ; elle est mémorisée pour cet écran. « Chez le comptable » n'existe qu'en espace réel : un compte de formation ne la voit jamais."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3300, 6000], lignes: [
        ["**🔒 Caisse**, en haut", "La rangée des boutiques (+ TERRAIN), le bouton **📊 RÉSUMÉ**, et « **Période :** » (Aujourd'hui · Cette semaine · Ce mois · Cette année · **Depuis le début**, d'office)."],
        ["**🔒 Caisse**, « 💸 Versements à valider par le DG (N) »", "Administrateur principal seul, **toujours affiché** : vide, il le dit. « ✅ Valider » / « ✖ Rejeter », puis « Derniers versements traités »."],
        ["**🔒 Caisse**, cadre « 💸 Verser les fonds »", "Les carrés : Fonds à verser · 💼 Fonds de caisse · Total versé · Entrées · Sorties (versements compris) · 📱 Flooz · 📱 Mixx/T-Money. Le formulaire : « D'où part l'argent ? » (si la boutique a un compte mobile) · Montant versé (F) · Destination · (BANQUE) Banque, N° du bordereau de versement · Note (justification) · « 💸 Verser ». Puis « Versements de BOUTIQUE »."],
        ["**🔒 Caisse**, cadre « 💼 Avances de frais à rembourser (N) »", "Une ligne par avance qui compte, trois boutons : « 💵 Rembourser en espèces », « 🧾 Avec le salaire », « 👤 Par le DG »."],
        ["**🔒 Caisse**, cadre « Clôture du jour »", "Le bandeau rouge des journées sans clôture, le bandeau orange des journées à reclôturer, le bloc « 📊 Ventes du … — tous moyens de paiement », les cinq cases (Dans le tiroir hier soir · Recette du jour (espèces) · Sorties justifiées du jour · Montant attendu dans le tiroir · Écart de caisse), « Recette du … par vendeur », « Détail des encaissements du … », **Montant du tiroir**, **Remarques**, « **Clôturer le jour** »."],
        ["**🔒 Caisse**, en bas", "« Historique des clôtures — BOUTIQUE » : Date · Attendu dans le tiroir · Compté · Écart · Remarques · Par."],
        ["**🧾 Chez le comptable**", "Le comptable pointe « ✅ Encaissé » les versements qu'il a reçus, ou les rejette."],
        ["**⚙ Paramètres → Boutiques**", "« 💼 Fonds de caisse » sur chaque boutique : régler, augmenter, diminuer, « Régulariser », « 📅 Date » sur chaque remise."],
        ["**📊 Tableau de bord**", "Les pastilles 👤 DG · 🏦 BANQUE · 🧾 COMPTABLE · 📱 FLOOZ · 📱 MIXX/T-MONEY : le relevé de chaque caisse centrale et de chaque compte mobile (chapitre 22)."],
      ]}],
      ["note", "Si l'écran dit « aucune boutique », le compte connecté n'a pas de boutique dans l'espace regardé : ce n'est pas une panne, l'administrateur doit rattacher le compte à une boutique."],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. La clôture du jour (chaque soir, en dernier)"],
      ["etapes", [
        { titre: "Vendre jusqu'à la dernière vente", texte: "La clôture se fait **à la fermeture, après la dernière vente et la dernière dépense**. Une vente faite après la clôture n'est pas refusée, mais la clôture devient une photo périmée et l'écran le signalera (étape F)." },
        { titre: "Ouvrir 🔒 Caisse, descendre au cadre « Clôture du jour »", texte: "S'il y a une dépense en espèces de 5 000 F ou plus **en attente du DG**, le bouton est grisé et un bandeau rouge dit : « 🔒 Clôture impossible : une dépense en espèces attend la validation du DG : … ». Il faut faire valider (ou rejeter) la dépense avant de clôturer." },
        { titre: "Lire « 📊 Ventes du … — tous moyens de paiement »", texte: "Une ligne par moyen (Espèces, Flooz, Mixx/T-Money, Virement, Crédit) avec deux colonnes : **Vendu** (ce qui a été vendu, crédit compris) et **Encaissé ce jour** (ce qui est vraiment entré : ventes payées + règlements de dettes). Elles **ne s'additionnent pas**. La ligne Espèces de la colonne Encaissé est, au franc près, la recette de la clôture." },
        { titre: "Lire les cinq cases", texte: "**Dans le tiroir hier soir** + **Recette du jour (espèces)** − **Sorties justifiées du jour** (dépenses en espèces payées par le tiroir et versements) = **Montant attendu dans le tiroir**. Quand l'enveloppe du fonds de caisse a été entamée, une case « Rendu au fonds de caisse » apparaît : la recette la rembourse d'abord. Les sorties **ne créent jamais d'écart** : une dépense n'est pas un manque." },
        { titre: "Compter les billets", texte: "Tout ce qu'il y a dans le tiroir, **billets et pièces** — pas le fonds de caisse (il est dans son enveloppe, à part), pas les reçus de dépense. Saisir le total dans **Montant du tiroir**." },
        { titre: "Lire l'écart", texte: "**Écart de caisse (manque ou surplus)** = compté − attendu. Vert à 0 ; rouge sinon. Si on a saisi exactement la recette du jour à la place du tiroir, une phrase rouge le dit : « ⚠ … est la recette du jour, pas le contenu du tiroir… ». Un écart inexpliqué se cherche **avant** de clôturer : une vente encaissée par Mixx et saisie « Espèces », une dépense pas enregistrée, un versement oublié." },
        { titre: "Remarques, puis « Clôturer le jour »", texte: "La case Remarques grandit avec le texte (« Ex : Monnaie rendue… »). Le bouton ouvre la confirmation, qui récapitule les lignes et l'écart. Confirmer : « Clôture du … enregistrée ! ». La ligne apparaît dans l'historique du bas, le journal note « Clôture du jour BOUTIQUE — date : compté X (écart Y) »." },
      ]],
      ["h3", "B. Une journée en retard"],
      ["etapes", [
        { titre: "Le bandeau rouge", texte: "« 🔒 Une journée sans clôture : 20/09/2026 » (ou « N journées ») — « Les ventes de BOUTIQUE sont bloquées tant que ces journées ne sont pas clôturées. Choisissez le jour, comptez, clôturez. » Des pastilles proposent chaque jour en retard, le plus ancien d'abord, puis « Aujourd'hui »." },
        { titre: "Choisir le jour, clôturer", texte: "On clique la pastille du jour : les cinq cases se recalculent **pour ce jour-là**. On compte, on saisit, « Clôturer le jour ». Le journal ajoute « clôturée en retard ». Puis le jour suivant, jusqu'à aujourd'hui. Dès que le dernier jour passé est clôturé, 💰 Ventes se rouvre." },
      ]],
      ["h3", "C. Verser les fonds (gérant, administrateur)"],
      ["etapes", [
        { titre: "Lire « Fonds à verser »", texte: "C'est le tiroir : la recette en espèces qui dort dans la boutique. Le carré dit la date du dernier versement, et « le fonds de caisse est gardé à part : il n'est pas là-dedans »." },
        { titre: "« D'où part l'argent ? »", texte: "Cette case n'existe que si la boutique a un compte mobile qui sert. « Le tiroir (espèces) — X F » d'office ; ou « 📱 Flooz — X F » / « 📱 Mixx/T-Money — X F ». **Le montant attendu suit le compte qui se vide.**" },
        { titre: "Montant versé (F) et Destination", texte: "**Chez le DG** (d'office), **BANQUE** (la banque se choisit dans la liste de ⚙ Paramètres → 🏦 Banques, ou « ✏️ Autre banque… » ; le N° du bordereau de versement est obligatoire), **Chez le comptable** (espace réel seulement). En partant d'un compte mobile, une quatrième destination apparaît : **« Le tiroir de la boutique »** — le retrait au guichet." },
        { titre: "La Note, si le montant n'est pas celui attendu", texte: "Dès que le montant saisi diffère du montant attendu, une ligne rouge apparaît : « ⚠ Justifiez pourquoi le montant n'est pas X » et la case **Note (justification)** devient obligatoire. Montant égal : pas de note." },
        { titre: "« 💸 Verser »", texte: "Confirmation : « Enregistrer le versement de X de BOUTIQUE → Chez le DG ? Il restera « en attente » jusqu'à sa validation par le DG. » Le DG (ou le comptable) reçoit un message « 💸 Versement de fonds : … À valider. ». La ligne s'ajoute dans « Versements de BOUTIQUE » avec « ⏳ en attente ». Le tiroir a déjà baissé." },
      ]],
      ["h3", "D. Valider ou rejeter (administrateur principal)"],
      ["etapes", [
        { titre: "L'encadré « 💸 Versements à valider par le DG (N) »", texte: "En haut de 🔒 Caisse, **pour la boutique regardée seule**. Chaque ligne : « Versement du … — X F — BOUTIQUE → Chez le DG », « versé par … », l'écart et la note s'il y en a." },
        { titre: "« ✅ Valider »", texte: "Confirmation : « Versement du … : valider la réception de X versés par … → … ? » (avec « ⚠ attendu Y, écart − Z — la note » si le montant diffère). Validé : l'argent entre dans la caisse **Chez le DG** ou **BANQUE** du tableau de bord, la ligne passe « ✅ validé le … par … »." },
        { titre: "« ✖ Rejeter »", texte: "Motif obligatoire. « L'argent sera considéré comme toujours en caisse à BOUTIQUE, et … en sera prévenu. » Le montant passe à 0 F sur la sortie (barré en rouge dans la liste), le tiroir remonte, le gérant reçoit « ✖ Versement du … REJETÉ : … Motif : … refaites le versement. » Un rejet ne se défait pas ; un versement validé ne se rejette plus." },
      ]],
      ["h3", "E. Rembourser une avance de frais"],
      ["etapes", [
        { titre: "Le cadre « 💼 Avances de frais à rembourser (N) »", texte: "Une ligne par dépense « payée de sa poche » qui compte (validée par le DG, ou sous 5 000 F) : « KOSSI — 12 000 F — Carburant — dépense du … · payée de sa poche »." },
        { titre: "Choisir comment", texte: "**« 💵 Rembourser en espèces »** (gérant, administrateur) : une sortie « Remboursement d'avance de frais » sort du tiroir **aujourd'hui** — refusée si le tiroir plus ce qui reste dans l'enveloppe ne suffisent pas (« … dépasse ce qu'il y a dans le tiroir … Attendez une recette. »). **« 🧾 Avec le salaire »** (administrateur) : on choisit le mois de paie, le montant s'ajoute au net du bulletin, hors CNSS. **« 👤 Par le DG »** (administrateur) : rien ne bouge dans la caisse. L'employé reçoit un message dans les trois cas." },
      ]],
      ["h3", "F. Une journée clôturée dont la caisse a bougé ensuite"],
      ["etapes", [
        { titre: "Le bandeau orange", texte: "« ⚠ 1 journée clôturée dont la caisse a bougé ensuite — Une vente ou une dépense a été enregistrée APRÈS la clôture : le montant compté ce jour-là ne correspond plus. Le solde de la caisse reste juste — c'est la clôture qu'il faut refaire. » Une pastille par jour, avec ce qui a bougé (« 10/09/2026 · +225 000 »)." },
        { titre: "Reclôturer", texte: "Cliquer la pastille : « 🔁 Cette journée est à RECLÔTURER » avec le message complet (attendu à la clôture, compté, attendu maintenant, écart). On recompte, on saisit, « Clôturer le jour » : la nouvelle clôture **remplace** l'ancienne, qui reste gardée dans la fiche (journal « RECLÔTURE du jour … »)." },
      ]],
      ["h3", "G. Le 📊 RÉSUMÉ (administrateur)"],
      ["etapes", [
        { titre: "Cliquer 📊 RÉSUMÉ", texte: "Une ligne par boutique de l'espace regardé (ventes + TERRAIN) : Fonds à verser · Fonds de caisse · Total versé · Entrées · Sorties (versements compris), « ⚠ N jours sans clôture » en rouge, la ligne TOTAL. En dessous, « 💸 Historique des versements » de toutes ces boutiques (10 lignes puis on défile, archives au-delà de 3 mois). **Rien d'autre ne s'affiche** en mode résumé ; un clic sur une boutique le referme." },
        { titre: "Changer la « Période : »", texte: "Elle commande les carrés de la boutique regardée, le résumé ET l'historique. Avec une période, Entrées / Sorties / Versé sont ceux de la période, et « Fonds à verser » devient **le tiroir à la fin de la période**. Le montant attendu par le formulaire de versement, lui, reste toujours le tiroir d'aujourd'hui." },
      ]],
    ]},

    // ── 5
    { titre: "Explication de chaque bouton et champ", blocs: [
      ["h3", "Les carrés du cadre « 💸 Verser les fonds »"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Fonds à verser (le tiroir)", "La recette en espèces qui dort dans la boutique : ventes et règlements en espèces, moins ce qu'ils ont payé, moins les versements. Rouge si négatif (une dépense saisie avant la vente qui la couvre). Avec une période : le tiroir à la fin de la période."],
        ["💼 Fonds de caisse (fixe X F)", "Ce qu'il reste dans **l'enveloppe** : « intact », ou « il en reste … · entamé de … ». « gardé à part, jamais dans le tiroir ». S'affiche seulement si un fonds est réglé ou a été remis. Sans fonds : « aucun fonds réglé (⚙ Paramètres → Boutiques → 💼 Fonds de caisse) »."],
        ["Total versé", "Tous les versements de la boutique, **rejetés exclus** ; « ce mois … », « en attente … » en ambre."],
        ["Entrées", "Ventes + règlements en espèces (de la période). « hors fonds de caisse remis … (il va dans l'enveloppe) »."],
        ["Sorties (versements compris)", "Dépenses en espèces + versements. « dont … entrés depuis un compte mobile (comptés en Entrées) » quand il y a eu un retrait."],
        ["📱 Flooz / 📱 Mixx/T-Money", "Le **solde du compte** de cette boutique, « n° … » ou « numéro non réglé (⚙ Paramètres → Boutiques → 📱 Comptes mobiles) », « ce qui reste sur le compte, d'après les saisies ». Un carré n'apparaît que si le compte sert."],
      ]}],
      ["h3", "Le formulaire de versement"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["D'où part l'argent ?", "« Le tiroir (espèces) — X » d'office, ou un compte mobile avec son solde. N'apparaît que si la boutique a un compte mobile qui sert."],
        ["Montant versé (F)", "Supérieur à zéro. Comparé au montant attendu (le tiroir, ou le solde du compte mobile choisi)."],
        ["Destination", "Chez le DG (d'office) · BANQUE · Chez le comptable (réel seulement) · Le tiroir de la boutique (source mobile seulement — refusé sinon : « n'est possible qu'en partant d'un compte mobile »)."],
        ["Banque / Nom de la banque", "Liste de ⚙ Paramètres → 🏦 Banques, « ✏️ Autre banque… » pour un nom hors liste ; sans liste réglée, on tape le nom. Obligatoire pour BANQUE."],
        ["N° du bordereau de versement", "Obligatoire pour BANQUE."],
        ["⚠ Justifiez pourquoi le montant n'est pas X / Note (justification)", "N'apparaissent que si le montant diffère de l'attendu ; la note est alors obligatoire. Elle suit le versement partout (« attendu 200 000 F, écart − 50 000 F : la note »)."],
        ["💸 Verser", "Le geste. Confirmation, message au DG ou au comptable, ligne « ⏳ en attente »."],
        ["Versements de BOUTIQUE", "Date · Montant · Destination (écart et note) · Par · Validation : « ⏳ en attente », « ✅ validé le … par … », « ✖ rejeté le … par … — motif » (ligne rouge, montant barré)."],
      ]}],
      ["h3", "Le cadre « Clôture du jour »"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["📊 Ventes du … — tous moyens de paiement", "Moyen · Ventes (nombre) · Vendu · Encaissé ce jour, et TOTAL. La phrase du bas rappelle que les deux colonnes ne s'additionnent pas."],
        ["La phrase bleue", "Quand il y a eu autre chose que des billets : « Ventes du jour : 820 000 F — mais le tiroir ne doit contenir que 155 000 F : le reste n'est jamais passé par les billets. »"],
        ["Dans le tiroir hier soir", "Le tiroir tel qu'il était la veille au soir, **recalculé** (jamais lu dans la clôture d'hier). « la recette — le fonds de caisse n'est pas dedans »."],
        ["Recette du jour (espèces)", "« ventes … · encaissements … » (règlements de dettes en espèces)."],
        ["Rendu au fonds de caisse", "Seulement si l'enveloppe était entamée : ce que la recette du jour lui a remboursé."],
        ["Sorties justifiées du jour", "« dépenses … · versements … — ne créent pas d'écart »."],
        ["💼 Fonds de caisse (gardé à part)", "Ce qu'il reste dans l'enveloppe ce soir-là, « intact » ou « entamé de … », « … pris dessus ce jour-là », « … remis par le DG »."],
        ["Montant attendu dans le tiroir", "Le résultat : ce qu'on doit trouver en billets. Cadre épais."],
        ["Écart de caisse (manque ou surplus)", "compté − attendu ; « — » tant que rien n'est saisi ; vert à 0."],
        ["Recette du … par vendeur", "Vendeur · Ventes · Espèces encaissées (dont dettes) · Autres moyens, avec le détail « Mixx 160 000 · Flooz 20 000 » dessous. Une lecture : « admin, gérant ou vendeur : la même caisse »."],
        ["Détail des encaissements du …", "Heure · Client · Motif · Montant · Encaissé par — les règlements de dettes du jour."],
        ["✖ Dépenses rejetées par le DG ce jour-là", "Cadre rouge : l'argent était sorti du tiroir, « ce manque est attendu dans l'écart, et il est dû par la personne qui l'a saisi »."],
        ["Montant du tiroir", "Ce qu'on a compté en billets. Sans lui : « Comptez la caisse et saisissez le montant. »"],
        ["Remarques", "Texte libre, la case grandit (6 lignes au plus)."],
        ["💼 Fonds de caisse — l'enveloppe, à part du tiroir", "Cadre d'information avant le bouton : « Elle est intacte : il doit y avoir X » ou « Elle a été entamée de X : il devrait y rester Y sur Z. Les prochaines recettes la rembourseront toutes seules. » Rien à saisir."],
        ["Clôturer le jour", "Grisé tant qu'une dépense en espèces attend le DG. Sinon : confirmation puis enregistrement."],
        ["✓ La journée du … a déjà été clôturée.", "Remplace le formulaire quand c'est fait — sauf si la journée est à reclôturer."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Deux poches, jamais additionnées.** Le **tiroir** = la recette en espèces. **L'enveloppe** = le fonds de caisse remis par le DG. Une entrée rembourse d'abord l'enveloppe si elle est entamée, le reste va au tiroir ; une dépense se paie sur le tiroir, l'enveloppe ne complète que ce qu'il ne couvre pas ; un versement ne sort **que** du tiroir ; une remise du DG va dans l'enveloppe. L'enveloppe n'est jamais comptée physiquement : la clôture informe, elle ne demande rien.",
        "**Le montant attendu est un SOLDE**, pas le flux du jour : tout ce qui est entré en espèces jusqu'à ce soir, moins tout ce qui est sorti. C'est pourquoi une boutique qui a versé hier attend peu ce soir, et pourquoi « Dans le tiroir hier soir » est recalculé à chaque fois.",
        "**Une journée « active »** (au moins une vente, tout moyen, ou un encaissement en espèces) demande une clôture. Le lendemain, sans clôture, 💰 Ventes refuse : « 🔒 Vente impossible : la journée du … de BOUTIQUE n'a pas été clôturée. Faites la clôture du jour dans 🔒 Caisse, puis revenez vendre. » La règle ne regarde pas avant le **09/09/2026**.",
        "**Une seule clôture par jour et par boutique**, quel que soit le nombre de vendeurs : c'est la même caisse. Une reclôture remplace la fiche et garde l'ancienne dans son histoire.",
        "**Les dépenses en attente du DG ne comptent pas** dans le tiroir (5 000 F et plus, en espèces, payées avec la caisse de la boutique) — et elles bloquent la clôture jusqu'au jour clôturé inclus. Flooz, virement, avance personnelle, argent du DG ne bloquent rien : ils ne touchent pas le tiroir.",
        "**Une dépense rejetée par le DG** repasse à 0 F : si l'argent était sorti du tiroir, le manque apparaît dans l'écart du jour, dû par la personne qui l'a saisie.",
        "**Un versement est écrit comme une dépense « Versement de fonds »**, mais **il n'est jamais une charge** : il ne compte ni dans 📤 Dépenses, ni dans le résultat, ni dans les exports de dépenses. Il n'est une sortie que pour le tiroir. « Chez le comptable » et « Le tiroir de la boutique » posent en plus une ligne miroir (entrée dans la caisse d'arrivée).",
        "**En attente ≠ validé.** Le tiroir baisse dès le geste ; la caisse **Chez le DG** ou **BANQUE** du tableau de bord ne monte qu'à la validation. Un versement rejeté = « comme jamais versé » : montant à 0, l'argent est de nouveau dans le tiroir de la boutique.",
        "**Le retrait d'un compte mobile vers le tiroir** n'attend personne : aucune validation, aucun message. L'argent sort du solde Mixx/Flooz et entre dans le tiroir comme une recette — et la clôture du soir le trouvera en moins s'il n'y est pas.",
        "**Le solde Flooz / Mixx découle des saisies** : entre ce qui a été encaissé avec ce moyen (ventes, règlements), sort ce qui a été payé avec ce moyen (dépenses qui comptent, versements). L'application ne parle ni à Flooz ni à Moov : si le téléphone dit autre chose, c'est qu'un mouvement n'a pas été saisi.",
        "**Le fonds de caisse se règle dans ⚙ Paramètres**, par le DG seul : on saisit le **nouveau** montant ; à la hausse le DG apporte la différence (sa caisse baisse), à la baisse il la reprend (sa caisse ou la BANQUE remonte). Le tiroir des ventes n'est jamais touché. Un fonds réglé sans remise enregistrée s'affiche en rouge « réglé X, jamais remis » dans le RÉSUMÉ : « Régulariser » comble la trace.",
        "**Les messages** : le DG (administrateur principal) reçoit chaque versement Chez le DG / BANQUE à valider, le comptable ceux qui lui sont destinés ; le gérant reçoit le rejet ; l'employé reçoit le remboursement de son avance. **La tournée du matin** (7 h) prévient les vendeurs et le gérant de la boutique, plus les administrateurs, d'une caisse d'hier non clôturée.",
        "**Le journal** (🕘 Historique) garde chaque clôture (compté, écart, « clôturée en retard », « RECLÔTURE »), chaque versement, chaque validation et rejet, chaque remboursement.",
        "**Le mur** : les boutiques, les versements à valider, le RÉSUMÉ sont ceux de l'espace regardé ; « Chez le comptable » n'existe qu'en réel.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**💰 Ventes** (chapitre 5) : la recette en espèces vient de là ; la journée d'hier non clôturée bloque l'encaissement ; une vente après la clôture rend la clôture « dépassée ».",
        "**🧾 Dettes** (chapitre 7) : un règlement en espèces entre dans la recette du jour (« encaissements ») et dans « Détail des encaissements » ; un règlement par Mixx monte le solde du compte mobile.",
        "**📤 Dépenses** (chapitre 17) : « Payé avec » décide si l'argent sort du tiroir (la caisse de la boutique, en espèces), de l'enveloppe (le fonds de caisse), de la poche de l'employé (avance, remboursée ici), du DG ou du comptable. La validation du DG au-delà de 5 000 F bloque la clôture.",
        "**🧾 Chez le comptable** : le pointage « ✅ Encaissé » qui valide un versement « Chez le comptable », et son rejet.",
        "**📊 Tableau de bord** (chapitre 22) : les pastilles 👤 DG, 🏦 BANQUE, 🧾 COMPTABLE, 📱 FLOOZ, 📱 MIXX/T-MONEY lisent les versements validés et les dépenses ; chaque caisse a son relevé imprimable.",
        "**⚙ Paramètres** (chapitre 23) : 💼 Fonds de caisse, 🏦 Banques (la liste du versement BANQUE), 📱 Comptes mobiles (les numéros).",
        "**💵 Salaires** (chapitre 18) : une avance remboursée « avec le salaire » s'ajoute au net du mois choisi, hors CNSS.",
        "**🔔 Notifications** : la tournée du matin signale une caisse d'hier non clôturée aux vendeurs, au gérant et aux administrateurs (« 🔒 Caisse non clôturée — BOUTIQUE »).",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "La clôture est faite **après la dernière vente**, pas au milieu de l'après-midi.",
        "Le bloc « 📊 Ventes du jour » a été lu : la ligne **Espèces / Encaissé** est bien la recette de la clôture.",
        "On a compté **les billets du tiroir**, pas la recette du jour, pas le fonds de caisse.",
        "L'**écart** est à 0 — ou il est expliqué dans Remarques (monnaie, erreur retrouvée).",
        "Un écart rouge a été cherché **avant** de clôturer : moyen de paiement mal saisi, dépense non enregistrée, versement oublié.",
        "Pas de dépense en espèces **en attente du DG** le soir (sinon la clôture est impossible).",
        "Le versement porte la **bonne source** (tiroir ou compte mobile) et la **bonne destination** ; BANQUE a sa banque et son bordereau.",
        "Un versement différent de l'attendu porte une **note** qui dit pourquoi.",
        "Le DG a validé (ou rejeté) : rien ne reste « ⏳ en attente » depuis des jours.",
        "Le RÉSUMÉ ne montre aucune boutique avec « ⚠ N jours sans clôture ».",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3300], lignes: [
        ["Saisir la recette du jour à la place du contenu du tiroir", "Phrase rouge : « ⚠ 51 400 F est la recette du jour, pas le contenu du tiroir. Le tiroir doit contenir le fonds d'hier soir (…) + la recette (…) − les sorties du jour (…) = … »", "Compter ce qu'il y a réellement dans le tiroir et saisir ce total."],
        ["Compter le fonds de caisse avec les billets des ventes", "Surplus égal au fonds : l'écart est faux.", "L'enveloppe reste à part. On ne compte que le tiroir."],
        ["Clôturer à 16 h puis vendre à 17 h", "Pas refusé. Le lendemain : bandeau orange « journée clôturée dont la caisse a bougé ensuite ».", "Recompter et reclôturer cette journée. Règle : clôturer en dernier."],
        ["Oublier de clôturer hier", "Le matin, 💰 Ventes : « 🔒 Vente impossible : la journée du … n'a pas été clôturée… ».", "🔒 Caisse, pastille du jour en retard, compter, clôturer ; puis vendre."],
        ["Clôturer avec une grosse dépense en espèces pas encore validée", "Bouton grisé, « 🔒 Clôture impossible : une dépense en espèces attend la validation du DG : … »", "Faire valider ou rejeter par le DG (📤 Dépenses). À dire aux vendeuses : une grosse dépense en espèces se fait valider AVANT la fermeture."],
        ["Une vente par Mixx enregistrée « Espèces »", "L'écart réclame des billets qui ne sont jamais entrés ; le solde Mixx est trop bas.", "Corriger la vente (administrateur) ; sinon expliquer l'écart dans Remarques. Le bloc « tous moyens » permet de le voir."],
        ["Verser un montant différent sans note", "Refus : « Justifiez pourquoi le montant n'est pas X »", "Remplir la note, ou verser le montant attendu."],
        ["Verser en BANQUE sans bordereau", "« Indiquez le numéro du bordereau de versement. »", "Le bordereau est la preuve : le saisir."],
        ["Choisir « Le tiroir de la boutique » en partant du tiroir", "« « Le tiroir de la boutique » n'est possible qu'en partant d'un compte mobile (Flooz, Mixx/T-Money). »", "Cette destination est le retrait au guichet : elle ne vaut que depuis Flooz ou Mixx."],
        ["Croire qu'un versement « en attente » est arrivé chez le DG", "La caisse Chez le DG ne monte qu'à la validation.", "Le DG valide dans 🔒 Caisse (encadré du haut) ; le comptable pointe « ✅ Encaissé »."],
        ["Un versement rejeté que le gérant ne refait pas", "Le tiroir contient encore l'argent ; le carré « Fonds à verser » le dit.", "Lire le message de rejet (motif), corriger, refaire le versement."],
        ["Rembourser une avance en espèces alors que le tiroir est vide", "« Ce remboursement (X) dépasse ce qu'il y a dans le tiroir de … : Y. Attendez une recette. »", "Attendre une recette, ou l'administrateur rembourse « avec le salaire » ou « par le DG »."],
        ["Le comptable essaie de clôturer", "Son compte est en lecture seule : le geste est refusé.", "La clôture est le geste du vendeur, du gérant ou de l'administrateur."],
        ["Lire « Fonds à verser » avec une période choisie et croire que c'est le tiroir d'aujourd'hui", "Avec une période, le carré dit « le tiroir à la fin de : Ce mois ».", "Remettre « Depuis le début » ; le formulaire de versement, lui, attend toujours le tiroir d'aujourd'hui."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Le soir à APESSITO : hier soir le gérant a tout versé, le tiroir était à 0 F. Aujourd'hui, 150 000 F de ventes en espèces, 30 000 F de ventes par Mixx, une dépense de 4 000 F de carburant payée en espèces, aucun versement. Que doit contenir le tiroir ?", reponse: "0 + 150 000 − 4 000 = **146 000 F**. Les 30 000 F de Mixx s'affichent dans « 📊 Ventes du jour » (ligne Mixx/T-Money) et dans le carré 📱 Mixx, mais ne sont pas attendus dans le tiroir. La phrase bleue le dit : « Ventes du jour : 180 000 F — mais le tiroir ne doit contenir que 146 000 F : le reste n'est jamais passé par les billets. »" },
        { situation: "La vendeuse compte 145 000 F au lieu de 146 000 F.", reponse: "Écart − 1 000 F en rouge. Elle cherche d'abord (monnaie rendue en trop ? une petite dépense non saisie ?). Si elle ne trouve pas, elle écrit dans Remarques « manque 1 000, monnaie » et clôture : l'écart reste écrit dans l'historique, avec son nom." },
        { situation: "Le lendemain matin, une autre vendeuse veut encaisser : « 🔒 Vente impossible : la journée du 21/09/2026 de APESSITO n'a pas été clôturée ».", reponse: "Personne n'a clôturé hier. Elle va dans 🔒 Caisse : bandeau rouge, pastille « 21/09/2026 », elle compte le tiroir (rien n'a bougé depuis hier soir), saisit, « Clôturer le jour ». Le journal note « clôturée en retard ». Puis elle revient vendre." },
        { situation: "Le gérant veut verser 150 000 F chez le DG ; le carré dit « Fonds à verser 146 000 F ».", reponse: "Dès qu'il tape 150 000, la ligne rouge « ⚠ Justifiez pourquoi le montant n'est pas 146 000 F » apparaît et la Note devient obligatoire. Soit il verse 146 000 (pas de note), soit il explique (par exemple : une vente encaissée mais pas encore saisie). Le DG verra l'écart et la note à la validation." },
        { situation: "Le DG reçoit « 💸 Versement de fonds : 146 000 F de APESSITO → Chez le DG, par KOFFI. À valider. » mais n'a compté que 140 000 F dans l'enveloppe remise.", reponse: "Il ne valide pas : « ✖ Rejeter », motif « 140 000 reçus au lieu de 146 000 ». Le versement passe à 0 F, l'argent est considéré comme toujours en caisse à APESSITO, KOFFI reçoit le message et refait le versement du bon montant après avoir cherché les 6 000 F." },
        { situation: "Une boutique a encaissé 160 000 F par Mixx et le gérant veut ramener 100 000 F en billets pour la caisse.", reponse: "💸 Verser les fonds : « D'où part l'argent ? » → 📱 Mixx/T-Money — 160 000 F ; Montant 100 000 ; Destination **« Le tiroir de la boutique »**. Aucune validation : le solde Mixx descend à 60 000, le tiroir monte de 100 000, et la clôture du soir attend ces billets. (Le retrait réel se fait au guichet de l'opérateur.)" },
        { situation: "Le DG a remis un fonds de caisse de 50 000 F à DEMAKPOE. Un jour sans vente, le gérant paie 20 000 F de réparation en espèces.", reponse: "Le tiroir est à 0 : la dépense est prise sur l'enveloppe (« Payé avec : Le fonds de caisse », proposé au gérant). Le carré 💼 dit « il en reste 30 000 · entamé de 20 000 ». Les prochaines ventes en espèces rembourseront l'enveloppe **avant** de remplir le tiroir : la clôture montrera une case « Rendu au fonds de caisse ». Rien à saisir sur l'enveloppe." },
        { situation: "KOSSI a payé 12 000 F de carburant de sa poche (« une avance personnelle »). La dépense a été validée par le DG.", reponse: "Elle apparaît dans « 💼 Avances de frais à rembourser ». Le gérant clique « 💵 Rembourser en espèces » : une sortie « Remboursement d'avance de frais » sort du tiroir aujourd'hui (ce n'est pas une nouvelle charge : la dépense est déjà comptée). KOSSI reçoit le message. Si le tiroir ne suffit pas, l'administrateur peut choisir « 🧾 Avec le salaire »." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "**En espace formation**, avec un formateur qui regarde l'écran. Faire d'abord deux ou trois ventes (une en espèces, une par Mixx, une à crédit avec avance en espèces) et une dépense en espèces sous 5 000 F :"],
      ["ol", [
        "Ouvrir 🔒 Caisse, lire à voix haute le bloc « 📊 Ventes du jour » : dire ce que la vente à crédit met dans **Vendu** et dans **Encaissé**, et sous quel moyen figure son avance.",
        "Lire les cinq cases et **calculer soi-même** le montant attendu dans le tiroir avant de le lire à l'écran.",
        "Saisir exprès la recette du jour dans « Montant du tiroir » : lire la phrase rouge, puis saisir le bon montant. Écrire une remarque, « Clôturer le jour », retrouver la ligne dans l'historique du bas.",
        "Faire une vente **après** la clôture ; revenir dans 🔒 Caisse : montrer le bandeau orange et **reclôturer** la journée.",
        "**Avec le compte gérant de formation** : verser un montant **différent** du « Fonds à verser » — lire le refus, remplir la note, verser. Montrer la ligne « ⏳ en attente » et la baisse du carré.",
        "**Avec le compte administrateur principal de formation** : dans « 💸 Versements à valider par le DG », **rejeter** ce versement avec un motif ; revenir sur le compte gérant, lire le message reçu, montrer le montant barré et le carré remonté ; refaire le versement, puis le **valider**.",
        "Enregistrer une dépense en espèces de 6 000 F (📤 Dépenses) et montrer que « Clôturer le jour » est grisé avec son message ; la faire valider par l'administrateur principal ; montrer que le bouton se rallume.",
        "Cliquer 📊 RÉSUMÉ, changer la « Période : », lire la ligne de la boutique et la ligne TOTAL ; cliquer une boutique pour refermer le résumé.",
      ]],
      ["note", "Le formateur vérifie surtout : le réflexe **clôturer en dernier**, la différence **vendu / encaissé / attendu dans le tiroir**, et la **note obligatoire** quand le versement diffère."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "explique en une phrase pourquoi le tiroir ne contient pas le total des ventes du jour ;",
        "calcule le montant attendu à partir des cinq cases, compte les billets et clôture avec une remarque juste ;",
        "sait débloquer les ventes le matin en clôturant la journée en retard, et reclôturer une journée dépassée ;",
        "(gérant) verse les fonds avec la bonne source et la bonne destination, et justifie un écart ;",
        "(administrateur principal) valide ou rejette un versement, et explique ce que « en attente » et « rejeté » changent pour la caisse ;",
        "sait ce qu'est l'enveloppe du fonds de caisse, et pourquoi on ne la compte pas avec le tiroir ;",
        "sait rembourser une avance de frais par le bon chemin, et pourquoi une grosse dépense en espèces bloque la clôture.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Hier soir 50 000 F dans le tiroir ; aujourd'hui 150 000 F de ventes en espèces, 30 000 F par Flooz, 4 000 F de dépense en espèces : combien doit-on trouver dans le tiroir ?",
        "Quelle différence entre les colonnes « Vendu » et « Encaissé ce jour », et pourquoi ne s'additionnent-elles pas ?",
        "Que se passe-t-il le lendemain si la journée n'a pas été clôturée ? Et si on vend après avoir clôturé ?",
        "Quand la Note d'un versement est-elle obligatoire ? Qui valide un versement Chez le DG ? Chez le comptable ?",
        "Qu'est-ce qu'un versement rejeté change pour le tiroir de la boutique ?",
        "Le fonds de caisse est-il dans le tiroir ? Que fait la recette quand l'enveloppe a été entamée ?",
        "Pourquoi la clôture peut-elle être impossible un soir, et comment la débloquer ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Lit le bloc « Ventes du jour — tous moyens » et distingue vendu / encaissé / attendu dans le tiroir",
      "Compte le tiroir, saisit le montant, explique l'écart, clôture en dernier",
      "Clôture une journée en retard et reclôture une journée dépassée",
      "Verse les fonds (source, destination, banque et bordereau, note si écart)",
      "Valide ou rejette un versement et sait ce que « en attente » veut dire (admin principal)",
      "Sait que l'enveloppe du fonds de caisse reste à part et comment elle se rembourse",
      "Rembourse une avance de frais par le bon chemin",
      "Répond juste aux sept questions de la rubrique 12",
    ],
  },
};
