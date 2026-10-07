// ============================================================
// lib/lignesPrivees.js — LE DÉTAIL D'UN REÇU OU D'UN BON, POUR QUI A LE DROIT
// (26/09/2026, Timo : « les messages des reçus vente et reçu vente détaillé
// ne doivent pas être lus par tout le monde… à part celui qui a vendu et les
// administrateurs » → « moi seul », « reprise et retour aussi »).
//
// La ligne rangée dans 📲 WhatsApp ne porte qu'une phrase neutre et le lien
// vers la vente (`wa_prive`, lib/whatsappModeles.js). Ce fichier RECOMPOSE le
// détail depuis la vente, par LES MÊMES fabriques que l'envoi — jamais une
// copie : l'envoi du reçu (💰 Ventes) et l'affichage passent par
// `envoisRecuDeVente`, le bon par `bonsDeLaVente` + `envoiBon`.
// ⚠ Le reçu recomposé reprend l'état À L'ENCAISSEMENT (l'avance posée sur la
// vente) : la ligne dit ce qui est parti ce jour-là, pas ce que la dette est
// devenue depuis.
// ============================================================
import { envoiRecuVente, envoiRecuVenteDetail, envoiBon, envoiVirementSalaire, envoiAvancement, envoiPrimeInstallationPayee, ligneEnvoiModele } from "./whatsappModeles";
import { lignesVente, totalVente, fmt, dFR, numeroBulletin } from "./core";
import { montantEncaisseVente } from "./versements";
import { bonsRepriseDeVente, bonRetour, retoursDeVente } from "./bons";
import { libelleMoisFR } from "./calculs";
import { envoiDeCommission } from "./commissionsDues";

// Les deux reçus d'une vente, le DÉTAILLÉ d'abord (l'ordre de l'envoi).
// `avance` / `reste` : ceux de la dette née de la vente quand l'écran les a,
// sinon ceux posés sur la vente à l'encaissement.
export function envoisRecuDeVente(vente, { boutique = {}, dette = null } = {}) {
  if (!vente) return [];
  const montant = montantEncaisseVente(vente, totalVente);
  const avance = dette ? Number(dette.paye || 0) : Number(vente.avance || 0);
  const reste = dette ? Math.max(0, Number(dette.montant || 0) - Number(dette.paye || 0)) : Math.max(0, montant - avance);
  const base = { vente, boutique, montant, avance, reste, fmt, dFR };
  return [envoiRecuVenteDetail({ ...base, lignes: lignesVente(vente) }), envoiRecuVente(base)].filter(Boolean);
}

// Les bons d'une vente (reprises, puis retours sous garantie).
export const bonsDeLaVente = (db, vente) => [
  ...bonsRepriseDeVente(db, vente),
  ...retoursDeVente(db, vente).map((r) => bonRetour(db, vente, r)),
].filter(Boolean);

// Le détail d'une ligne privée, ou "" si la vente n'est pas sur cet appareil.
export function texteLignePrivee(m, db) {
  if (!m || !m.wa_prive) return "";
  // 💸 L'avis de salaire : recomposé depuis le virement de la fiche (la paie
  // ne descend que chez l'administrateur, le comptable et l'intéressé).
  if (m.wa_modele === "virement_salaire" || m.wa_modele === "virement_salaire_credit") {
    const u = (db?.users || []).find((x) => x.id === m.salaire_user_id);
    const v = (u?.virements || []).find((x) => x.id === m.virement_id);
    if (!u || !v) return "";
    const e = envoiVirementSalaire({ employe: u.nom_complet || u.nom, tel: m.wa_numero || u.tel || "0", mois: libelleMoisFR(v.mois), date: v.date_envoi, montant: v.montant, moyen: v.moyen, reference: v.ref || numeroBulletin(v.mois, u.id), initiateur: { role: v.par, tel: " " }, retenue: m.wa_modele === "virement_salaire_credit" ? v.retenue_credit : 0, resteCredit: v.reste_credit, fmt, dFR });
    return e ? ligneEnvoiModele(e.modele, e.variables) : "";
  }
  // 📈 L'avis d'avancement : recomposé depuis l'évolution de salaire de la fiche.
  if (m.wa_modele === "avancement_employe") {
    const u = (db?.users || []).find((x) => x.id === m.salaire_user_id);
    const ev = (u?.evolutions_salaire || []).find((x) => x.id === m.evolution_id);
    if (!u || !ev) return "";
    const e = envoiAvancement({ employe: u.nom_complet || u.nom, tel: m.wa_numero || u.tel || "90000000", ancien: ev.ancien, nouveau: ev.nouveau, mois: libelleMoisFR(String(ev.date || "").slice(0, 7)), motif: ev.motif, fmt });
    return e ? ligneEnvoiModele(e.modele, e.variables) : "";
  }
  // 🔧 La part d'installation payée : recomposée depuis la ligne de l'équipe
  // et SA dépense (le net payé et le moyen ; la retenue = part − net).
  if (m.wa_modele === "prime_installation_payee") {
    const c = (db?.clients_installes || []).find((x) => x.id === m.chantier_id);
    const e = (c?.equipe || []).find((y) => y.user_id === m.prime_user_id);
    const u = (db?.users || []).find((x) => x.id === m.prime_user_id);
    if (!c || !e || !e.paye) return "";
    const dep = e.dep_id ? (db?.depenses || []).find((d) => d.id === e.dep_id) : null;
    const net = dep ? Number(dep.montant || 0) : 0;
    const x = envoiPrimeInstallationPayee({ employe: u?.nom_complet || u?.nom || e.nom, tel: m.wa_numero || u?.tel || "0", client: [c.nom, c.prenom].filter(Boolean).join(" "), date: e.date_paiement, montant: net, moyen: dep?.moyen, retenue: Math.max(0, Number(e.montant || 0) - net), fmt, dFR });
    return x ? ligneEnvoiModele(x.modele, x.variables) : "";
  }
  // 💰 L'avis de commission due : recomposé depuis la vente ou la dette de pose.
  if (m.wa_modele === "commission_due") {
    const e = envoiDeCommission(db || {}, m.commission_ref)?.envoi;
    return e ? ligneEnvoiModele(e.modele, e.variables) : "";
  }
  const idVente = m.vente_id || m.bon_vente_id;
  const vente = (db?.ventes || []).find((v) => v.id === idVente);
  if (!vente) return "";
  const boutique = (db?.boutiques || []).find((b) => b.nom === vente.boutique) || {};
  if (m.wa_modele === "recu_vente" || m.wa_modele === "recu_vente_detail") {
    const e = envoisRecuDeVente(vente, { boutique }).find((x) => x.modele === m.wa_modele);
    return e ? ligneEnvoiModele(e.modele, e.variables) : "";
  }
  const bon = bonsDeLaVente(db, vente).find((b) => b.numero === m.bon_numero);
  const e = bon ? envoiBon({ bon, boutique, fmt, dFR }) : null;
  return e ? ligneEnvoiModele(e.modele, e.variables) : "";
}
