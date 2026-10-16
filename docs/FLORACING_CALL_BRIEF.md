# OnlyFast x FloRacing
**Tulsa Shootout + Chili Bowl | Follow-up call brief | October 13, 2026**

**Call objective:** Get an itemized proposal for promoting OnlyFast around both events, with a measurable path to racer sign-ups. Confirm the intended event editions and dates.

## Introduction to use on the call

OnlyFast builds a race setup and race-weekend management app for drivers, crews, and teams. Racers can record class-specific chassis settings, track conditions, and session changes; save race weekends; review timing screenshots; and use handling feedback with AI Setup Assist. The app also includes race scheduling, to-do lists, parts references, and plan-dependent setup comparison, sharing, and PDF export. Rookie is free; current onboarding marks Pro and Teams as coming soon while preserving existing paid access.

## Audience fit and OnlyFast placements

**Product fit, not measured reach:** The current code includes dirt oval classes such as Midgets, Non-Wing Sprint Cars, and Lightning Sprints, plus other racing disciplines. No dedicated micro-sprint sheet was found. Driver/crew relevance is a positioning hypothesis; event-viewer overlap needs Flo's evidence.

**Implemented placement contexts:** Home middle/bottom; saved setups; below track conditions, timing scan/results, and session tools; parts reference, schedule, and to-do pages; plus a dismissible message after a successful manual setup save. These currently display animated OnlyFast Pro-upgrade house ads. They could inform a future partner discussion but are not verified sellable sponsor inventory.

**Eligibility and readiness:** Ads require a signed-in, effective Rookie account; paid, admin, and promo-unlocked accounts are excluded. The Median iOS wrapper suppresses house-ad content. AdSense slot IDs remain placeholders, and its component is not wired into these current placements. Findings reflect local code, including uncommitted changes, rather than verified production delivery.

## Questions for FloRacing

1. **Packages:** What is available for each event and a combined buy: live-stream spots, host reads, overlays, replay placements, event-page display, email, or social? Which sessions/devices are included? Are category exclusivity and smaller test packages available?
2. **Rates and delivery:** Can you quote each option with CPM or flat-fee basis, minimum spend, guaranteed impressions/reads, production fees, bundle discounts, payment terms, and makegoods for underdelivery or schedule changes?
3. **Audience and targeting:** What are the latest event-specific unique viewers, impressions, geography, device mix, and repeat-viewing rates, with dates and definitions? Can you distinguish racers/crew from general fans, target by event/geography/interest, cap frequency, and deduplicate reach across both events?
4. **Timing and creative:** What are the booking, asset, and approval deadlines; exact flight dates; and availability for lead-up, preliminary nights, finals, and replays? What video lengths, dimensions, audio rules, links/QR codes, and creative rotation are supported?
5. **Performance:** Will reports break out spend, delivery, unique reach, frequency, video completion, and clicks/CTR by event, placement, day, and device? Can we use UTMs, a QR code, or an event offer to attribute sign-ups? What attribution windows, reporting cadence, exports, and conversion integrations are available?

**OnlyFast metrics to verify internally:** What are our active users, geography/class mix, Rookie share, sessions/pageviews, available ad impressions, and sign-up conversion baseline? No verified audience or traffic totals were available in the inspected project.

**Leave with:** An itemized proposal, inventory/spec sheet, dated audience evidence, reporting sample, and agreed next step with an owner and deadline.

<small>Code basis: active entry `index.html -> src/main.tsx`; `src/components/{SetupDashboard,OnboardingFlow,PlanSelection,RookieAdSlot,RookieHouseAdContent}.tsx`; `src/lib/{ads,classConfigs,setupLibraryAccess}.ts`. Review date: October 13, 2026. Backend-dependent features were inspected in code, not exercised live.</small>
