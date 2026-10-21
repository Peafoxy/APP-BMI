-- ============================================================
-- vocaux-1-espace.sql — 🎤 L'ESPACE PRIVÉ DES NOTES VOCALES ENVOYÉES PAR BMI
-- (21/10/2026, Timo : « AVEC l'espace de fichiers privé de Supabase, il faut
-- lancer pour 30 jours »)
--
-- Crée l'espace de fichiers « vocaux-wa » :
--   - PRIVÉ : aucun lien public, aucune règle qui l'ouvre aux appareils ;
--     seul le serveur de l'application (sa clé, variable Vercel) y range et y
--     lit, après avoir revérifié que la personne peut voir la conversation ;
--   - 3 Mo au plus par fichier, des sons seulement.
-- L'effacement à 30 jours est fait par la tournée de 7 h (rien à programmer ici).
-- Le relancer est sans danger. Ne lit ni n'écrit aucune table de BMI.
--
-- Réponse attendue de la dernière ligne : true | true | true
--   1. l'espace existe et il est privé ;
--   2. aucune règle ne nomme cet espace (donc rien ne l'ouvre exprès) ;
--   3. aucune règle de l'espace de fichiers ne vaut pour TOUS les espaces à la
--      fois (sinon elle ouvrirait aussi celui-ci) — un « false » ici : me le
--      dire, on regarde ensemble la règle en cause avant d'aller plus loin.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vocaux-wa', 'vocaux-wa', false, 3145728,
        array['audio/ogg', 'audio/mp4', 'audio/webm', 'audio/mpeg', 'audio/aac'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

select
  coalesce((select not public from storage.buckets where id = 'vocaux-wa'), false) as espace_prive,
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%vocaux-wa%'
  ) as aucune_regle_ne_l_ouvre,
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) not like '%bucket_id%'
      and roles && array['public', 'anon', 'authenticated']::name[]
  ) as aucune_regle_pour_tous_les_espaces;
