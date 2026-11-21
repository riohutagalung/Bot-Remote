import {test} from 'node:test';
import assert from 'node:assert/strict';
import control from '../system-control.cjs';

test('reject disabled, unsupported and arbitrary system actions before running anything',async()=>{
  const run=async()=>{throw Error('must not execute');};
  await assert.rejects(control.createSystemControl({run,enabled:()=>false,platform:'win32'}).execute('shutdown'),/belum diizinkan/);
  await assert.rejects(control.createSystemControl({run,enabled:()=>true,platform:'linux'}).execute('shutdown'),/Windows/);
  await assert.rejects(control.createSystemControl({run,enabled:()=>true,platform:'win32'}).execute('shutdown /f'),/tidak valid/);
});
test('shutdown acknowledges a cancellable timer before any OS command; never uses forced termination',async()=>{
  let callback,delay,cleared=false,calls=[];
  const options={enabled:()=>true,platform:'win32',run:async(exe,args)=>{calls.push({exe,args});return {stdout:''};},schedule:(fn,ms)=>{callback=fn;delay=ms;return 'timer';},cancel:id=>{assert.equal(id,'timer');cleared=true;}};
  const agent=control.createSystemControl(options);
  const result=await agent.execute('shutdown');
  assert.equal(result.status,'scheduled');assert.equal(delay,10000);assert.equal(calls.length,0);
  assert.deepEqual(await agent.execute('shutdown'),result);
  assert.equal((await agent.execute('cancel_shutdown')).status,'cancelled');assert.equal(cleared,true);assert.equal(calls.length,0);
  await agent.execute('shutdown');await callback();
  assert.equal(calls.length,1);assert.match(calls[0].exe,/shutdown\.exe$/);assert.deepEqual(calls[0].args,['/s','/t','0']);
});
test('close requests use the bounded local script and preserve application save prompts',async()=>{
  const agent=control.createSystemControl({enabled:()=>true,platform:'win32',run:async(exe,args)=>{
    assert.match(exe,/powershell\.exe$/);assert.equal(args.includes('-File'),true);assert.match(args.at(-1),/close-windows\.ps1$/);
    return {stdout:'{"requested":3,"skipped":2,"failed":1}'};
  }});
  assert.deepEqual(await agent.execute('close_windows'),{status:'close_requested',requested:3,skipped:2,failed:1});
});
test('an OS shutdown failure is retained for the dashboard',async()=>{
  let callback;
  const agent=control.createSystemControl({enabled:()=>true,platform:'win32',schedule:fn=>{callback=fn;return 1;},run:async()=>{throw Error('Access denied');}});
  await agent.execute('shutdown');await callback();
  assert.equal(agent.snapshot().shutdownError,'Access denied');assert.equal(agent.snapshot().shutdownAt,0);
});
