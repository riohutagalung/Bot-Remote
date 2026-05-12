import WebSocket from 'ws';
import { exec, execSync } from 'child_process';
import os from 'os';
import path from 'path';

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:3003';
const DEVICE_ID = process.argv[2] || `device-${Date.now()}`;

function getSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    username: os.userInfo().username,
    serial: getSerialNumber(),
    ip: getLocalIP(),
    mac: getMACAddress(),
  };
}

function getSerialNumber() {
  try {
    const output = execSync('wmic bios get serialnumber /value', { encoding: 'utf8' });
    const match = output.match(/SerialNumber=(\S+)/);
    return match ? match[1] : 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'Unknown';
}

function getMACAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac;
      }
    }
  }
  return 'Unknown';
}

function controlAutoHotkey(action) {
  return new Promise((resolve, reject) => {
    let command;

    if (action === 'start') {
      command = `"C:\\Program Files\\AutoHotkey\\AutoHotkey.exe" "${path.join(__dirname, 'script.ahk')}"`;
    } else if (action === 'stop') {
      command = 'taskkill /f /im AutoHotkey.exe';
    } else {
      reject(new Error('Unknown action'));
      return;
    }

    exec(command, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

function connectToServer() {
  const ws = new WebSocket(SERVER_URL);

  ws.on('open', () => {
    console.log('Connected to server');
    const deviceInfo = getSystemInfo();
    ws.send(JSON.stringify({ type: 'register', deviceId: DEVICE_ID, deviceInfo }));
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'execute_command') {
        if (data.command === 'start_ahk') {
          controlAutoHotkey('start')
            .then(() => {
              ws.send(JSON.stringify({ type: 'status_update', deviceId: DEVICE_ID, status: { ahkEnabled: true } }));
            })
            .catch((error) => console.error('Failed to start AHK:', error));
        } else if (data.command === 'stop_ahk') {
          controlAutoHotkey('stop')
            .then(() => {
              ws.send(JSON.stringify({ type: 'status_update', deviceId: DEVICE_ID, status: { ahkEnabled: false } }));
            })
            .catch((error) => console.error('Failed to stop AHK:', error));
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Disconnected from server, reconnecting in 5 seconds...');
    setTimeout(connectToServer, 5000);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

console.log(`Starting remote client for device: ${DEVICE_ID}`);
connectToServer();
