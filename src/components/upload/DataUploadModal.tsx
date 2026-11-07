import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Database,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  Layers,
  RotateCcw,
  Sparkles,
  Download,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppStore, updateAppState, executeModelTraining } from '../../store/useAppStore';
import * as db from '../../store/db';
import { parseUploadedFile, applyColumnMapping, ParseResult } from '../../engine/parser';
import { validateDataset } from '../../engine/validator';
import { cleanDataset } from '../../engine/cleaner';
import { DATA_DICTIONARY } from '../../engine/dictionary';
import { CustomerRecord, DatasetVersion, ValidationReport } from '../../types';
import { generateSyntheticDemoDataset } from '../../engine/syntheticData';

interface DataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataUploadModal: React.FC<DataUploadModalProps> = ({ isOpen, onClose }) => {
  const { records, datasetVersions, businessAssumptions } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'sheet_select' | 'mapping' | 'validation' | 'strategy' | 'processing'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [cleanedRecords, setCleanedRecords] = useState<CustomerRecord[]>([]);
  const [progressMsg, setProgressMsg] = useState('Parsing uploaded file...');

  if (!isOpen) return null;

  const resetModal = () => {
    setStep('upload');
    setSelectedFile(null);
    setParseResult(null);
    setColumnMapping({});
    setValidationReport(null);
    setCleanedRecords([]);
    onClose();
  };

  const handleFile = async (file: File) => {
    setSelectedFile(file);
    setStep('processing');
    setProgressMsg(`Reading ${file.name}...`);

    try {
      const parsed = await parseUploadedFile(file);
      setParseResult(parsed);
      setColumnMapping(parsed.columnMapping);

      if (parsed.sheetNames && parsed.sheetNames.length > 1) {
        setStep('sheet_select');
        return;
      }

      evaluateMapping(parsed);
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
      setStep('upload');
    }
  };

  const handleSheetPicked = async (sheet: string) => {
    if (!selectedFile) return;
    setStep('processing');
    setProgressMsg(`Extracting sheet "${sheet}"...`);
    try {
      const parsed = await parseUploadedFile(selectedFile, sheet);
      setParseResult(parsed);
      setColumnMapping(parsed.columnMapping);
      evaluateMapping(parsed);
    } catch (err: any) {
      alert(`Sheet extraction error: ${err.message}`);
      setStep('upload');
    }
  };

  const evaluateMapping = (parsed: ParseResult) => {
    // Check if required columns are matched
    const mappedTargets = new Set(Object.values(parsed.columnMapping));
    const hasCustId = mappedTargets.has('Customer ID');
    const hasTarget = mappedTargets.has('Churn Flag') || mappedTargets.has('Churn Status');

    // If unmapped required or user has unmapped headers, let them inspect
    if (!hasCustId || !hasTarget || parsed.unmappedHeaders.length > 2) {
      setStep('mapping');
    } else {
      runValidationAndClean(parsed.rawRows, parsed.columnMapping);
    }
  };

  const runValidationAndClean = (rawRows: Record<string, any>[], mapping: Record<string, string>) => {
    setStep('processing');
    setProgressMsg('Running 38-column schema validation & quality audit...');

    let mapped = applyColumnMapping(rawRows, mapping);

    // Auto-generate Customer ID if completely absent
    if (mapped.length > 0 && !mapped[0]['Customer ID']) {
      mapped = mapped.map((r, i) => ({
        ...r,
        'Customer ID': `CUST-${(10001 + i).toString()}`,
      }));
    }

    // Default Churn Flag to 0 (Active) if missing (e.g. scoring batch)
    if (mapped.length > 0 && mapped[0]['Churn Flag'] === undefined && mapped[0]['Churn Status'] === undefined) {
      mapped = mapped.map((r) => ({
        ...r,
        'Churn Flag': 0,
        'Churn Status': 'Active',
      }));
    }

    const unmapped = Object.entries(mapping).filter(([_, v]) => !v).map(([k]) => k);
    const report = validateDataset(mapped, unmapped);
    setValidationReport(report);

    const cleaning = cleanDataset(mapped);
    setCleanedRecords(cleaning.cleanedRecords);

    setStep('validation');
  };

