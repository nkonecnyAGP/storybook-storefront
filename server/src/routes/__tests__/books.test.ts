import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, resetDatabase } from '../../__tests__/setup';
import prisma from '../../db/prisma';

// Stub the Anthropic SDK at module boundary so /revise tests can drive the
// handler past the API key check without making real network calls.
// The mocked client returns a canned JSON-shaped response that the revise
// handler parses as a 5-page story.
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: (...args: unknown[]) => mockCreate(...args) };
  }
  return { default: MockAnthropic };
});

function mockClaudeReviseResponse(pages: { text: string; illustrationDescription: string }[], description = 'Revised description') {
  mockCreate.mockResolvedValueOnce({
    content: [
      {
        type: 'text',
        text: JSON.stringify({ description, pages }),
      },
    ],
  });
}

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

  describe('PUT /api/books/:id/unpublish', () => {
    it('unpublishes a published book owned by the user', async () => {
      const token = await createUserAndGetToken(app);
      const user = await prisma.user.findFirst({ where: { email: 'author@example.com' } });

      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { status: 'published', created_by: user!.id },
      });

      const res = await request(app)
        .put('/api/books/luna-star-garden/unpublish')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('draft');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).put('/api/books/luna-star-garden/unpublish');
      expect(res.status).toBe(401);
    });

    it('returns 404 for another user\'s book', async () => {
      const token = await createUserAndGetToken(app);

      const res = await request(app)
        .put('/api/books/luna-star-garden/unpublish')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 403 if the book is not currently published', async () => {
      const token = await createUserAndGetToken(app);
      const user = await prisma.user.findFirst({ where: { email: 'author@example.com' } });

      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { status: 'draft', created_by: user!.id },
      });

      const res = await request(app)
        .put('/api/books/luna-star-garden/unpublish')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
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

  describe('POST /api/books/:id/revise', () => {
    beforeEach(() => {
      mockCreate.mockReset();
      process.env.ANTHROPIC_API_KEY = 'sk-test';
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/books/luna-star-garden/revise')
        .send({ feedback: 'make it more fun' });
      expect(res.status).toBe(401);
    });

    it('returns 404 if the book belongs to another user', async () => {
      const token = await createUserAndGetToken(app);

      const res = await request(app)
        .post('/api/books/luna-star-garden/revise')
        .set('Authorization', `Bearer ${token}`)
        .send({ feedback: 'make it more fun' });
      expect(res.status).toBe(404);
    });

    it('returns 400 if feedback is missing or empty', async () => {
      const token = await createUserAndGetToken(app);

      const missing = await request(app)
        .post('/api/books/luna-star-garden/revise')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(missing.status).toBe(400);

      const empty = await request(app)
        .post('/api/books/luna-star-garden/revise')
        .set('Authorization', `Bearer ${token}`)
        .send({ feedback: '   ' });
      expect(empty.status).toBe(400);
    });

    it('clears illustration_url on a page whose text changes', async () => {
      const token = await createUserAndGetToken(app);
      const user = await prisma.user.findFirst({ where: { email: 'author@example.com' } });

      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { status: 'draft', created_by: user!.id },
      });
      // Give page 1 an illustration_url that should be wiped by the revision.
      await prisma.page.update({
        where: { book_id_page_number: { book_id: 'luna-star-garden', page_number: 1 } },
        data: { illustration_url: 'https://example.com/old.png' },
      });

      // Claude returns a 5-page response where page 1 text changes,
      // pages 2-5 keep their original text + illustration_description.
      mockClaudeReviseResponse([
        { text: 'NEW page 1 text', illustrationDescription: 'NEW illust 1' },
        { text: 'Page 2 text', illustrationDescription: 'Illustration 2' },
        { text: 'Page 3 text', illustrationDescription: 'Illustration 3' },
        { text: 'Page 4 text', illustrationDescription: 'Illustration 4' },
        { text: 'Page 5 text', illustrationDescription: 'Illustration 5' },
      ]);

      const res = await request(app)
        .post('/api/books/luna-star-garden/revise')
        .set('Authorization', `Bearer ${token}`)
        .send({ feedback: 'rewrite page 1' });
      expect(res.status).toBe(200);

      const page1 = res.body.pages.find((p: { page_number: number }) => p.page_number === 1);
      expect(page1).toBeDefined();
      expect(page1.text).toBe('NEW page 1 text');
      expect(page1.illustration_url).toBeNull();
    });
  });

  describe('GET /api/books/:id/illustrations/:pageNumber', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/books/luna-star-garden/illustrations/1');
      expect(res.status).toBe(401);
    });

    it('returns 404 for another user\'s book', async () => {
      const token = await createUserAndGetToken(app);
      const res = await request(app)
        .get('/api/books/luna-star-garden/illustrations/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns an empty array for a page with no illustrations and no files', async () => {
      const token = await createUserAndGetToken(app);
      const user = await prisma.user.findFirst({ where: { email: 'author@example.com' } });
      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { created_by: user!.id },
      });

      const res = await request(app)
        .get('/api/books/luna-star-garden/illustrations/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns the enriched shape from IllustrationVersion rows', async () => {
      const token = await createUserAndGetToken(app);
      const user = await prisma.user.findFirst({ where: { email: 'author@example.com' } });
      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { created_by: user!.id },
      });

      await prisma.illustrationVersion.createMany({
        data: [
          {
            book_id: 'luna-star-garden',
            page_number: 1,
            version: 1,
            url: '/illustrations/luna-star-garden/page-1.png',
            feedback: null,
          },
          {
            book_id: 'luna-star-garden',
            page_number: 1,
            version: 2,
            url: '/illustrations/luna-star-garden/page-1-v2.png',
            feedback: 'make the moon bigger',
          },
        ],
      });

      const res = await request(app)
        .get('/api/books/luna-star-garden/illustrations/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      for (const item of res.body) {
        expect(item).toHaveProperty('url');
        expect(item).toHaveProperty('version');
        expect(item).toHaveProperty('created_at');
        expect(item).toHaveProperty('feedback');
      }
      // versions sorted ascending
      expect(res.body[0].version).toBe(1);
      expect(res.body[0].feedback).toBeNull();
      expect(res.body[1].version).toBe(2);
      expect(res.body[1].feedback).toBe('make the moon bigger');
    });
  });

  describe('DELETE /api/books/:id', () => {
    it('soft-deletes a book owned by the user (row remains, deleted_at set)', async () => {
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

      // Row should still exist in the DB with deleted_at populated — that's
      // the whole soft-delete contract.
      const row = await prisma.book.findUnique({ where: { id: 'luna-star-garden' } });
      expect(row).not.toBeNull();
      expect(row?.deleted_at).not.toBeNull();

      // ...but the public GET should 404 because of the deleted_at filter.
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

  describe('soft-delete filtering on read endpoints', () => {
    it('GET /api/books/:id returns 404 for soft-deleted books', async () => {
      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { deleted_at: new Date() },
      });

      const res = await request(app).get('/api/books/luna-star-garden');
      expect(res.status).toBe(404);
    });

    it('GET /api/books (catalog) excludes soft-deleted books', async () => {
      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { deleted_at: new Date() },
      });

      const res = await request(app).get('/api/books');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(5);
      expect(res.body.find((b: { id: string }) => b.id === 'luna-star-garden')).toBeUndefined();
    });

    it('GET /api/books/mine excludes soft-deleted books', async () => {
      const token = await createUserAndGetToken(app);
      const user = await prisma.user.findFirst({ where: { email: 'author@example.com' } });

      await prisma.book.update({
        where: { id: 'luna-star-garden' },
        data: { created_by: user!.id },
      });
      await prisma.book.update({
        where: { id: 'dinosaur-bakery' },
        data: { created_by: user!.id, deleted_at: new Date() },
      });

      const res = await request(app)
        .get('/api/books/mine')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('luna-star-garden');
    });
  });
});
