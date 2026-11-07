import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle2, ChevronRight, ShieldCheck } from 'lucide-react';
import { DashboardKpiSummary } from '../../engine/centralMetrics';
import { fetchExecutiveSummary, AiExecutiveSummary } from '../../ai/geminiClient';

interface ExecutiveSummaryCardProps {
  kpis: DashboardKpiSummary;
  onNavigateToRecommendations: () => void;
}

export const ExecutiveSummaryCard: React.FC<ExecutiveSummaryCardProps> = ({
  kpis,
  onNavigateToRecommendations,
}) => {
  const [summary, setSummary] = useState<AiExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const result = await fetchExecutiveSummary(kpis, [], [], []);
      setSummary(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [kpis.churnRate, kpis.totalCustomers]);

  return (
    <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#0B1F4B] text-[#C9A227]">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
              Executive Churn Intelligence Briefing
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#C9A227]/15 text-[#856404] dark:text-[#E8D48A] border border-[#C9A227]/30">
                Ground-Truth AI
              </span>
            </h2>
            <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
              Deterministic evidence synthesis and strategic retention roadmap for BritConnect leadership
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSummary}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#C9A227]' : 'text-[#6B7280]'} />
            <span>Refresh Analysis</span>
          </button>

          <button
            onClick={onNavigateToRecommendations}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] transition-colors text-xs font-semibold shadow-xs"
          >
            <span>View Playbooks</span>
            <ChevronRight size={14} className="text-[#C9A227]" />
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* 1. Headline Findings (5 items) */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B1F4B] dark:text-[#E8D48A] mb-3">
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Key Empirical Findings</span>
          </div>
          <ul className="space-y-2 text-xs text-[#111827] dark:text-[#D9DCE6] leading-relaxed">
            {summary?.headlineFindings.map((finding, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-serif font-bold text-[#C9A227] text-sm tabular-nums shrink-0">
                  {idx + 1}.
                </span>
                <span>{finding}</span>
              </li>
            )) || (
              <li className="text-[#6B7280]">Synthesizing portfolio findings...</li>
            )}
          </ul>
        </div>

        {/* 2. Strategic Risks (3 items) */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#7A0C1E] dark:text-red-400 mb-3">
            <AlertTriangle size={14} />
            <span>Quarterly Revenue Risks</span>
          </div>
          <ul className="space-y-2 text-xs text-[#111827] dark:text-[#D9DCE6] leading-relaxed">
            {summary?.strategicRisks.map((risk, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-serif font-bold text-[#7A0C1E] dark:text-red-400 text-sm tabular-nums shrink-0">
                  R{idx + 1}.
                </span>
                <span>{risk}</span>
              </li>
            )) || (
              <li className="text-[#6B7280]">Evaluating risk exposures...</li>
            )}
          </ul>
        </div>

        {/* 3. Recommended Interventions (3 items) */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B1F4B] dark:text-[#E8D48A] mb-3">
            <ShieldCheck size={14} className="text-[#C9A227]" />
            <span>Recommended Interventions</span>
          </div>
          <ul className="space-y-2 text-xs text-[#111827] dark:text-[#D9DCE6] leading-relaxed">
            {summary?.recommendedActions.map((action, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-serif font-bold text-[#C9A227] text-sm tabular-nums shrink-0">
                  A{idx + 1}.
                </span>
                <span>{action}</span>
              </li>
            )) || (
              <li className="text-[#6B7280]">Generating recommended actions...</li>
            )}
          </ul>
        </div>
      </div>

      {/* Verification footer note */}
      <div className="mt-4 pt-3 border-t border-[#D9DCE6]/60 dark:border-[#1E3A8A]/50 flex items-center justify-between text-[11px] text-[#6B7280] dark:text-[#D9DCE6]/60">
        <span>AI-generated strategic synthesis grounded exclusively in user-uploaded data. Verify operational details before campaign execution.</span>
        <span className="font-mono">Gemini 3.8 Flash · Temperature ≤ 0.3</span>
      </div>
    </div>
  );
};
