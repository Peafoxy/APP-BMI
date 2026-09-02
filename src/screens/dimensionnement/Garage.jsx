// ============================================================
// screens/dimensionnement/Garage.jsx — Volet Garage : type de portail, poids, fréquence d'usage, choix
// du moteur par catégorie. TYPES_PORTAIL est aussi utilisé par
// TousLesDevis et EspaceClient (réexporté par index.jsx).
// ============================================================
import { useState, useEffect, useRef } from "react";
import { BoutiqueTabs } from "../../components/SelecteurBoutique";
import { uid, fmt, today } from "../../lib/core";
import { Field, inputCls, Badge, Panel, uAlert, AucuneBoutique, Stat } from "../../components/ui";
import { boutiquesVente, bloquerSiLecture, noteDimensionnement, estCompteFormation, espaceDuCompte, estBoutiqueFormation, boutiqueRetenue, domainesDefinis } from "../../lib/calculs";
import { specDepuisNom, BlocAutresEquipements, BlocTotauxDevis, useTotauxDevis, contientLeMot, memeFamille, BlocEnvoiDevisClient, envoyerDevisEtOuvrirWhatsApp, resoudreClientDevis , useConditionsPaiement, BlocConditionsPaiement, appliquerConditionsReprises, quantiteNecessaire, SEUIL_QTE_INHABITUELLE, lireBrouillonVolet, useEcrireBrouillonVolet, effacerBrouillonVolet } from "./Partages";
import { useSelectionAvecVerrou } from "./Selecteur";

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
// Exporté : le PDF du devis (via TousLesDevis) réécrit les identifiants
// en libellés lisibles — une seule liste, pas de copie qui divergerait.
export const LABEL_FREQUENCE = { faible: "Faible (< 10 cycles/j)", moyenne: "Moyenne (10 à 30 cycles/j)", intensive: "Intensive (> 30 cycles/j)" };

function categorieMoteur(poidsKg) {
  if (poidsKg <= 0) return "—";
  if (poidsKg <= 300) return "Léger (≤ 300 kg)";
  if (poidsKg <= 500) return "Standard (300 à 500 kg)";
  if (poidsKg <= 800) return "Robuste (500 à 800 kg)";
  return "Industriel (> 800 kg)";
}

