// ============================================================
// lib/commissionsDues.js — LES COMMISSIONS DEVENUES DUES, PUIS PAYÉES, À ANNONCER
// (💰 la commission PAYÉE, 13/11/2026 : voir en bas du fichier)
// (Timo, 03/10/2026 : « pour une commission due » → « 2 due, commercial et
// technicien, parrain et apporteur externe » ; « 3 oui » : le message part le
// jour où l'administrateur principal ouvre l'application).
//
// Une commission devient DUE après DEUX choses : la réception des travaux ET
// le solde du client (règle de la maison, `commissionBloquee` /
// `partParrainBloquee` / `posesAvecApporteur`, lib/calculs.js — RÉUTILISÉES,
// jamais recopiées). Ce fichier ne calcule aucune commission : il DIT
// lesquelles sont dues, pas encore payées, pas encore annoncées, et à qui
// écrire. L'envoi et la marque vivent dans App.jsx.
//
// 🔧 « 2b » (03/10/2026) : le TECHNICIEN reçoit aussi l'avis pour SA PART DES
// FRAIS D'INSTALLATION (🏠 Clients installés → 🔧 Frais), une fois la
// répartition faite, le chantier RÉCEPTIONNÉ et le client SOLDÉ (sa vente,
// sinon la dette de pose). Marque `avise_le` sur sa ligne de l'équipe.
//
// ⚠ LE MUR : seulement le RÉEL (un message part vers un vrai numéro) — les
// boutiques de formation sont écartées ici, quel que soit l'espace regardé.
// ⚠ LE PASSÉ : une commission devenue due AVANT la mise en service
// (`DEBUT_AVIS_COMMISSION`) ne s'annonce pas — sinon le premier matin aurait
// écrit à tous les bénéficiaires depuis le début. Sa date de dette = la plus
// récente de : la vente, le dernier versement de sa dette, la réception de son
// chantier.
// ============================================================
import { commissionBloquee, commissionPour, partParrainBloquee, posesAvecApporteur, detteDeVente, boutiquesFormation, venteSoldee, statutChantier, resteAPayer, estCompteFormation } from "./calculs";
import { chantierDeFormation } from "./rappelEntretien";
import { envoiCommissionDue, envoiCommissionPayee, pourCommissionPayee } from "./whatsappModeles";
import { memeNumero } from "./identiteClient";
import { fmt, dFR } from "./core";

export const DEBUT_AVIS_COMMISSION = "2026-10-04";

const dateDue = (v, dette, chantier) => {
  const dates = [String(v?.date || "").slice(0, 10)];
  (dette?.paiements || []).forEach((x) => dates.push(String(x.date || "").slice(0, 10)));
  if (chantier?.receptionne_le) dates.push(String(chantier.receptionne_le).slice(0, 10));
  return dates.filter(Boolean).sort().pop() || "";
};

// Le contexte commun (lu une fois) : qui est employé, qui a un espace client.
function contexte(db) {
  const users = (db.users || []).filter((u) => u.actif !== false && !u.bloque);
  const employes = users.filter((u) => u.role !== "client" && !u.formation);
  const clients = users.filter((u) => u.role === "client" && !u.formation);
  const boutique = (nom) => (db.boutiques || []).find((b) => b.nom === nom) || {};
  const aEspace = (t) => clients.some((c) => c.tel && memeNumero(c.tel, t));
  return { employes, boutique, aEspace };
}

