import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import {validateAction} from '../desktop-server.js';
import {configureLocal} from '../configure-local.js';

test('local setup generates unique credentials and preserves an existing configuration', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'bot-remote-config-'));
  try {
    configureLocal(dir);
    const first = await readFile(path.join(dir,'.env'),'utf8');
    assert.match(first,/DASHBOARD_PASSWORD=[a-f0-9]{36}/);
    assert.match(first,/AGENT_TOKEN=[a-f0-9]{64}/);
    assert.match(first,/HOST=127.0.0.1/);
    configureLocal(dir);
    assert.equal(await readFile(path.join(dir,'.env'),'utf8'),first);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('action validation rejects shell, traversal and malformed inputs', () => {
  for (const a of [{type:'shell',command:'whoami'}, {type:'click',x:-1,y:0}, {type:'key',key:'win'}, {type:'type',text:'a'.repeat(2001)}, {type:'scroll',amount:11}]) assert.throws(()=>validateAction(a));
  assert.deepEqual(validateAction({type:'click',x:12,y:34,command:'ignored'}), {type:'click',x:12,y:34});
});

test('authenticated dashboard → server → agent → result and disconnect', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'bot-remote-test-'));
  const password = 'test-password-123456';
  const agentToken = 'test-agent-secret-'.repeat(3);
  const port = 21000 + Math.floor(Math.random()*10000);
  Object.assign(process.env,{PORT:String(port),DATA_FILE:path.join(dir,'devices.json'),DASHBOARD_PASSWORD:password,AGENT_TOKEN:agentToken,OPENAI_API_KEY:'mock-test-key',OPENAI_MODEL:'mock-model'});
  const {server, wss} = await import('../server.js');
  const sockets = [];
  t.after(async()=>{ sockets.forEach(ws=>ws.terminate()); wss.clients.forEach(ws=>ws.terminate()); await new Promise(resolve=>wss.close(resolve)); await new Promise(resolve=>server.close(resolve)); await rm(dir,{recursive:true,force:true}); });
  if (!server.listening) await once(server,'listening');
  const base = `http://127.0.0.1:${port}`;
  const request = (route,body,token,method='POST')=>fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await request('/api/devices',null,null,'GET')).status,401);
  assert.equal((await request('/api/command',{deviceId:'test',command:'start_ahk'})).status,401);
  assert.equal((await request('/api/login',{password:'wrong'})).status,401);
  const {token} = await (await request('/api/login',{password})).json();
  assert.ok(token);
  const bad = new WebSocket(base.replace('http','ws')); sockets.push(bad); await once(bad,'open'); bad.send(JSON.stringify({id:'intruder'}));
  const [code] = await once(bad,'close'); assert.equal(code,1008);
  const agent = new WebSocket(base.replace('http','ws')); sockets.push(agent); await once(agent,'open');
  agent.on('message', raw=>{
    const data=JSON.parse(raw);
    if(data.type==='execute_command') agent.send(JSON.stringify({type:'command_result',requestId:data.requestId,ahkEnabled:data.action==='start_ahk'}));
    if(data.type==='desktop_command') agent.send(JSON.stringify({type:'desktop_result',requestId:data.requestId,result:{image:'data:image/jpeg;base64,TEST',width:1920,height:1080}}));
  });
  agent.send(JSON.stringify({type:'agent_auth',token:agentToken,id:'test',hostname:'Test Laptop',desktopEnabled:true}));
  const dash = new WebSocket(base.replace('http','ws')); sockets.push(dash); await once(dash,'open');
  const list = once(dash,'message'); dash.send(JSON.stringify({type:'dashboard_auth',token})); await list;
  assert.equal((await request('/api/command',{deviceId:'test',command:'shell'},token)).status,400);
  const stopped = await (await request('/api/command',{deviceId:'test',command:'stop_ahk'},token)).json();
  assert.deepEqual(stopped,{success:true,ahkEnabled:false});
  const result = await (await request('/api/desktop/test/action',{type:'screenshot'},token)).json();
  assert.equal(result.width,1920);
  assert.equal((await request('/api/desktop/test/action',{type:'click',x:-1,y:0},token)).status,400);
  assert.equal((await request('/api/desktop/test/approve',{proposalId:'fake'},token)).status,400);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => String(url) === 'https://api.openai.com/v1/responses'
    ? Promise.resolve(Response.json({output:[{type:'function_call',name:'desktop_action',arguments:JSON.stringify({type:'key',key:'tab',x:null,y:null,text:null,amount:null})}]}))
    : originalFetch(url, options);
  t.after(()=>{globalThis.fetch=originalFetch;});
  const plan = await (await request('/api/desktop/test/plan',{task:'Pindah kolom'},token)).json();
  assert.deepEqual(plan.action,{type:'key',key:'tab'});
  const otherSession = await (await request('/api/login',{password})).json();
  assert.equal((await request('/api/desktop/test/approve',{proposalId:plan.proposalId},otherSession.token)).status,400);
  assert.equal((await request('/api/desktop/test/approve',{proposalId:plan.proposalId},token)).status,200);
  assert.equal((await request('/api/desktop/test/approve',{proposalId:plan.proposalId},token)).status,400);

  // Replacing a connection must not remove the replacement when the old socket closes.
  const replacement = new WebSocket(base.replace('http','ws')); sockets.push(replacement); await once(replacement,'open');
  const oldClosed = once(agent,'close'); replacement.send(JSON.stringify({type:'agent_auth',token:agentToken,id:'test',desktopEnabled:true})); await oldClosed;
  const devices = await (await request('/api/devices',null,token,'GET')).json(); assert.equal(devices.devices[0].status,'Online');
  const dashboardClosed=once(dash,'close'); await request('/api/logout',{},token); await dashboardClosed;
  assert.equal((await request('/api/devices',null,token,'GET')).status,401);
});
