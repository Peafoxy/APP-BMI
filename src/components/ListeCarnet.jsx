// ============================================================
// components/ListeCarnet.jsx — LA CHARTE DES LISTES (18/11/2026)
// Timo : « au lieu de le faire écran par écran, on ne peut pas écrire une règle
// pour toute l'app ? » → « Oui, fais les trois couches ».
//
// UNE seule façon d'écrire une liste avec des gestes, pour tous les écrans :
//   • sur ordinateur, un tableau : la première colonne reste FIGÉE, une dernière
//     colonne « À faire » porte LE geste du moment, écrit en toutes lettres, et
//     « ▸ Détail » ; un clic sur la ligne la déplie (une seule à la fois) ;
//   • la ligne dépliée montre le détail de l'écran, puis TOUS les autres gestes
//     écrits en mots, rangés par thème (Client, Argent, Classer…) ;
//   • sur téléphone, une CARTE par ligne (jamais un tableau qui défile de côté) ;
//   • UNE seule des deux mises en page est dans la page.
// Les gestes eux-mêmes (ce qu'ils font, qui y a droit) restent à l'écran : le
// composant ne décide d'aucun droit, il ne fait que les ranger.
// ============================================================
import React, { Fragment, useState, useEffect } from "react";
import { BoutonGeste, LigneGestes, CelluleActions, enTeteFige, celluleFigee, classeLigneDepliable, fondLigneDepliable } from "./ui";

// 📱 Vrai sur téléphone (écran de moins de 640 px). `initial` : pour le banc seul.
export function useTelephone(initial = false) {
  const [telephone, setTelephone] = useState(() => initial || (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches));
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(max-width: 639px)");
    const suit = () => setTelephone(initial || mq.matches);
    mq.addEventListener?.("change", suit);
    return () => mq.removeEventListener?.("change", suit);
  }, [initial]);
  return telephone;
}

