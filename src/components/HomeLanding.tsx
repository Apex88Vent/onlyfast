import React from 'react';
import { ArrowLeft, ArrowRight, BarChart3, CalendarDays, CheckCircle2, CircleDashed, Library, Plus, Save, Trophy, Wrench, type LucideIcon } from 'lucide-react';
import { appendMedianPickerTrace } from '@/lib/medianPickerTrace';

export type HomeAction = 'new-setup' | 'saved' | 'schedule' | 'todo' | 'parts' | 'library' | 'previous-race' | 'current-race' | 'next-race';

interface CurrentWeekend {
  trackName?: string;
  date?: string;
  sessions?: {
    id?: string;
    label: string;
    status: 'complete' | 'in-progress' | 'not-started';
  }[];
}

interface UpcomingEvent {
  id?: string;
  track: string;
  date: string;
  endDate?: string;
  organization?: string;
}

interface PerformanceStat {
  label: string;
  value: string | number;
}

interface HomeLandingProps {
  selectedCar: string;
  carNumber?: string;
  nextEvent?: UpcomingEvent | null;
  currentWeekend?: CurrentWeekend | null;
  currentWeekendTitle?: 'Current Race Weekend' | 'Next Race Weekend';
  hasPreviousRace?: boolean;
  hasNextRace?: boolean;
  centerRaceLabel?: 'Current Race' | 'Upcoming Race';
  performanceStats?: PerformanceStat[];
  upcomingEvents?: UpcomingEvent[];
  middleSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
  onChangeClass: () => void;
  onAction: (action: HomeAction) => void;
}

const actionCards: {
  action: HomeAction;
  label: string;
  icon: LucideIcon;
}[] = [
  { action: 'new-setup', label: 'New Setup', icon: Plus },
  { action: 'saved', label: 'Continue Saved Setup', icon: Save },
  { action: 'schedule', label: 'Schedule', icon: CalendarDays },
  { action: 'todo', label: 'To-Do List', icon: CheckCircle2 },
  { action: 'parts', label: 'Parts Reference', icon: Wrench },
  { action: 'library', label: 'Setup Library', icon: Library },
];

const classIconWhitePaths: Record<string, string> = {
  'Dwarf Cars': '/onlyfast-class-icons/dwarf/dwarf-white.png',
  'Late Model': '/onlyfast-class-icons/dirt-late-model/dirt-late-model-white.png',
  'Lightning Sprints': '/onlyfast-class-icons/lightning-sprint/lightning-sprint-white.png',
  'Midgets': '/onlyfast-class-icons/midget/midget-white.png',
  'Modified': '/onlyfast-class-icons/modified/modified-white.png',
  'Non-Wing Sprint Cars': '/onlyfast-class-icons/non-wing-sprint/non-wing-sprint-white.png',
  'Pro Stock': '/onlyfast-class-icons/pure-stock/pure-stock-white.png',
  'Pure Stock': '/onlyfast-class-icons/pure-stock/pure-stock-white.png',
  'Sport Compact': '/onlyfast-class-icons/sport-compact/sport-compact-white.png',
  'Sport Mod': '/onlyfast-class-icons/modified/modified-white.png',
  'Winged Sprint Cars': '/onlyfast-class-icons/winged-sprint/winged-sprint-white.png',
};

