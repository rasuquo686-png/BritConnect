/**
 * IndexedDB Persistence Layer using `idb`
 * Manages datasets, version backups, models, scores, campaigns, and chat history.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { CustomerRecord, DatasetVersion, ModelTrainedResult, ScoredCustomer, Campaign, BusinessAssumptions } from '../types';

interface BritConnectDB extends DBSchema {
  datasets: {
    key: string;
    value: {
      id: string;
      records: CustomerRecord[];
      cleanedAt: string;
      fileName: string;
      isSyntheticDemo: boolean;
      version: string;
    };
  };
  dataset_versions: {
    key: string;
    value: {
      version: DatasetVersion;
      recordsBackup: CustomerRecord[];
    };
  };
  models: {
    key: string;
    value: ModelTrainedResult;
  };
  scores: {
    key: string;
    value: ScoredCustomer[];
  };
  campaigns: {
    key: string;
    value: Campaign;
  };
  chat_messages: {
    key: string;
    value: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
      toolCalls?: any[];
    };
  };
  settings: {
    key: string;
    value: BusinessAssumptions;
  };
}

const DB_NAME = 'britconnect_churn_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BritConnectDB>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<BritConnectDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BritConnectDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('datasets')) {
          db.createObjectStore('datasets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('dataset_versions')) {
          db.createObjectStore('dataset_versions', { keyPath: 'version.id' });
        }
        if (!db.objectStoreNames.contains('models')) {
          db.createObjectStore('models', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('scores')) {
          db.createObjectStore('scores');
        }
        if (!db.objectStoreNames.contains('campaigns')) {
          db.createObjectStore('campaigns', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chat_messages')) {
          db.createObjectStore('chat_messages', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

// Dataset Operations
export async function saveCurrentDataset(
  records: CustomerRecord[],
  fileName = 'dataset.csv',
  isSyntheticDemo = false
): Promise<void> {
  const db = await getDatabase();
  await db.put('datasets', {
    id: 'current',
    records,
    cleanedAt: new Date().toISOString(),
    fileName,
    isSyntheticDemo,
    version: `v${Date.now()}`,
  });
}

export async function loadCurrentDataset(): Promise<{
  records: CustomerRecord[];
  fileName: string;
  isSyntheticDemo: boolean;
  cleanedAt: string;
} | null> {
  const db = await getDatabase();
  const res = await db.get('datasets', 'current');
  if (!res) return null;
  return {
    records: res.records,
    fileName: res.fileName,
    isSyntheticDemo: res.isSyntheticDemo,
    cleanedAt: res.cleanedAt,
  };
}

export async function saveDatasetVersion(
  version: DatasetVersion,
  recordsBackup: CustomerRecord[]
): Promise<void> {
  const db = await getDatabase();
  await db.put('dataset_versions', {
    version,
    recordsBackup,
  });
}

export async function getDatasetVersions(): Promise<DatasetVersion[]> {
  const db = await getDatabase();
  const all = await db.getAll('dataset_versions');
  return all.map((entry) => entry.version).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function restoreDatasetVersion(versionId: string): Promise<CustomerRecord[] | null> {
  const db = await getDatabase();
  const entry = await db.get('dataset_versions', versionId);
  if (!entry) return null;

  await saveCurrentDataset(entry.recordsBackup, entry.version.fileName, entry.version.action === 'Synthetic Demo');
  return entry.recordsBackup;
}

// Model Operations
export async function saveModel(model: ModelTrainedResult): Promise<void> {
  const db = await getDatabase();
  await db.put('models', model);
}

export async function loadCurrentModel(): Promise<ModelTrainedResult | null> {
  const db = await getDatabase();
  const all = await db.getAll('models');
  if (all.length === 0) return null;
  return all.sort((a, b) => new Date(b.trainedAt).getTime() - new Date(a.trainedAt).getTime())[0];
}

// Scored Customer Records
export async function saveScoredCustomers(scores: ScoredCustomer[]): Promise<void> {
  const db = await getDatabase();
  await db.put('scores', scores, 'current_scores');
}

export async function loadScoredCustomers(): Promise<ScoredCustomer[]> {
  const db = await getDatabase();
  const scores = await db.get('scores', 'current_scores');
  return scores || [];
}

// Campaigns Operations
export async function saveCampaign(campaign: Campaign): Promise<void> {
  const db = await getDatabase();
  await db.put('campaigns', campaign);
}

export async function loadAllCampaigns(): Promise<Campaign[]> {
  const db = await getDatabase();
  return db.getAll('campaigns');
}

// Chat Messages Operations
export async function saveChatMessage(msg: {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: any[];
}): Promise<void> {
  const db = await getDatabase();
  await db.put('chat_messages', msg);
}

export async function loadChatHistory(): Promise<Array<{
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: any[];
}>> {
  const db = await getDatabase();
  const msgs = await db.getAll('chat_messages');
  return msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function clearChatHistory(): Promise<void> {
  const db = await getDatabase();
  await db.clear('chat_messages');
}

// Settings Operations
export async function saveSettings(settings: BusinessAssumptions): Promise<void> {
  const db = await getDatabase();
  await db.put('settings', settings, 'current_settings');
}

export async function loadSettings(): Promise<BusinessAssumptions | null> {
  const db = await getDatabase();
  const res = await db.get('settings', 'current_settings');
  return res || null;
}

// Complete Database Reset
export async function wipeAllIndexedDbData(): Promise<void> {
  const db = await getDatabase();
  await db.clear('datasets');
  await db.clear('dataset_versions');
  await db.clear('models');
  await db.clear('scores');
  await db.clear('campaigns');
  await db.clear('chat_messages');
  await db.clear('settings');
}
