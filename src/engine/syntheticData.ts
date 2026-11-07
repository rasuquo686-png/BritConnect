/**
 * Realistic UK Telecom Synthetic Demo Data Generator
 * Strictly follows all 38 columns of the BritConnect Data Dictionary.
 * Clearly tagged and completely removable with one click.
 */

import { CustomerRecord } from '../types';

const UK_REGIONS = [
  { nation: 'England', cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Newcastle', 'Sheffield', 'Liverpool', 'Nottingham', 'Southampton'] },
  { nation: 'Scotland', cities: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness'] },
  { nation: 'Wales', cities: ['Cardiff', 'Swansea', 'Newport', 'Wrexham'] },
  { nation: 'Northern Ireland', cities: ['Belfast', 'Derry', 'Lisburn', 'Newry'] },
];

const SERVICE_PLANS = [
  { service: 'Broadband Only', plans: ['Fibre 65 Essential', 'Fibre 150 Ultra', 'Gigabit 900 Pro'], baseCharge: [26, 34, 48], baseAllowance: [0, 0, 0] },
  { service: 'Mobile Only', plans: ['Essential 15GB SIM', 'Standard 40GB 5G', 'Unlimited Max 5G'], baseCharge: [14, 20, 28], baseAllowance: [15, 40, 999] },
  { service: 'Broadband & Mobile Bundle', plans: ['Connect Dual 150 + 40GB', 'Gigabit Supreme Bundle', 'Family All-in-One'], baseCharge: [46, 68, 85], baseAllowance: [40, 999, 999] },
  { service: 'Quad-Play (BB + TV + Mobile + Voice)', plans: ['BritConnect Ultimate 4K Quad', 'Premier Home Entertainment'], baseCharge: [72, 94], baseAllowance: [999, 999] },
];

const CHANNELS = ['Online Direct', 'Retail Store', 'Price Comparison Website', 'Inbound Tele-sales', 'Field Partner / Door'];
const CONTRACT_TYPES = ['24 Months', '18 Months', '12 Months', '30-Day Rolling'];
const SEGMENTS = ['Consumer', 'Small Business'];
const PAYMENT_METHODS = ['Direct Debit', 'Credit Card', 'Bank Transfer', 'Cheque / Manual'];
const CHURN_REASONS = [
  'Competitor price promotion',
  'Repeated broadband outages',
  'Slow customer support resolution',
  'Moving home / outside service area',
  'End of promotional discount price hike',
  'Poor mobile indoor coverage',
  'Switched to local full-fibre altnet',
  'Unresolved billing dispute',
];

// Seeded pseudorandom number generator (LCG) for reproducible demo data
function createRng(seed = 42) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function generateSyntheticDemoDataset(count = 1500, seed = 2026): CustomerRecord[] {
  const rng = createRng(seed);
  const records: CustomerRecord[] = [];
  const referenceDate = new Date('2026-10-31');

  for (let i = 1; i <= count; i++) {
    const custId = `BC-${(10000 + i).toString()}`;
    const segment = rng() < 0.78 ? 'Consumer' : 'Small Business';
    const age = segment === 'Consumer' ? Math.floor(19 + rng() * 66) : Math.floor(28 + rng() * 42);
    
    let ageBand = '18-24';
    if (age >= 25 && age <= 34) ageBand = '25-34';
    else if (age >= 35 && age <= 44) ageBand = '35-44';
    else if (age >= 45 && age <= 54) ageBand = '45-54';
    else if (age >= 55 && age <= 64) ageBand = '55-64';
    else if (age >= 65) ageBand = '65+';

    const gender = rng() < 0.49 ? 'Female' : rng() < 0.97 ? 'Male' : 'Non-binary / Other';

    // Geographic distribution (~80% England, ~9% Scotland, ~6% Wales, ~5% NI)
    const geoRoll = rng();
    const regionObj = geoRoll < 0.81 ? UK_REGIONS[0] : geoRoll < 0.90 ? UK_REGIONS[1] : geoRoll < 0.96 ? UK_REGIONS[2] : UK_REGIONS[3];
    const city = regionObj.cities[Math.floor(rng() * regionObj.cities.length)];
    const nation = regionObj.nation;

    const channel = CHANNELS[Math.floor(rng() * CHANNELS.length)];

    // Tenure and Join Date
    const tenureMonths = Math.floor(1 + Math.pow(rng(), 1.4) * 72);
    const joinDateObj = new Date(referenceDate);
    joinDateObj.setMonth(joinDateObj.getMonth() - tenureMonths);
    const joinDate = joinDateObj.toISOString().split('T')[0];

    // Service & Plan
    const serviceObj = SERVICE_PLANS[Math.floor(rng() * SERVICE_PLANS.length)];
    const planIndex = Math.floor(rng() * serviceObj.plans.length);
    const serviceType = serviceObj.service;
    const planName = serviceObj.plans[planIndex];
    let monthlyCharge = serviceObj.baseCharge[planIndex] + Math.floor(rng() * 6) - 2;
    if (segment === 'Small Business') monthlyCharge = Math.round(monthlyCharge * 1.35);

    const contractType = CONTRACT_TYPES[Math.floor(rng() * CONTRACT_TYPES.length)];
    const autoRenew = rng() < 0.75 ? 'Yes' : 'No';

    // Contract Start & End
    let contractLengthMonths = 24;
    if (contractType === '18 Months') contractLengthMonths = 18;
    else if (contractType === '12 Months') contractLengthMonths = 12;
    else if (contractType === '30-Day Rolling') contractLengthMonths = 1;

    const contractStartObj = new Date(referenceDate);
    const monthsIntoContract = Math.floor(rng() * (contractLengthMonths + 14));
    contractStartObj.setMonth(contractStartObj.getMonth() - monthsIntoContract);
    const contractStartDate = contractStartObj.toISOString().split('T')[0];

    const contractEndObj = new Date(contractStartObj);
    contractEndObj.setMonth(contractEndObj.getMonth() + contractLengthMonths);
    const contractEndDate = contractEndObj.toISOString().split('T')[0];

    // Usage & Allowance
    const isMobileService = serviceType.includes('Mobile');
    const dataAllowanceGb = isMobileService ? serviceObj.baseAllowance[planIndex] : 0;
    const avgUsageGb = isMobileService 
      ? Math.round((dataAllowanceGb === 999 ? 45 + rng() * 120 : (dataAllowanceGb * (0.3 + rng() * 0.9))) * 10) / 10
      : Math.round((80 + rng() * 420) * 10) / 10;
    
    const overage = (dataAllowanceGb > 0 && dataAllowanceGb < 999 && avgUsageGb > dataAllowanceGb)
      ? Math.round((avgUsageGb - dataAllowanceGb) * 2.5 * 100) / 100
      : 0;

    const discountPercent = rng() < 0.35 ? Math.round((5 + rng() * 25)) : 0;

    // Payment
    const paymentMethod = rng() < 0.78 ? 'Direct Debit' : rng() < 0.90 ? 'Credit Card' : PAYMENT_METHODS[Math.floor(rng() * PAYMENT_METHODS.length)];
    const directDebit = paymentMethod === 'Direct Debit' ? 'Yes' : 'No';

    // Quality of service indicators
    const isUnlucky = rng() < 0.16;
    const networkOutages = isUnlucky ? Math.floor(2 + rng() * 4) : rng() < 0.25 ? 1 : 0;
    const supportTickets = isUnlucky ? Math.floor(3 + rng() * 6) : rng() < 0.4 ? Math.floor(1 + rng() * 2) : 0;
    const complaints = supportTickets > 2 && rng() < 0.65 ? Math.floor(1 + rng() * 3) : 0;
    const avgResolutionHours = supportTickets > 0 ? Math.round((4 + rng() * 38) * 10) / 10 : 0;

    const latePayments = directDebit === 'No' && rng() < 0.3 ? Math.floor(1 + rng() * 3) : 0;
    const failedPayments = latePayments > 0 && rng() < 0.45 ? 1 : 0;

    // Satisfaction & NPS
    let satScore = 8;
    if (complaints > 0 || networkOutages > 2) satScore = Math.floor(1 + rng() * 4);
    else if (supportTickets > 2) satScore = Math.floor(4 + rng() * 3);
    else satScore = Math.min(10, Math.floor(7 + rng() * 4));

    let nps = satScore >= 9 ? 9 + (rng() > 0.5 ? 1 : 0) : satScore <= 6 ? Math.floor(1 + rng() * 6) : Math.floor(7 + rng() * 2);

    const competitorOffer = (satScore <= 6 || contractEndObj <= referenceDate) && rng() < 0.62 ? 'Yes' : rng() < 0.15 ? 'Yes' : 'No';

    // Realistic churn probability calculation to drive natural target
    let churnProbability = 0.05;
    if (contractEndObj < referenceDate) churnProbability += 0.28; // Out of contract
    if (competitorOffer === 'Yes') churnProbability += 0.24;
    if (complaints > 0) churnProbability += 0.22;
    if (networkOutages >= 2) churnProbability += 0.18;
    if (satScore <= 4) churnProbability += 0.25;
    if (directDebit === 'No') churnProbability += 0.09;
    if (failedPayments > 0) churnProbability += 0.14;
    if (tenureMonths <= 6) churnProbability += 0.12;

    const isChurned = rng() < Math.min(0.88, churnProbability);
    const churnFlag = isChurned ? 1 : 0;
    const churnStatus = isChurned ? 'Churned' : 'Active';

    let churnDate = '';
    let churnReason = '';
    if (isChurned) {
      const churnDateObj = new Date(referenceDate);
      churnDateObj.setDate(churnDateObj.getDate() - Math.floor(rng() * 180));
      churnDate = churnDateObj.toISOString().split('T')[0];

      if (complaints > 0 || avgResolutionHours > 24) churnReason = 'Slow customer support resolution';
      else if (networkOutages >= 2) churnReason = 'Repeated broadband outages';
      else if (competitorOffer === 'Yes') churnReason = 'Competitor price promotion';
      else if (discountPercent > 15) churnReason = 'End of promotional discount price hike';
      else churnReason = CHURN_REASONS[Math.floor(rng() * CHURN_REASONS.length)];
    }

    const effectiveMonthlyCharge = Math.round(monthlyCharge * (1 - discountPercent / 100) * 100) / 100;
    const lifetimeRevenue = Math.round(effectiveMonthlyCharge * tenureMonths + overage * (tenureMonths * 0.4));
    const monthlyRevenueAtRisk = !isChurned && churnProbability > 0.45 ? Math.round(effectiveMonthlyCharge * churnProbability * 100) / 100 : 0;

    records.push({
      'Customer ID': custId,
      'Customer Segment': segment,
      'Age': age,
      'Age Band': ageBand,
      'Gender': gender,
      'UK Nation': nation,
      'City': city,
      'Acquisition Channel': channel,
      'Join Date': joinDate,
      'Tenure Months': tenureMonths,
      'Service Type': serviceType,
      'Plan Name': planName,
      'Contract Type': contractType,
      'Contract Start Date': contractStartDate,
      'Contract End Date': contractEndDate,
      'Auto Renew': autoRenew,
      'Monthly Charge GBP': monthlyCharge,
      'Average Monthly Usage GB': avgUsageGb,
      'Data Allowance GB': dataAllowanceGb,
      'Overage Charges GBP': overage,
      'Discount Percent': discountPercent,
      'Payment Method': paymentMethod,
      'Direct Debit': directDebit,
      'Late Payments 12M': latePayments,
      'Failed Payments 12M': failedPayments,
      'Support Tickets 12M': supportTickets,
      'Complaints 12M': complaints,
      'Average Resolution Hours': avgResolutionHours,
      'Network Outages 12M': networkOutages,
      'Satisfaction Score 1 10': satScore,
      'NPS Score': nps,
      'Competitor Offer Received': competitorOffer,
      'Churn Status': churnStatus,
      'Churn Date': churnDate,
      'Churn Reason': churnReason,
      'Lifetime Revenue GBP': lifetimeRevenue,
      'Monthly Revenue At Risk GBP': monthlyRevenueAtRisk,
      'Churn Flag': churnFlag,
      _isSyntheticDemo: true,
    });
  }

  return records;
}
