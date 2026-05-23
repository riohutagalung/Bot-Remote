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
    name: '',
    model: '',
    serial: '',
    uuid: '',
    hostname: '',
    username: '',
    wifi: '',
    bssid: '',
    ip: '',
    publicIp: '',
    mac: '',
    channel: '',
    securityType: 'WPA2-Enterprise',
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

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
    }
  }, [devices, isAuthenticated]);

  useEffect(() => {
    const updateWifiStatus = () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      setWifiStatus({
        connected: navigator.onLine,
        type: connection?.effectiveType || 'unknown',
      });
    };

    updateWifiStatus();
    window.addEventListener('online', updateWifiStatus);
    window.addEventListener('offline', updateWifiStatus);
    const interval = setInterval(updateWifiStatus, 5000);

    return () => {
      window.removeEventListener('online', updateWifiStatus);
      window.removeEventListener('offline', updateWifiStatus);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setSessionTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Ambil data remote device pertama kali dan fallback berkala (HTTP polling)
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
    const interval = setInterval(fetchRemoteDevices, 4000); // Sinkronisasi otomatis tiap 4 detik
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Handle Koneksi Real-time WebSocket
  useEffect(() => {
    if (!isAuthenticated) return;

    let ws;
    const connectWS = () => {
      try {
        ws = new WebSocket(BACKEND_WS);
        wsRef.current = ws;
      } catch (error) {
        setWsError(error.message || 'WebSocket initialization failed');
        setWsConnected(false);
        return;
      }

      ws.onopen = () => {
        setWsConnected(true);
        setWsError(null);
        showToast('Connected to control server');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Menerima broadcast list device online dari server.js yang baru
          if (data.type === 'device_list') {
            setRemoteDevices(data.devices || []);
          }
        } catch (error) {
          console.error('WebSocket parse error:', error);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(() => {
          if (isAuthenticated) {
            connectWS(); // Auto reconnect jika putus
          }
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsError('WebSocket error');
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
    };
  }, [isAuthenticated]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = () => {
    if (passwordInput === PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify({ token: Math.random().toString(36).substring(2) }));
      setIsAuthenticated(true);
      setPasswordInput('');
      showToast('Login successful!');
    } else {
      showToast('Invalid password', 'error');
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      sessionStorage.removeItem(AUTH_KEY);
      setIsAuthenticated(false);
      setDevices([]);
      showToast('Logged out successfully');
    }
  };

  // FUNGSI MATCHING DIKOREKSI: Mencocokkan isi ID dari server (serial-mac-wifi) dengan Serial Number web
  const remoteDeviceMatch = (webDevice) => {
    if (!webDevice.serial) return null;
    return remoteDevices.find((remote) => {
      return remote.id.toLowerCase().includes(webDevice.serial.toLowerCase().trim());
    });
  };

  // Kirim perintah AHK ke backend API
  const sendCommand = async (deviceId, command) => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, command }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Command failed');
      showToast(`Perintah '${command}' berhasil dikirim!`, 'success');
      return true;
    } catch (error) {
      showToast(`Gagal mengirim perintah: ${error.message}`, 'error');
      return false;
    }
  };

  const toggleAhk = async (device) => {
    const remote = remoteDeviceMatch(device);
    if (!remote) {
      showToast('Laptop tidak terdeteksi online di backend', 'error');
      return;
    }

    // Ambil status dari data remote asli server, jika true maka stop, jika false maka start
    const command = remote.ahkEnabled ? 'stop_ahk' : 'start_ahk';
    await sendCommand(remote.id, command);
    
    // Refresh instan data remote
    setTimeout(fetchRemoteDevices, 500);
  };

  const handleAddDevice = () => {
    if (!formData.name || !formData.serial) {
      showToast('Laptop Name and Serial Number are required', 'error');
      return;
    }

    if (editingId) {
      setDevices((prev) => prev.map((d) => (d.id === editingId ? { ...formData, id: editingId } : d)));
      setEditingId(null);
      showToast('Device updated successfully');
    } else {
      setDevices((prev) => [
        ...prev,
        {
          ...formData,
          id: Date.now(),
          lastSeen: new Date().toLocaleString(),
        },
      ]);
      showToast('Device added successfully');
    }

    setFormData({
      name: '', model: '', serial: '', uuid: '', hostname: '', username: '',
      wifi: '', bssid: '', ip: '', publicIp: '', mac: '', channel: '', securityType: 'WPA2-Enterprise',
    });
  };

  const handleEdit = (device) => {
    setFormData(device);
    setEditingId(device.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
    setShowDeleteConfirm(null);
    showToast('Device deleted');
  };

  const parseCmdOutput = () => {
    const lines = cmdInput.split('\n');
    const parsed = { ...formData };

    lines.forEach((line) => {
      const lower = line.toLowerCase();
      if (lower.includes('serialnumber')) {
        const value = line.split('=')[1]?.trim() || line.replace(/serialnumber/i, '').trim();
        if (value && !value.includes('SerialNumber')) parsed.serial = value;
      }
      if (lower.includes('uuid')) {
        const value = line.split('=')[1]?.trim() || line.replace(/uuid/i, '').trim();
        if (value && !value.includes('UUID')) parsed.uuid = value;
      }
      if (lower.includes('hostname')) {
        const value = line.split(/=|:/)[1]?.trim();
        if (value) parsed.hostname = value;
      }
      if (lower.includes('username') || lower.includes('user name')) {
        const value = line.split(/=|:/)[1]?.trim();
        if (value) parsed.username = value;
      }
      if (lower.includes('ipv4 address')) {
        const match = line.match(/\d+\.\d+\.\d+\.\d+/);
        if (match) parsed.ip = match[0];
      }
      if (lower.includes('physical address')) {
        const match = line.match(/([0-9A-F]{2}[:-]){5}[0-9A-F]{2}/i);
        if (match) parsed.mac = match[0];
      }
      if (lower.includes('ssid') && !lower.includes('bssid')) {
        const value = line.split(':')[1]?.trim();
        if (value) parsed.wifi = value;
      }
    });

    setFormData(parsed);
    setShowCmdModal(false);
    setCmdInput('');
    showToast('CMD output parsed successfully');
  };

  const exportJson = () => {
    const json = JSON.stringify(devices, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rh-devices-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Devices exported successfully');
  };

  const importJson = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          setDevices(imported);
          showToast('Devices imported successfully');
        }
      } catch {
        showToast('Failed to import JSON', 'error');
      }
    };
    reader.readAsText(file);
  };

  const filtered = useMemo(
    () => devices.filter((d) => Object.values(d).join(' ').toLowerCase().includes(searchQuery.toLowerCase())),
    [devices, searchQuery]
  );

  const stats = {
    total: devices.length,
    online: devices.filter((d) => remoteDeviceMatch(d)).length,
    offline: devices.filter((d) => !remoteDeviceMatch(d)).length,
    ahkEnabled: remoteDevices.filter((rd) => rd.ahkEnabled).length,
  };

  if (!authChecked) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Memeriksa...</div>;

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
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition">Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">RH Control Center</h1>
          <p className="text-xs text-slate-500">System Monitoring & AutoHotkey Remote</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full border text-xs font-medium">
            <div className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {wsConnected ? 'WS Connected' : 'WS Disconnected'}
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Terdaftar', value: stats.total, bg: 'bg-blue-600' },
            { label: 'Laptop Online', value: stats.online, bg: 'bg-green-600' },
            { label: 'Laptop Offline', value: stats.offline, bg: 'bg-red-600' },
            { label: 'AHK Sedang Aktif', value: stats.ahkEnabled, bg: 'bg-purple-600' },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} text-white p-4 rounded-xl shadow-sm`}>
              <p className="text-xs font-medium opacity-80">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* INPUT FORM */}
        <div className="card space-y-4">
          <h2 className="text-lg font-bold">{editingId ? '✏️ Edit Device' : '➕ Add / Setup Laptop'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { key: 'name', label: 'Laptop Name *' },
              { key: 'serial', label: 'Serial Number (BIOS) *' },
              { key: 'model', label: 'Model' },
              { key: 'wifi', label: 'WiFi SSID' },
              { key: 'ip', label: 'Local IP' },
              { key: 'mac', label: 'MAC Address' },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs font-semibold block mb-1 text-slate-600">{f.label}</label>
                <input
                  type="text"
                  value={formData[f.key]}
                  onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded-lg text-sm"
                  placeholder={f.label}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddDevice} className="btn btn-primary text-sm py-1.5 flex-1">{editingId ? 'Update' : 'Add Device'}</button>
            <button onClick={() => setShowCmdModal(true)} className="btn btn-outline text-sm py-1.5">Import CMD</button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search laptops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border rounded-xl bg-white shadow-sm text-sm"
          />
        </div>

        {/* LAPTOP LIST */}
        <div className="space-y-3">
          {filtered.map((device) => {
            const remote = remoteDeviceMatch(device);
            // Ambil data status AHK yang live dari server, jika offline pakai default false
            const isAhkLive = remote ? remote.ahkEnabled : false;

            return (
              <div key={device.id} className="card flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900">{device.name}</h3>
                    <div className={`w-2.5 h-2.5 rounded-full ${remote ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs font-semibold text-slate-500">{remote ? 'Online' : 'Offline'}</span>
                  </div>
                  <p className="text-xs text-slate-500">Serial: <span className="font-mono bg-slate-100 px-1 rounded">{device.serial}</span></p>
                  {remote && <p className="text-xs text-blue-600 font-medium">Connected as: {remote.id}</p>}
                </div>

                <div className="text-xs text-slate-600 space-y-0.5">
                  <p><strong>IP:</strong> {remote?.info?.ip || device.ip || '-'}</p>
                  <p><strong>MAC:</strong> {remote?.info?.mac || device.mac || '-'}</p>
                  <p><strong>WiFi:</strong> {remote?.info?.wifi || device.wifi || '-'}</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto justify-end">
                  <button
                    onClick={() => toggleAhk(device)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      !remote 
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                        : isAhkLive 
                        ? 'bg-green-500 text-white hover:bg-green-600 shadow-sm' 
                        : 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
                    }`}
                    disabled={!remote}
                  >
                    {isAhkLive ? 'AHK: ON 🟢' : 'AHK: OFF 🔴'}
                  </button>
                  <button onClick={() => handleEdit(device)} className="px-3 py-1.5 border rounded-lg text-xs hover:bg-slate-50">Edit</button>
                  <button onClick={() => handleDelete(device.id)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL IMPORT */}
      {showCmdModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-xl space-y-3">
            <h3 className="font-bold text-lg">Paste Output CMD Windows</h3>
            <textarea
              value={cmdInput}
              onChange={(e) => setCmdInput(e.target.value)}
              className="w-full h-48 p-3 border rounded-xl font-mono text-xs bg-slate-50"
              placeholder="Paste data di sini..."
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCmdModal(false)} className="btn btn-outline text-xs">Cancel</button>
              <button onClick={parseCmdOutput} className="btn btn-primary text-xs">Parse & Isi</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.msg}</div>}
    </div>
  );
}