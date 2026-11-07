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
