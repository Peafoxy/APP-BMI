// ============================================================
// lib/contactGoogle.js — 📇 ENREGISTRER UN CLIENT WHATSAPP DANS LES
// CONTACTS GOOGLE DE BMI (09/10/2026, décision « b2 » de Timo)
//
// Timo : « faire afficher le profil quand on clique sur le nom… sur le
// profil, permettre d'enregistrer le contact sur le mail de BMI,
// bmitogo.info@gmail.com » → « a1, b2 ». « b2 » = l'application l'écrit
// DIRECTEMENT dans le compte Google, en un clic : le contact arrive aussi
// sur le téléphone BMI (si ses contacts suivent ce compte), et WhatsApp
// Business y affiche le nom.
//
// ⚠ RÈGLES PURES, SANS IMPORT : le serveur (api/contact-google.js) les lit
// telles quelles. Le réseau et les secrets n'existent QUE dans la fonction
// serveur — trois variables Vercel (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
// GOOGLE_REFRESH_TOKEN), jamais préfixées « VITE_ ».
// ⚠ L'ADMINISTRATEUR SEUL : le numéro du client sera bientôt masqué aux
// autres (« c1 », plus tard) — celui qui ne le voit pas ne l'enregistre pas.
// ============================================================

export const COMPTE_CONTACTS_BMI = "bmitogo.info@gmail.com";
export const LONGUEUR_NOM_CONTACT_GOOGLE = 80;

export const peutEnregistrerContact = (profile) => !!profile && profile.role === "admin" && profile.actif !== false;

export const nettoyerNomGoogle = (s) =>
  String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, LONGUEUR_NOM_CONTACT_GOOGLE);

// Le numéro tel que Google le range : « +228 » devant un numéro togolais à
// 8 chiffres ; un numéro déjà international garde son indicatif. Illisible → "".
export function numeroInternational(tel) {
  let c = String(tel ?? "").replace(/\D/g, "");
  if (c.startsWith("00")) c = c.slice(2);
  if (c.length === 8) return `+228${c}`;
  if (c.length >= 9 && c.length <= 15) return `+${c}`;
  return "";
}

// Deux numéros désignent la même personne sur leurs 8 derniers chiffres —
// la règle de toute l'application (`memeNumero`).
export const memeTelephone = (a, b) => {
  const x = String(a ?? "").replace(/\D/g, "").slice(-8);
  const y = String(b ?? "").replace(/\D/g, "").slice(-8);
  return x.length === 8 && x === y;
};

export function critiqueContactGoogle(profile, { nom, tel } = {}) {
  if (!peutEnregistrerContact(profile)) return "Enregistrer un contact dans le compte Google de BMI est réservé à l'administrateur.";
  if (!nettoyerNomGoogle(nom)) return "Donnez un nom au contact.";
  if (!numeroInternational(tel)) return "Ce numéro est illisible : il ne peut pas être enregistré.";
  return "";
}

// Ce que Google reçoit — le nom, le numéro, et une note qui dit d'où il vient.
export function corpsContactGoogle({ nom, tel, note = "" } = {}) {
  return {
    names: [{ unstructuredName: nettoyerNomGoogle(nom) }],
    phoneNumbers: [{ value: numeroInternational(tel), type: "mobile" }],
    ...(note ? { biographies: [{ value: String(note), contentType: "TEXT_PLAIN" }] } : {}),
  };
}

// Le contact déjà rangé chez Google qui porte ce numéro (résultat d'une
// recherche People API), sinon null — on n'en crée pas un second.
export function contactExistant(resultats, tel) {
  const liste = Array.isArray(resultats) ? resultats : [];
  for (const r of liste) {
    const p = r?.person || r;
    if ((p?.phoneNumbers || []).some((n) => memeTelephone(n?.value || n?.canonicalForm, tel))) {
      return { resourceName: p.resourceName || "", nom: p?.names?.[0]?.displayName || p?.names?.[0]?.unstructuredName || "" };
    }
  }
  return null;
}

// La trace rangée sur la fiche légère de la conversation (`wa_contact_google`).
export const traceContactGoogle = ({ nom, par, le, deja = false } = {}) => ({
  nom: nettoyerNomGoogle(nom), par: String(par || ""), le: String(le || ""), ...(deja ? { deja: true } : {}),
});

// ⚠ Les refus se disent en français. Le serveur rend un code, l'écran la phrase.
export const MOTIFS_CONTACT_GOOGLE = {
  non_configure: "L'enregistrement dans les contacts Google n'est pas encore réglé sur le serveur (accès Google à poser dans Vercel).",
  autorisation: "Google a refusé l'accès : l'autorisation du compte bmitogo.info@gmail.com a expiré ou a été retirée. Il faut la refaire.",
  google: "Google n'a pas accepté le contact.",
};
