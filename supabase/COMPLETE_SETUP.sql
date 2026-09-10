-- ============================================================================
-- BISO INVEST - COMPLETE SETUP SQL
-- Single idempotent execution file for Supabase SQL Editor
-- Merged from all migrations (001 through 011)
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 2. TABLES (from 001_initial_schema.sql)
-- ============================================================================

-- 1. PROFILES TABLE
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  phone varchar(20) unique not null,
  display_name varchar(100),
  referral_code varchar(20) unique not null,
  referred_by varchar(20) references profiles(referral_code),
  current_vip varchar(10) default 'VIP0',
  status varchar(20) default 'ACTIVE' check (status in ('ACTIVE', 'BLOCKED', 'SUSPENDED')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_login timestamp with time zone,
  notification_preferences jsonb default '{"sms": true, "push": true, "email": false}'::jsonb
);

-- 2. WALLETS TABLE
create table if not exists wallets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade unique not null,
  balance numeric(15,2) default 0.00 not null check (balance >= 0),
  total_deposited numeric(15,2) default 0.00 not null,
  total_withdrawn numeric(15,2) default 0.00 not null,
  total_invested numeric(15,2) default 0.00 not null,
  total_earned numeric(15,2) default 0.00 not null,
  today_earned numeric(15,2) default 0.00 not null,
  team_earned numeric(15,2) default 0.00 not null,
  total_assets numeric(15,2) default 0.00 not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. WALLET TRANSACTIONS LEDGER
