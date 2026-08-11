// ============================================================
// screens/dimensionnement/Solaire.jsx — Volet Solaire : besoins électriques, calcul panneaux/batteries/
// convertisseur avec marges de sécurité, équipements hors stock.
// ============================================================
import { useState, useEffect, useRef } from "react";
import { uid, fmt, today, brouillonLire, brouillonEcrire, brouillonEffacer } from "../../lib/core";
import { Field, inputCls, Badge, Panel, uAlert } from "../../components/ui";
import { toucher, boutiquesVente, bloquerSiLecture, noteDimensionnement } from "../../lib/calculs";
import { specDepuisNom, BlocAutresEquipements, BlocTotauxDevis, useTotauxDevis, BlocEnvoiDevisClient, envoyerDevisEtOuvrirWhatsApp, resoudreClientDevis , useConditionsPaiement, BlocConditionsPaiement } from "./Partages";



const estHybrideTexte = (texte) => /hybride|hybrid/i.test(texte || "");
const PRIX_RAIL = 5500;

const ROLES_EQUIPEMENT = [
  { id: "panneau", label: "Panneaux solaires", mots: ["panneau", "panel", "photovolta", "pv "], unites: ["w", "wc"] },
  { id: "batterie", label: "Batteries", mots: ["batterie", "battery", "lifepo4", "lithium"], unites: ["ah"] },
  { id: "convertisseur", label: "Convertisseur", mots: ["convertisseur", "onduleur", "inverter", "inverseur"], unites: ["w", "va"] },
  { id: "regulateur", label: "Régulateur MPPT", mots: ["régulateur", "regulateur", "mppt", "chargeur solaire", "controller"], unites: ["a"] },
];

