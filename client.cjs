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
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "-";
}

function getMACAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.mac && iface.mac !== "00:00:00:00:00:00") {
        return iface.mac;
      }
    }
  }
  return "-";
}

let statusAhkSaatIni = false;
let wsGlobal = null;

// ==========================================================
// LOGIKABARU: SIMULASI PENCETAN TOMBOL KEYBOARD WINDOWS VIA POWERSHELL
// ==========================================================
function kirimTombolVirtualKeWindows(tombol) {
  return new Promise((resolve) => {
    if (os.platform() !== "win32") return resolve();

    // Menggunakan Powershell internal Windows untuk mengetuk F3 atau F8 secara gaib
    const psCommand = `powershell -Command "$wsh = New-Object -ComObject Wscript.Shell; $wsh.SendKeys('{${tombol}}')"`;
    
    console.log(`[Remote Control] Mengirimkan ketukan tombol fisik: ${tombol}`);
    exec(psCommand, () => resolve());
  });
}

// ==========================================================
// LOGIKABARU: PEMANTAU TOMBOL F3 & F8 MANUAL DI LAPTOP
// ==========================================================
function aktifkanPemantauTombolFisik() {
  if (os.platform() !== "win32") return;

  // Script Powershell ringan untuk memantau status key secara background tanpa membebani CPU
  const monitorScript = `
  Add-Type -TypeDefinition @'
  using System;
  using System.Runtime.InteropServices;
  public class Keyboard {
      [DllImport("user32.dll")]
      public static extern short GetAsyncKeyState(int vKey);
  }
'@
  while ($true) {
      if ([Keyboard]::GetAsyncKeyState(0x72) -band 0x8000) { Write-Output "F3_PRESSED"; Start-Sleep -Milliseconds 500 }
      if ([Keyboard]::GetAsyncKeyState(0x77) -band 0x8000) { Write-Output "F8_PRESSED"; Start-Sleep -Milliseconds 500 }
      Start-Sleep -Milliseconds 100
  }
  `;

  const child = exec(`powershell -Command "${monitorScript}"`);

  child.stdout.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg.includes("F3_PRESSED")) {
      console.log("[Fisik Terdeteksi] User menekan F3 di Keyboard -> Makro Aktif");
      statusAhkSaatIni = true;
      paksaKirimTelemetri();
    } else if (msg.includes("F8_PRESSED")) {
      console.log("[Fisik Terdeteksi] User menekan F8 di Keyboard -> Makro Berhenti");
      statusAhkSaatIni = false;
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

  ws.on("open", () => {
    console.log("✔ Connected to remote server safely");
    paksaKirimTelemetri();
    intervalPingTelemetri = setInterval(paksaKirimTelemetri, 10000); 
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data && data.type === "execute_command" && data.action) {
        console.log("Menerima instruksi kendali dari Web Dashboard:", data.action);
        
        if (data.action === "start_ahk") {
          kirimTombolVirtualKeWindows("F3").then(() => {
            statusAhkSaatIni = true;
            paksaKirimTelemetri();
          });
        } else if (data.action === "stop_ahk") {
          kirimTombolVirtualKeWindows("F8").then(() => {
            statusAhkSaatIni = false;
            paksaKirimTelemetri();
          });
        }
      }
    } catch (err) {
      console.error("Gagal memproses parsing perintah backend:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("Disconnected, reconnecting in 5s...");
    clearInterval(intervalPingTelemetri);
    setTimeout(connectToServer, 5000);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });
}

console.log("Starting remote client with Global Hotkey-Watcher Engine...");
aktifkanPemantauTombolFisik();
connectToServer();