// LE message d'une commission, désignée par `ref` — écrit UNE fois : la liste
// à annoncer ET le détail relu dans 📲 WhatsApp (lib/lignesPrivees.js) y
// passent. Rend { tel, nom, envoi } ou null. Ne regarde ni la marque ni la date.
export function envoiDeCommission(db, ref, ctx = contexte(db)) {
  if (!ref) return null;
  if (ref.type === "dette") {
    const d = (db.dettes || []).find((x) => x.id === ref.id);
    const a = d?.apporteur;
    if (!a || !a.nom || !(Number(a.montant || 0) > 0)) return null;
    const envoi = envoiCommissionDue({ nom: a.nom, tel: a.tel, montant: Number(a.montant), client: d.client, espace: ctx.aEspace(a.tel), boutique: ctx.boutique(d.boutique_pose || d.boutique), fmt });
    return envoi ? { tel: a.tel, nom: a.nom, envoi } : null;
  }
  if (ref.type === "chantier") {
    const c = (db.clients_installes || []).find((x) => x.id === ref.id);
    const e = (c?.equipe || []).find((y) => y.user_id === ref.user_id);
    const u = e ? ctx.employes.find((x) => x.id === e.user_id) : null;
    const montant = Number(e?.montant || 0);
    const client = [c?.nom, c?.prenom].filter(Boolean).join(" ");
    const envoi = u && montant > 0 ? envoiCommissionDue({ nom: u.nom_complet || u.nom, tel: u.tel, montant, client, espace: true, fmt }) : null;
    return envoi ? { tel: u.tel, nom: u.nom, envoi } : null;
  }
  const v = (db.ventes || []).find((x) => x.id === ref.id);
  if (!v) return null;
  if (ref.qui === "apporteur") {
    const a = v.apporteur;
    if (!a || !a.nom || !(Number(a.montant || 0) > 0)) return null;
    const envoi = envoiCommissionDue({ nom: a.nom, tel: a.tel, montant: Number(a.montant), client: v.client, espace: ctx.aEspace(a.tel), boutique: ctx.boutique(v.boutique), fmt });
    return envoi ? { tel: a.tel, nom: a.nom, envoi } : null;
  }
  const nom = ref.qui === "responsable" ? v.responsable : v.commercial;
  const u = nom ? ctx.employes.find((x) => x.nom === nom) : null;
  const montant = u ? commissionPour(v, nom, Number(u.taux_commission || 0), db) : 0;
  const envoi = u && montant > 0 ? envoiCommissionDue({ nom: u.nom_complet || u.nom, tel: u.tel, montant, client: v.client, espace: true, fmt }) : null;
  return envoi ? { tel: u.tel, nom: u.nom, envoi } : null;
}

// Rend [{ cle, ref, tel, nom, envoi }]. `ref` dit où poser la marque :
// { type: "vente", id, qui: "commercial" | "responsable" | "apporteur" } ou
// { type: "dette", id } (l'apporteur d'une pose seule) ou
// { type: "chantier", id, user_id } (la part de frais d'un technicien).
export function commissionsAAviser(db) {
  const formation = boutiquesFormation(db);
  const reel = (x) => !formation.has(x?.boutique);
  const ctx = contexte(db);
  const chantiers = (db.clients_installes || []).filter((c) => !c.corbeille && !c.travaux);
  const chantierDeVente = (v) => chantiers.find((c) => c.vente_id === v.id) || null;
  const liste = [];
  const ajouter = (cle, ref) => {
    const e = envoiDeCommission(db, ref, ctx);
    if (e) liste.push({ cle, ref, ...e });
  };

  (db.ventes || []).filter(reel).forEach((v) => {
    const dette = detteDeVente(db, v);
    const quand = dateDue(v, dette, chantierDeVente(v));
    if (quand < DEBUT_AVIS_COMMISSION) return;
    // Le commercial (ou le technicien à commission) et le responsable.
    if (!v.commission_payee && !commissionBloquee(v, db)) {
      if (v.commercial && !v.commission_avisee_le) ajouter(`v:${v.id}:commercial`, { type: "vente", id: v.id, qui: "commercial" });
      if (v.responsable && !v.commission_resp_avisee_le) ajouter(`v:${v.id}:responsable`, { type: "vente", id: v.id, qui: "responsable" });
    }
    // Le parrain ou l'apporteur externe.
    const a = v.apporteur;
    if (a && !a.payee && !a.avise_le && !partParrainBloquee(v, db)) ajouter(`v:${v.id}:apporteur`, { type: "vente", id: v.id, qui: "apporteur" });
  });

  // L'apporteur d'une pose seule (porté par la dette de pose).
  posesAvecApporteur((db.dettes || []).filter(reel), chantiers).forEach(({ dette: d, chantier, bloquee }) => {
    const a = d.apporteur;
    if (bloquee || a.payee || a.avise_le) return;
    if (dateDue({ date: d.date }, d, chantier) < DEBUT_AVIS_COMMISSION) return;
    ajouter(`d:${d.id}:apporteur`, { type: "dette", id: d.id });
  });

  // 🔧 La part des frais d'installation de chaque technicien (« 2b »).
  chantiers.forEach((c) => {
    if (chantierDeFormation(db, c) || statutChantier(c) !== "receptionne") return;
    const vente = c.vente_id ? (db.ventes || []).find((v) => v.id === c.vente_id) : null;
    const dette = c.dette_id ? (db.dettes || []).find((d) => d.id === c.dette_id) : null;
    const solde = vente ? venteSoldee(db, vente) : dette ? resteAPayer(dette) === 0 : true;
    if (!solde) return;
    const quand = dateDue({ date: c.date_repartition }, dette || detteDeVente(db, vente || {}), c);
    if (quand < DEBUT_AVIS_COMMISSION) return;
    (c.equipe || []).forEach((e) => {
      if (!e.user_id || e.paye || e.avise_le || !(Number(e.montant || 0) > 0)) return;
      ajouter(`c:${c.id}:${e.user_id}`, { type: "chantier", id: c.id, user_id: e.user_id });
    });
  });
  return liste;
}

