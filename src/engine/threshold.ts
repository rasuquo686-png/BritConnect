/**
 * Decision Threshold & Business Expected Value Optimization Engine
 */

export interface ThresholdOptimizationResult {
  currentThreshold: number;
  f1OptimalThreshold: number;
  recall80Threshold: number;
  maxNetBenefitThreshold: number;
  expectedValueCurve: Array<{
    threshold: number;
    tp: number;
    fp: number;
    tn: number;
    fn: number;
    precision: number;
    recall: number;
    f1: number;
    campaignCostGbp: number;
    retainedRevenueGbp: number;
    netBenefitGbp: number;
  }>;
  recommendedThreshold: number;
  maxNetBenefitGbp: number;
}

export interface BusinessInputs {
  costOfOfferGbp: number; // e.g. £25
  acceptanceRatePct: number; // e.g. 25%
  monthlyMarginGbp: number; // e.g. £32
  retainedLifetimeMonths: number; // e.g. 14 months
}

export function optimizeThreshold(
  actual: number[],
  predictedProbas: number[],
  businessInputs: BusinessInputs = {
    costOfOfferGbp: 25,
    acceptanceRatePct: 25,
    monthlyMarginGbp: 32,
    retainedLifetimeMonths: 14,
  }
): ThresholdOptimizationResult {
  const n = actual.length;
  const curve: ThresholdOptimizationResult['expectedValueCurve'] = [];

  let bestF1 = -1;
  let f1OptimalThreshold = 0.5;

  let recall80Threshold = 0.5;
  let foundRecall80 = false;

  let maxNetBenefit = -Infinity;
  let maxNetBenefitThreshold = 0.5;

  const valueOfSavedCustomer = businessInputs.monthlyMarginGbp * businessInputs.retainedLifetimeMonths;
  const acceptanceRate = businessInputs.acceptanceRatePct / 100;

  // Evaluate across 0.05 to 0.95 in 0.02 increments
  for (let t = 0.05; t <= 0.95; t += 0.02) {
    const thresh = Math.round(t * 100) / 100;
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    for (let i = 0; i < n; i++) {
      const pred = predictedProbas[i] >= thresh ? 1 : 0;
      const y = actual[i];
      if (pred === 1 && y === 1) tp++;
      else if (pred === 1 && y === 0) fp++;
      else if (pred === 0 && y === 0) tn++;
      else if (pred === 0 && y === 1) fn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    // Financial formulas:
    // Every flagged account (TP + FP) receives the intervention offer
    const campaignCost = (tp + fp) * businessInputs.costOfOfferGbp;
    // Only true churners who accept the offer generate saved lifetime margin
    const customersSaved = tp * acceptanceRate;
    const retainedRevenue = customersSaved * valueOfSavedCustomer;
    const netBenefit = retainedRevenue - campaignCost;

    curve.push({
      threshold: thresh,
      tp,
      fp,
      tn,
      fn,
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      f1: Math.round(f1 * 1000) / 1000,
      campaignCostGbp: Math.round(campaignCost),
      retainedRevenueGbp: Math.round(retainedRevenue),
      netBenefitGbp: Math.round(netBenefit),
    });

    if (f1 > bestF1) {
      bestF1 = f1;
      f1OptimalThreshold = thresh;
    }

    if (!foundRecall80 && recall <= 0.82 && recall >= 0.78) {
      recall80Threshold = thresh;
      foundRecall80 = true;
    }

    if (netBenefit > maxNetBenefit) {
      maxNetBenefit = netBenefit;
      maxNetBenefitThreshold = thresh;
    }
  }

  return {
    currentThreshold: 0.5,
    f1OptimalThreshold,
    recall80Threshold,
    maxNetBenefitThreshold,
    expectedValueCurve: curve,
    recommendedThreshold: maxNetBenefitThreshold,
    maxNetBenefitGbp: Math.round(maxNetBenefit),
  };
}
