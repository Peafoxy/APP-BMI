// ============================================================
// screens/PrimesRecues.jsx — Le technicien suit ses primes
// d'installation : en attente de validation, ou déjà payées.
// ============================================================
import { fmt, dFR } from "../lib/core";
import { Panel } from "../components/ui";
import { primesDeTechnicien } from "../lib/calculs";

export function PrimesRecues({ db, profile }) {
  const primes = primesDeTechnicien(db, profile.id);
  const enAttente = primes.filter(({ entree: e }) => !e.paye);
  const payees = primes.filter(({ entree: e }) => e.paye);
  const totalPaye = payees.reduce((s, { entree: e }) => s + Number(e.montant || 0), 0);
  const totalEnAttente = enAttente.reduce((s, { entree: e }) => s + Number(e.montant || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Panel>
          <div className="text-xs font-semibold text-slate-500 uppercase">⏳ En attente de paiement</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{fmt(totalEnAttente)}</div>
        </Panel>
        <Panel>
          <div className="text-xs font-semibold text-slate-500 uppercase">✅ Déjà payé</div>
          <div className="text-2xl font-bold mt-1 tabular-nums text-green-700">{fmt(totalPaye)}</div>
        </Panel>
      </div>

      <Panel>
        <div className="font-bold mb-3">💰 Mes primes d'installation</div>
        {primes.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">Aucune prime d'installation pour l'instant.</div>}
        <div className="space-y-2">
          {primes.map(({ client: c, entree: e }) => (
            <div key={`${c.id}-${e.user_id}`} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 flex-wrap ${e.paye ? "border-slate-200" : "border-orange-200 bg-orange-50"}`}>
              <div>
                <div className="font-semibold text-sm">Chantier {c.nom} {c.prenom || ""}{e.chef ? " ⭐ chef de chantier" : ""}</div>
                <div className="text-xs text-slate-500">
                  {e.pct} % des frais
                  {e.paye
                    ? ` — payé le ${dFR(e.date_paiement)}`
                    : e.demande_prime
                      ? ` — demandé le ${dFR(e.prime_demandee_le)}, en attente du vendeur de ${e.prime_boutique}`
                      : " — répartition enregistrée, pas encore demandé au paiement"}
                </div>
              </div>
              <span className={`font-bold tabular-nums ${e.paye ? "text-green-700" : "text-orange-600"}`}>{fmt(e.montant)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
