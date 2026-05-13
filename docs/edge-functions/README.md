# Edge Functions for your database project

The frontend calls two edge functions:

- `database.functions.invoke('get-weather', ...)`
- `database.functions.invoke('get-suggestions', ...)`

Because you've switched the app to your own database project
(`thpyjvwtfvfxiufchrxn`), you must deploy these on **your** project. The
old Famous-managed copies are not reachable from your new client.

The full source code lives next to this README:

- `docs/edge-functions/get-weather.ts`
- `docs/edge-functions/get-suggestions.ts`

---

## Easiest path: deploy from the database Dashboard (no CLI)

1. Open https://database.com/dashboard/project/thpyjvwtfvfxiufchrxn/functions
2. Click **Create a new function**.
3. Name it exactly **`get-weather`**.
4. Toggle **Verify JWT** to **OFF** (the app calls these from non-authenticated
   contexts during onboarding).
5. Paste the entire contents of `docs/edge-functions/get-weather.ts` into the
   editor and click **Deploy function**.
6. Repeat for **`get-suggestions`** using `docs/edge-functions/get-suggestions.ts`.
7. For `get-suggestions` only — go to **Project Settings → Edge Functions →
   Secrets** and add:
   ```
   OPENAI_API_KEY = sk-your-real-openai-key
   ```
   No redeploy is required after adding the secret; the next invocation picks
   it up.

---

## CLI alternative

```bash
npm install -g database
database login
database link --project-ref thpyjvwtfvfxiufchrxn

# get-weather (no secret needed)
mkdir -p database/functions/get-weather
cp docs/edge-functions/get-weather.ts database/functions/get-weather/index.ts
database functions deploy get-weather --no-verify-jwt

# get-suggestions (needs OPENAI_API_KEY)
mkdir -p database/functions/get-suggestions
cp docs/edge-functions/get-suggestions.ts database/functions/get-suggestions/index.ts
database secrets set OPENAI_API_KEY=sk-your-real-openai-key
database functions deploy get-suggestions --no-verify-jwt
```

> Note: I named the source folder `docs/edge-functions/` (instead of the
> conventional `database/functions/`) on purpose, because this codebase
> reserves `database/functions/` for tooling that auto-deploys to the original
> Famous-managed project. Copying these files into `database/functions/` on
> your own machine — as shown above — is the standard CLI workflow.

---

## Smoke test

```bash
# get-weather
curl -X POST \
  https://thpyjvwtfvfxiufchrxn.supabase.co/functions/v1/get-weather \
  -H "Content-Type: application/json" \
  -H "apikey: sb_publishable_ybLt4_i5kyRQxjRv4YbRsg_kcEqzTxv" \
  -H "Authorization: Bearer sb_publishable_ybLt4_i5kyRQxjRv4YbRsg_kcEqzTxv" \
  -d '{"latitude":36.1699,"longitude":-115.1398}'

# get-suggestions
curl -X POST \
  https://thpyjvwtfvfxiufchrxn.supabase.co/functions/v1/get-suggestions \
  -H "Content-Type: application/json" \
  -H "apikey: sb_publishable_ybLt4_i5kyRQxjRv4YbRsg_kcEqzTxv" \
  -H "Authorization: Bearer sb_publishable_ybLt4_i5kyRQxjRv4YbRsg_kcEqzTxv" \
  -d '{"entry_handling":"tight","mid_handling":"perfect","exit_handling":"loose","raceClass":"Dwarf Cars","currentSetup":{"cross_weight":52}}'
```

Both should return JSON with status 200. Common failures:

- **404 / "Function not found"** — you haven't deployed the function yet.
  Re-do the dashboard or CLI steps above.
- **401 / "Invalid JWT"** — Verify JWT was left ON. Either turn it OFF for the
  function, or make sure the request includes the `apikey` + `Authorization`
  headers shown above. The frontend's `supabase.functions.invoke()` adds
  these automatically, so toggling Verify JWT OFF is the simpler fix.
- **500 mentioning `OPENAI_API_KEY`** — set the secret in
  Project Settings → Edge Functions → Secrets.
- **502 from `get-suggestions`** — OpenAI itself rejected the request. The
  body will include OpenAI's reason (bad key, no quota, model not allowed,
  etc.). The frontend now displays this verbatim.

---

## Behavioural notes

### `get-weather`
- Uses **Open-Meteo** only (no API key, no fallback). The previous version
  also tried wttr.in first; that path has been removed for simplicity and
  predictability, exactly as you requested.
- Wind direction is converted from degrees to a 16-point compass label
  (`N`, `NNE`, … `NNW`).
- WMO weather codes are mapped to short human labels (`Clear`,
  `Partly cloudy`, `Rain`, `Thunderstorm`, …).

### `get-suggestions`
- Uses **OpenAI directly** (`api.openai.com/v1/chat/completions`) with model
  `gpt-4o-mini`. The previous version went through the Famous AI Gateway and
  Gemini — that's no longer applicable on your own project.
- Returns 500 with a clear message if `OPENAI_API_KEY` is missing.
- Returns 502 with the OpenAI error body (truncated to 500 chars) if OpenAI
  itself rejects the request — makes debugging quota / model-name issues much
  easier than a generic "failed".
- Both `whatIfQuestion` and the standard suggestions modes are preserved
  exactly as the frontend already expects.

If you want to change the model (e.g. to `gpt-4o` for higher quality, or
`gpt-3.5-turbo` to cut cost), edit one line in `get-suggestions.ts` and
redeploy — search for `model: 'gpt-4o-mini'`.
