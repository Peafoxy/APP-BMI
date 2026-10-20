// ============================================================
// api/_ycloud.js — LA PORTE VERS YCLOUD, ÉCRITE UNE FOIS (24/09/2026)
//
// Avant l'assistant, un seul fichier envoyait au numéro BMI (api/whatsapp.js).
// L'assistant (api/whatsapp-entrant.js) envoie lui aussi : la clé, l'adresse
// et la lecture du refus de Meta vivent donc ICI, et nulle part ailleurs —
// deux appels recopiés finiraient par lire le refus de deux façons.
//
// ⚠⚠ LA CLÉ YCLOUD NE VIT QUE DANS UNE VARIABLE VERCEL (`YCLOUD_API_KEY`),
// JAMAIS préfixée « VITE_ » (Vite l'embarquerait dans le paquet du
// navigateur). Elle n'est lue que par les fonctions serveur.
// ============================================================
export const URL_YCLOUD = "https://api.ycloud.com/v2/whatsapp/messages";

// Le numéro expéditeur, nettoyé comme `numeroWhatsApp` (whatsappModeles.js)
// le fait côté application — on ne l'importe pas ici pour garder ce
// fichier sans dépendance ; l'appelant passe le numéro déjà nettoyé.
export function configYCloud() {
  return { cle: process.env.YCLOUD_API_KEY || "", expediteurBrut: process.env.WHATSAPP_NUMERO_BMI || "" };
}

// Envoie un corps YCloud (texte libre ou modèle). Rend
//   { ok: true, id, statut }  ou  { ok: false, motif, statut_whatsapp, code_whatsapp }
// ⚠ Le motif de WhatsApp est rendu TEL QUEL, avec son CODE : c'est
// `traduireMotifWhatsApp` (application) qui le dit en français.
export async function envoyerYCloud(cle, corps) {
  const reponse = await fetch(URL_YCLOUD, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": cle },
    body: JSON.stringify(corps),
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const motif = resultat?.error?.message || resultat?.message || `WhatsApp a répondu ${reponse.status}.`;
    const code = resultat?.error?.code ?? resultat?.code ?? "";
    return { ok: false, motif, statut_whatsapp: reponse.status, code_whatsapp: code };
  }
  // Le numéro de suivi (`id`, et le `wamid` de Meta) sert aux COCHES
  // (lib/suiviEnvoi.js, 26/09/2026) : Meta prévient ensuite par ce numéro.
  return { ok: true, id: resultat?.id || "", wamid: resultat?.wamid || "", statut: resultat?.status || "envoye" };
}

export const corpsTexte = (expediteur, destinataire, texte) =>
  ({ from: expediteur, to: destinataire, type: "text", text: { body: texte } });

// ---------------------------------------------------------------
// 📎 UN FICHIER ENVOYÉ AU CLIENT (03/10/2026)
// ---------------------------------------------------------------
// Deux temps, comme chez Meta : le fichier est d'abord DÉPOSÉ chez WhatsApp
// (il rend un numéro de fichier, gardé 30 jours chez lui), puis le message
// part en citant ce numéro. ⚠ Rien n'est rangé chez nous.
// ⚠ LA FORME EXACTE DE CET APPEL N'A PAS PU ÊTRE VÉRIFIÉE D'ICI (le site de
// YCloud est fermé depuis le poste de travail) : c'est celle de leur API
// publique telle qu'on la connaît. Un refus est rendu TEL QUEL, avec son
// statut, et part dans le journal du serveur : le premier vrai envoi dira
// si la forme est juste.
export const urlTeleversement = (expediteur) =>
  `https://api.ycloud.com/v2/whatsapp/media/${encodeURIComponent(expediteur)}/upload`;

