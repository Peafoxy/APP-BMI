import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

// ============ PROFORMA ============
// Document commercial remis à un client qui demande un prix. Il porte la mention
// PROFORMA (pas « Reçu ») et n'a AUCUNE valeur comptable : il n'est pas enregistré
// comme une vente, ne déduit pas le stock. C'est une simple offre de prix.
export function genererProforma(p, logo, retournerDoc = false) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();

  // En-tête : logo + société
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const w = 30;
      const h = (props.height * w) / props.width;
      doc.addImage(logo, "JPEG", 14, 10, w, Math.min(h, 18));
    } catch {}
  }
  doc.setFontSize(16);
  doc.setTextColor(30, 90, 138);
  doc.text("BMI TOGO", largeur - 14, 16, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text("Lomé, Togo", largeur - 14, 21, { align: "right" });
  doc.text("NIF : 1001790098", largeur - 14, 25, { align: "right" });
  doc.text("RCCM : TG-LFW-01-2022-A10-01523", largeur - 14, 29, { align: "right" });

  // Bandeau PROFORMA — bien visible, pour qu'on ne le confonde pas avec un reçu
  doc.setFillColor(30, 90, 138);
  doc.rect(14, 32, largeur - 28, 10, "F");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("FACTURE PROFORMA", largeur / 2, 39, { align: "center" });

  // ⚠ Bandeau "DOCUMENT DE FORMATION" (demande Timo) — même principe que
  // genererDevis ci-dessus.
  let yApresPf = 42;
  if (p.formation) {
    doc.setFillColor(180, 83, 9);
    doc.rect(14, 44, largeur - 28, 8, "F");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("DOCUMENT DE FORMATION — SANS VALEUR", largeur / 2, 49.5, { align: "center" });
    yApresPf = 54;
  }

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
  // Bandeau TOTAL : un rectangle plein aligné à droite, texte blanc à l'intérieur.
  // Ainsi le montant ET « FCFA » tiennent toujours, sans débordement ni coupure.
  const bandeauLargeur = 90;
  const bandeauX = largeur - 14 - bandeauLargeur;
  doc.setFillColor(30, 90, 138);
  doc.roundedRect(bandeauX, y - 6, bandeauLargeur, 11, 1.5, 1.5, "F");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", bandeauX + 5, y + 1.5);
  doc.text(`${fmtMontant(p.total)} FCFA`, largeur - 18, y + 1.5, { align: "right" });
  y += 5;

  // Mentions légales du proforma
  y += 12;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Ce document est une facture proforma : il constitue une offre de prix et n'a pas de valeur comptable.", 14, y);
  doc.text("Il ne vaut pas reçu de paiement. Prix indicatifs, susceptibles de variation.", 14, y + 4);
  if (p.validite) doc.text(`Offre valable ${p.validite}.`, 14, y + 8);

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("BMI-Gestions Boutiques", largeur / 2, hauteur - 8, { align: "center" });

  if (retournerDoc) return doc;
  doc.save(`Proforma_${p.numero}.pdf`);
}

// ============ DEVIS (dimensionnement solaire / garage / autre) ============
// Même présentation que le proforma, avec le statut et l'élaborateur en plus —
// utile pour la rubrique « Tous les devis » consultée par l'admin et le
// responsable commercial.
export function genererDevis(d, logo, retournerDoc = false) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();

  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const w = 30;
      const h = (props.height * w) / props.width;
      doc.addImage(logo, "JPEG", 14, 10, w, Math.min(h, 18));
    } catch {}
  }
  doc.setFontSize(16);
  doc.setTextColor(30, 90, 138);
  doc.text("BMI TOGO", largeur - 14, 16, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text("Lomé, Togo", largeur - 14, 21, { align: "right" });
  doc.text("NIF : 1001790098", largeur - 14, 25, { align: "right" });
  doc.text("RCCM : TG-LFW-01-2022-A10-01523", largeur - 14, 29, { align: "right" });

  // Bandeau DEVIS
  doc.setFillColor(30, 90, 138);
  doc.rect(14, 32, largeur - 28, 10, "F");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(`DEVIS — ${d.titre || ""}`.trim(), largeur / 2, 39, { align: "center" });

  // ⚠ Bandeau "DOCUMENT DE FORMATION" (demande Timo) : même principe que
  // les autres documents (impression.js) — `d.formation` est calculé par
  // l'appelant (qui a accès à db, ce module ne l'a pas).
  let yApres = 42;
  if (d.formation) {
    doc.setFillColor(180, 83, 9);
    doc.rect(14, 44, largeur - 28, 8, "F");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("DOCUMENT DE FORMATION — SANS VALEUR", largeur / 2, 49.5, { align: "center" });
    yApres = 54;
  }

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
  if (b && Array.isArray(b.appareils) && b.appareils.length > 0) {
    // Solaire : la charge appareil par appareil, puis le résumé du calcul.
    autoTable(doc, {
      head: [["Appareil à alimenter", "Puissance (W)", "Qté", "Heures / jour"]],
      body: b.appareils.map((a) => [String(a.nom), fmtMontant(a.puissance), String(a.qte || 1), String(a.heures || 0)]),
      startY: yTable,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [100, 116, 139], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "center" }, 3: { halign: "center" } },
      margin: { left: 14, right: 14 },
    });
    let yResume = doc.lastAutoTable.finalY + 4;
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const resume = [
      b.wh_jour ? `Besoin estimé : ${fmtMontant(b.wh_jour)} Wh/jour` : "",
      b.puissance_simultanee ? `Puissance simultanée : ${fmtMontant(b.puissance_simultanee)} W` : "",
      b.autonomie ? `Autonomie : ${b.autonomie} jour(s)` : "",
      b.tension ? `Tension : ${b.tension} V` : "",
      b.type_batterie ? `Batterie : ${{ lifepo4: "Lithium LiFePO4", gel: "Gel", plomb: "Plomb" }[b.type_batterie] || b.type_batterie}` : "",
    ].filter(Boolean).join("   •   ");
    if (resume) { doc.text(resume, 14, yResume); yResume += 5; }
    yTable = yResume + 3;
  } else if (b && b.type_ouvrant) {
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
  const bandeauLargeur = 90;
  const bandeauX = largeur - 14 - bandeauLargeur;
  doc.setFillColor(30, 90, 138);
  doc.roundedRect(bandeauX, y - 6, bandeauLargeur, 11, 1.5, 1.5, "F");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", bandeauX + 5, y + 1.5);
  doc.text(`${fmtMontant(d.total)} FCFA`, largeur - 18, y + 1.5, { align: "right" });
  y += 5;

  y += 12;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Ce document est un devis : il constitue une offre de prix et n'a pas de valeur comptable.", 14, y);
  doc.text("Il ne vaut pas reçu de paiement. Prix indicatifs, susceptibles de variation.", 14, y + 4);

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("BMI-Gestions Boutiques", largeur / 2, hauteur - 8, { align: "center" });

  if (retournerDoc) return doc;
  // ⚠ RELEVÉ PAR TIMO (02/09/2026) : le fichier doit porter le NOM DU
  // CLIENT — « Devis_KOFFI AGBEKO_3F2A91C0.pdf » se retrouve dans un
  // dossier de téléchargements, « Devis_3F2A91C0.pdf » non. Le numéro
  // reste : deux devis du même client ne s'écrasent pas.
  const nomClient = String(d.client || "").replace(/[\\/:*?"<>|]/g, "").trim();
  doc.save(`Devis${nomClient && nomClient !== "—" ? `_${nomClient}` : ""}_${d.numero}.pdf`);
}
