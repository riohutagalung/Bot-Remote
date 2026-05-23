import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Download, 
  Upload, 
  Trash2, 
  AlertCircle, 
  Search, 
  Laptop, 
  Plus,
  LogOut,
  Sliders,
  ShieldCheck,
  Radio,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';

const AUTH_KEY = 'rh-auth-session';
const PASSWORD = import.meta.env.VITE_PASSWORD || 'Taikbabi182#';
const BACKEND_HTTP = "https://bot-remote-production.up.railway.app";
const BACKEND_WS = "wss://bot-remote-production.up.railway.app";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // State utama menampung seluruh daftar device dari database backend
  const [dbDevices, setDbDevices] = useState([]);
  // State untuk menampung live telemetry data laptop yang online dari WebSocket
  const [liveOnlineDevices, setLiveOnlineDevices] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    name: '', serial: '', model: '', wifi: '', ip: '', mac: ''
  });
  const [editingId, setEditingId] = useState(null);
  const fileInputRef = useRef(null);

  // Cek sesi login browser
  useEffect(() => {
    const auth = sessionStorage.getItem(AUTH_KEY);
    if (auth) setIsAuthenticated(true);
    setAuthChecked(true);
  }, []);

  // 1. Ambil data perangkat dari database backend (Polling cadangan jika WS bermasalah)
  const fetchDevicesFromDatabase = async () => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/devices`);
      if (res.ok) {
        const data = await res.json();
        setDbDevices(Array.isArray(data) ? data : data.devices || []);
      }
    } catch (error) {
      console.error("Gagal sinkronisasi ke database Railway:", error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchDevicesFromDatabase();
    const interval = setInterval(fetchDevicesFromDatabase, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // 2. Koneksi WebSocket untuk Monitoring Real-Time & Live Toggle
  useEffect(() => {
    if (!isAuthenticated) return;

    let ws;
    let reconnectTimeout;

    const connectWS = () => {
      ws = new WebSocket(BACKEND_WS);

      ws.onopen = () => {
        setWsConnected(true);
        showToast('Koneksi sistem telemetri aktif', 'success');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Menangkap update berkala dari backend server
          if (data.type === 'device_list' || data.devices) {
            setLiveOnlineDevices(data.devices || []);
          }
        } catch (error) {
          console.error('WS payload parsing error:', error);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connectWS, 5000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
        ws.close();
      };
    };

    connectWS();
    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, [isAuthenticated]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 3. LOGIC UTAMA SINKRONISASI (DIAMANKAN DARI ERROR UNDEFINED)
  const mergedDevices = useMemo(() => {
    // Standardisasi list dari database
    const currentDbList = [...dbDevices];

    // Gunakan Map untuk mempercepat pencarian data online berbasis serial key
    const onlineMap = new Map();
    liveOnlineDevices.forEach((live) => {
      // SAFE GUARD: Jika id bermasalah/kosong dari client.exe, abaikan agar tidak crash blank putih
      if (!live || !live.id) return;
      onlineMap.set(live.id.toLowerCase().trim(), live);
    });

    // Loop data dari DB, pasangkan status live online-nya
    let finalMasterList = currentDbList.map(device => {
      if (!device || !device.serial) return null;
      const cleanSerial = device.serial.toLowerCase().trim();
      const isOnlineNow = onlineMap.has(cleanSerial);
      const liveData = onlineMap.get(cleanSerial);

      return {
        ...device,
        isOnline: isOnlineNow,
        ahkEnabled: liveData ? (liveData.ahkEnabled || false) : false,
        // Upgrade info dinamis jika terdeteksi data live terbaru dari client.exe
        ip: liveData?.info?.ip || device.ip || '-',
        mac: liveData?.info?.mac || device.mac || '-',
        wifi: liveData?.info?.wifi || device.wifi || '-',
        model: liveData?.info?.model || device.model || '-',
        name: device.name || liveData?.info?.hostname || 'Perangkat Otomatis'
      };
    }).filter(Boolean); // Buang jika ada entri yang bernilai null

    // OTOMATISASI DATA BARU: Jika client.exe konek tapi data serialnya BELUM ADA di database
    liveOnlineDevices.forEach((live) => {
      if (!live || !live.id) return;
      const cleanLiveSerial = live.id.toLowerCase().trim();
      
      const sudahAdaDiDb = finalMasterList.some(d => d.serial.toLowerCase().trim() === cleanLiveSerial);
      
      if (!sudahAdaDiDb) {
        // Daftarkan langsung ke layar dashboard secara realtime
        finalMasterList.push({
          id: `auto-${live.id}`,
          name: live.info?.hostname || `Client-${live.id.slice(0,5)}`,
          serial: live.id,
          model: live.info?.model || 'Windows Laptop',
          wifi: live.info?.wifi || '-',
          ip: live.info?.ip || '-',
          mac: live.info?.mac || '-',
          isOnline: true,
          ahkEnabled: live.ahkEnabled || false,
          isNewTraffic: true // Tag penanda data belum disimpan permanen ke DB
        });
      }
    });

    return finalMasterList;
  }, [dbDevices, liveOnlineDevices]);

  // 4. LOGIC COUNTER DASHBOARD PANEL (BOX ATAS)
  const stats = useMemo(() => {
    const total = mergedDevices.length;
    const online = mergedDevices.filter(d => d.isOnline).length;
    const offline = total - online;
    const ahkActive = mergedDevices.filter(d => d.isOnline && d.ahkEnabled).length;
    return { total, online, offline, ahkActive };
  }, [mergedDevices]);

  // 5. ENGINE CONTROL ACTIONS
  const toggleAhk = async (device) => {
    try {
      const targetAction = device.ahkEnabled ? 'stop_ahk' : 'start_ahk';
      const res = await fetch(`${BACKEND_HTTP}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.serial, command: targetAction }),
      });
      if (!res.ok) throw new Error();
      showToast(`Sinyal ${targetAction.toUpperCase()} dikirim ke ${device.name}`, 'success');
      // Segera refresh data setela kirim perintah
      fetchDevicesFromDatabase();
    } catch (error) {
      showToast('Gagal berinteraksi dengan client engine target', 'error');
    }
  };

  // Simpan Otomatis / Manual ke Database Backend (Supaya Tersimpan Selamanya)
  const handleAddOrEditDatabase = async () => {
    if (!formData.serial) {
      showToast('Form Serial Number (BIOS/ID) wajib diisi!', 'error');
      return;
    }
    try {
      const url = editingId ? `${BACKEND_HTTP}/api/devices/${editingId}` : `${BACKEND_HTTP}/api/devices`;
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        showToast(editingId ? 'Data database diperbarui' : 'Perangkat baru didaftarkan permanen', 'success');
        setFormData({ name: '', serial: '', model: '', wifi: '', ip: '', mac: '' });
        setEditingId(null);
        fetchDevicesFromDatabase();
      } else {
        throw new Error();
      }
    } catch (error) {
      showToast('Gagal memproses data ke server Railway', 'error');
    }
  };

  // Hapus Data Permanen dari DB
  const handleDeleteFromDatabase = async (serial) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus perangkat ini dari database internal?")) return;
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/devices/${serial}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Data dibersihkan dari database', 'success');
        fetchDevicesFromDatabase();
      }
    } catch (error) {
      showToast('Gagal menghapus entri', 'error');
    }
  };

  // 6. JSON PORTABILITY ENGINE
  const exportToJSON = () => {
    if (dbDevices.length === 0) {
      showToast('Tidak ada data database untuk diekspor', 'error');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dbDevices, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `RH_Devices_Backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Database berhasil diekspor menjadi JSON');
  };

  const handleImportJSON = (e) => {
    const fileReader = new FileReader();
    if (!e.target.files[0]) return;
    
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if (!Array.isArray(parsedData)) {
          showToast('Struktur JSON salah, data harus berbentuk Array', 'error');
          return;
        }
        
        const res = await fetch(`${BACKEND_HTTP}/api/devices/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ devices: parsedData })
        });
        
        if (res.ok) {
          showToast('Import database massal berhasil diterapkan', 'success');
          fetchDevicesFromDatabase();
        } else {
          showToast('Server menolak skema data import', 'error');
        }
      } catch (err) {
        showToast('Gagal mengurai file JSON. File rusak atau salah format', 'error');
      }
    };
  };

  const filteredDevices = mergedDevices.filter(d => 
    Object.values(d).join(' ').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200 gap-4 font-mono">
        <Activity className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs tracking-widest animate-pulse">BOOTING INTEGRATED TELEMETRY CORE SYSTEM...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08),transparent_60%)]" />
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-md space-y-6 shadow-2xl relative z-10 backdrop-blur-sm">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/20 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight uppercase">RH Control Cloud</h1>
            <p className="text-xs text-slate-400">Secure authorization token required</p>
          </div>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && passwordInput === PASSWORD && (sessionStorage.setItem(AUTH_KEY, '1'), setIsAuthenticated(true))}
            placeholder="Akses Password Dashboard"
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-center text-sm focus:outline-none focus:border-indigo-500 font-mono transition"
          />
          <button 
            onClick={() => passwordInput === PASSWORD ? (sessionStorage.setItem(AUTH_KEY, '1'), setIsAuthenticated(true)) : showToast('Akses Ditolak: Password Tidak Valid', 'error')} 
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs tracking-wider uppercase shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.99]"
          >
            Authenticate Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* PROFESSIONAL APP HEADER */}
      <header className="bg-slate-900/80 border-b border-slate-800/80 sticky top-0 backdrop-blur-md z-40 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-600/10">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              RH Control Center <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-bold px-1.5 py-0.5 rounded">v3.1</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Automatic Hardware Data & Remote Micro-Engine Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold font-mono border ${wsConnected ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'}`}>
            <Radio className={`w-3.5 h-3.5 ${wsConnected ? 'animate-pulse text-emerald-400' : 'text-rose-400'}`} />
            {wsConnected ? 'LIVE MODE ACTIVE' : 'DISCONNECTED'}
          </div>
          <button 
            onClick={() => { sessionStorage.removeItem(AUTH_KEY); setIsAuthenticated(false); }} 
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-900 rounded-xl text-xs font-bold transition group"
            title="Keluar dari sesi"
          >
            <LogOut className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        
        {/* COUNTER DASHBOARD STATUS BOXES */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-inner">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Terdaftar</p>
            <p className="text-3xl font-black text-white mt-2 font-mono">{stats.total}</p>
            <div className="absolute right-3 bottom-3 text-slate-800 font-black text-5xl select-none pointer-events-none">DB</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Laptop Online
            </p>
            <p className="text-3xl font-black text-white mt-2 font-mono">{stats.online}</p>
            <div className="absolute right-3 bottom-3 text-emerald-500/5 text-5xl select-none pointer-events-none"><CheckCircle className="w-12 h-12" /></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Laptop Offline</p>
            <p className="text-3xl font-black text-slate-400 mt-2 font-mono">{stats.offline}</p>
            <div className="absolute right-3 bottom-3 text-rose-500/5 text-5xl select-none pointer-events-none"><XCircle className="w-12 h-12" /></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">AHK Engine On</p>
            <p className="text-3xl font-black text-indigo-400 mt-2 font-mono">{stats.ahkActive}</p>
            <div className="absolute right-3 bottom-3 text-indigo-500/10 text-5xl select-none pointer-events-none">⚙️</div>
          </div>
        </div>

        {/* RE-DESIGNED FORM SETUP */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <h2 className="text-xs font-black uppercase text-slate-300 tracking-widest flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-500" /> {editingId ? 'Edit Konfigurasi Database' : 'Registrasi Perangkat Manual / Override'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Laptop Name Custom', key: 'name' },
              { label: 'Serial Number *', key: 'serial', required: true },
              { label: 'Model Laptop', key: 'model' },
              { label: 'WiFi SSID Name', key: 'wifi' },
              { label: 'IP Address', key: 'ip' },
              { label: 'MAC Address Line', key: 'mac' }
            ].map((input) => (
              <div key={input.key} className="flex flex-col gap-1">
                <input 
                  type="text" 
                  value={formData[input.key]} 
                  onChange={(e) => setFormData({...formData, [input.key]: e.target.value})} 
                  placeholder={input.label} 
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium transition" 
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleAddOrEditDatabase} 
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
            >
              {editingId ? 'Update & Commit Changes' : 'Simpan Perangkat Permanen'}
            </button>
            {editingId && (
              <button 
                onClick={() => { setEditingId(null); setFormData({ name: '', serial: '', model: '', wifi: '', ip: '', mac: '' }); }}
                className="px-4 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700"
              >
                Batal
              </button>
            )}
          </div>
        </div>

        {/* TOOLBAR CONTROLS: SEARCH, IMPORT, EXPORT */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input 
              type="text" 
              placeholder="Filter cluster berdasarkan nama laptop, serial ID, wifi channel, atau alamat IP..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700 shadow-inner font-medium"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto justify-end">
            <button onClick={exportToJSON} className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 shadow-sm transition">
              <Download className="w-3.5 h-3.5 text-indigo-400" /> Export JSON
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 shadow-sm transition cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-emerald-400" /> Import JSON
              <input type="file" ref={fileInputRef} accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>
        </div>

        {/* COMPACT & DATA-RICH DEVICE CLUSTER LIST */}
        <div className="space-y-3">
          {filteredDevices.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-800 rounded-2xl text-center py-12 text-slate-500 text-xs font-mono">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-700" />
              NO REGISTERED NODES DISCOVERED IN CURRENT CLUSTER.
            </div>
          ) : (
            filteredDevices.map((device) => (
              <div 
                key={device.serial} 
                className={`bg-slate-900 border rounded-2xl p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 transition-all duration-200 hover:border-slate-700/60 ${
                  device.isNewTraffic ? 'border-l-4 border-l-cyan-500 bg-gradient-to-r from-cyan-950/20 to-transparent border-slate-800' : 'border-slate-800/80'
                }`}
              >
                {/* Cluster Left: Identity Info */}
                <div className="flex items-start gap-3">
                  <div className={`p-3 rounded-xl border ${device.isOnline ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 shadow-inner' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-white tracking-tight">{device.name}</h4>
                      
                      <span className={`text-[9px] font-black font-mono px-2 py-0.5 rounded-full uppercase border tracking-wider ${
                        device.isOnline 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}>
                        {device.isOnline ? 'Active' : 'Standby'}
                      </span>

                      {device.isNewTraffic && (
                        <span className="bg-cyan-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded font-mono uppercase tracking-wider animate-pulse">
                          Auto Detected
                        </span>
                      )}
                    </div>
                    
                    <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-medium">
                      <span>Serial: <strong className="font-mono bg-slate-950 px-1 py-0.5 rounded text-slate-300 border border-slate-800/60">{device.serial}</strong></span>
                      <span className="text-slate-700">|</span>
                      <span>Model: <strong className="text-slate-300">{device.model}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Cluster Center: Hardware Telemetry Metrics */}
                <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-[11px] font-mono text-slate-400 bg-slate-950 border border-slate-800/60 px-4 py-2.5 rounded-xl w-full lg:w-auto shadow-inner">
                  <div><span className="text-slate-600">IP_ADDR :</span> <span className="text-slate-200 font-bold">{device.ip}</span></div>
                  <div><span className="text-slate-600">MAC_LINE:</span> <span className="text-slate-200">{device.mac}</span></div>
                  <div><span className="text-slate-600">NET_WIFI:</span> <span className="text-slate-300 font-sans font-bold">{device.wifi}</span></div>
                </div>

                {/* Cluster Right: Micro-Engine Controls & Actions */}
                <div className="flex items-center gap-2 w-full lg:w-auto justify-end border-t border-slate-800/60 pt-3 lg:pt-0 lg:border-t-0">
                  
                  {/* ENGINE CONTROL TOGGLE SWITCH BUTTON */}
                  <button
                    onClick={() => toggleAhk(device)}
                    disabled={!device.isOnline}
                    className={`min-w-[125px] text-center py-2 px-3 rounded-xl text-xs font-extrabold tracking-wider font-mono border transition-all ${
                      !device.isOnline 
                        ? 'bg-slate-950 border-slate-800/80 text-slate-600 cursor-not-allowed' 
                        : device.ahkEnabled 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-lg shadow-emerald-500/5' 
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                    }`}
                  >
                    {device.isOnline ? (device.ahkEnabled ? 'AHK: ACTIVE 🟢' : 'AHK: INACTIVE 🔴') : 'OFFLINE 📡'}
                  </button>

                  {device.isNewTraffic ? (
                    // Jika data otomatis masuk, sediakan tombol cepat simpan ke DB
                    <button 
                      onClick={() => {
                        setFormData({ name: device.name, serial: device.serial, model: device.model, wifi: device.wifi, ip: device.ip, mac: device.mac });
                        showToast('Gunakan formulir atas lalu klik Simpan Perangkat Permanen', 'info');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-xl text-xs font-black transition uppercase tracking-wider"
                    >
                      Save to DB
                    </button>
                  ) : (
                    // Menu standar data database permanen
                    <>
                      <button 
                        onClick={() => { setFormData(device); setEditingId(device.serial); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                        className="px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteFromDatabase(device.serial)} 
                        className="p-2 bg-slate-950 hover:bg-rose-950 border border-slate-800 hover:border-rose-900 text-slate-500 hover:text-rose-400 rounded-xl transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>

              </div>
            ))
          )}
        </div>
      </main>

      {/* COMPACT FLOATING APPLICATION NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 shadow-2xl flex items-center gap-2 font-mono">
          <div className={`w-1.5 h-1.5 rounded-full ${toast.type === 'error' ? 'bg-rose-500' : 'bg-indigo-500'}`} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}