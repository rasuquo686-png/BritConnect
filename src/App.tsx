import React, { useEffect, useState } from 'react';
import { useAppStore, initializeAppState } from './store/useAppStore';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { GlobalFilterBar } from './components/layout/GlobalFilterBar';
import { ChatDrawer } from './components/chat/ChatDrawer';
import { DataUploadModal } from './components/upload/DataUploadModal';
import { DashboardPage } from './pages/DashboardPage';
import { DrilldownPage } from './pages/DrilldownPage';
import { SegmentationPage } from './pages/SegmentationPage';
import { ModelLabPage } from './pages/ModelLabPage';
import { RiskScoringPage } from './pages/RiskScoringPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { ChatbotView } from './components/chat/ChatbotView';
import { DataHubPage } from './pages/DataHubPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const {
    activeTab,
    setTab,
    records,
    datasetFileName,
    isSyntheticDemo,
    trainedModel,
    isScoresStale,
    scoredCustomers,
    filters,
    setFilters,
    resetFilters,
    selectCustomer,
    isDark,
    toggleDarkMode,
    toggleChatDrawer,
    isLoading,
    loadingMessage,
  } = useAppStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Initialize on mount
  useEffect(() => {
    initializeAppState();
  }, []);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const activeCustomerCount = records.filter((r) => Number(r['Churn Flag']) === 0).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F5F6FA] dark:bg-[#071433] text-[#111827] dark:text-[#D9DCE6]">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isSyntheticDemo={isSyntheticDemo}
        activeCustomerCount={activeCustomerCount}
        onOpenUpload={() => setIsUploadModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <TopBar
          datasetName={datasetFileName}
          rowCount={records.length}
          isSyntheticDemo={isSyntheticDemo}
          trainedModel={trainedModel}
          isScoresStale={isScoresStale}
          isDark={isDark}
          onToggleDark={toggleDarkMode}
          onToggleChat={toggleChatDrawer}
          onExportReports={() => setTab('reports')}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          scoredCustomers={scoredCustomers}
          onSelectCustomer={(id) => {
            selectCustomer(id);
            setTab('riskscoring');
          }}
          activeFilterCount={activeFilterCount}
        />

        {/* Global Filter Bar */}
        <GlobalFilterBar
          records={records}
          filters={filters}
          onFilterChange={setFilters}
          onResetFilters={resetFilters}
        />

        {/* Dynamic Page Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 transition-all">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-96 space-y-3">
              <div className="w-8 h-8 border-3 border-[#0B1F4B] border-t-[#C9A227] rounded-full animate-spin" />
              <div className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                {loadingMessage || 'Loading BritConnect Churn Intelligence...'}
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <DashboardPage onOpenUpload={() => setIsUploadModalOpen(true)} />}
              {activeTab === 'drilldown' && <DrilldownPage />}
              {activeTab === 'segmentation' && <SegmentationPage />}
              {activeTab === 'modellab' && <ModelLabPage />}
              {activeTab === 'riskscoring' && <RiskScoringPage />}
              {activeTab === 'recommendations' && <RecommendationsPage />}
              {activeTab === 'campaigns' && <CampaignsPage />}
              {activeTab === 'analyst' && <ChatbotView />}
              {activeTab === 'hub' && <DataHubPage onOpenUpload={() => setIsUploadModalOpen(true)} />}
              {activeTab === 'reports' && <ReportsPage />}
              {activeTab === 'settings' && <SettingsPage />}
            </>
          )}
        </main>
      </div>

      {/* Data Ingestion & Upload Modal (CSV, Excel, TSV, JSON, JSONL) */}
      <DataUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      {/* Persistent AI Analyst Slide-over Drawer */}
      <ChatDrawer />
    </div>
  );
}
