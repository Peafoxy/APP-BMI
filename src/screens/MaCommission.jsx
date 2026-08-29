// ============================================================
// screens/MaCommission.jsx — Commissions de l'utilisateur courant
// (commerciaux et techniciens) : détail par vente/chantier, cumul.
// ============================================================
import { useState } from "react";
import { Ventes } from "../screens/Ventes";
import { resumeArticles, totalVente, caVente, numeroRecu, fmt, today, dFR, inP } from "../lib/core";
import { Field, inputCls, Badge, Panel } from "../components/ui";
import { SEUIL_CHEF_EQUIPE, TAUX_EQUIPE_DEFAUT, filleulsDe, estChefEquipe, commissionVente, commissionEnAttente, commissionPour , ventesDuCommercial, ventesReelles } from "../lib/calculs";

// ============ MA COMMISSION (commerciaux et techniciens) ============
export function MaCommission({ db, profile }) {
  const [periode, setPeriode] = useState("mois");
  // ---- Mes primes d'installation : parts des frais de chantier qui me
  // reviennent (répartition validée par l'admin), à percevoir ou payées.
  // Sans cette section, un paiement de prime passait totalement inaperçu
  // pour le technicien — aucune trace dans son espace.
  const mesParts = (db.clients_installes || []).flatMap((c) =>
    (c.equipe || [])
      .filter((e) => e.user_id === profile.id && Number(e.montant || 0) > 0)
      .map((e) => ({ chantier: c, part: e })));
  const partsAPercevoir = mesParts.filter((x) => !x.part.paye);
  const partsPayees = mesParts.filter((x) => x.part.paye);
  const totalAPercevoir = partsAPercevoir.reduce((s, x) => s + Number(x.part.montant), 0);
  const totalPercu = partsPayees.reduce((s, x) => s + Number(x.part.montant), 0);
  // ---- Mes paiements de commission reçus : la trace de CHAQUE règlement
  // (montant exact touché, date, moyen), reconstituée depuis les dépenses
  // générées par les paiements — la même source que la caisse et l'Historique.
  const mesPaiements = (db.depenses || [])
    .filter((d) => d.user_id === profile.id && (d.auto === "commission" || d.auto === "commission_equipe"))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const totalCommissionsRecues = mesPaiements.reduce((s, d) => s + Number(d.montant || 0), 0);
  const [pa, setPa] = useState(today().slice(0, 8) + "01");
  const [pb, setPb] = useState(today());

  const bornes = () => {
    if (periode === "mois") { const d = today().slice(0, 7); return [d + "-01", today()]; }
    if (periode === "annee") { const d = today().slice(0, 4); return [d + "-01-01", today()]; }
    if (periode === "tout") return ["2000-01-01", today()];
    return [pa, pb];
  };
  const [debut, fin] = bornes();

  // ⚠ Boutiques de formation (Timo — "ça ne doit pas toucher notre CA
  // réelle") : ventesReelles() exclue les ventes des boutiques formation.
  // Une vente déjà réglée au commercial (payee_commission = true) n'entre plus
  // dans le calcul de la commission due — elle a déjà été comptabilisée.
  const mesVentesTotales = ventesReelles(db).filter((v) => (v.commercial === profile.nom || v.responsable === profile.nom) && inP(v.date, debut, fin));
  const mesVentes = mesVentesTotales.filter((v) => !v.commission_payee);
    // ⚠ DÉFAUT TROUVÉ EN AUDIT (29/08/2026) : « chiffre d'affaires » était
    // calculé avec totalVente (ce que le client a payé), alors que la
    // commission, elle, se calcule sur caVente (qui exclut les lignes « hors
    // boutique »). Le commercial lisait donc un CA qui ne correspondait pas à
    // ce qu'on lui versait — de quoi discuter longtemps sans que personne ait
    // tort. Les deux partent maintenant de la même base.
  const ca = mesVentes.reduce((s, v) => s + caVente(v), 0);
  const taux = Number(profile.taux_commission || 0);
  const commission = mesVentes.reduce((s, v) => s + commissionPour(v, profile.nom, taux), 0);
  // Gagné, mais pas encore exigible : le client n'a pas réceptionné l'installation.
  const enAttenteReception = mesVentes.reduce((s, v) => s + commissionEnAttente(v, taux), 0);
  const rabaisAccordes = mesVentesTotales.filter((v) => v.commercial === profile.nom).reduce((s, v) => s + Number(v.rabais || 0), 0);
  // Même base que ci-dessus : c'est un chiffre d'affaires, pas un encaissement.
  const dejaRegle = mesVentesTotales.filter((v) => v.commission_payee).reduce((s, v) => s + caVente(v), 0);

  // ---- MON ÉQUIPE (les commerciaux que j'ai recrutés) ----
  const moiLive = db.users.find((u) => u.id === profile.id) || profile;
  const monEquipe = filleulsDe(db, moiLive);
  const jeSuisChef = estChefEquipe(db, moiLive);
  const tauxEquipe = Number(moiLive.taux_equipe ?? TAUX_EQUIPE_DEFAUT);
  const detailEquipe = monEquipe.map((u) => {
    const ventesU = ventesDuCommercial(db, u.nom).filter((v) => inP(v.date, debut, fin));
    const tu = Number(u.taux_commission || 0);
    const comDue = ventesU.filter((v) => !v.commission_payee).reduce((s, v) => s + commissionVente(v, tu), 0);
    const comTotale = ventesU.reduce((s, v) => s + commissionVente(v, tu), 0);
    const monOverride = ventesU.filter((v) => !v.override_payee).reduce((s, v) => s + Math.round((commissionVente(v, tu) * tauxEquipe) / 100), 0);
    return { u, nbVentes: ventesU.length, comDue, comTotale, monOverride };
  });
  const commissionEquipe = detailEquipe.reduce((s, x) => s + x.monOverride, 0);

  const blocEquipe = (
    <>
      {monEquipe.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
            <span>👥 Mon équipe — {monEquipe.length} commercial(aux) recruté(s)</span>
            <span className="text-xs font-semibold text-slate-600">
              {jeSuisChef
                ? <>⭐ <b className="text-amber-600">Chef d'équipe</b> · je touche <b>{tauxEquipe} %</b> de leurs commissions</>
                : <>Encore <b className="text-amber-600">{SEUIL_CHEF_EQUIPE - monEquipe.length}</b> recrue(s) pour devenir chef d'équipe</>}
            </span>
          </div>
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Commercial recruté", "Ventes", "Sa commission (période)", jeSuisChef ? "Ma part" : ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {detailEquipe.map(({ u, nbVentes, comTotale, monOverride }) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{u.nom_complet || u.nom}<div className="text-xs font-normal text-slate-500">{u.taux_commission ?? 0} % de commission</div></td>
                  <td className="px-3 py-2 tabular-nums">{nbVentes}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(comTotale)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-amber-600">{jeSuisChef ? fmt(monOverride) : "—"}</td>
                </tr>
              ))}
              {jeSuisChef && (
                <tr className="border-t-2 border-slate-300 bg-amber-50 font-bold">
                  <td className="px-3 py-2" colSpan={3}>MA COMMISSION D'ÉQUIPE (en attente)</td>
                  <td className="px-3 py-2 tabular-nums text-amber-700">{fmt(commissionEquipe)}</td>
                </tr>
              )}
            </tbody>
          </table>
          {!jeSuisChef && (
            <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
              À {SEUIL_CHEF_EQUIPE} commerciaux recrutés, vous devenez automatiquement chef d'équipe et touchez un pourcentage de leurs commissions.
            </div>
          )}
        </div>
      )}
    </>
  );

  const parBoutique = {};
  // Idem : la répartition par boutique est une répartition de CA.
  mesVentes.forEach((v) => { parBoutique[v.boutique] = (parBoutique[v.boutique] || 0) + caVente(v); });

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-3">💵 Ma commission — {profile.nom}</div>

        {enAttenteReception > 0 && (
          <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
            <div className="font-bold text-amber-900">⏳ {fmt(enAttenteReception)} en attente de réception</div>
            <div className="text-xs text-slate-600 mt-1">
              Cette commission est acquise, mais elle ne devient exigible que le jour où le client <b>réceptionne son installation</b>. Elle s'ajoutera automatiquement à votre dû à ce moment-là.
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {[["mois", "Ce mois"], ["annee", "Cette année"], ["tout", "Depuis le début"], ["perso", "Personnalisée"]].map(([id, label]) => (
            <button key={id} onClick={() => setPeriode(id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${periode === id ? "bg-sky-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>
          ))}
        </div>
        {periode === "perso" && (
          <div className="flex gap-2 mb-4 flex-wrap">
            <Field label="Du"><input type="date" className={inputCls} value={pa} onChange={(e) => setPa(e.target.value)} /></Field>
            <Field label="Au"><input type="date" className={inputCls} value={pb} onChange={(e) => setPb(e.target.value)} /></Field>
          </div>
        )}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">Chiffre d'affaires (non réglé)</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{fmt(ca)}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">Taux de commission</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{taux} %</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-600">
            <div className="text-xs font-semibold text-green-700 uppercase">Commission à payer</div>
            <div className="text-2xl font-bold tabular-nums mt-1 text-green-800">{fmt(commission)}</div>
            {jeSuisChef && commissionEquipe > 0 && <div className="text-xs font-bold text-amber-600 mt-1">+ {fmt(commissionEquipe)} de commission d'équipe</div>}
          </div>
        </div>
        {rabaisAccordes > 0 && (
          <div className="text-xs font-bold text-orange-600 mt-2">
            🏷 Rabais accordés à vos clients sur cette période : −{fmt(rabaisAccordes)} — déduits de votre commission.
          </div>
        )}
        {dejaRegle > 0 && <div className="text-xs text-slate-500 mt-2">Sur cette période, {fmt(dejaRegle)} de ventes ont déjà donné lieu à une commission réglée.</div>}
        <div className="text-xs text-slate-400 mt-2">Le règlement des commissions est validé par l'administration ou votre chef d'équipe.</div>
      </Panel>

      {blocEquipe}

      {Object.keys(parBoutique).length > 0 && (
        <Panel>
          <div className="font-bold mb-3">Répartition par boutique</div>
          <div className="space-y-2">
            {Object.entries(parBoutique).sort((a, b) => b[1] - a[1]).map(([nom, montant]) => (
              <div key={nom} className="flex items-center justify-between text-sm">
                <Badge boutique={nom} />
                <span className="font-bold tabular-nums">{fmt(montant)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {mesPaiements.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="font-bold text-slate-800 mb-2">💰 Mes paiements de commission reçus
            <span className="ml-2 text-xs font-semibold text-green-700">total perçu : {fmt(totalCommissionsRecues)}</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {mesPaiements.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div>
                  <b>{fmt(d.montant)}</b> — {dFR(d.date)}{d.paiement ? ` · ${d.paiement}` : ""}
                  <div className="text-xs text-slate-500">{d.auto === "commission_equipe" ? "Commission d'équipe" : "Commission sur ventes"}{d.description ? ` — ${d.description}` : ""}</div>
                </div>
                <span className="text-xs font-bold text-green-700 whitespace-nowrap">✅ Payée</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mesParts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="font-bold text-slate-800 mb-2">🔧 Mes primes d'installation
            <span className="ml-2 text-xs font-semibold text-red-600">à percevoir : {fmt(totalAPercevoir)}</span>
            <span className="ml-2 text-xs font-semibold text-green-700">déjà perçu : {fmt(totalPercu)}</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {partsAPercevoir.map((x) => (
              <div key={x.chantier.id + "-att"} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <div>
                  <b>{fmt(x.part.montant)}</b> — chantier {x.chantier.nom} {x.chantier.prenom || ""}
                  <div className="text-xs text-slate-500">{x.part.pct} % des frais d'installation{x.part.chef ? " · ⭐ chef de chantier" : ""}</div>
                </div>
                <span className="text-xs font-bold text-amber-700 whitespace-nowrap">⏳ À percevoir</span>
              </div>
            ))}
            {partsPayees.map((x) => (
              <div key={x.chantier.id + "-pay"} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
                <div>
                  {fmt(x.part.montant)} — chantier {x.chantier.nom} {x.chantier.prenom || ""}
                  <span className="ml-2 text-xs text-slate-400">{x.part.pct} %{x.part.chef ? " · ⭐ chef" : ""}</span>
                </div>
                <span className="text-xs font-bold text-green-700 whitespace-nowrap">✅ Payée{x.part.date_paiement ? ` le ${dFR(x.part.date_paiement)}` : ""}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-400">La prime devient payable une fois la répartition validée par l'administration ; le paiement vous est notifié dans Messages.</div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Détail de mes ventes en attente ({mesVentes.length})</div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "N° reçu", "Boutique", "Articles", "Total"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {mesVentes.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Aucune vente sur cette période.</td></tr>}
            {mesVentes.map((v) => (
              <tr key={v.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2 whitespace-nowrap">{dFR(v.date)}</td>
                <td className="px-3 py-2 font-mono text-xs">{numeroRecu(v)}</td>
                <td className="px-3 py-2"><Badge boutique={v.boutique} /></td>
                <td className="px-3 py-2">{resumeArticles(v)}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt(totalVente(v))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-400">La commission affichée est une estimation calculée automatiquement (chiffre d'affaires × taux). Elle ne constitue pas un document de paie officiel.</div>
    </div>
  );
}
