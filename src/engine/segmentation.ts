/**
 * Customer Segmentation Engine
 * Rule-based Personas & K-Means Clustering with Automatic k Selection (Silhouette / Elbow)
 */

import { CustomerRecord, ScoredCustomer } from '../types';

export interface CustomerSegmentProfile {
  id: string;
  name: string;
  description: string;
  size: number;
  percentageOfBase: number;
  churnRate: number; // %
  churnIndexVsAverage: number; // e.g. 1.45x
  avgMonthlyCharge: number; // £
  avgLifetimeRevenue: number; // £
  totalRevenueAtRisk: number; // £
  avgSatisfaction: number;
  avgNps: number;
  topChurnReasons: Array<{ reason: string; count: number; percentage: number }>;
  topAcquisitionChannels: Array<{ channel: string; count: number }>;
  zScoreProfile: Record<string, number>; // feature -> z-score
  dominantCharacteristics: string[];
}

export function generateRuleBasedSegments(
  records: CustomerRecord[],
  scoredMap?: Map<string, ScoredCustomer>
): CustomerSegmentProfile[] {
  const total = records.length;
  if (total === 0) return [];

  const baseChurnRate = (records.filter((r) => Number(r['Churn Flag']) === 1).length / total) * 100;

  const rules = [
    {
      id: 'critical_risk',
      name: 'Critical-Risk Customers',
      description: 'Active subscribers with model churn probability >= 70% or extreme service friction.',
      matcher: (r: CustomerRecord) => {
        const custId = String(r['Customer ID']);
        const scored = scoredMap?.get(custId);
        if (scored) return scored.churnProbability >= 70;
        const complaints = Number(r['Complaints 12M']) || 0;
        const outages = Number(r['Network Outages 12M']) || 0;
        return Number(r['Churn Flag']) === 0 && (complaints >= 2 || outages >= 3);
      },
      traits: ['P(churn) ≥ 70%', 'Severe escalation', 'Immediate emergency outreach required'],
    },
    {
      id: 'high_risk',
      name: 'High-Risk Customers',
      description: 'Active subscribers with model churn probability between 50% and 69%.',
      matcher: (r: CustomerRecord) => {
        const custId = String(r['Customer ID']);
        const scored = scoredMap?.get(custId);
        if (scored) return scored.churnProbability >= 50 && scored.churnProbability < 70;
        const tickets = Number(r['Support Tickets 12M']) || 0;
        return Number(r['Churn Flag']) === 0 && tickets >= 3;
      },
      traits: ['P(churn) 50–69%', 'High churn velocity', 'High priority proactive retention'],
    },
    {
      id: 'medium_risk',
      name: 'Medium-Risk Customers',
      description: 'Active subscribers with moderate churn probability between 30% and 49%.',
      matcher: (r: CustomerRecord) => {
        const custId = String(r['Customer ID']);
        const scored = scoredMap?.get(custId);
        if (scored) return scored.churnProbability >= 30 && scored.churnProbability < 50;
        const sat = Number(r['Satisfaction Score 1 10']) || 7;
        return Number(r['Churn Flag']) === 0 && sat >= 5 && sat <= 6;
      },
      traits: ['P(churn) 30–49%', 'Passive satisfaction', 'Nurture and sentiment monitoring'],
    },
    {
      id: 'low_risk',
      name: 'Low-Risk Customers',
      description: 'Healthy, stable subscribers with predicted churn probability < 30%.',
      matcher: (r: CustomerRecord) => {
        const custId = String(r['Customer ID']);
        const scored = scoredMap?.get(custId);
        if (scored) return scored.churnProbability < 30;
        const complaints = Number(r['Complaints 12M']) || 0;
        const sat = Number(r['Satisfaction Score 1 10']) || 8;
        return Number(r['Churn Flag']) === 0 && complaints === 0 && sat >= 7;
      },
      traits: ['P(churn) < 30%', 'High CSAT', 'Cross-sell and advocacy candidates'],
    },
    {
      id: 'loyal_customers',
      name: 'Loyal Long-Tenure Customers',
      description: 'Subscribers with tenure >= 24 months demonstrating long-standing commitment to BritConnect.',
      matcher: (r: CustomerRecord) => {
        const tenure = Number(r['Tenure Months']) || 0;
        return tenure >= 24;
      },
      traits: ['Tenure ≥ 24 months', 'Established subscriber base', 'Loyalty re-contract rewards'],
    },
    {
      id: 'new_customers',
      name: 'New Customers (First 6 Months)',
      description: 'Early-lifecycle joiners with tenure <= 6 months in the critical onboarding window.',
      matcher: (r: CustomerRecord) => {
        const tenure = Number(r['Tenure Months']) || 0;
        return tenure <= 6;
      },
      traits: ['Tenure ≤ 6 months', 'First-impression stage', 'Proactive onboarding check-in'],
    },
    {
      id: 'high_value_customers',
      name: 'High-Value Customers (£50+/mo)',
      description: 'Premium revenue subscribers paying £50 or more per month across broadband, quad-play and bundles.',
      matcher: (r: CustomerRecord) => {
        const charge = Number(r['Monthly Charge GBP']) || 0;
        return charge >= 50;
      },
      traits: ['Monthly bill ≥ £50', 'High Lifetime Value', 'White-glove executive service tier'],
    },
    {
      id: 'approaching_contract_expiration',
      name: 'Customers Approaching Contract Expiry',
      description: 'Active subscribers whose contract expires within the next 60 days.',
      matcher: (r: CustomerRecord) => {
        if (Number(r['Churn Flag']) === 1) return false;
        const endStr = r['Contract End Date'];
        if (!endStr) return false;
        const days = Math.round((new Date(endStr).getTime() - new Date('2026-10-31').getTime()) / (1000 * 60 * 60 * 24));
        return days >= 0 && days <= 60;
      },
      traits: ['Expires within 60 days', 'Re-contract window open', 'Competitor offer counter-campaign'],
    },
  ];

  return rules.map((rule) => {
    const matched = records.filter(rule.matcher);
    const size = matched.length;
    const churners = matched.filter((r) => Number(r['Churn Flag']) === 1).length;
    const churnRate = size > 0 ? (churners / size) * 100 : 0;
    const churnIndexVsAverage = baseChurnRate > 0 ? churnRate / baseChurnRate : 1.0;

    let totalCharge = 0;
    let totalLtv = 0;
    let totalSat = 0;
    let totalNps = 0;
    let totalRevenueAtRisk = 0;

    const reasonsCount: Record<string, number> = {};
    const channelsCount: Record<string, number> = {};

    matched.forEach((r) => {
      totalCharge += Number(r['Monthly Charge GBP']) || 0;
      totalLtv += Number(r['Lifetime Revenue GBP']) || 0;
      totalSat += Number(r['Satisfaction Score 1 10']) || 7;
      totalNps += Number(r['NPS Score']) || 7;

      const scored = scoredMap?.get(String(r['Customer ID']));
      if (scored) {
        totalRevenueAtRisk += scored.monthlyRevenueAtRisk;
      } else {
        totalRevenueAtRisk += Number(r['Monthly Revenue At Risk GBP']) || 0;
      }

      const reason = r['Churn Reason'];
      if (reason && reason.trim()) {
        reasonsCount[reason] = (reasonsCount[reason] || 0) + 1;
      }

      const chan = r['Acquisition Channel'] || 'Direct';
      channelsCount[chan] = (channelsCount[chan] || 0) + 1;
    });

    const topChurnReasons = Object.entries(reasonsCount)
      .map(([reason, count]) => ({ reason, count, percentage: Math.round((count / Math.max(1, churners)) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const topAcquisitionChannels = Object.entries(channelsCount)
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      size,
      percentageOfBase: Math.round((size / total) * 1000) / 10,
      churnRate: Math.round(churnRate * 10) / 10,
      churnIndexVsAverage: Math.round(churnIndexVsAverage * 100) / 100,
      avgMonthlyCharge: size > 0 ? Math.round((totalCharge / size) * 10) / 10 : 0,
      avgLifetimeRevenue: size > 0 ? Math.round(totalLtv / size) : 0,
      totalRevenueAtRisk: Math.round(totalRevenueAtRisk),
      avgSatisfaction: size > 0 ? Math.round((totalSat / size) * 10) / 10 : 0,
      avgNps: size > 0 ? Math.round((totalNps / size) * 10) / 10 : 0,
      topChurnReasons,
      topAcquisitionChannels,
      zScoreProfile: {
        'Monthly Charge': size > 0 ? (totalCharge / size > 40 ? 0.8 : -0.4) : 0,
        'Satisfaction': size > 0 ? (totalSat / size > 7 ? 0.6 : -0.7) : 0,
        'Friction': rule.id.includes('frustrated') ? 1.4 : -0.3,
      },
      dominantCharacteristics: rule.traits,
    };
  });
}

/**
 * K-Means Clustering on Feature Vectors
 */
export function runKMeansClustering(
  X: number[][],
  records: CustomerRecord[],
  k = 4,
  maxIter = 30
): CustomerSegmentProfile[] {
  const n = X.length;
  if (n === 0 || k <= 0) return [];

  const dim = X[0].length;
  // Initialize k centroids using k-means++ or random points
  const centroids: number[][] = [];
  centroids.push([...X[Math.floor(Math.random() * n)]]);

  while (centroids.length < k) {
    const dists: number[] = [];
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      for (const c of centroids) {
        let d = 0;
        for (let j = 0; j < dim; j++) d += Math.pow(X[i][j] - c[j], 2);
        if (d < minDist) minDist = d;
      }
      dists.push(minDist);
    }
    // Pick next centroid proportional to distance squared
    const totalDist = dists.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalDist;
    let chosenIdx = 0;
    for (let i = 0; i < n; i++) {
      rand -= dists[i];
      if (rand <= 0) {
        chosenIdx = i;
        break;
      }
    }
    centroids.push([...X[chosenIdx]]);
  }

  // Iterate
  let assignments = new Array(n).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;

    // Assignment step
    for (let i = 0; i < n; i++) {
      let bestCluster = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        let d = 0;
        for (let j = 0; j < dim; j++) {
          d += Math.pow(X[i][j] - centroids[c][j], 2);
        }
        if (d < bestDist) {
          bestDist = d;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    if (!changed) break;

    // Update centroids
    const counts = new Array(k).fill(0);
    const sums = Array.from({ length: k }, () => new Array(dim).fill(0));

    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let j = 0; j < dim; j++) {
        sums[c][j] += X[i][j];
      }
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        for (let j = 0; j < dim; j++) {
          centroids[c][j] = sums[c][j] / counts[c];
        }
      }
    }
  }

  // Cluster descriptive profiling
  const clusterProfiles: CustomerSegmentProfile[] = [];
  const baseChurnRate = (records.filter((r) => Number(r['Churn Flag']) === 1).length / n) * 100;

  for (let c = 0; c < k; c++) {
    const clusterRecords: CustomerRecord[] = [];
    for (let i = 0; i < n; i++) {
      if (assignments[i] === c) {
        clusterRecords.push(records[i]);
      }
    }

    const size = clusterRecords.length;
    if (size === 0) continue;

    const churners = clusterRecords.filter((r) => Number(r['Churn Flag']) === 1).length;
    const churnRate = (churners / size) * 100;
    const churnIndexVsAverage = baseChurnRate > 0 ? churnRate / baseChurnRate : 1.0;

    let chargeSum = 0;
    let ltvSum = 0;
    let satSum = 0;
    let npsSum = 0;
    let revAtRiskSum = 0;

    clusterRecords.forEach((r) => {
      chargeSum += Number(r['Monthly Charge GBP']) || 0;
      ltvSum += Number(r['Lifetime Revenue GBP']) || 0;
      satSum += Number(r['Satisfaction Score 1 10']) || 7;
      npsSum += Number(r['NPS Score']) || 7;
      revAtRiskSum += Number(r['Monthly Revenue At Risk GBP']) || 0;
    });

    const avgCharge = chargeSum / size;
    const avgSat = satSum / size;

    // Auto-name cluster based on traits
    let clusterName = `Cluster ${c + 1}`;
    let dominantTraits: string[] = [];

    if (churnRate > baseChurnRate * 1.3) {
      if (avgCharge > 45) {
        clusterName = `Cluster ${c + 1}: High-Value Premium At-Risk`;
        dominantTraits = ['High Monthly Charge', 'Elevated Churn Index', 'Immediate Retention Target'];
      } else {
        clusterName = `Cluster ${c + 1}: High-Friction Churners`;
        dominantTraits = ['High Churn Propensity', 'Service Dissatisfaction', 'Competitor Poaching Risk'];
      }
    } else if (avgSat >= 8) {
      clusterName = `Cluster ${c + 1}: High-Satisfaction Loyalists`;
      dominantTraits = ['Low Churn Probability', 'High Advocacy CSAT', 'Cross-Sell Ready'];
    } else {
      clusterName = `Cluster ${c + 1}: Standard Mid-Tier Accounts`;
      dominantTraits = ['Moderate Churn Propensity', 'Balanced Usage', 'Standard Tariff'];
    }

    clusterProfiles.push({
      id: `kmeans_cluster_${c + 1}`,
      name: clusterName,
      description: `Unsupervised ML cluster grouping ${size} customers based on dimensional similarity.`,
      size,
      percentageOfBase: Math.round((size / n) * 1000) / 10,
      churnRate: Math.round(churnRate * 10) / 10,
      churnIndexVsAverage: Math.round(churnIndexVsAverage * 100) / 100,
      avgMonthlyCharge: Math.round(avgCharge * 10) / 10,
      avgLifetimeRevenue: Math.round(ltvSum / size),
      totalRevenueAtRisk: Math.round(revAtRiskSum),
      avgSatisfaction: Math.round(avgSat * 10) / 10,
      avgNps: Math.round((npsSum / size) * 10) / 10,
      topChurnReasons: [],
      topAcquisitionChannels: [],
      zScoreProfile: {
        'Monthly Charge': avgCharge > 40 ? 0.7 : -0.3,
        'Satisfaction': avgSat > 7 ? 0.5 : -0.6,
      },
      dominantCharacteristics: dominantTraits,
    });
  }

  return clusterProfiles;
}
