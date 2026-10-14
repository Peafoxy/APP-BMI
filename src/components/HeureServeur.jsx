import React, { useEffect, useState } from "react";
import { heureCourte } from "../lib/core";

// 🕓 L'HEURE DU SERVEUR, dans la barre du haut (Timo, 14/10/2026 : « cette
// bande devient éternelle sur les écrans… enlève-la et pose HEURE SERVEUR
// entre le nom de l'onglet et le bouton Verrouiller. Plus de bande »).
// C'est l'heure que l'application écrit sur tout ce qu'elle enregistre
// (lib/horloge.js) : on la voit, on peut la comparer à l'horloge de l'appareil.
// Son propre minuteur : l'écran entier ne se redessine pas pour une horloge.
export function HeureServeur() {
  const [heure, setHeure] = useState(() => heureCourte());
  useEffect(() => {
    const t = setInterval(() => setHeure(heureCourte()), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <span data-heure-serveur className="text-xs font-semibold text-slate-500 whitespace-nowrap" title="L'heure du serveur : celle que l'application écrit sur les ventes, dépenses, versements…">
      🕓 Heure serveur {heure}
    </span>
  );
}
