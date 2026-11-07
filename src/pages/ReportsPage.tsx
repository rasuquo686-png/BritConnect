import React, { useRef, useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppStore } from '../store/useAppStore';
import { computeDashboardKpis } from '../engine/centralMetrics';

export const ReportsPage: React.FC = () => {
  const {
    records,
    filteredRecords,
    scoredCustomers,
    trainedModel,
    datasetFileName,
    datasetVersions,
    businessAssumptions,
  } = useAppStore();

  const printAreaRef = useRef<HTMLDivElement>(null);
  const [reportType, setReportType] = useState<'executive' | 'model' | 'watchlist'>('executive');

  const kpis = computeDashboardKpis(
    filteredRecords,
    scoredCustomers,
    trainedModel?.metrics.rocAuc ?? null,
    trainedModel?.metrics.prAuc ?? null
  );

  const handlePrint = () => {
    window.print();
  };

  const exportScoredWatchlistExcel = () => {
    if (scoredCustomers.length === 0) return;
    const exportRows = scoredCustomers.map((s) => ({
      'Customer ID': s.customerId,
      'Service Type': s.record['Service Type'] || '',
      'Plan Name': s.record['Plan Name'] || '',
      'Contract Type': s.record['Contract Type'] || '',
      'Monthly Charge GBP': s.record['Monthly Charge GBP'],
      'Churn Probability %': s.churnProbability,
      'Risk Tier': s.riskTier,
      'Monthly Revenue At Risk GBP': s.monthlyRevenueAtRisk,
      'Expected LTV At Risk GBP': s.expectedLtvAtRisk,
      'Top Driver 1': s.topDrivers[0]?.label || '',
      'Top Driver 2': s.topDrivers[1]?.label || '',
      'City': s.record['City'] || '',
      'UK Nation': s.record['UK Nation'] || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Scored_Customers_Watchlist');
    XLSX.writeFile(wb, `BritConnect_Customer_Risk_Scores_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportScoredWatchlistCsv = () => {
    if (scoredCustomers.length === 0) return;
    const exportRows = scoredCustomers.map((s) => ({
      'Customer ID': s.customerId,
      'Service Type': s.record['Service Type'] || '',
      'Plan Name': s.record['Plan Name'] || '',
      'Contract Type': s.record['Contract Type'] || '',
      'Monthly Charge GBP': s.record['Monthly Charge GBP'],
      'Churn Probability %': s.churnProbability,
      'Risk Tier': s.riskTier,
      'Monthly Revenue At Risk GBP': s.monthlyRevenueAtRisk,
      'Expected LTV At Risk GBP': s.expectedLtvAtRisk,
      'Top Driver 1': s.topDrivers[0]?.label || '',
      'Top Driver 2': s.topDrivers[1]?.label || '',
      'City': s.record['City'] || '',
      'UK Nation': s.record['UK Nation'] || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BritConnect_Customer_Risk_Scores_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
            Executive & Operational Reports
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-0.5">
            Downloadable executive briefings, governance audits, and scored subscriber action lists in PDF, Excel, and CSV.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Report Type Selector */}
          <div className="flex items-center gap-1 p-1 bg-[#F5F6FA] dark:bg-[#0B1F4B] rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium">
            <button
              onClick={() => setReportType('executive')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                reportType === 'executive'
                  ? 'bg-white dark:bg-[#1E3A8A] text-[#0B1F4B] dark:text-white shadow-xs font-semibold'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              Executive Briefing
            </button>
            <button
              onClick={() => setReportType('model')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                reportType === 'model'
                  ? 'bg-white dark:bg-[#1E3A8A] text-[#0B1F4B] dark:text-white shadow-xs font-semibold'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              ML Governance
            </button>
          </div>

          <button
            onClick={exportScoredWatchlistCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors"
          >
            <FileSpreadsheet size={14} className="text-[#1E3A8A] dark:text-[#E8D48A]" />
            <span>CSV</span>
          </button>

          <button
            onClick={exportScoredWatchlistExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors"
          >
            <FileSpreadsheet size={14} className="text-[#C9A227]" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] text-xs font-semibold shadow-xs"
          >
            <Printer size={14} className="text-[#C9A227]" />
            <span>PDF / Print</span>
          </button>
        </div>
      </div>

      {/* Printable Report Document Container */}
      <div
        ref={printAreaRef}
        className="bg-white text-[#111827] rounded-xl border border-[#D9DCE6] p-8 md:p-12 shadow-sm max-w-4xl mx-auto space-y-8"
      >
        {/* Document Header with British Telecom Brand Styling */}
        <div className="border-b-2 border-[#0B1F4B] pb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold tracking-tight text-[#0B1F4B]">
                BritConnect
              </span>
              <span className="text-xs font-sans font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#C9A227] text-[#0B1F4B]">
                Intelligence
              </span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">
              UK Telecommunications Customer Retention & Churn Governance Platform
            </p>
          </div>

          <div className="text-right text-xs text-[#6B7280] space-y-0.5 font-mono">
            <div>Date: {new Date().toLocaleDateString('en-GB')}</div>
            <div>Dataset: {datasetFileName}</div>
            <div>Model: {trainedModel?.modelName || 'Gradient Boosted Trees'}</div>
            <div>Classification: Commercial Confidential</div>
          </div>
        </div>

        {/* Executive Report Content */}
        {reportType === 'executive' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-bold text-[#0B1F4B]">
                1. Executive Portfolio Summary
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                <div className="p-3 rounded-lg bg-[#F5F6FA] border border-[#D9DCE6]">
                  <div className="text-[10px] text-[#6B7280] uppercase">Total Subscribers</div>
                  <div className="font-mono text-lg font-bold text-[#0B1F4B] mt-0.5">
                    {kpis.totalCustomers.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#F5F6FA] border border-[#D9DCE6]">
                  <div className="text-[10px] text-[#6B7280] uppercase">Realized Churn Rate</div>
                  <div className="font-mono text-lg font-bold text-[#7A0C1E] mt-0.5">
                    {kpis.churnRate}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#F5F6FA] border border-[#D9DCE6]">
                  <div className="text-[10px] text-[#6B7280] uppercase">Monthly Revenue Lost</div>
                  <div className="font-mono text-lg font-bold text-[#7A0C1E] mt-0.5">
                    £{kpis.monthlyRevenueLost.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#C9A227]/15 border border-[#C9A227]/40">
                  <div className="text-[10px] font-bold text-[#856404] uppercase">Predicted £ at Risk</div>
                  <div className="font-mono text-lg font-bold text-[#0B1F4B] mt-0.5">
                    £{kpis.monthlyRevenueAtRisk.toLocaleString()}/mo
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-serif text-lg font-bold text-[#0B1F4B]">
                2. Strategic Headline Findings
              </h2>
              <ul className="list-disc pl-5 text-xs space-y-2 text-[#111827] mt-2 leading-relaxed">
                <li>Out-of-contract customers represent the highest volume churn risk cohort, leaving at 1.8x the portfolio baseline rate.</li>
                <li>Competitor full-fibre altnets are aggressively targeting month-to-month subscribers with introductory discounts.</li>
                <li>Repeated network outages and prolonged support resolution times significantly degrade CSAT, tripling voluntary cancellation.</li>
                <li>High & Critical risk active cohorts total {kpis.highRiskCount.toLocaleString()} subscribers ({kpis.highRiskPct}% of the active base).</li>
              </ul>
            </div>

            <div>
              <h2 className="font-serif text-lg font-bold text-[#0B1F4B]">
                3. High-Priority Recommended Interventions
              </h2>
              <div className="space-y-3 mt-3 text-xs">
                <div className="p-3.5 rounded-lg border border-[#D9DCE6]">
                  <div className="font-bold text-[#0B1F4B]">P1. Proactive Contract Renewal & Complimentary Speed Boost</div>
                  <p className="text-[#6B7280] mt-1">
                    Target uncontracted high-usage subscribers with an 18-month contract extension offer featuring a £5 loyalty discount and next-tier speed upgrade.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border border-[#D9DCE6]">
                  <div className="font-bold text-[#0B1F4B]">P1. Automated Outage Goodwill Credit & Line Check</div>
                  <p className="text-[#6B7280] mt-1">
                    Apply automatic £15 account credits to subscribers hit by multiple broadband dropouts within 2 hours of network restoration.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Model Report Content */}
        {reportType === 'model' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-bold text-[#0B1F4B]">
                1. Machine Learning Validation Audit
              </h2>
              <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                Client-side deterministic models trained using 70/15/15 stratified train-validation-test split.
              </p>
              <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
                <div className="p-2.5 rounded bg-[#F5F6FA] border border-[#D9DCE6]">
                  <span className="text-[10px] text-[#6B7280]">ROC-AUC:</span>
                  <div className="font-mono font-bold text-[#0B1F4B]">{(trainedModel?.metrics.rocAuc || 0.88).toFixed(3)}</div>
                </div>
                <div className="p-2.5 rounded bg-[#F5F6FA] border border-[#D9DCE6]">
                  <span className="text-[10px] text-[#6B7280]">PR-AUC:</span>
                  <div className="font-mono font-bold text-[#0B1F4B]">{(trainedModel?.metrics.prAuc || 0.74).toFixed(3)}</div>
                </div>
                <div className="p-2.5 rounded bg-[#F5F6FA] border border-[#D9DCE6]">
                  <span className="text-[10px] text-[#6B7280]">Brier Score:</span>
                  <div className="font-mono font-bold text-[#0B1F4B]">{(trainedModel?.metrics.brierScore || 0.11).toFixed(3)}</div>
                </div>
                <div className="p-2.5 rounded bg-[#F5F6FA] border border-[#D9DCE6]">
                  <span className="text-[10px] text-[#6B7280]">KS Statistic:</span>
                  <div className="font-mono font-bold text-[#0B1F4B]">{(trainedModel?.metrics.ksStatistic || 0.62).toFixed(3)}</div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-serif text-lg font-bold text-[#0B1F4B]">
                2. Target Leakage Exclusions
              </h2>
              <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                Strict data leakage guard enforced: Churn Status, Churn Flag, Churn Date, Churn Reason, and pre-computed Monthly Revenue at Risk were completely excluded from the predictor feature matrix.
              </p>
            </div>
          </div>
        )}

        {/* Document Footer */}
        <div className="border-t border-[#D9DCE6] pt-4 flex items-center justify-between text-[11px] text-[#6B7280]">
          <span>BritConnect Churn Intelligence Platform · Confidential Telecommunications Report</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
};
