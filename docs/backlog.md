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
- [x] **OPS.3** — Implement client/server type-sharing via Zod, with OpenAPI as a forward-compatible upgrade path. Shipped 2026-05-18 across PRs #22 (foundation + `orders.ts`), #23 (`cart.ts`), and #24 (`books.ts`/`admin.ts`/`test.ts`). See [Completed work](#completed-work) for non-obvious conventions.

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

_(Currently empty — last entry was the OPS.3 migration, now collapsed into Completed work below.)_

## Completed work

### OPS.3 — Zod client/server type sharing (shipped 2026-05-18)

Migrated every server route to Zod schemas in `shared/src/*.ts` validated by a `validate()` Express middleware. Across PRs #22, #23, #24, all 5 domains (orders / cart / books / admin / test) now validate request bodies and response wire shapes against schemas in the `@storybook/shared` source-only workspace package. `client/src/types.ts` and `server/src/types.ts` re-export wire shapes from `@storybook/shared`; server-only DB-row and auth shapes stay local.

**Non-obvious conventions worth preserving** (future contributors and follow-up agents — read these before adding routes or extending the schemas):

- **Dates over the wire: use `z.string()`, not `z.date()`.** Prisma hands back `Date` instances, but the response middleware validates the post-`JSON.stringify` wire shape, which is ISO strings. `z.date()` will pass in unit tests against raw JS objects and fail in integration tests against the actual response.
- **Auth middleware runs BEFORE `validate()`.** `requireAuth` (books.ts) and `adminGate` (admin.ts) are mounted before the per-route validators so 401/403 always wins over 400. Auth'd user is threaded through `res.locals.user`. Don't move the auth check inside handlers — that ordering leaks schema info to unauthenticated callers.
- **Request-error message format is `Invalid request body: <field>: <zod-message>`.** Tests that pin error strings need to match this prefix. See `server/src/middleware/validate.ts` (`summarizeIssues()`). The doubled-field-name pattern (`bookId: bookId is required`) is awkward but consistent — polish item if anyone wants to revisit.
- **Re-export, don't delete.** `types.ts` files on both client and server keep their existing symbol names by re-exporting from `@storybook/shared` rather than being deleted. This preserves the legacy `Store` interface (server) and 20+ client import sites. `AdminBook` (client) is an extension of shared `Book` to keep room for client-only admin fields.
- **`is_featured` and `is_user_created` are `boolean`, not `number`.** Prisma schema and shared Zod agree on `boolean`; the legacy server `types.ts` had them as `number` — that was a pre-existing bug fixed during migration, not a wire-shape change.
- **Server-only DB-row shapes stay in `server/src/types.ts`:** `CartItemRow` (the unhydrated DB shape, distinct from the wire `CartItem`), `LegacyBook` / `LegacyPage` (dormant JSON-store seed in `db/init.ts`), `User` / `AdminUser` (auth). These never reach `@storybook/shared`.
- **OpenAPI is deferred.** Add `@asteasolutions/zod-to-openapi` only when a concrete non-TS client or external API consumer lands. The Zod schemas are forward-compatible.

**Worktree-setup improvements folded in along the way:**
- `scripts/worktree-setup.mjs` (run via `npm run setup:worktree`) — copies `server/.env` and `server/prisma/dev.db` into a freshly-created worktree so agent worktrees are immediately runnable after `npm install`.
- `e2e` is now part of the root `workspaces` array so `cd e2e && npm test` works without a separate install.
- `.claude/commands/start-task.md` bakes the hydration step into the standard task kickoff flow.
