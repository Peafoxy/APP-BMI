import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fichierPdf } from "./lib/core";
import { VALIDITE_OFFRE_JOURS } from "./lib/constants";

// Formatage des montants pour le PDF. On N'UTILISE PAS toLocaleString("fr-FR")
// car jsPDF n'affiche pas correctement son espace insécable (il apparaît comme
// « / » ou un caractère parasite). On sépare les milliers par une espace normale.
function fmtMontant(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Génère un véritable fichier .pdf téléchargé directement,
// sans passer par la fenêtre d'impression.
export function genererPDF(d, logo) {
  // Paysage si le tableau a beaucoup de colonnes
  const paysage = d.headers.length >= 9;
  const doc = new jsPDF({ orientation: paysage ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();

  // En-tête : logo + titre
  let xTexte = 14;
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const w = 30;
      const h = (props.height * w) / props.width;
      doc.addImage(logo, "JPEG", 14, 8, w, Math.min(h, 18));
      xTexte = 50;
    } catch {}
  }
  doc.setFontSize(15);
  doc.setTextColor(30, 90, 138);
  doc.text(`Rapport — ${d.nom}`, xTexte, 15);
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `Édité le ${new Date().toLocaleDateString("fr-FR")} · ${d.lignes} ligne(s) · BMI-Gestions Boutiques, Lomé`,
    xTexte, 21
  );

  // Tableau
  autoTable(doc, {
    head: [d.headers],
    body: d.rows.map((r) => r.map((c) => String(c ?? ""))),
    startY: 30,
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 90, 138], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 10, right: 10 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, largeur - 22, hauteur - 6);
    },
  });

  doc.save(d.fichier.replace(/\.csv$/i, "") + ".pdf");
}

// ============ LES BRIQUES COMMUNES DU DEVIS ET DU PROFORMA ============
// Point A9 du relevé des doublons (Timo : « lance tout », 08/09/2026) :
// l'entête (logo, société, NIF, RCCM), le bandeau de titre avec sa mention
// de formation, le bandeau TOTAL, les mentions d'offre de prix et le pied
// de page étaient recopiés dans les deux documents. Un changement d'adresse
// ou de logo fait sur l'un et pas sur l'autre donnait deux papiers
// différents pour la même entreprise. UNE écriture, ici.
const BLEU = [30, 90, 138];
const enteteSociete = (doc, logo, largeur) => {
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const w = 30;
      const h = (props.height * w) / props.width;
      doc.addImage(logo, "JPEG", 14, 10, w, Math.min(h, 18));
    } catch {}
  }
  doc.setFontSize(16);
  doc.setTextColor(...BLEU);
  doc.text("BMI TOGO", largeur - 14, 16, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text("Lomé, Togo", largeur - 14, 21, { align: "right" });
  doc.text("NIF : 1001790098", largeur - 14, 25, { align: "right" });
  doc.text("RCCM : TG-LFW-01-2022-A10-01523", largeur - 14, 29, { align: "right" });
};
// Le bandeau bleu du titre, puis — demande Timo — le bandeau « DOCUMENT DE
// FORMATION » quand le document vient de l'espace d'entraînement. Renvoie
// la hauteur où le contenu peut commencer.
const bandeauTitre = (doc, largeur, titre, formation) => {
  doc.setFillColor(...BLEU);
  doc.rect(14, 32, largeur - 28, 10, "F");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(titre, largeur / 2, 39, { align: "center" });
  if (!formation) return 42;
  doc.setFillColor(180, 83, 9);
  doc.rect(14, 44, largeur - 28, 8, "F");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("DOCUMENT DE FORMATION — SANS VALEUR", largeur / 2, 49.5, { align: "center" });
  return 54;
};
// Bandeau TOTAL : un rectangle plein aligné à droite, texte blanc à
// l'intérieur — le montant ET « FCFA » tiennent toujours, sans coupure.
const bandeauTotal = (doc, largeur, y, total, libelle = "TOTAL") => {
  const bandeauLargeur = 90;
  const bandeauX = largeur - 14 - bandeauLargeur;
  doc.setFillColor(...BLEU);
  doc.roundedRect(bandeauX, y - 6, bandeauLargeur, 11, 1.5, 1.5, "F");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(libelle, bandeauX + 5, y + 1.5);
  doc.text(`${fmtMontant(total)} FCFA`, largeur - 18, y + 1.5, { align: "right" });
  return y + 5;
};
// Les mentions d'une offre de prix (devis ou proforma) : pas un reçu.
// Largeur de la colonne des mentions quand elles sont posées À GAUCHE des
// cadres de signature (devis) : assez étroite pour ne jamais toucher le cadre.
const MENTIONS_LARGEUR = 62;
const MENTIONS_INTERLIGNE = 3.2;
// Les DEUX phrases, écrites une seule fois : le proforma les pose en pleine
// largeur, le devis en colonne étroite à gauche de ses cadres de signature.
const phrasesOffre = (nature) => [
  `Ce document est ${nature} : il constitue une offre de prix et n'a pas de valeur comptable.`,
  "Il ne vaut pas reçu de paiement. Prix indicatifs, susceptibles de variation.",
];
const mentionsOffre = (doc, y, nature, largeurMax) => {
  doc.setTextColor(120, 120, 120);
  const phrases = phrasesOffre(nature);
  if (!largeurMax) {
    doc.setFontSize(8);
    phrases.forEach((t, i) => doc.text(t, 14, y + i * 4));
    return;
  }
  doc.setFontSize(7);
  doc.splitTextToSize(phrases.join(" "), largeurMax)
    .forEach((t, i) => doc.text(t, 14, y + i * MENTIONS_INTERLIGNE));
};
const piedDePage = (doc, largeur, hauteur) => {
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("BMI-Gestions Boutiques", largeur / 2, hauteur - 8, { align: "center" });
};

