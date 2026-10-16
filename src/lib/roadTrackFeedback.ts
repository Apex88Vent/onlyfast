export const ROAD_TRACK_ZONES = [
  { key: 'road_low_speed_entry', section: 'Low Speed Turn', label: 'Entry' },
  { key: 'road_low_speed_exit', section: 'Low Speed Turn', label: 'Exit' },
  { key: 'road_high_speed_entry', section: 'High Speed Turn', label: 'Entry' },
  { key: 'road_high_speed_exit', section: 'High Speed Turn', label: 'Exit' },
  { key: 'road_high_speed_s_turns', section: 'High Speed S Turns', label: 'Whole Section' },
  { key: 'road_straightaway', section: 'Straightaway', label: 'Straightaway' },
] as const;
export const ROAD_TRACK_KEYS = ROAD_TRACK_ZONES.map(zone => zone.key);
export const emptyRoadTrackFeedback = () => Object.fromEntries(ROAD_TRACK_KEYS.map(key => [key, '']));
export function roadHandlingOptions(key: string): readonly string[] {
  return key === 'road_straightaway' ? ['', 'over_geared', 'under_geared', 'perfect'] : ['', 'understeer', 'oversteer', 'perfect'];
}
export function readRoadHandling(key: string, value: unknown): string {
  return typeof value === 'string' && roadHandlingOptions(key).includes(value) ? value : '';
}
export function cycleRoadHandling(key: string, value: string): string {
  const options = roadHandlingOptions(key);
  return options[(options.indexOf(readRoadHandling(key, value)) + 1) % options.length];
}
export function roadHandlingLabel(value: string): string {
  return ({ understeer: 'Understeer', oversteer: 'Oversteer', perfect: 'Perfect', over_geared: 'Over Geared', under_geared: 'Under Geared' } as Record<string, string>)[value] || 'Tap to Set';
}
export function roadHandlingColor(value: string): string {
  return value === 'perfect' ? '#22C55E' : value === 'oversteer' || value === 'over_geared' ? '#EF4444' : value === 'understeer' || value === 'under_geared' ? '#3B82F6' : '#9CA3AF';
}
