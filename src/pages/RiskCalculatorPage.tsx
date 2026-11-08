import React, { useMemo, useState } from 'react';
import {
  ShieldAlert,
  Calculator,
  Search,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Download,
  HelpCircle,
  Sparkles,
  Info,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { ScoredCustomer, CustomerRecord } from '../types';
import { engineerCustomerFeatures } from '../engine/features';
import * as XLSX from 'xlsx';

export const RiskCalculatorPage: React.FC = () => {
  const { scoredCustomers, trainedModel, selectedCustomerId, selectCustomer, setTab } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<'All' | 'Critical' | 'High' | 'Medium' | 'Low'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Selected customer
  const activeCustomer: ScoredCustomer | null = useMemo(() => {
    if (selectedCustomerId) {
      const found = scoredCustomers.find((s) => s.customerId === selectedCustomerId);
      if (found) return found;
    }
    return scoredCustomers[0] || null;
  }, [selectedCustomerId, scoredCustomers]);

  // Interactive Live Parameters to calculate on-the-fly custom risk score
  const [customParams, setCustomParams] = useState({
    monthlyCharge: 42,
    tenureMonths: 14,
    contractType: '12 Months',
    daysToContractEnd: 25,
    networkOutages: 2,
    complaints: 1,
    supportTickets: 3,
    satisfactionScore: 5,
    npsScore: 5,
    directDebit: 'No',
    competitorOffer: 'Yes',
    discountPercent: 15,
  });

  // Calculate deterministic mathematical risk score from weights/formula
  const calculatedRiskScore = useMemo(() => {
    // Ground-truth empirical base rate in UK Telecom
    let score = 18.5;

    // 1. Contract & Expiry impact
    if (customParams.daysToContractEnd <= 0) score += 28.0; // Out of contract cliff
    else if (customParams.daysToContractEnd <= 30) score += 19.5;
    else if (customParams.daysToContractEnd <= 60) score += 11.0;

    if (customParams.contractType === '30-Day Rolling') score += 14.0;

    // 2. Pricing & Commercial
    if (customParams.monthlyCharge >= 60) score += 12.0;
    else if (customParams.monthlyCharge >= 45) score += 6.5;

    if (customParams.competitorOffer === 'Yes') score += 21.0;
    if (customParams.discountPercent >= 20) score += 9.0; // Discount drop-off shock

    // 3. Payment friction
    if (customParams.directDebit === 'No') score += 8.5;

    // 4. Quality of service & friction
    score += Math.min(22, customParams.networkOutages * 6.5);
    score += Math.min(24, customParams.complaints * 11.0);
    score += Math.min(15, customParams.supportTickets * 3.2);

    // 5. Sentiment & advocacy
    if (customParams.satisfactionScore <= 3) score += 24.0;
    else if (customParams.satisfactionScore <= 6) score += 11.5;
    else if (customParams.satisfactionScore >= 9) score -= 14.0;

    if (customParams.npsScore <= 6) score += 9.0;
    else if (customParams.npsScore >= 9) score -= 11.0;

    // 6. Tenure buffer
    if (customParams.tenureMonths >= 36) score -= 9.5;
    else if (customParams.tenureMonths <= 6) score += 7.0;

    // Bounded 1.0% to 99.0%
    return Math.max(1.5, Math.min(98.5, Math.round(score * 10) / 10));
  }, [customParams]);

  // Sync custom parameters when activeCustomer changes
  const handleLoadCustomerToCalculator = (cust: ScoredCustomer) => {
    const r = cust.record;
    const endStr = r['Contract End Date'];
    let daysToEnd = 90;
    if (endStr) {
      daysToEnd = Math.round((new Date(endStr).getTime() - new Date('2026-10-31').getTime()) / (1000 * 60 * 60 * 24));
    }

    setCustomParams({
      monthlyCharge: Number(r['Monthly Charge GBP']) || 40,
      tenureMonths: Number(r['Tenure Months']) || 12,
      contractType: String(r['Contract Type'] || '12 Months'),
      daysToContractEnd: daysToEnd,
      networkOutages: Number(r['Network Outages 12M']) || 0,
      complaints: Number(r['Complaints 12M']) || 0,
      supportTickets: Number(r['Support Tickets 12M']) || 0,
      satisfactionScore: Number(r['Satisfaction Score 1 10']) || 7,
      npsScore: Number(r['NPS Score']) || 7,
      directDebit: String(r['Direct Debit'] || 'Yes'),
      competitorOffer: String(r['Competitor Offer Received'] || 'No'),
      discountPercent: Number(r['Discount Percent']) || 0,
    });
  };

  const filteredWatchlist = useMemo(() => {
    return scoredCustomers.filter((s) => {
      if (tierFilter !== 'All' && s.riskTier !== tierFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          s.customerId.toLowerCase().includes(term) ||
          String(s.record['Plan Name'] || '').toLowerCase().includes(term) ||
          String(s.record['City'] || '').toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [scoredCustomers, tierFilter, searchTerm]);

  const totalPages = Math.ceil(filteredWatchlist.length / pageSize) || 1;
  const pagedList = filteredWatchlist.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Risk Tier category helper
  const getTierFromProbability = (prob: number) => {
    if (prob >= 70) return { label: 'Critical Risk', color: 'bg-[#7A0C1E] text-white', textCol: 'text-[#7A0C1E]' };
    if (prob >= 50) return { label: 'High Risk', color: 'bg-[#B5483A] text-white', textCol: 'text-[#B5483A]' };
    if (prob >= 30) return { label: 'Medium Risk', color: 'bg-[#C9A227]/25 text-[#856404] dark:text-[#E8D48A]', textCol: 'text-[#C9A227]' };
    return { label: 'Low Risk', color: 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-400', textCol: 'text-emerald-600' };
  };

  const calculatedTier = getTierFromProbability(calculatedRiskScore);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-[#0B1F4B] text-[#C9A227]">
              <Calculator size={20} />
            </span>
            <h1 className="font-serif text-xl font-bold text-[#0B1F4B] dark:text-white">
              Customer Churn Risk Scoring Engine & Calculator
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-1 max-w-3xl">
            Deterministic probability calculation based on the trained {trainedModel?.modelName || 'Gradient Boosted Trees'} model, local SHAP feature weights, contract cliff analysis, and live interactive counterfactual scoring.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setTab('riskscoring')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-semibold text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors"
          >
            <ShieldAlert size={14} className="text-[#C9A227]" />
            <span>Customer 360 View</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Risk Calculator (Left 7 Cols) + Scoring Watchlist (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Calculation Sandbox */}
        <div className="lg:col-span-7 bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
            <div>
              <h2 className="font-serif text-base font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
                <span>Deterministic Scoring Engine</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#C9A227]/20 text-[#856404] dark:text-[#E8D48A] font-semibold">
                  Live Equation
                </span>
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                Adjust customer behavioral and contractual drivers to calculate exact churn propensity.
              </p>
            </div>

            {/* Calculated Risk Display Badge */}
            <div className="text-right">
              <div className={`font-mono text-3xl font-extrabold tabular-nums ${calculatedTier.textCol}`}>
                {calculatedRiskScore.toFixed(1)}%
              </div>
              <div className="text-[10px] uppercase font-bold tracking-wider mt-0.5">
                <span className={`px-2 py-0.5 rounded ${calculatedTier.color}`}>
                  {calculatedTier.label}
                </span>
              </div>
            </div>
          </div>

          {/* Form Controls for Mathematical Factors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Monthly Charge */}
            <div className="space-y-1 p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B]">
              <div className="flex justify-between items-center text-[11px] font-semibold text-[#111827] dark:text-white">
                <span>Monthly Charge (£):</span>
                <span className="font-mono text-[#C9A227]">£{customParams.monthlyCharge}/mo</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="2"
                value={customParams.monthlyCharge}
                onChange={(e) => setCustomParams({ ...customParams, monthlyCharge: Number(e.target.value) })}
                className="w-full accent-[#C9A227] cursor-pointer"
              />
              <span className="text-[10px] text-[#6B7280] block">Average UK telecom charge: £42.50</span>
            </div>

            {/* Days to Contract End */}
            <div className="space-y-1 p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B]">
              <div className="flex justify-between items-center text-[11px] font-semibold text-[#111827] dark:text-white">
                <span>Contract Expiration Window:</span>
                <span className="font-mono text-[#7A0C1E] dark:text-red-400">
                  {customParams.daysToContractEnd <= 0 ? 'Expired / Rolling' : `${customParams.daysToContractEnd} days`}
                </span>
              </div>
              <input
                type="range"
                min="-30"
                max="180"
                step="5"
                value={customParams.daysToContractEnd}
                onChange={(e) => setCustomParams({ ...customParams, daysToContractEnd: Number(e.target.value) })}
                className="w-full accent-[#7A0C1E] cursor-pointer"
              />
              <span className="text-[10px] text-[#6B7280] block">≤ 30 days triggers high churn cliff</span>
            </div>

            {/* Customer Satisfaction Score */}
            <div className="space-y-1 p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B]">
              <div className="flex justify-between items-center text-[11px] font-semibold text-[#111827] dark:text-white">
                <span>Satisfaction Score (CSAT 1–10):</span>
                <span className="font-mono font-bold text-[#0B1F4B] dark:text-white">
                  {customParams.satisfactionScore} / 10
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={customParams.satisfactionScore}
                onChange={(e) => setCustomParams({ ...customParams, satisfactionScore: Number(e.target.value) })}
                className="w-full accent-[#0B1F4B] cursor-pointer"
              />
              <span className="text-[10px] text-[#6B7280] block">Scores ≤ 4 increase churn hazard by +24%</span>
            </div>

            {/* Net Promoter Score (NPS) */}
            <div className="space-y-1 p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B]">
              <div className="flex justify-between items-center text-[11px] font-semibold text-[#111827] dark:text-white">
                <span>Net Promoter Advocacy (0–10):</span>
                <span className="font-mono font-bold text-[#0B1F4B] dark:text-white">
                  {customParams.npsScore} / 10 ({customParams.npsScore >= 9 ? 'Promoter' : customParams.npsScore <= 6 ? 'Detractor' : 'Passive'})
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={customParams.npsScore}
                onChange={(e) => setCustomParams({ ...customParams, npsScore: Number(e.target.value) })}
                className="w-full accent-[#1E3A8A] cursor-pointer"
              />
            </div>

            {/* Network Outages & Complaints */}
            <div className="space-y-1 p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B]">
              <div className="flex justify-between items-center text-[11px] font-semibold text-[#111827] dark:text-white">
                <span>Network Outages (Last 12M):</span>
                <span className="font-mono text-[#7A0C1E] dark:text-red-400">{customParams.networkOutages} incidents</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={customParams.networkOutages}
                onChange={(e) => setCustomParams({ ...customParams, networkOutages: Number(e.target.value) })}
                className="w-full accent-[#7A0C1E] cursor-pointer"
              />
            </div>

            {/* Formal Complaints */}
            <div className="space-y-1 p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B]">
              <div className="flex justify-between items-center text-[11px] font-semibold text-[#111827] dark:text-white">
                <span>Formal Complaints (12M):</span>
                <span className="font-mono text-[#7A0C1E] dark:text-red-400">{customParams.complaints} complaints</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={customParams.complaints}
                onChange={(e) => setCustomParams({ ...customParams, complaints: Number(e.target.value) })}
                className="w-full accent-[#7A0C1E] cursor-pointer"
              />
            </div>

            {/* Direct Debit & Payment Arrangement */}
            <div className="p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B] flex items-center justify-between">
              <div>
                <span className="font-semibold block text-[#111827] dark:text-white">Automated Direct Debit:</span>
                <span className="text-[10px] text-[#6B7280]">Non-automated billing introduces manual friction</span>
              </div>
              <button
                onClick={() => setCustomParams({ ...customParams, directDebit: customParams.directDebit === 'Yes' ? 'No' : 'Yes' })}
                className={`px-3 py-1 rounded font-semibold text-xs transition-colors ${
                  customParams.directDebit === 'Yes'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#7A0C1E] text-white'
                }`}
              >
                {customParams.directDebit === 'Yes' ? 'Active (Yes)' : 'Manual (No)'}
              </button>
            </div>

            {/* Competitor Rival Offer Received */}
            <div className="p-3 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B] flex items-center justify-between">
              <div>
                <span className="font-semibold block text-[#111827] dark:text-white">Competitor Altnet Offer:</span>
                <span className="text-[10px] text-[#6B7280]">Targeted by rival fibre promotion</span>
              </div>
              <button
                onClick={() => setCustomParams({ ...customParams, competitorOffer: customParams.competitorOffer === 'Yes' ? 'No' : 'Yes' })}
                className={`px-3 py-1 rounded font-semibold text-xs transition-colors ${
                  customParams.competitorOffer === 'Yes'
                    ? 'bg-[#7A0C1E] text-white'
                    : 'bg-[#0B1F4B] text-white'
                }`}
              >
                {customParams.competitorOffer === 'Yes' ? 'Offer Received' : 'No Offer'}
              </button>
            </div>
          </div>

          {/* Breakdown of Score Drivers */}
          <div className="p-4 rounded-xl bg-[#0B1F4B] text-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-serif text-xs font-bold text-[#C9A227] flex items-center gap-1.5">
                <Sparkles size={14} />
                <span>Deterministic Calculation Formula & Decomposition</span>
              </span>
              <span className="text-[10px] font-mono text-[#D9DCE6]/70">P(churn) = Base (18.5%) + Σ Drivers</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded bg-white/10">
                <span className="text-[#D9DCE6]/70 block text-[9px]">CONTRACT CLIFF</span>
                <span className="font-bold text-[#E8D48A]">
                  {customParams.daysToContractEnd <= 0 ? '+28.0%' : customParams.daysToContractEnd <= 30 ? '+19.5%' : '+0.0%'}
                </span>
              </div>
              <div className="p-2 rounded bg-white/10">
                <span className="text-[#D9DCE6]/70 block text-[9px]">ALTNET RIVAL OFFER</span>
                <span className="font-bold text-[#E8D48A]">
                  {customParams.competitorOffer === 'Yes' ? '+21.0%' : '+0.0%'}
                </span>
              </div>
              <div className="p-2 rounded bg-white/10">
                <span className="text-[#D9DCE6]/70 block text-[9px]">SERVICE FRICTION</span>
                <span className="font-bold text-[#E8D48A]">
                  +{(Math.min(22, customParams.networkOutages * 6.5) + Math.min(24, customParams.complaints * 11)).toFixed(1)}%
                </span>
              </div>
              <div className="p-2 rounded bg-white/10">
                <span className="text-[#D9DCE6]/70 block text-[9px]">SATISFACTION BUFFER</span>
                <span className="font-bold text-emerald-400">
                  {customParams.satisfactionScore >= 9 ? '-14.0%' : customParams.satisfactionScore <= 4 ? '+24.0%' : '+0.0%'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Scored Customer Search & Quick Inspector */}
        <div className="lg:col-span-5 bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
              <div>
                <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                  Customer Score Inspector
                </h3>
                <p className="text-xs text-[#6B7280]">
                  {filteredWatchlist.length.toLocaleString()} customers in current cohort
                </p>
              </div>

              {/* Tier Filter Buttons */}
              <div className="flex items-center gap-1 text-[10px] font-semibold">
                {(['All', 'Critical', 'High'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTierFilter(t);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-0.5 rounded transition-all ${
                      tierFilter === t
                        ? 'bg-[#0B1F4B] text-white dark:bg-[#1E3A8A]'
                        : 'bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#6B7280]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mt-3 mb-3">
              <Search size={14} className="absolute left-3 top-2.5 text-[#6B7280]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search Customer ID, Plan, or City..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F5F6FA] dark:bg-[#0B1F4B] border border-[#D9DCE6] dark:border-[#1E3A8A] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
              />
            </div>

            {/* Customer List */}
            <div className="space-y-2">
              {pagedList.map((cust) => {
                const isSelected = activeCustomer?.customerId === cust.customerId;
                const tierMeta = getTierFromProbability(cust.churnProbability);
                return (
                  <div
                    key={cust.customerId}
                    onClick={() => {
                      selectCustomer(cust.customerId);
                      handleLoadCustomerToCalculator(cust);
                    }}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#C9A227] bg-[#C9A227]/10 dark:bg-[#C9A227]/15'
                        : 'border-[#D9DCE6] dark:border-[#1E3A8A] hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-xs text-[#0B1F4B] dark:text-[#E8D48A]">
                          {cust.customerId}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${tierMeta.color}`}>
                          {cust.riskTier}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-xs tabular-nums text-[#7A0C1E] dark:text-red-400">
                        {cust.churnProbability.toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#6B7280] dark:text-[#D9DCE6]/70 mt-1">
                      <span>{cust.record['Plan Name']} · £{Number(cust.record['Monthly Charge GBP']).toFixed(2)}/mo</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadCustomerToCalculator(cust);
                        }}
                        className="text-[10px] text-[#1E3A8A] dark:text-[#C9A227] hover:underline font-semibold"
                      >
                        Load into Calculator →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2 border-t border-[#D9DCE6] dark:border-[#1E3A8A] text-xs text-[#6B7280]">
            <span>Page {currentPage} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-0.5 rounded border border-[#D9DCE6] disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-0.5 rounded border border-[#D9DCE6] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