// ============ PROFORMA ============
// Document commercial remis à un client qui demande un prix. Il porte la mention
// PROFORMA (pas « Reçu ») et n'a AUCUNE valeur comptable : il n'est pas enregistré
// comme une vente, ne déduit pas le stock. C'est une simple offre de prix.
export function genererProforma(p, logo, retournerDoc = false) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();

  enteteSociete(doc, logo, largeur);
  // Bandeau PROFORMA — bien visible, pour qu'on ne le confonde pas avec un reçu
  const yApresPf = bandeauTitre(doc, largeur, "FACTURE PROFORMA", p.formation);

  // Infos client + numéro
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`N° ${p.numero}`, 14, yApresPf + 8);
  doc.text(`Date : ${p.date}`, 14, yApresPf + 13);
  if (p.boutique) doc.text(`Boutique : ${p.boutique}`, 14, yApresPf + 18);
  doc.text(`Client : ${p.client || "—"}`, largeur - 14, yApresPf + 8, { align: "right" });
  if (p.tel) doc.text(`Tél : ${p.tel}`, largeur - 14, yApresPf + 13, { align: "right" });

  // Tableau des articles
  autoTable(doc, {
    head: [["Article", "Qté", "Prix unitaire", "Total"]],
    body: p.lignes.map((l) => [
      String(l.article),
      String(l.qte),
      `${fmtMontant(l.pu)} F`,
      `${fmtMontant(l.total)} F`,
    ]),
    startY: yApresPf + 24,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 90, 138], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  let y = doc.lastAutoTable.finalY + 8;
  // Sous-total et remise globale, au-dessus du bandeau TOTAL
  if (Number(p.remise_montant || 0) > 0) {
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text("Sous-total :", largeur - 60, y);
    doc.text(`${fmtMontant(p.sous_total)} F`, largeur - 18, y, { align: "right" });
    y += 5;
    doc.setTextColor(61, 139, 64);
    doc.text(`Remise ${p.remise_pct} % :`, largeur - 60, y);
    doc.text(`-${fmtMontant(p.remise_montant)} F`, largeur - 18, y, { align: "right" });
    doc.setTextColor(60, 60, 60);
    y += 7;
  }
  y = bandeauTotal(doc, largeur, y, p.total);

  // Mentions légales du proforma
  y += 12;
  mentionsOffre(doc, y, "une facture proforma");
  if (p.validite) doc.text(`Offre valable ${p.validite}.`, 14, y + 8);
  piedDePage(doc, largeur, hauteur);

  if (retournerDoc) return doc;
  doc.save(fichierPdf("Proforma", { client: p.client, numero: p.numero }));
}

