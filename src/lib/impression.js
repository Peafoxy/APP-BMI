// ============================================================
// lib/impression.js — Génération de documents imprimables : reçu
// client, proforma, bon de ravitaillement, bulletin de paie, et
// message WhatsApp du reçu. printApi vit dans components/ui.jsx
// (liaisons « live » des modules ES — voir le commentaire là-bas).
// ============================================================
import { today, dFR, fmt, totalVente, brutVente, lignesVente, numeroRecu, numeroRecuDette, telDigits } from "./core";
import { LOGO, CACHET_BMI_DEFAUT } from "./constants";
import { printApi } from "../components/ui";
import { paieMois, resteCredit, libelleMoisFR, totalRembourseCredit, estReservation } from "./calculs";
import { genererSVGCode128 } from "./barcode";

// ============ ÉCHAPPEMENT HTML (partagé par tous les documents) ============
// Une seule définition pour tout le fichier (elle était dupliquée 7 fois).
// Le guillemet double est échappé aussi : sans cela, un nom contenant «"»
// pouvait casser un attribut HTML (ex. alt="...") du document imprimé.
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ⚠ Bandeau "DOCUMENT DE FORMATION" (demande Timo) : même style visuel que
// le bandeau DUPLICATA existant plus bas, réutilisé pour tout document
// (reçu, PV, contrat, bon...) émis depuis une boutique de formation — pour
// qu'il ne soit JAMAIS confondu avec un vrai document, même si le nom de la
// boutique seul n'est pas assez explicite.
const bandeauFormation = (estFormation) => estFormation
  ? `<div style="text-align:center;font-weight:bold;color:#b45309;border:2px dashed #b45309;border-radius:6px;padding:5px;margin:0 auto 10px;max-width:680px;font-family:Arial">🎓 DOCUMENT DE FORMATION — SANS VALEUR</div>`
  : "";

