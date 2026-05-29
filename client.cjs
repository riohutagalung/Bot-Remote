// ============================================================
// RH Remote Client - Stable Edition (background + unicode detect)
// ============================================================
const WebSocket = require("ws");
const { exec, execSync, spawn } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const SERVER_URL = "wss://bot-remote-production.up.railway.app";
const CURRENT_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

let wsGlobal = null;
let statusAhkSaatIni = false;

// ========= System Info =========
function getSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    serial: getSerialNumber(),
    wifi: getWifiSSID(),
    ip: getLocalIP(),
    mac: getMAC(),
  };
}
function getSerialNumber() {
  try {
    const o = execSync("wmic bios get serialnumber /value", { encoding: "utf8" });
    const m = o.match(/SerialNumber=(\\S+)/);
    return m ? m[1] : "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}
function getWifiSSID() {
  try {
    const o = execSync("netsh wlan show interfaces", { encoding: "utf8" });
    const m = o.match(/SSID\\s*:\\s*(.+)/);
    return m ? m[1].trim() : "-";
  } catch {
    return "-";
  }
}
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const n of Object.keys(nets)) {
    for (const f of nets[n]) if (f.family === "IPv4" && !f.internal) return f.address;
  }
  return "-";
}
function getMAC() {
  const nets = os.networkInterfaces();
  for (const n of Object.keys(nets)) {
    for (const f of nets[n])
      if (f.mac && f.mac !== "00:00:00:00:00:00") return f.mac;
  }
  return "-";
}

// =============================================================
// Kontrol AHK (tidak diubah)
// =============================================================
function kendalikanAhkBalikLayar(aksi, namaScript = "") {
  return new Promise((resolve) => {
    if (os.platform() !== "win32") return resolve();

    let cmd = "";
    if (aksi === "start") {
      let file = namaScript;
      if (!file) {
        try {
          const files = fs.readdirSync(CURRENT_DIR);
          const ahk = files.find((f) => f.toLowerCase().endsWith(".ahk"));
          if (!ahk) {
            console.log("[!] Tidak ada file .ahk ditemukan di folder client");
            return resolve();
          }
          file = ahk;
        } catch (e) {
          console.error("Gagal baca folder:", e.message);
          return resolve();
        }
      }
      const full = path.join(CURRENT_DIR, file);
      cmd = `start "" "${full}"`;
      console.log(`[RUN] Menjalankan .ahk: ${full}`);
    } else if (aksi === "stop") {
      cmd = [
        `taskkill /F /IM AutoHotkey.exe >nul 2>nul`,
        `taskkill /F /IM "AutoHotkey Unicode 64-bit.exe" >nul 2>nul`,
        `taskkill /F /IM "AutoHotkey Unicode 32-bit.exe" >nul 2>nul`,
        `taskkill /F /IM AutoHotkeyU64.exe >nul 2>nul`,
        `taskkill /F /IM AutoHotkeyU32.exe >nul 2>nul`
      ].join(" & ");
      console.log("[KILL] Mematikan semua AutoHotkey process ...");
    }

    exec(cmd, () => {
      setTimeout(() => {
        periksaStatusAhk().then(resolve);
      }, 1000);
    });
  });
}

// =============================================================
// Periksa status proses AHK (tambahan: deteksi AutoHotkey Unicode)
// =============================================================
function periksaStatusAhk() {
  return new Promise((resolve) => {
    if (os.platform() !== "win32") return resolve();

    // deteksi semua kemungkinan nama AutoHotkey
    const perintah =
      'tasklist | findstr /I "AutoHotkey.exe AutoHotkeyU32.exe AutoHotkeyU64.exe AutoHotkey Unicode"';
    exec(perintah, (err, stdout) => {
      const aktif = stdout && stdout.toLowerCase().includes("autohotkey");
      if (statusAhkSaatIni !== aktif) {
        statusAhkSaatIni = aktif;
        kirimTelemetri();
      }
      resolve();
    });
  });
}

// =============================================================
// Kirim Telemetry
// =============================================================
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
    mac: info.mac,
  };
  wsGlobal.send(JSON.stringify(data));
  console.log(`[Telemetry] Status => ${statusAhkSaatIni ? "ON" : "OFF"}`);
}

// =============================================================
// Koneksi WebSocket (tidak diubah, hanya stabilitas)
// =============================================================
function connectToServer() {
  const ws = new WebSocket(SERVER_URL);
  wsGlobal = ws;

  ws.on("open", () => {
    console.log("✔ Connected to remote server");
    // kirim identitas handshake
    const info = getSystemInfo();
    ws.send(
      JSON.stringify({
        id: info.serial.replace(/[^\w-]/g, "_"),
        hostname: info.hostname,
        model: `${info.platform} (${info.arch})`,
        wifi: info.wifi,
        ip: info.ip,
        mac: info.mac,
        ahkEnabled: statusAhkSaatIni,
      })
    );

    setInterval(periksaStatusAhk, 3000);
  });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data && data.type === "execute_command") {
        if (data.action === "start_ahk")
          kendalikanAhkBalikLayar("start", data.scriptName || "");
        if (data.action === "stop_ahk") kendalikanAhkBalikLayar("stop");
      }
    } catch (e) {
      console.error("WS parse error:", e.message);
    }
  });

  ws.on("close", () => {
    console.log("⚠ Connection lost, retrying...");
    setTimeout(connectToServer, 5000);
  });

  ws.on("error", () => {});
}

// =============================================================
// Jalankan di background, hindari mati saat CMD ditutup
// =============================================================

// Jika kamu build .exe pakai pkg, buat sendiri file .VBS di folder Startup:
//   Set WshShell = CreateObject("WScript.Shell")
//   WshShell.Run """C:\Path\To\client.exe""", 0
// Baris ,0 membuatnya tanpa jendela CMD.

console.log("Starting RH Remote Client (Unicode Detect Edition)...");
connectToServer();