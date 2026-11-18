import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import OnboardingVisual from './OnboardingVisual';
import './onboarding-intro.css';

interface HowOnlyFastWorksProps {
  onComplete: () => void;
  onSkip?: () => void;
  onLogin?: () => void;
  isReplay?: boolean;
  pending?: boolean;
}

const slides = [
  { label: 'The next lap starts here', title: ['STOP GUESSING.', 'START GETTING FASTER.'], text: 'Every lap is an opportunity. Make every adjustment count.' },
  { label: '01 / Setup Notebook', title: ['EVERY SETUP.', 'EVERY CHANGE.'], text: 'Build, save, and track your race car setups in one place.' },
  { label: '02 / Setup Assist', title: ['YOUR RACE ENGINEER.', 'IN YOUR POCKET.'], text: 'Tell Setup Assist what your car is doing and get actionable setup recommendations.' },
  { label: 'A more informed next session', title: ['STOP CHASING', 'THE SETUP.'], text: 'Connect your adjustments, driver feedback, and on-track results.' },
  { label: '03 / OnlyFast Track Trace · BETA', title: ['SEE WHAT YOUR', 'CAR IS DOING.'], text: 'Turn GPS track data into a clearer picture of your performance.' },
  { label: 'Learn from every lap', title: ['THE CLOCK', 'DOESN’T LIE.'], text: 'Review your laps, analyze performance, and find opportunities to improve.' },
  { label: 'Prepared from the first green flag', title: ['YOUR ENTIRE RACE', 'WEEKEND. ORGANIZED.'], text: 'Schedules, session notes, lap times, race results, and more. All working together.' },
  { label: 'Your next chapter', title: ['FASTER', 'STARTS HERE.'], text: 'Better information. Smarter adjustments. More confidence every time you hit the track.' },
] as const;

export default function HowOnlyFastWorks({ onComplete, onSkip, onLogin, isReplay = false, pending = false }: HowOnlyFastWorksProps) {
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const slide = slides[index];
  const final = index === slides.length - 1;

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [index]);
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    // The isolated 2027 shell includes a testing notice above the app. Reserve
    // its actual height rather than adding a second full viewport below it.
    const fit = () => main.style.setProperty('--of-offset-top', `${Math.max(0, main.getBoundingClientRect().top)}px`);
    fit();
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
    };
  }, []);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const move = (delta: number) => {
    if (!pending) setIndex(current => Math.max(0, Math.min(slides.length - 1, current + delta)));
  };

  return <main id="main-content" ref={mainRef} className="of-intro" data-paused={hidden}>
    <section className="of-intro-frame" aria-roledescription="carousel" aria-label="Discover OnlyFast">
      <header className="of-intro-header">
        <div className="of-intro-brand"><img src="/onlyfast-logo.png" width="1250" height="455" alt="OnlyFast" /></div>
        <span className="of-intro-edition">THE 2027 SEASON <i aria-hidden="true" /></span>
        {onLogin && !isReplay && <button type="button" className="of-intro-login" disabled={pending} onClick={onLogin}>Already a member? Login here</button>}
      </header>
      {/* Only the active scene exists. Remounting restarts animations on revisit. */}
      <div key={index} className={`of-intro-slide of-intro-slide-${index + 1}`} role="group" aria-roledescription="slide" aria-label={`Slide ${index + 1} of 8`}
        onKeyDown={event => {
          if ((event.target as HTMLElement).closest('button')) return;
          if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
          if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
        }}
        onTouchStart={event => { const first = event.touches[0]; if (first) touch.current = { x: first.clientX, y: first.clientY }; }}
        onTouchCancel={() => { touch.current = null; }}
        onTouchEnd={event => {
          const start = touch.current; touch.current = null;
          const end = event.changedTouches[0];
          if (!start || !end) return;
          const x = end.clientX - start.x, y = end.clientY - start.y;
          if (Math.abs(x) >= 48 && Math.abs(x) > Math.abs(y)) move(x < 0 ? 1 : -1);
        }}>
        <div className="of-intro-copy">
          <p className="of-intro-eyebrow"><span aria-hidden="true" />{slide.label}</p>
          <h1 ref={headingRef} tabIndex={-1}>{slide.title[0]}<br />{' '}<span>{slide.title[1]}</span></h1>
          <p className="of-intro-description">{slide.text}</p>
          {final && <p className="of-intro-slogan">RACE SMARTER. FINISH FASTER.</p>}
        </div>
        <div className="of-intro-visual"><OnboardingVisual slide={index} /></div>
      </div>
      <footer className="of-intro-footer">
        <div className="of-intro-progress" aria-label="Introduction progress">
          <span className="of-intro-count"><b>{String(index + 1).padStart(2, '0')}</b> / 08</span>
          <div className="of-intro-segments" aria-hidden="true">{slides.map((_, i) => <span key={i} data-reached={i <= index} />)}</div>
        </div>
        <nav className="of-intro-navigation" aria-label="Introduction navigation">
          <button type="button" className="of-intro-back" onClick={() => move(-1)} disabled={index === 0 || pending} aria-label="Previous slide"><ArrowLeft size={18} aria-hidden="true" /><span>Back</span></button>
          <div className="of-intro-skip-slot">{index >= 4 && <button type="button" className="of-intro-skip" disabled={pending} onClick={() => { if (!pending) (onSkip || onComplete)(); }}>Skip Intro</button>}</div>
          <button type="button" className="of-intro-next" disabled={pending} onClick={() => { if (pending) return; if (final) onComplete(); else move(1); }}>
            {pending ? 'Saving…' : final ? (isReplay ? 'Back to OnlyFast' : 'LET’S GET FASTER') : 'Next'}<ArrowRight size={18} aria-hidden="true" />
          </button>
        </nav>
      </footer>
    </section>
  </main>;
}
