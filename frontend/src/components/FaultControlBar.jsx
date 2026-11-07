import React, { useState } from 'react';
import { Zap, Snowflake, TrendingUp, Shuffle, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

const FAULTS = [
  {
    key: 'SPIKE_FAULT',
    sensor: 'TEMPERATURE',
    duration: 6,
    label: 'Inject Temp Voltage Spike',
    icon: Zap,
    style: 'border-rose-500/40 text-rose-400 bg-rose-950/20 hover:bg-rose-900/30 hover:border-rose-500',
    activeStyle: 'ring-2 ring-rose-500 bg-rose-950/60 text-rose-200'
  },
  {
    key: 'FROZEN_SENSOR',
    sensor: 'HUMIDITY',
    duration: 15,
    label: 'Freeze Humidity Sensor',
    icon: Snowflake,
    style: 'border-sky-500/40 text-sky-400 bg-sky-950/20 hover:bg-sky-900/30 hover:border-sky-500',
    activeStyle: 'ring-2 ring-sky-500 bg-sky-950/60 text-sky-200'
  },
  {
    key: 'DRIFT_FAULT',
    sensor: 'PRESSURE',
    duration: 20,
    label: 'Simulate Pressure Drift',
    icon: TrendingUp,
    style: 'border-amber-500/40 text-amber-400 bg-amber-950/20 hover:bg-amber-900/30 hover:border-amber-500',
    activeStyle: 'ring-2 ring-amber-500 bg-amber-950/60 text-amber-200'
  },
  {
    key: 'CROSS_SENSOR_MISMATCH',
    sensor: 'TEMPERATURE',
    duration: 12,
    label: 'Cross-Sensor Mismatch',
    icon: Shuffle,
    style: 'border-purple-500/40 text-purple-400 bg-purple-950/20 hover:bg-purple-900/30 hover:border-purple-500',
    activeStyle: 'ring-2 ring-purple-500 bg-purple-950/60 text-purple-200'
  },
  {
    key: 'CLEAR',
    sensor: 'TEMPERATURE',
    duration: 0,
    label: 'Clear Faults / Restore Normal',
    icon: CheckCircle2,
    style: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-900/30 hover:border-emerald-500',
    activeStyle: 'ring-2 ring-emerald-500 bg-emerald-950/60 text-emerald-200'
  }
];

export default function FaultControlBar({ activeFaultType, onFaultTriggered }) {
  const [loadingFault, setLoadingFault] = useState(null);
  const [lastActionMsg, setLastActionMsg] = useState(null);

  const handleInject = async (fault) => {
    setLoadingFault(fault.key);
    try {
      const res = await fetch('http://localhost:8000/api/inject-fault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fault_type: fault.key,
          sensor: fault.sensor,
          duration: fault.duration
        })
      });
      const data = await res.json();
      if (fault.key === 'CLEAR') {
        setLastActionMsg("All hardware faults cleared • Restored healthy operations");
      } else {
        setLastActionMsg(`Injected ${fault.key} on ${fault.sensor} (~${fault.duration * 2}s)`);
      }
      if (onFaultTriggered) onFaultTriggered(data);
    } catch (err) {
      console.error('Failed to inject fault:', err);
      setLastActionMsg(`Error injecting ${fault.key}: ${err.message}`);
    } finally {
      setTimeout(() => setLoadingFault(null), 400);
      setTimeout(() => setLastActionMsg(null), 5000);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 mb-6 shadow-md">
      {/* Title & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Interactive Hardware Fault Injection Control Bar
            </h2>
            <p className="text-[11px] text-slate-400">
              Simulate sensor failure modes and verify real-time unsupervised anomaly triggers
            </p>
          </div>
        </div>

        {/* Active fault status display */}
        {activeFaultType && activeFaultType !== 'NONE' ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-rose-500/40 bg-rose-950/40 text-rose-400 text-xs font-mono font-bold animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>ACTIVE HARDWARE FAULT: {activeFaultType}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 text-xs font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>STATION NOMINAL • ALL SENSORS HEALTHY</span>
          </div>
        )}
      </div>

      {/* Button Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {FAULTS.map((fault) => {
          const Icon = fault.icon;
          const isLoading = loadingFault === fault.key;
          const isActive = activeFaultType === fault.key;

          return (
            <button
              key={fault.key}
              onClick={() => handleInject(fault)}
              disabled={loadingFault !== null}
              className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg border text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive ? fault.activeStyle : fault.style
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Icon className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">{fault.label}</span>
            </button>
          );
        })}
      </div>

      {/* Action Feedback Banner */}
      {lastActionMsg && (
        <div className="mt-2.5 px-3 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-400 flex items-center gap-2 animate-fadeIn">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>{lastActionMsg}</span>
        </div>
      )}
    </div>
  );
}
