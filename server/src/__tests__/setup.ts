import express from 'express';
import { initDb, resetStore } from '../db/init';
import booksRouter from '../routes/books';
import cartRouter from '../routes/cart';
import ordersRouter from '../routes/orders';

/**
 * Creates a fresh Express app instance with all routes mounted.
 * Resets and re-seeds the in-memory store so each test suite starts clean.
 */
export function createTestApp(): express.Express {
  resetStore();
  initDb();

  const app = express();
  app.use(express.json());

  app.use('/api/books', booksRouter);
  app.use('/api/cart', cartRouter);
  app.use('/api/orders', ordersRouter);

  return app;
}
