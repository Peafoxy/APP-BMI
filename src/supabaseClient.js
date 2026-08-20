import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const cle = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si Supabase n'est pas configuré, l'application fonctionne en mode 100 % local.
export const supabaseConfigure = Boolean(url && cle);
export const supabase = supabaseConfigure ? createClient(url, cle) : null;

// URL des fonctions serveur.
// - Sur le site Vercel (PWA) : un chemin relatif suffit (même origine).
// - Dans l'application Windows (Electron) : il FAUT l'URL complète du site,
//   renseignée dans .env via VITE_SYNC_AUTH_URL. Sans elle, le poste Windows
//   n'obtiendra JAMAIS de session : toute écriture sera refusée dès que la
//   sécurité Supabase sera activée.
// On accepte les deux écritures : l'adresse de base (https://mon-site.vercel.app)
// ou l'ancienne forme complète (https://mon-site.vercel.app/api/sync-auth).
const BASE = (import.meta.env.VITE_SYNC_AUTH_URL || "")
  .replace(/\/api\/sync-auth\/?$/, "")
  .replace(/\/$/, "");
const URL_SYNC_AUTH = BASE ? `${BASE}/api/sync-auth` : "/api/sync-auth";
// ⚠ ÉTAPE 2 de la fermeture du « trou n° 1 » : la table des comptes n'est
// plus lisible sans connexion. Un appareil NEUF ne peut donc plus
// télécharger l'annuaire pour retrouver quelqu'un — il demande au serveur
// LA fiche correspondant à l'identifiant saisi, et ne l'obtient que si le
// mot de passe est le bon (voir api/chercher-compte.js).
const URL_CHERCHER_COMPTE = BASE ? `${BASE}/api/chercher-compte` : "/api/chercher-compte";

// Renvoie { user } si le compte existe ET que le mot de passe est correct,
// sinon { error } avec un message affichable tel quel.
// N'est appelée QUE lorsque le compte est introuvable en local : une
// connexion hors réseau sur un appareil déjà utilisé ne passe jamais par ici.
export async function chercherCompteEnLigne(nom, motDePasse) {
  if (!supabaseConfigure) return { error: "Application non configurée pour le réseau." };
  if (!navigator.onLine) return { error: "hors_ligne" };
  try {
    const reponse = await fetch(URL_CHERCHER_COMPTE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, motDePasse }),
    });
    const corps = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      return { error: corps?.error || (reponse.status === 404
        ? "Serveur introuvable. Dans l'application Windows, renseignez VITE_SYNC_AUTH_URL."
        : `Le serveur a répondu ${reponse.status}.`) };
    }
    return { user: corps?.user || null };
  } catch (e) {
    return { error: `Serveur injoignable : ${e?.message || e}` };
  }
}
const URL_ETAT_AUTH = BASE ? `${BASE}/api/etat-auth` : "/api/etat-auth";

// Identifiants de la session en cours, gardés EN MÉMOIRE uniquement (jamais
// écrits sur le disque) : ils servent à rétablir la session si elle expire
// pendant que l'application est ouverte.
let identifiants = null;

// Dernier diagnostic connu, lisible par l'interface.
export const etatAuth = { ok: false, raison: "Session jamais établie" };

// Établit une VRAIE session Supabase (indispensable une fois la sécurité activée).
// Renvoie { ok, raison }. Ne bloque jamais la connexion locale.
export async function synchroniserAuth(id, motDePasse) {
  if (!supabaseConfigure) {
    Object.assign(etatAuth, { ok: false, raison: "Supabase n'est pas configuré (mode 100 % local)" });
    return { ...etatAuth };
  }
  identifiants = { id, motDePasse };

  if (String(motDePasse).length < 6) {
    Object.assign(etatAuth, { ok: false, raison: "Mot de passe de moins de 6 caractères : Supabase refuse de créer le compte. L'administrateur doit le changer." });
    return { ...etatAuth };
  }

  try {
    const reponse = await fetch(URL_SYNC_AUTH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, motDePasse }),
    });
    if (!reponse.ok) {
      const txt = await reponse.text().catch(() => "");
      Object.assign(etatAuth, {
        ok: false,
        raison: reponse.status === 404
          ? "Serveur d'authentification introuvable. Dans l'application Windows, renseignez VITE_SYNC_AUTH_URL avec l'adresse complète du site."
          : `Le serveur d'authentification a répondu ${reponse.status}. ${txt.slice(0, 120)}`,
      });
      return { ...etatAuth };
    }

    const email = `${id}@bmi.internal`;
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    if (error) {
      Object.assign(etatAuth, { ok: false, raison: `Supabase a refusé la session : ${error.message}` });
      return { ...etatAuth };
    }
    Object.assign(etatAuth, { ok: true, raison: "Session sécurisée active" });
    return { ...etatAuth };
  } catch (e) {
    Object.assign(etatAuth, { ok: false, raison: `Serveur d'authentification injoignable (${e?.message || e})` });
    return { ...etatAuth };
  }
}

