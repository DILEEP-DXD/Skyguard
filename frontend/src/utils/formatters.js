/**
 * Unified Formatting & Domain Utilities for SkyGuard
 *
 * Rules:
 * - Sentence case everywhere.
 * - Humanizes raw enums (HUMIDITY -> Humidity, STATISTICAL_OUTLIER -> Statistical outlier).
 * - Relative time formatting with full ISO tooltip support.
 * - Shared alert grouping and health selectors.
 */

export function formatSensorName(sensor) {
  if (!sensor) return 'Unknown';
  const s = String(sensor).toUpperCase().trim();
  if (s.includes('TEMP')) return 'Temperature';
  if (s.includes('PRESS')) return 'Pressure';
  if (s.includes('HUM')) return 'Humidity';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function formatFaultType(faultType) {
  if (!faultType) return 'None';
  const f = String(faultType).toUpperCase().trim();
  switch (f) {
    case 'SPIKE_FAULT':
      return 'Voltage spike';
    case 'FROZEN_SENSOR':
      return 'Frozen sensor';
    case 'DRIFT_FAULT':
      return 'Calibration drift';
    case 'CROSS_SENSOR_MISMATCH':
      return 'Sensor mismatch';
    case 'STATISTICAL_OUTLIER':
      return 'Statistical outlier';
    case 'NOISE_FAULT':
      return 'Signal noise';
    case 'STICKY_SENSOR':
      return 'Sticky bit';
    case 'NONE':
      return 'Normal telemetry';
    default:
      // Convert SNAKE_CASE to Sentence case
      return f.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
  }
}

export function formatSeverity(severity) {
  if (!severity) return 'Warning';
  const s = String(severity).toUpperCase();
  if (s === 'CRITICAL') return 'Critical';
  if (s === 'INFO') return 'Info';
  return 'Warning';
}

export function formatStatus(status) {
  if (!status) return 'Open';
  const s = String(status).toUpperCase();
  if (s === 'ACKNOWLEDGED') return 'Acknowledged';
  if (s === 'RESOLVED') return 'Resolved';
  if (s === 'DISMISSED') return 'Dismissed';
  return 'Open';
}

export function formatRelativeTime(isoStr) {
  if (!isoStr) return 'Unknown';
  try {
    const date = new Date(isoStr);
    const now = new Date();
    const diffSec = Math.round((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;

    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;

    const diffHour = Math.round(diffMin / 60);
    if (diffHour < 24) {
      return diffHour === 1 ? '1 hr ago' : `${diffHour} hrs ago`;
    }

    const diffDays = Math.round(diffHour / 24);
    if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diffDays < 7) {
      return `${diffDays} days ago`;
    }

    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Unknown';
  }
}

export function formatFullDateTime(isoStr) {
  if (!isoStr) return '--';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return isoStr;
  }
}

export function formatTimestamp(isoStr) {
  if (!isoStr) return '--:--:--';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return '--:--:--';
  }
}

export function formatDelta(val) {
  if (typeof val !== 'number' || isNaN(val)) return '+0.00';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}`;
}

export function formatStd(val) {
  if (typeof val !== 'number' || isNaN(val)) return '0.000';
  return val.toFixed(3);
}

export function getAdaptiveSensorFormatter(min, max) {
  const range = Math.abs(max - min);
  if (range <= 0.2) {
    return (v) => Number(v).toFixed(3);
  }
  if (range <= 1.5) {
    return (v) => Number(v).toFixed(2);
  }
  if (range <= 10) {
    return (v) => Number(v).toFixed(1);
  }
  return (v) => Math.round(Number(v)).toString();
}

/**
 * Filter alerts down to truly "Open" (unresolved and not dismissed or acknowledged)
 */
export function getOpenAlerts(alerts = []) {
  return alerts.filter(a => {
    const st = (a.status || (a.is_acknowledged ? 'ACKNOWLEDGED' : 'OPEN')).toUpperCase();
    return st === 'OPEN';
  });
}

/**
 * Single source of truth for sensor status:
 * Checks open alerts matching this sensor.
 * Returns: { status: 'NORMAL'|'WARNING'|'CRITICAL', label: 'Normal'|'Warning'|'Critical', count: number }
 */
export function getSensorHealth(sensorKey, alerts = [], activeFault = null) {
  const openAlerts = getOpenAlerts(alerts);
  const key = String(sensorKey).toUpperCase();

  // Check active hardware fault
  if (activeFault && activeFault !== 'NONE') {
    // If fault matches sensor or mismatch affects it
    return {
      status: 'CRITICAL',
      label: 'Critical',
      count: openAlerts.filter(a => String(a.sensor).toUpperCase().includes(key)).length
    };
  }

  const sensorAlerts = openAlerts.filter(a => {
    const s = String(a.sensor || '').toUpperCase();
    return s.includes(key);
  });

  if (sensorAlerts.length === 0) {
    return { status: 'NORMAL', label: 'Normal', count: 0 };
  }

  const hasCritical = sensorAlerts.some(a => (a.severity || '').toUpperCase() === 'CRITICAL');
  if (hasCritical) {
    return { status: 'CRITICAL', label: 'Critical', count: sensorAlerts.length };
  }

  return { status: 'WARNING', label: 'Warning', count: sensorAlerts.length };
}

/**
 * Group alerts by sensor and fault type so repetitive ticks collapse into one item.
 */
export function groupAlerts(alerts = []) {
  const groups = new Map();

  for (const alert of alerts) {
    const sensorKey = String(alert.sensor || 'UNKNOWN').toUpperCase();
    const faultKey = String(alert.fault_type || 'UNKNOWN').toUpperCase();
    const groupKey = `${sensorKey}::${faultKey}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        groupKey,
        sensor: alert.sensor,
        fault_type: alert.fault_type,
        title: alert.title,
        severity: alert.severity,
        status: alert.status || (alert.is_acknowledged ? 'ACKNOWLEDGED' : 'OPEN'),
        is_simulated: Boolean(alert.is_simulated),
        firstSeen: alert.timestamp,
        lastSeen: alert.timestamp,
        count: 0,
        items: []
      });
    }

    const g = groups.get(groupKey);
    g.count += 1;
    g.items.push(alert);

    // Keep highest severity
    if (alert.severity === 'CRITICAL') {
      g.severity = 'CRITICAL';
    }

    // Status: if any member is OPEN, group is OPEN
    if ((alert.status || (alert.is_acknowledged ? 'ACKNOWLEDGED' : 'OPEN')).toUpperCase() === 'OPEN') {
      g.status = 'OPEN';
    }

    // Keep oldest and newest timestamps
    if (new Date(alert.timestamp).getTime() < new Date(g.firstSeen).getTime()) {
      g.firstSeen = alert.timestamp;
    }
    if (new Date(alert.timestamp).getTime() > new Date(g.lastSeen).getTime()) {
      g.lastSeen = alert.timestamp;
    }
  }

  // Sort groups by lastSeen descending
  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  );
}
