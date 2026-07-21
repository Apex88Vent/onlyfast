import React, { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AVAILABLE_CAR_CLASSES, CAR_CLASSES } from '@/lib/classConfigs';
import { isCurrentUserTestAccount } from '@/lib/testAccount';
import type { MembershipTier } from '@/lib/membership';
import {
  changeActiveClass,
  formatEligibleDate,
  getActiveClassState,
  sameClass,
} from '@/lib/activeClass';

type Step = 'loading' | 'warning' | 'upgrade' | 'selector' | 'cooldown';

interface ClassChangeModalProps {
  isOpen: boolean;
  user: User | null;
  tier: MembershipTier;
  currentClass: string;
  onClose: () => void;
  onChanged: (car: string) => void;
  onUpgrade: () => void;
}

const ClassChangeModal: React.FC<ClassChangeModalProps> = ({
  isOpen,
  user,
  tier,
  currentClass,
  onClose,
  onChanged,
  onUpgrade,
}) => {
  const [step, setStep] = useState<Step>('loading');
  const [selectedClass, setSelectedClass] = useState(currentClass);
  const [nextEligibleAt, setNextEligibleAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [serverUnlimited, setServerUnlimited] = useState<boolean | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const clientUnlimited = tier === 'team';
  const unlimited = serverUnlimited ?? clientUnlimited;
  const baseClasses = isCurrentUserTestAccount() ? CAR_CLASSES : AVAILABLE_CAR_CLASSES;
  const availableClasses = baseClasses.some(car => sameClass(car, currentClass))
    ? baseClasses
    : [currentClass, ...baseClasses].filter(Boolean);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedClass(currentClass);
    setError('');
    setNextEligibleAt(null);
    setServerUnlimited(null);
    if (!user) {
      setStep(clientUnlimited ? 'selector' : 'warning');
      return;
    }

    setStep('loading');
    getActiveClassState()
      .then(state => {
        setServerUnlimited(state.unlimited);
        if (state.unlimited) {
          setStep('selector');
        } else if (!state.can_change && state.next_eligible_at) {
          setNextEligibleAt(state.next_eligible_at);
          setStep('cooldown');
        } else {
          setStep('warning');
        }
      })
      .catch(() => {
        if (clientUnlimited) setStep('selector');
        else setStep('warning');
      });
  }, [isOpen, currentClass, clientUnlimited, user]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 25);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, step, onClose]);

  if (!isOpen) return null;

  const confirmChange = async () => {
    if (!selectedClass || sameClass(selectedClass, currentClass)) return;
    setSaving(true);
    setError('');
    try {
      if (user) await changeActiveClass(selectedClass);
      onChanged(selectedClass);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : String((err as { message?: unknown } | null)?.message || '');
      const cooldownValue = message.match(/CLASS_CHANGE_COOLDOWN:([^\s]+)/)?.[1];
      if (cooldownValue) {
        setNextEligibleAt(cooldownValue);
        setStep('cooldown');
      } else if (message.includes('CLASS_INVALID')) {
        setError('That class is not available.');
      } else if (message.includes('CLASS_AUTH_REQUIRED') || message.toLowerCase().includes('jwt')) {
        setError('Please sign in again to change classes.');
      } else {
        setError('The class could not be changed. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const title = step === 'warning'
    ? 'Changing your class will lock other setups'
    : step === 'selector'
      ? 'Change class?'
      : step === 'cooldown'
        ? 'Class change unavailable'
        : 'Change class';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="class-change-title">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="class-change-title" className="text-xl font-bold text-[#1A1B23]">{title}</h2>

        {step === 'loading' && (
          <p className="mt-3 text-sm text-[#6B7280]" role="status">Checking your class-change availability…</p>
        )}

        {step === 'warning' && (
          <>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              Your current plan allows one active vehicle class. If you change classes, setups from your previous class will be locked until you switch back. Classes can only be changed once every 7 days.
            </p>
            {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button ref={cancelRef} onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">Cancel</button>
              <button onClick={() => setStep('upgrade')} disabled={Boolean(error)} className="rounded-lg bg-[#00A8E8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0090c7] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2">OK</button>
            </div>
          </>
        )}

        {step === 'upgrade' && (
          <div className="mt-5 space-y-4">
            <button onClick={onUpgrade} className="w-full rounded-xl bg-[#00A8E8] px-5 py-3 text-sm font-bold text-white hover:bg-[#0090c7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2">
              Upgrade to Teams for Unlimited Classes and Setups
            </button>
            <button onClick={() => setStep('selector')} className="w-full text-sm font-semibold text-[#00A8E8] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded">
              Continue to Change Class
            </button>
            <button ref={cancelRef} onClick={onClose} className="w-full text-sm font-medium text-[#6B7280] hover:text-[#1A1B23] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded">Cancel</button>
          </div>
        )}

        {step === 'selector' && (
          <>
            {!unlimited && (
              <p className="mt-3 text-sm text-[#6B7280]">Changing classes will lock saved setups from every other class until you switch back.</p>
            )}
            <label htmlFor="active-class-select" className="mt-5 block text-sm font-semibold text-[#374151]">Vehicle class</label>
            <select
              id="active-class-select"
              value={selectedClass}
              onChange={event => setSelectedClass(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#D1D5DB] bg-white px-3 py-3 text-sm text-[#1A1B23] focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/30"
            >
              {availableClasses.map(car => (
                <option key={car} value={car}>{car}{sameClass(car, currentClass) ? ' (Current)' : ''}</option>
              ))}
            </select>
            {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button ref={cancelRef} onClick={onClose} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]">Cancel</button>
              <button onClick={confirmChange} disabled={saving || sameClass(selectedClass, currentClass)} className="rounded-lg bg-[#00A8E8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0090c7] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2">
                {saving ? 'Changing…' : unlimited ? 'Change Class' : 'Confirm'}
              </button>
            </div>
          </>
        )}

        {step === 'cooldown' && (
          <>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              You can change classes again on <span className="font-semibold text-[#1A1B23]">{formatEligibleDate(nextEligibleAt)}</span>.
            </p>
            <button onClick={onUpgrade} className="mt-5 w-full rounded-xl bg-[#00A8E8] px-5 py-3 text-sm font-bold text-white hover:bg-[#0090c7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2">
              Upgrade to Teams for Unlimited Classes
            </button>
            <button ref={cancelRef} onClick={onClose} className="mt-4 w-full text-sm font-medium text-[#6B7280] hover:text-[#1A1B23] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded">Close</button>
          </>
        )}
      </div>
    </div>
  );
};

export default ClassChangeModal;
