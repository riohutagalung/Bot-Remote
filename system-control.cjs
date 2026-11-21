const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const path=require('node:path');
const nativeRun=promisify(execFile);
exports.createSystemControl=({run=nativeRun, enabled=()=>process.env.ALLOW_SYSTEM_CONTROL==='1', platform=process.platform, schedule=setTimeout, cancel=clearTimeout, onChange=()=>{}, checkPermission}={})=>{
  let timer=null;
  let state={shutdownAt:0,shutdownError:'',shutdownAllowed:false,shutdownPermissionKnown:false,shutdownPermissionError:''};
  let permissionPending=null;
  const system32=path.join(process.env.SystemRoot || 'C:\\Windows','System32');
  const publish=()=>onChange({...state});
  const permissionMessage='Windows belum memberikan hak mematikan komputer kepada proses agent ini. Jalankan Jalankan-Ulang-Dari-Desktop.cmd lewat File Explorer pada akun Windows milikmu, lalu periksa lagi. Ini tidak meminta kenaikan izin; izin tidak dapat diberikan dari tombol web.';
  async function inspectPermissions(){
    if(permissionPending)return permissionPending;
    permissionPending=(async()=>{
      try {
        const allowed=platform==='win32' && (checkPermission ? await checkPermission() : /\bSeShutdownPrivilege\b/.test((await run(path.join(system32,'whoami.exe'),['/priv','/fo','csv','/nh'],{windowsHide:true,timeout:5000})).stdout));
        state={...state,shutdownPermissionKnown:true,shutdownAllowed:!!allowed,shutdownPermissionError:allowed?'':permissionMessage};
      }catch(error){state={...state,shutdownPermissionKnown:true,shutdownAllowed:false,shutdownPermissionError:'Pemeriksaan izin shutdown gagal. Jalankan ulang agent dari desktop pengguna.'};}
      publish();return {...state};
    })();
    try{return await permissionPending;}finally{permissionPending=null;}
  }
  return {
    snapshot:()=>({...state}),
    inspectPermissions,
    execute:async action=>{
      if(!enabled())throw Error('Kontrol sistem belum diizinkan pada agent laptop');
      if(platform!=='win32')throw Error('Kontrol sistem ini memerlukan Windows');
      if(!['close_windows','shutdown','cancel_shutdown'].includes(action))throw Error('Aksi sistem tidak valid');
      if(action==='close_windows'){
        const {stdout}=await run(path.join(system32,'WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'close-windows.ps1')],{windowsHide:true,timeout:12000});
        const counts=JSON.parse(stdout.trim());
        if(!['requested','skipped','failed'].every(k=>Number.isInteger(counts[k])&&counts[k]>=0))throw Error('Hasil penutupan jendela tidak valid');
        return {status:'close_requested',...counts};
      }
      if(action==='cancel_shutdown'){
        if(timer)cancel(timer);
        timer=null;state={...state,shutdownAt:0,shutdownError:''};publish();
        return {status:'cancelled',...state};
      }
      if(timer)return {status:'scheduled',...state};
      await inspectPermissions();
      if(!state.shutdownAllowed)throw Error(state.shutdownPermissionError);
      state={...state,shutdownAt:Date.now()+10000,shutdownError:''};
      // Delay here instead of Windows /t > 0, which would imply forced app closure.
      timer=schedule(async()=>{
        timer=null;
        try { await run(path.join(system32,'shutdown.exe'),['/s','/t','0'],{windowsHide:true,timeout:10000});state={...state,shutdownAt:0,shutdownError:''}; }
        catch(error){
          const denied=error.code===5 || /access is denied|access denied/i.test(String(error.stderr || error.message));
          state={...state,shutdownAt:0,shutdownError:denied ? 'Windows menolak shutdown (kode 5). '+permissionMessage : String(error.stderr || error.message).trim().slice(0,500),...(denied?{shutdownAllowed:false,shutdownPermissionError:permissionMessage}:{})};
        }
        publish();
      },10000);
      publish();
      return {status:'scheduled',...state};
    }
  };
};
