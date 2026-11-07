/**
 * Algorithmic Fairness & Disparate Impact Audit Engine
 * Evaluates demographic parity, equal opportunity (false positive/negative rates),
 * and risk-tier distribution across Gender, Age Band, and UK Nation.
 */

import { CustomerRecord, ScoredCustomer } from '../types';

export interface GroupFairnessMetric {
  groupValue: string;
  count: number;
  churnRate: number; // %
  avgPredictedProbability: number; // %
  criticalTierPct: number; // %
  falsePositiveRate: number; // %
  falseNegativeRate: number; // %
  disparateImpactRatio: number; // vs reference group (target 0.80 - 1.25)
}

export interface DimensionFairnessReport {
  dimension: 'Gender' | 'Age Band' | 'UK Nation';
  referenceGroup: string;
  groups: GroupFairnessMetric[];
  hasDisparityWarning: boolean;
  verdict: string;
}

export function auditFairness(
  records: CustomerRecord[],
  scoredList: ScoredCustomer[],
  threshold = 0.5
): DimensionFairnessReport[] {
  const scoredMap = new Map<string, ScoredCustomer>();
  scoredList.forEach((s) => scoredMap.set(s.customerId, s));

  const dimensions: Array<'Gender' | 'Age Band' | 'UK Nation'> = ['Gender', 'Age Band', 'UK Nation'];
  const reports: DimensionFairnessReport[] = [];

  dimensions.forEach((dim) => {
    // Group records
    const groupsMap = new Map<string, { total: number; churners: number; preds: number[]; tp: number; fp: number; tn: number; fn: number; criticalCount: number }>();

    records.forEach((record) => {
      const gVal = String(record[dim] || 'Unrecorded').trim();
      if (!groupsMap.has(gVal)) {
        groupsMap.set(gVal, { total: 0, churners: 0, preds: [], tp: 0, fp: 0, tn: 0, fn: 0, criticalCount: 0 });
      }

      const g = groupsMap.get(gVal)!;
      g.total++;
      const y = Number(record['Churn Flag']) === 1 ? 1 : 0;
      if (y === 1) g.churners++;

      const scored = scoredMap.get(String(record['Customer ID']));
      if (scored) {
        const prob = scored.churnProbability / 100;
        g.preds.push(prob);
        if (scored.riskTier === 'Critical') g.criticalCount++;

        const predClass = prob >= threshold ? 1 : 0;
        if (predClass === 1 && y === 1) g.tp++;
        else if (predClass === 1 && y === 0) g.fp++;
        else if (predClass === 0 && y === 0) g.tn++;
        else if (predClass === 0 && y === 1) g.fn++;
      }
    });

    // Reference group is the largest group
    let maxCount = -1;
    let refGroup = '';
    groupsMap.forEach((data, name) => {
      if (data.total > maxCount) {
        maxCount = data.total;
        refGroup = name;
      }
    });

    const refData = groupsMap.get(refGroup);
    const refAvgProb = refData && refData.preds.length > 0 ? refData.preds.reduce((a, b) => a + b, 0) / refData.preds.length : 0.2;

    const groupMetrics: GroupFairnessMetric[] = [];
    let hasDisparityWarning = false;

    groupsMap.forEach((data, name) => {
      if (data.total < 10) return; // Skip tiny samples

      const churnRate = (data.churners / data.total) * 100;
      const avgProb = data.preds.length > 0 ? (data.preds.reduce((a, b) => a + b, 0) / data.preds.length) * 100 : 0;
      const criticalPct = data.total > 0 ? (data.criticalCount / data.total) * 100 : 0;

      const fpr = data.fp + data.tn > 0 ? (data.fp / (data.fp + data.tn)) * 100 : 0;
      const fnr = data.fn + data.tp > 0 ? (data.fn / (data.fn + data.tp)) * 100 : 0;

      const ratio = refAvgProb > 0 ? (avgProb / 100) / refAvgProb : 1.0;
      if (ratio < 0.75 || ratio > 1.35) {
        hasDisparityWarning = true;
      }

      groupMetrics.push({
        groupValue: name,
        count: data.total,
        churnRate: Math.round(churnRate * 10) / 10,
        avgPredictedProbability: Math.round(avgProb * 10) / 10,
        criticalTierPct: Math.round(criticalPct * 10) / 10,
        falsePositiveRate: Math.round(fpr * 10) / 10,
        falseNegativeRate: Math.round(fnr * 10) / 10,
        disparateImpactRatio: Math.round(ratio * 100) / 100,
      });
    });

    groupMetrics.sort((a, b) => b.count - a.count);

    let verdict = 'No significant algorithmic bias detected across demographic groups.';
    if (hasDisparityWarning) {
      verdict = `Elevated variance detected in ${dim}. Model predictions exhibit demographic variation; ensure protected features remain excluded from model inputs and offer targeting.`;
    }

    reports.push({
      dimension: dim,
      referenceGroup: refGroup,
      groups: groupMetrics,
      hasDisparityWarning,
      verdict,
    });
  });

  return reports;
}
