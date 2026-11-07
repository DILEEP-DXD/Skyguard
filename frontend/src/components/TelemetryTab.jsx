import React from 'react';
import PipelineControlBar from './PipelineControlBar';
import StandbyHero from './StandbyHero';
import SensorCard from './SensorCard';
import FaultControlBar from './FaultControlBar';
import SensorChart from './SensorChart';
import AlertIncidentFeed from './AlertIncidentFeed';

export default function TelemetryTab({
  readings = [],
  alerts = [],
  pipelineStatus = {},
  isCalibrating = false,
  activeFaultType = null,
  onStartPipeline,
  onStopPipeline,
  onResetSession,
  onFaultTriggered,
  onAlertAcknowledged
}) {
  const isIdle = pipelineStatus.state === 'IDLE' && readings.length === 0;
  const latest = readings.length > 0 ? readings[readings.length - 1] : {};

  return (
    <div className="space-y-6">
      {/* Prominent Live Pipeline Control & Station Selector Bar */}
      <PipelineControlBar
        pipelineStatus={pipelineStatus}
        onStartPipeline={onStartPipeline}
        onStopPipeline={onStopPipeline}
        onResetSession={onResetSession}
        isCalibrating={isCalibrating}
      />

      {/* Show Standby Hero when IDLE with no readings */}
      {isIdle ? (
        <StandbyHero
          onStartPipeline={onStartPipeline}
          isCalibrating={isCalibrating}
        />
      ) : (
        <>
          {/* 3 Dedicated Sensor Health Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SensorCard
              sensorKey="temperature"
              label="Live Ambient Temperature"
              unit="°C"
              currentValue={latest.temperature}
              delta={latest.delta_temp}
              rollStd={latest.roll_std_temp}
              faultType={latest.fault_type}
              isAnomaly={latest.is_anomaly}
            />
            <SensorCard
              sensorKey="pressure"
              label="Live Atmospheric Pressure"
              unit="hPa"
              currentValue={latest.pressure}
              delta={latest.delta_pressure}
              rollStd={latest.roll_std_pressure}
              faultType={latest.fault_type}
              isAnomaly={latest.is_anomaly}
            />
            <SensorCard
              sensorKey="humidity"
              label="Live Relative Humidity"
              unit="%"
              currentValue={latest.humidity}
              delta={latest.delta_humidity}
              rollStd={latest.roll_std_humidity}
              faultType={latest.fault_type}
              isAnomaly={latest.is_anomaly}
            />
          </div>

          {/* Interactive Hardware Fault Injection Control Bar */}
          <FaultControlBar
            activeFaultType={activeFaultType || (latest.fault_type !== 'NONE' ? latest.fault_type : null)}
            onFaultTriggered={onFaultTriggered}
          />

          {/* 3 Synchronized Real-Time Line Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SensorChart
              title="Real-Time Temperature Stream"
              sensorKey="temperature"
              unit="°C"
              strokeColor="#fb923c"
              data={readings}
              yDomain={['auto', 'auto']}
              height={260}
            />
            <SensorChart
              title="Real-Time Pressure Stream"
              sensorKey="pressure"
              unit="hPa"
              strokeColor="#38bdf8"
              data={readings}
              yDomain={['auto', 'auto']}
              height={260}
            />
            <SensorChart
              title="Real-Time Humidity Stream"
              sensorKey="humidity"
              unit="%"
              strokeColor="#34d399"
              data={readings}
              yDomain={[0, 105]}
              height={260}
            />
          </div>

          {/* Live Alert Incident Feed */}
          <AlertIncidentFeed
            alerts={alerts}
            onAlertAcknowledged={onAlertAcknowledged}
          />
        </>
      )}
    </div>
  );
}
