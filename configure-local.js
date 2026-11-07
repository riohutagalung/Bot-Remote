import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export function configureLocal(directory = root) {
const config = path.join(directory,'.env');
const settings = `# Rahasia lokal. Jangan unggah atau kirim file ini.\nDASHBOARD_PASSWORD=${crypto.randomBytes(18).toString('hex')}\nAGENT_TOKEN=${crypto.randomBytes(32).toString('hex')}\nPORT=8080\nHOST=127.0.0.1\nDEVICE_ID=${os.hostname().replace(/[^\w-]/g,'_').slice(0,128)}\nALLOW_DESKTOP_CONTROL=1\nOPENAI_API_KEY=\nOPENAI_MODEL=\n`;
try {
  fs.writeFileSync(config,settings,{flag:'wx',mode:0o600});
  console.log('Konfigurasi dibuat. Buka .env untuk melihat password dashboard.');
} catch(e) {
  if(e.code !== 'EEXIST') throw e;
  console.log('.env sudah ada; konfigurasi lama dipertahankan.');
}
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) configureLocal();
