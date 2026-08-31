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
import { enregistrerCompteLocal, oublierCompteLocal } from "../db";

// ============ CONNEXION ============
export function Login({ db, apparence, onLogin, save }) {
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
    // ⚠ DÉFAUT SIGNALÉ PAR TIMO (20/08/2026) : « les anciens comptes supprimés
    // arrivent toujours à se connecter ». La cause : le serveur n'était
    // consulté QUE si le compte manquait sur l'appareil. Un compte supprimé
    // mais encore présent dans la copie locale passait donc sans que personne
    // ne vérifie — et il pouvait passer indéfiniment, tant que l'appareil ne
    // s'était pas resynchronisé.
    //
    // Désormais, DÈS QU'IL Y A DU RÉSEAU, c'est le serveur qui fait foi : on
    // lui demande toujours, même quand la fiche est déjà là. S'il refuse, la
    // copie périmée est effacée de l'appareil dans la foulée — la deuxième
    // tentative ne trouvera plus rien, exactement ce que demandait Timo.
    //
    // ⚠ Un serveur INJOIGNABLE n'est pas un refus : dans ce cas on retombe
    // sur la copie locale, sinon plus personne ne travaillerait dès que le
    // réseau faiblit. C'est toute l'utilité du drapeau « refuse ».
    if (navigator.onLine) {
      setConnexionEnCours(true);
      const r = await chercherCompteEnLigne(nomSaisi.trim(), pwd);
      setConnexionEnCours(false);
      if (r.refuse) {
        if (u) await oublierCompteLocal(u.id);
        setErr("Ce compte n'existe plus, ou le mot de passe a changé. Rapprochez-vous de l'administrateur.");
        return;
      }
      if (r.user) {
        u = r.user;
        // La fiche est rangée en local : les connexions suivantes se feront
        // sans réseau. On n'utilise volontairement pas save() — ce n'est pas
        // une action de l'utilisateur, et personne n'est encore connecté.
        await enregistrerCompteLocal(u);
      }
    }
    if (!u) {
      setErr(navigator.onLine
        ? "Utilisateur introuvable."
        : "Première connexion sur cet appareil : connectez-vous au réseau une fois. Ensuite, l'application fonctionnera hors ligne.");
      return;
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
  // ⚠ FUSION champ par champ, et non « l'un OU l'autre » (relevé par Timo,
  // 31/08/2026) : la fiche boutique locale fait foi pour chaque réglage
  // qu'elle porte, et l'apparence servie par le serveur COMBLE ce qui
  // manque. Avant, une fiche boutique présente mais incomplète (créée après
  // le réglage, ou reçue partiellement) écartait TOUTE l'apparence serveur —
  // et le téléphone d'un client, purgé à chaque déconnexion, perdait tout.
  const b0 = { ...(apparence || {}), ...(db.boutiques[0] || {}) };
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
  // Règle volontairement simple, pour rester prévisible quel que soit le
  // palier choisi : tant qu'il reste un voile, le flou protège la lecture ;
  // à « totalement transparent », il disparaît et l'image est nette — c'est
  // exactement ce qu'on demande en choisissant zéro.
  const flou = opacite > 0 ? "backdrop-blur-sm" : "";
  // ⚠ Demande Timo (20/08/2026) : « ajouter dans ces cadres un fond avec des
  // bulles qui se mouvementent ». Option décorative, éteinte par défaut.
  const bulles = b0.accueil_bulles === true;
  // ⚠ Demande Timo : la couleur des bulles se règle désormais à part. Sans
  // réglage, elle suit celle du bandeau — donc rien ne change pour qui n'y
  // touche pas.
  const couleurBulles = b0.accueil_couleur_bulles || accueilBadge;
  // ⚠ Demande Timo : « ajouter dans cet espace des étoiles de différentes
  // tailles, comme dans l'univers ». Habille le grand aplat bleu qui entoure
  // la carte sur un écran large. Éteint par défaut.
  const etoiles = b0.accueil_etoiles === true;
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
  // ⚠ Demande Timo (20/08/2026) : sous Windows la fenêtre est large, la carte
  // reste au centre et tout le reste est un aplat bleu. L'image peut désormais
  // occuper TOUTE la fenêtre, la carte devenant un panneau posé dessus — et
  // comme les cadres sont déjà réglables en transparence, l'image se prolonge
  // à travers eux sans être recadrée deux fois.
  // Éteint par défaut : l'écran de ceux qui ne changent rien ne bouge pas.
  const pleinEcran = accueilImage && b0.accueil_image_etendue === true;
  return (
    <div
      className={`min-h-screen relative flex items-center justify-center p-4${pleinEcran ? "" : " bg-gradient-to-br from-slate-900 via-sky-950 to-sky-900"}`}
      style={pleinEcran ? {
        backgroundColor: accueilFond,
        backgroundImage: `url(${accueilImage})`,
        backgroundSize: tailleImage,
        backgroundPosition: positionImage,
        backgroundRepeat: "no-repeat",
      } : undefined}
    >
      {/* Voile sombre entre l'image et la carte : sans lui, une photo claire
          rendrait le texte de la carte difficile à lire, et la carte elle-même
          se fondrait dans le décor. */}
      {pleinEcran && <div className="absolute inset-0" style={{ backgroundColor: "rgba(2, 20, 40, 0.45)" }} />}
      {etoiles && <Etoiles />}
      <div
        className="relative z-10 overflow-hidden rounded-2xl p-6 w-full max-w-sm shadow-xl bg-no-repeat"
        style={{
          // La couleur reste posée SOUS l'image : en mode « image entière »,
          // c'est elle qui comble les bandes laissées libres. Avant, la
          // couleur était purement ignorée dès qu'une image existait.
          backgroundColor: accueilFond,
          // En plein écran, l'image est déjà posée derrière TOUTE la fenêtre :
          // la remettre ici la recadrerait une seconde fois, et les deux
          // cadrages ne coïncideraient pas.
          ...(accueilImage && !pleinEcran ? {
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
          {bulles && <Bulles couleur={couleurBulles} />}
          <div className="relative">
          <img src={LOGO} alt="BMI Togo" className="mx-auto mb-3 w-40 h-auto" />
          <div className="text-xl font-bold text-slate-900">GESTION SYSTÈME</div>
          <span className="inline-block px-3 py-1 rounded-full text-sm font-bold text-white mt-2" style={{ backgroundColor: accueilBadge }}>{accueilTexte}</span>
          <div className="text-xs text-slate-400 mt-1">Espace de gestion — Lomé, Togo</div>
          </div>
        </div>
        <div className={`relative overflow-hidden rounded-xl p-3 ${flou}`} style={{ backgroundColor: fondCadre }}>
          {bulles && <Bulles couleur={couleurBulles} />}
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

// ============ CIEL ÉTOILÉ (option décorative) ============
// Demande Timo (20/08/2026). ⚠ PREMIÈRE VERSION REFUSÉE à juste titre :
// « c'est des boutons lumineux, pas des étoiles ». Des ronds tous pareils,
// tous avec le même halo, ne ressemblent effectivement à rien.
//
// Un ciel se compose de trois choses très inégales en nombre :
//   • beaucoup de POUSSIÈRE — des points minuscules et pâles, sans halo.
//     C'est le fond du ciel, et c'est ce qui manquait le plus ;
//   • très peu d'ASTRES — dessinés avec leurs quatre branches. C'est ce
//     dessin, pas le halo, qui fait lire une étoile comme une étoile ;
//   • quelques NÉBULEUSES — de larges voiles flous qui donnent la couleur
//     et la profondeur, « comme dans une galaxie lointaine ».
//
// Positions, tailles et rythmes FIXES, calculés une seule fois au
// chargement : une valeur tirée au hasard changerait à chaque réaffichage
// de React, et le ciel se réarrangerait sous les yeux au lieu de scintiller.

// Suite déterministe — même ciel à chaque ouverture.
const suite = (i, a, b) => (((i + a) * b + 104729) % 233280) / 233280;

// Un vrai champ d'étoiles n'est jamais uniformément blanc.
const TEINTES = ["#ffffff", "#dbe9ff", "#cfe0ff", "#ffeccf", "#ffffff", "#e8f1ff"];

const POUSSIERE = Array.from({ length: 130 }, (_, i) => {
  const a = suite(i, 0, 9301);
  const b = suite(i, 7, 4093);
  const c = suite(i, 13, 7919);
  return {
    gauche: +(a * 100).toFixed(2),
    haut: +(b * 100).toFixed(2),
    // Le fond du ciel : toujours les plus petites, mais un peu plus visibles
    // qu'à la première version (Timo : « les agrandir encore un peu »).
    taille: +(1.1 + c * 1.9).toFixed(2),
    teinte: TEINTES[i % TEINTES.length],
    duree: +(3 + a * 5).toFixed(2),
    retard: +(c * 6).toFixed(2),
  };
});

// Rares — une dizaine sur tout l'écran. C'est leur rareté qui les fait
// remarquer, et leurs branches qui les font reconnaître.
//
// ⚠ POSITIONS ÉCRITES À LA MAIN, et pas calculées. La suite déterministe
// utilisée pour la poussière est trop régulière sur onze valeurs seulement :
// elle alignait les astres en diagonale, ce qui se voyait immédiatement.
// Elles évitent aussi le centre de l'écran, où se trouve la carte — un astre
// caché derrière elle serait dessiné pour rien.
const ASTRES = [
  { gauche: 8, haut: 14, taille: 24 }, { gauche: 21, haut: 68, taille: 16 },
  { gauche: 14, haut: 41, taille: 13 }, { gauche: 33, haut: 9, taille: 19 },
  { gauche: 29, haut: 86, taille: 15 }, { gauche: 50, haut: 6, taille: 27 },
  { gauche: 68, haut: 22, taille: 18 }, { gauche: 78, haut: 61, taille: 22 },
  { gauche: 88, haut: 33, taille: 14 }, { gauche: 72, haut: 88, taille: 18 },
  { gauche: 93, haut: 76, taille: 21 },
].map((a, i) => ({
  ...a,
  teinte: TEINTES[(i * 3) % TEINTES.length],
  // Des rythmes premiers entre eux : deux astres voisins ne scintillent
  // jamais ensemble, ce qui ferait clignoter tout le ciel d'un bloc.
  duree: +(3.4 + (i % 5) * 0.9).toFixed(2),
  retard: +((i * 1.7) % 6).toFixed(2),
}));

// Trois voiles seulement : au-delà, le fond devient laiteux et la carte
// perd son contraste.
const NEBULEUSES = [
  { gauche: -8, haut: -12, taille: 62, teinte: "rgba(56, 132, 255, 0.30)", duree: 34, retard: 0 },
  { gauche: 58, haut: 44, taille: 55, teinte: "rgba(150, 90, 255, 0.24)", duree: 44, retard: 6 },
  { gauche: 22, haut: 66, taille: 46, teinte: "rgba(0, 190, 210, 0.18)", duree: 39, retard: 12 },
];

function Etoiles() {
  return (
    <div className="bmi-ciel" aria-hidden="true">
      {NEBULEUSES.map((n, i) => (
        <span
          key={`n${i}`}
          className="bmi-nebuleuse"
          style={{
            left: `${n.gauche}%`,
            top: `${n.haut}%`,
            width: `${n.taille}%`,
            // Hauteur en unités d'écran pour rester ronde quelle que soit
            // la largeur de la fenêtre.
            height: `${n.taille}vh`,
            background: `radial-gradient(circle, ${n.teinte} 0%, transparent 70%)`,
            animationDuration: `${n.duree}s`,
            animationDelay: `${n.retard}s`,
          }}
        />
      ))}
      {POUSSIERE.map((e, i) => (
        <span
          key={`p${i}`}
          className="bmi-poussiere"
          style={{
            left: `${e.gauche}%`,
            top: `${e.haut}%`,
            width: e.taille,
            height: e.taille,
            backgroundColor: e.teinte,
            animationDuration: `${e.duree}s`,
            animationDelay: `${e.retard}s`,
          }}
        />
      ))}
      {ASTRES.map((e, i) => (
        <span
          key={`a${i}`}
          className="bmi-astre"
          style={{
            left: `${e.gauche}%`,
            top: `${e.haut}%`,
            width: e.taille,
            height: e.taille,
            "--bmi-astre-couleur": e.teinte,
            animationDuration: `${e.duree}s`,
            animationDelay: `${e.retard}s`,
          }}
        />
      ))}
    </div>
  );
}

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
