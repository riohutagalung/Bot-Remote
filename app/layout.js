import './globals.css';

export const metadata = {
  title: 'RH House Control Center',
  description: 'Manage AutoHotkey status across registered laptops',
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body>{children}</body>
    </html>
  );
}
