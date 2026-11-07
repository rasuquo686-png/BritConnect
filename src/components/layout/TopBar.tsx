import React, { useState } from 'react';
import {
  Search,
  Bot,
  FileDown,
  Moon,
  Sun,
  Database,
  Cpu,
  Sparkles,
  Filter,
  Upload,
} from 'lucide-react';
import { ModelTrainedResult, ScoredCustomer } from '../../types';

interface TopBarProps {
  datasetName: string;
  rowCount: number;
  isSyntheticDemo: boolean;
  trainedModel: ModelTrainedResult | null;
  isScoresStale: boolean;
  isDark: boolean;
  onToggleDark: () => void;
  onToggleChat: () => void;
  onExportReports: () => void;
  onOpenUpload: () => void;
  scoredCustomers: ScoredCustomer[];
  onSelectCustomer: (customerId: string) => void;
  activeFilterCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  datasetName,
  rowCount,
  isSyntheticDemo,
  trainedModel,
  isScoresStale,
  isDark,
  onToggleDark,
  onToggleChat,
  onExportReports,
  onOpenUpload,
  scoredCustomers,
  onSelectCustomer,
  activeFilterCount,
}) => {
  const [searchVal, setSearchVal] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const matchedCustomers = searchVal.trim().length > 1
    ? scoredCustomers
        .filter((s) => s.customerId.toLowerCase().includes(searchVal.toLowerCase()) || (s.record['City'] && String(s.record['City']).toLowerCase().includes(searchVal.toLowerCase())))
        .slice(0, 6)
    : [];

  return (
    <header className="h-16 bg-white dark:bg-[#071433] border-b border-[#D9DCE6] dark:border-[#1E3A8A] px-4 md:px-6 flex items-center justify-between gap-4 select-none shrink-0 z-20">
      {/* Zone 1: Customer ID Search Bar */}
      <div className="relative flex-1 max-w-md">
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3 text-[#6B7280] pointer-events-none" />
          <input
            type="text"
            value={searchVal}
            onChange={(e) => {
              setSearchVal(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Search Customer ID (e.g. BC-10042) or City..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-white rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] focus:outline-none focus:ring-1 focus:ring-[#C9A227] transition-all placeholder:text-[#6B7280]"
          />
        </div>

        {/* Search Results Dropdown */}
        {isDropdownOpen && matchedCustomers.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#0B1F4B] border border-[#D9DCE6] dark:border-[#1E3A8A] rounded-lg shadow-xl overflow-hidden z-50">
            <div className="p-1.5 text-[10px] uppercase font-semibold text-[#6B7280] border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
              Matching Accounts
            </div>
            {matchedCustomers.map((cust) => (
              <button
                key={cust.customerId}
                onClick={() => {
                  onSelectCustomer(cust.customerId);
                  setIsDropdownOpen(false);
                  setSearchVal('');
                }}
                className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors text-xs"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-[#0B1F4B] dark:text-[#E8D48A]">{cust.customerId}</span>
                  <span className="text-[11px] text-[#6B7280]">
                    {cust.record['Plan Name']} · {cust.record['City']}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      cust.riskTier === 'Critical'
                        ? 'bg-[#7A0C1E] text-white'
                        : cust.riskTier === 'High'
                        ? 'bg-[#B5483A] text-white'
                        : cust.riskTier === 'Medium'
                        ? 'bg-[#C9A227]/20 text-[#856404]'
                        : 'bg-[#1E3A8A]/15 text-[#1E3A8A]'
                    }`}
                  >
                    {cust.churnProbability.toFixed(1)}% Risk
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zone 2: Status Chips */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Dataset Status */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#F5F6FA] dark:bg-[#0B1F4B] border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs">
          <Database size={13} className="text-[#0B1F4B] dark:text-[#C9A227]" />
          <span className="font-medium text-[#111827] dark:text-white truncate max-w-[140px]">
            {datasetName}
          </span>
          <span className="text-[#6B7280] font-mono tabular-nums text-[11px]">
            ({rowCount.toLocaleString()} rows)
          </span>
          {isSyntheticDemo && (
            <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-[#C9A227]/20 text-[#856404] dark:text-[#E8D48A]">
              Demo
            </span>
          )}
        </div>

        {/* Model Status */}
        {trainedModel && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#F5F6FA] dark:bg-[#0B1F4B] border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs">
            <Cpu size={13} className="text-[#1E3A8A] dark:text-[#C9A227]" />
            <span className="font-medium text-[#111827] dark:text-white truncate max-w-[120px]">
              {trainedModel.modelName}
            </span>
            <span className="font-mono tabular-nums text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              AUC {(trainedModel.metrics.rocAuc).toFixed(3)}
            </span>
            {isScoresStale && (
              <span className="text-[9px] uppercase font-bold px-1 py-0.2 rounded bg-amber-100 text-amber-800">
                Stale
              </span>
            )}
          </div>
        )}

        {/* Active Filters Pill */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1E3A8A]/10 text-[#0B1F4B] dark:text-[#E8D48A] text-xs font-medium">
            <Filter size={12} />
            <span>{activeFilterCount} active filters</span>
          </div>
        )}
      </div>

      {/* Zone 3: Actions & Quick Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A227] text-[#0B1F4B] hover:bg-[#E8D48A] transition-colors text-xs font-bold shadow-xs whitespace-nowrap"
          title="Upload CSV, Excel, or JSON Customer Dataset"
        >
          <Upload size={14} className="stroke-[2.5]" />
          <span>Upload Data</span>
        </button>

        <button
          onClick={onExportReports}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors"
          title="Download PDF & Excel Reports"
        >
          <FileDown size={14} className="text-[#C9A227]" />
          <span>Export</span>
        </button>

        <button
          onClick={onToggleChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] transition-colors text-xs font-semibold shadow-sm"
          title="Ask BritConnect AI Analyst"
        >
          <Bot size={15} className="text-[#C9A227]" />
          <span className="hidden md:inline">AI Analyst</span>
        </button>

        <button
          onClick={onToggleDark}
          className="p-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-[#6B7280] dark:text-[#D9DCE6] hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors"
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
};
