// ============================================================
// src/lib/vocauxStockes.js — 🎤 LES NOTES VOCALES ENVOYÉES PAR BMI, RANGÉES
// 30 JOURS DANS L'ESPACE DE FICHIERS PRIVÉ DE SUPABASE (21/10/2026)
// ============================================================
// Timo : « si un utilisateur de BMI envoie un vocal à un client… l'application
// ne peut pas reprendre le vocal et le renvoyer à toute l'équipe ? », puis
// « AVEC l'espace de fichiers privé de Supabase, il faut lancer pour 30 jours ».
// Il rouvre lui-même la décision du 20/09 (« on ne range pas de fichiers ») :
// pour les seules notes vocales ENVOYÉES par BMI. Rien d'autre n'y entre — ni
// photo, ni PDF, ni fichier reçu d'un client (ceux-là restent chez WhatsApp).
//
// Règles pures, SANS import (lues par le serveur comme par l'écran) :
//   - le CHEMIN d'une note : « AAAA-MM-JJ/<clé de la conversation>_<hasard>.ext ».
//     Le jour en tête permet d'effacer un jour entier d'un coup ; la clé de la
//     conversation (8 chiffres) permet au serveur de vérifier qu'une ligne ne
//     cite JAMAIS la note d'une autre conversation ;
//   - 30 jours, puis la note n'est plus rendue, et la tournée de 7 h l'efface.
// ⚠ L'espace est PRIVÉ : aucune règle ne l'ouvre aux appareils. Seul le serveur
// (la clé du serveur, variable Vercel) y range et y lit, APRÈS avoir revérifié
// que la personne peut voir la conversation (api/whatsapp-media.js).
// ============================================================

export const ESPACE_VOCAUX = "vocaux-wa";
export const JOURS_VOCAUX_STOCKES = 30;
// 3 Mo : la taille d'un envoi depuis l'application (TAILLE_MAX_ENVOI).
export const TAILLE_MAX_VOCAL_STOCKE = 3 * 1024 * 1024;

const EXTENSIONS = { "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/webm": "webm", "audio/mpeg": "mp3", "audio/aac": "aac" };
export const TYPES_VOCAUX = Object.keys(EXTENSIONS);
const TYPE_DE_EXTENSION = Object.fromEntries(Object.entries(EXTENSIONS).map(([t, e]) => [e, t]));

// Le type sans ses précisions (« audio/ogg;codecs=opus » → « audio/ogg »).
export const typeDeBase = (mime) => String(mime || "").toLowerCase().split(";")[0].trim();

// Seule une note ENREGISTRÉE au micro de l'application se range (`micro`,
// posé par src/enregistreurVocal.js ; `vocal` pour la note en Ogg) — un son
// choisi dans les fichiers du téléphone, non (sa demande parle des vocaux).
export function doitRangerVocal(piece) {
  const p = piece || {};
  return !!(p.micro || p.vocal) && !!EXTENSIONS[typeDeBase(p.mime)]
    && Number(p.taille) > 0 && Number(p.taille) <= TAILLE_MAX_VOCAL_STOCKE;
}

const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const RE_CHEMIN = /^(\d{4}-\d{2}-\d{2})\/(\d{8})_([a-z0-9]{8,40})\.(ogg|m4a|webm|mp3|aac)$/;

// Le chemin où ranger une note (la clé : les 8 derniers chiffres du numéro).
export function cheminVocal({ cle, jour, alea, mime }) {
  const ext = EXTENSIONS[typeDeBase(mime)];
  const c = String(cle || "");
  const a = String(alea || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
  if (!ext || !/^\d{8}$/.test(c) || !RE_JOUR.test(String(jour || "")) || a.length < 8) return "";
  return `${jour}/${c}_${a}.${ext}`;
}

// Le chemin relu : { jour, cle, type } — ou null s'il n'a pas la forme exacte.
// ⚠ Un chemin venu d'une ligne du fil ne se croit pas sur parole.
export function lireCheminVocal(chemin) {
  const m = RE_CHEMIN.exec(String(chemin || ""));
  if (!m) return null;
  return { jour: m[1], cle: m[2], type: TYPE_DE_EXTENSION[m[4]] };
}

// Nombre de jours entre deux dates « AAAA-MM-JJ » (b − a).
export function ecartJours(a, b) {
  if (!RE_JOUR.test(String(a || "")) || !RE_JOUR.test(String(b || ""))) return NaN;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// Une note rangée ce jour-là est-elle encore gardée aujourd'hui ? Le 30e jour
// après son envoi elle l'est encore ; le 31e, non (comme WhatsApp).
export function vocalExpire(jour, aujourdhui) {
  const e = ecartJours(jour, aujourdhui);
  return !(e >= 0) || e > JOURS_VOCAUX_STOCKES;
}

// Les dossiers (des jours) à effacer : ceux de plus de 30 jours. Un dossier qui
// n'a pas la forme d'un jour n'est JAMAIS touché.
export function joursAPurger(dossiers, aujourdhui) {
  return (Array.isArray(dossiers) ? dossiers : [])
    .map((d) => String(d || ""))
    .filter((d) => RE_JOUR.test(d) && ecartJours(d, aujourdhui) > JOURS_VOCAUX_STOCKES);
}

// Une ligne du fil peut-elle faire écouter sa note rangée ? Le chemin doit
// avoir la forme exacte, appartenir à LA conversation de la ligne, et ne pas
// avoir dépassé 30 jours. Rend "" si oui, sinon le motif en français.
export const MOTIF_VOCAL_EXPIRE = "Cette note vocale n'est plus gardée : elle est effacée 30 jours après son envoi. Elle reste sur le téléphone BMI.";
export function critiqueEcouteVocal(ligne, aujourdhui) {
  const media = (ligne && ligne.wa_media) || {};
  const lu = lireCheminVocal(media.stocke);
  if (!media.envoye || !lu) return "Cette note vocale n'a pas été gardée.";
  if (lu.cle !== String((ligne && ligne.wa_tel) || "")) return "Cette note vocale n'appartient pas à cette conversation.";
  if (vocalExpire(lu.jour, aujourdhui)) return MOTIF_VOCAL_EXPIRE;
  return "";
}
