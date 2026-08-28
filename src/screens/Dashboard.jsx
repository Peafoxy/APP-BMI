// ============================================================
// screens/Dashboard.jsx — Tableau de bord (Admin/Comptable).
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState, useCallback } from "react";
import { fmt, today, dFR, inP, col, totalVente, caVente, lignesVente, qteVente, resumeArticles, lignesJournal, numeroRecu } from "../lib/core";
import { btnDark, Badge, Stat } from "../components/ui";
import { exportCSV } from "../lib/export";
import {
  stockVendu, stockAjuste, stockActuel, commissionVente, estChefEquipe, TAUX_EQUIPE_DEFAUT,
  dettesClassiques, estReservation, periodes, reservations,
  filtreEspaceAffichage, afficheChiffresFormation, boutiqueDuChantier, voitLesDeuxEspaces, boutiquesFormation } from "../lib/calculs";

// ============ TABLEAU DE BORD ============
export function Dashboard({ db, profile }) {
  // ⚠ TERRAIN (encaissements de terrain) ET les boutiques de FORMATION
  // (demande Timo — un nouveau commercial doit pouvoir s'entraîner sans
  // jamais fausser les vrais chiffres) sont exclues du tableau de bord.
  // ⚠ Cloisonnement : cet écran excluait la formation « en dur », sans
  // regarder QUI le consulte — un compte de formation y voyait donc le
  // vrai chiffre d'affaires de l'entreprise. `dansMonEspace` renvoie les
  // chiffres de FORMATION à un compte de formation, et les vrais à tous
  // les autres (dont l'admin principal, pour qui c'est bien la vue
  // attendue). Le bandeau ci-dessous le rappelle à l'écran.
  // ⚠ Consulter volontairement les chiffres d'entraînement — demande de
  // Timo, une fois la fuite corrigée. Réservé aux comptes qui voient les
  // deux espaces (l'administrateur principal), et jamais actif au départ.
  const [voirFormation, setVoirFormation] = useState(false);
  const peutBasculerEspace = voitLesDeuxEspaces(db, profile) && boutiquesFormation(db).size > 0;
  const enFormation = afficheChiffresFormation(db, profile, voirFormation);
  const dansMonEspace = filtreEspaceAffichage(db, profile, voirFormation);
  const NOMS = db.boutiques.filter((b) => !b.terrain && !!b.formation === enFormation).map((b) => b.nom);
  // ⚠ Suite complémentaire de la même exclusion (Timo — audit "CA réel") :
  // NOMS protège déjà les tableaux PAR boutique ci-dessous, mais plusieurs
  // TOTAUX GLOBAUX de cette page (CA total, frais, nb clients, commissions,
  // export du journal comptable) parcouraient db.ventes BRUT, sans jamais
  // passer par NOMS — trou réel trouvé, une vente de formation aurait
  // gonflé ces chiffres. Variable UNIQUE réutilisée pour tous ces totaux.
  const ventesReellesDb = (db.ventes || []).filter(dansMonEspace);
  const depensesReellesDb = (db.depenses || []).filter(dansMonEspace);
  const dettesReellesDb = (db.dettes || []).filter(dansMonEspace);
  const produitsReelsDb = (db.produits || []).filter(dansMonEspace);
  const chantiersReelsDb = (db.clients_installes || []).filter((c) => dansMonEspace({ boutique: boutiqueDuChantier(db, c) }));
  // ⚠ Même exclusion pour les DETTES/réservations (pas seulement les
  // ventes) : filtrée ICI, dans les totaux globaux du Tableau de bord
  // uniquement — les fonctions partagées dettesClassiques()/reservations()
  // restent volontairement INCHANGÉES, elles sont aussi utilisées par
  // l'écran Dettes lui-même, où une boutique de formation doit continuer
  // à voir SES PROPRES dettes normalement quand on la sélectionne.
  const dettesReellesDashboard = dettesClassiques(db).filter(dansMonEspace);
  const reservationsReellesDashboard = reservations(db).filter(dansMonEspace);
  const [periodeIndex, setPeriodeIndex] = useState(2);
  const [customDebut, setCustomDebut] = useState("");
  const [customFin, setCustomFin] = useState("");

  const getPeriod = useCallback(() => {
    if (periodeIndex === "custom") {
      return ["Personnalisée", customDebut || today(), customFin || today()];
    }
    return periodes()[periodeIndex] || periodes()[2];
  }, [periodeIndex, customDebut, customFin]);

  const rows = periodes().map(([label, a, b]) => {
    const v = {}, d = {};
    NOMS.forEach((bq) => {
      v[bq] = db.ventes.filter((x) => x.boutique === bq && inP(x.date, a, b)).reduce((s, x) => s + caVente(x), 0);
      d[bq] = db.depenses.filter((x) => x.boutique === bq && inP(x.date, a, b)).reduce((s, x) => s + Number(x.montant), 0);
    });
    return { label, v, d };
  });

  const customRow = (() => {
    const [label, a, b] = getPeriod();
    const v = {}, d = {};
    NOMS.forEach((bq) => {
      v[bq] = db.ventes.filter((x) => x.boutique === bq && inP(x.date, a, b)).reduce((s, x) => s + caVente(x), 0);
      d[bq] = db.depenses.filter((x) => x.boutique === bq && inP(x.date, a, b)).reduce((s, x) => s + Number(x.montant), 0);
    });
    return { label, v, d };
  })();

  const dettes = {}, alertes = {}, valA = {}, valV = {};
  NOMS.forEach((b) => {
    // Les réservations prépayées ne sont PAS des créances : le client n'a rien reçu.
    dettes[b] = dettesClassiques(db).filter((x) => x.boutique === b).reduce((s, x) => s + Math.max(0, x.montant - x.paye), 0);
    const ps = db.produits.filter((p) => p.boutique === b);
    alertes[b] = ps.filter((p) => stockActuel(db, p) <= Number(p.seuil)).length;
    valA[b] = ps.reduce((s, p) => s + stockActuel(db, p) * Number(p.prix_achat), 0);
    valV[b] = ps.reduce((s, p) => s + stockActuel(db, p) * Number(p.prix_vente), 0);
  });

  const somme = (obj) => NOMS.reduce((s, b) => s + (obj[b] || 0), 0);
  const m = rows[2];
  const resM = somme(m.v) - somme(m.d);
  const resCustom = somme(customRow.v) - somme(customRow.d);

  const totalVentes = ventesReellesDb.reduce((s, v) => s + caVente(v), 0); // chiffre d'affaires (exclut HB / déjà comptés)
  // ⚠ Oubli de l'exclusion 2.100.16 : ce total parcourait db.depenses BRUT
  // alors que le CA juste au-dessus, lui, excluait déjà la formation — le
  // « résultat » affiché retranchait donc des dépenses d'entraînement d'un
  // chiffre d'affaires dont l'entraînement avait été retiré.
  const totalDepenses = depensesReellesDb.reduce((s, d) => s + Number(d.montant), 0);
  const totalDettes = dettesReellesDashboard.reduce((s, d) => s + Math.max(0, d.montant - d.paye), 0);
  // Frais d'installation et transport réellement encaissés — jamais comptés
  // dans le chiffre d'affaires (ci-dessus), mais bien réels : cette carte est
  // le seul endroit où les retrouver globalement, tous devis confondus.
  const totalFraisInstallation = ventesReellesDb.reduce((s, v) => s + Number(v.frais_installation || 0), 0);
  const totalFraisTransport = ventesReellesDb.reduce((s, v) => s + Number(v.frais_transport || 0), 0);
  // Avances encaissées sur réservations non encore livrées : c'est de l'argent reçu
  // que l'entreprise DOIT en marchandise. C'est un engagement, pas une créance.
  const totalAvances = reservationsReellesDashboard.filter((r) => r.statut !== "livree" && r.statut !== "annulee")
    .reduce((s, r) => s + Number(r.paye || 0), 0);
  const nbVentes = ventesReellesDb.length;
  const nbClients = new Set(ventesReellesDb.filter(v => v.client).map(v => v.client)).size;

  // ---- ENSEMBLE DES COMMISSIONS (rien n'était affiché ici auparavant) ----
  // On regroupe les 4 types de commission existants dans l'app : commission de
  // base (commercial/technicien), commission d'équipe (chef sur ses filleuls),
  // commission d'apporteur externe, et prime d'installation.
  const commissionsBase = (payee) => ventesReellesDb.filter((v) => Boolean(v.commission_payee) === payee)
    .reduce((s, v) => {
      const u = db.users.find((x) => x.nom === v.commercial);
      return s + commissionVente(v, Number(u?.taux_commission || 0));
    }, 0);
  const commissionsEquipe = (payee) => ventesReellesDb.filter((v) => Boolean(v.override_payee) === payee)
    .reduce((s, v) => {
      const vendeur = db.users.find((x) => x.nom === v.commercial);
      const chef = vendeur?.parrain_id ? db.users.find((x) => x.id === vendeur.parrain_id) : null;
      if (!chef || !estChefEquipe(db, chef)) return s;
      const tauxEq = Number(chef.taux_equipe ?? TAUX_EQUIPE_DEFAUT);
      return s + Math.round((commissionVente(v, Number(vendeur.taux_commission || 0)) * tauxEq) / 100);
    }, 0);
  const commissionsApporteurs = (payee) => ventesReellesDb.filter((v) => v.apporteur && Boolean(v.apporteur.payee) === payee)
    .reduce((s, v) => s + Number(v.apporteur.montant || 0), 0);
  // ⚠ Même oubli que totalDepenses : les primes d'installation d'un
  // chantier d'entraînement gonflaient les commissions dues et payées.
  const commissionsInstallation = (payee) => chantiersReelsDb.flatMap((c) => c.equipe || [])
    .filter((e) => Boolean(e.paye) === payee).reduce((s, e) => s + Number(e.montant || 0), 0);
  const totalCommissionsDues = commissionsBase(false) + commissionsEquipe(false) + commissionsApporteurs(false) + commissionsInstallation(false);
  const totalCommissionsPayees = commissionsBase(true) + commissionsEquipe(true) + commissionsApporteurs(true) + commissionsInstallation(true);

  // ⚠ Le composant et son code couleur vivent dans components/ui.jsx :
  // les sept écrans le partagent, pour que « bleu » veuille dire la même
  // chose partout.
  const moisNoms = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  const mois6 = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const vals = {};
    NOMS.forEach((b) => {
      vals[b] = db.ventes.filter((x) => x.boutique === b && String(x.date).slice(0, 7) === key).reduce((s, x) => s + caVente(x), 0);
    });
    mois6.push({ nom: moisNoms[d.getMonth()], vals });
  }
  const maxV = Math.max(1, ...mois6.flatMap((x) => NOMS.map((b) => x.vals[b])));

  // Analyses sur la période sélectionnée
  const [, paG, pbG] = getPeriod();
  const ventesPeriode = ventesReellesDb.filter((v) => inP(v.date, paG, pbG));
  const topProduits = (() => {
    const cumul = {};
    ventesPeriode.forEach((v) => lignesVente(v).forEach((l) => { if (l.hors_boutique) return; cumul[l.article] = (cumul[l.article] || 0) + Number(l.qte) * Number(l.pu) - Number(l.remise_ligne || 0); }));
    return Object.entries(cumul).sort((x, y) => y[1] - x[1]).slice(0, 5);
  })();
  const maxTop = Math.max(1, ...topProduits.map((x) => x[1]));
  const repPaiements = (() => {
    const cumul = {};
    ventesPeriode.forEach((v) => { const k = v.paiement || "Autre"; cumul[k] = (cumul[k] || 0) + totalVente(v); });
    return Object.entries(cumul).sort((x, y) => y[1] - x[1]);
  })();
  const totalPai = Math.max(1, repPaiements.reduce((s, x) => s + x[1], 0));

  return (
    <div className="space-y-5">
      {/* ⚠ SÉLECTEUR RÉSERVÉ À QUI VOIT LES DEUX ESPACES (l'administrateur
          principal). Il n'est JAMAIS actif par défaut : on ne doit pas
          ouvrir l'application et lire des chiffres fictifs en les croyant
          vrais. Et il n'apparaît pas s'il n'y a aucune boutique
          d'entraînement — un bouton qui ne sert à rien est du bruit. */}
      {peutBasculerEspace && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chiffres affichés :</span>
          <button onClick={() => setVoirFormation(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${!voirFormation ? "bg-sky-800 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
            Réels
          </button>
          <button onClick={() => setVoirFormation(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${voirFormation ? "bg-violet-700 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
            🎓 Entraînement
          </button>
        </div>
      )}
      {enFormation && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3">
          <div className="font-bold text-amber-900">🎓 Chiffres de l'espace FORMATION</div>
          <div className="text-xs text-amber-800 mt-0.5">
            Votre compte travaille en formation : ce tableau de bord ne montre que les boutiques d'entraînement.
            Les chiffres réels de l'entreprise ne vous sont pas accessibles.
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total des ventes" value={fmt(totalVentes)} nature="entree" />
        <Stat label="Total des dépenses" value={fmt(totalDepenses)} nature="sortie" />
        <Stat label="Total des dettes" value={fmt(totalDettes)} nature="du" />
        <Stat label="Commissions dues (non payées)" value={fmt(totalCommissionsDues)} nature="du" />
        <Stat label="Commissions déjà payées" value={fmt(totalCommissionsPayees)} nature="regle" />
        {(totalFraisInstallation + totalFraisTransport) > 0 && (
          <Stat label="Frais d'installation/transport encaissés" value={fmt(totalFraisInstallation + totalFraisTransport)} nature="entree" />
        )}
        {totalAvances > 0 && <Stat label="Avances clients à livrer" value={fmt(totalAvances)} nature="attente" />}
        <Stat label="Clients uniques" value={nbClients} nature="neutre" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="font-bold text-slate-800">Période :</div>
          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
            value={periodeIndex}
            onChange={(e) => setPeriodeIndex(e.target.value === "custom" ? "custom" : Number(e.target.value))}
          >
            {periodes().map(([label], i) => (
              <option key={i} value={i}>{label}</option>
            ))}
            <option value="custom">Personnalisée</option>
          </select>

          {periodeIndex === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                value={customDebut}
                onChange={(e) => setCustomDebut(e.target.value)}
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                value={customFin}
                onChange={(e) => setCustomFin(e.target.value)}
              />
            </div>
          )}

          {periodeIndex === "custom" && (
            <div className="ml-auto text-sm font-semibold">
              Résultat : <span className={resCustom >= 0 ? "text-green-700" : "text-red-600"}>{fmt(resCustom)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Ventes du mois" value={fmt(somme(m.v))} nature="entree" />
        <Stat label="Dépenses du mois" value={fmt(somme(m.d))} nature="sortie" />
        <Stat label="Résultat du mois" value={fmt(resM)} nature={resM >= 0 ? "regle" : "du"} />
        <Stat label="Dettes en cours" value={fmt(somme(dettes))} nature="du" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="font-bold text-slate-800">Ventes des 6 derniers mois</div>
          <div className="flex gap-3 text-xs font-semibold flex-wrap">
            {NOMS.map((b) => (
              <span key={b} className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: col(b) }}></span>{b}</span>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-2 h-40">
          {mois6.map((x) => (
            <div key={x.nom} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-1 h-32">
                {NOMS.map((b) => (
                  <div key={b} className="rounded-t" title={`${b} : ${fmt(x.vals[b])}`}
                    style={{ width: `${Math.max(8, 30 / NOMS.length)}%`, backgroundColor: col(b), height: `${(x.vals[b] / maxV) * 100}%`, minHeight: x.vals[b] ? 3 : 0 }}></div>
                ))}
              </div>
              <div className="text-xs font-semibold text-slate-500">{x.nom}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="font-bold text-slate-800 mb-3">🏆 Top 5 des produits (période sélectionnée)</div>
          {topProduits.length === 0 && <div className="text-sm text-slate-400">Aucune vente sur cette période.</div>}
          <div className="space-y-2">
            {topProduits.map(([nom, ca]) => (
              <div key={nom}>
                <div className="flex justify-between text-xs font-semibold text-slate-700"><span>{nom}</span><span className="tabular-nums">{fmt(ca)}</span></div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-sky-700" style={{ width: `${Math.max(4, (ca / maxTop) * 100)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="font-bold text-slate-800 mb-3">💳 Répartition des paiements (période sélectionnée)</div>
          {repPaiements.length === 0 && <div className="text-sm text-slate-400">Aucune vente sur cette période.</div>}
          <div className="space-y-2">
            {repPaiements.map(([mode, ca]) => (
              <div key={mode}>
                <div className="flex justify-between text-xs font-semibold text-slate-700"><span>{mode}</span><span className="tabular-nums">{fmt(ca)} · {Math.round((ca / totalPai) * 100)} %</span></div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-green-600" style={{ width: `${Math.max(4, (ca / totalPai) * 100)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Synthèse par période</div>
        <table className="w-full text-sm" style={{ minWidth: 480 + NOMS.length * 140 }}>
          <thead><tr className="text-xs text-slate-500 uppercase">
            <th className="text-left px-4 py-2">Période</th>
            {NOMS.map((b) => <th key={b} className="text-right px-3 py-2">Ventes {b}</th>)}
            <th className="text-right px-3 py-2">Dépenses</th>
            <th className="text-right px-4 py-2">Résultat</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const res = somme(r.v) - somme(r.d);
              return (
                <tr key={r.label} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-4 py-2 font-semibold">{r.label}</td>
                  {NOMS.map((b) => <td key={b} className="px-3 py-2 text-right tabular-nums" style={{ color: col(b) }}>{fmt(r.v[b])}</td>)}
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(somme(r.d))}</td>
                  <td className={`px-4 py-2 text-right tabular-nums font-bold ${res >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(res)}</td>
                </tr>
              );
            })}
            {periodeIndex === "custom" && (
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="px-4 py-2 font-bold">{customRow.label}</td>
                {NOMS.map((b) => <td key={b} className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: col(b) }}>{fmt(customRow.v[b])}</td>)}
                <td className="px-3 py-2 text-right tabular-nums font-bold">{fmt(somme(customRow.d))}</td>
                <td className={`px-4 py-2 text-right tabular-nums font-bold ${resCustom >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(resCustom)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="font-bold text-slate-800 mb-2">Exporter les données (Excel / CSV)</div>
        {/* ⚠ Cloisonnement : ces exports partaient de la base BRUTE — un
            fichier remis au comptable ou à la direction contenait donc les
            ventes, dépenses, dettes et stocks d'entraînement, sans aucun
            moyen de les distinguer. Ils partent désormais des mêmes listes
            filtrées que les indicateurs affichés au-dessus. */}
        <div className="flex gap-2 flex-wrap">
          <button className={btnDark} onClick={() => exportCSV("ventes", ["Date", "N° reçu", "Boutique", "Articles", "Client", "Téléphone", "Qté totale", "Remise (%)", "Remise (F)", "Total", "Paiement", "Commercial", "Saisi par"],
            ventesReellesDb.map((v) => [dFR(v.date), numeroRecu(v), v.boutique, resumeArticles(v), v.client, v.tel, qteVente(v), v.remise_pct || "", v.remise || 0, totalVente(v), v.paiement, v.commercial, v.par]))}>Ventes</button>
          <button className={btnDark} onClick={() => exportCSV("depenses", ["Date", "Boutique", "Catégorie", "Description", "Montant", "Paiement", "Saisi par"],
            depensesReellesDb.map((x) => [dFR(x.date), x.boutique, x.categorie, x.description, x.montant, x.paiement, x.par]))}>Dépenses</button>
          <button className={btnDark} onClick={() => exportCSV("dettes", ["Date", "Nature", "Boutique", "Client", "Téléphone", "Motif", "Montant", "Payé", "Reste", "Saisi par"],
            dettesReellesDb.map((d) => [dFR(d.date), estReservation(d) ? "Réservation prépayée" : "Dette", d.boutique, d.client, d.tel, d.motif, d.montant, d.paye, Math.max(0, d.montant - d.paye), d.par]))}>Dettes</button>
          <button className={btnDark} onClick={() => exportCSV("stocks", ["Boutique", "Article", "Catégorie", "Initial", "Entrées", "Vendus", "Ajustements", "Stock actuel", "Seuil", "Prix achat", "Prix vente"],
            produitsReelsDb.map((p) => [p.boutique, p.nom, p.categorie, p.initial, p.entrees, stockVendu(db, p.id), stockAjuste(db, p.id), stockActuel(db, p), p.seuil, p.prix_achat, p.prix_vente]))}>Stocks</button>
          <button className="px-5 py-2 rounded-lg bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800"
            onClick={() => { const [lp, pa, pb] = getPeriod(); exportCSV("journal_comptable", ["Date", "Journal", "Pièce", "Compte", "Intitulé du compte", "Libellé", "Débit", "Crédit", "Boutique"], lignesJournal(db, pa, pb), lp.replace(/\s/g, "_")); }}>📒 Journal comptable (SYSCOHADA)</button>
        </div>
        <div className="text-xs text-slate-400 mt-2">Fichiers CSV compatibles Excel (séparateur point-virgule). Le journal comptable couvre la période sélectionnée plus haut : écritures en partie double (ventes, dépenses, règlements de dettes) avec les comptes SYSCOHADA de base — à remettre à votre comptable, qui peut adapter les codes si besoin.</div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {NOMS.map((b) => (
          <div key={b} className="bg-white rounded-xl border-2 p-4" style={{ borderColor: col(b) }}>
            <div className="mb-3"><Badge boutique={b} /></div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><div className="text-xs text-slate-500">Dettes clients</div><div className="font-bold tabular-nums">{fmt(dettes[b])}</div></div>
              <div><div className="text-xs text-slate-500">Alertes stock</div><div className={`font-bold ${alertes[b] ? "text-red-600" : ""}`}>{alertes[b]} article(s)</div></div>
              <div><div className="text-xs text-slate-500">Stock (prix d'achat)</div><div className="font-bold tabular-nums">{fmt(valA[b])}</div></div>
              <div><div className="text-xs text-slate-500">Stock (prix de vente)</div><div className="font-bold tabular-nums">{fmt(valV[b])}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

