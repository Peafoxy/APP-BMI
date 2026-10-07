// ============================================================
// lib/bons.js — LE BON DE REPRISE ET LE BON DE RETOUR
//
// Timo (14/09/2026), après « Reprise de l'article par BMI » : « pour cette
// reprise, ce n'est pas judicieux de sortir un reçu ? comment ça se passe
// avec les grands logiciels ? » → un avoir / bon, jamais le reçu de vente
// réimprimé ; puis « dans la foulée, le retour sous garantie pour un bon de
// retour… bon de reprise et bon de retour, les deux ».
//
// Deux documents, UNE règle : le reçu de vente reste tel quel, le bon est
// un document DE PLUS, pas une écriture. Il cite le reçu d'origine, l'article,
// la quantité, le motif, et ce qui a bougé pour le client :
//   • bon de reprise (↩ BMI reprend l'article) : valeur reprise, argent rendu
//     (et comment) ou dette réduite ; le client signe « j'ai reçu … » ;
//   • bon de retour (🔁 échange sous garantie) : l'article de remplacement
//     remis, le défectueux repris, frais facturés (dette) ou gratuit.
// Numéro dérivé du reçu (aucun compteur, rien à coller, jamais de collision
// hors ligne) : REP-<n° reçu>-<rang> et RET-<n° reçu>-<rang> — Timo
// (14/09/2026) : « bon de reprise et bon de retour, tous BR, ça va pas porter
// confusion ? » → les mêmes mots que les références du journal, lisibles.
// Pur : le banc l'exerce. L'impression vit dans lib/impression.js.
// ============================================================
import { dFR, fmt, numeroRecu, lignesVente, totalVente } from "./core";
import { montantEncaisseVente } from "./versements";

export const TYPE_BON_REPRISE = "reprise";
export const TYPE_BON_RETOUR = "retour";

const trim = (x) => String(x ?? "").trim();
// « Échange garantie (RET-XXXX) — la panne » → « la panne » ; « Reprise client (REP-XXXX) — motif » → « motif ».
const motifNu = (m) => trim(m).replace(/^(Échange garantie|Reprise client|Défectueux rendu)\s*(\([^)]*\))?\s*[—-]\s*/u, "");

// ---- Bon de reprise ----
// ⚠ UNE REPRISE PEUT PORTER PLUSIEURS ARTICLES (06/10/2026, « 1 oui, 2 oui ») :
// ses lignes partagent le même `ref` dans `vente.reprises`, et elles font UN
// bon. Le rang compte les REPRISES (les `ref` distincts), pas les lignes —
// une vente aux reprises d'un seul article garde exactement ses numéros.
export const refsDeReprises = (vente) => [...new Set((vente?.reprises || []).map((r) => r.ref).filter(Boolean))];
export const lignesDeLaReprise = (vente, ref) => (vente?.reprises || []).filter((r) => r.ref === ref);
export const numeroBonReprise = (vente, reprise) => {
  const refs = refsDeReprises(vente);
  const rang = refs.indexOf(reprise?.ref);
  return `REP-${numeroRecu(vente)}-${(rang >= 0 ? rang : refs.length) + 1}`;
};
export function bonReprise(db, vente, reprise) {
  if (!vente || !reprise) return null;
  // La reprise reçue fait foi pour SA ligne (on peut passer une copie
  // modifiée) ; les autres lignes du même `ref` viennent de la vente.
  const memeLigne = (r) => r === reprise || (r.id && r.id === reprise.id) || (!r.id && !reprise.id && r.produit_id === reprise.produit_id);
  const freres = lignesDeLaReprise(vente, reprise.ref);
  const toutes = freres.some(memeLigne) ? freres.map((r) => (memeLigne(r) ? reprise : r)) : [reprise, ...freres];
  const lignes = toutes.map((r) => ({ article: r.article, qte: Number(r.qte || 0), montant: Number(r.montant || 0) }));
  const tete = reprise;
  const dette = tete.dette_id ? (db?.dettes || []).find((d) => d.id === tete.dette_id) || null : null;
  const montant = lignes.reduce((s, l) => s + l.montant, 0);
  const rembourse = toutes.reduce((s, r) => s + Number(r.rembourse || 0), 0);
  return {
    type: TYPE_BON_REPRISE, numero: numeroBonReprise(vente, tete), ref: tete.ref, date: tete.date, vente_id: vente.id,
    boutique: vente.boutique, client: vente.client || "", tel: vente.tel || "",
    recu: numeroRecu(vente), dateVente: vente.date,
    // Un seul article : comme avant. Plusieurs : `lignes` les porte toutes,
    // et `article` / `qte` restent ceux de la première (rien ne casse).
    article: lignes[0].article, qte: lignes[0].qte, lignes, motif: motifNu(tete.motif),
    montant, rembourse, moyen: tete.moyen || "",
    // La dette du client, si la vente était à crédit : réduite de la valeur reprise.
    dette: dette ? { numero: dette.numero || "", reduction: montant, resteApres: Math.max(0, Number(dette.montant || 0) - Number(dette.paye || 0)) } : null,
    par: tete.par || "",
    // 🧾 LA VENTE D'ORIGINE ET LA NOUVELLE SITUATION (07/10/2026, « a, lance »,
    // devant le modèle de bon de ChatGPT) — calculées par `situationReprise`.
    ...situationReprise(db, vente, tete.ref, lignes),
  };
}

