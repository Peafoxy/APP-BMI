// 📅 LE FILTRE DE PÉRIODE D'UNE LISTE, écrit UNE fois (05/10/2026).
// Timo, captures de 📤 Dépenses, 📋 Dettes et 📋 Tous les devis : « pas de
// filtration de période dans ces écrans » → « Lance, revenir à Toutes
// périodes ». Le filtre de 💰 Ventes (19/09/2026) devient celui de tous :
// « Toute période » d'office, les quatre périodes toutes faites, et
// « ✏️ Personnaliser… » avec deux dates (une borne vide reste ouverte, deux
// dates à l'envers sont remises dans l'ordre — et la phrase le DIT).
//
// ⚠ L'état vit dans l'écran ouvert, jamais mémorisé : à chaque ouverture on
// repart de « Toute période » (décision de Timo) — en rouvrant un écran, on
// ne doit jamais croire qu'il manque des lignes.
// ⚠ UN calcul (`bornes`), lu par tout ce que l'écran filtre : deux listes
// qui calculeraient leur période chacune finiraient par diverger.
import { useState } from "react";
import { inP } from "../lib/core";
import { periodes, PERIODE_PERSO, bornesPersonnalisees, libellePeriodePersonnalisee } from "../lib/calculs";
import { inputCls } from "./ui";

export function useFiltrePeriode() {
  const [index, setIndex] = useState(null);
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  // null = aucun filtre de période.
  const bornes = index === PERIODE_PERSO
    ? bornesPersonnalisees(du, au)
    : (index === null ? null : [periodes()[index][1], periodes()[index][2]]);
  const dans = (date) => !bornes || inP(date, bornes[0], bornes[1]);
  const libelle = !bornes ? "" : index === PERIODE_PERSO ? libellePeriodePersonnalisee(du, au) : periodes()[index][0];
  const selecteur = (
    <>
      <select value={index === null ? "" : index} data-filtre-periode
        onChange={(e) => {
          const v = e.target.value;
          setIndex(v === "" ? null : (v === PERIODE_PERSO ? PERIODE_PERSO : Number(v)));
        }} className={`${inputCls} sm:w-40`} aria-label="Période">
        <option value="">Toute période</option>
        {periodes().slice(0, 4).map(([label], idx) => (
          <option key={label} value={idx}>{label}</option>
        ))}
        <option value={PERIODE_PERSO}>✏️ Personnaliser…</option>
      </select>
      {/* Les deux cases n'apparaissent QUE si on les a demandées, et la
          phrase à droite DIT la période réellement appliquée. */}
      {index === PERIODE_PERSO && (
        <>
          <input type="date" value={du} onChange={(e) => setDu(e.target.value)} className={`${inputCls} sm:w-40`} title="Du" />
          <input type="date" value={au} onChange={(e) => setAu(e.target.value)} className={`${inputCls} sm:w-40`} title="Au" />
          <span className="text-xs font-bold text-sky-800 self-center">{libellePeriodePersonnalisee(du, au)}</span>
        </>
      )}
    </>
  );
  return { bornes, actif: !!bornes, dans, libelle, selecteur };
}