// ============ DEVIS (dimensionnement solaire / garage / autre) ============
// Même présentation que le proforma, avec le statut et l'élaborateur en plus —
// utile pour la rubrique « Tous les devis » consultée par l'admin et le
// responsable commercial.
// ============ LE DEVIS, PRÉSENTATION COMMERCIALE ============
// Timo (11/09/2026) : le solaire d'abord, puis « fais le même rendu pour
// portail et autre ». UNE charpente pour les trois volets — Votre besoin,
// Équipement proposé, TOTAL DU PROJET avec acompte et solde, mentions +
// validité + bon pour accord. Seul le BLOC DU BESOIN change d'un volet à
// l'autre : chacun montre ce qu'il a, on n'invente pas un bloc vide. Un
// ancien devis sans besoins passe par la même charpente, sans ce bloc.
// Les données du devis ne changent pas : seule la mise en page.
// Aucun accès à db ici : tout vient de `d`.
const GRIS_CLAIR = [241, 245, 249];
const GRIS_TEXTE = [71, 85, 105];
const kWh = (wh) => `${(Number(wh || 0) / 1000).toFixed(1).replace(".", ",")} kWh`;
const kW = (w) => (Number(w || 0) >= 1000 ? `${(Number(w) / 1000).toFixed(1).replace(".", ",")} kW` : `${fmtMontant(w)} W`);
const nb = (x) => String(Number(x || 0)).replace(".", ",");
const LIBELLE_BATTERIE = { lifepo4: "Lithium LiFePO4", gel: "Gel", plomb: "Plomb" };
// Un titre de colonne PORTE l'alignement de sa colonne : `columnStyles` ne
// descend pas jusqu'aux en-têtes (mesuré le 11/09/2026 — « Total » commençait
// à 163 mm alors que ses montants finissaient à 195).
const enTete = (texte, halign = "left") => ({ content: texte, styles: { halign } });
// Une nouvelle page si le bloc suivant ne tient pas.
const placePour = (doc, y, hauteur, besoin) => { if (y + besoin > hauteur - 20) { doc.addPage(); return 20; } return y; };
const titreBloc = (doc, y, texte) => {
  doc.setFontSize(10);
  doc.setTextColor(...BLEU);
  doc.text(texte.toUpperCase(), 14, y);
  doc.setDrawColor(...BLEU);
  doc.setLineWidth(0.4);
  doc.line(14, y + 1.5, 14 + doc.getTextWidth(texte.toUpperCase()), y + 1.5);
  return y + 5;
};
// Les trois grandes cases du besoin : un chiffre lisible de loin, son libellé dessous.
const grandesCases = (doc, y, largeur, cases) => {
  const lc = (largeur - 28 - 8) / cases.length;
  cases.forEach(([valeur, libelle], i) => {
    const x = 14 + i * (lc + 4);
    doc.setFillColor(...GRIS_CLAIR);
    doc.roundedRect(x, y, lc, 15, 1.5, 1.5, "F");
    doc.setFontSize(String(valeur).length > 12 ? 11 : 15);
    doc.setTextColor(...BLEU);
    doc.text(String(valeur), x + lc / 2, y + 7.5, { align: "center" });
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS_TEXTE);
    doc.text(libelle, x + lc / 2, y + 12.5, { align: "center" });
  });
  return y + 19;
};
const ligneDetail = (doc, y, morceaux) => {
  const t = morceaux.filter(Boolean).join("   •   ");
  if (!t) return y;
  doc.setFontSize(8);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text(t, 14, y, { maxWidth: doc.internal.pageSize.getWidth() - 28 });
  return y + 5;
};

