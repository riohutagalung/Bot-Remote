'use client';

import React, { useMemo, useState, useEffect } from 'react';
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
  channel: string;  enabled: boolean;  connected: boolean;
  ahkEnabled: boolean;
  lastSeen: string;
  lastChecked: string;
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
    connected: true,
    enabled: true,
    ahkEnabled: true,
    lastSeen: 'Today 14:20',
    lastChecked: 'Just now',
  },
  {
    id: 2,
    name: 'Warehouse Laptop',
    model: 'HP ProBook 440',
    serial: 'RH-BX11',
    uuid: '550e8400-e29b-41d4-a716-446655440001',
    hostname: 'WAREHOUSE-1',
    user: 'Admin',
    wifi: 'Sailors-Company-Devices-Only',
    wifiSecurity: 'WPA2-Enterprise',
    bssid: 'CC:DD:22:33',
    ip: '192.168.0.20',
    publicIp: '103.45.10.24',
    mac: '6C-94-66-63-62-BD',
    channel: '161',
    connected: false,
    enabled: false,
    ahkEnabled: false,
    lastSeen: 'Today 13:05',
    lastChecked: '15:05',
  },
  {
    id: 3,
    name: 'Finance Laptop',
    model: 'Lenovo ThinkPad E14',
    serial: 'RH-CX98',
    uuid: '550e8400-e29b-41d4-a716-446655440002',
    hostname: 'FINANCE-01',
    user: 'Finance',
    wifi: 'Sailors-Company-Devices-Only',
    wifiSecurity: 'WPA2-Enterprise',
    bssid: 'EE:FF:44:55',
    ip: '10.10.10.8',
    publicIp: '103.45.10.26',
    mac: '6C-94-66-63-62-BE',
    channel: '161',
    connected: true,
    enabled: true,
    ahkEnabled: true,
    lastSeen: 'Yesterday',
    lastChecked: 'Yesterday',
  },
];

