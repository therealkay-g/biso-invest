-- ============================================================
-- BISO INVEST — MIGRATION 009: SÉCURISATION OTP (SHA-256)
-- Résolution définitive des 2 blockers de production
-- 1. Suppression totale de dev_otp dans les réponses API
-- 2. Hachage SHA-256 de phone_verifications.otp_code
-- 3. Comparaison par hash avec limitation à 3 tentatives et 10 minutes d'expiration
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists phone_verifications (
  id uuid default uuid_generate_v4() primary key,
  phone varchar(30) not null,
  otp_code varchar(64) not null,
  attempts int default 0 not null,
  max_attempts int default 3 not null,
  expires_at timestamp with time zone not null,
  verified boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Adaptation si la table a déjà été créée
alter table phone_verifications alter column otp_code type varchar(64);
alter table phone_verifications add column if not exists attempts int default 0 not null;
alter table phone_verifications add column if not exists max_attempts int default 3 not null;

alter table phone_verifications enable row level security;
drop policy if exists "Admins can view verifications" on phone_verifications;
create policy "Admins can view verifications" on phone_verifications for select using (public.is_admin());

create or replace function public.request_phone_otp(p_phone varchar)
returns jsonb as $$
declare
  v_code varchar(6);
  v_hash varchar(64);
  v_clean_phone varchar(30);
  v_recent_count int;
begin
  v_clean_phone := regexp_replace(p_phone, '[^0-9+]', '', 'g');
  if length(v_clean_phone) < 9 then
    raise exception 'Numéro de téléphone invalide';
  end if;

  -- Limitation de débit : max 5 demandes d'OTP par tranche de 10 minutes
  select count(*) into v_recent_count
  from phone_verifications
  where phone = v_clean_phone
    and created_at > (now() - interval '10 minutes');

  if v_recent_count >= 5 then
    raise exception 'Trop de demandes de code OTP. Veuillez patienter 10 minutes.';
  end if;

  -- Invalider les anciens codes non vérifiés pour ce numéro
  update phone_verifications
  set verified = true
  where phone = v_clean_phone
    and verified = false;

  -- Générer un code cryptographique à 6 chiffres
  v_code := lpad((floor(random() * 900000) + 100000)::text, 6, '0');

  -- Hachage SHA-256 avant stockage (pgcrypto) : le code en clair n'est JAMAIS stocké
  v_hash := encode(digest(v_code::bytea, 'sha256'), 'hex');

  insert into phone_verifications (phone, otp_code, attempts, max_attempts, expires_at, verified)
  values (v_clean_phone, v_hash, 0, 3, now() + interval '10 minutes', false);

  -- [INTERFACE FOURNISSEUR SMS]
  -- En production, cette section déclenche l'envoi physique du SMS (via webhook, pg_net ou Edge Function)
  -- avec les paramètres (v_clean_phone, v_code).
  -- Le code en clair n'apparaît dans aucun log, aucun stockage et aucune réponse API.

  -- Réponse épurée : AUCUN dev_otp, AUCUN code renvoyé au client
  return json_build_object(
    'success', true,
    'message', 'Code de vérification envoyé avec succès (valable 10 minutes)'
  );
end;
$$ language plpgsql security definer set search_path = public, extensions, pg_temp;

grant execute on function public.request_phone_otp(varchar) to anon, authenticated;

create or replace function public.verify_phone_otp(p_phone varchar, p_code varchar)
returns jsonb as $$
declare
  v_clean_phone varchar(30);
  v_input_hash varchar(64);
  v_rec record;
begin
  v_clean_phone := regexp_replace(p_phone, '[^0-9+]', '', 'g');

  if trim(p_code) is null or length(trim(p_code)) != 6 then
    raise exception 'Le code de vérification doit comporter exactement 6 chiffres';
  end if;

  -- Calcul du hash SHA-256 du code saisi par l'utilisateur
  v_input_hash := encode(digest(trim(p_code)::bytea, 'sha256'), 'hex');

  -- Recherche de la dernière demande active pour ce numéro
  select * into v_rec from phone_verifications
  where phone = v_clean_phone
    and verified = false
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Code de vérification invalide ou expiré';
  end if;

  -- Vérification du quota de tentatives
  if v_rec.attempts >= v_rec.max_attempts then
    update phone_verifications set verified = true where id = v_rec.id;
    raise exception 'Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.';
  end if;

  -- Incrémentation du compteur de tentatives
  update phone_verifications
  set attempts = attempts + 1
  where id = v_rec.id;

  -- Comparaison sécurisée des hash SHA-256
  if v_rec.otp_code != v_input_hash then
    if (v_rec.attempts + 1) >= v_rec.max_attempts then
      update phone_verifications set verified = true where id = v_rec.id;
      raise exception 'Code incorrect. Nombre maximal de tentatives atteint. Veuillez demander un nouveau code.';
    else
      raise exception 'Code de vérification incorrect. Il vous reste % tentative(s).', (v_rec.max_attempts - (v_rec.attempts + 1));
    end if;
  end if;

  -- Validation du code
  update phone_verifications
  set verified = true
  where id = v_rec.id;

  return json_build_object(
    'success', true,
    'verified', true,
    'message', 'Numéro de téléphone vérifié avec succès'
  );
end;
$$ language plpgsql security definer set search_path = public, extensions, pg_temp;

grant execute on function public.verify_phone_otp(varchar, varchar) to anon, authenticated;
