export function normalizeBackend(value) {
  let url;
  try { url = new URL(value.trim()); }
  catch { throw new Error('Isi alamat HTTPS backend laptop yang valid.'); }
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || (url.protocol !== 'https:' && !localHttp)) {
    throw new Error('Gunakan alamat HTTPS server tanpa path, query, atau password.');
  }
  return url.origin;
}

export function selectBackend(origin, saved, configured) {
  const host = new URL(origin).hostname;
  // A dashboard served by the laptop must use that same live backend.
  if (host.endsWith('.trycloudflare.com') || ['localhost','127.0.0.1'].includes(host)) return origin;
  return saved || configured || origin;
}

export const SHARED_CONNECTION_URL='https://raw.githubusercontent.com/riohutagalung/Bot-Remote/connection-state/connection.json';
export async function discoverBackend({origin,saved,fetcher=fetch}={}){
  const host=new URL(origin).hostname;
  if(host.endsWith('.trycloudflare.com')||['127.0.0.1','localhost'].includes(host))return normalizeBackend(origin);
  try{
    const response=await fetcher(SHARED_CONNECTION_URL+'?nocache='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('Koneksi GitHub belum tersedia');
    const data=await response.json();
    if(data.version!==1)throw Error('Format koneksi GitHub tidak sesuai');
    const url=normalizeBackend(data.backendUrl);
    if(!url.startsWith('https://'))throw Error('Koneksi bersama harus memakai HTTPS');
    return url;
  }catch{
    if(saved && saved!==origin)return normalizeBackend(saved);
    throw Error('Koneksi laptop belum tersedia di GitHub. Pastikan agent dan sinkronisasi GitHub berjalan; username dan password tidak perlu diganti.');
  }
}

export async function readApiJson(response) {
  const text = await response.text();
  if (!response.headers.get('content-type')?.includes('application/json') || text.trimStart().startsWith('<')) {
    throw new Error(`Backend tidak tersedia atau alamat tunnel sudah berubah (HTTP ${response.status}). Buka alamat terbaru dari Backend-URL.txt. Blokir lokal tetap mengikuti pilihan terakhir sampai perintah nonaktifkan diterima agent.`);
  }
  try { return JSON.parse(text); }
  catch { throw new Error('Respons backend rusak. Perintah belum dapat dikonfirmasi; coba hubungkan kembali.'); }
}
