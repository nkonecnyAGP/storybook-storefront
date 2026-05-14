import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../../__tests__/setup';

// Mock fs so tests never read/write a real data.json file
vi.mock('fs', () => ({
  readFileSync: vi.fn(() => '{"books":[],"pages":[],"cartItems":[],"orders":[],"orderItems":[]}'),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
}));

describe('Books API routes', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /api/books', () => {
    it('returns all 6 seeded books', async () => {
      const res = await request(app).get('/api/books');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(6);
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
      }
    });

    it('sorts featured books first', async () => {
      const res = await request(app).get('/api/books');
      const featured = res.body.filter((b: { is_featured: number }) => b.is_featured);
      const nonFeatured = res.body.filter((b: { is_featured: number }) => !b.is_featured);
      // Featured books should appear before non-featured books
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

      // Should have 6 unique themes (fantasy, adventure, friendship, humor, imagination, nature)
      expect(res.body).toHaveLength(6);

      // Should be sorted
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
  });
});
