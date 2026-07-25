// ============================================================
// components/Selecteurs.jsx — Sélecteur de boutique par onglets, et
// sélecteur d'article avec recherche tactile (sans menu natif).
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { createPortal } from "react-dom";
import { inputCls } from "./ui";
import { boutiquesVente } from "../lib/calculs";

// ============ SÉLECTEUR BOUTIQUE ============
export function BoutiqueTabs({ db, value, onChange, avecDepots = false }) {
  const liste = avecDepots ? db.boutiques : boutiquesVente(db);
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {liste.map((b) => (
        <button key={b.nom} onClick={() => onChange(b.nom)}
          className={`px-4 py-1.5 rounded-full text-sm font-bold ${value === b.nom ? "text-white" : "bg-white border border-slate-300 text-slate-600"}`}
          style={value === b.nom ? { backgroundColor: b.couleur } : {}}>{b.depot ? "🏭 " : ""}{b.nom}</button>
      ))}
    </div>
  );
}

// ============ SÉLECTEUR D'ARTICLE (recherche tactile, sans menu natif) ============
export function SelecteurArticle({ produits, valeur, onChoisir, dispoRestant, categorieFiltre }) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const selectionne = produits.find((p) => p.id === valeur);
  const base = categorieFiltre ? produits.filter((p) => (p.categorie || "Autre") === categorieFiltre) : produits;
  const filtres = recherche ? base.filter((p) => p.nom.toLowerCase().includes(recherche.toLowerCase())) : base;
  const categories = [...new Set(filtres.map((p) => p.categorie || "Autre"))].sort();

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={`${inputCls} text-left flex items-center justify-between`}>
        <span className={selectionne ? "" : "text-slate-400"}>{selectionne ? selectionne.nom : "— Choisir un article —"}</span>
        <span className="text-slate-400">▾</span>
      </button>
      {ouvert && createPortal(
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => { setOuvert(false); setRecherche(""); }}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-slate-200">
              <input autoFocus className={inputCls} placeholder="🔍 Rechercher un article…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            </div>
            <div className="overflow-y-auto flex-1">
              {filtres.length === 0 && <div className="p-6 text-sm text-slate-400 text-center">Aucun article trouvé.</div>}
              {categories.map((c) => (
                <div key={c}>
                  <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50 sticky top-0">{c}</div>
                  {filtres.filter((p) => (p.categorie || "Autre") === c).map((p) => (
                    <button key={p.id} type="button" onClick={() => { onChoisir(p.id); setOuvert(false); setRecherche(""); }}
                      className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between">
                      <span className="font-medium">{p.nom}</span>
                      <span className="text-xs text-slate-400 whitespace-nowrap ml-2">dispo : {dispoRestant(p)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => { setOuvert(false); setRecherche(""); }} className="p-3 text-sm font-semibold text-slate-500 border-t border-slate-200">Fermer</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
