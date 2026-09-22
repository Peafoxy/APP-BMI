// ============================================================
// LE CONTENU DU LIVRET DE FORMATION — BMI-Gestion
//
// Décision de Timo (22/09/2026) : option « c » — d'abord « ma journée »
// par métier (ce qu'on fait, dans l'ordre où on le fait), puis les écrans
// un par un, comme un dictionnaire (« comment on fait telle chose ? »).
//
// ⚠ Ce fichier ne contient que des MOTS. Il décrit l'application telle
// qu'elle est (2.101.303) — les libellés des boutons sont ceux du code.
// Quand l'application change, ce fichier change avec elle, et on refait le
// livret : `npm run livret-formation`.
//
// Forme : une liste de blocs — ["h1", texte], ["h2", …], ["h3", …],
// ["p", texte], ["ul", [lignes]], ["ol", [lignes]], ["note", texte],
// ["table", [entete, ...lignes]], ["break"]. Le **gras** s'écrit entre
// doubles étoiles.
// ============================================================

export const VERSION_LIVRET = "2.101.303";
export const DATE_LIVRET = "22 septembre 2026";

const h1 = (t) => ["h1", t];
const h2 = (t) => ["h2", t];
const h3 = (t) => ["h3", t];
const p = (t) => ["p", t];
const ul = (...l) => ["ul", l];
const ol = (...l) => ["ol", l];
const note = (t) => ["note", t];
const table = (...rows) => ["table", rows];
const brk = () => ["break"];

// Les mots exacts des onglets, tels qu'ils s'affichent dans l'application.
const T = {
  dashboard: "📊 Tableau de bord", rentabilite: "📈 Rentabilité", ventes: "💰 Ventes",
  commande: "🛒 Nouvelle commande", commandes: "📥 Commandes reçues", dimensionnement: "☀️ Dimensionnement",
  tous_devis: "📋 Tous les devis", contrats: "📄 Contrats", depenses: "📤 Dépenses",
  chez_comptable: "🧾 Chez le comptable", dettes: "🧾 Dettes", clients: "👤 Clients", caisse: "🔒 Caisse",
  stocks: "📦 Stocks", fournisseurs: "🚚 Fournisseurs", commerciaux: "🎯 Commerciaux", equipe: "👑 Équipe",
  prospects: "🧲 Prospects", parc: "🏠 Clients installés", messages: "💬 Messages", whatsapp: "📲 WhatsApp",
  salaires: "💵 Salaires (tous)", salaire: "💵 Salaire", users: "👥 Utilisateurs", historique: "🕘 Historique",
  parametres: "⚙ Paramètres", travaux: "🛠 Travaux à crédit", outillage: "🧰 Outillage",
  commission: "💵 Ma commission", taches: "✅ Mes tâches", ravitaillement: "🚚 Ravitaillement",
  nouveau_client: "🙋 Créer un client", primes_remises: "💰 Primes remises", primes_recues: "💰 Primes reçues",
  espace_client: "🏠 Mon espace", mes_donnees: "🔒 Mes données", mes_contrats: "📄 Mes contrats",
};

