// ============================================================
// src/enregistreurVocal.js — Le micro, pour une note vocale de 📲 WhatsApp
// ============================================================
// ⚠ C'EST LE SEUL FICHIER QUI TOUCHE `getUserMedia` ET `MediaRecorder`
// (comme src/push.js pour les notifications) — le banc l'impose.
// ⚠ Le son n'est RANGÉ nulle part chez nous (décision du 20/09/2026) : il
// part chez WhatsApp et ne reste que dans la mémoire de la page.
//
// Le format : WhatsApp ne lit comme NOTE VOCALE qu'un .ogg en Opus.
//   • le navigateur sait l'écrire en Ogg (Firefox) → tel quel ;
//   • il l'écrit en WebM / Opus (Chrome, Android) → remis dans une boîte Ogg
//     par lib/oggOpus.js, sans recoder ;
//   • il ne sait faire que du MP4 / AAC (Safari, iPhone) → part comme un
//     simple son (le client le reçoit, mais pas avec le rond de la note).
import { webmVersOgg, DUREE_MAX_VOCAL } from "./lib/oggOpus";

const FORMATS = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4"];

export function micDisponible() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

const formatChoisi = () => FORMATS.find((f) => {
  try { return MediaRecorder.isTypeSupported(f); } catch { return false; }
}) || "";

// Démarre l'enregistrement. Rend { arreter(), annuler(), debut } ou
// { motif } en français (micro refusé, absent…).
export async function demarrerEnregistrement() {
  if (!micDisponible()) return { motif: "Ce navigateur ne sait pas enregistrer un message vocal." };
  let flux;
  try {
    flux = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    const nom = e?.name || "";
    if (nom === "NotAllowedError" || nom === "SecurityError") return { motif: "Le micro est refusé. Autorisez-le pour ce site (le cadenas à côté de l'adresse), puis réessayez.", refuse: true };
    if (nom === "NotFoundError") return { motif: "Aucun micro n'a été trouvé sur cet appareil." };
    return { motif: "Le micro n'a pas pu s'ouvrir." };
  }
  const mime = formatChoisi();
  let enreg;
  try { enreg = new MediaRecorder(flux, mime ? { mimeType: mime } : undefined); }
  catch { flux.getTracks().forEach((t) => t.stop()); return { motif: "Ce navigateur ne sait pas enregistrer un message vocal." }; }
  const morceaux = [];
  enreg.ondataavailable = (e) => { if (e.data && e.data.size) morceaux.push(e.data); };
  const fini = new Promise((ok) => { enreg.onstop = ok; });
  const debut = Date.now();
  enreg.start(250);
  const couper = () => { flux.getTracks().forEach((t) => t.stop()); };
  return {
    debut,
    annuler() {
      try { if (enreg.state !== "inactive") enreg.stop(); } catch { /* déjà arrêté */ }
      couper();
    },
    async arreter() {
      try { if (enreg.state !== "inactive") enreg.stop(); } catch { /* déjà arrêté */ }
      await fini;
      couper();
      const type = (enreg.mimeType || mime || "audio/webm").toLowerCase();
      return { blob: new Blob(morceaux, { type }), mime: type, duree: Math.min(DUREE_MAX_VOCAL, (Date.now() - debut) / 1000) };
    },
  };
}

const enBase64 = (octets) => {
  let s = "";
  for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(s);
};

// Le son enregistré, prêt à partir par repondreWhatsApp : { nom, mime,
// taille, donnees, vocal, duree }, ou { motif } si on ne sait pas le lire.
export async function fichierVocal({ blob, mime, duree }) {
  const octets = new Uint8Array(await blob.arrayBuffer());
  const base = String(mime || "").split(";")[0];
  const nom = `note-vocale-${Date.now()}`;
  if (base === "audio/ogg") {
    return { nom: `${nom}.ogg`, mime: "audio/ogg", taille: octets.length, donnees: enBase64(octets), vocal: true, duree, blob };
  }
  if (base === "audio/webm") {
    const ogg = webmVersOgg(octets);
    if (!ogg) return { motif: "Le message vocal n'a pas pu être préparé. Réessayez." };
    const b = new Blob([ogg.octets], { type: "audio/ogg" });
    return { nom: `${nom}.ogg`, mime: "audio/ogg", taille: ogg.octets.length, donnees: enBase64(ogg.octets), vocal: true, duree: ogg.duree || duree, blob: b };
  }
  if (base === "audio/mp4" || base === "audio/aac") {
    return { nom: `${nom}.m4a`, mime: "audio/mp4", taille: octets.length, donnees: enBase64(octets), vocal: false, duree, blob };
  }
  return { motif: "Ce navigateur enregistre dans un format que WhatsApp ne lit pas." };
}
