// ============================================================
// api/whatsapp-entrant.js — LA RÉPONSE DU CLIENT REVIENT DANS L'APPLICATION
//
// Timo, 20/09/2026 : « le personnel lui répond depuis l'application BMI et
// les réponses vont directement dans l'espace du personnel qui a écrit ».
// C'est l'ÉTAPE 2 : YCloud appelle cette adresse dès qu'un client écrit au
// numéro BMI, et le message est rangé dans 💬 Messages.
//
// ⚠⚠ CETTE ADRESSE EST PUBLIQUE : n'importe qui sur Internet peut la
// solliciter. Elle n'accepte donc que les appels qui portent le SECRET
// (`WHATSAPP_WEBHOOK_SECRET`, variable Vercel, jamais préfixée VITE_) —
// sans lui, on fabriquerait un faux message d'un vrai client dans la base
// de BMI. Le secret voyage dans l'adresse elle-même, parce que YCloud ne
// laisse rien d'autre passer ; il ne s'écrit donc JAMAIS dans un journal.
//
// ⚠ CE QUE JE N'AI PAS PU VÉRIFIER D'ICI : la FORME exacte du paquet que
// YCloud envoie (leur documentation n'est pas joignable depuis ce poste).
// La lecture ci-dessous accepte donc les formes connues ET range ce qu'elle
// ne comprend pas dans la réponse, pour qu'on puisse l'ajuster au premier
// vrai message au lieu de deviner. Un paquet illisible n'est jamais perdu
// en silence : il répond 200 (sinon YCloud le renverrait sans fin) en
// disant ce qu'il n'a pas su lire.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { cleConversation, CANAL_WA, proprietaireDepuisDevis, proprietaireDe, MARQUE_RENDUE, lireMedia, libelleMedia, construireEntete } from "../src/lib/whatsappConversations.js";
import { numeroComparable } from "../src/lib/identiteClient.js";
import { estCompteFormation } from "../src/lib/espace.js";
import { numeroWhatsApp, alerteConseillerDe, critiqueNumeroAlerte, variablesAlerte, LANGUE_MODELES } from "../src/lib/whatsappModeles.js";
// 🤖 L'assistant (24/09/2026) : la règle vit dans lib/assistantWhatsapp.js,
// ce fichier ne fait que l'appeler, envoyer, et écrire ce qui est parti.
import { decisionAssistant, reponseAssistant, ligneAssistant, articlesPourAssistant, construireDemandeDevis, assistantActif, interpreterEntree, ETAPE_MENU, ETAPE_PRODUIT } from "../src/lib/assistantWhatsapp.js";
// 🤖 Niveau 3 (24/09/2026, « Lance avec ces trois réponses ») : l'assistant
// qui DISCUTE. La règle (consigne, outils, juge) vit dans lib/assistantIA.js,
// la porte réseau dans api/_assistantIA.js ; le menu reste le repli.
import { consignePour, messagesPourIA, executerOutil, converserAvecIA, garderReponse, reponseDepuisIA, conversationNouvelle, modeAssistant, demandeDevisIA, derniereEstimation } from "../src/lib/assistantIA.js";
// L'estimation solaire lit LA règle du vendeur et LA liste des appareils.
import { idDomaineSolaireDes, prixRailDesBoutiques, longueurRailDesBoutiques } from "../src/lib/choixSolaire.js";
import { fusionnerCatalogue } from "../src/lib/catalogueAppareils.js";
import { configIA, appelerIA } from "./_assistantIA.js";
import { configYCloud, envoyerYCloud, corpsTexte } from "./_ycloud.js";
// ✓✓ Les coches (26/09/2026) : la règle vit dans lib/suiviEnvoi.js.
import { lireStatut, statutApres, ligneAttendue, champsEnvoi, valeurSure } from "../src/lib/suiviEnvoi.js";
import { configurerWebPush, envoyerAuxPersonnes } from "./_push.js";

