// ============================================================
// src/whatsapp.js — LE SEUL CHEMIN D'UN MESSAGE WHATSAPP
//
// Timo, 19/09/2026 : « lance l'étape 1 » — le message part du numéro BMI
// sans que personne n'ouvre WhatsApp, et la trace reste sur le devis.
//
// ⚠⚠ UN SEUL CHEMIN, comme `src/push.js` pour les notifications. Aucun
// écran n'appelle `whatsappEnLigne` ; ils appellent TOUS `envoyerModele`
// ci-dessous, et le banc l'impose. Sans cette règle, un écran oublierait le
// mur de la formation, ou le repli — et personne ne le verrait avant qu'un
// client de formation reçoive un vrai message.
//
// ⚠⚠ RIEN N'EST JAMAIS PERDU EN SILENCE. Tout refus, toute panne, tout
// numéro illisible RAMÈNE le bouton WhatsApp d'aujourd'hui, avec son texte
// complet. C'est la règle du 08/09/2026 (« si le navigateur bloque
// l'ouverture, on le DIT »), poussée d'un cran : ici c'est l'envoi
// automatique qui peut manquer, et le vendeur doit pouvoir finir à la main.
//
// ⚠ PAS DE FILE D'ATTENTE, et c'est VOULU — contrairement aux notifications.
// Une notification qui arrive avec deux heures de retard reste juste. Une
// relance de devis partie trois jours plus tard, alors que le client est
// déjà passé payer, est une faute. Hors ligne, on ouvre WhatsApp tout de
// suite : la personne voit, décide, envoie.
// ============================================================
import { ouvrirWhatsAppApresAnnonce, nouveauMessage } from "./lib/core";
import { critiqueEnvoiAuto, motifEchecWhatsApp, envoiIdentifiants, MODELES_IDENTIFIANTS, texteEspaceMasque, ligneEnvoiModele, motifAttendu, messageRepli, lignePrivee, lignePriveeEnvoi, ligneMasquee, recuPdfDepuis, lignePdfNonParti } from "./lib/whatsappModeles";
import { CANAL_WA, cleConversation, messagesAvecEntete, idEntete } from "./lib/whatsappConversations";
import { texteIdentifiantsClient, texteIdentifiantsEmploye } from "./lib/comptesClients";
// ✓✓ Les coches (26/09/2026) : le numéro de suivi se range sur la ligne.
import { champsEnvoi } from "./lib/suiviEnvoi";
import { champRelaisTexte } from "./lib/relaisRecuPdf";
import { MOTIFS_CONTACT_GOOGLE } from "./lib/contactGoogle";
import { motifReseau } from "./lib/motifReseau";
// 🔁 Le même message ne part pas deux fois (18/10/2026, « les deux, lance »).
import { creerRegistre, cleEnvoi, critiqueDoublon, marquerEnCours, marquerParti, oublierEnvoi, nettoyerRegistre } from "./lib/antiDoublonEnvoi";

const enLigne = () => typeof navigator === "undefined" || navigator.onLine !== false;

// Le registre des envois de CET appareil (il meurt avec la page, et c'est
// assez : un double appui se joue en une seconde, pas en un jour).
const registreEnvois = creerRegistre();

