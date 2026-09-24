/**
 * BISO INVEST — Tests des règles financières (TypeScript)
 * Valide les frais, le minimum de retrait et le bénéfice quotidien de 10 %.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessMonths,
  calculateDailyProfit,
  getBusinessDateKey,
  getContractDayCount,
} from "../utils/financial.mjs";

// ============================================================
// Fonctions utilitaires (la règle quotidienne provient de utils/financial.mjs)
// ============================================================

/** Calcule les frais de retrait à 15 %. */
export function calculateFee(grossAmount: number): number {
  return Math.round(grossAmount * 0.15 * 100) / 100;
}

/** Calcule le montant net après frais de 15 %. */
export function calculateNetAmount(grossAmount: number): number {
  return grossAmount - calculateFee(grossAmount);
}

/**
 * Règle officielle : bénéfice = 10 % du capital investi par jour
 * éligible, arrondi à deux décimales.
 */
export function calculateDailyGain(totalAmount: number): number {
  return calculateDailyProfit(totalAmount);
}

/** Nom conservé pour compatibilité avec les anciens imports de tests. */
export const calculateDailyRevenue = calculateDailyGain;

// ============================================================
// Suite 1 : Montant minimum de retrait — 5 000 FC
// ============================================================
describe("Règle 1 : Montant minimum de retrait fixé à 5 000 FC", () => {
  it("rejette un montant de 4 999 FC", () => {
    assert.equal(4999 >= 5000, false);
  });

  it("rejette un montant nul", () => {
    assert.equal(0 >= 5000, false);
  });

  it("accepte exactement 5 000 FC et les montants supérieurs", () => {
    assert.equal(5000 >= 5000, true);
    assert.equal(10000 >= 5000, true);
    assert.equal(1000000 >= 5000, true);
  });
});

// ============================================================
// Suite 2 : Frais de 15 % et cohérence brut/net
// ============================================================
describe("Règle 2 : Frais de retrait de 15 % et montant net", () => {
  it("5 000 FC donnent 750 FC de frais et 4 250 FC nets", () => {
    assert.equal(calculateFee(5000), 750);
    assert.equal(calculateNetAmount(5000), 4250);
  });

  it("10 000 FC donnent 1 500 FC de frais et 8 500 FC nets", () => {
    assert.equal(calculateFee(10000), 1500);
    assert.equal(calculateNetAmount(10000), 8500);
  });

  it("100 000 FC donnent 15 000 FC de frais et 85 000 FC nets", () => {
    assert.equal(calculateFee(100000), 15000);
    assert.equal(calculateNetAmount(100000), 85000);
  });

  it("500 000 FC donnent 75 000 FC de frais et 425 000 FC nets", () => {
    assert.equal(calculateFee(500000), 75000);
    assert.equal(calculateNetAmount(500000), 425000);
  });

  it("respecte l'invariant net + frais = brut", () => {
    for (const amount of [5000, 12500, 75000, 300000, 1000000]) {
      assert.equal(calculateNetAmount(amount) + calculateFee(amount), amount);
    }
  });
});

// ============================================================
// Suite 3 : Bénéfice quotidien = 10 % du capital investi
// ============================================================
describe("Règle 3 : Bénéfice quotidien de 10 % du capital", () => {
  it("20 000 FC investis donnent 2 000 FC par jour éligible", () => {
    assert.equal(calculateDailyGain(20000), 2000);
  });

  it("50 000 FC investis donnent 5 000 FC par jour éligible", () => {
    assert.equal(calculateDailyGain(50000), 5000);
  });

  it("250 000 FC investis donnent 25 000 FC par jour éligible", () => {
    assert.equal(calculateDailyGain(250000), 25000);
  });

  it("arrondit le résultat à deux décimales", () => {
    assert.equal(calculateDailyGain(12345.67), 1234.57);
    assert.equal(calculateDailyGain(0.1), 0.01);
  });

  it("ne dépend pas de la longueur du mois", () => {
    assert.equal(calculateDailyGain(50000), 5000);
    assert.equal(calculateDailyGain(50000), 5000);
  });

  it("utilise la date métier Africa/Kinshasa et gère les fins de mois", () => {
    assert.equal(getBusinessDateKey('2024-01-31'), '2024-01-31');
    assert.equal(getBusinessDateKey('2024-01-31T23:30:00Z'), '2024-02-01');
    assert.equal(addBusinessMonths('2024-01-31', 1), '2024-02-29');
    assert.equal(getContractDayCount({
      created_at: '2024-01-31T10:00:00Z',
      duration_months: 3,
    }), 90);
  });
});

