// ============================================================
// components/CompleterDevis.jsx — « ✍️ Compléter le devis » après la visite
// (Timo, 08/10/2026 : « après c'est à compléter et non modifié »).
//
// Une ligne par élément « cf. visite » : l'article (proposé dans le stock de
// la boutique du devis, ou tapé librement), la quantité, le prix — ou
// « sans objet ». Des lignes découvertes à la visite peuvent s'ajouter. Les
// lignes déjà chiffrées ne s'affichent même pas ici : elles ne bougent pas.
// Le nouveau total se lit avant d'enregistrer (la VRAIE règle,
// completerDevis, jamais un calcul à part). L'écran ne décide rien : le geste
// (📋 Tous les devis) revérifie tout sur la fiche fraîche.
// ============================================================
import { useState } from "react";
import { ChampSuggestions } from "./ChampSuggestions";
import { Field, inputCls } from "./ui";
import { fmt } from "../lib/core";
import { lignesCfVisite } from "../lib/devisCfVisite";
import { completerDevis, lierAutreAuStock } from "../screens/dimensionnement/devisCommun";

const ligneVide = () => ({ nom: "", qte: "1", prix: "", produit_id: null, hors_boutique: true });

export function CompleterDevis({ devis, produits = [], onAnnuler, onEnregistrer }) {
  const cf = lignesCfVisite(devis);
  const [reponses, setReponses] = useState(() => cf.map((l) => ({ ...ligneVide(), nom: l.article || "", qte: l.qte ? String(l.qte) : "1" })));
  const [ajouts, setAjouts] = useState([]);
  const propositions = produits.map((p) => ({ cle: p.id, valeur: p.nom, detail: fmt(p.prix_vente) }));
  // Le NOM passe par la règle des autres équipements : un nom du stock lie la
  // ligne (prix pré-rempli), un nom libre la laisse libre et HB.
  const maj = (liste, setListe, i, champ, val) => setListe(liste.map((r, k) => (k !== i ? r
    : champ === "nom" ? (() => { const l = lierAutreAuStock(r, val, produits); return r.produit_id && !l.produit_id ? { ...l, prix: "" } : l; })()
    : { ...r, [champ]: val })));
  const apercu = completerDevis(devis, { reponses, ajouts, produits, par: "", par_id: "", le: "" });

  const champs = (r, i, liste, setListe, retirer) => (
    <>
      <Field label="Article">
        <ChampSuggestions valeur={r.nom} suggestions={propositions} onChange={(v) => maj(liste, setListe, i, "nom", v)} placeholder="Article du stock ou nom libre" />
      </Field>
      <Field label="Quantité"><input type="number" min="1" className={inputCls} value={r.qte} onChange={(e) => maj(liste, setListe, i, "qte", e.target.value)} /></Field>
      <Field label="Prix unitaire (F)"><input type="number" min="0" className={inputCls} value={r.prix} onChange={(e) => maj(liste, setListe, i, "prix", e.target.value)} /></Field>
      <div className="text-xs text-slate-500 pb-2">{r.produit_id ? "✓ article du stock" : r.nom ? "hors boutique (HB)" : ""}</div>
      {retirer}
    </>
  );

  return (
    <div className="mt-3 rounded-xl border-2 border-amber-300 bg-white p-3" data-completer-devis>
      <div className="font-bold text-amber-900">✍️ Compléter le devis après la visite</div>
      <div className="text-xs text-slate-600 mb-3">
        Chiffrez chaque élément « cf. visite », ou marquez-le <b>sans objet</b>. Les lignes déjà chiffrées ne changent pas.
        Le devis garde son numéro et repart au client.
      </div>
      <div className="space-y-3">
        {cf.map((l, i) => (
          <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-2" data-element-cf-visite>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <div className="text-sm font-bold text-amber-900">📋 {l.article}{l.qte ? ` — ${l.qte}` : ""}</div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <input type="checkbox" checked={!!reponses[i]?.sans_objet}
                  onChange={(e) => setReponses(reponses.map((r, k) => (k === i ? { ...r, sans_objet: e.target.checked } : r)))} />
                Sans objet (finalement pas nécessaire)
              </label>
            </div>
            {!reponses[i]?.sans_objet && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">{champs(reponses[i], i, reponses, setReponses, null)}</div>
            )}
          </div>
        ))}
        {ajouts.map((a, i) => (
          <div key={`a${i}`} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end rounded-lg border border-slate-200 p-2" data-ajout-visite>
            {champs(a, i, ajouts, setAjouts,
              <button onClick={() => setAjouts(ajouts.filter((_, k) => k !== i))} className="text-xs text-red-600 underline pb-2">Retirer</button>)}
          </div>
        ))}
      </div>
      <button onClick={() => setAjouts([...ajouts, ligneVide()])} className="mt-2 text-sm font-bold text-sky-800 underline">➕ Ajouter une ligne découverte à la visite</button>
      <div className="mt-3 flex items-center justify-between flex-wrap gap-2 border-t border-slate-200 pt-3">
        <div className="text-sm" data-apercu-completion>
          Total provisoire : <b>{fmt(devis.total)}</b>
          {apercu.devis ? <> → total du devis complété : <b className="text-sky-800">{fmt(apercu.devis.total)}</b></> : <span className="text-slate-500"> — {apercu.erreur}</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={onAnnuler} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold">Annuler</button>
          <button onClick={() => onEnregistrer({ reponses, ajouts })} disabled={!apercu.devis}
            className={`px-4 py-2 rounded-lg text-sm font-bold ${apercu.devis ? "bg-amber-600 text-white hover:bg-amber-700" : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}>
            ✍️ Enregistrer et envoyer au client
          </button>
        </div>
      </div>
    </div>
  );
}