// Les formes que YCloud peut donner à un message entrant. On cherche le
// numéro, le texte et l'identifiant — le reste ne nous sert pas.
export function lireEntrant(corps) {
  const c = corps || {};
  const m = c.whatsappInboundMessage || c.inboundMessage || c.message || c.data || c;
  const from = m.from || m.wa_id || m.sender || c.from || "";
  // ⚠ LA RÈGLE DU FICHIER VIT DANS lib/whatsappConversations.js : elle est
  // exercée par le banc, elle n'est pas recopiée ici.
  const media = lireMedia(m);
  const ecrit = (typeof m.text === "string" ? m.text : m.text?.body) || m.body || "";
  // Une photo porte souvent sa légende : c'est ELLE le texte du message.
  // ⚠ Et si le type ne nous dit rien (une position, une fiche contact…),
  // on écrit quand même la ligne, avec le nom du type : un message perdu
  // en silence est pire qu'un message qu'on ne sait pas afficher.
  const texte = ecrit || (media ? media.legende : "") || (!media && m.type && m.type !== "text" ? `[${m.type}]` : "");
  const id = m.id || m.messageId || m.sid || "";
  const ts = m.timestamp || m.createTime || m.sendTime || "";
  return { from: String(from || ""), texte: String(texte || ""), media, id: String(id || ""), ts: String(ts || "") };
}

