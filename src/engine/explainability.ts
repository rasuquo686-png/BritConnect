/**
 * Global and Local Explainability Engine
 * Permutation importance, feature directionality, Partial Dependence Plots (PDP),
 * and SHAP-style local contribution waterfalls.
 */

export interface GlobalDriver {
  feature: string;
  label: string;
  importance: number; // 0 to 1
  direction: 'increases_churn' | 'decreases_churn';
  description: string;
}

export interface PartialDependenceData {
  feature: string;
  label: string;
  points: Array<{ value: number; avgProbability: number }>;
}

export interface LocalContribution {
  feature: string;
  label: string;
  featureValue: any;
  contribution: number; // Delta probability from base rate
  direction: 'up' | 'down';
  description: string;
}

export interface CustomerExplanation {
  customerId: string;
  baseProbability: number;
  finalProbability: number;
  contributions: LocalContribution[];
  plainEnglishSummary: string;
}

const FEATURE_LABELS: Record<string, string> = {
  is_out_of_contract: 'Out of Contract Status',
  contract_expiring_60d: 'Contract Expiring Within 60 Days',
  months_in_contract: 'Contract Elapsed Duration',
  tenure_months: 'Tenure Length',
  effective_monthly_charge: 'Monthly Tariff (£)',
  price_vs_segment_median: 'Price Premium vs Segment Median',
  discount_expiry_risk: 'Expiring Promotional Discount',
  overage_ratio: 'Data Overage Ratio',
  usage_utilisation: 'Data Allowance Utilisation',
  payment_stress_score: 'Payment Stress Index (Late/Failed)',
  has_failed_payment: 'Recent Payment Failure',
  non_direct_debit: 'Non-Direct Debit Billing',
  service_friction_index: 'Service Friction Index',
  complaints_12m: 'Formal Complaints (12M)',
  support_tickets_12m: 'Support Tickets (12M)',
  network_outages_12m: 'Broadband/Mobile Outages (12M)',
  satisfaction_score: 'Satisfaction Score (1–10)',
  is_nps_detractor: 'NPS Detractor Rating',
  competitor_offer_received: 'Competitor Offer Received',
  competitor_x_out_of_contract: 'Competitor Poaching × Out of Contract',
  low_sat_x_high_price: 'Low Satisfaction × High Price',
  outage_x_complaint: 'Outage Escalated to Complaint',
  out_of_contract_no_autorenew: 'Out of Contract × No Auto-Renew',
  encoded_city_churn_rate: 'Regional Churn Vulnerability',
  encoded_plan_churn_rate: 'Plan Churn Benchmark',
  service_is_bundle: 'Broadband & Mobile Bundle',
  service_is_mobile_only: 'Mobile-Only SIM',
  segment_is_small_biz: 'Small Business Classification',
};

/**
 * Computes model-agnostic Permutation Importance on validation set
 */
export function computePermutationImportance(
  model: { predictProba: (x: number[]) => number },
  X: number[][],
  y: number[],
  featureNames: string[]
): GlobalDriver[] {
  const n = X.length;
  if (n === 0) return [];

  // Baseline Brier Loss
  let baseLoss = 0;
  for (let i = 0; i < n; i++) {
    const p = model.predictProba(X[i]);
    baseLoss += Math.pow(p - y[i], 2);
  }
  baseLoss /= n;

  const drivers: GlobalDriver[] = [];

  featureNames.forEach((featName, colIdx) => {
    // Permute column values
    const permutedCol = X.map((row) => row[colIdx]);
    for (let i = permutedCol.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [permutedCol[i], permutedCol[j]] = [permutedCol[j], permutedCol[i]];
    }

    let permutedLoss = 0;
    for (let i = 0; i < n; i++) {
      const rowCopy = [...X[i]];
      rowCopy[colIdx] = permutedCol[i];
      const p = model.predictProba(rowCopy);
      permutedLoss += Math.pow(p - y[i], 2);
    }
    permutedLoss /= n;

    const importance = Math.max(0, permutedLoss - baseLoss);

    // Directionality check: compare average probability for top quartile vs bottom quartile
    const colVals = X.map((r) => r[colIdx]).sort((a, b) => a - b);
    const q25 = colVals[Math.floor(colVals.length * 0.25)];
    const q75 = colVals[Math.floor(colVals.length * 0.75)];

    let pHigh = 0;
    let nHigh = 0;
    let pLow = 0;
    let nLow = 0;

    for (let i = 0; i < n; i++) {
      if (X[i][colIdx] >= q75) {
        pHigh += model.predictProba(X[i]);
        nHigh++;
      } else if (X[i][colIdx] <= q25) {
        pLow += model.predictProba(X[i]);
        nLow++;
      }
    }

    const avgHigh = nHigh > 0 ? pHigh / nHigh : 0.5;
    const avgLow = nLow > 0 ? pLow / nLow : 0.5;
    const direction: 'increases_churn' | 'decreases_churn' = avgHigh >= avgLow ? 'increases_churn' : 'decreases_churn';

    drivers.push({
      feature: featName,
      label: FEATURE_LABELS[featName] || featName,
      importance: Math.round(importance * 10000) / 10000,
      direction,
      description: direction === 'increases_churn' ? 'Higher values elevate churn risk' : 'Higher values protect and retain customers',
    });
  });

  // Normalize importance to sum to 1.0
  const totalImp = drivers.reduce((sum, d) => sum + d.importance, 0) || 1;
  drivers.forEach((d) => {
    d.importance = Math.round((d.importance / totalImp) * 1000) / 1000;
  });

  drivers.sort((a, b) => b.importance - a.importance);
  return drivers;
}

