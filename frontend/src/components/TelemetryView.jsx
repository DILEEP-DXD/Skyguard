import React from 'react';
import SensorStrip from './SensorStrip';
import FaultWorkbench from './FaultWorkbench';
import IncidentLog from './IncidentLog';

export default function TelemetryView({
  readings = [],
  alerts = [],
  activeFaultType = null,
  onFaultTriggered,
  onAlertAcknowledged,
  overallStatus = 'Nominal'
}) {
  const latest = readings.length > 0 ? readings[readings.length - 1] : null;

  // Single Source of Truth for Sensor Health Status
  const isOverallNominal = overallStatus === 'Nominal';

  // Temperature status
  const isTempFault = !isOverallNominal && (
    latest?.fault_type === 'SPIKE_FAULT' ||
    (latest?.is_anomaly && Math.abs(latest?.delta_temp || 0) > 4)
  );
  const tempStatus = isTempFault ? 'Spike Fault' : 'Nominal';

  // Pressure status
  const isPresFault = !isOverallNominal && (
    latest?.fault_type === 'DRIFT_FAULT' ||
    (latest?.is_anomaly && latest?.fault_type === 'DRIFT_FAULT')
  );
  const presStatus = isPresFault ? 'Calibration Drift' : 'Nominal';

  // Humidity status
  const isHumFault = !isOverallNominal && (
    latest?.fault_type === 'FROZEN_SENSOR' ||
    (latest?.is_anomaly && (latest?.roll_std_humidity || 0) < 0.005)
  );
  const humStatus = isHumFault ? 'Sensor Flatline' : 'Nominal';

  // Cross sensor mismatch handling
  const isMismatch = !isOverallNominal && latest?.fault_type === 'CROSS_SENSOR_MISMATCH';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
      {/* LEFT 8 COLUMNS: 3 High-Precision Sensor Strips stacked vertically */}
      <div className="lg:col-span-8 space-y-2.5">
        <SensorStrip
          label="Temperature"
          sensorKey="temperature"
          unit="°C"
          strokeColor="#0284c7"
          readings={readings}
          statusText={isMismatch ? 'Physics Mismatch' : tempStatus}
          isFault={isTempFault || isMismatch}
        />

        <SensorStrip
          label="Atmospheric Pressure"
          sensorKey="pressure"
          unit="hPa"
          strokeColor="#0ea5e9"
          readings={readings}
          statusText={isMismatch ? 'Physics Mismatch' : presStatus}
          isFault={isMismatch}
          isWarning={isPresFault}
        />

        <SensorStrip
          label="Relative Humidity"
          sensorKey="humidity"
          unit="%"
          strokeColor="#10b981"
          readings={readings}
          statusText={isMismatch ? 'Physics Mismatch' : humStatus}
          isFault={isHumFault || isMismatch}
        />
      </div>

      {/* RIGHT 4 COLUMNS: Fault Injection Workbench + Incident Log */}
      <div className="lg:col-span-4 flex flex-col gap-2.5">
        <FaultWorkbench
          activeFaultType={activeFaultType}
          onFaultTriggered={onFaultTriggered}
        />

        <IncidentLog
          alerts={alerts}
          onAlertAcknowledged={onAlertAcknowledged}
        />
      </div>
    </div>
  );
}

