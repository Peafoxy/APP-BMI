// ============================================================
// screens/Depenses.jsx — Dépenses par boutique, et Chez le comptable
// (sorties de caisse confiées au comptable plutôt qu'à une boutique).
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { fmt, today, dFR } from "../lib/core";
import { critiqueRejet, rejeterVersement, estRejete, estVersement } from "../lib/versements";
import { CATEGORIES, PAIEMENTS, horsVersements, depensesComptees } from "../lib/constants";
// Timo (12/09/2026) : validation des dépenses par le DG à partir de 5 000 F,
// origine des fonds, avances de frais — règle pure dans lib/validationDepenses.js.
import { PAYE_AVEC, PAYE_AVEC_CAISSE, SEUIL_VALIDATION_DEPENSE, doitEtreValidee, construireDepenseSaisie, depensesAValider, depensesTraitees, nbAValiderParBoutique, critiqueDecision, validerDepense, rejeterDepense, estEnAttente, estValidee, estRejetee, montantOrigine, libellePayeAvec } from "../lib/validationDepenses";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm, uPrompt, usePagination, Pagination, AucuneBoutique } from "../components/ui";
import { bloquerSiLecture, annulerLiensDepense, refusSuppressionDepense, aLienAAnnuler, boutiquesVente, boutiquesVisibles, boutiqueParDefaut, estCompteFormation, boutiqueRetenue, refuserSaufAdmin, estAdminPrincipal, refuserSaufAdminPrincipal } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";

