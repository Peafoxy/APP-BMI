// ============================================================
// components/DepotsChantier.jsx — 🏗 la pastille DÉPÔT CHANTIER du tableau
// de bord (Timo, 12/10/2026 : « l'encaissement d'un devis d'installation est
// il une vente ? Si oui pourquoi dans l'onglet chantier il n'y a rien ? » →
// « dépôt chantier… les ventes viendront puiser dans ce dépôt »).
// Ce que chaque client a déposé, ce que les achats « 🏗 Chantier » en ont
// puisé (devenu vente dans la boutique qui a remis le matériel), ce qui est
// devenu vente à la réception, et ce qui dort encore dans la caisse. Rien
// n'est calculé ici : tout vient de `etatsDesDepots` (lib/depotChantier.js).
// ============================================================
import { fmt, dFR } from "../lib/core";
import { Stat, enTeteFige, celluleFigee } from "./ui";

export function DepotsChantier({ depots }) {
  const liste = Array.isArray(depots) ? depots : [];
  const enCours = liste.filter((d) => !d.receptionne_le);
  const somme = (l, k) => l.reduce((s, x) => s + Number(x[k] || 0), 0);
  return (
    <div className="space-y-3" data-depots-chantier>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Déposé (chantiers en cours)" value={fmt(somme(enCours, "paye"))} nature="entree" />
        <Stat label="Puisé — devenu vente" value={fmt(somme(enCours, "puise"))} nature="regle" />
        <Stat label="Reste en dépôt" value={fmt(somme(enCours, "enDepot"))} nature="attente" />
        {somme(enCours, "enAttente") > 0 && <Stat label="⏳ Puisé au-delà du déposé" value={fmt(somme(enCours, "enAttente"))} nature="du" />}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">🏗 Les dépôts des chantiers</div>
        {liste.length === 0 && <div className="px-4 py-3 text-sm text-slate-400">Aucun dépôt chantier pour l'instant.</div>}
        {liste.length > 0 && (
          <table className="w-full text-sm min-w-[860px]">
            <thead><tr className="text-xs text-slate-500 uppercase">
              <th className={`text-left px-3 py-2 ${enTeteFige("bg-white")}`}>Client</th>
              <th className="text-left px-3 py-2">Reçu</th>
              <th className="text-left px-3 py-2">Boutique du devis</th>
              <th className="text-right px-3 py-2">Devis</th>
              <th className="text-right px-3 py-2">Déposé</th>
              <th className="text-right px-3 py-2">Puisé (ventes)</th>
              <th className="text-right px-3 py-2">Vente à la réception</th>
              <th className="text-right px-3 py-2">Reste en dépôt</th>
            </tr></thead>
            <tbody>
              {liste.map((d) => (
                <tr key={d.id} className="border-t border-slate-100" data-ligne-depot>
                  <td className={`px-3 py-2 font-semibold ${celluleFigee("bg-white")}`}>{d.client || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{d.numero || "—"}<div className="text-[11px] text-slate-500">{dFR(d.date)}</div></td>
                  <td className="px-3 py-2">{d.boutique}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(d.devis)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(d.paye)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(d.puise)}{d.enAttente > 0 && <div className="text-[11px] text-red-700">⏳ {fmt(d.enAttente)} au-delà du déposé</div>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.receptionne_le ? <>{fmt(d.resteVendu)}<div className="text-[11px] text-slate-500">réceptionné le {dFR(d.receptionne_le)}</div></> : <span className="text-slate-400">à la réception</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold">{d.receptionne_le ? <span className="text-slate-400">—</span> : fmt(d.enDepot)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">Un dépôt n'est pas une vente. Chaque achat « 🏗 Chantier » devient une vente, au prix de la boutique, dans la boutique qui remet le matériel. À la réception, ce qui reste du devis (matériel non puisé, installation, transport) devient la dernière vente, dans la boutique du devis.</div>
      </div>
    </div>
  );
}
