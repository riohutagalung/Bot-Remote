import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import identity from '../device-identity.cjs';
test('different laptops register separately and preserve identity after restart',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rh-id-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const a=path.join(root,'a'),b=path.join(root,'b');fs.mkdirSync(a);fs.mkdirSync(b);
 const first=identity.getDeviceId({root:a});assert.equal(identity.getDeviceId({root:a}),first);assert.notEqual(identity.getDeviceId({root:b}),first);
 assert.equal(identity.getDeviceId({root:a,configured:'Existing-Laptop'}),'Existing-Laptop');
 fs.writeFileSync(path.join(a,'device-identity.json'),'broken');assert.throws(()=>identity.getDeviceId({root:a}));
 assert.throws(()=>identity.getDeviceId({root:b,configured:'../other'}));
});
