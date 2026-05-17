import { Router } from 'express';
import prisma from '../db/prisma';
import type { Request, Response } from 'express';

// Test-only utility router. Mounted from index.ts only when
// NODE_ENV !== 'production'. The handlers themselves also short-circuit to 404
// when NODE_ENV === 'production', so even if a deployer mismounts this we fail
// closed. The x-test-secret header is belt-and-suspenders — NODE_ENV is the
// real guard.
//
// Purpose: clean up users that Playwright specs create against the live dev
// server. With reuseExistingServer in playwright.config, every dev run would
// otherwise accumulate timestamped @example.com users in dev.db.

const router = Router();

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

function expectedSecret(): string {
  return process.env.TEST_SECRET ?? 'dev-test-secret';
}

router.delete('/user-by-email', async (req: Request, res: Response) => {
  if (isProd()) {
    return res.status(404).json({ error: 'Not found' });
  }

  const secret = req.headers['x-test-secret'];
  if (secret !== expectedSecret()) {
    return res.status(401).json({ error: 'Invalid test secret' });
  }

  const { email } = (req.body ?? {}) as { email?: string };
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email is required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Idempotent — missing user is not an error.
    return res.json({ ok: true, deleted: 0 });
  }

  // Tidy up dependents that don't cascade from User. Books and Orders both
  // reference User without onDelete: Cascade, so we have to handle them
  // explicitly. Books that have OrderItems pointing to them can't be deleted
  // without orphaning history — in that case we null `created_by` instead.
  const books = await prisma.book.findMany({
    where: { created_by: user.id },
    select: { id: true },
  });

  for (const book of books) {
    const orderItemCount = await prisma.orderItem.count({ where: { book_id: book.id } });
    if (orderItemCount > 0) {
      // Preserve historical order references; just detach ownership.
      await prisma.book.update({ where: { id: book.id }, data: { created_by: null } });
    } else {
      // Cascades through pages, versions, illustration versions, cart items.
      await prisma.book.delete({ where: { id: book.id } });
    }
  }

  // Orders cascade their OrderItems but not the User FK.
  await prisma.order.deleteMany({ where: { user_id: user.id } });

  await prisma.user.delete({ where: { id: user.id } });

  res.json({ ok: true, deleted: 1 });
});

export default router;
