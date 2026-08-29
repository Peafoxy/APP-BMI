# Audit complet — août 2026

Lecture ligne par ligne des 22 279 lignes de `src/` et `api/`.
Demandé par Timo : « Il faut lire les 92 % restants. On a le temps. »

Ordre suivi : **l'argent d'abord**.

Chaque constat porte son emplacement exact. Trois niveaux :
🔴 argent perdu ou sécurité · 🟠 défaut réel · 🟡 fragilité

---
## Ventes (`src/screens/Ventes.jsx`)

### ✅ CORRIGÉ EN 2.101.16 — refuser la confirmation annulait tout sauf la vente
`Ventes.jsx:589-597`. Le `if (await uConfirm(...))` n'entoure que la création de
la dette ; le `save(next, ...)` de la ligne 599 s'exécute dans tous les cas.

Conséquence : le stock sort, la vente entre dans le chiffre d'affaires, et la
créance du client n'existe nulle part. Si une avance a été versée, elle
n'apparaît pas non plus dans la clôture de caisse — le compte du soir est
court d'autant. Le vendeur, lui, croit avoir annulé.

### ✅ CORRIGÉ EN 2.101.16 — les frais d'installation et de transport n'étaient pas mis à la dette
`Ventes.jsx:495` et `Ventes.jsx:597` (et `Ventes.jsx:437-451` pour la réservation).

Sur une vente issue d'un devis, l'écran demande au vendeur d'encaisser
`totalAEncaisser = articles + installation + transport` (ligne 197). Mais quand
le client paie à crédit, la dette est créée avec `montant: total` — **les
articles seuls**. L'avance est elle aussi plafonnée à `total`.

Exemple : devis de 1 000 000 F de matériel + 150 000 F de pose. Le client verse
500 000 F et prend le reste à crédit. La dette enregistrée est de 500 000 F.
**Les 150 000 F de pose ne sont réclamés nulle part.**

Le reçu, lui, est juste : `impression.js:123-124` imprime
`TOTAL TTC = articles + installation + transport`, puis
`RESTE À PAYER = ce total − avance`. **Le papier remis au client et la dette
enregistrée dans la base ne disent donc pas la même chose** — et c'est la base
qui sert à réclamer.

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

### 🟠 Un article importé sans prix est proposé — et vendu — à 0 F
`Stocks.jsx:457-495`. L'importation accepte une ligne dès qu'elle a **trois**
champs (`parts.length >= 3`) : le prix d'achat et le prix de vente absents
valent alors 0, sans un mot.

Le dimensionnement choisit ensuite ses articles sur leur **caractéristique**
(watts, ampères-heures), jamais sur leur prix : un panneau importé sans prix
est donc retenu normalement, chiffré **0 F** dans le devis, puis encaissé
0 F dans Ventes (`pu: p.prix_vente`). Rien ne le signale nulle part.

L'import ne vérifie pas non plus les doublons : coller deux fois la même liste
crée deux fois les articles.

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
## Salaires, CNSS (`Salaires.jsx`, `lib/cnss.js`, `lib/paie.js`)

**Rien à signaler dans les calculs.** La retenue de crédit est comptabilisée
proprement (une dépense « Salaires » de `montant + retenue`, une entrée
« Prêt au personnel » de `−retenue` : la caisse ne bouge que de `montant`, et
le prêt se rembourse). Le paiement CNSS refuse de partir sur des saisies non
enregistrées, prévient nommément quand des assujettis sont exclus faute
d'informations, et signale un second paiement pour le même mois.

### ❓ À vérifier avec un comptable togolais — le plafond de cotisation
`lib/cnss.js:70` applique **16,5 % de PV sur la rémunération entière**, sans
plafond. Si la CNSS Togo applique un plafond mensuel sur l'assiette
vieillesse, BMI **verse plus que son dû** à chaque déclaration. Je ne peux pas
trancher : ce n'est pas une question de code. Le fichier prévient déjà
lui-même que le modèle Excel officiel n'a jamais été comparé à l'export.

---

## Commissions (`MonEquipe.jsx`, `lib/calculs.js`)

Le calcul est juste et cohérent : `commissionBrute` reprend **exactement** la
part de rabais que `caVente` vient de retirer (`rabaisImpute`), et non le
rabais brut — sur un panier mêlant articles de la boutique et articles « hors
boutique », les deux diffèrent.

