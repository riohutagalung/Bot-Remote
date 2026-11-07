import crypto from 'node:crypto';
export function installAhkCommands(app, connections) {
  const pending = new Map();
  app.post('/api/command', async (req,res) => {
    const {deviceId, command, scriptName=''} = req.body || {};
    if (typeof deviceId !== 'string' || !['start_ahk','stop_ahk'].includes(command) || typeof scriptName !== 'string' || (scriptName && !/^[\w .-]+\.ahk$/i.test(scriptName))) return res.status(400).json({error:'Perintah / nama script tidak valid'});
    const ws = connections.get(deviceId.trim().toLowerCase());
    if (!ws || ws.readyState !== 1) return res.status(404).json({error:'Laptop offline'});
    const requestId = crypto.randomUUID();
    try {
      const result = await new Promise((resolve,reject) => {
        const timer = setTimeout(()=>{pending.delete(requestId);reject(new Error('Client belum mengonfirmasi. Perbarui dan jalankan ulang agent laptop.'));},15000);
        pending.set(requestId,{ws,resolve,reject,timer});
        ws.send(JSON.stringify({type:'execute_command',requestId,action:command,scriptName}), error=>{
          if (error) {clearTimeout(timer);pending.delete(requestId);reject(error);}
        });
      });
      res.json({success:true,...result});
    } catch(error) { res.status(400).json({error:error.message}); }
  });
  return {
    handle(ws,data) {
      if(data.type !== 'command_result') return false;
      const item=pending.get(data.requestId);
      if(item?.ws === ws) {
        clearTimeout(item.timer);pending.delete(data.requestId);
        if(data.error) item.reject(new Error(String(data.error).slice(0,600)));
        else if(typeof data.ahkEnabled !== 'boolean') item.reject(new Error('Hasil client tidak valid'));
        else item.resolve({ahkEnabled:data.ahkEnabled});
      }
      return true;
    },
    disconnect(ws) {
      for(const [id,item] of pending) if(item.ws===ws){clearTimeout(item.timer);pending.delete(id);item.reject(new Error('Laptop terputus sebelum konfirmasi'));}
    }
  };
}
