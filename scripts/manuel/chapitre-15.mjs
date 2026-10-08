// ============================================================
// MANUEL DE FORMATION — CHAPITRE 15 : Chantiers et travaux
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// lib/whatsappModeles.js (lien_signature_pv, avenant_reserves — 01/10/2026),
// screens/ClientsInstalles.jsx (« 🏠 Nouveau client installé » — Nom, Prénom,
// Numéro, 🔑 Compte client (+ Créer), Type d'installation, Date
// d'installation, Prochain entretien, 🧾 Vente rattachée, 🛡 Garantie (mois),
// Commercial rattaché, Localisation + 📍 Choisir sur la carte, Adresse
// formelle ; 👷 Équipe prévue ⭐ ; 🔩 Matériel posé ; Enregistrer le client ;
// la liste « Clients installés (N) », 🔔 Entretien dû, les pilules Tout /
// 🛠 Travaux soldés / 📅 À programmer / 🔧 En cours / ⏳ En attente du client /
// ⚠ Réserves émises / ✅ Réceptionné ; ▸ Dossier, 🎁 Cadeau, 🏁 Marquer
// terminé, 📤 Envoyer pour signature, ⚠ Forcer sans signature, 📤 Envoyer
// l'avenant, 📄 Voir le PV, 💰 Encaisser, 🔧 Frais, Entretien, ✅ Entretien
// fait, Lier un compte, Suppr. ; le dossier — 📅 Programmer l'installation,
// 🔩, 📷 (6 photos), 📝 Observations ; 🔧 Frais d'installation — Part de BMI,
// Le chef touche en plus (%), ✅ Valider la répartition, 📤 Demander le
// paiement, ✓ Valider et payer ; MAX_PHOTOS = 6), lib/calculs.js
// (ROLES_PROGRAMMATION, statutChantier, debloquerCommissionsReception,
// construirePaiementPrime, retenueOutilPourPrime), App.jsx (réception
// automatique 7 jours après la fin des travaux), lib/poseSeule.js
// (critiqueProgrammationPose, 70 %), components/encaissementPose.js,
// lib/depensesChantier.js (fraisAPartager), lib/rappelEntretien.js,
// lib/demandeAvis.js, lib/contrat.js (numeroPv, champsLienPv),
// lib/corbeille.js (30 jours), lib/constants.js (TYPES_INSTALLATION),
// screens/Travaux.jsx et lib/travaux.js (🛠 Travaux à crédit — ROLES_FICHE
// gérant/admin, ROLES_ARTICLES magasinier/gérant/admin, ROLES_FACTURER
// vendeur/gérant/admin, suppression principal seul, équipe admin).
// Le contrat est au chapitre 14 ; les commissions au 16 ; les petites
// dépenses au 17 ; l'outillage au 19.
// ============================================================
export const CHAPITRE = {
  numero: 15,
  titre: "Chantiers et travaux",
  sousTitre: "Du contrat signé au PV de réception — programmer, poser, faire signer, partager les frais — et les travaux à crédit",
  public: "Administrateur, responsable commercial, chef d'équipe, technicien, technicien BMI, commercial ; gérant, vendeur et magasinier pour les travaux à crédit",
  duree: "1 h 30, puis l'exercice en espace formation",
  prerequis: "Le chapitre 14 (Contrats) : un chantier naît d'un contrat signé. Le chapitre 5 (Ventes) : l'encaissement. Le chapitre 7 (Dettes) : les versements d'une pose seule.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "lire l'onglet **🏠 Clients installés** : les catégories, les statuts, ce que chacun voit ;",
        "**créer une fiche** de chantier à la main (nom, compte, équipe prévue, matériel posé) ;",
        "**programmer** une installation (date, équipe, chef ⭐) ;",
        "tenir le **dossier** du chantier : matériel posé avec numéros de série, photos, observations ;",
        "**déclarer les travaux terminés** et faire signer le **PV de réception** ;",
        "traiter les **réserves** du client par un **avenant** ;",
        "**répartir les frais d'installation** entre BMI et les techniciens, puis payer les parts ;",
        "suivre l'**entretien**, et gérer les **travaux à crédit** (🛠).",
      ]],
      ["regle", "**Un chantier n'est clos que quand le client l'a réceptionné.** Le chef de chantier déclare les travaux terminés ; c'est la **signature du PV** par le client qui clôt. C'est la protection des deux côtés : BMI prouve que le travail est livré, le client prouve ce qu'il a reçu."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [4300, 5000], lignes: [
        ["Voir 🏠 Clients installés", "**Administrateur et chefs d'équipe** : tout le parc. **Commercial, technicien, technicien BMI** : leurs propres fiches et les chantiers où ils sont dans l'équipe. **Vendeur, responsable commercial** : aussi les poses seules pas encore soldées (pour les encaisser en boutique)."],
        ["Créer une fiche (Enregistrer le client)", "Tout compte qui a l'onglet ; le commercial rattaché est choisi par l'administrateur."],
        ["📅 Programmer l'installation", "**Administrateur et responsable commercial.**"],
        ["🏁 Marquer terminé", "**Le chef ⭐ de CE chantier, ou l'administrateur.**"],
        ["📤 Envoyer pour signature (renvoi), ⚠ Forcer sans signature, 📤 Envoyer l'avenant", "**L'administrateur.**"],
        ["📷 Photos, 📝 Observations", "L'administrateur et les membres de l'équipe du chantier. Supprimer une photo : l'administrateur."],
        ["💰 Encaisser une pose seule", "Le chef de ce chantier, le vendeur, le gérant, le responsable commercial, l'administrateur."],
        ["🔧 Frais (répartition), 📤 Demander le paiement", "**L'administrateur.**"],
        ["✓ Valider et payer une part", "Le vendeur de la boutique qui paie, ou l'administrateur."],
        ["Entretien (date), ✅ Entretien fait, 🎁 Cadeau, Lier un compte, corriger adresse / garantie", "**L'administrateur.**"],
        ["Suppr. (corbeille 30 jours)", "L'administrateur, ou le commercial de la fiche."],
        ["🛠 Travaux à crédit", "Voir la partie H de la rubrique 4."],
      ]}],
      ["note", "**Le mur formation / réel s'applique** : l'écran ne montre que les chantiers de l'espace regardé, et l'équipe ne se compose qu'avec les techniciens de cet espace."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3100, 6200], lignes: [
        ["🏠 Clients installés → « ➕ Nouveau client installé »", "Le bouton qui ouvre le formulaire pour créer une fiche à la main (fermé d'office, replié après l'enregistrement)."],
        ["🏠 Clients installés → la liste", "Les pilules par catégorie avec leur nombre, 🔔 Entretien dû, la recherche, et les boutons de chaque ligne."],
        ["La ligne → ▸ Dossier", "Statut, garantie, vente rattachée, équipe ; programmation ; matériel posé ; photos ; observations."],
        ["La ligne → 🔧 Frais", "La répartition des frais d'installation et le paiement des parts."],
        ["🛠 Travaux à crédit", "Les travaux hors devis, jusqu'à ce qu'ils soient soldés."],
        ["👑 Mon équipe / ✅ Mes tâches", "Les tâches d'entretien posées automatiquement pour le chef de chantier."],
      ]}],
      ["h3", "Les catégories de la liste"],
      ["table", { entetes: ["Catégorie", "Ce qu'elle regroupe"], largeurs: [3100, 6200], lignes: [
        ["📅 À programmer", "Chantier en cours, sans équipe encore affectée. Un chantier né d'une vente porte en plus la pastille rouge « 🔔 À PROGRAMMER »."],
        ["🔧 En cours", "Équipe affectée, travaux pas encore déclarés terminés."],
        ["En attente du client", "Travaux terminés, PV pas encore signé."],
        ["⚠ Réserves émises", "Le client a signé le PV avec des réserves."],
        ["✅ Réceptionné", "PV signé sans réserve, avenant signé, ou réception automatique."],
        ["🛠 Travaux soldés", "Les travaux à crédit entièrement payés : une trace."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. D'où vient un chantier"],
      ["ul", [
        "**Un devis d'installation payé** : l'encaissement dans 💰 Ventes crée le chantier (catégorie À programmer).",
        "**Une pose seule signée** : le chantier et sa dette naissent dès la signature du contrat (chapitre 14).",
        "**Une fiche créée à la main** : 🏠 Nouveau client installé (installation plus ancienne, cas particulier).",
      ]],
      ["h3", "B. Créer une fiche à la main"],
      ["etapes", [
        { titre: "Remplir l'identité", texte: "Nom, Prénom, Numéro, Type d'installation (Solaire résidentiel, Solaire commercial, Pompage solaire, Éclairage public, Kit autonome, Autre), dates, garantie en mois (24 d'office)." },
        { titre: "Le compte client", texte: "Choisir un compte libre dans « 🔑 Compte client », ou **+ Créer** : le prénom est obligatoire, les accès partent au client (chapitre 3). Sans compte, l'application prévient : il n'aura pas d'espace client, mais **il signera quand même le PV** par le lien WhatsApp." },
        { titre: "La vente rattachée (facultatif)", texte: "Choisir la vente : le matériel posé se remplit tout seul, et le compte du client est cherché. Seules les ventes de l'espace regardé sont proposées." },
        { titre: "Localisation et adresse formelle", texte: "Le quartier et un repère ; **📍 Choisir sur la carte** pour la position. L'**adresse formelle** (numéro, rue, ville) est celle du PV : **sans elle, le lien de signature ne part pas.**" },
        { titre: "Équipe prévue et matériel", texte: "Cocher les techniciens, désigner le chef ⭐ ; ajouter le matériel posé avec quantité et numéro de série. Puis **Enregistrer le client**." },
      ]],
      ["h3", "C. Programmer l'installation (administrateur, responsable commercial)"],
      ["etapes", [
        { titre: "Ouvrir ▸ Dossier", texte: "Cadre violet **📅 Programmer l'installation**." },
        { titre: "Date, équipe, chef ⭐", texte: "Les trois sont obligatoires. Seuls les techniciens de l'espace du chantier sont proposés." },
        { titre: "✅ Programmer l'installation", texte: "Chaque membre reçoit un message (« Vous avez été affecté comme chef d'équipe ⭐ … le … »). Le client aussi, s'il a un compte. Changer la date plus tard : **✅ Mettre à jour la programmation**, et tout le monde est reprévenu." },
      ]],
      ["attention", "**Pose seule : pas de programmation avant les 70 %.** Tant que l'acompte n'est pas encaissé, la programmation est refusée et le refus dit le montant qui manque. Encaissez d'abord (💰 sur la ligne, ou 🧾 Commandes de la boutique)."],
      ["h3", "D. Le dossier du chantier"],
      ["etapes", [
        { titre: "🔩 Matériel posé", texte: "Ce qui a été installé, avec les numéros de série. « C'est l'information la plus précieuse dans deux ans, au moment d'un dépannage. »" },
        { titre: "📷 Photos (6 au plus)", texte: "**+ Ajouter une photo** ouvre l'appareil photo du téléphone. Les photos avant / après protègent en cas de contestation." },
        { titre: "📝 Observations", texte: "**+ Ajouter une observation** : difficulté d'accès, matériel particulier, conseil donné au client. Datée et signée de votre nom." },
      ]],
      ["h3", "E. Fin des travaux et PV de réception"],
      ["etapes", [
        { titre: "🏁 Marquer terminé (le chef ⭐ ou l'administrateur)", texte: "Le chantier passe « Terminé — en attente du client ». Le **lien de signature du PV part tout seul du numéro WhatsApp BMI** au client (« Vos travaux d'installation (solaire) sont terminés… », l'adresse du lien, l'e-mail, les numéros et le site), et l'écran le confirme. Le message ne porte **aucun code** du client. Si le numéro BMI ne peut pas envoyer (formation, réseau, modèle pas encore approuvé), l'écran le dit, puis WhatsApp s'ouvre sur votre téléphone avec le même texte." },
        { titre: "S'il manque l'adresse formelle ou le numéro", texte: "Les travaux sont déclarés terminés, mais le lien ne part pas : le message dit ce qui manque. Renseignez-le, puis **📤 Envoyer pour signature** (administrateur)." },
        { titre: "Le client signe", texte: "Sur son téléphone, par le lien (sans compte), ou depuis son espace client. Il accepte **sans réserve** (✅ Réceptionné) ou **avec réserves** (⚠ Réserves émises)." },
        { titre: "📄 Voir le PV", texte: "Le PV signé (numéro PV-année-…) s'imprime depuis la ligne." },
      ]],
      ["h3", "F. Les réserves et l'avenant"],
      ["etapes", [
        { titre: "Corriger sur le terrain", texte: "L'administrateur peut fixer le **délai convenu pour la levée des réserves** dans le dossier ; il apparaîtra sur le PV." },
        { titre: "📤 Envoyer l'avenant (réserves corrigées)", texte: "L'administrateur confirme que les réserves sont corrigées : un nouveau lien part au client **du numéro WhatsApp BMI** (même repli). Pendant l'attente : « 📤 Avenant en attente de signature »." },
        { titre: "Le client signe l'avenant", texte: "Le chantier passe **✅ Réceptionné** pour de bon." },
      ]],
      ["h3", "G. Répartir les frais d'installation (administrateur)"],
      ["etapes", [
        { titre: "🔧 Frais sur la ligne", texte: "Saisir les **frais facturés au client**. Les **petites dépenses rattachées** au chantier (carburant, nourriture — chapitre 17) sont **soustraites avant le partage**, si elles comptent (ni en attente du DG, ni rejetées)." },
        { titre: "Part de BMI, puis les techniciens", texte: "**Part de BMI (%)** : BMI prend d'abord sa part (0 d'office). Le reste va aux techniciens présents ; **le chef touche 7 % de plus que chacun des autres** (« Le chef touche en plus (%) », modifiable). Chaque pourcentage se corrige à la main ; le total ne peut pas dépasser 100 %." },
        { titre: "✅ Valider la répartition", texte: "La confirmation montre chaque part en francs. Une répartition dont une part a déjà été payée ne se refait plus." },
        { titre: "📤 Demander le paiement, puis ✓ Valider et payer", texte: "L'administrateur choisit la boutique qui paiera — **la caisse où le client a payé est proposée en premier** (son argent y est), il peut en prendre une autre ; le vendeur ou le gérant de cette boutique (ou l'administrateur) valide dans 💰 Primes remises : la sortie de caisse est faite, et la personne payée reçoit un message et un WhatsApp du numéro BMI (chapitre 16). Un technicien à commission qui doit un outil perdu voit la retenue **annoncée** et prise sur sa part (chapitre 19). Une ligne « 🎁 Prime de chantier (part BMI) » est la prime d'un employé de boutique : elle se paie de la même façon (chapitre 16), et refaire le partage la garde." },
      ]],
      ["h3", "H. Les travaux à crédit (🛠)"],
      ["etapes", [
        { titre: "Ouvrir les travaux (gérant, administrateur)", texte: "Bouton « ➕ Nouveaux travaux » (le formulaire est fermé d'office), puis nom, prénom, numéro, lieu, description, et **Ouvrir les travaux** : une fiche par travail, hors devis." },
        { titre: "📦 Sortir du stock (magasinier, gérant, administrateur)", texte: "L'article se choisit **en tapant son nom** et en cliquant une proposition. **Le stock baisse tout de suite**, l'article est facturé au prix de la boutique. Retirer une ligne le remet en stock (jamais après facturation)." },
        { titre: "Articles HB et prestation", texte: "**+ Ajouter l'article HB** : acheté dehors (câble, tuyau), prix payé et prix facturé. **✏️ Fixer les frais de prestation** : un pourcentage de tous les articles, ou un montant." },
        { titre: "Lire le tableau des articles", texte: "Chaque ligne donne le **prix unitaire facturé** et le **coût unitaire** (prix d'achat d'une unité), puis le **total facturé** (quantité × prix unitaire facturé) et le **total coût** (quantité × coût unitaire). Additionner les deux colonnes de totaux redonne les deux chiffres du titre (« … facturés, coût … »). Le carré **« Coût (articles + petites dépenses) »** ajoute au total coût les petites dépenses rattachées ; le carré **« À facturer »** ajoute au total facturé les frais de prestation." },
        { titre: "🧾 Petites dépenses rattachées", texte: "Carburant, nourriture… saisis dans 📤 Dépenses avec « Chantier à rattacher ». Chaque ligne s'affiche **en gras**, avec **qui l'a saisie**. **🗑 Supprimer** (administrateur) : la dépense part, et l'argent **revient dans la caisse qui l'avait payée** (son tiroir et ses fonds à verser se recalculent). Sous la liste, **« 💼 Remis à … »** : pour chaque technicien qui a reçu de l'argent pour ce chantier, ce qu'il a reçu, détaillé, rendu, et ce qui reste à justifier (chapitre 17). Le même cadre se lit dans 🏠 Clients installés → 🔧 Frais." },
        { titre: "🧾 Facturer le client (vendeur, gérant, administrateur)", texte: "Le panier part dans 💰 Ventes, où l'on encaisse comme une vente (comptant, ou à crédit avec avance). Les articles déjà sortis ne sortent pas une seconde fois." },
        { titre: "Soldé", texte: "Réglé comptant, ou dette soldée : la fiche quitte l'onglet et passe dans 🏠 Clients installés, catégorie 🛠 Travaux soldés (facturé, coût, marge). Pas de PV, pas d'entretien." },
      ]],
      ["note", "**🗑 Supprimer ces travaux** : l'administrateur principal seul, et seulement sans article ni facture. La fiche part à la corbeille 30 jours ; les dépenses rattachées restent dans 📤 Dépenses."],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Bouton", "Où", "Ce qu'il fait"], largeurs: [2800, 2300, 4200], lignes: [
        ["Enregistrer le client", "🏠 Nouveau client installé", "Crée la fiche dans l'espace regardé."],
        ["▸ Dossier", "Ligne", "Ouvre le dossier ; la page vient à lui, « Fermer » ramène sur la ligne."],
        ["✅ Programmer l'installation", "Dossier", "Fixe date, équipe et chef ; prévient l'équipe et le client."],
        ["🏁 Marquer terminé", "Ligne", "Déclare les travaux terminés et envoie le lien du PV du numéro BMI (repli : WhatsApp sur l'appareil)."],
        ["📤 Envoyer pour signature", "Ligne", "Renvoie le lien du PV du numéro BMI (administrateur)."],
        ["⚠ Forcer sans signature", "Ligne", "Réceptionne sans PV — exception, trace rouge permanente sur la fiche."],
        ["📤 Envoyer l'avenant (réserves corrigées)", "Ligne", "Envoie le lien de l'avenant après correction des réserves."],
        ["📄 Voir le PV", "Ligne", "Imprime le PV signé."],
        ["💰 Encaisser", "Ligne (pose seule)", "Encaisse l'acompte de 70 % ou le solde ; « ✅ Pose soldée » ensuite."],
        ["🔧 Frais", "Ligne", "Ouvre la répartition des frais d'installation."],
        ["Entretien / ✅ Entretien fait", "Ligne", "Fixe la date du prochain entretien ; note un entretien fait et propose le suivant à 6 mois."],
        ["🎁 Cadeau", "Ligne", "Offre un cadeau au client, à retirer dans une boutique ; il est prévenu s'il a un compte."],
        ["Lier un compte", "Ligne", "Rattache un compte client libre à la fiche."],
        ["Suppr.", "Ligne", "Met la fiche à la corbeille 30 jours (refusé si une part a été payée)."],
        ["🔔 Entretien dû", "En-tête de liste", "Ne montre que les chantiers dont l'entretien est dû (fond orange)."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Réception automatique** : un chantier « Terminé » depuis **7 jours** sans signature passe réceptionné tout seul (« Réception automatique (7 jours après fin de travaux) »).",
        "**À la réception** (PV signé, forcé ou automatique), les **commissions** liées à la vente sont débloquées si la dette est soldée (chapitre 16).",
        "**🏗 L'argent d'une pose seule entre dans la caisse CHANTIER**, sans question : qui que ce soit qui encaisse (le chef sur le terrain, le vendeur ou le gérant au comptoir, l'administrateur), l'acompte et le solde vont dans la même caisse. Au comptoir, l'argent se range à part du tiroir de la boutique.",
        "**Pose seule** : 3 jours après le PV, si le solde reste dû, la tournée de 7 h envoie un rappel au client par WhatsApp et prévient les administrateurs.",
        "**Rappel d'entretien** : du 10e jour avant la date d'entretien au jour même, le client reçoit un message WhatsApp et **une tâche** est posée pour le chef du chantier.",
        "**Demande d'avis Google** : entre le 10e et le 40e jour après la réception, une seule fois (« ⭐ Avis demandé le … » sous la date).",
        "**Programmer** prévient l'équipe et le client ; **refaire une répartition** annule les demandes de prime devenues fausses et prévient les vendeurs.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["table", { entetes: ["Module", "Le lien"], largeurs: [3100, 6200], lignes: [
        ["📄 Contrats (ch. 14)", "Le contrat signé fait naître le chantier ; le PV signé s'y lit aussi (📄 Voir le PV)."],
        ["💰 Ventes / 🧾 Commandes (ch. 5)", "L'encaissement d'un devis crée le chantier ; les 70 % d'une pose seule s'encaissent aussi dans 🧾 Commandes ; les travaux à crédit se facturent dans 💰 Ventes."],
        ["📋 Dettes (ch. 7)", "Le solde d'une pose seule et d'une facture de travaux vit sur une dette."],
        ["Commissions et primes (ch. 16)", "Débloquées à la réception ; les parts d'installation se paient d'ici ou depuis 💰 Primes remises."],
        ["📤 Dépenses (ch. 17)", "Les petites dépenses rattachées au chantier sont déduites des frais avant le partage."],
        ["🧰 Outillage (ch. 19)", "Un outil sort pour un chantier en cours ; une retenue d'outil perdu se prend sur une part."],
      ]}],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "L'adresse formelle et le numéro du client sont renseignés avant la fin des travaux.",
        "La pose seule a son acompte de 70 % encaissé avant la programmation.",
        "Le matériel posé porte ses numéros de série.",
        "Des photos avant / après sont dans le dossier.",
        "Le PV est signé (ou l'avenant, en cas de réserves).",
        "La répartition des frais tient compte des petites dépenses rattachées.",
        "La date du prochain entretien est posée.",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "La bonne façon"], largeurs: [4300, 5000], lignes: [
        ["Marquer terminé sans adresse formelle.", "Le lien ne part pas : renseigner l'adresse, puis 📤 Envoyer pour signature."],
        ["Forcer la réception pour aller plus vite.", "C'est une exception (client injoignable, refus) : aucun PV n'existera, et la fiche le dira pour toujours."],
        ["Vouloir programmer une pose seule avant l'acompte.", "Encaisser d'abord les 70 %."],
        ["Oublier les numéros de série.", "Les noter dans 🔩 Matériel posé : ils servent au dépannage et à la garantie."],
        ["Refaire la répartition après avoir payé une part.", "Refusé : les paiements faits ne s'effacent pas."],
        ["Chercher un chantier qu'on n'a pas créé et où on n'est pas dans l'équipe.", "Il n'apparaît pas : demander à l'administrateur ou au chef d'équipe."],
        ["Supprimer une fiche de travaux qui a encore des articles.", "Retirer d'abord les articles (ils reviennent en stock)."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Un devis solaire vient d'être encaissé. Où est le chantier ?", reponse: "Dans 🏠 Clients installés, catégorie **📅 À programmer**, pastille « 🔔 À PROGRAMMER ». L'administrateur ou le responsable commercial ouvre ▸ Dossier et programme date, équipe et chef ⭐." },
        { situation: "Le chef de chantier a fini la pose mais la fiche n'a pas d'adresse formelle.", reponse: "🏁 Marquer terminé passe, mais le lien ne part pas et le message le dit. L'administrateur saisit l'adresse dans le dossier, puis 📤 Envoyer pour signature." },
        { situation: "Le client signe le PV avec la réserve « un panneau mal fixé ».", reponse: "Catégorie ⚠ Réserves émises. On corrige, l'administrateur fixe le délai si besoin, puis 📤 Envoyer l'avenant. Le client signe : ✅ Réceptionné." },
        { situation: "Frais facturés 200 000 F, dépenses rattachées 20 000 F, 4 techniciens, part de BMI 40 %.", reponse: "180 000 F à partager. BMI garde 40 % (72 000 F). Les 60 % restants : chacun des trois autres 14,74 % (26 532 F), le chef 15,78 % (28 404 F)." },
        { situation: "Un client n'a pas signé et ne répond plus depuis une semaine.", reponse: "Au 7e jour après la fin des travaux, la réception devient automatique et les commissions se débloquent (si la dette est soldée). Pas besoin de forcer." },
        { situation: "Un client demande de passer un câble et deux prises, hors devis, à payer plus tard.", reponse: "🛠 Travaux à crédit : ouvrir la fiche, sortir les articles du stock (ou HB), fixer la prestation, puis 🧾 Facturer et encaisser à crédit dans 💰 Ventes." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "En **espace formation**, avec le formateur :"],
      ["ol", [
        "Créer une fiche à la main : compte client créé sur place, adresse formelle, équipe prévue avec un chef ⭐, deux lignes de matériel avec numéro de série.",
        "(Administrateur ou responsable commercial) Programmer l'installation pour demain.",
        "Ajouter une photo et une observation dans le dossier.",
        "(Chef ⭐) Marquer terminé ; lire le message du lien du PV.",
        "(Administrateur) Répartir des frais de 100 000 F avec une part de BMI de 30 %, puis demander le paiement d'une part.",
        "Ouvrir des travaux à crédit, sortir un article du stock, ajouter un article HB, fixer 10 % de prestation, puis facturer.",
      ]],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "lit les catégories de 🏠 Clients installés et dit ce qu'il y voit ;",
        "crée une fiche complète (compte, adresse formelle, équipe, matériel) ;",
        "sait qui programme, qui termine, qui fait signer ;",
        "explique le PV, les réserves, l'avenant et la réception automatique ;",
        "répartit des frais en tenant compte de la part de BMI et des dépenses rattachées ;",
        "gère des travaux à crédit jusqu'à la facturation.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Qui peut déclarer des travaux terminés ?",
        "Que faut-il sur la fiche pour que le lien du PV parte ?",
        "Pourquoi ne peut-on pas programmer une pose seule tout de suite ?",
        "Que se passe-t-il 7 jours après la fin des travaux sans signature ?",
        "Quand envoie-t-on un avenant ?",
        "Comment la part du chef se calcule-t-elle par rapport aux autres ?",
        "Pourquoi les petites dépenses rattachées changent-elles les parts ?",
        "Quand une fiche de travaux à crédit quitte-t-elle son onglet ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Lit les catégories et les statuts d'un chantier",
      "Crée une fiche complète",
      "Connaît qui programme, termine, fait signer",
      "Explique PV, réserves, avenant, réception automatique",
      "Tient le dossier (matériel, photos, observations)",
      "Répartit les frais et fait payer les parts",
      "Gère des travaux à crédit jusqu'à la facture",
      "Répond juste aux huit questions de la rubrique 12",
    ],
  },
};
