// ============================================================
// screens/Clients.jsx — Créer un client (parrainage employé), et
// liste des clients.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import React, { useState } from "react";
import { correspond } from "../lib/suggestions";
// UNE règle pour « les clients que cette boutique connaît » — celle que
// 💰 Ventes, 💳 Dettes et 🛠 Travaux proposent dans leur case Client
// (Timo, 15/09/2026). Cet écran avait sa propre copie.
import { clientsConnus, clientsFideles, SEUILS_FIDELES } from "../lib/clientsConnus";
import { uid, fmt, today, dFR, telDigits } from "../lib/core";
import { Field, inputCls, Panel, uAlert, uConfirm, usePagination, Pagination, AucuneBoutique, champRecherche, BoutonEnvoi, BoutonGeste } from "../components/ui";
import { FicheClient } from "../components/FicheClient";
import { boutiquesVente, bloquerSiLecture, boutiquesVisibles, boutiqueParDefaut, estCompteFormation, marqueEspace, boutiqueRetenue, memeNumero, comptesAvecCeNumero, utilisateursDeLEspace, estAdminPrincipal, envoyerAvisNouveauContact, chantiersDeLEspaceRegarde, domaineParId, domainesDefinis } from "../lib/calculs";
import { clientsDuType, totalDuType, TYPE_COMPTOIR, TYPE_INSTALLATION } from "../lib/typeClient";
import { carteDe, porteursDeCarte, libellePctCarte, pctCommunCarte } from "../lib/carteFidelite";
import { carteDepuisClientComptoir } from "../components/carteFidelite";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
// 🏢 Le prénom et l'entreprise du client (29/09/2026) : UNE règle, UN bloc.
import { ENTREPRISE_VIDE, critiquePrenom, critiqueEntreprise, champsCompteClient } from "../lib/clientEntreprise";
import { ChampsEntreprise } from "../components/ChampsEntreprise";
import {
  chiffresTel, identifiantClient, motDePasseClient, resoudreMotDePasseClient, fabriquerCompteClient,
  motDePasseConnu, messagesNouveauClient, estSansAcces, ouvrirAcces,
} from "../lib/comptesClients";
// 🔑 Les identifiants partent du numéro BMI (22/09/2026), repli WhatsApp à la main.
import { envoyerIdentifiantsDuNumeroBmi, messagesAvecLigneAcces, envoyerModele, messagesAvecLigneEnvoi } from "../whatsapp";
import { messageIdentifiants, envoiMotFidelite, texteMotFidelite, envoiSuiviInstallation, texteSuiviInstallation } from "../lib/whatsappModeles";
import { ListeCarnet, useTelephone, GestesLigne, GestesDetail } from "../components/ListeCarnet";
import { useRetour } from "../retour";
import { maintenantISO } from "../lib/horloge";
import { stopDuNumero, stopActif, critiqueStopGeste, messagesAvecStop, MOTIF_STOP, numerosStop, cleStop } from "../lib/stopCommercial";

