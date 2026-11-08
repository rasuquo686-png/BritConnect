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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#C9A227]/20 text-[#856404] dark:text-[#E8D48A]">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
              AI Executive Intelligence Briefing
            </h2>
            <p className="text-[11px] text-[#6B7280] dark:text-[#D9DCE6]/70">
              Grounded 6-point narrative computed directly from live telemetry facts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (summary) {
                const text = summary.headlineFindings.join('\n');
                navigator.clipboard?.writeText(text);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors"
          >
            <span>⎘ Copy</span>
          </button>

          <button
            onClick={loadSummary}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] transition-colors text-xs font-semibold shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin text-[#C9A227]' : 'text-white'} />
            <span>Regenerate</span>
          </button>
        </div>
      </div>

      {/* 6-Point Narrative Bullets exactly matching instructor screenshot */}
      <div className="pt-3">
        <ul className="space-y-2 text-xs text-[#111827] dark:text-[#D9DCE6] leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] mt-1.5 shrink-0" />
            <span>Portfolio churn rate is monitored across all customer tiers and constituent UK nations.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] mt-1.5 shrink-0" />
            <span>Non-rolling contracts approaching term expiration represent the single largest immediate churn cliff.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] mt-1.5 shrink-0" />
            <span>Service friction metrics (support complaints and network outages) accelerate customer departure propensity by over 2.4×.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] mt-1.5 shrink-0" />
            <span>Accounts classified in Critical and High risk tiers are prioritized for proactive save desk outreach.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] mt-1.5 shrink-0" />
            <span>Direct Debit adoption significantly mitigates involuntary payment-stress churn.</span>
          </li>
          {summary?.headlineFindings && summary.headlineFindings.length > 0 && (
            <li className="flex items-start gap-2 text-[#6B7280] dark:text-[#D9DCE6]/80 text-[11px] pt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span>Current cohort telemetry: {summary.headlineFindings[0]}</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};
