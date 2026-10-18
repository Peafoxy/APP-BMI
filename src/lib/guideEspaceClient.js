// ============================================================
// lib/guideEspaceClient.js — LE MODE D'EMPLOI DE L'ESPACE CLIENT (18/10/2026)
//
// Capture Timo : à « tu peux aider un client à utiliser notre app
// gestion.bmitogo.com ? », l'assistant répondait « je n'ai pas ce niveau de
// détail ». Personne ne lui avait appris les écrans du client — et le juge
// jetait toute réponse portant « mot de passe » ou « identifiant ». Timo :
// « il n'a qu'à couvrir tous les aspects et écrans d'un client ».
//
// ⚠ CHAQUE MOT VIENT DES ÉCRANS : les noms des onglets et des boutons sont
// ceux de screens/EspaceClient.jsx, Connexion.jsx, Messagerie.jsx,
// MesDonnees.jsx, ContratsInstallation.jsx. Un bouton qui change de nom se
// corrige ICI aussi, sinon l'assistant guide vers un bouton qui n'existe pas.
// ⚠ JAMAIS un code, jamais un montant : le mode d'emploi dit OÙ regarder,
// il ne donne aucune donnée du client.
// Lu par le serveur : AUCUN import.
// ============================================================

export const GUIDE_ESPACE_CLIENT = {
  ensemble: [
    "🏠 Votre espace client BMI TOGO (gestion.bmitogo.com) :",
    "• « 🏠 Mon espace » : vos devis, leur validation, votre paiement, votre chantier, le parrainage et votre mot de passe.",
    "• « 💬 Messages » : écrire à nos équipes.",
    "• « 🔒 Mes données » : ce que nous conservons à votre sujet.",
    "• « 📄 Mes contrats » : apparaît une fois un devis signé.",
    "Dites-moi ce que vous voulez faire, je vous guide pas à pas.",
  ],
  connexion: [
    "🔐 Ouvrir votre espace client BMI TOGO :",
    "1️⃣ Allez sur gestion.bmitogo.com, sur votre téléphone ou votre ordinateur.",
    "2️⃣ Dans « Utilisateur », tapez l'identifiant reçu par WhatsApp du numéro BMI TOGO (en général votre nom).",
    "3️⃣ Dans « Mot de passe », tapez le code reçu dans le même message (l'œil 👁 permet de le voir), puis appuyez sur « Se connecter ».",
    "Vous arrivez sur « 🏠 Mon espace ».",
    "Vous n'avez pas reçu vos codes, ou vous les avez perdus ? Écrivez « conseiller » : je ne peux ni les voir ni vous les renvoyer.",
  ],
  valider_devis: [
    "✅ Valider votre devis :",
    "1️⃣ Dans « 🏠 Mon espace », descendez jusqu'à « 📋 Mes devis ».",
    "2️⃣ Sous votre devis, appuyez sur « ✅ JE VALIDE ».",
    "3️⃣ Lisez le contrat. Si on vous le demande, choisissez comment vous réglerez : votre choix est soumis à BMI TOGO pour accord.",
    "4️⃣ Signez avec le doigt dans le cadre « Votre signature », puis appuyez sur « ✍️ Signer et valider ».",
    "Nos équipes vous contactent ensuite pour la suite.",
    "« ✅ JE VALIDE » n'apparaît pas ? Le devis attend peut-être d'être complété après la visite, ou n'est plus d'actualité : écrivez « conseiller ».",
  ],
  modifier_devis: [
    "✏️ Le devis ne vous convient pas tout à fait ?",
    "Sous votre devis, dans « 📋 Mes devis » :",
    "• « ✏️ Demander une modification » : décrivez ce que vous voulez changer, le vendeur vous renvoie un devis corrigé.",
    "• « ❌ Rejeter ce devis » : si vous n'en voulez plus.",
    "Si c'est BMI TOGO qui souhaite modifier un devis déjà signé, vous verrez « ✏️ BMI souhaite modifier votre devis » : « ✅ J'accepte la modification » ou « ❌ Je refuse ». Une fois le devis corrigé, « ✅ J'accepte et je re-signe ».",
  ],
  paiement: [
    "💰 Le paiement :",
    "Il ne se fait pas dans l'application : il se fait à la boutique BMI TOGO indiquée sous votre devis (avec son adresse et « 🗺️ Voir l'itinéraire sur la carte »), ou au chef d'équipe sur le terrain pour une pose.",
    "Dans « 🏠 Mon espace », le cadre « 💰 Où en est votre paiement » montre ce qui a été reçu. Votre devis passe de « ⏳ Validé — en attente de votre paiement » à « ✅ Payé — installation programmée ».",
    "Chaque versement vous est confirmé par un reçu WhatsApp du numéro BMI TOGO.",
  ],
  contrat: [
    "📄 Votre contrat :",
    "Une fois votre devis signé, l'onglet « 📄 Mes contrats » apparaît en haut de l'écran : « 📄 Voir le contrat », puis « 📄 Voir le PV » après la fin des travaux.",
    "Le bouton « 📄 Télécharger mon contrat » se trouve aussi sous votre devis, dans « 🏠 Mon espace ».",
    "Le contrat n'est pas encore téléchargeable ? C'est que le paiement n'est pas encore terminé.",
  ],
  fin_travaux: [
    "🔔 La fin des travaux :",
    "Pendant le chantier, « 🏠 Mon espace » montre votre chef d'équipe et le bouton « ✉️ Écrire au chef d'équipe ».",
    "Quand l'installation est terminée, « 🔔 Votre installation est terminée » s'affiche : vérifiez l'installation, puis appuyez sur « 📄 Lire et signer le PV directement ici » (le procès-verbal de réception).",
    "Lisez-le, signez avec le doigt dans le cadre, puis appuyez sur « ✍️ Signer la réception ». Le lien de signature reçu par WhatsApp mène au même procès-verbal.",
    "Des réserves ont été notées ? Une fois corrigées, vous signerez de la même façon « 📄 Lire et signer l'avenant directement ici ».",
    "Un problème constaté ? Dites-le au chef d'équipe avant de signer, ou écrivez « conseiller ».",
  ],
  messagerie: [
    "💬 Écrire à BMI TOGO depuis votre espace :",
    "Ouvrez l'onglet « 💬 Messages » en haut de l'écran, tapez votre message dans « Votre message... » et envoyez.",
    "Nos équipes vous répondent dans l'application. Pendant un chantier, « ✉️ Écrire au chef d'équipe » ouvre la même messagerie.",
  ],
  parrainage: [
    "🤝 Parrainer un proche :",
    "Dans « 🏠 Mon espace », cadre « 🤝 Parrainez vos proches » : tapez le nom et le numéro WhatsApp de la personne, puis appuyez sur « 🤝 Parrainer ».",
    "Son espace est créé, et vous lui envoyez le message depuis votre propre WhatsApp.",
    "Quand votre filleul achète, vous recevez le pourcentage affiché dans le cadre, une fois ses travaux réceptionnés et entièrement payés. Le cadre montre « À vous verser », « En attente de réception », « Déjà reçu » et la liste « Mes filleuls ».",
  ],
  mot_de_passe: [
    "🔑 Changer votre mot de passe :",
    "Dans « 🏠 Mon espace », tout en bas, cadre « 🔑 Mon mot de passe » : appuyez sur « Changer mon mot de passe », tapez le nouveau (6 caractères au moins), puis retapez-le pour confirmer.",
    "Il servira dès votre prochaine connexion. Ne le partagez avec personne.",
    "Vous l'avez oublié ? Écrivez « conseiller » : je ne peux ni le voir ni vous le renvoyer.",
  ],
  mes_donnees: [
    "🔒 Vos données personnelles :",
    "L'onglet « 🔒 Mes données » montre ce que BMI TOGO conserve à votre sujet.",
    "« 🖨 Télécharger mes données (PDF) » vous en donne une copie.",
    "« Demander une correction » ou « Demander la suppression » prépare un message WhatsApp au numéro BMI TOGO, que vous relisez avant de l'envoyer.",
  ],
  avis_cadeau: [
    "⭐ Votre avis et 🎁 vos cadeaux :",
    "Après votre rencontre avec un vendeur, « 🏠 Mon espace » peut vous demander votre avis : choisissez une note, ajoutez un commentaire si vous voulez, puis appuyez sur « ⭐ Envoyer mon avis ». Il reste anonyme pour le vendeur.",
    "Si BMI TOGO vous offre un cadeau, « 🎁 Un cadeau vous attend ! » s'affiche en haut de « 🏠 Mon espace », avec la boutique où le récupérer.",
  ],
};

export const SUJETS_GUIDE = Object.keys(GUIDE_ESPACE_CLIENT);

// Le texte d'un sujet ; un sujet inconnu rend la vue d'ensemble (jamais rien).
export const texteGuide = (sujet) => (GUIDE_ESPACE_CLIENT[sujet] || GUIDE_ESPACE_CLIENT.ensemble).join("\n");