// Rend { auto, parti, motif, id } :
//   auto  — vrai si le message est parti tout seul, du numéro BMI ;
//   parti — vrai si le client a reçu quelque chose, d'une façon ou d'une
//           autre (c'est LUI que l'écran regarde avant d'écrire sa trace) ;
//   motif — pourquoi l'envoi automatique n'a pas eu lieu, en français.
//
// `texteRepli` est le message d'aujourd'hui, mot pour mot : on ne le
// remplace pas, on le garde sous la main.
// ⚠ `sansRepli` (23/09/2026, le reçu automatique de 💰 Ventes) : quand le
// numéro BMI ne peut pas envoyer, on NE fait PAS ouvrir WhatsApp — un vendeur
// qui encaisse dix ventes ne doit pas le voir s'ouvrir dix fois. On rend le
// motif, l'écran le dit discrètement, et le bouton du reçu reste là.
// ⚠ `prevenir` (29/09/2026, capture Timo : « pourquoi elle vient après que
// le message soit déjà passé ? ») : le motif du repli se dit AVANT d'ouvrir
// WhatsApp, jamais après. L'écran passe sa fenêtre (`uAlert`) ; elle est
// ATTENDUE, puis WhatsApp s'ouvre. Un motif attendu (formation, premier
// contact) ne dérange personne. `annonce` dit à l'écran que c'est déjà dit.
// `annonceRepli` : ce que l'écran veut dire AVANT l'ouverture même quand le
// motif est attendu (formation, premier contact) — sinon rien n'est dit.
// 📎 `fichier` (17/10/2026) : le PDF d'un modèle à en-tête document
// (`devis_pdf`) — { nom, mime, donnees } en base64. Sans lui, ce modèle est
// refusé ici même, avant tout appel (critiqueEnvoiAuto).
export async function envoyerModele({ tel, modele, variables, espaceFormation, premierContact, texteRepli, demanderConfirmation, sansRepli = false, prevenir, annonceRepli, fichier = null }) {
  // `reseau` : la connexion est tombée AVANT la réponse du serveur — on ne
  // sait pas si le message est parti (18/10/2026). L'écran peut le dire.
  const repli = async (motif, reseau = false) => {
    if (sansRepli) return { auto: false, motif, annonce: false, parti: false, reseau };
    const imprevu = !!motif && !motifAttendu(motif);
    const texteAnnonce = imprevu ? messageRepli(motif, annonceRepli) : (annonceRepli || "");
    const annonce = !!texteAnnonce && typeof prevenir === "function";
    return {
      auto: false,
      motif,
      reseau,
      annonce,
      parti: await ouvrirWhatsAppApresAnnonce({ tel, texte: texteRepli, annonce: texteAnnonce, prevenir, demanderConfirmation }),
    };
  };

  const refus = critiqueEnvoiAuto({ modele, variables, tel, espaceFormation, premierContact, enLigne: enLigne(), avecDocument: !!fichier });
  if (refus) return repli(refus);

  // 🔁 LE FILET ANTI-DOUBLON (18/10/2026) : le MÊME message (même modèle,
  // même numéro, mêmes mots) ne repart pas pendant qu'il part, ni dans la
  // minute qui suit. ⚠ AUCUN REPLI ici : ouvrir WhatsApp ferait justement
  // partir la copie. On le DIT (la fenêtre de l'écran), et rien ne part.
  const cle = cleEnvoi({ modele, tel, variables, fichier });
  const maintenantMs = Date.now();
  nettoyerRegistre(registreEnvois, maintenantMs);
  const doublon = critiqueDoublon(registreEnvois, cle, maintenantMs);
  if (doublon) {
    const dire = !sansRepli && typeof prevenir === "function";
    if (dire) await prevenir(doublon);
    return { auto: false, parti: false, motif: doublon, doublon: true, annonce: dire, reseau: false };
  }
  marquerEnCours(registreEnvois, cle, maintenantMs);

  let reponse;
  try {
    // ⚠ CHARGÉ AU MOMENT DE L'ENVOI, jamais au chargement de l'écran.
    // `supabaseClient` lit `import.meta.env` dès qu'il est importé : un
    // écran qui l'entraîne dans sa suite ne peut plus être monté par le
    // banc (esbuild + Node), et un écran que le banc ne peut pas monter
    // est un écran blanc en puissance (leçon du 19/09/2026). Le message
    // n'en part pas moins vite : personne ne clique en moins d'une seconde.
    const { whatsappEnLigne } = await import("./supabaseClient");
    reponse = await whatsappEnLigne({ tel, modele, variables, ...(fichier ? { fichier: { nom: fichier.nom, mime: fichier.mime, donnees: fichier.donnees } } : {}) });
  } catch (e) {
    oublierEnvoi(registreEnvois, cle);
    return repli(motifEchecWhatsApp({ erreur: e?.message }));
  }
  if (!reponse || reponse.error) {
    // Refusé ou coupé : on peut réessayer tout de suite.
    oublierEnvoi(registreEnvois, cle);
    // ⚠ LE REFUS DE WHATSAPP ARRIVE EN ANGLAIS : `motifEchecWhatsApp` le
    // traduit quand il le reconnaît, et le laisse entier quand il ne le
    // reconnaît pas (on n'invente jamais une explication). La phrase
    // d'origine part TOUJOURS dans la console — pour dépanner, jamais à
    // l'écran : le diagnostic affiché a déjà été retiré une fois (Timo,
    // 16/09/2026, « je n'aime plus voir ça »).
    if (reponse?.error) console.info("[whatsapp] refus :", reponse.error, reponse.code_whatsapp || "");
    return repli(motifEchecWhatsApp({ statut: reponse?.statut, erreur: reponse?.error, code: reponse?.code_whatsapp }), !!reponse?.reseau);
  }
  marquerParti(registreEnvois, cle, Date.now());
  return { auto: true, parti: true, motif: "", id: reponse.id || "", wamid: reponse.wamid || "" };
}

