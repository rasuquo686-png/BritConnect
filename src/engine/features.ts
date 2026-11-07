/**
 * Feature Engineering Engine & Feature Catalogue
 * Transforms cleaned records into ML-ready numerical matrices with feature tracking.
 */

import { CustomerRecord, EngineeredFeatures } from '../types';

export interface FeatureCatalogueItem {
  name: string;
  category: 'Lifecycle' | 'Pricing & Value' | 'Payment Risk' | 'Service Friction' | 'Sentiment' | 'Interaction' | 'Categorical';
  formula: string;
  description: string;
  missingPct: number;
  importance?: number;
}

export interface PreparedDataset {
  featureNames: string[];
  featureMatrix: number[][]; // X
  targets: number[]; // y (0 or 1)
  records: CustomerRecord[];
  featureCatalogue: FeatureCatalogueItem[];
  highCardinalityMaps: {
    cityTargetMap: Record<string, number>;
    planTargetMap: Record<string, number>;
  };
  scalerMeans: number[];
  scalerStds: number[];
}

export function engineerCustomerFeatures(
  record: CustomerRecord,
  asOfDateStr = '2026-10-31',
  segmentPlanMedians: Record<string, number> = {},
  resolutionP75 = 24.0
): EngineeredFeatures {
  const asOfDate = new Date(asOfDateStr);

  // 1. Tenure & Lifecycle
  const tenure = Number(record['Tenure Months']) || 0;
  let tenureBucket = '0-6';
  if (tenure > 48) tenureBucket = '48+';
  else if (tenure > 24) tenureBucket = '25-48';
  else if (tenure > 12) tenureBucket = '13-24';
  else if (tenure > 6) tenureBucket = '7-12';

  let daysToContractEnd: number | null = null;
  let isOutOfContract = 0;
  let contractExpiring30 = 0;
  let contractExpiring60 = 0;
  let contractExpiring90 = 0;
  let monthsInContract = 0;

  if (record['Contract End Date']) {
    const endDate = new Date(record['Contract End Date']);
    if (!isNaN(endDate.getTime())) {
      const diffMs = endDate.getTime() - asOfDate.getTime();
      daysToContractEnd = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (daysToContractEnd < 0) {
        isOutOfContract = 1;
      } else {
        if (daysToContractEnd <= 30) contractExpiring30 = 1;
        if (daysToContractEnd <= 60) contractExpiring60 = 1;
        if (daysToContractEnd <= 90) contractExpiring90 = 1;
      }
    }
  }

  if (record['Contract Start Date']) {
    const startDate = new Date(record['Contract Start Date']);
    if (!isNaN(startDate.getTime())) {
      monthsInContract = Math.max(0, Math.round((asOfDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)));
    }
  }

  // 2. Pricing & Value
  const charge = Number(record['Monthly Charge GBP']) || 35.0;
  const discountPct = Number(record['Discount Percent']) || 0;
  const effectiveMonthlyCharge = Math.max(0, charge * (1 - discountPct / 100));

  const segPlanKey = `${record['Customer Segment'] || 'Consumer'}_${record['Plan Name'] || ''}`;
  const medianPrice = segmentPlanMedians[segPlanKey] || charge;
  const priceVsSegmentMedian = medianPrice > 0 ? charge / medianPrice : 1.0;

  const discountExpiryRisk = discountPct > 15 && daysToContractEnd !== null && daysToContractEnd <= 60 ? 1 : 0;
  const overage = Number(record['Overage Charges GBP']) || 0;
  const overageRatio = charge > 0 ? overage / charge : 0;

  const usage = Number(record['Average Monthly Usage GB']) || 0;
  const allowance = Number(record['Data Allowance GB']) || 0;
  let usageUtilisation = 1.0;
  let isOverAllowance = 0;
  let isUnderUsed = 0;

  if (allowance > 0 && allowance < 999) {
    usageUtilisation = Math.min(3.0, usage / allowance);
    if (usage > allowance) isOverAllowance = 1;
    if (usageUtilisation < 0.3) isUnderUsed = 1;
  }

  const revenuePerTenureMonth = tenure > 0 ? (Number(record['Lifetime Revenue GBP']) || (effectiveMonthlyCharge * tenure)) / tenure : effectiveMonthlyCharge;

  // 3. Payment Risk
  const late = Number(record['Late Payments 12M']) || 0;
  const failed = Number(record['Failed Payments 12M']) || 0;
  const paymentStressScore = late * 1.0 + failed * 2.5;
  const hasAnyFailedPayment = failed > 0 ? 1 : 0;
  const nonDirectDebit = String(record['Direct Debit']).toLowerCase() === 'no' ? 1 : 0;

  // 4. Service Friction Index
  const tickets = Number(record['Support Tickets 12M']) || 0;
  const complaints = Number(record['Complaints 12M']) || 0;
  const resolutionHours = Number(record['Average Resolution Hours']) || 0;
  const outages = Number(record['Network Outages 12M']) || 0;

  const tenureYears = Math.max(1, tenure / 12);
  const ticketsPerTenureYear = tickets / tenureYears;
  const complaintRate = complaints / Math.max(1, tickets);
  const resolutionSlowFlag = resolutionHours > resolutionP75 ? 1 : 0;
  const outageExposure = outages;

  // Composite friction: tickets + 2*complaints + 1.5*outages + resolutionSlow
  const serviceFrictionIndex = (tickets * 0.8) + (complaints * 2.2) + (outages * 1.8) + (resolutionSlowFlag * 1.5);

  // 5. Sentiment
  const sat = Number(record['Satisfaction Score 1 10']) || 7;
  let satisfactionBucket = 'Moderate';
  if (sat <= 4) satisfactionBucket = 'Low';
  else if (sat >= 8) satisfactionBucket = 'High';

  const rawNps = Number(record['NPS Score']);
  let npsCategory: 'Detractor' | 'Passive' | 'Promoter' = 'Passive';
  if (!isNaN(rawNps)) {
    // Detect scale: 0-10 vs -100..100
    if (rawNps > 10 || rawNps < 0) {
      if (rawNps <= 0) npsCategory = 'Detractor';
      else if (rawNps >= 50) npsCategory = 'Promoter';
      else npsCategory = 'Passive';
    } else {
      if (rawNps <= 6) npsCategory = 'Detractor';
      else if (rawNps >= 9) npsCategory = 'Promoter';
      else npsCategory = 'Passive';
    }
  }

  // Sentiment gap: sat is high but NPS is detractor (or vice versa)
  const sentimentGap = (sat >= 8 && npsCategory === 'Detractor') || (sat <= 4 && npsCategory === 'Promoter') ? 1 : 0;

  // 6. Competitive & Interactions
  const competitorOfferFlag = String(record['Competitor Offer Received']).toLowerCase() === 'yes' ? 1 : 0;
  const competitorAndOutOfContract = competitorOfferFlag * isOutOfContract;
  const lowSatHighPrice = sat <= 4 && priceVsSegmentMedian > 1.15 ? 1 : 0;
  const outageAndComplaint = outages > 1 && complaints > 0 ? 1 : 0;
  const autoRenewNo = String(record['Auto Renew']).toLowerCase() === 'no' ? 1 : 0;
  const outOfContractNoAutoRenew = isOutOfContract * autoRenewNo;

  return {
    tenureBucket,
    monthsInContract,
    daysToContractEnd,
    isOutOfContract,
    contractExpiring30,
    contractExpiring60,
    contractExpiring90,
    priceVsSegmentMedian,
    effectiveMonthlyCharge,
    discountExpiryRisk,
    overageRatio,
    usageUtilisation,
    isOverAllowance,
    isUnderUsed,
    revenuePerTenureMonth,
    paymentStressScore,
    hasAnyFailedPayment,
    nonDirectDebit,
    ticketsPerTenureYear,
    complaintRate,
    resolutionSlowFlag,
    outageExposure,
    serviceFrictionIndex,
    satisfactionBucket,
    npsCategory,
    sentimentGap,
    competitorOfferFlag,
    competitorAndOutOfContract,
    lowSatHighPrice,
    outageAndComplaint,
    outOfContractNoAutoRenew,
    serviceType: String(record['Service Type'] || 'Unknown'),
    contractType: String(record['Contract Type'] || 'Unknown'),
    customerSegment: String(record['Customer Segment'] || 'Consumer'),
    ukNation: String(record['UK Nation'] || 'England'),
  };
}

