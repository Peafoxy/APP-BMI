// ============================================================
// screens/Salaires.jsx — Paie : vue administrateur (SalairesAdmin,
// validation des mois) et vue individuelle (Salaire : vendeurs,
// gérants, magasiniers) avec bulletin imprimable.
// ============================================================
import { useState, useEffect } from "react";
import { SALARIES } from "../lib/constants";
import { uid, fmt, today, dFR } from "../lib/core";
import { Field, inputCls, btnDark, Panel, uAlert, uConfirm } from "../components/ui";
import { resteCredit, creditsEnCours, envoyerVirementG, aDroit, paieMois, libelleMoisFR } from "../lib/calculs";
import { imprimerBulletin } from "../lib/impression";
import { exportCSV } from "../lib/export";

// ============ SALAIRES — VUE ADMINISTRATEUR ============
export function SalairesAdmin({ db, save, profile }) {
  const [mois, setMois] = useState(today().slice(0, 7));
  const options = [];
  const d0 = new Date();
  for (let i = 0; i < 12; i++) {
    const m = new Date(d0.getFullYear(), d0.getMonth() - i, 1);
    options.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }

  const employes = db.users.filter((u) => SALARIES.includes(u.role) && u.actif !== false);
  const lignes = employes.map((u) => ({ u, p: paieMois(u, mois), credit: creditsEnCours(u).reduce((s, c) => s + resteCredit(c), 0) }));

  const masse = lignes.reduce((s, l) => s + l.p.net, 0);
  const verse = lignes.reduce((s, l) => s + l.p.verse, 0);
  const reste = lignes.reduce((s, l) => s + Math.max(0, l.p.reste), 0);
  const attente = lignes.reduce((s, l) => s + l.p.enAttente, 0);
  const encoursCredit = lignes.reduce((s, l) => s + l.credit, 0);

  const roleCourt = (r) => r === "gerant" ? "Gérant" : r === "magasinier" ? "Magasinier" : r === "technicien_bmi" ? "Technicien BMI" : "Vendeur";

  const statut = (p) => {
    if (p.net <= 0) return <span className="text-xs font-bold text-slate-400">—</span>;
    if (p.verse <= 0) return <span className="text-xs font-bold text-red-600">🔴 Non payé</span>;
    if (p.reste > 0) return <span className="text-xs font-bold text-orange-600">🟠 Partiel</span>;
    if (p.enAttente > 0) return <span className="text-xs font-bold text-amber-600">⏳ À confirmer</span>;
    return <span className="text-xs font-bold text-green-700">✅ Payé & confirmé</span>;
  };

  const Carte = ({ label, valeur, couleur }) => (
    <div className={`rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 ${couleur}`}>
      <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1">{valeur}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-1">💵 Masse salariale — {libelleMoisFR(mois)}</div>
        <div className="text-xs text-slate-500 mb-3">Vue d'ensemble de la paie du mois. Les virements envoyés d'ici sont enregistrés en dépense « Salaires ».</div>
        <Field label="Mois">
          <select className={inputCls} value={mois} onChange={(e) => setMois(e.target.value)}>
            {options.map((m) => <option key={m} value={m}>{libelleMoisFR(m)}</option>)}
          </select>
        </Field>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <Carte label="Masse salariale (net)" valeur={fmt(masse)} couleur="border-l-sky-700" />
          <Carte label="Déjà versé" valeur={fmt(verse)} couleur="border-l-green-600" />
          <Carte label="Reste à verser" valeur={fmt(reste)} couleur="border-l-red-500" />
          <Carte label="À confirmer par l'employé" valeur={fmt(attente)} couleur="border-l-amber-500" />
          <Carte label="Encours crédits BMI" valeur={fmt(encoursCredit)} couleur="border-l-purple-600" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <span>Détail par employé</span>
          <button className={btnDark} onClick={() => exportCSV(`salaires_${mois}`,
            ["Employé", "Rôle", "Boutique", "Salaire de base", "Primes", "Avances", "Retenue crédit", "Net à percevoir", "Versé", "Reste à verser", "Crédit en cours"],
            lignes.map(({ u, p, credit }) => [u.nom, roleCourt(u.role), u.boutique || "Toutes", p.base, p.primes, p.avances, p.retenueCredit, p.net, p.verse, Math.max(0, p.reste), credit]),
            `Paie ${libelleMoisFR(mois)}`)}>📄 Exporter</button>
        </div>
        {lignes.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">Aucun employé salarié actif. Créez des comptes Vendeur, Gérant, Magasinier ou Technicien BMI.</div>
        ) : (
          <div className="max-h-[460px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="sticky top-0 z-10"><tr className="text-xs text-slate-500 uppercase bg-slate-100">{["Employé", "Base", "Primes", "Avances", "Retenue crédit", "Net", "Versé", "Reste", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {lignes.map(({ u, p, credit }) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-semibold">{u.nom_complet || u.nom}
                    <div className="text-xs font-normal text-slate-500">{roleCourt(u.role)} · {u.boutique || "Toutes boutiques"}</div>
                    {!u.nom_complet && <div className="text-xs font-normal text-orange-500">⚠ Identité non renseignée (👥 Utilisateurs → 🪪 Identité)</div>}
                    {credit > 0 && <div className="text-xs font-bold text-purple-700">🏦 Crédit : reste {fmt(credit)}</div>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{p.base ? fmt(p.base) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{p.primes ? "+" + fmt(p.primes) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-orange-600">{p.avances ? "−" + fmt(p.avances) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-red-600">{p.retenueCredit ? "−" + fmt(p.retenueCredit) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(p.net)}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{fmt(p.verse)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${p.reste > 0 ? "text-red-600" : "text-green-700"}`}>{fmt(Math.max(0, p.reste))}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{statut(p)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.reste > 0 && <button onClick={() => envoyerVirementG(db, save, profile, u, mois)} className="text-xs font-bold text-blue-700 underline mr-2">💸 Virement</button>}
                    <button onClick={() => imprimerBulletin(u, mois, db)} className="text-xs font-bold text-sky-800 underline">🖨 Bulletin</button>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 tabular-nums">{fmt(lignes.reduce((s, l) => s + l.p.base, 0))}</td>
                <td className="px-3 py-2 tabular-nums text-green-700">{fmt(lignes.reduce((s, l) => s + l.p.primes, 0))}</td>
                <td className="px-3 py-2 tabular-nums text-orange-600">{fmt(lignes.reduce((s, l) => s + l.p.avances, 0))}</td>
                <td className="px-3 py-2 tabular-nums text-red-600">{fmt(lignes.reduce((s, l) => s + l.p.retenueCredit, 0))}</td>
                <td className="px-3 py-2 tabular-nums">{fmt(masse)}</td>
                <td className="px-3 py-2 tabular-nums text-green-700">{fmt(verse)}</td>
                <td className="px-3 py-2 tabular-nums text-red-600">{fmt(reste)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2"></td>
              </tr>
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ SALAIRE (vendeurs, gérants, magasiniers) ============
export function Salaire({ db, save, profile }) {
  // Lit la fiche À JOUR depuis la base (le profil de connexion est figé au
  // login, or l'admin peut ajouter primes/avances pendant la session).
  const moi = db.users.find((u) => u.id === profile.id) || profile;
  const [mois, setMois] = useState(today().slice(0, 7));

  // 12 derniers mois proposés
  const options = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    options.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  const libelleMois = libelleMoisFR;

  const base = Number(moi.salaire_base || 0);
  const primes = (moi.primes || []).filter((p) => p.mois === mois);
  const avances = (moi.avances || []).filter((a) => a.mois === mois);
  const totalPrimes = primes.reduce((s, p) => s + Number(p.montant || 0), 0);
  const totalAvances = avances.reduce((s, a) => s + Number(a.montant || 0), 0);
  // Virements + retenues de crédit pour ce mois
  const p = paieMois(moi, mois);
  const net = p.net;
  const enAttente = p.virements.filter((v) => v.statut !== "accepte");

  // ---- Crédit BMI ----
  const mesCredits = moi.credits || [];
  const enCours = mesCredits.filter((c) => c.statut === "approuve" && resteCredit(c) > 0);
  const enExamen = mesCredits.filter((c) => c.statut === "en_attente");
  const [dem, setDem] = useState({ montant: "", motif: "", mode: "salaire", mensualites: "3" });
  const [msgC, setMsgC] = useState("");

  const demanderCredit = async () => {
    const montant = Number(dem.montant);
    if (!montant || montant <= 0) { setMsgC("Indiquez le montant souhaité."); return; }
    if (!dem.motif.trim()) { setMsgC("Indiquez le motif de votre demande."); return; }
    if (enExamen.length > 0) { setMsgC("Vous avez déjà une demande en cours d'examen."); return; }
    const n = dem.mode === "salaire" ? Math.max(1, Math.min(36, Number(dem.mensualites) || 1)) : 0;
    const resume = dem.mode === "salaire"
      ? `Remboursement par retenue sur salaire : ${n} mensualité(s) d'environ ${fmt(Math.round(montant / n))}.`
      : "Remboursement libre (vous remboursez directement à l'administration).";
    if (!await uConfirm(`Envoyer une demande de crédit de ${fmt(montant)} à BMI ?\n\n${resume}\n\nL'administration examinera votre demande.`)) return;
    const credit = {
      id: uid(), date_demande: today(), montant_demande: montant, motif: dem.motif.trim(),
      mode: dem.mode, mensualites: n, statut: "en_attente", remboursements: [], echeances: []
    };
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, credits: [...(x.credits || []), credit] } : x)) },
      `Demande de crédit BMI de ${fmt(montant)} par ${moi.nom}`);
    setDem({ montant: "", motif: "", mode: "salaire", mensualites: "3" });
    setMsgC("✅ Demande envoyée. Vous serez informé de la décision ici même.");
    setTimeout(() => setMsgC(""), 6000);
  };

  // À l'ouverture de l'onglet, les décisions de crédit sont marquées comme vues
  // (la pastille de notification disparaît).
  useEffect(() => {
    const aVoir = mesCredits.filter((c) => (c.statut === "approuve" || c.statut === "refuse") && !c.vu_employe);
    if (!aVoir.length) return;
    save({
      ...db,
      users: db.users.map((x) => (x.id === moi.id
        ? { ...x, credits: (x.credits || []).map((c) => ((c.statut === "approuve" || c.statut === "refuse") && !c.vu_employe ? { ...c, vu_employe: true } : c)) }
        : x))
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const annulerDemande = async (c) => {
    if (!await uConfirm(`Annuler votre demande de crédit de ${fmt(c.montant_demande)} ?`)) return;
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, credits: (x.credits || []).filter((y) => y.id !== c.id) } : x)) },
      `${moi.nom} a annulé sa demande de crédit de ${fmt(c.montant_demande)}`);
  };

  const accepterVirement = async (v) => {
    if (!await uConfirm(`Confirmez-vous avoir bien reçu ${fmt(v.montant)}${v.moyen ? ` par ${v.moyen}` : ""} pour ${libelleMois(v.mois)} ?\n\nCette confirmation est enregistrée et visible par l'administration.`)) return;
    const maj = { ...v, statut: "accepte", date_acceptation: today() };
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, virements: (x.virements || []).map((y) => (y.id === v.id ? maj : y)) } : x)) },
      `${moi.nom} a confirmé la réception du virement de ${fmt(v.montant)} (${libelleMois(v.mois)})`);
    uAlert("✅ Réception confirmée. Merci !");
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-1">💵 Mon salaire — {moi.nom_complet || moi.nom}</div>
        {moi.piece_num && <div className="text-xs text-slate-400 mb-1">{moi.piece_type || "Pièce"} n° {moi.piece_num}</div>}
        <div className="text-xs text-slate-500 mb-4">Informations indicatives, mois par mois. Pour toute question sur votre paie, adressez-vous à l'administration.{Number(moi.taux_avancement || 0) > 0 ? ` Taux d'avancement annuel : ${moi.taux_avancement} %.` : ""}</div>
        <Field label="Mois">
          <select className={inputCls} value={mois} onChange={(e) => setMois(e.target.value)}>
            {options.map((m) => <option key={m} value={m}>{libelleMois(m)}</option>)}
          </select>
        </Field>
        <div className="mt-3">
          <button onClick={() => imprimerBulletin(moi, mois, db)} className={btnDark}>🖨 Imprimer mon bulletin de paie</button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">Salaire de base</div>
            <div className="text-xl font-bold tabular-nums mt-1">{base > 0 ? fmt(base) : "—"}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-green-600">
            <div className="text-xs font-semibold text-slate-500 uppercase">Primes du mois</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-green-700">{totalPrimes ? "+" + fmt(totalPrimes) : fmt(0)}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-orange-500">
            <div className="text-xs font-semibold text-slate-500 uppercase">Avances perçues</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-orange-600">{totalAvances ? "−" + fmt(totalAvances) : fmt(0)}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-red-500">
            <div className="text-xs font-semibold text-slate-500 uppercase">Retenue crédit BMI</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-red-600">{p.retenueCredit ? "−" + fmt(p.retenueCredit) : fmt(0)}</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-700">
            <div className="text-xs font-semibold text-green-700 uppercase">Net à percevoir</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-green-800">{fmt(net)}</div>
          </div>
        </div>
      </Panel>

      {enAttente.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="font-bold text-amber-800 mb-1">💸 Virement reçu de l'administration</div>
          <div className="text-xs text-amber-700 mb-3">Vérifiez que l'argent est bien arrivé, puis confirmez la réception.</div>
          <div className="space-y-3">
            {enAttente.map((v) => (
              <div key={v.id} className="rounded-lg bg-white border border-amber-200 p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold tabular-nums text-slate-800">{fmt(v.montant)}</div>
                  <div className="text-xs text-slate-500">
                    {libelleMois(v.mois)} · {v.moyen || "Non précisé"} · envoyé le {dFR(v.date_envoi)} par {v.par || "—"}
                    {v.ref ? ` · Réf : ${v.ref}` : ""}
                  </div>
                </div>
                <button onClick={() => accepterVirement(v)} className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-bold hover:bg-green-800">
                  ✅ J'ai bien reçu ce montant
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {p.virements.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between gap-2">
            <span>💸 Virements — {libelleMois(mois)}</span>
            <span className="text-xs font-semibold text-slate-600">
              Versé : <b className="tabular-nums">{fmt(p.verse)}</b> · Reste à percevoir : <b className={`tabular-nums ${p.reste > 0 ? "text-orange-600" : "text-green-700"}`}>{fmt(Math.max(0, p.reste))}</b>
            </span>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Date d'envoi", "Montant", "Moyen", "Référence", "Statut"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {p.virements.map((v) => (
                <tr key={v.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(v.date_envoi)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-blue-700">{fmt(v.montant)}</td>
                  <td className="px-3 py-2">{v.moyen || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{v.ref || "—"}</td>
                  <td className="px-3 py-2">
                    {v.statut === "accepte"
                      ? <span className="text-xs font-bold text-green-700">✅ Reçu confirmé le {dFR(v.date_acceptation)}</span>
                      : <span className="text-xs font-bold text-amber-600">⏳ En attente de votre confirmation</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(primes.length > 0 || avances.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Détail — {libelleMois(mois)}</div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Type", "Motif", "Enregistré par", "Montant"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {primes.map((p, i) => (
                <tr key={"p" + i} className="border-t border-slate-100">
                  <td className="px-3 py-2"><span className="text-xs font-bold text-green-700">PRIME</span></td>
                  <td className="px-3 py-2">{p.motif || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{p.par || "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-green-700">+{fmt(Number(p.montant || 0))}</td>
                </tr>
              ))}
              {avances.map((a, i) => (
                <tr key={"a" + i} className="border-t border-slate-100">
                  <td className="px-3 py-2"><span className="text-xs font-bold text-orange-600">AVANCE</span></td>
                  <td className="px-3 py-2">{a.motif || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{a.par || "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-orange-600">−{fmt(Number(a.montant || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
        <div className="font-bold mb-1">🏦 Crédit BMI</div>
        <div className="text-xs text-slate-500 mb-4">Vous pouvez demander un crédit à l'entreprise. L'administration examine votre demande et fixe le montant accordé.</div>

        {!aDroit(db, profile, "act_credit") && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
            🔒 La demande de crédit a été désactivée pour votre compte par l'administration.
          </div>
        )}

        {aDroit(db, profile, "act_credit") && enExamen.length === 0 && enCours.length === 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Montant souhaité (F CFA)">
              <input type="number" min="0" className={inputCls} value={dem.montant} onChange={(e) => setDem({ ...dem, montant: e.target.value })} />
            </Field>
            <Field label="Motif">
              <input className={inputCls} placeholder="Ex : frais de santé, scolarité…" value={dem.motif} onChange={(e) => setDem({ ...dem, motif: e.target.value })} />
            </Field>
            <Field label="Remboursement souhaité">
              <select className={inputCls} value={dem.mode} onChange={(e) => setDem({ ...dem, mode: e.target.value })}>
                <option value="salaire">Retenue sur salaire (mensualités)</option>
                <option value="libre">Remboursement libre</option>
              </select>
            </Field>
            {dem.mode === "salaire" && (
              <Field label="Nombre de mensualités">
                <input type="number" min="1" max="36" className={inputCls} value={dem.mensualites} onChange={(e) => setDem({ ...dem, mensualites: e.target.value })} />
              </Field>
            )}
          </div>
        )}

        {aDroit(db, profile, "act_credit") && enExamen.length === 0 && enCours.length === 0 && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button onClick={demanderCredit} className={btnDark}>Envoyer ma demande</button>
            {msgC && <span className="text-sm font-semibold text-slate-700">{msgC}</span>}
          </div>
        )}

        {enCours.length > 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
            Vous avez un crédit en cours de remboursement. Une nouvelle demande sera possible une fois celui-ci soldé.
          </div>
        )}
        {enExamen.length > 0 && (
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-sm text-purple-900">
            📩 Votre demande est en cours d'examen par l'administration.
          </div>
        )}

        {mesCredits.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Demandé", "Accordé", "Remboursement", "Reste dû", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {[...mesCredits].reverse().map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{dFR(c.date_demande)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmt(c.montant_demande)}<div className="text-xs font-normal text-slate-500">{c.motif}</div></td>
                    <td className="px-3 py-2 tabular-nums font-bold text-blue-700">{c.montant_accorde ? fmt(c.montant_accorde) : "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {c.mode === "salaire" ? `Retenue sur salaire${c.mensualites ? ` · ${c.mensualites} mois` : ""}` : "Remboursement libre"}
                      {(c.echeances || []).some((e) => !e.paye) && (
                        <div className="text-slate-500">Prochaine : {libelleMoisFR((c.echeances || []).find((e) => !e.paye).mois)} · {fmt((c.echeances || []).find((e) => !e.paye).montant)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-bold text-red-600">{c.statut === "approuve" ? fmt(resteCredit(c)) : "—"}</td>
                    <td className="px-3 py-2">
                      {c.statut === "en_attente" ? <span className="text-xs font-bold text-purple-700">📩 En attente</span>
                        : c.statut === "approuve" ? <span className="text-xs font-bold text-blue-700">✅ Accordé</span>
                        : c.statut === "solde" ? <span className="text-xs font-bold text-green-700">🎉 Soldé</span>
                        : <span className="text-xs font-bold text-red-600">❌ Refusé</span>}
                      {c.commentaire && <div className="text-xs text-slate-500 italic">« {c.commentaire} »</div>}
                    </td>
                    <td className="px-3 py-2">
                      {c.statut === "en_attente" && <button onClick={() => annulerDemande(c)} className="text-xs font-bold text-red-600 underline">Annuler</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(moi.evolutions_salaire || []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">📈 Mon avancement</div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Ancien salaire", "Nouveau salaire", "Évolution", "%", "Motif"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {[...moi.evolutions_salaire].reverse().map((e, i) => {
                const delta = Number(e.nouveau) - Number(e.ancien);
                const pct = e.pct != null ? e.pct : (Number(e.ancien) > 0 ? Math.round(((Number(e.nouveau) - Number(e.ancien)) / Number(e.ancien)) * 1000) / 10 : null);
                return (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">{dFR(e.date)}</td>
                    <td className="px-3 py-2 tabular-nums">{e.ancien ? fmt(e.ancien) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums font-bold">{fmt(e.nouveau)}</td>
                    <td className={`px-3 py-2 tabular-nums font-bold ${delta >= 0 ? "text-green-700" : "text-red-600"}`}>{delta >= 0 ? "+" : ""}{fmt(delta)}</td>
                    <td className={`px-3 py-2 tabular-nums font-bold ${pct == null ? "text-slate-400" : pct >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct} %`}
                      {e.taux_prevu ? <span className="block text-[10px] font-normal text-slate-400">taux fixé : {e.taux_prevu} %</span> : null}
                    </td>
                    <td className="px-3 py-2">{e.motif || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {base === 0 && primes.length === 0 && avances.length === 0 && p.virements.length === 0 && mesCredits.length === 0 && (
        <div className="text-sm text-slate-400 text-center py-6">Aucune information de salaire n'a encore été renseignée par l'administration pour ce mois.</div>
      )}
    </div>
  );
}
