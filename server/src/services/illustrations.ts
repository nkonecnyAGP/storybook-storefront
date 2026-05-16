import { writeFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import type { Character } from '../types';

const ILLUSTRATIONS_DIR = join(import.meta.dirname, '../../public/illustrations');
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

function formatCastPrefix(characters?: Character[]): string {
  if (!characters || characters.length === 0) return '';
  const cast = characters
    .map(c => `${c.name}${c.descriptor ? ` (${c.descriptor})` : ''}`)
    .join('; ');
  return `Cast (keep these characters visually consistent): ${cast}. `;
}

interface OpenAIImageItem {
  url?: string;
  b64_json?: string;
}

async function callOpenAIImage(apiKey: string, prompt: string): Promise<Buffer | null> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: '1024x1024',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`OpenAI image error (${IMAGE_MODEL}):`, err);
    return null;
  }

  const data = await res.json() as { data: OpenAIImageItem[] };
  const item = data.data[0];
  if (!item) {
    console.error('OpenAI image response had no data entries');
    return null;
  }

  if (item.b64_json) {
    return Buffer.from(item.b64_json, 'base64');
  }
  if (item.url) {
    const imageRes = await fetch(item.url);
    if (!imageRes.ok) {
      console.error('Failed to download generated image:', imageRes.status);
      return null;
    }
    return Buffer.from(await imageRes.arrayBuffer());
  }

  console.error('OpenAI image response had neither b64_json nor url');
  return null;
}

export async function generateIllustration(
  bookId: string,
  pageNumber: number,
  description: string,
  feedback?: string,
  styleDescriptor?: string | null,
  characters?: Character[],
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const style = styleDescriptor?.trim() || 'Whimsical, colorful, warm, suitable for young children';
  const castPrefix = formatCastPrefix(characters);
  let prompt = `${castPrefix}Children's book illustration, ${description}. ${style}. No text or words in the image.`;
  if (feedback) {
    prompt += ` Revision instructions: ${feedback}`;
  }

  const buffer = await callOpenAIImage(apiKey, prompt);
  if (!buffer) return null;

  const dir = join(ILLUSTRATIONS_DIR, bookId);
  await mkdir(dir, { recursive: true });

  const version = await getNextVersion(dir, pageNumber);
  const filename = version === 1
    ? `page-${pageNumber}.png`
    : `page-${pageNumber}-v${version}.png`;
  await writeFile(join(dir, filename), buffer);

  return `/illustrations/${bookId}/${filename}`;
}

async function getNextVersion(dir: string, pageNumber: number): Promise<number> {
  try {
    const files = await readdir(dir);
    const pattern = new RegExp(`^page-${pageNumber}(-v(\\d+))?\\.png$`);
    let max = 0;
    for (const f of files) {
      const m = f.match(pattern);
      if (m) max = Math.max(max, m[2] ? parseInt(m[2]) : 1);
    }
    return max + 1;
  } catch {
    return 1;
  }
}

export async function listIllustrationVersions(
  bookId: string,
  pageNumber: number,
): Promise<string[]> {
  const dir = join(ILLUSTRATIONS_DIR, bookId);
  try {
    const files = await readdir(dir);
    const pattern = new RegExp(`^page-${pageNumber}(-v\\d+)?\\.png$`);
    return files
      .filter(f => pattern.test(f))
      .sort()
      .map(f => `/illustrations/${bookId}/${f}`);
  } catch {
    return [];
  }
}

export async function generateCover(
  bookId: string,
  title: string,
  description: string,
  styleDescriptor?: string | null,
  characters?: Character[],
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const style = styleDescriptor?.trim() || 'Whimsical, colorful, warm, suitable for young children';
  const castPrefix = formatCastPrefix(characters);
  const prompt = `${castPrefix}Children's book cover illustration for a story titled "${title}". Scene: ${description}. ${style}. Composition suitable for a book cover (centered subject, room at top for title). No text or words in the image.`;

  const buffer = await callOpenAIImage(apiKey, prompt);
  if (!buffer) return null;

  const dir = join(ILLUSTRATIONS_DIR, bookId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'cover.png'), buffer);

  return `/illustrations/${bookId}/cover.png`;
}
