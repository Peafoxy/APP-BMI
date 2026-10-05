// ============================================================
// screens/dimensionnement/Brouillons.jsx — 📝 Mes brouillons (demande Timo,
// 08/09/2026). Un devis enregistré avec son client (nom + numéro, ou compte
// existant) SANS l'envoyer : ni compte créé, ni WhatsApp. Il se reprend dans
// son volet, s'envoie par WhatsApp, ou se supprime. Rangé dans la fiche de
// celui qui l'a fait (`brouillons_devis`) : personnel, synchronisé, sans SQL.
// ============================================================
import { uid, fmt, today, dFR, heureCourte, nouveauMessage } from "../../lib/core";
import { uAlert, uConfirm, uPrompt, uChoix } from "../../components/ui";
import { bloquerSiLecture, estAdminPrincipal, refuserSaufAdminPrincipal, utilisateursDeLEspace, ONGLETS_ROLE } from "../../lib/calculs";
import { LIBELLE_ROLE_EMPLOYE } from "../../lib/comptesClients";
import { brouillonsAvecApporteur, fixerTauxBrouillon } from "../../lib/apporteurDevis";
import { brouillonsDe, retirerBrouillon, nomDuBrouillon, brouillonSansClient, destinatairesBrouillon, confierBrouillon } from "./devisCommun";
import { resoudreClientDevis, envoyerDevisEtOuvrirWhatsApp } from "./Partages";
import { messageDevisEnvoye } from "../../lib/whatsappModeles";

