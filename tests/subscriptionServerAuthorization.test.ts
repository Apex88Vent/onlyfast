import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { resolveServerMembership } from '../supabase/functions/_shared/usage-authorization.ts';
import { resolveAuthorizedMembership } from '../src/lib/trustedMembership.ts';

Object.defineProperty(globalThis,'Deno',{configurable:true,value:{env:{get:()=>''}}});

for (const name of ['get-suggestions','scan-timing-screen']) test(`${name}: trusted RPC ignores editable privileges and fails closed`, async () => {
  const source=readFileSync(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8');
  const ast=ts.createSourceFile('edge.ts',source,ts.ScriptTarget.Latest,true);
  const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='resolveEffectiveTier');
  assert.ok(fn);
  const js=ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const resolve=new Function('resolveServerMembership',js+';return resolveEffectiveTier;')(resolveServerMembership);
  let data:unknown='rookie';let error:{message:string}|null=null;
  const user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_metadata:{membership_tier:'team',has_admin_full_access:true,promo_access_level:'teams'}};
  const admin={rpc:async(name:string,args:Record<string,unknown>)=>{
    assert.equal(name,'onlyfast_membership_for_user');assert.equal(args.p_user_id,user.id);
    return {data,error};
  }};
  for (const [actual,expected] of [['rookie','rookie'],['pro','pro'],['team','team'],['admin','team']]) {
    data=actual;assert.equal(await resolve(admin,user),expected);
  }
  data=null;await assert.rejects(resolve(admin,user),/Invalid membership/);
  error={message:'database unavailable'};await assert.rejects(resolve(admin,user),/unavailable/);
});

test('client authorization agrees with PostgreSQL paid/promo/expiration precedence', () => {
  const row={plan:'pro',status:'active',subscription_source:'stripe'};
  const expired={promo_access_level:'teams',promo_access_expires_at:'2000-01-01'};
  assert.equal(resolveAuthorizedMembership(row,expired).membership_tier,'pro');
  assert.equal(resolveAuthorizedMembership(row,{...expired,promo_access_expires_at:'bad-date'}).membership_tier,'pro');
  assert.equal(resolveAuthorizedMembership(row,{promo_access_level:'teams'}).membership_tier,'team');
  assert.equal(resolveAuthorizedMembership({...row,plan:'teams',subscription_source:'revenuecat',revenuecat_expires_at:'2000-01-01'},{}).membership_tier,'rookie');
  assert.equal(resolveAuthorizedMembership(null,{has_admin_full_access:true}).membership_tier,'team');
});
