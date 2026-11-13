// ============================================================
// components/HistoriquePaiements.jsx — 🧾 L'HISTORIQUE DES PAIEMENTS DE
// COMMISSION, écrit UNE fois pour 👑 Mon équipe (toutes les personnes que le
// compte peut lire, un choix par personne) et 💵 Ma commission (mes paiements
// seuls). Timo, 13/11/2026 : « A c, B b, C oui, lance ».
// La règle vit dans lib/historiqueCommissions.js ; ici, l'affichage (la règle
// des lignes : la première colonne figée, une ligne dépliée à la fois, le
// texte sur deux lignes puis entier au clic, le moyen en pastille) et le
// téléchargement : le PDF et l'Excel reprennent l'écran TEL QUEL.
// ============================================================
import { useState } from "react";
import { fmt, dFR, today } from "../lib/core";
import { LOGO } from "../lib/constants";
import { exportCSV } from "../lib/export";
import { genererHistoriqueCommissions } from "../pdf";
import { HistoriqueArchive } from "./HistoriqueArchive";
import { enTeteFige, celluleFigee, classeLigneDepliable, fondLigneDepliable, TexteDepliable, PastillePaiement } from "./ui";
import { filtrerPaiements, personnesDesPaiements, resumePaiements, entetesHistorique, lignesHistorique } from "../lib/historiqueCommissions";

// Le libellé d'une période, à l'écran, dans le PDF et dans le nom du fichier.
const NOMS_PERIODE = { mois: "Ce mois", annee: "Cette année", tout: "Depuis le début", perso: "Période choisie" };
export function periodeHistorique(id, du, au) {
  if (id === "tout") return { du, au, libelle: NOMS_PERIODE.tout, fichier: "depuis le début" };
  return {
    du, au,
    libelle: `${NOMS_PERIODE[id] || "Période"} (du ${dFR(du)} au ${dFR(au)})`,
    fichier: `du ${dFR(du).replace(/\//g, "-")} au ${dFR(au).replace(/\//g, "-")}`,
  };
}

// 📄 Le document : toute la liste, ou UNE personne (`cle`) — le relevé à
// remettre (un apporteur externe n'a pas de compte). `personne` : celle de
// 💵 Ma commission, dont la liste est déjà la sienne.
export function telechargerHistorique({ paiements = [], cle = "", periode = {}, formation = false, personne = null, excel = false }) {
  const liste = cle ? filtrerPaiements(paiements, { cle }) : paiements;
  const qui = personne || (cle ? personnesDesPaiements(liste)[0] || null : null);
  const avecBeneficiaire = !qui;
  const entetes = entetesHistorique({ avecBeneficiaire });
  const lignes = lignesHistorique(liste, { avecBeneficiaire });
  if (excel) {
    const nom = qui ? `releve_commissions_${String(qui.nom || "").toLowerCase().replace(/[^a-z0-9]+/g, "_")}` : "historique_commissions";
    exportCSV(nom, entetes, lignes, String(periode.fichier || "").replace(/\s+/g, "_"));
    return;
  }
  genererHistoriqueCommissions({ entetes, lignes, resume: resumePaiements(liste) }, {
    titre: qui ? `RELEVÉ DES COMMISSIONS - ${qui.nom}` : "HISTORIQUE DES PAIEMENTS DE COMMISSION",
    beneficiaire: qui ? `${qui.nom}${qui.tel ? ` - Tél : ${qui.tel}` : ""}` : "",
    periode: periode.libelle, logo: LOGO, formation, edite: dFR(today()),
    fichier: { type: qui ? "Relevé des commissions" : "Historique des commissions", client: qui ? qui.nom : "toutes les personnes", numero: periode.fichier },
  });
}

const TEINTE_TYPE = {
  commission: "bg-sky-50 text-sky-800 border-sky-200",
  commission_equipe: "bg-sky-50 text-sky-800 border-sky-200",
  apporteur: "bg-emerald-50 text-emerald-800 border-emerald-200",
  parrain: "bg-emerald-50 text-emerald-800 border-emerald-200",
  installation: "bg-amber-50 text-amber-800 border-amber-200",
  prime_chantier: "bg-amber-50 text-amber-800 border-amber-200",
};

