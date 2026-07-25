// ============ ÉCRAN : DIMENSIONNEMENT (solaire, garage, autre) ============
// Extrait de App.jsx lors de la factorisation. Contient les trois volets de
// dimensionnement, les blocs partagés (totaux, autres équipements, envoi du
// devis au client via WhatsApp) et leurs utilitaires.
import { useState, useEffect, useRef } from "react";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
import {
  ADRESSE_APP, chiffresTel, identifiantClient, motDePasseClient,
  fabriquerCompteClient, messagesNouveauClient, motDePasseConnu,
} from "../lib/comptesClients";
import { uid, fmt, today, telDigits, col } from "../lib/core";
import { Field, inputCls, Badge, Panel, uAlert } from "../components/ui";
import { toucher, normNom, boutiquesVente, bloquerSiLecture, noteDimensionnement } from "../lib/calculs";

// ============ OUTILS DE DIMENSIONNEMENT SOLAIRE ============
// Extrait une caractéristique numérique du nom d'un article
// (ex: "Panneau JKM 555W" -> 555 wc, "Convertisseur hybride 3KW" -> 3000 w, "Batterie 200Ah" -> 200 ah)
function specDepuisNom(nom) {
  const m = String(nom || "").match(/(\d+(?:[.,]\d+)?)\s*(kwc|wc|kw|w|kva|va|ah|kg|a|m)\b/i);
  if (!m) return null;
  let valeur = parseFloat(m[1].replace(",", "."));
  let unite = m[2].toLowerCase();
  if (unite === "kwc") { unite = "wc"; valeur *= 1000; }
  if (unite === "kw") { unite = "w"; valeur *= 1000; }
  if (unite === "kva") { unite = "va"; valeur *= 1000; }
  return { valeur, unite };
}

const estHybrideTexte = (texte) => /hybride|hybrid/i.test(texte || "");
const PRIX_RAIL = 5500;

const ROLES_EQUIPEMENT = [
  { id: "panneau", label: "Panneaux solaires", mots: ["panneau", "panel", "photovolta", "pv "], unites: ["w", "wc"] },
  { id: "batterie", label: "Batteries", mots: ["batterie", "battery", "lifepo4", "lithium"], unites: ["ah"] },
  { id: "convertisseur", label: "Convertisseur", mots: ["convertisseur", "onduleur", "inverter", "inverseur"], unites: ["w", "va"] },
  { id: "regulateur", label: "Régulateur MPPT", mots: ["régulateur", "regulateur", "mppt", "chargeur solaire", "controller"], unites: ["a"] },
];

// ============ OUTIL DE DIMENSIONNEMENT — PORTAIL / PORTE DE GARAGE MOTORISÉ ============
// Même logique que le solaire : caractéristique numérique (ici le poids en kg, ou la
// longueur en m pour la crémaillère) extraite du nom de l'article via specDepuisNom().
// « unites: [] » = accessoire compté à la pièce, sans caractéristique à comparer.
const ROLES_EQUIPEMENT_GARAGE = [
  { id: "moteur", label: "Moteur / motorisation", mots: ["moteur portail", "moteur garage", "moteur porte", "motorisation", "opérateur", "operateur", "kit motorisation"], unites: ["kg"] },
  { id: "cremaillere", label: "Crémaillère", mots: ["crémaillère", "cremaillere"], unites: ["m"] },
  { id: "telecommande", label: "Télécommande", mots: ["télécommande", "telecommande", "émetteur", "emetteur"], unites: [] },
  { id: "cellule", label: "Photocellules (cellules infrarouges)", mots: ["cellule", "photocellule", "capteur infrarouge", "cellule infrarouge"], unites: [] },
  { id: "clignotant", label: "Lampe clignotante", mots: ["clignotant", "lampe flash", "gyrophare"], unites: [] },
  { id: "verrouillage_manuel", label: "Déverrouillage manuel", mots: ["déverrouillage manuel", "deverrouillage manuel", "clé de déverrouillage", "cle de deverrouillage", "verrouillage manuel", "débrayage manuel", "debrayage manuel"], unites: [] },
];

export const TYPES_PORTAIL = [
  { id: "portail_coulissant", label: "Portail coulissant" },
  { id: "portail_battant", label: "Portail battant" },
  { id: "porte_sectionnelle", label: "Porte de garage sectionnelle" },
  { id: "porte_basculante", label: "Porte de garage basculante" },
  { id: "porte_rideau", label: "Rideau métallique" },
];

// Prix par défaut de la porte/du portail, au m² (largeur × hauteur). Modifiables par
// le vendeur lors du dimensionnement — ce sont juste des valeurs de départ.
const PRIX_PORTE_M2 = {
  portail_coulissant: 80000,
  portail_battant: 55000,
  porte_sectionnelle: 130000,
  porte_basculante: 80000,
  porte_rideau: 95000,
};

// Marge de sécurité appliquée au poids selon la fréquence d'usage quotidienne :
// un usage intensif use le moteur plus vite, on dimensionne donc plus large.
const FACTEUR_FREQUENCE = { faible: 1.1, moyenne: 1.25, intensive: 1.5 };
const LABEL_FREQUENCE = { faible: "Faible (< 10 cycles/j)", moyenne: "Moyenne (10 à 30 cycles/j)", intensive: "Intensive (> 30 cycles/j)" };

function categorieMoteur(poidsKg) {
  if (poidsKg <= 0) return "—";
  if (poidsKg <= 300) return "Léger (≤ 300 kg)";
  if (poidsKg <= 500) return "Standard (300 à 500 kg)";
  if (poidsKg <= 800) return "Robuste (500 à 800 kg)";
  return "Industriel (> 800 kg)";
}

// ============ ÉLÉMENTS PARTAGÉS ENTRE LES 3 OUTILS DE DIMENSIONNEMENT ============
// Solaire, Garage et Autre suivent tous la même mécanique de fond (besoins du
// client → équipements → remise/installation/transport → devis → envoi/vente).
// Cette section factorise les morceaux identiques pour n'avoir à les corriger
// qu'UNE fois — c'est le verrou anti-écrasement (voir useSelectionAvecVerrou)
// qui avait le bug corrigé en v2.77.1, dupliqué à l'époque dans 2 outils.

// ---- Verrou anti-écrasement : une fois qu'un article est choisi/saisi à la
// main pour un rôle/besoin donné, la recherche automatique ne doit plus jamais
// y toucher tant que le vendeur n'a pas explicitement demandé à y revenir.
// Générique pour Garage et Autre (rôles fixes ou besoins dynamiques, sans
// dépendance entre deux lignes). Le Solaire garde sa propre version : le choix
// du convertisseur y détermine si un régulateur est nécessaire, une dépendance
// entre deux rôles que cette version générique ne gère pas.
function useSelectionAvecVerrou(meilleurChoix, initial) {
  const [choix, setChoix] = useState(() => initial?.choix || {});
  const [manuelOuvert, setManuelOuvert] = useState({});
  const [brouillonManuel, setBrouillonManuel] = useState({});
  const [verrous, setVerrous] = useState(() => initial?.verrous || {});

  const recalculerNonVerrouilles = (items) => {
    setChoix((avant) => {
      const nouveau = { ...avant };
      for (const item of items) {
        if (verrous[item.id]) continue;
        const c = meilleurChoix(item);
        if (c) nouveau[item.id] = c; else delete nouveau[item.id];
      }
      return nouveau;
    });
  };

  const changerProduit = (itemId, produitId, calculerQte) => {
    setVerrous((v) => ({ ...v, [itemId]: true })); // choix explicite : plus jamais recalculé tout seul
    if (!produitId) { setChoix((avant) => { const n = { ...avant }; delete n[itemId]; return n; }); return; }
    setChoix((avant) => ({ ...avant, [itemId]: { type: "stock", produit_id: produitId, qte: calculerQte(produitId) } }));
  };

  const changerQte = (itemId, qte) => setChoix((avant) => ({ ...avant, [itemId]: { ...avant[itemId], qte: Math.max(1, Number(qte) || 1) } }));

  const ouvrirManuel = (itemId, brouillonParDefaut) => {
    setVerrous((v) => ({ ...v, [itemId]: true })); // dès l'ouverture : plus de recalcul automatique
    setManuelOuvert((v) => ({ ...v, [itemId]: true }));
    setBrouillonManuel((v) => ({ ...v, [itemId]: v[itemId] || brouillonParDefaut }));
  };
  const validerManuel = (itemId) => {
    const b = brouillonManuel[itemId];
    if (!b || !b.nom.trim() || !b.prix) { uAlert("Indiquez au moins le nom et le prix de l'article."); return; }
    setChoix((avant) => ({ ...avant, [itemId]: { type: "manuel", nom: b.nom.trim(), prix: Number(b.prix), qte: Math.max(1, Number(b.qte) || 1) } }));
    setManuelOuvert((v) => ({ ...v, [itemId]: false }));
  };
  // Repasse cet item en sélection/recherche automatique (relâche le verrou et relance meilleurChoix)
  const annulerManuel = (itemId, item) => {
    setManuelOuvert((v) => ({ ...v, [itemId]: false }));
    setVerrous((v) => { const n = { ...v }; delete n[itemId]; return n; });
    const c = item ? meilleurChoix(item) : null;
    setChoix((avant) => { const n = { ...avant }; if (c) n[itemId] = c; else delete n[itemId]; return n; });
  };

  return { choix, setChoix, manuelOuvert, brouillonManuel, setBrouillonManuel, verrous, recalculerNonVerrouilles, changerProduit, changerQte, ouvrirManuel, validerManuel, annulerManuel };
}

