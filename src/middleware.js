import { NextResponse } from 'next/server';

export function middleware(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return new NextResponse('EH siapa kau!', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
    });
  }

  // Ganti "admin:passwordrahasia" dengan teks base64 abang
  // Format standard basic auth: btoa("username:password")
  const auth = authHeader.split(' ')[1];
  const [user, pwd] = Buffer.from(auth, 'base64').toString().split(':');

  // SILAKAN GANTI USERNAME & PASSWORD ABANG DI SINI
  if (user === 'hutagalungrioo' && pwd === 'Taikbabi182#') {
    return NextResponse.next();
  }

  return new NextResponse('Kunci Salah, Cabut kau!', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}

export const config = {
  matcher: '/:path*', // Mengunci semua halaman web tanpa terkecuali
};