/**
 * Authoritative 38-column Data Dictionary and Fuzzy Column Matching Engine
 */

export interface ColumnDefinition {
  index: number;
  name: string;
  type: 'Text' | 'Whole Number' | 'Decimal Number' | 'Date';
  description: string;
  required?: boolean;
  category: 'Identifier' | 'Demographic' | 'Account' | 'Financial' | 'Quality of Service' | 'Sentiment' | 'Target';
}

export const DATA_DICTIONARY: ColumnDefinition[] = [
  { index: 1, name: 'Customer ID', type: 'Text', description: 'Unique identifier assigned to each customer.', required: true, category: 'Identifier' },
  { index: 2, name: 'Customer Segment', type: 'Text', description: 'Customer classification (e.g. Consumer or Small Business).', category: 'Demographic' },
  { index: 3, name: 'Age', type: 'Whole Number', description: 'Customer age in years.', category: 'Demographic' },
  { index: 4, name: 'Age Band', type: 'Text', description: 'Age grouping used for demographic analysis.', category: 'Demographic' },
  { index: 5, name: 'Gender', type: 'Text', description: 'Recorded customer gender.', category: 'Demographic' },
  { index: 6, name: 'UK Nation', type: 'Text', description: 'UK constituent nation (England, Scotland, Wales, Northern Ireland).', category: 'Demographic' },
  { index: 7, name: 'City', type: 'Text', description: 'Customer city.', category: 'Demographic' },
  { index: 8, name: 'Acquisition Channel', type: 'Text', description: 'Channel through which the customer was acquired.', category: 'Account' },
  { index: 9, name: 'Join Date', type: 'Date', description: 'Date the customer first joined BritConnect.', category: 'Account' },
  { index: 10, name: 'Tenure Months', type: 'Whole Number', description: 'Length of customer relationship in months.', category: 'Account' },
  { index: 11, name: 'Service Type', type: 'Text', description: 'Telecommunications service subscribed to.', category: 'Account' },
  { index: 12, name: 'Plan Name', type: 'Text', description: 'Name of the subscription package.', category: 'Account' },
  { index: 13, name: 'Contract Type', type: 'Text', description: 'Contract arrangement or term.', category: 'Account' },
  { index: 14, name: 'Contract Start Date', type: 'Date', description: 'Date the current contract began.', category: 'Account' },
  { index: 15, name: 'Contract End Date', type: 'Date', description: 'Scheduled contract expiry date, where applicable.', category: 'Account' },
  { index: 16, name: 'Auto Renew', type: 'Text', description: 'Whether the contract renews automatically (Yes/No).', category: 'Account' },
  { index: 17, name: 'Monthly Charge GBP', type: 'Decimal Number', description: 'Monthly subscription charge in GBP (£).', category: 'Financial' },
  { index: 18, name: 'Average Monthly Usage GB', type: 'Decimal Number', description: 'Average monthly data usage in gigabytes.', category: 'Financial' },
  { index: 19, name: 'Data Allowance GB', type: 'Whole Number', description: 'Included monthly data allowance in gigabytes.', category: 'Financial' },
  { index: 20, name: 'Overage Charges GBP', type: 'Decimal Number', description: 'Additional usage charges in GBP (£).', category: 'Financial' },
  { index: 21, name: 'Discount Percent', type: 'Decimal Number', description: 'Discount percentage applied to the subscription.', category: 'Financial' },
  { index: 22, name: 'Payment Method', type: 'Text', description: 'Customer payment method.', category: 'Financial' },
  { index: 23, name: 'Direct Debit', type: 'Text', description: 'Whether the customer pays by direct debit (Yes/No).', category: 'Financial' },
  { index: 24, name: 'Late Payments 12M', type: 'Whole Number', description: 'Number of late payments in the preceding 12 months.', category: 'Financial' },
  { index: 25, name: 'Failed Payments 12M', type: 'Whole Number', description: 'Number of failed payments in the preceding 12 months.', category: 'Financial' },
  { index: 26, name: 'Support Tickets 12M', type: 'Whole Number', description: 'Number of support tickets in the preceding 12 months.', category: 'Quality of Service' },
  { index: 27, name: 'Complaints 12M', type: 'Whole Number', description: 'Number of complaints in the preceding 12 months.', category: 'Quality of Service' },
  { index: 28, name: 'Average Resolution Hours', type: 'Decimal Number', description: 'Average support issue resolution time in hours.', category: 'Quality of Service' },
  { index: 29, name: 'Network Outages 12M', type: 'Whole Number', description: 'Number of network outages in the preceding 12 months.', category: 'Quality of Service' },
  { index: 30, name: 'Satisfaction Score 1 10', type: 'Whole Number', description: 'Customer satisfaction score on a scale from 1 to 10.', category: 'Sentiment' },
  { index: 31, name: 'NPS Score', type: 'Whole Number', description: 'Customer advocacy score recorded in the dataset.', category: 'Sentiment' },
  { index: 32, name: 'Competitor Offer Received', type: 'Text', description: 'Whether the customer received an offer from a competitor.', category: 'Sentiment' },
  { index: 33, name: 'Churn Status', type: 'Text', description: 'Recorded customer state: Active or Churned.', category: 'Target' },
  { index: 34, name: 'Churn Date', type: 'Date', description: 'Cancellation date; typically blank for active customers.', category: 'Target' },
  { index: 35, name: 'Churn Reason', type: 'Text', description: 'Reason for cancellation; typically blank for active customers.', category: 'Target' },
  { index: 36, name: 'Lifetime Revenue GBP', type: 'Decimal Number', description: 'Cumulative recorded revenue from the customer in GBP (£).', category: 'Financial' },
  { index: 37, name: 'Monthly Revenue At Risk GBP', type: 'Decimal Number', description: 'Estimated monthly revenue exposed to churn in GBP (£).', category: 'Financial' },
  { index: 38, name: 'Churn Flag', type: 'Whole Number', description: 'Binary churn outcome: 1 = Churned, 0 = Active.', required: true, category: 'Target' },
];

