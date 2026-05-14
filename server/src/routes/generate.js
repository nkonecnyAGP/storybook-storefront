import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { getStore, save } from '../db/init.js';

const router = Router();

router.post('/', async (req, res) => {
  const { theme, characterName, ageRange, additionalDetails } = req.body;

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

    const content = message.content[0].text;
    let story;
    try {
      story = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        story = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse story from AI response');
      }
    }

    const bookId = uuidv4();
    const store = getStore();

    store.books.push({
      id: bookId,
      title: story.title,
      author: 'AI Storybook',
      description: story.description,
      theme,
      age_range: ageRange,
      cover_emoji: story.coverEmoji,
      cover_color: story.coverColor,
      price: 24.99,
      is_featured: 0,
      is_user_created: 1,
      created_at: new Date().toISOString(),
    });

    const newPages = story.pages.map((page, i) => ({
      id: store.pages.length + i + 1,
      book_id: bookId,
      page_number: i + 1,
      text: page.text,
      illustration_description: page.illustrationDescription,
    }));

    store.pages.push(...newPages);
    save();

    res.json({
      id: bookId,
      title: story.title,
      description: story.description,
      theme,
      age_range: ageRange,
      cover_emoji: story.coverEmoji,
      cover_color: story.coverColor,
      price: 24.99,
      is_user_created: 1,
      pages: newPages,
    });
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: 'Failed to generate story. ' + err.message });
  }
});

export default router;
