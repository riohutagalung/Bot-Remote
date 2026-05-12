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

app.get("/", (_, res) => {
  res.send("WebSocket backend online");
});

const server = app.listen(PORT, () => {
  console.log(`HTTP + WS server running on port ${PORT}`);
});

const wss = new WebSocketServer({ server });
app.get("/ping", (_, res) => res.status(200).send("pong"));