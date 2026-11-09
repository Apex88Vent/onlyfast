import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Gauge,
  Menu,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { PLANS } from '@/lib/membership';
import './public-home.css';

const storeLinks = {
  apple: 'https://apps.apple.com/us/app/onlyfast/id6792149373',
  google: 'https://play.google.com/store/apps/details?id=app.onlyfast',
};
const features = [
  {
    number: '01',
    icon: BookOpen,
    title: 'Setup Notebook',
    text: 'Record, organize, and compare race car setups across sessions and race weekends.',
    detail: 'Your baseline. Every adjustment. All in one place.',
  },
  {
    number: '02',
    icon: Sparkles,
    title: 'Setup Assist',
    text: 'Get intelligent setup recommendations based on vehicle settings, driver feedback, and available performance information.',
    detail: 'Turn what the car is telling you into your next change.',
  },
  {
    number: '03',
    icon: CalendarDays,
    title: 'Race Weekend Management',
    text: 'Manage race schedules, sessions, results, and your performance history.',
    detail: 'Stay organized from Hot Laps through the Main Event.',
  },
  {
    number: '04',
    icon: Gauge,
    title: 'Timing & Telemetry',
    text: 'Track lap times, upload timing results, and connect supported OnlyLaps session information.',
    detail: 'OnlyLaps access depends on supported sessions and availability.',
  },
];
const sections = ['Features', 'Pricing', 'Download'];

function StoreBadges() {
  return (
    <div className="of-store-badges">
      <a
        href={storeLinks.apple}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download OnlyFast on the Apple App Store"
      >
        <img
          src="/marketing/app-store.svg"
          alt="Download on the App Store"
          width="120"
          height="40"
          loading="lazy"
        />
      </a>
      <a
        href={storeLinks.google}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get OnlyFast on Google Play"
      >
        <img
          className="of-google-play-badge"
          src="/marketing/google-play.png"
          alt="Get it on Google Play"
          width="646"
          height="250"
          loading="lazy"
        />
      </a>
    </div>
  );
}

