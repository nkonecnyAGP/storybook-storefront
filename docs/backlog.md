# StoryBook Storefront — Product Backlog

Established 2026-05-14. The app is a working storefront + AI book creation tool. Core pivot: evolve from one-shot generation to a **collaborative creation workflow** with iteration loops.

**Why this matters:** This is a demo of a real product concept, not a toy. The creation workflow (story iteration + illustration iteration) is the core differentiator over competitors like Wonderbly and Hooray Heroes.

## Tier 1 — Core Creation Workflow

Sequential dependency chain — each item unblocks the next.

- [x] **T1.1** — Book versioning and draft status (draft/published lifecycle) — shipped in PR #13
- [x] **T1.2** — Story iteration/feedback workflow (read, give feedback, get revision from Claude) — shipped in PR #13, includes revert + post-revise comparison modal
- [x] **T1.3** — Illustration generation (integrate image API) — shipped earlier; PR #13 added character consistency in prompts and MyBooks unillustrated badge
- [x] **T1.4** — Illustration iteration/feedback workflow (per-page regen with feedback) — shipped in PR #13, includes persisted version metadata, history viewer with timestamps + feedback, active-version indicator

## Tier 2 — Storefront & Research

- [x] **T2.5** — Enhanced browse experience (search, better filtering, community creations, book preview) — already shipped: Home.tsx has search, theme + age range chips, Featured + Community sections, BookPreviewModal, with Home unit and e2e coverage
- [x] **T2.6** — Research: illustration APIs and cost models → `.code-captain/product/illustration-providers-and-character-consistency.md`
- [x] **T2.7** — Research: marketing strategies → `docs/marketing-research.md`
- [x] **T2.8** — Research: print/publishing options → `docs/print-publishing-research.md`

## Tier 3 — Operations & Hygiene

- [ ] **OPS.1** — Replace demo-seed examples. `server/prisma/demo-seed.ts` currently creates the demo user only; `DEMO_BOOKS` was emptied because the image-derived vision rewrites were low quality. Replace with 3-5 books actually generated via the in-app story generator (story + illustrations + character consistency). Capture their UUIDs in `DEMO_BOOKS` so seed reruns can recreate them deterministically.
- [ ] **OPS.2** — Admin role on User (referenced in commit f71d253). Add `role: 'user' | 'admin'`, soft-delete on User and Book, and an admin-only API surface to inspect/clean orphaned state.
- [ ] **OPS.3** — Decide and implement client/server type-sharing strategy. Today `client/src/types.ts` and `server/src/types.ts` are hand-maintained duplicates with no compile-time guarantee they stay in sync. Drift surfaced as a real production bug in OrderConfirmation (`book_title` vs `title` — order summary rendered empty book titles to every customer). Now partially guarded by a wire-shape assertion convention documented in `.claude/agents/qa.md` plus an e2e check on the checkout flow, but drift can still happen anywhere else.

  **Options:**
  - **(a)** Status quo + extend the wire-shape assertion convention to every route. Cheapest, doesn't prevent drift — only catches it earlier.
  - **(b)** Zod schemas declared in server routes, derive types via `z.infer`, share with client via a `shared/` package. Server becomes the source of truth. **Recommended for this codebase.**
  - **(c)** OpenAPI spec generated from server, generate client types from spec. Heaviest, best long-term for multi-client / public API.
  - **(d)** Co-located response types — server route exports the response type, client imports via relative path. Cheap, but creates an unusual cross-zone TS dependency.

  **Substantial refactor — recommend a fresh session.** Other routes with under-asserted response shapes (audit found during the OrderConfirmation fix): `cart.ts` GET, `books.ts` GET/PUT/POST endpoints, `admin.ts`, `test.ts`. Apply the convention there too as part of (a), or supersede with (b)/(c).

## Working notes

Update this section as work proceeds. Subagents read from here.