// ---------------------------------------------------------------
// 🔑 LES IDENTIFIANTS D'UN COMPTE QU'ON VIENT DE CRÉER (22/09/2026)
// ---------------------------------------------------------------
// Capture Timo : « la création d'un compte redirige toujours vers le
// WhatsApp du téléphone… le message ne passe pas par le numéro BMI ».
// Depuis : le modèle `espace` part du numéro BMI, et l'ouverture WhatsApp
// d'avant reste le REPLI, avec le texte d'avant mot pour mot (« je veux que
// les 2 existent », 21/09). UNE fonction pour les six écrans qui créent ou
// renvoient un compte — six copies finiraient par oublier le mur.
// ⚠ LE MUR : `espaceFormation` est l'espace du COMPTE CRÉÉ (sa marque), jamais
// celui de la personne qui clique.
// ⚠ `premierContact` n'est pas passé : c'est CE message qui porte les
// identifiants, la règle du premier contact ne le concerne pas.
export async function envoyerIdentifiantsDuNumeroBmi({ nomAffiche, identifiant, motDePasse, tel, role, espaceFormation, demanderConfirmation, prevenir }) {
  const texteRepli = role && role !== "client"
    ? texteIdentifiantsEmploye(nomAffiche, identifiant, motDePasse, role)
    : texteIdentifiantsClient(nomAffiche, identifiant, motDePasse);
  // 14/10/2026, décision « a » : `espace_portail` d'abord, SANS repli (sinon
  // WhatsApp s'ouvrirait deux fois) ; s'il ne part pas, `espace` prend le
  // relais avec le repli d'avant. Le modèle parti suit la réponse (`modele`) :
  // la ligne de 📲 WhatsApp écrit SON texte.
  const [premier, relais] = MODELES_IDENTIFIANTS;
  const a = envoiIdentifiants({ nomAffiche, identifiant, motDePasse, modele: premier });
  const r1 = await envoyerModele({ tel, modele: a.modele, variables: a.variables, espaceFormation: !!espaceFormation, sansRepli: true });
  if (r1.auto) return { ...r1, modele: a.modele };
  const b = envoiIdentifiants({ nomAffiche, identifiant, motDePasse, modele: relais });
  const r2 = await envoyerModele({ tel, modele: b.modele, variables: b.variables, espaceFormation: !!espaceFormation, texteRepli, demanderConfirmation, prevenir });
  return { ...r2, modele: b.modele };
}