/**
 * Normalises a column header string for tolerant comparison:
 * strips BOM, punctuation, whitespace, symbols, lowercases.
 */
export function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '') // Strip UTF-8 BOM
    .trim()
    .toLowerCase()
    .replace(/[\s_\-–—/\\()[\]{}£$%.,:;]+/g, '');
}

/**
 * Finds the best matching canonical column for an arbitrary input header name.
 */
export function matchColumn(rawHeader: string): string | null {
  const normRaw = normalizeHeader(rawHeader);
  if (!normRaw) return null;

  // Direct normalisation match
  for (const col of DATA_DICTIONARY) {
    if (normalizeHeader(col.name) === normRaw) {
      return col.name;
    }
  }

  // Synonym & variation mapping
  const synonyms: Record<string, string[]> = {
    'Customer ID': ['customerid', 'custid', 'clientid', 'accountid', 'user_id', 'cid'],
    'Customer Segment': ['segment', 'customersegment', 'clienttype', 'accounttype', 'customertype'],
    'Age': ['customerage', 'custage', 'ageyears'],
    'Age Band': ['agegroup', 'agebracket', 'agecohort', 'ageband'],
    'Gender': ['sex', 'customergender'],
    'UK Nation': ['nation', 'country', 'ukregion', 'constituentcountry'],
    'City': ['town', 'location', 'customercity'],
    'Acquisition Channel': ['channel', 'acquisitionchannel', 'source', 'leadsource', 'acqchannel'],
    'Join Date': ['joindate', 'createddate', 'signupdate', 'membersince', 'startdate'],
    'Tenure Months': ['tenure', 'tenuremonths', 'lengthofstay', 'custtenure'],
    'Service Type': ['service', 'servicetype', 'producttype', 'lineofbusiness'],
    'Plan Name': ['plan', 'planname', 'package', 'tier', 'tariff'],
    'Contract Type': ['contract', 'contracttype', 'contractlength', 'contractterm'],
    'Contract Start Date': ['contractstart', 'contractstartdate', 'agreementstart'],
    'Contract End Date': ['contractend', 'contractenddate', 'agreementend', 'expirydate'],
    'Auto Renew': ['autorenew', 'autorenewal', 'automaticrenewal'],
    'Monthly Charge GBP': ['monthlycharge', 'monthlychargegbp', 'mrc', 'arpu', 'monthlybill', 'charge'],
    'Average Monthly Usage GB': ['monthlyusage', 'averageusage', 'datausagegb', 'usagegb', 'avgmonthlyusagegb'],
    'Data Allowance GB': ['allowance', 'allowancegb', 'dataallowance', 'dataallowancegb', 'datalimit'],
    'Overage Charges GBP': ['overage', 'overagecharge', 'overagechargesgbp', 'extrausagecharges'],
    'Discount Percent': ['discount', 'discountpercent', 'discountpct', 'promo_discount'],
    'Payment Method': ['paymentmethod', 'paytype', 'billingmethod'],
    'Direct Debit': ['directdebit', 'ddflag', 'isdirectdebit', 'autopay'],
    'Late Payments 12M': ['latepayments', 'latepayments12m', 'numberoflatepayments'],
    'Failed Payments 12M': ['failedpayments', 'failedpayments12m', 'paymentfailures'],
    'Support Tickets 12M': ['supporttickets', 'tickets12m', 'ticketcount', 'supportcases'],
    'Complaints 12M': ['complaints', 'complaints12m', 'escalations12m'],
    'Average Resolution Hours': ['resolutionhours', 'avgresolutionhours', 'meantimetoresolve', 'mttr'],
    'Network Outages 12M': ['networkoutages', 'outages12m', 'outagecount', 'serviceoutages'],
    'Satisfaction Score 1 10': ['csat', 'satisfaction', 'satisfactionscore', 'satisfaction110', 'satisfactionscore110'],
    'NPS Score': ['nps', 'npsscore', 'netpromoterscore', 'advocacyscore'],
    'Competitor Offer Received': ['competitoroffer', 'competitorofferreceived', 'competitorofferflag'],
    'Churn Status': ['status', 'churnstatus', 'accountstatus', 'customerstatus'],
    'Churn Date': ['churndate', 'cancellationdate', 'terminationdate', 'exitdate'],
    'Churn Reason': ['churnreason', 'cancellationreason', 'reasonforleaving', 'exitreason'],
    'Lifetime Revenue GBP': ['clv', 'ltv', 'lifetimerevenue', 'lifetimerevenuegbp', 'totalrevenue'],
    'Monthly Revenue At Risk GBP': ['revenueatrisk', 'monthlyrevenueatrisk', 'monthlyrevenueatriskgbp'],
    'Churn Flag': ['churn', 'churnflag', 'churned', 'ischurn', 'churnlabel', 'target', 'label'],
  };

  for (const [canonical, syns] of Object.entries(synonyms)) {
    if (syns.some((s) => normalizeHeader(s) === normRaw)) {
      return canonical;
    }
  }

  return null;
}
