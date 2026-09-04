// ============================================================
// screens/TousLesDevis.jsx — Liste de tous les devis (admin,
// responsable commercial, élaborateur) : filtres, statuts, relance,
// reprise d'un devis pour modification.
// ============================================================
import { useState, useRef } from "react";
import { soldeApresAcompte, resumePlan, engagementDuContrat, echeancier, critiquePlan, finDuMoisCourant, PLAN_EN_ATTENTE, PLAN_ACCEPTE, PLAN_REJETE } from "../lib/reglement";
import { genererDevis } from "../pdf";
import { LOGO } from "../lib/constants";
import { fmt, dFR, today } from "../lib/core";
import { inputCls, usePagination, Pagination, uAlert, uConfirm, uPrompt } from "../components/ui";
import { normNom, espaceDuCompte, bloquerSiLecture, estAdminPrincipal, boutiquesVente, boutiquesVisibles } from "../lib/calculs";
import { htmlContratInstallation, imprimerContratInstallation } from "../lib/impression";
import { validerDevis, numeroContrat } from "../lib/validationDevis";
import { TYPES_PORTAIL, LABEL_FREQUENCE } from "./dimensionnement/Garage";

// ============ TOUS LES DEVIS (admin, responsable commercial, élaborateur) ============
export function libelleTypeDevis(d) {
  if (d.type_devis === "garage") return "🚪 Garage";
  if (d.type_devis === "autre") return `📦 ${d.besoins?.categorie || "Autre"}`;
  return "☀️ Solaire";
}

const STATUT_DEVIS = {
  propose: ["⏳ Proposé", "bg-amber-100 text-amber-800 border-amber-300"],
  valide: ["✅ Validé", "bg-sky-100 text-sky-800 border-sky-300"],
  paye: ["💰 Payé", "bg-green-100 text-green-800 border-green-300"],
  modification: ["✏️ Modification demandée", "bg-purple-100 text-purple-800 border-purple-300"],
  rejete: ["❌ Rejeté", "bg-red-100 text-red-800 border-red-300"],
};
const BadgeStatutDevis = ({ statut }) => {
  const [label, cls] = STATUT_DEVIS[statut || "propose"] || STATUT_DEVIS.propose;
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>{label}</span>;
};

// Nombre de jours écoulés depuis la date du devis (chaîne "AAAA-MM-JJ").
function joursDepuis(dateStr) {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}
const SEUIL_RELANCE_JOURS = 15;

// ⚠ Demande Timo : la liste est classée par STATUT (proposé → validé → payé →
// modification demandée → rejeté), et à l'intérieur d'un même statut, du plus
// récent au plus ancien (ordre déjà en place avant ce classement).
const ORDRE_STATUT_DEVIS = { propose: 0, valide: 1, paye: 2, modification: 3, rejete: 4 };
const NB_DEVIS_AFFICHES = 7;

