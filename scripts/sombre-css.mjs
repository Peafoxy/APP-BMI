// 🌗 LE VRAI MODE SOMBRE DE TOUTE L'APPLICATION (Timo, 14/11/2026, « b, lance »
// — après le tableau de bord). Plus de retournement de la page par un filtre :
// chaque couleur de Tailwind reçoit sa couleur de NUIT, écrite UNE fois ici.
//
// Comment : Tailwind écrit `.bg-white{background-color:var(--color-white)}`.
// Cette passe (branchée dans vite.config.js, sur le CSS construit) réécrit la
// valeur en `var(--nf-white, var(--color-white))` : en mode CLAIR la variable
// `--nf-white` n'existe pas, donc RIEN ne change ; en mode SOMBRE la table
// ci-dessous la définit. Trois tables, parce qu'une même couleur ne devient
// pas la même chose selon son rôle :
//   --nf-*  un FOND   (blanc → bleu nuit, pastel → teinte sombre)
//   --nt-*  un TEXTE  (foncé → clair)
//   --nl-*  un TRAIT  (bordure claire → trait discret)
// Un cadre `data-garder-clair` (bandeau, verrou, aperçu avant impression…)
// remet les trois tables à zéro : il reste exactement comme en clair.
// Aucun écran n'est touché ; une classe nouvelle en profite toute seule.

const SURFACE = "#111a2c";
const NEUTRES = new Set(["slate", "gray", "zinc", "neutral", "stone"]);

// Les teintes 300 / 400 / 500 de chaque famille, écrites EN DUR : Tailwind ne
// livre que les variables réellement employées — s'appuyer sur
// `var(--color-emerald-500)` laisserait la couleur claire là où elle manque.
// Et des mélanges calculés ici, pas par le navigateur : un vieux téléphone
// qui ne connaît pas `color-mix` aurait un fond vide.
const TEINTES = {
  red: ["fca5a5", "f87171", "ef4444"], orange: ["fdba74", "fb923c", "f97316"], amber: ["fcd34d", "fbbf24", "f59e0b"],
  yellow: ["fde047", "facc15", "eab308"], lime: ["bef264", "a3e635", "84cc16"], green: ["86efac", "4ade80", "22c55e"],
  emerald: ["6ee7b7", "34d399", "10b981"], teal: ["5eead4", "2dd4bf", "14b8a6"], cyan: ["67e8f9", "22d3ee", "06b6d4"],
  sky: ["7dd3fc", "38bdf8", "0ea5e9"], blue: ["93c5fd", "60a5fa", "3b82f6"], indigo: ["a5b4fc", "818cf8", "6366f1"],
  violet: ["c4b5fd", "a78bfa", "8b5cf6"], purple: ["d8b4fe", "c084fc", "a855f7"], fuchsia: ["f0abfc", "e879f9", "d946ef"],
  pink: ["f9a8d4", "f472b6", "ec4899"], rose: ["fda4af", "fb7185", "f43f5e"],
};
// En FORMATION, le bleu de l'application devient violet (src/index.css) : la nuit aussi.
const EN_FORMATION = { sky: "violet", blue: "violet" };

const rvb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const melange = (famille, part) => {
  const c = rvb(TEINTES[famille][2]), f = rvb(SURFACE.slice(1));
  return "#" + c.map((v, i) => Math.round(v * part / 100 + f[i] * (1 - part / 100)).toString(16).padStart(2, "0")).join("");
};

// La couleur de nuit d'un nom (« white », « slate-50 », « sky-700 ») selon son
// rôle — ou null : la couleur reste ce qu'elle est.
export function couleurDeNuit(role, nom, formation = false) {
  if (nom === "white") return role === "nf" ? SURFACE : role === "nl" ? "#22304a" : null;
  if (nom === "black") return role === "nt" ? "#f1f5f9" : null;
  const m = /^([a-z]+)-(\d+)$/.exec(nom);
  if (!m) return null;
  let famille = m[1]; const ton = Number(m[2]);
  if (NEUTRES.has(famille)) {
    if (role === "nf") return { 50: "#172339", 100: "#1a2740", 200: "#24334f", 300: "#31425f", 800: "#2b3a54", 900: "#223049" }[ton] || null;
    if (role === "nt") return { 950: "#f1f5f9", 900: "#f1f5f9", 800: "#f1f5f9", 700: "#e2e8f0", 600: "#cbd5e1", 500: "#94a3b8", 300: "#64748b", 200: "#475569" }[ton] || null;
    return { 50: "#1c2a44", 100: "#1c2a44", 200: "#22304a", 300: "#2f405e", 400: "#475569" }[ton] || null;
  }
  if (formation) famille = EN_FORMATION[famille] || famille;
  if (!TEINTES[famille]) return null;
  if (role === "nf") { const part = { 50: 13, 100: 20, 200: 30, 300: 42, 400: 62 }[ton]; return part ? melange(famille, part) : null; }
  if (role === "nt") return ton >= 700 ? "#" + TEINTES[famille][0] : ton >= 500 ? "#" + TEINTES[famille][1] : null;
  const part = { 50: 28, 100: 28, 200: 34, 300: 46, 400: 62 }[ton];
  return part ? melange(famille, part) : null;
}

// Le rôle d'une propriété CSS — ou null : on n'y touche pas (ombres…).
export function roleDeLaPropriete(prop) {
  const p = String(prop).toLowerCase();
  if (p === "background-color" || p === "background" || /^--tw-gradient-(from|via|to)$/.test(p)) return "nf";
  if (p === "color" || p === "caret-color" || p === "text-decoration-color" || p === "fill" || p === "stroke" || p === "-webkit-text-fill-color") return "nt";
  if (/^border(-[a-z-]+)?-color$/.test(p) || p === "outline-color" || p === "--tw-ring-color") return "nl";
  return null;
}

// La passe PostCSS.
export default function sombreCss() {
  return {
    postcssPlugin: "bmi-sombre",
    OnceExit(root, { postcss }) {
      const vues = new Map();
      root.walkDecls((decl) => {
        const role = roleDeLaPropriete(decl.prop);
        if (!role || !decl.value.includes("var(--color-")) return;
        decl.value = decl.value.replace(/var\(--color-([a-z]+(?:-\d+)?)\)/g, (tout, nom) => {
          const nuit = couleurDeNuit(role, nom);
          if (!nuit) return tout;
          vues.set(`--${role}-${nom}`, nuit);
          return `var(--${role}-${nom},${tout})`;
        });
      });
      if (!vues.size) return;
      const noms = [...vues.keys()].sort();
      const table = noms.map((n) => `${n}:${vues.get(n)}`).join(";");
      const zero = noms.map((n) => `${n}:initial`).join(";");
      // En formation, seules les familles qui changent de teinte sont réécrites.
      const violet = noms.filter((n) => EN_FORMATION[n.slice(5).split("-")[0]])
        .map((n) => `${n}:${couleurDeNuit(n.slice(2, 4), n.slice(5), true)}`).join(";");
      root.append(postcss.parse(
        `@media screen{html[data-theme="sombre"]{${table}}` +
        (violet ? `html[data-theme="sombre"][data-espace="formation"]{${violet}}` : "") +
        `html[data-theme="sombre"] [data-garder-clair]{${zero}}}`
      ));
    },
  };
}
sombreCss.postcss = true;
