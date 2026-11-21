const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const path=require('node:path');
const nativeRun=promisify(execFile);
exports.createSystemControl=({run=nativeRun, enabled=()=>process.env.ALLOW_SYSTEM_CONTROL==='1', platform=process.platform, schedule=setTimeout, cancel=clearTimeout, onChange=()=>{}}={})=>{
  let timer=null;
  let state={shutdownAt:0,shutdownError:''};
  const system32=path.join(process.env.SystemRoot || 'C:\\Windows','System32');
  const publish=()=>onChange({...state});
  return {
    snapshot:()=>({...state}),
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
        timer=null;state={shutdownAt:0,shutdownError:''};publish();
        return {status:'cancelled',...state};
      }
      if(timer)return {status:'scheduled',...state};
      state={shutdownAt:Date.now()+10000,shutdownError:''};
      // Delay here instead of Windows /t > 0, which would imply forced app closure.
      timer=schedule(async()=>{
        timer=null;
        try { await run(path.join(system32,'shutdown.exe'),['/s','/t','0'],{windowsHide:true,timeout:10000});state={shutdownAt:0,shutdownError:''}; }
        catch(error){state={shutdownAt:0,shutdownError:String(error.stderr || error.message).trim().slice(0,500)};}
        publish();
      },10000);
      publish();
      return {status:'scheduled',...state};
    }
  };
};