export function TousLesDevis({ db, save, profile, onModifierDevis }) {
  const voitTout = profile.role === "admin" || profile.role === "resp_commercial";

  // ⚠ Cloisonnement : un devis porte l'espace de son auteur (`formation`,
  // posé à l'envoi — voir envoyerDevisEtOuvrirWhatsApp). Sans ce filtre,
  // les devis d'entraînement s'affichaient dans la liste de l'admin et du
  // responsable commercial, et comptaient dans la pastille rouge. `espace`
  // vaut undefined pour l'admin principal, qui doit continuer à tout voir.
  const espace = espaceDuCompte(db, profile);
  const tousDevis = db.users
    .filter((u) => u.role === "client")
    .flatMap((u) => (u.devis || []).map((d) => ({ ...d, client: u })))
    .filter((d) => espace === undefined || !!d.formation === espace)
    // ⚠ Décision Timo (04/09/2026) : le vendeur de la boutique où le client
    // vient PAYER voit aussi les devis à encaisser chez lui, même s'il ne
    // les a pas faits — c'est lui qui le fera signer et encaissera. La
    // boutique de paiement est celle choisie par le client à la validation,
    // sinon celle du devis (indiquée par le commercial).
    .filter((d) => voitTout || d.par_id === profile.id
      || (!!profile.boutique && (d.boutique_paiement || d.boutique) === profile.boutique))
    .sort((a, b) => `${b.date} ${b.heure || ""}`.localeCompare(`${a.date} ${a.heure || ""}`));

  // ⚠ DEMANDE TIMO (25/08/2026) : « côté administration et commercial, il voit
  // le montant mentionné par le client... si ça ne correspond pas aux
  // engagements du client il rejette, si ça correspond il accepte ».
  // Et à ma question « qui décide ? », sa réponse : L'ADMINISTRATEUR SEUL.
  // Le commercial VOIT la proposition — c'est utile pour son suivi — mais il
  // ne peut pas engager l'entreprise sur un échéancier.
  //
  // ⚠ PRÉCISÉ LE 29/08/2026, à la relecture de l'audit : « l'administrateur
  // seul » avait été compris comme TOUT compte administrateur. Question posée
  // à Timo, réponse : « MOI SEUL ». Accepter un plan, c'est engager BMI sur un
  // échéancier — au même titre que changer un mot de passe ou basculer un
  // compte d'espace, gestes déjà réservés à l'administrateur PRINCIPAL.
  const peutDeciderDuPlan = estAdminPrincipal(db, profile);

  const deciderPlan = async (d, accepte) => {
    if (bloquerSiLecture(db, profile)) return;
    // Le bouton est déjà caché aux autres ; on garde aussi le geste, pour que
    // la règle tienne même si un jour l'affichage change.
    if (!peutDeciderDuPlan) { uAlert("🔒 Seul l'administrateur PRINCIPAL peut accepter ou rejeter un plan de règlement."); return; }
    const solde = soldeApresAcompte(d);
    let motif = "";
    if (!accepte) {
      motif = await uPrompt(`Pourquoi refusez-vous ce plan ?\n\nLe client le lira dans son espace et pourra en proposer un autre.`, "Échéancier trop long");
      if (motif === null) return;
    } else if (!await uConfirm(`Accepter ce plan de règlement ?\n\n${resumePlan(d.plan_reglement, solde)}\n\nLe client sera engagé sur cet échéancier.`)) return;
    const decide = {
      ...d.plan_reglement,
      statut: accepte ? PLAN_ACCEPTE : PLAN_REJETE,
      decide_par: profile.nom, decide_le: today(),
      motif_rejet: accepte ? "" : (motif || "").trim(),
    };
    save({
      ...db,
      users: db.users.map((u) => (u.id === d.client.id
        ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id ? { ...x, plan_reglement: decide } : x)) }
        : u)),
    }, `Plan de règlement ${accepte ? "ACCEPTÉ" : "REFUSÉ"} — devis de ${d.client.nom} (${resumePlan(decide, solde)})${accepte ? "" : ` — motif : ${decide.motif_rejet}`}`);
  };

  const [ouvert, setOuvert] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [recherche, setRecherche] = useState("");
  const [relanceSeule, setRelanceSeule] = useState(false);

  // Ouvrir un devis le marque comme « vu » — la pastille rouge ne le comptera plus.
  const ouvrirDevis = (d) => {
    setOuvert(ouvert === d.id ? null : d.id);
    if (!(d.vu_par || []).includes(profile.id)) {
      save({
        ...db,
        users: db.users.map((u) => (u.id === d.client?.id
          ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id ? { ...x, vu_par: [...(x.vu_par || []), profile.id] } : x)) }
          : u)),
      });
    }
  };

  const enAttenteDeRelance = (d) => (d.statut || "propose") === "propose" && joursDepuis(d.date) >= SEUIL_RELANCE_JOURS;
  const nbARelancer = tousDevis.filter(enAttenteDeRelance).length;

  // Base pour les compteurs des onglets de statut : tous les AUTRES filtres
  // s'appliquent (recherche, type, relance), mais PAS le statut lui-même —
  // sinon le compteur d'un onglet non sélectionné retomberait toujours à 0.
  const devisAvantStatut = tousDevis.filter((d) => {
    if (relanceSeule && !enAttenteDeRelance(d)) return false;
    if (filtreType && (d.type_devis || "solaire") !== filtreType) return false;
    if (recherche) {
      const texte = normNom(`${d.client?.nom_base || d.client?.nom || ""} ${d.par || ""}`);
      if (!texte.includes(normNom(recherche))) return false;
    }
    return true;
  });
  const compteStatut = (s) => (s ? devisAvantStatut.filter((d) => (d.statut || "propose") === s).length : devisAvantStatut.length);

  const devisFiltres = devisAvantStatut.filter((d) => !filtreStatut || (d.statut || "propose") === filtreStatut)
    .sort((a, b) =>
    (ORDRE_STATUT_DEVIS[a.statut || "propose"] - ORDRE_STATUT_DEVIS[b.statut || "propose"])
    || `${b.date} ${b.heure || ""}`.localeCompare(`${a.date} ${a.heure || ""}`));
  const { pageItems: devisPage, page, setPage, totalPages } = usePagination(devisFiltres, 50);

  // ---- SIGNATURE EN BOUTIQUE (demande Timo, 04/09/2026) ----
  // « Un client qui ne passe pas par l'app et veut signer le contrat » :
  // deux gestes réservés aux employés, sur un devis encore proposé.
  //   ✍️ Faire signer ici — le contrat s'affiche sur l'appareil du vendeur,
  //      le client signe avec le doigt ; enregistré EXACTEMENT comme une
  //      signature dans son espace (même règle : lib/validationDevis.js),
  //      avec la mention « signé en boutique X devant Y ».
  //   🖨 Imprimer pour signature papier — le contrat complet, cases vides,
  //      avec un numéro attribué tout de suite (le papier et l'application
  //      portent le même) ; puis 📝 Signé sur papier — date, boutique,
  //      vendeur, original archivé à la boutique.
  // ⚠ Décision Timo (04/09/2026) : « laisser cette possibilité à
  // l'administrateur principal seul — avec le temps, quand on mettra en
  // place le code superviseur, on pourra ouvrir ce geste aux vendeurs pour
  // un seul geste ». Le bouton est caché aux autres ET le geste refuse.
  const peutSignerEnBoutique = estAdminPrincipal(db, profile);
  const peutFaireSigner = (d) => peutSignerEnBoutique && (d.statut || "propose") === "propose";
  const refuserSiPasAdminPrincipal = () => {
    if (peutSignerEnBoutique) return false;
    uAlert("🔒 Seul l'administrateur PRINCIPAL peut faire signer un contrat en boutique, pour l'instant.");
    return true;
  };
  const [signature, setSignature] = useState(null); // { devis, mode: "ecran" | "papier", boutique }
  const [plan, setPlan] = useState({ type: "", montant_mensuel: "", premiere_echeance: finDuMoisCourant() });
  const canvasRef = useRef(null);
  const aSigneRef = useRef(false);
  const [dessinEnCours, setDessinEnCours] = useState(false);
  const boutiquesPaiement = boutiquesVisibles(db, profile, boutiquesVente(db));
  const lieuSignature = profile.boutique || signature?.boutique || "";

  const ouvrirSignature = (d, mode) => {
    if (bloquerSiLecture(db, profile) || refuserSiPasAdminPrincipal()) return;
    aSigneRef.current = false;
    setPlan({ type: "", montant_mensuel: "", premiere_echeance: finDuMoisCourant() });
    setSignature({ devis: d, mode, boutique: d.boutique_paiement || profile.boutique || d.boutique || "" });
  };

  // Le numéro de contrat est attribué à l'IMPRESSION et enregistré sur le
  // devis : le papier signé et l'application portent le même numéro.
  const imprimerPourPapier = (d) => {
    if (bloquerSiLecture(db, profile) || refuserSiPasAdminPrincipal()) return;
    const numero = d.contrat_numero || numeroContrat();
    if (!d.contrat_numero) {
      save({ ...db, users: db.users.map((u) => (u.id === d.client?.id
        ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id ? { ...x, contrat_numero: numero } : x)) }
        : u)) }, `Contrat ${numero} imprimé pour signature papier — devis de ${d.client?.nom_base || d.client?.nom} (par ${profile.nom})`);
    }
    imprimerContratInstallation({ ...d, contrat_numero: numero, contrat_date_signature: today(),
      boutique_paiement: d.boutique_paiement || d.boutique || "" }, db);
  };

  const positionCanvas = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: (point.clientX - rect.left) * (canvas.width / rect.width), y: (point.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const debuterTrait = (e) => {
    e.preventDefault(); setDessinEnCours(true); aSigneRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = positionCanvas(e, canvasRef.current);
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const continuerTrait = (e) => {
    if (!dessinEnCours) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = positionCanvas(e, canvasRef.current);
    ctx.lineTo(x, y); ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke();
  };
  const terminerTrait = () => setDessinEnCours(false);
  const effacerSignature = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    aSigneRef.current = false;
  };

  const confirmerSignature = async () => {
    if (!signature) return;
    const { devis: d, mode, boutique } = signature;
    if (bloquerSiLecture(db, profile) || refuserSiPasAdminPrincipal()) return;
    // Le plan de règlement, comme dans l'espace client : seulement s'il
    // restera un solde après l'acompte.
    const solde = soldeApresAcompte(d);
    let planSigne = null;
    if (solde > 0) {
      const souci = critiquePlan(plan, solde);
      if (souci) { uAlert(souci); return; }
      planSigne = {
        type: plan.type,
        montant_mensuel: plan.type === "mensuel" ? Number(plan.montant_mensuel) : null,
        premiere_echeance: plan.type === "mensuel" ? plan.premiere_echeance : null,
        solde_engage: solde, propose_le: today(), statut: PLAN_EN_ATTENTE,
      };
    }
    const numero = d.contrat_numero || numeroContrat();
    let infosContrat, mention;
    if (mode === "ecran") {
      if (!aSigneRef.current) { uAlert("Le client doit signer dans le cadre prévu."); return; }
      if (!await uConfirm(`Enregistrer la signature de ${d.client?.nom_base || d.client?.nom} pour le devis de ${fmt(d.total)} ?\n\nContrat ${numero}, signé en boutique ${lieuSignature || "—"} devant ${profile.nom}.${d.pose_seule ? "" : `\nPaiement prévu à ${boutique}.`}`)) return;
      infosContrat = { contrat_numero: numero, contrat_signature: canvasRef.current.toDataURL("image/png"), contrat_date_signature: today(),
        contrat_signe_en_boutique: lieuSignature, contrat_signe_devant: profile.nom };
      mention = ` — signé en boutique ${lieuSignature || "—"} devant ${profile.nom}`;
    } else {
      if (!await uConfirm(`Le client ${d.client?.nom_base || d.client?.nom} a signé le contrat ${numero} SUR PAPIER ?\n\nL'original signé doit être archivé à la boutique ${lieuSignature || "—"}. Ce geste vaut validation du devis${d.pose_seule ? "" : ` — paiement prévu à ${boutique}`}.`)) return;
      infosContrat = { contrat_numero: numero, contrat_date_signature: today(),
        contrat_papier: true, contrat_papier_boutique: lieuSignature, contrat_papier_par: profile.nom };
      mention = ` — signé sur papier, original archivé à ${lieuSignature || "—"} (reçu par ${profile.nom})`;
    }
    if (planSigne) infosContrat.plan_reglement = planSigne;
    const r = validerDevis(db, { clientId: d.client?.id, devisId: d.id, boutique, infosContrat, acteur: { nom: profile.nom }, mention });
    if (r.erreur) { uAlert(r.erreur); return; }
    save(r.db, r.journal);
    setSignature(null);
    uAlert(d.pose_seule
      ? `✅ Contrat ${numero} enregistré. Le chantier est créé — à programmer dans 🏠 Clients installés.`
      : `✅ Contrat ${numero} enregistré. Le devis est validé : encaissez-le dans 💰 Ventes (commande en attente à ${boutique}).`);
  };

  const telechargerPDF = (d) => {
    // ⚠ Bandeau formation (demande Timo) : le devis n'a pas de champ
    // boutique direct avant vente — même repli que le contrat d'installation
    // (impression.js) : la boutique de la personne qui l'a créé (d.par).
    const initiateur = (db.users || []).find((u) => u.nom === d.par);
    const estFormation = !!(db.boutiques || []).find((b) => b.nom === initiateur?.boutique)?.formation;
    genererDevis({
      numero: d.id.slice(0, 8).toUpperCase(),
      date: dFR(d.date),
      boutique: d.boutique,
      client: d.client?.nom_base || d.client?.nom || "—",
      tel: d.client?.tel || "",
      titre: libelleTypeDevis(d).replace(/^\S+\s/, ""),
      statut: (STATUT_DEVIS[d.statut || "propose"] || STATUT_DEVIS.propose)[0].replace(/^\S+\s/, ""),
      par: d.par,
      lignes: d.lignes || [],
      // La charge dimensionnée (appareils, mesures de porte, demande) part
      // avec le devis : le PDF la rend au-dessus de la table des prix. Les
      // identifiants techniques du garage (« portail_coulissant »,
      // « moyenne ») sont réécrits ICI en libellés lisibles — le module PDF
      // n'a accès ni aux écrans ni à db.
      besoins: d.besoins ? {
        ...d.besoins,
        ...(d.besoins.type_ouvrant ? {
          type_ouvrant: TYPES_PORTAIL.find((t) => t.id === d.besoins.type_ouvrant)?.label || d.besoins.type_ouvrant,
          frequence: LABEL_FREQUENCE[d.besoins.frequence] || d.besoins.frequence,
        } : {}),
      } : null,
      total: d.total,
      formation: estFormation,
    }, LOGO);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="font-bold text-slate-800 mb-3">📋 Tous les devis {voitTout ? "" : "— les vôtres"}</div>
        {/* ⚠ Demande Timo : de VRAIS boutons cliquables pour filtrer par statut,
            juste sous le titre — pas un simple classement passif de la liste. */}
        <div className="flex flex-wrap gap-2 mb-3">
          {[["", "📋 Tous"], ["propose", "⏳ Proposé"], ["valide", "✅ Validé"], ["paye", "💰 Payé"], ["modification", "✏️ Modification"], ["rejete", "❌ Rejeté"]].map(([id, label]) => (
            <button key={id || "tous"} onClick={() => setFiltreStatut(id)}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${filtreStatut === id ? "bg-sky-800 text-white border-sky-800" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
              {label} <span className={`ml-1 ${filtreStatut === id ? "text-sky-200" : "text-slate-400"}`}>({compteStatut(id)})</span>
            </button>
          ))}
        </div>
        {nbARelancer > 0 && (
          <button onClick={() => setRelanceSeule((v) => !v)} className={`mb-3 w-full text-left rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${relanceSeule ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"}`}>
            ⚠️ {nbARelancer} devis proposé{nbARelancer > 1 ? "s" : ""} depuis plus de {SEUIL_RELANCE_JOURS} jours sans réponse — {relanceSeule ? "voir tous les devis" : "voir uniquement ceux-ci"}
          </button>
        )}
        <div className="grid sm:grid-cols-2 gap-2">
          <input className={inputCls} placeholder="Rechercher un client ou un vendeur…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <select className={inputCls} value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
            <option value="">Tous les types</option>
            <option value="solaire">☀️ Solaire</option>
            <option value="garage">🚪 Garage</option>
            <option value="autre">📦 Autre</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {devisFiltres.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">Aucun devis{voitTout ? "" : " établi par vous"} pour l'instant.</div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[455px] overflow-y-auto">
            {devisPage.map((d) => (
              <div key={d.id}>
                <button onClick={() => ouvrirDevis(d)} className="w-full text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-slate-50 flex-wrap">
                  <span className="flex-1 min-w-[180px]">
                    <span className="font-bold text-slate-800">{d.client?.nom_base || d.client?.nom || "Client"}</span>
                    <span className="text-xs text-slate-500 ml-2">{libelleTypeDevis(d)}</span>
                    <span className="block text-xs text-slate-400">Le {dFR(d.date)} par {d.par} — {d.boutique}</span>
                  </span>
                  {!(d.vu_par || []).includes(profile.id) && (
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" title="Nouveau — pas encore ouvert"></span>
                  )}
                  <span className="font-bold text-sky-800 whitespace-nowrap">{fmt(d.total)}</span>
                  {enAttenteDeRelance(d) && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap bg-red-50 text-red-700 border-red-300" title="Devis proposé sans réponse depuis longtemps">
                      ⚠️ En attente depuis {joursDepuis(d.date)} j
                    </span>
                  )}
                  <BadgeStatutDevis statut={d.statut} />
                  <span className="text-sm text-slate-400">{ouvert === d.id ? "▾" : "▸"}</span>
                </button>
                {ouvert === d.id && (
                  <div className="px-4 pb-4 bg-slate-50">
                    {d.plan_reglement && (() => {
                      const pl = d.plan_reglement;
                      const solde = soldeApresAcompte(d);
                      const couleur = pl.statut === PLAN_ACCEPTE ? "border-green-300 bg-green-50"
                        : pl.statut === PLAN_REJETE ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50";
                      return (
                        <div className={`mb-3 rounded-xl border-2 p-3 ${couleur}`}>
                          <div className="font-bold text-slate-800 text-sm">
                            💰 Plan de règlement proposé par le client
                            {pl.statut === PLAN_EN_ATTENTE && " — en attente"}
                            {pl.statut === PLAN_ACCEPTE && ` — accepté par ${pl.decide_par || "?"} le ${dFR(pl.decide_le)}`}
                            {pl.statut === PLAN_REJETE && ` — refusé par ${pl.decide_par || "?"} le ${dFR(pl.decide_le)}`}
                          </div>
                          <div className="text-sm text-slate-700 mt-1">Solde concerné : <b>{fmt(solde)} F</b></div>
                          <div className="text-sm text-slate-800 font-semibold mt-0.5">{resumePlan(pl, solde)}</div>
                          {/* ⚠ La ligne qui permet de juger en une seconde, au lieu
                              d'aller relire l'Article 4 du contrat. */}
                          <div className="text-xs text-slate-500 mt-1">{engagementDuContrat(d)}</div>
                          {pl.statut === PLAN_REJETE && pl.motif_rejet && (
                            <div className="text-xs text-red-700 mt-1">Motif : {pl.motif_rejet}</div>
                          )}
                          {pl.statut === PLAN_EN_ATTENTE && (
                            peutDeciderDuPlan ? (
                              <div className="flex gap-2 mt-2 flex-wrap">
                                <button onClick={() => deciderPlan(d, true)} className="px-4 py-1.5 rounded-lg bg-green-700 text-white text-xs font-bold hover:bg-green-800">✅ Accepter</button>
                                <button onClick={() => deciderPlan(d, false)} className="px-4 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50">❌ Rejeter</button>
                              </div>
                            ) : (
                              <div className="text-xs font-semibold text-slate-500 mt-2">Seul l'administrateur PRINCIPAL peut accepter ou rejeter ce plan.</div>
                            )
                          )}
                        </div>
                      );
                    })()}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                          <th className="text-left px-2 py-1">Article</th>
                          <th className="text-right px-2 py-1">Qté</th>
                          <th className="text-right px-2 py-1">P.U.</th>
                          <th className="text-right px-2 py-1">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(d.lignes || []).map((l, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="px-2 py-1">{l.article}</td>
                            <td className="px-2 py-1 text-right">{l.qte}</td>
                            <td className="px-2 py-1 text-right">{fmt(l.pu)}</td>
                            <td className="px-2 py-1 text-right font-semibold">{fmt(l.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-end mt-3 gap-2">
                      {(d.statut === "modification" || d.statut === "rejete") && onModifierDevis && (
                        <button onClick={() => onModifierDevis(d, d.client)} className="text-xs font-bold text-white bg-amber-600 rounded-lg px-3 py-1.5 hover:bg-amber-700">✏️ Modifier et renvoyer</button>
                      )}
                      <button onClick={() => telechargerPDF(d)} className="text-xs font-bold text-white bg-sky-800 rounded-lg px-3 py-1.5">📄 Devis PDF</button>
                    </div>
                    {peutFaireSigner(d) && (
                      <div className="mt-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs font-bold text-emerald-900 mb-2">Le client est en boutique et n'utilise pas l'application ?</div>
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => ouvrirSignature(d, "ecran")} className="text-xs font-bold text-white bg-emerald-700 rounded-lg px-3 py-1.5 hover:bg-emerald-800">✍️ Faire signer ici</button>
                          <button onClick={() => imprimerPourPapier(d)} className="text-xs font-bold text-emerald-800 border border-emerald-400 bg-white rounded-lg px-3 py-1.5 hover:bg-emerald-100">🖨 Imprimer pour signature papier</button>
                          <button onClick={() => ouvrirSignature(d, "papier")} className="text-xs font-bold text-emerald-800 border border-emerald-400 bg-white rounded-lg px-3 py-1.5 hover:bg-emerald-100">📝 Signé sur papier</button>
                        </div>
                        {d.contrat_numero && <div className="text-[11px] text-slate-500 mt-1">Contrat {d.contrat_numero} déjà imprimé — le numéro sera conservé.</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>

      {signature && (() => {
        const d = signature.devis;
        const numero = d.contrat_numero || "(attribué à l'enregistrement)";
        const apercu = { ...d, contrat_numero: d.contrat_numero || "", contrat_date_signature: today(), boutique_paiement: signature.boutique, contrat_signature: null };
        // Le texte du contrat vient de l'impression (impression.js) : une
        // seule source. Les styles y ciblent #zone-impression ; on les
        // retourne vers un cadre à nous pour l'aperçu.
        const html = htmlContratInstallation(apercu, db).replace(/#zone-impression/g, ".apercu-contrat");
        const solde = soldeApresAcompte(d);
        const lignes = plan.type === "mensuel" ? echeancier({ ...plan, montant_mensuel: Number(plan.montant_mensuel || 0) }, solde) : [];
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-bold text-slate-800">{signature.mode === "ecran" ? "✍️ Signature du client en boutique" : "📝 Contrat signé sur papier"}</div>
                  <div className="text-xs text-slate-500">{d.client?.nom_base || d.client?.nom} · {fmt(d.total)} · contrat {numero} · devant {profile.nom}{lieuSignature ? ` — ${lieuSignature}` : ""}</div>
                </div>
                <button onClick={() => setSignature(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
              </div>
              {!d.pose_seule && (
                <div className="mb-3 flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-semibold text-slate-700">Le client paiera à :</span>
                  <select className={inputCls + " max-w-[240px]"} value={signature.boutique} onChange={(e) => setSignature({ ...signature, boutique: e.target.value })}>
                    <option value="">— choisir —</option>
                    {boutiquesPaiement.map((b) => <option key={b.nom} value={b.nom}>{b.nom}</option>)}
                  </select>
                </div>
              )}
              <div className="apercu-contrat max-h-[38vh] overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50" dangerouslySetInnerHTML={{ __html: html }} />
              {solde > 0 && (
                <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
                  <div className="font-bold text-amber-900 text-sm">Comment le client réglera-t-il le solde de {fmt(solde)} F ?</div>
                  <label className="flex items-start gap-2 mt-2 text-sm text-slate-700 cursor-pointer">
                    <input type="radio" name="plan-boutique" className="mt-1" checked={plan.type === "solde_signature"} onChange={() => setPlan({ ...plan, type: "solde_signature" })} />
                    <span>La <b>totalité</b> à la signature du PV de réception (ou dans les 3 jours)</span>
                  </label>
                  <label className="flex items-start gap-2 mt-2 text-sm text-slate-700 cursor-pointer">
                    <input type="radio" name="plan-boutique" className="mt-1" checked={plan.type === "mensuel"} onChange={() => setPlan({ ...plan, type: "mensuel" })} />
                    <span><b>Chaque fin de mois</b></span>
                  </label>
                  {plan.type === "mensuel" && (
                    <div className="mt-2 pl-6 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="number" inputMode="numeric" className={inputCls + " max-w-[140px]"} placeholder="Montant" value={plan.montant_mensuel} onChange={(e) => setPlan({ ...plan, montant_mensuel: e.target.value })} />
                        <span className="text-sm text-slate-600">F, à partir du</span>
                        <input type="date" className={inputCls + " max-w-[170px]"} value={plan.premiere_echeance} onChange={(e) => setPlan({ ...plan, premiere_echeance: e.target.value })} />
                      </div>
                      {lignes.length > 0 && <div className="text-xs font-semibold text-amber-900">→ {lignes.length} versement(s), le dernier de {fmt(lignes[lignes.length - 1].montant)} F le {dFR(lignes[lignes.length - 1].date)}</div>}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 mt-2">Le plan sera soumis à l'administrateur principal, comme depuis l'espace client.</div>
                </div>
              )}
              {signature.mode === "ecran" ? (
                <>
                  <div className="text-xs font-semibold text-slate-600 mt-3 mb-1">Signature du client (avec le doigt) :</div>
                  <canvas ref={canvasRef} width={440} height={160} className="w-full border-2 border-slate-300 rounded-lg touch-none bg-slate-50"
                    onMouseDown={debuterTrait} onMouseMove={continuerTrait} onMouseUp={terminerTrait} onMouseLeave={terminerTrait}
                    onTouchStart={debuterTrait} onTouchMove={continuerTrait} onTouchEnd={terminerTrait} />
                </>
              ) : (
                <div className="mt-3 text-sm text-slate-700 rounded-lg border border-slate-200 p-3">
                  Le client a signé <b>le contrat imprimé</b>. L'original signé reste archivé à la boutique <b>{lieuSignature || "—"}</b> ; l'application enregistre la date, la boutique et votre nom.
                  {!d.contrat_numero && <div className="text-xs text-amber-700 mt-1">⚠ Ce contrat n'a pas été imprimé depuis l'application : un numéro sera attribué maintenant. Reportez-le sur le papier.</div>}
                </div>
              )}
              <div className="flex gap-2 mt-3 flex-wrap">
                {signature.mode === "ecran" && <button onClick={effacerSignature} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Effacer</button>}
                <button onClick={confirmerSignature} className="flex-1 px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800">{signature.mode === "ecran" ? "✍️ Enregistrer la signature et valider" : "📝 Confirmer la signature papier et valider"}</button>
                <button onClick={() => setSignature(null)} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Annuler</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
