# Bot-Remote - Laptop Remote Control System

A web-based system for remotely controlling AutoHotkey applications on registered laptops via WebSocket connections.

## Features

- **Device Management**: Register and manage laptop devices with detailed system information
- **Real-time Control**: Start/stop AutoHotkey scripts remotely
- **WebSocket Communication**: Real-time bidirectional communication between web app and target devices
- **Secure Authentication**: Password-protected access to the control panel
- **System Information**: Automatic detection of device specs, network info, and serial numbers

## Architecture

- **Frontend**: React web application for device management and control
- **Backend**: Node.js Express server with WebSocket support
- **Client**: Node.js application that runs on target laptops to receive commands

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Backend Server

```bash
npm run server
```

This starts the Express server on port 3001 and WebSocket server on port 3002.

### 3. Build and Start the Frontend

```bash
npm run build
npm run preview
```

Or for development:

```bash
npm run dev
```

### 4. Setup Target Laptop Client

On each laptop you want to control:

1. Install Node.js
2. Install AutoHotkey
3. Copy `client.js` and `script.ahk` to the laptop
4. Run the client:

```bash
node client.js [device-id]
```

Example:
```bash
node client.js laptop-001
```

### 5. Access the Web Interface

Open your browser and go to `http://localhost:3001`

- Default password: `Taikbabi182#`
- Add devices using the "Add Device" form or import from CMD output
- Use the toggle buttons to start/stop AutoHotkey remotely

## Usage

### Adding Devices

1. **Manual Entry**: Fill in device details in the web interface
2. **CMD Import**: Run system commands on target laptop and paste output:

```cmd
wmic bios get serialnumber
wmic csproduct get uuid
hostname
echo %username%
ipconfig /all
netsh wlan show interfaces
```

### Remote Control

- **Online Status**: Green indicator shows when device is connected
- **AHK Control**: Toggle buttons to start/stop AutoHotkey scripts
- **Real-time Updates**: Status updates automatically via WebSocket

## Security Notes

- Change the default password in production
- Use HTTPS in production environment
- Implement proper authentication for the WebSocket connections
- Consider firewall rules for WebSocket ports

## Troubleshooting

- **Server Connection Issues**: Ensure ports 3001 and 3002 are not blocked
- **Client Connection**: Check firewall settings on target laptops
- **AutoHotkey Not Starting**: Verify AutoHotkey is installed and script.ahk exists
- **Device Not Appearing Online**: Ensure client is running and connected to server

## Development

- Frontend: React with Tailwind CSS
- Backend: Express.js with WebSocket
- Client: Node.js with system command execution
