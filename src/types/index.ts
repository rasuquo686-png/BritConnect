/**
 * Authoritative Data Schema and Types for BritConnect Churn Intelligence Platform
 */

export interface CustomerRecord {
  // Required Core
  'Customer ID': string;
  'Churn Flag': number; // 0 or 1
  'Churn Status': 'Active' | 'Churned' | string;

  // Demographics & Geography
  'Customer Segment'?: string;
  'Age'?: number;
  'Age Band'?: string;
  'Gender'?: string;
  'UK Nation'?: string;
  'City'?: string;
  'Acquisition Channel'?: string;

  // Account & Contracts
  'Join Date'?: string; // ISO format or YYYY-MM-DD
  'Tenure Months'?: number;
  'Service Type'?: string;
  'Plan Name'?: string;
  'Contract Type'?: string;
  'Contract Start Date'?: string;
  'Contract End Date'?: string;
  'Auto Renew'?: string; // Yes / No

  // Financials & Usage
  'Monthly Charge GBP'?: number;
  'Average Monthly Usage GB'?: number;
  'Data Allowance GB'?: number;
  'Overage Charges GBP'?: number;
  'Discount Percent'?: number;
  'Payment Method'?: string;
  'Direct Debit'?: string; // Yes / No
  'Lifetime Revenue GBP'?: number;
  'Monthly Revenue At Risk GBP'?: number;

  // Behavioural & Quality of Service (12 Months)
  'Late Payments 12M'?: number;
  'Failed Payments 12M'?: number;
  'Support Tickets 12M'?: number;
  'Complaints 12M'?: number;
  'Average Resolution Hours'?: number;
  'Network Outages 12M'?: number;

  // Sentiment & Feedback
  'Satisfaction Score 1 10'?: number;
  'NPS Score'?: number;
  'Competitor Offer Received'?: string; // Yes / No
  'Churn Date'?: string;
  'Churn Reason'?: string;

  // Custom/Extra dynamic attributes
  [key: string]: any;
}

export interface EngineeredFeatures {
  // Lifecycle & Tenure
  tenureBucket: string;
  monthsInContract: number;
  daysToContractEnd: number | null;
  isOutOfContract: number;
  contractExpiring30: number;
  contractExpiring60: number;
  contractExpiring90: number;

  // Pricing & Value
  priceVsSegmentMedian: number;
  effectiveMonthlyCharge: number;
  discountExpiryRisk: number;
  overageRatio: number;
  usageUtilisation: number;
  isOverAllowance: number;
  isUnderUsed: number;
  revenuePerTenureMonth: number;

  // Payment Risk
  paymentStressScore: number;
  hasAnyFailedPayment: number;
  nonDirectDebit: number;

  // Service Experience & Friction
  ticketsPerTenureYear: number;
  complaintRate: number;
  resolutionSlowFlag: number;
  outageExposure: number;
  serviceFrictionIndex: number;

  // Sentiment
  satisfactionBucket: string;
  npsCategory: 'Detractor' | 'Passive' | 'Promoter';
  sentimentGap: number;

  // Competitive & Interactions
  competitorOfferFlag: number;
  competitorAndOutOfContract: number;
  lowSatHighPrice: number;
  outageAndComplaint: number;
  outOfContractNoAutoRenew: number;

  // Categorical encodings
  serviceType: string;
  contractType: string;
  customerSegment: string;
  ukNation: string;
}

export type RiskTier = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ScoredCustomer {
  customerId: string;
  churnProbability: number; // 0 - 100
  riskTier: RiskTier;
  riskRank: number; // 1 to N
  percentile: number; // 0 - 100
  monthlyRevenueAtRisk: number; // £
  expectedLtvAtRisk: number; // £
  topDrivers: Array<{
    feature: string;
    label: string;
    contribution: number; // positive = pushes churn up, negative = down
    direction: 'up' | 'down';
  }>;
  record: CustomerRecord;
}

export interface ValidationIssue {
  severity: 'Error' | 'Warning' | 'Info';
  column?: string;
  rowIndices?: number[];
  count: number;
  message: string;
  autoFixAvailable?: boolean;
}

export interface ValidationReport {
  totalRows: number;
  totalColumns: number;
  qualityScore: number; // 0 - 100
  completeness: Record<string, number>; // col -> % complete
  uniqueness: Record<string, number>; // col -> % unique
  validity: Record<string, number>; // col -> % valid
  issues: ValidationIssue[];
  missingRequired: string[];
  unmappedColumns: string[];
  extraColumns: string[];
}

export interface CleaningStepLog {
  id: string;
  ruleName: string;
  column: string;
  rowsAffected: number;
  description: string;
  enabled: boolean;
}

