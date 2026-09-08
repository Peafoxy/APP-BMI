// ============================================================
// components/ChampSuggestions.jsx — UN champ texte avec propositions,
// pour toute l'application (Timo, 08/09/2026 : « la proposition doit
// apparaître à partir de la ligne dans laquelle on tape, vers le bas, pas
// sur tout l'écran — appliquer cette règle dans toute l'application »).
//
// • La liste s'ouvre SOUS le champ, à sa largeur, et le suit au défilement ;
//   jamais un voile sur tout l'écran.
// • La recherche ignore accents et majuscules et accepte les mots dans
//   n'importe quel ordre (lib/suggestions.js) — « came » trouve « Caméra ».
// • La saisie libre reste possible : choisir une proposition ne fait que
//   remplir le champ avec son texte exact.
// ============================================================
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { inputCls } from "./ui";
import { filtrerSuggestions } from "../lib/suggestions";

export function ChampSuggestions({ valeur, onChange, suggestions, placeholder, className, type = "text", autoFocus, disabled }) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const [cadre, setCadre] = useState(null);
  const champ = useRef(null);
  const liste = useRef(null);
  const propositions = ouvert ? filtrerSuggestions(suggestions, valeur) : [];

  // Position : juste sous le champ, même largeur, recalculée quand la page
  // défile ou change de taille tant que la liste est ouverte.
  const placer = () => {
    const r = champ.current?.getBoundingClientRect();
    if (!r) return;
    const dispo = Math.max(120, window.innerHeight - r.bottom - 8);
    // Assez large pour lire un nom d'article EN ENTIER (Timo, 08/09/2026 :
    // « le nom n'est pas totalement affiché, risque de choisir un autre
    // câble ») : au moins 320 px, sans dépasser le bord droit de l'écran.
    const width = Math.min(Math.max(r.width, 320), Math.max(220, window.innerWidth - r.left - 8));
    setCadre({ top: r.bottom + 2, left: r.left, width, maxHeight: Math.min(280, dispo) });
  };
  useLayoutEffect(() => { if (ouvert) placer(); }, [ouvert, valeur]);
  useEffect(() => {
    if (!ouvert) return;
    const fermerSiDehors = (e) => { if (!champ.current?.contains(e.target) && !liste.current?.contains(e.target)) setOuvert(false); };
    window.addEventListener("scroll", placer, true);
    window.addEventListener("resize", placer);
    document.addEventListener("mousedown", fermerSiDehors);
    document.addEventListener("touchstart", fermerSiDehors);
    return () => {
      window.removeEventListener("scroll", placer, true);
      window.removeEventListener("resize", placer);
      document.removeEventListener("mousedown", fermerSiDehors);
      document.removeEventListener("touchstart", fermerSiDehors);
    };
  }, [ouvert]);

  const choisir = (s) => { onChange(s.valeur); setOuvert(false); setActif(-1); };
  const auClavier = (e) => {
    if (!ouvert || propositions.length === 0) { if (e.key === "ArrowDown") setOuvert(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActif((i) => Math.min(propositions.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActif((i) => Math.max(-1, i - 1)); }
    else if (e.key === "Enter" && actif >= 0) { e.preventDefault(); choisir(propositions[actif]); }
    else if (e.key === "Escape") setOuvert(false);
  };

  return (
    <>
      <input ref={champ} type={type} className={className || inputCls} placeholder={placeholder} value={valeur} autoFocus={autoFocus} disabled={disabled}
        autoComplete="off"
        onFocus={() => { setOuvert(true); setActif(-1); }}
        onChange={(e) => { onChange(e.target.value); setOuvert(true); setActif(-1); }}
        onKeyDown={auClavier} />
      {ouvert && cadre && propositions.length > 0 && createPortal(
        <div ref={liste} className="fixed z-50 bg-white border border-slate-300 rounded-lg shadow-lg overflow-y-auto text-sm"
          style={{ top: cadre.top, left: cadre.left, width: cadre.width, maxHeight: cadre.maxHeight }}>
          {propositions.map((s, i) => (
            <button key={s.cle || s.valeur} type="button"
              onMouseDown={(e) => e.preventDefault()} onClick={() => choisir(s)}
              className={`w-full text-left px-3 py-2 border-b border-slate-100 last:border-0 ${i === actif ? "bg-sky-100" : "hover:bg-sky-50"}`}>
              {/* Le nom en entier, sur autant de lignes qu'il faut — jamais
                  coupé par des « … » ; le détail (stock, prix) en dessous. */}
              <div className="font-medium break-words">{s.valeur}</div>
              {s.detail && <div className="text-xs text-slate-500">{s.detail}</div>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
