// ============================================================
// screens/Depenses.jsx — Dépenses par boutique, et Chez le comptable
// (sorties de caisse confiées au comptable plutôt qu'à une boutique).
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { fmt, today, dFR, totalVente } from "../lib/core";
import { critiqueRejet, rejeterVersement, estRejete, estVersement, critiqueSortieTiroir, fondsAVerser } from "../lib/versements";
import { CATEGORIES, PAIEMENTS, horsVersements, depensesComptees } from "../lib/constants";
// Timo (12/09/2026) : validation des dépenses par le DG à partir de 5 000 F,
// origine des fonds, avances de frais — règle pure dans lib/validationDepenses.js.
import { PAYE_AVEC_CAISSE, SEUIL_VALIDATION_DEPENSE, doitEtreValidee, construireDepenseSaisie, depensesAValider, depensesTraitees, nbAValiderParBoutique, critiqueDecision, validerDepense, rejeterDepense, estEnAttente, estValidee, estRejetee, montantOrigine, libellePayeAvec, critiqueModifDepense, modifierDepense, depenseModifiable, neVoitQueSesDepenses, depensesVisibles, optionsPayeAvec, interpreterPayeAvec, libelleChoixPayeAvec, payeeParLeComptable, fondsProposable, PAYE_AVEC_FONDS, ROLES_FONDS_CAISSE } from "../lib/validationDepenses";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm, uPrompt, uChoix, AucuneBoutique, enTeteFige, celluleFigee } from "../components/ui";
// Timo (13/09/2026) : « appliquer la règle d'archivage aussi à l'historique des
// dépenses » — LE composant commun (10 lignes, puis défilement ; archives
// après 3 mois au-delà des 20 plus récentes). Plus de pagination ici.
import { HistoriqueArchive } from "../components/HistoriqueArchive";
import { ficheLoyer, etatLoyer, critiquePaiementLoyer, formulaireLoyer, libelleMois, libellePeriodeLoyer, moisAPayer, moisDeLaDepense, CATEGORIE_LOYER } from "../lib/loyer";
import { refuserSaufRoles, bloquerSiLecture, annulerLiensDepense, refusSuppressionDepense, aLienAAnnuler, boutiquesVente, boutiquesVisibles, boutiqueParDefaut, estCompteFormation, boutiqueRetenue, refuserSaufAdmin, estAdminPrincipal, refuserSaufAdminPrincipal, afficheChiffresFormation } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
// Timo (13/09/2026) : rattacher une petite dépense (carburant, nourriture) à
// un chantier de devis ; elle sera déduite des frais d'installation avant le
// partage entre techniciens — règle pure dans lib/depensesChantier.js.
import { chantiersRattachables, libelleChantier, critiqueRattachement, rattacherDepense } from "../lib/depensesChantier";

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
function TableauDepenses({ liste, profile, onSupprimer, onModifier, vide }) {
  return (
    <HistoriqueArchive lignes={liste} dateDe={(x) => x.date} aujourdhui={today()} vide={vide} titreArchives="Dépenses archivées" classeTable="w-full text-sm min-w-[860px]"
      entete={<thead className="sticky top-0 bg-white"><tr className="text-xs text-slate-500 uppercase">{["Date", "Catégorie", "Description", "Montant", "Paiement", "Payé avec", "Saisi par", "Validation", "Chantier", ""].map((h, i) => <th key={h} className={`text-left px-3 py-2${i === 0 ? ` ${enTeteFige("bg-white")}` : ""}`}>{h}</th>)}</tr></thead>}
      rendre={(x) => (
        <tr key={x.id} className={`border-t border-slate-100 hover:bg-sky-50${estRejetee(x) ? " bg-red-50 text-red-800" : estEnAttente(x) ? " bg-amber-50" : ""}`}>
          {/* Timo (13/09/2026) : la première colonne reste figée (Stocks, Dépenses, Dettes — ordinateur aussi). */}
          <td className={`px-3 py-2 whitespace-nowrap ${celluleFigee(estRejetee(x) ? "bg-red-50" : estEnAttente(x) ? "bg-amber-50" : "bg-white")}`}>{dFR(x.date)}</td>
          <td className="px-3 py-2 font-semibold">{x.categorie}</td>
          <td className="px-3 py-2">{x.description || "—"}</td>
          <td className={`px-3 py-2 tabular-nums font-bold${estRejetee(x) ? " line-through" : ""}`}>{fmt(montantOrigine(x))}</td>
          <td className="px-3 py-2">{x.paiement}</td>
          <td className="px-3 py-2 text-xs">{x.paye_avec && x.paye_avec !== PAYE_AVEC_CAISSE ? libellePayeAvec(x.paye_avec) : "Caisse"}{x.remboursement ? <div className="text-green-700">remboursée le {dFR(x.remboursement.le)}</div> : null}</td>
          <td className="px-3 py-2">{x.par}</td>
          <td className="px-3 py-2"><BadgeValidation x={x} /></td>
          <td className="px-3 py-2 text-xs">
            {x.chantier_id ? <span className="font-semibold text-purple-800">🏠 {x.chantier_nom || "chantier"}</span> : <span className="text-slate-300">—</span>}
          </td>
          <td className="px-3 py-2">
            {onModifier && depenseModifiable(x) && (
              <button onClick={() => onModifier(x)} className="text-xs font-bold text-sky-800 underline mr-2" data-modifier-depense>✏️ Modifier</button>
            )}
            {profile.role === "admin" && (
              <button onClick={() => onSupprimer(x)} className="text-xs text-red-600 underline">Suppr.</button>
            )}
            {x.modifie_le && <div className="text-[11px] text-slate-400">modifiée le {dFR(x.modifie_le)} par {x.modifie_par}</div>}
          </td>
        </tr>
      )} />
  );
}

