// ============================================================
// RH Remote Client (AutoHotkey Controller) - Direct AHK Runner
// ============================================================

const WebSocket = require("ws");
const { exec, execSync, spawn } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const SERVER_URL = "wss://bot-remote-production.up.railway.app";
const CURRENT_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

let statusAhkSaatIni = false;
let wsGlobal = null;
let prosesAhk = null;

// ----------- utilitas sistem -------------
function getSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    username: os.userInfo().username,
    serial: getSerialNumber(),
    ip: getLocalIP(),
    mac: getMACAddress(),
    wifi: getWifiSSID()
  };
}

function getSerialNumber() {
  try {
    if (os.platform() === "win32") {
      const out = execSync("wmic bios get serialnumber /value", { encoding: "utf8" });
      const m = out.match(/SerialNumber=(\S+)/);
      return m ? m[1] : "UNKNOWN_SERIAL";
    }
  } catch {}
  return "UNKNOWN_SERIAL";
}

function getWifiSSID() {
  try {
    if (os.platform() === "win32") {
      const out = execSync("netsh wlan show interfaces", { encoding: "utf8" });
      const m = out.match(/SSID\s*:\s*(.+)/i);
      return m ? m[1].trim() : "-";
    }
  } catch {}
  return "-";
}

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const n of Object.keys(ifaces)) {
    for (const i of ifaces[n]) {
      if (i.family === "IPv4" && !i.internal) return i.address;
    }
  }
  return "-";
}

function getMACAddress() {
  const ifaces = os.networkInterfaces();
  for (const n of Object.keys(ifaces)) {
    for (const i of ifaces[n]) {
      if (i.mac && i.mac !== "00:00:00:00:00:00") return i.mac;
    }
  }
  return "-";
}

// ============================================================
// Jalankan / hentikan file .ahk secara langsung
// ============================================================
function jalankanAHK(namaScriptKustom = "") {
  return new Promise((resolve) => {
    if (os.platform() !== "win32") return resolve();

    let fileTarget = namaScriptKustom;
    if (!fileTarget) {
      try {
        const files = fs.readdirSync(CURRENT_DIR);
        const ahkFiles = files.filter(f => f.toLowerCase().endsWith(".ahk"));
        if (ahkFiles.length > 0) fileTarget = ahkFiles[0];
      } catch (e) {
        console.error("Gagal membaca folder:", e.message);
        return resolve();
      }
    }
    if (!fileTarget) {
      console.log("Tidak ada file .ahk ditemukan untuk dijalankan.");
      return resolve();
    }

    const fullPath = path.join(CURRENT_DIR, fileTarget);
    console.log(`[RUN] Menjalankan skrip AHK: ${fullPath}`);

    prosesAhk = spawn("cmd.exe", ["/c", `"${fullPath}"`], {
      cwd: CURRENT_DIR,
      detached: true,
      stdio: "ignore",
      shell: true
    });
    prosesAhk.unref();

    setTimeout(() => {
      statusAhkSaatIni = true;
      kirimStatusKeServer();
      resolve();
    }, 1000);
  });
}

function hentikanAHK() {
  return new Promise((resolve) => {
    console.log("[STOP] Mematikan semua proses AutoHotkey.exe ...");
    exec("taskkill /IM AutoHotkey.exe /F >nul 2>nul", () => {
      statusAhkSaatIni = false;
      kirimStatusKeServer();
      resolve();
    });
  });
}

// ============================================================
// Kirim status ke server
// ============================================================
function kirimStatusKeServer() {
  if (wsGlobal && wsGlobal.readyState === WebSocket.OPEN) {
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
    console.log(`[Telemetry] Status dikirim => ${statusAhkSaatIni ? "ON" : "OFF"}`);
  }
}

// ============================================================
// Fungsi koneksi WebSocket ke server
// ============================================================
function connectToServer() {
  const ws = new WebSocket(SERVER_URL);
  wsGlobal = ws;

  ws.on("open", () => {
    console.log("✔ Connected to remote RH Cloud Server");
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
    kirimStatusKeServer();
  });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data && data.type === "execute_command") {
        if (data.action === "start_ahk") {
          jalankanAHK(data.scriptName || "");
        } else if (data.action === "stop_ahk") {
          hentikanAHK();
        }
      }
    } catch (e) {
      console.error("WS message error:", e.message);
    }
  });

  ws.on("close", () => {
    console.log("⚠ Koneksi ditutup, mencoba ulang...");
    setTimeout(connectToServer, 5000);
  });

  ws.on("error", (e) => {
    console.error("WS error:", e.message);
  });
}

// ============================================================
// MULAI
// ============================================================
console.log("Starting RH Remote Client (AutoRun Edition)...");
connectToServer();