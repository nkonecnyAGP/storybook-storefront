import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../db/prisma';
import { getAuthUser } from './auth';
import { generateIllustration, listIllustrationVersions } from '../services/illustrations';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { theme, age_range, featured, search } = req.query;

  const where: Record<string, unknown> = { status: 'published' };
  if (theme) where.theme = theme;
  if (age_range) where.age_range = age_range;
  if (featured === 'true') where.is_featured = true;
  if (search && typeof search === 'string' && search.trim()) {
    where.OR = [
      { title: { contains: search.trim() } },
      { description: { contains: search.trim() } },
      { author: { contains: search.trim() } },
    ];
  }

  const books = await prisma.book.findMany({
    where,
    orderBy: { is_featured: 'desc' },
  });

  res.json(books);
});

router.get('/mine', async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const books = await prisma.book.findMany({
    where: { created_by: user.id },
  });
  res.json(books);
});

router.get('/themes', async (_req: Request, res: Response) => {
  const books = await prisma.book.findMany({ select: { theme: true } });
  const themes = [...new Set(books.map(b => b.theme))].sort();
  res.json(themes);
});

router.get('/age-ranges', async (_req: Request, res: Response) => {
  const books = await prisma.book.findMany({ select: { age_range: true } });
  const ranges = [...new Set(books.map(b => b.age_range))].sort();
  res.json(ranges);
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const book = await prisma.book.findUnique({
    where: { id: req.params.id },
    include: {
      pages: { orderBy: { page_number: 'asc' } },
    },
  });

  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  if (book.status === 'draft') {
    const user = await getAuthUser(req);
    if (!user || user.id !== book.created_by) {
      return res.status(404).json({ error: 'Book not found' });
    }
  }

  res.json(book);
});

router.put('/:id/publish', async (req: Request<{ id: string }>, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book || book.created_by !== user.id) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const updated = await prisma.book.update({
    where: { id: req.params.id },
    data: { status: 'published' },
  });

  res.json(updated);
});

router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book || book.created_by !== user.id) {
    return res.status(404).json({ error: 'Book not found' });
  }

  await prisma.book.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.post('/:id/revise', async (req: Request<{ id: string }>, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { feedback } = req.body as { feedback?: string };
  if (!feedback?.trim()) {
    return res.status(400).json({ error: 'feedback is required' });
  }

  const book = await prisma.book.findUnique({
    where: { id: req.params.id },
    include: { pages: { orderBy: { page_number: 'asc' } } },
  });

  if (!book || book.created_by !== user.id) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const currentPages = book.pages.map(p => ({
      page_number: p.page_number,
      text: p.text,
      illustrationDescription: p.illustration_description,
    }));

    const client = new Anthropic({ apiKey });

    const prompt = `You are revising a children's story based on reader feedback. Here is the current story:

Title: ${book.title}
Theme: ${book.theme}
Age range: ${book.age_range}
Description: ${book.description}

Current pages:
${currentPages.map(p => `Page ${p.page_number}: ${p.text}\n  Illustration: ${p.illustrationDescription}`).join('\n\n')}

Reader feedback: ${feedback}

Revise the story incorporating the feedback. Keep the same number of pages (${book.pages.length}). You may also update the description if the story changed significantly.

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "description": "Updated 1-2 sentence book description",
  "pages": [
    {
      "text": "The revised story text for this page",
      "illustrationDescription": "A detailed description of the illustration"
    }
  ]
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const firstBlock = message.content[0];
    if (firstBlock.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    let revised: { description: string; pages: { text: string; illustrationDescription: string }[] };
    try {
      revised = JSON.parse(firstBlock.text);
    } catch {
      const jsonMatch = firstBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        revised = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse revision from AI response');
      }
    }

    await prisma.bookVersion.create({
      data: {
        book_id: book.id,
        version: book.version,
        pages_json: JSON.stringify(currentPages),
      },
    });

    const newVersion = book.version + 1;

    for (let i = 0; i < revised.pages.length; i++) {
      await prisma.page.update({
        where: { book_id_page_number: { book_id: book.id, page_number: i + 1 } },
        data: {
          text: revised.pages[i].text,
          illustration_description: revised.pages[i].illustrationDescription,
        },
      });
    }

    const updated = await prisma.book.update({
      where: { id: book.id },
      data: { version: newVersion, description: revised.description },
      include: { pages: { orderBy: { page_number: 'asc' } } },
    });

    res.json(updated);
  } catch (err: unknown) {
    console.error('Revision error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to revise story. ' + message });
  }
});

router.get('/:id/versions', async (req: Request<{ id: string }>, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book || book.created_by !== user.id) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const versions = await prisma.bookVersion.findMany({
    where: { book_id: req.params.id },
    orderBy: { version: 'desc' },
  });

  res.json(versions.map(v => ({
    ...v,
    pages: JSON.parse(v.pages_json),
  })));
});

router.post('/:id/illustrate', async (req: Request<{ id: string }>, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(501).json({ error: 'Image generation not configured (OPENAI_API_KEY missing)' });
  }

  const book = await prisma.book.findUnique({
    where: { id: req.params.id },
    include: { pages: { orderBy: { page_number: 'asc' } } },
  });

  if (!book || book.created_by !== user.id) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const { pageNumber, feedback } = req.body as { pageNumber?: number; feedback?: string };

  const pagesToIllustrate = pageNumber
    ? book.pages.filter(p => p.page_number === pageNumber)
    : book.pages.filter(p => !p.illustration_url);

  if (pagesToIllustrate.length === 0) {
    return res.status(400).json({ error: 'No pages to illustrate' });
  }

  try {
    for (const page of pagesToIllustrate) {
      const url = await generateIllustration(
        book.id,
        page.page_number,
        page.illustration_description,
        pageNumber ? feedback : undefined,
      );

      if (url) {
        await prisma.page.update({
          where: { id: page.id },
          data: { illustration_url: url },
        });
      }
    }

    const updated = await prisma.book.findUnique({
      where: { id: book.id },
      include: { pages: { orderBy: { page_number: 'asc' } } },
    });

    res.json(updated);
  } catch (err: unknown) {
    console.error('Illustration error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to generate illustrations. ' + message });
  }
});

router.get('/:id/illustrations/:pageNumber', async (req: Request<{ id: string; pageNumber: string }>, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book || book.created_by !== user.id) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const versions = await listIllustrationVersions(book.id, parseInt(req.params.pageNumber));
  res.json(versions);
});

router.put('/:id/illustrations/:pageNumber/revert', async (req: Request<{ id: string; pageNumber: string }>, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book || book.created_by !== user.id) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const { url } = req.body as { url?: string };
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  const pageNum = parseInt(req.params.pageNumber);
  await prisma.page.update({
    where: { book_id_page_number: { book_id: book.id, page_number: pageNum } },
    data: { illustration_url: url },
  });

  const updated = await prisma.book.findUnique({
    where: { id: book.id },
    include: { pages: { orderBy: { page_number: 'asc' } } },
  });

  res.json(updated);
});

export default router;
