// ============================================================
// api/_pdfProforma.js — 📎 LE PDF D'UNE PROFORMA, FABRIQUÉ PAR LE SERVEUR
//
// Timo, 15/11/2026 : « Texte ok MAIS AUSSI LIER à nouveau le PDF du
// proforma » — le rappel d'expiration du 13e jour part à 7 h, sans personne
// devant un écran : c'est donc la tournée qui fabrique le PDF.
//
// ⚠ LA MÊME fabrique que l'écran (`genererProforma`, src/pdf.js) et les
// mêmes données que « 🖨️ Réimprimer » (`proformaPourDocument`,
// `lignesAvecFiche`, la fiche de la boutique) : jamais un second dessin.
// ⚠ Chargé À LA DEMANDE par la tournée (import()) : si la fabrique ne se
// charge pas sur le serveur, seul ce rappel est touché, pas la tournée.
// Le « _ » du nom n'en fait pas une fonction serveur (douze au plus).
// ============================================================
import { genererProforma } from "../src/pdf.js";
import { LOGO } from "../src/lib/constants.js";
import { proformaPourDocument, dFR, fichierPdf } from "../src/lib/core.js";
import { lignesAvecFiche } from "../src/lib/pompes.js";

// Rend { octets, mime, nom } ou null (proforma illisible).
export function fichierProformaServeur(pf, { boutiques = [], produits = [] } = {}) {
  if (!pf || !pf.numero) return null;
  const pour = proformaPourDocument(pf);
  const bq = (boutiques || []).find((b) => b && b.nom === pf.boutique) || {};
  const doc = genererProforma({
    ...pour,
    lignes: lignesAvecFiche(pour.lignes, produits, pf.boutique),
    date: dFR(pf.date),
    formation: false,
    bq,
  }, LOGO, true);
  const octets = Buffer.from(doc.output("arraybuffer"));
  if (!octets.length) return null;
  return { octets, mime: "application/pdf", nom: fichierPdf("Proforma", { client: pf.client, numero: pf.numero }) };
}
