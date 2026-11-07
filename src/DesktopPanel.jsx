import React, { useState } from 'react';

export default function DesktopPanel({device, base, headers, onClose}) {
  const [screen, setScreen] = useState(null);
  const [text, setText] = useState('');
  const [task, setTask] = useState('');
  const [proposal, setProposal] = useState(null);
  const [message, setMessage] = useState('Ambil screenshot untuk melihat layar utama laptop.');
  const [busy, setBusy] = useState(false);
  async function request(path, body) {
    setBusy(true); setProposal(null);
    try {
      const response = await fetch(`${base}/api/desktop/${encodeURIComponent(device.serial)}/${path}`, {method:'POST', headers:headers(), body:JSON.stringify(body)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Permintaan gagal');
      if (data.image) setScreen(data);
      if (data.screen) setScreen(data.screen);
      if (data.proposalId) setProposal(data);
      setMessage(data.message || (data.proposalId ? 'Periksa usulan sebelum menjalankannya.' : 'Layar diperbarui.'));
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  const action = body => request('action', body);
  return <section className="bg-slate-900 border border-indigo-600 rounded-2xl p-5 space-y-3" aria-label="Kontrol desktop">
    <div className="flex justify-between"><h2>Kontrol Laptop — {device.name}</h2><button onClick={onClose} disabled={busy}>Tutup</button></div>
    <p className="text-xs text-slate-400">Klik gambar untuk klik di laptop. Ctrl+C di terminal agent memutus akses. Screenshot dikirim ke OpenAI hanya saat meminta langkah AI.</p>
    <div className="flex flex-wrap gap-2">
      <button disabled={busy} onClick={() => action({type:'screenshot'})}>Ambil screenshot</button>
      {['enter','tab','escape','backspace','up','down','left','right'].map(key => <button className="border p-2 rounded disabled:opacity-40" key={key} disabled={busy || !screen} onClick={() => action({type:'key',key})}>{key}</button>)}
      <button disabled={busy || !screen} onClick={() => action({type:'scroll',amount:3})}>Scroll ↑</button>
      <button disabled={busy || !screen} onClick={() => action({type:'scroll',amount:-3})}>Scroll ↓</button>
    </div>
    {screen && <img src={screen.image} alt={`Layar utama ${device.name}; klik untuk mengontrol`} className={`w-full border rounded ${busy ? 'opacity-50' : 'cursor-crosshair'}`} onClick={e => {
      if (busy) return;
      const r = e.currentTarget.getBoundingClientRect();
      action({type:'click', x:Math.min(screen.width-1, Math.floor((e.clientX-r.left)*screen.width/r.width)), y:Math.min(screen.height-1, Math.floor((e.clientY-r.top)*screen.height/r.height))});
    }} />}
    <div className="flex gap-2"><input aria-label="Teks untuk laptop" className="bg-slate-950 p-2 rounded flex-1" maxLength={2000} value={text} onChange={e=>setText(e.target.value)} placeholder="Teks yang akan diketik di aplikasi aktif"/><button disabled={busy || !screen || !text} onClick={()=>action({type:'type',text})}>Ketik</button></div>
    <div className="flex gap-2"><input aria-label="Instruksi AI" className="bg-slate-950 p-2 rounded flex-1" maxLength={4000} value={task} onChange={e=>setTask(e.target.value)} placeholder="Instruksi AI, misalnya: isi judul dokumen ini"/><button disabled={busy || !task.trim()} onClick={()=>request('plan',{task})}>Minta langkah AI</button></div>
    {proposal && <div className="border border-amber-500 rounded p-3 space-y-2"><p>Usulan AI (berlaku 60 detik):</p><pre className="whitespace-pre-wrap break-all">{JSON.stringify(proposal.action,null,2)}</pre><button className="bg-indigo-600 p-2 rounded" disabled={busy} onClick={()=>request('approve',{proposalId:proposal.proposalId})}>Setujui dan jalankan sekali</button><button className="ml-4" onClick={()=>setProposal(null)}>Tolak</button></div>}
    <p role="status" className="text-sm text-indigo-300">{busy ? 'Memproses…' : message}</p>
  </section>;
}
