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

// ==========================================================
// FUNGSIONALITAS BARU: CEK REAL-TIME APAKAH AHK SEDANG AKTIF DI WINDOWS
// ==========================================================
function periksaApakahAhkJalan() {
  return new Promise((resolve) => {
    if (os.platform() !== "win32") return resolve(false);
    
    // Periksa daftar aplikasi aktif di Windows Task Manager yang bernama AutoHotkey.exe
    exec('tasklist /FI "IMAGENAME eq AutoHotkey.exe"', (err, stdout) => {
      if (err) return resolve(false);
      const sedangJalan = stdout.toLowerCase().includes("autohotkey.exe");
      resolve(sedangJalan);
    });
  });
}

function controlAutoHotkey(action) {
  return new Promise((resolve) => {
    if (os.platform() !== "win32") {
      console.warn("AutoHotkey control only works on Windows");
      return resolve();
    }

    let command;
    if (action === "start") {
      const scriptPath = path.join(process.cwd(), "script.ahk");
      command = `"C:\\Program Files\\AutoHotkey\\AutoHotkey.exe" "${scriptPath}"`;
    } else if (action === "stop") {
      // Mematikan paksa KHUSUS aplikasi AutoHotkey saja, dijamin aman bagi aplikasi lain
      command = "taskkill /f /t /im AutoHotkey.exe || exit 0";
    } else {
      return resolve();
    }

    console.log(`[Menjalankan Perintah Windows]: ${command}`);
    exec(command, () => resolve());
  });
}

function connectToServer() {
  const ws = new WebSocket(SERVER_URL);
  let intervalPingTelemetri;

  const kirimSinyalTelemetri = async () => {
    if (ws.readyState === WebSocket.OPEN) {
      // Selalu cek kondisi aktual Windows sebelum lapor ke server Railway & Vercel
      statusAhkSaatIni = await periksaApakahAhkJalan();

      const info = getSystemInfo();
      const cleanId = info.serial.replace(/[^\w-]/g, "_");

      const payload = {
        id: cleanId,
        ahkEnabled: statusAhkSaatIni, // Data ini sekarang jujur berdasarkan Task Manager Windows
        hostname: info.hostname,
        model: `${info.platform} (${info.arch})`,
        wifi: info.wifi,
        ip: info.ip,
        mac: info.mac
      };

      ws.send(JSON.stringify(payload));
    }
  };

  ws.on("open", () => {
    console.log("✔ Connected to remote server safely");
    kirimSinyalTelemetri();
    // Dipercepat pengecekannya menjadi setiap 3 detik sekali agar Web Vercel super responsif mengikuti F3/F8 kamu
    intervalPingTelemetri = setInterval(kirimSinyalTelemetri, 3000); 
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data && data.type === "execute_command" && data.action) {
        console.log("Menerima instruksi aksi dari Web:", data.action);
        const targetAksi = data.action === "start_ahk" ? "start" : "stop";
        
        controlAutoHotkey(targetAksi).then(async () => {
          await new Promise(r => setTimeout(r, 500)); // beri jeda sesaat agar proses Windows berubah dulu
          await kirimSinyalTelemetri(); // Langsung paksa kirim status segar ke web
        });
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

console.log("Starting remote client with Task-Watcher Engine...");
connectToServer();