/**
 * Builds the numeric training matrix, target vector, and feature catalogue
 */
export function prepareModelData(
  records: CustomerRecord[],
  excludeProtected = true,
  asOfDateStr = '2026-10-31'
): PreparedDataset {
  // Precompute segment-plan medians
  const groupPrices: Record<string, number[]> = {};
  const resHours: number[] = [];

  records.forEach((r) => {
    const key = `${r['Customer Segment'] || 'Consumer'}_${r['Plan Name'] || ''}`;
    const price = Number(r['Monthly Charge GBP']);
    if (!isNaN(price)) {
      if (!groupPrices[key]) groupPrices[key] = [];
      groupPrices[key].push(price);
    }
    const rh = Number(r['Average Resolution Hours']);
    if (!isNaN(rh)) resHours.push(rh);
  });

  const segmentPlanMedians: Record<string, number> = {};
  for (const [k, arr] of Object.entries(groupPrices)) {
    arr.sort((a, b) => a - b);
    segmentPlanMedians[k] = arr[Math.floor(arr.length / 2)];
  }

  resHours.sort((a, b) => a - b);
  const resolutionP75 = resHours.length > 0 ? resHours[Math.floor(resHours.length * 0.75)] : 24.0;

  // Target-aware smoothed encoding for City and Plan Name
  const cityTargets: Record<string, { sum: number; count: number }> = {};
  const planTargets: Record<string, { sum: number; count: number }> = {};
  let globalChurnSum = 0;

  records.forEach((r) => {
    const flag = Number(r['Churn Flag']) === 1 ? 1 : 0;
    globalChurnSum += flag;
    const city = String(r['City'] || 'Other');
    const plan = String(r['Plan Name'] || 'Other');

    if (!cityTargets[city]) cityTargets[city] = { sum: 0, count: 0 };
    cityTargets[city].sum += flag;
    cityTargets[city].count += 1;

    if (!planTargets[plan]) planTargets[plan] = { sum: 0, count: 0 };
    planTargets[plan].sum += flag;
    planTargets[plan].count += 1;
  });

  const globalChurnRate = records.length > 0 ? globalChurnSum / records.length : 0.18;
  const smoothingWeight = 10;

  const cityTargetMap: Record<string, number> = {};
  for (const [c, obj] of Object.entries(cityTargets)) {
    cityTargetMap[c] = (obj.sum + smoothingWeight * globalChurnRate) / (obj.count + smoothingWeight);
  }

  const planTargetMap: Record<string, number> = {};
  for (const [p, obj] of Object.entries(planTargets)) {
    planTargetMap[p] = (obj.sum + smoothingWeight * globalChurnRate) / (obj.count + smoothingWeight);
  }

  // Feature definition list (explicitly excluding leakage features and optionally protected attributes)
  const featureDefinitions: Array<{
    name: string;
    category: FeatureCatalogueItem['category'];
    formula: string;
    description: string;
    extract: (f: EngineeredFeatures, r: CustomerRecord) => number;
  }> = [
    { name: 'is_out_of_contract', category: 'Lifecycle', formula: 'daysToContractEnd < 0', description: 'Flag if customer contract term has expired', extract: (f) => f.isOutOfContract },
    { name: 'contract_expiring_60d', category: 'Lifecycle', formula: '0 <= daysToContractEnd <= 60', description: 'Contract scheduled to expire within 60 days', extract: (f) => f.contractExpiring60 },
    { name: 'months_in_contract', category: 'Lifecycle', formula: 'Months elapsed in current contract', description: 'Contract elapsed duration in months', extract: (f) => f.monthsInContract },
    { name: 'tenure_months', category: 'Lifecycle', formula: 'Tenure Months', description: 'Length of relationship with BritConnect in months', extract: (f, r) => Number(r['Tenure Months']) || 0 },
    { name: 'effective_monthly_charge', category: 'Pricing & Value', formula: 'Monthly Charge × (1 − Discount %)', description: 'Net monthly recurring revenue collected from customer', extract: (f) => f.effectiveMonthlyCharge },
    { name: 'price_vs_segment_median', category: 'Pricing & Value', formula: 'Charge ÷ Median Segment-Plan Charge', description: 'Relative price premium compared to peer subscribers', extract: (f) => f.priceVsSegmentMedian },
    { name: 'discount_expiry_risk', category: 'Pricing & Value', formula: 'Discount > 15% AND Contract Expiring <= 60d', description: 'Risk of price shock when promotional tariff rolls off', extract: (f) => f.discountExpiryRisk },
    { name: 'overage_ratio', category: 'Pricing & Value', formula: 'Overage Charges ÷ Monthly Charge', description: 'Bill shock factor from unexpected data usage charges', extract: (f) => f.overageRatio },
    { name: 'usage_utilisation', category: 'Pricing & Value', formula: 'Avg Usage ÷ Data Allowance', description: 'Subscription quota utilisation ratio (capped at 3.0)', extract: (f) => f.usageUtilisation },
    { name: 'payment_stress_score', category: 'Payment Risk', formula: '1 × Late Payments + 2.5 × Failed Payments', description: 'Weighted financial stress index over the past 12 months', extract: (f) => f.paymentStressScore },
    { name: 'has_failed_payment', category: 'Payment Risk', formula: 'Failed Payments 12M > 0', description: 'Customer experienced at least one direct debit/payment failure', extract: (f) => f.hasAnyFailedPayment },
    { name: 'non_direct_debit', category: 'Payment Risk', formula: 'Direct Debit == No', description: 'Higher-risk manual or credit card payment billing', extract: (f) => f.nonDirectDebit },
    { name: 'service_friction_index', category: 'Service Friction', formula: '0.8×Tickets + 2.2×Complaints + 1.8×Outages + 1.5×SlowResolution', description: 'Standardised composite customer operational friction metric', extract: (f) => f.serviceFrictionIndex },
    { name: 'complaints_12m', category: 'Service Friction', formula: 'Complaints 12M', description: 'Formal customer complaints lodged over 12 months', extract: (f, r) => Number(r['Complaints 12M']) || 0 },
    { name: 'support_tickets_12m', category: 'Service Friction', formula: 'Support Tickets 12M', description: 'Customer care service requests submitted', extract: (f, r) => Number(r['Support Tickets 12M']) || 0 },
    { name: 'network_outages_12m', category: 'Service Friction', formula: 'Network Outages 12M', description: 'Local network or broadband service interruptions experienced', extract: (f, r) => Number(r['Network Outages 12M']) || 0 },
    { name: 'satisfaction_score', category: 'Sentiment', formula: 'Satisfaction Score 1–10', description: 'Direct customer satisfaction rating', extract: (f, r) => Number(r['Satisfaction Score 1 10']) || 7 },
    { name: 'is_nps_detractor', category: 'Sentiment', formula: 'NPS in Detractor band (<=6 or <=0)', description: 'Active customer advocacy detractor flag', extract: (f) => (f.npsCategory === 'Detractor' ? 1 : 0) },
    { name: 'competitor_offer_received', category: 'Interaction', formula: 'Competitor Offer Received == Yes', description: 'Customer confirmed receiving rival telecom promotion', extract: (f) => f.competitorOfferFlag },
    { name: 'competitor_x_out_of_contract', category: 'Interaction', formula: 'Competitor Offer × Is Out of Contract', description: 'High-risk interaction of competitor poaching out-of-contract customer', extract: (f) => f.competitorAndOutOfContract },
    { name: 'low_sat_x_high_price', category: 'Interaction', formula: 'Low Satisfaction (<=4) × Price Ratio > 1.15', description: 'Subscriber dissatisfaction compounded by high monthly cost', extract: (f) => f.lowSatHighPrice },
    { name: 'outage_x_complaint', category: 'Interaction', formula: 'Outages > 1 × Complaints > 0', description: 'Network outage converted into formal customer complaint', extract: (f) => f.outageAndComplaint },
    { name: 'out_of_contract_no_autorenew', category: 'Interaction', formula: 'Is Out of Contract × Auto Renew No', description: 'Uncontracted customer with disabled renewal clause', extract: (f) => f.outOfContractNoAutoRenew },
    
    // Categorical Encodings
    { name: 'encoded_city_churn_rate', category: 'Categorical', formula: 'Smoothed Empirical Target Rate(City)', description: 'Bayesian-smoothed target churn rate for customer city', extract: (f, r) => cityTargetMap[String(r['City'] || 'Other')] ?? globalChurnRate },
    { name: 'encoded_plan_churn_rate', category: 'Categorical', formula: 'Smoothed Empirical Target Rate(Plan Name)', description: 'Bayesian-smoothed target churn rate for subscription plan', extract: (f, r) => planTargetMap[String(r['Plan Name'] || 'Other')] ?? globalChurnRate },
    { name: 'service_is_bundle', category: 'Categorical', formula: 'Service Type includes Bundle or Quad', description: 'Multi-play broadband/mobile bundle subscriber', extract: (f) => (f.serviceType.includes('Bundle') || f.serviceType.includes('Quad') ? 1 : 0) },
    { name: 'service_is_mobile_only', category: 'Categorical', formula: 'Service Type == Mobile Only', description: 'Standalone mobile SIM customer', extract: (f) => (f.serviceType === 'Mobile Only' ? 1 : 0) },
    { name: 'segment_is_small_biz', category: 'Categorical', formula: 'Customer Segment == Small Business', description: 'B2B Small Business account classification', extract: (f) => (f.customerSegment === 'Small Business' ? 1 : 0) },
  ];

  // If user allows protected attributes, add Age and Gender
  if (!excludeProtected) {
    featureDefinitions.push(
      { name: 'customer_age', category: 'Lifecycle', formula: 'Age', description: 'Customer age in years (Protected attribute)', extract: (f, r) => Number(r['Age']) || 42 }
    );
  }

  const featureNames = featureDefinitions.map((d) => d.name);
  const featureMatrix: number[][] = [];
  const targets: number[] = [];

  // Extract vectors
  records.forEach((record) => {
    const engineered = engineerCustomerFeatures(record, asOfDateStr, segmentPlanMedians, resolutionP75);
    const rowVec = featureDefinitions.map((def) => def.extract(engineered, record));
    featureMatrix.push(rowVec);
    targets.push(Number(record['Churn Flag']) === 1 ? 1 : 0);
  });

  // Calculate means and stds for standardisation
  const colCount = featureNames.length;
  const scalerMeans = new Array(colCount).fill(0);
  const scalerStds = new Array(colCount).fill(1);

  if (featureMatrix.length > 0) {
    for (let j = 0; j < colCount; j++) {
      let sum = 0;
      for (let i = 0; i < featureMatrix.length; i++) {
        sum += featureMatrix[i][j];
      }
      const mean = sum / featureMatrix.length;
      scalerMeans[j] = mean;

      let varSum = 0;
      for (let i = 0; i < featureMatrix.length; i++) {
        varSum += Math.pow(featureMatrix[i][j] - mean, 2);
      }
      const std = Math.sqrt(varSum / featureMatrix.length);
      scalerStds[j] = std > 1e-6 ? std : 1.0;
    }
  }

  const featureCatalogue: FeatureCatalogueItem[] = featureDefinitions.map((def) => ({
    name: def.name,
    category: def.category,
    formula: def.formula,
    description: def.description,
    missingPct: 0,
  }));

  return {
    featureNames,
    featureMatrix,
    targets,
    records,
    featureCatalogue,
    highCardinalityMaps: {
      cityTargetMap,
      planTargetMap,
    },
    scalerMeans,
    scalerStds,
  };
}
