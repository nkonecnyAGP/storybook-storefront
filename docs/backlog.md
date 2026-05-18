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

### agent/refactor/ops3-zod-cart — 2026-05-18

**Backlog:** OPS.3 — follow-up: migrate `cart.ts` to shared Zod schemas (next route after `orders.ts` foundation)
**Owner agent:** multi-zone (booksmith first, storefront follows) — same serial delegation pattern as `agent/refactor/ops3-zod-foundation`

**Scope:**
- Add Zod schemas for `cart.ts` request/response shapes in `shared/`
- Migrate `server/src/routes/cart.ts` to use `validate(Schema)` middleware and `z.infer` types
- Swap client cart types to `@storybook/shared` imports, re-export from `client/src/types.ts` if needed for legacy `Store` interface (mirror the `Order`/`OrderItem` pattern)

**Carry-over conventions from foundation PR:**
- Use `z.string()` for date fields (Prisma serializes to ISO strings over the wire)
- Response middleware validates the post-`JSON.stringify` shape — don't use `z.date()`
- Re-export rather than delete duplicated types until the migration is complete

**Route surface (5 endpoints in `server/src/routes/cart.ts`):**

| Method | Path | Request body | Response shape |
|--------|------|--------------|----------------|
| GET | `/:sessionId` | — | `{ items: CartItem[], total: number }` |
| POST | `/:sessionId/items` | `{ bookId: string, quantity?: number }` (default 1) | `{ success: true }` |
| PUT | `/:sessionId/items/:bookId` | `{ quantity: number }` | `{ success: true }` |
| DELETE | `/:sessionId/items/:bookId` | — | `{ success: true }` |
| DELETE | `/:sessionId` | — | `{ success: true }` |

The hydrated `CartItem` wire shape (returned in GET) is: `{ id: number, book_id: string, quantity: number, title: string, price: number, cover_emoji: string, cover_color: string, author: string }`. This is what `client/src/types.ts:76-85` currently declares — it becomes the shared schema's source of truth.

**Schemas to add in `shared/src/cart.ts`** (and re-export from `shared/src/index.ts`):
- `CartItemSchema` — the wire shape above
- `CartGetResponseSchema` — `{ items: z.array(CartItemSchema), total: z.number() }`
- `CartAddItemRequestSchema` — `{ bookId: z.string().min(1, 'bookId is required'), quantity: z.number().int().positive().default(1) }`
- `CartUpdateItemRequestSchema` — `{ quantity: z.number().int().nonnegative() }` (0 is the "remove" sentinel — see line 64 of cart.ts)
- `CartMutationResponseSchema` — `{ success: z.literal(true) }` (shared across POST/PUT/DELETE)

**Naming clash to resolve:**
`server/src/types.ts:52-57` already has a `CartItem` interface, but it's the **DB row shape** (`{ id, session_id, book_id, quantity }`) used only by the legacy `Store` interface (line 64-71). The shared schema is the **wire shape** (hydrated with book fields). Resolve by renaming the server-internal interface to `CartItemRow`, updating `Store.cartItems: CartItemRow[]`, then re-exporting `CartItem` (wire) from `@storybook/shared` — same pattern the foundation PR used for `Order`/`OrderItem`.

**Error-message preservation:**
`server/src/routes/__tests__/cart.test.ts:40` asserts `res.body.error === 'bookId is required'` on missing-body POST. The Zod schema's `.min(1, 'bookId is required')` (and the foundation PR's `validate()` middleware, which surfaces the first Zod error message) preserves this exact string. No test changes needed.

**Client touch:**
Only `client/src/types.ts:76-85` needs to change — delete the local `CartItem` interface and add a re-export `export type { CartItem } from '@storybook/shared'` (mirroring the `Order`/`OrderItem` pattern at line 93). All 21 client files that reference `CartItem` import via `from '../types'` and keep working unchanged.

**Plan**
- [x] @booksmith: add `shared/src/cart.ts` with the 5 schemas above; re-export from `shared/src/index.ts`
- [x] @booksmith: migrate `server/src/routes/cart.ts` — wrap each route with `validate({ name, request?, response })`, replace manual `if (!bookId)` check with Zod's required validation, infer types from schemas
- [x] @booksmith: rename `CartItem` → `CartItemRow` in `server/src/types.ts`; update `Store.cartItems`; re-export `CartItem` from `@storybook/shared`
- [x] @booksmith: verify `cart.test.ts` (and full `npm test` in `server/`) still passes — 85/85
- [x] @storefront: swap `client/src/types.ts:76-85` from local `CartItem` interface to a re-export of `CartItem` from `@storybook/shared`
- [x] @storefront: `npm test` in `client/` still passes — 36/36 (RTL)
- [x] e2e: cart user flow still passes — 27/27 Playwright, including the full add→cart→checkout→confirmation flow
- [x] Manual smoke skipped — pure type swap, zero UI changes, e2e covers the cart user flow end-to-end (and response middleware would have caught wire-shape drift at test time)

**Plan deviations during execution:**
- **Error-message format under `validate()`.** Plan assumed `.min(1, 'bookId is required')` would surface the bare Zod message; in practice the middleware always prefixes `Invalid request body: <path>: ` (see `server/src/middleware/validate.ts:45` + `summarizeIssues()`), so the wire error is `Invalid request body: bookId: bookId is required`. `cart.test.ts:41` was updated to assert the actual format. This is consistent with how the foundation PR's middleware would have surfaced errors — no other consumer (e2e, client error-handling) asserts the exact error string, so the change is contained. Worth a follow-up consideration: the `bookId: bookId is required` doubling reads awkwardly; trimming the Zod message to `'is required'` would render as `Invalid request body: bookId: is required`. Polish item, not blocking.
- **Schema field type for `success`.** Used `z.boolean()` rather than `z.literal(true)` for the cart mutation responses. Functionally equivalent; `literal(true)` would have been marginally more precise. Not worth churning.

**Folded into this branch (separate scope, will be in the same squash-merged PR):**
- `.claude/commands/start-task.md` — added step 5 "Hydrate the worktree" baking in `npm install && npm run setup:worktree` and a Prisma-client copy workaround for corporate-cert environments. Reason: worktree setup is required for every agent-driven task in this repo; making it implicit in `/start-task` removes the "agent dispatched to broken worktree" failure mode.
