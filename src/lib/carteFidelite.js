// ============================================================
// lib/carteFidelite.js — LA CARTE DE FIDÉLITÉ À CODE-BARRES
//
// Timo (29/10/2026) : « construire un système de … carte de fidélité… On
// scan et le client a une réduction » → « B code barre ; C une remise
// programmable sur la fiche client ; D la remise de la carte est autorisée
// chez le vendeur même hors de sa limite ; E les deux (client à compte et
// client de comptoir), l'essentiel qu'on l'enregistre comme fidèle client ;
// F l'admin principal met tout en place », puis « 2 oui » (la remise est
// FIXE : pas modifiable, pas d'autre remise en plus) et « 3 non… le vendeur
// remet la carte imprimée au client… pas l'imprimer lui-même ».
//
// LA CARTE VIT SUR LA FICHE DU CLIENT (`fidelite`) : son numéro (FID-000001,
// imprimé en code-barres Code128), son pourcentage, qui l'a posée et quand.
// Un client de comptoir sans compte reçoit une fiche FERMÉE (`sans_acces`,
// la règle du devis imprimé sans compte) : il ne se connecte jamais, il est
// seulement ENREGISTRÉ. Une carte remplacée (perdue) part dans
// `fidelite_passees` : elle ne vaut plus rien, et le scan le DIT.
//
// Le PRINCIPAL seul crée, change le %, remplace, retire et imprime
// (revérifié DANS le geste). Le vendeur SCANNE : le client se remplit, la
// remise s'applique, FIXE — ni modifiable, ni une remise d'article en plus.
//
// ⚠ LE COUPLE : securite-45 (la fiche `fidelite` = le principal seul ; une
// vente qui cite une carte ACTIVE avec SON pourcentage passe au-delà de la
// limite, sans remise d'article).
// ============================================================

export const PREFIXE_CARTE = "FID-";
export const PCT_CARTE_MAX = 50;

export const carteDe = (u) => (u && u.fidelite && u.fidelite.numero && u.fidelite.active !== false ? u.fidelite : null);
export const cartesPasseesDe = (u) => (u && u.fidelite_passees) || [];

const numeroDe = (s) => {
  const m = String(s || "").toUpperCase().match(/^FID-(\d+)$/);
  return m ? Number(m[1]) : 0;
};
export const estCodeCarte = (code) => /^FID-\d+$/i.test(String(code || "").trim());

// Le prochain numéro : le plus grand déjà donné + 1, cartes passées comprises
// (une carte remplacée garde son numéro réservé — il ne redescend jamais).
export const prochainNumeroCarte = (users) => {
  let max = 0;
  for (const u of users || []) {
    max = Math.max(max, numeroDe(u.fidelite && u.fidelite.numero));
    for (const c of cartesPasseesDe(u)) max = Math.max(max, numeroDe(c.numero));
  }
  return `${PREFIXE_CARTE}${String(max + 1).padStart(6, "0")}`;
};

export const critiquePctCarte = (pct) => {
  const n = Number(String(pct ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "Indiquez le pourcentage de remise de la carte (plus de 0).";
  if (n > PCT_CARTE_MAX) return `Une carte de fidélité ne dépasse pas ${PCT_CARTE_MAX} %.`;
  return "";
};
const pctLu = (pct) => Math.round(Number(String(pct).replace(",", ".")) * 100) / 100;

export const critiqueGesteCarte = (profile, estPrincipal) =>
  (estPrincipal ? "" : "Seul l'administrateur principal met en place une carte de fidélité (la créer, changer sa remise, la remplacer, l'imprimer).");

// Poser une carte neuve (ou changer le % d'une carte en cours : même numéro).
export const poserCarte = (u, { numero, pct, profile, aujourdhui }) => ({
  ...u,
  fidelite: { numero, pct: pctLu(pct), le: aujourdhui, par: profile.nom, active: true },
});
export const changerPctCarte = (u, pct, profile, aujourdhui) => ({
  ...u, fidelite: { ...u.fidelite, pct: pctLu(pct), modifie_le: aujourdhui, modifie_par: profile.nom },
});
// Remplacer (carte perdue) : l'ancienne part, morte, dans l'historique.
export const remplacerCarte = (u, { numero, profile, aujourdhui, motif }) => ({
  ...u,
  fidelite_passees: [...cartesPasseesDe(u), { ...u.fidelite, active: false, remplacee_le: aujourdhui, remplacee_par: profile.nom, motif: String(motif || "").trim() }],
  fidelite: { numero, pct: u.fidelite.pct, le: aujourdhui, par: profile.nom, active: true },
});
// Retirer : plus de carte du tout (l'ancienne reste dans l'historique).
export const retirerCarte = (u, { profile, aujourdhui, motif }) => ({
  ...u,
  fidelite_passees: [...cartesPasseesDe(u), { ...u.fidelite, active: false, retiree_le: aujourdhui, retiree_par: profile.nom, motif: String(motif || "").trim() }],
  fidelite: null,
});

// Le SCAN : on cherche sur les fiches DÉJÀ filtrées par l'espace regardé
// (le mur : jamais `db.users` en entier). Rend { compte, carte } ou { refus }.
export const trouverCarte = (comptesEspace, code) => {
  const c = String(code || "").trim().toUpperCase();
  if (!estCodeCarte(c)) return { refus: "" };
  const compte = (comptesEspace || []).find((u) => u.role === "client" && carteDe(u)?.numero === c);
  if (compte) return { compte, carte: carteDe(compte) };
  const ancienne = (comptesEspace || []).find((u) => cartesPasseesDe(u).some((x) => x.numero === c));
  if (ancienne) {
    const x = cartesPasseesDe(ancienne).find((y) => y.numero === c);
    return { refus: `💳 La carte ${c} de ${ancienne.nom_base || ancienne.nom} ne vaut plus : ${x.remplacee_le ? "elle a été remplacée" : "elle a été retirée"}${x.motif ? ` (${x.motif})` : ""}. Demandez sa nouvelle carte.` };
  }
  return { refus: `💳 Aucune carte de fidélité ${c} dans cet espace.` };
};

// À l'encaissement : la remise de la carte est-elle intacte ? (FIXE, aucune
// remise d'article en plus — « 2 oui ».)
export const critiqueRemiseCarte = ({ carte, panier, remisePct, remiseLibre }) => {
  if (!carte) return "";
  if (remiseLibre || Number(remisePct || 0) !== Number(carte.pct)) return `💳 La remise de la carte est de ${carte.pct} %, fixe : elle ne se modifie pas.`;
  if ((panier || []).some((l) => Number(l.remise_ligne || 0) > 0)) return "💳 Avec la carte de fidélité, pas de remise sur un article en plus.";
  return "";
};

export const traceCarteSurLaVente = (compte, carte) => ({ numero: carte.numero, pct: carte.pct, client_user_id: compte.id });

// Les porteurs de carte d'un espace (⭐ Fidèles) : sur la liste DÉJÀ filtrée.
export const porteursDeCarte = (comptesEspace) => (comptesEspace || []).filter((u) => u.role === "client" && carteDe(u));
