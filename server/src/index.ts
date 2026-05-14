// Allow self-signed certs (corporate proxy)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import booksRouter from './routes/books';
import generateRouter from './routes/generate';
import cartRouter from './routes/cart';
import ordersRouter from './routes/orders';

import type { Request, Response } from 'express';

dotenv.config({ path: '../.env' });

const app = express();
const PORT: number = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/generate', generateRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
