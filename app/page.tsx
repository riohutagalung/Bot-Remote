'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span className='inline-flex items-center justify-center w-5 h-5 text-sm'>
      {children}
    </span>
  );
}

async function detectLocalIps() {
  if (typeof window === 'undefined' || !(window as any).RTCPeerConnection) return [];

  return new Promise<string[]>((resolve) => {
    const ips = new Set<string>();
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pc.createDataChannel('');

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        pc.close();
        resolve(Array.from(ips));
        return;
      }

      const candidate = event.candidate.candidate;
      const ipRegex = /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/g;
      let match;
      while ((match = ipRegex.exec(candidate))) {
        ips.add(match[1]);
      }
    };

    pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(() => {});
  });
}

interface Device {
  id: number;
  name: string;
  model: string;
  serial: string;
  uuid: string;
  hostname: string;
  user: string;
  wifi: string;
  wifiSecurity: string;
  bssid: string;
  ip: string;
  publicIp?: string;
  mac: string;
  channel: string;
  enabled: boolean;
  connected: boolean;
  ahkEnabled: boolean;
  lastSeen: string;
  lastChecked: string;
}

interface HeartbeatStatus {
  [deviceKey: string]: {
    connected: boolean;
    ahkRunning: boolean;
    lastSeen: number;
    uptime: number;
  };
}

const defaultDevices: Device[] = [
  {
    id: 1,
    name: 'Office Laptop A',
    model: 'Dell Latitude 5420',
    serial: 'RH-AX21',
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    hostname: 'OFFICE-A',
    user: 'Rio',
    wifi: 'Sailors-Company-Devices-Only',
    wifiSecurity: 'WPA2-Enterprise',
    bssid: 'AA:BB:11:22',
    ip: '10.23.42.140',
    publicIp: '103.45.10.22',
    mac: '6C-94-66-63-62-BC',
    channel: '161',
    connected: false,
    enabled: true,
    ahkEnabled: false,
    lastSeen: 'Never',
    lastChecked: 'Never',
  },
];