// Les accès SANS repli (le premier devis d'un client : si rien ne part, le
// devis repart à la main avec ses codes). Même ordre, même relais.
export async function envoyerAccesSansRepli({ nomAffiche, identifiant, motDePasse, tel, espaceFormation }) {
  let r = null;
  for (const modele of MODELES_IDENTIFIANTS) {
    const e = envoiIdentifiants({ nomAffiche, identifiant, motDePasse, modele });
    r = await envoyerModele({ tel, modele: e.modele, variables: e.variables, espaceFormation: !!espaceFormation, sansRepli: true });
    if (r.auto) return { ...r, modele: e.modele };
  }
  return r;
}

// ---------------------------------------------------------------
// 🔑 LA LIGNE « ACCÈS ENVOYÉS » DANS LA CONVERSATION (23/09/2026)
// ---------------------------------------------------------------
// Décision Timo : le message `espace` se lit dans 📲 WhatsApp, en clair pour
// le créateur et l'administrateur, masqué pour tout autre utilisateur.
// ⚠ On n'écrit la ligne QUE si le message est PARTI du numéro BMI (`r.auto`)
// — une ouverture WhatsApp part d'un autre numéro, le fil mentirait. Donc
// jamais en formation. ⚠ Le mot de passe n'y est PAS : le texte rangé est
// celui du modèle, trous masqués (lib/whatsappModeles.js), et c'est l'écran
// qui remplit pour qui a le droit. La fiche légère de la conversation suit,
// sans toucher à qui elle est confiée (seul « 🔁 Confier » le fait).
// Cinq écrans s'en servent, par `save((etat) => …)` : l'écran a déjà
// enregistré le compte avant d'envoyer, il ne doit pas réécrire un état
// périmé (la création serait prise pour une suppression).
export function messagesAvecLigneAcces(messages, { profile, client, renvoi = false, envoi = null }) {
  const liste = Array.isArray(messages) ? messages : [];
  const tel = client && client.tel;
  const cle = cleConversation(tel);
  if (!cle || !client) return liste;
  const nom = client.nom_base || client.nom || "";
  const entete = liste.find((x) => x && x.id === idEntete(cle)) || {};
  const m = nouveauMessage(profile, {
    canal: CANAL_WA, wa_tel: cle, wa_numero: tel, wa_nom: nom,
    texte: texteEspaceMasque(nom, envoi && envoi.modele),
    wa_acces: { client_id: client.id, renvoi: !!renvoi, modele: (envoi && envoi.modele) || "espace" },
    ...champsEnvoi(envoi),
  });
  return messagesAvecEntete([m, ...liste], {
    cle, tel, nom, derniere: m.ts,
    proprietaire_id: entete.proprietaire_id, proprietaire_nom: entete.proprietaire_nom,
  });
}

