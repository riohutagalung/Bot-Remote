const fs=require('node:fs');
const path=require('node:path');
const {promisify}=require('node:util');
const {execFile}=require('node:child_process');
const {encryptDevices,decryptDevices}=require('./backup-crypto.cjs');
const runNative=promisify(execFile);
const REPO='riohutagalung/Bot-Remote',BRANCH='connection-state';
const RAW_ROOT=`https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
const validData=data=>data&&typeof data==='object'&&!Array.isArray(data)&&Object.entries(data).every(([id,value])=>/^[a-zA-Z0-9_-]{1,128}$/.test(id)&&value&&typeof value==='object'&&!Array.isArray(value));
// Only durable registry fields enter the backup. Heartbeat timestamps and live
// process status must not generate a repository commit every few seconds.
function durableRecords(devices){
 const fields=['id','serial','name','hostname','model','wifi','ip','mac'];
 return Object.fromEntries(Object.entries(devices).sort(([a],[b])=>a.localeCompare(b)).map(([id,record])=>[id,Object.fromEntries(fields.filter(field=>typeof record[field]==='string').map(field=>[field,record[field]]))]));
}
function normalizeConnection(value){
 const url=new URL(value.trim());
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Alamat koneksi GitHub harus berupa origin HTTPS');
 return url.origin;
}
function createGitHubStateSync({root,dataFile,agentToken,fetcher=fetch,run=runNative}){
 const cache=path.join(root,'.github-state');
 const key=path.join(root,'.secrets','github-state-ed25519');
 const knownHosts=path.join(root,'.secrets','github_known_hosts');
 const statusFile=path.join(root,'GitHub-Sync-Status.json');
 const state={configured:false,lastSuccessAt:null,error:'',status:'starting'};
 let timer=null,busy=false,lastAttempt=0,lastPayload='';
 const ssh=process.env.BOT_REMOTE_SSH || 'C:/Windows/System32/OpenSSH/ssh.exe';
 const sshCommand=[quote(ssh),'-i',quote(key.replaceAll('\\','/')),'-p','443','-o','HostName=ssh.github.com','-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10','-o',quote('UserKnownHostsFile='+knownHosts.replaceAll('\\','/'))].join(' ');
 function report(status,error=''){
  state.status=status;state.error=error;state.configured=fs.existsSync(key)&&fs.existsSync(knownHosts);
  fs.writeFileSync(statusFile,JSON.stringify(state,null,2)+'\n',{mode:0o600});
 }
 async function git(args){
  try{return (await run('git',args,{cwd:cache,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_SSH_COMMAND:sshCommand},windowsHide:true,timeout:20000,maxBuffer:1024*1024})).stdout;}
  catch(error){
   if(/permission denied|could not read from remote|publickey/i.test(String(error.stderr || error.message)))throw Error('Kunci sinkronisasi belum mendapat izin tulis di GitHub Bot-Remote.');
   throw Error('Sinkronisasi GitHub gagal. Periksa koneksi internet dan izin deploy key repositori.');
  }
 }
 async function readRemote(name){
  const response=await fetcher(RAW_ROOT+'/'+name+'?v='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(response.status===404)return null;
  if(!response.ok)throw Error('Cadangan GitHub belum dapat diunduh');
  const text=await response.text();if(text.length>5*1024*1024)throw Error('Cadangan melebihi batas ukuran');
  return JSON.parse(text);
 }
 async function restoreIfNeeded(store){
  let localError,local=Object.create(null);
  try{local=store.load();}catch(error){localError=error;}
  try{
   const encrypted=await readRemote('devices.enc.json');if(!encrypted){if(localError)throw localError;return false;}
   const devices=decryptDevices(encrypted,agentToken);if(!validData(devices))throw Error('Cadangan perangkat tidak valid');
   const merged=store.source==='backup' ? {...local,...devices} : {...devices,...local};
   if(Object.keys(merged).length && JSON.stringify(merged)!==JSON.stringify(local)){store.save(merged);console.log('[GitHub] Data perangkat dipulihkan dari cadangan terenkripsi.');return true;}
  }catch(error){
   if(localError)throw localError;
   console.log('[GitHub] Cadangan belum dipulihkan:',error.message);
  }
  return false;
 }
 async function flush(){
  if(busy)return false;
  busy=true;
  try{
   if(!fs.existsSync(key)||!fs.existsSync(knownHosts)){report('needs_setup','Tambahkan deploy key publik ke repositori Bot-Remote agar alamat dan cadangan dapat diperbarui otomatis.');return false;}
   const urlFile=path.join(root,'Backend-URL.txt');
   if(!fs.existsSync(urlFile)||!fs.existsSync(dataFile)){report('waiting','Menunggu tunnel dan data perangkat.');return false;}
   const backendUrl=normalizeConnection(fs.readFileSync(urlFile,'utf8'));
   const localDevices=JSON.parse(fs.readFileSync(dataFile,'utf8'));if(!validData(localDevices))throw Error('Data lokal tidak valid; cadangan tidak ditimpa.');
   const devices=durableRecords(localDevices);
   const payload=JSON.stringify({backendUrl,devices});
   if(payload===lastPayload && state.lastSuccessAt)return true;
   if(Date.now()-lastAttempt<30000)return false;
   lastAttempt=Date.now();report('syncing');
   fs.mkdirSync(cache,{recursive:true});
   if(!fs.existsSync(path.join(cache,'.git'))){
    await git(['init']);await git(['remote','add','origin','git@github.com:'+REPO+'.git']);
    await git(['config','user.name','Bot-Remote state sync']);await git(['config','user.email','bot-remote@users.noreply.github.com']);
   }
   if((await git(['remote','get-url','origin'])).trim()!=='git@github.com:'+REPO+'.git')throw Error('Remote cache GitHub tidak sesuai repositori aplikasi.');
   await git(['fetch','--depth=1','origin',BRANCH]);
   // This is an application-owned data cache, never the user's source checkout.
   await git(['reset','--hard','FETCH_HEAD']);await git(['checkout','-B',BRANCH,'FETCH_HEAD']);
   const connectionPath=path.join(cache,'connection.json');
   let currentConnection;
   try{currentConnection=JSON.parse(fs.readFileSync(connectionPath,'utf8'));}catch{}
   if(currentConnection?.backendUrl!==backendUrl)fs.writeFileSync(connectionPath,JSON.stringify({version:1,backendUrl,updatedAt:new Date().toISOString()},null,2)+'\n');
   const backupPath=path.join(cache,'devices.enc.json');let sameBackup=false,backupDevices=devices;
   if(fs.existsSync(backupPath)){
    let previous;
    try{previous=decryptDevices(JSON.parse(fs.readFileSync(backupPath,'utf8')),agentToken);}catch{throw Error('Kunci cadangan tidak cocok. Cadangan lama di GitHub dipertahankan.');}
    backupDevices=durableRecords({...previous,...devices});
    sameBackup=JSON.stringify(previous)===JSON.stringify(backupDevices);
   }
   if(!sameBackup)fs.writeFileSync(backupPath,JSON.stringify(encryptDevices(backupDevices,agentToken),null,2)+'\n');
   fs.writeFileSync(path.join(cache,'vercel.json'),JSON.stringify({git:{deploymentEnabled:false}},null,2)+'\n');
   await git(['add','--','connection.json','devices.enc.json','vercel.json']);
   if((await git(['diff','--cached','--name-only'])).trim()){
    await git(['commit','-m','Update connection and encrypted device backup']);
    await git(['push','origin','HEAD:refs/heads/'+BRANCH]);
   }
   lastPayload=payload;state.lastSuccessAt=new Date().toISOString();report('synced');
   console.log('[GitHub] Koneksi dan cadangan perangkat tersinkron.');return true;
  }catch(error){report('error',error.message);console.log('[GitHub]',error.message);return false;}
  finally{busy=false;}
 }
 return {restoreIfNeeded,flush,snapshot:()=>({...state}),start(){if(timer)return;report('starting');flush();timer=setInterval(flush,5000);timer.unref();},stop(){if(timer)clearInterval(timer);timer=null;}};
}
module.exports={createGitHubStateSync,normalizeConnection,REPO,BRANCH,RAW_ROOT};
