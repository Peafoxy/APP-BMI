// Rend la VRAIE fenêtre en HTML, pour que le banc la mesure dans un
// navigateur — jamais une copie de son balisage.
import { renderToStaticMarkup } from "react-dom/server";
import { MotInformation } from "../src/components/MotInformation.jsx";
import { MOT_CLIENT, MOT_EMPLOYE } from "../src/lib/motInformation.js";

export const htmlClient = renderToStaticMarkup(<MotInformation mot={MOT_CLIENT} onCompris={() => {}} />);
export const htmlEmploye = renderToStaticMarkup(<MotInformation mot={MOT_EMPLOYE} onCompris={() => {}} />);
