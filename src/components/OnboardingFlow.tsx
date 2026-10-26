import { getClassIcon } from '@/lib/classIcons';
import { CUSTOM_CAR, CUSTOM_CAR_DISCIPLINES } from '@/lib/customCar';
import React, { useState, useRef, useEffect } from 'react';
import { CLASS_CONFIGS } from '@/lib/classConfigs';
import { ArrowLeft, Check } from 'lucide-react';
import { useBetaFeatures } from '@/hooks/useBetaFeatures';
import { getDisciplineSetupClasses } from '@/lib/setupLibraryAccess';
import { EXPANDED_CLASS_CONFIGS, type SetupCategory } from '@/lib/setupLibrary';
import PlanSelection from './PlanSelection';

interface OnboardingFlowProps {
  onComplete: (car: string) => void | Promise<void>;
  error?: string;
  userId?: string;
  initialStep?: 'discipline' | 'vehicle' | 'plan';
  initialDiscipline?: string | null;
  initialClass?: string | null;
  onProgress?: (step: 'discipline' | 'vehicle' | 'plan', discipline?: string, car?: string) => Promise<void>;
}


// Unlocked classes. Pro Stock & Pure Stock are now unlocked; Non-Wing Sprint
// Cars is locked again (Coming Soon). Lightning Sprints remains usable.