// ============ REÇU CLIENT ============
export function imprimerRecu(v, bq = {}, produits = []) {
  // MODULE GARANTIES : si l'article vendu a une "Garantie boutique"
  // renseignée sur sa fiche produit, on l'ajoute entre parenthèses après le
  // nom — jamais si le champ est vide, pour ne rien changer aux reçus déjà
  // habituels (demande Timo, cahier des charges garanties).
  const garantieBoutiqueDe = (l) => {
    const p = l.produit_id ? produits.find((x) => x.id === l.produit_id) : null;
    return p?.garantie_boutique ? ` (Garantie : ${esc(p.garantie_boutique)})` : "";
  };
  const logo = bq.logo || LOGO;
  const brut = brutVente(v);
  const net = totalVente(v);
  const numero = numeroRecu(v);
  const modes = [
    ["Espèces", /Espèces/i],
    ["Mobile Money", /Mobile Money/i],
    ["Virement", /Virement/i],
    ["Crédit", /Crédit/i],
  ];
  const casesMode = modes
    .map(([lbl, re]) => `<span class="case">${re.test(v.paiement || "") ? "☑" : "☐"} ${lbl}</span>`)
    .join("");

  const html = `
  <style>
  #zone-impression .recu-doc{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;max-width:680px;margin:0 auto}
  #zone-impression .recu-doc .entete{width:100%;border-collapse:collapse}
  #zone-impression .recu-doc .entete td{vertical-align:middle;padding:0 0 8px 0}
  #zone-impression .recu-doc .entete img{max-width:150px;max-height:110px;object-fit:contain}
  #zone-impression .recu-doc .soc{text-align:right;line-height:1.5}
  #zone-impression .recu-doc .soc .nom{font-size:20px;font-weight:bold;color:#1e5a8a}
  #zone-impression .recu-doc .soc .marque{font-size:12px;font-weight:bold;color:#3d8b40}
  #zone-impression .recu-doc h1{text-align:center;font-size:17px;letter-spacing:2px;margin:10px 0 12px;color:#1e5a8a;border-bottom:3px solid #1e5a8a;padding-bottom:8px}
  #zone-impression .recu-doc .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;background:#f2f6fa;border:1px solid #d5e2ee;border-radius:6px;padding:8px 10px;margin-bottom:10px}
  #zone-impression .recu-doc .btitre{font-weight:bold;color:#1e5a8a;border-bottom:1px solid #d5e2ee;margin:10px 0 4px;font-size:12px;letter-spacing:1px}
  #zone-impression .recu-doc .client div{padding:2px 0}
  #zone-impression .recu-doc table.articles{width:100%;border-collapse:collapse;margin:10px 0 6px}
  #zone-impression .recu-doc table.articles th{background:#1e5a8a;color:#fff;padding:6px;font-size:11px;text-align:left}
  #zone-impression .recu-doc table.articles th:not(:first-child),#zone-impression .recu-doc table.articles td:not(:first-child){text-align:right}
  #zone-impression .recu-doc table.articles td{border:1px solid #d5e2ee;padding:6px}
  #zone-impression .recu-doc table.totaux{width:52%;margin-left:auto;border-collapse:collapse}
  #zone-impression .recu-doc table.totaux td{padding:4px 6px}
  #zone-impression .recu-doc table.totaux td:last-child{text-align:right;white-space:nowrap}
  #zone-impression .recu-doc table.totaux tr.total td{border-top:2px solid #1e5a8a;font-weight:bold;font-size:14px;color:#1e5a8a}
  #zone-impression .recu-doc .paiement{margin:12px 0;padding:8px 10px;background:#f2f6fa;border:1px solid #d5e2ee;border-radius:6px}
  #zone-impression .recu-doc .case{margin-right:14px;white-space:nowrap}
  #zone-impression .recu-doc table.sign{width:100%;border-collapse:collapse;margin-top:26px}
  #zone-impression .recu-doc table.sign td{width:33%;text-align:center;font-size:11px;color:#333;padding:0 12px}
  #zone-impression .recu-doc table.sign .ligne{border-top:1px solid #555;padding-top:4px}
  #zone-impression .recu-doc .merci{text-align:center;font-style:italic;color:#555;margin-top:16px;border-top:1px dashed #aaa;padding-top:8px}
  </style>
  <div class="recu-doc">
    ${bandeauFormation(bq.formation)}
    <table class="entete"><tr>
      <td><img src="${logo}" alt="${esc(v.boutique)}"></td>
      <td class="soc">
        <div class="nom">${esc(v.boutique)}</div>
        <div>${esc(bq.adresse || "Lomé, Togo")}</div>
        ${bq.tel ? `<div>Tél : ${esc(bq.tel)}</div>` : ""}
        <div>Email : ${esc(bq.email || "Bmitogo.info@gmail.com")}</div>
        <div>NIF : 1001790098</div>
        <div>RCCM : TG-LFW-01-2022-A10-01523</div>
      </td>
    </tr></table>

    <h1>REÇU DE VENTE</h1>

    <div class="meta">
      <div><b>Numéro de reçu :</b> ${numero}</div>
      ${v.numero_avant_collision ? `<div style="font-size:10px;color:#92400e">Annule et remplace le reçu n° ${esc(v.numero_avant_collision)} (renumérotation après saisie hors ligne simultanée — même vente, même montant).</div>` : ""}
      <div><b>Date :</b> ${dFR(v.date)}</div>
      <div><b>Heure :</b> ${esc(v.heure || "—")}</div>
    </div>

    <div class="btitre">CLIENT</div>
    <div class="client">
      <div><b>Nom :</b> ${esc(v.client || "________________________")}</div>
      <div><b>Téléphone :</b> ${esc(v.tel || "________________________")}</div>
    </div>

    <table class="articles">
      <thead><tr><th>Description</th><th>Quantité</th><th>Prix Unitaire</th><th>Montant</th></tr></thead>
      <tbody>
        ${lignesVente(v).map((l) => { const rl = Number(l.remise_ligne || 0); const net = Number(l.qte) * Number(l.pu) - rl;
          return `<tr><td>${esc(l.article)}${garantieBoutiqueDe(l)}${rl > 0 ? `<br><small style="color:#3d8b40">Remise −${fmt(rl)} (prix normal <s>${fmt(Number(l.qte) * Number(l.pu))}</s>)</small>` : ""}</td><td>${l.qte}</td><td>${fmt(l.pu)}</td><td>${fmt(net)}</td></tr>`; }).join("")}
      </tbody>
    </table>

    <table class="totaux">
      <tr><td>Sous-total articles :</td><td>${fmt(brut)}</td></tr>
      <tr><td>Remise${v.remise_pct ? ` (${v.remise_pct} %)` : ""} :</td><td>${v.remise ? "−" + fmt(v.remise) : fmt(0)}</td></tr>
      ${Number(v.rabais || 0) > 0 ? `<tr><td>Rabais commercial${v.commercial ? ` (${esc(v.commercial)})` : ""} :</td><td>−${fmt(v.rabais)}</td></tr>` : ""}
      ${Number(v.frais_installation || 0) > 0 ? `<tr><td>Frais d'installation :</td><td>${fmt(v.frais_installation)}</td></tr>` : ""}
      ${Number(v.frais_transport || 0) > 0 ? `<tr><td>Transport / livraison :</td><td>${fmt(v.frais_transport)}</td></tr>` : ""}
      <tr class="total"><td>TOTAL TTC :</td><td>${fmt(net + Number(v.frais_installation || 0) + Number(v.frais_transport || 0))}</td></tr>
      ${v.paiement === "Crédit (dette)" ? `<tr><td>Avance versée :</td><td>${fmt(v.avance || 0)}</td></tr><tr class="total"><td>RESTE À PAYER :</td><td>${fmt(Math.max(0, net + Number(v.frais_installation || 0) + Number(v.frais_transport || 0) - (Number(v.avance) || 0)))}</td></tr>` : ""}
    </table>

    <div class="paiement"><b>Mode de paiement :</b><br>${casesMode}<div style="margin-top:4px;font-size:11px;color:#555">${esc(v.paiement || "")}</div></div>

    <table class="sign"><tr>
      <td></td>
      <td><div class="ligne">Vendeur${v.par ? ` : ${esc(v.par)}` : ""}${v.apporteur && v.apporteur.nom ? `<br><span style="font-size:10px;color:#666">Apporté par ${esc(v.apporteur.nom)}</span>` : ""}${Number(v.rabais || 0) > 0 ? `<br><span style="font-size:10px;color:#666">Rabais de ${esc(v.commercial || "")} : ${fmt(v.rabais)}</span>` : ""}</div></td>
      <td></td>
    </tr></table>

    <div class="merci">${esc(bq.message || "Merci pour votre achat ! / Thank you for your purchase!")}</div>
  </div>`;
  // Mode 2 exemplaires (réglage de la boutique dans Paramètres) : le même
  // reçu deux fois — l'exemplaire client d'abord, puis, sur une nouvelle
  // page, la souche boutique marquée DUPLICATA.
  const sortie = bq.recu_duplicata
    ? html +
      `<div class="saut-page" style="break-before:page;page-break-before:always"><div style="text-align:center;font-weight:bold;color:#b45309;border:2px dashed #b45309;border-radius:6px;padding:5px;margin:0 auto 10px;max-width:680px;font-family:Arial">DUPLICATA — EXEMPLAIRE BOUTIQUE</div></div>` +
      html
    : html;
  if (printApi) printApi.open(sortie, `Reçu ${v.numero || ""}`.trim());
}

// ============ PROFORMA (aperçu avant impression, pas de téléchargement direct) ============
// Même base visuelle que le reçu de vente : titre souligné (pas de pavé plein),
// bandeaux clairs, en-têtes de tableau bleus, total en bordure — sobre à
// l'impression maintenant que les couleurs sortent réellement sur papier.
// ============ REÇU DE VERSEMENT (dette / réservation prépayée) ============
// Émis à CHAQUE versement partiel (demande Timo) : reprend tout l'historique
// des versements déjà faits (celui du jour compris), pas seulement le
// dernier — pour que le client ait toujours, en main, la preuve complète de
// ce qu'il a déjà payé. Quand le versement solde la dette (reste = 0), le
// document devient automatiquement le REÇU DÉFINITIF plutôt qu'un simple
// reçu de versement de plus.
export function imprimerRecuVersement(d, bq = {}) {
  const logo = bq.logo || LOGO;
  const montantDu = Number(d.montant || 0);
  const totalVerse = Number(d.paye || 0);
  const reste = Math.max(0, montantDu - totalVerse);
  const solde = reste <= 0;
  const paiements = d.paiements || [];
  const dernier = paiements[paiements.length - 1];

  const html = `
  <style>
  #zone-impression .recu-doc{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;max-width:680px;margin:0 auto}
  #zone-impression .recu-doc .entete{width:100%;border-collapse:collapse}
  #zone-impression .recu-doc .entete td{vertical-align:middle;padding:0 0 8px 0}
  #zone-impression .recu-doc .entete img{max-width:150px;max-height:110px;object-fit:contain}
  #zone-impression .recu-doc .soc{text-align:right;line-height:1.5}
  #zone-impression .recu-doc .soc .nom{font-size:20px;font-weight:bold;color:#1e5a8a}
  #zone-impression .recu-doc h1{text-align:center;font-size:17px;letter-spacing:2px;margin:10px 0 12px;color:#1e5a8a;border-bottom:3px solid #1e5a8a;padding-bottom:8px}
  #zone-impression .recu-doc h1.solde{color:#166534;border-bottom-color:#166534}
  #zone-impression .recu-doc .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;background:#f2f6fa;border:1px solid #d5e2ee;border-radius:6px;padding:8px 10px;margin-bottom:10px}
  #zone-impression .recu-doc .btitre{font-weight:bold;color:#1e5a8a;border-bottom:1px solid #d5e2ee;margin:10px 0 4px;font-size:12px;letter-spacing:1px}
  #zone-impression .recu-doc .client div{padding:2px 0}
  #zone-impression .recu-doc table.articles{width:100%;border-collapse:collapse;margin:10px 0 6px}
  #zone-impression .recu-doc table.articles th{background:#1e5a8a;color:#fff;padding:6px;font-size:11px;text-align:left}
  #zone-impression .recu-doc table.articles th:not(:first-child),#zone-impression .recu-doc table.articles td:not(:first-child){text-align:right}
  #zone-impression .recu-doc table.articles td{border:1px solid #d5e2ee;padding:6px}
  #zone-impression .recu-doc table.articles tr.jour td{background:#f2f6fa;font-weight:bold}
  #zone-impression .recu-doc table.totaux{width:60%;margin-left:auto;border-collapse:collapse}
  #zone-impression .recu-doc table.totaux td{padding:4px 6px}
  #zone-impression .recu-doc table.totaux td:last-child{text-align:right;white-space:nowrap}
  #zone-impression .recu-doc table.totaux tr.total td{border-top:2px solid #1e5a8a;font-weight:bold;font-size:14px;color:#1e5a8a}
  #zone-impression .recu-doc table.totaux tr.solde td{border-top:2px solid #166534;font-weight:bold;font-size:14px;color:#166534}
  #zone-impression .recu-doc .bandeau-solde{margin:12px 0;padding:10px;background:#f0fdf4;border:2px solid #166534;border-radius:6px;text-align:center;font-weight:bold;color:#166534;letter-spacing:1px}
  #zone-impression .recu-doc .bandeau-livree{margin:12px 0;padding:10px;background:#eff6ff;border:2px solid #1e5a8a;border-radius:6px;text-align:center;font-weight:bold;color:#1e5a8a;letter-spacing:1px}
  #zone-impression .recu-doc table.sign{width:100%;border-collapse:collapse;margin-top:26px}
  #zone-impression .recu-doc table.sign td{width:33%;text-align:center;font-size:11px;color:#333;padding:0 12px}
  #zone-impression .recu-doc table.sign .ligne{border-top:1px solid #555;padding-top:4px}
  #zone-impression .recu-doc .merci{text-align:center;font-style:italic;color:#555;margin-top:16px;border-top:1px dashed #aaa;padding-top:8px}
  #zone-impression .recu-doc{position:relative}
  #zone-impression .recu-doc .filigrane{position:absolute;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-28deg);font-size:56px;font-weight:900;letter-spacing:6px;color:#dc2626;opacity:0.18;white-space:nowrap;pointer-events:none;z-index:1;user-select:none}
  </style>
  <div class="recu-doc">
    ${bandeauFormation(bq.formation)}
    ${estReservation(d) && d.statut !== "livree" ? `<div class="filigrane">NON LIVRÉ</div>` : ""}
    <table class="entete"><tr>
      <td><img src="${logo}" alt="${esc(d.boutique)}"></td>
      <td class="soc">
        <div class="nom">${esc(d.boutique)}</div>
        <div>${esc(bq.adresse || "Lomé, Togo")}</div>
        ${bq.tel ? `<div>Tél : ${esc(bq.tel)}</div>` : ""}
        <div>Email : ${esc(bq.email || "Bmitogo.info@gmail.com")}</div>
        <div>NIF : 1001790098</div>
        <div>RCCM : TG-LFW-01-2022-A10-01523</div>
      </td>
    </tr></table>

    <h1${solde ? ' class="solde"' : ""}>${solde ? "REÇU DÉFINITIF — DETTE SOLDÉE" : "REÇU DE VERSEMENT"}</h1>

    <div class="meta">
      <div><b>N° de reçu :</b> ${esc(numeroRecuDette(d))}</div>
      <div><b>Date du versement :</b> ${dFR(dernier?.date || d.date)}${dernier?.heure ? ` à ${dernier.heure}` : ""}</div>
      <div><b>Reçu par :</b> ${esc(dernier?.par || d.par || "—")}</div>
    </div>

    <div class="btitre">CLIENT</div>
    <div class="client">
      <div><b>Nom :</b> ${esc(d.client || "________________________")}</div>
      <div><b>Téléphone :</b> ${esc(d.tel || "________________________")}</div>
      <div><b>Motif :</b> ${(d.articles && d.articles.length > 0) ? (estReservation(d) ? "Réservation" : "Vente à crédit") : esc(d.motif || "—")}</div>
    </div>

    ${(d.articles && d.articles.length > 0) ? `
    <div class="btitre">ARTICLES</div>
    <table class="articles">
      <thead><tr><th>Description</th><th>Quantité</th><th>Prix Unitaire</th><th>Montant</th></tr></thead>
      <tbody>
        ${d.articles.map((l) => `<tr><td>${esc(l.nom || l.article || "")}</td><td>${l.qte}</td><td>${fmt(l.pu)}</td><td>${fmt(Number(l.qte) * Number(l.pu) - Number(l.remise_ligne || 0))}</td></tr>`).join("")}
      </tbody>
    </table>` : ""}

    <div class="btitre">HISTORIQUE DES VERSEMENTS</div>
    <table class="articles">
      <thead><tr><th>Date</th><th>Moyen</th><th>Reçu par</th><th>Montant</th></tr></thead>
      <tbody>
        ${paiements.map((p, i) => `<tr${p === dernier && i === paiements.length - 1 ? ' class="jour"' : ""}><td>${dFR(p.date)}${p.heure ? ` ${p.heure}` : ""}</td><td>${esc(p.paiement || "—")}</td><td>${esc(p.par || "—")}</td><td>${fmt(p.montant)}</td></tr>`).join("")}
      </tbody>
    </table>

    <table class="totaux">
      <tr><td>Montant total dû :</td><td>${fmt(montantDu)}</td></tr>
      <tr class="${solde ? "solde" : "total"}"><td>Total versé à ce jour :</td><td>${fmt(totalVerse)}</td></tr>
      ${!solde ? `<tr class="total"><td>RESTE À PAYER :</td><td>${fmt(reste)}</td></tr>` : ""}
    </table>

    ${solde ? `<div class="bandeau-solde">✔ CETTE DETTE EST INTÉGRALEMENT SOLDÉE — AUCUN MONTANT NE RESTE DÛ</div>` : ""}

    ${d.vente_id ? `<div class="bandeau-livree">📦 MARCHANDISE DÉJÀ LIVRÉE${d.date_livraison ? ` LE ${dFR(d.date_livraison)}` : ""}</div>` : ""}

    <table class="sign"><tr>
      <td></td>
      <td><div class="ligne">Reçu par${dernier?.par ? ` : ${esc(dernier.par)}` : ""}</div></td>
      <td></td>
    </tr></table>

    <div class="merci">${esc(bq.message || "Merci pour votre confiance !")}</div>
  </div>`;
  // Même mécanisme de duplicata que le reçu de vente (imprimerRecu) — couvre
  // à la fois les versements sur dette classique ET sur réservation, puisque
  // les deux passent par cette même fonction. Trouvé manquant ici par Timo :
  // le réglage boutique existait déjà, juste jamais branché sur ce reçu-là.
  const sortie = bq.recu_duplicata
    ? html +
      `<div class="saut-page" style="break-before:page;page-break-before:always"><div style="text-align:center;font-weight:bold;color:#b45309;border:2px dashed #b45309;border-radius:6px;padding:5px;margin:0 auto 10px;max-width:680px;font-family:Arial">DUPLICATA — EXEMPLAIRE BOUTIQUE</div></div>` +
      html
    : html;
  if (printApi) printApi.open(sortie, `Reçu ${d.numero || ""}`.trim());
}

export function imprimerProforma(p, logo, estFormation = false) {
  const html = `
  <style>
  #zone-impression .prf-doc{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;max-width:680px;margin:0 auto}
  #zone-impression .prf-doc .entete{width:100%;border-collapse:collapse}
  #zone-impression .prf-doc .entete td{vertical-align:middle;padding:0 0 8px 0}
  #zone-impression .prf-doc .entete img{max-width:150px;max-height:110px;object-fit:contain}
  #zone-impression .prf-doc .soc{text-align:right;line-height:1.5}
  #zone-impression .prf-doc .soc .nom{font-size:20px;font-weight:bold;color:#1e5a8a}
  #zone-impression .prf-doc .soc .marque{font-size:12px;font-weight:bold;color:#3d8b40}
  #zone-impression .prf-doc h1{text-align:center;font-size:17px;letter-spacing:2px;margin:10px 0 12px;color:#1e5a8a;border-bottom:3px solid #1e5a8a;padding-bottom:8px}
  #zone-impression .prf-doc .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;background:#f2f6fa;border:1px solid #d5e2ee;border-radius:6px;padding:8px 10px;margin-bottom:10px}
  #zone-impression .prf-doc .btitre{font-weight:bold;color:#1e5a8a;border-bottom:1px solid #d5e2ee;margin:10px 0 4px;font-size:12px;letter-spacing:1px}
  #zone-impression .prf-doc .client div{padding:2px 0}
  #zone-impression .prf-doc table.articles{width:100%;border-collapse:collapse;margin:10px 0 6px}
  #zone-impression .prf-doc table.articles th{background:#1e5a8a;color:#fff;padding:6px;font-size:11px;text-align:left}
  #zone-impression .prf-doc table.articles th:not(:first-child),#zone-impression .prf-doc table.articles td:not(:first-child){text-align:right}
  #zone-impression .prf-doc table.articles td{border:1px solid #d5e2ee;padding:6px}
  #zone-impression .prf-doc table.totaux{width:52%;margin-left:auto;border-collapse:collapse}
  #zone-impression .prf-doc table.totaux td{padding:6px}
  #zone-impression .prf-doc table.totaux tr.total td{border-top:2px solid #1e5a8a;font-weight:bold;font-size:14px;color:#1e5a8a}
  #zone-impression .prf-doc .mentions{margin-top:16px;font-size:10px;color:#555;font-style:italic;text-align:center;border-top:1px dashed #aaa;padding-top:8px}
  </style>
  <div class="prf-doc">
    ${bandeauFormation(estFormation)}
    <table class="entete"><tr>
      <td><img src="${logo}" alt="BMI" /></td>
      <td class="soc"><div class="nom">BMI TOGO</div><div>Lomé, Togo</div><div>NIF : 1001790098</div><div>RCCM : TG-LFW-01-2022-A10-01523</div></td>
    </tr></table>
    <h1>FACTURE PROFORMA</h1>
    <div class="meta">
      <div><b>N° :</b> ${esc(p.numero)}</div>
      <div><b>Date :</b> ${esc(p.date)}</div>
      ${p.boutique ? `<div><b>Boutique :</b> ${esc(p.boutique)}</div>` : ""}
    </div>
    <div class="btitre">CLIENT</div>
    <div class="client">
      <div><b>${esc(p.client || "—")}</b></div>
      ${p.tel ? `<div>Tél : ${esc(p.tel)}</div>` : ""}
    </div>
    <table class="articles">
      <thead><tr><th>Article</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead>
      <tbody>
        ${p.lignes.map((l) => { const rl = Number(l.remise_ligne || 0);
          return `<tr><td>${esc(l.article)}${rl > 0 ? `<br><small style="color:#3d8b40">Remise −${fmt(rl)} (prix normal <s>${fmt(Number(l.qte) * Number(l.pu))}</s>)</small>` : ""}</td><td>${l.qte}</td><td>${fmt(l.pu)}</td><td>${fmt(l.total)}</td></tr>`; }).join("")}
      </tbody>
    </table>
    <table class="totaux">
      ${Number(p.remise_montant || 0) > 0 ? `<tr><td>Sous-total</td><td style="text-align:right">${fmt(p.sous_total)}</td></tr>
      <tr><td style="color:#3d8b40">Remise ${p.remise_pct} %</td><td style="text-align:right;color:#3d8b40">-${fmt(p.remise_montant)}</td></tr>` : ""}
      <tr class="total"><td>TOTAL</td><td style="text-align:right">${fmt(p.total)} FCFA</td></tr>
    </table>
    <div class="mentions">
      Ce document est une facture proforma : il constitue une offre de prix et n'a pas de valeur comptable.<br>
      Il ne vaut pas reçu de paiement. Prix indicatifs, susceptibles de variation.${p.validite ? ` Offre valable ${esc(p.validite)}.` : ""}
    </div>
  </div>`;
  if (printApi) printApi.open(html, `Proforma ${p.numero || ""}`.trim());
}

// ============ CONTRAT DE RÉCEPTION DE PRESTATION ============
// Même base visuelle que la proforma/le reçu. Le montant est le VRAI total
// de la vente d'origine (équipements + installation), pas seulement les
// frais d'installation — demande Timo. La signature (image, écrite par la
// page bmitogo.com au moment où le client signe) est intégrée si présente ;
// sinon la zone reste vide (contrat pas encore signé, ou réception forcée
// sans signature — cas exceptionnel, déjà signalé par ailleurs sur la fiche).
// ============ PROCÈS-VERBAL DE RÉCEPTION (ex-"imprimerContrat" — mal
// nommé à l'origine, corrigé sur demande de Timo : ce document constate la
// RÉCEPTION en fin de chantier, ce n'est pas le contrat signé avant
// travaux). Enrichi du matériel posé (avec numéros de série si connus,
// déjà saisi sur la fiche du chantier — jamais affiché avant) et du chef
// d'équipe qui l'a constaté. ============
export function imprimerPV(c, db) {
  const vente = db.ventes.find((v) => v.id === c.vente_id);
  const montant = vente ? totalVente(vente) : Number(c.frais_installation || 0);
  // ⚠ Boutique du chantier (demande Timo — bandeau formation) : via la
  // vente si elle existe, sinon via la dette liée (chantier "pose seule",
  // qui n'a ni commande ni vente — voir la chaîne établie ailleurs).
  const detteC = c.dette_id ? (db.dettes || []).find((x) => x.id === c.dette_id) : null;
  const boutiqueDuChantier = vente?.boutique || detteC?.boutique;
  const estFormationPv = (db.boutiques || []).find((b) => b.nom === boutiqueDuChantier)?.formation;
  const avenant = c.avenant_statut === "signe";
  const chef = (c.equipe || []).find((e) => e.chef);
  const chefCompte = chef ? (db.users || []).find((u) => u.nom === chef.nom) : null;
  const cachet = (db.boutiques || []).find((b) => b.cachet_bmi)?.cachet_bmi || CACHET_BMI_DEFAUT;
  // Identification du projet (Timo, après relecture ChatGPT) : relie le PV
  // au reste du dossier — n° de vente/facture, et n° du contrat
  // d'installation signé avant travaux, retrouvé via la chaîne
  // vente → commande → devis (aucun champ direct, jamais construit avant).
  const commande = vente?.commande_id ? (db.commandes || []).find((cm) => cm.id === vente.commande_id) : null;
  const devisOrigine = commande?.devis_id
    ? (db.users || []).flatMap((u) => u.devis || []).find((d) => d.id === commande.devis_id)
    : null;
  const dateSignature = avenant ? c.avenant_date_signature : (c.contrat_date_signature || c.contrat_force_le);
  const heureSignature = dateSignature && dateSignature.includes("T") ? dateSignature.slice(11, 16) : "";
  const html = `
  <style>
  #zone-impression .ctr-doc{font-family:Arial,Helvetica,sans-serif;font-size:11.5px;color:#111;max-width:680px;margin:0 auto;line-height:1.45}
  #zone-impression .ctr-doc .entete{width:100%;border-collapse:collapse}
  #zone-impression .ctr-doc .entete td{vertical-align:middle;padding:0 0 6px 0}
  #zone-impression .ctr-doc .entete img{max-width:130px;max-height:90px;object-fit:contain}
  #zone-impression .ctr-doc .soc{text-align:right;line-height:1.4}
  #zone-impression .ctr-doc .soc .nom{font-size:18px;font-weight:bold;color:#1e5a8a}
  #zone-impression .ctr-doc h1{text-align:center;font-size:15px;letter-spacing:1.5px;margin:6px 0 10px;color:#1e5a8a;border-bottom:3px solid #1e5a8a;padding-bottom:6px}
  #zone-impression .ctr-doc .art{margin:7px 0}
  #zone-impression .ctr-doc .art b{color:#1e5a8a}
  #zone-impression .ctr-doc .etat{background:#f2f6fa;border:1px solid #d5e2ee;border-radius:6px;padding:6px 9px;margin:6px 0}
  #zone-impression .ctr-doc .reserve{color:#b91c1c;font-weight:bold}
  /* ⚠ Signature en TABLEAU plutôt qu'en flexbox — même choix que l'en-tête
     ci-dessus, plus fiable à l'impression réelle (Timo a signalé le cachet
     absent du document imprimé — le tableau ne dépend d'aucun calcul de
     largeur flexible qui pourrait être mal interprété par le moteur
     d'impression). page-break-inside:avoid garde toute la ligne de
     signature ensemble, jamais coupée entre deux pages. */
  #zone-impression .ctr-doc .sig3{width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid;break-inside:avoid}
  #zone-impression .ctr-doc .sig3 td{vertical-align:bottom;text-align:center;font-size:11px;padding:0}
  #zone-impression .ctr-doc .sig3-head{font-weight:bold;margin-bottom:4px}
  #zone-impression .ctr-doc .sig3 td:first-child{width:150px}
  #zone-impression .ctr-doc .sig3 td:nth-child(2){width:110px;padding-right:30px}
  #zone-impression .ctr-doc .sig3-col img.signature{max-height:50px;display:block;margin:5px auto 2px}
  #zone-impression .ctr-doc .sig3-col .ligne{border-top:1px solid #333;padding-top:4px;margin-top:4px}
  #zone-impression .ctr-doc .sig3-cachet img{max-width:110px;opacity:0.9}
  #zone-impression .ctr-doc .mentions{margin-top:10px;font-size:9.5px;color:#555;font-style:italic;text-align:center;border-top:1px dashed #aaa;padding-top:6px}
  </style>
  <div class="ctr-doc">
    ${bandeauFormation(estFormationPv)}
    <table class="entete"><tr>
      <td><img src="${LOGO}" alt="BMI" /></td>
      <td class="soc"><div class="nom">BMI TOGO</div><div>Lomé, Togo</div><div>NIF : 1001790098</div><div>RCCM : TG-LFW-01-2022-A10-01523</div></td>
    </tr></table>
    <h1>${avenant ? "AVENANT AU PROCÈS-VERBAL DE RÉCEPTION" : "PROCÈS-VERBAL DE RÉCEPTION"}${c.contrat_numero ? ` N° ${esc(c.contrat_numero)}` : ""}</h1>

    <div class="art">Entre <b>BMI Togo</b> (Les Bâtiments Modernes et Intelligents), NIF 1001790098, RCCM TG-LFW-01-2022-A10-01523, ci-après « le Prestataire »,<br>
    Et <b>${esc(c.prenom)} ${esc(c.nom)}</b>${c.tel ? `, tél. ${esc(c.tel)}` : ""}, ci-après « le Client »,</div>

    ${avenant ? `
    <div class="art"><b>Objet.</b> Le présent avenant constate que les réserves émises lors de la réception initiale (contrat N° ${esc(c.contrat_numero || "—")}) ont été corrigées par le Prestataire, à savoir : <i>${esc(c.contrat_reserve_texte || "—")}</i>. En signant, le Client confirme la réception définitive, sans réserve, de la prestation.</div>
    ` : `
    <div class="art"><b>Article 1 — Objet.</b> Le présent procès-verbal constate la réception, par le Client, des travaux de <b>${esc(c.type_installation)}</b> réalisés à l'adresse suivante : <b>${esc(c.adresse_contrat || "—")}</b>, pour un montant total de <b>${fmt(montant)} FCFA</b>.
    <div style="margin-top:6px;font-size:11px;color:#555">Identification du dossier — ${devisOrigine?.contrat_numero ? `N° du contrat d'installation : ${esc(devisOrigine.contrat_numero)} · ` : ""}${vente?.numero ? `N° de facture : ${esc(vente.numero)}` : "N° de facture : —"}</div></div>
    <div class="art"><b>Article 2 — Matériel installé${c.pose_seule ? " (fourni par le Client)" : ""}.</b> ${(c.materiel || []).length > 0
      ? `<ul style="margin:6px 0 0 18px;padding:0">${c.materiel.map((m) => `<li>${esc(m.nom)} — quantité : ${esc(m.qte)}${m.serie ? ` — N° de série : ${esc(m.serie)}` : ""}</li>`).join("")}</ul>`
      : "Liste du matériel non renseignée."}${c.pose_seule ? `<div style="margin-top:6px;font-size:11px;color:#555">Ce matériel a été fourni par le Client — BMI Togo n'assure que la pose (voir Article 6 du contrat de prestation de pose).</div>` : ""}${chef ? `<div style="margin-top:6px;font-size:11px;color:#555">Constaté par ${esc(chef.nom)}, chef d'équipe.</div>` : ""}</div>
    <div class="art etat"><b>Article 3 — État de la réception.</b> ${c.contrat_reserve_texte
      ? `Le Client accepte les travaux <span class="reserve">avec les réserves suivantes</span>, que le Prestataire s'engage à corriger${c.reserves_delai ? ` avant le <b>${dFR(c.reserves_delai)}</b>` : " dans un délai raisonnable"} : <i>${esc(c.contrat_reserve_texte)}</i>.`
      : "Le Client reconnaît que les travaux sont entièrement achevés conformément au devis accepté, testés en sa présence, et réceptionnés <b>sans réserve</b>."} Les documents remis (fiches techniques, consignes d'utilisation et de sécurité) ont été transmis au Client, conformément à l'Article 2 du contrat d'installation.</div>
    <div class="art"><b>Article 4 — Garantie.</b> Le Prestataire garantit les équipements installés contre tout défaut de fabrication ou d'installation pour une durée de <b>${esc(c.garantie_mois || "24")} mois</b> à compter de la date de signature, hors usure normale, mauvaise utilisation, ou intervention d'un tiers non autorisé.</div>
    <div class="art"><b>Article 5 — Transfert de responsabilité.</b> À compter de la signature du présent procès-verbal, l'installation est réputée réceptionnée. La garde, l'utilisation et l'entretien de l'installation sont transférés au Client, sous réserve des garanties prévues à l'Article 4.</div>
    <div class="art"><b>Article 6 — Signature.</b> En signant ci-dessous, le Client reconnaît avoir vérifié la conformité des travaux et accepte les termes du présent procès-verbal.</div>
    `}

    <div class="art">Fait à Lomé, le ${dFR(dateSignature)}${heureSignature ? ` à ${heureSignature}` : ""}.${!avenant && c.date_entretien ? ` Prochain entretien recommandé : ${dFR(c.date_entretien)}.` : ""}</div>

    <table class="sig3"><tr>
      <td class="sig3-col">
        <div class="sig3-head">POUR BMI</div>
        Chef d'équipe
        ${chefCompte?.signature_personnelle ? `<img class="signature" src="${chefCompte.signature_personnelle}" alt="Signature" />` : "<br><br>"}
        <div class="ligne">${chef ? esc(chef.nom) : "Nom du chef d'équipe"}</div>
      </td>
      <td class="sig3-cachet">
        <img src="${cachet}" alt="Cachet BMI Togo" />
      </td>
      <td class="sig3-col">
        <div class="sig3-head">LE CLIENT</div>
        ${c.contrat_force_par
          ? `<div style="color:#b91c1c;font-weight:bold;font-size:10px">⚠ Réceptionné sans signature<br>(forcé par ${esc(c.contrat_force_par)})</div>`
          : (avenant ? c.avenant_signature : c.contrat_signature)
            ? `<img class="signature" src="${avenant ? c.avenant_signature : c.contrat_signature}" alt="Signature" />`
            : "<br><br>(en attente)"}
        <div class="ligne">${esc(c.prenom)} ${esc(c.nom)}</div>
      </td>
    </tr></table>

    <div class="mentions">Document généré automatiquement — BMI-Gestion-Boutiques.</div>
  </div>`;
  if (printApi) printApi.open(html, `${avenant ? "Avenant" : "PV"} ${c.contrat_numero || ""}`.trim());
}

// ============ CONTRAT D'INSTALLATION (avant travaux, lu+signé à la
// validation du devis) — distinct du imprimerContrat ci-dessus, qui sert
// le PROCÈS-VERBAL DE RÉCEPTION (fin de chantier). Même style visuel que
// les autres documents, mêmes 8 articles que ceux lus/signés dans
// EspaceClient.jsx — permet au client de retélécharger son contrat depuis
// son espace, à tout moment après signature (demande Timo). ============
// Le texte du contrat, tel qu'il s'imprime — aussi affiché à l'écran du
// vendeur quand le client signe en boutique (TousLesDevis), pour ne pas
// avoir une TROISIÈME copie du contrat.
export function htmlContratInstallation(d, db) {
  const client = (db.users || []).find((u) => (u.devis || []).some((x) => x.id === d.id));
  // Cachet BMI Togo (2.99.29) : un seul cachet pour toute l'entreprise, quel
  // que soit l'initiateur — stocké sur chaque boutique (broadcast), comme
  // l'image d'accueil de l'écran de connexion. Signature de l'initiateur :
  // retrouvée via d.par (le nom saisi sur le devis) plutôt que par id, car
  // c'est déjà ainsi que le devis identifie qui l'a créé.
  // Cachet BMI Togo : celui uploadé par l'admin (Paramètres) a priorité s'il
  // existe, sinon le VRAI cachet extrait du modèle Word fourni par Timo sert
  // de valeur par défaut — l'app a donc toujours un cachet correct, sans
  // dépendre d'un upload préalable.
  const cachet = (db.boutiques || []).find((b) => b.cachet_bmi)?.cachet_bmi || CACHET_BMI_DEFAUT;
  const initiateur = (db.users || []).find((u) => u.nom === d.par);
  // ⚠ Boutique du contrat (demande Timo — bandeau formation) : celle de la
  // personne qui a créé le devis (initiateur), faute d'un champ boutique
  // direct sur le devis lui-même avant toute vente.
  const estFormationContrat = (db.boutiques || []).find((b) => b.nom === initiateur?.boutique)?.formation;
  // Libellé du rôle affiché à la place de "Pour BMI Togo" — demande Timo sur
  // la base d'un vrai modèle Word qu'il a fourni ("Le (rôle de l'initiateur
  // du devis)"). Rôles pouvant initier un devis, cf. ONGLETS_ROLE.
  const LIBELLE_ROLE_CONTRAT = { commercial: "Le Commercial", vendeur: "Le Vendeur", technicien: "Le Technicien", technicien_bmi: "Le Technicien", gerant: "Le Gérant", admin: "L'Administrateur", resp_commercial: "Le Responsable Commercial" };
  const libelleRoleInitiateur = LIBELLE_ROLE_CONTRAT[initiateur?.role] || "Pour BMI Togo";
  const garanties = (d.panier || [])
    .map((l) => (db.produits || []).find((p) => p.id === l.produit_id))
    .filter((p) => p?.garantie_fabricant)
    .map((p) => `${esc(p.nom)} : garantie fabricant ${esc(p.garantie_fabricant)}${p.conditions_garantie ? ` (${esc(p.conditions_garantie)})` : ""}`);
  // Liste complète des équipements du devis (pas seulement ceux garantis) —
  // pour l'Article 1, périmètre exact de la prestation (relecture ChatGPT,
  // demande Timo). Reprend le panier tel quel, comme le fait déjà le PV
  // pour le matériel réellement posé.
  const listeEquipements = (d.panier || []).map((l) => `${esc(l.article)} — quantité : ${esc(l.qte)}`);
  // ⚠ "Pose seule" (2.99.97) : le panier peut contenir du matériel VENDU
  // par BMI en plus de la pose (ex. disjoncteurs) — l'Article 1 disait à
  // tort "aucun équipement fourni" même dans ce cas (signalé par Timo).
  // Séparé du reste du panier via la catégorie "Installation" (= la ligne
  // de pose elle-même, jamais un vrai équipement).
  const equipementsBMI = (d.panier || []).filter((l) => l.categorie !== "Installation");
  const totalEquipementsBMI = equipementsBMI.reduce((s, l) => s + Number(l.total || 0), 0);
  const estSolaire = d.type_devis !== "garage" && d.type_devis !== "autre";
  const montantAcompte = Number(d.montant_acompte ?? d.total);
  const pctAcompteAffiche = Number(d.pct_acompte ?? 100);
  const html = `
  <style>
  #zone-impression .ctr-doc{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;max-width:680px;margin:0 auto;line-height:1.6}
  #zone-impression .ctr-doc .entete{width:100%;border-collapse:collapse}
  #zone-impression .ctr-doc .entete td{vertical-align:middle;padding:0 0 8px 0}
  #zone-impression .ctr-doc .entete img{max-width:150px;max-height:110px;object-fit:contain}
  #zone-impression .ctr-doc .soc{text-align:right;line-height:1.5}
  #zone-impression .ctr-doc .soc .nom{font-size:20px;font-weight:bold;color:#1e5a8a}
  #zone-impression .ctr-doc h1{text-align:center;font-size:16px;letter-spacing:1.5px;margin:10px 0 14px;color:#1e5a8a;border-bottom:3px solid #1e5a8a;padding-bottom:8px}
  #zone-impression .ctr-doc .art{margin:12px 0}
  #zone-impression .ctr-doc .art b{color:#1e5a8a}
  #zone-impression .ctr-doc .sig3-row{display:flex;align-items:flex-end;gap:6px;margin-top:22px}
  #zone-impression .ctr-doc .sig3-head{font-weight:bold;margin-bottom:4px}
  #zone-impression .ctr-doc .sig3-col{text-align:center;font-size:11px}
  #zone-impression .ctr-doc .sig3-col:first-child{flex:0 0 150px}
  #zone-impression .ctr-doc .sig3-col:last-child{flex:1}
  #zone-impression .ctr-doc .sig3-col img.signature{max-height:55px;display:block;margin:6px auto 2px}
  #zone-impression .ctr-doc .sig3-col .ligne{border-top:1px solid #333;padding-top:4px;margin-top:4px}
  #zone-impression .ctr-doc .sig3-cachet{flex:0 0 110px;text-align:center;margin-right:30px}
  #zone-impression .ctr-doc .sig3-cachet img{max-width:120px;opacity:0.9}
  #zone-impression .ctr-doc .mentions{margin-top:16px;font-size:10px;color:#555;font-style:italic;text-align:center;border-top:1px dashed #aaa;padding-top:8px}
  </style>
  <div class="ctr-doc">
    ${bandeauFormation(estFormationContrat)}
    <table class="entete"><tr>
      <td><img src="${LOGO}" alt="BMI" /></td>
      <td class="soc"><div class="nom">BMI TOGO</div><div>E-mail : info@bmitogo.com</div><div>NIF : 1001790098 · RCCM : TG-LFW-01-2022-A10-01523</div><div>Représenté par Mr EGBAOU Essozimna</div></td>
    </tr></table>
    <h1>${d.pose_seule ? "CONTRAT DE PRESTATION DE POSE" : `CONTRAT DE FOURNITURE D'INSTALLATION${d.type_devis === "garage" ? " D'UN SYSTEME DE MOTORISATION" : d.type_devis === "autre" ? "" : " D'UN SYSTEME SOLAIRE PHOTOVOLTAIQUE"}`}${d.contrat_numero ? ` N° ${esc(d.contrat_numero)}` : ""}</h1>

    <div class="art">Date : ${dFR(d.contrat_date_signature)}</div>
    <div class="art">Entre les soussignés :</div>
    <div class="art">BMI (Bâtiments Modernes et Intelligents) E-mail : info@bmitogo.com ; NIF : 1001790098 · RCCM : TG-LFW-01-2022-A10-01523 ; représenté par Mr EGBAOU Essozimna</div>
    <div class="art">Et :</div>
    <div class="art">Mr/Mme : ${esc(client?.nom || "")}${client?.tel ? `, tél. ${esc(client.tel)}` : ""}</div>

    ${d.pose_seule ? `
    <div class="art"><b>Article 1 — Objet.</b> Le présent contrat a pour objet la prestation de pose, d'installation, d'essais et de mise en service d'équipements <b>fournis par le Client</b>${totalEquipementsBMI > 0 ? `, ainsi que la fourniture des équipements complémentaires listés ci-dessous` : ""}, pour un <b>montant total dû à BMI TOGO de ${fmt(d.total)} FCFA</b>, se décomposant comme suit : main d'œuvre de pose — <b>${fmt(d.total - totalEquipementsBMI)} FCFA</b>${totalEquipementsBMI > 0 ? ` ; équipements fournis par BMI TOGO — <b>${fmt(totalEquipementsBMI)} FCFA</b>` : ""}. <b>Ce montant ne comprend pas le coût des équipements que le Client a acquis par ailleurs, hors du présent contrat.</b> Le Client déclare avoir acquis lui-même le matériel principal à installer, dont la liste figure en annexe ou sera constatée sur le procès-verbal de réception.
    ${totalEquipementsBMI > 0 ? `<div style="margin-top:6px"><b>Équipements fournis par BMI TOGO :</b><ul style="margin:6px 0 0 18px;padding:0">${equipementsBMI.map((l) => `<li>${esc(l.article)} — quantité : ${esc(l.qte)}</li>`).join("")}</ul></div>` : ""}</div>
    ${totalEquipementsBMI > 0 ? `
    <div class="art"><b>Article 1 bis — Garantie, propriété et risques des équipements fournis par BMI TOGO.</b> ${garanties.length > 0 ? garanties.join(" ; ") + "." : "Selon la garantie fabricant de chaque équipement, le cas échéant."} Ces équipements demeurent la propriété de BMI TOGO jusqu'au paiement intégral du prix convenu ; les risques de perte, vol ou détérioration les concernant sont transférés au Client à compter de leur livraison ou de leur installation. Ces dispositions ne s'appliquent en aucun cas au matériel apporté par le Client lui-même (Article 2).</div>
    ` : ""}
    <div class="art"><b>Article 2 — Origine et conformité du matériel.</b> Le Client garantit que les équipements fournis sont neufs ou en bon état de fonctionnement, conformes à l'usage prévu, et compatibles entre eux. Le Prestataire se réserve le droit de refuser la pose d'un équipement qu'il jugerait manifestement défectueux, non conforme aux normes de sécurité, ou incompatible avec l'installation prévue — sans que ce refus n'engage sa responsabilité.</div>
    <div class="art"><b>Article 3 — Documents remis.</b> BMI TOGO remettra au Client les consignes d'utilisation et de sécurité relatives à la pose réalisée.</div>
    <div class="art"><b>Article 4 — Modalités de paiement.</b> Le montant de la prestation, fixé au présent contrat, est payable à <b>70 % avant le début des travaux</b> et les <b>30 % restants à la signature du procès-verbal de réception</b>, qui constate l'achèvement des travaux. Le Client s'engage à régler ce solde au moment de cette signature, ou dans les <b>3 jours</b> qui suivent au plus tard.</div>
    <div class="art"><b>Article 5 — Délai d'exécution.</b> Les travaux seront exécutés dans un délai indicatif de <b>${esc(d.delai_installation) || "à convenir avec le Client"}</b> à compter de la signature du présent contrat ou de la mise à disposition effective du matériel par le Client, selon la dernière de ces deux dates. Ce délai pourra être prolongé en cas de force majeure, de retard imputable au Client, ou de mise à disposition tardive du matériel.</div>
    <div class="art"><b>Article 6 — Garantie de la pose.</b> Le Prestataire garantit la qualité de son intervention (pose, raccordement, mise en service) pendant <b>12 mois</b> à compter de la signature du procès-verbal de réception, contre tout défaut lié directement à l'installation. Cette garantie ne couvre en aucun cas les équipements eux-mêmes : leur garantie relève exclusivement du fabricant ou du vendeur auprès duquel le Client les a acquis.</div>
    <div class="art"><b>Article 7 — Exclusions de garantie.</b> La garantie de pose ne s'applique pas en cas de : défaut inhérent au matériel fourni par le Client ; catastrophe naturelle ; surtension ou défaut du réseau électrique ; mauvaise utilisation ou négligence ; modification ou intervention effectuée par un tiers non autorisé par BMI TOGO.</div>
    <div class="art"><b>Article 8 — Responsabilité limitée.</b> Le Prestataire n'est pas responsable des dommages, pannes ou dysfonctionnements résultant d'un défaut, d'une non-conformité, ou d'une incompatibilité du matériel fourni par le Client — y compris lorsque ce défaut n'était pas décelable au moment de la pose.</div>
    <div class="art"><b>Article 9 — Obligations de BMI TOGO.</b> Réaliser la pose conformément aux règles de l'art et aux normes de sécurité applicables, et former le Client à l'utilisation de l'installation.</div>
    <div class="art"><b>Article 10 — Obligations du Client.</b> Mettre à disposition le matériel à installer, en bon état et complet, à la date convenue ; faciliter l'accès au chantier ; garantir la sécurité du site ; s'assurer de la solidité de tout support d'installation concerné ; mettre à disposition un réseau électrique conforme si nécessaire.</div>
    <div class="art"><b>Article 11 — Travaux supplémentaires.</b> Toute prestation non prévue au présent contrat fait l'objet d'un devis complémentaire, soumis à l'accord écrit préalable du Client.</div>
    <div class="art"><b>Article 12 — Réception.</b> Un procès-verbal de réception sera signé à la fin des travaux ; sa date de signature marque le début de la garantie de pose (Article 6). Le Client vérifie la prestation lors de la réception et peut formuler des réserves précises dans le procès-verbal.</div>
    <div class="art"><b>Article 13 — Résiliation ou renonciation du Client.</b> Le Client peut renoncer au présent contrat avant le commencement des travaux, par notification écrite. Si les travaux ont déjà commencé, le Client reste tenu du paiement des prestations déjà exécutées.</div>
    <div class="art"><b>Article 14 — Force majeure.</b> Aucune des parties ne pourra être tenue responsable d'un manquement résultant d'un événement de force majeure.</div>
    <div class="art"><b>Article 15 — Confidentialité des données.</b> BMI TOGO s'engage à traiter les données personnelles du Client conformément à la loi n° 2019-014 relative à la protection des données à caractère personnel en République Togolaise.</div>
    <div class="art"><b>Article 16 — Hiérarchie des documents.</b> En cas de contradiction entre le présent contrat et tout autre document, le présent contrat prévaut, sauf accord écrit contraire des parties.</div>
    <div class="art"><b>Article 17 — Litiges.</b> Tout différend sera réglé à l'amiable ; à défaut, les tribunaux compétents de la République Togolaise seront seuls compétents.</div>
    <div class="art"><b>Article 18 — Défaut de paiement.</b> En cas de non-paiement à l'échéance convenue, BMI TOGO pourra suspendre toute intervention restant à exécuter et réclamer le paiement des sommes dues, conformément aux dispositions légales applicables.</div>
    ` : `
    <div class="art"><b>Article 1 — Objet.</b> Le présent contrat a pour objet la fourniture, l'installation, les essais et la mise en service des équipements prévus au devis accepté, pour un montant total de <b>${fmt(d.total)} FCFA</b>. Le devis accepté, ainsi que ses éventuelles annexes techniques, nomenclatures, fiches techniques et plans validés par les parties, font partie intégrante du présent contrat. Ils définissent notamment les équipements fournis, leurs quantités, leurs caractéristiques principales et les prestations d'installation comprises dans le prix. Toute prestation ou fourniture non expressément prévue dans ces documents fait l'objet d'un devis complémentaire soumis à l'accord préalable du Client.
    ${listeEquipements.length > 0 ? `<ul style="margin:6px 0 0 18px;padding:0">${listeEquipements.map((l) => `<li>${l}</li>`).join("")}</ul>` : ""}</div>
    <div class="art"><b>Article 2 — Documents remis.</b> BMI TOGO remettra au Client les fiches techniques, le rapport de mise en service, les consignes d'utilisation et de sécurité.</div>
    <div class="art"><b>Article 3 — Modalités de paiement.</b> ${pctAcompteAffiche >= 100
      ? `Le prix est payable intégralement, soit <b>${fmt(d.total)} FCFA</b>, avant le commencement des travaux.`
      : `Un acompte de <b>${pctAcompteAffiche} %</b> du montant total, soit <b>${fmt(montantAcompte)} FCFA</b>, est exigible avant le commencement des travaux. Le solde, soit <b>${fmt(d.total - montantAcompte)} FCFA</b>, est exigible selon les modalités prévues à l'Article 21.`}</div>
    <div class="art"><b>Article 4 — Délai d'exécution.</b> Les travaux seront exécutés dans un délai indicatif de <b>${esc(d.delai_installation) || "à convenir avec le Client"}</b> à compter du paiement de l'acompte ou de la signature du présent contrat, selon le cas. Ce délai pourra être prolongé en cas de force majeure ou de retard imputable au Client, sans que cela n'engage la responsabilité de BMI TOGO.</div>
    <div class="art"><b>Article 5 — Garanties des équipements.</b> ${garanties.length > 0 ? garanties.join(" ; ") + "." : "Selon la garantie fabricant de chaque équipement."}</div>
    <div class="art"><b>Article 6 — Garantie d'installation.</b> BMI TOGO garantit les travaux d'installation pendant 12 mois à compter de la signature du procès-verbal de réception, contre tout défaut lié à la pose. En cas de dysfonctionnement, BMI TOGO procède d'abord à un diagnostic pour déterminer l'origine du problème. Si le défaut relève de l'installation, la réparation est prise en charge intégralement et gratuitement par BMI TOGO. Si le défaut relève de l'équipement lui-même, BMI TOGO accompagne le Client dans les démarches de prise en charge auprès du fabricant ou du fournisseur ; le remplacement ou la réparation est soumis aux conditions de garantie du fabricant, et les frais de main-d'œuvre, de déplacement ou de réinstallation pourront être facturés au Client si ceux-ci ne sont pas pris en charge par le fabricant. Cette garantie ne constitue pas une garantie de performance des équipements : toute baisse de performance liée au vieillissement normal, aux conditions climatiques, à une mauvaise utilisation ou à des facteurs externes relève, le cas échéant, de la garantie du fabricant.</div>
    <div class="art"><b>Article 7 — Exclusions de garantie.</b> La garantie ne s'applique pas en cas de : catastrophe naturelle (foudre, inondation, incendie...) ; surtension ou défaut du réseau électrique ; mauvaise utilisation ou négligence ; défaut d'entretien ; modification, réparation ou intervention effectuée par une personne non autorisée par BMI TOGO ; usure normale des équipements.</div>
    <div class="art"><b>Article 8 — Performance${estSolaire ? " du système solaire" : " des équipements"}.</b> ${estSolaire
      ? "La production effective du système photovoltaïque dépend notamment de l'ensoleillement, de la consommation du Client, de l'orientation et de l'inclinaison des équipements, de l'ombrage, des conditions météorologiques et de la qualité du réseau électrique. BMI TOGO ne garantit aucun niveau de production déterminé."
      : "Les performances de fonctionnement des équipements dépendent des conditions d'usage et de l'environnement d'installation. BMI TOGO ne garantit aucun niveau de performance déterminé au-delà des spécifications du fabricant."}</div>
    <div class="art"><b>Article 9 — Réserve de propriété.</b> Les équipements fournis demeurent la propriété de BMI TOGO jusqu'au paiement intégral du prix convenu, nonobstant leur installation. Le Client s'interdit de céder, gager ou transférer à un tiers les équipements avant paiement complet.</div>
    <div class="art"><b>Article 10 — Transfert des risques.</b> Les risques de perte, vol ou détérioration des équipements sont transférés au Client à compter de leur livraison sur le site, ou de leur installation si celle-ci est immédiate, sous réserve des dispositions de l'Article 9 relatives à la propriété.</div>
    <div class="art"><b>Article 11 — Obligations de BMI TOGO.</b> Installer les équipements conformément aux règles de l'art, respecter les normes de sécurité, former le Client à l'utilisation du système.</div>
    <div class="art"><b>Article 12 — Obligations du Client.</b> Régler les paiements conformément au devis accepté, faciliter l'accès au chantier, ne pas modifier l'installation sans accord écrit de BMI TOGO. Le Client s'engage également à garantir l'accès et la sécurité du site, à s'assurer de la solidité de la toiture, du mur, du pilier ou de tout autre support d'installation concerné, à réaliser, le cas échéant, les travaux préparatoires convenus, et à mettre à disposition un réseau électrique conforme.</div>
    <div class="art"><b>Article 13 — Travaux supplémentaires.</b> Toute prestation ou fourniture non prévue au devis initial fait l'objet d'un devis complémentaire, soumis à l'accord écrit préalable du Client avant exécution.</div>
    <div class="art"><b>Article 14 — Maintenance.</b> La garantie prévue au présent contrat ne comprend pas les prestations de maintenance préventive ou périodique, qui font l'objet d'une offre distincte si le Client le souhaite.</div>
    <div class="art"><b>Article 15 — Réception.</b> Un procès-verbal de réception sera signé à la fin des travaux ; sa date de signature marque le début des garanties. Le Client vérifie l'installation lors de la réception et peut formuler des réserves précises dans le procès-verbal ; ces réserves ne peuvent porter que sur des éléments constatables lors de la réception, et leur levée fait l'objet d'une constatation ultérieure. En cas de refus du Client de procéder à la réception sans motif valable, BMI TOGO pourra constater la mise à disposition de l'installation par tout moyen, notamment par notification écrite au Client.</div>
    <div class="art"><b>Article 16 — Résiliation ou renonciation du Client.</b> Le Client peut renoncer au présent contrat avant le commencement des travaux, par notification écrite à BMI TOGO. Dans ce cas, le Client reste tenu du remboursement des sommes effectivement engagées par BMI TOGO pour l'exécution du contrat, notamment les commandes de matériel, frais de transport, d'importation, de réservation, de mobilisation ou toute autre dépense directement liée au projet, sous réserve des dispositions légales applicables. Lorsque les travaux ont déjà commencé ou que tout ou partie du matériel a été commandé, livré ou installé, le Client reste tenu du paiement des prestations déjà exécutées et des dépenses effectivement engagées par BMI TOGO. Toute résiliation ou renonciation du Client ne peut avoir pour effet d'annuler les sommes déjà devenues exigibles.</div>
    <div class="art"><b>Article 17 — Force majeure.</b> Aucune des parties ne pourra être tenue responsable d'un manquement à ses obligations résultant d'un événement de force majeure, c'est-à-dire un événement extérieur, imprévisible et irrésistible au sens de la loi applicable, rendant impossible l'exécution de tout ou partie des obligations. La partie affectée en informe l'autre dans les meilleurs délais. Les obligations concernées sont suspendues pendant la durée de l'événement. Si celui-ci se prolonge au-delà d'un délai raisonnable, chacune des parties pourra résilier le présent contrat, sans indemnité, sous réserve du règlement des prestations déjà exécutées.</div>
    <div class="art"><b>Article 18 — Confidentialité des données.</b> BMI TOGO s'engage à collecter, traiter et conserver les données personnelles du Client (identité, coordonnées, adresse, et toute donnée enregistrée dans son système de gestion) conformément à la loi n° 2019-014 relative à la protection des données à caractère personnel en République Togolaise. Ces données sont utilisées exclusivement dans le cadre de l'exécution du présent contrat et de la relation commerciale, conservées pour la durée nécessaire à cette finalité, et ne sont communiquées à des tiers sans l'accord du Client, sauf obligation légale. Le Client dispose d'un droit d'accès, de rectification et, dans les conditions prévues par la loi, de suppression de ses données, qu'il peut exercer auprès de BMI TOGO.</div>
    <div class="art"><b>Article 19 — Hiérarchie des documents.</b> En cas de contradiction entre le présent contrat, le devis accepté et toute fiche technique ou annexe, le présent contrat prévaut, sauf stipulation contraire expresse et écrite des parties.</div>
    <div class="art"><b>Article 20 — Litiges.</b> Tout différend sera réglé à l'amiable ; à défaut, les tribunaux compétents de la République Togolaise seront seuls compétents.</div>
    <div class="art"><b>Article 21 — Paiement, défaut de paiement et suspension des prestations.</b> Le Client s'engage à effectuer les paiements conformément aux échéances prévues à l'Article 3 et au devis accepté. En cas de non-paiement total ou partiel d'une somme arrivée à échéance, BMI TOGO pourra adresser au Client une mise en demeure de payer. À défaut de régularisation dans le délai indiqué dans la mise en demeure, BMI TOGO pourra, conformément aux dispositions légales applicables : a) suspendre les travaux, la livraison, la mise en service ou toute autre prestation restant à exécuter ; b) suspendre toute intervention ou prestation non encore exécutée ; c) demander le paiement des sommes échues et de toute somme devenue exigible ; d) résilier le contrat en cas de manquement suffisamment grave du Client ; e) réclamer, lorsque les conditions légales sont réunies, la réparation des préjudices et frais résultant du défaut de paiement. Les prestations déjà exécutées, les équipements déjà fournis ou commandés ainsi que les frais effectivement engagés par BMI TOGO restent dus par le Client, sous réserve des dispositions légales applicables. La réception de l'installation ne constitue pas une renonciation de BMI TOGO au paiement du solde restant dû : lorsque le prix n'a pas été intégralement payé, la signature du procès-verbal de réception ne vaut pas quittance du prix total. En cas de défaut de paiement, BMI TOGO conserve l'ensemble des droits et recours prévus par la législation applicable.</div>
    `}

    <div class="art">Fait à Lomé, le ${dFR(d.contrat_date_signature)}. Paiement prévu à la boutique ${esc(d.boutique_paiement || "—")}.${d.contrat_signe_en_boutique ? ` Signé en boutique ${esc(d.contrat_signe_en_boutique)}, devant ${esc(d.contrat_signe_devant || "—")}.` : ""}${d.contrat_papier ? ` Signé sur papier — original archivé à la boutique ${esc(d.contrat_papier_boutique || "—")} (reçu par ${esc(d.contrat_papier_par || "—")}).` : ""}</div>

    <div class="sig3-row">
      <div class="sig3-col">
        <div class="sig3-head">POUR BMI</div>
        ${libelleRoleInitiateur}
        ${initiateur?.signature_personnelle ? `<img class="signature" src="${initiateur.signature_personnelle}" alt="Signature" />` : "<br><br>"}
        <div class="ligne">${initiateur ? esc(initiateur.nom) : "Nom de l'initiateur du devis"}</div>
      </div>
      <div class="sig3-cachet">
        <img src="${cachet}" alt="Cachet BMI Togo" />
      </div>
      <div class="sig3-col">
        <div class="sig3-head">LE CLIENT</div>
        ${d.contrat_signature ? `<img class="signature" src="${d.contrat_signature}" alt="Signature" />`
          : d.contrat_papier ? `<div style="font-size:10px;color:#555;padding:8px 0">Signé sur papier<br>le ${dFR(d.contrat_date_signature)}</div>` : "<br><br>"}
        <div class="ligne">${esc(client?.nom || "Nom du client")}</div>
      </div>
    </div>

    <div class="mentions">Document généré automatiquement — BMI-Gestion-Boutiques.</div>
  </div>`;
  return html;
}

export function imprimerContratInstallation(d, db) {
  if (printApi) printApi.open(htmlContratInstallation(d, db), `Contrat ${d.contrat_numero || ""}`.trim());
}

// ============ BON DE RAVITAILLEMENT ============
export function imprimerBonRavitaillement(bon, db) {
  const bqSrc = (db.boutiques || []).find((b) => b.nom === bon.source) || {};
  const logo = bqSrc.logo || LOGO;
  const total = bon.lignes.reduce((s, l) => s + Number(l.qte || 0), 0);
  // ⚠ Un transfert touche DEUX boutiques (source ET destination) — le
  // bandeau s'affiche si l'UNE des deux est une boutique de formation
  // (demande Timo).
  const bqDest = (db.boutiques || []).find((b) => b.nom === bon.destination);
  const estFormationBon = bqSrc.formation || bqDest?.formation;
  const html = `
  <style>
  #zone-impression .bon{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;max-width:680px;margin:0 auto}
  #zone-impression .bon .entete{width:100%;border-collapse:collapse}
  #zone-impression .bon .entete td{vertical-align:middle;padding:0 0 8px 0}
  #zone-impression .bon .entete img{max-width:150px;max-height:110px;object-fit:contain}
  #zone-impression .bon .soc{text-align:right;line-height:1.5}
  #zone-impression .bon .soc .nom{font-size:20px;font-weight:bold;color:#1e5a8a}
  #zone-impression .bon h1{text-align:center;font-size:17px;letter-spacing:2px;margin:10px 0 12px;color:#1e5a8a;border-bottom:3px solid #1e5a8a;padding-bottom:8px}
  #zone-impression .bon .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;background:#f2f6fa;border:1px solid #d5e2ee;border-radius:6px;padding:8px 10px;margin-bottom:10px}
  #zone-impression .bon .flux{text-align:center;font-size:14px;font-weight:bold;color:#1e5a8a;margin:10px 0}
  #zone-impression .bon table.art{width:100%;border-collapse:collapse;margin:8px 0}
  #zone-impression .bon table.art th{background:#1e5a8a;color:#fff;padding:6px;font-size:11px;text-align:left}
  #zone-impression .bon table.art th:last-child,#zone-impression .bon table.art td:last-child{text-align:right}
  #zone-impression .bon table.art td{border:1px solid #d5e2ee;padding:6px}
  #zone-impression .bon table.art tr.tot td{background:#eaf3ea;border-top:2px solid #1e5a8a;font-weight:bold;color:#1e5a8a}
  #zone-impression .bon table.sign{width:100%;border-collapse:collapse;margin-top:30px}
  #zone-impression .bon table.sign td{width:50%;text-align:center;font-size:11px;color:#333;padding:0 12px}
  #zone-impression .bon table.sign .ligne{border-top:1px solid #555;padding-top:4px}
  </style>
  <div class="bon">
    ${bandeauFormation(estFormationBon)}
    <table class="entete"><tr>
      <td><img src="${logo}" alt="BMI" /></td>
      <td class="soc"><div class="nom">BMI TOGO</div><div>${esc(bqSrc.adresse || "Lomé, Togo")}</div><div>NIF : 1001790098</div><div>RCCM : TG-LFW-01-2022-A10-01523</div></td>
    </tr></table>
    <h1>BON DE RAVITAILLEMENT</h1>
    <div class="meta">
      <div><b>N° :</b> ${esc(bon.numero)}</div>
      <div><b>Date :</b> ${esc(dFR(bon.date))}</div>
      <div><b>Établi par :</b> ${esc(bon.par)}</div>
    </div>
    <div class="flux">🏭 ${esc(bon.source)} &nbsp;→&nbsp; 🏪 ${esc(bon.destination)}</div>
    <table class="art">
      <thead><tr><th>Article</th><th>Catégorie</th><th>Quantité</th></tr></thead>
      <tbody>
        ${bon.lignes.map((l) => `<tr><td>${esc(l.nom)}</td><td>${esc(l.categorie || "—")}</td><td>${l.qte}</td></tr>`).join("")}
        <tr class="tot"><td colspan="2">TOTAL ARTICLES</td><td>${total}</td></tr>
      </tbody>
    </table>
    <table class="sign"><tr>
      <td><div class="ligne">Le magasinier (sortie)</div></td>
      <td><div class="ligne">Le réceptionnaire (boutique)</div></td>
    </tr></table>
  </div>`;
  if (printApi) printApi.open(html, `Bon ${bon.numero || ""}`.trim());
}

// ============ BULLETIN DE PAIE ============
export function imprimerBulletin(u, mois, db) {
  const bq = (db.boutiques || []).find((b) => b.nom === u.boutique) || (db.boutiques || [])[0] || {};
  const logo = bq.logo || LOGO;
  const p = paieMois(u, mois);
  const primes = (u.primes || []).filter((x) => x.mois === mois);
  const avances = (u.avances || []).filter((x) => x.mois === mois);
  const credits = (u.credits || []).filter((c) => c.statut === "approuve" && resteCredit(c) > 0);
  const roleLbl = u.role === "gerant" ? "Gérant de boutique" : u.role === "magasinier" ? "Magasinier" : u.role === "technicien_bmi" ? "Technicien BMI" : "Vendeur";
  const numero = `BP-${mois.replace("-", "")}-${String(u.id).slice(0, 4).toUpperCase()}`;

  const ligne = (lib, montant, signe) =>
    `<tr><td>${esc(lib)}</td><td class="${signe === "-" ? "moins" : signe === "+" ? "plus" : ""}">${signe === "-" ? "−" : signe === "+" ? "+" : ""}${fmt(Math.abs(Number(montant) || 0))}</td></tr>`;

  const html = `
  <style>
  #zone-impression .bp{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;max-width:680px;margin:0 auto}
  #zone-impression .bp .entete{width:100%;border-collapse:collapse}
  #zone-impression .bp .entete td{vertical-align:middle;padding:0 0 8px 0}
  #zone-impression .bp .entete img{max-width:150px;max-height:110px;object-fit:contain}
  #zone-impression .bp .soc{text-align:right;line-height:1.5}
  #zone-impression .bp .soc .nom{font-size:20px;font-weight:bold;color:#1e5a8a}
  #zone-impression .bp h1{text-align:center;font-size:17px;letter-spacing:2px;margin:10px 0 12px;color:#1e5a8a;border-bottom:3px solid #1e5a8a;padding-bottom:8px}
  #zone-impression .bp .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;background:#f2f6fa;border:1px solid #d5e2ee;border-radius:6px;padding:8px 10px;margin-bottom:10px}
  #zone-impression .bp .btitre{font-weight:bold;color:#1e5a8a;border-bottom:1px solid #d5e2ee;margin:12px 0 4px;font-size:12px;letter-spacing:1px}
  #zone-impression .bp .sal div{padding:2px 0}
  #zone-impression .bp table.el{width:100%;border-collapse:collapse;margin:6px 0}
  #zone-impression .bp table.el th{background:#1e5a8a;color:#fff;padding:6px;font-size:11px;text-align:left}
  #zone-impression .bp table.el th:last-child,#zone-impression .bp table.el td:last-child{text-align:right;white-space:nowrap}
  #zone-impression .bp table.el td{border:1px solid #d5e2ee;padding:6px}
  #zone-impression .bp table.el td.plus{color:#2e7d32;font-weight:bold}
  #zone-impression .bp table.el td.moins{color:#c62828;font-weight:bold}
  #zone-impression .bp table.el tr.net td{background:#eaf3ea;border-top:2px solid #1e5a8a;font-weight:bold;font-size:14px;color:#1e5a8a}
  #zone-impression .bp .enc{background:#f7f2fb;border:1px solid #e0d3ee;border-radius:6px;padding:8px 10px;margin-top:8px;font-size:11px}
  #zone-impression .bp table.sign{width:100%;border-collapse:collapse;margin-top:30px}
  #zone-impression .bp table.sign td{width:50%;text-align:center;font-size:11px;color:#333;padding:0 12px}
  #zone-impression .bp table.sign .ligne{border-top:1px solid #555;padding-top:4px}
  #zone-impression .bp .pied{text-align:center;font-style:italic;color:#555;margin-top:16px;border-top:1px dashed #aaa;padding-top:8px;font-size:11px}
  </style>
  <div class="bp">
    <table class="entete"><tr>
      <td><img src="${logo}" alt="BMI" /></td>
      <td class="soc">
        <div class="nom">BMI TOGO</div>
        <div>${esc(bq.adresse || "Lomé, Togo")}</div>
        ${bq.tel ? `<div>Tél : ${esc(bq.tel)}</div>` : ""}
      </td>
    </tr></table>

    <h1>BULLETIN DE PAIE</h1>

    <div class="meta">
      <div><b>Période :</b> ${esc(libelleMoisFR(mois))}</div>
      <div><b>N° :</b> ${esc(numero)}</div>
      <div><b>Édité le :</b> ${esc(dFR(today()))}</div>
    </div>

    <div class="btitre">SALARIÉ</div>
    <div class="sal">
      <div><b>Nom et prénom(s) :</b> ${esc(u.nom_complet || u.nom)}</div>
      ${u.piece_num ? `<div><b>Pièce d'identité :</b> ${esc(u.piece_type || "CNI")} n° ${esc(u.piece_num)}</div>` : ""}
      <div><b>Fonction :</b> ${esc(roleLbl)}</div>
      <div><b>Affectation :</b> ${esc(u.boutique || "Toutes boutiques")}</div>
      ${Number(u.taux_avancement || 0) > 0 ? `<div><b>Taux d'avancement annuel :</b> ${esc(u.taux_avancement)} %</div>` : ""}
    </div>

    <div class="btitre">ÉLÉMENTS DE PAIE</div>
    <table class="el">
      <thead><tr><th>Libellé</th><th>Montant (F CFA)</th></tr></thead>
      <tbody>
        ${ligne("Salaire de base", p.base, "")}
        ${/* ⚠ Seul texte SAISI encore inséré sans échappement dans un document
              HTML : le motif d'une prime ou d'une avance, tapé librement par
              l'administration. Tout le reste (nom du client, nom d'article,
              adresse, garanties) passait déjà par esc(). */""}
        ${primes.map((x) => ligne(`Prime${x.motif ? " — " + esc(x.motif) : ""}`, x.montant, "+")).join("")}
        ${avances.map((x) => ligne(`Avance sur salaire${x.motif ? " — " + esc(x.motif) : ""}`, x.montant, "-")).join("")}
        ${p.retenueCredit > 0 ? ligne("Retenue crédit BMI", p.retenueCredit, "-") : ""}
        ${p.retenueCNSS > 0 ? ligne("Retenue CNSS (9 % — pension vieillesse + AMU)", p.retenueCNSS, "-") : ""}
        <tr class="net"><td>NET À PERCEVOIR</td><td>${fmt(p.net)}</td></tr>
      </tbody>
    </table>

    <div class="btitre">VERSEMENTS</div>
    <table class="el">
      <thead><tr><th>Date · Moyen</th><th>Montant</th></tr></thead>
      <tbody>
        ${p.virements.length
          ? p.virements.map((v) => `<tr><td>${esc(dFR(v.date_envoi))} · ${esc(v.moyen || "—")} · ${v.statut === "accepte" ? "Réception confirmée" : "En attente de confirmation"}</td><td>${fmt(v.montant)}</td></tr>`).join("")
          : `<tr><td colspan="2" style="text-align:center;color:#888">Aucun versement enregistré pour cette période</td></tr>`}
        <tr class="net"><td>RESTE À PERCEVOIR</td><td>${fmt(Math.max(0, p.reste))}</td></tr>
      </tbody>
    </table>

    ${credits.length ? `<div class="enc"><b>🏦 Crédit BMI en cours :</b> ${credits.map((c) => `accordé ${fmt(c.montant_accorde)} · remboursé ${fmt(totalRembourseCredit(c))} · <b>reste dû ${fmt(resteCredit(c))}</b>${c.mode === "salaire" ? " (retenue sur salaire)" : " (remboursement libre)"}`).join(" ; ")}</div>` : ""}

    <table class="sign"><tr>
      <td><div class="ligne">Le salarié</div></td>
      <td><div class="ligne">L'administration</div></td>
    </tr></table>

    <div class="pied">Document généré par BMI-Gestions Boutiques — à conserver.</div>
  </div>`;
  if (printApi) printApi.open(html, `Bulletin ${u.nom || ""} ${mois || ""}`.trim());
}

export function recuWhatsApp(v, bq = {}) {
  const lignes = [
    // ⚠ Bandeau formation : il était présent sur le reçu imprimé, le reçu de
    // versement, la proforma, le devis, le PV, le contrat et le bon — mais
    // PAS ici. C'est pourtant le seul de tous ces documents qui part chez
    // un tiers : un reçu d'entraînement arrivait donc chez le client avec
    // l'apparence d'un vrai.
    bq.formation ? `🎓 *DOCUMENT DE FORMATION — SANS VALEUR*` : null,
    bq.formation ? `------------------------` : null,
    `🧾 *REÇU — ${v.boutique}*`,
    bq.adresse || "Lomé, Togo",
    bq.tel ? `Tél : ${bq.tel}` : null,
    `------------------------`,
    `Date : ${dFR(v.date)}${v.heure ? ` à ${v.heure}` : ""}`,
    `Reçu N° : ${numeroRecu(v)}`,
    v.client ? `Client : ${v.client}` : null,
    `------------------------`,
    // ⚠ 2.99.51 : chaque ligne affiche désormais son montant NET (remise de
    // ligne déjà soustraite), sinon la somme des lignes ne correspondait plus
    // au "Sous-total" juste en dessous depuis la correction de brutVente().
    ...lignesVente(v).map((l) => {
      const rl = Number(l.remise_ligne || 0);
      const net = Number(l.qte) * Number(l.pu) - rl;
      return `${l.qte} × ${l.article} = ${fmt(net)}${rl > 0 ? ` (remise −${fmt(rl)})` : ""}`;
    }),
    `Sous-total : ${fmt(brutVente(v))}`,
    v.remise ? `Remise${v.remise_pct ? ` (${v.remise_pct}%)` : ""} : −${fmt(v.remise)}` : null,
    Number(v.rabais || 0) > 0 ? `Rabais commercial${v.commercial ? ` (${v.commercial})` : ""} : −${fmt(v.rabais)}` : null,
    `*TOTAL : ${fmt(totalVente(v))}*`,
    v.paiement === "Crédit (dette)" ? `Avance versée : ${fmt(v.avance || 0)}` : null,
    v.paiement === "Crédit (dette)" ? `*RESTE À PAYER : ${fmt(Math.max(0, totalVente(v) - (Number(v.avance) || 0)))}*` : null,
    `Paiement : ${v.paiement}`,
    `Vendeur : ${v.par || ""}`,
    `------------------------`,
    bq.message || "Merci de votre confiance !",
  ].filter(Boolean);
  const txt = lignes.join("\n");
  const num = telDigits(v.tel);
  window.open(num ? `https://wa.me/${num}?text=${encodeURIComponent(txt)}` : `https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
}

// ============ ÉTIQUETTE PRODUIT (code-barres) ============
// Fonctionnalité nouvelle, indépendante des documents existants
// ci-dessus : imprime une étiquette avec le nom de l'article, son
// code-barres Code128 (généré ci-dessus dans ./barcode, sans
// bibliothèque externe) et le code en clair en dessous (au cas où
// le lecteur n'arrive pas à scanner). Passe par le MÊME aperçu et
// le même mécanisme d'impression que les autres documents.
// ============ CE QU'UNE ÉTIQUETTE PEUT PORTER ============
// ⚠ Constaté en passant du 80 mm au 60 mm de large (Timo, 25/08/2026) : la
// LARGEUR de l'étiquette decide de la finesse des barres, donc de la capacité
// du scanner à les lire. Le code s'étale sur toute la largeur disponible ;
// plus il a de caractères, plus chaque barre est fine.
//
// Repère du métier : la barre la plus fine doit faire au moins 0,25 mm. En
// dessous, un lecteur ordinaire commence à refuser, surtout sur du papier
// ordinaire ou une impression un peu pâle.
//
// Code128 occupe 11 modules par caractère, plus 35 modules fixes
// (départ + contrôle + arrêt). D'où le calcul ci-dessous, vérifié au banc.
export const LARGEUR_CODE_BARRES_MM = 57.1; // mesuré sur l'étiquette 60 mm
export const BARRE_LA_PLUS_FINE_MM = 0.25;
export const modulesCode128 = (code) => 11 * String(code || "").length + 35;
export const largeurBarreMm = (code) => LARGEUR_CODE_BARRES_MM / modulesCode128(code);
// Le nombre de caractères au-delà duquel l'étiquette devient douteuse.
export const LONGUEUR_MAX_CODE = Math.floor(
  (LARGEUR_CODE_BARRES_MM / BARRE_LA_PLUS_FINE_MM - 35) / 11
);

export function imprimerEtiquetteProduit(p) {
  // ⚠ FORMAT : ROULEAUX D'ÉTIQUETTES 60 × 30 mm (choix de Timo, 25/08/2026).
  // Tout est fixé en MILLIMÈTRES RÉELS : l'étiquette sort à la taille de la
  // vignette prédécoupée, quel que soit le réglage d'échelle du navigateur.
  //
  // ⚠ ET LE FORMAT DE PAGE AVEC. Sans lui, le navigateur imprimait sur une
  // page A4 : l'étiquette partait dans un coin de la feuille et le rouleau
  // se dévidait pour rien.
  //
  // ⚠ HAUTEUR DU CODE-BARRES IMPOSÉE (14 mm), et c'est un correctif, pas un
  // réglage. Avant, le dessin gardait ses proportions : un code LONG
  // s'étirait en largeur et s'écrasait donc en hauteur. Mesuré sur l'ancien
  // format : 13 mm de haut pour un code de 8 caractères, mais 6,3 mm pour un
  // code de 20 — avec des barres de 0,21 mm, sous le seuil de lecture fiable
  // (0,25 mm de barre fine, 10 mm de hauteur). Une étiquette sur trois aurait
  // refusé de se lire. La hauteur ne dépend plus de la longueur du code.
  // 11 mm : le maximum qui tienne dans 30 mm de haut une fois la boutique,
  // le code en clair, le prix et le nom placés — et toujours au-dessus du
  // seuil de lecture fiable (10 mm). C'est le premier chiffre à revoir si le
  // format de rouleau change encore.
  const svg = genererSVGCode128(p.code, {
    largeurModule: 2, hauteur: 60,
    styleCss: "width:100%;height:11mm;display:block",
    etirerEnHauteur: true,
  });
  if (!svg) return false; // code invalide (caractères non ASCII) : on n'imprime rien de cassé
  //
  // ⚠ DEMANDE TIMO : NOM DE LA BOUTIQUE EN HAUT, NOM DE L'ARTICLE EN BAS —
  // le code-barres, le code en clair et le prix entre les deux. L'étiquette
  // se lit donc « d'où elle vient » d'abord, « ce que c'est » en dernier.
  // Pourquoi ce repère compte : un même article existe dans plusieurs
  // boutiques, souvent au même prix. Sans le nom, une étiquette imprimée ici
  // et posée là-bas ne se distingue plus, et personne ne peut dire d'où sort
  // un carton d'étiquettes préparé la veille.
  //
  // ⚠ Le nom de l'article est limité à DEUX lignes : au-delà il déborderait
  // de la vignette, et c'est le code-barres qui serait rogné. Sur 30 mm de
  // haut, chaque dixième de millimètre compte — les tailles ci-dessous ont
  // été MESURÉES, pas estimées (voir npm run apercu-etiquette).
  const html = `
    <div style="width:60mm;height:30mm;padding:1.2mm;border:0.3mm solid #94a3b8;border-radius:1.5mm;text-align:center;font-family:Arial,sans-serif;box-sizing:border-box;line-height:1.05;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:0.3mm">
      ${p.boutique ? `<div style="font-size:9px;font-weight:700;letter-spacing:0.4px;color:#475569;word-break:break-word">${esc(p.boutique)}</div>` : ""}
      <div>${svg}</div>
      <div style="font-family:monospace;font-size:10px;letter-spacing:0.8px">${esc(p.code)}</div>
      ${p.prix_vente ? `<div style="font-weight:700;font-size:13px">${fmt(p.prix_vente)}</div>` : ""}
      <div style="font-weight:700;font-size:10px;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.nom)}</div>
    </div>`;
  if (printApi) printApi.open(html, `Étiquette ${p.nom || ""}`.trim(), "size: 60mm 30mm; margin: 0;");
  return true;
}
