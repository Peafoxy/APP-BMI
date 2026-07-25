// ============================================================
// screens/MesTaches.jsx — Tâches assignées (agents commerciaux,
// techniciens, technicien BMI, responsable). Cycle : à faire →
// terminée (déclarée ici, avec photo de preuve facultative) →
// validée ou rouverte avec motif par l'assignateur (Mon équipe).
// ============================================================
import { useRef, useState } from "react";
import { today, dFR, compresserPhoto } from "../lib/core";
import { Panel, uConfirm, uAlert } from "../components/ui";
import { tachesDe } from "../lib/calculs";

const ORDRE_STATUT = { a_faire: 0, terminee: 1, validee: 2 };

export function MesTaches({ db, save, profile }) {
  const moi = db.users.find((u) => u.id === profile.id) || profile;
  const [photoEnCours, setPhotoEnCours] = useState(null); // id de la tâche dont la photo se compresse
  const fichierRef = useRef({});

  const taches = [...tachesDe(moi)].sort((a, b) => {
    const oa = ORDRE_STATUT[a.statut] ?? 0, ob = ORDRE_STATUT[b.statut] ?? 0;
    if (oa !== ob) return oa - ob;
    return String(a.echeance || "9999").localeCompare(String(b.echeance || "9999"));
  });
  const ouvertes = taches.filter((t) => t.statut !== "terminee" && t.statut !== "validee");
  const enAttente = taches.filter((t) => t.statut === "terminee");
  const validees = taches.filter((t) => t.statut === "validee");
  const enRetard = ouvertes.filter((t) => t.echeance && t.echeance < today());

  const majTache = (t, maj, label) =>
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, taches: tachesDe(x).map((y) => (y.id === t.id ? { ...y, ...maj } : y)) } : x)) }, label);

  const terminer = async (t) => {
    const avecPreuve = t.photo ? "\n\n📷 Photo de preuve jointe." : "\n\n(Aucune photo de preuve — vous pouvez en joindre une avant, avec le bouton 📷.)";
    if (!await uConfirm(`Marquer la tâche « ${t.titre} » comme terminée ?${avecPreuve}\n\nElle passera en attente de validation par ${t.par || "l'assignateur"} et ne sera plus modifiable.`)) return;
    majTache(t, { statut: "terminee", date_fin: today(), commentaire_reouverture: null },
      `${moi.nom} a terminé la tâche : ${t.titre} — en attente de validation`);
  };

  const joindrePhoto = async (t, fichier) => {
    if (!fichier) return;
    setPhotoEnCours(t.id);
    try {
      const photo = await compresserPhoto(fichier);
      majTache(t, { photo }, `${moi.nom} a joint une photo de preuve à la tâche : ${t.titre}`);
    } catch {
      uAlert("Photo illisible — réessayez avec un autre fichier.");
    } finally {
      setPhotoEnCours(null);
    }
  };

  const BADGE = {
    terminee: <span className="text-xs font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">⏳ En attente de validation</span>,
    validee: <span className="text-xs font-bold px-2 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">✅ Validée</span>,
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-1">✅ Mes tâches</div>
        <div className="text-xs text-slate-500 mb-4">Tâches assignées par l'administration ou votre responsable. Quand vous terminez une tâche, elle part en validation chez celui qui l'a assignée — joignez une photo de preuve si possible.</div>
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">À faire</div>
            <div className="text-xl font-bold tabular-nums mt-1">{ouvertes.length}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-red-500">
            <div className="text-xs font-semibold text-slate-500 uppercase">En retard</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-red-600">{enRetard.length}</div>
          </div>
          <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 shadow-sm border-l-4 border-l-amber-500">
            <div className="text-xs font-semibold text-amber-700 uppercase">En validation</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-amber-800">{enAttente.length}</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-700">
            <div className="text-xs font-semibold text-green-700 uppercase">Validées</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-green-800">{validees.length}</div>
          </div>
        </div>
      </Panel>

      {taches.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-8">Aucune tâche ne vous est assignée pour le moment.</div>
      ) : (
        <div className="space-y-2">
          {taches.map((t) => {
            const ouverte = t.statut !== "terminee" && t.statut !== "validee";
            const retard = ouverte && t.echeance && t.echeance < today();
            return (
              <div key={t.id} className={`rounded-xl border p-4 flex flex-wrap items-start justify-between gap-3 ${!ouverte ? "bg-slate-50 border-slate-200" : retard ? "bg-red-50 border-red-200" : "bg-white border-slate-200 shadow-sm"}`}>
                <div className="min-w-[60%]">
                  <div className={`font-bold ${t.statut === "validee" ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.titre}</div>
                  {t.detail && <div className="text-sm text-slate-600 mt-1">{t.detail}</div>}
                  {t.commentaire_reouverture && ouverte && (
                    <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1 mt-2 inline-block">↩ Rouverte par {t.par} : {t.commentaire_reouverture}</div>
                  )}
                  <div className="text-xs text-slate-400 mt-1">
                    Assignée par {t.par} le {dFR(t.date)}
                    {t.echeance ? ` · Échéance : ${dFR(t.echeance)}` : ""}
                    {retard ? " · ⚠ EN RETARD" : ""}
                    {t.date_fin ? ` · Terminée le ${dFR(t.date_fin)}` : ""}
                    {t.statut === "validee" && t.valide_par ? ` · Validée par ${t.valide_par} le ${dFR(t.date_validation)}` : ""}
                  </div>
                  {t.photo && <img src={t.photo} alt="Preuve" className="mt-2 rounded-lg border border-slate-200 max-h-28" />}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {ouverte ? (
                    <>
                      <button onClick={() => terminer(t)} className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-bold hover:bg-green-800">✅ Terminer</button>
                      <label className="text-xs font-bold text-sky-800 underline cursor-pointer">
                        {photoEnCours === t.id ? "Compression…" : t.photo ? "📷 Remplacer la preuve" : "📷 Joindre une preuve"}
                        <input type="file" accept="image/*" className="hidden" ref={(el) => (fichierRef.current[t.id] = el)}
                          onChange={(e) => { joindrePhoto(t, e.target.files?.[0]); e.target.value = ""; }} />
                      </label>
                    </>
                  ) : BADGE[t.statut] || null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