// ============ OUTIL DE DIMENSIONNEMENT — PORTAIL / PORTE DE GARAGE MOTORISÉ ============
export function DimensionnementGarage({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme, bq, setBq }) {
  // ⚠ bq/setBq viennent du conteneur (index.jsx) : UNE seule boutique pour
  // tous les volets du dimensionnement, mémorisée sous « dimensionnement ».
  // ⚠ Voir boutiqueRetenue (lib/calculs.js) : la valeur mémorisée peut être
  // vide (écran ouvert pendant la synchronisation d'ouverture) ou désigner
  // une boutique qui n'existe plus (supprimée, ou effacée par une
  // réinitialisation). Dans les deux cas, on repart de la boutique par
  // défaut plutôt que d'afficher un écran figé ou un nom fantôme.
  const boutique = boutiqueRetenue(db, profile, bq, { ecran: "dimensionnement" });
  const produitsBoutique = db.produits.filter((p) => p.boutique === boutique);

  // ---- Besoins du client ----
  // Si on reprend un devis (modification/rejet), on repart de ses besoins d'origine.
  const besoinsRepris = devisAReprendre?.devis?.besoins;
  const lignesReprises = devisAReprendre?.devis?.lignes || [];
  // Brouillon persistant (survit au F5 et à une nouvelle version) — même
  // règle que Solaire, qui vit en UN SEUL endroit : Partages.jsx (demande
  // Timo, 02/09/2026 : seul Solaire gardait ses données).
  const brouillon = lireBrouillonVolet("garage", profile, !!besoinsRepris);
  const [type, setType] = useState(besoinsRepris?.type_ouvrant || brouillon?.type || "portail_coulissant");
  const [largeur, setLargeur] = useState(besoinsRepris?.largeur ? String(besoinsRepris.largeur) : (brouillon?.largeur ?? ""));
  const [hauteur, setHauteur] = useState(besoinsRepris?.hauteur ? String(besoinsRepris.hauteur) : (brouillon?.hauteur ?? ""));
  const [poids, setPoids] = useState(besoinsRepris?.poids ? String(besoinsRepris.poids) : (brouillon?.poids ?? ""));
  const [vantaux, setVantaux] = useState(besoinsRepris?.vantaux ? String(besoinsRepris.vantaux) : (brouillon?.vantaux ?? "1"));
  const [frequence, setFrequence] = useState(besoinsRepris?.frequence || brouillon?.frequence || "moyenne");
  const [telecosSouhaitees, setTelecosSouhaitees] = useState(besoinsRepris?.telecommandes != null ? String(besoinsRepris.telecommandes) : (brouillon?.telecosSouhaitees ?? "2"));
  const [alimentationProche, setAlimentationProche] = useState(besoinsRepris?.alimentation_proche != null ? besoinsRepris.alimentation_proche : (brouillon?.alimentationProche ?? true));

  const estCoulissant = type === "portail_coulissant";
  const estBattant = type === "portail_battant";

  // ---- Calculs de dimensionnement (indicatifs, avec marge de sécurité selon l'usage) ----
  const poidsAjuste = Math.ceil(Number(poids || 0) * (FACTEUR_FREQUENCE[frequence] || 1.25));
  const longueurCremaillere = estCoulissant && Number(largeur) > 0 ? Math.ceil(Number(largeur) + 1) : 0; // +1 m de marge

  // ---- Porte / portail : calculée automatiquement au m² (largeur × hauteur), prix modifiable ----
  const [prixM2Porte, setPrixM2Porte] = useState(besoinsRepris?.prix_m2_porte || brouillon?.prixM2Porte || PRIX_PORTE_M2[type] || 0);
  const premierRenduPorte = useRef(true);
  useEffect(() => {
    if (premierRenduPorte.current) { premierRenduPorte.current = false; return; } // ne pas écraser la reprise au montage
    setPrixM2Porte(PRIX_PORTE_M2[type] || 0);
  }, [type]);

  // Écrit le brouillon à chaque changement — effacé uniquement une fois le
  // devis réellement envoyé ou converti, jamais avant.
  useEcrireBrouillonVolet("garage", profile, { type, largeur, hauteur, poids, vantaux, frequence, telecosSouhaitees, alimentationProche, prixM2Porte });
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
      // ⚠ Même règle que le volet Solaire (livraison 3) : si l'article est
      // rangé dans un domaine, c'est le rangement qui décide ; sinon on
      // continue de chercher dans son nom, exactement comme avant.
      const idDomaineGarage = (domainesDefinis(db).find((d) => d.calcul === "garage") || {}).id || "garage";
      const motCorrespond = p.domaine
        ? (p.domaine === idDomaineGarage && memeFamille(p.categorie, role.label))
        : contientLeMot(texte, role.mots);
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
    const qte = quantiteNecessaire(besoin, meilleur.spec.valeur);
    return { type: "stock", produit_id: meilleur.p.id, qte };
  };

  // Reconstruit les équipements déjà choisis depuis les lignes RÉELLES du devis
  // repris — restitue aussi ceux saisis directement à la main, sans quoi ils
  // disparaissaient à la reprise.
  const initialSelectionGarage = (() => {
    if (!lignesReprises.length || !devisAReprendre) return undefined;
    const choix = {}, verrous = {}, hb = {};
    ROLES_EQUIPEMENT_GARAGE.forEach((role) => {
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

  const [rolesHB, setRolesHB] = useState(() => initialSelectionGarage?.hb || {});

  const {
    choix, setChoix, manuelOuvert, brouillonManuel, setBrouillonManuel,
    verrous, setVerrous, recalculerNonVerrouilles, changerProduit: changerProduitBase, changerQte,
    ouvrirManuel: ouvrirManuelBase, validerManuel, annulerManuel,
  } = useSelectionAvecVerrou(meilleurChoix, initialSelectionGarage);

  // RÉACTIF à chaque NOUVELLE reprise de devis — même piège que
  // Ventes.jsx/Commandes.jsx (2.99.13) et Solaire.jsx : depuis que cet écran
  // reste en veille plutôt que d'être redémarré entre deux visites, un
  // useState(() => ...) figé au montage ne suffit plus pour un 2e devis
  // repris après le premier. Couvre TOUT le formulaire, pas seulement
  // choix/verrous (déjà exposés par le hook partagé, corrigé pour
  // l'occasion — setVerrous n'était pas exposé avant).
  useEffect(() => {
    if (!devisAReprendre) return;
    if (besoinsRepris?.type_ouvrant) setType(besoinsRepris.type_ouvrant);
    if (besoinsRepris?.largeur) setLargeur(String(besoinsRepris.largeur));
    if (besoinsRepris?.hauteur) setHauteur(String(besoinsRepris.hauteur));
    if (besoinsRepris?.poids) setPoids(String(besoinsRepris.poids));
    if (besoinsRepris?.vantaux) setVantaux(String(besoinsRepris.vantaux));
    if (besoinsRepris?.frequence) setFrequence(besoinsRepris.frequence);
    if (besoinsRepris?.telecommandes != null) setTelecosSouhaitees(String(besoinsRepris.telecommandes));
    if (besoinsRepris?.alimentation_proche != null) setAlimentationProche(besoinsRepris.alimentation_proche);
    if (besoinsRepris?.prix_m2_porte) setPrixM2Porte(besoinsRepris.prix_m2_porte);
    premierRenduPorte.current = true; // même piège que les rails de Solaire.jsx : réarmer à chaque reprise
    setClientDevis(devisAReprendre?.client?.id || "");
    if (initialSelectionGarage) {
      setChoix(initialSelectionGarage.choix || {});
      setVerrous(initialSelectionGarage.verrous || {});
      setRolesHB(initialSelectionGarage.hb || {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisAReprendre]);

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
      ? (!empilable(roleId) && spec.valeur >= besoin ? 1 : quantiteNecessaire(besoin, spec.valeur))
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
      .map((l) => ({ id: uid(), nom: l.article, prix: String(l.pu), qte: String(l.qte), hors_boutique: !!l.hors_boutique }))
  );
  const ajouterAutre = () => setAutres([...autres, { id: uid(), nom: "", prix: "", qte: "1" }]);
  const majAutre = (id, champ, val) => setAutres(autres.map((a) => (a.id === id ? { ...a, [champ]: val } : a)));
  const retirerAutre = (id) => setAutres(autres.filter((a) => a.id !== id));
  const totalAutres = autres.reduce((s, a) => s + Number(a.prix || 0) * Number(a.qte || 1), 0);

  const totalKitSolaire = kitSolaire ? Number(prixKitSolaire || 0) : 0;
  const totalBatterieSecours = batterieSecours ? Number(prixBatterieSecours || 0) : 0;
  const totalArticles = totalRoles + totalAutres + totalKitSolaire + totalBatterieSecours + sousTotalPorte;
  const { pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation: fraisInstallationPct, pctTransport, setPctTransport, fraisTransport, totalDevis: totalDevisNormal } = useTotauxDevis(totalArticles);
  // ⚠ "Pose seule" (2.99.98, même mécanisme que Solaire.jsx) — montant de
  // main d'œuvre FIXE, saisi au cas par cas, jamais un pourcentage.
  const [poseSeule, setPoseSeule] = useState(false);
  const [montantPoseFixe, setMontantPoseFixe] = useState("");
  const fraisInstallation = poseSeule ? Number(montantPoseFixe || 0) : fraisInstallationPct;
  const totalDevis = poseSeule ? (totalArticles - remise + fraisInstallation + fraisTransport) : totalDevisNormal;
  const { pctAcompte, setPctAcompte, delaiInstallation, setDelaiInstallation } = useConditionsPaiement();

  // ⚠ Reprendre un devis rejeté restituait les appareils et les équipements,
  // mais PERDAIT en silence tout ce qui avait été négocié : remise, %
  // d'installation, transport, acompte, délai, et jusqu'à la case « pose
  // seule » avec son montant fixe. Le devis renvoyé au client n'était donc
  // plus celui qu'on avait convenu avec lui. Tout était pourtant enregistré :
  // il ne manquait que cette relecture. Placé APRÈS les déclarations
  // ci-dessus, seul endroit où les commandes existent toutes.
  useEffect(() => {
    appliquerConditionsReprises(devisAReprendre?.devis, {
      setPctRemise, setPctInstall, setPctTransport, setPctAcompte,
      setDelaiInstallation, setPoseSeule, setMontantPoseFixe,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisAReprendre]);
  const montantAcompte = Math.round((totalDevis * Number(pctAcompte || 100)) / 100);

  const construirePanier = () => [
    ...(sousTotalPorte > 0 ? [{ produit_id: null, article: `Porte — ${TYPES_PORTAIL.find((t) => t.id === type)?.label || ""} (${surfacePorte} m²)`, qte: surfacePorte, pu: prixM2Porte }] : []),
    ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente, hors_boutique: !!rolesHB[l.role.id] })),
    ...(kitSolaire && totalKitSolaire > 0 ? [{ produit_id: null, article: "Kit solaire autonome (motorisation)", qte: 1, pu: totalKitSolaire }] : []),
    ...(batterieSecours && totalBatterieSecours > 0 ? [{ produit_id: null, article: "Batterie de secours (externe)", qte: 1, pu: totalBatterieSecours }] : []),
    ...autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({ produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix), hors_boutique: !!a.hors_boutique })),
  ];

  // ============ ENVOYER LE DEVIS DANS L'ESPACE DU CLIENT ============
  const [clientDevis, setClientDevis] = useState(() => devisAReprendre?.client?.id || "");
  const [nouvClient, setNouvClient] = useState({ nom: "", tel: "" });
  // ⚠ Cloisonnement : on ne propose que les clients de SON espace.
  // Sans ce filtre, un compte de formation adressait ses devis d'essai a
  // de VRAIS clients — qui les recevaient par WhatsApp, dans leur vrai
  // espace client, et ne pouvaient plus receptionner le chantier ensuite.
  // ⚠ La BOUTIQUE de travail décide, pas le compte : l'administrateur qui
  // établit un devis depuis une boutique de formation doit se voir proposer
  // les clients de formation, et eux seuls. Sans cela il adressait ses
  // devis d'entraînement à de VRAIS clients.
  const espaceDevis = boutique ? estBoutiqueFormation(db, boutique) : espaceDuCompte(db, profile);
  const comptesClients = db.users.filter((u) => u.role === "client" && u.actif !== false
    && (espaceDevis === undefined || !!u.formation === espaceDevis));

  const envoyerDevisWhatsApp = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (totalDevis <= 0) { uAlert("Le devis est vide : choisissez d'abord les équipements."); return; }

    const resolu = await resoudreClientDevis(db, clientDevis, nouvClient, profile, boutique);
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
          pu: l.produit.prix_vente, total: l.sousTotal, hors_boutique: !!rolesHB[l.role.id],
        })),
        ...(kitSolaire && totalKitSolaire > 0 ? [{ categorie: "Alimentation", article: "Kit solaire autonome (motorisation)", qte: 1, pu: totalKitSolaire, total: totalKitSolaire }] : []),
        ...(batterieSecours && totalBatterieSecours > 0 ? [{ categorie: "Alimentation", article: "Batterie de secours (externe)", qte: 1, pu: totalBatterieSecours, total: totalBatterieSecours }] : []),
        ...autres.filter((a) => a.nom).map((a) => ({
          categorie: "Autres équipements", article: a.nom, qte: Number(a.qte || 1),
          pu: Number(a.prix || 0), total: Number(a.prix || 0) * Number(a.qte || 1), hors_boutique: !!a.hors_boutique,
        })),
        ...(fraisInstallation > 0 ? [{ categorie: "Installation", article: poseSeule ? "Frais de pose (matériel du client)" : `Frais d'installation (${pctInstall} %)`, qte: 1, pu: fraisInstallation, total: fraisInstallation }] : []),
        ...(fraisTransport > 0 ? [{ categorie: "Transport", article: `Transport / livraison (${pctTransport} %)`, qte: 1, pu: fraisTransport, total: fraisTransport }] : []),
        ...(remise > 0 ? [{ categorie: "Remise", article: `Remise (${pctRemise} %)`, qte: 1, pu: -remise, total: -remise }] : []),
      ],
      total: totalDevis,
      pose_seule: poseSeule,
      frais_installation: fraisInstallation,
      pct_installation: poseSeule ? null : Number(pctInstall || 0),
      frais_transport: fraisTransport,
      pct_transport: Number(pctTransport || 0),
      remise,
      pct_remise: Number(pctRemise || 0),
      pct_acompte: Number(pctAcompte || 100),
      montant_acompte: montantAcompte,
      delai_installation: delaiInstallation.trim(),
    };

    // ⚠ Le refus (signature manquante) était IGNORÉ : l'application
    // annonçait ensuite « ✅ Devis envoyé » et effaçait le brouillon,
    // alors que rien n'était parti. Elle disait exactement le contraire
    // de la vérité. On respecte maintenant la réponse.
    const envoye = await envoyerDevisEtOuvrirWhatsApp({
      dbApres, compte, motDePasse, devis, save, profile, nouvClient,
      ligneEntete: [
        `🚪 Motorisation de portail/garage — *${fmt(totalDevis)}*`,
        `${TYPES_PORTAIL.find((t) => t.id === type)?.label || ""}${Number(largeur) > 0 ? ` · ${largeur} m` : ""}${Number(poids) > 0 ? ` · ${poids} kg` : ""}`,
      ],
      idAReprendre: devisAReprendre?.devis?.id,
    });
    if (!envoye) return;

    setClientDevis("");
    setNouvClient({ nom: "", tel: "" });
    if (devisAReprendre && onDevisRepriseConsomme) onDevisRepriseConsomme();
    effacerBrouillonVolet("garage", profile);
    uAlert(`✅ Devis envoyé dans l'espace de ${compte.nom}.\n\nWhatsApp s'ouvre avec ses identifiants et le lien.`);
  };


  const convertir = () => {
    const panier = construirePanier();
    if (panier.length === 0) { uAlert("Aucun équipement sélectionné à convertir."); return; }
    effacerBrouillonVolet("garage", profile);
    onConvertirEnVente(boutique, panier, Number(pctRemise || 0));
  };

  // ⚠ Cloisonnement : aucune boutique de l'espace du compte connecté —
  // on n'affiche PAS le formulaire, plutôt que de le laisser écrire dans la
  // boutique de repli (voir boutiqueParDefaut dans lib/calculs.js).
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;
  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs ecran="dimensionnement" db={db} value={bq} onChange={setBq} profile={profile} />}

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
        <Stat label="Poids à motoriser" valeur={<>{poidsAjuste} kg</>} nature="technique" />
        <Stat label="Catégorie de moteur" valeur={<>{categorieMoteur(poidsAjuste)}</>} nature="technique" />
        <Stat label="Crémaillère" valeur={<>{estCoulissant ? `${longueurCremaillere} m` : "— (non requise)"}</>} nature="technique" />
        <Stat label="Télécommandes" valeur={<>× {besoinParRole.telecommande}</>} nature="technique" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Équipements proposés (stock de {boutique})</div>
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Catégorie", "Article", "Besoin calculé", "Quantité", "Prix unit.", "Sous-total", "HB"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {/* Porte / portail : calculée automatiquement au m² (largeur × hauteur), prix modifiable */}
            <tr className="border-t border-slate-100 bg-amber-50/40">
              <td className="px-3 py-2 font-semibold whitespace-nowrap">Porte</td>
              <td className="px-3 py-2 text-xs text-slate-500">{TYPES_PORTAIL.find((t) => t.id === type)?.label || ""} — {Number(largeur || 0)} m × {Number(hauteur || 0)} m</td>
              <td className="px-3 py-2 tabular-nums text-slate-500 whitespace-nowrap">{surfacePorte} m²</td>
              <td className="px-3 py-2 tabular-nums text-slate-500 whitespace-nowrap">{surfacePorte} m²</td>
              <td className="px-3 py-2"><input type="number" min="0" className={`${inputCls} w-28`} value={prixM2Porte} onChange={(e) => setPrixM2Porte(Math.max(0, Number(e.target.value) || 0))} /></td>
              <td className="px-3 py-2 tabular-nums font-bold">{fmt(sousTotalPorte)}</td>
              <td className="px-3 py-2"></td>
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
                  <td className="px-3 py-2">
                    <input type="number" min="0" className={`${inputCls} w-20`} value={l.qte} disabled={!l.produit} onChange={(e) => changerQte(l.role.id, e.target.value)} />
                    {/* Même avertissement que le volet Solaire : le plafond
                        silencieux à 50 est levé, remplacé par une alerte. */}
                    {l.qte >= SEUIL_QTE_INHABITUELLE && (
                      <div className="text-[11px] font-bold text-amber-700 mt-1 max-w-[13rem]">
                        ⚠ {l.qte} unités — quantité inhabituelle. Vérifiez que la caractéristique inscrite dans le nom de l'article est la bonne.
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{l.produit ? fmt(l.produit.prix_vente) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.sousTotal)}</td>
                  <td className="px-3 py-2"><input type="checkbox" checked={!!rolesHB[l.role.id]} onChange={(e) => setRolesHB({ ...rolesHB, [l.role.id]: e.target.checked })} title="Hors boutique : exclu du chiffre d'affaires et des commissions" /></td>
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

        <div className="px-4 py-3 border-t border-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={poseSeule} onChange={(e) => setPoseSeule(e.target.checked)} />
            Pose seule (matériel déjà acheté par le client — BMI ne facture que la main d'œuvre)
          </label>
          {poseSeule && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-slate-500">Montant de la main d'œuvre (F CFA, fixé pour ce chantier)</span>
              <input type="number" min="0" value={montantPoseFixe} onChange={(e) => setMontantPoseFixe(e.target.value)} className="w-32 rounded border border-slate-300 px-2 py-1 text-right" />
            </div>
          )}
        </div>

        <BlocTotauxDevis
          totalArticles={totalArticles}
          pctRemise={pctRemise} setPctRemise={setPctRemise} remise={remise}
          pctInstall={pctInstall} setPctInstall={setPctInstall} fraisInstallation={fraisInstallation}
          masquerInstallationPct={poseSeule}
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
        comptesClients={comptesClients} profile={profile} onEnvoyer={envoyerDevisWhatsApp}
      />


      {noteDimensionnement(db) && (
        <div className="text-xs text-slate-400 whitespace-pre-line">
          {noteDimensionnement(db)}
        </div>
      )}
    </div>
  );
}
