const fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os'),readline=require('readline');
const {Writable}=require('stream');const {getDeviceId}=require('./device-identity.cjs');
const base='https://rbdnigqlshglabhvwfvj.supabase.co/functions/v1/remote',root=__dirname,file=path.join(root,'central-agent.json');
async function request(route,body,token){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.error||'Pusat tidak tersedia');return d;}
async function main(){
 if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file,'utf8')).registered){console.log('Laptop sudah terdaftar.');return;}
 console.log('Pasang RH Remote pada laptop milikmu. Agent terlihat dan dapat dihentikan dengan Ctrl+C.');
 console.log('Fungsi: status dan blokir AutoHotkey, tutup jendela, shutdown sesuai izin Windows.');
 let hidden=false;const output=new Writable({write(chunk,encoding,next){if(!hidden)process.stdout.write(chunk);next();}});
 const rl=readline.createInterface({input:process.stdin,output,terminal:!!process.stdin.isTTY});
 const ask=q=>new Promise(resolve=>rl.question(q,resolve));
 const username=await ask('Username dashboard: ');process.stdout.write('Password dashboard: ');hidden=true;const password=await ask('');hidden=false;process.stdout.write('\n');rl.close();
 const login=await request('/api/login',{username:username.trim(),password});
 try{const id=getDeviceId({root}),previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;const token=previous?.token||crypto.randomBytes(32).toString('hex');
 fs.writeFileSync(file,JSON.stringify({version:1,id,token,registered:false}),{mode:0o600});
 await request('/api/agent/register',{id,deviceToken:token,name:os.hostname()},login.token);
 fs.writeFileSync(file,JSON.stringify({version:1,id,token,registered:true}),{mode:0o600});console.log('Pendaftaran berhasil. Laptop:',id);
 }finally{await request('/api/logout',{},login.token).catch(()=>{});}
}
main().catch(e=>{console.error('Pemasangan belum selesai:',e.message);process.exitCode=1;});
