// ============================================================
// RH Remote Client - Stable Edition (background + unicode detect)
// ============================================================
const WebSocket = require("ws");
const { execSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const SERVER_URL = process.env.SERVER_URL || "ws://localhost:8080";
const AGENT_TOKEN = process.env.AGENT_TOKEN;
if (!AGENT_TOKEN || AGENT_TOKEN.length < 32) throw new Error("AGENT_TOKEN wajib diisi (32+ karakter)");
if (!SERVER_URL.startsWith("wss://") && !/^ws:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(SERVER_URL)) throw new Error("Gunakan wss:// untuk koneksi di luar laptop");
const { desktopAction } = require("./desktop-client.cjs");
let statusTimer;
let commandQueue = Promise.resolve();
const CURRENT_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

let wsGlobal = null;
let statusAhkSaatIni = false;

// ========= System Info =========
let cachedIdentity = null;
function getSystemInfo() {
  // BIOS/WiFi subprocesses must not delay status messages or shutdown cancellation.
  if (!cachedIdentity) cachedIdentity = {serial:getSerialNumber(),wifi:getWifiSSID()};
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    serial: cachedIdentity.serial,
    wifi: cachedIdentity.wifi,
    ip: getLocalIP(),
    mac: getMAC(),
  };
}
function getSerialNumber() {
  try {
    const o = execSync('powershell.exe -NoProfile -NonInteractive -Command "(Get-CimInstance Win32_BIOS).SerialNumber"', { encoding: "utf8", windowsHide:true, timeout:5000 });
    return o.trim() || "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}
function getWifiSSID() {
  try {
    const o = execSync("netsh wlan show interfaces", { encoding: "utf8", windowsHide:true, timeout:5000 });
    const m = o.match(/SSID\s*:\s*(.+)/);
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
const {readAhk,stopAhk} = require('./ahk-process.cjs');
const {createAhkPolicy} = require('./ahk-policy.cjs');
const {createSystemControl} = require('./system-control.cjs');
const systemControl = createSystemControl({onChange:kirimTelemetri});
const ahkPolicy = createAhkPolicy({readAhk,stopAhk,file:path.join(CURRENT_DIR,'ahk-policy.json'),onChange:kirimTelemetri});
systemControl.inspectPermissions();
async function periksaStatusAhk() { await ahkPolicy.refresh(); }
// Enforce locally even while the dashboard or network is disconnected.
periksaStatusAhk();
statusTimer = setInterval(periksaStatusAhk, 2000);

// =============================================================
// Kirim Telemetry
// =============================================================
function kirimTelemetri() {
  if (!wsGlobal || wsGlobal.readyState !== WebSocket.OPEN) return;
  const info = getSystemInfo();
  const data = {
    type: "ahk_status",
    id: (process.env.DEVICE_ID || (info.serial === "UNKNOWN" ? info.hostname : info.serial)).replace(/[^\w-]/g, "_"),
    ...ahkPolicy.snapshot(),
    systemEnabled: process.env.ALLOW_SYSTEM_CONTROL === "1", ...systemControl.snapshot(),
    hostname: info.hostname,
    model: `${info.platform} (${info.arch})`,
    wifi: info.wifi,
    ip: info.ip,
    mac: info.mac,
  };
  wsGlobal.send(JSON.stringify(data));
  console.log("[Telemetry]", JSON.stringify(ahkPolicy.snapshot()));
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
        type: "agent_auth", token: AGENT_TOKEN, desktopEnabled: process.env.ALLOW_DESKTOP_CONTROL === "1",
        id: (process.env.DEVICE_ID || (info.serial === "UNKNOWN" ? info.hostname : info.serial)).replace(/[^\w-]/g, "_"),
        hostname: info.hostname,
        model: `${info.platform} (${info.arch})`,
        wifi: info.wifi,
        ip: info.ip,
        mac: info.mac,
        ...ahkPolicy.snapshot(),
    systemEnabled: process.env.ALLOW_SYSTEM_CONTROL === "1", ...systemControl.snapshot(),
      })
    );

    periksaStatusAhk();
  });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data?.type === "desktop_command") {
        commandQueue = commandQueue.then(async () => {
          try {
            if (ws !== wsGlobal || ws.readyState !== WebSocket.OPEN) return;
            const result = await desktopAction(data.action);
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: "desktop_result", requestId: data.requestId, result}));
          } catch (error) {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: "desktop_result", requestId: data.requestId, error: error.message}));
          }
        });
      }
      if (data?.type === 'system_command') {
        Promise.resolve().then(async()=>{
          try {
            if (ws !== wsGlobal || ws.readyState !== WebSocket.OPEN) return;
            if (data.confirmed !== true) throw Error('Aksi sistem belum dikonfirmasi');
            const result = await systemControl.execute(data.action);
            if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'system_result',requestId:data.requestId,result}));
          } catch(error) {
            if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'system_result',requestId:data.requestId,error:error.message}));
          }
        });
      }
      if (data && data.type === 'execute_command') {
        commandQueue = commandQueue.then(async()=>{
          try {
            if (ws !== wsGlobal || ws.readyState !== WebSocket.OPEN) return;
            const result = await ahkPolicy.command(data.action);
            if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:'command_result',requestId:data.requestId,...result}));
          } catch(error) {
            kirimTelemetri();
            if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:'command_result',requestId:data.requestId,error:error.message}));
          }
        });
      }
    } catch (e) {
      console.error("WS parse error:", e.message);
    }
  });

  ws.on("close", () => {
    console.log("⚠ Connection lost, retrying... Kebijakan AHK lokal tetap berlaku selama agent terbuka.");
    setTimeout(connectToServer, 5000);
  });

  ws.on("error", () => {});
}

console.log("RH Remote Client — Ctrl+C untuk memutus akses");
console.log("Kontrol sistem:", process.env.ALLOW_SYSTEM_CONTROL === "1" ? "DIIZINKAN; shutdown memerlukan konfirmasi dashboard" : "NONAKTIF");
console.log("Desktop control:", process.env.ALLOW_DESKTOP_CONTROL === "1" ? "DIIZINKAN" : "NONAKTIF");
connectToServer();
