import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getStore, save } from '../db/init';
import type { Request, Response } from 'express';

interface CreateOrderBody {
  sessionId: string;
  customerName: string;
  customerEmail: string;
}

const router = Router();

router.post('/', (req: Request, res: Response) => {
  const store = getStore();
  const { sessionId, customerName, customerEmail } = req.body as CreateOrderBody;

  if (!sessionId || !customerName || !customerEmail) {
    return res.status(400).json({ error: 'sessionId, customerName, and customerEmail are required' });
  }

  const items = store.cartItems
    .filter((ci) => ci.session_id === sessionId)
    .map((ci) => {
      const book = store.books.find((b) => b.id === ci.book_id);
      return { book_id: ci.book_id, title: book?.title ?? '', quantity: ci.quantity, price: book?.price || 0 };
    });

  if (items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderId = uuidv4();

  store.orders.push({
    id: orderId,
    session_id: sessionId,
    customer_name: customerName,
    customer_email: customerEmail,
    total,
    status: 'confirmed',
    created_at: new Date().toISOString(),
  });

  for (const item of items) {
    store.orderItems.push({
      id: store.orderItems.length + 1,
      order_id: orderId,
      ...item,
    });
  }

  store.cartItems = store.cartItems.filter((ci) => ci.session_id !== sessionId);
  save();

  res.json({ id: orderId, customerName, customerEmail, total, items, status: 'confirmed' });
});

router.get('/:id', (req: Request, res: Response) => {
  const store = getStore();
  const order = store.orders.find((o) => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const items = store.orderItems.filter((oi) => oi.order_id === req.params.id);
  res.json({ ...order, items });
});

export default router;
