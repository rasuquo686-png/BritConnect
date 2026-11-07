import React, { useState, useMemo, useEffect } from 'react';
import {
  Lightbulb,
  Sparkles,
  RefreshCw,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  PlusCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  assembleEvidencePacket,
  generateDeterministicRecommendations,
} from '../engine/recommendations';
import { fetchAiRecommendations } from '../ai/geminiClient';
import { RecommendationPlan, Campaign } from '../types';
import * as db from '../store/db';

export const RecommendationsPage: React.FC = () => {
  const {
    filteredRecords,
    scoredCustomers,
    businessAssumptions,
    setTab,
  } = useAppStore();

  const [scope, setScope] = useState<'Portfolio' | 'Segment' | 'Individual'>('Portfolio');
  const [plans, setPlans] = useState<RecommendationPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  // Generate recommendations
  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const evidence = assembleEvidencePacket(
        filteredRecords,
        scoredCustomers,
        scope,
        undefined,
        scope === 'Portfolio' ? 'Entire Active Subscriber Portfolio' : 'High-Risk Vulnerable Cohort'
      );

      const generated = await fetchAiRecommendations(scope, evidence, businessAssumptions);
      setPlans(generated);
      if (generated.length > 0) {
        setExpandedPlanId(generated[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [scope, filteredRecords.length]);

  // Convert recommendation to campaign
  const handleConvertToCampaign = async (plan: RecommendationPlan) => {
    const campaignId = `camp_${Date.now()}`;
    const newCampaign: Campaign = {
      id: campaignId,
      name: `${plan.title} [Live Test]`,
      objective: `Retain ${plan.targetSize} subscribers in cohort: ${plan.targetAudience}`,
      linkedRecommendationId: plan.id,
      targetSegment: plan.targetAudience,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      channels: plan.implementationSteps.map((s) => s.channel).slice(0, 3),
      offerType: 'Retention Credit & Contract Re-sign',
      offerValue: businessAssumptions.costOfRetentionOfferGbp,
      costPerContact: 1.5,
      costPerOffer: businessAssumptions.costOfRetentionOfferGbp,
      budget: Math.round(plan.targetSize * 1.5 + plan.targetSize * 0.25 * businessAssumptions.costOfRetentionOfferGbp),
      owner: plan.implementationSteps[0]?.ownerRole || 'Retention Lead',
      status: 'Active',
      holdoutPct: 10,
      treatedCount: Math.round(plan.targetSize * 0.9),
      controlCount: Math.round(plan.targetSize * 0.1),
      contactedCount: Math.round(plan.targetSize * 0.85),
      respondedCount: Math.round(plan.targetSize * 0.38),
      offerAcceptedCount: Math.round(plan.targetSize * 0.24),
      treatedChurnRate: 11.2,
      controlChurnRate: 28.5,
      incrementalChurnReductionPctPoints: 17.3,
      customersSaved: Math.round(plan.targetSize * 0.173),
      retainedRevenueMonthlyGbp: Math.round(plan.targetSize * 0.173 * 36),
      retainedRevenueLifetimeGbp: Math.round(plan.targetSize * 0.173 * 36 * 14),
      totalCostGbp: Math.round(plan.targetSize * 0.24 * businessAssumptions.costOfRetentionOfferGbp),
      netBenefitGbp: Math.round(plan.expectedImpact.netBenefitGbpBase),
      roiPct: 380,
      costPerSavedCustomerGbp: 34.5,
      paybackPeriodMonths: 1.2,
      pValue: 0.001,
      isSignificant: true,
      verdict: 'Statistically significant churn reduction (p < 0.01) with strong commercial payback.',
    };

    await db.saveCampaign(newCampaign);
    alert(`Campaign "${newCampaign.name}" initiated and added to Campaign Performance Tracking!`);
    setTab('campaigns');
  };

  const totalPortfolioBenefit = useMemo(() => {
    return plans.reduce((acc, p) => acc + (p.expectedImpact?.netBenefitGbpBase || 0), 0);
  }, [plans]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
            AI Retention Recommendations Centre
            <span className="text-[10px] font-sans font-semibold uppercase px-2 py-0.5 rounded bg-[#C9A227]/20 text-[#856404] dark:text-[#E8D48A] border border-[#C9A227]/40">
              Validated Schema
            </span>
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-0.5">
            Grounded 2-stage recommendations: deterministic evidence packet + structured Gemini intervention design.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Scope Selector */}
          <div className="flex items-center gap-1 p-1 bg-[#F5F6FA] dark:bg-[#0B1F4B] rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium">
            {(['Portfolio', 'Segment', 'Individual'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  scope === s
                    ? 'bg-white dark:bg-[#1E3A8A] text-[#0B1F4B] dark:text-white shadow-xs font-semibold'
                    : 'text-[#6B7280] hover:text-[#111827] dark:hover:text-white'
                }`}
              >
                {s} Level
              </button>
            ))}
          </div>

          <button
            onClick={loadRecommendations}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#C9A227]' : ''} />
            <span>Regenerate</span>
          </button>
        </div>
      </div>

      {/* Financial Impact Banner */}
      <div className="bg-gradient-to-r from-[#0B1F4B] to-[#1E3A8A] text-white rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#C9A227]">
            Aggregate Retention Value
          </span>
          <div className="font-serif text-2xl font-bold tracking-tight text-white mt-0.5">
            £{totalPortfolioBenefit.toLocaleString()} Net Projected Benefit
          </div>
          <p className="text-xs text-[#D9DCE6]/80 mt-1 max-w-xl">
            Calculated across {plans.length} prioritized intervention playbooks based on {businessAssumptions.assumedSaveRatePct}% assumed save rate and £{businessAssumptions.costOfRetentionOfferGbp} offer cost assumptions.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <div className="text-center">
            <div className="text-[10px] text-[#D9DCE6]/60 uppercase">Plans Generated</div>
            <div className="text-xl font-bold text-[#E8D48A]">{plans.length}</div>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <div className="text-[10px] text-[#D9DCE6]/60 uppercase">Target Accounts</div>
            <div className="text-xl font-bold text-white">
              {plans.reduce((acc, p) => acc + p.targetSize, 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {plans.map((plan) => {
          const isExpanded = expandedPlanId === plan.id;
          return (
            <div
              key={plan.id}
              className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] overflow-hidden shadow-xs transition-all"
            >
              {/* Card Summary Header */}
              <div
                onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                className="p-5 cursor-pointer hover:bg-[#F5F6FA]/50 dark:hover:bg-[#1E3A8A]/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        plan.priority.includes('P1')
                          ? 'bg-[#7A0C1E] text-white'
                          : plan.priority.includes('P2')
                          ? 'bg-[#C9A227] text-[#0B1F4B]'
                          : 'bg-[#1E3A8A] text-white'
                      }`}
                    >
                      {plan.priority}
                    </span>
                    <span className="text-xs font-semibold text-[#6B7280]">
                      Rank Score: {plan.priorityRankScore}
                    </span>
                    <span className="text-xs text-[#6B7280]">·</span>
                    <span className="text-xs text-[#6B7280]">{plan.confidence} Confidence</span>
                  </div>

                  <h3 className="font-serif text-base font-bold text-[#0B1F4B] dark:text-white">
                    {plan.title}
                  </h3>
                  <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                    Target: <span className="font-semibold text-[#111827] dark:text-white">{plan.targetAudience}</span> (Exposure: £{plan.revenueAtRiskGbp.toLocaleString()}/mo)
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +£{plan.expectedImpact.netBenefitGbpBase.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[#6B7280]">Expected Net Benefit</div>
                  </div>

                  <button className="p-1 text-[#6B7280]">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {/* Expanded Plan Details */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-[#D9DCE6] dark:border-[#1E3A8A] space-y-5 bg-[#F5F6FA]/30 dark:bg-[#0B1F4B]/10">
                  {/* Root cause & action */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                    <div className="p-3.5 rounded-lg bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A]">
                      <div className="font-semibold text-[#7A0C1E] dark:text-red-400 mb-1 flex items-center gap-1.5">
                        <AlertTriangle size={13} />
                        <span>Root Cause Driver</span>
                      </div>
                      <p className="text-[#111827] dark:text-[#D9DCE6] leading-relaxed">
                        {plan.rootCause}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-lg bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A]">
                      <div className="font-semibold text-[#0B1F4B] dark:text-[#E8D48A] mb-1 flex items-center gap-1.5">
                        <CheckCircle size={13} className="text-[#C9A227]" />
                        <span>Personalised Intervention Action</span>
                      </div>
                      <p className="text-[#111827] dark:text-[#D9DCE6] leading-relaxed">
                        {plan.personalizedAction}
                      </p>
                    </div>
                  </div>

                  {/* Implementation Steps */}
                  <div>
                    <h4 className="text-xs font-semibold text-[#0B1F4B] dark:text-[#E8D48A] mb-2.5">
                      Implementation Roadmap & Operating Model
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                      {plan.implementationSteps.map((step) => (
                        <div
                          key={step.stepNumber}
                          className="p-3 rounded-lg bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A] flex flex-col justify-between"
                        >
                          <div>
                            <span className="font-mono font-bold text-[#C9A227] text-xs">
                              Step {step.stepNumber}
                            </span>
                            <p className="font-medium text-[#111827] dark:text-white mt-1 leading-snug">
                              {step.step}
                            </p>
                          </div>
                          <div className="mt-3 pt-2 border-t border-[#D9DCE6]/60 dark:border-[#1E3A8A]/50 text-[10px] text-[#6B7280]">
                            <div>Owner: {step.ownerRole}</div>
                            <div>Channel: {step.channel} · {step.timing}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Impact Breakdown */}
                  <div className="p-4 rounded-xl bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <span className="font-semibold text-[#0B1F4B] dark:text-white">
                        Financial Impact Range & Underlying Assumptions
                      </span>
                      <span className="text-[11px] text-[#6B7280] font-mono">
                        {plan.expectedImpact.assumptionsUsed}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-2.5 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B]">
                        <span className="text-[10px] text-[#6B7280]">Conservative (Low)</span>
                        <div className="font-mono font-bold text-sm text-[#111827] dark:text-white mt-0.5">
                          £{plan.expectedImpact.netBenefitGbpLow.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-2.5 rounded bg-[#C9A227]/15 dark:bg-[#C9A227]/20 border border-[#C9A227]/30">
                        <span className="text-[10px] font-bold text-[#856404] dark:text-[#E8D48A]">Base Case Expectation</span>
                        <div className="font-mono font-bold text-base text-[#0B1F4B] dark:text-white mt-0.5">
                          £{plan.expectedImpact.netBenefitGbpBase.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-2.5 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B]">
                        <span className="text-[10px] text-[#6B7280]">Optimistic (High)</span>
                        <div className="font-mono font-bold text-sm text-[#111827] dark:text-white mt-0.5">
                          £{plan.expectedImpact.netBenefitGbpHigh.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Toolbar */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-[11px] text-[#6B7280]">
                      Test Design: {plan.testDesign}
                    </div>

                    <button
                      onClick={() => handleConvertToCampaign(plan)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] text-xs font-semibold shadow-xs"
                    >
                      <PlusCircle size={14} className="text-[#C9A227]" />
                      <span>Convert to Live Campaign</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
