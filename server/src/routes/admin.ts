import { Router } from 'express';
import { readdir } from 'fs/promises';
import { join } from 'path';
import prisma from '../db/prisma';
import { getAuthUser, requireAdmin } from './auth';
import type { Request, Response } from 'express';
import type { Character } from '../types';

const router = Router();

const ILLUSTRATIONS_DIR = join(import.meta.dirname, '../../public/illustrations');

type BookRow = { characters_json?: string | null } & Record<string, unknown>;

function hydrateBook<T extends BookRow>(book: T): T & { characters: Character[] } {
  let characters: Character[] = [];
  if (book.characters_json) {
    try {
      const parsed = JSON.parse(book.characters_json) as unknown;
      if (Array.isArray(parsed)) characters = parsed as Character[];
    } catch {
      characters = [];
    }
  }
  return { ...book, characters };
}

interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  deleted_at: Date | null;
  created_at: Date;
}

function stripUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  deleted_at: Date | null;
  created_at: Date;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    deleted_at: user.deleted_at,
    created_at: user.created_at,
  };
}

/**
 * Centralized admin gate that distinguishes between 401 (no auth) and 403
 * (auth'd but not an admin). All routes in this file should pass through it.
 */
async function gateAdmin(req: Request, res: Response): Promise<boolean> {
  const authed = await getAuthUser(req);
  if (!authed) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  const admin = await requireAdmin(req);
  if (!admin) {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

router.get('/users', async (req: Request, res: Response) => {
  if (!(await gateAdmin(req, res))) return;

  // Include soft-deleted rows: the whole point of the admin view is to see
  // and restore them.
  const users = await prisma.user.findMany({
    orderBy: { created_at: 'desc' },
  });

  res.json(users.map(stripUser));
});

router.get('/books', async (req: Request, res: Response) => {
  if (!(await gateAdmin(req, res))) return;

  const books = await prisma.book.findMany({
    orderBy: { created_at: 'desc' },
    include: {
      creator: { select: { email: true, name: true } },
    },
  });

  res.json(books.map(hydrateBook));
});

router.put('/users/:id/restore', async (req: Request<{ id: string }>, res: Response) => {
  if (!(await gateAdmin(req, res))) return;

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const restored = await prisma.user.update({
    where: { id: req.params.id },
    data: { deleted_at: null },
  });

  res.json(stripUser(restored));
});

router.put('/books/:id/restore', async (req: Request<{ id: string }>, res: Response) => {
  if (!(await gateAdmin(req, res))) return;

  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const restored = await prisma.book.update({
    where: { id: req.params.id },
    data: { deleted_at: null },
    include: { pages: { orderBy: { page_number: 'asc' } } },
  });

  res.json(hydrateBook(restored));
});

router.put('/books/:id/featured', async (req: Request<{ id: string }>, res: Response) => {
  if (!(await gateAdmin(req, res))) return;

  const { is_featured } = req.body as { is_featured?: boolean };
  if (typeof is_featured !== 'boolean') {
    return res.status(400).json({ error: 'is_featured must be a boolean' });
  }

  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const updated = await prisma.book.update({
    where: { id: req.params.id },
    data: { is_featured },
    include: { pages: { orderBy: { page_number: 'asc' } } },
  });

  res.json(hydrateBook(updated));
});

interface OrphanRow {
  path: string;
  book_exists: boolean;
  soft_deleted: boolean;
}

router.get('/orphan-illustrations', async (req: Request, res: Response) => {
  if (!(await gateAdmin(req, res))) return;

  let entries: string[];
  try {
    entries = await readdir(ILLUSTRATIONS_DIR);
  } catch {
    // Directory missing is a non-error condition: nothing on disk means
    // nothing to reconcile.
    return res.json([]);
  }

  const orphans: OrphanRow[] = [];

  for (const entry of entries) {
    // Scanning at directory granularity — each book gets its own folder.
    // We don't `stat` here because readdir on Windows can be slow for a lot
    // of entries; a non-directory file would just match no book and be
    // reported as an orphan, which is also a reasonable outcome.
    const book = await prisma.book.findUnique({ where: { id: entry } });
    if (!book) {
      orphans.push({
        path: `/illustrations/${entry}`,
        book_exists: false,
        soft_deleted: false,
      });
    } else if (book.deleted_at !== null) {
      // The book row exists but is tombstoned — surface it so the admin can
      // decide whether to restore the book or clean up the directory.
      orphans.push({
        path: `/illustrations/${entry}`,
        book_exists: true,
        soft_deleted: true,
      });
    }
    // Else: directory matches a live book row — not an orphan, skip.
  }

  res.json(orphans);
});

export default router;
