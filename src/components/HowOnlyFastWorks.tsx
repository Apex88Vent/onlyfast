import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  CloudSun,
  FileText,
  Flag,
  Gauge,
  Layers3,
  LogIn,
  Rocket,
  Save,
  Share2,
  Sparkles,
  Timer,
  Trophy,
  Wrench,
  X,
} from 'lucide-react';

interface HowOnlyFastWorksProps {
  onComplete: () => void;
  onSkip?: () => void;
  onLogin?: () => void;
  isReplay?: boolean;
}

const REQUIRED_SLIDE_COUNT = 5;

const slides = [
  {
    title: 'Welcome to OnlyFast',
    text: "Your all in one garage tool for every type of racer; dirt track, road racing, pavement ovals, everything. If you race it, it's here! Save setups, get specific adjustments based on real data, manage your calendar, to do lists and a ton more!",
    button: "Let’s Get Faster",
    icon: Sparkles,
    accent: 'Built for race day',
    visual: 'welcome',
  },
  {
    title: 'Choose Your Car Class',
    text: 'Pick the class you race so OnlyFast can load the correct setup sheet, fields, and car-specific options.',
    button: 'Continue',
    icon: Gauge,
    accent: 'Class-specific setup fields',
    visual: 'classes',
  },
  {
    title: 'Build Your First Setup',
    text: 'Enter your starting setup before you hit the track. Track chassis settings, tire pressures, springs, shocks, stagger, gearing, notes, and custom fields.',
    button: 'Continue',
    icon: Save,
    accent: 'Your starting point',
    visual: 'setup',
  },
  {
    title: 'Race Weekend Workflow',
    text: 'Organize your race day by sessions like Hot Laps, Heat Race, and Main Event. Save changes as the track evolves and compare what worked.',
    button: 'Continue',
    icon: Flag,
    accent: 'Hot Laps · Heat · Main',
    visual: 'sessions',
  },
  {
    title: 'Ask OnlyFast',
    text: 'Use the Corner Handling Diagram to mark where the car feels tight, loose, or balanced. Ask OnlyFast combines that feedback with your setup, timing, and weather to suggest smarter changes.',
    button: 'Continue',
    icon: Wrench,
    accent: 'Setup Assist',
    visual: 'advice',
  },
  {
    title: 'Timing Scan',
    text: 'Upload or scan timing results from MyRacePass or Race Monitor. OnlyFast can pull lap times, fastest lap, average lap, start/finish position, and position gain.',
    button: 'Continue',
    icon: Camera,
    accent: 'Timing scan',
    visual: 'scan',
  },
  {
    title: 'Weather-Aware Adjustments',
    text: 'Weather matters. OnlyFast can use conditions like temperature, humidity, and track changes to help guide smarter setup decisions.',
    button: 'Continue',
    icon: CloudSun,
    accent: 'Track conditions',
    visual: 'weather',
  },
  {
    title: 'Save, Compare, Improve',
    text: 'Every saved race weekend helps you build a personal setup library. Look back at what worked at each track and make better decisions next time.',
    button: 'Continue',
    icon: BarChart3,
    accent: 'Find the pattern',
    visual: 'compare',
  },
  {
    title: 'Share and Export',
    text: 'Export setup sheets to PDF or share a setup with a code. Great for teammates, crew chiefs, or keeping printed notes in the trailer.',
    button: 'Continue',
    icon: Share2,
    accent: 'Crew ready',
    visual: 'share',
  },
  {
    title: 'Leaderboards and Practice Timing',
    text: 'Fast lap leaderboards and GPS-based practice timing are being developed to help racers compare laps, tracks, and progress over time.',
    button: 'Continue',
    icon: Timer,
    accent: 'Coming soon',
    visual: 'timing',
  },
  {
    title: 'Choose How You Race',
    text: 'Rookie is always free and ad-supported. Pro unlocks more tools for individual racers. Team is built for multiple cars and classes.',
    button: 'Continue',
    icon: Trophy,
    accent: 'Pick your lane',
    visual: 'plans',
  },
  {
    title: 'Ready to Build Speed?',
    text: 'Start with your first setup, save your race weekend, and let OnlyFast help you make better changes every time you hit the track.',
    button: 'Pick My Plan',
    icon: Rocket,
    accent: 'Ready to race',
    visual: 'ready',
  },
];

