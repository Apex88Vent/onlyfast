# OnlyFast public website preview

Implemented November 8, 2026, in the primary checkout on `main`.
No commit, push, production deployment, database migration, native package change,
store configuration change, purchase, restoration, or live account mutation was performed.
The pre-existing `ONLYFAST_ANDROID_AD_ID_FINDINGS.md` is preserved.

## Review the preview

The locally built production preview is available on this computer at:

- Homepage: <http://127.0.0.1:4173/>
- Web app / existing login: <http://127.0.0.1:4173/app>
- Login: <http://127.0.0.1:4173/login>
- Existing native entry: <http://127.0.0.1:4173/?nativeApp=true>
- Restore browser mode after testing the native entry: <http://127.0.0.1:4173/?nativeApp=false>

The existing native marker persists on the same origin. Use a separate browser
profile for native testing, or the explicit browser reset above when returning
to the marketing page. An existing signed-in browser session opens `/app`.

To restart the production preview from this checkout:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

For live source editing, use `npm run dev -- --host 127.0.0.1 --port 8080`.
These loopback URLs are available on this computer only. The normal local preview
uses the existing Supabase configuration; signing into it opens the existing app.
Automated browser tests described below intercept the backend instead.

Screenshots from the production-build browser test:

- [Desktop homepage](../tmp/public-website/desktop.png)
- [Desktop first screen](../tmp/public-website/desktop-hero.png)
- [Mobile homepage, 390px](../tmp/public-website/mobile.png)
- [Mobile first screen](../tmp/public-website/mobile-hero.png)

Screenshots use reduced motion and block external network resources, including
Google Fonts. The installed font fallback may differ slightly from a connected
browser. Screenshot and result files remain in ignored local `tmp/` storage.

## Implementation and routing

The actual application is Vite + React Router, not Next.js. The existing
`Index` → `AppLayout` → onboarding/dashboard hierarchy is preserved. No existing
functional route was moved or renamed.

| Entry | Behavior |
| --- | --- |
| `/`, ordinary browser, no session | Public homepage after session verification |
| `/`, ordinary browser, session | Replace navigation to `/app`, retaining search and hash |
| `/app`, ordinary browser, no session | Existing `AuthModal` login, signup and reset flow |
| `/app`, ordinary browser, session | Existing app, including its normal onboarding requirements |
| `/login`, ordinary browser | Existing auth modal; authenticated sessions redirect to `/app` |
| `/?nativeApp=true` | Existing app immediately, including its existing login/tutorial/onboarding |
| Native account logout | Existing `AppLayout` logout behavior |
| Browser `/app` logout | Existing login flow; dismissing it returns to the public homepage |
| Existing account, upgrade, checkout, legal and support routes | Existing components retained |

`useEntrySession` reads the existing Supabase client's session and subscribes to
auth events. A loading state prevents marketing/login flashes during the check.
A revision guard ignores stale initial reads after newer auth events. Listeners
unsubscribe on unmount. Session failures offer a retry without clearing storage.
There is no new auth client, cookie system or session format.

Successful browser login renders the existing app at `/app`. Existing signup,
reset email requests and `/reset-password` remain in `AuthModal` and the original
password page. Root `PASSWORD_RECOVERY` events go to `/reset-password` before an
authenticated app redirect. Root email-confirmation sessions enter `/app`.
Search strings and fragments survive the normal root-to-app redirect.

Native routing reuses `paymentVisibility.ts`'s existing
`onlyfast_hide_external_payments` marker and existing Median/GoNative fallback.
The payment-only build flag does not classify a browser as native. Screen size
and general mobile user agents do not classify browsers as native.
When marker persistence fails, `nativeApp=true` stays in the URL for reloads;
otherwise the existing cleanup/persistence behavior is retained. Wrapper startup
URLs and Android/iOS packages are untouched. This marker controls UI routing
only; all existing authentication and server membership checks still apply.

Native safe-back guards remain enabled. Ordinary browser navigation no longer
installs those native history guards. Safe-back's dashboard view tracking now
also recognizes `/app` and preserves query strings.

## Homepage, membership and SEO

The homepage uses silver-gray, white and pale-blue surfaces with slate text,
the existing official logo and the supplied three-car garage artwork,
responsive navigation with an Escape-dismissable mobile
menu, feature cards, pricing, download links and existing legal/support links.
The phone artwork is promotional illustration, not an application screenshot.

Public pricing descriptions and limits render directly from the existing `PLANS`
export. Rookie remains Free, Pro $5/month and Team $8/month. Team's underlying
display metadata still uses the existing `Teams` wording. Paid calls to action
open `/upgrade`; they do not create another checkout or initiate purchases.
Billing, entitlements, subscription prices, ads and activation flags are unchanged.

Read-only RevenueCat inspection confirmed the OnlyFast project's Pro and Teams
entitlements and monthly store products. At inspection, `onlyfast_monthly_v1`
was the current offering, with Pro and Teams monthly packages. No RevenueCat
objects or paywalls were modified. Display copy remains grounded in the existing
application's membership restrictions, rather than inferring limits from product names.

