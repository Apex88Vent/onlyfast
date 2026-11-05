import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { QA_EMAIL, QA_PRODUCTION_REF, QA_PRODUCTION_USER, isUUID } from '../../supabase/functions/_shared/qa-fixtures.ts';

export class QAError extends Error {
  constructor(code) { super(code); this.name = 'QAError'; this.code = code; }
}
export async function configuredEnvironment(env = process.env) {
  const values = { ...env };
  if (env.ONLYFAST_QA_SECRET_FILE) {
    const target = await realpath(env.ONLYFAST_QA_SECRET_FILE);
    const repository = await realpath(new URL('../../', import.meta.url));
    const relative = path.relative(repository, target);
    const outside = relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
    if (!path.isAbsolute(env.ONLYFAST_QA_SECRET_FILE) || !outside) {
      throw new QAError('QA_SECRET_FILE_MUST_BE_OUTSIDE_REPOSITORY');
    }
    const secret = parseEnv(await readFile(target, 'utf8'));
    // Runtime approvals cannot be smuggled into a reusable credential file.
    for (const key of ['ONLYFAST_QA_URL','ONLYFAST_QA_PUBLIC_KEY','ONLYFAST_QA_USER_ID','ONLYFAST_QA_PASSWORD','ONLYFAST_QA_REFRESH_TOKEN','ONLYFAST_QA_STAGING_REF']) {
      if (values[key] === undefined && secret[key] !== undefined) values[key] = secret[key];
    }
  }
  return values;
}
export function qaConfig(env, mode) {
  if (!['local','staging','production'].includes(mode)) throw new QAError('QA_ENVIRONMENT_REQUIRED');
  let url;
  try { url = new URL(env.ONLYFAST_QA_URL); } catch { throw new QAError('QA_URL_REQUIRED'); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new QAError('QA_URL_INVALID');
  const ref = mode === 'local' ? 'local' : url.hostname.split('.')[0];
  if (mode === 'local' && !['http://127.0.0.1:54321','http://localhost:54321'].includes(url.origin)) throw new QAError('QA_LOCAL_ORIGIN_REQUIRED');
  if (mode !== 'local' && (url.protocol !== 'https:' || url.port || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname))) throw new QAError('QA_HOSTED_ORIGIN_REQUIRED');
  if (mode === 'production' && (ref !== QA_PRODUCTION_REF || env.ONLYFAST_QA_PRODUCTION_READS_APPROVED !== 'true')) throw new QAError('QA_PRODUCTION_APPROVAL_REQUIRED');
  if (mode === 'staging' && (ref === QA_PRODUCTION_REF || ref !== env.ONLYFAST_QA_STAGING_REF)) throw new QAError('QA_STAGING_PROJECT_REQUIRED');
  const userId = mode === 'production' ? QA_PRODUCTION_USER : env.ONLYFAST_QA_USER_ID;
  if (!isUUID(userId) || (mode === 'production' && env.ONLYFAST_QA_USER_ID && env.ONLYFAST_QA_USER_ID !== userId)) throw new QAError('QA_IDENTITY_CONFIGURATION_REQUIRED');
  const publicKey = env.ONLYFAST_QA_PUBLIC_KEY || '';
  let publicRole = publicKey.startsWith('sb_publishable_');
  try { publicRole ||= JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* Reject malformed keys. */ }
  if (!publicRole || publicKey.startsWith('sb_secret_')) throw new QAError('QA_PUBLIC_KEY_REQUIRED');
  if (!env.ONLYFAST_QA_PASSWORD && !env.ONLYFAST_QA_REFRESH_TOKEN) throw new QAError('QA_AUTH_CONFIGURATION_REQUIRED');
  return Object.freeze({ mode, url: url.origin, ref, publicKey, userId, email: QA_EMAIL,
    password: env.ONLYFAST_QA_PASSWORD, refreshToken: env.ONLYFAST_QA_REFRESH_TOKEN,
    mutationsApproved: mode !== 'production' || env.ONLYFAST_QA_PRODUCTION_MUTATIONS_APPROVED === 'true',
    resetApproved: env.ONLYFAST_QA_RESET_APPROVED === 'true', edgeReadsApproved: env.ONLYFAST_QA_EDGE_READS_APPROVED === 'true' });
}
export function safeError(error) { return error instanceof QAError ? error.code : 'QA_OPERATION_FAILED'; }
