// ============================================================
// screens/dimensionnement/Partages.jsx — Blocs partagés par les trois volets : lecture des specs dans les
// noms d'articles, autres équipements, totaux du devis (remise,
// installation, transport), envoi du devis au client via WhatsApp.
// ============================================================
import { useState } from "react";
import { ADRESSE_APP, chiffresTel, identifiantClient, motDePasseClient, fabriquerCompteClient, messagesNouveauClient, motDePasseConnu } from "../../lib/comptesClients";
import { fmt, telDigits, col } from "../../lib/core";
import { Field, inputCls, uAlert } from "../../components/ui";

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
export function BlocTotauxDevis({ totalArticles, pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis, onConvertir }) {
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

// ---- Bloc « Envoyer le devis au client » : sélection/création du compte + bouton WhatsApp ----
export function BlocEnvoiDevisClient({ db, clientDevis, setClientDevis, nouvClient, setNouvClient, comptesClients, onEnvoyer }) {
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
export async function resoudreClientDevis(db, clientDevis, nouvClient, profile) {
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
export function envoyerDevisEtOuvrirWhatsApp({ dbApres, compte, motDePasse, devis, save, profile, nouvClient, ligneEntete, idAReprendre }) {
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
