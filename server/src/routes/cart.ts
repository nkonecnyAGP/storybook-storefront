import { Router } from 'express';
import prisma from '../db/prisma';
import type { Request, Response } from 'express';

const router = Router();

router.get('/:sessionId', async (req: Request<{ sessionId: string }>, res: Response) => {
  const { sessionId } = req.params;
  const items = await prisma.cartItem.findMany({
    where: { session_id: sessionId },
    include: { book: true },
  });

  const mapped = items.map(item => ({
    id: item.id,
    book_id: item.book_id,
    quantity: item.quantity,
    title: item.book.title,
    price: item.book.price,
    cover_emoji: item.book.cover_emoji,
    cover_color: item.book.cover_color,
    author: item.book.author,
  }));

  const total = mapped.reduce((sum, item) => sum + item.price * item.quantity, 0);
  res.json({ items: mapped, total });
});

router.post('/:sessionId/items', async (req: Request<{ sessionId: string }>, res: Response) => {
  const { bookId, quantity = 1 } = req.body as { bookId?: string; quantity?: number };
  const { sessionId } = req.params;

  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const existing = await prisma.cartItem.findUnique({
    where: { session_id_book_id: { session_id: sessionId, book_id: bookId } },
  });

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  } else {
    await prisma.cartItem.create({
      data: { session_id: sessionId, book_id: bookId, quantity },
    });
  }

  res.json({ success: true });
});

router.put('/:sessionId/items/:bookId', async (req: Request<{ sessionId: string; bookId: string }>, res: Response) => {
  const { quantity } = req.body as { quantity: number };
  const { sessionId, bookId } = req.params;

  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({
      where: { session_id: sessionId, book_id: bookId },
    });
  } else {
    const item = await prisma.cartItem.findUnique({
      where: { session_id_book_id: { session_id: sessionId, book_id: bookId } },
    });
    if (item) {
      await prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity },
      });
    }
  }

  res.json({ success: true });
});

router.delete('/:sessionId/items/:bookId', async (req: Request<{ sessionId: string; bookId: string }>, res: Response) => {
  const { sessionId, bookId } = req.params;
  await prisma.cartItem.deleteMany({
    where: { session_id: sessionId, book_id: bookId },
  });
  res.json({ success: true });
});

router.delete('/:sessionId', async (req: Request<{ sessionId: string }>, res: Response) => {
  const { sessionId } = req.params;
  await prisma.cartItem.deleteMany({
    where: { session_id: sessionId },
  });
  res.json({ success: true });
});

export default router;
