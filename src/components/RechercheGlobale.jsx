// ============================================================
// components/RechercheGlobale.jsx — Recherche transversale (ventes,
// produits, devis, clients, prospects) avec la même visibilité que
// les écrans respectifs. Aiguillage rapide, pas un rapport complet.
// ============================================================
import { useState } from "react";
import { Ventes } from "../screens/Ventes";
import { Clients } from "../screens/Clients";
import { totalVente, numeroRecu, fmt, col } from "../lib/core";
import { Badge } from "../components/ui";
import { normNom } from "../lib/calculs";

// ============ RECHERCHE GLOBALE ============
// Cherche en même temps dans les ventes, produits, devis, clients et
// prospects — chacun dans la même visibilité que son propre écran (un
// vendeur ne voit que sa boutique, un commercial que ses propres prospects
// et devis, etc.). Limité à quelques résultats par catégorie : c'est un
// aiguillage rapide, pas un rapport complet.
function rechercherGlobalement(db, profile, texte) {
  const q = normNom(texte);
  if (q.length < 2) return null;
  const isAdmin = profile.role === "admin";
  const voitToutDevis = isAdmin || profile.role === "resp_commercial";
  const voitToutProspects = isAdmin || profile.chef_equipe || profile.role === "resp_commercial";
  const maBoutique = profile.boutique;

  const clients = db.users
    .filter((u) => u.role === "client" && u.actif !== false)
    .filter((u) => normNom(`${u.nom_base || u.nom} ${u.tel || ""}`).includes(q))
    .slice(0, 6);

  const ventes = (db.ventes || [])
    .filter((v) => !maBoutique || v.boutique === maBoutique)
    .filter((v) => normNom(`${numeroRecu(v)} ${v.client || ""} ${v.tel || ""}`).includes(q))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 6);

  const produits = (db.produits || [])
    .filter((p) => !maBoutique || p.boutique === maBoutique)
    .filter((p) => normNom(`${p.nom} ${p.code || ""}`).includes(q))
    .slice(0, 6);

  const devis = db.users
    .filter((u) => u.role === "client")
    .flatMap((u) => (u.devis || []).map((d) => ({ ...d, client: u })))
    .filter((d) => voitToutDevis || d.par_id === profile.id)
    .filter((d) => normNom(`${d.client?.nom_base || d.client?.nom || ""} ${libelleTypeDevis(d)}`).includes(q))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 6);

  const prospects = (db.prospects || [])
    .filter((p) => voitToutProspects || p.commercial === profile.nom)
    .filter((p) => normNom(`${p.nom} ${p.tel || ""}`).includes(q))
    .slice(0, 6);

  const total = clients.length + ventes.length + produits.length + devis.length + prospects.length;
  return { clients, ventes, produits, devis, prospects, total };
}

// Modale de recherche globale : ouverte depuis la loupe toujours visible en
// haut de l'application. Cherche en direct dans plusieurs catégories à la
// fois, et amène à l'onglet correspondant d'un clic.
export function RechercheGlobale({ db, profile, onFermer, onNaviguer }) {
  const [texte, setTexte] = useState("");
  const resultats = rechercherGlobalement(db, profile, texte);

  const Categorie = ({ titre, tab, items, rendu }) => items.length === 0 ? null : (
    <div className="mb-3">
      <div className="text-xs font-bold text-slate-500 uppercase px-1 mb-1">{titre}</div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <button key={i} onClick={() => onNaviguer(tab)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-sky-50 border border-slate-100 flex items-center justify-between gap-2">
            {rendu(item)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 pt-16 sm:pt-24" onClick={onFermer}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-slate-200 flex items-center gap-2">
          <span className="text-slate-400">🔍</span>
          <input
            autoFocus
            className="flex-1 outline-none text-sm py-1"
            placeholder="Chercher un client, une vente, un produit, un devis, un prospect…"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
          />
          <button onClick={onFermer} className="px-2 py-1 rounded-lg text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>
        <div className="overflow-y-auto p-3">
          {texte.trim().length < 2 ? (
            <div className="text-sm text-slate-400 text-center py-8">Tapez au moins 2 lettres pour lancer la recherche.</div>
          ) : resultats.total === 0 ? (
            <div className="text-sm text-slate-400 text-center py-8">Aucun résultat pour « {texte} ».</div>
          ) : (
            <>
              <Categorie titre="👤 Clients" tab="clients" items={resultats.clients} rendu={(u) => (
                <>
                  <span className="font-semibold text-sm">{u.nom_base || u.nom}</span>
                  <span className="text-xs text-slate-400">{u.tel || ""}</span>
                </>
              )} />
              <Categorie titre="🧾 Ventes" tab="ventes" items={resultats.ventes} rendu={(v) => (
                <>
                  <span className="text-sm"><span className="font-mono text-xs text-slate-500">{numeroRecu(v)}</span> — <span className="font-semibold">{v.client || "Client"}</span></span>
                  <span className="text-xs font-bold text-sky-800 whitespace-nowrap">{fmt(totalVente(v))}</span>
                </>
              )} />
              <Categorie titre="📦 Produits" tab="stocks" items={resultats.produits} rendu={(p) => (
                <>
                  <span className="font-semibold text-sm">{p.nom}</span>
                  <Badge boutique={p.boutique} />
                </>
              )} />
              <Categorie titre="📋 Devis" tab="tous_devis" items={resultats.devis} rendu={(d) => (
                <>
                  <span className="text-sm"><span className="font-semibold">{d.client?.nom_base || d.client?.nom}</span> — {libelleTypeDevis(d)}</span>
                  <span className="text-xs font-bold text-sky-800 whitespace-nowrap">{fmt(d.total)}</span>
                </>
              )} />
              <Categorie titre="🧲 Prospects" tab="prospects" items={resultats.prospects} rendu={(p) => (
                <>
                  <span className="font-semibold text-sm">{p.nom}</span>
                  <span className="text-xs text-slate-400">{p.tel || ""}</span>
                </>
              )} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