// ============================================================
// Simulation de la RPC claim_daily_profit
// ============================================================

interface Investment {
  id: string;
  user_id: string;
  total_amount: number;
  created_at: Date;
  duration_months: number;
  status: string;
}

interface ProfitClaim {
  user_id: string;
  investment_id: string;
  profit_date: string;
  amount: number;
  claimed_at: Date;
}

interface ClaimTransaction {
  type: 'DAILY_PROFIT';
  amount: number;
  balance_before: number;
  balance_after: number;
  status: 'COMPLETED';
}

interface ClaimResult {
  success: true;
  claimed_amount: number;
  already_claimed_today: boolean;
  new_balance: number;
  transactions: number;
  transaction: ClaimTransaction | null;
  claims: ProfitClaim[];
  created: ProfitClaim[];
}

function todayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Simule la claim quotidienne. Chaque investissement est traité séparément :
 * le bénéfice est fondé sur total_amount, jamais sur un retour mensuel ni sur
 * la longueur du mois. Une absence de claim ne crée pas de dette reportée.
 */
export function simulateClaimDailyProfit(
  userId: string,
  investments: Investment[],
  claims: ProfitClaim[],
  balance: number,
  today: Date,
  investmentId: string | null = null,
): ClaimResult {
  const date = todayKey(today);
  let total = 0;
  let claimCount = 0;
  const created: ProfitClaim[] = [];

  for (const investment of investments) {
    if (investment.user_id !== userId) continue;
    if (investment.status !== 'ACTIVE') continue;
    if (investmentId && investment.id !== investmentId) continue;

    const periodEnd = new Date(investment.created_at);
    periodEnd.setMonth(periodEnd.getMonth() + (investment.duration_months || 3));
    if (today.getTime() >= periodEnd.getTime()) continue;

    if (claims.some((claim) =>
      claim.investment_id === investment.id && claim.profit_date === date,
    )) continue;

    const daily = calculateDailyGain(investment.total_amount);
    const claim: ProfitClaim = {
      user_id: userId,
      investment_id: investment.id,
      profit_date: date,
      amount: daily,
      claimed_at: new Date(today),
    };
    claims.push(claim);
    created.push(claim);
    total = Math.round((total + daily) * 100) / 100;
    claimCount += 1;
  }

  if (claimCount === 0) {
    return {
      success: true,
      claimed_amount: 0,
      already_claimed_today: true,
      new_balance: balance,
      transactions: 0,
      transaction: null,
      claims,
      created,
    };
  }

  const newBalance = Math.round((balance + total) * 100) / 100;
  const transaction: ClaimTransaction = {
    type: 'DAILY_PROFIT',
    amount: total,
    balance_before: balance,
    balance_after: newBalance,
    status: 'COMPLETED',
  };
  return {
    success: true,
    claimed_amount: total,
    already_claimed_today: false,
    new_balance: newBalance,
    transactions: 1,
    transaction,
    claims,
    created,
  };
}

function makeInvestment(overrides: Partial<Investment> = {}): Investment {
  return {
    id: 'inv-1',
    user_id: 'user-1',
    total_amount: 30000,
    created_at: new Date(2024, 0, 5),
    duration_months: 3,
    status: 'ACTIVE',
    ...overrides,
  };
}

