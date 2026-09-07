-- BISO INVEST - MIGRATION 003: STRICT RLS POLICIES

-- Enable RLS on all sensitive tables
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
create policy "Users can view own profile" on profiles for select using (auth.uid() = id or public.is_admin());
create policy "Users can update own display_name or preferences" on profiles for update using (auth.uid() = id) with check (auth.uid() = id and current_vip = (select current_vip from profiles where id = auth.uid()) and status = (select status from profiles where id = auth.uid()));
create policy "Admins can manage profiles" on profiles for all using (public.is_admin());

-- 2. WALLETS POLICIES (Read-only for users, no direct update/insert)
create policy "Users can view own wallet" on wallets for select using (auth.uid() = user_id or public.is_admin());
create policy "Admins can manage wallets" on wallets for all using (public.is_admin());

-- 3. WALLET TRANSACTIONS POLICIES (Read-only for users, NO direct user insert/update)
create policy "Users can view own transactions" on wallet_transactions for select using (auth.uid() = user_id or public.is_admin());
create policy "Admins can manage transactions" on wallet_transactions for all using (public.is_admin());

-- 4. PRODUCTS & CATEGORIES POLICIES
create policy "Anyone can view active products and categories" on products for select using (is_active = true or public.is_admin());
create policy "Anyone can view categories" on product_categories for select using (true);
create policy "Admins can manage products" on products for all using (public.is_admin());
create policy "Admins can manage categories" on product_categories for all using (public.is_admin());

-- 5. INVESTMENTS POLICIES
create policy "Users can view own investments" on investments for select using (auth.uid() = user_id or public.is_admin());
create policy "Admins can manage investments" on investments for all using (public.is_admin());

-- 6. INVESTMENT PAYMENTS POLICIES
create policy "Users can view own investment payments" on investment_payments for select using (
  exists (select 1 from investments where investments.id = investment_payments.investment_id and investments.user_id = auth.uid())
  or public.is_admin()
);
create policy "Admins can manage investment payments" on investment_payments for all using (public.is_admin());

-- 7. PAYMENT ACCOUNTS & HISTORY
create policy "Anyone can view active payment accounts" on payment_accounts for select using (is_active = true or public.is_admin());
create policy "Admins can manage payment accounts" on payment_accounts for all using (public.is_admin());
create policy "Admins can view payment history" on payment_account_history for select using (public.is_admin());

-- 8. DEPOSITS POLICIES
create policy "Users can view own deposits" on deposits for select using (auth.uid() = user_id or public.is_admin());
create policy "Users can create own deposit request" on deposits for insert with check (auth.uid() = user_id and status = 'EN_ATTENTE');
create policy "Admins can manage deposits" on deposits for all using (public.is_admin());

-- 9. WITHDRAWAL ACCOUNTS
create policy "Users can manage own withdrawal accounts" on withdrawal_accounts for all using (auth.uid() = user_id or public.is_admin());

-- 10. WITHDRAWALS POLICIES
create policy "Users can view own withdrawals" on withdrawals for select using (auth.uid() = user_id or public.is_admin());
create policy "Users can create own withdrawal request" on withdrawals for insert with check (auth.uid() = user_id and status = 'EN_ATTENTE');
create policy "Admins can manage withdrawals" on withdrawals for all using (public.is_admin());

-- 11. REFERRALS & COMMISSIONS
create policy "Users can view own referrals" on referrals for select using (auth.uid() = parent_id or auth.uid() = child_id or public.is_admin());
create policy "Users can view own commissions" on commissions for select using (auth.uid() = beneficiary_id or public.is_admin());
create policy "Admins can manage referrals and commissions" on referrals for all using (public.is_admin());
create policy "Admins can manage commissions" on commissions for all using (public.is_admin());

-- 12. VIP LEVELS
create policy "Users can view active VIP levels" on vip_levels for select using (is_active = true or public.is_admin());
create policy "Admins can manage VIP levels" on vip_levels for all using (public.is_admin());
create policy "Users can view own VIP history" on user_vip_history for select using (auth.uid() = user_id or public.is_admin());

-- 13. COUPONS & USAGES
create policy "Users can view active coupons" on coupons for select using (is_active = true or public.is_admin());
create policy "Users can manage own coupon usages" on coupon_usages for all using (auth.uid() = user_id or public.is_admin());
create policy "Admins can manage coupons" on coupons for all using (public.is_admin());

-- 14. SUPPORT, FAQ, NOTIFICATIONS, ANNOUNCEMENTS
create policy "Users can manage own support tickets" on support_tickets for all using (auth.uid() = user_id or public.is_admin());
create policy "Users can manage own support messages" on support_messages for all using (
  exists (select 1 from support_tickets where support_tickets.id = support_messages.ticket_id and support_tickets.user_id = auth.uid())
  or public.is_admin()
);
create policy "Anyone can view FAQ" on faq for select using (true);
create policy "Admins can manage FAQ" on faq for all using (public.is_admin());
create policy "Users can view own notifications" on notifications for all using (auth.uid() = user_id or public.is_admin());
create policy "Anyone can view published announcements" on announcements for select using (is_published = true or public.is_admin());
create policy "Admins can manage announcements" on announcements for all using (public.is_admin());

-- 15. ADMIN ROLES & LOGS
create policy "Admins can access admin users" on admin_users for all using (public.is_admin());
create policy "Admins can access admin logs" on admin_logs for all using (public.is_admin());
