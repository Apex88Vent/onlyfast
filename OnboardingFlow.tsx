import React, { useState, useRef, useEffect } from 'react';
import { CAR_CLASSES, CLASS_CONFIGS } from '@/lib/classConfigs';

interface OnboardingFlowProps {
  onComplete: (car: string) => void;
}

const ENABLED_CLASSES = ['Dwarf Cars', 'Sport Mod'];

const carIcons: Record<string, { blue: string; white: string }> = {
  'Dwarf Cars': {
    blue: '/onlyfast-class-icons/dwarf/dwarf-blue.png',
    white: '/onlyfast-class-icons/dwarf/dwarf-white.png',
  },
  'Late Model': {
    blue: '/onlyfast-class-icons/dirt-late-model/dirt-late-model-blue.png',
    white: '/onlyfast-class-icons/dirt-late-model/dirt-late-model-white.png',
  },
  'Lightning Sprints': {
    blue: '/onlyfast-class-icons/lightning-sprint/lightning-sprint-blue.png',
    white: '/onlyfast-class-icons/lightning-sprint/lightning-sprint-white.png',
  },
  'Midgets': {
    blue: '/onlyfast-class-icons/midget/midget-blue.png',
    white: '/onlyfast-class-icons/midget/midget-white.png',
  },
  'Modified': {
    blue: '/onlyfast-class-icons/modified/modified-blue.png',
    white: '/onlyfast-class-icons/modified/modified-white.png',
  },
  'Non-Wing Sprint Cars': {
    blue: '/onlyfast-class-icons/non-wing-sprint/non-wing-sprint-blue.png',
    white: '/onlyfast-class-icons/non-wing-sprint/non-wing-sprint-white.png',
  },
  'Pro Stock': {
    blue: '/onlyfast-class-icons/pure-stock/pure-stock-blue.png',
    white: '/onlyfast-class-icons/pure-stock/pure-stock-white.png',
  },
  'Pure Stock': {
    blue: '/onlyfast-class-icons/pure-stock/pure-stock-blue.png',
    white: '/onlyfast-class-icons/pure-stock/pure-stock-white.png',
  },
  'Sport Compact': {
    blue: '/onlyfast-class-icons/sport-compact/sport-compact-blue.png',
    white: '/onlyfast-class-icons/sport-compact/sport-compact-white.png',
  },
  'Sport Mod': {
    blue: '/onlyfast-class-icons/modified/modified-blue.png',
    white: '/onlyfast-class-icons/modified/modified-white.png',
  },
  'Winged Sprint Cars': {
    blue: '/onlyfast-class-icons/winged-sprint/winged-sprint-blue.png',
    white: '/onlyfast-class-icons/winged-sprint/winged-sprint-white.png',
  },
};

