import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('racing mutations capture the initiating account JWT and reject a switched identity', async () => {
  const a = { user:{ id:'account-a' },access_token:'jwt-a' };
  const b = { user:{ id:'account-b' },access_token:'jwt-b' };
  let session = a;
  const requests: {url:string; token:string|null; body:unknown}[] = [];
  const originalFetch = globalThis.fetch;
  let release!: (value: Response) => void;
  const compiled = ts.transpileModule(
    readFileSync(new URL('../src/lib/activeClass.ts',import.meta.url),'utf8').replaceAll('import.meta.env.DEV','false'),
    { compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021 } }).outputText;
  const api = {} as {
    changeActiveClass:(car:string,uid:string)=>Promise<unknown>;
    completeRacingOnboarding:(uid:string)=>Promise<unknown>;
    saveOnboardingProgress:(step:string,discipline:undefined,car:undefined,uid:string)=>Promise<unknown>;
  };
  new Function('require','exports',compiled)(() => ({
    supabaseUrl:'https://backend.example.invalid',supabaseKey:'public-qa',
    supabase:{ auth:{ getSession:async()=>({data:{session}}) },rpc:()=>assert.fail('Unbound mutation') },
  }),api);
  globalThis.fetch = async (url, init) => {
    requests.push({url:String(url),token:new Headers(init?.headers).get('Authorization'),body:JSON.parse(String(init?.body))});
    return new Promise<Response>(resolve=>{release=resolve});
  };
  try {
    for (const mutation of [
      ()=>api.changeActiveClass('Modified',a.user.id),
      ()=>api.completeRacingOnboarding(a.user.id),
      ()=>api.saveOnboardingProgress('discipline',undefined,undefined,a.user.id),
    ]) {
      session = a;
      const before = requests.length;
      const pending = mutation();
      await Promise.resolve();
      assert.equal(requests.length,before+1);
      session = b;
      release(new Response(JSON.stringify({active_class:'Modified',onboarding_step:'complete'}),{status:200}));
      await pending;
      assert.equal(requests.at(-1)?.token,'Bearer jwt-a');
      await assert.rejects(mutation(),/CLASS_AUTH_REQUIRED/);
      assert.equal(requests.length,before+1,'new account never receives the previous selection');
    }
  } finally { globalThis.fetch=originalFetch; }
});
