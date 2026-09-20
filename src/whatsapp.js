// ============================================================
// src/whatsapp.js — LE SEUL CHEMIN D'UN MESSAGE WHATSAPP
//
// Timo, 19/09/2026 : « lance l'étape 1 » — le message part du numéro BMI
// sans que personne n'ouvre WhatsApp, et la trace reste sur le devis.
//
// ⚠⚠ UN SEUL CHEMIN, comme `src/push.js` pour les notifications. Aucun
// écran n'appelle `whatsappEnLigne` ; ils appellent TOUS `envoyerModele`
// ci-dessous, et le banc l'impose. Sans cette règle, un écran oublierait le
// mur de la formation, ou le repli — et personne ne le verrait avant qu'un
// client de formation reçoive un vrai message.
//
// ⚠⚠ RIEN N'EST JAMAIS PERDU EN SILENCE. Tout refus, toute panne, tout
// numéro illisible RAMÈNE le bouton WhatsApp d'aujourd'hui, avec son texte
// complet. C'est la règle du 08/09/2026 (« si le navigateur bloque
// l'ouverture, on le DIT »), poussée d'un cran : ici c'est l'envoi
// automatique qui peut manquer, et le vendeur doit pouvoir finir à la main.
//
// ⚠ PAS DE FILE D'ATTENTE, et c'est VOULU — contrairement aux notifications.
// Une notification qui arrive avec deux heures de retard reste juste. Une
// relance de devis partie trois jours plus tard, alors que le client est
// déjà passé payer, est une faute. Hors ligne, on ouvre WhatsApp tout de
// suite : la personne voit, décide, envoie.
// ============================================================
import { envoyerWhatsApp } from "./lib/core";
import { critiqueEnvoiAuto, motifEchecWhatsApp } from "./lib/whatsappModeles";

const enLigne = () => typeof navigator === "undefined" || navigator.onLine !== false;

// Rend { auto, parti, motif, id } :
//   auto  — vrai si le message est parti tout seul, du numéro BMI ;
//   parti — vrai si le client a reçu quelque chose, d'une façon ou d'une
//           autre (c'est LUI que l'écran regarde avant d'écrire sa trace) ;
//   motif — pourquoi l'envoi automatique n'a pas eu lieu, en français.
//
// `texteRepli` est le message d'aujourd'hui, mot pour mot : on ne le
// remplace pas, on le garde sous la main.
export async function envoyerModele({ tel, modele, variables, espaceFormation, premierContact, texteRepli, demanderConfirmation }) {
  const repli = async (motif) => ({
    auto: false,
    motif,
    parti: await envoyerWhatsApp(tel, texteRepli, demanderConfirmation),
  });

  const refus = critiqueEnvoiAuto({ modele, variables, tel, espaceFormation, premierContact, enLigne: enLigne() });
  if (refus) return repli(refus);

  let reponse;
  try {
    // ⚠ CHARGÉ AU MOMENT DE L'ENVOI, jamais au chargement de l'écran.
    // `supabaseClient` lit `import.meta.env` dès qu'il est importé : un
    // écran qui l'entraîne dans sa suite ne peut plus être monté par le
    // banc (esbuild + Node), et un écran que le banc ne peut pas monter
    // est un écran blanc en puissance (leçon du 19/09/2026). Le message
    // n'en part pas moins vite : personne ne clique en moins d'une seconde.
    const { whatsappEnLigne } = await import("./supabaseClient");
    reponse = await whatsappEnLigne({ tel, modele, variables });
  } catch (e) {
    return repli(motifEchecWhatsApp({ erreur: e?.message }));
  }
  if (!reponse || reponse.error) {
    // ⚠ LE REFUS DE WHATSAPP ARRIVE EN ANGLAIS : `motifEchecWhatsApp` le
    // traduit quand il le reconnaît, et le laisse entier quand il ne le
    // reconnaît pas (on n'invente jamais une explication). La phrase
    // d'origine part TOUJOURS dans la console — pour dépanner, jamais à
    // l'écran : le diagnostic affiché a déjà été retiré une fois (Timo,
    // 16/09/2026, « je n'aime plus voir ça »).
    if (reponse?.error) console.info("[whatsapp] refus :", reponse.error, reponse.code_whatsapp || "");
    return repli(motifEchecWhatsApp({ statut: reponse?.statut, erreur: reponse?.error, code: reponse?.code_whatsapp }));
  }
  return { auto: true, parti: true, motif: "", id: reponse.id || "" };
}

// ---------------------------------------------------------------
// 💬 RÉPONDRE À UN CLIENT DANS LA FENÊTRE DE 24 H (étape 2, 20/09/2026)
// ---------------------------------------------------------------
// ⚠ AUCUN REPLI ICI, et c'est VOULU — au contraire d'un modèle. Une
// relance qui n'est pas partie du numéro BMI peut finir à la main : le
// texte est le même, le client reçoit la même chose. Une RÉPONSE, non :
// elle doit arriver DANS la conversation WhatsApp qu'il a ouverte, sous
// le numéro BMI. L'ouvrir sur le téléphone du vendeur ferait partir le
// message d'un AUTRE numéro, et le client ne saurait pas qui lui écrit.
// Donc : ça part, ou ça ne part pas et on DIT pourquoi.
export async function repondreWhatsApp({ tel, texte }) {
  if (!enLigne()) return { parti: false, motif: "Pas de connexion : le message ne peut pas partir du numéro BMI." };
  let reponse;
  try {
    const { whatsappEnLigne } = await import("./supabaseClient");
    reponse = await whatsappEnLigne({ tel, texte });
  } catch (e) {
    return { parti: false, motif: motifEchecWhatsApp({ erreur: e?.message }) };
  }
  if (!reponse || reponse.error) {
    if (reponse?.error) console.info("[whatsapp] refus :", reponse.error, reponse.code_whatsapp || "");
    return { parti: false, motif: motifEchecWhatsApp({ statut: reponse?.statut, erreur: reponse?.error, code: reponse?.code_whatsapp }) };
  }
  return { parti: true, motif: "", id: reponse.id || "" };
}

// ---------------------------------------------------------------
// 📷 OUVRIR UN FICHIER REÇU (photo, note vocale, document) — 20/09/2026
// ---------------------------------------------------------------
// ⚠ MÊME RÈGLE QUE LE RESTE DU FICHIER : un seul chemin. L'écran n'appelle
// pas le serveur lui-même, il passe par ici — et le banc l'impose.
// ⚠ La clé YCloud n'est pas dans le navigateur : c'est la fonction serveur
// qui va chercher le fichier chez WhatsApp, après avoir revérifié que cette
// personne a le droit de voir cette conversation.
export async function chargerMediaWa(messageId) {
  if (!enLigne()) return { url: "", motif: "Pas de connexion : le fichier ne peut pas être ouvert." };
  let reponse;
  try {
    const { mediaWaEnLigne } = await import("./supabaseClient");
    reponse = await mediaWaEnLigne(messageId);
  } catch (e) {
    return { url: "", motif: `Serveur injoignable : ${e?.message || e}` };
  }
  if (!reponse || reponse.error || !reponse.blob) {
    return { url: "", motif: reponse?.error || "Fichier indisponible." };
  }
  return { url: URL.createObjectURL(reponse.blob), motif: "" };
}
