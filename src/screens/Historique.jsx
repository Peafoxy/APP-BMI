// ============================================================
// screens/Historique.jsx — Journal d'audit : chaque action
// enregistrée (qui, quoi, quand), en lecture seule.
// ============================================================
import { useState } from "react";
import { correspond } from "../lib/suggestions";
import { dFR } from "../lib/core";
import { champRecherche } from "../components/ui";
import { espaceDuCompte } from "../lib/calculs";

// ============ HISTORIQUE (JOURNAL D'AUDIT) ============
export function Historique({ db, profile }) {
  const [q, setQ] = useState("");
  // ⚠ LE MUR (01/10/2026, trouvé en écrivant le chapitre 22 du manuel) :
  // le journal partait de db.audits BRUT. Le serveur le cloisonne pour tout
  // le monde… sauf l'administrateur PRINCIPAL, qui télécharge les DEUX
  // espaces : il lisait les gestes d'entraînement mêlés aux vrais. Chaque
  // ligne porte sa marque (marqueEspace) : c'est l'espace REGARDÉ qui
  // décide, comme pour le dossier d'un client (⚙ Paramètres).
  const enFormation = !!espaceDuCompte(db, profile);
  let liste = (db.audits || []).filter((a) => !!a.formation === enFormation).slice(0, 500);
  if (q) liste = liste.filter((a) => correspond(String(a.user) + " " + String(a.action), q));
  const dh = (iso) => `${dFR(iso)} ${String(iso).slice(11, 16)}`;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <span className="font-bold text-slate-800">Historique des actions <span className="text-sm font-normal text-slate-500">(500 dernières)</span></span>
          <input className={champRecherche} placeholder="Rechercher (utilisateur, action)…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date et heure", "Utilisateur", "Action"].map((h) => <th key={h} className="text-left px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Aucune action enregistrée pour l'instant.</td></tr>}
            {liste.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-4 py-2 whitespace-nowrap tabular-nums">{dh(a.date)}</td>
                <td className="px-4 py-2 font-semibold">{a.user}</td>
                <td className="px-4 py-2">{a.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-400">Chaque vente, dépense, dette, mouvement de stock, clôture et action sur les comptes est tracée automatiquement, avec l'utilisateur et l'heure. Ce journal se synchronise entre toutes les machines.</div>
    </div>
  );
}
