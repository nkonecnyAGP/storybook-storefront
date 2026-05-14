import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../db/prisma';
import type { Request, Response } from 'express';

const router = Router();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return salt + ':' + hash;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const check = createHash('sha256').update(salt + password).digest('hex');
  return check === hash;
}

export async function getAuthUser(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  return prisma.user.findFirst({ where: { token } });
}

router.post('/register', async (req: Request, res: Response) => {
  const { email, name, password } = req.body as { email?: string; name?: string; password?: string };

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, and password are required' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const token = uuidv4();
  const user = await prisma.user.create({
    data: {
      email,
      name,
      password_hash: hashPassword(password),
      token,
    },
  });

  res.status(201).json({ id: user.id, email: user.email, name: user.name, token });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = uuidv4();
  await prisma.user.update({ where: { id: user.id }, data: { token } });

  res.json({ id: user.id, email: user.email, name: user.name, token });
});

router.post('/logout', async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { token: null } });
  }
  res.json({ ok: true });
});

router.get('/me', async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ id: user.id, email: user.email, name: user.name });
});

export default router;