export interface DatasetVersion {
  id: string;
  timestamp: string;
  fileName: string;
  rowCount: number;
  activeCount: number;
  churnedCount: number;
  action: 'Initial Upload' | 'Append / Upsert' | 'Replace' | 'Synthetic Demo';
  author: string;
}

export type ModelType = 'logistic_regression' | 'decision_tree' | 'random_forest' | 'gradient_boosting';

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  prAuc: number;
  brierScore: number;
  logLoss: number;
  ksStatistic: number;
  confusionMatrix: {
    tp: number;
    fp: number;
    tn: number;
    fn: number;
  };
  rocCurve: Array<{ fpr: number; tpr: number; threshold: number }>;
  prCurve: Array<{ precision: number; recall: number; threshold: number }>;
  calibrationCurve: Array<{ meanPredicted: number; observedFrequency: number; count: number }>;
  deciles: Array<{
    decile: number;
    customers: number;
    churners: number;
    churnRate: number;
    cumulativeGain: number;
    lift: number;
  }>;
  confidenceIntervals: {
    rocAuc: [number, number];
    prAuc: [number, number];
    f1: [number, number];
  };
  plainEnglishVerdict: string;
  overfitWarning?: boolean;
  sampleSizeWarning?: boolean;
}

export interface ModelTrainedResult {
  id: string;
  modelType: ModelType;
  modelName: string;
  trainedAt: string;
  featuresUsed: string[];
  metrics: ModelMetrics;
  valAuc: number;
  trainAuc: number;
  featureImportances: Array<{
    feature: string;
    label: string;
    importance: number;
    direction?: 'increases_churn' | 'decreases_churn';
  }>;
  coefficients?: Record<string, number>;
  intercept?: number;
  treeModel?: any;
}

export interface GlobalFilters {
  customerSegment?: string;
  serviceType?: string;
  planName?: string;
  ukNation?: string;
  city?: string;
  acquisitionChannel?: string;
  contractType?: string;
  tenureBand?: string;
  riskTier?: RiskTier;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

export interface RecommendationPlan {
  id: string;
  title: string;
  priority: 'P1 (Immediate 0-14d)' | 'P2 (30d)' | 'P3 (60-90d)';
  priorityRankScore: number;
  targetAudience: string;
  targetSize: number;
  revenueAtRiskGbp: number;
  rootCause: string;
  evidencePoints: string[];
  personalizedAction: string;
  implementationSteps: Array<{
    stepNumber: number;
    step: string;
    ownerRole: string;
    channel: string;
    timing: string;
  }>;
  expectedImpact: {
    addressableCustomers: number;
    assumedSaveRatePct: number;
    grossMonthlySavedGbp: number;
    netBenefitGbpLow: number;
    netBenefitGbpBase: number;
    netBenefitGbpHigh: number;
    assumptionsUsed: string;
  };
  kpis: Array<{
    name: string;
    baseline: string;
    target: string;
    measurementWindow: string;
    dataSource: string;
  }>;
  risksAndGuardrails: string[];
  testDesign: string;
  confidence: 'High' | 'Medium' | 'Low';
  status: 'Approved' | 'In Progress' | 'Draft' | 'Rejected';
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  linkedRecommendationId?: string;
  targetSegment: string;
  startDate: string;
  endDate: string;
  channels: string[];
  offerType: string;
  offerValue: number; // £ or %
  costPerContact: number; // £
  costPerOffer: number; // £
  budget: number; // £
  owner: string;
  status: 'Draft' | 'Active' | 'Completed';
  holdoutPct: number; // Default 10%
  
  // Results
  treatedCount: number;
  controlCount: number;
  contactedCount: number;
  respondedCount: number;
  offerAcceptedCount: number;
  treatedChurnRate: number; // %
  controlChurnRate: number; // %
  incrementalChurnReductionPctPoints: number;
  customersSaved: number;
  retainedRevenueMonthlyGbp: number;
  retainedRevenueLifetimeGbp: number;
  totalCostGbp: number;
  netBenefitGbp: number;
  roiPct: number;
  costPerSavedCustomerGbp: number;
  paybackPeriodMonths: number;
  pValue: number;
  isSignificant: boolean;
  verdict: string;
}

export interface BusinessAssumptions {
  costOfRetentionOfferGbp: number; // default £25
  assumedSaveRatePct: number; // default 22%
  averageGrossMarginPct: number; // default 65%
  expectedRetainedLifetimeMonths: number; // default 14
  riskThresholdCritical: number; // 70%
  riskThresholdHigh: number; // 50%
  riskThresholdMedium: number; // 30%
  asOfDate: string; // YYYY-MM-DD
  excludeProtectedAttributes: boolean; // default true
}
