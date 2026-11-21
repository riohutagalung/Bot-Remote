const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {promisify}=require('node:util');const {execFile}=require('node:child_process');const run=promisify(execFile);
async function main(){
 const root=__dirname,folder=path.join(root,'.secrets');fs.mkdirSync(folder,{recursive:true,mode:0o700});
 const key=path.join(folder,'github-state-ed25519');
 if(!fs.existsSync(key))await run('ssh-keygen',['-t','ed25519','-N','','-C','Bot-Remote connection-state sync','-f',key],{windowsHide:true,timeout:15000});
 const response=await fetch('https://api.github.com/meta',{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Identitas SSH resmi GitHub tidak dapat diunduh');
 const meta=await response.json();const hostKey=meta.ssh_keys?.find(k=>k.startsWith('ssh-ed25519 '));
 if(!hostKey)throw Error('Kunci host SSH GitHub tidak ditemukan');
 const fingerprint=crypto.createHash('sha256').update(Buffer.from(hostKey.split(' ')[1],'base64')).digest('base64').replace(/=+$/,'');
 if(meta.ssh_key_fingerprints?.SHA256_ED25519 && meta.ssh_key_fingerprints.SHA256_ED25519.replace(/^SHA256:/,'')!==fingerprint)throw Error('Identitas SSH GitHub tidak cocok');
 fs.writeFileSync(path.join(folder,'github_known_hosts'),'[ssh.github.com]:443 '+hostKey+'\n',{mode:0o600});
 if(process.platform==='win32'){
  const {stdout}=await run('whoami',['/user','/fo','csv','/nh'],{windowsHide:true,timeout:5000});
  const sid=stdout.match(/S-1-5-[0-9-]+/)?.[0];if(!sid)throw Error('Identitas pengguna Windows tidak ditemukan');
  await run('icacls',[key,'/inheritance:r','/grant:r','*'+sid+':(F)','*S-1-5-18:(F)'],{windowsHide:true,timeout:5000});
 }
 const publicKey=fs.readFileSync(key+'.pub','utf8').trim();
 fs.writeFileSync(path.join(root,'GitHub-Sync-Key.pub'),publicKey+'\n');
 console.log('Public deploy key siap: GitHub-Sync-Key.pub. Private key tidak ditampilkan dan tidak diunggah.');
 console.log('Repositori: riohutagalung/Bot-Remote. Cabang data: connection-state.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
