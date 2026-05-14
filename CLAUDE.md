# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StoryBook Storefront — an AI-powered children's book store built with React + Express + Claude API. Users browse, create personalized stories, and purchase books. JSON file persistence (`data.json`), session-based cart via localStorage UUIDs.

## Monorepo Layout

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `client/` | React 19, Vite 8, Tailwind CSS 4, TypeScript | SPA frontend |
| `server/` | Express 4, TypeScript, tsx, Anthropic SDK | REST API + AI generation |
| `e2e/` | Playwright 1.52, TypeScript | End-to-end tests |

## Build & Run

```bash
npm run dev                          # Start both client (:5173) and server (:3001)
npm run dev:client                   # Client only
npm run dev:server                   # Server only
```

## Testing

```bash
# Server unit/integration (Vitest + Supertest)
cd server && npm test

# Client unit (Vitest + React Testing Library)
cd client && npm test

# E2E (Playwright — auto-starts both servers)
cd e2e && npm test
cd e2e && npm run test:headed        # With browser visible
cd e2e && npm run test:ui            # Interactive UI mode
```

## Key Conventions

- **TypeScript strict** on both client and server
- **Tailwind CSS v4** — uses `@import "tailwindcss"` and `@custom-variant dark` (not v3 `darkMode` config)
- **Dark mode** — `ThemeContext` toggles `.dark` class on `<html>`, all components use `dark:` variants
- **Cart sessions** — UUID stored in localStorage (`storybook-session`), passed to `/api/cart/:sessionId`
- **JSON store** — `server/src/db/init.ts` with `getStore()`/`save()` pattern, persists to `data.json`
- **Claude API** — model `claude-sonnet-4-6` in `server/src/routes/generate.ts`, generates 5-page stories
- **Corporate proxy** — `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` at top of `server/src/index.ts`

## API Structure

Routes in `server/src/routes/`: books.ts, cart.ts, orders.ts, generate.ts. Each exports an Express Router mounted at `/api/{name}`. Health check at `/api/health`.

## Data Model

Defined in `server/src/types.ts` and `client/src/types.ts`. Core entities: Book, Page (5 per book), CartItem, Order, OrderItem. Books have `is_user_created` flag (0 = seed, 1 = AI-generated).

## E2E Test Patterns

- Wait for visible content, never `waitForResponse` after navigation
- Use `getByRole()` and `getByText()` selectors — not CSS classes
- Cart tests clear localStorage in `beforeEach` for isolation
- Playwright config auto-starts both servers via `webServer[]`

## Agents

Three specialized agents in `.claude/agents/`:

- **@storefront** — Frontend: React components, routing, Tailwind styling, contexts, dark mode
- **@booksmith** — Backend: Express routes, data store, Claude API integration, story generation
- **@qa** — Testing: Vitest unit/integration tests, Playwright e2e specs, test infrastructure