// La marque « annoncée », posée APRÈS l'accord de WhatsApp — jamais avant.
export function marquerCommissionAvisee(db, ref, quand) {
  if (!ref) return db;
  if (ref.type === "chantier") {
    return { ...db, clients_installes: (db.clients_installes || []).map((c) => (c.id !== ref.id ? c
      : { ...c, equipe: (c.equipe || []).map((e) => (e.user_id === ref.user_id ? { ...e, avise_le: quand } : e)) })) };
  }
  if (ref.type === "dette") {
    return { ...db, dettes: (db.dettes || []).map((d) => (d.id === ref.id ? { ...d, apporteur: { ...d.apporteur, avise_le: quand } } : d)) };
  }
  const champ = ref.qui === "responsable" ? "commission_resp_avisee_le" : "commission_avisee_le";
  return {
    ...db,
    ventes: (db.ventes || []).map((v) => (v.id !== ref.id ? v
      : ref.qui === "apporteur" ? { ...v, apporteur: { ...v.apporteur, avise_le: quand } } : { ...v, [champ]: quand })),
  };
}

// ---------------------------------------------------------------
// 💰 LA COMMISSION PAYÉE (Timo, 13/11/2026 : « lorsque c'est payé, l'apporteur
// ou le commercial ne reçoit pas de nouveau message ? » — le commercial avait un
// message dans l'application, l'apporteur externe et le parrain RIEN DU TOUT —
// → « A a, B texte ok, lance » : tout le monde, le texte proposé).
// ---------------------------------------------------------------
// Les trois paiements de 👑 Mon équipe écrivent chacun UNE dépense
// « Commissions » (`auto` : commission, commission_equipe, commission_ext) et
// tamponnent ce qu'elle a payé (`commission_dep`, `override_dep`,
// `apporteur.dep_id`). Le message se lit sur ELLE — écrit UNE fois : l'envoi
// juste après le paiement ET le détail relu dans 📲 WhatsApp
// (lib/lignesPrivees.js) y passent. Rend { tel, nom, envoi, apporteur,
// formation } (envoi null sans numéro), ou null : pas un paiement de
// commission, ou plus rien ne s'y rattache (un règlement annulé).
// ⚠ LE MUR (`formation`) : la caisse qui a payé, une vente ou une pose payée, ou
// le compte du bénéficiaire en formation → rien ne part. C'est l'espace de la
// DONNÉE qui décide, jamais celui de la personne qui clique.
export const AUTOS_COMMISSION_PAYEE = ["commission", "commission_equipe", "commission_ext"];
export function envoiDeCommissionPayee(db, depense, { tel: telDuFil = "" } = {}) {
  const dep = typeof depense === "string" ? (db.depenses || []).find((d) => d.id === depense) : depense;
  if (!dep || !AUTOS_COMMISSION_PAYEE.includes(dep.auto)) return null;
  const formationBq = boutiquesFormation(db);
  const enFormation = (x) => !!x && (x.formation === true || formationBq.has(x.boutique));
  // Le moyen tel que la dépense le range (`paiement`, posé par nouvelleDepense).
  const commun = { montant: Number(dep.montant || 0), date: dep.date, moyen: dep.paiement, fmt, dFR };
  if (dep.auto === "commission_ext") {
    const ventes = (db.ventes || []).filter((v) => v.apporteur && v.apporteur.dep_id === dep.id);
    const poses = (db.dettes || []).filter((d) => d.apporteur && d.apporteur.dep_id === dep.id);
    const a = (ventes[0] || poses[0])?.apporteur;
    if (!a || !a.nom) return null;
    const tel = a.tel || telDuFil;
    const clients = new Set([...ventes, ...poses].map((x) => String(x.client || "").trim().toLowerCase()).filter(Boolean)).size;
    // Un parrain est un client : il a son espace. Un apporteur externe qui a un
    // compte client sur ce numéro aussi (la même règle que la commission due).
    const espace = !!a.parrain_user_id || contexte(db).aEspace(a.tel);
    const envoi = envoiCommissionPayee({ ...commun, beneficiaire: a.nom, tel, espace, clients,
      pour: pourCommissionPayee({ ventes: ventes.map((v) => v.client), poses: poses.map((d) => d.client) }) });
    return { tel, nom: a.nom, envoi, apporteur: true,
      formation: formationBq.has(dep.boutique) || ventes.some(enFormation) || poses.some(enFormation) };
  }
  const u = (db.users || []).find((x) => x.id === dep.user_id);
  if (!u) return null;
  const ventes = (db.ventes || []).filter((v) => (dep.auto === "commission" ? v.commission_dep : v.override_dep) === dep.id);
  const tel = u.tel || telDuFil;
  const envoi = envoiCommissionPayee({ ...commun, beneficiaire: u.nom_complet || u.nom, tel, espace: true,
    pour: dep.auto === "commission_equipe" ? pourCommissionPayee({ equipe: true }) : pourCommissionPayee({ ventes: ventes.map((v) => v.client) }) });
  return { tel, nom: u.nom, envoi, apporteur: false,
    formation: formationBq.has(dep.boutique) || ventes.some(enFormation) || estCompteFormation(db, u) };
}

