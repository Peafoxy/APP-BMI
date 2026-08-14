// ============================================================
// screens/TousLesDevis.jsx — Liste de tous les devis (admin,
// responsable commercial, élaborateur) : filtres, statuts, relance,
// reprise d'un devis pour modification.
// ============================================================
import { useState } from "react";
import { genererDevis } from "../pdf";
import { LOGO } from "../lib/constants";
import { fmt, dFR } from "../lib/core";
import { inputCls, usePagination, Pagination } from "../components/ui";
import { normNom } from "../lib/calculs";

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

  const tousDevis = db.users
    .filter((u) => u.role === "client")
    .flatMap((u) => (u.devis || []).map((d) => ({ ...d, client: u })))
    .filter((d) => voitTout || d.par_id === profile.id)
    .sort((a, b) => `${b.date} ${b.heure || ""}`.localeCompare(`${a.date} ${a.heure || ""}`));

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
