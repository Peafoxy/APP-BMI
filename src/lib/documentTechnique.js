// ============================================================
// lib/documentTechnique.js — LE DOCUMENT TECHNIQUE QUI SUIT UN DEVIS SOLAIRE
//
// Timo, 16/11/2026 : « il n'y a pas un document technique comme ça dans
// l'application… la seule partie technique, c'est les appareils avec les
// puissances… ce qui se fait aujourd'hui reste inchangé… juste en
// additionnel, la possibilité de télécharger un document technique qui suit
// le devis » → « ta recommandation, lance » : A a (ceux qui sortent déjà le
// PDF du devis), B b (l'implantation est une phrase libre — REMPLACÉE le
// 17/11/2026 par le « complément de la fiche », lib/complementTechnique.js,
// rangé SUR le devis), C a (pas de
// photos ni de plans), D b (garanties lues sur les fiches + tableau de
// maintenance standard), AUCUN prix, le solaire d'abord.
//
// ⚠ RIEN N'EST ÉCRIT, RIEN N'EST REFAIT À PART : ce fichier LIT un devis déjà
// rangé et rend les mots du document. Les chiffres du calcul viennent des
// MÊMES fonctions que l'écran (lib/solaire.js) ; le matériel vient des lignes
// du devis ; les garanties de la fiche de chaque article.
// ⚠ Aucun prix, jamais : `pu`, `total` et les frais n'entrent pas ici (le banc
// le mesure sur le PDF fabriqué).
// ⚠ Ce fichier ne reçoit JAMAIS `db` : le devis et la LISTE d'articles déjà
// filtrée par l'espace (le mur). Module PUR, deux imports (règles de calcul).
// ============================================================
import { besoinsDepuisConsommation, qteAppareil, RENDEMENT_SYSTEME } from "./solaire.js";
import { specDepuisNom, puissanceUtileW, estHybrideTexte, SOLEIL_DEFAUT, LIBELLE_RACCORDEMENT } from "./choixSolaire.js";
import { ligneGrise } from "./ficheArticle.js";
import { complementDuDevis, CABLES, PROTECTIONS, PHRASE_A_VALIDER } from "./complementTechnique.js";

export const TITRE_DOCUMENT = "DOCUMENT TECHNIQUE";
export const PHRASE_A_CONFIRMER = "À confirmer lors de la visite technique.";

// Un devis SOLAIRE = des besoins qui portent la consommation du jour (un
// portail porte `type_ouvrant`, un devis sans calcul porte une catégorie).
export const estDevisSolaire = (d) => {
  const b = d && d.besoins;
  return !!(b && b.wh_jour != null && !b.type_ouvrant && Number.isFinite(Number(b.wh_jour)));
};

// Le plan d'entretien : les douze activités de l'offre HiKCo de Timo, avec
// le moment où chacune se fait (« 1 mois », « 6 mois », « 1 an »).
export const MAINTENANCE = [
  { activite: "Vérification de l'état général de l'installation", quand: "1 mois" },
  { activite: "Vérification visuelle de l'état des câbles", quand: "1 mois" },
  { activite: "Vérification des serrages des câbles AC / DC", quand: "1 mois" },
  { activite: "Nettoyage des coffrets électriques AC / DC", quand: "1 mois" },
  { activite: "Vérification du bon fonctionnement des ventilateurs des convertisseurs", quand: "6 mois" },
  { activite: "Vérification des parafoudres AC / DC", quand: "1 mois" },
  { activite: "Mesure des tensions et de l'intensité à l'entrée de chaque MPPT", quand: "1 mois" },
  { activite: "Vérification du bon fonctionnement des ATS", quand: "1 mois" },
  { activite: "Briefing avec le client pour rappeler les recommandations données à la fin de l'installation", quand: "1 mois" },
  { activite: "Nettoyage des panneaux si poussiéreux, à l'eau avec une brosse rotative solaire", quand: "1 mois" },
  { activite: "Contrôle des fixations des champs solaires", quand: "1 an" },
  { activite: "Contrôle de la durée de vie des batteries", quand: "1 an" },
];
export const MOMENTS_MAINTENANCE = ["1 mois", "6 mois", "1 an"];

export const PHRASE_CABLAGE = "Les sections de câbles, les protections (parafoudres, disjoncteurs, différentiel) et la mise à la terre sont arrêtées après la visite technique du site.";

