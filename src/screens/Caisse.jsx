// ============================================================
// screens/Caisse.jsx — Clôture de caisse du jour.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { uid, fmt, today, dFR, totalVente } from "../lib/core";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm, AucuneBoutique } from "../components/ui";
import { bloquerSiLecture, boutiquesVente, boutiquesVisibles, boutiqueParDefaut, estCompteFormation } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";

// ============ CAISSE ============
export function Caisse({ db, save, profile }) {
  const premiere = boutiqueParDefaut(db, profile);
  const [bq, setBq] = useState(profile.boutique || premiere);
  // ⚠ `bq` est un état initialisé UNE SEULE FOIS au premier montage, et les
  // écrans restent montés toute la session (depuis 2.98.99). Si cet écran a
  // été ouvert AVANT que les boutiques ne soient arrivées du serveur (la
  // fenêtre de synchronisation initiale, à la connexion), `bq` reste vide
  // pour toujours. On retombe donc sur `premiere`, qui est recalculé à
  // CHAQUE rendu : l'écran se répare tout seul dès que les boutiques
  // arrivent. Sans ce repli, l'écran restait bloqué sur « Aucune boutique »
  // — et le sélecteur qui aurait permis d'en choisir une était justement
  // masqué derrière ce blocage.
  const boutique = profile.boutique || bq || premiere;
  const [compte, setCompte] = useState("");
  const [notes, setNotes] = useState("");
  const t = today();

  const especesVentes = db.ventes.filter((v) => v.boutique === boutique && String(v.date) === t && v.paiement === "Espèces")
    .reduce((s, v) => s + totalVente(v) + Number(v.frais_installation || 0) + Number(v.frais_transport || 0), 0);
  const especesDepenses = db.depenses.filter((x) => x.boutique === boutique && String(x.date) === t && x.paiement === "Espèces").reduce((s, x) => s + Number(x.montant), 0);
  // Les règlements de dettes et les versements sur réservation entrent aussi dans la caisse.
  // (Ils étaient oubliés : le théorique du jour était donc faux.)
  const especesReglements = (db.dettes || []).filter((d) => d.boutique === boutique)
    .reduce((s, d) => s + (d.paiements || [])
      .filter((p) => String(p.date) === t && (p.paiement || "Espèces") === "Espèces")
      .reduce((t2, p) => t2 + Number(p.montant || 0), 0), 0);
  // ⚠ Demande Timo (caisse TERRAIN) : "comment reconnaître que tel paiement
  // correspond à tel devis de ce client ?" — le total seul ne le dit pas.
  // Détail ligne par ligne, réutilisant les mêmes données que le calcul
  // ci-dessus (chaque paiement porte déjà client/motif/heure/par).
  const detailReglements = (db.dettes || []).filter((d) => d.boutique === boutique)
    .flatMap((d) => (d.paiements || [])
      .filter((p) => String(p.date) === t)
      .map((p) => ({ ...p, client: d.client, motif: d.motif, numero: d.numero, detteId: d.id })))
    .sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
  const theorique = especesVentes + especesReglements - especesDepenses;
  const dejaCloturee = db.clotures.some((c) => c.boutique === boutique && String(c.date) === t);
  const ecart = compte === "" ? null : Number(compte) - theorique;

  const cloturer = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (compte === "") { uAlert("Comptez la caisse et saisissez le montant."); return; }
    if (!await uConfirm(`Confirmer la clôture du ${dFR(t)} ?\nThéorique : ${fmt(theorique)}\nCompté : ${fmt(Number(compte))}\nÉcart : ${fmt(Number(compte) - theorique)}`)) return;
    save({ ...db, clotures: [{ id: uid(), date: t, boutique, theorique, compte: Number(compte), notes, par: profile.nom }, ...db.clotures] }, `Clôture caisse ${boutique} : compté ${fmt(Number(compte))} (écart ${fmt(Number(compte) - theorique)})`);
    setCompte(""); setNotes("");
    uAlert("Clôture enregistrée !");
  };

  const liste = db.clotures.filter((c) => c.boutique === boutique);

  // ⚠ Cloisonnement : aucune boutique de l'espace du compte connecté —
  // on n'affiche PAS le formulaire, plutôt que de le laisser écrire dans la
  // boutique de repli (voir boutiqueParDefaut dans lib/calculs.js).
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;
  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} avecTerrain profile={profile} />}
      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">Clôture de caisse du jour <Badge boutique={boutique} /></div>
        {dejaCloturee ? (
          <div className="text-sm font-semibold text-green-700">✓ La caisse du {dFR(t)} a déjà été clôturée.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Ventes en espèces</div><div className="font-bold tabular-nums">{fmt(especesVentes)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Encaissements (dettes / réservations)</div><div className="font-bold tabular-nums text-emerald-700">{fmt(especesReglements)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Dépenses en espèces</div><div className="font-bold tabular-nums">− {fmt(especesDepenses)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Espèces attendues</div><div className="font-bold tabular-nums">{fmt(theorique)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="text-xs text-slate-500">Écart</div>
                <div className={`font-bold tabular-nums ${ecart === null ? "text-slate-400" : ecart === 0 ? "text-green-700" : "text-red-600"}`}>{ecart === null ? "—" : fmt(ecart)}</div>
              </div>
            </div>
            {detailReglements.length > 0 && (
              <div className="mb-3 rounded-lg border border-slate-200 bg-white overflow-hidden">
                <div className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Détail des encaissements du jour — qui a payé quoi</div>
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-3 py-1.5">Heure</th><th className="text-left px-3 py-1.5">Client</th><th className="text-left px-3 py-1.5">Motif</th><th className="text-left px-3 py-1.5">Montant</th><th className="text-left px-3 py-1.5">Encaissé par</th></tr></thead>
                  <tbody>
                    {detailReglements.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">{p.heure || "—"}</td>
                        <td className="px-3 py-1.5 font-semibold">{p.client}</td>
                        <td className="px-3 py-1.5 text-slate-500">{p.motif}{p.numero ? ` (${p.numero})` : ""}</td>
                        <td className="px-3 py-1.5 tabular-nums font-bold">{fmt(p.montant)}</td>
                        <td className="px-3 py-1.5">{p.par}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Espèces comptées (F)"><input type="number" className={inputCls} value={compte} onChange={(e) => setCompte(e.target.value)} /></Field>
              <div className="lg:col-span-2"><Field label="Remarques"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : Monnaie rendue..." /></Field></div>
            </div>
            <button onClick={cloturer} className={`mt-3 ${btnDark}`}>Clôturer la caisse</button>
          </>
        )}
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Historique des clôtures — {boutique}</div>
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Attendu", "Compté", "Écart", "Remarques", "Par"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Aucune clôture enregistrée.</td></tr>}
            {liste.map((c) => {
              const e = Number(c.compte) - Number(c.theorique);
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2">{dFR(c.date)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(c.theorique)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(c.compte)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${e === 0 ? "text-green-700" : "text-red-600"}`}>{fmt(e)}</td>
                  <td className="px-3 py-2">{c.notes || "—"}</td>
                  <td className="px-3 py-2">{c.par}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ DEMANDE DE RAVITAILLEMENT (côté boutique) ============