// ============ LE TABLEAU DES DÉPENSES — écrit UNE fois (point B5 du relevé
// des doublons, 08/09/2026) pour les dépenses d'une boutique et pour
// « Chez le comptable » : une colonne ajoutée l'est aux deux.
// L'état de validation d'une dépense, en un badge (Timo, 12/09/2026).
export function BadgeValidation({ x }) {
  if (estEnAttente(x)) return <span className="text-xs font-bold text-amber-700">⏳ à valider par le DG</span>;
  if (estRejetee(x)) return <span className="text-xs font-bold text-red-700">✖ rejetée le {dFR(x.validation.le)} par {x.validation.par} — {x.validation.motif}</span>;
  if (estValidee(x)) return <span className="text-xs font-bold text-green-700">✅ validée le {dFR(x.validation.le)}{x.validation.auto ? " (DG)" : ` par ${x.validation.par}`}</span>;
  return <span className="text-xs text-slate-400">—</span>;
}
function TableauDepenses({ liste, listePage, profile, onSupprimer, vide }) {
  return (
    <table className="w-full text-sm min-w-[860px]">
      <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Catégorie", "Description", "Montant", "Paiement", "Payé avec", "Saisi par", "Validation", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
      <tbody>
        {liste.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">{vide}</td></tr>}
        {listePage.map((x) => (
          <tr key={x.id} className={`border-t border-slate-100 hover:bg-sky-50${estRejetee(x) ? " bg-red-50 text-red-800" : estEnAttente(x) ? " bg-amber-50" : ""}`}>
            <td className="px-3 py-2">{dFR(x.date)}</td>
            <td className="px-3 py-2 font-semibold">{x.categorie}</td>
            <td className="px-3 py-2">{x.description || "—"}</td>
            <td className={`px-3 py-2 tabular-nums font-bold${estRejetee(x) ? " line-through" : ""}`}>{fmt(montantOrigine(x))}</td>
            <td className="px-3 py-2">{x.paiement}</td>
            <td className="px-3 py-2 text-xs">{x.paye_avec && x.paye_avec !== PAYE_AVEC_CAISSE ? libellePayeAvec(x.paye_avec) : "Caisse"}{x.remboursement ? <div className="text-green-700">remboursée le {dFR(x.remboursement.le)}</div> : null}</td>
            <td className="px-3 py-2">{x.par}</td>
            <td className="px-3 py-2"><BadgeValidation x={x} /></td>
            <td className="px-3 py-2">
              {profile.role === "admin" && (
                <button onClick={() => onSupprimer(x)} className="text-xs text-red-600 underline">Suppr.</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============ DÉPENSES ============
export function Depenses({ db, save, profile }) {
  const premiere = boutiqueParDefaut(db, profile, { ecran: "depenses" });
  const [bq, setBq] = useState(profile.boutique || premiere);
  // ⚠ Voir boutiqueRetenue (lib/calculs.js) : la valeur mémorisée peut être
  // vide (écran ouvert pendant la synchronisation d'ouverture) ou désigner
  // une boutique qui n'existe plus (supprimée, ou effacée par une
  // réinitialisation). Dans les deux cas, on repart de la boutique par
  // défaut plutôt que d'afficher un écran figé ou un nom fantôme.
  const boutique = boutiqueRetenue(db, profile, bq, { ecran: "depenses" });
  const formVide = { categorie: CATEGORIES[0], description: "", montant: "", paiement: PAIEMENTS[0], paye_avec: PAYE_AVEC_CAISSE };
  const [f, setF] = useState(formVide);
  const jeSuisDG = estAdminPrincipal(db, profile);

  // Timo (12/09/2026) : à partir de 5 000 F, la dépense attend la validation
  // du DG et ne compte nulle part avant ; l'origine des fonds est demandée.
  const ajouter = async () => {
    if (bloquerSiLecture(db, profile)) return;
    const r = construireDepenseSaisie(db, profile, { boutique, ...f }, today());
    if (r.refus) { uAlert(r.refus); return; }
    const suite = r.aValider && !jeSuisDG ? `\n\n⏳ ${fmt(Number(f.montant))} atteint ${fmt(SEUIL_VALIDATION_DEPENSE)} : cette dépense sera soumise à la validation du DG et ne comptera qu'une fois validée.` : "";
    if (!await uConfirm(`Confirmer la dépense de ${fmt(Number(f.montant))} en ${f.categorie}, payée avec : ${libellePayeAvec(f.paye_avec).toLowerCase()} ?${suite}`)) return;
    save({ ...db, depenses: [r.depense, ...db.depenses], messages: [...r.messages, ...(db.messages || [])] }, r.journal);
    setF(formVide);
    if (r.aValider && !jeSuisDG) uAlert("Dépense enregistrée — en attente de validation par le DG.");
  };

  // ---- LA FILE DU DG (administrateur principal), sur la boutique regardée ----
  const nomsEspace = jeSuisDG ? boutiquesVisibles(db, profile, db.boutiques || []).map((b) => b.nom) : [];
  const aValiderDG = jeSuisDG ? depensesAValider(db, nomsEspace.filter((n) => n === boutique)) : [];
  const traiteesDG = jeSuisDG ? depensesTraitees(db, nomsEspace.filter((n) => n === boutique)) : [];
  const ailleursDG = jeSuisDG ? nbAValiderParBoutique(db, nomsEspace.filter((n) => n !== boutique)) : [];
  const validerDG = async (d) => {
    if (refuserSaufAdminPrincipal(db, profile, "Valider une dépense (DG)")) return;
    if (bloquerSiLecture(db, profile)) return;
    const refus = critiqueDecision(d, { estPrincipal: true });
    if (refus) { uAlert(refus); return; }
    if (!await uConfirm(`Valider la dépense de ${fmt(d.montant)} (${d.categorie}${d.description ? ` — ${d.description}` : ""}) du ${dFR(d.date)}, saisie par ${d.par}, payée avec : ${libellePayeAvec(d.paye_avec).toLowerCase()} ?`)) return;
    const r = validerDepense(db, profile, d, today());
    save({ ...db, depenses: r.depenses, messages: [...r.messages, ...(db.messages || [])] }, r.journal);
  };
  const rejeterDG = async (d) => {
    if (refuserSaufAdminPrincipal(db, profile, "Rejeter une dépense (DG)")) return;
    if (bloquerSiLecture(db, profile)) return;
    const motif = await uPrompt(`Rejeter la dépense de ${fmt(d.montant)} (${d.categorie}${d.description ? ` — ${d.description}` : ""}) saisie par ${d.par} ?\n\nIndiquez le motif — obligatoire. ${d.paiement === "Espèces" && (!d.paye_avec || d.paye_avec === PAYE_AVEC_CAISSE) ? `L'argent sera considéré comme toujours dû à la caisse de ${d.boutique}, et ${d.par} en sera prévenu.` : `${d.par} en sera prévenu.`}`, "");
    if (motif === null) return;
    const refus = critiqueDecision(d, { estPrincipal: true }, motif);
    if (refus) { uAlert(refus); return; }
    const r = rejeterDepense(db, profile, d, motif, today());
    save({ ...db, depenses: r.depenses, messages: [...r.messages, ...(db.messages || [])] }, r.journal);
  };

  const supprimerDepense = async (d) => {
    if (refuserSaufAdmin(profile, "Supprimer une dépense")) return;
    if (bloquerSiLecture(db, profile)) return;
    // ⚠ Certaines dépenses ont une porte de sortie DÉDIÉE, qui vérifie des
    // choses que celle-ci ne vérifie pas. On y renvoie au lieu de laisser
    // faire un geste incomplet.
    const refus = refusSuppressionDepense(db, d);
    if (refus) { uAlert(refus); return; }
    // L'avertissement ne s'affiche que lorsqu'il est VRAI (voir aLienAAnnuler).
    const avertissement = aLienAAnnuler(d) ? "\n\n⚠ Cette dépense a été générée automatiquement par un paiement : le statut « payé » correspondant sera aussi annulé (à repayer si besoin)." : "";
    if (await uConfirm(`Supprimer la dépense de ${fmt(d.montant)} (${d.categorie}) du ${dFR(d.date)} ?${avertissement}`)) {
      save({ ...db, ...annulerLiensDepense(db, d), depenses: db.depenses.filter((x) => x.id !== d.id) }, `Suppression dépense ${fmt(d.montant)} (${d.categorie}) — ${d.boutique}`);
    }
  };

  // ⚠ Timo (11/09/2026) : « pourquoi jusqu'à lors les versements sont
  // considérés comme dépense ? ». Sa règle du 10/09 était claire — « un
  // versement n'est JAMAIS une dépense » — et le tableau de bord, les exports
  // et le journal l'appliquaient déjà. Cet écran-ci avait été oublié : la
  // liste ET le total du mois comptaient encore les versements de fonds (et
  // les remboursements de reprise). Un versement n'est pas une charge : c'est
  // de l'argent qui change de poche. Il se lit dans 🔒 Caisse et dans l'export
  // « Versements ».
  const liste = horsVersements(db.depenses).filter((x) => x.boutique === boutique);
  // « Ce mois » ne compte que ce qui compte : validé, ou sans validation requise.
  const totalMois = depensesComptees(liste).filter((x) => String(x.date).slice(0, 7) === today().slice(0, 7)).reduce((s, x) => s + Number(x.montant), 0);
  const enAttenteIci = liste.filter(estEnAttente).reduce((s, x) => s + Number(x.montant), 0);
  const { pageItems: listePage, page, setPage, totalPages } = usePagination(liste, 50);

  // ⚠ Cloisonnement : aucune boutique de l'espace du compte connecté —
  // on n'affiche PAS le formulaire, plutôt que de le laisser écrire dans la
  // boutique de repli (voir boutiqueParDefaut dans lib/calculs.js).
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;
  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs ecran="depenses" db={db} value={bq} onChange={setBq} profile={profile} />}
      {/* Timo (12/09/2026) : le DG valide les dépenses de 5 000 F et plus —
          l'encadré est PERMANENT (vide, il le dit), sur la boutique regardée
          seule, et dit où il en reste ailleurs sans les mélanger. */}
      {jeSuisDG && (
        <div className={`bg-white rounded-xl border-2 shadow-sm p-4 ${aValiderDG.length > 0 ? "border-amber-300" : "border-slate-200"}`}>
          <div className={`font-bold mb-2 ${aValiderDG.length > 0 ? "text-amber-900" : "text-slate-800"}`}>⏳ Dépenses à valider par le DG ({aValiderDG.length}) <Badge boutique={boutique} /></div>
          {aValiderDG.length === 0 && <div className="text-sm text-slate-400">Aucune dépense de {boutique} en attente de votre validation (à partir de {fmt(SEUIL_VALIDATION_DEPENSE)}).</div>}
          <div className="space-y-1">
            {aValiderDG.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <div><b>{dFR(d.date)}</b> — <b className="text-base tabular-nums">{fmt(d.montant)}</b> — {d.categorie}{d.description ? ` — ${d.description}` : ""}
                  <div className="text-xs text-slate-500">saisie par {d.par} · {d.paiement} · payée avec : {libellePayeAvec(d.paye_avec).toLowerCase()}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => validerDG(d)} className="text-xs font-bold text-white bg-green-700 rounded px-2 py-1 hover:bg-green-800 whitespace-nowrap">✅ Valider</button>
                  <button onClick={() => rejeterDG(d)} className="text-xs font-bold text-white bg-red-700 rounded px-2 py-1 hover:bg-red-800 whitespace-nowrap">✖ Rejeter</button>
                </div>
              </div>
            ))}
          </div>
          {ailleursDG.length > 0 && <div className="mt-2 text-xs text-amber-800">Ailleurs, en attente : {ailleursDG.map((x) => `${x.boutique} (${x.n})`).join(", ")} — choisissez la boutique en haut.</div>}
          {traiteesDG.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">Dernières dépenses tranchées</div>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {traiteesDG.slice(0, 10).map((d) => (
                  <div key={d.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
                    {dFR(d.date)} — <b className={`text-base tabular-nums ${estRejetee(d) ? "line-through text-red-700" : "text-slate-900"}`}>{fmt(montantOrigine(d))}</b> — {d.categorie} · {d.par} <BadgeValidation x={d} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">Nouvelle dépense <Badge boutique={boutique} /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Catégorie"><select className={inputCls} value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Description"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Montant (F)"><input type="number" className={inputCls} value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} /></Field>
          <Field label="Paiement"><select className={inputCls} value={f.paiement} onChange={(e) => setF({ ...f, paiement: e.target.value })}>{PAIEMENTS.map((p) => <option key={p}>{p}</option>)}</select></Field>
          {/* L'origine des fonds (Timo, 12/09/2026) : « les trois propositions sont bonnes ». */}
          <Field label="Payé avec"><select className={inputCls} value={f.paye_avec} onChange={(e) => setF({ ...f, paye_avec: e.target.value })}>{PAYE_AVEC.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select></Field>
        </div>
        {f.montant !== "" && doitEtreValidee(f.montant) && !jeSuisDG && (
          <div className="mt-2 text-sm font-bold text-amber-700">⏳ À partir de {fmt(SEUIL_VALIDATION_DEPENSE)}, la dépense est soumise à la validation du DG : elle ne comptera (caisse, tableau de bord) qu'une fois validée.</div>
        )}
        {f.paye_avec === "avance" && <div className="mt-2 text-xs text-slate-500">Une avance personnelle ne sort pas du tiroir : elle vous sera remboursée (caisse, salaire ou DG) une fois qu'elle compte.</div>}
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer la dépense</button>
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-1">
          <span>Dépenses — {boutique}</span>
          <span className="text-sm font-semibold text-slate-500">Ce mois : {fmt(totalMois)}{enAttenteIci > 0 ? <span className="text-amber-700"> · en attente de validation (non comptées) : {fmt(enAttenteIci)}</span> : null}</span>
        </div>
        <TableauDepenses liste={liste} listePage={listePage} profile={profile} onSupprimer={supprimerDepense} vide="Aucune dépense enregistrée." />
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
        {/* On ne cache pas l'argent : on dit où il est allé. */}
        <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">
          Les <b>versements de fonds</b> et les <b>remboursements de reprise</b> ne sont pas des dépenses : ils ne comptent pas ici.
          Retrouvez-les dans <b>🔒 Caisse</b> et dans l'export « Versements » du tableau de bord.
        </div>
      </div>
    </div>
  );
}

// ============ CHEZ LE COMPTABLE ============
// Regroupe toutes les sorties de caisse qui n'ont pas été débitées d'une
// boutique mais confiées au comptable (commissions, salaires, etc. payés
// « Chez le comptable ») — sinon ces dépenses étaient invisibles nulle part.
export function ChezComptable({ db, save, profile }) {
  const liste = (db.depenses || []).filter((x) => x.boutique === "Chez le comptable")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const { pageItems: listePage, page: pageCC, setPage: setPageCC, totalPages: totalPagesCC } = usePagination(liste, 50);

  // ---- POINTAGE DES DÉCAISSEMENTS : le comptable marque ce qu'il a
  // réellement remis (billets donnés / virement fait), pour ne plus se
  // mélanger entre le déjà-payé et le pas-encore-payé. C'est la SEULE
  // écriture autorisée à son compte (porte pointageComptable de save).
  const estComptable = profile.role === "comptable";
  // Un versement rejeté (Timo, 10/09/2026) ne se pointe plus : il sort de la file.
  const aRemettre = liste.filter((x) => !x.decaisse_le && !estRejete(x));
  const dejaRemis = liste.filter((x) => x.decaisse_le);
  // Timo (10/09/2026) : le comptable peut REJETER un versement « Chez le
  // comptable » en attente, avec un motif ; l'argent redevient « jamais
  // versé » (la sortie de la boutique et l'entrée miroir passent à 0 F).
  // Règle et écritures dans lib/versements.js ; serveur : securite-12.
  const sortieDe = (entree) => (db.depenses || []).find((d) => estVersement(d) && d.versement.id === entree.versement_id);
  const rejeterVersementComptable = async (entree) => {
    const sortie = sortieDe(entree);
    if (!sortie) { uAlert("Le versement d'origine est introuvable."); return; }
    const motif = await uPrompt(`Rejeter le versement de ${fmt(Math.abs(entree.montant))} reçu de ${sortie.boutique} (par ${sortie.par}) ?\n\nIndiquez le motif — obligatoire. L'argent sera considéré comme toujours en caisse à ${sortie.boutique}, et ${sortie.par} en sera prévenu.`, "");
    if (motif === null) return;
    const refus = critiqueRejet(db, sortie, motif, { estPrincipal: false, role: profile.role });
    if (refus) { uAlert(refus); return; }
    const r = rejeterVersement(db, profile, sortie, motif, today());
    save({ ...db, depenses: r.depenses, messages: [...r.messages, ...(db.messages || [])] }, r.journal, { rejetVersement: true });
  };
  const marquerRemis = async (dep) => {
    if (!await uConfirm(`Marquer ${dep.montant < 0 ? "l'encaissement" : "la remise"} comme faite ?\n\n${dep.description || dep.categorie} — ${fmt(Math.abs(dep.montant))}\n\nCela confirme que l'argent a réellement ${dep.montant < 0 ? "été encaissé" : "été remis au bénéficiaire"}.`)) return;
    save({ ...db, depenses: db.depenses.map((x) => (x.id === dep.id ? { ...x, decaisse_le: today(), decaisse_par: profile.nom } : x)) },
      `Décaissement pointé « remis » par ${profile.nom} : ${fmt(Math.abs(dep.montant))} — ${dep.description || dep.categorie}`,
      { pointageComptable: true });
  };
  const annulerRemis = async (dep) => {
    if (refuserSaufAdmin(profile, "Annuler un pointage du comptable")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm(`Annuler le pointage « remis » de ${fmt(Math.abs(dep.montant))} (${dep.description || dep.categorie}) ?`)) return;
    save({ ...db, depenses: db.depenses.map((x) => (x.id === dep.id ? { ...x, decaisse_le: null, decaisse_par: null } : x)) },
      `Pointage de décaissement ANNULÉ par ${profile.nom} : ${fmt(Math.abs(dep.montant))} — ${dep.description || dep.categorie}`);
  };
  const totalMois = liste.filter((x) => String(x.date).slice(0, 7) === today().slice(0, 7)).reduce((s, x) => s + Number(x.montant), 0);
  const total = liste.reduce((s, x) => s + Number(x.montant), 0);

  const supprimerDepense = async (d) => {
    if (refuserSaufAdmin(profile, "Supprimer une dépense")) return;
    if (bloquerSiLecture(db, profile)) return;
    // ⚠ Certaines dépenses ont une porte de sortie DÉDIÉE, qui vérifie des
    // choses que celle-ci ne vérifie pas. On y renvoie au lieu de laisser
    // faire un geste incomplet.
    const refus = refusSuppressionDepense(db, d);
    if (refus) { uAlert(refus); return; }
    // L'avertissement ne s'affiche que lorsqu'il est VRAI (voir aLienAAnnuler).
    const avertissement = aLienAAnnuler(d) ? "\n\n⚠ Cette dépense a été générée automatiquement par un paiement : le statut « payé » correspondant sera aussi annulé (à repayer si besoin)." : "";
    if (await uConfirm(`Supprimer la dépense de ${fmt(d.montant)} (${d.categorie}) du ${dFR(d.date)} ?${avertissement}`)) {
      save({ ...db, ...annulerLiensDepense(db, d), depenses: db.depenses.filter((x) => x.id !== d.id) }, `Suppression dépense ${fmt(d.montant)} (${d.categorie}) — Chez le comptable`);
    }
  };

  return (
    <div className="space-y-4">
      {/* ═══ Décaissements : à remettre / remis ═══ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="font-bold text-slate-800 mb-2">💰 Décaissements de ma caisse
          <span className="ml-2 text-xs font-semibold text-red-600">à remettre : {aRemettre.length}</span>
          <span className="ml-2 text-xs font-semibold text-green-700">remis : {dejaRemis.length}</span>
        </div>
        {aRemettre.length === 0 && <div className="text-sm text-slate-400">Rien en attente : tout ce qui est passé par la caisse « Chez le comptable » a été remis.</div>}
        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {aRemettre.map((x) => (
            <div key={x.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
              <div>
                <b>{fmt(Math.abs(x.montant))}</b> — {x.description || x.categorie}
                <div className="text-xs text-slate-500">{dFR(x.date)} · enregistré par {x.par}{x.montant < 0 ? " · 💵 entrée de caisse" : ""}</div>
              </div>
              {estComptable && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => marquerRemis(x)} className="text-xs font-bold text-white bg-green-700 rounded px-2 py-1 hover:bg-green-800 whitespace-nowrap">✅ {x.montant < 0 ? "Encaissé" : "Remis"}</button>
                  {x.versement_id && <button onClick={() => rejeterVersementComptable(x)} className="text-xs font-bold text-white bg-red-700 rounded px-2 py-1 hover:bg-red-800 whitespace-nowrap">✖ Rejeter</button>}
                </div>
              )}
            </div>
          ))}
        </div>
        {dejaRemis.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-bold text-slate-500 uppercase mb-1">Déjà remis</div>
            <div className="max-h-[220px] overflow-y-auto space-y-1">
              {dejaRemis.map((x) => (
                <div key={x.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
                  <div>
                    {fmt(Math.abs(x.montant))} — {x.description || x.categorie}
                    <span className="ml-2 text-xs text-green-700">✅ remis le {dFR(x.decaisse_le)} par {x.decaisse_par}</span>
                  </div>
                  {profile.role === "admin" && <button onClick={() => annulerRemis(x)} className="text-xs text-red-600 underline whitespace-nowrap">annuler</button>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="font-bold text-slate-800 mb-1">🧾 Sorties de caisse confiées au comptable</div>
        <div className="text-xs text-slate-500">Commissions, salaires ou autres sorties payées « Chez le comptable » plutôt que débitées d'une boutique.</div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-1">
          <span>Chez le comptable</span>
          <span className="text-sm font-semibold text-slate-500">Ce mois : {fmt(totalMois)} · Total : {fmt(total)}</span>
        </div>
        <TableauDepenses liste={liste} listePage={listePage} profile={profile} onSupprimer={supprimerDepense} vide="Aucune sortie de caisse « Chez le comptable » pour l'instant." />
        <Pagination page={pageCC} setPage={setPageCC} totalPages={totalPagesCC} />
      </div>
    </div>
  );
}