// Le geste du moment (celui de `moment`, une clé de `g`) puis « ▸ Détail ».
// `marque` : l'attribut posé sur le bouton « Détail » (ex. data-detail-dette-bouton).
export function GestesLigne({ g, moment, deplie, onDetail, marque, aDroite = false }) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5${aDroite ? " justify-end" : ""}`}>
      {moment && g[moment]}
      <BoutonGeste {...(marque ? { [marque]: true } : {})} icone={deplie ? "▾" : "▸"} nom="Détail" titre="Voir le détail et tous les gestes" onClick={onDetail} />
    </div>
  );
}

// Tous les autres gestes (sauf celui du moment, déjà sur la ligne), écrits en mots,
// rangés par thème : `lignes` = [["Client", ["relancer", "demander"]], ["Classer", ["supprimer"]]].
export function GestesDetail({ g, moment, lignes, marque }) {
  const reste = { ...g, ...(moment ? { [moment]: null } : {}) };
  return (
    <div {...(marque ? { [marque]: true } : {})} className="space-y-1.5">
      {lignes.map(([nom, cles]) => <LigneGestes key={nom} nom={nom}>{cles.map((c) => reste[c])}</LigneGestes>)}
    </div>
  );
}

// colonnes : [{ titre, align, figee, actions, largeur, cellule(x, i, deplie) }]
// marques  : noms des attributs data-* propres à l'écran (les bancs les lisent).
export function ListeCarnet({
  items, cle = (x) => x.id, colonnes, aucun = null,
  ouvert, onBasculer, telephone = false, marques = {},
  fond = () => "", carteClasse = () => "", carte, gestes, sousLignes = null, detail = null,
  largeurMin = "min-w-[860px]", enTeteFond = "bg-white", enTeteClasse = "sticky top-0 z-30 bg-white",
  pied = null, // lignes de total (ordinateur seulement) : <tr>…</tr>, posées dans un <tfoot>
  titreGroupe = null, // (x, i) → texte du titre à poser AVANT cette ligne (changement de catégorie), ou null
}) {
  const marque = (nom, valeur = true) => (nom ? { [nom]: valeur } : {});
  const etat = (deplie) => marque(marques.etat, deplie ? "deplie" : "replie");

  if (telephone) {
    return (
      <div {...marque(marques.cartes)} className="p-2 space-y-2">
        {items.length === 0 && aucun}
        {items.map((x) => {
          const deplie = ouvert === cle(x);
          const sous = sousLignes ? sousLignes(x, deplie) : null;
          const det = deplie && detail ? detail(x, deplie) : null;
          const titre = titreGroupe ? titreGroupe(x, items.indexOf(x)) : null;
          return (
            <Fragment key={cle(x)}>
            {titre && <div className="px-1 pt-2 text-xs font-bold text-slate-600 uppercase tracking-wide">{titre}</div>}
            <div {...marque(marques.carte)} {...etat(deplie)} data-ligne={cle(x)} onClick={() => onBasculer(x)}
              className={`rounded-xl border p-3 cursor-pointer ${deplie ? "border-sky-400 bg-sky-50" : (carteClasse(x) || "border-slate-200 bg-white")}`}>
              {carte(x, deplie)}
              {sous && <div className="mt-1">{sous}</div>}
              {gestes && <div className="mt-2" onClick={(e) => e.stopPropagation()}>{gestes(x, deplie)}</div>}
              {det && <div onClick={(e) => e.stopPropagation()} className="mt-3 space-y-2" {...marque(marques.detail)}>{det}</div>}
            </div>
            </Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <table className={`w-full text-sm ${largeurMin}`}>
      <thead className={enTeteClasse}>
        <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
          {colonnes.map((c, i) => <th key={c.titre || i} className={`${c.align === "right" ? "text-right" : "text-left"} px-3 py-2${c.figee ? ` ${enTeteFige(enTeteFond)}` : ""}`}>{c.titre}</th>)}
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && <tr><td colSpan={colonnes.length} className="px-4 py-6 text-center text-slate-400">{aucun}</td></tr>}
        {items.map((x, i) => {
          const deplie = ouvert === cle(x);
          const f = fond(x);
          const sous = sousLignes ? sousLignes(x, deplie) : null;
          const det = deplie && detail ? detail(x, deplie) : null;
          const titre = titreGroupe ? titreGroupe(x, i) : null;
          return (
            <Fragment key={cle(x)}>
              {titre && <tr className="bg-slate-100 border-t-2 border-slate-200"><td colSpan={colonnes.length} className="px-3 py-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide">{titre}</td></tr>}
              <tr {...etat(deplie)} data-ligne={cle(x)} onClick={() => onBasculer(x)} className={`border-t border-slate-100 cursor-pointer align-top ${classeLigneDepliable(deplie, i, f)}`}>
                {colonnes.map((c, k) => (c.actions
                  ? <CelluleActions key={c.titre || k} largeur={c.largeur || "min-w-[200px] max-w-[260px]"}>{gestes(x, deplie)}</CelluleActions>
                  : <td key={c.titre || k} className={`px-3 py-2${c.figee ? ` min-w-[170px] ${celluleFigee(fondLigneDepliable(deplie, i, f), deplie)}` : ""}${c.align === "right" ? " text-right" : ""}${c.classe ? ` ${c.classe}` : ""}`}>{c.cellule(x, i, deplie)}</td>))}
              </tr>
              {sous && <tr className={fondLigneDepliable(deplie, i, f)}><td colSpan={colonnes.length} className="px-3 pb-2 pt-0">{sous}</td></tr>}
              {det && <tr className="bg-slate-50" {...marque(marques.detail)}><td colSpan={colonnes.length} className="px-4 pt-2 pb-4">{det}</td></tr>}
            </Fragment>
          );
        })}
      </tbody>
      {pied && <tfoot>{pied}</tfoot>}
    </table>
  );
}
