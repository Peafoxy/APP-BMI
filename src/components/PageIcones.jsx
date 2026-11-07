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
import { decomposerLibelle, couleurIcone } from "../lib/pageIcones";
import { IconeWhatsApp } from "./ui";

// 📲 → le VRAI logo de WhatsApp (Timo, 06/11/2026 : « mettre un vrai icône de
// WhatsApp »), dans la barre d'onglets aussi : écrit UNE fois, ici.
export function LibelleOnglet(id, label) {
  if (id !== "whatsapp") return label;
  return (
    <span className="inline-flex items-center gap-1.5">
      <IconeWhatsApp taille={16} />
      {String(label).replace(/^📲\s*/u, "")}
    </span>
  );
}

// 📱 07/11/2026 (Timo, deux captures : « sur téléphone, réduire les espaces
// entre icônes pour qu'on puisse avoir tout sans défilement ») : sur
// téléphone 5 icônes par rangée, plus petites, serrées — les 27 icônes de
// l'administrateur tiennent sur un écran. Les classes `sm:` gardent
// l'ordinateur comme avant (6 par rangée, centrées) ; seul le logo WhatsApp
// passe de 34 à 32 px partout. Mesuré par
// le banc (verifier-onglets-deplacables).
export function PageIcones({ tabs, onChoisir, onReordonner, nom = "" }) {
  return (
    <div data-page-icones className="relative z-10 w-full py-2">
      <h2 className="text-center text-white text-base font-bold mb-2 sm:mb-5 drop-shadow">Bonjour{nom ? ` ${nom}` : ""}</h2>
      <OngletsDeplacables tabs={tabs} tab={null} onChoisir={onChoisir} onReordonner={onReordonner} sens="grille"
        className="grid grid-cols-5 gap-x-1 gap-y-1 sm:grid-cols-6 sm:gap-x-5 sm:gap-y-6 sm:max-w-[640px] sm:mx-auto"
        classeBouton={() => "relative flex flex-col items-center text-center rounded-2xl px-0 py-0 sm:px-0.5 sm:py-1 hover:bg-white/10"}
        contenu={(id, label) => {
          const { icone, nom, nombre } = decomposerLibelle(label);
          // Un mot trop long pour la largeur d'une icône se coupe à un endroit
          // propre (trait d'union conditionnel), jamais au hasard des lettres.
          const titre = nom.replace("Dimensionnement", "Dimension\u00ADnement");
          return (
            <>
              <span className="flex items-center justify-center w-[54px] h-[54px] text-[27px] sm:w-14 sm:h-14 sm:text-[28px] rounded-2xl leading-none shadow-md" style={{ backgroundColor: couleurIcone(id) }}>{id === "whatsapp" ? <IconeWhatsApp taille={32} couleur="#ffffff" /> : (icone || "•")}</span>
              <span lang="fr" className="mt-1 sm:mt-1.5 w-full text-[10.5px] tracking-[-0.05em] sm:text-[11.5px] sm:tracking-normal font-semibold leading-[1.15] sm:leading-tight text-white drop-shadow hyphens-auto [overflow-wrap:anywhere]">{titre}</span>
              {nombre > 0 && (
                <span data-icone-nombre className="absolute top-0 left-[calc(50%+13px)] sm:left-[calc(50%+14px)] min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center text-[10px] font-bold text-white bg-red-600 rounded-full ring-2 ring-white/70">{nombre}</span>
              )}
            </>
          );
        }} />
    </div>
  );
}
