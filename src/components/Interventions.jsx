// ============================================================
// components/Interventions.jsx — 🔩 LE JOURNAL DES INTERVENTIONS d'une
// installation (Timo, 17/11/2026). Les règles vivent dans lib/interventions.js.
//
// DEUX endroits : le dossier d'une installation (`InterventionsDuChantier`) et
// le panneau des statistiques de 🏠 Clients installés (`StatistiquesPannes`).
// Les gestes revérifient le droit sur la fiche FRAÎCHE, avant toute écriture.
// Les deux avis WhatsApp partent du numéro BMI, sans question ni repli, APRÈS
// l'enregistrement ; la CAUSE probable n'y est jamais (décision « A non »).
// ⚠ LE MUR : l'espace du CHANTIER décide, jamais celui de qui clique.
// ============================================================
import { useState } from "react";
import { Field, inputCls, uAlert, BoutonEnvoi } from "./ui";
import { today, dFR } from "../lib/core";
import { bloquerSiLecture, espaceDuChantier } from "../lib/calculs";
import { ficheParId } from "../lib/banques";
import { envoiInterventionOuverte, envoiInterventionResolue } from "../lib/whatsappModeles";
import {
  ELEMENTS_EN_CAUSE, libelleElement, PANNE_MAX, CAUSE_MAX, SOLUTION_MAX, MATERIEL_MAX,
  interventionsDe, interventionsRecentes, resumeInterventions, estResolue,
  motifRefusNote, peutNoter, peutLire, critiqueIntervention, nouvelleIntervention,
  critiqueResolution, resoudreIntervention, avecIntervention, avecResolution, statistiquesInterventions,
} from "../lib/interventions";

const titre = "text-xs font-bold uppercase tracking-wide text-slate-500 mt-3 mb-1";

// L'avis au client. Rend la phrase qui dit ce qui s'est passé (jamais vide
// quand quelque chose ne part pas), "" quand rien n'est à dire.
async function avisAuClient({ db, save, profile, c, envoi }) {
  if (!envoi) return "";
  if (espaceDuChantier(db, c, profile) === true) return "";
  const compte = c.user_id ? ficheParId(db.users, c.user_id) : null;
  if (compte && compte.bloque) return "";
  if (String(c.tel || "").replace(/\D/g, "").length < 8) return "📲 Le client n'a pas reçu de WhatsApp : sa fiche n'a pas de numéro.";
  const { envoyerRecuSansQuestion } = await import("../whatsapp.js");
  return envoyerRecuSansQuestion({
    envoi, tel: c.tel, nom: `${c.prenom || ""} ${c.nom || ""}`.trim(), espaceFormation: false, save, profile,
    ref: { chantier_id: c.id }, noms: { titre: "Avis au client", sujet: "L'avis au client" },
  });
}

// Les gestes — écrits UNE fois, rendus par le composant ET lisibles par le banc.
export async function noterIntervention({ db, save, profile, chantierId, saisie }) {
  if (bloquerSiLecture(db, profile)) return null;
  const c = (db.clients_installes || []).find((x) => x.id === chantierId);
  const refus = motifRefusNote(c, profile) || critiqueIntervention(saisie);
  if (refus) { uAlert(refus); return null; }
  const intervention = nouvelleIntervention(saisie, profile, today());
  save({ ...db, clients_installes: db.clients_installes.map((x) => (x.id === c.id ? avecIntervention(c, intervention) : x)) },
    `Intervention ${estResolue(intervention) ? "résolue" : "ouverte"} sur « ${c.prenom || ""} ${c.nom} » — ${libelleElement(intervention.element)} : ${intervention.panne}`);
  const compte = c.user_id ? ficheParId(db.users, c.user_id) : null;
  // Résolue d'un coup : SEUL l'avis « résolue » part (décision de Timo).
  const envoi = estResolue(intervention)
    ? envoiInterventionResolue({ chantier: c, compte, intervention, dFR })
    : envoiInterventionOuverte({ chantier: c, compte, intervention });
  return avisAuClient({ db, save, profile, c, envoi });
}

