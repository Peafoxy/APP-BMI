// ============================================================
// screens/dimensionnement/Autre.jsx — Volet Autre : catégories libres, correspondance besoin ↔ produits
// du stock par similarité de nom.
// ============================================================
import { useState, useEffect, useRef } from "react";
import { BoutiqueTabs } from "../../components/SelecteurBoutique";
import { uid, fmt, today } from "../../lib/core";
import { Field, inputCls, Badge, Panel, uAlert, AucuneBoutique } from "../../components/ui";
import { ChampSuggestions } from "../../components/ChampSuggestions";
import { normNom, boutiquesVente, bloquerSiLecture, noteDimensionnement, estCompteFormation, espaceDuCompte, estBoutiqueFormation, boutiqueRetenue } from "../../lib/calculs";
import { BlocAutresEquipements, BlocEnvoiDevisClient, lireBrouillonVolet, useEcrireBrouillonVolet, effacerBrouillonVolet, useAutresEquipements, useReglagesDevis, BlocsFinDevis, useEnvoiDevis } from "./Partages";
import { construireDevis, panierAutres } from "./devisCommun";
import { useSelectionAvecVerrou } from "./Selecteur";

// ⚠ La recherche par RESSEMBLANCE du besoin écrit (correspondancesBesoin) a
// été retirée le 11/09/2026 : Timo a demandé deux listes déroulantes —
// catégorie, puis articles de cette catégorie — et une règle qui ne commande
// plus rien ne reste pas en place.

