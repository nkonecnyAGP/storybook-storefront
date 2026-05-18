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
- [ ] **OPS.3** — Implement client/server type-sharing via Zod, with OpenAPI as a forward-compatible upgrade path.

  **Context.** `client/src/types.ts` and `server/src/types.ts` are hand-maintained duplicates with no compile-time link. Drift surfaced as a real production bug in OrderConfirmation (`book_title` vs `title` — order summary rendered empty book titles to every customer). Wire-shape assertions in `.claude/agents/qa.md` are an interim catch-net; this item is the structural fix.

  **Decision (2026-05-18):** **Zod schemas as the source of truth.** When OpenAPI's specific benefits become valuable (third-party API consumers, non-TS clients, vendor-facing docs), generate the OpenAPI spec FROM the existing Zod schemas via `@asteasolutions/zod-to-openapi` or `zod-openapi`. This is NOT "Zod now, OpenAPI rewrite later" — the Zod schemas remain the source of truth in every future state.

  **Why this over OpenAPI-first:** OpenAPI's killer features (multi-language SDK generation, Swagger UI docs, mock servers) only pay off when you have non-TS clients or external API consumers. None are on the storefront's near-term roadmap. Adopting OpenAPI now means paying the toolchain tax (codegen pipelines, less ergonomic generated TS types, separate runtime-validation layer) for capabilities that aren't yet useful. Zod gives runtime validation, end-to-end TS inference, IDE-refactor-safety, and a low-friction migration path to OpenAPI when needed.

  **Implementation plan:**
  1. Add Zod schemas (`z.object({...})`) for each route's request body and response shape, colocated with the route or in a shared `shared/` package
  2. Mount Zod validation middleware on the server (validates request payloads, types response shapes)
  3. Export `type Foo = z.infer<typeof FooSchema>` and import from both client and server
  4. Delete duplicated definitions from `client/src/types.ts` and `server/src/types.ts`
  5. Apply the wire-shape assertion convention to remaining under-asserted routes during migration: `cart.ts` GET, `books.ts` GET/PUT/POST endpoints, `admin.ts`, `test.ts`. Start with `orders.ts` since the drift bug is fresh in context.

  **Deferred:** OpenAPI generation. Add `zod-to-openapi` only when there's a concrete need — third-party API consumers, non-TS clients (mobile app, partner SDKs), or vendor-facing API documentation. Zod schemas from step 1 are forward-compatible — no rework cost when this trigger fires.

  **Rejected alternatives:**
  - **OpenAPI-first** — enterprise tax for capabilities not yet needed. Generated TS types are less ergonomic than Zod inference. Runtime validation requires a separate layer. Reconsider if/when a non-TS client or external API consumer lands on the roadmap.
  - **tRPC** — best DX for monorepo-only TS, but harder to expose the API to non-TS clients later. Doesn't fit the "potential to grow into mobile/partners" framing.
  - **Co-located response types** (server route exports the type, client imports via relative path) — cheap, but creates an unusual cross-zone TS dependency that conflicts with the zone-ownership model in CLAUDE.md.
  - **Status quo + assertions everywhere** (the original option (a)) — catches drift earlier but doesn't prevent it. Useful as an interim only.

  **Substantial refactor — recommend a fresh session.** Migration touches every API surface; suggest going route-by-route rather than big-bang.

## Future directions

Aspirational, not committed. Captured so structural decisions today stay forward-compatible.

- **Mobile / non-TS clients.** If the storefront proves out as a real product, a native mobile companion (RN, Swift, or Kotlin) is an avenue worth exploring. This is part of why OPS.3 chose Zod-as-source-of-truth with a Zod → OpenAPI upgrade path: when a non-TS client lands, we generate the OpenAPI spec from existing Zod schemas via `@asteasolutions/zod-to-openapi` rather than rewriting the contract layer. No work today, just preserving the optionality.

## Working notes

Update this section as work proceeds. Subagents read from here.

### agent/refactor/ops3-zod-foundation — 2026-05-18

