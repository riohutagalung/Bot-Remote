import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDeviceStore} from '../device-store.js';
import crypt from '../backup-crypto.cjs';
import sync from '../github-state.cjs';

function folder(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bot-store-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('registered laptops and edited names survive reopening the store',t=>{
 const file=path.join(folder(t),'devices.json'),store=createDeviceStore(file);
 store.save({pc_a:{id:'pc_a',serial:'pc_a',name:'Laptop kerja'},pc_b:{id:'pc_b',serial:'pc_b',name:'Laptop rumah'}});
 const reopened=createDeviceStore(file).load();assert.equal(reopened.pc_a.name,'Laptop kerja');assert.equal(reopened.pc_b.serial,'pc_b');assert.equal(Object.keys(reopened).length,2);
});
test('corrupt primary data recovers a valid backup and never silently resets corrupt files',t=>{
 const file=path.join(folder(t),'devices.json'),store=createDeviceStore(file);
 store.save({pc_a:{id:'pc_a'}});store.save({pc_a:{id:'pc_a'},pc_b:{id:'pc_b'}});
 fs.writeFileSync(file,'broken');assert.equal(Object.keys(store.load()).length,1);assert.equal(store.source,'backup');
 fs.writeFileSync(file+'.bak','also broken');assert.throws(()=>store.load(),/File asli dipertahankan/);assert.equal(fs.readFileSync(file,'utf8'),'broken');
});
test('public backups are authenticated ciphertext, require the owner key, and detect tampering',()=>{
 const data={pc_a:{id:'pc_a',ip:'192.0.2.10',mac:'00:11:22:33:44:55',name:'Private laptop'}},secret='owner-secret-'.repeat(4);
 const backup=crypt.encryptDevices(data,secret);assert.deepEqual(crypt.decryptDevices(backup,secret),data);
 assert.equal(JSON.stringify(backup).includes('192.0.2.10'),false);assert.equal(JSON.stringify(backup).includes('Private laptop'),false);
 assert.throws(()=>crypt.decryptDevices(backup,'different-owner-secret-'.repeat(3)));
 const changed={...backup,tag:Buffer.alloc(16).toString('base64')};assert.throws(()=>crypt.decryptDevices(changed,secret));
});
test('GitHub recovery adds missing laptops without removing newer local records',async t=>{
 const root=folder(t),file=path.join(root,'devices.json'),store=createDeviceStore(file),secret='owner-secret-'.repeat(4);
 store.save({pc_a:{id:'pc_a',name:'New local name'}});
 const encrypted=crypt.encryptDevices({pc_a:{id:'pc_a',name:'Old name'},pc_b:{id:'pc_b',name:'Other laptop'}},secret);
 const client=sync.createGitHubStateSync({root,dataFile:file,agentToken:secret,fetcher:async()=>new Response(JSON.stringify(encrypted))});
 assert.equal(await client.restoreIfNeeded(store),true);assert.equal(store.load().pc_a.name,'New local name');assert.equal(store.load().pc_b.name,'Other laptop');
});
test('GitHub sync never replaces an encrypted backup belonging to another owner',async t=>{
 const root=folder(t),file=path.join(root,'devices.json'),secret='owner-secret-'.repeat(4),cache=path.join(root,'.github-state');
 createDeviceStore(file).save({pc_a:{id:'pc_a'}});fs.writeFileSync(path.join(root,'Backend-URL.txt'),'https://example.trycloudflare.com');
 fs.mkdirSync(path.join(root,'.secrets'));fs.writeFileSync(path.join(root,'.secrets','github-state-ed25519'),'test-only-placeholder');fs.writeFileSync(path.join(root,'.secrets','github_known_hosts'),'test-only-placeholder');
 fs.mkdirSync(path.join(cache,'.git'),{recursive:true});
 const encrypted=JSON.stringify(crypt.encryptDevices({other:{id:'other'}},'other-owner-secret-'.repeat(3)));
 fs.writeFileSync(path.join(cache,'devices.enc.json'),encrypted);
 let pushed=false;
 const client=sync.createGitHubStateSync({root,dataFile:file,agentToken:secret,run:async(exe,args)=>{if(args[0]==='push')pushed=true;return {stdout:args[0]==='remote'?'git@github.com:riohutagalung/Bot-Remote.git\n':''};}});
 assert.equal(await client.flush(),false);assert.equal(pushed,false);assert.equal(fs.readFileSync(path.join(cache,'devices.enc.json'),'utf8'),encrypted);
});
