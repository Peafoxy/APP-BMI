// ============================================================
// MANUEL DE FORMATION — CHAPITRE 13 : Devis et proformas
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// screens/TousLesDevis.jsx, components/FiltrePeriode.jsx (le titre « 📋 Tous les devis » / « — les vôtres » ;
// les filtres 📋 Tous · ⏳ Proposé · ✅ Validé · 💰 Payé · ✏️ Modification ·
// ❌ Rejeté · 📁 Sans suite, avec leurs compteurs ; la bande « ⚠️ N devis sans
// réponse depuis plus de 15 jours » ; « Rechercher un client ou un vendeur… » ;
// « Tous les types » ; les pastilles de la ligne — point rouge, Sans réponse
// depuis N j, 📲 Relancé le…, ⌛ Offre expirée — prix à confirmer, ⌛ Validé
// après expiration, 🤖 Relancé automatiquement, ⏳ Modification demandée au
// client, ✅ Le client a accepté — à corriger, 🔁 N/3 aller-retours, ✏️ Modifié
// le… ; les boutons 📲 Relancer sur WhatsApp, ✏️ Modifier et renvoyer, ✏️
// Demander une modification au client, 📄 Devis PDF, 📁 Classer sans suite,
// ↩ Rouvrir le devis, 🗑 Supprimer ; le cadre du plan de règlement ✅ Accepter /
// ❌ Rejeter ; les trois gestes de signature en boutique), lib/comptesClients.js
// (devisRelancable : proposé et validé ; peutModifierDevis : proposé,
// modification, rejeté, et validé après accord du client ; auteur, admin,
// responsable commercial ; marquerModification), lib/modifDevis.js
// (MAX_CYCLES_MODIF = 3, les refus : payé, déjà en attente, chantier
// réceptionné, argent déjà versé), lib/devisCfVisite.js et components/CompleterDevis.jsx
// (✍️ Compléter le devis, cf. visite), lib/devisSansSuite.js, lib/corbeille.js
// (30 jours), lib/rappels.js (SEUIL_RELANCE_JOURS = 15, VALIDITE_OFFRE_JOURS =
// 15), lib/relanceAutoDevis.js (8e au 15e jour, une seule), lib/whatsappModeles.js
// (relance_devis / devis_valide_paiement), lib/validationDevis.js (commande en
// attente dans la boutique choisie ; pose seule → chantier et dette),
// screens/EspaceClient.jsx (✅ JE VALIDE, ✏️ Demander une modification, ❌
// Rejeter ce devis, ✅ J'accepte la modification, ✅ J'accepte et je re-signe),
// screens/Ventes.jsx (🧾 Proforma WhatsApp, 🖨️, la vue 🧾 Proformas — Date, N°,
// Client, Articles, Total, Émis par, Suite —, 🖨️ Réimprimer, 🛒 Vendre ;
// numéro PRF-…, validité 15 jours), lib/calculs.js (reprendreProforma,
// ventesDeProforma), lib/clientEntreprise.js et components/ChampsEntreprise.jsx
// (le prénom, 🏢 Entreprise cliente, le répondant).
// L'établissement d'un devis (les volets, la fin du devis, l'envoi, les
// brouillons) est aux chapitres 11 et 12 ; la signature et le contrat au 14.
// ============================================================
export const CHAPITRE = {
  numero: 13,
  titre: "Devis et proformas",
  sousTitre: "Suivre un devis après son envoi — relancer, corriger, classer, faire valider — et émettre une proforma, l'offre de prix du comptoir",
  public: "Administrateur, responsable commercial, commercial, technicien, technicien BMI, gérant, vendeur",
  duree: "1 h 30, puis l'exercice en espace formation",
  prerequis: "Les chapitres 11 et 12 : c'est là qu'un devis s'établit et part au client (volets, fin du devis, envoi, brouillons). Le chapitre 5 (Ventes) : le panier, la remise, l'encaissement. Le chapitre 3 (Clients) : le compte du client et ses accès.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "**distinguer un devis d'une proforma** : le devis engage BMI et se signe ; la proforma n'est qu'une offre de prix ;",
        "**lire 📋 Tous les devis** : les statuts, les filtres, les pastilles de chaque ligne ;",
        "**relancer** un devis sans réponse, du numéro WhatsApp BMI ;",
        "**corriger** un devis — directement s'il n'est pas signé, par une **demande au client** s'il l'est ;",
        "**classer sans suite**, rouvrir, et savoir **qui peut supprimer** ;",
        "comprendre ce que fait **la validation par le client** et **l'offre expirée** ;",
        "**nommer une entreprise cliente et son répondant** sur un devis ;",
        "**émettre une proforma** (WhatsApp ou impression), la retrouver, et la **transformer en vente**.",
      ]],
      ["regle", "**Un devis engage BMI, une proforma non.** Le devis porte le cachet, la signature de celui qui l'a établi, et se valide par la signature du client : il devient un contrat. La proforma est une offre de prix donnée au comptoir : **elle ne touche ni le stock, ni la caisse, ni le chiffre d'affaires.**"],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4300, 5000], lignes: [
        ["Voir 📋 Tous les devis", "**Administrateur et responsable commercial** : tous les devis. **Commercial, technicien, technicien BMI, gérant, vendeur** : les leurs, plus ceux que le client viendra **payer dans leur boutique**. Le magasinier, le comptable et le client ne l'ont pas."],
        ["📲 Relancer sur WhatsApp", "Tout compte qui voit le devis — sur un devis **Proposé** ou **Validé** (pas encore payé)."],
        ["✏️ Modifier et renvoyer", "**Celui qui a établi le devis, l'administrateur, le responsable commercial.** Pas le vendeur de la boutique de paiement, même s'il voit le devis."],
        ["✍️ Compléter le devis (éléments cf. visite)", "**Les mêmes : l'auteur, l'administrateur, le responsable commercial**, et seulement tant que le devis est **⏳ Proposé**."],
        ["✏️ Demander une modification au client (devis signé)", "Les mêmes : l'auteur, l'administrateur, le responsable commercial."],
        ["📁 Classer sans suite / ↩ Rouvrir le devis", "Les mêmes : l'auteur, l'administrateur, le responsable commercial."],
        ["🗑 Supprimer un devis", "**L'administrateur principal seul**, et seulement un devis **Proposé**."],
        ["Accepter ou rejeter un plan de règlement", "**L'administrateur principal seul.**"],
        ["Faire signer en boutique (✍️, 🖨, 📝)", "**L'administrateur principal seul** pour l'instant — voir chapitre 14."],
        ["Émettre une proforma", "Ceux qui ont **💰 Ventes** : vendeur, gérant, responsable commercial, administrateur."],
        ["Voir la liste 🧾 Proformas, 🛒 Vendre", "**Vendeur, gérant, responsable commercial, administrateur.**"],
      ]}],
      ["note", "**Le mur formation / réel s'applique ici aussi** : chacun ne voit que les devis et les proformas de l'espace regardé. Un devis de formation ne part jamais du numéro WhatsApp BMI."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3100, 6200], lignes: [
        ["**📋 Tous les devis** (onglet)", "Le titre dit « — les vôtres » à qui ne voit que les siens. **Un point rouge sur l'onglet** compte les devis **pas encore ouverts** par vous."],
        ["Les filtres de statut", "**📋 Tous · ⏳ Proposé · 📋 À compléter · ✅ Validé · 💰 Payé · ✏️ Modification · ❌ Rejeté · 📁 Sans suite**, chacun avec son compteur. « Tous » est la liste ACTIVE : un devis classé sans suite n'y est pas. **« 📋 À compléter »** est un raccourci : les devis Proposé qui attendent la visite (section I) — ils restent aussi dans « ⏳ Proposé »."],
        ["La bande jaune", "« ⚠️ N devis sans réponse depuis plus de 15 jours » — un clic ne montre que ceux-là, un second rend la liste entière."],
        ["La recherche et le type", "**« Rechercher un client ou un vendeur… »** et **« Tous les types »** (☀️ Solaire, 🚪 Garage, 📦 Autre)."],
        ["Le filtre de période", "Liste **« Toute période »** (d'office, à chaque ouverture), Aujourd'hui, Cette semaine, Ce mois, Cette année, ou **« ✏️ Personnaliser… »** avec deux dates, sur la DATE du devis. La liste et les compteurs des pastilles la suivent ; la bande jaune des devis sans réponse, non (c'est une alerte)."],
        ["Une ligne de devis", "Le client, le type, la date, l'auteur et la boutique ; le montant ; les pastilles ; le statut. **Un clic l'ouvre** : le plan de règlement s'il y en a un, les articles, les boutons."],
        ["**☀️ Dimensionnement**", "Où le devis s'établit et part (chapitres 11 et 12). **« ✏️ Modifier et renvoyer »** y ramène, le devis rempli."],
        ["**💰 Ventes**", "Sous le panier : **🧾 Proforma WhatsApp** et **🖨️** (imprimer). Au-dessus de la liste : la vue **🧾 Proformas (N)**."],
        ["**L'espace client**", "Le client y lit ses devis et répond : **✅ JE VALIDE**, **✏️ Demander une modification**, **❌ Rejeter ce devis**."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Suivre ses devis"],
      ["etapes", [
        { titre: "Ouvrir 📋 Tous les devis", texte: "La liste est rangée **par statut** — Proposé, Validé, Payé, Corrigé, Modification, Rejeté, Sans suite — puis du plus récent au plus ancien. 50 devis par page." },
        { titre: "Lire le statut", texte: "**⏳ Proposé** : envoyé, le client n'a pas répondu. **✅ Validé** : le client a signé, il n'a pas encore payé. **💰 Payé** : encaissé. **✏️ Modification demandée** : le client veut un changement. **🔄 Corrigé** : BMI a corrigé un devis signé, le client doit re-signer. **❌ Rejeté** : le client a dit non. **📁 Classé sans suite** : rangé par BMI." },
        { titre: "Lire les pastilles", texte: "**Point rouge** : pas encore ouvert. **⚠️ Sans réponse depuis N j** : à relancer. **📲 Relancé le …** (vert « du n° BMI » quand le message est parti du numéro BMI). **⌛ Offre expirée — prix à confirmer**. **🤖 Relancé automatiquement le …**. **✏️ Modifié le … par …** : le devis a été corrigé. **📋 À compléter après la visite** : des éléments restent à chiffrer (section I). **✍️ Complété le … par …** : ils l'ont été. Les coches ✓ / ✓✓ disent si le dernier message est arrivé ou a été lu." },
        { titre: "Ouvrir la ligne", texte: "Un clic : les articles avec quantité, prix et total, et les boutons permis. **Ouvrir un devis le marque vu** : il ne compte plus dans le point rouge de l'onglet." },
      ]],
      ["h3", "B. Relancer un devis"],
      ["etapes", [
        { titre: "Repérer les devis à relancer", texte: "La bande jaune « ⚠️ … sans réponse depuis plus de 15 jours ». Les 15 jours se comptent **depuis la dernière relance**, sinon depuis la date du devis." },
        { titre: "📲 Relancer sur WhatsApp", texte: "La question dit à qui, à quel numéro, pour quel montant : **« Relancer X (numéro) pour son devis de … ? »**. Rien ne part avant « OK »." },
        { titre: "Ce qui part", texte: "Un devis **Proposé** : un rappel du devis. Un devis **Validé** : un rappel qu'il reste à régler. Le message part **du numéro WhatsApp BMI**. S'il ne peut pas partir (modèle pas encore approuvé, réseau…), l'écran le dit en français **puis** ouvre WhatsApp sur l'appareil avec le même texte." },
        { titre: "La trace", texte: "La date, l'auteur et le nombre de relances restent sur le devis (« déjà le … , N fois » sur le bouton). La relance s'écrit aussi dans 📲 WhatsApp, dans la conversation du client." },
      ]],
      ["h3", "C. Corriger un devis qui n'est pas signé"],
      ["etapes", [
        { titre: "Quand", texte: "Le devis est **Proposé** (une faute vue après l'envoi), **Modification demandée** (le client l'a demandé) ou **Rejeté** (on veut lui faire une nouvelle offre)." },
        { titre: "✏️ Modifier et renvoyer", texte: "Le bon volet de ☀️ Dimensionnement s'ouvre, **rempli** : appareils, articles, client, conditions. On corrige, puis **📲 Envoyer ce devis au client**." },
        { titre: "Ce qui se passe", texte: "Le devis corrigé **remplace** l'ancien dans l'espace du client (même devis, jamais un doublon). Il porte la **trace** de la correction : « ✏️ Modifié le … par … », et le nombre de corrections." },
      ]],
      ["h3", "D. Modifier un devis DÉJÀ SIGNÉ : le client ouvre la porte"],
      ["etapes", [
        { titre: "✏️ Demander une modification au client", texte: "Sur un devis **✅ Validé** seulement. Le **motif** est obligatoire : le client le lira. Le devis reste signé tel quel ; la ligne porte « ⏳ Modification demandée au client »." },
        { titre: "Le client répond", texte: "Dans son espace : **✅ J'accepte la modification** ou **❌ Je refuse**. S'il refuse, rien ne bouge : le devis reste signé. S'il accepte, la ligne porte « ✅ Le client a accepté — à corriger » et **✏️ Modifier et renvoyer** apparaît." },
        { titre: "Corriger et renvoyer", texte: "Comme en C. Le devis passe **🔄 Corrigé — en attente de l'accord du client** (jamais « Proposé »)." },
        { titre: "Le client re-signe ou refuse", texte: "**✅ J'accepte et je re-signe** : même numéro de contrat, l'ancienne signature est gardée dans l'historique, et le plan de règlement est remis à valider. **❌ Je refuse** : le devis est **rejeté**, l'affaire s'arrête." },
      ]],
      ["attention", "**Trois aller-retours au plus** (pastille 🔁 N/3). Au-delà, le devis n'est plus modifiable : on en établit un nouveau. Et **deux portes sont fermées d'office** : un chantier **déjà réceptionné** (les travaux sont livrés) et un devis sur lequel le client a **déjà versé de l'argent**. Un devis **payé** ne se corrige jamais ici : c'est la vente qui se corrige, par une reprise dans 💰 Ventes."],
      ["h3", "E. Classer sans suite, rouvrir, supprimer"],
      ["etapes", [
        { titre: "📁 Classer sans suite", texte: "Sur un devis **Proposé** dont le client ne donne plus de nouvelles. **Motif obligatoire.** Le devis reste **entier** (articles, prix, relances) mais sort de la liste active : il se retrouve sous **📁 Sans suite**. Le client ne peut plus le valider (son espace lui dit que ce devis n'est plus d'actualité, **jamais le motif interne**) ; il n'est plus relancé, ni à la main, ni automatiquement." },
        { titre: "↩ Rouvrir le devis", texte: "Sous 📁 Sans suite : le devis redevient **⏳ Proposé**, tel qu'il était. Son offre date toujours du jour du devis ; pour de nouveaux prix, **✏️ Modifier et renvoyer** ensuite." },
        { titre: "🗑 Supprimer (administrateur principal)", texte: "Pour une **vraie erreur** (devis établi au mauvais client, en double). **Proposé seul**, motif obligatoire. Le devis part à la **corbeille 30 jours** (⚙ Paramètres → 🗑 Corbeille), restaurable, puis effacé. Les messages WhatsApp déjà partis au client restent." },
      ]],
      ["h3", "F. La validation par le client"],
      ["etapes", [
        { titre: "Dans son espace", texte: "Le client lit son devis. S'il lui convient, il choisit **la boutique où il viendra payer**, puis **✅ JE VALIDE** : le contrat s'affiche, il le **signe du doigt**, et choisit comment il réglera le solde s'il en reste un (plan de règlement)." },
        { titre: "Ce qui naît", texte: "Le devis passe **✅ Validé**, et une **commande en attente** apparaît dans 🧾 Commandes de la boutique choisie : le vendeur l'encaisse dans 💰 Ventes (chapitre 5). Le chantier se crée **à l'encaissement**." },
        { titre: "Pose seule", texte: "Pas de boutique à choisir : le chantier et la dette naissent **à la signature**. **70 % sont à régler avant que l'intervention soit programmée**, le solde à la réception des travaux." },
        { titre: "Le plan de règlement", texte: "S'il en propose un, il apparaît en tête du devis ouvert (« 💰 Plan de règlement proposé par le client — en attente ») avec l'engagement du contrat. **L'administrateur principal** l'accepte ou le rejette (motif demandé ; le client le lit et peut en proposer un autre)." },
        { titre: "Il peut aussi…", texte: "**✏️ Demander une modification** (son texte s'affiche sur le devis, statut « Modification demandée ») ou **❌ Rejeter ce devis** (il dit pourquoi)." },
      ]],
      ["h3", "G. Une entreprise cliente et son répondant"],
      ["etapes", [
        { titre: "Nouveau client", texte: "Dans le cadre « 📲 Envoyer ce devis au client » : **➕ Nouveau client (nom, prénom, numéro)** — le **prénom est obligatoire** pour créer son compte (s'il manque, l'application le demande)." },
        { titre: "La case 🏢 Entreprise cliente", texte: "Sous « Client destinataire », pour un nouveau client **comme pour un compte existant**. Cochée : **nom de l'entreprise** (obligatoire), téléphone, NIF et RCCM (facultatifs). Pour un client qui a déjà une entreprise sur sa fiche, **elle revient cochée d'office**." },
        { titre: "Qui reçoit quoi", texte: "La personne choisie est **le répondant** : c'est son compte, **son numéro** qui reçoit le devis et les accès à l'espace client. L'entreprise n'est jamais un compte de plus. Le devis PDF est au nom de l'entreprise (« représentée par NOM Prénom »), et le contrat nomme l'entreprise et son répondant." },
      ]],
      ["h3", "H. La proforma"],
      ["etapes", [
        { titre: "Préparer le panier", texte: "Dans **💰 Ventes**, comme pour une vente : les articles, les quantités, la remise (les mêmes limites qu'une vente : plus de 3 % = administrateur ; une remise sur un article OU une remise générale, jamais les deux), le client et son numéro. Si le client paie au nom d'une entreprise, cocher **🏢 Le client paie au nom d'une entreprise**." },
        { titre: "🧾 Proforma WhatsApp", texte: "Le **PDF est téléchargé d'abord** sur l'appareil. Avec un numéro, une question : « Envoyer la proforma … du numéro WhatsApp BMI ? » — **OK** et la proforma **part du numéro BMI** (articles, total, date de fin de l'offre, téléphone de la boutique), sans ouvrir WhatsApp ; la ligne entre dans 📲 WhatsApp. Si le numéro BMI ne peut pas envoyer (formation, modèle pas encore approuvé, réseau), une fenêtre dit pourquoi, puis **OK** ouvre WhatsApp sur le numéro du client avec le détail : **joindre le PDF**. Sans numéro, WhatsApp s'ouvre sans destinataire." },
        { titre: "🖨️ (imprimer)", texte: "L'aperçu de la proforma à imprimer ou à partager." },
        { titre: "Le numéro et la validité", texte: "Chaque proforma reçoit un numéro **PRF-…** et porte « **Valable 15 jours** ». Elle est rangée dans la liste **🧾 Proformas** — **rien n'est comptabilisé**." },
        { titre: "Retrouver une proforma", texte: "**🧾 Proformas (N)** au-dessus de la liste des ventes : Date, N°, Client, Articles, Total, Émis par, et **Suite** — « ✅ Encaissée le … — reçu N° … » ou « ⏳ En attente ». La période, la recherche et le **Total des proformas** marchent comme pour les ventes (jamais le mot « recette » : une offre n'est pas encaissée)." },
        { titre: "🛒 Vendre", texte: "Le client revient avec sa proforma : **🛒 Vendre** remplit le panier (même prix que la proforma, même client, même remise). **Une remise de plus de 3 % accordée par l'administrateur sur la proforma passe pour tout vendeur, tant que le panier reste le même.** **Rien n'est encore enregistré** : le vendeur vérifie, puis encaisse normalement." },
      ]],
      ["h3", "I. Un devis à compléter après la visite (cf. visite)"],
      ["etapes", [
        { titre: "Pourquoi", texte: "Le client veut un devis tout de suite, mais certains éléments ne se chiffrent qu'après la visite technique (câblage, supports de toiture…). On met **tout ce qu'on connaît**, et le reste **« cf. visite »**. **Le devis se COMPLÈTE ensuite, il ne se modifie pas.**" },
        { titre: "Dans le volet du devis", texte: "Sous **Autres équipements**, le bouton **« ➕ Élément à compléter (cf. visite) »** ajoute une ligne ambre : **le nom de l'élément** — un article **choisi dans la liste du stock**, ou un nom **tapé librement** —, une quantité si on la connaît, et **« Prix : cf. visite »** — aucun prix. Ces lignes ne comptent dans aucun total et ne vont jamais au panier." },
        { titre: "Ce que reçoit le client", texte: "Le PDF écrit **« Cf. visite »** sur ces lignes, un **TOTAL PROVISOIRE**, et la phrase « Éléments à compléter après la visite technique (cf. visite) : total, acompte et solde arrêtés au devis complété. » **Aucun acompte n'est demandé.** Le message du numéro BMI dit que le montant est hors éléments à chiffrer après la visite." },
        { titre: "Le client ne peut pas encore valider", texte: "Dans son espace, **✅ JE VALIDE n'apparaît pas** tant qu'il reste un élément cf. visite : il valide le devis **complet**, jamais un total partiel. Il peut toujours demander une modification ou rejeter. « Convertir en vente » est refusé aussi." },
        { titre: "✍️ Compléter le devis", texte: "Après la visite, dans 📋 Tous les devis (la pastille **« 📋 À compléter »** les rassemble), ouvrir la ligne → **✍️ Compléter le devis**. Pour chaque élément : l'**article** (un élément choisi dans le stock arrive déjà lié, son prix rempli ; sinon on le choisit dans le stock ou on le tape librement — il devient alors HB), la **quantité**, le **prix** — ou cocher **« Sans objet »** s'il n'est finalement pas nécessaire. **« ➕ Ajouter une ligne découverte à la visite »** pour ce qui manquait. Le nouveau total se lit avant d'enregistrer." },
        { titre: "✍️ Enregistrer et envoyer au client", texte: "**Les lignes déjà chiffrées ne bougent pas.** Les frais (installation, transport, remise) se recalculent au **pourcentage déjà négocié**, l'acompte aussi. Le devis garde son numéro, sa date et reste ⏳ Proposé ; il porte « ✍️ Complété le … par … » (jamais « Modifié »). Une question propose ensuite de l'envoyer au client **du numéro BMI** ; le client peut alors le valider." },
      ]],
      ["note", "**La date de l'offre ne change pas** en complétant : les 15 jours se comptent toujours depuis la date du devis. Pour de nouveaux prix sur les lignes déjà chiffrées, c'est **✏️ Modifier et renvoyer** (section C)."],
      ["regle", "**Une proforma se corrige, elle ne se refait pas** (✏️ Modifier) : elle garde son numéro, et chaque correction est notée (date, auteur, l'ancienne version gardée). **Qui** : celui qui l'a établie et l'administrateur. **Jamais une proforma déjà encaissée** : elle est devenue une vente — pour une nouvelle offre, une nouvelle proforma. **Au-delà de 3 % de remise**, l'administrateur seul (la base le refuse aussi). Un article devenu introuvable dans le stock empêche la modification : il disparaîtrait de l'offre."],
      ["attention", "**🛒 Vendre ne change jamais de boutique tout seul.** Une proforma d'une autre boutique est refusée en nommant la bonne : il faut se placer sur cette boutique. Un article introuvable dans le stock est **listé**, jamais mis au panier sans sa fiche ; un prix qui a changé depuis est **signalé** (le prix de la proforma est gardé). Une proforma **déjà encaissée** se revend quand même, mais l'écran **prévient** en nommant la date et le reçu : ce sera une nouvelle vente, avec un nouveau numéro."],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3300, 6000], lignes: [
        ["Filtres de statut (📋 Tous … 📁 Sans suite)", "Ne montrer qu'un statut ; le compteur tient compte de la recherche et du type. **📋 À compléter** : les Proposé qui attendent la visite ; complétés, ils en sortent tout seuls."],
        ["Bande « ⚠️ … sans réponse depuis plus de 15 jours »", "Ne montrer que les devis à relancer (un second clic rend tout)."],
        ["📲 Relancer sur WhatsApp", "Rappel du devis (Proposé) ou du règlement (Validé), du numéro BMI, après une question."],
        ["✏️ Modifier et renvoyer", "Rouvre le devis rempli dans son volet ; le devis corrigé remplace l'ancien."],
        ["✍️ Compléter le devis", "Chiffrer les éléments « cf. visite » d'un devis Proposé (ou les dire sans objet) ; les lignes déjà chiffrées ne bougent pas ; le devis repart au client."],
        ["✏️ Demander une modification au client", "Devis signé : motif au client, qui accepte ou refuse avant toute correction."],
        ["📄 Devis PDF", "Le devis commercial : besoin, équipement, total, acompte, mentions, deux cadres de signature, cachet de BMI."],
        ["📁 Classer sans suite", "Range un devis Proposé (motif obligatoire) ; il reste entier."],
        ["↩ Rouvrir le devis", "Remet un devis classé en Proposé."],
        ["🗑 Supprimer", "Administrateur principal ; devis Proposé ; corbeille 30 jours."],
        ["✅ Accepter / ❌ Rejeter (plan de règlement)", "Administrateur principal ; engage BMI sur l'échéancier proposé par le client."],
        ["✍️ Faire signer ici · 🖨 Imprimer pour signature papier · 📝 Signé sur papier", "Signature en boutique d'un devis Proposé — chapitre 14."],
        ["🏢 Entreprise cliente (devis) / 🏢 Le client paie au nom d'une entreprise (Ventes)", "Nom, téléphone, NIF, RCCM de l'entreprise ; la personne reste le répondant."],
        ["🧾 Proforma WhatsApp", "PDF téléchargé, puis la proforma part du numéro BMI (après une question) ; sinon WhatsApp s'ouvre sur le numéro du client avec le détail, PDF à joindre."],
        ["🖨️ (à côté)", "Imprimer la proforma."],
        ["🧾 Proformas (N)", "La liste des proformas émises, avec leur suite."],
        ["🖨️ Réimprimer", "Réimprimer une proforma de la liste."],
        ["🛒 Vendre", "Remplir le panier depuis une proforma ; l'encaissement reste à faire."],
        ["✏️ Modifier", "Corriger une proforma : le panier se remplit, « 💾 Enregistrer la proforma modifiée » la remplace (même numéro, « ✏️ Modifiée le … par … » sur sa ligne). 🧾 et 🖨️ pendant la modification enregistrent aussi avant d'envoyer ou d'imprimer."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**L'offre vaut 15 jours.** Le 15e jour elle est encore valable, elle expire le lendemain. Un devis **Proposé** expiré n'est **ni bloqué ni supprimé** : il porte « ⌛ Offre expirée — prix à confirmer », le client est prévenu avant de valider, et s'il valide quand même, le devis garde « ⌛ Validé après expiration — prix à confirmer » : **le vendeur confirme le prix à l'encaissement**.",
        "**La relance automatique du 8e jour** : entre le 8e et le 15e jour, la tournée de 7 h envoie **une seule fois** au client, du numéro BMI, un rappel qui annonce la date de fin de l'offre. Jamais si le devis a déjà été relancé à la main, jamais en formation, jamais sans numéro. Pastille « 🤖 Relancé automatiquement le … ».",
        "**Le rappel des 15 jours** : chaque matin, une notification « pour information » part vers **l'auteur du devis, les responsables commerciaux et les administrateurs** le jour où un devis atteint 15 jours sans réponse.",
        "**Un devis qui porte un élément « cf. visite » ne se valide pas** : ni par le client, ni en boutique, ni par « Convertir en vente ». Il n'a qu'un total provisoire et **aucun acompte** tant qu'il n'est pas complété.",
        "**Payé, rejeté, modification demandée, classé sans suite : aucune relance**, ni à la main ni automatique.",
        "**La trace d'une correction ne s'efface jamais** : date, auteur, nombre de corrections. Personne ne baisse un prix en silence.",
        "**Un devis ne touche pas le stock.** C'est l'encaissement dans 💰 Ventes qui fait sortir les articles. Une proforma non plus, jamais.",
        "**Le devis validé devient une commande** dans la boutique choisie par le client ; **payé**, il crée le chantier (🏠 Clients installés). Une pose seule crée chantier et dette dès la signature.",
        "**Le premier devis d'un client** part en deux messages du numéro BMI : ses accès d'abord, puis le devis. S'il a déjà ses accès, le devis part seul (chapitre 11).",
        "**Une proforma garde la fiche de chaque article** : c'est ce qui permet à 🛒 Vendre de retrouver le bon article et de le faire sortir du stock à l'encaissement. Les proformas plus anciennes sont retrouvées par le nom.",
        "**La proforma porte l'adresse, le téléphone et l'e-mail de la boutique**, et, si le client paie pour une entreprise, le nom de l'entreprise, ses coordonnées et « Représentée par ».",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**☀️ Dimensionnement** (chapitres 11 et 12) : le devis s'y établit et y revient pour être corrigé.",
        "**📄 Contrats** (chapitre 14) : un devis validé devient un contrat ; la signature en boutique et le plan de règlement s'y détaillent.",
        "**🧾 Commandes et 💰 Ventes** (chapitre 5) : la commande née de la validation s'y encaisse ; la proforma s'y émet et s'y vend.",
        "**🏠 Clients installés / chantiers** (chapitre 15) : le chantier naît de l'encaissement (ou de la signature pour une pose seule) ; un chantier réceptionné ferme la modification du devis.",
        "**📲 WhatsApp** (chapitre 20) : relances, devis et accès partent du numéro BMI et s'écrivent dans la conversation du client.",
        "**L'espace client** (chapitre 21) : le client y valide, demande une modification, rejette, re-signe.",
        "**⚙ Paramètres → 🗑 Corbeille** (chapitre 23) : un devis supprimé s'y restaure pendant 30 jours.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Chaque matin, la bande « ⚠️ … sans réponse » est regardée et les devis sont **relancés ou classés sans suite**.",
        "Avant de relancer : le **numéro** et le **montant** de la question sont les bons.",
        "Un devis **signé** n'est jamais corrigé autrement que par **« Demander une modification au client »**.",
        "Un devis **expiré** qui est validé : le prix est **confirmé avec le client** avant l'encaissement.",
        "Classer sans suite ou supprimer : le **motif** dit vraiment pourquoi.",
        "Une entreprise cliente : le **nom de l'entreprise** est saisi, et la personne choisie est bien celle qui **répond** pour elle.",
        "Une proforma : les **prix**, la **remise** et le **client** sont justes avant l'envoi ; partie du numéro BMI, sa ligne se lit dans 📲 WhatsApp ; ouverte sur l'appareil, le PDF est **joint** au message.",
        "🛒 Vendre : on est sur **la boutique de la proforma** ; les articles listés « introuvables » ou « prix changé » sont traités avant d'encaisser.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3300], lignes: [
        ["Refaire un devis entier pour une faute vue après l'envoi", "Le client a deux devis dans son espace.", "**✏️ Modifier et renvoyer** : le devis corrigé remplace l'ancien."],
        ["Chercher « Modifier » sur un devis signé", "Le bouton n'est pas là : un contrat signé ne se corrige pas en silence.", "**✏️ Demander une modification au client** ; corriger après son accord."],
        ["Vouloir corriger un devis payé", "Refusé : la vente est encaissée.", "Passer par une **reprise** dans 💰 Ventes (administrateur principal)."],
        ["Supprimer un devis parce que le client ne répond plus", "Réservé à l'administrateur principal, et on perd la trace commerciale.", "**📁 Classer sans suite** : le devis reste entier et se rouvre."],
        ["Relancer un devis payé ou rejeté", "Le bouton n'apparaît pas.", "C'est voulu : on ne réclame pas un argent déjà reçu, on n'insiste pas après un non."],
        ["Encaisser un devis validé après expiration au prix du devis sans rien dire", "Le prix a peut-être changé depuis.", "Lire la pastille « ⌛ Validé après expiration » et **confirmer le prix** avec le client."],
        ["Prendre une proforma pour une vente", "Rien n'est encaissé, rien ne sort du stock.", "Le jour où il paie : **🛒 Vendre**, puis encaisser."],
        ["🛒 Vendre sur la mauvaise boutique", "Refusé, avec le nom de la bonne boutique.", "Se placer sur la boutique de la proforma."],
        ["Oublier de joindre le PDF quand WhatsApp s'ouvre sur l'appareil", "Le client ne reçoit que le texte.", "Le PDF est déjà téléchargé : le joindre au message avant d'envoyer. (Partie du numéro BMI, la proforma porte ses articles et son total : le PDF s'envoie seulement si le client le demande.)"],
        ["Envoyer le devis d'une entreprise au téléphone de l'entreprise", "Les accès partent au numéro de la PERSONNE choisie.", "Choisir comme client **le répondant** (celui qui signera), et cocher 🏢 Entreprise cliente."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Un devis solaire de 2 400 000 F est parti il y a 16 jours ; le client n'a rien dit, et aucune relance à la main.", reponse: "Il est dans la bande « ⚠️ … sans réponse depuis plus de 15 jours ». Entre le 8e et le 15e jour, la relance automatique est déjà partie (pastille 🤖). Le 16e, l'offre est expirée (« ⌛ Offre expirée — prix à confirmer ») : **📲 Relancer sur WhatsApp** — la question nomme le client et le montant — et prévenir que le prix est à confirmer." },
        { situation: "Juste après l'envoi, le commercial voit qu'il a oublié une batterie.", reponse: "Le devis est **Proposé** : **✏️ Modifier et renvoyer** (lui, l'administrateur ou le responsable commercial), ajouter la batterie, renvoyer. Le client n'a qu'un devis, marqué « ✏️ Modifié le … »." },
        { situation: "Un client a signé un devis de portail ; le chantier montre qu'il faut une crémaillère de plus. Rien n'a été versé.", reponse: "**✏️ Demander une modification au client**, motif « une crémaillère de plus ». Le client accepte → « ✅ Le client a accepté — à corriger » → **✏️ Modifier et renvoyer** → statut **Corrigé** → le client **re-signe** (même numéro de contrat, plan de règlement remis à valider)." },
        { situation: "Même cas, mais le client a déjà versé 500 000 F sur cette pose seule.", reponse: "Refusé : « Le client a déjà versé 500 000 F sur ce devis : son montant ne se modifie plus. » Le supplément se traite à part (autre devis ou vente)." },
        { situation: "Un prospect a reçu un devis il y a deux mois et ne répond plus.", reponse: "**📁 Classer sans suite**, motif « Le client ne donne plus de nouvelles ». S'il revient : **📁 Sans suite → ↩ Rouvrir le devis**, puis **✏️ Modifier et renvoyer** pour mettre les prix à jour." },
        { situation: "Un devis a été envoyé au mauvais client.", reponse: "**🗑 Supprimer** par l'administrateur principal (devis Proposé), motif « envoyé au mauvais client ». Il reste 30 jours dans la corbeille. Refaire le devis au bon client." },
        { situation: "La société SOLAR SARL achète un kit ; c'est M. KOFFI Ama qui s'en occupe.", reponse: "Devis : **➕ Nouveau client** KOFFI / Ama / son numéro, cocher **🏢 Entreprise cliente**, nom SOLAR SARL, NIF si connu. Le devis et ses accès partent au numéro de M. KOFFI ; le PDF et le contrat nomment SOLAR SARL « représentée par KOFFI Ama »." },
        { situation: "Au comptoir, un client veut un prix pour 10 panneaux et 2 batteries, à montrer à son patron.", reponse: "Panier dans 💰 Ventes, client et numéro, puis **🧾 Proforma WhatsApp** : le PDF se télécharge, on confirme, la proforma part du numéro BMI (sinon WhatsApp s'ouvre : joindre le PDF). Rien n'est vendu. La ligne « ⏳ En attente » apparaît dans 🧾 Proformas." },
        { situation: "Le client revient une semaine plus tard avec la proforma ; un des deux prix a augmenté depuis.", reponse: "🧾 Proformas → **🛒 Vendre** : le panier se remplit **au prix de la proforma**, et l'écran signale le prix changé. Décider avec le responsable si on garde le prix promis, puis encaisser." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "**En espace formation**, avec un client de formation et quelques articles en stock :"],
      ["ol", [
        "Établir et envoyer un petit devis (chapitre 11 ou 12) ; le retrouver dans 📋 Tous les devis et lire ses pastilles.",
        "Le corriger par **✏️ Modifier et renvoyer** ; vérifier la pastille « ✏️ Modifié le … ».",
        "Le relancer ; lire la question, puis le bouton « déjà le … ».",
        "Se connecter comme le client de formation : **✅ JE VALIDE**, choisir la boutique, signer. Revenir : le devis est Validé, la commande attend dans 🧾 Commandes.",
        "Sur ce devis validé : **✏️ Demander une modification au client** ; accepter côté client ; corriger ; re-signer côté client.",
        "Établir un deuxième devis, le **classer sans suite** avec un motif, le retrouver sous 📁 Sans suite, le **rouvrir**.",
        "Établir un devis pour une **entreprise cliente** avec un répondant ; ouvrir le 📄 Devis PDF et lire « représentée par ».",
        "Dans 💰 Ventes : émettre une **proforma** (🖨️, puis 🧾 Proforma WhatsApp) ; la retrouver dans 🧾 Proformas ; **🛒 Vendre**, vérifier le panier, **ne pas encaisser** (ou encaisser en formation et lire « ✅ Encaissée le … »).",
      ]],
      ["note", "Le formateur vérifie surtout : l'employé **ne refait jamais un devis entier** pour une correction, **ne corrige jamais un devis signé sans l'accord du client**, sait **classer sans suite** au lieu de supprimer, et **ne confond jamais une proforma avec une vente**."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "explique la différence entre un devis et une proforma ;",
        "lit les statuts et les pastilles de 📋 Tous les devis ;",
        "relance un devis et dit ce qui part selon son statut ;",
        "corrige un devis non signé, et fait modifier un devis signé par le bon chemin ;",
        "classe sans suite, rouvre, et sait qui peut supprimer ;",
        "explique l'offre expirée et la relance automatique ;",
        "établit un devis pour une entreprise cliente avec son répondant ;",
        "émet une proforma, la retrouve et la transforme en vente.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Pourquoi une proforma ne touche-t-elle ni le stock ni la caisse ?",
        "Qui peut corriger un devis Proposé ? Et un devis Validé ?",
        "Que se passe-t-il si le client refuse un devis corrigé ?",
        "Combien d'aller-retours de modification au plus, et que fait-on ensuite ?",
        "Quelle différence entre « Classer sans suite » et « Supprimer » ?",
        "Un devis validé le 17e jour : que doit faire le vendeur à l'encaissement ?",
        "Une entreprise cliente : à quel numéro partent le devis et les accès ?",
        "Que fait 🛒 Vendre, et que ne fait-il pas ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Distingue devis et proforma",
      "Lit statuts et pastilles de Tous les devis",
      "Relance un devis à bon escient",
      "Corrige un devis non signé (Modifier et renvoyer)",
      "Fait modifier un devis signé par la demande au client",
      "Classe sans suite, rouvre ; sait qui supprime",
      "Explique l'offre expirée et la relance du 8e jour",
      "Devis pour une entreprise cliente et son répondant",
      "Émet une proforma et la transforme en vente",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