**Backlog:** OPS.3 — Zod-based client/server type sharing, first PR of a multi-PR migration
**Owner agent:** multi-zone (booksmith + storefront, orchestrated from main session)

**Scope of this PR (foundation only):**
- New top-level `shared/` workspace package — Zod schemas live here, exports `z.infer` types
- Server-side Zod request/response validation middleware
- Migrate `orders.ts` end-to-end as the reference pattern (fresh in context from the OrderConfirmation drift bug)
- Client + server delete their local copies of the order-related types and import from `shared/`

**Out of scope (follow-up PRs):**
- `books.ts`, `cart.ts`, `admin.ts`, `test.ts` route migrations
- OpenAPI generation (deferred per backlog decision)

**Locked decisions (2026-05-18):**
- **Shared package:** `@storybook/shared` workspace package, **source-only** (consumers import `.ts` directly via Vite + tsx — no build step). Promote to a built package only if `shared/` grows runtime code beyond Zod schemas.
- **Middleware:** per-route inline `validate(Schema)` — standard Express pattern, no schema registry.
- **Response validation:** throw in dev/test, warn in prod. Drift is the bug class this exists to prevent — catch loudly in tests, don't 500 every customer on a bad deploy.
- **Delegation:** serial. @booksmith lands server + shared package + schemas; @storefront follows to swap client types. No artificial parallelism.

**Plan**
- [x] @booksmith: create `shared/` workspace package (source-only `.ts`, no build), add to root workspaces
- [x] @booksmith: author Zod schemas for `orders.ts` request/response shapes in `shared/`
- [x] @booksmith: `validate(Schema)` Express middleware (request body + response shape, throw dev/warn prod)
- [x] @booksmith: migrate `orders.ts` to shared schemas, remove duplicated server types
- [x] @booksmith: server tests still pass (Vitest+Supertest) — 85 tests pass (77 pre-existing + 8 new middleware tests)
- [x] @storefront: swap client order types to `shared/` imports, remove duplicates from `client/src/types.ts`
- [x] @storefront: client tests still pass (Vitest+RTL)
- [x] e2e tests pass (order flow is user-facing) — 27/27 Playwright tests pass
- [x] Manual smoke test in browser, light + dark mode — order confirmation renders book title correctly in both modes (original drift bug stays fixed)

**Worktree setup gaps found during verification — fixed in this PR:**
- Added `scripts/worktree-setup.mjs` — copies `server/.env` and `server/prisma/dev.db` from the main checkout into a freshly-created worktree (idempotent, skips files that already exist). Wired as `npm run setup:worktree`. After `git worktree add ...` (or the EnterWorktree tool), running `npm install && npm run setup:worktree` makes the worktree fully runnable.
- Added `e2e` to the root `workspaces` array so `cd e2e && npm test` works without a separate `npm install` step. Verified Playwright resolution still works post-hoist: 27/27 e2e tests pass.
- Re-verified server (85/85) and client (36/36) tests after the workspace shuffle.

**@booksmith handoff notes (2026-05-18):**
- Workspaces in root `package.json` now include `shared`, `server`, and `client` (all three — bringing server/client into the workspace was needed so npm symlinks `@storybook/shared` into a hoisted `node_modules` where both tsx and Vite can resolve it).
- After pulling this branch and running `npm install` at the repo root, Prisma will need a `npx prisma generate` from `server/` (workspace hoisting moved Prisma's binary location). The existing `db:*` scripts in `server/package.json` continue to work.
- Test globalSetup was updated to use `npx prisma migrate deploy` instead of a hardcoded `node ./node_modules/prisma/build/index.js` path (npm workspaces hoist `prisma` to root `node_modules`).
- Response middleware validates the post-`JSON.stringify` wire shape (not the raw JS object). This is deliberate — Prisma hands back `Date` instances, but clients see ISO strings. Use `z.string()` (not `z.date()`) for date fields in the schemas.
- `server/src/types.ts` now re-exports `Order` and `OrderItem` from `@storybook/shared` so the legacy `Store` interface still type-checks; storefront agent should do the same on the client side rather than deleting `client/src/types.ts` entirely.
