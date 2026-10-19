// ============================================================
// (12/10/2026 : le matériel réservé — avertissementReserve, lib/achatsChantier.js.)
// MANUEL DE FORMATION — CHAPITRE 5 : Ventes et commandes
//
// ⚠ Dans le plan retenu par Timo (celui de ChatGPT, 22/09/2026), le chapitre 4
// est « Prospects » et le 5 « Ventes et commandes ». Ce chapitre a été écrit
// en premier, sur sa demande « Lance le chapitre 4 » après une annonce fautive
// de ma part (j'avais dit « chapitre 4 (Ventes) ») ; il porte le BON numéro.
//
// Des MOTS, rien d'autre. Chaque bouton, chaque règle vient du code :
// screens/Ventes.jsx (le panier, l'encaissement, la proforma, la liste, les
// fenêtres ↩ Reprise, 🔁 Retour et 🔄 Échanger), lib/echanges.js (l'échange d'un article), screens/Commandes.jsx (🛒 Nouvelle
// commande, 📥 Commandes reçues), components/SelecteurArticle.jsx (la
// fenêtre « Rechercher un article »), lib/constants.js (PAIEMENTS),
// lib/calculs.js (PLAFOND_REMISE_PCT = 3, critiqueRemises,
// MSG_REMISE_EXCLUSIVE, remiseExigeAdmin, apporteursPossibles,
// compteClientPour, reprendreProforma, ventesDeProforma, periodes,
// bornesPersonnalisees, recetteDesVentes, totalDesProformas,
// ROLES_RETOUR_GARANTIE), lib/core.js (prochainNumeroVente, numeroRecu,
// prefixeBoutique, documentDeVente, titreRecuDette), lib/cloture.js
// (motifBlocageVente), lib/bandesVersement.js, lib/reprises.js, lib/bons.js, lib/impression.js
// (imprimerRecuDeVente, recuWhatsApp), lib/clientsConnus.js ; 📋 Inventaire :
// screens/InventaireVentes.jsx, lib/inventaireVentes.js (10/10/2026) ; 🏗 la
// case « Chantier » : lib/achatsChantier.js, components/AchatsChantier.jsx (11/10/2026).
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
        "connaître les **gestes après la vente** — 📋 Devis, 🔁 Retour, 🔄 Échanger, ↩ Reprise — et qui a le droit de les faire ;",
        "pour le commercial et le technicien : **envoyer une commande** à la boutique, et pour le vendeur, la **valider et encaisser**.",
      ]],
      ["regle", "**Une vente encaissée sort du stock, entre dans le chiffre d'affaires et dans la caisse du jour, tout de suite.** Une proforma ne fait rien de tout ça. C'est la première chose à savoir : on n'encaisse pas « pour voir »."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [5200, 4100], lignes: [
        ["Ouvrir 💰 Ventes, composer un panier, « 💳 Encaisser la vente », « 🧾 Proforma WhatsApp », 🖨️ proforma, 🛒 Vendre une proforma, 🖨 / WhatsApp sur une vente", "**Vendeur, gérant, administrateur**"],
        ["Voir la liste 🧾 Proformas", "Vendeur, gérant, responsable commercial, administrateur"],
        ["Une remise **au-delà de 3 %** (générale, ou sur un article)", "**L'administrateur seul** — le serveur applique la même règle. **Sauf** la remise d'une proforma reprise par 🛒 Vendre **avec son panier inchangé** : tout vendeur l'encaisse."],
        ["📋 Devis (reprendre la vente pour en faire un devis d'installation)", "L'administrateur, le responsable commercial, et **le vendeur qui a fait cette vente**"],
        ["🔁 Retour / échange sous garantie", "**Gérant et administrateur**"],
        ["🔄 Échanger un article contre un autre (le client paie ou reçoit la différence)", "**Gérant et administrateur**"],
        ["↩ Reprise de l'article par BMI", "**L'administrateur principal seul**"],
        ["🗑 Supprimer une vente", "**L'administrateur** — et seulement si rien n'en dépend (rubrique 9)"],
        ["📋 Inventaire (le second bouton de 💰 Ventes, à côté de 🛒 Vendre)", "**Gérant et administrateur** — le vendeur ne le voit pas"],
        ["📊 INVENTAIRE GÉNÉRAL (toutes les boutiques ensemble)", "**L'administrateur seul**"],
        ["🛒 Nouvelle commande (envoyer un panier à la boutique)", "**Commercial, technicien**"],
        ["📥 Commandes reçues : « ✅ Valider et encaisser », « ❌ Refuser »", "**Vendeur, gérant, administrateur** — un vendeur ne voit que les commandes de sa boutique qui lui sont destinées ou destinées à « n'importe quel vendeur »"],
        ["Le comptable", "Ne voit pas 💰 Ventes. Il lit les ventes dans le tableau de bord et l'historique."],
      ]}],
      ["note", "Un vendeur ou un gérant **rattaché à une boutique** vend dans la sienne, sans pastille de choix. L'administrateur choisit la boutique en haut de l'écran ; elle est **mémorisée pour cet écran** et ne change jamais toute seule."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3300, 6000], lignes: [
        ["**💰 Ventes**, cadre « Nouvelle vente »", "🔍 Code-barres · Domaine · Catégorie · Article (« — Choisir un article — ») · Quantité · Prix unitaire (F) · Remise ligne (une case, avec au-dessus « Remise ligne (%) » ou « Remise ligne libre (F) ») · « Ajouter au panier » · le 🛒 Panier · Client · Numéro du client · Remise (une case, avec au-dessus « Remise (%) » ou « Remise libre (F) ») · Commercial · Paiement · (à crédit) Statut de l'article, Avance versée, « Avance payée comment ? » · la case 🤝 apporteur externe · « 💳 Encaisser la vente » · « 🧾 Proforma WhatsApp » · 🖨️ · le Total."],
        ["**💰 Ventes**, les deux boutons du haut (gérant, administrateur)", "« 🛒 Vendre » (l'écran de vente, ouvert d'office) et « 📋 Inventaire » (rubrique 4, H) ; pour l'administrateur, « 📊 INVENTAIRE GÉNÉRAL » (rubrique 4, I)."],
        ["**💰 Ventes**, cadre du bas", "Deux vues : « 💰 Ventes (N) » et « 🧾 Proformas (N) » ; « 🔍 Rechercher… » ; la période (Toute période, Aujourd'hui, Cette semaine, Ce mois, Cette année, ✏️ Personnaliser…) ; « 💰 Recette » ; les pastilles de paiement (Tout paiement, Espèces, Flooz, Mixx/T-Money, Virement bancaire, Crédit (dette)) ; la liste, et ses boutons ronds."],
        ["**🛒 Nouvelle commande** (commercial, technicien)", "La boutique à choisir, « 🔍 Scanner un code-barres », Catégorie, Article, Quantité, Prix unitaire (F), « ➕ Ajouter », le panier, Client (facultatif), Numéro du client, « Remise (%) — facultatif », « Paiement proposé », « Vendeur destinataire (facultatif) », « Rabais offert au client (F) — facultatif », « Associer mon responsable (facultatif) », « 📤 Envoyer la commande à la boutique », puis la liste de ses commandes (⏳ En attente · ✓ Validée · ✗ Refusée)."],
        ["**📥 Commandes reçues** (vendeur, gérant, administrateur)", "« 📥 Commandes en attente (N) » avec « ✅ Valider et encaisser » / « ❌ Refuser », puis « Historique récent » (Validée / Refusée, « ✅ Encaissée — vente N° … », ou « ⚠ Commande validée mais NON ENCAISSÉE » avec « ↻ Reprendre l'encaissement »)."],
        ["**🔒 Caisse**", "La clôture du jour (chapitre 6). Sans elle, la vente du lendemain est bloquée."],
        ["**🧾 Dettes**", "Les ventes à crédit y créent leur dette ; les réservations prépayées s'y livrent."],
        ["**📦 Stocks**", "Les articles, leurs prix, leurs codes-barres, le défectueux d'un retour (🔧 Défectueux / SAV)."],
      ]}],
      ["note", "Si l'écran dit « Aucun article en stock. L'administrateur doit d'abord enregistrer les articles dans Stocks. », ce n'est pas une panne : la boutique regardée n'a aucun article."],
      ["note", "**La règle des lignes de toute l'application** (Timo, 15/10/2026 : « en faire une règle générale pour l'application ») : la liste des **🧾 Proformas** et l'onglet **🏗 Achats chantier** se lisent comme les ventes : le client (ou le chantier) **figé à gauche**, un **clic sur la ligne** d'une proforma déplie tous ses articles, ce qu'elle est devenue en **pastille** (✅ Encaissée / ⏳ En attente), et les gestes en **boutons ronds** — 🖨 réimprimer, 🛒 vendre, ✏️ modifier ; 🖨 imprimer et ↩ annuler un achat — le nom au survol. Dans le panier, « Retirer » est le bouton rond **✕**. Côté boutique, **🧾 Commandes** suit la même règle : le client figé, les articles sur deux lignes puis la suite au clic, le paiement en pastille, ✅ valider et encaisser · ❌ refuser en boutons ronds ; ↻ reprendre l'encaissement dans l'historique."],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Une vente au comptant"],
      ["etapes", [
        { titre: "Mettre les articles au panier", texte: "**Au lecteur** : le curseur dans « 🔍 Code-barres », on scanne, l'article s'ajoute en quantité 1 au prix de vente. **À la main** : Domaine et Catégorie réduisent la liste (facultatif), puis « — Choisir un article — » ouvre la fenêtre « 🔍 Rechercher un article… » — chaque ligne montre **le prix en bleu et « dispo : N »**. On clique l'article, on saisit la Quantité, le Prix unitaire est pré-rempli, puis « Ajouter au panier »." },
        { titre: "Vérifier le 🛒 Panier", texte: "Article · Qté · P.U. · Remise · Montant, et le bouton rond **✕** (retirer) sur chaque ligne. Le **Total** se lit en bas, à côté du bouton d'encaissement." },
        { titre: "Le client", texte: "Taper dans « Client » ou « Numéro du client » : la boutique propose ceux qu'elle connaît (numéro, dernier passage, ce qu'ils doivent). **Un clic remplit les deux cases.** Un client de passage se tape librement ; sans nom, la vente porte « Client non renseigné »." },
        { titre: "Remise et commercial, s'il y a lieu", texte: "« Remise » sur toute la vente : au-dessus de la case, choisir **« Remise (%) »** pour taper un pourcentage, ou **« Remise libre (F) »** pour taper un montant en francs. **3 % au plus** pour un vendeur ou un gérant — une remise libre compte pour le pourcentage qu'elle représente (7 200 F sur 240 000 F = 3 %). « Commercial » : celui qui a amené le client, avec son taux. S'il a un taux, une case « Rabais offert par … (F) » apparaît : ce rabais est **pris sur sa commission**, jamais sur la marge — la case dit le maximum." },
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
        "Le panier composé (client et numéro remplis si on veut l'envoyer), **« 🧾 Proforma WhatsApp »** : la proforma est enregistrée (numéro PRF-…), **le PDF se télécharge**, puis, après une question, **elle part du numéro BMI avec son PDF en pièce jointe** (si WhatsApp refuse le PDF — même après l'avoir accepté —, elle repart toute seule sans le PDF, avec la liste des articles, une seule fois) ; si le numéro BMI ne peut pas envoyer, WhatsApp s'ouvre sur le numéro du client avec le texte, et on joint le PDF. Le bouton **🖨️** à côté l'imprime au lieu de l'envoyer.",
        "**Rien n'est comptabilisé** : ni stock, ni chiffre d'affaires, ni caisse. Le message le dit : « émis … (non comptabilisé) ». Validité écrite sur le document : 15 jours.",
        "Le client revient : vue **🧾 Proformas**, sur sa ligne **« 🛒 Vendre »**. Le panier se remplit, le nom et le numéro aussi, et **l'encaissement reste à faire** (« Vérifiez, puis encaissez »). Le prix de la proforma est gardé ; si le prix du jour a changé, l'écran le dit.",
        "La colonne **« Suite »** dit ce que chaque proforma est devenue : « ✅ Encaissée le … — reçu N° » ou « ⏳ En attente ». Une proforma déjà encaissée se revend quand même, mais **on prévient** : ce sera une nouvelle vente, avec un nouveau reçu.",
      ]],
      ["regle", "**La remise d'une proforma suit sa vente, si le panier n'a pas bougé.** Une proforma à plus de 3 % n'a pu être faite que par l'administrateur ; reprise par 🛒 Vendre, **tout vendeur l'encaisse** tant que les articles, les quantités, les prix, les remises et le pourcentage sont ceux de la proforma. Un article ajouté ou une quantité changée : la limite de 3 % revient, et le refus dit « La remise de la proforma N° … ne vaut que pour son panier tel quel »."],
      ["attention", "**Trois mots pour trois gestes**, à ne pas confondre : **🛒 Vendre** (une proforma devient un panier), **↩ Reprise** (BMI reprend un article que le client rend), **🔁 Retour** (échange sous garantie : le même article, sans vente), **🔄 Échanger** (le client prend un AUTRE article : une nouvelle vente, la différence payée ou rendue)."],

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
        "**« 💰 Recette : X F · N ventes »** = la somme **de ce qui est affiché** — elle suit la période, le moyen et la recherche. S'il y a eu une reprise : « dont X repris, net Y ». **Un échange** n'y compte que ce que le client a payé EN PLUS (rien si BMI a rendu de l'argent) : l'avoir est dit à côté (« 🔄 échanges : X d'avoir non compté »), et l'argent rendu au client sort du net (« dont X rendu sur échange, net Y »). Le chiffre « Aujourd'hui : … » en haut de la liste suit la même règle. Sur les proformas, c'est « Total des proformas », jamais « recette ».",
        "**La colonne TOTAL met en gras le chiffre qui compte.** Une vente ordinaire : son total, en gras. **Une vente qui a eu une reprise** : le total (ce que le client a payé, celui du reçu) en caractères normaux, dessous **« ↩ repris : −X »** (toutes les reprises de ce reçu, au prix payé) puis **« reste : Y »** en gras — la valeur restante de la facture. **Une vente à crédit** : le total en caractères normaux, de la couleur du mot « Crédit », et en bas **« avance : X »** en gras — ce que le client a donné le jour de la vente (« avance : 0 F » s'il n'a rien donné). Les versements des jours suivants ne s'y ajoutent pas : ils se suivent dans 📋 Dettes.",
        "**💸 Une bande noire après chaque versement** du tiroir (espèces) : « 💸 Versement du … à … — montant → destination », ✅ validé ou ⏳ en attente, par qui. Dessous, **le résumé des ventes faites depuis le versement précédent** (« Depuis le début » pour le premier) : le nombre de ventes et le montant par moyen — Espèces, À crédit (dont l'avance), Flooz, Mixx/T-Money, Virement —, puis « ➕ Dettes réglées en espèces » s'il y en a. Ce résumé compte **toutes** les ventes entre les deux versements, **quels que soient les filtres** ; seule la période retire une bande. Un versement rejeté par le DG, parti d'un compte Flooz / Mixx, **ou fait par le bouton 💸 d'une vente ou d'un règlement** n'en a pas : seuls les versements généraux de 🔒 Caisse séparent les ventes. Un versement d'avant le 08/10/2026 n'a pas d'heure : sa bande se place en haut de sa journée.",
        "**Un clic sur une ligne la déplie** (tous les articles) ; un clic sur une autre la déplie à sa place. La ligne ouverte a un fond bleu et une barre à gauche.",
      ]],

      ["h3", "E bis. 🏗 Le matériel qui part pour un chantier — la case « Chantier » (gérant, administrateur)"],
      ["p", "Un devis coché **« 🔧 Avec installation »** (chapitre 11) ne sort **pas** le stock quand le client paie : le matériel reste dans la boutique jusqu'au jour où les techniciens viennent le chercher. Ce jour-là, la gérante fait une vente d'après leur liste, avec la case **« 🏗 Chantier »** cochée."],
      ["etapes", [
        { titre: "Composer le panier", texte: "Comme une vente ordinaire : les articles du stock, au **prix de la boutique**. Les remises se font comme au comptoir (3 % au plus pour la gérante, l'une ou l'autre)." },
        { titre: "Cocher « 🏗 Chantier » et choisir le chantier", texte: "La liste « Pour quel chantier ? » ne propose que les chantiers **nés d'un devis « Avec installation »**, pas encore réceptionnés, de l'espace regardé. Le cadre dit **ce que le client a payé** pour son devis, la **part matériel** du devis, ce qui a **déjà été acheté**, et ce que coûte cet achat." },
        { titre: "« 🏗 Enregistrer l'achat pour le chantier »", texte: "Le formulaire du client, le paiement et la proforma disparaissent : le paiement est **« 🏗 Payé par le dépôt chantier »**. Une confirmation dit tout, puis le matériel **sort du stock** et **« FACTURE D'ACHAT POUR LE CHANTIER … »** s'imprime — un document **interne**, signé « Remis par » et « Reçu par (technicien) ». Aucun WhatsApp ne part." },
        { titre: "Retrouver un achat", texte: "Dans la liste, l'onglet **« 🏗 Achats chantier (N) »** : date, numéro **…-ACH-2026-0001**, chantier, articles, total, et « ✅ Réglé » ou « ⏳ X F en attente ». **🖨 Imprimer** refait la facture ; l'administrateur a **↩ Annuler** (motif obligatoire : le matériel revient en stock, l'achat reste écrit, marqué annulé)." },
      ]],
      ["regle", "**Un achat pour un chantier est puisé dans le DÉPÔT du client, et c'est LUI la vente.** Le paiement du devis n'était qu'un dépôt : l'achat compte dans le **chiffre d'affaires de la boutique qui remet le matériel**, au prix de la boutique, le jour de la sortie, avec **son prix d'achat**. Rien n'entre dans le tiroir (l'argent est déjà dans la caisse 🏗 DÉPÔT CHANTIER), aucune commission (elle reste celle du devis). La clôture du jour ne le bloque pas."],
      ["note", "**À la réception du chantier**, ce qui reste du devis devient la dernière vente, dans la boutique du devis : le matériel jamais puisé, puis les frais d'installation et le transport (moins ce que le matériel a déjà pris sur eux). Le total des ventes est donc ce que le devis demandait."],
      ["h3", "🔒 Le matériel réservé pour une installation"],
      ["p", "Tant que l'achat « 🏗 Chantier » n'est pas fait, le matériel d'un devis « 🔧 Avec installation » **payé** est **réservé** : il est encore sur l'étagère, mais il appartient déjà à un chantier."],
      ["etapes", [
        { titre: "Une vente qui prend le matériel d'un chantier", texte: "À « 💳 Encaisser », si la vente laisse en stock moins que ce qui est réservé, une question s'affiche avant toute écriture : « ⚠ Du matériel réservé pour une installation : • Batterie 51,2V 200Ah : 3 en stock, dont 1 réservé pour une installation — Kossi MENSAH (1, payé le 08/10/2026). Après cette vente, il manquera 1 pour ce chantier. Continuer quand même ? »" },
        { titre: "OK ou Annuler", texte: "**Annuler** : rien n'est enregistré, le panier reste. **OK** : la vente continue normalement ; le chantier manquera de ce matériel, et 📦 Stocks le montre en rouge (chapitre 8). Ce n'est jamais un blocage." },
      ]],
      ["p", "La même question se pose au gérant qui fait un achat « 🏗 Chantier » pour un **autre** chantier. Elle ne se pose pas pour un devis « Avec installation » encaissé (son stock ne sort pas) ni pour une réservation prépayée."],
      ["attention", "**Si le client n'a pas encore assez payé**, la partie qui manque reste **« ⏳ en attente du chantier »** — pas de dette. **Son prochain versement la règle d'abord, tout seul**, et la gérante en est informée par une notification. Au-delà de la **part matériel du devis**, un avertissement rouge (jamais un refus) : le surplus est pris sur les frais d'installation."],

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
        ["Logo WhatsApp", "Après une question, envoie le reçu du **numéro WhatsApp BMI**, avec son **PDF** en pièce jointe (pour un dépôt chantier, le reçu de dépôt, sans PDF). Sans numéro sur la vente, ou si le numéro BMI ne peut pas envoyer, WhatsApp s'ouvre avec le reçu complet et on appuie sur Envoyer.", "Tous"],
        ["🧾", "N'apparaît que s'il existe un bon : réimprime le **bon de reprise** ou le **bon de retour**, ou l'envoie par WhatsApp. Après un **🔄 échange**, il est sur l'ancienne ligne ET sur la nouvelle et réimprime **le reçu de l'échange**.", "Tous"],
        ["📋", "Transforme la vente en **devis d'installation** : les articles servent de point de départ, le client est retrouvé par son numéro.", "Admin, resp. commercial, le vendeur de cette vente"],
        ["🔁", "**Retour / échange sous garantie** : le défectueux entre au SAV, un remplacement sort du stock **sans vente ni commission**, gratuit ou avec des frais facturés (une dette du montant saisi).", "Gérant, administrateur"],
        ["💸", "**Verser l'argent de CETTE vente** (09/10/2026) : quand le DG a pris lui-même l'argent d'une vente, ou qu'on le porte à la BANQUE ou au comptable. Le bouton n'existe que sur une vente **payée** en espèces ou par compte mobile, pas encore versée (une vente à crédit se verse par ses règlements, 📋 Dettes, chapitre 7 ; un virement est déjà à la banque). On choisit **Chez le DG**, **BANQUE** (banque + bordereau) ou **Chez le comptable** ; le montant est celui de la vente (colonne TOTAL, moins ce qui a été repris). L'argent **sort tout de suite** du tiroir (ou du compte mobile), attend la validation du DG ou du comptable, **revient s'il est rejeté**. Sous le paiement : « 💸 versée » (orange tant que le DG n'a pas validé, vert ensuite) ; un clic sur la ligne de la vente montre le détail dessous — « Chez le DG — ⏳ en attente », puis « ✅ validé le … par … » ; la ligne s'agrandit, les colonnes ne bougent pas. **Une fois le versement validé, toute la ligne de la vente se grise** (fond gris, textes gris, les boutons restent) : on voit d'un coup d'œil que cet argent est déjà remis ; en attente, elle reste normale ; rejeté, elle redevient normale. **Aucune bande noire.** Une vente ne se verse qu'une fois. **Une vente faite AVANT un versement général** (🔒 Caisse) **n'a plus de bouton** : son argent est déjà parti avec ce versement ; à la place, en gris sous le paiement, « dans un versement » ; un clic sur la ligne montre lequel (« du 09/10/2026 à 16:49 → Chez le DG »). Un versement général rejeté par le DG n'emporte rien (l'argent est revenu dans le tiroir).", "Gérant, administrateur"],
        ["🔄", "**Échanger un article contre un autre** (14/10/2026) : le client rend un article de cette vente et en prend un autre du stock. Dans la fenêtre : la quantité rendue devant chaque article (0 = gardé) ; **« L'article rendu va »** — **au stock** (bon état, il sera revendu) ou **au SAV** (défectueux, jamais revendu : il attend son sort dans 📦 Stocks → 🔧 Défectueux / SAV) ; **ce que le client emporte**, en tapant son nom (« ➕ Un autre article » pour en ajouter) ; le **motif** (obligatoire). L'aperçu dit : la **valeur rendue** (ce que le client avait payé pour cet article, remises comprises), le **nouvel article au prix du jour**, puis **« Le client paie : X »** ou **« BMI rend au client : X »**, avec le moyen (espèces, Flooz, Mixx, virement — **jamais à crédit**). Un **nouveau reçu** est établi (le reçu de l'échange : « 🔄 Échange du reçu n° … », l'article rendu en moins, « PAYÉ PAR LE CLIENT », et « RENDU AU CLIENT » s'il y a lieu) ; l'ancien reçu ne change pas. **Seule la différence passe par la caisse.** Refusé : une vente dont la dette n'est pas soldée (l'article rendu n'est pas encore payé), un dépôt chantier, des travaux, une vente qui a créé un chantier, une commission déjà payée ; une différence à rendre en espèces plus grosse que le tiroir (« rendez-la par un autre moyen, ou plus tard »).", "Gérant, administrateur"],
        ["↩", "**Reprise d'articles par BMI** : la fenêtre montre **toutes les lignes de la vente**, une case de quantité devant chacune (0 = gardé) — on reprend **plusieurs articles d'un coup**, avec **un seul motif** et un seul moyen de remboursement. Les articles reviennent au stock, l'argent est rendu en **une** sortie de caisse « Remboursement client » (ou la dette diminue), qui se lit dans 📤 Dépenses (chapitre 17) ; le reçu ne change pas, le chiffre d'affaires et la commission sont réduits. **Un seul bon de reprise** liste tous les articles ; il porte aussi la **vente d'origine** (chaque article, sa quantité, son prix), le prix unitaire de ce qui est repris, le vendeur, et la **nouvelle situation** : montant d'origine − reprises (celles d'avant comprises) = nouveau montant de la vente, déjà payé, reste à payer. Motif obligatoire.", "Administrateur principal"],
        ["🗑", "Supprime la vente — refusé si un chantier, une commission payée ou un versement en dépend, et pour les deux ventes d'un **échange**.", "Administrateur"],
      ]}],

      ["h3", "H. 📋 L'inventaire de la boutique (gérant, administrateur)"],
      ["p", "En haut de 💰 Ventes, deux boutons : **« 🛒 Vendre »** (l'écran de vente, ouvert d'office) et **« 📋 Inventaire »**. L'inventaire porte sur la boutique regardée et sur une période choisie dans la liste habituelle — **« Aujourd'hui » à l'ouverture**, puis Cette semaine, Ce mois, Cette année, ✏️ Personnaliser… ou Toute période. C'est une **lecture** : rien n'est écrit, et chaque chiffre est celui de 🔒 Caisse, de la clôture du jour, de 📤 Dépenses et de 🧾 Dettes."],
      ["table", { entetes: ["Bloc", "Ce qu'il dit"], largeurs: [2600, 6700], lignes: [
        ["1. Les ventes", "Ce qui a été **vendu** dans la boutique, une ligne par moyen de paiement, **crédit compris** : nombre de ventes et montant ; les reprises faites dans la période sont retirées (le **net**). Un **dépôt chantier** (devis avec installation) n'y est **pas** : il est dit à part (« pas des ventes ») ; le matériel que la boutique a remis à un chantier y figure, sous « Puisé dans le dépôt chantier ». Une vente de devis sans installation y figure, avec la mention « caisse 🏗 DÉPÔT CHANTIER » : son argent ne va pas dans le tiroir."],
        ["2. Les recettes", "L'argent **entré** dans la caisse de la boutique, par moyen : ventes payées + règlements de dettes. Une vente à crédit n'y entre que par ce que le client a versé. La ligne Espèces est la recette du tiroir."],
        ["3. Les dépenses", "Par catégorie, avec le total — **seulement celles qui comptent**. Celles qui attendent le DG et les rejetées sont dites à part, sans être comptées. « Dont payées par le tiroir » sépare ce qui est sorti des billets. Un remboursement de client, d'une avance, un prêt au personnel sont rangés dans « Autres sorties — pas des charges »."],
        ["4. Les versements", "Chaque versement de la période : date, heure, destination (DG, banque, comptable), état (✅ validé, ⏳ en attente, ✖ rejeté). Le total exclut les rejetés."],
        ["5. La caisse", "**Maintenant** : le tiroir (le même chiffre que « Fonds à verser » de 🔒 Caisse), l'enveloppe du fonds de caisse, le solde Flooz et Mixx de la boutique. Puis **le tiroir pendant la période** : la veille au soir + entrées en espèces − dépenses payées par le tiroir − versements = le soir du dernier jour."],
        ["6. Les dettes", "Créées dans la période, règlements reçus dans la période, **reste total à recouvrer** (toutes périodes), celles **en retard de plus de 30 jours** avec leur liste (client, depuis quand, reste)."],
        ["7. Le comptage", "Pour chaque jour : ce que le tiroir devait contenir, **ce qui a été compté à la clôture**, l'écart (négatif = il manquait de l'argent). Le total des écarts, et les **journées non clôturées** en rouge. On ne recompte rien ici : le comptage se fait à la clôture du jour (chapitre 6). Une clôture faite avant une vente est signalée « la caisse a bougé après la clôture »."],
      ]}],
      ["p", "**« 🖨 Imprimer (PDF) »** sort l'inventaire sur papier, **« Exporter (CSV) »** l'ouvre dans un tableur — mêmes chiffres, même période."],
      ["note", "Le fonds de caisse (l'enveloppe) et les comptes Flooz / Mixx ne sont jamais comptés physiquement : leur solde vient des saisies. Seul le tiroir est compté, le soir, à la clôture du jour."],
      ["h3", "I. 📊 L'inventaire général — toutes les boutiques (administrateur)"],
      ["p", "À côté de « 📋 Inventaire », l'administrateur a un troisième bouton : **« 📊 INVENTAIRE GÉNÉRAL »**. Il réunit **toutes les boutiques de l'espace regardé et la caisse 🏗 CHANTIER** ; les magasins n'y sont pas (ils ne vendent pas). Même période, mêmes sept blocs, mêmes boutons PDF et CSV. Un clic sur une boutique de la rangée du haut revient à l'inventaire de cette boutique."],
      ["ul", [
        "**En tête, le tableau « Par caisse »** : une ligne par boutique et pour la caisse 🏗 DÉPÔT CHANTIER — vendu, recettes, dépenses, versé, tiroir maintenant, dettes restantes, écarts des clôtures (et les jours non clôturés) — puis la ligne **TOTAL**. Sur téléphone, la colonne « Caisse » reste à gauche quand les chiffres défilent.",
        "**Les blocs 1 à 6 additionnent les caisses.** Une vente issue d'un devis est vendue dans sa boutique et son argent est dans les recettes de la caisse DÉPÔT CHANTIER : il n'est compté qu'une fois. Une dette de devis aussi, même si elle figure dans la liste de sa boutique et dans celle de la caisse DÉPÔT CHANTIER.",
        "**Les dépenses payées chez le DG, par la BANQUE ou chez le comptable** (un salaire, une commission…) ne sont dans aucune boutique : elles ont leur cadre à part dans le bloc 3, puis « Toutes les dépenses (boutiques + caisses centrales) ». Ce cadre ne s'affiche qu'en réel.",
        "**Le bloc 7 donne le comptage par caisse** : nombre de clôtures, jours avec écart, total des écarts, et les journées non clôturées en rouge. La caisse DÉPÔT CHANTIER n'est jamais en faute : sa clôture est facultative.",
      ]],
    ]},

    // ── 5
    { titre: "Explication de chaque bouton et champ", blocs: [
      ["h3", "Le cadre « Nouvelle vente »"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["🔍 Code-barres", "Le lecteur USB « tape » le code puis Entrée : l'article s'ajoute en quantité 1. Code inconnu : « Aucun article avec le code « … » dans BOUTIQUE. Assignez les codes dans l'onglet Stocks. »"],
        ["Domaine / Catégorie", "Réduisent la liste des articles (solaire, garage, caméra… puis la famille). « — Tous — » d'office. Choisir un article remet ses filtres à jour."],
        ["Article", "Ouvre la fenêtre « 🔍 Rechercher un article… », par catégorie, prix en bleu et « dispo : N » sur chaque ligne."],
        ["Quantité / Prix unitaire (F)", "Le prix de vente du stock est pré-rempli ; il se corrige pour cette vente seulement."],
        ["Remise ligne", "**Une seule case.** Au-dessus, la liste choisit ce qu'on tape : « Remise ligne (%) » (un pourcentage) ou « Remise ligne libre (F) » (un montant en francs) ; changer de choix garde la remise déjà calculée. **Grisée dès qu'une remise générale est saisie** (« Remise générale déjà saisie : pas de remise par article. »). Au-delà de 3 % de la ligne : administrateur seul."],
        ["Ajouter au panier", "Refuse sans article, quantité ou prix (« Choisissez un article, la quantité et le prix. »)."],
        ["🛒 Panier", "Les lignes, et le bouton rond ✕ pour en retirer une."],
        ["Client / Numéro du client", "Les clients connus de la boutique se proposent ; un clic remplit les deux. Le numéro rattache la vente au compte du client (8 derniers chiffres)."],
        ["Remise", "Sur toute la vente. **Une seule case** : au-dessus, « Remise (%) » ou « Remise libre (F) » ; changer de choix reprend la remise déjà saisie dans l'autre unité (2 % de 240 000 F → 4 800 F). Une remise libre s'écrit sans pourcentage sur la confirmation, le reçu et la proforma (« remise libre = −7 200 F »). **Grisée si une remise a été accordée sur un article** (« Remise déjà accordée sur un article : pas de remise générale. »). Plus de 3 % : administrateur seul."],
        ["Commercial", "L'apporteur interne : commercial, technicien, responsable commercial (ceux qui ont un taux), de l'espace regardé. Un commercial connecté est pré-rempli et ne peut pas se changer."],
        ["Rabais offert par … (F)", "N'apparaît que si le commercial a un taux. Plafonné à sa commission ; « pris sur sa commission, pas sur la marge BMI »."],
        ["Paiement", "Espèces · Mobile Money (Flooz) · Mobile Money (Mixx/T-Money) · Virement bancaire · Crédit (dette)."],
        ["Statut de l'article", "Crédit seulement : Livré / Non livré. Obligatoire. Non livré = réservation prépayée."],
        ["Avance versée / Avance payée comment ?", "Crédit seulement. L'avance est plafonnée à ce qui est dû ; son moyen de paiement est demandé dès qu'elle est > 0."],
        ["🤝 Un apporteur externe (non-utilisateur) a amené ce client", "Une personne hors de l'équipe : nom, téléphone, commission en % **ou** montant fixe. Sa commission s'affiche ; elle se paie dans 👑 Mon équipe (chapitre 16)."],
        ["🔧 Ce devis inclut des frais…", "Cadre ambre, seulement quand le panier vient d'un devis payé : articles + frais d'installation + transport = « MONTANT TOTAL À DEMANDER AU CLIENT ». Les frais ne sont pas du chiffre d'affaires, mais ils sont bien encaissés."],
        ["💳 Encaisser la vente", "Le geste. Confirmation, puis reçu automatique : imprimé, et envoyé au client du numéro BMI **avec le PDF du reçu** (s'il ne part pas — même refusé par WhatsApp après l'envoi —, le reçu en texte part à sa place, une seule fois)."],
        ["🧾 Proforma WhatsApp / 🖨️", "L'offre de prix, envoyée ou imprimée. Non comptabilisée."],
        ["Total : X F (remise −Y)", "Le total des articles, remise déduite. « Total articles » quand des frais de devis s'ajoutent."],
      ]}],
      ["h3", "Le cadre du bas"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["💰 Ventes (N) / 🧾 Proformas (N)", "Les deux vues. Les proformas sont réservées à vendeur, gérant, responsable commercial, administrateur."],
        ["🔍 Rechercher…", "Numéro de reçu (même l'ancien, « ex … », après une renumérotation), client, téléphone ; numéro de proforma."],
        ["Période / ✏️ Personnaliser…", "Vaut pour les DEUX vues. Les deux cases de date n'apparaissent que si on les demande."],
        ["💰 Recette", "La somme des ventes affichées ; deux chiffres s'il y a eu une reprise (brut, net). Un échange n'y compte que le complément payé par le client ; l'avoir est dit à côté, et l'argent rendu aussi (« … rendus au client, sortis du tiroir »)."],
        ["Pastilles de paiement", "Ventes seulement : une proforma n'a pas de moyen de paiement. Les bandes noires des versements restent."],
        ["💸 Bande noire d'un versement", "Le versement GÉNÉRAL du tiroir (🔒 Caisse) et ce qui s'est vendu depuis le précédent, par moyen de paiement (le résumé ne suit pas les filtres). Le versement d'une seule vente ou d'un seul règlement (bouton 💸) n'en pose pas."],
        ["Colonnes", "**Client** en premier (son numéro dessous) — **figé à gauche** quand on fait défiler le tableau, comme dans 📋 Dettes · Date (heure dessous) · N° reçu · Articles (deux au plus, « + N autres », le reste au clic) · Qté · Total (remise dessous) · Paiement en pastille (vert espèces, ambre crédit, bleu mobile, gris virement) · **Reste à payer** : pour une vente à crédit, ce que sa dette doit AUJOURD'HUI, en rouge (il baisse à chaque versement du client), « ✅ Soldée » quand tout est payé ; « — » pour une vente payée comptant · Commercial · Actions."],
        ["Colonne « Suite » (proformas)", "« ✅ Encaissée le … — reçu N° » ou « ⏳ En attente »."],
        ["🖨️ Réimprimer / 🛒 Vendre / ✏️ Modifier (proformas)", "Réimprime l'offre ; remet ses articles au panier ; la corrige (même numéro, modification notée : son auteur et l'administrateur, jamais une fois encaissée, au-delà de 3 % l'administrateur seul)."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**🔄 Un échange** (gérant, administrateur) : l'ancienne vente garde son reçu et son total, l'article rendu y est noté sous le total — « 🔄 article rendu : X », « → nouveau reçu n° … : Y » (ce que le nouvel article a coûté), puis en gras « rendu au client : Z » ou « payé en plus : Z » (X = Y + Z quand BMI rend, Y = X + Z quand le client paie) — la commission du commercial sur cette vente baisse d'autant, et le 📊 tableau de bord ne compte, le jour de l'échange, que ce que le client a ajouté — jamais un moins (chapitre 22) ; une **nouvelle vente** porte le nouvel article au prix du jour, son reçu et son **avoir** (« 🔄 avoir n° … : −X », puis « payé : Y ») ; **sa ligne est grisée** : elle est là pour information, ce n'est pas une vente du jour — « Aujourd'hui » et la **Recette** ne comptent d'elle que ce que le client a payé en plus (rien si BMI a rendu de l'argent), l'avoir est dit à côté. **La caisse ne voit que la différence** : le client paie le complément (il entre dans le tiroir, ou dans le compte mobile choisi), ou BMI le rend par une sortie **« Rendu sur échange »** de la caisse de la vente — ce n'est pas une charge ; elle se lit dans 📤 Dépenses, sa description nomme la vente d'origine et le nouveau reçu (chapitre 17). L'article rendu revient au stock (mouvement « échange ») ou entre au SAV. La commission du commercial suit le nouvel article. Aucun bon de reprise : le document de l'échange, c'est le nouveau reçu.",
        "**Le numéro de reçu** : trois lettres de la boutique (ou son préfixe réglé) + l'année + un compteur sur quatre chiffres, par exemple **APE-2026-0012**. Une boutique de formation écrit **FOR-** devant. Le numéro = le plus grand déjà pris + 1 : une vente supprimée ne libère jamais son numéro. Deux appareils hors ligne qui prennent le même numéro sont renumérotés au retour du réseau, et la ligne garde « ex … » (le papier du client porte l'ancien).",
        "**Le stock sort à l'encaissement**, jamais avant : ni au panier, ni à la proforma. Une réservation prépayée sort le stock à la livraison. **Un devis « 🔧 Avec installation »** ne le sort pas au paiement : il sortira par la case « 🏗 Chantier » (E bis) ; un devis de matériel seul le sort au paiement, comme avant.",
        "**La vente se rattache au compte du client** par son numéro (8 derniers chiffres), sinon par le nom écrit exactement pareil. C'est ce qui la fait apparaître dans 👤 Clients et dans les données du client.",
        "**À crédit, une dette naît** dans 🧾 Dettes, du montant total dû (frais du devis compris), avec l'avance et son moyen de paiement. La commission du commercial **attend que la dette soit soldée**.",
        "**Le chiffre d'affaires** = articles − remise − rabais. **Pas** les frais d'installation ni de transport d'un devis (ils paient l'équipe). Une reprise diminue le chiffre d'affaires **net**, jamais le reçu.",
        "**La caisse du jour** reçoit les espèces ; Flooz et Mixx vont sur le solde du compte mobile de la boutique ; le virement sur BANQUE. C'est le moyen choisi qui décide, d'où l'importance de « Avance payée comment ? ».",
        "**Le reçu s'imprime tout seul** après l'encaissement : reçu de vente au comptant ; à crédit, le reçu de la dette (« REÇU DE DETTE » ou « REÇU DE VERSEMENT »).",
        "**Le journal** (🕘 Historique) écrit « Vente APE-2026-0012 (X F) — BOUTIQUE », avec les remises de ligne s'il y en a.",
        "**🏗 L'argent d'un devis entre dans la caisse 🏗 DÉPÔT CHANTIER**, jamais dans le tiroir de la boutique : la ligne reste dans la liste de la boutique, et sous sa pastille de paiement elle dit « caisse 🏗 DÉPÔT CHANTIER ». À crédit, la dette est dans cette caisse et se lit quand même dans 🧾 Dettes de la boutique. La bande noire d'un versement dit à part « 🏗 Devis encaissés dans la caisse 🏗 DÉPÔT CHANTIER : … — pas dans ce tiroir ».",
        "**🏗 Un devis « Avec installation » encaissé est un DÉPÔT CHANTIER, pas une vente** (Timo, 12/10/2026) : le client reçoit un **« REÇU DE DÉPÔT CHANTIER »** — imprimé, et sur WhatsApp du numéro BMI son propre message (« BMI TOGO a bien reçu votre dépôt pour votre chantier… », jamais « merci pour votre achat » ; tant que Meta n'a pas approuvé ce message, rien ne part et l'écran le dit), la ligne porte « 🏗 dépôt — pas une vente », et la **Recette** en haut de la liste le met à part (« 🏗 Dépôts chantier : … — pas des ventes »). Les ventes viendront quand le matériel sortira pour le chantier (case « 🏗 Chantier »), puis à la réception.",
        "**Un devis payé crée son chantier** : « ✅ Devis encaissé. Une fiche d'installation a été créée automatiquement… ». Le devis passe « 💰 Payé », le prospect sort de la file, le parrain du client est noté comme apporteur (bloqué jusqu'à la réception et au solde de la dette).",
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
        "Le reçu est sorti : imprimé, ou partagé sur WhatsApp — et c'est le **bon** reçu (dette à crédit). Le client avec un numéro l'a aussi reçu en PDF du numéro BMI (la note sous le titre le dit).",
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
        ["Supprimer une vente qui a créé un chantier, une commission payée, ou une dette avec versements", "« 🔒 Cette vente a créé le chantier de … » / « 🔒 La commission de cette vente a déjà été PAYÉE » / « 🔒 Le client a déjà versé … »", "Traiter d'abord le chantier ou la commission, là où l'écran l'indique. **Une vente dont la dette a reçu de l'argent ne se supprime pas** (ses versements sont dans la caisse) : pour un article rendu, ↩ Reprise. Une dette **sans aucun versement** part avec la vente."],
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
        { situation: "Un vendeur veut faire 6 % de remise à un bon client.", reponse: "Refusé au-delà de 3 % : « réservée à l'administrateur ». Soit il ramène à 3 %, soit l'administrateur encaisse lui-même. Et s'il a déjà mis une remise sur un article, la case Remise est grisée : l'une ou l'autre. Une remise libre de 14 400 F sur 240 000 F vaut 6 % : même refus." },
        { situation: "Un client demande « le prix pour 10 panneaux », sans acheter.", reponse: "Panier de 10 panneaux, son nom et son numéro, « 🧾 Proforma WhatsApp » : il reçoit la proforma du numéro BMI (le PDF reste sur l'appareil s'il le demande). Rien n'est vendu. S'il revient dans 10 jours : 🧾 Proformas → 🛒 Vendre → on vérifie le prix (l'écran signale s'il a changé) → on encaisse." },
        { situation: "Un commercial en tournée a convaincu un client d'acheter 4 panneaux ; le client passera payer à APESSITO demain.", reponse: "🛒 Nouvelle commande : boutique APESSITO, 4 panneaux, le client et son numéro, « 📤 Envoyer la commande à la boutique ». Demain, le vendeur d'APESSITO clique « ✅ Valider et encaisser » : le panier arrive dans 💰 Ventes avec le commercial déjà noté, il encaisse. La commission du commercial est rattachée à cette vente." },
        { situation: "AMA a acheté hier une batterie 100 Ah à 120 000 F en espèces. Elle revient : elle préfère la 200 Ah, à 180 000 F.", reponse: "Ce n'est ni une reprise ni un retour sous garantie : c'est un **🔄 Échanger**, par le gérant ou l'administrateur. Quantité rendue 1 devant la 100 Ah, « Au stock » (elle est neuve), on tape « 200 » et on clique la batterie 200 Ah, motif « préfère la 200 Ah ». L'aperçu dit **« Le client paie : 60 000 F »** ; moyen Espèces ; Enregistrer. Un nouveau reçu sort (avoir de 120 000, payé 60 000) ; seuls 60 000 F entrent dans le tiroir. Si la 200 Ah avait été défectueuse… c'est l'inverse : la 100 Ah rendue part « Au SAV ». Et si le nouvel article coûte moins, « BMI rend au client » la différence, de la caisse." },
        { situation: "Sur place, le client renonce à un des deux articles qu'il vient de payer en espèces.", reponse: "Ce n'est ni un retour ni une suppression : c'est une **↩ Reprise**, par l'administrateur principal seul : il met la quantité devant l'article rendu (s'il en rend plusieurs, il les met tous dans la même reprise). Motif obligatoire ; l'article revient au stock ; l'argent rendu sort de la caisse du jour (« Remboursement client ») ; le reçu ne change pas ; un **bon de reprise** est proposé pour le client." },
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
      "Sait qui fait 📋 Devis, 🔁 Retour, 🔄 Échanger, ↩ Reprise, 🗑 Supprimer",
      "Valide et encaisse une commande reçue d'un commercial",
      "Répond juste aux six questions de la rubrique 12",
    ],
  },
};
