// ============================================================
// lib/activiteProspection.js — SUIVRE LES COMMERCIAUX QUI PROSPECTENT
// (Timo, 15/11/2026 : « un responsable a-t-il tout ce qu'il faut pour suivre
// son équipe sur le terrain ?… je parle des commerciaux qui prospectent »
// → « Lance 1, 2 et 3 »).
//
//   1. 🧲 Prospects : la colonne « Commercial » pour TOUS ceux qui voient
//      toute l'équipe (pas seulement l'administrateur) ;
//   2. une liste « 👥 Commercial » qui filtre la liste ET les quatre chiffres ;
//   3. 👑 Mon équipe : l'ACTIVITÉ de la période, par personne.
//
// Rien n'est écrit : tout est RELU dans ce qui existe déjà (la fiche du
// prospect et ses contacts notés, les visites de 📅 Rendez-vous, les devis).
// Fichier PUR, SANS import. ⚠ LE MUR : ces fonctions reçoivent des listes
// DÉJÀ filtrées par l'espace regardé — jamais `db` en entier.
// ============================================================

const texte = (v) => String(v == null ? "" : v).trim();

// Les noms qui portent au moins un prospect, par ordre alphabétique français.
export const commerciauxDesProspects = (prospects) =>
  [...new Set((prospects || []).map((p) => texte(p && p.commercial)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

// Les prospects d'UN commercial ; sans nom choisi, toute la liste.
export const prospectsDuCommercial = (prospects, nom) =>
  (texte(nom) ? (prospects || []).filter((p) => texte(p && p.commercial) === texte(nom)) : (prospects || []));

export const prospectActif = (p) => !!p && !p.converti && !p.archive;
// LA règle de « 🔔 À relancer » de l'écran : la date de relance est arrivée.
export const prospectARelancer = (p, aujourdhui) => prospectActif(p) && !!p.relance && p.relance <= aujourdhui;

const dansLaPeriode = (date, debut, fin) => !!date && String(date).slice(0, 10) >= debut && String(date).slice(0, 10) <= fin;
const estDe = (ligne, personne) => (ligne && ligne.par_id ? ligne.par_id === personne.id : texte(ligne && ligne.par) === texte(personne.nom));

// L'activité d'UNE personne. `devis` = les devis de l'espace, à plat ;
// `rendezVous` = ceux que l'écran a le droit de voir ; `estDormant` = LA
// règle des dormants (calculs.js), passée par l'écran.
export function activiteProspection({ personne, prospects, rendezVous, devis, debut, fin, aujourdhui, estDormant }) {
  const siens = prospectsDuCommercial(prospects, personne.nom);
  const actifs = siens.filter(prospectActif);
  return {
    personne,
    // Sur la période :
    enregistres: siens.filter((p) => dansLaPeriode(p.date, debut, fin)).length,
    contacts: siens.reduce((n, p) => n + (p.contacts || []).filter((c) => c && texte(c.par) === texte(personne.nom) && dansLaPeriode(c.date, debut, fin)).length, 0),
    visites: (rendezVous || []).filter((r) => r && r.visite && r.statut === "fait" && dansLaPeriode(r.date, debut, fin)
      && (r.participants || []).includes(personne.id)).length,
    devis: (devis || []).filter((d) => d && estDe(d, personne) && dansLaPeriode(d.date, debut, fin)).length,
    acquis: siens.filter((p) => p.converti && dansLaPeriode(p.date_conversion, debut, fin)).length,
    // Aujourd'hui, quelle que soit la période (ce sont des alertes) :
    actifs: actifs.length,
    aRelancer: actifs.filter((p) => prospectARelancer(p, aujourdhui)).length,
    dormants: estDormant ? siens.filter(estDormant).length : 0,
  };
}

const ROLES_PROSPECTION = ["commercial", "resp_commercial"];
const aQuelqueChose = (a) => a.enregistres + a.contacts + a.visites + a.devis + a.acquis + a.actifs > 0;

// Le tableau de 👑 Mon équipe : les commerciaux, plus toute autre personne
// qui a un prospect ou une activité de prospection. Du plus actif au moins
// actif sur la période (prospects enregistrés, puis contacts, puis le nom).
export function activitesDeLEquipe({ personnes, ...reste }) {
  return (personnes || [])
    .filter((u) => u && u.actif !== false && u.role !== "client")
    .map((u) => activiteProspection({ personne: u, ...reste }))
    .filter((a) => ROLES_PROSPECTION.includes(a.personne.role) || aQuelqueChose(a))
    .sort((a, b) => (b.enregistres - a.enregistres) || (b.contacts - a.contacts)
      || texte(a.personne.nom).localeCompare(texte(b.personne.nom), "fr", { sensitivity: "base" }));
}

// ============================================================
// 4, 5 ET 6 (Timo, 15/11/2026 : « Ab, Ba, Cb, Da, Ea, Fb, Gc, H 4 jours sans
// activité et 2 jours de retard, Ib »).
// ============================================================

// ---- 4. LA POSITION ET L'HEURE RÉELLES ----
// « A b » : à l'enregistrement d'un prospect ET à chaque « Je l'ai contacté ».
// « B a » : si le téléphone ne donne pas la position, on enregistre quand
// même, et c'est DIT (`sans_position`). Une seule position, au moment du
// geste — jamais un suivi permanent. `pos` vient de src/position.js.
export function marqueTerrain(heure, pos) {
  const lat = Number(pos && pos.lat), lng = Number(pos && pos.lng);
  if (pos && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
    const precision = Math.round(Number(pos.precision));
    return { heure: texte(heure), lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, ...(Number.isFinite(precision) && precision > 0 ? { precision } : {}) };
  }
  return { heure: texte(heure), sans_position: true };
}
export const aUnePosition = (m) => !!m && Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lng)) && !m.sans_position;
export const lienCarteTerrain = (m) => (aUnePosition(m) ? `https://www.google.com/maps?q=${m.lat},${m.lng}` : "");
// « c » (15/11/2026) : la position de la MAISON (le point « 📍 Choisir sur la
// carte », qui existe depuis toujours) se remplit d'office avec l'endroit du
// geste quand le commercial n'a rien posé lui-même. Un point choisi à la main
// n'est JAMAIS remplacé. `position_auto` dit d'où vient le point.
export function positionMaisonDepuisGeste(prospect, marque) {
  const p = prospect || {};
  const dejaPose = Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && p.lat !== "" && p.lng !== "" && p.lat != null && p.lng != null;
  if (dejaPose || !aUnePosition(marque)) return {};
  return { lat: marque.lat, lng: marque.lng, position_auto: true };
}
// « C b » : l'administrateur, le responsable commercial et le chef d'équipe ⭐
// — ceux qui voient toute l'équipe. L'écran passe `voitTout`.
export const PHRASE_POSITION_NOTEE = "📍 L'heure et l'endroit où vous êtes sont notés avec ce geste (une seule fois, au moment où vous enregistrez), pour votre responsable.";
export const PHRASE_POSITION_MAISON = "Sans point choisi sur la carte, l'endroit où vous êtes devient la position du prospect.";

// ---- 5. L'OBJECTIF DE PROSPECTION DU MOIS ----
// « D a » : un seul chiffre, les prospects ENREGISTRÉS dans le mois.
// « F b » : un objectif commun (sur les boutiques, comme la limite de
// remise), modifiable personne par personne (sur SA fiche). 0 = aucun.
export const OBJECTIF_MAX = 500;
export const lireObjectif = (v) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, OBJECTIF_MAX) : 0;
};
export const objectifCommun = (boutiques) => {
  const b = (boutiques || []).find((x) => lireObjectif(x && x.objectif_prospection) > 0);
  return b ? lireObjectif(b.objectif_prospection) : 0;
};
export const objectifDe = (personne, boutiques) => {
  const aLui = lireObjectif(personne && personne.objectif_prospection);
  return aLui > 0 ? { nombre: aLui, aLui: true } : { nombre: objectifCommun(boutiques), aLui: false };
};
// Rend "" si la valeur est acceptable, sinon le refus en français.
export function critiqueObjectif(valeur) {
  const t = texte(valeur);
  if (t === "") return "";
  if (!/^\d+$/.test(t)) return "L'objectif est un nombre entier de prospects par mois (0 = aucun objectif).";
  if (Number(t) > OBJECTIF_MAX) return `L'objectif ne dépasse pas ${OBJECTIF_MAX} prospects par mois.`;
  return "";
}
export const debutDuMois = (aujourdhui) => `${String(aujourdhui).slice(0, 7)}-01`;
// Où en est UNE personne ce mois-ci : { objectif, fait, aLui, atteint }.
export function avancementObjectif({ personne, prospects, boutiques, aujourdhui }) {
  const o = objectifDe(personne, boutiques);
  const fait = prospectsDuCommercial(prospects, personne.nom).filter((p) => dansLaPeriode(p.date, debutDuMois(aujourdhui), String(aujourdhui).slice(0, 10))).length;
  return { objectif: o.nombre, aLui: o.aLui, fait, atteint: o.nombre > 0 && fait >= o.nombre };
}
export const ROLES_AVEC_OBJECTIF = ROLES_PROSPECTION;