  const handleFinalize = async (strategy: 'Append' | 'Replace') => {
    setStep('processing');
    setProgressMsg('Storing cleaned dataset in IndexedDB & updating predictive models...');

    let finalRecords: CustomerRecord[] = [];
    if (strategy === 'Append' && records.length > 0) {
      const existingMap = new Map<string, CustomerRecord>();
      records.forEach((r) => existingMap.set(String(r['Customer ID']), r));

      cleanedRecords.forEach((newRow) => {
        const id = String(newRow['Customer ID']);
        if (existingMap.has(id)) {
          existingMap.set(id, { ...existingMap.get(id), ...newRow });
        } else {
          existingMap.set(id, newRow);
        }
      });
      finalRecords = Array.from(existingMap.values());
    } else {
      finalRecords = cleanedRecords;
    }

    const version: DatasetVersion = {
      id: `v_${Date.now()}`,
      timestamp: new Date().toISOString(),
      fileName: selectedFile?.name || 'uploaded_data.csv',
      rowCount: finalRecords.length,
      activeCount: finalRecords.filter((r) => Number(r['Churn Flag']) === 0).length,
      churnedCount: finalRecords.filter((r) => Number(r['Churn Flag']) === 1).length,
      action: strategy === 'Append' ? 'Append / Upsert' : 'Replace',
      author: 'User Upload',
    };

    await db.saveCurrentDataset(finalRecords, version.fileName, false);
    await db.saveDatasetVersion(version, finalRecords);

    updateAppState({
      records: finalRecords,
      datasetFileName: version.fileName,
      isSyntheticDemo: false,
      lastCleanedAt: new Date().toISOString(),
      datasetVersions: [version, ...datasetVersions],
      isScoresStale: true,
      isLoading: false,
    });

    await executeModelTraining(finalRecords, businessAssumptions);
    resetModal();
  };

  // Download 38-column CSV template
  const downloadTemplateCsv = () => {
    const headers = DATA_DICTIONARY.map((col) => col.name);
    const sampleRow = DATA_DICTIONARY.map((col) => {
      if (col.name === 'Customer ID') return 'BC-99001';
      if (col.name === 'Customer Segment') return 'Consumer';
      if (col.name === 'Age') return 42;
      if (col.name === 'Age Band') return '35-44';
      if (col.name === 'Gender') return 'Female';
      if (col.name === 'UK Nation') return 'England';
      if (col.name === 'City') return 'Manchester';
      if (col.name === 'Monthly Charge GBP') return 45.0;
      if (col.name === 'Tenure Months') return 24;
      if (col.name === 'Contract Type') return '24 Months';
      if (col.name === 'Service Type') return 'Broadband Only';
      if (col.name === 'Plan Name') return 'Fibre 150 Ultra';
      if (col.name === 'Churn Flag') return 0;
      if (col.name === 'Churn Status') return 'Active';
      return '';
    });

    const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'BritConnect_38_Column_Schema_Template.csv';
    a.click();
  };

