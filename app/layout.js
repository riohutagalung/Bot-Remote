import './globals.css';
import { SessionProvider } from '@/components/SessionProvider';

export const metadata = {
  title: 'RH Control Center',
  description: 'Real-time AutoHotkey status across registered laptops',
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
