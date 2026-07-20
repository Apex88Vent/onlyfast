import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import TrackInfoSection from './TrackInfoSection';
import ChassisSetupForm from './ChassisSetupForm';
import DirtOvalTrack from './DirtOvalTrack';
import HandlingFeedback from './HandlingFeedback';
import CustomFieldManager, { CustomField } from './CustomFieldManager';
import SavedSetups from './SavedSetups';
import SetupComparison from './SetupComparison';
import ShareSetupModal from './ShareSetupModal';
import ViewSharedSetupModal from './ViewSharedSetupModal';
import SaveSetupModal from './SaveSetupModal';
import CreateBaseSetupView from './CreateBaseSetupView';
import BaseTemplatePicker from './BaseTemplatePicker';
import TodoList from './TodoList';
import ScanTimingScreen from './ScanTimingScreen';
import TimingDataDisplay from './TimingDataDisplay';
import { attachTimingDataToSession, type TimingData } from '@/lib/timingData';
import { buildPerformanceSummary, parsePerformancePosition } from '@/lib/performanceSummary';
import PartsReference from './PartsReference';
import RaceSchedule from './RaceSchedule';
import HomeLanding, { HomeAction } from './HomeLanding';
import {
  getRaceCenterLabel,
  getRaceRolloverSelection,
  getScheduleRaceKey,
  getUpcomingScheduleEntries,
  sortScheduleEntriesByDate,
  type ScheduleRaceEntry,
} from '@/lib/scheduleSelection';
import { SAFE_BACK_DASHBOARD_EVENT, consumePendingSafeBackDashboardView } from '@/lib/safeBack';

import {
  enqueue as enqueuePending,
  readQueue as readPendingQueue,
  removeFromQueue as removePending,
  isNetworkError,
  PendingSave,
} from '@/lib/offlineQueue';
import { getAccountStatus } from '@/lib/subscription';
import {
  getEffectiveTier,
  readMembership,
  checkSavePermission,
  isRaceWeekendEditLocked,
} from '@/lib/membership';
import RookieAdSlot from './RookieAdSlot';
import { shouldShowAds } from '@/lib/ads';
import {
  createNewRaceWeekendSessions,
  DEFAULT_RACE_SESSION_ORDER,
  DEFAULT_RACE_SESSION_TYPES,
  isDefaultRaceSessionType,
  isGeneratedSessionPlaceholder,
  isValidSavedRaceSession,
  RACE_SESSION_TYPES,
  resolveSavedRaceWeekendSessions,
  type RaceSessionType,
  type RaceWeekendSessionRow,
} from '@/lib/raceWeekendSessions';



interface SetupDashboardProps {
  user: User | null;
  selectedCar: string;
  onSignInClick: () => void;
  onChangeClass: () => void;
  classLocksEnabled: boolean;
  onUpgrade: () => void;
}

const readCarNumber = (user: User | null | undefined, override?: string): string => {
  if (!user) return '';
  if (override !== undefined) return override;
  try {
    const local = localStorage.getItem(`car_number_override_${user.id}`);
    if (local !== null) return local;
  } catch {/* ignore */}
  const meta: any = user.user_metadata || {};
  return meta.car_number || '';
};

// A race day supports up to 6 sessions. The first 3 are the canonical defaults
// (Hot Laps / Heat / Main); the remaining 3 are optional user-added "extra"
// slots. setup_type stores this stable slot key (NOT the display label) so
// save/load/update/swipe never depend on the editable session name.
type SetupType = RaceSessionType;

// Default display names + canonical session_order for the built-in slots.
const TAB_LABELS: Record<SetupType, { full: string; short: string }> = {
  base: { full: 'Hot Laps Setup', short: 'Hot Laps' },
  heat: { full: 'Heat Setup', short: 'Heat' },
  main: { full: 'Main Event Setup', short: 'Main Event' },
  extra1: { full: '', short: '' },
  extra2: { full: '', short: '' },
  extra3: { full: '', short: '' },
};

// Every slot key, in canonical fallback order. session_order (when present)
// drives the real ordering; this is only the tie-break / default order.
const ALL_SLOTS: SetupType[] = [...RACE_SESSION_TYPES];
const DEFAULT_SESSION_SLOTS: SetupType[] = [...DEFAULT_RACE_SESSION_TYPES];
const MAX_SESSIONS = 6;
const FILE_PICKER_ACTIVE_KEY = 'onlyfast_file_picker_active';
const FILE_PICKER_STARTED_AT_KEY = 'onlyfast_file_picker_started_at';
const FILE_PICKER_ACTIVE_MS = 2 * 60 * 1000;

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

const isOnlyFastFilePickerOpen = (): boolean => {
  try {
    const globalActive = Boolean((window as any).__onlyfastFilePickerOpen);
    const storedActive = localStorage.getItem(FILE_PICKER_ACTIVE_KEY) === 'true';
    const startedAtRaw =
      localStorage.getItem(FILE_PICKER_STARTED_AT_KEY) ||
      String((window as any).__onlyfastFilePickerStartedAt || '');
    const startedAt = Number(startedAtRaw);

    if (!globalActive && !storedActive) return false;
    if (!Number.isFinite(startedAt) || Date.now() - startedAt >= FILE_PICKER_ACTIVE_MS) {
      try {
        localStorage.removeItem(FILE_PICKER_ACTIVE_KEY);
        localStorage.removeItem(FILE_PICKER_STARTED_AT_KEY);
        (window as any).__onlyfastFilePickerOpen = false;
        (window as any).__onlyfastFilePickerStartedAt = null;
      } catch {/* ignore */}
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

// Default session_order for the built-in slots (Hot Laps=1, Heat=2, Main=3).
const DEFAULT_ORDER: Record<SetupType, number> = {
  ...DEFAULT_RACE_SESSION_ORDER,
};

interface SetupState {
  [key: string]: string;
}


const emptySetup = (): SetupState => ({
  trackName: '',
  raceDate: new Date().toISOString().split('T')[0],
  raceClass: '',
  trackCondition: '',
  latitude: '',
  longitude: '',
  temperature: '',
  humidity: '',
  windSpeed: '',
  windDirection: '',
  cross_weight: '',
  toe: '',
  toe_direction: '',
  front_ride_height: '',
  rear_ride_height: '',
  stagger: '',
  rf_caster: '', rf_camber: '', rf_pressure: '', rf_shock: '', rf_spring: '', rf_wheel_offset: '', rf_cw_turns: '',
  lf_caster: '', lf_camber: '', lf_pressure: '', lf_shock: '', lf_spring: '', lf_wheel_offset: '', lf_cw_turns: '',
  lr_tire_size: '', lr_pressure: '', lr_shock: '', lr_spring: '', lr_wheel_offset: '', lr_cw_turns: '',
  rr_tire_size: '', rr_pressure: '', rr_shock: '', rr_spring: '', rr_wheel_offset: '', rr_cw_turns: '',
  lr_trailing_arm: '', rr_trailing_arm: '',
  third_link: '', panhard_bar: '', gear_ratio: '',
  notes: '',
  entry_handling: '',
  mid_handling: '',
  exit_handling: '',
  session_fastest_lap: '',
  session_slowest_lap: '',
  session_started: '',
  session_finished: '',
  top_wing_angle: '', top_wing_offset: '', nose_wing_angle: '',
  side_boards: '', nerf_bar_height: '',
  front_sprocket: '', rear_sprocket: '', chain_tension: '',
  front_axle: '', fuel_mixture: '', bumper_height: '',
  total_weight: '', left_side_pct: '', rear_weight_pct: '',
  lead_location: '', lead_weight: '',
  trackShape: '', trackLength: '',
  setup_name: '',

});

// A fresh, fully-keyed setups map (all 6 slots). Extra slots start blank and
// are only surfaced once the user adds them (they have a label / id / data).
const emptyAllSetups = (): Record<SetupType, SetupState> => ({
  base: emptySetup(),
  heat: emptySetup(),
  main: emptySetup(),
  extra1: emptySetup(),
  extra2: emptySetup(),
  extra3: emptySetup(),
});


const TAB_ORDER: SetupType[] = ['base', 'heat', 'main'];
const AUTOSAVE_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_HOME_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const STATE_STORAGE_KEY = 'onlyfast_setup_state_v2';
const LAST_ROUTE_STORAGE_KEY = 'onlyfast_last_route_v1';
const LAST_OPENED_SETUP_PREFIX = 'onlyfast_last_opened_setup_';
const ACTIVE_RACE_SELECTION_PREFIX = 'onlyfast_active_race_';

type DashboardView = 'home' | 'setup' | 'saved' | 'compare' | 'create-base' | 'todo' | 'parts' | 'schedule';

interface SavedDashboardRoute {
  view: DashboardView;
  activeTab?: SetupType;
  setupId?: string;
  timestamp: number;
}

const VALID_DASHBOARD_VIEWS: DashboardView[] = ['home', 'setup', 'saved', 'compare', 'create-base', 'todo', 'parts', 'schedule'];

const isDashboardView = (value: unknown): value is DashboardView =>
  typeof value === 'string' && VALID_DASHBOARD_VIEWS.includes(value as DashboardView);

const readSavedDashboardRoute = (): SavedDashboardRoute | null => {
  try {
    const raw = localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !isDashboardView(parsed.view) || typeof parsed.timestamp !== 'number') return null;
    const activeTab = ALL_SLOTS.includes(parsed.activeTab as SetupType) ? (parsed.activeTab as SetupType) : undefined;
    return {
      view: parsed.view,
      activeTab,
      setupId: typeof parsed.setupId === 'string' ? parsed.setupId : undefined,
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
};

const writeSavedDashboardRoute = (route: SavedDashboardRoute): void => {
  try {
    localStorage.setItem(LAST_ROUTE_STORAGE_KEY, JSON.stringify(route));
  } catch {}
};

// Single unified meta for the whole setup file (one name, separate DB ids per tab)
interface UnifiedSavedMeta {
  name?: string;
  ids: Partial<Record<SetupType, string>>;
}

type WeekendSessionStatus = 'complete' | 'in-progress' | 'not-started';
interface WeekendPreview {
  trackName?: string;
  date?: string;
  sessions?: {
    id?: string;
    label: string;
    status: WeekendSessionStatus;
  }[];
}

interface QueriedWeekendSessions {
  raceKey: string;
  rows: RaceWeekendSessionRow[];
  queryFailed?: boolean;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const cleanJsonValue = (value: unknown): unknown => {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(cleanJsonValue);
  if (value instanceof Date) return value.toISOString();
  if (!isPlainObject(value)) return null;

  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    acc[key] = cleanJsonValue(entry);
    return acc;
  }, {});
};

const cleanPayload = (payload: Record<string, unknown>) =>
  Object.entries(payload).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined) return acc;
    acc[key] = key === 'custom_fields' || key === 'timing_data' ? cleanJsonValue(value) : value;
    return acc;
  }, {});

const lastOpenedSetupKey = (userId: string) => `${LAST_OPENED_SETUP_PREFIX}${userId}`;

