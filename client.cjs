// =============================================================
// RH Remote Client - stable edition (logic OFF tetap, ON diperbaiki)
// =============================================================
const WebSocket = require("ws");
const { exec, execSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const SERVER_URL = "wss://bot-remote-production.up.railway.app";
const CURRENT_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

let wsGlobal = null;
let statusAhkSaatIni = false;

// ========== helper info sistem ==========
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
    if (os.platform() === "win32") {
      const out = execSync("wmic bios get serialnumber /value", { encoding: "utf8" });
      const m = out.match(/SerialNumber=(\\S+)/);
      return m ? m[1] : "UNKNOWN_SERIAL";
    }
  } catch {}
  return "UNKNOWN_SERIAL";
}
function getWifiSSID() {
  try {
    if (os.platform() === "win32") {
      const out = execSync("netsh wlan show interfaces", { encoding: "utf8" });
      const m = out.match(/SSID\\s*:\\s*(.+)/);
      return m ? m[1].trim() : "-";
    }
  } catch {}
  return "-";
}
function getLocalIP() {
  const i = os.networkInterfaces();
  for (const n of Object.keys(i)) {
    for (const f of i[n]) if (f.family === "IPv4" && !f.internal) return f.address;
  }
  return "-";
}
function getMAC() {
  const i = os.networkInterfaces();
  for (const n of Object.keys(i)) {
    for (const f of i[n]) if (f.mac && f.mac !== "00:00:00:00:00:00") return f.mac;
  }
  return "-";
}

// ============================================================
// START / STOP CONTROL (logic lama, tidak diubah)
// ============================================================
function kendalikanAhkBalikLayar(aksi, scriptName = "") {
  return new Promise((resolve) => {
    if (os.platform() !== "win32") return resolve();

    let cmd = "";
    if (aksi === "start") {
      let fileTarget = scriptName;
      if (!fileTarget) {
        try {
          const files = fs.readdirSync(CURRENT_DIR);
          const ahkFiles = files.filter(f => f.toLowerCase().endsWith(".ahk"));
          if (ahkFiles.length > 0) fileTarget = ahkFiles[0];
        } catch (e) {
          console.error("Gagal membaca folder:", e.message);
        }
      }
      if (!fileTarget) {
        console.log("[!] Tidak ada file .ahk ditemukan di folder client.");
        return resolve();
      }

      const full = path.join(CURRENT_DIR, fileTarget);
      // jalankan .ahk langsung (biar Windows manggil AutoHotkey yang terasosiasi)
      cmd = `start "" "${full}"`;
      console.log(`[RUN] Menjalankan .ahk: ${full}`);
    } else if (aksi === "stop") {
      // logic lama untuk menonaktifkan
      cmd = [
        `taskkill /F /IM AutoHotkey.exe >nul 2>nul`,
        `taskkill /F /IM AutoHotkeyU64.exe >nul 2>nul`,
        `taskkill /F /IM AutoHotkeyU32.exe >nul 2>nul`
      ].join(" & ");
      console.log("[KILL] Mematikan AutoHotkey process ...");
    }

    exec(cmd, () => {
      setTimeout(() => {
        periksaStatusAhk(); // update status ke web
        resolve();
      }, 1000);
    });
  });
}

// ============================================================
// CEK STATUS PROSES (perbaikan logic ON → kirim sinyal standby)
// ============================================================
function periksaStatusAhk() {
  if (os.platform() !== "win32") return;
  exec('tasklist /FI "IMAGENAME eq AutoHotkey.exe"', (err, out) => {
    const aktif = !err && out.toLowerCase().includes("autohotkey.exe");

    // kirim sinyal walau status sama; supaya dashboard tahu jika AHK standby manual
    statusAhkSaatIni = aktif;
    kirimTelemetri();
  });
}

// ============================================================
// KIRIM STATUS KE SERVER
// ============================================================
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
  console.log(`[Telemetry] Status dikirim => ${statusAhkSaatIni ? "ON" : "OFF"}`);
}

// ============================================================
// WEBSOCKET CONNECTION (logic lama tetap)
// ============================================================
function connectToServer() {
  const ws = new WebSocket(SERVER_URL);
  wsGlobal = ws;

  ws.on("open", () => {
    console.log("✔ Connected ke server pusat");
    periksaStatusAhk();
    setInterval(periksaStatusAhk, 3000); // loop cek secara periodik
  });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data && data.type === "execute_command") {
        if (data.action === "start_ahk") kendalikanAhkBalikLayar("start", data.scriptName || "");
        if (data.action === "stop_ahk") kendalikanAhkBalikLayar("stop");
      }
    } catch (e) {
      console.error("Error parse WS message:", e.message);
    }
  });

  ws.on("close", () => {
    console.log("⚠ WS ditutup, mencoba ulang 5s...");
    setTimeout(connectToServer, 5000);
  });
  ws.on("error", () => {});
}

console.log("Starting RH Remote Client (Stable Standby Edition)...");
connectToServer();