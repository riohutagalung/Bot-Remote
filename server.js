const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();

// ==========================================
// FIX KENDALA CORS POLICY (IZIN UNTUK VERCEL)
// ==========================================
app.use(cors({
  origin: 'https://rhremote.vercel.app', // Mengizinkan domain Vercel abang
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Menangani Preflight Request (OPTIONS) secara global agar browser tidak memblokir API
app.options('*', cors());

app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// DATABASE SIMULASI (Baseline perangkat terdaftar)
let devicesDatabase = [
  { serial: "LAPTOP-SAMPLE123", name: "Laptop Utama Admin", model: "ThinkPad T14", wifi: "RH_Office", ip: "192.168.1.50", mac: "AA:BB:CC:DD:EE:FF" }
];

// LIVE TELEMETRY MEMORY (Menampung koneksi aktif dari client.exe)
const onlineClients = new Map(); 

// ==========================================
// PIPELINE WEBSOCKET (REALTIME TELEMETRI & HARDWARE)
// ==========================================
wss.on('connection', (ws, req) => {
  let currentClientSerial = null;

  ws.on('message', (message) => {
    try {
      const packet = JSON.parse(message);

      // KONDISI A: Paket data telemetri masuk dari aplikasi client.exe
      if (packet.type === 'telemetry' || packet.id) {
        const serial = (packet.id || packet.serial).trim();
        currentClientSerial = serial;

        // Mendeteksi status AHK dari windows manager client.exe secara fleksibel
        const isAhkRunning = packet.ahkEnabled === true || packet.isAhkRunning === true || packet.info?.ahkEnabled === true;

        onlineClients.set(serial, {
          id: serial,
          ws: ws,
          lastSeen: Date.now(),
          ahkEnabled: isAhkRunning,
          info: {
            hostname: packet.name || packet.info?.hostname || "Windows Client",
            model: packet.model || packet.info?.model || "-",
            wifi: packet.wifi || packet.info?.wifi || "-",
            ip: packet.ip || packet.info?.ip || "-",
            mac: packet.mac || packet.info?.mac || "-"
          }
        });

        broadcastToDashboards();
      }

      // KONDISI B: Inisialisasi koneksi dari dashboard web React (Vercel)
      if (packet.type === 'dashboard_init') {
        ws.isDashboard = true;
        sendDeviceListToSingleClient(ws);
      }

    } catch (err) {
      console.error("Error parsing WS packet:", err);
    }
  });

  // JIKA CLIENT.EXE MATI ATAU PUTUS JALUR KONEKSI
  ws.on('close', () => {
    if (currentClientSerial && onlineClients.has(currentClientSerial)) {
      if (onlineClients.get(currentClientSerial).ws === ws) {
        onlineClients.delete(currentClientSerial);
        broadcastToDashboards();
      }
    }
  });
});

// Broadcast telemetri ke semua dashboard React yang sedang memonitoring
function broadcastToDashboards() {
  const devicesArray = [];
  onlineClients.forEach((value) => {
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

// Heartbeat interval untuk membersihkan data client gantung (DC tanpa alert close)
setInterval(() => {
  const kini = Date.now();
  let adaPerubahan = false;
  onlineClients.forEach((value, key) => {
    if (kini - value.lastSeen > 12000) { 
      onlineClients.delete(key);
      adaPerubahan = true;
    }
  });
  if (adaPerubahan) broadcastToDashboards();
}, 5000);


// ==========================================
// ENDPOINT HTTP API (UNTUK SINKRONISASI DATABASE)
// ==========================================

// Ambil semua data perangkat dari DB
app.get('/api/devices', (req, res) => {
  res.json({ success: true, devices: devicesDatabase });
});

// Daftarkan perangkat baru / manual override
app.post('/api/devices', (req, res) => {
  const { serial, name, model, wifi, ip, mac } = req.body;
  if (!serial) return res.status(400).json({ success: false, message: "Serial required" });

  const indeks = devicesDatabase.findIndex(d => d.serial.toLowerCase() === serial.toLowerCase());
  const dataBaru = { serial, name, model, wifi, ip, mac };

  if (indeks !== -1) {
    devicesDatabase[indeks] = dataBaru;
  } else {
    devicesDatabase.push(dataBaru);
  }

  res.json({ success: true, message: "Device registered permanently" });
});

// Update data baseline lewat form ubah (Edit)
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

// Hapus perangkat dari database (Fitur menu titik tiga)
app.delete('/api/devices/:serial', (req, res) => {
  const { serial } = req.params;
  devicesDatabase = devicesDatabase.filter(d => d.serial.toLowerCase() !== serial.toLowerCase());
  res.json({ success: true, message: "Device purged successfully" });
});

// KIRIM SINYAL PERINTAH HIDUP/MATI AHK KE CLIENT.EXE
app.post('/api/command', (req, res) => {
  const { deviceId, command, scriptName } = req.body;
  
  if (!deviceId || !command) {
    return res.status(400).json({ success: false, message: "Missing deviceId or command action" });
  }

  const targetClient = onlineClients.get(deviceId.trim());

  if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
    // Kirim instruksi ke client.exe untuk kontrol mesin AutoHotkey
    targetClient.ws.send(JSON.stringify({
      action: command,       // 'start_ahk' atau 'stop_ahk'
      scriptName: scriptName || 'default.ahk'
    }));

    targetClient.ahkEnabled = (command === 'start_ahk');
    broadcastToDashboards();

    return res.json({ success: true, message: `Command ${command} dispatched successfully` });
  }

  res.status(404).json({ success: false, message: "Target client.exe is offline" });
});

// Import massal JSON schema backup
app.post('/api/devices/import', (req, res) => {
  const { devices } = req.body;
  if (Array.isArray(devices)) {
    devicesDatabase = devices;
    res.json({ success: true, message: "Database integrated successfully" });
  } else {
    res.status(400).json({ success: false });
  }
});

// Endpoint Autentikasi Login Dashboard Pusat
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === "admin123") { // Ganti password di sini sesuai kebutuhan
    res.json({ success: true, token: "rh-secure-token-session-key-2026" });
  } else {
    res.status(401).json({ success: false, message: "Kata sandi salah!" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[RH SYSTEM LOG] Server Core running on port ${PORT}`);
});