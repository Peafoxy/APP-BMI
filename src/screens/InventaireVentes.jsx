// ============================================================
// screens/InventaireVentes.jsx — 📋 L'INVENTAIRE DE 💰 VENTES
//
// Timo (10/10/2026, « A a, B a, C a, D a, lance ») : dans 💰 Ventes, deux
// boutons — 🛒 Vendre (l'écran d'avant) et 📋 Inventaire (celui-ci), pour le
// gérant et l'administrateur. Une boutique (la regardée), une période
// (« Aujourd'hui » d'office), et sept blocs : ventes, recettes, dépenses,
// versements, caisse, dettes, comptage. PDF et export.
//
// ⚠ Aucun chiffre n'est calculé ici : tout vient de `inventaireVentes`
// (lib/inventaireVentes.js), qui reprend les règles de 🔒 Caisse, de la
// clôture du jour, de 📤 Dépenses et de 📋 Dettes. L'écran ne fait qu'afficher.
// ============================================================
import { fmt, dFR, today, totalVente } from "../lib/core";
import { LOGO, libelleCaisse } from "../lib/constants";
import { inventaireVentes, lignesCsvInventaire, LIBELLE_ETAT_VERSEMENT } from "../lib/inventaireVentes";
import { useFiltrePeriode } from "../components/FiltrePeriode";
import { btnDark } from "../components/ui";
import { exportCSV } from "../lib/export";
import { genererInventaire } from "../pdf";

const cadre = "rounded-xl border border-slate-200 bg-white p-3";
const titre = "font-bold text-slate-800 mb-1";
const note = "text-xs text-slate-500";
const ligneTable = "border-b border-slate-100";
const montant = "py-1 pl-3 text-right tabular-nums whitespace-nowrap";

function Tableau({ entetes, lignes, pied = null, vide = "Rien sur cette période." }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-200">
            {entetes.map(([t, droite], i) => <th key={i} className={`py-1 pr-2 font-semibold ${droite ? "text-right" : "text-left"}`}>{t}</th>)}
          </tr>
        </thead>
        <tbody>
          {lignes.length === 0 && <tr><td colSpan={entetes.length} className="py-2 text-slate-500">{vide}</td></tr>}
          {lignes}
        </tbody>
        {pied && <tfoot>{pied}</tfoot>}
      </table>
    </div>
  );
}

