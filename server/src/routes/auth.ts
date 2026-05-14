import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getStore, save } from '../db/init';
import type { Request, Response } from 'express';
import type { User } from '../types';

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

function getAuthUser(req: Request): User | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  const store = getStore();
  return store.users.find(u => u.token === token) ?? null;
}

router.post('/register', (req: Request, res: Response) => {
  const { email, name, password } = req.body as { email?: string; name?: string; password?: string };

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, and password are required' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const store = getStore();
  if (store.users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const token = uuidv4();
  const user: User = {
    id: uuidv4(),
    email,
    name,
    password_hash: hashPassword(password),
    token,
    created_at: new Date().toISOString(),
  };

  store.users.push(user);
  save();

  res.status(201).json({ id: user.id, email: user.email, name: user.name, token });
});

router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const store = getStore();
  const user = store.users.find(u => u.email === email);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = uuidv4();
  user.token = token;
  save();

  res.json({ id: user.id, email: user.email, name: user.name, token });
});

router.post('/logout', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user) {
    user.token = null;
    save();
  }
  res.json({ ok: true });
});

router.get('/me', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ id: user.id, email: user.email, name: user.name });
});

export { getAuthUser };
export default router;
