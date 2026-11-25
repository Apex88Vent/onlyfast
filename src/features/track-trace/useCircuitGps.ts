import { useCallback, useEffect, useRef, useState } from 'react';
import type { GpsPoint } from './circuit/onlylapsTrackScanUtils';
import { emptyMotionTelemetry, normalizeMotionTelemetry, normalizeOrientationTelemetry } from './circuit/telemetryMath';
import type { MotionTelemetrySnapshot, PhoneMountOrientation } from './circuit/types';

// Browser adapter for OnlyLaps' high-accuracy watch, motion normalization and
// wake-lock lifecycle. Permission is requested only by an explicit user action.
export function useCircuitGps(onPoint: (point: GpsPoint, motion: MotionTelemetrySnapshot) => void, onInterrupt: () => void, mountOrientation:PhoneMountOrientation='top_forward') {
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
  const [state,setState]=useState<'idle'|'requesting'|'active'|'stale'|'denied'|'error'>('idle');
  const [errorCode,setErrorCode]=useState<number|null>(null);
  const [motionSnapshot,setMotionSnapshot]=useState<MotionTelemetrySnapshot>(emptyMotionTelemetry);
  const [motionPermission,setMotionPermission]=useState<'idle'|'granted'|'denied'|'unsupported'>('idle');
  const lastMotionUi=useRef(0),lastFix=useRef<number|null>(null),watchStarted=useRef(0);
  const [motionStatus, setMotionStatus] = useState('Motion sensors not enabled; GPS remains available.');
  const motionHandler = useCallback((event: DeviceMotionEvent) => {
    motion.current = normalizeMotionTelemetry(event, motion.current, mountOrientation);
    if(Date.now()-lastMotionUi.current>=80){lastMotionUi.current=Date.now();setMotionSnapshot(motion.current);}
  }, [mountOrientation]);
  const orientationHandler=useCallback((event:DeviceOrientationEvent)=>{motion.current=normalizeOrientationTelemetry(event,motion.current);},[]);
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
    window.removeEventListener('deviceorientation',orientationHandler);
    motion.current=emptyMotionTelemetry();
    const sentinel = lock.current; lock.current = null;
    if (sentinel && !sentinel.released) void sentinel.release().catch(() => undefined);
    if (alive.current) {setRunning(false);setState('idle');setMotionSnapshot(motion.current);}
  }, [motionHandler,orientationHandler]);
  const start = useCallback(() => {
    if (active.current) return;
    if (!window.isSecureContext || !navigator.geolocation) { setState('error');setError('GPS requires a secure HTTPS page and location support. No location monitoring started.'); return; }
    active.current = true; setError('');setErrorCode(null);lastFix.current=null;watchStarted.current=Date.now();setFix(null);setState('requesting');setRunning(true);
    void keepAwake();
    try {
      watch.current = navigator.geolocation.watchPosition(position => {
        if (!active.current) return;
        const c = position.coords;
        if(!Number.isFinite(position.timestamp)){setState('error');setError('The location service returned an invalid timestamp. No sample was recorded.');return;}
        if(Date.now()-position.timestamp>10000){setState('stale');setError('The location service returned a stale GPS fix. Waiting for a current fix; no stale sample was recorded.');callbacks.current.onInterrupt();return;}
        const number = (n: number | null) => n !== null && Number.isFinite(n) ? n : null;
        const point: GpsPoint = { lat: c.latitude, lng: c.longitude, accuracy: number(c.accuracy),
          speed: number(c.speed), heading: number(c.heading), altitude: number(c.altitude), timestamp: new Date(position.timestamp).toISOString() };
        if(!Number.isFinite(point.lat)||Math.abs(point.lat)>90||!Number.isFinite(point.lng)||Math.abs(point.lng)>180||!Number.isFinite(position.timestamp)){
          setState('error');setError('The location service returned an invalid fix. It was not recorded.');return;
        }
        if(lastFix.current!==null&&position.timestamp<=lastFix.current)return;
        lastFix.current=position.timestamp;setState('active');setFix(point); setError('');setErrorCode(null);callbacks.current.onPoint(point, motion.current);
      }, cause => {
        if (!active.current) return;
        callbacks.current.onInterrupt();
        if (cause.code === 1) stop();
        setState(cause.code===1?'denied':'error');setErrorCode(cause.code);
        setError(cause.code === 1 ? 'Location permission denied. Enable precise location, then resume GPS.' : `GPS service error ${cause.code}: ${cause.message || 'Location unavailable or timed out'}. No new GPS fixes are being recorded. Retained samples are safe.`);
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    } catch { stop();setState('error');setError('GPS monitoring could not start. Retained samples are safe.'); }
  }, [keepAwake, stop]);
  const enableMotion = useCallback(async () => {
    if (!window.DeviceMotionEvent) {setMotionPermission('unsupported');setMotionStatus('Motion sensors unavailable on this device.'); return; }
    const event = window.DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
    try {
      const orientation=window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<string>};
      // Start both iOS permission requests inside the user's click gesture.
      const [motionResult,orientationResult]=await Promise.all([event.requestPermission?.()??'granted',orientation?.requestPermission?.()??'granted']);
      if(motionResult!=='granted'){setMotionPermission('denied');setMotionStatus('Motion permission denied. GPS remains available.');return;}
      if (!alive.current || !active.current) return;
      window.addEventListener('devicemotion', motionHandler);
      if(orientationResult==='granted')window.addEventListener('deviceorientation',orientationHandler);
      setMotionPermission('granted');setMotionStatus(`Motion enabled · phone orientation: ${mountOrientation.replace('_',' ')}.`);
    } catch {setMotionPermission('denied');setMotionStatus('Motion permission unavailable. GPS remains available.'); }
  }, [motionHandler,orientationHandler,mountOrientation]);
  useEffect(() => {
    alive.current = true;
    const visibility = () => {
      if (!active.current) return;
      if (document.visibilityState === 'visible') void keepAwake();
      else {callbacks.current.onInterrupt();setState('stale');setError('App hidden: GPS may pause. The incomplete lap is reset; completed laps and samples are retained.');}
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (active.current) { event.preventDefault(); event.returnValue = ''; } };
    document.addEventListener('visibilitychange', visibility); window.addEventListener('beforeunload', beforeUnload);
    const stale=window.setInterval(()=>{
      if(!active.current)return;
      if(lastFix.current===null&&Date.now()-watchStarted.current>10000){setState('error');setError('The GPS watch has returned no location fixes. Check precise-location permission, device location services and HTTPS. No GPS recording has been confirmed.');}
      else if(lastFix.current!==null&&Date.now()-lastFix.current>10000){setState('stale');callbacks.current.onInterrupt();lastFix.current=null;watchStarted.current=Date.now();setError('GPS signal stale. The incomplete lap has been reset; waiting for a current fix.');}
    },1000);
    return () => { alive.current = false; stop();window.clearInterval(stale);document.removeEventListener('visibilitychange', visibility); window.removeEventListener('beforeunload', beforeUnload); };
  }, [keepAwake, stop]);
  return {fix,error,wake,running,state,errorCode,watchId:watch.current,start,stop,enableMotion,motionStatus,motionSnapshot,motionPermission};
}
