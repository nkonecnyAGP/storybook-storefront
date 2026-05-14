# Product & Technical Decisions Log

Append-only log. Newest entries on top. Each entry should answer: *what was decided, when, why, and what we considered instead.*

---

## ADR-002 — Character cast persisted as JSON column, not separate table

**Date:** 2026-05-14
**Status:** Accepted
**Scope:** MVP-1 of the illustration/authoring upgrade (see [roadmap.md](roadmap.md))

### Decision

Persist the character cast on `Book.characters_json` (a `String?` column holding a JSON-encoded array) rather than introducing a `Character` table with a foreign key to `Book`.

Shape:

```ts
type Character = {
  role: 'primary' | 'antagonist' | 'supporting';
  name: string;
  descriptor?: string;
  relationship?: string;
};
```

### Why

- **Matches an existing precedent.** `BookVersion.pages_json` already encodes structured data as JSON in a column. Following the same pattern keeps the schema small and the mental model consistent.
- **No query pressure.** We do not search, filter, or aggregate by character. Characters are always loaded with their parent Book.
- **Migration is additive and reversible.** One nullable column; no FKs, no joins to update, no risk to existing rows.
- **Caps are small.** Max 6 characters per book (enforced at the UI) keeps the JSON blob tiny — typically well under 1 KB.

### Alternative considered: separate `Character` table

A normalized `Character` table with a FK to `Book` would be more "correct" if any of these become true later:
- We want to query characters across books (e.g. "all books featuring a character named Luna").
- Characters carry their own per-page state (which pages they appear on, screen time, etc.).
- We need referential integrity from other entities (e.g. character ↔ reference photo).

If those needs land, migration is straightforward: read `characters_json`, write rows to a new `Character` table, drop the column. We accept that re-migration cost as cheap insurance for the simpler initial design.

### Consequences

- **Hydration helper required.** `server/src/routes/books.ts` exports `hydrateBook()` which parses `characters_json` into `characters: Character[]` on every read. All GET/POST/PUT response builders must funnel through it (already wired in this commit).
- **No DB-level validation of character shape.** The hydrator tolerates bad JSON by returning `[]`. The server route validates the shape on write via `normalizeCharacters()` in [generate.ts](../../server/src/routes/generate.ts).
- **Phase 2 work (character reference photos) needs this revisited.** If photos attach per-character with their own URL/metadata, the JSON blob may need to expand or be split out. Flag a follow-up ADR at that point.

---

## ADR-001 — Documented harness on the upstream Code Captain template

**Date:** 2026-05-14
**Status:** Accepted with deferred upgrade — see [harness-backlog.md](harness-backlog.md)

### Decision

Continue running on the local project-specific `.claude/agents/` (booksmith, qa, storefront) rather than installing `npx @devobsessed/code-captain` v0.6.0.

### Why

Demo is the day after this decision was made (2026-05-15). The full template install adds 4 new generic agents, 7 commands, 6 skills, an `.mcp.json`, and a `.code-captain/` directory structure — substantial diff with non-zero risk of conflict with the existing custom agents. Not worth the rollback risk this close to a stakeholder demo.

### What we adopted *from* the template anyway

- The `.code-captain/product/` directory convention (this file, plus [roadmap.md](roadmap.md)). Lightweight; matches what the template would have produced via `plan-product`.

### What's deferred

See [harness-backlog.md](harness-backlog.md) for the full list of upstream items worth revisiting after the demo.
