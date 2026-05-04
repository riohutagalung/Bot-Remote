import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Download, Upload, Trash2, Check, X, Copy, AlertCircle } from 'lucide-react';

const STORAGE_KEY = 'rh-house-devices';

export default function App() {
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
  const [showCmdModal, setShowCmdModal] = useState(false);
  const [cmdInput, setCmdInput] = useState('');
  const [toast, setToast] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Load devices from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setDevices(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load devices:', e);
      }
    }
  }, []);

  // Save devices to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  }, [devices]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = useMemo(
    () =>
      devices.filter((d) =>
        Object.values(d).join(' ').toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [devices, searchQuery]
  );

  const stats = {
    total: devices.length,
    online: devices.filter((d) => d.connected).length,
    offline: devices.filter((d) => !d.connected).length,
    ahkEnabled: devices.filter((d) => d.ahkEnabled).length,
  };

  const handleAddDevice = () => {
    if (!formData.name || !formData.serial) {
      showToast('Laptop Name and Serial Number are required', 'error');
      return;
    }

    if (editingId) {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === editingId ? { ...formData, id: editingId } : d
        )
      );
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

  const toggleConnection = (id) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, connected: !d.connected, lastSeen: new Date().toLocaleString() } : d
      )
    );
  };

  const toggleAhk = (id) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ahkEnabled: !d.ahkEnabled } : d))
    );
  };

  const parseCmdOutput = () => {
    const lines = cmdInput.split('\n');
    const data = { ...formData };

    lines.forEach((line) => {
      const lower = line.toLowerCase();

      if (lower.includes('serialnumber')) {
        const match = line.split('=')[1]?.trim();
        if (match) data.serial = match;
      }
      if (lower.includes('uuid')) {
        const match = line.split('=')[1]?.trim();
        if (match) data.uuid = match;
      }
      if (lower.includes('hostname')) {
        const match = line.split('=')[1]?.trim() || line.split(':')[1]?.trim();
        if (match) data.hostname = match;
      }
      if (lower.includes('username') || lower.includes('user name')) {
        const match = line.split('=')[1]?.trim() || line.split(':')[1]?.trim();
        if (match) data.username = match;
      }
      if (lower.includes('ipv4 address')) {
        const match = line.match(/\d+\.\d+\.\d+\.\d+/);
        if (match && !data.ip) data.ip = match[0];
      }
      if (lower.includes('physical address')) {
        const match = line.match(/([0-9A-F]{2}[:-]){5}([0-9A-F]{2})/i);
        if (match && !data.mac) data.mac = match[0];
      }
      if (lower.includes('ssid') || lower.includes('network name')) {
        const match = line.split(':')[1]?.trim();
        if (match) data.wifi = match;
      }
      if (lower.includes('bssid')) {
        const match = line.match(/([0-9A-F]{2}[:-]){5}([0-9A-F]{2})/i);
        if (match) data.bssid = match[0];
      }
    });

    setFormData(data);
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

  const importJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          setDevices(imported);
          showToast('Devices imported successfully');
        } else {
          showToast('Invalid JSON format', 'error');
        }
      } catch (err) {
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
    if (
      window.confirm(
        'Are you sure you want to delete ALL devices? This action cannot be undone.'
      )
    ) {
      setDevices([]);
      showToast('All devices cleared');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                RH House Control Center
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Manage AutoHotkey status across registered laptops
              </p>
              <div className="mt-2">
                <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                  Vercel Ready
                </span>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-sm ml-8">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search devices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-slate-600">Total Devices</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{stats.total}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-600">Online</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats.online}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-600">Offline</p>
            <p className="text-3xl font-bold text-red-600 mt-2">{stats.offline}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-600">AHK Enabled</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats.ahkEnabled}</p>
          </div>
        </div>

        {/* Add Device Form */}
        <div className="card space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {editingId ? 'Edit Device' : 'Add / Setup Laptop'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {editingId ? 'Update device information' : 'Add a new device to monitor'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { key: 'name', label: 'Laptop Name' },
              { key: 'model', label: 'Model' },
              { key: 'serial', label: 'Serial Number BIOS' },
              { key: 'uuid', label: 'Machine UUID' },
              { key: 'hostname', label: 'Hostname' },
              { key: 'username', label: 'Windows Username' },
              { key: 'wifi', label: 'WiFi SSID' },
              { key: 'bssid', label: 'BSSID / Router MAC' },
              { key: 'ip', label: 'Local IP' },
              { key: 'publicIp', label: 'Public IP (opt)' },
              { key: 'mac', label: 'MAC Address' },
              { key: 'channel', label: 'Network Channel' },
              { key: 'securityType', label: 'Security Type' },
            ].map(({ key, label }) => (
              <input
                key={key}
                type="text"
                placeholder={label}
                value={formData[key]}
                onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleAddDevice}
              className="btn btn-primary"
            >
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
                className="btn btn-outline btn-sm"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => setShowCmdModal(true)}
              className="btn btn-outline"
            >
              Paste CMD Result
            </button>
            <button onClick={copyToClipboard} className="btn btn-outline">
              <Copy className="w-4 h-4 mr-2" />
              Copy Data
            </button>
            <button onClick={exportJson} className="btn btn-outline">
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </button>
            <label className="btn btn-outline cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              Import JSON
              <input
                type="file"
                accept=".json"
                onChange={importJson}
                className="hidden"
              />
            </label>
            <button onClick={clearAll} className="btn btn-danger btn-sm ml-auto">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </button>
          </div>
        </div>

        {/* Device List */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="card text-center py-12">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">
                {devices.length === 0
                  ? 'No devices added yet. Add your first device above!'
                  : 'No devices match your search.'}
              </p>
            </div>
          ) : (
            filtered.map((device) => (
              <div key={device.id} className="card">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                  {/* Device Info */}
                  <div>
                    <h3 className="font-bold text-slate-900">{device.name}</h3>
                    <p className="text-sm text-slate-600">{device.model}</p>
                    <p className="text-xs text-slate-500 mt-2">Serial: {device.serial}</p>
                  </div>

                  {/* Identity */}
                  <div>
                    <p className="text-xs text-slate-600 font-semibold">IDENTITY</p>
                    <p className="text-sm text-slate-900 font-medium">{device.hostname}</p>
                    <p className="text-xs text-slate-600">{device.username || 'N/A'}</p>
                    <p className="text-xs text-slate-500 mt-1">UUID: {device.uuid?.slice(0, 12)}...</p>
                  </div>

                  {/* Network */}
                  <div>
                    <p className="text-xs text-slate-600 font-semibold">NETWORK</p>
                    <p className="text-sm text-slate-900">{device.wifi}</p>
                    <p className="text-xs text-slate-600">{device.ip}</p>
                    <p className="text-xs text-slate-500 mt-1">MAC: {device.mac}</p>
                  </div>

                  {/* Status */}
                  <div>
                    <p className="text-xs text-slate-600 font-semibold">STATUS</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          device.connected ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="text-sm font-medium">
                        {device.connected ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2">{device.lastSeen}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={() => toggleConnection(device.id)}
                      className={`btn btn-sm ${
                        device.connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {device.connected ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => toggleAhk(device.id)}
                      className={`btn btn-sm ${
                        device.ahkEnabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}
                      title="Toggle AHK"
                    >
                      {device.ahkEnabled ? 'AHK ON' : 'AHK OFF'}
                    </button>
                    <button
                      onClick={() => handleEdit(device)}
                      className="btn btn-outline btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(device.id)}
                      className="btn btn-danger btn-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation */}
                {showDeleteConfirm === device.id && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                    <p className="text-sm text-red-700">
                      Confirm deletion of "{device.name}"?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(device.id)}
                        className="btn btn-danger btn-sm"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="btn btn-outline btn-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* CMD Modal */}
      {showCmdModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 space-y-4">
            <h2 className="text-xl font-bold">Paste CMD Output</h2>
            <p className="text-sm text-slate-600">
              Run these commands in Windows CMD and paste the output below:
            </p>
            <pre className="bg-slate-100 p-3 rounded text-xs overflow-auto max-h-40">
{`wmic bios get serialnumber
wmic csproduct get uuid
hostname
echo %username%
ipconfig /all
netsh wlan show interfaces`}
            </pre>
            <textarea
              value={cmdInput}
              onChange={(e) => setCmdInput(e.target.value)}
              placeholder="Paste CMD output here..."
              className="w-full h-40 p-3 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCmdModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button onClick={parseCmdOutput} className="btn btn-primary">
                Parse & Fill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
