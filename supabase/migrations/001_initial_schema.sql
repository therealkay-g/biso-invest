-- BISO INVEST - COMPLETE POSTGRESQL MIGRATION SCHEMA

-- Enable UUID extension
create extension if not exists "uuid-ossp";

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
  type varchar(30) not null check (type in ('DEPOSIT', 'INVESTMENT', 'INVESTMENT_PAYMENT', 'WITHDRAWAL', 'COMMISSION', 'COUPON', 'ADJUSTMENT')),
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

-- 5. PRODUCTS (42 packs)
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
  amount numeric(15,2) not null check (amount >= 30000),
  fee numeric(15,2) default 0.00 not null,
  net_amount numeric(15,2) not null,
  network varchar(30) not null,
  phone_number varchar(30) not null,
  status varchar(20) default 'EN_ATTENTE' check (status in ('EN_ATTENTE', 'EN_TRAITEMENT', 'PAYE', 'REFUSE')),
  payment_reference varchar(100),
  rejection_reason text,
  admin_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  processed_at timestamp with time zone
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

-- TRIGGERS AND FUNCTIONS FOR AUTO PROFILE & WALLET CREATION
create or replace function public.handle_new_user()
returns trigger as $$
declare
  generated_code varchar(20);
  ref_user_id uuid;
begin
  -- Generate unique referral code (e.g., BISO + random 6 chars)
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

  -- Handle referral if provided in metadata
  if new.raw_user_meta_data->>'referral_code' is not null then
    select id into ref_user_id from public.profiles where referral_code = new.raw_user_meta_data->>'referral_code';
    if ref_user_id is not null then
      -- Link A level
      insert into public.referrals (parent_id, child_id, level) values (ref_user_id, new.id, 'A');
      -- Link B, C, D levels recursively if parents exist
      -- (Simplified for initial trigger, can be expanded)
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- SEED DATA: PAYMENT ACCOUNTS
insert into payment_accounts (network, phone_number, account_name, is_active)
values 
  ('Airtel Money', '+243990000001', 'BISO INVEST RDC (Airtel)', true),
  ('Orange Money', '+243890000001', 'BISO INVEST RDC (Orange)', true),
  ('M-Pesa', '+243810000001', 'BISO INVEST RDC (M-Pesa)', true)
on conflict (network) do nothing;

-- SEED DATA: VIP LEVELS (VIP0 to VIP7, VIP5-7 deactivated)
insert into vip_levels (level_name, min_investment, max_packs, benefits, is_active, display_order)
values
  ('VIP0', 0, 1, 'Condition 0 FC - Maximum 1 pack', true, 0),
  ('VIP1', 30000, 3, 'Condition 30 000 FC - Maximum 3 packs', true, 1),
  ('VIP2', 100000, 5, 'Condition 100 000 FC - Maximum 5 packs', true, 2),
  ('VIP3', 250000, 8, 'Condition 250 000 FC - Maximum 8 packs', true, 3),
  ('VIP4', 500000, 10, 'Condition 500 000 FC - Maximum 10 packs', true, 4),
  ('VIP5', 1000000, 12, 'VIP5 Avancé', false, 5),
  ('VIP6', 2500000, 15, 'VIP6 Expert', false, 6),
  ('VIP7', 5000000, 20, 'VIP7 Élite', false, 7)
on conflict (level_name) do nothing;

-- SEED DATA: CATEGORIES & 42 PRODUCTS
insert into product_categories (name, slug, description, icon, order_index)
values
  ('Agriculture', 'agriculture', 'Opportunités agricoles durables', 'Sprout', 1),
  ('Élevage', 'elevage', 'Élevage avicole, porcin et caprin', 'Beef', 2),
  ('Commerce', 'commerce', 'Commerce de gros et détail', 'ShoppingBag', 3),
  ('Industrie / Transformation', 'industrie-transformation', 'Transformation agro-alimentaire et mini-usines', 'Factory', 4),
  ('Énergie solaire', 'energie-solaire', 'Centrales et kits solaires', 'Sun', 5),
  ('Transport / Logistique', 'transport-logistique', 'Flotte de transport et livraison', 'Truck', 6),
  ('Restauration', 'restauration', 'Restauration et fast-food', 'Utensils', 7)
on conflict (slug) do nothing;
