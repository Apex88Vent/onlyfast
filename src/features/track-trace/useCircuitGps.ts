import { useCallback, useEffect, useRef, useState } from 'react';
import type { GpsPoint } from './circuit/onlylapsTrackScanUtils';
import { emptyMotionTelemetry, normalizeMotionTelemetry } from './circuit/telemetryMath';
import type { MotionTelemetrySnapshot } from './circuit/types';

// Browser adapter for OnlyLaps' high-accuracy watch, motion normalization and
// wake-lock lifecycle. Permission is requested only by an explicit user action.
export function useCircuitGps(onPoint: (point: GpsPoint, motion: MotionTelemetrySnapshot) => void, onInterrupt: () => void) {
  const callbacks = useRef({ onPoint, onInterrupt }); callbacks.current = { onPoint, onInterrupt };
  const watch = useRef<number | null>(null);
  const motion = useRef(emptyMotionTelemetry());
  const lock = useRef<WakeLockSentinel | null>(null);
  const active = useRef(false);
  const alive = useRef(true);
  const [fix, setFix] = useState<GpsPoint | null>(null);
  const [error, setError] = useState('');
  const [wake, setWake] = useState('Keep this screen visible and the phone unlocked.');
  const [running, setRunning] = useState(false);
  const [motionStatus, setMotionStatus] = useState('Motion sensors not enabled; GPS remains available.');
  const motionHandler = useCallback((event: DeviceMotionEvent) => { motion.current = normalizeMotionTelemetry(event, motion.current); }, []);
  const keepAwake = useCallback(async () => {
    if (!active.current || document.visibilityState !== 'visible') return;
    if (lock.current && !lock.current.released) return;
    try {
      if (!navigator.wakeLock) { setWake('Wake lock unavailable. Keep this screen visible and the phone unlocked.'); return; }
      const sentinel = await navigator.wakeLock.request('screen');
      if (!active.current) { await sentinel.release(); return; }
      lock.current = sentinel; setWake('Screen wake lock active.');
      sentinel.addEventListener('release', () => { if (lock.current === sentinel) lock.current = null; if (alive.current) setWake('Wake lock released. Keep the phone unlocked; GPS may pause in the background.'); });
    } catch { if (alive.current) setWake('Wake lock unavailable. Keep this screen visible and the phone unlocked.'); }
  }, []);
  const stop = useCallback(() => {
    active.current = false;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    window.removeEventListener('devicemotion', motionHandler);
    const sentinel = lock.current; lock.current = null;
    if (sentinel && !sentinel.released) void sentinel.release().catch(() => undefined);
    if (alive.current) setRunning(false);
  }, [motionHandler]);
  const start = useCallback(() => {
    if (active.current) return;
    if (!navigator.geolocation) { setError('GPS is unavailable in this browser.'); return; }
    active.current = true; setError(''); setRunning(true);
    void keepAwake();
    try {
      watch.current = navigator.geolocation.watchPosition(position => {
        if (!active.current) return;
        const c = position.coords;
        const number = (n: number | null) => n !== null && Number.isFinite(n) ? n : null;
        const point: GpsPoint = { lat: c.latitude, lng: c.longitude, accuracy: number(c.accuracy),
          speed: number(c.speed), heading: number(c.heading), altitude: number(c.altitude), timestamp: new Date(position.timestamp).toISOString() };
        setFix(point); setError(''); callbacks.current.onPoint(point, motion.current);
      }, cause => {
        if (!active.current) return;
        callbacks.current.onInterrupt();
        setError(cause.code === 1 ? 'Location permission denied. Enable precise location, then resume GPS.' : 'GPS interrupted or timed out. Retained samples are safe; move outside and wait for a new fix.');
        if (cause.code === 1) stop();
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    } catch { stop(); setError('GPS monitoring could not start. Retained samples are safe.'); }
  }, [keepAwake, stop]);
  const enableMotion = useCallback(async () => {
    if (!window.DeviceMotionEvent) { setMotionStatus('Motion sensors unavailable on this device.'); return; }
    const event = window.DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
    try {
      if (event.requestPermission && await event.requestPermission() !== 'granted') { setMotionStatus('Motion permission denied. GPS remains available.'); return; }
      if (!alive.current || !active.current) return;
      window.addEventListener('devicemotion', motionHandler);
      setMotionStatus('Motion enabled: mount phone with its top facing forward.');
    } catch { setMotionStatus('Motion permission unavailable. GPS remains available.'); }
  }, [motionHandler]);
  useEffect(() => {
    alive.current = true;
    const visibility = () => {
      if (!active.current) return;
      callbacks.current.onInterrupt();
      if (document.visibilityState === 'visible') void keepAwake();
      else setError('App hidden: GPS may pause. The incomplete lap is reset; completed laps and samples are retained.');
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (active.current) { event.preventDefault(); event.returnValue = ''; } };
    document.addEventListener('visibilitychange', visibility); window.addEventListener('beforeunload', beforeUnload);
    return () => { alive.current = false; stop(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('beforeunload', beforeUnload); };
  }, [keepAwake, stop]);
  return { fix, error, wake, running, start, stop, enableMotion, motionStatus };
}
