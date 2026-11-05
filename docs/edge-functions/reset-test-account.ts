// Documentation pointer only.
//
// Deploy the canonical implementation at:
//   supabase/functions/reset-test-account/index.ts
//
// It imports:
//   supabase/functions/_shared/beta-features.ts
//
// The prior standalone example authorized by email and must not be redeployed.
// The prepared canonical function additionally requires an explicit fixture
// allowlist and confirmation, pins the dedicated identity and refuses external
// references. It preserves subscriptions, Auth metadata and legacy QA data.
// Ordinary login/logout calls are inert locally. Nothing is deployed here.
export {};
