import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { HelpCircle } from 'lucide-react';
import { formatTimestamp, formatDelta, formatStd } from '../utils/formatters';

// Anomaly marker: clean red dot without glow
const AnomalyDot = (props) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  if (payload && payload.is_anomaly) {
    return (
      <circle cx={cx} cy={cy} r={4} fill="#EF4444" stroke="#FFFFFF" strokeWidth={1.5} />
    );
  }
  return null;
};

// Clean minimal tooltip
const TelemetryTooltip = ({ active, payload, unit, sensorKey, labelName }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  if (!d) return null;

  const val = typeof d[sensorKey] === 'number' ? d[sensorKey].toFixed(2) : d[sensorKey];
  const deltaKey = `delta_${sensorKey === 'temperature' ? 'temp' : sensorKey}`;
  const rollStdKey = `roll_std_${sensorKey === 'temperature' ? 'temp' : sensorKey}`;
  const delta = formatDelta(d[deltaKey]);
  const rollStd = formatStd(d[rollStdKey]);

  return (
    <div className="bg-white dark:bg-[#171718] border border-[#E5E5E5] dark:border-[#262626] rounded-md px-3 py-2 text-xs shadow-md text-neutral-900 dark:text-neutral-100 z-50 pointer-events-none">
      <div className="flex items-center justify-between gap-4 pb-1 mb-1 border-b border-[#F0F0F0] dark:border-[#262626] text-[11px] text-neutral-500">
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{labelName}</span>
        <span className="tabular-nums">{formatTimestamp(d.timestamp)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold tabular-nums">
          {val} <span className="text-xs font-normal text-neutral-500">{unit}</span>
        </span>
        {d.is_anomaly && (
          <span className="text-[11px] font-medium text-red-600 dark:text-red-400">
            {d.fault_type || 'Anomaly'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[11px] text-neutral-500 pt-1 mt-1 border-t border-[#F0F0F0] dark:border-[#262626]">
        <span>Change: <strong className="font-medium text-neutral-700 dark:text-neutral-300 tabular-nums">{delta}</strong></span>
        <span>Variability: <strong className="font-medium text-neutral-700 dark:text-neutral-300 tabular-nums">{rollStd}</strong></span>
      </div>
    </div>
  );
};

export default function SyncedSensorStrip({
  label,
  sensorKey,
  unit,
  accentColor = '#2563EB',
  readings = [],
  statusText = 'Normal',
  isFault = false,
  isWarning = false
}) {
  const latest = readings.length > 0 ? readings[readings.length - 1] : null;
  const currentValue = latest && typeof latest[sensorKey] === 'number' ? latest[sensorKey].toFixed(2) : '--';
  const deltaKey = `delta_${sensorKey === 'temperature' ? 'temp' : sensorKey}`;
  const rollStdKey = `roll_std_${sensorKey === 'temperature' ? 'temp' : sensorKey}`;
  const deltaVal = formatDelta(latest ? latest[deltaKey] : null);
  const rollStdVal = formatStd(latest ? latest[rollStdKey] : null);

  // Compute adaptive Y-axis domain with minimum sensible span to avoid over-dramatic noise
  const { yDomain, yTickFormatter } = useMemo(() => {
    if (!readings.length) return { yDomain: ['auto', 'auto'], yTickFormatter: (v) => v };
    const vals = readings.map((r) => r[sensorKey]).filter((v) => typeof v === 'number');
    if (!vals.length) return { yDomain: ['auto', 'auto'], yTickFormatter: (v) => v };

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const rawRange = max - min;

    // Minimum sensible span per sensor to keep small ADC noise calm
    const minSpan = sensorKey === 'temperature' ? 3.0 : sensorKey === 'pressure' ? 8.0 : 12.0;
    const effectiveSpan = Math.max(rawRange, minSpan);
    const mid = (min + max) / 2;

    const domainMin = Number((mid - effectiveSpan / 2).toFixed(1));
    const domainMax = Number((mid + effectiveSpan / 2).toFixed(1));

    return {
      yDomain: [domainMin, domainMax],
      yTickFormatter: (v) => Number(v).toFixed(1)
    };
  }, [readings, sensorKey]);

  return (
    <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] p-5 flex flex-col md:flex-row gap-5 items-stretch">
      {/* Left Sensor Metric Panel */}
      <div className="w-full md:w-64 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {label}
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isFault
                    ? 'bg-red-500'
                    : isWarning
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
              />
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                {statusText}
              </span>
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {currentValue}
            </span>
            <span className="text-xs text-neutral-500">
              {unit}
            </span>
          </div>
        </div>

        {/* Change per reading & Variability */}
        <div className="mt-4 pt-3 border-t border-[#F0F0F0] dark:border-[#262626] text-xs space-y-2">
          <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
            <div className="flex items-center gap-1">
              <span>Change per reading</span>
              <span title="Difference between current reading and previous reading (x_t - x_{t-1})">
                <HelpCircle className="w-3 h-3 text-neutral-400 hover:text-neutral-600 cursor-help" />
              </span>
            </div>
            <span className="tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
              {deltaVal}
            </span>
          </div>

          <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
            <div className="flex items-center gap-1">
              <span>Variability</span>
              <span title="Rolling sample standard deviation over a 10-observation window (drops to 0 when sensor freezes)">
                <HelpCircle className="w-3 h-3 text-neutral-400 hover:text-neutral-600 cursor-help" />
              </span>
            </div>
            <span className="tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
              {rollStdVal}
            </span>
          </div>
        </div>
      </div>

      {/* Right Synchronized Area Chart */}
      <div className="flex-1 w-full min-h-[140px]">
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart
            data={readings}
            syncId="skyguard-sensors"
            margin={{ top: 8, right: 12, bottom: 4, left: 10 }}
          >
            <CartesianGrid
              strokeDasharray="2 2"
              stroke="var(--border-color)"
              strokeOpacity={0.6}
              vertical={false}
            />

            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTimestamp}
              stroke="var(--text-muted)"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={50}
            />

            <YAxis
              domain={yDomain}
              tickFormatter={yTickFormatter}
              width={56}
              stroke="var(--text-muted)"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              content={<TelemetryTooltip unit={unit} sensorKey={sensorKey} labelName={label} />}
            />

            <Area
              type="monotone"
              dataKey={sensorKey}
              stroke={accentColor}
              strokeWidth={1.5}
              fill={accentColor}
              fillOpacity={0.05}
              dot={<AnomalyDot />}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
