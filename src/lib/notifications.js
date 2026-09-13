// ============================================================
// lib/notifications.js — CE QUI PART EN NOTIFICATION À CHAQUE ENREGISTREMENT
//
// Timo (13/09/2026) : « Ce qui devrait venir comme message reste ainsi, ce
// qui est informatif reste juste informatif, rien dans Messages » — puis
// « Lance avec la liste A telle quelle comme message, et B aussi telle
// quelle, à titre informatif dans les notifications ».
//
//   Liste A — UNE règle : chaque NOUVEAU message de 💬 Messages est une
//   notification pour la personne à qui il s'adresse (envoisMessages).
//   Liste B — ce qui reste à l'écran, JAMAIS écrit dans 💬 Messages, mais
//   qui fait vibrer le téléphone « pour information » (infosDepuisDiff) :
//   une demande de ravitaillement ou de transfert, une commande à valider,
//   une prime à payer, un devis proposé au client, une tâche assignée /
//   terminée / validée / rouverte, une dépense à pointer par le comptable,
//   un article qui PASSE au seuil, une clôture dépassée. Les trois qui
//   dépendent du jour (caisse non clôturée, dette en retard, devis à
//   relancer) sont dans lib/rappels.js — tournée du matin du serveur.
//
// TOUT part d'ici, par comparaison de l'état AVANT et APRÈS un save()
// (App.jsx, un seul appel) : aucun écran n'envoie de notification
// lui-même — le banc l'interdit. L'auteur du geste n'est jamais prévenu de
// son propre geste. Rien n'est écrit dans la base : une notification
// passe par api/notifier.js, jamais par une table.
// ============================================================
import { fmt, dFR, totalVente } from "./core";
import { demandesDe, stockActuel, construireIndexDb, peutVoirFilClient } from "./calculs";
import { clotureDepassee, estCloturee } from "./cloture";
import { payeeParLeComptable } from "./validationDepenses";
import { estCompteFormation, boutiqueEstFormation, personnesDeLEspace, idsDeLaBoutique, idsParRole, idsAdmins } from "./espace";
import { fabriquerEnvoi, CAISSE_COMPTABLE } from "./rappels";

const parId = (liste) => new Map((liste || []).map((x) => [x.id, x]));
const nomsLignes = (lignes) => (lignes || []).map((l) => `${l.qte}× ${l.nom}`).join(", ");

// ---- LISTE A : les messages ----
// À qui s'adresse un message ? Tel que l'écran 💬 Messages le montre :
//   • a_id → cette personne ;
//   • fil « support » d'un client : écrit PAR le client → ceux qui voient
//     son fil (admins de son espace, techniciens de son chantier, son
//     commercial, le chef d'équipe de ce commercial) ; écrit par BMI → le client ;
//   • groupe → ses membres.
// L'auteur n'est jamais dans la liste.
export function destinatairesMessage(db, m) {
  let ids = [];
  if (m.a_id) ids = [m.a_id];
  else if (m.canal === "support" && m.client_id) {
    const client = (db.users || []).find((u) => u.id === m.client_id);
    if (!client) return [];
    ids = m.de_id === client.id
      ? [...personnesDeLEspace(db, estCompteFormation(db, client)).filter((u) => peutVoirFilClient(u, client.id, db)).map((u) => u.id),
        ...idsAdmins(db, estCompteFormation(db, client))]
      : [client.id];
  } else if (m.canal === "groupe" && m.groupe_id) {
    const g = (db.groupes || []).find((x) => x.id === m.groupe_id);
    ids = g ? [...(g.membres || [])] : [];
  }
  return [...new Set(ids.filter((id) => id && id !== m.de_id))];
}

export function envoiPourMessage(db, m) {
  const client = m.canal === "support" ? (db.users || []).find((u) => u.id === m.client_id) : null;
  const formation = client ? estCompteFormation(db, client) : false;
  return fabriquerEnvoi({
    destinataires: destinatairesMessage(db, m),
    titre: `💬 ${m.de_nom || "BMI Togo"}`, texte: m.texte, ecran: "messages", tag: `message:${m.id}`, formation,
  });
}

export function envoisMessages(avant, apres) {
  const anciens = parId(avant.messages);
  return (apres.messages || []).filter((m) => !anciens.has(m.id)).map((m) => envoiPourMessage(apres, m)).filter(Boolean);
}

