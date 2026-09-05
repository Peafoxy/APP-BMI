// ============================================================
// components/ZoneSignature.jsx — LA zone de signature, unique pour toute
// l'application (demande Timo, 05/09/2026 : « une seule règle »).
//
// Elle servait en QUATRE copies identiques : la signature personnelle d'un
// employé (📄 Contrats), la signature du client sur le contrat en boutique
// (📋 Tous les devis), sur le contrat depuis son téléphone et sur le PV de
// réception (Espace client). Une correction dans l'une devait être répétée
// dans les trois autres — c'est ce qui a déjà cassé le nom des fichiers PDF.
//
// Ce que la zone sait faire, et rien d'autre : dessiner au doigt ou à la
// souris, effacer, dire si quelqu'un a signé, rendre l'image (PNG). Où
// ranger la signature et quoi faire ensuite reste l'affaire de l'écran.
//
//   const signatureRef = useRef(null);
//   <ZoneSignature ref={signatureRef} />
//   signatureRef.current.aSigne()   → true dès qu'un trait a été posé
//   signatureRef.current.image()    → l'image PNG (data URL)
//   signatureRef.current.effacer()  → repart d'un cadre vide
//
// Cadre 440 × 300 (demande Timo : 440×220 le 05/09/2026, puis « 440×300 » le même jour).
// ============================================================
import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export const LARGEUR_SIGNATURE = 440;
export const HAUTEUR_SIGNATURE = 300;
const COULEUR_TRAIT = "#1e293b";
const EPAISSEUR_TRAIT = 2;

// Le canevas a une résolution interne fixe mais s'affiche à une largeur
// variable (w-full) : sans mise à l'échelle, le trait ne suivait pas le
// doigt sur mobile (signalé par Timo). Et getBoundingClientRect() inclut la
// BORDURE alors que le trait se cale sur le bord intérieur : d'où
// clientWidth / clientLeft, qui l'excluent (second défaut signalé par Timo,
// décalage à la souris). Cette version corrigée est la seule qui subsiste.
export const positionDansCanevas = (e, canvas) => {
  const rect = canvas.getBoundingClientRect();
  const point = e.touches ? e.touches[0] : e;
  const echelleX = canvas.width / canvas.clientWidth;
  const echelleY = canvas.height / canvas.clientHeight;
  return {
    x: (point.clientX - rect.left - canvas.clientLeft) * echelleX,
    y: (point.clientY - rect.top - canvas.clientTop) * echelleY,
  };
};

export const ZoneSignature = forwardRef(function ZoneSignature({ className = "" }, ref) {
  const canvasRef = useRef(null);
  const aSigneRef = useRef(false);
  const [dessinEnCours, setDessinEnCours] = useState(false);

  const debuter = (e) => {
    e.preventDefault();
    setDessinEnCours(true);
    aSigneRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = positionDansCanevas(e, canvasRef.current);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const continuer = (e) => {
    if (!dessinEnCours) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = positionDansCanevas(e, canvasRef.current);
    ctx.lineTo(x, y);
    ctx.strokeStyle = COULEUR_TRAIT;
    ctx.lineWidth = EPAISSEUR_TRAIT;
    ctx.lineCap = "round";
    ctx.stroke();
  };
  const terminer = () => setDessinEnCours(false);

  useImperativeHandle(ref, () => ({
    aSigne: () => aSigneRef.current,
    image: () => canvasRef.current?.toDataURL("image/png"),
    effacer: () => {
      const c = canvasRef.current;
      if (!c) return;
      c.getContext("2d").clearRect(0, 0, c.width, c.height);
      aSigneRef.current = false;
    },
  }));

  return (
    <canvas ref={canvasRef} width={LARGEUR_SIGNATURE} height={HAUTEUR_SIGNATURE}
      className={`w-full border-2 border-slate-300 rounded-lg touch-none bg-slate-50 ${className}`}
      onMouseDown={debuter} onMouseMove={continuer} onMouseUp={terminer} onMouseLeave={terminer}
      onTouchStart={debuter} onTouchMove={continuer} onTouchEnd={terminer} />
  );
});
