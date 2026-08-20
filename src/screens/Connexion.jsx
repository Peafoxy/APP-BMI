// ============================================================
// screens/Connexion.jsx — Écran de connexion.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { LOGO, VERSION } from "../lib/constants";
import { verifierMotDePasse, definirMotDePasse } from "../lib/core";
import { Field, inputCls } from "../components/ui";
import { synchroniserAuth, chercherCompteEnLigne } from "../supabaseClient";
import { enregistrerCompteLocal } from "../db";

// ============ CONNEXION ============
export function Login({ db, onLogin, save }) {
  const [nomSaisi, setNomSaisi] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwdVisible, setPwdVisible] = useState(false);
  const [err, setErr] = useState("");
  const [connexionEnCours, setConnexionEnCours] = useState(false);
  const go = async () => {
    const saisie = nomSaisi.trim().toLowerCase();
    if (!saisie) { setErr("Entrez votre nom d'utilisateur."); return; }
    let u = db.users.find((x) => x.nom.trim().toLowerCase() === saisie);
    // ⚠ ÉTAPE 2 de la fermeture du « trou n° 1 » : la table des comptes n'est
    // plus téléchargée à l'avance (elle était lisible par n'importe qui). Un
    // appareil NEUF ne connaît donc encore personne : on demande au serveur
    // LA fiche de l'identifiant saisi, qu'il ne rend que si le mot de passe
    // est le bon. Ce chemin ne sert QU'À la toute première connexion sur un
    // appareil — ensuite la fiche est en local et tout marche hors réseau,
    // exactement comme avant.
    if (!u) {
      setConnexionEnCours(true);
      const r = await chercherCompteEnLigne(nomSaisi.trim(), pwd);
      setConnexionEnCours(false);
      if (r.error === "hors_ligne") {
        setErr("Première connexion sur cet appareil : connectez-vous au réseau une fois. Ensuite, l'application fonctionnera hors ligne.");
        return;
      }
      if (r.error || !r.user) { setErr(r.error || "Utilisateur introuvable."); return; }
      u = r.user;
      // La fiche est rangée en local : les connexions suivantes se feront
      // sans réseau. On n'utilise volontairement pas save() — ce n'est pas
      // une action de l'utilisateur, et personne n'est encore connecté.
      await enregistrerCompteLocal(u);
    }
    if (u.actif === false) { setErr("Ce compte a été bloqué par l'administrateur."); return; }
    const { ok, aMigrer } = await verifierMotDePasse(u, pwd);
    if (!ok) { setErr("Mot de passe incorrect."); return; }
    // Migration transparente vers le hachage renforcé (sel individuel + PBKDF2),
    // qu'il s'agisse d'un ancien hachage à sel partagé ou d'un mot de passe en clair.
    // ⚠ 2.99.43 : on nettoie AUSSI les champs « fantômes » — un compte déjà au
    // format fort qui traînerait encore un vieux `pwd` (en clair) ou `pwd_hash`
    // (ancien hachage faible), par exemple ramené par la synchronisation d'un
    // appareil resté longtemps hors ligne. À la première connexion réussie,
    // ces restes sont définitivement supprimés et la suppression se propage.
    const resteAncienChamp = u.pwd !== undefined || (u.pwd_hash !== undefined && u.pwd_salt && u.pwd_hash2);
    if ((aMigrer || resteAncienChamp) && save) {
      const nouveauxChamps = await definirMotDePasse(pwd);
      save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, ...nouveauxChamps } : x)) });
    }
    // Établit une vraie session Supabase sécurisée AVANT de continuer — et non
    // en arrière-plan sans attendre : sinon la synchronisation générale qui
    // démarre juste après risquait de partir AVANT que la session ne soit
    // prête, et ne récupérait alors que les données publiques (les comptes),
    // pas le reste (devis, chantiers, messages...). Un échec ici (hors ligne,
    // serveur indisponible) ne bloque jamais la connexion locale.
    setConnexionEnCours(true);
    await synchroniserAuth(u.id, pwd).catch(() => {});
    setConnexionEnCours(false);
    onLogin(u);
  };
  // Personnalisation de l'écran de connexion (fêtes, etc.), réglée dans
  // Paramètres par l'admin principal — stockée sur les boutiques (déjà
  // lisibles ici avant toute connexion), donc disponible directement.
  const b0 = db.boutiques[0] || {};
  const accueilTexte = b0.accueil_texte || "BIENVENUE SUR NOTRE SYSTÈME";
  const accueilBadge = b0.accueil_couleur_badge || db.boutiques.find((b) => b.nom === "DEMAKPOE")?.couleur || "#0284c7";
  const accueilFond = b0.accueil_couleur_fond || "#ffffff";
  const accueilImage = b0.accueil_image || "";
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-sky-950 to-sky-900 flex items-center justify-center p-4">
      <div
        className="rounded-2xl p-6 w-full max-w-sm shadow-xl"
        style={accueilImage
          ? { backgroundImage: `url(${accueilImage})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { backgroundColor: accueilFond }}
      >
        {/* Fond semi-transparent derrière le logo/titre : reste lisible même
            si la couleur ou l'image de fond choisie est sombre. */}
        <div className="text-center mb-5 bg-white/75 backdrop-blur-sm rounded-xl p-3">
          <img src={LOGO} alt="BMI Togo" className="mx-auto mb-3 w-40 h-auto" />
          <div className="text-xl font-bold text-slate-900">GESTION SYSTÈME</div>
          <span className="inline-block px-3 py-1 rounded-full text-sm font-bold text-white mt-2" style={{ backgroundColor: accueilBadge }}>{accueilTexte}</span>
          <div className="text-xs text-slate-400 mt-1">Espace de gestion — Lomé, Togo</div>
        </div>
        <div className="space-y-3 bg-white/90 backdrop-blur-sm rounded-xl p-3">
          <Field label="Utilisateur">
            <input className={inputCls} autoCapitalize="words" placeholder="Votre nom" value={nomSaisi} onChange={(e) => { setNomSaisi(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && go()} />
          </Field>
          <Field label="Mot de passe">
            <div className="relative">
              <input type={pwdVisible ? "text" : "password"} className={`${inputCls} pr-10`} value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && go()} />
              <button type="button" tabIndex={-1} onClick={() => setPwdVisible((v) => !v)} aria-label={pwdVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"} title={pwdVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600">
                {pwdVisible ? "🙈" : "👁"}
              </button>
            </div>
          </Field>
          {err && <div className="text-xs text-red-600 font-semibold">{err}</div>}
          <button onClick={go} disabled={connexionEnCours} className="w-full py-2.5 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 disabled:opacity-60">{connexionEnCours ? "Connexion…" : "Se connecter"}</button>
          <div className="text-center text-[11px] text-slate-400">Version {VERSION}</div>
        </div>
      </div>
    </div>
  );
}