// ---- 6. L'ALERTE AU RESPONSABLE (tournée de 7 h) ----
// « G c » : un commercial sans prospect enregistré ni contact noté, ET des
// relances laissées en retard. « H » : 4 jours sans activité, 2 jours de
// retard. Le jour où le seuil est ATTEINT, une seule fois (comme une dette
// qui passe les 30 jours) — pas tous les matins.
export const JOURS_SANS_PROSPECTION = 4;
export const JOURS_RETARD_RELANCE = 2;
const joursEntre = (de, a) => {
  const t0 = Date.parse(String(de || "").slice(0, 10)), t1 = Date.parse(String(a || "").slice(0, 10));
  return Number.isNaN(t0) || Number.isNaN(t1) ? null : Math.floor((t1 - t0) / 86400000);
};
// Le dernier jour où la personne a enregistré un prospect ou noté un contact.
export function derniereProspection(personne, prospects) {
  let dernier = "";
  (prospects || []).forEach((p) => {
    if (!p) return;
    if (texte(p.commercial) === texte(personne.nom) && String(p.date || "").slice(0, 10) > dernier) dernier = String(p.date).slice(0, 10);
    (p.contacts || []).forEach((c) => {
      if (c && texte(c.par) === texte(personne.nom) && String(c.date || "").slice(0, 10) > dernier) dernier = String(c.date).slice(0, 10);
    });
  });
  return dernier;
}
// `prospects` : ceux de l'espace de la personne, corbeille écartée. Rend
// { inactif (jours, 0 sinon), depuis, enRetard: [prospects] }.
export function alerteProspection({ personne, prospects, aujourdhui }) {
  const depuis = derniereProspection(personne, prospects);
  const jours = depuis ? joursEntre(depuis, aujourdhui) : null;
  const enRetard = prospectsDuCommercial(prospects, personne.nom)
    .filter((p) => prospectActif(p) && !!p.relance && joursEntre(p.relance, aujourdhui) === JOURS_RETARD_RELANCE);
  return { inactif: jours === JOURS_SANS_PROSPECTION ? jours : 0, depuis, enRetard };
}
