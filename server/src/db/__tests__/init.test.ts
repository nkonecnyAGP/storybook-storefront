import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb, getStore, save, resetStore } from '../init';

// Mock the filesystem so tests never touch a real data.json file
vi.mock('fs', () => ({
  readFileSync: vi.fn(() => '{"books":[],"pages":[],"cartItems":[],"orders":[],"orderItems":[]}'),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
}));

describe('db/init', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initDb()', () => {
    it('seeds 6 books when store is empty', () => {
      initDb();
      const store = getStore();
      expect(store.books).toHaveLength(6);
    });

    it('seeds pages for every book', () => {
      initDb();
      const store = getStore();

      for (const book of store.books) {
        const bookPages = store.pages.filter((p) => p.book_id === book.id);
        expect(bookPages.length).toBeGreaterThan(0);
      }
    });

    it('each book has 5 pages', () => {
      initDb();
      const store = getStore();

      for (const book of store.books) {
        const bookPages = store.pages.filter((p) => p.book_id === book.id);
        expect(bookPages).toHaveLength(5);
      }
    });

    it('pages have sequential page_number starting at 1', () => {
      initDb();
      const store = getStore();

      for (const book of store.books) {
        const bookPages = store.pages
          .filter((p) => p.book_id === book.id)
          .sort((a, b) => a.page_number - b.page_number);
        const pageNumbers = bookPages.map((p) => p.page_number);
        expect(pageNumbers).toEqual([1, 2, 3, 4, 5]);
      }
    });

    it('does not re-seed if books already exist', () => {
      initDb();
      const store = getStore();
      const firstBookTitle = store.books[0].title;

      // Call initDb again — should not duplicate
      initDb();
      expect(store.books).toHaveLength(6);
      expect(store.books[0].title).toBe(firstBookTitle);
    });
  });

  describe('getStore()', () => {
    it('returns the store object', () => {
      const store = getStore();
      expect(store).toBeDefined();
      expect(store).toHaveProperty('books');
      expect(store).toHaveProperty('pages');
      expect(store).toHaveProperty('cartItems');
      expect(store).toHaveProperty('orders');
      expect(store).toHaveProperty('orderItems');
    });

    it('returns empty arrays after reset', () => {
      const store = getStore();
      expect(store.books).toHaveLength(0);
      expect(store.pages).toHaveLength(0);
      expect(store.cartItems).toHaveLength(0);
      expect(store.orders).toHaveLength(0);
      expect(store.orderItems).toHaveLength(0);
    });
  });

  describe('save() / load cycle', () => {
    it('save() calls writeFileSync (persists data)', async () => {
      const fs = await import('fs');
      initDb();
      save();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('resetStore()', () => {
    it('clears all data from the store', () => {
      initDb();
      const store = getStore();
      expect(store.books.length).toBeGreaterThan(0);

      resetStore();
      const resetStoreResult = getStore();
      expect(resetStoreResult.books).toHaveLength(0);
      expect(resetStoreResult.pages).toHaveLength(0);
      expect(resetStoreResult.cartItems).toHaveLength(0);
      expect(resetStoreResult.orders).toHaveLength(0);
      expect(resetStoreResult.orderItems).toHaveLength(0);
    });
  });
});
