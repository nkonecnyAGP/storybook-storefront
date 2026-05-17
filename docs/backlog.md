# StoryBook Storefront — Product Backlog

Established 2026-05-14. The app is a working storefront + AI book creation tool. Core pivot: evolve from one-shot generation to a **collaborative creation workflow** with iteration loops.

**Why this matters:** This is a demo of a real product concept, not a toy. The creation workflow (story iteration + illustration iteration) is the core differentiator over competitors like Wonderbly and Hooray Heroes.

## Tier 1 — Core Creation Workflow

Sequential dependency chain — each item unblocks the next.

- [ ] **T1.1** — Book versioning and draft status (draft/published lifecycle)
- [ ] **T1.2** — Story iteration/feedback workflow (read, give feedback, get revision from Claude)
- [ ] **T1.3** — Illustration generation (integrate image API — evaluate DALL-E 3, Stability, Replicate)
- [ ] **T1.4** — Illustration iteration/feedback workflow (per-page regen with feedback)

## Tier 2 — Storefront & Research

Parallelizable with Tier 1.

- [ ] **T2.5** — Enhanced browse experience (search, better filtering, community creations, book preview)
- [ ] **T2.6** — Research: illustration APIs and cost models
- [ ] **T2.7** — Research: marketing strategies → see `marketing-research.md`
- [ ] **T2.8** — Research: print/publishing options → see `print-publishing-research.md`

## Working notes

Update this section as work proceeds. Subagents read from here.
