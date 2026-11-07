import express from "express";
import {installAhkCommands} from "./ahk-server.js";
import crypto from "node:crypto";
import { installDesktop } from "./desktop-server.js";
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
    origin: process.env.DASHBOARD_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
// CORS preflight handled above.
// // Bypass preflight request dari browser

app.use(express.json());

const PORT = process.env.PORT || 8080;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "cloud_devices.json");

// Server-side credentials and expiring dashboard sessions.
const dashboardPassword = process.env.DASHBOARD_PASSWORD;
const agentToken = process.env.AGENT_TOKEN;
if (!dashboardPassword || dashboardPassword.length < 12 || !agentToken || agentToken.length < 32) {
  throw new Error("Set DASHBOARD_PASSWORD (12+ chars) and AGENT_TOKEN (32+ chars)");
}
const sessions = new Map();
const loginAttempts = new Map();
const validSession = token => sessions.get(token) > Date.now();
const sameSecret = (a, b) => typeof a === "string" && crypto.timingSafeEqual(crypto.createHash("sha256").update(a).digest(), crypto.createHash("sha256").update(b).digest());



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
let savedDevices = Object.assign(Object.create(null), loadCloudData());
let deviceConnections = new Map(); // Menyimpan koneksi WS aktif

app.use(express.static(path.join(__dirname, "dist")));

// =================================================================
// LOGIN VALIDASI
// =================================================================
app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  const rootPassword = dashboardPassword;
  const now = Date.now();
  const loginKey = req.ip;
  for (const [key, value] of loginAttempts) if (value.until < now) loginAttempts.delete(key);
  const attempts = loginAttempts.get(loginKey) || {count:0, until:now+60000};
  if (attempts.count >= 10) return res.status(429).json({error:"Terlalu banyak percobaan. Coba lagi sebentar."});
  attempts.count++; loginAttempts.set(loginKey, attempts);

  if (sameSecret(password, rootPassword)) {
    for (const [token, expires] of sessions) if (expires <= Date.now()) sessions.delete(token);
    const SECURE_TOKEN = crypto.randomBytes(32).toString("hex");
    sessions.set(SECURE_TOKEN, Date.now() + 8 * 60 * 60 * 1000);
    return res.json({ success: true, token: SECURE_TOKEN });
  }
  return res.status(401).json({ success: false, message: "Kata sandi ditolak!" });
});

app.use("/api", (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!validSession(token)) return res.status(401).json({ error: "Login diperlukan / sesi kedaluwarsa" });
  next();
});
app.post("/api/logout", (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  sessions.delete(token);
  wss.clients.forEach(ws => { if (ws.role === "dashboard" && ws.session === token) ws.close(1008, "Logged out"); });
  res.json({ success: true });
});
const desktop = installDesktop(app, deviceConnections);

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
// API DELETE DEVICE (authenticated by /api middleware)
// =================================================================
app.delete("/api/devices/:id", (req, res) => {
  const { id } = req.params;

  const cleanId = id.toString().trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,128}$/.test(cleanId)) return res.status(400).json({error: "ID tidak valid"});
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
const ahkCommands = installAhkCommands(app, deviceConnections);

// =================================================================
// API PUT UNTUK SAVE / UPDATE DATA MANUAL
// =================================================================
app.put("/api/devices/:id", (req, res) => {
  const { id } = req.params;
  const updatedData = Object.fromEntries(["name", "hostname", "model", "wifi", "ip", "mac", "serial"].filter(k => typeof req.body?.[k] === "string").map(k => [k, req.body[k].slice(0, 256)]));
  const cleanId = id.toString().trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,128}$/.test(cleanId)) return res.status(400).json({error: "ID tidak valid"});

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
export const server = app.listen(PORT, process.env.HOST || "127.0.0.1", () =>
  console.log(`Server running on port ${PORT}`)
);
export const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 * 1024 });

const heartbeat = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive || (ws.role === "dashboard" && !validSession(ws.session))) return ws.terminate();
    ws.isAlive = false; ws.ping();
  });
}, 30000);
wss.on("close", () => clearInterval(heartbeat));

// Ketika client (Laptop) terhubung via WebSocket
wss.on("connection", (ws) => {
  ws.role = null;
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("error", () => {});
  const authTimer = setTimeout(() => ws.close(1008, "Authentication timeout"), 5000);
  let currentDeviceId = null;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (!ws.role) {
        if (data.type === "dashboard_auth" && validSession(data.token)) {
          ws.role = "dashboard"; ws.session = data.token; clearTimeout(authTimer); broadcastToWeb(); return;
        }
        if (data.type !== "agent_auth" || !sameSecret(data.token, agentToken)) return ws.close(1008, "Unauthorized");
        ws.role = "agent"; clearTimeout(authTimer);
      }
      if (ws.role !== "agent") return;
      if (desktop.handle(ws, data) || ahkCommands.handle(ws,data)) return;
      if (data.type === "agent_auth" && currentDeviceId) return ws.close(1008, "Already registered");


      // HANDSHAKE AWAL (laporan identitas device)
      if (data && typeof data.id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(data.id) && data.type === "agent_auth") {
        const cleanId = data.id.toString().trim().toLowerCase();
        currentDeviceId = cleanId;
        const previous = deviceConnections.get(cleanId);
        deviceConnections.set(cleanId, ws);
        ws.deviceId = cleanId;
        if (previous && previous !== ws) previous.close(1000, "Replaced");

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
          desktopEnabled: data.desktopEnabled === true,
          ahkKnown: data.ahkKnown === true,
          ahkError: typeof data.ahkError === "string" ? data.ahkError.slice(0,600) : "",
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
      if (data.type === "ahk_status" && data.id && data.id.toLowerCase() === currentDeviceId) {
        const cleanId = data.id.toString().trim().toLowerCase();
        if (savedDevices[cleanId]) {
          savedDevices[cleanId].ahkEnabled = !!data.ahkEnabled;
          savedDevices[cleanId].ahkKnown = data.ahkKnown === true;
          savedDevices[cleanId].ahkError = String(data.ahkError || "").slice(0,600);
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
    clearTimeout(authTimer);
    desktop.disconnect(ws);
    ahkCommands.disconnect(ws);
    if (currentDeviceId && deviceConnections.get(currentDeviceId) === ws) {
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
    if (client.readyState === 1 && client.role === "dashboard" && validSession(client.session)) {
      client.send(JSON.stringify({ type: "device_list", devices: devicesArray }));
    }
  });
}