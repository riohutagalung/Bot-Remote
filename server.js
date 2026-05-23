const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
// Inisialisasi server WebSocket
const wss = new WebSocket.Server({ server });

// DATABASE UTAMA (In-Memory Simulation)
// Data terdaftar permanen sebelum server restart/deploy ulang
let databasePerangkat = [];

// TEMPAT PENYIMPANAN TELEMETRI REAL-TIME (Client.exe yang sedang aktif)
let klienOnlineLive = new Map();

// ==========================================
// PENGIRIMAN DATA KE DASHBOARD (BROADCAST)
// ==========================================
function kirimUpdateKeSemuaDashboard() {
  try {
    const daftarDevicesLive = Array.from(klienOnlineLive.values()).map(p => ({
      id: p.id || '',
      ahkEnabled: p.ahkEnabled || false,
      info: p.info || { hostname: '-', model: '-', wifi: '-', ip: '-', mac: '-' }
    }));

    const payload = JSON.stringify({
      type: 'device_list',
      devices: daftarDevicesLive
    });

    wss.clients.forEach((client) => {
      // Pastikan hanya mengirim ke koneksi WebSocket yang benar-benar terbuka
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  } catch (err) {
    console.error('⚠️ Gagal melakukan broadcast ke dashboard:', err.message);
  }
}

// ==========================================
// CORE LOGIC WEBSOCKET SERVER
// ==========================================
wss.on('connection', (ws) => {
  console.log('🔌 Seseorang terhubung (Dashboard Web atau Client.exe)');

  // Kirim data yang ada saat ini begitu ada koneksi baru masuk
  kirimUpdateKeSemuaDashboard();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // VALIDASI AMAN: Pastikan ini adalah paket data valid dari client.exe
      if (data && data.id) {
        const deviceId = data.id.toString().trim().toLowerCase();
        
        // Daftarkan atau perbarui status live di memori server
        klienOnlineLive.set(deviceId, {
          id: data.id.toString().trim(),
          ahkEnabled: typeof data.ahkEnabled === 'boolean' ? data.ahkEnabled : false,
          info: {
            hostname: data.hostname || data.name || 'Windows Client',
            model: data.model || '-',
            wifi: data.wifi || '-',
            ip: data.ip || '-',
            mac: data.mac || '-'
          },
          wsInstance: ws, // Simpan referensi websocket milik client.exe ini
          lastSeen: Date.now()
        });

        // Informasikan perubahan data terbaru ke Web Dashboard
        kirimUpdateKeSemuaDashboard();
      }
    } catch (err) {
      console.error('❌ Gagal memproses data masuk (Paket Rusak):', err.message);
    }
  });

  ws.on('close', () => {
    try {
      // Bersihkan client.exe dari daftar online jika koneksinya putus
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

  // Cegah server crash akibat error koneksi mentah dari browser/client
  ws.on('error', (err) => {
    console.error('🔥 WebSocket Socket Error:', err.message);
    try {
      ws.close();
    } catch (e) {}
  });
});

// Penyelamat Utama: Cegah Node.js mati jika ada error global tak terduga
process.on('uncaughtException', (err) => {
  console.error('🚨 ERROR FATAL DIALAMI SERVER (Tetap Bertahan):', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 REJEKSI PROMISE TIDAK TERTANGANI:', reason);
});

// ==========================================
// REST API ENDPOINTS (HTTP PROTOCOL)
// ==========================================

// Ambil semua data dari database
app.get('/api/devices', (req, res) => {
  res.json({ devices: databasePerangkat });
});

// Simpan perangkat secara permanen ke database
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

// Edit entri data perangkat
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

// Hapus perangkat dari database pusat
app.delete('/api/devices/:id', (req, res) => {
  try {
    const targetSerial = req.params.id.toString().trim().toLowerCase();
    databasePerangkat = databasePerangkat.filter(p => p.serial.toString().trim().toLowerCase() !== targetSerial);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Deletion error' });
  }
});

// Saluran Eksekusi Perintah START/STOP AHK ke client.exe
app.post('/api/command', (req, res) => {
  try {
    const { deviceId, command } = req.body; // command: 'start_ahk' atau 'stop_ahk'
    if (!deviceId) return res.status(400).json({ error: 'Device ID required' });

    const targetKlien = klienOnlineLive.get(deviceId.toString().trim().toLowerCase());

    if (targetKlien && targetKlien.wsInstance && targetKlien.wsInstance.readyState === WebSocket.OPEN) {
      // Kirim string instruksi langsung ke websocket client.exe target
      targetKlien.wsInstance.send(JSON.stringify({ action: command }));
      
      // Sinkronkan status di server memori
      targetKlien.ahkEnabled = (command === 'start_ahk');
      kirimUpdateKeSemuaDashboard();

      return res.json({ success: true, message: 'Signal successfully deployed' });
    }

    res.status(404).json({ error: 'Device node is currently offline' });
  } catch (e) {
    res.status(500).json({ error: 'Command dispatch system error' });
  }
});

// Bulk Import Database Schema
app.post('/api/devices/import', (req, res) => {
  const { devices } = req.body;
  if (Array.isArray(devices)) {
    databasePerangkat = devices;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid data format' });
  }
});

// ==========================================
// RUNTIME PORT ASSIGNMENT
// ==========================================
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Master Engine Server operating safely on port: ${PORT}`);
});