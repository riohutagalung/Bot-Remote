// RH Remote Client - Stable Edition (Reconnect + Detect Standby)
const WebSocket = require("ws");
const { exec, execSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const SERVER_URL = "wss://bot-remote-production.up.railway.app";
const CURRENT_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

let wsGlobal = null;
let statusAhkSaatIni = null; // null = belum diketahui

// ---------- utilitas sistem ----------
function getSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    serial: getSerialNumber(),
    wifi: getWifiSSID(),
    ip: getLocalIP(),
    mac: getMAC()
  };
}

function getSerialNumber() {
  try {
    const o = execSync("wmic bios get serialnumber /value", { encoding: "utf8" });
    const m = o.match(/SerialNumber=(\\S+)/);
    return m ? m[1] : "UNKNOWN";
  } catch { return "UNKNOWN"; }
}
function getWifiSSID() {
  try {
    const o = execSync("netsh wlan show interfaces", { encoding: "utf8" });
    const m = o.match(/SSID\\s*:\\s*(.+)/);
    return m ? m[1].trim() : "-";
  } catch { return "-"; }
}
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets))
    for (const n of nets[name]) if (n.family === "IPv4" && !n.internal) return n.address;
  return "-";
}
function getMAC() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets))
    for (const n of nets[name])
      if (n.mac && n.mac !== "00:00:00:00:00:00") return n.mac;
  return "-";
}

// ---------- fungsi kirim status ----------
function kirimTelemetri() {
  if (!wsGlobal || wsGlobal.readyState !== WebSocket.OPEN) return;
  const info = getSystemInfo();
  const payload = {
    type: "ahk_status",
    id: info.serial.replace(/[^\w-]/g, "_"),
    ahkEnabled: statusAhkSaatIni,
    hostname: info.hostname,
    model: `${info.platform} (${info.arch})`,
    wifi: info.wifi,
    ip: info.ip,
    mac: info.mac
  };
  wsGlobal.send(JSON.stringify(payload));
  console.log(`[Telemetry] Status => ${statusAhkSaatIni ? "ON" : "OFF"}`);
}

// ---------- kontrol AHK ----------
function kendalikanAhkBalikLayar(aksi, scriptName = "") {
  return new Promise(resolve => {
    if (os.platform() !== "win32") return resolve();

    let cmd = "";
    if (aksi === "start") {
      let fileTarget = scriptName;
      if (!fileTarget) {
        const files = fs.readdirSync(CURRENT_DIR);
        const ahk = files.find(f => f.toLowerCase().endsWith(".ahk"));
        if (!ahk) {
          console.log("[!] Tidak ada file .ahk di folder client");
          return resolve();
        }
        fileTarget = ahk;
      }
      const full = path.join(CURRENT_DIR, fileTarget);
      cmd = `start "" "${full}"`;
      console.log(`[RUN] Jalankan AHK: ${full}`);
    } else if (aksi === "stop") {
      cmd = `taskkill /F /IM AutoHotkey*.exe >nul 2>nul`;
      console.log("[KILL] Matikan AutoHotkey.exe");
    }

    exec(cmd, () => {
      setTimeout(() => periksaStatusAhk().then(resolve), 1000);
    });
  });
}

// ---------- deteksi proses ----------
function periksaStatusAhk() {
  return new Promise(resolve => {
    exec('tasklist /FI "IMAGENAME eq AutoHotkey.exe"', (err, out) => {
      const aktif = !err && out.toLowerCase().includes("autohotkey.exe");
      // kirim hanya kalau berubah
      if (statusAhkSaatIni !== aktif) {
        statusAhkSaatIni = aktif;
        kirimTelemetri();
      }
      resolve();
    });
  });
}

// ---------- websocket ----------
function connect() {
  const ws = new WebSocket(SERVER_URL);
  wsGlobal = ws;

  ws.on("open", () => {
    console.log("✔ Connected to server");
    periksaStatusAhk();
    setInterval(periksaStatusAhk, 3000); // cek tiap 3 detik
  });

  ws.on("message", msg => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "execute_command") {
        if (data.action === "start_ahk") kendalikanAhkBalikLayar("start", data.scriptName || "");
        if (data.action === "stop_ahk") kendalikanAhkBalikLayar("stop");
      }
    } catch (e) { console.error("Parse error:", e.message); }
  });

  ws.on("close", () => {
    console.log("⚠ Connection lost, retrying...");
    setTimeout(connect, 5000);
  });

  ws.on("error", () => {});
}

console.log("Starting RH Remote Client (Base + Standby Detection)...");
connect();