// ---- Le bloc du besoin, volet par volet ----
function besoinSolaire(doc, d, largeur, hauteur, y) {
  const b = d.besoins;
  y = titreBloc(doc, y, "Votre besoin");
  y = grandesCases(doc, y, largeur, [
    [kWh(b.wh_jour), "Besoin estimé par jour"],
    [kW(b.puissance_simultanee), "Puissance simultanée"],
    [`${Number(b.autonomie || 1)} jour${Number(b.autonomie || 1) > 1 ? "s" : ""}`, "Autonomie souhaitée"],
  ]);
  y = ligneDetail(doc, y, [
    b.tension ? `Tension du système : ${b.tension} V` : "",
    b.type_batterie ? `Batterie : ${LIBELLE_BATTERIE[b.type_batterie] || b.type_batterie}` : "",
  ]);
  y = placePour(doc, y, hauteur, 30);
  y = titreBloc(doc, y, "Vos appareils");
  const totalW = b.appareils.reduce((s, a) => s + Number(a.puissance || 0) * Number(a.qte || 1), 0);
  autoTable(doc, {
    // ⚠ Capture Timo (11/09/2026) : « la puissance (W) n'est pas centrée sous
    // la ligne… même souci dans équipement proposé ». Les VALEURS étaient bien
    // à droite / au centre, mais les EN-TÊTES étaient restés à gauche : une
    // colonne ne transmet pas son alignement à son titre. On le dit donc sur
    // chaque cellule de titre — et sur le pied, qui l'ignorait aussi.
    head: [[enTete("Appareil à alimenter"), enTete("Puissance (W)", "right"), enTete("Qté", "center"), enTete("Heures / jour", "center")]],
    body: b.appareils.map((a) => [String(a.nom), fmtMontant(a.puissance), String(a.qte || 1), String(a.heures || 0)]),
    foot: [["Puissance totale installée", { content: `${fmtMontant(totalW)} W`, styles: { halign: "right" } }, "", ""]],
    startY: y,
    styles: { fontSize: 7.5, cellPadding: 1, textColor: GRIS_TEXTE },
    headStyles: { fillColor: GRIS_CLAIR, textColor: GRIS_TEXTE, fontStyle: "bold" },
    footStyles: { fillColor: [255, 255, 255], textColor: GRIS_TEXTE, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "center" }, 3: { halign: "center" } },
    margin: { left: 14, right: 14 },
  });
  return doc.lastAutoTable.finalY + 4;
}

function besoinPortail(doc, d, largeur, hauteur, y) {
  const b = d.besoins;
  const retenu = Number(b.poids_ajuste || b.poids || 0);
  // ⚠ Timo (11/09/2026) : « votre ouvrant ??? » — « ouvrant » est le mot du
  // code, pas celui du client. Le titre reprend le TYPE réel du projet :
  // « VOTRE PORTAIL COULISSANT », « VOTRE RIDEAU MÉTALLIQUE »…
  y = titreBloc(doc, y, b.type_ouvrant ? `Votre ${b.type_ouvrant}` : "Votre installation");
  y = grandesCases(doc, y, largeur, [
    [b.largeur && b.hauteur ? `${nb(b.largeur)} × ${nb(b.hauteur)} m` : "—", "Dimensions"],
    [retenu ? `${fmtMontant(retenu)} kg` : "—", "Poids retenu"],
    // La fréquence arrive déjà en clair (« Moyenne (10 à 30 cycles/j) ») :
    // le mot en grand, le détail dans la ligne dessous.
    [String(b.frequence || "—").split("(")[0].trim() || "—", "Usage quotidien"],
  ]);
  y = ligneDetail(doc, y, [
    Number(b.vantaux) > 1 ? `${b.vantaux} vantaux` : "",
    b.surface_porte ? `Surface : ${nb(b.surface_porte)} m²` : "",
    b.poids && Number(b.poids) !== retenu ? `Poids mesuré : ${fmtMontant(b.poids)} kg` : "",
    b.frequence ? `Usage : ${b.frequence}` : "",
    b.telecommandes ? `Télécommandes : ${b.telecommandes}` : "",
  ]);
  return y + 2;
}

function besoinAutre(doc, d, largeur, hauteur, y) {
  const b = d.besoins;
  y = titreBloc(doc, y, "Votre demande");
  autoTable(doc, {
    head: [[enTete("Ce que vous avez demandé"), enTete("Qté", "center")]],
    body: b.articles_demandes.map((a) => [String(a.nom), String(a.qte || 1)]),
    startY: y,
    styles: { fontSize: 8, cellPadding: 1.2, textColor: GRIS_TEXTE },
    headStyles: { fillColor: GRIS_CLAIR, textColor: GRIS_TEXTE, fontStyle: "bold" },
    columnStyles: { 1: { halign: "center", cellWidth: 20 } },
    margin: { left: 14, right: 14 },
  });
  return doc.lastAutoTable.finalY + 8;
}

