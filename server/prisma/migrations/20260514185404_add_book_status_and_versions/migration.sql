-- CreateTable
CREATE TABLE "BookVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "book_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "pages_json" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookVersion_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "age_range" TEXT NOT NULL,
    "cover_emoji" TEXT NOT NULL,
    "cover_color" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_user_created" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'published',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Book_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Book" ("age_range", "author", "cover_color", "cover_emoji", "created_at", "created_by", "description", "id", "is_featured", "is_user_created", "price", "theme", "title") SELECT "age_range", "author", "cover_color", "cover_emoji", "created_at", "created_by", "description", "id", "is_featured", "is_user_created", "price", "theme", "title" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BookVersion_book_id_version_key" ON "BookVersion"("book_id", "version");