// ---------------------------------------------------------------
// 📲 LA LIGNE D'UN ENVOI PAR MODÈLE DANS LA CONVERSATION (23/09/2026)
// ---------------------------------------------------------------
// Timo : « les discussions de relance ne remontent pas ». Un devis, une
// relance de devis, un rappel de dette partaient du numéro BMI sans écrire
// une ligne dans le fil : la conversation restait à la date de son dernier
// vrai message, et personne n'y lisait que la relance était partie. UNE
// fonction pour les trois écrans (Partages, Tous les devis, Dettes), même
// charpente que `messagesAvecLigneAcces` :
//   ⚠ seulement si le message est PARTI du numéro BMI (`r.auto`) — donc
//     jamais en formation, jamais sur le repli ;
//   ⚠ la phrase vient de `ligneEnvoiModele` (lib/whatsappModeles.js) :
//     jamais un secret, jamais « livré » ni « lu » ; modèle inconnu → rien ;
//   ⚠ la conversation ne change PAS de propriétaire (règle du 20/09 :
//     seul « 🔁 Confier » le fait) — la fiche légère suit avec le sien ;
//   ⚠ la fenêtre de 24 h ne s'ouvre pas (seul un message ENTRANT l'ouvre),
//     aucune pastille rouge (la ligne n'est pas un entrant).
// Appelée par `save((etat) => …)` : l'écran a déjà enregistré la trace sur
// le devis ou la dette, on ne repart jamais d'un état périmé.
// ⚠ `donnerAuSender` (23/09/2026, le mot de fidélité de 📋 Clients) : comme
// « ✍️ Écrire », le mot de fidélité DONNE la conversation à celui qui l'envoie
// — sinon le vendeur écrit à son client et la réponse tombe au support. MAIS
// seulement si elle n'est à PERSONNE : une conversation déjà confiée à un
// collègue ne se prend pas au passage (seul « 🔁 Confier » le fait). Une
// relance, un reçu de vente ne la donnent jamais (`donnerAuSender` absent).
// ✓✓ `envoi` = la réponse de `envoyerModele` : son numéro de suivi se range
// sur la ligne, c'est lui qui permettra d'y poser les coches (26/09/2026).
export function messagesAvecLigneEnvoi(messages, { profile, tel, nom, modele, variables, ref = {}, donnerAuSender = false, envoi = null, relais = null }) {
  const liste = Array.isArray(messages) ? messages : [];
  const cle = cleConversation(tel);
  // 🔒 Un reçu de vente ou un bon : la ligne rangée ne porte pas le détail
  // (lib/whatsappModeles.js, MODELES_PRIVES) — l'écran le recompose depuis la
  // vente pour le vendeur et l'administrateur principal.
  const prive = lignePriveeEnvoi(modele, ref);
  const texte = ligneEnvoiModele(modele, variables) ? (prive ? ligneMasquee(modele) : ligneEnvoiModele(modele, variables)) : "";
  if (!cle || !texte) return liste;
  const nomClient = String(nom || "");
  const entete = liste.find((x) => x && x.id === idEntete(cle)) || {};
  const libre = !entete.proprietaire_id || entete.proprietaire_id === profile?.id;
  const prop = donnerAuSender && libre && profile?.id
    ? { proprietaire_id: profile.id, proprietaire_nom: profile.nom || "" }
    : {};
  const m = nouveauMessage(profile, {
    canal: CANAL_WA, wa_tel: cle, wa_numero: tel, wa_nom: nomClient,
    texte,
    wa_modele: String(modele || ""),
    ...(ref && ref.devis_id ? { devis_id: ref.devis_id } : {}),
    ...(ref && ref.dette_id ? { dette_id: ref.dette_id } : {}),
    ...(ref && ref.vente_id ? { vente_id: ref.vente_id } : {}),
    ...(ref && ref.bon_numero ? { bon_numero: ref.bon_numero } : {}),
    ...(ref && ref.bon_vente_id ? { bon_vente_id: ref.bon_vente_id } : {}),
    ...(ref && ref.salaire_user_id ? { salaire_user_id: ref.salaire_user_id, virement_id: ref.virement_id } : {}),
    ...(ref && ref.evolution_id ? { evolution_id: ref.evolution_id } : {}),
    ...(ref && ref.commission_ref ? { commission_ref: ref.commission_ref } : {}),
    ...(ref && ref.loyer_depense_id ? { loyer_depense_id: ref.loyer_depense_id } : {}),
    ...(ref && ref.rdv_id ? { rdv_id: ref.rdv_id } : {}),
    ...(ref && ref.depense_id ? { depense_id: ref.depense_id } : {}),
    ...(ref && ref.tache_id ? { tache_user_id: ref.tache_user_id, tache_id: ref.tache_id } : {}),
    ...(ref && ref.prime_user_id ? { chantier_id: ref.chantier_id, prime_user_id: ref.prime_user_id } : {}),
    ...(ref && ref.attestation_user_id ? { attestation_user_id: ref.attestation_user_id } : {}),
    ...(prive ? { wa_prive: true } : {}),
    // 📎 Un reçu ou une proforma en PDF garde le message TEXTE qui le
    // remplacerait si Meta rejette le PDF après coup (lib/relaisRecuPdf.js) ;
    // jamais sur une ligne privée (une vente : le serveur recompose).
    ...champRelaisTexte(modele, ref, relais),
    ...prop,
    ...champsEnvoi(envoi),
  });
  return messagesAvecEntete([m, ...liste], {
    cle, tel, nom: nomClient, derniere: m.ts,
    proprietaire_id: prop.proprietaire_id || entete.proprietaire_id,
    proprietaire_nom: prop.proprietaire_nom || entete.proprietaire_nom,
  });
}

