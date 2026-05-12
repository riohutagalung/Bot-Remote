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

// endpoint untuk test backend
app.get("/", (_, res) => res.send("WebSocket backend online"));
app.get("/ping", (_, res) => res.status(200).send("pong"));

// jalankan server HTTP dan WebSocket di port yang sama
const server = app.listen(PORT, () => {
  console.log(`HTTP + WS server running on port ${PORT}`);
});

// aktifkan WebSocket
const wss = new WebSocketServer({ server });
// ----- API ROUTES FOR FRONTEND -----
app.get("/api/devices", (req, res) => {
  // misal: kirim list kosong dulu, nanti bisa diganti kirim devices sebenarnya
  res.json([]);
});

app.post("/api/command", (req, res) => {
  const { deviceId, command } = req.body || {};
  if (!deviceId || !command) {
    return res.status(400).json({ error: "Device ID and command required" });
  }
  // sementara langsung sukses
  res.json({ success: true, deviceId, command });
});