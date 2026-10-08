// ---- 💸 LA BANDE NOIRE D'UN VERSEMENT DANS 💰 VENTES (Timo, 08/10/2026) ----
// « Possible de mettre une bande noire de séparation des ventes après chaque
// versement ? » — « 1a, 2a, 3a » : seuls les versements qui vident le TIROIR
// (source espèces), aucune bande pour un versement REJETÉ par le DG, et les
// bandes restent sous les filtres de paiement. Puis « un inventaire bref au
// niveau des bandes : vente espèces, à crédit… » — « a, garde les dettes
// réglées » : la bande résume TOUTES les ventes de la boutique entre ce
// versement et le précédent, par moyen de paiement, et ce résumé NE SUIT PAS
// les filtres (il raconte ce qui s'est passé, quoi qu'on affiche).
//
// Rien n'est écrit : une lecture. Le montant d'une vente est celui de la
// colonne TOTAL de la caisse (`montantEncaisseVente`, la formule écrite UNE
// fois dans lib/versements.js).
//
// ⚠ Un versement d'AVANT le 08/10/2026 n'a pas d'heure : il se place APRÈS la
// dernière vente de son jour (`HEURE_INCONNUE`). Une vente faite ce jour-là
// après le versement est alors comptée dans sa bande — on ne le sait pas.
//
// ⚠ LE MUR : tout est filtré sur le NOM de la boutique regardée (unique dans
// les deux espaces) — jamais une table parcourue en entier pour autre chose.
import { estVersement, estRejete, validationVersement, SOURCE_ESPECES, montantEncaisseVente, libelleDestination } from "./versements.js";
import { PAIEMENTS } from "./constants.js";

const CREDIT = "Crédit (dette)";
// L'ordre de Timo : « vente espèces, à crédit, etc. » — puis les autres moyens
// dans l'ordre de la liste des paiements.
const ORDRE = ["Espèces", CREDIT, ...PAIEMENTS.filter((p) => p !== "Espèces" && p !== CREDIT)];
export const HEURE_INCONNUE = "99:99";
// Les mots courts de la bande (la pastille de paiement dit la même chose).
export const MOT_MOYEN = {
  "Espèces": "Espèces",
  "Crédit (dette)": "À crédit",
  "Mobile Money (Flooz)": "Flooz",
  "Mobile Money (Mixx/T-Money)": "Mixx/T-Money",
  "Virement bancaire": "Virement",
};

const jour = (x) => String(x?.date || "").slice(0, 10);
// LA comparaison du temps, pour le résumé ET pour la place de la bande : une
// vente « avant » le versement (même minute comprise) est sous sa bande.
export const cleVente = (v) => `${jour(v)} ${v?.heure || ""}`;
export const cleVersement = (d) => `${jour(d)} ${d?.versement?.heure || d?.heure || HEURE_INCONNUE}`;
export const venteAvantBande = (v, bande) => cleVente(v) <= bande.cle;

// Un versement qui pose une bande : celui de CETTE boutique, parti du tiroir
// (1a), jamais rejeté (2a — « comme jamais versé »).
export const poseUneBande = (d, boutique) => estVersement(d)
  && d.boutique === boutique
  && !estRejete(d)
  && (d.versement.source || SOURCE_ESPECES) === SOURCE_ESPECES
  && Number(d.montant || 0) > 0;

// Les bandes de la boutique, de la plus RÉCENTE à la plus ancienne, chacune
// avec le résumé des ventes faites depuis le versement précédent.
export function bandesDeVersement(db, boutique, totalVente) {
  const versements = (db?.depenses || []).filter((d) => poseUneBande(d, boutique))
    .sort((a, b) => cleVersement(a).localeCompare(cleVersement(b)));
  if (!versements.length) return [];
  const ventes = (db?.ventes || []).filter((v) => v.boutique === boutique);
  const dettes = (db?.dettes || []).filter((d) => d.boutique === boutique);
  // L'AVANCE d'une vente à crédit : le premier règlement de SA dette, le jour
  // même. Elle se lit avec le crédit (« dont X d'avance »), jamais deux fois
  // dans les dettes réglées.
  const ventesParId = new Map(ventes.map((v) => [v.id, v]));
  const avanceDe = new Map();
  const avances = new Set();
  dettes.forEach((d) => {
    const v = d.vente_id ? ventesParId.get(d.vente_id) : null;
    const p0 = (d.paiements || [])[0];
    if (v && v.paiement === CREDIT && p0 && jour(p0) === jour(v)) { avanceDe.set(v.id, Number(p0.montant || 0)); avances.add(p0); }
  });
  const reglements = dettes.flatMap((d) => (d.paiements || []))
    .filter((p) => !avances.has(p) && (p.paiement || "Espèces") === "Espèces");
  let precedente = "";
  const bandes = versements.map((d, i) => {
    const cle = cleVersement(d);
    const dans = (x) => { const k = cleVente(x); return k > precedente && k <= cle; };
    const par = {};
    let nb = 0, total = 0;
    ventes.filter(dans).forEach((v) => {
      const moyen = v.paiement || "Espèces";
      const m = montantEncaisseVente(v, totalVente);
      const l = (par[moyen] ||= { moyen, mot: MOT_MOYEN[moyen] || moyen, nb: 0, montant: 0, avance: 0 });
      l.nb += 1; l.montant += m; l.avance += avanceDe.get(v.id) || 0;
      nb += 1; total += m;
    });
    const reglesEspeces = reglements.filter(dans).reduce((s, p) => s + Number(p.montant || 0), 0);
    const rang = (m) => { const k = ORDRE.indexOf(m); return k < 0 ? ORDRE.length : k; };
    precedente = cle;
    return {
      id: d.id, cle, date: jour(d), heure: d.versement?.heure || d.heure || "",
      montant: Number(d.montant || 0),
      destination: libelleDestination(d.versement),
      valide: !!validationVersement(db, d),
      par: d.par || "",
      premiere: i === 0,
      nbVentes: nb, totalVentes: total,
      parMoyen: Object.values(par).sort((a, b) => rang(a.moyen) - rang(b.moyen)),
      reglesEspeces,
    };
  });
  return bandes.reverse();
}

// La liste affichée (ventes déjà filtrées, de la plus récente à la plus
// ancienne) avec les bandes posées à leur place : une bande passe juste
// au-dessus de la première vente faite avant elle ; celles qui sont plus
// anciennes que toute la liste viennent à la fin.
export function intercalerBandes(ventesDesc, bandesDesc) {
  const out = [];
  let k = 0;
  (ventesDesc || []).forEach((v, i) => {
    while (k < bandesDesc.length && venteAvantBande(v, bandesDesc[k])) out.push({ bande: bandesDesc[k++] });
    out.push({ vente: v, i });
  });
  while (k < bandesDesc.length) out.push({ bande: bandesDesc[k++] });
  return out;
}

// Le résumé en une ligne : « 14 ventes — Espèces 380 000 F · À crédit
// 250 000 F (dont 50 000 F d'avance) · Flooz 20 000 F ». Un moyen sans vente
// ne s'écrit pas.
export function resumeBande(b, fmt = (x) => String(x)) {
  if (!b.nbVentes) return "Aucune vente";
  const parts = b.parMoyen.map((l) => `${l.mot} ${fmt(l.montant)}${l.moyen === CREDIT && l.avance > 0 ? ` (dont ${fmt(l.avance)} d'avance)` : ""}`);
  return `${b.nbVentes} vente${b.nbVentes > 1 ? "s" : ""} — ${parts.join(" · ")}`;
}
