// ============================================================
// screens/Caisse.jsx — Clôture de caisse du jour.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { uid, fmt, today, dFR, totalVente } from "../lib/core";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm, uPrompt, AucuneBoutique } from "../components/ui";
import { bloquerSiLecture, boutiquesVente, boutiquesVisibles, boutiqueParDefaut, estCompteFormation, boutiqueRetenue, refuserSaufRoles, refuserSaufAdminPrincipal, estAdminPrincipal, espaceDuCompte, ROLES_CAISSE } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
import { activiteDuJour, joursAClôturer, estCloturee, alerteSaisieRecette } from "../lib/cloture";
import { destinationsPour, DEST_BANQUE, DEST_COMPTABLE, DEST_DG, ROLES_VERSEMENT, construireVersement, versementsDe, fondsAVerser, validationVersement, versementsAValiderParDG, versementsValidesParDG, messagesVersement, libelleDestination, libelleVersementDu, libelleEcart, montantDifferent, messageJustification, critiqueRejet, rejeterVersement, rejetVersement } from "../lib/versements";

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
  const aujourdhui = today();
  // ⚠ Décision Timo (09/09/2026) : une journée avec des ventes et sans
  // clôture BLOQUE les ventes du lendemain (lib/cloture.js). L'écran doit
  // donc permettre de clôturer un jour PASSÉ : on choisit le jour, le plus
  // ancien jour en retard est proposé d'abord.
  const enRetard = joursAClôturer(db, boutique, aujourdhui, totalVente);
  const [jourChoisi, setJourChoisi] = useState("");
  const t = jourChoisi && (enRetard.includes(jourChoisi) || jourChoisi === aujourdhui) ? jourChoisi : (enRetard[0] || aujourdhui);
  // Les chiffres du jour : UNE règle (activiteDuJour), la même que le blocage.
  const jour = activiteDuJour(db, boutique, t, totalVente);
  const { especesVentes, especesReglements, especesDepenses, versementsDuJour, detailReglements, theorique, recetteDuJour, sortiesJustifiees, fondsHier, recetteParPersonne } = jour;
  // Le piège de la capture du 09/09/2026 (écart 1 400) : la recette saisie à la place du tiroir.
  const alerteRecette = alerteSaisieRecette(compte, jour, fmt);
  const dejaCloturee = estCloturee(db, boutique, t);
  const ecart = compte === "" ? null : Number(compte) - theorique;

  const cloturer = async () => {
    if (refuserSaufRoles(profile, ROLES_CAISSE, "Clôturer la caisse")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (compte === "") { uAlert("Comptez la caisse et saisissez le montant."); return; }
    if (!await uConfirm(`Confirmer la clôture du ${dFR(t)} ?\nAttendu dans le tiroir : ${fmt(theorique)} (fonds d'hier soir ${fmt(fondsHier)} + recette du jour ${fmt(recetteDuJour)} − sorties justifiées ${fmt(sortiesJustifiees)})\nCompté dans le tiroir : ${fmt(Number(compte))}\nÉcart de caisse : ${fmt(Number(compte) - theorique)}${alerteRecette ? "\n\n" + alerteRecette : ""}`)) return;
    save({ ...db, clotures: [{ id: uid(), date: t, boutique, theorique, compte: Number(compte), notes, par: profile.nom, cloture_le: aujourdhui }, ...db.clotures] }, `Clôture caisse ${boutique} du ${dFR(t)} : compté ${fmt(Number(compte))} (écart ${fmt(Number(compte) - theorique)})${t !== aujourdhui ? " — clôturée en retard" : ""}`);
    setCompte(""); setNotes(""); setJourChoisi("");
    uAlert(`Clôture du ${dFR(t)} enregistrée !`);
  };

  const liste = db.clotures.filter((c) => c.boutique === boutique);

  // ---- 💸 VERSEMENT DES FONDS (demande Timo, 09/09/2026) ----
  // Règle et écritures dans lib/versements.js. Vendeur, gérant, admin.
  // Chez le DG et BANQUE : validés par le DG (administrateur principal) ;
  // Chez le comptable : pointés « Encaissé » par le comptable.
  // ⚠ Cloisonnement : « Chez le comptable » (réelle, sans jumelle) n'est
  // proposée qu'en regardant le réel — jamais à un compte de formation.
  const destinations = destinationsPour(espaceDuCompte(db, profile) === true);
  // Timo (10/09/2026) : « Destination de versement reste sur DG par défaut ».
  const destinationDefaut = DEST_DG;
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
  // Timo (10/09/2026) : « si je suis dans Demakpoe, je vois les versements de
  // Demakpoe seul » — la boutique REGARDÉE, prise parmi celles de l'espace.
  const nomsDG = jeSuisDG ? boutiquesVisibles(db, profile, db.boutiques || []).map((b) => b.nom).filter((n) => n === boutique) : [];
  const aValiderDG = jeSuisDG ? versementsAValiderParDG(db, nomsDG) : [];
  const validesDG = jeSuisDG ? versementsValidesParDG(db, nomsDG) : [];
  const validerDG = async (d) => {
    if (refuserSaufAdminPrincipal(db, profile, "Valider un versement de fonds (DG)")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm(`${libelleVersementDu(d)} : valider la réception de ${fmt(d.montant)} versés par ${d.par} (${d.boutique}) → ${libelleDestination(d.versement)} ?${libelleEcart(d.versement) ? `\n\n⚠ ${libelleEcart(d.versement)}${d.versement.note ? ` — ${d.versement.note}` : ""}` : ""}`)) return;
    save({ ...db, depenses: db.depenses.map((x) => (x.id === d.id ? { ...x, versement_valide_le: today(), versement_valide_par: profile.nom } : x)) },
      `Versement de fonds VALIDÉ par le DG : ${fmt(d.montant)} de ${d.boutique} → ${libelleDestination(d.versement)}`);
  };
  // Timo (10/09/2026) : le DG peut REJETER un versement en attente, avec un
  // motif ; « l'argent doit retourner comme jamais versé » (lib/versements.js).
  const rejeterDG = async (d) => {
    if (refuserSaufAdminPrincipal(db, profile, "Rejeter un versement de fonds (DG)")) return;
    if (bloquerSiLecture(db, profile)) return;
    const motif = await uPrompt(`Rejeter ${libelleVersementDu(d).toLowerCase()} de ${fmt(d.montant)} (${d.boutique} → ${libelleDestination(d.versement)}) ?\n\nIndiquez le motif — obligatoire. L'argent sera considéré comme toujours en caisse à ${d.boutique}, et ${d.par} en sera prévenu.`, "");
    if (motif === null) return;
    const refus = critiqueRejet(db, d, motif, { estPrincipal: true, role: profile.role });
    if (refus) { uAlert(refus); return; }
    const r = rejeterVersement(db, profile, d, motif, today());
    save({ ...db, depenses: r.depenses, messages: [...r.messages, ...(db.messages || [])] }, r.journal);
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
          <div className={`font-bold mb-2 ${aValiderDG.length > 0 ? "text-amber-900" : "text-slate-800"}`}>💸 Versements à valider par le DG ({aValiderDG.length}) <Badge boutique={boutique} /></div>
          {aValiderDG.length === 0 && <div className="text-sm text-slate-400">Aucun versement en attente de votre validation (Chez le DG, BANQUE).</div>}
          <div className="space-y-1">
            {aValiderDG.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <div><b>{libelleVersementDu(d)}</b> — <b className="text-base tabular-nums">{fmt(d.montant)}</b> — {d.boutique} → {libelleDestination(d.versement)}
                  <div className="text-xs text-slate-500">versé par {d.par}{libelleEcart(d.versement) ? <span className="text-red-600"> · {libelleEcart(d.versement)}</span> : null}{d.versement.note ? ` · ${d.versement.note}` : ""}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => validerDG(d)} className="text-xs font-bold text-white bg-green-700 rounded px-2 py-1 hover:bg-green-800 whitespace-nowrap">✅ Valider</button>
                  <button onClick={() => rejeterDG(d)} className="text-xs font-bold text-white bg-red-700 rounded px-2 py-1 hover:bg-red-800 whitespace-nowrap">✖ Rejeter</button>
                </div>
              </div>
            ))}
          </div>
          {validesDG.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">Derniers versements traités</div>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {validesDG.slice(0, 10).map((d) => (
                  <div key={d.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
                    {libelleVersementDu(d)} — <b className={`text-base tabular-nums ${rejetVersement(d) ? "line-through text-red-700" : "text-slate-900"}`}>{fmt(d.versement.montant)}</b> — {d.boutique} → {libelleDestination(d.versement)}{libelleEcart(d.versement) ? ` · ${libelleEcart(d.versement)}` : ""}
                    {rejetVersement(d)
                      ? <span className="ml-2 text-xs text-red-700">✖ rejeté le {dFR(d.versement_rejete_le)} par {d.versement_rejete_par} — {d.versement_rejet_motif}</span>
                      : <span className="ml-2 text-xs text-green-700">✅ validé le {dFR(d.versement_valide_le)} par {d.versement_valide_par}</span>}
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
          <div className="bg-white rounded-lg p-3 border border-slate-200 col-span-2"><div className="text-xs text-slate-500">Fonds à verser (espèces en caisse{aVerser.dernierVersement ? ` — dernier versement le ${dFR(aVerser.dernierVersement)}` : ""})</div><div className={`font-bold tabular-nums text-lg ${aVerser.montant < 0 ? "text-red-600" : ""}`}>{fmt(aVerser.montant)}</div></div>
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
        {!ROLES_VERSEMENT.includes(profile.role) && <div className="text-sm text-slate-500">Le versement des fonds est fait par le gérant.</div>}
        <div className="text-xs text-slate-500 mt-2">Chez le DG et BANQUE : validés par le DG. Chez le comptable : pointés « Encaissé » par le comptable. Tant que ce n'est pas validé, le versement reste en attente. Un versement rejeté compte comme jamais versé : l'argent reste dans la caisse de la boutique.</div>
        {mesVersements.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white overflow-x-auto">
            {/* Timo (10/09/2026) : « je n'arrive pas à défiler de droite à gauche » — le cadre défile, le tableau garde sa largeur. */}
            <div className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Versements de {boutique}</div>
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-3 py-1.5">Date</th><th className="text-left px-3 py-1.5">Montant</th><th className="text-left px-3 py-1.5">Destination</th><th className="text-left px-3 py-1.5">Par</th><th className="text-left px-3 py-1.5">Validation</th></tr></thead>
              <tbody>
                {mesVersements.slice(0, 30).map((d) => { const v = validationVersement(db, d); const rj = rejetVersement(d); return (
                  <tr key={d.id} className={`border-t border-slate-100${rj ? " bg-red-50 text-red-800" : ""}`}>
                    <td className="px-3 py-1.5">{dFR(d.date)}</td>
                    <td className={`px-3 py-1.5 tabular-nums font-bold${rj ? " line-through" : ""}`}>{fmt(d.versement.montant)}</td>
                    <td className="px-3 py-1.5">{libelleDestination(d.versement)}{libelleEcart(d.versement) ? <span className="text-red-600"> · {libelleEcart(d.versement)}</span> : null}{d.versement.note ? <span className="text-slate-400"> · {d.versement.note}</span> : null}</td>
                    <td className="px-3 py-1.5">{d.par}</td>
                    <td className="px-3 py-1.5">{rj ? <span className="text-xs font-bold text-red-700">✖ rejeté le {dFR(rj.le)} par {rj.par} — {rj.motif}</span> : v ? <span className="text-xs font-bold text-green-700">✅ validé le {dFR(v.le)} par {v.par}</span> : <span className="text-xs font-bold text-amber-700">⏳ en attente</span>}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">Clôture de caisse {t === aujourdhui ? "du jour" : `du ${dFR(t)}`} <Badge boutique={boutique} /></div>
        {enRetard.length > 0 && (
          <div className="mb-3 rounded-lg border-2 border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <div className="font-bold">🔒 {enRetard.length === 1 ? "Une journée" : `${enRetard.length} journées`} sans clôture : {enRetard.map(dFR).join(", ")}</div>
            <div className="text-xs mt-1">Les ventes de {boutique} sont bloquées tant que ces journées ne sont pas clôturées. Choisissez le jour, comptez, clôturez.</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {[...enRetard, aujourdhui].map((j) => (
                <button key={j} onClick={() => { setJourChoisi(j); setCompte(""); }}
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${t === j ? "bg-red-700 text-white border-red-700" : "bg-white text-red-800 border-red-300 hover:bg-red-100"}`}>
                  {j === aujourdhui ? "Aujourd'hui" : dFR(j)}
                </button>
              ))}
            </div>
          </div>
        )}
        {dejaCloturee ? (
          <div className="text-sm font-semibold text-green-700">✓ La caisse du {dFR(t)} a déjà été clôturée.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
              {/* Timo (09/09/2026) : « clôture de caisse, c'est journalier : recette du jour
                  théorique contre montant du tiroir ». La journée se lit de gauche à droite :
                  fonds d'hier soir + recette du jour − sorties justifiées = attendu dans le tiroir.
                  Les dépenses et les versements sont déjà déduits : ils ne créent JAMAIS d'écart. */}
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Fonds de caisse d'hier soir</div><div className={`font-bold tabular-nums ${fondsHier < 0 ? "text-red-600" : ""}`}>{fmt(fondsHier)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Recette du jour (espèces)</div><div className="font-bold tabular-nums text-emerald-700">+ {fmt(recetteDuJour)}</div><div className="text-[11px] text-slate-400">ventes {fmt(especesVentes)} · encaissements {fmt(especesReglements)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Sorties justifiées du jour</div><div className="font-bold tabular-nums">− {fmt(sortiesJustifiees)}</div><div className="text-[11px] text-slate-400">dépenses {fmt(especesDepenses)} · versements {fmt(versementsDuJour)} — ne créent pas d'écart</div></div>
              <div className="bg-white rounded-lg p-3 border-2 border-slate-300"><div className="text-xs text-slate-500">Montant attendu dans le tiroir</div><div className={`font-bold tabular-nums ${theorique < 0 ? "text-red-600" : ""}`}>{fmt(theorique)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="text-xs text-slate-500">Écart de caisse (manque ou surplus)</div>
                <div className={`font-bold tabular-nums ${ecart === null ? "text-slate-400" : ecart === 0 ? "text-green-700" : "text-red-600"}`}>{ecart === null ? "—" : fmt(ecart)}</div>
              </div>
            </div>
            {/* Timo (11/09/2026) : « 2 est bon pour le moment » — UNE caisse, UNE
                clôture, et la recette du jour lue par personne (admin, gérant ou
                vendeur : la même caisse). Règle pure : activiteDuJour.recetteParPersonne. */}
            {recetteParPersonne.length > 0 && (
              <div className="mb-3 rounded-lg border border-slate-200 bg-white overflow-x-auto">
                <div className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Recette du {dFR(t)} par vendeur — admin, gérant ou vendeur : la même caisse</div>
                <table className="w-full text-sm min-w-[520px]">
                  <thead><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-3 py-1.5">Vendeur</th><th className="text-left px-3 py-1.5">Ventes</th><th className="text-left px-3 py-1.5">Espèces encaissées</th><th className="text-left px-3 py-1.5">Autres moyens</th></tr></thead>
                  <tbody>
                    {recetteParPersonne.map((r) => (
                      <tr key={r.nom} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-semibold">{r.nom}</td>
                        <td className="px-3 py-1.5 tabular-nums">{r.nbVentes}</td>
                        <td className="px-3 py-1.5 tabular-nums font-bold">{fmt(r.especes)}{r.encaissements > 0 ? <span className="text-xs text-slate-400 font-normal"> (dont dettes {fmt(r.encaissements)})</span> : null}</td>
                        <td className="px-3 py-1.5 tabular-nums text-slate-500">{r.autresMoyens > 0 ? fmt(r.autresMoyens) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {detailReglements.length > 0 && (
              <div className="mb-3 rounded-lg border border-slate-200 bg-white overflow-x-auto">
                <div className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Détail des encaissements du {dFR(t)} — qui a payé quoi</div>
                <table className="w-full text-sm min-w-[560px]">
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
              <Field label="Montant du tiroir (tout ce qu'il contient, compté)"><input type="number" className={inputCls} value={compte} onChange={(e) => setCompte(e.target.value)} /></Field>
              <div className="lg:col-span-2"><Field label="Remarques"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : Monnaie rendue..." /></Field></div>
            </div>
            {alerteRecette && <div className="mt-2 text-sm font-bold text-red-600">{alerteRecette}</div>}
            <button onClick={cloturer} className={`mt-3 ${btnDark}`}>Clôturer la caisse</button>
          </>
        )}
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Historique des clôtures — {boutique}</div>
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Attendu dans le tiroir", "Compté", "Écart", "Remarques", "Par"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
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