export function DimensionnementSolaire({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  // Mode LIBRE (3e position à côté des boutiques, admin/commercial multi-
  // boutique uniquement) : le dimensionnement n'est associé à AUCUNE
  // boutique — pas de stock réel à proposer, seulement les caractéristiques
  // complètes des équipements nécessaires (aucun prix, puisqu'aucun article
  // réel n'est encore choisi).
  const [modeLibre, setModeLibre] = useState(false);
  // Mode Libre : puissance de panneau / capacité de batterie tapées à la
  // main, pour voir la quantité réelle recalculée en direct (demande Timo :
  // proposer des combinaisons RÉALISTES — aucun panneau n'existe à 14100W,
  // il faut dire "35 panneaux de 550W" plutôt qu'un seul chiffre abstrait).
  // Taille d'UNITÉ pour panneau/batterie/convertisseur en mode Libre —
  // TOUJOURS définie (jamais vide) : la proposition est automatique dès le
  // départ (550Wc, 314Ah, taille commerciale la plus proche pour le
  // convertisseur), modifiable à tout moment. La quantité en découle
  // TOUJOURS de cette valeur — jamais poussée une seule fois puis oubliée,
  // ce qui causait le bug « la quantité revient à 1 » : un recalcul en
  // fond de tableau régénérait la ligne avec une quantité figée à 1,
  // écrasant ce qui avait été tapé. Demande Timo, après un 2e retour.
  const [pxPanneauLibre, setPxPanneauLibre] = useState(550);
  const [ahBatterieLibre, setAhBatterieLibre] = useState(314);
  const [kwConvertisseurLibre, setKwConvertisseurLibre] = useState(null); // null = taille commerciale auto
  // Prix unitaire tapé par ligne en mode Libre (facultatif, 0 par défaut —
  // demande Timo). Même principe stable que pxPanneauLibre/ahBatterieLibre
  // ci-dessus : dérivé à chaque recalcul, jamais poussé une seule fois puis
  // écrasé (même bug que la quantité aurait pu se reproduire ici).
  const [prixLibre, setPrixLibre] = useState({});
  const produitsBoutique = modeLibre ? [] : db.produits.filter((p) => p.boutique === boutique);

  // ---- Besoins du client (liste d'appareils) ----
  // Si on reprend un devis (modification/rejet), on repart de ses besoins d'origine.
  const besoinsRepris = devisAReprendre?.devis?.besoins;
  const lignesReprises = devisAReprendre?.devis?.lignes || [];
  // Brouillon persistant (survit à une actualisation de page) — seulement
  // s'il n'y a PAS de devis repris (qui a toujours priorité, cas plus rare
  // et plus intentionnel). Effacé automatiquement une fois le devis
  // réellement enregistré ou envoyé — voir plus bas.
  const cleBrouillon = `bmi_brouillon_dim_solaire:${profile.id}`;
  const brouillon = !besoinsRepris ? brouillonLire(cleBrouillon) : null;
  const [appareils, setAppareils] = useState(() =>
    besoinsRepris?.appareils?.length
      ? besoinsRepris.appareils.map((a) => ({ id: uid(), nom: a.nom, puissance: String(a.puissance), heures: String(a.heures), qte: String(a.qte || 1) }))
      : brouillon?.appareils?.length
        ? brouillon.appareils
        : [{ id: uid(), nom: "", puissance: "", heures: "", qte: "1" }]
  );
  const [autonomie, setAutonomie] = useState(() => besoinsRepris?.autonomie ? String(besoinsRepris.autonomie) : (brouillon?.autonomie ?? "1"));
  const [soleil, setSoleil] = useState(() => brouillon?.soleil ?? "3");
  const [tension, setTension] = useState(() => besoinsRepris?.tension ? String(besoinsRepris.tension) : (brouillon?.tension ?? "24"));
  const [typeBatterie, setTypeBatterie] = useState(() => {
    // "plomb" retiré du choix (demande Timo) — un ancien devis repris ou un
    // brouillon qui l'aurait encore enregistré ne doit jamais coincer le
    // menu sur une valeur qui n'existe plus ; "gel" est le plus proche.
    const v = besoinsRepris?.type_batterie || brouillon?.typeBatterie || "lifepo4";
    return v === "plomb" ? "gel" : v;
  });

  // Écrit le brouillon à chaque changement — survit à une actualisation de
  // page. Effacé uniquement une fois le devis réellement enregistré ou
  // envoyé (voir convertir() et l'envoi WhatsApp plus bas), jamais avant.
  useEffect(() => {
    brouillonEcrire(cleBrouillon, { appareils, autonomie, soleil, tension, typeBatterie });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appareils, autonomie, soleil, tension, typeBatterie]);

  const majAppareil = (id, champ, val) => setAppareils(appareils.map((a) => (a.id === id ? { ...a, [champ]: val } : a)));
  const ajouterAppareil = () => setAppareils([...appareils, { id: uid(), nom: "", puissance: "", heures: "", qte: "1" }]);
  const retirerAppareil = (id) => setAppareils(appareils.filter((a) => a.id !== id));

  const whParJour = appareils.reduce((s, a) => s + Number(a.puissance || 0) * Number(a.heures || 0) * Number(a.qte || 1), 0);
  const puissanceSimultanee = appareils.reduce((s, a) => s + Number(a.puissance || 0) * Number(a.qte || 1), 0);

  // ---- Calculs de dimensionnement (indicatifs, avec marges de sécurité usuelles) ----
  // "Gel" est désormais reconnu comme un type à part (menu déroulant) pour
  // le LIBELLÉ — mais partage le même taux de décharge que Plomb/AGM (50%),
  // une hypothèse courante (guides usuels ~50% pour tout plomb scellé,
  // Gel inclus) — à ajuster si Timo a un autre repère précis pour le Gel.
  const dod = typeBatterie === "lifepo4" ? 0.9 : 0.5;
  const rendementSysteme = 0.8;
  // Tension RÉELLE d'un pack LiFePO4 (16S/8S/4S) — on calcule avec elle, pas
  // avec la tension "ronde" du système : une batterie 48V annoncée est en
  // réalité 51,2V, une 24V est 25,6V, une 12V est 12,8V (demande Timo :
  // « on travaille plus avec 51,2V dans les calculs que 48V »). Une
  // batterie plomb/gel, elle, est bien à sa tension nominale exacte.
  const TENSION_REELLE_LIFEPO4 = { 12: 12.8, 24: 25.6, 48: 51.2 };
  const tensionCalcul = typeBatterie === "lifepo4" ? (TENSION_REELLE_LIFEPO4[Number(tension)] || Number(tension)) : Number(tension);

  const wcPanneaux = soleil > 0 ? Math.ceil(whParJour / Number(soleil) / rendementSysteme) : 0;
  const whBatterie = whParJour * Number(autonomie || 1);
  const ahBatterie = tensionCalcul > 0 ? Math.ceil(whBatterie / tensionCalcul / dod) : 0;
  const wConvertisseur = Math.ceil(puissanceSimultanee * 2); // marge : somme des puissances × 2
  const kwConvertisseur = wConvertisseur / 1000;
  const aRegulateur = tensionCalcul > 0 ? Math.ceil((wcPanneaux / tensionCalcul) * 1.25) : 0;

  const besoinParRole = { panneau: wcPanneaux, batterie: ahBatterie, convertisseur: wConvertisseur, regulateur: aRegulateur };

  // Règle usuelle des convertisseurs HYBRIDES, communiquée par Timo : à
  // défaut de tension renseignée en stock, on la devine à partir de la
  // puissance — 0 à 2,5kW généralement en 12V, 2,6 à 4,5kW en 24V,
  // 4,6 à 30kW en 48V. Reste une estimation, jamais aussi fiable qu'une
  // tension explicitement indiquée en stock — juste un meilleur filet que
  // de proposer n'importe quelle puissance sans distinction de tension.
  const tensionInfereeConvertisseur = (w) => {
    const kw = w / 1000;
    if (kw <= 2.5) return 12;
    if (kw <= 4.5) return 24;
    return 48;
  };

  // Batterie : la tension est presque toujours écrite en toutes lettres
  // dans le nom (ex. « BATERIE 25.6V300AH ») — on la lit directement plutôt
  // que de deviner à partir d'une règle approximative. 25,6V et 51,2V sont
  // les tensions nominales réelles d'une batterie LiFePO4 24V/48V (8S/16S) ;
  // on regroupe donc autour des tensions usuelles. Si aucune tension claire
  // n'est trouvée dans le nom, on reste permissif (on ne bloque pas sur du
  // flou) — signalé par Timo après une batterie 25,6V proposée à tort sur
  // un système 48V.
  const tensionInfereeBatterie = (nomTexte) => {
    const m = String(nomTexte || "").match(/(\d+(?:[.,]\d+)?)\s*V(?!A)/i);
    if (!m) return null;
    const v = Number(m[1].replace(",", "."));
    if (v >= 10 && v <= 15) return 12;
    if (v >= 20 && v <= 30) return 24;
    if (v >= 40 && v <= 56) return 48;
    return null;
  };

  // Type de batterie (Lithium/Gel/Plomb) lu dans le nom — un article dont
  // le nom mentionne clairement un autre type que celui choisi est exclu ;
  // sans mention claire, on considère LITHIUM par défaut (demande explicite
  // de Timo — pas de flottement entre les deux types comme pour la tension).
  // Signalé par Timo : le sélecteur "Type de batterie" ne changeait jamais
  // l'article proposé, seulement le calcul — la batterie Gel restait
  // toujours choisie même en sélectionnant Lithium. "Plomb / AGM" retiré du
  // choix (demande Timo) — un article de ce type reste malgré tout exclu de
  // partout, puisqu'il ne correspond jamais ni à "lifepo4" ni à "gel".
  const MOTS_TYPE_BATTERIE = {
    lifepo4: ["lifepo4", "lithium", "li-ion", "lifep04"],
    gel: ["gel"],
    plomb: ["plomb", "agm", "acide"],
  };
  const typeBatterieInfere = (nomTexte) => {
    const t = nomTexte.toLowerCase();
    for (const [type, mots] of Object.entries(MOTS_TYPE_BATTERIE)) {
      if (mots.some((m) => t.includes(m))) return type;
    }
    return "lifepo4"; // rien de mentionné → considéré Lithium par défaut
  };

  const candidats = (role) => produitsBoutique
    .map((p) => ({ p, spec: specDepuisNom(p.nom + " " + (p.categorie || "")) }))
    .filter(({ p, spec }) => {
      const texte = (p.nom + " " + (p.categorie || "")).toLowerCase();
      const motCorrespond = role.mots.some((m) => texte.includes(m));
      const uniteOk = spec && role.unites.includes(spec.unite);
      // Tension : ne jamais proposer un convertisseur 48V pour un système
      // réglé sur 24V, ou l'inverse. Priorité à une tension EXPLICITEMENT
      // taguée en stock ; à défaut, on l'infère (batterie : lue dans le
      // nom ; convertisseur : déduite de la puissance) ; si même
      // l'inférence ne trouve rien de clair, on reste permissif.
      let tensionOk = true;
      if (role.id === "batterie") {
        tensionOk = p.tension
          ? Number(p.tension) === Number(tension)
          : (() => { const dev = tensionInfereeBatterie(p.nom); return dev === null || dev === Number(tension); })();
      } else if (role.id === "convertisseur") {
        tensionOk = p.tension
          ? Number(p.tension) === Number(tension)
          : (!spec || tensionInfereeConvertisseur(spec.valeur) === Number(tension));
      }
      let typeOk = true;
      if (role.id === "batterie") {
        typeOk = typeBatterieInfere(p.nom) === typeBatterie;
      }
      return motCorrespond && uniteOk && tensionOk && typeOk;
    });

  // Panneaux/batteries : le plus gros calibre dispo (on empile plusieurs unités).
  // Convertisseur/régulateur : le plus PETIT modèle qui couvre le besoin (un seul article,
  // inutile de payer un calibre surdimensionné) ; si aucun ne suffit seul, on prend le plus
  // gros dispo et on complète avec plusieurs unités.
  const empilable = (roleId) => roleId === "panneau" || roleId === "batterie";

  // Mode Libre : pas de stock à chercher, on propose directement la
  // caractéristique complète nécessaire (aucun prix — aucun article réel
  // n'est choisi, seulement ce qu'il FAUDRA chercher/acheter). Libellés
  // volontairement SOBRES (juste le total) — les combinaisons concrètes se
  // lisent désormais directement dans la colonne Quantité, remplie
  // automatiquement dès qu'on tape une puissance/capacité (demande Timo :
  // « pas besoin de tous ces commentaires, au total, au total »).
  const TAILLES_CONVERTISSEUR_W = [3000, 5000, 6000, 8000, 10000, 12000, 15000, 20000, 25000, 30000];
  const tailleConvertisseurReco = TAILLES_CONVERTISSEUR_W.find((t) => t >= wConvertisseur) || TAILLES_CONVERTISSEUR_W[TAILLES_CONVERTISSEUR_W.length - 1];

  const specLibre = (role) => {
    const besoin = besoinParRole[role.id];
    if (besoin <= 0) return null;
    const prix = Number(prixLibre[role.id]) || 0;
    if (role.id === "panneau") {
      const qte = Math.max(1, Math.ceil(besoin / Math.max(1, Number(pxPanneauLibre) || 550)));
      return { type: "manuel", nom: `Panneaux solaires — ${pxPanneauLibre} Wc`, prix, qte, libre: true };
    }
    if (role.id === "batterie") {
      const qte = Math.max(1, Math.ceil(besoin / Math.max(1, Number(ahBatterieLibre) || 314)));
      const libelleType = typeBatterie === "lifepo4" ? "Lithium LiFePO4" : "Gel";
      return { type: "manuel", nom: `Batterie ${tension}V — ${ahBatterieLibre} Ah (${libelleType})`, prix, qte, libre: true };
    }
    if (role.id === "convertisseur") {
      // "hybride" reste dans le nom : c'est ce mot qui fait disparaître
      // automatiquement la ligne Régulateur juste en dessous (déjà intégré).
      const kw = kwConvertisseurLibre ? Number(kwConvertisseurLibre) : tailleConvertisseurReco / 1000;
      return { type: "manuel", nom: `Convertisseur hybride ${tension}V — ${kw} kW`, prix, qte: 1, libre: true };
    }
    return { type: "manuel", nom: `Régulateur MPPT ${tension}V — ${besoin} A`, prix, qte: 1, libre: true };
  };

  const meilleurChoix = (role) => {
    if (modeLibre) return specLibre(role);
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
    const choix = {}, verrous = {}, hb = {};
    ROLES_EQUIPEMENT.forEach((role) => {
      const ligne = lignesReprises.find((l) => l.categorie === role.label);
      if (!ligne) return;
      if (ligne.hors_boutique) hb[role.id] = true;
      const options = candidats(role);
      const trouve = options.find((o) => o.p.nom === ligne.article);
      choix[role.id] = trouve
        ? { type: "stock", produit_id: trouve.p.id, qte: Number(ligne.qte) || 1 }
        : { type: "manuel", nom: ligne.article, prix: Number(ligne.pu) || 0, qte: Number(ligne.qte) || 1 };
      verrous[role.id] = true;
    });
    return { choix, verrous, hb };
  })();
  const [choix, setChoix] = useState(() => initialSelectionSolaire?.choix || {});
  const [rolesHB, setRolesHB] = useState(() => initialSelectionSolaire?.hb || {});
  const [manuelOuvert, setManuelOuvert] = useState({}); // { roleId: bool } — affiche le mini-formulaire de saisie libre
  const [brouillonManuel, setBrouillonManuel] = useState({}); // { roleId: { nom, prix, qte } }
  // Rôles que le vendeur a choisi de saisir/sélectionner lui-même : la sélection
  // automatique ne doit plus jamais y toucher tant qu'il ne revient pas en arrière.
  const [rolesManuels, setRolesManuels] = useState(() => initialSelectionSolaire?.verrous || {});

  // RÉACTIF à chaque NOUVELLE reprise de devis — pas seulement au tout
  // premier montage. Même piège que Ventes.jsx/Commandes.jsx (2.99.13) :
  // depuis que Dimensionnement reste en veille plutôt que d'être redémarré
  // entre deux visites (2.98.98/99), un simple useState(() => ...) ne se
  // déclenche plus qu'une fois pour toute la session — reprendre un 2e devis
  // (ou un 3e...) après le premier laissait tout le formulaire figé sur
  // l'ancien. Signalé par Timo après la découverte du même piège côté
  // Ventes/Commandes : « vérifie s'il n'y a pas autre chose de cassé ».
  useEffect(() => {
    if (!devisAReprendre) return;
    if (besoinsRepris?.appareils?.length) {
      setAppareils(besoinsRepris.appareils.map((a) => ({ id: uid(), nom: a.nom, puissance: String(a.puissance), heures: String(a.heures), qte: String(a.qte || 1) })));
    }
    if (besoinsRepris?.autonomie) setAutonomie(String(besoinsRepris.autonomie));
    if (besoinsRepris?.tension) setTension(String(besoinsRepris.tension));
    if (besoinsRepris?.type_batterie) setTypeBatterie(besoinsRepris.type_batterie === "plomb" ? "gel" : besoinsRepris.type_batterie);
    setClientDevis(devisAReprendre?.client?.id || "");
    if (initialSelectionSolaire) {
      setChoix(initialSelectionSolaire.choix || {});
      setRolesManuels(initialSelectionSolaire.verrous || {});
      setRolesHB(initialSelectionSolaire.hb || {});
    }
    // Rails de fixation : même piège, raté par la recherche précédente car
    // useState(valeur) sans wrapper () => en paraît différent, mais se
    // comporte pareil (valeur figée au tout premier montage). Le garde
    // "premierRendu" doit aussi se réarmer à CHAQUE reprise — sinon le
    // recalcul automatique (déclenché juste après par le nouveau nombre de
    // panneaux) écraserait immédiatement la quantité reprise.
    const ligneRails = lignesReprises.find((l) => l.categorie === "Rails de fixation");
    setRailsQte(ligneRails ? Number(ligneRails.qte) : 0);
    premierRenduRails.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisAReprendre]);

  useEffect(() => {
    setChoix((avant) => {
      const nouveauChoix = { ...avant };
      for (const role of ROLES_EQUIPEMENT) {
        // En mode Libre, on ignore volontairement tout ancien réglage manuel
        // qui traînerait (ex. si on avait cliqué le crayon "hors stock" sur
        // cette ligne AVANT de passer en Libre — possible maintenant que
        // l'écran reste en veille plutôt que redémarré entre deux visites) :
        // sinon la ligne concernée reste coincée sur l'ancien état et perd
        // l'édition du prix/quantité du mode Libre. Signalé par Timo sur le
        // convertisseur précisément.
        if (!modeLibre && rolesManuels[role.id]) continue; // ne pas écraser un choix fait à la main
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
  }, [whParJour, autonomie, soleil, tension, typeBatterie, boutique, modeLibre, db.produits, pxPanneauLibre, ahBatterieLibre, kwConvertisseurLibre, prixLibre]);

  const produitConvertisseurChoisi = choix.convertisseur?.type === "stock" && produitsBoutique.find((p) => p.id === choix.convertisseur.produit_id);
  const convertisseurEstHybride = choix.convertisseur?.type === "manuel"
    ? estHybrideTexte(choix.convertisseur.nom)
    : !!(produitConvertisseurChoisi && estHybrideTexte(produitConvertisseurChoisi.nom + " " + (produitConvertisseurChoisi.categorie || "")));

  const ligneRole = (role) => {
    const c = choix[role.id];
    if (!c) return { role, produit: null, qte: 0, sousTotal: 0 };
    if (c.type === "manuel") return { role, produit: { nom: c.nom, prix_vente: c.prix, manuel: true, libre: !!c.libre }, qte: c.qte, sousTotal: c.prix * c.qte };
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
  // Si un article "Rails de fixation" existe réellement en stock, on relie
  // la ligne à lui — la VRAIE quantité calculée sera alors déduite du stock
  // à la vente. Le prix, lui, reste TOUJOURS celui calculé ici (5 500 F),
  // jamais celui du stock — demande explicite de Timo. S'il n'y a pas cet
  // article en stock, tout reste exactement comme avant (aucun lien,
  // aucune vérification de stock, le calcul n'est jamais impacté).
  const articleRailsStock = produitsBoutique.find((p) => /rail/i.test(p.nom) || /rail/i.test(p.categorie || ""));
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
      .map((l) => ({ id: uid(), nom: l.article, prix: String(l.pu), qte: String(l.qte), hors_boutique: !!l.hors_boutique }))
  );
  const ajouterAutre = () => setAutres([...autres, { id: uid(), nom: "", prix: "", qte: "1" }]);
  const majAutre = (id, champ, val) => setAutres(autres.map((a) => (a.id === id ? { ...a, [champ]: val } : a)));
  const retirerAutre = (id) => setAutres(autres.filter((a) => a.id !== id));
  const totalAutres = autres.reduce((s, a) => s + Number(a.prix || 0) * Number(a.qte || 1), 0);

  const totalArticles = totalRoles + sousTotalRails + totalAutres;
  const { pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis } = useTotauxDevis(totalArticles);
  const { pctAcompte, setPctAcompte, delaiInstallation, setDelaiInstallation } = useConditionsPaiement();
  const montantAcompte = Math.round((totalDevis * Number(pctAcompte || 100)) / 100);

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
      ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente, hors_boutique: !!rolesHB[l.role.id] })),
      ...(railsQte > 0 ? [{ produit_id: articleRailsStock ? articleRailsStock.id : null, article: "Rails de fixation", qte: railsQte, pu: PRIX_RAIL }] : []),
      ...autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({ produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix), hors_boutique: !!a.hors_boutique })),
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
          pu: l.produit.prix_vente, total: l.sousTotal, hors_boutique: !!rolesHB[l.role.id],
        })),
        ...(railsQte > 0 ? [{ categorie: "Rails de fixation", article: "Rail de fixation", qte: railsQte, pu: PRIX_RAIL, total: sousTotalRails }] : []),
        ...autres.filter((a) => a.nom).map((a) => ({
          categorie: "Autres équipements", article: a.nom, qte: Number(a.qte || 1),
          pu: Number(a.prix || 0), total: Number(a.prix || 0) * Number(a.qte || 1), hors_boutique: !!a.hors_boutique,
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
      pct_acompte: Number(pctAcompte || 100),
      montant_acompte: montantAcompte,
      delai_installation: delaiInstallation.trim(),
    };

    envoyerDevisEtOuvrirWhatsApp({
      dbApres, compte, motDePasse, devis, save, profile, nouvClient,
      ligneEntete: [`☀️ Installation solaire — *${fmt(totalDevis)}*`, `Besoin estimé : ${Math.round(whParJour)} Wh/jour`],
      idAReprendre: devisAReprendre?.devis?.id,
    });

    setClientDevis("");
    setNouvClient({ nom: "", tel: "" });
    if (devisAReprendre && onDevisRepriseConsomme) onDevisRepriseConsomme();
    brouillonEffacer(cleBrouillon);
    uAlert(`✅ Devis envoyé dans l'espace de ${compte.nom}.\n\nWhatsApp s'ouvre avec ses identifiants et le lien.`);
  };


  const convertir = () => {
    const panier = [
      ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente, hors_boutique: !!rolesHB[l.role.id] })),
      ...(railsQte > 0 ? [{ produit_id: articleRailsStock ? articleRailsStock.id : null, article: "Rails de fixation", qte: railsQte, pu: PRIX_RAIL }] : []),
      ...autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({ produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix), hors_boutique: !!a.hors_boutique })),
    ];
    if (panier.length === 0) { uAlert("Aucun équipement sélectionné à convertir."); return; }
    brouillonEffacer(cleBrouillon);
    onConvertirEnVente(boutique, panier, Number(pctRemise || 0));
  };

  return (
    <div className="space-y-4">
      {!profile.boutique && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {/* Rendu ici même (plutôt que via <BoutiqueTabs>) : ce composant
              partagé s'enveloppe dans son PROPRE conteneur — Libre se
              retrouvait alors hors de cette rangée interne, mal aligné
              (signalé par Timo). Même code/style que BoutiqueTabs, pour
              rester identique visuellement. */}
          {boutiquesVente(db).map((b) => (
            <button key={b.nom} onClick={() => { setBq(b.nom); setModeLibre(false); }}
              className={`px-4 py-1.5 rounded-full text-sm font-bold ${!modeLibre && bq === b.nom ? "text-white" : "bg-white border border-slate-300 text-slate-600"}`}
              style={!modeLibre && bq === b.nom ? { backgroundColor: b.couleur } : {}}>{b.depot ? "🏭 " : ""}{b.nom}</button>
          ))}
          <button onClick={() => setModeLibre(true)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold ${modeLibre ? "bg-slate-800 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>
            Libre
          </button>
        </div>
      )}

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
              <option value="lifepo4">LiFePO4 (lithium)</option><option value="gel">Gel</option>
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
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">{modeLibre ? "Équipements nécessaires (mode libre — sans prix, à choisir ensuite)" : `Équipements proposés (stock de ${boutique})`}</div>
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Catégorie", "Article", "Besoin calculé", "Quantité", "Prix unit.", "Sous-total", "HB"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {lignesDevis.map((l) => {
              if (l.role.id === "regulateur" && convertisseurEstHybride) {
                return (
                  <tr key={l.role.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold">{l.role.label}</td>
                    <td className="px-3 py-2 text-xs text-green-700">✓ Intégré au convertisseur hybride — pas d'article séparé nécessaire</td>
                    <td className="px-3 py-2 text-slate-400">—</td><td className="px-3 py-2 text-slate-400">—</td><td className="px-3 py-2 text-slate-400">—</td>
                    <td className="px-3 py-2 tabular-nums text-slate-400">{fmt(0)}</td>
                    <td className="px-3 py-2"></td>
                  </tr>
                );
              }
              const options = candidats(l.role);
              const besoinAffiche = l.role.id === "convertisseur" ? `${(besoinParRole[l.role.id] / 1000).toFixed(2)} kW` : `${besoinParRole[l.role.id]}${l.role.id === "regulateur" ? " A" : ""}`;
              const enLibre = !!l.produit?.libre;
              const enManuel = !enLibre && (manuelOuvert[l.role.id] || l.produit?.manuel);
              return (
                <tr key={l.role.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{l.role.label}</td>
                  <td className="px-3 py-2">
                    {enLibre ? (
                      // Mode Libre : une SPÉCIFICATION à lire, jamais un
                      // formulaire à remplir obligatoirement — la
                      // proposition (550Wc, 314Ah, taille de convertisseur)
                      // est déjà là par défaut. Le champ ne sert qu'à
                      // corriger cette valeur si besoin ; la quantité s'en
                      // déduit TOUJOURS automatiquement, de façon stable
                      // (demande Timo, après un 2e retour sur ce point).
                      <div>
                        <div className="text-sm text-slate-700">{l.produit.nom}</div>
                        {l.role.id === "panneau" && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-slate-400">Puissance d'un panneau (W) :</span>
                            <input type="number" min="1" className={`${inputCls} w-24`} value={pxPanneauLibre} onChange={(e) => setPxPanneauLibre(e.target.value)} />
                          </div>
                        )}
                        {l.role.id === "batterie" && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-slate-400">Capacité d'une batterie (Ah) :</span>
                            <input type="number" min="1" className={`${inputCls} w-24`} value={ahBatterieLibre} onChange={(e) => setAhBatterieLibre(e.target.value)} />
                          </div>
                        )}
                        {l.role.id === "convertisseur" && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-slate-400">Puissance du convertisseur (kW) :</span>
                            <input type="number" min="1" step="0.1" className={`${inputCls} w-24`} value={kwConvertisseurLibre ?? (tailleConvertisseurReco / 1000)} onChange={(e) => setKwConvertisseurLibre(e.target.value)} />
                          </div>
                        )}
                      </div>
                    ) : enManuel ? (
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
                  <td className="px-3 py-2"><input type="number" min="0" className={`${inputCls} w-20`} value={l.qte} disabled={!l.produit || enLibre} onChange={(e) => changerQte(l.role.id, e.target.value)} /></td>
                  <td className="px-3 py-2 tabular-nums">
                    {enLibre ? (
                      <input type="number" min="0" className={`${inputCls} w-24`} value={prixLibre[l.role.id] ?? ""} placeholder="0" onChange={(e) => setPrixLibre({ ...prixLibre, [l.role.id]: e.target.value })} />
                    ) : l.produit ? fmt(l.produit.prix_vente) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.sousTotal)}</td>
                  <td className="px-3 py-2"><input type="checkbox" checked={!!rolesHB[l.role.id]} onChange={(e) => setRolesHB({ ...rolesHB, [l.role.id]: e.target.checked })} title="Hors boutique : exclu du chiffre d'affaires et des commissions" /></td>
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
              <td className="px-3 py-2"></td>
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
        <BlocConditionsPaiement
          pctAcompte={pctAcompte} setPctAcompte={setPctAcompte}
          delaiInstallation={delaiInstallation} setDelaiInstallation={setDelaiInstallation}
          montantAcompte={montantAcompte} totalDevis={totalDevis}
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
