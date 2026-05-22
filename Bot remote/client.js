// --- Remote Client (Agent) ---
import WebSocket from "ws";
import { exec, execSync } from "child_process";
import os from "os";
import path from "path";

const SERVER_URL = "wss://bot-remote-production.up.railway.app";

// ================= System Info =================
function getSystemInfo() {
  const info = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    username: os.userInfo().username,
    serial: getSerialNumber(),
    ip: getLocalIP(),
    mac: getMACAddress(),
    wifi: getWifiSSID(),
  };
  // Gabungkan jadi ID unik
  info.id = `${info.serial}-${info.mac}-${info.wifi}`.replace(/[^\w-]/g, "_");
  return info;
}

function getSerialNumber() {
  try {
    if (os.platform() === "win32") {
      const output = execSync("wmic bios get serialnumber /value", {
        encoding: "utf8",
      });
      const match = output.match(/SerialNumber=(\S+)/);
      return match ? match[1] : "Unknown";
    }
  } catch {}
  return "Unknown";
}

function getWifiSSID() {
  try {
    if (os.platform() === "win32") {
      const output = execSync("netsh wlan show interfaces", {
        encoding: "utf8",
      });
      const match = output.match(/SSID\\s*:\\s*(.+)/);
      return match ? match[1].trim() : "Unknown";
    }
  } catch {}
  return "Unknown";
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
  return "Unknown";
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
  return "Unknown";
}

// ================= AutoHotkey Control =================
function controlAutoHotkey(action) {
  return new Promise((resolve, reject) => {
    if (os.platform() !== "win32") {
      console.warn("AutoHotkey control hanya tersedia di Windows");
      return resolve("Non-Windows platform: skipped");
    }

    let command;
    if (action === "start") {
      command = `"C:\\Program Files\\AutoHotkey\\AutoHotkey.exe" "${path.join(
        __dirname,
        "script.ahk"
      )}"`;
    } else if (action === "stop") {
      command = "taskkill /f /im AutoHotkey.exe";
    } else {
      return reject(new Error("Unknown action"));
    }

    exec(command, (error) => {
      if (error) reject(error);
      else resolve(`AHK ${action} executed`);
    });
  });
}

// ================= Status Checker =================
function isAhkRunning() {
  try {
    const result = execSync('tasklist /FI "imagename eq AutoHotkey.exe"', {
      encoding: "utf8",
    });
    return result.includes("AutoHotkey.exe");
  } catch {
    return false;
  }
}

// ================= Connection Handler =================
function connectToServer() {
  const ws = new WebSocket(SERVER_URL);

  ws.on("open", () => {
    const info = getSystemInfo();
    console.log("Connected to server as:", info.id);

    ws.send(
      JSON.stringify({ type: "register", deviceId: info.id, deviceInfo: info })
    );

    // Kirim status awal AHK
    ws.send(
      JSON.stringify({
        type: "status_update",
        deviceId: info.id,
        status: { ahkEnabled: isAhkRunning() },
      })
    );

    // Kirim status AHK setiap 5 detik
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "status_update",
            deviceId: info.id,
            status: { ahkEnabled: isAhkRunning() },
          })
        );
      }
    }, 5000);
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "execute_command") {
        console.log("Command received:", data.command);

        if (data.command === "start_ahk" || data.command === "stop_ahk") {
          const act = data.command === "start_ahk" ? "start" : "stop";
          controlAutoHotkey(act)
            .then(() => {
              ws.send(
                JSON.stringify({
                  type: "status_update",
                  deviceId: data.deviceId,
                  status: { ahkEnabled: act === "start" },
                })
              );
            })
            .catch((err) =>
              console.error("Failed executing AHK:", err.message)
            );
        }
      }
    } catch (err) {
      console.error("Parse error:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("Disconnected, reconnecting in 5 s...");
    setTimeout(connectToServer, 5000);
  });

  ws.on("error", (err) => console.error("WebSocket error:", err.message));
}

// ================= Start Agent =================
console.log("Starting remote client agent…");
connectToServer();