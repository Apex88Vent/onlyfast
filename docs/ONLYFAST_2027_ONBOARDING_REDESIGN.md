# OnlyFast 2027 onboarding redesign

The original dark visual treatment below is superseded by the [light visual correction](ONLYFAST_2027_ONBOARDING_LIGHT_THEME.md), which matches the actual app. Updated screenshots are in `tmp/onboarding-2027-light/`.

November 16, 2026. Primary checkout, existing `develop/onlyfast-2027` branch.

## Delivered experience

Replaced the twelve-page tutorial with eight animated marketing slides:

1. **Stop guessing. Start getting faster.** Racing line, GPS speed and saved baseline.
2. **Every setup. Every change.** Setup Notebook, Base Setup → Main Event, recorded fields and saved confirmation.
3. **Your race engineer. In your pocket.** Corner-exit feedback → Setup Assist → illustrative recommendation.
4. **Stop chasing the setup.** Setup → Track → Feedback, connected to the next adjustment.
5. **See what your car is doing.** OnlyFast Track Trace BETA, GPS trace and recorded metrics.
6. **The clock doesn’t lie.** Illustrative lap and sector results; 15.802s versus 15.482s.
7. **Your entire race weekend. Organized.** Schedule, session notes and timing results.
8. **Faster starts here.** Three main tools converge into the official logo, with the official slogan and final CTA.

Uses the official existing logo, dark navy, racing blue, light blue and white. No stock imagery, video, animation packages or new dependencies. Phone diagrams have their own simpler compositions and larger labels; desktop diagrams retain more context.

## Accuracy and scope

Checked the Dwarf Cars configuration in `src/lib/classConfigs.ts`, the actual Setup Assist feedback/request flow, Track Trace telemetry and session-review components, Phase 2D implementation report and the active subscription selection components.

Notebook examples use Dwarf Cars' LF Pressure / Shock, Front Ride Height and Cross Weight fields. Telemetry shows GPS position/speed, recorded laps and sector results. Data is explicitly illustrative. Track Trace retains BETA labeling. No throttle, braking, guaranteed performance gain, automatic unscanned lap timing or production GPS validation claim is introduced.

The slideshow contains no plan pricing or legacy Rookie/Pro/Team marketing. Required plan selection continues through the existing `PlanSelection` component and its active configuration. The isolated 2027 browser check confirms Sportsman, Pro and Factory are shown and purchases remain disabled.

No billing, RevenueCat, authentication, setup logic, telemetry calculations, dashboard, database schema or production holds were changed. Existing unrelated uncommitted work was preserved. The branch matched its fetched upstream before editing. No new branch/worktree, commit, push or deployment was made.

## Navigation and state

- Next advances one slide; Back reverses one slide. The final CTA starts the existing mandatory selections.
- Skip Intro appears only on slides 5–8. It uses the parent's existing intro-completion handler and cannot complete a racing profile.
- Discipline → supported class → existing plan selection → dashboard remains required.
- The member-login callback remains available; first-run onboarding has no Close action.
- Replay uses the existing parent callbacks and preserves the existing racing profile.
- Pending saves disable navigation and exits. Slide headings receive focus with `preventScroll`; keyboard arrows and horizontal touch gestures support navigation.
- No onboarding version key, completion flag or previously saved selection was reset. Completed users bypass the introduction; partially completed selections resume.

## Animation and viewport implementation

Only the current slide is mounted. Its keyed scene remounts when revisited, restarting CSS animations. SVG stroke drawing and a CSS motion path keep the marker aligned with the progressive trace. Staggered panels, changing field emphasis, saved confirmation, analysis reveal, sector bars and moving workflow connectors explain the features.

There are no application animation timers or per-frame React renders. Document visibility pauses animations. Hidden phone/desktop SVG variants use `display:none`. Reduced-motion CSS disables animation/transitions and leaves complete, legible diagrams visible.

