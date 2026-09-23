// ============================================================
// MANUEL DE FORMATION — CHAPITRE 9 : Ravitaillement et transferts
//
// Des MOTS, rien d'autre. Chaque bouton, chaque règle vient du code :
// screens/Ravitaillement.jsx (DemandeRavitaillement : « 🚚 Demander un
// ravitaillement au magasin », « Mes demandes », Annuler ;
// DemandesTransfertRecues : « 📦 Transferts de stock à valider » avec
// « ✅ Valider la réception » / Refuser, « 🔁 Demandes de transfert reçues »
// avec « ✅ Valider » / Refuser, « Historique récent »), screens/Stocks.jsx
// (côté magasin : « 📥 Demandes des boutiques », « 📋 Préparer le bon »,
// « 🔎 N article(s) à associer », « ⚠ Alertes de stock dans les boutiques »,
// « 🚚 Ravitailler une boutique depuis 🏭 … », « ✅ Valider le
// ravitaillement », RAV-…, « Derniers ravitaillements » ; côté boutique :
// « 🚚 Demander ce ravitaillement », « ⇄ Transfert » sur une ligne,
// « ⏳ Transferts de stock envoyés, en attente de validation » + Annuler),
// screens/Ventes.jsx (« Stock insuffisant pour : … Comment voulez-vous
// procéder ? »), lib/transfertsStock.js (critiqueEnvoi, critiqueValidation,
// validerTransfertStock, TRF-…), lib/calculs.js (ROLES_STOCK = magasinier,
// gérant, administrateur ; demandesEnAttente, alertesBoutiques,
// refusMouvementEntreEspaces, compterReponsesRavitaillement),
// lib/notifications.js (les cinq titres), lib/impression.js
// (imprimerBonRavitaillement : « BON DE RAVITAILLEMENT », deux signatures),
// App.jsx (onglet 🚚 Ravitaillement du vendeur, 🔁 Transfert du gérant,
// compteur de 📦 Stocks pour l'administrateur).
// ============================================================
export const CHAPITRE = {
  numero: 9,
  titre: "Ravitaillement et transferts",
  sousTitre: "Faire venir la marchandise du magasin vers une boutique, la faire passer d'une boutique à l'autre — et savoir à quel instant précis le stock bouge",
  public: "Vendeur (la demande), gérant, magasinier, administrateur",
  duree: "1 h, puis l'exercice en espace formation",
  prerequis: "Le chapitre 8 (Stocks) : la formule du stock et les ajustements. Le chapitre 5 (Ventes) pour la demande née d'une vente en attente.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "**demander un ravitaillement** au magasin depuis sa boutique, suivre sa demande et l'annuler tant qu'elle attend ;",
        "côté magasin, **servir une demande** (« 📋 Préparer le bon »), associer un article nommé autrement, **valider le bon** — c'est à cet instant que le stock sort du magasin et entre en boutique — et imprimer le **BON DE RAVITAILLEMENT** ;",
        "**envoyer un transfert de stock** d'une boutique à une autre (« ⇄ Transfert »), et pourquoi l'article **ne bouge pas** tant que la boutique qui reçoit n'a pas validé ;",
        "**valider ou refuser** une réception dans 🔁 Transfert, et ce que le refus laisse en l'état ;",
        "répondre à une **demande de transfert née d'une vente** (« 🔁 Demandes de transfert reçues ») ;",
        "lire les notifications de ces quatre gestes et retrouver chaque mouvement dans 📦 Stocks.",
      ]],
      ["regle", "**Trois chemins, trois moments où le stock bouge.** Un **ravitaillement** (magasin → boutique) bouge quand le **magasinier valide le bon** — la boutique ne valide rien. Un **transfert de stock** (boutique → boutique, ⇄ sur une ligne) bouge quand la **boutique qui reçoit** clique « ✅ Valider la réception ». Une **demande de transfert née d'une vente** bouge quand la **boutique qui donne** clique « ✅ Valider ». Retenir lequel des deux valide évite l'erreur la plus fréquente : croire qu'un article est parti alors qu'il est encore vendable là où il est."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [5200, 4100], lignes: [
        ["Demander un ravitaillement au magasin (« 📤 Envoyer la demande »), annuler sa demande en attente", "**Tout compte rattaché à une boutique** qui n'est pas en lecture seule : le **vendeur** (onglet 🚚 Ravitaillement), le gérant et l'administrateur (dans 📦 Stocks, sous le tableau). Un compte sans boutique est refusé : « Votre compte n'est rattaché à aucune boutique. Voyez avec l'administrateur. »"],
        ["« 📋 Préparer le bon », « ✅ Valider le ravitaillement », refuser une demande", "**Magasinier, gérant, administrateur** — en pratique le **magasinier**, sur son magasin (un gérant rattaché à sa boutique ne voit pas le magasin). Le serveur applique la même règle."],
        ["« Transfert » (le bouton de la ligne d'article dans 📦 Stocks, envoyer), « Annuler » un transfert envoyé", "**Magasinier, gérant, administrateur** de la boutique qui envoie"],
        ["« ✅ Valider la réception » / « Refuser » un transfert de stock reçu", "**Magasinier, gérant, administrateur** de la boutique qui reçoit — le gérant dans 🔁 Transfert, l'administrateur et le magasinier dans 📦 Stocks"],
        ["« ✅ Valider » / « Refuser » une demande de transfert née d'une vente", "**Magasinier, gérant, administrateur** de la boutique à qui la demande est adressée"],
        ["Déclencher une demande depuis 💰 Ventes (« Stock insuffisant pour : … »)", "Celui qui encaisse la vente (vendeur, gérant, administrateur)"],
        ["Créer un magasin ou une boutique", "L'administrateur, dans ⚙ Paramètres (chapitre 23)"],
      ]}],
      ["note", "**Le vendeur n'a pas l'onglet 🔁 Transfert** (décision du 09/09/2026) : il ne peut ni valider ni refuser, un bouton qui ne commande rien se retire. Il garde 🚚 Ravitaillement, sa demande."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3300, 6000], lignes: [
        ["**🚚 Ravitaillement** (vendeur)", "Le cadre « 🚚 Demander un ravitaillement au magasin » et « Mes demandes ». L'onglet s'écrit « 🚚 Ravitaillement (N) » quand N réponses du magasin n'ont pas encore été vues ; les ouvrir les marque vues."],
        ["**📦 Stocks**, sur une **boutique** (gérant, administrateur)", "Sous le tableau : le même cadre « 🚚 Demander un ravitaillement au magasin » (s'il existe un magasin dans l'espace) ; dans « ⚠ À réapprovisionner », le bouton « 🚚 Demander ce ravitaillement » qui le pré-remplit ; sur chaque ligne d'article, le bouton « Transfert » ; le cadre « ⏳ Transferts de stock envoyés, en attente de validation »."],
        ["**📦 Stocks**, sur un **magasin** (magasinier, administrateur)", "« 📥 Demandes des boutiques (N) » (📋 Préparer le bon · Refuser) ; « ⚠ Alertes de stock dans les boutiques (N) » ; « 🚚 Ravitailler une boutique depuis 🏭 MAGASIN » : Boutique à ravitailler · Catégorie · Article du magasin · Quantité · « + Ajouter au bon » ; « Bon en préparation » ; « ✅ Valider le ravitaillement » / « Vider le bon » ; « Derniers ravitaillements depuis ce magasin » ; le carré « Sorties ce mois »."],
        ["**🔁 Transfert** (gérant)", "« 📦 Transferts de stock à valider (N) » (✅ Valider la réception · Refuser) et « 🔁 Demandes de transfert reçues (N) » (✅ Valider · Refuser), chacun avec son « Historique récent ». L'onglet s'écrit « 🔁 Transfert (N) », N = les deux à traiter."],
        ["**📦 Stocks** (administrateur, magasinier)", "Les deux mêmes cadres, en tête de l'écran, pour la boutique regardée. Pour l'administrateur, l'onglet s'écrit « 📦 Stocks (N) » : les demandes de transfert en attente dans **toutes** ses boutiques, plus les transferts de stock à valider."],
        ["**💰 Ventes**", "À l'encaissement d'un article manquant : « Stock insuffisant pour : … Comment voulez-vous procéder ? » → « Ravitaillement (demander au dépôt) » ou « Transfert (demander à une autre boutique) » (chapitre 5)."],
        ["**🔔 Notifications**", "« 🚚 Demande de ravitaillement — BOUTIQUE », « 🔁 Demande de transfert — BOUTIQUE », « 📦 Transfert de stock à valider — BOUTIQUE », « ✅ Transfert reçu par BOUTIQUE » / « ❌ Transfert refusé par BOUTIQUE »."],
        ["**📦 Stocks**, « Derniers mouvements »", "Chaque ravitaillement et chaque transfert validé y laisse ses deux ajustements (motif « Ravitaillement RAV-… » ou le numéro TRF-…)."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Demander un ravitaillement (boutique)"],
      ["etapes", [
        { titre: "Ouvrir le cadre", texte: "Vendeur : onglet **🚚 Ravitaillement**. Gérant, administrateur : 📦 Stocks, sous le tableau. « Listez ce dont la boutique X a besoin. Le magasinier reçoit la demande et prépare le bon. » Le raccourci : dans « ⚠ À réapprovisionner », **« 🚚 Demander ce ravitaillement »** charge d'un coup tous les articles au seuil avec leur Manque — on corrige ensuite ce qu'on veut." },
        { titre: "Ajouter les articles", texte: "« Article souhaité » : une liste **« — Choisir dans le catalogue du magasin — »** (les articles des magasins de l'espace, « nom — catégorie »), ou un nom tapé librement ; « Catégorie (facultatif) » ; « Quantité » ; **« + Ajouter »**. Refus : « Indiquez l'article souhaité. », « Quantité invalide. ». Chaque ligne apparaît dans « Demande en préparation » avec « Retirer »." },
        { titre: "Une note, puis envoyer", texte: "« Note pour le magasinier (facultatif) » — « Ex : urgent, chantier de vendredi ». **« 📤 Envoyer la demande »** : « Envoyer la demande de ravitaillement ? N article(s) — elle sera visible par le magasinier. » → « ✅ Demande envoyée au magasin. » Sans magasin dans l'espace : « Aucun magasin de votre espace de travail n'est déclaré. Demandez à l'administrateur d'en créer un (⚙ Paramètres). »" },
        { titre: "Suivre « Mes demandes »", texte: "Les dix dernières : Date · Articles · Statut — **« ⏳ En attente »**, **« ✅ Servie (RAV-…) »**, **« ❌ Refusée — motif »** — et « Annuler » sur une demande en attente (« Annuler cette demande de ravitaillement ? »). Rien n'arrive en rayon tant que le statut n'est pas « Servie » : c'est le magasinier qui fait bouger le stock." },
      ]],
      ["h3", "B. Servir une demande (magasin)"],
      ["etapes", [
        { titre: "« 📥 Demandes des boutiques (N) »", texte: "Chaque demande : « 🏪 BOUTIQUE — demandé par X le date », ses lignes (« 3 × Panneau 400W (Panneaux) »), la note en italique. La notification « 🚚 Demande de ravitaillement — BOUTIQUE » est partie aux magasiniers et aux administrateurs de l'espace." },
        { titre: "« 📋 Préparer le bon »", texte: "Les articles demandés sont **chargés dans le bon** de « 🚚 Ravitailler une boutique », la boutique est pré-choisie, et un bandeau dit « 📋 Ce bon répond à la demande de BOUTIQUE — elle sera marquée « servie » à la validation. » (« détacher » pour rompre le lien). Le nom est reconnu **souplement** (accents, pluriel, majuscules) ; si le magasin a moins que demandé, la quantité est **ramenée au disponible**." },
        { titre: "« 🔎 N article(s) à associer »", texte: "« La boutique les a nommés autrement, ou ils sont à zéro chez vous. Indiquez à quel article de VOTRE magasin cela correspond — ou ignorez la ligne. » Chaque ligne dit sa raison (« nom inconnu dans votre magasin », « « … » est à 0 en stock »), une liste « — Article correspondant dans mon magasin — » avec le dispo, **« Associer »** (« Stock limité : q unité(s) ajoutée(s) au lieu de N. » si besoin) ou **« Ignorer »**." },
        { titre: "Compléter, puis « ✅ Valider le ravitaillement »", texte: "On peut encore ajouter ou retirer des lignes. La confirmation : « Valider le ravitaillement ? 🏭 MAGASIN → 🏪 BOUTIQUE N article(s), N unité(s) au total. Le stock sera déduit du magasin et ajouté à la boutique. » **À cet instant** : un numéro **RAV-AAAAMMJJ-XXXX**, deux ajustements par article (− au magasin, + en boutique), la demande passe **« ✅ Servie (RAV-…) »**, et le **BON DE RAVITAILLEMENT** s'ouvre pour impression." },
        { titre: "Refuser", texte: "« Refuser » → « Motif du refus (visible par BOUTIQUE) : » (« Rupture de stock » proposé). La boutique lit « ❌ Refusée — motif » dans « Mes demandes », et le vendeur voit son onglet passer à « 🚚 Ravitaillement (1) »." },
      ]],
      ["h3", "C. Ravitailler sans demande (magasin)"],
      ["etapes", [
        { titre: "« ⚠ Alertes de stock dans les boutiques (N) »", texte: "« Articles passés sous leur seuil. Anticipez le ravitaillement sans attendre la demande. » Boutique · Article · Reste (rouge à 0, orange sinon) · Seuil. Le magasinier voit l'alerte, pas le stock complet de la boutique." },
        { titre: "Composer le bon", texte: "« 🚚 Ravitailler une boutique depuis 🏭 MAGASIN » — « Préparez le bon, validez : le stock sort du magasin, entre en boutique, et le bon s'imprime. » Boutique à ravitailler · Catégorie (« — Toutes — ») · Article du magasin (« nom (dispo : N) », grisé à 0) · Quantité · **« + Ajouter au bon »**. Refus : « Choisissez un article. », « Quantité invalide. », « Stock insuffisant dans MAGASIN : il reste N « … ». » Le « Bon en préparation — MAGASIN → BOUTIQUE » liste Article · Quantité · Retirer · TOTAL." },
        { titre: "Valider", texte: "Comme en B : « ✅ Valider le ravitaillement » (refus « Choisissez la boutique à ravitailler. », « Ajoutez au moins un article au bon. »), RAV-…, bon imprimé, ligne dans « Derniers ravitaillements depuis ce magasin » (N° · Date · Boutique · Articles · Unités · Par). « Vider le bon » efface la préparation sans rien écrire." },
      ]],
      ["h3", "D. Envoyer un transfert de stock (boutique → boutique)"],
      ["etapes", [
        { titre: "« ⇄ Transfert » sur la ligne de l'article", texte: "« Vers quelle boutique ? » (les autres boutiques **et magasins du même espace**, jamais TERRAIN), puis « Transfert de « … » : DE → VERS Quantité (disponible : N) : ». Refus : « Choisissez une autre boutique. », « Indiquez une quantité. », « Stock insuffisant : il reste N. »" },
        { titre: "Ce que l'envoi écrit", texte: "**Rien dans le stock.** Une fiche « transfert de stock » est posée chez la boutique qui reçoit : « Transfert envoyé : q X → VERS. En attente de validation par VERS (🔁 Transfert). L'article reste dans le stock de DE jusque-là. » La notification « 📦 Transfert de stock à valider — VERS » part à son gérant, son magasinier et aux administrateurs." },
        { titre: "Suivre et annuler", texte: "Chez l'envoyeur, « ⏳ Transferts de stock envoyés, en attente de validation (N) » — « L'article reste dans le stock de DE tant que la boutique qui reçoit n'a pas validé dans 🔁 Transfert. » **« Annuler »** : « Annuler le transfert … → VERS ? Rien n'a bougé : l'article est toujours chez DE. » Possible tant que l'autre n'a pas validé." },
      ]],
      ["h3", "E. Recevoir un transfert de stock"],
      ["etapes", [
        { titre: "« 📦 Transferts de stock à valider (N) »", texte: "« Une autre boutique vous envoie des articles. Tant que vous n'avez pas validé, ils restent dans SON stock : validez quand le colis est bien arrivé. » Chaque ligne : « DE envoie : 2× X — date heure — par Y »." },
        { titre: "« ✅ Valider la réception »", texte: "« Valider la réception de … envoyé par DE ? Le stock de DE baisse et celui de BOUTIQUE monte à cet instant. » La validation **revérifie le stock de l'envoyeur** : « Stock insuffisant chez DE : il ne reste que N « X » (il a peut-être été vendu entre-temps). Demandez à DE de refaire le transfert. », « L'article « X » n'existe plus chez DE. », « Ce transfert n'est plus en attente. » Sinon : numéro **TRF-AAAAMMJJ-XXXX**, deux ajustements, « ✅ Réception validée : … est maintenant dans le stock de BOUTIQUE. » Si la boutique n'avait pas l'article, sa fiche est créée." },
        { titre: "« Refuser »", texte: "« Motif du refus (visible par DE) : » (« Colis non reçu » proposé, motif obligatoire : « Indiquez pourquoi vous refusez. »). Rien ne bouge. L'envoyeur reçoit « ❌ Transfert refusé par BOUTIQUE … Rien n'a bougé, l'article est toujours chez DE. » — après une validation, « ✅ Transfert reçu par BOUTIQUE … Le stock a bougé. »" },
        { titre: "« Historique récent »", texte: "« ✅ Reçu, validé par Z (TRF-…) », « ❌ Refusé par Z (motif) », « ↩ Annulé par Z »." },
      ]],
      ["h3", "F. La demande de transfert née d'une vente"],
      ["etapes", [
        { titre: "Dans 💰 Ventes", texte: "À l'encaissement, un article manque : « Stock insuffisant pour : … Comment voulez-vous procéder ? » → « Transfert (demander à une autre boutique) ». L'écran montre **le stock de chaque boutique** pour chaque article manquant (« Demander ce transfert à quelle boutique ? (stock actuel affiché pour chacune) »), puis confirme : « Le client ne paie rien aujourd'hui — vous encaisserez une fois le stock arrivé ». **Le panier reste tel quel** : dès que l'autre boutique a validé, on reclique « Encaisser la vente »." },
        { titre: "Chez la boutique sollicitée", texte: "« 🔁 Demandes de transfert reçues (N) » — « Une autre boutique a besoin de ces articles — probablement pour finaliser une vente en attente. Validez simplement si vous les avez en stock. » La note dit « Demandé depuis Ventes par BOUTIQUE — client X (tel) en attente pour finaliser sa vente. » Notification « 🔁 Demande de transfert — BOUTIQUE » au gérant et aux administrateurs." },
        { titre: "« ✅ Valider »", texte: "« Envoyer ce transfert vers DEMANDEUR ? … » — refus si « Stock insuffisant chez vous pour : … ». **Ici le stock bouge tout de suite** : numéro TRF-…, deux ajustements, demande « servie », « ✅ Transfert envoyé vers DEMANDEUR. » C'est la boutique qui **donne** qui valide, parce que c'est elle qui sait si elle a la marchandise. « Refuser » : motif « Rupture de stock » proposé." },
        { titre: "Le même choix pour le dépôt", texte: "« Ravitaillement (demander au dépôt) » crée la demande au magasin sans passer par le cadre (« ✅ Demande de ravitaillement envoyée au dépôt. Revenez encaisser cette vente une fois le stock arrivé (onglet 🚚 Ravitaillement). ») ; le panier est vidé, on refait la vente à l'arrivée." },
      ]],
    ]},

    // ── 5
    { titre: "Explication de chaque bouton et champ", blocs: [
      ["h3", "La demande de ravitaillement (boutique)"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Article souhaité", "La liste du catalogue des magasins de l'espace (« nom — catégorie »), ou un nom tapé. Un nom tapé approximatif sera reconnu souplement par le magasinier, sinon proposé « à associer »."],
        ["Catégorie (facultatif) / Quantité", "La catégorie se remplit seule depuis le catalogue. La quantité doit être un nombre positif."],
        ["+ Ajouter / Retirer", "Compose « Demande en préparation ». Rien n'est envoyé avant « 📤 Envoyer la demande »."],
        ["Note pour le magasinier", "Une phrase libre, lue par le magasinier sous la demande (urgence, chantier)."],
        ["📤 Envoyer la demande", "Confirmation, puis « ✅ Demande envoyée au magasin. » Ligne de journal « Demande de ravitaillement de BOUTIQUE : N article(s) (par X) », notification au magasin."],
        ["🚚 Demander ce ravitaillement", "Dans « ⚠ À réapprovisionner » : pré-remplit la demande avec chaque article au seuil et son Manque (seuil − reste, au moins 1). Modifiable avant l'envoi."],
        ["Mes demandes", "Les dix dernières : ⏳ En attente · ✅ Servie (RAV-…) · ❌ Refusée — motif. « Annuler » sur une demande en attente seulement."],
        ["🚚 Ravitaillement (N)", "Vendeur : N réponses (servies ou refusées) pas encore vues ; ouvrir l'onglet les marque vues."],
      ]}],
      ["h3", "Le magasin"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["📥 Demandes des boutiques (N)", "Les demandes en attente des boutiques de l'espace. « 📋 Préparer le bon » les charge dans le bon ; « Refuser » demande un motif visible par la boutique."],
        ["🔎 N article(s) à associer", "Les lignes que le magasin ne reconnaît pas, ou à 0 chez lui. « Associer » (choisir l'article du magasin) ou « Ignorer »."],
        ["📋 Ce bon répond à la demande de … / détacher", "Le lien entre le bon et la demande : à la validation, la demande passe « servie » avec le numéro du bon. « détacher » rompt le lien sans vider le bon."],
        ["⚠ Alertes de stock dans les boutiques (N)", "Tous les articles au seuil ou en dessous dans les boutiques de l'espace, les plus bas en premier. Une lecture, pour anticiper."],
        ["Boutique à ravitailler / Catégorie / Article du magasin / Quantité", "Composent une ligne du bon. « Article du magasin » montre « (dispo : N) » et grise ce qui est à 0 ; le disponible tient compte de ce qui est déjà dans le bon."],
        ["+ Ajouter au bon", "Ajoute la ligne. « Stock insuffisant dans MAGASIN : il reste N « … ». » si la quantité dépasse."],
        ["Bon en préparation — MAGASIN → BOUTIQUE", "Article · Quantité · Retirer · TOTAL. Rien n'est écrit tant qu'on n'a pas validé."],
        ["✅ Valider le ravitaillement", "Le seul geste qui fait bouger le stock : RAV-…, deux ajustements par article, demande servie, bon imprimé, journal « Ravitaillement RAV-… : MAGASIN → BOUTIQUE (N article(s), N unité(s)) »."],
        ["Vider le bon", "Efface la préparation. Aucune écriture."],
        ["Derniers ravitaillements depuis ce magasin", "Les quinze derniers bons : N° · Date · Boutique · Articles · Unités · Par."],
        ["Sorties ce mois", "Le carré du magasin : les unités parties en ravitaillement ce mois-ci."],
      ]}],
      ["h3", "Le transfert de stock"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Transfert (le bouton sur la ligne de l'article)", "Envoyer une quantité à une autre boutique du même espace. N'écrit qu'une fiche en attente : l'article reste vendable chez l'envoyeur."],
        ["Transferts de stock envoyés, en attente de validation (N)", "Chez l'envoyeur : ce qui attend l'autre boutique, avec « Annuler » (rien n'a bougé)."],
        ["📦 Transferts de stock à valider (N)", "Chez le receveur : « DE envoie : … — date heure — par Y »."],
        ["✅ Valider la réception", "Revérifie le stock de l'envoyeur, puis écrit TRF-… et les deux ajustements. À cliquer **quand le colis est là**, pas avant."],
        ["Refuser", "Motif obligatoire, visible par l'envoyeur (« Colis non reçu » proposé). Rien ne bouge."],
        ["Historique récent", "Les derniers transferts traités : reçu (TRF-…), refusé (motif), annulé."],
        ["🔁 Transfert (N)", "Gérant : N = transferts de stock à valider + demandes de transfert reçues. Administrateur : le même compte sur 📦 Stocks (N), toutes boutiques."],
      ]}],
      ["h3", "La demande de transfert née d'une vente"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["🔁 Demandes de transfert reçues (N)", "Les demandes des autres boutiques (depuis 💰 Ventes), avec la note qui nomme le client en attente."],
        ["✅ Valider", "Écrit TRF-… **tout de suite** (la boutique qui donne sait ce qu'elle a) : deux ajustements, demande servie, « ✅ Transfert envoyé vers … ». Refus si stock insuffisant."],
        ["Refuser", "Motif (« Rupture de stock » proposé), visible par le demandeur. Rien ne bouge ; le vendeur cherche ailleurs ou propose une réservation."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Deux ajustements par article, toujours** : un négatif chez celui qui donne, un positif chez celui qui reçoit, portant le même numéro (RAV-… ou TRF-…), la date, l'auteur. Ils apparaissent dans « Derniers mouvements » et dans la colonne Ajust. des deux sites. Le stock est recalculé, jamais tapé (chapitre 8).",
        "**La fiche est créée si elle manque** : une boutique qui reçoit un article qu'elle n'a jamais eu obtient sa fiche (même nom, catégorie, seuil, prix, code, tension) avec Initial 0 et Entrées 0 ; la marchandise arrive par l'ajustement positif.",
        "**Le numéro** : RAV-AAAAMMJJ-XXXX pour un ravitaillement, TRF-AAAAMMJJ-XXXX pour un transfert — la date du jour de la validation, puis quatre caractères. Il n'existe qu'à cet instant.",
        "**Le bon de ravitaillement** s'imprime à la validation : en-tête BMI TOGO, « BON DE RAVITAILLEMENT », N°, Date, Établi par, « 🏭 MAGASIN → 🏪 BOUTIQUE », Article · Catégorie · Quantité, TOTAL ARTICLES, deux lignes de signature « Le magasinier (sortie) » et « Le réceptionnaire (boutique) ». Bandeau de formation si l'un des deux sites est d'entraînement. Un transfert de stock n'imprime pas de bon.",
        "**Le mur** : les magasins proposés à une boutique, les boutiques proposées à un magasin ou à un transfert sont ceux **de l'espace regardé**. Et la validation le revérifie : « 🚫 Mouvement impossible : … boutique réel … boutique entraînement … La marchandise réelle et celle d'entraînement ne doivent jamais se mélanger ». Une demande venue de 💰 Ventes ne peut viser qu'une boutique du même espace.",
        "**Les demandes vivent sur la fiche de la boutique qui les reçoit** : la demande de ravitaillement sur la boutique qui demande (le magasinier lit toutes celles de l'espace) ; la demande de transfert et le transfert de stock sur la boutique qui doit répondre. Un vendeur d'une autre boutique ne les voit pas.",
        "**Les notifications** (pour information, jamais dans 💬 Messages) : la demande de ravitaillement → magasiniers et administrateurs ; la demande de transfert → gérant de la boutique visée et administrateurs ; le transfert de stock à valider → gérant et magasinier de la boutique qui reçoit, administrateurs ; validé ou refusé → celui qui l'a envoyé et le gérant de sa boutique. L'auteur d'un geste n'est jamais prévenu de son propre geste.",
        "**La validation d'un transfert de stock revérifie le disponible** de l'envoyeur au moment du clic : l'article y est resté vendable, il a pu partir entre-temps. Le refus le dit et demande de refaire le transfert.",
        "**Le journal** (🕘 Historique) garde chaque demande, chaque refus avec son motif, chaque bon RAV-…, chaque transfert envoyé, validé, refusé, annulé.",
        "**Le carré « Sorties ce mois »** du magasin et l'export « Stocks » du tableau de bord lisent ces ajustements.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**📦 Stocks** (chapitre 8) : tout finit en ajustements ; « ⚠ À réapprovisionner » nourrit la demande ; le seuil déclenche « ⚠ Stock au seuil » et les alertes du magasin.",
        "**💰 Ventes** (chapitre 5) : « Stock insuffisant » propose la réservation prépayée, le ravitaillement ou le transfert ; le panier attend la validation de l'autre boutique.",
        "**🧾 Dettes** (chapitre 7) : la réservation prépayée est l'autre réponse au manque — le client paie, l'article est livré plus tard.",
        "**🚚 Fournisseurs** (chapitre 10) : ce que le magasin reçoit du fournisseur (« + Entrée ») est ce qu'il pourra ravitailler.",
        "**⚙ Paramètres** (chapitre 23) : les magasins (« dépôt ») et les boutiques de vente, dans chaque espace.",
        "**🔔 Notifications** : les cinq titres de ce chapitre.",
        "**🕘 Historique** (chapitre 22) : chaque geste, avec son auteur.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Avant de demander, on a regardé **« ⚠ À réapprovisionner »** et utilisé « 🚚 Demander ce ravitaillement » plutôt que de retaper la liste.",
        "La demande porte une **note** quand il y a une urgence ou un chantier.",
        "Au magasin, les lignes **« à associer »** ont chacune reçu « Associer » ou « Ignorer » — aucune n'est oubliée.",
        "Le **bon imprimé accompagne le colis**, signé au départ par le magasinier et à l'arrivée par la boutique.",
        "Un transfert de stock reçu est validé **quand le colis est physiquement là**, jamais sur un coup de téléphone.",
        "Un transfert envoyé qui traîne dans « ⏳ … en attente » est relancé ou annulé : l'article reste vendable, il ne faut pas le vendre deux fois.",
        "Une demande née d'une vente est traitée **le jour même** : un client attend.",
        "Les compteurs « 🔁 Transfert (N) », « 📦 Stocks (N) », « 🚚 Ravitaillement (N) » reviennent à zéro chaque soir.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3300], lignes: [
        ["Croire que la boutique doit « valider » un ravitaillement", "Il n'y a rien à valider en boutique : le stock a bougé quand le magasinier a validé le bon.", "Vérifier « Mes demandes » : « ✅ Servie (RAV-…) », et le stock dans 📦 Stocks."],
        ["Faire une « + Entrée » pour un article arrivé du magasin", "L'article est compté deux fois : par le RAV-… et par l'entrée.", "Ne rien saisir en boutique ; ± Ajuster avec motif si une entrée a été faite par erreur."],
        ["Vendre un article après l'avoir mis en transfert", "À la validation de l'autre boutique : « Stock insuffisant chez DE … il a peut-être été vendu entre-temps ».", "Annuler le transfert ou le refaire pour la quantité restante."],
        ["Valider une réception avant l'arrivée du colis", "Le stock de la boutique monte sur du vide ; l'écart se verra à l'inventaire.", "Attendre le colis, compter, puis « ✅ Valider la réception »."],
        ["Refuser sans motif", "Le refus est bloqué : « Indiquez pourquoi vous refusez. »", "Écrire la raison : elle est lue par l'autre boutique."],
        ["Ravitailler une boutique d'entraînement depuis le magasin réel", "« 🚫 Mouvement impossible : … boutique réel … boutique entraînement »", "Chaque espace a son magasin ; l'administrateur crée un magasin de formation si besoin."],
        ["Le vendeur cherche l'onglet 🔁 Transfert", "Il n'existe pas pour lui depuis le 09/09/2026.", "Le gérant valide ou refuse ; le vendeur demande via 💰 Ventes ou 🚚 Ravitaillement."],
        ["Demander un ravitaillement sans magasin déclaré", "« Aucun magasin de votre espace de travail n'est déclaré. Demandez à l'administrateur d'en créer un (⚙ Paramètres). »", "L'administrateur crée le magasin dans ⚙ Paramètres."],
        ["Laisser une ligne « à associer » sans réponse", "Elle n'entre pas dans le bon ; la boutique ne la recevra pas et croira la demande servie.", "« Associer » ou « Ignorer » chaque ligne, et prévenir la boutique de ce qui manque."],
        ["Vider le bon en croyant annuler un ravitaillement validé", "Un bon validé est écrit : RAV-… existe, le stock a bougé.", "Corriger par un **⇄ Transfert** de la boutique vers le magasin (le magasinier valide la réception dans 📦 Stocks), ou par ± Ajuster motivé des deux côtés."],
        ["Recliquer « Encaisser la vente » avant la validation de l'autre boutique", "« Stock insuffisant pour : … » : l'article n'est pas encore arrivé.", "Attendre la notification « ✅ … » ou l'appel de l'autre boutique."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "APESSITO n'a plus que 2 panneaux 400W pour un seuil de 5, et il n'y a plus de câble 6 mm².", reponse: "📦 Stocks (gérant) ou 🚚 Ravitaillement (vendeur) : « 🚚 Demander ce ravitaillement » charge « 3 × Panneau 400W » et « 1 × Câble 6 mm² » ; on monte le câble à 50 m, note « urgent, chantier de vendredi », « 📤 Envoyer la demande ». Statut « ⏳ En attente »." },
        { situation: "Au magasin, la demande d'APESSITO arrive ; le câble y est enregistré « Cable solaire 6mm2 ».", reponse: "« 📋 Préparer le bon » : les panneaux sont chargés ; le câble est reconnu souplement (accents, espaces) — sinon il apparaît dans « 🔎 1 article à associer » et le magasinier choisit « Cable solaire 6mm2 (dispo : 200) » puis « Associer ». « ✅ Valider le ravitaillement » → RAV-…, bon imprimé, demande « ✅ Servie »." },
        { situation: "Le magasin n'a que 1 panneau 400W.", reponse: "« 📋 Préparer le bon » ramène la quantité à 1 (le disponible). Le magasinier valide pour 1 et prévient APESSITO ; les 2 autres feront l'objet d'une nouvelle demande quand le fournisseur aura livré (« + Entrée » au magasin, chapitre 10)." },
        { situation: "DEMAKPOE envoie 4 batteries à APESSITO par ⇄ Transfert. Le lendemain, DEMAKPOE en vend 3.", reponse: "L'envoi n'a rien écrit : les 4 batteries étaient encore vendables à DEMAKPOE. Quand APESSITO clique « ✅ Valider la réception », le refus tombe : « Stock insuffisant chez DEMAKPOE : il ne reste que 1 « Batterie » … Demandez à DEMAKPOE de refaire le transfert. » DEMAKPOE annule (« Rien n'a bougé ») et refait un transfert de 1 — ou APESSITO refuse avec le motif." },
        { situation: "Le colis de DEMAKPOE arrive à APESSITO avec 4 batteries, comme annoncé.", reponse: "Le gérant d'APESSITO ouvre 🔁 Transfert (1) → « 📦 Transferts de stock à valider » → « ✅ Valider la réception ». TRF-… : −4 chez DEMAKPOE, +4 chez APESSITO. DEMAKPOE reçoit « ✅ Transfert reçu par APESSITO … Le stock a bougé. »" },
        { situation: "Un client à APESSITO veut 2 onduleurs ; il n'y en a qu'un.", reponse: "💰 Ventes → « Encaisser » → « Stock insuffisant pour : Onduleur. Comment voulez-vous procéder ? » → « Transfert (demander à une autre boutique) » : l'écran montre « DEMAKPOE — Onduleur : 3 ». On confirme ; le panier reste. Chez DEMAKPOE, « 🔁 Demandes de transfert reçues (1) » → « ✅ Valider » : TRF-… tout de suite. APESSITO reclique « Encaisser la vente »." },
        { situation: "Le client ne veut pas attendre : il paie tout de suite.", reponse: "Même fenêtre, « Le client paie maintenant (réservation prépayée) » : une réservation, livrée à l'arrivée du stock (chapitre 7). Aucun transfert n'est demandé par ce choix : on le demande ensuite si besoin." },
        { situation: "Le magasinier a validé un bon pour la mauvaise boutique.", reponse: "RAV-… est écrit, le stock a bougé, le bon est imprimé. Il ne se « dévalide » pas : la boutique qui a reçu par erreur fait un « ⇄ Transfert » vers le magasin, le magasinier valide la réception dans 📦 Stocks (TRF-…), puis refait le bon pour la bonne boutique. Le journal garde les deux gestes." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "**En espace formation**, avec un magasin et deux boutiques de formation, et un formateur qui regarde l'écran :"],
      ["ol", [
        "Avec un compte **vendeur** : onglet 🚚 Ravitaillement, ajouter deux articles (l'un du catalogue, l'autre tapé avec une faute), une note, « 📤 Envoyer la demande ». Lire « ⏳ En attente ».",
        "Avec un compte **magasinier** : « 📥 Demandes des boutiques (1) » → « 📋 Préparer le bon » ; traiter la ligne « à associer » ; « ✅ Valider le ravitaillement » ; regarder le bon imprimé et « Derniers ravitaillements ».",
        "Retour au vendeur : l'onglet dit « 🚚 Ravitaillement (1) » ; ouvrir, lire « ✅ Servie (RAV-…) » ; vérifier dans 📦 Stocks (gérant) que la colonne Ajust. a monté — et qu'aucune « + Entrée » n'est à faire.",
        "Avec un compte **gérant** de la boutique A : « ⇄ Transfert » de 2 unités vers la boutique B ; montrer « ⏳ Transferts de stock envoyés » et que le stock de A n'a pas bougé.",
        "Avec le gérant de B : 🔁 Transfert (1) → « ✅ Valider la réception » ; lire TRF-… dans « Historique récent » et les deux mouvements dans « Derniers mouvements » des deux boutiques.",
        "Refaire un ⇄ Transfert de A vers B, puis **vendre** l'article à A avant la validation ; chez B, lire le refus « il a peut-être été vendu entre-temps » ; chez A, « Annuler ».",
        "Avec le vendeur de A : vendre un article qui manque, choisir « Transfert (demander à une autre boutique) », lire les stocks affichés, confirmer. Chez B, « 🔁 Demandes de transfert reçues (1) » → « ✅ Valider ». Chez A, recliquer « Encaisser la vente ».",
        "Refuser une demande de ravitaillement au magasin avec un motif ; lire « ❌ Refusée — motif » chez le vendeur.",
      ]],
      ["note", "Le formateur vérifie surtout : l'employé sait dire, pour chacun des trois chemins, **qui valide** et **à quel instant le stock bouge** ; et qu'il ne fait jamais de « + Entrée » pour une marchandise arrivée par bon."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "envoie une demande de ravitaillement complète, avec une note, et la suit dans « Mes demandes » ;",
        "au magasin, prépare un bon depuis une demande, associe une ligne non reconnue, valide et imprime le bon ;",
        "envoie un transfert de stock et sait que l'article reste vendable chez lui jusqu'à la validation ;",
        "valide une réception quand le colis est là, refuse avec un motif quand il ne l'est pas ;",
        "répond à une demande de transfert née d'une vente et sait que là, le stock bouge tout de suite ;",
        "retrouve chaque mouvement dans « Derniers mouvements » avec son numéro ;",
        "ne fait jamais de « + Entrée » pour une marchandise arrivée par bon ou transfert.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Un ravitaillement : qui valide, et que fait la boutique quand le colis arrive ?",
        "Un ⇄ Transfert vient d'être envoyé : l'article a-t-il quitté le stock de l'envoyeur ? Peut-on encore le vendre ?",
        "Une demande de transfert née d'une vente : qui valide, et pourquoi le stock bouge-t-il tout de suite dans ce cas ?",
        "Que signifie « 🔎 2 article(s) à associer » au magasin, et que fait-on de chaque ligne ?",
        "Que se passe-t-il si l'envoyeur a vendu l'article avant la validation de la réception ?",
        "Que porte le bon de ravitaillement, et qui le signe ?",
        "Pourquoi ne fait-on jamais de « + Entrée » pour un article arrivé par RAV-… ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Envoie une demande de ravitaillement et la suit dans « Mes demandes »",
      "Prépare un bon depuis une demande, associe, valide, imprime",
      "Envoie un transfert de stock et sait que rien ne bouge avant la validation",
      "Valide ou refuse une réception à bon escient, avec motif",
      "Traite une demande de transfert née d'une vente",
      "Retrouve chaque mouvement RAV-… / TRF-… dans 📦 Stocks",
      "Ne fait jamais de + Entrée pour une marchandise arrivée par bon",
      "Répond juste aux sept questions de la rubrique 12",
    ],
  },
};