// ---- Bloc « Autres équipements » : lignes libres (nom + prix + quantité) ----
function BlocAutresEquipements({ titre, autres, onAjouter, onModifier, onRetirer, placeholder }) {
  return (
    <div className="px-4 py-3 border-t border-slate-200">
      <div className="font-bold text-sm text-slate-700 mb-2">{titre}</div>
      <div className="space-y-2">
        {autres.map((a) => (
          <div key={a.id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <Field label="Article"><input className={inputCls} placeholder={placeholder} value={a.nom} onChange={(e) => onModifier(a.id, "nom", e.target.value)} /></Field>
            <Field label="Prix unitaire (F)"><input type="number" className={inputCls} value={a.prix} onChange={(e) => onModifier(a.id, "prix", e.target.value)} /></Field>
            <Field label="Quantité"><input type="number" min="1" className={inputCls} value={a.qte} onChange={(e) => onModifier(a.id, "qte", e.target.value)} /></Field>
            <button onClick={() => onRetirer(a.id)} className="text-xs text-red-600 underline pb-2">Retirer</button>
          </div>
        ))}
      </div>
      <button onClick={onAjouter} className="mt-2 text-sm font-bold text-sky-800 underline">➕ Ajouter un équipement</button>
    </div>
  );
}

// ---- Bloc totaux : remise (sur les articles uniquement) → installation → transport → total ----
function BlocTotauxDevis({ totalArticles, pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis, onConvertir }) {
  return (
    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Articles :</span><span className="font-semibold">{fmt(totalArticles)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Remise</span>
          <input type="number" min="0" max="100" step="0.5" value={pctRemise} onChange={(e) => setPctRemise(e.target.value)} className="w-16 rounded border border-slate-300 px-2 py-0.5 text-right" />
          <span className="text-slate-500">% = −</span><span className="font-semibold text-red-600">{fmt(remise)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Frais d'installation</span>
          <input type="number" min="0" max="100" step="0.5" value={pctInstall} onChange={(e) => setPctInstall(e.target.value)} className="w-16 rounded border border-slate-300 px-2 py-0.5 text-right" />
          <span className="text-slate-500">% =</span><span className="font-semibold">{fmt(fraisInstallation)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Transport / livraison</span>
          <input type="number" min="0" max="100" step="0.5" value={pctTransport} onChange={(e) => setPctTransport(e.target.value)} className="w-16 rounded border border-slate-300 px-2 py-0.5 text-right" />
          <span className="text-slate-500">% =</span><span className="font-semibold">{fmt(fraisTransport)}</span>
        </div>
        <span className="text-lg font-bold text-sky-800">Total : {fmt(totalDevis)}</span>
      </div>
      <button onClick={onConvertir} className="px-5 py-2 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800">🛒 Convertir en vente</button>
    </div>
  );
}

// Calcule remise/installation/transport/total à partir du montant des articles.
// Toujours la même règle : la remise ne porte QUE sur les articles ; installation
// et transport restent calculés sur le montant plein (non réduit par la remise).
function useTotauxDevis(totalArticles) {
  const [pctRemise, setPctRemise] = useState("0");
  const remise = Math.round((totalArticles * Number(pctRemise || 0)) / 100);
  const [pctInstall, setPctInstall] = useState("10");
  const fraisInstallation = Math.round((totalArticles * Number(pctInstall || 0)) / 100);
  const [pctTransport, setPctTransport] = useState("0");
  const fraisTransport = Math.round((totalArticles * Number(pctTransport || 0)) / 100);
  const totalDevis = totalArticles - remise + fraisInstallation + fraisTransport;
  return { pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis };
}

// ---- Bloc « Envoyer le devis au client » : sélection/création du compte + bouton WhatsApp ----
function BlocEnvoiDevisClient({ db, clientDevis, setClientDevis, nouvClient, setNouvClient, comptesClients, onEnvoyer }) {
  return (
    <div className="rounded-xl p-4 bg-white border-2 border-emerald-300">
      <div className="font-bold text-emerald-900 mb-1">📲 Envoyer ce devis au client</div>
      <div className="text-xs text-slate-500 mb-3">
        Le devis est déposé dans son espace client, et WhatsApp s'ouvre avec ses identifiants et le lien. S'il n'a pas encore de compte, il est créé automatiquement : le nom et le numéro suffisent.
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 items-end">
        <Field label="Client destinataire">
          <select className={inputCls} value={clientDevis} onChange={(e) => setClientDevis(e.target.value)}>
            <option value="">— Choisir —</option>
            <option value="__nouveau__">➕ Nouveau client (nom + numéro)</option>
            {comptesClients.map((u) => <option key={u.id} value={u.id}>{u.nom_base || u.nom}{u.tel ? ` — ${u.tel}` : ""}</option>)}
          </select>
        </Field>
        {clientDevis === "__nouveau__" && (
          <>
            <Field label="Nom du client">
              <input className={inputCls} placeholder="KOFFI AMA" value={nouvClient.nom} onChange={(e) => setNouvClient({ ...nouvClient, nom: e.target.value })} />
            </Field>
            <Field label="Numéro WhatsApp">
              <input type="tel" className={inputCls} placeholder="+228 90 55 44 33" value={nouvClient.tel} onChange={(e) => setNouvClient({ ...nouvClient, tel: e.target.value })} />
            </Field>
          </>
        )}
      </div>

      {clientDevis === "__nouveau__" && nouvClient.nom && chiffresTel(nouvClient.tel).length >= 4 && (
        <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs">
          Compte qui sera créé — identifiant : <b>{identifiantClient(db, nouvClient.nom, nouvClient.tel)}</b> · mot de passe : <b>{motDePasseClient(nouvClient.nom, nouvClient.tel)}</b>
        </div>
      )}

      <button onClick={onEnvoyer} disabled={!clientDevis} className={`mt-3 px-5 py-2 rounded-lg font-bold text-sm ${clientDevis ? "bg-green-600 text-white hover:bg-green-700" : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}>
        📲 Envoyer par WhatsApp
      </button>
    </div>
  );
}

// Résout le compte client destinataire : crée un compte à la volée (nom + tel) ou
// récupère un compte existant. Retourne null (une alerte a déjà été affichée) en
// cas de saisie invalide, sinon { compte, motDePasse, dbApres }.
async function resoudreClientDevis(db, clientDevis, nouvClient, profile) {
  if (clientDevis === "__nouveau__") {
    const nom = nouvClient.nom.trim();
    const tel = nouvClient.tel.trim();
    if (!nom || chiffresTel(tel).length < 4) {
      uAlert("Pour créer le compte, il faut le nom du client et son numéro (au moins 4 chiffres).");
      return null;
    }
    const fab = await fabriquerCompteClient(db, nom, tel, profile.nom);
    return {
      compte: fab.user, motDePasse: fab.motDePasse,
      dbApres: { ...db, users: [...db.users, fab.user], messages: [...messagesNouveauClient(db, fab.user, profile), ...(db.messages || [])] },
    };
  }
  const compte = db.users.find((u) => u.id === clientDevis);
  if (!compte) { uAlert("Choisissez le client à qui envoyer ce devis."); return null; }
  return { compte, motDePasse: motDePasseConnu(compte), dbApres: db };
}

// Enregistre le devis dans la fiche du client puis ouvre WhatsApp avec ses
// identifiants et le lien vers son espace. `ligneEntete` = les 1-2 lignes
// spécifiques à l'outil (type d'installation + montant), le reste du message
// (identifiants, lien, signature) est commun aux 3 outils.
function envoyerDevisEtOuvrirWhatsApp({ dbApres, compte, motDePasse, devis, save, profile, nouvClient, ligneEntete, idAReprendre }) {
  const dbFinal = {
    ...dbApres,
    users: dbApres.users.map((u) => (u.id === compte.id
      ? { ...u, devis: idAReprendre ? u.devis.map((x) => (x.id === idAReprendre ? { ...devis, id: idAReprendre } : x)) : [devis, ...(u.devis || [])] }
      : u)),
    // Le message de demande de modification / rejet n'a plus lieu d'être : le vendeur vient d'y répondre.
    messages: idAReprendre ? (dbApres.messages || []).filter((m) => m.devis_id !== idAReprendre) : dbApres.messages,
  };
  save(dbFinal, idAReprendre
    ? `Devis corrigé (${fmt(devis.total)}) renvoyé au client ${compte.nom} par ${profile.nom}`
    : `Devis (${fmt(devis.total)}) envoyé au client ${compte.nom} par ${profile.nom}`);

  const lignesMsg = [
    `Bonjour${compte.nom_base ? " " + compte.nom_base : ""}, voici votre devis BMI TOGO${idAReprendre ? ", corrigé selon votre demande" : ""}.`,
    ``,
    ...ligneEntete,
    ``,
    `Consultez le détail dans votre espace client :`,
    ADRESSE_APP,
    ``,
    `👤 Identifiant : *${compte.nom}*`,
    motDePasse ? `🔑 Mot de passe : *${motDePasse}*` : `🔑 Mot de passe : celui qui vous a été communiqué`,
    ``,
    `À bientôt !`,
    `BMI TOGO — Les bâtiments modernes et intelligents`,
  ];
  const num = telDigits(compte.tel || nouvClient.tel);
  const txt = encodeURIComponent(lignesMsg.join("\n"));
  window.open(num ? `https://wa.me/${num}?text=${txt}` : `https://wa.me/?text=${txt}`, "_blank");
}

function DimensionnementSolaire({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const produitsBoutique = db.produits.filter((p) => p.boutique === boutique);

  // ---- Besoins du client (liste d'appareils) ----
  // Si on reprend un devis (modification/rejet), on repart de ses besoins d'origine.
  const besoinsRepris = devisAReprendre?.devis?.besoins;
  const lignesReprises = devisAReprendre?.devis?.lignes || [];
  const [appareils, setAppareils] = useState(() =>
    besoinsRepris?.appareils?.length
      ? besoinsRepris.appareils.map((a) => ({ id: uid(), nom: a.nom, puissance: String(a.puissance), heures: String(a.heures), qte: String(a.qte || 1) }))
      : [{ id: uid(), nom: "", puissance: "", heures: "", qte: "1" }]
  );
  const [autonomie, setAutonomie] = useState(() => besoinsRepris?.autonomie ? String(besoinsRepris.autonomie) : "1");
  const [soleil, setSoleil] = useState("5");
  const [tension, setTension] = useState(() => besoinsRepris?.tension ? String(besoinsRepris.tension) : "24");
  const [typeBatterie, setTypeBatterie] = useState(() => besoinsRepris?.type_batterie || "lifepo4");

  const majAppareil = (id, champ, val) => setAppareils(appareils.map((a) => (a.id === id ? { ...a, [champ]: val } : a)));
  const ajouterAppareil = () => setAppareils([...appareils, { id: uid(), nom: "", puissance: "", heures: "", qte: "1" }]);
  const retirerAppareil = (id) => setAppareils(appareils.filter((a) => a.id !== id));

  const whParJour = appareils.reduce((s, a) => s + Number(a.puissance || 0) * Number(a.heures || 0) * Number(a.qte || 1), 0);
  const puissanceSimultanee = appareils.reduce((s, a) => s + Number(a.puissance || 0) * Number(a.qte || 1), 0);

  // ---- Calculs de dimensionnement (indicatifs, avec marges de sécurité usuelles) ----
  const dod = typeBatterie === "lifepo4" ? 0.9 : 0.5;
  const rendementSysteme = 0.8;

  const wcPanneaux = soleil > 0 ? Math.ceil(whParJour / Number(soleil) / rendementSysteme) : 0;
  const whBatterie = whParJour * Number(autonomie || 1);
  const ahBatterie = tension > 0 ? Math.ceil(whBatterie / Number(tension) / dod) : 0;
  const wConvertisseur = Math.ceil(puissanceSimultanee * 2); // marge : somme des puissances × 2
  const kwConvertisseur = wConvertisseur / 1000;
  const aRegulateur = tension > 0 ? Math.ceil((wcPanneaux / Number(tension)) * 1.25) : 0;

  const besoinParRole = { panneau: wcPanneaux, batterie: ahBatterie, convertisseur: wConvertisseur, regulateur: aRegulateur };

  const candidats = (role) => produitsBoutique
    .map((p) => ({ p, spec: specDepuisNom(p.nom + " " + (p.categorie || "")) }))
    .filter(({ p, spec }) => {
      const texte = (p.nom + " " + (p.categorie || "")).toLowerCase();
      const motCorrespond = role.mots.some((m) => texte.includes(m));
      const uniteOk = spec && role.unites.includes(spec.unite);
      return motCorrespond && uniteOk;
    });

  // Panneaux/batteries : le plus gros calibre dispo (on empile plusieurs unités).
  // Convertisseur/régulateur : le plus PETIT modèle qui couvre le besoin (un seul article,
  // inutile de payer un calibre surdimensionné) ; si aucun ne suffit seul, on prend le plus
  // gros dispo et on complète avec plusieurs unités.
  const empilable = (roleId) => roleId === "panneau" || roleId === "batterie";

  const meilleurChoix = (role) => {
    const options = candidats(role).sort((a, b) => a.spec.valeur - b.spec.valeur);
    const besoin = besoinParRole[role.id];
    if (options.length === 0 || besoin <= 0) return null;

    if (!empilable(role.id)) {
      const suffisant = options.find((o) => o.spec.valeur >= besoin);
      if (suffisant) return { type: "stock", produit_id: suffisant.p.id, qte: 1 };
      // Aucun modèle seul ne suffit : on prend le plus gros et on complète en quantité
      const plusGros = options[options.length - 1];
      const qte = Math.min(50, Math.max(1, Math.ceil(besoin / plusGros.spec.valeur)));
      return { type: "stock", produit_id: plusGros.p.id, qte };
    }

    const meilleur = options[options.length - 1];
    const qte = Math.min(50, Math.max(1, Math.ceil(besoin / meilleur.spec.valeur)));
    return { type: "stock", produit_id: meilleur.p.id, qte };
  };

  // choix[roleId] = { type: "stock", produit_id, qte } OU { type: "manuel", nom, prix, qte }
  // Reconstruit les équipements déjà choisis depuis les lignes RÉELLES du devis
  // repris — restitue aussi ceux saisis directement à la main.
  const initialSelectionSolaire = (() => {
    if (!lignesReprises.length || !devisAReprendre) return null;
    const choix = {}, verrous = {};
    ROLES_EQUIPEMENT.forEach((role) => {
      const ligne = lignesReprises.find((l) => l.categorie === role.label);
      if (!ligne) return;
      const options = candidats(role);
      const trouve = options.find((o) => o.p.nom === ligne.article);
      choix[role.id] = trouve
        ? { type: "stock", produit_id: trouve.p.id, qte: Number(ligne.qte) || 1 }
        : { type: "manuel", nom: ligne.article, prix: Number(ligne.pu) || 0, qte: Number(ligne.qte) || 1 };
      verrous[role.id] = true;
    });
    return { choix, verrous };
  })();
  const [choix, setChoix] = useState(() => initialSelectionSolaire?.choix || {});
  const [manuelOuvert, setManuelOuvert] = useState({}); // { roleId: bool } — affiche le mini-formulaire de saisie libre
  const [brouillonManuel, setBrouillonManuel] = useState({}); // { roleId: { nom, prix, qte } }
  // Rôles que le vendeur a choisi de saisir/sélectionner lui-même : la sélection
  // automatique ne doit plus jamais y toucher tant qu'il ne revient pas en arrière.
  const [rolesManuels, setRolesManuels] = useState(() => initialSelectionSolaire?.verrous || {});

  useEffect(() => {
    setChoix((avant) => {
      const nouveauChoix = { ...avant };
      for (const role of ROLES_EQUIPEMENT) {
        if (rolesManuels[role.id]) continue; // ne pas écraser un choix fait à la main
        if (role.id === "regulateur") {
          const convChoice = nouveauChoix.convertisseur;
          const conv = convChoice?.type === "stock" && produitsBoutique.find((p) => p.id === convChoice.produit_id);
          const hybride = convChoice?.type === "manuel" ? estHybrideTexte(convChoice.nom) : !!(conv && estHybrideTexte(conv.nom + " " + (conv.categorie || "")));
          if (hybride) { delete nouveauChoix.regulateur; continue; }
        }
        const c = meilleurChoix(role);
        if (c) nouveauChoix[role.id] = c; else delete nouveauChoix[role.id];
      }
      return nouveauChoix;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whParJour, autonomie, soleil, tension, typeBatterie, boutique, db.produits]);

  const produitConvertisseurChoisi = choix.convertisseur?.type === "stock" && produitsBoutique.find((p) => p.id === choix.convertisseur.produit_id);
  const convertisseurEstHybride = choix.convertisseur?.type === "manuel"
    ? estHybrideTexte(choix.convertisseur.nom)
    : !!(produitConvertisseurChoisi && estHybrideTexte(produitConvertisseurChoisi.nom + " " + (produitConvertisseurChoisi.categorie || "")));

  const ligneRole = (role) => {
    const c = choix[role.id];
    if (!c) return { role, produit: null, qte: 0, sousTotal: 0 };
    if (c.type === "manuel") return { role, produit: { nom: c.nom, prix_vente: c.prix, manuel: true }, qte: c.qte, sousTotal: c.prix * c.qte };
    const p = produitsBoutique.find((x) => x.id === c.produit_id);
    return p ? { role, produit: p, qte: c.qte, sousTotal: p.prix_vente * c.qte } : { role, produit: null, qte: 0, sousTotal: 0 };
  };

  const lignesDevis = ROLES_EQUIPEMENT.map(ligneRole);
  const totalRoles = lignesDevis.reduce((s, l) => s + l.sousTotal, 0);

  const changerProduit = (roleId, produitId) => {
    setRolesManuels({ ...rolesManuels, [roleId]: true }); // choix explicite : on ne le recalcule plus tout seul
    if (!produitId) { const c2 = { ...choix }; delete c2[roleId]; setChoix(c2); return; }
    const p = produitsBoutique.find((x) => x.id === produitId);
    const spec = p ? specDepuisNom(p.nom + " " + (p.categorie || "")) : null;
    const besoin = besoinParRole[roleId];
    const qte = spec && spec.valeur > 0
      ? (!empilable(roleId) && spec.valeur >= besoin ? 1 : Math.min(50, Math.max(1, Math.ceil(besoin / spec.valeur))))
      : 1;
    const nouveauChoix = { ...choix, [roleId]: { type: "stock", produit_id: produitId, qte } };
    if (roleId === "convertisseur") {
      const hybride = p && estHybrideTexte(p.nom + " " + (p.categorie || ""));
      if (hybride) delete nouveauChoix.regulateur;
      else { const c = meilleurChoix(ROLES_EQUIPEMENT.find((r) => r.id === "regulateur")); if (c) nouveauChoix.regulateur = c; else delete nouveauChoix.regulateur; }
    }
    setChoix(nouveauChoix);
  };

  const changerQte = (roleId, qte) => setChoix({ ...choix, [roleId]: { ...choix[roleId], qte: Math.max(1, Number(qte) || 1) } });

  const ouvrirManuel = (roleId) => {
    setRolesManuels({ ...rolesManuels, [roleId]: true }); // dès l'ouverture : la sélection automatique n'y touche plus
    setManuelOuvert({ ...manuelOuvert, [roleId]: true });
    setBrouillonManuel({ ...brouillonManuel, [roleId]: brouillonManuel[roleId] || { nom: "", prix: "", qte: "1" } });
  };
  const validerManuel = (roleId) => {
    const b = brouillonManuel[roleId];
    if (!b || !b.nom.trim() || !b.prix) { uAlert("Indiquez au moins le nom et le prix de l'article."); return; }
    const nouveauChoix = { ...choix, [roleId]: { type: "manuel", nom: b.nom.trim(), prix: Number(b.prix), qte: Math.max(1, Number(b.qte) || 1) } };
    if (roleId === "convertisseur" && !estHybrideTexte(b.nom)) {
      const c = meilleurChoix(ROLES_EQUIPEMENT.find((r) => r.id === "regulateur"));
      if (c) nouveauChoix.regulateur = c;
    }
    if (roleId === "convertisseur" && estHybrideTexte(b.nom)) delete nouveauChoix.regulateur;
    setChoix(nouveauChoix);
    setManuelOuvert({ ...manuelOuvert, [roleId]: false });
  };
  // Repasse ce rôle en sélection automatique (relâche le verrou et relance meilleurChoix)
  const annulerManuel = (roleId) => {
    setManuelOuvert({ ...manuelOuvert, [roleId]: false });
    setRolesManuels((v) => { const n = { ...v }; delete n[roleId]; return n; });
    const role = ROLES_EQUIPEMENT.find((r) => r.id === roleId);
    const c = role ? meilleurChoix(role) : null;
    const nouveauChoix = { ...choix };
    if (c) nouveauChoix[roleId] = c; else delete nouveauChoix[roleId];
    if (roleId === "convertisseur") {
      const p = c?.type === "stock" && produitsBoutique.find((x) => x.id === c.produit_id);
      const hybride = p && estHybrideTexte(p.nom + " " + (p.categorie || ""));
      if (hybride) delete nouveauChoix.regulateur;
      else if (!rolesManuels.regulateur) { const cr = meilleurChoix(ROLES_EQUIPEMENT.find((r) => r.id === "regulateur")); if (cr) nouveauChoix.regulateur = cr; else delete nouveauChoix.regulateur; }
    }
    setChoix(nouveauChoix);
  };

  // ---- Rails de fixation : quantité et prix calculés automatiquement ----
  // Formule : (nombre de panneaux × 2,2) ÷ 4,2 = quantité de rails ; prix fixe 5 500 F/rail
  const nombrePanneaux = choix.panneau?.qte || 0;
  const ligneRailsReprise = lignesReprises.find((l) => l.categorie === "Rails de fixation");
  const [railsQte, setRailsQte] = useState(ligneRailsReprise ? Number(ligneRailsReprise.qte) : 0);
  const premierRenduRails = useRef(true);
  useEffect(() => {
    if (premierRenduRails.current) { premierRenduRails.current = false; return; } // ne pas écraser la reprise au montage
    setRailsQte(nombrePanneaux > 0 ? Math.ceil(nombrePanneaux * 2.2) : 0);
  }, [nombrePanneaux]);
  const sousTotalRails = railsQte * PRIX_RAIL;

  // ---- Autres équipements : câbles, protections AC/DC, accessoires (saisie libre) ----
  const [autres, setAutres] = useState(() =>
    lignesReprises.filter((l) => l.categorie === "Autres équipements")
      .map((l) => ({ id: uid(), nom: l.article, prix: String(l.pu), qte: String(l.qte) }))
  );
  const ajouterAutre = () => setAutres([...autres, { id: uid(), nom: "", prix: "", qte: "1" }]);
  const majAutre = (id, champ, val) => setAutres(autres.map((a) => (a.id === id ? { ...a, [champ]: val } : a)));
  const retirerAutre = (id) => setAutres(autres.filter((a) => a.id !== id));
  const totalAutres = autres.reduce((s, a) => s + Number(a.prix || 0) * Number(a.qte || 1), 0);

  const totalArticles = totalRoles + sousTotalRails + totalAutres;
  const { pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis } = useTotauxDevis(totalArticles);

  // ============ ENVOYER LE DEVIS DANS L'ESPACE DU CLIENT ============
  const [clientDevis, setClientDevis] = useState(() => devisAReprendre?.client?.id || "");   // compte client existant
  const [nouvClient, setNouvClient] = useState({ nom: "", tel: "" });
  const comptesClients = db.users.filter((u) => u.role === "client" && u.actif !== false);

  const envoyerDevisWhatsApp = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (totalDevis <= 0) { uAlert("Le devis est vide : choisissez d'abord les équipements."); return; }

    const resolu = await resoudreClientDevis(db, clientDevis, nouvClient, profile);
    if (!resolu) return;
    const { compte, motDePasse, dbApres } = resolu;

    // Le panier prêt à encaisser : le vendeur n'aura rien à ressaisir.
    const panier = [
      ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente })),
      ...(railsQte > 0 ? [{ produit_id: null, article: "Rails de fixation", qte: railsQte, pu: PRIX_RAIL }] : []),
      ...autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({ produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix) })),
    ];

    // Le devis, rangé DANS la fiche du client : aucune migration de base.
    const devis = {
      id: uid(),
      date: today(),
      heure: new Date().toTimeString().slice(0, 5),
      par: profile.nom,
      par_id: profile.id,
      par_role: profile.role,           // décide si une commission sera due
      statut: "propose",                // propose → valide → paye
      panier,                           // ce que le vendeur encaissera
      boutique,
      besoins: {
        wh_jour: whParJour,
        puissance_simultanee: puissanceSimultanee,
        autonomie: Number(autonomie || 1),
        tension: Number(tension),
        type_batterie: typeBatterie,
        appareils: appareils.filter((a) => a.nom && a.puissance).map((a) => ({
          nom: a.nom, puissance: Number(a.puissance), heures: Number(a.heures || 0), qte: Number(a.qte || 1),
        })),
      },
      lignes: [
        ...lignesDevis.filter((l) => l.produit).map((l) => ({
          categorie: l.role.label, article: l.produit.nom, qte: l.qte,
          pu: l.produit.prix_vente, total: l.sousTotal,
        })),
        ...(railsQte > 0 ? [{ categorie: "Rails de fixation", article: "Rail de fixation", qte: railsQte, pu: PRIX_RAIL, total: sousTotalRails }] : []),
        ...autres.filter((a) => a.nom).map((a) => ({
          categorie: "Autres équipements", article: a.nom, qte: Number(a.qte || 1),
          pu: Number(a.prix || 0), total: Number(a.prix || 0) * Number(a.qte || 1),
        })),
        ...(fraisInstallation > 0 ? [{ categorie: "Installation", article: `Frais d'installation (${pctInstall} %)`, qte: 1, pu: fraisInstallation, total: fraisInstallation }] : []),
        ...(fraisTransport > 0 ? [{ categorie: "Transport", article: `Transport / livraison (${pctTransport} %)`, qte: 1, pu: fraisTransport, total: fraisTransport }] : []),
        ...(remise > 0 ? [{ categorie: "Remise", article: `Remise (${pctRemise} %)`, qte: 1, pu: -remise, total: -remise }] : []),
      ],
      total: totalDevis,
      frais_installation: fraisInstallation,
      pct_installation: Number(pctInstall || 0),
      frais_transport: fraisTransport,
      pct_transport: Number(pctTransport || 0),
      remise,
      pct_remise: Number(pctRemise || 0),
    };

    envoyerDevisEtOuvrirWhatsApp({
      dbApres, compte, motDePasse, devis, save, profile, nouvClient,
      ligneEntete: [`☀️ Installation solaire — *${fmt(totalDevis)}*`, `Besoin estimé : ${Math.round(whParJour)} Wh/jour`],
      idAReprendre: devisAReprendre?.devis?.id,
    });

    setClientDevis("");
    setNouvClient({ nom: "", tel: "" });
    if (devisAReprendre && onDevisRepriseConsomme) onDevisRepriseConsomme();
    uAlert(`✅ Devis envoyé dans l'espace de ${compte.nom}.\n\nWhatsApp s'ouvre avec ses identifiants et le lien.`);
  };


  const convertir = () => {
    const panier = [
      ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente })),
      ...(railsQte > 0 ? [{ produit_id: null, article: "Rails de fixation", qte: railsQte, pu: PRIX_RAIL }] : []),
      ...autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({ produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix) })),
    ];
    if (panier.length === 0) { uAlert("Aucun équipement sélectionné à convertir."); return; }
    onConvertirEnVente(boutique, panier, Number(pctRemise || 0));
  };

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}

      <Panel boutique={boutique}>
        <div className="font-bold mb-3">☀️ Besoins électriques du client <Badge boutique={boutique} /></div>
        <div className="space-y-2">
          {appareils.map((a) => (
            <div key={a.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
              <Field label="Appareil"><input className={inputCls} placeholder="Ex : Téléviseur" value={a.nom} onChange={(e) => majAppareil(a.id, "nom", e.target.value)} /></Field>
              <Field label="Puissance (W)"><input type="number" className={inputCls} value={a.puissance} onChange={(e) => majAppareil(a.id, "puissance", e.target.value)} /></Field>
              <Field label="Heures/jour"><input type="number" className={inputCls} value={a.heures} onChange={(e) => majAppareil(a.id, "heures", e.target.value)} /></Field>
              <Field label="Quantité"><input type="number" min="1" className={inputCls} value={a.qte} onChange={(e) => majAppareil(a.id, "qte", e.target.value)} /></Field>
              <button onClick={() => retirerAppareil(a.id)} className="text-xs text-red-600 underline pb-2">Retirer</button>
            </div>
          ))}
        </div>
        <button onClick={ajouterAppareil} className="mt-2 text-sm font-bold text-sky-800 underline">➕ Ajouter un appareil</button>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Field label="Autonomie souhaitée (jours)"><input type="number" min="1" className={inputCls} value={autonomie} onChange={(e) => setAutonomie(e.target.value)} /></Field>
          <Field label="Ensoleillement (h/jour)"><input type="number" className={inputCls} value={soleil} onChange={(e) => setSoleil(e.target.value)} /></Field>
          <Field label="Tension du système">
            <select className={inputCls} value={tension} onChange={(e) => setTension(e.target.value)}>
              <option value="12">12 V</option><option value="24">24 V</option><option value="48">48 V</option>
            </select>
          </Field>
          <Field label="Type de batterie">
            <select className={inputCls} value={typeBatterie} onChange={(e) => setTypeBatterie(e.target.value)}>
              <option value="lifepo4">LiFePO4 (lithium)</option><option value="plomb">Plomb / AGM</option>
            </select>
          </Field>
        </div>
      </Panel>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Consommation</div>
          <div className="text-xl font-bold tabular-nums mt-1">{Math.round(whParJour)} Wh/j</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Panneaux nécessaires</div>
          <div className="text-xl font-bold tabular-nums mt-1">{wcPanneaux} Wc</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Batterie ({tension}V)</div>
          <div className="text-xl font-bold tabular-nums mt-1">{ahBatterie} Ah</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Convertisseur{!convertisseurEstHybride ? " / MPPT" : ""}</div>
          <div className="text-xl font-bold tabular-nums mt-1">{kwConvertisseur.toFixed(2)} kW{!convertisseurEstHybride ? ` · ${aRegulateur} A` : ""}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Équipements proposés (stock de {boutique})</div>
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Catégorie", "Article", "Besoin calculé", "Quantité", "Prix unit.", "Sous-total"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {lignesDevis.map((l) => {
              if (l.role.id === "regulateur" && convertisseurEstHybride) {
                return (
                  <tr key={l.role.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold">{l.role.label}</td>
                    <td className="px-3 py-2 text-xs text-green-700">✓ Intégré au convertisseur hybride — pas d'article séparé nécessaire</td>
                    <td className="px-3 py-2 text-slate-400">—</td><td className="px-3 py-2 text-slate-400">—</td><td className="px-3 py-2 text-slate-400">—</td>
                    <td className="px-3 py-2 tabular-nums text-slate-400">{fmt(0)}</td>
                  </tr>
                );
              }
              const options = candidats(l.role);
              const besoinAffiche = l.role.id === "convertisseur" ? `${(besoinParRole[l.role.id] / 1000).toFixed(2)} kW` : `${besoinParRole[l.role.id]}${l.role.id === "regulateur" ? " A" : ""}`;
              const enManuel = manuelOuvert[l.role.id] || (l.produit?.manuel);
              return (
                <tr key={l.role.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{l.role.label}</td>
                  <td className="px-3 py-2">
                    {enManuel ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <input className={`${inputCls} w-40`} placeholder="Nom de l'article" value={brouillonManuel[l.role.id]?.nom ?? l.produit?.nom ?? ""} onChange={(e) => setBrouillonManuel({ ...brouillonManuel, [l.role.id]: { ...(brouillonManuel[l.role.id] || { qte: "1" }), nom: e.target.value } })} />
                        <input type="number" className={`${inputCls} w-24`} placeholder="Prix (F)" value={brouillonManuel[l.role.id]?.prix ?? l.produit?.prix_vente ?? ""} onChange={(e) => setBrouillonManuel({ ...brouillonManuel, [l.role.id]: { ...(brouillonManuel[l.role.id] || { nom: l.produit?.nom || "" }), prix: e.target.value } })} />
                        <button onClick={() => validerManuel(l.role.id)} className="text-xs font-bold text-white bg-sky-800 rounded-lg px-3 py-1.5">Valider</button>
                        <button onClick={() => annulerManuel(l.role.id)} className="text-xs text-slate-500 underline">Annuler (revenir à la sélection automatique)</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {options.length === 0 ? (
                          <span className="text-xs text-orange-600">Aucun article correspondant dans le stock de {boutique}</span>
                        ) : (
                          <select className={inputCls} value={l.produit && !l.produit.manuel ? l.produit.id : ""} onChange={(e) => changerProduit(l.role.id, e.target.value)}>
                            <option value="">— Aucun —</option>
                            {options.map(({ p, spec }) => <option key={p.id} value={p.id}>{p.nom} ({spec.valeur >= 1000 ? (spec.valeur / 1000).toFixed(1) + "k" : spec.valeur}{spec.unite}){estHybrideTexte(p.nom) ? " — hybride" : ""}</option>)}
                          </select>
                        )}
                        <button onClick={() => ouvrirManuel(l.role.id)} className="text-xs font-bold text-sky-800 underline whitespace-nowrap">✏️ Saisir un article hors stock</button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-500 whitespace-nowrap">{besoinAffiche}</td>
                  <td className="px-3 py-2"><input type="number" min="0" className={`${inputCls} w-20`} value={l.qte} disabled={!l.produit} onChange={(e) => changerQte(l.role.id, e.target.value)} /></td>
                  <td className="px-3 py-2 tabular-nums">{l.produit ? fmt(l.produit.prix_vente) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.sousTotal)}</td>
                </tr>
              );
            })}

            {/* Rails de fixation : quantité et prix calculés automatiquement */}
            <tr className="border-t border-slate-100 bg-amber-50/40">
              <td className="px-3 py-2 font-semibold whitespace-nowrap">Rails de fixation</td>
              <td className="px-3 py-2 text-xs text-slate-500">Calculé automatiquement : {nombrePanneaux} panneaux × 2,2</td>
              <td className="px-3 py-2 text-slate-400">—</td>
              <td className="px-3 py-2"><input type="number" min="0" className={`${inputCls} w-20`} value={railsQte} onChange={(e) => setRailsQte(Math.max(0, Number(e.target.value) || 0))} /></td>
              <td className="px-3 py-2 tabular-nums">{fmt(PRIX_RAIL)}</td>
              <td className="px-3 py-2 tabular-nums font-bold">{fmt(sousTotalRails)}</td>
            </tr>
          </tbody>
        </table>

        <BlocAutresEquipements
          titre="Autres équipements (câbles, protections AC/DC, accessoires…)"
          autres={autres} onAjouter={ajouterAutre} onModifier={majAutre} onRetirer={retirerAutre}
          placeholder="Ex : Câble 6mm² (rouleau)"
        />

        <BlocTotauxDevis
          totalArticles={totalArticles}
          pctRemise={pctRemise} setPctRemise={setPctRemise} remise={remise}
          pctInstall={pctInstall} setPctInstall={setPctInstall} fraisInstallation={fraisInstallation}
          pctTransport={pctTransport} setPctTransport={setPctTransport} fraisTransport={fraisTransport}
          totalDevis={totalDevis} onConvertir={convertir}
        />
      </div>

      {/* ---- ENVOYER LE DEVIS AU CLIENT ---- */}
      <BlocEnvoiDevisClient
        db={db} clientDevis={clientDevis} setClientDevis={setClientDevis}
        nouvClient={nouvClient} setNouvClient={setNouvClient}
        comptesClients={comptesClients} onEnvoyer={envoyerDevisWhatsApp}
      />


      {noteDimensionnement(db) && (
        <div className="text-xs text-slate-400 whitespace-pre-line">
          {noteDimensionnement(db)}
        </div>
      )}
    </div>
  );
}

