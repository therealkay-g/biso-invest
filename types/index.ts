export type UserStatus = 'ACTIVE' | 'BLOCKED' | 'SUSPENDED'

export interface Profile {
  id: string
  phone: string
  display_name?: string
  referral_code: string
  referred_by?: string
  current_vip: string
  status: UserStatus
  created_at: string
  updated_at: string
  last_login?: string
  notification_preferences?: Record<string, boolean>
}

export interface Wallet {
  id: string
  user_id: string
  balance: number
  total_deposited: number
  total_withdrawn: number
  total_invested: number
  total_earned: number
  today_earned: number
  team_earned: number
  total_assets: number
  updated_at: string
}

export type TransactionType =
  | 'DEPOSIT'
  | 'INVESTMENT'
  | 'INVESTMENT_PAYMENT'
  | 'DAILY_PROFIT'
  | 'WITHDRAWAL'
  | 'COMMISSION'
  | 'REFERRAL_TASK_REWARD'
  | 'COUPON'
  | 'ADJUSTMENT'

export interface ProfitClaim {
  id: string
  user_id: string
  investment_id: string
  cycle_id?: string
  profit_date: string
  amount: number
  claimed_at: string
  transaction_id?: string
  created_at: string
}

export interface WalletTransaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  balance_before: number
  balance_after: number
  reference: string
  description: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  created_at: string
}

export interface ProductCategory {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  order_index: number
  created_at: string
}

export interface Product {
  id: string
  category_id: string
  name: string
  price: number
  monthly_return: number
  duration_months: number
  total_returns: number
  purchase_limit: number
  description: string
  image_url: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Investment {
  id: string
  user_id: string
  product_id: string
  quantity: number
  total_amount: number
  monthly_return: number
  duration_months: number
  paid_installments: number
  remaining_installments: number
  next_payment_date: string
  total_expected: number
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  created_at: string
  product?: Product
}

export interface InvestmentPayment {
  id: string
  investment_id: string
  installment_number: number
  amount: number
  scheduled_date: string
  paid_date?: string
  status: 'SCHEDULED' | 'DUE' | 'PAID' | 'CANCELLED'
  transaction_id?: string
  created_at: string
}

export type DepositStatus = 'EN_ATTENTE' | 'VALIDEE' | 'REFUSEE'

export interface Deposit {
  id: string
  user_id: string
  amount: number
  network: 'Airtel Money' | 'Orange Money' | 'M-Pesa'
  reference: string
  proof_url?: string
  status: DepositStatus
  rejection_reason?: string
  admin_id?: string
  created_at: string
  validated_at?: string
  profile?: Profile
}

export type WithdrawalStatus = 'EN_ATTENTE' | 'EN_TRAITEMENT' | 'PAYE' | 'REFUSE'

export interface WithdrawalAccount {
  id: string
  user_id: string
  network: 'Airtel Money' | 'Orange Money' | 'M-Pesa'
  phone_number: string
  account_name?: string
  is_default: boolean
  created_at: string
}

export interface Withdrawal {
  id: string
  user_id: string
  withdrawal_account_id: string
  amount: number
  fee: number
  net_amount: number
  network: 'Airtel Money' | 'Orange Money' | 'M-Pesa'
  phone_number: string
  status: WithdrawalStatus
  payment_reference?: string
  rejection_reason?: string
  admin_id?: string
  created_at: string
  processed_at?: string
  profile?: Profile
}

export interface PaymentAccount {
  id: string
  network: 'Airtel Money' | 'Orange Money' | 'M-Pesa'
  phone_number: string
  account_name: string
  is_active: boolean
  updated_at: string
  updated_by?: string
}

export interface PaymentAccountHistory {
  id: string
  network: string
  old_number: string
  new_number: string
  admin_id: string
  created_at: string
}

export interface Referral {
  id: string
  parent_id: string
  child_id: string
  level: 'A' | 'B' | 'C' | 'D'
  created_at: string
  child_profile?: Profile
}

export interface Commission {
  id: string
  beneficiary_id: string
  source_user_id: string
  level: 'A' | 'B' | 'C' | 'D'
  base_amount: number
  rate: number
  commission_amount: number
  source_transaction_id: string
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  created_at: string
  source_user?: Profile
}

export interface ReferralTask {
  id: string
  required_invites: number
  reward_amount: number
  display_order: number
  is_active: boolean
  progress?: number
  claimed?: boolean
}

export interface ReferralTaskReward {
  id: string
  user_id: string
  task_id: string
  required_invites: number
  reward_amount: number
  transaction_id?: string
  claimed_at: string
  created_at: string
}

export interface ReferralTaskStats {
  total_team: number
  valid_invites: number
  pending_invites: number
  total_rewards: number
  tasks: ReferralTask[]
  next_reward: { id: string; required_invites: number; reward_amount: number } | null
}

export interface AdminTaskOverviewRow {
  user_id: string
  phone: string
  referral_code: string
  total_team: number
  valid_invites: number
  total_rewards: number
  history: { required_invites: number; reward_amount: number; claimed_at: string }[]
}

export interface VipLevel {
  id: string
  level_name: string // VIP0, VIP1, etc.
  min_investment: number
  max_packs: number
  benefits: string
  is_active: boolean
  display_order: number
  created_at: string
}

export interface SupportTicket {
  id: string
  user_id: string
  subject: string
  status: 'EN_ATTENTE' | 'EN_COURS' | 'RESOLU' | 'FERME'
  created_at: string
  updated_at: string
  profile?: Profile
}

export interface SupportMessage {
  id: string
  ticket_id: string
  sender_id: string
  is_admin: boolean
  message: string
  created_at: string
}

export interface FaqItem {
  id: string
  question: string
  answer: string
  display_order: number
  created_at: string
}

export interface NotificationItem {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  is_published: boolean
  start_date?: string
  end_date?: string
  created_at: string
}

export interface Coupon {
  id: string
  code: string
  discount_type: 'PERCENTAGE' | 'FIXED'
  value: number
  usage_limit: number
  used_count: number
  expires_at?: string
  is_active: boolean
  created_at: string
}

export interface AdminLog {
  id: string
  admin_id: string
  action: string
  target_object: string
  old_value?: string
  new_value?: string
  ip_address?: string
  created_at: string
  admin_user?: Profile
}