### 🟡 Une commission peut être payée deux fois depuis deux appareils
`MonEquipe.jsx:329-360`. `payerCommission` ne revérifie pas l'état **après** les
fenêtres de confirmation. Si une synchronisation ramène entre-temps le
paiement fait par un autre administrateur, la dépense est créée une seconde
fois. Un double-clic, lui, est bien protégé (la commission retombe à 0).

`ClientsInstalles.validerPaiementPrime` fait exactement cette seconde
vérification, avec un commentaire qui explique pourquoi. Il suffirait de la
reprendre ici.

---

## Rentabilité (`src/screens/Rentabilite.jsx`)

### 🟠 La marge affichée est plus belle que la vraie
`Rentabilite.jsx:45`. Le chiffre d'affaires par produit est calculé ainsi :

```
ca += qte × pu − remise_ligne
```

La **remise globale** de la vente (`v.remise`) et le **rabais commercial**
(`v.rabais`) ne sont jamais retirés. Or `caVente()` — la fonction utilisée par
le Tableau de bord et par toutes les commissions — les retire bien.

**Les deux écrans donnent donc deux chiffres différents pour la même vente.**

Exemple : 1 000 000 F d'articles, 10 % de remise, 700 000 F d'achat.
· Tableau de bord : CA 900 000 F.
· Rentabilité : CA 1 000 000 F, marge 300 000 F au lieu de 200 000 F —
**la marge est surévaluée de 50 %.**

C'est l'écran sur lequel se décident les prix. Une marge qu'on croit à 30 %
alors qu'elle est à 22 % conduit à vendre trop bas, durablement.

---
## Dépenses (`src/screens/Depenses.jsx`, `lib/calculs.js:691`)

### 🟠 Supprimer une dépense promet d'annuler le paiement lié — et ne le fait que dans la moitié des cas
Le message affiché dit, mot pour mot :

> ⚠ Cette dépense a été générée automatiquement par un paiement : le statut
> « payé » correspondant sera aussi annulé (à repayer si besoin).

`annulerLiensDepense` ne traite que 4 des 10 sortes de dépenses automatiques :
`commission`, `commission_equipe`, `commission_ext`, `installation`.

Les six autres ne sont **pas** annulées, alors que le message l'affirme :

| `auto` | Ce qui reste faux après la suppression |
|---|---|
| `virement` | Le virement de salaire reste inscrit sur la fiche de l'employé : il apparaît **payé**, alors que l'argent est revenu en caisse. |
| `retenue` | La contrepartie de la retenue de crédit disparaît seule : le prêt se retrouve remboursé sans mouvement. |
| `credit` | Le crédit BMI reste **accordé** et à rembourser, alors que la sortie de caisse a été effacée. |
| `cnss` | Le paiement CNSS du mois s'efface, et le garde-fou « déjà enregistré ce mois » ne le voit plus. |
| `avance`, `remboursement` | Idem. |

Il existe pourtant un chemin correct : `Utilisateurs.annulerVirement` retire
bien les écritures de caisse liées. La suppression depuis l'écran Dépenses le
contourne.

C'est exactement le cas que Timo a posé en règle : **une alerte qui annonce
quelque chose qu'elle ne fait pas.**

---
## Paramètres — restauration d'une sauvegarde (`Parametres.jsx:397-419`)

### 🔴 Restaurer une sauvegarde efface, sur le serveur et pour tout le monde, tout ce qui a été fait depuis
Le bouton « ♻ Restaurer une sauvegarde » appelle `save(donnees, …)` avec le
contenu du fichier comme **nouvel état complet**.

`sauvegarderDiff` (`db.js:204-206`) compare l'ancien état au nouveau et met en
file d'attente une **suppression** pour chaque ligne absente du nouveau. Or une
sauvegarde est, par définition, plus ancienne que l'état courant : **toutes les
ventes, dettes, dépenses et fiches créées depuis le jour de la sauvegarde sont
supprimées**, localement puis sur le serveur, donc sur tous les appareils.

Trois choses aggravent le geste :
1. Le fichier n'ayant pas de numéro d'état (`__v`), le garde-fou anti-écran-périmé
   de `save()` — celui qui refuse justement d'effacer ce qu'il ne sait plus
   comparer — **ne se déclenche pas**. La restauration passe tout droit.
2. L'avertissement dit « ⚠ Les données actuelles seront remplacées ». Il ne dit
   ni *sur tous les appareils*, ni *définitivement*, ni *combien de jours de
   travail*. Le fichier ne porte même pas sa date à l'écran.