// ============ DÉPENSES ============
// ✏️ Modifier une dépense (Timo, 25/09/2026) : catégorie et description,
// l'administrateur PRINCIPAL seul, revérifié DANS le geste. Écrit UNE fois
// pour les deux listes : 📤 Dépenses et 🧾 Chez le comptable (« a » : les
// lignes automatiques — salaires, commissions, CNSS… — ne se modifient pas).
function useModifDepense(db, save, profile) {
  const [modif, setModif] = useState(null);
  const ouvrirModif = (d) => {
    if (refuserSaufAdminPrincipal(db, profile, "Modifier une dépense")) return;
    setModif({ d, categorie: d.categorie, description: d.description || "" });
  };
  const enregistrerModif = () => {
    if (refuserSaufAdminPrincipal(db, profile, "Modifier une dépense")) return;
    if (bloquerSiLecture(db, profile)) return;
    const fraiche = (db.depenses || []).find((x) => x.id === modif.d.id);
    const refus = critiqueModifDepense(fraiche, modif);
    if (refus) { uAlert(refus); return; }
    const r = modifierDepense(fraiche, modif, profile.nom, today());
    save({ ...db, depenses: db.depenses.map((x) => (x.id === fraiche.id ? r.depense : x)) }, r.journal);
    setModif(null);
  };
  const panneauModif = (
    <>
        {modif && (
          <div className="rounded-lg border-2 border-sky-300 bg-sky-50 p-3 mb-3" data-fiche-modif-depense>
            <div className="font-bold text-sm mb-2">✏️ Modifier la dépense du {dFR(modif.d.date)} — {fmt(modif.d.montant)} ({modif.d.par})</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Catégorie"><select className={inputCls} value={modif.categorie} onChange={(e) => setModif({ ...modif, categorie: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Description"><input className={inputCls} value={modif.description} onChange={(e) => setModif({ ...modif, description: e.target.value })} /></Field>
            </div>
            <div className="text-xs text-slate-500 mt-2">Le montant, le paiement et « Payé avec » ne se modifient pas : pour un montant faux, supprimez la dépense et ressaisissez-la.</div>
            <div className="flex gap-2 mt-2">
              <button onClick={enregistrerModif} className={btnDark}>Enregistrer</button>
              <button onClick={() => setModif(null)} className="text-sm font-bold text-slate-600 underline">Annuler</button>
            </div>
          </div>
        )}
    </>
  );
  return { modif, ouvrirModif: estAdminPrincipal(db, profile) ? ouvrirModif : null, panneauModif };
}