export const CONTENU = [
  // ───────────────────────────── COUVERTURE ─────────────────────────────
  ["cover"],

  // ───────────────────────────── AVANT-PROPOS ─────────────────────────────
  h1("Comment lire ce livret"),
  p("Ce livret explique comment se servir de **BMI-Gestion**, l'application de BMI Togo. Il est écrit pour l'équipe, pas pour des informaticiens : chaque chose y est dite avec les mots de la boutique et du chantier."),
  p("Il est en trois parties, parce qu'on ne cherche pas la même chose le premier jour et trois semaines plus tard :"),
  ul(
    "**Partie 1 — Ma journée, par métier.** Un chapitre par poste (vendeur, gérant, magasinier…). Il raconte ce que VOUS faites, dans l'ordre où vous le faites. Lisez le vôtre, et rien d'autre.",
    "**Partie 2 — Les écrans, un par un.** Un chapitre par onglet de l'application, comme un dictionnaire. Vous y cherchez « comment on fait une reprise ? » et vous trouvez.",
    "**Partie 3 — Les règles de la maison.** Qui a le droit de faire quoi, et les quelques règles d'argent que tout le monde doit connaître."
  ),
  note("Ce livret décrit l'application dans sa version " + VERSION_LIVRET + " (" + DATE_LIVRET + "). L'application se met à jour toute seule ; quand un écran change, le livret est refait."),

  // ───────────────────────────── POUR TOUS ─────────────────────────────
  h1("Avant de commencer — pour tout le monde"),

  h2("Ouvrir l'application"),
  ul(
    "Sur un ordinateur : dans le navigateur, allez sur **gestion.bmitogo.com**.",
    "Sur un téléphone : la première fois, ouvrez la même adresse puis choisissez « Ajouter à l'écran d'accueil ». L'application aura ensuite son icône BMI, comme n'importe quelle autre.",
    "L'application marche aussi **sans réseau** : ce que vous faites est gardé sur l'appareil et part tout seul dès que le réseau revient."
  ),

  h2("Se connecter"),
  ol(
    "Tapez votre **identifiant** : c'est votre nom, tel qu'il a été créé par la direction (par exemple KOSSI).",
    "Tapez votre **mot de passe**, puis « Se connecter ».",
    "La première fois sur un appareil, le téléphone demande s'il peut envoyer des **notifications** : dites oui. C'est ainsi que vous saurez qu'un message vous attend ou qu'une commande est à valider."
  ),
  note("Deux personnes peuvent porter le même nom (deux ESSO, par exemple). Ce n'est pas un problème : c'est le mot de passe qui dit qui vous êtes."),

  h2("Le verrou"),
  ul(
    "Après **10 minutes sans rien toucher**, l'écran se couvre et demande votre mot de passe. Vos données ne bougent pas, vous reprenez où vous étiez.",
    "Après **30 minutes sans rien toucher**, la session se ferme : il faut se reconnecter.",
    "Sur un téléphone avec capteur, vous pouvez ouvrir le verrou avec votre **empreinte** : dans la fenêtre du verrou, tapez votre mot de passe puis appuyez sur « Activer l'empreinte ». Ensuite, le rond de l'empreinte apparaît sous le mot de passe à chaque verrou. Si vous ne voulez pas, « Non merci » ferme la proposition pour de bon sur cet appareil.",
    "L'application ne lit jamais votre empreinte : c'est le téléphone qui compare et répond oui ou non. Rien de votre doigt n'est enregistré chez BMI."
  ),

  h2("Les onglets"),
  ul(
    "Les onglets (en bas sur le téléphone, à gauche sur l'ordinateur) dépendent de votre **poste** : un vendeur n'a pas les mêmes qu'un magasinier.",
    "Vous pouvez les **ranger dans l'ordre qui vous arrange** : tenez un onglet un demi-seconde sans bouger (il vibre et se soulève), glissez-le, relâchez. Cet ordre n'est que le vôtre.",
    "Un chiffre rouge sur un onglet (💬 Messages, 📲 WhatsApp…) dit combien de choses vous attendent."
  ),

  h2("Bleu ou violet : réel ou formation"),
  ul(
    "L'application a **deux espaces** : le **réel** (les vraies boutiques, le vrai argent) et la **formation** (pour s'entraîner sans rien casser).",
    "Quand l'écran est **bleu**, vous êtes en réel. Quand il est **violet**, vous êtes en formation.",
    "Un compte appartient à un seul espace. Un compte de formation ne voit jamais les chiffres réels, et l'inverse. Seul l'administrateur principal peut passer de l'un à l'autre.",
    "Ce qui se fait en formation ne compte pour rien : aucun message WhatsApp ne part vers un vrai client, aucun argent ne bouge."
  ),

  h2("Chercher"),
  p("Toutes les lignes de recherche de l'application obéissent à la même règle : tapez un ou plusieurs mots, dans n'importe quel ordre, sans vous soucier des accents ni des majuscules. « came » trouve « Caméra », « 90112233 » trouve le client qui a ce numéro. Une liste de propositions s'ouvre sous la ligne ; **un clic** choisit, taper ne transforme jamais ce que vous avez écrit."),

  h2("Le mot d'information"),
  p("À votre première ouverture, un petit mot vous dit ce que BMI fait de vos informations — et surtout ce qu'elle n'en fait pas. Un seul bouton, « J'ai compris ». Il ne revient plus ensuite."),

  h2("Demander de l'aide"),
  p("Dans " + T.messages + ", écrivez à votre gérant ou à la direction. Une capture d'écran vaut mieux qu'une longue explication : c'est ainsi que la plupart des améliorations de l'application sont nées."),

  // ───────────────────────────── PARTIE 1 ─────────────────────────────
  brk(),
  h1("Partie 1 — Ma journée, par métier"),
  p("Chaque chapitre suit une journée de travail. Les mots entre guillemets sont ceux des boutons de l'application. Quand un geste est détaillé dans la Partie 2, le chapitre le dit."),

  // ── VENDEUR
  h2("Je suis vendeur (ou vendeuse)"),
  p("Mes onglets : " + [T.ventes, T.commandes, T.dimensionnement, T.tous_devis, T.ravitaillement, T.depenses, T.dettes, T.clients, T.caisse, T.salaire, T.messages, T.whatsapp, T.nouveau_client, T.primes_remises, T.contrats, T.travaux].join(" · ") + "."),
  note("Le vendeur voit " + T.depenses + " en lecture : c'est le gérant qui enregistre les dépenses et les versements. Le vendeur, lui, encaisse et clôture."),
  h3("Le matin"),
  ol(
    "J'ouvre " + T.ventes + ". Si un bandeau rouge dit que **la journée d'hier n'a pas été clôturée**, je vais d'abord dans " + T.caisse + " la clôturer : sans ça, je ne peux pas encaisser aujourd'hui.",
    "Je vérifie que la **boutique** affichée en haut est la mienne. L'application se souvient de ma boutique écran par écran.",
    "Je regarde " + T.messages + " et " + T.whatsapp + " : un client a peut-être répondu pendant la nuit."
  ),
  h3("Une vente"),
  ol(
    "Dans " + T.ventes + ", « Rechercher un article » : je tape quelques lettres, la fenêtre me montre le nom, le **prix de vente** et ce qu'il reste en stock. Je choisis, je mets la quantité, « Ajouter au panier ».",
    "Je choisis ou je crée le **client** (son nom et son numéro suffisent). Un client sans compte peut aussi acheter sans être enregistré.",
    "S'il y a une **remise**, je la mets soit sur un article, soit sur le total — jamais les deux. Au-delà de 3 %, seul un administrateur peut l'accorder.",
    "Je choisis le **moyen de paiement** : Espèces, Flooz, Mixx/T-Money, Virement, ou **Crédit (dette)** avec l'avance versée aujourd'hui.",
    "« 💳 Encaisser la vente ». Le reçu apparaît : je l'imprime ou je l'envoie par WhatsApp. Une vente à crédit donne un **reçu de dette**, pas un reçu de vente.",
    "Un client qui veut d'abord un prix : « 🧾 Proforma WhatsApp ». Plus tard, « 🛒 Vendre » sur la ligne de la proforma remplit le panier tel quel."
  ),
  h3("Un client qui revient payer sa dette"),
  ol(
    "Dans " + T.dettes + ", je retrouve le client (je peux taper son nom ou son numéro).",
    "Sur sa ligne, le bouton « + Paiement » : montant, moyen de paiement. Le reçu de versement sort tout seul.",
    "Une dette qui traîne plus de 30 jours se voit en rouge. Le bouton WhatsApp envoie une **relance** au client depuis le numéro de BMI."
  ),
  h3("Un client qui veut un devis (solaire, portail, forage…)"),
  p("Je passe par " + T.dimensionnement + " : le volet **Solaire** calcule l'installation à partir des appareils du client ; **Portail** et **Autre** (vidéo surveillance, électricité, forage) listent le matériel. Je choisis le client, et « 📲 Envoyer ce devis au client ». Voir la Partie 2."),
  h3("Il manque un article"),
  p("Dans " + T.ravitaillement + ", « 🚚 Demander un ravitaillement au magasin » : je choisis l'« Article souhaité » dans le catalogue du magasin, la « Quantité », « + Ajouter », puis « 📤 Envoyer la demande ». Je n'ai rien d'autre à faire : quand le magasinier valide le bon, la marchandise arrive avec son bon de ravitaillement et **le stock de ma boutique monte à ce moment-là**. Sous l'encadré, « Mes demandes » dit où en est chacune : ⏳ En attente (je peux encore « Annuler »), ✅ Servie avec le numéro du bon, ❌ Refusée avec le motif. Quand le magasin a répondu, l'onglet affiche « 🚚 Ravitaillement (1) »."),
  h3("Le soir — clôturer le jour"),
  ol(
    "Je clôture **en dernier**, quand la boutique ferme. Une vente faite après la clôture oblige à la refaire.",
    "Dans " + T.caisse + ", « Clôturer le jour ». En tête, le bloc **« Ventes du jour — tous moyens de paiement »** : ce qui a été vendu et ce qui a été encaissé, moyen par moyen. La ligne Espèces « encaissé » est ma recette en billets.",
    "Je **compte les billets du tiroir** et je tape le total dans « Montant du tiroir ». L'application compare avec ce qu'il devrait y avoir et affiche l'écart. Le fonds de caisse (l'enveloppe du DG) n'est **pas** dans ce compte.",
    "S'il y a un écart, j'écris pourquoi dans la remarque. Je valide.",
    "Le Flooz et le Mixx **s'affichent mais ne se comptent pas** dans le tiroir : ils n'ont jamais été des billets. Leur solde se lit dans les carrés 📱 de " + T.caisse + "."
  ),
  h3("Ce que je ne fais pas"),
  ul(
    "Je ne verse pas les fonds et je n'enregistre pas de dépense : c'est le gérant.",
    "Je ne supprime rien : une vente fausse se corrige par une **reprise** (administrateur principal) ou un **retour sous garantie** (gérant)."
  ),

  // ── GÉRANT
  h2("Je suis gérant de boutique"),
  p("Mes onglets : " + [T.ventes, T.commandes, T.dimensionnement, T.tous_devis, T.stocks, T.depenses, T.dettes, T.clients, T.caisse, T.fournisseurs, T.salaire, T.messages, T.whatsapp, T.nouveau_client, T.contrats, T.travaux].join(" · ") + "."),
  p("Je fais tout ce que fait un vendeur (voir le chapitre précédent : vente, dette, devis, clôture), et en plus :"),
  h3("L'argent qui sort"),
  ol(
    "Une **dépense** (carburant, livraison, nourriture, réparation…) : dans " + T.depenses + ", « Enregistrer la dépense ». Je dis **« Payé avec »** quoi : la caisse de ma boutique, une avance personnelle (quelqu'un a payé de sa poche), de l'argent remis par le DG, ou le fonds de caisse s'il n'y a pas assez dans le tiroir. Si la dépense concerne un chantier en cours, je le choisis dans « Chantier à rattacher ».",
    "À partir de **5 000 F**, la dépense attend la **validation du DG** : elle ne compte nulle part avant, et une dépense en espèces non validée **bloque la clôture** du jour. Je fais donc valider avant la fermeture.",
    "Je ne peux pas sortir du tiroir plus qu'il ne contient (tiroir + fonds de caisse). Si ça ne suffit pas, l'application le dit et propose l'avance personnelle."
  ),
  h3("Verser les fonds"),
  ol(
    "Dans " + T.caisse + ", le carré « Fonds à verser » dit ce que le tiroir contient. Je clique « 💸 Verser les fonds ».",
    "« D'où part l'argent ? » : le tiroir (espèces), ou un compte Flooz / Mixx de la boutique.",
    "La destination : **Chez le DG** (d'office), **BANQUE** (nom de la banque et numéro de bordereau), **Chez le comptable** ; pour un compte mobile, aussi **Le tiroir de la boutique** (un retrait au guichet).",
    "Si je verse un montant différent de ce qui est attendu, je dois écrire **pourquoi**. Le versement attend ensuite la validation du DG (ou le pointage du comptable). Un versement rejeté revient dans la caisse comme s'il n'avait jamais eu lieu."
  ),
  h3("Le stock"),
  ul(
    "Dans " + T.stocks + " : « + Ajouter » un article, « + Entrée » quand la marchandise arrive, « ✏️ Corriger » une fiche, « 📋 Faire l'inventaire » puis « ✅ Valider l'inventaire ».",
    "« ⇄ Transfert » vers une autre boutique : **l'article ne bouge pas tant que l'autre boutique n'a pas validé la réception**. Et quand c'est moi qui reçois, je valide dans l'encadré « 📦 Transferts de stock à valider ».",
    "« ⚠ À réapprovisionner » liste ce qui est au seuil ou en dessous : c'est le point de départ du ravitaillement, ci-dessous."
  ),
  h3("Le ravitaillement"),
  p("Le gérant n'a pas l'onglet " + T.ravitaillement + " : il n'en a pas besoin, tout est dans " + T.stocks + ", sur sa boutique."),
  ol(
    "L'encadré « ⚠ À réapprovisionner » montre tout ce qui est au seuil ou en dessous, du plus urgent au moins urgent, avec le **manque** (seuil − reste). « 🚚 Demander ce ravitaillement » prépare la demande tout seul, avec ces articles et ces quantités ; je peux retirer une ligne ou en ajouter avant d'envoyer.",
    "Sinon, en bas de l'écran, l'encadré « 🚚 Demander un ravitaillement au magasin » : « Article souhaité » (le catalogue du magasin), « Quantité », « + Ajouter ». Une note pour le magasinier si besoin (« urgent, chantier de vendredi »). Puis « 📤 Envoyer la demande » : le magasinier et l'administrateur sont prévenus.",
    "« Mes demandes », sous l'encadré : ⏳ En attente (je peux encore « Annuler »), ✅ Servie avec le numéro du bon (RAV-…), ❌ Refusée avec le motif du magasinier.",
    "C'est **le magasinier qui valide le bon**, et c'est à cet instant que le stock quitte le magasin et entre dans ma boutique. **Je n'ai rien à valider.** Je vérifie la marchandise reçue contre le bon de ravitaillement qui l'accompagne ; s'il manque quelque chose, j'écris au magasinier dans " + T.messages + ". Un article que ma boutique n'avait pas encore est créé dans mon stock tout seul, au prix du magasin.",
    "Ensuite, une **« + Entrée »** ne se fait pas pour un ravitaillement : la quantité est déjà entrée. « + Entrée » sert quand la marchandise vient d'un fournisseur, pas du magasin."
  ),
  note("À ne pas confondre avec le **transfert de stock** entre deux boutiques (« ⇄ Transfert ») : là, c'est la boutique qui reçoit qui doit cliquer « ✅ Valider la réception », et rien ne bouge avant. Pour un ravitaillement venu du magasin, c'est le magasinier qui valide."),
  h3("Le SAV"),
  p("Un article défectueux sous garantie : sur la ligne de la vente, « 🔁 Retour / échange sous garantie ». L'échange n'est jamais une vente ; le défectueux part dans un stock SAV à part. Un **bon de retour** sort pour le client."),
  h3("Les travaux à crédit"),
  p("Pour un chantier où on avance du matériel et des frais avant de facturer (câblage, tuyauterie…) : " + T.travaux + ". J'ouvre la fiche, le magasinier ou moi sortons les articles (le stock baisse tout de suite), j'ajoute les articles HB achetés dehors, je fixe les frais de prestation, puis « 🧾 Facturer le client (vers 💰 Ventes) ». Voir la Partie 2."),

  // ── MAGASINIER
  h2("Je suis magasinier"),
  p("Mes onglets : " + [T.stocks, T.salaire, T.messages, T.whatsapp, T.nouveau_client, T.travaux, T.outillage].join(" · ") + "."),
  h3("Le stock du magasin"),
  ol(
    "Dans " + T.stocks + ", je choisis le **magasin** en haut. « + Entrée » quand une commande arrive ; « 📥 Importer un fichier Excel » pour une grosse livraison (une feuille par boutique).",
    "« 📋 Faire l'inventaire » régulièrement : je compte, je tape, « ✅ Valider l'inventaire ». Les écarts sont enregistrés, jamais effacés.",
    "L'encadré « Alertes de stock dans les boutiques » me dit ce qui manque dans chaque boutique, du plus urgent au moins urgent."
  ),
  h3("Servir les boutiques"),
  ol(
    "Une **demande de ravitaillement** arrive d'une boutique (notification « 🚚 Demande de ravitaillement »). Dans " + T.stocks + ", sur mon magasin, l'encadré « 📥 Demandes des boutiques » la montre : « 📋 Préparer le bon » charge les articles demandés dans « 🚚 Ravitailler une boutique », ou « Refuser » avec un motif que la boutique lira.",
    "Si la boutique a nommé un article autrement que moi, ou s'il est à zéro chez moi, il apparaît dans « à associer » : je dis à quel article de mon magasin il correspond (« Associer »), ou « Ignorer ».",
    "Je complète le bon s'il le faut (« Boutique à ravitailler », « Article du magasin », « Quantité », « + Ajouter au bon »), puis « ✅ Valider le ravitaillement » : **le stock quitte mon magasin et entre dans la boutique à cet instant**, le bon de ravitaillement (RAV-…) s'imprime et part avec la marchandise, la demande est marquée servie. La boutique n'a rien à valider.",
    "Je peux aussi ravitailler **sans attendre une demande** : « ⚠ Alertes de stock dans les boutiques » me dit ce qui est passé sous le seuil chez chacune.",
    "Un **transfert de stock** que je reçois : je le valide dans « 📦 Transferts de stock à valider ». Tant que je ne l'ai pas fait, l'article n'a pas bougé.",
    "« ⇄ Transfert » : j'envoie un article vers une boutique ; c'est elle qui valide."
  ),
  h3("Le matériel de travail"),
  p("Je tiens le registre de " + T.outillage + " avec le chef technicien et l'administrateur : chaque outil est **toujours sous le nom de quelqu'un**. « 📤 Sortie » quand un technicien emporte un outil (qui, pour quel chantier, retour prévu) ; « 📥 Retour » quand il revient. Une **boîte à outils** se compte au retour. Chaque semaine, je fais **l'appel** du magasin : je coche ce que j'ai sous la main. Voir la Partie 2."),
  h3("Les travaux à crédit"),
  p("Dans " + T.travaux + ", « 📦 Sortir du stock » un article pour un chantier ouvert par le gérant : je tape le nom de l'article, un clic le lie, le stock baisse tout de suite."),

  // ── COMMERCIAL
  h2("Je suis commercial (ou responsable commercial)"),
  p("Mes onglets : " + [T.commande, T.dimensionnement, T.tous_devis, T.prospects, T.parc, T.taches, T.messages, T.whatsapp, T.commission, T.equipe, T.nouveau_client, T.contrats].join(" · ") + ". Le responsable commercial a en plus " + T.salaire + "."),
  h3("Un nouveau contact"),
  ol(
    "Dans " + T.prospects + ", « Nouveau prospect » : nom, numéro, ce qu'il cherche. Je note mes visites et mes appels sur sa fiche.",
    "« 📱 Relancer » ouvre WhatsApp avec un mot prêt. Quand il achète, « ✅ Convertir en client » : sa fiche devient un compte client, rien n'est retapé.",
    "Pour écrire le premier à quelqu'un **depuis le numéro de BMI**, " + T.whatsapp + " → « ✍️ Écrire » (voir la Partie 2)."
  ),
  h3("Un devis"),
  ol(
    "Dans " + T.dimensionnement + ", je choisis le volet (Solaire, Portail, Autre), je saisis le besoin, l'application propose le matériel de la boutique choisie.",
    "Je choisis le client (ou je le crée : " + T.nouveau_client + "). « 📝 Enregistrer un brouillon » si je dois m'interrompre — je le retrouve dans « Mes brouillons ».",
    "« 📲 Envoyer ce devis au client » : le premier message d'un client part de mon téléphone avec ses identifiants ; les suivants partent du numéro de BMI.",
    "Dans " + T.tous_devis + ", je suis ce qu'il devient : ⏳ Proposé, ✅ Validé (le client a signé), 💰 Payé, ❌ Rejeté. Au bout de 15 jours sans réponse, « Relancer ». Une faute dans un devis proposé : « Modifier et renvoyer ». Un devis déjà signé ne se modifie qu'avec l'accord du client (« Demander une modification »)."
  ),
  h3("Une commande pour un client"),
  p(T.commande + " : je compose le panier pour un client et je l'envoie à la boutique (« 📤 Envoyer la commande à la boutique »). C'est la boutique qui encaisse (« ✅ Valider et encaisser »)."),
  h3("Le chantier"),
  ul(
    "Quand le client a signé et payé son acompte, le chantier apparaît dans " + T.parc + ". Le responsable commercial (ou l'administrateur) fait « 📅 Programmer l'installation » et compose l'équipe avec son chef ⭐.",
    "Je peux **supprimer** un chantier que j'ai apporté (il part à la corbeille 30 jours) et agir sur mes prospects."
  ),
  h3("Ma commission"),
  ul(
    T.commission + " montre ce qui m'est dû. Une commission n'est due qu'après **deux choses** : la réception des travaux par le client **et** le solde de sa dette. « Un franc ne sort pas de la caisse avant d'y être entré. »",
    "Un rabais que j'accorde de moi-même est pris sur ma commission, jamais au-delà."
  ),
  h3("Si je suis chef d'équipe ⭐"),
  p(T.equipe + " : je vois mes filleuls et leurs ventes, la commission d'équipe, les **apporteurs externes** à payer (« ✓ Payer » — le moyen de paiement est celui par lequel le client a payé ; « ✏️ Moyen » pour en changer), et je donne des tâches (" + T.taches + " chez eux)."),

  // ── TECHNICIEN
  h2("Je suis technicien"),
  p("Il y a deux façons d'être technicien chez BMI : **à commission** (payé par part d'installation) et **technicien BMI** (salarié). Les onglets diffèrent un peu :"),
  ul(
    "À commission : " + [T.commande, T.dimensionnement, T.tous_devis, T.prospects, T.parc, T.taches, T.messages, T.whatsapp, T.commission, T.equipe, T.nouveau_client, T.primes_recues, T.contrats, T.depenses, T.outillage].join(" · ") + ".",
    "Technicien BMI : " + [T.dimensionnement, T.tous_devis, T.parc, T.prospects, T.taches, T.equipe, T.commission, T.messages, T.whatsapp, T.salaire, T.nouveau_client, T.contrats, T.depenses, T.outillage].join(" · ") + "."
  ),
  h3("Mes chantiers"),
  ol(
    "Dans " + T.parc + ", je vois les chantiers où je suis dans l'équipe : adresse, position GPS, date prévue, ce qui est à poser.",
    "Le chef ⭐ de l'équipe fait « 🏁 Marquer terminé » quand c'est posé. Le client **réceptionne** ensuite depuis son espace (il signe le PV) — ou BMI fait le constat. C'est cette réception qui débloque les parts.",
    "Ma part d'installation apparaît dans " + T.primes_recues + " (à commission) ou " + T.commission + ". Elle m'est payée par la caisse d'une boutique ; je suis prévenu dans " + T.messages + "."
  ),
  h3("Mes dépenses de chantier"),
  p("Carburant, nourriture, petit matériel : dans " + T.depenses + " (« Mes dépenses »), j'enregistre la dépense, je dis avec quoi j'ai payé (souvent « une avance personnelle » : on me la rembourse) et je la **rattache au chantier**. Je ne vois que mes propres dépenses."),
  h3("Mes outils"),
  ul(
    "Dans " + T.outillage + " (« 🧰 Mes outils »), je vois ce que j'ai sorti, pour quel chantier, et la date de retour promise.",
    "Je change de chantier sans ramener l'outil : « 🏗 Changer le chantier ».",
    "Si je suis **en retard**, l'onglet me le compte et me demande d'écrire pourquoi. Un outil perdu se déclare au registre ; sa valeur peut être retenue sur ma part ou mon salaire, c'est l'administrateur qui décide.",
    "Une **boîte à outils** : avant de la rendre, je compte ce qu'il y a dedans (« Compter ») pour valider ce que je ramène."
  ),
  h3("Mes tâches"),
  p(T.taches + " : ce que mon chef ou la direction m'a confié, avec l'échéance. « ✅ Terminer » quand c'est fait."),
  h3("Si je suis chef des techniciens ⭐ (technicien BMI)"),
  p("J'ai " + T.equipe + " pour suivre mes hommes et leur donner des tâches, et je **tiens le registre** de " + T.outillage + " avec le magasinier : sorties, retours, appel de la semaine."),

  // ── COMPTABLE
  h2("Je suis comptable"),
  p("Mes onglets : " + [T.dashboard, T.rentabilite, T.depenses, T.chez_comptable, T.dettes, T.caisse, T.stocks, T.clients, T.historique, T.messages, T.salaire, T.nouveau_client].join(" · ") + "."),
  p("Je suis en **lecture seule** partout, sauf pour un geste qui est le mien : **pointer** ce qui passe par ma caisse."),
  ol(
    "Dans " + T.chez_comptable + ", je vois ma caisse : les versements que les boutiques m'ont remis, les dépenses payées avec ma caisse.",
    "Un versement arrivé : « ✅ Encaissé ». Une dépense que je remets : « Remis ». Ce qui attend mon pointage est dit à part.",
    "Un versement qui ne devrait pas exister : je le **rejette** avec un motif ; il revient dans la caisse de la boutique comme s'il n'avait jamais été versé.",
    "Dans " + T.dashboard + ", la pastille **🧾 COMPTABLE** donne mon relevé sur la période choisie : solde au début, entrées, sorties, solde à la fin ; « 🖨 Imprimer le relevé (PDF) » ou « Exporter (CSV) »."
  ),
  p(T.historique + " est le journal de tout ce qui a été fait, par qui et quand : c'est ma pièce à conviction."),

  // ── ADMINISTRATEUR
  h2("Je suis administrateur"),
  p("J'ai tous les onglets. L'**administrateur principal** (« moi seul », dit Timo) a en plus les gestes qui engagent la maison : mots de passe des autres, changement de rôle, bascule réel ↔ formation, plan de règlement, signature en boutique, corbeille, restauration d'une sauvegarde."),
  h3("Chaque jour"),
  ol(
    T.depenses + " : l'encadré « ⏳ Dépenses à valider par le DG » — je regarde chaque dépense de 5 000 F et plus, « ✅ Valider » ou « ✖ Rejeter » (avec un motif). Une dépense rejetée revient à 0 F et l'auteur en est prévenu.",
    T.caisse + " : les **versements à valider** (Chez le DG, BANQUE). Un versement que je rejette revient dans la caisse de la boutique.",
    T.dashboard + " : le résultat du jour (Ventes, Dépenses, Résultat, Dettes en cours), boutique par boutique, et les pastilles **👤 DG**, **🏦 BANQUE**, **🧾 COMPTABLE**, **📱 FLOOZ**, **📱 MIXX/T-MONEY** : chaque caisse en relevé, imprimable.",
    T.whatsapp + " : je vois toutes les conversations ; « 🔁 Confier » une conversation à quelqu'un, « 🔓 Rendre à tous »."
  ),
  h3("Les personnes"),
  ul(
    T.users + " : « Créer » un compte (le rôle décide des onglets ; pour un employé, un prénom), « ⋯ Gérer » (identité, paie, banque, commercial), « 🔐 Pouvoirs » (retirer un onglet ou un pouvoir), « ⛔ Bloquer ». Principal seul : « 🔑 Mot de passe », « 🎭 Rôle », « Nommer chef ».",
    T.salaires + " : les bulletins, les avances, le crédit BMI, la déclaration CNSS.",
    T.commerciaux + " : les agents commerciaux et leur taux."
  ),
  h3("Les chantiers et l'argent des équipes"),
  ul(
    T.parc + " : programmer une installation, composer l'équipe, réception forcée si le client tarde, « 🔧 Frais » (les parts des techniciens et la part BMI, après déduction des petites dépenses rattachées), primes, entretien, garantie.",
    T.equipe + " (comme chef) : payer les apporteurs externes, valider les commissions d'équipe."
  ),
  h3("Les réglages — " + T.parametres),
  p("Boutiques (fonds de caisse, comptes mobiles Flooz / Mixx, prix du rail, position GPS), banques, cachet, écran de connexion, mot de fidélité, appareils du volet solaire, domaines et familles de produits, données personnelles (dossier d'un client ou d'un employé, effacement, durée de conservation), sauvegarde de secours, corbeille, et **« 👁 Je regarde »** pour passer en formation ou en réel."),
  h3("Ce qu'il faut savoir, et dire à l'équipe"),
  ul(
    "Un changement de rôle ou de pouvoir prend effet à la **prochaine connexion** de la personne.",
    "Un compte qui fait une bêtise ne se supprime pas : on le **bloque**. Rien ne se supprime vraiment ; les chantiers supprimés attendent 30 jours dans la corbeille.",
    "La clôture bloque les ventes du lendemain ; une grosse dépense en espèces se fait valider **avant** la fermeture."
  ),

  // ── CLIENT
  h2("Le client, dans son espace"),
  p("Un client de BMI a son propre espace : " + [T.espace_client, T.messages, T.mes_donnees, T.mes_contrats].join(" · ") + ". Il se connecte avec l'identifiant et le mot de passe reçus par WhatsApp."),
  ul(
    "Dans " + T.espace_client + ", il lit ses devis, **accepte et signe** (« ✍️ Signer et valider ») — c'est la signature du contrat —, choisit son plan de règlement, suit ses paiements, et **réceptionne** son installation en signant le PV.",
    "Il peut **parrainer** un proche (« 🤝 Parrainez vos proches ») : le filleul reçoit ses identifiants depuis le téléphone du parrain.",
    "Il écrit à BMI dans " + T.messages + ", télécharge ce que BMI sait de lui dans " + T.mes_donnees + " (et peut demander une correction ou une suppression), et retrouve ses contrats et PV dans " + T.mes_contrats + "."
  ),

  // ───────────────────────────── PARTIE 2 ─────────────────────────────
  brk(),
  h1("Partie 2 — Les écrans, un par un"),
  p("Pour chaque onglet : qui l'a, à quoi il sert, les gestes, et ce qu'il faut savoir. Les onglets sont dans l'ordre où l'administrateur les voit."),

  h2(T.dashboard),
  p("**Qui** : administrateur, comptable."),
  ul(
    "En haut, une rangée de pastilles : **TOUTES**, chaque boutique, TERRAIN, puis les caisses centrales — **👤 DG**, **🏦 BANQUE**, **🧾 COMPTABLE** (réel seulement ; DG et BANQUE pour l'administrateur principal) — et **📱 FLOOZ**, **📱 MIXX/T-MONEY** dès qu'un compte mobile sert.",
    "La **période** (Aujourd'hui d'office, cette semaine, ce mois, personnalisée…) commande les cartes Ventes / Dépenses / Résultat, le graphique et la synthèse. « Dettes en cours » ne dépend pas de la période.",
    "Une caisse centrale ou mobile se lit en **relevé** : solde au début, + entrées, − sorties, solde à la fin, et la liste des mouvements. « 🖨 Imprimer le relevé (PDF) », « Exporter (CSV) ».",
    "« Exporter les données (Excel / CSV) » : ventes, dépenses, versements, stocks (classés par boutique, catégorie et urgence), journal comptable."
  ),
  note("Un versement n'est jamais une dépense : il n'apparaît pas dans les charges. Une dépense en attente de validation ne compte nulle part."),

  h2(T.rentabilite),
  p("**Qui** : administrateur, comptable. Ce que chaque article a rapporté (prix de vente moins prix d'achat), net des reprises. Par boutique et par période."),

  h2(T.ventes),
  p("**Qui** : vendeur, gérant, administrateur."),
  h3("Encaisser"),
  ol(
    "La boutique en haut. **Ne changez pas de boutique** au milieu d'une série de gestes : elle est mémorisée pour cet écran.",
    "« Rechercher un article » ouvre une fenêtre : tapez, choisissez, quantité, « Ajouter au panier ». Le prix de vente et le disponible sont sur chaque ligne ; une pompe montre ses caractéristiques.",
    "Le client : tapez son nom ou son numéro ; « 🙋 Créer un compte client » si c'est un nouveau (ses identifiants partent par WhatsApp depuis votre téléphone).",
    "La remise : par article **ou** générale, pas les deux. Au-delà de 3 % du prix : administrateur seul.",
    "Le moyen de paiement. **Crédit (dette)** demande l'avance versée aujourd'hui ; la dette est créée avec le reste.",
    "« 💳 Encaisser la vente ». Le stock baisse. Le reçu (de vente, ou de dette pour un crédit) s'imprime ou part par WhatsApp ; sur téléphone, « Partager »."
  ),
  h3("La liste des ventes"),
  ul(
    "Filtre par période (dont « ✏️ Personnaliser… », du 3 au 12), par moyen de paiement, par recherche. La **recette** affichée est celle de ce qui est affiché — filtres compris.",
    "Un clic sur une ligne la **déplie** (tous les articles). Les boutons ronds : 🖨 reçu, WhatsApp, 📋 devis lié, 🔁 Retour, ↩ Reprise, 🧾 bons.",
    "**Proformas** : « 🧾 Proforma WhatsApp » en fait une ; « 🛒 Vendre » sur sa ligne la reprend au panier (l'encaissement reste à faire). Une proforma déjà encaissée se reprend quand même, avec un avertissement.",
    "**↩ Reprise de l'article par BMI** (administrateur principal) : le client rend un article. La vente reste telle quelle, l'article revient en stock, l'argent est rendu (dépense « Remboursement client ») ou la dette diminue. Un **bon de reprise** sort.",
    "**🔁 Retour / échange sous garantie** (gérant, administrateur) : l'article défectueux est échangé ; ce n'est pas une vente. Frais éventuels en dette. Un **bon de retour** sort."
  ),
  note("Si la journée d'hier n'est pas clôturée, l'encaissement est bloqué : un bandeau le dit, et " + T.caisse + " propose de clôturer le jour manquant."),

  h2(T.commande + " et " + T.commandes),
  p("**Qui** : " + T.commande + " — commercial, technicien ; " + T.commandes + " — vendeur, gérant, administrateur."),
  ul(
    "Le commercial compose un panier pour un client et « 📤 Envoyer la commande à la boutique ».",
    "La boutique reçoit une notification, prépare, et « ✅ Valider et encaisser » : la vente est faite à ce moment-là, à la caisse de la boutique.",
    "Le stock ne bouge qu'à l'encaissement."
  ),

  h2(T.dimensionnement),
  p("**Qui** : vendeur, gérant, commercial, technicien, administrateur. Trois volets, et un devis à la fin."),
  h3("Solaire"),
  ol(
    "Ajoutez les **appareils** du client (une liste propose les plus courants avec leur puissance ; un clic pré-remplit, ce que vous tapez n'est jamais transformé). Heures d'usage, autonomie, ensoleillement, tension, type de batterie.",
    "L'application calcule le besoin (kWh/jour, kW simultanés) et propose panneaux, batteries, onduleur, régulateur **depuis le stock de la boutique choisie**, plus les rails (au mètre, vendus en barres de 4,2 m), les supports (choisissez le modèle dans la liste) et les étriers.",
    "Chaque ligne se corrige (quantité, article) ; « Annuler (revenir à la sélection automatique) » remet le calcul. Un brouillon garde tout, même après un rafraîchissement.",
    "« 🆕 Nouveau devis (tout effacer) » n'apparaît qu'au-delà de 5 appareils."
  ),
  h3("Portail"),
  p("Type de portail ou rideau, dimensions, poids, usage : l'application choisit le moteur et les accessoires ; « Autres équipements » pour le reste."),
  h3("Autre (vidéo surveillance, électricité, forage)"),
  ul(
    "Deux colonnes : **Besoin du client** (une catégorie du métier) à gauche, **Article proposé** à droite — cliquer ouvre la liste, taper la filtre.",
    "Le domaine ouvert est en tête, tout le reste du stock en dessous : aucun article n'est caché parce qu'il est rangé dans un autre métier. « ✏️ Saisir un article hors stock » pour ce que la boutique n'a pas.",
    "Forage : « 💧 Quelle pompe pour ce forage ? » — niveau dynamique (donné par le foreur), hauteur du réservoir, longueur de tuyau, besoin en litres/jour. L'application dit quelles pompes montent assez haut ; elle ne promet jamais un débit à une hauteur donnée."
  ),
  h3("Envoyer le devis"),
  ul(
    "Choisissez le client (" + T.nouveau_client + " s'il n'existe pas). « 📝 Enregistrer un brouillon » à tout moment, sans question ; « 📝 Mes brouillons » les retrouve.",
    "« 📲 Envoyer ce devis au client » : le devis apparaît dans son espace. Le **premier** message d'un nouveau client part de votre téléphone (il porte ses identifiants) ; les suivants partent du numéro de BMI, et une trace « 📲 … du n° BMI » reste sur le devis.",
    "Le PDF du devis : le besoin, l'équipement proposé, le total, acompte et solde, la validité (15 jours), la signature de BMI et le cadre « Bon pour accord »."
  ),

  h2(T.tous_devis),
  p("**Qui** : vendeur, gérant, commercial, technicien, administrateur."),
  ul(
    "Chaque devis avec son statut : **⏳ Proposé**, **✅ Validé** (signé par le client), **💰 Payé**, **❌ Rejeté**, **🔄 Corrigé**.",
    "« Relancer » quand un devis n'a pas de réponse depuis 15 jours (proposé ou validé non payé). Le message part du numéro de BMI.",
    "« Modifier et renvoyer » sur un devis proposé (celui qui l'a établi, l'administrateur, le responsable commercial). Le devis corrigé remplace l'ancien et garde une trace.",
    "Un devis **signé** ne se modifie qu'avec l'accord du client : « Demander une modification » (motif obligatoire) → le client accepte ou refuse → vous corrigez → le client re-signe ou refuse. Trois allers-retours au plus ; au-delà, on refait un devis."
  ),

  h2(T.contrats),
  p("**Qui** : vendeur, gérant, commercial, technicien, administrateur. Les contrats signés et les PV de réception, avec « 📄 Voir le PV ». La **signature en boutique** (le client signe sur l'écran de BMI) est réservée à l'administrateur principal ; d'ordinaire, le client signe depuis son espace."),

  h2(T.depenses),
  p("**Qui** : gérant, administrateur (tout) ; technicien (« Mes dépenses », les siennes seulement) ; comptable (lecture)."),
  ol(
    "« Enregistrer la dépense » : date, catégorie (Transport, Livraison, Carburant, Nourriture, Commande en Chine, Réparation d'outillage, …), description, montant, moyen de paiement.",
    "**« Payé avec »** : « La caisse de … » (chaque boutique est nommée — la dépense est enregistrée sur la boutique dont la caisse a payé), « une avance personnelle », « de l'argent remis par le DG », « la caisse du comptable » (réel), ou « Le fonds de caisse » quand le tiroir ne suffit pas.",
    "**« Chantier à rattacher »** : un chantier en cours, si la dépense lui appartient. Elle sera déduite avant le partage des frais d'installation.",
    "**5 000 F et plus** : la dépense attend le DG (encadré « ⏳ Dépenses à valider par le DG », « ✅ Valider » / « ✖ Rejeter »). Une dépense saisie par le DG lui-même est validée d'office."
  ),
  note("Une dépense en espèces payée avec la caisse et non encore validée **bloque la clôture du jour**. Faites valider avant de fermer."),

  h2(T.chez_comptable),
  p("**Qui** : administrateur, comptable. La caisse du comptable : ce que les boutiques lui ont versé, ce qu'il a remis. Le comptable pointe « ✅ Encaissé » et « Remis » ; l'administrateur lit."),

  h2(T.dettes),
  p("**Qui** : vendeur, gérant, administrateur, comptable (lecture)."),
  ul(
    "Chaque dette : le client, ce qui a été acheté, le total, le reste (en orange), le statut et l'ancienneté. Plus de **30 jours** : ⚠ rouge.",
    "« + Paiement » enregistre un versement (montant, moyen). Le **reçu** suit la règle : « Reçu de dette » tant que rien n'est versé, « Reçu de versement » ensuite, « Reçu définitif — dette soldée » à la fin.",
    "Le bouton WhatsApp **relance** le client depuis le numéro de BMI ; la trace « 📲 … » se lit sous la ligne. Une dette adossée à un plan de règlement accepté reçoit un rappel d'échéance.",
    "🗑 Supprimer : administrateur seul."
  ),

  h2(T.clients + " et " + T.nouveau_client),
  p("**Qui** : vendeur, gérant, administrateur, comptable (lecture) ; " + T.nouveau_client + " pour presque tous."),
  ul(
    T.clients + " liste les clients qui ont déjà acheté, avec leur numéro et leurs achats. Le bouton WhatsApp envoie le **mot de fidélité** de BMI.",
    "« 🙋 Créer un compte client » (ou " + T.nouveau_client + ") : nom et numéro. L'application fabrique l'identifiant et le mot de passe et ouvre WhatsApp pour les envoyer — c'est vous qui appuyez sur Envoyer.",
    "Un client sans compte peut acheter ; le compte sert à son espace (devis, contrats, PV, paiements)."
  ),

  h2(T.caisse),
  p("**Qui** : vendeur, gérant, administrateur, comptable (lecture)."),
  h3("Les carrés"),
  ul(
    "**Fonds à verser** : ce que le tiroir contient en billets (la recette ; le fonds de caisse est gardé à part). **Total versé**, **Entrées**, **Sorties**.",
    "**📱 Flooz** et **📱 Mixx/T-Money** : le solde du compte mobile de la boutique, d'après ce qui a été saisi (l'application ne parle pas à l'opérateur).",
    "**📊 RÉSUMÉ** : toutes les boutiques d'un coup, avec la période, et l'historique des versements."
  ),
  h3("Clôturer le jour"),
  ol(
    "Le bloc **« Ventes du jour — tous moyens de paiement »** : deux colonnes, **Vendu** (crédit compris) et **Encaissé** (ce qui est réellement entré, règlements de dettes compris). Elles ne s'additionnent pas.",
    "Les quatre lignes du tiroir : dans le tiroir hier soir + recette du jour − dépenses et versements − ce que la recette a rendu à l'enveloppe = **attendu dans le tiroir**.",
    "« Montant du tiroir » : ce que vous avez compté. L'écart s'affiche ; la remarque l'explique. « Clôturer le jour ».",
    "Une journée oubliée est proposée (la plus ancienne d'abord). Une vente faite **après** la clôture fait apparaître un bandeau orange : on **refait** la clôture de ce jour."
  ),
  h3("Verser les fonds (gérant, administrateur)"),
  ul(
    "« 💸 Verser les fonds » : d'où part l'argent (tiroir ou compte mobile), la destination (Chez le DG d'office, BANQUE avec bordereau, Chez le comptable, ou « Le tiroir de la boutique » pour un retrait au guichet d'un compte mobile), le montant. Un montant différent de l'attendu exige une justification.",
    "Chez le DG et BANQUE attendent la validation de l'administrateur principal ; Chez le comptable, son pointage. Un versement rejeté revient dans la caisse."
  ),
  h3("Les avances de frais"),
  p("Encadré « 💼 Avances de frais à rembourser » : ce que des employés ont payé de leur poche. Trois façons : en espèces depuis la caisse (gérant, administrateur), avec le salaire (administrateur), par le DG."),
  note("Le **fonds de caisse** est une enveloppe du DG, gardée à part : l'application y puise seulement quand le tiroir ne suffit pas pour une dépense, et les recettes suivantes la remboursent. Son montant se règle dans " + T.parametres + "."),

  h2(T.stocks),
  p("**Qui** : magasinier, gérant, administrateur (gestes) ; comptable (lecture)."),
  ul(
    "La boutique ou le magasin en haut ; la liste **Catégorie** (« Toutes » d'office) ; la recherche. La colonne Article reste figée quand on fait défiler.",
    "« + Ajouter » un article (nom, fournisseur, domaine, catégorie, quantité initiale, seuil, prix d'achat, prix de vente — les prix : administrateur). Une **pompe** porte en plus puissance, profondeur max, débit max, tension, hybride.",
    "« + Entrée » quand la marchandise arrive ; « ✏️ Corriger » une fiche ; « 🖨 Étiquette » (60 × 30 mm, code-barres).",
    "« 📋 Faire l'inventaire » → comptez → « ✅ Valider l'inventaire » : les écarts sont enregistrés.",
    "« ⇄ Transfert » vers une autre boutique : rien ne bouge tant que **la boutique qui reçoit** n'a pas validé dans « 📦 Transferts de stock à valider ». Elle peut refuser.",
    "« ⚠ À réapprovisionner » : tout ce qui est au seuil ou en dessous, du plus urgent au moins urgent ; « 🚚 Demander ce ravitaillement » prépare la demande au magasin. En bas de l'écran d'une boutique, « 🚚 Demander un ravitaillement au magasin » et « Mes demandes » (⏳ En attente / ✅ Servie / ❌ Refusée).",
    "Sur un **magasin** : « 📥 Demandes des boutiques » (« 📋 Préparer le bon » / « Refuser »), « ⚠ Alertes de stock dans les boutiques », « 🚚 Ravitailler une boutique » puis « ✅ Valider le ravitaillement » — c'est là que le stock bouge, du magasin vers la boutique, et que le bon RAV-… s'imprime. « Derniers ravitaillements depuis ce magasin » en dessous.",
    "« 📥 Importer un fichier Excel » (une feuille par boutique ; nouveaux articles ou entrées), « 📤 Exporter »."
  ),

  h2(T.ravitaillement),
  p("**Qui** : vendeur (le gérant et l'administrateur ont le même encadré en bas de " + T.stocks + "). « 🚚 Demander un ravitaillement au magasin » : « Article souhaité », « Quantité », « + Ajouter », une note si besoin, « 📤 Envoyer la demande ». « Mes demandes » suit chaque demande : ⏳ En attente (« Annuler » possible), ✅ Servie (numéro du bon), ❌ Refusée (motif)."),
  note("La boutique **ne valide rien** pour un ravitaillement : c'est le magasinier qui valide le bon, et le stock de la boutique monte à cet instant. Le bouton « ✅ Valider la réception » n'existe que pour un **transfert de stock entre deux boutiques**."),

  h2(T.fournisseurs),
  p("**Qui** : gérant, administrateur. La liste des fournisseurs et leurs coordonnées, choisis à la création d'un article."),

  h2(T.commerciaux),
  p("**Qui** : administrateur. Les agents commerciaux, leur taux de commission, actifs ou non."),

  h2(T.equipe),
  p("**Qui** : chef d'équipe ⭐ (commercial, technicien, technicien BMI), responsable commercial, administrateur."),
  ul(
    "Mes filleuls, leurs ventes et leur commission ; la **commission d'équipe** du chef (un pourcentage sur les filleuls).",
    "Les **apporteurs externes** (quelqu'un qui a amené un client sans être de BMI) : « ✓ Payer » quand la commission est due. Le moyen de paiement est **celui par lequel le client a payé**, sans question ; « ✏️ Moyen » sur sa ligne pour en changer.",
    "« Assigner une tâche » à un membre de l'équipe.",
    "Une commission n'est payable qu'après **réception des travaux et solde de la dette**."
  ),

  h2(T.prospects),
  p("**Qui** : commercial, technicien, responsable commercial, administrateur."),
  ul(
    "« Nouveau prospect » : nom, numéro, besoin, catégorie. Chaque contact (visite, appel) se note sur la fiche.",
    "« 📱 Relancer » (WhatsApp), « ✅ Convertir en client » (la fiche devient un compte, rien n'est retapé), « Réassigner » à un autre commercial (administrateur, responsable commercial, chef avec le pouvoir)."
  ),

  h2(T.parc),
  p("**Qui** : commercial, technicien, responsable commercial, administrateur. Les chantiers nés d'un devis signé, et les travaux à crédit soldés (comme trace)."),
  ul(
    "**« 📅 Programmer l'installation »** (administrateur, responsable commercial) : la date, l'équipe (cochez les techniciens, désignez le chef ⭐).",
    "**« 🏁 Marquer terminé »** : le chef du chantier ou l'administrateur.",
    "La **réception** : le client signe le PV depuis son espace ; sinon BMI fait le constat, ou la réception se fait d'office à J+7. Elle déclenche la garantie et débloque commissions et parts.",
    "**« 🔧 Frais »** (administrateur) : les parts des techniciens et la part BMI, calculées sur les frais facturés **moins** les petites dépenses rattachées au chantier. Les **primes** d'installation sont payées par la caisse d'une boutique (" + T.primes_remises + ").",
    "Aussi : la fiche du chantier (adresse, GPS, photo), l'entretien, la garantie, le cadeau, l'avenant, « 📄 Voir le PV ». Supprimer un chantier (administrateur, ou son commercial) le met 30 jours à la corbeille."
  ),

  h2(T.messages),
  p("**Qui** : tout le monde."),
  ul(
    "En haut, **🔴 Nouveaux messages** (tout ce qui porte un non-lu), puis Équipe, Groupes, Clients qui vous ont écrit, Mes clients, Support clients.",
    "Un employé écrit à un autre en privé ; « 👥 Nouveau groupe de discussion » pour une équipe. Le fil d'un client n'est lu que par l'administrateur, le technicien de son chantier et le commercial qui l'a apporté.",
    "Les messages automatiques (une dette qui passe les 30 jours, une prime à payer, une commande à valider…) arrivent ici et en notification."
  ),

  h2(T.whatsapp),
  p("**Qui** : tout le personnel sauf le comptable ; jamais un client (c'est lui qui est au bout du fil). Les conversations WhatsApp des clients avec **le numéro de BMI** (+228 99 96 84 88)."),
  ul(
    "Un client qui répond à un devis ou à une relance arrive ici, chez la personne qui lui a écrit. Un client qui écrit le premier arrive au **Support** : tout le personnel le voit, le premier disponible répond.",
    "**La fenêtre de 24 h** : WhatsApp n'accepte une réponse libre que dans les 24 h qui suivent le **dernier message du client**. Le bandeau dit le temps qui reste ; fermée, la case de saisie disparaît. Répondre ne prolonge pas la fenêtre.",
    "Fenêtre fermée : « ✍️ Lui écrire quand même » envoie un message de prise de contact (un modèle approuvé), et la conversation rouvrira quand le client répondra. « ✍️ Écrire » sert aussi à écrire le premier à quelqu'un qui n'a jamais écrit à BMI.",
    "L'administrateur peut « 🔁 Confier » une conversation à une personne (elle seule et l'administrateur la lisent ; les autres la voient grisée) et « 🔓 Rendre à tous ».",
    "Une photo, une note vocale, un document envoyés par le client s'ouvrent dans le fil (WhatsApp les garde 30 jours).",
    "En regardant l'espace **formation**, cet écran est vide : les conversations n'existent qu'en réel."
  ),

  h2(T.salaire + " et " + T.salaires),
  p("**Qui** : " + T.salaire + " — chaque salarié (le sien) ; " + T.salaires + " — administrateur."),
  ul(
    "Le salarié lit son bulletin du mois, ses avances, ses primes, son crédit BMI (« 🏦 Crédit BMI » pour en demander un), ses avances de frais à rembourser.",
    "L'administrateur établit les bulletins (« 🖨 Bulletin »), enregistre les avances, remplit la déclaration CNSS (« 🏦 CNSS — DRC ») et « 💸 Enregistrer le paiement CNSS du mois ».",
    "La fiche de paie est rangée à part : seuls l'administrateur, le comptable et l'intéressé peuvent la lire."
  ),

  h2(T.commission + ", " + T.primes_recues + ", " + T.primes_remises),
  ul(
    T.commission + " (commercial, technicien) : ce qui m'est dû et ce qui m'a été payé, vente par vente, avec la raison quand c'est bloqué (travaux pas réceptionnés, dette pas soldée).",
    T.primes_recues + " (technicien à commission) : mes parts d'installation.",
    T.primes_remises + " (vendeur) : les demandes de paiement de prime adressées à la caisse de ma boutique ; « ✅ Valider » fait la vraie sortie de caisse et prévient le technicien."
  ),

  h2(T.taches),
  p("**Qui** : commercial, technicien, responsable commercial. Ce qui m'a été confié, avec l'échéance ; « ✅ Terminer » quand c'est fait. Le chef assigne depuis " + T.equipe + "."),

  h2(T.users),
  p("**Qui** : administrateur."),
  ul(
    "« Créer » : le rôle (il décide des onglets), le nom (c'est l'identifiant), le prénom pour un employé, le numéro, la boutique. Le mot de passe de départ part par WhatsApp.",
    "Sur chaque ligne : « 🔐 Pouvoirs » (retirer un onglet ou un pouvoir), « ⚠ Identité », « ⛔ Bloquer » / « ✅ Réactiver », et « ⋯ Gérer » (Compte, Paie, Commercial, Client : banque, numéro, taux, chef d'équipe…).",
    "Administrateur principal seul : « 🔑 Mot de passe », « 🎭 Rôle », « Nommer chef ».",
    "Un identifiant d'employé ne se prend pas deux fois : l'application propose un nom libre."
  ),

  h2(T.historique),
  p("**Qui** : administrateur, comptable. Le journal : chaque geste, par qui, quand. Rien ne s'y efface."),

  h2(T.parametres),
  p("**Qui** : administrateur (certains réglages : administrateur principal)."),
  ul(
    "**Boutiques** : ajouter une boutique, 💼 fonds de caisse (le nouveau montant ; le DG apporte ou reprend la différence), 📱 comptes mobiles (numéros Flooz et Mixx), 🔩 prix du rail au mètre et longueur de barre, 📌 position GPS, 🏦 banques.",
    "**Apparence** : 🎉 écran de connexion, 🏷️ cachet BMI Togo, 💬 mot de fidélité, ☀️ note sous le dimensionnement.",
    "**Catalogue** : 🗂 domaines de produits et leurs familles, 🔌 appareils proposés dans le volet solaire, 🗂 à classer.",
    "**Personnes** : 🤝 taux de parrainage, 👑 administrateur principal.",
    "**🔒 Données personnelles** (principal) : le dossier d'un client ou d'un employé (PDF, CSV), l'effacement d'un client (les factures restent, sans son nom), ⏳ la durée de conservation (6 ans après le dernier achat).",
    "**👁 Je regarde** (principal) : passer en formation ou en réel. **💾 Sauvegarde de secours**, 🔁 synchronisation forcée, 🗑 corbeille, 🔐 sécurité."
  ),

  h2(T.travaux),
  p("**Qui** : administrateur, gérant, vendeur, magasinier. Un chantier qu'on exécute en avançant matériel et frais, facturé à la fin."),
  ol(
    "« Ouvrir les travaux » (gérant, administrateur) : le client, la boutique, l'équipe.",
    "« 📦 Sortir du stock » (magasinier, gérant, administrateur) : tapez le nom de l'article, un clic le lie ; **le stock baisse tout de suite**, au prix de la boutique. « + Ajouter l'article HB » pour ce qui est acheté dehors (prix payé, prix facturé).",
    "« ✏️ Fixer les frais de prestation » : en pourcentage de tous les articles, ou un montant. Les petites dépenses rattachées (carburant, nourriture) entrent dans le coût.",
    "« 🧾 Facturer le client (vers 💰 Ventes) » : le panier part dans Ventes, l'encaissement se fait là (espèces ou crédit avec avance). Le reçu et la dette reviennent sur la fiche.",
    "Quand le client a tout payé, la fiche quitte l'onglet et reste comme trace dans " + T.parc + " (« 🛠 Travaux soldés »)."
  ),

  h2(T.outillage),
  p("**Qui tient le registre** : le chef technicien ⭐, le magasinier, l'administrateur. **Tout technicien** a l'onglet, sous le nom « 🧰 Mes outils », et n'y voit que ce qu'il détient."),
  ul(
    "Un outil est **toujours sous le nom de quelqu'un** : rangé dans un lieu (boutique ou magasin), ou sorti chez une personne, ou en réparation, ou perdu, ou hors d'usage. Cinq carrés : Outils, Dehors, En retard, En réparation, Perdus / Hors d'usage — chacun s'ouvre.",
    "« ➕ Ajouter un outil » (administrateur) : le numéro gravé s'attribue tout seul (BMI-001, BMI-002…). Une **boîte à outils** se déclare à la création, avec sa liste.",
    "**📤 Sortie** : un ou plusieurs outils, qui les prend, pour quel chantier, retour prévu. La personne reçoit un message.",
    "**📥 Retour** : bon état ou abîmé, où il est rangé. Une boîte se **compte** au retour ; ce qui manque devient une perte.",
    "**🏗 Changer le chantier** sans ramener l'outil (le détenteur ou le registre). **⏱ Retard** : le détenteur explique pourquoi dans son onglet.",
    "**Perdu** : motif obligatoire, valeur ; l'administrateur peut poser une retenue (sur le salaire, ou sur la prochaine part d'installation). **Réparation** : réparateur, panne, prix — le prix devient une dépense.",
    "**📋 L'appel** : chaque semaine, chaque boutique et le magasin cochent ce qu'ils ont sous la main ; ce qui n'est pas coché se voit."
  ),

  h2(T.espace_client + ", " + T.mes_donnees + ", " + T.mes_contrats),
  p("**Qui** : le client. Voir « Le client, dans son espace » en Partie 1."),

  // ───────────────────────────── PARTIE 3 ─────────────────────────────
  brk(),
  h1("Partie 3 — Les règles de la maison"),

  h2("Qui a le droit de faire quoi"),
  p("L'application revérifie chaque geste au moment où on le fait, et la base de données aussi. Les grandes lignes :"),
  table(
    ["Geste", "Qui"],
    ["Encaisser une vente, clôturer le jour", "Vendeur, gérant, administrateur"],
    ["Enregistrer une dépense, verser les fonds", "Gérant, administrateur"],
    ["Valider une dépense de 5 000 F et plus, valider un versement", "Administrateur principal (le DG)"],
    ["Pointer un versement ou une remise dans sa caisse", "Comptable"],
    ["Articles, entrées, inventaire, transferts", "Magasinier, gérant, administrateur"],
    ["Prix d'achat, prix de vente, quantité initiale", "Administrateur"],
    ["Remise au-delà de 3 %", "Administrateur"],
    ["Retour sous garantie", "Gérant, administrateur"],
    ["Reprise d'un article par BMI", "Administrateur principal"],
    ["Supprimer une vente, une dette, une dépense, un article, un compte", "Administrateur"],
    ["Programmer une installation, composer l'équipe", "Administrateur, responsable commercial"],
    ["Marquer un chantier terminé", "Le chef du chantier, administrateur"],
    ["Payer une commission, un apporteur, assigner une tâche", "Chef d'équipe ⭐, responsable commercial, administrateur"],
    ["Tenir le registre de l'outillage", "Chef technicien ⭐, magasinier, administrateur"],
    ["Mot de passe d'un autre, changer un rôle, formation ↔ réel, corbeille, sauvegarde", "Administrateur principal"]
  ),

  h2("Les règles d'argent que tout le monde connaît"),
  ul(
    "**Un versement n'est jamais une dépense.** Il ne sort de la caisse que pour aller chez le DG, à la banque ou chez le comptable.",
    "**Une dépense de 5 000 F et plus attend le DG.** En attendant, elle ne compte nulle part, et si elle est en espèces sur la caisse, la clôture est bloquée.",
    "**On ne sort pas du tiroir plus qu'il ne contient.** La limite est le tiroir plus ce qui reste dans l'enveloppe du fonds de caisse.",
    "**La clôture du jour se fait en dernier**, et la journée d'hier doit être clôturée pour vendre aujourd'hui.",
    "**L'écart de la clôture ne regarde que les billets.** Flooz, Mixx et virements s'affichent, mais ne se comptent pas dans le tiroir : leur solde se lit dans les carrés 📱.",
    "**Une commission n'est due qu'après la réception des travaux et le solde de la dette.** Parrain, apporteur externe, commercial, technicien : même règle.",
    "**Une remise par article ou une remise générale, jamais les deux.** Au-delà de 3 % : administrateur.",
    "**Rien ne se supprime vraiment.** Une vente fausse se corrige par une reprise ; un chantier supprimé attend 30 jours à la corbeille ; un mouvement d'outil ne s'efface jamais."
  ),

  h2("Réel et formation"),
  ul(
    "Bleu = réel, violet = formation. Un compte appartient à un seul espace.",
    "Ce qu'on crée naît dans l'espace qu'on regarde.",
    "En formation, aucun message WhatsApp ne part vers un vrai client, aucune conversation ne s'affiche, aucun argent réel ne bouge.",
    "Seul l'administrateur principal change d'espace (« 👁 Je regarde »), et l'écran change de couleur pour le lui rappeler."
  ),

  h2("Vos informations, et celles des clients"),
  ul(
    "BMI ne vend ni ne donne les informations de personne. Elles servent à tenir les livres, les contrats et le service après-vente.",
    "Un client peut demander ce que BMI sait de lui (" + T.mes_donnees + "), une correction, ou l'effacement de son nom (les factures restent, la loi l'exige). Un employé le demande à la direction.",
    "Votre mot de passe n'est écrit nulle part en clair. Votre empreinte n'est jamais lue par l'application.",
    "Les données d'un client sont gardées 6 ans après son dernier achat. Rien ne s'efface tout seul : l'administrateur confirme."
  ),

  h2("En cas de problème"),
  ul(
    "**« La base refuse la ligne »** ou un geste qui reste en attente : votre appareil garde le geste et réessaie. Si le message persiste, envoyez une capture à la direction.",
    "**Écran blanc** ou application figée : rechargez la page (F5 sur ordinateur, tirer vers le bas sur téléphone). Vos données ne sont pas perdues.",
    "**Mot de passe oublié** : l'administrateur principal peut le changer dans " + T.users + ".",
    "**Session expirée** : 30 minutes sans rien toucher ; reconnectez-vous.",
    "**Quelque chose ne colle pas** (un chiffre, un mot, un bouton) : dites-le. Plusieurs corrections importantes sont parties d'une capture d'écran de l'équipe."
  ),
];
