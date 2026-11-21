import {createHandler} from './handler.js';
const base=Deno.env.get('SUPABASE_URL');
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
async function db(path,method='GET',body,prefer='return=minimal'){
 const response=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok){console.error('Database operation failed',response.status,path.split('?')[0]);throw Error('Database unavailable');}
 const text=await response.text();return text?JSON.parse(text):null;
}
Deno.serve(createHandler({db}));
