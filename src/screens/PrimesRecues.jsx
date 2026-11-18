// ============================================================
// screens/PrimesRecues.jsx — Mes primes : la part d'installation (technicien
// à commission ou BMI), la prime sur chantier (employé de boutique) et la
// prime sur salaire (tout salarié), en attente ou déjà payées.
// ⚠ Timo (10/10/2026, « A b, B a, C a ») : l'onglet passe à TOUT rôle qui
// peut recevoir une prime (ROLES_PRIMES_RECUES) ; 💵 Ma commission et
// 💵 Mon salaire gardent aussi les leurs.
// ============================================================
import { fmt, dFR } from "../lib/core";
import { Panel, CarteRepliable } from "../components/ui";
import { primesDeTechnicien, primesSurSalaire, utilisateursDeLEspace, libelleMoisFR } from "../lib/calculs";

export function PrimesRecues({ db, profile }) {
  const primes = primesDeTechnicien(db, profile.id);
  // La fiche VIVANTE (l'admin peut poser une prime pendant la session),
  // prise dans la liste de l'espace — jamais db.users en entier.
  const moi = utilisateursDeLEspace(db, profile).find((u) => u.id === profile.id) || profile;
  const surSalaire = primesSurSalaire(moi);
  const montant = (e) => Number(e.montant || 0);
  const enAttente = primes.filter(({ entree: e }) => !e.paye).reduce((s, { entree: e }) => s + montant(e), 0)
    + surSalaire.filter((p) => !p.versee).reduce((s, p) => s + p.montant, 0);
  const totalPaye = primes.filter(({ entree: e }) => e.paye).reduce((s, { entree: e }) => s + montant(e), 0)
    + surSalaire.filter((p) => p.versee).reduce((s, p) => s + p.montant, 0);

  // 💰 FAÇON CARNET (18/11/2026, aperçu validé par Timo, « Construit, lance ») :
  // deux petites cartes de totaux sur la ligne du titre, puis les primes de
  // chantier et les primes sur salaire CÔTE À CÔTE, en tableaux (sur téléphone :
  // une carte par prime). Les montants et les règles n'ont pas bougé.
  const detailChantier = (c, e) => (
    <>
      {e.prime_employe ? "prise sur la part de BMI" : `${e.pct} % des frais`}
      {e.paye
        ? ` — payé le ${dFR(e.date_paiement)}`
        : e.demande_prime
          ? ` — demandé le ${dFR(e.prime_demandee_le)}, en attente du paiement par ${e.prime_boutique}`
          : " — répartition enregistrée, pas encore demandé au paiement"}
    </>
  );
  const nomChantier = (c, e) => (
    <>Chantier {c.nom} {c.prenom || ""}{e.chef ? " ⭐ chef de chantier" : ""}
      {e.prime_employe && <span className="ml-1 text-xs font-semibold text-purple-700">🎁 prime sur chantier</span>}</>
  );
  const detailSalaire = (p) => (
    <>
      {p.versee ? "versée avec le salaire du mois" : "sera versée avec le salaire du mois"}
      {p.par ? ` · accordée par ${p.par}` : ""}{p.date ? ` le ${dFR(p.date)}` : ""}
    </>
  );

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-bold">💰 Mes primes</div>
          <div data-cartes-primes className="grid grid-cols-2 gap-3 flex-1 min-w-[260px] max-w-md">
            <div data-prime-total="attente" className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">⏳ En attente de paiement</div>
              <div className="text-xl font-bold tabular-nums">{fmt(enAttente)}</div>
            </div>
            <div data-prime-total="paye" className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">✅ Déjà payé</div>
              <div className="text-xl font-bold tabular-nums text-green-700">{fmt(totalPaye)}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div data-primes-colonnes className="grid lg:grid-cols-2 gap-4 items-start">
        <Panel>
          <CarteRepliable titre={`🔧 Mes primes de chantier (${primes.length})`}>
            {primes.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">Aucune prime de chantier pour l'instant.</div>}
            {primes.length > 0 && (
              <>
                <div className="hidden sm:block overflow-x-auto" data-primes-chantier-table>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-slate-500 uppercase">{["Chantier", "Détail", "Montant"].map((h) => <th key={h} className={`px-2 py-2 ${h === "Montant" ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                    <tbody>
                      {primes.map(({ client: c, entree: e }) => (
                        <tr key={`${c.id}-${e.user_id}`} data-prime-chantier-recue className={`border-t border-slate-100 ${e.paye ? "" : "bg-orange-50"}`}>
                          <td className="px-2 py-2 font-semibold">{nomChantier(c, e)}</td>
                          <td className="px-2 py-2 text-xs text-slate-500">{detailChantier(c, e)}</td>
                          <td className={`px-2 py-2 text-right font-bold tabular-nums ${e.paye ? "text-green-700" : "text-orange-600"}`}>{fmt(e.montant)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="sm:hidden space-y-2" data-primes-chantier-cartes>
                  {primes.map(({ client: c, entree: e }) => (
                    <div key={`${c.id}-${e.user_id}`} data-prime-chantier-carte className={`rounded-lg border px-3 py-2 ${e.paye ? "border-slate-200" : "border-orange-200 bg-orange-50"}`}>
                      <div className="flex items-center justify-between gap-2"><div className="font-semibold text-sm">{nomChantier(c, e)}</div>
                        <span className={`font-bold tabular-nums ${e.paye ? "text-green-700" : "text-orange-600"}`}>{fmt(e.montant)}</span></div>
                      <div className="text-xs text-slate-500 mt-0.5">{detailChantier(c, e)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CarteRepliable>
        </Panel>

        <Panel>
          <CarteRepliable titre={`💵 Mes primes sur salaire (${surSalaire.length})`}
            explication={surSalaire.length > 0 ? "Le détail de chaque mois reste dans 💵 Mon salaire." : null}>
            {surSalaire.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">Aucune prime sur salaire pour l'instant.</div>}
            {surSalaire.length > 0 && (
              <>
                <div className="hidden sm:block overflow-x-auto" data-primes-salaire-table>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-slate-500 uppercase">{["Salaire de", "Détail", "Montant"].map((h) => <th key={h} className={`px-2 py-2 ${h === "Montant" ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                    <tbody>
                      {surSalaire.map((p, i) => (
                        <tr key={`${p.mois}-${p.date}-${i}`} data-prime-salaire-recue className={`border-t border-slate-100 ${p.versee ? "" : "bg-orange-50"}`}>
                          <td className="px-2 py-2 font-semibold">{libelleMoisFR(p.mois)}{p.motif ? ` — ${p.motif}` : ""}</td>
                          <td className="px-2 py-2 text-xs text-slate-500">{detailSalaire(p)}</td>
                          <td className={`px-2 py-2 text-right font-bold tabular-nums ${p.versee ? "text-green-700" : "text-orange-600"}`}>{fmt(p.montant)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="sm:hidden space-y-2" data-primes-salaire-cartes>
                  {surSalaire.map((p, i) => (
                    <div key={`${p.mois}-${p.date}-${i}`} data-prime-salaire-carte className={`rounded-lg border px-3 py-2 ${p.versee ? "border-slate-200" : "border-orange-200 bg-orange-50"}`}>
                      <div className="flex items-center justify-between gap-2"><div className="font-semibold text-sm">Salaire de {libelleMoisFR(p.mois)}{p.motif ? ` — ${p.motif}` : ""}</div>
                        <span className={`font-bold tabular-nums ${p.versee ? "text-green-700" : "text-orange-600"}`}>{fmt(p.montant)}</span></div>
                      <div className="text-xs text-slate-500 mt-0.5">{detailSalaire(p)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CarteRepliable>
        </Panel>
      </div>
    </div>
  );
}
