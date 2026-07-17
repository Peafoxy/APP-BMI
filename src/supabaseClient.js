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
  if (await sessionActive()) {
    Object.assign(etatAuth, { ok: true, raison: "Session sécurisée active" });
    return true;
  }
  if (!identifiants) {
    Object.assign(etatAuth, { ok: false, raison: "Session expirée. Reconnectez-vous pour rétablir la synchronisation." });
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
  try {
    const reponse = await fetch(URL_ETAT_AUTH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!reponse.ok) return { ok: false, raison: `Le serveur a répondu ${reponse.status}`, existants: [] };
    const d = await reponse.json();
    return { ok: true, existants: d.existants || [], total: d.total || 0 };
  } catch (e) {
    return { ok: false, raison: `Serveur injoignable (${e?.message || e})`, existants: [] };
  }
}
