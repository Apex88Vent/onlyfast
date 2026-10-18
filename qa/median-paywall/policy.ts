// QA only. No production imports, fallback backend, secret keys or store APIs.
export const QA_FEATURE = 'native_subscription_testing';
export function qaSettings(env: Record<string, string | undefined>) {
  const anonKey = env.ONLYFAST_QA_ANON_KEY || '';
  let publicKey = anonKey.startsWith('sb_publishable_');
  try { publicKey ||= JSON.parse(atob(anonKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; }
  catch { /* Reject secret/service-role credentials. */ }
  if (!publicKey) throw Error('Set an explicit LOCAL anonymous/public key.');
  const testerId = env.ONLYFAST_QA_TESTER_UUID || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(testerId)) throw Error('Set the synthetic LOCAL tester UUID.');
  const httpsOrigin = env.ONLYFAST_QA_HTTPS_ORIGIN || '';
  if (httpsOrigin) {
    const url = new URL(httpsOrigin);
    if (url.protocol !== 'https:' || url.origin !== httpsOrigin || url.username || url.password ||
      /(^|\.)(onlyfast\.app|supabase\.co)$/.test(url.hostname)) throw Error('Use a dedicated approved HTTPS QA origin, never production.');
  }
  for (const [field, prefix] of [['ONLYFAST_QA_ANDROID_KEY', 'goog_'], ['ONLYFAST_QA_IOS_KEY', 'appl_']]) {
    if (env[field] && !env[field]!.startsWith(prefix)) throw Error('Only platform PUBLIC SDK keys are allowed.');
  }
  return { testerId, anonKey, httpsOrigin,
    androidKey: env.ONLYFAST_QA_ANDROID_KEY || '', iosKey: env.ONLYFAST_QA_IOS_KEY || '',
    presentationOnly: env.ONLYFAST_QA_PRESENTATION_ONLY === 'true',
    storeActionsApproved: env.ONLYFAST_QA_STORE_ACTIONS_APPROVED === 'true' };
}
export type QASettings = ReturnType<typeof qaSettings>;
export function allowedOrigin(origin: string, settings: QASettings): boolean {
  return ['http://127.0.0.1:8086', 'http://localhost:8086', settings.httpsOrigin].filter(Boolean).includes(origin);
}
export function allowedQaAsset(path: string, sourceFiles: string[], dependencyFolders: string[]): boolean {
  let decoded: string;
  try { decoded = decodeURIComponent(path); } catch { return false; }
  if (decoded.includes('%') || decoded.includes('\\') || decoded.split('/').includes('..')) return false;
  if (['/', '/index.html', '/client.ts', '/policy.ts', '/@vite/client'].includes(decoded)) return true;
  if (sourceFiles.includes(decoded)) return true;
  return dependencyFolders.some(folder => decoded.startsWith(folder) && /^(?:@supabase_supabase-js|chunk-[\w-]+)\.js$/.test(decoded.slice(folder.length)));
}
export function allowedProxy(method: string, path: string, presentationOnly = false): boolean {
  if (presentationOnly && path.startsWith('/functions/')) return false;
  return (method === 'POST' && ['/auth/v1/token', '/auth/v1/logout',
    '/functions/v1/sync-revenuecat-subscription', '/rest/v1/rpc/get_onlyfast_membership'].includes(path)) ||
    (method === 'GET' && path === '/auth/v1/user');
}
export function assertTester(expected: string, user: { id: string; email?: string },
  account: { is_test_account?: boolean; beta_features_enabled?: boolean; tester_kind?: string } | null,
  flags: { feature_key: string; enabled: boolean }[]): void {
  // Reuses the existing local experimental tester policy, without full-access grants.
  if (user.id !== expected || !user.email?.endsWith('@example.invalid') ||
    !account?.is_test_account || !account.beta_features_enabled || account.tester_kind !== 'experimental' ||
    !flags.some(f => f.feature_key === QA_FEATURE && f.enabled === true) ||
    flags.some(f => f.feature_key === 'test_account_full_access' && f.enabled === true)) {
    throw Error('A designated server-authorized synthetic local tester is required.');
  }
}