export default function PublicHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  return (
    <div className="of-public">
      <a className="of-skip" href="#main-content">
        Skip to content
      </a>
      <header className="of-header">
        <div className="of-container of-header-inner">
          <Link to="/" className="of-logo" aria-label="OnlyFast homepage">
            <img src="/onlyfast-logo.png" alt="OnlyFast" width="180" height="66" />
          </Link>
          <nav className="of-desktop-nav" aria-label="Main navigation">
            {sections.map((section) => (
              <a key={section} href={`#${section.toLowerCase()}`}>
                {section}
              </a>
            ))}
          </nav>
          <Link className="of-login" to="/login">
            Login
          </Link>
          <button
            ref={menuButton}
            className="of-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="of-mobile-navigation"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        {menuOpen && (
          <nav id="of-mobile-navigation" className="of-mobile-nav" aria-label="Mobile navigation">
            {sections.map((section) => (
              <a
                key={section}
                href={`#${section.toLowerCase()}`}
                onClick={() => setMenuOpen(false)}
              >
                {section}
              </a>
            ))}
            <Link to="/login">
              Login
            </Link>
          </nav>
        )}
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="of-hero" aria-labelledby="of-hero-title">
          <div className="of-hero-lines" aria-hidden="true" />
          <div className="of-container of-hero-grid">
            <div className="of-hero-copy">
              <div className="of-hero-intro">
                <h1 id="of-hero-title">
                  RACE SMARTER.
                  <br />
                  <span>FINISH FASTER.</span>
                </h1>
              </div>
              <div className="of-hero-details">
                <p className="of-hero-description">
                  The race setup and performance management platform built for racers.
                </p>
                <div className="of-actions">
                  <Link to="/app" className="of-button of-button-primary">
                    Launch Web App <ArrowRight size={19} aria-hidden="true" />
                  </Link>
                  <a href="#features" className="of-button of-button-outline">
                    Explore Features <ArrowDown size={17} aria-hidden="true" />
                  </a>
                </div>
                <p className="of-hero-note">
                  Start free with Rookie. Available on web, iOS & Android.
                </p>
              </div>
            </div>
            <div className="of-hero-visual">
              <img
                className="of-garage-lineup"
                src="/marketing/onlyfast-garage-portrait-800.webp"
                srcSet="/marketing/onlyfast-garage-portrait-480.webp 480w, /marketing/onlyfast-garage-portrait-800.webp 800w, /marketing/onlyfast-garage-portrait-1122.webp 1122w"
                sizes="(max-width: 760px) 100vw, (max-width: 980px) 60vw, (max-width: 1296px) 54vw, 640px"
                alt="OnlyFast blue, white, and gray winged sprint car, stock car, and Formula 4 car together in a garage"
                width="1122"
                height="1402"
                fetchPriority="high"
              />
            </div>
          </div>
          <div className="of-hero-bottom of-container">
            <span>YOUR RACE WEEKEND, CONNECTED.</span>
            <a href="#features">
              MEET YOUR NEW PIT TOOL <ArrowDown size={14} aria-hidden="true" />
            </a>
          </div>
        </section>

        <div className="of-discipline-strip" aria-label="Racing disciplines">
          <div className="of-container">
            <span>BUILT AROUND YOUR RACING</span>
            <strong>DIRT OVAL</strong>
            <i aria-hidden="true">/</i>
            <strong>PAVEMENT OVAL</strong>
            <i aria-hidden="true">/</i>
            <strong>ROAD COURSE</strong>
            <i aria-hidden="true">/</i>
            <strong>AND MORE</strong>
          </div>
        </div>

        <section
          id="features"
          className="of-section of-features"
          aria-labelledby="of-features-title"
        >
          <div className="of-container">
            <div className="of-section-heading">
              <div>
                <p className="of-eyebrow">01 / THE TOOLKIT</p>
                <h2 id="of-features-title">
                  LESS GUESSWORK.
                  <br />
                  MORE GOOD LAPS.
                </h2>
              </div>
              <p>
                From the shop to the checkered flag, keep the details that matter together. Build on
                what worked. Understand what changed.
              </p>
            </div>
            <div className="of-feature-grid">
              {features.map(({ number, icon: Icon, title, text, detail }) => (
                <article className="of-feature" key={number}>
                  <div className="of-feature-top">
                    <Icon size={27} strokeWidth={1.6} aria-hidden="true" />
                    <span>{number}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <div className="of-feature-detail">{detail}</div>
                </article>
              ))}
            </div>
            <div className="of-workflow">
              <span className="of-workflow-label">A BETTER RACE WEEKEND</span>
              <div>
                <span>Build your baseline</span>
                <ChevronRight aria-hidden="true" size={16} />
                <span>Record each session</span>
                <ChevronRight aria-hidden="true" size={16} />
                <span>Review & improve</span>
              </div>
              <Link to="/app">
                Get started <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section id="pricing" className="of-section of-pricing" aria-labelledby="of-pricing-title">
          <div className="of-container">
            <div className="of-section-heading">
              <div>
                <p className="of-eyebrow">02 / FIND YOUR PACE</p>
                <h2 id="of-pricing-title">
                  YOUR RACING.
                  <br />
                  YOUR PLAN.
                </h2>
              </div>
              <p>
                Start with the essentials. Get more room for your race car, or manage every car and
                class with Team.
              </p>
            </div>
            <div className="of-plan-grid">
              {PLANS.map((plan) => (
                <article
                  className={`of-plan ${plan.recommended ? 'of-plan-featured' : ''}`}
                  key={plan.tier}
                >
                  <div className="of-plan-heading">
                    <h3>{plan.tier.toUpperCase()}</h3>
                    {plan.recommended && <span>MOST POPULAR</span>}
                  </div>
                  <p className="of-plan-price">
                    {plan.tier === 'rookie' ? 'Free' : plan.priceDisplay.split('/')[0]}
                    {plan.tier !== 'rookie' && <span>/month</span>}
                  </p>
                  <p className="of-plan-description">{plan.description}</p>
                  <Link
                    className={`of-button ${plan.recommended ? 'of-button-primary' : 'of-button-light'}`}
                    to={plan.tier === 'rookie' ? '/app' : '/upgrade'}
                  >
                    {plan.tier === 'rookie' ? 'Start with Rookie' : 'View membership options'}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <ul>
                    {plan.synopsis.map((line) => (
                      <li key={line}>
                        <Check size={16} aria-hidden="true" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p className="of-pricing-note">
              Monthly membership pricing in USD. Store prices and available offers are shown in the
              app before purchase. Membership limits apply.
            </p>
          </div>
        </section>

        <section
          id="download"
          className="of-section of-download"
          aria-labelledby="of-download-title"
        >
          <div className="of-container of-download-grid">
            <div>
              <p className="of-eyebrow">03 / TAKE IT TO THE TRACK</p>
              <h2 id="of-download-title">
                IN THE SHOP.
                <br />
                IN THE PITS.
                <br />
                <span>IN YOUR POCKET.</span>
              </h2>
              <p>
                Your setups and race weekend tools, wherever racing takes you. Download OnlyFast for
                iOS or Android, or open the web app in your browser.
              </p>
              <StoreBadges />
              <Link className="of-download-web" to="/app">
                Prefer a bigger screen? Launch the Web App{' '}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="of-download-art" aria-hidden="true">
              <div className="of-phone">
                <div className="of-phone-camera" />
                <div className="of-phone-brand">
                  <img src="/onlyfast-logo.png" alt="" width="145" height="53" />
                </div>
                <span className="of-phone-kicker">YOUR RACE DAY TOOLKIT</span>
                <Smartphone size={39} strokeWidth={1.1} />
                <strong>
                  READY WHEN
                  <br />
                  YOU ARE.
                </strong>
                <div className="of-phone-tiles">
                  <span>
                    <BookOpen size={18} />
                    SETUPS
                  </span>
                  <span>
                    <CalendarDays size={18} />
                    SCHEDULE
                  </span>
                  <span>
                    <Gauge size={18} />
                    TIMING
                  </span>
                  <span>
                    <Sparkles size={18} />
                    ASSIST
                  </span>
                </div>
                <small>WEB · iOS · ANDROID</small>
              </div>
              <span className="of-art-caption">ONE PLATFORM. EVERY RACE WEEKEND.</span>
            </div>
          </div>
        </section>
      </main>

      <footer id="site-footer" className="of-footer">
        <div className="of-container">
          <div className="of-footer-main">
            <div>
              <Link to="/" aria-label="OnlyFast homepage">
                <img src="/onlyfast-logo.png" alt="OnlyFast" width="170" height="62" />
              </Link>
              <p>Race Smarter, Finish Faster.</p>
            </div>
            <nav aria-label="Footer navigation">
              {sections.map((section) => (
                <a key={section} href={`#${section.toLowerCase()}`}>
                  {section}
                </a>
              ))}
              <Link to="/login">Login</Link>
            </nav>
            <a className="of-contact" href="mailto:admin@onlyfast.app">
              LET’S TALK RACING
              <em>
                admin@onlyfast.app <ArrowRight size={16} aria-hidden="true" />
              </em>
            </a>
          </div>
          <div className="of-footer-bottom">
            <span>© {new Date().getFullYear()} OnlyFast. All rights reserved.</span>
            <div>
              <Link to="/privacy-policy">Privacy Policy</Link>
              <Link to="/terms-of-service">Terms of Service</Link>
              <Link to="/support">Support</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
