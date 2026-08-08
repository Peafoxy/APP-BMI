// ============================================================
// screens/Commerciaux.jsx — Gestion des agents commerciaux :
// création, équipes, taux de commission. Aussi réutilisé par
// MonEquipe (vue restreinte du chef d'équipe).
// ============================================================
import { useState } from "react";
import { Ventes } from "../screens/Ventes";
import { uid, totalVente, fmt, today, dFR, telDigits, inP } from "../lib/core";
import { Field, inputCls, btnDark, uAlert, uConfirm, uPrompt } from "../components/ui";
import { periodes , ventesDuCommercial } from "../lib/calculs";
import { exportCSV } from "../lib/export";

// ============ COMMERCIAUX ============
export function Commerciaux({ db, save }) {
  const [f, setF] = useState({ nom: "", tel: "", zone: "", taux: "", objectif: "" });
  const [periodeIndex, setPeriodeIndex] = useState(2); // Ce mois par défaut
  const [customDebut, setCustomDebut] = useState("");
  const [customFin, setCustomFin] = useState("");

  // Période d'évaluation choisie par l'administrateur
  const [labelP, debutP, finP] = (() => {
    if (periodeIndex === "custom") return ["Période personnalisée", customDebut || today(), customFin || today()];
    return periodes()[periodeIndex] || periodes()[2];
  })();

  // Nombre de mois couverts (pour proratiser l'objectif mensuel)
  const nbMois = (() => {
    if (debutP <= "0001-01-01") return null; // "Depuis le début" : pas d'objectif comparable
    const a1 = Number(debutP.slice(0, 4)), m1 = Number(debutP.slice(5, 7));
    const a2 = Number(finP.slice(0, 4)), m2 = Number(finP.slice(5, 7));
    return Math.max(1, (a2 - a1) * 12 + (m2 - m1) + 1);
  })();

  const ajouter = () => {
    if (!f.nom) { uAlert("Veuillez saisir un nom."); return; }
    save({ ...db, commerciaux: [...db.commerciaux, { id: uid(), nom: f.nom, tel: f.tel, zone: f.zone, taux: Number(f.taux || 0), objectif: Number(f.objectif || 0), actif: true }] });
    setF({ nom: "", tel: "", zone: "", taux: "", objectif: "" });
    uAlert("Commercial ajouté !");
  };

  const modifier = async (c) => {
    const taux = await uPrompt(`Taux de commission de ${c.nom} (%) :`, c.taux);
    if (taux === null) return;
    const objectif = await uPrompt(`Objectif mensuel de ${c.nom} (F) :`, c.objectif);
    if (objectif === null) return;
    save({ ...db, commerciaux: db.commerciaux.map((x) => (x.id === c.id ? { ...x, taux: Number(taux || 0), objectif: Number(objectif || 0) } : x)) });
  };

  const toggleActif = (c) => save({ ...db, commerciaux: db.commerciaux.map((x) => (x.id === c.id ? { ...x, actif: x.actif === false } : x)) });

  const supprimer = async (c) => {
    if (await uConfirm(`Supprimer le commercial « ${c.nom} » ?`)) save({ ...db, commerciaux: db.commerciaux.filter((x) => x.id !== c.id) });
  };

  // Statistiques d'un commercial sur la période choisie
  const stats = (c) => {
    const vs = ventesDuCommercial(db, c.nom).filter((v) => inP(v.date, debutP, finP));
    const ca = vs.reduce((s, v) => s + totalVente(v), 0);
    const commission = Math.round((ca * Number(c.taux)) / 100);
    const objectifP = nbMois && c.objectif > 0 ? c.objectif * nbMois : null;
    const pct = objectifP ? Math.round((ca / objectifP) * 100) : null;
    const panier = vs.length ? Math.round(ca / vs.length) : 0;
    return { nb: vs.length, ca, commission, objectifP, pct, panier };
  };

  const liste = db.commerciaux || [];
  const classement = liste.map((c) => ({ c, s: stats(c) })).sort((a, b) => b.s.ca - a.s.ca);
  const totalCA = classement.reduce((s, x) => s + x.s.ca, 0);
  const totalCommissions = classement.reduce((s, x) => s + x.s.commission, 0);
  const totalVentes = classement.reduce((s, x) => s + x.s.nb, 0);

  const badgePerf = (pct) => {
    if (pct === null) return null;
    if (pct >= 100) return ["Objectif atteint", "bg-green-100 text-green-700"];
    if (pct >= 60) return ["En bonne voie", "bg-amber-100 text-amber-700"];
    return ["À suivre", "bg-red-100 text-red-700"];
  };
  const medaille = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}ᵉ`);

  const Stat = ({ label, value }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-sky-700">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-3">Nouveau commercial</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Téléphone"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
          <Field label="Zone"><input className={inputCls} value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} /></Field>
          <Field label="Commission (%)"><input type="number" step="0.5" className={inputCls} value={f.taux} onChange={(e) => setF({ ...f, taux: e.target.value })} /></Field>
          <Field label="Objectif mensuel (F)"><input type="number" className={inputCls} value={f.objectif} onChange={(e) => setF({ ...f, objectif: e.target.value })} /></Field>
        </div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="font-bold text-slate-800">Période d'évaluation :</div>
          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
            value={periodeIndex}
            onChange={(e) => setPeriodeIndex(e.target.value === "custom" ? "custom" : Number(e.target.value))}
          >
            {periodes().map(([label], i) => <option key={i} value={i}>{label}</option>)}
            <option value="custom">Personnalisée</option>
          </select>
          {periodeIndex === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={customDebut} onChange={(e) => setCustomDebut(e.target.value)} />
              <span className="text-slate-400">→</span>
              <input type="date" className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={customFin} onChange={(e) => setCustomFin(e.target.value)} />
            </div>
          )}
          {nbMois > 1 && <span className="text-xs text-slate-500">Objectifs proratisés sur {nbMois} mois</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label={`CA équipe — ${labelP}`} value={fmt(totalCA)} />
        <Stat label="Commissions à payer" value={fmt(totalCommissions)} />
        <Stat label="Ventes réalisées" value={totalVentes} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <span>Performance — {labelP} <span className="text-sm font-normal text-slate-500">({dFR(debutP)} → {dFR(finP)})</span></span>
          <button
            className="px-4 py-1.5 rounded-lg bg-sky-800 text-white text-xs font-bold hover:bg-sky-900"
            onClick={() => exportCSV("commissions", ["Rang", "Commercial", "Zone", "Période", "Ventes", "CA (F)", "Panier moyen (F)", "Taux (%)", "Commission (F)", "Objectif période (F)", "Atteinte (%)"],
              classement.map(({ c, s }, i) => [i + 1, c.nom, c.zone, `${dFR(debutP)} au ${dFR(finP)}`, s.nb, s.ca, s.panier, c.taux, s.commission, s.objectifP ?? "", s.pct ?? ""]))}
          >📄 Exporter les commissions</button>
        </div>
        <table className="w-full text-sm min-w-[1080px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Rang", "Commercial", "Zone", "Ventes", "CA", "Panier moyen", "Taux", "Commission", "Objectif période", "Progression", "Performance", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {classement.length === 0 && <tr><td colSpan={13} className="px-4 py-6 text-center text-slate-400">Aucun commercial.</td></tr>}
            {classement.map(({ c, s }, i) => {
              const perf = badgePerf(s.pct);
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-bold">{medaille(i)}</td>
                  <td className="px-3 py-2 font-semibold">{c.nom}{c.tel && <a href={`https://wa.me/${telDigits(c.tel)}`} target="_blank" rel="noreferrer" className="ml-2 text-xs text-green-700 underline">WhatsApp</a>}</td>
                  <td className="px-3 py-2">{c.zone || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{s.nb}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(s.ca)}</td>
                  <td className="px-3 py-2 tabular-nums">{s.nb ? fmt(s.panier) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{c.taux}%</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-blue-700">{fmt(s.commission)}</td>
                  <td className="px-3 py-2 tabular-nums">{s.objectifP ? fmt(s.objectifP) : "—"}</td>
                  <td className="px-3 py-2 w-32">
                    {s.pct === null ? "—" : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.pct >= 100 ? "bg-green-500" : s.pct >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, s.pct)}%` }}></div>
                        </div>
                        <span className="text-xs font-bold tabular-nums">{s.pct}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{perf ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${perf[1]}`}>{perf[0]}</span> : "—"}</td>
                  <td className="px-3 py-2">{c.actif === false ? <span className="text-xs font-bold text-red-600">Inactif</span> : <span className="text-xs font-bold text-green-700">Actif</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => modifier(c)} className="text-xs font-bold text-sky-800 underline mr-2">Modifier</button>
                    <button onClick={() => toggleActif(c)} className="text-xs font-bold text-sky-800 underline mr-2">{c.actif === false ? "Réactiver" : "Désactiver"}</button>
                    <button onClick={() => supprimer(c)} className="text-xs text-red-600 underline">Suppr.</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
