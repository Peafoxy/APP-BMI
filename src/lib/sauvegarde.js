// ============================================================
// lib/sauvegarde.js — Sauvegarde JSON : téléchargement manuel et
// écriture horaire automatique dans un dossier (File System API).
// ============================================================
import { today } from "./core";
import { marquerSauvegardeAuto, TABLES } from "../db";
import { fusionnerCorbeille } from "./corbeille";

// Le fichier de sauvegarde ne contient QUE les vraies tables — jamais les
// champs techniques du db en mémoire (ex. __index du lot D, qui contient des
// Map non sérialisables et se reconstruit tout seul au chargement).
// La corbeille part avec la sauvegarde : une fiche mise de côté n'est pas perdue.
const donneesTables = (db) => { const d = fusionnerCorbeille(db); return Object.fromEntries(TABLES.map((t) => [t, d[t] || []])); };

export function telechargerSauvegarde(db, suffixe = "") {
  const blob = new Blob([JSON.stringify(donneesTables(db), null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sauvegarde_bmi_${today()}${suffixe}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ============ SAUVEGARDE HORAIRE DANS UN DOSSIER ============
// Chrome / Edge permettent à l'application d'écrire dans un dossier que vous
// désignez. Si ce dossier est synchronisé par Google Drive, la sauvegarde part
// dans le cloud toute seule. Le MÊME fichier est réécrit : pas d'accumulation.
export const NOM_FICHIER_AUTO = "sauvegarde_bmi.json";
export const dossierDispo = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

// Écrit (ou réécrit) le fichier dans le dossier mémorisé.
export async function ecrireDansDossier(db, handle) {
  const perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm !== "granted") {
    const demande = await handle.requestPermission({ mode: "readwrite" });
    if (demande !== "granted") throw new Error("Autorisation refusée sur le dossier.");
  }
  const fichier = await handle.getFileHandle(NOM_FICHIER_AUTO, { create: true });
  const flux = await fichier.createWritable();
  await flux.write(JSON.stringify({ ...donneesTables(db), _sauvegarde: new Date().toISOString() }, null, 1));
  await flux.close();
  await marquerSauvegardeAuto();
}
