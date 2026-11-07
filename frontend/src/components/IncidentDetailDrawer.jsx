import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceDot,
  Tooltip
} from 'recharts';
import {
  formatSensorName,
  formatFaultType,
  formatSeverity,
  formatStatus,
  formatFullDateTime,
  formatRelativeTime
} from '../utils/formatters';

export default function IncidentDetailDrawer({
  alertId,
  isOpen,
  onClose,
  readings = [],
  onAcknowledge,
  onResolve,
  onDismiss
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  useEffect(() => {
    if (!isOpen || !alertId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`http://localhost:8000/api/investigate/alert/${alertId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to retrieve investigation details.`);
        return res.json();
      })
      .then((resData) => {
        if (isMounted) {
          setData(resData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [alertId, isOpen]);

  if (!isOpen) return null;

  const alert = data?.alert;
  const reading = data?.reading;
  const investigation = data?.investigation;
  const topDeviations = investigation?.top_feature_deviations || [];
  const diagnosticExplanations = investigation?.diagnostic_explanations || [];
  const modelVotes = investigation?.model_votes;

  // Chart data around event
  const sensorKey = alert?.sensor?.toLowerCase()?.includes('temp')
    ? 'temperature'
    : alert?.sensor?.toLowerCase()?.includes('press')
    ? 'pressure'
    : 'humidity';

  const chartData = readings.map((r, i) => ({
    time: r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `#${i}`,
    val: r[sensorKey],
    isFlagged: r.timestamp === alert?.timestamp || (reading && r.timestamp === reading.timestamp)
  }));

  const flaggedPoint = chartData.find(d => d.isFlagged);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-xl bg-white dark:bg-[#171718] border-l border-[#E5E5E5] dark:border-[#262626] text-neutral-900 dark:text-neutral-100 h-full flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-[#E5E5E5] dark:border-[#262626] flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">
                Alert details
              </h2>
              <span className="text-[11px] font-mono text-neutral-400">
                #{alertId}
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Root-cause telemetry analysis and detector breakdown
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {loading && (
            <div className="py-24 text-center text-neutral-400">
              Loading anomaly investigation...
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          {!loading && !error && alert && (
            <>
              {/* Alert Summary Box */}
              <div className="p-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-neutral-50/50 dark:bg-neutral-900/30 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        alert.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                      {formatFaultType(alert.fault_type)} on {formatSensorName(alert.sensor)}
                    </span>
                  </div>

                  <span className="text-[11px] px-2 py-0.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] font-medium text-neutral-700 dark:text-neutral-300">
                    {formatStatus(alert.status)}
                  </span>
                </div>

                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Detected {formatRelativeTime(alert.timestamp)} · {formatFullDateTime(alert.timestamp)}
                </div>

                <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed pt-1">
                  {alert.diagnosis_message || alert.message || alert.title}
                </p>
              </div>

              {/* Sensor Chart with Anomaly Marker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    {formatSensorName(alert.sensor)} sensor feed at event
                  </h3>
                  <span className="text-[11px] text-neutral-400">
                    Red dot indicates flagged anomaly
                  </span>
                </div>

                <div className="h-40 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] p-3">
                  {chartData.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 10, bottom: 4, left: -10 }}>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={['auto', 'auto']} width={42} tick={{ fontSize: 10, fill: '#888' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#171718',
                            border: '1px solid #262626',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '11px'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="val"
                          stroke="#2563EB"
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                        {flaggedPoint && (
                          <ReferenceDot
                            x={flaggedPoint.time}
                            y={flaggedPoint.val}
                            r={5}
                            fill="#EF4444"
                            stroke="#fff"
                            strokeWidth={1.5}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                      Reading: {reading ? `${reading[sensorKey]} on ${formatSensorName(alert.sensor)}` : 'Awaiting chart readings'}
                    </div>
                  )}
                </div>
              </div>

              {/* Detector Agreement Cards */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                  Detector voting
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718]">
                    <div className="text-[11px] text-neutral-500">Isolation Forest</div>
                    <div className="font-medium mt-1 text-xs">
                      {modelVotes?.isolation_forest?.flagged ? (
                        <span className="text-red-600 dark:text-red-400">Flagged anomaly (-1)</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">Normal partition (+1)</span>
                      )}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718]">
                    <div className="text-[11px] text-neutral-500">Local Outlier Factor (Novelty)</div>
                    <div className="font-medium mt-1 text-xs">
                      {modelVotes?.local_outlier_factor?.flagged ? (
                        <span className="text-red-600 dark:text-red-400">Low density outlier (-1)</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">Dense cluster (+1)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Plain English Diagnostic Findings */}
              {diagnosticExplanations.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                    Diagnostic findings
                  </h3>
                  <ul className="list-disc pl-4 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                    {diagnosticExplanations.map((exp, i) => (
                      <li key={i}>{exp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Collapsible Technical Details */}
              <div className="border border-[#E5E5E5] dark:border-[#262626] rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="w-full p-3 flex items-center justify-between text-left text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <span>Technical details & feature Z-scores</span>
                  {showTechnicalDetails ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>

                {showTechnicalDetails && (
                  <div className="p-3 border-t border-[#E5E5E5] dark:border-[#262626] bg-neutral-50/50 dark:bg-neutral-900/30 space-y-3">
                    <div className="text-[11px] font-mono text-neutral-500">
                      Raw fault enum: {alert.fault_type} | Sensor: {alert.sensor}
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                        Top Feature Deviations vs Baseline:
                      </div>
                      {topDeviations.length === 0 ? (
                        <p className="text-[11px] text-neutral-400">No Z-score deviations recorded.</p>
                      ) : (
                        topDeviations.map((dev, idx) => {
                          const z = dev.z_score || 0;
                          return (
                            <div
                              key={idx}
                              className="p-2 rounded border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] flex items-center justify-between text-[11px]"
                            >
                              <span>{dev.feature_name}</span>
                              <span className="font-mono tabular-nums">
                                {z >= 0 ? '+' : ''}{z.toFixed(2)}σ
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-[#E5E5E5] dark:border-[#262626] flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={onClose}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Close
          </button>

          {alert && (
            <div className="flex items-center gap-2">
              {onDismiss && (
                <button
                  onClick={() => {
                    onDismiss(alert.id);
                    onClose();
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  Dismiss
                </button>
              )}

              {onResolve && (
                <button
                  onClick={() => {
                    onResolve(alert.id);
                    onClose();
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded-md border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                >
                  Resolve
                </button>
              )}

              {alert.status === 'OPEN' && onAcknowledge && (
                <button
                  onClick={() => {
                    onAcknowledge(alert.id);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Acknowledge</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
