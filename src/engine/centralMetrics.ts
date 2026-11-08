/**
 * Central Authoritative KPI Calculations Engine
 * Single source of truth for all dashboard indicators, reconciling cards with charts.
 */

import { CustomerRecord, ScoredCustomer } from '../types';

export interface DashboardKpiSummary {
  totalCustomers: number;
  activeCustomers: number;
  churnedCustomers: number;
  churnRate: number; // %
  activeMrr: number; // £ active Monthly Recurring Revenue
  avgMonthlyCharge: number; // £
  monthlyRevenueLost: number; // £
  monthlyRevenueAtRisk: number; // £
  expectedLoss12M: number; // £ (12-Month Expected Revenue Loss)
  criticalRiskCount: number;
  highRiskCount: number;
  criticalAndHighRiskCount: number;
  highRiskPct: number;
  totalLifetimeRevenue: number; // £
  avgTenureMonths: number;
  avgSatisfaction: number;
  npsScore: number;
  npsScaleDetected: '0-10' | '-100 to 100';
  contractsExpiring30: number;
  contractsExpiring60: number;
  contractsExpiring90: number;
  modelAuc: number | null;
  modelPrAuc: number | null;
}

export const KPI_FORMULAS = {
  totalCustomers: 'Total count of customer accounts matching active global filters (N = Σ 1).',
  activeCustomers: 'Count of active accounts currently in subscription service (Σ [Churn Flag == 0]).',
  churnedCustomers: 'Count of cancelled subscriber accounts (Σ [Churn Flag == 1]).',
  churnRate: 'Ratio of churned subscribers to total customer base: (Σ Churned ÷ N) × 100.',
  activeMrr: 'Active Monthly Recurring Revenue: Σ(Monthly Charge GBP) across active accounts.',
  avgMonthlyCharge: 'Mean monthly recurring subscription billing charge: Σ(Monthly Charge GBP) ÷ N.',
  monthlyRevenueLost: 'Gross monthly recurring revenue lost from churned subscribers: Σ(Monthly Charge of Churned Accounts).',
  monthlyRevenueAtRisk: 'Predicted monthly revenue exposed to departure: Σ(P(churn) × Effective Monthly Charge) across active accounts.',
  expectedLoss12M: '12-Month Expected Revenue Loss: Monthly Revenue at Risk × 12 annualized.',
  criticalAndHighRiskCount: 'Count of active customers in Critical (P ≥ 70%) and High (P ≥ 50%) churn risk tiers.',
  totalLifetimeRevenue: 'Cumulative historical revenue generated across the subscriber cohort: Σ(Lifetime Revenue GBP).',
  avgTenureMonths: 'Average relationship tenure duration in months: Σ(Tenure Months) ÷ N.',
  avgSatisfaction: 'Mean customer satisfaction score: Σ(Satisfaction Score 1–10) ÷ N.',
  npsScore: 'Net Promoter Score: % Promoters (NPS 9–10) minus % Detractors (NPS 0–6). Scale automatically detected.',
  highRiskCount: 'Count and percentage of active customers with predicted churn probability >= 50%.',
  contractsExpiring30: 'Active customer contracts scheduled to expire within the next 30 days (1–30 days remaining).',
  contractsExpiring60: 'Active customer contracts scheduled to expire within the next 60 days (1–60 days remaining).',
  contractsExpiring90: 'Active customer contracts scheduled to expire within the next 90 days (1–90 days remaining).',
};