const formatDate = (date?: string) => {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getDaysUntilEvent = (date?: string) => {
  if (!date) return null;
  const eventDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(eventDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);

  return Math.round((eventDate.getTime() - today.getTime()) / 86400000);
};

const getEventCountdown = (date?: string) => {
  const days = getDaysUntilEvent(date);
  if (days === null) return '';
  if (days === 0) return 'Today';
  if (days === 1) return '1 Day';
  if (days > 1) return `${days} Days`;
  return '';
};

const formatEventDate = (event?: UpcomingEvent | null) => {
  if (!event?.date) return '';
  const start = formatDate(event.date);
  if (!event.endDate || event.endDate === event.date) return start;
  return `${start} – ${formatDate(event.endDate)}`;
};

const formatCarNumber = (carNumber?: string) => {
  const trimmed = (carNumber || '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};

const trackLogoSrc = (trackName?: string) => {
  if (!trackName) return '';
  const slug = trackName
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `/track-logos/${slug}.png` : '';
};

const TrackLogoPanel: React.FC<{ trackName?: string }> = ({ trackName }) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const src = trackLogoSrc(trackName);

  return (
    <div className="hidden sm:flex overflow-hidden rounded-l-2xl bg-[#1A1B23] min-h-full relative items-end p-4">
      {src && !imageFailed && (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      )}
      {(imageFailed || !src) && (
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse at 48% 72%, rgba(185,135,72,0.95) 0 18%, rgba(102,74,43,0.9) 19% 27%, rgba(245,245,247,0.8) 28% 31%, rgba(35,43,54,0.95) 32% 100%)',
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-[#00A8E8]/10 via-transparent to-black/55" aria-hidden="true" />
      <div className="relative text-white font-extrabold uppercase leading-none text-xl drop-shadow">
        {(trackName || 'Track').split(' ').slice(0, 2).map(part => (
          <div key={part}>{part}</div>
        ))}
      </div>
    </div>
  );
};

const TrackLogoBadge: React.FC<{ trackName?: string }> = ({ trackName }) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const src = trackLogoSrc(trackName);
  const initials = (trackName || 'TR')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="relative h-10 w-10 rounded-xl overflow-hidden bg-[#1A1B23] flex-shrink-0 shadow-sm" aria-hidden="true">
      {src && !imageFailed && (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      )}
      {(imageFailed || !src) && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 48% 72%, rgba(185,135,72,0.95) 0 18%, rgba(102,74,43,0.9) 19% 27%, rgba(245,245,247,0.8) 28% 31%, rgba(35,43,54,0.95) 32% 100%)',
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-[#00A8E8]/20 via-transparent to-black/55" />
      <div className="relative h-full w-full flex items-center justify-center text-white text-xs font-extrabold drop-shadow">
        {initials}
      </div>
    </div>
  );
};

const HomeLanding: React.FC<HomeLandingProps> = ({
  selectedCar,
  carNumber,
  nextEvent,
  currentWeekend,
  currentWeekendTitle,
  hasPreviousRace = false,
  hasNextRace = false,
  centerRaceLabel = 'Current Race',
  performanceStats = [],
  upcomingEvents = [],
  middleSlot,
  bottomSlot,
  onChangeClass,
  onAction,
}) => {
  React.useEffect(() => {
    appendMedianPickerTrace('home_landing_mount', { scrollY: window.scrollY });
    return () => appendMedianPickerTrace('home_landing_unmount', { scrollY: window.scrollY });
  }, []);

  const displayedWeekend = currentWeekend;
  const nextEventCountdown = getEventCountdown(nextEvent?.date);
  const nextEventDate = formatEventDate(nextEvent);
  const showNextEvent = Boolean(nextEvent && nextEvent.track.trim());
  const showTopInfoCard = Boolean(selectedCar || showNextEvent);
  const showCurrentRaceWeekendCard = Boolean(
    displayedWeekend && (displayedWeekend.trackName || displayedWeekend.date || displayedWeekend.sessions?.length)
  );
  const displayedWeekendTitle = currentWeekendTitle || 'Current Race Weekend';
  const topInfoCount = (selectedCar ? 1 : 0) + (showNextEvent ? 1 : 0);
  const formattedCarNumber = formatCarNumber(carNumber);
  const selectedCarIcon = classIconWhitePaths[selectedCar];

  return (
    <div className="max-w-5xl mx-auto">
      <section className="mt-6 sm:mt-8 pb-0 text-center">
        <div className="flex flex-col items-center">
          <div className="w-[min(297px,70vw)] sm:w-[min(387px,63vw)] flex items-center justify-center">
            <img
              src="/onlyfast-logo.png"
              alt="OnlyFast"
              className="w-full h-auto"
            />
          </div>
          <p className="text-[13px] sm:text-xl font-semibold tracking-[0.12em] sm:tracking-[0.18em] text-[#4B5563] uppercase mt-2">
            Race Smarter. <span className="text-[#00A8E8]">Finish Faster.</span>
          </p>
        </div>
      </section>

      {middleSlot && (
        <div className="mb-2 sm:mb-4">
          {middleSlot}
        </div>
      )}

      {showTopInfoCard && (
        <section className="mb-2 sm:mb-6 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm px-3 sm:px-4 py-2.5 sm:py-4">
          <div className={`grid ${topInfoCount > 1 ? 'grid-cols-2 divide-x divide-[#E5E7EB]' : 'grid-cols-1'}`}>
            {selectedCar && (
              <button
                type="button"
                onClick={onChangeClass}
                className="flex items-center justify-center gap-2 sm:gap-3 px-1 sm:px-2 rounded-lg hover:bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                aria-label={`Change current class from ${selectedCar}`}
              >
                {selectedCarIcon && (
                  <img
                    src={selectedCarIcon}
                    alt=""
                    width={32}
                    height={32}
                    className="h-6 w-6 sm:h-8 sm:w-8 object-contain flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
                <div className="text-left min-w-0">
                  <div className="text-[#00A8E8] text-[12px] sm:text-sm font-semibold tracking-[0.08em] uppercase leading-tight">Current Car</div>
                  <div className="text-[#1A1B23] text-sm sm:text-lg font-medium truncate">{selectedCar}</div>
                  {formattedCarNumber && (
                    <div className="text-[#4B5563] text-xs sm:text-sm font-medium truncate">{formattedCarNumber}</div>
                  )}
                </div>
              </button>
            )}
            {showNextEvent && nextEvent && (
              <div className="flex items-center justify-center gap-2 sm:gap-3 px-1 sm:px-2">
                <CalendarDays className="h-6 w-6 sm:h-8 sm:w-8 text-[#00A8E8] flex-shrink-0" aria-hidden="true" />
                <div className="text-left min-w-0">
                  <div className="text-[#00A8E8] text-[12px] sm:text-sm font-semibold tracking-[0.08em] uppercase leading-tight">Next Event</div>
                  <div className="text-[#1A1B23] text-sm sm:text-lg font-medium truncate">{nextEventCountdown || nextEventDate}</div>
                  <div className="text-[#4B5563] text-xs sm:text-sm font-medium truncate">{nextEvent.track}</div>
                  {nextEventCountdown && nextEventDate && (
                    <div className="text-[#6B7280] text-[10px] sm:text-xs font-medium truncate">{nextEventDate}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-1.5 sm:gap-4 mb-2 sm:mb-5" aria-label="Home actions">
        {actionCards.map(({ action, label, icon: Icon }) => (
            <button
              key={action}
              onClick={() => onAction(action)}
              className="bg-white rounded-xl sm:rounded-2xl border border-[#E5E7EB] shadow-sm hover:shadow-md hover:border-[#00A8E8]/35 active:scale-[0.99] transition-all px-2 py-1 sm:p-6 min-h-[78px] sm:min-h-[200px] text-left grid grid-cols-[48px_minmax(0,1fr)] items-center justify-center gap-2 sm:flex sm:flex-col sm:text-center sm:gap-0 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
            >
              <span className="h-12 w-12 sm:h-16 sm:w-16 flex items-center justify-center text-[#00A8E8]">
                <Icon className="h-10 w-10 sm:h-16 sm:w-16" strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span className="block text-[18px] sm:text-[34px] font-semibold text-[#1A1B23] sm:mt-5 leading-tight">
                {label}
              </span>
            </button>
        ))}
      </section>

      {showCurrentRaceWeekendCard && displayedWeekend && (
        <section className="mb-2 sm:mb-4 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="grid sm:grid-cols-[34%_1fr]">
            <TrackLogoPanel trackName={displayedWeekend.trackName} />
            <div className="p-2.5 sm:p-5">
              <div className="text-[#00A8E8] text-[11px] sm:text-sm font-semibold uppercase tracking-[0.08em]">
                {displayedWeekendTitle}
              </div>
              <div className="flex items-center gap-2 mt-1 sm:mt-3">
                <div className="sm:hidden">
                  <TrackLogoBadge trackName={displayedWeekend.trackName} />
                </div>
                <div className="min-w-0">
                  {displayedWeekend.trackName && (
                    <h3 className="text-sm sm:text-2xl font-semibold text-[#1A1B23] uppercase tracking-wide truncate">
                      {displayedWeekend.trackName}
                    </h3>
                  )}
                  {displayedWeekend.date && (
                    <div className="text-[#4B5563] text-[11px] sm:text-base font-semibold mt-0.5 sm:mt-1">{formatDate(displayedWeekend.date)}</div>
                  )}
                </div>
              </div>
              {displayedWeekend.sessions && displayedWeekend.sessions.length > 0 && (
                <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] border-t border-[#E5E7EB] mt-1.5 sm:mt-4 pt-1.5 sm:pt-4">
                  {displayedWeekend.sessions.map(session => (
                    <div key={session.id || session.label} className="px-1 sm:px-2 first:pl-0 last:pr-0 flex items-start gap-1 sm:gap-2">
                      {session.status === 'complete' ? (
                        <span className="mt-0.5 h-4 w-4 sm:h-6 sm:w-6 rounded-full bg-[#00A8E8] text-white inline-flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
                        </span>
                      ) : (
                        <CircleDashed className="mt-0.5 h-4 w-4 sm:h-6 sm:w-6 text-[#00A8E8] flex-shrink-0" aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[12px] sm:text-sm font-semibold text-[#1A1B23] leading-tight">{session.label}</div>
                        <div className="text-[10px] sm:text-[11px] text-[#00A8E8] font-bold uppercase mt-0.5 sm:mt-1">
                          {session.status === 'complete' ? 'Complete' : session.status === 'in-progress' ? 'In Progress' : 'Not Started'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-1.5 sm:mt-5 grid grid-cols-3 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => onAction('previous-race')}
                  disabled={!hasPreviousRace}
                  className="border border-[#00A8E8] text-[#00A8E8] hover:bg-[#00A8E8]/10 px-1.5 sm:px-3 py-1.5 sm:py-3 rounded-xl text-[10px] sm:text-base font-bold transition-colors flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                >
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />
                  Previous Race
                </button>
                <button
                  type="button"
                  onClick={() => onAction('current-race')}
                  className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-1.5 sm:px-3 py-1.5 sm:py-3 rounded-xl text-[10px] sm:text-base font-bold transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                >
                  {centerRaceLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onAction('next-race')}
                  disabled={!hasNextRace}
                  className="border border-[#00A8E8] text-[#00A8E8] hover:bg-[#00A8E8]/10 px-1.5 sm:px-3 py-1.5 sm:py-3 rounded-xl text-[10px] sm:text-base font-bold transition-colors flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                >
                  Next Race
                  <ArrowRight className="h-3.5 w-3.5 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {performanceStats.length > 0 && (
        <section className="mb-2 sm:mb-4 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-3 sm:p-5">
          <div className="text-[#00A8E8] text-[11px] sm:text-sm font-semibold uppercase tracking-[0.08em] mb-2 sm:mb-4">Performance Summary</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
            {performanceStats.map(stat => (
              <div key={stat.label} className="rounded-xl sm:rounded-2xl border border-[#E5E7EB] bg-white min-h-[78px] sm:min-h-[200px] p-2 sm:p-4 text-center flex flex-col items-center justify-center">
                {stat.label === 'Wins' ? (
                  <Trophy className="h-5 w-5 sm:h-8 sm:w-8 text-[#00A8E8] mx-auto mb-1 sm:mb-2" aria-hidden="true" />
                ) : (
                  <BarChart3 className="h-5 w-5 sm:h-8 sm:w-8 text-[#00A8E8] mx-auto mb-1 sm:mb-2" aria-hidden="true" />
                )}
                <div className="text-xl sm:text-3xl font-extrabold text-[#1A1B23]">{stat.value}</div>
                <div className="text-[11px] sm:text-sm font-semibold text-[#4B5563] mt-0.5 sm:mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcomingEvents.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-3 sm:p-5">
          <div className="text-[#00A8E8] text-[11px] sm:text-sm font-semibold uppercase tracking-[0.08em] mb-1 sm:mb-3">Upcoming Events</div>
          <ul className="divide-y divide-[#E5E7EB]">
            {upcomingEvents.map(event => (
              <li key={`${event.date}-${event.track}`} className="py-1.5 sm:py-3 flex items-center gap-2 sm:gap-3">
                <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-[#00A8E8] flex-shrink-0" aria-hidden="true" />
                <div className="text-[#00A8E8] text-xs sm:text-base font-bold w-20 sm:w-28 flex-shrink-0">{formatDate(event.date)}</div>
                <div className="text-[#1A1B23] text-xs sm:text-base font-semibold min-w-0 truncate flex-1">{event.track}</div>
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-[#9CA3AF] flex-shrink-0" aria-hidden="true" />
              </li>
            ))}
          </ul>
          <button
            onClick={() => onAction('schedule')}
            className="mt-2 sm:mt-4 w-full border border-[#00A8E8] text-[#00A8E8] hover:bg-[#00A8E8]/10 px-4 py-2 sm:py-3 rounded-xl text-sm sm:text-lg font-bold transition-colors flex items-center justify-center gap-3 sm:gap-4 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          >
            View Full Schedule
            <ArrowRight className="h-4 w-4 sm:h-6 sm:w-6" aria-hidden="true" />
          </button>
        </section>
      )}

      {bottomSlot && (
        <div className="mt-2 sm:mt-4">
          {bottomSlot}
        </div>
      )}
    </div>
  );
};

export default HomeLanding;