// ---- Les blocs communs aux trois volets ----
function blocEquipement(doc, d, largeur, hauteur, y) {
  y = placePour(doc, y, hauteur, 40);
  y = titreBloc(doc, y, "Équipement proposé");
  // Groupé par catégorie ; un ancien devis qui n'en a aucune reste une
  // simple liste, sans en-tête de groupe inventé.
  const avecCategorie = d.lignes.some((l) => l.categorie);
  const body = [];
  if (avecCategorie) {
    const groupes = [];
    for (const l of d.lignes) {
      const cat = String(l.categorie || "Autres équipements");
      let g = groupes.find((x) => x.cat === cat);
      if (!g) { g = { cat, lignes: [] }; groupes.push(g); }
      g.lignes.push(l);
    }
    // ⚠ Timo (11/09/2026, capture) : « je pense qu'il y a trop de tautologie
    // dans les équipements proposés » — « Panneaux solaires » au-dessus de
    // « Panneau 400W », « Batteries » au-dessus de « Batterie lithium »… le
    // client lisait deux fois la même chose et le tableau faisait le double
    // de sa hauteur. LA RÈGLE : un en-tête de catégorie n'apparaît que s'il
    // regroupe AU MOINS 2 lignes. Une catégorie à une seule ligne perd son
    // titre — le nom de l'article dit déjà tout. Deux modèles de panneaux
    // dans le même devis, et « Panneaux solaires » revient de lui-même.
    for (const g of groupes) {
      if (g.lignes.length >= 2) body.push([{ content: g.cat, colSpan: 4, styles: { fontStyle: "bold", fillColor: [226, 232, 240], textColor: BLEU } }]);
      for (const l of g.lignes) body.push(ligneEquipement(l));
    }
  } else {
    for (const l of d.lignes) body.push(ligneEquipement(l));
  }
  autoTable(doc, {
    head: [[enTete("Désignation"), enTete("Qté", "center"), enTete("Prix unitaire", "right"), enTete("Total", "right")]],
    body,
    startY: y,
    styles: { fontSize: 8.5, cellPadding: 1.3 },
    headStyles: { fillColor: BLEU, textColor: 255 },
    columnStyles: { 1: { halign: "center", cellWidth: 16 }, 2: { halign: "right", cellWidth: 34 }, 3: { halign: "right", cellWidth: 34 } },
    margin: { left: 14, right: 14 },
  });
  // ⚠ Capture Timo (11/09/2026) : le bandeau TOTAL était dessiné PAR-DESSUS
  // « Frais d'installation ». Le bandeau ne commence pas à ce `y` : il monte
  // 6 mm PLUS HAUT (bandeauTotal dessine son rectangle de y-6 à y+5). En
  // resserrant les blancs, j'avais oublié ces 6 mm. Il faut donc rendre
  // finalY + 6 + l'écart voulu — pas l'écart seul.
  return doc.lastAutoTable.finalY + 6 + 2;
}
// Une remise est une ligne négative : elle se lit en rouge.
const ligneEquipement = (l) => {
  const style = Number(l.total) < 0 ? { textColor: [185, 28, 28] } : {};
  return [
    { content: String(l.article), styles: style },
    { content: String(l.qte), styles: { halign: "center", ...style } },
    { content: `${fmtMontant(l.pu)} F`, styles: { halign: "right", ...style } },
    { content: `${fmtMontant(l.total)} F`, styles: { halign: "right", fontStyle: "bold", ...style } },
  ];
};

function blocFinancier(doc, d, largeur, hauteur, y) {
  // La place a déjà été retenue pour TOUT le bas du devis (hauteurBlocFinal) :
  // ce bloc ne change plus de page de son côté.
  y = bandeauTotal(doc, largeur, y, d.total, "TOTAL DU PROJET");
  const total = Number(d.total || 0);
  const acompte = Math.max(0, Math.min(total, Math.round(Number(d.montant_acompte ?? (total * Number(d.pct_acompte ?? 100)) / 100))));
  const solde = total - acompte;
  // ⚠ Essayé puis ABANDONNÉ le 11/09/2026 : poser les mentions dans le blanc
  // à gauche du total. Le banc a mesuré le chevauchement — la première ligne
  // (108 mm) mordait sur « Acompte à la commande (60 %) », qui commence à
  // 100 mm. Elles restent donc SOUS la colonne des montants, et les
  // millimètres cherchés ont été pris ailleurs (blancs entre les blocs,
  // cases du besoin, cadres de signature).
  y += 6;
  doc.setFontSize(9.5);
  doc.setTextColor(...GRIS_TEXTE);
  if (solde > 0) {
    const pct = d.pct_acompte !== undefined && d.pct_acompte !== null ? ` (${Number(d.pct_acompte)} %)` : "";
    doc.text(`Acompte à la commande${pct} :`, largeur - 60, y, { align: "right" });
    doc.setTextColor(...BLEU); doc.setFontSize(10.5);
    doc.text(`${fmtMontant(acompte)} FCFA`, largeur - 18, y, { align: "right" });
    y += 6;
    doc.setFontSize(9.5); doc.setTextColor(...GRIS_TEXTE);
    doc.text("Solde à l'installation :", largeur - 60, y, { align: "right" });
    doc.setTextColor(...BLEU); doc.setFontSize(10.5);
    doc.text(`${fmtMontant(solde)} FCFA`, largeur - 18, y, { align: "right" });
    y += 6;
  } else {
    doc.text("Paiement intégral à la commande.", largeur - 18, y, { align: "right" });
    y += 6;
  }
  if (d.delai_installation) {
    doc.setFontSize(9); doc.setTextColor(...GRIS_TEXTE);
    doc.text(`Délai d'installation : ${d.delai_installation}`, largeur - 18, y, { align: "right" });
    y += 6;
  }
  return y;
}

