import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

const COLOR_MODES = [
  { id: 'consensus', label: 'Anomaly consensus' },
  { id: 'kmeans',    label: 'k-Means regimes' },
  { id: 'dbscan',    label: 'DBSCAN noise' }
];

export default function LinkedScatterViewer({
  snapshot,
  colorMode,
  setColorMode
}) {
  const {
    pca_coords = [],
    tsne_coords = [],
    if_labels = [],
    lof_labels = [],
    kmeans_labels = [],
    dbscan_labels = []
  } = snapshot || {};

  const getCategory = (index) => {
    const isIF = if_labels[index] === -1;
    const isLOF = lof_labels[index] === -1;
    const km = kmeans_labels[index] ?? 0;
    const db = dbscan_labels[index] ?? 0;

    if (colorMode === 'consensus') {
      return (isIF || isLOF) ? 'Anomaly' : 'Normal';
    } else if (colorMode === 'kmeans') {
      return `Regime ${km}`;
    } else {
      return db === -1 ? 'Noise' : `Cluster ${db}`;
    }
  };

  const getColor = (cat) => {
    if (cat === 'Anomaly' || cat === 'Noise') return '#EF4444';
    if (cat === 'Normal') return '#10B981';
    if (cat === 'Regime 0' || cat === 'Cluster 0') return '#2563EB';
    if (cat === 'Regime 1' || cat === 'Cluster 1') return '#D97706';
    if (cat === 'Regime 2' || cat === 'Cluster 2') return '#8B5CF6';
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
  }, [pca_coords, colorMode, if_labels, lof_labels, kmeans_labels, dbscan_labels]);

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
  }, [tsne_coords, colorMode, if_labels, lof_labels, kmeans_labels, dbscan_labels]);

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
      {/* Header and Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0F0F0] dark:border-[#262626]">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            2D Manifold projections
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Low-dimensional representations of the 12-dimensional sliding-window feature space.
          </p>
        </div>

        {/* Clean Segmented Control */}
        <div className="inline-flex rounded-lg border border-[#E5E5E5] dark:border-[#262626] p-0.5 bg-neutral-100/60 dark:bg-neutral-900 text-xs self-start sm:self-auto">
          {COLOR_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setColorMode(mode.id)}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
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

      {/* Two Plots Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PCA Plot */}
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">PCA (PC1 vs PC2)</span>
            <span className="text-neutral-400 text-[11px]">Linear variance projection</span>
          </div>
          <div className="h-64 w-full bg-neutral-50/50 dark:bg-neutral-900/30 rounded-lg p-2 border border-[#F0F0F0] dark:border-[#262626]">
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
                        <span className="font-medium">{pt.category}</span>
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
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* t-SNE Plot */}
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">t-SNE (Dim 1 vs Dim 2)</span>
            <span className="text-neutral-400 text-[11px]">Nonlinear manifold embedding</span>
          </div>
          <div className="h-64 w-full bg-neutral-50/50 dark:bg-neutral-900/30 rounded-lg p-2 border border-[#F0F0F0] dark:border-[#262626]">
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
                        <span className="font-medium">{pt.category}</span>
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
              <span className="text-neutral-700 dark:text-neutral-300">Flagged anomaly (Isolation Forest or LOF)</span>
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
          </>
        )}

        {colorMode === 'dbscan' && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
              <span className="text-neutral-700 dark:text-neutral-300">Noise / Outliers (-1)</span>
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