export async function resoudreUneIntervention({ db, save, profile, chantierId, interventionId, saisie }) {
  if (bloquerSiLecture(db, profile)) return null;
  const c = (db.clients_installes || []).find((x) => x.id === chantierId);
  const ancienne = interventionsDe(c).find((i) => i.id === interventionId);
  const refus = motifRefusNote(c, profile) || critiqueResolution(ancienne, saisie);
  if (refus) { uAlert(refus); return null; }
  const resolue = resoudreIntervention(ancienne, saisie, profile);
  save({ ...db, clients_installes: db.clients_installes.map((x) => (x.id === c.id ? avecResolution(c, interventionId, resolue) : x)) },
    `Intervention résolue sur « ${c.prenom || ""} ${c.nom} » — ${libelleElement(resolue.element)} : ${resolue.solution}`);
  const compte = c.user_id ? ficheParId(db.users, c.user_id) : null;
  return avisAuClient({ db, save, profile, c, envoi: envoiInterventionResolue({ chantier: c, compte, intervention: resolue, dFR }) });
}

const saisieVide = (profile) => ({
  date: today(), element: "", panne: "", cause: "", materiel: "", solution: "", solution_date: today(),
  technicien_id: profile.id, technicien_nom: profile.nom_complet || profile.nom,
});

