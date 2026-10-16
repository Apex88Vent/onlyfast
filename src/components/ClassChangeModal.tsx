import React, { useEffect, useRef, useState } from 'react';
import { isMedianIOSApp } from '@/lib/paymentVisibility';
import type { User } from '@supabase/supabase-js';
import type { MembershipTier } from '@/lib/membership';
import { getDisciplineSetupClasses } from '@/lib/setupLibraryAccess';
import { EXPANDED_CLASS_CONFIGS, SETUP_CATEGORY_LABELS, type SetupCategory } from '@/lib/setupLibrary';
import { changeActiveClass, formatEligibleDate, getActiveClassState, sameClass } from '@/lib/activeClass';

type Step = 'loading' | 'warning' | 'selector' | 'cooldown';
interface ClassChangeModalProps {
  isOpen: boolean;
  user: User | null;
  tier: MembershipTier;
  currentClass: string;
  onClose: () => void;
  onChanged: (car: string) => void;
  onUpgrade: () => void;
}

const categoryFor = (car: string): SetupCategory => (EXPANDED_CLASS_CONFIGS[car]?.category || 'dirt_oval') as SetupCategory;
const disciplineEnabled = (category: string) => category !== 'rc' && category !== 'motorcycle';
const ClassChangeModal: React.FC<ClassChangeModalProps> = ({ isOpen, user, currentClass, onClose, onChanged, onUpgrade }) => {
  const [step, setStep] = useState<Step>('loading');
  const [selectedClass, setSelectedClass] = useState(currentClass);
  const [discipline, setDiscipline] = useState<SetupCategory>(categoryFor(currentClass));
  const [nextEligibleAt, setNextEligibleAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [unlimited, setUnlimited] = useState(false);
  const [checked, setChecked] = useState(false);
  const pending = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const currentUserId = useRef(user?.id);
  currentUserId.current = user?.id;
  const userId = user?.id;
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // Previously used class IDs remain selectable alongside the current sheets.
  const availableClasses = disciplineEnabled(discipline) ? [...new Set([...getDisciplineSetupClasses(discipline),
    ...Object.keys(EXPANDED_CLASS_CONFIGS).filter(car => EXPANDED_CLASS_CONFIGS[car].category === discipline)])] : [];

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setSelectedClass(currentClass);
    setDiscipline(categoryFor(currentClass));
    setError('');
    setNextEligibleAt(null);
    setChecked(false);
    setStep('loading');
    if (!userId) {
      setError('Please sign in to change your racing discipline or vehicle.');
      setStep('selector');
      return;
    }
    getActiveClassState().then(state => {
      if (cancelled) return;
      setUnlimited(state.unlimited);
      setChecked(true);
      setNextEligibleAt(state.next_eligible_at);
      if (!state.unlimited && !state.can_change && state.next_eligible_at) setStep('cooldown');
      else setStep('selector');
    }).catch(() => {
      if (cancelled) return;
      setError('Your change eligibility could not be checked. Close this screen and try again.');
      setStep('selector');
    });
    return () => { cancelled = true; };
  }, [isOpen, currentClass, userId]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 25);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending.current) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', onKeyDown); };
  }, [isOpen, step, onClose]);

  if (!isOpen) return null;
  const close = () => { if (!pending.current) onClose(); };
  const confirmChange = async () => {
    if (!user || !checked || !selectedClass || !disciplineEnabled(discipline) || !disciplineEnabled(categoryFor(selectedClass)) || sameClass(selectedClass, currentClass) || pending.current) return;
    const userId = user.id;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      const state = await changeActiveClass(selectedClass, userId);
      if (!mounted.current || currentUserId.current !== userId) return;
      onChanged(state.active_class || selectedClass);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String((err as { message?: unknown } | null)?.message || '');
      const next = message.match(/CLASS_CHANGE_COOLDOWN:([^\s]+)/)?.[1];
      if (next) { setNextEligibleAt(next); setStep('cooldown'); }
      else setError(message.includes('CLASS_AUTH_REQUIRED') ? 'Please sign in again to change vehicles.' : 'Your vehicle could not be changed. Please try again.');
    } finally { pending.current = false; setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="class-change-title">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={close} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="class-change-title" className="text-xl font-bold text-[#1A1B23]">{step === 'warning' ? 'Confirm vehicle change' : step === 'cooldown' ? 'Class change unavailable' : 'Change Discipline / Vehicle'}</h2>
        {step === 'loading' && <p className="mt-3 text-sm text-[#6B7280]" role="status">Checking your change availability…</p>}
        {step === 'selector' && <>
          <label htmlFor="active-discipline-select" className="mt-5 block text-sm font-semibold text-[#374151]">Racing discipline
            {(discipline === 'road_course' || discipline === 'pavement_oval') && <span className="ml-2 inline-flex align-middle rounded border border-[#00A8E8]/20 bg-[#00A8E8]/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#00A8E8]">BETA</span>}
          </label>
          <select id="active-discipline-select" value={discipline} disabled={saving || !checked}
            onChange={event => { if (disciplineEnabled(event.target.value)) { setDiscipline(event.target.value as SetupCategory); setSelectedClass(''); } }}
            className="mt-2 w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-3 text-sm text-[#1A1B23] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">
            {Object.entries(SETUP_CATEGORY_LABELS).map(([key, name]) => <option key={key} value={key} disabled={!disciplineEnabled(key)}>{key === 'rc' ? 'RC Racing' : key === 'motorcycle' ? 'Motorcycle Racing' : name}{!disciplineEnabled(key) ? ' — COMING SOON' : key === 'road_course' || key === 'pavement_oval' ? ' — BETA' : ''}</option>)}
          </select>
          <label htmlFor="active-class-select" className="mt-5 block text-sm font-semibold text-[#374151]">Vehicle class</label>
          <select id="active-class-select" value={selectedClass} disabled={saving || !checked}
            onChange={event => setSelectedClass(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-3 text-sm text-[#1A1B23] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">
            <option value="" disabled>Select a vehicle class</option>
            {availableClasses.map(car => <option key={car} value={car}>{EXPANDED_CLASS_CONFIGS[car]?.name || car}{sameClass(car, currentClass) ? ' (Current)' : ''}</option>)}
          </select>
          {!unlimited && nextEligibleAt && <p className="mt-3 text-xs text-[#6B7280]">Next available change date: {formatEligibleDate(nextEligibleAt)}</p>}
        </>}
        {step === 'warning' && <div className="mt-3 space-y-3 text-sm leading-6 text-[#6B7280]">
          <p>Changing your racing discipline or vehicle will lock your previously saved setups.</p>
          <p>Your setups will NOT be deleted. They will remain saved and will become available again when you switch back to that vehicle.</p>
          <p>You can only change vehicles once every 30 days.</p>
          <p className="font-semibold text-[#1A1B23]">{EXPANDED_CLASS_CONFIGS[currentClass]?.name || currentClass} → {EXPANDED_CLASS_CONFIGS[selectedClass]?.name || selectedClass}</p>
          <p>Do you want to continue?</p>
        </div>}
        {step === 'cooldown' && <>
          <p className="mt-3 text-sm leading-6 text-[#6B7280]">You can only change your racing discipline or vehicle once every 30 days.</p>
          <p className="mt-3 text-sm text-[#6B7280]">Your next available change date is <span className="font-semibold text-[#1A1B23]">{formatEligibleDate(nextEligibleAt)}</span>.</p>
          {<button onClick={onUpgrade} className="mt-5 w-full rounded-xl bg-[#00A8E8] px-5 py-3 text-sm font-bold text-white">Upgrade to Teams for Unlimited Classes</button>}
        </>}
        {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancelRef} onClick={close} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">{step === 'cooldown' ? 'Close' : 'Cancel'}</button>
          {(step === 'selector' || step === 'warning') && <button
            onClick={step === 'warning' || unlimited ? confirmChange : () => setStep('warning')}
            disabled={saving || !checked || !selectedClass || sameClass(selectedClass, currentClass)}
            className="rounded-lg bg-[#00A8E8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0090c7] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2">
            {saving ? 'Changing…' : step === 'warning' ? 'Confirm Change' : unlimited ? 'Change Class' : 'Continue'}
          </button>}
        </div>
      </div>
    </div>
  );
};
export default ClassChangeModal;
