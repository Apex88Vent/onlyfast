# OnlyFast dashboard stability release

This production candidate starts from `0568dadbe8c30457058eb7c7ef1984e2a08a9abe`. It carries the shared dashboard, authentication recovery, and deferred-feature fixes validated on the 2027 Preview. The production route and provider configuration come from the current application.

## Retained assets

The production builds at `dpl_GvK8WnMhHVNtwpzT9z9PjbotvBAD` and `dpl_8NFvGedoKHaMQXRpbqmqgAy11yte` can both be open in a WebView. The commit stores their exact JavaScript and CSS dependency graphs in `public/assets`. Their SHA-256 checksums and deployment provenance are recorded in `scripts/retained-web-assets.json`. The new HTML references the new entry. Vite copies the retained files during every build, and Vercel runs the release check against the source and built files. A missing asset path receives a 404. Application routes keep the SPA fallback.

For a later rollout, capture the newly superseded builds from their immutable deployment URLs. Add their exact content-hashed files and checksums before switching the app domain. Retain the entry, static and dynamic imports, styles, and any referenced content-hashed media. Keep the manifest and files together. Remove a retained build only after a reviewed support window. Archive the verified artifact alongside its source commit.

## Release procedure after approval

1. Export the exact release commit. Verify the original project and team, the production environment settings, and the current domain deployment. Use the reviewed Node and lockfile with `npm ci`. Run `npm run release:check` with production build provenance and the release commit as the build version.
2. Stage the release in the existing Vercel project using `vercel deploy --prod --skip-domain`. Verify the staged deployment has no production domain assigned. Compare its app entry and every retained asset against the release manifest, check the hosted JavaScript content types and missing-asset 404, and exercise sign-in, Team access, and the normal setup and schedule screens.
3. Test a suspended pre-release session and a fresh session on the Android and iOS Median wrappers. Verify the session refresh and resume behavior with an unsaved draft. Use designated test identities and existing setup and schedule reads.
4. Promote the verified deployment. Validate `onlyfast.app` and `www.onlyfast.app`, the old and new asset URLs, and native login and resume. If Git is synchronized after promotion, sync only the exact approved release commit. A Git-triggered Vercel rebuild runs the same asset gate. Verify its domain and asset responses if it becomes active.
5. Keep `dpl_GvK8WnMhHVNtwpzT9z9PjbotvBAD` available as the rollback target. If the rollout fails, use Vercel Instant Rollback to that deployment and verify the domain aliases and protected app flow. Preserve the new artifact for diagnosis. This release has no database migration.

## Known limits

This preparation does not deploy the candidate. Physical Median acceptance requires a connected Android device and an iPhone or an available native-device testing service. An older process that already cached a failed dynamic import can require one reopen. A client older than the two archived releases may also need a reopen. The initial JavaScript request is larger because it includes the dashboard. The normal data reads and server authorization continue to govern subscriptions, saved setups, and race schedules.
