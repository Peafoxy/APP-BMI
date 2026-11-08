// ============================================================
// components/PageIcones.jsx — LA PAGE D'ICÔNES (06/11/2026)
//
// Timo, après les captures d'Odoo : chaque onglet devient une ICÔNE (« A2 »),
// le logo BMI y ramène (« B1 »), sur téléphone ET ordinateur (« C1 »),
// l'icône seule sur un fond pâle (« 1 »), regroupées au CENTRE sur ordinateur
// (« comme Odoo l'a fait »), posées sur le fond de la fenêtre de verrou.
// Le fond lui-même est posé par App.jsx (FondAccueil, la règle du décor) :
// ce composant ne dessine que le salut et la grille.
//
// Les icônes passent par OngletsDeplacables (sens « grille ») : un toucher
// ouvre l'écran, l'appui long déplace — le même ordre qu'avant, rangé sur la
// fiche (ordre_onglets). Le chiffre rouge vient du libellé de l'onglet.
// ============================================================
import { OngletsDeplacables } from "./OngletsDeplacables";
import { decomposerLibelle, imageIcone } from "../lib/pageIcones";
import { IconeWhatsApp } from "./ui";

// 🎨 08/11/2026 (Timo, son image « Bonjour TIMO » : « reprendre exactement
// les icônes que je t'ai envoyées ») : chaque onglet porte SON dessin
// (imageIcone, lib/pageIcones.js), découpé dans son image. Un onglet qu'elle
// ne montre pas garde son emoji. Écrit UNE fois, ici, pour les trois
// affichages.
// `taille` en pixels (la barre) ; sans elle, le dessin remplit sa case (les
// cartes), et l'emoji prend la classe de taille `texte`.
function DessinOnglet({ id, icone, taille, texte = "" }) {
  const src = imageIcone(id);
  if (src) return <img data-dessin-onglet src={src} alt="" draggable={false} className={`block object-contain select-none pointer-events-none ${taille ? "" : "w-full h-full"}`} style={taille ? { width: taille, height: taille } : undefined} />;
  if (id === "whatsapp") return <IconeWhatsApp taille={taille || 32} />;
  return <span className={`leading-none ${texte}`} style={taille ? { fontSize: Math.round(taille * 0.82) } : undefined}>{icone || "•"}</span>;
}

// LA BARRE D'ONGLETS (« 1c, même taille que les emoji ») : le dessin prend la
// place de l'emoji, à sa taille, sur un petit carré blanc — sur le bleu de la
// barre, les traits sombres d'un dessin disparaîtraient.
export function LibelleOnglet(id, label) {
  const { icone, nom, nombre } = decomposerLibelle(label);
  if (!imageIcone(id) && id !== "whatsapp") return label;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-[5px] bg-white shrink-0"><DessinOnglet id={id} icone={icone} taille={16} /></span>
      {nom}{nombre > 0 ? ` (${nombre})` : ""}
    </span>
  );
}

// UNE tuile, comme sur l'image de Timo : une carte blanche arrondie, une ombre
// douce, le dessin en couleur, le nom en gras foncé DANS la carte, le chiffre
// en pastille rouge sur le coin. Écrite une fois pour la page d'icônes ET la
// colonne d'icônes (« petite »). 📱 Sur téléphone, 5 cartes par rangée
// serrées (07/11/2026 : « tout sans défilement ») ; l'ordinateur 6, centrées.
export function TuileIcone({ id, label, petite = false }) {
  const { icone, nom, nombre } = decomposerLibelle(label);
  // Un mot trop long pour la largeur d'une carte se coupe à un endroit
  // propre (trait d'union conditionnel), jamais au hasard des lettres.
  const titre = nom.replace("Dimensionnement", "Dimension\u00ADnement");
  return (
    <span data-carte-icone className={petite
      ? "relative flex flex-col items-center w-full h-full rounded-xl bg-white px-0.5 pt-1.5 pb-1 shadow-[0_2px_8px_rgba(15,42,92,0.18)]"
      : "relative flex flex-col items-center w-full h-full rounded-xl sm:rounded-2xl bg-white px-0 pt-2 pb-1.5 sm:pt-3 sm:pb-2.5 shadow-[0_3px_10px_rgba(15,42,92,0.16)] sm:shadow-[0_4px_16px_rgba(15,42,92,0.14)]"}>
      <span className={petite ? "flex items-center justify-center w-8 h-8" : "flex items-center justify-center w-9 h-9 sm:w-[52px] sm:h-[52px]"}>
        <DessinOnglet id={id} icone={icone} texte={petite ? "text-[24px]" : "text-[28px] sm:text-[40px]"} />
      </span>
      <span lang="fr" className={petite
        ? "mt-1 w-full text-[9px] tracking-[-0.03em] font-bold leading-[1.1] text-slate-800 hyphens-auto"
        : "mt-1 sm:mt-2 w-full text-[9.5px] tracking-[-0.04em] sm:text-[12.5px] sm:tracking-normal font-bold leading-[1.12] sm:leading-tight text-slate-800 hyphens-auto"}>{titre}</span>
      {nombre > 0 && (
        <span data-icone-nombre className={`absolute ${petite ? "-top-1.5 -right-1" : "-top-2 -right-1.5 sm:-top-2.5 sm:-right-2"} min-w-[18px] h-[18px] sm:min-w-[22px] sm:h-[22px] px-1 inline-flex items-center justify-center text-[10px] sm:text-[11px] font-bold text-white bg-red-600 rounded-full ring-2 ring-white`}>{nombre}</span>
      )}
    </span>
  );
}

// 📌 LA COLONNE D'ICÔNES (08/11/2026) : les mêmes tuiles, les unes sous les
// autres, l'écran ouvert encadré. Même ordre (appui long pour déplacer).
export function ColonneIcones({ tabs, tab, onChoisir, onReordonner, className = "" }) {
  return (
    <OngletsDeplacables tabs={tabs} tab={tab} onChoisir={onChoisir} onReordonner={onReordonner} sens="vertical"
      className={`flex flex-col items-stretch gap-1 overflow-y-auto px-1.5 py-2 ${className}`}
      classeBouton={(id, actif) => `relative flex flex-col items-center text-center rounded-[14px] p-1 ${actif ? "bg-sky-400" : "hover:bg-white/10"}`}
      contenu={(id, label) => <TuileIcone id={id} label={label} petite />} />
  );
}

export function PageIcones({ tabs, onChoisir, onReordonner, nom = "" }) {
  return (
    <div data-page-icones className="relative z-10 w-full py-2">
      <h2 className="text-center text-white text-base sm:text-2xl font-bold drop-shadow">Bonjour{nom ? ` ${nom}` : ""}</h2>
      {/* Le trait bleu sous le salut, comme sur l'image de Timo. */}
      <div data-trait-salut className="mx-auto mt-1.5 mb-3 sm:mt-2 sm:mb-6 w-12 sm:w-14 h-1 rounded-full bg-blue-500" />
      <OngletsDeplacables tabs={tabs} tab={null} onChoisir={onChoisir} onReordonner={onReordonner} sens="grille"
        className="grid grid-cols-5 gap-x-1 gap-y-1.5 sm:grid-cols-6 sm:gap-x-5 sm:gap-y-5 sm:max-w-[820px] sm:mx-auto"
        classeBouton={() => "relative flex flex-col items-stretch text-center rounded-2xl p-0 hover:brightness-95"}
        contenu={(id, label) => <TuileIcone id={id} label={label} />} />
    </div>
  );
}
