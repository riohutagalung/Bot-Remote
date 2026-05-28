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
app.use(cors({ 
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.options('*', cors()); // Bypass preflight request dari browser

app.use(express.json());

const PORT = process.env.PORT || 8080;
const DATA_FILE = path.join(__dirname, "cloud_devices.json");

// Kunci token statis rahasia sebagai pengganti verifikasi teks password di front-end
const SECURE_TOKEN = "rh-secure-token-session-key-2026";

// --- LOGIKA DATABASE CLOUD CLOUD DATA (JSON FILE) ---
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

// Inisialisasi data dari database cloud saat server pertama kali hidup
let savedDevices = loadCloudData();
let deviceConnections = new Map(); // Menyimpan koneksi live WS saja

app.get("/", (_, res) => res.send("WebSocket Cloud Backend Online"));

// =================================================================
// ENDPOINT BARU: Validasi password aman di dalam server (Anti-Inspect)
// =================================================================
app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  const rootPassword = process.env.DASHBOARD_PASSWORD || "Taikbabi182#";

  if (password === rootPassword) {
    // Jika benar, kirim token acak sukses, bukan teks password aslinya
    return res.json({ success: true, token: SECURE_TOKEN });
  }
  return res.status(401).json({ success: false, message: "Kata sandi ditolak!" });
});

// 1. API UNTUK AMBIL DATA (Gabungkan data tersimpan dengan status LIVE)
app.get("/api/devices", (req, res) => {
  const devicesArray = Object.values(savedDevices).map(device => {
    const cleanId = device.id.toString().trim().toLowerCase();
    const isLive = deviceConnections.has(cleanId) && deviceConnections.get(cleanId).readyState === 1;
    return {
      ...device,
      status: isLive ? "Online" : "Offline" // Menampilkan status real-time di web
    };
  });
  res.json({ devices: devicesArray });
});

// ====================================================================================
// 2. API UNTUK MENGHAPUS LAPTOP DENGAN VERIFIKASI HEADER TOKEN (AMAN 100%)
// PERBAIKAN: Menambahkan fallback check jika parameter yang dikirim berupa serial/id string
// ====================================================================================
app.delete("/api/devices/:id", (req, res) => {
  const { id } = req.params;
  
  // Ambil token dari header Authorization untuk memverifikasi hak akses hapus
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${SECURE_TOKEN}`) {
    return res.status(403).json({ error: "Sandi salah atau Kedaluwarsa! Anda tidak berhak menghapus perangkat ini (403)." });
  }

  const cleanId = id.toString().trim().toLowerCase();
  
  // Cari target penghapusan baik berdasarkan Key ID utama ataupun property Serial di dalamnya
  let targetKey = null;
  if (savedDevices[cleanId]) {
    targetKey = cleanId;
  } else {
    // Fallback lookup: Cari secara dinamis jika App.jsx melempar serial key mentah
    targetKey = Object.keys(savedDevices).find(key => 
      savedDevices[key].serial && savedDevices[key].serial.toString().trim().toLowerCase() === cleanId
    );
  }

  if (targetKey && savedDevices[targetKey]) {
    delete savedDevices[targetKey];
    saveCloudData(savedDevices); // Hapus permanen dari cloud data
    
    // Putus hubungan jika perangkat sedang online
    if (deviceConnections.has(targetKey)) {
      deviceConnections.get(targetKey).close();
      deviceConnections.delete(targetKey);
    }
    
    broadcastToWeb();
    return res.json({ success: true, message: "Perangkat berhasil dihapus dari cloud!" });
  }
  
  res.status(404).json({ error: "Perangkat tidak ditemukan" });
});

// 3. API KIRIM PERINTAH ON/OFF KE LAPTOP
app.post("/api/command", (req, res) => {
  const { deviceId, command } = req.body || {};
  if (!deviceId || !command) return res.status(400).json({ error: "Data kurang" });

  const cleanId = deviceId.toString().trim().toLowerCase();
  const clientWs = deviceConnections.get(cleanId);

  if (!clientWs || clientWs.readyState !== 1) {
    return res.status(404).json({ error: "Laptop sedang Offline, tidak bisa menerima perintah remote." });
  }

  clientWs.send(JSON.stringify({ type: "execute_command", action: command }));
  res.json({ success: true });
});

// 4. API UNTUK MEMPERBARUI / MENYIMPAN DATA DARI VERCEL (PERBAIKAN FITUR PUT)
app.put("/api/devices/:id", (req, res) => {
  const { id } = req.params;
  const updatedData = req.body || {};
  const cleanId = id.toString().trim().toLowerCase();

  // Jika data belum ada sama sekali di database, kita buatkan objek baru (Upsert logic)
  if (!savedDevices[cleanId]) {
    savedDevices[cleanId] = { id: id.toString().trim() };
  }

  // Gabungkan data lama dengan data baru yang diinput dari web dashboard
  savedDevices[cleanId] = {
    ...savedDevices[cleanId],
    ...updatedData,
    name: updatedData.name || updatedData.hostname || savedDevices[cleanId].name || "Target PC",
    hostname: updatedData.hostname || updatedData.name || savedDevices[cleanId].hostname || "Target PC",
    lastSeen: new Date()
  };
  
  saveCloudData(savedDevices); // Kunci aman ke cloud_devices.json
  broadcastToWeb(); // Semburkan data terbaru ke seluruh tampilan web
  
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

        // Simpan / Update data permanen di Cloud Data
        savedDevices[cleanId] = {
          id: data.id.toString().trim(),
          serial: data.serial || data.id.toString().trim(),
          name: data.hostname || "Target PC",
          hostname: data.hostname || "Target PC",
          model: data.model || "-",
          wifi: data.wifi || "-",
          ip: data.ip || "-",
          mac: data.mac || "-",
          ahkEnabled: typeof data.ahkEnabled === 'boolean' ? data.ahkEnabled : false,
          lastSeen: new Date()
        };

        saveCloudData(savedDevices); // Kunci data ke dalam file JSON agar tidak hilang saat server restart
        broadcastToWeb();
      }
    } catch (err) { console.error(err.message); }
  });

  ws.on("close", () => {
    if (currentDeviceId) {
      deviceConnections.delete(currentDeviceId);
      broadcastToWeb(); // Jangan dihapus dari savedDevices agar tetap tampil di tabel sebagai "Offline"
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