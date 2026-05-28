const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 1. DATABASE SIMULASI (Bisa diganti sesuai DB abang: MongoDB/MySQL/PostgreSQL)
// Ini menampung perangkat yang terdaftar permanen
let devicesDatabase = [
  { serial: "LAPTOP-SAMPLE123", name: "Laptop Utama Admin", model: "ThinkPad T14", wifi: "RH_Office", ip: "192.168.1.50", mac: "AA:BB:CC:DD:EE:FF" }
];

// 2. LIVE TELEMETRY STORAGE (Menampung client.exe yang sedang aktif berjalan)
// Menggunakan Map agar performa tracking windows manager cepat
const onlineClients = new Map(); 

// ==========================================
// KONEKSI WEBSOCKET (UNTUK CLIENT.EXE & DASHBOARD)
// ==========================================
wss.on('connection', (ws, req) => {
  let currentClientSerial = null;

  ws.on('message', (message) => {
    try {
      const packet = JSON.parse(message);

      // KONDISI A: Paket data datang dari client.exe (Telemetri Jaringan & Windows Manager)
      if (packet.type === 'telemetry' || packet.id) {
        const serial = (packet.id || packet.serial).trim();
        currentClientSerial = serial;

        // Ambil status pengecekan script AHK dari windows manager client.exe
        // Kita amankan dengan fallback agar tidak bernilai undefined
        const isAhkRunning = packet.ahkEnabled === true || packet.isAhkRunning === true || packet.info?.ahkEnabled === true;

        // Simpan ke memory live tracking server
        onlineClients.set(serial, {
          id: serial,
          ws: ws,
          lastSeen: Date.now(),
          ahkEnabled: isAhkRunning, // <--- LOGIKA CRUCIAL: Jangan sampai salah nama properti!
          info: {
            hostname: packet.name || packet.info?.hostname || "Windows Client",
            model: packet.model || packet.info?.model || "-",
            wifi: packet.wifi || packet.info?.wifi || "-",
            ip: packet.ip || packet.info?.ip || "-",
            mac: packet.mac || packet.info?.mac || "-"
          }
        });

        // Broadcast data terbaru ke semua dashboard React yang nempel
        broadcastToDashboards();
      }

      // KONDISI B: Paket koneksi dari Dashboard React (Hanya untuk monitor)
      if (packet.type === 'dashboard_init') {
        ws.isDashboard = true;
        sendDeviceListToSingleClient(ws);
      }

    } catch (err) {
      console.error("Error parsing WS packet:", err);
    }
  });

  // JIKA CLIENT.EXE MATI ATAU PUTUS KONEKSI
  ws.on('close', () => {
    if (currentClientSerial && onlineClients.has(currentClientSerial)) {
      // Cek apakah beneran ws milik client tersebut yang putus
      if (onlineClients.get(currentClientSerial).ws === ws) {
        onlineClients.delete(currentClientSerial);
        broadcastToDashboards();
      }
    }
  });
});

// Fungsi pembantu mengirim data ke seluruh dashboard React
function broadcastToDashboards() {
  const devicesArray = [];
  onlineClients.forEach((value, key) => {
    devicesArray.push({
      id: value.id,
      ahkEnabled: value.ahkEnabled,
      info: value.info
    });
  });

  const payload = JSON.stringify({ type: 'device_list', devices: devicesArray });
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.isDashboard) {
      client.send(payload);
    }
  });
}

function sendDeviceListToSingleClient(ws) {
  const devicesArray = [];
  onlineClients.forEach((value) => {
    devicesArray.push({ id: value.id, ahkEnabled: value.ahkEnabled, info: value.info });
  });
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'device_list', devices: devicesArray }));
  }
}

// Ping Checker: Membersihkan client siluman yang DC tanpa mengirim sinyal close
setInterval(() => {
  const kini = Date.now();
  let adaPerubahan = false;
  onlineClients.forEach((value, key) => {
    if (kini - value.lastSeen > 12000) { // Toleransi 12 detik semisal client telat heartbeat
      onlineClients.delete(key);
      adaPerubahan = true;
    }
  });
  if (adaPerubahan) broadcastToDashboards();
}, 5000);