export function Depenses({ db, save, profile }) {
  const premiere = boutiqueParDefaut(db, profile, { ecran: "depenses" });
  const [bq, setBq] = useState(profile.boutique || premiere);
  // ⚠ Voir boutiqueRetenue (lib/calculs.js) : la valeur mémorisée peut être
  // vide (écran ouvert pendant la synchronisation d'ouverture) ou désigner
  // une boutique qui n'existe plus (supprimée, ou effacée par une
  // réinitialisation). Dans les deux cas, on repart de la boutique par
  // défaut plutôt que d'afficher un écran figé ou un nom fantôme.
  const boutique = boutiqueRetenue(db, profile, bq, { ecran: "depenses" });
  // « Payé avec » nomme chaque caisse (capture Timo, 13/09/2026) ; vide = la caisse de la boutique regardée.
  // ⚠ Aucune catégorie d'office (Timo, 25/09/2026) : « Loyer », la première de
  // la liste, était proposée d'office — une dépense de 5 000 F saisie sans y
  // toucher est tombée en « Loyer » et le cadre du loyer l'a comptée. On CHOISIT.
  const formVide = { categorie: "", description: "", montant: "", paiement: PAIEMENTS[0], paye_avec: "", chantier_id: "" };
  const caissesPossibles = boutiquesVisibles(db, profile, db.boutiques || []).map((b) => b.nom);
  // Les chantiers de devis auxquels on peut rattacher une dépense (espace regardé, en cours).
  const chantiersOuverts = chantiersRattachables(db, profile);
  const [f, setF] = useState(formVide);
  const jeSuisDG = estAdminPrincipal(db, profile);

  // ---- 🏠 LE LOYER DE LA BOUTIQUE REGARDÉE (Timo, 25/09/2026) ----
  // Gérant et administrateur. La fiche (montant, propriétaire, échéance) se
  // règle dans ⚙ Paramètres par l'administrateur seul ; ici on LIT l'état du
  // mois dans les dépenses « Loyer », et « Payer » ne fait que PRÉ-REMPLIR le
  // formulaire : la dépense passe ensuite par toutes les règles ordinaires.
  const voitLoyer = ["admin", "gerant"].includes(profile.role);
  const fiche = voitLoyer ? ficheLoyer((db.boutiques || []).find((b) => b.nom === boutique)) : null;
  const loyer = fiche ? etatLoyer({ fiche, depenses: db.depenses, boutique, aujourdhui: today() }) : null;
  // Timo (25/09/2026) : « payer tous les mois en même temps ou avec
  // prépaiement ». Un mois (le plus ancien dû), tous les mois dus, ou un
  // nombre de mois choisi (d'avance). Le geste ne fait que PRÉ-REMPLIR.
  const payerLoyer = async () => {
    const dus = loyer.dus.filter((x) => !x.attente);
    const somme = (n) => moisAPayer(loyer, n).reduce((t, x) => t + x.reste, 0);
    const options = [];
    if (dus.length) options.push([1, `Le mois le plus ancien : ${libelleMois(dus[0].mois)} — ${fmt(somme(1))}`]);
    if (dus.length > 1) options.push([dus.length, `Tous les mois dus (${dus.length}) — ${fmt(somme(dus.length))}`]);
    options.push([0, "Payer d'avance… (choisir le nombre de mois)"]);
    const choix = await uChoix(`Loyer de ${boutique} — ${fmt(loyer.montant)} par mois.\n\nQue payez-vous ?`, options.map(([, l]) => l));
    if (choix === null || choix === undefined) return;
    let n = (options.find(([, l]) => l === choix) || [])[0];
    if (n === 0) {
      const v = await uPrompt(`Combien de mois payez-vous en tout${dus.length ? ` (dont ${dus.length} déjà dû${dus.length > 1 ? "s" : ""})` : ""} ?`, String(dus.length + 1));
      if (v === null) return;
      n = Math.round(Number(v));
      if (!(n >= 1 && n <= 24)) { uAlert("Indiquez un nombre de mois entre 1 et 24."); return; }
    }
    if (!n) return;
    const pf = formulaireLoyer(fiche, loyer, boutique, n);
    const refus = critiquePaiementLoyer(loyer, pf.loyer_mois);
    if (refus) { uAlert(refus); return; }
    setF({ ...formVide, ...pf });
  };

  // Timo (15/09/2026) : « si dépense dépasse fonds de caisse, impossible de
  // dépenser ». La limite est TOUT le contenu du tiroir (recettes + ce qu'il
  // reste du fonds) — règle pure critiqueSortieTiroir, revérifiée DANS chaque
  // geste. Seules les espèces payées avec la caisse d'une boutique vident le
  // tiroir : Flooz, virement, avance personnelle, argent du DG et caisse du
  // comptable n'y touchent pas (« si une dépense ne sort pas du tiroir, elle
  // n'est pas comptabilisée dans la caisse de toute façon »).
  // Timo (15/09/2026) : « dans Payé avec, ajouter fonds de caisse, de sorte
  // que si pas d'argent et il faut effectuer une dépense, fonds de caisse
  // apparaît (gérant) ». L'option n'est JAMAIS proposée « au cas où » : il
  // faut le rôle, une enveloppe qui existe, et un tiroir qui ne suffit pas.
  const poches = fondsAVerser(db, boutique, totalVente);
  const propositionFonds = fondsProposable({ role: profile.role, tiroir: poches.montant, enveloppe: poches.resteFonds, montant: f.montant });

  const refusTiroir = (nomBoutique, montant, geste) => {
    // ⚠ Timo (15/09/2026, réponse B) : le fonds est gardé À PART. On peut y
    // piocher quand le tiroir ne suffit pas — la limite est donc le tiroir
    // PLUS ce qu'il reste dans l'enveloppe.
    const p = fondsAVerser(db, nomBoutique, totalVente);
    return critiqueSortieTiroir({ tiroir: p.montant + p.resteFonds, fondsFixe: p.resteFonds, montant, geste, boutique: nomBoutique });
  };

  // ✏️ Modifier une dépense : voir useModifDepense (écrit UNE fois).
  const { modif, ouvrirModif, panneauModif } = useModifDepense(db, save, profile);

  // Timo (12/09/2026) : à partir de 5 000 F, la dépense attend la validation
  // du DG et ne compte nulle part avant ; l'origine des fonds est demandée.
  const ajouter = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!f.categorie) { uAlert("Choisissez la catégorie de la dépense."); return; }
    const choixCaisse = interpreterPayeAvec(f.paye_avec, boutique);
    const r = construireDepenseSaisie(db, profile, { ...f, ...choixCaisse }, today());
    if (r.refus) { uAlert(r.refus); return; }
    const autreBoutique = choixCaisse.boutique !== boutique ? `\n\n🏬 C'est la caisse de ${choixCaisse.boutique} qui a payé : la dépense sera enregistrée sur ${choixCaisse.boutique} (sa clôture et ses fonds à verser la verront), pas sur ${boutique}.` : "";
    const suite = r.aValider && !jeSuisDG ? `\n\n⏳ ${fmt(Number(f.montant))} atteint ${fmt(SEUIL_VALIDATION_DEPENSE)} : cette dépense sera soumise à la validation du DG et ne comptera qu'une fois validée.` : "";
    const chantierChoisi = f.chantier_id ? chantiersOuverts.find((c) => c.id === f.chantier_id) : null;
    if (f.chantier_id && !chantierChoisi) { uAlert("Ce chantier n'est plus rattachable (réceptionné, ou frais déjà payés). Choisissez-en un autre ou laissez « Aucun »."); return; }
    const refusChantier = chantierChoisi ? critiqueRattachement(db, profile, r.depense, chantierChoisi) : null;
    if (refusChantier) { uAlert(refusChantier); return; }
    // ⚠ Une dépense EN ATTENTE n'a pas encore vidé le tiroir : on mesure donc
    // le tiroir tel qu'il est, et c'est la VALIDATION qui butera à son tour.
    if (r.depense.paiement === "Espèces" && (!r.depense.paye_avec || r.depense.paye_avec === PAYE_AVEC_CAISSE)) {
      const refusT = refusTiroir(choixCaisse.boutique, Number(f.montant), "Cette dépense");
      if (refusT) { uAlert(refusT); return; }
    }
    // Ouvrir l'enveloppe : le rôle est revérifié DANS le geste, et l'option
    // doit être réellement proposable à cet instant (tiroir insuffisant).
    if (r.depense.paye_avec === PAYE_AVEC_FONDS) {
      if (refuserSaufRoles(profile, ROLES_FONDS_CAISSE, "Payer une dépense avec le fonds de caisse")) return;
      if (!propositionFonds.possible) { uAlert(`Le fonds de caisse ne peut pas payer cette dépense.\n\nTiroir de ${boutique} : ${fmt(Math.max(0, poches.montant))} · enveloppe : ${fmt(propositionFonds.reste)}.\n\nOn n'ouvre l'enveloppe que si le tiroir ne suffit pas, et seulement pour ce qu'elle contient.`); return; }
    }
    const rattache = chantierChoisi ? `\n\n🏠 Rattachée au chantier ${libelleChantier(chantierChoisi)} : elle sera déduite des frais d'installation avant le partage entre techniciens.` : "";
    // Timo (15/09/2026) : « la dépense prend les 20 000 de la caisse et on
    // passe avec 10 000 de fonds de caisse » — la confirmation DIT le partage.
    const partage = r.depense.paye_avec === PAYE_AVEC_FONDS
      ? `\n\n💼 Le tiroir de ${boutique} paie ${fmt(Math.max(0, poches.montant))} et le fonds de caisse complète ${fmt(propositionFonds.manqueAuTiroir)} (il restera ${fmt(propositionFonds.reste - propositionFonds.manqueAuTiroir)} dans l'enveloppe). Les prochaines recettes le rembourseront.`
      : "";
    if (!await uConfirm(`Confirmer la dépense de ${fmt(Number(f.montant))} en ${f.categorie}, payée avec : ${libelleChoixPayeAvec(f.paye_avec, boutique)} ?${suite}${autreBoutique}${rattache}${partage}`)) return;
    // 🏠 Le loyer pré-rempli garde son mois et SON local (la caisse d'une autre
    // boutique peut l'avoir payé) ; revérifié DANS le geste : jamais deux fois.
    const estLoyerDuMois = f.loyer_mois && f.categorie === CATEGORIE_LOYER;
    if (estLoyerDuMois) {
      const ficheL = ficheLoyer((db.boutiques || []).find((b) => b.nom === f.loyer_boutique));
      const refusL = critiquePaiementLoyer(ficheL ? etatLoyer({ fiche: ficheL, depenses: db.depenses, boutique: f.loyer_boutique, aujourdhui: today() }) : null, f.loyer_mois);
      if (refusL) { uAlert(refusL); return; }
    }
    const depenseLoyer = estLoyerDuMois ? { ...r.depense, loyer_mois: f.loyer_mois, loyer_boutique: f.loyer_boutique } : r.depense;
    const depense = chantierChoisi ? rattacherDepense(depenseLoyer, chantierChoisi) : depenseLoyer;
    save({ ...db, depenses: [depense, ...db.depenses], messages: [...r.messages, ...(db.messages || [])] }, r.journal + (chantierChoisi ? ` · chantier ${libelleChantier(chantierChoisi)}` : ""));
    setF(formVide);
    if (r.aValider && !jeSuisDG) uAlert(`Dépense enregistrée — en attente de validation par le DG.${choixCaisse.boutique !== boutique ? `\n\nElle est rangée sous ${choixCaisse.boutique} : choisissez cette boutique en haut pour la voir.` : ""}`);
    else if (choixCaisse.boutique !== boutique) uAlert(`Dépense enregistrée sur ${choixCaisse.boutique} (sa caisse a payé). Choisissez cette boutique en haut pour la voir.`);
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
    // Timo : « si on valide la première, la seconde refuse jusqu'à ce que le
    // tiroir contienne l'argent nécessaire. » Valider, c'est faire sortir
    // l'argent : on revérifie le tiroir à cet instant.
    if (d.paiement === "Espèces" && (!d.paye_avec || d.paye_avec === PAYE_AVEC_CAISSE)) {
      const refusT = refusTiroir(d.boutique, Number(d.montant), "Valider cette dépense");
      if (refusT) { uAlert(refusT); return; }
    }
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
  // Timo (13/09/2026) : un technicien voit l'onglet, mais SES dépenses seulement.
  const mesSeules = neVoitQueSesDepenses(profile);
  const liste = depensesVisibles(horsVersements(db.depenses).filter((x) => x.boutique === boutique), profile);
  // « Ce mois » ne compte que ce qui compte : validé, ou sans validation requise.
  const totalMois = depensesComptees(liste).filter((x) => String(x.date).slice(0, 7) === today().slice(0, 7)).reduce((s, x) => s + Number(x.montant), 0);
  const enAttenteIci = liste.filter(estEnAttente).reduce((s, x) => s + Number(x.montant), 0);

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
      {loyer && (
        <div className={`bg-white rounded-xl border-2 shadow-sm p-4 ${loyer.statut === "retard" ? "border-red-300" : loyer.statut === "paye" ? "border-green-300" : "border-amber-300"}`} data-loyer={loyer.statut}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-bold text-slate-800">🏠 Loyer de la boutique <Badge boutique={boutique} /></div>
              <div className="text-sm text-slate-600 mt-1">
                <b className="tabular-nums">{fmt(loyer.montant)}</b> par mois · échéance le <b>{Number(fiche.jour)}</b> du mois
                {fiche.proprietaire && <> · propriétaire : <b>{fiche.proprietaire}</b></>}{fiche.tel && <> ({fiche.tel})</>}
              </div>
              {(fiche.debut || fiche.caution > 0 || fiche.note) && (
                <div className="text-xs text-slate-500 mt-0.5">
                  {fiche.debut && <>Bail depuis le {dFR(fiche.debut)}</>}{fiche.debut && fiche.caution > 0 && " · "}
                  {fiche.caution > 0 && <>caution versée : {fmt(fiche.caution)}</>}
                  {fiche.note && <div>{fiche.note}</div>}
                </div>
              )}
              <div className="text-sm text-slate-700 mt-1" data-dernier-mois-paye>
                Dernier mois payé : <b>{loyer.dernierPaye ? libelleMois(loyer.dernierPaye) : "—"}</b>
                {loyer.avance && <span className="text-green-700 font-semibold"> · payé d'avance jusqu'à {libelleMois(loyer.avance)}</span>}
              </div>
              <div className={`text-sm font-bold mt-2 ${loyer.statut === "retard" ? "text-red-700" : loyer.statut === "paye" ? "text-green-700" : "text-amber-700"}`}>
                {loyer.statut === "paye" && `✅ ${libelleMois(loyer.mois)} : payé${loyer.derniere ? ` le ${dFR(loyer.derniere.date)}` : ""}`}
                {loyer.statut === "attente" && `⏳ Le loyer dû est saisi, en attente de la validation du DG`}
                {loyer.statut === "a_payer" && `⏳ ${libelleMois(loyer.mois)} : ${fmt(loyer.reste)} à payer avant le ${dFR(loyer.echeance)}`}
                {loyer.statut === "retard" && `⚠ Arriérés : ${loyer.moisEnRetard} mois (${libellePeriodeLoyer(loyer.dus.filter((x) => !x.attente && x.enRetard).map((x) => x.mois), { avecNombre: false })}) — ${fmt(loyer.reste)} dus · en retard de ${loyer.joursRetard} jour${loyer.joursRetard > 1 ? "s" : ""} (échéance du plus ancien : ${dFR(loyer.dus.find((x) => !x.attente && x.enRetard).echeance)})`}
              </div>
            </div>
            <button onClick={payerLoyer} className={btnDark} data-payer-loyer>
              {loyer.statut === "a_payer" || loyer.statut === "retard" ? "💵 Payer le loyer" : "💵 Payer d'avance"}
            </button>
          </div>
          {/* Ce que le cadre a COMPTÉ (Timo, 25/09/2026 : « pourquoi 85 000 en
              retard ? ») : un chiffre qui surprend doit montrer sa source. */}
          {loyer.lignes.length > 0 && (
            <div className="mt-2 text-xs text-slate-600" data-loyer-compte>
              Déjà compté :{" "}
              {loyer.lignes.map((d) => `${fmt(d.montant)} le ${dFR(d.date)} pour ${libellePeriodeLoyer(moisDeLaDepense(d))}${d.par ? ` (saisi par ${d.par})` : ""}${d?.validation?.statut === "attente" ? " — en attente du DG" : ""}`).join(" · ")}
              {loyer.statut !== "paye" && " — si ce n'était pas le loyer, l'administrateur supprime la dépense et la ressaisit dans la bonne catégorie."}
            </div>
          )}
          {f.loyer_mois && f.loyer_boutique === boutique && <div className="mt-2 text-xs text-sky-800">Le formulaire ci-dessous est rempli : vérifiez « Payé avec », puis enregistrez.</div>}
        </div>
      )}
      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">Nouvelle dépense <Badge boutique={boutique} /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Catégorie"><select className={inputCls} value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })} data-categorie-depense><option value="">— Choisir —</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Description"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Montant (F)"><input type="number" className={inputCls} value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} /></Field>
          <Field label="Paiement"><select className={inputCls} value={f.paiement} onChange={(e) => setF({ ...f, paiement: e.target.value })}>{PAIEMENTS.map((p) => <option key={p}>{p}</option>)}</select></Field>
          {/* L'origine des fonds (Timo, 12/09/2026) : « les trois propositions sont bonnes ». */}
          <Field label="Payé avec">
            <select className={inputCls} value={f.paye_avec || `caisse:${boutique}`} onChange={(e) => setF({ ...f, paye_avec: e.target.value })} data-paye-avec>
              {optionsPayeAvec(caissesPossibles, boutique, { avecComptable: !afficheChiffresFormation(db, profile), fonds: propositionFonds }).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
            </select>
          </Field>
          {/* Timo (13/09/2026) : « au moment d'enregistrer la dépense, rattacher à
              un devis : les chantiers en cours apparaissent et il rattache » —
              puis, capture : « devant Payé avec, avoir la ligne : chantier à
              rattacher… pas sur la ligne de dépense ». La ligne est TOUJOURS là. */}
          <Field label="Chantier à rattacher">
            <select className={inputCls} value={f.chantier_id} onChange={(e) => setF({ ...f, chantier_id: e.target.value })}>
              <option value="">— Aucun —</option>
              {chantiersOuverts.length === 0 && <option value="" disabled>Aucun chantier de devis en cours</option>}
              {chantiersOuverts.map((c) => <option key={c.id} value={c.id}>🏠 {libelleChantier(c)}</option>)}
            </select>
          </Field>
        </div>
        {propositionFonds.possible && <div className="mt-2 text-xs text-amber-800" data-fonds="propose">💼 Le tiroir de {boutique} ne contient que {fmt(Math.max(0, poches.montant))} : le <b>fonds de caisse</b> peut compléter. Le tiroir paiera {fmt(Math.max(0, poches.montant))} et l'enveloppe {fmt(propositionFonds.manqueAuTiroir)} (il y reste {fmt(propositionFonds.reste)}). Choisissez « Le fonds de caisse » dans « Payé avec » ; les prochaines recettes le rembourseront.</div>}
        {f.chantier_id && <div className="mt-2 text-xs text-purple-800">🏠 Cette dépense sera déduite des frais d'installation du chantier avant le partage entre techniciens (une fois qu'elle compte).</div>}
        {f.montant !== "" && doitEtreValidee(f.montant) && !jeSuisDG && (
          <div className="mt-2 text-sm font-bold text-amber-700">⏳ À partir de {fmt(SEUIL_VALIDATION_DEPENSE)}, la dépense est soumise à la validation du DG : elle ne comptera (caisse, tableau de bord) qu'une fois validée.</div>
        )}
        {f.paye_avec === "avance" && <div className="mt-2 text-xs text-slate-500">Une avance personnelle ne sort pas du tiroir : elle vous sera remboursée (caisse, salaire ou DG) une fois qu'elle compte.</div>}
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer la dépense</button>
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-1">
          <span>{mesSeules ? "Mes dépenses" : "Dépenses"} — {boutique}</span>
          <span className="text-sm font-semibold text-slate-500">Ce mois : {fmt(totalMois)}{enAttenteIci > 0 ? <span className="text-amber-700"> · en attente de validation (non comptées) : {fmt(enAttenteIci)}</span> : null}</span>
        </div>
        {panneauModif}
        <TableauDepenses liste={liste} profile={profile} onSupprimer={supprimerDepense} onModifier={ouvrirModif} vide={mesSeules ? "Vous n'avez enregistré aucune dépense pour cette boutique." : "Aucune dépense enregistrée."} />
        {/* On ne cache pas l'argent : on dit où il est allé. */}
        <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">
          Les <b>versements de fonds</b>, les <b>fonds de caisse remis par le DG</b> et les <b>remboursements de reprise</b> ne sont pas des dépenses : ils ne comptent pas ici.
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
  // Timo (13/09/2026) : une dépense de boutique « payée avec la caisse du
  // comptable » passe aussi par son pointage « Remis » — elle est une sortie
  // de SA caisse (lib/caissesCentrales.js, mouvementsComptable).
  const liste = (db.depenses || []).filter((x) => x.boutique === "Chez le comptable" || payeeParLeComptable(x))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

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
  // ✏️ Le comptable reste en lecture seule : seul l'administrateur principal
  // voit le bouton (même règle que dans les boutiques).
  const { ouvrirModif, panneauModif } = useModifDepense(db, save, profile);
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
                <div className="text-xs text-slate-500">{dFR(x.date)} · enregistré par {x.par}{x.montant < 0 ? " · 💵 entrée de caisse" : ""}{payeeParLeComptable(x) ? ` · dépense de ${x.boutique}, payée avec ma caisse` : ""}</div>
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
        {panneauModif}
        <TableauDepenses liste={liste} profile={profile} onSupprimer={supprimerDepense} onModifier={ouvrirModif} vide="Aucune sortie de caisse « Chez le comptable » pour l'instant." />
      </div>
    </div>
  );
}

