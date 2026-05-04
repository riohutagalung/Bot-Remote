import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

// In-memory user store for demo (replace with database in production)
const users = [
  {
    id: '1',
    name: 'Rio Hutagalung',
    email: 'rio.hutagalung2@gmail.com',
    username: 'hutagalungrioo',
    password: '$2b$12$JjEPM03p2QNOcNeIl/Sx9Ov9S4ciqa9/UXxSgHlNfeIABUAJLc0ni', // hashed 'Taikbabi182#'
    twoFactorEnabled: true,
  },
];

const verificationTokens = new Map<string, { token: string; expires: Date }>();
const emailConfigured = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER ?? '',
    pass: process.env.EMAIL_PASS ?? '',
  },
});

if (!process.env.NEXTAUTH_URL) {
  if (process.env.VERCEL_URL) {
    process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
  } else if (process.env.NODE_ENV === 'development') {
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  }
}

const authOptions = {
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        code: { label: '2FA Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = users.find((u) => u.username === credentials.username);
        if (!user) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.password);
        if (!isValidPassword) {
          return null;
        }

        if (user.twoFactorEnabled) {
          if (!credentials.code) {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            verificationTokens.set(user.email, { token: code, expires: expiresAt });

            if (emailConfigured) {
              try {
                await transporter.sendMail({
                  from: process.env.EMAIL_USER,
                  to: user.email,
                  subject: 'RH Control Center - 2FA Code',
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2>RH Control Center Login</h2>
                      <p>Your 2FA code is: <strong>${code}</strong></p>
                      <p>This code will expire in 10 minutes.</p>
                      <p>If you didn't request this, please ignore this email.</p>
                    </div>
                  `,
                });

                if (process.env.BACKUP_EMAIL) {
                  await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: process.env.BACKUP_EMAIL,
                    subject: 'RH Control Center - 2FA Code (Backup)',
                    html: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>RH Control Center Login (Backup)</h2>
                        <p>2FA code sent to ${user.email}: <strong>${code}</strong></p>
                        <p>This code will expire in 10 minutes.</p>
                      </div>
                    `,
                  });
                }
              } catch (error) {
                console.error('Failed to send 2FA email:', error);
                return null;
              }
            } else {
              console.warn('EMAIL_USER or EMAIL_PASS is not configured. 2FA code will be logged to the server console.');
              console.info(`2FA code for ${user.email}: ${code}`);
            }

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              username: user.username,
              twoFactorPending: true,
            };
          }

          const tokenData = verificationTokens.get(user.email);
          if (!tokenData || tokenData.token !== credentials.code || tokenData.expires < new Date()) {
            return null;
          }
          verificationTokens.delete(user.email);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt' as const,
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username = (user as any).username;
        token.twoFactorPending = (user as any).twoFactorPending;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).id = token.sub;
        (session.user as any).username = token.username;
        (session.user as any).twoFactorPending = token.twoFactorPending;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET ?? 'dev-secret',
  debug: process.env.NODE_ENV !== 'production',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
