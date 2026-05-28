import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors({ 
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.options('*', cors());

app.use(express.json());

const PORT = process.env.PORT || 8080;
const DATA_FILE = path.join(__dirname, "cloud_devices.json");
const SECURE_TOKEN = "rh-secure-token-session-key-2026";

function loadCloudData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch (e) { console.error("Gagal baca database:", e.message); }
  return {};
}

function saveCloudData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) { console.error("Gagal simpan database:", e.message); }
}

let savedDevices = loadCloudData();
let deviceConnections = new Map();

app.get("/", (_, res) => res.send("WebSocket Cloud Backend Online"));

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  const rootPassword = process.env.DASHBOARD_PASSWORD || "Taikbabi182#";
  if (password === rootPassword) {
    return res.json({ success: true, token: SECURE_TOKEN });
  }
  return res.status(401).json({ success: false, message: "Kata sandi ditolak!" });
});

app.get("/api/devices", (req, res) => {
  const devicesArray = Object.values(savedDevices).map(device => {
    const cleanId = device.id.toString().trim().toLowerCase();
    const isLive = deviceConnections.has(cleanId) && deviceConnections.get(cleanId).readyState === 1;
    return {
      ...device,
      status: isLive ? "Online" : "Offline"
    };
  });
  res.json({ devices: devicesArray });
});

app.delete("/api/devices/:id", (req, res) => {
  const { id } = req.params;
  const cleanId = id.toString().trim().toLowerCase();
  
  let targetKey = null;
  if (savedDevices[cleanId]) {
    targetKey = cleanId;
  } else {
    targetKey = Object.keys(savedDevices).find(key => 
      savedDevices[key].serial && savedDevices[key].serial.toString().trim().toLowerCase() === cleanId
    );
  }

  if (targetKey && savedDevices[targetKey]) {
    delete savedDevices[targetKey];
    saveCloudData(savedDevices);
    
    if (deviceConnections.has(targetKey)) {
      deviceConnections.get(targetKey).close();
      deviceConnections.delete(targetKey);
    }
    
    broadcastToWeb();
    return res.json({ success: true, message: "Perangkat berhasil dihapus dari cloud!" });
  }
  res.status(404).json({ error: "Perangkat tidak ditemukan" });
});

// ====================================================================================
// LOGIKA SINKRONISASI TOMBOL: TERUSKAN PERINTAH TANPA MEMAKSA STATE LOKAL SERVER
// ====================================================================================
app.post("/api/command", (req, res) => {
  const { deviceId, command, scriptName } = req.body || {};
  if (!deviceId || !command) return res.status(400).json({ error: "Data kurang" });

  const cleanId = deviceId.toString().trim().toLowerCase();
  const clientWs = deviceConnections.get(cleanId);

  if (!clientWs || clientWs.readyState !== 1) {
    return res.status(404).json({ error: "Laptop sedang Offline, tidak bisa menerima perintah remote." });
  }

  // Kirim perintah murni ke Windows Client agar men-trigger run / exit aplikasi AHK asli
  clientWs.send(JSON.stringify({ 
    type: "execute_command", 
    action: command,
    scriptName: scriptName || ""
  }));

  return res.json({ success: true, message: "Perintah remote berhasil dikirim ke client!" });
});

app.put("/api/devices/:id", (req, res) => {
  const { id } = req.params;
  const updatedData = req.body || {};
  const cleanId = id.toString().trim().toLowerCase();

  if (!savedDevices[cleanId]) {
    savedDevices[cleanId] = { id: id.toString().trim() };
  }

  savedDevices[cleanId] = {
    ...savedDevices[cleanId],
    ...updatedData,
    name: updatedData.name || updatedData.hostname || savedDevices[cleanId].name || "Target PC",
    hostname: updatedData.hostname || updatedData.name || savedDevices[cleanId].hostname || "Target PC",
    lastSeen: new Date()
  };
  
  saveCloudData(savedDevices);
  broadcastToWeb();
  return res.json({ success: true, message: "Cloud database updated successfully!" });
});

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let currentDeviceId = null;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data && data.id) {
        const cleanId = data.id.toString().trim().toLowerCase();
        currentDeviceId = cleanId;
        
        deviceConnections.set(cleanId, ws);

        // Nilai ahkEnabled murni mengikuti status aslinya dari aplikasi client Windows (.exe)
        const incomingAhkStatus = typeof data.ahkEnabled === 'boolean' ? data.ahkEnabled : false;

        savedDevices[cleanId] = {
          id: data.id.toString().trim(),
          serial: data.serial || data.id.toString().trim(),
          name: data.hostname || "Target PC",
          hostname: data.hostname || "Target PC",
          model: data.model || "-",
          wifi: data.wifi || "-",
          ip: data.ip || "-",
          mac: data.mac || "-",
          ahkEnabled: incomingAhkStatus, // Status ter-update otomatis saat script AHK hidup/mati di windows taskbar
          lastSeen: new Date()
        };

        saveCloudData(savedDevices);
        broadcastToWeb();
      }
    } catch (err) { console.error(err.message); }
  });

  ws.on("close", () => {
    if (currentDeviceId) {
      deviceConnections.delete(currentDeviceId);
      broadcastToWeb();
    }
  });
});

function broadcastToWeb() {
  const devicesArray = Object.values(savedDevices).map(device => {
    const cleanId = device.id.toString().trim().toLowerCase();
    const isLive = deviceConnections.has(cleanId) && deviceConnections.get(cleanId).readyState === 1;
    return { ...device, status: isLive ? "Online" : "Offline" };
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: "device_list", devices: devicesArray }));
    }
  });
}