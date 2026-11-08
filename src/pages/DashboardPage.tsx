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

      {/* Executive KPI Cards: Row 1 (6 cards) & Row 2 (6 cards) matching instructor layout */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Row 1, Card 1: TOTAL CUSTOMERS */}
        <KpiCard
          title="TOTAL CUSTOMERS"
          value={kpis.totalCustomers.toLocaleString()}
          subtitle={`${kpis.activeCustomers.toLocaleString()} active`}
          formula={KPI_FORMULAS.totalCustomers}
        />

        {/* Row 1, Card 2: PORTFOLIO CHURN */}
        <KpiCard
          title="PORTFOLIO CHURN"
          value={`${kpis.churnRate}%`}
          subtitle={`${kpis.churnedCustomers.toLocaleString()} churned / ${kpis.totalCustomers.toLocaleString()} total evaluat...`}
          formula={KPI_FORMULAS.churnRate}
          highlightColor={kpis.churnRate > 20 ? 'red' : 'default'}
        />

        {/* Row 1, Card 3: ACTIVE MRR */}
        <KpiCard
          title="ACTIVE MRR"
          value={`£${kpis.activeMrr.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`Eff: £${kpis.activeMrr.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          formula={KPI_FORMULAS.activeMrr}
        />

        {/* Row 1, Card 4: MONTHLY RISK */}
        <KpiCard
          title="MONTHLY RISK"
          value={`£${kpis.monthlyRevenueAtRisk.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Model expected monthly"
          formula={KPI_FORMULAS.monthlyRevenueAtRisk}
          highlightColor="gold"
        />

        {/* Row 1, Card 5: 12M EXPECTED LOSS */}
        <KpiCard
          title="12M EXPECTED LOSS"
          value={`£${kpis.expectedLoss12M.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="12M annualized loss"
          formula={KPI_FORMULAS.expectedLoss12M}
        />

        {/* Row 1, Card 6: CRITICAL & HIGH RISK */}
        <KpiCard
          title="CRITICAL & HIGH RISK"
          value={kpis.criticalAndHighRiskCount.toLocaleString()}
          subtitle={`${kpis.criticalRiskCount.toLocaleString()} critical (≥70%)`}
          formula={KPI_FORMULAS.criticalAndHighRiskCount}
          highlightColor="red"
        />

        {/* Row 2, Card 1: AVERAGE TENURE */}
        <KpiCard
          title="AVERAGE TENURE"
          value={`${kpis.avgTenureMonths}m`}
          subtitle="Relationship length"
          formula={KPI_FORMULAS.avgTenureMonths}
        />

        {/* Row 2, Card 2: AVERAGE CSAT */}
        <KpiCard
          title="AVERAGE CSAT"
          value={`${kpis.avgSatisfaction} / 10`}
          subtitle="Satisfaction score"
          formula={KPI_FORMULAS.avgSatisfaction}
        />

        {/* Row 2, Card 3: NET NPS */}
        <KpiCard
          title="NET NPS"
          value={kpis.npsScore > 0 ? `+${kpis.npsScore}` : `${kpis.npsScore}`}
          subtitle="Direct Net Promoter advocacy in..."
          formula={KPI_FORMULAS.npsScore}
        />

        {/* Row 2, Card 4: EXPIRES IN 30 DAYS */}
        <KpiCard
          title="EXPIRES IN 30 DAYS"
          value={`${kpis.contractsExpiring30} accts`}
          subtitle="Imminent contract cliff"
          formula={KPI_FORMULAS.contractsExpiring30}
          highlightColor={kpis.contractsExpiring30 > 0 ? 'red' : 'default'}
        />

        {/* Row 2, Card 5: EXPIRES IN 60 DAYS */}
        <KpiCard
          title="EXPIRES IN 60 DAYS"
          value={`${kpis.contractsExpiring60} accts`}
          subtitle="Renewal decision window"
          formula={KPI_FORMULAS.contractsExpiring60}
          highlightColor="gold"
        />

        {/* Row 2, Card 6: EXPIRES IN 90 DAYS */}
        <KpiCard
          title="EXPIRES IN 90 DAYS"
          value={`${kpis.contractsExpiring90} accts`}
          subtitle="Mid-term pipeline"
          formula={KPI_FORMULAS.contractsExpiring90}
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
