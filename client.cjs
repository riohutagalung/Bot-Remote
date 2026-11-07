// ============================================================
// RH Remote Client - Stable Edition (background + unicode detect)
// ============================================================
const WebSocket = require("ws");
const { execSync, spawn } = require("child_process");
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
let ahkKnown = false;
let ahkError = '';
let checkingAhk = false;
let ownedAhk = null;
async function kendalikanAhkBalikLayar(aksi, namaScript = "") {
  if (os.platform() !== "win32") return;
  if (aksi === "stop") {
    await stopAhk();
    ownedAhk = null;
    await periksaStatusAhk();
    kirimTelemetri(); return;
  }
  if (await readAhk()) {await periksaStatusAhk();return;}
  const file = namaScript || fs.readdirSync(CURRENT_DIR).find(f => f.toLowerCase().endsWith(".ahk"));
  if (!file || path.basename(file) !== file || !/^[\w .-]+\.ahk$/i.test(file)) throw new Error("Nama script AHK tidak valid");
  const full = path.join(CURRENT_DIR, file);
  if (!fs.existsSync(full) || fs.lstatSync(full).isSymbolicLink()) throw new Error("Script AHK tidak tersedia");
  const executable = process.env.AHK_EXE || [
    "C:/Program Files/AutoHotkey/v2/AutoHotkey64.exe",
    "C:/Program Files/AutoHotkey/AutoHotkey.exe",
    "C:/Program Files/AutoHotkey/AutoHotkeyU64.exe"
  ].find(f => fs.existsSync(f));
  if (!executable) throw new Error("Set AHK_EXE ke lokasi AutoHotkey.exe");
  await new Promise((resolve,reject) => {
    ownedAhk = spawn(executable,[full],{windowsHide:true,stdio:'ignore'});
    ownedAhk.once('spawn',resolve);
    ownedAhk.once('error',error=>{ownedAhk=null;reject(new Error(`Gagal menjalankan AHK: ${error.code || error.message}`));});
    ownedAhk.once('exit',()=>{ownedAhk=null;periksaStatusAhk();});
  });
  await new Promise(resolve=>setTimeout(resolve,500));
  await periksaStatusAhk();
  if(!ahkKnown || !statusAhkSaatIni) throw new Error(ahkError || 'AutoHotkey keluar setelah dimulai; periksa versi dan script.');
}

// =============================================================
// Periksa status proses AHK (tambahan: deteksi AutoHotkey Unicode)
// =============================================================
async function periksaStatusAhk() {
  if(checkingAhk) return;
  checkingAhk=true;
  const old=JSON.stringify([statusAhkSaatIni,ahkKnown,ahkError]);
  try {statusAhkSaatIni=await readAhk();ahkKnown=true;ahkError='';}
  catch(error){ahkKnown=false;ahkError=error.message;}
  finally {checkingAhk=false;}
  if(old!==JSON.stringify([statusAhkSaatIni,ahkKnown,ahkError])) kirimTelemetri();
}

// =============================================================
// Kirim Telemetry
// =============================================================
function kirimTelemetri() {
  if (!wsGlobal || wsGlobal.readyState !== WebSocket.OPEN) return;
  const info = getSystemInfo();
  const data = {
    type: "ahk_status",
    id: (process.env.DEVICE_ID || (info.serial === "UNKNOWN" ? info.hostname : info.serial)).replace(/[^\w-]/g, "_"),
    ahkEnabled: statusAhkSaatIni, ahkKnown, ahkError,
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
        type: "agent_auth", token: AGENT_TOKEN, desktopEnabled: process.env.ALLOW_DESKTOP_CONTROL === "1",
        id: (process.env.DEVICE_ID || (info.serial === "UNKNOWN" ? info.hostname : info.serial)).replace(/[^\w-]/g, "_"),
        hostname: info.hostname,
        model: `${info.platform} (${info.arch})`,
        wifi: info.wifi,
        ip: info.ip,
        mac: info.mac,
        ahkEnabled: statusAhkSaatIni, ahkKnown, ahkError,
      })
    );

    clearInterval(statusTimer);
    periksaStatusAhk();
    statusTimer = setInterval(periksaStatusAhk, 5000);
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
      if (data && data.type === 'execute_command') {
        commandQueue = commandQueue.then(async()=>{
          try {
            if(!['start_ahk','stop_ahk'].includes(data.action)) throw new Error('Perintah tidak valid');
            await kendalikanAhkBalikLayar(data.action==='start_ahk'?'start':'stop',data.scriptName || '');
            if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:'command_result',requestId:data.requestId,ahkEnabled:statusAhkSaatIni}));
          } catch(error) {
            ahkError=error.message; kirimTelemetri();
            if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:'command_result',requestId:data.requestId,error:error.message}));
          }
        });
      }
    } catch (e) {
      console.error("WS parse error:", e.message);
    }
  });

  ws.on("close", () => {
    clearInterval(statusTimer);
    console.log("⚠ Connection lost, retrying...");
    setTimeout(connectToServer, 5000);
  });

  ws.on("error", () => {});
}

console.log("RH Remote Client — Ctrl+C untuk memutus akses");
console.log("Desktop control:", process.env.ALLOW_DESKTOP_CONTROL === "1" ? "DIIZINKAN" : "NONAKTIF");
connectToServer();
