import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  Trash2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  Sparkles
} from 'lucide-react';
import {
  formatFaultType,
  formatSensorName,
  formatRelativeTime,
  formatFullDateTime
} from '../utils/formatters';

const FAULT_CARDS = [
  {
    type: 'SPIKE_FAULT',
    title: 'Spike',
    sensor: 'TEMPERATURE',
    durationTicks: 5,
    approxSec: 15,
    desc: 'Injects an instantaneous impulse excursion simulating an electrical transient or ADC power surge.'
  },
  {
    type: 'FROZEN_SENSOR',
    title: 'Frozen sensor',
    sensor: 'HUMIDITY',
    durationTicks: 10,
    approxSec: 30,
    desc: 'Locks the transducer to a constant static value, driving short-term variance to zero.'
  },
  {
    type: 'DRIFT_FAULT',
    title: 'Drift',
    sensor: 'PRESSURE',
    durationTicks: 12,
    approxSec: 36,
    desc: 'Gradually shifts readings over consecutive samples, simulating calibration sensor aging.'
  },
  {
    type: 'CROSS_SENSOR_MISMATCH',
    title: 'Sensor mismatch',
    sensor: 'TEMPERATURE',
    durationTicks: 8,
    approxSec: 24,
    desc: 'Forces high temperature alongside near-saturation humidity, breaking physical meteorologic correlation.'
  }
];

const RECENT_RUNS_KEY = 'skyguard_simulator_recent_runs';