export function computeDashboardKpis(
  records: CustomerRecord[],
  scoredList: ScoredCustomer[] = [],
  modelAuc: number | null = null,
  modelPrAuc: number | null = null
): DashboardKpiSummary {
  const total = records.length;
  if (total === 0) {
    return {
      totalCustomers: 0,
      activeCustomers: 0,
      churnedCustomers: 0,
      churnRate: 0,
      activeMrr: 0,
      avgMonthlyCharge: 0,
      monthlyRevenueLost: 0,
      monthlyRevenueAtRisk: 0,
      expectedLoss12M: 0,
      criticalRiskCount: 0,
      highRiskCount: 0,
      criticalAndHighRiskCount: 0,
      highRiskPct: 0,
      totalLifetimeRevenue: 0,
      avgTenureMonths: 0,
      avgSatisfaction: 0,
      npsScore: 0,
      npsScaleDetected: '0-10',
      contractsExpiring30: 0,
      contractsExpiring60: 0,
      contractsExpiring90: 0,
      modelAuc: null,
      modelPrAuc: null,
    };
  }

  let activeCount = 0;
  let churnedCount = 0;
  let chargeSum = 0;
  let activeMrrSum = 0;
  let revenueLostSum = 0;
  let lifetimeRevSum = 0;
  let tenureSum = 0;
  let satisfactionSum = 0;
  let satisfactionCount = 0;

  // Contract expiry accumulators for active accounts
  let contractsExpiring30 = 0;
  let contractsExpiring60 = 0;
  let contractsExpiring90 = 0;

  // Use reference date: max contract/join date or 2026-10-31
  const refTimestamp = new Date('2026-10-31').getTime();

  // NPS accumulators
  let npsPromoters = 0;
  let npsDetractors = 0;
  let npsTotalResponses = 0;
  let isWideNpsScale = false;

  records.forEach((r) => {
    const isChurned = Number(r['Churn Flag']) === 1;
    const charge = Number(r['Monthly Charge GBP']) || 0;
    chargeSum += charge;

    if (isChurned) {
      churnedCount++;
      revenueLostSum += charge;
    } else {
      activeCount++;
      activeMrrSum += charge;

      // Check contract expiration for active accounts
      const endDateStr = r['Contract End Date'];
      if (endDateStr) {
        const endTs = new Date(endDateStr).getTime();
        if (!isNaN(endTs)) {
          const daysRemaining = Math.ceil((endTs - refTimestamp) / (1000 * 60 * 60 * 24));
          if (daysRemaining >= 0 && daysRemaining <= 30) contractsExpiring30++;
          if (daysRemaining >= 0 && daysRemaining <= 60) contractsExpiring60++;
          if (daysRemaining >= 0 && daysRemaining <= 90) contractsExpiring90++;
        }
      }
    }

    lifetimeRevSum += Number(r['Lifetime Revenue GBP']) || 0;
    tenureSum += Number(r['Tenure Months']) || 0;

    const sat = Number(r['Satisfaction Score 1 10']);
    if (!isNaN(sat) && sat > 0) {
      satisfactionSum += sat;
      satisfactionCount++;
    }

    const rawNps = Number(r['NPS Score']);
    if (!isNaN(rawNps)) {
      npsTotalResponses++;
      if (rawNps > 10 || rawNps < 0) {
        isWideNpsScale = true;
        if (rawNps >= 50) npsPromoters++;
        else if (rawNps <= 0) npsDetractors++;
      } else {
        if (rawNps >= 9) npsPromoters++;
        else if (rawNps <= 6) npsDetractors++;
      }
    }
  });

  const churnRate = (churnedCount / total) * 100;
  const avgMonthlyCharge = chargeSum / total;
  const avgTenureMonths = tenureSum / total;
  const avgSatisfaction = satisfactionCount > 0 ? satisfactionSum / satisfactionCount : 7.0;

  let npsScore = 0;
  if (npsTotalResponses > 0) {
    const pctPromoters = (npsPromoters / npsTotalResponses) * 100;
    const pctDetractors = (npsDetractors / npsTotalResponses) * 100;
    npsScore = Math.round(pctPromoters - pctDetractors);
  }

  // Monthly Revenue At Risk for active filtered records
  const filteredActiveCustIds = new Set(
    records.filter((r) => Number(r['Churn Flag']) === 0).map((r) => String(r['Customer ID']))
  );

  let monthlyRevAtRiskSum = 0;
  let highRiskCount = 0;
  let criticalRiskCount = 0;

  if (scoredList.length > 0) {
    scoredList.forEach((s) => {
      if (filteredActiveCustIds.has(s.customerId)) {
        monthlyRevAtRiskSum += s.monthlyRevenueAtRisk;
        if (s.churnProbability >= 50 && s.churnProbability < 70) highRiskCount++;
        if (s.churnProbability >= 70) criticalRiskCount++;
      }
    });
  } else {
    records.forEach((r) => {
      if (Number(r['Churn Flag']) === 0) {
        const atRisk = Number(r['Monthly Revenue At Risk GBP']) || 0;
        monthlyRevAtRiskSum += atRisk;
        if (atRisk >= 20) criticalRiskCount++;
        else if (atRisk >= 10) highRiskCount++;
      }
    });
  }

  const criticalAndHighRiskCount = criticalRiskCount + highRiskCount;
  const highRiskPct = activeCount > 0 ? (criticalAndHighRiskCount / activeCount) * 100 : 0;
  const expectedLoss12M = Math.round(monthlyRevAtRiskSum * 12);

  return {
    totalCustomers: total,
    activeCustomers: activeCount,
    churnedCustomers: churnedCount,
    churnRate: Math.round(churnRate * 10) / 10,
    activeMrr: Math.round(activeMrrSum * 100) / 100,
    avgMonthlyCharge: Math.round(avgMonthlyCharge * 100) / 100,
    monthlyRevenueLost: Math.round(revenueLostSum * 100) / 100,
    monthlyRevenueAtRisk: Math.round(monthlyRevAtRiskSum * 100) / 100,
    expectedLoss12M: Math.round(monthlyRevAtRiskSum * 12 * 100) / 100,
    criticalRiskCount,
    highRiskCount,
    criticalAndHighRiskCount,
    highRiskPct: Math.round(highRiskPct * 10) / 10,
    totalLifetimeRevenue: Math.round(lifetimeRevSum * 100) / 100,
    avgTenureMonths: Math.round(avgTenureMonths * 10) / 10,
    avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
    npsScore,
    npsScaleDetected: isWideNpsScale ? '-100 to 100' : '0-10',
    contractsExpiring30,
    contractsExpiring60,
    contractsExpiring90,
    modelAuc,
    modelPrAuc,
  };
}
