import { NextRequest, NextResponse } from 'next/server';

interface DeviceInfo {
  name: string;
  serial: string;
  hostname: string;
  localIp: string;
  publicIp?: string;
  mac: string;
  model: string;
  wifi: string;
  bssid: string;
  user: string;
  ahkRunning: boolean;
  timestamp: number;
}

// In-memory store of device status (in production, use database)
const deviceStore = new Map<string, DeviceInfo>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DeviceInfo;

    // Validate required fields
    if (!body.serial || !body.hostname || !body.localIp) {
      return NextResponse.json(
        { error: 'Missing required fields: serial, hostname, localIp' },
        { status: 400 }
      );
    }

    const deviceKey = `${body.serial}-${body.hostname}`;
    
    const deviceInfo: DeviceInfo = {
      ...body,
      timestamp: Date.now(),
    };

    deviceStore.set(deviceKey, deviceInfo);

    return NextResponse.json({
      success: true,
      message: 'Device registered successfully',
      deviceKey,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Device registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register device' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const devices = Array.from(deviceStore.values());
    const now = Date.now();

    // Filter devices that are online (last seen within 2 minutes)
    const onlineDevices = devices.filter(d => now - d.timestamp < 120000);
    const offlineDevices = devices.filter(d => now - d.timestamp >= 120000);

    return NextResponse.json({
      success: true,
      online: onlineDevices,
      offline: offlineDevices,
      totalOnline: onlineDevices.length,
      totalOffline: offlineDevices.length,
      timestamp: now,
    });
  } catch (error) {
    console.error('Failed to get device status:', error);
    return NextResponse.json(
      { error: 'Failed to get device status' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceKey = searchParams.get('deviceKey');

    if (!deviceKey) {
      return NextResponse.json(
        { error: 'deviceKey parameter required' },
        { status: 400 }
      );
    }

    const deleted = deviceStore.delete(deviceKey);

    return NextResponse.json({
      success: deleted,
      message: deleted ? 'Device unregistered' : 'Device not found',
    });
  } catch (error) {
    console.error('Device unregistration error:', error);
    return NextResponse.json(
      { error: 'Failed to unregister device' },
      { status: 500 }
    );
  }
}
