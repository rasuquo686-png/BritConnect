import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  History,
  RotateCcw,
  Download,
  Trash2,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppStore, updateAppState, executeModelTraining } from '../store/useAppStore';
import * as db from '../store/db';
import { parseUploadedFile, applyColumnMapping, ParseResult } from '../engine/parser';
import { validateDataset } from '../engine/validator';
import { cleanDataset } from '../engine/cleaner';
import { DATA_DICTIONARY } from '../engine/dictionary';
import { CustomerRecord, DatasetVersion, ValidationReport, CleaningStepLog } from '../types';

interface DataHubPageProps {
  onOpenUpload?: () => void;
}

export const DataHubPage: React.FC<DataHubPageProps> = ({ onOpenUpload }) => {
  const {
    records,
    datasetFileName,
    isSyntheticDemo,
    datasetVersions,
    cleaningLog,
    businessAssumptions,
    loadSyntheticDemo,
    clearAllData,
    restoreVersion,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload & Pipeline workflow states
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [sheetSelectionNeeded, setSheetSelectionNeeded] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  // Column Mapping modal state
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [customMapping, setCustomMapping] = useState<Record<string, string>>({});

  // Validation report state
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Ingestion Strategy: Append (upsert) vs Replace
  const [showIngestStrategyModal, setShowIngestStrategyModal] = useState(false);
  const [preparedCleanedData, setPreparedCleanedData] = useState<CustomerRecord[]>([]);
  const [stagedLog, setStagedLog] = useState<CleaningStepLog[]>([]);

  // Version history modal
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showCleaningLog, setShowCleaningLog] = useState(false);

  // Table pagination & search
  const [tableSearch, setTableSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // File Drop / Selection Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadedFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processUploadedFile(file);
    }
  };

  const processUploadedFile = async (file: File, sheetName?: string) => {
    setIsProcessing(true);
    setCurrentFile(file);
    try {
      const parsed = await parseUploadedFile(file, sheetName);
      if (parsed.sheetNames && parsed.sheetNames.length > 1 && !sheetName) {
        setParseResult(parsed);
        setSheetSelectionNeeded(true);
        setIsProcessing(false);
        return;
      }

      setParseResult(parsed);
      setCustomMapping(parsed.columnMapping);

      // Check if any required columns are unmapped
      const mappedTargets = new Set(Object.values(parsed.columnMapping));
      const needsManualMapping = !mappedTargets.has('Customer ID') || (!mappedTargets.has('Churn Flag') && !mappedTargets.has('Churn Status')) || parsed.unmappedHeaders.length > 3;

      if (needsManualMapping) {
        setShowMappingModal(true);
        setIsProcessing(false);
      } else {
        // Proceed straight to validation & cleaning pipeline
        continueWithMapping(parsed.rawRows, parsed.columnMapping, file.name);
      }
    } catch (err: any) {
      alert(`File processing error: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const continueWithMapping = (
    rawRows: Record<string, any>[],
    mapping: Record<string, string>,
    fileName: string
  ) => {
    const mappedRecords = applyColumnMapping(rawRows, mapping);
    const unmapped = Object.entries(mapping).filter(([_, v]) => !v).map(([k]) => k);
    const report = validateDataset(mappedRecords, unmapped);
    setValidationReport(report);

    // Run clean dataset
    const cleaningSummary = cleanDataset(mappedRecords);
    setPreparedCleanedData(cleaningSummary.cleanedRecords);
    setStagedLog(cleaningSummary.cleaningLog);

    setIsProcessing(false);
    setShowMappingModal(false);

    // If records already exist, ask Append vs Replace
    if (records.length > 0) {
      setShowIngestStrategyModal(true);
    } else {
      finalizeIngestion(cleaningSummary.cleanedRecords, fileName, 'Replace', cleaningSummary.cleaningLog);
    }
  };

  const finalizeIngestion = async (
    cleanedRows: CustomerRecord[],
    fileName: string,
    strategy: 'Append' | 'Replace',
    log: CleaningStepLog[]
  ) => {
    setIsProcessing(true);
    setShowIngestStrategyModal(false);

    let finalRecords: CustomerRecord[] = [];
    let addedCount = 0;
    let updatedCount = 0;

    if (strategy === 'Append' && records.length > 0) {
      const existingMap = new Map<string, CustomerRecord>();
      records.forEach((r) => existingMap.set(String(r['Customer ID']), r));

      cleanedRows.forEach((newRow) => {
        const id = String(newRow['Customer ID']);
        if (existingMap.has(id)) {
          existingMap.set(id, { ...existingMap.get(id), ...newRow });
          updatedCount++;
        } else {
          existingMap.set(id, newRow);
          addedCount++;
        }
      });

      finalRecords = Array.from(existingMap.values());
    } else {
      finalRecords = cleanedRows;
      addedCount = cleanedRows.length;
    }

    const version: DatasetVersion = {
      id: `v_${Date.now()}`,
      timestamp: new Date().toISOString(),
      fileName,
      rowCount: finalRecords.length,
      activeCount: finalRecords.filter((r) => Number(r['Churn Flag']) === 0).length,
      churnedCount: finalRecords.filter((r) => Number(r['Churn Flag']) === 1).length,
      action: strategy === 'Append' ? 'Append / Upsert' : 'Replace',
      author: 'User Upload',
    };

    // Save to IndexedDB
    await db.saveCurrentDataset(finalRecords, fileName, false);
    await db.saveDatasetVersion(version, finalRecords);

    updateAppState({
      records: finalRecords,
      datasetFileName: fileName,
      isSyntheticDemo: false,
      lastCleanedAt: new Date().toISOString(),
      cleaningLog: log,
      datasetVersions: [version, ...datasetVersions],
      isScoresStale: true,
      isLoading: false,
    });

    // Retrain ML models on the new dataset
    await executeModelTraining(finalRecords, businessAssumptions);
    setIsProcessing(false);
  };

  // Filtered rows for table preview
  const displayRecords = records.filter((r) => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return (
      String(r['Customer ID']).toLowerCase().includes(term) ||
      String(r['City'] || '').toLowerCase().includes(term) ||
      String(r['Plan Name'] || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(displayRecords.length / pageSize) || 1;
  const pageRows = displayRecords.slice((page - 1) * pageSize, page * pageSize);

  // Clean data export
  const handleExportData = (format: 'csv' | 'xlsx' | 'json') => {
    if (records.length === 0) return;
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BritConnect_Cleaned_Dataset_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } else if (format === 'csv') {
      const ws = XLSX.utils.json_to_sheet(records);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BritConnect_Cleaned_Dataset_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } else {
      const ws = XLSX.utils.json_to_sheet(records);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cleaned_Customers');
      XLSX.writeFile(wb, `BritConnect_Cleaned_Dataset_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Strategy Summary */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-xl font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
              Data Hub & Client-Side Ingestion
              {isSyntheticDemo && (
                <span className="text-[10px] font-sans font-semibold uppercase px-2 py-0.5 rounded bg-[#C9A227]/20 text-[#856404] dark:text-[#E8D48A] border border-[#C9A227]/40">
                  Demo Active
                </span>
              )}
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-1">
              Deterministic parsing, column mapping, schema validation, and reversible cleaning stored in IndexedDB.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowVersionHistory(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors"
            >
              <History size={14} className="text-[#C9A227]" />
              <span>Version History ({datasetVersions.length})</span>
            </button>

            <button
              onClick={() => setShowCleaningLog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium text-[#111827] dark:text-white hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors"
            >
              <Sliders size={14} className="text-[#1E3A8A] dark:text-[#E8D48A]" />
              <span>Cleaning Rules ({cleaningLog.length})</span>
            </button>

            <button
              onClick={loadSyntheticDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] transition-colors text-xs font-semibold"
            >
              <Sparkles size={14} className="text-[#C9A227]" />
              <span>Generate 1.5k UK Demo</span>
            </button>

            <button
              onClick={() => {
                if (confirm('Clear all uploaded data, models, scores, and campaigns from browser IndexedDB?')) {
                  clearAllData();
                }
              }}
              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              title="Wipe all local IndexedDB data"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Drag & Drop Upload Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="mt-6 border-2 border-dashed border-[#D9DCE6] dark:border-[#1E3A8A] hover:border-[#C9A227] rounded-xl p-8 text-center cursor-pointer transition-all bg-[#F5F6FA]/50 dark:bg-[#0B1F4B]/20"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,.json,.jsonl,.ndjson,.ods"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-12 h-12 rounded-full bg-[#1E3A8A]/10 text-[#0B1F4B] dark:text-[#C9A227] flex items-center justify-center mx-auto mb-3">
            <Upload size={22} />
          </div>

          <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
            Upload Telecommunications Dataset
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-1 max-w-md mx-auto">
            Drag and drop customer records or click to browse. Handles up to 100,000 rows × 40 columns without freezing the UI.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] text-[#6B7280]">
            <span className="px-2 py-0.5 rounded bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A]">
              Excel (.xlsx, .xls, .ods)
            </span>
            <span className="px-2 py-0.5 rounded bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A]">
              Delimited (.csv, .tsv)
            </span>
            <span className="px-2 py-0.5 rounded bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A]">
              JSON & JSONL
            </span>
            <span className="px-2 py-0.5 rounded bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A]">
              Multi-sheet Workbooks
            </span>
          </div>
        </div>
      </div>

      {/* Dataset Preview & Export Toolbar */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
              Cleaned Dataset Preview
              <span className="text-xs font-sans font-normal text-[#6B7280]">
                ({records.length.toLocaleString()} records stored in IndexedDB)
              </span>
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
              Active file: <span className="font-semibold text-[#111827] dark:text-white">{datasetFileName}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by ID, City, or Plan..."
              className="text-xs px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
            />

            <button
              onClick={() => handleExportData('csv')}
              className="px-2.5 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors"
              title="Download as CSV"
            >
              CSV
            </button>
            <button
              onClick={() => handleExportData('xlsx')}
              className="px-2.5 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors"
              title="Download as Excel"
            >
              Excel
            </button>
            <button
              onClick={() => handleExportData('json')}
              className="px-2.5 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors"
              title="Download as JSON"
            >
              JSON
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#6B7280] dark:text-[#D9DCE6]/70 uppercase text-[10px] tracking-wider border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
              <tr>
                <th className="py-2.5 px-3">Customer ID</th>
                <th className="py-2.5 px-3">Segment</th>
                <th className="py-2.5 px-3">Service & Plan</th>
                <th className="py-2.5 px-3">Contract</th>
                <th className="py-2.5 px-3">Monthly Charge</th>
                <th className="py-2.5 px-3">Tenure</th>
                <th className="py-2.5 px-3">Tickets (12M)</th>
                <th className="py-2.5 px-3">CSAT</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DCE6]/60 dark:divide-[#1E3A8A]/50 bg-white dark:bg-[#071433]">
              {pageRows.map((row) => (
                <tr key={row['Customer ID']} className="hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A]/30 transition-colors">
                  <td className="py-2 px-3 font-semibold text-[#0B1F4B] dark:text-[#E8D48A]">
                    {row['Customer ID']}
                  </td>
                  <td className="py-2 px-3 text-[#111827] dark:text-white">
                    {row['Customer Segment']}
                  </td>
                  <td className="py-2 px-3 text-[#111827] dark:text-white">
                    <div>{row['Plan Name']}</div>
                    <div className="text-[10px] text-[#6B7280]">{row['Service Type']}</div>
                  </td>
                  <td className="py-2 px-3 text-[#111827] dark:text-white">
                    {row['Contract Type']}
                  </td>
                  <td className="py-2 px-3 font-mono tabular-nums text-[#111827] dark:text-white">
                    £{Number(row['Monthly Charge GBP']).toFixed(2)}
                  </td>
                  <td className="py-2 px-3 font-mono tabular-nums">
                    {row['Tenure Months']}m
                  </td>
                  <td className="py-2 px-3 font-mono tabular-nums">
                    {row['Support Tickets 12M'] ?? 0}
                  </td>
                  <td className="py-2 px-3 font-mono tabular-nums">
                    {row['Satisfaction Score 1 10'] ?? '—'}/10
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        Number(row['Churn Flag']) === 1
                          ? 'bg-[#7A0C1E] text-white'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      }`}
                    >
                      {Number(row['Churn Flag']) === 1 ? 'Churned' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="flex items-center justify-between mt-3 text-xs text-[#6B7280]">
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, displayRecords.length)} of {displayRecords.length.toLocaleString()} rows
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded border border-[#D9DCE6] dark:border-[#1E3A8A] disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 font-mono tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded border border-[#D9DCE6] dark:border-[#1E3A8A] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Multi-sheet Excel Picker Modal */}
      {sheetSelectionNeeded && parseResult?.sheetNames && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#071433] rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#D9DCE6] dark:border-[#1E3A8A]">
            <h3 className="font-serif text-base font-bold text-[#0B1F4B] dark:text-white mb-2">
              Select Worksheet
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mb-4">
              This Excel workbook contains multiple sheets. Choose the primary customer data sheet to ingest:
            </p>

            <div className="space-y-2 mb-6">
              {parseResult.sheetNames.map((sheet) => (
                <button
                  key={sheet}
                  onClick={() => {
                    setSelectedSheet(sheet);
                    setSheetSelectionNeeded(false);
                    if (currentFile) processUploadedFile(currentFile, sheet);
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] hover:border-[#C9A227] hover:bg-[#F5F6FA] dark:hover:bg-[#0B1F4B] text-xs font-medium transition-colors flex items-center justify-between"
                >
                  <span>{sheet}</span>
                  <ArrowRight size={14} className="text-[#6B7280]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Column Mapping Modal */}
      {showMappingModal && parseResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#071433] rounded-xl max-w-2xl w-full p-6 shadow-2xl border border-[#D9DCE6] dark:border-[#1E3A8A] max-h-[90vh] flex flex-col">
            <div className="pb-3 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
              <h3 className="font-serif text-base font-bold text-[#0B1F4B] dark:text-white">
                Column Mapping Assistant
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                Verify automatic matches or manually link unrecognized headers to the BritConnect 38-column schema.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {parseResult.detectedHeaders.map((header) => {
                const currentMatch = customMapping[header] || '';
                return (
                  <div key={header} className="flex items-center justify-between gap-3 text-xs p-2 rounded bg-[#F5F6FA] dark:bg-[#0B1F4B]">
                    <span className="font-medium text-[#111827] dark:text-white truncate max-w-[200px]">
                      {header}
                    </span>
                    <ArrowRight size={13} className="text-[#6B7280] shrink-0" />
                    <select
                      value={currentMatch}
                      onChange={(e) => setCustomMapping({ ...customMapping, [header]: e.target.value })}
                      className="flex-1 text-xs px-2 py-1 bg-white dark:bg-[#071433] text-[#111827] dark:text-white border border-[#D9DCE6] dark:border-[#1E3A8A] rounded focus:ring-1 focus:ring-[#C9A227] focus:outline-none"
                    >
                      <option value="">-- Do Not Map (Keep as extra attribute) --</option>
                      {DATA_DICTIONARY.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.type})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#D9DCE6] dark:border-[#1E3A8A] flex justify-end gap-2">
              <button
                onClick={() => setShowMappingModal(false)}
                className="px-3 py-1.5 rounded-lg border border-[#D9DCE6] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => continueWithMapping(parseResult.rawRows, customMapping, currentFile?.name || 'uploaded_data.csv')}
                className="px-4 py-1.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] text-xs font-semibold"
              >
                Accept Mappings & Clean Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Append vs Replace Choice Modal */}
      {showIngestStrategyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#071433] rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#D9DCE6] dark:border-[#1E3A8A]">
            <h3 className="font-serif text-base font-bold text-[#0B1F4B] dark:text-white mb-2">
              Existing Dataset Detected
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mb-5">
              An active dataset ({records.length.toLocaleString()} rows) is currently loaded in IndexedDB. How would you like to process the new file?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => finalizeIngestion(preparedCleanedData, currentFile?.name || 'new_data.csv', 'Append', stagedLog)}
                className="w-full p-4 rounded-xl border border-[#1E3A8A] hover:bg-[#1E3A8A]/10 text-left transition-colors flex items-start gap-3"
              >
                <Layers size={18} className="text-[#C9A227] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs text-[#0B1F4B] dark:text-white">
                    Append & Upsert by Customer ID
                  </div>
                  <div className="text-[11px] text-[#6B7280] mt-0.5">
                    Match by Customer ID: new records are added, existing IDs updated with fresh values.
                  </div>
                </div>
              </button>

              <button
                onClick={() => finalizeIngestion(preparedCleanedData, currentFile?.name || 'new_data.csv', 'Replace', stagedLog)}
                className="w-full p-4 rounded-xl border border-red-300 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/20 text-left transition-colors flex items-start gap-3"
              >
                <RotateCcw size={18} className="text-[#7A0C1E] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs text-[#7A0C1E] dark:text-red-400">
                    Replace Entire Dataset
                  </div>
                  <div className="text-[11px] text-[#6B7280] mt-0.5">
                    Archives the previous version with automatic backup and loads new records cleanly.
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dataset Version History Modal */}
      {showVersionHistory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#071433] rounded-xl max-w-xl w-full p-6 shadow-2xl border border-[#D9DCE6] dark:border-[#1E3A8A]">
            <div className="flex items-center justify-between pb-3 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
              <h3 className="font-serif text-base font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
                <History size={16} className="text-[#C9A227]" />
                Dataset Version History & Restore
              </h3>
              <button
                onClick={() => setShowVersionHistory(false)}
                className="text-xs text-[#6B7280] hover:text-[#111827]"
              >
                Close
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto mt-4 space-y-2">
              {datasetVersions.map((ver) => (
                <div
                  key={ver.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs bg-[#F5F6FA] dark:bg-[#0B1F4B]"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#111827] dark:text-white">{ver.fileName}</span>
                    <span className="text-[11px] text-[#6B7280]">
                      {new Date(ver.timestamp).toLocaleString('en-GB')} · {ver.action} · {ver.rowCount.toLocaleString()} rows
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      restoreVersion(ver.id);
                      setShowVersionHistory(false);
                    }}
                    className="px-2.5 py-1 rounded bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] text-[11px] font-medium"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
