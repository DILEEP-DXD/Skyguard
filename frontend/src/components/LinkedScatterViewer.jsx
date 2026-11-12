import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import { LayoutGrid, Maximize2, Split } from 'lucide-react';

const COLOR_MODES = [
  { id: 'consensus', label: 'Anomaly consensus' },
  { id: 'kmeans',    label: 'k-Means regimes' },
  { id: 'gmm',       label: 'GMM components' },
  { id: 'dbscan',    label: 'DBSCAN noise' }
];

const VIEW_MODES = [
  { id: 'split', label: 'Split view', icon: Split },
  { id: 'pca',   label: 'PCA (Linear)', icon: LayoutGrid },
  { id: 'tsne',  label: 't-SNE (Manifold)', icon: Maximize2 }
];

export default function LinkedScatterViewer({
  snapshot,
  colorMode,
  setColorMode
}) {
  const [viewMode, setViewMode] = useState('split');

  const {
    pca_coords = [],
    tsne_coords = [],
    if_labels = [],
    lof_labels = [],
    kmeans_labels = [],
    dbscan_labels = [],
    gmm_labels = [],
    kmeans_centroids_pca = []
  } = snapshot || {};

  const getCategory = (index) => {
    const isIF = if_labels[index] === -1;
    const isLOF = lof_labels[index] === -1;
    const km = kmeans_labels[index] ?? 0;
    const db = dbscan_labels[index] ?? 0;
    const gm = gmm_labels[index] ?? 0;

    if (colorMode === 'consensus') {
      return (isIF || isLOF) ? 'Anomaly' : 'Normal';
    } else if (colorMode === 'kmeans') {
      return `Regime ${km}`;
    } else if (colorMode === 'gmm') {
      return `Component ${gm}`;
    } else {
      return db === -1 ? 'Noise' : `Cluster ${db}`;
    }
  };

  const getColor = (cat) => {
    if (cat === 'Anomaly' || cat === 'Noise') return '#EF4444';
    if (cat === 'Normal') return '#10B981';
    if (cat === 'Regime 0' || cat === 'Cluster 0' || cat === 'Component 0') return '#2563EB';
    if (cat === 'Regime 1' || cat === 'Cluster 1' || cat === 'Component 1') return '#D97706';
    if (cat === 'Regime 2' || cat === 'Cluster 2' || cat === 'Component 2') return '#8B5CF6';
    if (cat === 'Regime 3' || cat === 'Cluster 3' || cat === 'Component 3') return '#06B6D4';
    return '#6B7280';
  };

  const pcaPoints = useMemo(() => {
    return pca_coords.map((pt, i) => {
      const cat = getCategory(i);
      return {
        index: i,
        x: Number(Number(pt[0]).toFixed(2)),
        y: Number(Number(pt[1]).toFixed(2)),
        category: cat,
        color: getColor(cat)
      };
    });
  }, [pca_coords, colorMode, if_labels, lof_labels, kmeans_labels, dbscan_labels, gmm_labels]);

  const tsnePoints = useMemo(() => {
    return tsne_coords.map((pt, i) => {
      const cat = getCategory(i);
      return {
        index: i,
        x: Number(Number(pt[0]).toFixed(2)),
        y: Number(Number(pt[1]).toFixed(2)),
        category: cat,
        color: getColor(cat)
      };
    });
  }, [tsne_coords, colorMode, if_labels, lof_labels, kmeans_labels, dbscan_labels, gmm_labels]);

  // Centroid points for PCA overlay
  const centroidsData = useMemo(() => {
    if (!kmeans_centroids_pca || !kmeans_centroids_pca.length) return [];
    return kmeans_centroids_pca.map((c, idx) => ({
      x: Number(Number(c[0]).toFixed(2)),
      y: Number(Number(c[1]).toFixed(2)),
      label: `Centroid ${idx}`,
      isCentroid: true
    }));
  }, [kmeans_centroids_pca]);

  const groupPoints = (points) => {
    const groups = {};
    points.forEach((p) => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  };

  const pcaGroups = useMemo(() => groupPoints(pcaPoints), [pcaPoints]);
  const tsneGroups = useMemo(() => groupPoints(tsnePoints), [tsnePoints]);

  return (
    <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] p-5 space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#F0F0F0] dark:border-[#262626]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              2D Manifold & Projection Visualizations
            </h2>
            <span className="text-[11px] font-mono text-neutral-400">
              ({pca_coords.length || 500} pts)
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Linear PCA feature projections vs. non-linear t-SNE topological manifolds.
          </p>
        </div>

        {/* View Toggle + Color Mode Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Projection View Toggle */}
          <div className="inline-flex rounded-lg border border-[#E5E5E5] dark:border-[#262626] p-0.5 bg-neutral-100/60 dark:bg-neutral-900 text-xs">
            {VIEW_MODES.map((vm) => (
              <button
                key={vm.id}
                onClick={() => setViewMode(vm.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewMode === vm.id
                    ? 'bg-white dark:bg-[#171718] text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                <span>{vm.label}</span>
              </button>
            ))}
          </div>

          {/* Color Mode Segmented Control */}
          <div className="inline-flex rounded-lg border border-[#E5E5E5] dark:border-[#262626] p-0.5 bg-neutral-100/60 dark:bg-neutral-900 text-xs">
            {COLOR_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setColorMode(mode.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  colorMode === mode.id
                    ? 'bg-white dark:bg-[#171718] text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plots Display Grid */}
      <div className={`grid gap-6 ${viewMode === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {/* PCA Plot */}
        {(viewMode === 'split' || viewMode === 'pca') && (
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">PCA (PC1 vs PC2)</span>
                {centroidsData.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    Centroids active
                  </span>
                )}
              </div>
              <span className="text-neutral-400 text-[11px]">Linear variance projection (50.1% var)</span>
            </div>
            <div className={`${viewMode === 'pca' ? 'h-96' : 'h-72'} w-full bg-neutral-50/50 dark:bg-neutral-900/30 rounded-lg p-2 border border-[#F0F0F0] dark:border-[#262626]`}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <XAxis
                    type="number"
                    dataKey="x"
                    stroke="var(--text-muted)"
                    tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    stroke="var(--text-muted)"
                    tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      if (!payload || !payload.length) return null;
                      const pt = payload[0].payload;
                      if (pt.isCentroid) {
                        return (
                          <div className="bg-neutral-900 text-white border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs shadow-md">
                            <span className="font-semibold text-blue-400">{pt.label}</span>
                            <div className="text-[11px] text-neutral-300 tabular-nums">
                              Coord: ({pt.x}, {pt.y})
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-white dark:bg-[#171718] border border-[#E5E5E5] dark:border-[#262626] rounded-md px-2.5 py-1.5 text-xs shadow-md">
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">{pt.category}</span>
                          <div className="text-[11px] text-neutral-500 tabular-nums">
                            PC1: {pt.x}, PC2: {pt.y}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {Object.entries(pcaGroups).map(([cat, points]) => (
                    <Scatter
                      key={cat}
                      name={cat}
                      data={points}
                      fill={getColor(cat)}
                      opacity={cat === 'Anomaly' || cat === 'Noise' ? 0.9 : 0.6}
                    />
                  ))}
                  {/* Overlay Cluster Centroids */}
                  {centroidsData.length > 0 && (
                    <Scatter
                      name="Centroids"
                      data={centroidsData}
                      fill="#000000"
                      shape="cross"
                    />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* t-SNE Plot */}
        {(viewMode === 'split' || viewMode === 'tsne') && (
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">t-SNE (Dim 1 vs Dim 2)</span>
              <span className="text-neutral-400 text-[11px]">Non-linear manifold embedding</span>
            </div>
            <div className={`${viewMode === 'tsne' ? 'h-96' : 'h-72'} w-full bg-neutral-50/50 dark:bg-neutral-900/30 rounded-lg p-2 border border-[#F0F0F0] dark:border-[#262626]`}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <XAxis
                    type="number"
                    dataKey="x"
                    stroke="var(--text-muted)"
                    tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    stroke="var(--text-muted)"
                    tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      if (!payload || !payload.length) return null;
                      const pt = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-[#171718] border border-[#E5E5E5] dark:border-[#262626] rounded-md px-2.5 py-1.5 text-xs shadow-md">
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">{pt.category}</span>
                          <div className="text-[11px] text-neutral-500 tabular-nums">
                            Dim 1: {pt.x}, Dim 2: {pt.y}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {Object.entries(tsneGroups).map(([cat, points]) => (
                    <Scatter
                      key={cat}
                      name={cat}
                      data={points}
                      fill={getColor(cat)}
                      opacity={cat === 'Anomaly' || cat === 'Noise' ? 0.9 : 0.6}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Shared Plot Legend */}
      <div className="flex flex-wrap items-center justify-center gap-5 pt-3 border-t border-[#F0F0F0] dark:border-[#262626] text-xs">
        {colorMode === 'consensus' && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span className="text-neutral-700 dark:text-neutral-300">Normal observation (agreement)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
              <span className="text-neutral-700 dark:text-neutral-300">Flagged anomaly (IF or LOF)</span>
            </div>
          </>
        )}

        {colorMode === 'kmeans' && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
              <span className="text-neutral-700 dark:text-neutral-300">Regime 0 (Night/Cool)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#D97706]" />
              <span className="text-neutral-700 dark:text-neutral-300">Regime 1 (Day/Peak solar)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
              <span className="text-neutral-700 dark:text-neutral-300">Regime 2 (Transition/Diurnal change)</span>
            </div>
            {centroidsData.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-900 dark:text-neutral-100 font-bold">✕</span>
                <span className="text-neutral-700 dark:text-neutral-300">Centroids (k-Means++)</span>
              </div>
            )}
          </>
        )}

        {colorMode === 'gmm' && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
              <span className="text-neutral-700 dark:text-neutral-300">Component 0 (EM Gaussian)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#D97706]" />
              <span className="text-neutral-700 dark:text-neutral-300">Component 1 (EM Gaussian)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
              <span className="text-neutral-700 dark:text-neutral-300">Component 2 (EM Gaussian)</span>
            </div>
          </>
        )}

        {colorMode === 'dbscan' && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
              <span className="text-neutral-700 dark:text-neutral-300">Noise / Spatial outliers (-1)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
              <span className="text-neutral-700 dark:text-neutral-300">Density Cluster 0</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span className="text-neutral-700 dark:text-neutral-300">Density Cluster 1</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
