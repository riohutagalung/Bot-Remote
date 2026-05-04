"use client"

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const STORAGE_KEY = 'rh-house-devices';
const blankForm = {
  name: '',
  model: '',
  serial: '',
  wifi: '',
  bssid: '',
  hostname: '',
  ip: '',
  user: '',
};

function Icon({ children }) {
  return (
    <span className='inline-flex items-center justify-center w-5 h-5 text-sm'>
      {children}
    </span>
  );
}

export default function App() {
  const [q, setQ] = useState('');
  const [form, setForm] = useState(blankForm);
  const [devices, setDevices] = useState(() => {
    if (typeof window === 'undefined') {
      return [
        {
          id: 1,
          name: 'Office Laptop A',
          model: 'Dell Latitude 5420',
          serial: 'RH-AX21',
          wifi: 'RH_OFFICE',
          bssid: 'AA:BB:11:22',
          hostname: 'OFFICE-A',
          ip: '192.168.1.10',
          user: 'Rio',
          enabled: true,
          lastSeen: 'Today 14:20',
        },
        {
          id: 2,
          name: 'Warehouse Laptop',
          model: 'HP ProBook 440',
          serial: 'RH-BX11',
          wifi: 'GudangNet',
          bssid: 'CC:DD:22:33',
          hostname: 'WAREHOUSE-1',
          ip: '192.168.0.20',
          user: 'Admin',
          enabled: false,
          lastSeen: 'Today 13:05',
        },
        {
          id: 3,
          name: 'Finance Laptop',
          model: 'Lenovo ThinkPad E14',
          serial: 'RH-CX98',
          wifi: 'FinanceWiFi',
          bssid: 'EE:FF:44:55',
          hostname: 'FINANCE-01',
          ip: '10.10.10.8',
          user: 'Finance',
          enabled: true,
          lastSeen: 'Yesterday',
        },
      ];
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.warn('Unable to parse saved devices:', error);
      }
    }

    return [
      {
        id: 1,
        name: 'Office Laptop A',
        model: 'Dell Latitude 5420',
        serial: 'RH-AX21',
        wifi: 'RH_OFFICE',
        bssid: 'AA:BB:11:22',
        hostname: 'OFFICE-A',
        ip: '192.168.1.10',
        user: 'Rio',
        enabled: true,
        lastSeen: 'Today 14:20',
      },
      {
        id: 2,
        name: 'Warehouse Laptop',
        model: 'HP ProBook 440',
        serial: 'RH-BX11',
        wifi: 'GudangNet',
        bssid: 'CC:DD:22:33',
        hostname: 'WAREHOUSE-1',
        ip: '192.168.0.20',
        user: 'Admin',
        enabled: false,
        lastSeen: 'Today 13:05',
      },
      {
        id: 3,
        name: 'Finance Laptop',
        model: 'Lenovo ThinkPad E14',
        serial: 'RH-CX98',
        wifi: 'FinanceWiFi',
        bssid: 'EE:FF:44:55',
        hostname: 'FINANCE-01',
        ip: '10.10.10.8',
        user: 'Finance',
        enabled: true,
        lastSeen: 'Yesterday',
      },
    ];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
    }
  }, [devices]);

  const filtered = useMemo(
    () =>
      devices.filter((device) =>
        Object.values(device)
          .join(' ')
          .toLowerCase()
          .includes(q.toLowerCase())
      ),
    [devices, q]
  );

  const toggle = (id) => {
    setDevices((prev) =>
      prev.map((device) =>
        device.id === id ? { ...device, enabled: !device.enabled } : device
      )
    );
  }; 

  const removeDevice = (id) => {
    setDevices((prev) => prev.filter((device) => device.id !== id));
  };

  const saveNow = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
      window.alert('Data saved successfully');
    }
  };

  const toggleOld = (id) => {
    toggle(id);
  };

  const enabledCount = devices.filter((device) => device.enabled).length;
  const disabledCount = devices.length - enabledCount;

  const addDevice = () => {
    if (!form.name || !form.serial) {
      return;
    }
    setDevices((prev) => [
      ...prev,
      {
        ...form,
        id: Date.now(),
        enabled: false,
        lastSeen: 'Never',
      },
    ]);
    setForm(blankForm);
  };

  const copyBackup = async () => {
    if (typeof window !== 'undefined' && window.navigator?.clipboard) {
      await window.navigator.clipboard.writeText(JSON.stringify(devices, null, 2));
      window.alert('Backup copied to clipboard');
    }
  };

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
              onChange={(event) => setQ(event.target.value)}
              placeholder='Search device...'
              className='border-0 shadow-none'
            />
          </div>
        </div>

        <Card className='rounded-2xl'>
          <CardContent className='p-5 space-y-3'>
            <div className='text-xl font-semibold'>Add / Setup Laptop</div>
            <div className='grid md:grid-cols-4 gap-3'>
              <Input
                placeholder='Laptop Name'
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <Input
                placeholder='Model'
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
              />
              <Input
                placeholder='Serial Number'
                value={form.serial}
                onChange={(event) => setForm({ ...form, serial: event.target.value })}
              />
              <Input
                placeholder='WiFi SSID'
                value={form.wifi}
                onChange={(event) => setForm({ ...form, wifi: event.target.value })}
              />
              <Input
                placeholder='Router BSSID / MAC'
                value={form.bssid}
                onChange={(event) => setForm({ ...form, bssid: event.target.value })}
              />
              <Input
                placeholder='Hostname'
                value={form.hostname}
                onChange={(event) => setForm({ ...form, hostname: event.target.value })}
              />
              <Input
                placeholder='Local IP'
                value={form.ip}
                onChange={(event) => setForm({ ...form, ip: event.target.value })}
              />
              <Input
                placeholder='Windows User'
                value={form.user}
                onChange={(event) => setForm({ ...form, user: event.target.value })}
              />
            </div>
            <div className='flex gap-2 flex-wrap'>
              <Button onClick={addDevice}>Add Laptop</Button>
              <Button variant='outline' onClick={copyBackup}>Copy Backup</Button>
              <Button variant='outline' onClick={saveNow}>Save Data</Button>
              <Button variant='outline' onClick={() => setDevices([])}>Clear All</Button>
            </div>
          </CardContent>
        </Card>

        <div className='grid md:grid-cols-3 gap-4'>
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
        </div>

        <div className='grid gap-4'>
          {filtered.length === 0 ? (
            <Card className='rounded-2xl'>
              <CardContent className='p-6 text-center text-slate-500'>
                No devices found.
              </CardContent>
            </Card>
          ) : (
            filtered.map((device) => (
              <Card key={device.id} className='rounded-2xl shadow-sm'>
                <CardContent className='p-5'>
                  <div className='grid md:grid-cols-5 gap-4 items-center'>
                    <div>
                      <div className='flex items-center gap-2 font-semibold'>
                        <Icon>💻</Icon>
                        {device.name}
                      </div>
                      <div className='text-sm text-slate-500'>{device.model}</div>
                    </div>

                    <div>
                      <div className='text-xs text-slate-500'>Serial Number</div>
                      <div className='font-medium'>{device.serial}</div>
                    </div>

                    <div>
                      <div className='text-xs text-slate-500'>WiFi</div>
                      <div className='font-medium flex items-center gap-1'>
                        <Icon>📶</Icon>
                        {device.wifi}
                      </div>
                    </div>

                    <div>
                      <div className='text-xs text-slate-500'>Last Seen</div>
                      <div className='font-medium'>{device.lastSeen}</div>
                    </div>

                    <div className='flex flex-wrap items-center justify-end gap-3'>
                      <div className='flex items-center gap-2'>
                        <Icon>🛡️</Icon>
                        <span className='text-sm'>
                          {device.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <Switch checked={device.enabled} onCheckedChange={() => toggle(device.id)} />
                      </div>

                      <Button variant='outline' onClick={() => toggleOld(device.id)}>
                        {device.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button variant='destructive' onClick={() => removeDevice(device.id)}>
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
