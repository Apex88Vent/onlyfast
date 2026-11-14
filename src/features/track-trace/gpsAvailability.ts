// Adapted from Apex88Vent/OnlyLaps-app, commit
// 22f372508582fb43d56b66947c26740233bcdb19:
// lib/lap-session/lapSessionService.ts getCurrentHighAccuracyPosition/toPoint.
// One GPS fix only. This is not the lap recorder and never writes telemetry.
export interface TraceGpsFix { lat: number; lng: number; accuracy: number | null; timestamp: string; }

export function getTrackTraceGpsFix(geolocation: Pick<Geolocation, 'getCurrentPosition'> | undefined =
  typeof navigator !== 'undefined' ? navigator.geolocation : undefined): Promise<TraceGpsFix> {
  return new Promise((resolve, reject) => {
    if (!geolocation) { reject(new Error('GPS is not available in this browser.')); return; }
    geolocation.getCurrentPosition(position => resolve({
      lat: position.coords.latitude, lng: position.coords.longitude,
      accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      timestamp: new Date(position.timestamp).toISOString(),
    }), error => {
      if (error.code === 1) { reject(new Error('GPS permission denied. Allow precise location before starting a lap session.')); return; }
      reject(new Error('OnlyFast Track Trace could not get a precise GPS fix. Try again outside.'));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
  });
}
