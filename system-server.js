import crypto from 'node:crypto';
export function installSystemCommands(app,connections){
  const pending=new Map();
  app.post('/api/system/:id',async(req,res)=>{
    const {action,confirmed}=req.body || {};
    if(!['close_windows','shutdown','cancel_shutdown'].includes(action)||confirmed!==true)return res.status(400).json({error:'Aksi sistem harus valid dan dikonfirmasi'});
    const ws=connections.get(req.params.id.trim().toLowerCase());
    if(!ws || ws.readyState!==1)return res.status(404).json({error:'Laptop offline'});
    if(!ws.systemEnabled)return res.status(403).json({error:'Kontrol sistem dinonaktifkan pada agent'});
    const requestId=crypto.randomUUID();
    try {
      const result=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('Agent belum mengonfirmasi aksi sistem'));},15000);
        pending.set(requestId,{ws,timer,resolve,reject});
        ws.send(JSON.stringify({type:'system_command',requestId,action,confirmed:true}),error=>{if(error){clearTimeout(timer);pending.delete(requestId);reject(error);}});
      });
      res.json({success:true,...result});
    }catch(error){res.status(400).json({error:error.message});}
  });
  return {
    handle(ws,data){
      if(data.type!=='system_result')return false;
      const item=pending.get(data.requestId);
      if(item?.ws===ws){
        clearTimeout(item.timer);pending.delete(data.requestId);
        if(data.error)item.reject(Error(String(data.error).slice(0,600)));
        else if(!['scheduled','cancelled','close_requested'].includes(data.result?.status))item.reject(Error('Hasil sistem tidak valid'));
        else item.resolve(data.result);
      }
      return true;
    },
    disconnect(ws){for(const[id,item]of pending)if(item.ws===ws){clearTimeout(item.timer);pending.delete(id);item.reject(Error('Laptop terputus; hasil aksi belum terkonfirmasi'));}}
  };
}
