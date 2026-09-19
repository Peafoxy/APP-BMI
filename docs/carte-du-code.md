# Carte du code — où vit quoi

Écrite le 15/09/2026, à la demande de Timo : « à chaque question, il faut
relire le code… comment essayer de te donner une mémoire ».

**À quoi ça sert :** trouver le bon fichier sans fouiller. Une ligne par
fichier, qui dit **à quoi il sert**, jamais comment il marche — un sujet
vieillit lentement, un détail vieillit vite (voir le fonds de caisse, qui a
changé trois fois de règle en deux jours sans changer de fichier).

**Le banc la garde à jour :** `verifier-cloisonnement` tombe si un fichier de
`src/lib/` n'est pas cité ici. Une carte incomplète ne part pas.

⚠ Le banc vérifie qu'un fichier FIGURE, pas que sa phrase est encore vraie.
Si vous voyez une ligne fausse, c'est un défaut : on la corrige.

---

## L'argent

| Fichier | À quoi il sert |
|---|---|
| `lib/versements.js` | Le versement des fonds par les boutiques, et **le fonds de caisse** (l'enveloppe, à part du tiroir) |
| `lib/cloture.js` | La clôture de caisse, et le blocage des ventes du lendemain |
| `lib/validationDepenses.js` | La validation des dépenses par le DG, l'origine des fonds (« Payé avec »), les avances de frais |
| `lib/caissesCentrales.js` | Les caisses « Chez le DG », « BANQUE », « Chez le comptable » et leurs relevés |
| `lib/depensesChantier.js` | Les petites dépenses rattachées à un chantier de devis |
| `lib/reprises.js` | La reprise d'un article par BMI (le client rend, l'argent repart) |
| `lib/bons.js` | Le bon de reprise et le bon de retour (des documents, jamais des écritures) |
| `lib/banques.js` | La liste des banques et la banque d'un employé |
| `lib/paie.js` | La fiche de paie, séparée de la fiche employé |
| `lib/cnss.js` | La déclaration des rémunérations et cotisations |

## La vente, le stock, les documents

| Fichier | À quoi il sert |
|---|---|
| `lib/calculs.js` | Le gros des calculs métier : stock, boutiques, rôles, espaces, remises, index |
| `lib/core.js` | Les briques de base : montants, dates, numéros, WhatsApp, messages, dépenses |
| `lib/panier.js` | Le panier d'une vente ou d'une commande |
| `lib/transfertsStock.js` | Le transfert de stock entre boutiques (la boutique qui reçoit valide) |
| `lib/importStock.js` | L'importation d'articles en stock (Excel ou texte collé) |
| `lib/travaux.js` | 🛠 Travaux à crédit : les prestations hors devis |
| `lib/outillage.js` | 🧰 Le matériel de travail de BMI : le registre, les sorties et retours, les pertes, l'appel de la semaine |
| `lib/impression.js` | Les documents imprimables : reçus, bons, contrats |
| `lib/export.js` | L'export CSV des tableaux |
| `lib/barcode.js` | Le code-barres des étiquettes |
| `lib/archivage.js` | LA règle d'archivage des historiques (10 lignes, puis les archives) |

## Le devis, le client, le chantier

| Fichier | À quoi il sert |
|---|---|
| `lib/solaire.js` | Les calculs du dimensionnement solaire (panneaux, batteries, rails) |
| `lib/appareils.js` | Le catalogue des appareils électriques proposés dans un devis |
| `lib/validationDevis.js` | La validation d'un devis (espace client et signature en boutique) |
| `lib/modifDevis.js` | Modifier un devis DÉJÀ SIGNÉ : le client ouvre la porte |
| `lib/contrat.js` | Le contrat et le PV de réception |
| `lib/reglement.js` | Comment le client va solder son installation (le plan de règlement) |
| `lib/prospects.js` | Un prospect devient client |
| `lib/comptesClients.js` | Les identifiants automatiques d'un compte client, les relances de devis |
| `lib/identiteClient.js` | L'identifiant et le mot de passe d'un client — **n'importe RIEN** (lu aussi par le serveur) |
| `lib/clientsConnus.js` | Les clients que la boutique connaît déjà (proposés dans Ventes, Dettes, Travaux) |
| `lib/effacementClient.js` | 🔒 Le droit à l'effacement : ce qui part, ce que les livres gardent sans son nom |
| `lib/dossierPersonnel.js` | 📄 Le droit d'accès : tout ce qu'on a sur un client, en un document — **jamais son mot de passe** |
| `lib/dossierEmploye.js` | 👥 Le droit d'accès d'un EMPLOYÉ : paie, CNSS, banque masquée — **pas d'effacement, la loi l'interdit** |
| `lib/motInformation.js` | 👋 Le mot d'information de la première ouverture (client et employé) — **les mots qui mettent mal à l'aise y sont listés pour être évités** |

