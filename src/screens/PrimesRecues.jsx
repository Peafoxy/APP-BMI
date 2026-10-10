// ============================================================
// screens/PrimesRecues.jsx — Mes primes : la part d'installation (technicien
// à commission ou BMI), la prime sur chantier (employé de boutique) et la
// prime sur salaire (tout salarié), en attente ou déjà payées.
// ⚠ Timo (10/10/2026, « A b, B a, C a ») : l'onglet passe à TOUT rôle qui
// peut recevoir une prime (ROLES_PRIMES_RECUES) ; 💵 Ma commission et
// 💵 Mon salaire gardent aussi les leurs.
// ============================================================
import { fmt, dFR } from "../lib/core";
import { Panel } from "../components/ui";
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

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Panel>
          <div className="text-xs font-semibold text-slate-500 uppercase">⏳ En attente de paiement</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{fmt(enAttente)}</div>
        </Panel>
        <Panel>
          <div className="text-xs font-semibold text-slate-500 uppercase">✅ Déjà payé</div>
          <div className="text-2xl font-bold mt-1 tabular-nums text-green-700">{fmt(totalPaye)}</div>
        </Panel>
      </div>

      <Panel>
        <div className="font-bold mb-3">🔧 Mes primes de chantier</div>
        {primes.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">Aucune prime de chantier pour l'instant.</div>}
        <div className="space-y-2">
          {primes.map(({ client: c, entree: e }) => (
            <div key={`${c.id}-${e.user_id}`} data-prime-chantier-recue className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 flex-wrap ${e.paye ? "border-slate-200" : "border-orange-200 bg-orange-50"}`}>
              <div>
                <div className="font-semibold text-sm">
                  Chantier {c.nom} {c.prenom || ""}{e.chef ? " ⭐ chef de chantier" : ""}
                  {e.prime_employe && <span className="ml-1 text-xs font-semibold text-purple-700">🎁 prime sur chantier</span>}
                </div>
                <div className="text-xs text-slate-500">
                  {e.prime_employe ? "prise sur la part de BMI" : `${e.pct} % des frais`}
                  {e.paye
                    ? ` — payé le ${dFR(e.date_paiement)}`
                    : e.demande_prime
                      ? ` — demandé le ${dFR(e.prime_demandee_le)}, en attente du paiement par ${e.prime_boutique}`
                      : " — répartition enregistrée, pas encore demandé au paiement"}
                </div>
              </div>
              <span className={`font-bold tabular-nums ${e.paye ? "text-green-700" : "text-orange-600"}`}>{fmt(e.montant)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="font-bold mb-3">💵 Mes primes sur salaire</div>
        {surSalaire.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">Aucune prime sur salaire pour l'instant.</div>}
        <div className="space-y-2">
          {surSalaire.map((p, i) => (
            <div key={`${p.mois}-${p.date}-${i}`} data-prime-salaire-recue className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 flex-wrap ${p.versee ? "border-slate-200" : "border-orange-200 bg-orange-50"}`}>
              <div>
                <div className="font-semibold text-sm">Salaire de {libelleMoisFR(p.mois)}{p.motif ? ` — ${p.motif}` : ""}</div>
                <div className="text-xs text-slate-500">
                  {p.versee ? "versée avec le salaire du mois" : "sera versée avec le salaire du mois"}
                  {p.par ? ` · accordée par ${p.par}` : ""}{p.date ? ` le ${dFR(p.date)}` : ""}
                </div>
              </div>
              <span className={`font-bold tabular-nums ${p.versee ? "text-green-700" : "text-orange-600"}`}>{fmt(p.montant)}</span>
            </div>
          ))}
        </div>
        {surSalaire.length > 0 && <div className="mt-2 text-xs text-slate-400">Le détail de chaque mois reste dans 💵 Mon salaire.</div>}
      </Panel>
    </div>
  );
}
