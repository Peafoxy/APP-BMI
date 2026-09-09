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

const A = (id, nom, puissance, autres) => ({ id, nom, puissance, autres });
export const CATALOGUE_APPAREILS = [
  // ---- Éclairage ----
  A("led", "Ampoule LED", 10, ["ampoule", "lampe", "led", "éclairage", "lumière", "bulbe"]),
  A("neon", "Tube néon", 36, ["néon", "neon", "réglette", "tube"]),
  A("projecteur", "Projecteur / lampadaire LED", 50, ["projecteur", "lampadaire", "spot", "flood", "éclairage extérieur"]),
  A("lampe_bureau", "Lampe de bureau", 8, ["lampe bureau", "lampe de chevet"]),
  // ---- Confort ----
  A("ventilateur", "Ventilateur", 60, ["ventilo", "fan", "ventilateur plafond", "plafonnier", "ventilateur de table"]),
  A("brasseur", "Brasseur d'air", 90, ["brasseur", "brasseur d'air", "ventilateur sur pied", "gros ventilateur"]),
  A("clim_1", "Climatiseur 1 CV (9 000 BTU)", 1000, ["clim", "climatiseur", "split", "ac", "aircon", "air conditionné", "clim 9000", "9000 btu", "clim 1cv"]),
  A("clim_15", "Climatiseur 1,5 CV (12 000 BTU)", 1500, ["clim 1.5", "clim 1,5", "clim 12000", "12000 btu", "climatiseur 1.5"]),
  A("clim_2", "Climatiseur 2 CV (18 000 BTU)", 2200, ["clim 2", "clim 18000", "18000 btu", "climatiseur 2cv"]),
  A("clim_3", "Climatiseur 3 CV (24 000 BTU)", 3000, ["clim 3", "clim 24000", "24000 btu", "climatiseur 3cv"]),
  // ---- Image, son, bureau ----
  A("tv_32", "Téléviseur 32\"", 45, ["tv", "télé", "télévision", "television", "écran tv", "tv 32", "petite télé"]),
  A("tv_43", "Téléviseur 43\"", 70, ["tv 43", "télé 43", "television 43", "tv 40", "tv 42"]),
  A("tv_55", "Téléviseur 55\"", 120, ["tv 55", "télé 55", "grand écran", "tv 50", "tv 65"]),
  A("decodeur", "Décodeur", 15, ["canal", "canal+", "startimes", "décodeur", "decodeur", "dstv", "récepteur"]),
  A("box", "Box internet / routeur", 12, ["box", "routeur", "wifi", "modem", "internet", "mifi"]),
  A("radio", "Radio", 20, ["radio", "poste radio", "transistor"]),
  A("sono", "Sono / amplificateur", 300, ["sono", "ampli", "amplificateur", "baffle", "enceinte", "haut-parleur", "musique", "home cinéma"]),
  A("console", "Console de jeux", 150, ["console", "playstation", "ps4", "ps5", "xbox", "jeux"]),
  A("chargeur", "Chargeur de téléphone", 8, ["chargeur", "téléphone", "telephone", "gsm", "smartphone", "tel", "portable"]),
  A("laptop", "Ordinateur portable", 65, ["pc", "laptop", "ordi", "ordinateur", "notebook", "pc portable", "portable"]),
  A("desktop", "Ordinateur de bureau", 200, ["pc bureau", "desktop", "unité centrale", "tour", "écran pc", "ordinateur fixe"]),
  A("imprimante", "Imprimante", 300, ["imprimante", "printer", "impression"]),
  A("photocopieuse", "Photocopieuse", 800, ["copieur", "photocopie", "copie", "photocopieur"]),
  A("scanner", "Scanner", 30, ["scanner", "numériseur"]),
  // ---- Froid ----
  A("frigo", "Réfrigérateur", 150, ["frigo", "réfrigérateur", "refrigerateur", "fridge", "réfrigérateur 2 portes", "frigidaire"]),
  A("congelateur", "Congélateur coffre", 200, ["congélo", "congelateur", "freezer", "coffre", "congélateur armoire"]),
  A("vitrine", "Vitrine réfrigérée", 300, ["vitrine", "frigo vitrine", "présentoir", "boissons", "frigo boutique"]),
  A("glacons", "Machine à glaçons", 250, ["glaçons", "glacons", "glace", "machine à glace"]),
  A("chambre_froide", "Chambre froide", 2500, ["chambre froide", "frigo industriel", "cold room"]),
  A("distributeur_eau", "Distributeur d'eau", 100, ["fontaine", "distributeur", "dispenser", "eau fraîche", "fontaine à eau"]),
  // ---- Eau ----
  A("pompe_05", "Pompe à eau 0,5 CV", 370, ["pompe", "motopompe", "surpresseur", "pompe 0.5", "pompe 0,5", "petite pompe"]),
  A("pompe_1", "Pompe à eau 1 CV", 750, ["pompe 1", "pompe immergée", "forage", "pompe 1cv"]),
  A("pompe_15", "Pompe à eau 1,5 CV", 1100, ["pompe 1.5", "pompe 1,5"]),
  A("pompe_2", "Pompe à eau 2 CV", 1500, ["pompe 2", "pompe forage", "grosse pompe"]),
  A("chauffe_eau", "Chauffe-eau", 2000, ["chauffe-eau", "chauffe eau", "ballon", "ballon d'eau chaude", "geyser"]),
  // ---- Cuisine et ménage ----
  A("bouilloire", "Bouilloire", 1800, ["bouilloire", "kettle", "chauffe eau de table"]),
  A("micro_ondes", "Micro-ondes", 1000, ["micro-onde", "micro onde", "micro", "four micro-ondes", "microwave"]),
  A("four", "Four électrique", 2000, ["four", "four électrique", "mini four"]),
  A("plaque", "Plaque électrique", 1500, ["plaque", "réchaud électrique", "cuisinière", "plaque chauffante", "plaque induction", "cuisiniere"]),
  A("cuiseur_riz", "Cuiseur de riz", 700, ["cuiseur", "rice cooker", "cuiseur riz", "autocuiseur"]),
  A("cafe", "Machine à café", 1000, ["café", "cafetière", "cafetiere", "machine à café"]),
  A("grille_pain", "Grille-pain", 800, ["grille-pain", "grille pain", "toaster"]),
  A("mixeur", "Mixeur / blender", 400, ["blender", "mixer", "mixeur", "moulinex", "robot", "robot de cuisine"]),
  A("moulin", "Moulin / broyeur", 1500, ["moulin", "broyeur", "moulin à maïs", "machine à moudre", "moulin à écraser"]),
  A("lave_linge", "Machine à laver", 400, ["lave-linge", "lave linge", "laveuse", "washing", "machine à laver", "machine laver"]),
  A("seche_linge", "Sèche-linge", 2500, ["sèche-linge", "seche linge", "séchoir à linge"]),
  A("lave_vaisselle", "Lave-vaisselle", 1800, ["lave-vaisselle", "lave vaisselle"]),
  A("fer", "Fer à repasser", 1200, ["fer", "repassage", "fer électrique", "fer a repasser"]),
  A("aspirateur", "Aspirateur", 1200, ["aspirateur", "hoover"]),
  A("seche_cheveux", "Sèche-cheveux", 1200, ["séchoir", "sèche-cheveux", "seche cheveux", "coiffure", "brushing"]),
  A("tondeuse", "Tondeuse à cheveux", 15, ["tondeuse", "rasoir", "coiffeur", "clipper"]),
  A("machine_coudre", "Machine à coudre", 100, ["couture", "singer", "machine à coudre", "machine a coudre"]),
  // ---- Sécurité, portail ----
  A("camera", "Caméra de surveillance", 8, ["caméra", "camera", "cctv", "vidéosurveillance", "surveillance", "camera ip"]),
  A("dvr", "Enregistreur vidéo (DVR / NVR)", 40, ["dvr", "nvr", "enregistreur", "enregistreur caméra"]),
  A("portail", "Moteur de portail", 300, ["portail", "moteur portail", "motorisation", "automatisme", "portail électrique"]),
  // ---- Atelier, élevage ----
  A("perceuse", "Perceuse", 600, ["perceuse", "visseuse", "outil", "drill"]),
  A("meuleuse", "Meuleuse", 900, ["meuleuse", "disqueuse", "grinder"]),
  A("poste_souder", "Poste à souder", 3500, ["poste", "soudure", "soudeuse", "welding", "poste à souder", "poste a souder"]),
  A("compresseur", "Compresseur d'air", 1500, ["compresseur", "air comprimé", "gonfleur"]),
  A("couveuse", "Couveuse / incubateur", 150, ["couveuse", "incubateur", "éclosoir", "incubateur à œufs"]),
];

// La liste de l'espace regardé : le catalogue de départ, plus ce que Timo a
// ajouté ou corrigé (une entrée personnalisée du même id remplace l'entrée
// de départ ; `retire: true` la cache).
export const catalogueAppareils = (db, profile) => {
  const b = profile ? boutiquesVisibles(db, profile, db?.boutiques || []).find((x) => Array.isArray(x.appareils_catalogue)) : null;
  const perso = b ? b.appareils_catalogue : [];
  const parId = new Map(CATALOGUE_APPAREILS.map((a) => [a.id, a]));
  for (const p of perso) {
    if (!p || !p.id) continue;
    if (p.retire) { parId.delete(p.id); continue; }
    parId.set(p.id, { id: p.id, nom: String(p.nom || parId.get(p.id)?.nom || ""), puissance: Number(p.puissance ?? parId.get(p.id)?.puissance ?? 0), autres: Array.isArray(p.autres) ? p.autres : (parId.get(p.id)?.autres || []) });
  }
  return [...parId.values()].filter((a) => a.nom);
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
