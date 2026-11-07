import React, { useEffect, useState } from 'react';
import { AlertOctagon, AlertTriangle, X, CheckCheck, Bell, Volume2, VolumeX } from 'lucide-react';

export default function InstantAlertBanner({
  alert,
  onDismiss,
  onAcknowledge,
  isMuted,
  onToggleMute
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alert) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        if (onDismiss) onDismiss();
      }, 9000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [alert]);

  if (!alert || !visible) return null;

  const isCritical = alert.severity === 'CRITICAL';

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`rounded-xl border p-4 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isCritical
          ? 'bg-rose-950/95 border-rose-500 shadow-rose-950/80 ring-2 ring-rose-500/40'
          : 'bg-amber-950/95 border-amber-500 shadow-amber-950/80 ring-2 ring-amber-500/40'
      }`}>
        {/* Left: Icon & alert details */}
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${
            isCritical ? 'bg-rose-900/80 text-rose-200 animate-pulse' : 'bg-amber-900/80 text-amber-200'
          }`}>
            {isCritical ? <AlertOctagon className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>

          <div className="min-w-0 flex-1 font-mono">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border tracking-wider ${
                isCritical
                  ? 'bg-rose-900 text-rose-100 border-rose-400'
                  : 'bg-amber-900 text-amber-100 border-amber-400'
              }`}>
                INSTANT ALERT • {alert.severity}
              </span>

              <span className="text-xs font-bold text-slate-100">
                {alert.fault_type || 'HARDWARE FAULT'}
              </span>

              <span className="text-xs text-cyan-300">
                SENSOR: {alert.sensor}
              </span>

              <span className="text-[11px] text-slate-400 ml-auto">
                {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ''}
              </span>
            </div>

            <p className="text-xs text-slate-200 leading-snug break-words">
              {alert.diagnosis_message || alert.message || alert.title}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {/* Audio Mute Toggle */}
          <button
            onClick={onToggleMute}
            title={isMuted ? "Unmute alert chime" : "Mute alert chime"}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-900/80 text-slate-300 hover:text-slate-100 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Quick Acknowledge */}
          {alert.id && onAcknowledge && (
            <button
              onClick={() => {
                onAcknowledge(alert.id);
                setVisible(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-900 text-slate-100 border border-slate-700 hover:bg-slate-800 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
              Ack
            </button>
          )}

          {/* Close */}
          <button
            onClick={() => {
              setVisible(false);
              if (onDismiss) onDismiss();
            }}
            className="p-1.5 rounded-lg border border-slate-700/60 text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

