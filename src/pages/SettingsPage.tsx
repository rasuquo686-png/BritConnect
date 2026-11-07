import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Trash2,
  ShieldAlert,
  Server,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const SettingsPage: React.FC = () => {
  const {
    businessAssumptions,
    updateAssumptions,
    clearAllData,
    triggerModelTraining,
  } = useAppStore();

  const [formState, setFormState] = useState(businessAssumptions);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiHealth, setApiHealth] = useState<{ status: string; hasApiKey: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setApiHealth(data))
      .catch((err) => console.warn('Health check error:', err));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateAssumptions(formState);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    // Retrain model if protected attribute status changed
    await triggerModelTraining();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
            Platform Settings & Commercial Assumptions
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-0.5">
            Configure ROI financial parameters, risk tier cutoffs, algorithmic governance, and local persistence.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 rounded-lg border border-emerald-200">
            <CheckCircle2 size={14} />
            <span>Settings Saved & Models Updated</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Commercial Retention ROI Assumptions */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs space-y-4">
          <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
            <DollarSign size={16} className="text-[#C9A227]" />
            Commercial & Financial Assumptions
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[#6B7280] mb-1 font-medium">Cost of Retention Offer (£)</label>
              <input
                type="number"
                min="0"
                step="5"
                value={formState.costOfRetentionOfferGbp}
                onChange={(e) => setFormState({ ...formState, costOfRetentionOfferGbp: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-white font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
              />
              <span className="text-[11px] text-[#6B7280] mt-1 block">
                Average cost per accepted intervention (voucher, bill credit, speed boost hardware).
              </span>
            </div>

            <div>
              <label className="block text-[#6B7280] mb-1 font-medium">Assumed Intervention Save Rate (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={formState.assumedSaveRatePct}
                onChange={(e) => setFormState({ ...formState, assumedSaveRatePct: parseFloat(e.target.value) || 20 })}
                className="w-full px-3 py-2 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-white font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
              />
              <span className="text-[11px] text-[#6B7280] mt-1 block">
                Percentage of contacted churn-prone subscribers persuaded to remain.
              </span>
            </div>

            <div>
              <label className="block text-[#6B7280] mb-1 font-medium">Average Telecom Gross Margin (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formState.averageGrossMarginPct}
                onChange={(e) => setFormState({ ...formState, averageGrossMarginPct: parseFloat(e.target.value) || 60 })}
                className="w-full px-3 py-2 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-white font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
              />
              <span className="text-[11px] text-[#6B7280] mt-1 block">
                Gross contribution margin after network transit and wholesale access fees.
              </span>
            </div>

            <div>
              <label className="block text-[#6B7280] mb-1 font-medium">Expected Retained Lifetime (Months)</label>
              <input
                type="number"
                min="1"
                max="48"
                value={formState.expectedRetainedLifetimeMonths}
                onChange={(e) => setFormState({ ...formState, expectedRetainedLifetimeMonths: parseInt(e.target.value, 10) || 12 })}
                className="w-full px-3 py-2 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-white font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
              />
              <span className="text-[11px] text-[#6B7280] mt-1 block">
                Average relationship extension duration for retained accounts.
              </span>
            </div>
          </div>
        </div>

        {/* 2. Risk Tier Cutoffs & Reference Date */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs space-y-4">
          <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
            <Calendar size={16} className="text-[#C9A227]" />
            Risk Tier Thresholds & Reference Date
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-[#6B7280] mb-1 font-medium">Critical Risk Cutoff (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formState.riskThresholdCritical}
                onChange={(e) => setFormState({ ...formState, riskThresholdCritical: parseFloat(e.target.value) || 70 })}
                className="w-full px-3 py-2 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-white font-mono tabular-nums focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#6B7280] mb-1 font-medium">High Risk Cutoff (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formState.riskThresholdHigh}
                onChange={(e) => setFormState({ ...formState, riskThresholdHigh: parseFloat(e.target.value) || 50 })}
                className="w-full px-3 py-2 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-white font-mono tabular-nums focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#6B7280] mb-1 font-medium">Medium Risk Cutoff (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formState.riskThresholdMedium}
                onChange={(e) => setFormState({ ...formState, riskThresholdMedium: parseFloat(e.target.value) || 30 })}
                className="w-full px-3 py-2 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-white font-mono tabular-nums focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#6B7280] mb-1 font-medium">As-Of Reference Date</label>
              <input
                type="date"
                value={formState.asOfDate}
                onChange={(e) => setFormState({ ...formState, asOfDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-white font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 3. Algorithmic Governance & Protected Characteristics */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs space-y-4">
          <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
            <ShieldAlert size={16} className="text-[#C9A227]" />
            Algorithmic Fairness & Regulatory Governance
          </h3>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F5F6FA] dark:bg-[#0B1F4B] text-xs">
            <input
              type="checkbox"
              id="excludeProtected"
              checked={formState.excludeProtectedAttributes}
              onChange={(e) => setFormState({ ...formState, excludeProtectedAttributes: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-[#0B1F4B] focus:ring-[#C9A227] accent-[#0B1F4B]"
            />
            <label htmlFor="excludeProtected" className="cursor-pointer">
              <span className="font-semibold text-[#0B1F4B] dark:text-white block">
                Exclude Protected Attributes (Age, Gender) from Model Predictors
              </span>
              <span className="text-[#6B7280] dark:text-[#D9DCE6]/70 mt-0.5 block leading-relaxed">
                Complies with UK Equality Act and Ofcom fair-treatment standards. Protected characteristics remain accessible solely for demographic parity auditing, preventing discriminatory offer eligibility.
              </span>
            </label>
          </div>
        </div>

        {/* 4. Backend AI Service Connectivity */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs space-y-3">
          <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
            <Server size={16} className="text-[#1E3A8A]" />
            AI Service & Backend Server Status
          </h3>

          <div className="flex items-center justify-between p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B] text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${apiHealth?.hasApiKey ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-medium text-[#111827] dark:text-white">Gemini API Key Service</span>
            </div>
            <span className="font-mono text-[#6B7280]">
              {apiHealth?.hasApiKey ? 'Connected (Environment Secret)' : 'Deterministic Fallback Active'}
            </span>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              if (confirm('Permanently wipe all IndexedDB records, models, and campaign history?')) {
                clearAllData();
              }
            }}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:underline font-semibold"
          >
            <Trash2 size={13} />
            <span>Reset All Local Data</span>
          </button>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] transition-colors text-xs font-semibold shadow-xs"
          >
            <Save size={14} className="text-[#C9A227]" />
            <span>Save Settings & Apply</span>
          </button>
        </div>
      </form>
    </div>
  );
};
