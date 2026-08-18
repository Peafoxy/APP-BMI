// ============================================================
// screens/dimensionnement/Partages.jsx — Blocs partagés par les trois volets : lecture des specs dans les
// noms d'articles, autres équipements, totaux du devis (remise,
// installation, transport), envoi du devis au client via WhatsApp.
// ============================================================
import { useState } from "react";
import { ADRESSE_APP, chiffresTel, identifiantClient, motDePasseClient, fabriquerCompteClient, messagesNouveauClient, motDePasseConnu } from "../../lib/comptesClients";
import { fmt, telDigits, col, ouvrirWhatsApp } from "../../lib/core";
import { Field, inputCls, uAlert, uConfirm } from "../../components/ui";
import { marqueEspace } from "../../lib/calculs";

// ⚠ VA ≠ WATTS (2.100.40, demande Timo) — la puissance utile d'un
// convertisseur annoncé en VA n'est pas son chiffre en VA : c'est ce chiffre
// multiplié par le facteur de puissance (0,8 en usage courant). L'application
// comparait pourtant les deux directement : un besoin de 5 000 W acceptait un
// convertisseur « 5000VA », qui ne délivre en réalité que 4 000 W — le client
// repartait sous-équipé d'environ 20 %.
//
// Le cas « kVA » est déjà couvert en amont : specDepuisNom() ramène kVA en VA
// (et kW en W) avant d'arriver ici, donc « 5KVA » vaut 5000 va, puis 4000 W.
// Peu importe donc que l'article soit écrit en VA ou en kVA.
export const FACTEUR_PUISSANCE_VA = 0.8;
export const puissanceUtileW = (spec) => {
  if (!spec) return 0;
  return spec.unite === "va" ? Math.round(spec.valeur * FACTEUR_PUISSANCE_VA) : spec.valeur;
};

// ⚠ QUANTITÉ NÉCESSAIRE (2.100.39) — la quantité proposée était plafonnée à
// 50 unités, EN SILENCE. Au-delà (grosse installation), le devis partait
// sous-dimensionné sans que personne ne soit prévenu.
// Le plafond servait en réalité de filet contre une caractéristique mal lue
// dans le nom d'un article : un panneau enregistré « PANNEAU 5W » au lieu de
// « 550W » produit une quantité absurde. On enlève le plafond — la quantité
// est désormais toujours juste — et on remplace le filet par un AVERTISSEMENT
// VISIBLE au-delà de ce seuil : à ce niveau-là, c'est soit une très grosse
// installation (légitime), soit un article mal nommé (à corriger).
export const SEUIL_QTE_INHABITUELLE = 60;
export const quantiteNecessaire = (besoin, valeurUnitaire) => {
  const u = Number(valeurUnitaire || 0);
  if (!(u > 0)) return 1;
  return Math.max(1, Math.ceil(Number(besoin || 0) / u));
};

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
  s.setPctRemise(String(devis.pct_remise ?? 0));
  s.setPctTransport(String(devis.pct_transport ?? 0));
  s.setPctAcompte(String(devis.pct_acompte ?? 100));
  s.setDelaiInstallation(String(devis.delai_installation || ""));
  // « Pose seule » : le montant de main d'œuvre est un montant FIXE, pas un
  // pourcentage — il est rangé dans frais_installation, et pct_installation
  // vaut null. On rétablit la case ET son montant, sinon le devis repris
  // repasserait en pourcentage sans prévenir.
  const pose = !!devis.pose_seule;
  s.setPoseSeule(pose);
  s.setMontantPoseFixe(pose ? String(devis.frais_installation ?? "") : "");
  s.setPctInstall(pose ? "10" : String(devis.pct_installation ?? 10));
}

// ⚠ « BATERIE » n'était pas reconnu (relevé par Timo, 18/08/2026) — ses trois
// batteries étaient sous ses yeux, l'application affirmait qu'il n'y en avait
// aucune. Il manquait un T. Tout le reste était pourtant lu correctement :
// 200 Ah, 300 Ah, et même 51,2 V traduit en système 48 V.
//
// Une faute d'une lettre sur le mot dont dépend TOUTE la sélection, ça arrive
// tous les jours — surtout quand plusieurs personnes saisissent le stock.
// Plutôt que d'énumérer les fautes une à une, on compare des mots simplifiés :
// sans accent, et sans lettres doublées. « BATERIE » et « BATTERIE » se
// ramènent tous deux à « baterie ». Idem pour paneau/panneau,
// convertiseur/convertisseur, regulateur/régulateur.
export const simplifierMot = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/(.)\1+/g, "$1");

