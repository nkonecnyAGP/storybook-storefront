import { Router } from 'express';
import prisma from '../db/prisma';
import { getAuthUser } from './auth';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { theme, age_range, featured } = req.query;

  const where: Record<string, unknown> = {};
  if (theme) where.theme = theme;
  if (age_range) where.age_range = age_range;
  if (featured === 'true') where.is_featured = true;

  const books = await prisma.book.findMany({
    where,
    orderBy: { is_featured: 'desc' },
  });

  res.json(books);
});

router.get('/mine', async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const books = await prisma.book.findMany({
    where: { created_by: user.id },
  });
  res.json(books);
});

router.get('/themes', async (_req: Request, res: Response) => {
  const books = await prisma.book.findMany({ select: { theme: true } });
  const themes = [...new Set(books.map(b => b.theme))].sort();
  res.json(themes);
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const book = await prisma.book.findUnique({
    where: { id: req.params.id },
    include: {
      pages: { orderBy: { page_number: 'asc' } },
    },
  });

  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  res.json(book);
});

export default router;
