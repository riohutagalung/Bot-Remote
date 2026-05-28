const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();

// =========================================================
// URUTAN KRUSIAL MIDDLEWARE: CORS DI PASTIKAN DI PALING ATAS 
// =========================================================
app.use(cors({
  origin: 'https://rhremote.vercel.app', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Mengizinkan respon Preflight OPTIONS secepat mungkin tanpa hambatan
app.options('*', cors());

app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let devicesDatabase = [
  { serial: "LAPTOP-SAMPLE123", name: "Laptop Utama Admin", model: "ThinkPad T14", wifi: "RH_Office", ip: "192.168.1.50", mac: "AA:BB:CC:DD:EE:FF" }
];

// Telemetry Pipeline memory allocation
const onlineClients = new Map(); 

// ==========================================
// MONITORING ALUR REALTIME WEBSOCKET MIKROENGINE
// ==========================================
wss.on('connection', (ws) => {
  let currentClientSerial = null;

  ws.on('message', (message) => {
    try {
      const packet = JSON.parse(message);

      // Sinkronisasi data telemetri yang dipancarkan oleh client.exe (F3 Windows Manager Tray)
      if (packet.type === 'telemetry' || packet.id) {
        const serial = (packet.id || packet.serial).trim();
        currentClientSerial = serial;

        // Validasi ganda pelacakan status engine AHK agar tidak gampang miss-state
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

      if (packet.type === 'dashboard_init') {
        ws.isDashboard = true;
        sendDeviceListToSingleClient(ws);
      }
    } catch (err) {
      console.error("Error processing packet layer:", err);
    }
  });

  ws.on('close', () => {
    if (currentClientSerial && onlineClients.has(currentClientSerial)) {
      if (onlineClients.get(currentClientSerial).ws === ws) {
        onlineClients.delete(currentClientSerial);
        broadcastToDashboards();
      }
    }
  });
});

function broadcastToDashboards() {
  const devicesArray = [];
  onlineClients.forEach((value) => {
    devicesArray.push({ id: value.id, ahkEnabled: value.ahkEnabled, info: value.info });
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

// System loop clear heartbeat zombie clients
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
// REST ENDPOINTS DATABASE LAYER
// ==========================================
app.get('/api/devices', (req, res) => {
  res.json({ success: true, devices: devicesDatabase });
});

app.post('/api/devices', (req, res) => {
  const { serial, name, model, wifi, ip, mac } = req.body;
  if (!serial) return res.status(400).json({ success: false, message: "Serial required" });
  const indeks = devicesDatabase.findIndex(d => d.serial.toLowerCase() === serial.toLowerCase());
  const dataBaru = { serial, name, model, wifi, ip, mac };
  if (indeks !== -1) devicesDatabase[indeks] = dataBaru;
  else devicesDatabase.push(dataBaru);
  res.json({ success: true, message: "Device synced" });
});

app.put('/api/devices/:serial', (req, res) => {
  const { serial } = req.params;
  const { name, model, wifi, ip, mac } = req.body;
  const indeks = devicesDatabase.findIndex(d => d.serial.toLowerCase() === serial.toLowerCase());
  if (indeks !== -1) {
    devicesDatabase[indeks] = { ...devicesDatabase[indeks], name, model, wifi, ip, mac };
    return res.json({ success: true, message: "Baseline locked" });
  }
  res.status(404).json({ success: false, message: "Device not found" });
});

app.delete('/api/devices/:serial', (req, res) => {
  const { serial } = req.params;
  devicesDatabase = devicesDatabase.filter(d => d.serial.toLowerCase() !== serial.toLowerCase());
  res.json({ success: true, message: "Device purged" });
});

// LOGIKA UTAMA: Pengontrol penembak file instruksi "script.ahk" ke komputer target
app.post('/api/command', (req, res) => {
  const { deviceId, command, scriptName } = req.body;
  const targetClient = onlineClients.get(deviceId.trim());
  
  if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
    // Dipastikan menembakkan payload default: "script.ahk" ke client.exe
    targetClient.ws.send(JSON.stringify({ 
      action: command, 
      scriptName: scriptName || 'script.ahk' 
    }));
    
    targetClient.ahkEnabled = (command === 'start_ahk');
    broadcastToDashboards();
    return res.json({ success: true, message: `Signal dispatched successfully` });
  }
  res.status(404).json({ success: false, message: "Target machine offline" });
});

app.post('/api/devices/import', (req, res) => {
  const { devices } = req.body;
  if (Array.isArray(devices)) {
    devicesDatabase = devices;
    res.json({ success: true });
  } else res.status(400).json({ success: false });
});

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === "Taikbabi182#") { 
    res.json({ success: true, token: "rh-secure-token-session-key-2026" });
  } else {
    res.status(401).json({ success: false, message: "Kata sandi salah!" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server core active on port ${PORT}`);
});