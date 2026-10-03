// ============================================================
// lib/commissionsDues.js — LES COMMISSIONS DEVENUES DUES, À ANNONCER
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
// ⚠ LE MUR : seulement le RÉEL (un message part vers un vrai numéro) — les
// boutiques de formation sont écartées ici, quel que soit l'espace regardé.
// ⚠ LE PASSÉ : une commission devenue due AVANT la mise en service
// (`DEBUT_AVIS_COMMISSION`) ne s'annonce pas — sinon le premier matin aurait
// écrit à tous les bénéficiaires depuis le début. Sa date de dette = la plus
// récente de : la vente, le dernier versement de sa dette, la réception de son
// chantier.
// ============================================================
import { commissionBloquee, commissionPour, partParrainBloquee, posesAvecApporteur, detteDeVente, boutiquesFormation } from "./calculs";
import { envoiCommissionDue } from "./whatsappModeles";
import { memeNumero } from "./identiteClient";
import { fmt } from "./core";

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
// { type: "dette", id } (l'apporteur d'une pose seule).
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
  return liste;
}

// La marque « annoncée », posée APRÈS l'accord de WhatsApp — jamais avant.
export function marquerCommissionAvisee(db, ref, quand) {
  if (!ref) return db;
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