// 🧾 La vente d'origine (chaque article, sa quantité, son prix), puis la
// nouvelle situation : montant d'origine − TOUTES les reprises jusqu'à
// celle-ci comprise = nouveau montant ; déjà payé (net de ce qui a été rendu)
// et reste à payer. ⚠ Le montant d'origine est celui que le client avait à
// payer (`montantEncaisseVente` : LA formule du reçu et de la caisse, frais
// compris). ⚠ Ce qui a été payé se lit à ce jour : une vente à crédit
// prend les versements de SA dette (`vente_id`), une vente comptant son
// montant d'origine.
export function situationReprise(db, vente, ref, lignesBon = []) {
  const refs = refsDeReprises(vente);
  const rang = refs.indexOf(ref);
  const jusquIci = refs.slice(0, rang >= 0 ? rang + 1 : refs.length);
  const reprisesJusquIci = (vente?.reprises || []).filter((r) => jusquIci.includes(r.ref));
  const precedentes = reprisesJusquIci.filter((r) => r.ref !== ref);
  const venteInitiale = lignesVente(vente).map((l) => ({
    article: l.article, qte: Number(l.qte || 0), pu: Number(l.pu || 0),
    montant: Number(l.qte || 0) * Number(l.pu || 0) - Number(l.remise_ligne || 0),
  }));
  const remiseVente = Number(vente?.remise || 0) + Number(vente?.rabais || 0);
  const frais = Number(vente?.frais_installation || 0) + Number(vente?.frais_transport || 0);
  const montantInitial = montantEncaisseVente(vente, totalVente);
  const repris = lignesBon.reduce((s, l) => s + Number(l.montant || 0), 0);
  const reprisAvant = precedentes.reduce((s, r) => s + Number(r.montant || 0), 0);
  const nouveauMontant = Math.max(0, montantInitial - repris - reprisAvant);
  const detteVente = (db?.dettes || []).find((d) => d.vente_id === vente?.id) || null;
  const paye = detteVente ? Number(detteVente.paye || 0) : montantInitial;
  const rendu = reprisesJusquIci.reduce((s, r) => s + Number(r.rembourse || 0), 0);
  const dejaPaye = Math.max(0, paye - rendu);
  // Prix unitaire de ce qui est repris : celui de la vente (avant remises).
  const puDe = (article) => (venteInitiale.find((v) => v.article === article) || {}).pu || 0;
  return {
    vendeur: vente?.par || "",
    venteInitiale, remiseVente, frais, montantInitial,
    lignesPrix: lignesBon.map((l) => ({ ...l, pu: puDe(l.article) })),
    reprisAvant, nbReprisesAvant: [...new Set(precedentes.map((r) => r.ref))].length,
    nouveauMontant, dejaPaye, resteAPayer: Math.max(0, nouveauMontant - dejaPaye),
  };
}
// Les bons de reprise d'une vente : UN par reprise, quel que soit son nombre d'articles.
export const bonsRepriseDeVente = (db, vente) => refsDeReprises(vente)
  .map((ref) => bonReprise(db, vente, lignesDeLaReprise(vente, ref)[0]))
  .filter(Boolean);
// « 2 × Support M8 · 1 × Rail » — la liste lisible d'un bon.
export const articlesDuBon = (bon) => (bon?.lignes?.length ? bon.lignes : [{ article: bon?.article, qte: bon?.qte }])
  .map((l) => `${l.qte} × ${l.article}`).join(" · ");

