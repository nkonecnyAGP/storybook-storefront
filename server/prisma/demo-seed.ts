/**
 * Demo account + sample books seed.
 *
 * Creates a persistent demo user and rebuilds three sample books from the
 * orphaned illustration directories in server/public/illustrations/. Uses
 * Claude vision to write per-page text that matches what's actually drawn,
 * so the books feel cohesive instead of "AI text glued to random images".
 *
 * Idempotent: re-running skips the user and books that already exist.
 *
 * Run with: npm run db:seed-demo
 */
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { createHash, randomBytes } from 'crypto';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '../../.env'), override: true });

const DEMO_EMAIL = 'demo@storybook.local';
const DEMO_NAME = 'Demo Storyteller';
const DEMO_PASSWORD = 'demo!2026';

const ILLUSTRATIONS_DIR = join(__dirname, '../public/illustrations');

// Demo books were previously rebuilt from orphaned illustration directories
// via Claude vision. The owner judged the results low-quality and is going to
// replace them with examples generated through the in-app story generator.
// Until that happens, the seed creates the demo user only — no books.
// See docs/backlog.md "Replace demo-seed examples" for the follow-up.
interface DemoBookStub {
  id: string;
  pages: number;
  hasCover: boolean;
  hint: string;
}

const DEMO_BOOKS: DemoBookStub[] = [];

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

function imageToBase64(path: string): { data: string; mediaType: 'image/png' } {
  return {
    data: readFileSync(path).toString('base64'),
    mediaType: 'image/png',
  };
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number }).status;
      const retryable = status === 429 || status === 503 || status === 529 || status === 500;
      if (!retryable || i === attempts - 1) throw err;
      const wait = 1000 * Math.pow(2, i); // 1s, 2s, 4s, 8s, 16s
      console.warn(`  ${label} hit ${status}, retrying in ${wait / 1000}s (attempt ${i + 2}/${attempts})...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

interface PageContent {
  text: string;
  illustrationDescription: string;
}

interface BookMetadata {
  title: string;
  description: string;
  theme: string;
  age_range: string;
  cover_emoji: string;
  cover_color: string;
  characters: { role: 'primary' | 'antagonist' | 'supporting'; name: string; descriptor?: string; relationship?: string }[];
}

const COVER_COLOR_OPTIONS = ['#7c3aed', '#0891b2', '#dc2626', '#16a34a', '#f59e0b', '#ec4899', '#6366f1', '#0d9488'];

async function visionDescribeBook(client: Anthropic, stub: DemoBookStub): Promise<{ metadata: BookMetadata; pages: PageContent[] }> {
  const bookDir = join(ILLUSTRATIONS_DIR, stub.id);

  const pageImagePaths: string[] = [];
  for (let i = 1; i <= stub.pages; i++) {
    const path = join(bookDir, `page-${i}.png`);
    if (existsSync(path)) pageImagePaths.push(path);
  }

  // Per-page narration: describe what's happening in each illustration as
  // 2-3 sentences of story text + a short illustration description.
  const pages: PageContent[] = [];
  for (let i = 0; i < pageImagePaths.length; i++) {
    const img = imageToBase64(pageImagePaths[i]);
    const msg = await withRetry(`page ${i + 1}`, () => client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } },
            {
              type: 'text',
              text: `${stub.hint}\n\nThis is page ${i + 1} of ${pageImagePaths.length}.\n\nWrite 2-4 sentences of warm, age-appropriate children's book text that matches what is happening in this illustration. Then write a 1-sentence illustration description (so the AI image system could re-generate something similar later).\n\nRespond with ONLY valid JSON (no markdown, no code fences):\n{\n  "text": "the page text",\n  "illustrationDescription": "the illustration description"\n}`,
            },
          ],
        },
      ],
    }));

    const block = msg.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
    const parsed = parseJson(block.text) as PageContent;
    pages.push(parsed);
    console.log(`  page ${i + 1}: "${parsed.text.slice(0, 60)}..."`);
  }

  // Cover / metadata pass: send the cover image (if present) plus the first
  // page image, plus all the per-page narration we just wrote, and ask Claude
  // to produce a title / description / theme / cast.
  const metadataContent: Anthropic.Messages.ContentBlockParam[] = [];
  const coverPath = join(bookDir, 'cover.png');
  if (stub.hasCover && existsSync(coverPath)) {
    const cover = imageToBase64(coverPath);
    metadataContent.push({ type: 'image', source: { type: 'base64', media_type: cover.mediaType, data: cover.data } });
  } else {
    // Fall back to page 1 so Claude still has something to look at.
    const fallback = imageToBase64(pageImagePaths[0]);
    metadataContent.push({ type: 'image', source: { type: 'base64', media_type: fallback.mediaType, data: fallback.data } });
  }

  metadataContent.push({
    type: 'text',
    text: `${stub.hint}\n\nHere is the page-by-page story text you just wrote:\n${pages.map((p, idx) => `Page ${idx + 1}: ${p.text}`).join('\n\n')}\n\nNow write the book metadata.\n\nRespond with ONLY valid JSON (no markdown, no code fences):\n{\n  "title": "Story title",\n  "description": "1-2 sentence catalog description",\n  "theme": "single lowercase word like adventure, fantasy, friendship, humor, nature, imagination, animals, space, or a custom 2-3 word theme",\n  "age_range": "one of: 2-4, 3-6, 4-7, 5-9, 6-10",\n  "cover_emoji": "a single emoji that represents the story",\n  "cover_color": "one of: ${COVER_COLOR_OPTIONS.join(', ')}",\n  "characters": [\n    { "role": "primary" | "antagonist" | "supporting", "name": "Name", "descriptor": "short description", "relationship": "optional, only for supporting (e.g. best friend, sibling, pet)" }\n  ]\n}\n\nInclude every named character that appears in the page text. At least one must be role=primary.`,
  });

  let metadata: BookMetadata;
  try {
    const metadataMsg = await withRetry('metadata', () => client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: metadataContent }],
    }));
    const metadataBlock = metadataMsg.content[0];
    if (metadataBlock.type !== 'text') throw new Error('Unexpected metadata response type');
    metadata = parseJson(metadataBlock.text) as BookMetadata;
  } catch (err) {
    console.warn(`  metadata call failed (${(err as Error).message.slice(0, 80)}), using fallback. You can revise in-app later.`);
    metadata = {
      title: `Sample Story #${stub.id.slice(0, 4)}`,
      description: 'A whimsical children\'s tale. Metadata auto-generated as a fallback — revise in-app to set the real title and details.',
      theme: 'imagination',
      age_range: '4-7',
      cover_emoji: '\u{1F4D6}',
      cover_color: COVER_COLOR_OPTIONS[Math.floor(Math.random() * COVER_COLOR_OPTIONS.length)],
      characters: [{ role: 'primary', name: 'Hero', descriptor: 'the main character of the story' }],
    };
  }

  // Defensive normalization
  if (!COVER_COLOR_OPTIONS.includes(metadata.cover_color)) {
    metadata.cover_color = COVER_COLOR_OPTIONS[0];
  }
  if (!metadata.characters || metadata.characters.length === 0) {
    metadata.characters = [{ role: 'primary', name: 'Main Character' }];
  }

  console.log(`  metadata: "${metadata.title}" (${metadata.theme}, ages ${metadata.age_range})`);
  return { metadata, pages };
}

function parseJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`Failed to parse JSON from: ${raw.slice(0, 200)}`);
    return JSON.parse(m[0]) as T;
  }
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is required for demo seed (vision calls). Aborting.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Demo user — upsert so reruns also promote the row to admin if it predates
  // OPS.2. The demo account is the canonical admin in this demo project.
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { role: 'admin' },
    create: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      password_hash: hashPassword(DEMO_PASSWORD),
      role: 'admin',
    },
  });
  console.log(`[seed] demo user ${DEMO_EMAIL} (id ${user.id}, role ${user.role}). Password: ${DEMO_PASSWORD}`);

  for (const stub of DEMO_BOOKS) {
    const existing = await prisma.book.findUnique({ where: { id: stub.id } });
    if (existing) {
      console.log(`[seed] book ${stub.id} already exists ("${existing.title}"), skipping.`);
      continue;
    }

    const bookDir = join(ILLUSTRATIONS_DIR, stub.id);
    if (!existsSync(bookDir)) {
      console.warn(`[seed] illustration dir missing for ${stub.id}, skipping.`);
      continue;
    }

    console.log(`[seed] generating story text for ${stub.id} via vision...`);
    let metadata: BookMetadata;
    let pages: PageContent[];
    try {
      const result = await visionDescribeBook(client, stub);
      metadata = result.metadata;
      pages = result.pages;
    } catch (err) {
      console.error(`[seed] FAILED to build ${stub.id}:`, (err as Error).message);
      console.error('[seed] continuing with next book; rerun later to retry this one.');
      continue;
    }

    const coverUrl = stub.hasCover && existsSync(join(bookDir, 'cover.png'))
      ? `/illustrations/${stub.id}/cover.png`
      : null;

    await prisma.book.create({
      data: {
        id: stub.id,
        title: metadata.title,
        author: DEMO_NAME,
        description: metadata.description,
        theme: metadata.theme,
        age_range: metadata.age_range,
        cover_emoji: metadata.cover_emoji,
        cover_color: metadata.cover_color,
        cover_url: coverUrl,
        price: 24.99,
        is_featured: false,
        is_user_created: true,
        status: 'draft',
        version: 1,
        characters_json: JSON.stringify(metadata.characters),
        created_by: user.id,
        pages: {
          create: pages.map((p, i) => {
            const pagePath = join(bookDir, `page-${i + 1}.png`);
            return {
              page_number: i + 1,
              text: p.text,
              illustration_description: p.illustrationDescription,
              illustration_url: existsSync(pagePath) ? `/illustrations/${stub.id}/page-${i + 1}.png` : null,
            };
          }),
        },
        versions: {
          create: {
            version: 1,
            pages_json: JSON.stringify(pages),
          },
        },
      },
    });
    console.log(`[seed] inserted book "${metadata.title}" (${pages.length} pages, ${pages.filter((_, i) => existsSync(join(bookDir, `page-${i + 1}.png`))).length} illustrated)`);
  }

  await prisma.$disconnect();
  console.log('\n[seed] done. Log in at /login with:');
  console.log(`  email: ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
