// ============ 🧲 LE DEVIS D'UN PROSPECT RESTE À SON COMMERCIAL ============
// Timo, 15/11/2026 : « si depuis prospect, le responsable commercial envoie le
// devis, il reste toujours au nom du commercial qui a enregistré ? » — non :
// la commission d'une vente va à celui dont le DEVIS porte le nom, et la case
// « 👥 Devis établi pour » restait sur « Moi ». Un oubli, et le commercial qui
// a trouvé le client perdait sa commission sans que personne ne le voie.
// → « Les trois, lance » :
//   1. le responsable commercial prépare le devis des prospects de SON équipe ;
//   2. préparé depuis la fiche, le devis est proposé au nom du commercial ;
//   3. à l'envoi, un client qui est le prospect d'un AUTRE est signalé.
//
// ⚠ Ce fichier n'importe RIEN (lisible par Node, exercé par le banc). Les
// listes reçues sont DÉJÀ filtrées par l'espace regardé — jamais `db` entier.

const chiffres = (tel) => String(tel || "").replace(/\D/g, "");
const huit = (tel) => chiffres(tel).slice(-8);
const memeNumero = (a, b) => huit(a).length === 8 && huit(a) === huit(b);
const memeNom = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// Le COMPTE du commercial écrit sur la fiche. Un nom est un affichage, un
// identifiant est une personne : entre deux homonymes on ne devine pas (null).
// Jamais un client, jamais un compte désactivé.
export function compteDuCommercial(prospect, personnes) {
  const nom = String(prospect?.commercial || "").trim();
  if (!nom) return null;
  const trouves = (personnes || []).filter((u) => u && u.role !== "client" && u.actif !== false && memeNom(u.nom, nom));
  const ids = [...new Set(trouves.map((u) => u.id))];
  return ids.length === 1 ? trouves[0] : null;
}

// Qui prépare le devis d'un prospect depuis sa fiche :
//   - l'administrateur ;
//   - le commercial de la fiche ;
//   - le responsable commercial, pour un commercial de SON équipe (`auteurs` =
//     ceux pour qui il peut établir un devis : ses commerciaux).
export function peutPreparerDevisDuProspect(profile, prospect, personnes, auteurs) {
  if (!profile || !prospect) return false;
  if (profile.role === "admin") return true;
  if (memeNom(prospect.commercial, profile.nom)) return true;
  if (profile.role !== "resp_commercial") return false;
  const compte = compteDuCommercial(prospect, personnes);
  return !!compte && (auteurs || []).some((u) => u.id === compte.id);
}

// Au nom de qui PROPOSER le devis préparé depuis la fiche : le commercial de
// la fiche, s'il n'est pas celui qui clique et s'il est dans la liste de ceux
// pour qui on peut établir un devis. Sinon "" (« Moi »).
export function auteurProposePourProspect(profile, prospect, personnes, auteurs) {
  const compte = compteDuCommercial(prospect, personnes);
  if (!compte || compte.id === profile?.id) return "";
  return (auteurs || []).some((u) => u.id === compte.id) ? compte.id : "";
}

// Le prospect d'un AUTRE : une fiche (pas archivée) qui porte ce numéro, dont
// le commercial n'est pas l'auteur du devis. La plus récente. Une fiche sans
// commercial, ou une demande de l'assistant que personne n'a prise, n'est à
// personne : rien à signaler.
export function prospectDUnAutre(prospects, tel, auteur) {
  if (huit(tel).length < 8) return null;
  const candidats = (prospects || []).filter((p) => p && !p.archive && !p.supprime_le
    && memeNumero(p.tel, tel)
    && String(p.commercial || "").trim()
    && !(p.source === "assistant_whatsapp" && !p.pris_le)
    && !memeNom(p.commercial, auteur?.nom));
  if (candidats.length === 0) return null;
  return candidats.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
}

// Les mots de la question, écrits UNE fois.
export const CHOIX_AU_NOM_DE = (nom) => `Envoyer au nom de ${nom}`;
export const CHOIX_GARDER = (nom) => `Garder au nom de ${nom}`;
export function questionProspectDUnAutre(prospect, auteurNom, peutChanger) {
  const debut = `⚠ Ce client est le prospect de ${prospect.commercial}${prospect.date ? ` (enregistré le ${String(prospect.date).split("-").reverse().join("/")})` : ""}.\n\nLa commission d'une vente va à la personne dont le devis porte le nom. Ce devis est au nom de ${auteurNom}.`;
  return peutChanger
    ? `${debut}\n\nAu nom de qui part-il ?`
    : `${debut}\n\nS'il part ainsi, ${prospect.commercial} ne touchera pas de commission sur ce client. Continuer quand même ?`;
}