// Deux noms de famille désignent-ils la même chose ? On compare en simplifié
// (sans accent ni lettre doublée), et on accepte qu'un nom contienne l'autre :
// « Photocellules » et « Photocellules (cellules infrarouges) » sont la même
// famille. L'administrateur peut renommer ses familles dans les Paramètres —
// si le lien se perd, la recherche par le nom de l'article prend le relais.
export const memeFamille = (a, b) => {
  const x = simplifierMot(a).trim(), y = simplifierMot(b).trim();
  if (!x || !y) return false;
  if (x === y) return true;
  return (x.length >= 4 && y.length >= 4) && (x.includes(y) || y.includes(x));
};

export const contientLeMot = (texte, mots) => {
  const t = simplifierMot(texte);
  return mots.some((m) => t.includes(simplifierMot(m)));
};

// ============ OUTILS DE DIMENSIONNEMENT SOLAIRE ============
// Extrait une caractéristique numérique du nom d'un article
// (ex: "Panneau JKM 555W" -> 555 wc, "Convertisseur hybride 3KW" -> 3000 w, "Batterie 200Ah" -> 200 ah)
export function specDepuisNom(nom) {
  const m = String(nom || "").match(/(\d+(?:[.,]\d+)?)\s*(kwc|wc|kw|w|kva|va|ah|kg|a|m)\b/i);
  if (!m) return null;
  let valeur = parseFloat(m[1].replace(",", "."));
  let unite = m[2].toLowerCase();
  if (unite === "kwc") { unite = "wc"; valeur *= 1000; }
  if (unite === "kw") { unite = "w"; valeur *= 1000; }
  if (unite === "kva") { unite = "va"; valeur *= 1000; }
  return { valeur, unite };
}