const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const arrondi = (n, d = 1) => Math.round(Number(n || 0) * 10 ** d) / 10 ** d;
// Un nombre pour le document : virgule française, sans zéro inutile (2,2 — jamais 2.2).
const virg = (n, d = 1) => String(arrondi(n, d)).replace(".", ",");

// L'article du stock derrière une ligne du devis (par son nom, dans la
// boutique du devis) : sa fiche et ses garanties.
export function articleDeLaLigne(l, produits, boutique) {
  const nom = sansAccents(l && l.article);
  if (!nom) return null;
  const liste = Array.isArray(produits) ? produits : [];
  return liste.find((x) => sansAccents(x.nom) === nom && (!boutique || x.boutique === boutique)) || null;
}

const phraseGarantie = (p) => {
  if (!p) return "";
  const bouts = [];
  if (p.garantie_boutique) bouts.push(`boutique : ${p.garantie_boutique}`);
  if (p.garantie_fabricant) bouts.push(`fabricant : ${p.garantie_fabricant}`);
  return bouts.join(" · ");
};

const LIBELLE_BATTERIE = { lifepo4: "Lithium LiFePO4", gel: "Gel", plomb: "Plomb" };

// 📋 Les caractéristiques d'une ligne (Timo, 17/11/2026, « les insuffisances ») :
// la colonne restait VIDE tant que la fiche de l'article n'était pas remplie.
// D'abord LA FICHE de l'article (puissance, tension, cases d'un convertisseur…,
// lue par `ligneGrise` — la même règle que 📦 Stocks) ; à défaut, ce que le NOM
// de l'article dit (« 550W », « 51.2V 300Ah », « 6KW ») — jamais un chiffre
// deviné : un nom qui ne dit rien laisse la case vide. Une fiche technique
// rangée sur l'article s'annonce (« fiche technique disponible »), sans son lien.
export function caracteristiquesDeLaLigne(categorie, article, p) {
  const bouts = [];
  const fiche = p ? ligneGrise(p) : "";
  if (fiche) bouts.push(fiche);
  else {
    const cat = sansAccents(categorie);
    const spec = specDepuisNom(article);
    const tension = String(article || "").match(/(\d+(?:[.,]\d+)?)\s*v\b/i);
    if (/panneau/.test(cat) && spec && (spec.unite === "w" || spec.unite === "wc")) bouts.push(`${virg(spec.valeur, 0)} W`);
    else if (/batterie/.test(cat)) {
      if (tension) bouts.push(`${virg(parseFloat(tension[1].replace(",", ".")))} V`);
      if (spec && spec.unite === "ah") bouts.push(`${virg(spec.valeur, 0)} Ah`);
    } else if (/convertisseur/.test(cat)) {
      const w = puissanceUtileW(spec);
      if (w > 0) bouts.push(`${virg(w / 1000)} kW`);
      if (estHybrideTexte(article)) bouts.push("hybride (régulateur intégré)");
    }
  }
  if (p && p.fiche_technique) bouts.push("fiche technique disponible");
  return bouts.join(" · ");
}

