import { Router } from 'express';
import { getStore } from '../db/init';
import { getAuthUser } from './auth';
import type { Request, Response } from 'express';
import type { Book } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { books } = getStore();
  const { theme, age_range, featured } = req.query;

  let result: Book[] = [...books];

  if (theme) result = result.filter((b) => b.theme === theme);
  if (age_range) result = result.filter((b) => b.age_range === age_range);
  if (featured === 'true') result = result.filter((b) => b.is_featured);

  result.sort((a, b) => (b.is_featured || 0) - (a.is_featured || 0));
  res.json(result);
});

router.get('/mine', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { books } = getStore();
  const myBooks = books.filter(b => b.created_by === user.id);
  res.json(myBooks);
});

router.get('/themes', (_req: Request, res: Response) => {
  const { books } = getStore();
  const themes: string[] = [...new Set(books.map((b) => b.theme))].sort();
  res.json(themes);
});

router.get('/:id', (req: Request, res: Response) => {
  const { books, pages } = getStore();
  const book = books.find((b) => b.id === req.params.id);

  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const bookPages = pages
    .filter((p) => p.book_id === req.params.id)
    .sort((a, b) => a.page_number - b.page_number);

  res.json({ ...book, pages: bookPages });
});

export default router;
