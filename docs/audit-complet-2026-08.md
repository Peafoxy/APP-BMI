# Audit complet — août 2026

Lecture ligne par ligne des 22 279 lignes de `src/` et `api/`.
Demandé par Timo : « Il faut lire les 92 % restants. On a le temps. »

Ordre suivi : **l'argent d'abord**.

Chaque constat porte son emplacement exact. Trois niveaux :
🔴 argent perdu ou sécurité · 🟠 défaut réel · 🟡 fragilité

---
## Ventes (`src/screens/Ventes.jsx`)

### 🔴 Refuser la confirmation d'une vente à crédit enregistre quand même la vente — sans la dette
`Ventes.jsx:589-597`. Le `if (await uConfirm(...))` n'entoure que la création de
la dette ; le `save(next, ...)` de la ligne 599 s'exécute dans tous les cas.

Conséquence : le stock sort, la vente entre dans le chiffre d'affaires, et la
créance du client n'existe nulle part. Si une avance a été versée, elle
n'apparaît pas non plus dans la clôture de caisse — le compte du soir est
court d'autant. Le vendeur, lui, croit avoir annulé.

### 🔴 Les frais d'installation et de transport ne sont jamais mis à la dette
`Ventes.jsx:495` et `Ventes.jsx:597` (et `Ventes.jsx:437-451` pour la réservation).

Sur une vente issue d'un devis, l'écran demande au vendeur d'encaisser
`totalAEncaisser = articles + installation + transport` (ligne 197). Mais quand
le client paie à crédit, la dette est créée avec `montant: total` — **les
articles seuls**. L'avance est elle aussi plafonnée à `total`.

Exemple : devis de 1 000 000 F de matériel + 150 000 F de pose. Le client verse
500 000 F et prend le reste à crédit. La dette enregistrée est de 500 000 F.
**Les 150 000 F de pose ne sont réclamés nulle part.**

### 🟡 Le rabais commercial n'est plafonné que vers le haut
`Ventes.jsx:192` — `Math.min(Number(f.rabais || 0), rabaisMax)`. Un montant
négatif tapé par erreur passe le `Math.min` et **augmente** le total facturé
(`total = brut - remise - rabais`). Le champ porte bien `min="0"`, mais un
navigateur n'empêche pas de taper la valeur.

### 🟡 Supprimer une vente laisse ses dépendances orphelines
`Ventes.jsx:616-620`. Seule la ligne `ventes` est retirée. Restent derrière :
le chantier (`clients_installes.vente_id`), le devis marqué « payé », et la
commission du commercial — qui disparaît sans un mot. La dette liée survit,
elle, ce qui est le bon sens.

---
## Dimensionnement — le prix des devis

`src/lib/solaire.js` (102 l.) : **rien à signaler.** Les formules sont sorties
de l'écran, commentées, et déjà verrouillées par le banc sur le cas réel du
18/08/2026. C'est le morceau le mieux tenu de l'application.

### 🟠 Le numéro de téléphone est encore comparé brut à quatre endroits
La règle posée par Timo — comparer les **8 derniers chiffres** (`memeNumero`) —
a été appliquée à Ventes, Clients, Prospects et à la création de filleuls.
Quatre endroits l'ont manquée :

| Emplacement | Ce que ça casse |
|---|---|
| `dimensionnement/Partages.jsx:286` | `resoudreClientDevis` — **un deuxième compte client est créé** si le numéro est tapé avec l'indicatif. C'est exactement le défaut « compte VIVA » que le commentaire juste au-dessus décrit comme corrigé. Un doublon, c'est aussi une seconde prime de parrainage. |
| `Ventes.jsx:570` | le prospect n'est pas clôturé après la vente : les commerciaux relancent un client qui a déjà payé. |
| `EspaceClient.jsx:476` | le prospect ne reçoit pas le badge « devis validé » : il sort de la file à relancer. |
| `ClientsInstalles.jsx:164` | le chantier n'est pas relié au compte du client : **il ne voit pas son installation dans son espace.** |

