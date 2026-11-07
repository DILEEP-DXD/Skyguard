import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

function formatTimestamp(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

// Custom anomaly dot renderer
const AnomalyDot = (props) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  if (payload && payload.is_anomaly) {
    return <circle cx={cx} cy={cy} r={4.5} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} />;
  }
  return null;
};

// Clean minimal tooltip (no AI text)
const MinimalTooltip = ({ active, payload, unit, sensorKey }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  if (!d) return null;

  const val = typeof d[sensorKey] === 'number' ? d[sensorKey].toFixed(2) : d[sensorKey];
  const delta = typeof d[`delta_${sensorKey === 'temperature' ? 'temp' : sensorKey}`] === 'number'
    ? d[`delta_${sensorKey === 'temperature' ? 'temp' : sensorKey}`].toFixed(3)
    : '0.000';
  const rollStd = typeof d[`roll_std_${sensorKey === 'temperature' ? 'temp' : sensorKey}`] === 'number'
    ? d[`roll_std_${sensorKey === 'temperature' ? 'temp' : sensorKey}`].toFixed(3)
    : '0.000';

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 text-xs font-mono shadow-md text-zinc-900 dark:text-zinc-100 z-50">
      <div className="text-[10px] text-zinc-400 mb-0.5">{formatTimestamp(d.timestamp)}</div>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{val} {unit}</span>
        {d.is_anomaly && (
          <span className="text-[10px] px-1 py-0.2 rounded bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 font-bold">
            {d.fault_type || 'ANOMALY'}
          </span>
        )}
      </div>
      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 flex gap-3">
        <span>Δ: {delta}</span>
        <span>σ: {rollStd}</span>
      </div>
    </div>
  );
};

export default function SensorStrip({
  label,
  sensorKey,
  unit,
  strokeColor = '#0284c7',
  readings = [],
  statusText = 'Nominal',
  isFault = false,
  isWarning = false
}) {
  const latest = readings.length > 0 ? readings[readings.length - 1] : null;
  const currentValue = latest && typeof latest[sensorKey] === 'number' ? latest[sensorKey].toFixed(2) : '--';
  const deltaKey = `delta_${sensorKey === 'temperature' ? 'temp' : sensorKey}`;
  const rollStdKey = `roll_std_${sensorKey === 'temperature' ? 'temp' : sensorKey}`;
  const deltaVal = latest && typeof latest[deltaKey] === 'number' ? (latest[deltaKey] >= 0 ? `+${latest[deltaKey].toFixed(2)}` : latest[deltaKey].toFixed(2)) : '+0.00';
  const rollStdVal = latest && typeof latest[rollStdKey] === 'number' ? latest[rollStdKey].toFixed(3) : '0.000';

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 overflow-hidden flex flex-col md:flex-row shadow-xs">
      {/* Left Readout Column */}
      <div className="w-full md:w-52 p-3.5 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {label}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {currentValue}
            </span>
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              {unit}
            </span>
          </div>
        </div>

        {/* 2-Row Key-Value Metadata + Minimal Status Indicator */}
        <div className="mt-3 pt-2.5 border-t border-zinc-200 dark:border-zinc-800/80 text-[11px] font-mono space-y-1">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span>Δ Rate:</span>
            <span className="text-zinc-700 dark:text-zinc-300 tabular-nums">{deltaVal}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span>σ Var:</span>
            <span className="text-zinc-700 dark:text-zinc-300 tabular-nums">{rollStdVal}</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isFault
                  ? 'bg-red-500'
                  : isWarning
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
            />
            <span
              className={`text-[10px] font-medium tracking-tight ${
                isFault
                  ? 'text-red-600 dark:text-red-400 font-semibold'
                  : isWarning
                  ? 'text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {statusText}
            </span>
          </div>
        </div>
      </div>

      {/* Right Chart Area: explicit height 135px */}
      <div className="flex-1 p-2 bg-white dark:bg-zinc-950/40">
        <div style={{ width: '100%', height: 135 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={readings} margin={{ top: 8, right: 12, bottom: 4, left: -14 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#71717a" strokeOpacity={0.15} vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTimestamp}
                stroke="#71717a"
                tick={{ fontSize: 9, fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v) => Number(v).toFixed(1)}
                width={48}
                stroke="#71717a"
                tick={{ fontSize: 9, fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<MinimalTooltip unit={unit} sensorKey={sensorKey} />}
                cursor={{ stroke: '#71717a', strokeDasharray: '2 2', strokeOpacity: 0.4 }}
              />
              <Line
                type="monotone"
                dataKey={sensorKey}
                stroke={strokeColor}
                strokeWidth={1.5}
                dot={<AnomalyDot />}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

