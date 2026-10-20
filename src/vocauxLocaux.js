// ============================================================
// src/vocauxLocaux.js — 🎤 LA COPIE D'UNE NOTE VOCALE ENVOYÉE, GARDÉE SUR
// L'APPAREIL QUI L'A ENREGISTRÉE (20/10/2026, « a, lance »)
// ============================================================
// Timo : « les vocaux envoyés par BMI ne sont pas renvoyés ». YCloud ne
// permet PAS de reprendre un fichier qu'on lui a déposé (sa documentation
// n'offre que le dépôt, et le téléchargement d'un fichier REÇU d'un client) :
// la note ne peut donc se réécouter que si l'appareil en garde une copie.
// ⚠ RIEN DANS SUPABASE (décision du 20/09/2026) : la copie vit dans le
// navigateur de CET appareil (IndexedDB, base « bmi_vocaux »), 30 jours —
// comme WhatsApp garde un fichier déposé. Un autre appareil, une navigation
// privée, des données du site effacées : il ne reste que la ligne
// « 🎤 Message vocal — envoyé », et le son reste sur le téléphone BMI.
// Rien ici ne lève : un navigateur qui refuse le stockage rend simplement
// « pas de copie ».
export const BASE_VOCAUX = "bmi_vocaux";
export const JOURS_COPIE_VOCAL = 30;
const MAGASIN = "notes";

// Règle pure : une copie gardée plus de 30 jours n'est plus rendue.
export const copieExpiree = (le, maintenantMs) =>
  !(Number(le) > 0) || maintenantMs - Number(le) > JOURS_COPIE_VOCAL * 86400000;

function ouvrir() {
  return new Promise((ok) => {
    try {
      if (typeof indexedDB === "undefined" || !indexedDB) return ok(null);
      const req = indexedDB.open(BASE_VOCAUX, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(MAGASIN, { keyPath: "id" }); };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok(null);
      req.onblocked = () => ok(null);
    } catch { ok(null); }
  });
}

// Une opération sur le magasin, qui rend toujours quelque chose (jamais d'erreur).
async function operation(mode, geste, repli = null) {
  const base = await ouvrir();
  if (!base) return repli;
  return new Promise((ok) => {
    try {
      const tr = base.transaction(MAGASIN, mode);
      const req = geste(tr.objectStore(MAGASIN));
      let rendu = repli;
      if (req) req.onsuccess = () => { rendu = req.result ?? repli; };
      tr.oncomplete = () => { base.close(); ok(rendu); };
      tr.onerror = () => { base.close(); ok(repli); };
      tr.onabort = () => { base.close(); ok(repli); };
    } catch { try { base.close(); } catch { /* déjà fermée */ } ok(repli); }
  });
}

// Retire les copies de plus de 30 jours.
export async function purgerCopiesVocales(maintenantMs = Date.now()) {
  const toutes = await operation("readonly", (m) => m.getAll(), []);
  const vieilles = (toutes || []).filter((c) => copieExpiree(c.le, maintenantMs)).map((c) => c.id);
  if (!vieilles.length) return 0;
  await operation("readwrite", (m) => { vieilles.forEach((id) => m.delete(id)); return null; });
  return vieilles.length;
}

// Garde la copie de la note (l'id de la ligne du fil), puis purge.
export async function garderCopieVocal(id, blob, maintenantMs = Date.now()) {
  if (!id || !blob) return false;
  const fait = await operation("readwrite", (m) => m.put({ id: String(id), blob, le: maintenantMs }), null);
  purgerCopiesVocales(maintenantMs);
  return fait !== null;
}

// Rend le son gardé, ou null (jamais gardé ici, ou plus de 30 jours).
export async function lireCopieVocal(id, maintenantMs = Date.now()) {
  if (!id) return null;
  const copie = await operation("readonly", (m) => m.get(String(id)), null);
  if (!copie || !copie.blob) return null;
  if (copieExpiree(copie.le, maintenantMs)) {
    await operation("readwrite", (m) => m.delete(String(id)));
    return null;
  }
  return copie.blob;
}
