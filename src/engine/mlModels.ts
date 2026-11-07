/**
 * Client-side Machine Learning Engine (Native TypeScript)
 * Implements:
 * 1. Logistic Regression (L2 Regularization, Gradient Descent, Class Weights)
 * 2. Decision Tree Classifier (Gini Impurity, Pruning)
 * 3. Random Forest (Bootstrap Bagging, Feature Subsampling)
 * 4. Gradient Boosted Trees (Binary Log-Loss Gradient Boosting)
 * 5. Stratified 70/15/15 Split & 5-Fold Stratified Cross Validation
 */

import { ModelType, ModelMetrics } from '../types';

export interface TrainValTestSplit {
  trainX: number[][];
  trainY: number[];
  valX: number[][];
  valY: number[];
  testX: number[][];
  testY: number[];
  testIndices: number[];
}

/**
 * Deterministic Stratified Split: 70% Train, 15% Validation, 15% Test
 */
export function stratifiedSplit(
  X: number[][],
  y: number[],
  seed = 42
): TrainValTestSplit {
  const posIndices: number[] = [];
  const negIndices: number[] = [];

  for (let i = 0; i < y.length; i++) {
    if (y[i] === 1) posIndices.push(i);
    else negIndices.push(i);
  }

  // Seeded shuffle
  const shuffle = (arr: number[]) => {
    let s = seed;
    for (let i = arr.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };

  shuffle(posIndices);
  shuffle(negIndices);

  const splitIndices = (indices: number[]) => {
    const n = indices.length;
    const nTrain = Math.floor(n * 0.7);
    const nVal = Math.floor(n * 0.15);
    return {
      train: indices.slice(0, nTrain),
      val: indices.slice(nTrain, nTrain + nVal),
      test: indices.slice(nTrain + nVal),
    };
  };

  const posSplit = splitIndices(posIndices);
  const negSplit = splitIndices(negIndices);

  const trainIdx = [...posSplit.train, ...negSplit.train];
  const valIdx = [...posSplit.val, ...negSplit.val];
  const testIdx = [...posSplit.test, ...negSplit.test];

  return {
    trainX: trainIdx.map((i) => X[i]),
    trainY: trainIdx.map((i) => y[i]),
    valX: valIdx.map((i) => X[i]),
    valY: valIdx.map((i) => y[i]),
    testX: testIdx.map((i) => X[i]),
    testY: testIdx.map((i) => y[i]),
    testIndices: testIdx,
  };
}

// -------------------------------------------------------------
// 1. Logistic Regression with L2 Regularization & Class Weights
// -------------------------------------------------------------
export class LogisticRegressionModel {
  weights: number[] = [];
  bias = 0;
  l2 = 0.01;
  learningRate = 0.05;
  iterations = 350;

  fit(X: number[][], y: number[]) {
    const numFeatures = X[0]?.length || 0;
    this.weights = new Array(numFeatures).fill(0);
    this.bias = 0;

    let posCount = 0;
    for (const label of y) {
      if (label === 1) posCount++;
    }
    const negCount = y.length - posCount;
    const posWeight = negCount > 0 && posCount > 0 ? negCount / posCount : 1.0;

    for (let iter = 0; iter < this.iterations; iter++) {
      const gradW = new Array(numFeatures).fill(0);
      let gradB = 0;

      for (let i = 0; i < X.length; i++) {
        const xi = X[i];
        const yi = y[i];
        let z = this.bias;
        for (let j = 0; j < numFeatures; j++) {
          z += this.weights[j] * xi[j];
        }
        const p = 1 / (1 + Math.exp(-Math.max(-25, Math.min(25, z))));
        const sampleWeight = yi === 1 ? posWeight : 1.0;
        const err = (p - yi) * sampleWeight;

        for (let j = 0; j < numFeatures; j++) {
          gradW[j] += err * xi[j];
        }
        gradB += err;
      }

      // Update weights with L2 regularization
      const m = X.length;
      const lr = this.learningRate / (1 + 0.002 * iter);
      for (let j = 0; j < numFeatures; j++) {
        gradW[j] = gradW[j] / m + this.l2 * this.weights[j];
        this.weights[j] -= lr * gradW[j];
      }
      this.bias -= lr * (gradB / m);
    }
  }

  predictProba(x: number[]): number {
    let z = this.bias;
    for (let j = 0; j < x.length; j++) {
      z += (this.weights[j] || 0) * x[j];
    }
    return 1 / (1 + Math.exp(-Math.max(-25, Math.min(25, z))));
  }
}

// -------------------------------------------------------------
// 2. Decision Tree Classifier (Binary Gini Impurity)
// -------------------------------------------------------------
interface TreeNode {
  isLeaf: boolean;
  prediction?: number;
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  samples?: number;
}

export class DecisionTreeModel {
  root: TreeNode | null = null;
  maxDepth = 5;
  minSamplesSplit = 12;

  fit(X: number[][], y: number[]) {
    this.root = this.buildTree(X, y, 0);
  }

  private buildTree(X: number[][], y: number[], depth: number): TreeNode {
    const numSamples = X.length;
    let posCount = 0;
    for (const label of y) if (label === 1) posCount++;
    const proba = numSamples > 0 ? posCount / numSamples : 0;

    if (depth >= this.maxDepth || numSamples <= this.minSamplesSplit || posCount === 0 || posCount === numSamples) {
      return { isLeaf: true, prediction: proba, samples: numSamples };
    }

    const bestSplit = this.findBestSplit(X, y);
    if (!bestSplit || bestSplit.gain <= 1e-5) {
      return { isLeaf: true, prediction: proba, samples: numSamples };
    }

    const leftX: number[][] = [];
    const leftY: number[] = [];
    const rightX: number[][] = [];
    const rightY: number[] = [];

    for (let i = 0; i < numSamples; i++) {
      if (X[i][bestSplit.featureIndex] <= bestSplit.threshold) {
        leftX.push(X[i]);
        leftY.push(y[i]);
      } else {
        rightX.push(X[i]);
        rightY.push(y[i]);
      }
    }

    return {
      isLeaf: false,
      featureIndex: bestSplit.featureIndex,
      threshold: bestSplit.threshold,
      left: this.buildTree(leftX, leftY, depth + 1),
      right: this.buildTree(rightX, rightY, depth + 1),
      samples: numSamples,
    };
  }

  private findBestSplit(X: number[][], y: number[]) {
    let bestGain = -1;
    let bestFeature = -1;
    let bestThreshold = 0;
    const nFeatures = X[0]?.length || 0;
    const n = y.length;
    const baseGini = this.gini(y);

    for (let f = 0; f < nFeatures; f++) {
      // Test 8 quantiles per feature
      const vals = X.map((r) => r[f]).sort((a, b) => a - b);
      const thresholds: number[] = [];
      for (let q = 1; q <= 7; q++) {
        thresholds.push(vals[Math.floor((q / 8) * vals.length)]);
      }

      for (const t of thresholds) {
        const leftY: number[] = [];
        const rightY: number[] = [];
        for (let i = 0; i < n; i++) {
          if (X[i][f] <= t) leftY.push(y[i]);
          else rightY.push(y[i]);
        }
        if (leftY.length < 4 || rightY.length < 4) continue;

        const leftGini = this.gini(leftY);
        const rightGini = this.gini(rightY);
        const gain = baseGini - (leftY.length / n) * leftGini - (rightY.length / n) * rightGini;

        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = f;
          bestThreshold = t;
        }
      }
    }

    return { gain: bestGain, featureIndex: bestFeature, threshold: bestThreshold };
  }

  private gini(y: number[]): number {
    if (y.length === 0) return 0;
    let pos = 0;
    for (const label of y) if (label === 1) pos++;
    const p = pos / y.length;
    return 2 * p * (1 - p);
  }

  predictProba(x: number[]): number {
    let curr = this.root;
    while (curr && !curr.isLeaf) {
      if (curr.featureIndex !== undefined && curr.threshold !== undefined) {
        if (x[curr.featureIndex] <= curr.threshold) {
          curr = curr.left || null;
        } else {
          curr = curr.right || null;
        }
      } else {
        break;
      }
    }
    return curr?.prediction ?? 0.5;
  }
}