// ============ SÉLECTEUR : Dimensionnement Solaire, Garage ou Autre ============
// Point d'entrée affiché dans l'onglet « Dimensionnement ». Un simple aiguillage
// entre les trois outils, qui partagent la même mécanique (besoins du
// client → équipements proposés depuis le stock → devis → envoi WhatsApp / vente).
export function Dimensionnement({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme }) {
  const [mode, setMode] = useState("solaire");
  // Bascule automatiquement sur le bon outil dès qu'un devis à reprendre arrive.
  useEffect(() => {
    if (devisAReprendre) setMode(devisAReprendre.devis.type_devis === "garage" ? "garage" : devisAReprendre.devis.type_devis === "autre" ? "autre" : "solaire");
  }, [devisAReprendre]);
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 shadow-sm">
        <button onClick={() => setMode("solaire")} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === "solaire" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>☀️ Solaire</button>
        <button onClick={() => setMode("garage")} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === "garage" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>🚪 Garage</button>
        <button onClick={() => setMode("autre")} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === "autre" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>📦 Autre</button>
      </div>
      {devisAReprendre && (
        <div className="rounded-xl p-3 bg-amber-50 border-2 border-amber-300 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-amber-900">
            <b>✏️ Reprise du devis de {devisAReprendre.client?.nom_base || devisAReprendre.client?.nom}</b> ({fmt(devisAReprendre.devis.total)})
            {devisAReprendre.devis.demande_modif && <span> — souhaite : « {devisAReprendre.devis.demande_modif} »</span>}
            {devisAReprendre.devis.motif_rejet && <span> — avait rejeté : « {devisAReprendre.devis.motif_rejet} »</span>}
          </div>
          <button onClick={onDevisRepriseConsomme} className="text-xs font-bold text-amber-700 underline whitespace-nowrap">Annuler la reprise</button>
        </div>
      )}
      {mode === "solaire" && <DimensionnementSolaire db={db} profile={profile} save={save} onConvertirEnVente={onConvertirEnVente} devisAReprendre={devisAReprendre?.devis?.type_devis !== "garage" && devisAReprendre?.devis?.type_devis !== "autre" ? devisAReprendre : null} onDevisRepriseConsomme={onDevisRepriseConsomme} />}
      {mode === "garage" && <DimensionnementGarage db={db} profile={profile} save={save} onConvertirEnVente={onConvertirEnVente} devisAReprendre={devisAReprendre?.devis?.type_devis === "garage" ? devisAReprendre : null} onDevisRepriseConsomme={onDevisRepriseConsomme} />}
      {mode === "autre" && <DimensionnementAutre db={db} profile={profile} save={save} onConvertirEnVente={onConvertirEnVente} devisAReprendre={devisAReprendre?.devis?.type_devis === "autre" ? devisAReprendre : null} onDevisRepriseConsomme={onDevisRepriseConsomme} />}
    </div>
  );
}

