import{a5 as K,r as m,a6 as d,a7 as c,a8 as u,j as e,P as _,a9 as B,aa as H,ab as V}from"./main-C-h0AwlO.js";import{C as Y}from"./circle-check-Dj1pt4Jp.js";const P="/onlyfast-logo.png",l={dwarf:"/rookie-ads/dwarf-car-bg.png",pavementStock:"/rookie-ads/pavement-stock-bg.png",wingedSprint:"/rookie-ads/winged-sprint-bg.png",wingedSprintCentered:"/rookie-ads/winged-sprint-centered-bg.png",indycar:"/rookie-ads/indycar-bg.png"},p="Unlock all features. No ads.",g="Go Pro today!",b=B?"View store pricing":"$5/mo",W={home_middle:{theme:"Quick Pro teaser",accent:"#EF1B1B",softAccent:"#06080C",background:l.dwarf,carType:"dwarf car",slides:[{title:"Race smarter",icon:d,visual:"car",tone:"red"},{title:"Finish faster",icon:u,visual:"flag",tone:"blue"},{title:g,subtext:p,body:b,icon:c,visual:"logo",tone:"pro"}],chips:[]},home_bottom:{theme:"Workflow / clutter reduction",accent:"#008CFF",softAccent:"#050B13",background:l.pavementStock,carType:"pavement stock car",slides:[{title:"Less clutter",icon:d,visual:"car",tone:"red"},{title:"More setup flow",icon:u,visual:"flag",tone:"blue"},{title:g,subtext:p,body:b,icon:c,visual:"logo",tone:"pro"}],chips:[]},setup_track_conditions:{theme:"Track and setup workflow",accent:"#EF1B1B",softAccent:"#06080C",background:l.wingedSprintCentered,carType:"winged sprint car",slides:[{title:"Read the track",icon:d,visual:"car",tone:"red"},{title:"Tune smarter",icon:u,visual:"flag",tone:"blue"},{title:g,subtext:p,body:b,icon:c,visual:"logo",tone:"pro"}],chips:[]},setup_dashboard_bottom:{theme:"Setup notebook",accent:"#00A8E8",softAccent:"#050B13",background:l.dwarf,carType:"dwarf car",slides:[{title:"Race smarter",icon:d,visual:"car",tone:"red"},{title:"Finish faster",icon:u,visual:"flag",tone:"blue"},{title:g,subtext:p,body:b,icon:c,visual:"logo",tone:"pro"}],chips:[]},setup_session_bottom:{theme:"Tuning workflow",accent:"#EF1B1B",softAccent:"#06080C",background:l.pavementStock,carType:"pavement stock car",slides:[{title:"Track changes",icon:d,visual:"car",tone:"red"},{title:"Keep momentum",icon:u,visual:"flag",tone:"blue"},{title:g,subtext:p,body:b,icon:c,visual:"logo",tone:"pro"}],chips:[]},parts_reference_bottom:{theme:"Organization / tools",accent:"#008CFF",softAccent:"#050B13",background:l.pavementStock,carType:"pavement stock car",slides:[{title:"Find parts faster",icon:d,visual:"car",tone:"red"},{title:"Stay organized",icon:u,visual:"flag",tone:"blue"},{title:g,subtext:p,body:b,icon:c,visual:"logo",tone:"pro"}],chips:[]},schedule_bottom:{theme:"Race planning",accent:"#EF1B1B",softAccent:"#06080C",background:l.indycar,carType:"indycar",slides:[{title:"Plan the weekend",icon:d,visual:"car",tone:"red"},{title:"Stay ready",icon:u,visual:"flag",tone:"blue"},{title:g,subtext:p,body:b,icon:c,visual:"logo",tone:"pro"}],chips:[]},timing_scan_bottom:{theme:"Timing workflow",accent:"#00A8E8",softAccent:"#050B13",background:l.indycar,carType:"indycar",slides:[{title:"Scan results",icon:d,visual:"car",tone:"red"},{title:"Review faster",icon:u,visual:"flag",tone:"blue"},{title:g,subtext:p,body:b,icon:c,visual:"logo",tone:"pro"}],chips:[]},todo_bottom:{theme:"Race prep",accent:"#EF4444",softAccent:"#06080C",background:l.wingedSprintCentered,carType:"winged sprint car",slides:[{title:"Prep smarter",icon:d,visual:"car",tone:"red"},{title:"Miss less",icon:u,visual:"flag",tone:"blue"},{title:g,subtext:p,body:b,icon:c,visual:"logo",tone:"pro"}],chips:[]}},q={theme:"Setup saved. Pro keeps you moving.",accent:"#00A8E8",softAccent:"#EAF8FE",background:l.wingedSprint,carType:"winged sprint car",slides:[{title:"Setup Saved",body:"Your setup is saved and ready to go.",icon:Y,tone:"red"},{title:"Race smarter. Finish faster.",body:"Keep your setup workflow moving with fewer distractions.",icon:d,tone:"blue"},{title:g,body:p,subtext:b,icon:c,visual:"logo",tone:"pro"}],chips:["Ad-free saves","Cleaner workflow","Export setups"]},R=`
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
`;function Q(){const[o,h]=m.useState(()=>typeof window>"u"||!window.matchMedia?!1:window.matchMedia("(prefers-reduced-motion: reduce)").matches);return m.useEffect(()=>{if(typeof window>"u"||!window.matchMedia)return;const r=window.matchMedia("(prefers-reduced-motion: reduce)"),n=()=>h(r.matches);return n(),r.addEventListener?(r.addEventListener("change",n),()=>r.removeEventListener("change",n)):(r.addListener(n),()=>r.removeListener(n))},[]),o}function J(o,h){const r=o.split(" ").filter(Boolean);if(r.length<2)return o;const n=h==="pro"&&r.length>2?r.length-1:1,w=r.slice(0,n).join(" "),j=r.slice(n).join(" ");return e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"rookie-banner-title-word",children:w}),e.jsx("span",{className:"rookie-banner-title-word rookie-banner-title-emphasis",children:j})]})}const re=({placement:o,className:h="",onContinue:r})=>{const n=K(),[w,j]=m.useState(!1),[A,F]=m.useState(0),v=Q(),i=o==="after_save_interstitial",t=i?q:W[o],x=t.slides.length,s=v?x-1:A,a=t.slides[s],D=a.icon,X=s===x-1;if(m.useEffect(()=>{F(0),j(!1)},[o]),m.useEffect(()=>{if(v||w)return;if(i){if(A>=x-1)return;const E=window.setTimeout(()=>{F(G=>Math.min(G+1,x-1))},1500);return()=>window.clearTimeout(E)}const f=A===x-1?3600:1700,y=window.setTimeout(()=>{F(E=>(E+1)%x)},f);return()=>window.clearTimeout(y)},[w,i,v,x,A]),w)return null;const z=()=>{if(i){r==null||r(),n(H);return}B||V("pro"),n("/upgrade",{state:{plan:"pro"}})},$=()=>{if(r){r();return}j(!0)},N=i?void 0:a.tone??"red",k=a.tone??(i?"blue":"red"),C=N==="red"?"#EF1B1B":"#008CFF",I=N==="red"?"#100305":"#03111F",S=k==="red"?"#EF1B1B":"#008CFF",L=k==="red"?"#100305":t.softAccent,M=[a.title,a.subtext,i?void 0:a.body].filter(Boolean).join(". "),T={"--rookie-ad-accent":i?S:C,"--rookie-ad-soft":i?L:I,"--rookie-race-bg":`url("${t.background}")`},O=!i&&e.jsxs("button",{type:"button","data-placement":o,"data-car-type":t.carType,"data-slide-tone":N,"aria-label":M||"View Pro upgrade",onClick:z,className:["rookie-banner-ad group relative h-[160px] w-full overflow-hidden rounded-lg border p-3 text-left focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2 sm:p-3.5",h].join(" "),style:T,children:[e.jsx("style",{children:R}),e.jsx("span",{className:"rookie-banner-bg","aria-hidden":"true"}),!v&&e.jsx("span",{className:"rookie-banner-wipe","aria-hidden":"true"},`${o}-wipe-${s}`),e.jsx("span",{className:"absolute inset-x-0 top-0 z-[1] h-1",style:{backgroundColor:C},"aria-hidden":"true"}),e.jsx("span",{className:"rookie-ad-line top-6","aria-hidden":"true"}),e.jsx("span",{className:"rookie-ad-line bottom-5","aria-hidden":"true"}),e.jsx("span",{className:"rookie-banner-slash top-4","aria-hidden":"true"}),e.jsx("span",{className:"rookie-banner-slash bottom-5",style:{left:"38%"},"aria-hidden":"true"}),e.jsxs("span",{className:"relative z-[2] flex h-full items-center gap-3 sm:gap-4",children:[e.jsx("span",{className:"rookie-banner-visual relative flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden text-white shadow-sm sm:h-24 sm:w-36","aria-hidden":"true",children:a.visual==="logo"?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"rookie-banner-photo"}),e.jsx("img",{src:P,alt:"",className:"rookie-banner-logo relative z-[1] h-11 w-auto max-w-[96px] object-contain sm:h-14 sm:max-w-[128px]"})]}):e.jsx("span",{className:"rookie-banner-photo"})}),e.jsxs("span",{className:"rookie-banner-slide min-w-0 flex-1",children:[e.jsx("span",{className:"rookie-banner-eyebrow block tracking-normal",children:t.theme}),e.jsx("span",{className:"rookie-banner-title mt-0.5 block text-xl sm:text-2xl",children:J(a.title,N)}),e.jsx("span",{className:"rookie-banner-subtext mt-1 block min-h-4 text-xs sm:text-sm",children:a.subtext||""}),a.body&&e.jsx("span",{className:"rookie-banner-price mt-0.5 block text-xs sm:text-sm",children:a.body})]},`${o}-${s}`),e.jsx("span",{className:"hidden shrink-0 items-center gap-1.5 sm:flex","aria-label":`Slide ${s+1} of ${x}`,children:t.slides.map((f,y)=>e.jsx("span",{"aria-hidden":"true",className:["h-2 rounded-full",y===s?"rookie-banner-dot-active w-6":"rookie-banner-dot w-2"].join(" ")},f.title))}),e.jsx(_,{className:"h-5 w-5 shrink-0 text-white","aria-hidden":"true"})]})]});if(!i)return O;const U=e.jsxs("section",{"data-placement":o,"data-car-type":t.carType,"data-slide-tone":k,"aria-label":"OnlyFast Pro upgrade",className:["rookie-house-ad relative w-full max-w-lg overflow-hidden rounded-lg border border-[#D7EEF8] bg-white p-5 text-center shadow-lg shadow-[#00A8E8]/10 sm:p-6",h].join(" "),style:T,children:[e.jsx("style",{children:R}),!v&&e.jsx("div",{className:"rookie-house-wipe","aria-hidden":"true"},`${o}-wipe-${s}`),e.jsx("div",{className:"absolute inset-x-0 top-0 z-[1] h-1",style:{backgroundColor:S},"aria-hidden":"true"}),e.jsx("div",{className:"rookie-ad-line top-10","aria-hidden":"true"}),e.jsx("div",{className:"rookie-ad-line top-24","aria-hidden":"true"}),e.jsx("div",{className:"rookie-ad-line bottom-10","aria-hidden":"true"}),e.jsxs("div",{className:"relative z-[2] flex flex-col items-center gap-5",children:[e.jsxs("div",{className:"flex flex-col items-center gap-4",children:[e.jsx("div",{className:["rookie-ad-icon-shell flex shrink-0 items-center justify-center text-white shadow-md shadow-[#00A8E8]/20",k==="red"?"h-20 w-20 rounded-full":"h-14 w-14 rounded-lg"].join(" "),style:{backgroundColor:k==="red"?"#EF1B1B":t.accent},children:e.jsx(D,{size:k==="red"?42:28,strokeWidth:2.4,"aria-hidden":"true"})}),e.jsxs("div",{className:"max-w-md",children:[e.jsx("div",{className:["rookie-save-logo-box mx-auto mb-3",X?"rookie-save-logo-box-final":""].join(" "),children:e.jsx("img",{src:P,alt:"OnlyFast",className:"rookie-interstitial-logo h-auto object-contain"})}),e.jsx("div",{className:"flex justify-center",children:e.jsxs("span",{className:"inline-flex items-center gap-2 rounded-md border border-[#D7EEF8] bg-[#F7FBFD] px-2.5 py-1 text-xs font-bold text-[#1A1B23]",children:[e.jsx("span",{className:"h-2 w-2 rounded-full bg-[#00A8E8]","aria-hidden":"true"}),"OnlyFast house ad"]})}),e.jsx("p",{className:"mt-3 text-sm font-bold text-[#1A1B23]",children:t.theme}),e.jsxs("div",{className:"rookie-ad-slide-content mt-2","aria-live":"polite",children:[e.jsx("p",{className:"text-xs font-bold text-[#00A8E8]",children:"Rookie plan"}),e.jsx("h3",{className:["mt-1 font-bold text-[#1A1B23]",k==="red"?"text-4xl sm:text-5xl":"text-3xl sm:text-4xl"].join(" "),children:a.title}),e.jsx("p",{className:"mt-2 text-sm text-[#4B5563]",children:a.body}),a.subtext&&e.jsx("p",{className:"mt-2 text-sm font-bold text-[#00A8E8]",children:a.subtext})]},`${o}-${s}`),e.jsx("ul",{className:"mt-4 flex flex-wrap justify-center gap-2",children:t.chips.map(f=>e.jsx("li",{className:"rounded-md border border-[#D7EEF8] bg-[#F7FBFD] px-2.5 py-1 text-xs font-semibold text-[#1A1B23]",children:f},f))})]})]}),e.jsxs("div",{className:"flex w-full flex-col gap-3 sm:max-w-sm",children:[e.jsx("div",{className:"flex items-center justify-center gap-1.5","aria-label":`Slide ${s+1} of ${x}`,children:t.slides.map((f,y)=>e.jsx("span",{"aria-hidden":"true",className:["h-2 rounded-full transition-[width,background-color]",y===s?"w-7 bg-[#00A8E8]":"w-2 bg-[#D1D5DB]"].join(" ")},f.title))}),e.jsxs("button",{type:"button",onClick:z,className:"rookie-ad-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#0090c7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2",children:[e.jsx("span",{className:"relative z-[1]",children:B?"View Pro details":"Upgrade to Pro"}),e.jsx(_,{className:"relative z-[1]",size:17,"aria-hidden":"true"})]}),e.jsx("button",{type:"button",onClick:$,className:"inline-flex min-h-11 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-semibold text-[#4B5563] transition-colors hover:bg-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2",children:"Continue with Rookie"})]})]})]});return e.jsx("div",{className:"w-full max-w-xl rounded-lg bg-[#1A1B23] p-3 shadow-2xl",children:U})};export{re as default};
