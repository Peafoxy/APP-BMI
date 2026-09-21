// ============================================================
// screens/Caisse.jsx — Clôture de caisse du jour.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { uid, fmt, today, dFR, totalVente } from "../lib/core";
import { Field, inputCls, ChampQuiGrandit, btnDark, Badge, Panel, uAlert, uConfirm, uPrompt, AucuneBoutique, demanderMois } from "../components/ui";
// Timo (12/09/2026) : la clôture est impossible tant qu'une dépense en
// espèces attend la validation du DG ; les avances de frais se remboursent ici.
import { depensesBloquantCloture, motifBlocageCloture, rejetsDuJour, avancesARembourser, MOYENS_REMBOURSEMENT, MOYEN_REMB_SALAIRE, ROLES_REMB_CAISSE, critiqueRemboursement, rembourserAvance, libelleMoyenRemb } from "../lib/validationDepenses";
import { bloquerSiLecture, boutiquesVente, boutiquesVisibles, boutiqueParDefaut, estCompteFormation, boutiqueRetenue, refuserSaufRoles, refuserSaufAdminPrincipal, estAdminPrincipal, espaceDuCompte, ROLES_CAISSE, periodes } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
import { HistoriqueArchive } from "../components/HistoriqueArchive";
import { activiteDuJour, joursAClôturer, estCloturee, alerteSaisieRecette, cloturesDepassees, messageClotureDepassee } from "../lib/cloture";
import { destinationsPour, DEST_BANQUE, DEST_COMPTABLE, DEST_DG, DEST_TIROIR, SOURCE_ESPECES, ROLES_VERSEMENT, construireVersement, versementsDe, fondsAVerser, totalVerse, resumeCaisses, validationVersement, versementsAValiderParDG, versementsValidesParDG, messagesVersement, libelleDestination, libelleVersementDu, libelleEcart, montantDifferent, messageJustification, critiqueRejet, rejeterVersement, rejetVersement, critiqueSortieTiroir } from "../lib/versements";
import { soldesMobiles, phraseNumeroMobile } from "../lib/caissesMobiles";
import { banquesReglees } from "../lib/banques";

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
  // Timo (13/09/2026) : « un bouton RÉSUMÉ dans lequel on reprend les carrés »
  // — Fonds à verser / Total versé / Entrées / Sorties, une ligne par
  // boutique, le total en bas. Dans Caisse, pas dans le tableau de bord.
  const [resume, setResume] = useState(false);
  // Timo (13/09/2026) : « ajouter période… devant RÉSUMÉ, appliquée aussi aux
  // boutiques » — la même liste que le tableau de bord (periodes()), « Depuis
  // le début » d'office : rien ne change tant qu'on ne touche pas au choix.
  const listePeriodes = periodes();
  const [periodeIndex, setPeriodeIndex] = useState(listePeriodes.length - 1);
  const periodeChoisie = listePeriodes[periodeIndex] || listePeriodes[listePeriodes.length - 1];
  const depuisLeDebut = periodeIndex === listePeriodes.length - 1;
  const periode = depuisLeDebut ? null : { du: periodeChoisie[1], au: periodeChoisie[2] };
  const libellePeriode = periodeChoisie[0];
  const [notes, setNotes] = useState("");
  const aujourdhui = today();
  // ⚠ Décision Timo (09/09/2026) : une journée avec des ventes et sans
  // clôture BLOQUE les ventes du lendemain (lib/cloture.js). L'écran doit
  // donc permettre de clôturer un jour PASSÉ : on choisit le jour, le plus
  // ancien jour en retard est proposé d'abord.
  const enRetard = joursAClôturer(db, boutique, aujourdhui, totalVente);
  // ⚠ Timo (11/09/2026, option « b ») : une journée clôturée dont la caisse a
  // bougé ensuite doit se RECLÔTURER — sinon la clôture ment en silence.
  const depassees = cloturesDepassees(db, boutique, totalVente);
  const jourReclôturable = (j) => depassees.some((d) => d.date === j);
  const [jourChoisi, setJourChoisi] = useState("");
  const t = jourChoisi && (enRetard.includes(jourChoisi) || jourReclôturable(jourChoisi) || jourChoisi === aujourdhui) ? jourChoisi : (enRetard[0] || aujourdhui);
  // Les chiffres du jour : UNE règle (activiteDuJour), la même que le blocage.
  const jour = activiteDuJour(db, boutique, t, totalVente);
  const { especesVentes, especesReglements, especesDepenses, versementsDuJour, fondsRemisDuJour, depensesSurFonds, rembourseAuFonds, detailReglements, theorique, recetteDuJour, sortiesJustifiees, fondsHier, recetteParPersonne, fondsPlafond, fondsReste, fondsEntame, fondsIntact } = jour;
  // Le piège de la capture du 09/09/2026 (écart 1 400) : la recette saisie à la place du tiroir.
  const alerteRecette = alerteSaisieRecette(compte, jour, fmt);
  // ⚠ Timo (15/09/2026), après avoir essayé le comptage obligatoire : « enlève
  // cette restriction de compter l'enveloppe… tant qu'elle a été entamée,
  // l'information suffit déjà. Elle est compensée automatiquement quand il y a
  // vente, et à la clôture le système informe combien a été restitué dans
  // l'enveloppe. C'est déjà suffisant. » La clôture INFORME donc, elle ne
  // demande RIEN : ni champ, ni écart, ni blocage.
  const dejaCloturee = estCloturee(db, boutique, t);
  const aReclôturer = depassees.find((d) => d.date === t) || null;
  const ecart = compte === "" ? null : Number(compte) - theorique;
  // Timo (12/09/2026) : « la clôture impossible s'il y a des dépenses liées à
  // la caisse qui ne sont pas validées » — jusqu'au jour clôturé inclus.
  const bloquantes = depensesBloquantCloture(db, boutique, t);
  const blocageCloture = motifBlocageCloture(bloquantes, fmt, dFR);
  // Les dépenses REJETÉES du jour qui étaient sorties du tiroir : le manque attendu, et qui le doit.
  const rejets = rejetsDuJour(db, boutique, t);

  const cloturer = async () => {
    if (refuserSaufRoles(profile, ROLES_CAISSE, "Clôturer la caisse")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (blocageCloture) { uAlert(blocageCloture); return; }
    if (compte === "") { uAlert("Comptez la caisse et saisissez le montant."); return; }
    if (!await uConfirm(`Confirmer la clôture du ${dFR(t)} ?\n\n`
      + `Dans le tiroir hier soir : ${fmt(fondsHier)}\n`
      + `+ Recette du jour (ventes et encaissements) : ${fmt(recetteDuJour)}\n`
      + `− Sorties du jour (dépenses, versements) : ${fmt(sortiesJustifiees)}\n`
      + (rembourseAuFonds > 0 ? `− Rendu au fonds de caisse : ${fmt(rembourseAuFonds)}\n` : "")
      // Le fonds remis par le DG a SA ligne, sous un trait : ce n'est pas une
      // recette (Timo, 15/09/2026 — « ne pas mélanger le fonds aux ventes »).
      // 💼 L'enveloppe est GARDÉE À PART (Timo, 15/09/2026, réponse B) : elle
      // n'est pas dans le tiroir, elle n'entre dans aucun total — on la
      // rappelle seulement, pour information.
      + (fondsPlafond > 0 ? `\n💼 Fonds de caisse (gardé à part, PAS dans le tiroir) : ${fmt(fondsReste)}${fondsIntact ? " — intact" : ` — entamé de ${fmt(fondsEntame)}`}\n` : "")
      + (rembourseAuFonds > 0 ? `   Les recettes du jour lui ont restitué ${fmt(rembourseAuFonds)}.\n` : "")
      + `\n= À trouver dans le tiroir : ${fmt(theorique)}\n`
      + `Compté dans le tiroir : ${fmt(Number(compte))}\n`
      + `Écart de caisse : ${fmt(Number(compte) - theorique)}${alerteRecette ? "\n\n" + alerteRecette : ""}`)) return;
    // Une reclôture REMPLACE la clôture du jour, sans effacer son histoire :
    // l'ancienne photo reste dans `precedentes`, qui ne rétrécit jamais.
    const ancienne = db.clotures.find((c) => c.boutique === boutique && String(c.date) === t);
    const fiche = { id: ancienne?.id || uid(), date: t, boutique, theorique, compte: Number(compte), notes, par: profile.nom, cloture_le: aujourdhui,
      ...(ancienne ? { precedentes: [...(ancienne.precedentes || []), { theorique: ancienne.theorique, compte: ancienne.compte, par: ancienne.par, cloture_le: ancienne.cloture_le, notes: ancienne.notes || "" }] } : {}) };
    save({ ...db, clotures: [fiche, ...db.clotures.filter((c) => !(c.boutique === boutique && String(c.date) === t))] },
      `${ancienne ? "RECLÔTURE" : "Clôture"} caisse ${boutique} du ${dFR(t)} : compté ${fmt(Number(compte))} (écart ${fmt(Number(compte) - theorique)})${t !== aujourdhui && !ancienne ? " — clôturée en retard" : ""}`);
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
  // Timo (10/09/2026) : « Destination de versement reste sur DG par défaut ».
  const destinationDefaut = DEST_DG;
  // ---- 📱 D'OÙ PART L'ARGENT (Timo, 21/09/2026) ----
  // « Si on a des pastilles mix/flooz, le versement se fera comment ? » — le
  // MÊME geste, avec une case de plus. Les espèces d'office : rien ne change
  // pour qui n'y touche pas.
  const [vers, setVers] = useState({ montant: "", source: SOURCE_ESPECES, destination: destinationDefaut, banque: "", bordereau: "", note: "" });
  const destinations = destinationsPour(espaceDuCompte(db, profile) === true, vers.source);
  // Les deux comptes mobiles de CETTE boutique (décision « 1b » : chaque
  // boutique a son numéro), lus — rien n'est écrit.
  const mobiles = soldesMobiles(db, boutique);
  const mobileChoisi = mobiles.find((m) => m.moyen === vers.source) || null;
  // ⚠ Le montant ATTENDU par le formulaire de versement est toujours le solde
  // depuis le début (un solde ne dépend pas d'une période) ; les carrés, eux,
  // suivent la période choisie.
  const aVerser = fondsAVerser(db, boutique, totalVente);
  const aVerserPeriode = fondsAVerser(db, boutique, totalVente, periode);
  const verse = totalVerse(db, boutique, aujourdhui, periode);
  // ⚠ Le montant ATTENDU dépend du compte qui se vide : le tiroir pour les
  // espèces, le solde du compte pour un versement mobile. Sans ça, la
  // justification obligatoire s'appuierait sur le mauvais chiffre.
  const attenduVersement = mobileChoisi ? Math.max(0, mobileChoisi.solde) : aVerser.aVerser;
  // Les boutiques de la rangée (vente + TERRAIN, espace regardé) : celles du RÉSUMÉ.
  const boutiquesResume = boutiquesVisibles(db, profile, [...boutiquesVente(db), ...(db.boutiques || []).filter((b) => b.terrain)]).map((b) => b.nom);
  const leResume = resume ? resumeCaisses(db, boutiquesResume, totalVente, aujourdhui, periode) : null;
  // L'historique des versements de toutes ces boutiques (Timo, 13/09/2026),
  // affiché par LE composant commun d'archivage (10 lignes, archives).
  const historiqueVersements = resume ? boutiquesResume.flatMap((b) => versementsDe(db, b)).filter((d) => !periode || (String(d.date).slice(0, 10) >= periode.du && String(d.date).slice(0, 10) <= periode.au)) : [];
  const mesVersements = versementsDe(db, boutique);
  const verser = async () => {
    if (refuserSaufRoles(profile, ROLES_VERSEMENT, "Verser les fonds")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (!destinations.includes(vers.destination)) { uAlert("Cette destination n'est pas disponible dans l'espace regardé."); return; }
    const r = construireVersement(profile, { boutique, ...vers, attendu: attenduVersement });
    if (r.refus) { uAlert(r.refus); return; }
    const interne = vers.destination === DEST_TIROIR;
    const depuis = mobileChoisi ? `du compte ${mobileChoisi.court} de ${boutique}` : `de ${boutique}`;
    if (!await uConfirm(`Enregistrer le versement de ${fmt(Number(vers.montant))} ${depuis} → ${libelleDestination(r.versement)} ?\n\n${interne
      ? "L'argent quitte le compte mobile et entre dans le tiroir : aucune validation n'est demandée, et la clôture du soir le verra."
      : `Il restera « en attente » jusqu'à sa validation par ${vers.destination === DEST_COMPTABLE ? "le comptable" : "le DG"}.`}`)) return;
    save({
      ...db,
      depenses: [r.sortie, ...(r.entree ? [r.entree] : []), ...(db.depenses || [])],
      messages: [...messagesVersement(db, profile, r.sortie), ...(db.messages || [])],
    }, `Versement de fonds ${fmt(Number(vers.montant))} : ${boutique} → ${libelleDestination(r.versement)} (par ${profile.nom})`);
    setVers({ montant: "", source: SOURCE_ESPECES, destination: destinationDefaut, banque: "", bordereau: "", note: "" });
    uAlert(interne ? "Retrait enregistré : l'argent est passé du compte mobile au tiroir." : "Versement enregistré — en attente de validation.");
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

  // ---- 💼 LES AVANCES DE FRAIS À REMBOURSER (Timo, 12/09/2026) ----
  // L'employé a payé de sa poche ; une fois que la dépense compte (validée,
  // ou sous le seuil), on la lui rembourse : en espèces depuis la caisse
  // (gérant, admin), avec le salaire du mois ou par le DG (admin).
  const avances = avancesARembourser(db, boutique);
  const rembourser = async (d, moyen) => {
    if (bloquerSiLecture(db, profile)) return;
    let mois;
    if (moyen === MOYEN_REMB_SALAIRE) {
      const refusAvant = critiqueRemboursement(d, moyen, profile, { mois: today().slice(0, 7) });
      if (refusAvant) { uAlert(refusAvant); return; }
      mois = await demanderMois(`Sur quelle paie porter le remboursement de ${fmt(d.montant)} à ${d.par} ?`);
      if (mois === null) return;
    }
    const refus = critiqueRemboursement(d, moyen, profile, { mois });
    if (refus) { uAlert(refus); return; }
    // Timo (15/09/2026), sur l'employé qui a avancé de sa poche : « elle
    // attendra que le tiroir soit capable et après validation elle reprend son
    // argent ». Un remboursement en ESPÈCES vide le tiroir comme une dépense :
    // même règle (critiqueSortieTiroir). Le salaire et le DG n'y touchent pas.
    if (moyen === "caisse") {
      const refusT = critiqueSortieTiroir({
        tiroir: aVerser.montant + aVerser.resteFonds, fondsFixe: aVerser.resteFonds,
        montant: Number(d.montant), geste: "Ce remboursement", boutique, avecAvance: false,
      });
      if (refusT) { uAlert(refusT); return; }
    }
    if (!await uConfirm(`Rembourser à ${d.par} l'avance de ${fmt(d.montant)} (${d.description || d.categorie} du ${dFR(d.date)}) — ${libelleMoyenRemb(moyen).toLowerCase()}${mois ? ` (${mois})` : ""} ?${moyen === "caisse" ? `\n\nLa sortie sera enregistrée aujourd'hui dans la caisse de ${boutique}.` : ""}`)) return;
    const r = rembourserAvance(db, profile, d, moyen, today(), { mois });
    if (r.refus) { uAlert(r.refus); return; }
    save({ ...db, depenses: r.depenses, users: r.users, messages: [...r.messages, ...(db.messages || [])] }, r.journal);
  };

  // ⚠ Cloisonnement : aucune boutique de l'espace du compte connecté —
  // on n'affiche PAS le formulaire, plutôt que de le laisser écrire dans la
  // boutique de repli (voir boutiqueParDefaut dans lib/calculs.js).
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;
  return (
    <div className="space-y-4">
      {/* Timo (13/09/2026) : « dès qu'on quitte le résumé pour revenir sur les
          boutiques, l'écran ne se recouvre pas » — un clic sur une boutique
          REFERME le résumé. Le sélecteur de période est sur la même ligne,
          devant RÉSUMÉ, et vaut pour le résumé ET la boutique regardée. */}
      {/* Capture Timo (13/09/2026) : « même sur résumé, la boutique est toujours
          sélectionnée » — en mode RÉSUMÉ, aucune pastille de boutique n'est allumée
          (la boutique mémorisée reste en place pour le retour). */}
      {!profile.boutique && <BoutiqueTabs ecran="caisse" db={db} value={resume ? "" : bq} onChange={(nom) => { setBq(nom); setResume(false); }} avecTerrain profile={profile}
        extra={<>
          <button onClick={() => setResume((r) => !r)} className={`px-4 py-1.5 rounded-full text-sm font-bold border ${resume ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-300 text-slate-600"}`}>📊 RÉSUMÉ</button>
          {/* Capture Timo (13/09/2026) : « avec mention Période, comme c'est fait dans
              le tableau de bord », puis « ramener période devant résumé » → option 1 :
              à DROITE de RÉSUMÉ, sur la même ligne. */}
          <div className="flex items-center gap-2"><div className="font-bold text-slate-800">Période :</div>
            <select className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white" value={periodeIndex} onChange={(e) => setPeriodeIndex(Number(e.target.value))} title="Période des carrés (boutique et résumé)">
              {listePeriodes.map(([label], i) => <option key={i} value={i}>{label}</option>)}
            </select>
          </div>
        </>} />}
      {resume && leResume && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">📊 Résumé des caisses <span className="text-sm font-normal text-slate-500">· une ligne par boutique, rejetés exclus · {libellePeriode}{!depuisLeDebut ? " (fonds à verser = solde à la fin de la période)" : ""}</span></div>
          <table className="w-full text-sm min-w-[860px]">
            <thead><tr className="text-xs text-slate-500 uppercase bg-slate-100">
              {[["Boutique", "text-left"], ["Fonds à verser", "text-right"], ["Fonds de caisse", "text-right"], ["Total versé", "text-right"], ["Entrées", "text-right"], ["Sorties (versements compris)", "text-right"]].map(([h, al]) => <th key={h} className={`${al} px-3 py-2 whitespace-nowrap`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {leResume.lignes.map((l) => {
                const retard = joursAClôturer(db, l.boutique, aujourdhui, totalVente).length;
                return (
                  <tr key={l.boutique} className="border-t border-slate-100">
                    <td className="px-3 py-2"><div className="font-semibold text-slate-800">{l.boutique}</div>{retard > 0 && <div className="text-xs font-bold text-red-600">⚠ {retard} jour{retard > 1 ? "s" : ""} sans clôture</div>}</td>
                    <td className={`px-3 py-2 tabular-nums text-right font-bold ${l.solde < 0 ? "text-red-600" : ""}`}>{fmt(l.fondsFixe > 0 ? l.aVerser : l.solde)}{l.fondsFixe > 0 && <div className="text-xs font-normal text-slate-400">solde {fmt(l.solde)}</div>}{l.dernierVersement && <div className="text-xs font-normal text-slate-400">dernier versement le {dFR(l.dernierVersement)}</div>}</td>
                    <td className={`px-3 py-2 tabular-nums text-right ${l.fondsPlafond > 0 && l.resteFonds < l.fondsPlafond ? "text-amber-700 font-bold" : ""}`}>{l.fondsPlafond > 0 ? fmt(l.resteFonds) : "—"}{l.fondsPlafond > 0 && <div className="text-xs font-normal text-slate-400">gardé à part{l.resteFonds < l.fondsPlafond ? ` · entamé de ${fmt(l.fondsPlafond - l.resteFonds)}` : " · intact"}</div>}{l.fondsPlafond === 0 && l.fondsFixe > 0 && <div className="text-xs font-normal text-red-700">réglé {fmt(l.fondsFixe)}, jamais remis</div>}{l.fondsRemis > 0 && <div className="text-xs font-normal text-slate-400">remis par le DG {fmt(l.fondsRemis)}</div>}</td>
                    <td className="px-3 py-2 tabular-nums text-right">{fmt(l.verse)}<div className="text-xs text-slate-400">ce mois {fmt(l.verseCeMois)}{l.verseEnAttente > 0 ? <span className="text-amber-700"> · en attente {fmt(l.verseEnAttente)}</span> : null}</div></td>
                    <td className="px-3 py-2 tabular-nums text-right text-emerald-700">{fmt(l.entrees)}</td>
                    <td className="px-3 py-2 tabular-nums text-right">− {fmt(l.sorties)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <td className="px-3 py-2">TOTAL</td>
                <td className={`px-3 py-2 tabular-nums text-right ${leResume.total.solde < 0 ? "text-red-600" : ""}`}>{fmt(leResume.total.fondsFixe > 0 ? leResume.total.aVerser : leResume.total.solde)}{leResume.total.fondsFixe > 0 && <div className="text-xs font-normal text-slate-400">soldes {fmt(leResume.total.solde)}</div>}</td>
                <td className="px-3 py-2 tabular-nums text-right">{leResume.total.fondsPlafond > 0 ? fmt(leResume.total.resteFonds) : "—"}{leResume.total.fondsFixe > 0 && <div className="text-xs font-normal text-slate-400">réglés {fmt(leResume.total.fondsFixe)}</div>}</td>
                <td className="px-3 py-2 tabular-nums text-right">{fmt(leResume.total.verse)}<div className="text-xs font-normal text-slate-400">ce mois {fmt(leResume.total.verseCeMois)}{leResume.total.verseEnAttente > 0 ? <span className="text-amber-700"> · en attente {fmt(leResume.total.verseEnAttente)}</span> : null}</div></td>
                <td className="px-3 py-2 tabular-nums text-right text-emerald-700">{fmt(leResume.total.entrees)}</td>
                <td className="px-3 py-2 tabular-nums text-right">− {fmt(leResume.total.sorties)}</td>
              </tr>
            </tbody>
          </table>
          <div className="px-4 py-2 font-bold text-slate-800 border-t border-b border-slate-200 bg-slate-50 text-sm">💸 Historique des versements <span className="font-normal text-slate-500">· toutes les boutiques du résumé, du plus récent au plus ancien · {libellePeriode}</span></div>
          <HistoriqueArchive lignes={historiqueVersements} dateDe={(d) => d.date} aujourdhui={aujourdhui} vide="Aucun versement." titreArchives="Versements archivés"
            entete={<thead className="sticky top-0"><tr className="text-xs text-slate-500 uppercase bg-slate-100">{[["Date", "text-left"], ["Boutique", "text-left"], ["Montant", "text-right"], ["Destination", "text-left"], ["Statut", "text-left"]].map(([h, al]) => <th key={h} className={`${al} px-3 py-2 whitespace-nowrap`}>{h}</th>)}</tr></thead>}
            rendre={(d) => {
              const v = validationVersement(db, d);
              return (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(d.date)}</td>
                  <td className="px-3 py-2 font-semibold">{d.boutique}</td>
                  <td className={`px-3 py-2 tabular-nums text-right font-bold ${rejetVersement(d) ? "line-through text-red-700" : ""}`}>{fmt(d.versement.montant)}</td>
                  <td className="px-3 py-2">{libelleDestination(d.versement)}{libelleEcart(d.versement) ? <span className="text-xs text-red-600"> · {libelleEcart(d.versement)}</span> : null}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{rejetVersement(d) ? <span className="text-red-700">✖ rejeté le {dFR(d.versement_rejete_le)}</span> : v ? <span className="text-green-700">✅ validé le {dFR(v.le)} par {v.par}</span> : <span className="text-amber-700">⏳ en attente</span>}</td>
                </tr>
              );
            }} />
        </div>
      )}
      {/* Timo (13/09/2026) : « dans résumé, ne plus afficher autre chose que le
          résumé des caisses » — versements, avances, clôture disparaissent. */}
      {!resume && (<>
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
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-3">
          <div className="bg-white rounded-lg p-3 border border-slate-200 col-span-2"><div className="text-xs text-slate-500">Fonds à verser (le tiroir{depuisLeDebut ? "" : ` à la fin de : ${libellePeriode}`}{aVerserPeriode.dernierVersement ? ` — dernier versement le ${dFR(aVerserPeriode.dernierVersement)}` : ""})</div><div className={`font-bold tabular-nums text-lg ${aVerserPeriode.montant < 0 ? "text-red-600" : ""}`}>{fmt(aVerserPeriode.montant)}</div>{aVerserPeriode.fondsPlafond > 0 && <div className="text-xs text-slate-400">le fonds de caisse est gardé à part : il n'est pas là-dedans</div>}</div>
          {/* Timo (14/09/2026) : « il ne faut pas mélanger le fonds de caisse avec ce
              qu'on va verser » — le fonds a SON carré : ce qu'il en reste dans le tiroir. */}
          {(aVerserPeriode.fondsFixe > 0 || aVerserPeriode.fondsRemis > 0) && (
            <div className="bg-white rounded-lg p-3 border border-slate-200" data-carre="fonds-de-caisse"><div className="text-xs text-slate-500">💼 Fonds de caisse{aVerserPeriode.fondsFixe > 0 ? ` (fixe ${fmt(aVerserPeriode.fondsFixe)})` : ""}</div>
              <div className={`font-bold tabular-nums ${aVerserPeriode.fondsFixe > 0 && aVerserPeriode.fondsEntame > 0 ? "text-amber-700" : ""}`}>{aVerserPeriode.fondsFixe > 0 ? fmt(aVerserPeriode.resteFonds) : "—"}</div>
              <div className="text-xs text-slate-400">gardé à part, jamais dans le tiroir · {aVerserPeriode.fondsFixe > 0 ? (aVerserPeriode.fondsIntact ? "intact" : `il en reste ${fmt(aVerserPeriode.resteFonds)} · entamé de ${fmt(aVerserPeriode.fondsEntame)}`) : "aucun fonds réglé (⚙ Paramètres → Boutiques → 💼 Fonds de caisse)"}{aVerserPeriode.fondsRemis > 0 ? ` · remis par le DG ${fmt(aVerserPeriode.fondsRemis)}${aVerserPeriode.derniereRemise ? ` (le ${dFR(aVerserPeriode.derniereRemise)})` : ""}` : ""}</div></div>
          )}
          {/* Timo (13/09/2026) : « ajouter un carré présentant le total versé » — rejetés exclus. */}
          <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Total versé{depuisLeDebut ? "" : ` · ${libellePeriode}`}</div><div className="font-bold tabular-nums">{fmt(verse.total)}</div><div className="text-xs text-slate-400">{depuisLeDebut ? `ce mois ${fmt(verse.ceMois)}` : ""}{verse.enAttente > 0 ? <span className="text-amber-700">{depuisLeDebut ? " · " : ""}en attente {fmt(verse.enAttente)}</span> : null}</div></div>
          <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Entrées{depuisLeDebut ? "" : ` · ${libellePeriode}`}</div><div className="font-bold tabular-nums text-emerald-700">{fmt(aVerserPeriode.ventes + aVerserPeriode.reglements)}</div>{aVerserPeriode.fondsRemis > 0 && <div className="text-xs text-slate-400">hors fonds de caisse remis {fmt(aVerserPeriode.fondsRemis)} (il va dans l'enveloppe)</div>}</div>
          <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Sorties (versements compris){depuisLeDebut ? "" : ` · ${libellePeriode}`}</div><div className="font-bold tabular-nums">− {fmt(aVerserPeriode.depenses)}</div>{aVerserPeriode.retraits > 0 && <div className="text-xs text-slate-400">dont {fmt(aVerserPeriode.retraits)} entrés depuis un compte mobile (comptés en Entrées)</div>}</div>
          {/* ---- 📱 LES COMPTES MOBILES (Timo, 21/09/2026) ----
              « Comment savoir que sur T-Money il reste 120 mil et non 160 mil…
              et que l'administrateur aussi, sans sortir sa calculatrice, ait
              tout sous ses yeux. » Le solde se LIT, rien n'est écrit. Un carré
              ne s'affiche que si le compte SERT (un mouvement, ou un numéro
              réglé) : pas de carte à zéro sur une boutique qui n'a pas Flooz. */}
          {mobiles.filter((m) => m.mouvements > 0 || m.numero).map((m) => (
            <div key={m.caisse} className="bg-white rounded-lg p-3 border border-slate-200" data-carre={`mobile-${m.champ}`}>
              <div className="text-xs text-slate-500">📱 {m.court}</div>
              <div className={`font-bold tabular-nums ${m.solde < 0 ? "text-red-600" : ""}`}>{fmt(m.solde)}</div>
              <div className="text-xs text-slate-400">{phraseNumeroMobile(m.numero)} · ce qui reste sur le compte, d'après les saisies</div>
            </div>
          ))}
        </div>
        {ROLES_VERSEMENT.includes(profile.role) && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* ⚠ La case n'apparaît que si la boutique A un compte mobile qui
                sert : sur une boutique qui n'encaisse qu'en espèces, le
                formulaire reste exactement celui d'avant. */}
            {mobiles.some((m) => m.mouvements > 0 || m.numero) && (
              <Field label="D'où part l'argent ?">
                <select className={inputCls} value={vers.source} data-choix="source-versement"
                  onChange={(e) => setVers({ ...vers, source: e.target.value, destination: destinationDefaut, banque: "", bordereau: "", note: "" })}>
                  <option value={SOURCE_ESPECES}>Le tiroir (espèces) — {fmt(aVerser.aVerser)}</option>
                  {mobiles.filter((m) => m.mouvements > 0 || m.numero).map((m) => (
                    <option key={m.moyen} value={m.moyen}>📱 {m.court} — {fmt(m.solde)}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Montant versé (F)"><input type="number" inputMode="numeric" className={inputCls} value={vers.montant} onChange={(e) => setVers({ ...vers, montant: e.target.value })} /></Field>
            <Field label="Destination">
              <select className={inputCls} value={vers.destination} onChange={(e) => setVers({ ...vers, destination: e.target.value })}>
                {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            {vers.destination === DEST_BANQUE && (
              <>
                {/* La banque se CHOISIT dans la liste de ⚙ Paramètres → 🏦 Banques
                    (Timo, 14/09/2026 : « une liste dans paramètres ») ; « ✏️ Autre
                    banque… » garde la saisie libre, et sans liste réglée rien ne
                    change : on tape le nom comme avant. */}
                {banquesReglees(db).length > 0 && !vers.banqueLibre ? (
                  <Field label="Banque">
                    <select className={inputCls} value={vers.banque} data-choix="banque-versement"
                      onChange={(e) => (e.target.value === "__autre__" ? setVers({ ...vers, banque: "", banqueLibre: true }) : setVers({ ...vers, banque: e.target.value }))}>
                      <option value="">— Choisir la banque —</option>
                      {banquesReglees(db).map((b) => <option key={b} value={b}>{b}</option>)}
                      <option value="__autre__">✏️ Autre banque…</option>
                    </select>
                  </Field>
                ) : (
                  <Field label="Nom de la banque"><input className={inputCls} value={vers.banque} onChange={(e) => setVers({ ...vers, banque: e.target.value })} placeholder="Ex : Ecobank" /></Field>
                )}
                <Field label="N° du bordereau de versement"><input className={inputCls} value={vers.bordereau} onChange={(e) => setVers({ ...vers, bordereau: e.target.value })} /></Field>
              </>
            )}
            {/* Timo (09/09/2026) : la Note n'apparaît que si le montant versé
                diffère du montant attendu — avec, en rouge, la raison à donner. */}
            {vers.montant !== "" && montantDifferent(vers.montant, attenduVersement) && (
              <div className="sm:col-span-2 lg:col-span-4">
                <div className="text-sm font-bold text-red-600 mb-1">⚠ {messageJustification(attenduVersement)}</div>
                <Field label="Note (justification)"><input className={inputCls} value={vers.note} onChange={(e) => setVers({ ...vers, note: e.target.value })} /></Field>
              </div>
            )}
            <div className="flex items-end"><button onClick={verser} className={btnDark}>💸 Verser</button></div>
          </div>
        )}
        {!ROLES_VERSEMENT.includes(profile.role) && <div className="text-sm text-slate-500">Le versement des fonds est fait par le gérant.</div>}
        <div className="text-xs text-slate-500 mt-2">Chez le DG et BANQUE : validés par le DG. Chez le comptable : pointés « Encaissé » par le comptable. Tant que ce n'est pas validé, le versement reste en attente. Un versement rejeté compte comme jamais versé : l'argent reste dans la caisse de la boutique.{mobileChoisi ? ` « ${DEST_TIROIR} » est le retrait au guichet : l'argent quitte ${mobileChoisi.court} et devient des billets dans le tiroir — aucune validation, et la clôture du soir le verra.` : ""}</div>
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
      {(avances.length > 0 || ROLES_REMB_CAISSE.includes(profile.role)) && (
        <Panel boutique={boutique}>
          <div className="font-bold mb-2 flex items-center gap-2">💼 Avances de frais à rembourser ({avances.length}) <Badge boutique={boutique} /></div>
          {avances.length === 0 && <div className="text-sm text-slate-400">Aucune avance personnelle à rembourser pour {boutique}.</div>}
          <div className="space-y-1">
            {avances.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 flex-wrap rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm">
                <div><b>{d.par}</b> — <b className="text-base tabular-nums">{fmt(d.montant)}</b> — {d.categorie}{d.description ? ` — ${d.description}` : ""}
                  <div className="text-xs text-slate-500">dépense du {dFR(d.date)} · payée de sa poche</div>
                </div>
                <div className="flex gap-1 shrink-0 flex-wrap">
                  {MOYENS_REMBOURSEMENT.map(([code, libelle]) => (
                    <button key={code} onClick={() => rembourser(d, code)} title={libelle}
                      className={`text-xs font-bold rounded px-2 py-1 whitespace-nowrap ${code === "caisse" ? "text-white bg-green-700 hover:bg-green-800" : "text-slate-800 bg-slate-100 border border-slate-300 hover:bg-slate-200"}`}>
                      {code === "caisse" ? "💵 Rembourser en espèces" : code === "salaire" ? "🧾 Avec le salaire" : "👤 Par le DG"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-500 mt-2">En espèces : gérant ou administrateur, la sortie compte dans le tiroir du jour (ce n'est pas une nouvelle charge). Avec le salaire ou par le DG : administrateur. L'employé est prévenu.</div>
        </Panel>
      )}
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
        {depassees.length > 0 && (
          <div className="mb-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-3">
            <div className="font-bold text-amber-900 text-sm mb-1">
              ⚠ {depassees.length} journée{depassees.length > 1 ? "s" : ""} clôturée{depassees.length > 1 ? "s" : ""} dont la caisse a bougé ensuite
            </div>
            <div className="text-xs text-amber-900 mb-2">
              Une vente ou une dépense a été enregistrée APRÈS la clôture : le montant compté ce jour-là ne correspond plus.
              Le solde de la caisse reste juste — c'est la clôture qu'il faut refaire. Clôturez toujours en dernier, à la fermeture.
            </div>
            <div className="flex gap-2 flex-wrap">
              {depassees.map((d) => (
                <button key={d.date} onClick={() => { setJourChoisi(d.date); setCompte(""); }}
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${t === d.date ? "bg-amber-700 text-white border-amber-700" : "bg-white text-amber-800 border-amber-400 hover:bg-amber-100"}`}>
                  {d.date === aujourdhui ? "Aujourd'hui" : dFR(d.date)} · {d.bouge > 0 ? "+" : ""}{fmt(d.bouge)}
                </button>
              ))}
            </div>
          </div>
        )}
        {dejaCloturee && !aReclôturer ? (
          <div className="text-sm font-semibold text-green-700">✓ La caisse du {dFR(t)} a déjà été clôturée.</div>
        ) : (
          <>
            {aReclôturer && (
              <div className="mb-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-bold">🔁 Cette journée est à RECLÔTURER</div>
                <div className="mt-1">{messageClotureDepassee(aReclôturer, fmt, dFR)}</div>
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
              {/* Timo (09/09/2026) : « clôture de caisse, c'est journalier : recette du jour
                  théorique contre montant du tiroir ». La journée se lit de gauche à droite :
                  fonds d'hier soir + recette du jour − sorties justifiées = attendu dans le tiroir.
                  Les dépenses et les versements sont déjà déduits : ils ne créent JAMAIS d'écart. */}
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Dans le tiroir hier soir</div><div className={`font-bold tabular-nums ${fondsHier < 0 ? "text-red-600" : ""}`}>{fmt(fondsHier)}</div><div className="text-[11px] text-slate-400">la recette — le fonds de caisse n'est pas dedans</div></div>
              {/* ⚠ Timo, 15/09/2026 : « pourquoi tu additionnes le fonds de caisse aux
                  ventes ? J'avais dit de ne pas mélanger le fonds de caisse aux ventes. »
                  Le fonds remis par le DG était additionné DANS la case « Recette du
                  jour » : la règle pure ne les a jamais mélangés (recetteDuJour =
                  ventes + encaissements), c'est l'affichage qui mentait. Le fonds a
                  maintenant SA case, à part, et seulement les jours où le DG a
                  réellement remis de l'argent. */}
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Recette du jour (espèces)</div><div className="font-bold tabular-nums text-emerald-700">+ {fmt(recetteDuJour)}</div><div className="text-[11px] text-slate-400">ventes {fmt(especesVentes)} · encaissements {fmt(especesReglements)}</div></div>
              {rembourseAuFonds > 0 && (
                <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Rendu au fonds de caisse</div><div className="font-bold tabular-nums">− {fmt(rembourseAuFonds)}</div><div className="text-[11px] text-slate-400">la recette rembourse ce que le fonds avait avancé</div></div>
              )}
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Sorties justifiées du jour</div><div className="font-bold tabular-nums">− {fmt(sortiesJustifiees)}</div><div className="text-[11px] text-slate-400">dépenses {fmt(especesDepenses)} · versements {fmt(versementsDuJour)} — ne créent pas d'écart</div></div>
              {/* 💼 L'ENVELOPPE, à part : elle n'entre dans aucune des quatre
                  cases ci-dessus (Timo, 15/09/2026, réponse B). */}
              {fondsPlafond > 0 && (
                <div className="bg-white rounded-lg p-3 border border-amber-300" data-carte="enveloppe-fonds"><div className="text-xs text-slate-500">💼 Fonds de caisse (gardé à part)</div><div className={`font-bold tabular-nums ${fondsEntame > 0 ? "text-amber-700" : ""}`}>{fmt(fondsReste)}</div><div className="text-[11px] text-slate-400">{fondsIntact ? "intact" : `entamé de ${fmt(fondsEntame)}`} · PAS dans le tiroir{depensesSurFonds > 0 ? ` · ${fmt(depensesSurFonds)} pris dessus ce jour-là` : ""}{fondsRemisDuJour > 0 ? ` · ${fmt(fondsRemisDuJour)} remis par le DG` : ""}</div></div>
              )}
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
            {rejets.length > 0 && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <b>✖ Dépenses rejetées par le DG ce jour-là : {fmt(rejets.reduce((s, r) => s + r.montant, 0))}</b> — {rejets.map((r) => `${fmt(r.montant)} (${r.categorie}, ${r.par} : ${r.motif})`).join(" ; ")}.
                <div className="text-xs mt-1">L'argent était sorti du tiroir : ce manque est attendu dans l'écart, et il est dû par la personne qui l'a saisi.</div>
              </div>
            )}
            {blocageCloture && (
              <div className="mb-3 rounded-lg border-2 border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800">{blocageCloture}</div>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Libellés COURTS (Timo, 14/09/2026 : « trop de commentaire »
                  dans le libellé du montant du tiroir, et la ligne des
                  remarques trop longue) : deux cases de même largeur, la
                  remarque grandit avec le texte. */}
              <Field label="Montant du tiroir"><input type="number" className={inputCls} value={compte} onChange={(e) => setCompte(e.target.value)} /></Field>
              <Field label="Remarques"><ChampQuiGrandit valeur={notes} onChange={setNotes} placeholder="Ex : Monnaie rendue…" /></Field>
            </div>
            {alerteRecette && <div className="mt-2 text-sm font-bold text-red-600">{alerteRecette}</div>}
            {/* 💼 L'ENVELOPPE (Timo, 15/09/2026 : « tout de suite… mais on
                informe lors de la clôture de la caisse »). Elle n'est PAS dans
                le tiroir et n'entre dans aucun total ci-dessus. Intacte, on la
                rappelle ; ENTAMÉE, on la fait compter — c'est la seule fois où
                elle est vérifiée. */}
            {fondsPlafond > 0 && (
              <div className={`mt-3 rounded-lg border p-3 ${fondsIntact ? "border-slate-200 bg-slate-50" : "border-amber-300 bg-amber-50"}`} data-cloture="enveloppe">
                <div className="text-sm font-bold text-slate-800">💼 Fonds de caisse — l'enveloppe, à part du tiroir</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {fondsIntact
                    ? <>Elle est intacte : il doit y avoir <b className="tabular-nums">{fmt(fondsReste)}</b>. Elle n'entre dans aucun calcul ci-dessus.</>
                    : <>Elle a été entamée de <b className="tabular-nums">{fmt(fondsEntame)}</b> : il devrait y rester <b className="tabular-nums">{fmt(fondsReste)}</b> sur {fmt(fondsPlafond)}. Les prochaines recettes la rembourseront toutes seules.</>}
                </div>
                {(depensesSurFonds > 0 || rembourseAuFonds > 0) && (
                  <div className="text-xs text-slate-500 mt-1" data-cloture="enveloppe-jour">
                    Ce jour-là :{depensesSurFonds > 0 ? <> <b className="tabular-nums text-amber-800">− {fmt(depensesSurFonds)}</b> pris dans l'enveloppe</> : null}
                    {depensesSurFonds > 0 && rembourseAuFonds > 0 ? " ·" : null}
                    {rembourseAuFonds > 0 ? <> <b className="tabular-nums text-emerald-700">+ {fmt(rembourseAuFonds)}</b> restitués par les recettes</> : null}
                  </div>
                )}
              </div>
            )}
            <button onClick={cloturer} disabled={!!blocageCloture} className={`mt-3 ${btnDark}${blocageCloture ? " opacity-50 cursor-not-allowed" : ""}`}>Clôturer la caisse</button>
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
      </>)}
    </div>
  );
}

// ============ DEMANDE DE RAVITAILLEMENT (côté boutique) ============
