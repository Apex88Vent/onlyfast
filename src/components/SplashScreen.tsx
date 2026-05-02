import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing');

  // Check reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReducedMotion) {
      // Skip animation entirely for reduced motion users
      onComplete();
      return;
    }

    // Start fade-out after the main animation
    const fadeTimer = setTimeout(() => {
      setPhase('fading');
    }, 1400);

    // Complete and unmount after fade-out finishes
    const completeTimer = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, prefersReducedMotion]);

  if (phase === 'done') return null;

  return (
    <div
      className={`splash-screen ${phase === 'fading' ? 'splash-fade-out' : ''}`}
      role="status"
      aria-label="Loading OnlyFast Setup Assist"
      aria-live="polite"
    >
      {/* Dark overlay */}
      <div className="splash-overlay" aria-hidden="true" />

      {/* Background race car image with zoom */}
      <div className="splash-bg" aria-hidden="true">
        <img
          src="https://d64gsuwffb70l.cloudfront.net/69d2840337913981eed0ea87_1775572320088_88d2fe16.png"
          alt=""
          aria-hidden="true"
          className="splash-bg-img"
        />
      </div>

      {/* Radial vignette for cinematic feel */}
      <div className="splash-vignette" aria-hidden="true" />

      {/* Logo container with perspective */}
      <div className="splash-logo-container" aria-hidden="true">
        <div className="splash-logo-wrapper">
          <img
            src="https://d64gsuwffb70l.cloudfront.net/688263e7085fd34dcdf7f46a_1775752881652_48fe46d9.png"
            alt=""
            className="splash-logo"
          />
        </div>
        {/* Glow ring that appears as logo settles */}
        <div className="splash-glow-ring" />
      </div>

      {/* Screen reader text */}
      <span className="sr-only">Application is loading</span>

      <style>{`
        .splash-screen {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0f;
          perspective: 1200px;
          overflow: hidden;
          transition: opacity 0.5s ease-out;
        }

        .splash-fade-out {
          opacity: 0;
          pointer-events: none;
        }

        /* Dark overlay on top of background */
        .splash-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at center,
            rgba(0, 10, 20, 0.55) 0%,
            rgba(0, 5, 15, 0.85) 100%
          );
          z-index: 2;
        }

        /* Background image with slow zoom */
        .splash-bg {
          position: absolute;
          inset: -10%;
          z-index: 1;
          animation: splashBgZoom 2.2s ease-out forwards;
        }

        .splash-bg-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.45;
          filter: saturate(1.2) contrast(1.1);
        }

        @keyframes splashBgZoom {
          0% {
            transform: scale(1.05);
            filter: blur(0px);
          }
          100% {
            transform: scale(1.2);
            filter: blur(2px);
          }
        }

        /* Cinematic vignette */
        .splash-vignette {
          position: absolute;
          inset: 0;
          z-index: 3;
          background: radial-gradient(
            ellipse at center,
            transparent 30%,
            rgba(0, 0, 0, 0.7) 100%
          );
        }

        /* Logo container - centered with perspective */
        .splash-logo-container {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-style: preserve-3d;
        }

        /* Logo wrapper - handles the "coming toward you" animation */
        .splash-logo-wrapper {
          width: 175px;
          height: 175px;
          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 18%;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.95);
          box-shadow:
            0 0 40px rgba(0, 168, 232, 0.3),
            0 0 80px rgba(0, 168, 232, 0.1),
            0 20px 60px rgba(0, 0, 0, 0.5);
          animation: splashLogoApproach 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .splash-logo {
          width: 75%;
          height: 75%;
          object-fit: contain;
        }

        /* Logo: starts small/far, zooms toward viewer, morphs to circle */
        @keyframes splashLogoApproach {
          0% {
            transform: translateZ(-600px) scale(0.2) rotateY(-8deg);
            border-radius: 18%;
            opacity: 0;
            box-shadow:
              0 0 0px rgba(0, 168, 232, 0),
              0 0 0px rgba(0, 0, 0, 0);
          }
          15% {
            opacity: 1;
          }
          50% {
            transform: translateZ(-100px) scale(0.7) rotateY(-2deg);
            border-radius: 24%;
          }
          75% {
            transform: translateZ(20px) scale(1.05) rotateY(1deg);
            border-radius: 38%;
          }
          100% {
            transform: translateZ(0px) scale(1) rotateY(0deg);
            border-radius: 50%;
            opacity: 1;
            box-shadow:
              0 0 50px rgba(0, 168, 232, 0.4),
              0 0 100px rgba(0, 168, 232, 0.15),
              0 25px 70px rgba(0, 0, 0, 0.4);
          }
        }

        /* Glow ring that pulses once the logo settles */
        .splash-glow-ring {
          position: absolute;
          width: 213px;
          height: 213px;

          border-radius: 50%;
          border: 2px solid rgba(0, 168, 232, 0.5);
          animation: splashGlowExpand 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          pointer-events: none;
        }

        @keyframes splashGlowExpand {
          0% {
            transform: scale(0.2);
            opacity: 0;
            border-width: 4px;
          }
          60% {
            opacity: 0;
          }
          80% {
            opacity: 0.8;
            transform: scale(0.95);
            border-width: 2px;
          }
          100% {
            opacity: 0.4;
            transform: scale(1.15);
            border-width: 1px;
          }
        }

        /* Reduced motion: skip all animations */
        @media (prefers-reduced-motion: reduce) {
          .splash-screen {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
