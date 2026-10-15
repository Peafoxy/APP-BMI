// ============================================================
// lib/connexionsComptes.js — QUI A DÉJÀ OUVERT SON COMPTE (15/10/2026)
// ============================================================
// Timo : « est-il possible de connaître les utilisateurs qui ont ouvert leur
// compte ? Et ceux qui n'ont jamais ouvert leur compte ? » → dans 👥
// Utilisateurs, pour l'administrateur PRINCIPAL seul (« B »).
//
// La trace sûre vit chez Supabase, dans les comptes d'authentification :
// `api/sync-auth.js` ne crée le compte sécurisé d'une personne QU'À sa
// première connexion réussie (bon mot de passe). Il porte deux dates :
// sa création (= la première connexion depuis les comptes sécurisés) et la
// dernière fois que la personne a tapé son mot de passe pour se connecter.
// Ces dates ne se lisent qu'avec la clé du serveur : `api/etat-auth.js`
// (action « connexions ») les rend, cette règle les lit.
//
// ⚠ Lisible par Node (le serveur l'importe) : AUCUN import, et aucune
// horloge — les dates arrivent du serveur et se recopient telles quelles.
// ⚠ Rien n'est écrit, nulle part : c'est une lecture.
// ============================================================

// Le domaine des adresses internes des comptes sécurisés (api/sync-auth.js).
export const DOMAINE_COMPTE = "@bmi.internal";

// L'administrateur PRINCIPAL seul (Timo, 15/10/2026 : « B »). Revérifié par
// le serveur sur la fiche relue.
export const peutVoirConnexions = (compte) => !!compte && compte.role === "admin"
  && compte.admin_principal === true && compte.actif !== false;

// Côté serveur : les comptes d'authentification → { id: { premiere, derniere } },
// seulement pour les identifiants DEMANDÉS (l'écran envoie ceux qu'il affiche,
// déjà filtrés par l'espace regardé — le serveur ne renvoie rien d'autre).
export function connexionsPourIds(comptesAuth, ids) {
  const voulus = new Map((Array.isArray(ids) ? ids : []).map((id) => [String(id).toLowerCase(), String(id)]));
  const res = {};
  for (const c of Array.isArray(comptesAuth) ? comptesAuth : []) {
    const email = String(c?.email || "").toLowerCase();
    if (!email.endsWith(DOMAINE_COMPTE)) continue;
    const id = voulus.get(email.slice(0, -DOMAINE_COMPTE.length));
    if (!id) continue;
    res[id] = { premiere: c.created_at || null, derniere: c.last_sign_in_at || null };
  }
  return res;
}

// Une date du serveur (« 2026-10-14T08:15:22.123Z ») → « 14/10/2026 » et
// « 08:15 ». L'heure universelle EST l'heure de Lomé (GMT+0) : rien à décaler.
const jourFR = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
const heureFR = (iso) => {
  const m = /T(\d{2}):(\d{2})/.exec(String(iso || ""));
  return m ? `${m[1]}:${m[2]}` : "";
};

// L'état d'un compte. `connexions` = la réponse du serveur, ou null tant
// qu'elle n'est pas arrivée (hors ligne, refus) ; `demandes` = les
// identifiants envoyés (un compte créé APRÈS la demande n'a pas été
// regardé : on ne dit pas « jamais ouvert » à tort).
//   → { etat: "ouvert" | "jamais" | "inconnu", premiere, derniere }
export function etatConnexion(compte, connexions, demandes) {
  if (!compte || !connexions || !demandes || !demandes.has(compte.id)) return { etat: "inconnu" };
  const c = connexions[compte.id];
  if (!c) return { etat: "jamais" };
  return { etat: "ouvert", premiere: c.premiere || null, derniere: c.derniere || null };
}

// La phrase sous le nom.
export function libelleConnexion(e) {
  if (!e || e.etat === "inconnu") return "Connexion : inconnue";
  if (e.etat === "jamais") return "⏳ Jamais ouvert";
  const ouvert = jourFR(e.premiere);
  const der = jourFR(e.derniere);
  const h = heureFR(e.derniere);
  return `✅ Ouvert${ouvert ? ` le ${ouvert}` : ""}${der ? ` · dernière connexion le ${der}${h ? ` à ${h}` : ""}` : ""}`;
}

// La liste au-dessus du tableau : « Tous » d'office.
export const FILTRES_CONNEXION = [
  ["tous", "Tous"],
  ["jamais", "⏳ Jamais ouvert"],
  ["ouvert", "✅ Ouvert"],
];
export const dansFiltreConnexion = (e, filtre) => !filtre || filtre === "tous" || (e && e.etat === filtre);
