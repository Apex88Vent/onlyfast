import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as queue from '../src/lib/offlineQueue.ts';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function storage() {
  const values = new Map<string,string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string,value: string) => values.set(key,value),
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] || null,
    removeItem: (key: string) => values.delete(key),
  } });
  return values;
}
function item(userId=owner, name='Weekend') {
  return { ownerId: userId, op: 'insert' as const, setupType:'base' as const,
    setupName: name, payload: { id: crypto.randomUUID(), user_id:userId, notes:name } };
}
test('queue partitions owners, retains untrusted legacy entries and replays the returning owner', async () => {
  const saved=storage();
  const legacy={ id:'old',payload:{user_id:owner,notes:'legacy remains recoverable'} };
  localStorage.setItem('onlyfast_pending_saves_v1',JSON.stringify([legacy]));
  queue.enqueue(item(owner)); queue.enqueue(item(other));
  assert.equal(queue.readQueue().length,0);
  assert.equal(queue.readQueue(owner).length,1);
  assert.equal(queue.readQueue(other).length,1);
  let signedIn=other;
  const applied:string[]=[];
  const run=(id:string)=>queue.drainOwnedQueue(id,{
    currentUser:async()=>signedIn,save:async entry=>{applied.push(entry.ownerId);},changed(){},
  });
  await run(owner); assert.deepEqual(applied,[]);
  await run(other); assert.deepEqual(applied,[other]);
  signedIn=owner; await run(owner); assert.deepEqual(applied,[other,owner]);
  assert.deepEqual(JSON.parse(saved.get('onlyfast_pending_saves_v1')!),[legacy]);
});
test('failures, expired sessions and interrupted replay preserve all remaining operations', async () => {
  storage(); const first=queue.enqueue(item(owner,'First'));queue.enqueue(item(owner,'Second'));
  await queue.drainOwnedQueue(owner,{currentUser:async()=>null,save:async()=>assert.fail(),changed(){}});
  assert.equal(queue.readQueue(owner).length,2);
  await queue.drainOwnedQueue(owner,{currentUser:async()=>owner,save:async()=>{throw Error('network or policy');},changed(){}});
  assert.equal(queue.readQueue(owner)[0].id,first.id);
  let current=owner;let changes=0;
  await queue.drainOwnedQueue(owner,{currentUser:async()=>current,save:async()=>{current=other;},changed(){changes++;}});
  assert.equal(queue.readQueue(owner).length,1);assert.equal(changes,0);
  await queue.drainOwnedQueue(owner,{currentUser:async()=>owner,save:async()=>{},changed(){}});
  assert.equal(queue.readQueue(owner).length,0);
});
test('simultaneous drains execute one replay and stable row IDs survive retry', async () => {
  storage(); const pending=queue.enqueue(item());
  let release!:()=>void;
  const wait=new Promise<void>(resolve=>{release=resolve;}); let writes=0;
  const callbacks={currentUser:async()=>owner,save:async entry=>{writes++;assert.equal(entry.payload.id,pending.payload.id);await wait;},changed(){}};
  const first=queue.drainOwnedQueue(owner,callbacks);const second=queue.drainOwnedQueue(owner,callbacks);
  assert.equal(first,second);
  release();await Promise.all([first,second]);assert.equal(writes,1);
});
test('invalid ownership and failed durable storage cannot report queued success', () => {
  storage();
  assert.throws(()=>queue.enqueue({...item(),ownerId:other}),/owner mismatch/);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{throw Error('quota full');}}});
  assert.throws(()=>queue.enqueue(item()),/quota full/);
});
for (const insertError of [{code:'23505',message:'duplicate key'}, {code:'42501',message:'ROOKIE_SETUP_EDIT_LOCKED'}])
test(`actual insert retry recovers a committed row after ${insertError.code}`, async () => {
  const source=readFileSync(new URL('../src/components/SetupDashboard.tsx',import.meta.url),'utf8');
  const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let expression='';
  const visit=(node:ts.Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='dbInsert')expression=node.initializer!.getText(ast);ts.forEachChild(node,visit);};visit(ast);
  const js=ts.transpileModule('const save='+expression,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const id=crypto.randomUUID();let attempts=0;let updating=false;let lastValues:unknown;
  const query={insert(){attempts++;return this;},select(){return this;},eq(){return this;},
    update(values:unknown){updating=true;lastValues=values;return this;},
    async single(){return updating?{data:{id,user_id:owner},error:null}:{error:insertError};},
    async maybeSingle(){return {data:{id,user_id:owner,notes:'original'},error:null};}};
  const supabase={auth:{getSession:async()=>({data:{session:{user:{id:owner}}}})},from:()=>query};
  const save=new Function('supabase','cleanPayload','useCallback',js+';return save;')(supabase,(p:unknown)=>p,(callback:unknown)=>callback);
  assert.equal((await save({id,user_id:owner,notes:'newer queued edit'})).id,id);
  assert.deepEqual(lastValues,{notes:'newer queued edit'});
  assert.equal(attempts,1);
});

