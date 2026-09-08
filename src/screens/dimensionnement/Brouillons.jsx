// ============================================================
// screens/dimensionnement/Brouillons.jsx — 📝 Mes brouillons (demande Timo,
// 08/09/2026). Un devis enregistré avec son client (nom + numéro, ou compte
// existant) SANS l'envoyer : ni compte créé, ni WhatsApp. Il se reprend dans
// son volet, s'envoie par WhatsApp, ou se supprime. Rangé dans la fiche de
// celui qui l'a fait (`brouillons_devis`) : personnel, synchronisé, sans SQL.
// ============================================================
import { uid, fmt, today, dFR } from "../../lib/core";
import { uAlert, uConfirm } from "../../components/ui";
import { bloquerSiLecture } from "../../lib/calculs";
import { brouillonsDe, retirerBrouillon } from "./devisCommun";
import { resoudreClientDevis, envoyerDevisEtOuvrirWhatsApp } from "./Partages";

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
    if (!await uConfirm(`Supprimer le brouillon de ${b.client?.nom || "?"} (${fmt(b.devis?.total)}) ?`)) return;
    save(retirerBrouillon(db, profile.id, b.id), `📝 Brouillon de devis supprimé — ${b.client?.nom || "?"}`);
  };

  // Envoi direct, sans repasser par le volet : même chemin que « Envoyer par
  // WhatsApp » (compte trouvé ou créé, devis rangé dans sa fiche, WhatsApp
  // ouvert), puis le brouillon disparaît.
  const envoyer = async (b) => {
    if (bloquerSiLecture(db, profile)) return;
    const clientDevis = b.client?.id || "__nouveau__";
    const nouvClient = { nom: b.client?.nom || "", tel: b.client?.tel || "" };
    const resolu = await resoudreClientDevis(db, clientDevis, nouvClient, profile, b.devis?.boutique);
    if (!resolu) return;
    const { compte, motDePasse, dbApres } = resolu;
    const devis = { ...b.devis, id: uid(), date: today(), heure: new Date().toTimeString().slice(0, 5), par: profile.nom, par_id: profile.id, par_role: profile.role, statut: "propose" };
    const envoye = await envoyerDevisEtOuvrirWhatsApp({
      dbApres: retirerBrouillon(dbApres, profile.id, b.id), compte, motDePasse, devis, save, profile, nouvClient,
      ligneEntete: [`📝 Devis ${libelleVolet(b)} — *${fmt(devis.total)}*`],
    });
    if (envoye) uAlert(`✅ Devis envoyé dans l'espace de ${compte.nom}.\n\nWhatsApp s'ouvre avec ses identifiants et le lien.`);
  };

  return (
    <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
      <div className="font-bold mb-1">📝 Mes brouillons</div>
      <div className="text-xs text-slate-500 mb-3">
        Des devis enregistrés sans être envoyés. Reprendre rouvre le volet avec tout ce qui avait été saisi ; Envoyer les dépose dans l'espace du client et ouvre WhatsApp.
        Une fois envoyé ou converti en vente, le brouillon disparaît.
      </div>
      {liste.length === 0 ? (
        <div className="text-sm text-slate-500">Aucun brouillon. Dans un volet, choisissez le client puis « 📝 Enregistrer un brouillon ».</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {liste.map((b) => (
            <div key={b.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
              <div className="flex-1 min-w-[12rem]">
                <span className="font-bold">{b.client?.nom || "?"}</span>{b.client?.tel ? <span className="text-slate-500"> · {b.client.tel}</span> : null}
                <div className="text-xs text-slate-500">{libelleVolet(b)} · {fmt(b.devis?.total)} · {dFR(b.date)}{b.client?.id ? "" : " · compte à créer à l'envoi"}</div>
              </div>
              <button onClick={() => onReprendre(b)} className="px-3 py-1 rounded-lg bg-sky-800 text-white text-xs font-bold hover:bg-sky-900">✏️ Reprendre</button>
              <button onClick={() => envoyer(b)} className="px-3 py-1 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700">📲 Envoyer par WhatsApp</button>
              <button onClick={() => supprimer(b)} className="px-3 py-1 rounded-lg border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50">Supprimer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
