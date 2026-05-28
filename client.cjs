// ============================================================
// RH Remote Client (AutoHotkey Controller) - Fixed full version
// ============================================================

const WebSocket = require("ws");
const { exec, execSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const SERVER_URL = "wss://bot-remote-production.up.railway.app";

// Folder saat ini, baik dijalankan dari NodeJS maupun file .exe hasil pkg
const CURRENT_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

// =====================
// UTILITAS SISTEM
// =====================
function getSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    username: os.userInfo().username,
    serial: getSerialNumber(),
    ip: getLocalIP(),
    mac: getMACAddress(),
    wifi: getWifiSSID(),
  };
}

function getSerialNumber() {
  try {
    if (os.platform() === "win32") {
      const output = execSync("wmic bios get serialnumber /value", { encoding: "utf8" });
      const match = output.match(/SerialNumber=(\S+)/);
      return match && match[1] && match[1] !== "To" ? match[1] : "UNKNOWN_SERIAL";
    }
    return "NON_WINDOWS_DEV";
  } catch {
    return "UNKNOWN_SERIAL";
  }
}

function getWifiSSID() {
  try {
    if (os.platform() === "win32") {
      const output = execSync("netsh wlan show interfaces", { encoding: "utf8" });
      const match = output.match(/SSID\s*:\s*(.+)/);
      return match ? match[1].trim() : "-";
    }
    return "-";
  } catch {
    return "-";
  }
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "-";
}

function getMACAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.mac && iface.mac !== "00:00:00:00:00:00") return iface.mac;
    }
  }
  return "-";
}

// ============================================================
// VARIABEL GLOBAL
// ============================================================
let statusAhkSaatIni = false;
let wsGlobal = null;

// ============================================================
// KONTROL AUTOMATIS: JALANKAN / MATIKAN AHK
// ============================================================
function kendalikanAhkBalikLayar(aksi, namaScriptKustom = "") {
  return new Promise((resolve) => {
    if (os.platform() !== "win32") return resolve();

    let cmd = "";
    if (aksi === "start") {
      let fileTarget = namaScriptKustom;

      if (!fileTarget) {
        try {
          const files = fs.readdirSync(CURRENT_DIR);
          const ahkFiles = files.filter(f => f.toLowerCase().endsWith(".ahk"));
          if (ahkFiles.length > 0) fileTarget = ahkFiles[0];
        } catch (e) {
          console.error("Gagal membaca folder script:", e.message);
        }
      }

      if (fileTarget) {
        const fullScriptPath = path.join(CURRENT_DIR, fileTarget);
        // Jalankan AutoHotkey engine secara absolut
        cmd = `start "" "AutoHotkey.exe" "${fullScriptPath}"`;
        console.log(`[Dynamic Exec] Menjalankan script via engine: ${fullScriptPath}`);
      } else {
        console.log("[Alert] Tidak ada file .ahk ditemukan di folder ini!");
        return resolve();
      }
    } else if (aksi === "stop") {
      cmd = `taskkill /f /im AutoHotkey.exe || exit 0`;
      console.log("[Dynamic Exec] Mematikan semua session AutoHotkey.exe");
    }

    exec(cmd, () => {
      setTimeout(() => {
        periksaStatusAktifWindows();
        resolve();
      }, 800);
    });
  });
}

// ============================================================
// MONITORING STATUS PROSES AUTOHOTKEY
// ============================================================
function periksaStatusAktifWindows() {
  if (os.platform() !== "win32") return;
  exec('tasklist /FI "IMAGENAME eq AutoHotkey.exe"', (err, stdout) => {
    const sedangJalan = !err && stdout.toLowerCase().includes("autohotkey.exe");
    if (statusAhkSaatIni !== sedangJalan) {
      statusAhkSaatIni = sedangJalan;
      paksaKirimTelemetri();
    }
  });
}

// ============================================================
// KIRIM TELEMETRI KE SERVER
// ============================================================
function paksaKirimTelemetri() {
  if (wsGlobal && wsGlobal.readyState === WebSocket.OPEN) {
    const info = getSystemInfo();
    const cleanId = info.serial.replace(/[^\w-]/g, "_");

    const payload = {
      type: "ahk_status",          // <=== penting agar server paham
      id: cleanId,
      ahkEnabled: statusAhkSaatIni,
      hostname: info.hostname,
      model: `${info.platform} (${info.arch})`,
      wifi: info.wifi,
      ip: info.ip,
      mac: info.mac
    };

    wsGlobal.send(JSON.stringify(payload));
    console.log(`[Telemetry] Status AHK dikirim => ${statusAhkSaatIni ? "ON" : "OFF"}`);
  }
}

// ============================================================
// HUBUNGAN WEBSOCKET KE SERVER
// ============================================================
function connectToServer() {
  const ws = new WebSocket(SERVER_URL);
  wsGlobal = ws;
  let intervalPingTelemetri;
  let intervalCekTasklist;
  const info = getSystemInfo();
  const cleanId = info.serial.replace(/[^\w-]/g, "_");

  ws.on("open", () => {
    console.log("✔ Connected to remote RH Cloud Server");
    // handshake awal kirim identitas device
    ws.send(JSON.stringify({
      id: cleanId,
      hostname: info.hostname,
      model: `${info.platform} (${info.arch})`,
      wifi: info.wifi,
      ip: info.ip,
      mac: info.mac,
      ahkEnabled: statusAhkSaatIni
    }));

    periksaStatusAktifWindows();
    intervalPingTelemetri = setInterval(paksaKirimTelemetri, 10000);
    intervalCekTasklist = setInterval(periksaStatusAktifWindows, 3000);
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data && data.type === "execute_command" && data.action) {
        if (data.action === "start_ahk") {
          kendalikanAhkBalikLayar("start", data.scriptName || "").then(() => {
            statusAhkSaatIni = true;
            paksaKirimTelemetri();
          });
        } else if (data.action === "stop_ahk") {
          kendalikanAhkBalikLayar("stop").then(() => {
            statusAhkSaatIni = false;
            paksaKirimTelemetri();
          });
        }
      }
    } catch (err) {
      console.error("WS message error:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("⚠ Connection closed, retrying in 5s...");
    clearInterval(intervalPingTelemetri);
    clearInterval(intervalCekTasklist);
    setTimeout(connectToServer, 5000);
  });

  ws.on("error", (e) => {
    console.error("❌ WebSocket error", e.message);
  });
}

// ============================================================
// MULAI PROGRAM
// ============================================================
console.log("Starting RH Remote Client (Full Fixed Edition)...");
connectToServer();