export function MesBrouillons({ db, profile, save, domaines, onReprendre }) {
  const moi = (db.users || []).find((u) => u.id === profile.id) || profile;
  const liste = [...brouillonsDe(moi)].sort((a, b) => String(b.ts || b.date || "").localeCompare(String(a.ts || a.date || "")));
  const libelleVolet = (b) => {
    const d = (domaines || []).find((x) => x.id === b.volet);
    if (d) return `${d.icone || ""} ${d.nom}`.trim();
    return { solaire: "☀️ Solaire", garage: "🚪 Portail / garage" }[b.volet] || b.volet || "—";
  };

  const supprimer = async (b) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm(`Supprimer le brouillon « ${nomDuBrouillon(b)} » (${fmt(b.devis?.total)}) ?`)) return;
    save(retirerBrouillon(db, profile.id, b.id), `📝 Brouillon de devis supprimé — ${nomDuBrouillon(b)}`);
  };

  // Envoi direct, sans repasser par le volet : même chemin que « Envoyer par
  // WhatsApp » (compte trouvé ou créé, devis rangé dans sa fiche, WhatsApp
  // ouvert), puis le brouillon disparaît.
  const envoyer = async (b) => {
    if (bloquerSiLecture(db, profile)) return;
    // 05/10/2026 : un brouillon SANS client ne part pas d'ici — on le reprend
    // pour choisir le client (ou le créer) dans le volet.
    if (brouillonSansClient(b)) { uAlert(`Le brouillon « ${nomDuBrouillon(b)} » n'a pas de client.\n\nReprenez-le (✏️ Reprendre) pour choisir le client, puis envoyez-le.`); return; }
    const clientDevis = b.client?.id || "__nouveau__";
    // 29/09/2026 : le prénom et l'entreprise cliente du brouillon suivent.
    const nouvClient = { nom: b.client?.nom || "", prenom: b.client?.prenom || b.devis?.prenom || "", tel: b.client?.tel || "", entreprise: b.devis?.entreprise || null };
    const resolu = await resoudreClientDevis(db, clientDevis, nouvClient, profile, b.devis?.boutique);
    if (!resolu) return;
    const { compte, motDePasse, dbApres, identite } = resolu;
    // Il part au nom de celui qui l'envoie ; un brouillon confié garde « préparé par » (dans b.devis).
    const devis = { ...b.devis, ...identite, id: uid(), date: today(), heure: heureCourte(), par: profile.nom, par_id: profile.id, par_role: profile.role, statut: "propose" };
    const envoye = await envoyerDevisEtOuvrirWhatsApp({
      dbApres: retirerBrouillon(dbApres, profile.id, b.id), compte, motDePasse, devis, save, profile, nouvClient,
      ligneEntete: [`📝 Devis ${libelleVolet(b)} — *${fmt(devis.total)}*`],
    });
    if (envoye && envoye.auto) uAlert(messageDevisEnvoye(compte.nom, true));
  };

  // 📨 CONFIER UN BROUILLON À UN COLLÈGUE (Timo, 05/10/2026 : « si un
  // utilisateur est occupé, il délègue un autre à finaliser le brouillon »,
  // puis « 1 déplacé, 2 celui qui envoie »). Le brouillon QUITTE mes brouillons
  // et ARRIVE dans les siens, client compris ; il reçoit un message. Les
  // personnes viennent de l'espace REGARDÉ (utilisateursDeLEspace), jamais
  // db.users ; la fiche est relue DANS le geste (confierBrouillon).
  const destinataires = destinatairesBrouillon(utilisateursDeLEspace(db, profile), profile, ONGLETS_ROLE);
  const confier = async (b) => {
    if (bloquerSiLecture(db, profile)) return;
    if (destinataires.length === 0) { uAlert("Personne d'autre dans cet espace n'a l'onglet Dimensionnement : ce brouillon ne peut être confié à personne."); return; }
    // Le nom ET le rôle sur chaque bouton : deux homonymes ne se confondent pas.
    const libelle = (u) => `${u.nom} — ${LIBELLE_ROLE_EMPLOYE[u.role] || u.role}${u.boutique && u.boutique !== "Toutes" ? ` · ${u.boutique}` : ""}`;
    const choix = await uChoix(`Confier le brouillon « ${nomDuBrouillon(b)} » (${fmt(b.devis?.total)}) à :`, destinataires.map(libelle));
    if (!choix) return;
    const a = destinataires.find((u) => libelle(u) === choix);
    if (!a || !await uConfirm(`Confier le brouillon « ${nomDuBrouillon(b)} » à ${a.nom} ?\n\nIl quitte vos brouillons et arrive dans les siens, client compris. C'est ${a.nom} qui l'enverra : le devis partira à son nom (avec la mention « préparé par ${b.devis?.prepare_par || profile.nom} »).`)) return;
    const r = confierBrouillon(db, profile.id, a.id, b.id, { par: profile.nom, le: today() });
    if (r.erreur) { uAlert(r.erreur); return; }
    const message = nouveauMessage(profile, { a_id: a.id,
      texte: `📨 ${profile.nom} vous confie son brouillon de devis : « ${nomDuBrouillon(b)} » (${fmt(b.devis?.total)}). Retrouvez-le dans 📐 Dimensionnement → 📝 Mes brouillons pour le finaliser et l'envoyer.` });
    save({ ...r.db, messages: [...(r.db.messages || []), message] },
      `📨 Brouillon de devis « ${nomDuBrouillon(b)} » (${fmt(b.devis?.total)}) confié par ${profile.nom} à ${a.nom}`);
    uAlert(`📨 Brouillon confié à ${a.nom}. Il a reçu un message.`);
  };

  // 🤝 L'ADMINISTRATEUR PRINCIPAL FIXE LE POURCENTAGE DE L'APPORTEUR (Timo,
  // 29/09/2026 : « l'initiateur enregistre comme brouillon, l'admin principal
  // change le pourcentage et lui il reprend pour envoyer au client »). Il voit
  // les brouillons de l'ESPACE REGARDÉ qui nomment un apporteur ; il ne touche
  // que le pourcentage. L'auteur est prévenu, et c'est lui qui renvoie.
  const principal = estAdminPrincipal(db, profile);
  const aFixer = principal
    ? utilisateursDeLEspace(db, profile).flatMap((u) => brouillonsAvecApporteur(brouillonsDe(u)).map((b) => ({ u, b })))
    : [];
  const fixerTaux = async ({ u, b }) => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufAdminPrincipal(db, profile, "Changer le pourcentage d'un apporteur externe")) return;
    const a = b.devis.apporteur_externe;
    const rep = await uPrompt(`Pourcentage de l'apporteur ${a.nom} sur le devis de ${b.client?.nom || "?"} (${fmt(b.devis?.total)}), brouillon de ${u.nom} :`, String(a.taux ?? ""));
    if (rep === null) return;
    const taux = Number(String(rep).replace(",", "."));
    if (!Number.isFinite(taux) || taux < 0 || taux > 100) { uAlert("Le pourcentage doit être entre 0 et 100."); return; }
    // Relu sur la fiche FRAÎCHE : le brouillon a pu être envoyé ou supprimé.
    const auteur = (utilisateursDeLEspace(db, profile)).find((x) => x.id === u.id);
    const frais = brouillonsDe(auteur).find((x) => x.id === b.id);
    if (!frais) { uAlert("Ce brouillon n'existe plus : il a été envoyé ou supprimé."); return; }
    const maj = fixerTauxBrouillon(frais, taux, profile, today());
    const avis = u.id === profile.id ? [] : [nouveauMessage(profile, { a_id: u.id,
      texte: `🤝 Le pourcentage de l'apporteur ${a.nom} est fixé à ${taux} % sur votre brouillon de devis pour ${b.client?.nom || "?"}. Reprenez-le dans 📝 Mes brouillons pour l'envoyer au client.` })];
    save({
      ...db,
      users: db.users.map((x) => (x.id === u.id ? { ...x, brouillons_devis: brouillonsDe(x).map((y) => (y.id === b.id ? maj : y)) } : x)),
      messages: [...avis, ...(db.messages || [])],
    }, `🤝 Pourcentage de l'apporteur ${a.nom} fixé à ${taux} % (brouillon de ${u.nom}, client ${b.client?.nom || "?"}) par ${profile.nom}`);
    uAlert(`✅ ${taux} % pour ${a.nom}.${u.id === profile.id ? "" : ` ${u.nom} est prévenu : il reprend le brouillon et l'envoie.`}`);
  };

  return (
    <div className="space-y-4">
    {principal && (
      <div className="rounded-xl p-4 bg-amber-50 border border-amber-300 shadow-sm" data-apporteurs-a-fixer>
        <div className="font-bold mb-1">🤝 Apporteurs externes — le pourcentage</div>
        <div className="text-xs text-slate-600 mb-3">
          Les brouillons de l'équipe qui nomment un apporteur externe. Il est à 3 % d'office ; vous seul pouvez le changer. L'auteur est prévenu, il reprend le brouillon et l'envoie.
        </div>
        {aFixer.length === 0 ? (
          <div className="text-sm text-slate-500">Aucun brouillon avec un apporteur externe.</div>
        ) : (
          <div className="divide-y divide-amber-200">
            {aFixer.map(({ u, b }) => (
              <div key={`${u.id}-${b.id}`} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                <div className="flex-1 min-w-[12rem]">
                  <span className="font-bold">{b.devis.apporteur_externe.nom}</span> · <b>{b.devis.apporteur_externe.taux} %</b>
                  {b.devis.apporteur_externe.taux_fixe_par ? <span className="text-xs text-slate-500"> (fixé par {b.devis.apporteur_externe.taux_fixe_par})</span> : null}
                  <div className="text-xs text-slate-500">{b.client?.nom ? `Client ${b.client.nom}` : `« ${nomDuBrouillon(b)} », sans client`} · {fmt(b.devis?.total)} · brouillon de {u.nom} · {dFR(b.date)}</div>
                </div>
                <button onClick={() => fixerTaux({ u, b })} className="px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700">✏️ Fixer le pourcentage</button>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
    <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
      <div className="font-bold mb-1">📝 Mes brouillons</div>
      <div className="text-xs text-slate-500 mb-3">
        Des devis enregistrés sans être envoyés. Reprendre rouvre le volet avec tout ce qui avait été saisi ; Envoyer les dépose dans l'espace du client et l'en prévient par WhatsApp ; Confier les remet à un collègue, qui les finalise et les envoie à son nom.
        Une fois envoyé ou converti en vente, le brouillon disparaît.
      </div>
      {liste.length === 0 ? (
        <div className="text-sm text-slate-500">Aucun brouillon. Dans un volet, « 📝 Enregistrer un brouillon » — avec ou sans client.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {liste.map((b) => (
            <div key={b.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
              <div className="flex-1 min-w-[12rem]">
                <span className="font-bold">{nomDuBrouillon(b)}</span>{b.client?.tel ? <span className="text-slate-500"> · {b.client.tel}</span> : null}
                {brouillonSansClient(b) && <span className="ml-2 text-[11px] font-bold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5" data-brouillon-sans-client>sans client</span>}
                <div className="text-xs text-slate-500">{libelleVolet(b)} · {fmt(b.devis?.total)} · {dFR(b.date)}{brouillonSansClient(b) ? " · client à choisir en le reprenant" : b.client?.id ? "" : " · compte à créer à l'envoi"}</div>
                {b.confie && <div className="text-xs text-sky-800" data-brouillon-confie>📨 Confié par {b.confie.par} le {dFR(b.confie.le)}</div>}
              </div>
              <button onClick={() => onReprendre(b)} className="px-3 py-1 rounded-lg bg-sky-800 text-white text-xs font-bold hover:bg-sky-900">✏️ Reprendre</button>
              <button onClick={() => envoyer(b)} className="px-3 py-1 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700">📲 Envoyer par WhatsApp</button>
              <button onClick={() => confier(b)} data-confier-brouillon className="px-3 py-1 rounded-lg border border-sky-300 text-sky-800 text-xs font-bold hover:bg-sky-50">➡ Confier à…</button>
              <button onClick={() => supprimer(b)} className="px-3 py-1 rounded-lg border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50">Supprimer</button>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
