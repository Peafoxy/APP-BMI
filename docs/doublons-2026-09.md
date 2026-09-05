# Relevé des doublons — 05/09/2026

Demande de Timo : « répertorier dans toute l'application les fonctions qui
sont identiques mais ne dépendent pas d'une seule règle ».

Méthode : mesure automatique (jscpd, 40 jetons / 4 lignes minimum : 121
blocs identiques, 1 094 lignes, 4,2 % du code), puis lecture de chaque bloc
pour séparer les vrais doublons (même règle écrite plusieurs fois) des
simples ressemblances d'écran (même mise en page, pas de règle).
La zone de signature (2.101.57) n'y figure plus : déjà unifiée.

## A. Les vrais doublons — une règle métier écrite plusieurs fois

| # | La règle | Écrite où | Risque si l'une change sans l'autre |
|---|---|---|---|
| A1 | **Le numéro de contrat** `CTR-année-xxxxxxxx` | `lib/validationDevis.js` (numeroContrat) ET recopié à la main dans `EspaceClient.jsx` (signature du contrat par le client) | Deux formats de numéro selon qui signe (boutique ou téléphone). |
| A2 | **Le plan de règlement signé** (type, mensualité, première échéance, solde engagé, statut « en attente ») | `EspaceClient.jsx` (contrat client) et `TousLesDevis.jsx` (contrat en boutique) — 15 lignes identiques | Un plan accepté en boutique et un plan accepté par téléphone ne porteraient plus les mêmes champs. |
| A3 | **Construire les lignes d'un devis** (articles, autres équipements, frais d'installation ou pose seule, transport, remise) et **l'envoyer** dans l'espace client | Les trois volets du dimensionnement : `Solaire.jsx`, `Garage.jsx`, `Autre.jsx` — le plus gros doublon : blocs de 46, 29, 28, 26, 22, 20, 19 lignes | Une correction de calcul (remise, transport, pose seule) faite dans un volet et pas dans les deux autres : trois devis différents pour la même règle. |
| A4 | **La case « Pose seule »** et son montant de main-d'œuvre fixe | Les trois volets (46 lignes identiques) | Idem. |
| A5 | **Le prochain numéro de reçu** (préfixe boutique + année + compteur sur 4 chiffres) | `lib/core.js` : une version pour les ventes, une copie pour les dettes | Un changement de format des reçus oublierait les dettes. |
| A6 | **« Est-ce le même enregistrement ? »** (comparaison de deux fiches) | `lib/calculs.js` (memeEnregistrement) et `lib/rebase.js` (memeContenu), identiques | Deux façons de décider si une fiche a changé → une modification vue par l'un et pas par l'autre. |
| A7 | **Le lecteur de code-barres** et **ajouter au panier** | `Ventes.jsx` et `Commandes.jsx` | Un code lu correctement à la vente mais pas à la commande, ou l'inverse. |
| A8 | **Marquer un prospect « client acquis »** quand il paie | `Ventes.jsx` (encaissement) et `Prospects.jsx` (convertir) | Les deux chemins écrivent des champs différents (l'un pose vente_id, l'autre client_user_id) : un prospect converti n'a pas la même fiche selon le chemin. |
| A9 | **L'entête du PDF** (logo, société, coordonnées) | `pdf.js` : devis et proforma, 29 lignes identiques ; plus trois blocs de 8 lignes (pied, totaux) | Un changement d'adresse ou de logo fait sur le devis et pas sur la proforma. |
| A10 | **Envoyer un message WhatsApp** (numéro nettoyé, texte encodé, ouverture) | 4 fonctions de `lib/comptesClients.js` avec la même fin, + 8 écrans qui ouvrent `wa.me` eux-mêmes (`Dettes`, `Ventes`, `Clients`, `ClientsInstalles` ×3, `Partages`, `EspaceClient`) | ⚠ Déjà divergent : `Ventes.jsx` ouvre le texte **sans l'encoder** (un « & » ou un « # » dans le message le coupe). Et le jour du WhatsApp depuis le numéro BMI, il faudra remplacer 12 endroits au lieu d'un. |
| A11 | **Le lien PV** (jeton, numéro, champs `contrat_*`) | `ClientsInstalles.jsx` : « Marquer terminé » et « Envoyer pour signature » écrivent les mêmes 4 champs séparément (la fabrication du lien, elle, est déjà commune) | Un champ ajouté au lien PV dans un geste et pas dans l'autre. |
| A12 | **Le numéro de PV** `PV-année-xxxxxx` | `ClientsInstalles.jsx` seulement — mais le numéro de contrat (A1) suit une autre règle dans un autre fichier | Deux familles de numéros sans règle commune. |

## B. Les répétitions de geste — même question posée partout, à la main

Pas une règle de calcul, mais la même chose tapée 8 à 13 fois : chaque
copie peut dévier d'un mot.

| # | Quoi | Combien |
|---|---|---|
| B1 | **La question « Moyen de paiement (Espèces / Flooz / Mixx / Virement bancaire) »** | 13 endroits, 5 formulations différentes (« Moyen de paiement », « Moyen de remise des fonds », « Moyen de paiement reçu »…). Un moyen ajouté un jour (carte, chèque) devra être écrit 13 fois. |
| B2 | **Fabriquer un message** (id, date, heure, de qui, à qui, texte, lu par) | 10 endroits dans 5 fichiers. |
| B3 | **Fabriquer une dépense automatique** (salaire, prêt au personnel, commission) | 8 endroits dans 3 fichiers — dont Utilisateurs.jsx qui refait ce que `envoyerVirementG` fait déjà dans `calculs.js`. |
| B4 | **Le contrôle « AAAA-MM »** d'un mois saisi | plusieurs endroits, message d'erreur différent. |
| B5 | **Le tableau des dépenses** affiché deux fois dans `Depenses.jsx` (dépenses / chez le comptable), 19 lignes identiques | Une colonne ajoutée à l'un et pas à l'autre. |

## C. Ressemblances sans risque (à ne pas toucher)

Fins de tableaux (`</tbody></table><Pagination …>`), le bloc « aucune
boutique → AucuneBoutique + BoutiqueTabs » (9 écrans, volontairement
identique), les en-têtes de composants. Ce sont des mises en page, pas des
règles : les unifier coûterait plus qu'il ne rapporte.

## Ordre conseillé

1. **A3 + A4** (les trois volets du dimensionnement) — le plus gros et le
   plus proche de l'argent : un seul « constructeur de devis » partagé.
2. **A10** (WhatsApp) — corrige au passage le texte non encodé de Ventes.jsx,
   et prépare le WhatsApp depuis le numéro BMI.
3. **A1 + A2 + A12** (numéros et plan de règlement) — un seul fichier
   « contrat » pour les deux chemins de signature.
4. **A5, A6, A7, A8, A9, A11**, puis **B1 à B5**.
