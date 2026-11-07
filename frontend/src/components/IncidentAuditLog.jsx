import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ShieldCheck, AlertCircle, Filter } from 'lucide-react';
import { formatTimestamp } from '../utils/formatters';

export default function IncidentAuditLog({
  alerts = [],
  onAlertAcknowledged
}) {
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'UNACK' | 'CRITICAL' | 'WARNING'

  const handleAck = async (id) => {
    setAcknowledgingId(id);
    try {
      const res = await fetch(`http://localhost:8000/api/alerts/${id}/acknowledge`, {
        method: 'POST'
      });
      const data = await res.json();
      if (onAlertAcknowledged) onAlertAcknowledged(data);
    } catch (e) {
      console.error('Ack error:', e);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const unackCount = useMemo(() => alerts.filter((a) => !a.is_acknowledged).length, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (filterMode === 'UNACK') return !a.is_acknowledged;
      if (filterMode === 'CRITICAL') return a.severity === 'CRITICAL';
      if (filterMode === 'WARNING') return a.severity === 'WARNING';
      return true;
    });
  }, [alerts, filterMode]);

  return (
    <div className="rounded-md border border-slate-200 dark:border-[#162238] bg-white dark:bg-[#0a0f1d] p-3.5 shadow-sm flex flex-col flex-1 min-h-[340px]">
      {/* Header + Stats & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-[#162238]">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" strokeWidth={2} />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Incident Audit Log
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            ({alerts.length} total)
          </span>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              filterMode === 'ALL'
                ? 'bg-slate-800 text-white dark:bg-cyan-500/20 dark:text-cyan-300 font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterMode('UNACK')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1 ${
              filterMode === 'UNACK'
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Unresolved ({unackCount})
          </button>
          <button
            onClick={() => setFilterMode('CRITICAL')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              filterMode === 'CRITICAL'
                ? 'bg-rose-500 text-white font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Critical
          </button>
        </div>
      </div>

      {/* Audit Log Table / Stream */}
      <div className="overflow-y-auto max-h-[320px] divide-y divide-slate-100 dark:divide-[#162238]/60 pr-1">
        {filteredAlerts.length === 0 ? (
          <div className="py-14 text-center text-slate-400 flex flex-col items-center justify-center gap-2 text-xs">
            <ShieldCheck className="w-6 h-6 text-emerald-500/80" strokeWidth={1.5} />
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
              Zero Active Incidents
            </span>
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
              All AWS sensors operating within calibrated limits
            </span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredAlerts.map((alert) => {
              const isAck = Boolean(alert.is_acknowledged);
              const isCritical = alert.severity === 'CRITICAL';

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`py-2 px-2.5 flex items-center justify-between gap-3 text-xs transition-colors rounded-sm my-0.5 ${
                    isAck
                      ? 'opacity-40 bg-transparent'
                      : isCritical
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/30'
                      : 'bg-amber-50/30 dark:bg-amber-950/15 hover:bg-amber-50/60 dark:hover:bg-amber-950/25'
                  }`}
                  style={{
                    borderLeft: `3px solid ${
                      isAck ? '#64748b' : isCritical ? '#f43f5e' : '#f59e0b'
                    }`
                  }}
                >
                  {/* Alert Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                        {formatTimestamp(alert.timestamp)}
                      </span>
                      <span className="font-mono font-semibold uppercase text-slate-900 dark:text-slate-100">
                        {alert.sensor} · {alert.fault_type || 'ANOMALY'}
                      </span>
                      <span className={`text-[9px] font-mono px-1 py-0.2 rounded uppercase font-bold ml-auto ${
                        isCritical
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono truncate mt-0.5">
                      {alert.diagnosis_message || alert.message || alert.title}
                    </p>
                  </div>

                  {/* Ack Button / Resolved Pill */}
                  <div className="shrink-0">
                    {isAck ? (
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600">
                        Resolved
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAck(alert.id)}
                        disabled={acknowledgingId === alert.id}
                        className="h-6 px-2 text-[10px] font-mono font-medium rounded border border-slate-200 dark:border-[#223555] bg-white dark:bg-[#070b16] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#121c2e] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3 h-3 text-slate-500" strokeWidth={2} />
                        <span>Ack</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

