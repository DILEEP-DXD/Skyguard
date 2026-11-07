import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, RotateCcw, AlertCircle } from 'lucide-react';
import { formatFaultType, formatSensorName } from '../utils/formatters';

export default function BottomRightToast({
  alert,
  onDismissAlert,
  onAcknowledgeAlert,
  actionToast,
  onDismissActionToast
}) {
  const [isUndoing, setIsUndoing] = useState(false);

  // Auto-dismiss alert toast after 8s
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        if (onDismissAlert) onDismissAlert();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [alert, onDismissAlert]);

  // Auto-dismiss action toast after 6s
  useEffect(() => {
    if (actionToast) {
      const timer = setTimeout(() => {
        if (onDismissActionToast) onDismissActionToast();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [actionToast, onDismissActionToast]);

  const handleUndo = async () => {
    if (!actionToast?.undoAction || isUndoing) return;
    setIsUndoing(true);
    try {
      await actionToast.undoAction();
    } catch (e) {
      console.error('Undo failed:', e);
    } finally {
      setIsUndoing(false);
      if (onDismissActionToast) onDismissActionToast();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {/* Action / Undo Toast */}
        {actionToast && (
          <motion.div
            key="action-toast"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-900 dark:bg-[#1F1F21] text-white p-3.5 shadow-xl flex items-center justify-between gap-3 text-xs"
          >
            <span className="font-medium truncate">
              {actionToast.message}
            </span>

            <div className="flex items-center gap-2 shrink-0">
              {actionToast.undoAction && (
                <button
                  onClick={handleUndo}
                  disabled={isUndoing}
                  className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-blue-300 hover:text-white font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isUndoing ? 'Undoing...' : 'Undo'}</span>
                </button>
              )}

              <button
                onClick={onDismissActionToast}
                className="p-1 rounded text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Real-Time Incoming Alert Toast */}
        {alert && (
          <motion.div
            key={`alert-${alert.id || alert.timestamp}`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] p-4 shadow-lg flex items-start justify-between gap-3 text-xs"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    alert.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500'
                  }`}
                />
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {formatFaultType(alert.fault_type)}
                </span>
                <span className="text-[11px] text-neutral-400">
                  · {formatSensorName(alert.sensor)}
                </span>
              </div>

              <p className="text-[12px] text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                {alert.diagnosis_message || alert.message || alert.title}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {alert.id && onAcknowledgeAlert && (
                <button
                  onClick={() => onAcknowledgeAlert(alert.id)}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>Ack</span>
                </button>
              )}

              <button
                onClick={onDismissAlert}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
