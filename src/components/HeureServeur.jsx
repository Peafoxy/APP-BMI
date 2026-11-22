import React, { useEffect, useState } from "react";
import { heureCourte, today, dFR } from "../lib/core";

// 🕓 L'HEURE DU SERVEUR, dans la barre du haut (Timo, 14/10/2026 : « cette
// bande devient éternelle sur les écrans… enlève-la et pose HEURE SERVEUR
// entre le nom de l'onglet et le bouton Verrouiller. Plus de bande »).
// C'est l'heure que l'application écrit sur tout ce qu'elle enregistre
// (lib/horloge.js) : on la voit, on peut la comparer à l'horloge de l'appareil.
// Son propre minuteur : l'écran entier ne se redessine pas pour une horloge.
export function HeureServeur({ sombre = false, avecDate = false }) {
  const [heure, setHeure] = useState(() => heureCourte());
  const [jour, setJour] = useState(() => today());
  useEffect(() => {
    const t = setInterval(() => { setHeure(heureCourte()); setJour(today()); }, 15000);
    return () => clearInterval(t);
  }, []);
  // 22/11/2026 (Timo) : dans l'en-tête, « 22/11/2026 | 08:13 » un peu plus grand, à la place de « Heure serveur » et de la date seule.
  if (avecDate) {
    return (
      <span data-heure-serveur data-date-heure className={`text-sm font-bold whitespace-nowrap ${sombre ? "text-sky-100" : "text-slate-600"}`} title="La date et l'heure du serveur : celles que l'application écrit sur les ventes, dépenses, versements…">
        {dFR(jour)} | {heure}
      </span>
    );
  }
  return (
    <span data-heure-serveur className={`text-xs font-semibold whitespace-nowrap ${sombre ? "text-sky-100" : "text-slate-500"}`} title="L'heure du serveur : celle que l'application écrit sur les ventes, dépenses, versements…">
      🕓 Heure serveur {heure}
    </span>
  );
}