export function HistoriquePaiements({ paiements = [], periode = {}, formation = false, avecBeneficiaire = true, personne = null,
  titre = "🧾 Historique des paiements de commission", note = "", personneInitiale = "", ligneDeplieeInitiale = null }) {
  const [choix, setChoix] = useState(personneInitiale);
  const [deplie, setDeplie] = useState(ligneDeplieeInitiale);
  const personnes = avecBeneficiaire ? personnesDesPaiements(paiements) : [];
  // Une personne choisie qui n'a plus rien sur la période : on revient à toutes.
  const choisie = personnes.some((p) => p.cle === choix) ? choix : "";
  const liste = choisie ? filtrerPaiements(paiements, { cle: choisie }) : paiements;
  const res = resumePaiements(liste);
  const colonnes = [...(avecBeneficiaire ? ["Bénéficiaire"] : []), "Date", "Type", "Pour", "Montant versé", "Moyen · caisse", "Payé par"];
  const telecharger = (excel) => telechargerHistorique({ paiements, cle: choisie, periode, formation, personne, excel });
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm" data-historique-paiements={avecBeneficiaire ? "equipe" : "moi"}>
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold text-slate-800">{titre}
          <span className="ml-2 text-xs font-semibold text-green-700 whitespace-nowrap" data-total-historique>total versé : {fmt(res.total)} · {res.nb} paiement{res.nb > 1 ? "s" : ""}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {personnes.length > 0 && (
            <select className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" value={choisie} onChange={(e) => setChoix(e.target.value)} data-choix-personne>
              <option value="">Toutes les personnes ({personnes.length})</option>
              {personnes.map((p) => <option key={p.cle} value={p.cle}>{p.nom}{p.tel ? ` (${p.tel})` : ""} — {p.nb}</option>)}
            </select>
          )}
          <button onClick={() => telecharger(false)} data-pdf-historique className="px-3 py-1.5 rounded-lg bg-sky-800 text-white text-sm font-bold hover:bg-sky-900">
            📄 {avecBeneficiaire ? (choisie ? "Relevé de cette personne (PDF)" : "Télécharger en PDF") : "Télécharger mon relevé (PDF)"}
          </button>
          <button onClick={() => telecharger(true)} data-excel-historique className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50">Excel</button>
        </div>
      </div>
      <div className="px-4 py-2 text-xs text-slate-500" data-note-historique>
        {periode.libelle ? <>Période : <b>{periode.libelle}</b>. </> : null}
        Chaque ligne est un paiement réellement fait (commissions et primes d'installation) ; un paiement annulé n'y est plus.{note ? ` ${note}` : ""}
      </div>
      <HistoriqueArchive lignes={liste} dateDe={(p) => p.date} aujourdhui={today()} vide="Aucun paiement sur cette période." titreArchives="Paiements archivés" classeTable="w-full text-sm min-w-[860px]"
        entete={<thead className="sticky top-0 bg-white"><tr className="text-xs text-slate-500 uppercase">{colonnes.map((h, i) => (
          <th key={h} className={`px-3 py-2 bg-white ${h === "Montant versé" ? "text-right" : "text-left"}${i === 0 ? ` ${enTeteFige("bg-white")}` : ""}`}>{h}</th>
        ))}</tr></thead>}
        rendre={(p, i) => {
          const ouvert = deplie === p.id;
          const fond = fondLigneDepliable(ouvert, i);
          const premiere = `px-3 py-2 ${celluleFigee(fond, ouvert)}`;
          return (
            <tr key={p.id} data-ligne={p.id} data-paiement={p.type} onClick={() => setDeplie(ouvert ? null : p.id)}
              className={`border-t border-slate-100 align-top cursor-pointer ${classeLigneDepliable(ouvert, i)}`}>
              {avecBeneficiaire && (
                <td className={`${premiere} font-semibold min-w-[150px]`}>{p.beneficiaire}{p.tel && <div className="text-xs font-normal text-slate-500">{p.tel}</div>}</td>
              )}
              <td className={`${avecBeneficiaire ? "px-3 py-2" : premiere} whitespace-nowrap`}>{dFR(p.date)}{p.heure && <div className="text-xs text-slate-500">{p.heure}</div>}</td>
              <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${TEINTE_TYPE[p.type] || "bg-slate-50 text-slate-700 border-slate-200"}`}>{p.libelleType}</span></td>
              <td className="px-3 py-2"><TexteDepliable texte={p.pour} deplie={ouvert} /></td>
              <td className="px-3 py-2 text-right tabular-nums font-bold whitespace-nowrap" data-montant-paiement>{fmt(p.montant)}
                {p.retenue > 0 && <div className="text-xs font-semibold text-orange-700" data-retenue-paiement>part {fmt(p.part)} − {fmt(p.retenue)} retenus (outil perdu)</div>}
              </td>
              <td className="px-3 py-2"><PastillePaiement paiement={p.moyen} />{p.caisse && <div className="text-xs text-slate-500 mt-0.5">{p.caisse}</div>}</td>
              <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{p.par || "—"}</td>
            </tr>
          );
        }} />
    </div>
  );
}
