// ============================================================
// lib/recuDeVente.js — LES REÇUS D'UNE VENTE, UNE SEULE FABRIQUE (19/10/2026)
//
// Sortie de lib/lignesPrivees.js le 19/10/2026 pour que le SERVEUR puisse la
// lire (le relais d'un `recu_pdf` refusé par Meta, lib/relaisRecuPdf.js) :
// l'envoi (💰 Ventes), l'affichage d'une ligne privée (📲 WhatsApp) et le
// relais du serveur passent tous par CETTE fonction — jamais une copie.
// Lisible par le serveur : imports en `.js`.
// ============================================================
import { envoiRecuVente, envoiRecuVenteDetail, envoiRecuDepotChantier } from "./whatsappModeles.js";
import { lignesVente, totalVente, fmt, dFR, estDepotChantier } from "./core.js";
import { montantEncaisseVente } from "./versements.js";

// Les deux reçus d'une vente, le DÉTAILLÉ d'abord (l'ordre de l'envoi).
// `avance` / `reste` : ceux de la dette née de la vente quand l'écran les a,
// sinon ceux posés sur la vente à l'encaissement.
export function envoisRecuDeVente(vente, { boutique = {}, dette = null } = {}) {
  if (!vente) return [];
  const montant = montantEncaisseVente(vente, totalVente);
  const avance = dette ? Number(dette.paye || 0) : Number(vente.avance || 0);
  const reste = dette ? Math.max(0, Number(dette.montant || 0) - Number(dette.paye || 0)) : Math.max(0, montant - avance);
  const base = { vente, boutique, montant, avance, reste, fmt, dFR };
  // 🏗 Un DÉPÔT CHANTIER (13/10/2026, « C b ») : SON reçu, et lui seul — jamais
  // le reçu de vente (« merci pour votre achat ») en repli.
  if (estDepotChantier(vente)) return [envoiRecuDepotChantier(base)].filter(Boolean);
  return [envoiRecuVenteDetail({ ...base, lignes: lignesVente(vente) }), envoiRecuVente(base)].filter(Boolean);
}
