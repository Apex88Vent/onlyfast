# OnlyFast onboarding — light visual correction

November 16, 2026. Existing `develop/onlyfast-2027` checkout. No deployment.

Corrected the existing eight-slide introduction to match the actual application's light visual design. Slide copy, order, scene geometry, animation timing, navigation handlers, selection flow and onboarding completion state are preserved. `HowOnlyFastWorks.tsx`, authentication, subscriptions, dashboard and setup logic were not edited for this correction.

## Design values taken from the application

| Value | Existing source | Applied to onboarding |
| --- | --- | --- |
| `#F5F5F7` | App/selection page backgrounds | Primary page background |
| `#FFFFFF` | `HomeLanding.tsx`, `homeActionStyles.ts` | Cards and logo surfaces |
| `#F9FAFB` | `ChassisSetupForm.tsx` | Field and inactive-tab surfaces |
| `#DDEFFE`, brand blue at 10% opacity | `OnboardingFlow.tsx` | Light panels, selected states and track beds |
| `#00A8E8` | Dashboard icons, buttons and labels | Racing lines, buttons, progress and accents |
| `#0090C7` | `HomeLanding.tsx` | Primary button hover |
| `#007DAE` | Existing Track Trace components | Readable blue data labels |
| `#1A1B23` | Dashboard headings, setup inputs | Primary text and timing values |
| `#4B5563`, `#6B7280` | Dashboard labels, setup form | Supporting text and annotations |
| `#E5E7EB` | Dashboard and setup cards | Borders and dividers |

The official `/onlyfast-logo.png` asset is retained. Rounded white cards, app-style blue buttons, gray dividers, soft shadows and pale-blue layers replace the navy theme. Removed the neon palette and glowing edition indicator. Comparison laps use brand blue and the existing dark-gray text color.

## Visual review and preview

Local animated preview: **http://127.0.0.1:8081/onboarding-showcase**. Refresh the page if an earlier preview is open.

Updated artifacts are under **`tmp/onboarding-2027-light/`**, separate from the earlier dark-theme captures:

- `390-all-slides.png` / `.html`: all eight portrait phone slides.
- `1440-all-slides.png` / `.html`: all eight desktop slides.
- `{320,390,430,768,1440}-slide-{1..8}.png`: individual screenshots at five sizes.
- `dashboard-comparison.png` / `.html`: actual dashboard alongside Setup Notebook and Track Trace slides, with local account fixtures.
- `2027-dashboard-comparison.png` / `.html`: the same comparison using the isolated 2027 app configuration.
- `results.json`: viewport, light-palette, motion and existing-flow evidence.
- `testing-2027-results.json`: isolated 2027 flow and dashboard-palette evidence.

The visual review checked every slide and compared the onboarding directly with the real rendered dashboard. Browser assertions also confirm the dashboard's actual card white, border gray, heading black and icon blue match the onboarding values. Both desktop and phone scenes use the same scoped semantic styling.

## Validation

- **47 mounted navigation tests pass.** Skip remains limited to slides 5–8, required selections remain mandatory, pending saves are protected, saved selections resume and completed users bypass the intro.
- **112 slide/viewport checks pass:** all eight slides at 14 sizes, including 320×568, 360×640, 375×667, 390×844, 393×852, 412×915, 430×932, 768×1024, 820×1180, 1024×768, 1440×900, 1920×1080, 568×320 and 844×390.
- No page/internal scrolling, visual/navigation overlap or clipped navigation in that matrix.
- Reduced-motion and active-animation checks pass: moving marker, pause while hidden, inactive-scene unmount and restart when revisited.
- All slides pass simulated 47px top / 34px bottom safe areas and live 390px-wide viewport height changes between 640, 744 and 844px.
- All six browser scenarios pass in both existing and isolated 2027 configurations: Skip on 5/6/7/8, final CTA and completed-user return. The active 2027 flow retains Sportsman / Pro / Factory and disabled purchasing.
- Production build, local development build, isolated 2027 development build and focused SVG-component lint pass. Vite still reports its application chunk-size warning.

All account requests in browser checks are intercepted local fixtures. No backend account, billing, advertising or entitlement state was changed. Physical iPhone/Android, Safari and native webview validation remain separate from these Chromium emulation checks.

## Files changed for this correction

- `src/components/onboarding-intro.css`: app-derived light palette, cards, typography, buttons and visual layering; existing responsive rules and animations retained.
- `src/components/OnboardingVisual.tsx`: presentation classes and card rounding; scene content, data, paths and timing retained.
- `qa/automation/onboarding-2027.mjs`: light-palette assertions, configurable screenshot output and actual-dashboard visual comparisons.
- `docs/ONLYFAST_2027_ONBOARDING_LIGHT_THEME.md`: this report.
- `docs/ONLYFAST_2027_ONBOARDING_REDESIGN.md`: link to this superseding visual correction.

No commit, push, branch switch, worktree creation or deployment. Existing unrelated local changes are preserved.
