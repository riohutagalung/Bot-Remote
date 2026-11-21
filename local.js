// One process on the controlled laptop: dashboard backend + local agent.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {createRequire} from 'node:module';

const root = path.dirname(fileURLToPath(import.meta.url));
if (!fs.existsSync(path.join(root, 'dist/index.html'))) {
  throw new Error('Dashboard belum dibangun. Jalankan Setup.ps1 terlebih dahulu.');
}
process.env.HOST = '127.0.0.1';
process.env.BOT_REMOTE_LOCAL_RUNTIME = '1';
process.env.SERVER_URL = `ws://127.0.0.1:${process.env.PORT || 8080}`;
const python = path.join(root,'.venv','Scripts','python.exe');
if (!process.env.PYTHON_BIN && fs.existsSync(python)) process.env.PYTHON_BIN = python;
const {server} = await import('./server.js');
if (!server.listening) await once(server, 'listening');
createRequire(import.meta.url)('./client.cjs');
console.log('MODE LAPTOP MANDIRI — Railway tidak diperlukan');
console.log(`Dashboard lokal: http://127.0.0.1:${process.env.PORT || 8080}`);
console.log('Akses jarak jauh: gunakan alamat dalam Backend-URL.txt setelah launcher membuat tunnel.');
console.log('Ctrl+C menutup server dan agent sekaligus.');
