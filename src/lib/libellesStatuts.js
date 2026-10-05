// Les MOTS des statuts d'un devis et d'un chantier, écrits UNE fois
// (05/10/2026). 📋 Tous les devis, 🏠 Clients installés et la fiche d'un
// client dans 📋 Clients les lisent : trois écrans qui nommeraient le même
// statut chacun à sa façon finiraient par se contredire.
import { STATUT_SANS_SUITE } from "./devisSansSuite";

export const STATUT_DEVIS = {
  propose: ["⏳ Proposé", "bg-amber-100 text-amber-800 border-amber-300"],
  valide: ["✅ Validé", "bg-sky-100 text-sky-800 border-sky-300"],
  paye: ["💰 Payé", "bg-green-100 text-green-800 border-green-300"],
  corrige: ["🔄 Corrigé — en attente de l'accord du client", "bg-indigo-100 text-indigo-800 border-indigo-300"],
  modification: ["✏️ Modification demandée", "bg-purple-100 text-purple-800 border-purple-300"],
  rejete: ["❌ Rejeté", "bg-red-100 text-red-800 border-red-300"],
  [STATUT_SANS_SUITE]: ["📁 Classé sans suite", "bg-slate-100 text-slate-700 border-slate-300"],
};

// Cycle : en cours → le CHEF DE CHANTIER marque « Terminé » → le CLIENT
// réceptionne (ou émet des réserves). Tant que le client n'a pas réceptionné,
// le chantier n'est pas clos : c'est la protection des deux parties.
export const STATUT_CHANTIER = {
  en_cours: { label: "🔧 En cours", couleur: "text-slate-600 bg-slate-100 border-slate-200" },
  termine: { label: "⏳ Terminé — en attente du client", couleur: "text-amber-700 bg-amber-50 border-amber-200" },
  receptionne: { label: "✅ Réceptionné par le client", couleur: "text-green-700 bg-green-50 border-green-200" },
  reserves: { label: "⚠ Réserves émises par le client", couleur: "text-red-700 bg-red-50 border-red-200" },
  // 🛠 Travaux à crédit soldés (13/09/2026, option A : une trace).
  travaux: { label: "🛠 Travaux — soldés", couleur: "text-purple-700 bg-purple-50 border-purple-200" },
};
