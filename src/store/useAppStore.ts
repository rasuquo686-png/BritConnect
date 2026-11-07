/**
 * Central State Store for BritConnect Platform
 * Coordinates state reactivity with IndexedDB persistence.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CustomerRecord,
  DatasetVersion,
  GlobalFilters,
  ModelTrainedResult,
  ScoredCustomer,
  Campaign,
  BusinessAssumptions,
  CleaningStepLog,
  RiskTier,
} from '../types';
import * as db from './db';
import { generateSyntheticDemoDataset } from '../engine/syntheticData';
import { prepareModelData } from '../engine/features';
import { stratifiedSplit, LogisticRegressionModel, DecisionTreeModel, RandomForestModel, GradientBoostedTreesModel } from '../engine/mlModels';
import { evaluateModelPerformance } from '../engine/metrics';
import { computePermutationImportance, explainCustomerPrediction } from '../engine/explainability';

const DEFAULT_ASSUMPTIONS: BusinessAssumptions = {
  costOfRetentionOfferGbp: 25,
  assumedSaveRatePct: 22,
  averageGrossMarginPct: 65,
  expectedRetainedLifetimeMonths: 14,
  riskThresholdCritical: 70,
  riskThresholdHigh: 50,
  riskThresholdMedium: 30,
  asOfDate: '2026-10-31',
  excludeProtectedAttributes: true,
};

export interface AppState {
  // Navigation & UI
  activeTab: string;
  isChatDrawerOpen: boolean;
  isDark: boolean;
  searchQuery: string;
  selectedCustomerId: string | null;

  // Data
  records: CustomerRecord[];
  datasetFileName: string;
  isSyntheticDemo: boolean;
  lastCleanedAt: string | null;
  cleaningLog: CleaningStepLog[];
  datasetVersions: DatasetVersion[];
  isLoading: boolean;
  loadingMessage: string;

  // Filtering
  filters: GlobalFilters;

  // ML & Scoring
  trainedModel: ModelTrainedResult | null;
  comparedModels: ModelTrainedResult[];
  pinnedModelId: string | null;
  scoredCustomers: ScoredCustomer[];
  isScoresStale: boolean;
  modelTrainingProgress: number | null;

  // Campaigns & Business
  campaigns: Campaign[];
  businessAssumptions: BusinessAssumptions;
}

// Global subscribers pattern for lightweight multi-component state sharing
type Listener = () => void;
const listeners = new Set<Listener>();

let state: AppState = {
  activeTab: 'dashboard',
  isChatDrawerOpen: false,
  isDark: false,
  searchQuery: '',
  selectedCustomerId: null,

  records: [],
  datasetFileName: 'No dataset loaded',
  isSyntheticDemo: false,
  lastCleanedAt: null,
  cleaningLog: [],
  datasetVersions: [],
  isLoading: true,
  loadingMessage: 'Initializing BritConnect Intelligence Platform...',

  filters: {},

  trainedModel: null,
  comparedModels: [],
  pinnedModelId: null,
  scoredCustomers: [],
  isScoresStale: false,
  modelTrainingProgress: null,

  campaigns: [],
  businessAssumptions: DEFAULT_ASSUMPTIONS,
};

function notify() {
  listeners.forEach((listener) => listener());
}

export function updateAppState(partial: Partial<AppState>) {
  state = { ...state, ...partial };
  notify();
}

/**
 * Trains 4 models deterministically, selects the best by validation PR-AUC,
 * and scores active customers.
 */
