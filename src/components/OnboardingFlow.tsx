import React, { useState, useRef, useEffect } from 'react';
import { CAR_CLASSES, CLASS_CONFIGS } from '@/lib/classConfigs';

interface OnboardingFlowProps {
  onComplete: (car: string) => void;
}

const ENABLED_CLASSES = ['Dwarf Cars', 'Sport Mod'];

const carIcons: Record<string, React.ReactNode> = {
  'Dwarf Cars': (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="6" y="16" width="28" height="10" rx="3" stroke="#00A8E8" strokeWidth="2" />
      <rect x="10" y="12" width="16" height="8" rx="2" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="12" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="28" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
    </svg>
  ),
  'Late Model': (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="4" y="17" width="32" height="9" rx="2" stroke="#00A8E8" strokeWidth="2" />
      <path d="M10 17V12C10 11 11 10 12 10H28C29 10 30 11 30 12V17" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="11" cy="28" r="3.5" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="29" cy="28" r="3.5" stroke="#00A8E8" strokeWidth="2" />
      <path d="M30 14H36L34 17" stroke="#00A8E8" strokeWidth="1.5" opacity="0.6" />
    </svg>
  ),
  'Lightning Sprints': (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="8" y="18" width="24" height="8" rx="2" stroke="#00A8E8" strokeWidth="2" />
      <path d="M14 18V12L26 12V18" stroke="#00A8E8" strokeWidth="2" />
      <path d="M20 8V12" stroke="#00A8E8" strokeWidth="2" />
      <path d="M16 6H24" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="28" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
    </svg>
  ),
  'Midgets': (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="9" y="18" width="22" height="7" rx="2" stroke="#00A8E8" strokeWidth="2" />
      <path d="M14 18V14L26 14V18" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="13" cy="27" r="3" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="27" cy="27" r="3" stroke="#00A8E8" strokeWidth="2" />
      <path d="M7 22H9" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" />
      <path d="M31 22H33" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  'Modified': (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="5" y="17" width="30" height="9" rx="2" stroke="#00A8E8" strokeWidth="2" />
      <path d="M12 17V13L28 13V17" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="11" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="29" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
      <line x1="5" y1="17" x2="3" y2="20" stroke="#00A8E8" strokeWidth="1.5" opacity="0.5" />
      <line x1="35" y1="17" x2="37" y2="20" stroke="#00A8E8" strokeWidth="1.5" opacity="0.5" />
    </svg>
  ),
  'Non-Wing Sprint Cars': (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="8" y="18" width="24" height="8" rx="2" stroke="#00A8E8" strokeWidth="2" />
      <path d="M14 18V13L26 13V18" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="12" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="28" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
      <path d="M6 22H8" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 22H34" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  'Pro Stock': (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="4" y="17" width="32" height="9" rx="2" stroke="#00A8E8" strokeWidth="2" />
      <path d="M9 17V13C9 12 10 11 11 11H29C30 11 31 12 31 13V17" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="11" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="29" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
      <line x1="15" y1="13" x2="15" y2="17" stroke="#00A8E8" strokeWidth="1" opacity="0.4" />
      <line x1="25" y1="13" x2="25" y2="17" stroke="#00A8E8" strokeWidth="1" opacity="0.4" />
    </svg>
  ),
  'Pure Stock': (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="5" y="17" width="30" height="9" rx="2" stroke="#00A8E8" strokeWidth="2" />
      <path d="M10 17V14C10 13 11 12 12 12H28C29 12 30 13 30 14V17" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="12" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="28" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
    </svg>
  ),
  'Sport Compact': (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="7" y="18" width="26" height="8" rx="2" stroke="#00A8E8" strokeWidth="2" />
      <path d="M12 18V14C12 13 13 12 14 12H26C27 12 28 13 28 14V18" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="13" cy="28" r="2.5" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="27" cy="28" r="2.5" stroke="#00A8E8" strokeWidth="2" />
    </svg>
  ),
  'Sport Mod': (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="5" y="17" width="30" height="9" rx="2" stroke="#00A8E8" strokeWidth="2" />
      <path d="M11 17V13L29 13V17" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="11" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
      <circle cx="29" cy="28" r="3" stroke="#00A8E8" strokeWidth="2" />
      <line x1="5" y1="18" x2="3" y2="21" stroke="#00A8E8" strokeWidth="1.5" opacity="0.4" />
    </svg>
  ),
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
            src="https://d64gsuwffb70l.cloudfront.net/688263e7085fd34dcdf7f46a_1775752881652_48fe46d9.png"
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
                      <div className="w-16 h-16 bg-[#00A8E8]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#00A8E8]/20 transition-colors" aria-hidden="true">
                        {carIcons[className] || carIcons['Dwarf Cars']}
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
                      {carIcons[className] || carIcons['Dwarf Cars']}
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
