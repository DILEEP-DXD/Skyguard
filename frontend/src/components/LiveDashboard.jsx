import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'

const FAULT_CONFIG = [
  { key: 'SPIKE_FAULT',          label: 'Inject Temp Voltage Spike',           cls: 'spike',   icon: '⚡', duration: 6  },
  { key: 'FROZEN_SENSOR',        label: 'Freeze Humidity Sensor',              cls: 'freeze',  icon: '❄️', duration: 15 },
  { key: 'DRIFT_FAULT',          label: 'Simulate Pressure Calibration Drift', cls: 'drift',   icon: '📉', duration: 20 },
  { key: 'CROSS_SENSOR_MISMATCH',label: 'Cross-Sensor Mismatch',              cls: 'mismatch',icon: '⚠️', duration: 12 },
]

const CHART_CFG = [
  { key: 'temperature', label: 'Temperature', unit: '°C',  color: '#ffa657', domain: [5, 45]     },
  { key: 'pressure',    label: 'Pressure',    unit: ' hPa', color: '#58a6ff', domain: [985, 1040] },
  { key: 'humidity',    label: 'Humidity',    unit: '%',   color: '#3fb950', domain: [0, 105]    },
]

function fmtTime(ts) {
  try { return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { return '' }
}

function SensorChart({ readings, cfg }) {
  const data = readings.map(r => ({
    time:      fmtTime(r.timestamp),
    value:     r[cfg.key],
    anomaly:   r.is_anomaly ? r[cfg.key] : null,
    fault:     r.fault_type,
  }))

  const CustomDot = (props) => {
    const { cx, cy, payload } = props
    if (!payload.anomaly) return null
    return <circle cx={cx} cy={cy} r={5} fill="#f85149" stroke="#ff6b6b" strokeWidth={1.5} />
  }

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-title" style={{ color: cfg.color }}>{cfg.label} ({cfg.unit.trim()})</div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#8b949e' }} interval="preserveStartEnd" />
            <YAxis domain={cfg.domain} tick={{ fontSize: 10, fill: '#8b949e' }} />
            <Tooltip
              contentStyle={{ background: '#1c2128', border: '1px solid #30363d', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: '#8b949e' }}
              itemStyle={{ color: cfg.color }}
              formatter={(v, n) => [v?.toFixed(2) + cfg.unit, cfg.label]}
            />
            <Line
              type="monotone" dataKey="value" stroke={cfg.color}
              strokeWidth={1.5} dot={false} isAnimationActive={false}
            />
            <Line
              type="monotone" dataKey="anomaly" stroke="#f85149"
              strokeWidth={0} dot={<CustomDot />} isAnimationActive={false}
              legendType="none"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AlertFeed({ alerts }) {
  const iconMap = { CRITICAL: '🚨', WARNING: '⚠️' }
  return (
    <div className="alert-feed">
      <h3>Live Alert Feed</h3>
      <div className="alert-list">
        {alerts.length === 0
          ? <div className="no-alerts">No anomalies detected yet — all sensors nominal</div>
          : alerts.map(a => (
            <div key={a.id} className={`alert-item ${a.severity}`}>
              <span className="alert-icon">{iconMap[a.severity] || '🔔'}</span>
              <div className="alert-body">
                <div className="alert-title">{a.title}</div>
                <div className="alert-msg">{a.message}</div>
              </div>
              <span className="alert-time">{fmtTime(a.timestamp)}</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

export default function LiveDashboard({ readings, alerts }) {
  const [injecting, setInjecting] = useState(null)
  const [activeFault, setActiveFault] = useState(null)

  const injectFault = async (fc) => {
    if (injecting) return
    setInjecting(fc.key)
    setActiveFault(fc.key)
    try {
      await fetch('http://localhost:8000/api/inject-fault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fault_type: fc.key, duration: fc.duration }),
      })
    } catch (e) {
      console.error('Inject fault failed:', e)
    }
    setTimeout(() => {
      setInjecting(null)
      setActiveFault(null)
    }, (fc.duration + 3) * 2000)
  }

  return (
    <div>
      {/* Charts */}
      <div className="grid-3">
        {CHART_CFG.map(cfg => (
          <SensorChart key={cfg.key} readings={readings} cfg={cfg} />
        ))}
      </div>

      {/* Fault injection */}
      <div className="fault-section">
        <h3>
          Hardware Fault Injection
          {activeFault && <span className="fault-active-badge">ACTIVE: {activeFault}</span>}
        </h3>
        <div className="fault-buttons">
          {FAULT_CONFIG.map(fc => (
            <button
              key={fc.key}
              className={`fault-btn ${fc.cls}`}
              onClick={() => injectFault(fc)}
              disabled={!!injecting}
            >
              <span>{fc.icon}</span> {fc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert feed */}
      <AlertFeed alerts={alerts} />
    </div>
  )
}