const SetupDashboard: React.FC<SetupDashboardProps> = ({
  user,
  selectedCar,
  onSignInClick,
  onChangeClass,
  classLocksEnabled,
  onUpgrade,
}) => {
  const [activeTab, setActiveTab] = useState<SetupType>('base');
  // Always keep ALL 6 slot keys present so reads like setups[activeTab] are never
  // undefined (extra slots stay blank until the user adds them).
  const [setups, setSetups] = useState<Record<SetupType, SetupState>>(emptyAllSetups);

  // Unified: one file name covers all three tabs, with DB ids stored per tab
  const [savedMeta, setSavedMeta] = useState<UnifiedSavedMeta>({ name: undefined, ids: {} });
  // Timing data is keyed by the durable race_setups row id, never by a display
  // tab or label. The selected session is fetched separately by that id.
  const [timingDataBySessionId, setTimingDataBySessionId] = useState<Record<string, TimingData | null>>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [saveMessage, setSaveMessage] = useState('');
  const [carNumberOverride, setCarNumberOverride] = useState<string | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [baseTemplateRefresh, setBaseTemplateRefresh] = useState(0);
  const [activeView, setActiveView] = useState<DashboardView>('home');

  const [savedSetupsList, setSavedSetupsList] = useState<any[]>([]);
  const [scheduleRows, setScheduleRows] = useState<any[]>([]);
  const [activatedRaceKey, setActivatedRaceKey] = useState('');
  const [scheduleToday, setScheduleToday] = useState(() => new Date());
  const [queriedWeekendSessions, setQueriedWeekendSessions] = useState<QueriedWeekendSessions | null>(null);
  const [showCopyFromPast, setShowCopyFromPast] = useState(false);
  const [shareModalSetup, setShareModalSetup] = useState<any>(null);
  // "View Shared Setup" modal (enter a share code to view a read-only setup).
  const [viewSharedOpen, setViewSharedOpen] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [baseTemplateMessage, setBaseTemplateMessage] = useState('');
  const [resumedBanner, setResumedBanner] = useState<string | null>(null);
  const [resumeAttempted, setResumeAttempted] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(() => {
    try { return readPendingQueue().length; } catch { return 0; }
  });
  const [draining, setDraining] = useState(false);

  // Save modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  // "New Setup" flow state
  const [newSetupPromptOpen, setNewSetupPromptOpen] = useState(false);
  const [saveThenClear, setSaveThenClear] = useState(false);

  // Per-session custom display labels (display only — does NOT change setup_type,
  // so the swipe system continues to work on the stable slot keys unchanged).
  const [sessionLabels, setSessionLabels] = useState<Partial<Record<SetupType, string>>>({});
  // Per-session stable ordering. Drives the horizontal selector + swipe order.
  // session_label is display-only; session_order is the ordering identifier.
  const [sessionOrders, setSessionOrders] = useState<Partial<Record<SetupType, number>>>({});
  const [deletedSessionSlots, setDeletedSessionSlots] = useState<Partial<Record<SetupType, boolean>>>({});
  const [addedSessionSlots, setAddedSessionSlots] = useState<Partial<Record<SetupType, boolean>>>({});


  // Active-session edit controls (pencil menu / rename / delete / add).
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [addSessionOpen, setAddSessionOpen] = useState(false);
  const [addSessionValue, setAddSessionValue] = useState('');
  const [addSessionError, setAddSessionError] = useState<string | null>(null);

  // Post-save full-page ad (rookie users only). Shown AFTER a successful save.
  const [showPostSaveAd, setShowPostSaveAd] = useState(false);
  const [classLockNoticeOpen, setClassLockNoticeOpen] = useState(false);
  // Whether ads should be shown to this user at all (rookie + logged in only).
  const adsEnabled = shouldShowAds(user);


  // Swipe animation state
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const orderedSessionsRef = useRef<SetupType[]>(DEFAULT_SESSION_SLOTS);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());
  const previousSelectedCarRef = useRef(selectedCar);

  const prefix = useId();
  const currentSetup = setups[activeTab];
  const carNumber = readCarNumber(user, carNumberOverride);
  const effectiveTier = getEffectiveTier(readMembership(user?.user_metadata || {}));
  const currentClassSaveRestricted = classLocksEnabled &&
    (currentSetup.raceClass || selectedCar).trim().toLowerCase() !== selectedCar.trim().toLowerCase();

  const prefersReducedMotion = (() => {
    try {
      return typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  })();

  const buildCurrentRoute = useCallback((): SavedDashboardRoute => {
    if (activeView === 'setup') {
      if (deletedSessionSlots[activeTab]) {
        return { view: 'home', timestamp: Date.now() };
      }
      return {
        view: 'setup',
        activeTab,
        setupId: savedMeta.ids[activeTab],
        timestamp: Date.now(),
      };
    }

    return { view: activeView, timestamp: Date.now() };
  }, [activeView, activeTab, deletedSessionSlots, savedMeta.ids]);

  const saveCurrentRoute = useCallback(() => {
    if (!stateLoaded || !resumeAttempted) return;
    if (isOnlyFastFilePickerOpen()) {
      devLog('route reset blocked', { source: 'saveCurrentRoute' });
      return;
    }
    writeSavedDashboardRoute(buildCurrentRoute());
  }, [buildCurrentRoute, resumeAttempted, stateLoaded]);

  // Load persisted state on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.setups) {
          // Merge persisted setups onto a fully-keyed (6-slot) base so extra
          // sessions survive a reload and no slot is ever undefined.
          const merged = emptyAllSetups();
          (Object.keys(merged) as SetupType[]).forEach(t => {
            if (parsed.setups[t]) merged[t] = { ...emptySetup(), ...parsed.setups[t] };
          });
          setSetups(merged);
        }
        // Restore per-session display labels and ordering for extra sessions.
        if (parsed.sessionLabels) setSessionLabels(parsed.sessionLabels);
        if (parsed.sessionOrders) setSessionOrders(parsed.sessionOrders);
        if (parsed.deletedSessionSlots) setDeletedSessionSlots(parsed.deletedSessionSlots);
        if (parsed.addedSessionSlots) setAddedSessionSlots(parsed.addedSessionSlots);
        if (parsed.savedMeta) {
          // Migrate older shape {base:{id,name},heat:{id,name},main:{id,name}} → unified
          if (parsed.savedMeta.ids !== undefined) {
            setSavedMeta(parsed.savedMeta);
          } else if (parsed.savedMeta.base || parsed.savedMeta.heat || parsed.savedMeta.main) {
            const name = parsed.savedMeta.base?.name || parsed.savedMeta.heat?.name || parsed.savedMeta.main?.name;
            setSavedMeta({
              name,
              ids: {
                base: parsed.savedMeta.base?.id,
                heat: parsed.savedMeta.heat?.id,
                main: parsed.savedMeta.main?.id,
              },
            });
          }
        }

      }
    } catch {}
    setStateLoaded(true);
  }, []);

  // Persist state on any change (only after initial load)
  useEffect(() => {
    if (!stateLoaded) return;
    try {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({
        setups, savedMeta, customFields, activeTab,
        // Persist extra-session metadata so they survive reloads.
        sessionLabels, sessionOrders, deletedSessionSlots, addedSessionSlots,
        timestamp: Date.now(),
      }));
    } catch {}
  }, [setups, savedMeta, customFields, activeTab, sessionLabels, sessionOrders, deletedSessionSlots, addedSessionSlots, stateLoaded]);

  useEffect(() => {
    if (!stateLoaded) return;
    const classChanged = previousSelectedCarRef.current &&
      previousSelectedCarRef.current.trim().toLowerCase() !== selectedCar.trim().toLowerCase();
    previousSelectedCarRef.current = selectedCar;

    if (classChanged) {
      const cleared = emptyAllSetups();
      (Object.keys(cleared) as SetupType[]).forEach(t => {
        cleared[t] = { ...cleared[t], raceClass: selectedCar };
      });
      setSetups(cleared);
      setSavedMeta({ name: '', ids: {} });
      setActiveTab('base');
      return;
    }
    // Apply the selected class to EVERY slot (including extra sessions) without
    // dropping any slot — spread prev so extra sessions are never wiped.
    setSetups(prev => {
      const next = { ...prev };
      (Object.keys(next) as SetupType[]).forEach(t => {
        next[t] = { ...next[t], raceClass: selectedCar || next[t].raceClass };
      });
      return next;
    });
  }, [selectedCar, stateLoaded, classLocksEnabled]);


  useEffect(() => {
    if (user) fetchSavedForCopy();
  }, [user, refreshTrigger]);

  useEffect(() => {
    setCarNumberOverride(readCarNumber(user));
  }, [user]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && user && detail.userId === user.id) {
        setCarNumberOverride(detail.carNumber || '');
      }
    };
    window.addEventListener('car-number-updated', handler);
    return () => window.removeEventListener('car-number-updated', handler);
  }, [user]);

  const loadScheduleRows = useCallback(async () => {
    if (!user) {
      setScheduleRows([]);
      return;
    }

    try {
      const currentSchema = await supabase
        .from('race_schedule')
        .select('id,race_date,race_end_date,track,organization,finishing_position')
        .eq('user_id', user.id)
        .order('race_date', { ascending: true });

      if (!currentSchema.error) {
        setScheduleRows(currentSchema.data || []);
        return;
      }

      // Keep existing accounts usable while the optional multi-day column is
      // rolling out. PostgREST returns schema errors instead of throwing them.
      const errorText = `${currentSchema.error.code || ''} ${currentSchema.error.message || ''}`;
      if (!/race_end_date|42703|pgrst204/i.test(errorText)) throw currentSchema.error;

      const legacySchema = await supabase
        .from('race_schedule')
        .select('id,race_date,track,organization,finishing_position')
        .eq('user_id', user.id)
        .order('race_date', { ascending: true });
      if (legacySchema.error) throw legacySchema.error;
      setScheduleRows((legacySchema.data || []).map(row => ({ ...row, race_end_date: null })));
    } catch {
      setScheduleRows([]);
    }
  }, [user]);

  useEffect(() => {
    void loadScheduleRows();
  }, [loadScheduleRows]);

  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleMidnightRefresh = () => {
      if (midnightTimer) clearTimeout(midnightTimer);
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 1, 0);
      midnightTimer = setTimeout(() => {
        setScheduleToday(new Date());
        scheduleMidnightRefresh();
      }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
    };
    const refreshLocalDate = () => setScheduleToday(new Date());
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshLocalDate();
    };

    scheduleMidnightRefresh();
    window.addEventListener('focus', refreshLocalDate);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      if (midnightTimer) clearTimeout(midnightTimer);
      window.removeEventListener('focus', refreshLocalDate);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setActivatedRaceKey('');
      return;
    }
    try {
      setActivatedRaceKey(localStorage.getItem(`${ACTIVE_RACE_SELECTION_PREFIX}${user.id}`) || '');
    } catch {
      setActivatedRaceKey('');
    }
  }, [user]);

  const selectedSessionId = savedMeta.ids[activeTab];

  useEffect(() => {
    if (!user || !selectedSessionId) return;
    let cancelled = false;

    setTimingDataBySessionId(prev => ({ ...prev, [selectedSessionId]: null }));
    (async () => {
      try {
        const { data, error } = await supabase
          .from('race_setups')
          .select('id,timing_data')
          .eq('user_id', user.id)
          .eq('id', selectedSessionId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) {
          setTimingDataBySessionId(prev => ({
            ...prev,
            [selectedSessionId]: attachTimingDataToSession(data?.timing_data, selectedSessionId),
          }));
        }
      } catch {
        if (!cancelled) {
          setTimingDataBySessionId(prev => ({ ...prev, [selectedSessionId]: null }));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user, selectedSessionId]);

  const fetchSavedForCopy = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('race_setups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) setSavedSetupsList(data);
    } catch {}
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.action) return;
      const a = detail.action;
      // 'view-shared' opens the read-only View Shared Setup modal — it is not a view.
      if (a === 'view-shared') {
        setViewSharedOpen(true);
        return;
      }
      if (a === 'home' || a === 'setup' || a === 'saved' || a === 'compare' || a === 'create-base' || a === 'todo' || a === 'parts' || a === 'schedule') {
        setActiveView(a);
      }
    };
    window.addEventListener('onlyfast-menu', handler);
    return () => window.removeEventListener('onlyfast-menu', handler);
  }, []);

  useEffect(() => {
    const applySafeBackView = (view: unknown) => {
      if (isDashboardView(view)) {
        setActiveView(view);
      }
    };

    applySafeBackView(consumePendingSafeBackDashboardView());

    const handler = (e: Event) => {
      applySafeBackView((e as CustomEvent).detail?.view);
    };

    window.addEventListener(SAFE_BACK_DASHBOARD_EVENT, handler);
    return () => window.removeEventListener(SAFE_BACK_DASHBOARD_EVENT, handler);
  }, []);

  useEffect(() => {
    const clearIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const blockForFilePicker = (source: string) => {
      if (!isOnlyFastFilePickerOpen()) return false;
      devLog(source.includes('resume') || source.includes('focus') || source.includes('visibility') || source.includes('pageshow')
        ? 'app resume/focus skipped because picker is active'
        : 'route reset blocked', { source });
      return true;
    };

    const sendHome = () => {
      if (blockForFilePicker('sendHome')) return;
      setActiveView('home');
    };

    const scheduleIdleTimer = () => {
      clearIdleTimer();
      idleTimerRef.current = setTimeout(sendHome, IDLE_HOME_TIMEOUT_MS);
    };

    const markActivity = () => {
      if (blockForFilePicker('markActivity')) return;
      lastActivityRef.current = Date.now();
      scheduleIdleTimer();
    };

    const handleResume = () => {
      if (blockForFilePicker('resume/focus')) {
        lastActivityRef.current = Date.now();
        scheduleIdleTimer();
        return;
      }
      const now = Date.now();
      if (now - lastActivityRef.current >= IDLE_HOME_TIMEOUT_MS) {
        sendHome();
      }
      lastActivityRef.current = now;
      scheduleIdleTimer();
    };

    const handleVisibilityChange = () => {
      if (blockForFilePicker('visibilitychange')) {
        if (document.visibilityState === 'visible') scheduleIdleTimer();
        return;
      }
      if (document.visibilityState === 'visible') {
        handleResume();
      } else {
        lastActivityRef.current = Date.now();
      }
    };

    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach(eventName => window.addEventListener(eventName, markActivity, { passive: true }));
    window.addEventListener('focus', handleResume);
    window.addEventListener('blur', markActivity);
    window.addEventListener('pageshow', handleResume);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleIdleTimer();

    return () => {
      clearIdleTimer();
      events.forEach(eventName => window.removeEventListener(eventName, markActivity));
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('blur', markActivity);
      window.removeEventListener('pageshow', handleResume);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Broadcast view changes so Header's menu highlights the right item
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('onlyfast-view-changed', { detail: { view: activeView } }));
  }, [activeView]);

  useEffect(() => {
    saveCurrentRoute();
  }, [saveCurrentRoute]);

  useEffect(() => {
    if (!stateLoaded || !resumeAttempted) return;

    const saveOnExit = () => {
      if (isOnlyFastFilePickerOpen()) {
        devLog('route reset blocked', { source: 'saveOnExit' });
        return;
      }
      saveCurrentRoute();
    };
    const saveOnVisibilityChange = () => {
      if (document.visibilityState === 'visible') return;
      if (isOnlyFastFilePickerOpen()) {
        devLog('route reset blocked', { source: 'saveOnVisibilityChange' });
        return;
      }
      saveCurrentRoute();
    };

    document.addEventListener('visibilitychange', saveOnVisibilityChange);
    window.addEventListener('pagehide', saveOnExit);
    window.addEventListener('beforeunload', saveOnExit);

    return () => {
      document.removeEventListener('visibilitychange', saveOnVisibilityChange);
      window.removeEventListener('pagehide', saveOnExit);
      window.removeEventListener('beforeunload', saveOnExit);
    };
  }, [resumeAttempted, saveCurrentRoute, stateLoaded]);

  // Carry-forward: when switching to heat/main, if that tab is essentially empty
  // (no chassis data), pre-fill it from the previous session (base→heat, heat→main).
  useEffect(() => {
    if (!stateLoaded) return;
    if (activeTab === 'base') return;
    const sourceTab: SetupType = activeTab === 'heat' ? 'base' : 'heat';
    const target = setups[activeTab];
    const source = setups[sourceTab];
    if (!source || !tabHasData(source)) return;
    // Consider chassis-relevant fields only — ignore handling/lap/finish fields so
    // we don't re-carry data after the user already used the tab.
    const ignoreKeys = new Set([
      'trackName', 'raceDate', 'raceClass', 'trackCondition',
      'latitude', 'longitude', 'temperature', 'humidity', 'windSpeed', 'windDirection',
      'entry_handling', 'mid_handling', 'exit_handling',
      'session_fastest_lap', 'session_slowest_lap',
      'session_started', 'session_finished',
      'notes', 'setup_name',
    ]);
    const targetHasChassis = Object.entries(target).some(([k, v]) => !ignoreKeys.has(k) && String(v || '').trim() !== '');
    if (targetHasChassis) return;
    setSetups(prev => ({
      ...prev,
      [activeTab]: {
        ...source,
        // Reset session-specific fields for the new session
        entry_handling: '',
        mid_handling: '',
        exit_handling: '',
        notes: prev[activeTab].notes || '',
        session_fastest_lap: '',
        session_slowest_lap: '',
        session_started: '',
        session_finished: '',
        setup_name: prev[activeTab].setup_name,
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, stateLoaded]);


  const handleChange = useCallback((field: string, value: string) => {
    setSetups(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [field]: value },
    }));
  }, [activeTab]);

  const handleSharedChange = useCallback((field: string, value: string) => {
    const sharedFields = ['trackName', 'raceDate', 'raceClass', 'trackCondition', 'trackShape', 'trackLength', 'latitude', 'longitude', 'temperature', 'humidity', 'windSpeed', 'windDirection'];

    if (sharedFields.includes(field)) {
      // Shared (race-day-wide) fields apply to EVERY slot, including extra
      // sessions. Spread prev so no slot is dropped.
      setSetups(prev => {
        const next = { ...prev };
        (Object.keys(next) as SetupType[]).forEach(t => {
          next[t] = { ...next[t], [field]: value };
        });
        return next;
      });
    } else {
      handleChange(field, value);
    }
  }, [handleChange]);


  const switchTab = useCallback((newTab: SetupType) => {
    if (newTab === activeTab || isAnimating) return;
    const navOrder = orderedSessionsRef.current.length ? orderedSessionsRef.current : ALL_SLOTS;
    const currentIdx = navOrder.indexOf(activeTab);
    const newIdx = navOrder.indexOf(newTab);
    const direction = newIdx > currentIdx ? 'left' : 'right';

    if (prefersReducedMotion) {
      setActiveTab(newTab);
      return;
    }

    setSlideDirection(direction);
    setIsAnimating(true);
    setTimeout(() => {
      setActiveTab(newTab);
      setSlideDirection(direction === 'left' ? 'right' : 'left');
      requestAnimationFrame(() => {
        setSlideDirection(null);
        setTimeout(() => { setIsAnimating(false); }, 300);
      });
    }, 250);
  }, [activeTab, isAnimating, prefersReducedMotion]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    const threshold = 80;
    if (Math.abs(diff) > threshold) {
      const navOrder = orderedSessionsRef.current.length ? orderedSessionsRef.current : ALL_SLOTS;
      const currentIdx = navOrder.indexOf(activeTab);
      if (diff > 0 && currentIdx >= 0 && currentIdx < navOrder.length - 1) {
        switchTab(navOrder[currentIdx + 1]);
      } else if (diff < 0 && currentIdx > 0) {
        switchTab(navOrder[currentIdx - 1]);
      }
    }
    setTouchStart(null);
  };

  const buildPayload = (s: SetupState, tabKey: SetupType, name?: string) => {
    const customFieldData: Record<string, string> = {};
    customFields.forEach(f => {
      const val = s[`custom_${f.id}`];
      if (val !== undefined && val !== null && String(val).trim() !== '') customFieldData[f.name] = val;
    });

    return {
      user_id: user!.id,
      setup_type: tabKey,
      setup_name: name || s.setup_name || null,
      session_label: sessionLabels[tabKey] || (isDefaultRaceSessionType(tabKey) ? TAB_LABELS[tabKey].short : null),
      session_order: sessionOrders[tabKey] ?? DEFAULT_ORDER[tabKey],

      track_name: s.trackName || '',
      race_date: s.raceDate || new Date().toISOString().split('T')[0],
      race_class: classLocksEnabled ? selectedCar : (s.raceClass || selectedCar),
      track_shape: s.trackShape || null,
      track_length: s.trackLength || null,

      track_condition: s.trackCondition || null,
      latitude: s.latitude ? parseFloat(s.latitude) : null,
      longitude: s.longitude ? parseFloat(s.longitude) : null,
      temperature: s.temperature ? parseFloat(s.temperature) : null,
      humidity: s.humidity ? parseFloat(s.humidity) : null,
      wind_speed: s.windSpeed ? parseFloat(s.windSpeed) : null,
      wind_direction: s.windDirection || null,
      cross_weight: s.cross_weight ? parseFloat(s.cross_weight) : null,
      toe: s.toe || null,
      toe_direction: s.toe_direction || null,
      front_ride_height: s.front_ride_height || null,
      rear_ride_height: s.rear_ride_height || null,
      stagger: s.stagger ? parseFloat(s.stagger) : null,
      rf_pressure: s.rf_pressure ? parseFloat(s.rf_pressure) : null,
      rf_shock: s.rf_shock || null,
      rf_spring: s.rf_spring || null,
      rf_caster: s.rf_caster ? parseFloat(s.rf_caster) : null,
      rf_camber: s.rf_camber ? parseFloat(s.rf_camber) : null,
      rf_wheel_offset: s.rf_wheel_offset || null,
      rf_cw_turns: s.rf_cw_turns || null,
      lf_pressure: s.lf_pressure ? parseFloat(s.lf_pressure) : null,
      lf_shock: s.lf_shock || null,
      lf_spring: s.lf_spring || null,
      lf_caster: s.lf_caster ? parseFloat(s.lf_caster) : null,
      lf_camber: s.lf_camber ? parseFloat(s.lf_camber) : null,
      lf_wheel_offset: s.lf_wheel_offset || null,
      lf_cw_turns: s.lf_cw_turns || null,
      lr_tire_size: s.lr_tire_size || null,
      lr_pressure: s.lr_pressure ? parseFloat(s.lr_pressure) : null,
      lr_shock: s.lr_shock || null,
      lr_spring: s.lr_spring || null,
      lr_wheel_offset: s.lr_wheel_offset || null,
      lr_cw_turns: s.lr_cw_turns || null,
      rr_tire_size: s.rr_tire_size || null,
      rr_pressure: s.rr_pressure ? parseFloat(s.rr_pressure) : null,
      rr_shock: s.rr_shock || null,
      rr_spring: s.rr_spring || null,
      rr_wheel_offset: s.rr_wheel_offset || null,
      rr_cw_turns: s.rr_cw_turns || null,
      lr_trailing_arm: s.lr_trailing_arm ? parseFloat(s.lr_trailing_arm) : null,
      rr_trailing_arm: s.rr_trailing_arm ? parseFloat(s.rr_trailing_arm) : null,
      third_link: s.third_link || null,
      panhard_bar: s.panhard_bar || null,
      gear_ratio: s.gear_ratio || null,
      entry_handling: s.entry_handling || null,
      mid_handling: s.mid_handling || null,
      exit_handling: s.exit_handling || null,
      custom_fields: Object.keys(customFieldData).length > 0 ? customFieldData : null,
      notes: s.notes || null,
      session_fastest_lap: s.session_fastest_lap || null,
      session_slowest_lap: s.session_slowest_lap || null,
    };
  };

  // Resilient DB write (handles missing columns gracefully)
  const dbInsert = async (payload: any) => {
    let p = cleanPayload(payload);
    for (let i = 0; i < 6; i++) {
      const { data, error } = await supabase.from('race_setups').insert(p).select().single();
      if (!error) return data;
      const match = error.message?.match(/column\s+"?(\w+)"?/i);
      if (match && match[1] && p[match[1]] !== undefined) {
        const { [match[1]]: _, ...rest } = p;
        p = rest;
        continue;
      }
      throw error;
    }
    throw new Error('Unable to save (schema mismatch).');
  };

  const dbUpdate = async (id: string, payload: any) => {
    let p = cleanPayload(payload);
    delete p.user_id;
    for (let i = 0; i < 6; i++) {
      const { data, error } = await supabase.from('race_setups').update(p).eq('id', id).select().single();
      if (!error) return data;
      const match = error.message?.match(/column\s+"?(\w+)"?/i);
      if (match && match[1] && p[match[1]] !== undefined) {
        const { [match[1]]: _, ...rest } = p;
        p = rest;
        continue;
      }
      throw error;
    }
    throw new Error('Unable to update (schema mismatch).');
  };

  // Does a given tab's setup state have enough data to be worth saving?
  // Null-safe: extra session slots may be undefined until the user adds them.
  const tabHasData = (s: SetupState | undefined | null): boolean => {
    if (!s) return false;
    return Object.entries(s).some(([k, v]) => {
      if (!v) return false;
      if (k === 'raceDate' || k === 'raceClass' || k === 'setup_name') return false;
      return String(v).trim() !== '';
    });
  };

  const sessionHasSpecificData = (s: SetupState | undefined | null): boolean => {
    if (!s) return false;
    const sharedRaceFields = new Set([
      'raceDate', 'raceClass', 'setup_name', 'trackName', 'trackCondition',
      'trackShape', 'trackLength', 'latitude', 'longitude', 'temperature',
      'humidity', 'windSpeed', 'windDirection',
    ]);

    return Object.entries(s).some(([key, value]) => {
      if (!value || sharedRaceFields.has(key)) return false;
      return String(value).trim() !== '';
    });
  };

  const sessionHasPayload = (t: SetupType) =>
    Boolean(
      sessionHasSpecificData(setups[t]) ||
      (savedMeta.ids[t] && timingDataBySessionId[savedMeta.ids[t]!])
    );

  const isRealSession = (t: SetupType) => {
    if (deletedSessionSlots[t]) return false;
    if (!savedMeta.name && DEFAULT_SESSION_SLOTS.includes(t)) return true;
    if (isDefaultRaceSessionType(t) && savedMeta.ids[t]) return true;
    const intentionalLabel = sessionLabels[t]?.trim();
    if (!intentionalLabel || isGeneratedSessionPlaceholder(intentionalLabel)) return false;
    return Boolean(savedMeta.ids[t] || addedSessionSlots[t] || sessionHasPayload(t));
  };


  // Drain the offline queue — POSTs each pending save in order
  const drainQueue = useCallback(async (): Promise<void> => {
    if (!user) return;
    const queue = readPendingQueue();
    if (queue.length === 0) { setPendingCount(0); return; }
    setDraining(true);
    try {
      for (const item of queue) {
        try {
          // Always force user_id to current user (in case it was queued before re-auth)
          const payload = { ...item.payload, user_id: user.id };
          let result: any;
          if (item.op === 'update' && item.rowId) {
            result = await dbUpdate(item.rowId, payload);
          } else {
            result = await dbInsert(payload);
          }
          // On success, update savedMeta id for that tab if it matches current name
          if (result?.id && item.setupName && item.setupName === savedMeta.name) {
            setSavedMeta(prev => ({
              name: prev.name,
              ids: { ...prev.ids, [item.setupType]: result.id },
            }));
          }
          removePending(item.id);
          setPendingCount(readPendingQueue().length);
        } catch (err: any) {
          if (isNetworkError(err)) {
            // Still offline — stop and leave the rest queued
            break;
          }
          // Non-network error (e.g. schema) — drop this item so it doesn't block others
          removePending(item.id);
          setPendingCount(readPendingQueue().length);
        }
      }
    } finally {
      setDraining(false);
    }
  }, [user, savedMeta.name]);

  // Listen for network reconnection and try to drain
  useEffect(() => {
    const handleOnline = () => { if (user) drainQueue(); };
    window.addEventListener('online', handleOnline);
    // On mount/user change, try once if there's already a queue
    if (user && readPendingQueue().length > 0) drainQueue();
    return () => window.removeEventListener('online', handleOnline);
  }, [user, drainQueue]);

  // Save ALL three tabs as one "setup file" under a single name.
  const performSave = async (name: string, silent = false) => {
    if (!user) {
      onSignInClick();
      return null;
    }

    // -------------------------------------------------------------------
    // CENTRALIZED TIER ENFORCEMENT (uses tierLimits via checkSavePermission).
    // The effective tier already resolves test@test.com / admin → 'team', so
    // those accounts bypass every check below automatically. Real users keep
    // their normal Rookie/Pro/Team restrictions.
    // -------------------------------------------------------------------
    const tier = effectiveTier;
    if (tier !== 'team') {
      try {
        // Pull a lightweight snapshot of the user's existing race-weekend rows
        // so we can count saves / car types and check the 48h edit lock.
        const { data: summaryRows, error: summaryError } = await supabase.rpc('list_user_setup_summaries');
        let existingRows = Array.isArray(summaryRows) ? summaryRows : [];
        if (summaryError) {
          const { data } = await supabase
            .from('race_setups')
            .select('setup_name, setup_type, race_class, created_at')
            .eq('user_id', user.id)
            .limit(300);
          existingRows = data || [];
        }

        const rows = (existingRows || []).filter(
          (r: any) => (r.setup_type || 'base') !== 'base_template'
        );

        const raceWeekendNames = new Set(
          rows
            .map((r: any) => (r.setup_name || '').trim())
            .filter((n: string) => n !== '')
        );
        // Car-type lock must consider EVERY saved car type for this user —
        // race-weekend saves (base/heat/main) AND base templates. Counting only
        // race-weekend rows here was the bug that let a Pro user save one car
        // type as a race weekend and a different car type as a base template.
        const existingCarTypes = Array.from(
          new Set(
            (existingRows || [])
              .map((r: any) => (r.race_class || '').trim())
              .filter(Boolean)
          )
        ) as string[];


        // A "new" race weekend = a file name we haven't stored before.
        const fileExists = raceWeekendNames.has(name.trim());
        const newCarType = currentSetup.raceClass || selectedCar || '';

        const perm = checkSavePermission({
          tier,
          kind: 'race_weekend',
          isExistingSave: fileExists,
          existingRaceWeekendCount: raceWeekendNames.size,
          existingBaseSetupCount: 0,
          existingCarTypes,
          newCarType,
        });
        if (!perm.allowed) {
          if (!silent) {
            if (perm.reason === 'car_type_locked') {
              setClassLockNoticeOpen(true);
            } else {
              setSaveMessage(perm.upgradeText);
              setTimeout(() => setSaveMessage(''), 8000);
            }
          }
          setSaving(false);
          return null;
        }

        // 48-HOUR EDIT LOCK (Rookie): existing saves older than the lock window
        // can no longer be EDITED. They remain viewable + deletable elsewhere.
        if (fileExists) {
          const fileRows = rows.filter(
            (r: any) => (r.setup_name || '').trim() === name.trim()
          );
          const earliest = fileRows
            .map((r: any) => r.created_at)
            .filter(Boolean)
            .sort()[0];
          if (isRaceWeekendEditLocked(tier, earliest)) {
            if (!silent) {
              setSaveMessage(
                'This race weekend is locked (over 48 hours old) and can no longer be edited on the Rookie plan. It stays viewable and can still be deleted. Upgrade to Pro to remove the 48-hour lock.'
              );
              setTimeout(() => setSaveMessage(''), 8000);
            }
            setSaving(false);
            return null;
          }
        }
      } catch {
        if (!silent) {
          setSaveMessage('Could not verify your saved car classes. Please try again.');
          setTimeout(() => setSaveMessage(''), 5000);
        }
        setSaving(false);
        return null;
      }
    }

    setSaving(true);
    if (!silent) setSaveMessage('');
    try {
      const isRename = savedMeta.name && savedMeta.name.trim() !== name.trim();
      const newIds: Partial<Record<SetupType, string>> = {};
      let queuedAny = false;

      const saveTabs = ALL_SLOTS.filter(tabKey => {
        if (deletedSessionSlots[tabKey]) return false;
        if (isRealSession(tabKey)) return true;
        return !savedMeta.name && tabKey === activeTab && tabHasData(setups[tabKey]);
      });

      for (const tabKey of saveTabs) {
        const setup = setups[tabKey];
        const existingId = savedMeta.ids[tabKey];
        if (!tabHasData(setup) && !existingId && !isRealSession(tabKey)) continue;

        const payload = buildPayload(setup, tabKey, name);
        try {
          let result: any;
          if (existingId) {
            result = await dbUpdate(existingId, payload);
          } else {
            result = await dbInsert(payload);
          }
          newIds[tabKey] = result.id;
        } catch (err: any) {
          if (isNetworkError(err)) {
            // Queue it for later
            enqueuePending({
              op: existingId ? 'update' : 'insert',
              rowId: existingId || undefined,
              setupType: tabKey,
              setupName: name,
              payload,
            });
            queuedAny = true;
            // Preserve existing id if any so UI still shows linkage
            if (existingId) newIds[tabKey] = existingId;
          } else {
            throw err;
          }
        }
      }

      setSavedMeta({ name, ids: { ...savedMeta.ids, ...newIds } });
      const rememberedId = newIds[activeTab] || savedMeta.ids[activeTab] || Object.values(newIds)[0] || Object.values(savedMeta.ids)[0];
      if (rememberedId) {
        try { localStorage.setItem(lastOpenedSetupKey(user.id), String(rememberedId)); } catch {}
      }
      setSetups(prev => {
        const next = { ...prev };
        (Object.keys(next) as SetupType[]).forEach(t => { next[t] = { ...next[t], setup_name: name }; });
        return next;
      });

      setRefreshTrigger(prev => prev + 1);
      const mainSessionId = newIds.main || savedMeta.ids.main;
      await syncMainEventResultToSchedule(mainSessionId ? timingDataBySessionId[mainSessionId] : null);
      setPendingCount(readPendingQueue().length);
      if (!silent) {
        if (queuedAny) {
          setSaveMessage(`Offline — "${name}" will sync when you reconnect`);
        } else {
          const wasUpdate = savedMeta.name && !isRename;
          setSaveMessage(wasUpdate ? `Updated "${name}"` : `Saved "${name}"`);
        }
        setTimeout(() => setSaveMessage(''), 4000);
      }
      return true;
    } catch (err: any) {
      setSaveMessage('Error saving: ' + (err.message || 'Unknown error'));
      return null;
    } finally {
      setSaving(false);
    }
  };



  // Save button → open the save modal. Logged-in users on ANY plan (including
  // Rookie/free) may save; the centralized tier check inside performSave decides
  // whether each save is allowed and surfaces an upgrade prompt if a limit is hit.
  const handleSaveClick = async () => {
    if (!user) {
      // First-save by an unregistered user: ask them to sign in before saving.
      try { localStorage.setItem('pending_plan_redirect', '1'); } catch {}
      onSignInClick();
      return;
    }
    if (currentClassSaveRestricted) {
      setClassLockNoticeOpen(true);
      return;
    }
    setSaveModalOpen(true);
  };



  const handleSaveModalSubmit = async (name: string) => {
    const result = await performSave(name);
    if (result) {
      setSaveModalOpen(false);
      // If this save was triggered by "New Setup" flow, clear afterwards
      if (saveThenClear) {
        setSaveThenClear(false);
        doClearAllTabs();
      }
      // Post-save interstitial ad — rookie users only, AFTER a successful save.
      // Never shown on failure (result is falsy) and never blocks the save.
      if (adsEnabled) setShowPostSaveAd(true);
    }
  };

  const handleSaveModalClose = () => {
    setSaveModalOpen(false);
    // If user cancels while in saveThenClear flow, abort the clear
    if (saveThenClear) setSaveThenClear(false);
  };

  // Autosave every 5 minutes, only if we've named the file at least once
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (savedMeta.name) {
        performSave(savedMeta.name, true).then((r) => {
          if (r) setLastAutoSave(new Date());
        });
      }
    }, AUTOSAVE_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, savedMeta, setups, customFields]);

  const handleShareCurrent = async () => {
    if (!user) {
      onSignInClick();
      return;
    }
    if (!savedMeta.name) {
      setSaveMessage('Save this setup before sharing.');
      setSaveModalOpen(true);
      setTimeout(() => setSaveMessage(''), 5000);
      return;
    }

    setSaving(true);
    try {
      const saved = await performSave(savedMeta.name);
      if (!saved) {
        setSaving(false);
        return;
      }

      let query = supabase
        .from('race_setups')
        .select('*')
        .eq('user_id', user.id);

      const existingId = savedMeta.ids[activeTab];
      if (existingId) {
        query = query.eq('id', existingId);
      } else {
        query = query
          .eq('setup_name', savedMeta.name)
          .eq('setup_type', activeTab)
          .order('created_at', { ascending: false })
          .limit(1);
      }

      const { data: result, error } = await query.maybeSingle();
      if (error) throw error;
      if (!result) throw new Error('Save this session before sharing.');
      setRefreshTrigger(prev => prev + 1);
      setShareModalSetup(result);
    } catch (err: any) {
      setSaveMessage('Error: ' + (err.message || 'Unknown error'));
    }
    setSaving(false);
  };

  const loadSetupIntoState = (setup: any): SetupState => {
    return {
      trackName: setup.track_name || '',
      raceDate: setup.race_date || '',
      raceClass: setup.race_class || '',
      trackShape: setup.track_shape || '',
      trackLength: setup.track_length || '',

      trackCondition: setup.track_condition || '',
      latitude: setup.latitude?.toString() || '',
      longitude: setup.longitude?.toString() || '',
      temperature: setup.temperature?.toString() || '',
      humidity: setup.humidity?.toString() || '',
      windSpeed: setup.wind_speed?.toString() || '',
      windDirection: setup.wind_direction || '',
      cross_weight: setup.cross_weight?.toString() || '',
      toe: setup.toe || '',
      toe_direction: setup.toe_direction || '',
      front_ride_height: setup.front_ride_height?.toString() || '',
      rear_ride_height: setup.rear_ride_height?.toString() || '',
      stagger: setup.stagger?.toString() || '',
      rf_caster: setup.rf_caster?.toString() || '',
      rf_camber: setup.rf_camber?.toString() || '',
      rf_pressure: setup.rf_pressure?.toString() || '',
      rf_shock: setup.rf_shock || '',
      rf_spring: setup.rf_spring?.toString() || '',
      rf_wheel_offset: setup.rf_wheel_offset || '',
      rf_cw_turns: setup.rf_cw_turns || '',
      lf_caster: setup.lf_caster?.toString() || '',
      lf_camber: setup.lf_camber?.toString() || '',
      lf_pressure: setup.lf_pressure?.toString() || '',
      lf_shock: setup.lf_shock || '',
      lf_spring: setup.lf_spring?.toString() || '',
      lf_wheel_offset: setup.lf_wheel_offset || '',
      lf_cw_turns: setup.lf_cw_turns || '',
      lr_tire_size: setup.lr_tire_size || '',
      lr_pressure: setup.lr_pressure?.toString() || '',
      lr_shock: setup.lr_shock || '',
      lr_spring: setup.lr_spring?.toString() || '',
      lr_wheel_offset: setup.lr_wheel_offset || '',
      lr_cw_turns: setup.lr_cw_turns || '',
      rr_tire_size: setup.rr_tire_size || '',
      rr_pressure: setup.rr_pressure?.toString() || '',
      rr_shock: setup.rr_shock || '',
      rr_spring: setup.rr_spring?.toString() || '',
      rr_wheel_offset: setup.rr_wheel_offset || '',
      rr_cw_turns: setup.rr_cw_turns || '',
      lr_trailing_arm: setup.lr_trailing_arm?.toString() || '',
      rr_trailing_arm: setup.rr_trailing_arm?.toString() || '',
      third_link: setup.third_link || '',
      panhard_bar: setup.panhard_bar || '',
      gear_ratio: setup.gear_ratio || '',
      entry_handling: setup.entry_handling || '',
      mid_handling: setup.mid_handling || '',
      exit_handling: setup.exit_handling || '',
      notes: setup.notes || '',
      session_fastest_lap: setup.session_fastest_lap || '',
      session_slowest_lap: setup.session_slowest_lap || '',
      setup_name: setup.setup_name || '',
      top_wing_angle: '', top_wing_offset: '', nose_wing_angle: '',
      side_boards: '', nerf_bar_height: '',
      front_sprocket: '', rear_sprocket: '', chain_tension: '',
      front_axle: '', fuel_mixture: '', bumper_height: '',
      total_weight: '', left_side_pct: '', rear_weight_pct: '',
      lead_location: '', lead_weight: '',
    };
  };

  // Load the whole "file" — all rows sharing the same setup_name
  const handleLoadSetup = async (setup: any) => {
    if (
      classLocksEnabled &&
      String(setup?.race_class || '').trim().toLowerCase() !== selectedCar.trim().toLowerCase()
    ) {
      setClassLockNoticeOpen(true);
      return;
    }
    if (user && setup?.id) {
      try { localStorage.setItem(lastOpenedSetupKey(user.id), String(setup.id)); } catch {}
    }
    const name = setup.setup_name || setup.track_name || '';
    // Fully-keyed (6-slot) so extra slots are present but blank.
    const newSetups: Record<SetupType, SetupState> = emptyAllSetups();
    const newIds: Partial<Record<SetupType, string>> = {};
    const newLabels: Partial<Record<SetupType, string>> = {};
    const newOrders: Partial<Record<SetupType, number>> = {};
    const loadedSavedSessions: Partial<Record<SetupType, boolean>> = {};

    const loadSiblingRow = (row: any) => {
      if (!isValidSavedRaceSession(row as RaceWeekendSessionRow)) return;
      const t = ALL_SLOTS.includes(row.setup_type as SetupType) ? (row.setup_type as SetupType) : 'base';
      if (!ALL_SLOTS.includes(t)) return;
      if (newIds[t]) return; // prefer clicked/first-loaded row per slot
      newSetups[t] = loadSetupIntoState(row);
      newIds[t] = row.id;
      if (row.session_label) newLabels[t] = row.session_label;
      if (row.session_order) newOrders[t] = Number(row.session_order);
      loadedSavedSessions[t] = true;
    };

    // Seed at least the clicked row
    const clickedType = ALL_SLOTS.includes(setup.setup_type as SetupType) ? (setup.setup_type as SetupType) : 'base';
    loadSiblingRow(setup);

    if (Array.isArray(setup.__groupSetups)) {
      [...setup.__groupSetups]
        .sort((a, b) => {
          const aType = ALL_SLOTS.includes(a.setup_type as SetupType) ? (a.setup_type as SetupType) : 'base';
          const bType = ALL_SLOTS.includes(b.setup_type as SetupType) ? (b.setup_type as SetupType) : 'base';
          return Number(a.session_order ?? DEFAULT_ORDER[aType]) - Number(b.session_order ?? DEFAULT_ORDER[bType]);
        })
        .forEach(loadSiblingRow);
    }

    // Fetch the exact race weekend so the page and landing card resolve the same rows.
    if (user && name) {
      try {
        let siblingQuery = supabase
          .from('race_setups')
          .select('*')
          .eq('user_id', user.id);
        if (setup.race_date && setup.track_name) {
          siblingQuery = siblingQuery
            .eq('race_date', setup.race_date)
            .eq('track_name', setup.track_name);
        } else {
          siblingQuery = siblingQuery.eq('setup_name', name);
        }
        const { data } = await siblingQuery.order('created_at', { ascending: false });
        if (data) {
          for (const row of data) {
            loadSiblingRow(row);
          }
        }
      } catch {}
    }

    // Apply custom fields from clicked row
    if (setup.custom_fields) {
      Object.entries(setup.custom_fields).forEach(([key, value]) => {
        const existing = customFields.find(f => f.name === key);
        if (existing) {
          newSetups[clickedType][`custom_${existing.id}`] = value as string;
        }
      });
    }

    setSetups(newSetups);
    setSavedMeta({ name, ids: newIds });
    setTimingDataBySessionId({});
    setSessionLabels(newLabels);
    setSessionOrders(newOrders);
    setDeletedSessionSlots({});
    setAddedSessionSlots(loadedSavedSessions);
    const displayable = ALL_SLOTS
      .filter(t =>
        !!newIds[t] && (
          t === clickedType ||
          loadedSavedSessions[t] ||
          (newLabels[t] && newLabels[t] !== TAB_LABELS[t].short) ||
          sessionHasSpecificData(newSetups[t])
        )
      )
      .sort((a, b) => (newOrders[a] ?? DEFAULT_ORDER[a]) - (newOrders[b] ?? DEFAULT_ORDER[b]));
    setActiveTab(displayable.includes(clickedType) ? clickedType : (displayable[0] || clickedType));
    setActiveView('setup');
  };



  // Called by ScanTimingScreen after it successfully writes timing_data
  // back to race_setups. Refreshes the visible TimingDataDisplay card for the
  // tab whose setup row was just updated.
  const syncMainEventResultToSchedule = useCallback(async (timingData?: TimingData | null) => {
    if (!user || !timingData) return;
    const finish = parsePerformancePosition(timingData.finishing_position);
    if (finish === null) return;

    const raceDate = setups.main?.raceDate;
    const trackName = setups.main?.trackName?.trim();
    if (!raceDate || !trackName) return;

    const finishText = String(finish);
    try {
      const { data, error } = await supabase
        .from('race_schedule')
        .update({ finishing_position: finishText, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('race_date', raceDate)
        .ilike('track', trackName)
        .select('id,race_date,track,finishing_position');

      if (error || !data || data.length === 0) return;

      const updatedById = new Map((data as { id: string; race_date: string; track: string; finishing_position: string | null }[]).map(row => [row.id, row]));
      setScheduleRows(prev => prev.map(row => updatedById.has(row.id) ? { ...row, ...updatedById.get(row.id) } : row));
    } catch {
      // Schedule sync is best-effort; never block saving setup/timing data.
    }
  }, [user, setups.main?.raceDate, setups.main?.trackName]);

  const handleTimingDataSaved = useCallback((setupId: string, timingData: any) => {
    const sessionTiming = attachTimingDataToSession(timingData, setupId);
    setTimingDataBySessionId(prev => ({ ...prev, [setupId]: sessionTiming }));
    const tab = (Object.keys(savedMeta.ids) as SetupType[])
      .find(t => savedMeta.ids[t] === setupId);
    if (!tab) return;
    if (tab === 'main') {
      void syncMainEventResultToSchedule(sessionTiming);
    }
  }, [savedMeta.ids, syncMainEventResultToSchedule]);


  const handleCopyLastSetup = () => {
    const sourceTab: SetupType = activeTab === 'heat' ? 'base' : activeTab === 'main' ? 'heat' : 'base';
    const source = setups[sourceTab];
    setSetups(prev => ({
      ...prev,
      [activeTab]: {
        ...source,
        entry_handling: '',
        mid_handling: '',
        exit_handling: '',
        notes: '',
        session_fastest_lap: '',
        session_slowest_lap: '',
        setup_name: prev[activeTab].setup_name,
      },
    }));
  };

  const handleCopyFromPastSetup = (setup: any) => {
    const loaded = loadSetupIntoState(setup);
    const current = setups[activeTab];
    setSetups(prev => ({
      ...prev,
      [activeTab]: {
        ...loaded,
        trackName: current.trackName,
        raceDate: current.raceDate,
        raceClass: current.raceClass,
        trackCondition: current.trackCondition,
        latitude: current.latitude,
        longitude: current.longitude,
        temperature: current.temperature,
        humidity: current.humidity,
        windSpeed: current.windSpeed,
        windDirection: current.windDirection,
        entry_handling: '',
        mid_handling: '',
        exit_handling: '',
        session_fastest_lap: '',
        session_slowest_lap: '',
        setup_name: current.setup_name,
      },
    }));
    setShowCopyFromPast(false);
  };

  // Apply a base template to the Hot Laps setup
  const handleApplyBaseTemplate = (template: any) => {
    const loaded = loadSetupIntoState(template);
    if (template.custom_fields) {
      Object.entries(template.custom_fields).forEach(([key, value]) => {
        const existing = customFields.find(f => f.name === key);
        if (existing) loaded[`custom_${existing.id}`] = value as string;
      });
    }
    const current = setups.base;
    setSetups(prev => ({
      ...prev,
      base: {
        ...loaded,
        trackName: current.trackName,
        raceDate: current.raceDate,
        raceClass: current.raceClass || loaded.raceClass,
        trackCondition: current.trackCondition,
        latitude: current.latitude,
        longitude: current.longitude,
        temperature: current.temperature,
        humidity: current.humidity,
        windSpeed: current.windSpeed,
        windDirection: current.windDirection,
        entry_handling: '',
        mid_handling: '',
        exit_handling: '',
        session_fastest_lap: '',
        session_slowest_lap: '',
        setup_name: current.setup_name,
      },
    }));
    const tplName = (template.setup_name || 'Base Template').replace(/^\[BASE TEMPLATE\]\s*/, '');
    setBaseTemplateMessage(`Applied base template: ${tplName}`);
    setTimeout(() => setBaseTemplateMessage(''), 4000);
    setActiveTab('base');
    setActiveView('setup');
  };

  const doClearAllTabs = () => {
    const today = new Date().toISOString().split('T')[0];
    // Reset to a fully-keyed (6-slot) blank workspace so extra session slots are
    // never left undefined.
    const cleared = emptyAllSetups();
    (Object.keys(cleared) as SetupType[]).forEach(t => {
      cleared[t] = { ...cleared[t], raceClass: selectedCar, raceDate: today };
    });
    setSetups(cleared);
    setSavedMeta({ name: undefined, ids: {} });
    setTimingDataBySessionId({});
    setSessionLabels({});
    setSessionOrders({});
    setDeletedSessionSlots({});
    setAddedSessionSlots({});
    setActiveTab('base');
    setActiveView('setup');
  };



  // Does the current workspace have any data worth prompting to save?
  const workspaceHasData = (): boolean => {
    return (['base', 'heat', 'main'] as SetupType[]).some(t => tabHasData(setups[t]));
  };

  // "New Setup" — offer to save first
  const handleNewSetupClick = () => {
    // If already on setup view and workspace is empty, just ensure we're clean
    if (!workspaceHasData() && !savedMeta.name) {
      setDeletedSessionSlots({});
      setAddedSessionSlots({});
      setActiveView('setup');
      return;
    }
    setNewSetupPromptOpen(true);
  };

  const handleNewSetupSaveFirst = () => {
    setNewSetupPromptOpen(false);
    if (!user) {
      onSignInClick();
      return;
    }
    setSaveThenClear(true);
    setSaveModalOpen(true);
  };

  const handleNewSetupDiscard = () => {
    setNewSetupPromptOpen(false);
    doClearAllTabs();
  };

  const handleClearSetup = () => {
    const label = labelForTab(activeTab);
    if (!confirm(`Clear the ${label} tab?`)) return;
    setSetups(prev => ({
      ...prev,
      [activeTab]: { ...emptySetup(), raceClass: selectedCar, raceDate: new Date().toISOString().split('T')[0], setup_name: prev[activeTab].setup_name },
    }));
  };

  // ---- Per-session label + management (active session page) ----------------
  // Display label for a tab: custom label wins, else the canonical short name.
  const labelForTab = (t: SetupType) =>
    sessionLabels[t]?.trim() || (isDefaultRaceSessionType(t) ? TAB_LABELS[t].short : '');
  const fullLabelForTab = (t: SetupType) =>
    sessionLabels[t]?.trim() || (isDefaultRaceSessionType(t) ? TAB_LABELS[t].full : '');

  // Does a tab represent an existing session? Defaults are real; blank extra
  // slots are not, even if older state gave them a generated placeholder name.
  const sessionExists = (t: SetupType) => {
    return isRealSession(t);
  };

  // Display saved race-day sessions only when they are real sessions. This keeps
  // deleted default sessions from reappearing as gray/blank tabs, and hides old
  // polluted standby rows that have no user data and no intentional label.
  const isDisplayableSession = (t: SetupType) => {
    return sessionExists(t);
  };

  // Open the pencil menu's Rename option.
  const openRenameSession = () => {
    setSessionMenuOpen(false);
    setRenameValue(labelForTab(activeTab));
    setRenameError(null);
    setRenameOpen(true);
  };

  const submitRenameSession = async () => {
    const name = renameValue.trim();
    if (!name) { setRenameError('Session name cannot be empty.'); return; }
    // Prevent duplicate names within this race day (other active tabs).
    const dup = ALL_SLOTS.some(
      t => t !== activeTab && isDisplayableSession(t) && labelForTab(t).toLowerCase() === name.toLowerCase()
    );
    if (dup) { setRenameError('A session with that name already exists for this race day.'); return; }

    // Update label in state (display only — setup data untouched).
    setSessionLabels(prev => ({ ...prev, [activeTab]: name }));
    // Persist immediately if this session already has a saved DB row.
    const id = savedMeta.ids[activeTab];
    if (id) {
      try {
        await dbUpdate(id, { session_label: name });
        setRefreshTrigger(prev => prev + 1);
      } catch {}
    }
    setRenameOpen(false);
  };

  // Delete the currently active session only.
  const openDeleteSession = () => {
    setSessionMenuOpen(false);
    setDeleteOpen(true);
  };

  const clearSessionSlot = (tab: SetupType, markDeleted = true) => {
    const sessionId = savedMeta.ids[tab];
    setSetups(prev => ({
      ...prev,
      [tab]: { ...emptySetup(), raceClass: selectedCar },
    }));
    setSavedMeta(prev => {
      const ids = { ...prev.ids };
      delete ids[tab];
      return { name: prev.name, ids };
    });
    setSessionLabels(prev => {
      const next = { ...prev };
      delete next[tab];
      return next;
    });
    setAddedSessionSlots(prev => {
      const next = { ...prev };
      delete next[tab];
      return next;
    });
    setSessionOrders(prev => {
      const next = { ...prev };
      delete next[tab];
      return next;
    });
    setTimingDataBySessionId(prev => {
      const next = { ...prev };
      if (sessionId) delete next[sessionId];
      return next;
    });
    setDeletedSessionSlots(prev => {
      const next = { ...prev };
      if (markDeleted) next[tab] = true;
      else delete next[tab];
      return next;
    });
  };

  const submitDeleteSession = async () => {
    setDeleteBusy(true);
    const deletedTab = activeTab;
    const deletedId = savedMeta.ids[deletedTab];
    if (deletedId) {
      if (!user) {
        setDeleteBusy(false);
        setDeleteOpen(false);
        setSaveMessage('Error deleting session: Please sign in and try again');
        setTimeout(() => setSaveMessage(''), 5000);
        return;
      }
      try {
        const { error } = await supabase
          .from('race_setups')
          .delete()
          .eq('id', deletedId)
          .eq('user_id', user.id);
        if (error) throw error;
      } catch (err: any) {
        setDeleteBusy(false);
        setDeleteOpen(false);
        setSaveMessage('Error deleting session: ' + (err?.message || 'Please try again'));
        setTimeout(() => setSaveMessage(''), 5000);
        return;
      }
    }

    const deletedOrder = orderOf(deletedTab);
    const remaining = ALL_SLOTS.filter(
      t => t !== deletedTab && isDisplayableSession(t)
    ).sort((a, b) => orderOf(a) - orderOf(b));
    const replacement =
      remaining.find(t => orderOf(t) > deletedOrder) ||
      remaining[remaining.length - 1];


    setDeleteBusy(false);
    setDeleteOpen(false);
    setDeletedSessionSlots(prev => ({ ...prev, [deletedTab]: true }));
    if (deletedId) {
      setSavedSetupsList(prev => prev.filter(setup => setup.id !== deletedId));
    }
    setRefreshTrigger(prev => prev + 1);

    if (remaining.length === 0) {
      // Last real session: clear the saved race-day container completely.
      const cleared = emptyAllSetups();
      (Object.keys(cleared) as SetupType[]).forEach(t => {
        cleared[t] = { ...cleared[t], raceClass: selectedCar };
      });
      setSetups(cleared);
      setSavedMeta({ name: undefined, ids: {} });
      setTimingDataBySessionId({});
      setSessionLabels({});
      setSessionOrders({});
      setAddedSessionSlots({});
      setDeletedSessionSlots({});
      setActiveTab('base');
      setActiveView('setup');
      setSaveMessage('Session deleted');
      setTimeout(() => setSaveMessage(''), 4000);
      return;
    }

    // Clear just this slot and move to another available real session.
    clearSessionSlot(deletedTab, true);
    if (replacement) setActiveTab(replacement);
  };

  // Add a new session (plus button in the horizontal selector).
  const openAddSession = () => {
    setSessionMenuOpen(false);
    setAddSessionValue('');
    setAddSessionError(null);
    setAddSessionOpen(true);
  };

  const submitAddSession = () => {
    const name = addSessionValue.trim();
    if (!name) { setAddSessionError('Session name cannot be empty.'); return; }
    const dup = ALL_SLOTS.some(
      t => isDisplayableSession(t) && labelForTab(t).toLowerCase() === name.toLowerCase()
    );
    if (dup) { setAddSessionError('A session with that name already exists for this race day.'); return; }

    // Enforce the 6-session-per-race-day maximum.
    if (ALL_SLOTS.filter(t => isDisplayableSession(t)).length >= MAX_SESSIONS) {
      setAddSessionError('Maximum of 6 sessions reached for this race day.');
      return;
    }

    // Find a free stable slot key so the new session joins the menu at the end.
    const extraSlots = ALL_SLOTS.filter(t => !DEFAULT_SESSION_SLOTS.includes(t));
    const freeType =
      extraSlots.find(t => !isDisplayableSession(t)) ||
      DEFAULT_SESSION_SLOTS.find(t => deletedSessionSlots[t] && !isDisplayableSession(t)) ||
      ALL_SLOTS.find(t => !isDisplayableSession(t));
    if (!freeType) {
      setAddSessionError('Maximum of 6 sessions reached for this race day.');
      return;
    }

    // Next available session_order (max existing order + 1, capped at 6).
    const existingOrders = ALL_SLOTS.filter(t => isDisplayableSession(t)).map(t => orderOf(t));
    const nextOrder = (existingOrders.length ? Math.max(...existingOrders) : 0) + 1;

    // New blank session sharing this race day's metadata (track/date/class).
    const today = new Date().toISOString().split('T')[0];
    setSetups(prev => ({
      ...prev,
      [freeType]: {
        ...emptySetup(),
        trackName: currentSetup.trackName,
        raceDate: currentSetup.raceDate || today,
        raceClass: currentSetup.raceClass || selectedCar,
        trackCondition: currentSetup.trackCondition,
        latitude: currentSetup.latitude,
        longitude: currentSetup.longitude,
        temperature: currentSetup.temperature,
        humidity: currentSetup.humidity,
        windSpeed: currentSetup.windSpeed,
        windDirection: currentSetup.windDirection,
        setup_name: currentSetup.setup_name,
      },
    }));
    setSessionLabels(prev => ({ ...prev, [freeType]: name }));
    setSessionOrders(prev => ({ ...prev, [freeType]: nextOrder }));
    setAddedSessionSlots(prev => ({ ...prev, [freeType]: true }));
    setDeletedSessionSlots(prev => {
      const next = { ...prev };
      delete next[freeType];
      return next;
    });
    setAddSessionOpen(false);
    // Make the new session active so it joins the swipe view immediately.
    setActiveTab(freeType);
  };



  // The session_order for a slot: explicit value wins, else the canonical default.
  const orderOf = (t: SetupType) => sessionOrders[t] ?? DEFAULT_ORDER[t];

  // The sessions that actually exist for this race day, ordered by session_order.
  // Saved race days render only real persisted/user-created sessions; brand-new
  // unsaved workspaces still start with the normal Hot Laps / Heat / Main tabs.
  const shouldShowDefaultSessions = !savedMeta.name;
  const orderedSessions: SetupType[] = ALL_SLOTS
    .filter(t =>
      isDisplayableSession(t) ||
      (shouldShowDefaultSessions && DEFAULT_SESSION_SLOTS.includes(t) && !deletedSessionSlots[t]) ||
      (t === activeTab && isDisplayableSession(t))
    )
    .sort((a, b) => orderOf(a) - orderOf(b));
  const orderedSessionKey = orderedSessions.join('|');
  orderedSessionsRef.current = orderedSessions;

  useEffect(() => {
    if (!stateLoaded || resumeAttempted) return;
    let cancelled = false;

    const finish = (view: DashboardView, tab?: SetupType) => {
      if (cancelled) return;
      if (tab) setActiveTab(tab);
      setActiveView(view);
      setResumeAttempted(true);
    };

    const restoreSavedRoute = async () => {
      const savedRoute = readSavedDashboardRoute();
      if (!savedRoute || Date.now() - savedRoute.timestamp >= IDLE_HOME_TIMEOUT_MS) {
        finish('home');
        return;
      }

      if (savedRoute.view !== 'setup') {
        finish(savedRoute.view);
        return;
      }

      const targetTab = savedRoute.activeTab && ALL_SLOTS.includes(savedRoute.activeTab)
        ? savedRoute.activeTab
        : activeTab;

      if (deletedSessionSlots[targetTab]) {
        finish('home');
        return;
      }

      if (savedRoute.setupId) {
        if (!user) {
          finish('home');
          return;
        }

        try {
          const { data } = await supabase
            .from('race_setups')
            .select('id,setup_type')
            .eq('user_id', user.id)
            .eq('id', savedRoute.setupId)
            .maybeSingle();

          if (!data) {
            finish('home');
            return;
          }

          const dbTab = ALL_SLOTS.includes(data.setup_type as SetupType)
            ? (data.setup_type as SetupType)
            : targetTab;
          finish('setup', dbTab);
          return;
        } catch {
          const localFallbackIsValid =
            savedMeta.ids[targetTab] === savedRoute.setupId ||
            orderedSessions.includes(targetTab) ||
            tabHasData(setups[targetTab]);
          finish(localFallbackIsValid ? 'setup' : 'home', localFallbackIsValid ? targetTab : undefined);
          return;
        }
      }

      const localSetupRouteIsValid =
        !savedMeta.name ||
        orderedSessions.includes(targetTab) ||
        tabHasData(setups[targetTab]);

      finish(localSetupRouteIsValid ? 'setup' : 'home', localSetupRouteIsValid ? targetTab : undefined);
    };

    restoreSavedRoute();

    return () => {
      cancelled = true;
    };
  }, [activeTab, orderedSessionKey, resumeAttempted, savedMeta.name, setups, stateLoaded, user, deletedSessionSlots]);

  useEffect(() => {
    if (activeView !== 'setup') return;
    if (isOnlyFastFilePickerOpen()) {
      devLog('route reset blocked', { source: 'activeTabCorrection' });
      return;
    }
    if (orderedSessions.length > 0 && !orderedSessions.includes(activeTab)) {
      setActiveTab(orderedSessions[0]);
    }
  }, [activeView, activeTab, orderedSessionKey]);


  const tabs = orderedSessions.map((key, idx) => ({
    key,
    label: fullLabelForTab(key),
    shortLabel: labelForTab(key),
    icon: String(idx + 1),
  }));

  // Whether another session can still be added (max 6 per race day).
  const sessionCount = orderedSessions.length;
  const canAddSession = sessionCount < MAX_SESSIONS;


  const getAnimationClass = () => {
    if (prefersReducedMotion || !slideDirection) return 'translate-x-0 opacity-100';
    if (slideDirection === 'left') return '-translate-x-8 opacity-0';
    if (slideDirection === 'right') return 'translate-x-8 opacity-0';
    return 'translate-x-0 opacity-100';
  };

  const defaultSaveName = () => {
    const parts: string[] = [];
    if (currentSetup.trackName) parts.push(currentSetup.trackName);
    if (currentSetup.raceDate) parts.push(currentSetup.raceDate);
    return parts.join(' - ') || 'Setup';
  };

  const existingSessionCount = orderedSessions.filter(t => tabHasData(setups[t]) || !!savedMeta.ids[t]).length;
  const sessionStatus = (t: SetupType) => {
    if (setups[t]?.session_finished) return 'complete' as const;
    const sessionId = savedMeta.ids[t];
    if (setups[t]?.session_started || tabHasData(setups[t]) || sessionId || (sessionId && timingDataBySessionId[sessionId])) return 'in-progress' as const;
    return 'not-started' as const;
  };
  const currentWeekendSessions = orderedSessions;
  const activeWeekend = (() => {
    const source = setups[activeTab] || setups.base;
    const hasCurrentWeekend = Boolean(savedMeta.name) || existingSessionCount > 0;
    if (!hasCurrentWeekend) return null;

    return {
      trackName: source.trackName || savedMeta.name,
      date: source.raceDate,
      sessions: currentWeekendSessions.map(t => ({
        id: savedMeta.ids[t],
        label: labelForTab(t),
        status: sessionStatus(t),
      })),
    };
  })();
  const raceNavigation = getRaceRolloverSelection(scheduleRows, scheduleToday);
  const centerRaceDate = raceNavigation.center?.race_date || '';
  const centerRaceTrack = String(raceNavigation.center?.track || '').trim();
  const centerRaceQueryKey = raceNavigation.center
    ? `${centerRaceDate}|${centerRaceTrack.toLowerCase()}`
    : '';

  useEffect(() => {
    if (!user || !centerRaceQueryKey || !centerRaceDate || !centerRaceTrack) {
      setQueriedWeekendSessions(null);
      return;
    }

    let cancelled = false;
    setQueriedWeekendSessions(prev => prev?.raceKey === centerRaceQueryKey ? prev : null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('race_setups')
          .select('*')
          .eq('user_id', user.id)
          .eq('race_date', centerRaceDate)
          .eq('track_name', centerRaceTrack)
          .order('session_order', { ascending: true })
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (!cancelled) {
          setQueriedWeekendSessions({
            raceKey: centerRaceQueryKey,
            rows: (data || []) as RaceWeekendSessionRow[],
          });
        }
      } catch {
        if (!cancelled) setQueriedWeekendSessions({ raceKey: centerRaceQueryKey, rows: [], queryFailed: true });
      }
    })();

    return () => { cancelled = true; };
  }, [centerRaceDate, centerRaceQueryKey, centerRaceTrack, refreshTrigger, user]);

  const exactSavedWeekendSessions = queriedWeekendSessions?.raceKey === centerRaceQueryKey && !queriedWeekendSessions.queryFailed
    ? (
        queriedWeekendSessions.rows.length === 0
          ? createNewRaceWeekendSessions()
          : resolveSavedRaceWeekendSessions(queriedWeekendSessions.rows)
      )
    : null;
  const withholdGeneratedDefaults = Boolean(
    user && centerRaceQueryKey && (
      queriedWeekendSessions?.raceKey !== centerRaceQueryKey ||
      queriedWeekendSessions.queryFailed
    )
  );
  const defaultWeekendSessions = createNewRaceWeekendSessions()
    .map(session => ({ label: session.label, status: session.status }));
  const activeWeekendMatchesCenter = Boolean(
    raceNavigation.center &&
    activeWeekend &&
    activeWeekend.date === raceNavigation.center.race_date &&
    String(activeWeekend.trackName || '').trim().toLowerCase() === String(raceNavigation.center.track || '').trim().toLowerCase()
  );
  const activeStatusBySessionId = new Map(
    (activeWeekendMatchesCenter ? activeWeekend?.sessions : [])
      ?.filter(session => Boolean(session.id))
      .map(session => [session.id as string, session.status]) || []
  );
  const exactWeekendPreviewSessions = exactSavedWeekendSessions?.map(session => ({
    id: session.id || undefined,
    label: session.label,
    status: (session.id && activeStatusBySessionId.get(session.id)) || session.status,
  }));
  const currentWeekend = raceNavigation.center
    ? {
        trackName: raceNavigation.center.track || '',
        date: raceNavigation.center.race_date || '',
        sessions:
          exactWeekendPreviewSessions ||
          (activeWeekendMatchesCenter ? activeWeekend?.sessions : undefined) ||
          (withholdGeneratedDefaults ? [] : defaultWeekendSessions),
      }
    : activeWeekend;
  const currentWeekendTitle = 'Current Race Weekend' as const;
  const centerRaceLabel = getRaceCenterLabel(raceNavigation, activatedRaceKey);
  const upcomingEvents = getUpcomingScheduleEntries(scheduleRows, scheduleToday)
    .slice(0, 3)
    .map(r => ({
      id: r.id,
      track: r.track,
      date: r.race_date,
      endDate: r.race_end_date || undefined,
      organization: r.organization || undefined,
    }));
  const nextEvent = upcomingEvents[0] || null;
  const performanceStats = buildPerformanceSummary(scheduleRows, savedSetupsList);

  const openLastSavedSetup = async () => {
    if (!user) {
      setActiveView('saved');
      return;
    }

    const key = lastOpenedSetupKey(user.id);
    const lastId = (() => {
      try { return localStorage.getItem(key); } catch { return null; }
    })();

    if (lastId) {
      try {
        const { data } = await supabase
          .from('race_setups')
          .select('*')
          .eq('user_id', user.id)
          .eq('id', lastId)
          .maybeSingle();
        if (data) {
          await handleLoadSetup(data);
          return;
        }
        const { data: lockState } = await supabase.rpc('get_setup_class_lock_state', { p_setup_id: lastId });
        if ((lockState as any)?.locked) {
          setClassLockNoticeOpen(true);
          return;
        }
        try { localStorage.removeItem(key); } catch {}
      } catch {
        setActiveView('saved');
        return;
      }
    }

    try {
      const { data } = await supabase
        .from('race_setups')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);
      const fallback = (data || []).find((row: any) =>
        row.setup_type !== 'base_template' &&
        !String(row.setup_name || '').trim().toUpperCase().startsWith('[BASE TEMPLATE]')
      );
      if (fallback) {
        await handleLoadSetup(fallback);
        return;
      }
    } catch {}

    setActiveView('saved');
  };

  const setupMatchesScheduleRace = (setup: SetupState | undefined, race: ScheduleRaceEntry) => {
    const track = (race.track || '').trim().toLowerCase();
    if (!setup || !track || !race.race_date) return false;
    return setup.raceDate === race.race_date && setup.trackName.trim().toLowerCase() === track;
  };

  const openScheduledRaceWeekend = async (race?: ScheduleRaceEntry | null) => {
    const track = (race?.track || '').trim();
    const raceDate = race?.race_date || '';
    if (!race || !track || !raceDate) {
      setActiveView('schedule');
      return;
    }

    const currentMatch = ALL_SLOTS.find(t => isDisplayableSession(t) && setupMatchesScheduleRace(setups[t], race));
    if (currentMatch) {
      setActiveTab(currentMatch);
      setActiveView('setup');
      return;
    }

    if (user) {
      try {
        const { data } = await supabase
          .from('race_setups')
          .select('*')
          .eq('user_id', user.id)
          .eq('race_date', raceDate)
          .eq('track_name', track)
          .order('updated_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(20);
        const resolvedSessions = resolveSavedRaceWeekendSessions((data || []) as RaceWeekendSessionRow[]);
        const existing = resolvedSessions[0]?.row;
        if (existing) {
          await handleLoadSetup({
            ...existing,
            __groupSetups: resolvedSessions.map(session => session.row).filter(Boolean),
          });
          return;
        }
      } catch {
        // Fall through to a local prefilled setup if lookup fails.
      }
    }

    const prefilled = emptyAllSetups();
    DEFAULT_SESSION_SLOTS.forEach(t => {
      prefilled[t] = {
        ...prefilled[t],
        trackName: track,
        raceDate,
        raceClass: selectedCar,
      };
    });
    setSetups(prefilled);
    setSavedMeta({ name: undefined, ids: {} });
    setTimingDataBySessionId({});
    setSessionLabels({});
    setSessionOrders({});
    setDeletedSessionSlots({});
    setAddedSessionSlots({});
    setActiveTab('base');
    setActiveView('setup');
  };

  const activateScheduledRace = (race?: ScheduleRaceEntry | null) => {
    if (!race || !user) return;
    const key = getScheduleRaceKey(race);
    if (!key) return;
    setActivatedRaceKey(key);
    try { localStorage.setItem(`${ACTIVE_RACE_SELECTION_PREFIX}${user.id}`, key); } catch {/* ignore */}
  };

  const handleHomeAction = async (action: HomeAction) => {
    if (action === 'new-setup') {
      handleNewSetupClick();
      return;
    }

    if (action === 'previous-race') {
      await openScheduledRaceWeekend(raceNavigation.previous);
      return;
    }

    if (action === 'current-race') {
      if (raceNavigation.center) {
        activateScheduledRace(raceNavigation.center);
        await openScheduledRaceWeekend(raceNavigation.center);
      } else {
        await openLastSavedSetup();
      }
      return;
    }

    if (action === 'next-race') {
      await openScheduledRaceWeekend(raceNavigation.next);
      return;
    }

    if (action === 'saved' || action === 'library') {
      if (action === 'saved') {
        await openLastSavedSetup();
        return;
      }
      setActiveView('saved');
      return;
    }

    if (action === 'schedule' || action === 'todo' || action === 'parts') {
      setActiveView(action);
    }
  };

  // Diff highlighting compares against the immediately previous real session.
  const activeSessionIndex = orderedSessions.indexOf(activeTab);
  const previousSessionForDiff = activeSessionIndex > 0 ? orderedSessions[activeSessionIndex - 1] : undefined;
  const previousSetupForDiff = previousSessionForDiff ? setups[previousSessionForDiff] : undefined;
  const baseSetupForDiff =
    previousSetupForDiff && sessionHasSpecificData(previousSetupForDiff)
      ? previousSetupForDiff
      : undefined;
  const baseLabelForDiff = previousSessionForDiff ? labelForTab(previousSessionForDiff) : 'previous session';

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Sub Navigation — stacked: row 1 = views, row 2 = setup type (only on setup view) */}
      <nav className={`bg-white border-b border-[#E5E7EB] sticky top-16 z-40 ${activeView === 'home' ? 'hidden' : ''}`} aria-label="Dashboard navigation">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          {/* Row 1: View tabs */}
          <div className="flex gap-0.5 sm:gap-1 py-2 flex-wrap" role="tablist" aria-label="View selection">
            <button
              role="tab"
              aria-selected={activeView === 'setup'}
              onClick={handleNewSetupClick}
              className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] ${
                activeView === 'setup' ? 'bg-[#00A8E8] text-white' : 'text-[#6B7280] hover:text-[#1A1B23] hover:bg-[#F5F5F7]'
              }`}
              title="Start a new setup (prompts to save current)"
            >
              <span className="inline-flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Setup
              </span>
            </button>
            {/* Saved Setups and Create Base Setup moved to the main hamburger menu */}

            <button
              role="tab"
              aria-selected={activeView === 'compare'}
              onClick={() => setActiveView('compare')}
              className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] ${
                activeView === 'compare' ? 'bg-[#00A8E8] text-white' : 'text-[#6B7280] hover:text-[#1A1B23] hover:bg-[#F5F5F7]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="hidden sm:block">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Compare
            </button>
          </div>

          {/* Row 2: Hot Laps / Heat / Main — only when on setup view */}
          {activeView === 'setup' && tabs.length > 0 && (
            <div className="flex gap-0.5 sm:gap-1 pb-2 border-t border-[#F0F0F2] pt-2" role="tablist" aria-label="Setup type selection">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => switchTab(tab.key)}
                  className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-[#F5F5F7] text-[#1A1B23] shadow-sm border border-[#E5E7EB]'
                      : 'text-[#6B7280] hover:text-[#1A1B23] hover:bg-[#F5F5F7]'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 ${
                    activeTab === tab.key ? 'bg-[#00A8E8] text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'
                  }`} aria-hidden="true">
                    {tab.icon}
                  </span>
                  <span className="sm:inline">{labelForTab(tab.key)}</span>
                </button>
              ))}
              {/* [+] Add session — lives in the horizontal selector only.
                  Hidden/disabled once the race day has the maximum 6 sessions. */}
              {canAddSession ? (
                <button
                  onClick={openAddSession}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-dashed border-[#9CA3AF] text-[#6B7280] hover:text-[#00A8E8] hover:border-[#00A8E8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] flex-shrink-0"
                  aria-label="Add session"
                  title="Add session"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              ) : (
                <span className="inline-flex items-center px-2.5 text-[10px] text-[#9CA3AF] whitespace-nowrap" role="note">
                  Maximum of 6 sessions reached for this race day.
                </span>
              )}


            </div>
          )}
        </div>
      </nav>

      <div id="view-panel" role="tabpanel" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">

        {activeView === 'home' ? (
          <HomeLanding
            selectedCar={selectedCar}
            carNumber={carNumber}
            nextEvent={nextEvent}
            currentWeekend={currentWeekend}
            currentWeekendTitle={currentWeekendTitle}
            hasPreviousRace={Boolean(raceNavigation.previous)}
            hasNextRace={Boolean(raceNavigation.next)}
            centerRaceLabel={centerRaceLabel}
            performanceStats={performanceStats}
            upcomingEvents={upcomingEvents}
            middleSlot={<RookieAdSlot placement="home_middle" user={user} />}
            bottomSlot={<RookieAdSlot placement="home_bottom" user={user} />}
            onChangeClass={onChangeClass}
            onAction={handleHomeAction}
          />
        ) : activeView === 'compare' ? (
          <SetupComparison user={user} onSignInClick={onSignInClick} />
        ) : activeView === 'saved' ? (
          <div className="space-y-6">
            <SavedSetups
              user={user}
              onLoad={handleLoadSetup}
              refreshTrigger={refreshTrigger}
              activeClass={selectedCar}
              classLocksEnabled={classLocksEnabled}
              onUpgrade={onUpgrade}
            />
            <RookieAdSlot placement="setup_dashboard_bottom" user={user} />
          </div>
        ) : activeView === 'todo' ? (
          <TodoList user={user} variant="page" />
        ) : activeView === 'parts' ? (
          <PartsReference user={user} onSignInClick={onSignInClick} />
        ) : activeView === 'schedule' ? (
          <RaceSchedule user={user} onSignInClick={onSignInClick} onScheduleChanged={loadScheduleRows} />
        ) : activeView === 'create-base' ? (
          <CreateBaseSetupView
            user={user}
            selectedCar={selectedCar}
            onSignInClick={onSignInClick}
            customFields={customFields}
            onCustomFieldsChange={setCustomFields}
            onTemplatesChange={() => setBaseTemplateRefresh(prev => prev + 1)}
          />
        ) : (



          <div
            ref={contentRef}
            className={`transition-all duration-300 ease-out ${getAnimationClass()}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="relative inline-flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-[#1A1B23]">
                      {fullLabelForTab(activeTab)}
                    </h2>
                    {/* Pencil/edit control for the ACTIVE session */}
                    <button
                      onClick={() => setSessionMenuOpen(o => !o)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:text-[#00A8E8] hover:border-[#00A8E8]/40 px-2 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                      aria-haspopup="menu"
                      aria-expanded={sessionMenuOpen}
                      aria-label={`Edit ${labelForTab(activeTab)} session`}
                      title="Edit session"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      Edit
                    </button>
                    {sessionMenuOpen && (
                      <div className="absolute left-0 top-full mt-1 z-40 w-48 bg-white border border-[#E5E7EB] rounded-lg shadow-xl py-1" role="menu">
                        <button onClick={openRenameSession} className="w-full text-left px-3 py-2 text-sm text-[#1A1B23] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:bg-[#F5F5F7]" role="menuitem">
                          Rename Session
                        </button>
                        <button onClick={openDeleteSession} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:bg-red-50" role="menuitem">
                          Delete Session
                        </button>
                        <button onClick={() => setSessionMenuOpen(false)} className="w-full text-left px-3 py-2 text-sm text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:bg-[#F5F5F7]" role="menuitem">
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-[#6B7280] text-sm mt-1">
                    {activeTab === 'base' && 'Your starting hot laps / practice setup'}
                    {activeTab === 'heat' && 'Adjustments made for heat races'}
                    {activeTab === 'main' && 'Final setup for the main event feature'}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="inline-flex items-center bg-[#F5F5F7] text-[#4B5563] px-2.5 py-1 rounded-full text-xs font-semibold border border-[#E5E7EB]">
                      Class: {currentSetup.raceClass || selectedCar}
                    </span>
                    <button
                      onClick={onChangeClass}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:text-[#00A8E8] hover:border-[#00A8E8]/40 px-2 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                      aria-label="Edit vehicle class"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      Change Class
                    </button>
                  </div>
                  {savedMeta.name && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 bg-[#00A8E8]/10 text-[#00A8E8] px-2.5 py-1 rounded-full text-xs font-semibold border border-[#00A8E8]/20">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" />
                        </svg>
                        {savedMeta.name}
                      </span>
                      <span className="text-[10px] text-[#9CA3AF]">
                        Saving applies to all 3 tabs
                      </span>
                      {lastAutoSave && (
                        <span className="text-[10px] text-[#9CA3AF]">
                          Auto-saved {lastAutoSave.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[#9CA3AF] sm:hidden flex items-center gap-1" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Swipe to switch
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>

                  {(activeTab === 'heat' || activeTab === 'main') && (
                    <button
                      onClick={handleCopyLastSetup}
                      className="bg-[#00A8E8]/10 hover:bg-[#00A8E8]/20 text-[#00A8E8] px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 border border-[#00A8E8]/20 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy {activeTab === 'heat' ? 'Hot Laps' : 'Heat'}
                    </button>
                  )}

                  <button
                    onClick={handleShareCurrent}
                    disabled={saving}
                    className="bg-[#F9FAFB] hover:bg-[#00A8E8]/10 text-[#6B7280] hover:text-[#00A8E8] px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 border border-[#E5E7EB] hover:border-[#00A8E8]/20 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                    aria-label="Share this setup"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    Share
                  </button>

                  {activeTab === 'base' && user && savedSetupsList.length > 0 && (
                    <button
                      onClick={() => setShowCopyFromPast(!showCopyFromPast)}
                      aria-expanded={showCopyFromPast}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 border focus:outline-none focus:ring-2 focus:ring-[#00A8E8] ${
                        showCopyFromPast 
                          ? 'bg-[#00A8E8]/10 text-[#00A8E8] border-[#00A8E8]/30' 
                          : 'bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB] hover:text-[#1A1B23] hover:border-[#00A8E8]/30'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                      </svg>
                      <span className="hidden sm:inline">Copy From Past Session</span>
                      <span className="sm:hidden">Past</span>
                    </button>
                  )}
                  <button
                    onClick={handleClearSetup}
                    className="text-[#9CA3AF] hover:text-red-500 text-sm font-medium transition-colors flex items-center gap-1 px-2 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label={`Clear ${labelForTab(activeTab)} tab`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Clear Tab
                  </button>
                </div>
              </div>

              {currentClassSaveRestricted && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-medium" role="status">
                  Changes for this class cannot be saved on your current plan. You can continue viewing and editing the setup.
                </div>
              )}

              {resumedBanner && (
                <div className="bg-gradient-to-r from-[#00A8E8]/10 to-[#00A8E8]/5 border border-[#00A8E8]/30 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap" role="status" aria-live="polite">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#00A8E8]/15 text-[#00A8E8] flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-[180px]">
                    <div className="text-sm font-semibold text-[#1A1B23]">
                      Resumed: <span className="text-[#00A8E8]">{resumedBanner}</span>
                    </div>
                    <div className="text-xs text-[#6B7280]">Picked up where you left off across all 3 tabs.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setResumedBanner(null); setActiveView('saved'); }}
                      className="bg-white hover:bg-[#00A8E8]/10 text-[#00A8E8] px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#00A8E8]/30 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                    >
                      Open different setup
                    </button>
                    <button
                      onClick={() => setResumedBanner(null)}
                      className="text-[#9CA3AF] hover:text-[#1A1B23] p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                      aria-label="Dismiss resumed banner"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}


              {showCopyFromPast && activeTab === 'base' && (
                <section className="bg-white rounded-2xl border border-[#00A8E8]/20 p-4 shadow-sm" aria-label="Copy from past session">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#1A1B23] flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                      </svg>
                      Copy Chassis Values From Past Session
                    </h3>
                    <button onClick={() => setShowCopyFromPast(false)} className="text-[#9CA3AF] hover:text-[#1A1B23] transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]" aria-label="Close past sessions panel">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>


                  <ul className="space-y-2 max-h-[200px] overflow-y-auto" aria-label="Past setups to copy from">
                    {savedSetupsList.map(setup => (
                      <li key={setup.id}>
                        <button
                          onClick={() => handleCopyFromPastSetup(setup)}
                          className="w-full flex items-center justify-between bg-[#F9FAFB] rounded-lg px-4 py-2.5 hover:bg-[#00A8E8]/5 hover:border-[#00A8E8]/20 transition-colors text-left border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                        >
                          <div>
                            <span className="font-semibold text-sm text-[#1A1B23]">{setup.setup_name || setup.track_name || 'Untitled'}</span>
                            <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mt-0.5">
                              <span className={`font-medium px-1.5 py-0.5 rounded ${setup.setup_type === 'main' ? 'bg-[#00A8E8]/10 text-[#00A8E8]' : setup.setup_type === 'heat' ? 'bg-amber-100 text-amber-700' : 'bg-[#F0F0F2] text-[#6B7280]'}`}>
                                {setup.setup_type === 'main' ? 'Main' : setup.setup_type === 'heat' ? 'Heat' : 'Hot Laps'}
                              </span>
                              <span>{setup.race_date}</span>
                              <span>{setup.track_condition}</span>
                            </div>
                          </div>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {activeTab === 'base' && user && (
                <BaseTemplatePicker
                  user={user}
                  refreshKey={baseTemplateRefresh}
                  onApply={handleApplyBaseTemplate}
                />
              )}

              {baseTemplateMessage && activeTab === 'base' && (
                <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {baseTemplateMessage}
                </div>
              )}

              <TrackInfoSection
                trackName={currentSetup.trackName}
                raceDate={currentSetup.raceDate}
                raceClass={currentSetup.raceClass}
                trackCondition={currentSetup.trackCondition}
                trackShape={currentSetup.trackShape}
                trackLength={currentSetup.trackLength}
                temperature={currentSetup.temperature}
                humidity={currentSetup.humidity}
                windSpeed={currentSetup.windSpeed}
                windDirection={currentSetup.windDirection}
                onChange={handleSharedChange}
              />

              <RookieAdSlot placement="setup_track_conditions" user={user} />

              <DirtOvalTrack
                entryHandling={currentSetup.entry_handling}
                midHandling={currentSetup.mid_handling}
                exitHandling={currentSetup.exit_handling}
                onEntryChange={(v) => handleChange('entry_handling', v)}
                onMidChange={(v) => handleChange('mid_handling', v)}
                onExitChange={(v) => handleChange('exit_handling', v)}
              />

              <ChassisSetupForm
                data={currentSetup}
                customFields={customFields}
                onChange={handleChange}
                raceClass={selectedCar}
                activeTab={activeTab}
                baseSetup={baseSetupForDiff}
                baseLabel={baseLabelForDiff}
              />

              <CustomFieldManager
                fields={customFields}
                onAdd={(f) => setCustomFields(prev => [...prev, f])}
                onRemove={(id) => setCustomFields(prev => prev.filter(f => f.id !== id))}
                isOpen={customFieldsOpen}
                onToggle={() => setCustomFieldsOpen(!customFieldsOpen)}
              />

              <ScanTimingScreen
                key={savedMeta.ids[activeTab] || activeTab}
                user={user}
                currentSetupName={savedMeta.name}
                currentSetupId={savedMeta.ids[activeTab]}
                currentSetupType={activeTab}
                onSignInClick={onSignInClick}
                onPickerOpening={saveCurrentRoute}
                onSaved={handleTimingDataSaved}
              />

              <TimingDataDisplay
                timingData={selectedSessionId ? timingDataBySessionId[selectedSessionId] ?? null : null}
                setupType={activeTab}
              />

              <RookieAdSlot placement="timing_scan_bottom" user={user} />


              <HandlingFeedback
                entryHandling={currentSetup.entry_handling}
                midHandling={currentSetup.mid_handling}
                exitHandling={currentSetup.exit_handling}
                setupData={currentSetup}
                raceClass={currentSetup.raceClass}
                user={user}
                raceWeekendKey={savedMeta.name || undefined}
              />


              <RookieAdSlot placement="setup_session_bottom" user={user} className="mt-2" />
            </div>
          </div>
        )}
      </div>

      {activeView === 'setup' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] shadow-lg z-50" role="region" aria-label="Save setup">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap" aria-live="polite">
              {saveMessage && (
                <span className={`text-sm font-medium ${saveMessage.includes('Error') ? 'text-red-600' : saveMessage.includes('Offline') ? 'text-amber-600' : 'text-green-700'}`} role={saveMessage.includes('Error') ? 'alert' : 'status'}>
                  {saveMessage}
                </span>
              )}
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  {pendingCount} change{pendingCount === 1 ? '' : 's'} waiting to sync
                  <button
                    onClick={() => drainQueue()}
                    disabled={draining}
                    className="ml-1 text-amber-700 hover:text-amber-900 underline disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded px-1"
                  >
                    {draining ? 'Syncing…' : 'Retry'}
                  </button>
                </span>
              )}
              {!user && (
                <span className="text-sm text-[#9CA3AF]">
                  <button onClick={onSignInClick} className="text-[#00A8E8] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded px-1">Sign in</button> to save setups
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-[#9CA3AF] hidden sm:block">
                {savedMeta.name ? `Auto-saves every 5 min · All sessions` : `Saves every session as one race day`}
              </span>

              <button
                onClick={handleSaveClick}
                disabled={saving}
                className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-6 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                aria-busy={saving}
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                    </svg>
                    {savedMeta.name ? 'Save / Rename' : 'Save Setup'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <SaveSetupModal
        isOpen={saveModalOpen}
        onClose={handleSaveModalClose}
        onSave={handleSaveModalSubmit}
        defaultName={defaultSaveName()}
        currentSavedName={savedMeta.name}
        saving={saving}
      />

      {/* New Setup confirmation prompt */}
      {newSetupPromptOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="new-setup-title">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 id="new-setup-title" className="text-xl font-bold text-[#1A1B23] flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Start a New Setup?
            </h2>
            <p className="text-sm text-[#6B7280] mt-2">
              {savedMeta.name
                ? <>You have unsaved changes to <span className="font-semibold text-[#1A1B23]">"{savedMeta.name}"</span>. Would you like to save before starting fresh?</>
                : <>This will clear the Hot Laps, Heat, and Main tabs. Save your current work first?</>}
            </p>

            <div className="flex items-center justify-end gap-2 mt-5 flex-wrap">
              <button
                onClick={() => setNewSetupPromptOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
              >
                Cancel
              </button>
              <button
                onClick={handleNewSetupDiscard}
                className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Discard &amp; Start New
              </button>
              <button
                onClick={handleNewSetupSaveFirst}
                className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
              >
                Save &amp; Start New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME SESSION MODAL */}
      {renameOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Rename Session">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h4 className="text-lg font-bold text-[#1A1B23] mb-1">Rename Session</h4>
            <p className="text-xs text-[#6B7280] mb-3">This only changes the session label. Your setup data stays intact.</p>
            <input
              type="text"
              value={renameValue}
              autoFocus
              onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitRenameSession(); if (e.key === 'Escape') setRenameOpen(false); }}
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm text-[#1A1B23] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8]"
              placeholder="Session name"
              aria-label="New session name"
            />
            {renameError && <div className="text-xs text-red-600 mt-2" role="alert">{renameError}</div>}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setRenameOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">Cancel</button>
              <button onClick={submitRenameSession} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#00A8E8] hover:bg-[#0090c7] text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SESSION MODAL */}
      {deleteOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Delete Session">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h4 className="text-lg font-bold text-[#1A1B23] mb-2">Delete Session</h4>
            <p className="text-sm text-[#374151]">
              Delete this session? This will remove only this session's setup data. The race day will remain saved.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setDeleteOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">Cancel</button>
              <button onClick={submitDeleteSession} disabled={deleteBusy} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500">
                {deleteBusy ? 'Deleting...' : 'Delete Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SESSION MODAL */}
      {addSessionOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Add Session">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h4 className="text-lg font-bold text-[#1A1B23] mb-1">Add Session</h4>
            <p className="text-xs text-[#6B7280] mb-3">A new blank session sharing this race day's track, date and class.</p>
            <input
              type="text"
              value={addSessionValue}
              autoFocus
              onChange={(e) => { setAddSessionValue(e.target.value); setAddSessionError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitAddSession(); if (e.key === 'Escape') setAddSessionOpen(false); }}
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm text-[#1A1B23] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8]"
              placeholder="e.g. B Main"
              aria-label="New session name"
            />
            {addSessionError && <div className="text-xs text-red-600 mt-2" role="alert">{addSessionError}</div>}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setAddSessionOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">Cancel</button>
              <button onClick={submitAddSession} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#00A8E8] hover:bg-[#0090c7] text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">Add</button>
            </div>
          </div>
        </div>
      )}


      {/* POST-SAVE UPGRADE INTERSTITIAL (rookie users only) - shown after a successful save. */}
      {showPostSaveAd && adsEnabled && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="OnlyFast Pro upgrade">
          <RookieAdSlot
            placement="after_save_interstitial"
            user={user}
            onContinue={() => setShowPostSaveAd(false)}
          />
        </div>
      )}


      <ShareSetupModal
        isOpen={shareModalSetup !== null}
        onClose={() => setShareModalSetup(null)}
        setup={shareModalSetup}
        user={user}
      />

      <ViewSharedSetupModal
        isOpen={viewSharedOpen}
        onClose={() => setViewSharedOpen(false)}
        user={user}
        onUpgrade={onUpgrade}
      />

      {classLockNoticeOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="class-lock-title">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="class-lock-title" className="text-lg font-bold text-[#1A1B23]">This setup belongs to another class</h2>
            <p className="mt-2 text-sm leading-6 text-[#6B7280]">Switch back to that class to use this setup, or upgrade to Teams to unlock setups across all classes.</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setClassLockNoticeOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">Close</button>
              <button onClick={onUpgrade} className="rounded-lg bg-[#00A8E8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0090c7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2">Upgrade to Teams</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetupDashboard;
