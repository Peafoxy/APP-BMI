// ============================================================
// screens/Whatsapp.jsx — LES CONVERSATIONS WHATSAPP, À PART
//
// Timo, 20/09/2026, capture de 💬 Messages : « dans conversation, on peut
// séparer WhatsApp et message interne à l'app ? » → décision « b » : un
// ÉCRAN à part, pas deux onglets dans la même liste.
//
// ⚠ POURQUOI ÇA COMPTE, et ce n'est pas qu'une question de rangement : sur
// sa capture, ESSO le CLIENT (WhatsApp) et ESSO le TECHNICIEN (équipe) se
// suivaient dans la même liste. Deux ESSO, deux mondes, une seule liste —
// c'est exactement la confusion du matin même, à l'écran cette fois.
//
// ⚠⚠ UNE CONVERSATION WHATSAPP A UN COMPTE À REBOURS (24 h), les internes
// non. C'est la vraie raison de la séparation : ce qui se ferme tout seul
// ne se range pas avec ce qui attend. D'où le compteur DANS LE NOM DE
// L'ONGLET (App.jsx) — derrière un onglet qu'on ne regarde pas, une fenêtre
// se fermerait sans que personne le sache.
//
// ⚠ Les RÈGLES ne sont pas ici : elles vivent dans lib/whatsappConversations.js
// (qui voit quoi, la fenêtre, le refus) et l'envoi dans src/whatsapp.js —
// cet écran ne fait que les montrer. Rien n'a changé d'elles en déménageant.
// ============================================================
import React, { useState, useEffect, useRef } from "react";
import { dFR, today, nouveauMessage } from "../lib/core";
import { Field, inputCls, champRecherche, uAlert, uChoix, uConfirm } from "../components/ui";
import { ChampSuggestions } from "../components/ChampSuggestions";
import { HistoriqueArchive } from "../components/HistoriqueArchive";
import { correspond } from "../lib/suggestions";
import { utilisateursDeLEspace, estCompteFormation, espaceDuCompte } from "../lib/calculs";
import { motsDuNumero } from "../lib/clientsConnus";
import { separerNonLues } from "../lib/conversations";
import { estLigneAssistant, NOM_ASSISTANT } from "../lib/assistantWhatsapp";
import { conversationsWa, critiqueReponse, libelleFenetre, peutReattribuer, aAccesWhatsapp, libelleMedia, motifVerrouillee, messagesAvecEntete, idEntete, MARQUE_RENDUE, CANAL_WA, cleConversation, MOTIF_WA_FORMATION } from "../lib/whatsappConversations";
import { texteContact, texteAccesAffiche } from "../lib/whatsappModeles";
import { motDePasseConnu } from "../lib/comptesClients";
import { envoyerModele, repondreWhatsApp, chargerMediaWa } from "../whatsapp";

// Libellé du rôle, pour la question « à qui confier ». Même mots que
// 💬 Messages — un rôle ne se nomme pas de deux façons dans l'application.
const libelleRole = (role) =>
  role === "admin" ? "Admin" : role === "gerant" ? "Gérant" : role === "magasinier" ? "Magasinier"
  : role === "commercial" ? "Commercial" : role === "technicien" ? "Technicien"
  : role === "technicien_bmi" ? "Technicien BMI" : role === "resp_commercial" ? "Resp. Commercial"
  : role === "comptable" ? "Comptable" : role === "client" ? "Client" : "Vendeur";

// ---- LES MESSAGES D'UNE CONVERSATION, ET CEUX QU'ON N'A PAS LUS ----
// ⚠ Écrit UNE fois et exporté : App.jsx s'en sert pour le compteur de
// l'onglet. Deux façons de compter finiraient par afficher deux chiffres.
export const filWa = (messages, cle) =>
  (messages || []).filter((m) => m.canal === CANAL_WA && m.wa_tel === cle)
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

// ⚠ LE MUR DE LA VISIBILITÉ TIENT ICI AUSSI : on ne compte que les
// conversations que CETTE personne a le droit de voir (`conversationsWa`
// les a déjà filtrées). Un commercial ne doit pas voir une pastille rouge
// pour une conversation qu'il ne peut même pas ouvrir.
export function compterNonLusWa(db, profile) {
  if (!aAccesWhatsapp(profile)) return 0;
  const messages = db.messages || [];
  // 🎓 L'espace REGARDÉ (jamais celui du compte : l'administrateur principal
  // est un compte réel même quand il regarde la formation). En formation, le
  // compteur de l'onglet reste à zéro — décision « B », 22/09/2026.
  const espaceFormation = espaceDuCompte(db, profile) === true;
  return conversationsWa(messages, profile, undefined, { espaceFormation }).reduce(
    // ⚠ UNE CONVERSATION GRISÉE NE COMPTE POUR RIEN (21/09/2026) : mettre
    // une pastille rouge à quelqu'un pour un message qu'il ne peut pas
    // ouvrir, c'est lui demander d'aller voir ailleurs.
    (n, c) => n + (c.verrouillee ? 0 : filWa(messages, c.cle).filter((m) => m.de_id !== profile.id && !(m.lu_par || []).includes(profile.id)).length),
    0
  );
}

