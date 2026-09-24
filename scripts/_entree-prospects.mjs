// Entrée du banc (verifier-whatsapp ㉑) : lib/prospects.js et lib/appareils.js
// ne sont pas lisibles par Node tels quels (imports sans « .js », calculs.js) —
// esbuild les réunit ici, comme pour les écrans rendus.
export { SOURCE_ASSISTANT, estDemandeAssistant, critiquePriseEnCharge, prendreEnCharge, prospectAvecDevis } from "../src/lib/prospects.js";
export { CATALOGUE_APPAREILS } from "../src/lib/appareils.js";