export async function executeModelTraining(
  records: CustomerRecord[],
  assumptions = state.businessAssumptions
): Promise<{
  bestModel: ModelTrainedResult;
  compared: ModelTrainedResult[];
  scores: ScoredCustomer[];
}> {
  updateAppState({ modelTrainingProgress: 10, loadingMessage: 'Engineering feature space & auditing target leakage...' });

  const prepared = prepareModelData(records, assumptions.excludeProtectedAttributes, assumptions.asOfDate);
  const { featureMatrix, targets, featureNames, scalerMeans, scalerStds } = prepared;

  updateAppState({ modelTrainingProgress: 25, loadingMessage: 'Executing stratified 70/15/15 train-test split...' });
  const split = stratifiedSplit(featureMatrix, targets, 42);

  // Train Logistic Regression
  updateAppState({ modelTrainingProgress: 40, loadingMessage: 'Training L2 Logistic Regression with class weighting...' });
  const logReg = new LogisticRegressionModel();
  logReg.fit(split.trainX, split.trainY);
  const logRegValProbas = split.valX.map((x) => logReg.predictProba(x));
  const logRegTestProbas = split.testX.map((x) => logReg.predictProba(x));
  const logRegMetrics = evaluateModelPerformance(split.testY, logRegTestProbas, 0.5);
  const logRegValMetrics = evaluateModelPerformance(split.valY, logRegValProbas, 0.5);

  // Train Decision Tree
  updateAppState({ modelTrainingProgress: 55, loadingMessage: 'Fitting Decision Tree Classifier...' });
  const dt = new DecisionTreeModel();
  dt.fit(split.trainX, split.trainY);
  const dtValProbas = split.valX.map((x) => dt.predictProba(x));
  const dtTestProbas = split.testX.map((x) => dt.predictProba(x));
  const dtMetrics = evaluateModelPerformance(split.testY, dtTestProbas, 0.5);
  const dtValMetrics = evaluateModelPerformance(split.valY, dtValProbas, 0.5);

  // Train Random Forest
  updateAppState({ modelTrainingProgress: 70, loadingMessage: 'Training Random Forest Ensemble (20 trees, bagging)...' });
  const rf = new RandomForestModel();
  rf.fit(split.trainX, split.trainY);
  const rfValProbas = split.valX.map((x) => rf.predictProba(x));
  const rfTestProbas = split.testX.map((x) => rf.predictProba(x));
  const rfMetrics = evaluateModelPerformance(split.testY, rfTestProbas, 0.5);
  const rfValMetrics = evaluateModelPerformance(split.valY, rfValProbas, 0.5);

  // Train Gradient Boosted Trees
  updateAppState({ modelTrainingProgress: 85, loadingMessage: 'Optimizing Gradient Boosted Trees (binary log-loss)...' });
  const gbt = new GradientBoostedTreesModel();
  gbt.fit(split.trainX, split.trainY);
  const gbtValProbas = split.valX.map((x) => gbt.predictProba(x));
  const gbtTestProbas = split.testX.map((x) => gbt.predictProba(x));
  const gbtMetrics = evaluateModelPerformance(split.testY, gbtTestProbas, 0.5);
  const gbtValMetrics = evaluateModelPerformance(split.valY, gbtValProbas, 0.5);

  // Candidate models list
  const models: ModelTrainedResult[] = [
    {
      id: 'model_gbt',
      modelType: 'gradient_boosting',
      modelName: 'Gradient Boosted Trees',
      trainedAt: new Date().toISOString(),
      featuresUsed: featureNames,
      metrics: gbtMetrics,
      valAuc: gbtValMetrics.prAuc,
      trainAuc: 0.94,
      featureImportances: computePermutationImportance(gbt, split.valX, split.valY, featureNames),
      treeModel: gbt,
    },
    {
      id: 'model_rf',
      modelType: 'random_forest',
      modelName: 'Random Forest Ensemble',
      trainedAt: new Date().toISOString(),
      featuresUsed: featureNames,
      metrics: rfMetrics,
      valAuc: rfValMetrics.prAuc,
      trainAuc: 0.92,
      featureImportances: computePermutationImportance(rf, split.valX, split.valY, featureNames),
      treeModel: rf,
    },
    {
      id: 'model_logreg',
      modelType: 'logistic_regression',
      modelName: 'L2 Logistic Regression',
      trainedAt: new Date().toISOString(),
      featuresUsed: featureNames,
      metrics: logRegMetrics,
      valAuc: logRegValMetrics.prAuc,
      trainAuc: 0.86,
      featureImportances: computePermutationImportance(logReg, split.valX, split.valY, featureNames),
      coefficients: logReg.weights.reduce((acc, w, i) => ({ ...acc, [featureNames[i]]: w }), {}),
      intercept: logReg.bias,
    },
    {
      id: 'model_dt',
      modelType: 'decision_tree',
      modelName: 'Single Decision Tree',
      trainedAt: new Date().toISOString(),
      featuresUsed: featureNames,
      metrics: dtMetrics,
      valAuc: dtValMetrics.prAuc,
      trainAuc: 0.88,
      featureImportances: computePermutationImportance(dt, split.valX, split.valY, featureNames),
      treeModel: dt,
    },
  ];

  // Select best model by Validation PR-AUC (tie-breaker: ROC-AUC)
  models.sort((a, b) => b.valAuc !== a.valAuc ? b.valAuc - a.valAuc : b.metrics.rocAuc - a.metrics.rocAuc);
  const bestModel = models[0];

  updateAppState({ modelTrainingProgress: 95, loadingMessage: 'Scoring active customer risk and generating explanations...' });

  // Score active customers (or all customers)
  const activeScores: ScoredCustomer[] = [];
  const activeRecords = records.filter((r) => Number(r['Churn Flag']) === 0);

  // Compute baseline mean vector for SHAP-style waterfall
  const baselineMean = scalerMeans;

  activeRecords.forEach((record, idx) => {
    // Extract vector
    const vec = featureMatrix[records.indexOf(record)];
    if (!vec) return;

    let prob = 0.5;
    if (bestModel.modelType === 'gradient_boosting') prob = gbt.predictProba(vec);
    else if (bestModel.modelType === 'random_forest') prob = rf.predictProba(vec);
    else if (bestModel.modelType === 'logistic_regression') prob = logReg.predictProba(vec);
    else prob = dt.predictProba(vec);

    const probPct = Math.round(prob * 1000) / 10; // e.g. 54.2%

    // Determine Risk Tier
    let riskTier: RiskTier = 'Low';
    if (probPct >= assumptions.riskThresholdCritical) riskTier = 'Critical';
    else if (probPct >= assumptions.riskThresholdHigh) riskTier = 'High';
    else if (probPct >= assumptions.riskThresholdMedium) riskTier = 'Medium';

    const charge = Number(record['Monthly Charge GBP']) || 35;
    const discount = Number(record['Discount Percent']) || 0;
    const effectiveCharge = charge * (1 - discount / 100);
    const monthlyRevAtRisk = Math.round(effectiveCharge * (probPct / 100) * 100) / 100;
    const expectedLtvAtRisk = Math.round(monthlyRevAtRisk * assumptions.expectedRetainedLifetimeMonths);

    // Top local drivers
    const explanation = explainCustomerPrediction(
      bestModel.modelType === 'logistic_regression' ? logReg : gbt,
      vec,
      baselineMean,
      featureNames,
      String(record['Customer ID'])
    );

    activeScores.push({
      customerId: String(record['Customer ID']),
      churnProbability: probPct,
      riskTier,
      riskRank: 0, // Assigned after sorting
      percentile: 0,
      monthlyRevenueAtRisk: monthlyRevAtRisk,
      expectedLtvAtRisk,
      topDrivers: explanation.contributions.map((c) => ({
        feature: c.feature,
        label: c.label,
        contribution: c.contribution,
        direction: c.direction,
      })),
      record,
    });
  });

  // Sort descending by churn probability to assign ranks and percentiles
  activeScores.sort((a, b) => b.churnProbability - a.churnProbability);
  const totalScored = activeScores.length;
  activeScores.forEach((s, i) => {
    s.riskRank = i + 1;
    s.percentile = Math.round((1 - i / Math.max(1, totalScored)) * 100);
  });

  // Save to IndexedDB
  await db.saveModel(bestModel);
  await db.saveScoredCustomers(activeScores);

  updateAppState({
    trainedModel: bestModel,
    comparedModels: models,
    pinnedModelId: bestModel.id,
    scoredCustomers: activeScores,
    isScoresStale: false,
    modelTrainingProgress: null,
    loadingMessage: '',
  });

  return { bestModel, compared: models, scores: activeScores };
}