export function Whatsapp({ db, save, profile }) {
  const messages = db.messages || [];
  const [cleOuverte, setCleOuverte] = useState(null);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [contact, setContact] = useState(null);
  const [recherche, setRecherche] = useState("");

  // ⚠ Ce que la règle rend est DÉJÀ filtré : un commercial ou un technicien
  // à commission n'y trouve que ce qu'il a engagé, plus le support que
  // personne n'a engagé (décision « c » de Timo). ⚠ Mais c'est un filtre
  // d'AFFICHAGE : la table des messages n'est pas cloisonnée par personne
  // côté serveur — c'est dit à Timo, ce n'est pas caché.
  // ⚠ LE MUR : les personnes passent par `utilisateursDeLEspace` — la table
  // des comptes n'est PAS cloisonnée par le serveur, ce filtre est la SEULE
  // barrière. Jamais `db.users` en entier.
  const comptesEspace = aAccesWhatsapp(profile) ? utilisateursDeLEspace(db, profile) : [];
  const aQui = comptesEspace
    .filter((u) => u.role === "client" && u.actif !== false && String(u.tel || "").trim())
    .map((u) => ({ valeur: u.nom_base || u.nom, tel: u.tel, mots: motsDuNumero(u.tel), detail: u.tel }));

  // 🎓 LES CONVERSATIONS N'EXISTENT QU'EN RÉEL (décision « B », 22/09/2026) :
  // c'est l'espace REGARDÉ qui décide, et la règle reçoit ce booléen — elle
  // ne peut pas le calculer elle-même (le serveur la lit).
  const regardeFormation = espaceDuCompte(db, profile) === true;
  const tousConvs = aAccesWhatsapp(profile) ? conversationsWa(messages, profile, undefined, { espaceFormation: regardeFormation }) : [];
  // ⚠ LA RÈGLE COMMUNE `correspond` (lib/suggestions.js), comme partout
  // ailleurs — jamais un filtre maison. Elle cherche le NOM et le NUMÉRO :
  // « 90112233 », « +228 90 11 22 33 » et « 228 » trouvent la même
  // conversation (`motsDuNumero`, la règle des 16/09 et 18/09).
  // ⚠⚠ ET ELLE CHERCHE DANS TOUT, ARCHIVES COMPRISES : une recherche qui
  // ne regarde que ce qui est affiché ment — on chercherait justement une
  // vieille conversation qu'on ne voit plus.
  const convs = !recherche.trim() ? tousConvs
    : tousConvs.filter((c) => correspond(`${c.nom || ""} ${motsDuNumero(c.tel).join(" ")}`, recherche));
  const ouverte = convs.find((c) => c.cle === cleOuverte) || null;
  const fil = ouverte ? filWa(messages, ouverte.cle) : [];

  // ⚠ Une conversation GRISÉE ne porte ni fil ni non-lus : sa date vient de
  // sa fiche légère (`c.derniere`), la seule chose qu'on ait d'elle.
  const nonLusPour = (c) => (c.verrouillee ? 0 : filWa(messages, c.cle).filter((m) => m.de_id !== profile.id && !(m.lu_par || []).includes(profile.id)).length);
  const derniereActivite = (c) => {
    if (c.verrouillee) return String(c.derniere || "");
    const f = filWa(messages, c.cle);
    return f.length ? String(f[f.length - 1].ts || "") : String(c.derniere || "");
  };

  // ⚠ LE MÊME CLASSEMENT QUE 💬 MESSAGES, par LA règle commune (14/09/2026,
  // « un nouveau message apparaît en tête ») : un bloc « 🔴 Nouveaux
  // messages », puis le reste. Un second tri maison finirait par classer
  // autrement d'un écran à l'autre.
  const liste = separerNonLues(
    [{ cle: "whatsapp", items: convs.map((c) => ({ cle: c.cle, conv: { type: "wa", id: c.cle }, wa: c })) }],
    (conv) => { const c = convs.find((x) => x.cle === conv.id); return c ? nonLusPour(c) : 0; },
    (conv) => { const c = convs.find((x) => x.cle === conv.id); return c ? derniereActivite(c) : ""; }
  );
  // ⚠⚠ L'ARCHIVAGE NE TOUCHE QUE LES CONVERSATIONS LUES. `separerNonLues`
  // a déjà sorti celles qui portent un non lu : un client qui attend une
  // réponse ne doit JAMAIS disparaître derrière un bouton « archives »,
  // même si son message a trois mois. C'est le point le plus important de
  // ce point-ci, et le banc l'éprouve.
  const lues = liste.sections[0]?.items || [];

  // ---- 🔒 LES CONVERSATIONS D'AVANT LA FICHE LÉGÈRE (21/09/2026) ----
  // ⚠⚠ SANS CE RATTRAPAGE, LA RÈGLE MENTIRAIT LE PREMIER JOUR : les
  // conversations qui existaient déjà n'ont pas de fiche, donc elles
  // DISPARAÎTRAIENT chez les autres au lieu d'apparaître grisées — c'est
  // exactement ce que Timo a refusé (« pas juste la faire disparaître »).
  // Elles ne reviendraient qu'au message suivant.
  // ⚠ C'est l'ADMINISTRATEUR qui les pose, et lui seul : il est le seul à
  // voir TOUTES les conversations, donc le seul à pouvoir en poser un jeu
  // complet. Une fois par ouverture d'écran, et seulement s'il en manque.
  const rattrape = useRef(false);
  useEffect(() => {
    if (rattrape.current || !peutReattribuer(profile)) return;
    const manquantes = tousConvs.filter((c) => !c.verrouillee && !messages.some((m) => m.id === idEntete(c.cle)));
    if (!manquantes.length) return;
    rattrape.current = true;
    let liste = messages;
    manquantes.forEach((c) => {
      liste = messagesAvecEntete(liste, {
        cle: c.cle, tel: c.tel, nom: c.nom,
        proprietaire_id: c.proprietaire_id, proprietaire_nom: c.proprietaire_nom,
        derniere: c.derniere,
      });
    });
    save({ ...db, messages: liste });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tousConvs.length]);

  const ouvrir = (c) => {
    // ⚠ REVÉRIFIÉ DANS LE GESTE, comme partout : l'écran grise la ligne,
    // mais c'est ici qu'on refuse — et le refus NOMME la personne à qui la
    // conversation est confiée, pour qu'on sache à qui la demander.
    if (c.verrouillee) { uAlert(motifVerrouillee(c)); return; }
    setCleOuverte(c.cle);
    const aLire = filWa(messages, c.cle).filter((m) => m.de_id !== profile.id && !(m.lu_par || []).includes(profile.id));
    if (aLire.length > 0) {
      const ids = new Set(aLire.map((m) => m.id));
      save({ ...db, messages: messages.map((m) => (ids.has(m.id) ? { ...m, lu_par: [...(m.lu_par || []), profile.id] } : m)) });
    }
  };

  // ---- 📲 RÉPONDRE À UN CLIENT SUR WHATSAPP ----
  // ⚠ REVÉRIFIÉ DANS LE GESTE : la fenêtre de 24 h a pu se fermer pendant
  // que l'écran était ouvert. Et le serveur la revérifie une troisième fois
  // sur la base — c'est lui qui a le dernier mot, parce que l'écran peut se
  // tromper, la base non.
  // ⚠ ON N'ÉCRIT DANS LA BASE QUE SI LE MESSAGE EST PARTI. Écrire d'abord
  // ferait croire au vendeur qu'il a répondu alors que le client n'a rien
  // reçu : un fil qui ment est pire qu'un fil vide.
  // 🔑 LA LIGNE « ACCÈS ENVOYÉS » (23/09/2026) : le texte rangé porte ses deux
  // trous masqués ; le créateur et l'administrateur les voient remplis, à
  // partir de la fiche du client (le mot de passe est RECALCULÉ, jamais lu
  // dans la conversation). Les autres lisent « •••••• ». La fiche vient de
  // l'espace regardé, jamais de db.users en entier.
  const texteDuFil = (m) => {
    if (!m || !m.wa_acces) return m ? m.texte : "";
    const client = utilisateursDeLEspace(db, profile).find((u) => u.id === m.wa_acces.client_id);
    return texteAccesAffiche(m, profile, client ? { identifiant: client.nom, motDePasse: motDePasseConnu(client) } : null);
  };

  const envoyer = async () => {
    const t = texte.trim();
    if (!t || !ouverte || envoi) return;
    const refus = critiqueReponse({ profile, conv: ouverte, texte: t, enLigne: navigator.onLine !== false, espaceFormation: regardeFormation });
    if (refus) { uAlert(refus); return; }
    setEnvoi(true);
    const r = await repondreWhatsApp({ tel: ouverte.tel, texte: t });
    setEnvoi(false);
    if (!r.parti) { uAlert(r.motif || "Le message n'est pas parti."); return; }
    const m = nouveauMessage(profile, {
      canal: CANAL_WA, wa_tel: ouverte.cle, wa_numero: ouverte.tel,
      ...(ouverte.nom ? { wa_nom: ouverte.nom } : {}),
      wa_id: r.id || "", texte: t,
      ...(ouverte.proprietaire_id ? { proprietaire_id: ouverte.proprietaire_id, proprietaire_nom: ouverte.proprietaire_nom } : {}),
    });
    // ⚠ LA FICHE LÉGÈRE SUIT LE FIL (21/09/2026) : sans ce geste, une
    // conversation qui n'a jamais reçu de message entrant depuis le
    // correctif resterait invisible aux autres au lieu d'apparaître grisée.
    save({ ...db, messages: messagesAvecEntete([m, ...messages], {
      cle: ouverte.cle, tel: ouverte.tel, nom: ouverte.nom,
      proprietaire_id: ouverte.proprietaire_id, proprietaire_nom: ouverte.proprietaire_nom,
      derniere: m.ts,
    }) });
    setTexte("");
  };

  // ---- ✍️ ÉCRIRE LE PREMIER À QUELQU'UN (20/09/2026) ----
  // Timo : « comment engager une 1re discussion WhatsApp avec quelqu'un qui
  // n'a jamais écrit à BMI depuis l'application ». Hors de la fenêtre de
  // 24 h, Meta n'accepte QU'UN MODÈLE APPROUVÉ — et les quatre premiers
  // parlent tous d'un devis. D'où `prise_de_contact`, qui n'en parle pas.
  //
  // ⚠⚠ ET C'EST L'ENVOI QUI DONNE LA CONVERSATION À SON AUTEUR : le message
  // sortant porte `proprietaire_id`, donc la réponse du client arrivera
  // « dans l'espace du personnel qui a écrit » (sa demande de l'étape 2, mot
  // pour mot) sans attendre une trace de devis.
  // ⚠ La fenêtre de 24 h N'EST PAS ouverte par notre message : seul un
  // message ENTRANT l'ouvre. La conversation apparaît donc « fenêtre
  // fermée » tant que le client n'a pas répondu — et l'écran le dit, plutôt
  // que de laisser croire qu'on peut enchaîner.
  const envoyerContact = async () => {
    const nom = String(contact?.nom || "").trim();
    const tel = String(contact?.tel || "").trim();
    const sujet = String(contact?.sujet || "").trim();
    if (!tel) { uAlert("Dites à quel numéro écrire."); return; }
    if (!sujet) { uAlert("Dites de quoi il s'agit : c'est ce que le client lira après « concernant »."); return; }
    if (contact.envoi) return;
    const client = comptesEspace.find((u) => u.role === "client" && cleConversation(u.tel) === cleConversation(tel));
    const message = texteContact({ client: nom || client?.nom, auteur: profile.nom, sujet });
    if (!(await uConfirm(`Envoyer ce message du numéro BMI à ${nom || tel} ?\n\n${message}`))) return;
    setContact((c) => ({ ...c, envoi: true }));
    // ⚠ LE MUR : c'est l'espace du DESTINATAIRE qui décide quand on le
    // connaît — l'administrateur principal est un compte RÉEL même quand il
    // regarde la formation (leçon de `retenueOutilPourPrime`, 18/09). Sur un
    // numéro libre, on retombe sur l'espace REGARDÉ.
    const r = await envoyerModele({
      tel,
      modele: "prise_de_contact",
      variables: [nom || client?.nom || "cher client", profile.nom, sujet],
      espaceFormation: client ? estCompteFormation(db, client) : espaceDuCompte(db, profile),
      // ⚠ PAS de `premierContact` ici, et c'est tout le point : cette règle
      // existe parce que le premier message d'un client porte ses
      // IDENTIFIANTS, qu'un modèle ne peut pas porter. Celui-ci n'en porte
      // aucun — il n'y a donc rien à protéger.
      texteRepli: message,
      demanderConfirmation: uConfirm,
    });
    setContact((c) => (c ? { ...c, envoi: false } : c));
    if (!r.parti) { uAlert(r.motif || "Le message n'est pas parti."); return; }
    // ⚠ RIEN N'EST ÉCRIT TANT QUE LE MESSAGE N'EST PAS PARTI (règle de
    // l'étape 2) — et on n'écrit le fil QUE s'il est parti du numéro BMI :
    // une ouverture WhatsApp part d'un AUTRE numéro, le client ne répondrait
    // pas à BMI et la conversation mentirait.
    if (!r.auto) {
      uAlert(`${r.motif ? r.motif + "\n\n" : ""}WhatsApp s'est ouvert avec le texte : le message part de VOTRE numéro, la réponse du client n'arrivera donc pas ici.`);
      setContact(null);
      return;
    }
    const m = nouveauMessage(profile, {
      canal: CANAL_WA, wa_tel: cleConversation(tel), wa_numero: tel,
      ...(nom || client?.nom ? { wa_nom: nom || client.nom } : {}),
      wa_id: r.id || "", texte: message,
      proprietaire_id: profile.id, proprietaire_nom: profile.nom,
    });
    save({ ...db, messages: messagesAvecEntete([m, ...messages], {
      cle: cleConversation(tel), tel, nom: nom || client?.nom,
      proprietaire_id: profile.id, proprietaire_nom: profile.nom,
      derniere: m.ts,
    }) }, `📲 WhatsApp — premier message à ${nom || tel} par ${profile.nom}`);
    setContact(null);
    setCleOuverte(cleConversation(tel));
  };

  // ---- 🔁 CONFIER LA CONVERSATION À QUELQU'UN D'AUTRE (décision « a ») ----
  // ⚠ RIEN N'EST RÉÉCRIT : on POSE une ligne de plus, qui porte le nouveau
  // propriétaire et se lit dans le fil. Un message ne se modifie jamais
  // après coup — c'est la trace, et elle ne rétrécit pas.
  // ⚠ Répondre ne s'approprie PAS une conversation : seul ce geste-ci
  // change le propriétaire. Sinon le premier qui répond à un client du
  // support le ferait disparaître pour tous les autres.
  const reattribuer = async () => {
    if (!ouverte) return;
    if (!peutReattribuer(profile)) { uAlert("Seul un administrateur peut confier une conversation à quelqu'un d'autre."); return; }
    const gens = utilisateursDeLEspace(db, profile).filter((u) => u.actif !== false && u.role !== "client");
    if (!gens.length) { uAlert("Aucun membre de l'équipe à qui la confier."); return; }
    const noms = gens.map((u) => `${u.nom} — ${libelleRole(u.role)}`);
    const choix = await uChoix(`📲 Confier la conversation de ${ouverte.nom || ouverte.tel} à qui ?`, noms);
    if (choix === null) return;
    const u = gens[noms.indexOf(choix)];
    if (!u) return;
    const m = nouveauMessage(profile, {
      canal: CANAL_WA, wa_tel: ouverte.cle, wa_numero: ouverte.tel,
      ...(ouverte.nom ? { wa_nom: ouverte.nom } : {}),
      wa_systeme: true,
      texte: `🔁 Conversation confiée à ${u.nom} par ${profile.nom}.`,
      proprietaire_id: u.id, proprietaire_nom: u.nom,
    });
    // ⚠ C'EST LE GESTE QUI FERME LA PORTE : à partir de cette ligne, les
    // autres ne verront plus que la fiche légère — le nom du client, et à
    // qui la conversation est confiée. Rien du contenu.
    save({ ...db, messages: messagesAvecEntete([m, ...messages], {
      cle: ouverte.cle, tel: ouverte.tel, nom: ouverte.nom,
      proprietaire_id: u.id, proprietaire_nom: u.nom,
      derniere: m.ts,
    }) }, `📲 WhatsApp — conversation de ${ouverte.nom || ouverte.tel} confiée à ${u.nom} par ${profile.nom}`);
  };

  // ---- 🔓 RENDRE LA CONVERSATION À TOUT LE MONDE (21/09/2026) ----
  // Timo : « donner la possibilité à l'administrateur de rendre la
  // discussion déjà confiée à redevenir accessible à tous les
  // utilisateurs ». Une conversation confiée à quelqu'un qui part en congé
  // n'avait aucune porte de sortie — on ne pouvait que la donner à un autre.
  // ⚠ RIEN N'EST RÉÉCRIT : on pose une ligne qui porte la MARQUE, et
  // `proprietaireDe` s'y arrête en remontant. L'histoire reste entière, on
  // lit encore à qui elle avait été confiée et par qui.
  const rendreATous = async () => {
    if (!ouverte) return;
    if (!peutReattribuer(profile)) { uAlert("Seul un administrateur peut rendre une conversation à tout le monde."); return; }
    // ⚠ Un bouton qui ne commande rien ne s'affiche pas : sans propriétaire,
    // il n'y a rien à rendre. Revérifié ici, comme partout.
    if (!ouverte.proprietaire_id) { uAlert("Cette conversation n'est confiée à personne : tout le personnel la voit déjà."); return; }
    const qui = ouverte.proprietaire_nom || "quelqu'un";
    if (!(await uConfirm(`Rendre la conversation de ${ouverte.nom || ouverte.tel} à tout le personnel ?\n\nElle n'appartiendra plus à ${qui} : chacun pourra l'ouvrir et y répondre, comme un client du support.`))) return;
    const m = nouveauMessage(profile, {
      canal: CANAL_WA, wa_tel: ouverte.cle, wa_numero: ouverte.tel,
      ...(ouverte.nom ? { wa_nom: ouverte.nom } : {}),
      wa_systeme: true,
      texte: `🔓 Conversation rendue à tout le personnel par ${profile.nom}.`,
      [MARQUE_RENDUE]: true,
    });
    // ⚠ LA FICHE LÉGÈRE SUIT : sans propriétaire, la ligne cesse d'être
    // grisée chez les autres. Elle est REMPLACÉE (même id), donc l'ancien
    // propriétaire n'y reste pas.
    save({ ...db, messages: messagesAvecEntete([m, ...messages], {
      cle: ouverte.cle, tel: ouverte.tel, nom: ouverte.nom, derniere: m.ts,
    }) }, `📲 WhatsApp — conversation de ${ouverte.nom || ouverte.tel} rendue à tout le personnel par ${profile.nom}`);
  };

  // 🎓 En formation, l'écran le DIT au lieu d'afficher une liste vide qui
  // ressemblerait à une panne. ⚠ Placé APRÈS tous les hooks : un retour
  // anticipé avant un hook est un écran blanc (piège du § 5).
  if (regardeFormation) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center" data-whatsapp="formation">
        <div className="font-bold text-slate-800">📲 WhatsApp</div>
        <div className="mt-2 text-sm text-slate-600">{MOTIF_WA_FORMATION}</div>
        <div className="mt-1 text-xs text-slate-400">Repassez en réel (⚙ Paramètres → 👁 Je regarde) pour retrouver les conversations.</div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      {/* Liste des conversations (sur mobile : masquée quand un fil est ouvert) */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${ouverte ? "hidden lg:block" : ""}`}>
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <span>📲 WhatsApp</span>
          <button onClick={() => setContact(contact ? null : { nom: "", tel: "", sujet: "" })}
            className="text-xs font-bold text-sky-800 underline whitespace-nowrap">{contact ? "Annuler" : "✍️ Écrire"}</button>
        </div>
        {contact && (
          <div className="border-b border-slate-200 bg-sky-50/60 p-3 space-y-2">
            <Field label="À qui ?">
              <ChampSuggestions valeur={contact.nom} onChange={(v) => setContact({ ...contact, nom: v })}
                onChoisir={(c) => setContact({ ...contact, nom: c.valeur, tel: c.tel || contact.tel })}
                suggestions={aQui} placeholder="Nom du client" />
            </Field>
            <Field label="Numéro">
              <input className={inputCls} type="tel" value={contact.tel} onChange={(e) => setContact({ ...contact, tel: e.target.value })} placeholder="+228 ..." />
            </Field>
            <Field label="De quoi s'agit-il ?">
              <input className={inputCls} value={contact.sujet} onChange={(e) => setContact({ ...contact, sujet: e.target.value })} placeholder="votre installation solaire" />
            </Field>
            {/* ⚠ L'APERÇU EST LE MESSAGE LUI-MÊME : on ne fait jamais partir
                au nom de BMI un texte que personne n'a relu. */}
            <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600 whitespace-pre-line">
              {texteContact({ client: contact.nom, auteur: profile.nom, sujet: contact.sujet || "…" })}
            </div>
            <button onClick={envoyerContact} disabled={contact.envoi || !contact.tel.trim() || !contact.sujet.trim()}
              className="w-full px-4 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 disabled:opacity-50">
              {contact.envoi ? "Envoi…" : "Envoyer du numéro BMI"}
            </button>
            <div className="text-[11px] text-slate-500">
              Le client pourra répondre ici. Tant qu'il n'a pas répondu, WhatsApp n'accepte pas d'autre message libre.
            </div>
          </div>
        )}
        {tousConvs.length > 0 && (
          <div className="px-3 py-2 border-b border-slate-100">
            <input className={champRecherche} value={recherche} onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une conversation..." />
          </div>
        )}
        <div>
          {liste.nonLues.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs font-bold text-red-700 uppercase bg-red-50" data-whatsapp="nouveaux">🔴 Nouveaux messages</div>
              <table className="w-full"><tbody>
                {liste.nonLues.map((it) => <LigneWa key={"nouveau" + it.cle} item={it} cleOuverte={cleOuverte} ouvrir={ouvrir} />)}
              </tbody></table>
            </>
          )}
          {lues.length > 0 && (
            <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50" data-whatsapp="conversations">Conversations</div>
          )}
          {/* ⚠ LA RÈGLE D'ARCHIVAGE EST CELLE DE TIMO (13/09/2026), par SON
              composant : 10 lignes puis on défile, et au-delà des 20 plus
              récentes une conversation sans activité depuis 3 mois passe
              dans « 📁 Archives ». Aucun tri, aucun `slice` maison ici. */}
          {lues.length > 0 && (
            <HistoriqueArchive
              lignes={lues}
              dateDe={(it) => derniereActivite(it.conv)}
              aujourdhui={today()}
              titreArchives="Conversations anciennes"
              rendre={(it) => <LigneWa key={it.cle} item={it} cleOuverte={cleOuverte} ouvrir={ouvrir} />}
              vide="Aucune conversation."
              classeTable="w-full"
            />
          )}
          {tousConvs.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-400 text-center">
              Aucune conversation WhatsApp pour l'instant.
              <div className="mt-2 text-xs">Elles apparaissent ici dès qu'un client répond à un message parti du numéro BMI.</div>
            </div>
          )}
          {tousConvs.length > 0 && convs.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-400 text-center">Aucune conversation ne correspond à « {recherche} ».</div>
          )}
        </div>
      </div>

      {/* Fil de la conversation (sur mobile : affiché seulement quand un fil est ouvert) */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm flex-col ${ouverte ? "flex" : "hidden lg:flex"}`} style={{ minHeight: 420 }}>
        {!ouverte ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm p-6 text-center">Sélectionnez une conversation dans la liste pour lire et répondre.</div>
        ) : (
          <>
            <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <button onClick={() => setCleOuverte(null)} className="lg:hidden text-sky-800 font-bold text-lg leading-none" aria-label="Retour">←</button>
              <span className="flex-1">📲 {ouverte.nom || ouverte.tel}</span>
              {peutReattribuer(profile) && ouverte.proprietaire_id && (
                <button onClick={rendreATous} className="text-xs font-bold text-slate-600 underline whitespace-nowrap" title="Tout le personnel pourra l'ouvrir et y répondre">🔓 Rendre à tous</button>
              )}
              {peutReattribuer(profile) && (
                <button onClick={reattribuer} className="text-xs font-bold text-sky-800 underline whitespace-nowrap">🔁 Confier</button>
              )}
            </div>
            {/* ⏳ LA FENÊTRE DE 24 H SE VOIT, TOUJOURS. Sans ce bandeau, le
                vendeur tape un message qui ne partira jamais et ne comprend
                pas pourquoi — c'est la règle de Meta, pas la nôtre, mais
                c'est à nous de la DIRE. */}
            <div className={`border-b px-4 py-2 text-xs ${ouverte.fenetre.ouverte ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-amber-50 border-amber-100 text-amber-800"}`}>
              <div className="font-bold">{libelleFenetre(ouverte.fenetre)}</div>
              <div className="mt-0.5 text-slate-500">
                {ouverte.tel}
                {" · "}
                {ouverte.proprietaire_nom
                  ? `Conversation de ${ouverte.proprietaire_nom}`
                  : "🛟 Support — personne ne l'a engagée, tout le personnel la voit"}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: "50vh" }}>
              {fil.length === 0 && <div className="text-center text-slate-400 text-sm py-8">Aucun message pour l'instant.</div>}
              {/* 🤖 Une réponse de l'assistant (24/09/2026) se voit du côté
                  de BMI, mais PAS comme celle d'une personne : cadre clair,
                  étiquette « Assistant » — le personnel doit savoir ce que
                  le robot a dit au client. */}
              {fil.map((m) => (
                <div key={m.id} data-assistant={estLigneAssistant(m) ? "oui" : undefined} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.wa_systeme ? "mx-auto bg-slate-50 text-slate-500 text-xs italic" : estLigneAssistant(m) ? "ml-auto bg-sky-50 border border-sky-200 text-slate-800" : m.de_id === profile.id ? "ml-auto bg-sky-800 text-white" : "bg-slate-100 text-slate-800"}`}>
                  {estLigneAssistant(m) && <div className="text-xs font-bold mb-0.5 text-sky-800">🤖 {NOM_ASSISTANT}</div>}
                  {!m.wa_systeme && !estLigneAssistant(m) && m.de_id !== profile.id && <div className="text-xs font-bold mb-0.5 opacity-70">{m.de_nom}</div>}
                  {m.wa_media && <MediaWa message={m} />}
                  {m.texte ? <div className="whitespace-pre-line">{texteDuFil(m)}</div> : null}
                  <div className={`text-[10px] mt-1 ${m.de_id === profile.id ? "text-sky-200" : "text-slate-400"}`}>{dFR(m.date)} {String(m.ts || "").slice(11, 16)}</div>
                </div>
              ))}
            </div>
            {!ouverte.fenetre.ouverte ? (
              // ⚠ DÉFAUT RÉPARÉ LE 20/09/2026 : cette phrase envoyait le
              // vendeur vers 📋 Tous les devis — or un client SANS devis n'y
              // est pas, et c'est justement lui qu'on n'arrive pas à
              // joindre (question de Timo). Depuis `prise_de_contact`, la
              // réponse est UN BOUTON au-dessus, dans le même écran : on la
              // donne ici. « L'écran ne décrit jamais autre chose que ce qui
              // est possible » (règle du 19/09).
              <div className="p-3 border-t border-slate-200 text-xs text-slate-500 space-y-2">
                <div>WhatsApp n'accepte plus de réponse libre : la fenêtre s'est fermée. Seul un message approuvé peut repartir — et dès que le client y répond, vous pourrez lui écrire librement pendant 24 h.</div>
                <button
                  onClick={() => { setContact({ nom: ouverte.nom || "", tel: ouverte.tel || "", sujet: "" }); setCleOuverte(null); }}
                  className="px-3 py-1.5 rounded-lg bg-sky-800 text-white font-bold text-xs hover:bg-sky-900">
                  ✍️ Lui écrire quand même
                </button>
                <div>Pour relancer un DEVIS en attente, passez plutôt par 📋 Tous les devis.</div>
              </div>
            ) : (
              <div className="p-3 border-t border-slate-200 flex gap-2">
                <input className={inputCls} placeholder="Votre réponse, envoyée du numéro BMI..." value={texte} onChange={(e) => setTexte(e.target.value)} onKeyDown={(e) => e.key === "Enter" && envoyer()} />
                <button onClick={envoyer} disabled={envoi} className="px-5 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 whitespace-nowrap disabled:opacity-50">{envoi ? "Envoi…" : "Envoyer"}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Une ligne de la liste — écrite UNE fois, comme LigneConversation de 💬 Messages.
// ⚠ C'est une LIGNE DE TABLEAU : le composant commun d'archivage dessine un
// <table>, et le bloc des non lues en pose un aussi. UNE seule ligne pour les
// deux — deux façons de dessiner la même chose finiraient par diverger.
function LigneWa({ item, cleOuverte, ouvrir }) {
  const c = item.wa;
  // ⚠⚠ « ON PEUT VOIR LA DISCUSSION MAIS GRISÉ… PAS JUSTE LA FAIRE
  // DISPARAÎTRE » (Timo, 21/09/2026). La ligne reste à sa place, en gris,
  // avec un cadenas et le nom de la personne à qui elle est confiée : on
  // sait qu'elle existe et à qui la demander. Le clic ne l'ouvre pas — il
  // EXPLIQUE (`ouvrir` refuse et nomme). Un bouton mort n'apprend rien.
  // ⚠ Elle ne porte NI aperçu, NI pastille de non-lus : il n'y a rien à
  // montrer, et la règle ne lui a donné aucun message.
  const verrou = !!c.verrouillee;
  return (
    <tr><td className="p-0">
    <button onClick={() => ouvrir(c)} data-wa-verrou={verrou ? "1" : "0"}
      className={`w-full text-left px-4 py-3 border-b border-slate-100 flex items-center justify-between ${verrou ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "hover:bg-sky-50"} ${!verrou && cleOuverte === c.cle ? "bg-sky-50" : ""}`}>
      <span className="text-sm">
        <span className={verrou ? "font-semibold text-slate-500" : "font-semibold"}>{verrou ? "🔒 " : ""}{c.nom || c.tel}</span>
        <span className="block text-xs text-slate-400">
          {verrou
            ? `Confiée à ${c.proprietaire_nom || "quelqu'un d'autre"} — vous ne pouvez pas l'ouvrir`
            : c.proprietaire_nom ? c.proprietaire_nom : "🛟 Support — personne ne l'a engagée"}
          {verrou || c.fenetre.ouverte ? "" : " · fenêtre fermée"}
        </span>
      </span>
      {!verrou && item.nb > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{item.nb}</span>}
    </button>
    </td></tr>
  );
}

