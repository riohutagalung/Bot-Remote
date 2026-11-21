const crypto=require('node:crypto');
const derive=(secret,salt)=>{
  if(typeof secret!=='string'||secret.length<32)throw Error('AGENT_TOKEN tidak cukup kuat untuk cadangan terenkripsi');
  return Buffer.from(crypto.hkdfSync('sha256',Buffer.from(secret),salt,Buffer.from('bot-remote-device-backup-v1'),32));
};
exports.encryptDevices=(data,secret)=>{
  const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',derive(secret,salt),iv);
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
  return {version:1,algorithm:'aes-256-gcm',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
};
exports.decryptDevices=(backup,secret)=>{
  if(backup?.version!==1||backup.algorithm!=='aes-256-gcm')throw Error('Format cadangan tidak didukung');
  const salt=Buffer.from(backup.salt,'base64'),iv=Buffer.from(backup.iv,'base64'),tag=Buffer.from(backup.tag,'base64');
  if(salt.length!==16||iv.length!==12||tag.length!==16)throw Error('Cadangan rusak');
  const decipher=crypto.createDecipheriv('aes-256-gcm',derive(secret,salt),iv);decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(backup.ciphertext,'base64')),decipher.final()]).toString('utf8'));
};