  // Download Sample Excel file (.xlsx)
  const downloadSampleExcel = () => {
    const demoData = generateSyntheticDemoDataset(100, 2026);
    const ws = XLSX.utils.json_to_sheet(demoData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer_Data');
    XLSX.writeFile(wb, 'BritConnect_Sample_Telecom_Data.xlsx');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#071433] rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#D9DCE6] dark:border-[#1E3A8A] max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#D9DCE6] dark:border-[#1E3A8A] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0B1F4B] text-[#C9A227] flex items-center justify-center font-bold">
              <Upload size={18} />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-[#0B1F4B] dark:text-white flex items-center gap-2">
                Upload Customer Data
                <span className="text-[10px] font-sans font-semibold uppercase px-2 py-0.5 rounded bg-[#C9A227]/20 text-[#856404] dark:text-[#E8D48A]">
                  Multi-Format
                </span>
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                Supports CSV, Excel (.xlsx, .xls), TSV, JSON, and JSON Lines
              </p>
            </div>
          </div>

          <button
            onClick={resetModal}
            className="p-1.5 text-[#6B7280] hover:text-[#111827] dark:hover:text-white rounded-lg hover:bg-black/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic Body */}
        <div className="flex-1 overflow-y-auto py-5">
          {step === 'processing' && (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-[#0B1F4B] border-t-[#C9A227] rounded-full animate-spin mx-auto" />
              <div className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                {progressMsg}
              </div>
              <div className="text-xs text-[#6B7280]">
                All data is processed strictly in your browser. No confidential records leave this device.
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-5">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#D9DCE6] dark:border-[#1E3A8A] hover:border-[#C9A227] dark:hover:border-[#C9A227] rounded-2xl p-8 text-center cursor-pointer transition-all bg-[#F5F6FA]/60 dark:bg-[#0B1F4B]/20"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.ods,.csv,.tsv,.json,.jsonl,.ndjson,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-full bg-[#1E3A8A]/10 text-[#0B1F4B] dark:text-[#C9A227] flex items-center justify-center mx-auto mb-3">
                  <Upload size={26} />
                </div>

                <div className="font-serif text-base font-bold text-[#0B1F4B] dark:text-white">
                  Drop your customer data file here
                </div>
                <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-1 max-w-sm mx-auto">
                  Click to browse from your computer. Up to 100,000 rows × 40 columns.
                </p>

                {/* Badges */}
                <div className="flex flex-wrap justify-center gap-2 mt-4 text-[11px] font-medium text-[#6B7280] dark:text-[#D9DCE6]">
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A] shadow-2xs">
                    Excel (.xlsx, .xls)
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A] shadow-2xs">
                    CSV (.csv)
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A] shadow-2xs">
                    TSV / Tab-Delimited
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-[#071433] border border-[#D9DCE6] dark:border-[#1E3A8A] shadow-2xs">
                    JSON & JSONL
                  </span>
                </div>
              </div>

              {/* Sample Templates Download Card */}
              <div className="p-4 rounded-xl bg-[#F5F6FA] dark:bg-[#0B1F4B] border border-[#D9DCE6] dark:border-[#1E3A8A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold text-[#0B1F4B] dark:text-white flex items-center gap-1.5">
                    <Download size={14} className="text-[#C9A227]" />
                    <span>Need a format template or test dataset?</span>
                  </div>
                  <div className="text-[11px] text-[#6B7280] dark:text-[#D9DCE6]/70 mt-0.5">
                    Download sample files matching the authoritative 38-column dictionary.
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={downloadTemplateCsv}
                    className="px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] bg-white dark:bg-[#071433] font-medium text-[#111827] dark:text-white hover:bg-black/5"
                  >
                    CSV Template
                  </button>
                  <button
                    onClick={downloadSampleExcel}
                    className="px-3 py-1.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] font-semibold"
                  >
                    Sample Excel (.xlsx)
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'sheet_select' && parseResult?.sheetNames && (
            <div className="space-y-4">
              <div className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                This workbook has multiple worksheets. Select the sheet containing customer records:
              </div>
              <div className="space-y-2">
                {parseResult.sheetNames.map((sheet) => (
                  <button
                    key={sheet}
                    onClick={() => handleSheetPicked(sheet)}
                    className="w-full text-left p-3.5 rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] hover:border-[#C9A227] hover:bg-[#F5F6FA] dark:hover:bg-[#0B1F4B] transition-all flex items-center justify-between text-xs font-semibold"
                  >
                    <span className="flex items-center gap-2 text-[#0B1F4B] dark:text-white">
                      <FileSpreadsheet size={16} className="text-[#C9A227]" />
                      {sheet}
                    </span>
                    <ArrowRight size={14} className="text-[#6B7280]" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'mapping' && parseResult && (
            <div className="space-y-4">
              <div className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                Verify automatic column matching against the 38-column dictionary:
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {parseResult.detectedHeaders.map((header) => (
                  <div
                    key={header}
                    className="flex items-center justify-between gap-3 text-xs p-2.5 rounded-lg bg-[#F5F6FA] dark:bg-[#0B1F4B]"
                  >
                    <span className="font-medium text-[#111827] dark:text-white truncate max-w-[180px]">
                      {header}
                    </span>
                    <ArrowRight size={13} className="text-[#6B7280] shrink-0" />
                    <select
                      value={columnMapping[header] || ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [header]: e.target.value })}
                      className="flex-1 text-xs px-2.5 py-1.5 bg-white dark:bg-[#071433] text-[#111827] dark:text-white border border-[#D9DCE6] dark:border-[#1E3A8A] rounded-md focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
                    >
                      <option value="">-- Keep as unmapped attribute --</option>
                      {DATA_DICTIONARY.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.type})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => runValidationAndClean(parseResult.rawRows, columnMapping)}
                  className="px-4 py-2 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] text-xs font-semibold"
                >
                  Confirm Mappings & Validate
                </button>
              </div>
            </div>
          )}

          {step === 'validation' && validationReport && (
            <div className="space-y-5">
              {/* Quality Score Card */}
              <div className="p-4 rounded-xl bg-[#F5F6FA] dark:bg-[#0B1F4B] border border-[#D9DCE6] dark:border-[#1E3A8A] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#6B7280]">Data Quality Score</span>
                  <div className="font-serif text-2xl font-bold text-[#0B1F4B] dark:text-white mt-0.5">
                    {validationReport.qualityScore} / 100
                  </div>
                  <div className="text-[11px] text-[#6B7280]">
                    {cleanedRecords.length.toLocaleString()} records ready to ingest
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 size={15} />
                  <span>Schema Verified</span>
                </div>
              </div>

              {/* Ingestion Strategy Choice */}
              {records.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-[#0B1F4B] dark:text-white">
                    Choose Ingestion Strategy:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <button
                      onClick={() => handleFinalize('Append')}
                      className="p-3.5 rounded-xl border border-[#1E3A8A] hover:bg-[#1E3A8A]/10 text-left transition-colors flex items-start gap-2.5"
                    >
                      <Layers size={18} className="text-[#C9A227] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-[#0B1F4B] dark:text-white">
                          Append / Upsert
                        </div>
                        <div className="text-[11px] text-[#6B7280] mt-0.5">
                          Merge with current {records.length.toLocaleString()} rows. Updates matching Customer IDs and inserts new records.
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleFinalize('Replace')}
                      className="p-3.5 rounded-xl border border-red-300 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/20 text-left transition-colors flex items-start gap-2.5"
                    >
                      <RotateCcw size={18} className="text-[#7A0C1E] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-[#7A0C1E] dark:text-red-400">
                          Replace Entirely
                        </div>
                        <div className="text-[11px] text-[#6B7280] mt-0.5">
                          Archives current dataset with automatic backup and sets this file as the active base.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => handleFinalize('Replace')}
                    className="px-5 py-2.5 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] text-xs font-semibold shadow-xs"
                  >
                    Save & Load Dataset
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
