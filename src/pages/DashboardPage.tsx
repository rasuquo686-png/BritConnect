import React from 'react';
import { Upload, FileSpreadsheet, ArrowRight, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { computeDashboardKpis, KPI_FORMULAS } from '../engine/centralMetrics';
import { KpiCard } from '../components/dashboard/KpiCard';
import { ExecutiveSummaryCard } from '../components/dashboard/ExecutiveSummaryCard';
import { DashboardCharts } from '../components/dashboard/DashboardCharts';

interface DashboardPageProps {
  onOpenUpload?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onOpenUpload }) => {
  const {
    records,
    filteredRecords,
    scoredCustomers,
    trainedModel,
    isSyntheticDemo,
    setFilters,
    setTab,
    selectCustomer,
  } = useAppStore();

  const kpis = computeDashboardKpis(
    filteredRecords,
    scoredCustomers,
    trainedModel?.metrics.rocAuc ?? null,
    trainedModel?.metrics.prAuc ?? null
  );

  return (
    <div className="space-y-6">
      {/* Quick Upload Callout Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-[#0B1F4B] to-[#1E3A8A] text-white shadow-sm border border-[#1E3A8A]/50">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#C9A227]/20 border border-[#C9A227]/40 flex items-center justify-center text-[#C9A227] shrink-0">
            <Upload size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif font-bold text-base tracking-tight text-white">
                Customer Data Ingestion
              </h2>
              {isSyntheticDemo && (
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#C9A227]/20 text-[#E8D48A] border border-[#C9A227]/30">
                  Currently viewing demo dataset
                </span>
              )}
            </div>
            <p className="text-xs text-[#D9DCE6]/80 mt-0.5">
              Upload customer churn records in CSV, Excel (.xlsx, .xls, .ods), TSV, JSON, or JSON Lines format.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-[#D9DCE6]/70 mr-1">
            <span className="px-1.5 py-0.5 rounded bg-white/10">.CSV</span>
            <span className="px-1.5 py-0.5 rounded bg-white/10">.XLSX</span>
            <span className="px-1.5 py-0.5 rounded bg-white/10">.JSON</span>
          </div>
          <button
            onClick={onOpenUpload}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#C9A227] hover:bg-[#B38F1F] text-[#0B1F4B] font-semibold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Upload size={14} />
            <span>Upload Dataset</span>
          </button>
        </div>
      </div>

      {/* Executive KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard
          title="Total Customers"
          value={kpis.totalCustomers.toLocaleString()}
          subtitle="Portfolio cohort"
          formula={KPI_FORMULAS.totalCustomers}
        />
        <KpiCard
          title="Active Customers"
          value={kpis.activeCustomers.toLocaleString()}
          subtitle="In service"
          formula={KPI_FORMULAS.activeCustomers}
        />
        <KpiCard
          title="Portfolio Churn Rate"
          value={`${kpis.churnRate}%`}
          subtitle="Realized departures"
          formula={KPI_FORMULAS.churnRate}
          highlightColor={kpis.churnRate > 20 ? 'red' : 'default'}
        />
        <KpiCard
          title="Active MRR"
          value={`£${kpis.activeMrr.toLocaleString()}`}
          subtitle="Monthly Recurring Rev"
          formula={KPI_FORMULAS.activeMrr}
          highlightColor="navy"
        />
        <KpiCard
          title="Monthly Revenue at Risk"
          value={`£${kpis.monthlyRevenueAtRisk.toLocaleString()}`}
          subtitle="Predicted monthly exposure"
          formula={KPI_FORMULAS.monthlyRevenueAtRisk}
          highlightColor="gold"
        />
        <KpiCard
          title="12M Expected Loss"
          value={`£${kpis.expectedLoss12M.toLocaleString()}`}
          subtitle="Annualized exposure"
          formula={KPI_FORMULAS.expectedLoss12M}
          highlightColor="red"
        />
        <KpiCard
          title="Critical & High-Risk"
          value={kpis.criticalAndHighRiskCount.toLocaleString()}
          subtitle={`${kpis.highRiskPct}% of active base`}
          formula={KPI_FORMULAS.criticalAndHighRiskCount}
          highlightColor="red"
        />
        <KpiCard
          title="Average Tenure"
          value={`${kpis.avgTenureMonths} mos`}
          subtitle="Relationship length"
          formula={KPI_FORMULAS.avgTenureMonths}
        />
        <KpiCard
          title="Average CSAT"
          value={`${kpis.avgSatisfaction} / 10`}
          subtitle="Customer satisfaction"
          formula={KPI_FORMULAS.avgSatisfaction}
        />
        <KpiCard
          title="Net Promoter Score"
          value={kpis.npsScore > 0 ? `+${kpis.npsScore}` : `${kpis.npsScore}`}
          subtitle={`Scale: ${kpis.npsScaleDetected}`}
          formula={KPI_FORMULAS.npsScore}
          highlightColor={kpis.npsScore < 0 ? 'red' : 'default'}
        />
        <KpiCard
          title="Expiring in 30 Days"
          value={kpis.contractsExpiring30.toLocaleString()}
          subtitle="Immediate renewal sprint"
          formula={KPI_FORMULAS.contractsExpiring30}
          highlightColor={kpis.contractsExpiring30 > 0 ? 'gold' : 'default'}
        />
        <KpiCard
          title="Expiring in 60 Days"
          value={kpis.contractsExpiring60.toLocaleString()}
          subtitle="Upcoming expiry cohort"
          formula={KPI_FORMULAS.contractsExpiring60}
        />
        <KpiCard
          title="Expiring in 90 Days"
          value={kpis.contractsExpiring90.toLocaleString()}
          subtitle="Quarterly renewal pipeline"
          formula={KPI_FORMULAS.contractsExpiring90}
        />
        <KpiCard
          title="Model PR-AUC / ROC"
          value={kpis.modelPrAuc ? `${(kpis.modelPrAuc).toFixed(2)} / ${(kpis.modelAuc || 0).toFixed(2)}` : 'Training...'}
          subtitle={trainedModel?.modelName || 'Native ML'}
          formula="Precision-Recall AUC and ROC-AUC computed on held-out test set."
          highlightColor="navy"
        />
      </div>

      {/* AI Executive Briefing */}
      <ExecutiveSummaryCard
        kpis={kpis}
        onNavigateToRecommendations={() => setTab('recommendations')}
      />

      {/* Primary Visualizations */}
      <DashboardCharts
        records={filteredRecords}
        scoredCustomers={scoredCustomers}
        portfolioChurnRate={kpis.churnRate}
        onApplyFilter={setFilters}
        onSelectCustomer={(id) => {
          selectCustomer(id);
          setTab('riskscoring');
        }}
      />
    </div>
  );
};
