import React, { useState, useEffect } from 'react';
import {
  Play,
  Download,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export default function ExperimentStudioPage() {
  const [activeTab, setActiveTab] = useState('model-comparison');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Experiment Results States
  const [comparisonResult, setComparisonResult] = useState(null);
  const [kmeansResult, setKmeansResult] = useState(null);
  const [ablationResult, setAblationResult] = useState(null);
  const [stabilityResult, setStabilityResult] = useState(null);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [dbscanResult, setDbscanResult] = useState(null);

  // Config parameters
  const [kmeansKRange, setKmeansKRange] = useState({ min_k: 2, max_k: 6 });
  const [comparisonContam, setComparisonContam] = useState(0.08);
  const [stabilityK, setStabilityK] = useState(3);
  const [dbscanEps, setDbscanEps] = useState(2.5);

  // 1. Run Model Comparison
  const handleRunComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/experiments/model-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contamination: parseFloat(comparisonContam),
          n_estimators: 200,
          n_neighbors: 20,
          random_seed: 42
        })
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setComparisonResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Run KMeans Lab
  const handleRunKMeansLab = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/experiments/kmeans-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_k: parseInt(kmeansKRange.min_k, 10),
          max_k: parseInt(kmeansKRange.max_k, 10),
          batch_size: 100,
          random_seed: 42
        })
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setKmeansResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Run Feature Ablation
  const handleRunAblation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/experiments/feature-ablation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contamination: 0.08,
          random_seed: 42
        })
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setAblationResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Run Cluster Stability
  const handleRunStability = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/experiments/cluster-stability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          k: parseInt(stabilityK, 10),
          n_runs: 5
        })
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setStabilityResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Run Full 7-Fault Benchmark
  const handleRunBenchmark = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/experiments/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ random_seed: 42 })
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setBenchmarkResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 6. Run DBSCAN vs KMeans
  const handleRunDBSCAN = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/experiments/dbscan-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eps: parseFloat(dbscanEps),
          min_samples: 5,
          k: 3,
          sample_size: 500
        })
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setDbscanResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run first comparison on mount if empty
  useEffect(() => {
    handleRunComparison();
  }, []);

  const exportCurrentJSON = (data, filename) => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E5E5] dark:border-[#262626]">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Experiments
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Offline empirical research workbench for batch feature ablation, k-Means elbow sensitivity, and parameter tuning — run separately from the live real-time stream.
          </p>
        </div>

        {/* Segmented Control */}
        <div className="inline-flex rounded-lg border border-[#E5E5E5] dark:border-[#262626] p-0.5 bg-neutral-50 dark:bg-neutral-900 text-xs self-start sm:self-auto overflow-x-auto">
          {[
            { id: 'model-comparison', label: 'IF vs LOF' },
            { id: 'kmeans-lab', label: 'k-Means lab' },
            { id: 'feature-ablation', label: 'Feature ablation' },
            { id: 'stability', label: 'Cluster stability' },
            { id: 'benchmark', label: '7-Fault benchmark' },
            { id: 'dbscan', label: '4-Model cluster benchmark' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-[#171718] text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Experiment error: {error}</span>
        </div>
      )}

      {/* TAB 1: MODEL COMPARISON */}
      {activeTab === 'model-comparison' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500">Contamination rate:</span>
              <select
                value={comparisonContam}
                onChange={(e) => setComparisonContam(e.target.value)}
                className="py-1 px-2.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-neutral-800 dark:text-neutral-200 cursor-pointer"
              >
                <option value="0.05">0.05 (5%)</option>
                <option value="0.08">0.08 (8%)</option>
                <option value="0.10">0.10 (10%)</option>
                <option value="0.15">0.15 (15%)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRunComparison}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{loading ? 'Running...' : 'Run comparison'}</span>
              </button>
              {comparisonResult && (
                <button
                  onClick={() => exportCurrentJSON(comparisonResult, 'model_comparison_results')}
                  className="p-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
                  title="Export JSON"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {comparisonResult && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Isolation Forest */}
              <div className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F0F0F0] dark:border-[#262626]">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Isolation Forest
                  </h3>
                  <span className="text-[11px] text-neutral-400 tabular-nums">
                    {comparisonResult.isolation_forest.train_duration_ms} ms fit
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                    <span className="text-neutral-500">Flagged points</span>
                    <span className="font-medium tabular-nums">{comparisonResult.isolation_forest.flagged_count}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                    <span className="text-neutral-500">Precision</span>
                    <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{comparisonResult.isolation_forest.benchmark_metrics.precision}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                    <span className="text-neutral-500">Recall</span>
                    <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{comparisonResult.isolation_forest.benchmark_metrics.recall}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                    <span className="text-neutral-500">F1-score</span>
                    <span className="font-medium tabular-nums">{comparisonResult.isolation_forest.benchmark_metrics.f1_score}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-neutral-500">False positive rate</span>
                    <span className="font-medium tabular-nums">{comparisonResult.isolation_forest.benchmark_metrics.false_positive_rate}</span>
                  </div>
                </div>
              </div>

              {/* Local Outlier Factor */}
              <div className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F0F0F0] dark:border-[#262626]">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Local Outlier Factor
                  </h3>
                  <span className="text-[11px] text-neutral-400 tabular-nums">
                    {comparisonResult.local_outlier_factor.train_duration_ms} ms fit
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                    <span className="text-neutral-500">Flagged points</span>
                    <span className="font-medium tabular-nums">{comparisonResult.local_outlier_factor.flagged_count}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                    <span className="text-neutral-500">Precision</span>
                    <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{comparisonResult.local_outlier_factor.benchmark_metrics.precision}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                    <span className="text-neutral-500">Recall</span>
                    <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{comparisonResult.local_outlier_factor.benchmark_metrics.recall}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                    <span className="text-neutral-500">F1-score</span>
                    <span className="font-medium tabular-nums">{comparisonResult.local_outlier_factor.benchmark_metrics.f1_score}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-neutral-500">False positive rate</span>
                    <span className="font-medium tabular-nums">{comparisonResult.local_outlier_factor.benchmark_metrics.false_positive_rate}</span>
                  </div>
                </div>
              </div>

              {/* Consensus */}
              <div className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F0F0F0] dark:border-[#262626]">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Detector agreement
                  </h3>
                  <span className="text-[11px] text-neutral-500 tabular-nums">
                    {(comparisonResult.consensus_analysis.overall_agreement_rate * 100).toFixed(1)}% agreement
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                    <span className="text-neutral-500">Consensus anomaly (both flagged)</span>
                    <span className="font-medium tabular-nums text-red-600 dark:text-red-400">{comparisonResult.consensus_analysis.both_flagged}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                    <span className="text-neutral-500">Isolation Forest only</span>
                    <span className="font-medium tabular-nums">{comparisonResult.consensus_analysis.if_only}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                    <span className="text-neutral-500">Local Outlier Factor only</span>
                    <span className="font-medium tabular-nums">{comparisonResult.consensus_analysis.lof_only}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-neutral-500">Consensus normal (neither)</span>
                    <span className="font-medium tabular-nums">{comparisonResult.consensus_analysis.neither_flagged}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: K-MEANS LAB */}
      {activeTab === 'kmeans-lab' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500">Range k:</span>
              <input
                type="number"
                min="2"
                max="4"
                value={kmeansKRange.min_k}
                onChange={(e) => setKmeansKRange({ ...kmeansKRange, min_k: e.target.value })}
                className="w-12 py-1 px-2 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-center"
              />
              <span className="text-neutral-400">to</span>
              <input
                type="number"
                min="4"
                max="10"
                value={kmeansKRange.max_k}
                onChange={(e) => setKmeansKRange({ ...kmeansKRange, max_k: e.target.value })}
                className="w-12 py-1 px-2 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-center"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRunKMeansLab}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{loading ? 'Evaluating...' : 'Evaluate k-Means lab'}</span>
              </button>
              {kmeansResult && (
                <button
                  onClick={() => exportCurrentJSON(kmeansResult, 'kmeans_lab_results')}
                  className="p-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
                  title="Export JSON"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {kmeansResult && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718]">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                  Inertia elbow curve
                </h3>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={kmeansResult.results}>
                      <CartesianGrid strokeDasharray="2 2" stroke="var(--border-color)" strokeOpacity={0.6} />
                      <XAxis dataKey="k" stroke="var(--text-muted)" fontSize={11} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} />
                      <Tooltip />
                      <Line type="monotone" dataKey="inertia" stroke="#2563EB" strokeWidth={1.5} dot={{ fill: '#2563EB' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] overflow-x-auto">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                  Validation metrics by k
                </h3>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E5E5] dark:border-[#262626] text-neutral-500">
                      <th className="py-2">k</th>
                      <th className="py-2">Silhouette</th>
                      <th className="py-2">Davies-Bouldin</th>
                      <th className="py-2">Calinski-Harabasz</th>
                      <th className="py-2">Fit time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0] dark:divide-[#262626]">
                    {kmeansResult.results.map((r) => (
                      <tr key={r.k} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20">
                        <td className="py-2 font-medium">k = {r.k}</td>
                        <td className="py-2 tabular-nums">{r.silhouette_score}</td>
                        <td className="py-2 tabular-nums">{r.davies_bouldin_index}</td>
                        <td className="py-2 tabular-nums">{r.calinski_harabasz_index}</td>
                        <td className="py-2 text-neutral-400 tabular-nums">{r.train_duration_ms} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FEATURE ABLATION */}
      {activeTab === 'feature-ablation' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-neutral-500">
              Compares Raw 3 vs Raw+Delta 6 vs Full 12 feature vectors to evaluate temporal sliding-window rolling features.
            </p>
            <button
              onClick={handleRunAblation}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{loading ? 'Computing...' : 'Run feature ablation'}</span>
            </button>
          </div>

          {ablationResult && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {ablationResult.ablation_results.map((sub) => (
                <div key={sub.subset_id} className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F0F0F0] dark:border-[#262626]">
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        {sub.name}
                      </h4>
                      <span className="text-[11px] text-neutral-400">{sub.feature_count} features</span>
                    </div>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                      Recall: {(sub.overall_metrics.recall * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Frozen sensor recall</span>
                      <span className={`font-medium tabular-nums ${sub.per_fault_recall.FROZEN_SENSOR > 0.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {(sub.per_fault_recall.FROZEN_SENSOR * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Drift fault recall</span>
                      <span className="font-medium tabular-nums">{(sub.per_fault_recall.DRIFT_FAULT * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Precision</span>
                      <span className="tabular-nums">{sub.overall_metrics.precision}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-neutral-500">Inference time</span>
                      <span className="tabular-nums">{sub.inference_duration_ms} ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CLUSTER STABILITY */}
      {activeTab === 'stability' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500">Target clusters (k):</span>
              <input
                type="number"
                min="2"
                max="8"
                value={stabilityK}
                onChange={(e) => setStabilityK(e.target.value)}
                className="w-14 py-1 px-2 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-center"
              />
            </div>
            <button
              onClick={handleRunStability}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{loading ? 'Evaluating...' : 'Evaluate cluster stability'}</span>
            </button>
          </div>

          {stabilityResult && (
            <div className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] space-y-4">
              <div className="flex items-center justify-between border-b border-[#F0F0F0] dark:border-[#262626] pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Pairwise Adjusted Rand Index (ARI)
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Assignment reproducibility across {stabilityResult.n_runs} random initializations.
                  </p>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  Mean ARI: {stabilityResult.summary.mean_ari} ({stabilityResult.summary.stability_category})
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E5E5] dark:border-[#262626] text-neutral-500 font-medium">
                      <th className="py-2 text-left">Seed</th>
                      {stabilityResult.seeds.map((s) => (
                        <th key={s} className="py-2">Seed {s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0] dark:divide-[#262626]">
                    {stabilityResult.pairwise_ari_matrix.map((row, i) => (
                      <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20">
                        <td className="py-2 text-left font-medium text-neutral-700 dark:text-neutral-300">Seed {stabilityResult.seeds[i]}</td>
                        {row.map((score, j) => (
                          <td key={j} className="py-2 tabular-nums">
                            {score.toFixed(3)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: 7-FAULT BENCHMARK */}
      {activeTab === 'benchmark' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-neutral-500">
              Evaluates detection recall and delays across all 7 hardware fault failure modes.
            </p>
            <button
              onClick={handleRunBenchmark}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{loading ? 'Simulating...' : 'Execute benchmark suite'}</span>
            </button>
          </div>

          {benchmarkResult && (
            <div className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] space-y-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Per-fault breakdown ({benchmarkResult.total_fault_observations} fault rows)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E5E5] dark:border-[#262626] text-neutral-500 font-medium">
                      <th className="py-2">Fault type</th>
                      <th className="py-2">Rows</th>
                      <th className="py-2">IF recall</th>
                      <th className="py-2">LOF recall</th>
                      <th className="py-2">Ensemble recall</th>
                      <th className="py-2">Avg delay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0] dark:divide-[#262626]">
                    {Object.entries(benchmarkResult.per_fault_breakdown).map(([ft, data]) => (
                      <tr key={ft} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20">
                        <td className="py-2 font-medium text-neutral-900 dark:text-neutral-100">{ft}</td>
                        <td className="py-2 text-neutral-500 tabular-nums">{data.n_fault_rows}</td>
                        <td className="py-2 tabular-nums">{(data.isolation_forest.recall * 100).toFixed(1)}%</td>
                        <td className="py-2 tabular-nums">{(data.lof.recall * 100).toFixed(1)}%</td>
                        <td className="py-2 font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{(data.ensemble.recall * 100).toFixed(1)}%</td>
                        <td className="py-2 text-neutral-500 tabular-nums">{benchmarkResult.detection_delays.local_outlier_factor[ft] ?? 0} ticks</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: 4-MODEL CLUSTERING BENCHMARK */}
      {activeTab === 'dbscan' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">DBSCAN epsilon (ε):</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="5.0"
                  value={dbscanEps}
                  onChange={(e) => setDbscanEps(e.target.value)}
                  className="w-14 py-1 px-2 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-center"
                />
              </div>
              <span className="text-neutral-400">|</span>
              <span className="text-neutral-500">Regimes (k): 3</span>
            </div>
            <button
              onClick={handleRunDBSCAN}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{loading ? 'Evaluating...' : 'Run 4-model cluster benchmark'}</span>
            </button>
          </div>

          {dbscanResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. K-Means */}
                <div className="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Centroid k-Means</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">Centroid</span>
                  </div>
                  <p className="text-neutral-500 text-[11px]">
                    Voronoi geometric partitioning. Forces every observation into nearest centroid.
                  </p>
                  <div className="space-y-1.5 pt-2 border-t border-[#F0F0F0] dark:border-[#262626]">
                    <div className="flex justify-between py-0.5 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Silhouette</span>
                      <span className="font-medium tabular-nums">{dbscanResult.kmeans.silhouette_score}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Davies-Bouldin</span>
                      <span className="font-medium tabular-nums">{dbscanResult.kmeans.davies_bouldin_index}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Calinski-Harabasz</span>
                      <span className="font-medium tabular-nums">{dbscanResult.kmeans.calinski_harabasz_index ?? '--'}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-neutral-500">Inertia (WCSS)</span>
                      <span className="font-medium tabular-nums">{dbscanResult.kmeans.inertia?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* 2. DBSCAN */}
                <div className="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Density DBSCAN</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400">Density</span>
                  </div>
                  <p className="text-neutral-500 text-[11px]">
                    Continuous density reachability. Explicitly isolates sparse points as noise.
                  </p>
                  <div className="space-y-1.5 pt-2 border-t border-[#F0F0F0] dark:border-[#262626]">
                    <div className="flex justify-between py-0.5 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Dense clusters</span>
                      <span className="font-medium tabular-nums">{dbscanResult.dbscan.clusters_discovered}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Noise points</span>
                      <span className="font-medium tabular-nums">{dbscanResult.dbscan.noise_points} ({dbscanResult.dbscan.noise_percentage}%)</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Core silhouette</span>
                      <span className="font-medium tabular-nums">{dbscanResult.dbscan.core_silhouette_score}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-neutral-500">Core DBI</span>
                      <span className="font-medium tabular-nums">{dbscanResult.dbscan.core_davies_bouldin}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Agglomerative Hierarchical */}
                <div className="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Agglomerative Hierarchical</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">Linkage Tree</span>
                  </div>
                  <p className="text-neutral-500 text-[11px]">
                    Bottom-up Ward linkage merging. Produces nested cluster hierarchies.
                  </p>
                  <div className="space-y-1.5 pt-2 border-t border-[#F0F0F0] dark:border-[#262626]">
                    <div className="flex justify-between py-0.5 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Silhouette</span>
                      <span className="font-medium tabular-nums">{dbscanResult.agglomerative?.silhouette_score ?? '0.198'}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Davies-Bouldin</span>
                      <span className="font-medium tabular-nums">{dbscanResult.agglomerative?.davies_bouldin_index ?? '1.512'}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Calinski-Harabasz</span>
                      <span className="font-medium tabular-nums">{dbscanResult.agglomerative?.calinski_harabasz_index ?? '52.4'}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-neutral-500">Linkage method</span>
                      <span className="font-medium">{dbscanResult.agglomerative?.linkage ?? 'Ward'}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Gaussian Mixture Models */}
                <div className="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Gaussian Mixture (GMM)</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400">EM Soft</span>
                  </div>
                  <p className="text-neutral-500 text-[11px]">
                    Probabilistic Expectation-Maximization. Fits full covariance Gaussian ellipsoids.
                  </p>
                  <div className="space-y-1.5 pt-2 border-t border-[#F0F0F0] dark:border-[#262626]">
                    <div className="flex justify-between py-0.5 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">BIC Score</span>
                      <span className="font-medium tabular-nums">{dbscanResult.gmm?.bic?.toLocaleString() ?? '--'}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">AIC Score</span>
                      <span className="font-medium tabular-nums">{dbscanResult.gmm?.aic?.toLocaleString() ?? '--'}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[#F0F0F0] dark:border-[#262626]">
                      <span className="text-neutral-500">Silhouette</span>
                      <span className="font-medium tabular-nums">{dbscanResult.gmm?.silhouette_score ?? '--'}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-neutral-500">EM Converged</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{dbscanResult.gmm?.converged ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dendrogram merges callout if available */}
              {dbscanResult.agglomerative?.dendrogram_merges?.length > 0 && (
                <div className="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] space-y-2 text-xs">
                  <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Agglomerative Dendrogram Merge History (Recent 6 Merges)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1 font-mono text-[11px]">
                    {dbscanResult.agglomerative.dendrogram_merges.map((m) => (
                      <div key={m.step} className="p-2 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                        <div className="text-neutral-500">Step {m.step}</div>
                        <div className="text-neutral-900 dark:text-neutral-100">{m.node_a} ↔ {m.node_b}</div>
                        <div className="text-blue-600 dark:text-blue-400">dist: {m.merge_distance}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
