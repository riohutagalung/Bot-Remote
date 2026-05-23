import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Konfigurasi CORS Super Longgar Khusus Frontend Vercel Anda
app.use(cors({
  origin: [
    'https://bot-remote-iyrx.vercel.app', 
    'http://localhost:5173',               
    'http://localhost:3000'                
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

let onlineDevices = new Map(); 
let deviceConnections = new Map();

app.get("/", (_, res) => res.send("WebSocket backend online"));
app.get("/ping", (_, res) => res.status(200).send("pong"));

// ----- API ROUTES UNTUK WEB FRONTEND -----

// 1. Ambil semua data laptop yang sedang online (DIBUNGKUS OBJEK 'devices' AGAR VERCEL BISA BACA)
app.get("/api/devices", (req, res) => {
  const devicesArray = Array.from(onlineDevices.values());
  res.json({ devices: devicesArray });
});

// 2. Kirim perintah ON/OFF AutoHotkey dari Web ke Laptop tertentu
app.post("/api/command", (req, res) => {
  const { deviceId, command } = req.body || {};
  
  if (!deviceId || !command) {
    return res.status(400).json({ error: "Device ID and command required" });
  }

  const clientWs = deviceConnections.get(deviceId.toString().trim().toLowerCase());

  if (!clientWs || clientWs.readyState !== 1) { 
    return res.status(404).json({ error: "Laptop sedang offline atau tidak terhubung" });
  }

  clientWs.send(JSON.stringify({
    type: "execute_command",
    action: command 
  }));

  console.log(`[Web Command] Perintah '${command}' dikirim ke ${deviceId}`);
  res.json({ success: true, message: `Command '${command}' forwarded to device.` });
});

const server = app.listen(PORT, () => {
  console.log(`HTTP + WS server running on port ${PORT}`);
});

// ----- AKTIFKAN WEBSOCKET SERVER -----
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let currentDeviceId = null;
  console.log("Ada koneksi WebSocket baru masuk...");

  // Kirim data langsung sesaat setelah dashboard web melakukan handshake pertama
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Validasi Fleksibel: Menerima register lama ataupun payload telemetri flat baru
      if (data && (data.id || data.deviceId)) {
        const rawId = data.id || data.deviceId;
        const cleanId = rawId.toString().trim().toLowerCase();
        currentDeviceId = cleanId;
        
        deviceConnections.set(cleanId, ws);
        
        // Pemetaan data adaptif (Mendukung pembacaan flat row dashboard Anda)
        onlineDevices.set(cleanId, {
          id: rawId.toString().trim(),
          serial: data.serial || rawId.toString().trim(),
          name: data.hostname || data.name || "Target PC",
          hostname: data.hostname || "Target PC",
          model: data.model || (data.deviceInfo ? data.deviceInfo.model : "-"),
          wifi: data.wifi || (data.deviceInfo ? data.deviceInfo.wifi : "-"),
          ip: data.ip || (data.deviceInfo ? data.deviceInfo.ip : "-"),
          mac: data.mac || (data.deviceInfo ? data.deviceInfo.mac : "-"),
          ahkEnabled: typeof data.ahkEnabled === 'boolean' ? data.ahkEnabled : false,
          lastSeen: new Date()
        });

        console.log(`[Sync Berhasil] Laptop Terdeteksi Live: ${cleanId}`);
        broadcastToWeb(); 
      }

    } catch (err) {
      console.error("Gagal membaca pesan WebSocket:", err.message);
    }
  });

  ws.on("close", () => {
    if (currentDeviceId) {
      console.log(`[Disconnect] Laptop Offline: ${currentDeviceId}`);
      deviceConnections.delete(currentDeviceId);
      onlineDevices.delete(currentDeviceId); 
      broadcastToWeb(); 
    }
  });
});

function broadcastToWeb() {
  const devicesArray = Array.from(onlineDevices.values());
  const payload = JSON.stringify({
    type: "device_list",
    devices: devicesArray
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

process.on('uncaughtException', (err) => console.error('System bypass error:', err.message));