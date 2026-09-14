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
// hors ligne) : BR-<n° reçu>-<rang> et BT-<n° reçu>-<rang>.
// Pur : le banc l'exerce. L'impression vit dans lib/impression.js.
// ============================================================
import { dFR, fmt, numeroRecu } from "./core";

export const TYPE_BON_REPRISE = "reprise";
export const TYPE_BON_RETOUR = "retour";

const trim = (x) => String(x ?? "").trim();
// « Échange garantie (RET-XXXX) — la panne » → « la panne » ; « Reprise client (REP-XXXX) — motif » → « motif ».
const motifNu = (m) => trim(m).replace(/^(Échange garantie|Reprise client|Défectueux rendu)\s*(\([^)]*\))?\s*[—-]\s*/u, "");

// ---- Bon de reprise ----
export const numeroBonReprise = (vente, reprise) => {
  const rang = (vente?.reprises || []).findIndex((r) => r.ref === reprise?.ref);
  return `BR-${numeroRecu(vente)}-${(rang >= 0 ? rang : (vente?.reprises || []).length) + 1}`;
};
export function bonReprise(db, vente, reprise) {
  if (!vente || !reprise) return null;
  const dette = reprise.dette_id ? (db?.dettes || []).find((d) => d.id === reprise.dette_id) || null : null;
  const montant = Number(reprise.montant || 0);
  const rembourse = Number(reprise.rembourse || 0);
  return {
    type: TYPE_BON_REPRISE, numero: numeroBonReprise(vente, reprise), ref: reprise.ref, date: reprise.date,
    boutique: vente.boutique, client: vente.client || "", tel: vente.tel || "",
    recu: numeroRecu(vente), dateVente: vente.date,
    article: reprise.article, qte: Number(reprise.qte || 0), motif: motifNu(reprise.motif),
    montant, rembourse, moyen: reprise.moyen || "",
    // La dette du client, si la vente était à crédit : réduite de la valeur reprise.
    dette: dette ? { numero: dette.numero || "", reduction: montant, resteApres: Math.max(0, Number(dette.montant || 0) - Number(dette.paye || 0)) } : null,
    par: reprise.par || "",
  };
}

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
  return `BT-${numeroRecu(vente)}-${(rang >= 0 ? rang : (liste || []).length) + 1}`;
};
export function bonRetour(db, vente, retour) {
  if (!vente || !retour) return null;
  const liste = retoursDeVente(db, vente);
  return {
    type: TYPE_BON_RETOUR, numero: numeroBonRetour(vente, retour, liste), ref: retour.ref, date: retour.date,
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
    `${bon.qte} × ${bon.article}`,
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
