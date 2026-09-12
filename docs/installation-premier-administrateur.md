# Installer BMI-Gestion sur une base VIDE : le premier administrateur

Depuis la 2.101.173, **le code ne contient plus aucun compte de départ**
(l'ancien « Administrateur / ADMIN2026 » a été retiré le 12/09/2026, sur
avis extérieur relu par Timo). La base de BMI Togo a ses comptes : rien à
faire pour elle.

Ce fichier ne sert que si, un jour, l'application est installée sur une
base Supabase **neuve**, sans aucun compte. Dans ce cas, l'écran de
connexion ne peut retrouver personne : le premier administrateur se crée
côté serveur, une seule fois, dans Supabase → SQL Editor.

```sql
-- Remplacer NOM et MOT_DE_PASSE. Le mot de passe est haché à la première
-- connexion (api/sync-auth.js accepte un compte pas encore migré).
insert into public.users (id, data)
values (
  'admin-' || substr(md5(random()::text), 1, 12),
  jsonb_build_object(
    'nom', 'NOM',
    'pwd', 'MOT_DE_PASSE',
    'role', 'admin',
    'admin_principal', true,
    'boutique', null,
    'actif', true,
    'formation', false
  )
);
```

Puis, dans l'application : se connecter avec ce compte, **changer le mot de
passe tout de suite** (⚙ Paramètres), créer les boutiques, puis les autres
comptes dans 👥 Utilisateurs.

⚠ Vérifier avant d'écrire que la colonne `data` et la marque de
l'administrateur principal (`admin_principal`) correspondent bien à
`lib/calculs.js` (`estAdminPrincipal`) du moment : c'est là que vit la règle.
