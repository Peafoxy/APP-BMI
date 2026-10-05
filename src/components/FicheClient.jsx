// 🗂 LA FICHE D'UN CLIENT, OUVERTE D'UN CLIC DANS 📋 CLIENTS (05/10/2026).
// Timo : « possible d'avoir l'historique des achats du client et d'autres
// activités liées au client quand on clique sur sa fiche ? » → « b, lance » :
// TOUTES les boutiques de l'espace regardé, une colonne « Boutique ».
//
// ⚠ UNE source : `ficheClientDeLEspace` (calculs.js) → `dossierClient`, le
// même calcul que le dossier du droit d'accès. Deux façons de reconnaître un
// client finiraient par ne pas retrouver les mêmes lignes.
// ⚠ LECTURE SEULE : encaisser, relancer, reprendre restent dans leurs écrans.
// Seul geste : réimprimer un reçu (le même chemin que 💰 Ventes).
// ⚠ Jamais les messages, jamais le mot de passe.
import { fmt, dFR, totalVente, lignesVente, lignesDette, reprisesDe } from "../lib/core";
import { ficheClientDeLEspace, ventesDeProforma, estReservation, resteAPayer, statutChantier } from "../lib/calculs";
import { STATUT_DEVIS, STATUT_CHANTIER } from "../lib/libellesStatuts";
import { imprimerRecuDeVente } from "../lib/impression";
import { boutonAction } from "./ui";

const parDate = (a, b) => `${b.date || ""} ${b.heure || ""}`.localeCompare(`${a.date || ""} ${a.heure || ""}`);
const articles = (lignes) => lignes.map((l) => `${l.qte ?? ""}${l.qte != null ? "× " : ""}${l.article || l.nom || ""}`).join(", ");

