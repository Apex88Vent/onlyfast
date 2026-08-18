import { parsePerformancePosition } from './performanceSummary.ts';

export type ScheduleFinishSyncDecision =
  | { status: 'ready'; raceScheduleId: string; finishingPosition: string }
  | { status: 'not-main' | 'invalid-finish' | 'missing-schedule-id' };

const normalizedText = (value: unknown): string => String(value ?? '').trim();

export const buildScheduleFinishSyncDecision = (
  setupType: unknown,
  timingData: unknown,
  raceScheduleId: unknown,
): ScheduleFinishSyncDecision => {
  if (normalizedText(setupType) !== 'main') return { status: 'not-main' };
  const timing = timingData && typeof timingData === 'object'
    ? timingData as Record<string, unknown>
    : null;
  const finish = parsePerformancePosition(timing?.finishing_position);
  if (finish === null) return { status: 'invalid-finish' };
  const scheduleId = normalizedText(raceScheduleId);
  if (!scheduleId) return { status: 'missing-schedule-id' };
  return {
    status: 'ready',
    raceScheduleId: scheduleId,
    // race_schedule.finishing_position is a nullable text column.
    finishingPosition: String(finish),
  };
};

export const isBlankScheduleFinishingPosition = (value: unknown): boolean => {
  const normalized = normalizedText(value);
  return !normalized || normalized.toUpperCase() === 'TBD';
};
