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
import { envoiBon, envoiVirementSalaire, envoiAvancement, envoiPrimeInstallationPayee, envoiDepenseRejetee, envoiDepenseValidee, envoiTacheAssignee, envoiTacheValidee, envoiAttestationDisponible, ligneEnvoiModele, recuPdfDepuis } from "./whatsappModeles";
import { attestationDe, momentFermeture, nomDocument } from "./attestationSortie";
import { suiteRejetDepense, suiteValidationDepense, auteurDeLaDepense } from "./validationDepenses";
import { libelleCaisse } from "./constants";
import { fmt, dFR, numeroBulletin, numeroDuRecuDeVente } from "./core";
import { envoisRecuDeVente } from "./recuDeVente";
import { bonsRepriseDeVente, bonRetour, retoursDeVente } from "./bons";
import { libelleMoisFR } from "./calculs";
import { envoiDeCommission } from "./commissionsDues";

// Les deux reçus d'une vente : la fabrique vit dans lib/recuDeVente.js depuis
// le 19/10/2026 (le serveur la relit pour relayer un `recu_pdf` refusé).
// Importée PUIS réexportée (un `export … from` ne crée pas de nom local).
export { envoisRecuDeVente };

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
  // 🧾 L'avis de décision du DG sur une dépense : recomposé depuis la dépense.
  // Rejetée, son montant est à 0 : celui d'origine vit dans `validation`, et
  // la description porte « ✖ REJETÉE (motif) — » devant (rejeterDepense).
  if (m.wa_modele === "depense_rejetee" || m.wa_modele === "depense_validee") {
    const dep = (db?.depenses || []).find((x) => x.id === m.depense_id);
    if (!dep) return "";
    const rejet = m.wa_modele === "depense_rejetee";
    const motif = String(dep.validation?.motif || "");
    const avant = rejet
      ? { ...dep, montant: Number(dep.validation?.montant || 0), description: String(dep.description || "").replace(/^\u2716 REJET\u00c9E \(.*?\) \u2014 /, "") }
      : dep;
    if (rejet && avant.description === avant.categorie) avant.description = "";
    const u = auteurDeLaDepense(db || {}, dep);
    const commun = { employe: u?.nom_complet || u?.nom || m.wa_nom || dep.par, tel: m.wa_numero || u?.tel || "90000000", dep: avant, boutique: libelleCaisse(dep.boutique), fmt, dFR };
    const e = rejet ? envoiDepenseRejetee({ ...commun, motif, suite: suiteRejetDepense(avant) }) : envoiDepenseValidee({ ...commun, suite: suiteValidationDepense(avant) });
    return e ? ligneEnvoiModele(e.modele, e.variables) : "";
  }
  // 📄 L'attestation de fin de contrat : recomposée depuis la marque de la fiche.
  if (m.wa_modele === "attestation_disponible") {
    const u = (db?.users || []).find((x) => x.id === m.attestation_user_id);
    const a = attestationDe(u);
    if (!u || !a) return "";
    const f = momentFermeture(a);
    const e = envoiAttestationDisponible({ employe: u.nom_complet || u.nom, tel: m.wa_numero || u.tel || "90000000", document: nomDocument(a), date: f.date, heure: f.heure });
    return e ? ligneEnvoiModele(e.modele, e.variables) : "";
  }
  // ✅ L'avis d'une tâche : recomposé depuis la tâche, sur la fiche de la personne.
  if (m.wa_modele === "tache_assignee" || m.wa_modele === "tache_validee") {
    const u = (db?.users || []).find((x) => x.id === m.tache_user_id);
    const t = (u?.taches || []).find((x) => x && x.id === m.tache_id);
    if (!u || !t) return "";
    const commun = { employe: u.nom_complet || u.nom, tel: m.wa_numero || u.tel || "90000000", tache: t };
    const e = m.wa_modele === "tache_assignee" ? envoiTacheAssignee({ ...commun, dFR }) : envoiTacheValidee({ ...commun, par: t.valide_par });
    return e ? ligneEnvoiModele(e.modele, e.variables) : "";
  }
  const idVente = m.vente_id || m.bon_vente_id;
  const vente = (db?.ventes || []).find((v) => v.id === idVente);
  if (!vente) return "";
  const boutique = (db?.boutiques || []).find((b) => b.nom === vente.boutique) || {};
  // 📎 Le reçu de vente AVEC son PDF (19/10/2026) : recomposé par la même
  // déduction que l'envoi (`recuPdfDepuis`, le numéro écrit sur le PDF).
  if (m.wa_modele === "recu_pdf") {
    const p = recuPdfDepuis(envoisRecuDeVente(vente, { boutique })[0], { numero: numeroDuRecuDeVente(db || {}, vente) });
    return p ? ligneEnvoiModele(p.modele, p.variables) : "";
  }
  if (m.wa_modele === "recu_vente" || m.wa_modele === "recu_vente_detail" || m.wa_modele === "recu_depot_chantier") {
    const e = envoisRecuDeVente(vente, { boutique }).find((x) => x.modele === m.wa_modele);
    return e ? ligneEnvoiModele(e.modele, e.variables) : "";
  }
  const bon = bonsDeLaVente(db, vente).find((b) => b.numero === m.bon_numero);
  const e = bon ? envoiBon({ bon, boutique, fmt, dFR }) : null;
  return e ? ligneEnvoiModele(e.modele, e.variables) : "";
}
