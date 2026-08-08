// ============================================================
// lib/impression.js — Génération de documents imprimables : reçu
// client, proforma, bon de ravitaillement, bulletin de paie, et
// message WhatsApp du reçu. printApi vit dans components/ui.jsx
// (liaisons « live » des modules ES — voir le commentaire là-bas).
// ============================================================
import { today, dFR, fmt, totalVente, brutVente, lignesVente, numeroRecu, telDigits } from "./core";
import { LOGO, CACHET_BMI_DEFAUT } from "./constants";
import { printApi } from "../components/ui";
import { paieMois, resteCredit, libelleMoisFR, totalRembourseCredit } from "./calculs";
import { genererSVGCode128 } from "./barcode";

// ============ REÇU CLIENT ============
export function imprimerRecu(v, bq = {}, produits = []) {
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  if (printApi) printApi.open(sortie);
}

// ============ PROFORMA (aperçu avant impression, pas de téléchargement direct) ============
// Même base visuelle que le reçu de vente : titre souligné (pas de pavé plein),
// bandeaux clairs, en-têtes de tableau bleus, total en bordure — sobre à
// l'impression maintenant que les couleurs sortent réellement sur papier.
export function imprimerProforma(p, logo) {
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  if (printApi) printApi.open(html);
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
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const vente = db.ventes.find((v) => v.id === c.vente_id);
  const montant = vente ? totalVente(vente) : Number(c.frais_installation || 0);
  const avenant = c.avenant_statut === "signe";
  const chef = (c.equipe || []).find((e) => e.chef);
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
  #zone-impression .ctr-doc .etat{background:#f2f6fa;border:1px solid #d5e2ee;border-radius:6px;padding:8px 10px;margin:8px 0}
  #zone-impression .ctr-doc .reserve{color:#b91c1c;font-weight:bold}
  #zone-impression .ctr-doc .sig{margin-top:22px;display:flex;justify-content:space-between;gap:20px}
  #zone-impression .ctr-doc .sig .case{flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;font-size:11px}
  #zone-impression .ctr-doc .sig img{max-height:70px;display:block;margin:0 auto 4px}
  #zone-impression .ctr-doc .mentions{margin-top:16px;font-size:10px;color:#555;font-style:italic;text-align:center;border-top:1px dashed #aaa;padding-top:8px}
  </style>
  <div class="ctr-doc">
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
    <div class="art"><b>Article 1 — Objet.</b> Le présent procès-verbal constate la réception, par le Client, des travaux de <b>${esc(c.type_installation)}</b> réalisés à l'adresse suivante : <b>${esc(c.adresse_contrat || "—")}</b>, pour un montant total de <b>${fmt(montant)} FCFA</b>.</div>
    <div class="art"><b>Article 2 — Matériel installé.</b> ${(c.materiel || []).length > 0
      ? `<ul style="margin:6px 0 0 18px;padding:0">${c.materiel.map((m) => `<li>${esc(m.nom)} — quantité : ${esc(m.qte)}${m.serie ? ` — N° de série : ${esc(m.serie)}` : ""}</li>`).join("")}</ul>`
      : "Liste du matériel non renseignée."}${chef ? `<div style="margin-top:6px;font-size:11px;color:#555">Constaté par ${esc(chef.nom)}, chef d'équipe.</div>` : ""}</div>
    <div class="art etat"><b>Article 3 — État de la réception.</b> ${c.contrat_reserve_texte
      ? `Le Client accepte les travaux <span class="reserve">avec les réserves suivantes</span>, que le Prestataire s'engage à corriger dans un délai raisonnable : <i>${esc(c.contrat_reserve_texte)}</i>.`
      : "Le Client déclare accepter les travaux <b>sans réserve</b>."} Le système a été mis en service et testé en présence du Client au moment de la réception. Les documents remis (fiches techniques, consignes d'utilisation et de sécurité) ont été transmis au Client, conformément à l'Article 2 du contrat d'installation.</div>
    <div class="art"><b>Article 4 — Garantie.</b> Le Prestataire garantit les équipements installés contre tout défaut de fabrication ou d'installation pour une durée de <b>${esc(c.garantie_mois || "24")} mois</b> à compter de la date de signature, hors usure normale, mauvaise utilisation, ou intervention d'un tiers non autorisé.</div>
    <div class="art"><b>Article 5 — Signature.</b> En signant ci-dessous, le Client reconnaît avoir vérifié la conformité des travaux et accepte les termes du présent procès-verbal.</div>
    `}

    <div class="art">Fait à Lomé, le ${dFR(avenant ? c.avenant_date_signature : (c.contrat_date_signature || c.contrat_force_le))}.${!avenant && c.date_entretien ? ` Prochain entretien recommandé : ${dFR(c.date_entretien)}.` : ""}</div>

    <div class="sig">
      <div class="case">
        ${c.contrat_force_par
          ? `<div style="color:#b91c1c;font-weight:bold">⚠ Réceptionné sans signature<br>par ${esc(c.contrat_force_par)} (BMI Togo)</div>`
          : (avenant ? c.avenant_signature : c.contrat_signature)
            ? `<img src="${avenant ? c.avenant_signature : c.contrat_signature}" alt="Signature" />Signature du Client`
            : "Signature du Client<br>(en attente)"}
      </div>
      <div class="case">Pour BMI Togo</div>
    </div>

    <div class="mentions">Document généré automatiquement — BMI-Gestion-Boutiques.</div>
  </div>`;
  if (printApi) printApi.open(html);
}

// ============ CONTRAT D'INSTALLATION (avant travaux, lu+signé à la
// validation du devis) — distinct du imprimerContrat ci-dessus, qui sert
// le PROCÈS-VERBAL DE RÉCEPTION (fin de chantier). Même style visuel que
// les autres documents, mêmes 8 articles que ceux lus/signés dans
// EspaceClient.jsx — permet au client de retélécharger son contrat depuis
// son espace, à tout moment après signature (demande Timo). ============
export function imprimerContratInstallation(d, db) {
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  // Libellé du rôle affiché à la place de "Pour BMI Togo" — demande Timo sur
  // la base d'un vrai modèle Word qu'il a fourni ("Le (rôle de l'initiateur
  // du devis)"). Rôles pouvant initier un devis, cf. ONGLETS_ROLE.
  const LIBELLE_ROLE_CONTRAT = { commercial: "Le Commercial", vendeur: "Le Vendeur", technicien: "Le Technicien", technicien_bmi: "Le Technicien", gerant: "Le Gérant", admin: "L'Administrateur", resp_commercial: "Le Responsable Commercial" };
  const libelleRoleInitiateur = LIBELLE_ROLE_CONTRAT[initiateur?.role] || "Pour BMI Togo";
  const garanties = (d.panier || [])
    .map((l) => (db.produits || []).find((p) => p.id === l.produit_id))
    .filter((p) => p?.garantie_fabricant)
    .map((p) => `${esc(p.nom)} : garantie fabricant ${esc(p.garantie_fabricant)}${p.conditions_garantie ? ` (${esc(p.conditions_garantie)})` : ""}`);
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
    <table class="entete"><tr>
      <td><img src="${LOGO}" alt="BMI" /></td>
      <td class="soc"><div class="nom">BMI TOGO</div><div>E-mail : info@bmitogo.com</div><div>NIF : 1001790098 · RCCM : TG-LFW-01-2022-A10-01523</div><div>Représenté par Mr EGBAOU Essozimna</div></td>
    </tr></table>
    <h1>CONTRAT DE FOURNITURE D'INSTALLATION${d.type_devis === "garage" ? " D'UN SYSTEME DE MOTORISATION" : d.type_devis === "autre" ? "" : " D'UN SYSTEME SOLAIRE PHOTOVOLTAIQUE"}${d.contrat_numero ? ` N° ${esc(d.contrat_numero)}` : ""}</h1>

    <div class="art">Date : ${dFR(d.contrat_date_signature)}</div>
    <div class="art">Entre les soussignés :</div>
    <div class="art">BMI (Bâtiments Modernes et Intelligents) E-mail : info@bmitogo.com ; NIF : 1001790098 · RCCM : TG-LFW-01-2022-A10-01523 ; représenté par Mr EGBAOU Essozimna</div>
    <div class="art">Et :</div>
    <div class="art">Mr/Mme : ${esc(client?.nom || "")}${client?.tel ? `, tél. ${esc(client.tel)}` : ""}</div>

    <div class="art"><b>Article 1 — Objet.</b> Le présent contrat a pour objet la fourniture, l'installation, les essais et la mise en service des équipements prévus au devis accepté, pour un montant total de <b>${fmt(d.total)} FCFA</b>.</div>
    <div class="art"><b>Article 2 — Documents remis.</b> BMI TOGO remettra au Client les fiches techniques, le rapport de mise en service, les consignes d'utilisation et de sécurité.</div>
    <div class="art"><b>Article 3 — Garanties des équipements.</b> ${garanties.length > 0 ? garanties.join(" ; ") + "." : "Selon la garantie fabricant de chaque équipement."}</div>
    <div class="art"><b>Article 4 — Garantie d'installation.</b> BMI TOGO garantit les travaux d'installation pendant 12 mois à compter de la signature du procès-verbal de réception, contre tout défaut lié à la pose. En cas de dysfonctionnement, BMI TOGO procède d'abord à un diagnostic pour déterminer l'origine du problème. Si le défaut relève de l'installation, la réparation est prise en charge intégralement et gratuitement par BMI TOGO. Si le défaut relève de l'équipement lui-même, BMI TOGO accompagne le Client dans les démarches de prise en charge auprès du fabricant ou du fournisseur ; le remplacement ou la réparation est soumis aux conditions de garantie du fabricant, et les frais de main-d'œuvre, de déplacement ou de réinstallation pourront être facturés au Client si ceux-ci ne sont pas pris en charge par le fabricant.</div>
    <div class="art"><b>Article 5 — Exclusions de garantie.</b> La garantie ne s'applique pas en cas de : catastrophe naturelle (foudre, inondation, incendie...) ; surtension ou défaut du réseau électrique ; mauvaise utilisation ou négligence ; défaut d'entretien ; modification, réparation ou intervention effectuée par une personne non autorisée par BMI TOGO ; usure normale des équipements.</div>
    <div class="art"><b>Article 6 — Obligations de BMI TOGO.</b> Installer les équipements conformément aux règles de l'art, respecter les normes de sécurité, former le Client à l'utilisation du système.</div>
    <div class="art"><b>Article 7 — Obligations du Client.</b> Régler les paiements conformément au devis accepté, faciliter l'accès au chantier, ne pas modifier l'installation sans accord écrit de BMI TOGO.</div>
    <div class="art"><b>Article 8 — Réception.</b> Un procès-verbal de réception sera signé à la fin des travaux ; sa date de signature marque le début des garanties.</div>
    <div class="art"><b>Article 9 — Résiliation volontaire.</b> Le Client peut renoncer au présent contrat à tout moment avant l'exécution des travaux, par notification écrite à BMI TOGO, sous réserve du remboursement des sommes déjà engagées par BMI TOGO pour la réservation de matériel ou la mobilisation d'équipe, le cas échéant.</div>
    <div class="art"><b>Article 10 — Force majeure.</b> Aucune des parties ne pourra être tenue responsable d'un manquement à ses obligations résultant d'un cas de force majeure (retard d'approvisionnement, rupture d'importation, décision administrative, ou tout événement échappant au contrôle raisonnable de BMI TOGO). Les délais prévus au présent contrat seront alors suspendus jusqu'à la cessation de l'événement.</div>
    <div class="art"><b>Article 11 — Confidentialité des données.</b> BMI TOGO s'engage à utiliser les informations personnelles du Client (identité, coordonnées, adresse) exclusivement dans le cadre de l'exécution du présent contrat, et à ne pas les communiquer à des tiers sans l'accord du Client, sauf obligation légale.</div>
    <div class="art"><b>Article 12 — Litiges.</b> Tout différend sera réglé à l'amiable ; à défaut, les tribunaux compétents de la République Togolaise seront seuls compétents.</div>
    <div class="art"><b>Article 13 — Entrée en vigueur et caducité.</b> Le présent contrat entre en vigueur à sa signature. Le Client s'engage à effectuer le paiement prévu dans un délai maximum de sept (7) jours calendaires à compter de la signature, sauf accord écrit contraire. À défaut de paiement dans ce délai, le présent contrat devient automatiquement caduc, sans mise en demeure préalable. BMI TOGO se réserve le droit de suspendre toute intervention, réservation de matériel ou planification. Le Client pourra solliciter une nouvelle validation, pouvant donner lieu à un nouveau contrat et, le cas échéant, à une révision du devis.</div>

    <div class="art">Fait à Lomé, le ${dFR(d.contrat_date_signature)}. Paiement prévu à la boutique ${esc(d.boutique_paiement || "—")}.</div>

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
        ${d.contrat_signature ? `<img class="signature" src="${d.contrat_signature}" alt="Signature" />` : "<br><br>"}
        <div class="ligne">${esc(client?.nom || "Nom du client")}</div>
      </div>
    </div>

    <div class="mentions">Document généré automatiquement — BMI-Gestion-Boutiques.</div>
  </div>`;
  if (printApi) printApi.open(html);
}

// ============ BON DE RAVITAILLEMENT ============
export function imprimerBonRavitaillement(bon, db) {
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bqSrc = (db.boutiques || []).find((b) => b.nom === bon.source) || {};
  const logo = bqSrc.logo || LOGO;
  const total = bon.lignes.reduce((s, l) => s + Number(l.qte || 0), 0);
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
  if (printApi) printApi.open(html);
}

// ============ BULLETIN DE PAIE ============
export function imprimerBulletin(u, mois, db) {
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
        ${primes.map((x) => ligne(`Prime${x.motif ? " — " + x.motif : ""}`, x.montant, "+")).join("")}
        ${avances.map((x) => ligne(`Avance sur salaire${x.motif ? " — " + x.motif : ""}`, x.montant, "-")).join("")}
        ${p.retenueCredit > 0 ? ligne("Retenue crédit BMI", p.retenueCredit, "-") : ""}
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
  if (printApi) printApi.open(html);
}

export function recuWhatsApp(v, bq = {}) {
  const lignes = [
    `🧾 *REÇU — ${v.boutique}*`,
    bq.adresse || "Lomé, Togo",
    bq.tel ? `Tél : ${bq.tel}` : null,
    `------------------------`,
    `Date : ${dFR(v.date)}${v.heure ? ` à ${v.heure}` : ""}`,
    `Reçu N° : ${numeroRecu(v)}`,
    v.client ? `Client : ${v.client}` : null,
    `------------------------`,
    ...lignesVente(v).map((l) => `${l.qte} × ${l.article} = ${fmt(Number(l.qte) * Number(l.pu))}`),
    `Sous-total : ${fmt(brutVente(v))}`,
    v.remise ? `Remise${v.remise_pct ? ` (${v.remise_pct}%)` : ""} : −${fmt(v.remise)}` : null,
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
export function imprimerEtiquetteProduit(p) {
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = genererSVGCode128(p.code, { largeurModule: 2, hauteur: 60 });
  if (!svg) return false; // code invalide (caractères non ASCII) : on n'imprime rien de cassé
  // Espacement resserré (demande Timo) : le nom, le code-barres, le code en
  // clair et le prix se suivent directement, sans grand vide entre eux.
  // line-height:0 sur le conteneur du SVG retire l'espace « fantôme » que
  // les navigateurs ajoutent sous une image en ligne (réservé pour la
  // descente des lettres — invisible ici, mais il compte dans la mise en
  // page). Ce n'est qu'une mise en page à moi, pas un format imposé.
  // Largeur fixée en MILLIMÈTRES RÉELS (pas en pixels) : garantit une
  // impression à taille physique constante, quel que soit le réglage
  // d'échelle du navigateur — 60mm est la largeur minimale fiable pour
  // qu'un lecteur de code-barres standard scanne sans difficulté.
  const html = `
    <div style="width:60mm;padding:3mm;border:0.3mm solid #94a3b8;border-radius:2mm;text-align:center;font-family:Arial,sans-serif;box-sizing:border-box;line-height:1">
      <div style="font-weight:700;font-size:13px;margin-bottom:1px;word-break:break-word">${esc(p.nom)}</div>
      <div style="display:flex;justify-content:center;line-height:0">${svg}</div>
      <div style="font-family:monospace;font-size:12px;letter-spacing:1px;margin-top:1px">${esc(p.code)}</div>
      ${p.prix_vente ? `<div style="font-weight:700;font-size:14px;margin-top:1px">${fmt(p.prix_vente)}</div>` : ""}
    </div>`;
  if (printApi) printApi.open(html);
  return true;
}
