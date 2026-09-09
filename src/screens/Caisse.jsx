// ============================================================
// screens/Caisse.jsx — Clôture de caisse du jour.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { uid, fmt, today, dFR, totalVente } from "../lib/core";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm, AucuneBoutique } from "../components/ui";
import { bloquerSiLecture, boutiquesVente, boutiquesVisibles, boutiqueParDefaut, estCompteFormation, boutiqueRetenue, refuserSaufRoles, refuserSaufAdminPrincipal, estAdminPrincipal, espaceDuCompte, ROLES_CAISSE } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
import { destinationsPour, DEST_BANQUE, DEST_COMPTABLE, DEST_DG, ROLES_VERSEMENT, construireVersement, versementsDe, fondsAVerser, validationVersement, versementsAValiderParDG, versementsValidesParDG, messagesVersement, libelleDestination, libelleVersementDu, libelleEcart, montantDifferent, messageJustification } from "../lib/versements";

// ============ CAISSE ============
export function Caisse({ db, save, profile }) {
  const premiere = boutiqueParDefaut(db, profile, { ecran: "caisse" });
  const [bq, setBq] = useState(profile.boutique || premiere);
  // ⚠ Voir boutiqueRetenue (lib/calculs.js) : la valeur mémorisée peut être
  // vide (écran ouvert pendant la synchronisation d'ouverture) ou désigner
  // une boutique qui n'existe plus (supprimée, ou effacée par une
  // réinitialisation). Dans les deux cas, on repart de la boutique par
  // défaut plutôt que d'afficher un écran figé ou un nom fantôme.
  const boutique = boutiqueRetenue(db, profile, bq, { ecran: "caisse" });
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
    if (refuserSaufRoles(profile, ROLES_CAISSE, "Clôturer la caisse")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (compte === "") { uAlert("Comptez la caisse et saisissez le montant."); return; }
    if (!await uConfirm(`Confirmer la clôture du ${dFR(t)} ?\nThéorique : ${fmt(theorique)}\nCompté : ${fmt(Number(compte))}\nÉcart : ${fmt(Number(compte) - theorique)}`)) return;
    save({ ...db, clotures: [{ id: uid(), date: t, boutique, theorique, compte: Number(compte), notes, par: profile.nom }, ...db.clotures] }, `Clôture caisse ${boutique} : compté ${fmt(Number(compte))} (écart ${fmt(Number(compte) - theorique)})`);
    setCompte(""); setNotes("");
    uAlert("Clôture enregistrée !");
  };

  const liste = db.clotures.filter((c) => c.boutique === boutique);

  // ---- 💸 VERSEMENT DES FONDS (demande Timo, 09/09/2026) ----
  // Règle et écritures dans lib/versements.js. Vendeur, gérant, admin.
  // Chez le DG et BANQUE : validés par le DG (administrateur principal) ;
  // Chez le comptable : pointés « Encaissé » par le comptable.
  // ⚠ Cloisonnement : « Chez le comptable » (réelle, sans jumelle) n'est
  // proposée qu'en regardant le réel — jamais à un compte de formation.
  const destinations = destinationsPour(espaceDuCompte(db, profile) === true);
  const destinationDefaut = destinations.includes(DEST_COMPTABLE) ? DEST_COMPTABLE : DEST_DG;
  const [vers, setVers] = useState({ montant: "", destination: destinationDefaut, banque: "", bordereau: "", note: "" });
  const aVerser = fondsAVerser(db, boutique, totalVente);
  const mesVersements = versementsDe(db, boutique);
  const verser = async () => {
    if (refuserSaufRoles(profile, ROLES_VERSEMENT, "Verser les fonds")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (!destinations.includes(vers.destination)) { uAlert("Cette destination n'est pas disponible dans l'espace regardé."); return; }
    const r = construireVersement(profile, { boutique, ...vers, attendu: aVerser.montant });
    if (r.refus) { uAlert(r.refus); return; }
    if (!await uConfirm(`Enregistrer le versement de ${fmt(Number(vers.montant))} de ${boutique} → ${libelleDestination(r.versement)} ?\n\nIl restera « en attente » jusqu'à sa validation par ${vers.destination === DEST_COMPTABLE ? "le comptable" : "le DG"}.`)) return;
    save({
      ...db,
      depenses: [r.sortie, ...(r.entree ? [r.entree] : []), ...(db.depenses || [])],
      messages: [...messagesVersement(db, profile, r.sortie), ...(db.messages || [])],
    }, `Versement de fonds ${fmt(Number(vers.montant))} : ${boutique} → ${libelleDestination(r.versement)} (par ${profile.nom})`);
    setVers({ montant: "", destination: destinationDefaut, banque: "", bordereau: "", note: "" });
    uAlert("Versement enregistré — en attente de validation.");
  };
  // Le DG valide les versements « Chez le DG » et « BANQUE » de toutes les
  // boutiques de l'espace regardé.
  const jeSuisDG = estAdminPrincipal(db, profile);
  const nomsDG = jeSuisDG ? boutiquesVisibles(db, profile, db.boutiques || []).map((b) => b.nom) : [];
  const aValiderDG = jeSuisDG ? versementsAValiderParDG(db, nomsDG) : [];
  const validesDG = jeSuisDG ? versementsValidesParDG(db, nomsDG) : [];
  const validerDG = async (d) => {
    if (refuserSaufAdminPrincipal(db, profile, "Valider un versement de fonds (DG)")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm(`${libelleVersementDu(d)} : valider la réception de ${fmt(d.montant)} versés par ${d.par} (${d.boutique}) → ${libelleDestination(d.versement)} ?${libelleEcart(d.versement) ? `\n\n⚠ ${libelleEcart(d.versement)}${d.versement.note ? ` — ${d.versement.note}` : ""}` : ""}`)) return;
    save({ ...db, depenses: db.depenses.map((x) => (x.id === d.id ? { ...x, versement_valide_le: today(), versement_valide_par: profile.nom } : x)) },
      `Versement de fonds VALIDÉ par le DG : ${fmt(d.montant)} de ${d.boutique} → ${libelleDestination(d.versement)}`);
  };

  // ⚠ Cloisonnement : aucune boutique de l'espace du compte connecté —
  // on n'affiche PAS le formulaire, plutôt que de le laisser écrire dans la
  // boutique de repli (voir boutiqueParDefaut dans lib/calculs.js).
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;
  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs ecran="caisse" db={db} value={bq} onChange={setBq} avecTerrain profile={profile} />}
      {/* Timo (09/09/2026) : « sans versement, rien n'apparaît » — l'encadré
          du DG est PERMANENT : vide, il le dit, et montre les derniers validés. */}
      {jeSuisDG && (
        <div className={`bg-white rounded-xl border-2 shadow-sm p-4 ${aValiderDG.length > 0 ? "border-amber-300" : "border-slate-200"}`}>
          <div className={`font-bold mb-2 ${aValiderDG.length > 0 ? "text-amber-900" : "text-slate-800"}`}>💸 Versements à valider par le DG ({aValiderDG.length})</div>
          {aValiderDG.length === 0 && <div className="text-sm text-slate-400">Aucun versement en attente de votre validation (Chez le DG, BANQUE).</div>}
          <div className="space-y-1">
            {aValiderDG.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <div><b>{libelleVersementDu(d)}</b> — {fmt(d.montant)} — {d.boutique} → {libelleDestination(d.versement)}
                  <div className="text-xs text-slate-500">versé par {d.par}{libelleEcart(d.versement) ? <span className="text-red-600"> · {libelleEcart(d.versement)}</span> : null}{d.versement.note ? ` · ${d.versement.note}` : ""}</div>
                </div>
                <button onClick={() => validerDG(d)} className="text-xs font-bold text-white bg-green-700 rounded px-2 py-1 hover:bg-green-800 whitespace-nowrap">✅ Valider</button>
              </div>
            ))}
          </div>
          {validesDG.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">Derniers versements validés</div>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {validesDG.slice(0, 10).map((d) => (
                  <div key={d.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
                    {libelleVersementDu(d)} — {fmt(d.montant)} — {d.boutique} → {libelleDestination(d.versement)}{libelleEcart(d.versement) ? ` · ${libelleEcart(d.versement)}` : ""}
                    <span className="ml-2 text-xs text-green-700">✅ validé le {dFR(d.versement_valide_le)} par {d.versement_valide_par}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">💸 Verser les fonds <Badge boutique={boutique} /></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div className="bg-white rounded-lg p-3 border border-slate-200 col-span-2"><div className="text-xs text-slate-500">Fonds à verser (espèces{aVerser.depuis ? `, depuis le ${dFR(aVerser.depuis)}` : ""})</div><div className="font-bold tabular-nums text-lg">{fmt(aVerser.montant)}</div></div>
          <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Entrées</div><div className="font-bold tabular-nums text-emerald-700">{fmt(aVerser.ventes + aVerser.reglements)}</div></div>
          <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Sorties (versements compris)</div><div className="font-bold tabular-nums">− {fmt(aVerser.depenses)}</div></div>
        </div>
        {ROLES_VERSEMENT.includes(profile.role) && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Montant versé (F)"><input type="number" inputMode="numeric" className={inputCls} value={vers.montant} onChange={(e) => setVers({ ...vers, montant: e.target.value })} /></Field>
            <Field label="Destination">
              <select className={inputCls} value={vers.destination} onChange={(e) => setVers({ ...vers, destination: e.target.value })}>
                {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            {vers.destination === DEST_BANQUE && (
              <>
                <Field label="Nom de la banque"><input className={inputCls} value={vers.banque} onChange={(e) => setVers({ ...vers, banque: e.target.value })} placeholder="Ex : Ecobank" /></Field>
                <Field label="N° du bordereau de versement"><input className={inputCls} value={vers.bordereau} onChange={(e) => setVers({ ...vers, bordereau: e.target.value })} /></Field>
              </>
            )}
            {/* Timo (09/09/2026) : la Note n'apparaît que si le montant versé
                diffère du montant attendu — avec, en rouge, la raison à donner. */}
            {vers.montant !== "" && montantDifferent(vers.montant, aVerser.montant) && (
              <div className="sm:col-span-2 lg:col-span-4">
                <div className="text-sm font-bold text-red-600 mb-1">⚠ {messageJustification(aVerser.montant)}</div>
                <Field label="Note (justification)"><input className={inputCls} value={vers.note} onChange={(e) => setVers({ ...vers, note: e.target.value })} /></Field>
              </div>
            )}
            <div className="flex items-end"><button onClick={verser} className={btnDark}>💸 Verser</button></div>
          </div>
        )}
        <div className="text-xs text-slate-500 mt-2">Chez le DG et BANQUE : validés par le DG. Chez le comptable : pointés « Encaissé » par le comptable. Tant que ce n'est pas validé, le versement reste en attente.</div>
        {mesVersements.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Versements de {boutique}</div>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-3 py-1.5">Date</th><th className="text-left px-3 py-1.5">Montant</th><th className="text-left px-3 py-1.5">Destination</th><th className="text-left px-3 py-1.5">Par</th><th className="text-left px-3 py-1.5">Validation</th></tr></thead>
              <tbody>
                {mesVersements.slice(0, 30).map((d) => { const v = validationVersement(db, d); return (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="px-3 py-1.5">{dFR(d.date)}</td>
                    <td className="px-3 py-1.5 tabular-nums font-bold">{fmt(d.montant)}</td>
                    <td className="px-3 py-1.5">{libelleDestination(d.versement)}{libelleEcart(d.versement) ? <span className="text-red-600"> · {libelleEcart(d.versement)}</span> : null}{d.versement.note ? <span className="text-slate-400"> · {d.versement.note}</span> : null}</td>
                    <td className="px-3 py-1.5">{d.par}</td>
                    <td className="px-3 py-1.5">{v ? <span className="text-xs font-bold text-green-700">✅ validé le {dFR(v.le)} par {v.par}</span> : <span className="text-xs font-bold text-amber-700">⏳ en attente</span>}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
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
