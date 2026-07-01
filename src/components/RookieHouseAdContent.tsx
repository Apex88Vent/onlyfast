import React, { type CSSProperties, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Flag,
  Gauge,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { setPendingPlan } from '@/lib/membership';
import { hideExternalPayments } from '@/lib/paymentVisibility';
import type { RookieAdPlacement, RookieAdSlotProps } from './RookieAdSlot';

interface RookieAdSlide {
  title: string;
  body?: string;
  subtext?: string;
  icon: LucideIcon;
  visual?: 'car' | 'flag' | 'logo' | 'icon';
  tone?: 'red' | 'blue' | 'pro';
}

interface RookieAdConfig {
  theme: string;
  accent: string;
  softAccent: string;
  background: string;
  carType: string;
  slides: RookieAdSlide[];
  chips: string[];
}

const LOGO_SRC = '/onlyfast-logo.png';
const RACE_BACKGROUNDS = {
  dwarf: '/rookie-ads/dwarf-car-bg.png',
  pavementStock: '/rookie-ads/pavement-stock-bg.png',
  wingedSprint: '/rookie-ads/winged-sprint-bg.png',
  wingedSprintCentered: '/rookie-ads/winged-sprint-centered-bg.png',
  indycar: '/rookie-ads/indycar-bg.png',
} as const;
const FINAL_COPY = 'Unlock all features. No ads.';
const FINAL_TITLE = 'Go Pro today!';
const FINAL_PRICE = '$5/mo';

const compactPlacementCopy: Record<Exclude<RookieAdPlacement, 'after_save_interstitial'>, RookieAdConfig> = {
  home_middle: {
    theme: 'Quick Pro teaser',
    accent: '#EF1B1B',
    softAccent: '#06080C',
    background: RACE_BACKGROUNDS.dwarf,
    carType: 'dwarf car',
    slides: [
      { title: 'Race smarter', icon: Gauge, visual: 'car', tone: 'red' },
      { title: 'Finish faster', icon: Flag, visual: 'flag', tone: 'blue' },
      { title: FINAL_TITLE, subtext: FINAL_COPY, body: FINAL_PRICE, icon: Sparkles, visual: 'logo', tone: 'pro' },
    ],
    chips: [],
  },
  home_bottom: {
    theme: 'Workflow / clutter reduction',
    accent: '#008CFF',
    softAccent: '#050B13',
    background: RACE_BACKGROUNDS.pavementStock,
    carType: 'pavement stock car',
    slides: [
      { title: 'Less clutter', icon: Gauge, visual: 'car', tone: 'red' },
      { title: 'More setup flow', icon: Flag, visual: 'flag', tone: 'blue' },
      { title: FINAL_TITLE, subtext: FINAL_COPY, body: FINAL_PRICE, icon: Sparkles, visual: 'logo', tone: 'pro' },
    ],
    chips: [],
  },
  setup_track_conditions: {
    theme: 'Track and setup workflow',
    accent: '#EF1B1B',
    softAccent: '#06080C',
    background: RACE_BACKGROUNDS.wingedSprintCentered,
    carType: 'winged sprint car',
    slides: [
      { title: 'Read the track', icon: Gauge, visual: 'car', tone: 'red' },
      { title: 'Tune smarter', icon: Flag, visual: 'flag', tone: 'blue' },
      { title: FINAL_TITLE, subtext: FINAL_COPY, body: FINAL_PRICE, icon: Sparkles, visual: 'logo', tone: 'pro' },
    ],
    chips: [],
  },
  setup_dashboard_bottom: {
    theme: 'Setup notebook',
    accent: '#00A8E8',
    softAccent: '#050B13',
    background: RACE_BACKGROUNDS.dwarf,
    carType: 'dwarf car',
    slides: [
      { title: 'Race smarter', icon: Gauge, visual: 'car', tone: 'red' },
      { title: 'Finish faster', icon: Flag, visual: 'flag', tone: 'blue' },
      { title: FINAL_TITLE, subtext: FINAL_COPY, body: FINAL_PRICE, icon: Sparkles, visual: 'logo', tone: 'pro' },
    ],
    chips: [],
  },
  setup_session_bottom: {
    theme: 'Tuning workflow',
    accent: '#EF1B1B',
    softAccent: '#06080C',
    background: RACE_BACKGROUNDS.pavementStock,
    carType: 'pavement stock car',
    slides: [
      { title: 'Track changes', icon: Gauge, visual: 'car', tone: 'red' },
      { title: 'Keep momentum', icon: Flag, visual: 'flag', tone: 'blue' },
      { title: FINAL_TITLE, subtext: FINAL_COPY, body: FINAL_PRICE, icon: Sparkles, visual: 'logo', tone: 'pro' },
    ],
    chips: [],
  },
  parts_reference_bottom: {
    theme: 'Organization / tools',
    accent: '#008CFF',
    softAccent: '#050B13',
    background: RACE_BACKGROUNDS.pavementStock,
    carType: 'pavement stock car',
    slides: [
      { title: 'Find parts faster', icon: Gauge, visual: 'car', tone: 'red' },
      { title: 'Stay organized', icon: Flag, visual: 'flag', tone: 'blue' },
      { title: FINAL_TITLE, subtext: FINAL_COPY, body: FINAL_PRICE, icon: Sparkles, visual: 'logo', tone: 'pro' },
    ],
    chips: [],
  },
  schedule_bottom: {
    theme: 'Race planning',
    accent: '#EF1B1B',
    softAccent: '#06080C',
    background: RACE_BACKGROUNDS.indycar,
    carType: 'indycar',
    slides: [
      { title: 'Plan the weekend', icon: Gauge, visual: 'car', tone: 'red' },
      { title: 'Stay ready', icon: Flag, visual: 'flag', tone: 'blue' },
      { title: FINAL_TITLE, subtext: FINAL_COPY, body: FINAL_PRICE, icon: Sparkles, visual: 'logo', tone: 'pro' },
    ],
    chips: [],
  },
  timing_scan_bottom: {
    theme: 'Timing workflow',
    accent: '#00A8E8',
    softAccent: '#050B13',
    background: RACE_BACKGROUNDS.indycar,
    carType: 'indycar',
    slides: [
      { title: 'Scan results', icon: Gauge, visual: 'car', tone: 'red' },
      { title: 'Review faster', icon: Flag, visual: 'flag', tone: 'blue' },
      { title: FINAL_TITLE, subtext: FINAL_COPY, body: FINAL_PRICE, icon: Sparkles, visual: 'logo', tone: 'pro' },
    ],
    chips: [],
  },
  todo_bottom: {
    theme: 'Race prep',
    accent: '#EF4444',
    softAccent: '#06080C',
    background: RACE_BACKGROUNDS.wingedSprintCentered,
    carType: 'winged sprint car',
    slides: [
      { title: 'Prep smarter', icon: Gauge, visual: 'car', tone: 'red' },
      { title: 'Miss less', icon: Flag, visual: 'flag', tone: 'blue' },
      { title: FINAL_TITLE, subtext: FINAL_COPY, body: FINAL_PRICE, icon: Sparkles, visual: 'logo', tone: 'pro' },
    ],
    chips: [],
  },
};

const interstitialCopy: RookieAdConfig = {
  theme: 'Setup saved. Pro keeps you moving.',
  accent: '#00A8E8',
  softAccent: '#EAF8FE',
  background: RACE_BACKGROUNDS.wingedSprint,
  carType: 'winged sprint car',
  slides: [
    { title: 'Setup Saved', body: 'Your setup is saved and ready to go.', icon: CheckCircle2, tone: 'red' },
    { title: 'Race smarter. Finish faster.', body: 'Keep your setup workflow moving with fewer distractions.', icon: Gauge, tone: 'blue' },
    { title: FINAL_TITLE, body: FINAL_COPY, subtext: FINAL_PRICE, icon: Sparkles, visual: 'logo', tone: 'pro' },
  ],
  chips: ['Ad-free saves', 'Cleaner workflow', 'Export setups'],
};

const ROOKIE_AD_STYLES = `
.rookie-house-ad,
.rookie-banner-ad {
  isolation: isolate;
  --rookie-ad-accent: #00A8E8;
  --rookie-ad-soft: #EAF8FE;
}

.rookie-house-ad::before,
.rookie-banner-ad::before {
  background:
    radial-gradient(circle at 88% 18%, var(--rookie-ad-soft) 0, transparent 34%),
    linear-gradient(135deg, rgba(0, 168, 232, 0.12), transparent 42%);
  content: "";
  inset: 0;
  opacity: 0.95;
  pointer-events: none;
  position: absolute;
  z-index: 0;
}

.rookie-house-ad::after,
.rookie-banner-ad::after {
  background-image:
    linear-gradient(45deg, rgba(26, 27, 35, 0.16) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(26, 27, 35, 0.16) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(26, 27, 35, 0.16) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(26, 27, 35, 0.16) 75%);
  background-position: 0 0, 0 9px, 9px -9px, -9px 0;
  background-size: 18px 18px;
  content: "";
  height: 46px;
  opacity: 0.25;
  pointer-events: none;
  position: absolute;
  right: -28px;
  top: 8px;
  transform: rotate(-8deg);
  width: 132px;
  z-index: 0;
}

.rookie-banner-ad {
  min-height: 108px;
}

.rookie-banner-ad:hover {
  border-color: color-mix(in srgb, var(--rookie-ad-accent), #ffffff 22%);
  box-shadow: 0 12px 28px rgba(0, 168, 232, 0.16);
}

.rookie-banner-slide {
  animation: rookie-race-slide-in 360ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.rookie-ad-icon-shell {
  transform: none;
}

.rookie-banner-car {
  background: var(--rookie-ad-accent);
  border-radius: 999px 999px 8px 8px;
  bottom: 12px;
  height: 15px;
  left: 13px;
  position: absolute;
  width: 46px;
}

.rookie-banner-car::before {
  background: rgba(255, 255, 255, 0.75);
  border-radius: 8px 8px 2px 2px;
  content: "";
  height: 10px;
  left: 15px;
  position: absolute;
  top: -8px;
  width: 18px;
}

.rookie-banner-car::after {
  background:
    radial-gradient(circle, #1A1B23 0 36%, #ffffff 38% 58%, transparent 60%),
    radial-gradient(circle, #1A1B23 0 36%, #ffffff 38% 58%, transparent 60%);
  background-position: 4px 0, 31px 0;
  background-repeat: no-repeat;
  background-size: 12px 12px;
  bottom: -6px;
  content: "";
  height: 12px;
  left: 0;
  position: absolute;
  width: 46px;
}

.rookie-banner-dust {
  background: linear-gradient(90deg, transparent, rgba(249, 115, 22, 0.55), transparent);
  border-radius: 999px;
  height: 4px;
  left: 6px;
  opacity: 0.75;
  position: absolute;
  top: 44px;
  width: 56px;
}

.rookie-banner-flag {
  border-radius: 8px;
  height: 42px;
  overflow: hidden;
  position: relative;
  width: 56px;
}

.rookie-banner-flag::before {
  background-image:
    linear-gradient(45deg, #1A1B23 25%, transparent 25%),
    linear-gradient(-45deg, #1A1B23 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1A1B23 75%),
    linear-gradient(-45deg, transparent 75%, #1A1B23 75%);
  background-position: 0 0, 0 7px, 7px -7px, -7px 0;
  background-size: 14px 14px;
  content: "";
  inset: 0;
  opacity: 0.88;
  position: absolute;
}

.rookie-banner-logo {
  filter: drop-shadow(0 0 10px rgba(0, 168, 232, 0.18));
}

.rookie-ad-line {
  background: linear-gradient(90deg, transparent, var(--rookie-ad-accent), transparent);
  border-radius: 999px;
  height: 2px;
  left: -96px;
  opacity: 0.3;
  position: absolute;
  width: 96px;
  z-index: 0;
}

.rookie-ad-slide-content {
  animation: rookie-race-slide-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.rookie-ad-cta {
  overflow: hidden;
  position: relative;
}

.rookie-ad-cta::after {
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.36), transparent);
  content: "";
  inset: 0 auto 0 -80%;
  pointer-events: none;
  position: absolute;
  transform: skewX(-18deg);
  width: 55%;
}

.rookie-banner-ad {
  background: #04060a;
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.22), inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.rookie-banner-bg,
.rookie-house-bg {
  background-image:
    linear-gradient(90deg, rgba(0, 0, 0, 0.92) 0 26%, rgba(0, 0, 0, 0.64) 42%, rgba(0, 0, 0, 0.24) 74%),
    linear-gradient(105deg, color-mix(in srgb, var(--rookie-ad-accent), transparent 64%), transparent 44%),
    var(--rookie-race-bg);
  background-position: center;
  background-size: cover;
  inset: 0;
  opacity: 1;
  position: absolute;
  z-index: 0;
}

.rookie-banner-ad[data-slide-tone="blue"] .rookie-banner-bg {
  background-image:
    linear-gradient(90deg, rgba(0, 0, 0, 0.9) 0 26%, rgba(0, 13, 28, 0.66) 46%, rgba(0, 0, 0, 0.18) 78%),
    linear-gradient(105deg, rgba(0, 140, 255, 0.34), transparent 48%),
    var(--rookie-race-bg);
}

.rookie-banner-ad[data-slide-tone="pro"] .rookie-banner-bg {
  background-image:
    linear-gradient(90deg, rgba(0, 0, 0, 0.92) 0 30%, rgba(0, 32, 58, 0.74) 52%, rgba(0, 0, 0, 0.24) 100%),
    linear-gradient(115deg, rgba(0, 168, 232, 0.46), transparent 42%),
    var(--rookie-race-bg);
}

.rookie-banner-ad[data-slide-tone="red"] {
  --rookie-ad-accent: #EF1B1B;
  --rookie-ad-soft: #100305;
}

.rookie-banner-ad[data-slide-tone="blue"],
.rookie-banner-ad[data-slide-tone="pro"] {
  --rookie-ad-accent: #008CFF;
  --rookie-ad-soft: #03111F;
}

.rookie-banner-ad::before {
  background:
    radial-gradient(circle at 81% 18%, color-mix(in srgb, var(--rookie-ad-accent), #ffffff 16%) 0 2px, transparent 3px 7px),
    radial-gradient(circle at 89% 18%, color-mix(in srgb, var(--rookie-ad-accent), #ffffff 16%) 0 2px, transparent 3px 7px),
    radial-gradient(circle at 97% 18%, color-mix(in srgb, var(--rookie-ad-accent), #ffffff 16%) 0 2px, transparent 3px 7px),
    linear-gradient(115deg, rgba(0, 0, 0, 0.88) 0 34%, var(--rookie-ad-soft) 35% 55%, rgba(0, 0, 0, 0.96) 74%),
    radial-gradient(circle at 78% 58%, color-mix(in srgb, var(--rookie-ad-accent), transparent 34%), transparent 34%);
  opacity: 0.58;
  z-index: 1;
}

.rookie-banner-ad[data-slide-tone="pro"]::before {
  background:
    linear-gradient(100deg, #02050A 0 42%, rgba(0, 140, 255, 0.38) 43% 70%, #06182A 100%),
    radial-gradient(circle at 78% 45%, rgba(255, 255, 255, 0.7), transparent 26%);
}

.rookie-banner-ad::after {
  background-color: rgba(255, 255, 255, 0.9);
  background-image:
    linear-gradient(45deg, #0B0D12 25%, transparent 25%),
    linear-gradient(-45deg, #0B0D12 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #0B0D12 75%),
    linear-gradient(-45deg, transparent 75%, #0B0D12 75%);
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  background-size: 16px 16px;
  height: 84px;
  opacity: 0.2;
  right: -18px;
  top: -10px;
  transform: rotate(-12deg) skewX(-8deg);
  width: 150px;
  z-index: 1;
}

.rookie-banner-ad:hover {
  border-color: color-mix(in srgb, var(--rookie-ad-accent), #ffffff 28%);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28), 0 0 18px color-mix(in srgb, var(--rookie-ad-accent), transparent 64%);
}

.rookie-banner-slash {
  background: linear-gradient(90deg, transparent, var(--rookie-ad-accent), transparent);
  height: 2px;
  left: -24px;
  opacity: 0.7;
  position: absolute;
  transform: rotate(-13deg);
  width: 160px;
  z-index: 1;
}

.rookie-banner-slash:nth-of-type(2) {
  opacity: 0.35;
  width: 220px;
}

.rookie-banner-visual {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.16), transparent 36%),
    linear-gradient(135deg, color-mix(in srgb, var(--rookie-ad-accent), #000000 28%), #070A0F 62%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  clip-path: polygon(0 0, 86% 0, 100% 100%, 0 100%);
}

.rookie-banner-photo {
  background-image:
    linear-gradient(135deg, rgba(0, 0, 0, 0.18), transparent 38%),
    var(--rookie-race-bg);
  background-position: center;
  background-size: cover;
  inset: 0;
  position: absolute;
}

.rookie-banner-ad[data-slide-tone="blue"] .rookie-banner-photo {
  background-position: center;
}

.rookie-banner-ad[data-slide-tone="pro"] .rookie-banner-photo {
  background-image:
    linear-gradient(110deg, rgba(255, 255, 255, 0.92) 0 44%, rgba(0, 168, 232, 0.28) 45% 66%, rgba(2, 8, 16, 0.52) 100%),
    var(--rookie-race-bg);
  background-position: center;
  background-size: cover;
}

.rookie-banner-ad[data-slide-tone="pro"] .rookie-banner-visual {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.86), rgba(0, 168, 232, 0.2) 58%, rgba(0, 0, 0, 0.24)),
    linear-gradient(135deg, #06182A, #008CFF);
}

.rookie-banner-ad[data-slide-tone="pro"] .rookie-banner-logo {
  filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.7)) drop-shadow(0 0 18px rgba(0, 168, 232, 0.45));
}

.rookie-banner-car {
  background:
    linear-gradient(90deg, #05070A 0 15%, color-mix(in srgb, var(--rookie-ad-accent), #111827 20%) 16% 72%, #05070A 73%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.34), transparent 42%);
  border-radius: 1px 7px 2px 1px;
  bottom: 15px;
  box-shadow: 0 0 14px color-mix(in srgb, var(--rookie-ad-accent), transparent 36%);
  clip-path: polygon(0 68%, 18% 34%, 54% 30%, 68% 6%, 91% 14%, 100% 62%, 86% 100%, 8% 100%);
  height: 22px;
  left: 7px;
  transform: skewX(-11deg);
  width: 72px;
}

.rookie-banner-car::before {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.88), rgba(0, 140, 255, 0.22));
  border-radius: 1px 5px 1px 1px;
  height: 9px;
  left: 35px;
  top: 2px;
  transform: skewX(-12deg);
  width: 20px;
}

.rookie-banner-car::after {
  background:
    radial-gradient(circle, #05070A 0 36%, #BFC6D1 39% 54%, transparent 57%),
    radial-gradient(circle, #05070A 0 36%, #BFC6D1 39% 54%, transparent 57%);
  background-position: 9px 0, 51px 0;
  background-repeat: no-repeat;
  background-size: 14px 14px;
  bottom: -6px;
  height: 14px;
  width: 72px;
}

.rookie-banner-dust {
  background:
    radial-gradient(circle, rgba(161, 103, 51, 0.95), transparent 58%),
    linear-gradient(90deg, transparent, rgba(239, 27, 27, 0.48), rgba(161, 103, 51, 0.62), transparent);
  filter: blur(0.2px);
  height: 9px;
  left: 2px;
  top: 43px;
  width: 64px;
}

.rookie-banner-flag {
  background: #ffffff;
  box-shadow: 0 0 16px color-mix(in srgb, var(--rookie-ad-accent), transparent 42%);
  clip-path: polygon(0 7%, 100% 0, 90% 100%, 0 88%);
}

.rookie-banner-logo {
  filter: drop-shadow(0 0 10px rgba(0, 168, 232, 0.2));
}

.rookie-banner-eyebrow {
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.rookie-banner-title {
  color: #ffffff;
  display: flex;
  flex-wrap: wrap;
  font-family: Impact, "Arial Black", sans-serif;
  font-style: italic;
  font-weight: 900;
  gap: 0 0.28em;
  line-height: 0.95;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.48), 0 0 14px color-mix(in srgb, var(--rookie-ad-accent), transparent 44%);
  text-transform: uppercase;
}

.rookie-banner-title-word {
  color: #ffffff;
}

.rookie-banner-title-emphasis {
  color: var(--rookie-ad-accent);
}

.rookie-banner-subtext {
  color: rgba(255, 255, 255, 0.82);
  font-weight: 800;
}

.rookie-banner-price {
  color: #ffffff;
  font-weight: 900;
}

.rookie-banner-dot {
  background: rgba(255, 255, 255, 0.34);
}

.rookie-banner-dot-active {
  background: var(--rookie-ad-accent);
  box-shadow: 0 0 9px var(--rookie-ad-accent);
}

.rookie-banner-wipe,
.rookie-house-wipe {
  animation: rookie-race-wipe 620ms cubic-bezier(0.18, 0.84, 0.22, 1) both;
  background:
    linear-gradient(103deg, transparent 0 17%, rgba(255, 255, 255, 0.2) 25%, var(--rookie-ad-accent) 37%, rgba(255, 255, 255, 0.22) 49%, transparent 63%),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.32) 0 9px, rgba(0, 0, 0, 0.56) 9px 18px);
  inset: -34% -70%;
  mix-blend-mode: screen;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  transform: translateX(-55%) skewX(-18deg);
  z-index: 4;
}

.rookie-house-ad {
  background: #04060a;
  border-color: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.rookie-house-ad::before {
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.72)),
    var(--rookie-race-bg);
  background-position: center;
  background-size: cover;
  opacity: 1;
}

.rookie-house-ad[data-slide-tone="red"]::before {
  background:
    linear-gradient(105deg, rgba(16, 0, 0, 0.88) 0 42%, rgba(0, 0, 0, 0.42) 74%),
    linear-gradient(90deg, rgba(239, 27, 27, 0.34), transparent 52%),
    var(--rookie-race-bg);
  background-position: center;
  background-size: cover;
}

.rookie-house-ad[data-slide-tone="pro"]::before {
  background:
    linear-gradient(105deg, rgba(0, 0, 0, 0.88) 0 38%, rgba(0, 42, 72, 0.5) 70%),
    linear-gradient(90deg, rgba(0, 168, 232, 0.36), transparent 54%),
    var(--rookie-race-bg);
  background-position: center;
  background-size: cover;
}

.rookie-house-ad::after {
  opacity: 0.18;
}

.rookie-house-ad h3 {
  color: #ffffff;
  font-style: italic;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.55), 0 0 20px rgba(0, 168, 232, 0.42);
  text-transform: uppercase;
}

.rookie-house-ad p {
  color: rgba(255, 255, 255, 0.84);
}

.rookie-house-ad ul li,
.rookie-house-ad span {
  border-color: rgba(255, 255, 255, 0.18);
}

.rookie-save-logo-box {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.32), 0 0 24px rgba(0, 168, 232, 0.24);
  padding: 12px 16px;
  width: min(420px, 92%);
}

.rookie-save-logo-box-final {
  padding: 16px 20px;
  width: min(520px, 98%);
}

.rookie-interstitial-logo {
  display: block;
  filter: drop-shadow(0 0 8px rgba(0, 168, 232, 0.18));
  width: 100%;
}

@keyframes rookie-race-slide-in {
  from {
    opacity: 0;
    filter: blur(5px);
    transform: translateX(-18px) skewX(-4deg);
  }
  to {
    opacity: 1;
    filter: blur(0);
    transform: translateX(0) skewX(0);
  }
}

@keyframes rookie-race-wipe {
  0% {
    opacity: 0;
    transform: translateX(-55%) skewX(-18deg);
  }
  18%, 62% {
    opacity: 0.95;
  }
  100% {
    opacity: 0;
    transform: translateX(58%) skewX(-18deg);
  }
}

@media (min-width: 640px) {
  .rookie-banner-ad {
    min-height: 128px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rookie-house-ad::after,
  .rookie-banner-ad::after,
  .rookie-ad-line,
  .rookie-ad-icon-shell,
  .rookie-ad-slide-content,
  .rookie-ad-cta::after,
  .rookie-banner-slide,
  .rookie-banner-wipe,
  .rookie-house-wipe,
  .rookie-banner-car,
  .rookie-banner-car::after,
  .rookie-banner-dust,
  .rookie-banner-flag,
  .rookie-banner-logo {
    animation: none !important;
  }

  .rookie-house-ad *,
  .rookie-banner-ad *,
  .rookie-house-ad::before,
  .rookie-house-ad::after,
  .rookie-banner-ad::before,
  .rookie-banner-ad::after {
    transition: none !important;
  }
}
`;

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(query.matches);

    updatePreference();

    if (query.addEventListener) {
      query.addEventListener('change', updatePreference);
      return () => query.removeEventListener('change', updatePreference);
    }

    query.addListener(updatePreference);
    return () => query.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

function renderPromoTitle(title: string, tone?: RookieAdSlide['tone']) {
  const words = title.split(' ').filter(Boolean);

  if (words.length < 2) {
    return title;
  }

  const splitIndex = tone === 'pro' && words.length > 2 ? words.length - 1 : 1;
  const primary = words.slice(0, splitIndex).join(' ');
  const emphasis = words.slice(splitIndex).join(' ');

  return (
    <>
      <span className="rookie-banner-title-word">{primary}</span>
      <span className="rookie-banner-title-word rookie-banner-title-emphasis">{emphasis}</span>
    </>
  );
}

const RookieHouseAdContent: React.FC<RookieAdSlotProps> = ({
  placement,
  className = '',
  onContinue,
}) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isInterstitial = placement === 'after_save_interstitial';
  const config = isInterstitial ? interstitialCopy : compactPlacementCopy[placement];
  const slideCount = config.slides.length;
  const activeIndex = prefersReducedMotion ? slideCount - 1 : slideIndex;
  const slide = config.slides[activeIndex];
  const Icon = slide.icon;
  const isFinalSlide = activeIndex === slideCount - 1;

  useEffect(() => {
    setSlideIndex(0);
    setDismissed(false);
  }, [placement]);

  useEffect(() => {
    if (prefersReducedMotion || dismissed) return;

    if (isInterstitial) {
      if (slideIndex >= slideCount - 1) return;
      const timer = window.setTimeout(() => {
        setSlideIndex((current) => Math.min(current + 1, slideCount - 1));
      }, 1500);
      return () => window.clearTimeout(timer);
    }

    const holdTime = slideIndex === slideCount - 1 ? 3600 : 1700;
    const timer = window.setTimeout(() => {
      setSlideIndex((current) => (current + 1) % slideCount);
    }, holdTime);

    return () => window.clearTimeout(timer);
  }, [dismissed, isInterstitial, prefersReducedMotion, slideCount, slideIndex]);

  if (dismissed) {
    return null;
  }

  const handleUpgrade = () => {
    if (!hideExternalPayments) {
      setPendingPlan('pro');
    }
    navigate('/upgrade', { state: { plan: 'pro' } });
  };

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
      return;
    }
    setDismissed(true);
  };

  const inlineTone = !isInterstitial ? (slide.tone ?? 'red') : undefined;
  const activeTone = slide.tone ?? (isInterstitial ? 'blue' : 'red');
  const inlineAccent = inlineTone === 'red' ? '#EF1B1B' : '#008CFF';
  const inlineSoft = inlineTone === 'red' ? '#100305' : '#03111F';
  const interstitialAccent = activeTone === 'red' ? '#EF1B1B' : '#008CFF';
  const interstitialSoft = activeTone === 'red' ? '#100305' : config.softAccent;
  const ariaCopy = [slide.title, slide.subtext, !isInterstitial ? slide.body : undefined].filter(Boolean).join('. ');
  const adStyle = {
    '--rookie-ad-accent': isInterstitial ? interstitialAccent : inlineAccent,
    '--rookie-ad-soft': isInterstitial ? interstitialSoft : inlineSoft,
    '--rookie-race-bg': `url("${config.background}")`,
  } as CSSProperties;

  const inlineContent = !isInterstitial && (
    <button
      type="button"
      data-placement={placement}
      data-car-type={config.carType}
      data-slide-tone={inlineTone}
      aria-label={ariaCopy || 'View Pro upgrade'}
      onClick={handleUpgrade}
      className={[
        'rookie-banner-ad group relative w-full overflow-hidden rounded-lg border p-3 text-left focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2 sm:p-3.5',
        className,
      ].join(' ')}
      style={adStyle}
    >
      <style>{ROOKIE_AD_STYLES}</style>
      <span className="rookie-banner-bg" aria-hidden="true" />
      {!prefersReducedMotion && (
        <span key={`${placement}-wipe-${activeIndex}`} className="rookie-banner-wipe" aria-hidden="true" />
      )}
      <span className="absolute inset-x-0 top-0 z-[1] h-1" style={{ backgroundColor: inlineAccent }} aria-hidden="true" />
      <span className="rookie-ad-line top-6" aria-hidden="true" />
      <span className="rookie-ad-line bottom-5" aria-hidden="true" />
      <span className="rookie-banner-slash top-4" aria-hidden="true" />
      <span className="rookie-banner-slash bottom-5" style={{ left: '38%' }} aria-hidden="true" />

      {/* Future ad network integration point: these animated OnlyFast house ads are placeholders. Replace this content with Media.net web ads, AdMob/native ads, or another approved revenue-generating ad provider later. Keep Rookie-only gating so paid users never load ad scripts. */}
      <span className="relative z-[2] flex min-h-[64px] items-center gap-3 sm:min-h-[76px] sm:gap-4">
        <span
          className="rookie-banner-visual relative flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden text-white shadow-sm sm:h-24 sm:w-36"
          aria-hidden="true"
        >
          {slide.visual === 'logo' ? (
            <>
              <span className="rookie-banner-photo" />
              <img src={LOGO_SRC} alt="" className="rookie-banner-logo relative z-[1] h-11 w-auto max-w-[96px] object-contain sm:h-14 sm:max-w-[128px]" />
            </>
          ) : (
            <span className="rookie-banner-photo" />
          )}
        </span>

        <span key={`${placement}-${activeIndex}`} className="rookie-banner-slide min-w-0 flex-1">
          <span className="rookie-banner-eyebrow block tracking-normal">
            {config.theme}
          </span>
          <span className="rookie-banner-title mt-0.5 block text-xl sm:text-2xl">
            {renderPromoTitle(slide.title, inlineTone)}
          </span>
          <span className="rookie-banner-subtext mt-1 block min-h-4 text-xs sm:text-sm">
            {slide.subtext || ''}
          </span>
          {slide.body && (
            <span className="rookie-banner-price mt-0.5 block text-xs sm:text-sm">
              {slide.body}
            </span>
          )}
        </span>

        <span className="hidden shrink-0 items-center gap-1.5 sm:flex" aria-label={`Slide ${activeIndex + 1} of ${slideCount}`}>
          {config.slides.map((item, index) => (
            <span
              key={item.title}
              aria-hidden="true"
              className={[
                'h-2 rounded-full',
                index === activeIndex ? 'rookie-banner-dot-active w-6' : 'rookie-banner-dot w-2',
              ].join(' ')}
            />
          ))}
        </span>

        <ArrowRight className="h-5 w-5 shrink-0 text-white" aria-hidden="true" />
      </span>
    </button>
  );

  if (!isInterstitial) {
    return inlineContent;
  }

  const content = (
    <section
      data-placement={placement}
      data-car-type={config.carType}
      data-slide-tone={activeTone}
      aria-label="OnlyFast Pro upgrade"
      className={[
        'rookie-house-ad relative w-full max-w-lg overflow-hidden rounded-lg border border-[#D7EEF8] bg-white p-5 text-center shadow-lg shadow-[#00A8E8]/10 sm:p-6',
        className,
      ].join(' ')}
      style={adStyle}
    >
      <style>{ROOKIE_AD_STYLES}</style>
      {!prefersReducedMotion && (
        <div key={`${placement}-wipe-${activeIndex}`} className="rookie-house-wipe" aria-hidden="true" />
      )}
      <div className="absolute inset-x-0 top-0 z-[1] h-1" style={{ backgroundColor: interstitialAccent }} aria-hidden="true" />
      <div className="rookie-ad-line top-10" aria-hidden="true" />
      <div className="rookie-ad-line top-24" aria-hidden="true" />
      <div className="rookie-ad-line bottom-10" aria-hidden="true" />

      {/* Future ad network integration point: these animated OnlyFast house ads are placeholders. Replace this content with Media.net web ads, AdMob/native ads, or another approved revenue-generating ad provider later. Keep Rookie-only gating so paid users never load ad scripts. */}
      <div className="relative z-[2] flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-4">
          <div
            className={[
              'rookie-ad-icon-shell flex shrink-0 items-center justify-center text-white shadow-md shadow-[#00A8E8]/20',
              activeTone === 'red' ? 'h-20 w-20 rounded-full' : 'h-14 w-14 rounded-lg',
            ].join(' ')}
            style={{ backgroundColor: activeTone === 'red' ? '#EF1B1B' : config.accent }}
          >
            <Icon size={activeTone === 'red' ? 42 : 28} strokeWidth={2.4} aria-hidden="true" />
          </div>

          <div className="max-w-md">
            <div
              className={[
                'rookie-save-logo-box mx-auto mb-3',
                isFinalSlide ? 'rookie-save-logo-box-final' : '',
              ].join(' ')}
            >
              <img
                src={LOGO_SRC}
                alt="OnlyFast"
                className="rookie-interstitial-logo h-auto object-contain"
              />
            </div>

            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-md border border-[#D7EEF8] bg-[#F7FBFD] px-2.5 py-1 text-xs font-bold text-[#1A1B23]">
                <span className="h-2 w-2 rounded-full bg-[#00A8E8]" aria-hidden="true" />
                OnlyFast house ad
              </span>
            </div>

            <p className="mt-3 text-sm font-bold text-[#1A1B23]">{config.theme}</p>

            <div key={`${placement}-${activeIndex}`} className="rookie-ad-slide-content mt-2" aria-live="polite">
              <p className="text-xs font-bold text-[#00A8E8]">Rookie plan</p>
              <h3
                className={[
                  'mt-1 font-bold text-[#1A1B23]',
                  activeTone === 'red' ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl',
                ].join(' ')}
              >
                {slide.title}
              </h3>
              <p className="mt-2 text-sm text-[#4B5563]">
                {slide.body}
              </p>
              {slide.subtext && (
                <p className="mt-2 text-sm font-bold text-[#00A8E8]">
                  {slide.subtext}
                </p>
              )}
            </div>

            <ul className="mt-4 flex flex-wrap justify-center gap-2">
              {config.chips.map((chip) => (
                <li
                  key={chip}
                  className="rounded-md border border-[#D7EEF8] bg-[#F7FBFD] px-2.5 py-1 text-xs font-semibold text-[#1A1B23]"
                >
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:max-w-sm">
          <div className="flex items-center justify-center gap-1.5" aria-label={`Slide ${activeIndex + 1} of ${slideCount}`}>
            {config.slides.map((item, index) => (
              <span
                key={item.title}
                aria-hidden="true"
                className={[
                  'h-2 rounded-full transition-[width,background-color]',
                  index === activeIndex ? 'w-7 bg-[#00A8E8]' : 'w-2 bg-[#D1D5DB]',
                ].join(' ')}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleUpgrade}
            className="rookie-ad-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#0090c7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          >
            <span className="relative z-[1]">{hideExternalPayments ? 'View Pro details' : 'Upgrade to Pro'}</span>
            <ArrowRight className="relative z-[1]" size={17} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleContinue}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-semibold text-[#4B5563] transition-colors hover:bg-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          >
            Continue with Rookie
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <div className="w-full max-w-xl rounded-lg bg-[#1A1B23] p-3 shadow-2xl">
      {content}
    </div>
  );
};

export default RookieHouseAdContent;
