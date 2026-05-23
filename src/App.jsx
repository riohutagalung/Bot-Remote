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
const PASS_TOKEN = import.meta.env.VITE_PASSWORD || 'Taikbabi182#';
const HTTP_URL = "https://bot-remote-production.up.railway.app";
const WS_URL = "wss://bot-remote-production.up.railway.app";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const [dbDevices, setDbDevices] = useState([]);
  const [liveOnlineDevices, setLiveOnlineDevices] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    name: '', serial: '', model: '', wifi: '', ip: '', mac: ''
  });
  const [editingId, setEditingId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const auth = sessionStorage.getItem(AUTH_KEY);
    if (auth) setIsAuthenticated(true);
    setAuthChecked(true);
  }, []);

  const fetchDevicesFromDatabase = async () => {
    try {
      const res = await fetch(`${HTTP_URL}/api/devices`);
      if (res.ok) {
        const data = await res.json();
        setDbDevices(Array.isArray(data) ? data : data.devices || []);
      }
    } catch (error) {
      console.error("Database connection synchronization failure:", error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchDevicesFromDatabase();
    const syncInterval = setInterval(fetchDevicesFromDatabase, 4000);
    return () => clearInterval(syncInterval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let ws;
    let reconnectTimeout;

    const connectTelemetryStream = () => {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setWsConnected(true);
        showToast('Telemetry control link pipeline operational');
      };

      ws.onmessage = async (event) => {
        try {
          const streamData = JSON.parse(event.data);
          if (streamData.type === 'device_list' || streamData.devices) {
            const activeStream = streamData.devices || [];
            setLiveOnlineDevices(activeStream);

            // LOGIC GATE: BACKEND PERSISTENT AUTO-SAVE PIPELINE
            for (const client of activeStream) {
              if (client && client.id) {
                const targetSerial = client.id.trim();
                const isAlreadyStored = dbDevices.some(
                  d => d.serial && d.serial.trim().toLowerCase() === targetSerial.toLowerCase()
                );

                if (!isAlreadyStored) {
                  await fetch(`${HTTP_URL}/api/devices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      serial: targetSerial,
                      name: client.info?.hostname || `Laptop-${targetSerial.slice(0, 5)}`,
                      model: client.info?.model || 'Windows Client',
                      wifi: client.info?.wifi || '-',
                      ip: client.info?.ip || '-',
                      mac: client.info?.mac || '-'
                    })
                  });
                  fetchDevicesFromDatabase();
                }
              }
            }
          }
        } catch (err) {
          console.error('Failed to parse network signaling packet:', err);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connectTelemetryStream, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectTelemetryStream();
    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, [isAuthenticated, dbDevices]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  const masterDeviceCluster = useMemo(() => {
    const activeMapping = new Map();
    liveOnlineDevices.forEach((live) => {
      if (!live || !live.id) return;
      activeMapping.set(live.id.trim().toLowerCase(), live);
    });

    return dbDevices.map(device => {
      if (!device || !device.serial) return null;
      const parsedKey = device.serial.trim().toLowerCase();
      const isLiveNow = activeMapping.has(parsedKey);
      const telemetricProfile = activeMapping.get(parsedKey);

      return {
        ...device,
        isOnline: isLiveNow,
        ahkEnabled: telemetricProfile ? (telemetricProfile.ahkEnabled || false) : (device.ahkEnabled || false),
        ip: telemetricProfile?.info?.ip || device.ip || '-',
        mac: telemetricProfile?.info?.mac || device.mac || '-',
        wifi: telemetricProfile?.info?.wifi || device.wifi || '-',
        model: telemetricProfile?.info?.model || device.model || '-'
      };
    }).filter(Boolean);
  }, [dbDevices, liveOnlineDevices]);

  const aggregateMetrics = useMemo(() => {
    const total = masterDeviceCluster.length;
    const online = masterDeviceCluster.filter(d => d.isOnline).length;
    const offline = total - online;
    const activeAhk = masterDeviceCluster.filter(d => d.isOnline && d.ahkEnabled).length;
    return { total, online, offline, activeAhk };
  }, [masterDeviceCluster]);

  const dispatchAhkToggle = async (device) => {
    try {
      const commandString = device.ahkEnabled ? 'stop_ahk' : 'start_ahk';
      const response = await fetch(`${HTTP_URL}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.serial, command: commandString }),
      });
      if (response.ok) {
        showToast(`Control execution signal deployed to ${device.name}`);
        fetchDevicesFromDatabase();
      }
    } catch (e) {
      showToast('Engine process execution intercept failure');
    }
  };

  const commitDataRegistry = async () => {
    if (!formData.serial) {
      showToast('Hardware Serial Identifier input required');
      return;
    }
    try {
      const endpoint = editingId ? `${HTTP_URL}/api/devices/${editingId}` : `${HTTP_URL}/api/devices`;
      const transactionMethod = editingId ? 'PUT' : 'POST';
      
      const API_Callback = await fetch(endpoint, {
        method: transactionMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (API_Callback.ok) {
        showToast(editingId ? 'Database records successfully updated' : 'Persistent hardware registry complete');
        setFormData({ name: '', serial: '', model: '', wifi: '', ip: '', mac: '' });
        setEditingId(null);
        fetchDevicesFromDatabase();
      }
    } catch (err) {
      showToast('Data transaction synchronization failed');
    }
  };

  const purgeDeviceRecord = async (targetId) => {
    if (!window.confirm("Permanently purge this item hardware signature from database memory?")) return;
    try {
      const deconstruction = await fetch(`${HTTP_URL}/api/devices/${targetId}`, { method: 'DELETE' });
      if (deconstruction.ok) {
        showToast('Device structural signature cleared from master cluster');
        fetchDevicesFromDatabase();
      }
    } catch (e) {
      showToast('Structural purge internal validation error');
    }
  };

  const processClusterExport = () => {
    const dataOutput = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dbDevices, null, 2));
    const structuralAnchor = document.createElement('a');
    structuralAnchor.setAttribute("href", dataOutput);
    structuralAnchor.setAttribute("download", `RH_Cluster_Schema.json`);
    document.body.appendChild(structuralAnchor);
    structuralAnchor.click();
    structuralAnchor.remove();
    showToast('Cluster data schema blueprint successfully exported');
  };

  const processClusterImport = (element) => {
    const readerEngine = new FileReader();
    if (!element.target.files[0]) return;
    
    readerEngine.readAsText(element.target.files[0], "UTF-8");
    readerEngine.onload = async (transaction) => {
      try {
        const schemaPayload = JSON.parse(transaction.target.result);
        if (!Array.isArray(schemaPayload)) {
          showToast('Invalid operational architecture format');
          return;
        }
        
        const serverSync = await fetch(`${HTTP_URL}/api/devices/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ devices: schemaPayload })
        });
        
        if (serverSync.ok) {
          showToast('Bulk system infrastructure schema integration success');
          fetchDevicesFromDatabase();
        }
      } catch (err) {
        showToast('JSON parse corruption detected inside data asset');
      }
    };
  };

  const filteredClusterQuery = masterDeviceCluster.filter(d => 
    Object.values(d).join(' ').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200 gap-4 font-mono">
        <Activity className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs tracking-widest animate-pulse">ESTABLISHING INTEGRATED MATRIX CLUSTER MANAGER...</p>
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
            <h1 className="text-xl font-black text-white tracking-tight uppercase">RH Control Node</h1>
            <p className="text-xs text-slate-400">Secure terminal session token authentication required</p>
          </div>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && passwordInput === PASS_TOKEN && (sessionStorage.setItem(AUTH_KEY, '1'), setIsAuthenticated(true))}
            placeholder="Operational Key Token"
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-center text-sm focus:outline-none focus:border-indigo-500 font-mono transition"
          />
          <button 
            onClick={() => passwordInput === PASS_TOKEN ? (sessionStorage.setItem(AUTH_KEY, '1'), setIsAuthenticated(true)) : showToast('Access Authorization Refused')} 
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs tracking-wider uppercase transition-all"
          >
            Access Terminal System
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      <header className="bg-slate-900/80 border-b border-slate-800/80 sticky top-0 backdrop-blur-md z-40 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              RH Master Terminal <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono px-1.5 py-0.5 rounded">v3.5</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Automatic Remote Hardware Network Management Subsystem</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold font-mono border ${wsConnected ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'}`}>
            <Radio className={`w-3.5 h-3.5 ${wsConnected ? 'animate-pulse' : ''}`} />
            {wsConnected ? 'STREAM CONNECTED' : 'STREAM CLOSED'}
          </div>
          <button 
            onClick={() => { sessionStorage.removeItem(AUTH_KEY); setIsAuthenticated(false); }} 
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-900 rounded-xl text-xs font-bold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            End Session
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        
        {/* OPERATIONAL TELEMETRY LIVE MONITOR METRICS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Stored Configuration</p>
            <p className="text-3xl font-black text-white mt-2 font-mono">{aggregateMetrics.total}</p>
            <div className="absolute right-3 bottom-3 text-slate-800 font-black text-4xl select-none pointer-events-none">DB</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Node Online
            </p>
            <p className="text-3xl font-black text-white mt-2 font-mono">{aggregateMetrics.online}</p>
            <div className="absolute right-3 bottom-3 text-emerald-500/5"><CheckCircle className="w-12 h-12" /></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Node Offline</p>
            <p className="text-3xl font-black text-slate-400 mt-2 font-mono">{aggregateMetrics.offline}</p>
            <div className="absolute right-3 bottom-3 text-rose-500/5"><XCircle className="w-12 h-12" /></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">AHK Microengine Running</p>
            <p className="text-3xl font-black text-indigo-400 mt-2 font-mono">{aggregateMetrics.activeAhk}</p>
            <div className="absolute right-3 bottom-3 text-indigo-500/10 text-4xl">⚙️</div>
          </div>
        </div>

        {/* HARDWARE DATA OVERRIDE REGISTRY FORM */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <h2 className="text-xs font-black uppercase text-slate-300 tracking-widest flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-500" /> {editingId ? 'Modify System Target Reference Schema' : 'Manual System Configuration Override Interface'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Laptop Profile Name', key: 'name' },
              { label: 'Serial Identity Key *', key: 'serial' },
              { label: 'Laptop Frame Model', key: 'model' },
              { label: 'SSID WiFi Identifier', key: 'wifi' },
              { label: 'Network Local IP', key: 'ip' },
              { label: 'MAC Address Blueprint', key: 'mac' }
            ].map((input) => (
              <input 
                key={input.key}
                type="text" 
                value={formData[input.key]} 
                onChange={(e) => setFormData({...formData, [input.key]: e.target.value})} 
                placeholder={input.label} 
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition" 
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={commitDataRegistry} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all">
              {editingId ? 'Commit Schema Changes' : 'Store Stabile Hardware Frame Configuration'}
            </button>
            {editingId && (
              <button onClick={() => { setEditingId(null); setFormData({ name: '', serial: '', model: '', wifi: '', ip: '', mac: '' }); }} className="px-4 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Cancel</button>
            )}
          </div>
        </div>

        {/* WORKSTATION CONTROLS: RUNTIME FILTER & PORTABILITY TOOLS */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input 
              type="text" 
              placeholder="Query hardware profile cluster by custom alias name, bios key value, local IP route, or access point SSID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none font-medium"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto justify-end">
            <button onClick={processClusterExport} className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition">
              <Download className="w-3.5 h-3.5 text-indigo-400" /> Export JSON
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-emerald-400" /> Import JSON
              <input type="file" ref={fileInputRef} accept=".json" onChange={processClusterImport} className="hidden" />
            </label>
          </div>
        </div>

        {/* COMPREHENSIVE DATA GRID ARRAY (MASTER NODES CORE INTERFACE) */}
        <div className="space-y-3">
          {filteredClusterQuery.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-800 rounded-2xl text-center py-12 text-slate-500 text-xs font-mono">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-700" />
              NO VERIFIED SYSTEM IDENTIFICATION BLOCK RECORDED WITHIN CURRENT DEPLOYMENT CLUSTER.
            </div>
          ) : (
            filteredClusterQuery.map((device) => (
              <div key={device.serial} className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 transition-all">
                
                <div className="flex items-start gap-3">
                  <div className={`p-3 rounded-xl border ${device.isOnline ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 shadow-inner' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-white tracking-tight">{device.name}</h4>
                      <span className={`text-[9px] font-black font-mono px-2 py-0.5 rounded-full uppercase border tracking-wider ${device.isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                        {device.isOnline ? 'ACTIVE' : 'STANDBY'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-medium">
                      <span>Serial: <strong className="font-mono bg-slate-950 px-1 py-0.5 rounded text-slate-300 border border-slate-800/60">{device.serial}</strong></span>
                      <span className="text-slate-700">|</span>
                      <span>Model: <strong className="text-slate-300">{device.model}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-[11px] font-mono text-slate-400 bg-slate-950 border border-slate-800/60 px-4 py-2.5 rounded-xl w-full lg:w-auto shadow-inner">
                  <div><span className="text-slate-600">IP_ROUTE:</span> <span className="text-slate-200 font-bold">{device.ip}</span></div>
                  <div><span className="text-slate-600">MAC_ADDR:</span> <span className="text-slate-200">{device.mac}</span></div>
                  <div><span className="text-slate-600">WI_FI_ID:</span> <span className="text-slate-300 font-sans font-bold">{device.wifi}</span></div>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto justify-end border-t border-slate-800/60 pt-3 lg:pt-0 lg:border-t-0">
                  <button
                    onClick={() => dispatchAhkToggle(device)}
                    disabled={!device.isOnline}
                    className={`min-w-[125px] text-center py-2 px-3 rounded-xl text-xs font-extrabold tracking-wider font-mono border transition-all ${
                      !device.isOnline 
                        ? 'bg-slate-950 border-slate-800/80 text-slate-600 cursor-not-allowed' 
                        : device.ahkEnabled 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                    }`}
                  >
                    {!device.isOnline ? 'OFFLINE 📡' : (device.ahkEnabled ? 'AHK: RUNNING 🟢' : 'AHK: INACTIVE 🔴')}
                  </button>

                  <button onClick={() => { setFormData(device); setEditingId(device.serial); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-700 transition">Edit</button>
                  <button onClick={() => purgeDeviceRecord(device.serial)} className="p-2 bg-slate-950 hover:bg-rose-950 border border-slate-800 hover:border-rose-900 text-slate-500 hover:text-rose-400 rounded-xl transition"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>

              </div>
            ))
          )}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 shadow-2xl flex items-center gap-2 font-mono animate-fade-in">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          {toast}
        </div>
      )}
    </div>
  );
}