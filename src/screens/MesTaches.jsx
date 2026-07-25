// ============================================================
// screens/MesTaches.jsx — Tâches assignées (agents commerciaux,
// techniciens, responsable) : liste triée, marquage fait/à faire.
// ============================================================
import { today, dFR } from "../lib/core";
import { Panel, uConfirm } from "../components/ui";
import { tachesDe } from "../lib/calculs";

// ============ MES TÂCHES (agents commerciaux / techniciens / responsable) ============
export function MesTaches({ db, save, profile }) {
  const moi = db.users.find((u) => u.id === profile.id) || profile;
  const taches = [...tachesDe(moi)].sort((a, b) => {
    if ((a.statut === "terminee") !== (b.statut === "terminee")) return a.statut === "terminee" ? 1 : -1;
    return String(a.echeance || "9999").localeCompare(String(b.echeance || "9999"));
  });
  const ouvertes = taches.filter((t) => t.statut !== "terminee");
  const enRetard = ouvertes.filter((t) => t.echeance && t.echeance < today());

  const majTache = (t, maj, label) =>
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, taches: tachesDe(x).map((y) => (y.id === t.id ? { ...y, ...maj } : y)) } : x)) }, label);

  const terminer = async (t) => {
    if (!await uConfirm(`Marquer la tâche « ${t.titre} » comme terminée ?`)) return;
    majTache(t, { statut: "terminee", date_fin: today() }, `${moi.nom} a terminé la tâche : ${t.titre}`);
  };

  const rouvrir = (t) => majTache(t, { statut: "a_faire", date_fin: null }, `${moi.nom} a rouvert la tâche : ${t.titre}`);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-1">✅ Mes tâches</div>
        <div className="text-xs text-slate-500 mb-4">Tâches assignées par l'administration ou votre responsable commercial.</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">À faire</div>
            <div className="text-xl font-bold tabular-nums mt-1">{ouvertes.length}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-red-500">
            <div className="text-xs font-semibold text-slate-500 uppercase">En retard</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-red-600">{enRetard.length}</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-700">
            <div className="text-xs font-semibold text-green-700 uppercase">Terminées</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-green-800">{taches.length - ouvertes.length}</div>
          </div>
        </div>
      </Panel>

      {taches.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-8">Aucune tâche ne vous est assignée pour le moment.</div>
      ) : (
        <div className="space-y-2">
          {taches.map((t) => {
            const retard = t.statut !== "terminee" && t.echeance && t.echeance < today();
            return (
              <div key={t.id} className={`rounded-xl border p-4 flex flex-wrap items-start justify-between gap-3 ${t.statut === "terminee" ? "bg-slate-50 border-slate-200" : retard ? "bg-red-50 border-red-200" : "bg-white border-slate-200 shadow-sm"}`}>
                <div className="min-w-[60%]">
                  <div className={`font-bold ${t.statut === "terminee" ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.titre}</div>
                  {t.detail && <div className="text-sm text-slate-600 mt-1">{t.detail}</div>}
                  <div className="text-xs text-slate-400 mt-1">
                    Assignée par {t.par} le {dFR(t.date)}
                    {t.echeance ? ` · Échéance : ${dFR(t.echeance)}` : ""}
                    {retard ? " · ⚠ EN RETARD" : ""}
                    {t.statut === "terminee" && t.date_fin ? ` · Terminée le ${dFR(t.date_fin)}` : ""}
                  </div>
                </div>
                <div>
                  {t.statut === "terminee"
                    ? <button onClick={() => rouvrir(t)} className="text-xs font-bold text-slate-500 underline">Rouvrir</button>
                    : <button onClick={() => terminer(t)} className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-bold hover:bg-green-800">✅ Terminer</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
