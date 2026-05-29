// RH Remote Client - Fixed handshake & telemetry link
const WebSocket = require("ws");
const { exec, execSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const SERVER_URL = "wss://bot-remote-production.up.railway.app";
const CURRENT_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

let wsGlobal = null;
let statusAhkSaatIni = false;

// ---------- utilitas ----------
function getSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    serial: getSerial(),
    wifi: getWifi(),
    ip: getIP(),
    mac: getMAC()
  };
}
function getSerial() {
  try {
    const o = execSync("wmic bios get serialnumber /value", { encoding: "utf8" });
    const m = o.match(/SerialNumber=(\\S+)/);
    return m ? m[1] : "UNKNOWN";
  } catch { return "UNKNOWN"; }
}
function getWifi() {
  try {
    const o = execSync("netsh wlan show interfaces", { encoding: "utf8" });
    const m = o.match(/SSID\\s*:\\s*(.+)/);
    return m ? m[1].trim() : "-";
  } catch { return "-"; }
}
function getIP() {
  const n = os.networkInterfaces();
  for (const k of Object.keys(n))
    for (const f of n[k]) if (f.family === "IPv4" && !f.internal) return f.address;
  return "-";
}
function getMAC() {
  const n = os.networkInterfaces();
  for (const k of Object.keys(n))
    for (const f of n[k])
      if (f.mac && f.mac !== "00:00:00:00:00:00") return f.mac;
  return "-";
}

// ---------- kontrol AHK ----------
function kendalikanAhkBalikLayar(aksi, namaScript = "") {
  let cmd = "";
  if (aksi === "start") {
    let file = namaScript;
    if (!file) {
      const files = fs.readdirSync(CURRENT_DIR);
      const ahk = files.find(f => f.toLowerCase().endsWith(".ahk"));
      if (!ahk) return console.log("[!] Tidak ada file .ahk ditemukan.");
      file = ahk;
    }
    const full = path.join(CURRENT_DIR, file);
    cmd = `start "" "${full}"`;
    console.log(`[RUN] ${full}`);
  } else if (aksi === "stop") {
    cmd = `taskkill /F /IM AutoHotkey*.exe >nul 2>nul`;
    console.log("[KILL] Menonaktifkan AutoHotkey.exe");
  }
  exec(cmd, () => setTimeout(periksaStatus, 1000));
}

// ---------- monitoring ----------
function periksaStatus() {
  exec('tasklist /FI "IMAGENAME eq AutoHotkey.exe"', (err, out) => {
    const aktif = !err && out.toLowerCase().includes("autohotkey.exe");
    if (statusAhkSaatIni !== aktif) {
      statusAhkSaatIni = aktif;
      kirimTelemetri();
    }
  });
}

// kirim selalu (termasuk waktu awal konek)
function kirimTelemetri(force = false) {
  if (!wsGlobal || wsGlobal.readyState !== WebSocket.OPEN) return;
  const info = getSystemInfo();
  const data = {
    type: "ahk_status",
    id: info.serial.replace(/[^\w-]/g, "_"),
    ahkEnabled: statusAhkSaatIni,
    hostname: info.hostname,
    model: `${info.platform} (${info.arch})`,
    wifi: info.wifi,
    ip: info.ip,
    mac: info.mac
  };
  wsGlobal.send(JSON.stringify(data));
  console.log(`[Telemetry] Status => ${statusAhkSaatIni ? "ON" : "OFF"}`);
}

// ---------- websocket ----------
function connect() {
  const ws = new WebSocket(SERVER_URL);
  wsGlobal = ws;

  ws.on("open", () => {
    console.log("✔ Connected to server (Telemetry linked)");
    // kirim handshake identitas
    const info = getSystemInfo();
    ws.send(JSON.stringify({
      id: info.serial.replace(/[^\w-]/g, "_"),
      hostname: info.hostname,
      model: `${info.platform} (${info.arch})`,
      wifi: info.wifi,
      ip: info.ip,
      mac: info.mac,
      ahkEnabled: statusAhkSaatIni
    }));

    // periksa status awal dan kirim telemetri
    periksaStatus();
    kirimTelemetri(true);
    setInterval(periksaStatus, 3000);
  });

  ws.on("message", msg => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "execute_command") {
        if (data.action === "start_ahk") kendalikanAhkBalikLayar("start", data.scriptName || "");
        if (data.action === "stop_ahk") kendalikanAhkBalikLayar("stop");
      }
    } catch (e) { console.error("Message parse error:", e.message); }
  });

  ws.on("close", () => {
    console.log("⚠ Socket closed, reconnecting...");
    setTimeout(connect, 5000);
  });
}

console.log("Starting RH Remote Client (Handshake Fixed Edition)...");
connect();