Official existing store destinations were found in release documentation and
verified against their public listings:

- [Apple App Store](https://apps.apple.com/us/app/onlyfast/id6792149373)
- [Google Play](https://play.google.com/store/apps/details?id=app.onlyfast)

Badge assets are downloaded from Apple's developer badge assets and Google's
official badge assets. No store URLs were invented.

Homepage HTML has title, description, canonical URL, Open Graph and Twitter
metadata. React updates canonical and robots metadata by route. The sitemap lists
only the root, existing legal pages, support and account-deletion information.
Robots excludes app/auth/billing routes. Vercel response header configuration adds
`X-Robots-Tag: noindex, nofollow` for app/auth/billing routes and native root launches.
The marketing page remains a client-rendered SPA using the existing build system;
no SSR/framework migration was introduced.

## Files

Created:

- `src/pages/PublicHome.tsx`
- `src/pages/public-home.css`
- `src/pages/AppEntry.tsx`
- `src/hooks/useEntrySession.ts`
- `src/components/RouteMetadata.tsx`
- `public/marketing/app-store.svg`
- `public/marketing/google-play.png`
- `public/marketing/onlyfast-garage-640.webp`
- `public/marketing/onlyfast-garage-1280.webp`
- `public/marketing/onlyfast-garage-1821.webp`
- `public/sitemap.xml`
- `tests/publicWebsiteRouting.test.ts`
- `qa/automation/public-website.mjs`
- `docs/PUBLIC_WEBSITE_PREVIEW.md`

Modified:

- `src/App.tsx`: additive root, `/app`, `/login` routing and metadata component.
- `src/lib/paymentVisibility.ts`: exports existing native routing context;
  retains the launch parameter if marker persistence fails.
- `src/components/SafeBackHandler.tsx`: confines native history interception to native context.
- `src/lib/safeBack.ts`: recognizes both dashboard entry paths; browser calls do not install native guards.
- `index.html`: public SEO metadata.
- `public/robots.txt`: crawler policy and sitemap location.
- `vercel.json`: indexing headers only; existing deployment and rewrite settings preserved.

## Verification

- `npm test`: **540 passed, 0 failed** (531 existing tests and 9 added tests).
- `npm exec tsc -- --noEmit -p tsconfig.app.json`: passed.
- `npm run build`: passed.
- `npm run release:check`: passed; **76 production files verified**, including
  checks against QA endpoints, historical bridge modules and experimental ad transports.
- `git diff --check`: passed.
- Local production-preview HTTP checks: `/`, `/app` and `/sitemap.xml` return 200.
- Local production-build browser harness: **10 groups passed**:
  desktop rendering/SEO/store links, mobile navigation/keyboard/anchors,
  Login/Launch buttons and browser back, browser login/reload/signout,
  authenticated root redirect without marketing flash and query/hash retention,
  Android/iOS wrapper login/reload, stored native marker and explicit browser reset,
  recovery callbacks, blocked marker storage reload, and email confirmation callback.
- No horizontal overflow at 320, 390, 768, 1024 or 1440px.

Browser automation uses synthetic users and sessions and intercepts **all**
Supabase requests. It never contacts real auth, data, email, billing or telemetry
services. Results are in `tmp/public-website/results.json`; unit results are in
`tmp/public-website/unit-tests.log`.

To rerun browser tests, provide Playwright from an installed external/local QA
environment, with Chrome available:

```powershell
$env:ONLYFAST_PLAYWRIGHT_MODULE = (Join-Path (Get-Location) 'tmp/public-home-browser/node_modules/playwright/index.mjs')
$env:ONLYFAST_WEBSITE_URL = 'http://127.0.0.1:4173'
node qa/automation/public-website.mjs
```

Playwright was installed only under ignored `tmp/public-home-browser`; repository
dependency manifests and lockfiles were not changed.

## Remaining validation before production

- Physical Android/iOS wrapper login/onboarding, actual Supabase email delivery,
  and real store purchase/restore flows were not exercised. Wrapper simulations
  verify routing/UI compatibility; they do not replace device acceptance.
- Setup Notebook, Setup Assist, schedules, timing, OnlyLaps, shares and membership
  restrictions retain their implementation and pass the existing regression suite.
  They were not exercised against live customer data.
- Vercel indexing headers have not been observed on a deployment; local Vite
  preview does not execute Vercel's response-header configuration.
- The build still reports a large main-bundle warning. No broad application
  refactor was introduced as part of this additive website change.
- Production deployment awaits the user's review and separate approval.

## Garage image and light-palette visual revision

The subsequent visual redesign changes only `PublicHome.tsx`, its scoped
stylesheet, three public image assets, and this report. Routing, authentication,
membership data, native styles, official logo assets, and billing/ad flags remain
as implemented before this revision. The visible homepage wording is preserved;
a comparison checked all 60 non-decorative JSX text segments against the prior
version. The old sprint image is no longer used on the public homepage.

The supplied 1821 × 864 PNG (2,365,679 bytes) was resized proportionally and encoded
as WebP without cropping, retouching, compositing, or adding text:

| Image width | Height | File bytes |
| --- | --- | --- |
| 640 | 304 | 47,644 |
| 1280 | 607 | 139,044 |
| 1821 | 864 | 223,992 |

`srcset` and `sizes` select a suitable resolution. The image uses full width,
automatic height and `object-fit: contain`, with no transform. The garage photo
is placed in a wide silver frame below the hero copy so all three cars remain
visible on small screens. Header and footer use silver-gray surfaces; features,
pricing and downloads alternate pale blue/gray gradients with white cards.

Visual revision verification: production build and TypeScript passed; all 10
existing local browser regression groups passed. Desktop and mobile screenshots
above were regenerated from the updated production build and visually reviewed.
Image proportions, complete image bounds and horizontal overflow were also
checked at 320, 390, 768, 1024, 1440 and 1920 pixels. No deployment was performed.

### Latest revision: portrait garage image

The latest supplied 1122 × 1402 portrait image replaces the earlier wide garage
image on the homepage. It is optimized into responsive WebP assets:
`onlyfast-garage-portrait-480.webp` (74,336 bytes),
`onlyfast-garage-portrait-800.webp` (168,270 bytes), and
`onlyfast-garage-portrait-1122.webp` (270,908 bytes).
The source PNG is 3,086,479 bytes; no image content was retouched or cropped.

This supersedes the wide silver-framed layout described above. The portrait
image now sits beside the hero copy on desktop and fills the viewport width on
mobile. The decorative frame, padding, rounded corners and fixed image sizing
have been removed. Automatic height preserves the supplied image's proportions;
the mobile page scrolls naturally rather than cropping the image into a short box.
Earlier image assets remain preserved but are no longer referenced by the homepage.

The production build and all 10 local browser regression groups passed again.
Image proportions, absence of cropping/frame/overflow, and mobile full-width
behavior were checked at 320, 390, 768, 1024, 1440 and 1920 pixels.
Updated desktop/mobile screenshots are at the links above; a complete mobile
hero screenshot is [also available](../tmp/public-website/mobile-portrait-hero.png).
Routing, authentication, pricing, native app appearance and production deployment
remain unchanged.

### Latest hero composition: integrated image and text overlay

The same supplied portrait garage asset is retained, without generating or
editing image content. Hero text now shares a layered grid with the image.
A silver-blue gradient blends the photograph into the text region on desktop;
on mobile, the full-width image overlaps the lower copy and buttons beneath
a vertical gradient. A larger, tighter headline uses dark slate and a blue
text gradient. The official logo, every visible word, and CTA destinations
remain unchanged. The rest of the homepage retains its prior structure/styles.

The production build and all 10 browser regression groups passed. Additional
checks confirm unchanged wording, overlapping text/image composition, original
image proportions, and no horizontal overflow at 320, 390, 768, 1024, 1440 and
1920 pixels. Desktop, tablet and mobile screenshots were reviewed. The screenshot
links above now show this composition. No production deployment was performed.

### Store badge alignment correction

The intact Google Play PNG has a 646 × 250 canvas but its visible artwork is
564 × 168, surrounded by 41 transparent pixels on all four sides. The Apple SVG
has effectively no comparable padding. Previously, identical image boxes made
the Google badge look smaller.

Only the public marketing badge markup/styles were adjusted. Both links now use
identical 168 × 68 containers and 12px spacing. Apple renders at 42px high; Google
renders its original padded canvas at 62.5px high, making its visible artwork
exactly 42px high too. Width is automatic and `object-fit: contain` preserves each
official badge's original proportions. No artwork was cropped, stretched or edited.
The different intrinsic badge widths remain centered inside matching containers.

This keeps the preferred black Apple badge first, above Apple's 40px onscreen
minimum, with at least one-quarter-height clear space around both badges, in line
with the [Apple badge guidelines](https://developer.apple.com/app-store/marketing/guidelines/)
and [Google Play badge guidance](https://partnermarketinghub.withgoogle.com/brands/google-play/google-play/lockups-icons-badges/?folder=86718).

Production build and targeted browser checks passed at 1440, 390 and 320px.
The two badges share identical container dimensions, visible heights and vertical
alignment on desktop/390px mobile. At 320px they stack with centered alignment.
The original store link destinations and absence of horizontal overflow were
verified. Results are in `tmp/public-website/badge-checks.json`.

- [Desktop download preview](../tmp/public-website/desktop-download.png)
- [Mobile download preview](../tmp/public-website/mobile-download.png)
- [Narrow mobile badges](../tmp/public-website/narrow-mobile-badges.png)

Native application files, routing, authentication and deployment remain unchanged.
