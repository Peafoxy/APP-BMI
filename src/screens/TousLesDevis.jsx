// ============================================================
// screens/TousLesDevis.jsx — Liste de tous les devis (admin,
// responsable commercial, élaborateur) : filtres, statuts, relance,
// reprise d'un devis pour modification.
// ============================================================
import { useState } from "react";
import { soldeApresAcompte, resumePlan, engagementDuContrat, PLAN_EN_ATTENTE, PLAN_ACCEPTE, PLAN_REJETE } from "../lib/reglement";
import { genererDevis } from "../pdf";
import { LOGO } from "../lib/constants";
import { fmt, dFR, today } from "../lib/core";
import { inputCls, usePagination, Pagination, uAlert, uConfirm, uPrompt } from "../components/ui";
import { normNom, espaceDuCompte, bloquerSiLecture, estAdminPrincipal } from "../lib/calculs";

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
    .filter((d) => voitTout || d.par_id === profile.id)
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
                      <button onClick={() => telechargerPDF(d)} className="text-xs font-bold text-white bg-sky-800 rounded-lg px-3 py-1.5">📄 PDF (télécharger / imprimer)</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>
    </div>
  );
}
