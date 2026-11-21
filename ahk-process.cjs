const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const run = promisify(execFile);
const filter = "Get-Process | Where-Object { $_.ProcessName -match '^AutoHotkey(?:[0-9A-Za-z_-]*| Unicode (?:32|64)-bit)$' }";
async function powershell(script) {
  try {
    const {stdout} = await run('powershell.exe', ['-NoProfile','-NonInteractive','-Command', "$ErrorActionPreference='Stop'; " + script], {windowsHide:true, timeout:10000});
    return stdout.trim();
  } catch(error) {
    const detail = String(error.stderr || error.message || '').replace(/\s+/g, ' ').trim().slice(0,500);
    throw new Error(`Operasi proses Windows gagal (${error.code || 'error'}): ${detail}`);
  }
}
exports.readAhk = async () => {
  const text = await powershell(`@(${filter} | Select-Object -ExpandProperty Id) | ConvertTo-Json -Compress`);
  const ids = text ? JSON.parse(text) : [];
  const processes = Array.isArray(ids) ? ids : [ids];
  return processes.length > 0;
};
exports.stopAhk = async () => {
  await powershell(`${filter} | Stop-Process -Force -ErrorAction Stop`);
  const running = await exports.readAhk();
  if (running) throw new Error('AutoHotkey masih aktif. Periksa apakah ada program lain yang menjalankannya kembali.');
  return false;
};