export function InterventionsDuChantier({ c, db, profile, save, boutique }) {
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState(() => saisieVide(profile));
  const [resoudre, setResoudre] = useState(null); // { id, solution, date, materiel }
  const [message, setMessage] = useState("");
  if (!peutLire(c, profile, boutique)) return null;
  const peut = peutNoter(c, profile);
  const liste = interventionsRecentes(c);
  const r = resumeInterventions(c);
  const choixTechniciens = (() => {
    const vus = new Set();
    const l = [{ id: profile.id, nom: profile.nom_complet || profile.nom }];
    vus.add(profile.id);
    for (const e of (c.equipe || [])) {
      if (!e.user_id || vus.has(e.user_id)) continue;
      vus.add(e.user_id);
      const fiche = ficheParId(db.users, e.user_id);
      l.push({ id: e.user_id, nom: (fiche && (fiche.nom_complet || fiche.nom)) || e.nom });
    }
    return l;
  })();
  const maj = (cle, v) => setF({ ...f, [cle]: v });
  const enregistrer = async () => {
    const phrase = await noterIntervention({ db, save, profile, chantierId: c.id, saisie: f });
    if (phrase === null) return;
    setOuvert(false); setF(saisieVide(profile));
    setMessage(`✅ Intervention enregistrée.${phrase ? `\n${phrase}` : ""}`);
  };
  const terminer = async () => {
    const phrase = await resoudreUneIntervention({ db, save, profile, chantierId: c.id, interventionId: resoudre.id, saisie: resoudre });
    if (phrase === null) return;
    setResoudre(null);
    setMessage(`✅ Intervention résolue.${phrase ? `\n${phrase}` : ""}`);
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 mb-3" data-interventions>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold text-slate-800">
          🔩 Interventions
          <span className="ml-2 text-xs font-normal text-slate-500" data-resume-interventions>
            {r.total === 0 ? "aucune notée" : `${r.total} au total${r.ouvertes ? ` — ${r.ouvertes} ouverte${r.ouvertes > 1 ? "s" : ""}` : ""}`}
          </span>
        </div>
        {peut && !ouvert && (
          <button type="button" className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-900" onClick={() => { setOuvert(true); setMessage(""); }} data-noter-intervention>
            ➕ Noter une intervention
          </button>
        )}
      </div>
      {message && <div className="mt-2 whitespace-pre-line text-sm text-green-800" data-message-intervention>{message}</div>}

      {ouvert && (
        <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50/40 p-3" data-formulaire-intervention>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Date de l'intervention">
              <input type="date" className={inputCls} value={f.date} onChange={(e) => maj("date", e.target.value)} data-intervention="date" />
            </Field>
            <Field label="Élément en cause">
              <select className={inputCls} value={f.element} onChange={(e) => maj("element", e.target.value)} data-intervention="element">
                <option value="">— Choisir —</option>
                {ELEMENTS_EN_CAUSE.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
              </select>
            </Field>
            <Field label="Technicien en charge">
              <select className={inputCls} value={f.technicien_id} onChange={(e) => { const t = choixTechniciens.find((x) => x.id === e.target.value); setF({ ...f, technicien_id: e.target.value, technicien_nom: t ? t.nom : "" }); }} data-intervention="technicien">
                {choixTechniciens.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </select>
            </Field>
            <Field label="Matériel changé ou réparé">
              <input className={inputCls} maxLength={MATERIEL_MAX} value={f.materiel} onChange={(e) => maj("materiel", e.target.value)} data-intervention="materiel" />
            </Field>
          </div>
          <Field label="Panne constatée (le client la lira dans le message)">
            <input className={inputCls} maxLength={PANNE_MAX} value={f.panne} onChange={(e) => maj("panne", e.target.value)} placeholder="Ex : l'onduleur s'éteint le soir" data-intervention="panne" />
          </Field>
          <Field label="Cause probable (interne : elle ne part jamais chez le client)">
            <input className={inputCls} maxLength={CAUSE_MAX} value={f.cause} onChange={(e) => maj("cause", e.target.value)} data-intervention="cause" />
          </Field>
          <div className={titre}>✅ Déjà résolue ?</div>
          <div className="grid sm:grid-cols-[1fr_11rem] gap-3">
            <Field label="Solution apportée (laissez vide si la panne est encore à traiter)">
              <input className={inputCls} maxLength={SOLUTION_MAX} value={f.solution} onChange={(e) => maj("solution", e.target.value)} data-intervention="solution" />
            </Field>
            {f.solution.trim() && (
              <Field label="Résolue le">
                <input type="date" className={inputCls} value={f.solution_date} onChange={(e) => maj("solution_date", e.target.value)} data-intervention="solution-date" />
              </Field>
            )}
          </div>
          <div className="text-xs text-slate-600 mt-1" data-aide-intervention>
            {f.solution.trim()
              ? "📲 Le client recevra un seul message : l'incident est résolu, avec la solution."
              : "📲 Le client recevra un message : l'incident est pris en charge. Un second partira quand vous noterez la solution."}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <BoutonEnvoi className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white" onClick={enregistrer} data-enregistrer-intervention>💾 Enregistrer l'intervention</BoutonEnvoi>
            <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => setOuvert(false)}>Annuler</button>
          </div>
        </div>
      )}

      {liste.length > 0 && (
        <div className="mt-2 space-y-2">
          {liste.map((i) => (
            <div key={i.id} className={`rounded-lg border p-2 text-sm ${estResolue(i) ? "border-green-200 bg-green-50/50" : "border-amber-300 bg-amber-50"}`} data-intervention-ligne={i.id}>
              <div className="flex flex-wrap items-center gap-2">
                <b>{dFR(i.date)}</b>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{libelleElement(i.element) || "—"}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${estResolue(i) ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{estResolue(i) ? "✅ Résolue" : "⏳ Ouverte"}</span>
                <span className="text-xs text-slate-500">🔧 {i.technicien_nom || "—"}</span>
              </div>
              <div className="mt-1"><b>Panne :</b> {i.panne}</div>
              {i.cause && <div><b>Cause probable :</b> {i.cause} <span className="text-[11px] text-slate-400">(interne)</span></div>}
              {i.materiel && <div><b>Matériel :</b> {i.materiel}</div>}
              {estResolue(i) && <div><b>Solution :</b> {i.solution} <span className="text-[11px] text-slate-500">— résolue le {dFR(i.resolu_le)}</span></div>}
              {peut && !estResolue(i) && (resoudre && resoudre.id === i.id ? (
                <div className="mt-2 grid sm:grid-cols-[1fr_11rem] gap-2 items-end" data-resoudre-formulaire>
                  <Field label="Solution apportée">
                    <input className={inputCls} maxLength={SOLUTION_MAX} value={resoudre.solution} onChange={(e) => setResoudre({ ...resoudre, solution: e.target.value })} data-resoudre="solution" />
                  </Field>
                  <Field label="Résolue le">
                    <input type="date" className={inputCls} value={resoudre.date} onChange={(e) => setResoudre({ ...resoudre, date: e.target.value })} data-resoudre="date" />
                  </Field>
                  <div className="sm:col-span-2 flex flex-wrap gap-2">
                    <BoutonEnvoi className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-semibold text-white" onClick={terminer} data-enregistrer-resolution>✅ Enregistrer la solution</BoutonEnvoi>
                    <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" onClick={() => setResoudre(null)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="mt-2 rounded-lg border border-green-300 bg-green-50 px-3 py-1 text-sm font-semibold text-green-900" onClick={() => { setResoudre({ id: i.id, solution: "", date: today(), materiel: "" }); setMessage(""); }} data-resoudre-intervention>
                  ✅ Marquer résolue
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {!peut && <div className="mt-1 text-[11px] text-slate-400">Lecture seule : seuls l'équipe du chantier, l'administrateur et le responsable commercial notent.</div>}
    </div>
  );
}

// 📊 Les statistiques. `chantiers` = déjà filtrés par l'espace regardé (et la
// boutique du gérant) ; `dans` = le filtre de période.
export function StatistiquesPannes({ chantiers, dans, libellePeriode, onFermer }) {
  const s = statistiquesInterventions(chantiers, dans);
  const carre = (valeur, nom, cle) => (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center" data-stat-pannes={cle}>
      <div className="text-2xl font-bold text-slate-800 tabular-nums">{valeur}</div>
      <div className="text-xs text-slate-500">{nom}</div>
    </div>
  );
  return (
    <div className="rounded-xl border-2 border-sky-300 bg-white p-4" data-statistiques-pannes>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-bold text-sky-900">📊 Pannes et interventions{libellePeriode ? ` — ${libellePeriode}` : ""}</div>
        <button type="button" className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600" onClick={onFermer}>Fermer</button>
      </div>
      {s.total === 0 ? (
        <div className="text-sm text-slate-500" data-stat-vide>Aucune intervention notée sur cette période. Les statistiques ne comptent que ce qui est saisi : les pannes d'avant la mise en place ne sont nulle part.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {carre(s.total, "interventions", "total")}
            {carre(s.resolues, "résolues", "resolues")}
            {carre(s.ouvertes, "encore ouvertes", "ouvertes")}
            {carre(s.delaiMoyenJours === null ? "—" : `${String(s.delaiMoyenJours).replace(".", ",")} j`, "délai moyen de résolution", "delai")}
          </div>
          <div className="grid lg:grid-cols-3 gap-4 mt-4">
            <div data-stat-elements>
              <div className={titre}>Éléments les plus souvent en cause</div>
              {s.elements.map((e) => <div key={e.id} className="flex justify-between text-sm border-b border-slate-100 py-0.5"><span>{e.libelle}</span><b className="tabular-nums">{e.n}</b></div>)}
            </div>
            <div data-stat-techniciens>
              <div className={titre}>Par technicien</div>
              {s.techniciens.map((t) => <div key={t.nom} className="flex justify-between text-sm border-b border-slate-100 py-0.5"><span>{t.nom}</span><span className="tabular-nums"><b>{t.total}</b> <span className="text-xs text-slate-500">({t.resolues} résolue{t.resolues > 1 ? "s" : ""})</span></span></div>)}
            </div>
            <div data-stat-recurrentes>
              <div className={titre}>Installations qui reviennent (à surveiller)</div>
              {s.recurrentes.length === 0
                ? <div className="text-sm text-slate-500">Aucune installation n'a eu plus d'une panne sur la période.</div>
                : s.recurrentes.map((x) => <div key={x.id} className="flex justify-between text-sm border-b border-slate-100 py-0.5"><span>{x.nom}</span><b className="tabular-nums">{x.total} pannes</b></div>)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
