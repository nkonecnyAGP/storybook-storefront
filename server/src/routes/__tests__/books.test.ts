import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, resetDatabase } from '../../__tests__/setup';
import prisma from '../../db/prisma';

async function createUserAndGetToken(app: Express) {
  const res = await request(app).post('/api/auth/register').send({
    email: 'author@example.com',
    name: 'Author',
    password: 'pass1234',
  });
  return res.body.token as string;
}

describe('Books API routes', () => {
  let app: Express;

  beforeEach(async () => {
    await resetDatabase();
    app = createTestApp();
  });

  describe('GET /api/books', () => {
    it('returns all 6 seeded books', async () => {
      const res = await request(app).get('/api/books');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(6);
    });

    it('excludes draft books from storefront listing', async () => {
      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { status: 'draft' },
      });

      const res = await request(app).get('/api/books');
      expect(res.body).toHaveLength(5);
      expect(res.body.find((b: { id: string }) => b.id === 'luna-star-garden')).toBeUndefined();
    });

    it('each book has required fields', async () => {
      const res = await request(app).get('/api/books');
      for (const book of res.body) {
        expect(book).toHaveProperty('id');
        expect(book).toHaveProperty('title');
        expect(book).toHaveProperty('author');
        expect(book).toHaveProperty('description');
        expect(book).toHaveProperty('theme');
        expect(book).toHaveProperty('price');
        expect(book).toHaveProperty('status');
      }
    });

    it('sorts featured books first', async () => {
      const res = await request(app).get('/api/books');
      const featured = res.body.filter((b: { is_featured: boolean }) => b.is_featured);
      const nonFeatured = res.body.filter((b: { is_featured: boolean }) => !b.is_featured);
      const lastFeaturedIdx = res.body.indexOf(featured[featured.length - 1]);
      const firstNonFeaturedIdx = res.body.indexOf(nonFeatured[0]);
      expect(lastFeaturedIdx).toBeLessThan(firstNonFeaturedIdx);
    });
  });

  describe('GET /api/books?theme=fantasy', () => {
    it('filters books by theme', async () => {
      const res = await request(app).get('/api/books?theme=fantasy');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      for (const book of res.body) {
        expect(book.theme).toBe('fantasy');
      }
    });

    it('returns empty array for unknown theme', async () => {
      const res = await request(app).get('/api/books?theme=nonexistent');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /api/books/themes', () => {
    it('returns unique themes sorted alphabetically', async () => {
      const res = await request(app).get('/api/books/themes');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(6);
      const sorted = [...res.body].sort();
      expect(res.body).toEqual(sorted);
    });
  });

  describe('GET /api/books/:id', () => {
    it('returns a book with its pages', async () => {
      const res = await request(app).get('/api/books/luna-star-garden');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('luna-star-garden');
      expect(res.body.title).toBe('Luna and the Star Garden');
      expect(res.body.pages).toHaveLength(5);
    });

    it('pages are sorted by page_number', async () => {
      const res = await request(app).get('/api/books/luna-star-garden');
      const pageNumbers = res.body.pages.map((p: { page_number: number }) => p.page_number);
      expect(pageNumbers).toEqual([1, 2, 3, 4, 5]);
    });

    it('returns 404 for nonexistent book', async () => {
      const res = await request(app).get('/api/books/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Book not found');
    });

    it('hides draft books from unauthenticated users', async () => {
      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { status: 'draft' },
      });

      const res = await request(app).get('/api/books/luna-star-garden');
      expect(res.status).toBe(404);
    });

    it('shows draft book to its creator', async () => {
      const token = await createUserAndGetToken(app);
      const user = await prisma.user.findFirst({ where: { email: 'author@example.com' } });

      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { status: 'draft', created_by: user!.id },
      });

      const res = await request(app)
        .get('/api/books/luna-star-garden')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('luna-star-garden');
    });
  });

  describe('PUT /api/books/:id/publish', () => {
    it('publishes a draft book', async () => {
      const token = await createUserAndGetToken(app);
      const user = await prisma.user.findFirst({ where: { email: 'author@example.com' } });

      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { status: 'draft', created_by: user!.id },
      });

      const res = await request(app)
        .put('/api/books/luna-star-garden/publish')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('published');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).put('/api/books/luna-star-garden/publish');
      expect(res.status).toBe(401);
    });

    it('returns 404 for another user\'s book', async () => {
      const token = await createUserAndGetToken(app);

      const res = await request(app)
        .put('/api/books/luna-star-garden/publish')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/books/:id/versions/:version/restore', () => {
    async function setupDraftWithSnapshot(token: string) {
      const user = await prisma.user.findFirst({ where: { email: 'author@example.com' } });
      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: {
          status: 'draft',
          created_by: user!.id,
          version: 2,
          description: 'Current description',
          characters_json: JSON.stringify([{ role: 'primary', name: 'Luna' }]),
        },
      });

      // Give the current draft pages an illustration_url so we can assert
      // the restore wipes them.
      await prisma.page.updateMany({
        where: { book_id: 'luna-star-garden' },
        data: { illustration_url: 'https://example.com/current.png' },
      });

      // Insert a v1 snapshot with different content + page count.
      const snapshotPages = [
        { page_number: 1, text: 'Old page 1', illustrationDescription: 'Old illust 1' },
        { page_number: 2, text: 'Old page 2', illustrationDescription: 'Old illust 2' },
        { page_number: 3, text: 'Old page 3', illustrationDescription: 'Old illust 3' },
      ];
      await prisma.bookVersion.create({
        data: {
          book_id: 'luna-star-garden',
          version: 1,
          pages_json: JSON.stringify(snapshotPages),
          description: 'Original description',
          characters_json: JSON.stringify([{ role: 'primary', name: 'OldLuna' }]),
        },
      });

      return { user: user!, token, snapshotPages };
    }

    it('returns 401 without auth', async () => {
      const res = await request(app).put('/api/books/luna-star-garden/versions/1/restore');
      expect(res.status).toBe(401);
    });

    it('returns 404 if book does not exist', async () => {
      const token = await createUserAndGetToken(app);
      const res = await request(app)
        .put('/api/books/nope/versions/1/restore')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 404 for another user\'s book', async () => {
      const ownerToken = await createUserAndGetToken(app);
      await setupDraftWithSnapshot(ownerToken);

      // Register a second user and try to restore using their token.
      const otherRes = await request(app).post('/api/auth/register').send({
        email: 'intruder@example.com',
        name: 'Intruder',
        password: 'pass1234',
      });
      const otherToken = otherRes.body.token as string;

      const res = await request(app)
        .put('/api/books/luna-star-garden/versions/1/restore')
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });

    it('returns 403 if book is not in draft status', async () => {
      const token = await createUserAndGetToken(app);
      const user = await prisma.user.findFirst({ where: { email: 'author@example.com' } });
      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { status: 'published', created_by: user!.id, version: 2 },
      });
      await prisma.bookVersion.create({
        data: {
          book_id: 'luna-star-garden',
          version: 1,
          pages_json: JSON.stringify([]),
        },
      });

      const res = await request(app)
        .put('/api/books/luna-star-garden/versions/1/restore')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('returns 404 if the version row does not exist', async () => {
      const token = await createUserAndGetToken(app);
      const user = await prisma.user.findFirst({ where: { email: 'author@example.com' } });
      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { status: 'draft', created_by: user!.id, version: 2 },
      });

      const res = await request(app)
        .put('/api/books/luna-star-garden/versions/99/restore')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('restores pages and description, bumps version, snapshots prior state', async () => {
      const token = await createUserAndGetToken(app);
      const { snapshotPages } = await setupDraftWithSnapshot(token);

      const res = await request(app)
        .put('/api/books/luna-star-garden/versions/1/restore')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);

      expect(res.body.description).toBe('Original description');
      expect(res.body.version).toBe(3);
      expect(res.body.characters).toEqual([{ role: 'primary', name: 'OldLuna' }]);
      expect(res.body.pages).toHaveLength(snapshotPages.length);
      expect(res.body.pages.map((p: { text: string }) => p.text)).toEqual(
        snapshotPages.map(p => p.text),
      );

      // A fresh BookVersion snapshotting the pre-restore state should exist.
      const versions = await prisma.bookVersion.findMany({
        where: { book_id: 'luna-star-garden' },
        orderBy: { version: 'asc' },
      });
      expect(versions).toHaveLength(2);
      const preRestoreSnapshot = versions.find(v => v.version === 2);
      expect(preRestoreSnapshot).toBeDefined();
      expect(preRestoreSnapshot!.description).toBe('Current description');
      const preRestorePages = JSON.parse(preRestoreSnapshot!.pages_json) as {
        text: string;
      }[];
      expect(preRestorePages).toHaveLength(5);
      expect(preRestorePages[0].text).toBe('Page 1 text');
    });

    it('clears illustration_url on every restored page', async () => {
      const token = await createUserAndGetToken(app);
      await setupDraftWithSnapshot(token);

      const res = await request(app)
        .put('/api/books/luna-star-garden/versions/1/restore')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);

      for (const page of res.body.pages) {
        expect(page.illustration_url).toBeNull();
      }
    });
  });

  describe('DELETE /api/books/:id', () => {
    it('deletes a book owned by the user', async () => {
      const token = await createUserAndGetToken(app);
      const user = await prisma.user.findFirst({ where: { email: 'author@example.com' } });

      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { created_by: user!.id },
      });

      const res = await request(app)
        .delete('/api/books/luna-star-garden')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await request(app).get('/api/books/luna-star-garden');
      expect(check.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).delete('/api/books/luna-star-garden');
      expect(res.status).toBe(401);
    });

    it('returns 404 for another user\'s book', async () => {
      const token = await createUserAndGetToken(app);

      const res = await request(app)
        .delete('/api/books/luna-star-garden')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
