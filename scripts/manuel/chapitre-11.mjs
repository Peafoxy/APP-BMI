// ============================================================
// MANUEL DE FORMATION — CHAPITRE 11 : Dimensionnement solaire
//
// Des MOTS, rien d'autre. Chaque bouton, chaque chiffre vient du code :
// screens/dimensionnement/index.jsx (un bouton par domaine, « 📝 Mes
// brouillons », une seule boutique pour tous les volets, le volet mémorisé,
// le bandeau « ✏️ Reprise du devis de … » et « Annuler la reprise »),
// screens/dimensionnement/Solaire.jsx (« ☀️ Besoins électriques du client » :
// Appareil · Puissance (W) · Heures/jour · Quantité · Retirer ; « ➕ Ajouter un
// appareil » ; « 🆕 Nouveau devis (tout effacer) » au-delà de 5 appareils ;
// Autonomie souhaitée (jours) · Ensoleillement (h/jour) · Tension du système
// 12/24/48 V · Type de batterie LiFePO4 (lithium) / Gel ; les quatre carrés
// Consommation / Panneaux nécessaires / Batterie / Convertisseur ; le tableau
// « Équipements proposés (stock de …) » : Catégorie · Article · Besoin
// calculé · Quantité · Prix unit. · Sous-total · HB ; « ✏️ Saisir un article
// hors stock », « Valider », « Annuler (revenir à la sélection
// automatique) » ; « ✓ Intégré au convertisseur » et « ➕ L'ajouter quand
// même » ; la ligne « Aucun article correspondant dans le stock de … » et sa
// raison ; les rails en mètres puis en barres, la liste des supports, les
// étriers ; le mode « Libre »), lib/solaire.js (RENDEMENT_SYSTEME 0,8,
// PROFONDEUR_DECHARGE lithium 0,9 / gel 0,7, tension réelle 51,2 V,
// convertisseur × 2, régulateur × 1,25, supportsPourRails, etriersPourPanneaux,
// barresDeRail), lib/choixSolaire.js (ROLES_EQUIPEMENT, SOLEIL_DEFAUT 5,
// TENSION_DEFAUT 48, VA × 0,8, tension déduite d'un convertisseur,
// type de batterie lu dans le nom, choixDuStock, metresRailPourPanneaux),
// lib/appareils.js / catalogueAppareils.js (60 appareils proposés),
// screens/dimensionnement/Partages.jsx (« Autres équipements », HB coché
// d'office pour un nom hors stock, « Pose seule », Remise / Frais
// d'installation / Transport, « 🛒 Convertir en vente », « 💰 Acompte exigé
// pour démarrer (%) », « 🗓 Délai d'installation indicatif », « 📲 Envoyer ce
// devis au client », « Client destinataire », « ➕ Nouveau client (nom +
// numéro) », « 📲 Envoyer par WhatsApp », « 📝 Enregistrer un brouillon » ;
// la signature exigée ; la remise > 3 % refusée hors administrateur ; espace
// puis devis_disponible pour un client qui n'a pas encore ses accès),
// screens/dimensionnement/devisCommun.js (calculerTotaux : la remise ne porte
// que sur les articles ; installation et transport sur le montant plein),
// screens/dimensionnement/Brouillons.jsx (« ✏️ Reprendre », « 📲 Envoyer par
// WhatsApp », « Supprimer »), screens/Parametres.jsx (🗂 Catalogue & devis :
// « 🔩 Prix du rail de fixation (au mètre) », « Longueur d'une barre (m) »,
// « ☀️ Note affichée sous le dimensionnement » ; 🔌 Appareils), App.jsx (qui
// a l'onglet ☀️ Dimensionnement).
// ============================================================
export const CHAPITRE = {
  numero: 11,
  titre: "Dimensionnement solaire",
  sousTitre: "Passer des appareils du client à une installation chiffrée — panneaux, batteries, convertisseur, fixation — puis au devis envoyé par WhatsApp ou à la vente",
  public: "Administrateur, responsable commercial, commercial, technicien, technicien BMI, gérant, vendeur",
  duree: "1 h 30, puis l'exercice en espace formation",
  prerequis: "Le chapitre 3 (Clients) : un client a un compte et un espace. Le chapitre 5 (Ventes) : ce que devient un panier. Le chapitre 8 (Stocks) : le nom, la catégorie et la tension d'un article, que ce volet LIT pour choisir le matériel.",

  sections: [
    // ── 1
    { titre: "Objectif du module", blocs: [
      ["p", "À la fin de ce chapitre, l'employé sait :"],
      ["ul", [
        "**noter les besoins électriques du client** — chaque appareil, sa puissance, ses heures d'usage par jour, sa quantité — et régler l'autonomie, l'ensoleillement, la tension et le type de batterie ;",
        "**lire les quatre chiffres** que l'application en tire : la consommation par jour, la puissance de panneaux, la capacité de batterie, la puissance du convertisseur ;",
        "**vérifier et corriger le matériel proposé** dans le stock de la boutique : changer d'article, corriger une quantité, saisir un article hors stock, revenir au calcul ;",
        "comprendre **la fixation** : les rails calculés en mètres puis vendus en barres entières, le modèle de support, les étriers ;",
        "**terminer le devis** : autres équipements, pose seule, remise, installation, transport, acompte, délai ;",
        "**l'envoyer au client** par WhatsApp, **l'enregistrer en brouillon**, ou **le convertir en vente**.",
      ]],
      ["regle", "**Le calcul propose, le vendeur décide.** L'application fait les comptes et choisit dans le stock ce qui convient. Mais c'est le vendeur qui relit chaque ligne avant d'envoyer : un devis engage BMI (il porte sa signature et le cachet de la maison, chapitre 13). Ce qui s'écarte du calcul est toujours possible, et se défait toujours par « Annuler (revenir à la sélection automatique) »."],
    ]},

    // ── 2
    { titre: "Qui peut l'utiliser", blocs: [
      ["table", { entetes: ["Le geste", "Qui"], largeurs: [5000, 4300], lignes: [
        ["Voir l'onglet ☀️ Dimensionnement", "**Administrateur, responsable commercial, commercial, technicien, technicien BMI, gérant, vendeur.** Le magasinier, le comptable et le client ne l'ont pas."],
        ["Choisir la boutique de travail et le mode « Libre »", "Seulement un compte **sans boutique attitrée** (administrateur « Toutes », par exemple). Un vendeur ou un gérant travaille toujours sur SA boutique : la rangée des boutiques ne s'affiche pas pour lui."],
        ["Envoyer un devis au client", "Tout compte qui a l'onglet et qui a **enregistré sa signature** (📄 Contrats). Sans elle : « Avant d'envoyer un devis, vous devez d'abord enregistrer votre signature — rendez-vous dans l'onglet « 📄 Contrats » pour le faire, une seule fois. »"],
        ["Accorder une remise de plus de 3 %", "**Administrateur seul** (décision du 04/09/2026). Pour les autres, l'envoi est refusé : « 🔒 Une remise supérieure à 3 % est réservée à l'administrateur… »"],
        ["Régler le prix du rail au mètre, la longueur d'une barre, la note du bas d'écran", "**Administrateur**, dans ⚙ Paramètres → 🗂 Catalogue & devis."],
        ["Ajouter, corriger ou retirer un appareil de la liste proposée", "**Administrateur**, dans ⚙ Paramètres → 🔌 Appareils."],
        ["Le compte en lecture seule (comptable)", "N'a pas l'onglet. Tout geste d'écriture répond que la base est en lecture seule."],
      ]}],
      ["note", "**Le mur formation / réel s'applique ici aussi.** Les boutiques proposées sont celles de l'espace regardé, et la liste « Client destinataire » ne montre que les clients de l'espace de la boutique de travail. Un devis établi depuis une boutique de formation est un devis de formation : il ne part jamais du numéro WhatsApp BMI."],
    ]},

    // ── 3
    { titre: "Accès dans APP-BMI", blocs: [
      ["table", { entetes: ["Où", "Ce qu'on y trouve"], largeurs: [3100, 6200], lignes: [
        ["**☀️ Dimensionnement**, en haut", "Un bouton par **domaine** réglé dans ⚙ Paramètres (☀️ Solaire, portail, forage…), puis **« 📝 Mes brouillons (N) »**. Le volet ouvert est mémorisé : un F5 rouvre le même. Ce chapitre traite le volet **☀️ Solaire** ; les autres sont au chapitre 12."],
        ["La rangée des boutiques (compte sans boutique attitrée)", "Une pastille par boutique de l'espace regardé, puis **« Libre »**. UNE seule boutique vaut pour tous les volets, et elle est mémorisée."],
        ["**☀️ Besoins électriques du client**", "Une ligne par appareil : **Appareil · Puissance (W) · Heures/jour · Quantité · Retirer** ; **« ➕ Ajouter un appareil »** ; **« 🆕 Nouveau devis (tout effacer) »** au-delà de 5 appareils. Dessous : **Autonomie souhaitée (jours) · Ensoleillement (h/jour) · Tension du système · Type de batterie**."],
        ["Les quatre carrés", "**Consommation** (Wh/j) · **Panneaux nécessaires** (Wc) · **Batterie** (Ah, à la tension choisie) · **Convertisseur / MPPT** (kW, et l'intensité du régulateur quand le convertisseur n'est pas hybride)."],
        ["**Équipements proposés (stock de …)**", "Le tableau : **Catégorie · Article · Besoin calculé · Quantité · Prix unit. · Sous-total · HB**, pour Panneaux solaires, Batteries, Convertisseur, Régulateur MPPT ; puis Rails de fixation, Supports de rail, Étriers."],
        ["**Autres équipements (câbles, protections AC/DC, accessoires…)**", "Des lignes libres : Article · Prix unitaire (F) · Quantité · HB · Retirer ; **« ➕ Ajouter un équipement »**."],
        ["La fin du devis", "La case **« Pose seule »** ; **Remise %**, **Frais d'installation %**, **Transport / livraison %**, le **Total** ; **« 🛒 Convertir en vente »** ; **« 💰 Acompte exigé pour démarrer (%) »** et **« 🗓 Délai d'installation indicatif »**."],
        ["**📲 Envoyer ce devis au client**", "**Client destinataire** (« — Choisir — », « ➕ Nouveau client (nom + numéro) », puis les clients de l'espace) ; pour un nouveau client : **Nom du client** et **Numéro WhatsApp** ; les boutons **« 📲 Envoyer par WhatsApp »** et **« 📝 Enregistrer un brouillon »**."],
        ["Tout en bas", "La note grise du dimensionnement (réglée dans ⚙ Paramètres) : « Calcul indicatif basé sur des marges de sécurité usuelles… »."],
        ["**⚙ Paramètres** (administrateur)", "🗂 Catalogue & devis : 🔩 Prix du rail de fixation (au mètre), Longueur d'une barre (m), ☀️ Note affichée sous le dimensionnement. 🔌 Appareils : la liste des appareils proposés."],
      ]}],
    ]},

    // ── 4
    { titre: "Procédure pas à pas", blocs: [
      ["h3", "A. Noter les besoins du client"],
      ["etapes", [
        { titre: "Ouvrir ☀️ Dimensionnement → ☀️ Solaire", texte: "Vérifier la boutique de travail (la pastille allumée, ou le nom sur le cadre) : c'est **son stock** et **ses prix** qui seront proposés." },
        { titre: "Taper le premier appareil", texte: "Dans **Appareil**, taper le début du nom (« frigo », « tv », « clim »…) : la liste propose les appareils connus avec leur puissance habituelle. **Un clic sur une proposition** remplit le nom et la **Puissance (W)**. Ce qui est tapé n'est jamais transformé tout seul : un appareil hors liste se saisit librement, puissance comprise." },
        { titre: "Heures/jour et Quantité", texte: "**Heures/jour** : combien d'heures l'appareil marche dans une journée (une ampoule toute la nuit = 12, un congélateur branché en permanence = 24). **Quantité** : combien il y en a. ⚠ Demander le nombre au client : dix ampoules ne consomment pas comme une seule." },
        { titre: "Ajouter les autres appareils", texte: "**« ➕ Ajouter un appareil »** pour chaque ligne ; **« Retirer »** pour en enlever une. La puissance lue sur la plaque de l'appareil prime sur la valeur proposée : on la corrige dans la case." },
        { titre: "Régler les quatre réglages", texte: "**Autonomie souhaitée (jours)** : 1 d'office (combien de jours sans soleil la batterie doit tenir). **Ensoleillement (h/jour)** : 5 d'office. **Tension du système** : 48 V d'office (12 ou 24 V pour les petites installations). **Type de batterie** : LiFePO4 (lithium) d'office, ou Gel." },
      ]],
      ["h3", "B. Lire les quatre chiffres"],
      ["etapes", [
        { titre: "Consommation", texte: "La somme, pour chaque appareil, de puissance × heures × quantité, en **Wh par jour**." },
        { titre: "Panneaux nécessaires", texte: "La consommation divisée par les heures de soleil, **majorée de 20 % de pertes** (câbles, poussière, chaleur), en **Wc**." },
        { titre: "Batterie", texte: "La capacité du parc, en **Ah**, pour tenir l'autonomie demandée sans trop décharger : le lithium se décharge jusqu'à 90 %, le gel jusqu'à 70 %. En lithium, le calcul prend la **tension réelle** du pack (51,2 V pour un système 48 V)." },
        { titre: "Convertisseur / MPPT", texte: "**Deux fois la puissance totale** des appareils (pour les démarrages des moteurs et des compresseurs), en **kW**. Quand le convertisseur choisi n'est pas hybride, le carré dit aussi l'intensité du **régulateur MPPT** (majorée de 25 %)." },
      ]],
      ["h3", "C. Vérifier le matériel proposé"],
      ["etapes", [
        { titre: "Lire chaque ligne du tableau", texte: "Pour chaque rôle — Panneaux solaires, Batteries, Convertisseur, Régulateur MPPT — l'application a choisi un article **dans le stock de la boutique** et calculé la quantité. La colonne **Besoin calculé** rappelle ce qu'il faut couvrir." },
        { titre: "Comment elle choisit", texte: "**Panneaux et batteries** : le plus gros modèle en stock, en autant d'unités que nécessaire. **Convertisseur et régulateur** : le plus **petit** modèle qui couvre le besoin à lui seul (inutile de vendre plus gros) ; si aucun ne suffit, le plus gros en plusieurs unités. Une batterie ou un convertisseur d'une **autre tension** que le système n'est jamais proposé, ni une batterie d'un autre **type**." },
        { titre: "Changer d'article", texte: "La liste déroulante de la ligne propose les articles qui conviennent (nom, caractéristique, « — hybride » le cas échéant ; un convertisseur en VA affiche aussi ses watts utiles). Choisir un autre article recalcule la quantité ; à partir de là, **la ligne ne bouge plus toute seule** quand on change les appareils." },
        { titre: "Corriger une quantité", texte: "La case **Quantité** se corrige à la main. Pour revenir au calcul : **« Annuler (revenir à la sélection automatique) »**, qui n'apparaît que sur une ligne qui s'écarte du calcul." },
        { titre: "Un article absent du stock", texte: "**« ✏️ Saisir un article hors stock »** : Nom de l'article, Prix (F), **« Valider »**. ⚠ Un article hors stock ne fera sortir **aucun** stock à la vente : il faudra le commander." },
        { titre: "Le régulateur", texte: "Si le convertisseur est **hybride** (le mot « hybride », « hybrid » ou « MPPT » dans son nom), la ligne dit **« ✓ Intégré au convertisseur — pas d'article séparé nécessaire »**. On peut quand même en ajouter un : **« ➕ L'ajouter quand même »**." },
        { titre: "La case HB", texte: "**HB** (hors boutique) : la ligne est facturée au client, mais elle ne compte **ni dans le chiffre d'affaires ni dans les commissions** — pour un article que BMI facture sans qu'il vienne de son stock." },
      ]],
      ["h3", "D. La fixation"],
      ["etapes", [
        { titre: "Les rails, en mètres", texte: "**Panneaux × 2,2 m**, arrondi au mètre supérieur. La ligne l'écrit : « Calculé automatiquement : 4 panneaux × 2,2 m = 9 m ». Le nombre de mètres se corrige dans la case (« m »)." },
        { titre: "… vendus en barres entières", texte: "Le stock compte des **barres** (4,2 m d'office). Le client paie les **barres entamées** au prix du mètre : « → 3 barres de 4,2 m = 12,6 m facturés (chute 3,6 m) ». La colonne Prix unit. donne le prix du mètre et celui d'une barre. À la vente, le stock perd ce nombre de barres." },
        { titre: "Les supports de rail", texte: "**Un support par mètre de rail calculé** (9 m → 9 supports). Le **modèle** se choisit dans la liste, qui ne montre **que les supports** de la boutique (M8, M10…) et dit combien il y en a ; le premier est pris d'office." },
        { titre: "Les étriers", texte: "**(Panneaux × 2) + 8** (4 panneaux → 16 étriers)." },
        { titre: "Corriger ou retirer", texte: "Chaque ligne de fixation a sa case de quantité ; **0 la retire du devis** (« — retiré du devis »). Une correction tombe d'elle-même si le nombre de panneaux ou de mètres change. Supports et étriers ne sont ajoutés **que si l'article existe dans le stock** de la boutique ; sinon la ligne le dit et n'est pas facturée." },
      ]],
      ["h3", "E. Terminer le devis"],
      ["etapes", [
        { titre: "Autres équipements", texte: "Câbles, disjoncteurs, parafoudre, coffret… **« ➕ Ajouter un équipement »**. Le champ Article propose d'abord le stock de la boutique : **choisir un article du stock** remplit son prix, le lie au stock et décoche HB. **Un nom tapé qui n'est pas au stock** reste libre, et **HB se coche d'office** (on peut la décocher)." },
        { titre: "Pose seule", texte: "Si le client a **déjà acheté son matériel**, cocher **« Pose seule »** : BMI ne facture que la main d'œuvre, par un **montant fixe** saisi pour ce chantier, à la place du pourcentage d'installation." },
        { titre: "Remise, installation, transport", texte: "**Remise %** : elle ne porte que sur les **articles**. **Frais d'installation %** (10 % d'office) et **Transport / livraison %** : calculés sur le montant plein des articles. Le **Total** en découle." },
        { titre: "Acompte et délai", texte: "**Acompte exigé pour démarrer (%)** : 100 d'office (paiement comptant) ; en dessous, l'écran affiche l'acompte et le solde. **Délai d'installation indicatif** : en toutes lettres (« 15 jours ouvrés à compter de la signature »). Les deux figurent sur le devis et sur le contrat." },
      ]],
      ["h3", "F. Envoyer, garder ou vendre"],
      ["etapes", [
        { titre: "Choisir le client", texte: "**Client destinataire** : un client de la liste, ou **« ➕ Nouveau client (nom + numéro) »** avec son nom et son numéro WhatsApp. Pour un nouveau client, l'écran annonce l'identifiant et le mot de passe du compte qui sera créé." },
        { titre: "« 📲 Envoyer par WhatsApp »", texte: "Le devis est rangé dans l'**espace du client** (statut « proposé »), et le client est prévenu **du numéro WhatsApp BMI**. S'il n'a **jamais reçu ses accès**, ils partent **d'abord**, dans un message à part, puis le message du devis. S'il les a déjà (compte créé avant, accès renvoyés, autre devis), le devis part seul. → « ✅ Devis envoyé dans l'espace de X. »" },
        { titre: "Si le numéro BMI ne peut pas envoyer", texte: "(espace formation, réseau, refus de WhatsApp) : **WhatsApp s'ouvre sur l'appareil** avec le texte complet — le devis, le lien de l'espace, l'identifiant et le mot de passe. Le vendeur l'envoie lui-même. Quand ce n'est pas la formation, l'écran dit pourquoi, en français." },
        { titre: "« 📝 Enregistrer un brouillon »", texte: "Le devis tel qu'il est, avec le client choisi, **sans rien envoyer** et sans créer de compte. Il se retrouve dans **« 📝 Mes brouillons »** : **« ✏️ Reprendre »** (rouvre le volet avec tout ce qui avait été saisi), **« 📲 Envoyer par WhatsApp »** directement, ou **« Supprimer »**. Envoyé ou converti, il disparaît." },
        { titre: "« 🛒 Convertir en vente »", texte: "Pour un client qui paie **tout de suite** : le panier part dans 💰 Ventes, sur la boutique de travail, avec la remise. Rien n'est encore encaissé : l'encaissement se fait dans 💰 Ventes (chapitre 5)." },
      ]],
    ]},

    // ── 5
    { titre: "Boutons et fonctions", blocs: [
      ["table", { entetes: ["Élément", "À quoi il sert"], largeurs: [3100, 6200], lignes: [
        ["Pastille de boutique / « Libre »", "La boutique dont le stock et les prix sont proposés, pour tous les volets. **Libre** : aucune boutique, aucun prix — l'écran décrit seulement le matériel nécessaire (panneaux de 550 Wc, batteries de 314 Ah, convertisseur de taille commerciale, modifiables) pour préparer un achat ou une discussion."],
        ["Appareil (champ à propositions)", "Propose les appareils connus (liste de ⚙ Paramètres → 🔌 Appareils) ; un clic remplit nom et puissance. Une faute d'une lettre est tolérée sur les mots longs ; un mot court doit commencer un mot."],
        ["➕ Ajouter un appareil / Retirer", "Une ligne de besoin de plus, ou de moins."],
        ["🆕 Nouveau devis (tout effacer)", "Visible au-delà de 5 appareils. Après confirmation, efface appareils, équipements, rails, autres équipements, client et conditions ; **garde** autonomie, ensoleillement, tension et type de batterie. La confirmation rappelle d'enregistrer un brouillon d'abord."],
        ["Liste déroulante d'une ligne d'équipement", "Choisir un autre article du stock qui convient. « — Aucun — » retire la ligne."],
        ["✏️ Saisir un article hors stock → Valider", "Un article qui n'est pas au stock : nom et prix. Aucune sortie de stock à la vente."],
        ["Annuler (revenir à la sélection automatique)", "Rend la ligne au calcul : article et quantité recalculés, rails remis au calcul, correction de fixation effacée."],
        ["➕ L'ajouter quand même", "Ajoute un régulateur MPPT alors que le convertisseur est hybride."],
        ["HB", "Hors boutique : facturé, mais exclu du chiffre d'affaires et des commissions."],
        ["Liste des supports", "Le modèle de support (M8, M10…), parmi les seuls supports de la boutique."],
        ["Pose seule", "Remplace le pourcentage d'installation par un montant fixe de main d'œuvre."],
        ["🛒 Convertir en vente", "Envoie le panier dans 💰 Ventes pour encaissement."],
        ["📲 Envoyer par WhatsApp", "Range le devis chez le client et le prévient ; crée son compte s'il n'en a pas."],
        ["📝 Enregistrer un brouillon", "Garde le devis dans « Mes brouillons », sans rien envoyer."],
        ["📝 Mes brouillons → ✏️ Reprendre / 📲 Envoyer / Supprimer", "Reprendre dans le volet, envoyer directement, ou jeter."],
        ["Annuler la reprise (bandeau jaune)", "Abandonne la reprise d'un devis ou d'un brouillon ; l'écran revient à la saisie en cours."],
      ]}],
    ]},

    // ── 6
    { titre: "Ce qui se passe automatiquement derrière", blocs: [
      ["ul", [
        "**Rien n'est perdu au F5 ni à une mise à jour** : appareils, réglages, équipements choisis, quantités corrigées, rails, supports, autres équipements sont gardés sur l'appareil, pour ce compte et ce volet. Ce brouillon automatique s'efface quand le devis part ou est converti — jamais avant. (À ne pas confondre avec « 📝 Enregistrer un brouillon », qui range le devis dans la fiche de l'employé et le suit sur ses autres appareils.)",
        "**Le matériel se recalcule** à chaque changement d'appareil, d'autonomie, d'ensoleillement, de tension, de type de batterie ou de boutique — sauf sur les lignes choisies à la main, qui restent telles quelles jusqu'à « Annuler (revenir à la sélection automatique) ».",
        "**L'application lit le stock par le rangement et le nom** : un article rangé dans le domaine solaire et la bonne famille est reconnu quel que soit son nom ; un article non rangé est reconnu par un mot de son nom (« panneau », « batterie », « convertisseur », « onduleur », « régulateur », « MPPT »…). La puissance ou la capacité se lit **dans le nom** (« 550W », « 200AH », « 5KW », « 5000VA »).",
        "**Un convertisseur annoncé en VA** ne donne que 80 % en watts : « 5000VA » compte pour 4 000 W.",
        "**La tension d'une batterie** se lit sur sa fiche, sinon dans son nom (« 25.6V » = 24 V, « 51.2V » = 48 V). **La tension d'un convertisseur** se lit sur sa fiche ; sans elle, elle est **devinée d'après sa puissance** (jusqu'à 2,5 kW → 12 V, jusqu'à 4,5 kW → 24 V, au-delà → 48 V). Un type de batterie non écrit dans le nom est considéré comme **lithium**.",
        "**Quand aucun article ne convient**, la ligne le dit en une phrase : « Stock en 24 V, système réglé en 48 V (3 articles) », ou « N articles en stock écartés (nom illisible ou caractéristiques différentes) ».",
        "**Un devis ne touche pas le stock.** C'est l'**encaissement** dans 💰 Ventes qui fait sortir les articles liés au stock (les barres de rail comprises). Les articles hors stock et les lignes libres ne font rien sortir.",
        "**Le devis envoyé** porte les besoins du client (Wh/jour, puissance simultanée, autonomie, tension, type de batterie, liste des appareils), chaque ligne, la remise, l'installation, le transport, l'acompte, le délai, l'auteur et la boutique. Il est marqué de l'espace de sa boutique.",
        "**L'envoi du numéro BMI** coûte environ 14 F le message du devis, et à peu près autant pour le message des accès quand il part aussi (Meta l'a classé « marketing »). Rien ne part en formation.",
        "**Le prix du rail** (5 500 F le mètre d'office) et la **longueur d'une barre** (4,2 m d'office) viennent de ⚙ Paramètres ; un changement vaut pour les **prochains** devis, jamais pour ceux déjà envoyés.",
      ]],
    ]},

    // ── 7
    { titre: "Interdépendances avec les autres modules", blocs: [
      ["ul", [
        "**📦 Stocks** (chapitre 8) : le nom, la catégorie, le domaine et la tension d'un article décident s'il est proposé ici. Un article mal nommé (sans « W », « AH », « KW ») ou sans tension est la première cause d'un « Aucun article correspondant ».",
        "**💰 Ventes** (chapitre 5) : « 🛒 Convertir en vente » y envoie le panier ; l'encaissement fait sortir le stock.",
        "**📋 Tous les devis** et **📄 Contrats** (chapitres 13 et 14) : le devis envoyé y apparaît, s'y relance, s'y corrige (« Modifier et renvoyer » rouvre ce volet), se valide et devient un contrat ; son PDF porte la signature de l'auteur et le cachet.",
        "**🙋 Clients / espace client** (chapitres 3 et 21) : le compte est créé à l'envoi s'il n'existe pas ; le client voit le devis dans son espace et peut le valider.",
        "**🧲 Prospects** (chapitre 4) : « 🔆 Préparer le devis » sur une demande de l'assistant WhatsApp ouvre ce volet déjà rempli avec les appareils lus dans le besoin du client.",
        "**📲 WhatsApp** (chapitre 20) : le message du devis (et celui des accès) s'écrit dans la conversation du client.",
        "**⚙ Paramètres** (chapitre 23) : domaines, prix du rail, longueur d'une barre, note du bas d'écran, liste des appareils.",
      ]],
    ]},

    // ── 8
    { titre: "Contrôles à effectuer", blocs: [
      ["cases", [
        "La **boutique de travail** est celle d'où partira le matériel (son stock, ses prix).",
        "Chaque appareil a sa **puissance**, ses **heures** et sa **quantité** — demandées au client, jamais supposées.",
        "Les **quatre réglages** correspondent au projet : autonomie, ensoleillement, tension, type de batterie.",
        "Chaque ligne d'équipement a un **article** et une **quantité** qui ont du sens ; une ligne orange « Aucun article correspondant » est traitée (article hors stock, ou fiche du stock à corriger).",
        "Le **régulateur** n'est ajouté que si le convertisseur n'est pas hybride — ou volontairement.",
        "Les **rails, supports et étriers** sont présents, avec le bon modèle de support.",
        "Les **autres équipements** (câbles, protections) sont ajoutés ; ceux qui ne viennent pas du stock ont **HB** coché.",
        "La **remise** ne dépasse pas 3 % (sinon l'administrateur) ; l'**acompte** et le **délai** sont ceux convenus avec le client.",
        "Le **client destinataire** et son **numéro** sont justes avant « 📲 Envoyer par WhatsApp ».",
      ]],
    ]},

    // ── 9
    { titre: "Erreurs fréquentes", blocs: [
      ["table", { entetes: ["L'erreur", "Ce qui se passe", "Ce qu'il faut faire"], largeurs: [2700, 3300, 3300], lignes: [
        ["Mettre une seule ligne « ampoule » pour dix ampoules", "La consommation est dix fois trop basse : panneaux et batteries trop petits, installation qui ne tiendra pas.", "Quantité = 10. Toujours demander le nombre."],
        ["Oublier les heures d'usage", "Un appareil à 0 h ne consomme rien dans le calcul : il compte pour le convertisseur, pas pour les panneaux ni la batterie.", "Remplir Heures/jour pour chaque ligne."],
        ["« Aucun article correspondant » sur les batteries alors qu'il y en a au stock", "La ligne grise dit pourquoi : autre tension (« Stock en 24 V, système réglé en 48 V »), autre type, ou nom illisible.", "Choisir la bonne tension ou le bon type ; sinon faire corriger la fiche de l'article (nom avec « AH », tension renseignée) dans 📦 Stocks."],
        ["Un convertisseur 48 V de faible puissance n'est pas proposé", "Sans tension sur sa fiche, sa tension est devinée d'après sa puissance (1 kW → 12 V) : il est écarté d'un système 48 V.", "Renseigner la tension sur la fiche de l'article (📦 Stocks, ✏️ Corriger)."],
        ["Ajouter un régulateur alors que le convertisseur est hybride", "Le client paie un appareil dont il n'a pas besoin.", "Laisser « ✓ Intégré au convertisseur » ; n'utiliser « ➕ L'ajouter quand même » que sur demande précise."],
        ["Saisir en « hors stock » un article qui existe au stock", "Le stock ne baisse pas à la vente : le stock affiché devient faux.", "Le choisir dans la liste déroulante, ou revenir à la sélection automatique."],
        ["Remise de 5 % par un vendeur", "« 🔒 Une remise supérieure à 3 % est réservée à l'administrateur… » : rien ne part.", "Ramener à 3 % au plus, ou faire établir le devis par l'administrateur."],
        ["Envoyer sans signature enregistrée", "« Avant d'envoyer un devis, vous devez d'abord enregistrer votre signature… »", "📄 Contrats → enregistrer sa signature, une seule fois."],
        ["Envoyer au mauvais client ou au mauvais numéro", "Le devis part dans l'espace d'un autre, et le message aussi.", "Relire « Client destinataire » et le numéro avant d'envoyer ; corriger ensuite par 📋 Tous les devis (chapitre 13)."],
        ["Tout effacer avec « 🆕 Nouveau devis » par erreur", "Appareils, équipements et client disparaissent.", "Enregistrer un brouillon AVANT, comme la confirmation le rappelle."],
        ["Convertir en vente pour un client qui voulait réfléchir", "Le panier arrive dans 💰 Ventes ; rien n'est encaissé tant qu'on ne valide pas.", "Vider le panier dans 💰 Ventes et envoyer plutôt le devis."],
      ]}],
    ]},

    // ── 10
    { titre: "Cas pratiques de formation", blocs: [
      ["cas", [
        { situation: "Un client veut éclairer sa maison et garder son congélateur : 10 ampoules LED de 15 W toute la nuit, une télévision de 100 W 6 heures par jour, un congélateur de 200 W branché en permanence. Réglages d'office (1 jour, 5 h, 48 V, lithium).", reponse: "Lignes : Ampoule 15 W · 12 h · 10 ; Télévision 100 W · 6 h · 1 ; Congélateur 200 W · 24 h · 1. Les carrés : **7 200 Wh/j** ; **1 800 Wc** de panneaux ; **157 Ah** de batterie (48 V) ; convertisseur **0,90 kW** (deux fois 450 W) et, s'il n'est pas hybride, un régulateur de **44 A**." },
        { situation: "Même client, la boutique a des panneaux de 550 W.", reponse: "1 800 ÷ 550 → **4 panneaux**. Rails : 4 × 2,2 = 8,8 → **9 m** → **3 barres de 4,2 m = 12,6 m facturés** (chute 3,6 m) ; à 5 500 F le mètre, une barre vaut 23 100 F. Supports : **9**. Étriers : (4 × 2) + 8 = **16**." },
        { situation: "Le client veut deux jours d'autonomie.", reponse: "Autonomie souhaitée = 2 : la batterie double (**313 Ah**) ; les panneaux ne changent pas. Même avec 1 jour, choisir **Gel** au lieu du lithium ferait passer la batterie à **215 Ah** : le gel se décharge moins profondément et la tension de calcul est 48 V au lieu de 51,2 V." },
        { situation: "Le vendeur est en 48 V ; la ligne Batteries dit « Stock en 24 V, système réglé en 48 V (3 articles) ».", reponse: "La boutique n'a que des batteries 24 V. Soit on passe le système en 24 V (le convertisseur doit suivre), soit on garde 48 V et on saisit la batterie en **« ✏️ Saisir un article hors stock »** pour la commander." },
        { situation: "Le convertisseur proposé s'appelle « ONDULEUR HYBRIDE 5KW 48V ».", reponse: "La ligne Régulateur MPPT dit « ✓ Intégré au convertisseur » : aucun régulateur à vendre." },
        { situation: "Le client a déjà acheté ses panneaux et ses batteries ailleurs ; BMI pose seulement, pour 150 000 F.", reponse: "Cocher **« Pose seule »**, saisir 150 000 dans « Montant de la main d'œuvre » ; ne garder que les lignes réellement fournies par BMI (fixation, câbles…)." },
        { situation: "Nouveau client, jamais servi, qui n'a pas de compte.", reponse: "« ➕ Nouveau client (nom + numéro) » → Envoyer par WhatsApp. Le compte est créé ; le client reçoit **d'abord ses accès**, puis **le message du devis**, du numéro BMI." },
        { situation: "Le client hésite et rappellera demain.", reponse: "Choisir le client, **« 📝 Enregistrer un brouillon »**. Le lendemain : 📝 Mes brouillons → ✏️ Reprendre (ou 📲 Envoyer par WhatsApp directement)." },
        { situation: "Le client paie tout, tout de suite, en boutique.", reponse: "**« 🛒 Convertir en vente »** → 💰 Ventes, panier rempli → encaisser. Le stock sort à ce moment-là." },
      ]],
    ]},

    // ── 11
    { titre: "Exercice à faire par l'employé", blocs: [
      ["p", "**En espace formation**, sur une boutique de formation qui a quelques panneaux, batteries, convertisseurs, supports et étriers en stock :"],
      ["ol", [
        "Saisir les trois appareils du premier cas pratique en passant par les propositions (« ampoule », « tv », « congélateur ») ; retrouver 7 200 Wh/j et les trois autres chiffres.",
        "Passer l'autonomie à 2, puis le type de batterie à Gel : noter ce qui change dans les carrés et dans le tableau.",
        "Choisir un autre panneau dans la liste ; corriger une quantité ; puis revenir au calcul par « Annuler (revenir à la sélection automatique) ».",
        "Passer le système en 24 V et lire la ligne grise d'une ligne sans article ; revenir en 48 V.",
        "Saisir un article hors stock sur une ligne ; le retirer.",
        "Lire les rails (mètres, barres, chute), changer le modèle de support, mettre les étriers à 0 puis revenir au calcul.",
        "Ajouter deux autres équipements : l'un choisi dans le stock (HB décoché), l'autre tapé librement (HB coché d'office).",
        "Mettre une remise de 5 % avec un compte vendeur et essayer d'envoyer : lire le refus ; revenir à 3 %.",
        "Régler un acompte de 50 % et un délai ; enregistrer un brouillon pour un nouveau client ; le reprendre depuis « Mes brouillons » ; l'envoyer.",
        "Recommencer un devis et le **convertir en vente** ; vider ensuite le panier dans 💰 Ventes sans encaisser.",
      ]],
      ["note", "Le formateur vérifie surtout : l'employé **demande le nombre et les heures** de chaque appareil, **lit les quatre carrés** et sait dire d'où ils viennent, **comprend pourquoi** une ligne n'a pas d'article, et sait **revenir au calcul** après une modification."],
    ]},

    // ── 12
    { titre: "Critères de validation de la formation", blocs: [
      ["p", "La formation est validée quand l'employé, sans aide :"],
      ["cases", [
        "note les besoins d'un client complet (puissance, heures, quantité) et règle les quatre réglages ;",
        "explique les quatre carrés (consommation, panneaux, batterie, convertisseur) ;",
        "vérifie chaque ligne d'équipement, change un article, corrige une quantité et revient au calcul ;",
        "comprend et explique une ligne « Aucun article correspondant » ;",
        "lit la fixation : mètres calculés, barres facturées, supports, étriers ;",
        "termine le devis : autres équipements, pose seule, remise dans la limite, acompte, délai ;",
        "envoie un devis à un nouveau client, enregistre un brouillon et le reprend, convertit un devis en vente.",
      ]],
      ["h3", "Questions de contrôle"],
      ["questions", [
        "Comment l'application calcule-t-elle la consommation par jour ? Et la puissance du convertisseur ?",
        "Pourquoi une batterie Gel demande-t-elle plus d'ampères-heures qu'une batterie lithium ?",
        "Quand la ligne « Régulateur MPPT » dit-elle « ✓ Intégré au convertisseur » ?",
        "4 panneaux : combien de mètres de rail, de barres facturées, de supports, d'étriers ?",
        "Que veut dire la case HB, et quand se coche-t-elle toute seule ?",
        "Un devis envoyé fait-il baisser le stock ? Qu'est-ce qui le fait baisser ?",
        "Un client n'a jamais reçu ses accès : combien de messages reçoit-il à l'envoi du devis, et dans quel ordre ?",
      ]],
    ]},
  ],

  fiche: {
    criteres: [
      "Note les besoins (puissance, heures, quantité) et les quatre réglages",
      "Explique les quatre carrés du calcul",
      "Vérifie, change et corrige le matériel proposé, puis revient au calcul",
      "Explique une ligne « Aucun article correspondant »",
      "Lit rails, barres, supports et étriers",
      "Termine le devis (autres équipements, pose seule, remise, acompte, délai)",
      "Envoie un devis, enregistre et reprend un brouillon",
      "Convertit un devis en vente",
      "Répond juste aux sept questions de la rubrique 12",
    ],
  },
};
