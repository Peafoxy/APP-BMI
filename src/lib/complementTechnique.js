// ============================================================
// lib/complementTechnique.js — LE « COMPLÉMENT DE LA FICHE » D'UN DEVIS SOLAIRE
//
// Timo, 17/11/2026 : « un bouton de complément de la fiche… un écran avec des
// cases à cocher : les sections de câbles (câble solaire PV, câble batterie,
// câble convertisseur coffret), les distances champ solaire / local
// technique, le nombre de lignes série / parallèle, les protections
// (parafoudres, disjoncteurs…). Ça reste facultatif : on peut l'ajouter
// pendant le devis, ou après, par 📋 Tous les devis. » Ses décisions :
//   A a — celui qui a établi le devis, l'administrateur, le responsable
//         commercial (comme « Compléter le devis ») ;
//   B   — permis AUSSI après la validation ou le paiement : le complément ne
//         change ni le matériel ni le prix, seulement la fiche technique ;
//   C   — les sections se CHOISISSENT dans une liste de valeurs usuelles ;
//   D   — le solaire seulement.
//
// Le complément vit SUR LE DEVIS (`complement_technique`) : il suit le devis
// repris, corrigé ou mis en brouillon. Il est LU par le document technique
// (lib/documentTechnique.js) — rien d'autre ne s'en sert.
//
// ⚠ L'application n'invente et ne contrôle AUCUNE section : elle écrit ce que
// la personne a saisi, et le document le dit (« renseigné par BMI, à valider
// par le technicien »). Elle ne sait pas si 6 mm² suffit pour 30 m.
// ⚠ Ce fichier n'importe RIEN et ne reçoit jamais `db`.
// ============================================================

export const SECTIONS_CABLE = [4, 6, 10, 16, 25, 35, 50, 70, 95];
export const CABLES = [
  { id: "pv", libelle: "Câble solaire PV", trajet: "panneaux → convertisseur / coffret DC" },
  { id: "batterie", libelle: "Câble batterie", trajet: "batteries → convertisseur" },
  { id: "ac", libelle: "Câble convertisseur → coffret AC", trajet: "convertisseur → coffret AC" },
];
export const PROTECTIONS = [
  { id: "parafoudre_dc", libelle: "Parafoudre DC (côté panneaux)" },
  { id: "parafoudre_ac", libelle: "Parafoudre AC" },
  { id: "disjoncteur_dc", libelle: "Disjoncteur ou sectionneur DC (panneaux)" },
  { id: "fusible_dc", libelle: "Fusible DC" },
  { id: "disjoncteur_batterie", libelle: "Disjoncteur batterie" },
  { id: "disjoncteur_ac", libelle: "Disjoncteur AC" },
  { id: "differentiel", libelle: "Différentiel" },
  { id: "terre", libelle: "Mise à la terre" },
];
export const SUPPORTS = ["Toiture en tôle", "Toiture en dalle", "Au sol", "Autre"];
export const ORIENTATIONS = ["Sud", "Sud-Est", "Sud-Ouest", "Est", "Ouest", "Nord", "Autre"];

export const LOCAL_MAX = 80;
export const CALIBRE_MAX = 20;
export const AUTRES_MAX = 200;
export const NOM_PROTECTION_MAX = 60;
export const QTE_PROTECTION_MAX = 1000;

export const PHRASE_A_VALIDER = "Renseigné par BMI TOGO d'après les informations disponibles ; à valider par le technicien lors de l'installation.";

