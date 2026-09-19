-- ============================================================
-- LE NUMÉRO DE COMPTE BANCAIRE D'UN EMPLOYÉ SORT DE LA VUE DE TOUS
-- ============================================================
--
-- POUR TIMO — CE QUI N'ALLAIT PAS.
--
-- Vous avez demandé le 18/09/2026 : « et les employés dans cette histoire,
-- leurs données ne sont-elles pas protégées ? ». En vérifiant, deux fuites
-- du même numéro de compte bancaire :
--
--   1) SUR LA FICHE DE L'EMPLOYÉ. Le salaire, les primes et le matricule
--      CNSS avaient déménagé dans une table à part (`paie`) le 19/08/2026,
--      que seuls l'administrateur, le comptable et l'intéressé peuvent lire.
--      La banque et le numéro de compte, ajoutés le 15/09/2026, étaient
--      restés sur la fiche ORDINAIRE — celle que tous les appareils
--      connectés téléchargent. Le verrou `securite-18` en protégeait
--      l'ÉCRITURE, jamais la LECTURE. L'écran le masquait (« …4321 »), mais
--      MASQUER N'EST PAS PROTÉGER : le numéro entier descendait sur le
--      téléphone de chacun.
--
--   2) SUR LES DÉPENSES. Un paiement « par virement » recopiait le numéro
--      EN ENTIER sur la dépense — et la table des dépenses descend, elle
--      aussi, sur tous les appareils. Fermer la fiche sans fermer cela
--      n'aurait servi à rien : le numéro aurait continué de fuir par
--      l'autre porte.
--
-- CE QUE CE SCRIPT FAIT, ET CE QU'IL NE TOUCHE PAS.
--
--   • Il DÉMÉNAGE `compte_bancaire` de chaque fiche employé vers sa fiche
--     de paie, puis l'efface de la fiche employé.
--   • Il RACCOURCIT le numéro déjà recopié sur les dépenses : « …4321 ».
--   • Il NE TOUCHE PAS au NOM de la banque, qui reste sur la fiche employé.
--     C'est voulu : ce n'est pas un secret, et vous avez demandé le
--     14/09/2026 qu'un virement écrive vers quelle banque l'argent part.
--     Un gérant ou un chef d'équipe paient aussi des primes : leur retirer
--     le nom ferait tomber cette règle pour eux. Le numéro, lui, ne leur a
--     jamais servi.
--
-- AUCUNE NOUVELLE TABLE, AUCUNE NOUVELLE RÈGLE : la table `paie` et ses
-- règles d'accès existent depuis le 19/08/2026 (paie-1-table.sql).
--
-- ⚠ L'HORODATAGE RESTE ACTIF, volontairement — c'est l'inverse de ce qu'on
-- fait d'habitude. Une ligne nettoyée doit REDESCENDRE sur les téléphones,
-- sinon leur copie locale garderait le numéro. Les lignes touchées se
-- comptent en dizaines : le retéléchargement est négligeable.
--
-- Relancer ce script est sans danger : la recopie écrase proprement, et
-- l'effacement ne trouve alors plus rien à effacer.
--
-- ⚠⚠ EN CAS DE PROBLÈME — remettre le numéro sur les fiches employés.
-- Copiez le bloc ci-dessous, SANS les tirets de début de ligne :
--
--   update public.users u
--      set data = u.data || jsonb_build_object('compte_bancaire', p.data ->> 'compte_bancaire')
--     from public.paie p
--    where p.id = u.id and p.data ? 'compte_bancaire';
--
-- (Les dépenses, elles, gardent le numéro raccourci : l'original n'y est
-- plus. Ce n'est pas une perte — rien ne le lisait.)
-- ============================================================


-- ══════════════════════════════════════════════════════════════════
-- 1. LE DÉMÉNAGEMENT : la fiche employé → la fiche de paie
-- ══════════════════════════════════════════════════════════════════
do $$
declare
  deplacees int;
  nettoyees int;
begin
  -- 1a. Recopier dans la table `paie` (en gardant ce qui s'y trouve déjà).
  insert into public.paie (id, data)
  select u.id, jsonb_build_object('compte_bancaire', u.data -> 'compte_bancaire')
    from public.users u
   where u.data ? 'compte_bancaire'
     and coalesce(u.data ->> 'compte_bancaire', '') <> ''
  on conflict (id) do update
     set data = public.paie.data || excluded.data;
  get diagnostics deplacees = row_count;

  -- 1b. L'effacer de la fiche employé.
  update public.users
     set data = data - 'compte_bancaire'
   where data ? 'compte_bancaire';
  get diagnostics nettoyees = row_count;

  raise notice 'Numéros déménagés vers la fiche de paie : %', deplacees;
  raise notice 'Fiches employés nettoyées : %', nettoyees;
end $$;


-- ══════════════════════════════════════════════════════════════════
-- 2. LES DÉPENSES DÉJÀ ÉCRITES : le numéro est raccourci
-- ══════════════════════════════════════════════════════════════════
-- « …4321 » suffit à reconnaître le bon compte, et c'est déjà ce que
-- l'application affiche. Les numéros de 4 caractères ou moins sont laissés
-- tels quels (les raccourcir n'apprendrait rien de plus à personne).
do $$
declare raccourcies int;
begin
  update public.depenses
     set data = jsonb_set(data, '{compte_bancaire}',
           to_jsonb('…' || right(trim(data ->> 'compte_bancaire'), 4)))
   where data ? 'compte_bancaire'
     and length(trim(coalesce(data ->> 'compte_bancaire', ''))) > 4
     and left(trim(data ->> 'compte_bancaire'), 1) <> '…';
  get diagnostics raccourcies = row_count;
  raise notice 'Dépenses dont le numéro a été raccourci : %', raccourcies;
end $$;


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
-- Les TROIS doivent valoir TRUE.
select
  not exists (select 1 from public.users where data ? 'compte_bancaire')
    as aucun_numero_sur_une_fiche_employe,
  not exists (
    select 1 from public.depenses
     where length(trim(coalesce(data ->> 'compte_bancaire', ''))) > 4
       and left(trim(data ->> 'compte_bancaire'), 1) <> '…')
    as aucun_numero_entier_sur_une_depense,
  exists (select 1 from pg_policies
           where schemaname = 'public' and tablename = 'paie' and policyname = 'paie_lecture')
    as la_fiche_de_paie_reste_protegee;