export async function televerserYCloud(cle, expediteur, { octets, mime, nom }) {
  const formulaire = new FormData();
  formulaire.append("file", new Blob([octets], { type: mime || "application/octet-stream" }), nom || "fichier");
  const reponse = await fetch(urlTeleversement(expediteur), {
    method: "POST",
    headers: { "X-API-Key": cle },
    body: formulaire,
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok || !resultat?.id) {
    const motif = resultat?.error?.message || resultat?.message || `WhatsApp n'a pas accepté le fichier (${reponse.status}).`;
    console.error("[whatsapp] dépôt du fichier refusé", reponse.status, JSON.stringify(resultat).slice(0, 300));
    return { ok: false, motif, statut_whatsapp: reponse.status, code_whatsapp: resultat?.error?.code ?? resultat?.code ?? "" };
  }
  return { ok: true, id: String(resultat.id) };
}

// ---------------------------------------------------------------
// 🎤 RÉÉCOUTER UNE NOTE VOCALE QUE BMI A ENVOYÉE (20/10/2026, « b »)
// ---------------------------------------------------------------
// Timo : « Impossible de relire nos propres vocaux » → « b » : le son n'est
// pas rangé chez nous (décision du 20/09/2026), on va le rechercher chez
// WhatsApp par le NUMÉRO que le dépôt a rendu (gardé 30 jours chez lui).
// ⚠⚠ LA FORME DE CET APPEL N'A PAS PU ÊTRE VÉRIFIÉE D'ICI (le site de YCloud
// est fermé depuis le poste de travail). Le lien d'un fichier REÇU a la forme
// `…/v2/whatsapp/media/download/{id}?sig=…` : on essaie cette adresse avec la
// clé, puis la fiche du fichier (`…/media/{id}`), qui peut rendre un lien à
// suivre. Chaque refus part dans le journal du serveur avec son statut : le
// premier vrai essai dira laquelle est juste. Quatre appels au plus.
export const urlsMediaEnvoye = (id) => [
  `https://api.ycloud.com/v2/whatsapp/media/download/${encodeURIComponent(id)}`,
  `https://api.ycloud.com/v2/whatsapp/media/${encodeURIComponent(id)}`,
];

const estJson = (reponse) => /json/i.test(reponse.headers.get("content-type") || "");

export async function telechargerMediaEnvoye(cle, id) {
  const statuts = [];
  for (const url of urlsMediaEnvoye(id)) {
    const reponse = await fetch(url, { headers: { "X-API-Key": cle } });
    if (!reponse.ok) { statuts.push(reponse.status); console.info("[whatsapp-media] fichier envoyé refusé", reponse.status, url.slice(0, 70)); continue; }
    if (!estJson(reponse)) return { ok: true, reponse };
    // Une fiche du fichier : elle porte peut-être le lien à suivre.
    const fiche = await reponse.json().catch(() => ({}));
    const lien = String(fiche?.url || fiche?.link || fiche?.downloadUrl || "");
    if (!lien) { statuts.push("fiche-sans-lien"); console.info("[whatsapp-media] fiche sans lien", JSON.stringify(fiche).slice(0, 200)); continue; }
    const suite = await fetch(lien, { headers: { "X-API-Key": cle } });
    if (suite.ok && !estJson(suite)) return { ok: true, reponse: suite };
    statuts.push(suite.status);
    console.info("[whatsapp-media] lien de la fiche refusé", suite.status);
  }
  return { ok: false, statuts };
}

// Le message qui cite le fichier déposé. Un son ne porte pas de phrase
// (Meta la refuserait) ; un document porte son nom, que le client verra.
// 📎 L'EN-TÊTE DOCUMENT d'un modèle (17/10/2026, `devis_pdf`) : le fichier
// déjà déposé, cité par son numéro, avec le nom que le client verra.
// Forme de Meta (template « header » → « document » { id, filename }),
// CONFIRMÉE par un vrai devis le 17/10/2026 (Timo : « le PDF est bien
// arrivé »). Un refus revient tel quel (le devis repart alors sans PDF).
export const composantDocument = (id, nom) =>
  ({ type: "header", parameters: [{ type: "document", document: { id, ...(nom ? { filename: nom } : {}) } }] });

// 🎤 `vocal` (20/10/2026) : une note vocale .ogg / Opus porte `voice: true`
// (documentation de Meta) — sans lui, WhatsApp la montre comme un simple son.
export function corpsMedia(expediteur, destinataire, { type, id, legende, nom, vocal = false }) {
  const bloc = { id };
  if (vocal && type === "audio") bloc.voice = true;
  if (legende && type !== "audio") bloc.caption = legende;
  if (type === "document" && nom) bloc.filename = nom;
  return { from: expediteur, to: destinataire, type, [type]: bloc };
}
