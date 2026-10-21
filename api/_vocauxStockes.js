// ============================================================
// api/_vocauxStockes.js — 🎤 RANGER, RENDRE ET EFFACER LES NOTES VOCALES
// ENVOYÉES PAR BMI (21/10/2026, « AVEC l'espace de fichiers privé de
// Supabase, il faut lancer pour 30 jours »)
//
// Les règles vivent dans src/lib/vocauxStockes.js ; ici, seulement les
// gestes sur l'espace de fichiers PRIVÉ (supabase/vocaux-1-espace.sql) :
//   - rangerVocal : APRÈS que la note est partie (api/whatsapp.js) — rien
//     n'est rangé pour un message qui n'est pas parti ;
//   - lireVocal : pour api/whatsapp-media.js, qui a DÉJÀ revérifié le mur ;
//   - purgerVocauxStockes : la tournée de 7 h efface les jours de plus de
//     30 jours.
// ⚠ Rien ici ne fait tomber l'envoi ni la tournée : un espace absent (SQL pas
// encore collé), un refus, une panne → "" ou un bilan avec son motif, et le
// journal Vercel le dit. La note est partie au client quoi qu'il arrive.
// ⚠ Ce n'est PAS une fonction Vercel (le « _ ») : douze au plus.
// ============================================================
import { randomUUID } from "node:crypto";
import { ESPACE_VOCAUX, cheminVocal, doitRangerVocal, typeDeBase, joursAPurger } from "../src/lib/vocauxStockes.js";

// Range la note ; rend son chemin, ou "" (jamais une erreur).
export async function rangerVocal(admin, { cle, piece, jour }) {
  if (!admin || !doitRangerVocal(piece)) return "";
  const chemin = cheminVocal({ cle, jour, alea: randomUUID(), mime: piece.mime });
  if (!chemin) return "";
  try {
    const { error } = await admin.storage.from(ESPACE_VOCAUX).upload(chemin, piece.octets, {
      contentType: typeDeBase(piece.mime), upsert: false, cacheControl: "3600",
    });
    if (error) { console.error("[vocaux] rangement refusé :", error.message || error); return ""; }
    return chemin;
  } catch (e) {
    console.error("[vocaux] rangement impossible :", e?.message || e);
    return "";
  }
}

// Rend { octets, type } ou { motif }.
export async function lireVocal(admin, chemin, type) {
  try {
    const { data, error } = await admin.storage.from(ESPACE_VOCAUX).download(chemin);
    if (error || !data) {
      console.error("[vocaux] lecture refusée :", error?.message || error || "vide");
      return { motif: "Cette note vocale n'est plus disponible." };
    }
    return { octets: Buffer.from(await data.arrayBuffer()), type };
  } catch (e) {
    console.error("[vocaux] lecture impossible :", e?.message || e);
    return { motif: "Cette note vocale n'est pas disponible pour le moment." };
  }
}

// Liste un dossier en entier (1 000 par page).
async function listerTout(espace, dossier) {
  const tous = [];
  for (let decalage = 0; decalage < 100000; decalage += 1000) {
    const { data, error } = await espace.list(dossier, { limit: 1000, offset: decalage, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    const page = data || [];
    tous.push(...page);
    if (page.length < 1000) break;
  }
  return tous;
}

// Efface les jours de plus de 30 jours. Rend { jours, effaces } ou { pourquoi }.
export async function purgerVocauxStockes(admin, aujourdhui) {
  try {
    const espace = admin.storage.from(ESPACE_VOCAUX);
    const dossiers = (await listerTout(espace, "")).map((e) => e && e.name);
    const vieux = joursAPurger(dossiers, aujourdhui);
    let effaces = 0;
    for (const jour of vieux) {
      const fichiers = (await listerTout(espace, jour)).filter((f) => f && f.name).map((f) => `${jour}/${f.name}`);
      for (let i = 0; i < fichiers.length; i += 1000) {
        const lot = fichiers.slice(i, i + 1000);
        const { error } = await espace.remove(lot);
        if (error) throw error;
        effaces += lot.length;
      }
    }
    return { jours: vieux.length, effaces };
  } catch (e) {
    console.error("[vocaux] effacement des notes de plus de 30 jours :", e?.message || e);
    return { jours: 0, effaces: 0, pourquoi: e?.message || "erreur" };
  }
}