export default function Home() {
  const [q, setQ] = useState('');
  const blankForm = { name: '', model: '', serial: '', uuid: '', hostname: '', user: '', wifi: '', wifiSecurity: 'WPA2-Enterprise', bssid: '', ip: '', publicIp: '', mac: '', channel: '', connected: false };
  const [form, setForm] = useState(blankForm);
  const STORAGE_KEY = 'rh-house-devices';
  const [devices, setDevices] = useState<Device[]>([]);

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
    }
  }, [devices]);

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
  const ahkDisabledCount = devices.filter((x) => !x.ahkEnabled).length;

  const verifyConnection = (id: number) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const connected = d.wifi === 'Sailors-Company-Devices-Only' && d.ip !== '' && d.bssid !== '';
        return {
          ...d,
          connected,
          lastChecked: new Date().toLocaleTimeString(),
        };
      })
    );
  };

  const toggleAhkOnly = (id: number) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              ahkEnabled: !d.ahkEnabled,
              lastChecked: new Date().toLocaleTimeString(),
            }
          : d
      )
    );
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
    setForm(blankForm);  };

  const detectCurrentDevice = async () => {
    if (typeof window === 'undefined') return;

    try {
      let localIp = '';
      let publicIp = '';

      const pc = new RTCPeerConnection({ iceServers: [] });
      const candidates: string[] = [];

      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate) return;
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        const ipAddress = ipRegex.exec(ice.candidate.candidate);
        if (ipAddress) {
          candidates.push(ipAddress[1]);
        }
      };

      await pc.createDataChannel('');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      pc.close();

      if (candidates.length > 0) {
        localIp = candidates[0];
      }

      const connectionType = (navigator as any).connection?.effectiveType || 'unknown';
      const downlink = (navigator as any).connection?.downlink || 'N/A';

      setForm((prev) => ({
        ...prev,
        ip: localIp || prev.ip,
        wifi: 'Sailors-Company-Devices-Only',
        wifiSecurity: 'WPA2-Enterprise',
        bssid: 'AA:BB:11:22',
        channel: '161',
      }));

      alert(
        `Auto-detected:\n\nLocal IP: ${localIp || 'N/A'}\nConnection: ${connectionType}\nSpeed: ${downlink} Mbps\n\nWiFi SSID updated to default. Please verify your actual SSID.`
      );
    } catch (error) {
      console.error('Detection failed:', error);
      alert('Could not auto-detect network info. Please fill manually.');
    }  };

  return (
    <div className='p-6 bg-slate-50 min-h-screen'>
      <div className='max-w-7xl mx-auto space-y-6'>
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
          <div>
            <h1 className='text-3xl font-bold'>RH House Control Center</h1>
            <div className='text-xs text-emerald-600 font-medium'>Vercel Ready • Free Hosting Ready</div>
            <p className='text-slate-500'>Manage AutoHotkey status across registered laptops</p>
          </div>

          <div className='flex items-center gap-2 bg-white rounded-2xl px-3 py-2 shadow'>
            <Icon>🔍</Icon>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='Search device...'
              className='border-0 shadow-none'
            />
          </div>
        </div>

        <Card className='rounded-2xl'>
          <CardContent className='p-5 space-y-3'>
            <div className='text-xl font-semibold'>WiFi Control Setup</div>
            <div className='grid md:grid-cols-2 gap-3 text-sm text-slate-600'>
              <div>
                <div className='font-medium'>SSID</div>
                Sailors-Company-Devices-Only
              </div>
              <div>
                <div className='font-medium'>Security</div>
                WPA2-Enterprise / EAP-TLS
              </div>
              <div>
                <div className='font-medium'>IP Assignment</div>
                Automatic (DHCP)
              </div>
              <div>
                <div className='font-medium'>Network band</div>
                5 GHz, channel 161
              </div>
            </div>
            <p className='text-sm text-slate-500'>Gunakan konfigurasi ini sebagai acuan saat menambahkan perangkat ke jaringan. Status AutoHotkey akan tampil bila perangkat terhubung dengan agen pemantau yang mendukung pembacaan proses. Browser dapat mendeteksi IP lokal dan tipe koneksi perangkat Anda saat ini.</p>
          </CardContent>
        </Card>

        <Card className='rounded-2xl'>
          <CardContent className='p-5 space-y-3'>
            <div className='text-xl font-semibold'>Add / Setup Laptop</div>
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
              <div className='text-sm text-slate-500'>Total Devices (Saved Local)</div>
              <div className='text-3xl font-bold'>{devices.length}</div>
            </CardContent>
          </Card>

          <Card className='rounded-2xl'>
            <CardContent className='p-5'>
              <div className='text-sm text-slate-500'>Enabled</div>
              <div className='text-3xl font-bold'>{enabledCount}</div>
            </CardContent>
          </Card>

          <Card className='rounded-2xl'>
            <CardContent className='p-5'>
              <div className='text-sm text-slate-500'>Disabled</div>
              <div className='text-3xl font-bold'>{disabledCount}</div>
            </CardContent>
          </Card>

          <Card className='rounded-2xl'>
            <CardContent className='p-5'>
              <div className='text-sm text-slate-500'>AHK Disabled</div>
              <div className='text-3xl font-bold'>{ahkDisabledCount}</div>
            </CardContent>
          </Card>
        </div>

        <div className='grid gap-4'>
          {filtered.length === 0 ? (
            <Card className='rounded-2xl'>
              <CardContent className='p-6 text-center text-slate-500'>
                No devices found.
              </CardContent>
            </Card>
          ) : (
            filtered.map((d: any) => (
              <Card key={d.id} className='rounded-2xl shadow-sm'>
                <CardContent className='p-5'>
                  <div className='grid md:grid-cols-5 gap-4 items-center'>
                    <div>
                      <div className='flex items-center gap-2 font-semibold'>
                        <Icon>💻</Icon>
                        {d.name}
                      </div>
                      <div className='text-sm text-slate-500'>{d.model}</div>
                    </div>

                    <div>
                      <div className='text-xs text-slate-500'>Serial Number</div>
                      <div className='font-medium'>{d.serial}</div>
                    </div>

                    <div>
                      <div className='text-xs text-slate-500'>Network</div>
                      <div className='font-medium flex flex-col gap-1'>
                        <div className='flex items-center gap-1'>
                          <Icon>📶</Icon>
                          {d.wifi}
                        </div>
                        <div className='text-xs text-slate-500'>BSSID: {d.bssid}</div>
                        <div className='text-xs text-slate-500'>Local IP: {d.ip}</div>
                        {d.publicIp ? <div className='text-xs text-slate-500'>Public IP: {d.publicIp}</div> : null}
                      </div>
                    </div>

                    <div>
                      <div className='text-xs text-slate-500'>AHK Connection</div>
                      <div className='font-medium'>{d.connected ? 'Connected' : 'Disconnected'}</div>
                      <div className='text-xs text-slate-500'>Last check: {d.lastChecked}</div>
                    </div>

                    <div>
                      <div className='text-xs text-slate-500'>AHK Control</div>
                      <div className='font-medium'>{d.ahkEnabled ? 'Running' : 'Disabled'}</div>
                      <div className='text-xs text-slate-500'>Only AHK is toggled here.</div>
                    </div>

                    <div className='flex flex-wrap items-center justify-end gap-3'>
                      <div className='flex items-center gap-2'>
                        <Icon>🛡️</Icon>
                        <span className='text-sm'>
                          {d.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <Switch
                          checked={d.enabled}
                          onCheckedChange={() => toggle(d.id)}
                        />
                      </div>
                      <Button variant='outline' onClick={() => verifyConnection(d.id)}>
                        Verify Connection
                      </Button>
                      <Button variant='outline' onClick={() => toggleAhkOnly(d.id)}>
                        {d.ahkEnabled ? 'Disable AHK' : 'Enable AHK'}
                      </Button>
                      <Button variant='destructive' onClick={() => removeDevice(d.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
