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
