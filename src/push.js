// ============================================================
// src/push.js — LES NOTIFICATIONS SUR L'APPAREIL (le seul fichier qui parle
// au navigateur pour ça : permission, abonnement, file d'envoi).
//
// Timo (13/09/2026) : « Notification par défaut, pas besoin d'activer
// quelque chose dans l'app. Tant que tu l'utilises, tu auras des
// notifications. » Le téléphone pose UNE question, une seule fois par
// appareil (« Autoriser ? ») — aucune application ne peut la sauter. On la
// pose au clic de connexion (un geste de l'utilisateur : c'est ce
// qu'exigent iPhone et Chrome pour l'afficher), puis plus rien : chaque
// connexion rattache l'appareil à la personne connectée, la déconnexion le
// détache (un téléphone partagé ne fait jamais vibrer pour l'ancien
// occupant).
//
// Ce que fait ce fichier :
//   • demanderPermissionPush()   — au clic de connexion, jamais ailleurs ;
//   • enregistrerAppareil(u)     — après connexion / au retour : l'appareil
//                                  est inscrit pour `u` (api/abonner-push) ;
//   • oublierAppareil()          — à la déconnexion, AVANT la fin de session ;
//   • envoyerPush(envois)        — met en file et envoie (api/notifier) ;
//                                  sans réseau, la file attend le retour du
//                                  réseau (localStorage, 24 h au plus).
// Ce qu'il ne décide JAMAIS : qui reçoit quoi — c'est lib/notifications.js
// et lib/rappels.js. Jamais de `Notification.` ailleurs (le banc l'interdit).
// ============================================================
import { CLE_PUBLIQUE_PUSH } from "./lib/constants";
import { abonnerPushEnLigne, notifierEnLigne } from "./supabaseClient";

const CLE_FILE = "bmi_push_attente";
const FILE_MAX = 200;
const AGE_MAX_MS = 24 * 3600 * 1000;

export const pushSupporte = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!CLE_PUBLIQUE_PUSH;

// "accordee" | "refusee" | "a_demander" | "indisponible"
export const etatPermissionPush = () => {
  if (!pushSupporte()) return "indisponible";
  const p = Notification.permission;
  return p === "granted" ? "accordee" : p === "denied" ? "refusee" : "a_demander";
};

// Posée DANS le geste (clic de connexion), sans attendre : la réponse
// arrive quand elle arrive, l'inscription se fait à la connexion suivante
// si elle n'est pas là à temps.
export function demanderPermissionPush() {
  if (etatPermissionPush() !== "a_demander") return;
  try {
    const r = Notification.requestPermission();
    if (r && typeof r.catch === "function") r.catch(() => {});
  } catch { /* ancien navigateur : rien à faire */ }
}

function cleServeur(base64) {
  const rembourree = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(rembourree);
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

async function abonnementCourant(creer) {
  if (!pushSupporte()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null; // pas de service worker (mode développement) : rien
  let sub = await reg.pushManager.getSubscription();
  if (!sub && creer) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleServeur(CLE_PUBLIQUE_PUSH) });
  }
  return sub;
}

export async function enregistrerAppareil(profile) {
  if (!profile || etatPermissionPush() !== "accordee") return false;
  try {
    const sub = await abonnementCourant(true);
    if (!sub) return false;
    const r = await abonnerPushEnLigne({ abonnement: sub.toJSON(), appareil: String(navigator.userAgent || "").slice(0, 160) });
    return !r?.error;
  } catch { return false; }
}

export async function oublierAppareil() {
  try {
    const sub = await abonnementCourant(false);
    if (!sub) return;
    await abonnerPushEnLigne({ abonnement: sub.toJSON(), retirer: true });
  } catch { /* hors ligne : la prochaine connexion réécrira la fiche de l'appareil */ }
}

// ---- La file d'envoi ----
function lireFile() {
  try { return JSON.parse(localStorage.getItem(CLE_FILE) || "[]"); } catch { return []; }
}
function ecrireFile(liste) {
  try { localStorage.setItem(CLE_FILE, JSON.stringify(liste.slice(-FILE_MAX))); } catch {}
}

let envoiEnCours = false;
export async function viderFilePush() {
  if (envoiEnCours || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  const maintenant = Date.now();
  const file = lireFile().filter((e) => maintenant - (e.depuis || maintenant) < AGE_MAX_MS);
  if (!file.length) { ecrireFile([]); return; }
  envoiEnCours = true;
  try {
    const r = await notifierEnLigne(file.map(({ depuis, ...e }) => e));
    // On ne garde la file que si le serveur n'a pas été JOINT (réseau) ou si
    // la session manque (401, ou pas encore établie) : une réponse claire du
    // serveur (mal configuré, refus) ne se rejoue pas à chaque geste.
    const garder = !!r?.error && (r.reseau === true || r.statut === 401 || r.statut === undefined);
    ecrireFile(garder ? file : []);
  } catch {
    ecrireFile(file);
  } finally {
    envoiEnCours = false;
  }
}

export function envoyerPush(envois) {
  if (!Array.isArray(envois) || !envois.length) return;
  const depuis = Date.now();
  ecrireFile([...lireFile(), ...envois.map((e) => ({ ...e, depuis }))]);
  viderFilePush();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { viderFilePush(); });
}
