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
const mentionsOffre = (doc, y, nature) => {
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Ce document est ${nature} : il constitue une offre de prix et n'a pas de valeur comptable.`, 14, y);
  doc.text("Il ne vaut pas reçu de paiement. Prix indicatifs, susceptibles de variation.", 14, y + 4);
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
// ============ LE DEVIS SOLAIRE, PRÉSENTATION COMMERCIALE ============
// Timo (11/09/2026), après l'avis d'un tiers sur le PDF « administratif » :
// « ça me convient » — sur UNE page, dans cet ordre : Votre besoin (trois
// grandes cases), Vos appareils, Équipement proposé (groupé par catégorie),
// TOTAL DU PROJET avec acompte et solde, mentions + validité + bon pour
// accord. Les données du devis ne changent pas : seule la mise en page.
// Portail et Autre gardent le rendu classique tant qu'il n'a pas validé
// celui-ci. Aucun accès à db ici : tout vient de `d`.
const GRIS_CLAIR = [241, 245, 249];
const GRIS_TEXTE = [71, 85, 105];
const kWh = (wh) => `${(Number(wh || 0) / 1000).toFixed(1).replace(".", ",")} kWh`;
const kW = (w) => (Number(w || 0) >= 1000 ? `${(Number(w) / 1000).toFixed(1).replace(".", ",")} kW` : `${fmtMontant(w)} W`);
const LIBELLE_BATTERIE = { lifepo4: "Lithium LiFePO4", gel: "Gel", plomb: "Plomb" };
// Une nouvelle page si le bloc suivant ne tient pas.
const placePour = (doc, y, hauteur, besoin) => { if (y + besoin > hauteur - 20) { doc.addPage(); return 20; } return y; };
const titreBloc = (doc, y, texte) => {
  doc.setFontSize(10);
  doc.setTextColor(...BLEU);
  doc.text(texte.toUpperCase(), 14, y);
  doc.setDrawColor(...BLEU);
  doc.setLineWidth(0.4);
  doc.line(14, y + 1.5, 14 + doc.getTextWidth(texte.toUpperCase()), y + 1.5);
  return y + 6;
};

function devisSolaire(doc, d, largeur, hauteur, yDepart) {
  const b = d.besoins;
  let y = yDepart + 30;

  // 1. VOTRE BESOIN — trois grandes cases.
  y = titreBloc(doc, y, "Votre besoin");
  const cases = [
    [kWh(b.wh_jour), "Besoin estimé par jour"],
    [kW(b.puissance_simultanee), "Puissance simultanée"],
    [`${Number(b.autonomie || 1)} jour${Number(b.autonomie || 1) > 1 ? "s" : ""}`, "Autonomie souhaitée"],
  ];
  const lc = (largeur - 28 - 8) / 3;
  cases.forEach(([valeur, libelle], i) => {
    const x = 14 + i * (lc + 4);
    doc.setFillColor(...GRIS_CLAIR);
    doc.roundedRect(x, y, lc, 18, 1.5, 1.5, "F");
    doc.setFontSize(15);
    doc.setTextColor(...BLEU);
    doc.text(valeur, x + lc / 2, y + 9, { align: "center" });
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS_TEXTE);
    doc.text(libelle, x + lc / 2, y + 14.5, { align: "center" });
  });
  y += 22;
  const detail = [b.tension ? `Tension du système : ${b.tension} V` : "", b.type_batterie ? `Batterie : ${LIBELLE_BATTERIE[b.type_batterie] || b.type_batterie}` : ""].filter(Boolean).join("   •   ");
  if (detail) { doc.setFontSize(8); doc.setTextColor(...GRIS_TEXTE); doc.text(detail, 14, y); y += 6; }

  // 2. VOS APPAREILS — le tableau, avec le total de puissance.
  y = placePour(doc, y, hauteur, 30);
  y = titreBloc(doc, y, "Vos appareils");
  const totalW = b.appareils.reduce((s, a) => s + Number(a.puissance || 0) * Number(a.qte || 1), 0);
  autoTable(doc, {
    head: [["Appareil à alimenter", "Puissance (W)", "Qté", "Heures / jour"]],
    body: b.appareils.map((a) => [String(a.nom), fmtMontant(a.puissance), String(a.qte || 1), String(a.heures || 0)]),
    foot: [["Puissance totale installée", `${fmtMontant(totalW)} W`, "", ""]],
    startY: y,
    styles: { fontSize: 8, cellPadding: 1.5, textColor: GRIS_TEXTE },
    headStyles: { fillColor: GRIS_CLAIR, textColor: GRIS_TEXTE, fontStyle: "bold" },
    footStyles: { fillColor: [255, 255, 255], textColor: GRIS_TEXTE, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "center" }, 3: { halign: "center" } },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 8;

  // 3. ÉQUIPEMENT PROPOSÉ — groupé par catégorie, la remise en négatif.
  y = placePour(doc, y, hauteur, 40);
  y = titreBloc(doc, y, "Équipement proposé");
  const groupes = [];
  for (const l of d.lignes) {
    const cat = String(l.categorie || "Autres équipements");
    let g = groupes.find((x) => x.cat === cat);
    if (!g) { g = { cat, lignes: [] }; groupes.push(g); }
    g.lignes.push(l);
  }
  const body = [];
  for (const g of groupes) {
    body.push([{ content: g.cat, colSpan: 4, styles: { fontStyle: "bold", fillColor: [226, 232, 240], textColor: BLEU } }]);
    for (const l of g.lignes) {
      const negatif = Number(l.total) < 0;
      const style = negatif ? { textColor: [185, 28, 28] } : {};
      body.push([
        { content: String(l.article), styles: style },
        { content: String(l.qte), styles: { halign: "center", ...style } },
        { content: `${fmtMontant(l.pu)} F`, styles: { halign: "right", ...style } },
        { content: `${fmtMontant(l.total)} F`, styles: { halign: "right", fontStyle: "bold", ...style } },
      ]);
    }
  }
  autoTable(doc, {
    head: [["Désignation", "Qté", "Prix unitaire", "Total"]],
    body,
    startY: y,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: BLEU, textColor: 255 },
    columnStyles: { 1: { halign: "center", cellWidth: 16 }, 2: { halign: "right", cellWidth: 34 }, 3: { halign: "right", cellWidth: 34 } },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // 4. TOTAL DU PROJET, acompte, solde, délai.
  y = placePour(doc, y, hauteur, 45);
  y = bandeauTotal(doc, largeur, y, d.total, "TOTAL DU PROJET");
  const total = Number(d.total || 0);
  const acompte = Math.max(0, Math.min(total, Math.round(Number(d.montant_acompte ?? (total * Number(d.pct_acompte ?? 100)) / 100))));
  const solde = total - acompte;
  y += 8;
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

  // 5. Mentions, validité, bon pour accord.
  y = placePour(doc, y, hauteur, 40);
  y += 4;
  mentionsOffre(doc, y, "un devis");
  doc.text(`Offre valable ${VALIDITE_OFFRE_JOURS} jours à compter du ${d.date}.`, 14, y + 8);
  y += 16;
  doc.setDrawColor(...GRIS_TEXTE);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, 70, 22, 1.5, 1.5, "S");
  doc.roundedRect(largeur - 14 - 70, y, 70, 22, 1.5, 1.5, "S");
  doc.setFontSize(8);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text("Date : ____ / ____ / ________", 17, y + 6);
  doc.text("Bon pour accord — signature du client", largeur - 14 - 67, y + 6);
  piedDePage(doc, largeur, hauteur);
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
  doc.text(`N° ${d.numero}`, 14, yApres + 8);
  doc.text(`Date : ${d.date}`, 14, yApres + 13);
  if (d.boutique) doc.text(`Boutique : ${d.boutique}`, 14, yApres + 18);
  if (d.par) doc.text(`Élaboré par : ${d.par}`, 14, yApres + 23);
  doc.text(`Client : ${d.client || "—"}`, largeur - 14, yApres + 8, { align: "right" });
  if (d.tel) doc.text(`Tél : ${d.tel}`, largeur - 14, yApres + 13, { align: "right" });
  if (d.statut) doc.text(`Statut : ${d.statut}`, largeur - 14, yApres + 18, { align: "right" });

  // ⚠ RELEVÉ PAR TIMO (02/09/2026) : « c'est juste les articles qui
  // apparaissent — les équipements et la charge dimensionnée devraient
  // aussi apparaître sur le devis en PDF ». Le devis GARDE ces données
  // (d.besoins, posé par le dimensionnement) ; le PDF ne les imprimait
  // pas. On les rend AVANT la table des prix, selon le volet d'origine —
  // reconnu à la forme des besoins, ce module n'ayant pas accès à db.
  let yTable = yApres + 30;
  const b = d.besoins || null;
  // Solaire : la présentation commerciale (Timo, 11/09/2026), sur ses données.
  // Portail et Autre gardent le rendu classique. UNE seule sortie de fichier,
  // tout en bas : le nom du client passe par la règle unique (nomDocument).
  const estSolaire = !!(b && Array.isArray(b.appareils) && b.appareils.length > 0);
  if (estSolaire) devisSolaire(doc, d, largeur, hauteur, yApres);
  if (!estSolaire && b && b.type_ouvrant) {
    // Garage / portail : les mesures qui ont dimensionné le moteur.
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const lignesB = [
      `Ouvrant : ${b.type_ouvrant}${b.vantaux > 1 ? ` — ${b.vantaux} vantaux` : ""}`,
      [b.largeur ? `Largeur : ${b.largeur} m` : "", b.hauteur ? `Hauteur : ${b.hauteur} m` : "",
       b.surface_porte ? `Surface : ${b.surface_porte} m²` : ""].filter(Boolean).join("   •   "),
      [b.poids ? `Poids : ${fmtMontant(b.poids)} kg${b.poids_ajuste && b.poids_ajuste !== b.poids ? ` (retenu : ${fmtMontant(b.poids_ajuste)} kg)` : ""}` : "",
       b.frequence ? `Usage : ${b.frequence}` : "",
       b.telecommandes ? `Télécommandes : ${b.telecommandes}` : ""].filter(Boolean).join("   •   "),
    ].filter(Boolean);
    let yB = yTable - 2;
    for (const t of lignesB) { doc.text(t, 14, yB); yB += 4.5; }
    yTable = yB + 3;
  } else if (b && Array.isArray(b.articles_demandes) && b.articles_demandes.length > 0) {
    // Autre domaine : ce que le client a demandé, tel qu'exprimé.
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Demande : ${b.articles_demandes.map((a) => `${a.nom}${Number(a.qte) > 1 ? ` × ${a.qte}` : ""}`).join(", ")}`, 14, yTable - 2, { maxWidth: largeur - 28 });
    yTable += 4;
  }

  // ⚠ La colonne « Équipement » (la catégorie de chaque ligne : Panneaux
  // solaires, Batteries, Installation…) manquait aussi — le PDF ne montrait
  // que le nom brut des articles. Les anciens devis sans catégorie
  // affichent une case vide, rien ne casse.
  const avecCategorie = d.lignes.some((l) => l.categorie);
  if (!estSolaire) {
  autoTable(doc, {
    head: [avecCategorie ? ["Équipement", "Article", "Qté", "Prix unitaire", "Total"] : ["Article", "Qté", "Prix unitaire", "Total"]],
    body: d.lignes.map((l) => [
      ...(avecCategorie ? [String(l.categorie || "")] : []),
      String(l.article),
      String(l.qte),
      `${fmtMontant(l.pu)} F`,
      `${fmtMontant(l.total)} F`,
    ]),
    startY: yTable,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 90, 138], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: avecCategorie
      ? { 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" } }
      : { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  let y = doc.lastAutoTable.finalY + 8;
  y = bandeauTotal(doc, largeur, y, d.total);

  y += 12;
  mentionsOffre(doc, y, "un devis");
  piedDePage(doc, largeur, hauteur);
  }

  if (retournerDoc) return doc;
  // ⚠ RELEVÉ PAR TIMO (02/09/2026) : le fichier doit porter le NOM DU
  // CLIENT. La règle du nom vit dans lib/core.js (nomDocument) — la même
  // pour tout ce qui s'imprime ou se télécharge.
  doc.save(fichierPdf("Devis", { client: d.client, numero: d.numero }));
}
