// ============================================================
// lib/appareils.js — LE CATALOGUE DES APPAREILS ÉLECTRIQUES du volet
// solaire (demande Timo, 09/09/2026 : « l'application devrait reconnaître
// les abréviations des équipements… ne pas être rigide dans l'appellation »,
// puis « élargis d'abord à une cinquantaine ou plus, puis lance »).
//
// Chaque appareil porte sa puissance typique (W) et ses AUTRES NOMS —
// abréviations, mots de tous les jours, fautes courantes. Le champ
// « Appareil » du volet solaire propose ce catalogue (components/
// ChampSuggestions.jsx, règle lib/suggestions.js : accents et majuscules
// ignorés, mots dans n'importe quel ordre, une faute d'une lettre tolérée).
// Choisir un appareil pré-remplit la puissance ; on la corrige si la
// plaque dit autre chose ; un appareil hors liste reste en saisie libre.
//
// Un mot partagé (« poste », « machine », « portable ») ne choisit jamais à
// la place de la personne : la liste s'ouvre avec les deux, on clique.
//
// La liste GRANDIT avec Timo : ⚙ Paramètres → 🔌 Appareils ajoute, corrige
// ou retire (champ `appareils_catalogue` des boutiques de l'espace regardé),
// et « à classer » montre les appareils tapés dans les devis qui ne sont
// pas encore dans la liste. Le banc exerce tout ce fichier.
// ============================================================
import { boutiquesVisibles } from "./calculs";
import { sansAccents, correspond, correspondApprox } from "./suggestions";
// La liste et sa fusion vivent dans lib/catalogueAppareils.js (sans import,
// lue aussi par le serveur) : importées ET réexportées.
import { CATALOGUE_APPAREILS, fusionnerCatalogue } from "./catalogueAppareils";
export { CATALOGUE_APPAREILS, fusionnerCatalogue };


// La liste de l'espace regardé : le catalogue de départ, plus ce que Timo a
// ajouté ou corrigé (une entrée personnalisée du même id remplace l'entrée
// de départ ; `retire: true` la cache).
export const catalogueAppareils = (db, profile) => {
  const b = profile ? boutiquesVisibles(db, profile, db?.boutiques || []).find((x) => Array.isArray(x.appareils_catalogue)) : null;
  return fusionnerCatalogue(b ? b.appareils_catalogue : []);
};

// Ce que le champ à suggestions reçoit : le nom, la puissance en détail,
// les autres noms comme mots de recherche.
export const suggestionsAppareils = (catalogue) => catalogue.map((a) => ({
  cle: a.id, valeur: a.nom, detail: `${a.puissance} W`, mots: (a.autres || []).join(" "),
}));

// L'appareil dont c'est le nom exact (accents et majuscules ignorés) ou
// l'un des autres noms exact — sert à pré-remplir la puissance quand la
// personne choisit dans la liste. Un mot partagé ne renvoie rien : c'est
// la liste qui tranche, jamais ce fichier.
export const appareilDuCatalogue = (catalogue, nom) => {
  const n = sansAccents(nom);
  if (!n) return null;
  const parNom = catalogue.filter((a) => sansAccents(a.nom) === n);
  if (parNom.length === 1) return parNom[0];
  const parAutre = catalogue.filter((a) => (a.autres || []).some((x) => sansAccents(x) === n));
  return parAutre.length === 1 ? parAutre[0] : null;
};

// Un nom tapé est-il connu du catalogue (nom, autre nom, ou à une faute
// près) ?
export const appareilConnu = (catalogue, nom) => {
  const n = sansAccents(nom);
  if (!n) return true;
  return catalogue.some((a) => sansAccents(a.nom) === n || (a.autres || []).some((x) => sansAccents(x) === n)
    || correspond(a.nom, n) || (a.autres || []).some((x) => correspond(x, n)) || correspondApprox(a.nom, n));
};

// « À classer » : les appareils tapés dans les devis (besoins du volet
// solaire) que le catalogue ne connaît pas — avec la puissance la plus
// souvent saisie et le nombre de devis. Dérivé, jamais écrit : c'est Timo
// qui décide de les ajouter. `comptes` = les comptes de l'espace regardé
// (utilisateursDeLEspace), jamais db.users en entier.
export const appareilsAClasser = (comptes, catalogue) => {
  const vus = new Map();
  for (const u of comptes || []) {
    for (const d of u.devis || []) {
      for (const a of d?.besoins?.appareils || []) {
        const nom = String(a?.nom || "").trim();
        if (!nom || appareilConnu(catalogue, nom)) continue;
        const cle = sansAccents(nom);
        const e = vus.get(cle) || { nom, puissances: [], devis: 0 };
        e.devis += 1;
        if (Number(a.puissance) > 0) e.puissances.push(Number(a.puissance));
        vus.set(cle, e);
      }
    }
  }
  return [...vus.values()].map((e) => {
    const freq = new Map();
    for (const p of e.puissances) freq.set(p, (freq.get(p) || 0) + 1);
    const puissance = [...freq.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0])[0]?.[0] || 0;
    return { nom: e.nom, puissance, devis: e.devis };
  }).sort((x, y) => y.devis - x.devis || x.nom.localeCompare(y.nom));
};

// Un identifiant sûr pour un appareil ajouté par Timo.
export const idAppareil = (nom) => "perso_" + sansAccents(nom).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
