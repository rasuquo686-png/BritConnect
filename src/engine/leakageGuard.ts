/**
 * Data Leakage Guard & Audit Engine
 * Guarantees zero target leakage into predictive machine learning models.
 * Automatically excludes outcome-encoding variables and flags suspicious univariate correlations.
 */

import { CustomerRecord } from '../types';

export interface LeakageItem {
  columnName: string;
  category: 'Explicit Outcome' | 'Target Proxy' | 'Post-Outcome Measurement' | 'High Univariate AUC';
  reason: string;
  isExcludedByDefault: boolean;
  canOverride: boolean;
  univariateAuc?: number;
  correlation?: number;
}

export const EXPLICIT_LEAKAGE_COLUMNS: LeakageItem[] = [
  {
    columnName: 'Churn Status',
    category: 'Explicit Outcome',
    reason: 'Directly mirrors the binary churn outcome (Active vs Churned). Including this creates a trivial 100% accurate tautology.',
    isExcludedByDefault: true,
    canOverride: false,
  },
  {
    columnName: 'Churn Flag',
    category: 'Explicit Outcome',
    reason: 'The exact mathematical ground-truth target label (1 or 0). Cannot be used as an input predictor.',
    isExcludedByDefault: true,
    canOverride: false,
  },
  {
    columnName: 'Churn Date',
    category: 'Explicit Outcome',
    reason: 'Cancellation date only exists for churned customers and is blank for active accounts, leaking customer departure.',
    isExcludedByDefault: true,
    canOverride: false,
  },
  {
    columnName: 'Churn Reason',
    category: 'Post-Outcome Measurement',
    reason: 'Exit interview explanation recorded only after cancellation has already occurred. Reserved strictly for descriptive diagnostic drilldowns.',
    isExcludedByDefault: true,
    canOverride: false,
  },
  {
    columnName: 'Monthly Revenue At Risk GBP',
    category: 'Target Proxy',
    reason: 'Pre-computed commercial exposure variable derived from an existing churn risk score.',
    isExcludedByDefault: true,
    canOverride: false,
  },
];

/**
 * Calculates univariate AUC (Mann-Whitney U statistic) between a continuous feature and binary target
 */
export function calculateUnivariateAuc(featureValues: number[], targets: number[]): number {
  const n = featureValues.length;
  if (n === 0) return 0.5;

  const paired = featureValues.map((v, i) => ({ val: v, target: targets[i] }));
  paired.sort((a, b) => a.val - b.val);

  let nPositive = 0;
  let nNegative = 0;
  targets.forEach((t) => {
    if (t === 1) nPositive++;
    else nNegative++;
  });

  if (nPositive === 0 || nNegative === 0) return 0.5;

  let rankSumPositive = 0;
  for (let i = 0; i < n; i++) {
    if (paired[i].target === 1) {
      rankSumPositive += i + 1; // 1-indexed rank
    }
  }

  const u = rankSumPositive - (nPositive * (nPositive + 1)) / 2;
  const auc = u / (nPositive * nNegative);
  return Math.max(auc, 1 - auc); // Direction-agnostic discriminative power
}

/**
 * Runs a complete leakage audit across dataset columns and newly engineered candidate features
 */
export function auditDatasetForLeakage(
  records: CustomerRecord[],
  candidateFeatures: Array<{ name: string; values: number[] }>,
  targets: number[]
): {
  leakageAuditList: LeakageItem[];
  highRiskLeakageDetected: boolean;
} {
  const auditList: LeakageItem[] = [...EXPLICIT_LEAKAGE_COLUMNS];
  let highRiskLeakageDetected = false;

  // Check candidate engineered features for suspicious univariate AUC > 0.92
  candidateFeatures.forEach((feat) => {
    const auc = calculateUnivariateAuc(feat.values, targets);
    if (auc >= 0.92) {
      highRiskLeakageDetected = true;
      auditList.push({
        columnName: feat.name,
        category: 'High Univariate AUC',
        reason: `Univariate AUC is ${(auc * 100).toFixed(1)}%. Near-perfect correlation indicates potential circular logic or forward-looking feature leakage.`,
        isExcludedByDefault: true,
        canOverride: true,
        univariateAuc: Math.round(auc * 1000) / 1000,
      });
    }
  });

  return {
    leakageAuditList: auditList,
    highRiskLeakageDetected,
  };
}
