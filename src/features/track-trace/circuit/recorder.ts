import { detectStartFinishCrossing, getStartFinishLine } from './startFinishCrossing.ts';
import { createTelemetrySample, emptyMotionTelemetry, summarizeLapTelemetry } from './telemetryMath.ts';
import { filterSlowLaps } from './lapFiltering.ts';
import { calculateLapSectorTimes } from './sectorTiming.ts';
import { smoothLapTelemetry } from './telemetrySmoothing.ts';
import type { GpsPoint, SavedTrackMap } from './onlylapsTrackScanUtils.ts';
import type { CompletedLapDraft, LapTelemetrySample, MotionTelemetrySnapshot, SavedLapRecord, TrackSectorLayout } from './types.ts';

export interface RecordingTrack { map: SavedTrackMap; sectors: TrackSectorLayout | null; }
export class CircuitRecorder {
  readonly samples: LapTelemetrySample[] = [];
  readonly laps: CompletedLapDraft[] = [];
  previous: GpsPoint | null = null;
  lapStarted: string | null = null;
  direction: 1 | -1 | null = null;
  lastCrossing: string | null = null;
  lapNumber: number | null = null;
  currentSamples: LapTelemetrySample[] = [];
  interruptions = 0;
  readonly track: RecordingTrack | null;
  constructor(track: RecordingTrack | null) { this.track = track; }

  interrupt() {
    this.previous = null;
    this.lapStarted = null;
    this.lastCrossing = null;
    this.currentSamples = [];
    this.interruptions++;
  }

  add(point: GpsPoint, motion: MotionTelemetrySnapshot = emptyMotionTelemetry()): LapTelemetrySample | null {
    if (!Number.isFinite(point.lat) || Math.abs(point.lat) > 90 || !Number.isFinite(point.lng) || Math.abs(point.lng) > 180 || !Number.isFinite(Date.parse(point.timestamp))) return null;
    const previousTime = this.samples[this.samples.length - 1]?.timestamp;
    if (previousTime && Date.parse(point.timestamp) <= Date.parse(previousTime)) return null;
    if (previousTime && Date.parse(point.timestamp) - Date.parse(previousTime) > 10000) this.interrupt();
    const interruptionBefore = !this.previous && this.samples.length > 0;
    const line = getStartFinishLine(this.track?.map.start_finish_path ?? []);
    const crossing = line ? detectStartFinishCrossing(this.previous, point, line, {
      expectedDirection: this.direction, lastCrossingAt: this.lastCrossing, lastLapStartedAt: this.lapStarted,
    }) : null;
    if (crossing?.crossed && crossing.crossingTime) {
      if (!this.lapStarted) {
        this.lapStarted = crossing.crossingTime;
        this.lastCrossing = crossing.crossingTime;
        this.direction = crossing.direction;
        this.lapNumber = this.laps.length + 1;
        this.currentSamples = [];
      } else if (this.lapNumber) {
        const lapTimeMs = Date.parse(crossing.crossingTime) - Date.parse(this.lapStarted);
        this.laps.push({ lapNumber: this.lapNumber, startedAt: this.lapStarted, endedAt: crossing.crossingTime,
          lapTimeMs, isValid: true, excludedReason: null, ...summarizeLapTelemetry(this.currentSamples, lapTimeMs) });
        this.lapNumber++;
        this.currentSamples = [];
        this.lapStarted = crossing.crossingTime;
        this.lastCrossing = crossing.crossingTime;
      }
    }
    const sample = createTelemetrySample({ gpsPoint: point, motion, lapNumber: this.lapStarted ? this.lapNumber : null,
      sampleIndex: this.samples.length, trackId: this.track?.map.id ?? null });
    // Persist the boundary with the next real sample, including server recovery
    // when this device's separate interruption journal is no longer available.
    if (interruptionBefore) Object.assign(sample, { interruptionBefore: true });
    this.samples.push(sample);
    if (this.lapStarted) this.currentSamples.push(sample);
    this.previous = point;
    return sample;
  }

  finish(sessionId: string, userId: string) {
    return filterSlowLaps(this.laps).map(lap => {
      const record: SavedLapRecord = { ...lap, id: `lap-${lap.lapNumber}`, sessionId, userId,
        trackId: this.track?.map.id ?? null, createdAt: lap.endedAt };
      const sectors = this.track?.sectors ? calculateLapSectorTimes(record, this.samples, this.track.sectors) : [];
      const smoothing = smoothLapTelemetry({ samples: this.samples.filter(s => s.lapNumber === lap.lapNumber), track: this.track?.map ?? null, lapTimeMs: lap.lapTimeMs });
      return { ...lap, sectors, smoothingSummary: smoothing.summary };
    });
  }
}

export function samplePoint(sample: LapTelemetrySample): GpsPoint {
  return { lat: sample.latitude, lng: sample.longitude, timestamp: sample.timestamp, accuracy: sample.gpsAccuracy,
    speed: sample.speed, heading: sample.heading, altitude: sample.altitude };
}
