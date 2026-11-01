// ============================================================
// components/TachesConfiees.jsx — LES TÂCHES QUE L'ASSISTANT(E) DE DIRECTION
// DONNE AUX GÉRANTS (01/11/2026, « A a »).
//
// 👑 Mon équipe est l'écran des commissions et ne liste pas les gérants :
// l'assistant(e) donne donc ses tâches ici, dans son onglet ✅ Tâches.
// Les mêmes gestes que l'administrateur (assigner, valider, rouvrir), la
// même fiche (`taches` du gérant), le même avis WhatsApp (`envoyerAvisTache`).
// Revérifié DANS chaque geste : le pouvoir « tâches » (refuserSaufTaches) et
// la personne visée — un gérant actif de l'espace regardé.
// ============================================================
import { uid, today, dFR } from "../lib/core";
import { Panel, uAlert, uConfirm, uPrompt, demanderDate, BoutonRond } from "./ui";
import { refuserSaufTaches, utilisateursDeLEspace, envoyerAvisTache } from "../lib/calculs";
import { gerantsPourTaches, critiqueTacheAssistant, tachesConfiees } from "../lib/assistantDirection";

const PASTILLE = {
  a_faire: <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 whitespace-nowrap">À faire</span>,
  terminee: <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">⏳ À valider</span>,
  validee: <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">✅ Validée</span>,
};

export function TachesConfiees({ db, save, profile }) {
  const personnes = utilisateursDeLEspace(db, profile);
  const gerants = gerantsPourTaches(personnes);
  const confiees = tachesConfiees(personnes, profile);

  // La fiche FRAÎCHE de la personne visée, dans l'espace regardé.
  const ficheFraiche = (id) => utilisateursDeLEspace(db, profile).find((u) => u.id === id);

  const assigner = async (g) => {
    if (refuserSaufTaches(db, profile, "Assigner une tâche")) return;
    const cible = ficheFraiche(g.id);
    const refus = critiqueTacheAssistant(cible);
    if (refus) { uAlert(refus); return; }
    const titre = await uPrompt(`Tâche à donner à ${cible.nom} :`, "");
    if (titre === null) return;
    if (!titre.trim()) { uAlert("Le titre de la tâche est obligatoire."); return; }
    const detail = await uPrompt("Détails (facultatif) :", "");
    if (detail === null) return;
    const ech = await demanderDate("Échéance", "", true);
    if (ech === null) return;
    const tache = { id: uid(), titre: titre.trim(), detail: detail.trim(), echeance: ech.trim() || null, statut: "a_faire", par: profile.nom, par_id: profile.id, date: today() };
    save({ ...db, users: db.users.map((x) => (x.id === cible.id ? { ...x, taches: [...(x.taches || []), tache] } : x)) },
      `Tâche donnée à ${cible.nom} : ${titre.trim()}`);
    const avis = await envoyerAvisTache({ db, save, profile, membre: cible, tache });
    uAlert(`✅ Tâche donnée à ${cible.nom}. Elle apparaît dans son onglet ✅ Mes tâches.${avis ? `\n\n${avis}` : ""}`);
  };

  const valider = async (t) => {
    if (refuserSaufTaches(db, profile, "Valider une tâche")) return;
    if (!await uConfirm(`Valider la tâche « ${t.titre} » de ${t.membre.nom} ?${t.photo ? "" : "\n\n⚠ Aucune photo de preuve n'a été jointe."}`)) return;
    save({ ...db, users: db.users.map((x) => (x.id === t.membre.id ? { ...x, taches: (x.taches || []).map((y) => (y.id === t.id ? { ...y, statut: "validee", valide_par: profile.nom, date_validation: today() } : y)) } : x)) },
      `Tâche de ${t.membre.nom} validée par ${profile.nom} : ${t.titre}`);
    const avis = await envoyerAvisTache({ db, save, profile, membre: t.membre, tache: { ...t, valide_par: profile.nom }, valide: true });
    if (avis) uAlert(avis);
  };

  const rouvrir = async (t) => {
    if (refuserSaufTaches(db, profile, "Rouvrir une tâche")) return;
    const motif = await uPrompt(`Motif de la réouverture (visible par ${t.membre.nom}) :`, "");
    if (motif === null) return;
    if (!motif.trim()) { uAlert("Le motif est obligatoire : le gérant doit savoir quoi corriger."); return; }
    save({ ...db, users: db.users.map((x) => (x.id === t.membre.id ? { ...x, taches: (x.taches || []).map((y) => (y.id === t.id ? { ...y, statut: "a_faire", date_fin: null, commentaire_reouverture: motif.trim() } : y)) } : x)) },
      `Tâche de ${t.membre.nom} rouverte par ${profile.nom} : ${t.titre} (${motif.trim()})`);
  };

  return (
    <Panel>
      <div data-taches-confiees className="font-bold mb-1">📋 Tâches confiées aux gérants</div>
      <div className="text-xs text-slate-500 mb-3">Donnez une tâche à un gérant : elle apparaît dans son onglet ✅ Mes tâches, avec un avis WhatsApp. Quand il la termine, elle revient ici pour être validée ou rouverte.</div>
      {gerants.length === 0 ? (
        <div className="text-sm text-slate-400">Aucun gérant dans cet espace.</div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {gerants.map((g) => (
            <button key={g.id} data-donner-tache={g.id} onClick={() => assigner(g)}
              className="px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-800 text-sm font-semibold hover:bg-sky-100">
              ➕ {g.nom}{g.boutique ? ` · ${g.boutique}` : ""}
            </button>
          ))}
        </div>
      )}
      {confiees.length === 0 ? (
        <div className="text-sm text-slate-400">Aucune tâche donnée pour le moment.</div>
      ) : (
        <div className="space-y-2">
          {confiees.map((t) => (
            <div key={`${t.membre.id}-${t.id}`} data-ligne={t.id} className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-[55%]">
                <div className="font-semibold text-slate-800">{t.titre} <span className="font-normal text-slate-500">— {t.membre.nom}</span></div>
                {t.detail && <div className="text-sm text-slate-600 mt-0.5">{t.detail}</div>}
                <div className="text-xs text-slate-400 mt-0.5">
                  Donnée le {dFR(t.date)}{t.echeance ? ` · Échéance : ${dFR(t.echeance)}` : ""}
                  {t.date_fin ? ` · Terminée le ${dFR(t.date_fin)}` : ""}
                  {t.statut === "validee" && t.date_validation ? ` · Validée le ${dFR(t.date_validation)}` : ""}
                </div>
                {t.photo && <img src={t.photo} alt="Preuve" className="mt-2 rounded-lg border border-slate-200 max-h-24" />}
              </div>
              <div className="flex items-center gap-2">
                {PASTILLE[t.statut] || PASTILLE.a_faire}
                {t.statut === "terminee" && (
                  <>
                    <BoutonRond icone="✅" teinte="vert" onClick={() => valider(t)} titre="✅ Valider la tâche" />
                    <BoutonRond icone="↩" teinte="rouge" onClick={() => rouvrir(t)} titre="↩ Rouvrir la tâche (motif)" />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
