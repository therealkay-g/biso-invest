export const USD_TO_FC = 2400;

// Packs autorisés et correspondance exacte avec les paliers VIP
export const ALLOWED_PACK_PRICES = [20000, 50000, 100000, 250000] as const;

export interface VipTierInfo {
  level: string;
  badge: string;
  name: string;
  minInvestment: number;
  maxPacks: number;
  colorClass: string;
}

export const VIP_TIERS: Record<number, VipTierInfo> = {
  20000: {
    level: 'VIP1',
    badge: 'VIP 1',
    name: 'Pack VIP 1 (20 000 FC)',
    minInvestment: 20000,
    maxPacks: 3,
    colorClass: 'bg-amber-500 text-white',
  },
  50000: {
    level: 'VIP2',
    badge: 'VIP 2',
    name: 'Pack VIP 2 (50 000 FC)',
    minInvestment: 50000,
    maxPacks: 5,
    colorClass: 'bg-emerald-600 text-white',
  },
  100000: {
    level: 'VIP3',
    badge: 'VIP 3',
    name: 'Pack VIP 3 (100 000 FC)',
    minInvestment: 100000,
    maxPacks: 8,
    colorClass: 'bg-blue-600 text-white',
  },
  250000: {
    level: 'VIP4',
    badge: 'VIP 4',
    name: 'Pack VIP 4 (250 000 FC)',
    minInvestment: 250000,
    maxPacks: 10,
    colorClass: 'bg-purple-600 text-white',
  },
};

export function getVipTierForPrice(price: number): VipTierInfo | null {
  return VIP_TIERS[price] || null;
}
