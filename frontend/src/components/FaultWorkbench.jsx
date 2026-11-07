import React, { useState } from 'react';
import {
  Zap,
  PauseOctagon,
  TrendingUp,
  GitCompare,
  RotateCcw,
  Loader2
} from 'lucide-react';

const FAULTS = [
  {
    key: 'SPIKE_FAULT',
    sensor: 'TEMPERATURE',
    duration: 6,
    label: 'Temp Voltage Spike',
    icon: Zap
  },
  {
    key: 'FROZEN_SENSOR',
    sensor: 'HUMIDITY',
    duration: 15,
    label: 'Humidity Flatline',
    icon: PauseOctagon
  },
  {
    key: 'DRIFT_FAULT',
    sensor: 'PRESSURE',
    duration: 20,
    label: 'Pressure Drift',
    icon: TrendingUp
  },
  {
    key: 'CROSS_SENSOR_MISMATCH',
    sensor: 'TEMPERATURE',
    duration: 12,
    label: 'Cross-Sensor Mismatch',
    icon: GitCompare
  }
];

export default function FaultWorkbench({
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
      console.error('Fault injection failed:', err);
    } finally {
      setLoadingFault(null);
    }
  };

  const handleClear = () => {
    handleTrigger('CLEAR', 'TEMPERATURE', 0);
  };

  const isFaultActive = Boolean(activeFaultType && activeFaultType !== 'NONE');

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-3.5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Fault Injection
          </span>
          {isFaultActive && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-red-600 dark:text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {activeFaultType}
            </span>
          )}
        </div>

        {isFaultActive && (
          <button
            onClick={handleClear}
            className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" strokeWidth={1.75} />
            Reset to Nominal
          </button>
        )}
      </div>

      {/* 2x2 Segmented Button Grid */}
      <div className="grid grid-cols-2 gap-2">
        {FAULTS.map((fault) => {
          const Icon = fault.icon;
          const isActive = activeFaultType === fault.key;
          const isLoading = loadingFault === fault.key;

          return (
            <button
              key={fault.key}
              onClick={() => handleTrigger(fault.key, fault.sensor, fault.duration)}
              disabled={loadingFault !== null}
              className={`p-2.5 rounded text-left border transition-all text-xs flex flex-col justify-between h-16 cursor-pointer disabled:opacity-50 ${
                isActive
                  ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-200 font-medium'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`} strokeWidth={1.75} />
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                ) : isActive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                ) : null}
              </div>
              <span className="text-[11px] font-medium leading-tight line-clamp-1">
                {fault.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

