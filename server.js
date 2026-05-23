import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

const PORT = process.env.PORT || 8080;
const DATA_FILE = path.join(__dirname, "cloud_devices.json");

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

// 2. API UNTUK MENGHAPUS LAPTOP DENGAN SANDI KHUSUS
app.delete("/api/devices/:id", (req, res) => {
  const { id } = req.params;
  const { password } = req.body || {};

  // Validasi sandi sakral milikmu
  if (password !== "Taikbabi182#") {
    return res.status(403).json({ error: "Sandi salah! Anda tidak berhak menghapus perangkat ini." });
  }

  const cleanId = id.toString().trim().toLowerCase();
  if (savedDevices[cleanId]) {
    delete savedDevices[cleanId];
    saveCloudData(savedDevices); // Hapus permanen dari cloud data
    
    // Putus hubungan jika perangkat sedang online
    if (deviceConnections.has(cleanId)) {
      deviceConnections.get(cleanId).close();
      deviceConnections.delete(cleanId);
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
    // Pastikan field nama/hostname tidak hilang jika diinput manual
    name: updatedData.name || updatedData.hostname || savedDevices[cleanId].name || "Target PC",
    hostname: updatedData.hostname || updatedData.name || savedDevices[cleanId].hostname || "Target PC",
    lastSeen: new Date()
  };
  
  saveCloudData(savedDevices); // Kunci aman ke cloud_devices.json
  broadcastToWeb(); // Semburkan data terbaru ke seluruh tampilan web
  
  return res.json({ success: true, message: "Cloud database updated successfully!" });
});