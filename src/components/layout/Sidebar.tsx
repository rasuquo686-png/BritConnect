import React from 'react';
import {
  LayoutDashboard,
  Database,
  BarChart3,
  Users2,
  Cpu,
  ShieldAlert,
  Lightbulb,
  Target,
  Bot,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isSyntheticDemo: boolean;
  activeCustomerCount: number;
  onOpenUpload?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  isSyntheticDemo,
  activeCustomerCount,
  onOpenUpload,
}) => {
  const navCategories = [
    {
      category: 'WORKFLOW',
      items: [
        { id: 'dashboard', label: 'Overview & Executive', icon: LayoutDashboard },
        { id: 'hub', label: 'Upload & Data Hub', icon: Database },
      ],
    },
    {
      category: 'INTELLIGENCE',
      items: [
        { id: 'drilldown', label: 'Churn Drivers & Analysis', icon: BarChart3 },
        { id: 'segmentation', label: 'Customer Segments', icon: Users2 },
        { id: 'riskscoring', label: 'Customer 360 & Scores', icon: ShieldAlert },
      ],
    },
    {
      category: 'INTERVENTION',
      items: [
        { id: 'campaigns', label: 'Campaign Tracker', icon: Target },
        { id: 'recommendations', label: 'Action Centre (AI Playbooks)', icon: Lightbulb },
        { id: 'analyst', label: 'AI Analytics Chat', icon: Bot },
      ],
    },
    {
      category: 'GOVERNANCE',
      items: [
        { id: 'modellab', label: 'Model Studio & Explain', icon: Cpu },
        { id: 'reports', label: 'Reports & Exports', icon: FileSpreadsheet },
        { id: 'settings', label: 'Settings & Diagnostics', icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={`relative flex flex-col bg-[#0B1F4B] text-white transition-all duration-300 select-none z-30 shrink-0 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-[#1E3A8A]">
        {!collapsed ? (
          <div className="flex flex-col">
            <span className="font-serif text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              BritConnect
              <span className="text-[#C9A227] text-xs font-sans font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#C9A227]/10 border border-[#C9A227]/30">
                AI
              </span>
            </span>
            <span className="text-[11px] text-[#D9DCE6]/70 tracking-wide mt-0.5">
              Churn Intelligence Platform
            </span>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-[#C9A227] flex items-center justify-center font-serif font-bold text-[#0B1F4B] text-sm mx-auto">
            BC
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="p-1 rounded text-[#D9DCE6] hover:text-white hover:bg-[#1E3A8A] transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Demo Data Indicator */}
      {!collapsed && isSyntheticDemo && (
        <div className="mx-3 mt-3 px-3 py-2 rounded bg-[#C9A227]/15 border border-[#C9A227]/40 flex items-center gap-2">
          <Sparkles size={14} className="text-[#C9A227] shrink-0" />
          <div className="flex flex-col text-[11px] leading-tight">
            <span className="font-semibold text-[#E8D48A]">SYNTHETIC DEMO DATA</span>
            <span className="text-[#D9DCE6]/80">{activeCustomerCount.toLocaleString()} UK telecom records</span>
          </div>
        </div>
      )}

      {/* Grouped Nav Menu */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navCategories.map((group) => (
          <div key={group.category} className="space-y-1">
            {!collapsed && (
              <div className="px-3 pt-1 pb-1 text-[10px] font-bold tracking-wider uppercase text-[#C9A227]/80">
                {group.category}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group relative ${
                    isActive
                      ? 'bg-[#1E3A8A] text-white shadow-xs'
                      : 'text-[#D9DCE6] hover:text-white hover:bg-[#1E3A8A]/50'
                  }`}
                >
                  {/* Active Gold Indicator Marker */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#C9A227] rounded-r" />
                  )}
                  <Icon
                    size={17}
                    className={`shrink-0 transition-colors ${
                      isActive ? 'text-[#C9A227]' : 'text-[#D9DCE6] group-hover:text-white'
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate text-left">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer System Status */}
      <div className="p-3 border-t border-[#1E3A8A] text-[11px] text-[#D9DCE6]/60">
        {!collapsed ? (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-white font-medium">
              <span>Client ML Engine</span>
              <span className="text-emerald-400">Deterministic</span>
            </div>
            <span>v2.4.0 · en-GB (£)</span>
          </div>
        ) : (
          <div className="text-center">v2.4</div>
        )}
      </div>
    </aside>
  );
};
