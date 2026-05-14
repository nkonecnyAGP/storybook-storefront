import { Router } from 'express';
import { getStore, save } from '../db/init.js';

const router = Router();

router.get('/:sessionId', (req, res) => {
  const { cartItems, books } = getStore();
  const items = cartItems
    .filter(ci => ci.session_id === req.params.sessionId)
    .map(ci => {
      const book = books.find(b => b.id === ci.book_id);
      return {
        id: ci.id,
        quantity: ci.quantity,
        book_id: ci.book_id,
        title: book?.title,
        price: book?.price,
        cover_emoji: book?.cover_emoji,
        cover_color: book?.cover_color,
        author: book?.author,
      };
    });

  const total = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  res.json({ items, total });
});

router.post('/:sessionId/items', (req, res) => {
  const store = getStore();
  const { bookId, quantity = 1 } = req.body;
  const { sessionId } = req.params;

  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  if (!store.books.find(b => b.id === bookId)) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const existing = store.cartItems.find(ci => ci.session_id === sessionId && ci.book_id === bookId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    store.cartItems.push({
      id: store.cartItems.length + 1,
      session_id: sessionId,
      book_id: bookId,
      quantity,
    });
  }

  save();
  res.json({ success: true });
});

router.put('/:sessionId/items/:bookId', (req, res) => {
  const store = getStore();
  const { quantity } = req.body;
  const { sessionId, bookId } = req.params;

  if (quantity <= 0) {
    store.cartItems = store.cartItems.filter(ci => !(ci.session_id === sessionId && ci.book_id === bookId));
  } else {
    const item = store.cartItems.find(ci => ci.session_id === sessionId && ci.book_id === bookId);
    if (item) item.quantity = quantity;
  }

  save();
  res.json({ success: true });
});

router.delete('/:sessionId/items/:bookId', (req, res) => {
  const store = getStore();
  store.cartItems = store.cartItems.filter(ci => !(ci.session_id === req.params.sessionId && ci.book_id === req.params.bookId));
  save();
  res.json({ success: true });
});

router.delete('/:sessionId', (req, res) => {
  const store = getStore();
  store.cartItems = store.cartItems.filter(ci => ci.session_id !== req.params.sessionId);
  save();
  res.json({ success: true });
});

export default router;