// ---- Bloc « Autres équipements » : lignes libres (nom + prix + quantité) ----
export function BlocAutresEquipements({ titre, autres, onAjouter, onModifier, onRetirer, placeholder }) {
  return (
    <div className="px-4 py-3 border-t border-slate-200">
      <div className="font-bold text-sm text-slate-700 mb-2">{titre}</div>
      <div className="space-y-2">
        {autres.map((a) => (
          <div key={a.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
            <Field label="Article"><input className={inputCls} placeholder={placeholder} value={a.nom} onChange={(e) => onModifier(a.id, "nom", e.target.value)} /></Field>
            <Field label="Prix unitaire (F)"><input type="number" className={inputCls} value={a.prix} onChange={(e) => onModifier(a.id, "prix", e.target.value)} /></Field>
            <Field label="Quantité"><input type="number" min="1" className={inputCls} value={a.qte} onChange={(e) => onModifier(a.id, "qte", e.target.value)} /></Field>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 pb-2" title="Ne compte ni dans le chiffre d'affaires ni dans les commissions — pour un article que BMI facture sans qu'il vienne de son propre stock.">
              <input type="checkbox" checked={!!a.hors_boutique} onChange={(e) => onModifier(a.id, "hors_boutique", e.target.checked)} /> HB
            </label>
            <button onClick={() => onRetirer(a.id)} className="text-xs text-red-600 underline pb-2">Retirer</button>
          </div>
        ))}
      </div>
      <button onClick={onAjouter} className="mt-2 text-sm font-bold text-sky-800 underline">➕ Ajouter un équipement</button>
    </div>
  );
}

// ---- Bloc totaux : remise (sur les articles uniquement) → installation → transport → total ----
export function BlocTotauxDevis({ totalArticles, pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, masquerInstallationPct, pctTransport, setPctTransport, fraisTransport, totalDevis, onConvertir }) {
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
        {!masquerInstallationPct && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Frais d'installation</span>
            <input type="number" min="0" max="100" step="0.5" value={pctInstall} onChange={(e) => setPctInstall(e.target.value)} className="w-16 rounded border border-slate-300 px-2 py-0.5 text-right" />
            <span className="text-slate-500">% =</span><span className="font-semibold">{fmt(fraisInstallation)}</span>
          </div>
        )}
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
export function useTotauxDevis(totalArticles) {
  const [pctRemise, setPctRemise] = useState("0");
  const remise = Math.round((totalArticles * Number(pctRemise || 0)) / 100);
  const [pctInstall, setPctInstall] = useState("10");
  const fraisInstallation = Math.round((totalArticles * Number(pctInstall || 0)) / 100);
  const [pctTransport, setPctTransport] = useState("0");
  const fraisTransport = Math.round((totalArticles * Number(pctTransport || 0)) / 100);
  const totalDevis = totalArticles - remise + fraisInstallation + fraisTransport;
  return { pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis };
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

export function BlocConditionsPaiement({ pctAcompte, setPctAcompte, delaiInstallation, setDelaiInstallation, montantAcompte, totalDevis }) {
  return (
    <div className="px-4 py-3 border-t border-slate-200 bg-amber-50 flex flex-wrap gap-4 items-end">
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
export function BlocEnvoiDevisClient({ db, clientDevis, setClientDevis, nouvClient, setNouvClient, comptesClients, onEnvoyer, profile }) {
  // ⚠ La signature était exigée tout à la FIN, après avoir tout rempli et
  // cliqué (relevé par Timo, 18/08/2026). On prévient maintenant AVANT.
  const sansSignature = profile && !profile.signature_personnelle;
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
export async function resoudreClientDevis(db, clientDevis, nouvClient, profile, boutique) {
  if (clientDevis === "__nouveau__") {
    const nom = nouvClient.nom.trim();
    const tel = nouvClient.tel.trim();
    if (!nom || chiffresTel(tel).length < 4) {
      uAlert("Pour créer le compte, il faut le nom du client et son numéro (au moins 4 chiffres).");
      return null;
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
    const chiffresSaisis = chiffresTel(tel);
    const existant = (db.users || []).find((u) => u.role === "client" && u.tel && chiffresTel(u.tel) === chiffresSaisis);
    if (existant) {
      return {
        compte: existant, motDePasse: existant.mdp_auto ? motDePasseConnu(existant) : null,
        dbApres: db,
      };
    }
    // Le compte client hérite de l'espace de celui qui le crée (voir
    // marqueEspace) : un « client » inventé pendant un entraînement ne doit
    // pas se retrouver mêlé aux vrais dans les listes ni dans les relances.
    const fab = await fabriquerCompteClient(db, nom, tel, profile.nom, marqueEspace(db, profile, boutique));
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
export async function envoyerDevisEtOuvrirWhatsApp({ dbApres, compte, motDePasse, devis, save, profile, nouvClient, ligneEntete, idAReprendre }) {
  // Signature personnelle exigée AVANT tout envoi de devis (demande Timo) —
  // elle sera réutilisée automatiquement sur tous les contrats futurs de
  // cette personne, plutôt que d'être redemandée à chaque fois. Un seul
  // point de contrôle ici, puisque cette fonction est déjà partagée par
  // les 3 volets du dimensionnement (Solaire/Garage/Autre).
  if (!profile.signature_personnelle) {
    uAlert("Avant d'envoyer un devis, vous devez d'abord enregistrer votre signature — rendez-vous dans l'onglet « 📄 Contrats » pour le faire, une seule fois.");
    return false;
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
  const dbFinal = {
    ...dbApres,
    users: dbApres.users.map((u) => (u.id === compte.id
      ? { ...u, devis: idAReprendre ? u.devis.map((x) => (x.id === idAReprendre ? { ...devisMarque, id: idAReprendre } : x)) : [devisMarque, ...(u.devis || [])] }
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
  // Si le navigateur bloque l'ouverture, on le DIT et on propose un bouton :
  // sans cela, le devis partait enregistré mais le client n'était jamais
  // prévenu, et personne ne le savait.
  await ouvrirWhatsApp(num ? `https://wa.me/${num}?text=${txt}` : `https://wa.me/?text=${txt}`, uConfirm);
  return true;
}
