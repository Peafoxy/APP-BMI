// ============================================================
// screens/Connexion.jsx — Écran de connexion.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState, useEffect } from "react";
import { LOGO, VERSION } from "../lib/constants";
import { verifierMotDePasse, definirMotDePasse } from "../lib/core";
import { Field, inputCls } from "../components/ui";
import { souhaitsDuJour } from "../lib/calculs";
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
  // ⚠ Demande Timo (20/08/2026) : les deux cadres blancs étaient figés à 75 %
  // et 90 % d'opacité — impossible de laisser voir l'image de fond. Ils sont
  // désormais réglables depuis Paramètres, jusqu'à la transparence totale.
  const opacite = Math.max(0, Math.min(100,
    b0.accueil_opacite_cadres === undefined || b0.accueil_opacite_cadres === ""
      ? 85 : Number(b0.accueil_opacite_cadres)));
  const fondCadre = `rgba(255,255,255,${opacite / 100})`;
  // Le flou d'arrière-plan sert à garder le texte lisible sur un fond chargé.
  // À transparence totale il irait contre l'intention : on veut justement
  // voir l'image nette. On le retire donc au-dessous de 20 %.
  const flou = opacite >= 20 ? "backdrop-blur-sm" : "";
  // ⚠ Demande Timo (20/08/2026) : « ajouter dans ces cadres un fond avec des
  // bulles qui se mouvementent ». Option décorative, éteinte par défaut.
  const bulles = b0.accueil_bulles === true;
  // Anniversaires du jour + messages libres de l'administrateur (voir
  // souhaitsDuJour dans lib/calculs.js). Tableau vide = aucune animation.
  const souhaits = souhaitsDuJour(db);
  // ⚠ Même demande : une image de fond était toujours recadrée pour remplir
  // la carte (« cover »), donc souvent amputée de ses bords. On laisse
  // choisir comment elle se pose, et où elle se cale.
  const ajustement = b0.accueil_image_ajustement || "remplir";
  const position = b0.accueil_image_position || "centre";
  const tailleImage = ajustement === "entier" ? "contain" : ajustement === "etirer" ? "100% 100%" : "cover";
  const positionImage = position === "haut" ? "top center" : position === "bas" ? "bottom center" : "center";
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-sky-950 to-sky-900 flex items-center justify-center p-4">
      <div
        className="relative z-10 overflow-hidden rounded-2xl p-6 w-full max-w-sm shadow-xl bg-no-repeat"
        style={{
          // La couleur reste posée SOUS l'image : en mode « image entière »,
          // c'est elle qui comble les bandes laissées libres. Avant, la
          // couleur était purement ignorée dès qu'une image existait.
          backgroundColor: accueilFond,
          ...(accueilImage ? {
            backgroundImage: `url(${accueilImage})`,
            backgroundSize: tailleImage,
            backgroundPosition: positionImage,
            backgroundRepeat: "no-repeat",
          } : {}),
        }}
      >
        {/* Voile blanc derrière le logo/titre, dont l'opacité est réglable
            dans Paramètres (0 % = cadre totalement invisible). */}
        <div className={`relative overflow-hidden text-center mb-5 rounded-xl p-3 ${flou}`} style={{ backgroundColor: fondCadre }}>
          {bulles && <Bulles couleur={accueilBadge} />}
          <div className="relative">
          <img src={LOGO} alt="BMI Togo" className="mx-auto mb-3 w-40 h-auto" />
          <div className="text-xl font-bold text-slate-900">GESTION SYSTÈME</div>
          <span className="inline-block px-3 py-1 rounded-full text-sm font-bold text-white mt-2" style={{ backgroundColor: accueilBadge }}>{accueilTexte}</span>
          <div className="text-xs text-slate-400 mt-1">Espace de gestion — Lomé, Togo</div>
          </div>
        </div>
        <div className={`relative overflow-hidden rounded-xl p-3 ${flou}`} style={{ backgroundColor: fondCadre }}>
          {bulles && <Bulles couleur={accueilBadge} />}
          <div className="relative space-y-3">
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
        {/* ⚠ Placé APRÈS les deux cadres, et donc AU-DESSUS d'eux (demande
            Timo : « pourquoi ça ne commence pas par le cadre d'en bas, celui
            qui comporte les lignes utilisateur et mot de passe ? »). Posé
            derrière, il disparaissait dès qu'un cadre était opaque. Il
            traverse maintenant toute la carte, du bas vers le haut.
            `pointer-events: none` (voir index.css) le rend totalement
            inoffensif : il ne s'interpose jamais entre le doigt et un champ. */}
        {souhaits.length > 0 && <Souhaits messages={souhaits} couleur={accueilBadge} />}
      </div>
    </div>
  );
}