// ============ CRÉER UN CLIENT (parrainage employé) ============
// Onglet dédié, ouvert à tous les employés SAUF l'admin (qui a 👥 Utilisateurs)
// et le client (qui a 🤝 Parrainer). Crée UNIQUEMENT un compte de rôle "client",
// avec identifiants automatiques + envoi WhatsApp. AUCUNE commission.
export function CreerClient({ db, save, profile }) {
  const [f, setF] = useState({ nom: "", prenom: "", tel: "" });
  const [ent, setEnt] = useState(ENTREPRISE_VIDE());
  const [aussiProspect, setAussiProspect] = useState(false); // client simple, ou aussi un prospect à relancer
  const [dernier, setDernier] = useState(null); // { nom, identifiant, motDePasse, tel }

  // Les clients que CET employé a lui-même amenés (traçabilité, sans commission).
  const mesClients = (db.users || []).filter((u) => u.role === "client" && u.amene_par_id === profile.id);

  const creer = async () => {
    if (bloquerSiLecture(db, profile)) return;
    const nom = f.nom.trim(), tel = f.tel.trim();
    if (!nom || chiffresTel(tel).length < 4) { uAlert("Indiquez le nom du client et son numéro (au moins 4 chiffres)."); return; }
    const refusIdentite = critiquePrenom(f.prenom) || critiqueEntreprise(ent);
    if (refusIdentite) { uAlert(refusIdentite); return; }
    // ⚠ memeNumero, pas une égalité de chiffres bruts : « +228 90 11 22 33 »
    // et « 90112233 » sont la MÊME personne (voir lib/identiteClient.js).
    // Avant ce correctif, un doublon se créait sans que personne ne le voie.
    const existant = (db.users || []).find((u) => u.role === "client" && u.tel && memeNumero(u.tel, tel));
    // 🖨 Une fiche SANS ACCÈS (son devis avait été imprimé sans compte,
    // 15/10/2026) : on ne recrée rien, on lui OUVRE son espace.
    if (existant && estSansAcces(existant)) {
      if (!await uConfirm(`🖨 ${existant.nom_base || existant.nom} a déjà une fiche, sans accès à l'application : son devis avait été imprimé sans compte.\n\nLui ouvrir son espace et lui envoyer ses identifiants ?`)) return;
      const ouvert = ouvrirAcces(existant, profile.nom);
      save({ ...db, users: db.users.map((u) => (u.id === existant.id ? ouvert : u)) }, `🔓 Accès ouvert à ${existant.nom} (fiche d'un devis imprimé sans compte) par ${profile.nom}`);
      setF({ nom: "", prenom: "", tel: "" });
      setEnt(ENTREPRISE_VIDE());
      await renvoyer(ouvert);
      return;
    }
    if (existant) { uAlert(`Un compte existe déjà pour ce numéro : ${existant.nom}.\n\nRien n'a été recréé.`); return; }

    const identifiant = identifiantClient(db, nom, tel);
    const { motDePasse } = await resoudreMotDePasseClient(db, nom, tel);
    if (!await uConfirm(
      `Créer le compte de ${nom.toUpperCase()} ?\n\n👤 Identifiant : ${identifiant}\n🔑 Mot de passe : ${motDePasse}\n\nSes identifiants lui seront envoyés par WhatsApp.`
    )) return;

    const { user } = await fabriquerCompteClient(db, nom, tel, profile.nom, { ...marqueEspace(db, profile), ...champsCompteClient(nom, f.prenom, ent) });
    // On note QUI a amené ce client — pour la traçabilité, PAS pour une commission.
    const client = { ...user, amene_par_id: profile.id, amene_par_nom: profile.nom };

    // Si l'employé a coché « à relancer », on crée AUSSI un prospect lié — la
    // personne entre dans la file de démarchage, et en sortira à son paiement.
    const nouveauxProspects = aussiProspect ? [{
      id: uid(), date: today(), maj_le: today(), commercial: profile.role === "commercial" ? profile.nom : null,
      nom: nom.toUpperCase(), tel,
      categorie: (db.categories_prospects || [])[0]?.nom || "Particulier",
      statut: "Favorable", interet: "Intéressé",
      note: `Amené par ${profile.nom}`,
      client_user_id: user.id,
      ...marqueEspace(db, profile),
    }, ...(db.prospects || [])] : (db.prospects || []);

    save({
      ...db,
      users: [...db.users, client],
      prospects: nouveauxProspects,
      messages: [...messagesNouveauClient(db, user, profile), ...(db.messages || [])],
    }, `Compte CLIENT « ${user.nom} » créé par ${profile.nom}${aussiProspect ? " (+ prospect à relancer)" : ""}`);

    setF({ nom: "", prenom: "", tel: "" });
    setEnt(ENTREPRISE_VIDE());
    // ⚠ LE MUR : l'espace du COMPTE CRÉÉ, jamais celui de qui clique.
    const r = await envoyerIdentifiantsDuNumeroBmi({ nomAffiche: nom, identifiant, motDePasse, tel, role: "client", espaceFormation: !!user.formation, demanderConfirmation: uConfirm, prevenir: uAlert });
    if (r && r.auto) save((etat) => ({ ...etat, messages: messagesAvecLigneAcces(etat.messages, { profile, client: client, envoi: r }) }));
    const m = messageIdentifiants(nom, r); if (m) uAlert(m);
    // 🆕 15/11/2026 : le chef d'équipe, le responsable commercial et les
    // administrateurs sont prévenus par WhatsApp (jamais en formation).
    envoyerAvisNouveauContact({ db: { ...db, users: [...db.users, client], prospects: nouveauxProspects }, save, profile, type: "client", id: client.id, formation: !!client.formation });
    // Le cadre vert dit PAR OÙ les accès sont partis : il écrivait « WhatsApp
    // s'est ouvert » en dur, faux depuis que le message part du numéro BMI
    // (22/09/2026 — la règle du 19/09 : l'écran ne décrit que ce qui vient de
    // se passer).
    setDernier({ nom, identifiant, motDePasse, tel, auto: !!(r && r.auto) });
  };

  const renvoyer = async (c) => {
    const id = c.nom;
    const mdp = motDePasseConnu(c);
    if (!mdp) { uAlert("Ce compte a un mot de passe personnalisé, impossible de le régénérer ici."); return; }
    // ⚠ LE MUR : l'espace de la FICHE, jamais celui de qui clique.
    const r = await envoyerIdentifiantsDuNumeroBmi({ nomAffiche: c.nom_base || c.nom, identifiant: id, motDePasse: mdp, tel: c.tel, role: "client", espaceFormation: !!c.formation, demanderConfirmation: uConfirm, prevenir: uAlert });
    if (r && r.auto) save((etat) => ({ ...etat, messages: messagesAvecLigneAcces(etat.messages, { profile, client: c, renvoi: true, envoi: r }) }));
    const m = messageIdentifiants(c.nom_base || c.nom, r); if (m) uAlert(m);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-1">🙋 Créer un compte client</div>
        <div className="text-xs text-slate-500 mb-4">
          Ouvrez un accès à un client (actuel ou potentiel) : il pourra suivre ses devis et ses installations.
          Le nom, le prénom et le numéro suffisent — le mot de passe est généré, et ses identifiants partent par WhatsApp.
        </div>

        <div className="grid sm:grid-cols-3 gap-2 items-end mb-3">
          <Field label="Nom du client"><input className={inputCls} placeholder="KOFFI" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Prénom"><input className={inputCls} placeholder="Ama" value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} data-prenom-client /></Field>
          <Field label="Numéro WhatsApp">
            <input type="tel" className={inputCls} placeholder="+228 90 55 44 33" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} />
            {/* ⚠ PRÉSÉLECTION (demande Timo) : on ne laisse plus l'utilisateur
                tout saisir pour lui refuser la création à la fin. Dès que le
                numéro est reconnu, on montre QUI le porte. */}
            {(() => {
              const dejaLa = comptesAvecCeNumero(db, profile, f.tel);
              if (!dejaLa.length) return null;
              return (
                <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50">
                  {dejaLa.map((u) => (
                    <button key={u.id} type="button" onClick={() => setF({ ...f, nom: u.nom_base || u.nom, tel: u.tel })}
                      className="block w-full text-left px-2 py-1 text-xs font-semibold text-amber-900 whitespace-nowrap hover:bg-amber-100 border-b border-amber-200 last:border-b-0">
                      ⚠ Déjà client : {u.nom_base || u.nom} — {u.tel}
                    </button>
                  ))}
                </div>
              );
            })()}
          </Field>
        </div>

        <div className="mb-3"><ChampsEntreprise valeur={ent} onChange={setEnt} libelle="🏢 Entreprise cliente" aide="La personne saisie au-dessus est son répondant : son compte, ses accès et ses messages lui sont adressés." /></div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 mb-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Ce contact est…</div>
          <label className="flex items-start gap-2 mb-2 cursor-pointer">
            <input type="radio" className="mt-1" checked={!aussiProspect} onChange={() => setAussiProspect(false)} />
            <span className="text-sm"><b>Client décidé</b> — <span className="text-slate-500">il va suivre son devis / son installation. Pas de relance.</span></span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="radio" className="mt-1" checked={aussiProspect} onChange={() => setAussiProspect(true)} />
            <span className="text-sm"><b>Prospect</b> — <span className="text-slate-500">un compte est créé ET il entre dans la file de relance de vos commerciaux.</span></span>
          </label>
        </div>

        <BoutonEnvoi onClick={creer} className="px-5 py-2 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800">🙋 Créer + envoyer</BoutonEnvoi>

        {f.nom.trim() && chiffresTel(f.tel).length >= 4 && (
          <div className="mt-2 rounded-lg bg-green-50 border border-green-200 p-2 text-xs">
            Sera créé — 👤 <b>{identifiantClient(db, f.nom, f.tel)}</b> · 🔑 <b>{motDePasseClient(f.nom, f.tel)}</b>
          </div>
        )}

        {dernier && (
          <div className="mt-3 rounded-lg bg-white border-2 border-green-300 p-3 text-sm">
            ✅ <b>{dernier.nom.toUpperCase()}</b> créé — 👤 {dernier.identifiant} · 🔑 {dernier.motDePasse}
            <div className="text-xs text-slate-500 mt-1">{dernier.auto
              ? "Ses identifiants sont partis du numéro BMI."
              : "Ses identifiants partent de votre numéro, par WhatsApp. Si WhatsApp ne s'est pas ouvert, vérifiez qu'il est installé."}</div>
          </div>
        )}
      </Panel>

      {mesClients.length > 0 && (
        <Panel>
          <div className="font-bold mb-2">Les clients que j'ai amenés ({mesClients.length})</div>
          <div className="space-y-1">
            {mesClients.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <span className="font-semibold">{c.nom_base || c.nom}{c.tel ? <span className="text-slate-400 font-normal"> · {c.tel}</span> : null}</span>
                <BoutonEnvoi onClick={() => renvoyer(c)} className="text-xs font-bold text-green-700 underline">↻ Renvoyer ses accès</BoutonEnvoi>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

export function Clients({ db, save, profile, telephoneInitial = false }) {
  const premiere = boutiqueParDefaut(db, profile, { ecran: "clients" });
  const [bq, setBq] = useState(profile.boutique || premiere);
  // ⚠ Voir boutiqueRetenue (lib/calculs.js) : la valeur mémorisée peut être
  // vide (écran ouvert pendant la synchronisation d'ouverture) ou désigner
  // une boutique qui n'existe plus (supprimée, ou effacée par une
  // réinitialisation). Dans les deux cas, on repart de la boutique par
  // défaut plutôt que d'afficher un écran figé ou un nom fantôme.
  const boutique = boutiqueRetenue(db, profile, bq, { ecran: "clients" });
  const [q, setQ] = useState("");
  // ⭐ Le filtre des fidèles (03/10/2026) : « Tous » d'office, rien ne change
  // pour qui n'y touche pas. LA règle vit dans lib/clientsConnus.js.
  const [seuilFideles, setSeuilFideles] = useState(0);
  // 💳 « −1 » = les PORTEURS DE CARTE de l'espace regardé (29/10/2026 : « l'essentiel
  // qu'on l'enregistre comme fidèle client ») — même ceux qui n'ont rien acheté ici.
  const connus = clientsConnus(db, boutique).sort((a, b) => b.totalAchats - a.totalAchats);
  const porteurs = porteursDeCarte(utilisateursDeLEspace(db, profile));
  // 🛒 / 🏗 « −2 » = les clients COMPTOIR, « −3 » = les clients INSTALLATION
  // (15/11/2026). Un client qui a fait les deux est dans les deux listes,
  // chacune avec SA valeur. LA règle vit dans lib/typeClient.js.
  const typeChoisi = seuilFideles === -2 ? TYPE_COMPTOIR : seuilFideles === -3 ? TYPE_INSTALLATION : null;
  const duComptoir = clientsDuType(connus, TYPE_COMPTOIR);
  const deLInstallation = clientsDuType(connus, TYPE_INSTALLATION);
  let clients = typeChoisi ? (typeChoisi === TYPE_COMPTOIR ? duComptoir : deLInstallation) : seuilFideles === -1
    ? porteurs.map((u) => connus.find((c) => c.tel && memeNumero(c.tel, u.tel)) || { cle: `carte:${u.id}`, nom: u.nom_base || u.nom, tel: u.tel || "", achats: 0, totalAchats: 0, dette: 0, derniere: "" })
    : clientsFideles(connus, seuilFideles);
  const carteDuClient = (c) => (c.tel ? comptesAvecCeNumero(db, profile, c.tel).map(carteDe).find(Boolean) : null) || null;
  const principal = estAdminPrincipal(db, profile);
  if (q) clients = clients.filter((c) => correspond(c.nom + " " + (c.tel || ""), q));
  const { pageItems: clientsPage, page, setPage, totalPages } = usePagination(clients, 50);
  // 🗂 LA FICHE D'UN CLIENT (05/10/2026, Timo : « b, lance ») : un clic sur
  // la ligne l'ouvre dessous, un second la referme, une seule à la fois (la
  // règle de 💰 Ventes). ⚠ « Client non renseigné » n'est PAS un client :
  // ses ventes viennent de personnes différentes, la ligne ne s'ouvre pas.
  const [ficheOuverte, setFicheOuverte] = useState(null);
  // ⬅ La touche retour referme la fiche (Timo, 13/10/2026, « A a »).
  useRetour(!!ficheOuverte, () => setFicheOuverte(null));
  const sansIdentite = (c) => !telDigits(c.tel) && /non renseign|^\(sans nom\)$/i.test(String(c.nom || "").trim());

  // 💙 LE MOT DE FIDÉLITÉ PART DU NUMÉRO BMI (23/09/2026, nouveauté 1 de
  // Timo). Avant : WhatsApp s'ouvrait VIDE sur le téléphone de l'employé.
  // Depuis : un clic, une question, et le mot de fidélité (texte de Timo)
  // part du numéro BMI — `mot_fidelite` si le numéro correspond à un compte
  // client de l'espace regardé (il a un espace), `mot_fidelite_simple` sinon
  // (décision « 2 »). ⚠ LE MUR : c'est l'espace de la BOUTIQUE regardée qui
  // décide, jamais celui de la personne qui clique. Repli : WhatsApp s'ouvre
  // avec le même texte, et l'écran dit pourquoi. Une ligne s'écrit dans
  // 📲 WhatsApp, la conversation remonte et est DONNÉE à celui qui envoie,
  // si elle n'est à personne.
  const contacter = async (c) => {
    const num = telDigits(c.tel);
    if (!num) { uAlert("Aucun numéro enregistré pour ce client."); return; }
    // 🔕 Il a dit STOP (14/11/2026) : on le dit AVANT la question, rien ne part.
    if (stopActif(stopDuNumero(db.messages, c.tel))) { uAlert(MOTIF_STOP); return; }
    // 🖨 Une fiche SANS ACCÈS n'a pas d'espace client : le mot sans les lignes de l'espace.
    const compte = comptesAvecCeNumero(db, profile, c.tel).find((u) => u.role === "client" && !estSansAcces(u)) || null;
    const nom = compte ? (compte.nom_base || compte.nom) : c.nom;
    // 🏗 Depuis la liste « Clients installation » (15/11/2026) : le mot de
    // SUIVI (`suivi_installation`) — son installation, les autres métiers de
    // BMI. Partout ailleurs, le mot de fidélité, comme avant.
    const suivi = typeChoisi === TYPE_INSTALLATION;
    let envoi = envoiMotFidelite({ nom, avecCompte: !!compte });
    let texteRepli = texteMotFidelite({ nom, avecCompte: !!compte });
    if (suivi) {
      // Le chantier le plus récent de ce numéro, dans l'espace regardé (le mur) ; son devis sur SES comptes.
      const chantier = chantiersDeLEspaceRegarde(db, profile).filter((x) => x.tel && memeNumero(x.tel, c.tel))
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0] || null;
      const devis = chantier && chantier.devis_id
        ? comptesAvecCeNumero(db, profile, c.tel).flatMap((u) => (Array.isArray(u.devis) ? u.devis : [])).find((d) => d.id === chantier.devis_id) || null : null;
      envoi = envoiSuiviInstallation({ nom, chantier, devis, nomMetier: devis && devis.domaine ? (domaineParId(db, devis.domaine) || {}).nom : "", domaines: domainesDefinis(db) });
      texteRepli = texteSuiviInstallation(envoi);
    }
    const leMot = suivi ? "le mot de suivi d'installation" : "le mot de fidélité";
    // Une question avant l'envoi : un clic sur une ligne part vite, et un
    // message au nom de BMI ne se rattrape pas.
    if (!await uConfirm(suivi
      ? `Envoyer ${leMot} à ${nom} du numéro BMI ?\n\nInstallation : ${envoi.variables[1]}\nAutres projets proposés : ${envoi.variables[2]}`
      : `Envoyer le mot de fidélité à ${nom} du numéro BMI ?`)) return;
    const bqRegardee = (db.boutiques || []).find((b) => b.nom === boutique) || {};
    const r = await envoyerModele({
      ligne: { nom, ecran: "clients" },
      tel: c.tel,
      modele: envoi.modele,
      variables: envoi.variables,
      espaceFormation: !!bqRegardee.formation,
      texteRepli,
      demanderConfirmation: uConfirm,
      prevenir: uAlert,
    });
    // Le motif d'un repli est dit AVANT l'ouverture de WhatsApp (`prevenir`, 29/09/2026), jamais après.
    if (!r.auto) return;
    if (typeof save === "function") {
      save((etat) => ({
        ...etat,
        messages: messagesAvecLigneEnvoi(etat.messages, { profile, tel: c.tel, nom, modele: envoi.modele, variables: envoi.variables, donnerAuSender: true, envoi: r }),
      }), `${suivi ? "Mot de suivi d'installation" : "Mot de fidélité"} envoyé du numéro BMI à ${nom} — ${profile.nom}`);
    }
    uAlert(`✅ ${suivi ? "Mot de suivi d'installation" : "Mot de fidélité"} envoyé du numéro BMI à ${nom}.`);
  };

  // ---- 🔕 « NE PLUS LUI ENVOYER DE MESSAGES COMMERCIAUX » (14/11/2026) ----
  // Le même geste que dans 📲 WhatsApp → fiche du contact, pour un client qui
  // n'y a pas encore de conversation. Cocher : tout employé ; rouvrir :
  // l'administrateur. Revérifié sur la ligne FRAÎCHE (lib/stopCommercial.js).
  const reglerStop = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    const actif = !stopActif(stopDuNumero(db.messages, c.tel));
    const refus = critiqueStopGeste(profile, { actif, tel: c.tel });
    if (refus) { uAlert(refus); return; }
    if (!await uConfirm(actif
      ? `🔕 Ne plus envoyer de messages commerciaux à ${c.nom} (${c.tel}) ?\n\nNe partiront plus vers ce numéro : le mot de fidélité, les relances, la demande d'avis.\nContinuent de partir : ses devis, ses reçus, ses rappels de paiement.\n\nSeul l'administrateur pourra rouvrir.`
      : `🔔 Rouvrir les messages commerciaux pour ${c.nom} (${c.tel}) ?\n\nNe le faites que si le client l'a demandé.`)) return;
    save((etat) => {
      if (stopActif(stopDuNumero(etat.messages, c.tel)) === actif) return etat;
      return { ...etat, messages: messagesAvecStop(etat.messages || [], { tel: c.tel, actif, profile, maintenant: maintenantISO() }) };
    }, actif
      ? `🔕 ${c.tel} ne reçoit plus de messages commerciaux (noté par ${profile.nom})`
      : `🔔 Messages commerciaux rouverts pour ${c.tel} par ${profile.nom}`);
  };

  const telephone = useTelephone(telephoneInitial);
  const nomClient = (c, deplie) => {
    const carte = carteDuClient(c);
    return (<>{c.nom}{!sansIdentite(c) && <span className="ml-1 text-[10px] font-normal text-slate-400">{deplie ? "▴" : "▾"}</span>}{carte && <div data-carte-client className="text-[11px] font-bold text-emerald-700">💳 {carte.numero} · {libellePctCarte(carte, pctCommunCarte(db.boutiques))}</div>}</>);
  };
  const stops = numerosStop(db.messages);
  const telClient = (c) => (<>{c.tel || "—"}{!!c.tel && stops.has(cleStop(c.tel)) && <div data-stop-client className="text-[11px] font-bold text-rose-700">🔕 plus de messages commerciaux</div>}</>);
  const totalClient = (c) => (<>{fmt(c.totalAchats)}
    {!typeChoisi && c.comptoir && c.installation && c.installation.total > 0 && <div className="text-[11px] font-normal text-slate-600 whitespace-nowrap" data-parts-client>{c.comptoir.total > 0 && <>🛒 {fmt(c.comptoir.total)} · </>}🏗 {fmt(c.installation.total)}</div>}</>);
  // Les gestes en toutes lettres ; le droit de chacun se revérifie DANS le geste.
  const gestesClient = (c) => {
    const enStop = !!c.tel && stops.has(cleStop(c.tel));
    const carte = carteDuClient(c);
    return {
      whatsapp: c.tel ? <BoutonEnvoi onClick={(e) => { e.stopPropagation(); return contacter(c); }} className="px-2 py-1 rounded-md border text-[11.5px] font-bold whitespace-nowrap border-green-300 bg-green-50 text-green-800">WhatsApp</BoutonEnvoi> : null,
      stop: c.tel && typeof save === "function" && (!enStop || profile.role === "admin")
        ? <BoutonGeste icone={enStop ? "🔔" : "🔕"} nom={enStop ? "Rouvrir les messages commerciaux" : "Plus de messages commerciaux"} teinte={enStop ? "gris" : "rose"} titre={enStop ? "Rouvrir les messages commerciaux pour ce client (administrateur)" : "Il a dit STOP : ne plus lui envoyer de messages commerciaux"} onClick={() => reglerStop(c)} /> : null,
      carte: principal && c.tel
        ? <BoutonGeste icone="💳" nom={carte ? "Sa carte de fidélité" : "Lui donner une carte de fidélité"} teinte="vert" titre={carte ? "Sa carte de fidélité : imprimer, changer la remise, remplacer, retirer" : "Lui donner une carte de fidélité"} onClick={() => carteDepuisClientComptoir({ db, save, profile, client: c, comptesDuNumero: comptesAvecCeNumero(db, profile, c.tel), boutique })} /> : null,
    };
  };

  // ⚠ Cloisonnement : aucune boutique de l'espace du compte connecté —
  // on n'affiche PAS le formulaire, plutôt que de le laisser écrire dans la
  // boutique de repli (voir boutiqueParDefaut dans lib/calculs.js).
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;
  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs ecran="clients" db={db} value={bq} onChange={setBq} profile={profile} />}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <span className="font-bold text-slate-800">Clients — {boutique} <span className="text-sm font-normal text-slate-500">({clients.length})</span>
            {typeChoisi && <span className="ml-2 text-sm font-bold text-emerald-700" data-total-type>{typeChoisi === TYPE_COMPTOIR ? "🛒 Total comptoir" : "🏗 Total installation"} : {fmt(totalDuType(clients, typeChoisi))}</span>}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <select className={`${inputCls} sm:w-56`} value={seuilFideles} onChange={(e) => setSeuilFideles(Number(e.target.value))} data-filtre-fideles aria-label="Afficher">
              <option value={0}>Tous les clients</option>
              {SEUILS_FIDELES.map((n) => <option key={n} value={n}>⭐ Fidèles — {n} achats ou plus</option>)}
              <option value={-1}>💳 Porteurs de carte ({porteurs.length})</option>
              <option value={-2}>🛒 Clients comptoir ({duComptoir.length})</option>
              <option value={-3}>🏗 Clients installation ({deLInstallation.length})</option>
            </select>
            <input className={champRecherche} placeholder="Rechercher un client…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {/* 📖 La charte des listes (19/11/2026) : le client figé, « À faire » = son
            WhatsApp (mot de fidélité ou de suivi), « ▸ Détail » ouvre sa fiche et
            range 🔕 STOP et 💳 carte en toutes lettres ; une carte par client sur
            téléphone. Un « client » sans nom ni numéro n'a pas de fiche. */}
        <ListeCarnet items={clientsPage} cle={(c) => c.cle} telephone={telephone} ouvert={ficheOuverte}
          onBasculer={(c) => { if (!sansIdentite(c)) setFicheOuverte((o) => (o === c.cle ? null : c.cle)); }}
          marques={{ cartes: "data-cartes-clients", carte: "data-carte-client-ligne", etat: "data-ligne-client", detail: "data-detail-client" }}
          aucun={<>{typeChoisi === TYPE_COMPTOIR ? "Aucun client n'a encore acheté au comptoir de cette boutique." : typeChoisi === TYPE_INSTALLATION ? "Aucun client d'installation (devis encaissé, pose seule, travaux) dans cette boutique." : seuilFideles === -1 ? "Aucune carte de fidélité dans cet espace : l'administrateur principal en crée une avec le bouton 💳 d'un client." : seuilFideles > 0 ? `Aucun client n'a encore acheté ${seuilFideles} fois dans cette boutique.` : "Aucun client trouvé."}</>} largeurMin="min-w-[720px]"
          colonnes={[
            { titre: "Client", figee: true, classe: "font-semibold", cellule: (c, i, deplie) => nomClient(c, deplie) },
            { titre: "Téléphone", cellule: (c) => telClient(c) },
            { titre: "Achats", classe: "tabular-nums", cellule: (c) => c.achats },
            { titre: typeChoisi === TYPE_COMPTOIR ? "Acheté au comptoir" : typeChoisi === TYPE_INSTALLATION ? "Installation" : "Total acheté", classe: "tabular-nums font-bold", cellule: (c) => totalClient(c) },
            { titre: "Dette en cours", classe: "tabular-nums font-bold", cellule: (c) => <span className={c.dette > 0 ? "text-red-600" : "text-green-700"}>{fmt(c.dette)}</span> },
            { titre: "Dernier achat", cellule: (c) => dFR(c.derniere) },
            { titre: "À faire", actions: true, largeur: "min-w-[180px]" },
          ]}
          carte={(c, deplie) => (
            <div>
              <div className="font-semibold text-slate-800">{nomClient(c, deplie)}</div>
              <div className="text-xs text-slate-500">{telClient(c)}</div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 text-sm">
                <span className="text-slate-500">Achats</span><span className="text-right tabular-nums">{c.achats}</span>
                <span className="text-slate-500">Total acheté</span><span className="text-right tabular-nums font-bold">{totalClient(c)}</span>
                <span className="text-slate-500">Dette en cours</span><span className={`text-right tabular-nums font-bold ${c.dette > 0 ? "text-red-600" : "text-green-700"}`}>{fmt(c.dette)}</span>
                <span className="text-slate-500">Dernier achat</span><span className="text-right">{dFR(c.derniere)}</span>
              </div>
            </div>
          )}
          gestes={(c, deplie) => <GestesLigne g={gestesClient(c)} moment="whatsapp" deplie={deplie && !sansIdentite(c)} onDetail={() => { if (!sansIdentite(c)) setFicheOuverte(deplie ? null : c.cle); }} marque="data-detail-client-bouton" />}
          detail={(c) => (
            <div className="space-y-2">
              <GestesDetail g={gestesClient(c)} moment="whatsapp" lignes={[["Messages", ["stop"]], ["Carte", ["carte"]]]} />
              <FicheClient db={db} profile={profile} cible={{ nom: c.nom, tel: c.tel }} />
            </div>
          )} />
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>
    </div>
  );
}

// ============ CAISSE ============
