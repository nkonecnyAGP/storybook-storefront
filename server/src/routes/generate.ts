import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../db/prisma';
import { getAuthUser } from './auth';
import type { Request, Response } from 'express';

interface GenerateRequestBody {
  theme: string;
  characterName: string;
  ageRange: string;
  additionalDetails?: string;
}

interface GeneratedStory {
  title: string;
  description: string;
  coverEmoji: string;
  coverColor: string;
  pages: {
    text: string;
    illustrationDescription: string;
  }[];
}

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { theme, characterName, ageRange, additionalDetails } = req.body as GenerateRequestBody;

  if (!theme || !characterName || !ageRange) {
    return res.status(400).json({ error: 'theme, characterName, and ageRange are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const client = new Anthropic({ apiKey });

    const prompt = `You are a beloved children's book author. Create a short children's story with exactly 5 pages.

Theme: ${theme}
Main character name: ${characterName}
Target age range: ${ageRange}
${additionalDetails ? `Additional details: ${additionalDetails}` : ''}

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "title": "The story title",
  "description": "A 1-2 sentence book description for the catalog",
  "coverEmoji": "A single emoji that represents this story",
  "coverColor": "A hex color that fits the story mood (choose from: #7c3aed, #0891b2, #dc2626, #16a34a, #f59e0b, #ec4899, #6366f1, #0d9488)",
  "pages": [
    {
      "text": "The story text for this page (2-4 sentences, age-appropriate language)",
      "illustrationDescription": "A detailed description of the illustration for this page"
    }
  ]
}

Make the story warm, engaging, and age-appropriate. Use vivid but simple language. Each page should advance the story and paint a picture. The story should have a satisfying, positive ending.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const firstBlock = message.content[0];
    if (firstBlock.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }
    const content: string = firstBlock.text;

    let story: GeneratedStory;
    try {
      story = JSON.parse(content) as GeneratedStory;
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        story = JSON.parse(jsonMatch[0]) as GeneratedStory;
      } else {
        throw new Error('Failed to parse story from AI response');
      }
    }

    const user = await getAuthUser(req);

    const book = await prisma.book.create({
      data: {
        title: story.title,
        author: user ? user.name : 'AI Storybook',
        description: story.description,
        theme,
        age_range: ageRange,
        cover_emoji: story.coverEmoji,
        cover_color: story.coverColor,
        price: 24.99,
        is_featured: false,
        is_user_created: true,
        created_by: user?.id ?? null,
        pages: {
          create: story.pages.map((page, i) => ({
            page_number: i + 1,
            text: page.text,
            illustration_description: page.illustrationDescription,
          })),
        },
      },
      include: { pages: { orderBy: { page_number: 'asc' } } },
    });

    res.json(book);
  } catch (err: unknown) {
    console.error('Generation error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to generate story. ' + message });
  }
});

export default router;
