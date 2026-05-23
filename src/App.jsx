import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  Upload, 
  Trash2, 
  AlertCircle, 
  Search, 
  Laptop, 
  Plus
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
  // State untuk menampung device yang sedang aktif/online saat ini dari WebSocket
  const [onlineSerials, setOnlineSerials] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    name: '', serial: '', model: '', wifi: '', ip: '', mac: ''
  });
  const [editingId, setEditingId] = useState(null);

  // Cek sesi login browser
  useEffect(() => {
    const auth = sessionStorage.getItem(AUTH_KEY);
    if (auth) setIsAuthenticated(true);
    setAuthChecked(true);
  }, []);

  // 1. Ambil data perangkat dari database backend (Dipanggil saat web pertama terbuka)
  const fetchDevicesFromDatabase = async () => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/devices`);
      if (res.ok) {
        const data = await res.json();
        // Pastikan backend mengembalikan array daftar device dari database
        setDbDevices(Array.isArray(data) ? data : data.devices || []);
      }
    } catch (error) {
      console.error("Gagal mengambil data dari database:", error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchDevicesFromDatabase();
    // Polling berkala setiap 5 detik untuk memastikan data database sinkron antar device
    const interval = setInterval(fetchDevicesFromDatabase, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // 2. Koneksi WebSocket untuk memantau status Online/Offline secara Real-Time
  useEffect(() => {
    if (!isAuthenticated) return;

    let ws;
    const connectWS = () => {
      ws = new WebSocket(BACKEND_WS);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Menangkap daftar serial number perangkat yang saat ini sedang terkoneksi aktif
          if (data.type === 'device_list' || data.devices) {
            const activeDevices = data.devices || [];
            setOnlineSerials(activeDevices.map(d => d.id.toLowerCase().trim()));
          }
        } catch (error) {
          console.error('WS parse error:', error);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWS, 5000);
      };
    };

    connectWS();
    return () => { if (ws) ws.close(); };
  }, [isAuthenticated]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 3. Menggabungkan data dari database dengan status koneksi live
  const mergedDevices = useMemo(() => {
    return dbDevices.map(device => {
      const isOnline = onlineSerials.includes(device.serial.toLowerCase().trim());
      return {
        ...device,
        isOnline: isOnline
      };
    });
  }, [dbDevices, onlineSerials]);

  // 4. Aksi Kontrol AHK Engine
  const toggleAhk = async (device) => {
    try {
      const targetAction = device.ahkEnabled ? 'stop_ahk' : 'start_ahk';
      const res = await fetch(`${BACKEND_HTTP}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.serial, command: targetAction }),
      });
      if (!res.ok) throw new Error('Respon server gagal');
      showToast(`Perintah dikirim ke ${device.name || device.serial}`, 'success');
      fetchDevicesFromDatabase();
    } catch (error) {
      showToast('Gagal mengirim perintah kontrol', 'error');
    }
  };

  // 5. Tambah atau Edit Perangkat secara Manual ke Database Backend
  const handleAddOrEdit = async () => {
    if (!formData.serial) {
      showToast('Serial Number wajib diisi!', 'error');
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
        showToast('Data perangkat berhasil disimpan ke database');
        setFormData({ name: '', serial: '', model: '', wifi: '', ip: '', mac: '' });
        setEditingId(null);
        fetchDevicesFromDatabase();
      }
    } catch (error) {
      showToast('Gagal menyimpan data ke database backend', 'error');
    }
  };

  // 6. Hapus Perangkat dari Database Permanen
  const handleDelete = async (serial) => {
    if (!window.confirm("Hapus perangkat ini dari database permanent?")) return;
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/devices/${serial}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Perangkat dihapus dari database');
        fetchDevicesFromDatabase();
      }
    } catch (error) {
      showToast('Gagal menghapus perangkat', 'error');
    }
  };

  // 7. Fitur Ekspor Data ke File JSON
  const exportToJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dbDevices, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "rh_control_devices.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Data berhasil diekspor ke JSON');
  };

  // 8. Fitur Impor Data dari File JSON ke Database Backend
  const handleImportJSON = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if (Array.isArray(parsedData)) {
          // Mengirimkan data impor ke backend untuk disimpan secara massal
          const res = await fetch(`${BACKEND_HTTP}/api/devices/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ devices: parsedData })
          });
          if (res.ok) {
            showToast('Massal impor data berhasil!');
            fetchDevicesFromDatabase();
          }
        } else {
          showToast('Format file JSON tidak valid (harus array)', 'error');
        }
      } catch (err) {
        showToast('Gagal memproses file JSON', 'error');
      }
    };
  };

  const filteredDevices = mergedDevices.filter(d => 
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
            className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white text-center text-sm"
          />
          <button onClick={() => passwordInput === PASSWORD ? (sessionStorage.setItem(AUTH_KEY, '1'), setIsAuthenticated(true)) : showToast('Password Salah', 'error')} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-sm">Masuk Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">RH Control Center</h1>
          <p className="text-xs text-slate-500 font-medium">Database Synchronized System (Automatic Tracking)</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${wsConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          {wsConnected ? 'Live Mode Active' : 'Disconnected'}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* FORM MANUAL MANAGEMENT */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-purple-600" /> Setup / Edit Data Perangkat Manual
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Laptop Name (Custom)" className="border rounded-xl px-3 py-2 text-xs outline-none" />
            <input type="text" value={formData.serial} onChange={(e) => setFormData({...formData, serial: e.target.value})} placeholder="Serial Number *" className="border rounded-xl px-3 py-2 text-xs outline-none" />
            <input type="text" value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} placeholder="Model" className="border rounded-xl px-3 py-2 text-xs outline-none" />
            <input type="text" value={formData.wifi} onChange={(e) => setFormData({...formData, wifi: e.target.value})} placeholder="WiFi SSID" className="border rounded-xl px-3 py-2 text-xs outline-none" />
            <input type="text" value={formData.ip} onChange={(e) => setFormData({...formData, ip: e.target.value})} placeholder="Local IP" className="border rounded-xl px-3 py-2 text-xs outline-none" />
            <input type="text" value={formData.mac} onChange={(e) => setFormData({...formData, mac: e.target.value})} placeholder="MAC Address" className="border rounded-xl px-3 py-2 text-xs outline-none" />
          </div>
          <button onClick={handleAddOrEdit} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs transition">
            {editingId ? 'Simpan Perubahan Database' : 'Tambah / Daftarkan Perangkat'}
          </button>
        </div>

        {/* UTILITY BAR: SEARCH, EXPORT, IMPORT */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input 
              type="text" 
              placeholder="Cari laptop berdasarkan nama, serial, IP, wifi..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl bg-white text-xs font-medium focus:outline-none shadow-sm"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto justify-end">
            <button onClick={exportToJSON} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition">
              <Download className="w-3.5 h-3.5" /> Export Data
            </button>
            <label className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Import Data
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>
        </div>

        {/* UTAMA: LIST PERANGKAT DARI DATABASE PERMANEN */}
        <div className="space-y-3">
          {filteredDevices.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl text-center py-12 text-slate-400 text-xs">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              Tidak ada perangkat di database. Jalankan client.exe untuk sinkronisasi otomatis.
            </div>
          ) : (
            filteredDevices.map((device) => (
              <div key={device.serial} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-sm transition hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${device.isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-sm text-slate-900">{device.name || "Perangkat Otomatis"}</h3>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${device.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                        {device.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      Serial: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded font-bold text-slate-700">{device.serial}</span> 
                      <span className="mx-1.5">•</span> Model: <span className="font-semibold">{device.model || '-'}</span>
                    </p>
                  </div>
                </div>

                {/* Detail Spek Perangkat yang Tersimpan */}
                <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl w-full lg:w-auto">
                  <div><span className="text-slate-400">IP:</span> <span className="font-mono text-slate-800">{device.ip || '-'}</span></div>
                  <div><span className="text-slate-400">MAC:</span> <span className="font-mono text-slate-800">{device.mac || '-'}</span></div>
                  <div><span className="text-slate-400">WiFi:</span> <span className="text-slate-800">{device.wifi || '-'}</span></div>
                </div>

                {/* Aksi Kontrol */}
                <div className="flex items-center gap-2 w-full lg:w-auto justify-end border-t border-slate-100 pt-3 lg:pt-0 lg:border-t-0">
                  <button
                    onClick={() => toggleAhk(device)}
                    disabled={!device.isOnline}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                      !device.isOnline 
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' 
                        : device.ahkEnabled 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-rose-600 text-white'
                    }`}
                  >
                    {device.ahkEnabled ? 'AHK ACTIVE 🟢' : 'AHK INACTIVE 🔴'}
                  </button>
                  <button onClick={() => { setFormData(device); setEditingId(device.serial); }} className="px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50">Edit</button>
                  <button onClick={() => handleDelete(device.serial)} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg bg-slate-900">
          {toast.msg}
        </div>
      )}
    </div>
  );
}