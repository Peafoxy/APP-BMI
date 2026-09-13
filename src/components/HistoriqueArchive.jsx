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
export function HistoriqueArchive({ lignes, dateDe, aujourdhui, rendre, entete, vide = "Aucune ligne.", titreArchives = "Archives" }) {
  const [archivesOuvertes, setArchivesOuvertes] = useState(false);
  const { visibles, archives } = separerArchives(lignes, { aujourdhui, dateDe });
  const cadre = { maxHeight: `${LIGNES_VISIBLES * HAUTEUR_LIGNE + HAUTEUR_LIGNE}px` };
  return (
    <div>
      <div className="overflow-y-auto overflow-x-auto" style={cadre} data-historique="visibles">
        <table className="w-full text-sm">
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
                <table className="w-full text-sm">{entete}<tbody>{g.lignes.map(rendre)}</tbody></table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
