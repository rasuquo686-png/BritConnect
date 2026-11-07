/**
 * Multi-format Client-side Data Parser
 * Supports: XLSX, XLS, CSV, TSV, JSON, JSONL / NDJSON
 * Multi-sheet workbook detection and sheet extraction
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { matchColumn } from './dictionary';
import { CustomerRecord } from '../types';

export interface ParseResult {
  sheetNames?: string[];
  selectedSheet?: string;
  rawRows: Record<string, any>[];
  detectedHeaders: string[];
  columnMapping: Record<string, string>; // originalHeader -> canonicalHeader (or '' for unmapped)
  unmappedHeaders: string[];
  rowCount: number;
}

/**
 * Parses raw text or ArrayBuffer based on filename extension
 */
export async function parseUploadedFile(
  file: File,
  sheetName?: string
): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (['xlsx', 'xls', 'ods'].includes(extension)) {
    return parseExcelFile(file, sheetName);
  } else if (['csv', 'tsv', 'txt'].includes(extension)) {
    return parseDelimitedFile(file);
  } else if (['json', 'jsonl', 'ndjson'].includes(extension)) {
    return parseJsonFile(file, extension);
  } else {
    // Attempt Excel first, fallback to Delimited
    try {
      return await parseExcelFile(file, sheetName);
    } catch {
      return await parseDelimitedFile(file);
    }
  }
}

async function parseExcelFile(file: File, sheetName?: string): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames;
  const targetSheetName = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const worksheet = workbook.Sheets[targetSheetName];

  if (!worksheet) {
    throw new Error(`Sheet "${targetSheetName}" not found in workbook.`);
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  return processParsedRows(rawRows, sheetNames, targetSheetName);
}

async function parseDelimitedFile(file: File): Promise<ParseResult> {
  const text = await file.text();

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (results.errors && results.errors.length > 0 && results.data.length === 0) {
          reject(new Error(`CSV Parsing Error: ${results.errors[0].message}`));
          return;
        }
        resolve(processParsedRows(results.data));
      },
      error: (err: any) => reject(new Error(err.message)),
    });
  });
}

async function parseJsonFile(file: File, extension: string): Promise<ParseResult> {
  const text = await file.text();
  let rawRows: Record<string, any>[] = [];

  if (extension === 'jsonl' || extension === 'ndjson' || text.trim().startsWith('{') && text.includes('\n{')) {
    // Parse JSON Lines
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    rawRows = lines.map((line) => JSON.parse(line));
  } else {
    // Parse standard JSON
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      rawRows = parsed;
    } else if (parsed && Array.isArray(parsed.data)) {
      rawRows = parsed.data;
    } else if (parsed && Array.isArray(parsed.records)) {
      rawRows = parsed.records;
    } else if (parsed && Array.isArray(parsed.customers)) {
      rawRows = parsed.customers;
    } else {
      throw new Error('Unsupported JSON structure: Expected an array of customer records or { data: [...] }');
    }
  }

  return processParsedRows(rawRows);
}

function processParsedRows(
  rawRows: Record<string, any>[],
  sheetNames?: string[],
  selectedSheet?: string
): ParseResult {
  if (!rawRows || rawRows.length === 0) {
    throw new Error('The uploaded file contains no data rows.');
  }

  // Detect unique headers across the first 100 rows to ensure full coverage
  const headerSet = new Set<string>();
  const sampleLimit = Math.min(rawRows.length, 100);
  for (let i = 0; i < sampleLimit; i++) {
    const row = rawRows[i];
    if (row && typeof row === 'object') {
      Object.keys(row).forEach((k) => {
        if (k && k.trim()) headerSet.add(k.trim());
      });
    }
  }

  const detectedHeaders = Array.from(headerSet);
  const columnMapping: Record<string, string> = {};
  const unmappedHeaders: string[] = [];

  detectedHeaders.forEach((rawHeader) => {
    const matched = matchColumn(rawHeader);
    if (matched) {
      columnMapping[rawHeader] = matched;
    } else {
      columnMapping[rawHeader] = '';
      unmappedHeaders.push(rawHeader);
    }
  });

  return {
    sheetNames,
    selectedSheet,
    rawRows,
    detectedHeaders,
    columnMapping,
    unmappedHeaders,
    rowCount: rawRows.length,
  };
}

/**
 * Applies a verified column mapping to convert raw rows into standard CustomerRecord objects
 */
export function applyColumnMapping(
  rawRows: Record<string, any>[],
  columnMapping: Record<string, string>
): CustomerRecord[] {
  return rawRows.map((raw) => {
    const record: any = {};
    for (const [rawKey, val] of Object.entries(raw)) {
      const canonicalKey = columnMapping[rawKey];
      if (canonicalKey) {
        record[canonicalKey] = val;
      } else {
        // Keep extra columns unmapped for user inspectability
        record[rawKey] = val;
      }
    }
    return record as CustomerRecord;
  });
}
