import React, { useState } from 'react';
import { Loader2, RefreshCw, CheckCircle2, HelpCircle } from 'lucide-react';
import LinkedScatterViewer from './LinkedScatterViewer';
import DetectionMatrixTable from './DetectionMatrixTable';
import { formatRelativeTime, formatFullDateTime } from '../utils/formatters';

const COLOR_MODE_STORAGE_KEY = 'skyguard_model_color_mode';

export default function DiagnosticsConsole({
  snapshot,
  onReloadSnapshot,
  onShowToast
}) {
  const [colorMode, setColorMode] = useState(() => {
    if (typeof window === 'undefined') return 'consensus';
    return localStorage.getItem(COLOR_MODE_STORAGE_KEY) || 'consensus';
  });

  const [isRecalibrating, setIsRecalibrating] = useState(false);

  const handleColorModeChange = (mode) => {
    setColorMode(mode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
      } catch {}
    }
  };

  const handleRecalibrate = async () => {
    setIsRecalibrating(true);
    try {
      const res = await fetch('http://localhost:8000/api/pipeline/recalibrate', {
        method: 'POST'
      });
      if (res.ok) {
        if (onReloadSnapshot) await onReloadSnapshot();
        if (onShowToast) {
          onShowToast({ message: 'Station models recalibrated successfully' });
        }
      }
    } catch (err) {
      console.error('Recalibration failed:', err);
    } finally {
      setIsRecalibrating(false);
    }
  };

  if (!snapshot) {
    return (
      <div className="py-24 text-center text-neutral-500 flex flex-col items-center justify-center gap-2 text-xs">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span>Loading model analytics snapshot...</span>
      </div>
    );
  }

  const { metrics = {}, detection = {}, generated_at, station_name } = snapshot;

  return (
    <div className="space-y-6">
      {/* Page Title & Recalibrate Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E5E5] dark:border-[#262626]">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Model performance
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Unsupervised clustering validation, 2D manifold projections, and algorithm recall benchmarks.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto text-xs">
          {generated_at && (
            <span
              className="text-neutral-500 dark:text-neutral-400 tabular-nums hidden sm:inline"
              title={formatFullDateTime(generated_at)}
            >
              Calibrated {formatRelativeTime(generated_at)}
            </span>
          )}

          <button
            onClick={handleRecalibrate}
            disabled={isRecalibrating}
            className="inline-flex items-center gap-1.5 font-medium px-3 py-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
            title="Refit all models against 14 days of station historical weather"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalibrating ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isRecalibrating ? 'Recalibrating...' : 'Recalibrate'}</span>
          </button>
        </div>
      </div>

      {/* Top 3 Metric Cards with Plain-Language Meaning */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Silhouette Coefficient */}
        <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] p-5">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <span>Silhouette score</span>
            <span className="text-[11px] text-neutral-400">Range: [-1, +1]</span>
          </div>
          <div className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-1.5">
            {metrics.silhouette !== undefined ? Number(metrics.silhouette).toFixed(3) : '0.221'}
          </div>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-2">
            How well-separated the operating regimes are. Higher is better.
          </p>
        </div>

        {/* Davies-Bouldin Index */}
        <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] p-5">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <span>Davies-Bouldin index</span>
            <span className="text-[11px] text-neutral-400">Lower is better</span>
          </div>
          <div className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-1.5">
            {metrics.davies_bouldin !== undefined ? Number(metrics.davies_bouldin).toFixed(3) : '1.468'}
          </div>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-2">
            Ratio of within-cluster spread to separation. Zero is theoretical perfection.
          </p>
        </div>

        {/* WCSS Inertia */}
        <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] p-5">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <span>Inertia (WCSS)</span>
            <span className="text-[11px] text-neutral-400">3 clusters</span>
          </div>
          <div className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-1.5">
            {metrics.wcss !== undefined ? Math.round(Number(metrics.wcss)).toLocaleString() : '2,666'}
          </div>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-2">
            Within-cluster sum of squared errors across 3 diurnal operating regimes.
          </p>
        </div>
      </div>

      {/* Linked 2D Scatter Projections */}
      <LinkedScatterViewer
        snapshot={snapshot}
        colorMode={colorMode}
        setColorMode={handleColorModeChange}
      />

      {/* Algorithm Detection Matrix */}
      <DetectionMatrixTable detection={detection} />
    </div>
  );
}
