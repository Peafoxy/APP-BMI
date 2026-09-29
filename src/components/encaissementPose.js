// ============================================================
// components/encaissementPose.js — LE GESTE QUI ENCAISSE UNE POSE SEULE (29/09/2026)
//
// Écrit UNE fois pour les deux endroits où les 70 % puis les 30 % se
// règlent : 🧾 Commandes de la boutique (gérant, vendeur, admin) et le
// chantier dans 🏠 Clients installés (le chef sur le terrain). C'est la même
// dette : le premier qui encaisse ferme pour tout le monde.
// L'argent tombe dans la caisse de celui qui encaisse — la boutique en
// boutique, TERRAIN (ou sa jumelle de formation) sur le terrain — et le reçu
// part du numéro BMI, tout seul, comme pour un versement de dette.
// Les règles vivent dans lib/poseSeule.js ; ici, le geste et ses questions.
// ============================================================
import { uid, fmt, today, dFR, heureCourte, normPaiement, numeroRecuDette } from "../lib/core";
import { uAlert, uConfirm, uPrompt, demanderMoyenPaiement } from "./ui";
import { bloquerSiLecture } from "../lib/calculs";
import { etatPose, peutEncaisserPose, ACOMPTE_POSE_PCT } from "../lib/poseSeule";
import { envoyerRecuSansQuestion } from "../whatsapp";
import { envoiRecuReglement } from "../lib/whatsappModeles";

// boutiqueEncaissement : la caisse qui reçoit (déjà choisie par l'écran).
// enBoutique           : pour le libellé et le journal.
// Rend la note du reçu WhatsApp ("" si rien à dire), ou null si abandonné.
export async function encaisserDettePose({ db, save, profile, chantier, boutiqueEncaissement, enBoutique }) {
  if (bloquerSiLecture(db, profile)) return null;
  if (!peutEncaisserPose(chantier, profile)) { uAlert("🔒 Encaisser une pose : réservé au chef de ce chantier, au vendeur, au gérant, au responsable commercial ou à l'administrateur."); return null; }
  // ⚠ La dette FRAÎCHE : un collègue a peut-être déjà encaissé ailleurs.
  const dette = (db.dettes || []).find((x) => x.id === chantier.dette_id);
  if (!dette) { uAlert("Aucun encaissement en attente pour ce chantier."); return null; }
  const e = etatPose(dette);
  if (e.reste <= 0) { uAlert("Ce chantier est déjà entièrement réglé."); return null; }
  const nom = dette.client || `${chantier.prenom || ""} ${chantier.nom || ""}`.trim();
  const etape = e.etape === "acompte"
    ? `Acompte de ${ACOMPTE_POSE_PCT} % : ${fmt(e.acompte)} — reste à verser pour l'atteindre : ${fmt(e.resteAcompte)}`
    : `Solde de la pose — reste dû : ${fmt(e.reste)}`;
  const s = await uPrompt(`Montant reçu de ${nom} (F)\n${etape}`, String(e.etape === "acompte" ? e.resteAcompte : e.reste));
  const m = Number(s);
  if (!s || isNaN(m) || m <= 0) return null;
  if (m > e.reste) { uAlert(`Le montant dépasse le reste dû (${fmt(e.reste)}).`); return null; }
  const moyen = await demanderMoyenPaiement();
  if (moyen === null) return null;
  if (!await uConfirm(`Confirmer le versement de ${fmt(m)} de ${nom} ?\n\n${enBoutique ? `Encaissé en boutique (${boutiqueEncaissement}).` : `Encaissé sur le terrain (caisse ${boutiqueEncaissement}).`}`)) return null;
  const paiement = { id: uid(), date: today(), heure: heureCourte(), montant: m, paiement: normPaiement(moyen), par: profile.nom };
  // La dette suit la caisse qui vient d'encaisser (terrain puis boutique, ou l'inverse).
  const detteApres = { ...dette, boutique: boutiqueEncaissement, paye: Number(dette.paye || 0) + m, paiements: [...(dette.paiements || []), paiement] };
  const apres = etatPose(detteApres);
  save({ ...db, dettes: db.dettes.map((x) => (x.id === dette.id ? detteApres : x)) },
    `Versement pose seule ${fmt(m)} de ${nom} — ${boutiqueEncaissement} (${enBoutique ? "boutique" : "terrain"})`);
  uAlert(apres.etape === "solde_ok"
    ? "✅ Versement enregistré — la pose est entièrement réglée."
    : apres.etape === "solde"
      ? `✅ Versement enregistré — l'acompte de ${ACOMPTE_POSE_PCT} % est versé : l'installation peut être programmée.\nReste le solde : ${fmt(apres.reste)}, à la signature du PV.`
      : `✅ Versement enregistré — il manque encore ${fmt(apres.resteAcompte)} pour l'acompte de ${ACOMPTE_POSE_PCT} %.`);
  // 🧾 Le reçu du versement part du numéro BMI, tout seul. ⚠ Le mur :
  // l'espace de la caisse qui encaisse, ou du chantier.
  const bqV = (db.boutiques || []).find((b) => b.nom === boutiqueEncaissement) || {};
  const telV = detteApres.tel || chantier.tel;
  return envoyerRecuSansQuestion({
    envoi: envoiRecuReglement({ dette: { ...detteApres, tel: telV }, versement: paiement, boutique: bqV, fmt, dFR, numeroDe: numeroRecuDette }),
    tel: telV, nom,
    espaceFormation: !!bqV.formation || !!chantier.formation, save, profile, ref: { dette_id: detteApres.id },
  });
}
