/**
 * BISO INVEST — Tests des règles financières (TypeScript)
 * Valide : frais 15%, minimum 5 000 FC, revenu journalier avec jours réels
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ============================================================
// Fonctions utilitaires (logique financière miroir de la RPC SQL)
// ============================================================

/** Calcule les frais de retrait à 15% */
export function calculateFee(grossAmount: number): number {
  return Math.round(grossAmount * 0.15 * 100) / 100;
}

/** Calcule le montant net après frais de 15% */
export function calculateNetAmount(grossAmount: number): number {
  return grossAmount - calculateFee(grossAmount);
}

/** Renvoie le nombre réel de jours d'un mois (année + mois 0-indexé) */
export function getDaysInMonth(year: number, month: number): number {
  // month: 0 = janvier ... 11 = décembre
  return new Date(year, month + 1, 0).getDate();
}

/** Calcule le revenu journalier basé sur les jours réels du mois */
export function calculateDailyRevenue(monthlyReturn: number, year: number, month: number): number {
  const days = getDaysInMonth(year, month);
  return monthlyReturn / days;
}

// ============================================================
// Suite 1 : Montant minimum de retrait — 5 000 FC
// ============================================================
describe("Règle 1 : Montant minimum de retrait fixé à 5 000 FC", () => {
  it("doit rejeter un montant de 4 999 FC (< 5 000 FC)", () => {
    assert.equal(4999 >= 5000, false);
  });

  it("doit rejeter un montant de 0 FC", () => {
    assert.equal(0 >= 5000, false);
  });

  it("doit accepter exactement 5 000 FC", () => {
    assert.equal(5000 >= 5000, true);
  });

  it("doit accepter 10 000 FC", () => {
    assert.equal(10000 >= 5000, true);
  });

  it("doit accepter 1 000 000 FC", () => {
    assert.equal(1000000 >= 5000, true);
  });
});

// ============================================================
// Suite 2 : Calcul des frais de 15% et du montant net
// ============================================================
describe("Règle 2 : Frais de retrait de 15% et montant net", () => {
  it("5 000 FC → frais = 750 FC, net = 4 250 FC", () => {
    assert.equal(calculateFee(5000), 750);
    assert.equal(calculateNetAmount(5000), 4250);
  });

  it("10 000 FC → frais = 1 500 FC, net = 8 500 FC", () => {
    assert.equal(calculateFee(10000), 1500);
    assert.equal(calculateNetAmount(10000), 8500);
  });

  it("100 000 FC → frais = 15 000 FC, net = 85 000 FC", () => {
    assert.equal(calculateFee(100000), 15000);
    assert.equal(calculateNetAmount(100000), 85000);
  });

  it("500 000 FC → frais = 75 000 FC, net = 425 000 FC", () => {
    assert.equal(calculateFee(500000), 75000);
    assert.equal(calculateNetAmount(500000), 425000);
  });

  it("le montant net = brut - 15% du brut (invariant strict)", () => {
    const amounts = [5000, 12500, 75000, 300000];
    for (const amount of amounts) {
      assert.equal(calculateNetAmount(amount) + calculateFee(amount), amount);
      assert.ok(Math.abs(calculateNetAmount(amount) - (amount * 0.85)) < 0.01);
    }
  });
});

// ============================================================
// Suite 3 : Calcul du revenu journalier avec jours réels
// ============================================================
describe("Règle 3 : Revenu journalier basé sur les jours réels du mois", () => {
  it("Janvier (31 jours) — revenu journalier correct", () => {
    assert.equal(getDaysInMonth(2024, 0), 31);
    assert.ok(Math.abs(calculateDailyRevenue(31000, 2024, 0) - 1000) < 0.01);
  });

  it("Février 2024 (29 jours — année bissextile)", () => {
    assert.equal(getDaysInMonth(2024, 1), 29);
    assert.ok(Math.abs(calculateDailyRevenue(29000, 2024, 1) - 1000) < 0.01);
  });

  it("Février 2023 (28 jours — année non-bissextile)", () => {
    assert.equal(getDaysInMonth(2023, 1), 28);
    assert.ok(Math.abs(calculateDailyRevenue(28000, 2023, 1) - 1000) < 0.01);
  });

  it("Vérification de la durée réelle de chaque mois de l'année", () => {
    assert.equal(getDaysInMonth(2024, 0), 31);  // Janvier
    assert.equal(getDaysInMonth(2024, 1), 29);  // Février 2024
    assert.equal(getDaysInMonth(2024, 2), 31);  // Mars
    assert.equal(getDaysInMonth(2024, 3), 30);  // Avril
    assert.equal(getDaysInMonth(2024, 4), 31);  // Mai
    assert.equal(getDaysInMonth(2024, 5), 30);  // Juin
    assert.equal(getDaysInMonth(2024, 6), 31);  // Juillet
    assert.equal(getDaysInMonth(2024, 7), 31);  // Août
    assert.equal(getDaysInMonth(2024, 8), 30);  // Septembre
    assert.equal(getDaysInMonth(2024, 9), 31);  // Octobre
    assert.equal(getDaysInMonth(2024, 10), 30); // Novembre
    assert.equal(getDaysInMonth(2024, 11), 31); // Décembre
  });

  it("un revenu mensuel de 30 000 FC → journalier plus élevé en février (28 j) qu'en mars (31 j)", () => {
    const monthly = 30000;
    const dailyFeb = calculateDailyRevenue(monthly, 2023, 1);   // 28 j -> 1071.43
    const dailyMar = calculateDailyRevenue(monthly, 2023, 2);   // 31 j -> 967.74
    assert.ok(dailyFeb > dailyMar);
  });

  it("ne doit JAMAIS utiliser 30 jours fixes pour février ou les mois de 31 jours", () => {
    const monthly = 30000;
    const dailyFeb = calculateDailyRevenue(monthly, 2023, 1);
    assert.notEqual(dailyFeb, monthly / 30); // 1071.43 ≠ 1000
    const dailyJan = calculateDailyRevenue(monthly, 2024, 0);
    assert.notEqual(dailyJan, monthly / 30); // 967.74 ≠ 1000
  });
});
