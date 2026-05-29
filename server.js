import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// =================================================================
// PERBAIKAN DI SINI: Mengizinkan PUT & OPTIONS agar Vercel tidak diblokir
// =================================================================
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.options("*", cors()); // Bypass preflight request dari browser

app.use(express.json());

const PORT = process.env.PORT || 8080;
const DATA_FILE = path.join(__dirname, "cloud_devices.json");

// Token keamanan statis (harus sama dengan front-end)
const SECURE_TOKEN = "rh-secure-token-session-key-2026";

// --- LOGIKA DATABASE CLOUD (JSON FILE) ---
function loadCloudData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Gagal baca database:", e.message);
  }
  return {};
}

function saveCloudData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Gagal simpan database:", e.message);
  }
}

// Inisialisasi data awal
let savedDevices = loadCloudData();
let deviceConnections = new Map(); // Menyimpan koneksi WS aktif

app.get("/", (_, res) => res.send("WebSocket Cloud Backend Online"));

// =================================================================
// LOGIN VALIDASI
// =================================================================
app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  const rootPassword = process.env.DASHBOARD_PASSWORD || "Taikbabi182#";

  if (password === rootPassword) {
    return res.json({ success: true, token: SECURE_TOKEN });
  }
  return res.status(401).json({ success: false, message: "Kata sandi ditolak!" });
});

// =================================================================
// API GET DEVICES
// =================================================================
app.get("/api/devices", (req, res) => {
  const devicesArray = Object.values(savedDevices).map((device) => {
    const cleanId = device.id?.toString().trim().toLowerCase();
    const isLive =
      deviceConnections.has(cleanId) &&
      deviceConnections.get(cleanId).readyState === 1;
    return { ...device, status: isLive ? "Online" : "Offline" };
  });
  res.json({ devices: devicesArray });
});

// =================================================================
// API DELETE DEVICE TANPA TOKEN (sesuai permintaan)
// =================================================================
app.delete("/api/devices/:id", (req, res) => {
  const { id } = req.params;

  const cleanId = id.toString().trim().toLowerCase();
  let targetKey = null;

  if (savedDevices[cleanId]) {
    targetKey = cleanId;
  } else {
    targetKey = Object.keys(savedDevices).find(
      (key) =>
        savedDevices[key].serial &&
        savedDevices[key].serial.toString().trim().toLowerCase() === cleanId
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
    return res.json({
      success: true,
      message: "Perangkat berhasil dihapus dari cloud!",
    });
  }

  res.status(404).json({ error: "Perangkat tidak ditemukan" });
});

// =================================================================
// API COMMAND UNTUK START/STOP AHK DARI DASHBOARD
// =================================================================
app.post("/api/command", (req, res) => {
  const { deviceId, command } = req.body || {};
  if (!deviceId || !command)
    return res.status(400).json({ error: "Data kurang" });

  const cleanId = deviceId.toString().trim().toLowerCase();
  const clientWs = deviceConnections.get(cleanId);

  if (!clientWs || clientWs.readyState !== 1) {
    return res
      .status(404)
      .json({ error: "Laptop sedang Offline, tidak bisa menerima perintah remote." });
  }

  // Update status sementara di cloud (biar dashboard langsung refresh)
  if (savedDevices[cleanId]) {
    savedDevices[cleanId].ahkEnabled = command === "start_ahk";
    savedDevices[cleanId].lastSeen = new Date();
    saveCloudData(savedDevices);
    broadcastToWeb();
  }

  // Kirim perintah ke client
  clientWs.send(JSON.stringify({ type: "execute_command", action: command }));
  res.json({ success: true });
});

// =================================================================
// API PUT UNTUK SAVE / UPDATE DATA MANUAL
// =================================================================
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
    name:
      updatedData.name ||
      updatedData.hostname ||
      savedDevices[cleanId].name ||
      "Target PC",
    hostname:
      updatedData.hostname ||
      updatedData.name ||
      savedDevices[cleanId].hostname ||
      "Target PC",
    lastSeen: new Date(),
  };

  saveCloudData(savedDevices);
  broadcastToWeb();

  return res.json({
    success: true,
    message: "Cloud database updated successfully!",
  });
});

// =================================================================
// WEBSOCKET SERVER
// =================================================================
const server = app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
const wss = new WebSocketServer({ server });

// Ketika client (Laptop) terhubung via WebSocket
wss.on("connection", (ws) => {
  let currentDeviceId = null;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      // HANDSHAKE AWAL (laporan identitas device)
      if (data && data.id && !data.type) {
        const cleanId = data.id.toString().trim().toLowerCase();
        currentDeviceId = cleanId;
        deviceConnections.set(cleanId, ws);

        savedDevices[cleanId] = {
          ...savedDevices[cleanId],
          id: data.id.toString().trim(),
          serial: data.serial || data.id.toString().trim(),
          name: data.hostname || "Target PC",
          hostname: data.hostname || "Target PC",
          model: data.model || "-",
          wifi: data.wifi || "-",
          ip: data.ip || "-",
          mac: data.mac || "-",
          ahkEnabled:
            typeof data.ahkEnabled === "boolean"
              ? data.ahkEnabled
              : false,
          lastSeen: new Date(),
        };

        saveCloudData(savedDevices);
        broadcastToWeb();
        return;
      }

      // PESAN STATUS AHK DARI CLIENT
      if (data.type === "ahk_status" && data.id) {
        const cleanId = data.id.toString().trim().toLowerCase();
        if (savedDevices[cleanId]) {
          savedDevices[cleanId].ahkEnabled = !!data.ahkEnabled;
          savedDevices[cleanId].lastSeen = new Date();
          saveCloudData(savedDevices);
          broadcastToWeb();
        }
        return;
      }
    } catch (err) {
      console.error("WS parse failed:", err.message);
    }
  });

  ws.on("close", () => {
    if (currentDeviceId) {
      deviceConnections.delete(currentDeviceId);
      broadcastToWeb();
    }
  });
});

// =================================================================
// BROADCAST FUNCTION
// =================================================================
function broadcastToWeb() {
  const devicesArray = Object.values(savedDevices).map((device) => {
    const cleanId = device.id?.toString().trim().toLowerCase();
    const isLive =
      deviceConnections.has(cleanId) &&
      deviceConnections.get(cleanId).readyState === 1;
    return { ...device, status: isLive ? "Online" : "Offline" };
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: "device_list", devices: devicesArray }));
    }
  });
}