const fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os');
const {getDeviceId}=require('./device-identity.cjs');
const {createAhkPolicy}=require('./ahk-policy.cjs');
const {createSystemControl}=require('./system-control.cjs');
const {readAhk,stopAhk}=require('./ahk-process.cjs');
const root=__dirname;
const base='https://rbdnigqlshglabhvwfvj.supabase.co/functions/v1/remote';
const id=getDeviceId({root,configured:process.env.DEVICE_ID});
const credentialsFile=path.join(root,'central-agent.json');
let credentials;
if(fs.existsSync(credentialsFile))credentials=JSON.parse(fs.readFileSync(credentialsFile,'utf8'));
else{credentials={version:1,id,token:crypto.randomBytes(32).toString('hex'),registered:false};fs.writeFileSync(credentialsFile,JSON.stringify(credentials),{flag:'wx',mode:0o600});}
if(credentials.id!==id||!credentials.token)throw Error('Identitas agent tidak cocok. Konfigurasi lama dipertahankan.');
const enrollmentFile=path.join(root,'enrollment.key');
const journalFile=path.join(root,'central-results.json');
let results=fs.existsSync(journalFile)?JSON.parse(fs.readFileSync(journalFile,'utf8')):[];
if(!Array.isArray(results))throw Error('Jurnal perintah rusak; hentikan untuk mencegah pengulangan.');
function saveResults(){const temp=journalFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(results));fs.renameSync(temp,journalFile);}
const ahk=createAhkPolicy({readAhk,stopAhk,file:path.join(root,'ahk-policy.json')});
const system=createSystemControl();
async function request(route,body,token){const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const value=await response.json();if(!response.ok)throw Error(value.error||'HTTP '+response.status);return value;}
async function run(){
 await system.inspectPermissions();await ahk.refresh();
 if(!credentials.registered){if(!fs.existsSync(enrollmentFile))throw Error('Kunci pemasangan belum tersedia.');await request('/api/agent/register',{id,name:os.hostname(),deviceToken:credentials.token},fs.readFileSync(enrollmentFile,'utf8').trim());credentials.registered=true;fs.writeFileSync(credentialsFile,JSON.stringify(credentials));fs.unlinkSync(enrollmentFile);}
 console.log('RH Remote Agent aktif dan terlihat. ID:',id,'— Ctrl+C untuk berhenti.');
 const enforcement=setInterval(async()=>{try{const flag=path.join(root,'Unblock-AHK.flag');if(fs.existsSync(flag)){await ahk.command('unblock_ahk');fs.unlinkSync(flag);}await ahk.refresh();}catch(e){console.log('AHK:',e.message);}},2000);
 async function poll(){
  try{
   const sent=[...results];
   const response=await request('/api/agent/poll',{id,info:{hostname:os.hostname(),model:os.platform()+' '+os.arch(),...ahk.snapshot(),systemEnabled:process.env.ALLOW_SYSTEM_CONTROL==='1',...system.snapshot()},results:sent},credentials.token);
   results=results.filter(r=>!sent.some(s=>s.id===r.id));saveResults();
   for(const command of response.commands){
    if(results.some(r=>r.id===command.id))continue;
    // Journal before execution: an interrupted command is never automatically repeated.
    const record={id:command.id,error:'Agent berhenti sebelum hasil terkonfirmasi. Periksa perangkat sebelum mengulang.'};results.push(record);saveResults();
    try{if(Date.parse(command.expiresAt)<=Date.now())throw Error('Perintah kedaluwarsa');console.log('Perintah:',command.action);const value=['stop_ahk','block_ahk','unblock_ahk'].includes(command.action)?await ahk.command(command.action):await system.execute(command.action);record.result=value;delete record.error;}catch(e){record.error=e.message;}saveResults();
   }
   fs.writeFileSync(path.join(root,'Central-Status.json'),JSON.stringify({id,online:true,checkedAt:new Date().toISOString()}));
   setTimeout(poll,response.commands.length||results.length||system.snapshot().shutdownAt?1000:30000);
  }catch(e){console.log('Koneksi pusat:',e.message,'— mencoba lagi dalam 30 detik.');fs.writeFileSync(path.join(root,'Central-Status.json'),JSON.stringify({id,online:false,error:e.message,checkedAt:new Date().toISOString()}));setTimeout(poll,30000);}
 }
 poll();process.on('SIGINT',()=>{clearInterval(enforcement);process.exit(0);});
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
