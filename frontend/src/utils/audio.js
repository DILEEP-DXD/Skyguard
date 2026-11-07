/**
 * Web Audio API synthesized alert chime with intelligent throttling and timed muting.
 *
 * Rules:
 * - At most one chime per 30 seconds.
 * - Only chimes for NEW alert groups (not repeated ticks).
 * - Optional "Critical only" mode.
 * - Timed mute (15m, 1h, or indefinite) with auto-unmute.
 * - Persisted across reloads in localStorage.
 */

const STORAGE_KEYS = {
  MUTED: 'skyguard_audio_muted',
  MUTE_UNTIL: 'skyguard_audio_mute_until',
  CRITICAL_ONLY: 'skyguard_audio_critical_only',
  VOLUME: 'skyguard_audio_volume'
};

class SoundAlertManager {
  constructor() {
    this.ctx = null;
    this.lastChimeTime = 0;
    this.seenGroupKeys = new Set();
    this.listeners = new Set();

    // Load persisted state
    if (typeof window !== 'undefined') {
      this.muted = localStorage.getItem(STORAGE_KEYS.MUTED) === 'true';
      const until = localStorage.getItem(STORAGE_KEYS.MUTE_UNTIL);
      this.muteUntil = until ? parseInt(until, 10) : null;
      this.criticalOnly = localStorage.getItem(STORAGE_KEYS.CRITICAL_ONLY) === 'true';
      const vol = localStorage.getItem(STORAGE_KEYS.VOLUME);
      this.volume = vol !== null ? parseFloat(vol) : 0.25;
    } else {
      this.muted = false;
      this.muteUntil = null;
      this.criticalOnly = false;
      this.volume = 0.25;
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => {
      try { fn(this.getState()); } catch { /* ignore */ }
    });
  }

  getState() {
    return {
      isMuted: this.isMuted(),
      muted: this.muted,
      muteUntil: this.muteUntil,
      remainingMinutes: this.getRemainingMinutes(),
      criticalOnly: this.criticalOnly,
      volume: this.volume
    };
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  isMuted() {
    if (this.muted) return true;
    if (this.muteUntil) {
      if (Date.now() < this.muteUntil) {
        return true;
      }
      // Timed mute expired: clear it
      this.muteUntil = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.MUTE_UNTIL);
      }
    }
    return false;
  }

  getRemainingMinutes() {
    if (!this.muteUntil) return 0;
    const diffMs = this.muteUntil - Date.now();
    return diffMs > 0 ? Math.ceil(diffMs / 60000) : 0;
  }

  getMuteTooltip() {
    if (this.muted) {
      return 'Muted until turned back on (Press M to unmute)';
    }
    if (this.muteUntil && Date.now() < this.muteUntil) {
      const mins = this.getRemainingMinutes();
      const endTime = new Date(this.muteUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `Muted for ${mins} min (ends at ${endTime})`;
    }
    return 'Sound enabled (Press M to mute)';
  }

  muteIndefinitely() {
    this.muted = true;
    this.muteUntil = null;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.MUTED, 'true');
      localStorage.removeItem(STORAGE_KEYS.MUTE_UNTIL);
    }
    this.notify();
  }

  muteFor(minutes) {
    if (!minutes) {
      this.muteIndefinitely();
      return;
    }
    this.muted = false;
    this.muteUntil = Date.now() + minutes * 60 * 1000;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.MUTED, 'false');
      localStorage.setItem(STORAGE_KEYS.MUTE_UNTIL, this.muteUntil.toString());
    }
    this.notify();
  }

  unmute() {
    this.muted = false;
    this.muteUntil = null;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.MUTED, 'false');
      localStorage.removeItem(STORAGE_KEYS.MUTE_UNTIL);
    }
    this.notify();
  }

  toggleMute() {
    if (this.isMuted()) {
      this.unmute();
    } else {
      this.muteIndefinitely();
    }
    return this.isMuted();
  }

  setCriticalOnly(val) {
    this.criticalOnly = Boolean(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.CRITICAL_ONLY, this.criticalOnly.toString());
    }
    this.notify();
  }

  setVolume(vol) {
    this.volume = Math.max(0.01, Math.min(1.0, parseFloat(vol) || 0.25));
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.VOLUME, this.volume.toString());
    }
    this.notify();
  }

  /**
   * Chime handler:
   * - Ignores if muted
   * - Ignores non-critical if criticalOnly is on
   * - Enforces max 1 chime per 30 seconds
   * - Only chimes if the groupKey is new or 60s has passed since last alert of that group
   */
  playAlert(severity = 'CRITICAL', groupKey = null) {
    if (this.isMuted()) return;
    if (this.criticalOnly && severity !== 'CRITICAL') return;

    const now = Date.now();
    // Throttle: max 1 chime per 30s
    if (now - this.lastChimeTime < 30000) return;

    // Check if new group
    if (groupKey && this.seenGroupKeys.has(groupKey)) {
      return;
    }
    if (groupKey) {
      this.seenGroupKeys.add(groupKey);
      // Automatically allow this group again after 5 minutes
      setTimeout(() => this.seenGroupKeys.delete(groupKey), 300000);
    }

    this.lastChimeTime = now;

    try {
      this.init();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      const targetGain = this.volume;

      if (severity === 'CRITICAL') {
        // High-pitched two-tone alert
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, t);          // A5
        osc.frequency.setValueAtTime(440, t + 0.12);   // A4
        gain.gain.setValueAtTime(targetGain, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
      } else {
        // Softer harmonic chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, t);       // E5
        osc.frequency.setValueAtTime(523.25, t + 0.12);// C5
        gain.gain.setValueAtTime(targetGain * 0.75, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.35);
      }
    } catch {
      // Browser autoplay policy might restrict before user interaction
    }
  }
}

export const soundManager = new SoundAlertManager();
