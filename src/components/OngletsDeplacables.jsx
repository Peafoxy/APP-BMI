// ============================================================
// components/OngletsDeplacables.jsx — LE MENU DONT ON DÉPLACE LES ONGLETS
//
// Timo (12/09/2026) : « appui long et on déplace, tout court ». Pas de ligne
// de réglage, pas de flèches : on garde le doigt (ou la souris) sur un
// onglet un demi-seconde sans bouger, il se soulève, on le glisse à sa
// place, on relâche. L'ordre est enregistré dans la fiche de la personne.
//
// Un simple clic reste un clic ; un doigt qui bouge tout de suite fait
// défiler le menu comme avant (règle pure lib/ordreOnglets.js). Le même
// composant sert à la barre latérale (verticale, ordinateur) et à la barre du
// téléphone (horizontale) : `sens` dit dans quel axe on lit la position.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { DELAI_APPUI_LONG_MS, appliquerOrdre, deplacer, indexDepose, resteImmobile } from "../lib/ordreOnglets";

export function OngletsDeplacables({ tabs, tab, onChoisir, onReordonner, sens = "vertical", classeBouton, className = "" }) {
  const cadre = useRef(null);
  const minuteur = useRef(null);
  const depart = useRef(null);            // { x, y, id, pointerId }
  const aDeplace = useRef(false);         // pour avaler le clic qui suit un déplacement
  const [saisi, setSaisi] = useState(null); // id de l'onglet soulevé
  const [ordreVif, setOrdreVif] = useState(null); // ids pendant le déplacement
  const vertical = sens === "vertical";
  const affiches = ordreVif ? appliquerOrdre(tabs, ordreVif) : tabs;

  const annulerMinuteur = () => { if (minuteur.current) { clearTimeout(minuteur.current); minuteur.current = null; } };

  // Pendant un déplacement, le doigt ne doit PAS faire défiler la page : on
  // avale le touchmove (écouteur non passif — React les pose passifs).
  useEffect(() => {
    const el = cadre.current;
    if (!el) return undefined;
    const avaler = (e) => { if (depart.current?.actif) e.preventDefault(); };
    el.addEventListener("touchmove", avaler, { passive: false });
    return () => el.removeEventListener("touchmove", avaler);
  }, []);

  const commencer = (e, id) => {
    if (e.button !== undefined && e.button !== 0) return;
    annulerMinuteur();
    depart.current = { x: e.clientX, y: e.clientY, id, pointerId: e.pointerId, actif: false, cible: e.currentTarget };
    aDeplace.current = false;
    minuteur.current = setTimeout(() => {
      minuteur.current = null;
      if (!depart.current || depart.current.id !== id) return;
      depart.current.actif = true;
      try { depart.current.cible.setPointerCapture(depart.current.pointerId); } catch { /* sans importance */ }
      try { navigator.vibrate?.(30); } catch { /* sans importance */ }
      setSaisi(id);
      setOrdreVif(tabs.map((t) => t[0]));
    }, DELAI_APPUI_LONG_MS);
  };

  const bouger = (e) => {
    const d = depart.current;
    if (!d) return;
    if (!d.actif) {
      // Le doigt part avant le demi-seconde : c'est un défilement, pas un appui long.
      if (!resteImmobile(e.clientX - d.x, e.clientY - d.y)) { annulerMinuteur(); depart.current = null; }
      return;
    }
    const position = vertical ? e.clientY : e.clientX;
    const autres = [...cadre.current.querySelectorAll("[data-tab-id]")].filter((el) => el.dataset.tabId !== d.id);
    const milieux = autres.map((el) => { const r = el.getBoundingClientRect(); return vertical ? r.top + r.height / 2 : r.left + r.width / 2; });
    const idsSans = autres.map((el) => el.dataset.tabId);
    const cible = indexDepose(position, milieux);
    const nouveau = deplacer([...idsSans, d.id], idsSans.length, cible);
    setOrdreVif((actuel) => (actuel && actuel.join("|") === nouveau.join("|") ? actuel : nouveau));
  };

  const finir = () => {
    const d = depart.current;
    annulerMinuteur();
    if (d?.actif) {
      aDeplace.current = true;
      try { d.cible.releasePointerCapture(d.pointerId); } catch { /* sans importance */ }
      if (ordreVif) onReordonner(ordreVif);
    }
    depart.current = null;
    setSaisi(null);
    setOrdreVif(null);
  };

  const cliquer = (id) => {
    if (aDeplace.current) { aDeplace.current = false; return; }
    onChoisir(id);
  };

  return (
    <nav ref={cadre} className={className} style={{ WebkitTouchCallout: "none", userSelect: "none" }}>
      {affiches.map(([id, label]) => (
        <button key={id} data-tab-id={id} type="button"
          onClick={() => cliquer(id)}
          onPointerDown={(e) => commencer(e, id)}
          onPointerMove={bouger}
          onPointerUp={finir}
          onPointerCancel={finir}
          onContextMenu={(e) => e.preventDefault()}
          style={saisi === id ? { touchAction: "none" } : undefined}
          className={`${classeBouton(id, tab === id)}${saisi === id ? " ring-2 ring-white/80 scale-105 opacity-90 shadow-lg z-10" : saisi ? " transition-transform" : ""}`}>
          {label}
        </button>
      ))}
    </nav>
  );
}
