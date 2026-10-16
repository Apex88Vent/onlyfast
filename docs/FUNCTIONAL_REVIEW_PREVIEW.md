# Functional review preview

Open http://127.0.0.1:5194/?fresh=1 in the Codex browser to start at the first onboarding slide with a fresh local Rookie test account. The running review server is separate from the normal app server.

To restart the server from this workspace:

```powershell
npx vite --config vite.review.config.ts --host 127.0.0.1 --port 5194 --strictPort
```

The preview uses today's actual app components, slideshow, discipline/class selectors, plan selection, landing page, setup sheets, save controls, saved setups, base setup controls, schedule and session UI. A preview-only backend adapter keeps test data in this browser's localStorage. No real Supabase account, database migration, billing action or deployment is used. The normal production entry and Vite configuration are unchanged.

The top bar includes **Restart from slide one** and **Test plan** controls. The plan control simulates Rookie, Pro and Teams for reviewing their UI restrictions; it does not purchase or alter a subscription. Restart clears only preview-origin OnlyFast data. The fresh marker is consumed on launch, so ordinary browser reloads retain completed onboarding and saved test values.

Live AI, OCR, weather, billing, external sharing, email/authentication and uploads are unavailable in this isolated preview. Their screens can be reviewed, but this preview does not verify those backend services.

Verified in the Codex browser: all 12 onboarding slides → Road Racing → GT3 → Rookie → landing → New Setup → enter track and rear-wing values → save → browser reload → saved name and values remain correct. The preview was reset to slide one after checking. A separate adapter test covers all ten Road Racing classes through onboarding, save/reopen, copy, rename, race sessions, delete and reload. The full automated suite passed 328 tests, and the review build passes.

Build the review artifact separately if needed:

```powershell
npx vite build --config vite.review.config.ts
```

That command writes `review-dist/`; `npm run build` remains the normal production build.
