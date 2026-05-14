import { Router } from 'express';
import prisma from '../db/prisma';
import type { Request, Response } from 'express';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { sessionId, customerName, customerEmail } = req.body as {
    sessionId?: string;
    customerName?: string;
    customerEmail?: string;
  };

  if (!sessionId || !customerName || !customerEmail) {
    return res.status(400).json({ error: 'sessionId, customerName, and customerEmail are required' });
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { session_id: sessionId },
    include: { book: true },
  });

  if (cartItems.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const total = cartItems.reduce((sum, item) => sum + item.book.price * item.quantity, 0);

  const order = await prisma.order.create({
    data: {
      session_id: sessionId,
      customer_name: customerName,
      customer_email: customerEmail,
      total,
      items: {
        create: cartItems.map(item => ({
          book_id: item.book_id,
          title: item.book.title,
          quantity: item.quantity,
          price: item.book.price,
        })),
      },
    },
    include: { items: true },
  });

  await prisma.cartItem.deleteMany({ where: { session_id: sessionId } });

  res.json(order);
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json(order);
});

export default router;
