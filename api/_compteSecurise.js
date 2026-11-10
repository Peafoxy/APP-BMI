// Le COMPTE SÉCURISÉ d'une personne (son compte d'authentification Supabase,
// adresse « identifiant@bmi.internal ») : le retrouver, puis lui redonner le
// mot de passe et les revendications de l'espace, du rôle, de la boutique…
//
// Écrit UNE fois, appelé par :
//   • api/sync-auth.js     — l'ouverture de session (aussi « Rétablir ») ;
//   • api/chercher-compte.js — la CONNEXION RAPIDE (10/11/2026) : quand
//     l'écran le demande, le compte se prépare dans le même appel que la
//     vérification du mot de passe, au lieu d'un second appel.
// Le « _ » devant le nom : Vercel n'en fait pas une fonction (douze au plus).
//
// ⚠ Ce module NE VÉRIFIE PAS le mot de passe : l'appelant l'a fait juste
// avant, avec ses compteurs d'essais. Ne jamais l'appeler sans ça.

export const emailDeCompte = (id) => `${id}@bmi.internal`;

// ⚡ « b » (10/11/2026) : la fonction de la base retrouve le compte d'un coup
// (supabase/connexion-rapide-1.sql). ⚠ LA VIEILLE MÉTHODE RESTE (Timo : « si
// un souci se passe à l'usage, on revient à la vieille méthode ») : fonction
// absente, refusée, ou réponse qui ne colle pas → on relit la liste.
// Rend { compte, sur } : `sur` = la réponse est certaine (trouvé, ou absent
// d'après la base elle-même).
export async function trouverCompteSecurise(admin, email) {
  try {
    const { data: uid, error } = await admin.rpc("compte_securise_par_email", { adresse: email });
    if (!error) {
      if (!uid) return { compte: null, sur: true, par: "base" };
      const { data, error: e2 } = await admin.auth.admin.getUserById(uid);
      const u = data?.user;
      if (!e2 && u && String(u.email || "").toLowerCase() === email.toLowerCase()) {
        return { compte: u, sur: true, par: "base" };
      }
    }
  } catch { /* la vieille méthode prend le relais */ }
  return { compte: await parcourirLaListe(admin, email), sur: true, par: "liste" };
}

// La VIEILLE MÉTHODE, telle qu'elle était dans sync-auth.js.
// ⚠ On parcourt TOUTES les pages (comme dans etat-auth.js) : au-delà de
// 1000 comptes, une seule page pouvait « manquer » un compte existant —
// il aurait alors été recréé, et la création aurait échoué (email déjà
// pris), bloquant la connexion de cet utilisateur.
export async function parcourirLaListe(admin, email) {
  let page = 1;
  for (;;) {
    const { data: liste, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const existant = (liste.users || []).find((u) => u.email === email) || null;
    if (existant) return existant;
    if (!liste.users || liste.users.length < 1000) return null;
    page += 1;
    if (page > 20) return null; // garde-fou, même limite qu'etat-auth
  }
}

// ⚠ CLOISONNEMENT FORMATION / RÉEL ET RÔLES — les revendications du jeton.
// C'est le SEUL endroit du système qui a le droit de les poser :
// `app_metadata` fait partie du jeton de session, mais n'est modifiable
// qu'avec la clé service_role — un appareil ne peut donc pas se
// l'attribuer lui-même, contrairement à `user_metadata`.
//
// Réécrites à CHAQUE connexion, juste avant que la session ne soit créée :
// un changement (formation, rôle, boutique, pouvoirs) prend effet à la
// prochaine connexion de la personne, sans aucune manipulation.
//
// • espace : 'tous' pour le SEUL administrateur principal — reproduit
//   EXACTEMENT voitLesDeuxEspaces() de lib/calculs.js (Timo, 28/08/2026 :
//   « Je suis le seul admin principal qui peut voir les 2 espaces à la
//   fois. Le reste, soit tu es admin formation, soit admin réel. ») ;
// • ecriture : reproduit peutEcrire() de lib/calculs.js. En cas de doute on
//   ACCORDE l'écriture : refuser à tort casserait l'application ;
// • principal : l'administrateur PRINCIPAL actif. ⚠ Le serveur ne reproduit
//   PAS le repli de l'application (« à défaut, le premier admin ») ;
// • boutique : la boutique de rattachement ; pouvoirs_off : les pouvoirs
//   retirés (règles « pouvoir act_… »).
export function revendicationsDe(champs) {
  const voitLesDeuxEspaces = champs.role === "admin" && champs.admin_principal === true;
  const espace = voitLesDeuxEspaces ? "tous" : (champs.formation ? "formation" : "reel");
  const droitsOff = Array.isArray(champs.droits_off) ? champs.droits_off : [];
  const role = String(champs.role || "");
  const ecriture = champs.admin_principal === true
    || (role !== "comptable" && !droitsOff.includes("act_ecriture"));
  const principal = role === "admin" && champs.admin_principal === true && champs.actif !== false;
  const boutique = String(champs.boutique || "");
  const pouvoirsOff = droitsOff.filter((x) => typeof x === "string").slice(0, 40);
  return { espace, role, ecriture, principal, boutique, pouvoirs_off: pouvoirsOff };
}

// Redonne le mot de passe au compte sécurisé (ou le crée) et pose les
// revendications. ⚠ La réécriture du mot de passe ferme les autres sessions
// du compte : décision de Timo du 22/10/2026 (« on laisse comme ça, j'aime
// plus la sécurité que la facilité ») — ne pas la retirer.
export async function preparerCompteSecurise(admin, id, champs, motDePasse) {
  const email = emailDeCompte(id);
  const revendications = revendicationsDe(champs);
  let { compte: existant } = await trouverCompteSecurise(admin, email);
  if (!existant) {
    const { error } = await admin.auth.admin.createUser({
      email, password: String(motDePasse), email_confirm: true,
      app_metadata: revendications,
    });
    if (!error) return;
    // Déjà pris ? La base s'est trompée : la vieille méthode le retrouve.
    existant = await parcourirLaListe(admin, email);
    if (!existant) { console.error("compte sécurisé, createUser:", JSON.stringify(error)); throw error; }
  }
  const { error } = await admin.auth.admin.updateUserById(existant.id, {
    password: String(motDePasse),
    app_metadata: { ...(existant.app_metadata || {}), ...revendications },
  });
  if (error) { console.error("compte sécurisé, updateUserById:", JSON.stringify(error)); throw error; }
}
