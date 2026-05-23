import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// DATABASE SEMENTARA (Disimpan di Memori Server)
// Menyimpan data laptop yang sedang aktif/online
let onlineDevices = new Map(); 

// Menyimpan koneksi WebSocket berdasarkan deviceId agar bisa dikontrol balik
let deviceConnections = new Map();

// Endpoint untuk cek status backend
app.get("/", (_, res) => res.send("WebSocket backend online"));
app.get("/ping", (_, res) => res.status(200).send("pong"));

// ----- API ROUTES UNTUK WEB FRONTEND -----

// 1. Ambil semua data laptop yang sedang online
app.get("/api/devices", (req, res) => {
  const devicesArray = Array.from(onlineDevices.values());
  res.json(devicesArray);
});

// 2. Kirim perintah ON/OFF AutoHotkey dari Web ke Laptop tertentu
app.post("/api/command", (req, res) => {
  const { deviceId, command } = req.body || {};
  
  if (!deviceId || !command) {
    return res.status(400).json({ error: "Device ID and command required" });
  }

  // Cari koneksi WebSocket milik laptop tersebut
  const clientWs = deviceConnections.get(deviceId);

  if (!clientWs || clientWs.readyState !== 1) { // 1 berarti OPEN
    return res.status(404).json({ error: "Laptop sedang offline atau tidak terhubung" });
  }

  // Kirim perintah langsung ke client.exe lewat WebSocket
  clientWs.send(JSON.stringify({
    type: "execute_command",
    deviceId: deviceId,
    command: command // "start_ahk" atau "stop_ahk"
  }));

  console.log(`[Web Command] Perintah '${command}' dikirim ke ${deviceId}`);
  res.json({ success: true, message: `Command '${command}' forwarded to device.` });
});


// ----- JALANKAN SERVER -----
const server = app.listen(PORT, () => {
  console.log(`HTTP + WS server running on port ${PORT}`);
});


// ----- AKTIFKAN WEBSOCKET SERVER -----
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let currentDeviceId = null;

  console.log("Ada koneksi WebSocket baru masuk...");

  // Mendengarkan data yang dikirim oleh client.exe atau Web Frontend
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      // JIKA CLIENT.EXE MENDAFTARKAN DIRI (LAPTOP ONLINE)
      if (data.type === "register") {
        currentDeviceId = data.deviceId;
        
        // Simpan koneksi ws dan data info laptopnya
        deviceConnections.set(currentDeviceId, ws);
        onlineDevices.set(currentDeviceId, {
          id: data.deviceId,
          info: data.deviceInfo,
          ahkEnabled: false, // default mati saat baru connect
          lastSeen: new Date()
        });

        console.log(`[Register] Laptop Online: ${currentDeviceId}`);
        broadcastToWeb(); // Beritahu web secara real-time
      }

      // JIKA CLIENT.EXE MEMBERIKAN LAPORAN STATUS AHK SETELAH DI-KLIK
      if (data.type === "status_update") {
        if (onlineDevices.has(data.deviceId)) {
          const device = onlineDevices.get(data.deviceId);
          device.ahkEnabled = data.status.ahkEnabled; // update status true/false
          device.lastSeen = new Date();
          onlineDevices.set(data.deviceId, device);

          console.log(`[Status Update] ${data.deviceId} -> AHK Enabled: ${data.status.ahkEnabled}`);
          broadcastToWeb(); // Beritahu web secara real-time
        }
      }

    } catch (err) {
      console.error("Gagal membaca pesan WebSocket:", err.message);
    }
  });

  // JIKA LAPTOP / CLIENT.EXE TERPUTUS (CLOSED)
  ws.on("close", () => {
    if (currentDeviceId) {
      console.log(`[Disconnect] Laptop Offline: ${currentDeviceId}`);
      deviceConnections.delete(currentDeviceId);
      onlineDevices.delete(currentDeviceId); // Hapus dari daftar online
      broadcastToWeb(); // Beritahu web kalau laptop sudah offline
    }
  });
});

// Fungsi otomatis untuk menyebarkan (broadcast) data terbaru ke semua Web Frontend yang nempel
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