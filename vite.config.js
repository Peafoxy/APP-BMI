import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // « prompt » : on PRÉVIENT l'utilisateur au lieu de recharger dans son dos.
      // En « autoUpdate », la nouvelle version n'était appliquée qu'après la
      // fermeture COMPLÈTE de l'application — ce que personne ne fait jamais sur
      // téléphone. D'où des appareils bloqués des semaines sur une vieille version.
      registerType: "prompt",
      includeAssets: ["pwa-192.png", "pwa-512.png"],
      manifest: {
        name: "BMI-Gestion Système",
        short_name: "BMI Gestion",
        description: "Gestion des boutiques DEMAKPOE et APESSITO — ventes, stocks, dettes, caisse",
        lang: "fr",
        display: "standalone",
        start_url: "/",
        theme_color: "#0f172a",
        background_color: "#f1f5f9",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        maximumFileSizeToCacheInBytes: 5000000
      }
    })
  ]
});
