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
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj8nJZkW5HGm', // hashed 'Taikbabi182#'
    twoFactorEnabled: true,
  },
];

const verificationTokens = new Map<string, { token: string; expires: Date }>();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const GET = NextAuth({
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

        // Find user
        const user = users.find(u => u.username === credentials.username);
        if (!user) {
          return null;
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(credentials.password, user.password);
        if (!isValidPassword) {
          return null;
        }

        // Check if 2FA is enabled
        if (user.twoFactorEnabled) {
          if (!credentials.code) {
            // Generate and send 2FA code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            verificationTokens.set(user.email, { token: code, expires: expiresAt });

            // Send email
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

              // Also send to backup email
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

            // Return user with pending 2FA
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              username: user.username,
              twoFactorPending: true,
            };
          } else {
            // Verify 2FA code
            const tokenData = verificationTokens.get(user.email);
            if (!tokenData || tokenData.token !== credentials.code || tokenData.expires < new Date()) {
              return null;
            }

            // Delete used token
            verificationTokens.delete(user.email);
          }
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
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
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
});

export const POST = GET;