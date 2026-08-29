// ============================================================
// screens/Messagerie.jsx — Messagerie interne en différé (via la
// synchronisation) : fils par client, groupes, visibilité par rôle.
// ============================================================
import { useState } from "react";
import { Clients } from "../screens/Clients";
import { uid, today, dFR, col } from "../lib/core";
import { Field, inputCls, btnDark, uConfirm } from "../components/ui";
import { utilisateursDeLEspace } from "../lib/calculs";

// ============ MESSAGERIE INTERNE (en différé, via la synchronisation) ============
// - Conversations 1-à-1 entre tous les membres de l'équipe (tous rôles sauf client)
// - Fil « Support » par client : le client écrit, et l'admin, les techniciens,
//   les chefs d'équipe et le commercial rattaché à sa fiche voient et répondent
// - Un client autorisé par l'admin (chat_libre) peut aussi discuter en 1-à-1
export function peutVoirFilClient(moi, clientId, db) {
  if (moi.role === "admin" || moi.role === "technicien" || moi.role === "technicien_bmi" || moi.chef_equipe) return true;
  if (moi.role === "commercial") {
    const fiche = (db.clients_installes || []).find((c) => c.user_id === clientId);
    return fiche && fiche.commercial === moi.nom;
  }
  return moi.id === clientId; // le client lui-même
}

// Libellé du rôle affiché dans les listes de contacts / membres
function libelleRole(role) {
  return role === "admin" ? "Admin" : role === "gerant" ? "Gérant" : role === "magasinier" ? "Magasinier" : role === "commercial" ? "Commercial" : role === "technicien" ? "Technicien" : role === "technicien_bmi" ? "Technicien BMI" : role === "resp_commercial" ? "Resp. Commercial" : role === "comptable" ? "Comptable" : role === "client" ? "Client" : "Vendeur";
}

