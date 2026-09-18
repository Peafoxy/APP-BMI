// ============================================================
// lib/outillage.js — 🧰 LE MATÉRIEL DE TRAVAIL DE BMI
//
// Timo, 17/09/2026 : « le matériel de travail… comment faire le suivi,
// pour éviter la perte des équipements de travail sur le terrain ».
//
// ⚠ CE N'EST PAS DU STOCK. Le stock compte ce qui se VEND ; une échelle ne
// se vend pas, elle part et elle revient. Rangée dans 📦 Stocks, elle
// entrerait dans la valeur du stock, dans les alertes de réapprovisionnement,
// et une sortie ressemblerait à une vente : les chiffres mentiraient. Le
// registre de l'outillage vit donc à part, dans le champ `outillage` de SA
// boutique — comme la liste des banques ou le catalogue d'appareils, il n'y
// a RIEN à coller pour créer une table.
//
// LA RÈGLE QUI EMPÊCHE LA PERTE : un outil est TOUJOURS sous le nom de
// QUELQU'UN. Pas « sur le chantier de MR ERIC » — un chantier ne perd pas
// une perceuse, une personne la perd. Le chantier est noté à côté, pour
// savoir où l'outil est parti ; la responsabilité, elle, a un nom.
//
// ⚠ Ce fichier n'importe RIEN (comme lib/banques.js et lib/espace.js) :
// il doit pouvoir être lu par Node sans bundler.
// ============================================================

// ---- Qui tient le registre (décision Timo, 17/09/2026 : « chef technicien,
// magasinier, administrateur »). Le chef technicien est un technicien —
// à commission ou salarié — porteur de l'étoile ⭐ chef d'équipe. Le
// technicien ORDINAIRE ne s'enregistre pas lui-même : sinon la trace ne vaut
// rien. Le serveur dit la même chose (securite-22, a_pouvoir_outillage).
export const ROLES_OUTILLAGE = ["magasinier", "admin"];
export const ROLES_CHEF_OUTILLAGE = ["technicien", "technicien_bmi"];
export const peutTenirOutillage = (profile) => {
  const r = String(profile?.role || "");
  if (ROLES_OUTILLAGE.includes(r)) return true;
  return ROLES_CHEF_OUTILLAGE.includes(r) && !!profile?.chef_equipe;
};