// Une section : son titre et son nombre ; vide, elle le DIT (on sait alors
// que rien n'a été oublié).
function Section({ titre, vide, colonnes, lignes, droite = [] }) {
  return (
    <div className="mt-3" data-section-fiche={titre}>
      <div className="text-xs font-bold text-slate-700 uppercase">{titre} <span className="font-normal text-slate-500">({lignes.length})</span></div>
      {lignes.length === 0
        ? <div className="text-xs text-slate-400 mt-1">{vide}</div>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs mt-1 min-w-[640px]">
              <thead><tr className="text-slate-500">{colonnes.map((c, i) => <th key={c} className={`px-2 py-1 font-semibold ${droite.includes(i) ? "text-right" : "text-left"}`}>{c}</th>)}</tr></thead>
              <tbody>{lignes.map((l, k) => <tr key={k} className="border-t border-slate-200 align-top">{l.map((x, i) => <td key={i} className={`px-2 py-1 ${droite.includes(i) ? "text-right tabular-nums" : ""}`}>{x}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
    </div>
  );
}

export function FicheClient({ db, profile, cible }) {
  const d = ficheClientDeLEspace(db, profile, cible);
  const c = d.compte;
  const ventes = [...d.ventes].sort(parDate);
  const dettes = [...d.dettes].sort(parDate);
  const totalAchete = ventes.reduce((s, v) => s + totalVente(v), 0);
  const infoBq = (nom) => (db.boutiques || []).find((b) => b.nom === nom) || {};
  const entreprise = c?.entreprise?.nom || ventes.find((v) => v.entreprise?.nom)?.entreprise?.nom;
  const dates = ventes.map((v) => v.date).filter(Boolean).sort();

  return (
    <div className="px-4 py-3 bg-sky-50/60 border-l-4 border-sky-700" data-fiche-client>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span><b>{cible.nom}</b>{c?.nom_complet ? ` — ${c.nom_complet}` : ""}</span>
        <span>📞 {cible.tel || "—"}</span>
        {entreprise && <span>🏢 {entreprise}</span>}
        <span>{c ? `👤 Compte client${c.amene_par_nom ? ` (créé par ${c.amene_par_nom})` : ""}` : "Pas de compte client"}</span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mt-1">
        <span>Total acheté : <b>{fmt(totalAchete)}</b></span>
        <span>Dette en cours : <b className={d.reste > 0 ? "text-red-600" : "text-green-700"}>{fmt(d.reste)}</b></span>
        {dates.length > 0 && <span>Premier achat : {dFR(dates[0])} · Dernier : {dFR(dates[dates.length - 1])}</span>}
      </div>
      <div className="text-[11px] text-slate-500 mt-1">Toutes les boutiques de l'espace. Lecture seule : encaisser, relancer ou reprendre se fait dans leurs écrans.</div>

      <Section titre="🛒 Achats" vide="Aucun achat."
        colonnes={["Date", "N° de reçu", "Boutique", "Articles", "Total", "Paiement", ""]} droite={[4]}
        lignes={ventes.map((v) => [
          `${dFR(v.date)}${v.heure ? ` ${v.heure}` : ""}`, v.numero || "—", v.boutique || "—",
          <>{articles(lignesVente(v))}{reprisesDe(v).length > 0 && <div className="text-amber-700">↩ {reprisesDe(v).length} reprise(s)</div>}</>,
          fmt(totalVente(v)), v.paiement || "—",
          <button onClick={() => imprimerRecuDeVente(db, v, infoBq(v.boutique), db.produits)} className={boutonAction("text-sky-800 bg-white border-sky-200 hover:bg-sky-100")} title="Réimprimer le reçu" aria-label="Réimprimer le reçu" data-reimprimer>🖨</button>,
        ])} />

      <Section titre="📋 Dettes, réservations et versements" vide="Aucune dette."
        colonnes={["Date", "N°", "Boutique", "Objet", "Montant", "Versé", "Reste", "Versements"]} droite={[4, 5, 6]}
        lignes={dettes.map((t) => [
          dFR(t.date), t.numero || "—", t.boutique || "—",
          <>{estReservation(t) && <b>Réservation · </b>}{articles(lignesDette(t)) || t.motif || "—"}</>,
          fmt(t.montant || 0), fmt(t.paye || 0),
          <b className={resteAPayer(t) > 0 ? "text-red-600" : "text-green-700"}>{fmt(resteAPayer(t))}</b>,
          (t.paiements || []).length ? (t.paiements || []).map((p, i) => <div key={i}>{dFR(p.date)} · {fmt(p.montant || 0)}{p.paiement ? ` · ${p.paiement}` : ""}</div>) : "—",
        ])} />

      <Section titre="🧾 Proformas" vide="Aucune proforma."
        colonnes={["Date", "N°", "Boutique", "Articles", "Total", "Devenue"]} droite={[4]}
        lignes={[...d.proformas].sort(parDate).map((p) => {
          const v = ventesDeProforma(db, p)[0];
          return [dFR(p.date), p.numero || "—", p.boutique || "—", articles(lignesVente(p)), fmt(totalVente(p)),
            v ? `✅ Encaissée le ${dFR(v.date)}${v.numero ? ` — reçu ${v.numero}` : ""}` : "⏳ En attente"];
        })} />

      <Section titre="📦 Commandes" vide="Aucune commande."
        colonnes={["Date", "Boutique", "Articles", "Total", "Statut"]} droite={[3]}
        lignes={[...d.commandes].sort(parDate).map((o) => [dFR(o.date), o.boutique || "—", articles(lignesVente(o)), fmt(totalVente(o)),
          o.statut === "validee" ? "✓ Validée" : o.statut === "refusee" ? "✗ Refusée" : "⏳ En attente"])} />

      <Section titre="📄 Devis" vide={c ? "Aucun devis." : "Aucun devis (pas de compte client)."}
        colonnes={["Date", "Montant", "Statut"]} droite={[1]}
        lignes={[...(c?.devis || [])].filter(Boolean).sort(parDate).map((v) => [dFR(v.date), fmt(v.total || 0), (STATUT_DEVIS[v.statut || "propose"] || STATUT_DEVIS.propose)[0]])} />

      <Section titre="🏠 Chantiers" vide="Aucun chantier."
        colonnes={["Installé le", "Installation", "Statut", "Réception", "Garantie", "Prochain entretien"]}
        lignes={[...d.chantiers].sort((a, b) => String(b.date_installation || "").localeCompare(String(a.date_installation || ""))).map((x) => [
          dFR(x.date_installation), x.type_installation || "—", (STATUT_CHANTIER[statutChantier(x)] || STATUT_CHANTIER.en_cours).label,
          x.receptionne_le ? dFR(x.receptionne_le) : "—", x.garantie_mois ? `${x.garantie_mois} mois` : "—", x.date_entretien ? dFR(x.date_entretien) : "—",
        ])} />
    </div>
  );
}
