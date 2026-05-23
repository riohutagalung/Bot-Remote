import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Konfigurasi CORS eksplisit untuk Frontend Vercel Anda
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

// 1. Ambil semua data laptop yang sedang online (Format FLAT agar tabel Dashboard tidak kosong)
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

  // Kirim sinyal instruksi ke client.cjs
  clientWs.send(JSON.stringify({
    type: "execute_command",
    action: command // "start_ahk" atau "stop_ahk"
  }));

  console.log(`[Web Command] Perintah '${command}' dikirim ke ${deviceId}`);
  res.json({ success: true, message: `Command '${command}' forwarded to device.` });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 HTTP + WS server running on port ${PORT}`);
});

// PROSES WEBSOCKET SERVER
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let currentDeviceId = null;
  console.log("🔌 Ada koneksi WebSocket baru masuk...");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      // JIKA CLIENT MENDAFTARKAN DIRI / KIRIM HEARTBEAT TELEMETRI
      if (data && data.id) {
        const cleanId = data.id.toString().trim().toLowerCase();
        currentDeviceId = cleanId;
        
        deviceConnections.set(cleanId, ws);
        
        // Simpan dengan struktur FLAT agar langsung terbaca di komponen UI Dashboard Anda
        onlineDevices.set(cleanId, {
          id: data.id,
          ahkEnabled: typeof data.ahkEnabled === 'boolean' ? data.ahkEnabled : false,
          hostname: data.hostname || '-',
          model: data.model || '-',
          wifi: data.wifi || '-',
          ip: data.ip || '-',
          mac: data.mac || '-',
          lastSeen: new Date()
        });

        console.log(`[Telemetry Sync] Device: ${cleanId} | AHK: ${data.ahkEnabled}`);
        broadcastToWeb(); 
      }
    } catch (err) {
      console.error("Gagal membaca pesan WebSocket:", err.message);
    }
  });

  ws.on("close", () => {
    if (currentDeviceId) {
      console.log(`❌ [Disconnect] Laptop Offline: ${currentDeviceId}`);
      deviceConnections.delete(currentDeviceId);
      onlineDevices.delete(currentDeviceId); 
      broadcastToWeb(); 
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket Socket Error:", err.message);
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

// Penyelamat dari crash global
process.on('uncaughtException', (err) => console.error('🚨 Fatal Error:', err.message));
process.on('unhandledRejection', (reason) => console.error('🚨 Unhandled Promise:', reason));