// Y a-t-il une session Supabase valide en ce moment ?
export async function sessionActive() {
  if (!supabaseConfigure) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session);
  } catch {
    return false;
  }
}

// Garantit une session AVANT d'écrire. Si elle a expiré et que l'on connaît
// encore les identifiants de la session en cours, on la rétablit.
// C'est CE point qui manquait : sans lui, chaque écriture était rejetée en
// silence et restait « en attente » pour toujours.
export async function assurerSession() {
  if (!supabaseConfigure) return false;
  // Si un refus d'écriture a marqué la session comme morte (etatAuth.ok à
  // false), on NE la croit PAS sur parole même si supabase-js la dit active :
  // on force le rafraîchissement, puis la reconnexion complète si possible.
  // Sans cela, la boucle « session crue valide → écriture refusée → session
  // crue valide » ne guérissait jamais.
  if (etatAuth.ok && await sessionActive()) {
    return true;
  }
  // Rafraîchissement EXPLICITE : quand une coupure réseau fait échouer le
  // rafraîchissement automatique, supabase-js peut laisser tomber la session
  // alors que le jeton de rafraîchissement stocké est encore valable. On
  // retente donc l'échange nous-mêmes avant de déclarer la session perdue —
  // c'est ce qui évite le blocage « au retour de la connexion, ça ne part
  // toujours pas ».
  try {
    const { data } = await supabase.auth.refreshSession();
    if (data?.session) {
      Object.assign(etatAuth, { ok: true, raison: "Session sécurisée active" });
      return true;
    }
  } catch { /* on continue avec les identifiants s'ils sont connus */ }
  if (!identifiants) {
    Object.assign(etatAuth, { ok: false, raison: "Session expirée : déconnectez-vous puis reconnectez-vous pour rétablir l'envoi." });
    return false;
  }
  const r = await synchroniserAuth(identifiants.id, identifiants.motDePasse);
  return r.ok;
}

export function oublierSession() {
  identifiants = null;
  if (supabase) supabase.auth.signOut().catch(() => {});
  Object.assign(etatAuth, { ok: false, raison: "Déconnecté" });
}

// ÉCRAN DE CONTRÔLE : quels utilisateurs BMI possèdent réellement un compte
// d'authentification Supabase ? Sans compte, ils ne pourront plus rien
// synchroniser une fois la sécurité activée.
export async function etatComptesAuth(ids) {
  // ⚠ Depuis 2.99.42, le serveur exige l'identité de l'administrateur (vérifiée
  // côté serveur, avec anti-« brute force ») : sans cela, n'importe qui pouvait
  // lui demander quels comptes existent. Les identifiants de la session en
  // cours sont gardés EN MÉMOIRE uniquement (voir plus haut) — s'ils sont
  // absents (connexion faite hors ligne), on explique quoi faire.
  if (!identifiants) {
    return { ok: false, raison: "Vérification impossible : la session sécurisée n'a pas été établie. Déconnectez-vous puis reconnectez-vous avec une connexion internet active, et réessayez.", existants: [] };
  }
  try {
    const reponse = await fetch(URL_ETAT_AUTH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, id: identifiants.id, motDePasse: identifiants.motDePasse }),
    });
    if (!reponse.ok) {
      const txt = await reponse.text().catch(() => "");
      let msg = `Le serveur a répondu ${reponse.status}`;
      try { const j = JSON.parse(txt); if (j.error) msg = j.error; } catch { /* réponse non JSON */ }
      return { ok: false, raison: msg, existants: [] };
    }
    const d = await reponse.json();
    return { ok: true, existants: d.existants || [], total: d.total || 0 };
  } catch (e) {
    return { ok: false, raison: `Serveur injoignable (${e?.message || e})`, existants: [] };
  }
}