### 🟠 La tension d'un convertisseur est déduite de ses VA, pas de ses watts
`dimensionnement/Solaire.jsx:132-137` et `:275`. La règle donnée par Timo est
en kW : « 0 à 2,5 kW en 12 V, 2,6 à 4,5 kW en 24 V, 4,6 à 30 kW en 48 V ».
Mais `tensionInfereeConvertisseur(spec.valeur)` reçoit la valeur **brute** —
donc des VA quand l'article est étiqueté en VA.

Or l'application sait déjà que VA ≠ W (`puissanceUtileW`, facteur 0,8) et s'en
sert pour le dimensionnement. Résultat : un « 5000VA » (4 000 W réels, donc
classe 24 V) est classé 48 V. Chaque convertisseur étiqueté en VA monte d'un
cran, et se voit proposé sur le mauvais système.

### 🟡 Un article sans prix de vente rend tout le devis illisible
`dimensionnement/Solaire.jsx:449` — `sousTotal: p.prix_vente * c.qte`, sans
`Number()`. Un article dont le prix est absent (import, saisie incomplète)
donne `NaN`, qui se propage au total, à la remise, aux frais et au montant de
l'acompte. Le devis affiche « NaN F » de bout en bout.

---
## Clients installés (`src/screens/ClientsInstalles.jsx`, 1 390 l.)

L'écran est **le mieux protégé de l'application** sur les paiements :
`validerPaiementPrime` vérifie deux fois qu'une part n'a pas déjà été payée —
avant les questions **et après**, parce qu'une synchronisation peut ramener
entre-temps le paiement fait par quelqu'un d'autre. Une répartition dont des
parts sont payées ne peut plus être réécrite. Les demandes de prime annulées
préviennent nommément les vendeurs concernés.

### 🟡 Un chef de chantier retiré de l'équipe fausse la répartition
`ClientsInstalles.jsx:71-86`. Si `chefId` n'est pas dans `equipeIds` — possible
en rouvrant une répartition dont le chef a été sorti de l'équipe depuis
(`ouvrirRepartition` reprend `c.chef_id` tel quel) — la boucle ne saute
personne, puis `r[equipeIds[0]]` est écrasé par le reste. La somme des parts
tombe alors à `100 − partEgale` : **un technicien perd sa part**, silencieusement,
et l'écart est absorbé dans la « part BMI » sans que rien ne le signale.

---
## Fiches de paie (`src/lib/paie.js`, `supabase/paie-1-table.sql`)

Le déplacement des salaires hors de la fiche employé est **bien fait**, et il
tient : le banc confirme qu'un vendeur **ne lit pas** le salaire des autres.
`separerPaie` ne détache que sa propre fiche (ou toutes, pour un
administrateur), ce qui évite d'envoyer au serveur des fiches vides qu'il
refuserait — le piège déjà rencontré avec les boutiques de formation.

### 🔴 Un employé peut s'augmenter lui-même
`supabase/paie-1-table.sql:191-194` — la règle `paie_maj` autorise la
modification `using (role = 'admin' or id = moi)`. « Sa propre fiche » est
indispensable en **insertion** (l'application enregistre par upsert, le
commentaire l'explique bien), mais en **modification** elle laisse chacun
réécrire son propre `salaire_base`, ses primes et ses avances.

Mesuré : *un vendeur s'augmente son propre salaire → accepté.*

---

## Ce que la base laisse écrire — mesuré, pas supposé

`npm run tester-ecriture-sql` — **8 gestes sur 12 passent.**

| Geste | Base |
|---|---|
| Un client efface sa dette de 800 000 F | ✅ accepté |
| Un client change le montant d'une vente | ✅ accepté |
| Un client change le prix d'un article | ✅ accepté |
| Un client invente une vente | ✅ accepté |
| Un client se nomme administrateur principal | ✅ accepté |
| Un employé se nomme administrateur principal | ✅ accepté |
| Un employé réécrit la fiche de n'importe qui | ✅ accepté |
| Un employé s'augmente son propre salaire | ✅ accepté |
| Un client modifie la fiche d'un autre | ❌ refusé |
| Un client supprime une vente | ❌ refusé |
| Un employé lit le salaire des autres | ❌ refusé |

Le plus grave est l'élévation de rôle : `api/sync-auth.js:99` lit le rôle
**dans la fiche `users`** au moment de la connexion. Une fiche réécrite en
`role: admin` + `admin_principal: true` devient donc vraie à la reconnexion
suivante.

---