// Une image posée dans un cadre, à sa proportion, sans jamais déborder ni
// faire tomber le PDF si la donnée est illisible.
function imageDansCadre(doc, image, x, y, wMax, hMax) {
  if (!image) return false;
  try {
    const props = doc.getImageProperties(image);
    const ech = Math.min(wMax / props.width, hMax / props.height);
    const w = props.width * ech, h = props.height * ech;
    doc.addImage(image, props.fileType || "PNG", x + (wMax - w) / 2, y + (hMax - h) / 2, w, h);
    return true;
  } catch { return false; }
}

// ⚠ Timo (11/09/2026) : « un devis devrait avoir une signature ? » — le bas
// du devis ne portait QUE le cadre du client : BMI n'engageait rien. Un devis
// est pourtant un engagement de la maison (ce prix, ce matériel, ce délai,
// 15 jours). Le cadre de gauche devient donc « Pour BMI Togo » : le nom de
// celui qui l'a élaboré, sa signature personnelle si sa fiche en porte une,
// et LE cachet de l'entreprise — le même que sur les contrats, on n'en crée
// pas un deuxième. La date libre qui occupait ce cadre est descendue DANS le
// cadre du client (« la date d'en bas n'est plus importante car en haut déjà
// il y a une date » : celle du haut est la date du devis, celle d'en bas le
// jour où le client dit oui — deux dates différentes, une seule à sa place).
function blocMentions(doc, d, largeur, hauteur, y) {
  y += 3;
  // ⚠ Deux captures de Timo le 11/09/2026, dans cet ordre : « le cachet est
  // trop petit dans le cadre, l'agrandir davantage » (le cachet est CARRÉ :
  // c'est la HAUTEUR du cadre qui le bridait à 17 mm, pas sa largeur), puis
  // « les cadres des signatures sont trop trop gros, réduire au max ». Les
  // deux tiennent ensemble en serrant les marges INTÉRIEURES à presque rien :
  // cadre 56 × 30 (au lieu de 70 × 40, soit 40 % de surface en moins) et le
  // cachet dessiné à 22 mm — toujours bien plus gros que les 17 mm du départ.
  // ⚠ Capture Timo (11/09/2026, « le problème est revenu ») : le bas du devis
  // partait SEUL sur une page suivante — il ne manquait pourtant que 1 à 13 mm
  // (mesuré). Les mentions occupaient 12 mm en pleine largeur AU-DESSUS des
  // deux cadres, alors que la place à GAUCHE des cadres était blanche. Elles
  // s'y installent : même texte (mentionsOffre, la règle commune), serrées en
  // colonne étroite, et les cadres rétrécis d'autant. 15 mm rendus au devis —
  // de quoi faire tenir sur UNE page tous les devis qui débordaient de peu.
  const L = 48, H = 28, xG = MENTIONS_LARGEUR + 20, xD = largeur - 14 - L;
  doc.setDrawColor(...GRIS_TEXTE);
  doc.setLineWidth(0.3);
  doc.roundedRect(xG, y, L, H, 1.5, 1.5, "S");
  doc.roundedRect(xD, y, L, H, 1.5, 1.5, "S");
  mentionsOffre(doc, y + 3, "un devis", MENTIONS_LARGEUR);
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`Offre valable ${VALIDITE_OFFRE_JOURS} jours à compter du ${d.date}.`, 14, y + 3 + 4 * MENTIONS_INTERLIGNE, { maxWidth: MENTIONS_LARGEUR });
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text("Pour BMI Togo", xG + 2.5, y + 4);
  if (d.par) doc.text(String(d.par), xG + 2.5, y + 7.5);
  imageDansCadre(doc, d.signature, xG + 1, y + 8, 20, 19);
  imageDansCadre(doc, d.cachet, xG + 23, y + 7, 23, 20);
  doc.text("Bon pour accord — signature du client", xD + 2, y + 4);
  doc.text("Date : ____ / ____ / ________", xD + 2, y + H - 3);
  piedDePage(doc, largeur, hauteur);
}
// La hauteur dont le bas du devis a besoin — total, mentions et signatures
// réunis. ⚠ Timo (11/09/2026) : « est-ce possible d'avoir les signatures sur
// la même page ? ». La page ne se décide plus TROIS fois (équipement, total,
// mentions) : le total, les mentions et les deux cadres forment UN bloc
// insécable. Le client qui n'imprime que la première page n'aura plus jamais
// le matériel sans le prix ni la signature.
const hauteurBlocFinal = (d) => {
  const total = Number(d.total || 0);
  const acompte = Math.max(0, Math.min(total, Math.round(Number(d.montant_acompte ?? (total * Number(d.pct_acompte ?? 100)) / 100))));
  // Bandeau TOTAL, puis acompte / solde / délai, puis les trois lignes de
  // mentions, puis les deux cadres : la hauteur exacte, jamais une réserve
  // au jugé (c'est elle qui envoyait la signature seule sur une page 2).
  const montants = 12 + (total - acompte > 0 ? 6 : 0) + (d.delai_installation ? 6 : 0);
  // Les mentions tiennent MAINTENANT à gauche des cadres : la hauteur du bas
  // du devis, c'est le bandeau et les montants, puis la rangée cadres.
  return montants + 3 + 28 + 1;
};