export default function Home() {
  const [q, setQ] = useState('');
  const blankForm = { name: '', model: '', serial: '', uuid: '', hostname: '', user: '', wifi: '', wifiSecurity: 'WPA2-Enterprise', bssid: '', ip: '', publicIp: '', mac: '', channel: '', connected: false };
  const [form, setForm] = useState(blankForm);
  const STORAGE_KEY = 'rh-house-devices';
  const [devices, setDevices] = useState<Device[]>([]);
  const [heartbeatStatus, setHeartbeatStatus] = useState<HeartbeatStatus>({});
  const [networkInfo, setNetworkInfo] = useState({
    connectionType: 'Detecting...',
    localIp: 'Detecting...',
    hostname: '',
    publicIp: 'Detecting...',
    isOnline: null as boolean | null,
  });
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: session, status } = useSession();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/auth/signin';
    }
  }, [status]);

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!session) {
    return null;
  }

  // Load devices from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setDevices(JSON.parse(saved));
          return;
        } catch (e) {
          console.error('Failed to parse saved devices:', e);
        }
      }
      setDevices(defaultDevices);
    }
  }, []);

  // Save devices to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && devices.length > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
    }
  }, [devices]);

  // Fetch real-time device status from API
  const fetchDeviceStatus = async () => {
    try {
      const response = await fetch('/api/devices/heartbeat', {
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.devices && Array.isArray(data.devices)) {
          const newStatus: HeartbeatStatus = {};
          data.devices.forEach((device: any) => {
            newStatus[device.deviceKey] = {
              connected: device.connected,
              ahkRunning: device.ahkRunning,
              lastSeen: device.lastSeen,
              uptime: device.uptime,
            };
          });
          setHeartbeatStatus(newStatus);

          // Update devices' real connection status
          setDevices((prev) =>
            prev.map((device) => {
              const deviceKey = `${device.serial}-${device.hostname}`;
              const status = newStatus[deviceKey];
              if (status) {
                return {
                  ...device,
                  connected: status.connected,
                  ahkEnabled: status.ahkRunning,
                  lastChecked: new Date().toLocaleTimeString(),
                  lastSeen: status.connected ? 'Now' : device.lastSeen,
                };
              }
              return device;
            })
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch device status:', error);
    }
  };

  // Setup real-time heartbeat polling
  useEffect(() => {
    fetchDeviceStatus();
    heartbeatIntervalRef.current = setInterval(fetchDeviceStatus, 5000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  // Send heartbeat from this device
  const sendHeartbeat = async () => {
    if (typeof window === 'undefined') return;

    try {
      await fetch('/api/devices/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serial: networkInfo.hostname,
          hostname: networkInfo.hostname,
          localIp: networkInfo.localIp,
          ahkRunning: false,
        }),
      });
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  };

  useEffect(() => {
    if (networkInfo.hostname && networkInfo.hostname !== '') {
      sendHeartbeat();
      const heartbeatInterval = setInterval(sendHeartbeat, 10000);
      return () => clearInterval(heartbeatInterval);
    }
  }, [networkInfo.hostname, networkInfo.localIp]);

  const filtered = useMemo(() => {
    return devices.filter((d) =>
      Object.values(d).join(' ').toLowerCase().includes(q.toLowerCase())
    );
  }, [q, devices]);

  const toggle = (id: number) => {
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, enabled: !d.enabled } : d)));
  };

  const removeDevice = (id: number) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  const saveNow = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
      alert('Data saved successfully');
    }
  };

  const enabledCount = devices.filter((x) => x.enabled).length;
  const disabledCount = devices.length - enabledCount;
  const connectedCount = devices.filter((x) => x.connected).length;

  const verifyConnection = async (id: number) => {
    const device = devices.find((d) => d.id === id);
    if (!device) return;

    const deviceKey = `${device.serial}-${device.hostname}`;
    try {
      const response = await fetch(`/api/devices/heartbeat?serial=${device.serial}&hostname=${device.hostname}`);
      if (response.ok) {
        const status = await response.json();
        setDevices((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  connected: status.connected,
                  ahkEnabled: status.ahkRunning,
                  lastChecked: new Date().toLocaleTimeString(),
                }
              : d
          )
        );
      }
    } catch (error) {
      console.error('Verification failed:', error);
      alert('Failed to verify connection');
    }
  };

  const addDevice = () => {
    if (!form.name || !form.serial) return;
    setDevices((prev) => [
      ...prev,
      {
        ...form,
        id: Date.now(),
        enabled: false,
        connected: false,
        ahkEnabled: false,
        lastSeen: 'Never',
        lastChecked: 'Never',
      } as Device,
    ]);
    setForm(blankForm);
  };

  const autoFillNetworkInfo = async () => {
    if (typeof window === 'undefined') return;

    const query = new URLSearchParams(window.location.search);
    const urlWifi = query.get('ssid') || query.get('wifi');
    const urlHost = query.get('hostname');
    const urlIp = query.get('ip');
    const urlPublicIp = query.get('publicIp') || query.get('publicip');
    const urlName = query.get('name');
    const urlWifiSecurity = query.get('wifiSecurity') || query.get('wifi_security');

    const connection = (navigator as any).connection || {};
    const connectionType = connection.type === 'wifi'
      ? 'Wi-Fi'
      : connection.type
      ? String(connection.type)
      : connection.effectiveType
      ? `Network (${connection.effectiveType})`
      : 'Connected network';

    const localIps = await detectLocalIps();
    const localIp = urlIp || localIps.find((ip) => !ip.startsWith('169.') && !ip.startsWith('127.') && !ip.startsWith('0.')) || localIps[0] || '';
    const hostname = urlHost || window.location.hostname || '';

    setNetworkInfo({
      connectionType,
      localIp: localIp || 'Unknown',
      hostname: hostname || 'Unknown',
      publicIp: urlPublicIp || 'Detecting...',
      isOnline: navigator.onLine,
    });

    setForm((prev) => ({
      ...prev,
      wifi: prev.wifi || urlWifi || connectionType,
      wifiSecurity: prev.wifiSecurity || urlWifiSecurity || 'WPA2-Enterprise',
      hostname: prev.hostname || hostname,
      ip: prev.ip || localIp,
      publicIp: prev.publicIp || urlPublicIp || '',
      name: prev.name || urlName || (hostname ? `Laptop ${hostname}` : ''),
    }));

    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      if (data?.ip) {
        setNetworkInfo((prev) => ({ ...prev, publicIp: data.ip }));
      }
    } catch {
      setNetworkInfo((prev) => ({ ...prev, publicIp: urlPublicIp || 'Unknown' }));
    }
  };

  useEffect(() => {
    autoFillNetworkInfo();
  }, []);

  return (
    <div className='p-6 bg-slate-50 min-h-screen'>
      <div className='max-w-7xl mx-auto space-y-6'>
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
          <div>
            <h1 className='text-3xl font-bold'>RH Control Center</h1>
            <div className='text-xs text-emerald-600 font-medium'>Vercel Ready • Free Hosting Ready</div>
            <p className='text-slate-500'>Real-time AutoHotkey status across registered laptops</p>
            <p className='text-xs text-slate-400'>Logged in as: {session?.user?.name}</p>
          </div>

          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-2 bg-white rounded-2xl px-3 py-2 shadow'>
              <Icon>🔍</Icon>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder='Search device...'
                className='border-0 shadow-none'
              />
            </div>
            <Button
              variant='outline'
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className='bg-white'
            >
              Logout
            </Button>
          </div>
        </div>

        <div className='grid md:grid-cols-4 gap-4'>
          <Card className='rounded-2xl'>
            <CardContent className='p-5'>
              <div className='text-sm text-slate-500'>Your Connection</div>
              <div className='text-2xl font-semibold'>{networkInfo.connectionType}</div>
              <div className='text-xs text-slate-500 mt-1'>{networkInfo.isOnline ? '🟢 Online' : '🔴 Offline'}</div>
            </CardContent>
          </Card>
          <Card className='rounded-2xl'>
            <CardContent className='p-5'>
              <div className='text-sm text-slate-500'>Your Hostname</div>
              <div className='text-2xl font-semibold truncate'>{networkInfo.hostname || 'Unknown'}</div>
            </CardContent>
          </Card>
          <Card className='rounded-2xl'>
            <CardContent className='p-5'>
              <div className='text-sm text-slate-500'>Your Local IP</div>
              <div className='text-2xl font-semibold'>{networkInfo.localIp}</div>
            </CardContent>
          </Card>
          <Card className='rounded-2xl'>
            <CardContent className='p-5'>
              <div className='text-sm text-slate-500'>Your Public IP</div>
              <div className='text-2xl font-semibold'>{networkInfo.publicIp}</div>
            </CardContent>
          </Card>
        </div>

        <Card className='rounded-2xl'>
          <CardContent className='p-5 space-y-3'>
            <div className='text-xl font-semibold'>Setup Laptop</div>
            <div className='text-sm text-slate-500'>Form akan otomatis terisi dari koneksi jaringan saat ini jika tersedia. Gunakan Serial Number BIOS dan Hostname sebagai identitas unik perangkat.</div>
            <div className='grid md:grid-cols-5 gap-3'>
              <Input placeholder='Laptop Name' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder='Model' value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              <Input placeholder='Serial Number BIOS' value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} />
              <Input placeholder='Machine UUID' value={form.uuid} onChange={(e) => setForm({ ...form, uuid: e.target.value })} />
              <Input placeholder='Hostname' value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} />
              <Input placeholder='Windows username' value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
              <Input placeholder='WiFi SSID' value={form.wifi} onChange={(e) => setForm({ ...form, wifi: e.target.value })} />
              <Input placeholder='BSSID / Router MAC' value={form.bssid} onChange={(e) => setForm({ ...form, bssid: e.target.value })} />
              <Input placeholder='Local IP' value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} />
              <Input placeholder='Public IP (opsional)' value={form.publicIp} onChange={(e) => setForm({ ...form, publicIp: e.target.value })} />
              <Input placeholder='MAC Address' value={form.mac} onChange={(e) => setForm({ ...form, mac: e.target.value })} />
              <Input placeholder='Network Channel' value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} />
              <Input placeholder='WiFi Security' value={form.wifiSecurity} onChange={(e) => setForm({ ...form, wifiSecurity: e.target.value })} />
            </div>
            <div className='flex gap-2 flex-wrap'>
              <Button onClick={addDevice}>Add Laptop</Button>
              <Button variant='outline' onClick={() => {
                if (typeof window !== 'undefined') {
                  navigator.clipboard.writeText(JSON.stringify(devices, null, 2));
                  alert('Backup copied to clipboard');
                }
              }}>
                Copy Backup
              </Button>
              <Button variant='outline' onClick={saveNow}>Save Data</Button>
              <Button variant='outline' onClick={() => setDevices([])}>Clear All</Button>
            </div>
          </CardContent>
        </Card>

        <div className='grid md:grid-cols-4 gap-4'>
          <Card className='rounded-2xl'>
            <CardContent className='p-5'>
              <div className='text-sm text-slate-500'>Total Devices</div>
              <div className='text-3xl font-bold'>{devices.length}</div>
            </CardContent>
          </Card>

          <Card className='rounded-2xl'>
            <CardContent className='p-5'>
              <div className='text-sm text-slate-500'>Connected (Real-time)</div>
              <div className='text-3xl font-bold text-green-600'>{connectedCount}</div>
            </CardContent>
          </Card>

          <Card className='rounded-2xl'>
            <CardContent className='p-5'>
              <div className='text-sm text-slate-500'>Disconnected</div>
              <div className='text-3xl font-bold text-red-600'>{disabledCount}</div>
            </CardContent>
          </Card>

          <Card className='rounded-2xl'>
            <CardContent className='p-5'>
              <div className='text-sm text-slate-500'>Enabled</div>
              <div className='text-3xl font-bold'>{enabledCount}</div>
            </CardContent>
          </Card>
        </div>

        <div className='grid gap-4'>
          {filtered.length === 0 ? (
            <Card className='rounded-2xl'>
              <CardContent className='p-6 text-center text-slate-500'>
                No devices found. Add one using the Setup Laptop form above.
              </CardContent>
            </Card>
          ) : (
            filtered.map((d: any) => {
              const deviceKey = `${d.serial}-${d.hostname}`;
              const status = heartbeatStatus[deviceKey];
              const isConnected = status?.connected ?? d.connected;
              const ahkRunning = status?.ahkRunning ?? d.ahkEnabled;

              return (
                <Card key={d.id} className={`rounded-2xl shadow-sm ${isConnected ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
                  <CardContent className='p-5'>
                    <div className='grid md:grid-cols-5 gap-4 items-center'>
                      <div>
                        <div className='flex items-center gap-2 font-semibold'>
                          <Icon>{isConnected ? '🟢' : '🔴'}</Icon>
                          {d.name}
                        </div>
                        <div className='text-sm text-slate-500'>{d.model}</div>
                        <div className='text-xs font-mono text-slate-400'>{d.serial}</div>
                      </div>

                      <div>
                        <div className='text-xs text-slate-500'>Status</div>
                        <div className={`font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                          {isConnected ? 'Connected ✓' : 'Disconnected ✗'}
                        </div>
                        <div className='text-xs text-slate-500'>{d.lastChecked}</div>
                      </div>

                      <div>
                        <div className='text-xs text-slate-500'>AutoHotkey</div>
                        <div className={`font-bold ${ahkRunning ? 'text-green-600' : 'text-red-600'}`}>
                          {ahkRunning ? 'Running ✓' : 'Stopped ✗'}
                        </div>
                        <div className='text-xs text-slate-500'>Network Info</div>
                      </div>

                      <div>
                        <div className='text-xs text-slate-500'>Network</div>
                        <div className='font-medium flex flex-col gap-1'>
                          <div className='flex items-center gap-1 truncate'>
                            <Icon>📶</Icon>
                            <span className='truncate'>{d.wifi}</span>
                          </div>
                          <div className='text-xs text-slate-500'>IP: {d.ip}</div>
                          <div className='text-xs text-slate-500'>MAC: {d.mac || 'N/A'}</div>
                        </div>
                      </div>

                      <div className='flex flex-wrap items-center justify-end gap-2'>
                        <div className='flex items-center gap-2'>
                          <Icon>{d.enabled ? '🛡️' : '⚠️'}</Icon>
                          <span className='text-sm'>
                            {d.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          <Switch
                            checked={d.enabled}
                            onCheckedChange={() => toggle(d.id)}
                          />
                        </div>
                        <Button size='sm' variant='outline' onClick={() => verifyConnection(d.id)}>
                          Verify
                        </Button>
                        <Button size='sm' variant='destructive' onClick={() => removeDevice(d.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <div className='text-center text-xs text-slate-500 py-4'>
          Status updates every 5 seconds | Last update: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
