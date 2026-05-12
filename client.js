import WebSocket from "ws";
import { exec, execSync } from "child_process";
import os from "os";
import path from "path";

const SERVER_URL = "wss://bot-remote-production.up.railway.app";

// ambil data sistem
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

// ambil serial number (fallback kalau bukan Windows)
function getSerialNumber() {
  try {
    if (os.platform() === "win32") {
      const output = execSync("wmic bios get serialnumber /value", {
        encoding: "utf8",
      });
      const match = output.match(/SerialNumber=(\S+)/);
      return match ? match[1] : "Unknown";
    } else {
      return "Unknown";
    }
  } catch {
    return "Unknown";
  }
}

// ambil SSID wifi (Windows only)
function getWifiSSID() {
  try {
    if (os.platform() === "win32") {
      const output = execSync("netsh wlan show interfaces", {
        encoding: "utf8",
      });
      const match = output.match(/SSID\s*:\s*(.+)/);
      return match ? match[1].trim() : "Unknown";
    } else {
      return "Unknown";
    }
  } catch {
    return "Unknown";
  }
}

// ambil IP lokal
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

// ambil MAC address
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

// fungsi kontrol AutoHotkey
function controlAutoHotkey(action) {
  return new Promise((resolve, reject) => {
    if (os.platform() !== "win32") {
      console.warn("AutoHotkey control only works on Windows");
      return resolve("Skipped non-Windows platform");
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
      reject(new Error("Unknown action"));
      return;
    }

    exec(command, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

function connectToServer() {
  const ws = new WebSocket(SERVER_URL);

  ws.on("open", () => {
    console.log("Connected to server");
    const info = getSystemInfo();

    // gabungkan serial + MAC + SSID jadi ID unik
    const uniqueId =
      `${info.serial}-${info.mac}-${info.wifi}`.replace(/[^\w-]/g, "_");

    ws.send(
      JSON.stringify({
        type: "register",
        deviceId: uniqueId,
        deviceInfo: info,
      })
    );
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "execute_command") {
        console.log("Execute command:", data.command);

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
    console.log("Disconnected, reconnecting in 5s...");
    setTimeout(connectToServer, 5000);
  });

  ws.on("error", (err) => console.error("WebSocket error:", err.message));
}

console.log("Starting remote client…");
connectToServer();