The layout uses `100dvh` with a `100vh` fallback, safe-area padding, a flexible visual area and stationary navigation. A measured top offset reserves the isolated testing shell's existing notice rather than stacking a full viewport beneath it. Navigation remains visible during live height changes. Very short landscape views use a compact two-column arrangement.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **747 passed**, 0 failed |
| `node --experimental-strip-types --test tests/onboardingNavigation.mjs` | **47 passed**, 0 failed |
| `npx tsc --noEmit` | Passed |
| Focused ESLint on the three edited/new component and preview TSX files | Passed |
| `npm run build` | Passed; Vite warns about application chunks exceeding 500kB |
| Local development build | Passed |
| Isolated 2027 development build, synthetic configuration only | Passed |
| Reduced-motion layout matrix | All 8 slides passed at all 14 sizes below |
| Visibility / animation lifecycle | Motion advances, pauses when hidden, unmounts when inactive and restarts on revisit |
| Safe areas and dynamic viewport | All slides passed with simulated 47px top / 34px bottom insets and 390px-wide heights of 640, 744 and 844px |
| Existing configuration browser flows | Skip 5/6/7/8 and Finish → discipline → class → plan → dashboard; completed user bypasses intro |
| Active 2027 browser flows | Same six scenarios pass; Sportsman / Pro / Factory confirmed; no Continue Free legacy bypass |

Viewport matrix: **320×568, 360×640, 375×667, 390×844, 393×852, 412×915, 430×932, 768×1024, 820×1180, 1024×768, 1440×900, 1920×1080, 568×320 and 844×390**. Checks measured page/internal scrolling, visual/navigation overlap, readable visual area, navigation bounds, Skip visibility and forward/back transitions. No overflow or clipping was found in these emulated Chromium viewports.

Account browser checks intercept every nonlocal request. Auth, membership, onboarding progress and completion responses are synthetic local fixtures; no request is forwarded to a production or testing backend. Paid purchase flows were intentionally not activated.

## Review artifacts and reproduction

Development-only `/onboarding-showcase` provides a full-viewport introduction and the existing selection preview without changing production authentication. Existing protected `/onboarding-preview` is retained and now uses the actual viewport instead of a fixed 390px frame. Both routes are gated by the existing development-only lazy import.

Current local review: **http://127.0.0.1:8081/onboarding-showcase**.

Artifacts in `tmp/onboarding-2027/`:

- `390-all-slides.png` / `.html`: all eight phone slides, including standalone self-contained HTML review.
- `1440-all-slides.png` / `.html`: all eight desktop slides.
- `{320,390,430,768,1440}-slide-{1..8}.png`: individual screenshots.
- `results.json`: full layout, motion and existing-flow measurements.
- `testing-2027-results.json`: active 2027 browser flow evidence.
- `legacy-*-landing.png` and `2027-*-landing.png`: completion screenshots.

Run `qa/automation/onboarding-2027.mjs` (or the compatible `onboarding-layout.mjs` entry) against a local preview. Set `ONLYFAST_LAYOUT_URL` to its loopback origin and `ONLYFAST_PLAYWRIGHT_MODULE` to an installed Playwright module when Playwright is not locally installed. `--flows-only` runs just the existing-configuration account flows. `--testing-2027` runs the isolated 2027 flows against a separately configured local testing build.

The ordinary Vite development dependency scan stalled in this checkout during review. Browser verification therefore used a local development build (`NODE_ENV=development`, `vite build --mode development --outDir tmp/onboarding-build`) served locally. Temporary build/server files and all screenshots remain under ignored `tmp/`; no development tooling or dependencies were changed to work around this.

## Files changed by this task

- `src/components/HowOnlyFastWorks.tsx`: eight-slide content, navigation and animation lifecycle.
- `src/components/OnboardingVisual.tsx`: desktop and phone SVG demonstrations.
- `src/components/onboarding-intro.css`: responsive design, animations, safe areas and reduced motion.
- `src/pages/OnboardingPreview.tsx`: full-viewport preview container.
- `src/App.tsx`: development-only showcase route; pre-existing analytics edits preserved.
- `tests/onboardingNavigation.mjs`: updated eight-slide integration checks, Skip and pending-save coverage; pre-existing analytics stubs preserved.
- `qa/automation/onboarding-2027.mjs`: local layout, motion, screenshots and account-flow fixture checks.
- `qa/automation/onboarding-layout.mjs`: compatibility entry for the new QA script.
- `docs/ONLYFAST_2027_ONBOARDING_REDESIGN.md`: this report.

## Remaining validation

Physical iPhone/Android devices, Safari/WebKit and native webview rendering were not exercised here. These are emulated Chromium viewport results, not a claim of physical device certification. Track Trace's existing physical GPS validation remains outstanding and outside this slideshow change. No unresolved slideshow/navigation failure remains in the checks above.
