// ============================================================
// MANUEL DE FORMATION — CHAPITRE 4 : Prospects
//
// Des MOTS, rien d'autre. Chaque bouton, chaque règle vient du code :
// screens/Prospects.jsx (le tableau de bord commercial, le formulaire
// « Nouveau prospect », la liste et ses boutons, 📞 Contacté, 📦 Archiver,
// ✅ Convertir en client, Réassigner), lib/prospects.js (prospectAcquis,
// « Client acquis »), lib/calculs.js (SEUIL_DORMANT_JOURS = 150,
// estDormant, joursSansActivite, toucher, refuserSaufProprietaire,
// peutReaffecter, ONGLETS_ROLE, ACTIONS_POUVOIR « 🔁 Réaffecter les
// prospects », comptesAvecCeNumero), lib/comptesClients.js
// (identifiantClient, fabriquerCompteClient), lib/whatsappModeles.js
// (accueil_prospect, relance_prospect, projetDansLaPhrase — 01/10/2026),
// lib/validationDevis.js (le
// badge « ⏳ Devis validé — attend le paiement »), screens/Ventes.jsx (le
// prospect devient « Client acquis » quand son devis est encaissé),
// screens/Clients.jsx (🙋 Créer un client avec « Prospect » coché),
// lib/constants.js (les trois catégories de départ).
// ============================================================
export const CHAPITRE = {
  numero: 4,
  titre: "Prospects",
  sousTitre: "Enregistrer un contact intéressé, le relancer au bon moment, et le faire devenir client",
  public: "Commercial, technicien, technicien BMI, responsable commercial ; l'administrateur pour les catégories et la vue d'ensemble",
  duree: "1 heure, puis l'exercice en espace formation",
  prerequis: "Les chapitres 1 (se connecter) et 3 (les clients). Un compte commercial ou technicien pour l'exercice.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, le commercial sait :"],
      ["ul", [
        "**enregistrer un prospect** en une minute — nom, numéro, catégorie, où il habite, ce qu'il veut, quand le relancer ;",
        "lire son **tableau de bord** : combien de prospects actifs, combien à relancer aujourd'hui, combien dorment, quel taux de conversion ;",
        "**relancer** par WhatsApp en un clic, et **noter chaque contact** pour que l'application sache qui est encore suivi ;",
        "**archiver** avec un motif ceux qui n'aboutissent pas, et les réveiller plus tard ;",
        "**convertir** en client celui qui a dit oui — et savoir que ça se fait tout seul quand son devis est encaissé.",
      ]],
      ["regle", "**Un prospect qu'on ne touche pas pendant 150 jours (environ 5 mois) devient « dormant ».** Ce n'est pas une punition : c'est la seule façon pour l'application de distinguer un contact suivi d'un contact oublié. Chaque geste — 📞 Contacté, une relance, une réassignation — remet le compteur à zéro."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [5200, 4100], lignes: [
        ["Ouvrir 🧲 Prospects", "Commercial, technicien, technicien BMI, responsable commercial, administrateur"],
        ["« Nouveau prospect » — enregistrer un contact", "Commercial, technicien, technicien BMI, responsable commercial. **L'administrateur n'a pas ce formulaire** : il lit, il gère les catégories, il réassigne."],
        ["Voir **ses** prospects", "Chaque commercial voit les siens"],
        ["Voir **tous** les prospects de l'espace", "Administrateur, responsable commercial, et tout **chef d'équipe** ⭐"],
        ["📞 Contacté · Relance · 📱 Relancer · 📦 Archiver · ↩ Réactiver · ✅ Convertir en client · Suppr.", "**Le commercial rattaché au prospect**, et l'administrateur. Un chef d'équipe voit le prospect d'un autre, mais ne fait pas ces gestes à sa place."],
        ["Réassigner à un autre commercial", "Administrateur, responsable commercial, chef d'équipe ⭐ — **avec le pouvoir « 🔁 Réaffecter les prospects »** (retirable dans 🔐 Pouvoirs, chapitre 2)"],
        ["Ajouter ou supprimer une **catégorie** de prospects", "**L'administrateur seul**"],
      ]}],
      ["note", "Un prospect **appartient à un commercial** : celui qui l'a enregistré, ou celui à qui on l'a réassigné. C'est ce nom, colonne « Commercial » chez l'administrateur, qui décide qui peut le relancer, l'archiver, le convertir."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3300, 6000], lignes: [
        ["**🧲 Prospects**, en haut", "« 📊 Tableau de bord commercial » : quatre cases — Prospects actifs · 🔔 À relancer aujourd'hui · 💤 Dormants · ✅ Taux de conversion — et le lien « Voir les N prospect(s) à relancer → »."],
        ["**🧲 Prospects**, cadre du milieu", "Pour l'administrateur : « Catégories de prospects (gérées par l'administrateur) », les pastilles avec leur ×, « Nouvelle catégorie… » et « Ajouter ». Pour les autres : le formulaire **« Nouveau prospect »** et son bouton « ➕ Enregistrer le prospect »."],
        ["**🧲 Prospects**, la liste", "« Mes prospects (N) » (ou « Tous les prospects (N) » pour l'administrateur), « Rechercher… », la liste de période (« Toute période » d'office), les boutons « Afficher les clients acquis (N) », « 💤 Dormants (N) », « 📦 Archivés (N) », « 🔔 À relancer (N) », puis le tableau, 50 lignes par page."],
        ["**🙋 Créer un client**", "La case « Prospect » y crée un compte client ET une fiche de prospect en même temps (chapitre 3)."],
        ["**☀️ Dimensionnement / 📋 Tous les devis**", "Un devis validé pose « ⏳ Devis validé — attend le paiement » sur la fiche du prospect ; un devis encaissé le fait passer « Client acquis »."],
      ]}],
      ["note", "Trois catégories existent au départ : **Particulier, Entreprise, Administration**. L'administrateur en ajoute d'autres depuis cet écran. Supprimer une catégorie ne touche pas les prospects déjà classés : ils la gardent en texte."],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Enregistrer un prospect"],
      ["etapes", [
        { titre: "Ouvrir 🧲 Prospects, cadre « Nouveau prospect »", texte: "La « Catégorie » (Particulier d'office), le « Nom du prospect », le « Numéro » — les deux derniers sont **obligatoires** (« Le nom et le numéro du prospect sont obligatoires. »)." },
        { titre: "Choisir le « Projet »", texte: "La liste propose les métiers réglés dans ⚙ Paramètres (Solaire, Forage, Vidéo surveillance…) ; **« ✏️ Autre… »** ouvre une case pour le taper (« éclairage »). Facultatif ici — mais c'est lui que la relance écrira au client (« votre projet d'installation solaire »). S'il manque, la relance le demandera une fois." },
        { titre: "Lire le cadre ambre, s'il apparaît sous le numéro", texte: "« ⚠ Déjà client : NOM — numéro » : cette personne a **déjà un compte client**. Un clic remet son nom et son numéro. On peut quand même l'enregistrer comme prospect (un client peut avoir un nouveau projet), mais on ne lui recréera pas de compte." },
        { titre: "Où il est, ce qu'il veut", texte: "« Localisation (quartier, repère) » en texte, et **« 📍 Choisir sur la carte »** pour poser un point (le bouton devient « Position ✓ »). « Nature du chantier / besoin (facultatif) » : l'exemple à l'écran dit tout — « électrifier une maison 4 pièces, 3 ventilateurs + frigo. Pas encore de budget arrêté. Rappeler après le 15. »" },
        { titre: "Avis, intérêt, relance", texte: "« Avis » : Favorable ou Défavorable. « Intérêt » : Intéressé ou Désintéressé. « Date de relance (facultatif) » : le jour où il faut le rappeler — c'est cette date qui allume la case 🔔." },
        { titre: "« ➕ Enregistrer le prospect »", texte: "La fiche est créée à votre nom, dans l'espace où vous êtes. Le **mot d'accueil part tout seul du numéro WhatsApp BMI** : « Bonjour NOM, 🙏 Merci pour votre intérêt pour BMI TOGO ! Un conseiller BMI vous recontacte très prochainement pour donner suite à votre projet… » suivi de l'e-mail, des numéros et du site. L'écran confirme : « 📲 Le message d'accueil est parti du numéro BMI. » Le journal note « Nouveau prospect « NOM » (Catégorie) — VOUS »." },
      ]],
      ["attention", "**Si le numéro BMI ne peut pas envoyer** (espace formation, réseau, modèle pas encore approuvé par Meta), l'écran le dit d'abord, puis **WhatsApp s'ouvre sur VOTRE téléphone avec le même texte** : on appuie sur Envoyer. Le mot d'accueil ne porte aucun identifiant : le prospect n'est pas encore client. Parti du numéro BMI, il entre dans 📲 WhatsApp, et la conversation vous revient si elle n'est à personne : sa réponse arrive chez vous (chapitre 20)."],

      ["h3", "B. Suivre, relancer, noter"],
      ["etapes", [
        { titre: "Chaque matin : la case 🔔", texte: "« 🔔 À relancer aujourd'hui » compte ceux dont la date de relance est arrivée ou dépassée. « Voir les N prospect(s) à relancer → » ou le bouton « 🔔 À relancer (N) » filtre la liste ; ces lignes sont **sur fond orange**, la date de relance en orange gras." },
        { titre: "« 📱 Relancer »", texte: "Sur une ligne en retard. Si la fiche n'a pas de projet, l'application le **demande une fois** (la même liste) et le garde. Puis une question : « Relancer NOM (numéro) du numéro WhatsApp BMI, au sujet de son projet d'installation solaire ? ». Sur « OK », le message part **du numéro BMI** : « C'est VOTRE NOM de BMI TOGO. Je me permets de revenir vers vous concernant votre projet d'installation solaire : Etes-vous toujours intéressé ? … ». L'historique note **tout seul** « Relance WhatsApp envoyée du numéro BMI ». Si le numéro BMI ne peut pas envoyer, WhatsApp s'ouvre sur votre téléphone avec le même texte." },
        { titre: "« 📞 Contacté »", texte: "Après un appel ou une visite : « Vous venez de contacter « NOM » ? Ce que ça a donné (facultatif) : ». La note s'ajoute à l'historique (les 20 dernières), la date d'activité est remise à aujourd'hui. **Sans ce bouton, un prospect qu'on appelle toutes les semaines finirait « dormant » quand même.**" },
        { titre: "« Relance »", texte: "Change la date de relance (une case de date ; vide = plus de relance). La ligne sort du filtre 🔔 jusqu'à la nouvelle date." },
        { titre: "Lire les pastilles de la colonne « Avis »", texte: "Favorable (vert) / Défavorable (rouge) ; **« 💤 Dormant — N mois »** quand rien ne s'est passé depuis 150 jours ; **« 📦 motif »** s'il est archivé ; **« ⏳ Devis validé — attend le paiement »** quand son devis est signé mais pas encore encaissé (le survol dit le montant, la date et la boutique de paiement)." },
      ]],

      ["h3", "C. Archiver, réactiver, supprimer"],
      ["ol", [
        "**« 📦 Archiver »** : « Archiver « NOM » ? (N jours sans activité) Il sort de la liste active mais N'EST PAS supprimé… Motif (obligatoire) ». Les motifs proposés : **Ne répond plus / Trop cher / A choisi un concurrent / Projet abandonné / Reporté à plus tard / Autre**. Un motif vide est refusé.",
        "Les archivés se lisent avec **« 📦 Archivés (N) »**, leur motif en pastille ambre. **« ↩ Réactiver »** les remet dans la liste active pour une campagne.",
        "**« Suppr. »** efface la fiche pour de bon, après confirmation. À réserver à une erreur de saisie : un prospect qui n'aboutit pas **s'archive**, il ne se supprime pas — au bout d'un an, les motifs d'archivage disent pourquoi les projets n'aboutissent pas.",
      ]],

      ["h3", "Les comptes avec devis, rien acheté"],
      ["p", "Sous le tableau, le cadre **« 📄 Comptes avec devis, rien acheté (N) »** liste les comptes qui ont reçu un devis sans en valider aucun ni rien acheter : ce sont encore des prospects, même si leur compte existe. Chaque ligne dit le numéro, le nombre de devis, la date et le montant du dernier, qui l'a établi, et « 📁 Archivé » s'il dort depuis plus de 30 jours. Les plus récents sont en haut (date du dernier devis). **« 📋 Voir ses devis »** ouvre 📋 Tous les devis, où l'on relance ou corrige. Le commercial n'y voit que les comptes dont il a établi un devis ; l'administrateur, le responsable commercial et le chef d'équipe, tous. Ils quittent le cadre tout seuls au premier devis validé ou au premier achat."],

      ["h3", "D. Convertir en client"],
      ["etapes", [
        { titre: "Quand ?", texte: "**Seulement quand il a dit oui.** La confirmation le rappelle : « À ne faire que s'il a accepté de devenir client. » Avant ça, on lui fait un devis (chapitre 11 ou 12) : le devis, lui, demande un compte client — d'où 🙋 Créer un client (chapitre 3) si le prospect n'en a pas." },
        { titre: "« ✅ Convertir en client »", texte: "Refusé si le numéro n'est pas valide, ou si un compte existe déjà pour ce numéro (« Un compte client existe déjà pour ce numéro (NOM). Rien n'a été recréé. »). Sinon : « Convertir « NOM » en client ? 👤 Identifiant … 🔑 Mot de passe … Un compte sera créé et ses identifiants lui seront envoyés par WhatsApp. »" },
        { titre: "Ce qui se passe", texte: "Le compte client est créé (mêmes règles qu'au chapitre 3), les administrateurs sont prévenus, la fiche passe **« Client acquis »** et sort de la liste active. Les accès partent **du numéro BMI** ; en repli (formation, réseau, refus), WhatsApp s'ouvre avec le texte. L'écran conclut : « ✅ NOM est désormais client. »" },
        { titre: "La conversion automatique", texte: "Quand un devis est **encaissé** dans 💰 Ventes, le prospect du même numéro (ou lié au compte) passe « Client acquis » **tout seul**, avec la vente rattachée. Personne ne relance un client qui a déjà payé." },
      ]],
      ["note", "« **Afficher les clients acquis (N)** » remet les convertis dans la liste, pour consultation : on y lit qui est devenu client et quand. Ils n'ont plus de bouton de relance."],

      ["h3", "E. Réassigner (administrateur, responsable, chef d'équipe)"],
      ["ol", [
        "« **Réassigner** » sur la ligne : « Réassigner « NOM » à quel commercial ? (liste de l'équipe) » — on tape le nom d'un commercial ou d'un technicien à commission **actif de l'espace**. Un nom inconnu est refusé (« Commercial introuvable parmi l'équipe active. »).",
        "Le prospect change de propriétaire, sa date d'activité est remise à jour, le journal écrit « réassigné de X à Y ». L'ancien commercial ne le voit plus (sauf s'il voit tout).",
        "Le bouton n'apparaît que si la personne a le pouvoir « 🔁 Réaffecter les prospects ».",
      ]],
    ]},

    // ── 5
    { titre: "Explication de chaque bouton et champ", blocs: [
      ["h3", "Le tableau de bord commercial"],
      ["table", { entetes: ["Case", "Ce qu'elle compte"], largeurs: [3000, 6300], lignes: [
        ["Prospects actifs", "Ni convertis, ni archivés (les dormants en font partie)."],
        ["🔔 À relancer aujourd'hui", "Actifs dont la date de relance est aujourd'hui ou avant. Orange dès qu'il y en a un."],
        ["💤 Dormants", "Actifs sans aucune activité depuis 150 jours."],
        ["✅ Taux de conversion", "Clients acquis ÷ (actifs + archivés + acquis), en %. Pour un commercial : sur les siens ; pour qui voit tout : sur tout l'espace."],
      ]}],
      ["h3", "Le formulaire « Nouveau prospect »"],
      ["table", { entetes: ["Champ", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Catégorie", "Particulier, Entreprise, Administration, ou celles ajoutées par l'administrateur."],
        ["Nom du prospect / Numéro", "Obligatoires. Le numéro est comparé aux comptes existants (« ⚠ Déjà client »)."],
        ["Localisation (quartier, repère) · 📍 Choisir sur la carte", "Le texte pour s'y retrouver, le point sur la carte pour y aller : la liste montre « 📍 Voir sur la carte » (Google Maps)."],
        ["Projet", "Un métier de ⚙ Paramètres, ou « ✏️ Autre… » à taper. Il s'écrit dans la relance (« votre projet de forage ») et se lit sous la catégorie (« 🎯 Forage »)."],
        ["Nature du chantier / besoin (facultatif)", "Ce qu'il veut, en une phrase, et vos notes. Se lit sur sa propre ligne sous le prospect (un clic l'ouvre en entier). **Il ne part JAMAIS au client.**"],
        ["Avis / Intérêt", "Deux pastilles dans la liste : Favorable/Défavorable, Intéressé/Désintéressé."],
        ["Date de relance (facultatif)", "Le jour où il faut le rappeler. C'est ce qui nourrit 🔔."],
        ["➕ Enregistrer le prospect", "Crée la fiche à votre nom et envoie le mot d'accueil du numéro BMI (repli : WhatsApp sur votre téléphone)."],
      ]}],
      ["h3", "La liste"],
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3000, 6300], lignes: [
        ["Rechercher…", "Nom, numéro, localisation ou projet — la règle de toute recherche (sans accents, chaque mot dans n'importe quel ordre)."],
        ["Afficher les clients acquis (N)", "Remet les convertis dans la liste."],
        ["💤 Dormants (N) / 📦 Archivés (N) / 🔔 À relancer (N)", "Trois filtres ; un second clic revient à la liste active."],
        ["Le filtre de période", "Liste **« Toute période »** (d'office, à chaque ouverture), Aujourd'hui, Cette semaine, Ce mois, Cette année, ou **« ✏️ Personnaliser… »** avec deux dates, sur la DATE du prospect. La liste et son nombre la suivent, et les « Comptes avec devis » suivent la date de leur DERNIER devis. Le compteur « 🔔 À relancer (N) » regarde toujours tout : une relance en retard ne se cache pas derrière une période."],
        ["Colonnes", "Nom (figé quand on fait défiler) · Date · Numéro · Catégorie / projet · Localisation (+ carte) · Avis (+ pastilles d'état) · Intérêt · Relance · Commercial (administrateur seulement) · les boutons."],
        ["Relance", "Change la date de relance (pas pour l'administrateur)."],
        ["📱 Relancer", "N'apparaît que si la relance est en retard et que le prospect a un numéro. Une question, puis le message du numéro BMI, nommant le projet ; note automatique."],
        ["🎯 Projet", "Change le projet de la fiche (son commercial, l'administrateur)."],
        ["Réassigner", "Change le commercial responsable (pouvoir requis)."],
        ["📞 Contacté", "Note un contact, avec ce que ça a donné. Le survol dit la dernière activité."],
        ["✅ Convertir en client", "Crée le compte, envoie les accès, passe la fiche « Client acquis »."],
        ["📦 Archiver / ↩ Réactiver", "Sort de la liste active avec un motif ; ou y revient."],
        ["Suppr.", "Efface la fiche. Pour une erreur de saisie seulement."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**La fiche naît à votre nom et dans votre espace** (réel ou formation). Un prospect créé en formation n'entre jamais dans la vraie file de relance, et l'inverse.",
        "**Toute modification horodate la fiche** : Contacté, Relance, 📱 Relancer, Réassigner, Archiver. C'est cette date qui sert au calcul du dormant : **150 jours** sans rien = « 💤 Dormant — N mois ». Un converti ou un archivé n'est jamais compté dormant.",
        "**Le mot d'accueil et la relance partent du numéro WhatsApp BMI** (modèles approuvés par Meta). Ils ne portent aucun identifiant. Parti du numéro BMI, chaque message entre dans 📲 WhatsApp, et la conversation revient au commercial si elle n'est à personne. Sinon (formation, réseau, refus), WhatsApp s'ouvre sur votre téléphone avec le même texte.",
        "**« 📱 Relancer » pose UNE question avant de partir** : un message parti du numéro BMI ne se rattrape pas. Il écrit ensuite l'historique tout seul. Il nomme le PROJET de la fiche — jamais la « Nature du chantier », qui garde vos notes internes.",
        "**Un devis signé pose le badge « ⏳ Devis validé — attend le paiement »** sur la fiche du prospect ; **un devis encaissé** dans 💰 Ventes la passe « Client acquis », avec la vente et le compte rattachés — le rapprochement se fait par le compte, sinon par les 8 derniers chiffres du numéro.",
        "**« ✅ Convertir en client »** fabrique le compte exactement comme 🙋 Créer un client : identifiant = le nom (chiffres du numéro accolés s'il est pris), mot de passe de 6 caractères recalculable, message aux administrateurs « 🙋 Nouveau client créé par … », accès par le modèle WhatsApp du numéro BMI (~4 F), repli sur l'ouverture WhatsApp.",
        "**Le journal** (🕘 Historique) garde chaque geste : « Nouveau prospect « X » (Catégorie) — VOUS », « 📞 X contacté par VOUS — note », « Relance WhatsApp envoyée à X », « 📦 Prospect « X » archivé — motif », « Prospect « X » réactivé », « Prospect « X » réassigné de A à B », « Prospect « X » CONVERTI en client par VOUS », « Suppression prospect « X » ».",
        "**L'archivage n'efface rien** : la fiche garde son motif, sa date d'archivage, son historique. La suppression, elle, efface pour de bon.",
        "**Le mur** : la liste est celle de l'espace regardé ; l'équipe proposée à la réassignation aussi. Un chef d'équipe ou un responsable de formation ne voit jamais la file réelle.",
        "**L'effacement d'un client** (⚙ Paramètres → 🔒 Données personnelles, chapitre 23) emporte aussi sa fiche de prospection.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**🙋 Créer un client** (chapitre 3) : la case « Prospect » crée compte + fiche de prospect d'un coup (« Favorable », « Intéressé », note « Amené par … ») ; ici, « ✅ Convertir en client » fait l'inverse.",
        "**☀️ Dimensionnement, 📋 Tous les devis** (chapitres 11 à 13) : le devis se fait pour un compte client ; validé, il marque le prospect « ⏳ Devis validé » ; la relance d'un devis sans réponse (15 jours) vit dans 📋 Tous les devis, pas ici.",
        "**💰 Ventes** (chapitre 5) : l'encaissement d'un devis convertit le prospect tout seul.",
        "**👑 Mon équipe / 💵 Ma commission** (chapitre 16) : le commercial rattaché au prospect est celui qui touchera la commission du devis qu'il établit — c'est pourquoi la réassignation est un pouvoir.",
        "**🔐 Pouvoirs** (chapitre 2) : « 🔁 Réaffecter les prospects » se retire compte par compte.",
        "**📲 WhatsApp** (chapitre 20) : pour écrire le premier depuis le numéro BMI, « ✍️ Écrire » avec le modèle de prise de contact ; si le prospect répond, sa conversation arrive dans l'application.",
        "**⚙ Paramètres → 🔒 Données personnelles** (chapitre 23) : l'effacement d'un client emporte sa fiche de prospection.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "Le numéro est **le sien**, à 8 chiffres : c'est lui qui recevra l'accueil, la relance, et qui rapprochera plus tard son devis et sa vente.",
        "La **date de relance** est posée dès la création : un prospect sans date ne s'allume jamais dans 🔔.",
        "Après chaque appel ou visite, **« 📞 Contacté »** avec une phrase : c'est l'historique qui dit où on en est.",
        "Le matin : la case **🔔 À relancer aujourd'hui** est à zéro le soir.",
        "Une fois par mois : **💤 Dormants** — chacun est relancé, archivé avec son motif, ou converti.",
        "Avant « ✅ Convertir » : il a **dit oui**. Un prospect hésitant reste prospect.",
        "Pour l'administrateur : le **taux de conversion** et les **motifs d'archivage** disent ce qui bloque (prix, concurrent, silence).",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3300], lignes: [
        ["Enregistrer sans numéro", "« Le nom et le numéro du prospect sont obligatoires. »", "Demander le numéro : sans lui, ni relance, ni rapprochement."],
        ["Appeler le prospect sans cliquer « 📞 Contacté »", "L'application ne le sait pas : au bout de 150 jours il devient « dormant » alors qu'il est suivi.", "Noter chaque contact, même sans résultat (« Contacté » suffit)."],
        ["Convertir un prospect qui hésite encore", "Un compte est créé, les accès partent : il reçoit un espace pour un projet qu'il n'a pas décidé.", "Lui faire un devis d'abord ; convertir quand il dit oui — ou laisser l'encaissement le convertir."],
        ["« ✅ Convertir » refusé : « Un compte client existe déjà pour ce numéro »", "Il a déjà un compte (créé par un collègue, ou par 🙋 Créer un client).", "Rien à créer : faire le devis sur ce compte. La fiche de prospect se convertira à l'encaissement."],
        ["Supprimer un prospect qui ne répond plus", "La fiche disparaît, avec son historique : on ne saura jamais pourquoi il est parti.", "📦 Archiver avec le motif « Ne répond plus » ; ↩ Réactiver plus tard."],
        ["Un chef d'équipe veut relancer le prospect d'un autre", "« 🔒 … réservé à l'administrateur ou au commercial rattaché (NOM). »", "Le lui réassigner d'abord (« Réassigner »), ou demander au commercial rattaché."],
        ["« Réassigner » n'apparaît pas", "Le compte n'a pas le pouvoir « 🔁 Réaffecter les prospects », ou n'est ni administrateur, ni responsable, ni chef.", "L'administrateur vérifie 🔐 Pouvoirs (chapitre 2)."],
        ["Le mot d'accueil n'est pas parti du numéro BMI", "Le numéro est illisible, l'espace est la formation, le réseau manque, ou Meta n'a pas encore approuvé le modèle. L'écran le dit, puis WhatsApp s'ouvre sur votre téléphone.", "Appuyer sur Envoyer dans WhatsApp ; vérifier le numéro sur la fiche. Pour écrire plus tard du numéro BMI : 📲 WhatsApp → « ✍️ Écrire » (chapitre 20)."],
        ["La relance me demande le projet", "La fiche n'en a pas (ancien prospect, demande de l'assistant WhatsApp).", "Le choisir une fois : il reste sur la fiche. « 🎯 Projet » le change ensuite."],
        ["Un administrateur cherche le formulaire « Nouveau prospect »", "Il n'existe pas pour lui : il n'a pas de prospects à son nom.", "Le commercial enregistre ; l'administrateur réassigne, lit, gère les catégories."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Sur un chantier, un voisin demande au technicien KOSSI « combien pour une maison de 4 pièces ». Il n'a pas de budget, il veut qu'on le rappelle après le 15.", reponse: "🧲 Prospects → Nouveau prospect : Particulier, nom, numéro, « Quartier Bè, près de la pharmacie » + point sur la carte, nature « maison 4 pièces, pas de budget, rappeler après le 15 », Avis Favorable, Intérêt Intéressé, Date de relance le 16. Projet : Solaire. « ➕ Enregistrer » : le mot d'accueil part du numéro BMI. Le 16, la ligne s'allume dans 🔔." },
        { situation: "Le 16, KOSSI a trois lignes en orange dans 🔔 À relancer.", reponse: "Pour chacune : « 📱 Relancer » (une question, puis le message du numéro BMI qui nomme son projet ; la note s'écrit seule), ou un appel puis « 📞 Contacté » avec ce que ça a donné. Puis « Relance » pour poser la prochaine date. Le soir, la case 🔔 est à zéro." },
        { situation: "Un prospect enregistré en avril n'a plus donné signe de vie ; on est en septembre.", reponse: "Il est « 💤 Dormant — 5 mois ». KOSSI tente une dernière relance ; sans réponse, « 📦 Archiver » avec le motif « Ne répond plus ». Il sort de la liste active mais reste consultable dans « 📦 Archivés », et réactivable pour une campagne." },
        { situation: "Le prospect AMA a dit oui au devis que KOSSI lui a envoyé, elle passera payer à la boutique.", reponse: "Rien à faire dans 🧲 Prospects : le devis validé a déjà posé « ⏳ Devis validé — attend le paiement » sur sa ligne. Quand la boutique encaissera le devis, AMA passera « Client acquis » toute seule." },
        { situation: "Un contact dit oui pour un achat en boutique, sans devis, et veut suivre ses affaires depuis son téléphone.", reponse: "« ✅ Convertir en client » : la confirmation montre l'identifiant et le mot de passe, le compte est créé, les accès partent du numéro BMI (ou WhatsApp s'ouvre en repli). La fiche passe « Client acquis »." },
        { situation: "KOSSI part en congé un mois ; ses 12 prospects actifs ont des relances prévues.", reponse: "Le chef d'équipe (ou le responsable commercial, ou l'administrateur) les **réassigne** un par un à un collègue : « Réassigner » → le nom. Chaque fiche change de propriétaire ; le collègue les voit dans « Mes prospects » et peut relancer. Sans réassignation, personne d'autre ne peut faire ces gestes." },
        { situation: "L'administrateur veut savoir pourquoi les projets n'aboutissent pas.", reponse: "🧲 Prospects → « 📦 Archivés (N) » : chaque ligne porte son motif (Trop cher, A choisi un concurrent…). La case « ✅ Taux de conversion » donne le résultat global de l'espace." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "**En espace formation**, avec un compte de commercial et un formateur qui regarde l'écran :"],
      ["ol", [
        "Enregistrer un prospect « TEST KOFFI » avec un numéro convenu, une localisation avec le point sur la carte, une nature de besoin, et une date de relance **à hier**. Fermer WhatsApp sans envoyer.",
        "Constater la case « 🔔 À relancer aujourd'hui » à 1 et la ligne orange. Cliquer « 📱 Relancer », répondre à la question, puis montrer la note « Relance WhatsApp envoyée » (survol de « 📞 Contacté » : dernière activité aujourd'hui).",
        "Cliquer « 📞 Contacté » avec la note « pas encore décidé », puis « Relance » pour poser une date dans une semaine. Vérifier que 🔔 repasse à 0.",
        "Enregistrer un second prospect avec le numéro d'un client de formation existant : montrer « ⚠ Déjà client ». Puis essayer « ✅ Convertir en client » sur lui : lire le refus.",
        "Archiver TEST KOFFI avec le motif « Reporté à plus tard » ; le retrouver dans « 📦 Archivés » ; le réactiver.",
        "Convertir TEST KOFFI en client : lire la confirmation, montrer « Client acquis » via « Afficher les clients acquis », puis le retrouver dans 👥 Utilisateurs (formateur administrateur).",
        "Avec le compte du formateur (administrateur) : réassigner un prospect d'un commercial de formation à un autre, et relire la ligne de journal dans 🕘 Historique.",
      ]],
      ["note", "Le formateur vérifie surtout deux réflexes : **noter chaque contact** (« 📞 Contacté »), et **archiver avec un motif** au lieu de supprimer."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "enregistre un prospect complet, avec sa date de relance ;",
        "lit son tableau de bord et traite la case 🔔 chaque jour ;",
        "relance par WhatsApp et note ses contacts ;",
        "sait ce qu'est un dormant, et pourquoi « 📞 Contacté » l'évite ;",
        "archive avec un motif et sait réactiver ;",
        "convertit au bon moment, et sait que l'encaissement d'un devis convertit tout seul.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Au bout de combien de temps sans activité un prospect devient-il dormant ? Quels gestes remettent le compteur à zéro ?",
        "Quelle différence entre « 📦 Archiver » et « Suppr. » ? Lequel choisir pour un prospect qui ne répond plus ?",
        "D'où part le mot d'accueil envoyé à l'enregistrement ? Que se passe-t-il si le numéro BMI ne peut pas l'envoyer ? Pourquoi la « Nature du chantier » ne part-elle jamais au client ?",
        "Qui peut relancer le prospect d'un collègue absent, et par quel geste ?",
        "Un prospect a signé son devis : que voit-on sur sa ligne, et quand devient-il « Client acquis » ?",
        "Comment se calcule le taux de conversion ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Enregistre un prospect complet (numéro, localisation, besoin, date de relance)",
      "Traite la case 🔔 À relancer : 📱 Relancer, 📞 Contacté, nouvelle date",
      "Sait ce qu'est un dormant et comment l'éviter",
      "Archive avec un motif, réactive ; ne supprime que les erreurs",
      "Convertit au bon moment et connaît la conversion automatique à l'encaissement",
      "Sait qui peut réassigner, et pourquoi",
      "Répond juste aux six questions de la rubrique 12",
    ],
  },
};