// ============ OUTIL DE DIMENSIONNEMENT — PORTAIL / PORTE DE GARAGE MOTORISÉ ============
function DimensionnementGarage({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const produitsBoutique = db.produits.filter((p) => p.boutique === boutique);

  // ---- Besoins du client ----
  // Si on reprend un devis (modification/rejet), on repart de ses besoins d'origine.
  const besoinsRepris = devisAReprendre?.devis?.besoins;
  const lignesReprises = devisAReprendre?.devis?.lignes || [];
  const [type, setType] = useState(besoinsRepris?.type_ouvrant || "portail_coulissant");
  const [largeur, setLargeur] = useState(besoinsRepris?.largeur ? String(besoinsRepris.largeur) : "");
  const [hauteur, setHauteur] = useState(besoinsRepris?.hauteur ? String(besoinsRepris.hauteur) : "");
  const [poids, setPoids] = useState(besoinsRepris?.poids ? String(besoinsRepris.poids) : "");
  const [vantaux, setVantaux] = useState(besoinsRepris?.vantaux ? String(besoinsRepris.vantaux) : "1");
  const [frequence, setFrequence] = useState(besoinsRepris?.frequence || "moyenne");
  const [telecosSouhaitees, setTelecosSouhaitees] = useState(besoinsRepris?.telecommandes != null ? String(besoinsRepris.telecommandes) : "2");
  const [alimentationProche, setAlimentationProche] = useState(besoinsRepris?.alimentation_proche != null ? besoinsRepris.alimentation_proche : true);

  const estCoulissant = type === "portail_coulissant";
  const estBattant = type === "portail_battant";

  // ---- Calculs de dimensionnement (indicatifs, avec marge de sécurité selon l'usage) ----
  const poidsAjuste = Math.ceil(Number(poids || 0) * (FACTEUR_FREQUENCE[frequence] || 1.25));
  const longueurCremaillere = estCoulissant && Number(largeur) > 0 ? Math.ceil(Number(largeur) + 1) : 0; // +1 m de marge

  // ---- Porte / portail : calculée automatiquement au m² (largeur × hauteur), prix modifiable ----
  const [prixM2Porte, setPrixM2Porte] = useState(besoinsRepris?.prix_m2_porte || PRIX_PORTE_M2[type] || 0);
  const premierRenduPorte = useRef(true);
  useEffect(() => {
    if (premierRenduPorte.current) { premierRenduPorte.current = false; return; } // ne pas écraser la reprise au montage
    setPrixM2Porte(PRIX_PORTE_M2[type] || 0);
  }, [type]);
  const surfacePorte = Math.round(Number(largeur || 0) * Number(hauteur || 0) * 100) / 100;
  const sousTotalPorte = Math.round(surfacePorte * Number(prixM2Porte || 0));

  const besoinParRole = {
    moteur: poidsAjuste,
    cremaillere: longueurCremaillere,
    telecommande: Math.max(0, Number(telecosSouhaitees || 0)),
    cellule: 2,
    clignotant: 1,
    verrouillage_manuel: 1,
  };

  const roleActif = (role) => role.id !== "cremaillere" || estCoulissant;

  const candidats = (role) => produitsBoutique
    .map((p) => ({ p, spec: specDepuisNom(p.nom + " " + (p.categorie || "")) }))
    .filter(({ p, spec }) => {
      const texte = (p.nom + " " + (p.categorie || "")).toLowerCase();
      const motCorrespond = role.mots.some((m) => texte.includes(m));
      if (!motCorrespond) return false;
      if (role.unites.length === 0) return true; // accessoire compté à la pièce : pas de spec à vérifier
      return spec && role.unites.includes(spec.unite);
    });

  const empilable = (roleId) => roleId === "cremaillere"; // seule la crémaillère s'empile (barres de 1 m)

  const meilleurChoix = (role) => {
    if (!roleActif(role)) return null;
    const besoin = besoinParRole[role.id];
    const options = role.unites.length === 0
      ? candidats(role) // accessoires : pas de tri par capacité
      : candidats(role).sort((a, b) => a.spec.valeur - b.spec.valeur);
    if (options.length === 0 || besoin <= 0) return null;

    if (role.unites.length === 0) {
      // Accessoire à la pièce (télécommande, cellule, clignotant) : le premier article trouvé, quantité = besoin direct.
      return { type: "stock", produit_id: options[0].p.id, qte: Math.max(1, besoin) };
    }
    if (!empilable(role.id)) {
      const suffisant = options.find((o) => o.spec.valeur >= besoin);
      if (suffisant) return { type: "stock", produit_id: suffisant.p.id, qte: 1 };
      const plusGros = options[options.length - 1];
      return { type: "stock", produit_id: plusGros.p.id, qte: 1 };
    }
    const meilleur = options[options.length - 1];
    const qte = Math.min(50, Math.max(1, Math.ceil(besoin / meilleur.spec.valeur)));
    return { type: "stock", produit_id: meilleur.p.id, qte };
  };

  // Reconstruit les équipements déjà choisis depuis les lignes RÉELLES du devis
  // repris — restitue aussi ceux saisis directement à la main, sans quoi ils
  // disparaissaient à la reprise.
  const initialSelectionGarage = (() => {
    if (!lignesReprises.length || !devisAReprendre) return undefined;
    const choix = {}, verrous = {};
    ROLES_EQUIPEMENT_GARAGE.forEach((role) => {
      const ligne = lignesReprises.find((l) => l.categorie === role.label);
      if (!ligne) return;
      const options = candidats(role);
      const trouve = options.find((o) => o.p.nom === ligne.article);
      choix[role.id] = trouve
        ? { type: "stock", produit_id: trouve.p.id, qte: Number(ligne.qte) || 1 }
        : { type: "manuel", nom: ligne.article, prix: Number(ligne.pu) || 0, qte: Number(ligne.qte) || 1 };
      verrous[role.id] = true;
    });
    return { choix, verrous };
  })();

  const {
    choix, manuelOuvert, brouillonManuel, setBrouillonManuel,
    recalculerNonVerrouilles, changerProduit: changerProduitBase, changerQte,
    ouvrirManuel: ouvrirManuelBase, validerManuel, annulerManuel,
  } = useSelectionAvecVerrou(meilleurChoix, initialSelectionGarage);

  useEffect(() => {
    recalculerNonVerrouilles(ROLES_EQUIPEMENT_GARAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, largeur, poids, frequence, telecosSouhaitees, boutique, db.produits]);

  const ligneRole = (role) => {
    const c = choix[role.id];
    if (!c) return { role, produit: null, qte: 0, sousTotal: 0 };
    if (c.type === "manuel") return { role, produit: { nom: c.nom, prix_vente: c.prix, manuel: true }, qte: c.qte, sousTotal: c.prix * c.qte };
    const p = produitsBoutique.find((x) => x.id === c.produit_id);
    return p ? { role, produit: p, qte: c.qte, sousTotal: p.prix_vente * c.qte } : { role, produit: null, qte: 0, sousTotal: 0 };
  };

  const lignesDevis = ROLES_EQUIPEMENT_GARAGE.filter(roleActif).map(ligneRole);
  const totalRoles = lignesDevis.reduce((s, l) => s + l.sousTotal, 0);

  const changerProduit = (roleId, produitId) => changerProduitBase(roleId, produitId, (pid) => {
    const role = ROLES_EQUIPEMENT_GARAGE.find((r) => r.id === roleId);
    const p = produitsBoutique.find((x) => x.id === pid);
    const spec = p ? specDepuisNom(p.nom + " " + (p.categorie || "")) : null;
    const besoin = besoinParRole[roleId];
    return role.unites.length === 0
      ? Math.max(1, besoin)
      : spec && spec.valeur > 0
      ? (!empilable(roleId) && spec.valeur >= besoin ? 1 : Math.min(50, Math.max(1, Math.ceil(besoin / spec.valeur))))
      : 1;
  });

  const ouvrirManuel = (roleId) => ouvrirManuelBase(roleId, { nom: "", prix: "", qte: "1" });


  // ---- Kit solaire autonome (si pas d'électricité à proximité) ----
  const ligneKitSolaire = lignesReprises.find((l) => l.article === "Kit solaire autonome (motorisation)");
  const [kitSolaire, setKitSolaire] = useState(!!ligneKitSolaire);
  const [prixKitSolaire, setPrixKitSolaire] = useState(ligneKitSolaire ? String(ligneKitSolaire.pu) : "");

  // ---- Batterie de secours (externe) : en option, cochée par le client ----
  const ligneBatterieSecours = lignesReprises.find((l) => l.article === "Batterie de secours (externe)");
  const [batterieSecours, setBatterieSecours] = useState(!!ligneBatterieSecours);
  const [prixBatterieSecours, setPrixBatterieSecours] = useState(ligneBatterieSecours ? String(ligneBatterieSecours.pu) : "");

  // ---- Autres équipements : coffret de commande, câblage… ----
  const [autres, setAutres] = useState(() =>
    lignesReprises.filter((l) => l.categorie === "Autres équipements")
      .map((l) => ({ id: uid(), nom: l.article, prix: String(l.pu), qte: String(l.qte) }))
  );
  const ajouterAutre = () => setAutres([...autres, { id: uid(), nom: "", prix: "", qte: "1" }]);
  const majAutre = (id, champ, val) => setAutres(autres.map((a) => (a.id === id ? { ...a, [champ]: val } : a)));
  const retirerAutre = (id) => setAutres(autres.filter((a) => a.id !== id));
  const totalAutres = autres.reduce((s, a) => s + Number(a.prix || 0) * Number(a.qte || 1), 0);

  const totalKitSolaire = kitSolaire ? Number(prixKitSolaire || 0) : 0;
  const totalBatterieSecours = batterieSecours ? Number(prixBatterieSecours || 0) : 0;
  const totalArticles = totalRoles + totalAutres + totalKitSolaire + totalBatterieSecours + sousTotalPorte;
  const { pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis } = useTotauxDevis(totalArticles);

  const construirePanier = () => [
    ...(sousTotalPorte > 0 ? [{ produit_id: null, article: `Porte — ${TYPES_PORTAIL.find((t) => t.id === type)?.label || ""} (${surfacePorte} m²)`, qte: surfacePorte, pu: prixM2Porte }] : []),
    ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente })),
    ...(kitSolaire && totalKitSolaire > 0 ? [{ produit_id: null, article: "Kit solaire autonome (motorisation)", qte: 1, pu: totalKitSolaire }] : []),
    ...(batterieSecours && totalBatterieSecours > 0 ? [{ produit_id: null, article: "Batterie de secours (externe)", qte: 1, pu: totalBatterieSecours }] : []),
    ...autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({ produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix) })),
  ];

  // ============ ENVOYER LE DEVIS DANS L'ESPACE DU CLIENT ============
  const [clientDevis, setClientDevis] = useState(() => devisAReprendre?.client?.id || "");
  const [nouvClient, setNouvClient] = useState({ nom: "", tel: "" });
  const comptesClients = db.users.filter((u) => u.role === "client" && u.actif !== false);

  const envoyerDevisWhatsApp = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (totalDevis <= 0) { uAlert("Le devis est vide : choisissez d'abord les équipements."); return; }

    const resolu = await resoudreClientDevis(db, clientDevis, nouvClient, profile);
    if (!resolu) return;
    const { compte, motDePasse, dbApres } = resolu;

    const panier = construirePanier();

    const devis = {
      id: uid(),
      date: today(),
      heure: new Date().toTimeString().slice(0, 5),
      par: profile.nom,
      par_id: profile.id,
      par_role: profile.role,
      statut: "propose",
      panier,
      boutique,
      type_devis: "garage",
      besoins: {
        type_ouvrant: type,
        largeur: Number(largeur || 0),
        hauteur: Number(hauteur || 0),
        surface_porte: surfacePorte,
        prix_m2_porte: Number(prixM2Porte || 0),
        poids: Number(poids || 0),
        poids_ajuste: poidsAjuste,
        vantaux: Number(vantaux || 1),
        frequence,
        telecommandes: Number(telecosSouhaitees || 0),
        alimentation_proche: alimentationProche,
      },
      lignes: [
        ...(sousTotalPorte > 0 ? [{ categorie: "Porte", article: `Porte — ${TYPES_PORTAIL.find((t) => t.id === type)?.label || ""} (${surfacePorte} m²)`, qte: surfacePorte, pu: prixM2Porte, total: sousTotalPorte }] : []),
        ...lignesDevis.filter((l) => l.produit).map((l) => ({
          categorie: l.role.label, article: l.produit.nom, qte: l.qte,
          pu: l.produit.prix_vente, total: l.sousTotal,
        })),
        ...(kitSolaire && totalKitSolaire > 0 ? [{ categorie: "Alimentation", article: "Kit solaire autonome (motorisation)", qte: 1, pu: totalKitSolaire, total: totalKitSolaire }] : []),
        ...(batterieSecours && totalBatterieSecours > 0 ? [{ categorie: "Alimentation", article: "Batterie de secours (externe)", qte: 1, pu: totalBatterieSecours, total: totalBatterieSecours }] : []),
        ...autres.filter((a) => a.nom).map((a) => ({
          categorie: "Autres équipements", article: a.nom, qte: Number(a.qte || 1),
          pu: Number(a.prix || 0), total: Number(a.prix || 0) * Number(a.qte || 1),
        })),
        ...(fraisInstallation > 0 ? [{ categorie: "Installation", article: `Frais d'installation (${pctInstall} %)`, qte: 1, pu: fraisInstallation, total: fraisInstallation }] : []),
        ...(fraisTransport > 0 ? [{ categorie: "Transport", article: `Transport / livraison (${pctTransport} %)`, qte: 1, pu: fraisTransport, total: fraisTransport }] : []),
        ...(remise > 0 ? [{ categorie: "Remise", article: `Remise (${pctRemise} %)`, qte: 1, pu: -remise, total: -remise }] : []),
      ],
      total: totalDevis,
      frais_installation: fraisInstallation,
      pct_installation: Number(pctInstall || 0),
      frais_transport: fraisTransport,
      pct_transport: Number(pctTransport || 0),
      remise,
      pct_remise: Number(pctRemise || 0),
    };

    envoyerDevisEtOuvrirWhatsApp({
      dbApres, compte, motDePasse, devis, save, profile, nouvClient,
      ligneEntete: [
        `🚪 Motorisation de portail/garage — *${fmt(totalDevis)}*`,
        `${TYPES_PORTAIL.find((t) => t.id === type)?.label || ""}${Number(largeur) > 0 ? ` · ${largeur} m` : ""}${Number(poids) > 0 ? ` · ${poids} kg` : ""}`,
      ],
      idAReprendre: devisAReprendre?.devis?.id,
    });

    setClientDevis("");
    setNouvClient({ nom: "", tel: "" });
    if (devisAReprendre && onDevisRepriseConsomme) onDevisRepriseConsomme();
    uAlert(`✅ Devis envoyé dans l'espace de ${compte.nom}.\n\nWhatsApp s'ouvre avec ses identifiants et le lien.`);
  };


  const convertir = () => {
    const panier = construirePanier();
    if (panier.length === 0) { uAlert("Aucun équipement sélectionné à convertir."); return; }
    onConvertirEnVente(boutique, panier, Number(pctRemise || 0));
  };

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}

      <Panel boutique={boutique}>
        <div className="font-bold mb-3">🚪 Besoins du client <Badge boutique={boutique} /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Type d'installation">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES_PORTAIL.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Largeur à motoriser (m)"><input type="number" min="0" step="0.1" className={inputCls} value={largeur} onChange={(e) => setLargeur(e.target.value)} /></Field>
          <Field label="Hauteur (m)"><input type="number" min="0" step="0.1" className={inputCls} value={hauteur} onChange={(e) => setHauteur(e.target.value)} /></Field>
          <Field label="Poids du vantail / de la porte (kg)"><input type="number" min="0" className={inputCls} value={poids} onChange={(e) => setPoids(e.target.value)} /></Field>
          {estBattant && (
            <Field label="Nombre de vantaux">
              <select className={inputCls} value={vantaux} onChange={(e) => setVantaux(e.target.value)}>
                <option value="1">1 (portillon / vantail unique)</option><option value="2">2 (double vantail)</option>
              </select>
            </Field>
          )}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <Field label="Fréquence d'usage quotidienne">
            <select className={inputCls} value={frequence} onChange={(e) => setFrequence(e.target.value)}>
              {Object.entries(LABEL_FREQUENCE).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Field>
          <Field label="Télécommandes souhaitées"><input type="number" min="0" className={inputCls} value={telecosSouhaitees} onChange={(e) => setTelecosSouhaitees(e.target.value)} /></Field>
          <Field label="Électricité disponible à proximité ?">
            <select className={inputCls} value={alimentationProche ? "oui" : "non"} onChange={(e) => setAlimentationProche(e.target.value === "oui")}>
              <option value="oui">Oui</option><option value="non">Non — prévoir une alimentation autonome</option>
            </select>
          </Field>
        </div>
      </Panel>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Poids à motoriser</div>
          <div className="text-xl font-bold tabular-nums mt-1">{poidsAjuste} kg</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Catégorie de moteur</div>
          <div className="text-base font-bold mt-1.5">{categorieMoteur(poidsAjuste)}</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Crémaillère</div>
          <div className="text-xl font-bold tabular-nums mt-1">{estCoulissant ? `${longueurCremaillere} m` : "— (non requise)"}</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Télécommandes</div>
          <div className="text-xl font-bold tabular-nums mt-1">× {besoinParRole.telecommande}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Équipements proposés (stock de {boutique})</div>
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Catégorie", "Article", "Besoin calculé", "Quantité", "Prix unit.", "Sous-total"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {/* Porte / portail : calculée automatiquement au m² (largeur × hauteur), prix modifiable */}
            <tr className="border-t border-slate-100 bg-amber-50/40">
              <td className="px-3 py-2 font-semibold whitespace-nowrap">Porte</td>
              <td className="px-3 py-2 text-xs text-slate-500">{TYPES_PORTAIL.find((t) => t.id === type)?.label || ""} — {Number(largeur || 0)} m × {Number(hauteur || 0)} m</td>
              <td className="px-3 py-2 tabular-nums text-slate-500 whitespace-nowrap">{surfacePorte} m²</td>
              <td className="px-3 py-2 tabular-nums text-slate-500 whitespace-nowrap">{surfacePorte} m²</td>
              <td className="px-3 py-2"><input type="number" min="0" className={`${inputCls} w-28`} value={prixM2Porte} onChange={(e) => setPrixM2Porte(Math.max(0, Number(e.target.value) || 0))} /></td>
              <td className="px-3 py-2 tabular-nums font-bold">{fmt(sousTotalPorte)}</td>
            </tr>
            {lignesDevis.map((l) => {
              const options = candidats(l.role);
              const besoinAffiche = l.role.id === "moteur" ? `${besoinParRole.moteur} kg` : l.role.id === "cremaillere" ? `${besoinParRole.cremaillere} m` : `× ${besoinParRole[l.role.id]}`;
              const enManuel = manuelOuvert[l.role.id] || (l.produit?.manuel);
              return (
                <tr key={l.role.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{l.role.label}</td>
                  <td className="px-3 py-2">
                    {enManuel ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <input className={`${inputCls} w-40`} placeholder="Nom de l'article" value={brouillonManuel[l.role.id]?.nom ?? l.produit?.nom ?? ""} onChange={(e) => setBrouillonManuel({ ...brouillonManuel, [l.role.id]: { ...(brouillonManuel[l.role.id] || { qte: "1" }), nom: e.target.value } })} />
                        <input type="number" className={`${inputCls} w-24`} placeholder="Prix (F)" value={brouillonManuel[l.role.id]?.prix ?? l.produit?.prix_vente ?? ""} onChange={(e) => setBrouillonManuel({ ...brouillonManuel, [l.role.id]: { ...(brouillonManuel[l.role.id] || { nom: l.produit?.nom || "" }), prix: e.target.value } })} />
                        <button onClick={() => validerManuel(l.role.id)} className="text-xs font-bold text-white bg-sky-800 rounded-lg px-3 py-1.5">Valider</button>
                        <button onClick={() => annulerManuel(l.role.id, l.role)} className="text-xs text-slate-500 underline">Annuler (revenir à la sélection automatique)</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {options.length === 0 ? (
                          <span className="text-xs text-orange-600">Aucun article correspondant dans le stock de {boutique}</span>
                        ) : (
                          <select className={inputCls} value={l.produit && !l.produit.manuel ? l.produit.id : ""} onChange={(e) => changerProduit(l.role.id, e.target.value)}>
                            <option value="">— Aucun —</option>
                            {options.map(({ p, spec }) => <option key={p.id} value={p.id}>{p.nom}{spec ? ` (${spec.valeur}${spec.unite})` : ""}</option>)}
                          </select>
                        )}
                        <button onClick={() => ouvrirManuel(l.role.id)} className="text-xs font-bold text-sky-800 underline whitespace-nowrap">✏️ Saisir un article hors stock</button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-500 whitespace-nowrap">{besoinAffiche}</td>
                  <td className="px-3 py-2"><input type="number" min="0" className={`${inputCls} w-20`} value={l.qte} disabled={!l.produit} onChange={(e) => changerQte(l.role.id, e.target.value)} /></td>
                  <td className="px-3 py-2 tabular-nums">{l.produit ? fmt(l.produit.prix_vente) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.sousTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Kit solaire autonome : proposé si pas d'électricité à proximité */}
        <div className="px-4 py-3 border-t border-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={kitSolaire} onChange={(e) => setKitSolaire(e.target.checked)} />
            ☀️ Ajouter un kit solaire autonome pour la motorisation {!alimentationProche && <span className="text-amber-600 font-normal">(recommandé — pas d'électricité à proximité)</span>}
          </label>
          {kitSolaire && (
            <div className="mt-2 max-w-xs">
              <Field label="Prix du kit solaire (F)"><input type="number" min="0" className={inputCls} value={prixKitSolaire} onChange={(e) => setPrixKitSolaire(e.target.value)} /></Field>
            </div>
          )}
        </div>

        {/* Batterie de secours (externe) : en option */}
        <div className="px-4 py-3 border-t border-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={batterieSecours} onChange={(e) => setBatterieSecours(e.target.checked)} />
            🔋 Ajouter une batterie de secours (externe)
          </label>
          {batterieSecours && (
            <div className="mt-2 max-w-xs">
              <Field label="Prix de la batterie de secours (F)"><input type="number" min="0" className={inputCls} value={prixBatterieSecours} onChange={(e) => setPrixBatterieSecours(e.target.value)} /></Field>
            </div>
          )}
        </div>

        <BlocAutresEquipements
          titre="Autres équipements (coffret de commande, câblage…)"
          autres={autres} onAjouter={ajouterAutre} onModifier={majAutre} onRetirer={retirerAutre}
          placeholder="Ex : Coffret de commande"
        />

        <BlocTotauxDevis
          totalArticles={totalArticles}
          pctRemise={pctRemise} setPctRemise={setPctRemise} remise={remise}
          pctInstall={pctInstall} setPctInstall={setPctInstall} fraisInstallation={fraisInstallation}
          pctTransport={pctTransport} setPctTransport={setPctTransport} fraisTransport={fraisTransport}
          totalDevis={totalDevis} onConvertir={convertir}
        />
      </div>

      {/* ---- ENVOYER LE DEVIS AU CLIENT ---- */}
      <BlocEnvoiDevisClient
        db={db} clientDevis={clientDevis} setClientDevis={setClientDevis}
        nouvClient={nouvClient} setNouvClient={setNouvClient}
        comptesClients={comptesClients} onEnvoyer={envoyerDevisWhatsApp}
      />


      {noteDimensionnement(db) && (
        <div className="text-xs text-slate-400 whitespace-pre-line">
          {noteDimensionnement(db)}
        </div>
      )}
    </div>
  );
}

// ============ RECHERCHE DE CORRESPONDANCE (Autre dimensionnement) ============
// Contrairement au solaire/garage (caractéristique numérique extraite du nom),
// ici on compare le besoin décrit par le vendeur au nom des articles de la
// catégorie choisie, par ressemblance textuelle (accents/casse ignorés).
function correspondancesBesoin(nomBesoin, produits) {
  const cible = normNom(nomBesoin);
  if (!cible) return [];
  const motsCible = cible.split(" ").filter((m) => m.length >= 3);
  return produits
    .map((p) => {
      const nomP = normNom(p.nom);
      let score = 0;
      if (nomP === cible) score += 20;
      else if (nomP.includes(cible) || cible.includes(nomP)) score += 10;
      for (const mot of motsCible) if (nomP.includes(mot)) score += 1;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ============ OUTIL DE DIMENSIONNEMENT — AUTRE (par catégorie de produit) ============
// Le vendeur choisit une catégorie déjà utilisée dans la gestion de stock, décrit
// les besoins du client au fil de l'eau, et l'article correspondant se propose
// automatiquement depuis le stock de cette catégorie — saisie manuelle sinon.
function DimensionnementAutre({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const produitsBoutique = db.produits.filter((p) => p.boutique === boutique);

  const categories = [...new Set(produitsBoutique.map((p) => p.categorie || "Autre"))].sort();
  const besoinsRepris = devisAReprendre?.devis?.besoins;
  const lignesReprises = devisAReprendre?.devis?.lignes || [];
  const [categorieChoisie, setCategorieChoisie] = useState(besoinsRepris?.categorie || "");
  useEffect(() => { if (!categorieChoisie && categories.length > 0) setCategorieChoisie(categories[0]); }, [categories.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const produitsCategorie = produitsBoutique.filter((p) => (p.categorie || "Autre") === categorieChoisie);

  // ---- Besoins du client : liste libre, remplie au fil de l'eau ----
  // Si on reprend un devis (modification/rejet), on repart des lignes RÉELLES du
  // devis d'origine (et non de la simple liste de recherche) : ça restitue aussi
  // les articles qui avaient été saisis directement à la main, sans jamais passer
  // par le champ de recherche — sinon ils disparaissaient purement et simplement.
  const lignesCategorie = besoinsRepris ? lignesReprises.filter((l) => l.categorie === besoinsRepris.categorie) : [];
  // Reconstruit besoins + choix/verrous à partir des mêmes lignes, en tentant de
  // retrouver l'article correspondant en stock — sinon on restitue le prix d'origine tel quel.
  const initialSelection = (() => {
    if (!lignesCategorie.length) return undefined;
    const choix = {}, verrous = {}, besoinsInit = [];
    lignesCategorie.forEach((l) => {
      const id = uid();
      besoinsInit.push({ id, nom: l.article, qte: String(l.qte) });
      const matches = correspondancesBesoin(l.article, produitsCategorie);
      const trouve = matches.find((m) => m.p.nom === l.article) || matches[0];
      choix[id] = trouve
        ? { type: "stock", produit_id: trouve.p.id, qte: Number(l.qte) || 1 }
        : { type: "manuel", nom: l.article, prix: Number(l.pu) || 0, qte: Number(l.qte) || 1 };
      verrous[id] = true;
    });
    return { choix, verrous, besoinsInit };
  })();
  const [besoins, setBesoins] = useState(() => initialSelection?.besoinsInit || [{ id: uid(), nom: "", qte: "1" }]);

  const meilleurChoixBesoin = (besoin) => {
    if (!besoin || !besoin.nom || !besoin.nom.trim()) return null;
    const matches = correspondancesBesoin(besoin.nom, produitsCategorie);
    if (matches.length === 0) return null;
    return { type: "stock", produit_id: matches[0].p.id, qte: Math.max(1, Number(besoin.qte) || 1) };
  };

  const {
    choix, setChoix, manuelOuvert, brouillonManuel, setBrouillonManuel, verrous: besoinsManuels,
    recalculerNonVerrouilles, changerProduit: changerProduitBase, changerQte: changerQteChoix,
    ouvrirManuel: ouvrirManuelBase, validerManuel, annulerManuel,
  } = useSelectionAvecVerrou(meilleurChoixBesoin, initialSelection);

  const changerProduit = (besoinId, produitId) => changerProduitBase(besoinId, produitId, () => {
    const besoin = besoins.find((b) => b.id === besoinId);
    return Math.max(1, Number(besoin?.qte) || 1);
  });

  // Recalcule les besoins non verrouillés quand la catégorie ou le stock changent.
  useEffect(() => {
    recalculerNonVerrouilles(besoins);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorieChoisie, boutique, db.produits]);

  const ajouterBesoin = () => setBesoins([...besoins, { id: uid(), nom: "", qte: "1" }]);

  const majBesoinNom = (id, nom) => {
    const suivant = besoins.map((b) => (b.id === id ? { ...b, nom } : b));
    setBesoins(suivant);
    if (!besoinsManuels[id]) {
      const c = meilleurChoixBesoin(suivant.find((b) => b.id === id));
      setChoix((avant) => { const n = { ...avant }; if (c) n[id] = c; else delete n[id]; return n; });
    }
  };

  const majBesoinQte = (id, qte) => {
    setBesoins(besoins.map((b) => (b.id === id ? { ...b, qte } : b)));
    changerQteChoix(id, qte);
  };

  const retirerBesoin = (id) => {
    setBesoins(besoins.filter((b) => b.id !== id));
    setChoix((avant) => { const n = { ...avant }; delete n[id]; return n; });
  };

  const ouvrirManuel = (besoinId) => {
    const besoin = besoins.find((b) => b.id === besoinId);
    ouvrirManuelBase(besoinId, { nom: besoin?.nom || "", prix: "", qte: besoin?.qte || "1" });
  };


  const ligneBesoin = (besoin) => {
    const c = choix[besoin.id];
    if (!c) return { besoin, produit: null, qte: 0, sousTotal: 0 };
    if (c.type === "manuel") return { besoin, produit: { nom: c.nom, prix_vente: c.prix, manuel: true }, qte: c.qte, sousTotal: c.prix * c.qte };
    const p = produitsBoutique.find((x) => x.id === c.produit_id);
    return p ? { besoin, produit: p, qte: c.qte, sousTotal: p.prix_vente * c.qte } : { besoin, produit: null, qte: 0, sousTotal: 0 };
  };

  const lignesDevis = besoins.map(ligneBesoin);
  const totalRoles = lignesDevis.reduce((s, l) => s + l.sousTotal, 0);

  // ---- Autres équipements : hors de la catégorie choisie ----
  const [autres, setAutres] = useState(() =>
    lignesReprises.filter((l) => l.categorie === "Autres équipements")
      .map((l) => ({ id: uid(), nom: l.article, prix: String(l.pu), qte: String(l.qte) }))
  );
  const ajouterAutre = () => setAutres([...autres, { id: uid(), nom: "", prix: "", qte: "1" }]);
  const majAutre = (id, champ, val) => setAutres(autres.map((a) => (a.id === id ? { ...a, [champ]: val } : a)));
  const retirerAutre = (id) => setAutres(autres.filter((a) => a.id !== id));
  const totalAutres = autres.reduce((s, a) => s + Number(a.prix || 0) * Number(a.qte || 1), 0);

  const totalArticles = totalRoles + totalAutres;
  const { pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis } = useTotauxDevis(totalArticles);

  const construirePanier = () => [
    ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente })),
    ...autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({ produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix) })),
  ];

  // ============ ENVOYER LE DEVIS DANS L'ESPACE DU CLIENT ============
  const [clientDevis, setClientDevis] = useState(() => devisAReprendre?.client?.id || "");
  const [nouvClient, setNouvClient] = useState({ nom: "", tel: "" });
  const comptesClients = db.users.filter((u) => u.role === "client" && u.actif !== false);

  const envoyerDevisWhatsApp = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (totalDevis <= 0) { uAlert("Le devis est vide : décrivez d'abord les besoins du client."); return; }

    const resolu = await resoudreClientDevis(db, clientDevis, nouvClient, profile);
    if (!resolu) return;
    const { compte, motDePasse, dbApres } = resolu;

    const panier = construirePanier();

    const devis = {
      id: uid(),
      date: today(),
      heure: new Date().toTimeString().slice(0, 5),
      par: profile.nom,
      par_id: profile.id,
      par_role: profile.role,
      statut: "propose",
      panier,
      boutique,
      type_devis: "autre",
      besoins: {
        categorie: categorieChoisie,
        articles_demandes: besoins.filter((b) => b.nom.trim()).map((b) => ({ nom: b.nom.trim(), qte: Number(b.qte || 1) })),
      },
      lignes: [
        ...lignesDevis.filter((l) => l.produit).map((l) => ({
          categorie: categorieChoisie, article: l.produit.nom, qte: l.qte,
          pu: l.produit.prix_vente, total: l.sousTotal,
        })),
        ...autres.filter((a) => a.nom).map((a) => ({
          categorie: "Autres équipements", article: a.nom, qte: Number(a.qte || 1),
          pu: Number(a.prix || 0), total: Number(a.prix || 0) * Number(a.qte || 1),
        })),
        ...(fraisInstallation > 0 ? [{ categorie: "Installation", article: `Frais d'installation (${pctInstall} %)`, qte: 1, pu: fraisInstallation, total: fraisInstallation }] : []),
        ...(fraisTransport > 0 ? [{ categorie: "Transport", article: `Transport / livraison (${pctTransport} %)`, qte: 1, pu: fraisTransport, total: fraisTransport }] : []),
        ...(remise > 0 ? [{ categorie: "Remise", article: `Remise (${pctRemise} %)`, qte: 1, pu: -remise, total: -remise }] : []),
      ],
      total: totalDevis,
      frais_installation: fraisInstallation,
      pct_installation: Number(pctInstall || 0),
      frais_transport: fraisTransport,
      pct_transport: Number(pctTransport || 0),
      remise,
      pct_remise: Number(pctRemise || 0),
    };

    envoyerDevisEtOuvrirWhatsApp({
      dbApres, compte, motDePasse, devis, save, profile, nouvClient,
      ligneEntete: [`📦 ${categorieChoisie} — *${fmt(totalDevis)}*`],
      idAReprendre: devisAReprendre?.devis?.id,
    });

    setClientDevis("");
    setNouvClient({ nom: "", tel: "" });
    if (devisAReprendre && onDevisRepriseConsomme) onDevisRepriseConsomme();
    uAlert(`✅ Devis envoyé dans l'espace de ${compte.nom}.\n\nWhatsApp s'ouvre avec ses identifiants et le lien.`);
  };


  const convertir = () => {
    const panier = construirePanier();
    if (panier.length === 0) { uAlert("Aucun équipement sélectionné à convertir."); return; }
    onConvertirEnVente(boutique, panier, Number(pctRemise || 0));
  };

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}

      <Panel boutique={boutique}>
        <div className="font-bold mb-3">📦 Catégorie de produit <Badge boutique={boutique} /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Catégorie (celles déjà en stock, ou saisissez-en une nouvelle)">
            <input
              className={inputCls}
              list="liste-categories-autre"
              placeholder="Ex : Interphonie, Climatisation…"
              value={categorieChoisie}
              onChange={(e) => setCategorieChoisie(e.target.value)}
            />
            <datalist id="liste-categories-autre">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            {categories.length === 0 && (
              <div className="text-xs text-orange-600 mt-1">Aucune catégorie trouvée dans le stock de {boutique} — vous pouvez quand même en saisir une, la recherche d'articles se fera dessus si des articles portent déjà cette catégorie.</div>
            )}
          </Field>
        </div>
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Besoins du client → articles (stock « {categorieChoisie || "—"} » de {boutique})</div>
        <table className="w-full text-sm min-w-[820px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Besoin du client", "Article proposé", "Quantité", "Prix unit.", "Sous-total", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {lignesDevis.map((l) => {
              const matches = correspondancesBesoin(l.besoin.nom, produitsCategorie);
              const enManuel = manuelOuvert[l.besoin.id] || (l.produit?.manuel);
              return (
                <tr key={l.besoin.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <input
                      className={`${inputCls} w-48`}
                      list={`liste-${categorieChoisie}`}
                      placeholder="Ex : Caméra extérieure"
                      value={l.besoin.nom}
                      onChange={(e) => majBesoinNom(l.besoin.id, e.target.value)}
                    />
                    <datalist id={`liste-${categorieChoisie}`}>{produitsCategorie.map((p) => <option key={p.id} value={p.nom} />)}</datalist>
                  </td>
                  <td className="px-3 py-2">
                    {enManuel ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <input className={`${inputCls} w-40`} placeholder="Nom de l'article" value={brouillonManuel[l.besoin.id]?.nom ?? l.produit?.nom ?? ""} onChange={(e) => setBrouillonManuel({ ...brouillonManuel, [l.besoin.id]: { ...(brouillonManuel[l.besoin.id] || { qte: "1" }), nom: e.target.value } })} />
                        <input type="number" className={`${inputCls} w-24`} placeholder="Prix (F)" value={brouillonManuel[l.besoin.id]?.prix ?? l.produit?.prix_vente ?? ""} onChange={(e) => setBrouillonManuel({ ...brouillonManuel, [l.besoin.id]: { ...(brouillonManuel[l.besoin.id] || { nom: l.produit?.nom || "" }), prix: e.target.value } })} />
                        <button onClick={() => validerManuel(l.besoin.id)} className="text-xs font-bold text-white bg-sky-800 rounded-lg px-3 py-1.5">Valider</button>
                        <button onClick={() => annulerManuel(l.besoin.id, l.besoin)} className="text-xs text-slate-500 underline">Annuler (revenir à la recherche automatique)</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {!l.besoin.nom.trim() ? (
                          <span className="text-xs text-slate-400">Décrivez le besoin à gauche…</span>
                        ) : matches.length === 0 ? (
                          <span className="text-xs text-orange-600">Aucun article correspondant dans « {categorieChoisie} »</span>
                        ) : (
                          <select className={inputCls} value={l.produit && !l.produit.manuel ? l.produit.id : ""} onChange={(e) => changerProduit(l.besoin.id, e.target.value)}>
                            <option value="">— Aucun —</option>
                            {matches.map(({ p }) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                          </select>
                        )}
                        <button onClick={() => ouvrirManuel(l.besoin.id)} className="text-xs font-bold text-sky-800 underline whitespace-nowrap">✏️ Saisir un article hors stock</button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2"><input type="number" min="1" className={`${inputCls} w-20`} value={l.besoin.qte} onChange={(e) => majBesoinQte(l.besoin.id, e.target.value)} /></td>
                  <td className="px-3 py-2 tabular-nums">{l.produit ? fmt(l.produit.prix_vente) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.sousTotal)}</td>
                  <td className="px-3 py-2"><button onClick={() => retirerBesoin(l.besoin.id)} className="text-xs text-red-600 underline whitespace-nowrap">Retirer</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="px-4 py-3 border-t border-slate-200">
          <button onClick={ajouterBesoin} className="text-sm font-bold text-sky-800 underline">➕ Ajouter un besoin</button>
        </div>

        <BlocAutresEquipements
          titre={`Autres équipements (hors catégorie « ${categorieChoisie} »)`}
          autres={autres} onAjouter={ajouterAutre} onModifier={majAutre} onRetirer={retirerAutre}
          placeholder="Ex : Câblage"
        />

        <BlocTotauxDevis
          totalArticles={totalArticles}
          pctRemise={pctRemise} setPctRemise={setPctRemise} remise={remise}
          pctInstall={pctInstall} setPctInstall={setPctInstall} fraisInstallation={fraisInstallation}
          pctTransport={pctTransport} setPctTransport={setPctTransport} fraisTransport={fraisTransport}
          totalDevis={totalDevis} onConvertir={convertir}
        />
      </div>

      {/* ---- ENVOYER LE DEVIS AU CLIENT ---- */}
      <BlocEnvoiDevisClient
        db={db} clientDevis={clientDevis} setClientDevis={setClientDevis}
        nouvClient={nouvClient} setNouvClient={setNouvClient}
        comptesClients={comptesClients} onEnvoyer={envoyerDevisWhatsApp}
      />


      {noteDimensionnement(db) && (
        <div className="text-xs text-slate-400 whitespace-pre-line">
          {noteDimensionnement(db)}
        </div>
      )}
    </div>
  );
}