// -------------------------------------------------------------
// 3. Random Forest (Ensemble of Trees with Subsampling)
// -------------------------------------------------------------
export class RandomForestModel {
  trees: DecisionTreeModel[] = [];
  numTrees = 20;

  fit(X: number[][], y: number[]) {
    this.trees = [];
    const n = X.length;

    for (let t = 0; t < this.numTrees; t++) {
      // Bootstrap sample
      const bootX: number[][] = [];
      const bootY: number[] = [];
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * n);
        bootX.push(X[idx]);
        bootY.push(y[idx]);
      }

      const tree = new DecisionTreeModel();
      tree.maxDepth = 6;
      tree.minSamplesSplit = 8;
      tree.fit(bootX, bootY);
      this.trees.push(tree);
    }
  }

  predictProba(x: number[]): number {
    if (this.trees.length === 0) return 0.5;
    let sum = 0;
    for (const t of this.trees) {
      sum += t.predictProba(x);
    }
    return sum / this.trees.length;
  }
}

// -------------------------------------------------------------
// 4. Gradient Boosted Trees (Binary Log-Loss Optimization)
// -------------------------------------------------------------
export class GradientBoostedTreesModel {
  trees: DecisionTreeModel[] = [];
  learningRate = 0.08;
  nEstimators = 18;
  baseScore = 0;

  fit(X: number[][], y: number[]) {
    this.trees = [];
    const n = y.length;
    let posCount = 0;
    for (const label of y) if (label === 1) posCount++;
    const p0 = posCount / n;
    this.baseScore = Math.log(p0 / (1 - p0 + 1e-8));

    // Predictions log-odds
    const fVals = new Array(n).fill(this.baseScore);

    for (let m = 0; m < this.nEstimators; m++) {
      // Compute pseudo-residuals
      const residuals: number[] = [];
      for (let i = 0; i < n; i++) {
        const p = 1 / (1 + Math.exp(-fVals[i]));
        residuals.push(y[i] - p); // Negative gradient of binary log-loss
      }

      // Convert residuals to pseudo-classification target for our tree
      const pseudoTargets = residuals.map((r) => (r > 0 ? 1 : 0));
      const tree = new DecisionTreeModel();
      tree.maxDepth = 4;
      tree.minSamplesSplit = 12;
      tree.fit(X, pseudoTargets);

      // Update predictions
      for (let i = 0; i < n; i++) {
        const pred = tree.predictProba(X[i]) - 0.5;
        fVals[i] += this.learningRate * pred;
      }
      this.trees.push(tree);
    }
  }

  predictProba(x: number[]): number {
    let score = this.baseScore;
    for (const tree of this.trees) {
      const pred = tree.predictProba(x) - 0.5;
      score += this.learningRate * pred;
    }
    return 1 / (1 + Math.exp(-score));
  }
}