create table if not exists wallet_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type varchar(30) not null check (type in ('DEPOSIT', 'INVESTMENT', 'INVESTMENT_PAYMENT', 'DAILY_PROFIT', 'WITHDRAWAL', 'COMMISSION', 'REFERRAL_TASK_REWARD', 'COUPON', 'ADJUSTMENT')),
  amount numeric(15,2) not null,
  balance_before numeric(15,2) not null,
  balance_after numeric(15,2) not null,
  reference varchar(100) unique not null,
  description text not null,
  status varchar(20) default 'COMPLETED' check (status in ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. PRODUCT CATEGORIES
create table if not exists product_categories (
  id uuid default gen_random_uuid() primary key,
  name varchar(100) unique not null,
  slug varchar(100) unique not null,
  description text,
  icon varchar(50),
  order_index int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. PRODUCTS
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references product_categories(id) on delete cascade not null,
  name varchar(150) not null,
  price numeric(15,2) not null,
  monthly_return numeric(15,2) not null,
  duration_months int default 12 not null,
  total_returns numeric(15,2) not null,
  purchase_limit int default 10 not null,
  description text,
  image_url text,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. INVESTMENTS
create table if not exists investments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  product_id uuid references products(id) on delete restrict not null,
  quantity int default 1 not null,
  total_amount numeric(15,2) not null,
  monthly_return numeric(15,2) not null,
  duration_months int default 12 not null,
  paid_installments int default 0 not null,
  remaining_installments int default 12 not null,
  next_payment_date timestamp with time zone not null,
  total_expected numeric(15,2) not null,
  status varchar(20) default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. INVESTMENT PAYMENTS (12 installments per investment)
create table if not exists investment_payments (
  id uuid default gen_random_uuid() primary key,
  investment_id uuid references investments(id) on delete cascade not null,
  installment_number int not null check (installment_number between 1 and 12),
  amount numeric(15,2) not null,
  scheduled_date timestamp with time zone not null,
  paid_date timestamp with time zone,
  status varchar(20) default 'SCHEDULED' check (status in ('SCHEDULED', 'DUE', 'PAID', 'CANCELLED')),
  transaction_id uuid references wallet_transactions(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. PAYMENT ACCOUNTS (Admin Mobile Money numbers)
create table if not exists payment_accounts (
  id uuid default gen_random_uuid() primary key,
  network varchar(30) unique not null check (network in ('Airtel Money', 'Orange Money', 'M-Pesa')),
  phone_number varchar(30) not null,
  account_name varchar(100) not null,
  is_active boolean default true not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid
);

-- 9. PAYMENT ACCOUNT HISTORY
create table if not exists payment_account_history (
  id uuid default gen_random_uuid() primary key,
  network varchar(30) not null,
  old_number varchar(30) not null,
  new_number varchar(30) not null,
  admin_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. DEPOSITS
create table if not exists deposits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  amount numeric(15,2) not null check (amount > 0),
  network varchar(30) not null check (network in ('Airtel Money', 'Orange Money', 'M-Pesa')),
  reference varchar(100) unique not null,
  proof_url text,
  status varchar(20) default 'EN_ATTENTE' check (status in ('EN_ATTENTE', 'VALIDEE', 'REFUSEE')),
  rejection_reason text,
  admin_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  validated_at timestamp with time zone
);

-- 11. WITHDRAWAL ACCOUNTS
create table if not exists withdrawal_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  network varchar(30) not null check (network in ('Airtel Money', 'Orange Money', 'M-Pesa')),
  phone_number varchar(30) not null,
  account_name varchar(100),
  is_default boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 12. WITHDRAWALS
create table if not exists withdrawals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  withdrawal_account_id uuid references withdrawal_accounts(id) on delete restrict not null,
  amount numeric(15,2) not null check (amount >= 5000),
  fee numeric(15,2) default 0.00 not null,
  net_amount numeric(15,2) not null,
  network varchar(30) not null,
  phone_number varchar(30) not null,
  status varchar(20) default 'EN_ATTENTE' check (status in ('EN_ATTENTE', 'EN_TRAITEMENT', 'PAYE', 'REFUSE')),
  payment_reference varchar(100),
  rejection_reason text,
  admin_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  processed_at timestamp with time zone,
  transaction_id uuid references wallet_transactions(id)
);

-- 13. REFERRALS & TEAM
create table if not exists referrals (
  id uuid default gen_random_uuid() primary key,
  parent_id uuid references profiles(id) on delete cascade not null,
  child_id uuid references profiles(id) on delete cascade not null unique,
  level varchar(5) not null check (level in ('A', 'B', 'C', 'D')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 14. COMMISSIONS
create table if not exists commissions (
  id uuid default gen_random_uuid() primary key,
  beneficiary_id uuid references profiles(id) on delete cascade not null,
  source_user_id uuid references profiles(id) on delete cascade not null,
  level varchar(5) not null check (level in ('A', 'B', 'C', 'D')),
  base_amount numeric(15,2) not null,
  rate numeric(5,2) not null,
  commission_amount numeric(15,2) not null,
  source_transaction_id uuid references wallet_transactions(id),
  status varchar(20) default 'PENDING' check (status in ('PENDING', 'PAID', 'CANCELLED')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 15. VIP LEVELS
create table if not exists vip_levels (
  id uuid default gen_random_uuid() primary key,
  level_name varchar(10) unique not null,
  min_investment numeric(15,2) not null,
  max_packs int not null,
  benefits text,
  is_active boolean default true not null,
  display_order int not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 16. USER VIP HISTORY
create table if not exists user_vip_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  old_vip varchar(10) not null,
  new_vip varchar(10) not null,
  admin_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 17. COUPONS
create table if not exists coupons (
  id uuid default gen_random_uuid() primary key,
  code varchar(50) unique not null,
  discount_type varchar(20) default 'FIXED' check (discount_type in ('PERCENTAGE', 'FIXED')),
  value numeric(15,2) not null,
  usage_limit int default 100 not null,
  used_count int default 0 not null,
  expires_at timestamp with time zone,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists coupon_usages (
  id uuid default gen_random_uuid() primary key,
  coupon_id uuid references coupons(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(coupon_id, user_id)
);

-- 18. SUPPORT TICKETS & MESSAGES
create table if not exists support_tickets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  subject varchar(200) not null,
  status varchar(20) default 'EN_ATTENTE' check (status in ('EN_ATTENTE', 'EN_COURS', 'RESOLU', 'FERME')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists support_messages (
  id uuid default gen_random_uuid() primary key,
  ticket_id uuid references support_tickets(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  is_admin boolean default false not null,
  message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 19. FAQ
create table if not exists faq (
  id uuid default gen_random_uuid() primary key,
  question text not null,
  answer text not null,
  display_order int default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 20. NOTIFICATIONS
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title varchar(150) not null,
  message text not null,
  type varchar(50) not null,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 21. ANNOUNCEMENTS
create table if not exists announcements (
  id uuid default gen_random_uuid() primary key,
  title varchar(200) not null,
  content text not null,
  is_published boolean default true not null,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 22. ADMIN ROLES & LOGS
create table if not exists admin_users (
  id uuid references auth.users on delete cascade primary key,
  role varchar(30) default 'SUPPORT_ADMIN' check (role in ('SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'CONTENT_ADMIN')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists admin_logs (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action varchar(100) not null,
  target_object varchar(100) not null,
  old_value text,
  new_value text,
  ip_address varchar(50),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 23. INVESTMENT CYCLES (from 005)
create table if not exists investment_cycles (
  id uuid default gen_random_uuid() primary key,
  investment_id uuid references investments(id) on delete cascade not null,
  cycle_number int not null check (cycle_number between 1 and 12),
  cycle_start_date timestamp with time zone not null,
  cycle_end_date timestamp with time zone not null,
  daily_profit numeric(15,2) not null,
  accumulated_profit numeric(15,2) default 0.00 not null,
  withdrawn_profit numeric(15,2) default 0.00 not null,
  last_accrual_date timestamp with time zone not null,
  status varchar(20) default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (investment_id, cycle_number)
);

-- 24. PHONE VERIFICATIONS for OTP (from 008/009)
create table if not exists phone_verifications (
  id uuid default gen_random_uuid() primary key,
  phone varchar(30) not null,
  otp_code varchar(64) not null,
  attempts int default 0 not null,
  max_attempts int default 3 not null,
  expires_at timestamp with time zone not null,
  verified boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================================
-- 3. SCHEMA CHANGES (from 008 - add columns if not exist)
-- ============================================================================

alter table withdrawals add column if not exists transaction_id uuid references wallet_transactions(id);
alter table investments add column if not exists idempotency_key varchar(100) unique;

-- ============================================================================
-- 4. TRIGGER FOR handle_new_user (from 001)
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
declare
  generated_code varchar(20);
  ref_user_id uuid;
begin
  generated_code := 'BISO' || upper(substring(md5(random()::text) from 1 for 6));

  insert into public.profiles (id, phone, referral_code, current_vip, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'phone', new.email, '+243000000000'),
    generated_code,
    'VIP0',
    'ACTIVE'
  );

  insert into public.wallets (user_id, balance, total_deposited, total_withdrawn, total_invested, total_earned, today_earned, team_earned, total_assets)
  values (new.id, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);

  if new.raw_user_meta_data->>'referral_code' is not null then
    select id into ref_user_id from public.profiles where referral_code = new.raw_user_meta_data->>'referral_code';
    if ref_user_id is not null then
      insert into public.referrals (parent_id, child_id, level) values (ref_user_id, new.id, 'A');
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 5. SEED: PAYMENT ACCOUNTS, VIP LEVELS, PRODUCT CATEGORIES (from 001)
-- ============================================================================

insert into payment_accounts (network, phone_number, account_name, is_active)
values
  ('Airtel Money', '+243990000001', 'BISO INVEST RDC (Airtel)', true),
  ('Orange Money', '+243890000001', 'BISO INVEST RDC (Orange)', true),
  ('M-Pesa', '+243810000001', 'BISO INVEST RDC (M-Pesa)', true)
on conflict (network) do nothing;

insert into vip_levels (level_name, min_investment, max_packs, benefits, is_active, display_order)
values
  ('VIP0', 0, 1, 'Condition 0 FC - Maximum 1 pack', true, 0),
  ('VIP1', 20000, 3, 'Condition 20 000 FC - Maximum 3 packs', true, 1),
  ('VIP2', 100000, 5, 'Condition 100 000 FC - Maximum 5 packs', true, 2),
  ('VIP3', 250000, 8, 'Condition 250 000 FC - Maximum 8 packs', true, 3),
  ('VIP4', 500000, 10, 'Condition 500 000 FC - Maximum 10 packs', true, 4),
  ('VIP5', 1000000, 12, 'VIP5 Avancé', false, 5),
  ('VIP6', 2500000, 15, 'VIP6 Expert', false, 6),
  ('VIP7', 5000000, 20, 'VIP7 Élite', false, 7)
on conflict (level_name) do nothing;

insert into product_categories (name, slug, description, icon, order_index)
values
  ('Agriculture', 'agriculture', 'Opportunités agricoles durables', 'Sprout', 1),
  ('Élevage', 'elevage', 'Élevage avicole, porcin et caprin', 'Beef', 2),
  ('Pisciculture', 'pisciculture', 'Élevage de poissons et production aquacole durable', 'Fish', 3)
on conflict (slug) do nothing;

-- ============================================================================
-- 6. SEED: PRODUCTS (from 002)
-- ============================================================================

do $$
declare
  ag_id uuid;
  el_id uuid;
  pi_id uuid;
begin
  select id into ag_id from product_categories where slug = 'agriculture';
  select id into el_id from product_categories where slug = 'elevage';

  -- AGRICULTURE
  insert into products (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url)
  values
    (ag_id, 'Pack Maïs', 30000, 30000, 12, 360000, 10, 'Investissement dans la culture et la récolte de maïs local de haute qualité.', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=600&q=80'),
    (ag_id, 'Pack Riz', 50000, 50000, 12, 600000, 10, 'Soutien aux rizières et à la production de riz communautaire.', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80'),
    (ag_id, 'Pack Manioc', 100000, 100000, 12, 1200000, 8, 'Culture à grande échelle de tubercules de manioc pour l''approvisionnement.', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80'),
    (ag_id, 'Pack Soja', 250000, 250000, 12, 3000000, 6, 'Production de soja biologique destiné aux marchés locaux et régionaux.', 'https://images.unsplash.com/photo-1599409636295-e3cf3538f212?auto=format&fit=crop&w=600&q=80'),
    (ag_id, 'Pack Maraîchage', 500000, 500000, 12, 6000000, 5, 'Exploitations maraîchères intensives (légumes frais et fruits).', 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=600&q=80'),
    (ag_id, 'Pack Grande Culture', 1000000, 1000000, 12, 12000000, 3, 'Domaine agricole mécanisé hautement productif.', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80')
  on conflict (name) do nothing;

  -- ÉLEVAGE
  insert into products (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url)
  values
    (el_id, 'Pack Poulets', 30000, 30000, 12, 360000, 10, 'Élevage avicole moderne de poulets de chair.', 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=600&q=80'),
    (el_id, 'Pack Porcs', 50000, 50000, 12, 600000, 10, 'Élevage porcin rigoureusement encadré et nourri.', 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=600&q=80'),
    (el_id, 'Pack Chèvres', 100000, 100000, 12, 1200000, 8, 'Élevage caprin en pâturage contrôlé.', 'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=600&q=80'),
    (el_id, 'Pack Œufs', 250000, 250000, 12, 3000000, 6, 'Centre de ponte moderne et production d''œufs frais.', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80'),
    (el_id, 'Pack Élevage Mixte', 500000, 500000, 12, 6000000, 5, 'Complexe d''élevage diversifié (volaille et bétail).', 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=600&q=80'),
    (el_id, 'Pack Élevage Premium', 1000000, 1000000, 12, 12000000, 3, 'Ferme d''élevage industrielle hautement automatisée.', 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=600&q=80')
  on conflict (name) do nothing;

  -- PISCICULTURE (4 packs officiels)
  select id into pi_id from product_categories where slug = 'pisciculture';

  insert into products (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url)
  values
    (pi_id, 'Tilapia', 30000, 30000, 12, 360000, 10, 'Élevage intensif de tilapias en étangs et bassins contrôlés.', 'https://images.unsplash.com/photo-1524704654690-b56c05c78a00?auto=format&fit=crop&w=600&q=80'),
    (pi_id, 'Silure', 50000, 50000, 12, 600000, 10, 'Production de silures (poisson-chat) en bassins à forte densité.', 'https://images.unsplash.com/photo-1534081333815-ae5019106622?auto=format&fit=crop&w=600&q=80'),
    (pi_id, 'Anguille', 100000, 100000, 12, 1200000, 10, 'Élevage d''anguilles en circuits fermés maîtrisés.', 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=600&q=80'),
    (pi_id, 'Carpe', 250000, 250000, 12, 3000000, 10, 'Élevage de carpes en étangs communautaires extensifs.', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80')
  on conflict (name) do nothing;

end $$;

-- ============================================================================
-- 7. SEED: FAQ AND ANNOUNCEMENTS (from 003_seed_faq)
-- ============================================================================

insert into faq (question, answer, display_order)
values
  ('Comment créer un compte ?', 'Cliquez sur Inscription, saisissez votre numéro de téléphone, choisissez un mot de passe sécurisé et entrez éventuellement le code de parrainage de votre parrain.', 1),
  ('Comment recharger ?', 'Allez dans le menu Recharger, choisissez votre réseau Mobile Money (Airtel, Orange ou M-Pesa), effectuez le transfert vers le numéro indiqué puis soumettez la référence de transaction.', 2),
  ('Quels réseaux sont disponibles ?', 'Nous acceptons Airtel Money, Orange Money et M-Pesa en République Démocratique du Congo.', 3),
  ('Comment investir ?', 'Parcourez les secteurs dans l''onglet Investir, choisissez un pack selon votre niveau VIP, sélectionnez la quantité et confirmez votre investissement.', 4),
  ('Comment fonctionnent les versements ?', 'Chaque investissement génère des bénéfices journaliers et 12 cycles de 30 jours. Les bénéfices sont cumulés et réclamables à tout moment.', 5),
  ('Comment retirer ?', 'Enregistrez votre compte de retrait dans vos paramètres, puis rendez-vous sur Retirer. Le minimum est de 5 000 FC avec 0% de frais.', 6),
  ('Quel est le minimum de retrait ?', 'Le montant minimum de retrait est fixé à 5 000 FC.', 7),
  ('Comment fonctionne le VIP ?', 'Votre niveau VIP progresse selon vos investissements et vous donne accès à un nombre maximum de packs plus élevé.', 8),
  ('Comment fonctionne l''équipe ?', 'Partagez votre code ou lien de parrainage. Vous touchez des commissions sur 4 niveaux (A: 10%, B: 3%, C: 1%, D: 1%) basées sur l''activité économique.', 9),
  ('Comment contacter le support ?', 'Utilisez la section Service pour ouvrir un ticket de support en direct avec notre équipe.', 10)
on conflict (question) do nothing;

-- Corriger toute FAQ existante mentionnant les anciens secteurs
update faq
set answer = 'Parcourez les secteurs dans l''onglet Investir, choisissez un pack selon votre niveau VIP, sélectionnez la quantité et confirmez votre investissement.'
where question = 'Comment investir ?'
  and answer like '%secteur%';

insert into announcements (title, content, is_published)
values
  ('Bienvenue sur Biso Invest !', 'Ensemble, construisons demain. Découvrez nos opportunités d''investissement dans l''agriculture et l''élevage.', true),
  ('Sécurité et Transparence', 'Vos transactions financières sont sécurisées par un ledger rigoureux. Veillez à ne jamais partager vos identifiants.', true)
on conflict (title) do nothing;

-- ============================================================================
-- 8. RLS POLICIES (from 003_rls_policies.sql)
-- ============================================================================

alter table profiles enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table product_categories enable row level security;
alter table products enable row level security;
alter table investments enable row level security;
alter table investment_payments enable row level security;
alter table payment_accounts enable row level security;
alter table payment_account_history enable row level security;
alter table deposits enable row level security;
alter table withdrawal_accounts enable row level security;
alter table withdrawals enable row level security;
alter table referrals enable row level security;
alter table commissions enable row level security;
alter table vip_levels enable row level security;
alter table user_vip_history enable row level security;
alter table coupons enable row level security;
alter table coupon_usages enable row level security;
alter table support_tickets enable row level security;
alter table support_messages enable row level security;
alter table faq enable row level security;
alter table notifications enable row level security;
alter table announcements enable row level security;
alter table admin_users enable row level security;
alter table admin_logs enable row level security;
alter table investment_cycles enable row level security;
alter table phone_verifications enable row level security;

-- Helper function to check if user is admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.admin_users
    where id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- 1. PROFILES POLICIES
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id or public.is_admin());
drop policy if exists "Users can update own display_name or preferences" on profiles;
create policy "Users can update own display_name or preferences" on profiles for update using (auth.uid() = id) with check (auth.uid() = id and current_vip = (select current_vip from profiles where id = auth.uid()) and status = (select status from profiles where id = auth.uid()));
drop policy if exists "Admins can manage profiles" on profiles;
create policy "Admins can manage profiles" on profiles for all using (public.is_admin());

-- 2. WALLETS POLICIES
drop policy if exists "Users can view own wallet" on wallets;
create policy "Users can view own wallet" on wallets for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Admins can manage wallets" on wallets;
create policy "Admins can manage wallets" on wallets for all using (public.is_admin());

-- 3. WALLET TRANSACTIONS POLICIES
drop policy if exists "Users can view own transactions" on wallet_transactions;
create policy "Users can view own transactions" on wallet_transactions for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Admins can manage transactions" on wallet_transactions;
create policy "Admins can manage transactions" on wallet_transactions for all using (public.is_admin());

-- 4. PRODUCTS & CATEGORIES POLICIES
drop policy if exists "Anyone can view active products and categories" on products;
create policy "Anyone can view active products and categories" on products for select using (is_active = true or public.is_admin());
drop policy if exists "Anyone can view categories" on product_categories;
create policy "Anyone can view categories" on product_categories for select using (true);
drop policy if exists "Admins can manage products" on products;
create policy "Admins can manage products" on products for all using (public.is_admin());
drop policy if exists "Admins can manage categories" on product_categories;
create policy "Admins can manage categories" on product_categories for all using (public.is_admin());

-- 5. INVESTMENTS POLICIES
drop policy if exists "Users can view own investments" on investments;
create policy "Users can view own investments" on investments for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Admins can manage investments" on investments;
create policy "Admins can manage investments" on investments for all using (public.is_admin());

-- 6. INVESTMENT PAYMENTS POLICIES
drop policy if exists "Users can view own investment payments" on investment_payments;
create policy "Users can view own investment payments" on investment_payments for select using (
  exists (select 1 from investments where investments.id = investment_payments.investment_id and investments.user_id = auth.uid())
  or public.is_admin()
);
drop policy if exists "Admins can manage investment payments" on investment_payments;
create policy "Admins can manage investment payments" on investment_payments for all using (public.is_admin());

-- 7. PAYMENT ACCOUNTS & HISTORY
drop policy if exists "Anyone can view active payment accounts" on payment_accounts;
create policy "Anyone can view active payment accounts" on payment_accounts for select using (is_active = true or public.is_admin());
drop policy if exists "Admins can manage payment accounts" on payment_accounts;
create policy "Admins can manage payment accounts" on payment_accounts for all using (public.is_admin());
drop policy if exists "Admins can view payment history" on payment_account_history;
create policy "Admins can view payment history" on payment_account_history for select using (public.is_admin());

-- 8. DEPOSITS POLICIES
drop policy if exists "Users can view own deposits" on deposits;
create policy "Users can view own deposits" on deposits for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Users can create own deposit request" on deposits;
create policy "Users can create own deposit request" on deposits for insert with check (auth.uid() = user_id and status = 'EN_ATTENTE');
drop policy if exists "Admins can manage deposits" on deposits;
create policy "Admins can manage deposits" on deposits for all using (public.is_admin());

-- 9. WITHDRAWAL ACCOUNTS
drop policy if exists "Users can manage own withdrawal accounts" on withdrawal_accounts;
create policy "Users can manage own withdrawal accounts" on withdrawal_accounts for all using (auth.uid() = user_id or public.is_admin());

-- 10. WITHDRAWALS POLICIES (note: direct user insert removed per 008)
drop policy if exists "Users can view own withdrawals" on withdrawals;
create policy "Users can view own withdrawals" on withdrawals for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Users can create own withdrawal request" on withdrawals;
drop policy if exists "Admins can manage withdrawals" on withdrawals;
create policy "Admins can manage withdrawals" on withdrawals for all using (public.is_admin());

-- 11. REFERRALS & COMMISSIONS
drop policy if exists "Users can view own referrals" on referrals;
create policy "Users can view own referrals" on referrals for select using (auth.uid() = parent_id or auth.uid() = child_id or public.is_admin());
drop policy if exists "Users can view own commissions" on commissions;
create policy "Users can view own commissions" on commissions for select using (auth.uid() = beneficiary_id or public.is_admin());
drop policy if exists "Admins can manage referrals and commissions" on referrals;
create policy "Admins can manage referrals and commissions" on referrals for all using (public.is_admin());
drop policy if exists "Admins can manage commissions" on commissions;
create policy "Admins can manage commissions" on commissions for all using (public.is_admin());

-- 12. VIP LEVELS
drop policy if exists "Users can view active VIP levels" on vip_levels;
create policy "Users can view active VIP levels" on vip_levels for select using (is_active = true or public.is_admin());
drop policy if exists "Admins can manage VIP levels" on vip_levels;
create policy "Admins can manage VIP levels" on vip_levels for all using (public.is_admin());
drop policy if exists "Users can view own VIP history" on user_vip_history;
create policy "Users can view own VIP history" on user_vip_history for select using (auth.uid() = user_id or public.is_admin());

-- 13. COUPONS & USAGES
drop policy if exists "Users can view active coupons" on coupons;
create policy "Users can view active coupons" on coupons for select using (is_active = true or public.is_admin());
drop policy if exists "Users can manage own coupon usages" on coupon_usages;
create policy "Users can manage own coupon usages" on coupon_usages for all using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Admins can manage coupons" on coupons;
create policy "Admins can manage coupons" on coupons for all using (public.is_admin());

-- 14. SUPPORT, FAQ, NOTIFICATIONS, ANNOUNCEMENTS
drop policy if exists "Users can manage own support tickets" on support_tickets;
create policy "Users can manage own support tickets" on support_tickets for all using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Users can manage own support messages" on support_messages;
create policy "Users can manage own support messages" on support_messages for all using (
  exists (select 1 from support_tickets where support_tickets.id = support_messages.ticket_id and support_tickets.user_id = auth.uid())
  or public.is_admin()
);
drop policy if exists "Anyone can view FAQ" on faq;
create policy "Anyone can view FAQ" on faq for select using (true);
drop policy if exists "Admins can manage FAQ" on faq;
create policy "Admins can manage FAQ" on faq for all using (public.is_admin());
drop policy if exists "Users can view own notifications" on notifications;
create policy "Users can view own notifications" on notifications for all using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Anyone can view published announcements" on announcements;
create policy "Anyone can view published announcements" on announcements for select using (is_published = true or public.is_admin());
drop policy if exists "Admins can manage announcements" on announcements;
create policy "Admins can manage announcements" on announcements for all using (public.is_admin());

-- 15. ADMIN ROLES & LOGS
drop policy if exists "Admins can access admin users" on admin_users;
create policy "Admins can access admin users" on admin_users for all using (public.is_admin());
drop policy if exists "Admins can access admin logs" on admin_logs;
create policy "Admins can access admin logs" on admin_logs for all using (public.is_admin());

-- 16. INVESTMENT CYCLES
drop policy if exists "Users can view own investment cycles" on investment_cycles;
create policy "Users can view own investment cycles" on investment_cycles for select using (
  exists (select 1 from investments where investments.id = investment_cycles.investment_id and investments.user_id = auth.uid())
  or public.is_admin()
);
drop policy if exists "Admins can manage investment cycles" on investment_cycles;
create policy "Admins can manage investment cycles" on investment_cycles for all using (public.is_admin());

-- 17. PHONE VERIFICATIONS
drop policy if exists "Admins can view verifications" on phone_verifications;
create policy "Admins can view verifications" on phone_verifications for select using (public.is_admin());

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Calculate real calendar days in a month
create or replace function public.get_days_in_month(p_date date)
returns int as $$
begin
  return extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day'))::int;
end;
$$ language plpgsql immutable;

grant execute on function public.get_days_in_month(date) to authenticated, anon;

-- ============================================================================
-- 10. FINANCIAL RPC FUNCTIONS (from 004, then REPLACED by 008)
-- ============================================================================

-- NOTE: The functions below are first defined from 004, then fully replaced
-- by the 008 revised versions. Using CREATE OR REPLACE ensures the 008
-- versions are the final authoritative ones.

-- Distribution helper (DÉSACTIVÉ depuis la migration 015 : le parrainage
-- A/B/C/D ne génère plus aucune commission ; l'historique existant est conservé)
create or replace function public.distribute_commissions(
  p_user_id uuid,
  p_base_amount numeric,
  p_source_tx_id uuid
)
returns void as $$
begin
  -- DÉSACTIVÉ : l'ancien parrainage A/B/C/D ne crédite plus rien.
  return;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- VIP evaluation (from 008)
create or replace function public.evaluate_and_update_user_vip(p_user_id uuid)
returns varchar as $$
declare
  v_current_vip varchar;
  v_new_vip varchar;
  v_total_invested numeric;
  v_curr_order int := 0;
  v_new_order int := 0;
begin
  select coalesce(total_invested, 0) into v_total_invested from wallets where user_id = p_user_id;
  select coalesce(current_vip, 'VIP0') into v_current_vip from profiles where id = p_user_id;

  select coalesce(display_order, 0) into v_curr_order from vip_levels where level_name = v_current_vip;

  select level_name, display_order into v_new_vip, v_new_order
  from vip_levels
  where is_active = true and min_investment <= v_total_invested
  order by display_order desc
  limit 1;

  if v_new_vip is not null and v_new_order > v_curr_order then
    update profiles set
      current_vip = v_new_vip,
      updated_at = now()
    where id = p_user_id;

    insert into user_vip_history (user_id, old_vip, new_vip, admin_id, created_at)
    values (p_user_id, v_current_vip, v_new_vip, null, now());

    return v_new_vip;
  end if;

  return v_current_vip;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.evaluate_and_update_user_vip(uuid) to authenticated;

-- Purchase investment RPC (final version from 008)
create or replace function public.purchase_investment(
  p_product_id uuid,
  p_quantity int,
  p_idempotency_key varchar default null
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_product record;
  v_wallet record;
  v_total_cost numeric;
  v_new_balance numeric;
  v_reference varchar;
  v_tx_id uuid;
  v_inv_id uuid;
  v_current_vip varchar;
  v_vip_limit int;
  v_user_pack_count int;
  v_projected_invested numeric;
  v_qualified_vip varchar;
  v_existing_inv record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantité invalide';
  end if;

  -- Idempotency key to prevent double purchase
  if p_idempotency_key is not null and trim(p_idempotency_key) != '' then
    select * into v_existing_inv from investments where idempotency_key = trim(p_idempotency_key);
    if found then
      return json_build_object(
        'success', true,
        'investment_id', v_existing_inv.id,
        'idempotent_replay', true,
        'total_cost', v_existing_inv.total_amount
      );
    end if;
  end if;

  select * into v_product from products where id = p_product_id and is_active = true;
  if not found then
    raise exception 'Produit introuvable ou inactif';
  end if;

  if p_quantity > v_product.purchase_limit then
    raise exception 'Dépassement de la limite d''achat pour ce pack';
  end if;

  v_total_cost := v_product.price * p_quantity;

  select * into v_wallet from wallets where user_id = v_user_id for update;
  if not found or v_wallet.balance < v_total_cost then
    raise exception 'Solde insuffisant dans votre portefeuille';
  end if;

  -- Calculate projected VIP level with this purchase
  v_projected_invested := v_wallet.total_invested + v_total_cost;
  select level_name into v_qualified_vip from vip_levels
  where is_active = true and min_investment <= v_projected_invested
  order by display_order desc limit 1;

  select current_vip into v_current_vip from profiles where id = v_user_id;

  select max_packs into v_vip_limit from vip_levels
  where level_name = coalesce(v_qualified_vip, v_current_vip, 'VIP0');

  select coalesce(sum(quantity), 0) into v_user_pack_count
  from investments where user_id = v_user_id and product_id = p_product_id and status = 'ACTIVE';

  if (v_user_pack_count + p_quantity) > v_vip_limit then
    raise exception 'Dépassement de la limite autorisée (% packs pour votre niveau %)', v_vip_limit, coalesce(v_qualified_vip, v_current_vip);
  end if;

  v_new_balance := v_wallet.balance - v_total_cost;
  v_reference := 'INV-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));

  -- Debit wallet
  update wallets set
    balance = v_new_balance,
    total_invested = total_invested + v_total_cost,
    total_assets = total_assets + v_total_cost,
    updated_at = now()
  where user_id = v_user_id;

  -- Create ledger transaction
  insert into wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    reference, description, status
  )
  values (
    v_user_id,
    'INVESTMENT',
    v_total_cost,
    v_wallet.balance,
    v_new_balance,
    v_reference,
    'Souscription ' || p_quantity || 'x ' || v_product.name,
    'COMPLETED'
  )
  returning id into v_tx_id;

  -- Create investment with idempotency key
  insert into investments (
    user_id, product_id, quantity, total_amount, monthly_return,
    duration_months, paid_installments, remaining_installments,
    next_payment_date, total_expected, status, idempotency_key
  )
  values (
    v_user_id, p_product_id, p_quantity, v_total_cost,
    v_product.monthly_return * p_quantity, v_product.duration_months,
    0, v_product.duration_months, now() + interval '1 month',
    v_product.total_returns * p_quantity, 'ACTIVE',
    coalesce(trim(p_idempotency_key), 'INV-KEY-' || gen_random_uuid()::text)
  )
  returning id into v_inv_id;

  -- Execute server-side VIP upgrade
  perform public.evaluate_and_update_user_vip(v_user_id);

  -- Distribute commissions with ledger entries
  perform public.distribute_commissions(v_user_id, v_total_cost, v_tx_id);

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (null, 'PURCHASE_INVESTMENT', 'investments', 'User ' || v_user_id || ' souscrit ' || p_quantity || 'x ' || v_product.name || ' pour ' || v_total_cost || ' FC');

  return json_build_object(
    'success', true,
    'investment_id', v_inv_id,
    'total_cost', v_total_cost,
    'reference', v_reference
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.purchase_investment(uuid, int, varchar) to authenticated;

-- Create withdrawal RPC (final version from 008 with 15% fee + ledger linkage)
create or replace function public.create_withdrawal(
  p_withdrawal_account_id uuid,
  p_amount numeric
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_wallet record;
  v_account record;
  v_new_balance numeric;
  v_ref varchar;
  v_fee numeric;
  v_net_amount numeric;
  v_tx_id uuid;
  v_wit_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  if p_amount < 5000 then
    raise exception 'Le montant minimum de retrait est de 5 000 FC';
  end if;

  select * into v_account from withdrawal_accounts where id = p_withdrawal_account_id and user_id = v_user_id;
  if not found then
    raise exception 'Compte de retrait introuvable ou non autorisé';
  end if;

  select * into v_wallet from wallets where user_id = v_user_id for update;
  if not found or v_wallet.balance < p_amount then
    raise exception 'Solde insuffisant dans votre portefeuille';
  end if;

  v_fee := round(p_amount * 0.15, 2);
  v_net_amount := p_amount - v_fee;
  v_new_balance := v_wallet.balance - p_amount;
  v_ref := 'WIT-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));

  -- Debit wallet immediately
  update wallets set
    balance = v_new_balance,
    updated_at = now()
  where user_id = v_user_id;

  -- Create PENDING ledger entry
  insert into wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    reference, description, status
  )
  values (
    v_user_id,
    'WITHDRAWAL',
    p_amount,
    v_wallet.balance,
    v_new_balance,
    v_ref,
    'Retrait brut ' || p_amount || ' FC (frais 15% = ' || v_fee || ' FC, net = ' || v_net_amount || ' FC) vers ' || v_account.network || ' ' || v_account.phone_number,
    'PENDING'
  )
  returning id into v_tx_id;

  -- Create withdrawal with strict transaction_id linkage
  insert into withdrawals (
    user_id, withdrawal_account_id, amount, fee, net_amount,
    network, phone_number, status, transaction_id
  )
  values (
    v_user_id, p_withdrawal_account_id, p_amount, v_fee, v_net_amount,
    v_account.network, v_account.phone_number, 'EN_ATTENTE', v_tx_id
  )
  returning id into v_wit_id;

  return json_build_object(
    'success', true,
    'withdrawal_id', v_wit_id,
    'transaction_id', v_tx_id,
    'reference', v_ref,
    'gross_amount', p_amount,
    'fee', v_fee,
    'net_amount', v_net_amount
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.create_withdrawal(uuid, numeric) to authenticated;

-- Approve deposit RPC (from 004)
create or replace function public.approve_deposit(
  p_deposit_id uuid
)
returns jsonb as $$
declare
  v_deposit record;
  v_wallet record;
  v_new_balance numeric;
  v_admin_id uuid;
begin
  v_admin_id := auth.uid();
  if not public.is_admin() then
    raise exception 'Accès non autorisé';
  end if;

  select * into v_deposit from deposits where id = p_deposit_id for update;
  if not found then
    raise exception 'Dépôt introuvable';
  end if;

  if v_deposit.status != 'EN_ATTENTE' then
    raise exception 'Ce dépôt a déjà été traité (idempotence)';
  end if;

  select * into v_wallet from wallets where user_id = v_deposit.user_id for update;
  v_new_balance := v_wallet.balance + v_deposit.amount;

  update deposits set
    status = 'VALIDEE',
    admin_id = v_admin_id,
    validated_at = now()
  where id = p_deposit_id;

  update wallets set
    balance = v_new_balance,
    total_deposited = total_deposited + v_deposit.amount,
    updated_at = now()
  where user_id = v_deposit.user_id;

  insert into wallet_transactions (user_id, type, amount, balance_before, balance_after, reference, description, status)
  values (v_deposit.user_id, 'DEPOSIT', v_deposit.amount, v_wallet.balance, v_new_balance, v_deposit.reference, 'Recharge validée (' || v_deposit.network || ')', 'COMPLETED');

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (v_admin_id, 'APPROVE_DEPOSIT', 'deposits', 'Approved deposit ' || p_deposit_id || ' amount ' || v_deposit.amount);

  return json_build_object('success', true);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Reject deposit RPC (from 004)
create or replace function public.reject_deposit(
  p_deposit_id uuid,
  p_reason text
)
returns jsonb as $$
declare
  v_admin_id uuid;
begin
  v_admin_id := auth.uid();
  if not public.is_admin() then
    raise exception 'Accès non autorisé';
  end if;

  update deposits set
    status = 'REFUSEE',
    rejection_reason = p_reason,
    admin_id = v_admin_id
  where id = p_deposit_id and status = 'EN_ATTENTE';

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (v_admin_id, 'REJECT_DEPOSIT', 'deposits', 'Rejected deposit ' || p_deposit_id);

  return json_build_object('success', true);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Approve withdrawal RPC (final version from 008 with transaction_id linkage)
create or replace function public.approve_withdrawal(
  p_withdrawal_id uuid,
  p_payment_reference text
)
returns jsonb as $$
declare
  v_withdrawal record;
  v_admin_id uuid;
begin
  v_admin_id := auth.uid();
  if not public.is_admin() then
    raise exception 'Accès non autorisé';
  end if;

  if p_payment_reference is null or trim(p_payment_reference) = '' then
    raise exception 'La référence de paiement Mobile Money est obligatoire';
  end if;

  select * into v_withdrawal from withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'Retrait introuvable';
  end if;

  if v_withdrawal.status != 'EN_ATTENTE' and v_withdrawal.status != 'EN_TRAITEMENT' then
    raise exception 'Ce retrait a déjà été traité (idempotence)';
  end if;

  update withdrawals set
    status = 'PAYE',
    payment_reference = trim(p_payment_reference),
    admin_id = v_admin_id,
    processed_at = now()
  where id = p_withdrawal_id;

  update wallets set
    total_withdrawn = total_withdrawn + v_withdrawal.amount,
    updated_at = now()
  where user_id = v_withdrawal.user_id;

  if v_withdrawal.transaction_id is not null then
    update wallet_transactions set
      status = 'COMPLETED',
      description = description || ' | Réf paiement MM: ' || trim(p_payment_reference)
    where id = v_withdrawal.transaction_id;
  end if;

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (v_admin_id, 'APPROVE_WITHDRAWAL', 'withdrawals', 'Retrait ' || p_withdrawal_id || ' validé. Réf: ' || trim(p_payment_reference) || ' Net: ' || v_withdrawal.net_amount || ' FC');

  return json_build_object('success', true, 'net_amount', v_withdrawal.net_amount);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.approve_withdrawal(uuid, text) to authenticated;

-- Reject withdrawal RPC (final version from 008 with transaction_id cleanup)
create or replace function public.reject_withdrawal(
  p_withdrawal_id uuid,
  p_reason text
)
returns jsonb as $$
declare
  v_withdrawal record;
  v_wallet record;
  v_new_balance numeric;
  v_admin_id uuid;
begin
  v_admin_id := auth.uid();
  if not public.is_admin() then
    raise exception 'Accès non autorisé';
  end if;

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Le motif de refus est obligatoire';
  end if;

  select * into v_withdrawal from withdrawals where id = p_withdrawal_id for update;
  if not found or v_withdrawal.status in ('REFUSE', 'PAYE') then
    raise exception 'Retrait invalide ou déjà traité';
  end if;

  select * into v_wallet from wallets where user_id = v_withdrawal.user_id for update;
  v_new_balance := v_wallet.balance + v_withdrawal.amount;

  update wallets set
    balance = v_new_balance,
    updated_at = now()
  where user_id = v_withdrawal.user_id;

  update withdrawals set
    status = 'REFUSE',
    rejection_reason = trim(p_reason),
    admin_id = v_admin_id,
    processed_at = now()
  where id = p_withdrawal_id;

  if v_withdrawal.transaction_id is not null then
    update wallet_transactions set
      status = 'CANCELLED',
      description = description || ' | REFUSÉ: ' || trim(p_reason)
    where id = v_withdrawal.transaction_id;
  end if;

  insert into wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    reference, description, status
  )
  values (
    v_withdrawal.user_id,
    'ADJUSTMENT',
    v_withdrawal.amount,
    v_wallet.balance,
    v_new_balance,
    'REF-WIT-' || substring(p_withdrawal_id::text from 1 for 8),
    'Remboursement suite au refus du retrait de ' || v_withdrawal.amount || ' FC — Motif: ' || trim(p_reason),
    'COMPLETED'
  );

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (v_admin_id, 'REJECT_WITHDRAWAL', 'withdrawals', 'Retrait ' || p_withdrawal_id || ' refusé. Motif: ' || trim(p_reason));

  return json_build_object('success', true, 'refunded_amount', v_withdrawal.amount);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.reject_withdrawal(uuid, text) to authenticated;

-- ============================================================================
-- 11. INVESTMENT CYCLES: TRIGGER + ACCRUAL + CLAIM (from 005, trigger REPLACED by 008)
-- ============================================================================

-- Trigger function to init cycles when investment is created (final version from 008)
create or replace function public.init_investment_cycles()
returns trigger as $$
declare
  v_daily_profit numeric;
  v_monthly_return numeric;
  v_start_date date;
  v_days_in_month int;
begin
  select monthly_return * new.quantity into v_monthly_return from products where id = new.product_id;

  v_start_date := new.created_at::date;
  v_days_in_month := public.get_days_in_month(v_start_date);
  v_daily_profit := round(v_monthly_return / v_days_in_month, 4);

  insert into investment_cycles (
    investment_id, cycle_number, cycle_start_date, cycle_end_date,
    daily_profit, accumulated_profit, withdrawn_profit, last_accrual_date, status
  )
  values (
    new.id,
    1,
    new.created_at,
    new.created_at + (v_days_in_month || ' days')::interval,
    v_daily_profit,
    0.00,
    0.00,
    new.created_at,
    'ACTIVE'
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists on_investment_created_init_cycles on investments;
create trigger on_investment_created_init_cycles
  after insert on investments
  for each row execute procedure public.init_investment_cycles();

-- Accrual function (from 005)
create or replace function public.accrual_investment_yields(p_investment_id uuid)
returns void as $$
declare
  v_inv record;
  v_cycle record;
  v_now timestamp with time zone := now();
  v_days_diff int;
  v_max_cycles int := 12;
begin
  select * into v_inv from investments where id = p_investment_id for update;
  if not found or v_inv.status != 'ACTIVE' then
    return;
  end if;

  loop
    select * into v_cycle from investment_cycles where investment_id = p_investment_id and status = 'ACTIVE' order by cycle_number asc limit 1 for update;
    if not found or v_cycle.cycle_number > v_max_cycles then
      exit;
    end if;

    if v_now >= v_cycle.cycle_end_date then
      v_days_diff := extract(day from (v_cycle.cycle_end_date - v_cycle.last_accrual_date))::int;
      if v_days_diff > 0 then
        update investment_cycles set
          accumulated_profit = accumulated_profit + (v_days_diff * daily_profit),
          last_accrual_date = v_cycle.cycle_end_date
        where id = v_cycle.id;
      end if;

      update investment_cycles set status = 'COMPLETED' where id = v_cycle.id;

      if v_cycle.cycle_number < v_max_cycles then
        insert into investment_cycles (investment_id, cycle_number, cycle_start_date, cycle_end_date, daily_profit, accumulated_profit, withdrawn_profit, last_accrual_date, status)
        values (
          p_investment_id,
          v_cycle.cycle_number + 1,
          v_cycle.cycle_end_date,
          v_cycle.cycle_end_date + interval '30 days',
          v_cycle.daily_profit,
          0.00,
          0.00,
          v_cycle.cycle_end_date,
          'ACTIVE'
        )
        on conflict (investment_id, cycle_number) do nothing;
      else
        exit;
      end if;
    else
      v_days_diff := extract(day from (v_now - v_cycle.last_accrual_date))::int;
      if v_days_diff > 0 then
        update investment_cycles set
          accumulated_profit = accumulated_profit + (v_days_diff * daily_profit),
          last_accrual_date = v_now
        where id = v_cycle.id;
      end if;
      exit;
    end if;
  end loop;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke execute on function public.accrual_investment_yields(uuid) from public, anon;

-- Claim profit RPC (from 005)
create or replace function public.claim_investment_profit(
  p_investment_id uuid,
  p_cycle_id uuid,
  p_amount numeric
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_inv record;
  v_cycle record;
  v_wallet record;
  v_available_profit numeric;
  v_new_balance numeric;
  v_ref varchar;
  v_tx_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select * into v_inv from investments where id = p_investment_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Investissement introuvable ou accès refusé';
  end if;

  perform public.accrual_investment_yields(p_investment_id);

  select * into v_cycle from investment_cycles where id = p_cycle_id and investment_id = p_investment_id for update;
  if not found then
    raise exception 'Cycle introuvable';
  end if;

  v_available_profit := v_cycle.accumulated_profit - v_cycle.withdrawn_profit;

  if p_amount > v_available_profit then
    raise exception 'Montant demandé supérieur au bénéfice disponible (%)', v_available_profit;
  end if;

  v_ref := 'CLAIM-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));

  select * into v_wallet from wallets where user_id = v_user_id for update;
  if not found then
    raise exception 'Wallet introuvable';
  end if;

  v_new_balance := v_wallet.balance + p_amount;

  update investment_cycles set
    withdrawn_profit = withdrawn_profit + p_amount
  where id = v_cycle.id;

  update wallets set
    balance = v_new_balance,
    total_earned = total_earned + p_amount,
    today_earned = today_earned + p_amount,
    updated_at = now()
  where user_id = v_user_id;

  insert into wallet_transactions (user_id, type, amount, balance_before, balance_after, reference, description, status)
  values (v_user_id, 'INVESTMENT_PAYMENT', p_amount, v_wallet.balance, v_new_balance, v_ref, 'Retrait bénéfice cycle ' || v_cycle.cycle_number, 'COMPLETED')
  returning id into v_tx_id;

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (null, 'CLAIM_PROFIT', 'investment_cycles', 'User ' || v_user_id || ' claimed ' || p_amount || ' FC on cycle ' || v_cycle.cycle_number);

  return json_build_object('success', true, 'claimed_amount', p_amount, 'new_balance', v_new_balance);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.claim_investment_profit(uuid, uuid, numeric) to authenticated;

-- ============================================================================
-- 12. PAYMENT ACCOUNT HISTORY TRIGGER (from 008)
-- ============================================================================

create or replace function public.log_payment_account_change()
returns trigger as $$
begin
  if old.phone_number is distinct from new.phone_number then
    insert into payment_account_history (network, old_number, new_number, admin_id, created_at)
    values (
      new.network,
      old.phone_number,
      new.phone_number,
      coalesce(auth.uid(), new.updated_by, '00000000-0000-0000-0000-000000000000'::uuid),
      now()
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists on_payment_account_updated on payment_accounts;
create trigger on_payment_account_updated
  before update on payment_accounts
  for each row execute procedure public.log_payment_account_change();

-- ============================================================================
-- 13. DUPLICATE CLEANUP (from 006 & 007)
-- ============================================================================

-- Remove duplicate products, keeping the first created
delete from products a using products b
where a.id > b.id and a.name = b.name;

-- Ensure unique constraint exists
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_name_unique') then
    alter table products add constraint products_name_unique unique (name);
  end if;
end $$;

-- Remove duplicate FAQ entries
delete from faq a using faq b
where a.id > b.id and a.question = b.question;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'faq_question_unique') then
    alter table faq add constraint faq_question_unique unique (question);
  end if;
end $$;

-- Remove duplicate announcements
delete from announcements a using announcements b
where a.id > b.id and a.title = b.title;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'announcements_title_unique') then
    alter table announcements add constraint announcements_title_unique unique (title);
  end if;
end $$;

-- ============================================================================
-- 14. OTP FUNCTIONS (from 009 - final secure version)
-- ============================================================================

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

  select count(*) into v_recent_count
  from phone_verifications
  where phone = v_clean_phone
    and created_at > (now() - interval '10 minutes');

  if v_recent_count >= 5 then
    raise exception 'Trop de demandes de code OTP. Veuillez patienter 10 minutes.';
  end if;

  update phone_verifications
  set verified = true
  where phone = v_clean_phone
    and verified = false;

  v_code := lpad((floor(random() * 900000) + 100000)::text, 6, '0');

  v_hash := encode(digest(v_code::bytea, 'sha256'), 'hex');

  insert into phone_verifications (phone, otp_code, attempts, max_attempts, expires_at, verified)
  values (v_clean_phone, v_hash, 0, 3, now() + interval '10 minutes', false);

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

  v_input_hash := encode(digest(trim(p_code)::bytea, 'sha256'), 'hex');

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

  if v_rec.attempts >= v_rec.max_attempts then
    update phone_verifications set verified = true where id = v_rec.id;
    raise exception 'Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.';
  end if;

  update phone_verifications
  set attempts = attempts + 1
  where id = v_rec.id;

  if v_rec.otp_code != v_input_hash then
    if (v_rec.attempts + 1) >= v_rec.max_attempts then
      update phone_verifications set verified = true where id = v_rec.id;
      raise exception 'Code incorrect. Nombre maximal de tentatives atteint. Veuillez demander un nouveau code.';
    else
      raise exception 'Code de vérification incorrect. Il vous reste % tentative(s).', (v_rec.max_attempts - (v_rec.attempts + 1));
    end if;
  end if;

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

-- ============================================================================
-- 15. DELETE UNWANTED SECTORS (from 010)
-- ============================================================================

DELETE FROM products WHERE category_id IN (
  SELECT id FROM product_categories WHERE slug IN (
    'commerce',
    'industrie-transformation',
    'transport-logistique',
    'restauration',
    'energie-solaire'
  )
);

DELETE FROM product_categories WHERE slug IN (
  'commerce',
  'industrie-transformation',
  'transport-logistique',
  'restauration',
  'energie-solaire'
);

-- ============================================================================
-- 16. UPDATE VIP AND PACKS (from 011)
-- ============================================================================

-- Deactivate all packs not in the authorized price list
UPDATE products
SET is_active = false
WHERE price NOT IN (30000, 50000, 100000, 250000);

-- Activate exclusively the 4 authorized packs
UPDATE products
SET is_active = true
WHERE price IN (30000, 50000, 100000, 250000);

-- Official VIP thresholds
UPDATE vip_levels
SET min_investment = 0, max_packs = 1, benefits = 'Condition 0 FC — Maximum 1 pack', is_active = true
WHERE level_name = 'VIP0';

UPDATE vip_levels
SET min_investment = 20000, max_packs = 3, benefits = 'Pack VIP1 (20 000 FC) — Maximum 3 packs', is_active = true
WHERE level_name = 'VIP1';

UPDATE vip_levels
SET min_investment = 50000, max_packs = 5, benefits = 'Pack VIP2 (50 000 FC) — Maximum 5 packs', is_active = true
WHERE level_name = 'VIP2';

UPDATE vip_levels
SET min_investment = 100000, max_packs = 8, benefits = 'Pack VIP3 (100 000 FC) — Maximum 8 packs', is_active = true
WHERE level_name = 'VIP3';

UPDATE vip_levels
SET min_investment = 250000, max_packs = 10, benefits = 'Pack VIP4 (250 000 FC) — Maximum 10 packs', is_active = true
WHERE level_name = 'VIP4';

-- Deactivate unused upper tiers
UPDATE vip_levels
SET is_active = false
WHERE level_name IN ('VIP5', 'VIP6', 'VIP7');

-- ============================================================================
-- 17. PISCICULTURE: SEULS LES 4 PACKS OFFICIELS PEUVENT ETRE ACTIFS
-- ============================================================================
-- Après la réactivation globale (section 16), on redésactive tout pack
-- Pisciculture qui n'est pas l'un des 4 officiels (Tilapia, Silure,
-- Anguille, Carpe). On ne supprime jamais : les investissements
-- historiques restent référencés et intacts.

UPDATE products
SET is_active = false
WHERE category_id = (SELECT id FROM product_categories WHERE slug = 'pisciculture')
  AND name NOT IN ('Tilapia', 'Silure', 'Anguille', 'Carpe');

UPDATE products
SET is_active = true,
    price = 30000, monthly_return = 30000, duration_months = 12, total_returns = 360000, purchase_limit = 10
WHERE category_id = (SELECT id FROM product_categories WHERE slug = 'pisciculture')
  AND name = 'Tilapia';

UPDATE products
SET is_active = true,
    price = 50000, monthly_return = 50000, duration_months = 12, total_returns = 600000, purchase_limit = 10
WHERE category_id = (SELECT id FROM product_categories WHERE slug = 'pisciculture')
  AND name = 'Silure';

UPDATE products
SET is_active = true,
    price = 100000, monthly_return = 100000, duration_months = 12, total_returns = 1200000, purchase_limit = 10
WHERE category_id = (SELECT id FROM product_categories WHERE slug = 'pisciculture')
  AND name = 'Anguille';

UPDATE products
SET is_active = true,
    price = 250000, monthly_return = 250000, duration_months = 12, total_returns = 3000000, purchase_limit = 10
WHERE category_id = (SELECT id FROM product_categories WHERE slug = 'pisciculture')
  AND name = 'Carpe';

-- ============================================================================
-- 18. VALIDATION QUOTIDIENNE DU BÉNÉFICE (VENDRE) — from 013
-- ============================================================================

create table if not exists profit_claims (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  investment_id uuid references investments(id) on delete cascade not null,
  cycle_id uuid references investment_cycles(id) on delete set null,
  profit_date date not null,
  amount numeric(15,2) not null,
  claimed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  transaction_id uuid references wallet_transactions(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint profit_claims_one_per_day unique (investment_id, profit_date)
);

create index if not exists idx_profit_claims_user_date on profit_claims (user_id, profit_date desc);
create index if not exists idx_profit_claims_inv_date on profit_claims (investment_id, profit_date desc);

alter table profit_claims enable row level security;

drop policy if exists "Users can view own profit claims" on profit_claims;
create policy "Users can view own profit claims"
  on profit_claims for select
  using (auth.uid() = user_id);

grant select on profit_claims to authenticated;

create or replace function public.claim_daily_profit()
returns jsonb as $$
declare
  v_user_id uuid;
  v_wallet record;
  v_days int;
  v_daily numeric;
  v_amt numeric;
  v_total numeric := 0;
  v_claim_id uuid;
  v_claim_ids uuid[] := '{}';
  v_tx_id uuid;
  v_ref varchar;
  v_new_balance numeric;
  v_cycle_id uuid;
  v_inv record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  select * into v_wallet from wallets where user_id = v_user_id for update;
  if not found then
    raise exception 'Wallet introuvable';
  end if;

  v_days := public.get_days_in_month(current_date);
  v_ref := 'DAILY-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));

  for v_inv in
    select i.id, i.monthly_return, i.status
    from investments i
    where i.user_id = v_user_id
      and i.status = 'ACTIVE'
      and (i.created_at + (i.duration_months * interval '1 month')) > now()
    order by i.created_at asc
    for update of i
  loop
    select c.id into v_cycle_id
    from investment_cycles c
    where c.investment_id = v_inv.id
      and c.status = 'ACTIVE'
    order by c.cycle_number asc
    limit 1;

    v_daily := round(v_inv.monthly_return / v_days, 2);

    v_amt := null;
    insert into profit_claims (user_id, investment_id, cycle_id, profit_date, amount, claimed_at, transaction_id)
    values (v_user_id, v_inv.id, v_cycle_id, current_date, v_daily, now(), null)
    on conflict (investment_id, profit_date) do nothing
    returning id, amount into v_claim_id, v_amt;

    if v_amt is not null then
      v_total := v_total + v_amt;
      v_claim_ids := array_append(v_claim_ids, v_claim_id);
    end if;
  end loop;

  if v_total <= 0 then
    return json_build_object(
      'success', true,
      'claimed_amount', 0,
      'already_claimed_today', true,
      'new_balance', v_wallet.balance,
      'message', 'Aucun bénéfice à réclamer aujourd''hui'
    );
  end if;

  v_new_balance := v_wallet.balance + v_total;

  update wallets set
    balance = v_new_balance,
    total_earned = total_earned + v_total,
    today_earned = today_earned + v_total,
    updated_at = now()
  where user_id = v_user_id;

  insert into wallet_transactions (user_id, type, amount, balance_before, balance_after, reference, description, status)
  values (v_user_id, 'DAILY_PROFIT', v_total, v_wallet.balance, v_new_balance, v_ref, 'Bénéfice du jour (VENDRE)', 'COMPLETED')
  returning id into v_tx_id;

  update profit_claims set transaction_id = v_tx_id where id = any(v_claim_ids);

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (null, 'DAILY_PROFIT_CLAIM', 'profit_claims', 'User ' || v_user_id || ' a vendu son bénéfice du jour : ' || v_total || ' FC (' || array_length(v_claim_ids, 1) || ' investissement(s))');

  return json_build_object(
    'success', true,
    'claimed_amount', v_total,
    'new_balance', v_new_balance,
    'transaction_id', v_tx_id,
    'already_claimed_today', false,
    'claims_count', array_length(v_claim_ids, 1)
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.claim_daily_profit() to authenticated;

-- ============================================================================
-- 19. TÂCHES D'INVITATION (from 015 — remplace le parrainage A/B/C/D)
-- ============================================================================
-- L'ancien distribute_commissions (section 9) est déjà DÉSACTIVÉ en no-op.

-- 19.1 Tables
create table if not exists referral_tasks (
  id uuid default gen_random_uuid() primary key,
  required_invites int not null unique,
  reward_amount numeric(15,2) not null,
  display_order int not null default 0,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists referral_task_rewards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  task_id uuid references referral_tasks(id) on delete cascade not null,
  required_invites int not null,
  reward_amount numeric(15,2) not null,
  transaction_id uuid references wallet_transactions(id) on delete set null,
  claimed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint referral_task_rewards_one_claim unique (user_id, task_id)
);

create index if not exists idx_referral_task_rewards_user on referral_task_rewards (user_id, claimed_at desc);

insert into referral_tasks (required_invites, reward_amount, display_order)
values
  (1, 3000, 1),
  (5, 15000, 2),
  (10, 30000, 3),
  (20, 60000, 4),
  (50, 200000, 5),
  (100, 500000, 6)
on conflict (required_invites) do update
  set reward_amount = excluded.reward_amount,
      display_order = excluded.display_order,
      is_active = true;

alter table referral_tasks enable row level security;
drop policy if exists "Public can view referral tasks" on referral_tasks;
create policy "Public can view referral tasks" on referral_tasks for select using (true);

alter table referral_task_rewards enable row level security;
drop policy if exists "Users view own task rewards" on referral_task_rewards;
create policy "Users view own task rewards"
  on referral_task_rewards for select
  using (auth.uid() = user_id or public.is_admin());

grant select on referral_tasks to anon, authenticated;
grant select on referral_task_rewards to authenticated;

-- 19.2 Ledger : type de transaction identifiable
alter table wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table wallet_transactions
  add constraint wallet_transactions_type_check
  check (type in ('DEPOSIT', 'INVESTMENT', 'INVESTMENT_PAYMENT', 'DAILY_PROFIT', 'WITHDRAWAL', 'COMMISSION', 'REFERRAL_TASK_REWARD', 'COUPON', 'ADJUSTMENT'));

-- 19.3 Compteur serveur des invitations valides
create or replace function public.count_valid_invitations(p_parent_id uuid)
returns int as $$
declare
  v_count int;
begin
  select count(distinct r.child_id)
  into v_count
  from referrals r
  join investments i on i.user_id = r.child_id
  where r.parent_id = p_parent_id
    and i.status in ('ACTIVE', 'COMPLETED');

  return coalesce(v_count, 0);
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

grant execute on function public.count_valid_invitations(uuid) to authenticated;

-- 19.4 Données complètes de la page Tâche
create or replace function public.get_referral_task_data()
returns jsonb as $$
declare
  v_user_id uuid;
  v_total_team int;
  v_valid int;
  v_total_rewards numeric;
  v_next jsonb;
  v_tasks jsonb := '[]';
  v_task record;
  v_claimed boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  select count(*) into v_total_team from referrals where parent_id = v_user_id;
  v_total_team := coalesce(v_total_team, 0);

  v_valid := public.count_valid_invitations(v_user_id);

  select coalesce(sum(reward_amount), 0) into v_total_rewards
  from referral_task_rewards
  where user_id = v_user_id;

  for v_task in
    select t.id, t.required_invites, t.reward_amount, t.display_order
    from referral_tasks t
    where t.is_active = true
    order by t.display_order asc
  loop
    select exists (
      select 1 from referral_task_rewards r
      where r.user_id = v_user_id and r.task_id = v_task.id
    ) into v_claimed;

    v_tasks := v_tasks || jsonb_build_object(
      'id', v_task.id,
      'required_invites', v_task.required_invites,
      'reward_amount', v_task.reward_amount,
      'display_order', v_task.display_order,
      'progress', least(v_valid, v_task.required_invites),
      'claimed', v_claimed
    );
  end loop;

  select jsonb_build_object(
    'id', t.id,
    'required_invites', t.required_invites,
    'reward_amount', t.reward_amount
  )
  into v_next
  from referral_tasks t
  where t.is_active = true
    and t.required_invites > v_valid
    and not exists (
      select 1 from referral_task_rewards r
      where r.user_id = v_user_id and r.task_id = t.id
    )
  order by t.required_invites asc
  limit 1;

  return json_build_object(
    'total_team', v_total_team,
    'valid_invites', v_valid,
    'pending_invites', greatest(v_total_team - v_valid, 0),
    'total_rewards', v_total_rewards,
    'tasks', v_tasks,
    'next_reward', v_next
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.get_referral_task_data() to authenticated;

-- 19.5 Réclamation d'une récompense (unique + atomique)
create or replace function public.claim_referral_task_reward(p_task_id uuid)
returns jsonb as $$
declare
  v_user_id uuid;
  v_task record;
  v_valid int;
  v_wallet record;
  v_new_balance numeric;
  v_ref varchar;
  v_tx_id uuid;
  v_reward_id uuid;
  v_reward_amount numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  select * into v_task
  from referral_tasks
  where id = p_task_id and is_active = true;
  if not found then
    raise exception 'Tâche introuvable ou désactivée';
  end if;

  v_valid := public.count_valid_invitations(v_user_id);
  if v_valid < v_task.required_invites then
    raise exception 'Invitations insuffisantes : %/%', v_valid, v_task.required_invites;
  end if;

  v_reward_amount := v_task.reward_amount;

  v_reward_id := null;
  insert into referral_task_rewards (user_id, task_id, required_invites, reward_amount, transaction_id)
  values (v_user_id, p_task_id, v_task.required_invites, v_reward_amount, null)
  on conflict (user_id, task_id) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    return json_build_object(
      'success', true,
      'already_claimed', true,
      'reward_amount', 0,
      'message', 'Cette récompense a déjà été réclamée'
    );
  end if;

  select * into v_wallet from wallets where user_id = v_user_id for update;
  if not found then
    raise exception 'Wallet introuvable';
  end if;

  v_new_balance := v_wallet.balance + v_reward_amount;
  v_ref := 'RWR-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));

  update wallets set
    balance = v_new_balance,
    team_earned = team_earned + v_reward_amount,
    total_earned = total_earned + v_reward_amount,
    today_earned = today_earned + v_reward_amount,
    updated_at = now()
  where user_id = v_user_id;

  insert into wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    reference, description, status
  )
  values (
    v_user_id,
    'REFERRAL_TASK_REWARD',
    v_reward_amount,
    v_wallet.balance,
    v_new_balance,
    v_ref,
    'Récompense tâche d''invitation : ' || v_task.required_invites || ' invitation(s) valide(s) — ' || v_reward_amount || ' FC',
    'COMPLETED'
  )
  returning id into v_tx_id;

  update referral_task_rewards set transaction_id = v_tx_id where id = v_reward_id;

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (
    null,
    'REFERRAL_TASK_REWARD',
    'referral_task_rewards',
    'User ' || v_user_id || ' a réclamé la récompense de ' || v_task.required_invites || ' invitation(s) valide(s) : ' || v_reward_amount || ' FC'
  );

  return json_build_object(
    'success', true,
    'already_claimed', false,
    'reward_amount', v_reward_amount,
    'transaction_id', v_tx_id,
    'new_balance', v_new_balance
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.claim_referral_task_reward(uuid) to authenticated;

-- 19.6 Admin : vue globale des tâches d'invitation
create or replace function public.admin_referral_task_overview()
returns jsonb as $$
declare
  v_admin_id uuid;
  v_rows jsonb := '[]';
  v_p record;
  v_valid int;
  v_total_team int;
  v_total_rewards numeric;
begin
  v_admin_id := auth.uid();
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Accès non autorisé';
  end if;

  for v_p in
    select p.id, p.phone, p.referral_code
    from profiles p
    order by p.created_at asc
  loop
    v_valid := public.count_valid_invitations(v_p.id);

    select count(*) into v_total_team from referrals where parent_id = v_p.id;
    v_total_team := coalesce(v_total_team, 0);

    select coalesce(sum(rw.reward_amount), 0) into v_total_rewards
    from referral_task_rewards rw
    where rw.user_id = v_p.id;

    v_rows := v_rows || jsonb_build_object(
      'user_id', v_p.id,
      'phone', v_p.phone,
      'referral_code', v_p.referral_code,
      'total_team', v_total_team,
      'valid_invites', v_valid,
      'total_rewards', v_total_rewards,
      'history', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'required_invites', h.required_invites,
              'reward_amount', h.reward_amount,
              'claimed_at', h.claimed_at
            )
          ),
          '[]'::jsonb
        )
        from (
          select required_invites, reward_amount, claimed_at
          from referral_task_rewards
          where user_id = v_p.id
          order by claimed_at desc
        ) h
      )
    );
  end loop;

  return v_rows;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.admin_referral_task_overview() to authenticated;

-- 19.7 Signup : verrous anti-fraude (auto-parrainage bloqué, filleul unique)
create or replace function public.on_new_user_created()
returns trigger as $$
declare
  generated_code varchar(20);
  ref_user_id uuid;
begin
  generated_code := 'BISO' || upper(substring(md5(random()::text) from 1 for 6));

  insert into public.profiles (id, phone, referral_code, current_vip, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'phone', new.email, '+243000000000'),
    generated_code,
    'VIP0',
    'ACTIVE'
  );

  insert into public.wallets (user_id, balance, total_deposited, total_withdrawn, total_invested, total_earned, today_earned, team_earned, total_assets)
  values (new.id, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);

  if new.raw_user_meta_data->>'referral_code' is not null then
    select id into ref_user_id from public.profiles where referral_code = new.raw_user_meta_data->>'referral_code';
    if ref_user_id is not null and ref_user_id <> new.id then
      insert into public.referrals (parent_id, child_id, level)
      values (ref_user_id, new.id, 'A')
      on conflict (child_id) do nothing;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.on_new_user_created();

-- ============================================================================
-- 20. ATTRIBUTION AUTOMATIQUE DES RÉCOMPENSES D'INVITATION (from 016)
-- ----------------------------------------------------------------------------
-- Dès qu'un filleul (inscrit avec le code) voit un investissement devenir
-- ACTIVE ou COMPLETED, la récompense des paliers atteints est créditée
-- AUTOMATIQUEMENT dans le wallet du parrain. Chaque palier n'est crédité
-- qu'une seule fois (contrainte unique + ON CONFLICT DO NOTHING).
-- ============================================================================

-- 20.1 Traçabilité : marquage « attribution automatique »
alter table referral_task_rewards
  add column if not exists auto_granted boolean default false not null;

-- 20.2 Attribution de toutes les récompenses éligibles (idempotente)
create or replace function public.grant_referral_task_rewards(p_parent_id uuid)
returns void as $$
declare
  v_valid int;
  v_task record;
  v_reward_id uuid;
  v_wallet record;
  v_new_balance numeric;
  v_ref varchar;
  v_tx_id uuid;
begin
  if p_parent_id is null then
    return;
  end if;

  v_valid := public.count_valid_invitations(p_parent_id);
  if v_valid = 0 then
    return;
  end if;

  for v_task in
    select t.id, t.required_invites, t.reward_amount
    from referral_tasks t
    where t.is_active = true
      and t.required_invites <= v_valid
      and not exists (
        select 1 from referral_task_rewards r
        where r.user_id = p_parent_id and r.task_id = t.id
      )
    order by t.required_invites asc
  loop
    v_reward_id := null;
    insert into referral_task_rewards (user_id, task_id, required_invites, reward_amount, transaction_id, auto_granted)
    values (p_parent_id, v_task.id, v_task.required_invites, v_task.reward_amount, null, true)
    on conflict (user_id, task_id) do nothing
    returning id into v_reward_id;

    if v_reward_id is not null then
      select * into v_wallet from wallets where user_id = p_parent_id for update;
      if not found then
        continue;
      end if;

      v_new_balance := v_wallet.balance + v_task.reward_amount;
      v_ref := 'RWR-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));

      update wallets set
        balance = v_new_balance,
        team_earned = team_earned + v_task.reward_amount,
        total_earned = total_earned + v_task.reward_amount,
        today_earned = today_earned + v_task.reward_amount,
        updated_at = now()
      where user_id = p_parent_id;

      insert into wallet_transactions (
        user_id, type, amount, balance_before, balance_after,
        reference, description, status
      )
      values (
        p_parent_id,
        'REFERRAL_TASK_REWARD',
        v_task.reward_amount,
        v_wallet.balance,
        v_new_balance,
        v_ref,
        'Récompense automatique tâche d''invitation : ' || v_task.required_invites || ' invitation(s) valide(s) — ' || v_task.reward_amount || ' FC',
        'COMPLETED'
      )
      returning id into v_tx_id;

      update referral_task_rewards set transaction_id = v_tx_id where id = v_reward_id;

      insert into admin_logs (admin_id, action, target_object, new_value)
      values (
        null,
        'REFERRAL_TASK_REWARD_AUTO',
        'referral_task_rewards',
        'Attribution automatique : ' || v_task.reward_amount || ' FC à l''utilisateur ' || p_parent_id || ' pour ' || v_task.required_invites || ' invitation(s) valide(s)'
      );
    end if;
  end loop;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.grant_referral_task_rewards(uuid) to authenticated, service_role;

-- 20.3 Trigger : crédit automatique dès qu'un investissement est validé
create or replace function public.on_investment_validated()
returns trigger as $$
declare
  v_parent_id uuid;
begin
  select parent_id into v_parent_id
  from referrals
  where child_id = new.user_id;

  if v_parent_id is not null then
    perform public.grant_referral_task_rewards(v_parent_id);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_referral_tasks_on_investment on investments;
create trigger trg_referral_tasks_on_investment
  after insert or update of status on investments
  for each row
  when (new.status in ('ACTIVE', 'COMPLETED'))
  execute function public.on_investment_validated();

-- 20.4 Régularisation : créditer les invitations déjà valides (idempotent)
do $$
declare
  v_parent record;
begin
  for v_parent in
    select distinct r.parent_id
    from referrals r
    join investments i on i.user_id = r.child_id
    where i.status in ('ACTIVE', 'COMPLETED')
  loop
    perform public.grant_referral_task_rewards(v_parent.parent_id);
  end loop;
end;
$$;

-- ============================================================================
-- END OF COMPLETE_SETUP.sql
-- ============================================================================
