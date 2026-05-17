# CLAUDE.md

Guidance for Claude Code sessions working in StoryBook Storefront.

## Project

AI-powered children's book store. React + Express + Claude API. Working storefront with creation workflow being built out. Demo-grade product concept.

**Current focus:** see [docs/backlog.md](docs/backlog.md). Tier 1 is the dependency chain: versioning → story iteration → illustration generation → illustration iteration.

## Layout

| Directory | Stack | Owner agent | Zone rules |
|-----------|-------|-------------|------------|
| `client/` | React 19, Vite 8, Tailwind 4, TS | @storefront | `.claude/agents/storefront.md` |
| `server/` | Express 4, TS, Anthropic SDK | @booksmith | `.claude/agents/booksmith.md` |
| `e2e/` | Playwright 1.52, TS | @qa | `.claude/agents/qa.md` |
| `docs/` | Backlog, research notes | — | — |

## Build & run

```bash
npm run dev                          # both client (:5173) and server (:3001)
npm run dev:client
npm run dev:server
```

## Testing

```bash
cd server && npm test                # Vitest + Supertest (33 tests)
cd client && npm test                # Vitest + RTL (19 tests)
cd e2e && npm test                   # Playwright (20 tests)
cd e2e && npm run test:headed
cd e2e && npm run test:ui
```

## Delegation rules (opinionated)

For any non-trivial change in a zone, **delegate to the owning agent** rather than editing directly:

- `client/**` → **@storefront**
- `server/**` → **@booksmith**
- Tests in any zone → **@qa**

The main session orchestrates: reads for context, plans, delegates, then verifies. Small cross-cutting reads, 1-line fixes, and pure orchestration stay in the main session.

**Zone-specific conventions, stack details, and patterns live in each agent's `.md` file** — not duplicated here.

## Done criteria

Don't claim a feature complete until:
1. Relevant tests pass (server + client + e2e if a user-facing flow changed)
2. UI changes manually verified in browser in **both** light and dark mode
3. No TypeScript errors
4. If `data.json` shape changed, confirm seed still loads cleanly

## Guardrails (cross-cutting)

**Confirm with user before:**
- Deleting or replacing `data.json` (use `resetStore()` for tests, never `rm`)
- Changing seed data shape (breaks existing carts/orders)
- Swapping the Claude model or upgrading SDK major versions
- Adding new paid external APIs (image generation, payments)
- Adding auth or session changes (UUID session model is load-bearing)
- Deleting tests rather than fixing them

**Safe to proceed without asking:**
- UI tweaks, new components, additive routes, new tests
- Refactoring within a single file
- Dependencies that fit existing stack

## Pointers

- **Backlog:** `docs/backlog.md`
- **Research:** `docs/marketing-research.md`, `docs/print-publishing-research.md`
- **Agent definitions:** `.claude/agents/{storefront,booksmith,qa}.md`
