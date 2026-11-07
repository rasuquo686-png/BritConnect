import React, { useMemo } from 'react';
import { RotateCcw, X, SlidersHorizontal } from 'lucide-react';
import { CustomerRecord, GlobalFilters, RiskTier } from '../../types';

interface GlobalFilterBarProps {
  records: CustomerRecord[];
  filters: GlobalFilters;
  onFilterChange: (filters: Partial<GlobalFilters>) => void;
  onResetFilters: () => void;
}

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({
  records,
  filters,
  onFilterChange,
  onResetFilters,
}) => {
  // Extract unique options from the actual data records
  const filterOptions = useMemo(() => {
    const segments = new Set<string>();
    const services = new Set<string>();
    const plans = new Set<string>();
    const nations = new Set<string>();
    const cities = new Set<string>();
    const channels = new Set<string>();
    const contracts = new Set<string>();

    records.forEach((r) => {
      if (r['Customer Segment']) segments.add(r['Customer Segment']);
      if (r['Service Type']) services.add(r['Service Type']);
      if (r['Plan Name']) plans.add(r['Plan Name']);
      if (r['UK Nation']) nations.add(r['UK Nation']);
      if (r['City']) cities.add(r['City']);
      if (r['Acquisition Channel']) channels.add(r['Acquisition Channel']);
      if (r['Contract Type']) contracts.add(r['Contract Type']);
    });

    return {
      segments: Array.from(segments).sort(),
      services: Array.from(services).sort(),
      plans: Array.from(plans).sort(),
      nations: Array.from(nations).sort(),
      cities: Array.from(cities).slice(0, 20).sort(),
      channels: Array.from(channels).sort(),
      contracts: Array.from(contracts).sort(),
      tenureBands: ['0–6 Months', '7–12 Months', '13–24 Months', '25–48 Months', '48+ Months'],
      riskTiers: ['Critical', 'High', 'Medium', 'Low'] as RiskTier[],
    };
  }, [records]);

  // Compute active filters list for display chips
  const activeEntries = Object.entries(filters).filter(([_, val]) => Boolean(val));

  return (
    <div className="bg-white dark:bg-[#071433] border-b border-[#D9DCE6] dark:border-[#1E3A8A] px-4 md:px-6 py-2.5 transition-colors">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-[#6B7280] font-medium pr-1">
          <SlidersHorizontal size={13} className="text-[#0B1F4B] dark:text-[#C9A227]" />
          <span>Filters:</span>
        </div>

        {/* Customer Segment */}
        <select
          value={filters.customerSegment || ''}
          onChange={(e) => onFilterChange({ customerSegment: e.target.value || undefined })}
          className="bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-[#D9DCE6] border border-[#D9DCE6] dark:border-[#1E3A8A] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#C9A227] focus:outline-none"
        >
          <option value="">All Segments</option>
          {filterOptions.segments.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Service Type */}
        <select
          value={filters.serviceType || ''}
          onChange={(e) => onFilterChange({ serviceType: e.target.value || undefined })}
          className="bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-[#D9DCE6] border border-[#D9DCE6] dark:border-[#1E3A8A] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#C9A227] focus:outline-none"
        >
          <option value="">All Services</option>
          {filterOptions.services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Contract Type */}
        <select
          value={filters.contractType || ''}
          onChange={(e) => onFilterChange({ contractType: e.target.value || undefined })}
          className="bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-[#D9DCE6] border border-[#D9DCE6] dark:border-[#1E3A8A] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#C9A227] focus:outline-none"
        >
          <option value="">All Contracts</option>
          {filterOptions.contracts.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* UK Nation */}
        <select
          value={filters.ukNation || ''}
          onChange={(e) => onFilterChange({ ukNation: e.target.value || undefined })}
          className="bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-[#D9DCE6] border border-[#D9DCE6] dark:border-[#1E3A8A] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#C9A227] focus:outline-none"
        >
          <option value="">All UK Nations</option>
          {filterOptions.nations.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {/* Acquisition Channel */}
        <select
          value={filters.acquisitionChannel || ''}
          onChange={(e) => onFilterChange({ acquisitionChannel: e.target.value || undefined })}
          className="bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-[#D9DCE6] border border-[#D9DCE6] dark:border-[#1E3A8A] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#C9A227] focus:outline-none"
        >
          <option value="">All Channels</option>
          {filterOptions.channels.map((ch) => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>

        {/* Tenure Band */}
        <select
          value={filters.tenureBand || ''}
          onChange={(e) => onFilterChange({ tenureBand: e.target.value || undefined })}
          className="bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-[#D9DCE6] border border-[#D9DCE6] dark:border-[#1E3A8A] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#C9A227] focus:outline-none"
        >
          <option value="">All Tenure Bands</option>
          {filterOptions.tenureBands.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Risk Tier */}
        <select
          value={filters.riskTier || ''}
          onChange={(e) => onFilterChange({ riskTier: (e.target.value as RiskTier) || undefined })}
          className="bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-[#D9DCE6] border border-[#D9DCE6] dark:border-[#1E3A8A] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#C9A227] focus:outline-none"
        >
          <option value="">All Risk Tiers</option>
          {filterOptions.riskTiers.map((r) => (
            <option key={r} value={r}>{r} Risk</option>
          ))}
        </select>

        {/* Reset Action */}
        {activeEntries.length > 0 && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1 ml-auto text-xs font-semibold text-[#7A0C1E] dark:text-red-400 hover:underline"
          >
            <RotateCcw size={12} />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* Active Filter Chips Bar */}
      {activeEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-[#D9DCE6]/60 dark:border-[#1E3A8A]/50">
          <span className="text-[11px] text-[#6B7280]">Active:</span>
          {activeEntries.map(([key, val]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#1E3A8A]/10 dark:bg-[#1E3A8A]/30 text-[#0B1F4B] dark:text-[#E8D48A] px-2 py-0.5 rounded border border-[#1E3A8A]/20"
            >
              <span>{val}</span>
              <button
                onClick={() => onFilterChange({ [key]: undefined })}
                className="hover:text-red-600 transition-colors"
                title={`Remove ${key} filter`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