// Le bloc du besoin qui convient à CE devis — null si le devis n'en porte
// pas (ancien devis) : la charpente commence alors à l'équipement.
const blocBesoin = (b) => {
  if (b && Array.isArray(b.appareils) && b.appareils.length > 0) return besoinSolaire;
  if (b && b.type_ouvrant) return besoinPortail;
  if (b && Array.isArray(b.articles_demandes) && b.articles_demandes.length > 0) return besoinAutre;
  return null;
};

function devisCommercial(doc, d, largeur, hauteur, yDepart) {
  const rendreBesoin = blocBesoin(d.besoins || null);
  let y = yDepart + 24;
  if (rendreBesoin) y = rendreBesoin(doc, d, largeur, hauteur, y);
  y = blocEquipement(doc, d, largeur, hauteur, y);
  y = placePour(doc, y, hauteur, hauteurBlocFinal(d));
  y = blocFinancier(doc, d, largeur, hauteur, y);
  blocMentions(doc, d, largeur, hauteur, y);
}

export function genererDevis(d, logo, retournerDoc = false) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();

  enteteSociete(doc, logo, largeur);
  // Bandeau DEVIS — `d.formation` est calculé par l'appelant (qui a accès à
  // db, ce module ne l'a pas).
  const yApres = bandeauTitre(doc, largeur, `DEVIS — ${d.titre || ""}`.trim(), d.formation);

  // Infos client + numéro + statut + élaborateur
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  // Resserré le 11/09/2026 (Timo veut la signature sur la même page) : les
  // quatre lignes d'identité passent de 5 à 4 mm d'écart. Rien n'est retiré,
  // c'est l'air entre les lignes qui est repris — 6 mm gagnés.
  doc.text(`N° ${d.numero}`, 14, yApres + 6.5);
  doc.text(`Date : ${d.date}`, 14, yApres + 10.5);
  if (d.boutique) doc.text(`Boutique : ${d.boutique}`, 14, yApres + 14.5);
  if (d.par) doc.text(`Élaboré par : ${d.par}`, 14, yApres + 18.5);
  doc.text(`Client : ${d.client || "—"}`, largeur - 14, yApres + 6.5, { align: "right" });
  if (d.tel) doc.text(`Tél : ${d.tel}`, largeur - 14, yApres + 10.5, { align: "right" });
  if (d.statut) doc.text(`Statut : ${d.statut}`, largeur - 14, yApres + 14.5, { align: "right" });

  // ⚠ RELEVÉ PAR TIMO (02/09/2026) : « c'est juste les articles qui
  // apparaissent — les équipements et la charge dimensionnée devraient
  // aussi apparaître sur le devis en PDF ». Le devis GARDE ces données
  // (d.besoins, posé par le dimensionnement) ; elles sont rendues AVANT
  // l'équipement, selon le volet d'origine — reconnu à la forme des
  // besoins, ce module n'ayant pas accès à db.
  devisCommercial(doc, d, largeur, hauteur, yApres);

  if (retournerDoc) return doc;
  // ⚠ RELEVÉ PAR TIMO (02/09/2026) : le fichier doit porter le NOM DU
  // CLIENT. La règle du nom vit dans lib/core.js (nomDocument) — la même
  // pour tout ce qui s'imprime ou se télécharge.
  doc.save(fichierPdf("Devis", { client: d.client, numero: d.numero }));
}