const horodatage = (brut) => {
  if (!brut) return new Date().toISOString();
  const n = Number(brut);
  // WhatsApp donne parfois des SECONDES depuis 1970, parfois une date.
  if (Number.isFinite(n) && n > 1e9) return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  const d = new Date(brut);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const attendu = process.env.WHATSAPP_WEBHOOK_SECRET;
  const donne = String(req.query?.cle || req.headers["x-bmi-cle"] || "");
  if (!attendu || donne !== attendu) return res.status(401).json({ error: "Appel non reconnu." });

  // ✓✓ UNE NOUVELLE DE SUIVI (envoyé, reçu, lu, échec) n'est pas un message
  // du client : elle met à jour la ligne partie du numéro BMI, rien d'autre.
  const suivi = lireStatut(req.body);
  if (suivi) return traiterSuivi(req, res, suivi);

  const { from, texte, media, id, ts } = lireEntrant(req.body);
  const cle = cleConversation(from);
  // ⚠ 200, jamais une erreur : YCloud renverrait le paquet en boucle. On
  // DIT ce qu'on n'a pas su lire — c'est ce qui permettra de l'ajuster.
  if (!cle) return res.status(200).json({ ignore: true, pourquoi: "numéro illisible", vu: Object.keys(req.body || {}) });
  // ⚠ 20/09/2026, décision « 3a » : une photo, une note vocale ou un
  // document ne sont PLUS refusés à l'entrée. Avant ce jour, le client
  // envoyait la photo de son compteur et personne ne savait qu'elle avait
  // existé. On ne refuse plus que ce qui ne porte RIEN du tout.
  if (!texte && !media) return res.status(200).json({ ignore: true, pourquoi: "message vide", de: cle, vu: Object.keys(req.body || {}) });

  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
  const admin = createClient(url, cleService, { auth: { persistSession: false } });

  try {
    const { data: lignes, error } = await admin.from("messages").select("id, data");
    if (error) throw error;
    const messages = (lignes || []).map((l) => ({ ...(l.data || {}), id: l.id }));

    // Le même message deux fois (YCloud réessaie quand il n'a pas eu de
    // réponse) ne s'écrit pas deux fois.
    if (id && messages.some((m) => m.wa_id === id)) return res.status(200).json({ deja: true });

    // ---- À QUI EST CETTE CONVERSATION ----
    // (1) ce que le fil dit déjà ; (2) sinon, qui lui a envoyé le dernier
    // devis du numéro BMI (la trace `envoi_whatsapp` existe depuis
    // l'étape 1) ; (3) sinon personne → SUPPORT, visible par tout le
    // personnel (décision « c » de Timo).
    const fil = messages.filter((m) => m.canal === CANAL_WA && m.wa_tel === cle)
      .sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
    // ⚠ DÉFAUT RÉPARÉ LE 24/09/2026 : cette boucle était écrite ici à la main
    // et ne connaissait pas la marque « rendue à tous » (`MARQUE_RENDUE`,
    // 21/09) : au message suivant du client, l'ANCIEN propriétaire était
    // reposé sur la ligne — la conversation se reconfiait toute seule, en
    // silence. On lit LA règle (`proprietaireDe`), qui s'arrête sur la marque.
    let proprietaire = proprietaireDe(fil);
    // Et le repli par le devis ne joue que si le fil n'a JAMAIS rien dit :
    // une conversation rendue à tous ne se redonne pas à l'auteur du devis.
    const filMuet = !fil.some((m) => m.proprietaire_id || m[MARQUE_RENDUE]);

    const { data: comptes, error: errU } = await admin.from("users").select("id, data");
    if (errU) throw errU;
    const client = (comptes || [])
      .map((l) => ({ ...(l.data || {}), id: l.id }))
      .find((u) => u.role === "client" && numeroComparable(u.tel) === cle);

    // ⚠ LA RÈGLE VIT DANS lib/whatsappConversations.js, elle n'est pas
    // recopiée ici : le banc l'exerce pour de vrai, et une règle écrite à
    // deux endroits finit par dire deux choses.
    if (!proprietaire.id && filMuet && client) {
      const employes = (comptes || []).map((l) => ({ ...(l.data || {}), id: l.id }));
      proprietaire = proprietaireDepuisDevis(client, employes);
    }

    const ligne = {
      id: `wa-${id || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: horodatage(ts).slice(0, 10),
      ts: horodatage(ts),
      canal: CANAL_WA,
      wa_tel: cle,
      wa_numero: String(from),
      wa_nom: client?.nom || "",
      wa_entrant: true,
      wa_id: id,
      de_id: null,
      de_nom: client?.nom || String(from),
      texte,
      // ⚠ ON GARDE LE LIEN, PAS LE FICHIER : il ne s'ouvre qu'avec la clé
      // YCloud, côté serveur (api/whatsapp-media.js). WhatsApp efface ses
      // fichiers au bout de 30 jours — l'écran le DIT le jour venu.
      ...(media ? { wa_media: media } : {}),
      lu_par: [],
      ...(proprietaire.id ? { proprietaire_id: proprietaire.id, proprietaire_nom: proprietaire.nom } : {}),
    };
    // ⚠ `updated_at` EST POSÉ ICI : c'est lui que la synchronisation compare
    // pour savoir qu'une ligne est nouvelle. Sans lui, le message existerait
    // dans la base sans jamais descendre sur les téléphones.
    const { error: errIns } = await admin.from("messages").insert({ id: ligne.id, data: ligne, updated_at: ligne.ts });
    if (errIns) throw errIns;

    // ---- 🔒 LA FICHE LÉGÈRE DE LA CONVERSATION (21/09/2026) ----
    // Décision « B » de Timo : une conversation confiée à quelqu'un ne
    // descend plus sur les autres téléphones (`securite-28`) — mais elle
    // doit s'y VOIR, grisée. Cette fiche est tout ce que les autres en
    // recevront : le numéro, le nom, à qui elle est confiée, la date.
    // ⚠ PAS UN MOT DU CONTENU, et c'est tout l'intérêt.
    // ⚠ Son id est DÉRIVÉ de la clé : un `upsert` la remplace, il n'en
    // empile pas une par message reçu.
    // ⚠ `updated_at` à la main, comme pour le message : sans lui la fiche
    // existerait dans la base sans jamais descendre sur les téléphones.
    const fiche = construireEntete({
      cle, tel: String(from), nom: client?.nom || "",
      proprietaire_id: proprietaire.id, proprietaire_nom: proprietaire.nom,
      derniere: ligne.ts,
    });
    if (fiche) {
      const { error: errFiche } = await admin.from("messages")
        .upsert({ id: fiche.id, data: fiche, updated_at: fiche.ts });
      // ⚠ Une fiche qui ne se pose pas ne doit PAS perdre le message : il
      // est déjà écrit, le client a bien été entendu. On le dit dans le
      // journal du serveur, on ne lève pas.
      if (errFiche) console.error("whatsapp-entrant : fiche de conversation non posée", errFiche);
    }

    // ---- 🤖 L'ASSISTANT RÉPOND, S'IL A QUELQUE CHOSE À DIRE (24/09/2026) ----
    // La règle entière (quand il se tait, ce qu'il dit) vit dans
    // lib/assistantWhatsapp.js. Ici : on lui donne la conversation et les
    // listes RÉELLES dont il a besoin, on envoie par la porte commune, et
    // RIEN N'EST ÉCRIT TANT QUE LE MESSAGE N'EST PAS PARTI.
    const { data: bqs } = await admin.from("boutiques").select("data");
    const boutiques = (bqs || []).map((b) => b.data || {});
    let assistant = { repondu: false, conseiller: false };
    try {
      assistant = await repondreParAssistant({ admin, boutiques, fil: [...fil, ligne], proprietaireId: proprietaire.id, cle, from, client, ligne });
    } catch (e) {
      // Un assistant qui trébuche ne perd JAMAIS le message du client : il
      // est déjà écrit, une personne le verra.
      console.error("[whatsapp-entrant] assistant", e?.message || e);
    }

    // ---- 👨‍💼 L'ALERTE WHATSAPP À L'ADMINISTRATEUR (25/09/2026) ----
    // Timo : « si un client demande d'être mis en relation, il envoie un
    // message WhatsApp automatiquement à moi l'administrateur ». Le modèle
    // `alerte_conseiller` part du numéro BMI vers le numéro réglé dans
    // ⚙ Paramètres. UNE fois par demande : c'est le tour où l'assistant PASSE
    // LA MAIN ; ensuite il se tait, et les messages suivants du client ne
    // repassent pas ici. ⚠ Une demande de DEVIS n'y est pas : elle a sa fiche
    // dans 🧲 Prospects et sa notification. ⚠ Une alerte qui ne part pas ne
    // perd rien : le message est écrit, la notification suit.
    if (assistant.repondu && assistant.conseiller && !assistant.devis) {
      try {
        await envoyerAlerteConseiller({ boutiques, client: client?.nom || ligne.wa_nom || "", numero: from });
      } catch (e) {
        console.error("[whatsapp-entrant] alerte conseiller", e?.message || e);
      }
    }

    // ---- 🔔 PRÉVENIR, SINON LA FENÊTRE SE FERME SANS QUE PERSONNE LE SACHE ----
    // ⚠ La règle « liste A » (13/09/2026) veut qu'un message de 💬 Messages
    // prévienne son destinataire. Ici le message n'arrive PAS par le
    // `save()` de l'application — il arrive par cette adresse — donc
    // `envoisDepuisSave` ne le verra jamais : c'est à ce fichier de le
    // faire, exactement comme la tournée du matin.
    // ⚠ SANS PROPRIÉTAIRE, on prévient les ADMINISTRATEURS, pas « tout le
    // personnel » : la conversation reste VISIBLE par tous (décision « c »),
    // mais faire vibrer quinze téléphones pour un message de support
    // rendrait les notifications inutiles en une semaine.
    // ⚠ Quand l'ASSISTANT a répondu et garde la main (menu, prix, besoin en
    // cours), personne n'est dérangé : le message est dans 📲 WhatsApp, et
    // faire vibrer un téléphone pour « 5 » tapé par un client rendrait les
    // notifications inutiles. Dès qu'il PASSE LA MAIN (conseiller, SAV,
    // demande de devis) ou qu'il se tait, on prévient comme avant.
    try {
      const tous = (comptes || []).map((l) => ({ ...(l.data || {}), id: l.id }));
      const destinataires = proprietaire.id
        ? [proprietaire.id]
        : tous.filter((u) => u.role === "admin" && u.actif !== false && !estCompteFormation({ users: tous, boutiques }, u)).map((u) => u.id);
      const aPrevenir = !assistant.repondu || assistant.conseiller;
      if (aPrevenir && destinataires.length && configurerWebPush()) {
        await envoyerAuxPersonnes(admin, [{
          destinataires,
          titre: assistant.devis ? `🧾 Demande de devis — ${assistant.nom || client?.nom || from}` : assistant.conseiller ? `👨‍💼 Demande un conseiller — ${client?.nom || from}` : `📲 ${client?.nom || from}`,
          texte: (texte || libelleMedia(media)).slice(0, 200),
          // ⚠ L'écran VISÉ, et il a changé le 20/09/2026 : les
          // conversations WhatsApp ont quitté 💬 Messages pour leur
          // propre onglet. Un clic qui ouvre le mauvais écran, c'est une
          // notification qui ne sert à rien.
          ecran: "whatsapp",
          tag: `wa-${cle}`,
        }]);
      }
    } catch (e) {
      // Une notification qui ne part pas ne doit JAMAIS perdre le message :
      // il est déjà écrit, il s'affichera à la prochaine ouverture.
      console.error("[whatsapp-entrant] notification", e?.message || e);
    }

    return res.status(200).json({ ok: true, de: cle, proprietaire: proprietaire.id || "support", assistant: assistant.repondu ? assistant.etape : `silence : ${assistant.pourquoi || ""}` });
  } catch (e) {
    // ⚠ On répond 200 quand même : sinon YCloud renvoie le paquet sans fin.
    // Le motif part dans le journal Vercel, pas dans la réponse.
    console.error("[whatsapp-entrant]", e?.message || e);
    return res.status(200).json({ ok: false, erreur: "enregistrement impossible" });
  }
}

// ---- 👨‍💼 L'ALERTE : le modèle, vers le numéro réglé ----
// Rend { envoye, pourquoi }. Rien n'est écrit dans la base : ce n'est pas
// une conversation avec un client.
async function envoyerAlerteConseiller({ boutiques, client, numero }) {
  const reglage = alerteConseillerDe(boutiques);
  if (!reglage) return { envoye: false, pourquoi: "aucun numéro réglé" };
  if (critiqueNumeroAlerte(reglage.tel)) return { envoye: false, pourquoi: "numéro réglé refusé" };
  const { cle: cleYCloud, expediteurBrut } = configYCloud();
  const expediteur = numeroWhatsApp(expediteurBrut);
  const destinataire = numeroWhatsApp(reglage.tel);
  if (!cleYCloud || !expediteur || !destinataire) return { envoye: false, pourquoi: "WhatsApp non configuré sur le serveur" };
  const valeurs = variablesAlerte({ administrateur: reglage.nom, client, numero: numeroWhatsApp(numero) || numero });
  const envoi = await envoyerYCloud(cleYCloud, {
    from: expediteur, to: destinataire, type: "template",
    template: { name: "alerte_conseiller", language: { code: LANGUE_MODELES }, components: [{ type: "body", parameters: valeurs.map((text) => ({ type: "text", text })) }] },
  });
  if (!envoi.ok) console.error("[whatsapp-entrant] alerte conseiller : WhatsApp a refusé", envoi.code_whatsapp, envoi.motif);
  return { envoye: !!envoi.ok, pourquoi: envoi.ok ? "" : envoi.motif };
}

// ---- 🤖 L'ASSISTANT, DU CÔTÉ SERVEUR ----
// Rend { repondu, conseiller, devis, etape } ou { repondu: false, pourquoi }.
// ⚠ LE MUR : les articles viennent des boutiques RÉELLES seulement
// (`articlesPourAssistant` les filtre sur la fiche de boutique) ; une
// demande de devis naît réelle. Les listes ne sont chargées QUE si l'étape
// en a besoin (chercher un article) : un « 5 » tapé ne lit pas les ventes.
async function repondreParAssistant({ admin, boutiques, fil, proprietaireId, cle, from, client, ligne }) {
  const decision = decisionAssistant({ fil, proprietaireId, actif: assistantActif(boutiques), maintenant: ligne.ts });
  if (!decision.repondre) return { repondu: false, pourquoi: decision.pourquoi };
  const nouvelle = conversationNouvelle(decision);
  const clientIA = client ? { nom: client.nom } : null;

  // Le stock (boutiques RÉELLES seulement, le mur) se charge à la demande,
  // UNE fois : quand l'IA appelle chercher_article, ou quand le menu peut
  // viser un article.
  let articlesCharges = null;
  let produitsBruts = null;
  const chargerProduits = async () => {
    if (!produitsBruts) {
      const { data: prods } = await admin.from("produits").select("id, data");
      produitsBruts = (prods || []).map((l) => ({ ...(l.data || {}), id: l.id }));
    }
    return produitsBruts;
  };
  const chargerArticles = async () => {
    if (articlesCharges) return articlesCharges;
    const [produits, { data: vts }, { data: ajs }] = await Promise.all([
      chargerProduits(),
      admin.from("ventes").select("id, data"),
      admin.from("ajustements").select("data"),
    ]);
    articlesCharges = articlesPourAssistant({
      produits,
      boutiques,
      ventes: (vts || []).map((l) => ({ ...(l.data || {}), id: l.id })),
      ajustements: (ajs || []).map((l) => l.data || {}),
    });
    return articlesCharges;
  };
  // ⚠ LE MUR : l'estimation ne regarde que les boutiques RÉELLES (une
  // boutique de formation a des prix d'entraînement) ; chacune chiffre avec
  // SON stock. Le catalogue des appareils est celui réglé sur une boutique
  // réelle, sinon la liste d'origine.
  const reelles = boutiques.filter((b) => b && b.nom && !b.formation);
  const contexteSolaire = async () => {
    const produits = await chargerProduits();
    const perso = (reelles.find((b) => Array.isArray(b.appareils_catalogue)) || {}).appareils_catalogue || [];
    return {
      catalogue: fusionnerCatalogue(perso),
      boutiquesSolaire: reelles.map((b) => ({
        nom: b.nom,
        produits: produits.filter((p) => p.boutique === b.nom),
        prixRail: prixRailDesBoutiques(reelles),
        longueurRail: longueurRailDesBoutiques(reelles),
        idDomaineSolaire: idDomaineSolaireDes(reelles),
      })),
    };
  };

  // ---- 🤖 D'ABORD L'IA, si elle est choisie ET configurée ----
  // Elle ne SAIT rien toute seule : les faits viennent des outils que CE
  // serveur exécute (`executerOutil`), et sa réponse passe par le juge
  // (`garderReponse`) avant de partir. Tout ce qui échoue — réseau, refus du
  // service, réponse jetée — retombe sur le menu, en le disant au journal.
  let r = null;
  const ia = configIA();
  if (modeAssistant(boutiques) === "ia" && ia.pret) {
    try {
      const conv = await converserAvecIA({
        consigne: consignePour({ client: clientIA, nouvelle }),
        messages: messagesPourIA(fil),
        appeler: (corps) => appelerIA(corps, ia),
        executer: async (nom, entree) => executerOutil(nom, entree, {
          articles: nom === "chercher_article" ? await chargerArticles() : [],
          client: clientIA,
          ...(nom === "estimer_solaire" ? await contexteSolaire() : {}),
        }),
      });
      const juge = garderReponse(conv.texte, { prixConnus: conv.effets.prix });
      r = reponseDepuisIA({ texte: conv.texte, effets: conv.effets, juge, nouvelle, nom: clientIA?.nom || "" });
      if (!juge.ok) console.error("[whatsapp-entrant] IA : réponse jetée —", juge.motif, r ? "(phrase fixe envoyée)" : "(le menu reprend)");
    } catch (e) {
      console.error("[whatsapp-entrant] IA indisponible, le menu reprend —", e?.message || e);
    }
  }

  // ---- LE MENU À CHIFFRES, comme avant, quand l'IA n'a rien donné ----
  if (!r) {
    // Le stock ne se charge que s'il peut servir : un message LIBRE (pas un
    // chiffre, pas « menu ») à l'accueil, au menu ou à l'étape « produit ».
    // ⚠ 24/09/2026 (capture Timo) : au menu aussi, parce qu'un client écrit
    // « combien coûte le panneau 400 » sans avoir tapé 5.
    const entree = interpreterEntree(ligne.texte);
    const peutViserLeStock = [null, undefined, ETAPE_MENU, ETAPE_PRODUIT].includes(decision.etape) && !entree.chiffre && !entree.menu && !entree.vide;
    const articles = peutViserLeStock ? await chargerArticles() : [];
    r = reponseAssistant({
      etape: decision.etape, texte: ligne.texte, media: ligne.wa_media || null,
      client: clientIA, articles, memoire: decision.memoire || {},
    });
    if (!r) return { repondu: false, pourquoi: "rien à dire" };
  }

  const { cle: cleYCloud, expediteurBrut } = configYCloud();
  const expediteur = numeroWhatsApp(expediteurBrut);
  const destinataire = numeroWhatsApp(from);
  if (!cleYCloud || !expediteur || !destinataire) return { repondu: false, pourquoi: "WhatsApp non configuré sur le serveur" };
  const envoi = await envoyerYCloud(cleYCloud, corpsTexte(expediteur, destinataire, r.texte));
  if (!envoi.ok) {
    // ⚠ Le motif part dans le journal du serveur (en anglais, tel que Meta
    // l'a dit) ; rien n'est écrit dans le fil : un fil qui ment est pire
    // qu'un fil vide.
    console.error("[whatsapp-entrant] assistant : WhatsApp a refusé", envoi.code_whatsapp, envoi.motif);
    return { repondu: false, pourquoi: `refus WhatsApp ${envoi.code_whatsapp || ""}` };
  }

  // La réponse se range APRÈS le message du client (une seconde plus tard
  // au moins), sinon le fil la lirait avant la question.
  const ts = new Date(Math.max(Date.now(), Date.parse(ligne.ts) + 1000)).toISOString();
  // L'estimation donnée se range dans la mémoire de la ligne : la demande de
  // devis d'un tour suivant la retrouve (derniereEstimation).
  const memoireR = r.estimation ? { ...(r.memoire || {}), estimation: r.estimation } : (r.memoire || null);
  const ligneR = { ...ligneAssistant({ cle, tel: from, nom: client?.nom || "", texte: r.texte, etape: r.etape, ts, memoire: memoireR, ia: !!r.ia }), ...champsEnvoi(envoi) };
  const { error: errIns } = await admin.from("messages").insert({ id: ligneR.id, data: ligneR, updated_at: ligneR.ts });
  if (errIns) throw errIns;

  let nom = "";
  if (r.demandeDevis) {
    const p = r.ia
      ? demandeDevisIA({ cle, tel: from, demandeDevis: r.demandeDevis, ts, estimation: r.estimation || derniereEstimation(fil) })
      : construireDemandeDevis({ cle, tel: from, nom: r.demandeDevis.nom, besoin: r.demandeDevis.besoin, ts });
    nom = p.nom;
    const { error: errP } = await admin.from("prospects").insert({ id: p.id, data: p, updated_at: ts });
    if (errP) console.error("[whatsapp-entrant] assistant : demande de devis non enregistrée", errP);
  }

  // La fiche légère suit (dernier message), SANS propriétaire : l'assistant
  // ne s'approprie rien.
  const fiche = construireEntete({ cle, tel: String(from), nom: client?.nom || "", proprietaire_id: "", proprietaire_nom: "", derniere: ts });
  if (fiche) {
    const { error: errFiche } = await admin.from("messages").upsert({ id: fiche.id, data: fiche, updated_at: fiche.ts });
    if (errFiche) console.error("whatsapp-entrant : fiche de conversation non posée", errFiche);
  }
  return { repondu: true, conseiller: !!r.conseiller, devis: !!r.demandeDevis, nom, etape: r.etape, ia: !!r.ia };
}

// ---------------------------------------------------------------
// ✓✓ LE SUIVI D'UN MESSAGE PARTI DU NUMÉRO BMI (26/09/2026)
// ---------------------------------------------------------------
// Timo : « pourquoi ça ne coche pas ? » → « oui, lance ». Meta prévient par
// cette adresse quand un message est parti, arrivé sur le téléphone, lu, ou
// refusé. On retrouve la ligne par son numéro de suivi et on y écrit l'état.
// ⚠ LES COCHES NE RECULENT JAMAIS (`statutApres`).
// ⚠ SEULE la ligne concernée est réécrite, et `updated_at` est posé À LA MAIN
// (dans la ligne ET dans la fiche), sinon l'état ne descendrait jamais sur
// les téléphones. Un téléphone qui réécrit ensuite la ligne (il la marque
// lue) passe par la fusion à trois de src/sync.js : l'état n'est pas perdu.
// ⚠ Une nouvelle arrivée AVANT la ligne (le téléphone qui a envoyé n'a pas
// fini d'écrire) : on répond 503 pour que YCloud la renvoie, pendant
// `ATTENTE_LIGNE_MIN` minutes seulement ; au-delà, 200 et on n'insiste pas.
async function traiterSuivi(req, res, suivi) {
  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
  const admin = createClient(url, cleService, { auth: { persistSession: false } });
  try {
    const conditions = [
      suivi.id ? `data->>wa_envoi_id.eq.${valeurSure(suivi.id)}` : "",
      suivi.wamid ? `data->>wa_wamid.eq.${valeurSure(suivi.wamid)}` : "",
    ].filter(Boolean).join(",");
    const { data: lignes, error } = await admin.from("messages").select("id, data").or(conditions).limit(1);
    if (error) throw error;
    const trouvee = lignes && lignes[0];
    if (!trouvee) {
      if (ligneAttendue(suivi)) return res.status(503).json({ attente: true, pourquoi: "ligne pas encore écrite" });
      return res.status(200).json({ ignore: true, pourquoi: "message inconnu (parti avant le suivi, ou par le repli)" });
    }
    const nouveau = statutApres(trouvee.data?.wa_statut, suivi);
    if (!nouveau) return res.status(200).json({ deja: true, etat: trouvee.data?.wa_statut?.etat || "" });
    const ts = new Date().toISOString();
    const data = { ...(trouvee.data || {}), wa_statut: nouveau, updated_at: ts };
    const { error: errMaj } = await admin.from("messages").update({ data, updated_at: ts }).eq("id", trouvee.id);
    if (errMaj) throw errMaj;
    return res.status(200).json({ ok: true, etat: nouveau.etat });
  } catch (e) {
    console.error("[whatsapp-entrant] suivi", e?.message || e);
    // 200 : une nouvelle de suivi perdue ne coûte qu'une coche.
    return res.status(200).json({ ok: false, erreur: "suivi non enregistré" });
  }
}
