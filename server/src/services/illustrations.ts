import { writeFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';

const ILLUSTRATIONS_DIR = join(import.meta.dirname, '../../public/illustrations');

export async function generateIllustration(
  bookId: string,
  pageNumber: number,
  description: string,
  feedback?: string,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  let prompt = `Children's book illustration, ${description}. Whimsical, colorful, warm, suitable for young children. No text or words in the image.`;
  if (feedback) {
    prompt += ` Revision instructions: ${feedback}`;
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('DALL-E error:', err);
    return null;
  }

  const data = await res.json() as { data: { b64_json: string }[] };
  const imageData = data.data[0].b64_json;
  const buffer = Buffer.from(imageData, 'base64');

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
