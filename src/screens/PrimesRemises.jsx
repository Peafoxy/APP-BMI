// ============================================================
// screens/PrimesRemises.jsx — Le vendeur ou le gérant d'une boutique valide et
// paie les demandes de prime d'installation adressées à SA caisse
// (demande Timo : plus besoin de l'administrateur à chaque fois).
// ============================================================
import { useState } from "react";
import { fmt, dFR } from "../lib/core";
import { Panel, uAlert, uConfirm, uPrompt, demanderMoyenPaiement, CarteRepliable } from "../components/ui";
import { ficheParId } from "../lib/banques";
import { bloquerSiLecture, primesEnAttente, construirePaiementPrime, envoyerAvisPrimePayee, primeDejaPayee, retenueOutilPourPrime } from "../lib/calculs";

export function PrimesRemises({ db, save, profile }) {
  const isAdmin = profile.role === "admin";
  const [bq, setBq] = useState(profile.boutique || "");
  const boutique = profile.boutique || bq;

  if (!boutique) {
    return <Panel><div className="text-slate-500 text-sm">Aucune boutique rattachée à votre compte — cet onglet est réservé au vendeur ou au gérant d'une boutique précise.</div></Panel>;
  }

  const enAttente = primesEnAttente(db, boutique, profile);
  const historique = [];
  for (const c of db.clients_installes || []) {
    for (const e of c.equipe || []) {
      if (e.paye && e.prime_boutique === boutique) historique.push({ client: c, entree: e });
    }
  }
  historique.sort((a, b) => (b.entree.date_paiement || "").localeCompare(a.entree.date_paiement || ""));

  const valider = async ({ client: c, entree: e }) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!isAdmin && profile.boutique !== e.prime_boutique) { uAlert(`Cette demande concerne la boutique ${e.prime_boutique}, pas la vôtre.`); return; }
    if (e.user_id === profile.id) { uAlert("Vous ne pouvez pas valider le paiement de votre propre prime : un autre vendeur ou gérant de la boutique, ou l'administrateur, s'en charge."); return; }
    // ⚠ L'administrateur peut payer cette même part depuis 🏠 Clients installés,
    // et l'application fonctionne hors ligne : sans ce contrôle, la caisse
    // était débitée deux fois pour une seule prime.
    if (primeDejaPayee(db, c, e)) { uAlert(`La part de ${e.nom} sur ce chantier a déjà été payée.\n\nRien n'a été enregistré : la caisse n'est pas débitée une seconde fois.`); return; }
    const moyen = await demanderMoyenPaiement(`pour ${e.nom}`, "Espèces", "Moyen de paiement", ficheParId(db.users, e.user_id));
    if (moyen === null) return;
    // 🧰 Outil perdu : retenue sur la part d'un technicien à commission.
    const ret = retenueOutilPourPrime(db, e.user_id, e.montant, e.prime_boutique);
    const net = e.montant - ret.montant;
    if (!await uConfirm(`Payer ${fmt(e.montant)} à ${e.nom} pour l'installation de ${c.nom} ${c.prenom || ""} ?${ret.montant > 0
      ? `\n\n🧰 Retenue pour outil perdu : ${fmt(ret.montant)} (${ret.lignes.map((l) => l.outil).join(", ")})\nIl reçoit : ${fmt(net)}\n\nSortie de caisse ${boutique} : ${fmt(net)}`
      : `\n\nSortie de caisse ${boutique} : ${fmt(e.montant)}`}`)) return;
    // Relecture après les questions : une synchronisation a pu arriver entre-temps.
    if (primeDejaPayee(db, c, e)) { uAlert(`⚠ La part de ${e.nom} vient d'être payée par quelqu'un d'autre.\n\nRien n'a été enregistré — la caisse n'a pas été débitée deux fois.`); return; }
    save(construirePaiementPrime(db, profile, c, e, moyen, ret), `Prime d'installation validée et payée — ${e.nom} · ${fmt(net)} · ${boutique}${ret.montant > 0 ? ` — retenue outil perdu ${fmt(ret.montant)}` : ""}`);
    // 📲 L'avis de paiement part du numéro BMI, tout seul (07/10/2026).
    const avis = await envoyerAvisPrimePayee({ db, save, profile, c, e, moyen, retenue: ret.montant });
    uAlert((ret.montant > 0 ? `✅ ${fmt(net)} payés à ${e.nom} (${fmt(ret.montant)} retenus pour outil perdu).` : `✅ ${fmt(e.montant)} payés à ${e.nom}.`) + (avis ? `\n\n${avis}` : ""));
  };

  // 💰 FAÇON CARNET (18/11/2026, aperçu validé par Timo, « Construit, lance ») :
  // un tableau (sur téléphone : une carte par demande), le geste écrit en mots,
  // l'explication derrière « ⓘ », l'historique replié et en tableau.
  const geste = (c, e) => (
    <button onClick={() => valider({ client: c, entree: e })} data-geste className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-1.5 hover:bg-emerald-100">✓ Valider et payer</button>
  );
  const nomPrime = (e) => <>{e.nom}{e.chef ? " ⭐" : ""}{e.prime_employe ? " 🎁 prime de chantier" : ""}</>;

  return (
    <div className="space-y-4">
      <Panel>
        <CarteRepliable titre={`💰 Primes remises — ${boutique}`} badge={<span className="text-xs font-normal text-slate-500">— {enAttente.length} demande{enAttente.length > 1 ? "s" : ""} en attente</span>}
          explication="Demandes de paiement de prime d'installation adressées à la caisse de cette boutique. Valider déclenche la vraie sortie de caisse et prévient le technicien.">
          {enAttente.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">Aucune demande en attente pour l'instant.</div>}
          {enAttente.length > 0 && (
            <>
              <div className="hidden sm:block overflow-x-auto" data-primes-remises-table>
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-500 uppercase">{["Technicien", "Chantier", "Demandé", "Montant", "Geste"].map((h) => <th key={h} className={`px-3 py-2 ${h === "Montant" ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                  <tbody>
                    {enAttente.map(({ client: c, entree: e }) => (
                      <tr key={`${c.id}-${e.user_id}`} data-ligne={`${c.id}:${e.user_id}`} className="border-t border-slate-100 bg-sky-50">
                        <td className="px-3 py-2 font-semibold">{nomPrime(e)}</td>
                        <td className="px-3 py-2">{c.nom} {c.prenom || ""}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{dFR(e.prime_demandee_le)} par {e.prime_demandee_par}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">{fmt(e.montant)}</td>
                        <td className="px-3 py-2">{geste(c, e)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sm:hidden space-y-2" data-primes-remises-cartes>
                {enAttente.map(({ client: c, entree: e }) => (
                  <div key={`${c.id}-${e.user_id}`} data-ligne={`${c.id}:${e.user_id}`} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2"><div className="font-semibold text-sm">{nomPrime(e)}</div><span className="font-bold tabular-nums">{fmt(e.montant)}</span></div>
                    <div className="text-xs text-slate-500">{c.nom} {c.prenom || ""} · demandé le {dFR(e.prime_demandee_le)} par {e.prime_demandee_par}</div>
                    <div className="mt-2">{geste(c, e)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CarteRepliable>
      </Panel>

      <Panel>
        <CarteRepliable titre={`Historique des primes déjà payées par cette boutique (${historique.length})`} ouvertParDefaut={false}>
          {historique.length === 0 && <div className="text-sm text-slate-400">Aucune prime payée par cette boutique pour l'instant.</div>}
          {historique.length > 0 && (
            <div className="overflow-x-auto" data-primes-historique-table>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500 uppercase">{["Technicien", "Chantier", "Payé le", "Montant"].map((h) => <th key={h} className={`px-3 py-2 ${h === "Montant" ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                <tbody>
                  {historique.map(({ client: c, entree: e }) => (
                    <tr key={`${c.id}-${e.user_id}`} data-ligne={`${c.id}:${e.user_id}`} className="border-t border-slate-100">
                      <td className="px-3 py-2">{e.nom}</td>
                      <td className="px-3 py-2">{c.nom} {c.prenom || ""}</td>
                      <td className="px-3 py-2 text-slate-500">{dFR(e.date_paiement)}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{fmt(e.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CarteRepliable>
      </Panel>
    </div>
  );
}