// ==========================================
// API ENDPOINTS (HTTP ROUTE UNTUK DATABASE)
// ==========================================

// Ambil semua daftar perangkat terdaftar di DB
app.get('/api/devices', (req, res) => {
  res.json({ success: true, devices: devicesDatabase });
});

// Daftarkan perangkat baru / manual override
app.post('/api/devices', (req, res) => {
  const { serial, name, model, wifi, ip, mac } = req.body;
  if (!serial) return res.status(400).json({ success: false, message: "Serial required" });

  // Cari apakah sudah ada di DB, jika ada di-override, jika belum di-push
  const indeks = devicesDatabase.findIndex(d => d.serial.toLowerCase() === serial.toLowerCase());
  const dataBaru = { serial, name, model, wifi, ip, mac };

  if (indeks !== -1) {
    devicesDatabase[indeks] = dataBaru;
  } else {
    devicesDatabase.push(dataBaru);
  }

  res.json({ success: true, message: "Device registered permanently" });
});

// Update data perangkat lewat tombol simpan di form edit
app.put('/api/devices/:serial', (req, res) => {
  const { serial } = req.params;
  const { name, model, wifi, ip, mac } = req.body;

  const indeks = devicesDatabase.findIndex(d => d.serial.toLowerCase() === serial.toLowerCase());
  if (indeks !== -1) {
    devicesDatabase[indeks] = { ...devicesDatabase[indeks], name, model, wifi, ip, mac };
    return res.json({ success: true, message: "Device baseline updated" });
  }
  res.status(404).json({ success: false, message: "Device not found in DB" });
});

// Hapus perangkat permanen dari DB pusat (dipanggil via menu titik tiga)
app.delete('/api/devices/:serial', (req, res) => {
  const { serial } = req.params;
  devicesDatabase = devicesDatabase.filter(d => d.serial.toLowerCase() !== serial.toLowerCase());
  res.json({ success: true, message: "Device purged successfully" });
});

// KIRIM PERINTAH KE CLIENT.EXE (UNTUK START / STOP AUTO-HOTKEY)
app.post('/api/command', (req, res) => {
  const { deviceId, command, scriptName } = req.body;
  
  if (!deviceId || !command) {
    return res.status(400).json({ success: false, message: "Missing deviceId or command action" });
  }

  // Cari websocket si client.exe yang dituju berdasarkan hardware serial key
  const targetClient = onlineClients.get(deviceId.trim());

  if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
    // Kirim instruksi mentah ke client.exe untuk menyalakan/mematikan mesin AHK mereka
    targetClient.ws.send(JSON.stringify({
      action: command,       // 'start_ahk' atau 'stop_ahk'
      scriptName: scriptName || 'default.ahk'
    }));

    // Update status di server sementara selagi nunggu feedback detak jantung client berikutnya
    targetClient.ahkEnabled = (command === 'start_ahk');
    broadcastToDashboards();

    return res.json({ success: true, message: `Command ${command} dispatched to agent execution model` });
  }

  res.status(404).json({ success: false, message: "Target client.exe is currently offline or sleeping" });
});

// Import Massal JSON Schema
app.post('/api/devices/import', (req, res) => {
  const { devices } = req.body;
  if (Array.isArray(devices)) {
    devicesDatabase = devices; // Ganti baseline database dengan backup yang di-upload
    res.json({ success: true, message: "Database integrated successfully" });
  } else {
    res.status(400).json({ success: false });
  }
});

// Login Mock Route
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === "admin123") { // Sesuaikan password kontrol pusat abang di sini
    res.json({ success: true, token: "rh-secure-token-session-key-2026" });
  } else {
    res.status(401).json({ success: false, message: "Kata sandi salah!" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[RH SYSTEM LOG] Server Core running on port ${PORT}`);
});