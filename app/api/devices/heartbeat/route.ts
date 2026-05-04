import { NextRequest, NextResponse } from 'next/server';

interface HeartbeatPayload {
  serial: string;
  hostname: string;
  localIp: string;
  ahkRunning: boolean;
  systemUptime?: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

// Store heartbeat data in memory
const heartbeatStore = new Map<string, HeartbeatPayload & { lastSeen: number }>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as HeartbeatPayload;

    if (!body.serial || !body.hostname) {
      return NextResponse.json(
        { error: 'Missing required fields: serial, hostname' },
        { status: 400 }
      );
    }

    const deviceKey = `${body.serial}-${body.hostname}`;
    const now = Date.now();

    heartbeatStore.set(deviceKey, {
      ...body,
      lastSeen: now,
    });

    return NextResponse.json({
      success: true,
      message: 'Heartbeat received',
      timestampServer: now,
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json(
      { error: 'Failed to process heartbeat' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serial = searchParams.get('serial');
    const hostname = searchParams.get('hostname');

    const now = Date.now();

    if (serial && hostname) {
      // Get specific device status
      const deviceKey = `${serial}-${hostname}`;
      const device = heartbeatStore.get(deviceKey);

      if (!device) {
        return NextResponse.json({
          connected: false,
          ahkRunning: false,
          message: 'Device not connected',
        });
      }

      const isAlive = now - device.lastSeen < 120000; // 2 minutes

      return NextResponse.json({
        connected: isAlive,
        ahkRunning: isAlive && device.ahkRunning,
        lastSeen: device.lastSeen,
        uptime: now - device.lastSeen,
        systemUptime: device.systemUptime,
        memoryUsage: device.memoryUsage,
        cpuUsage: device.cpuUsage,
      });
    }

    // Get all devices heartbeat status
    const devices = Array.from(heartbeatStore.values());
    const status = devices.map(d => ({
      deviceKey: `${d.serial}-${d.hostname}`,
      connected: now - d.lastSeen < 120000,
      ahkRunning: (now - d.lastSeen < 120000) && d.ahkRunning,
      lastSeen: d.lastSeen,
      uptime: now - d.lastSeen,
    }));

    return NextResponse.json({
      success: true,
      devices: status,
      timestamp: now,
    });
  } catch (error) {
    console.error('Failed to get heartbeat status:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
