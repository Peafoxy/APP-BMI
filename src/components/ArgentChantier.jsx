// ============================================================
// components/ArgentChantier.jsx — L'ARGENT REMIS À UN TECHNICIEN POUR UN CHANTIER
// (Timo, 07/10/2026 — « b » : un total par chantier ; « s'il reste, il faut
// rendre le reste, et la caisse de sortie est immédiatement créditée lorsque
// le gérant valide la somme rendue »). Les règles vivent dans
// lib/argentChantier.js ; ici, les trois cadres qui les montrent :
//   • MonArgentDeChantier — chez le technicien : reçu, détail, reste, rendre ;
//   • RetoursAValider     — chez le gérant / l'administrateur : valider ou
//                           refuser l'argent rendu (la caisse est créditée à
//                           la validation, pas avant) ;
//   • ArgentDuChantier    — sur la fiche d'un chantier : ce que chacun a reçu,
//                           détaillé, rendu, et ce qui reste à justifier.
// ============================================================
import { useState } from "react";
import { fmt, dFR, today, heureCourte } from "../lib/core";
import { CATEGORIES } from "../lib/constants";
import { Field, inputCls, btnDark, uAlert, uConfirm, uPrompt, uChoix } from "./ui";
import { bloquerSiLecture, utilisateursDeLEspace } from "../lib/calculs";
import { argentParChantier, soldeArgentChantier, critiqueJustif, ajouterJustif, retirerJustif, critiqueDemandeRetour, demanderRetour, retoursEnAttente, caissesDuRetour, libelleCaisseRetour, peutValiderRetour, critiqueValidationRetour, validerRetour, refuserRetour, techniciensDuChantier } from "../lib/argentChantier";

const remplacerFiche = (db, fiche) => (db.users || []).map((u) => (u.id === fiche.id ? fiche : u));
const ficheFraiche = (db, id) => (db.users || []).find((u) => u.id === id);

// Une ligne de chiffres : reçu, détaillé, rendu, reste.
function Chiffres({ s }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <span>Reçu : <b className="tabular-nums">{fmt(s.recu)}</b></span>
      <span>Détaillé : <b className="tabular-nums">{fmt(s.justifie)}</b></span>
      {s.rendu > 0 && <span>Rendu : <b className="tabular-nums">{fmt(s.rendu)}</b></span>}
      {s.retourEnAttente > 0 && <span className="text-amber-700">Rendu, en attente du gérant : <b className="tabular-nums">{fmt(s.retourEnAttente)}</b></span>}
      <span className={s.reste > 0 ? "text-orange-700 font-bold" : "text-emerald-700 font-bold"} data-reste-a-justifier>{s.reste > 0 ? `Reste à justifier : ${fmt(s.reste)}` : "✓ Tout est justifié"}</span>
      {s.enAttenteDG > 0 && <span className="text-xs text-slate-500">(+ {fmt(s.enAttenteDG)} en attente du DG, pas encore compté)</span>}
    </div>
  );
}

