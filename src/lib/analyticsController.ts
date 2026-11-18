export type ConsentState = 'unknown' | 'denied' | 'granted';
export type AnalyticsParams = Record<string, string | number | boolean>;
export interface AnalyticsSink {
  event(name: string, params: AnalyticsParams): void;
  screen(name: string): void;
  identity(id: string | null, properties: Record<string, string | null>): void;
  collection(enabled: boolean): void;
}

export const ANALYTICS_EVENTS = [
  'onboarding_started', 'onboarding_step_completed', 'onboarding_abandoned',
  'racing_discipline_selected', 'car_class_selected', 'subscription_plan_selected', 'onboarding_complete',
  'race_setup_created', 'race_setup_opened', 'race_setup_saved', 'race_setup_updated', 'race_setup_shared',
  'setup_assist_opened', 'setup_assist_requested', 'setup_assist_completed', 'setup_assist_failed', 'setup_assist_limit_reached',
  'timing_scan_opened', 'timing_scan_started', 'timing_scan_completed', 'timing_scan_failed',
  'race_schedule_opened', 'race_schedule_added', 'race_schedule_updated', 'race_schedule_exported',
  'upgrade_viewed', 'upgrade_started', 'upgrade_cancelled', 'house_upgrade_ad_viewed', 'house_upgrade_ad_clicked',
] as const;
export type AnalyticsEvent = typeof ANALYTICS_EVENTS[number];

const enums: Record<string, string[]> = {
  racing_discipline: ['dirt_oval', 'pavement_oval', 'road_course', 'motorcycle', 'rc'],
  subscription_tier: ['rookie', 'pro', 'team', 'sportsman', 'factory', 'unsubscribed'],
  scan_session_type: ['base', 'heat', 'main', 'extra1', 'extra2', 'extra3', 'unknown'],
  step: ['2', '3', '4'],
  placement: ['home_middle', 'home_bottom', 'setup_track_conditions', 'setup_dashboard_bottom', 'setup_session_bottom',
    'parts_reference_bottom', 'schedule_bottom', 'timing_scan_bottom', 'todo_bottom', 'after_save_interstitial'],
};

// Runtime allowlist as well as TS types: callers cannot accidentally send setup contents.
export function sanitizeAnalyticsParams(params: AnalyticsParams): AnalyticsParams {
  const clean: AnalyticsParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && enums[key]?.includes(value)) clean[key] = value;
    // Class membership is checked against the actual app registries in analytics.ts.
    if (key === 'car_class' && typeof value === 'string' && /^[a-zA-Z0-9_ ()/-]{1,40}$/.test(value)) clean[key] = value;
    if (key === 'telemetry_available' && typeof value === 'boolean') clean[key] = value;
    if (key === 'number_of_images' && Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100) clean[key] = value;
  }
  return clean;
}

/** No network waits in application actions. At most 30 pending events, never retried. */
export class AnalyticsController {
  private sink: AnalyticsSink | null = null;
  private enabled = false;
  private consent: ConsentState = 'unknown';
  private user: string | null = null;
  private properties: Record<string, string | null> = {};
  private queue: Array<() => void> = [];
  private seen = new Set<string>();
  private currentScreen = '';
  private safe(action: () => void) { try { action(); } catch { /* Analytics never interrupts the app. */ } }
  allowed() { return this.enabled && this.consent === 'granted'; }
  configure(enabled: boolean, consent: ConsentState) {
    this.enabled = enabled; this.consent = consent;
    if (!this.allowed()) { this.queue = []; this.seen.clear(); this.currentScreen = ''; }
    this.safe(() => {
      this.sink?.collection(false);
      this.sink?.identity(this.allowed() ? this.user : null, this.allowed() ? this.properties : {});
      this.sink?.collection(this.allowed());
    });
  }
  attach(sink: AnalyticsSink) {
    this.sink = sink;
    this.configure(this.enabled, this.consent);
    const pending = this.queue; this.queue = [];
    if (this.allowed()) pending.forEach(action => this.safe(action));
  }
  identify(id: string | null, properties: Record<string, string | null> = {}) {
    if (id === this.user && JSON.stringify(properties) === JSON.stringify(this.properties)) return;
    if (id !== this.user) { this.queue = []; this.seen.clear(); this.currentScreen = ''; }
    this.user = id; this.properties = properties;
    this.safe(() => {
      this.sink?.collection(false);
      this.sink?.identity(this.allowed() ? id : null, this.allowed() ? properties : {});
      this.sink?.collection(this.allowed());
    });
  }
  private dispatch(action: () => void) {
    if (!this.allowed()) return;
    if (this.sink) this.safe(action);
    else if (this.queue.length < 30) this.queue.push(action);
  }
  track(name: AnalyticsEvent, params: AnalyticsParams = {}, dedupeKey?: string) {
    if (!this.allowed() || !ANALYTICS_EVENTS.includes(name)) return;
    if (dedupeKey) {
      if (this.seen.has(dedupeKey)) return;
      if (this.seen.size >= 256) this.seen.delete(this.seen.values().next().value!);
      this.seen.add(dedupeKey);
    }
    const clean = sanitizeAnalyticsParams(params);
    this.dispatch(() => this.sink?.event(name, clean));
  }
  screen(name: string) {
    if (!this.allowed() || name === this.currentScreen) return;
    this.currentScreen = name;
    this.dispatch(() => this.sink?.screen(name));
  }
  screenName() { return this.currentScreen; }
}
