// ============================================================
// screens/PrimesRemises.jsx — Le vendeur d'une boutique valide et
// paie les demandes de prime d'installation adressées à SA caisse
// (demande Timo : plus besoin de l'administrateur à chaque fois).
// ============================================================
import { useState } from "react";
import { fmt, dFR } from "../lib/core";
import { Panel, uAlert, uConfirm, uPrompt } from "../components/ui";
import { bloquerSiLecture, primesEnAttente, construirePaiementPrime } from "../lib/calculs";

export function PrimesRemises({ db, save, profile }) {
  const isAdmin = profile.role === "admin";
  const [bq, setBq] = useState(profile.boutique || "");
  const boutique = profile.boutique || bq;
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);

  if (!boutique) {
    return <Panel><div className="text-slate-500 text-sm">Aucune boutique rattachée à votre compte — cet onglet est réservé au vendeur d'une boutique précise.</div></Panel>;
  }

  const enAttente = primesEnAttente(db, boutique);
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
    const moyen = await uPrompt(`Moyen de paiement pour ${e.nom} (Espèces / Flooz / Mixx / Virement bancaire) :`, "Espèces");
    if (moyen === null) return;
    if (!await uConfirm(`Payer ${fmt(e.montant)} à ${e.nom} pour l'installation de ${c.nom} ${c.prenom || ""} ?\n\nSortie de caisse ${boutique} : ${fmt(e.montant)}`)) return;
    save(construirePaiementPrime(db, profile, c, e, moyen), `Prime d'installation validée et payée — ${e.nom} · ${fmt(e.montant)} · ${boutique}`);
    uAlert(`✅ ${fmt(e.montant)} payés à ${e.nom}.`);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-1">💰 Primes remises — {boutique}</div>
        <div className="text-xs text-slate-500 mb-3">Demandes de paiement de prime d'installation adressées à la caisse de cette boutique. Valider déclenche la vraie sortie de caisse et prévient le technicien.</div>

        {enAttente.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">Aucune demande en attente pour l'instant.</div>}

        <div className="space-y-2">
          {enAttente.map(({ client: c, entree: e }) => (
            <div key={`${c.id}-${e.user_id}`} className="flex items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 flex-wrap">
              <div>
                <div className="font-semibold text-sm">{e.nom}{e.chef ? " ⭐" : ""} <span className="text-slate-400 font-normal">· chantier {c.nom} {c.prenom || ""}</span></div>
                <div className="text-xs text-slate-500">Demandé le {dFR(e.prime_demandee_le)} par {e.prime_demandee_par}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold tabular-nums">{fmt(e.montant)}</span>
                <button onClick={() => valider({ client: c, entree: e })} className="text-xs font-bold text-white bg-emerald-700 rounded-lg px-3 py-1.5 hover:bg-emerald-800">✓ Valider et payer</button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <button onClick={() => setHistoriqueOuvert(!historiqueOuvert)} className="font-bold text-sm text-slate-700">
          {historiqueOuvert ? "▾" : "▸"} Historique des primes déjà payées par cette boutique ({historique.length})
        </button>
        {historiqueOuvert && (
          <div className="mt-3 space-y-1">
            {historique.length === 0 && <div className="text-sm text-slate-400">Aucune prime payée par cette boutique pour l'instant.</div>}
            {historique.map(({ client: c, entree: e }) => (
              <div key={`${c.id}-${e.user_id}`} className="flex items-center justify-between text-sm border-t border-slate-100 py-2">
                <span>{e.nom} · chantier {c.nom} {c.prenom || ""} <span className="text-slate-400">— payé le {dFR(e.date_paiement)}</span></span>
                <span className="font-bold tabular-nums">{fmt(e.montant)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
