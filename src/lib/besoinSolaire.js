// ============================================================
// lib/besoinSolaire.js — LIRE LES APPAREILS DANS LE BESOIN D'UN PROSPECT
// (Timo, 24/09/2026 : « est-ce pas possible d'utiliser l'outil de
// dimensionnement pour envoyer un devis solaire au client ? » → « 1 et 2 »)
//
// Le client de l'assistant WhatsApp décrit son besoin en une phrase :
//   « 2 clim de 1,5hp 8h par jour 10 ampoule de 15w toute la nuit Un
//     congélateur de 200w branché h24 »
// Cette règle en tire la liste d'appareils du volet solaire — quantité,
// appareil du catalogue, puissance, heures — pour PRÉ-REMPLIR le
// dimensionnement. ⚠ C'est un pré-remplissage, jamais un devis : le vendeur
// relit chaque ligne, corrige, et c'est LUI qui envoie. Une lecture ratée
// (appareil inconnu, heures absentes) laisse la case VIDE au lieu de
// deviner — un chiffre inventé dans un devis est pire qu'une case à remplir.
//
// Les mots viennent du catalogue d'appareils (lib/appareils.js) : les
// mêmes noms et « autres noms » que le champ Appareil du volet. Rien
// n'est recopié ici. Fichier PUR : le banc l'exerce sur la phrase de Timo.
// ============================================================
import { sansAccents } from "./suggestions.js";

const NOMBRES = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12, quinze: 15, vingt: 20 };
const UNITES = new Set(["w", "kw", "watt", "watts", "hp", "cv", "h", "heure", "heures", "btu", "v", "volts"]);
const MOTS_VIDES = new Set(["de", "du", "des", "d", "la", "le", "les", "l", "par", "jour", "jours", "toute", "tout", "la", "nuit", "branche", "branches", "en", "et", "avec", "pour", "a", "au", "aux", "chaque", "environ", "pendant", "heure", "heures", "continu", "journee", "soir", "matin", "utilise", "utilises", "allume", "allumes", "marche", "fonctionne", "qui", "que", "sur", "dans", "ma", "mon", "mes", "sa", "son", "ses", "un", "une"]);

// Une valeur collée à son unité (« 15w », « 1.5hp », « 8h ») ou séparée
// (« 15 w »). Rend { valeur, unite } ou null.
const valeurUnite = (tok, suivant) => {
  const m = /^(\d+(?:\.\d+)?)([a-z]+)$/.exec(tok);
  if (m && UNITES.has(m[2])) return { valeur: Number(m[1]), unite: m[2], consomme: 1 };
  if (/^\d+(?:\.\d+)?$/.test(tok) && suivant && UNITES.has(suivant)) return { valeur: Number(tok), unite: suivant, consomme: 2 };
  return null;
};
const estQuantite = (tok, suivant) => (/^\d+$/.test(tok) || NOMBRES[tok] !== undefined) && !(suivant && UNITES.has(suivant));
const quantiteDe = (tok) => (NOMBRES[tok] !== undefined ? NOMBRES[tok] : Number(tok));

// Le texte normalisé : sans accents, virgule décimale → point, les
// marques de « 24 h sur 24 » ramenées à un seul mot, les séparateurs de
// liste rendus visibles.
const normaliser = (texte) => sansAccents(texte)
  .replace(/(\d),(\d)/g, "$1.$2")
  .replace(/,/g, " , ")
  .replace(/\b(jour et nuit|24 ?h ?\/ ?24|24 ?sur ?24|h ?24|24 ?h|non stop|en permanence|en continu|toute la journee et la nuit)\b/g, " h24 ")
  .replace(/[;+\n]|\bet\b|\bplus\b/g, " , ");

const HEURES_24 = (mots) => mots.includes("h24");
const heuresExplicites = (mots) => {
  for (let i = 0; i < mots.length; i++) {
    const v = valeurUnite(mots[i], mots[i + 1]);
    if (v && (v.unite === "h" || v.unite.startsWith("heure"))) return v.valeur;
  }
  return null;
};

// L'appareil du catalogue dont un nom (ou un autre nom) se lit ENTIER dans
// le segment ; le plus long l'emporte (« clim 1.5 » avant « clim »).
function appareilDuSegment(catalogue, mots, hp) {
  const texte = ` ${mots.join(" ")} `;
  let meilleur = null;
  for (const a of catalogue || []) {
    for (const nom of [a.nom, ...(a.autres || [])]) {
      const n = sansAccents(nom).replace(/(\d),(\d)/g, "$1.$2");
      if (!n) continue;
      if (texte.includes(` ${n} `) || texte.includes(` ${n}s `)) {
        if (!meilleur || n.length > meilleur.n.length) meilleur = { a, n };
      }
    }
  }
  if (!meilleur) return null;
  // « clim … 1.5hp » : la puissance en chevaux désigne une VARIANTE du
  // catalogue (« clim 1.5 »), si elle existe.
  if (hp != null) {
    const cle = `${meilleur.n} ${String(hp).replace(/\.0$/, "")}`;
    const variante = (catalogue || []).find((a) => [a.nom, ...(a.autres || [])].some((x) => sansAccents(x).replace(/(\d),(\d)/g, "$1.$2") === cle));
    if (variante) return variante;
  }
  return meilleur.a;
}

