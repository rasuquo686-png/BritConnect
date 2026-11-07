/**
 * Data Validation Engine
 * Implements authoritative validation checks, logical consistency rules,
 * column-level metrics (completeness, uniqueness, validity), and overall Data Quality Score (0-100).
 */

import { CustomerRecord, ValidationIssue, ValidationReport } from '../types';
import { DATA_DICTIONARY } from './dictionary';

export function validateDataset(
  records: CustomerRecord[],
  unmappedColumns: string[] = [],
  extraColumns: string[] = []
): ValidationReport {
  const issues: ValidationIssue[] = [];
  const totalRows = records.length;
  const totalColumns = Object.keys(records[0] || {}).length;

  if (totalRows === 0) {
    return {
      totalRows: 0,
      totalColumns: 0,
      qualityScore: 0,
      completeness: {},
      uniqueness: {},
      validity: {},
      issues: [{
        severity: 'Error',
        count: 0,
        message: 'The dataset has zero rows.',
      }],
      missingRequired: ['Customer ID', 'Churn Flag'],
      unmappedColumns,
      extraColumns,
    };
  }

  // 1. Schema check: Required columns
  const firstRecord = records[0];
  const hasCustomerId = 'Customer ID' in firstRecord;
  const hasChurnFlag = 'Churn Flag' in firstRecord;
  const hasChurnStatus = 'Churn Status' in firstRecord;

  const missingRequired: string[] = [];
  if (!hasCustomerId) missingRequired.push('Customer ID');
  if (!hasChurnFlag && !hasChurnStatus) missingRequired.push('Churn Flag or Churn Status');

  if (missingRequired.length > 0) {
    issues.push({
      severity: 'Error',
      count: missingRequired.length,
      message: `Missing required schema fields: ${missingRequired.join(', ')}. Model training and core KPIs require these.`,
    });
  }

  // Column statistics accumulators
  const completeness: Record<string, number> = {};
  const uniqueness: Record<string, number> = {};
  const validity: Record<string, number> = {};

  const idOccurrences = new Map<string, number>();
  let blankIdCount = 0;
  let duplicateIdCount = 0;

  let churnFlagMismatchCount = 0;
  let churnedWithoutDateCount = 0;
  let activeWithDateCount = 0;
  let churnDateBeforeJoinCount = 0;
  let contractEndBeforeStartCount = 0;
  let joinAfterContractStartCount = 0;
  let tenureMismatchCount = 0;
  let directDebitPaymentMismatchCount = 0;
  let revenueAtRiskExceedsChargeCount = 0;
  let ageRangeViolations = 0;
  let satisfactionRangeViolations = 0;
  let discountRangeViolations = 0;
  let negativeNumericViolations = 0;

  // Track value sets per column for uniqueness & validity
  const columnValues: Record<string, Set<any>> = {};
  const validValueCounts: Record<string, number> = {};
  const nonBlankCounts: Record<string, number> = {};

  DATA_DICTIONARY.forEach((col) => {
    columnValues[col.name] = new Set();
    validValueCounts[col.name] = 0;
    nonBlankCounts[col.name] = 0;
  });

  // Evaluate row-by-row
  records.forEach((row, idx) => {
    // 2. Key Check: Customer ID
    const custId = row['Customer ID'] != null ? String(row['Customer ID']).trim() : '';
    if (!custId) {
      blankIdCount++;
    } else {
      const existing = idOccurrences.get(custId) || 0;
      if (existing === 1) duplicateIdCount++;
      idOccurrences.set(custId, existing + 1);
    }

    // 3. Logical Consistency: Churn Flag vs Churn Status
    const rawFlag = row['Churn Flag'];
    const rawStatus = row['Churn Status'];
    if (rawFlag != null && rawStatus != null) {
      const numFlag = Number(rawFlag);
      const strStatus = String(rawStatus).trim().toLowerCase();
      const isStatusChurned = strStatus === 'churned' || strStatus === '1' || strStatus === 'true';
      const isFlagChurned = numFlag === 1;
      if (isStatusChurned !== isFlagChurned) {
        churnFlagMismatchCount++;
      }
    }

    // Dates
    const joinDateStr = row['Join Date'];
    const churnDateStr = row['Churn Date'];
    const contractStartStr = row['Contract Start Date'];
    const contractEndStr = row['Contract End Date'];

    const joinDate = joinDateStr ? new Date(joinDateStr) : null;
    const churnDate = churnDateStr ? new Date(churnDateStr) : null;
    const contractStart = contractStartStr ? new Date(contractStartStr) : null;
    const contractEnd = contractEndStr ? new Date(contractEndStr) : null;

    const isChurned = Number(row['Churn Flag']) === 1 || String(row['Churn Status']).toLowerCase() === 'churned';

    if (isChurned && (!churnDateStr || String(churnDateStr).trim() === '')) {
      churnedWithoutDateCount++;
    }
    if (!isChurned && churnDateStr && String(churnDateStr).trim() !== '') {
      activeWithDateCount++;
    }
    if (churnDate && joinDate && !isNaN(churnDate.getTime()) && !isNaN(joinDate.getTime())) {
      if (churnDate < joinDate) churnDateBeforeJoinCount++;
    }
    if (contractStart && contractEnd && !isNaN(contractStart.getTime()) && !isNaN(contractEnd.getTime())) {
      if (contractEnd < contractStart) contractEndBeforeStartCount++;
    }
    if (joinDate && contractStart && !isNaN(joinDate.getTime()) && !isNaN(contractStart.getTime())) {
      if (joinDate > contractStart) joinAfterContractStartCount++;
    }

    // Tenure consistency check
    const recordedTenure = Number(row['Tenure Months']);
    if (!isNaN(recordedTenure) && joinDate && !isNaN(joinDate.getTime())) {
      const asOf = churnDate && !isNaN(churnDate.getTime()) ? churnDate : new Date('2026-10-31');
      const diffMonths = Math.round((asOf.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
      if (Math.abs(diffMonths - recordedTenure) > 3) {
        tenureMismatchCount++;
      }
    }

    // Direct Debit consistency
    const directDebit = String(row['Direct Debit'] || '').trim().toLowerCase();
    const paymentMethod = String(row['Payment Method'] || '').trim().toLowerCase();
    if (directDebit === 'yes' && paymentMethod && !paymentMethod.includes('direct debit') && !paymentMethod.includes('debit')) {
      directDebitPaymentMismatchCount++;
    }

    // Revenue at Risk <= Monthly Charge
    const charge = Number(row['Monthly Charge GBP']);
    const revAtRisk = Number(row['Monthly Revenue At Risk GBP']);
    if (!isNaN(charge) && !isNaN(revAtRisk) && revAtRisk > charge + 0.05) {
      revenueAtRiskExceedsChargeCount++;
    }

    // Ranges & values per column
    DATA_DICTIONARY.forEach((colDef) => {
      const val = row[colDef.name];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        nonBlankCounts[colDef.name]++;
        columnValues[colDef.name].add(String(val).trim());

        let isValid = true;
        if (colDef.type === 'Whole Number' || colDef.type === 'Decimal Number') {
          const num = Number(val);
          if (isNaN(num)) {
            isValid = false;
          } else {
            if (num < 0 && !colDef.name.includes('NPS')) {
              negativeNumericViolations++;
              isValid = false;
            }
            if (colDef.name === 'Age' && (num < 16 || num > 115)) {
              ageRangeViolations++;
              isValid = false;
            }
            if (colDef.name === 'Satisfaction Score 1 10' && (num < 1 || num > 10)) {
              satisfactionRangeViolations++;
              isValid = false;
            }
            if (colDef.name === 'Discount Percent' && (num < 0 || num > 100)) {
              discountRangeViolations++;
              isValid = false;
            }
          }
        } else if (colDef.type === 'Date') {
          const d = new Date(val);
          if (isNaN(d.getTime())) isValid = false;
        }

        if (isValid) validValueCounts[colDef.name]++;
      }
    });
  });

  // Calculate completeness, uniqueness, validity percentages
  DATA_DICTIONARY.forEach((colDef) => {
    const nonBlank = nonBlankCounts[colDef.name];
    completeness[colDef.name] = Math.round((nonBlank / totalRows) * 100);
    uniqueness[colDef.name] = nonBlank > 0 ? Math.round((columnValues[colDef.name].size / nonBlank) * 100) : 0;
    validity[colDef.name] = nonBlank > 0 ? Math.round((validValueCounts[colDef.name] / nonBlank) * 100) : 100;
  });

  // Add Issues
  if (blankIdCount > 0) {
    issues.push({
      severity: 'Error',
      column: 'Customer ID',
      count: blankIdCount,
      message: `${blankIdCount} records have a blank or missing Customer ID.`,
      autoFixAvailable: true,
    });
  }

  if (duplicateIdCount > 0) {
    issues.push({
      severity: 'Warning',
      column: 'Customer ID',
      count: duplicateIdCount,
      message: `${duplicateIdCount} duplicate Customer IDs detected. BritConnect can keep latest, keep first, or reject.`,
      autoFixAvailable: true,
    });
  }

  if (churnFlagMismatchCount > 0) {
    issues.push({
      severity: 'Warning',
      column: 'Churn Flag',
      count: churnFlagMismatchCount,
      message: `${churnFlagMismatchCount} rows have conflicting Churn Flag and Churn Status values. Automatic alignment will normalise to Churn Flag.`,
      autoFixAvailable: true,
    });
  }

  if (churnedWithoutDateCount > 0) {
    issues.push({
      severity: 'Info',
      column: 'Churn Date',
      count: churnedWithoutDateCount,
      message: `${churnedWithoutDateCount} churned customers have no recorded Churn Date.`,
    });
  }

  if (activeWithDateCount > 0) {
    issues.push({
      severity: 'Warning',
      column: 'Churn Date',
      count: activeWithDateCount,
      message: `${activeWithDateCount} active customers have a Churn Date populated. Pipeline will clear Churn Date for active accounts.`,
      autoFixAvailable: true,
    });
  }

  if (churnDateBeforeJoinCount > 0) {
    issues.push({
      severity: 'Error',
      column: 'Churn Date',
      count: churnDateBeforeJoinCount,
      message: `${churnDateBeforeJoinCount} rows record a Churn Date before the customer Join Date.`,
    });
  }

  if (contractEndBeforeStartCount > 0) {
    issues.push({
      severity: 'Warning',
      column: 'Contract End Date',
      count: contractEndBeforeStartCount,
      message: `${contractEndBeforeStartCount} rows show Contract End Date occurring before Contract Start Date.`,
    });
  }

  if (tenureMismatchCount > 0) {
    issues.push({
      severity: 'Info',
      column: 'Tenure Months',
      count: tenureMismatchCount,
      message: `${tenureMismatchCount} records show a discrepancy (> 3 months) between recorded Tenure Months and the calendar elapsed months from Join Date.`,
      autoFixAvailable: true,
    });
  }

  if (directDebitPaymentMismatchCount > 0) {
    issues.push({
      severity: 'Warning',
      column: 'Direct Debit',
      count: directDebitPaymentMismatchCount,
      message: `${directDebitPaymentMismatchCount} customers have Direct Debit = 'Yes' but payment method indicates manual or card billing.`,
      autoFixAvailable: true,
    });
  }

  if (revenueAtRiskExceedsChargeCount > 0) {
    issues.push({
      severity: 'Warning',
      column: 'Monthly Revenue At Risk GBP',
      count: revenueAtRiskExceedsChargeCount,
      message: `${revenueAtRiskExceedsChargeCount} records have Monthly Revenue at Risk higher than Monthly Charge. Capped at Monthly Charge during cleaning.`,
      autoFixAvailable: true,
    });
  }

  if (ageRangeViolations > 0) {
    issues.push({
      severity: 'Warning',
      column: 'Age',
      count: ageRangeViolations,
      message: `${ageRangeViolations} records contain Age outside the valid 16–110 window.`,
      autoFixAvailable: true,
    });
  }

  if (satisfactionRangeViolations > 0) {
    issues.push({
      severity: 'Warning',
      column: 'Satisfaction Score 1 10',
      count: satisfactionRangeViolations,
      message: `${satisfactionRangeViolations} records have Satisfaction scores outside 1–10.`,
      autoFixAvailable: true,
    });
  }

  // Compute Overall Data Quality Score (0 - 100)
  // Deduct based on errors (-15 each), warnings (-4 each), info (-1 each), weighted by row completeness
  let score = 100;
  const errorPenalty = issues.filter((i) => i.severity === 'Error').reduce((acc, i) => acc + Math.min(25, i.count * 2), 0);
  const warningPenalty = issues.filter((i) => i.severity === 'Warning').reduce((acc, i) => acc + Math.min(10, i.count * 0.5), 0);
  
  // Calculate average completeness across primary columns
  const primaryCols = ['Customer ID', 'Churn Flag', 'Monthly Charge GBP', 'Tenure Months', 'Contract Type', 'Service Type'];
  const avgCompleteness = primaryCols.reduce((acc, col) => acc + (completeness[col] || 0), 0) / primaryCols.length;

  score = Math.max(0, Math.min(100, Math.round((score - errorPenalty - warningPenalty) * (avgCompleteness / 100))));

  return {
    totalRows,
    totalColumns,
    qualityScore: score,
    completeness,
    uniqueness,
    validity,
    issues,
    missingRequired,
    unmappedColumns,
    extraColumns,
  };
}
