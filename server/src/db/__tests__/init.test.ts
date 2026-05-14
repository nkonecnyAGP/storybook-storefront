import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../prisma';
import { resetDatabase } from '../../__tests__/setup';

describe('Database seed', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('seeds 6 books', async () => {
    const books = await prisma.book.findMany();
    expect(books).toHaveLength(6);
  });

  it('each book has required fields', async () => {
    const books = await prisma.book.findMany();
    for (const book of books) {
      expect(book.id).toBeTruthy();
      expect(book.title).toBeTruthy();
      expect(book.author).toBeTruthy();
      expect(book.theme).toBeTruthy();
      expect(book.price).toBeGreaterThan(0);
    }
  });

  it('seeds pages for luna-star-garden', async () => {
    const pages = await prisma.page.findMany({
      where: { book_id: 'luna-star-garden' },
      orderBy: { page_number: 'asc' },
    });
    expect(pages).toHaveLength(5);
    expect(pages.map(p => p.page_number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('3 books are featured', async () => {
    const featured = await prisma.book.findMany({ where: { is_featured: true } });
    expect(featured).toHaveLength(3);
  });

  it('resetDatabase clears all data then re-seeds', async () => {
    await prisma.book.deleteMany();
    const empty = await prisma.book.findMany();
    expect(empty).toHaveLength(0);

    await resetDatabase();
    const seeded = await prisma.book.findMany();
    expect(seeded).toHaveLength(6);
  });
});
