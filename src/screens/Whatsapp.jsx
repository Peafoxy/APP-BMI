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
import React, { useState } from "react";
import { dFR, nouveauMessage } from "../lib/core";
import { inputCls, uAlert, uChoix } from "../components/ui";
import { utilisateursDeLEspace } from "../lib/calculs";
import { separerNonLues } from "../lib/conversations";
import { conversationsWa, critiqueReponse, libelleFenetre, peutReattribuer, CANAL_WA } from "../lib/whatsappConversations";
import { repondreWhatsApp } from "../whatsapp";

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
  if (!profile || profile.role === "client") return 0;
  const messages = db.messages || [];
  return conversationsWa(messages, profile).reduce(
    (n, c) => n + filWa(messages, c.cle).filter((m) => m.de_id !== profile.id && !(m.lu_par || []).includes(profile.id)).length,
    0
  );
}

export function Whatsapp({ db, save, profile }) {
  const messages = db.messages || [];
  const [cleOuverte, setCleOuverte] = useState(null);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // ⚠ Ce que la règle rend est DÉJÀ filtré : un commercial ou un technicien
  // à commission n'y trouve que ce qu'il a engagé, plus le support que
  // personne n'a engagé (décision « c » de Timo). ⚠ Mais c'est un filtre
  // d'AFFICHAGE : la table des messages n'est pas cloisonnée par personne
  // côté serveur — c'est dit à Timo, ce n'est pas caché.
  const convs = profile.role === "client" ? [] : conversationsWa(messages, profile);
  const ouverte = convs.find((c) => c.cle === cleOuverte) || null;
  const fil = ouverte ? filWa(messages, ouverte.cle) : [];

  const nonLusPour = (c) => filWa(messages, c.cle).filter((m) => m.de_id !== profile.id && !(m.lu_par || []).includes(profile.id)).length;
  const derniereActivite = (c) => { const f = filWa(messages, c.cle); return f.length ? String(f[f.length - 1].ts || "") : ""; };

  // ⚠ LE MÊME CLASSEMENT QUE 💬 MESSAGES, par LA règle commune (14/09/2026,
  // « un nouveau message apparaît en tête ») : un bloc « 🔴 Nouveaux
  // messages », puis le reste. Un second tri maison finirait par classer
  // autrement d'un écran à l'autre.
  const liste = separerNonLues(
    [{ cle: "whatsapp", items: convs.map((c) => ({ cle: c.cle, conv: { type: "wa", id: c.cle }, wa: c })) }],
    (conv) => { const c = convs.find((x) => x.cle === conv.id); return c ? nonLusPour(c) : 0; },
    (conv) => { const c = convs.find((x) => x.cle === conv.id); return c ? derniereActivite(c) : ""; }
  );

  const ouvrir = (c) => {
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
  const envoyer = async () => {
    const t = texte.trim();
    if (!t || !ouverte || envoi) return;
    const refus = critiqueReponse({ profile, conv: ouverte, texte: t, enLigne: navigator.onLine !== false });
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
    save({ ...db, messages: [m, ...messages] });
    setTexte("");
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
    save({ ...db, messages: [m, ...messages] }, `📲 WhatsApp — conversation de ${ouverte.nom || ouverte.tel} confiée à ${u.nom} par ${profile.nom}`);
  };

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      {/* Liste des conversations (sur mobile : masquée quand un fil est ouvert) */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${ouverte ? "hidden lg:block" : ""}`}>
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">📲 WhatsApp</div>
        <div className="max-h-[60vh] overflow-y-auto">
          {liste.nonLues.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs font-bold text-red-700 uppercase bg-red-50" data-whatsapp="nouveaux">🔴 Nouveaux messages</div>
              {liste.nonLues.map((it) => <LigneWa key={"nouveau" + it.cle} item={it} cleOuverte={cleOuverte} ouvrir={ouvrir} />)}
            </>
          )}
          {liste.sections[0]?.items.length > 0 && (
            <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50" data-whatsapp="conversations">Conversations</div>
          )}
          {liste.sections[0]?.items.map((it) => <LigneWa key={it.cle} item={it} cleOuverte={cleOuverte} ouvrir={ouvrir} />)}
          {convs.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-400 text-center">
              Aucune conversation WhatsApp pour l'instant.
              <div className="mt-2 text-xs">Elles apparaissent ici dès qu'un client répond à un message parti du numéro BMI.</div>
            </div>
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
              {fil.map((m) => (
                <div key={m.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.wa_systeme ? "mx-auto bg-slate-50 text-slate-500 text-xs italic" : m.de_id === profile.id ? "ml-auto bg-sky-800 text-white" : "bg-slate-100 text-slate-800"}`}>
                  {!m.wa_systeme && m.de_id !== profile.id && <div className="text-xs font-bold mb-0.5 opacity-70">{m.de_nom}</div>}
                  <div>{m.texte}</div>
                  <div className={`text-[10px] mt-1 ${m.de_id === profile.id ? "text-sky-200" : "text-slate-400"}`}>{dFR(m.date)} {String(m.ts || "").slice(11, 16)}</div>
                </div>
              ))}
            </div>
            {!ouverte.fenetre.ouverte ? (
              <div className="p-3 border-t border-slate-200 text-xs text-slate-500">
                WhatsApp n'accepte plus de réponse libre ici. Pour relancer ce client, passez par 📋 Tous les devis : un modèle approuvé part quand on veut.
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
function LigneWa({ item, cleOuverte, ouvrir }) {
  const c = item.wa;
  return (
    <button onClick={() => ouvrir(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${cleOuverte === c.cle ? "bg-sky-50" : ""}`}>
      <span className="text-sm">
        <span className="font-semibold">{c.nom || c.tel}</span>
        <span className="block text-xs text-slate-400">
          {c.proprietaire_nom ? c.proprietaire_nom : "🛟 Support — personne ne l'a engagée"}
          {c.fenetre.ouverte ? "" : " · fenêtre fermée"}
        </span>
      </span>
      {item.nb > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{item.nb}</span>}
    </button>
  );
}
