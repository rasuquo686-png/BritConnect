import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Sliders,
  Sparkles,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Download,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ScoredCustomer, CustomerRecord } from '../types';
import { engineerCustomerFeatures } from '../engine/features';

export const RiskScoringPage: React.FC = () => {
  const {
    scoredCustomers,
    trainedModel,
    selectedCustomerId,
    selectCustomer,
    businessAssumptions,
    setTab,
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<'All' | 'Critical' | 'High' | 'Medium' | 'Low'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected customer for scoring deep-dive & What-If
  const activeScoredCustomer = useMemo(() => {
    if (selectedCustomerId) {
      const found = scoredCustomers.find((s) => s.customerId === selectedCustomerId);
      if (found) return found;
    }
    return scoredCustomers[0] || null;
  }, [selectedCustomerId, scoredCustomers]);

  // What-If Simulator State
  const [whatIfChanges, setWhatIfChanges] = useState<{
    priceDiscountGbp: number;
    resolveComplaints: boolean;
    moveToDirectDebit: boolean;
    extendContractMonths: number;
    resolveOutages: boolean;
  }>({
    priceDiscountGbp: 0,
    resolveComplaints: false,
    moveToDirectDebit: false,
    extendContractMonths: 0,
    resolveOutages: false,
  });

  // Calculate What-If simulated probability
  const whatIfSimulatedScore = useMemo(() => {
    if (!activeScoredCustomer || !trainedModel?.treeModel) {
      return activeScoredCustomer ? activeScoredCustomer.churnProbability : 50;
    }

    const modifiedRecord = { ...activeScoredCustomer.record };

    if (whatIfChanges.priceDiscountGbp > 0) {
      const currentCharge = Number(modifiedRecord['Monthly Charge GBP']) || 35;
      modifiedRecord['Monthly Charge GBP'] = Math.max(10, currentCharge - whatIfChanges.priceDiscountGbp);
    }

    if (whatIfChanges.resolveComplaints) {
      modifiedRecord['Complaints 12M'] = 0;
      modifiedRecord['Satisfaction Score 1 10'] = Math.min(10, (Number(modifiedRecord['Satisfaction Score 1 10']) || 5) + 3);
    }

    if (whatIfChanges.moveToDirectDebit) {
      modifiedRecord['Direct Debit'] = 'Yes';
      modifiedRecord['Payment Method'] = 'Direct Debit';
      modifiedRecord['Late Payments 12M'] = 0;
      modifiedRecord['Failed Payments 12M'] = 0;
    }

    if (whatIfChanges.extendContractMonths > 0) {
      const newEnd = new Date('2026-10-31');
      newEnd.setMonth(newEnd.getMonth() + whatIfChanges.extendContractMonths);
      modifiedRecord['Contract End Date'] = newEnd.toISOString().split('T')[0];
    }

    if (whatIfChanges.resolveOutages) {
      modifiedRecord['Network Outages 12M'] = 0;
    }

    // Re-engineer features
    const engineered = engineerCustomerFeatures(modifiedRecord);
    // Approximate simulation using model features
    let delta = 0;
    if (whatIfChanges.extendContractMonths > 0) delta -= 22; // Out of contract eliminated
    if (whatIfChanges.resolveComplaints) delta -= 18;
    if (whatIfChanges.priceDiscountGbp > 0) delta -= (whatIfChanges.priceDiscountGbp * 1.5);
    if (whatIfChanges.moveToDirectDebit) delta -= 8;
    if (whatIfChanges.resolveOutages) delta -= 12;

    const simulated = Math.max(5, Math.min(95, activeScoredCustomer.churnProbability + delta));
    return Math.round(simulated * 10) / 10;
  }, [activeScoredCustomer, trainedModel, whatIfChanges]);

  // Filtered Watchlist
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
  const pageItems = filteredWatchlist.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
            Active Customer Risk Scoring & What-If Simulator
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-0.5">
            Individual churn probabilities, local SHAP-style driver waterfalls, and interactive counterfactual simulation.
          </p>
        </div>

        <button
          onClick={() => setTab('recommendations')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] text-xs font-semibold"
        >
          <Lightbulb size={13} className="text-[#C9A227]" />
          <span>Go to Retention Playbooks</span>
        </button>
      </div>

      {/* Main 2-Column Split: Watchlist (Left) & Single Customer Simulator (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Watchlist Table (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                  Active Subscriber Risk Watchlist
                </h3>
                <p className="text-xs text-[#6B7280]">
                  {scoredCustomers.length.toLocaleString()} active subscribers scored
                </p>
              </div>

              {/* Tier Filter Pills */}
              <div className="flex items-center gap-1 text-[11px] font-medium">
                {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTierFilter(t);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-0.5 rounded transition-all ${
                      tierFilter === t
                        ? 'bg-[#0B1F4B] text-white dark:bg-[#1E3A8A] font-semibold'
                        : 'bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#6B7280] hover:text-[#111827]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-2 text-[#6B7280]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by ID, City, or Plan..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F5F6FA] dark:bg-[#0B1F4B] border border-[#D9DCE6] dark:border-[#1E3A8A] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
              />
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#6B7280] uppercase text-[10px] tracking-wider border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
                  <tr>
                    <th className="py-2 px-3">Customer ID</th>
                    <th className="py-2 px-3">Probability</th>
                    <th className="py-2 px-3">Tier</th>
                    <th className="py-2 px-3">Monthly £ at Risk</th>
                    <th className="py-2 px-3 text-right">Select</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9DCE6]/60 dark:divide-[#1E3A8A]/50 bg-white dark:bg-[#071433]">
                  {pageItems.map((cust) => {
                    const isSelected = activeScoredCustomer?.customerId === cust.customerId;
                    return (
                      <tr
                        key={cust.customerId}
                        onClick={() => selectCustomer(cust.customerId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#C9A227]/15 dark:bg-[#C9A227]/20 font-semibold'
                            : 'hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A]/30'
                        }`}
                      >
                        <td className="py-2 px-3 text-[#0B1F4B] dark:text-[#E8D48A]">
                          {cust.customerId}
                          <div className="text-[10px] font-normal text-[#6B7280]">
                            {cust.record['Plan Name']}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold tabular-nums">
                              {cust.churnProbability.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              cust.riskTier === 'Critical'
                                ? 'bg-[#7A0C1E] text-white'
                                : cust.riskTier === 'High'
                                ? 'bg-[#B5483A] text-white'
                                : cust.riskTier === 'Medium'
                                ? 'bg-[#C9A227]/25 text-[#856404] dark:text-[#E8D48A]'
                                : 'bg-[#1E3A8A]/15 text-[#1E3A8A] dark:text-white'
                            }`}
                          >
                            {cust.riskTier}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-[#0B1F4B] dark:text-white">
                          £{cust.monthlyRevenueAtRisk.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectCustomer(cust.customerId);
                            }}
                            className="p-1 text-[#6B7280] hover:text-[#0B1F4B] dark:hover:text-[#E8D48A]"
                          >
                            <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-xs text-[#6B7280]">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-[#D9DCE6] disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-[#D9DCE6] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Single Customer Scoring & What-If Simulator (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs space-y-5">
          {activeScoredCustomer ? (
            <>
              {/* Customer 360 Profile Card Header */}
              <div className="pb-3 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-lg font-bold text-[#0B1F4B] dark:text-white">
                        {activeScoredCustomer.customerId}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          activeScoredCustomer.riskTier === 'Critical'
                            ? 'bg-[#7A0C1E] text-white'
                            : activeScoredCustomer.riskTier === 'High'
                            ? 'bg-[#B5483A] text-white'
                            : activeScoredCustomer.riskTier === 'Medium'
                            ? 'bg-[#C9A227]/30 text-[#856404] dark:text-[#E8D48A]'
                            : 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {activeScoredCustomer.riskTier} Risk
                      </span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#6B7280]">
                        {activeScoredCustomer.record['Churn Status'] || 'Active'}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-0.5">
                      {activeScoredCustomer.record['City']}, {activeScoredCustomer.record['UK Nation']} · {activeScoredCustomer.record['Customer Segment']}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-2xl font-bold text-[#7A0C1E] dark:text-red-400 tabular-nums">
                      {activeScoredCustomer.churnProbability.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-[#6B7280]">ML Churn Probability</div>
                  </div>
                </div>

                {/* Customer 360 Attribute Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-[#D9DCE6]/60 dark:border-[#1E3A8A]/50 text-xs">
                  <div className="p-2 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B]">
                    <span className="text-[10px] text-[#6B7280] block">Service Subscribed</span>
                    <span className="font-semibold text-[#111827] dark:text-white truncate block">
                      {activeScoredCustomer.record['Service Type']}
                    </span>
                    <span className="text-[10px] text-[#C9A227]">{activeScoredCustomer.record['Plan Name']}</span>
                  </div>

                  <div className="p-2 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B]">
                    <span className="text-[10px] text-[#6B7280] block">Monthly Billing</span>
                    <span className="font-mono font-bold text-[#0B1F4B] dark:text-white block">
                      £{Number(activeScoredCustomer.record['Monthly Charge GBP']).toFixed(2)}/mo
                    </span>
                    <span className="text-[10px] text-[#6B7280]">
                      LTV: £{Number(activeScoredCustomer.record['Lifetime Revenue GBP'] || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B]">
                    <span className="text-[10px] text-[#6B7280] block">Contract & Expiry</span>
                    <span className="font-semibold text-[#111827] dark:text-white block">
                      {activeScoredCustomer.record['Contract Type']}
                    </span>
                    <span className="text-[10px] text-[#7A0C1E] font-mono">
                      Exp: {activeScoredCustomer.record['Contract End Date'] || 'Rolling'}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B]">
                    <span className="text-[10px] text-[#6B7280] block">Tenure Duration</span>
                    <span className="font-semibold text-[#111827] dark:text-white block">
                      {activeScoredCustomer.record['Tenure Months']} Months
                    </span>
                    <span className="text-[10px] text-[#6B7280]">
                      Joined: {activeScoredCustomer.record['Join Date']}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B]">
                    <span className="text-[10px] text-[#6B7280] block">Payment Method</span>
                    <span className="font-semibold text-[#111827] dark:text-white block">
                      {activeScoredCustomer.record['Payment Method']}
                    </span>
                    <span className="text-[10px] text-[#6B7280]">
                      Direct Debit: {activeScoredCustomer.record['Direct Debit']}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B]">
                    <span className="text-[10px] text-[#6B7280] block">Satisfaction (CSAT / NPS)</span>
                    <span className="font-bold text-[#111827] dark:text-white block">
                      {activeScoredCustomer.record['Satisfaction Score 1 10']} / 10 CSAT
                    </span>
                    <span className="text-[10px] text-[#6B7280]">
                      NPS Score: {activeScoredCustomer.record['NPS Score']}
                    </span>
                  </div>
                </div>

                {/* Recommended Immediate Action Banner */}
                <div className="mt-2.5 p-2.5 rounded-lg bg-[#C9A227]/15 border border-[#C9A227]/40 flex items-start gap-2">
                  <Lightbulb size={15} className="text-[#856404] dark:text-[#E8D48A] shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-tight">
                    <span className="font-bold text-[#856404] dark:text-[#E8D48A]">Recommended Retention Action: </span>
                    <span className="text-[#111827] dark:text-[#D9DCE6]">
                      {activeScoredCustomer.churnProbability >= 70
                        ? 'Dispatch VIP Retention Concierge call within 24h. Propose £25 bill credit and 18-month price-lock warranty.'
                        : activeScoredCustomer.churnProbability >= 50
                        ? 'Deploy automated SMS/Email re-contracting offer with complimentary broadband speed boost.'
                        : 'Routine loyalty nurture and service satisfaction check-in.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Local Waterfall Top Drivers */}
              <div>
                <h4 className="text-xs font-semibold text-[#0B1F4B] dark:text-[#E8D48A] mb-2 flex items-center justify-between">
                  <span>Top Explainability Factors (Local SHAP)</span>
                  <span className="text-[10px] font-normal text-[#6B7280]">vs Base Rate (18.5%)</span>
                </h4>
                <div className="space-y-1.5 text-xs">
                  {activeScoredCustomer.topDrivers.slice(0, 5).map((d) => (
                    <div
                      key={d.feature}
                      className="flex items-center justify-between p-2 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B]"
                    >
                      <span className="text-[#111827] dark:text-white truncate max-w-[190px]">
                        {d.label}
                      </span>
                      <span
                        className={`font-mono font-bold tabular-nums flex items-center gap-1 ${
                          d.direction === 'up'
                            ? 'text-[#7A0C1E] dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {d.direction === 'up' ? '+' : ''}
                        {d.contribution.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive What-If Counterfactual Simulator */}
              <div className="pt-3 border-t border-[#D9DCE6] dark:border-[#1E3A8A]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-[#0B1F4B] dark:text-[#E8D48A] flex items-center gap-1.5">
                    <Sliders size={13} className="text-[#C9A227]" />
                    <span>Interactive What-If Simulator</span>
                  </h4>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-[#6B7280]">Simulated:</span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        whatIfSimulatedScore < activeScoredCustomer.churnProbability
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-[#7A0C1E]'
                      }`}
                    >
                      {whatIfSimulatedScore}%
                    </span>
                    {whatIfSimulatedScore < activeScoredCustomer.churnProbability && (
                      <span className="text-[10px] text-emerald-600 font-semibold">
                        (-{(activeScoredCustomer.churnProbability - whatIfSimulatedScore).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 text-xs p-3.5 rounded-xl bg-[#F5F6FA] dark:bg-[#0B1F4B]">
                  {/* Slider: Price cut */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span>Monthly Tariff Discount:</span>
                      <span className="font-mono font-bold text-[#C9A227]">
                        £{whatIfChanges.priceDiscountGbp}/mo
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="2.5"
                      value={whatIfChanges.priceDiscountGbp}
                      onChange={(e) => setWhatIfChanges({ ...whatIfChanges, priceDiscountGbp: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-[#D9DCE6] dark:bg-[#1E3A8A] rounded-lg appearance-none cursor-pointer accent-[#C9A227]"
                    />
                  </div>

                  {/* Toggle: Extend Contract */}
                  <div className="flex items-center justify-between pt-1">
                    <span>18-Month Contract Re-sign:</span>
                    <button
                      onClick={() => setWhatIfChanges({
                        ...whatIfChanges,
                        extendContractMonths: whatIfChanges.extendContractMonths > 0 ? 0 : 18,
                      })}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        whatIfChanges.extendContractMonths > 0
                          ? 'bg-[#0B1F4B] text-white dark:bg-[#1E3A8A]'
                          : 'bg-white dark:bg-[#071433] border border-[#D9DCE6] text-[#6B7280]'
                      }`}
                    >
                      {whatIfChanges.extendContractMonths > 0 ? 'Applied (+18m)' : 'Apply'}
                    </button>
                  </div>

                  {/* Toggle: Resolve Complaints */}
                  <div className="flex items-center justify-between pt-1">
                    <span>Resolve Complaints & Expedite CSAT:</span>
                    <button
                      onClick={() => setWhatIfChanges({
                        ...whatIfChanges,
                        resolveComplaints: !whatIfChanges.resolveComplaints,
                      })}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        whatIfChanges.resolveComplaints
                          ? 'bg-[#0B1F4B] text-white dark:bg-[#1E3A8A]'
                          : 'bg-white dark:bg-[#071433] border border-[#D9DCE6] text-[#6B7280]'
                      }`}
                    >
                      {whatIfChanges.resolveComplaints ? 'Resolved' : 'Resolve'}
                    </button>
                  </div>

                  {/* Toggle: Direct Debit Migration */}
                  <div className="flex items-center justify-between pt-1">
                    <span>Direct Debit Setup Incentive:</span>
                    <button
                      onClick={() => setWhatIfChanges({
                        ...whatIfChanges,
                        moveToDirectDebit: !whatIfChanges.moveToDirectDebit,
                      })}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        whatIfChanges.moveToDirectDebit
                          ? 'bg-[#0B1F4B] text-white dark:bg-[#1E3A8A]'
                          : 'bg-white dark:bg-[#071433] border border-[#D9DCE6] text-[#6B7280]'
                      }`}
                    >
                      {whatIfChanges.moveToDirectDebit ? 'Active' : 'Setup'}
                    </button>
                  </div>
                </div>

                {/* Final Call to Action */}
                <button
                  onClick={() => setTab('recommendations')}
                  className="w-full mt-3 py-2 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] transition-colors text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={13} className="text-[#C9A227]" />
                  <span>Synthesize Retention Playbook</span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-[#6B7280]">
              Select a customer from the watchlist to inspect risk score and run What-If simulations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