// ---- LISTE B : ce qui se voit à l'écran, « pour information » ----
export function infosDepuisDiff(avant, apres) {
  const envois = [];
  const pousser = (e) => { const x = fabriquerEnvoi(e); if (x) envois.push(x); };

  // 1. Demandes de ravitaillement (au magasin) et de transfert (à la boutique cible).
  if (apres.boutiques !== avant.boutiques) {
    const avantB = new Map((avant.boutiques || []).map((b) => [b.nom, b]));
    (apres.boutiques || []).forEach((b) => {
      const deja = parId(demandesDe(avantB.get(b.nom) || {}));
      demandesDe(b).forEach((d) => {
        if (deja.has(d.id) || d.statut !== "en_attente") return;
        const formation = !!b.formation;
        if (d.type === "transfert") {
          pousser({
            destinataires: [...idsDeLaBoutique(apres, b.nom, ["gerant"]), ...idsAdmins(apres, formation)],
            titre: `🔁 Demande de transfert — ${b.nom}`,
            texte: `${d.demandeur || "Une boutique"} demande ${d.lignes?.length || 0} article(s) : ${nomsLignes(d.lignes)}`,
            ecran: "stocks", tag: `transfert:${d.id}`, formation,
          });
        } else {
          pousser({
            destinataires: [...idsParRole(apres, formation, ["magasinier"]), ...idsAdmins(apres, formation)],
            titre: `🚚 Demande de ravitaillement — ${b.nom}`,
            texte: `${d.par || b.nom} demande ${d.lignes?.length || 0} article(s) : ${nomsLignes(d.lignes)}`,
            ecran: "stocks", tag: `ravitaillement:${d.id}`, formation,
          });
        }
      });
    });
  }

  // 2. Une commande d'un commercial, à valider par la boutique (le vendeur
  //    visé s'il y en a un, sinon tous les vendeurs ; le gérant toujours).
  if (apres.commandes !== avant.commandes) {
    const deja = parId(avant.commandes);
    (apres.commandes || []).forEach((c) => {
      if (deja.has(c.id) || c.statut !== "en_attente") return;
      const formation = boutiqueEstFormation(apres, c.boutique);
      const vendeurs = c.vendeur_cible
        ? personnesDeLEspace(apres, formation).filter((u) => u.role === "vendeur" && (u.id === c.vendeur_cible || u.nom === c.vendeur_cible)).map((u) => u.id)
        : idsDeLaBoutique(apres, c.boutique, ["vendeur"]);
      const total = (c.articles || []).reduce((s, l) => s + Number(l.qte || 0) * Number(l.prix || l.prix_vente || 0), 0) - Number(c.remise || 0);
      pousser({
        destinataires: [...vendeurs, ...idsDeLaBoutique(apres, c.boutique, ["gerant"])],
        titre: `🛒 Commande à valider — ${c.boutique}`,
        texte: `${c.commercial || "Un commercial"} : ${(c.articles || []).length} article(s), ${fmt(total)}${c.client ? ` — client ${c.client}` : ""}.`,
        ecran: "commandes", tag: `commande:${c.id}`, formation,
      });
    });
  }

  // 3. Une prime d'installation demandée à la caisse d'une boutique.
  if (apres.clients_installes !== avant.clients_installes) {
    const deja = parId(avant.clients_installes);
    (apres.clients_installes || []).forEach((c) => {
      const c0 = deja.get(c.id);
      (c.equipe || []).forEach((e) => {
        const e0 = (c0?.equipe || []).find((x) => x.user_id === e.user_id);
        if (!e.demande_prime || e0?.demande_prime) return;
        const formation = boutiqueEstFormation(apres, e.prime_boutique);
        pousser({
          destinataires: idsDeLaBoutique(apres, e.prime_boutique, ["vendeur", "gerant"]),
          titre: `💰 Prime à payer — ${e.prime_boutique}`,
          texte: `${e.nom} : ${fmt(e.montant)} — chantier ${c.nom} ${c.prenom || ""}. Demandée par ${e.prime_demandee_par || "l'administrateur"}.`,
          ecran: "primes_remises", tag: `prime:${c.id}:${e.user_id}`, formation,
        });
      });
    });
  }

  // 4 et 5. Sur les fiches des personnes : un devis proposé au client, les tâches.
  if (apres.users !== avant.users) {
    const deja = parId(avant.users);
    (apres.users || []).forEach((u) => {
      const u0 = deja.get(u.id);
      if (u.role === "client") {
        const devisAvant = parId(u0?.devis);
        (u.devis || []).forEach((d) => {
          if (devisAvant.has(d.id) || (d.statut || "propose") !== "propose") return;
          pousser({
            destinataires: [u.id], titre: "📋 Nouveau devis de BMI Togo",
            texte: `Devis de ${fmt(d.total)} établi par ${d.par || "BMI Togo"}. Ouvrez votre espace pour le lire et répondre.`,
            ecran: "espace_client", tag: `devis:${d.id}`, formation: estCompteFormation(apres, u),
          });
        });
      }
      const tachesAvant = parId(u0?.taches);
      const formation = estCompteFormation(apres, u);
      (u.taches || []).forEach((t) => {
        const t0 = tachesAvant.get(t.id);
        if (!t0) {
          pousser({ destinataires: [u.id], titre: "✅ Nouvelle tâche", texte: `${t.titre}${t.echeance ? ` — pour le ${dFR(t.echeance)}` : ""} (par ${t.par || "votre responsable"}).`, ecran: "taches", tag: `tache:${t.id}`, formation });
          return;
        }
        if (t0.statut === t.statut) return;
        if (t.statut === "terminee") {
          const assignateur = personnesDeLEspace(apres, formation).filter((x) => x.nom === t.par).map((x) => x.id);
          pousser({ destinataires: assignateur, titre: "✅ Tâche terminée, à valider", texte: `${u.nom} : ${t.titre}${t.photo ? " (photo jointe)" : ""}.`, ecran: "equipe", tag: `tache:${t.id}:terminee`, formation });
        } else if (t.statut === "validee") {
          pousser({ destinataires: [u.id], titre: "✅ Tâche validée", texte: `${t.titre} — validée par ${t.valide_par || "votre responsable"}.`, ecran: "taches", tag: `tache:${t.id}:validee`, formation });
        } else if (t.statut === "a_faire" && t0.statut === "terminee") {
          pousser({ destinataires: [u.id], titre: "↩ Tâche rouverte", texte: `${t.titre}${t.commentaire_reouverture ? ` — ${t.commentaire_reouverture}` : ""}.`, ecran: "taches", tag: `tache:${t.id}:rouverte`, formation });
        }
      });
    });
  }

  // 6. Une dépense à pointer par le comptable : payée avec SA caisse, ou
  //    saisie directement « Chez le comptable ». Le versement chez lui a
  //    déjà son message (liste A) : son entrée miroir (versement_id) ne
  //    double pas. Le comptable est réel : rien ne part de la formation.
  if (apres.depenses !== avant.depenses) {
    const deja = parId(avant.depenses);
    (apres.depenses || []).forEach((d) => {
      if (deja.has(d.id) || d.versement_id || d.versement) return;
      const payee = payeeParLeComptable(d);
      if (!payee && d.boutique !== CAISSE_COMPTABLE) return;
      if (payee && boutiqueEstFormation(apres, d.boutique)) return;
      pousser({
        destinataires: idsParRole(apres, false, ["comptable"]),
        titre: "🧾 À pointer par le comptable",
        texte: `${d.description || d.categorie || "Dépense"} : ${fmt(d.montant)}${payee ? ` — dépense de ${d.boutique}, par ${d.par}, payée avec votre caisse` : ""}.`,
        ecran: "chez_comptable", tag: `pointage:${d.id}`,
      });
    });
  }

  // 7. Un article qui PASSE au seuil (il était au-dessus avant ce geste) —
  //    une notification par boutique, du plus bas au moins bas.
  if (apres.ventes !== avant.ventes || apres.ajustements !== avant.ajustements || apres.produits !== avant.produits) {
    const a0 = avecIndex(avant), a1 = avecIndex(apres);
    const produitsAvant = parId(avant.produits);
    const parBoutique = new Map();
    (apres.produits || []).forEach((p) => {
      const seuil = Number(p.seuil || 0);
      if (!(seuil > 0)) return;
      const reste = stockActuel(a1, p);
      if (reste > seuil) return;
      const p0 = produitsAvant.get(p.id);
      if (p0 && stockActuel(a0, p0) <= seuil) return; // déjà au seuil avant : rien de nouveau
      if (!parBoutique.has(p.boutique)) parBoutique.set(p.boutique, []);
      parBoutique.get(p.boutique).push({ nom: p.nom, reste });
    });
    parBoutique.forEach((liste, boutique) => {
      const b = (apres.boutiques || []).find((x) => x.nom === boutique) || {};
      const formation = !!b.formation;
      liste.sort((x, y) => x.reste - y.reste);
      pousser({
        destinataires: [
          ...(b.depot ? idsParRole(apres, formation, ["magasinier"]) : idsDeLaBoutique(apres, boutique, ["vendeur", "gerant"])),
          ...idsAdmins(apres, formation),
        ],
        titre: `⚠ Stock au seuil — ${boutique}`,
        texte: liste.slice(0, 4).map((x) => `${x.nom} (reste ${x.reste})`).join(", ") + (liste.length > 4 ? ` et ${liste.length - 4} autre(s)` : "") + ". À réapprovisionner.",
        ecran: "stocks", tag: `seuil:${boutique}`, formation,
      });
    });
  }

  // 8. Une clôture DÉPASSÉE (la caisse a bougé après la clôture — règle du
  //    11/09/2026, bandeau orange de 🔒 Caisse) : dès que c'est le cas. On
  //    ne relit que les JOURNÉES touchées par ce geste (une vente, une
  //    dépense, un règlement de dette daté), jamais toutes les clôtures.
  if (apres.ventes !== avant.ventes || apres.depenses !== avant.depenses || apres.dettes !== avant.dettes) {
    const touchees = new Map(); // boutique → dates
    const noter = (boutique, date) => {
      if (!boutique || !date) return;
      if (!touchees.has(boutique)) touchees.set(boutique, new Set());
      touchees.get(boutique).add(String(date).slice(0, 10));
    };
    if (apres.ventes !== avant.ventes) {
      const deja = parId(avant.ventes);
      (apres.ventes || []).forEach((v) => { if (!deja.has(v.id)) noter(v.boutique, v.date); });
    }
    if (apres.depenses !== avant.depenses) {
      const deja = parId(avant.depenses);
      (apres.depenses || []).forEach((d) => { const d0 = deja.get(d.id); if (!d0 || d0.montant !== d.montant || d0.date !== d.date) noter(d.boutique, d.date); });
    }
    if (apres.dettes !== avant.dettes) {
      const deja = parId(avant.dettes);
      (apres.dettes || []).forEach((d) => {
        const p0 = parId(deja.get(d.id)?.paiements);
        (d.paiements || []).forEach((p) => { if (!p0.has(p.id)) noter(d.boutique, p.date); });
      });
    }
    touchees.forEach((dates, boutique) => {
      const b = (apres.boutiques || []).find((x) => x.nom === boutique);
      if (!b || b.depot || b.nom === CAISSE_COMPTABLE) return;
      dates.forEach((date) => {
        if (!estCloturee(apres, boutique, date)) return;
        const x = clotureDepassee(apres, boutique, date, totalVente);
        if (!x || clotureDepassee(avant, boutique, date, totalVente)) return;
        pousser({
          destinataires: [...idsDeLaBoutique(apres, boutique, ["vendeur", "gerant"]), ...idsAdmins(apres, !!b.formation)],
          titre: `🔁 Clôture dépassée — ${boutique}`,
          texte: `La caisse a bougé après la clôture du ${dFR(x.date)} (${x.bouge > 0 ? "+" : ""}${fmt(x.bouge)}) : elle est à refaire dans 🔒 Caisse.`,
          ecran: "caisse", tag: `depassee:${boutique}:${x.date}`, formation: !!b.formation,
        });
      });
    });
  }

  return envois;
}

// Les index de stock d'un état sont TOUJOURS recalculés ici : `apres` vient
// d'un écran (index périmé recopié par le spread) et `avant` n'est pas
// forcément indexé. O(ventes) une fois, au lieu d'une passe par article.
const avecIndex = (etat) => ({ ...etat, __index: construireIndexDb(etat) });

// ---- LE point d'entrée de App.jsx ----
export function envoisDepuisSave(avant, apres, profile) {
  if (!avant || !apres) return [];
  const moi = profile?.id || null;
  return [...envoisMessages(avant, apres), ...infosDepuisDiff(avant, apres)]
    .map((e) => ({ ...e, destinataires: e.destinataires.filter((id) => id !== moi) }))
    .filter((e) => e.destinataires.length);
}