// ============ LE RELEVÉ D'UNE CAISSE CENTRALE (Timo, 12/09/2026) ============
// « Vous avez dit que c'est comme un relevé… pourquoi c'est impossible
// d'exporter pour imprimer ? » — le relevé de Chez le DG, BANQUE ou Chez le
// comptable (lib/caissesCentrales.js, `releve`) s'imprime : les briques
// communes (entête, bandeau de titre, pied de page), la période, les quatre
// lignes du relevé en grandes cases, puis les mouvements de la période dans
// l'ordre des dates. Rien n'est écrit : le PDF reprend l'écran, tel quel.
// `r` : { du, au, soldeDebut, entrees, sorties, soldeFin, mouvements }.
export function genererReleve(r, { caisse, periode, logo, formation = false, edite = "" } = {}, retournerDoc = false) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  const dFRl = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
  const depuisLeDebut = String(r.du) <= "0000-01-01";
  const jusquAuBout = String(r.au) >= "9999-12-31";
  const libellePeriode = depuisLeDebut && jusquAuBout ? "Depuis le début"
    : `du ${depuisLeDebut ? "début" : dFRl(r.du)} au ${jusquAuBout ? "aujourd'hui" : dFRl(r.au)}`;

  enteteSociete(doc, logo, largeur);
  // Un tiret simple : la police de base du PDF n'écrit pas le tiret long.
  const yApres = bandeauTitre(doc, largeur, `RELEVÉ - ${caisse || ""}`.trim(), formation);
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Période : ${periode ? `${periode} (${libellePeriode})` : libellePeriode}`, 14, yApres + 7);
  if (edite) doc.text(`Édité le ${edite}`, largeur - 14, yApres + 7, { align: "right" });

  let y = grandesCases(doc, yApres + 12, largeur, [
    [`${fmtMontant(r.soldeDebut)} F`, "Solde au début"],
    [`+ ${fmtMontant(r.entrees)} F`, "Entrées de la période"],
    [`- ${fmtMontant(r.sorties)} F`, "Sorties de la période"],
    [`${fmtMontant(r.soldeFin)} F`, "Solde à la fin"],
  ]);

  const mouvements = [...(r.mouvements || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  autoTable(doc, {
    head: [["Date", "Mouvement", "Boutique", "Entrée", "Sortie"]],
    body: mouvements.length
      ? mouvements.map((m) => [dFRl(m.date), m.libelle || "", m.boutique || "", m.sens === "entree" ? fmtMontant(m.montant) : "", m.sens === "sortie" ? fmtMontant(m.montant) : ""])
      : [["", "Aucun mouvement sur cette période.", "", "", ""]],
    foot: [["", "Total de la période", "", fmtMontant(r.entrees), fmtMontant(r.sorties)]],
    startY: y + 2,
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: BLEU, textColor: 255, fontSize: 8 },
    footStyles: { fillColor: GRIS_CLAIR, textColor: GRIS_TEXTE, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 34 }, 3: { cellWidth: 26, halign: "right" }, 4: { cellWidth: 26, halign: "right" } },
    margin: { left: 14, right: 14 },
    didDrawPage: () => piedDePage(doc, largeur, hauteur),
  });
  if (retournerDoc) return doc;
  doc.save(fichierPdf("Relevé", { client: caisse, numero: depuisLeDebut && jusquAuBout ? "depuis le début" : `${dFRl(r.du).replace(/\//g, "-")} au ${dFRl(r.au).replace(/\//g, "-")}` }));
  return null;
}

