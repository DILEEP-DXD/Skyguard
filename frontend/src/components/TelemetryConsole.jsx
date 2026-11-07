import React, { useState, useEffect } from 'react';
import SyncedSensorStrip from './SyncedSensorStrip';
import { getSensorHealth } from '../utils/formatters';

const TIME_WINDOWS = [
  { id: '1m', label: '1 min', count: 20 },
  { id: '5m', label: '5 min', count: 100 },
  { id: '15m', label: '15 min', count: 300 }
];

const TIME_WINDOW_STORAGE_KEY = 'skyguard_sensors_time_window';

export default function TelemetryConsole({
  readings = [],
  alerts = [],
  activeFaultType
}) {
  const [selectedWindow, setSelectedWindow] = useState(() => {
    if (typeof window === 'undefined') return '5m';
    return localStorage.getItem(TIME_WINDOW_STORAGE_KEY) || '5m';
  });

  const handleSelectWindow = (id) => {
    setSelectedWindow(id);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TIME_WINDOW_STORAGE_KEY, id);
      } catch {}
    }
  };

  const windowConfig = TIME_WINDOWS.find(w => w.id === selectedWindow) || TIME_WINDOWS[1];
  const windowReadings = readings.slice(-windowConfig.count);

  // Health statuses from open alerts
  const tempHealth = getSensorHealth('temperature', alerts, activeFaultType);
  const pressHealth = getSensorHealth('pressure', alerts, activeFaultType);
  const humHealth = getSensorHealth('humidity', alerts, activeFaultType);

  return (
    <div className="space-y-4">
      {/* Page Header & Time Window Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E5E5E5] dark:border-[#262626]">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Sensors
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Synchronized telemetry charts with real-time detector anomaly markers.
          </p>
        </div>

        {/* Time-Window Segmented Control */}
        <div className="inline-flex rounded-lg border border-[#E5E5E5] dark:border-[#262626] p-0.5 bg-neutral-100/60 dark:bg-neutral-900 text-xs self-start sm:self-auto">
          {TIME_WINDOWS.map((w) => (
            <button
              key={w.id}
              onClick={() => handleSelectWindow(w.id)}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                selectedWindow === w.id
                  ? 'bg-white dark:bg-[#171718] text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sensor 1: Temperature */}
      <SyncedSensorStrip
        label="Temperature"
        sensorKey="temperature"
        unit="°C"
        accentColor="#2563EB"
        readings={windowReadings}
        statusText={tempHealth.label}
        isFault={tempHealth.status === 'CRITICAL'}
        isWarning={tempHealth.status === 'WARNING'}
      />

      {/* Sensor 2: Barometric Pressure */}
      <SyncedSensorStrip
        label="Atmospheric pressure"
        sensorKey="pressure"
        unit="hPa"
        accentColor="#2563EB"
        readings={windowReadings}
        statusText={pressHealth.label}
        isFault={pressHealth.status === 'CRITICAL'}
        isWarning={pressHealth.status === 'WARNING'}
      />

      {/* Sensor 3: Relative Humidity */}
      <SyncedSensorStrip
        label="Relative humidity"
        sensorKey="humidity"
        unit="%"
        accentColor="#2563EB"
        readings={windowReadings}
        statusText={humHealth.label}
        isFault={humHealth.status === 'CRITICAL'}
        isWarning={humHealth.status === 'WARNING'}
      />
    </div>
  );
}
