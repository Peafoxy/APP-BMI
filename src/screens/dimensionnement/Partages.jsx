// ============================================================
// screens/dimensionnement/Partages.jsx — Blocs partagés par les trois volets : lecture des specs dans les
// noms d'articles, autres équipements, totaux du devis (remise,
// installation, transport), envoi du devis au client via WhatsApp.
// ============================================================
import { useState, useEffect } from "react";
import { maintenantISO } from "../../lib/horloge";
import { ChampSuggestions } from "../../components/ChampSuggestions";
import { propositionsComptesDevis, libelleCompteDevis } from "../../lib/clientsConnus";
import { ADRESSE_APP, chiffresTel, identifiantClient, motDePasseClient, fabriquerCompteClient, messagesNouveauClient, motDePasseConnu, marquerModification, LIBELLE_ROLE_EMPLOYE } from "../../lib/comptesClients";
import { fmt, dFR, telDigits, col, brouillonLire, brouillonEcrire, brouillonEffacer, uid, today, heureCourte, nouveauMessage } from "../../lib/core";
import { envoyerModele, envoyerAccesSansRepli, messagesAvecLigneEnvoi, messagesAvecLigneAcces } from "../../whatsapp";
import { envoiDevisDisponible, accesDejaEnvoyes, traceEnvoi, motifAttendu, messageDevisEnvoye } from "../../lib/whatsappModeles";
import { marquerDevisCorrige } from "../../lib/modifDevis";
import { devisACompleter } from "../../lib/devisCfVisite";
import { prospectAvecDevis } from "../../lib/prospects";
import { apporteurVide, apporteurDepuisDevis, apporteurDuFormulaire, critiqueApporteur, baseApporteurSaisie, commissionApporteur, TAUX_APPORTEUR_DEFAUT } from "../../lib/apporteurDevis";

// ============ BROUILLONS DES TROIS VOLETS — LA RÈGLE EN UN SEUL ENDROIT ============
// Demande Timo (02/09/2026) : « tous les écrans du dimensionnement doivent
// garder les données après un F5 ou une nouvelle version » — seul Solaire
// le faisait, avec sa propre copie de la règle. Elle vit désormais ICI,
// et les trois volets s'y branchent : une seule règle, trois clients.
//   • lireBrouillonVolet   : à l'ouverture de l'écran (un devis repris a
//     toujours priorité — cas plus rare et plus intentionnel) ;
//   • useEcrireBrouillonVolet : réécrit le brouillon à chaque changement ;
//   • effacerBrouillonVolet   : quand le devis est réellement parti
//     (envoyé au client, ou converti en vente) — jamais avant.
// Le brouillon est PAR COMPTE (deux personnes sur le même appareil ne se
// mélangent pas) et PAR VOLET (le solaire n'écrase pas le portail).
export const cleBrouillonVolet = (volet, profile) => `bmi_brouillon_dim_${volet}:${profile.id}`;
export const lireBrouillonVolet = (volet, profile, devisReprisPrioritaire) =>
  devisReprisPrioritaire ? null : brouillonLire(cleBrouillonVolet(volet, profile));
export function useEcrireBrouillonVolet(volet, profile, etat) {
  const texte = JSON.stringify(etat);
  useEffect(() => {
    brouillonEcrire(cleBrouillonVolet(volet, profile), JSON.parse(texte));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volet, profile.id, texte]);
}
export const effacerBrouillonVolet = (volet, profile) => brouillonEffacer(cleBrouillonVolet(volet, profile));
import { Field, inputCls, uAlert, uConfirm, uPrompt, ChampQuiGrandit } from "../../components/ui";
import { ChampsEntreprise } from "../../components/ChampsEntreprise";
import { ENTREPRISE_VIDE, formulaireDepuisEntreprise, critiquePrenom, critiqueEntreprise, champsCompteClient, champsIdentite, ficheAvecIdentite, nettoyerPrenom } from "../../lib/clientEntreprise";
import { marqueEspace, memeNumero, remiseExigeAdmin, PLAFOND_REMISE_PCT, bloquerSiLecture, espaceDuCompte, espaceDeLaFiche, estBoutiqueFormation, stockActuel, idsClientsArchives, utilisateursDeLEspace, ONGLETS_ROLE } from "../../lib/calculs";
import { avecInstallationDuDevis } from "../../lib/achatsChantier";
import { reprisesAutres, nouvelAutre, nouvelAutreCfVisite, autresACompleter, totalAutres, calculerTotaux, MODE_POURCENT, MODE_MONTANT, ajouterBrouillon, retirerBrouillon, lierAutreAuStock, nomDuBrouillon, critiqueNomBrouillon, nomRepris, clientDeLaReprise, NB_DEVIS_MAX, peutEtablirPourAutrui, auteursPossibles, auteurDuDevis, devisEtabliPour, garderAuteur, critiqueAuteur, remplacePour, devisRemplace, auteursDesBrouillons, critiqueBrouillonAutrui, avisBrouillonEnvoye } from "./devisCommun";
// ⚠ Ces règles vivent dans lib/choixSolaire.js depuis le 24/09/2026 (le
// serveur les lit aussi, pour l'estimation de l'assistant WhatsApp). On les
// IMPORTE puis on les RÉEXPORTE : `export { x } from` ne crée pas de nom
// local, et ce fichier s'en sert (piège touché deux fois, CLAUDE.md § 5).
import { FACTEUR_PUISSANCE_VA, puissanceUtileW, quantiteNecessaire, simplifierMot, memeFamille, contientLeMot, specDepuisNom } from "../../lib/choixSolaire";
export { FACTEUR_PUISSANCE_VA, puissanceUtileW, quantiteNecessaire, simplifierMot, memeFamille, contientLeMot, specDepuisNom };

// ⚠ CONDITIONS COMMERCIALES D'UN DEVIS REPRIS (2.100.39) — reprendre un devis
// rejeté restituait les appareils, les équipements et les accessoires, mais
// PERDAIT en silence tout ce qui avait été négocié : la remise accordée, le
// pourcentage d'installation, le transport, l'acompte exigé, le délai promis,
// et jusqu'à la case « pose seule » avec son montant fixe de main d'œuvre.
// Le devis renvoyé au client n'était donc plus celui qui avait été négocié.
// Toutes ces valeurs étaient pourtant bien ENREGISTRÉES : il ne manquait que
// leur relecture. Partagé par les trois volets (Solaire, Garage, Autre).
export function appliquerConditionsReprises(devis, s) {
  if (!devis) return;
  // 12/10/2026 : une remise, des frais, un transport en MONTANT LIBRE reviennent
  // en montant libre, avec le même montant (un ancien devis : en pourcentage).
  const libre = (mode) => mode === MODE_MONTANT;
  s.setPctRemise(String(libre(devis.mode_remise) ? 0 : devis.pct_remise ?? 0));
  s.setPctTransport(String(devis.pct_transport ?? 0));
  if (s.setModeRemise) {
    s.setModeRemise(libre(devis.mode_remise) ? MODE_MONTANT : MODE_POURCENT);
    s.setMontantRemise(libre(devis.mode_remise) ? String(devis.remise ?? "") : "");
    s.setModeInstall(libre(devis.mode_installation) ? MODE_MONTANT : MODE_POURCENT);
    s.setMontantInstall(libre(devis.mode_installation) ? String(devis.frais_installation ?? "") : "");
    s.setModeTransport(libre(devis.mode_transport) ? MODE_MONTANT : MODE_POURCENT);
    s.setMontantTransport(libre(devis.mode_transport) ? String(devis.frais_transport ?? "") : "");
  }
  s.setPctAcompte(String(devis.pct_acompte ?? 100));
  s.setDelaiInstallation(String(devis.delai_installation || ""));
  // 📝 La ligne NB (08/10/2026) revient avec le devis repris ou le brouillon.
  if (s.setNb) s.setNb(String(devis.nb || ""));
  // 🔧 La case « Avec installation » (11/10/2026) : un devis d'avant ne la
  // porte pas — elle repart d'office (cochée s'il y a des frais d'installation).
  if (s.setAvecInstallation) s.setAvecInstallation(devis.avec_installation === true || devis.avec_installation === false ? devis.avec_installation : null);
  // « Pose seule » : le montant de main d'œuvre est un montant FIXE, pas un
  // pourcentage — il est rangé dans frais_installation, et pct_installation
  // vaut null. On rétablit la case ET son montant, sinon le devis repris
  // repasserait en pourcentage sans prévenir.
  const pose = !!devis.pose_seule;
  s.setPoseSeule(pose);
  s.setMontantPoseFixe(pose ? String(devis.frais_installation ?? "") : "");
  s.setPctInstall(pose ? "10" : String(devis.pct_installation ?? 10));
  // 🤝 L'apporteur externe nommé dans le devis (29/09/2026) — avec la marque
  // du principal s'il a fixé le pourcentage dans le brouillon.
  if (s.setApporteur) s.setApporteur(apporteurDepuisDevis(devis));
}

// (VA ≠ watts, quantité jamais plafonnée, « BATERIE » reconnu, familles
// comparées en simplifié, caractéristique lue dans le nom : leur histoire
// est écrite dans lib/choixSolaire.js, où ces règles vivent désormais.)