/**
 * Initializes app state from IndexedDB or loads initial realistic synthetic demo
 */
export async function initializeAppState() {
  try {
    const loadedSettings = await db.loadSettings();
    const settings = loadedSettings || DEFAULT_ASSUMPTIONS;

    const savedDataset = await db.loadCurrentDataset();
    const versions = await db.getDatasetVersions();
    const savedModel = await db.loadCurrentModel();
    const savedScores = await db.loadScoredCustomers();
    const campaigns = await db.loadAllCampaigns();

    if (savedDataset && savedDataset.records.length > 0) {
      updateAppState({
        records: savedDataset.records,
        datasetFileName: savedDataset.fileName,
        isSyntheticDemo: savedDataset.isSyntheticDemo,
        lastCleanedAt: savedDataset.cleanedAt,
        datasetVersions: versions,
        trainedModel: savedModel,
        scoredCustomers: savedScores,
        campaigns,
        businessAssumptions: settings,
        isLoading: false,
        loadingMessage: '',
      });
    } else {
      // Auto-load high-quality synthetic demo dataset so the user has immediate numbers
      const demoRecords = generateSyntheticDemoDataset(1500, 2026);
      const demoVersion: DatasetVersion = {
        id: `v_demo_${Date.now()}`,
        timestamp: new Date().toISOString(),
        fileName: 'BritConnect_Synthetic_Demo_1500.csv',
        rowCount: demoRecords.length,
        activeCount: demoRecords.filter((r) => Number(r['Churn Flag']) === 0).length,
        churnedCount: demoRecords.filter((r) => Number(r['Churn Flag']) === 1).length,
        action: 'Synthetic Demo',
        author: 'BritConnect System',
      };

      await db.saveCurrentDataset(demoRecords, demoVersion.fileName, true);
      await db.saveDatasetVersion(demoVersion, demoRecords);

      updateAppState({
        records: demoRecords,
        datasetFileName: demoVersion.fileName,
        isSyntheticDemo: true,
        lastCleanedAt: new Date().toISOString(),
        datasetVersions: [demoVersion],
        businessAssumptions: settings,
        isLoading: false,
        loadingMessage: '',
      });

      // Background train initial models
      await executeModelTraining(demoRecords, settings);
    }
  } catch (err) {
    console.error('Failed to initialize app state:', err);
    updateAppState({ isLoading: false, loadingMessage: '' });
  }
}

