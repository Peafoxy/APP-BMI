// ============================================================
// screens/dimensionnement/Autre.jsx — Volet Autre : catégories libres, correspondance besoin ↔ produits
// du stock par similarité de nom.
// ============================================================
import { useState, useEffect } from "react";
import { BoutiqueTabs } from "../../components/SelecteurBoutique";
import { uid, fmt, today } from "../../lib/core";
import { Field, inputCls, Badge, Panel, uAlert, AucuneBoutique } from "../../components/ui";
import { normNom, boutiquesVente, bloquerSiLecture, noteDimensionnement, boutiqueParDefaut, estCompteFormation, espaceDuCompte, estBoutiqueFormation, boutiqueRetenue } from "../../lib/calculs";
import { BlocAutresEquipements, BlocTotauxDevis, useTotauxDevis, BlocEnvoiDevisClient, envoyerDevisEtOuvrirWhatsApp, resoudreClientDevis , useConditionsPaiement, BlocConditionsPaiement, appliquerConditionsReprises } from "./Partages";
import { useSelectionAvecVerrou } from "./Selecteur";

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
export function DimensionnementAutre({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme, domaine }) {
  const premiere = boutiqueParDefaut(db, profile);
  const [bq, setBq] = useState(profile.boutique || premiere);
  // ⚠ Voir boutiqueRetenue (lib/calculs.js) : la valeur mémorisée peut être
  // vide (écran ouvert pendant la synchronisation d'ouverture) ou désigner
  // une boutique qui n'existe plus (supprimée, ou effacée par une
  // réinitialisation). Dans les deux cas, on repart de la boutique par
  // défaut plutôt que d'afficher un écran figé ou un nom fantôme.
  const boutique = boutiqueRetenue(db, profile, bq);
  const produitsBoutique = db.produits.filter((p) => p.boutique === boutique);

  // ⚠ Demande Timo (18/08/2026) : « dans Autre, au lieu de faire sélectionner
  // les catégories, c'est le domaine ». C'est désormais l'ONGLET qui porte le
  // domaine ; la liste ci-dessous ne montre donc que SES familles, au lieu de
  // déverser toutes les catégories du stock mélangées.
  //
  // Le repli est indispensable : tant qu'un article n'a pas été rattaché à un
  // domaine, sa catégorie doit rester proposée — sinon un stock existant
  // deviendrait invisible du jour au lendemain.
  const famillesDuDom = domaine ? (domaine.familles || []) : [];
  const categoriesEnStock = [...new Set(produitsBoutique
    .filter((p) => !domaine || !p.domaine || p.domaine === domaine.id)
    .map((p) => p.categorie || "Autre"))];
  const categories = [...new Set([
    ...famillesDuDom.filter((f) => produitsBoutique.some((p) => (p.categorie || "Autre") === f)),
    ...categoriesEnStock,
  ])].sort();
  const besoinsRepris = devisAReprendre?.devis?.besoins;
  const lignesReprises = devisAReprendre?.devis?.lignes || [];
  const [categorieChoisie, setCategorieChoisie] = useState(besoinsRepris?.categorie || "");
  useEffect(() => { if (!categorieChoisie && categories.length > 0) setCategorieChoisie(categories[0]); }, [categories.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const produitsCategorie = produitsBoutique.filter((p) => (p.categorie || "Autre") === categorieChoisie
    && (!domaine || !p.domaine || p.domaine === domaine.id));

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
      besoinsInit.push({ id, nom: l.article, qte: String(l.qte), hors_boutique: !!l.hors_boutique });
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
    choix, setChoix, manuelOuvert, brouillonManuel, setBrouillonManuel, verrous: besoinsManuels, setVerrous: setBesoinsManuels,
    recalculerNonVerrouilles, changerProduit: changerProduitBase, changerQte: changerQteChoix,
    ouvrirManuel: ouvrirManuelBase, validerManuel, annulerManuel,
  } = useSelectionAvecVerrou(meilleurChoixBesoin, initialSelection);

  // RÉACTIF à chaque NOUVELLE reprise de devis — même piège que
  // Ventes.jsx/Commandes.jsx (2.99.13), Solaire.jsx et Garage.jsx : cet
  // écran reste désormais en veille entre deux visites, donc un
  // useState(() => ...) figé au montage ne suffit plus pour un 2e devis
  // repris après le premier.
  useEffect(() => {
    if (!devisAReprendre) return;
    if (besoinsRepris?.categorie) setCategorieChoisie(besoinsRepris.categorie);
    if (initialSelection?.besoinsInit) setBesoins(initialSelection.besoinsInit);
    if (initialSelection) {
      setChoix(initialSelection.choix || {});
      setBesoinsManuels(initialSelection.verrous || {});
    }
    setAutres(lignesReprises.filter((l) => l.categorie === "Autres équipements")
      .map((l) => ({ id: uid(), nom: l.article, prix: String(l.pu), qte: String(l.qte), hors_boutique: !!l.hors_boutique })));
    setClientDevis(devisAReprendre?.client?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisAReprendre]);

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
      .map((l) => ({ id: uid(), nom: l.article, prix: String(l.pu), qte: String(l.qte), hors_boutique: !!l.hors_boutique }))
  );
  const ajouterAutre = () => setAutres([...autres, { id: uid(), nom: "", prix: "", qte: "1" }]);
  const majAutre = (id, champ, val) => setAutres(autres.map((a) => (a.id === id ? { ...a, [champ]: val } : a)));
  const retirerAutre = (id) => setAutres(autres.filter((a) => a.id !== id));
  const totalAutres = autres.reduce((s, a) => s + Number(a.prix || 0) * Number(a.qte || 1), 0);

  const totalArticles = totalRoles + totalAutres;
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
    ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente, hors_boutique: !!l.besoin.hors_boutique })),
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
    if (totalDevis <= 0) { uAlert("Le devis est vide : décrivez d'abord les besoins du client."); return; }

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
      type_devis: "autre",
      domaine: domaine?.id || "autre",
      besoins: {
        categorie: categorieChoisie,
        articles_demandes: besoins.filter((b) => b.nom.trim()).map((b) => ({ nom: b.nom.trim(), qte: Number(b.qte || 1) })),
      },
      lignes: [
        ...lignesDevis.filter((l) => l.produit).map((l) => ({
          categorie: categorieChoisie, article: l.produit.nom, qte: l.qte,
          pu: l.produit.prix_vente, total: l.sousTotal, hors_boutique: !!l.besoin.hors_boutique,
        })),
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
      ligneEntete: [`📦 ${categorieChoisie} — *${fmt(totalDevis)}*`],
      idAReprendre: devisAReprendre?.devis?.id,
    });
    if (!envoye) return;

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

  // ⚠ Cloisonnement : aucune boutique de l'espace du compte connecté —
  // on n'affiche PAS le formulaire, plutôt que de le laisser écrire dans la
  // boutique de repli (voir boutiqueParDefaut dans lib/calculs.js).
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;
  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} profile={profile} />}

      <Panel boutique={boutique}>
        <div className="font-bold mb-3">{domaine ? `${domaine.icone} Famille de produit — ${domaine.nom}` : "📦 Catégorie de produit"} <Badge boutique={boutique} /></div>
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
          <thead><tr className="text-xs text-slate-500 uppercase">{["Besoin du client", "Article proposé", "Quantité", "Prix unit.", "Sous-total", "HB", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
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
          titre={`Autres équipements (hors catégorie « ${categorieChoisie} »)`}
          autres={autres} onAjouter={ajouterAutre} onModifier={majAutre} onRetirer={retirerAutre}
          placeholder="Ex : Câblage"
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
