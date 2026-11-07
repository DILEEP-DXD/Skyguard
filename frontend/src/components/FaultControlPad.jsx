import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  PauseOctagon,
  TrendingUp,
  GitCompare,
  RotateCcw,
  Loader2,
  Radio
} from 'lucide-react';

const FAULT_CARDS = [
  {
    key: 'SPIKE_FAULT',
    sensor: 'TEMPERATURE',
    duration: 6,
    label: 'Temp Voltage Spike',
    meta: '+15°C step spike',
    icon: Zap,
    severity: 'CRITICAL'
  },
  {
    key: 'FROZEN_SENSOR',
    sensor: 'HUMIDITY',
    duration: 15,
    label: 'Humidity Flatline',
    meta: 'σ = 0 stuck sensor',
    icon: PauseOctagon,
    severity: 'WARNING'
  },
  {
    key: 'DRIFT_FAULT',
    sensor: 'PRESSURE',
    duration: 20,
    label: 'Pressure Drift',
    meta: '+0.4 hPa/tick drift',
    icon: TrendingUp,
    severity: 'WARNING'
  },
  {
    key: 'CROSS_SENSOR_MISMATCH',
    sensor: 'TEMPERATURE',
    duration: 12,
    label: 'Cross-Sensor Mismatch',
    meta: 'T+12°C & H+35% breach',
    icon: GitCompare,
    severity: 'CRITICAL'
  }
];

export default function FaultControlPad({
  activeFaultType,
  onFaultTriggered
}) {
  const [loadingFault, setLoadingFault] = useState(null);

  const handleTrigger = async (faultKey, sensor, duration) => {
    setLoadingFault(faultKey);
    try {
      const res = await fetch('http://localhost:8000/api/inject-fault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fault_type: faultKey,
          sensor: sensor,
          duration: duration
        })
      });
      const data = await res.json();
      if (onFaultTriggered) onFaultTriggered(data);
    } catch (err) {
      console.error('Fault injection error:', err);
    } finally {
      setLoadingFault(null);
    }
  };

  const handleClear = () => {
    handleTrigger('CLEAR', 'TEMPERATURE', 0);
  };

  const isFaultActive = Boolean(activeFaultType && activeFaultType !== 'NONE');

  return (
    <div className={`rounded-md border p-3.5 transition-all duration-300 shadow-sm bg-white dark:bg-[#0a0f1d] ${
      isFaultActive
        ? 'border-rose-500/70 dark:border-rose-500/50'
        : 'border-slate-200 dark:border-[#162238]'
    }`}>
      {/* Control Pad Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-[#162238]">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" strokeWidth={2} />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Hardware Fault Simulator
          </span>
          {isFaultActive && (
            <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {activeFaultType}
            </span>
          )}
        </div>

        {isFaultActive && (
          <button
            onClick={handleClear}
            className="text-[11px] font-mono text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" strokeWidth={1.75} />
            <span>Reset Nominal</span>
          </button>
        )}
      </div>

      {/* 2x2 Interactive Trigger Matrix */}
      <div className="grid grid-cols-2 gap-2">
        {FAULT_CARDS.map((fault) => {
          const Icon = fault.icon;
          const isActive = activeFaultType === fault.key;
          const isLoading = loadingFault === fault.key;

          return (
            <motion.button
              key={fault.key}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleTrigger(fault.key, fault.sensor, fault.duration)}
              disabled={loadingFault !== null}
              className={`p-2.5 rounded text-left border transition-all text-xs flex flex-col justify-between h-[68px] cursor-pointer disabled:opacity-50 select-none ${
                isActive
                  ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 font-medium shadow-sm'
                  : 'border-slate-200 dark:border-[#162238] bg-slate-50/60 dark:bg-[#070b16] text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-[#121c2e] hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                    strokeWidth={1.75}
                  />
                  <span className="font-mono text-[11px] font-semibold truncate">
                    {fault.label}
                  </span>
                </div>

                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                ) : (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-200/70 dark:bg-[#162238] text-slate-600 dark:text-slate-400">
                    {fault.duration}s
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                <span>{fault.meta}</span>
                <span className="uppercase text-[9px] text-slate-400 dark:text-slate-500">
                  {fault.sensor}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

