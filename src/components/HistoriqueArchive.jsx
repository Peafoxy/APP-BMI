// ============================================================
// components/HistoriqueArchive.jsx — UN historique qui défile et s'archive
// (Timo, 13/09/2026). La règle vit dans lib/archivage.js, ici seulement
// son affichage : 10 lignes visibles puis défilement, les lignes archivées
// derrière un bouton « 📁 Archives », rangées par mois.
//
// `lignes` : la liste brute ; `dateDe` : où lire la date d'une ligne ;
// `rendre(ligne)` : la ligne dessinée (un <tr>) ; `entete` : le <thead>.
// ============================================================
import { useState } from "react";
import { separerArchives, parMois, LIGNES_VISIBLES } from "../lib/archivage";

// La hauteur du cadre : LIGNES_VISIBLES lignes de tableau (36 px chacune) +
// l'en-tête. Au-delà, on défile.
export const HAUTEUR_LIGNE = 36;
//
// 📲 Pour 📲 WhatsApp (Timo, 09/10/2026, « a1 b1 c1 d2 ») — trois réglages,
// sans effet sur les autres écrans :
//   `toujoursVisibles` : des lignes JAMAIS archivées (une conversation non
//     lue : un client qui attend ne disparaît pas derrière un bouton), rangées
//     par date AVEC les autres — la règle d'archivage ne les voit pas ;
//   `archivesEnHaut` : la ligne « 📁 Archivées (N) » se pose EN TÊTE, comme
//     dans WhatsApp, et ouverte elle montre les archives seules ;
//   `sansCadre` : pas de hauteur à 10 lignes — c'est le panneau qui défile.
export function HistoriqueArchive({ lignes, dateDe, aujourdhui, rendre, entete, vide = "Aucune ligne.", titreArchives = "Archives", classeTable = "w-full text-sm", toujoursVisibles = [], archivesEnHaut = false, sansCadre = false }) {
  const [archivesOuvertes, setArchivesOuvertes] = useState(false);
  const { visibles: recentes, archives } = separerArchives(lignes, { aujourdhui, dateDe });
  const visibles = toujoursVisibles.length
    ? [...toujoursVisibles, ...recentes].sort((a, b) => String(dateDe(b) || "").localeCompare(String(dateDe(a) || "")))
    : recentes;
  const cadre = sansCadre ? undefined : { maxHeight: `${LIGNES_VISIBLES * HAUTEUR_LIGNE + HAUTEUR_LIGNE}px` };
  if (archivesEnHaut) {
    return (
      <div>
        {archives.length > 0 && (
          <button onClick={() => setArchivesOuvertes((o) => !o)} data-archives-en-haut
            className="w-full text-left px-4 py-2.5 border-b border-slate-100 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
            <span className="w-10 text-center text-lg">📁</span>
            <span className="flex-1">{archivesOuvertes ? `◂ Retour aux conversations` : `${titreArchives} (${archives.length})`}</span>
          </button>
        )}
        {archivesOuvertes && archives.length > 0 ? parMois(archives, dateDe).map((g) => (
          <div key={g.mois} data-historique="archives">
            <div className="text-xs font-bold text-slate-500 uppercase px-4 py-1 bg-slate-50">{g.libelle} · {g.lignes.length}</div>
            <table className={classeTable}>{entete}<tbody>{g.lignes.map(rendre)}</tbody></table>
          </div>
        )) : (
          <div style={cadre} className={sansCadre ? "" : "overflow-y-auto overflow-x-auto"} data-historique="visibles">
            <table className={classeTable}>
              {entete}
              <tbody>
                {visibles.length === 0 && <tr><td colSpan={99} className="px-4 py-6 text-center text-sm text-slate-400">{vide}</td></tr>}
                {visibles.map(rendre)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
  return (
    <div>
      <div className="overflow-y-auto overflow-x-auto" style={cadre} data-historique="visibles">
        <table className={classeTable}>
          {entete}
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={99} className="px-4 py-4 text-center text-slate-400">{vide}</td></tr>}
            {visibles.map(rendre)}
          </tbody>
        </table>
      </div>
      {archives.length > 0 && (
        <div className="border-t border-slate-200 px-3 py-2">
          <button onClick={() => setArchivesOuvertes((o) => !o)} className="text-xs font-bold text-sky-800 underline">
            📁 {titreArchives} ({archives.length}) {archivesOuvertes ? "▴ Refermer" : "▾ Remonter dans les archives"}
          </button>
          {archivesOuvertes && parMois(archives, dateDe).map((g) => (
            <div key={g.mois} className="mt-2" data-historique="archives">
              <div className="text-xs font-bold text-slate-500 uppercase px-1 py-1 bg-slate-50">{g.libelle} · {g.lignes.length}</div>
              <div className="overflow-y-auto overflow-x-auto" style={cadre}>
                <table className={classeTable}>{entete}<tbody>{g.lignes.map(rendre)}</tbody></table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
