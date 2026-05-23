const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
// Jalankan WebSocket Server bergandengan dengan HTTP
const wss = new WebSocket.Server({ server });

// DATABASE INDUK (In-Memory Simulation)
// Menyimpan data perangkat secara permanen selama server tidak restart
let databasePerangkat = [
  {
    name: "Laptop Utama Admin",
    serial: "BFR12345678X",
    model: "ASUS ROG Zephyrus",
    wifi: "RH_HQ_5G",
    ip: "192.168.1.50",
    mac: "AA:BB:CC:DD:EE:FF",
    ahkEnabled: false
  }
];

// STATE LIVE TELEMETRI (Data real-time dari client.exe)
let klienOnlineLive = new Map();

// ==========================================
// 1. MANAJEMEN WEBSOCKET (REAL-TIME STREAM)
// ==========================================
wss.on('connection', (ws) => {
  console.log('🔌 Koneksi baru terjalin (Web Dashboard / Client.exe)');

  // Kirim data awal ke dashboard saat pertama kali connect
  kirimUpdateKeSemuaDashboard();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // JIKA YANG KIRIM DATA ADALAH CLIENT.EXE (Membawa Telemetri Laptop)
      if (data.type === 'telemetry' || data.id) {
        const deviceId = data.id.trim().toLowerCase();
        
        // Simpan atau update status live di memori
        klienOnlineLive.set(deviceId, {
          id: data.id,
          ahkEnabled: data.ahkEnabled || false,
          info: {
            hostname: data.hostname || data.name || 'Windows Client',
            model: data.model || '-',
            wifi: data.wifi || '-',
            ip: data.ip || '-',
            mac: data.mac || '-'
          },
          wsInstance: ws, // Simpan instance ws untuk kirim command balik nanti
          lastSeen: Date.now()
        });

        // Broadcast data terbaru ke semua Web Dashboard yang terhubung
        kirimUpdateKeSemuaDashboard();
      }
    } catch (err) {
      console.error('Gagal membaca paket data WebSocket:', err.message);
    }
  });

  ws.on('close', () => {
    // Cari dan bersihkan client.exe yang disconnect
    for (let [id, perangkat] of klienOnlineLive.entries()) {
      if (perangkat.wsInstance === ws) {
        klienOnlineLive.delete(id);
        console.log(`❌ Client dengan ID Serial [${id}] Terputus.`);
        break;
      }
    }
    kirimUpdateKeSemuaDashboard();
  });
});

// Fungsi pembantu untuk membroadcast data live ke web dashboard
function kirimUpdateKeSemuaDashboard() {
  const daftarDevicesLive = Array.from(klienOnlineLive.values()).map(p => ({
    id: p.id,
    ahkEnabled: p.ahkEnabled,
    info: p.info
  }));

  const payload = JSON.stringify({
    type: 'device_list',
    devices: daftarDevicesLive
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ==========================================
// 2. ENDPOINT API HTTP (UNTUK FRONTEND)
// ==========================================

// Ambil semua data dari database pusat
app.get('/api/devices', (req, res) => {
  res.json({ devices: databasePerangkat });
});

// Simpan data perangkat baru / Kunci data dari dashboard ke database pusat
app.post('/api/devices', (req, res) => {
  const { serial, name, model, wifi, ip, mac } = req.body;
  if (!serial) return res.status(400).json({ error: 'Serial is required' });

  const kunciSerial = serial.trim().toLowerCase();
  
  // Cek apakah sudah terdaftar, jika belum masukkan baru
  const indeksAman = databasePerangkat.findIndex(p => p.serial.trim().toLowerCase() === kunciSerial);
  const dataBaru = { serial, name, model, wifi, ip, mac, ahkEnabled: false };

  if (indeksAman > -1) {
    databasePerangkat[indeksAman] = { ...databasePerangkat[indeksAman], ...dataBaru };
  } else {
    databasePerangkat.push(dataBaru);
  }

  res.json({ success: true, message: 'Device securely stored in database' });
});

// Update data perangkat via tombol Edit
app.put('/api/devices/:id', (req, res) => {
  const targetSerial = req.params.id.trim().toLowerCase();
  const indeks = databasePerangkat.findIndex(p => p.serial.trim().toLowerCase() === targetSerial);
  
  if (indeks > -1) {
    databasePerangkat[indeks] = { ...databasePerangkat[indeks], ...req.body };
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Device not found' });
  }
});

// Hapus perangkat permanen dari database pusat
app.delete('/api/devices/:id', (req, res) => {
  const targetSerial = req.params.id.trim().toLowerCase();
  databasePerangkat = databasePerangkat.filter(p => p.serial.trim().toLowerCase() !== targetSerial);
  res.json({ success: true });
});

// Kirim perintah START/STOP AHK ke client.exe target
app.post('/api/command', (req, res) => {
  const { deviceId, command } = req.body; // command: 'start_ahk' atau 'stop_ahk'
  if (!deviceId) return res.status(400).json({ error: 'Device ID required' });

  const targetKlien = klienOnlineLive.get(deviceId.trim().toLowerCase());

  if (targetKlien && targetKlien.wsInstance.readyState === WebSocket.OPEN) {
    // Teruskan perintah langsung ke client.exe via koneksi WebSocket-nya
    targetKlien.wsInstance.send(JSON.stringify({ action: command }));
    
    // Update local state agar sinkron di UI
    targetKlien.ahkEnabled = (command === 'start_ahk');
    kirimUpdateKeSemuaDashboard();

    return res.json({ success: true, message: `Command ${command} pushed to client` });
  }

  res.status(404).json({ error: 'Client offline or unreachable' });
});

// Massal Import JSON Data
app.post('/api/devices/import', (req, res) => {
  const { devices } = req.body;
  if (Array.isArray(devices)) {
    databasePerangkat = devices;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid schema' });
  }
});

// ==========================================
// 3. RUN SERVER
// ==========================================
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server Backend RH Production aktif di port: ${PORT}`);
});