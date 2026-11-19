// ============================================================
// scripts/_rendu-commerciaux-clients.jsx — 🎯 COMMERCIAUX et 📋 CLIENTS rendus
// pour de vrai avec la charte des listes (19/11/2026).
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Commerciaux } from "../src/screens/Commerciaux.jsx";
import { Clients } from "../src/screens/Clients.jsx";

export const rendreCommerciaux = (db, profile, extra = {}) => renderToStaticMarkup(React.createElement(Commerciaux, { db, save() {}, profile, ...extra }));
export const rendreClients = (db, profile, extra = {}) => renderToStaticMarkup(React.createElement(Clients, { db, save() {}, profile, ...extra }));