// ============ OUTIL DE DIMENSIONNEMENT — VOLET LIBRE (par DOMAINE) ============
// Le vendeur décrit les besoins du client au fil de l'eau, et l'article
// correspondant se propose automatiquement depuis le stock du DOMAINE ouvert
// (l'onglet) — saisie manuelle sinon.
// ⚠ Il fallait auparavant choisir une catégorie de stock avant de commencer.
// Timo l'a relevé le 18/08/2026 : « pourquoi choisir une catégorie, alors que
// dans la catégorie on n'a que les mêmes produits ? ». Depuis que chaque
// domaine a son onglet, cette étape n'ajoutait qu'un clic et masquait une
// partie du stock.
export function DimensionnementAutre({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme, domaine, bq, setBq }) {
  // ⚠ bq/setBq viennent du conteneur (index.jsx) : UNE seule boutique pour
  // tous les volets du dimensionnement, mémorisée sous « dimensionnement ».
  // ⚠ Voir boutiqueRetenue (lib/calculs.js) : la valeur mémorisée peut être
  // vide (écran ouvert pendant la synchronisation d'ouverture) ou désigner
  // une boutique qui n'existe plus (supprimée, ou effacée par une
  // réinitialisation). Dans les deux cas, on repart de la boutique par
  // défaut plutôt que d'afficher un écran figé ou un nom fantôme.
  const boutique = boutiqueRetenue(db, profile, bq, { ecran: "dimensionnement" });
  const produitsBoutique = db.produits.filter((p) => p.boutique === boutique);

  // ⚠ Demande Timo (18/08/2026) : « dans Autre, au lieu de faire sélectionner
  // les catégories, c'est le domaine ». C'est désormais l'ONGLET qui porte le
  // domaine ; la liste ci-dessous ne montre donc que SES familles, au lieu de
  // déverser toutes les catégories du stock mélangées.
  //
  // Le repli est indispensable : tant qu'un article n'a pas été rattaché à un
  // domaine, sa catégorie doit rester proposée — sinon un stock existant
  // deviendrait invisible du jour au lendemain.
  const besoinsRepris = devisAReprendre?.devis?.besoins;
  const lignesReprises = devisAReprendre?.devis?.lignes || [];
  // Le devis n'est plus rangé sous une catégorie de stock choisie à la main,
  // mais sous le nom du DOMAINE — c'est ce que le client lira sur son devis.
  // Un devis repris garde l'intitulé sous lequel il avait été établi.
  const categorieChoisie = besoinsRepris?.categorie || (domaine ? domaine.nom : "Autre");
  // ⚠ Relevé par Timo (18/08/2026) : « pourquoi choisir une catégorie, alors
  // que dans la catégorie on n'a que les mêmes produits ? ». Il a raison —
  // depuis que chaque domaine a son propre onglet, l'étape « catégorie » ne
  // faisait qu'ajouter un clic et masquer une partie du stock.
  // On cherche donc dans TOUT le domaine d'un coup.
  //
  // Repli indispensable : tant qu'aucun article n'a été rattaché à ce
  // domaine, on garde tout le stock de la boutique — sinon l'écran serait
  // vide et inutilisable le jour de la mise à jour.
  const produitsDuDomaine = domaine ? produitsBoutique.filter((p) => p.domaine === domaine.id) : [];
  const rattachementFait = produitsDuDomaine.length > 0;

  // ⚠ Timo (11/09/2026) : « je propose que le besoin du client soit une
  // catégorie, et article proposé déroule les articles de la catégorie
  // choisie… tout court. Ceci pour tous les devis sans calcul. »
  // Avant, on écrivait le besoin en toutes lettres et l'application cherchait
  // l'article qui ressemblait le plus — « je ne comprends pas », et il avait
  // raison : rien ne disait au vendeur ce qu'il devait taper, ni ce que
  // l'application allait en faire. Deux listes déroulantes, plus de devinette.
  // ⚠ Le problème que Timo a posé (11/09/2026) : « dans forage, pas de
  // catégorie des panneaux… cette catégorie se trouve dans le solaire, alors
  // que pour le forage aussi on utilise les panneaux. Comment résoudre le
  // problème ? » — un article ne porte QU'UN domaine, et le volet ne montrait
  // que le sien : les panneaux, batteries, câbles, disjoncteurs étaient
  // invisibles hors de leur métier. Décision (option « a ») : **le domaine ne
  // CACHE plus, il RANGE**. Les besoins du domaine ouvert viennent en tête,
  // tout le reste du stock de la boutique suit en dessous. Rien à réétiqueter,
  // et plus jamais un article introuvable parce qu'il est rangé ailleurs.
  const categoriesDe = (liste) => [...new Set(liste.map((p) => (p.categorie || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const categoriesDuDomaine = categoriesDe(produitsDuDomaine);
  const categoriesAutres = categoriesDe(produitsBoutique).filter((c) => !categoriesDuDomaine.includes(c));
  const categoriesDuStock = [...categoriesDuDomaine, ...categoriesAutres];
  // Les articles d'un besoin : ceux du domaine ouvert d'abord, puis les autres
  // de la boutique qui portent la même catégorie.
  // ⚠ Timo (11/09/2026) : « dans les lignes du besoin du client et des
  // articles proposés, on peut aussi, à part dérouler et sélectionner, écrire
  // et la présélection est proposée. » On reprend donc LE champ commun de
  // l'application (ChampSuggestions) : cliquer ouvre toute la liste, taper la
  // filtre, et ce qui est tapé n'est jamais transformé tout seul.
  const propositionsBesoin = [
    ...categoriesDuDomaine.map((c) => ({ valeur: c, detail: domaine ? domaine.nom : "" })),
    ...categoriesAutres.map((c) => ({ valeur: c, detail: `Autre métier — stock de ${boutique}` })),
  ];
  const propositionsArticle = (cat) => articlesDeCategorie(cat).map((p) => ({
    valeur: p.nom, id: p.id, detail: `${fmt(p.prix_vente)} F` + (p.categorie ? ` · ${p.categorie}` : ""),
  }));

  const articlesDeCategorie = (cat) => {
    const memeCat = (p) => (p.categorie || "").trim() === String(cat || "").trim();
    const duDomaine = produitsDuDomaine.filter(memeCat);
    return [...duDomaine, ...produitsBoutique.filter((p) => memeCat(p) && !duDomaine.includes(p))];
  };

  // ---- Besoins du client : liste libre, remplie au fil de l'eau ----
  // Si on reprend un devis (modification/rejet), on repart des lignes RÉELLES du
  // devis d'origine (et non de la simple liste de recherche) : ça restitue aussi
  // les articles qui avaient été saisis directement à la main, sans jamais passer
  // par le champ de recherche — sinon ils disparaissaient purement et simplement.
  // ⚠ Depuis que chaque ligne porte SA catégorie de stock (11/09/2026), le
  // volet reprend tout ce qui n'est pas « Autres équipements » — avant, il
  // filtrait sur le nom du domaine, qui n'est plus sur les lignes.
  const lignesCategorie = besoinsRepris ? lignesReprises.filter((l) => l.categorie !== "Autres équipements") : [];
  // Reconstruit besoins + choix/verrous à partir des mêmes lignes, en tentant de
  // retrouver l'article correspondant en stock — sinon on restitue le prix d'origine tel quel.
  const initialSelection = (() => {
    if (!lignesCategorie.length) return undefined;
    const choix = {}, verrous = {}, besoinsInit = [];
    lignesCategorie.forEach((l) => {
      const id = uid();
      // On retrouve l'article par son NOM dans le stock ; sinon c'est une
      // saisie hors stock, qu'on restitue telle qu'elle avait été écrite.
      // Tout le stock de la boutique : depuis que le domaine RANGE au lieu de
      // CACHER, un devis repris peut contenir un article d'un autre métier.
      const trouve = produitsBoutique.find((p) => p.nom === l.article) || null;
      besoinsInit.push({ id, categorie: trouve ? (trouve.categorie || "").trim() : (l.categorie || ""), qte: String(l.qte), hors_boutique: !!l.hors_boutique });
      choix[id] = trouve
        ? { type: "stock", produit_id: trouve.id, qte: Number(l.qte) || 1 }
        : { type: "manuel", nom: l.article, prix: Number(l.pu) || 0, qte: Number(l.qte) || 1 };
      verrous[id] = true;
    });
    return { choix, verrous, besoinsInit };
  })();
  // Brouillon persistant (survit au F5 et à une nouvelle version) — même
  // règle que Solaire et Garage, qui vit en UN SEUL endroit : Partages.jsx
  // (demande Timo, 02/09/2026 : seul Solaire gardait ses données).
  const brouillon = lireBrouillonVolet("autre", profile, !!devisAReprendre);
  const [besoins, setBesoins] = useState(() => initialSelection?.besoinsInit || brouillon?.besoins || [{ id: uid(), categorie: "", qte: "1" }]);
  // Après un F5 : les articles choisis et leurs quantités tels qu'ils
  // étaient (même règle que Solaire, demande Timo 08/09/2026). Un devis
  // repris prime.
  const selectionDuBrouillon = !initialSelection && brouillon?.choix ? { choix: brouillon.choix, verrous: brouillon.verrous || {} } : null;
  const sauterPremierCalcul = useRef(!!selectionDuBrouillon);

  // Une catégorie choisie propose son PREMIER article ; le vendeur déroule
  // pour en prendre un autre. Aucune correspondance approximative : la liste
  // est celle de la catégorie, rien d'autre.
  const meilleurChoixBesoin = (besoin) => {
    if (!besoin || !besoin.categorie) return null;
    const articles = articlesDeCategorie(besoin.categorie);
    if (articles.length === 0) return null;
    return { type: "stock", produit_id: articles[0].id, qte: Math.max(1, Number(besoin.qte) || 1) };
  };

  const {
    choix, setChoix, manuelOuvert, brouillonManuel, setBrouillonManuel, verrous: besoinsManuels, setVerrous: setBesoinsManuels,
    recalculerNonVerrouilles, changerProduit: changerProduitBase, changerQte: changerQteChoix,
    ouvrirManuel: ouvrirManuelBase, validerManuel, annulerManuel,
  } = useSelectionAvecVerrou(meilleurChoixBesoin, initialSelection || selectionDuBrouillon);

  // RÉACTIF à chaque NOUVELLE reprise de devis — même piège que
  // Ventes.jsx/Commandes.jsx (2.99.13), Solaire.jsx et Garage.jsx : cet
  // écran reste désormais en veille entre deux visites, donc un
  // useState(() => ...) figé au montage ne suffit plus pour un 2e devis
  // repris après le premier.
  useEffect(() => {
    if (!devisAReprendre) return;
    if (initialSelection?.besoinsInit) setBesoins(initialSelection.besoinsInit);
    if (initialSelection) {
      setChoix(initialSelection.choix || {});
      setBesoinsManuels(initialSelection.verrous || {});
    }
    reprendreAutres(lignesReprises);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisAReprendre]);

  const changerProduit = (besoinId, produitId) => changerProduitBase(besoinId, produitId, () => {
    const besoin = besoins.find((b) => b.id === besoinId);
    return Math.max(1, Number(besoin?.qte) || 1);
  });

  // Recalcule les besoins non verrouillés quand la catégorie ou le stock changent.
  useEffect(() => {
    if (sauterPremierCalcul.current) { sauterPremierCalcul.current = false; return; }
    recalculerNonVerrouilles(besoins);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorieChoisie, boutique, db.produits, domaine?.id]);

  const ajouterBesoin = () => setBesoins([...besoins, { id: uid(), categorie: "", qte: "1" }]);

  const majBesoinCategorie = (id, categorie) => {
    setSaisieArticle((avant) => { const n = { ...avant }; delete n[id]; return n; });
    const suivant = besoins.map((b) => (b.id === id ? { ...b, categorie } : b));
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

  // ⚠ Demande Timo : un article du devis (même normal, du stock) peut être
  // coché « hors boutique » (HB) — il ne compte alors NI dans le chiffre
  // d'affaires NI dans les commissions, une fois la vente conclue (voir
  // caVente() dans core.js). Case cochable au cas par cas, indépendante du
  // mode « article hors stock » (qui ne concerne que la saisie manuelle).
  const majBesoinHB = (id, hb) => setBesoins(besoins.map((b) => (b.id === id ? { ...b, hors_boutique: hb } : b)));

  const retirerBesoin = (id) => {
    setBesoins(besoins.filter((b) => b.id !== id));
    setChoix((avant) => { const n = { ...avant }; delete n[id]; return n; });
  };

  // Ce qui est TAPÉ dans « Article proposé » : on ne transforme jamais la
  // frappe ; on ne LIE l'article que s'il porte exactement ce nom (le CLIC sur
  // une proposition, lui, lie toujours — règle du champ commun).
  const [saisieArticle, setSaisieArticle] = useState({});
  const majSaisieArticle = (besoinId, texte) => {
    setSaisieArticle((avant) => ({ ...avant, [besoinId]: texte }));
    const besoin = besoins.find((b) => b.id === besoinId);
    const exact = articlesDeCategorie(besoin?.categorie).find((p) => p.nom === texte);
    changerProduit(besoinId, exact ? exact.id : "");
  };
  const choisirArticle = (besoinId, proposition) => {
    setSaisieArticle((avant) => ({ ...avant, [besoinId]: proposition.valeur }));
    changerProduit(besoinId, proposition.id);
  };

  const ouvrirManuel = (besoinId) => {
    const besoin = besoins.find((b) => b.id === besoinId);
    ouvrirManuelBase(besoinId, { nom: "", prix: "", qte: besoin?.qte || "1" });
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
  const { autres, ajouterAutre, majAutre, retirerAutre, reprendreAutres, totalAutres } = useAutresEquipements(lignesReprises, produitsBoutique, brouillon?.autres);

  const totalArticles = totalRoles + totalAutres;
  // La fin du devis (remise, installation ou pose seule, transport, acompte,
  // délai) : la même règle pour les trois volets (Partages.jsx / devisCommun.js).
  const r = useReglagesDevis(totalArticles, { poseSeule: brouillon?.poseSeule ?? false, montantPoseFixe: brouillon?.montantPoseFixe ?? "" }, devisAReprendre);
  const { pctRemise, remise, fraisInstallation, fraisTransport, totalDevis, poseSeule, montantPoseFixe, montantAcompte } = r;
  // Écrit le brouillon à chaque changement — effacé uniquement une fois le
  // devis réellement envoyé ou converti, jamais avant.
  useEcrireBrouillonVolet("autre", profile, { besoins, poseSeule, montantPoseFixe, choix, verrous: besoinsManuels, autres });

  // ============ ENVOYER LE DEVIS DANS L'ESPACE DU CLIENT ============
  // Compte destinataire, envoi WhatsApp, conversion en vente : la même règle
  // pour les trois volets (useEnvoiDevis). Ici ne restent que les lignes de
  // métier de ce volet, ses besoins et la première ligne du message.
  const envoi = useEnvoiDevis({ db, save, profile, boutique, volet: "autre", devisAReprendre, onDevisRepriseConsomme, onConvertirEnVente });
  const { clientDevis, setClientDevis, nouvClient, setNouvClient, comptesClients } = envoi;

  // Le panier prêt à encaisser : le vendeur n'aura rien à ressaisir.
  const panierMetier = () => [
    ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente, hors_boutique: !!l.besoin.hors_boutique })),
  ];
  const lignesMetier = () => [
        ...lignesDevis.filter((l) => l.produit).map((l) => ({
          categorie: l.besoin.categorie || categorieChoisie, article: l.produit.nom, qte: l.qte,
          pu: l.produit.prix_vente, total: l.sousTotal, hors_boutique: !!l.besoin.hors_boutique,
        })),
  ];

  const argumentsEnvoi = () => ({
    totalDevis,
    messageVide: "Le devis est vide : choisissez un besoin, puis l'article proposé.",
    construire: () => construireDevis({
      profile, boutique, typeDevis: "autre", complement: { domaine: domaine?.id || "autre" },
      // ⚠ Plus de bloc « Votre demande » inventé : le besoin n'est plus une
      // phrase du client mais une CATÉGORIE de stock (Timo, 11/09/2026), et
      // la catégorie TITRE déjà son groupe dans « Équipement proposé » du
      // PDF. La répéter au-dessus serait exactement la tautologie qu'il a
      // fait retirer le matin même. Le devis commence donc à l'équipement.
      besoins: { categorie: categorieChoisie },
      panierMetier: panierMetier(), lignesMetier: lignesMetier(), autres, reglages: r,
    }),
    ligneEntete: [`📦 ${categorieChoisie} — *${fmt(totalDevis)}*`],
  });
  const envoyerDevisWhatsApp = () => envoi.envoyer(argumentsEnvoi());
  const enregistrerBrouillon = () => envoi.enregistrerBrouillon(argumentsEnvoi());

  const convertir = () => envoi.convertir([...panierMetier(), ...panierAutres(autres)], pctRemise);

  // ⚠ Cloisonnement : aucune boutique de l'espace du compte connecté —
  // on n'affiche PAS le formulaire, plutôt que de le laisser écrire dans la
  // boutique de repli (voir boutiqueParDefaut dans lib/calculs.js).
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;
  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs ecran="dimensionnement" db={db} value={bq} onChange={setBq} profile={profile} />}

      {/* Le sélecteur de catégorie a disparu : l'onglet porte déjà le domaine.
          On se contente de signaler quand le stock n'est pas encore rattaché. */}
      {domaine && !rattachementFait && produitsBoutique.length > 0 && (
        <div className="rounded-xl p-3 bg-amber-50 border border-amber-300 text-xs text-amber-900">
          Aucun article de {boutique} n'est encore rattaché au domaine <b>{domaine.nom}</b> : tout le stock de la boutique
          est donc proposé ci-dessous. Rattachez vos articles dans <b>📦 Stocks</b> pour n'avoir plus que les bons.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Besoins du client → articles (stock {domaine ? `domaine ${domaine.nom}` : "de la boutique"} — {boutique})</div>
        <table className="w-full text-sm min-w-[820px]">
          {/* ⚠ Timo (11/09/2026) : « Besoin du client reste toujours besoin et non
              catégorie, et article proposé reste toujours article proposé et non
              article ». Ce sont les MOTS du métier : la colonne dit ce que le
              client veut, pas comment l'application s'y prend. */}
          <thead><tr className="text-xs text-slate-500 uppercase">{["Besoin du client", "Article proposé", "Quantité", "Prix unit.", "Sous-total", "HB", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {lignesDevis.map((l) => {
              const articles = articlesDeCategorie(l.besoin.categorie);
              const enManuel = manuelOuvert[l.besoin.id] || (l.produit?.manuel);
              return (
                <tr key={l.besoin.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
<ChampSuggestions className={`${inputCls} w-48`} placeholder="Cliquez ou tapez le besoin…"
                      valeur={l.besoin.categorie || ""} suggestions={propositionsBesoin}
                      onChange={(v) => majBesoinCategorie(l.besoin.id, v)} />
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
                        {!l.besoin.categorie ? (
                          <span className="text-xs text-slate-400">Choisissez le besoin à gauche…</span>
                        ) : articles.length === 0 ? (
                          <span className="text-xs text-orange-600">Aucun article pour ce besoin chez {boutique}</span>
                        ) : (
                          <ChampSuggestions className={`${inputCls} w-56`} placeholder="Cliquez ou tapez l'article…"
                            valeur={saisieArticle[l.besoin.id] ?? (l.produit && !l.produit.manuel ? l.produit.nom : "")}
                            suggestions={propositionsArticle(l.besoin.categorie)}
                            onChange={(v) => majSaisieArticle(l.besoin.id, v)}
                            onChoisir={(p) => choisirArticle(l.besoin.id, p)} />
                        )}
                        <button onClick={() => ouvrirManuel(l.besoin.id)} className="text-xs font-bold text-sky-800 underline whitespace-nowrap">✏️ Saisir un article hors stock</button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2"><input type="number" min="1" className={`${inputCls} w-20`} value={l.besoin.qte} onChange={(e) => majBesoinQte(l.besoin.id, e.target.value)} /></td>
                  <td className="px-3 py-2 tabular-nums">{l.produit ? fmt(l.produit.prix_vente) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.sousTotal)}</td>
                  <td className="px-3 py-2"><input type="checkbox" checked={!!l.besoin.hors_boutique} onChange={(e) => majBesoinHB(l.besoin.id, e.target.checked)} title="Hors boutique : exclu du chiffre d'affaires et des commissions" /></td>
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
          titre="Autres équipements"
          autres={autres} onAjouter={ajouterAutre} onModifier={majAutre} onRetirer={retirerAutre} db={db} produits={produitsBoutique}
          placeholder="Ex : Câblage"
        />

        <BlocsFinDevis r={r} onConvertir={convertir} />
      </div>

      {/* ---- ENVOYER LE DEVIS AU CLIENT ---- */}
      <BlocEnvoiDevisClient
        db={db} clientDevis={clientDevis} setClientDevis={setClientDevis}
        nouvClient={nouvClient} setNouvClient={setNouvClient}
        comptesClients={comptesClients} profile={profile} onEnvoyer={envoyerDevisWhatsApp} onBrouillon={enregistrerBrouillon}
      />


      {noteDimensionnement(db) && (
        <div className="text-xs text-slate-400 whitespace-pre-line">
          {noteDimensionnement(db)}
        </div>
      )}
    </div>
  );
}
