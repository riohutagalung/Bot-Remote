import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Eye, 
  EyeOff, 
  Wifi, 
  WifiOff, 
  LogOut, 
  Plus, 
  Copy, 
  Download, 
  Upload, 
  Trash2, 
  AlertCircle 
} from 'lucide-react';

const STORAGE_KEY = 'rh-house-devices';
const AUTH_KEY = 'rh-auth-session';
const PASSWORD = import.meta.env.VITE_PASSWORD || 'Taikbabi182#';
const BACKEND_HTTP = "https://bot-remote-production.up.railway.app";
const BACKEND_WS = "wss://bot-remote-production.up.railway.app";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [devices, setDevices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '', model: '', serial: '', uuid: '', hostname: '', username: '',
    wifi: '', bssid: '', ip: '', publicIp: '', mac: '', channel: '', securityType: 'WPA2-Enterprise',
  });

  const [remoteDevices, setRemoteDevices] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState(null);

  const [showCmdModal, setShowCmdModal] = useState(false);
  const [cmdInput, setCmdInput] = useState('');
  const [toast, setToast] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [wifiStatus, setWifiStatus] = useState({ connected: false, type: 'unknown' });
  const [sessionTime, setSessionTime] = useState(new Date());

  const wsRef = useRef(null);

  // 1. Ambil sesi Auth
  useEffect(() => {
    const auth = sessionStorage.getItem(AUTH_KEY);
    if (auth) {
      try {
        const { token } = JSON.parse(auth);
        if (token) setIsAuthenticated(true);
      } catch {
        sessionStorage.removeItem(AUTH_KEY);
      }
    }
    setAuthChecked(true);
  }, []);

  // 2. Load devices manual yang pernah disimpan di LocalStorage
  useEffect(() => {
    if (!isAuthenticated) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setDevices(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load devices:', error);
      }
    }
  }, [isAuthenticated]);

  // 3. Simpan devices manual ke LocalStorage jika ada perubahan
  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
    }
  }, [devices, isAuthenticated]);

  // 4. Sinkronisasi Data dari Backend (HTTP Polling Cadangan)
  const fetchRemoteDevices = async () => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/devices`);
      if (!res.ok) throw new Error('Failed to fetch remote devices');
      const data = await res.json();
      setRemoteDevices(data);
    } catch (error) {
      console.warn('Remote device fetch failed:', error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchRemoteDevices();
    const interval = setInterval(fetchRemoteDevices, 3000); // Cek tiap 3 detik
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // 5. Koneksi WebSocket untuk Broadcast Real-time
  useEffect(() => {
    if (!isAuthenticated) return;

    let ws;
    const connectWS = () => {
      try {
        ws = new WebSocket(BACKEND_WS);
        wsRef.current = ws;
      } catch (error) {
        setWsError(error.message || 'WebSocket failed');
        setWsConnected(false);
        return;
      }

      ws.onopen = () => {
        setWsConnected(true);
        setWsError(null);
        showToast('Terhubung ke live server backend');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'device_list') {
            setRemoteDevices(data.devices || []);
          }
        } catch (error) {
          console.error('WebSocket parse error:', error);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(() => { if (isAuthenticated) connectWS(); }, 5000);
      };
    };

    connectWS();
    return () => { if (ws) ws.close(); };
  }, [isAuthenticated]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  // --- LOGIC UNTUK SINKRONISASI OTOMATIS + MANUAL ---
  // Menggabungkan device hasil ketik manual dengan device yang OTOMATIS masuk dari client.exe
  const allDevicesMerged = useMemo(() => {
    // Salin data manual dari state
    const currentManualDevices = [...devices];

    // Iterasi semua laptop yang terdeteksi online di server backend saat ini
    remoteDevices.forEach((remote) => {
      // Cek apakah device online ini sudah terdaftar di list manual lewat serial number
      const isAlreadyAdded = currentManualDevices.some(
        (d) => d.serial && remote.id.toLowerCase().includes(d.serial.toLowerCase().trim())
      );

      // JIKA BELUM TERDAFTAR MANUAL -> MASUKKAN OTOMATIS SEBAGAI DATA BARU
      if (!isAlreadyAdded) {
        currentManualDevices.push({
          id: `auto-${remote.id}`,
          name: remote.info?.hostname || `Auto Device (${remote.info?.username || 'Unknown'})`,
          model: remote.info?.model || 'PC Target',
          serial: remote.info?.serial || remote.id,
          wifi: remote.info?.wifi || '-',
          ip: remote.info?.ip || '-',
          mac: remote.info?.mac || '-',
          isAutomatic: true, // penanda data masuk otomatis tanpa form
          lastSeen: new Date(remote.lastSeen).toLocaleString()
        });
      }
    });

    return currentManualDevices;
  }, [devices, remoteDevices]);

  // Fungsi mencocokan untuk status lampu online/offline
  const remoteDeviceMatch = (webDevice) => {
    if (!webDevice.serial) return null;
    return remoteDevices.find((remote) => 
      remote.id.toLowerCase().includes(webDevice.serial.toLowerCase().trim())
    );
  };

  const sendCommand = async (deviceId, command) => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, command }),
      });
      if (!res.ok) throw new Error('Command failed');
      showToast(`Perintah '${command}' dikirim ke laptop!`, 'success');
      return true;
    } catch (error) {
      showToast(`Gagal mengirim perintah: ${error.message}`, 'error');
      return false;
    }
  };

  const toggleAhk = async (device) => {
    const remote = remoteDeviceMatch(device);
    if (!remote) {
      showToast('Laptop sedang offline', 'error');
      return;
    }
    const command = remote.ahkEnabled ? 'stop_ahk' : 'start_ahk';
    await sendCommand(remote.id, command);
    setTimeout(fetchRemoteDevices, 500);
  };

  // Handle sisa fungsi input manual bawaan
  const handleAddDevice = () => {
    if (!formData.name || !formData.serial) {
      showToast('Laptop Name & Serial Number wajib diisi!', 'error');
      return;
    }
    if (editingId) {
      setDevices((prev) => prev.map((d) => (d.id === editingId ? { ...formData, id: editingId } : d)));
      setEditingId(null);
    } else {
      setDevices((prev) => [...prev, { ...formData, id: Date.now(), lastSeen: new Date().toLocaleString() }]);
    }
    setFormData({ name: '', model: '', serial: '', uuid: '', hostname: '', username: '', wifi: '', bssid: '', ip: '', publicIp: '', mac: '', channel: '', securityType: 'WPA2-Enterprise' });
    showToast('Device berhasil disimpan manual');
  };

  const handleEdit = (device) => {
    setFormData(device);
    setEditingId(device.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (id.toString().startsWith('auto-')) {
      showToast('Data otomatis tidak bisa dihapus selama client.exe aktif!', 'error');
      return;
    }
    setDevices((prev) => prev.filter((d) => d.id !== id));
    setShowDeleteConfirm(null);
  };

  const filtered = useMemo(() => 
    allDevicesMerged.filter((d) => Object.values(d).join(' ').toLowerCase().includes(searchQuery.toLowerCase())),
    [allDevicesMerged, searchQuery]
  );

  // Autentikasi UI Handlers
  const handleLogin = () => {
    if (passwordInput === PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify({ token: 'authenticated' }));
      setIsAuthenticated(true);
    } else {
      showToast('Password salah!', 'error');
    }
    setPasswordInput('');
  };

  if (!authChecked) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Memuat Sistem...</div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-md border border-slate-700 space-y-4 shadow-xl">
          <h1 className="text-2xl font-bold text-white text-center">RH Control Login</h1>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Enter password"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition">Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">RH Control Center</h1>
          <p className="text-xs text-slate-500">Live Client Data Integration (Automatic + Manual)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium border">
            <div className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {wsConnected ? 'Live Connection Active' : 'Connecting to Live Server'}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* INPUT MANUAL FORM (TETAP DIJAGA AGAR BISA DUA-DUANYA) */}
        <div className="card space-y-4">
          <h2 className="text-lg font-bold">{editingId ? '✏️ Edit Manual Device' : '➕ Tambah Device Manual (Opsional)'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="px-3 py-1.5 border rounded-lg text-sm" placeholder="Nama Laptop Custom" />
            <input type="text" value={formData.serial} onChange={(e) => setFormData({ ...formData, serial: e.target.value })} className="px-3 py-1.5 border rounded-lg text-sm" placeholder="Serial Number (Wajib)" />
            <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="px-3 py-1.5 border rounded-lg text-sm" placeholder="Model (Opsional)" />
          </div>
          <button onClick={handleAddDevice} className="btn btn-primary text-xs w-full py-2">Simpan Perangkat Manual</button>
        </div>

        {/* SEARCH BAR */}
        <input type="text" placeholder="Cari nama laptop, serial atau IP..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-4 py-2 border rounded-xl bg-white text-sm shadow-sm" />

        {/* LAPTOP LIST (AUTOMATIC LIVE DETECTION) */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="card text-center py-12 text-slate-500 text-sm">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Belum ada laptop yang aktif. Silakan jalankan <strong>client.exe</strong> di laptop target.
            </div>
          ) : (
            filtered.map((device) => {
              const remote = remoteDeviceMatch(device);
              const isAhkLive = remote ? remote.ahkEnabled : false;

              return (
                <div key={device.id} className={`card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 ${device.isAutomatic ? 'border-l-blue-500 bg-blue-50/20' : 'border-l-slate-400'}`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-slate-900">{device.name}</h3>
                      {device.isAutomatic && <span className="bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded text-[10px]">OTOMATIS</span>}
                      <div className={`w-2.5 h-2.5 rounded-full ${remote ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-xs font-semibold text-slate-500">{remote ? 'Online' : 'Offline'}</span>
                    </div>
                    <p className="text-xs text-slate-500">Serial/ID: <span className="font-mono bg-slate-100 px-1 rounded">{device.serial}</span></p>
                  </div>

                  <div className="text-xs text-slate-600 grid grid-cols-3 gap-x-4 gap-y-0.5">
                    <p><strong>IP:</strong> {device.ip}</p>
                    <p><strong>MAC:</strong> {device.mac}</p>
                    <p><strong>WiFi:</strong> {device.wifi}</p>
                  </div>

                  <div className="flex gap-2 w-full md:w-auto justify-end">
                    <button
                      onClick={() => toggleAhk(device)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        !remote ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                        isAhkLive ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-red-500 text-white hover:bg-red-600'
                      }`}
                      disabled={!remote}
                    >
                      {isAhkLive ? 'AHK: ON 🟢' : 'AHK: OFF 🔴'}
                    </button>
                    {!device.isAutomatic && (
                      <>
                        <button onClick={() => handleEdit(device)} className="px-2.5 py-1.5 border rounded-lg text-xs hover:bg-slate-50">Edit</button>
                        <button onClick={() => handleDelete(device.id)} className="px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100">Hapus</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
      {toast && <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.msg}</div>}
    </div>
  );
}