## Les personnes, les espaces, la sécurité

| Fichier | À quoi il sert |
|---|---|
| `lib/espace.js` | À quel espace (réel / formation) appartient un compte, et qui prévenir |
| `lib/verrou.js` | Le verrou d'inactivité, et la reconnaissance d'un téléphone |
| `lib/empreinte.js` | Qui peut ouvrir le verrou avec son doigt, et la clé rangée par appareil — **aucune empreinte n'entre ici**, le téléphone compare tout seul (`src/empreinte.js` est le seul à lui parler) |
| `lib/notifications.js` | Ce qui part en notification à chaque enregistrement |
| `lib/rappels.js` | Les rappels « pour information » qui dépendent du temps (tournée du matin) |
| `lib/conversations.js` | L'ordre de la liste des conversations de 💬 Messages |
| `lib/ordreOnglets.js` | L'ordre des onglets, au choix de chacun |

## Les données : charger, fusionner, sauvegarder

| Fichier | À quoi il sert |
|---|---|
| `lib/constants.js` | Les constantes globales, la VERSION, les catégories, les données de démonstration |
| `lib/fusion.js` | Réconcilier deux modifications faites en même temps |
| `lib/rebase.js` | Reporter une modification d'écran sur l'état le plus récent |
| `lib/fileUnique.js` | « Une seule synchronisation à la fois, mais aucune perdue » |
| `lib/abandonLot.js` | Le filet : abandonner un geste que le serveur refuse |
| `lib/corbeille.js` | La corbeille des fiches supprimées (30 jours) |
| `lib/sauvegarde.js` | La sauvegarde JSON : téléchargement, et écriture horaire dans un dossier |
| `lib/suggestions.js` | LA règle de recherche d'un champ à suggestions (toute recherche tapée) |

---

## Les composants partagés (`src/components/`)

| Fichier | À quoi il sert |
|---|---|
| `ui.jsx` | Les briques de toute l'application : champs, boutons, fenêtres, questions, partage PDF, colonnes figées |
| `ChampSuggestions.jsx` | LE champ à suggestions (le seul ; plus de `<datalist>`) |
| `SelecteurArticle.jsx` | La fenêtre « Rechercher un article » |
| `SelecteurBoutique.jsx` | La rangée de pastilles des boutiques |
| `OngletsDeplacables.jsx` | La barre d'onglets qu'on déplace par appui long |
| `HistoriqueArchive.jsx` | LE cadre d'historique qui défile et archive |
| `EcranVerrou.jsx` | La fenêtre du verrou d'inactivité |
| `ZoneSignature.jsx` | LA zone de signature (les quatre emplacements) |
| `CarteCaisse.jsx` | LA carte d'une caisse centrale (DG, BANQUE, comptable) |
| `RechercheGlobale.jsx` | La loupe du menu : recherche transversale (ventes, articles, devis, clients, prospects) |
| `MotInformation.jsx` | 👋 LA fenêtre du mot d'information (une seule pour le client et l'employé, seuls les mots changent) |
| `Carte.jsx` | La carte OpenStreetMap pour choisir une position — ⚠ **jamais d'enfant React dans le cadre de Leaflet** |

## Le reste

| Où | Quoi |
|---|---|
| `src/App.jsx` | Le cadre : onglets par rôle, chargement, enregistrement (`save`), synchronisation, sauvegardes |
| `src/db.js` | La base locale (Dexie / IndexedDB) et les tables |
| `src/pdf.js` | Les PDF fabriqués (devis commercial, relevés, rapports) |
| `src/push.js` | Les notifications sur l'appareil — **le seul endroit** où `Notification` et `pushManager` existent |
| `src/screens/` | Un écran par onglet |
| `api/` | Les fonctions serveur (Vercel) : connexion, filleuls, tournée du matin |
| `supabase/securite-*.sql` | Les verrous côté base — **Timo les colle lui-même**, jamais nous |
| `scripts/` | Le banc : `verifier-*` (application) et `tester-*-sql.sh` (base jetable) |

---

## Les pièges à ne pas refaire

Ils sont dans `CLAUDE.md` § 5. Les trois qui coûtent le plus cher :
`verifier-imports` attrape un écran blanc que le build ne voit pas ;
`export { x } from "y"` ne crée pas de variable locale ;
un UPSERT déclenche AVANT INSERT même quand la ligne existe.
