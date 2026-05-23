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

// ==========================================================
// KONTROL BALIK LAYAR: JALANKAN / MATIKAN VIA PROSES KERNEL WINDOWS
// ==========================================================
function kendalikanAhkBalikLayar(aksi) {
  return new Promise((resolve) => {
    if (os.platform() !== "win32") return resolve();

    let cmd = "";
    if (aksi === "start") {
      // Menjalankan langsung script.ahk dari foldernya (Sama seperti double-click / F3)
      cmd = `start "" "script.ahk"`;
    } else if (aksi === "stop") {
      // Membunuh proses AutoHotkey sampai bersih (Sama seperti F8)
      cmd = `taskkill /f /im AutoHotkey.exe || exit 0`;
    }

    console.log(`[Executing Kernel Command]: ${cmd}`);
    exec(cmd, () => {
      // Beri jeda 1 detik agar Windows memperbarui Task Manager, lalu cek status terbaru
      setTimeout(() => {
        periksaStatusAktifWindows();
        resolve();
      }, 1000);
    });
  });
}

// PEMANTAU REAL-TIME: Selalu cek apakah AutoHotkey.exe ada di background
function periksaStatusAktifWindows() {
  if (os.platform() !== "win32") return;

  exec('tasklist /FI "IMAGENAME eq AutoHotkey.exe"', (err, stdout) => {
    let sedangJalan = false;
    if (!err && stdout.toLowerCase().includes("autohotkey.exe")) {
      sedangJalan = true;
    }
    
    if (statusAhkSaatIni !== sedangJalan) {
      statusAhkSaatIni = sedangJalan;
      console.log(`[Sync] Status AHK Berubah -> Menyala/Standby: ${statusAhkSaatIni}`);
      paksaKirimTelemetri();
    }
  });
}

function paksaKirimTelemetri() {
  if (wsGlobal && wsGlobal.readyState === WebSocket.OPEN) {
    const info = getSystemInfo();
    const cleanId = info.serial.replace(/[^\w-]/g, "_");

    const payload = {
      id: cleanId,
      ahkEnabled: statusAhkSaatIni,
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
  let intervalCekTasklist;

  ws.on("open", () => {
    console.log("✔ Connected to remote server safely");
    periksaStatusAktifWindows();
    
    // Ping telemetri setiap 10 detik
    intervalPingTelemetri = setInterval(paksaKirimTelemetri, 10000); 
    // Cek kondisi real-time Task Manager setiap 3 detik (Biar responsif saat F8 dipencet manual)
    intervalCekTasklist = setInterval(periksaStatusAktifWindows, 3000);
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data && data.type === "execute_command" && data.action) {
        console.log("Menerima instruksi Web:", data.action);
        
        if (data.action === "start_ahk") {
          kendalikanAhkBalikLayar("start");
        } else if (data.action === "stop_ahk") {
          kendalikanAhkBalikLayar("stop");
        }
      }
    } catch (err) { console.error(err.message); }
  });

  ws.on("close", () => {
    clearInterval(intervalPingTelemetri);
    clearInterval(intervalCekTasklist);
    setTimeout(connectToServer, 5000);
  });

  ws.on("error", () => {});
}

console.log("Starting remote client (Expert Edition)...");
connectToServer();