import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const SERVER_SECRET = process.env.VVIP_SERVER_SECRET || crypto.randomBytes(32).toString('hex');
const VVIP_CREDENTIAL = process.env.VVIP_ACCESS_CREDENTIAL || 'bahwanmge';
const VVIP_SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes session TTL

function generateVvipToken(email: string): string {
  const expiresAt = Date.now() + VVIP_SESSION_TTL_MS;
  const payload = JSON.stringify({
    sub: 'superadmin-vvip-platform-owner',
    email,
    role: 'SUPER_ADMIN',
    exp: expiresAt,
  });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifyVvipToken(token: string): { valid: boolean; email?: string; expiresAt?: number } {
  if (!token || typeof token !== 'string') return { valid: false };
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };
  const [encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return { valid: false };
  }

  try {
    const payloadStr = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const data = JSON.parse(payloadStr);
    if (data.role !== 'SUPER_ADMIN' || !data.exp || data.exp < Date.now()) {
      return { valid: false };
    }
    return { valid: true, email: data.email, expiresAt: data.exp };
  } catch {
    return { valid: false };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ZaynOps Enterprise Platform' });
  });

  // Secure Server-Side VVIP Credential Verification
  app.post('/api/auth/vvip-verify', (req, res) => {
    try {
      const { credential } = req.body || {};
      if (!credential || typeof credential !== 'string') {
        return res.status(400).json({ success: false, message: 'Platform credential required' });
      }

      // Secure constant-time comparison to prevent timing attacks
      const credBuffer = Buffer.from(credential.trim());
      const targetBuffer = Buffer.from(VVIP_CREDENTIAL);
      const isMatch =
        credBuffer.length === targetBuffer.length &&
        crypto.timingSafeEqual(credBuffer, targetBuffer);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid platform credential. Access rejected.',
        });
      }

      const vvipEmail = 'itsyourmujahid@gmail.com';
      const token = generateVvipToken(vvipEmail);

      return res.json({
        success: true,
        message: 'VVIP Authorization Confirmed',
        token,
        user: {
          uid: 'superadmin-vvip-platform-owner',
          email: vvipEmail,
          role: 'SUPER_ADMIN',
          full_name: 'Platform Owner (VVIP)',
          is_active: true,
        },
      });
    } catch (err: any) {
      console.error('VVIP verification error:', err);
      return res.status(500).json({ success: false, message: 'Internal server verification error' });
    }
  });

  // Secure Server-Side Session Validation
  app.post('/api/auth/vvip-validate-session', (req, res) => {
    const { token } = req.body || {};
    const result = verifyVvipToken(token);
    if (!result.valid) {
      return res.status(401).json({ valid: false, message: 'VVIP Session expired or invalid' });
    }
    return res.json({
      valid: true,
      email: result.email,
      expiresAt: result.expiresAt,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZaynOps Platform Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
