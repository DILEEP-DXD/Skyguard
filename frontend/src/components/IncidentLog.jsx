import React, { useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';

function formatTime(isoStr) {
  if (!isoStr) return '--:--:--';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--:--';
  }
}

export default function IncidentLog({ alerts = [], onAlertAcknowledged }) {
  const [acknowledgingId, setAcknowledgingId] = useState(null);

  const handleAck = async (id) => {
    setAcknowledgingId(id);
    try {
      const res = await fetch(`http://localhost:8000/api/alerts/${id}/acknowledge`, {
        method: 'POST'
      });
      const data = await res.json();
      if (onAlertAcknowledged) onAlertAcknowledged(data);
    } catch (e) {
      console.error('Ack failed:', e);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const unackCount = alerts.filter(a => !a.is_acknowledged).length;

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-3.5 shadow-xs flex flex-col flex-1 min-h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Incident Log
          </span>
          <span className="text-[10px] font-mono text-zinc-400">
            (sensor_alerts)
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
          <span>Unresolved:</span>
          <span className={`font-semibold ${unackCount > 0 ? 'text-red-500' : 'text-zinc-400'}`}>
            {unackCount}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[320px] divide-y divide-zinc-100 dark:divide-zinc-800/60 pr-1">
        {alerts.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-1.5 text-xs">
            <ShieldCheck className="w-5 h-5 text-zinc-400 dark:text-zinc-600" strokeWidth={1.75} />
            <span className="font-medium text-zinc-500 dark:text-zinc-400">Zero Active Incidents</span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-600 font-mono">All sensor telemetry within nominal limits</span>
          </div>
        ) : (
          alerts.map((alert) => {
            const isAck = Boolean(alert.is_acknowledged);
            const isCritical = alert.severity === 'CRITICAL';

            return (
              <div
                key={alert.id}
                className={`py-2 px-2 flex items-center justify-between gap-3 text-xs transition-colors ${
                  isAck
                    ? 'opacity-40 bg-transparent'
                    : 'bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40'
                }`}
                style={{
                  borderLeft: `2px solid ${isAck ? '#71717a' : isCritical ? '#ef4444' : '#f59e0b'}`
                }}
              >
                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono text-zinc-400 tabular-nums">
                      {formatTime(alert.timestamp)}
                    </span>
                    <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 uppercase">
                      {alert.sensor} · {alert.fault_type || 'ANOMALY'}
                    </span>
                    <span className="text-[10px] font-mono px-1 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 ml-auto">
                      IF + LOF
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono truncate mt-0.5">
                    {alert.diagnosis_message || alert.message || alert.title}
                  </p>
                </div>

                {/* Ack button */}
                <div className="shrink-0">
                  {isAck ? (
                    <span className="text-[10px] font-mono text-zinc-400">
                      Resolved
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAck(alert.id)}
                      disabled={acknowledgingId === alert.id}
                      className="h-6 px-2 text-[10px] font-mono font-medium rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3 text-zinc-500" strokeWidth={1.75} />
                      Ack
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