// ============ BULLES ANIMÉES (option décorative) ============
// Demande Timo (20/08/2026). Position, taille, durée et retard sont FIXES et
// non tirés au hasard : une valeur aléatoire changerait à chaque réaffichage
// de React, et les bulles sauteraient d'un coup au lieu de monter calmement.
// La couleur suit celle du bandeau, pour rester accordée au reste de l'écran.
// ⚠ Durées revues à la baisse (Timo : « c'est trop lent ») : 8 à 16 secondes
// pour traverser un cadre de 200 pixels donnaient un mouvement presque
// imperceptible. Les retards au démarrage sont aussi raccourcis, pour que le
// cadre s'anime dès l'ouverture de l'écran au lieu de rester vide 7 secondes.
const BULLES = [
  { gauche: 6,  taille: 26, duree: 6.5, retard: 0 },
  { gauche: 18, taille: 14, duree: 4.5, retard: 0.8 },
  { gauche: 31, taille: 34, duree: 7.5, retard: 1.6 },
  { gauche: 44, taille: 18, duree: 5.2, retard: 0.4 },
  { gauche: 57, taille: 24, duree: 6.8, retard: 2.4 },
  { gauche: 69, taille: 12, duree: 4.0, retard: 1.2 },
  { gauche: 80, taille: 30, duree: 7.0, retard: 2.0 },
  { gauche: 91, taille: 16, duree: 5.0, retard: 2.8 },
];

// ============ SOUHAITS QUI MONTENT (anniversaires et fêtes) ============
// Demande Timo (20/08/2026), montés DANS le cadre du haut — comme les bulles.
//
// ⚠ UN SEUL message à la fois. Le cadre ne fait qu'environ 200 pixels de
// haut : deux messages qui s'y croisent se chevauchent et deviennent
// illisibles.
//
// ⚠ Et il ne faut PAS chercher à les enchaîner uniquement en CSS, avec des
// retards décalés : toutes les animations ayant la même durée, elles se
// resynchronisent au deuxième tour et repartent ensemble — précisément ce
// qu'on veut éviter. On fait donc tourner le message en JavaScript, et un
// seul élément est affiché à la fois. Le changement de `key` remonte
// l'élément, ce qui relance proprement l'animation depuis le bas.
// 11 secondes : la traversée fait désormais toute la hauteur de la carte,
// pas seulement celle du cadre du haut.
const MONTEE_SOUHAIT = 11;

function Souhaits({ messages, couleur }) {
  const [index, setIndex] = useState(0);
  const nombre = messages.length;
  useEffect(() => {
    if (nombre < 2) return undefined;
    const minuterie = setInterval(
      () => setIndex((i) => (i + 1) % nombre),
      MONTEE_SOUHAIT * 1000,
    );
    return () => clearInterval(minuterie);
  }, [nombre]);

  const teinte = /^#[0-9a-f]{6}$/i.test(String(couleur)) ? couleur : "#0284c7";
  // Repli sur 0 si la liste a raccourci entre-temps (message retiré dans
  // Paramètres pendant que l'écran est affiché).
  const texte = messages[index] || messages[0];
  return (
    <div className="bmi-souhaits" aria-hidden="true">
      <div
        key={index}
        className="bmi-souhait"
        style={{ animationDuration: `${MONTEE_SOUHAIT}s`, "--bmi-souhait-couleur": teinte }}
      >
        {texte}
      </div>
    </div>
  );
}

function Bulles({ couleur }) {
  // Suffixe hexadécimal ajouté à la couleur = son opacité. « 4d » ≈ 30 % pour
  // le corps, « 80 » ≈ 50 % pour le liseré : assez visible pour se lire comme
  // une bulle (Timo : « elles apparaissent à peine »), assez dilué pour ne pas
  // gêner la lecture du texte posé au-dessus.
  const valide = /^#[0-9a-f]{6}$/i.test(String(couleur));
  const teinte = valide ? `${couleur}4d` : "rgba(2,132,199,0.3)";
  const bord = valide ? `${couleur}80` : "rgba(2,132,199,0.5)";
  return (
    <span className="bmi-bulles" aria-hidden="true">
      {BULLES.map((b, i) => (
        <span
          key={i}
          className="bmi-bulle"
          style={{
            left: `${b.gauche}%`,
            width: b.taille,
            height: b.taille,
            animationDuration: `${b.duree}s`,
            animationDelay: `${b.retard}s`,
            "--bmi-bulle-couleur": teinte,
            "--bmi-bulle-bord": bord,
          }}
        />
      ))}
    </span>
  );
}