// ---- Bon de retour (échange sous garantie) ----
// Les retours d'une vente vivent dans les ajustements (`echange_garantie` =
// le remplacement sorti, `retour_defectueux` = le défectueux entré au SAV,
// même `ref`) et, s'il y a des frais, dans une dette `retour_ref`.
export function retoursDeVente(db, vente) {
  if (!vente) return [];
  const sorties = (db?.ajustements || []).filter((a) => a.type === "echange_garantie" && a.vente_id === vente.id);
  return sorties
    .sort((a, b) => `${a.date} ${a.id}`.localeCompare(`${b.date} ${b.id}`))
    .map((s) => {
      const sav = (db?.ajustements || []).find((a) => a.type === "retour_defectueux" && a.ref === s.ref) || null;
      const produit = (db?.produits || []).find((p) => p.id === s.produit_id) || null;
      const dette = (db?.dettes || []).find((d) => d.retour_ref === s.ref) || null;
      return {
        ref: s.ref, date: s.date, produit_id: s.produit_id,
        article: sav?.article || produit?.nom || "?", qte: Math.abs(Number(s.qte || 0)),
        motif: motifNu(s.motif), par: s.par || "", prix_achat: Number(s.prix_achat || 0),
        dette: dette ? { numero: dette.numero || "", montant: Number(dette.montant || 0), motif: motifNu(String(dette.motif || "").replace(/^SAV\s+\S+\s*[—-]\s*/u, "")) } : null,
        statutSav: sav?.statut || "en_sav",
      };
    });
}
export const numeroBonRetour = (vente, retour, liste) => {
  const rang = (liste || []).findIndex((r) => r.ref === retour?.ref);
  return `RET-${numeroRecu(vente)}-${(rang >= 0 ? rang : (liste || []).length) + 1}`;
};
export function bonRetour(db, vente, retour) {
  if (!vente || !retour) return null;
  const liste = retoursDeVente(db, vente);
  return {
    type: TYPE_BON_RETOUR, numero: numeroBonRetour(vente, retour, liste), ref: retour.ref, date: retour.date, vente_id: vente.id,
    boutique: vente.boutique, client: vente.client || "", tel: vente.tel || "",
    recu: numeroRecu(vente), dateVente: vente.date,
    article: retour.article, qte: retour.qte, motif: retour.motif,
    frais: retour.dette ? { montant: retour.dette.montant, detail: retour.dette.motif, numero: retour.dette.numero } : null,
    gratuit: !retour.dette,
    par: retour.par,
  };
}

// ---- Le texte WhatsApp des deux bons (UNE règle, exercée par le banc) ----
export function texteBon(bon, bq = {}) {
  if (!bon) return "";
  const tete = [
    bq.formation ? "🎓 *DOCUMENT DE FORMATION — SANS VALEUR*" : null,
    bq.formation ? "------------------------" : null,
    bon.type === TYPE_BON_REPRISE ? `↩ *BON DE REPRISE — ${bon.boutique}*` : `🔁 *BON DE RETOUR (garantie) — ${bon.boutique}*`,
    bq.adresse || "Lomé, Togo",
    bq.tel ? `Tél : ${bq.tel}` : null,
    "------------------------",
    `N° : ${bon.numero}`,
    `Date : ${dFR(bon.date)}`,
    `Reçu d'origine : ${bon.recu} du ${dFR(bon.dateVente)}`,
    bon.client ? `Client : ${bon.client}` : null,
    "------------------------",
    ...(bon.lignes?.length > 1 ? bon.lignes.map((l) => `${l.qte} × ${l.article} — ${fmt(l.montant)}`) : [`${bon.qte} × ${bon.article}`]),
    `Motif : ${bon.motif}`,
  ];
  const corps = bon.type === TYPE_BON_REPRISE
    ? [
      `Valeur reprise : ${fmt(bon.montant)}`,
      bon.dette ? `Dette réduite de ${fmt(bon.dette.reduction)}${bon.dette.numero ? ` (dette ${bon.dette.numero})` : ""}` : null,
      bon.rembourse > 0 ? `*Rendu au client : ${fmt(bon.rembourse)}* (${bon.moyen})` : (bon.dette ? "Rien à rendre : la dette est réduite d'autant." : null),
      "L'article est repris par BMI ; le reçu de vente reste valable pour le reste.",
    ]
    : [
      `Article de remplacement remis : ${bon.qte} × ${bon.article}`,
      "L'article défectueux est repris par BMI (SAV).",
      bon.gratuit ? "*Échange GRATUIT sous garantie.*" : `*Frais facturés : ${fmt(bon.frais.montant)}*${bon.frais.detail ? ` (${bon.frais.detail})` : ""}${bon.frais.numero ? ` — dette ${bon.frais.numero}` : ""}`,
    ];
  return [...tete, ...corps, "------------------------", `Établi par : ${bon.par}`, bq.message || "Merci de votre confiance !"].filter(Boolean).join("\n");
}
