// loadEnv must be first — it populates process.env (incl. DATABASE_URL)
// before any other import instantiates the Prisma client.
import './loadEnv';

// Allow self-signed certs (corporate proxy)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import express from 'express';
import cors from 'cors';
import { join } from 'path';
import authRouter from './routes/auth';
import booksRouter from './routes/books';
import generateRouter from './routes/generate';
import cartRouter from './routes/cart';
import ordersRouter from './routes/orders';
import uploadsRouter from './routes/uploads';
import testRouter from './routes/test';
import { snapshotDb } from './db/snapshot';

import type { Request, Response } from 'express';

const app = express();
const PORT: number = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/illustrations', express.static(join(import.meta.dirname, '../public/illustrations')));
app.use('/uploads', express.static(join(import.meta.dirname, '../public/uploads')));

app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/generate', generateRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/uploads', uploadsRouter);

// Test-only routes for cleaning up state left by E2E specs. Mounted only
// outside production; the handlers themselves also enforce a NODE_ENV check.
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/_test', testRouter);
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Best-effort backup of dev.db on every server start. Quiet on failure.
  void snapshotDb();
});
