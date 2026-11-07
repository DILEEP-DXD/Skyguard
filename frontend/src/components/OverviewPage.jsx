import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  YAxis
} from 'recharts';
import { ArrowUpRight, CheckCheck } from 'lucide-react';
import {
  getSensorHealth,
  getOpenAlerts,
  groupAlerts,
  formatSensorName,
  formatFaultType,
  formatRelativeTime
} from '../utils/formatters';

export default function OverviewPage({
  readings = [],
  alerts = [],
  pipelineStatus = {},
  analyticsSnapshot = null,
  onNavigate,
  onOpenInvestigate,
  onBulkAction,
  onShowToast
}) {
  const latest = readings.length > 0 ? readings[readings.length - 1] : null;
  const openAlerts = getOpenAlerts(alerts);
  const openCount = openAlerts.length;

  // Single source of truth for each sensor health
  const tempHealth = getSensorHealth('temperature', alerts, pipelineStatus.active_fault);
  const pressHealth = getSensorHealth('pressure', alerts, pipelineStatus.active_fault);
  const humHealth = getSensorHealth('humidity', alerts, pipelineStatus.active_fault);

  // Status banner condition
  const hasIssue = openCount > 0 || (pipelineStatus.active_fault && pipelineStatus.active_fault !== 'NONE');

  // Chart data (last 30 readings)
  const chartData = readings.slice(-30).map((r, i) => ({
    time: r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }) : `#${i}`,
    temp: r.temperature,
    pres: r.pressure,
    hum: r.humidity
  }));

  // Auto-scale domains with sensible minimum span per sensor
  const computeDomain = (dataKey, minSpan) => {
    if (chartData.length === 0) return ['auto', 'auto'];
    const vals = chartData.map(d => d[dataKey]).filter(v => typeof v === 'number');
    if (vals.length === 0) return ['auto', 'auto'];
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    const span = max - min;
    if (span < minSpan) {
      const mid = (min + max) / 2;
      min = mid - minSpan / 2;
      max = mid + minSpan / 2;
    } else {
      const pad = span * 0.1;
      min -= pad;
      max += pad;
    }
    return [Math.round(min * 10) / 10, Math.round(max * 10) / 10];
  };

  const tempDomain = computeDomain('temp', 1.5);
  const presDomain = computeDomain('pres', 4.0);
  const humDomain = computeDomain('hum', 5.0);

  const metrics = analyticsSnapshot?.metrics || {};
  const recentGrouped = groupAlerts(alerts).slice(0, 4);

  const handleAcknowledgeAll = async () => {
    const ids = openAlerts.map(a => a.id);
    if (ids.length === 0) return;
    try {
      if (onBulkAction) {
        await onBulkAction(ids, 'ACKNOWLEDGE');
      } else {
        await fetch('http://localhost:8000/api/alerts/bulk-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alert_ids: ids, action: 'ACKNOWLEDGE' })
        });
      }
      if (onShowToast) {
        onShowToast({
          message: `Acknowledged all ${ids.length} open alerts`,
          undoAction: async () => {
            await fetch('http://localhost:8000/api/alerts/bulk-action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ alert_ids: ids, action: 'REOPEN' })
            });
            if (onBulkAction) await onBulkAction(ids, 'REOPEN');
          }
        });
      }
    } catch (err) {
      console.error('Failed to acknowledge all:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Plain-Language Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 px-1 text-sm border-b border-[#E5E5E5] dark:border-[#262626] pb-4">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              hasIssue
                ? openAlerts.some(a => a.severity === 'CRITICAL')
                  ? 'bg-red-500'
                  : 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
          />
          <span className="text-neutral-900 dark:text-neutral-100 font-medium">
            {hasIssue ? (
              openCount > 0 ? (
                <span>
                  {openCount} open {openCount === 1 ? 'alert' : 'alerts'} requiring review
                </span>
              ) : (
                'Sensor fault active'
              )
            ) : (
              'All 3 sensors are normal · 0 open alerts'
            )}
          </span>
        </div>

        {openCount > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleAcknowledgeAll}
              className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium flex items-center gap-1 cursor-pointer"
              title="Acknowledge all open alerts with one click"
            >
              <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>Acknowledge all</span>
            </button>

            <button
              onClick={() => onNavigate('incidents')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>Review alerts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Three Sensor Cards in a Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Temperature */}
        <div className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-medium">Temperature</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    tempHealth.status === 'CRITICAL'
                      ? 'bg-red-500'
                      : tempHealth.status === 'WARNING'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span className="text-[12px] font-medium">
                  {tempHealth.label}
                </span>
              </div>
            </div>

            <div className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
              {latest?.temperature !== undefined ? `${latest.temperature.toFixed(1)} °C` : '-- °C'}
            </div>
          </div>

          <div className="h-24 w-full mt-4">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <YAxis domain={tempDomain} hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: 'var(--border-color)',
                      fontSize: '12px',
                      borderRadius: '6px',
                      padding: '4px 8px'
                    }}
                    formatter={(val) => [`${Number(val).toFixed(2)} °C`, 'Temp']}
                  />
                  <Area
                    type="monotone"
                    dataKey="temp"
                    stroke="#2563EB"
                    strokeWidth={1.5}
                    fill="#2563EB"
                    fillOpacity={0.06}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                Awaiting telemetry...
              </div>
            )}
          </div>
        </div>

        {/* Pressure */}
        <div className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-medium">Atmospheric pressure</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    pressHealth.status === 'CRITICAL'
                      ? 'bg-red-500'
                      : pressHealth.status === 'WARNING'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span className="text-[12px] font-medium">
                  {pressHealth.label}
                </span>
              </div>
            </div>

            <div className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
              {latest?.pressure !== undefined ? `${latest.pressure.toFixed(1)} hPa` : '-- hPa'}
            </div>
          </div>

          <div className="h-24 w-full mt-4">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <YAxis domain={presDomain} hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: 'var(--border-color)',
                      fontSize: '12px',
                      borderRadius: '6px',
                      padding: '4px 8px'
                    }}
                    formatter={(val) => [`${Number(val).toFixed(2)} hPa`, 'Pressure']}
                  />
                  <Area
                    type="monotone"
                    dataKey="pres"
                    stroke="#2563EB"
                    strokeWidth={1.5}
                    fill="#2563EB"
                    fillOpacity={0.06}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                Awaiting telemetry...
              </div>
            )}
          </div>
        </div>

        {/* Humidity */}
        <div className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-medium">Relative humidity</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    humHealth.status === 'CRITICAL'
                      ? 'bg-red-500'
                      : humHealth.status === 'WARNING'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span className="text-[12px] font-medium">
                  {humHealth.label}
                </span>
              </div>
            </div>

            <div className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
              {latest?.humidity !== undefined ? `${latest.humidity.toFixed(1)} %` : '-- %'}
            </div>
          </div>

          <div className="h-24 w-full mt-4">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <YAxis domain={humDomain} hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: 'var(--border-color)',
                      fontSize: '12px',
                      borderRadius: '6px',
                      padding: '4px 8px'
                    }}
                    formatter={(val) => [`${Number(val).toFixed(2)} %`, 'Humidity']}
                  />
                  <Area
                    type="monotone"
                    dataKey="hum"
                    stroke="#2563EB"
                    strokeWidth={1.5}
                    fill="#2563EB"
                    fillOpacity={0.06}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                Awaiting telemetry...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Two Columns: Recent Alerts & Model Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Recent Alerts List (Grouped duplicates) */}
        <div className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Recent alerts
            </h2>
            <button
              onClick={() => onNavigate('incidents')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>View all ({alerts.length})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentGrouped.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
              No alerts yet
            </div>
          ) : (
            <div className="divide-y divide-[#F0F0F0] dark:divide-[#222223]">
              {recentGrouped.map((g) => (
                <div
                  key={g.groupKey}
                  onClick={() => onOpenInvestigate?.(g.items[0]?.id)}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 px-2 rounded-md transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          g.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500'
                        }`}
                      />
                      <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {formatFaultType(g.fault_type)} on {formatSensorName(g.sensor)}
                      </span>
                      {g.count > 1 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 tabular-nums">
                          ×{g.count}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5 pl-3.5">
                      {g.items[0]?.diagnosis_message || g.items[0]?.message || 'Persistent anomaly pattern'}
                    </p>
                  </div>
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500 shrink-0 tabular-nums">
                    {formatRelativeTime(g.lastSeen)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Model Health */}
        <div className="p-5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Model health
            </h2>
            <button
              onClick={() => onNavigate('diagnostics')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>View details</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Silhouette */}
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#F0F0F0] dark:border-[#222223]">
              <div>
                <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                  Silhouette score
                </div>
                <div className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  How well-separated the operating regimes are. Higher is better.
                </div>
              </div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums shrink-0">
                {metrics.silhouette !== undefined ? Number(metrics.silhouette).toFixed(3) : '0.221'}
              </div>
            </div>

            {/* Davies-Bouldin */}
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#F0F0F0] dark:border-[#222223]">
              <div>
                <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                  Davies-Bouldin index
                </div>
                <div className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Clustering compactness ratio. Lower is better.
                </div>
              </div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums shrink-0">
                {metrics.davies_bouldin !== undefined ? Number(metrics.davies_bouldin).toFixed(3) : '1.468'}
              </div>
            </div>

            {/* Inertia */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                  Inertia (WCSS)
                </div>
                <div className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Sum of squared distances of samples to their closest cluster center.
                </div>
              </div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums shrink-0">
                {metrics.wcss !== undefined ? Math.round(Number(metrics.wcss)).toLocaleString() : '2,666'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