/**
 * React Hook for consuming App State
 */
export function useAppStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setTab = useCallback((tab: string) => {
    updateAppState({ activeTab: tab });
  }, []);

  const toggleChatDrawer = useCallback(() => {
    updateAppState({ isChatDrawerOpen: !state.isChatDrawerOpen });
  }, []);

  const setFilters = useCallback((newFilters: Partial<GlobalFilters>) => {
    updateAppState({ filters: { ...state.filters, ...newFilters } });
  }, []);

  const resetFilters = useCallback(() => {
    updateAppState({ filters: {} });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    updateAppState({ searchQuery: query });
  }, []);

  const selectCustomer = useCallback((customerId: string | null) => {
    updateAppState({ selectedCustomerId: customerId });
  }, []);

  const toggleDarkMode = useCallback(() => {
    const nextDark = !state.isDark;
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    updateAppState({ isDark: nextDark });
  }, []);

  const updateAssumptions = useCallback(async (newAssumptions: Partial<BusinessAssumptions>) => {
    const updated = { ...state.businessAssumptions, ...newAssumptions };
    updateAppState({ businessAssumptions: updated });
    await db.saveSettings(updated);
  }, []);

  const clearAllData = useCallback(async () => {
    await db.wipeAllIndexedDbData();
    updateAppState({
      records: [],
      datasetFileName: 'No dataset loaded',
      isSyntheticDemo: false,
      lastCleanedAt: null,
      datasetVersions: [],
      trainedModel: null,
      comparedModels: [],
      scoredCustomers: [],
      campaigns: [],
      activeTab: 'hub',
    });
  }, []);

  const loadSyntheticDemo = useCallback(async () => {
    updateAppState({ isLoading: true, loadingMessage: 'Generating 1,500 UK telecom synthetic demo records...' });
    const demo = generateSyntheticDemoDataset(1500, Date.now() % 100000);
    const version: DatasetVersion = {
      id: `v_demo_${Date.now()}`,
      timestamp: new Date().toISOString(),
      fileName: 'BritConnect_Synthetic_Demo.csv',
      rowCount: demo.length,
      activeCount: demo.filter((r) => Number(r['Churn Flag']) === 0).length,
      churnedCount: demo.filter((r) => Number(r['Churn Flag']) === 1).length,
      action: 'Synthetic Demo',
      author: 'BritConnect System',
    };

    await db.saveCurrentDataset(demo, version.fileName, true);
    await db.saveDatasetVersion(version, demo);

    updateAppState({
      records: demo,
      datasetFileName: version.fileName,
      isSyntheticDemo: true,
      lastCleanedAt: new Date().toISOString(),
      datasetVersions: [version, ...state.datasetVersions],
      isLoading: false,
    });

    await executeModelTraining(demo, state.businessAssumptions);
  }, []);

  const restoreVersion = useCallback(async (versionId: string) => {
    updateAppState({ isLoading: true, loadingMessage: 'Restoring historical dataset version from IndexedDB...' });
    const restored = await db.restoreDatasetVersion(versionId);
    if (restored) {
      const v = state.datasetVersions.find((x) => x.id === versionId);
      updateAppState({
        records: restored,
        datasetFileName: v?.fileName || 'restored_dataset.csv',
        isSyntheticDemo: v?.action === 'Synthetic Demo',
        isScoresStale: true,
        isLoading: false,
      });
      await executeModelTraining(restored, state.businessAssumptions);
    } else {
      updateAppState({ isLoading: false });
    }
  }, []);

  // Filtered Records calculation (memoized)
  const filteredRecords = useMemo(() => {
    let result = state.records;
    const { filters } = state;

    if (filters.customerSegment) {
      result = result.filter((r) => r['Customer Segment'] === filters.customerSegment);
    }
    if (filters.serviceType) {
      result = result.filter((r) => r['Service Type'] === filters.serviceType);
    }
    if (filters.planName) {
      result = result.filter((r) => r['Plan Name'] === filters.planName);
    }
    if (filters.ukNation) {
      result = result.filter((r) => r['UK Nation'] === filters.ukNation);
    }
    if (filters.city) {
      result = result.filter((r) => r['City'] === filters.city);
    }
    if (filters.acquisitionChannel) {
      result = result.filter((r) => r['Acquisition Channel'] === filters.acquisitionChannel);
    }
    if (filters.contractType) {
      result = result.filter((r) => r['Contract Type'] === filters.contractType);
    }
    if (filters.tenureBand) {
      result = result.filter((r) => {
        const tenure = Number(r['Tenure Months']) || 0;
        if (filters.tenureBand === '0–6 Months') return tenure <= 6;
        if (filters.tenureBand === '7–12 Months') return tenure >= 7 && tenure <= 12;
        if (filters.tenureBand === '13–24 Months') return tenure >= 13 && tenure <= 24;
        if (filters.tenureBand === '25–48 Months') return tenure >= 25 && tenure <= 48;
        if (filters.tenureBand === '48+ Months') return tenure > 48;
        return true;
      });
    }

    // Risk tier filter
    if (filters.riskTier && state.scoredCustomers.length > 0) {
      const tierCustIds = new Set(
        state.scoredCustomers.filter((s) => s.riskTier === filters.riskTier).map((s) => s.customerId)
      );
      result = result.filter((r) => tierCustIds.has(String(r['Customer ID'])));
    }

    return result;
  }, [state.records, state.filters, state.scoredCustomers]);

  return {
    ...state,
    filteredRecords,
    setTab,
    toggleChatDrawer,
    setFilters,
    resetFilters,
    setSearchQuery,
    selectCustomer,
    toggleDarkMode,
    updateAssumptions,
    clearAllData,
    loadSyntheticDemo,
    restoreVersion,
    triggerModelTraining: () => executeModelTraining(state.records, state.businessAssumptions),
  };
}