// ---- Bloc « Autres équipements » : lignes libres (nom + prix + quantité) ----
export function BlocAutresEquipements({ titre, autres, onAjouter, onAjouterCfVisite, onModifier, onRetirer, placeholder, db, produits = [] }) {
  // Les articles du stock de la boutique regardée sont proposés dans le
  // champ (liste déroulante + saisie libre) ; choisir l'un d'eux pré-remplit
  // le prix et lie la ligne (voir lierAutreAuStock). Un nom qui n'y est
  // pas reste une saisie libre, HB cochée d'office. Aucune mention sous le
  // champ (Timo, 08/09/2026 : « supprimer la mention ») : la case HB dit tout.
  const propositions = produits.map((p) => ({ cle: p.id, valeur: p.nom, detail: db ? `${stockActuel(db, p)} en stock — ${fmt(p.prix_vente)}` : fmt(p.prix_vente) }));
  return (
    <div className="px-4 py-3 border-t border-slate-200">
      <div className="font-bold text-sm text-slate-700 mb-2">{titre}</div>
      <div className="space-y-2">
        {autres.map((a) => a.cf_visite ? (
          // 📋 Un élément à compléter après la visite (08/10/2026) : un nom, une
          // quantité facultative, AUCUN prix — le PDF écrit « Cf. visite ».
          // Le nom se choisit dans le stock OU se tape (capture Timo, le même
          // jour) — LE champ commun ; la ligne reste sans prix et sans lien
          // (majAutre ne la lie pas) : c'est « ✍️ Compléter le devis » qui
          // reprendra l'article du stock et son prix.
          <div key={a.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end rounded-lg bg-amber-50 border border-amber-200 p-2" data-ligne-cf-visite>
            <Field label="Élément à compléter (cf. visite)">
              <ChampSuggestions placeholder="Article du stock ou nom libre (ex : câblage)" valeur={a.nom} suggestions={propositions} onChange={(v) => onModifier(a.id, "nom", v)} />
            </Field>
            <div className="text-sm font-bold text-amber-800 pb-2">Prix : cf. visite</div>
            <Field label="Quantité (facultative)"><input type="number" min="1" className={inputCls} value={a.qte} onChange={(e) => onModifier(a.id, "qte", e.target.value)} /></Field>
            <div />
            <button onClick={() => onRetirer(a.id)} className="text-xs text-red-600 underline pb-2">Retirer</button>
          </div>
        ) : (
          <div key={a.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
            <Field label="Article">
              <ChampSuggestions placeholder={placeholder} valeur={a.nom} suggestions={propositions} onChange={(v) => onModifier(a.id, "nom", v)} />
            </Field>
            <Field label="Prix unitaire (F)"><input type="number" className={inputCls} value={a.prix} onChange={(e) => onModifier(a.id, "prix", e.target.value)} /></Field>
            <Field label="Quantité"><input type="number" min="1" className={inputCls} value={a.qte} onChange={(e) => onModifier(a.id, "qte", e.target.value)} /></Field>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 pb-2" title="Ne compte ni dans le chiffre d'affaires ni dans les commissions — pour un article que BMI facture sans qu'il vienne de son propre stock.">
              <input type="checkbox" checked={!!a.hors_boutique} onChange={(e) => onModifier(a.id, "hors_boutique", e.target.checked)} /> HB
            </label>
            <button onClick={() => onRetirer(a.id)} className="text-xs text-red-600 underline pb-2">Retirer</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4">
        <button onClick={onAjouter} className="text-sm font-bold text-sky-800 underline">➕ Ajouter un équipement</button>
        {onAjouterCfVisite && (
          <button onClick={onAjouterCfVisite} className="text-sm font-bold text-amber-800 underline" data-ajouter-cf-visite
            title="Un élément qu'on ne peut chiffrer qu'après la visite technique : il s'écrit « Cf. visite » sur le devis, sans prix">
            ➕ Élément à compléter (cf. visite)
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Bloc totaux : remise (sur les articles uniquement) → installation → transport → total ----
// 12/10/2026 (Timo, « lance ») : le libellé de chaque ligne est une LISTE —
// « … % » (un pourcentage des articles, d'office) ou « … libre » (le montant
// tapé en francs). La ligne d'installation n'existe que si « 🔧 Avec
// installation » est cochée (décochée : matériel seul, aucun frais).
function LigneReglage({ libelle, mode, setMode, pct, setPct, montant, setMontant, resultat, negatif = false, auChangement, attr }) {
  const changer = (fn) => (e) => { fn(e.target.value); if (auChangement) auChangement(); };
  const choisir = (e) => {
    const m = e.target.value;
    // Passer en libre garde le montant du moment : le total ne saute pas.
    if (m === MODE_MONTANT && !String(montant ?? "").trim()) setMontant(String(resultat || 0));
    setMode(m);
    if (auChangement) auChangement();
  };
  return (
    <div className="flex items-center gap-2 text-sm flex-wrap justify-end" {...attr}>
      <select value={mode} onChange={choisir} aria-label={libelle} className="rounded border border-slate-300 bg-white px-1 py-0.5 text-slate-600">
        <option value={MODE_POURCENT}>{libelle} %</option>
        <option value={MODE_MONTANT}>{libelle} libre</option>
      </select>
      {mode === MODE_MONTANT ? (
        <>
          <input type="number" min="0" step="500" value={montant} onChange={changer(setMontant)} className="w-28 rounded border border-slate-300 px-2 py-0.5 text-right" />
          <span className="text-slate-500">F</span>
          {negatif && <><span className="text-slate-500">= −</span><span className="font-semibold text-red-600">{fmt(resultat)}</span></>}
        </>
      ) : (
        <>
          <input type="number" min="0" max="100" step="0.5" value={pct} onChange={changer(setPct)} className="w-16 rounded border border-slate-300 px-2 py-0.5 text-right" />
          <span className="text-slate-500">{negatif ? "% = −" : "% ="}</span><span className={`font-semibold ${negatif ? "text-red-600" : ""}`}>{fmt(resultat)}</span>
        </>
      )}
    </div>
  );
}

export function BlocTotauxDevis({ r, onConvertir }) {
  const installationVisible = !r.poseSeule && avecInstallationDuDevis({ poseSeule: r.poseSeule, fraisInstallation: r.fraisInstallationBrut, choix: r.avecInstallation });
  // Toucher aux frais, c'est vouloir installer : la case se coche pour de bon
  // (sinon vider le champ pour retaper un chiffre ferait disparaître la ligne).
  const installer = () => { if (r.avecInstallation == null) r.setAvecInstallation(true); };
  return (
    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Articles :</span><span className="font-semibold">{fmt(r.totalArticles)}</span>
        </div>
        <LigneReglage libelle="Remise" mode={r.modeRemise} setMode={r.setModeRemise} pct={r.pctRemise} setPct={r.setPctRemise}
          montant={r.montantRemise} setMontant={r.setMontantRemise} resultat={r.remise} negatif attr={{ "data-ligne-remise": "" }} />
        {installationVisible && (
          <LigneReglage libelle="Frais d'installation" mode={r.modeInstall} setMode={r.setModeInstall} pct={r.pctInstall} setPct={r.setPctInstall}
            montant={r.montantInstall} setMontant={r.setMontantInstall} resultat={r.fraisInstallation} auChangement={installer} attr={{ "data-ligne-installation": "" }} />
        )}
        <LigneReglage libelle="Transport / livraison" mode={r.modeTransport} setMode={r.setModeTransport} pct={r.pctTransport} setPct={r.setPctTransport}
          montant={r.montantTransport} setMontant={r.setMontantTransport} resultat={r.fraisTransport} attr={{ "data-ligne-transport": "" }} />
        <span className="text-lg font-bold text-sky-800">Total : {fmt(r.totalDevis)}</span>
      </div>
      <button onClick={onConvertir} className="px-5 py-2 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800">🛒 Convertir en vente</button>
    </div>
  );
}

// ---- Les « autres équipements » : même état, mêmes gestes dans les trois volets ----
// Après un F5 ou une mise à jour, les lignes ajoutées reviennent (Timo,
// 08/09/2026 : « quand on ajoute un équipement, après F5 il disparaît ») :
// chaque volet passe ce qu'il a dans SON brouillon. Un devis repris prime.
export function useAutresEquipements(lignesReprises, produitsBoutique = [], autresDuBrouillon = null) {
  const [autres, setAutres] = useState(() => (lignesReprises?.length ? reprisesAutres(lignesReprises) : (Array.isArray(autresDuBrouillon) ? autresDuBrouillon : [])));
  return {
    autres,
    ajouterAutre: () => setAutres([...autres, nouvelAutre()]),
    ajouterAutreCfVisite: () => setAutres([...autres, nouvelAutreCfVisite()]),
    // Le NOM passe par la règle du stock (lien, prix, HB) ; les autres champs
    // se modifient tels quels. Une ligne cf. visite ne se lie JAMAIS au stock
    // (elle n'a pas de prix : c'est une description).
    majAutre: (id, champ, val) => setAutres(autres.map((a) => (a.id !== id ? a : champ === "nom" && !a.cf_visite ? lierAutreAuStock(a, val, produitsBoutique) : { ...a, [champ]: val }))),
    retirerAutre: (id) => setAutres(autres.filter((a) => a.id !== id)),
    // Reprise d'un autre devis pendant que l'écran est ouvert.
    reprendreAutres: (lignes) => setAutres(reprisesAutres(lignes)),
    totalAutres: totalAutres(autres),
    aCompleter: autresACompleter(autres),
  };
}

// ---- Les réglages de fin de devis : remise, installation (ou pose seule à
// montant fixe), transport, acompte, délai — et les totaux qui en découlent
// (devisCommun.js). Un devis repris rétablit tout ce qui avait été négocié
// (appliquerConditionsReprises) : sans cela le devis renvoyé au client
// n'était plus celui convenu avec lui.
export function useReglagesDevis(totalArticles, initial = {}, devisAReprendre, { principal = false } = {}) {
  const [pctRemise, setPctRemise] = useState("0");
  const [pctInstall, setPctInstall] = useState("10");
  const [pctTransport, setPctTransport] = useState("0");
  // 12/10/2026 : chaque ligne en % (d'office) ou en montant libre.
  const [modeRemise, setModeRemise] = useState(MODE_POURCENT);
  const [montantRemise, setMontantRemise] = useState("");
  const [modeInstall, setModeInstall] = useState(MODE_POURCENT);
  const [montantInstall, setMontantInstall] = useState("");
  const [modeTransport, setModeTransport] = useState(MODE_POURCENT);
  const [montantTransport, setMontantTransport] = useState("");
  // ⚠ "Pose seule" (demande Timo) : le client a déjà acheté son matériel
  // ailleurs, BMI ne facture QUE la main d'œuvre — jamais un pourcentage du
  // matériel, un MONTANT FIXE saisi pour chaque chantier.
  const [poseSeule, setPoseSeule] = useState(initial.poseSeule ?? false);
  const [montantPoseFixe, setMontantPoseFixe] = useState(initial.montantPoseFixe ?? "");
  const { pctAcompte, setPctAcompte, delaiInstallation, setDelaiInstallation } = useConditionsPaiement();
  // 🤝 L'apporteur externe (Timo, 29/09/2026) — lib/apporteurDevis.js.
  const [apporteur, setApporteur] = useState(apporteurVide);
  // 📝 La ligne NB du devis (Timo, 08/10/2026) — tapée à la main, facultative.
  const [nb, setNb] = useState("");
  // 🔧 « Avec installation » : null = d'office (cochée dès qu'il y a des frais
  // d'installation) ; vrai / faux = choisi par celui qui établit le devis.
  const [avecInstallation, setAvecInstallation] = useState(null);
  useEffect(() => {
    appliquerConditionsReprises(devisAReprendre?.devis, {
      setPctRemise, setPctInstall, setPctTransport, setPctAcompte,
      setDelaiInstallation, setPoseSeule, setMontantPoseFixe, setApporteur, setNb, setAvecInstallation,
      setModeRemise, setMontantRemise, setModeInstall, setMontantInstall, setModeTransport, setMontantTransport,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisAReprendre]);
  const totaux = calculerTotaux({ totalArticles, pctRemise, pctInstall, pctTransport, poseSeule, montantPoseFixe, pctAcompte,
    modeRemise, montantRemise, modeInstall, montantInstall, modeTransport, montantTransport, avecInstallation });
  return {
    totalArticles, pctRemise, setPctRemise, pctInstall, setPctInstall, pctTransport, setPctTransport,
    modeRemise, setModeRemise, montantRemise, setMontantRemise, modeInstall, setModeInstall, montantInstall, setMontantInstall,
    modeTransport, setModeTransport, montantTransport, setMontantTransport,
    poseSeule, setPoseSeule, montantPoseFixe, setMontantPoseFixe,
    pctAcompte, setPctAcompte, delaiInstallation, setDelaiInstallation, ...totaux,
    apporteur, setApporteur, principal, nb, setNb, avecInstallation, setAvecInstallation,
  };
}

// ---- La case « Pose seule » et son montant ----
export function BlocPoseSeule({ r }) {
  return (
    <div className="px-4 py-3 border-t border-slate-200">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={r.poseSeule} onChange={(e) => r.setPoseSeule(e.target.checked)} />
        Pose seule (matériel déjà acheté par le client — BMI ne facture que la main d'œuvre)
      </label>
      {r.poseSeule && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-slate-500">Montant de la main d'œuvre (F CFA, fixé pour ce chantier)</span>
          <input type="number" min="0" value={r.montantPoseFixe} onChange={(e) => r.setMontantPoseFixe(e.target.value)} className="w-32 rounded border border-slate-300 px-2 py-1 text-right" />
        </div>
      )}
    </div>
  );
}

// ---- 🤝 L'apporteur externe nommé dans le devis (Timo, 29/09/2026) ----
// Tous ceux qui établissent un devis peuvent le nommer ; son pourcentage est
// 3 % d'office et NE SE CHANGE PAS, sauf par l'administrateur principal —
// sur son propre devis, ou sur le brouillon d'un autre (📝 Mes brouillons).
export function BlocApporteurDevis({ r }) {
  const a = r.apporteur || apporteurVide();
  const maj = (champ, v) => r.setApporteur({ ...a, [champ]: v });
  const base = baseApporteurSaisie(r);
  return (
    <div className="px-4 py-3 border-t border-slate-200" data-apporteur-devis>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={!!a.actif} onChange={(e) => r.setApporteur(e.target.checked ? { ...apporteurVide(), actif: true } : apporteurVide())} />
        🤝 Un <b>apporteur externe</b> (non-utilisateur) a amené ce client
      </label>
      {a.actif && (
        <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <Field label="Nom et prénom(s)"><input className={inputCls} value={a.nom} onChange={(e) => maj("nom", e.target.value)} /></Field>
          <Field label="Téléphone"><input type="tel" className={inputCls} value={a.tel} onChange={(e) => maj("tel", e.target.value)} /></Field>
          <Field label="Commission (%)">
            <input type="number" min="0" max="100" step="0.5" className={inputCls} value={a.taux} disabled={!r.principal} data-taux-apporteur
                   onChange={(e) => r.setApporteur({ ...a, taux: e.target.value, taux_fixe_par: null, taux_fixe_le: null })} />
          </Field>
          <div className="text-sm font-bold text-amber-800 self-end pb-2">
            Commission : <span className="tabular-nums">{fmt(commissionApporteur(base, a.taux))}</span>
          </div>
          <div className="sm:col-span-2 lg:col-span-4 text-xs text-amber-900">
            {a.taux_fixe_par
              ? <>Pourcentage fixé à <b>{a.taux} %</b> par {a.taux_fixe_par}{a.taux_fixe_le ? ` le ${dFR(a.taux_fixe_le)}` : ""}.</>
              : r.principal
                ? <>Calculée sur {r.poseSeule ? "le montant de la pose" : "les articles (remise déduite)"}. Vous seul pouvez changer le pourcentage.</>
                : <>🔒 Fixé à {TAUX_APPORTEUR_DEFAUT} %. Pour un autre pourcentage : « 📝 Enregistrer un brouillon » — l'administrateur principal le fixera, puis reprenez-le pour l'envoyer.</>}
            {" "}Due après la réception des travaux et le solde du client.
          </div>
        </div>
      )}
    </div>
  );
}

// ---- La fin du devis, telle qu'elle s'affiche dans les trois volets ----
export function BlocsFinDevis({ r, onConvertir, aCompleter = false }) {
  return (
    <>
      <BlocPoseSeule r={r} />
      <BlocTotauxDevis r={r} onConvertir={onConvertir} />
      <BlocConditionsPaiement
        pctAcompte={r.pctAcompte} setPctAcompte={r.setPctAcompte}
        delaiInstallation={r.delaiInstallation} setDelaiInstallation={r.setDelaiInstallation}
        montantAcompte={r.montantAcompte} totalDevis={r.totalDevis} aCompleter={aCompleter}
      />
      <BlocAvecInstallation r={r} />
      <BlocApporteurDevis r={r} />
      <BlocNbDevis r={r} />
    </>
  );
}

// ---- 🔧 « Avec installation » (Timo, 11/10/2026, « H : la case sur le devis ») ----
// Cochée d'office dès qu'il y a des frais d'installation ; on la coche pour une
// installation OFFERTE, on la décoche pour du matériel seul. Elle décide si le
// matériel sort du stock au paiement (matériel seul, comme avant) ou plus tard,
// par la case « 🏗 Chantier » de 💰 Ventes. Pas de case pour une pose seule.
export function BlocAvecInstallation({ r }) {
  if (r.poseSeule) return null;
  const coche = avecInstallationDuDevis({ poseSeule: r.poseSeule, fraisInstallation: r.fraisInstallationBrut ?? r.fraisInstallation, choix: r.avecInstallation });
  return (
    <div className="px-4 py-3 border-t border-slate-200" data-avec-installation>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={coche} onChange={(e) => r.setAvecInstallation(e.target.checked)} data-coche-avec-installation />
        🔧 <b>Avec installation</b> — BMI installe ce matériel
      </label>
      <div className="text-xs text-slate-500 mt-1">
        {coche
          ? <>Le matériel ne sortira du stock qu'au moment où les techniciens viendront le chercher (case « 🏗 Chantier » de 💰 Ventes).{!(Number(r.fraisInstallation) > 0) && <b className="text-amber-700"> Installation offerte : aucun frais d'installation sur ce devis.</b>}</>
          : <>Matériel seul, sans frais d'installation : il sortira du stock au paiement du devis.</>}
      </div>
    </div>
  );
}

// ---- 📝 La ligne « NB » du devis (Timo, 08/10/2026, « 1a, 2b, 3a ») ----
// Tapée à la main sur CE devis, facultative, 300 caractères au plus. Elle
// s'écrit « NB : … » dans la place blanche à GAUCHE du TOTAL sur le PDF, et
// sous le matériel dans l'espace du client ; vide, elle n'apparaît nulle part.
export function BlocNbDevis({ r }) {
  const reste = NB_DEVIS_MAX - String(r.nb || "").length;
  return (
    <div className="px-4 py-3 border-t border-slate-200" data-nb-devis>
      <Field label="📝 NB (facultatif) — écrit sur le devis, à gauche du total">
        <ChampQuiGrandit valeur={r.nb || ""} onChange={(v) => r.setNb(String(v).slice(0, NB_DEVIS_MAX))}
          placeholder="Ex : le câblage au-delà de 20 m sera facturé à part." maxLignes={4} />
      </Field>
      <div className={`text-xs mt-1 ${reste <= 20 ? "text-amber-700 font-semibold" : "text-slate-400"}`}>{reste} caractère{reste > 1 ? "s" : ""} restant{reste > 1 ? "s" : ""} — cinq lignes au plus, à gauche du total.</div>
    </div>
  );
}

// ---- L'envoi au client et la conversion en vente, communs aux trois volets.
// Le volet ne fournit que ce qui lui est propre : le devis construit, la
// première ligne du message WhatsApp, le message « devis vide ».
// Le client d'un devis : nom, prénom, numéro WhatsApp, et l'entreprise
// qu'il représente (29/09/2026).
const CLIENT_VIDE = () => ({ nom: "", prenom: "", tel: "", entreprise: ENTREPRISE_VIDE() });

export function useEnvoiDevis({ db, save, profile, boutique, volet, devisAReprendre, onDevisRepriseConsomme, onConvertirEnVente, r, aCompleter = false }) {
  // 🤝 Le refus de l'apporteur, revérifié DANS le geste (envoi, brouillon,
  // conversion) : le champ grisé à l'écran ne suffit pas.
  const refusApporteur = () => {
    const refus = critiqueApporteur(r && r.apporteur, { principal: !!(r && r.principal) });
    if (refus) { uAlert(refus); return true; }
    return false;
  };
  // Le client repris : un compte (id), ou seulement un nom + numéro (brouillon
  // d'un client sans compte encore). Réappliqué à chaque nouvelle reprise —
  // avant, chaque volet le refaisait dans son propre effet.
  const clientRepris = clientDeLaReprise;
  // 29/09/2026 : le prénom et l'entreprise cliente suivent le client repris
  // (le devis, sinon le brouillon) — l'entreprise vaut aussi pour un compte.
  const nouvClientRepris = (r) => {
    const entreprise = formulaireDepuisEntreprise(r?.devis?.entreprise || r?.client?.entreprise);
    if (r?.client && !r.client.id) return { nom: r.client.nom || "", prenom: r.client.prenom || r?.devis?.prenom || "", tel: r.client.tel || "", entreprise };
    // Un brouillon SANS compte revient avec son nom dans « Nouveau client ».
    return { ...CLIENT_VIDE(), nom: nomRepris(r), entreprise };
  };
  const [clientDevis, setClientDevis] = useState(() => clientRepris(devisAReprendre));
  const [nouvClient, setNouvClient] = useState(() => nouvClientRepris(devisAReprendre));
  useEffect(() => {
    if (!devisAReprendre) return;
    setClientDevis(clientRepris(devisAReprendre));
    setNouvClient(nouvClientRepris(devisAReprendre));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisAReprendre]);
  // Un brouillon repris n'est PAS un devis déjà dans la fiche du client : à
  // l'envoi on l'AJOUTE (idAReprendre vide), et on retire le brouillon.
  const brouillonRepris = devisAReprendre?.brouillon_id || null;
  const idAReprendre = brouillonRepris ? undefined : devisAReprendre?.devis?.id;
  // ⚠ Cloisonnement : on ne propose que les clients de SON espace. Sans ce
  // filtre, un compte de formation adressait ses devis d'essai à de VRAIS
  // clients. La BOUTIQUE de travail décide, pas le compte : l'administrateur
  // qui établit un devis depuis une boutique de formation doit se voir
  // proposer les clients de formation, et eux seuls.
  const espaceDevis = boutique ? estBoutiqueFormation(db, boutique) : espaceDuCompte(db, profile);
  const comptesClients = db.users.filter((u) => u.role === "client" && u.actif !== false
    && (espaceDevis === undefined || !!u.formation === espaceDevis));

  // 👥 LE DEVIS ÉTABLI POUR UN AUTRE (Timo, 12/10/2026, « C a ») :
  // l'administrateur et le responsable commercial choisissent « Devis établi
  // pour » ; le devis part au nom de cette personne (commission, relances,
  // conversation du client), avec « préparé par ». Les personnes viennent de
  // l'espace REGARDÉ (utilisateursDeLEspace), jamais db.users.
  // Une CORRECTION (le devis est déjà chez le client) garde toujours son
  // auteur : la ligne ne se choisit pas, elle le dit.
  const auteurs = auteursPossibles(utilisateursDeLEspace(db, profile), profile, ONGLETS_ROLE);
  const devisStocke = idAReprendre
    ? ((db.users || []).find((u) => u.id === devisAReprendre?.client?.id)?.devis || []).find((x) => x.id === idAReprendre) || null
    : null;
  const [auteurId, setAuteurId] = useState("");
  // 📝 Le brouillon d'un AUTRE repris (« A a, B b, C a », 12/10/2026) : il
  // reste le sien. Le devis part à son nom, le brouillon ré-enregistré
  // retourne dans SES brouillons, et c'est de SA liste qu'il disparaît.
  const idProprio = brouillonRepris ? (devisAReprendre?.brouillon_auteur?.id || profile.id) : profile.id;
  const proprioBrouillon = idProprio !== profile.id
    ? utilisateursDeLEspace(db, profile).find((u) => u.id === idProprio && u.role !== "client") || null
    : null;
  const auteurChoisi = devisStocke ? null : proprioBrouillon || auteurs.find((u) => u.id === auteurId) || null;
  const etabliPour = peutEtablirPourAutrui(profile)
    ? { auteurs, auteurId, setAuteurId, moi: profile,
        fixe: devisStocke ? auteurDuDevis(devisStocke)
          : proprioBrouillon ? { par: proprioBrouillon.nom, par_id: proprioBrouillon.id, par_role: proprioBrouillon.role, brouillon: true } : null }
    : null;
  // Revérifié DANS le geste : la personne doit être encore dans la liste.
  const refusAuteur = (geste = "envoyer") => {
    if (idProprio !== profile.id) {
      const refus = !proprioBrouillon ? "Ce brouillon n'est plus accessible : son auteur n'est plus dans cet espace."
        : critiqueBrouillonAutrui(idProprio, auteursDesBrouillons(utilisateursDeLEspace(db, profile), profile, ONGLETS_ROLE), profile, geste);
      if (refus) { uAlert(refus); return true; }
      return false;
    }
    if (devisStocke || !auteurId) return false;
    const refus = critiqueAuteur(auteurId, auteurs, profile);
    if (refus) { uAlert(refus); return true; }
    return false;
  };

  const envoyer = async ({ totalDevis, messageVide, construire, ligneEntete }) => {
    if (bloquerSiLecture(db, profile)) return;
    if (totalDevis <= 0) { uAlert(messageVide); return; }
    if (refusApporteur()) return;
    if (refusAuteur()) return;
    const resolu = await resoudreClientDevis(db, clientDevis, nouvClient, profile, boutique);
    if (!resolu) return;
    const { compte, motDePasse, dbApres, identite } = resolu;
    // 📨 Un brouillon confié garde « préparé par » ; il part au nom de celui
    // qui l'envoie (décision Timo, 05/10/2026 : « celui qui envoie »).
    const prepare = brouillonRepris ? devisAReprendre?.devis?.prepare_par : null;
    const devis = devisEtabliPour({ ...construire(), ...identite, ...(prepare ? { prepare_par: prepare } : {}) }, auteurChoisi, profile);
    // ✏️ Le brouillon d'une CORRECTION remplace le devis qu'il corrige (12/10/2026)
    // — s'il est encore modifiable chez ce client ; sinon il part comme un nouveau.
    let idRemplace = idAReprendre;
    if (brouillonRepris && devisAReprendre?.brouillon_remplace) {
      const compteFrais = (dbApres.users || []).find((u) => u.id === compte.id);
      const ancien = devisRemplace(devisAReprendre.brouillon_remplace, compteFrais);
      if (ancien) idRemplace = ancien.id;
      else if (!await uConfirm(`Ce brouillon corrigeait un devis${devisAReprendre.brouillon_remplace.date ? ` du ${dFR(devisAReprendre.brouillon_remplace.date)}` : ""} qui ne peut plus être remplacé (validé, payé ou supprimé entre-temps, ou un autre client a été choisi).\n\nIl partira comme un NOUVEAU devis. Continuer ?`)) return;
    }
    // ⚠ Le refus (signature manquante) était IGNORÉ : l'application
    // annonçait « ✅ Devis envoyé » et effaçait le brouillon alors que rien
    // n'était parti. On respecte la réponse.
    // « C a » : l'auteur d'un brouillon envoyé à sa place est prévenu.
    let dbEnvoi = brouillonRepris ? retirerBrouillon(dbApres, idProprio, brouillonRepris) : dbApres;
    if (proprioBrouillon) {
      const avis = avisBrouillonEnvoye(profile, proprioBrouillon, compte.nom, devis.total);
      dbEnvoi = { ...dbEnvoi, messages: [...(dbEnvoi.messages || []), avis] };
    }
    const envoye = await envoyerDevisEtOuvrirWhatsApp({
      dbApres: dbEnvoi,
      compte, motDePasse, devis, save, profile, nouvClient, ligneEntete, idAReprendre: idRemplace,
    });
    if (!envoye) return;
    // 🧲 Un devis préparé depuis la fiche d'un prospect (24/09/2026) : la
    // fiche garde le compte et le devis — SANS être marquée client, il n'a
    // pas encore dit oui (c'est « Convertir » ou l'encaissement qui le fait).
    // `save` reçoit une FONCTION de l'état courant : l'envoi vient d'écrire.
    if (devisAReprendre?.prospect_id) {
      const pid = devisAReprendre.prospect_id;
      save((etat) => ({ ...etat, prospects: (etat.prospects || []).map((x) => (x.id === pid ? prospectAvecDevis(x, { client_user_id: compte.id, devis_id: devis.id }) : x)) }));
    }
    setClientDevis("");
    setNouvClient(CLIENT_VIDE());
    setAuteurId("");
    if (devisAReprendre && onDevisRepriseConsomme) onDevisRepriseConsomme();
    effacerBrouillonVolet(volet, profile);
    { const m = messageDevisEnvoye(compte.nom, envoye.auto); if (envoye.auto && m) uAlert(m); }
  };

  const convertir = (panier, pctRemise) => {
    if (panier.length === 0) { uAlert("Aucun équipement sélectionné à convertir."); return; }
    // 📋 Un élément cf. visite n'a pas de prix : convertir le ferait
    // disparaître en silence. On complète d'abord (envoyer le devis, puis
    // ✍️ Compléter le devis après la visite).
    if (aCompleter) { uAlert("📋 Ce devis porte des éléments à compléter après la visite (cf. visite) : il ne se convertit pas en vente tant qu'ils ne sont pas chiffrés.\n\nEnvoyez le devis au client, puis complétez-le après la visite (📋 Tous les devis → ✍️ Compléter le devis)."); return; }
    if (refusApporteur()) return;
    if (refusAuteur("convertir")) return;
    effacerBrouillonVolet(volet, profile);
    if (brouillonRepris) save(retirerBrouillon(db, profile.id, brouillonRepris), `📝 Brouillon de devis converti en vente par ${profile.nom}`);
    // L'apporteur suit le panier jusqu'à l'encaissement, avec son pourcentage.
    onConvertirEnVente(boutique, panier, Number(pctRemise || 0), apporteurDuFormulaire(r && r.apporteur));
  };

  // 📝 Enregistrer un brouillon (demande Timo, 08/09/2026) : le devis tel
  // qu'il est, avec le client choisi — compte existant, ou nom + numéro
  // (aucun compte créé, aucun WhatsApp). Rangé dans MA fiche.
  const enregistrerBrouillon = async ({ totalDevis, messageVide, construire }) => {
    if (bloquerSiLecture(db, profile)) return;
    if (totalDevis <= 0) { uAlert(messageVide); return; }
    if (refusApporteur()) return;
    if (refusAuteur()) return;
    let client = null, nomBrouillon = "";
    // 05/10/2026 (Timo) : un brouillon s'enregistre TOUJOURS. Sans client
    // choisi (rien de sélectionné, ou « Nouveau client » laissé vide), on
    // demande « Continuer ? » puis un NOM obligatoire.
    const nouveauVide = clientDevis === "__nouveau__" && !nouvClient.nom.trim() && !nouvClient.tel.trim();
    // Un nom sans numéro (le brouillon repris, pas encore complété) reste un
    // brouillon sans compte, sous ce nom — jamais un refus.
    const nomSansNumero = clientDevis === "__nouveau__" && !!nouvClient.nom.trim() && !nouvClient.tel.trim();
    if (!clientDevis || nouveauVide || nomSansNumero) {
      if (!await uConfirm("Brouillon sans compte client. Continuer ?\n\nTapez seulement le nom du client : son compte se choisit ou se crée en reprenant le brouillon, avant de l'envoyer.")) return;
      const nom = await uPrompt("Nom du client (obligatoire) :", nouvClient.nom.trim() || devisAReprendre?.brouillon_nom || "");
      if (nom === null) return;
      const refus = critiqueNomBrouillon(nom);
      if (refus) { uAlert(refus); return; }
      nomBrouillon = String(nom).trim();
    } else if (clientDevis === "__nouveau__") {
      const nom = nouvClient.nom.trim(), tel = nouvClient.tel.trim();
      if (!nom || chiffresTel(tel).length < 4) { uAlert("Indiquez le nom et le numéro du client."); return; }
      client = { nom, tel, ...champsIdentite({ prenom: nouvClient.prenom }) };
    } else {
      const compte = comptesClients.find((u) => u.id === clientDevis);
      if (!compte) { uAlert("Choisissez d'abord le client."); return; }
      client = { id: compte.id, nom: compte.nom_base || compte.nom, tel: compte.tel || "" };
    }
    if (client) { const refus = critiqueEntreprise(nouvClient.entreprise); if (refus) { uAlert(refus); return; } }
    // « Préparé par » suit un brouillon confié, même enregistré à nouveau.
    const prepare = devisAReprendre?.brouillon_id ? devisAReprendre?.devis?.prepare_par : null;
    const devis = { ...construire(), ...(client ? champsIdentite({ prenom: client.prenom, entreprise: nouvClient.entreprise }) : {}), ...(prepare ? { prepare_par: prepare } : {}) };
    // 👥 Enregistrer POUR LUI (12/10/2026) : le brouillon va dans les brouillons
    // de l'auteur — celui choisi dans « Devis établi pour », ou l'auteur du
    // devis qu'on corrige — et c'est lui qui l'enverra (la commission est la
    // sienne). Il porte « préparé par » et « confié par », et il est prévenu.
    const auteurFixe = devisStocke && devisStocke.par_id && devisStocke.par_id !== profile.id
      ? utilisateursDeLEspace(db, profile).find((u) => u.id === devisStocke.par_id && u.role !== "client" && u.actif !== false) || null
      : null;
    const pourQui = auteurFixe || auteurChoisi;
    // ✏️ Le brouillon d'une correction se souvient du devis qu'il corrige.
    const remplace = devisStocke ? remplacePour(devisStocke, devisAReprendre?.client?.id) : (brouillonRepris ? devisAReprendre?.brouillon_remplace || null : null);
    const dejaConfie = devisAReprendre?.brouillon_id ? devisAReprendre?.brouillon_confie : null;
    const confie = pourQui ? { par: profile.nom, par_id: profile.id, le: today() } : dejaConfie;
    const devisB = pourQui ? { ...devis, prepare_par: devis.prepare_par || profile.nom } : devis;
    const brouillon = { id: brouillonRepris || uid(), volet, client, ...(nomBrouillon ? { nom: nomBrouillon } : {}), ...(confie ? { confie } : {}), ...(remplace ? { remplace } : {}), devis: devisB, date: today(), ts: maintenantISO() };
    const titre = nomDuBrouillon(brouillon);
    if (pourQui) {
      // Déplacé, jamais copié : retiré de mes brouillons s'il en venait.
      const base = brouillonRepris ? retirerBrouillon(db, idProprio, brouillonRepris) : db;
      // Son propre brouillon, repris et corrigé : il le retrouve à sa place.
      const dejaLeSien = !!proprioBrouillon && proprioBrouillon.id === pourQui.id;
      const avis = nouveauMessage(profile, { a_id: pourQui.id,
        texte: `📝 ${profile.nom} a ${dejaLeSien ? "modifié votre" : "préparé pour vous un"} brouillon de devis : « ${titre} » (${fmt(devis.total)})${remplace ? " — la correction de votre devis déjà envoyé" : ""}. Retrouvez-le dans 📐 Dimensionnement → 📝 Mes brouillons pour le vérifier et l'envoyer : il partira à votre nom.` });
      const dbB = ajouterBrouillon(base, pourQui.id, brouillon);
      save({ ...dbB, messages: [...(dbB.messages || []), avis] }, `📝 Brouillon de devis enregistré pour ${pourQui.nom} — ${titre}${client ? "" : " (sans compte)"} (${fmt(devis.total)}) par ${profile.nom}`);
      effacerBrouillonVolet(volet, profile);
      if (devisAReprendre && onDevisRepriseConsomme) onDevisRepriseConsomme();
      uAlert(`📝 Brouillon enregistré dans les brouillons de ${pourQui.nom}${client ? `, pour ${client.nom}` : ` — « ${titre} », sans compte`}.\n\n${pourQui.nom} est prévenu : c'est lui qui l'enverra, à son nom${remplace ? " — il remplacera le devis déjà envoyé" : ""}.`);
      return;
    }
    save(ajouterBrouillon(db, profile.id, brouillon), `📝 Brouillon de devis enregistré — ${titre}${client ? "" : " (sans compte)"} (${fmt(devis.total)}) par ${profile.nom}`);
    uAlert(`📝 Brouillon enregistré${client ? ` pour ${client.nom}` : ` pour ${titre} — sans compte`}.\n\nVous le retrouverez dans l'onglet « Mes brouillons » : reprendre, envoyer par WhatsApp, confier à un collègue, ou supprimer.`);
  };

  return { clientDevis, setClientDevis, nouvClient, setNouvClient, comptesClients, envoyer, convertir, enregistrerBrouillon, etabliPour };
}

// ---- Conditions de paiement — % d'acompte et délai d'installation propres
// à CHAQUE devis (demande Timo : "pourcentage acompte par devis, pour
// certains devis on exige un paiement à 100%"). Par défaut 100% (paiement
// comptant), l'initiateur ajuste au cas par cas. Le délai d'installation
// "varie d'un chantier à l'autre" — texte libre plutôt qu'un nombre fixe,
// pour couvrir "15 jours ouvrés", "sous 3 semaines selon disponibilité du
// matériel", etc. Réutilisé par le contrat d'installation généré à la
// validation du devis.
export function useConditionsPaiement() {
  const [pctAcompte, setPctAcompte] = useState("100");
  const [delaiInstallation, setDelaiInstallation] = useState("");
  return { pctAcompte, setPctAcompte, delaiInstallation, setDelaiInstallation };
}

export function BlocConditionsPaiement({ pctAcompte, setPctAcompte, delaiInstallation, setDelaiInstallation, montantAcompte, totalDevis, aCompleter = false }) {
  return (
    <div className="px-4 py-3 border-t border-slate-200 bg-amber-50 flex flex-wrap gap-4 items-end">
      {/* Décision « B » (08/10/2026) : pas d'acompte tant que le devis porte
          des éléments cf. visite. Le pourcentage s'appliquera au devis complété. */}
      {aCompleter && (
        <div className="w-full text-xs font-semibold text-amber-900" data-acompte-cf-visite>
          📋 Ce devis porte des éléments à compléter après la visite : aucun acompte n'est demandé tant qu'il n'est pas complété. Le pourcentage ci-dessous s'appliquera au devis complété.
        </div>
      )}
      <Field label="💰 Acompte exigé pour démarrer (%)">
        <div className="flex items-center gap-2">
          <input type="number" min="1" max="100" step="5" value={pctAcompte} onChange={(e) => setPctAcompte(e.target.value)} className="w-20 rounded border border-slate-300 px-2 py-1 text-right" />
          <span className="text-sm text-slate-600">% = <b>{fmt(montantAcompte)}</b>{Number(pctAcompte) < 100 ? ` (solde : ${fmt(totalDevis - montantAcompte)})` : ""}</span>
        </div>
      </Field>
      <Field label="🗓 Délai d'installation indicatif">
        <input type="text" value={delaiInstallation} onChange={(e) => setDelaiInstallation(e.target.value)} placeholder="Ex : 15 jours ouvrés à compter de la signature" className="rounded border border-slate-300 px-2 py-1 text-sm w-72" />
      </Field>
    </div>
  );
}

// ---- Bloc « Envoyer le devis au client » : sélection/création du compte + bouton WhatsApp ----
// 👥 « Devis établi pour » (Timo, 12/10/2026, « C a ») : l'administrateur et le
// responsable commercial seulement (`etabliPour` vaut null pour les autres).
// « Moi » d'office ; une autre personne → le devis part à son nom, la
// commission est la sienne. Une correction ne se choisit pas : elle le dit.
const libelleAuteur = (u) => `${u.nom} — ${LIBELLE_ROLE_EMPLOYE[u.role] || u.role}${u.boutique && u.boutique !== "Toutes" ? ` · ${u.boutique}` : ""}`;
export function BlocEtabliPour({ etabliPour }) {
  if (!etabliPour) return null;
  const { auteurs, auteurId, setAuteurId, fixe, moi } = etabliPour;
  if (fixe) {
    if (!fixe.par_id || fixe.par_id === moi.id) return null;
    if (fixe.brouillon) return (
      <div className="mb-3 rounded-lg border border-sky-300 bg-sky-50 p-2 text-sm text-sky-900" data-brouillon-de-autre>
        📝 Brouillon de <b>{fixe.par}</b> : envoyé, il part à son nom — la commission est la sienne, avec « préparé par ». « 📝 Enregistrer un brouillon » le remet dans SES brouillons ; {fixe.par} est prévenu dans les deux cas.
      </div>
    );
    return (
      <div className="mb-3 rounded-lg border border-sky-300 bg-sky-50 p-2 text-sm text-sky-900" data-devis-auteur-fixe>
        👤 Devis de <b>{fixe.par}</b> : la correction reste à son nom — la commission est la sienne. « Modifié par {moi.nom} » sera noté sur le devis.
      </div>
    );
  }
  const choisi = auteurs.find((u) => u.id === auteurId) || null;
  return (
    <div className="mb-3" data-devis-etabli-pour>
      <Field label="👥 Devis établi pour">
        <select className={`${inputCls} sm:w-80`} value={choisi ? auteurId : ""} onChange={(e) => setAuteurId(e.target.value)}>
          <option value="">Moi ({moi.nom})</option>
          {auteurs.map((u) => <option key={u.id} value={u.id}>{libelleAuteur(u)}</option>)}
        </select>
      </Field>
      {choisi && (
        <div className="mt-1 text-xs text-sky-900" data-devis-pour-autre>
          Le devis part au nom de <b>{choisi.nom}</b> : la commission, les relances et les réponses du client sont pour lui, avec « préparé par {moi.nom} ». « 📝 Enregistrer un brouillon » le range dans SES brouillons : c'est lui qui l'enverra.
        </div>
      )}
      {auteurs.length === 0 && (
        <div className="mt-1 text-xs text-slate-500">{moi.role === "admin" ? "Personne d'autre dans cet espace n'a l'onglet Dimensionnement." : "Aucun commercial n'est sous votre responsabilité (👥 Utilisateurs → ⋯ Gérer → Parrain)."}</div>
      )}
    </div>
  );
}

export function BlocEnvoiDevisClient({ db, clientDevis, setClientDevis, nouvClient, setNouvClient, comptesClients, onEnvoyer, onBrouillon, profile, etabliPour = null }) {
  // ⚠ La signature était exigée tout à la FIN, après avoir tout rempli et
  // cliqué (relevé par Timo, 18/08/2026). On prévient maintenant AVANT.
  const sansSignature = profile && !profile.signature_personnelle;
  // 📁 Les clients ARCHIVÉS (sans suite, 30/09/2026) ne sont plus proposés.
  // Taper son numéro dans « ➕ Nouveau client » retrouve quand même son
  // compte (aucun doublon), et le nouveau devis le fait sortir de l'archive.
  // Un devis repris d'un client archivé garde son client choisi.
  const archives = idsClientsArchives(db, profile);
  const proposes = comptesClients.filter((u) => !archives.has(u.id) || u.id === clientDevis);
  const suggestionsClients = propositionsComptesDevis(proposes);
  const compteChoisi = clientDevis && clientDevis !== "__nouveau__" ? comptesClients.find((u) => u.id === clientDevis) : null;
  // Ce qui est TAPÉ dans la case ; un compte choisi (clic, devis repris,
  // brouillon) y écrit son nom et son numéro.
  const [saisieClient, setSaisieClient] = useState(compteChoisi ? libelleCompteDevis(compteChoisi) : "");
  useEffect(() => {
    if (compteChoisi) setSaisieClient(libelleCompteDevis(compteChoisi));
    else if (!clientDevis) setSaisieClient((t) => (comptesClients.some((u) => libelleCompteDevis(u) === t) ? "" : t));
  }, [clientDevis]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="rounded-xl p-4 bg-white border-2 border-emerald-300">
      <div className="font-bold text-emerald-900 mb-1">📲 Envoyer ce devis au client</div>
      {sansSignature && (
        <div className="mb-3 rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <b>✍️ Votre signature manque.</b> Aucun devis ne peut partir tant qu'elle n'est pas enregistrée.
          Rendez-vous dans l'onglet <b>📄 Contrats</b> — c'est à faire une seule fois, elle servira ensuite
          à tous vos devis et contrats.
        </div>
      )}
      <BlocEtabliPour etabliPour={etabliPour} />
      <div className="text-xs text-slate-500 mb-3">
        Le devis est déposé dans son espace client, et il en est prévenu par WhatsApp — du numéro BMI (s'il n'a pas encore reçu ses accès, ils partent d'abord, dans un message à part). Si le numéro BMI ne peut pas envoyer, WhatsApp s'ouvre sur votre téléphone avec ses identifiants. S'il n'a pas encore de compte, il est créé automatiquement : le nom, le prénom et le numéro suffisent.
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
        {/* 🔍 Timo (12/10/2026) : les clients se cherchent comme dans 💰 Ventes —
            en tapant le nom OU le numéro, la liste s'ouvre sous la case. Seul
            un CLIC choisit un compte ; « ➕ Nouveau client » reste à côté. */}
        <Field label="Client destinataire">
          {clientDevis === "__nouveau__" ? (
            <div className={`${inputCls} flex items-center justify-between gap-2 bg-emerald-50`} data-client-nouveau>
              <span className="font-semibold text-emerald-900">➕ Nouveau client</span>
              <button type="button" onClick={() => { setClientDevis(""); setSaisieClient(""); }} className="text-xs text-sky-700 underline">Choisir un client existant</button>
            </div>
          ) : (
            <div data-recherche-client-devis>
              <ChampSuggestions valeur={saisieClient} suggestions={suggestionsClients}
                placeholder="Nom, ou numéro du client"
                onChange={(t) => { setSaisieClient(t); if (clientDevis && t !== libelleCompteDevis(compteChoisi)) setClientDevis(""); }}
                onChoisir={(sug) => {
                  setClientDevis(sug.id);
                  // L'entreprise de sa fiche revient d'office (B « b »).
                  const c = comptesClients.find((u) => u.id === sug.id);
                  setNouvClient({ ...nouvClient, entreprise: formulaireDepuisEntreprise(c && c.entreprise) });
                }} />
            </div>
          )}
        </Field>
        {clientDevis !== "__nouveau__" && (
          <div className="pb-1">
            <button type="button" onClick={() => { setClientDevis("__nouveau__"); setSaisieClient(""); setNouvClient({ ...nouvClient, entreprise: formulaireDepuisEntreprise(null) }); }}
              data-bouton-nouveau-client className="px-3 py-2 rounded-lg border border-emerald-400 text-emerald-800 text-sm font-semibold bg-white hover:bg-emerald-50">
              ➕ Nouveau client
            </button>
          </div>
        )}
        {clientDevis === "__nouveau__" && (
          <>
            <Field label="Nom du client">
              <input className={inputCls} placeholder="KOFFI" value={nouvClient.nom} onChange={(e) => setNouvClient({ ...nouvClient, nom: e.target.value })} />
            </Field>
            <Field label="Prénom">
              <input className={inputCls} placeholder="Ama" value={nouvClient.prenom || ""} onChange={(e) => setNouvClient({ ...nouvClient, prenom: e.target.value })} data-prenom-client />
            </Field>
            <Field label="Numéro WhatsApp">
              <input type="tel" className={inputCls} placeholder="+228 90 55 44 33" value={nouvClient.tel} onChange={(e) => setNouvClient({ ...nouvClient, tel: e.target.value })} />
            </Field>
          </>
        )}
      </div>

      {clientDevis && (
        <div className="mt-2">
          <ChampsEntreprise valeur={nouvClient.entreprise} onChange={(e) => setNouvClient({ ...nouvClient, entreprise: e })} libelle="🏢 Entreprise cliente"
            aide="La personne choisie au-dessus est son répondant : c'est à son numéro que partent le devis et les accès à l'espace client. Le contrat nommera l'entreprise et son répondant." />
        </div>
      )}

      {clientDevis === "__nouveau__" && nouvClient.nom && chiffresTel(nouvClient.tel).length >= 4 && (
        <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs">
          Compte qui sera créé — identifiant : <b>{identifiantClient(db, nouvClient.nom, nouvClient.tel)}</b> · mot de passe : <b>{motDePasseClient(nouvClient.nom, nouvClient.tel)}</b>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onEnvoyer} disabled={!clientDevis} className={`px-5 py-2 rounded-lg font-bold text-sm ${clientDevis ? "bg-green-600 text-white hover:bg-green-700" : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}>
          📲 Envoyer par WhatsApp
        </button>
        {/* 📝 Brouillon (demande Timo, 08/09/2026) : rien ne part. Depuis le
            05/10/2026, TOUJOURS possible — sans client, une question et un nom. */}
        {onBrouillon && (
          <button onClick={onBrouillon} data-brouillon-toujours className="px-5 py-2 rounded-lg font-bold text-sm bg-amber-500 text-white hover:bg-amber-600">
            📝 Enregistrer un brouillon
          </button>
        )}
      </div>
    </div>
  );
}

// ⚠ Marque la fiche prospect de ce client avec son compte (client_user_id),
// si elle ne l'est pas déjà. C'est l'EMPLOYÉ qui envoie le devis qui pose la
// marque — lui a le droit d'écrire les fiches prospect. Sans elle, le client
// ne peut plus recevoir son badge « devis validé » : depuis la fermeture de
// l'annuaire, le serveur refuse qu'un client touche une fiche sans son
// étiquette, et ce refus bloquait TOUTE sa validation (vécu par Timo avec le
// compte ESSO, 31/08/2026). Une fiche déjà marquée pour un AUTRE compte
// n'est jamais réécrite.
function marquerProspectsDuCompte(base, compteId, telRef) {
  const chiffres = chiffresTel(telRef || "");
  if (chiffres.length < 6) return base;
  let change = false;
  const prospects = (base.prospects || []).map((pr) => {
    if (pr.client_user_id || pr.converti) return pr;
    if (!memeNumero(pr.tel, telRef)) return pr;
    change = true;
    return { ...pr, client_user_id: compteId };
  });
  return change ? { ...base, prospects } : base;
}

// Résout le compte client destinataire : crée un compte à la volée (nom + tel) ou
// récupère un compte existant. Retourne null (une alerte a déjà été affichée) en
// cas de saisie invalide, sinon { compte, motDePasse, dbApres }.
export async function resoudreClientDevis(db, clientDevis, nouvClient, profile, boutique) {
  // 🏢 29/09/2026 (Timo) : « en bas de la ligne client destinataire, une case
  // à cocher entreprise cliente… la personne mentionnée est le répondant,
  // c'est à son numéro que les infos de l'espace client sont envoyées ».
  // Le compte reste celui de la PERSONNE ; l'entreprise se range sur le devis
  // et sur sa fiche (B « b »). Un nom sans case cochée est refusé ICI, pour
  // tous les chemins (volet, Mes brouillons).
  const refusEnt = critiqueEntreprise(nouvClient.entreprise);
  if (refusEnt) { uAlert(refusEnt); return null; }
  const avecIdentite = (base, compte, prenom) => {
    const identite = champsIdentite({ prenom, entreprise: nouvClient.entreprise });
    const fiche = ficheAvecIdentite(compte, identite);
    return {
      identite,
      compte: fiche,
      dbApres: fiche === compte ? base : { ...base, users: base.users.map((u) => (u.id === compte.id ? fiche : u)) },
    };
  };
  if (clientDevis === "__nouveau__") {
    const nom = nouvClient.nom.trim();
    const tel = nouvClient.tel.trim();
    if (!nom || chiffresTel(tel).length < 4) {
      uAlert("Pour créer le compte, il faut le nom du client et son numéro (au moins 4 chiffres).");
      return null;
    }
    // C « a » : le prénom est obligatoire pour un compte client. Un ancien
    // brouillon n'en a pas : on le DEMANDE au lieu de refuser.
    let prenom = nettoyerPrenom(nouvClient.prenom);
    if (!prenom) {
      const saisi = await uPrompt(`Prénom de ${nom.toUpperCase()} ?\n\nIl est demandé pour son compte client.`, "");
      if (saisi === null) return null;
      prenom = nettoyerPrenom(saisi);
      const refusPrenom = critiquePrenom(prenom);
      if (refusPrenom) { uAlert(refusPrenom); return null; }
    }
    // ⚠ Bug réel trouvé (compte VIVA, capture Timo) : rien n'empêchait de
    // créer DEUX FOIS le même client (double-clic, ou nouvel essai après
    // une coupure réseau pendant le premier) — chaque création génère un
    // sel/hachage ALÉATOIRE différent, même pour le même mot de passe
    // affiché ; un mélange entre les deux tentatives lors de la
    // synchronisation laisse un compte dont le mot de passe recalculé
    // (affiché à l'admin) ne correspond plus au verrou réellement stocké.
    // On réutilise maintenant le compte EXISTANT s'il porte déjà ce numéro,
    // au lieu d'en fabriquer un nouveau à côté.
    // ⚠ DÉFAUT TROUVÉ EN AUDIT (29/08/2026) : la comparaison se faisait sur les
    // chiffres BRUTS. Le commentaire juste au-dessus décrit pourtant le défaut
    // « compte VIVA » comme corrigé — il ne l'était qu'à moitié. Un numéro tapé
    // avec l'indicatif (« +228 90 11 22 33 ») ne retrouvait pas le compte
    // enregistré « 90112233 », et un SECOND compte client était créé. Un
    // doublon, c'est aussi une seconde prime de parrainage.
    // memeNumero compare les 8 DERNIERS chiffres — la règle posée par Timo.
    const existant = (db.users || []).find((u) => u.role === "client" && u.tel && memeNumero(u.tel, tel));
    if (existant) {
      const r = avecIdentite(db, existant, prenom);
      return {
        compte: r.compte, identite: r.identite, motDePasse: existant.mdp_auto ? motDePasseConnu(existant) : null,
        dbApres: marquerProspectsDuCompte(r.dbApres, existant.id, existant.tel || tel),
      };
    }
    // Le compte client hérite de l'espace de celui qui le crée (voir
    // marqueEspace) : un « client » inventé pendant un entraînement ne doit
    // pas se retrouver mêlé aux vrais dans les listes ni dans les relances.
    const fab = await fabriquerCompteClient(db, nom, tel, profile.nom, { ...marqueEspace(db, profile, boutique), ...champsCompteClient(nom, prenom, nouvClient.entreprise) });
    return {
      compte: fab.user, motDePasse: fab.motDePasse, identite: champsIdentite({ prenom, entreprise: nouvClient.entreprise }),
      dbApres: marquerProspectsDuCompte(
        { ...db, users: [...db.users, fab.user], messages: [...messagesNouveauClient(db, fab.user, profile), ...(db.messages || [])] },
        fab.user.id, tel),
    };
  }
  const compte = db.users.find((u) => u.id === clientDevis);
  if (!compte) { uAlert("Choisissez le client à qui envoyer ce devis."); return null; }
  const r = avecIdentite(db, compte, compte.prenom);
  return { compte: r.compte, identite: r.identite, motDePasse: motDePasseConnu(compte), dbApres: marquerProspectsDuCompte(r.dbApres, compte.id, compte.tel) };
}

// Enregistre le devis dans la fiche du client puis ouvre WhatsApp avec ses
// identifiants et le lien vers son espace. `ligneEntete` = les 1-2 lignes
// spécifiques à l'outil (type d'installation + montant), le reste du message
// (identifiants, lien, signature) est commun aux 3 outils.
export async function envoyerDevisEtOuvrirWhatsApp({ dbApres, compte, motDePasse, devis, save, profile, nouvClient, ligneEntete, idAReprendre }) {
  // Signature personnelle exigée AVANT tout envoi de devis (demande Timo) —
  // elle sera réutilisée automatiquement sur tous les contrats futurs de
  // cette personne, plutôt que d'être redemandée à chaque fois. Un seul
  // point de contrôle ici, puisque cette fonction est déjà partagée par
  // les 3 volets du dimensionnement (Solaire/Garage/Autre).
  // ⚠ Décision Timo (04/09/2026) : au-delà de 3 % de remise, l'administrateur
  // seul. Vérifié ici (les trois volets passent par cette fonction) — et le
  // serveur appliquera la même règle (vague 3, étape 2).
  if (remiseExigeAdmin(devis?.pct_remise) && profile.role !== "admin") {
    uAlert(`🔒 Une remise supérieure à ${PLAFOND_REMISE_PCT} % est réservée à l'administrateur. Ramenez la remise à ${PLAFOND_REMISE_PCT} % au plus, ou faites établir ce devis par l'administrateur.`);
    return false;
  }
  if (!profile.signature_personnelle) {
    uAlert("Avant d'envoyer un devis, vous devez d'abord enregistrer votre signature — rendez-vous dans l'onglet « 📄 Contrats » pour le faire, une seule fois.");
    return false;
  }
  // 👥 Le devis porte le nom de son AUTEUR (12/10/2026) : une correction garde
  // celui du devis d'origine, un devis « établi pour » celui de la personne
  // choisie. C'est SA signature qui va sur le devis et le contrat : sans elle,
  // le cadre « Pour BMI Togo » resterait vide.
  const avantDevis = idAReprendre ? (dbApres.users || []).find((u) => u.id === compte.id)?.devis?.find((x) => x.id === idAReprendre) : null;
  const auteurFinal = avantDevis ? auteurDuDevis(avantDevis) : auteurDuDevis(devis);
  if (auteurFinal.par_id && auteurFinal.par_id !== profile.id) {
    const fiche = (dbApres.users || []).find((u) => u.id === auteurFinal.par_id);
    if (fiche && !fiche.signature_personnelle) {
      uAlert(`✍️ ${auteurFinal.par} n'a pas encore enregistré sa signature : le devis part à son nom et porte sa signature.\n\nIl l'enregistre une seule fois dans l'onglet « 📄 Contrats ». En attendant, enregistrez un brouillon pour lui.`);
      return false;
    }
  }
  // 📋 Décision « A a » (08/10/2026) : un devis DÉJÀ SIGNÉ que l'on corrige
  // (le client a ouvert la porte) repart pour être RE-SIGNÉ — il ne peut pas
  // porter d'élément cf. visite, le client signerait un total partiel.
  if (idAReprendre && devisACompleter(devis)) {
    const avant = (dbApres.users || []).find((u) => u.id === compte.id)?.devis?.find((x) => x.id === idAReprendre);
    if (avant && (avant.statut || "propose") !== "propose") {
      uAlert("📋 Ce devis a déjà été signé : il repart pour être signé à nouveau, il ne peut donc pas porter d'élément « cf. visite ». Chiffrez ces éléments avant de le renvoyer.");
      return false;
    }
  }
  // ⚠ Cloisonnement formation / réel : un devis est rangé dans la fiche du
  // CLIENT (users[].devis), pas dans une boutique — rien ne le rattachait
  // donc à un espace, et les devis d'entraînement apparaissaient dans
  // « Tous les devis » et « Contrats » des comptes réels. On y appose
  // l'espace de son auteur, à l'unique endroit par lequel passent les
  // trois volets du dimensionnement. Les devis antérieurs n'ont pas le
  // champ : ils sont traités comme réels, ce qui est le cas.
  // La boutique du devis fait foi : un devis établi depuis une boutique
  // de formation est un devis de formation, même envoyé par l'administrateur.
  const devisMarque = { ...devis, ...marqueEspace(dbApres, profile, devis.boutique) };
  // ⚠ Timo (11/09/2026) : « personne ne peut baisser un prix en silence après
  // que le client a vu le premier devis ». Une correction laisse sa TRACE sur
  // le devis — date, auteur, nombre de corrections (règle pure
  // marquerModification) — visible dans 📋 Tous les devis.
  const dbFinal = {
    ...dbApres,
    users: dbApres.users.map((u) => (u.id === compte.id
      ? { ...u, devis: idAReprendre
          ? u.devis.map((x) => (x.id === idAReprendre
              ? { ...marquerDevisCorrige(x, marquerModification(x, garderAuteur(x, devisMarque), profile, today()), today()), id: idAReprendre }
              : x))
          : [devisMarque, ...(u.devis || [])] }
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
  // 📲 19/09/2026 — LE DEVIS PEUT PARTIR DU NUMÉRO BMI, TOUT SEUL.
  //
  // ⚠⚠ JAMAIS AVANT SES ACCÈS : un client qui n'a pas ses codes recevrait
  // un lien vers un espace où il ne saurait pas entrer. Ses accès partent
  // donc d'abord, par `espace` (ci-dessous) ; s'ils ne peuvent pas partir,
  // WhatsApp s'ouvre comme avant et c'est le vendeur qui envoie le tout.
  //
  // ⚠ Si le navigateur bloque l'ouverture, on le DIT et on propose un
  // bouton : sans cela, le devis partait enregistré mais le client n'était
  // jamais prévenu, et personne ne le savait. Le repli garde ce texte-ci
  // mot pour mot.
  const idDevis = idAReprendre || devisMarque.id;
  const telClient = compte.tel || nouvClient.tel;
  const espaceFormation = !!espaceDeLaFiche(devisMarque);
  // 🔑📄 25/09/2026 (Timo, « lance ») — LE PREMIER DEVIS PART EN DEUX
  // MESSAGES DU NUMÉRO BMI. Meta refuse un modèle qui porte à la fois une
  // offre et des accès (`devis_premier`, refusé trois fois puis supprimé).
  // Donc : si ses accès ne lui sont jamais partis, `espace` D'ABORD, puis
  // le devis par `devis_disponible`. S'ils sont déjà partis (compte créé
  // avant, accès renvoyés), le devis part seul.
  // ⚠ Si `espace` ne part pas (formation, réseau, refus, mot de passe qu'on
  // ne sait pas recalculer), le devis ne part PAS du numéro BMI non plus :
  // il repart à la main avec ses codes (`premierContact`), sinon le client
  // recevrait un lien vers un espace où il ne saurait pas entrer.
  let accesPartis = accesDejaEnvoyes(compte, idDevis, dbApres.messages);
  let accesEnvoyes = null;
  let motifAcces = "";
  if (!accesPartis && motDePasse && compte.nom) {
    // 14/10/2026 : `espace_portail` d'abord, `espace` en relais (décision « a »).
    const rAcces = await envoyerAccesSansRepli({
      nomAffiche: compte.nom_base || compte.nom, identifiant: compte.nom, motDePasse,
      tel: telClient, espaceFormation,
    });
    if (rAcces.auto) { accesPartis = true; accesEnvoyes = rAcces; }
    else if (rAcces.motif && !motifAttendu(rAcces.motif)) motifAcces = rAcces.motif;
  }
  const envoi = envoiDevisDisponible({ devis: devisMarque, compte, fmt });
  const r = await envoyerModele({
    tel: telClient,
    modele: envoi.modele,
    variables: envoi.variables,
    espaceFormation,
    premierContact: !accesPartis,
    texteRepli: lignesMsg.join("\n"),
    demanderConfirmation: uConfirm,
    prevenir: uAlert,
    // Tout se dit AVANT l'ouverture (règle du 29/09/2026), en UNE fenêtre.
    annonceRepli: `${motifAcces ? `📲 Ses accès ne sont pas partis du numéro BMI.\n\n${motifAcces}\n\n` : ""}✅ Devis enregistré dans l'espace de ${compte.nom}.\n\nAppuyez sur OK : WhatsApp s'ouvre avec ses identifiants et le lien, à envoyer au client.`,
  });
  // ⚠ Un repli muet ressemble à une panne : on DIT pourquoi, sauf quand le
  // motif est attendu (formation, premier message qui porte les identifiants).
  // Le motif d'un repli est dit AVANT l'ouverture de WhatsApp (`prevenir`, 29/09/2026), jamais après.
  // Les accès partis du numéro BMI s'écrivent dans 📲 WhatsApp, masqués
  // (règle du 23/09 : le créateur et l'administrateur seuls les lisent).
  if (accesEnvoyes) {
    save((etat) => ({ ...etat, messages: messagesAvecLigneAcces(etat.messages, { profile, client: { ...compte, tel: telClient }, envoi: accesEnvoyes }) }));
  }
  // La trace se pose seulement si le message est VRAIMENT parti du numéro
  // BMI : une ouverture WhatsApp ne prouve rien (personne ne sait si le
  // vendeur a appuyé sur envoyer), et l'écrire serait rassurer à tort.
  // 📲 23/09/2026 : le devis parti du numéro BMI s'écrit AUSSI dans la
  // conversation du client (📲 WhatsApp), sinon elle ne remonte jamais
  // (Timo). Sur l'état COURANT — le devis vient d'être enregistré au-dessus.
  if (r.auto) {
    save((etat) => ({
      ...etat,
      users: etat.users.map((u) => (u.id === compte.id
        ? { ...u, devis: (u.devis || []).map((x) => (x.id === idDevis
            ? { ...x, envoi_whatsapp: traceEnvoi({ modele: envoi.modele, par: profile.nom, par_id: profile.id, quand: today(), heure: heureCourte(), id: r.id, pour: auteurFinal.par, pour_id: auteurFinal.par_id }) }
            : x)) }
        : u)),
      messages: r.auto ? messagesAvecLigneEnvoi(etat.messages, { profile, tel: telClient, nom: compte.nom_base || compte.nom, modele: envoi.modele, variables: envoi.variables, ref: { devis_id: idDevis }, envoi: r }) : etat.messages,
    }));
  }
  // ⚠ On rend CE QUI S'EST PASSÉ, pas seulement « c'est parti » : l'écran doit
  // pouvoir dire la vérité ensuite (WhatsApp s'est ouvert, ou le client a
  // reçu le message du numéro BMI). Un objet reste « vrai » pour les deux
  // appelants, qui testent simplement `if (envoye)`.
  return { ok: true, auto: !!r.auto };
}
