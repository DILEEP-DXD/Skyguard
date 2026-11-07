import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle, ShieldCheck, CheckCheck, Clock, Tag } from 'lucide-react';

function formatTime(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export default function AlertIncidentFeed({ alerts = [], onAlertAcknowledged }) {
  const [acknowledgingId, setAcknowledgingId] = useState(null);

  const handleAcknowledge = async (alertId) => {
    setAcknowledgingId(alertId);
    try {
      const res = await fetch(`http://localhost:8000/api/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      });
      const updated = await res.json();
      if (onAlertAcknowledged) onAlertAcknowledged(updated);
    } catch (err) {
      console.error(`Failed to acknowledge alert ${alertId}:`, err);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const unacknowledgedCount = alerts.filter(a => !a.is_acknowledged).length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-400">
            <AlertOctagon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Live Alert Incident Feed (sensor_alerts)
            </h3>
            <p className="text-[11px] text-slate-400">
              Hardware failure incident logs and autonomous classification events
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Unacknowledged:</span>
          <span className={`px-2 py-0.5 rounded-full font-bold ${
            unacknowledgedCount > 0 
              ? 'bg-rose-950 text-rose-400 border border-rose-500/50 animate-pulse' 
              : 'bg-slate-800 text-slate-400'
          }`}>
            {unacknowledgedCount}
          </span>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="overflow-y-auto max-h-[340px] space-y-2 pr-1 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400/60" />
            <p className="text-xs font-mono">No active hardware anomaly incidents detected.</p>
            <p className="text-[10px] text-slate-400">All sensor channels operating within nominal variance parameters.</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const isAck = Boolean(alert.is_acknowledged);

            return (
              <div
                key={alert.id}
                className={`rounded-lg border p-3 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isAck
                    ? 'border-slate-800/60 bg-slate-950/50 opacity-60'
                    : isCritical
                    ? 'border-rose-500/40 bg-rose-950/20 shadow-md shadow-rose-950/10'
                    : 'border-amber-500/40 bg-amber-950/20 shadow-md shadow-amber-950/10'
                }`}
              >
                {/* Left: icon & details */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-0.5 p-1.5 rounded-md shrink-0 ${
                    isAck
                      ? 'bg-slate-800 text-slate-400'
                      : isCritical
                      ? 'bg-rose-900/50 text-rose-400'
                      : 'bg-amber-900/50 text-amber-400'
                  }`}>
                    {isCritical ? <AlertOctagon className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        isCritical
                          ? 'border-rose-500/50 bg-rose-950/80 text-rose-300'
                          : 'border-amber-500/50 bg-amber-950/80 text-amber-300'
                      }`}>
                        {alert.severity}
                      </span>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {alert.fault_type || 'UNKNOWN'}
                      </span>

                      <span className="text-[10px] font-mono text-cyan-400 uppercase flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {alert.sensor}
                      </span>

                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 ml-auto">
                        <Clock className="w-3 h-3" />
                        {formatTime(alert.timestamp)}
                      </span>
                    </div>

                    {/* Human readable diagnosis message */}
                    <p className="text-xs text-slate-300 font-mono break-words leading-relaxed">
                      {alert.diagnosis_message || alert.message || alert.title}
                    </p>
                  </div>
                </div>

                {/* Right: Acknowledge button */}
                <div className="shrink-0 flex items-center justify-end">
                  {isAck ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-500/30">
                      <CheckCheck className="w-3.5 h-3.5" />
                      ACKNOWLEDGED
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={acknowledgingId === alert.id}
                      className="flex items-center gap-1 text-xs font-mono font-semibold px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:border-slate-600 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                      {acknowledgingId === alert.id ? 'Saving...' : 'Acknowledge'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