// ---------------------------------------------------------------
// 💬 RÉPONDRE À UN CLIENT DANS LA FENÊTRE DE 24 H (étape 2, 20/09/2026)
// ---------------------------------------------------------------
// ⚠ AUCUN REPLI ICI, et c'est VOULU — au contraire d'un modèle. Une
// relance qui n'est pas partie du numéro BMI peut finir à la main : le
// texte est le même, le client reçoit la même chose. Une RÉPONSE, non :
// elle doit arriver DANS la conversation WhatsApp qu'il a ouverte, sous
// le numéro BMI. L'ouvrir sur le téléphone du vendeur ferait partir le
// message d'un AUTRE numéro, et le client ne saurait pas qui lui écrit.
// Donc : ça part, ou ça ne part pas et on DIT pourquoi.
export async function repondreWhatsApp({ tel, texte, fichier = null }) {
  if (!enLigne()) return { parti: false, motif: "Pas de connexion : le message ne peut pas partir du numéro BMI." };
  // 🔁 Le filet anti-doublon vaut aussi pour une réponse (18/10/2026).
  const cle = cleEnvoi({ modele: "reponse_libre", tel, variables: [String(texte || "")], fichier });
  const maintenantMs = Date.now();
  nettoyerRegistre(registreEnvois, maintenantMs);
  const doublon = critiqueDoublon(registreEnvois, cle, maintenantMs);
  if (doublon) return { parti: false, motif: doublon, doublon: true };
  marquerEnCours(registreEnvois, cle, maintenantMs);
  let reponse;
  try {
    const { whatsappEnLigne } = await import("./supabaseClient");
    // 📎 Le fichier voyage codé, sans sa taille annoncée : le serveur la
    // remesure lui-même sur les octets reçus.
    reponse = await whatsappEnLigne({ tel, texte, fichier: fichier ? { nom: fichier.nom, mime: fichier.mime, donnees: fichier.donnees, ...(fichier.vocal ? { vocal: true } : {}) } : null });
  } catch (e) {
    oublierEnvoi(registreEnvois, cle);
    return { parti: false, motif: motifEchecWhatsApp({ erreur: e?.message }) };
  }
  if (!reponse || reponse.error) {
    oublierEnvoi(registreEnvois, cle);
    if (reponse?.error) console.info("[whatsapp] refus :", reponse.error, reponse.code_whatsapp || "");
    return { parti: false, motif: motifEchecWhatsApp({ statut: reponse?.statut, erreur: reponse?.error, code: reponse?.code_whatsapp }) };
  }
  marquerParti(registreEnvois, cle, Date.now());
  return { parti: true, motif: "", id: reponse.id || "", wamid: reponse.wamid || "" };
}

