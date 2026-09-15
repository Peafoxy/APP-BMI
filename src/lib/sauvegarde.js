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
// ⚠ Capture Timo (15/09/2026) : « Autoriser ce site à modifier les fichiers ? »
// à CHAQUE connexion sur son téléphone. Le navigateur ne garde l'autorisation
// du dossier que tant qu'un onglet du site reste ouvert (« jusqu'à ce que vous
// fermiez tous les onglets de ce site ») — et l'application la redemandait dès
// l'ouverture, pendant l'écran de connexion.
// Décision de Timo : la sauvegarde par dossier RESTE, téléphone compris ; ce
// qui change, c'est qu'on ne demande plus RIEN par surprise. « Une fois
// autorisée, elle écrit toutes les heures en silence, comme aujourd'hui. »
export const dossierDispo = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

// L'autorisation du dossier est-elle encore accordée ? On REGARDE, on ne
// demande pas : une demande hors clic surprend l'utilisateur (et certains
// navigateurs la refusent d'office). Même règle que les notifications :
// on demande AU CLIC, jamais par surprise.
export async function dossierAutorise(handle) {
  try { return (await handle.queryPermission({ mode: "readwrite" })) === "granted"; } catch { return false; }
}

// Écrit (ou réécrit) le fichier dans le dossier mémorisé.
// `demander` : demander l'autorisation si elle manque. FAUX par défaut — la
// sauvegarde horaire passe son tour en silence plutôt que d'ouvrir une fenêtre
// que personne n'a réclamée. Seul un clic dans ⚙ Paramètres met `demander` à vrai.
export async function ecrireDansDossier(db, handle, { demander = false } = {}) {
  if (!(await dossierAutorise(handle))) {
    if (!demander) throw new Error("PAUSE");       // silencieux : on réessaiera
    const accorde = await handle.requestPermission({ mode: "readwrite" });
    if (accorde !== "granted") throw new Error("Autorisation refusée sur le dossier.");
  }
  const fichier = await handle.getFileHandle(NOM_FICHIER_AUTO, { create: true });
  const flux = await fichier.createWritable();
  await flux.write(JSON.stringify({ ...donneesTables(db), _sauvegarde: new Date().toISOString() }, null, 1));
  await flux.close();
  await marquerSauvegardeAuto();
}
