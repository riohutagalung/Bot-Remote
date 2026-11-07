const { spawn } = require('node:child_process');
const path = require('node:path');

exports.desktopAction = action => new Promise((resolve, reject) => {
  if (process.env.ALLOW_DESKTOP_CONTROL !== '1') return reject(new Error('Kontrol desktop belum diizinkan pada laptop'));
  console.log('[DESKTOP]', action?.type, '(Ctrl+C untuk memutus akses)');
  const child = spawn(process.env.PYTHON_BIN || 'python', [path.join(__dirname, 'desktop_driver.py')], {stdio:['pipe','pipe','pipe'], windowsHide:true});
  let output = '', error = '';
  const timer = setTimeout(() => { child.kill(); reject(new Error('Desktop driver timeout')); }, 15000);
  child.stdout.on('data', data => { output += data; if (output.length > 7*1024*1024) child.kill(); });
  child.stderr.on('data', data => { error = (error + data).slice(-2000); });
  child.on('error', err => {clearTimeout(timer); reject(err);});
  child.on('close', code => {
    clearTimeout(timer);
    if (code !== 0) return reject(new Error(error || 'Driver gagal; install requirements-desktop.txt'));
    try { resolve(JSON.parse(output)); } catch { reject(new Error('Output desktop tidak valid')); }
  });
  child.stdin.on('error', () => {});
  child.stdin.end(JSON.stringify(action));
});
