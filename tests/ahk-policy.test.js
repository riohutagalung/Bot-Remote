import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import policy from '../ahk-policy.cjs';

test('stop once allows a manual restart; blocking survives restart until explicitly disabled', async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ahk-policy-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  let running=true, stops=0;
  const options={file:path.join(dir,'policy.json'),readAhk:async()=>running,stopAhk:async()=>{stops++;running=false;}};
  let agent=policy.createAhkPolicy(options);
  assert.equal((await agent.refresh()).ahkEnabled,true);
  await agent.command('stop_ahk');
  running=true;
  assert.equal((await agent.refresh()).ahkEnabled,true);
  await agent.command('block_ahk');
  for(let i=0;i<3;i++){running=true;assert.equal((await agent.refresh()).ahkEnabled,false);}
  agent=policy.createAhkPolicy(options);
  running=true;
  assert.equal((await agent.refresh()).ahkBlocked,true);
  assert.equal(running,false);
  await agent.command('unblock_ahk');
  running=true;
  assert.equal((await agent.refresh()).ahkEnabled,true);
  assert.equal(stops,6);
  await assert.rejects(agent.command('start_ahk'));
});
test('access failure keeps block enabled and does not report successful termination',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ahk-error-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const agent=policy.createAhkPolicy({file:path.join(dir,'policy.json'),readAhk:async()=>true,stopAhk:async()=>{throw Error('Access denied');}});
  await assert.rejects(agent.command('block_ahk'),/Access denied/);
  assert.deepEqual(agent.snapshot(),{ahkEnabled:true,ahkKnown:true,ahkError:'Access denied',ahkBlocked:true,ahkPolicySupported:true});
  await agent.command('unblock_ahk');
  assert.equal(agent.snapshot().ahkError,'');
});
test('slow Windows checks coalesce polls and do not starve the unblock command',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ahk-polls-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  let reads=0, release;
  const gate=new Promise(resolve=>{release=resolve;});
  const agent=policy.createAhkPolicy({file:path.join(dir,'policy.json'),readAhk:async()=>{reads++;if(reads===1)await gate;return false;},stopAhk:async()=>{}});
  const first=agent.refresh();
  for(let i=0;i<100;i++)assert.equal(agent.refresh(),first);
  const command=agent.command('unblock_ahk');
  release();
  await command;
  assert.equal(reads,2,'one poll plus the command inspection, without 100 queued polls');
});
test('concurrent system telemetry only sees the last completed AHK inspection',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ahk-atomic-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  let readCount=0,release;
  const gate=new Promise(resolve=>{release=resolve;});
  const agent=policy.createAhkPolicy({file:path.join(dir,'policy.json'),readAhk:async()=>{if(++readCount===2)await gate;return false;},stopAhk:async()=>{}});
  await agent.refresh();assert.equal(agent.snapshot().ahkKnown,true);
  const pending=agent.refresh();await Promise.resolve();
  assert.equal(agent.snapshot().ahkKnown,true,'system telemetry must not publish an in-progress unknown status');
  release();await pending;assert.equal(agent.snapshot().ahkKnown,true);
});