// Discipline definitions
const disciplines = [
  {
    key: 'dirt_oval',
    name: 'Dirt Track Oval',
    description: 'Short track oval racing on dirt surfaces. Configure chassis setups for optimal performance on clay and dirt.',
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
    description: 'Asphalt oval racing from short tracks to superspeedways. Setup optimization for pavement grip.',
    enabled: false,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <ellipse cx="24" cy="24" rx="20" ry="14" stroke="currentColor" strokeWidth="3" fill="none" />
        <ellipse cx="24" cy="24" rx="12" ry="7" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.4" />
        <rect x="14" y="22" width="20" height="4" rx="1" fill="currentColor" opacity="0.3" />
      </svg>
    ),
  },
  {
    key: 'road_course',
    name: 'Road Course',
    description: 'Left and right turns on paved road courses. Comprehensive setup for multi-directional handling.',
    enabled: false,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M8 36 C8 36 12 12 24 12 C36 12 40 36 40 36" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M14 36 C14 36 18 18 24 18 C30 18 34 36 34 36" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.4" strokeLinecap="round" />
        <circle cx="24" cy="12" r="3" fill="currentColor" opacity="0.5" />
      </svg>
    ),
  },
  {
    key: 'motorcycle',
    name: 'Motorcycle',
    description: 'Flat track, motocross, and road racing motorcycle setup tracking and optimization.',
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
    name: 'RC',
    description: 'Radio-controlled car racing setup management. Dial in your RC chassis for competition.',
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

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4" role="main">
      <div className="w-full max-w-3xl" id="main-content">
        {/* Logo - 25% larger than previous h-24 (96px → 120px) */}
        <div className="text-center mb-10">
          <img
            src="/onlyfast-logo.png"
            alt="OnlyFast Setup Assist"
            className="h-[120px] mx-auto mb-4"
          />
          <p className="text-[#6B7280] text-lg">Your Smart Setup Solutions</p>
        </div>

        {/* Progress */}
        <nav aria-label="Onboarding progress" className="flex items-center justify-center gap-3 mb-8">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              step >= 1 ? 'bg-[#00A8E8] text-white' : 'bg-white text-[#9CA3AF] border border-[#E5E7EB]'
            }`}
            aria-current={step === 1 ? 'step' : undefined}
            aria-label={`Step 1: Select discipline${step >= 1 ? ' (completed)' : ''}`}
          >1</div>
          <div className={`w-16 h-1 rounded-full transition-all ${step >= 2 ? 'bg-[#00A8E8]' : 'bg-[#E5E7EB]'}`} aria-hidden="true" />
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              step >= 2 ? 'bg-[#00A8E8] text-white' : 'bg-white text-[#9CA3AF] border border-[#E5E7EB]'
            }`}
            aria-current={step === 2 ? 'step' : undefined}
            aria-label={`Step 2: Select car${step >= 2 ? ' (current)' : ''}`}
          >2</div>
        </nav>

        {/* Step 1: Discipline */}
        {step === 1 && (
          <section aria-labelledby="step1-heading">
            <h2 id="step1-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-[#1A1B23] text-center mb-2 outline-none">
              Select Your Discipline
            </h2>
            <p className="text-[#6B7280] text-center mb-8">Choose your racing discipline to get started</p>

            <div className="space-y-4">
              {disciplines.map(disc => (
                <div key={disc.key} className="relative">
                  {disc.enabled ? (
                    <button
                      onClick={() => setStep(2)}
                      className="w-full bg-white rounded-2xl border-2 border-[#E5E7EB] hover:border-[#00A8E8] p-8 transition-all group shadow-sm hover:shadow-lg hover:shadow-[#00A8E8]/10 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                      aria-label={`${disc.name} - ${disc.description}`}
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-[#00A8E8]/10 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#00A8E8]/20 transition-colors" aria-hidden="true">
                          {disc.icon}
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-bold text-[#1A1B23] group-hover:text-[#00A8E8] transition-colors">
                            {disc.name}
                          </h3>
                          <p className="text-[#6B7280] mt-1">
                            {disc.description}
                          </p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#9CA3AF] group-hover:text-[#00A8E8] transition-colors flex-shrink-0" aria-hidden="true">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </button>
                  ) : (
                    <div
                      className="relative w-full bg-gray-100 rounded-2xl border-2 border-gray-200 p-8 opacity-60 cursor-not-allowed overflow-hidden select-none"
                      aria-disabled="true"
                      aria-label={`${disc.name} - Coming Soon`}
                    >
                      {/* Diagonal "Coming Soon" overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div
                          className="bg-gray-500/80 text-white font-bold text-lg tracking-widest uppercase px-16 py-2 whitespace-nowrap"
                          style={{ transform: 'rotate(-18deg)', minWidth: '120%' }}
                        >
                          Coming Soon
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-gray-400">
                        <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center flex-shrink-0" aria-hidden="true">
                          {disc.icon}
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-bold text-gray-400">
                            {disc.name}
                          </h3>
                          <p className="text-gray-400 mt-1">
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

        {/* Step 2: Car Selection */}
        {step === 2 && (
          <section aria-labelledby="step2-heading">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setStep(1)}
                className="text-[#6B7280] hover:text-[#00A8E8] transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                aria-label="Go back to discipline selection"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div>
                <h2 id="step2-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-[#1A1B23] outline-none">Select Your Car</h2>
                <p className="text-[#6B7280] text-sm">Choose the class you race in</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="group" aria-label="Car class options">
              {CAR_CLASSES.map((className) => {
                const config = CLASS_CONFIGS[className];
                const isEnabled = ENABLED_CLASSES.includes(className);

                if (isEnabled) {
                  return (
                    <button
                      key={className}
                      onClick={() => onComplete(className)}
                      className="bg-white rounded-2xl border-2 border-[#E5E7EB] hover:border-[#00A8E8] p-6 transition-all group shadow-sm hover:shadow-lg hover:shadow-[#00A8E8]/10 text-left focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                      aria-label={`${className} - ${config?.description || ''}`}
                    >
                      <div className="w-16 h-16 bg-[#00A8E8]/10 rounded-xl overflow-hidden flex items-center justify-center mb-4 group-hover:bg-[#00A8E8]/20 transition-colors" aria-hidden="true">
                        <img
                          src={(carIcons[className] || carIcons['Dwarf Cars']).blue}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-xl object-contain"
                        />
                      </div>
                      <h3 className="text-lg font-bold text-[#1A1B23] group-hover:text-[#00A8E8] transition-colors">
                        {className}
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
                        src={(carIcons[className] || carIcons['Dwarf Cars']).white}
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
      </div>
    </div>
  );
};

export default OnboardingFlow;