export function InventaireVentes({ db, boutique }) {
  // « B a » : Aujourd'hui d'office (index 0 des périodes toutes faites).
  const periode = useFiltrePeriode({ initial: 0 });
  const auj = today();
  const inv = inventaireVentes(db, boutique, totalVente, periode.bornes, auj);
  const libellePeriode = periode.libelle || "Toute période";
  const formation = !!(db.boutiques || []).find((b) => b.nom === boutique)?.formation;
  const { ventes, recettes, depenses, versements, caisse, dettes, comptage } = inv;

  const imprimer = () => genererInventaire(inv, { boutique: libelleCaisse(boutique), periode: libellePeriode, logo: LOGO, formation, edite: dFR(auj) });
  const exporter = () => exportCSV(`inventaire_${String(boutique).toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    ["Rubrique", "Libellé", "Nombre", "Montant"], lignesCsvInventaire(inv, dFR), libellePeriode.replace(/\s+/g, "_"));

  return (
    <div className="space-y-3" data-inventaire>
      <div className={cadre}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-bold text-slate-800">📋 Inventaire — {libelleCaisse(boutique)}</div>
            <div className={note}>Période : <b data-inventaire-periode>{libellePeriode}</b>. Une lecture : rien n'est écrit. Les chiffres sont ceux de 🔒 Caisse, 📤 Dépenses et 📋 Dettes.</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={imprimer} className={btnDark} data-inventaire-pdf>🖨 Imprimer (PDF)</button>
            <button onClick={exporter} className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50">Exporter (CSV)</button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center mt-2">{periode.selecteur}</div>
      </div>

      {/* 1. Les ventes */}
      <div className={cadre} data-inv-ventes>
        <div className={titre}>1. Les ventes — tous moyens de paiement</div>
        <div className={note}>Ce qui a été VENDU dans la boutique, crédit compris.</div>
        <Tableau entetes={[["Moyen"], ["Ventes", true], ["Montant", true]]}
          lignes={ventes.lignes.map((l) => (
            <tr key={l.moyen} className={ligneTable}><td className="py-1 pr-2">{l.moyen}</td><td className={montant}>{l.nb}</td><td className={montant}>{fmt(l.montant)}</td></tr>
          ))}
          pied={<>
            <tr className="font-bold"><td className="py-1 pr-2">Total vendu</td><td className={montant}>{ventes.nb}</td><td className={montant} data-inv-total-vendu>{fmt(ventes.total)}</td></tr>
            {ventes.reprises.nb > 0 && <tr className="text-amber-800"><td className="py-1 pr-2">↩ Reprises faites dans la période</td><td className={montant}>{ventes.reprises.nb}</td><td className={montant}>− {fmt(ventes.reprises.montant)}</td></tr>}
            {ventes.reprises.nb > 0 && <tr className="font-bold"><td className="py-1 pr-2">Net</td><td /><td className={montant}>{fmt(ventes.net)}</td></tr>}
          </>} vide="Aucune vente sur cette période." />
        {ventes.chantier.nb > 0 && (
          <div className="text-xs text-slate-600 mt-1" data-inv-ventes-chantier>
            🏗 Dont {ventes.chantier.nb} vente{ventes.chantier.nb > 1 ? "s" : ""} issue{ventes.chantier.nb > 1 ? "s" : ""} d'un devis ({fmt(ventes.chantier.montant)}) : leur argent va dans la caisse 🏗 CHANTIER, pas dans le tiroir de la boutique.
          </div>
        )}
      </div>

      {/* 2. Les recettes */}
      <div className={cadre} data-inv-recettes>
        <div className={titre}>2. Les recettes — l'argent entré dans la caisse</div>
        <div className={note}>Ventes payées + règlements de dettes. Une vente à crédit n'y entre que par ce que le client a versé.</div>
        <Tableau entetes={[["Moyen"], ["Ventes payées", true], ["Règlements de dettes", true], ["Total", true]]}
          lignes={recettes.lignes.map((l) => (
            <tr key={l.moyen} className={ligneTable}><td className="py-1 pr-2">{l.moyen}</td><td className={montant}>{fmt(l.ventes)}</td><td className={montant}>{fmt(l.reglements)}</td><td className={`${montant} font-semibold`}>{fmt(l.total)}</td></tr>
          ))}
          pied={<tr className="font-bold"><td className="py-1 pr-2">Total des recettes</td><td className={montant}>{fmt(recettes.ventes)}</td><td className={montant}>{fmt(recettes.reglements)}</td><td className={montant} data-inv-total-recettes>{fmt(recettes.total)}</td></tr>}
          vide="Aucune recette sur cette période." />
      </div>

      {/* 3. Les dépenses */}
      <div className={cadre} data-inv-depenses>
        <div className={titre}>3. Les dépenses — par catégorie</div>
        <div className={note}>Seules les dépenses qui comptent : ni en attente du DG, ni rejetées. Les versements ont leur bloc.</div>
        <Tableau entetes={[["Catégorie"], ["Nombre", true], ["Montant", true]]}
          lignes={depenses.lignes.map((l) => (
            <tr key={l.categorie} className={ligneTable}><td className="py-1 pr-2">{l.categorie}</td><td className={montant}>{l.nb}</td><td className={montant}>{fmt(l.montant)}</td></tr>
          ))}
          pied={<tr className="font-bold"><td className="py-1 pr-2">Total des dépenses</td><td className={montant}>{depenses.nb}</td><td className={montant} data-inv-total-depenses>{fmt(depenses.total)}</td></tr>}
          vide="Aucune dépense sur cette période." />
        {depenses.total > 0 && <div className="text-xs text-slate-600 mt-1">Dont payées par le tiroir (espèces) : <b className="tabular-nums">{fmt(depenses.duTiroir)}</b> — le reste a été payé ailleurs (avance personnelle, caisse du DG, comptable, compte mobile…).</div>}
        {depenses.enAttente.nb > 0 && <div className="text-xs text-amber-800 mt-1" data-inv-depenses-attente>⏳ En attente du DG, pas comptées : {depenses.enAttente.nb} dépense{depenses.enAttente.nb > 1 ? "s" : ""}, {fmt(depenses.enAttente.montant)}.</div>}
        {depenses.rejetees.nb > 0 && <div className="text-xs text-slate-500 mt-1">✖ Rejetées par le DG, pas comptées : {depenses.rejetees.nb} ({fmt(depenses.rejetees.montant)}).</div>}
        {depenses.autres.lignes.length > 0 && (
          <div className="mt-2">
            <div className="text-xs font-bold text-slate-600">Autres sorties d'argent — pas des charges</div>
            <Tableau entetes={[["Catégorie"], ["Nombre", true], ["Montant", true]]}
              lignes={depenses.autres.lignes.map((l) => (
                <tr key={l.categorie} className={ligneTable}><td className="py-1 pr-2">{l.categorie}</td><td className={montant}>{l.nb}</td><td className={montant}>{fmt(l.montant)}</td></tr>
              ))} />
          </div>
        )}
      </div>

      {/* 4. Les versements */}
      <div className={cadre} data-inv-versements>
        <div className={titre}>4. Les versements de la période</div>
        <Tableau entetes={[["Date"], ["Vers"], ["État"], ["Montant", true]]}
          lignes={versements.lignes.map((v) => (
            <tr key={v.id} className={`${ligneTable} ${v.etat === "rejete" ? "text-slate-400" : ""}`}>
              <td className="py-1 pr-2 whitespace-nowrap">{dFR(v.date)}{v.heure ? ` ${v.heure}` : ""}</td>
              <td className="py-1 pr-2">{v.destination}{v.aPart ? " · 💸 d'une vente ou d'un règlement" : ""}{v.source !== "Espèces" ? ` · depuis ${v.source}` : ""}{v.par ? ` · par ${v.par}` : ""}</td>
              <td className="py-1 pr-2 whitespace-nowrap">{LIBELLE_ETAT_VERSEMENT[v.etat]}</td>
              <td className={montant}>{fmt(v.montant)}</td>
            </tr>
          ))}
          pied={<tr className="font-bold"><td className="py-1 pr-2" colSpan={3}>Total versé (rejetés exclus){versements.enAttente > 0 ? ` — dont ${fmt(versements.enAttente)} en attente de validation` : ""}</td><td className={montant} data-inv-total-verse>{fmt(versements.total)}</td></tr>}
          vide="Aucun versement sur cette période." />
      </div>

      {/* 5. La caisse */}
      <div className={cadre} data-inv-caisse>
        <div className={titre}>5. La caisse</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Dans le tiroir maintenant</div><div className="font-bold tabular-nums" data-inv-tiroir>{fmt(caisse.tiroir)}</div><div className="text-xs text-slate-500">= « Fonds à verser » de 🔒 Caisse</div></div>
          {caisse.fondsPlafond > 0 && <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">💼 Enveloppe du fonds de caisse</div><div className="font-bold tabular-nums">{fmt(caisse.enveloppe)}</div><div className="text-xs text-slate-500">sur {fmt(caisse.fondsPlafond)}, à part du tiroir</div></div>}
          {caisse.mobiles.map((m) => (
            <div key={m.libelle} className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">📱 Solde {m.libelle}</div><div className="font-bold tabular-nums">{fmt(m.solde)}</div><div className="text-xs text-slate-500">{m.numero ? `n° ${m.numero}` : "d'après les saisies"}</div></div>
          ))}
        </div>
        <div className="mt-2 text-sm" data-inv-tiroir-periode>
          <div className="text-xs font-bold text-slate-600">Le tiroir pendant la période</div>
          <table className="w-full text-sm"><tbody>
            <tr className={ligneTable}><td className="py-1">Dans le tiroir la veille au soir</td><td className={montant}>{fmt(caisse.periode.debut)}</td></tr>
            <tr className={ligneTable}><td className="py-1">+ Entrées en espèces</td><td className={`${montant} text-emerald-700`}>+ {fmt(caisse.periode.entrees)}</td></tr>
            {caisse.periode.renduEnveloppe > 0 && <tr className={ligneTable}><td className="py-1">− Retourné dans l'enveloppe du fonds de caisse</td><td className={montant}>− {fmt(caisse.periode.renduEnveloppe)}</td></tr>}
            <tr className={ligneTable}><td className="py-1">− Dépenses payées par le tiroir</td><td className={montant}>− {fmt(caisse.periode.depenses)}</td></tr>
            <tr className={ligneTable}><td className="py-1">− Versements</td><td className={montant}>− {fmt(caisse.periode.versements)}</td></tr>
            <tr className="font-bold"><td className="py-1">Dans le tiroir le soir du {dFR(caisse.periode.jusquau)}</td><td className={montant} data-inv-tiroir-fin>{fmt(caisse.periode.fin)}</td></tr>
          </tbody></table>
          {caisse.periode.depensesSurEnveloppe > 0 && <div className={note}>💼 {fmt(caisse.periode.depensesSurEnveloppe)} de dépenses ont été pris dans l'enveloppe (pas dans le tiroir).</div>}
        </div>
      </div>

      {/* 6. Les dettes */}
      <div className={cadre} data-inv-dettes>
        <div className={titre}>6. Les dettes</div>
        <table className="w-full text-sm"><tbody>
          <tr className={ligneTable}><td className="py-1">Créées dans la période</td><td className={montant}>{dettes.creees.nb}</td><td className={montant}>{fmt(dettes.creees.montant)}</td></tr>
          <tr className={ligneTable}><td className="py-1">Règlements reçus dans la période</td><td className={montant}>{dettes.reglees.nb}</td><td className={montant}>{fmt(dettes.reglees.montant)}</td></tr>
          <tr className={`${ligneTable} font-bold`}><td className="py-1">Reste total à recouvrer (toutes périodes)</td><td className={montant}>{dettes.reste.nb}</td><td className={`${montant} text-orange-700`} data-inv-reste-dettes>{fmt(dettes.reste.montant)}</td></tr>
          <tr className={ligneTable}><td className="py-1 text-red-700">⚠ En retard (plus de 30 jours)</td><td className={montant}>{dettes.retard.nb}</td><td className={`${montant} text-red-700`}>{fmt(dettes.retard.montant)}</td></tr>
          {dettes.reservations.nb > 0 && <tr className={ligneTable}><td className="py-1">Réservations en cours (reste)</td><td className={montant}>{dettes.reservations.nb}</td><td className={montant}>{fmt(dettes.reservations.montant)}</td></tr>}
        </tbody></table>
        {dettes.chantier.nb > 0 && <div className="text-xs text-slate-600 mt-1">🏗 Dont {dettes.chantier.nb} dette{dettes.chantier.nb > 1 ? "s" : ""} de devis ({fmt(dettes.chantier.montant)}) : leurs règlements entrent dans la caisse 🏗 CHANTIER.</div>}
        {dettes.retard.lignes.length > 0 && (
          <div className="mt-2">
            <div className="text-xs font-bold text-red-700">Dettes en retard</div>
            <Tableau entetes={[["Client"], ["Depuis le"], ["Jours", true], ["Reste", true]]}
              lignes={dettes.retard.lignes.map((d) => (
                <tr key={d.id} className={ligneTable}><td className="py-1 pr-2">{d.client || "—"}{d.numero ? <span className="text-xs text-slate-500"> · {d.numero}</span> : null}</td><td className="py-1 pr-2">{dFR(d.date)}</td><td className={montant}>{d.jours}</td><td className={`${montant} text-red-700`}>{fmt(d.reste)}</td></tr>
              ))} />
          </div>
        )}
      </div>

      {/* 7. Le comptage */}
      <div className={cadre} data-inv-comptage>
        <div className={titre}>7. Le comptage — ce qui a été compté aux clôtures</div>
        <div className={note}>Le vendeur compte les billets à la clôture du jour (🔒 Caisse). On compare ici ce qu'il a compté à ce que le tiroir devait contenir ce soir-là.</div>
        <Tableau entetes={[["Jour"], ["Attendu", true], ["Compté", true], ["Écart", true]]}
          lignes={comptage.lignes.map((l) => (
            <tr key={l.date} className={`${ligneTable} ${l.statut === "non_cloture" ? "bg-red-50" : ""}`} data-inv-jour={l.date}>
              <td className="py-1 pr-2 whitespace-nowrap">{dFR(l.date)}{l.par ? <span className="text-xs text-slate-500"> · {l.par}</span> : null}</td>
              <td className={montant}>{fmt(l.attendu)}</td>
              <td className={montant}>{l.statut === "cloture" ? fmt(l.compte) : (l.statut === "aujourdhui" ? <span className="text-slate-500">pas encore clôturé</span> : <span className="text-red-700 font-bold">non clôturé</span>)}</td>
              <td className={`${montant} ${l.statut !== "cloture" ? "" : Math.round(l.ecart) === 0 ? "text-emerald-700" : "text-red-700 font-bold"}`}>
                {l.statut === "cloture" ? `${l.ecart > 0 ? "+ " : ""}${fmt(l.ecart)}` : ""}
                {l.bouge && <div className="text-xs text-amber-700 font-normal">⚠ la caisse a bougé après la clôture (on attendait {fmt(l.attenduALaCloture)})</div>}
              </td>
            </tr>
          ))}
          pied={<tr className="font-bold"><td className="py-1 pr-2" colSpan={3}>Total des écarts ({comptage.nbClotures} clôture{comptage.nbClotures > 1 ? "s" : ""})</td><td className={`${montant} ${Math.round(comptage.totalEcarts) === 0 ? "text-emerald-700" : "text-red-700"}`} data-inv-total-ecarts>{comptage.totalEcarts > 0 ? "+ " : ""}{fmt(comptage.totalEcarts)}</td></tr>}
          vide="Aucune journée de caisse sur cette période." />
        {comptage.nonClotures.length > 0 && <div className="text-xs text-red-700 mt-1" data-inv-non-clotures>🔒 Journées non clôturées : {comptage.nonClotures.map(dFR).join(", ")}. Personne n'a compté le tiroir ces jours-là.</div>}
        {comptage.aBouge.length > 0 && <div className="text-xs text-amber-700 mt-1">⚠ Clôtures à refaire (la caisse a bougé après) : {comptage.aBouge.map(dFR).join(", ")} — 🔒 Caisse les propose.</div>}
        <div className={`${note} mt-1`}>Un écart négatif = il manquait de l'argent dans le tiroir ; positif = il y en avait trop. Le fonds de caisse (l'enveloppe) n'est jamais compté.</div>
      </div>
    </div>
  );
}