3. Aucune sauvegarde de l'état courant n'est faite avant. Le geste est sans
   retour.

Ce qu'il faudrait, au minimum : afficher la **date** de la sauvegarde et le
nombre de jours de travail qui seraient perdus, exporter l'état courant
d'abord, et réserver le bouton à l'administrateur **principal** (aujourd'hui
tout administrateur ayant gardé l'onglet Paramètres peut le faire).

---

## Plan de règlement (`TousLesDevis.jsx:69`)

### ✅ TRANCHÉ LE 29/08/2026 — « moi seul » (corrigé en 2.101.15)
`const peutDeciderDuPlan = profile.role === "admin";`

Le commentaire juste au-dessus cite votre réponse : « L'ADMINISTRATEUR SEUL ».
Le code l'a lue comme **tout compte administrateur**. Or partout ailleurs dans
l'application, les gestes qui engagent l'entreprise sont réservés à
`estAdminPrincipal` — et vous avez tranché le 28/08 que les autres
administrateurs ne sont plus des vous en réduction.

Question reposée à Timo, réponse : **« Moi seul »**. `peutDeciderDuPlan` vaut
désormais `estAdminPrincipal(db, profile)`, le geste se garde lui-même (et pas
seulement le bouton), et quatre contrôles de `npm run tester-reglement`
surveillent la règle.

---
## ⚠️ CORRECTION DU 29/08/2026 — je me suis trompé sur le point le plus grave

**Ce que j'avais annoncé :** qu'un client pouvait se nommer administrateur
principal en réécrivant sa propre fiche, et devenir vous à sa reconnexion.
J'avais écrit « mesuré, pas supposé ».

**C'était faux, et l'erreur venait de mon banc.** Il décidait « écriture
acceptée » ou « refusée » en lisant la dernière ligne affichée par psql. Or
psql annonce chaque commande réussie par un « SET » sur cette même sortie :
quand un garde-fou refusait l'écriture, il ne restait que ces « SET », et mon
banc les prenait pour un résultat — donc pour une écriture **acceptée**.
Toutes les portes fermées par un déclencheur étaient annoncées grandes
ouvertes.

Le banc ne lit plus la sortie : il regarde si la base a levé une objection,
seule marque fiable d'un refus. Chaque essai tourne désormais dans sa propre
transaction, annulée à la fin.

### Ce qui protège DÉJÀ, et qui était dans le dépôt depuis le début
`supabase/roles-1-vague1.sql` installe le déclencheur **`interdire_escalade`**
sur `public.users`, et il fait exactement le travail. `supabase/paie-1-table.sql`
fait de même sur les fiches de paie. Mesuré, cette fois pour de bon :

| Geste | Base |
|---|---|
| Un client se nomme administrateur principal | ❌ **refusé** |
| Un employé se nomme administrateur principal | ❌ **refusé** |
| Un employé s'augmente son propre salaire | ❌ **refusé** |
| Un employé lit le salaire des autres | ❌ **refusé** |
| Un client modifie la fiche d'un autre | ❌ refusé |
| Un client supprime une vente | ❌ refusé |

**Les constats n° 1 et n° 5 de cet audit tombent.** Le chemin « du nom d'un
client à l'administration » est déjà coupé à son maillon central.

### ✅ VÉRIFIÉ SUR LA VRAIE BASE — 29/08/2026, capture de Timo
Les deux déclencheurs sont bien en place sur son Supabase :
`interdire_escalade` sur `users`, `interdire_escalade_paie_trg` sur `paie`.
**Le sujet est clos. Ne pas le rouvrir.**

### 🟠 Ce qui reste vraiment ouvert de ce côté — deux trous mesurés
1. **Un administrateur peut modifier sa propre fiche.** `interdire_escalade`
   laisse passer tout jeton portant le rôle « admin » sans rien vérifier
   ensuite : un administrateur secondaire peut se donner `admin_principal`.
   Depuis le 28/08, ce drapeau décide **seul** de qui traverse le mur
   formation / réel.
2. **Le champ `actif` n'est surveillé par personne.** Un employé qu'on vient
   de bloquer garde son jeton de session jusqu'à expiration : il peut, pendant
   ce temps, se remettre `actif: true`.

`supabase/securite-2-role-inviolable.sql` ferme ces deux-là, et rien d'autre.

### 🔴 Ce qui reste ouvert, et qui est réel — l'écriture des comptes clients
| Geste | Base |
|---|---|
| Un client efface sa propre dette (800 000 F) | ✅ **accepté** |
| Un client change le montant d'une vente | ✅ **accepté** |
| Un client change le prix d'un article | ✅ **accepté** |
| Un client invente une vente de toutes pièces | ✅ **accepté** |

C'est le chantier « **vague 2** » déjà repéré : `dettes`, `ventes`, `produits`
restent ouverts en écriture aux comptes clients. On ne peut pas simplement les
leur interdire — leur espace écrit légitimement une dette à la validation d'un
devis (`EspaceClient.jsx:425`). Il faut d'abord marquer **à qui** chaque ligne
appartient.

Le mot de passe calculable (`identiteClient.js`) reste, lui, un vrai sujet :
il ne mène plus à l'administration, mais il ouvre l'espace d'un client à qui
connaît son nom et son numéro — donc ses devis, ses dettes, sa signature.

---

## Fonctions serveur (`api/`)

### 🟡 Cinq fonctions renvoient le message d'erreur interne brut
`apparence.js:77`, `chercher-compte.js:129`, `creer-filleul.js:192`,
`etat-auth.js:127`, `sync-auth.js` (dernière ligne) renvoient
`e.message` au navigateur. Ces messages nomment les tables, les colonnes et
parfois la contrainte violée. L'ancien relevé en comptait trois : il y en a cinq.

### 🟡 `api/apparence.js` répond sans aucune authentification
Elle utilise la clé maîtresse (`service_role`) et lit toute la table
`boutiques`. Elle ne renvoie qu'une liste blanche de champs d'apparence — c'est
ce qui la rend acceptable — mais toute nouvelle entrée dans `CHAMPS_APPARENCE`
deviendrait publique sans que personne ne s'en aperçoive.

---

## Synchronisation (`src/sync.js`, `src/db.js`) — rien à signaler

Fusion à trois (avant / local / distant), pierres tombales pour les
suppressions, envoi par lot avec repli table par table, numéro de lot pour que
les écritures d'un même geste arrivent ensemble ou pas du tout.
`reconcilierMiroir` ne supprime **que localement** et refuse de tourner tant
qu'il reste des opérations en attente : une donnée créée hors ligne ne peut pas
être effacée par elle. C'est du travail solide.

---
## Fusion des modifications simultanées (`src/lib/fusion.js`)

Le principe est bon : on ne compare plus deux horloges, on additionne les
écarts par rapport à l'état de départ. Les versements sur une dette faits hors
ligne sur deux appareils s'additionnent au lieu de s'écraser, et le total est
plafonné au montant dû.

### 🟠 La protection prévue pour les chantiers ne protège rien
`fusion.js:45` — `clients_installes: { listes: ["demande_prime"] }`.

`demande_prime` n'est pas une liste, et n'existe pas à ce niveau : c'est un
**booléen posé sur chaque membre de `equipe[]`**. `unirParId` reçoit donc
`undefined` des deux côtés, ne produit rien, et la ligne est ignorée. La
stratégie est un no-op.

Conséquence réelle : si l'administrateur paie la part du technicien A pendant
que le vendeur paie celle du technicien B **sur le même chantier**, le tableau
`equipe` entier est remplacé par celui du dernier arrivé. Le `paye: true` de
l'autre disparaît — alors que sa dépense, elle, a bien été créée. La part
réapparaît comme **due**, et `primeDejaPayee` ne la voit plus : elle peut être
payée une seconde fois.

(À noter : `unirParId` s'appuie sur un champ `id`. Les membres d'`equipe`
portent `user_id`. Corriger la ligne ne suffira donc pas — il faut aussi dire
sur quelle clé fusionner.)

---

## Le moyen de paiement imposé en dur — deux endroits

Le compte de caisse ne retient que ce qui porte `paiement === "Espèces"`
(`Caisse.jsx:27`). Deux écritures décident donc du moyen à la place de
l'utilisateur, et faussent la clôture :

### 🟠 `Fournisseurs.jsx:34` — un fournisseur est toujours payé « en espèces »
Aucune question n'est posée. Un règlement par virement ou Flooz est quand même
inscrit en espèces : **le soir, la caisse paraît courte** du montant du
règlement, sans que rien ne l'explique.

C'est exactement le défaut déjà corrigé pour l'avance d'une vente à crédit
(« point 15 : la caisse la comptait en espèces quoi qu'il arrive »). Il a
survécu ici.

### 🟠 `Salaires.jsx:267` — la CNSS est toujours payée « par virement bancaire »
L'inverse : réglée en espèces, elle n'est pas retirée du compte de caisse, et
**la caisse paraît longue** du montant des cotisations.

### 🟡 Aucun plafond au règlement d'un fournisseur
`Fournisseurs.payer` accepte n'importe quel montant, même supérieur au reste dû.

---
## Le chiffre d'affaires est calculé de trois façons différentes

| Écran | Formule | Ce qui est retiré |
|---|---|---|
| Tableau de bord, commissions | `caVente(v)` | remise globale, rabais, lignes hors boutique |
| Rentabilité (`:45`) | `qte × pu − remise_ligne` | **rien d'autre** |
| Ma commission (`:50`), Commerciaux (`:61`) | `totalVente(v)` | remise et rabais, mais **pas** les lignes hors boutique |

Les trois écrans peuvent donc afficher trois « chiffres d'affaires » différents
pour la même vente. Le plus gênant reste Rentabilité (voir plus haut) ; les
deux autres font qu'un commercial lit un CA qui ne correspond pas à la
commission qu'on lui verse — de quoi discuter longtemps sans que personne ait
tort.

---

## Messagerie (`src/screens/Messagerie.jsx:15`)

### 🟡 Tout technicien et tout chef d'équipe lit le fil de TOUS les clients
```
if (moi.role === "admin" || moi.role === "technicien"
    || moi.role === "technicien_bmi" || moi.chef_equipe) return true;
```
La restriction existe pourtant juste en dessous pour les commerciaux, qui ne
voient que les fils des clients dont ils ont le chantier. Les techniciens, eux,
n'ont aucune limite — alors qu'ils interviennent sur un chantier, pas sur tous.

---

## Export CSV (`src/lib/export.js:9`)

### 🟡 Un nom de client peut devenir une formule Excel
`esc()` double les guillemets — c'est correct pour le format CSV. Mais une
cellule qui commence par `=`, `+`, `-` ou `@` est interprétée comme une
**formule** à l'ouverture dans Excel. Un nom de client saisi ainsi (par
maladresse ou par malveillance) s'exécute sur le poste qui ouvre l'export.
Le remède tient en un caractère : préfixer d'une apostrophe toute cellule qui
commence par l'un de ces quatre signes.

---

## Ce qui a été lu et n'appelle aucune remarque

- `src/lib/solaire.js` — formules du dimensionnement, déjà verrouillées par le banc.
- `src/lib/cnss.js` — taux sourcés, export DRC conforme au guide, honnêtement caveaté.
- `src/lib/paie.js` — séparation des fiches de paie, bien pensée et vérifiée.
- `src/sync.js`, `src/db.js` — fusion à trois, pierres tombales, envoi par lot.
- `src/lib/rebase.js` — report d'un écran périmé sur l'état courant.
- `src/lib/barcode.js` — Code 128 B, checksum conforme.
- `src/lib/impression.js` — reçus, PV, étiquettes : les totaux sont justes et complets.
- `src/screens/Connexion.jsx` — vérification serveur puis vérification locale, déconnexion après 15 minutes d'inactivité.
- `src/screens/dimensionnement/Garage.jsx`, `Autre.jsx` — cohérents avec Solaire.
- `src/screens/Commandes.jsx`, `Ravitaillement.jsx`, `Clients.jsx`, `Prospects.jsx`,
  `MesTaches.jsx`, `ContratsInstallation.jsx`, `Historique.jsx` — rien à signaler.
- `src/components/*` — le cloisonnement est respecté jusque dans la recherche globale.
- Aucun mot de passe, jeton ni clé n'est écrit dans la console ou dans le
  navigateur (`localStorage` ne contient qu'un identifiant et un horodatage).

---

## Étendue de la lecture

22 279 lignes de `src/` et `api/`. Toute la **logique** a été lue ligne à ligne
— calculs, écritures, conditions, règles d'accès. Le balisage d'affichage
(JSX pur : mise en page, classes, tableaux) a été parcouru sans être relu mot à
mot : il ne décide de rien.

Quatre questions ont par ailleurs été passées sur **100 %** des fichiers, sans
exception : les écritures sans contrôle de droit, l'arithmétique de l'argent,
les confirmations qui ne bloquent pas la suite, et ce que la base autorise
réellement.
