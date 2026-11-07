import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  Cpu,
  Play,
  Pin,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useAppStore, executeModelTraining, updateAppState } from '../store/useAppStore';
import { optimizeThreshold } from '../engine/threshold';
import { computePartialDependence } from '../engine/explainability';
import { auditFairness } from '../engine/fairness';
import { prepareModelData } from '../engine/features';

export const ModelLabPage: React.FC = () => {
  const {
    records,
    trainedModel,
    comparedModels,
    pinnedModelId,
    scoredCustomers,
    businessAssumptions,
    modelTrainingProgress,
    loadingMessage,
    updateAssumptions,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'metrics' | 'threshold' | 'drivers' | 'pdp' | 'fairness'>('metrics');
  const [interactiveThreshold, setInteractiveThreshold] = useState<number>(0.5);

  // Active displayed model (pinned or top)
  const activeModel = useMemo(() => {
    if (pinnedModelId) {
      const found = comparedModels.find((m) => m.id === pinnedModelId);
      if (found) return found;
    }
    return trainedModel || comparedModels[0];
  }, [pinnedModelId, trainedModel, comparedModels]);

  // Expected Value Threshold optimization
  const thresholdOptimization = useMemo(() => {
    if (!activeModel || scoredCustomers.length === 0) return null;
    const actuals = scoredCustomers.map((s) => Number(s.record['Churn Flag']) === 1 ? 1 : 0);
    const probas = scoredCustomers.map((s) => s.churnProbability / 100);

    return optimizeThreshold(actuals, probas, {
      costOfOfferGbp: businessAssumptions.costOfRetentionOfferGbp || 25,
      acceptanceRatePct: businessAssumptions.assumedSaveRatePct || 22,
      monthlyMarginGbp: Math.round(35 * ((businessAssumptions.averageGrossMarginPct || 65) / 100)),
      retainedLifetimeMonths: businessAssumptions.expectedRetainedLifetimeMonths || 14,
    });
  }, [activeModel, scoredCustomers, businessAssumptions]);

  // Live Confusion Matrix at interactive slider threshold
  const liveConfusionMatrix = useMemo(() => {
    if (scoredCustomers.length === 0) return { tp: 0, fp: 0, tn: 0, fn: 0, precision: 0, recall: 0, f1: 0 };
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    scoredCustomers.forEach((s) => {
      const pred = (s.churnProbability / 100) >= interactiveThreshold ? 1 : 0;
      const actual = Number(s.record['Churn Flag']) === 1 ? 1 : 0;
      if (pred === 1 && actual === 1) tp++;
      else if (pred === 1 && actual === 0) fp++;
      else if (pred === 0 && actual === 0) tn++;
      else if (pred === 0 && actual === 1) fn++;
    });

    const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
    const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      tp,
      fp,
      tn,
      fn,
      precision: Math.round(precision * 10) / 10,
      recall: Math.round(recall * 10) / 10,
      f1: Math.round(f1 * 10) / 10,
    };
  }, [scoredCustomers, interactiveThreshold]);

  // Partial Dependence Plots for top 6 numeric drivers
  const pdpData = useMemo(() => {
    if (!activeModel?.treeModel || records.length === 0) return [];
    const prepared = prepareModelData(records, businessAssumptions.excludeProtectedAttributes);
    return computePartialDependence(
      activeModel.treeModel,
      prepared.featureMatrix,
      prepared.featureNames,
      ['tenure_months', 'effective_monthly_charge', 'satisfaction_score', 'service_friction_index', 'overage_ratio', 'months_in_contract']
    );
  }, [activeModel, records, businessAssumptions]);

  // Algorithmic Fairness Audit
  const fairnessReports = useMemo(() => {
    if (records.length === 0 || scoredCustomers.length === 0) return [];
    return auditFairness(records, scoredCustomers, interactiveThreshold);
  }, [records, scoredCustomers, interactiveThreshold]);

  const handleRetrain = async () => {
    await executeModelTraining(records, businessAssumptions);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Model Switcher */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-xl font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
              Model Lab & Machine Learning Architecture
              {activeModel && (
                <span className="text-[10px] font-sans font-semibold uppercase px-2 py-0.5 rounded bg-[#C9A227]/20 text-[#856404] dark:text-[#E8D48A] border border-[#C9A227]/40">
                  Active: {activeModel.modelName}
                </span>
              )}
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-0.5">
              4 client-side algorithms evaluated natively in TypeScript on held-out stratified test data.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRetrain}
              disabled={modelTrainingProgress !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] transition-colors text-xs font-semibold shadow-xs disabled:opacity-50"
            >
              <Play size={13} className="text-[#C9A227] fill-[#C9A227]" />
              <span>Retrain All Models</span>
            </button>
          </div>
        </div>

        {/* Training Progress Bar */}
        {modelTrainingProgress !== null && (
          <div className="mt-4 pt-4 border-t border-[#D9DCE6] dark:border-[#1E3A8A]">
            <div className="flex justify-between text-xs font-medium text-[#111827] dark:text-white mb-1.5">
              <span>{loadingMessage}</span>
              <span className="font-mono tabular-nums">{modelTrainingProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#D9DCE6] dark:bg-[#1E3A8A] overflow-hidden">
              <div
                className="h-full bg-[#C9A227] transition-all duration-300"
                style={{ width: `${modelTrainingProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* 4 Models Comparison Table */}
        <div className="overflow-x-auto mt-5">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#D9DCE6] dark:border-[#1E3A8A] text-[#6B7280] uppercase text-[10px] tracking-wider">
                <th className="py-2 px-3">Algorithm</th>
                <th className="py-2 px-3">Val PR-AUC</th>
                <th className="py-2 px-3">Test ROC-AUC</th>
                <th className="py-2 px-3">Test F1 Score</th>
                <th className="py-2 px-3">Precision / Recall</th>
                <th className="py-2 px-3">Brier Score</th>
                <th className="py-2 px-3">KS Statistic</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DCE6]/60 dark:divide-[#1E3A8A]/50">
              {comparedModels.map((m) => {
                const isPinned = (pinnedModelId || trainedModel?.id) === m.id;
                return (
                  <tr
                    key={m.id}
                    className={`transition-colors ${
                      isPinned
                        ? 'bg-[#C9A227]/10 dark:bg-[#C9A227]/15 font-semibold'
                        : 'hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A]/30'
                    }`}
                  >
                    <td className="py-2.5 px-3 flex items-center gap-2 text-[#0B1F4B] dark:text-white">
                      <span>{m.modelName}</span>
                      {isPinned && (
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-[#C9A227] text-[#0B1F4B] font-bold">
                          Pinned
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
                      {m.valAuc.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">
                      {(m.metrics.rocAuc).toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">
                      {(m.metrics.f1).toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-[#6B7280]">
                      {(m.metrics.precision).toFixed(2)} / {(m.metrics.recall).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">
                      {(m.metrics.brierScore).toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">
                      {(m.metrics.ksStatistic).toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => updateAppState({ pinnedModelId: m.id })}
                        className={`p-1 rounded text-xs transition-colors ${
                          isPinned
                            ? 'text-[#C9A227]'
                            : 'text-[#6B7280] hover:text-[#0B1F4B] dark:hover:text-white'
                        }`}
                        title="Pin this model as primary"
                      >
                        <Pin size={14} className={isPinned ? 'fill-[#C9A227]' : ''} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lab Tabs */}
      <div className="flex items-center gap-1 border-b border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-semibold">
        {[
          { id: 'metrics', label: 'Test Curves & Metrics' },
          { id: 'threshold', label: 'Threshold & Net Expected Value' },
          { id: 'drivers', label: 'Feature Importance Drivers' },
          { id: 'pdp', label: 'Partial Dependence Plots (PDP)' },
          { id: 'fairness', label: 'Fairness & Disparate Impact' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-[#C9A227] text-[#0B1F4B] dark:text-[#E8D48A]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827] dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Held-out Test Metrics & Curves */}
      {activeTab === 'metrics' && activeModel && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ROC Curve */}
          <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
            <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white mb-1">
              ROC Curve (AUC: {activeModel.metrics.rocAuc})
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mb-4">
              95% Bootstrap CI: [{activeModel.metrics.confidenceIntervals.rocAuc[0]}, {activeModel.metrics.confidenceIntervals.rocAuc[1]}]
            </p>

            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activeModel.metrics.rocCurve} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <XAxis dataKey="fpr" stroke="#6B7280" fontSize={11} unit="" />
                  <YAxis stroke="#6B7280" fontSize={11} unit="" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B1F4B', borderColor: '#C9A227', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    formatter={(val: any) => [val, '']}
                  />
                  <Line type="monotone" dataKey="tpr" stroke="#0B1F4B" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="fpr" stroke="#C9A227" strokeDasharray="3 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between text-[11px] text-[#6B7280] mt-2">
              <span>False Positive Rate (FPR)</span>
              <span>True Positive Rate (TPR / Recall)</span>
            </div>
          </div>

          {/* Precision-Recall Curve */}
          <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
            <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white mb-1">
              Precision-Recall Curve (PR-AUC: {activeModel.metrics.prAuc})
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mb-4">
              Essential for imbalanced telecommunications churn distributions
            </p>

            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activeModel.metrics.prCurve} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <XAxis dataKey="recall" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B1F4B', borderColor: '#C9A227', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    formatter={(val: any) => [val, '']}
                  />
                  <Line type="monotone" dataKey="precision" stroke="#7A0C1E" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between text-[11px] text-[#6B7280] mt-2">
              <span>Recall</span>
              <span>Precision</span>
            </div>
          </div>

          {/* Decile Lift & Gain Table */}
          <div className="lg:col-span-2 bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
            <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white mb-1">
              Test Set Lift & Cumulative Gain Deciles
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mb-4">
              Top deciles capture the vast majority of churners, establishing targeting efficiency.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#D9DCE6] dark:border-[#1E3A8A] text-[#6B7280] uppercase text-[10px]">
                    <th className="py-2 px-3">Decile</th>
                    <th className="py-2 px-3">Subscribers</th>
                    <th className="py-2 px-3">Churners</th>
                    <th className="py-2 px-3">Decile Churn Rate</th>
                    <th className="py-2 px-3">Cumulative Gain %</th>
                    <th className="py-2 px-3">Lift Factor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9DCE6]/60 dark:divide-[#1E3A8A]/50">
                  {activeModel.metrics.deciles.map((d) => (
                    <tr key={d.decile} className="hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A]/30">
                      <td className="py-2 px-3 font-semibold text-[#0B1F4B] dark:text-[#E8D48A]">
                        Decile {d.decile}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums">{d.customers}</td>
                      <td className="py-2 px-3 font-mono tabular-nums">{d.churners}</td>
                      <td className="py-2 px-3 font-mono font-bold tabular-nums text-[#7A0C1E] dark:text-red-400">
                        {d.churnRate}%
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                        {d.cumulativeGain}%
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums text-[#C9A227] font-bold">
                        {d.lift}x
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Threshold Optimization & Expected Value */}
      {activeTab === 'threshold' && thresholdOptimization && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                  Decision Threshold Sensitivity & Confusion Matrix
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                  Slide threshold to dynamically adjust True Positives, False Positives, and campaign ROI.
                </p>
              </div>

              {/* Threshold Presets */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setInteractiveThreshold(thresholdOptimization.maxNetBenefitThreshold)}
                  className="px-2.5 py-1 rounded-md bg-[#C9A227]/20 text-[#856404] dark:text-[#E8D48A] border border-[#C9A227]/40 font-semibold"
                >
                  Max Net Benefit ({thresholdOptimization.maxNetBenefitThreshold})
                </button>
                <button
                  onClick={() => setInteractiveThreshold(thresholdOptimization.f1OptimalThreshold)}
                  className="px-2.5 py-1 rounded-md bg-[#1E3A8A]/15 text-[#1E3A8A] dark:text-white font-medium"
                >
                  F1-Optimal ({thresholdOptimization.f1OptimalThreshold})
                </button>
                <button
                  onClick={() => setInteractiveThreshold(thresholdOptimization.recall80Threshold)}
                  className="px-2.5 py-1 rounded-md border border-[#D9DCE6] text-[#6B7280] font-medium"
                >
                  Recall ≥ 80% ({thresholdOptimization.recall80Threshold})
                </button>
              </div>
            </div>

            {/* Slider */}
            <div className="p-4 rounded-xl bg-[#F5F6FA] dark:bg-[#0B1F4B] mb-6">
              <div className="flex justify-between text-xs font-semibold text-[#0B1F4B] dark:text-white mb-2">
                <span>Selected Decision Threshold:</span>
                <span className="font-mono text-base font-bold text-[#C9A227]">
                  {interactiveThreshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.02"
                value={interactiveThreshold}
                onChange={(e) => setInteractiveThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-[#D9DCE6] dark:bg-[#1E3A8A] rounded-lg appearance-none cursor-pointer accent-[#C9A227]"
              />
            </div>

            {/* Live Confusion Matrix Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
                <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">True Positives (TP)</span>
                <div className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                  {liveConfusionMatrix.tp}
                </div>
                <span className="text-[10px] text-[#6B7280]">Correctly caught churners</span>
              </div>

              <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
                <span className="text-[10px] uppercase font-bold text-red-800 dark:text-red-300">False Positives (FP)</span>
                <div className="font-mono text-xl font-bold text-[#7A0C1E] dark:text-red-400 mt-1">
                  {liveConfusionMatrix.fp}
                </div>
                <span className="text-[10px] text-[#6B7280]">Safe accounts given offers</span>
              </div>

              <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
                <span className="text-[10px] uppercase font-bold text-red-800 dark:text-red-300">False Negatives (FN)</span>
                <div className="font-mono text-xl font-bold text-[#7A0C1E] dark:text-red-400 mt-1">
                  {liveConfusionMatrix.fn}
                </div>
                <span className="text-[10px] text-[#6B7280]">Missed churners</span>
              </div>

              <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
                <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">True Negatives (TN)</span>
                <div className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                  {liveConfusionMatrix.tn}
                </div>
                <span className="text-[10px] text-[#6B7280]">Correctly identified active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Global Feature Importance */}
      {activeTab === 'drivers' && activeModel && (
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
          <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white mb-1">
            Top 15 Global Churn Drivers (Permutation Importance)
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mb-4">
            Direction indicates whether high values push probability up (dark red) or protect subscriber (navy).
          </p>

          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={activeModel.featureImportances.slice(0, 15)}
                margin={{ top: 5, right: 35, left: 160, bottom: 5 }}
              >
                <XAxis type="number" stroke="#6B7280" fontSize={11} />
                <YAxis dataKey="label" type="category" stroke="#6B7280" fontSize={10} width={155} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B1F4B', borderColor: '#C9A227', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                  formatter={(val: any, _, item: any) => [
                    `${(val * 100).toFixed(1)}% importance (${item.payload.direction === 'increases_churn' ? 'Elevates Risk' : 'Protective Factor'})`,
                    'Weight',
                  ]}
                />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                  {activeModel.featureImportances.slice(0, 15).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.direction === 'increases_churn' ? '#7A0C1E' : '#0B1F4B'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab 4: Partial Dependence Plots */}
      {activeTab === 'pdp' && pdpData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pdpData.map((pdp) => (
            <div key={pdp.feature} className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-4 shadow-xs">
              <h4 className="font-serif text-xs font-bold text-[#0B1F4B] dark:text-white mb-1">
                {pdp.label}
              </h4>
              <p className="text-[11px] text-[#6B7280] mb-3">Marginal probability impact (%)</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pdp.points} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="value" stroke="#6B7280" fontSize={10} />
                    <YAxis stroke="#6B7280" fontSize={10} unit="%" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0B1F4B', borderColor: '#C9A227', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                      formatter={(val: any) => [`${val}%`, 'Avg Probability']}
                    />
                    <Line type="monotone" dataKey="avgProbability" stroke="#C9A227" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 5: Fairness & Disparate Impact Audit */}
      {activeTab === 'fairness' && (
        <div className="space-y-6">
          {fairnessReports.map((report) => (
            <div key={report.dimension} className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#D9DCE6] dark:border-[#1E3A8A] mb-4">
                <div>
                  <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
                    Demographic Parity Audit: {report.dimension}
                  </h3>
                  <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                    Reference group: <span className="font-semibold text-[#111827] dark:text-white">{report.referenceGroup}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {report.hasDisparityWarning ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#7A0C1E] dark:text-red-400 bg-red-100 dark:bg-red-950 px-2 py-0.5 rounded">
                      <AlertTriangle size={12} />
                      Disparity Detected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                      <ShieldCheck size={12} />
                      Fairness Compliant
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#D9DCE6] dark:border-[#1E3A8A] text-[#6B7280] uppercase text-[10px]">
                      <th className="py-2 px-3">Subgroup</th>
                      <th className="py-2 px-3">Accounts</th>
                      <th className="py-2 px-3">Realized Churn Rate</th>
                      <th className="py-2 px-3">Avg Predicted Prob</th>
                      <th className="py-2 px-3">Critical Tier Share</th>
                      <th className="py-2 px-3">False Positive Rate</th>
                      <th className="py-2 px-3">Disparate Impact Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9DCE6]/60 dark:divide-[#1E3A8A]/50">
                    {report.groups.map((g) => (
                      <tr key={g.groupValue} className="hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A]/30">
                        <td className="py-2.5 px-3 font-semibold text-[#0B1F4B] dark:text-white">
                          {g.groupValue}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">{g.count.toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">{g.churnRate}%</td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-semibold">{g.avgPredictedProbability}%</td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">{g.criticalTierPct}%</td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">{g.falsePositiveRate}%</td>
                        <td className="py-2.5 px-3 font-mono font-bold tabular-nums">
                          <span
                            className={
                              g.disparateImpactRatio < 0.8 || g.disparateImpactRatio > 1.25
                                ? 'text-[#7A0C1E] dark:text-red-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {g.disparateImpactRatio}x
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-[11px] text-[#6B7280] dark:text-[#D9DCE6]/70">
                {report.verdict}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
