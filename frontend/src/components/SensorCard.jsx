import React from 'react';
import { Thermometer, Gauge, Droplets, ArrowUpRight, ArrowDownRight, Minus, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SensorCard({
  sensorKey,
  label,
  unit,
  currentValue,
  delta,
  rollStd,
  faultType = "NONE",
  isAnomaly = false
}) {
  // Determine dynamic badge & style
  let badgeText = "HEALTHY";
  let badgeColor = "border-emerald-500/40 text-emerald-400 bg-emerald-950/40";
  let iconColor = "text-emerald-400";
  let cardBorder = "border-slate-800 hover:border-slate-700";

  // Check sensor-specific fault indicators
  const isTargetSensor = 
    (faultType === 'SPIKE_FAULT' && sensorKey === 'temperature') ||
    (faultType === 'FROZEN_SENSOR' && (sensorKey === 'humidity' || rollStd < 0.02)) ||
    (faultType === 'DRIFT_FAULT' && sensorKey === 'pressure') ||
    (faultType === 'CROSS_SENSOR_MISMATCH' && (sensorKey === 'pressure' || sensorKey === 'humidity'));

  if (isAnomaly || faultType !== 'NONE') {
    if (faultType === 'SPIKE_FAULT' || (isTargetSensor && faultType === 'SPIKE_FAULT')) {
      badgeText = "SPIKE DETECTED";
      badgeColor = "border-rose-500/50 text-rose-400 bg-rose-950/50 animate-pulse";
      iconColor = "text-rose-400";
      cardBorder = "border-rose-500/40 shadow-lg shadow-rose-950/20";
    } else if (faultType === 'FROZEN_SENSOR' || (rollStd < 0.01 && faultType !== 'NONE')) {
      badgeText = "SENSOR FROZEN";
      badgeColor = "border-sky-500/50 text-sky-400 bg-sky-950/50";
      iconColor = "text-sky-400";
      cardBorder = "border-sky-500/40 shadow-lg shadow-sky-950/20";
    } else if (faultType === 'DRIFT_FAULT' || (isTargetSensor && faultType === 'DRIFT_FAULT')) {
      badgeText = "CALIBRATION DRIFT";
      badgeColor = "border-amber-500/50 text-amber-400 bg-amber-950/50";
      iconColor = "text-amber-400";
      cardBorder = "border-amber-500/40 shadow-lg shadow-amber-950/20";
    } else if (faultType === 'CROSS_SENSOR_MISMATCH') {
      badgeText = "PHYSICS MISMATCH";
      badgeColor = "border-purple-500/50 text-purple-400 bg-purple-950/50";
      iconColor = "text-purple-400";
      cardBorder = "border-purple-500/40 shadow-lg shadow-purple-950/20";
    } else if (isAnomaly) {
      badgeText = "FAULT DETECTED";
      badgeColor = "border-rose-500/50 text-rose-400 bg-rose-950/50";
      iconColor = "text-rose-400";
      cardBorder = "border-rose-500/40";
    }
  }

  // Icon selector
  const renderIcon = () => {
    switch (sensorKey) {
      case 'temperature':
        return <Thermometer className={`w-5 h-5 ${iconColor}`} />;
      case 'pressure':
        return <Gauge className={`w-5 h-5 ${iconColor}`} />;
      case 'humidity':
        return <Droplets className={`w-5 h-5 ${iconColor}`} />;
      default:
        return <Gauge className={`w-5 h-5 ${iconColor}`} />;
    }
  };

  const deltaNum = typeof delta === 'number' ? delta : 0;
  const rollStdNum = typeof rollStd === 'number' ? rollStd : 0;
  const isPositive = deltaNum > 0.001;
  const isNegative = deltaNum < -0.001;

  return (
    <div className={`rounded-xl border bg-slate-900/80 p-4 transition-all duration-300 ${cardBorder}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
            {renderIcon()}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {label}
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              STREAM: {sensorKey.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Dynamic Status Badge */}
        <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border tracking-wider flex items-center gap-1.5 ${badgeColor}`}>
          {badgeText === "HEALTHY" ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          ) : (
            <AlertCircle className="w-3 h-3" />
          )}
          {badgeText}
        </span>
      </div>

      {/* Main Value Display */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-black font-mono tracking-tight text-slate-100">
            {typeof currentValue === 'number' ? currentValue.toFixed(2) : '--'}
          </span>
          <span className="text-sm font-mono font-medium text-slate-400">
            {unit}
          </span>
        </div>

        {/* Frozen Warning if rollStd is near 0 */}
        {rollStdNum < 0.01 && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/40 text-sky-400 animate-pulse">
            FLATLINE σ=0
          </span>
        )}
      </div>

      {/* Secondary Metrics Bar: Rate of change Δ and Rolling Std σ */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/80 text-xs font-mono">
        {/* Rate of Change Δ */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            Rate of Change (Δ)
          </span>
          <div className="flex items-center gap-1">
            {isPositive && <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />}
            {isNegative && <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />}
            {!isPositive && !isNegative && <Minus className="w-3.5 h-3.5 text-slate-400" />}
            <span className={`font-semibold ${isPositive ? 'text-cyan-400' : isNegative ? 'text-rose-400' : 'text-slate-400'}`}>
              {isPositive ? '+' : ''}{deltaNum.toFixed(3)} {unit}
            </span>
          </div>
        </div>

        {/* Rolling Std σ (10-window) */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            Rolling Var (σ, w=10)
          </span>
          <div className="flex items-center gap-1">
            <span className={`font-semibold ${rollStdNum < 0.01 ? 'text-sky-400 font-bold' : 'text-slate-200'}`}>
              σ = {rollStdNum.toFixed(3)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
