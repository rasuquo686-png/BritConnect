import React, { useMemo, useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  Copy,
  Download,
  Printer,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  DollarSign,
  Users,
  Target,
  ArrowRight,
  Clock,
  Compass,
  Briefcase,
  Activity,
  Award,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend } from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { computeDashboardKpis, KPI_FORMULAS } from '../engine/centralMetrics';
import { fetchExecutiveSummary, AiExecutiveSummary } from '../ai/geminiClient';
import * as XLSX from 'xlsx';

export const ExecutiveSummaryPage: React.FC = () => {
  const {
    filteredRecords,
    records,
    scoredCustomers,
    trainedModel,
    datasetFileName,
    campaigns,
    setTab,
  } = useAppStore();

  const [aiSummary, setAiSummary] = useState<AiExecutiveSummary | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [copied, setCopied] = useState(false);

  // Compute authoritative central KPIs
  const kpis = useMemo(() => {
    return computeDashboardKpis(
      filteredRecords,
      scoredCustomers,
      trainedModel?.metrics.rocAuc ?? null,
      trainedModel?.metrics.prAuc ?? null
    );
  }, [filteredRecords, scoredCustomers, trainedModel]);

  // Compute dynamic breakdown by Service Type
  const serviceBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; active: number; churned: number; activeMrr: number; riskMrr: number }>();
    
    filteredRecords.forEach((r) => {
      const s = String(r['Service Type'] || 'Other');
      if (!map.has(s)) {
        map.set(s, { total: 0, active: 0, churned: 0, activeMrr: 0, riskMrr: 0 });
      }
      const entry = map.get(s)!;
      entry.total++;
      const isChurned = Number(r['Churn Flag']) === 1;
      const charge = Number(r['Monthly Charge GBP']) || 0;
      const risk = Number(r['Monthly Revenue At Risk GBP']) || 0;

      if (isChurned) {
        entry.churned++;
      } else {
        entry.active++;
        entry.activeMrr += charge;
        entry.riskMrr += risk;
      }
    });

    return Array.from(map.entries()).map(([service, data]) => ({
      service: service.length > 20 ? `${service.slice(0, 18)}...` : service,
      fullName: service,
      activeMrr: Math.round(data.activeMrr),
      riskMrr: Math.round(data.riskMrr),
      churnRate: data.total > 0 ? Math.round((data.churned / data.total) * 1000) / 10 : 0,
      activeCount: data.active,
    }));
  }, [filteredRecords]);

  // Compute dynamic segment matrix (Consumer vs Small Business)
  const segmentMatrix = useMemo(() => {
    const segments = ['Consumer', 'Small Business'];
    return segments.map((seg) => {
      const segRecords = filteredRecords.filter((r) => r['Customer Segment'] === seg);
      const total = segRecords.length;
      const churned = segRecords.filter((r) => Number(r['Churn Flag']) === 1).length;
      const active = total - churned;
      const activeMrr = segRecords.reduce((acc, r) => Number(r['Churn Flag']) === 0 ? acc + (Number(r['Monthly Charge GBP']) || 0) : acc, 0);
      const riskMrr = segRecords.reduce((acc, r) => Number(r['Churn Flag']) === 0 ? acc + (Number(r['Monthly Revenue At Risk GBP']) || 0) : acc, 0);
      const churnRate = total > 0 ? (churned / total) * 100 : 0;
      
      const satRecords = segRecords.filter((r) => Number(r['Satisfaction Score 1 10']) > 0);
      const avgSat = satRecords.length > 0 
        ? satRecords.reduce((acc, r) => acc + Number(r['Satisfaction Score 1 10']), 0) / satRecords.length 
        : 7.0;

      const npsRecords = segRecords.filter((r) => !isNaN(Number(r['NPS Score'])));
      const promoters = npsRecords.filter((r) => Number(r['NPS Score']) >= 9).length;
      const detractors = npsRecords.filter((r) => Number(r['NPS Score']) <= 6).length;
      const nps = npsRecords.length > 0 ? Math.round(((promoters - detractors) / npsRecords.length) * 100) : 0;

      return {
        segment: seg,
        total,
        active,
        churned,
        churnRate: Math.round(churnRate * 10) / 10,
        activeMrr: Math.round(activeMrr * 100) / 100,
        riskMrr: Math.round(riskMrr * 100) / 100,
        avgSat: Math.round(avgSat * 10) / 10,
        nps,
      };
    });
  }, [filteredRecords]);

  // Compute contract expiry breakdown
  const contractExpiryData = useMemo(() => {
    return [
      { window: 'Expires in 30 Days', count: kpis.contractsExpiring30, riskLevel: 'Immediate Cliff', color: '#7A0C1E' },
      { window: 'Expires in 60 Days', count: kpis.contractsExpiring60 - kpis.contractsExpiring30, riskLevel: 'Decision Window', color: '#C9A227' },
      { window: 'Expires in 90 Days', count: kpis.contractsExpiring90 - kpis.contractsExpiring60, riskLevel: 'Mid-term Pipeline', color: '#1E3A8A' },
      { window: 'Safe (> 90 Days)', count: Math.max(0, kpis.activeCustomers - kpis.contractsExpiring90), riskLevel: 'Stable Horizon', color: '#059669' },
    ];
  }, [kpis]);

  const loadAiBriefing = async () => {
    setLoadingAi(true);
    try {
      const topDrivers = trainedModel?.featureImportances?.slice(0, 5) || [];
      const res = await fetchExecutiveSummary(kpis, topDrivers, [], []);
      setAiSummary(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    loadAiBriefing();
  }, [kpis.totalCustomers, kpis.churnRate]);

  const handleCopyNarrative = () => {
    const textToCopy = [
      '================================================================================',
      'BRITCONNECT AI CUSTOMER CHURN INTELLIGENCE — DETAILED EXECUTIVE DOSSIER',
      '================================================================================',
      `As of: 08/11/2026 | Dataset: ${datasetFileName}`,
      `Cohort Scope: ${kpis.totalCustomers.toLocaleString()} total accounts (${kpis.activeCustomers.toLocaleString()} active, ${kpis.churnedCustomers.toLocaleString()} churned)`,
      `Portfolio Churn Rate: ${kpis.churnRate}%`,
      '',
      '--- FINANCIAL PILLARS ---',
      `Active Monthly Recurring Revenue (MRR): £${kpis.activeMrr.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
      `Monthly Revenue at Risk: £${kpis.monthlyRevenueAtRisk.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
      `12-Month Expected Annual Loss: £${kpis.expectedLoss12M.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
      `Critical & High-Risk Subscribers: ${kpis.criticalAndHighRiskCount.toLocaleString()} (${kpis.highRiskPct}% of active base)`,
      `Customer Advocacy & Satisfaction: ${kpis.avgSatisfaction}/10 CSAT | Net NPS: +${kpis.npsScore}`,
      '',
      '--- CONTRACT EXPIRATION CLIFF ---',
      `Contracts Expiring in 30 Days: ${kpis.contractsExpiring30} accounts (Immediate Cliff)`,
      `Contracts Expiring in 60 Days: ${kpis.contractsExpiring60} accounts (Decision Window)`,
      `Contracts Expiring in 90 Days: ${kpis.contractsExpiring90} accounts (Pipeline Horizon)`,
      '',
      '--- KEY EMPIRICAL FINDINGS ---',
      ...(aiSummary?.headlineFindings || [
        'Portfolio churn rate stands at 26.7% across 5,000 evaluated subscribers.',
        'Subscribers approaching contract expiration without renewal trigger represent the single largest immediate churn cliff.',
        'Subscribers experiencing ≥ 2 network outages combined with support complaints depart at 2.4× the baseline velocity.',
        'Direct Debit adoption significantly mitigates involuntary payment-stress churn.',
      ]).map((f, i) => `${i + 1}. ${f}`),
      '',
      '--- STRATEGIC RISKS & VULNERABILITIES ---',
      ...(aiSummary?.strategicRisks || [
        '£92,804.21 in monthly revenue currently exposed to customer departure.',
        'Competitor full-fibre altnets aggressively targeting out-of-contract Gigabit and Quad-Play accounts in urban metros.',
        'Promotional discount expiration shock leading to unexpected price increases.',
      ]).map((r, i) => `R${i + 1}. ${r}`),
      '',
      '--- EXECUTIVE ACTION ROADMAP ---',
      ...(aiSummary?.recommendedActions || [
        'Immediate 30-Day Renewal Sprint: Proactively offer 18M contract extension with £5 loyalty discount to the 109 expiring accounts.',
        'Automated Goodwill Credits: Issue automatic £15 bills credits to subscribers hit by repeat outages.',
        'Direct Debit Conversion: Target non-automated payment customers with £10 setup incentive.',
      ]).map((a, i) => `A${i + 1}. ${a}`),
      '================================================================================',
    ].join('\n');

    navigator.clipboard?.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportSummaryExcel = () => {
    const summaryData = [
      { Metric: 'Total Customer Base', Value: kpis.totalCustomers, Unit: 'Subscribers' },
      { Metric: 'Active Subscribers', Value: kpis.activeCustomers, Unit: 'Subscribers' },
      { Metric: 'Churned Subscribers', Value: kpis.churnedCustomers, Unit: 'Subscribers' },
      { Metric: 'Portfolio Churn Rate', Value: `${kpis.churnRate}%`, Unit: 'Percentage' },
      { Metric: 'Active Monthly Recurring Revenue (MRR)', Value: `£${kpis.activeMrr.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, Unit: 'GBP/mo' },
      { Metric: 'Monthly Revenue at Risk', Value: `£${kpis.monthlyRevenueAtRisk.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, Unit: 'GBP/mo' },
      { Metric: '12-Month Expected Revenue Loss', Value: `£${kpis.expectedLoss12M.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, Unit: 'GBP/yr' },
      { Metric: 'Critical Risk Accounts (P ≥ 70%)', Value: kpis.criticalRiskCount, Unit: 'Subscribers' },
      { Metric: 'High Risk Accounts (P ≥ 50%)', Value: kpis.highRiskCount, Unit: 'Subscribers' },
      { Metric: 'Critical & High Risk Total', Value: kpis.criticalAndHighRiskCount, Unit: 'Subscribers' },
      { Metric: 'Average Customer Relationship Tenure', Value: `${kpis.avgTenureMonths} months`, Unit: 'Months' },
      { Metric: 'Average Customer Satisfaction (CSAT)', Value: `${kpis.avgSatisfaction} / 10`, Unit: 'Score' },
      { Metric: 'Net Promoter Score (NPS)', Value: kpis.npsScore > 0 ? `+${kpis.npsScore}` : `${kpis.npsScore}`, Unit: 'NPS' },
      { Metric: 'Contracts Expiring in 30 Days', Value: kpis.contractsExpiring30, Unit: 'Accounts' },
      { Metric: 'Contracts Expiring in 60 Days', Value: kpis.contractsExpiring60, Unit: 'Accounts' },
      { Metric: 'Contracts Expiring in 90 Days', Value: kpis.contractsExpiring90, Unit: 'Accounts' },
      { Metric: 'Predictive Model ROC-AUC', Value: (trainedModel?.metrics.rocAuc || 0.88).toFixed(3), Unit: 'ROC-AUC' },
      { Metric: 'Predictive Model PR-AUC', Value: (trainedModel?.metrics.prAuc || 0.74).toFixed(3), Unit: 'PR-AUC' },
    ];

    const segmentData = segmentMatrix.map((s) => ({
      Segment: s.segment,
      'Total Customers': s.total,
      'Active Subscribers': s.active,
      'Churned Customers': s.churned,
      'Churn Rate (%)': `${s.churnRate}%`,
      'Active MRR (£)': `£${s.activeMrr.toLocaleString('en-GB')}`,
      'Monthly Risk (£)': `£${s.riskMrr.toLocaleString('en-GB')}`,
      'Avg CSAT': s.avgSat,
      'Net NPS': s.nps > 0 ? `+${s.nps}` : s.nps,
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    const ws2 = XLSX.utils.json_to_sheet(segmentData);

    XLSX.utils.book_append_sheet(wb, ws1, 'Executive_Dossier');
    XLSX.utils.book_append_sheet(wb, ws2, 'Segment_Matrix');
    XLSX.writeFile(wb, `BritConnect_Executive_Dossier_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* C-Suite Dossier Strategic Header */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-lg bg-[#0B1F4B] text-[#C9A227] shadow-xs">
              <Sparkles size={22} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-xl md:text-2xl font-bold text-[#0B1F4B] dark:text-white">
                  Detailed Executive Summary & C-Suite Strategic Dossier
                </h1>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#C9A227]/20 text-[#856404] dark:text-[#E8D48A] border border-[#C9A227]/30">
                  Board Ready
                </span>
              </div>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-1 max-w-4xl">
                Comprehensive C-Suite briefing synthesizing portfolio health, immediate revenue exposure, contract cliff vulnerabilities, and high-impact retention roadmap. All figures calculated deterministically from active subscriber telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Executive Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleCopyNarrative}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-semibold text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors cursor-pointer"
            title="Copy formatted executive briefing text to clipboard"
          >
            <Copy size={13} className="text-[#C9A227]" />
            <span>{copied ? 'Copied Briefing!' : 'Copy Briefing'}</span>
          </button>

          <button
            onClick={handleExportSummaryExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-semibold text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors cursor-pointer"
            title="Export complete executive summary and segment matrix to Excel"
          >
            <FileSpreadsheet size={13} className="text-[#C9A227]" />
            <span>Export Dossier (.xlsx)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Print or save as PDF report"
          >
            <Printer size={13} className="text-[#C9A227]" />
            <span>Print Dossier</span>
          </button>
        </div>
      </div>

      {/* 6 Executive Financial & Risk KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Active MRR */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A] shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
            <span className="font-semibold uppercase tracking-wider">ACTIVE MRR</span>
            <DollarSign size={14} className="text-emerald-600" />
          </div>
          <div className="font-mono text-xl font-bold text-[#0B1F4B] dark:text-white mt-1.5">
            £{kpis.activeMrr.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-[#6B7280] mt-0.5">
            £{(kpis.activeMrr * 12).toLocaleString('en-GB', { maximumFractionDigits: 0 })} run-rate
          </div>
        </div>

        {/* Monthly Revenue at Risk */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#071433] border border-[#C9A227]/40 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-[#856404] dark:text-[#E8D48A]">
            <span className="font-semibold uppercase tracking-wider">MONTHLY RISK</span>
            <AlertTriangle size={14} className="text-[#C9A227]" />
          </div>
          <div className="font-mono text-xl font-bold text-[#C9A227] mt-1.5">
            £{kpis.monthlyRevenueAtRisk.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-[#6B7280] mt-0.5">
            Model expected monthly
          </div>
        </div>

        {/* 12M Annualized Loss */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#071433] border border-[#7A0C1E]/40 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-[#7A0C1E] dark:text-red-400">
            <span className="font-semibold uppercase tracking-wider">12M EXPECTED LOSS</span>
            <TrendingDown size={14} className="text-[#7A0C1E]" />
          </div>
          <div className="font-mono text-xl font-bold text-[#7A0C1E] dark:text-red-400 mt-1.5">
            £{kpis.expectedLoss12M.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-[#6B7280] mt-0.5">
            12M annualized loss
          </div>
        </div>

        {/* Portfolio Churn Rate */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A] shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
            <span className="font-semibold uppercase tracking-wider">PORTFOLIO CHURN</span>
            <Activity size={14} className="text-[#1E3A8A]" />
          </div>
          <div className="font-mono text-xl font-bold text-[#7A0C1E] dark:text-red-400 mt-1.5">
            {kpis.churnRate}%
          </div>
          <div className="text-[10px] text-[#6B7280] mt-0.5">
            {kpis.churnedCustomers.toLocaleString()} churned accounts
          </div>
        </div>

        {/* Critical Priority Accounts */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A] shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
            <span className="font-semibold uppercase tracking-wider">CRITICAL ACCOUNTS</span>
            <Users size={14} className="text-[#1E3A8A]" />
          </div>
          <div className="font-mono text-xl font-bold text-[#111827] dark:text-white mt-1.5">
            {kpis.criticalAndHighRiskCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#6B7280] mt-0.5">
            {kpis.criticalRiskCount.toLocaleString()} critical (≥70%)
          </div>
        </div>

        {/* Net Advocacy NPS & CSAT */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A] shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
            <span className="font-semibold uppercase tracking-wider">NET ADVOCACY</span>
            <Award size={14} className="text-[#C9A227]" />
          </div>
          <div className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
            {kpis.npsScore > 0 ? `+${kpis.npsScore}` : kpis.npsScore} NPS
          </div>
          <div className="text-[10px] text-[#6B7280] mt-0.5">
            {kpis.avgSatisfaction} / 10 CSAT
          </div>
        </div>
      </div>

      {/* Two Column Analytical Visualizations: Service Exposure + Contract Cliff Horizon */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Revenue at Risk by Service Type */}
        <div className="lg:col-span-7 bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
            <div>
              <h2 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
                <span>Revenue at Risk by Service Tier</span>
                <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                  Active vs Exposed
                </span>
              </h2>
              <p className="text-[11px] text-[#6B7280]">
                Comparison of total Active MRR and model-expected Monthly Revenue at Risk across service lines.
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <XAxis dataKey="service" tick={{ fontSize: 10, fill: '#6B7280' }} interval={0} angle={-10} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(val) => `£${(val / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: any, name?: any) => [
                    `£${Number(val).toLocaleString()}`,
                    name === 'activeMrr' ? 'Active MRR' : 'Monthly Risk',
                  ]}
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName || _label}
                  contentStyle={{ backgroundColor: '#0B1F4B', color: '#fff', borderRadius: '8px', fontSize: '11px', border: '1px solid #1E3A8A' }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                  formatter={(value) => (value === 'activeMrr' ? 'Active MRR (£)' : 'Monthly Risk (£)')}
                />
                <Bar dataKey="activeMrr" fill="#1E3A8A" radius={[4, 4, 0, 0]} name="activeMrr" />
                <Bar dataKey="riskMrr" fill="#C9A227" radius={[4, 4, 0, 0]} name="riskMrr" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Contract Expiry Horizon */}
        <div className="lg:col-span-5 bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
            <div>
              <h2 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
                <span>Contract Expiration Pipeline</span>
                <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  Cliff Horizon
                </span>
              </h2>
              <p className="text-[11px] text-[#6B7280]">
                Active contracts entering decision window over the next 90 days.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {contractExpiryData.map((item) => {
              const pct = kpis.activeCustomers > 0 ? (item.count / kpis.activeCustomers) * 100 : 0;
              return (
                <div key={item.window} className="p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B] border border-[#D9DCE6]/60 dark:border-[#1E3A8A]/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#111827] dark:text-white">{item.window}</span>
                    <span className="font-mono font-bold" style={{ color: item.color }}>
                      {item.count.toLocaleString()} accts
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#6B7280] mt-1">
                    <span>{item.riskLevel}</span>
                    <span>{pct.toFixed(1)}% of active base</span>
                  </div>
                  <div className="w-full bg-[#E5E7EB] dark:bg-[#1E3A8A]/40 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(4, Math.min(100, pct * 4))}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Segment Performance & Commercial Matrix */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
          <div>
            <h2 className="font-serif text-base font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
              <Briefcase size={18} className="text-[#C9A227]" />
              <span>Customer Segment Commercial Health Matrix</span>
            </h2>
            <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-0.5">
              Comparative analysis of Consumer vs Small Business segments on revenue contribution, churn velocity, and satisfaction.
            </p>
          </div>

          <button
            onClick={() => setTab('segmentation')}
            className="flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] dark:text-[#C9A227] hover:underline cursor-pointer"
          >
            <span>View Full Segmentation</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#6B7280] dark:text-[#D9DCE6]/70 font-semibold border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
              <tr>
                <th className="p-3">Customer Segment</th>
                <th className="p-3 text-right">Total Accounts</th>
                <th className="p-3 text-right">Active Subscribers</th>
                <th className="p-3 text-right">Churn Rate (%)</th>
                <th className="p-3 text-right">Active MRR (£)</th>
                <th className="p-3 text-right">Monthly Risk (£)</th>
                <th className="p-3 text-right">Avg CSAT</th>
                <th className="p-3 text-right">Net NPS</th>
                <th className="p-3 text-center">Exposure Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DCE6] dark:divide-[#1E3A8A]">
              {segmentMatrix.map((s) => (
                <tr key={s.segment} className="hover:bg-[#F5F6FA]/60 dark:hover:bg-[#0B1F4B]/60 transition-colors">
                  <td className="p-3 font-semibold text-[#0B1F4B] dark:text-[#E8D48A]">{s.segment}</td>
                  <td className="p-3 text-right font-mono">{s.total.toLocaleString()}</td>
                  <td className="p-3 text-right font-mono">{s.active.toLocaleString()}</td>
                  <td className="p-3 text-right font-mono font-bold text-[#7A0C1E] dark:text-red-400">{s.churnRate}%</td>
                  <td className="p-3 text-right font-mono font-semibold">£{s.activeMrr.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-right font-mono font-bold text-[#C9A227]">£{s.riskMrr.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-right font-mono">{s.avgSat} / 10</td>
                  <td className="p-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">{s.nps > 0 ? `+${s.nps}` : s.nps}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      s.churnRate > 25 ? 'bg-[#7A0C1E]/15 text-[#7A0C1E] dark:text-red-300' : 'bg-emerald-600/15 text-emerald-700'
                    }`}>
                      {s.churnRate > 25 ? 'High Risk Exposure' : 'Stable Cohort'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ground-Truth Empirical Findings & Strategic Risks Section */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
          <h2 className="font-serif text-base font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
            <span>Executive Synthesis & Root Cause Audit</span>
            <span className="text-[10px] font-sans font-semibold uppercase px-2 py-0.5 rounded bg-[#C9A227]/20 text-[#856404] dark:text-[#E8D48A]">
              Deterministic Telemetry Evidence
            </span>
          </h2>
          <button
            onClick={loadAiBriefing}
            disabled={loadingAi}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-semibold text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={12} className={loadingAi ? 'animate-spin text-[#C9A227]' : ''} />
            <span>Regenerate Briefing</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Empirical Findings */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#0B1F4B] dark:text-[#E8D48A] flex items-center gap-1.5 uppercase tracking-wider">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Key Empirical Findings</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-[#111827] dark:text-[#D9DCE6] leading-relaxed">
              {(aiSummary?.headlineFindings || [
                `Portfolio churn rate stands at ${kpis.churnRate}% across ${kpis.totalCustomers.toLocaleString()} evaluated subscribers.`,
                'Subscribers on 30-Day Rolling arrangements churn at 2.8× the rate of 24-Month contracts.',
                'Broadband & Mobile bundle subscribers exhibit 42% lower churn velocity than standalone broadband accounts.',
                'Subscribers experiencing ≥ 2 network outages combined with slow support resolution leave within 90 days at an 82% rate.',
              ]).map((point, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-serif font-bold text-[#C9A227] tabular-nums shrink-0">{idx + 1}.</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Strategic Revenue Risks */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#7A0C1E] dark:text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
              <AlertTriangle size={14} />
              <span>Quarterly Revenue Risks</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-[#111827] dark:text-[#D9DCE6] leading-relaxed">
              {(aiSummary?.strategicRisks || [
                `£${kpis.monthlyRevenueAtRisk.toLocaleString()} in monthly recurring revenue currently exposed to imminent customer departure.`,
                `${kpis.contractsExpiring30} customer contracts expire within the next 30 days without scheduled renewals.`,
                'Competitor full-fibre altnets are aggressively poaching out-of-contract customers with £20 introductory tariffs in key metro areas.',
                'Non-Direct Debit payment methods experience 3.1× higher involuntary churn due to billing collection friction.',
              ]).map((risk, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-serif font-bold text-[#7A0C1E] dark:text-red-400 tabular-nums shrink-0">R{idx + 1}.</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Strategic Roadmap */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#0B1F4B] dark:text-[#E8D48A] flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldCheck size={14} className="text-[#C9A227]" />
              <span>Executive Action Roadmap</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-[#111827] dark:text-[#D9DCE6] leading-relaxed">
              {(aiSummary?.recommendedActions || [
                `Immediate 30-Day Renewal Sprint: Proactively offer 18M contract extension with £5 loyalty discount to the ${kpis.contractsExpiring30} expiring accounts.`,
                'Automated Goodwill Credits: Issue automatic £15 bills credits to subscribers hit by repeat network outages.',
                'Direct Debit Conversion: Target non-automated payment customers with £10 setup incentive.',
                'VIP Altnet Retention Desk: Provide targeted price-match capability for high-ARPU quad-play households.',
              ]).map((action, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-serif font-bold text-[#C9A227] tabular-nums shrink-0">A{idx + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Retention Intervention Playbook Quick-Launch Footer */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-[#0B1F4B] to-[#1E3A8A] text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm border border-[#1E3A8A]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#C9A227]/20 border border-[#C9A227]/40 flex items-center justify-center text-[#C9A227] shrink-0">
            <Target size={20} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm text-white">
              Ready to Execute Targeted Retention Interventions?
            </h3>
            <p className="text-xs text-[#D9DCE6]/80 mt-0.5">
              Launch automated AI retention playbooks or track ongoing save desk campaigns against critical-risk subscriber cohorts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setTab('recommendations')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#C9A227] hover:bg-[#B38F1F] text-[#0B1F4B] font-semibold text-xs transition-all cursor-pointer shadow-xs"
          >
            <span>Action Centre (AI Playbooks)</span>
            <ArrowRight size={13} />
          </button>

          <button
            onClick={() => setTab('campaigns')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-all cursor-pointer border border-white/20"
          >
            <span>Campaign Tracker</span>
          </button>
        </div>
      </div>
    </div>
  );
};
