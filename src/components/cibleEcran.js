// ============================================================
// components/cibleEcran.js — CE QU'UN ÉCRAN FAIT D'UNE NOTIFICATION CLIQUÉE
// (16/10/2026, Timo : « elles ne conduisent pas à la source » → « lance »)
// ============================================================
// App.jsx passe `cible` à l'écran ouvert ({ ecran, boutique, ligne, conv,
// membre, n }) ; `n` change à chaque clic, même deux fois sur la même chose.
// Ici, UNE fois : l'écran ne réagit qu'à une cible qui le vise.
// ⚠ La cible ne fait que DEMANDER : la boutique passe encore par
// boutiqueRetenue (le mur) dans chaque écran ; une boutique que la personne
// ne voit pas est ignorée et l'écran reste où il était.
// ============================================================
import { useEffect } from "react";
import { memoriserBoutique } from "../lib/calculs";
import { boutiqueDeLaCible } from "../lib/cibleNotification";

export function useCible(cible, ecran, faire) {
  useEffect(() => {
    if (!cible || cible.ecran !== ecran) return;
    faire(cible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible?.n]);
}

// La boutique visée (`boutiqueDeLaCible`, lib/cibleNotification.js : jamais
// un employé rattaché déplacé hors de SA boutique). `cleMemoire` : la mémoire
// de l'écran (« NE JAMAIS CHANGER DE BOUTIQUE APRÈS UNE SÉRIE
// D'ACTUALISATIONS » : le choix fait par le clic est retenu, comme un clic
// sur la pastille).
export function useCibleBoutique(cible, ecran, setBq, profile, cleMemoire = ecran, apres) {
  useCible(cible, ecran, (c) => {
    const b = boutiqueDeLaCible(c, profile);
    if (!b) return;
    setBq(b);
    memoriserBoutique(profile, cleMemoire, b);
    if (apres) apres(c);
  });
}
