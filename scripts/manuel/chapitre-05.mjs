// ============================================================
// MANUEL DE FORMATION — CHAPITRE 5 : Ventes et commandes
//
// ⚠ Dans le plan retenu par Timo (celui de ChatGPT, 22/09/2026), le chapitre 4
// est « Prospects » et le 5 « Ventes et commandes ». Ce chapitre a été écrit
// en premier, sur sa demande « Lance le chapitre 4 » après une annonce fautive
// de ma part (j'avais dit « chapitre 4 (Ventes) ») ; il porte le BON numéro.
//
// Des MOTS, rien d'autre. Chaque bouton, chaque règle vient du code :
// screens/Ventes.jsx (le panier, l'encaissement, la proforma, la liste, les
// fenêtres ↩ Reprise et 🔁 Retour), screens/Commandes.jsx (🛒 Nouvelle
// commande, 📥 Commandes reçues), components/SelecteurArticle.jsx (la
// fenêtre « Rechercher un article »), lib/constants.js (PAIEMENTS),
// lib/calculs.js (PLAFOND_REMISE_PCT = 3, critiqueRemises,
// MSG_REMISE_EXCLUSIVE, remiseExigeAdmin, apporteursPossibles,
// compteClientPour, reprendreProforma, ventesDeProforma, periodes,
// bornesPersonnalisees, recetteDesVentes, totalDesProformas,
// ROLES_RETOUR_GARANTIE), lib/core.js (prochainNumeroVente, numeroRecu,
// prefixeBoutique, documentDeVente, titreRecuDette), lib/cloture.js
// (motifBlocageVente), lib/reprises.js, lib/bons.js, lib/impression.js
// (imprimerRecuDeVente, recuWhatsApp), lib/clientsConnus.js.
// ============================================================
export const CHAPITRE = {
  numero: 5,
  titre: "Ventes et commandes",
  sousTitre: "Encaisser au comptoir, vendre à crédit, remettre une offre de prix, retrouver une vente — et la commande qu'un commercial envoie à la boutique",
  public: "Vendeur, gérant, administrateur ; commercial et technicien pour la commande",
  duree: "1 h 30, puis l'exercice en espace formation",
  prerequis: "Les chapitres 1 (se connecter), 3 (les clients) et 4 (les prospects, pour le commercial). Des articles en stock dans la boutique (chapitre 8).",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, le vendeur sait :"],
      ["ul", [
        "**composer un panier** — au lecteur de code-barres ou en cherchant l'article — avec la quantité, le prix et, s'il y a lieu, une remise ;",
        "**encaisser** une vente au comptant (espèces, Flooz, Mixx, virement) ou **à crédit** avec une avance, et remettre le bon reçu ;",
        "remettre une **offre de prix** (proforma) qui n'engage rien, et la **vendre** plus tard en un clic ;",
        "savoir quoi faire quand **le stock manque** : réservation prépayée, ravitaillement ou transfert ;",
        "**retrouver** une vente, la réimprimer, l'envoyer par WhatsApp, lire la recette d'une période ;",
        "connaître les **trois gestes après la vente** — 📋 Devis, 🔁 Retour, ↩ Reprise — et qui a le droit de les faire ;",
        "pour le commercial et le technicien : **envoyer une commande** à la boutique, et pour le vendeur, la **valider et encaisser**.",
      ]],
      ["regle", "**Une vente encaissée sort du stock, entre dans le chiffre d'affaires et dans la caisse du jour, tout de suite.** Une proforma ne fait rien de tout ça. C'est la première chose à savoir : on n'encaisse pas « pour voir »."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [5200, 4100], lignes: [
        ["Ouvrir 💰 Ventes, composer un panier, « 💳 Encaisser la vente », « 🧾 Proforma WhatsApp », 🖨️ proforma, 🛒 Vendre une proforma, 🖨 / WhatsApp sur une vente", "**Vendeur, gérant, administrateur**"],
        ["Voir la liste 🧾 Proformas", "Vendeur, gérant, responsable commercial, administrateur"],
        ["Une remise **au-delà de 3 %** (générale, ou sur un article)", "**L'administrateur seul** — le serveur applique la même règle"],
        ["📋 Devis (reprendre la vente pour en faire un devis d'installation)", "L'administrateur, le responsable commercial, et **le vendeur qui a fait cette vente**"],
        ["🔁 Retour / échange sous garantie", "**Gérant et administrateur**"],
        ["↩ Reprise de l'article par BMI", "**L'administrateur principal seul**"],
        ["🗑 Supprimer une vente", "**L'administrateur** — et seulement si rien n'en dépend (rubrique 9)"],
        ["🛒 Nouvelle commande (envoyer un panier à la boutique)", "**Commercial, technicien**"],
        ["📥 Commandes reçues : « ✅ Valider et encaisser », « ❌ Refuser »", "**Vendeur, gérant, administrateur** — un vendeur ne voit que les commandes de sa boutique qui lui sont destinées ou destinées à « n'importe quel vendeur »"],
        ["Le comptable", "Ne voit pas 💰 Ventes. Il lit les ventes dans le tableau de bord et l'historique."],
      ]}],
      ["note", "Un vendeur ou un gérant **rattaché à une boutique** vend dans la sienne, sans pastille de choix. L'administrateur choisit la boutique en haut de l'écran ; elle est **mémorisée pour cet écran** et ne change jamais toute seule."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3300, 6000], lignes: [
        ["**💰 Ventes**, cadre « Nouvelle vente »", "🔍 Code-barres · Domaine · Catégorie · Article (« — Choisir un article — ») · Quantité · Prix unitaire (F) · Remise ligne (F) · Remise ligne (%) · « Ajouter au panier » · le 🛒 Panier · Client · Numéro du client · Remise (%) · Commercial · Paiement · (à crédit) Statut de l'article, Avance versée, « Avance payée comment ? » · la case 🤝 apporteur externe · « 💳 Encaisser la vente » · « 🧾 Proforma WhatsApp » · 🖨️ · le Total."],
        ["**💰 Ventes**, cadre du bas", "Deux vues : « 💰 Ventes (N) » et « 🧾 Proformas (N) » ; « 🔍 Rechercher… » ; la période (Toute période, Aujourd'hui, Cette semaine, Ce mois, Cette année, ✏️ Personnaliser…) ; « 💰 Recette » ; les pastilles de paiement (Tout paiement, Espèces, Flooz, Mixx/T-Money, Virement bancaire, Crédit (dette)) ; la liste, et ses boutons ronds."],
        ["**🛒 Nouvelle commande** (commercial, technicien)", "La boutique à choisir, « 🔍 Scanner un code-barres », Catégorie, Article, Quantité, Prix unitaire (F), « ➕ Ajouter », le panier, Client (facultatif), Numéro du client, « Remise (%) — facultatif », « Paiement proposé », « Vendeur destinataire (facultatif) », « Rabais offert au client (F) — facultatif », « Associer mon responsable (facultatif) », « 📤 Envoyer la commande à la boutique », puis la liste de ses commandes (⏳ En attente · ✓ Validée · ✗ Refusée)."],
        ["**📥 Commandes reçues** (vendeur, gérant, administrateur)", "« 📥 Commandes en attente (N) » avec « ✅ Valider et encaisser » / « ❌ Refuser », puis « Historique récent » (Validée / Refusée, « ✅ Encaissée — vente N° … », ou « ⚠ Commande validée mais NON ENCAISSÉE » avec « ↻ Reprendre l'encaissement »)."],
        ["**🔒 Caisse**", "La clôture du jour (chapitre 6). Sans elle, la vente du lendemain est bloquée."],
        ["**🧾 Dettes**", "Les ventes à crédit y créent leur dette ; les réservations prépayées s'y livrent."],
        ["**📦 Stocks**", "Les articles, leurs prix, leurs codes-barres, le défectueux d'un retour (🔧 Défectueux / SAV)."],
      ]}],
      ["note", "Si l'écran dit « Aucun article en stock. L'administrateur doit d'abord enregistrer les articles dans Stocks. », ce n'est pas une panne : la boutique regardée n'a aucun article."],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Une vente au comptant"],
      ["etapes", [
        { titre: "Mettre les articles au panier", texte: "**Au lecteur** : le curseur dans « 🔍 Code-barres », on scanne, l'article s'ajoute en quantité 1 au prix de vente. **À la main** : Domaine et Catégorie réduisent la liste (facultatif), puis « — Choisir un article — » ouvre la fenêtre « 🔍 Rechercher un article… » — chaque ligne montre **le prix en bleu et « dispo : N »**. On clique l'article, on saisit la Quantité, le Prix unitaire est pré-rempli, puis « Ajouter au panier »." },
        { titre: "Vérifier le 🛒 Panier", texte: "Article · Qté · P.U. · Remise · Montant, et « Retirer » sur chaque ligne. Le **Total** se lit en bas, à côté du bouton d'encaissement." },
        { titre: "Le client", texte: "Taper dans « Client » ou « Numéro du client » : la boutique propose ceux qu'elle connaît (numéro, dernier passage, ce qu'ils doivent). **Un clic remplit les deux cases.** Un client de passage se tape librement ; sans nom, la vente porte « Client non renseigné »." },
        { titre: "Remise et commercial, s'il y a lieu", texte: "« Remise (%) » sur toute la vente, **3 % au plus** pour un vendeur ou un gérant. « Commercial » : celui qui a amené le client, avec son taux. S'il a un taux, une case « Rabais offert par … (F) » apparaît : ce rabais est **pris sur sa commission**, jamais sur la marge — la case dit le maximum." },
        { titre: "Le paiement", texte: "« Paiement » : Espèces (d'office), Mobile Money (Flooz), Mobile Money (Mixx/T-Money), Virement bancaire — ou Crédit (dette), voir B." },
        { titre: "« 💳 Encaisser la vente »", texte: "Une confirmation : « Confirmer la vente de N article(s) pour X F ? » (la remise y est écrite). On valide. **Le reçu s'imprime tout seul** — l'aperçu s'ouvre, avec « Partager » sur téléphone. Le panier se vide, la vente apparaît en tête de la liste." },
      ]],
      ["attention", "**Un article à 0 F** n'est pas refusé : l'application demande « Ils seront donnés gratuitement, et sortiront quand même du stock… Continuer ? ». Si ce n'est pas voulu, le prix manque dans 📦 Stocks : on annule et on le fait corriger."],

      ["h3", "B. Une vente à crédit"],
      ["etapes", [
        { titre: "Paiement : « Crédit (dette) »", texte: "Deux cases apparaissent. **« Statut de l'article »** : Livré ou Non livré — **obligatoire**, jamais deviné (« Choisissez le statut de l'article (Livré ou Non livré) avant d'encaisser. »). **« Avance versée »** : ce que le client donne aujourd'hui, 0 si rien." },
        { titre: "« Avance payée comment ? »", texte: "Dès qu'une avance est saisie : Espèces, Flooz, Mixx ou virement. **Sans ça, la caisse compterait l'avance en billets** même payée par Mixx — c'est cette case qui met l'argent au bon endroit." },
        { titre: "« 💳 Encaisser la vente »", texte: "La confirmation dit tout : « Total dû · Avance versée · Reste à payer ». Répondre non n'enregistre **rien** (« Vente annulée : rien n'a été enregistré. Le panier est conservé. »)." },
        { titre: "Ce qui est remis au client", texte: "**Le reçu de SA dette**, jamais un « reçu de vente » : « REÇU DE DETTE » s'il n'a rien versé, « REÇU DE VERSEMENT » s'il a donné une avance, « RESTE À PAYER » en rouge. Les versements suivants se font dans 🧾 Dettes (chapitre 7)." },
      ]],
      ["note", "**« Non livré »** avec un crédit ne fait pas une vente : c'est une **réservation prépayée** (🧾 Dettes → Réservations prépayées). Le stock ne sort et la vente n'existe **qu'à la livraison**. Le client repart avec un reçu de versement filigrané « NON LIVRÉ »."],

      ["h3", "C. Une offre de prix — la proforma"],
      ["ol", [
        "Le panier composé (client et numéro remplis si on veut l'envoyer), **« 🧾 Proforma WhatsApp »** : la proforma est enregistrée (numéro PRF-…), WhatsApp s'ouvre sur le numéro du client avec le texte, et **le PDF se télécharge** pour être joint. Le bouton **🖨️** à côté l'imprime au lieu de l'envoyer.",
        "**Rien n'est comptabilisé** : ni stock, ni chiffre d'affaires, ni caisse. Le message le dit : « émis … (non comptabilisé) ». Validité écrite sur le document : 15 jours.",
        "Le client revient : vue **🧾 Proformas**, sur sa ligne **« 🛒 Vendre »**. Le panier se remplit, le nom et le numéro aussi, et **l'encaissement reste à faire** (« Vérifiez, puis encaissez »). Le prix de la proforma est gardé ; si le prix du jour a changé, l'écran le dit.",
        "La colonne **« Suite »** dit ce que chaque proforma est devenue : « ✅ Encaissée le … — reçu N° » ou « ⏳ En attente ». Une proforma déjà encaissée se revend quand même, mais **on prévient** : ce sera une nouvelle vente, avec un nouveau reçu.",
      ]],
      ["attention", "**Trois mots pour trois gestes**, à ne pas confondre : **🛒 Vendre** (une proforma devient un panier), **↩ Reprise** (BMI reprend un article que le client rend), **🔁 Retour** (échange sous garantie)."],

      ["h3", "D. Le stock manque"],
      ["p", "Un article en rupture **s'ajoute quand même** au panier (message ⚠, « ajouté quand même »). C'est **au moment d'encaisser** que l'application tranche, avec une question : « Stock insuffisant pour : … Comment voulez-vous procéder ? »"],
      ["table", { entetes: ["Le choix", "Ce qui se passe"], largeurs: [3300, 6000], lignes: [
        ["Le client paie maintenant (réservation prépayée)", "Une réservation dans 🧾 Dettes, avec l'avance ou le total. Le stock sortira **à la livraison**."],
        ["Ravitaillement (demander au dépôt)", "Une demande part au magasin (🚚 Ravitaillement). **Le client ne paie rien aujourd'hui** ; le panier se vide ; on revient encaisser quand le stock est arrivé."],
        ["Transfert (demander à une autre boutique)", "On choisit la boutique **en voyant son stock** pour chaque article manquant. La demande part ; **le panier reste tel quel** ; on rappelle la boutique, et quand elle a validé, on reclique « 💳 Encaisser la vente ». Tant qu'elle n'a pas validé : « ⏳ … n'a pas encore validé ce transfert. »"],
        ["Annuler", "Rien ne part. Le panier reste."],
      ]}],

      ["h3", "E. Retrouver une vente, lire la recette"],
      ["ol", [
        "La vue **💰 Ventes (N)** liste la boutique regardée, la plus récente en tête ; « Aujourd'hui : X F » est écrit à droite.",
        "**« 🔍 Rechercher… »** : le numéro de reçu, le nom ou le numéro du client. La période : Aujourd'hui, Cette semaine, Ce mois, Cette année, ou **✏️ Personnaliser…** qui ouvre deux cases de date — une borne vide reste ouverte, deux dates à l'envers sont remises dans l'ordre et **la période appliquée s'écrit à côté**.",
        "Les pastilles **Espèces / Flooz / Mixx/T-Money / Virement bancaire / Crédit (dette)** filtrent par moyen de paiement.",
        "**« 💰 Recette : X F · N ventes »** = la somme **de ce qui est affiché** — elle suit la période, le moyen et la recherche. S'il y a eu une reprise : « dont X repris, net Y ». Sur les proformas, c'est « Total des proformas », jamais « recette ».",
        "**Un clic sur une ligne la déplie** (tous les articles) ; un clic sur une autre la déplie à sa place. La ligne ouverte a un fond bleu et une barre à gauche.",
      ]],

      ["h3", "F. La commande d'un commercial — 🛒 Nouvelle commande et 📥 Commandes reçues"],
      ["etapes", [
        { titre: "Le commercial compose la commande", texte: "Dans 🛒 Nouvelle commande : la boutique qui servira, les articles (scan ou liste, **seulement ce qui est en stock** : « Stock insuffisant : il reste N pour « … » »), le client et son numéro, la remise (3 % au plus), le « Paiement proposé », et s'il veut un « Vendeur destinataire » ou « Associer mon responsable » (le responsable commercial prend alors une part de sa commission)." },
        { titre: "« 📤 Envoyer la commande à la boutique »", texte: "Confirmation « Envoyer cette commande (N article(s), X F) à BOUTIQUE pour … ? », puis « Commande envoyée ! Le vendeur de la boutique la validera et encaissera la vente. » Rien n'est vendu : c'est une **demande**." },
        { titre: "Le vendeur la reçoit", texte: "Dans 📥 Commandes reçues, cadre « 📥 Commandes en attente » : le commercial, la date, les articles, le client, « Paiement proposé », le total. **« ✅ Valider et encaisser »** ouvre 💰 Ventes avec le panier pré-rempli, le commercial déjà en place, la remise fixée : **l'encaissement reste à faire**, avec les mêmes règles qu'une vente ordinaire. **« ❌ Refuser »** demande un motif (facultatif) et rend la commande au commercial." },
        { titre: "Vérifier qu'elle a bien été encaissée", texte: "Dans « Historique récent », une commande validée dit « ✅ Encaissée — vente N° … ». Si l'encaissement a été abandonné en route : « ⚠ Commande validée mais NON ENCAISSÉE » et **« ↻ Reprendre l'encaissement »** remet le panier dans 💰 Ventes." },
      ]],
      ["note", "Une commande **qui vient d'un devis signé** suit le même chemin : refusée, le devis **revient au client** (statut « proposé », avec le motif) ; validée et encaissée, elle crée le chantier comme tout devis payé."],

      ["h3", "G. Les boutons ronds d'une vente"],
      ["table", { entetes: ["Bouton", "Ce qu'il fait", "Qui"], largeurs: [1400, 5300, 2600], lignes: [
        ["🖨", "Réimprime le reçu — de vente au comptant, **de la dette** si la vente est à crédit.", "Tous"],
        ["Logo WhatsApp", "Envoie le reçu en texte, sur le numéro du client (WhatsApp s'ouvre, on appuie sur Envoyer).", "Tous"],
        ["🧾", "N'apparaît que s'il existe un bon : réimprime le **bon de reprise** ou le **bon de retour**, ou l'envoie par WhatsApp.", "Tous"],
        ["📋", "Transforme la vente en **devis d'installation** : les articles servent de point de départ, le client est retrouvé par son numéro.", "Admin, resp. commercial, le vendeur de cette vente"],
        ["🔁", "**Retour / échange sous garantie** : le défectueux entre au SAV, un remplacement sort du stock **sans vente ni commission**, gratuit ou avec des frais facturés (une dette du montant saisi).", "Gérant, administrateur"],
        ["↩", "**Reprise de l'article par BMI** : l'article revient au stock, l'argent est rendu (sortie de caisse « Remboursement client ») ou la dette diminue ; le reçu ne change pas, le chiffre d'affaires et la commission sont réduits. Motif obligatoire.", "Administrateur principal"],
        ["🗑", "Supprime la vente — refusé si un chantier, une commission payée ou un versement en dépend.", "Administrateur"],
      ]}],
    ]},

    // ── 5
    { titre: "Explication de chaque bouton et champ", blocs: [
      ["h3", "Le cadre « Nouvelle vente »"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["🔍 Code-barres", "Le lecteur USB « tape » le code puis Entrée : l'article s'ajoute en quantité 1. Code inconnu : « Aucun article avec le code « … » dans BOUTIQUE. Assignez les codes dans l'onglet Stocks. »"],
        ["Domaine / Catégorie", "Réduisent la liste des articles (solaire, garage, caméra… puis la famille). « — Tous — » d'office. Choisir un article remet ses filtres à jour."],
        ["Article", "Ouvre la fenêtre « 🔍 Rechercher un article… », par catégorie, prix en bleu et « dispo : N » sur chaque ligne."],
        ["Quantité / Prix unitaire (F)", "Le prix de vente du stock est pré-rempli ; il se corrige pour cette vente seulement."],
        ["Remise ligne (F) / (%)", "Deux cases liées : l'une calcule l'autre. **Grisées dès qu'une Remise (%) générale est saisie** (« Remise générale déjà saisie : pas de remise par article. »). Au-delà de 3 % de la ligne : administrateur seul."],
        ["Ajouter au panier", "Refuse sans article, quantité ou prix (« Choisissez un article, la quantité et le prix. »)."],
        ["🛒 Panier", "Les lignes, et « Retirer »."],
        ["Client / Numéro du client", "Les clients connus de la boutique se proposent ; un clic remplit les deux. Le numéro rattache la vente au compte du client (8 derniers chiffres)."],
        ["Remise (%)", "Sur toute la vente. **Grisée si une remise a été accordée sur un article** (« Remise déjà accordée sur un article : pas de remise générale. »). Plus de 3 % : administrateur seul."],
        ["Commercial", "L'apporteur interne : commercial, technicien, responsable commercial (ceux qui ont un taux), de l'espace regardé. Un commercial connecté est pré-rempli et ne peut pas se changer."],
        ["Rabais offert par … (F)", "N'apparaît que si le commercial a un taux. Plafonné à sa commission ; « pris sur sa commission, pas sur la marge BMI »."],
        ["Paiement", "Espèces · Mobile Money (Flooz) · Mobile Money (Mixx/T-Money) · Virement bancaire · Crédit (dette)."],
        ["Statut de l'article", "Crédit seulement : Livré / Non livré. Obligatoire. Non livré = réservation prépayée."],
        ["Avance versée / Avance payée comment ?", "Crédit seulement. L'avance est plafonnée à ce qui est dû ; son moyen de paiement est demandé dès qu'elle est > 0."],
        ["🤝 Un apporteur externe (non-utilisateur) a amené ce client", "Une personne hors de l'équipe : nom, téléphone, commission en % **ou** montant fixe. Sa commission s'affiche ; elle se paie dans 👑 Mon équipe (chapitre 16)."],
        ["🔧 Ce devis inclut des frais…", "Cadre ambre, seulement quand le panier vient d'un devis payé : articles + frais d'installation + transport = « MONTANT TOTAL À DEMANDER AU CLIENT ». Les frais ne sont pas du chiffre d'affaires, mais ils sont bien encaissés."],
        ["💳 Encaisser la vente", "Le geste. Confirmation, puis reçu automatique."],
        ["🧾 Proforma WhatsApp / 🖨️", "L'offre de prix, envoyée ou imprimée. Non comptabilisée."],
        ["Total : X F (remise −Y)", "Le total des articles, remise déduite. « Total articles » quand des frais de devis s'ajoutent."],
      ]}],
      ["h3", "Le cadre du bas"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["💰 Ventes (N) / 🧾 Proformas (N)", "Les deux vues. Les proformas sont réservées à vendeur, gérant, responsable commercial, administrateur."],
        ["🔍 Rechercher…", "Numéro de reçu (même l'ancien, « ex … », après une renumérotation), client, téléphone ; numéro de proforma."],
        ["Période / ✏️ Personnaliser…", "Vaut pour les DEUX vues. Les deux cases de date n'apparaissent que si on les demande."],
        ["💰 Recette", "La somme des ventes affichées ; deux chiffres s'il y a eu une reprise (brut, net)."],
        ["Pastilles de paiement", "Ventes seulement : une proforma n'a pas de moyen de paiement."],
        ["Colonnes", "Date (heure dessous) · N° reçu · Articles (deux au plus, « + N autres », le reste au clic) · Client · Qté · Total (remise dessous) · Paiement en pastille (vert espèces, ambre crédit, bleu mobile, gris virement) · Commercial · Actions."],
        ["Colonne « Suite » (proformas)", "« ✅ Encaissée le … — reçu N° » ou « ⏳ En attente »."],
        ["🖨️ Réimprimer / 🛒 Vendre (proformas)", "Réimprime l'offre ; remet ses articles au panier."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Le numéro de reçu** : trois lettres de la boutique (ou son préfixe réglé) + l'année + un compteur sur quatre chiffres, par exemple **APE-2026-0012**. Une boutique de formation écrit **FOR-** devant. Le numéro = le plus grand déjà pris + 1 : une vente supprimée ne libère jamais son numéro. Deux appareils hors ligne qui prennent le même numéro sont renumérotés au retour du réseau, et la ligne garde « ex … » (le papier du client porte l'ancien).",
        "**Le stock sort à l'encaissement**, jamais avant : ni au panier, ni à la proforma. Une réservation prépayée sort le stock à la livraison.",
        "**La vente se rattache au compte du client** par son numéro (8 derniers chiffres), sinon par le nom écrit exactement pareil. C'est ce qui la fait apparaître dans 👤 Clients et dans les données du client.",
        "**À crédit, une dette naît** dans 🧾 Dettes, du montant total dû (frais du devis compris), avec l'avance et son moyen de paiement. La commission du commercial **attend que la dette soit soldée**.",
        "**Le chiffre d'affaires** = articles − remise − rabais. **Pas** les frais d'installation ni de transport d'un devis (ils paient l'équipe). Une reprise diminue le chiffre d'affaires **net**, jamais le reçu.",
        "**La caisse du jour** reçoit les espèces ; Flooz et Mixx vont sur le solde du compte mobile de la boutique ; le virement sur BANQUE. C'est le moyen choisi qui décide, d'où l'importance de « Avance payée comment ? ».",
        "**Le reçu s'imprime tout seul** après l'encaissement : reçu de vente au comptant ; à crédit, le reçu de la dette (« REÇU DE DETTE » ou « REÇU DE VERSEMENT »).",
        "**Le journal** (🕘 Historique) écrit « Vente APE-2026-0012 (X F) — BOUTIQUE », avec les remises de ligne s'il y en a.",
        "**Un devis payé crée son chantier** : « ✅ Devis encaissé. Une fiche d'installation a été créée automatiquement… ». Le devis passe « 💰 Payé », le prospect sort de la file, le parrain du client est noté comme apporteur (bloqué jusqu'à la réception).",
        "**Les remises** : plus de 3 % (générale ou sur un article) = administrateur seul ; remise sur un article **et** remise générale = refusé pour tout le monde, administrateur compris — « l'une ou l'autre ». Le serveur revérifie : contourner l'écran ne sert à rien.",
        "**La journée d'hier non clôturée bloque la vente** : bandeau rouge « 🔒 Vente impossible : la journée du … de BOUTIQUE n'a pas été clôturée. Faites la clôture du jour dans 🔒 Caisse, puis revenez vendre. » Une vente faite **après** la clôture du jour n'est pas refusée : 🔒 Caisse signale la clôture dépassée, à refaire.",
        "**Une commande validée porte la vente** : la vente encaissée cite sa commande, et l'historique de 📥 Commandes reçues sait dire si la validation a été suivie d'un encaissement ou non. La remise d'une commande validée passe telle quelle à l'encaissement, même au-delà de 3 % si l'administrateur l'a posée sur le devis.",
        "**Le mur** : les articles, les clients proposés, les commerciaux, les boutiques d'un transfert sont ceux de l'espace regardé. Une vente de formation porte un reçu FOR-…",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**📦 Stocks** (chapitre 8) : le prix de vente pré-rempli, « dispo », les codes-barres ; le défectueux d'un 🔁 Retour attend son sort dans 🔧 Défectueux / SAV.",
        "**🧾 Dettes** (chapitre 7) : chaque vente à crédit y a sa dette ; les réservations prépayées s'y livrent ; la relance et les versements se font là.",
        "**🔒 Caisse** (chapitre 6) : la recette en espèces du jour, la clôture obligatoire, la clôture dépassée si on vend après avoir fermé.",
        "**☀️ Dimensionnement / 📋 Tous les devis** : un devis validé et signé arrive ici pré-rempli (« Payeur (si différent du client) », remise fixée, frais en cadre ambre) ; l'encaissement crée le chantier de 🏠 Clients installés.",
        "**🚚 Ravitaillement / 🔁 Transfert** (chapitre 9) : les deux demandes qu'on peut lancer depuis un panier en rupture.",
        "**🛠 Travaux à crédit** : « Facturer » envoie le panier ici avec des lignes déjà sorties du stock ; le reçu et la dette reviennent sur la fiche.",
        "**👑 Mon équipe / 💵 Ma commission** (chapitre 16) : le commercial, le rabais, l'apporteur externe, le parrain ; une commission n'est due qu'après réception des travaux **et** solde de la dette.",
        "**📊 Tableau de bord** : les cartes Ventes / Résultat et le graphique lisent ces ventes ; les proformas n'y entrent jamais.",
        "**👤 Clients** (chapitre 3) : la liste est construite à partir des ventes et des dettes ; le numéro tapé ici décide si le client s'y retrouve.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Le panier est **relu avec le client** avant d'encaisser : article, quantité, prix, remise.",
        "Le client a été **choisi d'un clic** dans la liste proposée (pas retapé), ou c'est un client de passage.",
        "Le **moyen de paiement** est celui par lequel l'argent est vraiment entré — et, à crédit, le moyen de l'avance aussi.",
        "À crédit, le **statut de l'article** est le bon : Livré (il part avec) ou Non livré (réservation).",
        "La remise ne dépasse pas **3 %** sans l'administrateur, et il n'y a pas remise sur un article **et** remise générale.",
        "Le reçu est sorti : imprimé, ou partagé sur WhatsApp — et c'est le **bon** reçu (dette à crédit).",
        "La ligne est en tête de la liste, avec la bonne pastille de paiement.",
        "Le soir : **la clôture du jour** dans 🔒 Caisse, **en dernier**, jamais avant la dernière vente.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3300], lignes: [
        ["Vendre alors qu'hier n'est pas clôturé", "Bandeau rouge « 🔒 Vente impossible : la journée du … n'a pas été clôturée… »", "🔒 Caisse, clôturer la journée en retard, revenir vendre."],
        ["Encaisser une remise de 5 % en tant que vendeur", "« 🔒 Une remise supérieure à 3 % est réservée à l'administrateur. Ramenez-la à 3 % au plus, ou faites encaisser par l'administrateur. »", "Ramener à 3 %, ou appeler l'administrateur."],
        ["Remise sur un article puis remise générale", "« Une remise est déjà accordée sur un article : plus de remise générale possible (retirez l'une ou l'autre). »", "Choisir l'une des deux."],
        ["Crédit sans statut d'article", "« Choisissez le statut de l'article (Livré ou Non livré) avant d'encaisser. »", "Répondre à la question : le client part-il avec l'article ?"],
        ["Avance par Mixx enregistrée en espèces", "La caisse du soir réclame des billets qui n'y sont pas.", "Toujours remplir « Avance payée comment ? » ; une erreur passée se voit dans 🔒 Caisse (écart)."],
        ["Faire une proforma « pour bloquer le prix » puis oublier de vendre", "Rien n'est vendu : la proforma reste « ⏳ En attente ».", "Au retour du client : 🧾 Proformas → 🛒 Vendre → encaisser."],
        ["Encaisser une vente pour un simple devis de prix", "Le stock est sorti, le chiffre d'affaires et la caisse bougent.", "C'est une proforma qu'il fallait. Si c'est fait : l'administrateur principal fait une ↩ Reprise (motif), le stock revient et l'argent est rendu."],
        ["Vendre un article à 0 F sans le vouloir", "L'application demande « Continuer ? » — répondre oui donne l'article.", "Annuler, faire corriger le prix dans 📦 Stocks."],
        ["Numéro de client tapé de travers", "La vente ne se rattache pas au compte : le client ne la voit pas, 👤 Clients fait deux lignes.", "Cliquer sur la proposition plutôt que retaper."],
        ["Supprimer une vente qui a créé un chantier, une commission payée, ou une dette avec versements", "« 🔒 Cette vente a créé le chantier de … » / « 🔒 La commission de cette vente a déjà été PAYÉE » / « 🔒 Le client a déjà versé … »", "Traiter d'abord ce qui en dépend, là où l'écran l'indique. Une dette **sans aucun versement** part avec la vente."],
        ["Vendre après la clôture du soir", "Pas refusé — mais la clôture devient une photo périmée.", "🔒 Caisse le signale (bandeau orange) : refaire la clôture. Règle : clôturer en dernier."],
        ["Chercher une vente par son ancien numéro « ex … »", "Elle se trouve : l'ancien numéro reste cherchable.", "Rien à faire — le papier du client porte l'ancien, la ligne porte les deux."],
        ["Valider une commande puis fermer l'écran sans encaisser", "La commande est « ✓ Validée » mais aucune vente n'existe : « ⚠ Commande validée mais NON ENCAISSÉE ».", "📥 Commandes reçues → « ↻ Reprendre l'encaissement »."],
        ["Un vendeur ne voit pas une commande envoyée à sa boutique", "Elle est « Destinée à » un autre vendeur nommément.", "Le commercial peut la refaire pour « N'importe quel vendeur » ; le gérant et l'administrateur la voient de toute façon."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Un client de passage achète 2 ampoules et un câble, paie en espèces, ne veut pas de compte.", reponse: "Scanner ou choisir les trois articles, laisser « Client » vide ou taper son nom, Paiement Espèces, « 💳 Encaisser la vente », confirmer. Le reçu s'imprime. La vente porte « Client non renseigné » si rien n'a été tapé : c'est permis." },
        { situation: "AMA prend une batterie de 250 000 F, en donne 100 000 par Mixx et paiera le reste le mois prochain. Elle repart avec la batterie.", reponse: "Paiement « Crédit (dette) », Statut « Livré », Avance versée 100 000, « Avance payée comment ? » Mixx/T-Money. Encaisser : la confirmation dit « Total dû 250 000 · Avance 100 000 · Reste 150 000 ». Le reçu remis est un **REÇU DE VERSEMENT** avec « RESTE À PAYER : 150 000 » en rouge. La suite dans 🧾 Dettes." },
        { situation: "KOFFI veut un onduleur qui n'est plus en stock à DEMAKPOE. Il paie tout de suite.", reponse: "L'onduleur s'ajoute quand même au panier. À l'encaissement : « Stock insuffisant… » → « Le client paie maintenant (réservation prépayée) ». Une réservation naît dans 🧾 Dettes, le reçu porte « NON LIVRÉ ». À l'arrivée de l'onduleur, on **livre** depuis 🧾 Dettes : c'est là que le stock sort et que la vente existe." },
        { situation: "Le même onduleur est disponible à APESSITO, et le client ne veut pas payer avant de le voir.", reponse: "« Transfert (demander à une autre boutique) » : l'écran montre le stock de chaque boutique, on choisit APESSITO. Le panier reste. On appelle APESSITO, qui valide dans son écran Stocks. Puis on reclique « 💳 Encaisser la vente » : ça passe." },
        { situation: "Un vendeur veut faire 6 % de remise à un bon client.", reponse: "Refusé au-delà de 3 % : « réservée à l'administrateur ». Soit il ramène à 3 %, soit l'administrateur encaisse lui-même. Et s'il a déjà mis une remise sur un article, la case Remise (%) est grisée : l'une ou l'autre." },
        { situation: "Un client demande « le prix pour 10 panneaux », sans acheter.", reponse: "Panier de 10 panneaux, son nom et son numéro, « 🧾 Proforma WhatsApp » : il reçoit le texte et le PDF. Rien n'est vendu. S'il revient dans 10 jours : 🧾 Proformas → 🛒 Vendre → on vérifie le prix (l'écran signale s'il a changé) → on encaisse." },
        { situation: "Un commercial en tournée a convaincu un client d'acheter 4 panneaux ; le client passera payer à APESSITO demain.", reponse: "🛒 Nouvelle commande : boutique APESSITO, 4 panneaux, le client et son numéro, « 📤 Envoyer la commande à la boutique ». Demain, le vendeur d'APESSITO clique « ✅ Valider et encaisser » : le panier arrive dans 💰 Ventes avec le commercial déjà noté, il encaisse. La commission du commercial est rattachée à cette vente." },
        { situation: "Sur place, le client renonce à un des deux articles qu'il vient de payer en espèces.", reponse: "Ce n'est ni un retour ni une suppression : c'est une **↩ Reprise**, par l'administrateur principal seul. Motif obligatoire ; l'article revient au stock ; l'argent rendu sort de la caisse du jour (« Remboursement client ») ; le reçu ne change pas ; un **bon de reprise** est proposé pour le client." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "**En espace formation**, avec un formateur qui regarde l'écran :"],
      ["ol", [
        "Faire une vente **au comptant** de deux articles à un client de passage, en espèces. Montrer le reçu et lire son numéro (FOR-…).",
        "Faire une vente **à crédit** avec une avance par Flooz, article livré. Lire la confirmation à voix haute (total dû, avance, reste) ; montrer que le reçu est un reçu de versement, puis retrouver la dette dans 🧾 Dettes.",
        "Émettre une **proforma** pour un client connu, puis la **vendre** depuis 🧾 Proformas et encaisser. Montrer la colonne « Suite » passée à « ✅ Encaissée ».",
        "Essayer une remise de **5 %** : lire le refus, ramener à 3 %. Mettre une remise sur un article et montrer que la remise générale se grise.",
        "Mettre au panier un article dont la quantité dépasse le « dispo » ; à l'encaissement, choisir **réservation prépayée** ; retrouver la réservation dans 🧾 Dettes.",
        "Dans la liste : chercher une vente par son numéro ; choisir « Ce mois » puis « ✏️ Personnaliser… » avec les dates à l'envers ; lire la période appliquée et la **recette**.",
        "Cliquer sur une ligne pour la déplier ; réimprimer son reçu avec 🖨 ; expliquer à quoi servent 📋, 🔁 et ↩ et qui a le droit.",
        "**Avec un compte de commercial de formation** : envoyer une commande de deux articles à la boutique ; **revenir sur le compte vendeur** : la trouver dans 📥 Commandes reçues, « ✅ Valider et encaisser », encaisser, puis lire « ✅ Encaissée — vente N° … » dans l'historique.",
      ]],
      ["note", "Le formateur vérifie surtout : le **moyen de paiement** juste (surtout l'avance), le **statut de l'article** à crédit, et le réflexe **proforma** quand le client demande seulement un prix."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "compose un panier au lecteur et à la main, et encaisse au comptant ;",
        "encaisse à crédit avec le bon statut, la bonne avance et son moyen, et remet le reçu de la dette ;",
        "émet une proforma, la revend plus tard, et sait qu'elle ne compte nulle part ;",
        "sait quoi choisir quand le stock manque, et ce que chaque choix fait au client et au stock ;",
        "connaît la règle des 3 % et « l'une ou l'autre » ;",
        "retrouve une vente, lit la recette d'une période, et sait qui fait 📋 / 🔁 / ↩ / 🗑 ;",
        "reçoit une commande de commercial, la valide et l'encaisse — ou la refuse avec un motif.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Quelle différence entre « 💳 Encaisser la vente » et « 🧾 Proforma WhatsApp » pour le stock, la caisse et le chiffre d'affaires ?",
        "À crédit avec une avance payée par Mixx : quelles cases faut-il remplir, et pourquoi la dernière compte-t-elle pour la caisse du soir ?",
        "Quel reçu remet-on après une vente à crédit sans avance ? Et avec une avance ?",
        "Un vendeur peut-il accorder 4 % de remise ? Et 2 % sur un article plus 2 % sur toute la vente ?",
        "Le stock manque et le client ne paie pas aujourd'hui : quelles sont les deux demandes possibles, et laquelle garde le panier ?",
        "Pourquoi la vente est-elle bloquée ce matin, et où va-t-on pour la débloquer ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Compose un panier (lecteur et fenêtre « Rechercher un article ») et encaisse au comptant",
      "Encaisse à crédit : statut de l'article, avance, moyen de l'avance, reçu de la dette",
      "Émet une proforma et la revend depuis 🧾 Proformas",
      "Sait choisir entre réservation, ravitaillement et transfert quand le stock manque",
      "Applique la règle des 3 % et « remise sur article OU remise générale »",
      "Retrouve une vente, lit la recette d'une période, réimprime le reçu",
      "Sait qui fait 📋 Devis, 🔁 Retour, ↩ Reprise, 🗑 Supprimer",
      "Valide et encaisse une commande reçue d'un commercial",
      "Répond juste aux six questions de la rubrique 12",
    ],
  },
};