// Rend la liste d'appareils du volet solaire : { nom, puissance, heures, qte, reconnu }.
// `catalogue` = catalogueAppareils(db, profile) — le vrai, avec les ajouts de Timo.
// Le premier mot d'un nom du catalogue (« clim », « ampoule »,
// « congelateur »…) : c'est lui qui dit qu'un nombre est une QUANTITÉ.
const premiersMots = (catalogue) => {
  const s = new Set();
  for (const a of catalogue || []) for (const nom of [a.nom, ...(a.autres || [])]) {
    const m = sansAccents(nom).split(" ")[0];
    if (m) s.add(m);
  }
  return s;
};
export function lireAppareils(texte, catalogue = []) {
  const brut = normaliser(texte);
  if (!brut.trim()) return [];
  const tokens = brut.split(/[^a-z0-9.,]+/).filter(Boolean);
  const connus = premiersMots(catalogue);
  const motConnu = (t) => !!t && (connus.has(t) || connus.has(t.replace(/s$/, "")));
  // Découpage : un segment commence à une virgule, ou à une quantité
  // (« 2 », « dix », « un ») — ⚠ un nombre n'est une quantité qu'en TÊTE
  // de segment ou devant un mot du catalogue (« 10 ampoule ») : dans
  // « télé 55 pouces », 55 n'ouvre rien. Ce qui précède la première
  // quantité forme un segment de quantité 1 s'il porte des mots.
  const segments = [];
  let courant = null;
  const ouvrir = (qte) => { courant = { qte, mots: [] }; segments.push(courant); };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === ",") { courant = null; continue; }
    if (estQuantite(t, tokens[i + 1]) && (!courant || !courant.mots.length || motConnu(tokens[i + 1]))) { ouvrir(quantiteDe(t)); continue; }
    if (!courant) ouvrir(1);
    courant.mots.push(t);
  }
  const resultat = [];
  for (const s of segments) {
    if (!s.mots.length) continue;
    const mots = s.mots;
    let watts = null, hp = null;
    for (let i = 0; i < mots.length; i++) {
      const v = valeurUnite(mots[i], mots[i + 1]);
      if (!v) continue;
      if (v.unite === "w" || v.unite.startsWith("watt")) watts = v.valeur;
      if (v.unite === "kw") watts = v.valeur * 1000;
      if (v.unite === "hp" || v.unite === "cv") hp = v.valeur;
    }
    const heures = HEURES_24(mots) ? 24
      : heuresExplicites(mots) ?? (mots.includes("nuit") ? 12 : mots.includes("journee") ? 12 : null);
    const appareil = appareilDuSegment(catalogue, mots, hp);
    const motsLibres = mots.filter((m) => !MOTS_VIDES.has(m) && !valeurUnite(m) && !UNITES.has(m) && !/^\d/.test(m) && m !== "h24");
    // Un segment que le catalogue ne reconnaît pas n'est un appareil que
    // s'il porte une puissance (« 2 machines bizarres 300w ») : « une
    // maison 4 pièces » n'en est pas un.
    if (!appareil && (!motsLibres.length || watts == null)) continue;
    const nom = appareil ? appareil.nom : motsLibres.join(" ").replace(/^./, (c) => c.toUpperCase());
    const puissance = watts != null ? watts : (appareil ? appareil.puissance : "");
    resultat.push({ nom, puissance: puissance === "" ? "" : String(puissance), heures: heures == null ? "" : String(heures), qte: String(s.qte || 1), reconnu: !!appareil });
  }
  return resultat;
}

// La phrase que le vendeur lit en arrivant sur le volet : ce qui a été
// reconnu, ce qui ne l'a pas été. Jamais muette.
export function resumeLecture(appareils) {
  if (!appareils.length) return "Aucun appareil reconnu dans le besoin : saisissez-les à la main.";
  const inconnus = appareils.filter((a) => !a.reconnu).map((a) => a.nom);
  const manque = appareils.filter((a) => !a.heures || !a.puissance).length;
  return `${appareils.length} appareil(s) lu(s) dans le besoin du prospect — vérifiez chaque ligne avant d'envoyer.`
    + (inconnus.length ? ` Non reconnus (puissance à saisir) : ${inconnus.join(", ")}.` : "")
    + (manque ? ` ${manque} ligne(s) sans puissance ou sans heures.` : "");
}