const nombre = (v) => {
  const t = String(v ?? "").replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const entier = (v) => { const n = nombre(v); return n === null ? null : Math.round(n); };
const texte = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const dansListe = (v, liste) => (liste.includes(v) ? v : "");

// Le complément remis au propre : on ne garde QUE ce qui est renseigné
// (une liste, un nombre, un texte court) ; tout le reste est écarté.
export function nettoyerComplement(c) {
  const src = c && typeof c === "object" ? c : {};
  const imp = src.implantation || {};
  const mon = src.montage || {};
  const sortie = {};

  const implantation = {};
  const support = dansListe(imp.support, SUPPORTS); if (support) implantation.support = support;
  const orientation = dansListe(imp.orientation, ORIENTATIONS); if (orientation) implantation.orientation = orientation;
  const inclinaison = nombre(imp.inclinaison); if (inclinaison !== null && inclinaison >= 0 && inclinaison <= 90) implantation.inclinaison = Math.round(inclinaison * 10) / 10;
  const local = texte(imp.local, LOCAL_MAX); if (local) implantation.local = local;
  const dist = nombre(imp.distance_champ_local); if (dist !== null && dist > 0 && dist <= 1000) implantation.distance_champ_local = Math.round(dist * 10) / 10;
  if (Object.keys(implantation).length) sortie.implantation = implantation;

  const montage = {};
  const serie = entier(mon.serie); if (serie !== null && serie >= 1 && serie <= 100) montage.serie = serie;
  const parallele = entier(mon.parallele); if (parallele !== null && parallele >= 1 && parallele <= 100) montage.parallele = parallele;
  if (Object.keys(montage).length) sortie.montage = montage;

  const cables = {};
  for (const { id } of CABLES) {
    const l = (src.cables || {})[id] || {};
    const ligne = {};
    const s = nombre(l.section); if (s !== null && SECTIONS_CABLE.includes(s)) ligne.section = s;
    const m = nombre(l.longueur); if (m !== null && m > 0 && m <= 1000) ligne.longueur = Math.round(m * 10) / 10;
    if (Object.keys(ligne).length) cables[id] = ligne;
  }
  if (Object.keys(cables).length) sortie.cables = cables;

  const protections = {};
  for (const { id } of PROTECTIONS) {
    const p = (src.protections || {})[id];
    if (!p || !p.prevu) continue;
    const ligne = { prevu: true };
    const calibre = texte(p.calibre, CALIBRE_MAX); if (calibre) ligne.calibre = calibre;
    const q = entier(p.qte); if (q !== null && q >= 1 && q <= QTE_PROTECTION_MAX) ligne.qte = q;
    protections[id] = ligne;
  }
  if (Object.keys(protections).length) sortie.protections = protections;

  // Les protections AJOUTÉES librement (bouton « Autre ») : une liste, SANS
  // limite de nombre (Timo, 18/11/2026) ; une ligne sans nom n'existe pas.
  const libres = (Array.isArray(src.protections_libres) ? src.protections_libres : []).map((l) => {
    const nom = texte(l && l.nom, NOM_PROTECTION_MAX);
    if (!nom) return null;
    const ligne = { nom };
    const calibre = texte(l.calibre, CALIBRE_MAX); if (calibre) ligne.calibre = calibre;
    const q = entier(l.qte); if (q !== null && q >= 1 && q <= QTE_PROTECTION_MAX) ligne.qte = q;
    return ligne;
  }).filter(Boolean);
  if (libres.length) sortie.protections_libres = libres;

  const autres = texte(src.autres, AUTRES_MAX); if (autres) sortie.autres = autres;
  return sortie;
}

export const complementVide = (c) => Object.keys(nettoyerComplement(c)).length === 0;

// « » si ce qui est saisi tient debout ; sinon la phrase qui dit quoi corriger.
// Une valeur illisible n'est pas écartée en silence : on le dit.
export function critiqueComplement(c) {
  const src = c && typeof c === "object" ? c : {};
  const imp = src.implantation || {};
  const mon = src.montage || {};
  const hors = (v, mini, maxi) => { const n = nombre(v); return String(v ?? "").trim() !== "" && (n === null || n < mini || n > maxi); };
  if (hors(imp.inclinaison, 0, 90)) return "L'inclinaison des panneaux se donne en degrés, entre 0 et 90.";
  if (hors(imp.distance_champ_local, 0.1, 1000)) return "La distance champ solaire → local technique se donne en mètres (plus de 0, 1 000 m au plus).";
  if (hors(mon.serie, 1, 100)) return "Le nombre de panneaux en série se donne en nombre entier, de 1 à 100.";
  if (hors(mon.parallele, 1, 100)) return "Le nombre de lignes en parallèle se donne en nombre entier, de 1 à 100.";
  for (const { id, libelle } of PROTECTIONS) {
    const p = (src.protections || {})[id];
    if (p && p.prevu && hors(p.qte, 1, QTE_PROTECTION_MAX)) return `La quantité de « ${libelle} » se donne en nombre entier, de 1 à ${QTE_PROTECTION_MAX}.`;
  }
  for (const l of (Array.isArray(src.protections_libres) ? src.protections_libres : [])) {
    const nom = texte(l && l.nom, NOM_PROTECTION_MAX);
    const rempli = l && (String(l.calibre ?? "").trim() !== "" || String(l.qte ?? "").trim() !== "");
    if (!nom && rempli) return "Une protection ajoutée a un calibre ou une quantité mais pas de nom : donnez-lui un nom, ou retirez-la.";
    if (nom && hors(l.qte, 1, QTE_PROTECTION_MAX)) return `La quantité de « ${nom} » se donne en nombre entier, de 1 à ${QTE_PROTECTION_MAX}.`;
  }
  for (const { id, libelle } of CABLES) {
    const l = (src.cables || {})[id] || {};
    if (hors(l.longueur, 0.1, 1000)) return `La longueur du « ${libelle} » se donne en mètres (plus de 0, 1 000 m au plus).`;
    if (String(l.section ?? "").trim() !== "" && !SECTIONS_CABLE.includes(nombre(l.section))) return `Choisissez la section du « ${libelle} » dans la liste.`;
  }
  return "";
}

// Combien de panneaux le montage annonce (série × parallèle), et s'il
// correspond à ceux du devis. `panneaux` = le nombre du devis (ou null).
export const panneauxDuMontage = (c) => {
  const m = nettoyerComplement(c).montage || {};
  return m.serie && m.parallele ? m.serie * m.parallele : 0;
};
export function avertissementMontage(c, panneaux) {
  const total = panneauxDuMontage(c);
  const n = Number(panneaux || 0);
  if (!total || !(n > 0) || total === n) return "";
  return `Le montage annonce ${total} panneaux (${nettoyerComplement(c).montage.serie} en série × ${nettoyerComplement(c).montage.parallele} lignes) alors que le devis en compte ${n}.`;
}

// Le nombre de panneaux d'un devis (la somme des lignes « panneau »).
export const panneauxDuDevis = (devis) => (Array.isArray(devis && devis.lignes) ? devis.lignes : [])
  .filter((l) => l && /panneau/i.test(String(l.categorie || "")))
  .reduce((s, l) => s + (Number(l.qte) > 0 ? Number(l.qte) : 0), 0);

// Qui range ou corrige le complément (décisions « A a » et « B ») : celui qui
// a établi le devis, l'administrateur, le responsable commercial — à tout
// moment, validé ou payé compris. « » si permis ; sinon le motif.
export const ROLES_COMPLETENT_FICHE = ["admin", "resp_commercial"];
export function motifRefusComplement(devis, profile) {
  if (!devis) return "Devis introuvable.";
  const auteur = !!devis.par_id && devis.par_id === (profile && profile.id);
  if (!auteur && !ROLES_COMPLETENT_FICHE.includes(profile && profile.role))
    return `🔒 Seul ${devis.par || "celui qui a établi ce devis"}, l'administrateur ou le responsable commercial peut compléter la fiche technique.`;
  return "";
}
export const peutCompleterFiche = (devis, profile) => motifRefusComplement(devis, profile) === "";

// Le devis avec son complément (ou sans, s'il est vidé). La trace dit qui et
// quand ; le matériel, les prix, le statut ne bougent JAMAIS.
export function appliquerComplement(devis, complement, profile, jour) {
  const propre = nettoyerComplement(complement);
  const { complement_technique: _ancien, ...reste } = devis || {};
  if (!Object.keys(propre).length) return reste;
  return { ...reste, complement_technique: { ...propre, par: profile && profile.nom || "", par_id: profile && profile.id || "", le: jour || "" } };
}

// Le complément d'un devis, remis au propre, SANS la trace (pour le formulaire
// et le document).
export const complementDuDevis = (devis) => nettoyerComplement(devis && devis.complement_technique);

// Une phrase courte pour dire ce que le complément contient (le bouton, le journal).
export function resumeComplement(c) {
  const p = nettoyerComplement(c);
  if (!Object.keys(p).length) return "";
  const bouts = [];
  const nbCables = Object.keys(p.cables || {}).length;
  const nbProt = Object.keys(p.protections || {}).length + (p.protections_libres || []).length;
  if (p.implantation) bouts.push("implantation");
  if (p.montage) bouts.push("montage");
  if (nbCables) bouts.push(`${nbCables} câble${nbCables > 1 ? "s" : ""}`);
  if (nbProt) bouts.push(`${nbProt} protection${nbProt > 1 ? "s" : ""}`);
  if (p.autres) bouts.push("précisions");
  return bouts.join(", ");
}