// Les lignes du matériel, SANS aucun prix, ni les frais, ni un élément « cf.
// visite » (sans chiffre : il n'est pas encore du matériel retenu).
export function lignesMateriel(devis, produits) {
  const lignes = Array.isArray(devis && devis.lignes) ? devis.lignes : [];
  return lignes
    .filter((l) => l && l.article && !l.cf_visite && !/^(frais|remise|installation|transport)/i.test(String(l.categorie || "")))
    .filter((l) => !/^(frais d'installation|frais de transport|remise)/i.test(String(l.article || "")))
    .map((l) => {
      const p = articleDeLaLigne(l, produits, devis.boutique);
      return {
        categorie: String(l.categorie || ""),
        article: String(l.article || ""),
        qte: Number(l.qte || 0),
        fiche: p ? ligneGrise(p) : "",
        caracteristiques: caracteristiquesDeLaLigne(l.categorie, l.article, p),
        garantie: phraseGarantie(p),
      };
    });
}

// Ce que le matériel retenu apporte, lu dans le NOM des articles
// (« Panneau 580W », « Batterie 51.2V 300Ah », « Convertisseur 6KW ») — un
// article dont le nom ne dit rien n'est pas compté (jamais un chiffre deviné).
export function materielRetenu(materiel, tensionCalcul) {
  let wc = 0; let ah = 0; let w = 0;
  let sansSpec = 0;
  for (const m of materiel) {
    const cat = sansAccents(m.categorie);
    const spec = specDepuisNom(m.article);
    if (/panneau/.test(cat)) { if (spec && (spec.unite === "w" || spec.unite === "wc")) wc += spec.valeur * m.qte; else sansSpec += 1; }
    else if (/batterie/.test(cat)) { if (spec && spec.unite === "ah") ah += spec.valeur * m.qte; else sansSpec += 1; }
    else if (/convertisseur/.test(cat)) { const u = puissanceUtileW(spec); if (u > 0) w += u * m.qte; else sansSpec += 1; }
  }
  const kwhBatterie = ah > 0 && Number(tensionCalcul) > 0 ? (ah * Number(tensionCalcul)) / 1000 : 0;
  return { wc, ah, w, kwhBatterie, sansSpec };
}

// Le complément de la fiche (implantation, montage, câbles, protections), lu SUR
// le devis, mis en phrases pour le document. Ce qui n'est pas renseigné reste
// « à confirmer » : on n'écrit jamais une valeur que personne n'a donnée.
function complementPourDocument(devis) {
  const c = complementDuDevis(devis);
  if (!Object.keys(c).length) return { vide: true, implantation: [], montage: "", cables: [], protections: [], autres: "", phrase: PHRASE_A_VALIDER };
  const imp = c.implantation || {};
  const implantation = [
    imp.support ? { libelle: "Support", valeur: imp.support } : null,
    imp.orientation ? { libelle: "Orientation", valeur: imp.orientation } : null,
    imp.inclinaison !== undefined ? { libelle: "Inclinaison", valeur: `${virg(imp.inclinaison)} °` } : null,
    imp.local ? { libelle: "Local technique", valeur: imp.local } : null,
    imp.distance_champ_local ? { libelle: "Distance champ solaire → local technique", valeur: `${virg(imp.distance_champ_local)} m` } : null,
  ].filter(Boolean);
  const m = c.montage || {};
  const montage = m.serie && m.parallele
    ? `${m.serie} panneau${m.serie > 1 ? "x" : ""} en série par ligne, ${m.parallele} ligne${m.parallele > 1 ? "s" : ""} en parallèle (${m.serie * m.parallele} panneaux).`
    : m.serie ? `${m.serie} panneau${m.serie > 1 ? "x" : ""} en série par ligne ; nombre de lignes en parallèle à confirmer.`
    : m.parallele ? `${m.parallele} ligne${m.parallele > 1 ? "s" : ""} en parallèle ; nombre de panneaux en série à confirmer.` : "";
  const cables = CABLES.map(({ id, libelle, trajet }) => {
    const l = (c.cables || {})[id] || {};
    return { libelle, trajet, section: l.section ? `${l.section} mm²` : "", longueur: l.longueur ? `${virg(l.longueur)} m` : "" };
  });
  const protections = PROTECTIONS.map(({ id, libelle }) => {
    const p = (c.protections || {})[id];
    return { libelle, prevue: !!p, calibre: p && p.calibre ? p.calibre : "" };
  });
  return { vide: false, implantation, montage, cables, protections, autres: c.autres || "", phrase: PHRASE_A_VALIDER };
}

// Tout le document, en données. Le complément de la fiche est LU sur le devis
// (rien n'est demandé au téléchargement) ; vide = « à confirmer ».
export function documentTechnique(devis, { produits = [] } = {}) {
  if (!estDevisSolaire(devis)) return null;
  const b = devis.besoins;
  const soleilRange = Number(b.soleil) > 0;
  const soleil = soleilRange ? Number(b.soleil) : Number(SOLEIL_DEFAUT);
  const autonomie = Number(b.autonomie || 1);
  const reglages = { autonomie, soleil, tension: Number(b.tension || 48), typeBatterie: b.type_batterie || "lifepo4" };
  const whJour = Number(b.wh_jour || 0);
  const simultanee = Number(b.puissance_simultanee || 0);
  const base = besoinsDepuisConsommation(whJour, simultanee, reglages);

  const appareils = (Array.isArray(b.appareils) ? b.appareils : []).map((a) => {
    const q = qteAppareil(a);
    const p = Number(a.puissance || 0);
    const h = Number(a.heures || 0);
    return { nom: String(a.nom || ""), puissance: p, qte: q, cumulee: p * q, heures: h, wh: p * q * h };
  });
  const totalCumulee = appareils.reduce((s, a) => s + a.cumulee, 0);
  const totalWh = appareils.reduce((s, a) => s + a.wh, 0);

  const materiel = lignesMateriel(devis, produits);
  const retenu = materielRetenu(materiel, base.tensionCalcul);
  const production = retenu.wc > 0 ? (retenu.wc * soleil * RENDEMENT_SYSTEME) / 1000 : 0;
  const utilisable = retenu.kwhBatterie > 0 ? retenu.kwhBatterie * base.dod : 0;

  const raccordement = b.raccordement === "tri" ? "tri" : "mono";
  const calcul = [
    { libelle: "Consommation par jour", valeur: `${virg(whJour / 1000)} kWh`, detail: b.conso_connue ? "d'après la consommation connue du client" : "somme des appareils (puissance x quantité x heures)" },
    { libelle: "Puissance en même temps", valeur: `${Math.round(simultanee)} W`, detail: "ce que le client peut tirer d'un coup" },
    { libelle: "Panneaux nécessaires", valeur: `${Math.round(base.wcPanneaux)} Wc`, detail: `${virg(whJour / 1000)} kWh / ${soleil} h de soleil / ${Math.round(RENDEMENT_SYSTEME * 100)} % de rendement (pertes de câbles, poussière, température)` },
    { libelle: "Batteries nécessaires", valeur: `${Math.round(base.ahBatterie)} Ah (${virg((base.ahBatterie * base.tensionCalcul) / 1000)} kWh)`, detail: `${autonomie} jour${autonomie > 1 ? "s" : ""} d'autonomie, ${LIBELLE_BATTERIE[reglages.typeBatterie] || reglages.typeBatterie}, ${virg(base.tensionCalcul)} V, décharge admise ${Math.round(base.dod * 100)} %` },
    { libelle: "Convertisseur nécessaire", valeur: `${virg(base.wConvertisseur / 1000)} kW`, detail: "deux fois la puissance en même temps : marge pour les démarrages (moteurs, compresseurs)" },
    // Le régulateur n'est dit que si le devis en porte un (un convertisseur
    // hybride a le sien intégré : le chiffre n'aurait aucun sens).
    ...(base.aRegulateur > 0 && materiel.some((m) => /regulateur|mppt/.test(sansAccents(m.categorie))) ? [{ libelle: "Régulateur solaire", valeur: `${Math.round(base.aRegulateur)} A`, detail: "courant côté batterie, majoré de 25 % de sécurité" }] : []),
  ];

  const couverture = [];
  if (retenu.wc > 0) couverture.push({ libelle: "Panneaux retenus", valeur: `${virg(retenu.wc / 1000)} kWc`, detail: production > 0 ? `production estimée ${virg(production)} kWh par jour pour ${virg(whJour / 1000)} kWh consommés` : "" });
  if (retenu.kwhBatterie > 0) couverture.push({ libelle: "Batteries retenues", valeur: `${virg(retenu.kwhBatterie)} kWh`, detail: utilisable > 0 && whJour > 0 ? `${virg(utilisable)} kWh utilisables, soit ${Math.round((utilisable * 1000 / whJour) * 100)} % d'une journée de consommation` : "" });
  if (retenu.w > 0) couverture.push({ libelle: "Convertisseurs retenus", valeur: `${virg(retenu.w / 1000)} kW`, detail: simultanee > 0 ? `pour ${Math.round(simultanee)} W en même temps` : "" });

  const resume = [
    `Installation solaire ${raccordement === "tri" ? "triphasée" : "monophasée"} pour une consommation d'environ ${virg(whJour / 1000)} kWh par jour et une puissance de ${Math.round(simultanee)} W en même temps.`,
    `Le calcul retient ${soleil} h de soleil par jour, ${autonomie} jour${autonomie > 1 ? "s" : ""} d'autonomie et un système en ${Math.round(reglages.tension)} V.`,
  ];

  return {
    titre: TITRE_DOCUMENT,
    resume,
    raccordement,
    libelleRaccordement: LIBELLE_RACCORDEMENT[raccordement],
    soleil,
    soleilNonRange: !soleilRange,
    appareils,
    totalCumulee,
    totalWh,
    consoConnue: b.conso_connue || null,
    calcul,
    couverture,
    materiel,
    complement: complementPourDocument(devis),
    maintenance: MAINTENANCE,
    cablage: PHRASE_CABLAGE,
    sansSpec: retenu.sansSpec,
  };
}