// ---------------------------------------------------------------
// 📎 PRÉPARER UN FICHIER À ENVOYER (03/10/2026)
// ---------------------------------------------------------------
// Une photo de téléphone pèse souvent 3 à 6 Mo : elle est RÉDUITE ici, dans
// le navigateur, avant de partir (1600 px au plus sur le grand côté, JPEG
// qualité 0,82 — bien lisible sur un téléphone, environ 300 Ko). Un document
// part tel quel : on ne touche jamais à un PDF. Une image que le navigateur
// ne sait pas lire (HEIC sur un PC) part telle quelle, comme document.
// Rend { nom, mime, taille, donnees } (donnees = le fichier codé en base64).
export const COTE_MAX_PHOTO = 1600;
const lireEnBase64 = (blob) => new Promise((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result || "").split(",")[1] || "");
  r.onerror = () => ko(r.error);
  r.readAsDataURL(blob);
});
async function reduirePhoto(file) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "") || typeof createImageBitmap !== "function") return null;
  if (file.size < 400 * 1024) return null; // déjà légère : on n'y touche pas
  try {
    const img = await createImageBitmap(file);
    const echelle = Math.min(1, COTE_MAX_PHOTO / Math.max(img.width, img.height));
    const toile = document.createElement("canvas");
    toile.width = Math.round(img.width * echelle);
    toile.height = Math.round(img.height * echelle);
    const ctx = toile.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, toile.width, toile.height); // un PNG transparent ne devient pas noir
    ctx.drawImage(img, 0, 0, toile.width, toile.height);
    const blob = await new Promise((ok) => toile.toBlob(ok, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return null;
    const nom = String(file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
    return { blob, nom, mime: "image/jpeg" };
  } catch { return null; }
}
export async function preparerFichier(file) {
  if (!file) return null;
  const reduite = await reduirePhoto(file);
  const blob = reduite ? reduite.blob : file;
  return {
    nom: reduite ? reduite.nom : String(file.name || "fichier"),
    mime: reduite ? reduite.mime : String(file.type || "application/octet-stream"),
    taille: blob.size,
    donnees: await lireEnBase64(blob),
  };
}

// ---------------------------------------------------------------
// 📷 OUVRIR UN FICHIER REÇU (photo, note vocale, document) — 20/09/2026
// ---------------------------------------------------------------
// ⚠ MÊME RÈGLE QUE LE RESTE DU FICHIER : un seul chemin. L'écran n'appelle
// pas le serveur lui-même, il passe par ici — et le banc l'impose.
// ⚠ La clé YCloud n'est pas dans le navigateur : c'est la fonction serveur
// qui va chercher le fichier chez WhatsApp, après avoir revérifié que cette
// personne a le droit de voir cette conversation.
// ---- 📇 ENREGISTRER LE CLIENT DANS LES CONTACTS GOOGLE DE BMI (09/10/2026) ----
// UN chemin, comme le reste : l'écran ne parle jamais au serveur lui-même.
// Rend { ok, deja, nom } ou { motif } — le motif est déjà en français.
export async function enregistrerContactGoogle({ cle, nom, tel }) {
  if (!enLigne()) return { motif: "Pas de connexion : le contact ne peut pas être enregistré maintenant." };
  let r;
  try {
    const { contactGoogleEnLigne } = await import("./supabaseClient");
    r = await contactGoogleEnLigne({ cle, nom, tel });
  } catch (e) {
    return { motif: motifReseau(e) };
  }
  if (r && r.ok) return { ok: true, deja: !!r.deja, nom: r.nom || nom };
  return { motif: (r && r.code && MOTIFS_CONTACT_GOOGLE[r.code]) || r?.error || MOTIFS_CONTACT_GOOGLE.google };
}

export async function chargerMediaWa(messageId) {
  if (!enLigne()) return { url: "", motif: "Pas de connexion : le fichier ne peut pas être ouvert." };
  let reponse;
  try {
    const { mediaWaEnLigne } = await import("./supabaseClient");
    reponse = await mediaWaEnLigne(messageId);
  } catch (e) {
    return { url: "", motif: motifReseau(e) };
  }
  if (!reponse || reponse.error || !reponse.blob) {
    return { url: "", motif: reponse?.error || "Fichier indisponible." };
  }
  return { url: URL.createObjectURL(reponse.blob), motif: "" };
}

// ---------------------------------------------------------------
// 🧾 UN REÇU QUI PART TOUT SEUL (25/09/2026)
// ---------------------------------------------------------------
// Le versement sur une dette et la réservation (📋 Dettes, 🏠 Clients
// installés, 💰 Ventes). UNE fonction pour les quatre gestes : le modèle part
// du numéro BMI SANS question et SANS repli (WhatsApp ne s'ouvre jamais), la
// ligne entre dans 📲 WhatsApp sans donner la conversation à personne. Rend
// la phrase à afficher discrètement (vide si rien à dire : pas de numéro,
// formation — le cas normal ne dérange personne).
// ---------------------------------------------------------------
// 📎 LE REÇU AVEC SON PDF (19/10/2026, Timo : « Ab, Ba, Cb, textes ok »)
// ---------------------------------------------------------------
// `recu_pdf` est essayé D'ABORD, sans case ni question (« B a »), avec le PDF
// du reçu imprimé (`fabriquer`, l'écran le fournit). Le reçu PDF se déduit du
// reçu en texte (`recuPdfDepuis`) — mêmes mots. Rend { auto, motif, incertain,
// rien } ; parti, la ligne entre dans 📲 WhatsApp (privée pour une vente). Ne
// part pas (pas encore approuvé, PDF impossible, réseau) : l'appelant envoie
// le reçu en texte d'aujourd'hui. ⚠ Rien en formation, rien sans numéro : on
// ne fabrique même pas le PDF (la règle refuserait l'envoi de toute façon).
export async function envoyerRecuPdf({ envoi, numero, fabriquer, tel, nom, espaceFormation, save, profile, ref = {} }) {
  const envoiPdf = recuPdfDepuis(envoi, { numero });
  if (!envoiPdf || typeof fabriquer !== "function" || espaceFormation || String(tel || "").replace(/\D/g, "").length < 8) return { auto: false, motif: "", rien: true };
  let fichier = null;
  try { fichier = await fabriquer(); } catch (e) { console.error("PDF du reçu à joindre :", e); }
  if (!fichier || !fichier.donnees) return { auto: false, motif: "le PDF du reçu n'a pas pu être fabriqué." };
  const r = await envoyerModele({ tel, modele: envoiPdf.modele, variables: envoiPdf.variables, espaceFormation, sansRepli: true, fichier });
  if (!r.auto) return { auto: false, motif: r.motif || "", incertain: !!r.reseau };
  if (typeof save === "function") {
    save((etat) => ({
      ...etat,
      messages: messagesAvecLigneEnvoi(etat.messages, { profile, tel, nom, modele: envoiPdf.modele, variables: envoiPdf.variables, ref, envoi: r, relais: envoi }),
    }));
  }
  return { auto: true, motif: "" };
}

export async function envoyerRecuSansQuestion({ envoi, tel, nom, espaceFormation, save, profile, ref = {}, noms = { titre: "Reçu", sujet: "Le reçu" }, pdf = null }) {
  if (!envoi) return "";
  // 📎 Le reçu avec son PDF d'abord (`pdf` = { numero, fabriquer }) ; le
  // texte d'aujourd'hui s'il ne part pas. Après une connexion coupée on ne
  // sait pas si le PDF est parti : le texte part quand même, et on le DIT.
  let notePdf = "";
  if (pdf) {
    const rp = await envoyerRecuPdf({ envoi, numero: pdf.numero, fabriquer: pdf.fabriquer, tel, nom, espaceFormation, save, profile, ref });
    if (rp.auto) return `📲 ${noms.titre} envoyé du numéro BMI à ${nom}, avec le PDF.`;
    if (rp.incertain) notePdf = ` ${lignePdfNonParti("", true)}`;
  }
  const r = await envoyerModele({ tel, modele: envoi.modele, variables: envoi.variables, espaceFormation, sansRepli: true });
  if (r.auto) {
    if (typeof save === "function") {
      save((etat) => ({
        ...etat,
        messages: messagesAvecLigneEnvoi(etat.messages, { profile, tel, nom, modele: envoi.modele, variables: envoi.variables, ref, envoi: r }),
      }));
    }
    return `📲 ${noms.titre} envoyé du numéro BMI à ${nom}.${notePdf}`;
  }
  return r.motif && !motifAttendu(r.motif) ? `${noms.sujet} n'est pas parti du numéro BMI : ${r.motif}${notePdf}` : notePdf.trim();
}