/**
 * Computes Partial Dependence Plots (PDP) for top numerical features
 */
export function computePartialDependence(
  model: { predictProba: (x: number[]) => number },
  X: number[][],
  featureNames: string[],
  targetFeatures: string[]
): PartialDependenceData[] {
  const n = Math.min(X.length, 300); // Subsample for fast evaluation
  const results: PartialDependenceData[] = [];

  targetFeatures.forEach((feat) => {
    const colIdx = featureNames.indexOf(feat);
    if (colIdx === -1) return;

    const vals = X.map((r) => r[colIdx]).sort((a, b) => a - b);
    const minVal = vals[0] || 0;
    const maxVal = vals[vals.length - 1] || 1;
    const step = (maxVal - minVal) / 10;

    const points: Array<{ value: number; avgProbability: number }> = [];

    for (let stepIdx = 0; stepIdx <= 10; stepIdx++) {
      const gridVal = minVal + stepIdx * step;
      let probSum = 0;

      for (let i = 0; i < n; i++) {
        const rowCopy = [...X[i]];
        rowCopy[colIdx] = gridVal;
        probSum += model.predictProba(rowCopy);
      }

      points.push({
        value: Math.round(gridVal * 10) / 10,
        avgProbability: Math.round((probSum / n) * 1000) / 10, // as percentage 0-100
      });
    }

    results.push({
      feature: feat,
      label: FEATURE_LABELS[feat] || feat,
      points,
    });
  });

  return results;
}

/**
 * Explains an individual customer's prediction using baseline marginal substitution (SHAP-style waterfall)
 */
export function explainCustomerPrediction(
  model: { predictProba: (x: number[]) => number },
  customerVec: number[],
  baselineMeanVec: number[],
  featureNames: string[],
  customerId: string
): CustomerExplanation {
  const baseProbability = model.predictProba(baselineMeanVec);
  const finalProbability = model.predictProba(customerVec);

  const contributions: LocalContribution[] = [];

  // Marginal contribution of each feature compared to population baseline
  featureNames.forEach((feat, idx) => {
    const singlePerturbed = [...baselineMeanVec];
    singlePerturbed[idx] = customerVec[idx];
    const marginalProb = model.predictProba(singlePerturbed);
    const delta = marginalProb - baseProbability;

    if (Math.abs(delta) > 0.003) {
      contributions.push({
        feature: feat,
        label: FEATURE_LABELS[feat] || feat,
        featureValue: Math.round(customerVec[idx] * 100) / 100,
        contribution: Math.round(delta * 1000) / 10, // percentage points delta
        direction: delta >= 0 ? 'up' : 'down',
        description: delta >= 0 ? 'Elevates churn likelihood' : 'Lowers churn likelihood',
      });
    }
  });

  // Sort by absolute contribution descending
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const topContributions = contributions.slice(0, 8);

  // Generate plain-English explanation
  const topRiskFactors = topContributions.filter((c) => c.direction === 'up').slice(0, 3);
  const topProtectiveFactors = topContributions.filter((c) => c.direction === 'down').slice(0, 2);

  let plainEnglishSummary = '';
  if (topRiskFactors.length > 0) {
    const riskPhrases = topRiskFactors.map((r) => `${r.label} (+${r.contribution.toFixed(1)}%)`).join(', ');
    plainEnglishSummary = `Churn risk is driven primarily by: ${riskPhrases}.`;
  }
  if (topProtectiveFactors.length > 0) {
    const protectPhrases = topProtectiveFactors.map((p) => `${p.label} (${p.contribution.toFixed(1)}%)`).join(', ');
    plainEnglishSummary += ` Mitigated partially by: ${protectPhrases}.`;
  }

  return {
    customerId,
    baseProbability: Math.round(baseProbability * 1000) / 10,
    finalProbability: Math.round(finalProbability * 1000) / 10,
    contributions: topContributions,
    plainEnglishSummary: plainEnglishSummary || 'Customer risk is balanced near the population baseline.',
  };
}