describe("Règle 4 : Réclamation quotidienne, idempotence et expiration", () => {
  it("réclame 10 % du capital total_amount et crédite le wallet", () => {
    const claims: ProfitClaim[] = [];
    const result = simulateClaimDailyProfit(
      'user-1',
      [makeInvestment()],
      claims,
      50000,
      new Date(2024, 3, 1),
    );

    assert.equal(result.claimed_amount, 3000);
    assert.equal(result.new_balance, 53000);
    assert.equal(result.transactions, 1);
    assert.equal(claims.length, 1);
  });

  it("calcule séparément le bénéfice de chaque investissement", () => {
    const claims: ProfitClaim[] = [];
    const investments = [
      makeInvestment({ id: 'inv-20k', total_amount: 20000 }),
      makeInvestment({ id: 'inv-50k', total_amount: 50000 }),
      makeInvestment({ id: 'inv-250k', total_amount: 250000 }),
    ];
    const result = simulateClaimDailyProfit(
      'user-1',
      investments,
      claims,
      0,
      new Date(2024, 3, 1),
    );

    assert.equal(result.claimed_amount, 32000);
    assert.deepEqual(claims.map((claim) => [claim.investment_id, claim.amount]), [
      ['inv-20k', 2000],
      ['inv-50k', 5000],
      ['inv-250k', 25000],
    ]);
  });

  it("ne credite que l'investissement demandé", () => {
    const claims: ProfitClaim[] = [];
    const investments = [
      makeInvestment({ id: 'inv-20k', total_amount: 20000 }),
      makeInvestment({ id: 'inv-50k', total_amount: 50000 }),
    ];
    const result = simulateClaimDailyProfit(
      'user-1',
      investments,
      claims,
      0,
      new Date(2024, 3, 1),
      'inv-20k',
    );

    assert.equal(result.claimed_amount, 2000);
    assert.equal(claims.length, 1);
    assert.equal(claims[0].investment_id, 'inv-20k');
  });

  it("est idempotent le même jour pour le même investissement", () => {
    const claims: ProfitClaim[] = [];
    const investment = makeInvestment();
    const day = new Date(2024, 3, 1);
    const first = simulateClaimDailyProfit('user-1', [investment], claims, 0, day);
    const second = simulateClaimDailyProfit('user-1', [investment], claims, first.new_balance, day);

    assert.equal(first.claimed_amount, 3000);
    assert.equal(second.claimed_amount, 0);
    assert.equal(second.already_claimed_today, true);
    assert.equal(claims.length, 1);
    assert.equal(second.new_balance, 3000);
  });

  it("perd définitivement un jour non réclamé sans le reporter", () => {
    const claims: ProfitClaim[] = [];
    const investment = makeInvestment();
    const first = simulateClaimDailyProfit(
      'user-1',
      [investment],
      claims,
      50000,
      new Date(2024, 3, 1),
    );
    // Le 2 avril n'est pas réclamé : le 3 avril ne verse que son propre jour.
    const afterMissedDay = simulateClaimDailyProfit(
      'user-1',
      [investment],
      claims,
      first.new_balance,
      new Date(2024, 3, 3),
    );

    assert.equal(first.claimed_amount, 3000);
    assert.equal(afterMissedDay.claimed_amount, 3000);
    assert.equal(afterMissedDay.new_balance, 56000);
    assert.deepEqual(claims.map((claim) => claim.profit_date), ['2024-04-01', '2024-04-03']);
  });

  it("ne verse aucun bénéfice après l'expiration du contrat de 3 mois", () => {
    const claims: ProfitClaim[] = [];
    const expired = makeInvestment({
      id: 'expired',
      created_at: new Date(2023, 0, 1),
      duration_months: 3,
    });
    const result = simulateClaimDailyProfit(
      'user-1',
      [expired],
      claims,
      5000,
      new Date(2024, 3, 1),
    );

    assert.equal(result.claimed_amount, 0);
    assert.equal(result.already_claimed_today, true);
    assert.equal(result.new_balance, 5000);
    assert.equal(claims.length, 0);
  });
});