export default function FaultSimulatorPage({
  pipelineStatus = {},
  alerts = [],
  onInjectFault,
  onClearFault,
  onNavigate,
  onOpenInvestigate,
  onShowToast
}) {
  const activeFault = pipelineStatus.active_fault;
  const remainingTicks = pipelineStatus.fault_remaining || 0;
  const totalTicks = pipelineStatus.fault_total || 10;

  const [activeRunMeta, setActiveRunMeta] = useState(null);
  const [lastOutcome, setLastOutcome] = useState(null);
  const [recentRuns, setRecentRuns] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(RECENT_RUNS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Track run start and check for detection during the active run
  const runTrackerRef = useRef(null);

  const saveRecentRuns = (updated) => {
    setRecentRuns(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(RECENT_RUNS_KEY, JSON.stringify(updated.slice(0, 5)));
      } catch {}
    }
  };

  const handleRunFault = async (card) => {
    const startTime = Date.now();
    const runInfo = {
      id: Date.now(),
      faultType: card.type,
      title: card.title,
      sensor: card.sensor,
      startTime,
      detected: false,
      detector: null,
      alertId: null,
      timeToDetectSec: null
    };

    runTrackerRef.current = runInfo;
    setActiveRunMeta(runInfo);
    setLastOutcome(null);

    try {
      const res = await fetch('http://localhost:8000/api/inject-fault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fault_type: card.type,
          sensor: card.sensor,
          duration: card.durationTicks
        })
      });
      if (res.ok) {
        if (onInjectFault) onInjectFault(await res.json());
      }
    } catch (err) {
      console.error('Failed to inject fault:', err);
      setActiveRunMeta(null);
      runTrackerRef.current = null;
    }
  };

  const handleStopFault = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/inject-fault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fault_type: 'CLEAR' })
      });
      if (res.ok) {
        if (onClearFault) onClearFault(await res.json());
      }
    } catch {}
  };

  const handleClearSimulatedAlerts = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/alerts/clear-simulated', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (onClearFault) onClearFault();
        if (onShowToast) {
          onShowToast({
            message: `Cleared ${data.cleared_count || 0} simulated test alerts`
          });
        }
      }
    } catch (err) {
      console.error('Failed to clear simulated alerts:', err);
    }
  };

  // Check incoming alerts against active run
  useEffect(() => {
    if (!runTrackerRef.current || runTrackerRef.current.detected) return;

    const currentRun = runTrackerRef.current;
    // Look for matching alert created after startTime
    const matchedAlert = alerts.find(a => {
      const aTime = new Date(a.timestamp).getTime();
      if (aTime < currentRun.startTime - 2000) return false;
      const ft = (a.fault_type || '').toUpperCase();
      const s = (a.sensor || '').toUpperCase();
      return ft === currentRun.faultType || s.includes(currentRun.sensor);
    });

    if (matchedAlert) {
      const elapsed = Math.max(1, Math.round((Date.now() - currentRun.startTime) / 1000));
      currentRun.detected = true;
      currentRun.timeToDetectSec = elapsed;
      currentRun.alertId = matchedAlert.id;
      currentRun.detector = 'Isolation Forest + LOF';
      runTrackerRef.current = { ...currentRun };
    }
  }, [alerts]);

  // Handle run completion when activeFault transitions back to empty or null
  useEffect(() => {
    if (!activeFault && activeRunMeta) {
      const finalRun = runTrackerRef.current || activeRunMeta;
      const outcome = {
        title: finalRun.title,
        faultType: finalRun.faultType,
        detected: Boolean(finalRun.detected),
        timeToDetectSec: finalRun.timeToDetectSec || 6,
        detector: finalRun.detector || 'Isolation Forest',
        alertId: finalRun.alertId,
        timestamp: new Date().toISOString()
      };

      setLastOutcome(outcome);
      saveRecentRuns([outcome, ...recentRuns.filter(r => r.id !== finalRun.id)].slice(0, 5));
      setActiveRunMeta(null);
      runTrackerRef.current = null;
    }
  }, [activeFault, activeRunMeta]);

  const simulatedAlertsCount = alerts.filter(a => a.is_simulated || a.fault_type in {
    SPIKE_FAULT: 1, FROZEN_SENSOR: 1, DRIFT_FAULT: 1, CROSS_SENSOR_MISMATCH: 1
  }).length;

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E5E5] dark:border-[#262626]">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Fault simulator
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Induce controlled hardware failure modes into the live stream to benchmark ensemble detector response.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeFault && (
            <button
              onClick={handleStopFault}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop running fault</span>
            </button>
          )}

          {simulatedAlertsCount > 0 && (
            <button
              onClick={handleClearSimulatedAlerts}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Remove simulated fault alerts from alert list"
            >
              <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
              <span>Clear simulated alerts ({simulatedAlertsCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Active Run Live Progress Card */}
      {activeFault && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-semibold text-amber-900 dark:text-amber-100">
                Running {formatFaultType(activeFault)} injection on {formatSensorName(pipelineStatus.fault_sensor)}
              </span>
            </div>
            <div className="text-[12px] text-amber-700 dark:text-amber-300">
              Remaining: {remainingTicks} samples (~{remainingTicks * 3}s) · Evaluating ensemble consensus
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Progress Track */}
            <div className="w-32 h-2 rounded-full bg-amber-200 dark:bg-amber-900 overflow-hidden">
              <div
                className="h-full bg-amber-600 transition-all duration-300"
                style={{
                  width: `${Math.max(5, Math.min(100, ((totalTicks - remainingTicks) / Math.max(1, totalTicks)) * 100))}%`
                }}
              />
            </div>

            <button
              onClick={handleStopFault}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-[#171718] border border-amber-300 dark:border-amber-800 font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 cursor-pointer"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* 3. Post-Run Outcome Banner */}
      {lastOutcome && !activeFault && (
        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/80 dark:bg-blue-950/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            {lastOutcome.detected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
            )}
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {lastOutcome.title}:{' '}
              </span>
              <span className="text-neutral-700 dark:text-neutral-300">
                {lastOutcome.detected
                  ? `Detected after ${lastOutcome.timeToDetectSec}s by ${lastOutcome.detector}`
                  : 'Run completed: Transient was not flagged as anomalous'}
              </span>
            </div>
          </div>

          {lastOutcome.alertId ? (
            <button
              onClick={() => onOpenInvestigate?.(lastOutcome.alertId)}
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer shrink-0"
            >
              <span>View resulting alert</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={() => onNavigate?.('incidents')}
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer shrink-0"
            >
              <span>Open alerts</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* 4. Fault Trigger Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FAULT_CARDS.map((card) => {
          const isThisRunning = activeFault === card.type;

          return (
            <div
              key={card.type}
              className={`p-5 rounded-xl border bg-white dark:bg-[#171718] flex flex-col justify-between transition-colors ${
                isThisRunning
                  ? 'border-amber-400 dark:border-amber-700 ring-1 ring-amber-400/30'
                  : 'border-[#E5E5E5] dark:border-[#262626]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                    {card.title}
                  </h3>
                  <span className="text-[11px] text-neutral-400">
                    Target: {formatSensorName(card.sensor)}
                  </span>
                </div>

                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 leading-relaxed">
                  {card.desc}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 mt-3 border-t border-[#F0F0F0] dark:border-[#262626]">
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 tabular-nums">
                  <Clock className="w-3 h-3" />
                  <span>Duration: ~{card.approxSec}s ({card.durationTicks} samples)</span>
                </div>

                {isThisRunning ? (
                  <button
                    onClick={handleStopFault}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer"
                  >
                    <Square className="w-3 h-3" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleRunFault(card)}
                    disabled={Boolean(activeFault)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Play className="w-3 h-3" />
                    <span>Run</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Recent Runs List (last 5) */}
      <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] p-5">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          Recent simulator runs
        </h3>

        {recentRuns.length === 0 ? (
          <div className="py-6 text-center text-xs text-neutral-400">
            No simulator runs recorded yet this session. Click "Run" on any fault above to test model responsiveness.
          </div>
        ) : (
          <div className="divide-y divide-[#F0F0F0] dark:divide-[#262626]">
            {recentRuns.map((run, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  {run.detected ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {run.title}
                    </span>
                    <span className="text-[11px] text-neutral-400 ml-2">
                      {formatRelativeTime(run.timestamp)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 tabular-nums text-neutral-500">
                  <span>
                    {run.detected
                      ? `Detected in ${run.timeToDetectSec}s (${run.detector})`
                      : 'Not detected'}
                  </span>
                  {run.alertId && (
                    <button
                      onClick={() => onOpenInvestigate?.(run.alertId)}
                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 cursor-pointer"
                    >
                      Alert #{run.alertId}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
