const enc=new TextEncoder();
export const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:210000,hash:'SHA-256'},key,256))).map(x=>x.toString(16).padStart(2,'0')).join('');}
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;};
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(id);
const telemetryKeys=['hostname','model','wifi','ip','mac','ahkEnabled','ahkKnown','ahkError','ahkBlocked','ahkPolicySupported','systemEnabled','shutdownAllowed','shutdownPermissionKnown','shutdownPermissionError','shutdownError','shutdownAt'];
export function createHandler({db,origin='https://rhremote.vercel.app'}){
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Cache-Control':'no-store'};
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 const error=(message,status)=>Object.assign(new Error(message),{status});
 const first=async q=>(await db(q))[0];
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  try{
   const url=new URL(req.url),route=url.pathname.slice(url.pathname.indexOf('/api/'));
   if(route==='/api/health')return json({service:'bot-remote-central',version:1,transport:'poll',pollSeconds:30});
   let body={};if(['POST','PUT'].includes(req.method)){const raw=await req.text();if(raw.length>24000)throw error('Permintaan terlalu besar',413);try{body=JSON.parse(raw||'{}');}catch{throw error('JSON tidak valid',400);}}
   const bearer=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
   if(route==='/api/login'&&req.method==='POST'){
    const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
    if(!await db('rpc/rh_login_attempt','POST',{p_key:await hash(ip)}))throw error('Terlalu banyak percobaan. Tunggu satu menit.',429);
    const conf=(await first('rh_settings?id=eq.auth'))?.value;
    if(!conf)throw error('Akun belum dikonfigurasi',503);
    if(typeof body.password!=='string'||body.password.length>256||body.username!==conf.username||!equal(await passwordHash(body.password,conf.salt),conf.passwordHash))throw error('Username atau password ditolak',401);
    const token=crypto.randomUUID()+crypto.randomUUID();
    await db('rh_sessions','POST',{token_hash:await hash(token),expires_at:new Date(Date.now()+8*3600000).toISOString()});return json({success:true,token});
   }
   if(route==='/api/agent/register'&&req.method==='POST'){
    const conf=(await first('rh_settings?id=eq.auth'))?.value;
    const registrationSession=bearer&&await first('rh_sessions?token_hash=eq.'+await hash(bearer)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString()));
    if(!conf||(!registrationSession&&!equal(await hash(bearer),conf.enrollmentHash)))throw error('Login pemasangan ditolak',401);
    if(!validId(body.id)||typeof body.deviceToken!=='string'||body.deviceToken.length<48||body.deviceToken.length>256)throw error('Identitas perangkat tidak valid',400);
    const existing=await first('rh_devices?id=eq.'+body.id),tokenHash=await hash(body.deviceToken);
    if(existing&&!equal(existing.token_hash,tokenHash))throw error('Identitas sudah terdaftar dengan kunci berbeda',409);
    if(!existing)await db('rh_devices','POST',{id:body.id,token_hash:tokenHash,name:String(body.name||body.id).slice(0,128)});
    return json({success:true,id:body.id});
   }
   if(route==='/api/agent/poll'&&req.method==='POST'){
    if(!validId(body.id))throw error('ID tidak valid',400);
    const device=await first('rh_devices?id=eq.'+body.id);if(!device||!equal(device.token_hash,await hash(bearer)))throw error('Agent ditolak',401);
    const info={};for(const key of telemetryKeys){const value=body.info?.[key];if(['string','boolean','number'].includes(typeof value))info[key]=typeof value==='string'?value.slice(0,600):value;}
    await db('rh_devices?id=eq.'+body.id,'PATCH',{info,last_seen:new Date().toISOString()});
    for(const result of (Array.isArray(body.results)?body.results:[]).slice(0,10)){
     if(!/^[a-f0-9-]{36}$/.test(result.id))continue;
     await db('rh_commands?id=eq.'+result.id+'&device_id=eq.'+body.id+'&status=eq.delivered','PATCH',{status:'completed',result:result.error?{error:String(result.error).slice(0,700)}:{success:true,...result.result}});
    }
    const commands=await db('rpc/rh_claim','POST',{p_device:body.id});return json({success:true,commands:commands.map(c=>({id:c.id,action:c.action,expiresAt:c.expires_at})),pollSeconds:30});
   }
   const session=bearer&&await first('rh_sessions?token_hash=eq.'+await hash(bearer)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString()));
   if(!session)throw error('Login diperlukan / sesi kedaluwarsa',401);
   if(route==='/api/logout'&&req.method==='POST'){await db('rh_sessions?token_hash=eq.'+await hash(bearer),'DELETE');return json({success:true});}
   if(route==='/api/devices'&&req.method==='GET'){
    const devices=await db('rh_devices?select=id,name,info,last_seen,created_at&order=created_at.asc');return json({transport:'poll',devices:devices.map(d=>({...d.info,id:d.id,serial:d.id,name:d.name,desktopEnabled:false,lastSeen:d.last_seen,status:d.last_seen&&Date.now()-Date.parse(d.last_seen)<90000?'Online':'Offline'})),storage:{localPersistent:false,githubEnabled:false,status:'central'}});
   }
   const deviceRoute=route.match(/^\/api\/devices\/([\w-]+)$/);
   if(deviceRoute&&req.method==='PUT'){const d=await first('rh_devices?id=eq.'+deviceRoute[1]);if(!d)throw error('Laptop harus dipasang client dahulu',404);await db('rh_devices?id=eq.'+deviceRoute[1],'PATCH',{name:String(body.name||d.name).slice(0,128)});return json({success:true});}
   if(deviceRoute&&req.method==='DELETE')throw error('Perangkat disimpan permanen. Penghapusan belum tersedia pada pusat kontrol.',409);
   const resultRoute=route.match(/^\/api\/commands\/([a-f0-9-]{36})$/);
   if(resultRoute&&req.method==='GET'){const c=await first('rh_commands?id=eq.'+resultRoute[1]);if(!c)throw error('Perintah tidak ditemukan',404);if(c.status==='completed')return json(c.result||{success:true});if(Date.parse(c.expires_at)<Date.now())throw error('Perintah kedaluwarsa; hasil belum terkonfirmasi. Periksa status perangkat.',408);return json({pending:true},202);}
   const systemRoute=route.match(/^\/api\/system\/([\w-]+)$/);
   if(req.method==='POST'&&(route==='/api/command'||systemRoute)){
    const id=systemRoute?.[1]||body.deviceId,action=systemRoute?body.action:body.command;
    if(!validId(id))throw error('ID tidak valid',400);
    if(!(systemRoute?['close_windows','shutdown','cancel_shutdown']:['stop_ahk','block_ahk','unblock_ahk']).includes(action))throw error('Perintah tidak diizinkan',400);
    if(systemRoute&&body.confirmed!==true)throw error('Konfirmasi diperlukan',400);
    const d=await first('rh_devices?id=eq.'+id);if(!d||!d.last_seen||Date.now()-Date.parse(d.last_seen)>90000)throw error('Laptop Offline',409);
    if(systemRoute&&!d.info.systemEnabled)throw error('Kontrol sistem tidak diizinkan agent',403);
    if(action==='shutdown'&&!d.info.shutdownAllowed)throw error(d.info.shutdownPermissionError||'Windows menolak izin shutdown',403);
    const c=await db('rh_commands','POST',{device_id:id,action},'return=representation');return json({pending:true,commandId:c[0].id},202);
   }
   throw error('Endpoint tidak ditemukan',404);
  }catch(e){return json({error:e.status?e.message:'Layanan pusat mengalami gangguan. Coba lagi.'},e.status||500);}
 };
}
