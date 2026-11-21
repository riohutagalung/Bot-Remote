import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function validateDevices(value){
  if(!value || typeof value!=='object' || Array.isArray(value))throw Error('Format data perangkat tidak valid');
  for(const [id,device] of Object.entries(value))if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id) || !device || typeof device!=='object' || Array.isArray(device))throw Error('Isi data perangkat tidak valid');
  return Object.assign(Object.create(null),value);
}
export function createDeviceStore(file){
  const read=source=>validateDevices(JSON.parse(fs.readFileSync(source,'utf8')));
  let source='unknown';
  return {
    get source(){return source;},
    load(){
      const hasMain=fs.existsSync(file),hasBackup=fs.existsSync(file+'.bak');
      if(!hasMain&&!hasBackup){source='empty';return Object.create(null);}
      if(hasMain){try{const data=read(file);source='primary';return data;}catch{}}
      if(hasBackup){try{const data=read(file+'.bak');source='backup';return data;}catch{}}
      throw Error('Data perangkat tidak bisa dibaca. File asli dipertahankan; pulihkan cadangan sebelum menjalankan server.');
    },
    save(data){
      validateDevices(data);
      fs.mkdirSync(path.dirname(file),{recursive:true});
      const temporary=file+'.'+crypto.randomUUID()+'.tmp';
      const fd=fs.openSync(temporary,'wx',0o600);
      try{fs.writeFileSync(fd,JSON.stringify(data,null,2)+'\n','utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
      if(fs.existsSync(file)){try{read(file);fs.copyFileSync(file,file+'.bak');}catch{}}
      fs.renameSync(temporary,file);
      source='primary';
    }
  };
}
