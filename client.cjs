// RH Remote Client - Simple AHK Controller (Final)
const WebSocket = require("ws");
const { exec, execSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const SERVER_URL = "wss://bot-remote-production.up.railway.app";
const CURRENT_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

let wsGlobal = null;
let statusAhkSaatIni = false;

// ===== utilitas sistem =====
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
    if (os.platform() === "win32") {
      const out = execSync("wmic bios get serialnumber /value", { encoding: "utf8" });
      const m = out.match(/SerialNumber=(\S+)/);
      return m ? m[1] : "UNKNOWN";
    }
  } catch {}
  return "UNKNOWN";
}
function getWifi() {
  try {
    const out = execSync("netsh wlan show interfaces", { encoding: "utf8" });
    const m = out.match(/SSID\s*:\s*(.+)/);
    return m ? m[1].trim() : "-";
  } catch { return "-"; }
}
function getIP() {
  const n = os.networkInterfaces();
  for (const i of Object.keys(n)) {
    for (const f of n[i]) if (f.family === "IPv4" && !f.internal) return f.address;
  }
  return "-";
}
function getMAC() {
  const n = os.networkInterfaces();
  for (const i of Object.keys(n)) {
    for (const f of n[i])
      if (f.mac && f.mac !== "00:00:00:00:00:00") return f.mac;
  }
  return "-";
}

// ===== kontrol =====
function jalankanAHK() {
  try {
    const files = fs.readdirSync(CURRENT_DIR);
    const ahk = files.find(f => f.toLowerCase().endsWith(".ahk"));
    if (!ahk) return console.log("[!] Tidak ada file .ahk ditemukan.");

    const full = path.join(CURRENT_DIR, ahk);
    exec(`start "" "${full}"`);
    console.log(`[RUN] ${full}`);
    setTimeout(periksaStatus, 1000);
  } catch (e) {
    console.error("Gagal menjalankan AHK:", e.message);
  }
}

function matikanAHK() {
  console.log("[KILL] Menutup semua AutoHotkey.exe ...");
  // Tambahkan semua varian nama proses agar benar-benar mati
  exec(
    `taskkill /F /IM AutoHotkey.exe >nul 2>nul & taskkill /F /IM AutoHotkeyU64.exe >nul 2>nul & taskkill /F /IM AutoHotkeyU32.exe >nul 2>nul`,
    () => {
      setTimeout(periksaStatus, 1500);
    }
  );
}

function periksaStatus() {
  exec('tasklist /FI "IMAGENAME eq AutoHotkey.exe"', (err, out) => {
    const aktif = !err && out.toLowerCase().includes("autohotkey.exe");
    if (statusAhkSaatIni !== aktif) {
      statusAhkSaatIni = aktif;
      kirimTelemetri();
    }
  });
}

function kirimTelemetri() {
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

// ===== koneksi websocket =====
function connect() {
  const ws = new WebSocket(SERVER_URL);
  wsGlobal = ws;

  ws.on("open", () => {
    console.log("✔ Connected to server");

    // 🔹 Kirim identitas awal supaya server & dashboard mengenali client
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

    periksaStatus();
    setInterval(periksaStatus, 3000);
  });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "execute_command") {
        if (data.action === "start_ahk") jalankanAHK();
        if (data.action === "stop_ahk") matikanAHK();
      }
    } catch (e) {
      console.error("Parse error:", e.message);
    }
  });

  ws.on("close", () => {
    console.log("⚠ Disconnected, retrying...");
    setTimeout(connect, 5000);
  });

  ws.on("error", () => {});
}

console.log("Starting RH Remote Client (Simple Control - Final)...");
connect();