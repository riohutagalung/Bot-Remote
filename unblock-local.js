const base='http://127.0.0.1:'+(process.env.PORT || 8080);
let token;
try {
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.DASHBOARD_USERNAME,password:process.env.DASHBOARD_PASSWORD}),signal:AbortSignal.timeout(5000)});
  const auth=await login.json();
  if(!login.ok || !auth.token)throw Error('Login lokal gagal. Periksa konfigurasi .env.');
  token=auth.token;
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const response=await fetch(base+'/api/command',{method:'POST',headers,body:JSON.stringify({deviceId:process.env.DEVICE_ID,command:'unblock_ahk'}),signal:AbortSignal.timeout(20000)});
  const result=await response.json();
  if(!response.ok || result.ahkBlocked!==false)throw Error(result.error || 'Agent belum mengonfirmasi pencabutan blokir');
  console.log('BERHASIL: blokir AHK dinonaktifkan. Script boleh dibuka manual.');
} catch(error) {
  console.error('Blokir belum terkonfirmasi nonaktif:',error.message);
  console.error('Jika agent tidak dapat dihubungi, tutup jendela Bot-Remote untuk menghentikan pemantauan.');
  process.exitCode=1;
} finally {
  if(token)await fetch(base+'/api/logout',{method:'POST',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)}).catch(()=>{});
}
