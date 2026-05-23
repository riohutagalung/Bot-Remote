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

// =======================================================
// PERBAIKAN LOGIKA UTAMA EKSEKUSI PERINTAH WINDOWS
// =======================================================
function controlAutoHotkey(action) {
  return new Promise((resolve) => {
    if (os.platform() !== "win32") {
      console.warn("AutoHotkey control only works on Windows");
      return resolve();
    }

    let command;
    if (action === "start") {
      // Menggunakan process.cwd() agar aman saat dicompile jadi exe (mencari file di folder luar, bukan di internal virtual pkg)
      const scriptPath = path.join(process.cwd(), "script.ahk");
      command = `"C:\\Program Files\\AutoHotkey\\AutoHotkey.exe" "${scriptPath}"`;
    } else if (action === "stop") {
      // Ditambahkan /f (force) dan /t (tree) agar mematikan sub-proses AHK secara tuntas
      command = "taskkill /f /t /im AutoHotkey.exe || exit 0";
    } else {
      return resolve();
    }

    console.log(`[Executing Shell Command]: ${command}`);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Exec Error]: ${error.message}`);
      }
      resolve();
    });
  });
}

function connectToServer() {
  const ws = new WebSocket(SERVER_URL);
  let intervalPingTelemetri;

  const kirimSinyalTelemetri = () => {
    if (ws.readyState === WebSocket.OPEN) {
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

      ws.send(JSON.stringify(payload));
    }
  };

  ws.on("open", () => {
    console.log("✔ Connected to remote server safely");
    kirimSinyalTelemetri();
    intervalPingTelemetri = setInterval(kirimSinyalTelemetri, 10000); 
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data && data.type === "execute_command" && data.action) {
        console.log("Menerima instruksi aksi:", data.action);
        const targetAksi = data.action === "start_ahk" ? "start" : "stop";
        
        controlAutoHotkey(targetAksi).then(() => {
          statusAhkSaatIni = (targetAksi === "start");
          console.log(`Status Engine AHK sekarang: ${statusAhkSaatIni ? "NYALA" : "MATI"}`);
          kirimSinyalTelemetri(); 
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

console.log("Starting remote client...");
connectToServer();