export function Messagerie({ db, save, profile }) {
  const estClient = profile.role === "client";
  const chatLibre = !!profile.chat_libre;
  const isAdmin = profile.role === "admin";
  const [conv, setConv] = useState(null); // { type: "user"|"client"|"groupe", id }
  const [texte, setTexte] = useState("");
  const [creationGroupe, setCreationGroupe] = useState(false); // formulaire de création
  const [gestionMembres, setGestionMembres] = useState(false); // édition des membres du groupe ouvert
  const messages = db.messages || [];
  const groupes = db.groupes || [];

  // ---- Interlocuteurs 1-à-1 : équipe active (+ clients autorisés au chat libre) ----
  // ⚠ Cloisonnement (29/08/2026) : la liste des interlocuteurs mêlait les deux
  // espaces. Un stagiaire pouvait écrire à un vrai client, et un vrai vendeur
  // recevoir un message d'entraînement au milieu de ses vraies conversations.
  const equipe = utilisateursDeLEspace(db, profile).filter((u) => u.id !== profile.id && u.actif !== false && (u.role !== "client" || u.chat_libre));
  const contacts = estClient && !chatLibre ? [] : equipe;

  // ---- Chef d'équipe assigné à MON installation (visible même sans chat libre) ----
  const monChefEquipe = estClient
    ? (() => {
        const fiche = (db.clients_installes || []).find((c) => c.user_id === profile.id);
        const chefEntree = (fiche?.equipe || []).find((e) => e.chef);
        return chefEntree ? db.users.find((u) => u.id === chefEntree.user_id && u.actif !== false) : null;
      })()
    : null;

  // ---- Clients dont JE suis le chef d'équipe (visible même sans chat libre côté client) ----
  const mesClientsEnTantQueChef = !estClient
    ? (db.clients_installes || [])
        .filter((c) => (c.equipe || []).some((e) => e.user_id === profile.id && e.chef))
        .map((c) => db.users.find((u) => u.id === c.user_id))
        .filter(Boolean)
    : [];

  // ---- Clients qui M'ONT ÉCRIT directement (ex. demande de modification/rejet
  // d'un devis) : sans ça, leur message compte dans le badge « non lus » mais
  // reste invisible et impossible à ouvrir — un message orphelin, sans conversation.
  const clientsQuiMOntEcrit = !estClient
    ? [...new Set(messages.filter((m) => m.a_id === profile.id && !m.canal && m.de_id).map((m) => m.de_id))]
        .map((id) => db.users.find((u) => u.id === id && u.role === "client" && u.actif !== false))
        .filter(Boolean)
    : [];

  // ---- Fils clients visibles par moi ----
  const clientsAvecFil = db.users.filter((u) => u.role === "client" && u.actif !== false && peutVoirFilClient(profile, u.id, db));

  // ---- Groupes visibles par moi : l'admin voit tout, les autres seulement ceux dont ils sont membres ----
  const mesGroupes = groupes.filter((g) => isAdmin || (g.membres || []).includes(profile.id));

  const messagesDe = (c) => {
    if (!c) return [];
    if (c.type === "client") return messages.filter((m) => m.canal === "support" && m.client_id === c.id).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    if (c.type === "groupe") return messages.filter((m) => m.canal === "groupe" && m.groupe_id === c.id).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    return messages.filter((m) => !m.canal && ((m.de_id === profile.id && m.a_id === c.id) || (m.de_id === c.id && m.a_id === profile.id))).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  };

  const nonLusPour = (c) => messagesDe(c).filter((m) => m.de_id !== profile.id && !(m.lu_par || []).includes(profile.id)).length;

  // ⚠ Demande Timo : les fils avec des messages non lus remontent TOUJOURS en
  // première position dans chaque liste — tri stable (ne change pas l'ordre
  // entre deux fils tous deux lus, ou tous deux non lus).
  const nonLusEnPremier = (liste, cOf) =>
    liste.map((x) => ({ x, nb: nonLusPour(cOf(x)) })).sort((a, b) => (b.nb > 0) - (a.nb > 0)).map((e) => e.x);

  const ouvrir = (c) => {
    setConv(c);
    setGestionMembres(false);
    // Marque les messages de cette conversation comme lus (si besoin)
    const aLire = messagesDe(c).filter((m) => m.de_id !== profile.id && !(m.lu_par || []).includes(profile.id));
    if (aLire.length > 0) {
      const ids = new Set(aLire.map((m) => m.id));
      save({ ...db, messages: messages.map((m) => (ids.has(m.id) ? { ...m, lu_par: [...(m.lu_par || []), profile.id] } : m)) });
    }
  };

  const envoyer = () => {
    const t = texte.trim();
    if (!t || !conv) return;
    const base = { id: uid(), date: today(), ts: new Date().toISOString(), de_id: profile.id, de_nom: profile.nom, texte: t, lu_par: [profile.id] };
    const m = conv.type === "client" ? { ...base, canal: "support", client_id: conv.id } : conv.type === "groupe" ? { ...base, canal: "groupe", groupe_id: conv.id } : { ...base, a_id: conv.id };
    save({ ...db, messages: [m, ...messages] });
    setTexte("");
  };

  // ---- Gestion des groupes (admin uniquement) ----
  const creerGroupe = (nom, membresChoisis) => {
    const n = nom.trim();
    if (!n) return;
    const g = { id: uid(), nom: n, membres: [...new Set([profile.id, ...membresChoisis])], createur_id: profile.id, createur_nom: profile.nom, date: today(), ts: new Date().toISOString() };
    save({ ...db, groupes: [g, ...groupes] }, `Groupe « ${n} » créé par ${profile.nom}`);
    setCreationGroupe(false);
    ouvrir({ type: "groupe", id: g.id });
  };

  const supprimerGroupe = async (g) => {
    if (!(await uConfirm(`Supprimer le groupe « ${g.nom} » ?\n\nTous les messages échangés dans ce groupe seront définitivement effacés. Cette action est irréversible.`))) return;
    save({
      ...db,
      groupes: groupes.filter((x) => x.id !== g.id),
      messages: messages.filter((m) => !(m.canal === "groupe" && m.groupe_id === g.id)),
    }, `Groupe « ${g.nom} » supprimé par ${profile.nom}`);
    if (conv?.type === "groupe" && conv.id === g.id) setConv(null);
  };

  const basculerMembre = (g, userId) => {
    const membres = (g.membres || []).includes(userId) ? g.membres.filter((id) => id !== userId) : [...(g.membres || []), userId];
    save({ ...db, groupes: groupes.map((x) => (x.id === g.id ? { ...x, membres } : x)) });
  };

  const fil = messagesDe(conv);
  const groupeOuvert = conv?.type === "groupe" ? groupes.find((g) => g.id === conv.id) : null;
  const nomConv = conv
    ? conv.type === "client"
      ? `Support — ${db.users.find((u) => u.id === conv.id)?.nom || "Client"}`
      : conv.type === "groupe"
      ? `👥 ${groupeOuvert?.nom || "Groupe"}`
      : db.users.find((u) => u.id === conv.id)?.nom || ""
    : "";

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      {/* Liste des conversations (sur mobile : masquée quand un fil est ouvert) */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${conv ? "hidden lg:block" : ""}`}>
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">💬 Conversations</div>
        <div className="max-h-[60vh] overflow-y-auto">
          {estClient && (
            <button onClick={() => ouvrir({ type: "client", id: profile.id })} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "client" && conv?.id === profile.id ? "bg-sky-50" : ""}`}>
              <span className="font-semibold text-sm">🛟 Écrire à BMI Togo</span>
              {nonLusPour({ type: "client", id: profile.id }) > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nonLusPour({ type: "client", id: profile.id })}</span>}
            </button>
          )}
          {estClient && monChefEquipe && (
            <button onClick={() => ouvrir({ type: "user", id: monChefEquipe.id })} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "user" && conv?.id === monChefEquipe.id ? "bg-sky-50" : ""}`}>
              <span className="font-semibold text-sm">👷 {monChefEquipe.nom} <span className="text-xs font-normal text-slate-400">(chef d'équipe)</span></span>
              {nonLusPour({ type: "user", id: monChefEquipe.id }) > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nonLusPour({ type: "user", id: monChefEquipe.id })}</span>}
            </button>
          )}
          {!estClient && mesClientsEnTantQueChef.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50">👷 Mes clients (chef d'équipe)</div>
              {nonLusEnPremier(mesClientsEnTantQueChef, (u) => ({ type: "user", id: u.id })).map((u) => {
                const c = { type: "user", id: u.id };
                const nb = nonLusPour(c);
                return (
                  <button key={"chef" + u.id} onClick={() => ouvrir(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "user" && conv?.id === u.id ? "bg-sky-50" : ""}`}>
                    <span className="font-semibold text-sm">{u.nom_base || u.nom}</span>
                    {nb > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nb}</span>}
                  </button>
                );
              })}
            </>
          )}
          {!estClient && clientsQuiMOntEcrit.filter((u) => !mesClientsEnTantQueChef.some((c) => c.id === u.id)).length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50">👤 Clients qui vous ont écrit</div>
              {nonLusEnPremier(clientsQuiMOntEcrit.filter((u) => !mesClientsEnTantQueChef.some((c) => c.id === u.id)), (u) => ({ type: "user", id: u.id })).map((u) => {
                const c = { type: "user", id: u.id };
                const nb = nonLusPour(c);
                return (
                  <button key={"ecrit" + u.id} onClick={() => ouvrir(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "user" && conv?.id === u.id ? "bg-sky-50" : ""}`}>
                    <span className="font-semibold text-sm">{u.nom_base || u.nom}</span>
                    {nb > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nb}</span>}
                  </button>
                );
              })}
            </>
          )}
          {!estClient && clientsAvecFil.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50">🛟 Support clients</div>
              {nonLusEnPremier(clientsAvecFil, (u) => ({ type: "client", id: u.id })).map((u) => {
                const c = { type: "client", id: u.id };
                const nb = nonLusPour(c);
                return (
                  <button key={"cl" + u.id} onClick={() => ouvrir(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "client" && conv?.id === u.id ? "bg-sky-50" : ""}`}>
                    <span className="font-semibold text-sm">{u.nom}</span>
                    {nb > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nb}</span>}
                  </button>
                );
              })}
            </>
          )}
          {!estClient && (
            <>
              <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50 flex items-center justify-between">
                <span>👥 Groupes</span>
                {isAdmin && <button onClick={() => setCreationGroupe(true)} className="text-sky-800 font-bold normal-case text-xs">+ Nouveau</button>}
              </div>
              {mesGroupes.length === 0 && <div className="px-4 py-3 text-xs text-slate-400">{isAdmin ? "Créez un groupe pour discuter avec plusieurs collaborateurs à la fois." : "Aucun groupe pour l'instant."}</div>}
              {nonLusEnPremier(mesGroupes, (g) => ({ type: "groupe", id: g.id })).map((g) => {
                const c = { type: "groupe", id: g.id };
                const nb = nonLusPour(c);
                return (
                  <button key={"gr" + g.id} onClick={() => ouvrir(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "groupe" && conv?.id === g.id ? "bg-sky-50" : ""}`}>
                    <span className="text-sm"><span className="font-semibold">{g.nom}</span> <span className="text-xs text-slate-400">({(g.membres || []).length})</span></span>
                    {nb > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nb}</span>}
                  </button>
                );
              })}
            </>
          )}
          {contacts.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50">👤 Équipe</div>
              {nonLusEnPremier(contacts, (u) => ({ type: "user", id: u.id })).map((u) => {
                const c = { type: "user", id: u.id };
                const nb = nonLusPour(c);
                return (
                  <button key={u.id} onClick={() => ouvrir(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "user" && conv?.id === u.id ? "bg-sky-50" : ""}`}>
                    <span className="text-sm"><span className="font-semibold">{u.nom}</span> <span className="text-xs text-slate-400">{libelleRole(u.role)}</span></span>
                    {nb > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nb}</span>}
                  </button>
                );
              })}
            </>
          )}
          {estClient && !chatLibre && <div className="px-4 py-3 text-xs text-slate-400">Vos messages sont transmis à l'équipe BMI Togo (administration, techniciens et votre commercial).</div>}
          {!estClient && contacts.length === 0 && clientsAvecFil.length === 0 && mesGroupes.length === 0 && mesClientsEnTantQueChef.length === 0 && clientsQuiMOntEcrit.length === 0 && !isAdmin && <div className="px-4 py-6 text-sm text-slate-400 text-center">Aucun contact pour l'instant — les autres membres de l'équipe apparaîtront ici dès leur création.</div>}
        </div>
      </div>

      {/* Fil de la conversation (sur mobile : affiché seulement quand un fil est ouvert) */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm flex-col ${conv ? "flex" : "hidden lg:flex"}`} style={{ minHeight: 420 }}>
        {!conv ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm p-6 text-center">Sélectionnez une conversation dans la liste pour lire et écrire des messages.</div>
        ) : (
          <>
            <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <button onClick={() => setConv(null)} className="lg:hidden text-sky-800 font-bold text-lg leading-none" aria-label="Retour">←</button>
              <span className="flex-1">{nomConv}</span>
              {groupeOuvert && isAdmin && (
                <>
                  <button onClick={() => setGestionMembres((v) => !v)} className="text-xs font-bold text-sky-800 underline whitespace-nowrap">Membres</button>
                  <button onClick={() => supprimerGroupe(groupeOuvert)} className="text-xs font-bold text-red-600 underline whitespace-nowrap">Supprimer</button>
                </>
              )}
            </div>
            {groupeOuvert && gestionMembres && isAdmin && (
              <div className="border-b border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto">
                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Membres du groupe</div>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {/* ⚠ Jamais de compte CLIENT dans un groupe (défaut trouvé
                      lors de la revue Espace client, lot 2) : l'écran du
                      client ne montre que son fil de support — un client
                      ajouté ici ne pouvait JAMAIS ouvrir le groupe, mais les
                      messages du groupe se retrouvaient sur son appareil. */}
                  {db.users.filter((u) => u.actif !== false && u.role !== "client").map((u) => {
                    const dedans = (groupeOuvert.membres || []).includes(u.id);
                    return (
                      <label key={u.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer ${dedans ? "bg-sky-50 border-sky-200" : "bg-white border-slate-200"} ${u.id === profile.id ? "opacity-60" : ""}`}>
                        <input type="checkbox" checked={dedans} disabled={u.id === profile.id} onChange={() => basculerMembre(groupeOuvert, u.id)} />
                        <span className="font-semibold">{u.nom}</span>
                        <span className="text-slate-400">{libelleRole(u.role)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {groupeOuvert && !isAdmin && (
              <div className="border-b border-slate-100 px-4 py-1.5 text-xs text-slate-400">Membres : {(groupeOuvert.membres || []).map((id) => db.users.find((u) => u.id === id)?.nom).filter(Boolean).join(", ")}</div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: "50vh" }}>
              {fil.length === 0 && <div className="text-center text-slate-400 text-sm py-8">Aucun message pour l'instant. Écrivez le premier !</div>}
              {fil.map((m) => (
                <div key={m.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.de_id === profile.id ? "ml-auto bg-sky-800 text-white" : "bg-slate-100 text-slate-800"}`}>
                  {m.de_id !== profile.id && <div className="text-xs font-bold mb-0.5 opacity-70">{m.de_nom}</div>}
                  <div>{m.texte}</div>
                  <div className={`text-[10px] mt-1 ${m.de_id === profile.id ? "text-sky-200" : "text-slate-400"}`}>{dFR(m.date)} {String(m.ts || "").slice(11, 16)}</div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-200 flex gap-2">
              <input className={inputCls} placeholder="Votre message..." value={texte} onChange={(e) => setTexte(e.target.value)} onKeyDown={(e) => e.key === "Enter" && envoyer()} />
              <button onClick={envoyer} className="px-5 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 whitespace-nowrap">Envoyer</button>
            </div>
          </>
        )}
      </div>

      {creationGroupe && <CreationGroupeModal db={db} profile={profile} onFermer={() => setCreationGroupe(false)} onCreer={creerGroupe} />}
    </div>
  );
}

// Formulaire de création d'un groupe : nom + sélection des membres (admin uniquement)
function CreationGroupeModal({ db, profile, onFermer, onCreer }) {
  const [nom, setNom] = useState("");
  const [choisis, setChoisis] = useState([]);
  // ⚠ Jamais de compte CLIENT dans un groupe — même règle que la gestion
  // des membres d'un groupe existant (voir le commentaire là-bas).
  const candidats = db.users.filter((u) => u.id !== profile.id && u.actif !== false && u.role !== "client");

  const basculer = (id) => setChoisis((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-3" onClick={onFermer}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
          <div className="font-bold text-slate-900">👥 Nouveau groupe de discussion</div>
          <button onClick={onFermer} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Fermer</button>
        </div>
        <div className="overflow-auto p-4 space-y-4">
          <Field label="Nom du groupe">
            <input className={inputCls} placeholder="Ex. : Chantier Agoè, Équipe technique..." value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
          </Field>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase mb-2">Membres à ajouter ({choisis.length} sélectionné{choisis.length > 1 ? "s" : ""})</div>
            <div className="grid sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
              {candidats.map((u) => {
                const dedans = choisis.includes(u.id);
                return (
                  <label key={u.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer ${dedans ? "bg-sky-50 border-sky-200" : "bg-white border-slate-200"}`}>
                    <input type="checkbox" checked={dedans} onChange={() => basculer(u.id)} />
                    <span className="font-semibold">{u.nom}</span>
                    <span className="text-slate-400">{libelleRole(u.role)}</span>
                  </label>
                );
              })}
              {candidats.length === 0 && <div className="text-xs text-slate-400 col-span-2">Aucun autre utilisateur actif.</div>}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button onClick={onFermer} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
          <button onClick={() => onCreer(nom, choisis)} disabled={!nom.trim() || choisis.length === 0} className={`${btnDark} disabled:opacity-40 disabled:cursor-not-allowed`}>Créer le groupe</button>
        </div>
      </div>
    </div>
  );
}

// Nombre total de messages non lus pour un utilisateur (badge de l'onglet)
