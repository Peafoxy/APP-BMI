// ============================================================
// screens/MesDonnees.jsx — 🔒 MES DONNÉES PERSONNELLES (le client)
//
// Timo, 19/09/2026 : « au lieu de "vos données personnelles", dire "mes
// données personnelles", et ramener ça en onglet à côté de message ».
//
// ⚠ LES DEUX DEMANDES SE TIENNENT, et c'est pour ça qu'elles arrivent
// ensemble. Un PANNEAU au bas d'un autre écran, c'est BMI qui montre au
// client ce qu'elle détient : « VOS données ». Un ONGLET à lui, c'est le
// client qui vient chercher ce qui le concerne : « MES données ». Le mot
// suit la place, et la place suit à qui la chose appartient.
//
// ⚠ On ne change QUE le titre et l'emplacement. Le dossier, le document
// imprimé et les mentions légales restent EXACTEMENT les mêmes — ils sont
// écrits UNE fois (dossierClient → dossierPersonnel → genererDossierPersonnel),
// les mêmes que ⚙ Paramètres. Deux sources finiraient par se contredire, et
// c'est le client qui verrait la différence.
//
// ⚠ DANS LES MENTIONS, « vous » RESTE : là c'est BMI qui s'adresse à lui
// (« vous disposez d'un droit d'accès… »). Le titre est à LUI, le texte de
// loi est de NOUS. Les mélanger sonnerait faux.
//
// ⚠ L'écran ne refiltre RIEN, et il faut le savoir en le lisant :
// sur l'appareil du client, la base ne contient que ses données.
// Les politiques du serveur sont la seule barrière — règle posée depuis
// toujours, et c'est pour ça qu'aucun filtre n'est écrit ici.
// ============================================================
import { fmt, today, dFR, envoyerWhatsApp } from "../lib/core";
import { Panel, uAlert } from "../components/ui";
import { boutiquesVisibles, estCompteFormation } from "../lib/calculs";
import { dossierClient } from "../lib/effacementClient";
import { dossierPersonnel, resumePourLeClient, texteDemandeDonnees } from "../lib/dossierPersonnel";
import { dureeConservation } from "../lib/conservation";
import { genererDossierPersonnel } from "../pdf";
import { LOGO } from "../lib/constants";

export function MesDonnees({ db, profile }) {
  const moi = (db.users || []).find((u) => u.id === profile.id) || profile;
  const fiche = (db.clients_installes || []).find((c) => c.user_id === profile.id);

  const monDossier = dossierClient({
    comptes: [{ ...moi, role: "client" }],
    ventes: db.ventes || [],
    dettes: db.dettes || [],
    proformas: db.proformas || [],
    commandes: db.commandes || [],
    chantiers: db.clients_installes || [],
    prospects: [],
    messages: db.messages || [],
    audits: [],
  }, { nom: moi.nom_base || profile.nom, tel: moi.tel || profile.tel });

  // La durée de conservation vient du réglage de la maison (⚙ Paramètres) :
  // le client lit le chiffre en vigueur, jamais un chiffre gravé.
  const maVue = dossierPersonnel(monDossier, { fmt, dFR, duree: dureeConservation(db) });

  const telecharderMesDonnees = () => {
    genererDossierPersonnel(maVue, {
      logo: LOGO,
      formation: estCompteFormation(db, profile),
      edite: dFR(today()),
      client: moi.nom_base || profile.nom,
    });
  };

  // À qui écrire : la boutique de son chantier, sinon celle de son dernier
  // achat, sinon la première qui porte un numéro. On ne code JAMAIS un numéro
  // en dur — il se règle dans ⚙ Paramètres comme tout le reste.
  // ⚠⚠ LA LISTE EST LE TROISIÈME ARGUMENT, ET ELLE EST OBLIGATOIRE : sans
  // elle, `boutiquesVisibles` faisait `undefined.filter(...)` — écran blanc
  // pour tout client à la connexion (capture Timo, 19/09/2026).
  const boutiqueContact = (() => {
    const toutes = boutiquesVisibles(db, profile, db.boutiques || []);
    const nom = fiche?.boutique || (db.ventes || [])[0]?.boutique;
    return toutes.find((b) => b.nom === nom && b.tel) || toutes.find((b) => b.tel) || null;
  })();

  // ⚠ WhatsApp n'envoie jamais tout seul : le texte arrive dans sa case de
  // saisie, il le relit avant d'appuyer. Et un `quoi` inconnu retombe sur la
  // CORRECTION, jamais sur la suppression (lib/dossierPersonnel.js).
  const demanderSurMesDonnees = (quoi) => {
    if (!boutiqueContact?.tel) {
      uAlert("Le numéro de votre boutique n'est pas encore renseigné.\n\nÉcrivez-nous depuis l'onglet 💬 Messages : votre demande arrivera de la même façon.");
      return;
    }
    envoyerWhatsApp(boutiqueContact.tel, texteDemandeDonnees(moi.nom_base || profile.nom, quoi));
  };

  const resume = resumePourLeClient(maVue);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-1">🔒 Mes données personnelles</div>
        <div className="text-xs text-slate-500 mb-3">
          Voici exactement ce que BMI Togo conserve à votre sujet. Vous pouvez le télécharger, et demander à tout moment
          qu'on le corrige ou qu'on l'efface.
        </div>

        {/* ⚠ Les familles VIDES ne s'affichent PAS ici : sur son écran, une
            liste de « aucun / aucune » n'apprend rien. Elles restent dans le
            DOCUMENT, où elles prouvent qu'on a regardé partout. */}
        {resume.length === 0 ? (
          <div className="text-sm text-slate-500 mb-3">
            En dehors de votre compte, nous ne conservons encore rien à votre sujet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2 mb-3">
            {resume.map((x) => (
              <div key={x.titre} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
                <b>{x.nb}</b> <span className="text-slate-600">{x.titre.replace(/^Vos?\s+/i, "").replace(/^Votre\s+/i, "")}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={telecharderMesDonnees} className="px-4 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">
          🖨 Télécharger mes données (PDF)
        </button>

        {/* Les MÊMES mentions que le document imprimé — littéralement celles
            du PDF qu'il vient de télécharger, jamais un second texte. */}
        <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1.5">
          {maVue.mentions.map((m, i) => <p key={i}>{m}</p>)}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => demanderSurMesDonnees("correction")} className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50">
            Demander une correction
          </button>
          <button onClick={() => demanderSurMesDonnees("suppression")} className="px-4 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50">
            Demander la suppression
          </button>
        </div>
        <div className="text-[11px] text-slate-400 mt-2">
          Votre demande part par WhatsApp vers votre boutique — vous la relisez avant de l'envoyer. Vous pouvez aussi nous écrire depuis l'onglet 💬 Messages.
        </div>
      </Panel>
    </div>
  );
}
