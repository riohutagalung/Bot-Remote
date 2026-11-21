const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
exports.getDeviceId=({root,configured=''})=>{
 const valid=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(id);
 if(configured){if(!valid(configured))throw Error('DEVICE_ID tidak valid');return configured;}
 const file=path.join(root,'device-identity.json');
 const read=()=>{const data=JSON.parse(fs.readFileSync(file,'utf8'));if(!valid(data.id))throw Error('Identitas perangkat rusak; jangan membuat identitas pengganti otomatis.');return data.id;};
 if(fs.existsSync(file))return read();
 const id=crypto.randomUUID();
 try{fs.writeFileSync(file,JSON.stringify({version:1,id})+'\n',{flag:'wx',mode:0o600});return id;}
 catch(error){if(error.code==='EEXIST')return read();throw error;}
};