// L'envoi, juste APRÈS l'enregistrement du paiement : tout seul, sans question
// et sans repli (comme la part d'installation payée — WhatsApp ne s'ouvre
// jamais). `db` = l'état APRÈS le paiement (la dépense et ce qu'elle a
// tamponné) ; `formation` = ce que l'écran sait en plus (l'espace regardé). La
// ligne du fil est PRIVÉE (celui qui a payé et l'administrateur principal). Le
// message interne de 💬 Messages, lui, ne change pas. Rend la phrase à ajouter à
// la confirmation ("" si rien à dire : formation, rien à annoncer).
export async function envoyerAvisCommissionPayee({ db, save, profile, depense, formation = false }) {
  const e = envoiDeCommissionPayee(db, depense);
  if (!e) return "";
  const mur = !!formation || e.formation;
  if (!e.envoi) {
    if (mur) return "";
    return e.apporteur
      ? `📲 Aucun avis WhatsApp : aucun numéro n'est noté pour ${e.nom} sur ses ventes.`
      : `📲 Aucun avis WhatsApp : la fiche de ${e.nom} n'a pas de numéro (👥 Utilisateurs → ⋯ Gérer → 📞 Téléphone).`;
  }
  const { envoyerRecuSansQuestion } = await import("../whatsapp.js");
  return envoyerRecuSansQuestion({
    envoi: e.envoi, tel: e.tel, nom: e.nom, espaceFormation: mur, save, profile,
    ref: { depense_id: typeof depense === "string" ? depense : depense?.id },
    noms: { titre: "Avis de paiement", sujet: "L'avis de paiement" },
  });
}
