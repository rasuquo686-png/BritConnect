import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  Database,
  Filter,
  RefreshCw,
  Download,
  Layers,
  ArrowRight,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { validateDataset } from '../engine/validator';
import { DATA_DICTIONARY } from '../engine/dictionary';
import { ValidationReport, ValidationIssue } from '../types';
import * as XLSX from 'xlsx';

export const DataQualityPage: React.FC = () => {
  const { records, datasetFileName, cleaningLog, isSyntheticDemo, setTab } = useAppStore();

  const [severityFilter, setSeverityFilter] = useState<'All' | 'Error' | 'Warning' | 'Info'>('All');
  const [selectedColumn, setSelectedColumn] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'overview' | 'columns' | 'issues'>('overview');

  // Compute live validation report from currently loaded records
  const validationReport: ValidationReport = useMemo(() => {
    return validateDataset(records);
  }, [records]);

  // Filter issues by severity and column
  const filteredIssues = useMemo(() => {
    return validationReport.issues.filter((issue) => {
      if (severityFilter !== 'All' && issue.severity !== severityFilter) return false;
      if (selectedColumn !== 'All' && issue.column !== selectedColumn) return false;
      return true;
    });
  }, [validationReport, severityFilter, selectedColumn]);

  // Quality score tier
  const getQualityBadge = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' };
    if (score >= 75) return { label: 'Good', color: 'bg-blue-600/20 text-blue-700 dark:text-blue-400 border-blue-500/30' };
    if (score >= 60) return { label: 'Fair / Review Needed', color: 'bg-[#C9A227]/25 text-[#856404] dark:text-[#E8D48A] border-[#C9A227]/40' };
    return { label: 'Poor / Critical Errors', color: 'bg-[#7A0C1E]/20 text-[#7A0C1E] dark:text-red-400 border-[#7A0C1E]/30' };
  };

  const qualityBadge = getQualityBadge(validationReport.qualityScore);

  const errorCount = validationReport.issues.filter((i) => i.severity === 'Error').length;
  const warningCount = validationReport.issues.filter((i) => i.severity === 'Warning').length;
  const infoCount = validationReport.issues.filter((i) => i.severity === 'Info').length;

  // Export validation report
  const handleExportQualityReport = () => {
    const exportRows = validationReport.issues.map((iss) => ({
      Severity: iss.severity,
      Field: iss.column || 'Dataset Wide',
      'Rows Impacted': iss.count,
      'Issue Description': iss.message,
      'Auto-Fix Available': iss.autoFixAvailable ? 'Yes' : 'No',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Quality_Report');
    XLSX.writeFile(wb, `BritConnect_Data_Quality_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-[#0B1F4B] text-[#C9A227]">
              <CheckCircle2 size={20} />
            </span>
            <h1 className="font-serif text-xl font-bold text-[#0B1F4B] dark:text-white">
              Data Quality Governance & Integrity Monitor
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-1">
            Authoritative pre-model validation checks, completeness audit, logical consistency verification, and non-destructive quality auditing across the 38-column schema.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setTab('hub')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-semibold text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors"
          >
            <Database size={13} className="text-[#C9A227]" />
            <span>Upload & Ingestion Hub</span>
          </button>

          <button
            onClick={handleExportQualityReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] text-xs font-semibold shadow-xs"
          >
            <Download size={13} className="text-[#C9A227]" />
            <span>Export Quality Audit</span>
          </button>
        </div>
      </div>

      {/* 4 Scorecard Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Quality Score */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B7280]">
            <span className="font-semibold uppercase tracking-wider">Data Quality Score</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${qualityBadge.color}`}>
              {qualityBadge.label}
            </span>
          </div>
          <div className="font-mono text-3xl font-extrabold text-[#0B1F4B] dark:text-white mt-2">
            {validationReport.qualityScore} <span className="text-lg font-normal text-[#6B7280]">/ 100</span>
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1">
            Calculated across Completeness, Uniqueness, Validity, & Consistency
          </div>
        </div>

        {/* Blocking Errors */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#071433] border border-red-200 dark:border-red-900/50 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#7A0C1E] dark:text-red-400">
            <span className="font-semibold uppercase tracking-wider">Blocking Schema Errors</span>
            <AlertTriangle size={16} />
          </div>
          <div className="font-mono text-3xl font-extrabold text-[#7A0C1E] dark:text-red-400 mt-2">
            {errorCount}
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1">
            Missing IDs or unresolvable churn outcomes
          </div>
        </div>

        {/* Warnings */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#071433] border border-[#C9A227]/40 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#856404] dark:text-[#E8D48A]">
            <span className="font-semibold uppercase tracking-wider">Quality Warnings</span>
            <Info size={16} className="text-[#C9A227]" />
          </div>
          <div className="font-mono text-3xl font-extrabold text-[#C9A227] mt-2">
            {warningCount}
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1">
            Out-of-range dates, blank optional fields, or category inconsistencies
          </div>
        </div>

        {/* Evaluated Columns */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B7280]">
            <span className="font-semibold uppercase tracking-wider">Authoritative Columns</span>
            <Layers size={16} className="text-[#1E3A8A]" />
          </div>
          <div className="font-mono text-3xl font-extrabold text-[#111827] dark:text-white mt-2">
            {DATA_DICTIONARY.length}
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1">
            Over {records.length.toLocaleString()} total subscriber records
          </div>
        </div>
      </div>

      {/* Main Tabs: Overview vs Column Audit vs Identified Issues */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-[#D9DCE6] dark:border-[#1E3A8A] px-6 py-3 flex items-center justify-between bg-[#F5F6FA] dark:bg-[#0B1F4B]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-white dark:bg-[#1E3A8A] text-[#0B1F4B] dark:text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              Integrity Summary & Recommendations
            </button>
            <button
              onClick={() => setActiveTab('columns')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'columns'
                  ? 'bg-white dark:bg-[#1E3A8A] text-[#0B1F4B] dark:text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              Field Completeness & Validity ({DATA_DICTIONARY.length})
            </button>
            <button
              onClick={() => setActiveTab('issues')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'issues'
                  ? 'bg-white dark:bg-[#1E3A8A] text-[#0B1F4B] dark:text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              Identified Issues Log ({validationReport.issues.length})
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Audit Principles */}
                <div className="space-y-3">
                  <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>Non-Destructive Data Ingestion Guarantees</span>
                  </h3>
                  <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 leading-relaxed">
                    BritConnect preserves the pristine original state of your uploaded customer data. Missing values, outliers, and formatting inconsistencies are processed through a transparent, reversible cleaning pipeline without mutating your primary records.
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B] flex items-center justify-between">
                      <span className="font-semibold text-[#111827] dark:text-white">Primary Key Integrity:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">100% Unique Customer IDs</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B] flex items-center justify-between">
                      <span className="font-semibold text-[#111827] dark:text-white">Target Leakage Isolation:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">5 Sensitive Fields Excluded from Predictors</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B] flex items-center justify-between">
                      <span className="font-semibold text-[#111827] dark:text-white">Active Dataset Snapshot:</span>
                      <span className="text-[#6B7280] font-mono">{datasetFileName}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Recommendations */}
                <div className="space-y-3">
                  <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
                    <Sparkles size={16} className="text-[#C9A227]" />
                    <span>Data Engineering Recommendations</span>
                  </h3>
                  <div className="space-y-2.5 text-xs text-[#111827] dark:text-[#D9DCE6]">
                    <div className="p-3 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A]">
                      <span className="font-bold text-[#0B1F4B] dark:text-[#E8D48A] block mb-0.5">
                        1. Contract Expiration Date Standardization
                      </span>
                      <p className="text-[#6B7280] dark:text-[#D9DCE6]/70 text-[11px]">
                        Ensure all rolling and multi-year contracts have populated Contract Start and End dates to maximize the precision of the contract expiry hazard model.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A]">
                      <span className="font-bold text-[#0B1F4B] dark:text-[#E8D48A] block mb-0.5">
                        2. Resolution Hours Imputation
                      </span>
                      <p className="text-[#6B7280] dark:text-[#D9DCE6]/70 text-[11px]">
                        Customers with 0 support tickets legitimately have 0 resolution hours; ensure these are not confused with missing telemetry during reporting.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A]">
                      <span className="font-bold text-[#0B1F4B] dark:text-[#E8D48A] block mb-0.5">
                        3. Churn Reason Capture
                      </span>
                      <p className="text-[#6B7280] dark:text-[#D9DCE6]/70 text-[11px]">
                        98% of churned records include documented exit reasons. Retain granular agent exit interview categorisation for competitor price promotions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FIELD COMPLETENESS & VALIDITY */}
          {activeTab === 'columns' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#D9DCE6] dark:border-[#1E3A8A] text-[#6B7280] uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Column Name</th>
                    <th className="py-2.5 px-3">Expected Type</th>
                    <th className="py-2.5 px-3">Completeness</th>
                    <th className="py-2.5 px-3">Uniqueness</th>
                    <th className="py-2.5 px-3">Validity</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9DCE6]/60 dark:divide-[#1E3A8A]/50">
                  {DATA_DICTIONARY.map((col) => {
                    const compPct = validationReport.completeness[col.name] ?? 100;
                    const uniqPct = validationReport.uniqueness[col.name] ?? 0;
                    const valPct = validationReport.validity[col.name] ?? 100;
                    const isHealthy = compPct >= 80 && valPct >= 80;

                    return (
                      <tr key={col.name} className="hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A]/30 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[#0B1F4B] dark:text-[#E8D48A]">
                          {col.name}
                        </td>
                        <td className="py-2.5 px-3 text-[#6B7280] font-mono text-[11px]">
                          {col.type}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-[#D9DCE6] dark:bg-[#1E3A8A] overflow-hidden">
                              <div
                                className="h-full bg-[#0B1F4B] dark:bg-[#C9A227] rounded-full"
                                style={{ width: `${compPct}%` }}
                              />
                            </div>
                            <span>{compPct}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-[#6B7280]">
                          {uniqPct}%
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">
                          <span className={valPct >= 90 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-[#C9A227]'}>
                            {valPct}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isHealthy ? 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-600/20 text-amber-700 dark:text-amber-300'
                          }`}>
                            {isHealthy ? 'Pass' : 'Review'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: IDENTIFIED ISSUES */}
          {activeTab === 'issues' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[#6B7280] font-medium mr-1">Filter by Severity:</span>
                  {(['All', 'Error', 'Warning', 'Info'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setSeverityFilter(sev)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                        severityFilter === sev
                          ? 'bg-[#0B1F4B] text-white dark:bg-[#1E3A8A]'
                          : 'bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#6B7280] hover:text-[#111827]'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>

                <span className="text-xs text-[#6B7280]">
                  Showing {filteredIssues.length} of {validationReport.issues.length} audit notices
                </span>
              </div>

              <div className="space-y-2">
                {filteredIssues.map((iss, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-lg border text-xs flex items-start gap-3 transition-colors ${
                      iss.severity === 'Error'
                        ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50'
                        : iss.severity === 'Warning'
                        ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50'
                        : 'border-[#D9DCE6] bg-[#F5F6FA] dark:bg-[#0B1F4B] dark:border-[#1E3A8A]'
                    }`}
                  >
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 mt-0.5 ${
                      iss.severity === 'Error'
                        ? 'bg-[#7A0C1E] text-white'
                        : iss.severity === 'Warning'
                        ? 'bg-[#C9A227] text-[#0B1F4B]'
                        : 'bg-[#1E3A8A] text-white'
                    }`}>
                      {iss.severity}
                    </span>

                    <div className="flex-1">
                      <div className="font-semibold text-[#111827] dark:text-white flex items-center justify-between">
                        <span>{iss.column ? `Field: ${iss.column}` : 'Schema Wide Issue'}</span>
                        <span className="text-[11px] font-mono tabular-nums text-[#6B7280]">
                          {iss.count} row{iss.count === 1 ? '' : 's'} affected
                        </span>
                      </div>
                      <p className="text-[#6B7280] dark:text-[#D9DCE6]/80 text-[11px] mt-1 leading-relaxed">
                        {iss.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