// Discipline definitions
const disciplines = [
  {
    key: 'dirt_oval',
    name: 'Dirt Track Oval',
    description: 'Master changing surfaces, find your grip, and dial in your setup for every lap.',
    enabled: true,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <ellipse cx="24" cy="24" rx="20" ry="14" stroke="#00A8E8" strokeWidth="3" fill="none" />
        <ellipse cx="24" cy="24" rx="12" ry="7" stroke="#00A8E8" strokeWidth="2" fill="none" opacity="0.4" />
        <circle cx="10" cy="20" r="3" fill="#00A8E8" />
      </svg>
    ),
  },
  {
    key: 'pavement_oval',
    name: 'Pavement Oval',
    description: 'Fine-tune handling, balance, and speed to maximize performance on paved ovals.',
    enabled: true,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <ellipse cx="24" cy="24" rx="20" ry="14" stroke="#00A8E8" strokeWidth="3" fill="none" />
        <ellipse cx="24" cy="24" rx="12" ry="7" stroke="#00A8E8" strokeWidth="2" fill="none" opacity="0.4" />
        <rect x="14" y="22" width="20" height="4" rx="1" fill="#00A8E8" opacity="0.3" />
      </svg>
    ),
  },
  {
    key: 'road_course',
    name: 'Road Racing',
    description: 'Perfect your setup for braking, cornering, and acceleration across technical road courses.',
    enabled: true,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        {/* Simplified Silverstone-inspired loop, straights and corner complex. */}
        <path d="M22 42 L28 31 Q30 28 33 29 L36 27 L34 23 L29 22 Q26 22 26 25 L24 28 L11 33 Q6 35 5 30 L5 25 Q5 22 8 20 L9 10 Q9 6 13 6 L25 7 Q28 7 28 10 L31 12 L30 15 L35 17 Q37 18 38 22 L43 34 Q44 37 40 39 L30 42 L25 44 Q23 44 22 42 Z" stroke="#00A8E8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'motorcycle',
    name: 'Motorcycle Racing',
    description: 'Optimize suspension, traction, and handling for peak performance on two wheels.',
    enabled: false,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="14" cy="32" r="7" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <circle cx="34" cy="32" r="7" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <path d="M14 32 L20 20 L30 18 L34 32" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
        <path d="M20 20 L24 16 L30 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'rc',
    name: 'RC Racing',
    description: 'Dial in suspension, gearing, and handling to get the most from your RC racer.',
    enabled: false,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="10" y="20" width="28" height="12" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <circle cx="16" cy="34" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="32" cy="34" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M20 20 V16 L28 16 V20" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="22" y1="12" x2="26" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="24" y1="12" x2="24" y2="16" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, error, userId, initialStep, initialDiscipline, initialClass, onProgress }) => {
  const savedDiscipline = disciplines.find(d => d.key === initialDiscipline || d.name === initialDiscipline
    || d.name === ({ 'Road Course': 'Road Racing', Motorcycle: 'Motorcycle Racing', RC: 'RC Racing' }[initialDiscipline || '']))
    || disciplines.find(d => d.key === EXPANDED_CLASS_CONFIGS[initialClass || '']?.category);
  const savedClassDiscipline = disciplines.find(d => d.key === EXPANDED_CLASS_CONFIGS[initialClass || '']?.category);
  const unavailableSelection = savedDiscipline?.enabled === false || savedClassDiscipline?.enabled === false;
  const betaAccess = useBetaFeatures();
  const validDiscipline = savedDiscipline?.enabled === true;
  const savedClass = validDiscipline ? getDisciplineSetupClasses(savedDiscipline.key as SetupCategory, betaAccess)
    .find(car => car === initialClass || EXPANDED_CLASS_CONFIGS[car]?.name === initialClass) || '' : '';
  const validClass = Boolean(savedClass);
  const [step, setStep] = useState<2 | 3 | 4>(unavailableSelection || !validDiscipline ? 2 : initialStep === 'plan' && validClass ? 4 : initialStep === 'vehicle' || initialStep === 'plan' ? 3 : 2);
  const [selectedDiscipline, setSelectedDiscipline] = useState(unavailableSelection ? '' : savedDiscipline?.name || initialDiscipline || '');
  const [selectedClass, setSelectedClass] = useState(unavailableSelection ? '' : savedClass);
  const [saving, setSaving] = useState(false);
  const [progressError, setProgressError] = useState('');
  const pending = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const steps = [
    { num: 2, label: 'Discipline' },
    { num: 3, label: 'Car' },
    { num: 4, label: 'Plan' },
  ];

  const advance = async (next: 2 | 3 | 4, discipline = selectedDiscipline, car = selectedClass) => {
    if (pending.current) return;
    if (next !== 2 && !disciplines.find(d => d.name === discipline)?.enabled) return;
    if (next === 4 && !getDisciplineSetupClasses(disciplines.find(d => d.name === discipline)?.key as SetupCategory, betaAccess).includes(car)) return;
    pending.current = true;
    setSaving(true);
    setProgressError('');
    try {
      await onProgress?.(next === 2 ? 'discipline' : next === 3 ? 'vehicle' : 'plan', disciplines.find(d => d.name === discipline)?.key, next === 4 ? car : undefined);
      setSelectedDiscipline(discipline);
      setSelectedClass(next === 4 ? car : '');
      setStep(next);
    } catch { setProgressError('Your selection could not be saved. Please try again.'); }
    finally { pending.current = false; setSaving(false); }
  };


  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4 py-8 sm:py-12" role="main">
      <div className="w-full max-w-4xl" id="main-content">
        {/* Logo - displayed at 1.5x (h-[120px] -> h-[180px]); w-auto keeps aspect ratio */}
        <div className="text-center mb-7 sm:mb-9">
          <img
            src="/onlyfast-logo.png"
            alt="OnlyFast Setup Assist"
            className="h-28 sm:h-36 w-auto mx-auto mb-2"
          />

          <p className="text-[#6B7280] text-base sm:text-lg">Race Smarter. Finish Faster.</p>
        </div>

        {/* Progress */}
        <nav aria-label="Onboarding progress" className="flex items-center justify-center gap-2 sm:gap-3 mb-8">
          {steps.map((s, i) => {
            const displayStep = i + 1;
            return (
            <React.Fragment key={s.num}>
              {i > 0 && (
                <div className={`w-8 sm:w-12 h-1 rounded-full transition-all ${step >= s.num ? 'bg-[#00A8E8]' : 'bg-[#E5E7EB]'}`} aria-hidden="true" />
              )}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step >= s.num ? 'bg-[#00A8E8] text-white' : 'bg-white text-[#9CA3AF] border border-[#E5E7EB]'
                }`}
                aria-current={step === s.num ? 'step' : undefined}
                aria-label={`Step ${displayStep}: ${s.label}${step === s.num ? ' (current)' : step > s.num ? ' (completed)' : ''}`}
              >{step > s.num ? <Check className="h-5 w-5" aria-hidden="true" /> : displayStep}</div>
            </React.Fragment>
            );
          })}
        </nav>


        {/* Step 2: Discipline */}
        {(error || progressError) && <p className="mb-4 text-sm text-red-600" role="alert">{error || progressError}</p>}
        {saving && <p className="mb-4 text-sm text-[#6B7280]" role="status">Saving your selection…</p>}
        {step === 2 && (
          <section aria-labelledby="step2-heading">
            <div className="flex items-center gap-3 mb-6">
              <div>
                <h2 id="step2-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-[#1A1B23] outline-none">
                  Select Your Discipline
                </h2>
                <p className="text-[#6B7280] text-sm">Choose where you compete</p>
              </div>
            </div>

            <div className="space-y-4">
              {disciplines.map(disc => (
                <div key={disc.key} className="relative">
                  {disc.enabled && getDisciplineSetupClasses(disc.key as SetupCategory, betaAccess).length > 0 ? (
                    <button
                      onClick={() => advance(3, disc.name)}
                      disabled={saving}
                      className="w-full bg-white rounded-2xl border-2 border-[#E5E7EB] hover:border-[#00A8E8] p-5 sm:p-7 transition-all group shadow-sm hover:shadow-lg hover:shadow-[#00A8E8]/10 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                      aria-label={`${disc.name} - ${disc.description}`}
                    >
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#00A8E8]/10 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#00A8E8]/20 transition-colors" aria-hidden="true">
                          {disc.icon}
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-bold text-[#1A1B23] group-hover:text-[#00A8E8] transition-colors">
                            {disc.name}
                            {(disc.key === 'road_course' || disc.key === 'pavement_oval') && <span className="ml-2 inline-flex align-middle rounded border border-[#00A8E8]/20 bg-[#00A8E8]/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#00A8E8]">BETA</span>}
                          </h3>
                          <p className="text-[#6B7280] text-sm sm:text-base mt-1">
                            {disc.description}
                          </p>
                          {disc.key !== 'road_course' && <p className="text-gray-400 text-sm mt-2" aria-disabled="true">Custom Car — Coming Soon</p>}
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#9CA3AF] group-hover:text-[#00A8E8] transition-colors flex-shrink-0" aria-hidden="true">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </button>
                  ) : (
                    <div
                      className="relative w-full bg-gray-100 rounded-2xl border-2 border-gray-200 p-5 sm:p-7 cursor-not-allowed overflow-hidden select-none"
                      aria-disabled="true"
                      aria-label={`${disc.name} - Coming Soon`}
                    >
                      {/* Diagonal "Coming Soon" overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10" aria-hidden="true">
                        <div
                          className="bg-gray-500/80 text-white font-bold text-sm sm:text-lg tracking-widest uppercase text-center px-16 py-2 whitespace-nowrap"
                          style={{ transform: 'rotate(-18deg)', minWidth: '120%' }}
                        >
                          COMING SOON
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-6 text-gray-400 opacity-60">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 rounded-2xl flex items-center justify-center flex-shrink-0" aria-hidden="true">
                          {disc.icon}
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-bold text-gray-400">
                            {disc.name}
                          </h3>
                          <p className="text-[#6B7280] text-sm sm:text-base mt-1">
                            {disc.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Step 3: Car Selection */}
        {step === 3 && (
          <section aria-labelledby="step3-heading">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => advance(2)}
                disabled={saving}
                className="text-[#6B7280] hover:text-[#00A8E8] transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                aria-label="Go back to discipline selection"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <div>
                <h2 id="step3-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-[#1A1B23] outline-none">Select Your Car</h2>
                <p className="text-[#6B7280] text-sm">{selectedDiscipline || 'Dirt Track Oval'} <span aria-hidden="true">-</span> Choose the class you race in</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="group" aria-label="Car class options">
              {getDisciplineSetupClasses((disciplines.find(d => d.name === selectedDiscipline)?.key || 'dirt_oval') as SetupCategory, betaAccess).map((className) => {
                const config = EXPANDED_CLASS_CONFIGS[className] || CLASS_CONFIGS[className];
                const discipline = disciplines.find(d => d.name === selectedDiscipline);
                const hasBakedBlueTile = discipline?.key === 'pavement_oval' || discipline?.key === 'road_course';
                const isEnabled = className === CUSTOM_CAR
                  ? CUSTOM_CAR_DISCIPLINES[discipline?.key || ''] === true
                  : Boolean(config);

                if (isEnabled) {
                  return (
                    <button
                      key={className}
                      onClick={() => advance(4, selectedDiscipline, className)}
                      disabled={saving}
                      className="bg-white rounded-2xl border-2 border-[#E5E7EB] hover:border-[#00A8E8] p-6 transition-all group shadow-sm hover:shadow-lg hover:shadow-[#00A8E8]/10 text-left focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                      aria-label={`${config?.name || className} - ${config?.description || ''}`}
                    >
                      {/* Match the baked-in blue at rest; only the surround darkens on highlight. */}
                      <div className={`w-16 h-16 ${hasBakedBlueTile ? 'bg-[#DDEFFE]' : 'bg-[#00A8E8]/10'} rounded-xl overflow-hidden flex items-center justify-center mb-4 group-hover:bg-[#00A8E8]/20 transition-colors`} aria-hidden="true">
                        <img
                          src={getClassIcon(className, 'blue') || getClassIcon('Dwarf Cars', 'blue')}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-xl object-contain"
                        />
                      </div>
                      <h3 className="text-lg font-bold text-[#1A1B23] group-hover:text-[#00A8E8] transition-colors">
                        {config?.name || className}
                      </h3>
                      <p className="text-[#6B7280] text-sm mt-1">
                        {config?.description || ''}
                      </p>
                    </button>
                  );
                }

                // Disabled / Coming Soon class
                return (
                  <div
                    key={className}
                    className="relative bg-gray-100 rounded-2xl border-2 border-gray-200 p-6 opacity-60 cursor-not-allowed overflow-hidden select-none"
                    aria-disabled="true"
                    aria-label={`${className} - Coming Soon`}
                  >
                    {/* Diagonal "Coming Soon" overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div
                        className="bg-gray-500/80 text-white font-bold text-sm tracking-widest uppercase px-12 py-1.5 whitespace-nowrap"
                        style={{ transform: 'rotate(-18deg)', minWidth: '120%' }}
                      >
                        Coming Soon
                      </div>
                    </div>
                    <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center mb-4 text-gray-400" aria-hidden="true">
                      <img
                        src={getClassIcon(className, 'white') || getClassIcon('Dwarf Cars', 'white')}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 object-contain"
                      />
                    </div>
                    <h3 className="text-lg font-bold text-gray-400">
                      {className}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
                      {config?.description || ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {step === 4 && <PlanSelection userId={userId} onBack={() => advance(3)} onComplete={async () => {
          if (disciplines.find(d => d.name === selectedDiscipline)?.enabled
            && getDisciplineSetupClasses(disciplines.find(d => d.name === selectedDiscipline)?.key as SetupCategory, betaAccess).includes(selectedClass)) return onComplete(selectedClass);
          throw new Error('Choose a supported discipline and class first.');
        }} />}
      </div>
    </div>
  );

};

export default OnboardingFlow;
