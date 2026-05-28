const WebSocket = require("ws");
const { exec, execSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const SERVER_URL = "wss://bot-remote-production.up.railway.app";
const CURRENT_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

let statusAhkSaatIni = false;
let wsGlobal = null;

function getSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    username: os.userInfo().username,
    serial: getSerial(),
    ip: getIP(),
    mac: getMAC(),
    wifi: getWifi()
  };
}

function getSerial() {
  try {
    if (os.platform() === "win32") {
      const o = execSync("wmic bios get serialnumber /value", { encoding: "utf8" });
      const m = o.match(/SerialNumber=(\S+)/);
      return m ? m[1] : "UNKNOWN";
    }
  } catch {}
  return "UNKNOWN";
}
function getWifi() {
  try {
    if (os.platform() === "win32") {
      const o = execSync("netsh wlan show interfaces", { encoding: "utf8" });
      const m = o.match(/SSID\s*:\s*(.+)/);
      return m ? m[1].trim() : "-";
    }
  } catch {}
  return "-";
}
function getIP() {
  const i = os.networkInterfaces();
  for (const n of Object.keys(i)) {
    for (const f of i[n]) if (f.family === "IPv4" && !f.internal) return f.address;
  }
  return "-";
}
function getMAC() {
  const i = os.networkInterfaces();
  for (const n of Object.keys(i)) {
    for (const f of i[n])
      if (f.mac && f.mac !== "00:00:00:00:00:00") return f.mac;
  }
  return "-";
}

// ============================================================
// START / STOP
// ============================================================
function kendalikanAhkBalikLayar(aksi, namaScriptKustom = "") {
  return new Promise(resolve => {
    if (os.platform() !== "win32") return resolve();

    if (aksi === "start") {
      let fileTarget = namaScriptKustom;
      if (!fileTarget) {
        try {
          const files = fs.readdirSync(CURRENT_DIR);
          const ahkFiles = files.filter(f => f.toLowerCase().endsWith(".ahk"));
          if (ahkFiles.length > 0) fileTarget = ahkFiles[0];
        } catch (e) { console.error("Gagal membaca folder:", e.message); }
      }
      if (!fileTarget) {
        console.log("[Alert] Tidak ada script .ahk ditemukan.");
        return resolve();
      }

      const fullScript = path.join(CURRENT_DIR, fileTarget);
      // 🔧 jalankan langsung file .ahk — Windows akan buka dengan AHK bawaan
      exec(`start "" "${fullScript}"`, () => {
        console.log(`[Exec] Menjalankan: ${fullScript}`);
        setTimeout(() => { periksaStatusAktif(); resolve(); }, 1000);
      });
    } else if (aksi === "stop") {
      console.log("[Exec] Mengirim F8 untuk menonaktifkan AHK…");
      // Kirim F8 global
      exec(
        `powershell -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('{F8}')"`
      , () => {
        // Pastikan mati kalau script tidak meng-handle F8
        setTimeout(() => {
          exec(
            `taskkill /IM AutoHotkey.exe /F >nul 2>nul & taskkill /IM AutoHotkeyU64.exe /F >nul 2>nul & taskkill /IM AutoHotkeyU32.exe /F >nul 2>nul`,
            () => { periksaStatusAktif(); resolve(); }
          );
        }, 1500);
      });
    }
  });
}

// ============================================================
// CEK STATUS PROSES
// ============================================================
function periksaStatusAktif() {
  if (os.platform() !== "win32") return;
  exec('tasklist /FI "IMAGENAME eq AutoHotkey.exe"', (err, out) => {
    const active = !err && out.toLowerCase().includes("autohotkey.exe");
    if (statusAhkSaatIni !== active) {
      statusAhkSaatIni = active;
      kirimTelemetri();
    }
  });
}

function kirimTelemetri() {
  if (wsGlobal && wsGlobal.readyState === WebSocket.OPEN) {
    const info = getSystemInfo();
    const payload = {
      id: info.serial.replace(/[^\w-]/g, "_"),
      type: "ahk_status",
      ahkEnabled: statusAhkSaatIni,
      hostname: info.hostname,
      model: `${info.platform} (${info.arch})`,
      wifi: info.wifi,
      ip: info.ip,
      mac: info.mac
    };
    wsGlobal.send(JSON.stringify(payload));
    console.log(
      `[Telemetry] Status dikirim => ${statusAhkSaatIni ? "RUNNING" : "OFF"}`
    );
  }
}

// ============================================================
// WEBSOCKET
// ============================================================
function connect() {
  const ws = new WebSocket(SERVER_URL);
  wsGlobal = ws;
  ws.on("open", () => {
    console.log("✔ Connected to remote server");
    periksaStatusAktif();
    setInterval(periksaStatusAktif, 3000);
    setInterval(kirimTelemetri, 10000);
  });

  ws.on("message", msg => {
    try {
      const data = JSON.parse(msg.toString());
      if (data && data.type === "execute_command") {
        if (data.action === "start_ahk") kendalikanAhkBalikLayar("start", data.scriptName || "");
        if (data.action === "stop_ahk") kendalikanAhkBalikLayar("stop");
      }
    } catch (e) { console.error(e.message); }
  });

  ws.on("close", () => {
    console.log("⚠ WS closed, retrying...");
    setTimeout(connect, 5000);
  });
}

console.log("Starting RH Remote Client (Enhanced Control Edition)...");
connect();