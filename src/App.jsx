import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Wifi, 
  WifiOff, 
  LogOut, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Save, 
  Search, 
  Laptop, 
  ToggleLeft, 
  ToggleRight 
} from 'lucide-react';

const STORAGE_KEY = 'rh-control-registered-devices';
const AUTH_KEY = 'rh-auth-session';
const PASSWORD = import.meta.env.VITE_PASSWORD || 'Taikbabi182#';
const BACKEND_HTTP = "https://bot-remote-production.up.railway.app";
const BACKEND_WS = "wss://bot-remote-production.up.railway.app";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // State untuk menampung device yang SUDAH DISIMPAN PERMANEN
  const [savedDevices, setSavedDevices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State form jika ingin isi/edit manual
  const [formData, setFormData] = useState({
    name: '', serial: '', model: '', wifi: '', ip: '', mac: ''
  });
  const [editingId, setEditingId] = useState(null);

  // State menampung laptop yang SEDANG ONLINE saat ini dari websocket backend
  const [remoteOnlineDevices, setRemoteOnlineDevices] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [toast, setToast] = useState(null);

  // --- 1. LOAD & SAVE LOCAL STORAGE ---
  useEffect(() => {
    const auth = sessionStorage.getItem(AUTH_KEY);
    if (auth) setIsAuthenticated(true);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setSavedDevices(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDevices));
    }
  }, [savedDevices, isAuthenticated]);

  // --- 2. WEBSOCKET REALTIME INTEGRATION ---
  useEffect(() => {
    if (!isAuthenticated) return;

    let ws;
    const connectWS = () => {
      ws = new WebSocket(BACKEND_WS);

      ws.onopen = () => {
        setWsConnected(true);
        showToast('Koneksi live backend aktif!', 'success');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Pastikan backend kamu mem-broadcast list device aktif dengan properti ini
          if (data.type === 'device_list' || data.devices) {
            setRemoteOnlineDevices(data.devices || []);
          }
        } catch (error) {
          console.error('WS parse error:', error);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWS, 5000); // Auto reconnect setiap 5 detik jika mati
      };
    };

    connectWS();
    return () => { if (ws) ws.close(); };
  }, [isAuthenticated]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- 3. LOGIC UTAMA: SINKRONISASI OTOMATIS ---
  const allDevicesMerged = useMemo(() => {
    // Buat salinan dari semua device yang sudah disimpan user secara permanen
    let masterList = savedDevices.map(d => ({ ...d, isSaved: true, isOnline: false, ahkEnabled: false }));

    // Cocokkan dengan data laptop yang sedang aktif mengirim sinyal ke server backend saat ini
    remoteOnlineDevices.forEach((remote) => {
      // Cari apakah ID/Serial laptop online ini sudah pernah disimpan atau belum
      const existingIdx = masterList.findIndex(d => d.serial.toLowerCase().trim() === remote.id.toLowerCase().trim());

      if (existingIdx !== -1) {
        // Jika sudah tersimpan, tandai statusnya menjadi Online & update info live terbarunya
        masterList[existingIdx].isOnline = true;
        masterList[existingIdx].ahkEnabled = remote.ahkEnabled || false;
        masterList[existingIdx].ip = remote.info?.ip || masterList[existingIdx].ip;
        masterList[existingIdx].mac = remote.info?.mac || masterList[existingIdx].mac;
        masterList[existingIdx].wifi = remote.info?.wifi || masterList[existingIdx].wifi;
      } else {
        // JIKA BELUM PERNAH DISIMPAN -> KITA MASUKKAN OTOMATIS KE LAYAR
        masterList.push({
          id: `auto-${remote.id}`,
          name: remote.info?.hostname || `Unknown (${remote.info?.username || 'Client'})`,
          serial: remote.id,
          model: remote.info?.model || 'Windows PC',
          wifi: remote.info?.wifi || '-',
          ip: remote.info?.ip || '-',
          mac: remote.info?.mac || '-',
          isSaved: false, // Menandakan ini data otomatis lewat live-traffic
          isOnline: true,
          ahkEnabled: remote.ahkEnabled || false
        });
      }
    });

    return masterList;
  }, [savedDevices, remoteOnlineDevices]);

  // --- 4. COUNTER ATAS (STATISTIK BOX) ---
  const stats = useMemo(() => {
    const total = allDevicesMerged.length;
    const online = allDevicesMerged.filter(d => d.isOnline).length;
    const offline = allDevicesMerged.filter(d => !d.isOnline).length;
    const ahkActive = allDevicesMerged.filter(d => d.ahkEnabled).length;
    return { total, online, offline, ahkActive };
  }, [allDevicesMerged]);

  // --- 5. CONTROLLER & ACTION HANDLERS ---
  const toggleAhk = async (device) => {
    try {
      const targetAction = device.ahkEnabled ? 'stop_ahk' : 'start_ahk';
      const res = await fetch(`${BACKEND_HTTP}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.serial, command: targetAction }),
      });
      if (!res.ok) throw new Error('Respon server gagal');
      showToast(`Perintah ${targetAction.toUpperCase()} dikirim ke ${device.name}`, 'success');
    } catch (error) {
      showToast('Gagal mengirim perintah kontrol ke laptop target', 'error');
    }
  };

  const handleSaveToPermanent = (device) => {
    const newDevice = {
      id: Date.now().toString(),
      name: device.name,
      serial: device.serial,
      model: device.model,
      wifi: device.wifi,
      ip: device.ip,
      mac: device.mac
    };
    setSavedDevices(prev => [...prev, newDevice]);
    showToast(`Laptop ${device.name} Berhasil Disimpan Permanen!`);
  };

  const handleAddManualOrEdit = () => {
    if (!formData.name || !formData.serial) {
      showToast('Nama dan Serial Number wajib diisi!', 'error');
      return;
    }
    if (editingId) {
      setSavedDevices(prev => prev.map(d => d.id === editingId ? { ...formData, id: editingId } : d));
      setEditingId(null);
    } else {
      setSavedDevices(prev => [...prev, { ...formData, id: Date.now().toString() }]);
    }
    setFormData({ name: '', serial: '', model: '', wifi: '', ip: '', mac: '' });
    showToast('Data manual berhasil diproses');
  };

  const handleDeletePermanent = (id) => {
    setSavedDevices(prev => prev.filter(d => d.id !== id));
    showToast('Data simpanan berhasil dihapus', 'success');
  };

  const filteredDevices = allDevicesMerged.filter(d => 
    Object.values(d).join(' ').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!authChecked) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-mono">LOADING SYSTEM...</div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-md border border-slate-700 space-y-4 shadow-2xl">
          <h1 className="text-xl font-black text-white text-center tracking-wider">RH CONTROL CENTER</h1>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && passwordInput === PASSWORD && (sessionStorage.setItem(AUTH_KEY, '1'), setIsAuthenticated(true))}
            placeholder="Masukkan Password Akses"
            className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-center"
          />
          <button onClick={() => passwordInput === PASSWORD ? (sessionStorage.setItem(AUTH_KEY, '1'), setIsAuthenticated(true)) : showToast('Password Salah', 'error')} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl transition text-sm">Masuk Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">RH Control Center</h1>
          <p className="text-xs text-slate-500 font-medium">Automatic Live Monitoring & Remote Engine Control</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${wsConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {wsConnected ? 'WS Connected' : 'WS Disconnected'}
          </div>
          <button onClick={() => { sessionStorage.removeItem(AUTH_KEY); setIsAuthenticated(false); }} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* STATS COUNTER BOXES */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-sm">
            <p className="text-xs font-semibold uppercase opacity-75">Total Terdaftar</p>
            <p className="text-3xl font-black mt-1">{stats.total}</p>
          </div>
          <div className="bg-emerald-600 p-4 rounded-2xl text-white shadow-sm">
            <p className="text-xs font-semibold uppercase opacity-75">Laptop Online</p>
            <p className="text-3xl font-black mt-1">{stats.online}</p>
          </div>
          <div className="bg-rose-600 p-4 rounded-2xl text-white shadow-sm">
            <p className="text-xs font-semibold uppercase opacity-75">Laptop Offline</p>
            <p className="text-3xl font-black mt-1">{stats.offline}</p>
          </div>
          <div className="bg-purple-600 p-4 rounded-2xl text-white shadow-sm">
            <p className="text-xs font-semibold uppercase opacity-75">AHK Sedang Aktif</p>
            <p className="text-3xl font-black mt-1">{stats.ahkActive}</p>
          </div>
        </div>

        {/* SETUP / MANUAL ADD FORM */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-purple-600" /> {editingId ? 'Edit Konfigurasi Laptop' : 'Add / Setup Laptop Manual'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Laptop Name *" className="border rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none" />
            <input type="text" value={formData.serial} onChange={(e) => setFormData({...formData, serial: e.target.value})} placeholder="Serial Number (BIOS) *" className="border rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none" />
            <input type="text" value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} placeholder="Model" className="border rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none" />
            <input type="text" value={formData.wifi} onChange={(e) => setFormData({...formData, wifi: e.target.value})} placeholder="WiFi SSID" className="border rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none" />
            <input type="text" value={formData.ip} onChange={(e) => setFormData({...formData, ip: e.target.value})} placeholder="Local IP" className="border rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none" />
            <input type="text" value={formData.mac} onChange={(e) => setFormData({...formData, mac: e.target.value})} placeholder="MAC Address" className="border rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none" />
          </div>
          <button onClick={handleAddManualOrEdit} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs transition shadow-sm">
            {editingId ? 'Simpan Perubahan' : 'Add Device'}
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input 
            type="text" 
            placeholder="Search laptops by name, serial, hardware info or active IP address..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
          />
        </div>

        {/* MAIN DYNAMIC DEVICE LIST */}
        <div className="space-y-3">
          {filteredDevices.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl text-center py-12 text-slate-400 text-xs font-medium">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              Tidak ada perangkat ditemukan. Pastikan client.exe target sedang berjalan.
            </div>
          ) : (
            filteredDevices.map((device) => (
              <div 
                key={device.id} 
                className={`bg-white border rounded-2xl p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-sm transition hover:shadow-md ${
                  !device.isSaved ? 'border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/30 to-transparent' : 'border-slate-200'
                }`}
              >
                {/* Info Identitas Utama */}
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${device.isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-sm text-slate-900">{device.name}</h3>
                      {device.isOnline ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Online</span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Offline</span>
                      )}
                      {!device.isSaved && (
                        <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse">NEW TRAFFIC DETECTED</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      Serial: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded font-bold text-slate-700">{device.serial}</span> 
                      <span className="mx-1.5">•</span> Model: <span className="font-semibold">{device.model}</span>
                    </p>
                  </div>
                </div>

                {/* Info Spek Hardware & Jaringan yang Didapat Otomatis */}
                <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl w-full lg:w-auto">
                  <div><span className="text-slate-400">IP:</span> <span className="font-mono text-slate-800">{device.ip}</span></div>
                  <div><span className="text-slate-400">MAC:</span> <span className="font-mono text-slate-800">{device.mac}</span></div>
                  <div><span className="text-slate-400">WiFi:</span> <span className="text-slate-800">{device.wifi}</span></div>
                </div>

                {/* Tombol Kontrol On/Off AHK & Fitur Simpan */}
                <div className="flex items-center gap-2 w-full lg:w-auto justify-end border-t border-slate-100 pt-3 lg:pt-0 lg:border-t-0">
                  {/* TOMBOL ON/OFF CONTROLLER ENGINE */}
                  <button
                    onClick={() => toggleAhk(device)}
                    disabled={!device.isOnline}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                      !device.isOnline 
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' 
                        : device.ahkEnabled 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100' 
                          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100'
                    }`}
                  >
                    {device.ahkEnabled ? 'AHK ACTIVE 🟢' : 'AHK INACTIVE 🔴'}
                  </button>

                  {/* TOMBOL SAVE DATA (Bila Otomatis Terdeteksi Tapi Belum Disimpan) */}
                  {!device.isSaved ? (
                    <button 
                      onClick={() => handleSaveToPermanent(device)}
                      className="flex items-center gap-1 px-3 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition"
                    >
                      <Save className="w-3.5 h-3.5" /> Save
                    </button>
                  ) : (
                    <>
                      <button onClick={() => { setFormData(device); setEditingId(device.id); }} className="px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Edit</button>
                      <button onClick={() => handleDeletePermanent(device.id)} className="p-2 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl hover:bg-rose-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* TOAST SYSTEM FLASHLIGHT */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all animate-bounce ${
          toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-900'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}