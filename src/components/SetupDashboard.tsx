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
import SaveSetupModal from './SaveSetupModal';
import CreateBaseSetupView from './CreateBaseSetupView';
import BaseTemplatePicker from './BaseTemplatePicker';
import {
  enqueue as enqueuePending,
  readQueue as readPendingQueue,
  removeFromQueue as removePending,
  isNetworkError,
  PendingSave,
} from '@/lib/offlineQueue';


interface SetupDashboardProps {
  user: User | null;
  selectedCar: string;
  onSignInClick: () => void;
}

type SetupType = 'base' | 'heat' | 'main';

interface SetupState {
  [key: string]: string;
}

const TAB_LABELS: Record<SetupType, { full: string; short: string }> = {
  base: { full: 'Hot Laps Setup', short: 'Hot Laps' },
  heat: { full: 'Heat Setup', short: 'Heat' },
  main: { full: 'Main Event Setup', short: 'Main' },
};

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
  top_wing_angle: '', top_wing_offset: '', nose_wing_angle: '',
  side_boards: '', nerf_bar_height: '',
  front_sprocket: '', rear_sprocket: '', chain_tension: '',
  front_axle: '', fuel_mixture: '', bumper_height: '',
  total_weight: '', left_side_pct: '', rear_weight_pct: '',
  lead_location: '', lead_weight: '',
  setup_name: '',
});

const TAB_ORDER: SetupType[] = ['base', 'heat', 'main'];
const AUTOSAVE_MS = 5 * 60 * 1000; // 5 minutes
const STATE_STORAGE_KEY = 'onlyfast_setup_state_v2';

// Single unified meta for the whole setup file (one name, separate DB ids per tab)
interface UnifiedSavedMeta {
  name?: string;
  ids: Partial<Record<SetupType, string>>;
}