// ---- 📷 CE QUE LE CLIENT A ENVOYÉ QUI N'EST PAS DU TEXTE (20/09/2026) ----
// ⚠ LE FICHIER NE VIENT PAS DE WHATSAPP DIRECTEMENT : son lien exige la clé
// YCloud, qui n'existe que côté serveur. On passe donc par notre fonction
// `api/whatsapp-media.js`, qui revérifie que CETTE personne a le droit de
// voir CETTE conversation avant d'aller chercher le fichier. Le navigateur
// ne voit jamais la clé, et rien n'est stocké chez nous.
// ⚠ UNE PHOTO S'AFFICHE TOUTE SEULE (c'est ce qui a été demandé) ; une
// vidéo, un son ou un document attendent un clic — on ne fait pas payer
// dix mégaoctets de forfait à quelqu'un qui ouvre une conversation.
const MEDIA_AUTO = ["image", "sticker"];

export function MediaWa({ message }) {
  const media = message.wa_media || {};
  const [url, setUrl] = useState("");
  const [charge, setCharge] = useState(false);
  const [motif, setMotif] = useState("");

  const ouvrir = async () => {
    if (charge) return;
    setCharge(true);
    const r = await chargerMediaWa(message.id);
    if (r.url) setUrl(r.url); else setMotif(r.motif || "Fichier indisponible.");
  };

  useEffect(() => {
    if (MEDIA_AUTO.includes(media.type)) ouvrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

  // ⚠ On rend la mémoire du navigateur quand la conversation se ferme :
  // sans ça, chaque photo ouverte resterait accrochée jusqu'au F5.
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const nom = libelleMedia(media);

  if (motif) {
    // ⚠ ON DIT POURQUOI. WhatsApp efface ses fichiers au bout de 30 jours :
    // un cadre vide laisserait croire à une panne de l'application.
    return <div className="text-xs italic opacity-80">{nom} — {motif}</div>;
  }
  if (!url) {
    return (
      <button onClick={ouvrir} disabled={charge} className="text-xs font-bold underline disabled:opacity-60">
        {charge ? `${nom} — ouverture…` : `${nom} — ouvrir`}
      </button>
    );
  }
  if (media.type === "image" || media.type === "sticker") {
    return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={nom} className="rounded-lg max-w-full" style={{ maxHeight: 260 }} /></a>;
  }
  if (media.type === "video") return <video src={url} controls className="rounded-lg max-w-full" style={{ maxHeight: 260 }} />;
  if (media.type === "audio" || media.type === "voice") return <audio src={url} controls className="w-full" />;
  return <a href={url} download={media.nom || "document"} className="text-xs font-bold underline">{nom} — enregistrer</a>;
}
