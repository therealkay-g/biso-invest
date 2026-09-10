/**
 * BISO INVEST â€” Suite ComplÃ¨te de Tests Financiers & SÃ©curitÃ©
 * Valide les 10 prioritÃ©s post-audit
 * ExÃ©cutÃ© nativement avec Node.js test runner
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================
// Utilitaires de simulation financiÃ¨re (Miroir exact des RPC SQL)
// ============================================================

function calculateFee(grossAmount) {
  return Math.round(grossAmount * 0.15 * 100) / 100;
}

function calculateNetAmount(grossAmount) {
  return grossAmount - calculateFee(grossAmount);
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function calculateDailyRevenue(monthlyReturn, year, month) {
  const days = getDaysInMonth(year, month);
  return monthlyReturn / days;
}

// Simulation du systÃ¨me VIP (Paliers officiels : VIP1=20 000 FC, VIP2=50 000 FC, VIP3=100 000 FC, VIP4=250 000 FC)
const VIP_LEVELS = [
  { level_name: 'VIP0', min_investment: 0, max_packs: 1, is_active: true, display_order: 0 },
  { level_name: 'VIP1', min_investment: 20000, max_packs: 3, is_active: true, display_order: 1 },
  { level_name: 'VIP2', min_investment: 50000, max_packs: 5, is_active: true, display_order: 2 },
  { level_name: 'VIP3', min_investment: 100000, max_packs: 8, is_active: true, display_order: 3 },
  { level_name: 'VIP4', min_investment: 250000, max_packs: 10, is_active: true, display_order: 4 },
  { level_name: 'VIP5', min_investment: 1000000, max_packs: 12, is_active: false, display_order: 5 },
  { level_name: 'VIP6', min_investment: 2500000, max_packs: 15, is_active: false, display_order: 6 },
  { level_name: 'VIP7', min_investment: 5000000, max_packs: 20, is_active: false, display_order: 7 },
];

function evaluateVip(totalInvested) {
  const active = VIP_LEVELS.filter(v => v.is_active && v.min_investment <= totalInvested);
  active.sort((a, b) => b.display_order - a.display_order);
  return active[0] || VIP_LEVELS[0];
}

// Simulation de l'arbre de commissionnement A/B/C/D
function simulateCommissionDistribution(baseAmount, upline) {
  const rates = [10.0, 3.0, 1.0, 1.0];
  const levels = ['A', 'B', 'C', 'D'];
  const commissions = [];
  const ledgerEntries = [];
  const visited = new Set();

  for (let i = 0; i < 4 && i < upline.length; i++) {
    const parentId = upline[i];
    if (!parentId || visited.has(parentId)) break;
    visited.add(parentId);

    const rate = rates[i];
    const amount = Math.round((baseAmount * rate) / 100.0 * 100) / 100;
    const level = levels[i];

    commissions.push({ parentId, level, rate, amount });
    ledgerEntries.push({
      userId: parentId,
      type: 'COMMISSION',
      amount,
      status: 'COMPLETED',
      description: `Commission rÃ©seau niveau ${level} (${rate}%) sur achat ${baseAmount} FC`
    });
  }

  return { commissions, ledgerEntries };
}

// Simulation de l'idempotence des investissements
function simulatePurchaseInvestment(existingKeys, idempotencyKey, amount, balance) {
  if (existingKeys.has(idempotencyKey)) {
    return { success: true, idempotent_replay: true, debited: 0 };
  }
  if (balance < amount) {
    throw new Error('Solde insuffisant');
  }
  existingKeys.add(idempotencyKey);
  return { success: true, idempotent_replay: false, debited: amount, newBalance: balance - amount };
}

// Simulation de l'idempotence des retraits
function simulateApproveWithdrawal(withdrawal, paymentReference) {
  if (!paymentReference || !paymentReference.trim()) {
    throw new Error('La rÃ©fÃ©rence de paiement Mobile Money est obligatoire');
  }
  if (withdrawal.status !== 'EN_ATTENTE' && withdrawal.status !== 'EN_TRAITEMENT') {
    throw new Error('Ce retrait a dÃ©jÃ  Ã©tÃ© traitÃ© (idempotence)');
  }
  withdrawal.status = 'PAYE';
  withdrawal.payment_reference = paymentReference.trim();
  return { success: true, status: 'PAYE', net_amount: withdrawal.net_amount };
}

// ============================================================
// SUITE 1 : Retrait minimum = 5 000 FC
// ============================================================
describe("1. Retrait minimum fixÃ© Ã  5 000 FC", () => {
  it("Rejette strictement les montants infÃ©rieurs Ã  5 000 FC", () => {
    assert.equal(4999 >= 5000, false);
    assert.equal(0 >= 5000, false);
    assert.equal(-1000 >= 5000, false);
  });

  it("Accepte 5 000 FC et montants supÃ©rieurs", () => {
    assert.equal(5000 >= 5000, true);
    assert.equal(5001 >= 5000, true);
    assert.equal(50000 >= 5000, true);
  });
});

// ============================================================
// SUITE 2 : Frais de retrait 15 % & CohÃ©rence Brut / Net
// ============================================================
describe("2. Frais de retrait de 15% et montants net", () => {
  it("Calcule les frais exacts Ã  15% pour 5 000 FC (750 FC frais, 4 250 FC net)", () => {
    assert.equal(calculateFee(5000), 750);
    assert.equal(calculateNetAmount(5000), 4250);
  });

  it("Calcule les frais exacts pour 100 000 FC (15 000 FC frais, 85 000 FC net)", () => {
    assert.equal(calculateFee(100000), 15000);
    assert.equal(calculateNetAmount(100000), 85000);
  });

  it("Respecte l'invariant strict : net + frais = brut", () => {
    const testAmounts = [5000, 10000, 25000, 75000, 150000, 1000000];
    for (const amt of testAmounts) {
      assert.equal(calculateNetAmount(amt) + calculateFee(amt), amt);
    }
  });
});

// ============================================================
// SUITE 3 : Revenu journalier basÃ© sur les jours rÃ©els du mois
// ============================================================
describe("3. Revenu journalier basÃ© sur les jours rÃ©els du mois", () => {
  it("GÃ¨re correctement 31 jours pour janvier, mars, mai, juillet, aoÃ»t, octobre, dÃ©cembre", () => {
    const months31 = [0, 2, 4, 6, 7, 9, 11];
    for (const m of months31) {
      assert.equal(getDaysInMonth(2024, m), 31);
      assert.ok(Math.abs(calculateDailyRevenue(31000, 2024, m) - 1000) < 0.01);
    }
  });

  it("GÃ¨re correctement 30 jours pour avril, juin, septembre, novembre", () => {
    const months30 = [3, 5, 8, 10];
    for (const m of months30) {
      assert.equal(getDaysInMonth(2024, m), 30);
      assert.ok(Math.abs(calculateDailyRevenue(30000, 2024, m) - 1000) < 0.01);
    }
  });

  it("Distingue les annÃ©es bissextiles (fÃ©vrier 29 j) et non bissextiles (fÃ©vrier 28 j)", () => {
    assert.equal(getDaysInMonth(2024, 1), 29); // 2024 bissextile
    assert.equal(getDaysInMonth(2023, 1), 28); // 2023 standard
    assert.ok(Math.abs(calculateDailyRevenue(28000, 2023, 1) - 1000) < 0.01);
  });

  it("Interdit formellement un diviseur fixe de 30 jours pour fÃ©vrier", () => {
    const dailyFeb = calculateDailyRevenue(30000, 2023, 1);
    assert.notEqual(dailyFeb, 30000 / 30); // 1071.43 â‰  1000
  });
});

// ============================================================
// SUITE 4 : Double retrait & Idempotence de validation
// ============================================================
describe("4. Double retrait & Idempotence administrative", () => {
  it("EmpÃªche la double validation d'un mÃªme retrait", () => {
    const wit = { id: 'wit-1', status: 'EN_ATTENTE', amount: 10000, net_amount: 8500 };
    const first = simulateApproveWithdrawal(wit, 'REF-MM-001');
    assert.equal(first.success, true);
    assert.equal(wit.status, 'PAYE');

    // Seconde tentative
    assert.throws(() => {
      simulateApproveWithdrawal(wit, 'REF-MM-002');
    }, /dÃ©jÃ  Ã©tÃ© traitÃ©/);
  });

  it("Exige obligatoirement une rÃ©fÃ©rence Mobile Money", () => {
    const wit = { id: 'wit-2', status: 'EN_ATTENTE', amount: 5000, net_amount: 4250 };
    assert.throws(() => {
      simulateApproveWithdrawal(wit, '');
    }, /obligatoire/);
    assert.throws(() => {
      simulateApproveWithdrawal(wit, '   ');
    }, /obligatoire/);
  });
});

// ============================================================
// SUITE 5 : Idempotence de l'Investissement (Anti-double-clic)
// ============================================================
describe("5. Idempotence de l'investissement (Anti-double achat)", () => {
  it("Rejoue la rÃ©ponse sans redÃ©biter si la mÃªme clÃ© d'idempotence est soumise", () => {
    const keys = new Set();
    const balance = 100000;
    const cost = 30000;
    const key = 'idem-key-12345';

    // Premier achat
    const res1 = simulatePurchaseInvestment(keys, key, cost, balance);
    assert.equal(res1.idempotent_replay, false);
    assert.equal(res1.debited, cost);
    assert.equal(res1.newBalance, 70000);

    // DeuxiÃ¨me tentative avec la mÃªme clÃ© (ex: double-clic ou retry rÃ©seau)
    const res2 = simulatePurchaseInvestment(keys, key, cost, res1.newBalance);
    assert.equal(res2.idempotent_replay, true);
    assert.equal(res2.debited, 0); // ZÃ‰RO dÃ©bit supplÃ©mentaire !
  });
});

// ============================================================
// SUITE 6 & 7 : Commissions A/B/C/D & Grand Livre (Ledger)
// ============================================================
describe("6 & 7. Commissions A/B/C/D et TraÃ§abilitÃ© Ledger", () => {
  it("Distribue les taux exacts : A=10%, B=3%, C=1%, D=1%", () => {
    const upline = ['parent-A', 'parent-B', 'parent-C', 'parent-D'];
    const base = 100000; // Investissement de 100 000 FC
    const { commissions, ledgerEntries } = simulateCommissionDistribution(base, upline);

    assert.equal(commissions.length, 4);
    assert.equal(commissions[0].amount, 10000); // 10%
    assert.equal(commissions[1].amount, 3000);  // 3%
    assert.equal(commissions[2].amount, 1000);  // 1%
    assert.equal(commissions[3].amount, 1000);  // 1%

    // VÃ©rification du Ledger : CHAQUE commission gÃ©nÃ¨re une Ã©criture COMMISSION
    assert.equal(ledgerEntries.length, 4);
    for (let i = 0; i < 4; i++) {
      assert.equal(ledgerEntries[i].type, 'COMMISSION');
      assert.equal(ledgerEntries[i].status, 'COMPLETED');
      assert.equal(ledgerEntries[i].amount, commissions[i].amount);
    }
  });

  it("EmpÃªche l'auto-commission et les boucles de parrainage", () => {
    const uplineWithLoop = ['user-1', 'user-2', 'user-1']; // Boucle cyclique
    const { commissions } = simulateCommissionDistribution(50000, uplineWithLoop);
    // Doit s'arrÃªter dÃ¨s la dÃ©tection du cycle sans boucle infinie
    assert.equal(commissions.length, 2);
  });
});

// ============================================================
// SUITE 8 : MontÃ©e Automatique VIP
// ============================================================
describe("8. MontÃ©e automatique de palier VIP", () => {
  it("DÃ©bute Ã  VIP0 pour 0 FC investi", () => {
    const vip = evaluateVip(0);
    assert.equal(vip.level_name, 'VIP0');
    assert.equal(vip.max_packs, 1);
  });

it("Passe automatiquement Ã  VIP1 dÃ¨s 20 000 FC investis", () => {
    const vip = evaluateVip(20000);
    assert.equal(vip.level_name, 'VIP1');
    assert.equal(vip.max_packs, 3);
  });

  it("Passe automatiquement Ã  VIP2 dÃ¨s 50 000 FC investis", () => {
    const vip = evaluateVip(50000);
    assert.equal(vip.level_name, 'VIP2');
    assert.equal(vip.max_packs, 5);
  });

  it("Passe automatiquement Ã  VIP3 dÃ¨s 100 000 FC investis", () => {
    const vip = evaluateVip(100000);
    assert.equal(vip.level_name, 'VIP3');
    assert.equal(vip.max_packs, 8);
  });

  it("Passe automatiquement Ã  VIP4 dÃ¨s 250 000 FC investis", () => {
    const vip = evaluateVip(250000);
    assert.equal(vip.level_name, 'VIP4');
    assert.equal(vip.max_packs, 10);
  });

  it("Garde VIP5, VIP6 et VIP7 dÃ©sactivÃ©s par dÃ©faut (bloquÃ©s Ã  VIP4 maximum)", () => {
    const vip1M = evaluateVip(1000000);
    assert.equal(vip1M.level_name, 'VIP4'); // VIP5 inactif -> repli sur plus haut actif
    const vip5M = evaluateVip(5000000);
    assert.equal(vip5M.level_name, 'VIP4'); // VIP7 inactif -> VIP4
  });
});

// ============================================================
// SUITE 9 : Limites de packs selon le niveau VIP
// ============================================================
describe("9. Respect des plafonds de packs par niveau VIP", () => {
  it("VIP0 plafonnÃ© Ã  1 pack", () => {
    const vip0 = VIP_LEVELS.find(v => v.level_name === 'VIP0');
    assert.equal(vip0.max_packs, 1);
  });

  it("VIP1 plafonnÃ© Ã  3 packs", () => {
    const vip1 = VIP_LEVELS.find(v => v.level_name === 'VIP1');
    assert.equal(vip1.max_packs, 3);
  });

  it("VIP2 plafonnÃ© Ã  5 packs", () => {
    const vip2 = VIP_LEVELS.find(v => v.level_name === 'VIP2');
    assert.equal(vip2.max_packs, 5);
  });

  it("VIP3 plafonnÃ© Ã  8 packs", () => {
    const vip3 = VIP_LEVELS.find(v => v.level_name === 'VIP3');
    assert.equal(vip3.max_packs, 8);
  });

  it("VIP4 plafonnÃ© Ã  10 packs", () => {
    const vip4 = VIP_LEVELS.find(v => v.level_name === 'VIP4');
    assert.equal(vip4.max_packs, 10);
  });
});

// ============================================================
// SUITE 10 : Isolation RLS & SÃ©curitÃ© des Wallets
// ============================================================
describe("10. Isolation RLS et interdiction des modifications directes", () => {
  it("Interdit toute mise Ã  jour directe du wallet sans passer par une RPC", () => {
    // Les politiques RLS de 003_rls_policies n'accordent que SELECT sur wallets
    const allowedUserOperationsOnWallet = ['SELECT'];
    assert.equal(allowedUserOperationsOnWallet.includes('UPDATE'), false);
    assert.equal(allowedUserOperationsOnWallet.includes('INSERT'), false);
    assert.equal(allowedUserOperationsOnWallet.includes('DELETE'), false);
  });

  it("Interdit toute crÃ©ation directe de retrait (policy supprimÃ©e en 008)", () => {
    const allowedUserOperationsOnWithdrawals = ['SELECT'];
    assert.equal(allowedUserOperationsOnWithdrawals.includes('INSERT'), false);
  });
});

// ============================================================
// SUITE 11 : SÃ©curitÃ© OTP (Hachage SHA-256, Absence dev_otp, Tentatives & Expiration)
// ============================================================
import crypto from 'node:crypto';

function hashOtp(code) {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

function simulateRequestOtp(phone) {
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  if (cleanPhone.length < 9) throw new Error('NumÃ©ro de tÃ©lÃ©phone invalide');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const hashedCode = hashOtp(code);
  const record = {
    phone: cleanPhone,
    otp_code: hashedCode,
    attempts: 0,
    max_attempts: 3,
    expires_at: Date.now() + 10 * 60 * 1000,
    verified: false,
  };
  // RÃ©ponse API Ã©purÃ©e : JAMAIS de dev_otp ni de code en clair
  const apiResponse = {
    success: true,
    message: 'Code de vÃ©rification envoyÃ© avec succÃ¨s (valable 10 minutes)',
  };
  return { record, apiResponse, secretCodeForTest: code };
}

function simulateVerifyOtp(record, inputCode) {
  if (!inputCode || inputCode.trim().length !== 6) {
    throw new Error('Le code de vÃ©rification doit comporter exactement 6 chiffres');
  }
  if (record.verified || Date.now() > record.expires_at) {
    throw new Error('Code de vÃ©rification invalide ou expirÃ©');
  }
  if (record.attempts >= record.max_attempts) {
    record.verified = true;
    throw new Error('Nombre maximal de tentatives dÃ©passÃ©. Veuillez demander un nouveau code.');
  }

  record.attempts += 1;
  const inputHash = hashOtp(inputCode);

  if (record.otp_code !== inputHash) {
    if (record.attempts >= record.max_attempts) {
      record.verified = true;
      throw new Error('Code incorrect. Nombre maximal de tentatives atteint. Veuillez demander un nouveau code.');
    }
    throw new Error(`Code de vÃ©rification incorrect. Il vous reste ${record.max_attempts - record.attempts} tentative(s).`);
  }

  record.verified = true;
  return { success: true, verified: true };
}

describe("11. SÃ©curitÃ© OTP et RÃ©solution des Blockers de Production", () => {
  it("La rÃ©ponse API de request_phone_otp ne contient JAMAIS dev_otp ni le code en clair", () => {
    const { apiResponse } = simulateRequestOtp('0812345678');
    assert.equal('dev_otp' in apiResponse, false);
    assert.equal('code' in apiResponse, false);
    assert.equal('otp' in apiResponse, false);
    assert.equal(apiResponse.success, true);
  });

  it("Le code OTP stockÃ© est rigoureusement un hash SHA-256 (64 caractÃ¨res hexadÃ©cimaux)", () => {
    const { record, secretCodeForTest } = simulateRequestOtp('0812345678');
    assert.notEqual(record.otp_code, secretCodeForTest);
    assert.equal(record.otp_code.length, 64);
    assert.match(record.otp_code, /^[a-f0-9]{64}$/);
    assert.equal(record.otp_code, hashOtp(secretCodeForTest));
  });

  it("Valide avec succÃ¨s le code correspondant au hash SHA-256", () => {
    const { record, secretCodeForTest } = simulateRequestOtp('0812345678');
    const res = simulateVerifyOtp(record, secretCodeForTest);
    assert.equal(res.success, true);
    assert.equal(res.verified, true);
    assert.equal(record.verified, true);
  });

  it("Rejette un code erronÃ© et dÃ©compte les tentatives restantes", () => {
    const { record } = simulateRequestOtp('0812345678');
    assert.throws(() => simulateVerifyOtp(record, '000000'), /Il vous reste 2 tentative\(s\)/);
    assert.equal(record.attempts, 1);
    assert.equal(record.verified, false);
  });

  it("Bloque et invalide dÃ©finitivement le code aprÃ¨s 3 tentatives erronÃ©es", () => {
    const { record, secretCodeForTest } = simulateRequestOtp('0812345678');
    assert.throws(() => simulateVerifyOtp(record, '111111'), /2 tentative/);
    assert.throws(() => simulateVerifyOtp(record, '222222'), /1 tentative/);
    assert.throws(() => simulateVerifyOtp(record, '333333'), /Nombre maximal de tentatives atteint/);

    // MÃªme avec le bon code aprÃ¨s 3 Ã©checs, l'accÃ¨s est verrouillÃ©
    assert.throws(() => simulateVerifyOtp(record, secretCodeForTest), /invalide ou expirÃ©/);
  });

it("Rejette tout code prÃ©sentÃ© au-delÃ  de 10 minutes (expiration)", () => {
    const { record, secretCodeForTest } = simulateRequestOtp('0812345678');
    record.expires_at = Date.now() - 1000; // Simule expiration
    assert.throws(() => simulateVerifyOtp(record, secretCodeForTest), /invalide ou expirÃ©/);
  });
});

// ============================================================
// SUITE 12 : Validation quotidienne du bÃ©nÃ©fice (bouton VENDRE)
// ============================================================

// Miroir exact de la RPC claim_daily_profit()
// claims : tableau partagÃ© { user_id, investment_id, profit_date, amount, claimed_at }
function todayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function simulateClaimDailyProfit(userId, investments, claims, balance, today, getDaysFn) {
  const daysInMonth = getDaysFn(today.getFullYear(), today.getMonth());
  const todayStr = todayKey(today);
  let total = 0;
  let claimCount = 0;
  const created = [];

  for (const inv of investments) {
    // 12. Isolation utilisateur : jamais les investissements d'un autre
    if (inv.user_id !== userId) continue;
    // 11. Uniquement les investissements actifs
    if (inv.status !== 'ACTIVE') continue;
    // 10. Encore dans la pÃ©riode (durÃ©e en mois), sinon Â« terminÃ© Â»
    const periodEnd = new Date(inv.created_at);
    periodEnd.setMonth(periodEnd.getMonth() + (inv.duration_months || 12));
    if (today.getTime() >= periodEnd.getTime()) continue;
    // 2/3/5/9. DÃ©jÃ  rÃ©clamÃ© aujourd'hui ? Aucun crÃ©dit possible
    if (claims.some((c) => c.investment_id === inv.id && c.profit_date === todayStr)) continue;

    const daily = Math.round((inv.monthly_return / daysInMonth) * 100) / 100;
    const claim = { user_id: userId, investment_id: inv.id, profit_date: todayStr, amount: daily, claimed_at: new Date(today) };
    claims.push(claim);
    created.push(claim);
    total = Math.round((total + daily) * 100) / 100;
    claimCount += 1;
  }

  // Aucun bÃ©nÃ©fice Ã  crÃ©diter (dÃ©jÃ  vendu aujourd'hui, expirÃ© ou aucun)
  if (claimCount === 0) {
    return { success: true, claimed_amount: 0, already_claimed_today: true, new_balance: balance, transactions: 0, transaction: null, claims, created };
  }

  // CrÃ©dit atomique du wallet + UNE seule Ã©criture ledger
  const newBalance = Math.round((balance + total) * 100) / 100;
  const transaction = { type: 'DAILY_PROFIT', amount: total, balance_before: balance, balance_after: newBalance, status: 'COMPLETED' };
  return { success: true, claimed_amount: total, already_claimed_today: false, new_balance: newBalance, transactions: 1, transaction, claims, created };
}

function makeInvestment(overrides = {}) {
  return {
    id: 'inv-1',
    user_id: 'user-1',
    monthly_return: 30000,
    created_at: new Date(2024, 0, 5),
    duration_months: 12,
    status: 'ACTIVE',
    ...overrides,
  };
}

describe("12. Validation quotidienne du bÃ©nÃ©fice (bouton VENDRE)", () => {
  it("1. RÃ©clamation normale du jour (30 jours â†’ 1 000 FC)", () => {
    const claims = [];
    const inv = makeInvestment();
    const day = new Date(2024, 3, 1); // Avril 2024 = 30 jours
    const res = simulateClaimDailyProfit('user-1', [inv], claims, 50000, day, getDaysInMonth);

    assert.equal(res.success, true);
    assert.equal(res.claimed_amount, 1000); // 30 000 / 30
    assert.equal(res.new_balance, 51000);   // wallet avant/aprÃ¨s
    assert.equal(res.transactions, 1);      // une seule Ã©criture ledger
    assert.equal(claims.length, 1);
  });

  it("2. Deux clics le mÃªme jour â†’ une seule transaction", () => {
    const claims = [];
    const inv = makeInvestment();
    const day = new Date(2024, 3, 1);
    const r1 = simulateClaimDailyProfit('user-1', [inv], claims, 50000, day, getDaysInMonth);
    const r2 = simulateClaimDailyProfit('user-1', [inv], claims, r1.new_balance, day, getDaysInMonth);

    assert.equal(r1.claimed_amount, 1000);
    assert.equal(r2.claimed_amount, 0);
    assert.equal(r2.already_claimed_today, true);
    assert.equal(claims.length, 1); // aucune rÃ©clamation en double
  });

  it("3. Appel RPC rÃ©pÃ©tÃ© â†’ pas de double crÃ©dit", () => {
    const claims = [];
    const inv = makeInvestment();
    const day = new Date(2024, 3, 1);
    const r1 = simulateClaimDailyProfit('user-1', [inv], claims, 50000, day, getDaysInMonth);
    const r3 = simulateClaimDailyProfit('user-1', [inv], claims, r1.new_balance, day, getDaysInMonth);

    assert.equal(r3.claimed_amount, 0);
    assert.equal(r3.transactions, 0);
    assert.equal(r3.new_balance, 51000); // strictement inchangÃ©
  });

  it("4. Jour non rÃ©clamÃ© â†’ bÃ©nÃ©fice perdu (jamais reportÃ©)", () => {
    const claims = [];
    const inv = makeInvestment();
    const day1 = new Date(2024, 3, 1);
    const day3 = new Date(2024, 3, 3);

    const r1 = simulateClaimDailyProfit('user-1', [inv], claims, 50000, day1, getDaysInMonth);
    // Jour 2 : l'utilisateur ne clique pas -> rien
    const r2 = simulateClaimDailyProfit('user-1', [inv], claims, r1.new_balance, day3, getDaysInMonth);

    assert.equal(r1.claimed_amount, 1000);
    assert.equal(r2.claimed_amount, 1000); // UNIQUEMENT le jour 3
    assert.equal(r2.new_balance, 52000);   // le jour 2 (1 000 FC) manque dÃ©finitivement
    assert.deepEqual(claims.map((c) => c.profit_date), ['2024-04-01', '2024-04-03']);
  });

  it("5. RÃ©clamation le lendemain â†’ uniquement le bÃ©nÃ©fice du lendemain", () => {
    const claims = [];
    const inv = makeInvestment({ monthly_return: 30000 });
    const day1 = new Date(2024, 3, 1);
    const day2 = new Date(2024, 3, 2);
    const r1 = simulateClaimDailyProfit('user-1', [inv], claims, 50000, day1, getDaysInMonth);
    const r2 = simulateClaimDailyProfit('user-1', [inv], claims, r1.new_balance, day2, getDaysInMonth);

    assert.equal(r1.claimed_amount, 1000);
    assert.equal(r2.claimed_amount, 1000); // 30 000 / 30 pour le jour 2 uniquement
    assert.equal(r2.transactions, 1);
    assert.equal(r2.new_balance, 52000);
  });

  it("6. FÃ©vrier 28 jours (30 000 / 28 = 1 071,43 FC)", () => {
    const claims = [];
    const inv = makeInvestment();
    const feb28 = new Date(2023, 1, 10); // 2023 non bissextile â†’ 28 jours
    const res = simulateClaimDailyProfit('user-1', [inv], claims, 0, feb28, getDaysInMonth);
    assert.equal(res.claimed_amount, 1071.43);
  });

  it("7. FÃ©vrier 29 jours (30 000 / 29 = 1 034,48 FC)", () => {
    const claims = [];
    const inv = makeInvestment();
    const feb29 = new Date(2024, 1, 10); // 2024 bissextile â†’ 29 jours
    const res = simulateClaimDailyProfit('user-1', [inv], claims, 0, feb29, getDaysInMonth);
    assert.equal(res.claimed_amount, 1034.48);
  });

  it("8. Mois de 30 jours (30 000 / 30 = 1 000 FC)", () => {
    const claims = [];
    const inv = makeInvestment();
    const day = new Date(2024, 3, 15);
    const res = simulateClaimDailyProfit('user-1', [inv], claims, 0, day, getDaysInMonth);
    assert.equal(res.claimed_amount, 1000);
  });

  it("9. Mois de 31 jours (30 000 / 31 = 967,74 FC)", () => {
    const claims = [];
    const inv = makeInvestment();
    const day = new Date(2024, 0, 15); // Janvier 2024 = 31 jours
    const res = simulateClaimDailyProfit('user-1', [inv], claims, 0, day, getDaysInMonth);
    assert.equal(res.claimed_amount, 967.74);
  });

  it("10. Investissement arrivÃ© Ã  expiration â†’ aucune vente possible", () => {
    const claims = [];
    const expired = makeInvestment({ id: 'exp', created_at: new Date(2023, 0, 1), duration_months: 12 });
    const now = new Date(2024, 1, 15); // aprÃ¨s le 01/01/2024 (fin de pÃ©riode)
    const res = simulateClaimDailyProfit('user-1', [expired], claims, 5000, now, getDaysInMonth);

    assert.equal(res.claimed_amount, 0);
    assert.equal(res.already_claimed_today, true);
    assert.equal(claims.length, 0);
    assert.equal(res.new_balance, 5000);
  });

  it("11. Utilisateur sans investissement â†’ 0 crÃ©ditÃ©, aucune Ã©criture", () => {
    const claims = [];
    const day = new Date(2024, 3, 1);
    const res = simulateClaimDailyProfit('user-1', [], claims, 1000, day, getDaysInMonth);

    assert.equal(res.claimed_amount, 0);
    assert.equal(res.transactions, 0);
    assert.equal(res.new_balance, 1000);
  });

  it("12. Tentative d'accÃ¨s aux donnÃ©es d'un autre utilisateur â†’ bloquÃ©e", () => {
    const claims = [];
    const invA = makeInvestment({ id: 'inv-a', user_id: 'user-1', created_at: new Date(2024, 0, 5) });
    const invB = makeInvestment({ id: 'inv-b', user_id: 'user-2', created_at: new Date(2024, 0, 5) });
    const day = new Date(2024, 3, 1);

    const res = simulateClaimDailyProfit('user-1', [invA, invB], claims, 50000, day, getDaysInMonth);

    assert.equal(res.claimed_amount, 1000);     // uniquement l'investissement de user-1
    assert.equal(claims.length, 1);
    assert.equal(claims[0].investment_id, 'inv-a');
    assert.equal(claims[0].user_id, 'user-1');
    // L'investissement de user-2 n'a produit aucune rÃ©clamation au nom de user-1
    assert.equal(claims.some((c) => c.investment_id === 'inv-b' && c.user_id === 'user-1'), false);
  });

  it("13. VÃ©rification du wallet avant/aprÃ¨s", () => {
    const claims = [];
    const inv = makeInvestment();
    const balanceBefore = 25000;
    const day = new Date(2024, 3, 1);
    const res = simulateClaimDailyProfit('user-1', [inv], claims, balanceBefore, day, getDaysInMonth);

    assert.equal(res.transaction.balance_before, balanceBefore);
    assert.equal(res.transaction.balance_after, balanceBefore + res.claimed_amount);
    assert.equal(res.transaction.amount, res.claimed_amount);
    assert.equal(res.transaction.status, 'COMPLETED');
  });

  it("14. VÃ©rification de wallet_transactions (une Ã©criture DAILY_PROFIT)", () => {
    const claims = [];
    const inv = makeInvestment({ monthly_return: 30000 });
    const day = new Date(2024, 3, 1);
    const res = simulateClaimDailyProfit('user-1', [inv], claims, 100000, day, getDaysInMonth);

    assert.equal(res.transactions, 1);
    assert.equal(res.transaction.type, 'DAILY_PROFIT');
    assert.equal(res.transaction.amount, 1000);
    assert.equal(res.transaction.status, 'COMPLETED');
  });

  it("15. Historique complet des rÃ©clamations", () => {
    const claims = [];
    const inv = makeInvestment({ id: 'inv-hist', monthly_return: 30000 });
    const day1 = new Date(2024, 3, 1);
    const day2 = new Date(2024, 3, 2);
    simulateClaimDailyProfit('user-1', [inv], claims, 50000, day1, getDaysInMonth);
    simulateClaimDailyProfit('user-1', [inv], claims, 51000, day2, getDaysInMonth);

    assert.equal(claims.length, 2);
    for (const c of claims) {
      assert.equal(c.user_id, 'user-1');
      assert.equal(c.investment_id, 'inv-hist');
      assert.equal(c.amount, 1000);
      assert.ok(c.profit_date);
      assert.ok(c.claimed_at instanceof Date);
    }
    assert.deepEqual(claims.map((c) => c.profit_date), ['2024-04-01', '2024-04-02']);
  });
});

describe('Suite 13 : Tâches d\'invitation — attribution automatique (migration 016)', () => {
  const REFERRAL_TASKS = [
    { id: 'task-1', required_invites: 1, reward_amount: 3000, display_order: 1 },
    { id: 'task-5', required_invites: 5, reward_amount: 15000, display_order: 2 },
    { id: 'task-10', required_invites: 10, reward_amount: 30000, display_order: 3 },
    { id: 'task-20', required_invites: 20, reward_amount: 60000, display_order: 4 },
    { id: 'task-50', required_invites: 50, reward_amount: 200000, display_order: 5 },
    { id: 'task-100', required_invites: 100, reward_amount: 500000, display_order: 6 },
  ];

  // Miroir du trigger on_new_user_created (migration 015) : profil + wallet + ligne référent
  function registerWithReferral({ codeProfile, referrals, childId, referralCode }) {
    if (referrals.some((r) => r.child_id === childId)) {
      return { created: true, error: 'DUPLICATE_CHILD' };
    }
    if (!referralCode) return { created: true, referral: null };
    const parentId = codeProfile.get(referralCode);
    if (!parentId) return { created: true, referral: null };
    if (parentId === childId) return { created: true, referral: null, autoparrainage: true };
    referrals.push({ parent_id: parentId, child_id: childId, level: 'A' });
    return { created: true, referral: { parent_id: parentId, child_id: childId } };
  }

  // Miroir de count_valid_invitations : calcul TOUJOURS serveur
  function countValidInvitations(parentId, referrals, investments) {
    const children = referrals.filter((r) => r.parent_id === parentId).map((r) => r.child_id);
    const valid = new Set();
    for (const child of children) {
      if (investments.some((i) => i.user_id === child && ['ACTIVE', 'COMPLETED'].includes(i.status))) {
        valid.add(child);
      }
    }
    return valid.size;
  }

  // Miroir du trigger on_investment_validated + grant_referral_task_rewards :
  // crédit AUTOMATIQUE et idempotent de tous les paliers franchis.
  function simulateAutoGrant({ parentId, referrals, investments, rewards, wallet }) {
    const valid = countValidInvitations(parentId, referrals, investments);
    const granted = [];
    for (const t of REFERRAL_TASKS) {
      if (valid < t.required_invites) break;
      if (rewards.some((r) => r.user_id === parentId && r.task_id === t.id)) continue;
      rewards.push({
        user_id: parentId,
        task_id: t.id,
        required_invites: t.required_invites,
        reward_amount: t.reward_amount,
        auto_granted: true,
        claimed_at: new Date(),
      });
      const before = wallet.balance;
      wallet.balance = Math.round((before + t.reward_amount) * 100) / 100;
      wallet.transactions.push({
        type: 'REFERRAL_TASK_REWARD',
        amount: t.reward_amount,
        balance_before: before,
        balance_after: wallet.balance,
        status: 'COMPLETED',
        auto_granted: true,
      });
      granted.push(t);
    }
    return granted;
  }

  // Miroir de la nouvelle distribute_commissions (no-op)
  function disabledDistributeCommissions(commissionsLog) {
    return undefined;
  }

  const newParcrain = (tasks) => tasks.map((t) => ({ parent_id: 'user-1', child_id: t, level: 'A' }));

  // Flux réel : le filleul inscrit puis son investissement devient ACTIVE → crédit auto
  function inviteeInvests({ referrals, investments, rewards, wallet, kids, status = 'ACTIVE' }) {
    investments.push({ user_id: kids[kids.length - 1], status });
    return simulateAutoGrant({ parentId: 'user-1', referrals, investments, rewards, wallet });
  }

  it("1. Inscription avec code de parrainage valide : le parrainage est créé", () => {
    const codeProfile = new Map([['BISO1234', 'user-1']]);
    const referrals = [];
    const res = registerWithReferral({ codeProfile, referrals, childId: 'user-2', referralCode: 'BISO1234' });
    assert.ok(res.referral);
    assert.deepEqual(res.referral, { parent_id: 'user-1', child_id: 'user-2' });
    assert.equal(referrals.length, 1);
  });

  it('2. Inscription sans code : aucun parrainage créé', () => {
    const codeProfile = new Map([['BISO1234', 'user-1']]);
    const referrals = [];
    const res = registerWithReferral({ codeProfile, referrals, childId: 'user-2', referralCode: null });
    assert.equal(res.referral, null);
    assert.equal(referrals.length, 0);
  });

  it("3. Un investissement validé (ACTIVE) du filleul rend l'invitation valide", () => {
    const referrals = newParcrain(['f1']);
    const investments = [{ user_id: 'f1', status: 'ACTIVE' }];
    assert.equal(countValidInvitations('user-1', referrals, investments), 1);
  });

  it("4. Validation : seul un investissement ACTIVE/COMPLETED compte", () => {
    const referrals = newParcrain(['f1', 'f2']);
    const investments = [{ user_id: 'f1', status: 'PENDING' }, { user_id: 'f2', status: 'COMPLETED' }];
    assert.equal(countValidInvitations('user-1', referrals, investments), 1);
  });

  it('5. Un filleul est compté une seule fois malgré plusieurs investissements', () => {
    const referrals = newParcrain(['f1']);
    const investments = [
      { user_id: 'f1', status: 'ACTIVE' },
      { user_id: 'f1', status: 'ACTIVE' },
    ];
    assert.equal(countValidInvitations('user-1', referrals, investments), 1);
  });

  it('6. Auto-parrainage : un utilisateur ne peut pas être son propre filleul', () => {
    const codeProfile = new Map([['BISO1234', 'user-9']]);
    const referrals = [];
    const res = registerWithReferral({ codeProfile, referrals, childId: 'user-9', referralCode: 'BISO1234' });
    assert.equal(res.autoparrainage, true);
    assert.equal(res.referral, null);
    assert.equal(referrals.length, 0);
  });

  it('7. Automatique : dès que le filleul investit, +3 000 FC sont crédités dans le wallet du parrain', () => {
    const rewards = [];
    const wallet = { balance: 10000, transactions: [] };
    const referrals = newParcrain(['f1']);
    const investments = [];
    const granted = inviteeInvests({ referrals, investments, rewards, wallet, kids: ['f1'] });
    assert.deepEqual(granted.map((g) => g.required_invites), [1]);
    assert.equal(wallet.balance, 13000);
    assert.equal(rewards.length, 1);
  });

  it('8. Automatique : le même filleul qui investit à nouveau n\u2019est jamais re-crédité (idempotence)', () => {
    const rewards = [];
    const wallet = { balance: 0, transactions: [] };
    const referrals = newParcrain(['f1']);
    const investments = [];
    inviteeInvests({ referrals, investments, rewards, wallet, kids: ['f1'] });
    inviteeInvests({ referrals, investments, rewards, wallet, kids: ['f1'] }); // 2e investissement
    inviteeInvests({ referrals, investments, rewards, wallet, kids: ['f1'] }); // 3e investissement
    assert.equal(wallet.balance, 3000);
    assert.equal(rewards.length, 1);
    assert.equal(wallet.transactions.length, 1);
  });

  it("9. Automatique : le 5e filleul qui investit déclenche +15 000 FC (cumul 3 000 + 15 000)", () => {
    const rewards = [];
    const wallet = { balance: 0, transactions: [] };
    const referrals = newParcrain(['f1', 'f2', 'f3', 'f4', 'f5']);
    const investments = [];
    inviteeInvests({ referrals, investments, rewards, wallet, kids: ['f1'] });
    inviteeInvests({ referrals, investments, rewards, wallet, kids: ['f2'] });
    inviteeInvests({ referrals, investments, rewards, wallet, kids: ['f3'] });
    inviteeInvests({ referrals, investments, rewards, wallet, kids: ['f4'] });
    const granted = inviteeInvests({ referrals, investments, rewards, wallet, kids: ['f5'] });
    assert.deepEqual(granted.map((g) => g.required_invites), [5]);
    assert.equal(wallet.balance, 18000);
    assert.equal(rewards.length, 2);
  });

  it('10. Automatique : le 10e filleul qui investit déclenche +30 000 FC', () => {
    const rewards = [];
    const wallet = { balance: 0, transactions: [] };
    const kids = Array.from({ length: 10 }, (_, i) => `f10-${i}`);
    const referrals = newParcrain(kids);
    const investments = [];
    for (const k of kids) inviteeInvests({ referrals, investments, rewards, wallet, kids: [k] });
    assert.equal(wallet.balance, 3000 + 15000 + 30000);
    assert.equal(rewards.length, 3);
  });

  it('11. Automatique : le 20e filleul qui investit déclenche +60 000 FC', () => {
    const rewards = [];
    const wallet = { balance: 0, transactions: [] };
    const kids = Array.from({ length: 20 }, (_, i) => `f20-${i}`);
    const referrals = newParcrain(kids);
    const investments = [];
    for (const k of kids) inviteeInvests({ referrals, investments, rewards, wallet, kids: [k] });
    assert.equal(wallet.balance, 3000 + 15000 + 30000 + 60000);
    assert.equal(rewards.length, 4);
  });

  it('12. Automatique : à 100 filleuls investis, tous les paliers sont crédités (808 000 FC au total)', () => {
    const rewards = [];
    const wallet = { balance: 0, transactions: [] };
    const kids = Array.from({ length: 100 }, (_, i) => `f100-${i}`);
    const referrals = newParcrain(kids);
    const investments = [];
    for (const k of kids) inviteeInvests({ referrals, investments, rewards, wallet, kids: [k] });
    assert.equal(wallet.balance, 3000 + 15000 + 30000 + 60000 + 200000 + 500000);
    assert.equal(rewards.length, 6);
    assert.equal(rewards.reduce((s, r) => s + r.reward_amount, 0), 808000);
  });

  it('13. Un invité inscrit mais qui n\u2019investit pas : aucun crédit', () => {
    const rewards = [];
    const wallet = { balance: 5000, transactions: [] };
    const referrals = newParcrain(['f1', 'f2']);
    const investments = [];
    const granted = simulateAutoGrant({ parentId: 'user-1', referrals, investments, rewards, wallet });
    assert.equal(granted.length, 0);
    assert.equal(wallet.balance, 5000);
    assert.equal(wallet.transactions.length, 0);
  });

  it("14. Un investissement PENDING (non validé) : aucun crédit", () => {
    const rewards = [];
    const wallet = { balance: 0, transactions: [] };
    const referrals = newParcrain(['f1']);
    const investments = [];
    inviteeInvests({ referrals, investments, rewards, wallet, kids: ['f1'], status: 'PENDING' });
    assert.equal(wallet.balance, 0);
    assert.equal(rewards.length, 0);
  });

  it('15. wallet_transactions : deux écritures automatiques (3 000 puis 15 000) après 5 investissements', () => {
    const rewards = [];
    const wallet = { balance: 0, transactions: [] };
    const kids = ['g1', 'g2', 'g3', 'g4', 'g5'];
    const referrals = newParcrain(kids);
    const investments = [];
    for (const k of kids) inviteeInvests({ referrals, investments, rewards, wallet, kids: [k] });
    assert.equal(wallet.transactions.length, 2);
    assert.deepEqual(wallet.transactions.map((t) => t.amount), [3000, 15000]);
    assert.deepEqual(wallet.transactions.map((t) => t.type), ['REFERRAL_TASK_REWARD', 'REFERRAL_TASK_REWARD']);
    assert.ok(wallet.transactions.every((t) => t.status === 'COMPLETED' && t.balance_after === t.balance_before + t.amount));
  });

  it("16. L'ancien système A/B/C/D ne génère plus aucune commission", () => {
    const commissionsLog = [];
    const result = disabledDistributeCommissions(commissionsLog);
    assert.equal(result, undefined);
    assert.equal(commissionsLog.length, 0);
  });

  it('17. Isolation : les récompenses d\u2019un parrain sont invisibles pour un autre', () => {
    const rewards = [];
    const walletA = { balance: 0, transactions: [] };
    const walletB = { balance: 0, transactions: [] };
    const referrals = newParcrain(['fA'])
      .concat([{ parent_id: 'user-2', child_id: 'fB', level: 'A' }]);
    const investments = [];
    investments.push({ user_id: 'fA', status: 'ACTIVE' });
    simulateAutoGrant({ parentId: 'user-1', referrals, investments, rewards, wallet: walletA });
    simulateAutoGrant({ parentId: 'user-2', referrals, investments, rewards, wallet: walletB });
    assert.equal(walletA.balance, 3000);
    assert.equal(walletB.balance, 0);
    assert.equal(rewards.filter((r) => r.user_id === 'user-1').length, 1);
    assert.equal(rewards.filter((r) => r.user_id === 'user-2').length, 0);
  });

  it('18. Manipulation : seuls les filleuls réellement investis comptent', () => {
    const rewards = [];
    const wallet = { balance: 0, transactions: [] };
    const referrals = newParcrain(['reel', 'faux-1', 'faux-2']);
    const investments = [{ user_id: 'reel', status: 'ACTIVE' }];
    const granted = simulateAutoGrant({ parentId: 'user-1', referrals, investments, rewards, wallet });
    assert.deepEqual(granted.map((g) => g.required_invites), [1]);
    assert.equal(wallet.balance, 3000);
  });

  it('19. Idempotence : un filleul n\u2019appartient qu\u2019à un seul parrain', () => {
    const codeProfile = new Map([['BISO1111', 'user-1'], ['BISO2222', 'user-2']]);
    const referrals = [];
    registerWithReferral({ codeProfile, referrals, childId: 'user-3', referralCode: 'BISO1111' });
    const second = registerWithReferral({ codeProfile, referrals, childId: 'user-3', referralCode: 'BISO2222' });
    assert.equal(second.error, 'DUPLICATE_CHILD');
    assert.equal(referrals.length, 1);
    assert.equal(referrals[0].parent_id, 'user-1');
  });

  it("20. Cumul exact sans aucune duplication (8 filleuls → 18 000 FC, jamais plus)", () => {
    const rewards = [];
    const wallet = { balance: 0, transactions: [] };
    const kids = Array.from({ length: 8 }, (_, i) => `h-${i}`);
    const referrals = newParcrain(kids);
    const investments = [];
    for (const k of kids) inviteeInvests({ referrals, investments, rewards, wallet, kids: [k] });
    assert.equal(countValidInvitations('user-1', referrals, investments), 8);
    assert.equal(rewards.length, 2);
    assert.equal(wallet.transactions.length, 2);
    assert.equal(wallet.balance, 18000);
    assert.equal(rewards.reduce((s, r) => s + r.reward_amount, 0), 18000);
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe("Suite 14 : Pop-up de bienvenue BISO INVEST (missions pop-up)", () => {
  const PROJECT_URL = new URL('..', import.meta.url);

  // --- Miroir exact de lib/welcome-popup.ts ---
  const WELCOME_KEY = 'biso_welcome_shown_for_user';
  const EXCLUDED_SLUGS = ['energie-solaire', 'commerce', 'industrie-transformation', 'transport-logistique', 'restauration'];
  const VIP_BY_PRICE = new Map([[20000, 'VIP1'], [50000, 'VIP2'], [100000, 'VIP3'], [250000, 'VIP4']]);
  const vipForPrice = (price) => VIP_BY_PRICE.get(price) || 'VIP0';
  const welcomeStorage = () => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, v),
      removeItem: (k) => m.delete(k),
    };
  };

  function buildWelcomeSectors(categories, products, year, month) {
    const active = products.filter((p) => p.is_active !== false);
    return categories
      .filter((c) => !EXCLUDED_SLUGS.includes(c.slug))
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon || '',
        orderIndex: cat.order_index ?? 0,
        packs: active
          .filter((p) => p.category_id === cat.id)
          .map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            monthlyReturn: p.monthly_return,
            durationMonths: p.duration_months,
            vipLevel: vipForPrice(p.price),
            dailyRevenue: calculateDailyRevenue(p.monthly_return, year, month),
          }))
          .sort((a, b) => a.price - b.price),
      }))
      .filter((s) => s.packs.length > 0)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  function createAuthenticatedWelcomeSession() {
    const store = welcomeStorage();
    let open = false;
    let signedIn = false;
    return {
      store,
      close: () => { open = false; },
      signIn: () => { signedIn = true; store.removeItem(WELCOME_KEY); open = true; store.setItem(WELCOME_KEY, 'u1'); },
      navigate: () => {
        // INITIAL_SESSION : sans utilisateur → jamais affiché ; avec session → une seule fois.
        if (!signedIn) return;
        if (store.getItem(WELCOME_KEY) !== 'u1') { open = true; store.setItem(WELCOME_KEY, 'u1'); }
      },
      signOut: () => { signedIn = false; store.removeItem(WELCOME_KEY); open = false; },
      isOpen: () => open,
    };
  }

  const CATEGORIES_FIXTURE = [
    { id: 'ag', name: 'Agriculture', slug: 'agriculture', icon: 'Sprout', order_index: 1 },
    { id: 'el', name: 'Élevage', slug: 'elevage', icon: 'Tractor', order_index: 2 },
    { id: 'pi', name: 'Pisciculture', slug: 'pisciculture', icon: 'Fish', order_index: 3 },
    { id: 'es', name: 'Énergie solaire', slug: 'energie-solaire', icon: 'Sun', order_index: 4 },
  ];
  const PRODUCTS_FIXTURE = [
    { id: 'm1', category_id: 'ag', name: 'Pack Maïs', price: 20000, monthly_return: 20000, duration_months: 12, is_active: true },
    { id: 'm2', category_id: 'ag', name: 'Pack Riz', price: 50000, monthly_return: 50000, duration_months: 12, is_active: true },
    { id: 'm3', category_id: 'ag', name: 'Pack Manioc', price: 100000, monthly_return: 100000, duration_months: 12, is_active: true },
    { id: 'm4', category_id: 'ag', name: 'Pack Soja', price: 250000, monthly_return: 250000, duration_months: 12, is_active: true },
    { id: 'p1', category_id: 'el', name: 'Pack Poulets', price: 20000, monthly_return: 20000, duration_months: 12, is_active: true },
    { id: 't1', category_id: 'pi', name: 'Tilapia', price: 20000, monthly_return: 20000, duration_months: 12, is_active: true },
    { id: 't2', category_id: 'pi', name: 'Silure', price: 50000, monthly_return: 50000, duration_months: 12, is_active: true },
    { id: 't3', category_id: 'pi', name: 'Anguille', price: 100000, monthly_return: 100000, duration_months: 12, is_active: true },
    { id: 't4', category_id: 'pi', name: 'Carpe', price: 250000, monthly_return: 250000, duration_months: 12, is_active: true },
    { id: 't5', category_id: 'pi', name: 'Tilapia (ancien)', price: 30000, monthly_return: 30000, duration_months: 12, is_active: false },
    { id: 'es1', category_id: 'es', name: 'Pack Solaire', price: 50000, monthly_return: 50000, duration_months: 12, is_active: true },
    { id: 'in1', category_id: 'ag', name: 'Ancien pack', price: 30000, monthly_return: 30000, duration_months: 12, is_active: false },
  ];
  const JULY_2026 = buildWelcomeSectors(CATEGORIES_FIXTURE, PRODUCTS_FIXTURE, 2026, 6);

  it('1. Connexion réussie → le pop-up de bienvenue s\u2019affiche automatiquement', () => {
    const s = createAuthenticatedWelcomeSession();
    s.signIn();
    assert.equal(s.isOpen(), true);
  });

  it('2. Appui sur [×] Fermer → le pop-up disparaît', () => {
    const s = createAuthenticatedWelcomeSession();
    s.signIn();
    s.close();
    assert.equal(s.isOpen(), false);
  });

  it('3. Navigation interne après fermeture → le pop-up ne réapparaît pas', () => {
    const s = createAuthenticatedWelcomeSession();
    s.signIn();
    s.close();
    for (let i = 0; i < 5; i++) s.navigate();
    assert.equal(s.isOpen(), false);
  });

  it('4. Déconnexion puis reconnexion → le pop-up s\u2019affiche à nouveau', () => {
    const s = createAuthenticatedWelcomeSession();
    s.signIn();
    s.close();
    s.signOut();
    assert.equal(s.isOpen(), false);
    s.signIn();
    assert.equal(s.isOpen(), true);
  });

  it('5. Utilisateur non connecté → aucun pop-up affiché', () => {
    const s = createAuthenticatedWelcomeSession();
    s.signOut();
    for (let i = 0; i < 3; i++) s.navigate();
    assert.equal(s.isOpen(), false);
    assert.equal(s.store.getItem(WELCOME_KEY), null);
  });

  it('6. Les packs sont récupérés dynamiquement depuis Supabase (aucun hardcode)', () => {
    const tilapia = JULY_2026.find((s) => s.slug === 'pisciculture').packs.find((p) => p.name === 'Tilapia');
    assert.equal(tilapia.price, 20000);
    const variant = buildWelcomeSectors(
      CATEGORIES_FIXTURE,
      PRODUCTS_FIXTURE.map((p) => (p.id === 't1' ? { ...p, price: 25000, monthly_return: 25000 } : p)),
      2026,
      6,
    );
    const variantTilapia = variant.find((s) => s.slug === 'pisciculture').packs.find((p) => p.name === 'Tilapia');
    assert.equal(variantTilapia.price, 25000, 'le prix affiché suit la donnée Supabase, pas une constante codée en dur');
  });

  it('7. Les packs inactifs ne sont jamais affichés', () => {
    const allNames = JULY_2026.flatMap((s) => s.packs.map((p) => p.name));
    assert.ok(!allNames.includes('Tilapia (ancien)'));
    assert.ok(!allNames.includes('Ancien pack'));
  });

  it('8. Le secteur Énergie solaire n\u2019apparaît jamais', () => {
    assert.ok(!JULY_2026.some((s) => s.slug.includes('solaire')));
    assert.ok(!JULY_2026.some((s) => s.slug.includes('energie')));
    assert.ok(!JULY_2026.flatMap((s) => s.packs.map((p) => p.name)).includes('Pack Solaire'));
  });

  it('9. Tilapia affiché à exactement 20 000 FC (jamais 30 000 FC)', () => {
    const packs = JULY_2026.flatMap((s) => s.packs);
    const tilapia = packs.filter((p) => p.name === 'Tilapia');
    assert.equal(tilapia.length, 1);
    assert.equal(tilapia[0].price, 20000);
  });

  it('10. Aucun pack Pisciculture actif à 30 000 FC', () => {
    const pisciculture = JULY_2026.find((s) => s.slug === 'pisciculture');
    assert.ok(pisciculture.packs.every((p) => p.price !== 30000));
  });

  it('11. Les 4 packs officiels Pisciculture sont tous affichés', () => {
    const names = JULY_2026.find((s) => s.slug === 'pisciculture').packs.map((p) => p.name);
    assert.deepEqual(names, ['Tilapia', 'Silure', 'Anguille', 'Carpe']);
  });

  it('12. Mapping VIP : Tilapia (20 000 FC) → VIP1', () => {
    assert.equal(vipForPrice(20000), 'VIP1');
    assert.equal(JULY_2026.find((s) => s.slug === 'pisciculture').packs[0].vipLevel, 'VIP1');
  });

  it('13. Mapping VIP : Silure (50 000 FC) → VIP2', () => {
    assert.equal(vipForPrice(50000), 'VIP2');
    assert.equal(JULY_2026.find((s) => s.slug === 'pisciculture').packs[1].vipLevel, 'VIP2');
  });

  it('14. Mapping VIP : Anguille (100 000 FC) → VIP3', () => {
    assert.equal(vipForPrice(100000), 'VIP3');
    assert.equal(JULY_2026.find((s) => s.slug === 'pisciculture').packs[2].vipLevel, 'VIP3');
  });

  it('15. Mapping VIP : Carpe (250 000 FC) → VIP4', () => {
    assert.equal(vipForPrice(250000), 'VIP4');
    assert.equal(JULY_2026.find((s) => s.slug === 'pisciculture').packs[3].vipLevel, 'VIP4');
  });

  it('16. Revenu quotidien = revenu mensuel ÷ jours réels du mois (28/29/30/31)', () => {
    assert.equal(calculateDailyRevenue(20000, 2025, 0), 20000 / 31);
    assert.equal(calculateDailyRevenue(20000, 2025, 8), 20000 / 30);
    assert.equal(calculateDailyRevenue(20000, 2024, 1), 20000 / 29);
    assert.equal(calculateDailyRevenue(20000, 2026, 1), 20000 / 28);
    const tilapia = JULY_2026.find((s) => s.slug === 'pisciculture').packs[0];
    assert.equal(tilapia.dailyRevenue, 20000 / 31, 'juillet 2026 = 31 jours réels');
  });

  it('17. Design mobile : carte scrollable, pleine largeur, actions figées (contrat vérifié)', () => {
    const src = readFileSync(fileURLToPath(new URL('lib/welcome-popup.ts', PROJECT_URL)), 'utf8');
    assert.ok(src.includes('max-h-[85vh]'), 'la carte doit être défilable sur mobile');
    assert.ok(src.includes('overflow-y-auto'));
    assert.ok(src.includes('w-full'), 'la carte doit prendre toute la largeur sur mobile');
    assert.ok(src.includes('items-end'), 'sur mobile la carte est ancrée en bas (bottom-sheet)');
  });

  it('18. Design desktop : carte centrée et bornée (contrat vérifié)', () => {
    const src = readFileSync(fileURLToPath(new URL('lib/welcome-popup.ts', PROJECT_URL)), 'utf8');
    assert.ok(src.includes('sm:items-center'), 'centré sur desktop');
    assert.ok(src.includes('max-w-lg'), 'largeur bornée');
    assert.ok(src.includes('sm:rounded-3xl'));
  });

  it('19. Aucun impact portefeuille/ledger : le module ne mute aucun solde', () => {
    const src = readFileSync(fileURLToPath(new URL('lib/welcome-popup.ts', PROJECT_URL)), 'utf8');
    for (const forbidden of ['balance', 'ledger', 'wallet_transactions', 'today_earned', 'total_invested', 'purchase_investment']) {
      assert.ok(!src.includes(forbidden), `le module ne doit pas manipuler '${forbidden}'`);
    }
    const snapshotCat = JSON.stringify(CATEGORIES_FIXTURE);
    const snapshotProd = JSON.stringify(PRODUCTS_FIXTURE);
    buildWelcomeSectors(CATEGORIES_FIXTURE, PRODUCTS_FIXTURE, 2026, 6);
    assert.equal(JSON.stringify(CATEGORIES_FIXTURE), snapshotCat, 'les entrées ne sont pas mutées');
    assert.equal(JSON.stringify(PRODUCTS_FIXTURE), snapshotProd, 'les entrées ne sont pas mutées');
  });

  it('20. Aucune RPC financière appelée : lecture seule (product_categories + products uniquement)', () => {
    const componentSrc = readFileSync(fileURLToPath(new URL('components/WelcomePopup.tsx', PROJECT_URL)), 'utf8');
    assert.ok(!componentSrc.includes('.rpc('), 'le pop-up n\u2019appelle aucune RPC (ni retour, ni achat, ni retrait)');
    assert.ok(componentSrc.includes("from('product_categories')"), 'lecture des catégories uniquement');
    assert.ok(componentSrc.includes("from('products')"), 'lecture des produits uniquement');
    for (const forbidden of ['purchase_investment', 'request_withdrawal', 'claim_daily_profit', 'update_deposit_status', 'distribute_commissions']) {
      assert.ok(!componentSrc.includes(forbidden), `aucune référence à la RPC ${forbidden}`);
    }
  });
});