const HowOnlyFastWorks: React.FC<HowOnlyFastWorksProps> = ({
  onComplete,
  onSkip,
  onLogin,
  isReplay = false,
}) => {
  const [index, setIndex] = useState(0);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [mouseStartX, setMouseStartX] = useState<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const slide = slides[index];
  const Icon = slide.icon;
  const isFinal = index === slides.length - 1;
  const canSkip = !isFinal && index >= REQUIRED_SLIDE_COUNT;
  const canShowLogin = Boolean(onLogin);

  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  const finish = () => {
    onComplete();
  };

  const skip = () => {
    (onSkip || onComplete)();
  };

  const goNext = () => {
    if (!isFinal) setIndex((current) => Math.min(current + 1, slides.length - 1));
  };

  const goPrevious = () => {
    setIndex((current) => Math.max(current - 1, 0));
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    setDragStartX(touch.clientX);
    setDragStartY(touch.clientY);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (dragStartX == null || dragStartY == null) return;
    const touch = event.changedTouches[0];
    setDragStartX(null);
    setDragStartY(null);
    if (!touch) return;

    const deltaX = touch.clientX - dragStartX;
    const deltaY = touch.clientY - dragStartY;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0) {
      goNext();
    } else {
      goPrevious();
    }
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    setMouseStartX(event.clientX);
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLElement>) => {
    if (mouseStartX == null) return;
    const deltaX = event.clientX - mouseStartX;
    setMouseStartX(null);
    if (Math.abs(deltaX) < 60) return;

    if (deltaX < 0) {
      goNext();
    } else {
      goPrevious();
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4 py-6" role="main">
      <style>{`
        @keyframes onlyfastSlideIn {
          from { opacity: 0; transform: translateX(22px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes onlyfastDotPop {
          0% { transform: scale(.8); }
          70% { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        @keyframes onlyfastPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 168, 232, .32); }
          50% { box-shadow: 0 0 0 10px rgba(0, 168, 232, 0); }
        }
        @keyframes onlyfastFieldReveal {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes onlyfastScanLine {
          0% { transform: translateY(-10%); opacity: .25; }
          20%, 85% { opacity: 1; }
          100% { transform: translateY(220px); opacity: .1; }
        }
        @keyframes onlyfastTrackPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0, 168, 232, .28); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(0, 168, 232, 0); }
        }
        @keyframes onlyfastFeelHighlight {
          0%, 28%, 100% { transform: translateY(0); }
          45%, 65% { transform: translateY(-2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .onlyfast-animated, .onlyfast-pulse, .onlyfast-field, .onlyfast-scan-line, .onlyfast-dot, .onlyfast-track-pulse, .onlyfast-feel-highlight {
            animation: none !important;
          }
        }
      `}</style>

      <section
        key={index}
        aria-labelledby="how-onlyfast-title"
        className="onlyfast-animated w-full max-w-[430px] rounded-[2rem] border border-[#E5E7EB] bg-white p-5 shadow-2xl shadow-slate-900/10"
        style={{ animation: 'onlyfastSlideIn 260ms ease-out' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <div className="flex items-center justify-between gap-3">
          <img src="/onlyfast-logo.png" alt="OnlyFast" className="h-16 w-auto object-contain" />
          <button
            type="button"
            onClick={isReplay ? finish : skip}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[#6B7280] transition-colors hover:bg-[#F5F5F7] hover:text-[#1A1B23] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] ${
              isReplay || canSkip ? '' : 'invisible pointer-events-none'
            }`}
            aria-label={isReplay ? 'Close onboarding' : 'Skip onboarding'}
            aria-hidden={!isReplay && !canSkip}
            tabIndex={!isReplay && !canSkip ? -1 : undefined}
          >
            {isReplay ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {isReplay ? 'Close' : 'Skip'}
          </button>
        </div>

        <div className="px-1 pt-5">
          <h1 id="how-onlyfast-title" ref={headingRef} tabIndex={-1} className="text-2xl font-black tracking-tight text-[#1A1B23] outline-none">
            {slide.title}
          </h1>
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-[#E5E7EB] bg-gradient-to-br from-white via-[#F7FBFD] to-[#EAF7FC] p-4 text-[#1A1B23] shadow-inner shadow-white">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#007EAE]">
            <Icon className="h-4 w-4" aria-hidden="true" />
            {slide.accent}
          </div>
          <div className="mt-4 min-h-[218px]">
            {slide.visual === 'welcome' && (
              <div className="grid gap-3">
                {['Setup notebook', 'Timing results', 'Real setup advice'].map((label, i) => (
                  <div key={label} className="rounded-2xl border border-[#D8EEF7] bg-white p-3 shadow-sm" style={{ opacity: 1 - i * 0.05 }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{label}</span>
                      <span className="h-2 w-16 rounded-full bg-[#00A8E8]" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {slide.visual === 'classes' && (
              <div className="grid grid-cols-2 gap-3">
                {['Dwarf Car', 'Sprint Car', 'Modified', 'Sport Mod', 'Pro Stock', 'Pure Stock', 'Lightning Sprint'].map((label) => (
                  <div key={label} className="rounded-2xl border border-[#D8EEF7] bg-white p-3 shadow-sm">
                    <Gauge className="mb-2 h-6 w-6 text-[#00A8E8]" aria-hidden="true" />
                    <p className="text-sm font-bold leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {slide.visual === 'setup' && (
              <div className="space-y-3">
                {['Tire pressures', 'Springs / shocks', 'Stagger', 'Custom notes'].map((label, i) => (
                  <div
                    key={label}
                    className="onlyfast-field rounded-2xl border border-[#D8EEF7] bg-white p-3 text-[#1A1B23] shadow-sm"
                    style={{ animation: `onlyfastFieldReveal 320ms ease-out ${i * 130}ms both` }}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">{label}</div>
                    <div className="mt-2 h-2 rounded-full bg-[#E5E7EB]">
                      <div className="h-2 rounded-full bg-[#00A8E8]" style={{ width: `${58 + i * 9}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {slide.visual === 'sessions' && (
              <div className="space-y-4 pt-2">
                {['Hot Laps', 'Heat Race', 'Main Event'].map((label, i) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00A8E8] text-sm font-black text-white shadow-sm">{i + 1}</div>
                    <div className="flex-1 rounded-2xl border border-[#D8EEF7] bg-white p-3 shadow-sm">
                      <p className="text-sm font-bold">{label}</p>
                      <p className="text-xs text-[#6B7280]">Setup + handling notes</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {slide.visual === 'advice' && (
              <div className="rounded-3xl border border-[#D8EEF7] bg-white p-4 text-[#1A1B23] shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-[#1A1B23]">Corner Handling Diagram</span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-2">
                  <svg
                    viewBox="0 0 600 280"
                    className="w-full"
                    role="img"
                    aria-label="Corner Handling Diagram preview with Entry, Mid, and Exit handling zones"
                  >
                    <defs>
                      <linearGradient id="onboardingDirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#C4A882" />
                        <stop offset="100%" stopColor="#B89B72" />
                      </linearGradient>
                      <linearGradient id="onboardingInfieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#7CB668" />
                        <stop offset="100%" stopColor="#6AA856" />
                      </linearGradient>
                    </defs>

                    <rect x="0" y="0" width="600" height="280" fill="#F9FAFB" rx="12" />
                    <path d="M 580 40 L 200 40 A 100 100 0 0 0 200 240 L 580 240" fill="url(#onboardingDirtGrad)" stroke="#A08560" strokeWidth="2" />
                    <path d="M 580 80 L 240 80 A 60 60 0 0 0 240 200 L 580 200" fill="url(#onboardingInfieldGrad)" stroke="#5A9A48" strokeWidth="2" />
                    <path d="M 580 60 L 220 60 A 80 80 0 0 0 220 220 L 580 220" fill="none" stroke="#1A1B23" strokeWidth="1.5" strokeDasharray="10 5" opacity="0.12" />

                    <path d="M 350 40 L 200 40 A 100 100 0 0 0 140 80 L 210 100 A 60 60 0 0 1 240 80 L 350 80 Z" fill="#9CA3AF" opacity="0.2" stroke="#9CA3AF" strokeWidth="2" />
                    <rect x="270" y="48" width="70" height="24" rx="6" fill="#9CA3AF" opacity="0.9" />
                    <text x="305" y="57" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">ENTRY</text>
                    <text x="305" y="67" textAnchor="middle" fontSize="7" fill="white">Tap to Set</text>

                    <path d="M 140 80 A 100 100 0 0 0 140 200 L 195 170 A 60 60 0 0 1 195 110 Z" fill="#3B82F6" opacity="0.25" stroke="#3B82F6" strokeWidth="2" />
                    <text x="155" y="145" textAnchor="middle" fontSize="12" fill="#3B82F6" fontWeight="bold" opacity="0.6">|</text>
                    <rect x="110" y="128" width="60" height="24" rx="6" fill="#3B82F6" opacity="0.9" />
                    <text x="140" y="137" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">MID</text>
                    <text x="140" y="147" textAnchor="middle" fontSize="7" fill="white">Tight</text>

                    <g className="onlyfast-track-pulse" style={{ animation: 'onlyfastTrackPulse 2.4s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
                      <path d="M 140 200 A 100 100 0 0 0 200 240 L 350 240 L 350 200 L 240 200 A 60 60 0 0 1 195 170 Z" fill="#EF4444" opacity="0.25" stroke="#EF4444" strokeWidth="2" />
                      <text x="330" y="223" textAnchor="middle" fontSize="12" fill="#EF4444" fontWeight="bold" opacity="0.6">~</text>
                      <rect x="270" y="208" width="70" height="24" rx="6" fill="#EF4444" opacity="0.9" />
                      <text x="305" y="217" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">EXIT</text>
                      <text x="305" y="227" textAnchor="middle" fontSize="7" fill="white">Loose</text>
                    </g>
                  </svg>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Corner Handling Diagram options preview">
                  {[
                    ['Tight', '#3B82F6', '|'],
                    ['Loose', '#EF4444', '~'],
                    ['Perfect', '#22C55E', '+'],
                  ].map(([feel, color, symbol]) => (
                    <div
                      key={feel}
                      className={`rounded-2xl border px-2 py-2 text-center text-xs font-black shadow-sm ${
                        feel === 'Loose'
                          ? 'onlyfast-feel-highlight text-white'
                          : 'bg-[#F5F5F7] text-[#4B5563]'
                      }`}
                      style={{
                        borderColor: color,
                        backgroundColor: feel === 'Loose' ? color : undefined,
                        animation: feel === 'Loose' ? 'onlyfastFeelHighlight 2.4s ease-in-out infinite' : undefined,
                      }}
                    >
                      <span aria-hidden="true">{symbol}</span> {feel}
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-2xl border border-[#00A8E8]/20 bg-[#00A8E8]/10 p-3 text-xs font-semibold leading-5 text-[#007EAE]">
                  Setup + weather + feedback checked
                </div>
              </div>
            )}

            {slide.visual === 'scan' && (
              <div className="relative overflow-hidden rounded-3xl border border-[#D8EEF7] bg-white p-4 text-[#1A1B23] shadow-sm">
                <div className="mb-3 flex items-center justify-between text-xs font-bold text-[#6B7280]">
                  <span>Timing Results</span>
                  <span>Lap</span>
                </div>
                {[1, 2, 3, 4, 5].map((row) => (
                  <div key={row} className="mb-2 grid grid-cols-[1fr_60px] gap-3 rounded-xl bg-[#F5F5F7] px-3 py-2 text-xs">
                    <span>Car #{20 + row}</span>
                    <span className="font-bold text-[#00A8E8]">14.{row}8</span>
                  </div>
                ))}
                <div className="onlyfast-scan-line absolute left-0 right-0 top-0 h-1 bg-[#00A8E8] shadow-[0_0_20px_rgba(0,168,232,.9)]" style={{ animation: 'onlyfastScanLine 2s ease-in-out infinite' }} />
              </div>
            )}

            {slide.visual === 'weather' && (
              <div className="rounded-3xl border border-[#D8EEF7] bg-white p-4 text-[#1A1B23] shadow-sm">
                {[
                  ['Temperature', '78°'],
                  ['Humidity', '42%'],
                  ['Track trend', 'Slicking off'],
                ].map(([label, value]) => (
                  <div key={label} className="mb-3 flex items-center justify-between rounded-2xl bg-[#F5F5F7] px-3 py-2">
                    <span className="text-sm font-semibold text-[#4B5563]">{label}</span>
                    <span className="text-sm font-black text-[#00A8E8]">{value}</span>
                  </div>
                ))}
                <div className="rounded-2xl border border-[#00A8E8]/20 bg-[#00A8E8]/10 p-3 text-sm font-semibold text-[#007EAE]">
                  Compare setup changes against race-day conditions.
                </div>
              </div>
            )}

            {slide.visual === 'compare' && (
              <div className="rounded-3xl border border-[#D8EEF7] bg-white p-4 text-[#1A1B23] shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold">
                  <Layers3 className="h-5 w-5 text-[#00A8E8]" aria-hidden="true" />
                  Setup library
                </div>
                {['Baseline', 'Heat changes', 'Main result'].map((label, i) => (
                  <div key={label} className="mb-3">
                    <div className="mb-1 flex justify-between text-xs font-semibold text-[#6B7280]">
                      <span>{label}</span>
                      <span>{i === 2 ? 'Best' : 'Saved'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#E5E7EB]">
                      <div className="h-2 rounded-full bg-[#00A8E8]" style={{ width: `${48 + i * 22}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {slide.visual === 'share' && (
              <div className="rounded-3xl border border-[#D8EEF7] bg-white p-4 text-[#1A1B23] shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <FileText className="h-5 w-5 text-[#00A8E8]" aria-hidden="true" />
                  Setup Sheet
                </div>
                <div className="mt-4 rounded-2xl bg-[#F5F5F7] p-3 text-sm text-[#4B5563]">PDF export ready</div>
                <div className="mt-3 rounded-2xl border border-[#00A8E8]/20 bg-[#00A8E8]/10 p-3 text-sm font-semibold text-[#007EAE]">
                  Share code: OF-4827
                </div>
              </div>
            )}

            {slide.visual === 'timing' && (
              <div className="rounded-3xl border border-[#D8EEF7] bg-white p-4 text-[#1A1B23] shadow-sm">
                {['Fast lap leaderboard', 'GPS practice timing', 'Track progress'].map((label, i) => (
                  <div key={label} className="mb-3 flex items-center gap-3 rounded-2xl bg-[#F5F5F7] px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00A8E8] text-xs font-black text-white">{i + 1}</div>
                    <span className="text-sm font-semibold text-[#4B5563]">{label}</span>
                  </div>
                ))}
              </div>
            )}

            {slide.visual === 'plans' && (
              <div className="grid gap-3">
                {['Rookie', 'Pro', 'Team'].map((plan, i) => (
                  <div key={plan} className={`rounded-2xl border p-4 shadow-sm ${i === 1 ? 'border-[#00A8E8] bg-[#EAF7FC]' : 'border-[#D8EEF7] bg-white'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{plan}</span>
                      {i === 1 ? <Check className="h-5 w-5 text-[#00A8E8]" aria-hidden="true" /> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {slide.visual === 'ready' && (
              <div className="rounded-3xl border border-[#D8EEF7] bg-white p-5 text-center text-[#1A1B23] shadow-sm">
                <Rocket className="mx-auto h-12 w-12 text-[#00A8E8]" aria-hidden="true" />
                <div className="mt-4 rounded-2xl bg-[#F5F5F7] p-3 text-sm font-semibold text-[#4B5563]">
                  First setup → race weekend → smarter changes
                </div>
                <div className="mt-3 h-2 rounded-full bg-[#E5E7EB]">
                  <div className="h-2 rounded-full bg-[#00A8E8]" style={{ width: '100%' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-1 pt-5">
          <p className="mt-2 min-h-[72px] text-sm leading-6 text-[#6B7280]">{slide.text}</p>

          <div className="mt-5 flex items-center justify-center gap-2" aria-label={`Slide ${index + 1} of ${slides.length}`}>
            {slides.map((item, dotIndex) => (
              <button
                key={item.title}
                type="button"
                onClick={() => {
                  if (dotIndex <= index) setIndex(dotIndex);
                }}
                disabled={dotIndex > index}
                className={`onlyfast-dot h-2.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2 disabled:cursor-not-allowed ${
                  dotIndex === index ? 'w-8 bg-[#00A8E8]' : 'w-2.5 bg-[#D1D5DB]'
                }`}
                style={dotIndex === index ? { animation: 'onlyfastDotPop 220ms ease-out' } : undefined}
                aria-label={dotIndex > index ? `Slide ${dotIndex + 1}: ${item.title}` : `Go to slide ${dotIndex + 1}: ${item.title}`}
                aria-current={dotIndex === index ? 'step' : undefined}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => (isFinal ? finish() : goNext())}
            className="onlyfast-pulse mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00A8E8] px-5 py-4 text-base font-black text-white transition-all hover:-translate-y-0.5 hover:bg-[#0090c7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
            style={{ animation: 'onlyfastPulse 2.2s ease-in-out infinite' }}
          >
            {slide.button}
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>

          {index === 0 && canShowLogin && (
            <button
              type="button"
              onClick={onLogin}
              className="mx-auto mt-4 flex items-center gap-1 rounded-full text-xs font-semibold text-[#007EAE] hover:text-[#00A8E8] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Already a member? Login here
            </button>
          )}

          {!isReplay && canSkip && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={skip}
                className="rounded-full text-xs font-semibold text-[#6B7280] hover:text-[#00A8E8] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
              >
                Skip to plans
              </button>
              {canShowLogin && (
                <button
                  type="button"
                  onClick={onLogin}
                  className="flex items-center gap-1 rounded-full text-xs font-semibold text-[#007EAE] hover:text-[#00A8E8] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                >
                  <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                  Already a member? Login here
                </button>
              )}
            </div>
          )}

          {!isReplay && isFinal && canShowLogin && (
            <button
              type="button"
              onClick={onLogin}
              className="mx-auto mt-4 flex items-center gap-1 rounded-full text-xs font-semibold text-[#007EAE] hover:text-[#00A8E8] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Already a member? Login here
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export default HowOnlyFastWorks;
