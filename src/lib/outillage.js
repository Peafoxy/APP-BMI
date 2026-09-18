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
  en_boutique: { libelle: "En boutique", teinte: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  sorti:       { libelle: "Sorti",       teinte: "text-sky-800 bg-sky-50 border-sky-200" },
  reparation:  { libelle: "En réparation", teinte: "text-amber-700 bg-amber-50 border-amber-200" },
  perdu:       { libelle: "Perdu",       teinte: "text-red-700 bg-red-50 border-red-200" },
  reforme:     { libelle: "Réformé",     teinte: "text-slate-600 bg-slate-100 border-slate-300" },
};
export const TYPES_MOUVEMENT = ["sortie", "retour", "reparation", "perdu", "reforme"];

export const mouvementsDe = (outil) => Array.isArray(outil?.mouvements) ? outil.mouvements : [];
export const dernierMouvement = (outil) => {
  const m = mouvementsDe(outil);
  return m.length ? m[m.length - 1] : null;
};
export const etatOutil = (outil) => {
  const d = dernierMouvement(outil);
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
  if (etatOutil(outil) !== "sorti") return null;
  const d = dernierMouvement(outil);
  return d && d.user_id ? { id: d.user_id, nom: d.user || "" } : null;
};
export const sortieEnCours = (outil) => (etatOutil(outil) === "sorti" ? dernierMouvement(outil) : null);

// ---- Le registre d'une boutique. `outillage` = { outils, appels }.
export const registreDe = (boutique) => {
  const o = boutique && typeof boutique.outillage === "object" && boutique.outillage ? boutique.outillage : {};
  return { outils: Array.isArray(o.outils) ? o.outils : [], appels: Array.isArray(o.appels) ? o.appels : [] };
};
export const outilsDe = (boutique) => registreDe(boutique).outils;
export const appelsDe = (boutique) => registreDe(boutique).appels;
// Un outil RÉFORMÉ ou PERDU ne se sort plus : il reste au registre pour la
// trace, jamais dans les listes de travail.
export const outilsVivants = (boutique) => outilsDe(boutique).filter((o) => !["perdu", "reforme"].includes(etatOutil(o)));
export const outilsDehors = (boutique) => outilsDe(boutique).filter((o) => etatOutil(o) === "sorti");

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

export const critiqueRetour = (outil) => {
  if (!outil) return "Choisissez d'abord un outil.";
  const etat = etatOutil(outil);
  if (etat === "sorti" || etat === "reparation") return "";
  if (etat === "en_boutique") return `« ${outil.nom} » est déjà en boutique.`;
  return `« ${outil.nom} » est ${libelleEtat(etat).toLowerCase()} : son retour ne se note plus ici.`;
};
export const rendreOutil = (outil, { id, le, etat, note, par_id, par }) =>
  ajouter(outil, { id, type: "retour", le, etat: etat || "bon", note: note || "", par_id, par });

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
export const declarerPerdu = (outil, { id, le, motif, valeur, user_id, user, par_id, par }) =>
  ajouter(outil, { id, type: "perdu", le, motif: String(motif || "").trim(), valeur: Number(valeur || 0), user_id: user_id || "", user: user || "", par_id, par });
export const reformerOutil = (outil, { id, le, motif, par_id, par }) =>
  ajouter(outil, { id, type: "reforme", le, motif: String(motif || "").trim(), par_id, par });

// La RETENUE sur salaire (décision « b ») : elle passe par le mécanisme qui
// existe déjà — une AVANCE du mois, que `paieMois` soustrait du net sans
// toucher à la base CNSS (ce n'est pas une rémunération). Aucun champ neuf.
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
// L'appel est à faire tant que la semaine en cours n'en porte pas — et
// seulement s'il y a un outil à appeler.
export const appelAFaire = (boutique, jour) => outilsVivants(boutique).length > 0 && !appelDeLaSemaine(boutique, jour);
export const construireAppel = ({ id, jour, presents, par_id, par, boutique }) => {
  const vus = new Set((presents || []).map(String));
  const tous = outilsVivants(boutique);
  return {
    id, semaine: lundiDe(jour), le: String(jour).slice(0, 10), par_id, par: par || "",
    presents: tous.filter((o) => vus.has(String(o.id))).map((o) => o.id),
    absents: tous.filter((o) => !vus.has(String(o.id))).map((o) => o.id),
  };
};
// Ce que le dernier appel a laissé de côté, en clair.
export const manquantsDuDernierAppel = (boutique) => {
  const liste = appelsDe(boutique);
  const dernier = liste.length ? liste[liste.length - 1] : null;
  if (!dernier) return [];
  const ids = new Set((dernier.absents || []).map(String));
  return outilsDe(boutique).filter((o) => ids.has(String(o.id)));
};

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
    return `Le numéro « ${String(numero).trim()} » est déjà porté par un autre outil de cette boutique.`;
  }
  return "";
};
export const nouvelOutil = ({ id, nom, numero, categorie, achete_le, prix_achat, le, par_id, par }) => ({
  id, nom: String(nom || "").trim(), numero: String(numero || "").trim(),
  categorie: String(categorie || "").trim(), achete_le: achete_le || "",
  prix_achat: Number(prix_achat || 0), cree_le: le, cree_par: par || "", cree_par_id: par_id || "",
  mouvements: [],
});

// ---- Écrire le registre d'une boutique sans toucher au reste de sa fiche.
export const poserRegistre = (boutique, { outils, appels }) => ({
  ...boutique,
  outillage: {
    ...(boutique && typeof boutique.outillage === "object" && boutique.outillage ? boutique.outillage : {}),
    outils: outils !== undefined ? outils : outilsDe(boutique),
    appels: appels !== undefined ? appels : appelsDe(boutique),
  },
});
export const remplacerOutil = (boutique, outil) =>
  poserRegistre(boutique, { outils: outilsDe(boutique).map((o) => (o.id === outil.id ? outil : o)) });
export const ajouterOutil = (boutique, outil) =>
  poserRegistre(boutique, { outils: [...outilsDe(boutique), outil] });
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
export const VUES_OUTILLAGE = ["tous", "dehors", "retard", "reparation"];
export const outilsDeLaVue = (boutique, vue, jour) => {
  if (vue === "dehors") return outilsDehors(boutique);
  if (vue === "retard") return outilsDehors(boutique).filter((o) => enRetard(o, jour));
  if (vue === "reparation") return outilsDe(boutique).filter((o) => etatOutil(o) === "reparation");
  return outilsDe(boutique);
};

// ---- 🔧 LA RÉPARATION : chez QUI, son NUMÉRO, la PANNE, le PRIX.
// ⚠ Le prix est une INFORMATION portée par l'outil : il n'écrit AUCUNE
// dépense. Créer une charge sans que Timo l'ait demandé toucherait ses
// comptes — on le lui dit, on ne le décide pas.
export const critiqueReparation = ({ reparateur, panne } = {}) => {
  if (!String(reparateur || "").trim()) return "Dites chez quel réparateur part l'outil.";
  if (!String(panne || "").trim()) return "Dites quelle est la panne.";
  return "";
};
export const reparationEnCours = (outil) => (etatOutil(outil) === "reparation" ? dernierMouvement(outil) : null);
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
