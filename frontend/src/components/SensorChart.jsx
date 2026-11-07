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

// Custom pulsing anomaly dot renderer
const CustomAnomalyDot = (props) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;

  if (payload && payload.is_anomaly) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={8} fill="#f43f5e" fillOpacity={0.3} className="animate-ping" />
        <circle cx={cx} cy={cy} r={6} fill="#f43f5e" stroke="#ffffff" strokeWidth={1.5} />
      </g>
    );
  }

  // Normal subtle dot
  return <circle cx={cx} cy={cy} r={2} fill="#64748b" fillOpacity={0.5} />;
};

// Custom rich telemetry tooltip
const CustomChartTooltip = ({ active, payload, label, unit, sensorKey }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  if (!data) return null;

  const isAnomaly = Boolean(data.is_anomaly);
  const faultType = data.fault_type || 'NONE';
  const val = typeof data[sensorKey] === 'number' ? data[sensorKey].toFixed(3) : data[sensorKey];
  const delta = typeof data[`delta_${sensorKey === 'temperature' ? 'temp' : sensorKey}`] === 'number'
    ? data[`delta_${sensorKey === 'temperature' ? 'temp' : sensorKey}`].toFixed(3)
    : '0.000';
  const rollStd = typeof data[`roll_std_${sensorKey === 'temperature' ? 'temp' : sensorKey}`] === 'number'
    ? data[`roll_std_${sensorKey === 'temperature' ? 'temp' : sensorKey}`].toFixed(3)
    : '0.000';
  const ifScore = typeof data.iforest_score === 'number' ? data.iforest_score.toFixed(4) : data.if_score ?? '-';
  const lofScore = typeof data.lof_score === 'number' ? data.lof_score.toFixed(4) : '-';

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-lg p-3 text-xs font-mono shadow-2xl backdrop-blur max-w-xs z-50">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2 gap-2">
        <span className="text-slate-400 font-semibold">{formatTimestamp(data.timestamp)}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          isAnomaly 
            ? 'bg-rose-950/80 text-rose-400 border border-rose-500/50' 
            : 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/50'
        }`}>
          {isAnomaly ? `ANOMALY: ${faultType}` : 'NOMINAL'}
        </span>
      </div>

      <div className="space-y-1 text-slate-300">
        <div className="flex justify-between">
          <span className="text-slate-400">Raw Sensor:</span>
          <span className="font-bold text-slate-100">{val} {unit}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Rate of Change (Δ):</span>
          <span className="text-cyan-300">{delta} {unit}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Rolling Std (σ):</span>
          <span className="text-indigo-300">σ = {rollStd}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-slate-800/80">
          <span className="text-slate-400">Isolation Forest:</span>
          <span className={data.if_label === -1 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
            {data.if_label === -1 ? 'ANOMALY' : 'NORMAL'} ({ifScore})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">LOF (Novelty):</span>
          <span className={data.lof_label === -1 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
            {data.lof_label === -1 ? 'ANOMALY' : 'NORMAL'} ({lofScore})
          </span>
        </div>
      </div>
    </div>
  );
};

export default function SensorChart({
  title,
  sensorKey,
  unit,
  strokeColor = "#38bdf8",
  data = [],
  yDomain = ['auto', 'auto'],
  height = 260
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col shadow-lg">
      {/* Chart Title Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: strokeColor }} />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            {title} ({unit})
          </h4>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Window: Last 60 Telemetry Readings
        </span>
      </div>

      {/* CRITICAL GUARDRAIL: Explicit pixel height wrapper around ResponsiveContainer */}
      <div style={{ width: '100%', height: height }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTimestamp}
              stroke="#64748b"
              tick={{ fontSize: 10, fill: '#64748b' }}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis
              domain={yDomain}
              stroke="#64748b"
              tick={{ fontSize: 10, fill: '#64748b' }}
              width={42}
            />
            <Tooltip
              content={
                <CustomChartTooltip
                  unit={unit}
                  sensorKey={sensorKey}
                />
              }
            />
            <Line
              type="monotone"
              dataKey={sensorKey}
              stroke={strokeColor}
              strokeWidth={1.8}
              dot={<CustomAnomalyDot />}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
