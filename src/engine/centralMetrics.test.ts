/**
 * Unit Tests for Calculation Integrity & KPI Formulas
 * Verifies mathematical correctness of centralMetrics, feature engineering, and evaluation algorithms.
 */

import { computeDashboardKpis } from './centralMetrics';
import { engineerCustomerFeatures } from './features';
import { evaluateModelPerformance } from './metrics';
import { CustomerRecord, ScoredCustomer } from '../types';

export function runCalculationUnitTests(): { passed: number; failed: number; results: string[] } {
  let passed = 0;
  let failed = 0;
  const results: string[] = [];

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      passed++;
      results.push(`✔ PASS: ${testName}`);
    } else {
      failed++;
      results.push(`❌ FAIL: ${testName}`);
      console.error(`Test failure: ${testName}`);
    }
  };

  // Test 1: Churn Rate calculation (Σ Churn Flag ÷ N)
  const mockRecords: CustomerRecord[] = [
    { 'Customer ID': 'C1', 'Churn Flag': 1, 'Churn Status': 'Churned', 'Monthly Charge GBP': 40 },
    { 'Customer ID': 'C2', 'Churn Flag': 0, 'Churn Status': 'Active', 'Monthly Charge GBP': 50 },
    { 'Customer ID': 'C3', 'Churn Flag': 0, 'Churn Status': 'Active', 'Monthly Charge GBP': 30 },
    { 'Customer ID': 'C4', 'Churn Flag': 0, 'Churn Status': 'Active', 'Monthly Charge GBP': 60 },
  ];

  const kpis = computeDashboardKpis(mockRecords);
  assert(kpis.totalCustomers === 4, 'Total Customers should equal 4');
  assert(kpis.activeCustomers === 3, 'Active Customers should equal 3');
  assert(kpis.churnedCustomers === 1, 'Churned Customers should equal 1');
  assert(kpis.churnRate === 25.0, 'Churn Rate should equal exactly 25.0% (1 ÷ 4)');
  assert(kpis.activeMrr === 140, 'Active MRR should equal £140 (50+30+60)');

  // Test 2: Monthly Revenue Lost (Σ Monthly Charge of churned customers)
  assert(kpis.monthlyRevenueLost === 40, 'Monthly Revenue Lost should equal £40 (charge of churned C1)');
  assert(kpis.avgMonthlyCharge === 45.0, 'Average Monthly Charge should equal £45.00 ((40+50+30+60) ÷ 4)');

  // Test 3: NPS Score calculation (% Promoters - % Detractors)
  const npsRecords: CustomerRecord[] = [
    { 'Customer ID': 'C1', 'Churn Flag': 0, 'Churn Status': 'Active', 'NPS Score': 10 }, // Promoter
    { 'Customer ID': 'C2', 'Churn Flag': 0, 'Churn Status': 'Active', 'NPS Score': 9 },  // Promoter
    { 'Customer ID': 'C3', 'Churn Flag': 0, 'Churn Status': 'Active', 'NPS Score': 8 },  // Passive
    { 'Customer ID': 'C4', 'Churn Flag': 0, 'Churn Status': 'Active', 'NPS Score': 4 },  // Detractor
  ];
  const npsKpis = computeDashboardKpis(npsRecords);
  // 2 promoters (50%), 1 passive (25%), 1 detractor (25%) -> NPS = 50 - 25 = +25
  assert(npsKpis.npsScore === 25, 'Net Promoter Score should equal exactly +25 on 0-10 scale');

  // Test 4: Predicted Monthly Revenue at Risk = Σ(P(churn) × Effective Charge) & 12M Expected Loss
  const mockScored: ScoredCustomer[] = [
    {
      customerId: 'C2',
      churnProbability: 60.0,
      riskTier: 'High',
      riskRank: 1,
      percentile: 90,
      monthlyRevenueAtRisk: 30.0, // 0.60 * 50
      expectedLtvAtRisk: 420,
      topDrivers: [],
      record: mockRecords[1],
    },
  ];
  const riskKpis = computeDashboardKpis(mockRecords, mockScored);
  assert(riskKpis.monthlyRevenueAtRisk === 30, 'Predicted £ at risk should equal £30 from scored customer');
  assert(riskKpis.expectedLoss12M === 360, '12-Month Expected Loss should equal £360 (30 × 12)');
  assert(riskKpis.criticalAndHighRiskCount === 1, 'Critical and High risk count should equal 1');

  // Test 5: Feature Engineering - Out of Contract detection
  const outOfContractCustomer: CustomerRecord = {
    'Customer ID': 'C5',
    'Churn Flag': 0,
    'Churn Status': 'Active',
    'Contract End Date': '2026-08-01', // Before asOfDate 2026-10-31
    'Monthly Charge GBP': 40,
    'Discount Percent': 10,
  };
  const engineered = engineerCustomerFeatures(outOfContractCustomer, '2026-10-31');
  assert(engineered.isOutOfContract === 1, 'Contract ending before as-of date should flag isOutOfContract = 1');
  assert(engineered.effectiveMonthlyCharge === 36, 'Effective charge should equal £36 (£40 with 10% discount)');

  // Test 6: Model Evaluation Metrics - Confusion Matrix & Precision/Recall/F1
  const testActual = [1, 0, 1, 0, 1];
  const testProbas = [0.85, 0.20, 0.70, 0.40, 0.90];
  const testMetrics = evaluateModelPerformance(testActual, testProbas, 0.5);
  // All 3 positives are above 0.5 (TP=3), both negatives are below 0.5 (TN=2) -> Perfect classification
  assert(testMetrics.confusionMatrix.tp === 3, 'Evaluation should produce TP = 3');
  assert(testMetrics.confusionMatrix.fp === 0, 'Evaluation should produce FP = 0');
  assert(testMetrics.precision === 1.0, 'Precision should equal 1.0 on clean separation');
  assert(testMetrics.recall === 1.0, 'Recall should equal 1.0 on clean separation');
  assert(testMetrics.f1 === 1.0, 'F1 score should equal 1.0');
  assert(testMetrics.rocAuc === 1.0, 'ROC-AUC should equal 1.0 on perfect rank order');

  return { passed, failed, results };
}
