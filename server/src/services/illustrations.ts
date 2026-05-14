import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const ILLUSTRATIONS_DIR = join(import.meta.dirname, '../../public/illustrations');

export async function generateIllustration(
  bookId: string,
  pageNumber: number,
  description: string,
  style: string = 'children\'s book illustration'
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `${style}, ${description}. Whimsical, colorful, warm, suitable for young children. No text or words in the image.`;

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

  await mkdir(join(ILLUSTRATIONS_DIR, bookId), { recursive: true });
  const filename = `page-${pageNumber}.png`;
  const filepath = join(ILLUSTRATIONS_DIR, bookId, filename);
  await writeFile(filepath, buffer);

  return `/illustrations/${bookId}/${filename}`;
}