const SetupDashboard: React.FC<SetupDashboardProps> = ({ user, selectedCar, onSignInClick }) => {
  const [activeTab, setActiveTab] = useState<SetupType>('base');
  const [setups, setSetups] = useState<Record<SetupType, SetupState>>({
    base: emptySetup(),
    heat: emptySetup(),
    main: emptySetup(),
  });
  // Unified: one file name covers all three tabs, with DB ids stored per tab
  const [savedMeta, setSavedMeta] = useState<UnifiedSavedMeta>({ name: undefined, ids: {} });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [saveMessage, setSaveMessage] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [baseTemplateRefresh, setBaseTemplateRefresh] = useState(0);
  const [activeView, setActiveView] = useState<'setup' | 'saved' | 'compare' | 'create-base'>('setup');
  const [savedSetupsList, setSavedSetupsList] = useState<any[]>([]);
  const [showCopyFromPast, setShowCopyFromPast] = useState(false);
  const [shareModalSetup, setShareModalSetup] = useState<any>(null);
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


  // Swipe animation state
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const prefix = useId();
  const currentSetup = setups[activeTab];

  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Load persisted state on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.setups) setSetups({
          base: { ...emptySetup(), ...parsed.setups.base },
          heat: { ...emptySetup(), ...parsed.setups.heat },
          main: { ...emptySetup(), ...parsed.setups.main },
        });
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
        if (parsed.customFields) setCustomFields(parsed.customFields);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
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
        timestamp: Date.now(),
      }));
    } catch {}
  }, [setups, savedMeta, customFields, activeTab, stateLoaded]);

  useEffect(() => {
    if (!stateLoaded) return;
    setSetups(prev => ({
      base: { ...prev.base, raceClass: selectedCar || prev.base.raceClass },
      heat: { ...prev.heat, raceClass: selectedCar || prev.heat.raceClass },
      main: { ...prev.main, raceClass: selectedCar || prev.main.raceClass },
    }));
  }, [selectedCar, stateLoaded]);

  useEffect(() => {
    if (user) fetchSavedForCopy();
  }, [user, refreshTrigger]);

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

  // Auto-resume: when user signs in, load their most recently updated setup file
  // (all rows sharing the same setup_name). Only runs when the workspace is empty
  // so we don't clobber unsaved in-progress work from localStorage.
  useEffect(() => {
    if (!stateLoaded || !user || resumeAttempted) return;

    // If they already have in-progress work (either a named file or data in any tab), skip.
    const hasInProgress = !!savedMeta.name ||
      (['base', 'heat', 'main'] as SetupType[]).some(t => tabHasData(setups[t]));
    if (hasInProgress) {
      setResumeAttempted(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Use the same safe query pattern as SavedSetups (created_at only, no
        // .not() filters — some backends reject PostgREST "is null" filters)
        const { data: rows, error } = await supabase
          .from('race_setups')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (cancelled) return;
        if (error || !rows || rows.length === 0) {
          setResumeAttempted(true);
          return;
        }

        // Filter in JS to usable setup types with a non-empty name
        const usable = rows.filter((r: any) => {
          const t = r.setup_type || 'base';
          if (t !== 'base' && t !== 'heat' && t !== 'main') return false;
          const name = r.setup_name;
          return typeof name === 'string' && name.trim() !== '';
        });
        if (usable.length === 0) {
          setResumeAttempted(true);
          return;
        }

        const firstUsable = usable[0];
        const name = firstUsable.setup_name as string;

        const newSetups: Record<SetupType, SetupState> = {
          base: emptySetup(),
          heat: emptySetup(),
          main: emptySetup(),
        };
        const newIds: Partial<Record<SetupType, string>> = {};

        // Siblings = all rows from the same list that share this name
        const siblings = rows.filter((r: any) => r.setup_name === name);
        for (const row of siblings) {
          const t = (row.setup_type || 'base') as SetupType;
          if (t !== 'base' && t !== 'heat' && t !== 'main') continue;
          if (newIds[t]) continue; // prefer most recent per type
          newSetups[t] = loadSetupIntoState(row);
          newIds[t] = row.id;
        }

        if (cancelled) return;
        setSetups(newSetups);
        setSavedMeta({ name, ids: newIds });
        setActiveTab(newIds.base ? 'base' : newIds.heat ? 'heat' : 'main');
        setActiveView('setup');
        setResumedBanner(name);
      } catch {
        // Network/unreachable — silently skip auto-resume so the user can still
        // use the app. SavedSetups view will surface a clearer error.
      } finally {
        if (!cancelled) setResumeAttempted(true);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, stateLoaded]);




  const handleChange = useCallback((field: string, value: string) => {
    setSetups(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [field]: value },
    }));
  }, [activeTab]);

  const handleSharedChange = useCallback((field: string, value: string) => {
    const sharedFields = ['trackName', 'raceDate', 'raceClass', 'trackCondition', 'latitude', 'longitude', 'temperature', 'humidity', 'windSpeed', 'windDirection'];
    if (sharedFields.includes(field)) {
      setSetups(prev => ({
        base: { ...prev.base, [field]: value },
        heat: { ...prev.heat, [field]: value },
        main: { ...prev.main, [field]: value },
      }));
    } else {
      handleChange(field, value);
    }
  }, [handleChange]);

  const switchTab = useCallback((newTab: SetupType) => {
    if (newTab === activeTab || isAnimating) return;
    const currentIdx = TAB_ORDER.indexOf(activeTab);
    const newIdx = TAB_ORDER.indexOf(newTab);
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
      const currentIdx = TAB_ORDER.indexOf(activeTab);
      if (diff > 0 && currentIdx < TAB_ORDER.length - 1) {
        switchTab(TAB_ORDER[currentIdx + 1]);
      } else if (diff < 0 && currentIdx > 0) {
        switchTab(TAB_ORDER[currentIdx - 1]);
      }
    }
    setTouchStart(null);
  };

  const buildPayload = (s: SetupState, tabKey: SetupType, name?: string) => {
    const customFieldData: Record<string, string> = {};
    customFields.forEach(f => {
      const val = s[`custom_${f.id}`];
      if (val) customFieldData[f.name] = val;
    });

    return {
      user_id: user!.id,
      setup_type: tabKey,
      setup_name: name || s.setup_name || null,
      track_name: s.trackName || '',
      race_date: s.raceDate || new Date().toISOString().split('T')[0],
      race_class: s.raceClass || '',
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
    let p = { ...payload };
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
    let p = { ...payload };
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
  const tabHasData = (s: SetupState): boolean => {
    return Object.entries(s).some(([k, v]) => {
      if (!v) return false;
      if (k === 'raceDate' || k === 'raceClass' || k === 'setup_name') return false;
      return String(v).trim() !== '';
    });
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
    setSaving(true);
    if (!silent) setSaveMessage('');
    try {
      const isRename = savedMeta.name && savedMeta.name.trim() !== name.trim();
      const newIds: Partial<Record<SetupType, string>> = {};
      let queuedAny = false;

      for (const tabKey of TAB_ORDER) {
        const setup = setups[tabKey];
        const existingId = savedMeta.ids[tabKey];
        if (!tabHasData(setup) && !existingId) continue;

        const payload = buildPayload(setup, tabKey, name);
        try {
          let result: any;
          if (existingId && !isRename) {
            result = await dbUpdate(existingId, payload);
          } else {
            result = await dbInsert(payload);
          }
          newIds[tabKey] = result.id;
        } catch (err: any) {
          if (isNetworkError(err)) {
            // Queue it for later
            enqueuePending({
              op: existingId && !isRename ? 'update' : 'insert',
              rowId: existingId && !isRename ? existingId : undefined,
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

      setSavedMeta({ name, ids: newIds });
      setSetups(prev => ({
        base: { ...prev.base, setup_name: name },
        heat: { ...prev.heat, setup_name: name },
        main: { ...prev.main, setup_name: name },
      }));
      setRefreshTrigger(prev => prev + 1);
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


  // Save button → open modal
  const handleSaveClick = () => {
    if (!user) {
      onSignInClick();
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
    setSaving(true);
    try {
      const payload = buildPayload(currentSetup, activeTab, savedMeta.name || undefined);
      const result = await dbInsert(payload);
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
    const name = setup.setup_name || setup.track_name || '';
    const newSetups: Record<SetupType, SetupState> = {
      base: emptySetup(),
      heat: emptySetup(),
      main: emptySetup(),
    };
    const newIds: Partial<Record<SetupType, string>> = {};

    // Seed at least the clicked row
    const clickedType = (setup.setup_type || 'base') as SetupType;
    newSetups[clickedType] = loadSetupIntoState(setup);
    newIds[clickedType] = setup.id;

    // Try to fetch sibling rows (same user, same setup_name) for the other two tabs
    if (user && name) {
      try {
        const { data } = await supabase
          .from('race_setups')
          .select('*')
          .eq('user_id', user.id)
          .eq('setup_name', name)
          .order('created_at', { ascending: false });
        if (data) {
          for (const row of data) {
            const t = (row.setup_type || 'base') as SetupType;
            if (t !== 'base' && t !== 'heat' && t !== 'main') continue;
            if (newIds[t]) continue; // prefer most recent per type
            newSetups[t] = loadSetupIntoState(row);
            newIds[t] = row.id;
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
    setActiveTab(clickedType);
    setActiveView('setup');
  };

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
    setSetups({
      base: { ...emptySetup(), raceClass: selectedCar, raceDate: today },
      heat: { ...emptySetup(), raceClass: selectedCar, raceDate: today },
      main: { ...emptySetup(), raceClass: selectedCar, raceDate: today },
    });
    setSavedMeta({ name: undefined, ids: {} });
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
    const label = TAB_LABELS[activeTab].short;
    if (!confirm(`Clear the ${label} tab?`)) return;
    setSetups(prev => ({
      ...prev,
      [activeTab]: { ...emptySetup(), raceClass: selectedCar, raceDate: new Date().toISOString().split('T')[0], setup_name: prev[activeTab].setup_name },
    }));
  };

  const tabs = [
    { key: 'base' as SetupType, label: TAB_LABELS.base.full, shortLabel: TAB_LABELS.base.short, icon: '1' },
    { key: 'heat' as SetupType, label: TAB_LABELS.heat.full, shortLabel: TAB_LABELS.heat.short, icon: '2' },
    { key: 'main' as SetupType, label: TAB_LABELS.main.full, shortLabel: TAB_LABELS.main.short, icon: '3' },
  ];

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

  // Base setup for diff highlighting on Heat/Main (Hot Laps is the reference)
  const baseSetupForDiff = setups.base;

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Sub Navigation — stacked: row 1 = views, row 2 = setup type (only on setup view) */}
      <nav className="bg-white border-b border-[#E5E7EB] sticky top-16 z-40" aria-label="Dashboard navigation">
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
            <button
              role="tab"
              aria-selected={activeView === 'saved'}
              onClick={() => setActiveView('saved')}
              className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] ${
                activeView === 'saved' ? 'bg-[#00A8E8] text-white' : 'text-[#6B7280] hover:text-[#1A1B23] hover:bg-[#F5F5F7]'
              }`}
            >
              Saved
            </button>
            <button
              role="tab"
              aria-selected={activeView === 'create-base'}
              onClick={() => setActiveView('create-base')}
              className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] ${
                activeView === 'create-base' ? 'bg-[#00A8E8] text-white' : 'text-[#6B7280] hover:text-[#1A1B23] hover:bg-[#F5F5F7]'
              }`}
            >
              <span className="hidden sm:inline">Create Base Setup</span>
              <span className="sm:hidden">Base</span>
            </button>
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
          {activeView === 'setup' && (
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
                  <span className="sm:inline">{tab.shortLabel}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div id="view-panel" role="tabpanel" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">

        {activeView === 'compare' ? (
          <SetupComparison user={user} onSignInClick={onSignInClick} />
        ) : activeView === 'saved' ? (
          <SavedSetups user={user} onLoad={handleLoadSetup} refreshTrigger={refreshTrigger} />
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
                  <h2 className="text-2xl font-bold text-[#1A1B23]">
                    {TAB_LABELS[activeTab].full}
                  </h2>
                  <p className="text-[#6B7280] text-sm mt-1">
                    {activeTab === 'base' && 'Your starting hot laps / practice setup'}
                    {activeTab === 'heat' && 'Adjustments made for heat races'}
                    {activeTab === 'main' && 'Final setup for the main event feature'}
                  </p>
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
                    aria-label={`Clear ${TAB_LABELS[activeTab].short} tab`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Clear Tab
                  </button>
                </div>
              </div>

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
                temperature={currentSetup.temperature}
                humidity={currentSetup.humidity}
                windSpeed={currentSetup.windSpeed}
                windDirection={currentSetup.windDirection}
                onChange={handleSharedChange}
              />

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
                baseSetup={activeTab === 'base' ? undefined : baseSetupForDiff}
              />

              <CustomFieldManager
                fields={customFields}
                onAdd={(f) => setCustomFields(prev => [...prev, f])}
                onRemove={(id) => setCustomFields(prev => prev.filter(f => f.id !== id))}
                isOpen={customFieldsOpen}
                onToggle={() => setCustomFieldsOpen(!customFieldsOpen)}
              />

              <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="lap-times-heading">
                <h3 id="lap-times-heading" className="text-base font-bold text-[#1A1B23] mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  Session Lap Times
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <label htmlFor={`${prefix}-fastest`} className="block text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">
                      Session Fastest Lap
                    </label>
                    <input
                      id={`${prefix}-fastest`}
                      type="text"
                      value={currentSetup.session_fastest_lap || ''}
                      onChange={(e) => handleChange('session_fastest_lap', e.target.value)}
                      className="w-full px-4 py-3 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition-all text-green-800 bg-white text-lg font-bold placeholder-green-300"
                      placeholder="e.g. 14.523"
                    />
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <label htmlFor={`${prefix}-slowest`} className="block text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">
                      Session Slowest Lap
                    </label>
                    <input
                      id={`${prefix}-slowest`}
                      type="text"
                      value={currentSetup.session_slowest_lap || ''}
                      onChange={(e) => handleChange('session_slowest_lap', e.target.value)}
                      className="w-full px-4 py-3 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none transition-all text-red-800 bg-white text-lg font-bold placeholder-red-300"
                      placeholder="e.g. 16.891"
                    />
                  </div>
                </div>
              </section>

              <HandlingFeedback
                entryHandling={currentSetup.entry_handling}
                midHandling={currentSetup.mid_handling}
                exitHandling={currentSetup.exit_handling}
                setupData={currentSetup}
                raceClass={currentSetup.raceClass}
              />
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
                {savedMeta.name ? `Auto-saves every 5 min · All 3 tabs` : `Saves all 3 tabs as one file`}
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

      <ShareSetupModal
        isOpen={shareModalSetup !== null}
        onClose={() => setShareModalSetup(null)}
        setup={shareModalSetup}
        user={user}
      />
    </div>
  );
};

export default SetupDashboard;