function LignesDetail({ s, onRetirer }) {
  return (
    <>
      <div className="text-xs text-slate-500 mt-1">
        Remis : {s.remises.map((d) => `${fmt(d.montant)} le ${dFR(d.date)} par ${d.par}`).join(" · ") || "—"}
      </div>
      {s.justifs.length > 0 && (
        <ul className="mt-1 space-y-0.5" data-lignes-justifiees>
          {s.justifs.map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-2 text-sm">
              <span><b>{dFR(j.date)} · {j.categorie}{j.description ? ` — ${j.description}` : ""} · {fmt(j.montant)}</b></span>
              {onRetirer && <button onClick={() => onRetirer(j)} className="text-xs text-red-700 underline shrink-0">Retirer</button>}
            </li>
          ))}
        </ul>
      )}
      {s.retours.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs">
          {s.retours.map((r) => (
            <li key={r.id} className={r.statut === "rejetee" ? "text-red-700" : r.statut === "attente" ? "text-amber-700" : "text-emerald-700"}>
              ↩ {fmt(r.montant)} rendus le {dFR(r.le)} — {r.statut === "attente" ? "en attente du gérant" : r.statut === "validee" ? `validé par ${r.decide_par} (${r.caisse})` : `refusé par ${r.decide_par} : ${r.motif}`}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ── Chez le technicien ──
export function MonArgentDeChantier({ db, save, profile }) {
  const moi = utilisateursDeLEspace(db, profile).find((u) => u.id === profile.id);
  const [ouvert, setOuvert] = useState(null);
  const vide = { categorie: "", description: "", montant: "", date: today() };
  const [l, setL] = useState(vide);
  if (!moi) return null;
  const parChantier = argentParChantier(db.depenses, moi);
  if (parChantier.length === 0) return null;

  const ajouter = (chantierId) => {
    if (bloquerSiLecture(db, profile)) return;
    const frais = ficheFraiche(db, profile.id);
    const s = soldeArgentChantier(db.depenses, frais, chantierId);
    const refus = critiqueJustif(s, l);
    if (refus) { uAlert(refus); return; }
    save({ ...db, users: remplacerFiche(db, ajouterJustif(frais, s, l, today())) },
      `Détail de l'argent de chantier : ${fmt(Number(l.montant))} en ${l.categorie} (${s.chantierNom || "chantier"}) — ${frais.nom}`);
    setL(vide);
  };
  const retirer = async (j) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm(`Retirer la ligne « ${j.categorie} — ${fmt(j.montant)} » ?`)) return;
    const frais = ficheFraiche(db, profile.id);
    save({ ...db, users: remplacerFiche(db, retirerJustif(frais, j.id)) }, `Ligne de détail retirée : ${fmt(j.montant)} en ${j.categorie} — ${frais.nom}`);
  };
  const rendre = async (chantierId) => {
    if (bloquerSiLecture(db, profile)) return;
    const frais = ficheFraiche(db, profile.id);
    const s = soldeArgentChantier(db.depenses, frais, chantierId);
    const saisie = await uPrompt(`Combien rendez-vous pour ${s.chantierNom || "ce chantier"} ?\n\nIl reste ${fmt(s.reste)} à justifier. La caisse ne sera créditée que lorsque le gérant aura validé la somme rendue.`, String(s.reste));
    if (saisie === null) return;
    const montant = Number(String(saisie).replace(/\s/g, ""));
    const refus = critiqueDemandeRetour(s, montant);
    if (refus) { uAlert(refus); return; }
    save({ ...db, users: remplacerFiche(db, demanderRetour(frais, s, montant, today())) },
      `Argent de chantier rendu (en attente du gérant) : ${fmt(montant)} — ${s.chantierNom || "chantier"} — ${frais.nom}`);
    uAlert(`↩ ${fmt(montant)} annoncés comme rendus. Remettez l'argent au gérant : il le valide dans 📤 Dépenses, et la caisse est créditée à ce moment-là.`);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-purple-200 shadow-sm p-4" data-argent-chantier>
      <div className="font-bold text-purple-900 mb-2">💼 Argent reçu pour vos chantiers</div>
      <div className="space-y-3">
        {parChantier.map((s) => (
          <div key={s.chantierId} className="rounded-lg border border-slate-200 p-3">
            <div className="font-bold text-sm mb-1">🏠 {s.chantierNom || "Chantier"}</div>
            <Chiffres s={s} />
            <LignesDetail s={s} onRetirer={retirer} />
            {s.reste > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => { setOuvert(ouvert === s.chantierId ? null : s.chantierId); setL(vide); }} className={btnDark}>✏️ Détailler</button>
                <button onClick={() => rendre(s.chantierId)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold">↩ Rendre le reste</button>
              </div>
            )}
            {ouvert === s.chantierId && s.reste > 0 && (
              <div className="grid sm:grid-cols-4 gap-2 mt-2 items-end">
                <Field label="À quoi"><select className={inputCls} value={l.categorie} onChange={(e) => setL({ ...l, categorie: e.target.value })}><option value="">— Choisir —</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
                <Field label="Précision"><input className={inputCls} value={l.description} onChange={(e) => setL({ ...l, description: e.target.value })} /></Field>
                <Field label="Montant (F)"><input type="number" className={inputCls} value={l.montant} onChange={(e) => setL({ ...l, montant: e.target.value })} /></Field>
                <Field label="Date"><input type="date" className={inputCls} value={l.date} onChange={(e) => setL({ ...l, date: e.target.value })} /></Field>
                <div className="sm:col-span-4"><button onClick={() => ajouter(s.chantierId)} className={btnDark}>Ajouter la ligne</button></div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-500 mt-2">Le détail ne crée pas de nouvelle dépense : l'argent est déjà sorti de la caisse une fois. Il dit seulement à quoi il a servi.</div>
    </div>
  );
}

// ── Chez le gérant / l'administrateur ──
export function RetoursAValider({ db, save, profile }) {
  const personnes = utilisateursDeLEspace(db, profile);
  const liste = retoursEnAttente(personnes).map((x) => {
    const s = soldeArgentChantier(db.depenses, x.technicien, x.retour.chantier_id);
    return { ...x, caisses: caissesDuRetour(s).filter((c) => peutValiderRetour(profile, c)) };
  }).filter((x) => x.caisses.length > 0);
  if (liste.length === 0) return null;

  const valider = async ({ technicien, retour, caisses }) => {
    if (bloquerSiLecture(db, profile)) return;
    let caisse = caisses[0];
    if (caisses.length > 1) {
      const choix = await uChoix(`Dans quelle caisse revient l'argent rendu par ${technicien.nom} ?`, caisses.map(libelleCaisseRetour));
      if (!choix) return;
      caisse = caisses.find((c) => libelleCaisseRetour(c) === choix);
    }
    const frais = ficheFraiche(db, technicien.id);
    const refus = critiqueValidationRetour(profile, frais, retour.id, caisse);
    if (refus) { uAlert(refus); return; }
    if (!await uConfirm(`Avez-vous reçu ${fmt(retour.montant)} de ${technicien.nom} (${retour.chantier_nom || "chantier"}) ?\n\nLa somme est créditée tout de suite sur : ${libelleCaisseRetour(caisse)}.`)) return;
    const r = validerRetour(profile, frais, retour.id, caisse, today(), heureCourte());
    save({ ...db, users: remplacerFiche(db, r.technicien), depenses: [r.depense, ...(db.depenses || [])] }, r.journal);
  };
  const refuser = async ({ technicien, retour }) => {
    if (bloquerSiLecture(db, profile)) return;
    const motif = await uPrompt(`Refuser les ${fmt(retour.montant)} annoncés par ${technicien.nom} ?\n\nMotif — obligatoire (par exemple : argent pas reçu).`, "");
    if (motif === null) return;
    if (!String(motif).trim()) { uAlert("Le motif est obligatoire."); return; }
    const frais = ficheFraiche(db, technicien.id);
    const r = refuserRetour(profile, frais, retour.id, motif, today());
    save({ ...db, users: remplacerFiche(db, r.technicien) }, r.journal);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-amber-300 shadow-sm p-4" data-retours-a-valider>
      <div className="font-bold text-amber-900 mb-2">↩ Argent de chantier rendu, à valider ({liste.length})</div>
      <div className="space-y-1">
        {liste.map((x) => (
          <div key={x.retour.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            <div><b className="tabular-nums">{fmt(x.retour.montant)}</b> rendus par <b>{x.technicien.nom}</b> le {dFR(x.retour.le)} — {x.retour.chantier_nom || "chantier"}
              <div className="text-xs text-slate-500">revient à : {x.caisses.map(libelleCaisseRetour).join(" ou ")}</div></div>
            <div className="flex gap-2">
              <button onClick={() => valider(x)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">✅ Reçu</button>
              <button onClick={() => refuser(x)} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-bold">✖ Refuser</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sur la fiche d'un chantier (lecture) ──
export function ArgentDuChantier({ db, profile, chantierId }) {
  const techs = techniciensDuChantier(db.depenses, utilisateursDeLEspace(db, profile), chantierId);
  if (techs.length === 0) return null;
  return (
    <div className="mt-1 space-y-2" data-argent-du-chantier>
      {techs.map((t) => {
        const s = soldeArgentChantier(db.depenses, t, chantierId);
        return (
          <div key={t.id} className="rounded-lg border border-purple-200 bg-purple-50/40 p-2">
            <div className="text-sm font-bold">💼 Remis à {t.nom}</div>
            <Chiffres s={s} />
            <LignesDetail s={s} />
          </div>
        );
      })}
    </div>
  );
}
