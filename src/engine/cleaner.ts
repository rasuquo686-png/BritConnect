/**
 * Transparent, Reversible Data Cleaning Pipeline
 * Generates an auditable cleaning log with toggleable transformation steps.
 */

import { CustomerRecord, CleaningStepLog } from '../types';

export interface CleaningOptions {
  duplicateIdResolution: 'keep_latest' | 'keep_first' | 'reject';
  enabledRules?: Record<string, boolean>; // ruleId -> boolean
}

export interface CleaningSummary {
  originalRowCount: number;
  cleanedRowCount: number;
  duplicateRowsRemoved: number;
  valuesNormalisedCount: number;
  missingValuesImputedCount: number;
  outliersWinsorisedCount: number;
  cleaningLog: CleaningStepLog[];
  cleanedRecords: CustomerRecord[];
}

export function cleanDataset(
  rawRecords: CustomerRecord[],
  options: CleaningOptions = { duplicateIdResolution: 'keep_latest' }
): CleaningSummary {
  const log: CleaningStepLog[] = [];
  const enabledRules = options.enabledRules || {};
  const isRuleEnabled = (id: string) => enabledRules[id] !== false;

  let records = rawRecords.map((r) => ({ ...r }));
  const originalRowCount = records.length;

  let valuesNormalisedCount = 0;
  let missingValuesImputedCount = 0;
  let outliersWinsorisedCount = 0;

  // 1. Deduplication on Customer ID
  let duplicateRowsRemoved = 0;
  if (isRuleEnabled('dedup_ids')) {
    const idMap = new Map<string, CustomerRecord>();
    const seenCount = new Map<string, number>();

    records.forEach((row) => {
      const id = String(row['Customer ID'] || '').trim();
      if (!id) return;
      seenCount.set(id, (seenCount.get(id) || 0) + 1);

      if (options.duplicateIdResolution === 'keep_first') {
        if (!idMap.has(id)) idMap.set(id, row);
      } else {
        // default: keep latest
        idMap.set(id, row);
      }
    });

    if (options.duplicateIdResolution === 'reject') {
      records = records.filter((r) => {
        const id = String(r['Customer ID'] || '').trim();
        return (seenCount.get(id) || 0) <= 1;
      });
      duplicateRowsRemoved = originalRowCount - records.length;
    } else {
      const beforeCount = records.length;
      records = Array.from(idMap.values());
      duplicateRowsRemoved = beforeCount - records.length;
    }

    log.push({
      id: 'dedup_ids',
      ruleName: 'Customer ID Deduplication',
      column: 'Customer ID',
      rowsAffected: duplicateRowsRemoved,
      description: `Resolved duplicate Customer IDs using "${options.duplicateIdResolution}" strategy.`,
      enabled: isRuleEnabled('dedup_ids'),
    });
  }

  // 2. Trim whitespace and normalise casing
  let whitespaceFixed = 0;
  if (isRuleEnabled('trim_whitespace')) {
    records.forEach((row) => {
      let changed = false;
      Object.keys(row).forEach((key) => {
        if (typeof row[key] === 'string') {
          const original = row[key];
          const trimmed = original.trim();
          if (original !== trimmed) {
            row[key] = trimmed;
            changed = true;
          }
        }
      });
      if (changed) whitespaceFixed++;
    });
    valuesNormalisedCount += whitespaceFixed;
    log.push({
      id: 'trim_whitespace',
      ruleName: 'Whitespace Standardisation',
      column: 'All Text Columns',
      rowsAffected: whitespaceFixed,
      description: 'Trimmed leading and trailing whitespace across all string attributes.',
      enabled: isRuleEnabled('trim_whitespace'),
    });
  }

  // 3. Normalise Boolean / Yes-No / Churn Flag
  let booleanNormalised = 0;
  if (isRuleEnabled('normalise_booleans')) {
    records.forEach((row) => {
      let rowChanged = false;
      const yesNoCols = ['Auto Renew', 'Direct Debit', 'Competitor Offer Received'];
      yesNoCols.forEach((col) => {
        if (row[col] !== undefined && row[col] !== null) {
          const str = String(row[col]).trim().toLowerCase();
          const canonical = ['yes', 'y', 'true', '1'].includes(str) ? 'Yes' : ['no', 'n', 'false', '0'].includes(str) ? 'No' : row[col];
          if (canonical !== row[col]) {
            row[col] = canonical;
            rowChanged = true;
          }
        }
      });

      // Target consistency: Churn Flag (0/1) & Churn Status (Active/Churned)
      const flagVal = row['Churn Flag'];
      const statusVal = row['Churn Status'];
      let canonicalFlag = 0;
      let canonicalStatus = 'Active';

      if (flagVal != null) {
        canonicalFlag = Number(flagVal) === 1 ? 1 : 0;
        canonicalStatus = canonicalFlag === 1 ? 'Churned' : 'Active';
      } else if (statusVal != null) {
        const s = String(statusVal).trim().toLowerCase();
        canonicalFlag = s === 'churned' || s === '1' || s === 'true' ? 1 : 0;
        canonicalStatus = canonicalFlag === 1 ? 'Churned' : 'Active';
      }

      if (row['Churn Flag'] !== canonicalFlag || row['Churn Status'] !== canonicalStatus) {
        row['Churn Flag'] = canonicalFlag;
        row['Churn Status'] = canonicalStatus;
        rowChanged = true;
      }

      // If Active, ensure Churn Date is cleared
      if (canonicalFlag === 0 && row['Churn Date']) {
        row['Churn Date'] = '';
        rowChanged = true;
      }

      if (rowChanged) booleanNormalised++;
    });
    valuesNormalisedCount += booleanNormalised;
    log.push({
      id: 'normalise_booleans',
      ruleName: 'Boolean & Churn Target Normalisation',
      column: 'Churn Flag, Churn Status, Yes/No fields',
      rowsAffected: booleanNormalised,
      description: 'Synchronised Churn Flag (0/1) with Churn Status (Active/Churned) and standardised Yes/No fields.',
      enabled: isRuleEnabled('normalise_booleans'),
    });
  }

  // 4. Currency and Numeric parsing
  let currencyParsed = 0;
  if (isRuleEnabled('parse_numerics')) {
    const numericCols = [
      'Age', 'Tenure Months', 'Monthly Charge GBP', 'Average Monthly Usage GB',
      'Data Allowance GB', 'Overage Charges GBP', 'Discount Percent', 'Late Payments 12M',
      'Failed Payments 12M', 'Support Tickets 12M', 'Complaints 12M', 'Average Resolution Hours',
      'Network Outages 12M', 'Satisfaction Score 1 10', 'NPS Score', 'Lifetime Revenue GBP',
      'Monthly Revenue At Risk GBP',
    ];

    records.forEach((row) => {
      let rowChanged = false;
      numericCols.forEach((col) => {
        const val = row[col];
        if (val !== undefined && val !== null && typeof val === 'string') {
          // Strip £, commas, %
          const cleanedStr = val.replace(/[£$€,\s%]/g, '');
          const num = Number(cleanedStr);
          if (!isNaN(num) && cleanedStr !== '') {
            row[col] = num;
            rowChanged = true;
          }
        }
      });
      if (rowChanged) currencyParsed++;
    });
    valuesNormalisedCount += currencyParsed;
    log.push({
      id: 'parse_numerics',
      ruleName: 'Currency & Numeric Extraction',
      column: 'All Numeric & GBP Fields',
      rowsAffected: currencyParsed,
      description: 'Stripped currency symbols (£), percentage marks, and thousand commas from numeric columns.',
      enabled: isRuleEnabled('parse_numerics'),
    });
  }

  // 5. Impute Missing Values: Numeric -> Median (by Service Type if >=30, else global)
  let numericImputed = 0;
  if (isRuleEnabled('impute_missing_numerics')) {
    const numericCols = ['Monthly Charge GBP', 'Average Monthly Usage GB', 'Satisfaction Score 1 10', 'Tenure Months'];
    
    numericCols.forEach((col) => {
      // Compute global median
      const validVals = records.map((r) => Number(r[col])).filter((n) => !isNaN(n) && n !== null && n !== undefined).sort((a, b) => a - b);
      const globalMedian = validVals.length > 0 ? validVals[Math.floor(validVals.length / 2)] : 0;

      // Group medians by Service Type
      const groupMedians = new Map<string, number>();
      const serviceGroups = new Map<string, number[]>();
      records.forEach((r) => {
        const st = String(r['Service Type'] || 'Unknown');
        const num = Number(r[col]);
        if (!isNaN(num)) {
          if (!serviceGroups.has(st)) serviceGroups.set(st, []);
          serviceGroups.get(st)!.push(num);
        }
      });

      serviceGroups.forEach((vals, st) => {
        if (vals.length >= 30) {
          vals.sort((a, b) => a - b);
          groupMedians.set(st, vals[Math.floor(vals.length / 2)]);
        }
      });

      let colImputed = 0;
      records.forEach((row) => {
        if (row[col] === undefined || row[col] === null || row[col] === '' || isNaN(Number(row[col]))) {
          const st = String(row['Service Type'] || 'Unknown');
          row[col] = groupMedians.get(st) ?? globalMedian;
          row[`${col}_was_missing`] = 1;
          colImputed++;
        }
      });
      numericImputed += colImputed;
    });

    missingValuesImputedCount += numericImputed;
    log.push({
      id: 'impute_missing_numerics',
      ruleName: 'Conditional Median Imputation',
      column: 'Numeric Fields',
      rowsAffected: numericImputed,
      description: 'Imputed missing numeric values with segment/service-specific medians (or global median), creating missingness indicators.',
      enabled: isRuleEnabled('impute_missing_numerics'),
    });
  }

  // 6. Derive missing Age Band and Tenure Months
  let derivedCount = 0;
  if (isRuleEnabled('derive_missing_attributes')) {
    records.forEach((row) => {
      let rowChanged = false;
      // Derive Age Band if Age exists but Age Band missing
      if ((!row['Age Band'] || row['Age Band'] === '') && row['Age'] != null) {
        const age = Number(row['Age']);
        if (!isNaN(age)) {
          if (age < 25) row['Age Band'] = '18-24';
          else if (age <= 34) row['Age Band'] = '25-34';
          else if (age <= 44) row['Age Band'] = '35-44';
          else if (age <= 54) row['Age Band'] = '45-54';
          else if (age <= 64) row['Age Band'] = '55-64';
          else row['Age Band'] = '65+';
          rowChanged = true;
        }
      }

      // Derive Tenure Months from Join Date if missing
      if ((row['Tenure Months'] == null || isNaN(Number(row['Tenure Months']))) && row['Join Date']) {
        const jd = new Date(row['Join Date']);
        if (!isNaN(jd.getTime())) {
          const asOf = row['Churn Date'] ? new Date(row['Churn Date']) : new Date('2026-10-31');
          const months = Math.max(0, Math.round((asOf.getTime() - jd.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)));
          row['Tenure Months'] = months;
          rowChanged = true;
        }
      }

      if (rowChanged) derivedCount++;
    });
    valuesNormalisedCount += derivedCount;
    log.push({
      id: 'derive_missing_attributes',
      ruleName: 'Attribute Derivation',
      column: 'Age Band, Tenure Months',
      rowsAffected: derivedCount,
      description: 'Derived Age Band from Age and calculated Tenure Months from Join Date where absent.',
      enabled: isRuleEnabled('derive_missing_attributes'),
    });
  }

  // 7. Winsorise extreme outliers for modelling copy (1st and 99th percentiles)
  if (isRuleEnabled('winsorise_outliers')) {
    const outlierCols = ['Monthly Charge GBP', 'Average Monthly Usage GB', 'Average Resolution Hours'];
    outlierCols.forEach((col) => {
      const vals = records.map((r) => Number(r[col])).filter((n) => !isNaN(n)).sort((a, b) => a - b);
      if (vals.length > 50) {
        const p1 = vals[Math.floor(vals.length * 0.01)];
        const p99 = vals[Math.floor(vals.length * 0.99)];

        let colWinsorised = 0;
        records.forEach((row) => {
          const val = Number(row[col]);
          if (!isNaN(val)) {
            if (val < p1) {
              row[`_modelling_${col}`] = p1;
              colWinsorised++;
            } else if (val > p99) {
              row[`_modelling_${col}`] = p99;
              colWinsorised++;
            } else {
              row[`_modelling_${col}`] = val;
            }
          }
        });
        outliersWinsorisedCount += colWinsorised;
      }
    });

    log.push({
      id: 'winsorise_outliers',
      ruleName: '1st/99th Percentile Winsorisation',
      column: 'Monthly Charge, Usage, Resolution Hours',
      rowsAffected: outliersWinsorisedCount,
      description: 'Clamped extreme outliers at 1st and 99th percentiles for ML model copies while preserving original records.',
      enabled: isRuleEnabled('winsorise_outliers'),
    });
  }

  return {
    originalRowCount,
    cleanedRowCount: records.length,
    duplicateRowsRemoved,
    valuesNormalisedCount,
    missingValuesImputedCount,
    outliersWinsorisedCount,
    cleaningLog: log,
    cleanedRecords: records,
  };
}
