const WebSocket = require("ws");
const { exec, execSync } = require("child_process");
const os = require("os");
const path = require("path");

const SERVER_URL = "wss://bot-remote-production.up.railway.app";

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
  } catch { return "UNKNOWN_SERIAL"; }
}

function getWifiSSID() {
  try {
    if (os.platform() === "win32") {
      const output = execSync("netsh wlan show interfaces", { encoding: "utf8" });
      const match = output.match(/SSID\s*:\s*(.+)/);
      return match ? match[1].trim() : "-";
    }
    return "-";
  } catch { return "-"; }
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

let statusAhkSaatIni = false;
let wsGlobal = null;

// Mengirimkan ketukan tombol virtual (F3/F8) ke Windows - 100% BEBAS ADMINISTRATOR
function kirimTombolVirtualKeWindows(tombol) {
  return new Promise((resolve) => {
    if (os.platform() !== "win32") return resolve();
    const cmd = `mshta vbscript:Execute("CreateObject(""Wscript.Shell"").SendKeys(""{${tombol}}""):close")`;
    exec(cmd, () => resolve());
  });
}

// PEMANTAU OTOMATIS: Mendeteksi apakah ikon AHK ada di Hidden Icon (Tasklist)
function aktifkanPemantauProsesAhk() {
  if (os.platform() !== "win32") return;

  setInterval(() => {
    // Mengecek apakah aplikasi AutoHotkey.exe sedang stand-by aktif di Windows
    exec('tasklist /FI "IMAGENAME eq AutoHotkey.exe"', (err, stdout) => {
      let sedangStandby = false;
      if (!err && stdout.toLowerCase().includes("autohotkey.exe")) {
        sedangStandby = true;
      }
      
      // Jika statusnya berubah (misal baru diklik dua kali atau baru diclose manual)
      if (statusAhkSaatIni !== sedangStandby) {
        statusAhkSaatIni = sedangStandby;
        console.log(`[Sync System] AutoHotkey Standby: ${statusAhkSaatIni ? "YA (🟢)" : "TIDAK (🔴)"}`);
        paksaKirimTelemetri();
      }
    });
  }, 3000); // Cek otomatis setiap 3 detik sekali
}

function paksaKirimTelemetri() {
  if (wsGlobal && wsGlobal.readyState === WebSocket.OPEN) {
    const info = getSystemInfo();
    const cleanId = info.serial.replace(/[^\w-]/g, "_");

    const payload = {
      id: cleanId,
      ahkEnabled: statusAhkSaatIni, // Sinyal stand-by masuk ke sini
      hostname: info.hostname,
      model: `${info.platform} (${info.arch})`,
      wifi: info.wifi,
      ip: info.ip,
      mac: info.mac
    };
    wsGlobal.send(JSON.stringify(payload));
  }
}

function connectToServer() {
  const ws = new WebSocket(SERVER_URL);
  wsGlobal = ws;
  let intervalPingTelemetri;

  ws.on("open", () => {
    console.log("✔ Connected to remote server safely");
    paksaKirimTelemetri();
    intervalPingTelemetri = setInterval(paksaKirimTelemetri, 10000); 
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data && data.type === "execute_command" && data.action) {
        // Menerima perintah klik On/Off dari Web Dashboard Vercel
        if (data.action === "start_ahk") {
          kirimTombolVirtualKeWindows("F3");
        } else if (data.action === "stop_ahk") {
          kirimTombolVirtualKeWindows("F8");
        }
      }
    } catch (err) { console.error(err.message); }
  });

  ws.on("close", () => {
    clearInterval(intervalPingTelemetri);
    setTimeout(connectToServer, 5000);
  });

  ws.on("error", () => {});
}

console.log("Starting remote client (Standard User Edition)...");
aktifkanPemantauProsesAhk();
connectToServer();