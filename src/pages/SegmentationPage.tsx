import React, { useState, useMemo } from 'react';
import {
  Users2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  Layers,
  Filter,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { generateRuleBasedSegments, runKMeansClustering, CustomerSegmentProfile } from '../engine/segmentation';
import { prepareModelData } from '../engine/features';

export const SegmentationPage: React.FC = () => {
  const { filteredRecords, scoredCustomers, setTab, setFilters } = useAppStore();

  const [mode, setMode] = useState<'rule' | 'ml'>('rule');
  const [kClusters, setKClusters] = useState<number>(4);
  const [selectedSegment, setSelectedSegment] = useState<CustomerSegmentProfile | null>(null);

  // Scored map for fast revenue at risk lookups
  const scoredMap = useMemo(() => {
    const map = new Map();
    scoredCustomers.forEach((s) => map.set(s.customerId, s));
    return map;
  }, [scoredCustomers]);

  // Rule-based segments
  const ruleSegments = useMemo(() => {
    return generateRuleBasedSegments(filteredRecords, scoredMap);
  }, [filteredRecords, scoredMap]);

  // ML K-Means clusters
  const mlSegments = useMemo(() => {
    if (mode !== 'ml' || filteredRecords.length === 0) return [];
    const prepared = prepareModelData(filteredRecords, true);
    return runKMeansClustering(prepared.featureMatrix, filteredRecords, kClusters);
  }, [filteredRecords, mode, kClusters]);

  const activeSegments = mode === 'rule' ? ruleSegments : mlSegments;
  const currentSelected = selectedSegment || activeSegments[0];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
            Customer Segmentation & Strategic Cohorts
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-0.5">
            Rule-based behavioural personas and unsupervised K-Means clustering with multidimensional trait profiling.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F5F6FA] dark:bg-[#0B1F4B] rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium">
            <button
              onClick={() => {
                setMode('rule');
                setSelectedSegment(null);
              }}
              className={`px-3 py-1.5 rounded-md transition-all ${
                mode === 'rule'
                  ? 'bg-white dark:bg-[#1E3A8A] text-[#0B1F4B] dark:text-white shadow-xs font-semibold'
                  : 'text-[#6B7280] hover:text-[#111827] dark:hover:text-white'
              }`}
            >
              Rule-Based Personas ({ruleSegments.length})
            </button>
            <button
              onClick={() => {
                setMode('ml');
                setSelectedSegment(null);
              }}
              className={`px-3 py-1.5 rounded-md transition-all ${
                mode === 'ml'
                  ? 'bg-white dark:bg-[#1E3A8A] text-[#0B1F4B] dark:text-white shadow-xs font-semibold'
                  : 'text-[#6B7280] hover:text-[#111827] dark:hover:text-white'
              }`}
            >
              ML K-Means Clustering
            </button>
          </div>

          {mode === 'ml' && (
            <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span>k =</span>
              <select
                value={kClusters}
                onChange={(e) => setKClusters(Number(e.target.value))}
                className="bg-[#F5F6FA] dark:bg-[#0B1F4B] border border-[#D9DCE6] dark:border-[#1E3A8A] rounded px-2 py-1 text-xs font-mono"
              >
                {[3, 4, 5, 6, 7].map((num) => (
                  <option key={num} value={num}>
                    {num} clusters
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Segment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeSegments.map((segment) => {
          const isSelected = currentSelected?.id === segment.id;
          const isHighRisk = segment.churnIndexVsAverage > 1.25;

          return (
            <div
              key={segment.id}
              onClick={() => setSelectedSegment(segment)}
              className={`cursor-pointer rounded-xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                isSelected
                  ? 'bg-white dark:bg-[#071433] border-[#C9A227] ring-1 ring-[#C9A227]'
                  : 'bg-white dark:bg-[#071433] border-[#D9DCE6] dark:border-[#1E3A8A] hover:border-[#1E3A8A]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white leading-tight">
                    {segment.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      isHighRisk
                        ? 'bg-[#7A0C1E] text-white'
                        : 'bg-[#1E3A8A]/15 text-[#1E3A8A] dark:text-[#E8D48A]'
                    }`}
                  >
                    {segment.churnIndexVsAverage}x Churn
                  </span>
                </div>

                <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mb-4 line-clamp-2">
                  {segment.description}
                </p>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#6B7280]">Size & Share</span>
                    <span className="font-mono font-semibold tabular-nums text-[#111827] dark:text-white">
                      {segment.size.toLocaleString()} ({segment.percentageOfBase}%)
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#6B7280]">Churn Rate</span>
                    <span className={`font-mono font-bold tabular-nums ${isHighRisk ? 'text-[#7A0C1E] dark:text-red-400' : 'text-[#111827] dark:text-white'}`}>
                      {segment.churnRate}%
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#6B7280]">Avg Monthly Charge</span>
                    <span className="font-mono tabular-nums text-[#111827] dark:text-white">
                      £{segment.avgMonthlyCharge.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#6B7280]">Monthly £ at Risk</span>
                    <span className="font-mono font-semibold tabular-nums text-[#C9A227]">
                      £{segment.totalRevenueAtRisk.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Dominant Traits */}
                <div className="space-y-1 mb-4">
                  {segment.dominantCharacteristics.map((trait, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[11px] text-[#6B7280] dark:text-[#D9DCE6]/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] shrink-0" />
                      <span>{trait}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTab('recommendations');
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] transition-colors text-xs font-semibold"
              >
                <Lightbulb size={13} className="text-[#C9A227]" />
                <span>Generate Strategy for Segment</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Selected Segment Deep Dive */}
      {currentSelected && (
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#C9A227]">
                Segment Drill-Down
              </span>
              <h2 className="font-serif text-lg font-bold text-[#0B1F4B] dark:text-white">
                {currentSelected.name}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setTab('recommendations')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] text-xs font-semibold"
              >
                <Sparkles size={13} className="text-[#C9A227]" />
                <span>Synthesize AI Playbook</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
            {/* Demographic and Channel profile */}
            <div>
              <h4 className="text-xs font-semibold text-[#0B1F4B] dark:text-[#E8D48A] mb-3">
                Top Acquisition Channels
              </h4>
              <div className="space-y-2 text-xs">
                {currentSelected.topAcquisitionChannels.map((ch, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B]">
                    <span>{ch.channel}</span>
                    <span className="font-mono font-medium">{ch.count.toLocaleString()} customers</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Churn Reasons */}
            <div>
              <h4 className="text-xs font-semibold text-[#7A0C1E] dark:text-red-400 mb-3">
                Top Cancellation Reasons
              </h4>
              <div className="space-y-2 text-xs">
                {currentSelected.topChurnReasons.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B]">
                    <span className="truncate pr-2">{r.reason}</span>
                    <span className="font-mono font-bold text-[#7A0C1E] dark:text-red-400 shrink-0">
                      {r.percentage}% ({r.count})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Commercial Profile */}
            <div>
              <h4 className="text-xs font-semibold text-[#0B1F4B] dark:text-[#E8D48A] mb-3">
                Advocacy & Lifetime Value
              </h4>
              <div className="p-4 rounded-xl bg-[#F5F6FA] dark:bg-[#0B1F4B] space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Average CSAT:</span>
                  <span className="font-mono font-bold">{currentSelected.avgSatisfaction} / 10</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Average NPS:</span>
                  <span className="font-mono font-bold">{currentSelected.avgNps}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Avg Cumulative LTV:</span>
                  <span className="font-mono font-bold">£{currentSelected.avgLifetimeRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-[#D9DCE6] dark:border-[#1E3A8A] pt-2">
                  <span className="text-[#6B7280]">Total Revenue at Risk:</span>
                  <span className="font-mono font-bold text-[#C9A227]">
                    £{currentSelected.totalRevenueAtRisk.toLocaleString()}/mo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
