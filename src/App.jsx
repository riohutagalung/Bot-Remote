import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, Download, Upload, Trash2, Check, X, Copy, AlertCircle, LogOut, Wifi, WifiOff, Eye, EyeOff } from 'lucide-react';

const STORAGE_KEY = 'rh-house-devices';
const AUTH_KEY = 'rh-auth-session';
const PASSWORD = import.meta.env.VITE_PASSWORD || 'Taikbabi182#';
const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || 'http://localhost:3001';
const BACKEND_WS = import.meta.env.VITE_BACKEND_WS || 'ws://localhost:3003';

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

  useEffect(() => {
    if (!isAuthenticated) return;

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

    fetchRemoteDevices();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let ws;
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
      ws.send(JSON.stringify({ type: 'request_device_list' }));
      showToast('Connected to control server');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'device_list') {
          setRemoteDevices(data.devices || []);
        } else if (data.type === 'registered') {
          showToast(`Device registered: ${data.deviceId}`);
        } else if (data.type === 'command_sent') {
          showToast(`Perintah dikirim ke ${data.targetDeviceId}`, 'success');
        } else if (data.type === 'error') {
          showToast(data.message || 'Server error', 'error');
        }
      } catch (error) {
        console.error('WebSocket parse error:', error);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setTimeout(() => {
        if (isAuthenticated) {
          showToast('Reconnecting to control server...', 'error');
          setWsConnected(false);
        }
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsError('WebSocket error');
    };

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
      setFormData({
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
      showToast('Logged out successfully');
    }
  };

  const remoteDeviceMatch = (device) =>
    remoteDevices.find((d) => d.id === device.serial || d.id === device.id || d.serial === device.serial);

  const sendCommand = async (deviceId, command) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'command', targetDeviceId: deviceId, command }));
      return true;
    }

    try {
      const res = await fetch(`${BACKEND_HTTP}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, command }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Command failed');
      return true;
    } catch (error) {
      showToast(`Remote command failed: ${error.message}`, 'error');
      return false;
    }
  };

  const toggleAhk = async (device) => {
    const remote = remoteDeviceMatch(device);
    if (!remote) {
      showToast('Device not connected to backend', 'error');
      return;
    }

    const command = remote.ahkEnabled ? 'stop_ahk' : 'start_ahk';
    const success = await sendCommand(remote.id, command);
    if (success) {
      setDevices((prev) => prev.map((d) => (d.id === device.id ? { ...d, ahkEnabled: !d.ahkEnabled } : d)));
    }
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
          connected: false,
          ahkEnabled: false,
          lastSeen: new Date().toLocaleString(),
        },
      ]);
      showToast('Device added successfully');
    }

    setFormData({
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
        const value = line.split('=')[1]?.trim();
        if (value) parsed.serial = value;
      }
      if (lower.includes('uuid')) {
        const value = line.split('=')[1]?.trim();
        if (value) parsed.uuid = value;
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
      if (lower.includes('ssid')) {
        const value = line.split(':')[1]?.trim();
        if (value) parsed.wifi = value;
      }
      if (lower.includes('bssid')) {
        const match = line.match(/([0-9A-F]{2}[:-]){5}[0-9A-F]{2}/i);
        if (match) parsed.bssid = match[0];
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
        } else {
          showToast('Invalid JSON format', 'error');
        }
      } catch {
        showToast('Failed to import JSON', 'error');
      }
    };
    reader.readAsText(file);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(devices, null, 2));
    showToast('Copied to clipboard');
  };

  const clearAll = () => {
    if (window.confirm('Are you sure you want to delete ALL devices? This action cannot be undone.')) {
      setDevices([]);
      showToast('All devices cleared');
    }
  };

  const filtered = useMemo(
    () =>
      devices.filter((device) =>
        Object.values(device).join(' ').toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [devices, searchQuery]
  );

  const stats = {
    total: devices.length,
    online: devices.filter((device) => remoteDeviceMatch(device)).length,
    offline: devices.filter((device) => !remoteDeviceMatch(device)).length,
    ahkEnabled: devices.filter((device) => device.ahkEnabled).length,
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Memeriksa autentikasi...</p>
          <p className="text-sm text-slate-400">Silakan tunggu sebentar.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
          </div>
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-white">RH Control</h1>
              <p className="text-slate-400">House Device Management</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    placeholder="Enter password"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleLogin}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg transition"
              >
                Login
              </button>
            </div>

            <div className="text-center text-sm text-slate-400">
              <p>Secure access to remote device management</p>
            </div>
          </div>
        </div>
        {toast && (
          <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.msg}</div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b-2 border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">RH Control Center</h1>
              <p className="text-sm text-slate-600 mt-1">Remote AutoHotkey device manager</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                {wifiStatus.connected ? (
                  <>
                    <Wifi className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium text-green-700">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5 text-red-500" />
                    <span className="text-sm font-medium text-red-700">Offline</span>
                  </>
                )}
              </div>
              <div className="text-sm text-slate-600">{sessionTime.toLocaleTimeString()}</div>
              <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition">
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Devices', value: stats.total, color: 'from-blue-500 to-blue-600', icon: '📊' },
            { label: 'Connected Remote', value: stats.online, color: 'from-green-500 to-green-600', icon: '🔌' },
            { label: 'Disconnected', value: stats.offline, color: 'from-red-500 to-red-600', icon: '⚠️' },
            { label: 'AHK Enabled', value: stats.ahkEnabled, color: 'from-purple-500 to-purple-600', icon: '⚙️' },
          ].map((stat, idx) => (
            <div key={idx} className={`card bg-gradient-to-br ${stat.color} text-white shadow-lg`}>
              <p className="text-sm font-medium opacity-90">{stat.label}</p>
              <p className="text-4xl font-bold mt-3">{stat.value}</p>
              <p className="text-sm opacity-75 mt-2">{stat.icon}</p>
            </div>
          ))}
        </div>

        <div className="card space-y-6 shadow-lg border-2 border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{editingId ? '✏️ Edit Device' : '➕ Add / Setup Laptop'}</h2>
            <p className="text-sm text-slate-600 mt-2">{editingId ? 'Update device information' : 'Add a new device to monitor and control remotely'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { key: 'name', label: 'Laptop Name', required: true },
              { key: 'model', label: 'Model' },
              { key: 'serial', label: 'Serial Number (BIOS)', required: true },
              { key: 'uuid', label: 'Machine UUID' },
              { key: 'hostname', label: 'Hostname' },
              { key: 'username', label: 'Windows Username' },
              { key: 'wifi', label: 'WiFi SSID' },
              { key: 'bssid', label: 'BSSID / Router MAC' },
              { key: 'ip', label: 'Local IP' },
              { key: 'publicIp', label: 'Public IP (optional)' },
              { key: 'mac', label: 'MAC Address' },
              { key: 'channel', label: 'Network Channel' },
            ].map(({ key, label, required }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {label} {required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  placeholder={label}
                  value={formData[key]}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Security Type</label>
              <select
                value={formData.securityType}
                onChange={(e) => setFormData({ ...formData, securityType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option>WPA2-Enterprise</option>
                <option>WPA3</option>
                <option>WPA2-Personal</option>
                <option>Open</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={handleAddDevice} className="btn btn-primary flex-1">
              <Plus className="w-4 h-4 mr-2" />
              {editingId ? 'Update Device' : 'Add Device'}
            </button>
            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setFormData({
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
                }}
                className="btn btn-outline"
              >
                Cancel
              </button>
            )}
            <button onClick={() => setShowCmdModal(true)} className="btn btn-outline flex-1">
              Import CMD Data
            </button>
          </div>

          <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2">
            <button onClick={copyToClipboard} className="btn btn-outline btn-sm">
              <Copy className="w-4 h-4 mr-2" />
              Copy Data JSON
            </button>
            <button onClick={exportJson} className="btn btn-outline btn-sm">
              <Download className="w-4 h-4 mr-2" />
              Export All
            </button>
            <label className="btn btn-outline btn-sm cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              Import JSON
              <input type="file" accept=".json" onChange={importJson} className="hidden" />
            </label>
            <button onClick={clearAll} className="btn btn-danger btn-sm ml-auto">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Devices
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="card text-center py-12">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">{devices.length === 0 ? 'No devices added yet. Add your first device above!' : 'No devices match your search.'}</p>
            </div>
          ) : (
            filtered.map((device) => {
              const remote = remoteDeviceMatch(device);
              return (
                <div key={device.id} className="card">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                    <div>
                      <h3 className="font-bold text-slate-900">{device.name}</h3>
                      <p className="text-sm text-slate-600">{device.model}</p>
                      <p className="text-xs text-slate-500 mt-2">Serial: {device.serial}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 font-semibold">NETWORK</p>
                      <p className="text-sm text-slate-900">{device.wifi}</p>
                      <p className="text-xs text-slate-600">{device.ip}</p>
                      <p className="text-xs text-slate-500 mt-1">MAC: {device.mac}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 font-semibold">STATUS</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className={`w-3 h-3 rounded-full ${remote ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm font-medium">{remote ? 'Online' : 'Offline'}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2">{device.lastSeen}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => toggleAhk(device)}
                        className={`btn btn-sm ${device.ahkEnabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}
                        disabled={!remote}
                        title={remote ? 'Toggle AHK state remotely' : 'Device not connected'}
                      >
                        {device.ahkEnabled ? 'AHK ON' : 'AHK OFF'}
                      </button>
                      <button onClick={() => handleEdit(device)} className="btn btn-outline btn-sm">Edit</button>
                      <button onClick={() => setShowDeleteConfirm(device.id)} className="btn btn-danger btn-sm">Delete</button>
                    </div>
                  </div>
                  {showDeleteConfirm === device.id && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                      <p className="text-sm text-red-700">Confirm deletion of "{device.name}"?</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleDelete(device.id)} className="btn btn-danger btn-sm">Delete</button>
                        <button onClick={() => setShowDeleteConfirm(null)} className="btn btn-outline btn-sm">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {showCmdModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 space-y-4">
            <h2 className="text-xl font-bold">Paste CMD Output</h2>
            <p className="text-sm text-slate-600">Run these commands in Windows CMD and paste the output below:</p>
            <pre className="bg-slate-100 p-3 rounded text-xs overflow-auto max-h-40">{`wmic bios get serialnumber\nwmic csproduct get uuid\nhostname\necho %username%\nipconfig /all\nnetsh wlan show interfaces`}</pre>
            <textarea
              value={cmdInput}
              onChange={(e) => setCmdInput(e.target.value)}
              placeholder="Paste CMD output here..."
              className="w-full h-40 p-3 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCmdModal(false)} className="btn btn-outline">Cancel</button>
              <button onClick={parseCmdOutput} className="btn btn-primary">Parse & Fill</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.msg}</div>
      )}
    </div>
  );
}