// ---- L'état d'un outil, DÉRIVÉ de son dernier mouvement. Jamais un champ
// écrit à la main : deux vérités qui peuvent diverger, c'est une vérité de
// moins.
export const ETATS_OUTIL = {
  // ⚠ « RANGÉ », pas « En boutique » (capture Timo, 18/09/2026 : « je ne
  // comprends pas pourquoi on dit en boutique même si au magasin »). L'outil
  // est rangé dans un LIEU — boutique OU magasin —, et la colonne « Où » le
  // nomme juste à côté. L'identifiant `en_boutique` ne bouge pas : il est
  // interne, l'état est DÉRIVÉ, rien n'est stocké.
  en_boutique: { libelle: "Rangé", teinte: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  sorti:       { libelle: "Sorti",       teinte: "text-sky-800 bg-sky-50 border-sky-200" },
  reparation:  { libelle: "En réparation", teinte: "text-amber-700 bg-amber-50 border-amber-200" },
  perdu:       { libelle: "Perdu",       teinte: "text-red-700 bg-red-50 border-red-200" },
  reforme:     { libelle: "Réformé",     teinte: "text-slate-600 bg-slate-100 border-slate-300" },
};
export const TYPES_MOUVEMENT = ["sortie", "retour", "reparation", "perdu", "reforme", "chantier", "comptage"];

export const mouvementsDe = (outil) => Array.isArray(outil?.mouvements) ? outil.mouvements : [];
export const dernierMouvement = (outil) => {
  const m = mouvementsDe(outil);
  return m.length ? m[m.length - 1] : null;
};
// ⚠ TOUS les mouvements ne changent pas l'ÉTAT. Depuis le 18/09/2026, un
// outil peut CHANGER DE CHANTIER sans rentrer (Timo : « aujourd'hui il finit
// le chantier A, il n'a pas besoin de ramener l'outil avant d'aller sur le
// chantier B »). Ce mouvement-là est TRANSPARENT : il s'inscrit au registre,
// mais l'outil reste sorti, chez la même personne, avec la même date de
// retour. L'état se lit donc sur le dernier mouvement qui le CHANGE.
const TYPES_ETAT = ["sortie", "retour", "reparation", "perdu", "reforme"];
const dernierDeType = (outil, types) => {
  const l = mouvementsDe(outil).filter((m) => types.includes(m?.type));
  return l.length ? l[l.length - 1] : null;
};
export const dernierMouvementEtat = (outil) => dernierDeType(outil, TYPES_ETAT);
export const etatOutil = (outil) => {
  const d = dernierMouvementEtat(outil);
  if (!d) return "en_boutique";
  if (d.type === "sortie") return "sorti";
  if (d.type === "reparation") return "reparation";
  if (d.type === "perdu") return "perdu";
  if (d.type === "reforme") return "reforme";
  return "en_boutique"; // retour, ou un type inconnu d'une version future
};
export const libelleEtat = (etat) => (ETATS_OUTIL[etat] || {}).libelle || String(etat || "");

// Le DÉTENTEUR : qui répond de l'outil en ce moment. Vide s'il est rangé.
export const detenteurOutil = (outil) => {
  const d = sortieEnCours(outil);
  return d && d.user_id ? { id: d.user_id, nom: d.user || "" } : null;
};
export const sortieEnCours = (outil) => (etatOutil(outil) === "sorti" ? dernierMouvementEtat(outil) : null);

// ---- Le registre d'une boutique. `outillage` = { outils, appels }.
export const registreDe = (boutique) => {
  const o = boutique && typeof boutique.outillage === "object" && boutique.outillage ? boutique.outillage : {};
  return { outils: Array.isArray(o.outils) ? o.outils : [], appels: Array.isArray(o.appels) ? o.appels : [] };
};
export const outilsDe = (boutique) => registreDe(boutique).outils;

// ---- ⚠ LE REGISTRE EST CELUI DE TOUTE LA MAISON (Timo, 18/09/2026 : « pour
// l'outillage, ne pas classer par boutique… c'est une propriété générale de
// toute l'entreprise. C'est qui reçoit l'outil qui peut le faire classer :
// un gérant de boutique qui reçoit, c'est dans sa boutique ; un magasinier,
// c'est au magasin »).
//
// Un marteau n'appartient pas à une boutique — il est à BMI. Ce qui change,
// c'est OÙ il se trouve, et ça se DÉDUIT de la dernière personne qui l'a
// reçu ; jamais d'une pastille en haut de l'écran.
//
// ⚠ Sous le capot, chaque outil reste écrit dans la fiche d'une boutique
// (rien à coller, et securite-22/-23/-24 continuent de valoir). C'est
// l'application qui les RÉUNIT : `registreUnifie` rend un registre unique,
// où chaque outil porte discrètement la fiche qui le garde (`_fiche`) et le
// nom de cette fiche (`_lieu_defaut`, pour les outils d'avant cette règle).
// Toutes les règles qui lisaient « un registre » marchent telles quelles.
const MARQUES = ["_fiche", "_lieu_defaut"];
export const sansMarques = (outil) => {
  const o = { ...(outil || {}) };
  MARQUES.forEach((k) => delete o[k]);
  return o;
};
export const registreUnifie = (boutiques) => ({
  id: "", nom: "",
  outillage: {
    outils: (boutiques || []).flatMap((b) => outilsDe(b).map((o) => ({ ...o, _fiche: b?.id || "", _lieu_defaut: b?.nom || "" }))),
    appels: [],
    supprimes: (boutiques || []).flatMap((b) => supprimesDe(b).map((o) => ({ ...o, _fiche: b?.id || "", _lieu_defaut: b?.nom || "" }))),
  },
});
// Les LIEUX possibles : les boutiques et les magasins de l'espace regardé.
// Jamais la caisse TERRAIN, qui ne range rien.
export const lieuxDuRegistre = (boutiques) => (boutiques || []).filter((b) => !b?.terrain);
// Le lieu où un outil est RANGÉ (même s'il est dehors : il y reviendra).
export const lieuDeRangement = (outil, defaut) => {
  const avecLieu = mouvementsDe(outil).filter((m) => m && m.lieu);
  if (avecLieu.length) return String(avecLieu[avecLieu.length - 1].lieu);
  return String(outil?.lieu || outil?._lieu_defaut || defaut || "");
};
// Le lieu tel qu'on le LIT : chez une personne tant qu'il est dehors.
export const lieuOutil = (outil, defaut) => {
  if (etatOutil(outil) === "sorti") {
    const d = detenteurOutil(outil);
    return { type: "personne", nom: d && d.nom ? d.nom : "—" };
  }
  return { type: "lieu", nom: lieuDeRangement(outil, defaut) };
};
export const outilsDuLieu = (registre, lieu) =>
  outilsDe(registre).filter((o) => lieuDeRangement(o) === String(lieu || ""));
// Le lieu d'une personne : sa boutique, si c'en est une du registre. Vide
// pour un administrateur « Toutes » ou un technicien — on lui DEMANDE alors
// où il range l'outil (décision Timo, 18/09/2026).
export const lieuDeLaPersonne = (profile, lieux) =>
  (lieux || []).some((b) => (b?.nom || b) === profile?.boutique) ? String(profile.boutique) : "";
export const appelsDe = (boutique) => registreDe(boutique).appels;
// Un outil RÉFORMÉ ou PERDU ne se sort plus : il reste au registre pour la
// trace, jamais dans les listes de travail.
export const outilsVivants = (boutique) => outilsDe(boutique).filter((o) => !["perdu", "reforme"].includes(etatOutil(o)));
export const outilsDehors = (boutique) => outilsDe(boutique).filter((o) => etatOutil(o) === "sorti");

// ---- ⚠ PERDUS et 🗑 HORS D'USAGE : UN SEUL CARRÉ, DEUX BLOCS DEDANS
// Timo, 18/09/2026 : « pas un 6e carré… grouper avec perdu. Donc carré
// perdu-hors d'usage. À l'intérieur on classe les perdus et les hors
// d'usage. » Les PERDUS d'abord — il y a de l'argent en jeu, quelqu'un peut
// devoir rembourser ; les RÉFORMÉS ensuite — usés ou cassés, plus rien à
// rembourser de personne. Les deux sortent du matériel de travail
// (`outilsVivants`), les deux gardent leur trace pour toujours.
export const outilsPerdus = (boutique) => outilsDe(boutique).filter((o) => etatOutil(o) === "perdu");
export const outilsReformes = (boutique) => outilsDe(boutique).filter((o) => etatOutil(o) === "reforme");
export const outilsHorsService = (boutique) => [...outilsPerdus(boutique), ...outilsReformes(boutique)];
// Le mouvement qui a mis l'outil hors d'usage : qui l'a décidé, quand, pourquoi.
export const reformeDe = (outil) => (etatOutil(outil) === "reforme" ? dernierMouvementEtat(outil) : null);

// ---- Le retard : la date de retour est passée et l'outil n'est pas rentré.
export const enRetard = (outil, aujourdhui) => {
  const s = sortieEnCours(outil);
  return !!(s && s.retour_prevu && String(s.retour_prevu) < String(aujourdhui));
};
export const joursDehors = (outil, aujourdhui) => {
  const s = sortieEnCours(outil);
  if (!s || !s.le) return 0;
  const a = Date.parse(`${String(s.le).slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${String(aujourdhui).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
};

// Ce que chaque personne détient — la ligne qu'on regarde avant de faire
// les comptes de quelqu'un qui quitte BMI.
export const parDetenteur = (boutique) => {
  const par = new Map();
  outilsDehors(boutique).forEach((o) => {
    const d = detenteurOutil(o);
    const cle = d ? d.id : "";
    if (!par.has(cle)) par.set(cle, { id: cle, nom: d ? d.nom : "—", outils: [] });
    par.get(cle).outils.push(o);
  });
  return [...par.values()].sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr"));
};

// ---- LES GESTES. Chacun rend un NOUVEL outil : on n'efface jamais un
// mouvement, la liste ne rétrécit jamais.
const ajouter = (outil, mvt) => ({ ...outil, mouvements: [...mouvementsDe(outil), mvt] });

export const critiqueSortie = (outil, { user_id, retour_prevu } = {}) => {
  if (!outil) return "Choisissez d'abord un outil.";
  const etat = etatOutil(outil);
  if (etat === "sorti") {
    const d = detenteurOutil(outil);
    return `« ${outil.nom} » est déjà sorti${d && d.nom ? ` — il est chez ${d.nom}` : ""}. Enregistrez son retour d'abord.`;
  }
  if (etat === "reparation") return `« ${outil.nom} » est en réparation : il ne peut pas partir sur un chantier.`;
  if (etat === "perdu") return `« ${outil.nom} » est déclaré perdu.`;
  if (etat === "reforme") return `« ${outil.nom} » est réformé : il ne fait plus partie du matériel de travail.`;
  if (!user_id) return "Dites qui prend l'outil : un outil est toujours sous le nom de quelqu'un.";
  if (!retour_prevu) return "Dites quand l'outil doit revenir.";
  return "";
};
export const sortirOutil = (outil, { id, le, user_id, user, chantier, retour_prevu, par_id, par }) =>
  ajouter(outil, { id, type: "sortie", le, user_id, user, chantier: chantier || "", retour_prevu, par_id, par });

export const critiqueRetour = (outil, { compte } = {}) => {
  if (!outil) return "Choisissez d'abord un outil.";
  const etat = etatOutil(outil);
  if (etat === "en_boutique") return `« ${outil.nom} » est déjà rentré : il est rangé à ${lieuDeRangement(outil) || "son lieu"}.`;
  if (etat !== "sorti" && etat !== "reparation") return `« ${outil.nom} » est ${libelleEtat(etat).toLowerCase()} : son retour ne se note plus ici.`;
  // ⚠ DÉCISION 1a (Timo, 18/09/2026) : une BOÎTE ne rentre pas sans être
  // comptée. Soit celui qui rend l'a déjà comptée (décision 2b) et le
  // comptage est posté après SA sortie, soit il arrive avec le retour.
  if (etat === "sorti" && estBoite(outil) && !comptageDeLaSortie(outil)) return critiqueComptage(outil, compte);
  return "";
};
// ⚠ Le RETOUR porte le LIEU : c'est celui qui reçoit qui classe l'outil
// (Timo, 18/09/2026). Sa boutique, le magasin — ou, s'il n'en a pas, le lieu
// qu'on lui demande.
export const rendreOutil = (outil, { id, le, etat, note, lieu, par_id, par }) =>
  ajouter(outil, { id, type: "retour", le, etat: etat || "bon", note: note || "", lieu: String(lieu || ""), par_id, par });

// 🔧 Réparation : chez QUI, son NUMÉRO, la PANNE, le PRIX (Timo, 18/09/2026).
export const mettreEnReparation = (outil, { id, le, reparateur, tel, panne, prix, note, par_id, par }) =>
  ajouter(outil, { id, type: "reparation", le,
    reparateur: String(reparateur || "").trim(), tel: String(tel || "").trim(),
    panne: String(panne || "").trim(), prix: Number(prix || 0), note: note || "", par_id, par });

// ---- PERDU (décisions « b » ET « c » de Timo, 17/09/2026) : on marque la
// perte, on GARDE sa valeur pour le total des pertes de l'année, ET on peut
// poser une retenue sur le salaire de la personne qui en répondait.
export const critiquePerte = (outil, { motif } = {}) => {
  if (!outil) return "Choisissez d'abord un outil.";
  const etat = etatOutil(outil);
  if (etat === "perdu") return `« ${outil.nom} » est déjà déclaré perdu.`;
  if (etat === "reforme") return `« ${outil.nom} » est réformé : il n'y a plus de perte à déclarer.`;
  if (!String(motif || "").trim()) return "Dites ce qui s'est passé : une perte sans motif ne s'explique à personne.";
  return "";
};
// La personne qui répondait de l'outil au moment de la perte — vide s'il
// était rangé en boutique (perdu dans la boutique, personne n'en répond).
export const responsableDeLaPerte = (outil) => detenteurOutil(outil);
export const valeurProposee = (outil) => Number(outil?.prix_achat || 0);
export const declarerPerdu = (outil, { id, le, motif, valeur, a_rembourser, user_id, user, par_id, par }) =>
  ajouter(outil, {
    id, type: "perdu", le, motif: String(motif || "").trim(), valeur: Number(valeur || 0),
    // Ce qu'on demande à la personne (0 = la perte reste à la charge de BMI),
    // et ce qui lui a déjà été retenu : c'est l'ardoise de la perte.
    a_rembourser: Math.max(0, Number(a_rembourser || 0)), retenues: [],
    user_id: user_id || "", user: user || "", par_id, par,
  });
export const reformerOutil = (outil, { id, le, motif, par_id, par }) =>
  ajouter(outil, { id, type: "reforme", le, motif: String(motif || "").trim(), par_id, par });

// La RETENUE sur SALAIRE (décision « b ») : elle passe par le mécanisme qui
// existe déjà — une AVANCE du mois, que `paieMois` soustrait du net sans
// toucher à la base CNSS (ce n'est pas une rémunération). Aucun champ neuf.
// ⚠ Pour un technicien à COMMISSION, ce chemin ne mène nulle part : il n'a
// pas de salaire. Le sien est plus bas — `retenueSurPaiement`.
export const retenuePourOutil = ({ id, mois, montant, outil, date, par }) => ({
  id, mois, montant: Number(montant || 0),
  motif: `Outil perdu : ${outil || ""}`.trim(),
  date, auto: "outil_perdu", par: par || "",
});

// Les mouvements de perte d'une période, et leur total (décision « c »).
export const pertesDe = (boutique, periode) => {
  const du = periode && periode.du ? String(periode.du) : "";
  const au = periode && periode.au ? String(periode.au) : "";
  const lignes = [];
  outilsDe(boutique).forEach((o) => {
    mouvementsDe(o).forEach((m) => {
      if (m.type !== "perdu") return;
      const j = String(m.le || "").slice(0, 10);
      if (du && j < du) return;
      if (au && j > au) return;
      lignes.push({ outil: o.nom, numero: o.numero || "", le: j, motif: m.motif || "", valeur: Number(m.valeur || 0), user: m.user || "" });
    });
  });
  return lignes.sort((a, b) => String(b.le).localeCompare(String(a.le)));
};
export const valeurPerdue = (boutique, periode) => pertesDe(boutique, periode).reduce((s, l) => s + l.valeur, 0);

// ---- L'APPEL DE L'OUTILLAGE, CHAQUE SEMAINE (décision Timo : « chaque
// semaine »). On coche ce qu'on a sous la main ; ce qui n'est pas coché
// reste dehors et se voit. Rien n'est effacé : un appel est une PHOTO.
// La semaine est nommée par son LUNDI — deux personnes qui font l'appel le
// même mardi et le même jeudi parlent de la même semaine.
export const lundiDe = (jour) => {
  const t = Date.parse(`${String(jour).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(t)) return String(jour).slice(0, 10);
  const d = new Date(t);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
export const appelDeLaSemaine = (boutique, jour) => {
  const semaine = lundiDe(jour);
  return appelsDe(boutique).find((a) => a.semaine === semaine) || null;
};
// ⚠ L'APPEL SE FAIT PAR LIEU (décision Timo, 18/09/2026) : personne ne peut
// voir les outils de deux boutiques à la fois. Chaque boutique et le magasin
// font LEUR appel ; il est rangé dans la fiche de CE lieu.
// `outils` = les outils VIVANTS rangés là, pris dans le registre unifié.
export const appelAFaire = (boutiqueDuLieu, outils, jour) =>
  (outils || []).length > 0 && !appelDeLaSemaine(boutiqueDuLieu, jour);
export const construireAppel = ({ id, jour, presents, par_id, par, lieu, outils }) => {
  const vus = new Set((presents || []).map(String));
  const tous = outils || [];
  return {
    id, semaine: lundiDe(jour), le: String(jour).slice(0, 10), par_id, par: par || "",
    lieu: String(lieu || ""),
    presents: tous.filter((o) => vus.has(String(o.id))).map((o) => o.id),
    absents: tous.filter((o) => !vus.has(String(o.id))).map((o) => o.id),
  };
};
// Ce que le dernier appel de CE lieu a laissé de côté, en clair — les outils
// se cherchent dans tout le registre, pas seulement dans la fiche du lieu.
export const manquantsDuDernierAppel = (boutiqueDuLieu, registre) => {
  const liste = appelsDe(boutiqueDuLieu);
  const dernier = liste.length ? liste[liste.length - 1] : null;
  if (!dernier) return [];
  const ids = new Set((dernier.absents || []).map(String));
  return outilsDe(registre || boutiqueDuLieu).filter((o) => ids.has(String(o.id)));
};
// Les lieux dont l'appel de la semaine manque encore.
export const lieuxSansAppel = (boutiques, registre, jour) =>
  lieuxDuRegistre(boutiques).filter((b) => appelAFaire(b, outilsDuLieu(registre, b.nom).filter((o) => !["perdu", "reforme"].includes(etatOutil(o))), jour));

// ---- Le tableau du haut de l'écran.
export const resumeOutillage = (boutique, aujourdhui) => {
  const tous = outilsDe(boutique);
  const vivants = outilsVivants(boutique);
  const dehors = outilsDehors(boutique);
  return {
    total: vivants.length,
    dehors: dehors.length,
    retard: dehors.filter((o) => enRetard(o, aujourdhui)).length,
    reparation: tous.filter((o) => etatOutil(o) === "reparation").length,
    perdus: tous.filter((o) => etatOutil(o) === "perdu").length,
    reformes: tous.filter((o) => etatOutil(o) === "reforme").length,
    valeurPerdue: valeurPerdue(boutique, null),
  };
};

// ---- Le champ « Outil » : LE champ commun à suggestions (comme 🛠 Travaux).
// Un CLIC lie l'outil ; un nom TAPÉ ne le lie que s'il est EXACT (nom ou
// numéro gravé), jamais par ressemblance. Timo, 17/09/2026 : le numéro est
// GRAVÉ sur l'outil, il se tape — « BMI-012 », ou même « 12 ».
const sansAccentsO = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const propositionsOutils = (boutique) => outilsVivants(boutique).map((o) => ({
  cle: o.id, outil_id: o.id, valeur: o.nom,
  detail: `${o.numero ? `N° ${o.numero} · ` : ""}${libelleEtat(etatOutil(o))}${detenteurOutil(o) ? ` — chez ${detenteurOutil(o).nom}` : ""}`,
}));
export const outilSaisi = (boutique, saisie) => {
  const q = sansAccentsO(saisie);
  if (!q) return null;
  const liste = outilsVivants(boutique);
  return liste.find((o) => sansAccentsO(o.nom) === q)
    || liste.find((o) => o.numero && sansAccentsO(o.numero) === q) || null;
};

// ---- Créer un outil (administrateur). Le numéro est CELUI GRAVÉ sur
// l'outil ; deux outils ne peuvent pas porter le même dans une boutique.
export const critiqueNouvelOutil = (boutique, { nom, numero } = {}) => {
  if (!String(nom || "").trim()) return "Donnez un nom à l'outil.";
  const n = sansAccentsO(numero);
  if (n && outilsDe(boutique).some((o) => sansAccentsO(o.numero) === n)) {
    return `Le numéro « ${String(numero).trim()} » est déjà porté par un autre outil de BMI.`;
  }
  return "";
};
export const nouvelOutil = ({ id, nom, numero, categorie, achete_le, prix_achat, lieu, boite, le, par_id, par }) => ({
  id, nom: String(nom || "").trim(), numero: String(numero || "").trim(),
  categorie: String(categorie || "").trim(), achete_le: achete_le || "",
  prix_achat: Number(prix_achat || 0),
  // 🧰 Caisse ou boîte à outils ? Ça se DIT à la création (Timo, 18/09/2026 :
  // « c'est peu logique d'avoir cette caisse sur une perceuse »). Non coché,
  // la fiche n'en parle jamais.
  boite: !!boite,
  // Où il est rangé au départ : une boutique ou un magasin, jamais « nulle part ».
  lieu: String(lieu || ""),
  cree_le: le, cree_par: par || "", cree_par_id: par_id || "",
  mouvements: [],
});

// ---- Écrire le registre d'une boutique sans toucher au reste de sa fiche.
export const poserRegistre = (boutique, { outils, appels, supprimes }) => ({
  ...boutique,
  outillage: {
    ...(boutique && typeof boutique.outillage === "object" && boutique.outillage ? boutique.outillage : {}),
    outils: outils !== undefined ? outils : outilsDe(boutique),
    appels: appels !== undefined ? appels : appelsDe(boutique),
    ...(supprimes !== undefined ? { supprimes } : {}),
  },
});
// ⚠ `sansMarques` ici, et NULLE PART ailleurs : les deux champs que le
// registre unifié pose sur un outil (`_fiche`, `_lieu_defaut`) ne doivent
// jamais partir dans la base. Un seul endroit à ne pas oublier.
export const remplacerOutil = (boutique, outil) =>
  poserRegistre(boutique, { outils: outilsDe(boutique).map((o) => (o.id === outil.id ? sansMarques(outil) : o)) });
export const ajouterOutil = (boutique, outil) =>
  poserRegistre(boutique, { outils: [...outilsDe(boutique), sansMarques(outil)] });
export const ajouterAppel = (boutique, appel) =>
  poserRegistre(boutique, { appels: [...appelsDe(boutique), appel] });

// ---- L'HISTOIRE D'UN OUTIL, en clair (Timo, 18/09/2026 : « à qui on rend
// l'outil n'est pas mentionné »). La personne qui REÇOIT le retour était
// bien enregistrée (`par`), mais elle ne s'affichait nulle part : un registre
// dont la trace ne se lit pas ne sert à rien. Chaque mouvement se lit en une
// ligne — le quoi, le qui, et le détail —, du plus récent au plus ancien.
export const histoireOutil = (outil) => mouvementsDe(outil).map((m) => {
  const par = m.par || "—";
  if (m.type === "sortie") return {
    id: m.id, le: m.le, quoi: "📤 Sortie", role: "pris par", qui: m.user || "—",
    detail: [`remis par ${par}`, m.chantier ? `pour ${m.chantier}` : "", m.retour_prevu ? `retour prévu le ${m.retour_prevu}` : ""].filter(Boolean).join(" · "),
  };
  // ⚠ C'est ICI qu'était le trou : au retour, celui qui enregistre le geste
  // est celui qui REÇOIT l'outil. C'est la question de Timo.
  if (m.type === "retour") return {
    id: m.id, le: m.le, quoi: "📥 Retour", role: "rendu à", qui: par,
    detail: [m.etat === "abime" ? "ABÎMÉ" : "bon état", m.note || ""].filter(Boolean).join(" — "),
  };
  if (m.type === "reparation") return {
    id: m.id, le: m.le, quoi: "🔧 Réparation", role: "chez", qui: m.reparateur || par,
    detail: [m.tel ? `☎ ${m.tel}` : "", m.panne || "", m.prix ? `${m.prix} F` : "", `envoyé par ${par}`, m.note || ""].filter(Boolean).join(" — "),
  };
  if (m.type === "perdu") return {
    id: m.id, le: m.le, quoi: "⚠ Perdu", role: "sous la responsabilité de", qui: m.user || "personne (il était rangé)",
    detail: [m.motif || "", m.valeur ? `valeur ${m.valeur}` : "", `déclaré par ${par}`].filter(Boolean).join(" — "),
  };
  if (m.type === "reforme") return { id: m.id, le: m.le, quoi: "🗑 Réformé", role: "décidé par", qui: par, detail: m.motif || "" };
  if (m.type === "chantier") return { id: m.id, le: m.le, quoi: "🏗 Chantier", role: "part sur", qui: m.chantier || "—", detail: `changé par ${par}` };
  if (m.type === "comptage") {
    const manques = manquesDuComptage(outil, m);
    return {
      id: m.id, le: m.le, quoi: "🧰 Comptage", role: "compté par", qui: par,
      detail: manques.length
        ? `il manquait ${manques.map((x) => `${x.manque} ${x.nom}`).join(", ")}`
        : "tout y était",
    };
  }
  return { id: m.id, le: m.le, quoi: String(m.type || ""), role: "par", qui: par, detail: "" };
}).reverse();

// À QUI l'outil a été rendu la dernière fois — vide s'il n'est jamais rentré.
export const dernierRetour = (outil) => {
  const m = mouvementsDe(outil).filter((x) => x.type === "retour");
  return m.length ? m[m.length - 1] : null;
};

// ============================================================
// LES QUATRE VUES (Timo, 18/09/2026, capture des carrés) : « lorsqu'on
// clique dessus » — Outils, Dehors, En retard, En réparation. Chaque carré
// ouvre SA liste, avec les colonnes qui répondent à SA question.
// ============================================================
export const VUES_OUTILLAGE = ["tous", "dehors", "retard", "reparation", "perdus"];
export const outilsDeLaVue = (boutique, vue, jour) => {
  if (vue === "dehors") return outilsDehors(boutique);
  if (vue === "retard") return outilsDehors(boutique).filter((o) => enRetard(o, jour));
  if (vue === "reparation") return outilsDe(boutique).filter((o) => etatOutil(o) === "reparation");
  // ⚠ UN SEUL carré pour les deux (Timo, 18/09/2026) : perdus PUIS réformés.
  if (vue === "perdus") return outilsHorsService(boutique);
  return outilsDe(boutique);
};

// ---- 🔧 LA RÉPARATION : chez QUI, son NUMÉRO, la PANNE, le PRIX.
// ⚠ Le prix EST une dépense de BMI depuis le 18/09/2026 (« oui, mets le prix
// de réparation dans les dépenses ») : il passe par la fabrique commune
// `construireDepenseSaisie`, jamais par une écriture d'ici. Voir plus bas
// `marquerDepenseReparation`, qui porte le lien outil ↔ dépense.
export const critiqueReparation = ({ reparateur, panne } = {}) => {
  if (!String(reparateur || "").trim()) return "Dites chez quel réparateur part l'outil.";
  if (!String(panne || "").trim()) return "Dites quelle est la panne.";
  return "";
};
export const reparationEnCours = (outil) => (etatOutil(outil) === "reparation" ? dernierMouvementEtat(outil) : null);
export const coutReparations = (boutique, periode) => {
  const du = periode && periode.du ? String(periode.du) : "";
  const au = periode && periode.au ? String(periode.au) : "";
  return outilsDe(boutique).reduce((s, o) => s + mouvementsDe(o)
    .filter((m) => m.type === "reparation" && (!du || String(m.le) >= du) && (!au || String(m.le) <= au))
    .reduce((t, m) => t + Number(m.prix || 0), 0), 0);
};

// ---- ⏱ LE RETARD SE JUSTIFIE, PAR CELUI QUI DÉTIENT L'OUTIL
// Timo (18/09/2026) : « celui qui a un outil et est en retard de retour doit
// justifier pourquoi l'outil n'est pas encore de retour, dans son interface ».
// La justification se RATTACHE à la sortie en cours : un nouveau retard
// (une autre sortie) en redemande une. Rien ne s'efface, on empile.
export const justificationsDe = (outil) => Array.isArray(outil?.justifications) ? outil.justifications : [];
export const justificationsDeLaSortie = (outil) => {
  const s = sortieEnCours(outil);
  if (!s) return [];
  return justificationsDe(outil).filter((j) => j.sortie_id === s.id);
};
export const derniereJustification = (outil) => {
  const l = justificationsDeLaSortie(outil);
  return l.length ? l[l.length - 1] : null;
};
// Ce qu'on doit à son chef : un outil qu'on détient, en retard, et dont la
// dernière justification est plus ancienne que le dernier jour de retard.
export const doitJustifier = (outil, userId, jour) => {
  const s = sortieEnCours(outil);
  if (!s || String(s.user_id || "") !== String(userId || "")) return false;
  if (!enRetard(outil, jour)) return false;
  const d = derniereJustification(outil);
  return !d;
};
export const critiqueJustification = (outil, { texte } = {}) => {
  if (!outil) return "Choisissez d'abord un outil.";
  if (!sortieEnCours(outil)) return "Cet outil n'est pas sorti : il n'y a pas de retard à justifier.";
  if (!String(texte || "").trim()) return "Dites pourquoi l'outil n'est pas encore rentré.";
  return "";
};
export const justifierRetard = (outil, { id, le, texte, par_id, par }) => {
  const s = sortieEnCours(outil);
  return { ...outil, justifications: [...justificationsDe(outil), {
    id, le, texte: String(texte || "").trim(), par_id, par: par || "",
    sortie_id: s ? s.id : "", retour_prevu: s ? s.retour_prevu : "",
  }] };
};

// ---- 🏗 LE CHANTIER D'UN OUTIL SE CHANGE SANS LE RAMENER (Timo,
// 18/09/2026 : « aujourd'hui il finit le chantier A, il n'a pas besoin de
// ramener l'outil avant d'aller sur le chantier B… il peut juste changer le
// chantier DANS SON ESPACE »). Le changement est un mouvement de plus — la
// trace ne rétrécit jamais — mais il ne touche NI l'état, NI le détenteur,
// NI la date de retour.
//
// ⚠ « Mais dès que le chantier est déclaré terminé, plus possible d'assigner
// un chantier à un outil SAUF pour les chantiers saisie libre » : la liste
// ne propose que les chantiers OUVERTS ; un nom tapé à la main reste
// toujours possible, c'est la porte de sortie.
export const chantierEnCours = (outil) => {
  const s = sortieEnCours(outil);
  if (!s) return "";
  // Le dernier changement POSTÉRIEUR à la sortie en cours, sinon la sortie.
  const mvts = mouvementsDe(outil);
  const rang = mvts.findIndex((m) => m && m.id === s.id);
  const apres = mvts.slice(rang + 1).filter((m) => m && m.type === "chantier");
  return String((apres.length ? apres[apres.length - 1] : s).chantier || "");
};
// Peut-on changer le chantier de cet outil, et QUI ? Le détenteur depuis son
// espace, et celui qui tient le registre.
export const peutChangerChantier = (outil, profile) => {
  const s = sortieEnCours(outil);
  if (!s) return false;
  if (peutTenirOutillage(profile)) return true;
  return String(s.user_id || "") === String(profile?.id || "");
};
export const critiqueChangementChantier = (outil, { chantier, ouverts, libre } = {}) => {
  if (!outil) return "Choisissez d'abord un outil.";
  if (!sortieEnCours(outil)) return `« ${outil.nom} » n'est pas sorti : il n'y a pas de chantier à changer.`;
  const nom = String(chantier || "").trim();
  if (!nom) return "Dites sur quel chantier l'outil part maintenant.";
  if (nom === chantierEnCours(outil)) return "C'est déjà le chantier de cet outil.";
  // Un nom TAPÉ passe toujours ; un chantier CHOISI doit être encore ouvert.
  if (!libre && Array.isArray(ouverts) && !ouverts.some((c) => String(c.nom || c) === nom)) {
    return `« ${nom} » est terminé : on n'y affecte plus d'outil. Tapez un nom libre si le travail continue.`;
  }
  return "";
};
export const changerChantier = (outil, { id, le, chantier, par_id, par }) =>
  ajouter(outil, { id, type: "chantier", le, chantier: String(chantier || "").trim(), par_id, par });
// Les changements de chantier de la sortie en cours, pour les lire en clair.
export const chantiersDeLaSortie = (outil) => {
  const s = sortieEnCours(outil);
  if (!s) return [];
  const mvts = mouvementsDe(outil);
  const rang = mvts.findIndex((m) => m && m.id === s.id);
  return mvts.slice(rang + 1).filter((m) => m && m.type === "chantier");
};

// ---- CE QUE JE DÉTIENS, dans TOUTES les boutiques de mon espace : un
// technicien n'a pas de boutique, et son outil peut venir de n'importe
// laquelle. Rend [{ boutique, outil }].
export const mesOutils = (boutiques, userId) => {
  const liste = [];
  (boutiques || []).forEach((b) => outilsDehors(b).forEach((o) => {
    const d = detenteurOutil(o);
    if (d && String(d.id) === String(userId || "")) liste.push({ boutique: b, outil: o });
  }));
  return liste;
};

// Depuis combien de jours l'outil aurait dû être rentré.
export const joursDeRetard = (outil, aujourdhui) => {
  const s = sortieEnCours(outil);
  if (!s || !s.retour_prevu) return 0;
  const a = Date.parse(`${String(s.retour_prevu).slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${String(aujourdhui).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
};

// ---- 💸 LA RÉPARATION PASSE DANS LES DÉPENSES (Timo, 18/09/2026 : « oui,
// mets le prix de réparation dans les dépenses »). ⚠ Elle passe par LA
// fabrique des dépenses (`construireDepenseSaisie`) : validation du DG au-delà
// du seuil, origine des fonds, blocage de clôture — rien de particulier.
// Ici, seulement le LIEN entre l'outil et sa dépense, et la garantie qu'on ne
// la crée JAMAIS deux fois.
export const marquerDepenseReparation = (outil, mouvementId, depenseId) => ({
  ...outil,
  mouvements: mouvementsDe(outil).map((m) => (m.id === mouvementId ? { ...m, depense_id: depenseId } : m)),
});
// La réparation en cours a-t-elle déjà sa dépense ? (vide = pas encore)
export const depenseDeLaReparation = (outil) => {
  const r = reparationEnCours(outil);
  return r && r.depense_id ? r.depense_id : "";
};
export const libelleDepenseReparation = (outil, rep) =>
  `${outil?.nom || "Outil"}${outil?.numero ? ` (N° ${outil.numero})` : ""} — ${rep?.panne || "réparation"}${rep?.reparateur ? ` · ${rep.reparateur}` : ""}`;

// ---- ⚠ L'ARDOISE D'UNE PERTE (Timo, 18/09/2026 : « pour les salariés,
// c'est une retenue sur le salaire ; pour les techniciens commission, c'est
// retenu sur commission… dans perdu quand on clique, la liste de tous les
// équipements perdus apparaît et qui l'a perdu, combien a déjà été retenu sur
// son salaire ou commission, combien il reste à payer »).
//
// DEUX CHEMINS, parce qu'il y a DEUX façons d'être payé chez BMI :
//   • SALARIÉ    → une AVANCE du mois, que `paieMois` soustrait du net.
//   • COMMISSION → sa PROCHAINE part d'installation est diminuée d'autant
//                  (c'est son seul revenu : il n'a pas de salaire à amputer).
// Dans les deux cas la retenue est ÉCRITE SUR LA PERTE : c'est elle qui sait
// combien a été pris et combien reste à payer. Sans cette écriture, l'argent
// partait bien mais RIEN ne pouvait s'afficher.
// ⚠ Une retenue ne s'efface jamais (liste qui ne rétrécit pas), comme un
// mouvement d'outil ou une reprise de vente.
export const ROLES_RETENUE_COMMISSION = ["technicien", "commercial"];
export const modeRetenue = (user) =>
  ROLES_RETENUE_COMMISSION.includes(String(user?.role || "")) ? "commission" : "salaire";
export const LIBELLE_RETENUE = { salaire: "sur le salaire", commission: "sur la commission" };
export const libelleRetenue = (mode) => LIBELLE_RETENUE[mode] || LIBELLE_RETENUE.salaire;

// La perte d'un outil = son dernier mouvement « perdu ».
export const perteDe = (outil) => {
  const l = mouvementsDe(outil).filter((m) => m.type === "perdu");
  return l.length ? l[l.length - 1] : null;
};
export const aRembourser = (perte) => Math.max(0, Number(perte?.a_rembourser || 0));
export const retenuesDe = (perte) => (Array.isArray(perte?.retenues) ? perte.retenues : []);
export const dejaRetenu = (perte) => retenuesDe(perte).reduce((s, r) => s + Number(r.montant || 0), 0);
export const resteARetenir = (perte) => Math.max(0, aRembourser(perte) - dejaRetenu(perte));

// Ce qu'on demande à la personne : proposé = la valeur de l'outil, mais
// l'administrateur peut décider moins (ou rien : la perte reste à BMI).
export const critiqueARembourser = (perte, montant) => {
  if (!perte) return "Cet outil n'est pas déclaré perdu.";
  const m = Number(montant || 0);
  if (m < 0) return "Un montant à rembourser ne peut pas être négatif.";
  if (m < dejaRetenu(perte)) return `Déjà retenu : ${dejaRetenu(perte)} F. On ne peut pas demander moins que ce qui a déjà été pris.`;
  return "";
};
export const fixerARembourser = (outil, perteId, montant) => ({
  ...outil,
  mouvements: mouvementsDe(outil).map((m) => (m.id === perteId ? { ...m, a_rembourser: Math.max(0, Number(montant || 0)) } : m)),
});

export const critiqueRetenue = (perte, montant) => {
  if (!perte) return "Cet outil n'est pas déclaré perdu.";
  const m = Number(montant || 0);
  if (!(m > 0)) return "Le montant à retenir doit être supérieur à zéro.";
  const reste = resteARetenir(perte);
  if (reste <= 0) return "Cette perte est entièrement remboursée : il n'y a plus rien à retenir.";
  if (m > reste) return `On ne retient pas plus qu'il ne reste dû (${reste} F).`;
  return "";
};
export const ajouterRetenue = (outil, perteId, { id, le, montant, sur, mois, ref, par }) => ({
  ...outil,
  mouvements: mouvementsDe(outil).map((m) => (m.id === perteId
    ? {
      ...m,
      retenues: [...(Array.isArray(m.retenues) ? m.retenues : []), {
        id, le, montant: Math.max(0, Number(montant || 0)),
        sur: sur === "commission" ? "commission" : "salaire",
        mois: mois || "", ref: ref || "", par: par || "",
      }],
    }
    : m)),
});

// Une ligne d'ardoise, telle qu'elle se lit dans le carré « Perdus ».
const ligneArdoise = (boutique, outil) => {
  const p = perteDe(outil);
  return {
    boutique_id: boutique?.id || "", boutique: boutique?.nom || "",
    outil, perte: p, perte_id: p?.id || "",
    nom: outil?.nom || "", numero: outil?.numero || "",
    le: String(p?.le || "").slice(0, 10), motif: p?.motif || "",
    valeur: Number(p?.valeur || 0), user_id: p?.user_id || "", user: p?.user || "",
    a_rembourser: aRembourser(p), deja: dejaRetenu(p), reste: resteARetenir(p),
    retenues: retenuesDe(p),
  };
};
// Les mêmes ardoises, pour UNE personne, dans TOUTES les boutiques de son
// espace (un technicien n'a pas de boutique) : les plus anciennes d'abord,
// c'est celles-là qu'on solde en premier.
export const ardoisesDeLaPersonne = (boutiques, userId) => {
  const liste = [];
  (boutiques || []).forEach((b) => outilsDe(b).forEach((o) => {
    if (etatOutil(o) !== "perdu") return;
    const l = ligneArdoise(b, o);
    if (String(l.user_id || "") === String(userId || "")) liste.push(l);
  }));
  return liste.sort((a, b) => String(a.le).localeCompare(String(b.le)));
};

// ---- LA RETENUE SUR COMMISSION : ce qu'on prend sur un paiement.
// On ne prend JAMAIS plus que ce qui est payé (une part d'installation ne
// devient pas une dette), ni plus qu'il ne reste dû ; les pertes les plus
// anciennes se soldent en premier.
export const retenueSurPaiement = (boutiques, userId, montantPaye) => {
  let reste = Math.max(0, Number(montantPaye || 0));
  const lignes = [];
  ardoisesDeLaPersonne(boutiques, userId).forEach((a) => {
    if (reste <= 0 || a.reste <= 0) return;
    const pris = Math.min(reste, a.reste);
    lignes.push({ boutique_id: a.boutique_id, outil_id: a.outil.id, outil: a.nom, perte_id: a.perte_id, montant: pris });
    reste -= pris;
  });
  return { montant: lignes.reduce((s, l) => s + l.montant, 0), lignes };
};
// Écrit ces retenues dans les boutiques concernées. Rend un NOUVEAU tableau
// de boutiques ; celles que rien ne touche sont rendues telles quelles.
export const appliquerRetenues = (boutiques, lignes, { id, le, sur, ref, par }) => {
  if (!lignes || !lignes.length) return boutiques || [];
  return (boutiques || []).map((b) => {
    const miennes = lignes.filter((l) => String(l.boutique_id) === String(b?.id));
    if (!miennes.length) return b;
    const reg = registreDe(b);
    let outils = reg.outils;
    miennes.forEach((l, i) => {
      outils = outils.map((o) => (o.id === l.outil_id
        ? ajouterRetenue(o, l.perte_id, { id: `${id}-${i}`, le, montant: l.montant, sur, ref, par })
        : o));
    });
    return { ...b, outillage: { ...reg, outils } };
  });
};


// ============================================================
// 🧰 LES BOÎTES À OUTILS — SUIVRE LE MATÉRIEL QUI S'Y TROUVE
// (Timo, 18/09/2026 : « les boîtes à outils… comment suivre le matériel qui
// s'y trouve ».)
//
// Une boîte ne rentre pas dans le registre comme une perceuse : personne
// n'enregistrera quinze sorties chaque matin, et on ne grave pas un numéro
// sur une pince à 2 000 F. Donc : **LA BOÎTE EST UN OUTIL, et elle porte SA
// LISTE.** Elle sort et elle rentre en UN geste, comme aujourd'hui ; c'est
// AU RETOUR qu'on compte, une fois et pas deux (elle a été comptée la fois
// d'avant, on sait donc ce qu'elle contient en partant).
//
// Les DEUX décisions de Timo :
//   1a — le comptage au retour est OBLIGATOIRE : rien ne rentre sans être
//        compté (`critiqueRetour`, revérifié DANS le geste) ;
//   2b — il peut être fait AUSSI par CELUI QUI REND, « pour qu'il valide ce
//        qu'il ramène » (`peutCompterBoite`). Le RETOUR lui-même reste le
//        geste de celui qui tient le registre : un technicien ne
//        s'enregistre pas lui-même, sinon la trace ne vaut rien.
//
// ⚠ Ce que ça ne fait PAS, et Timo le sait : le petit matériel n'a pas
// d'histoire individuelle. On saura « il manque 2 tournevis plats depuis le
// chantier de MR ERIC », jamais « c'est LE tournevis n° 7 ».
// ============================================================

// ⚠ UNE BOÎTE SE DÉCLARE À LA CRÉATION (Timo, 18/09/2026 : « c'est peu
// logique d'avoir cette caisse sur une perceuse… lors de la création d'un
// outil, ajouter une case à cocher si caisse ou boîte à outils. En ce
// moment-là caisse apparaît sur la fiche pour renseigner ce qu'elle
// contient. Si pas coché, pas de caisse dans la fiche »). La première
// version en faisait une boîte dès qu'on lui posait une liste : le bouton 🧰
// s'affichait donc sur TOUS les outils, perceuse comprise. RETOURNÉ.
// Le `|| contenuDe(...)` est un filet pour les boîtes nées avant la case :
// un outil qui porte déjà une liste reste une boîte.
export const contenuDe = (outil) => (Array.isArray(outil?.contenu) ? outil.contenu : []);
export const estBoite = (outil) => !!outil?.boite || contenuDe(outil).length > 0;
export const nbContenu = (outil) => contenuDe(outil).reduce((s, l) => s + Math.max(0, Number(l.quantite || 0)), 0);

export const critiqueLigneContenu = (outil, { nom, quantite } = {}) => {
  if (!String(nom || "").trim()) return "Donnez un nom à ce matériel.";
  if (!(Number(quantite) >= 1)) return "Dites combien il y en a (au moins 1).";
  const n = sansAccentsO(nom);
  if (contenuDe(outil).some((l) => sansAccentsO(l.nom) === n)) {
    return `« ${String(nom).trim()} » est déjà dans la liste : corrigez sa quantité plutôt que d'ajouter une deuxième ligne.`;
  }
  return "";
};
export const ajouterLigneContenu = (outil, { id, nom, quantite, valeur }) => ({
  ...outil,
  contenu: [...contenuDe(outil), {
    id, nom: String(nom || "").trim(),
    quantite: Math.max(1, Number(quantite || 1)),
    valeur: Math.max(0, Number(valeur || 0)),
  }],
});
export const changerLigneContenu = (outil, ligneId, champs) => ({
  ...outil,
  contenu: contenuDe(outil).map((l) => (l.id === ligneId
    ? { ...l, ...champs, quantite: Math.max(1, Number((champs && champs.quantite) ?? l.quantite ?? 1)), valeur: Math.max(0, Number((champs && champs.valeur) ?? l.valeur ?? 0)) }
    : l)),
});
export const retirerLigneContenu = (outil, ligneId) => ({ ...outil, contenu: contenuDe(outil).filter((l) => l.id !== ligneId) });

// ---- LE COMPTAGE. C'est un mouvement — la trace ne rétrécit jamais —, mais
// il est TRANSPARENT : il ne figure pas dans `TYPES_ETAT`, donc compter une
// boîte ne fait pas croire qu'elle est rentrée (même piège que le changement
// de chantier, réglé le 18/09/2026).
export const dernierComptage = (outil) => {
  const l = mouvementsDe(outil).filter((m) => m.type === "comptage");
  return l.length ? l[l.length - 1] : null;
};
// Le comptage QUI COMPTE : celui posé APRÈS la sortie en cours. Une nouvelle
// sortie en redemande un, comme une justification de retard.
export const comptageDeLaSortie = (outil) => {
  const s = sortieEnCours(outil);
  const liste = mouvementsDe(outil);
  if (!s) return dernierComptage(outil);
  const i = liste.findIndex((m) => m.id === s.id);
  const apres = liste.slice(i + 1).filter((m) => m.type === "comptage");
  return apres.length ? apres[apres.length - 1] : null;
};
export const critiqueComptage = (outil, compte) => {
  if (!outil) return "Choisissez d'abord une boîte.";
  if (!estBoite(outil)) return `« ${outil.nom} » ne porte aucune liste de matériel : il n'y a rien à compter.`;
  const c = compte && typeof compte === "object" ? compte : null;
  if (!c) return "Comptez ce qu'il y a dans la boîte : rien ne rentre sans être compté.";
  const oubli = contenuDe(outil).find((l) => {
    const v = c[l.id];
    return v === undefined || v === null || String(v).trim() === "" || !(Number(v) >= 0);
  });
  if (oubli) return `Dites combien il y a de « ${oubli.nom} » — même si la réponse est 0.`;
  return "";
};
export const compterBoite = (outil, { id, le, compte, par_id, par }) => {
  const c = compte || {};
  const propre = {};
  contenuDe(outil).forEach((l) => { propre[l.id] = Math.max(0, Number(c[l.id] || 0)); });
  return ajouter(outil, { id, type: "comptage", le, compte: propre, par_id, par });
};
// Ce qui manque, ligne par ligne. Rien de stocké : on relit le comptage.
export const manquesDuComptage = (outil, comptage) => {
  const c = (comptage && comptage.compte) || null;
  if (!c) return [];
  return contenuDe(outil).map((l) => {
    const attendu = Math.max(0, Number(l.quantite || 0));
    const trouve = Math.max(0, Number(c[l.id] || 0));
    return { id: l.id, nom: l.nom, attendu, compte: trouve, manque: Math.max(0, attendu - trouve), valeur: Math.max(0, Number(l.valeur || 0)) };
  }).filter((x) => x.manque > 0);
};
// Ce qui manque AUJOURD'HUI dans la boîte : c'est ce qui la fera repartir
// incomplète, et l'écran le DIT au moment de la sortie.
export const manquesEnCours = (outil) => (estBoite(outil) ? manquesDuComptage(outil, dernierComptage(outil)) : []);

// DÉCISION 2b : celui qui tient le registre, ET celui qui détient la boîte.
export const peutCompterBoite = (outil, profile) => {
  if (!estBoite(outil)) return false;
  if (peutTenirOutillage(profile)) return true;
  const s = sortieEnCours(outil);
  return !!s && String(s.user_id || "") === String(profile?.id || "");
};

// ---- UN MANQUE DEVIENT UNE PERTE, par le mécanisme qui existe DÉJÀ.
// On ne réinvente ni l'ardoise, ni la retenue sur salaire, ni celle sur
// commission : le matériel manquant devient SA PROPRE fiche, née déjà
// déclarée perdue, sous le nom de qui détenait la boîte. Elle n'entre ni
// dans le matériel vivant, ni dans l'appel de la semaine, ni dans les
// propositions de sortie — `outilsVivants` écarte tout ce qui est perdu.
export const valeurDuManque = (m) => Math.max(0, Number(m?.valeur || 0)) * Math.max(1, Number(m?.manque || 1));

// QUI répondait de la boîte au moment du comptage. ⚠ On ne peut pas le
// demander à `detenteurOutil` : le comptage se fait AU RETOUR, la boîte est
// déjà rentrée et elle n'est plus chez personne. Il faut remonter à la
// sortie qui précède le comptage — et si la boîte était rangée, personne
// n'en répondait, exactement comme un outil perdu en boutique.
export const responsableDuComptage = (outil) => {
  const c = dernierComptage(outil);
  if (!c) return null;
  const liste = mouvementsDe(outil);
  const i = liste.findIndex((m) => m.id === c.id);
  for (let k = i - 1; k >= 0; k -= 1) {
    if (liste[k].type === "sortie") return liste[k].user_id ? { id: liste[k].user_id, nom: liste[k].user || "" } : null;
    if (liste[k].type === "retour") return null;
  }
  return null;
};

// Ce qui manque ET n'a pas ENCORE été déclaré perdu : une perte ne se
// déclare pas deux fois. La fiche née d'un manque porte sa boîte, sa ligne
// et le comptage qui l'a révélé — c'est ce trio qui empêche le doublon.
export const manquesADeclarer = (registre, boite) => {
  const c = dernierComptage(boite);
  if (!c) return [];
  const deja = outilsDe(registre)
    .filter((o) => String(o.boite_id || "") === String(boite.id) && String(o.comptage_id || "") === String(c.id))
    .map((o) => String(o.ligne_id || ""));
  return manquesDuComptage(boite, c).filter((m) => !deja.includes(String(m.id)));
};
export const perteDuContenu = (boite, manque, { id, mouvement_id, comptage_id, le, motif, valeur, a_rembourser, user_id, user, lieu, par_id, par }) => {
  const n = Math.max(1, Number(manque?.manque || 1));
  const fiche = {
    ...nouvelOutil({
      id, nom: `${manque.nom}${n > 1 ? ` ×${n}` : ""} — de ${boite.nom}`,
      categorie: "Contenu de boîte à outils",
      prix_achat: Math.max(0, Number(valeur || 0)),
      lieu: lieu || "", le, par_id, par,
    }),
    boite_id: boite.id, boite_nom: boite.nom, ligne_id: manque.id, comptage_id: comptage_id || "", quantite: n,
  };
  return declarerPerdu(fiche, { id: mouvement_id, le, motif, valeur, a_rembourser, user_id, user, par_id, par });
};


// ============================================================
// 🗑 SUPPRIMER un outil, ✏️ CORRIGER une caisse — SEULEMENT QUAND ELLE EST
// RANGÉE (Timo, 18/09/2026 : « pourquoi l'administrateur principal ne peut
// pas supprimer un outil ou modifier une caisse ? » puis, sur la condition :
// « possible quand l'outil est en magasin ou boutique »).
//
// La condition est la SIENNE, et elle est juste : un outil chez quelqu'un,
// chez un réparateur, perdu ou réformé ne se réécrit pas — on ne change pas
// ce qu'une caisse « doit contenir » pendant qu'elle est sur un chantier,
// sinon le comptage du retour mesure autre chose que ce qui est parti.
// ⚠ Rien à coller : l'administrateur a déjà `a_pouvoir_outillage` des deux
// côtés (application et serveur, securite-22).
// ============================================================
export const outilRange = (outil) => etatOutil(outil) === "en_boutique";
export const critiqueOutilRange = (outil, geste) => {
  if (!outil) return "Choisissez d'abord un outil.";
  const etat = etatOutil(outil);
  if (etat === "en_boutique") return "";
  if (etat === "sorti") {
    const d = detenteurOutil(outil);
    return `« ${outil.nom} » est dehors${d && d.nom ? ` — chez ${d.nom}` : ""} : ${geste} quand il sera rentré.`;
  }
  if (etat === "reparation") return `« ${outil.nom} » est chez un réparateur : ${geste} quand il sera revenu.`;
  return `« ${outil.nom} » est ${libelleEtat(etat).toLowerCase()} : sa fiche ne se touche plus, c'est une trace.`;
};

// ---- LA SUPPRESSION NE JETTE RIEN. L'outil passe dans
// `outillage.supprimes`, une liste qui ne rétrécit jamais — comme les
// reclôtures d'une caisse ou les reprises d'une vente. Le principal peut le
// remettre au registre.
export const supprimesDe = (boutique) => {
  const o = boutique && typeof boutique.outillage === "object" && boutique.outillage ? boutique.outillage : {};
  return Array.isArray(o.supprimes) ? o.supprimes : [];
};
export const critiqueSuppressionOutil = (outil, { motif } = {}) => {
  const r = critiqueOutilRange(outil, "vous pourrez le supprimer");
  if (r) return r;
  if (!String(motif || "").trim()) return "Dites pourquoi : une fiche ne disparaît pas du registre sans raison.";
  return "";
};
export const supprimerOutil = (boutique, outil, { le, motif, par_id, par }) => poserRegistre(boutique, {
  outils: outilsDe(boutique).filter((o) => o.id !== outil.id),
  supprimes: [...supprimesDe(boutique), {
    ...sansMarques(outil),
    supprime_le: le, supprime_motif: String(motif || "").trim(),
    supprime_par: par || "", supprime_par_id: par_id || "",
  }],
});
export const restaurerOutil = (boutique, outilId) => {
  const parti = supprimesDe(boutique).find((o) => o.id === outilId);
  if (!parti) return boutique;
  const propre = { ...sansMarques(parti) };
  delete propre.supprime_le; delete propre.supprime_motif;
  delete propre.supprime_par; delete propre.supprime_par_id;
  return poserRegistre(boutique, {
    outils: [...outilsDe(boutique), propre],
    supprimes: supprimesDe(boutique).filter((o) => o.id !== outilId),
  });
};

// ---- ✏️ MODIFIER UNE CAISSE : la case elle-même, et ses lignes.
// ⚠ Décocher exige une liste VIDE — sinon `estBoite` la rattraperait par son
// filet (un outil qui porte une liste reste une boîte) et la case mentirait.
export const critiqueBasculeBoite = (outil, oui) => {
  const r = critiqueOutilRange(outil, oui ? "vous pourrez en faire une caisse" : "vous pourrez la remettre en simple outil");
  if (r) return r;
  if (!oui && contenuDe(outil).length > 0) {
    return `Videz d'abord la liste de « ${outil.nom} » : tant qu'elle contient du matériel, c'est une caisse.`;
  }
  return "";
};
export const basculerBoite = (outil, oui) => ({ ...outil, boite: !!oui });

// ---- ✏️ CORRIGER LA FICHE ELLE-MÊME (Timo, 18/09/2026 : « sur la fiche elle
// même aussi on doit pouvoir modifier… si numéro gravé est faussé, on ne peut
// pas laisser comme ça »). Même condition : l'outil doit être RANGÉ.
// ⚠ Le numéro reste UNIQUE dans toute la maison — mais l'outil ne se gêne pas
// lui-même : `critiqueNouvelOutil` le refuserait, puisqu'il le trouverait.
// ⚠ Le LIEU n'est PAS corrigible ici : il est DÉDUIT (dernier retour, sinon
// création), et la fiche vit physiquement dans la boutique qui la garde —
// le changer seul ferait mentir `lieuDeRangement`. Un retour le repose.
export const critiqueCorrectionOutil = (registre, outil, { nom, numero } = {}) => {
  const r = critiqueOutilRange(outil, "vous pourrez corriger sa fiche");
  if (r) return r;
  if (!String(nom || "").trim()) return "Donnez un nom à l'outil.";
  const n = sansAccentsO(numero);
  if (n && outilsDe(registre).some((o) => o.id !== outil.id && sansAccentsO(o.numero) === n)) {
    return `Le numéro « ${String(numero).trim()} » est déjà porté par un autre outil de BMI.`;
  }
  return "";
};
export const corrigerOutil = (outil, { nom, numero, categorie, achete_le, prix_achat }) => ({
  ...outil,
  nom: String(nom || "").trim(),
  numero: String(numero || "").trim(),
  categorie: String(categorie || "").trim(),
  achete_le: achete_le || "",
  prix_achat: Math.max(0, Number(prix_achat || 0)),
});
// Ce qui a VRAIMENT changé, pour que le journal le dise en clair.
export const diffFiche = (avant, apres) => ["nom", "numero", "categorie", "achete_le", "prix_achat"]
  .filter((k) => String(avant?.[k] ?? "") !== String(apres?.[k] ?? ""))
  .map((k) => ({ champ: k, avant: avant?.[k] ?? "", apres: apres?.[k] ?? "" }));
