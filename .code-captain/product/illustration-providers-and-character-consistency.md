# Research: Illustration Providers and Character Consistency

**Status:** Research / planning. Not yet scheduled for implementation.
**Date:** 2026-05-15
**Drivers:** (1) demo-day cost shock — real OpenAI spend was ~$0.20-$0.45 per image (10× our paper estimate), so a 15-page Full book is $3-$7; (2) characters drift visibly between pages of the same book today, which makes the book feel "AI-glued-together" instead of authored.

This document recommends a concrete provider migration and a character-consistency workflow, with three tiers of approach so the decision can be revisited.

---

## TL;DR — recommended path

1. **Build a provider abstraction layer first** (one small server change). Today the OpenAI call is hard-coded in `server/src/services/illustrations.ts`. Abstract it behind an `ImageGenerator` interface so switching providers later doesn't ripple into routes / UI.
2. **Move per-page generation to Fal.ai Flux Pro 1.1** ($0.04-$0.06/image, ~5-10× cheaper than current spend, comparable or better quality, and supports IP-Adapter for image-based character references).
3. **Add a one-time per-character "character sheet" portrait step at book creation.** Each character in the cast gets one generated portrait, saved on a new `Character.image_url`. Cost: one image per character (~$0.04 × ~3 characters = ~$0.12 one-time).
4. **Pass each character's portrait into every page generation via IP-Adapter.** This is what closes the consistency gap. Combined with detailed text descriptors, it produces page-to-page identity stability that prompt-engineering alone can't match.
5. **Keep OpenAI gpt-image-1 as a fallback provider option** for users who want the existing "photoreal soft" / Pixar-ish look, or for edits that require the strongest semantic prompt adherence.

Estimated impact for a 6-page Full book:
- Today: ~$1.20-$2.70 (6 × $0.20-$0.45 on gpt-image-1)
- After: ~$0.32 (3 char portraits + 6 pages × $0.04 on Fal Flux Pro), with notably better character consistency

That's a ~5-8× cost reduction AND solves the bigger product problem.

---

## Provider comparison

Per-image pricing for 1024×1024, current as of 2026-05-15. Numbers are list price for the standard tier — bulk / committed-use discounts not included.

| Provider | Model | Cost / image | Image input? | Strengths | Weaknesses |
|---|---|---|---|---|---|
| **OpenAI** | gpt-image-1 | $0.04 standard, **$0.17-$0.45 in practice** (token-based) | Yes (multimodal) | Best prompt adherence, strongest at semantic instructions, supports image-to-image | Cost is opaque (token-based, unpredictable), proprietary, no LoRA / fine-tune, peak-time rate limits hurt |
| **Fal.ai** | flux/schnell | $0.003 | No | Cheapest serious option, fast, fine for placeholders | Lower quality, no IP-Adapter for char refs |
| **Fal.ai** | flux/dev | $0.025 | Limited (IP-Adapter) | Strong quality / price ratio, IP-Adapter for char refs | Slightly less polished than Pro |
| **Fal.ai** | flux-pro/v1.1 | $0.04 | Yes (IP-Adapter, ControlNet) | **Sweet spot.** Production-quality, image input, fast inference (~5-10s), great LoRA ecosystem | Closed model (no self-host) |
| **Fal.ai** | flux-pro/v1.1-ultra | $0.06 | Yes | Highest quality Flux tier, sharp details | More expensive, marginal upgrade vs v1.1 for most cases |
| **Fal.ai** | recraft-v3 | $0.04 | Yes (style refs) | Illustration-strong, best at "specific art style" adherence | Less versatile than Flux for non-illustration |
| **Google** | imagen-3 (Vertex AI) | $0.03 | Limited | Strong on photoreal, decent on illustration | Vertex setup more involved than Fal, harder LoRA workflow |
| **Replicate** | flux-pro | $0.055 | Yes | Same Flux Pro model via aggregator, broader model menu | Slight overhead vs going direct to Fal |
| **Replicate** | sdxl | $0.003-$0.01 | Yes (IP-Adapter, ControlNet) | Cheapest production option, very flexible (LoRAs, embeddings) | Lower base quality, more tuning needed |
| **Self-hosted SDXL on RunPod** | sdxl + IP-Adapter | ~$0.001 + infra time | Yes (full control) | Lowest per-image cost at scale, full LoRA / fine-tune control | Adds devops: container, GPU scheduling, cold starts, monitoring |
| **Stability AI** | stable-image-ultra | $0.08 | Yes | Reliable, well-documented | Pricier per image than Fal Pro for similar quality |
| **Ideogram** | v2 | $0.08 | Limited | Best-in-class for text-in-images | We don't put text in images (prompt explicitly forbids it) |

### Why Fal.ai Flux Pro 1.1 is the recommended primary

- **Cost predictability.** Flat $0.04/image vs OpenAI's token-based billing that surprised us.
- **Image input via IP-Adapter is native** — this is the single feature that unlocks the character-consistency strategy. Without it, character refs become a hack.
- **Quality matches or beats gpt-image-1 for illustration.** Side-by-side comparisons widely available; Flux Pro is the current consensus illustration leader.
- **LoRA ecosystem** is mature. If we later want a "Pixar-ish" or "watercolor" preset that's tighter than prompt engineering can deliver, we can ship a LoRA per art style.
- **Fast inference (~5-10s) means lower request-holding-open time** — relevant when our `/api/generate` is doing 6 sequential calls in Full mode and timing out is a real risk.

### Why keep OpenAI as a secondary

- Some users will prefer the existing look. Don't break what works.
- gpt-image-1 has the strongest *semantic* instruction-following — useful when a page's illustration_description is unusually specific ("Luna holds the star-flower in her left hand while looking back at the dragon over her right shoulder").
- A provider abstraction layer makes "let user pick" cheap.

---

## Character consistency — three approaches, ranked

### Approach 1 (recommended): Character sheet + IP-Adapter

**The idea:** Generate one canonical portrait per cast member at book creation. Save the URL on each `Character` record. When generating each page, pass the relevant character portrait(s) into the page-generation call via IP-Adapter (or gpt-image-1's image-input slot).

**Required changes:**
- Schema: `Character` needs an `image_url` field (or a separate `CharacterImage` table for versioning). Easiest path: extend `characters_json` to carry an optional `imageUrl` per character.
- Server: new endpoint `POST /api/books/:id/characters/:role/portrait` that generates a single portrait from the character's name + descriptor + book's style descriptor.
- Server: existing `generateIllustration()` / `generateCover()` need to accept an array of reference images and pass them through to the chosen provider's IP-Adapter slot.
- Client: wizard step 2 (cast builder) shows generated portraits inline after creation, with a "regenerate this character" button per row.
- Provider: requires Fal.ai Flux Pro 1.1 (or gpt-image-1, but at gpt-image-1 pricing the consistency gain is overshadowed by the cost regression we're trying to fix).

**Quality ceiling:** High. IP-Adapter with 60-80% weight delivers strong likeness across pages while still allowing the page composition to change.

**Estimated added cost per book:** ~$0.04-$0.12 one-time (one image per character, max 3 characters).

### Approach 2: Detailed character descriptors (no provider change)

**The idea:** Replace short character descriptors with rigorously detailed ones, and append them verbatim to every page prompt.

**Today's character record:** `{ name: "Luna", role: "primary", descriptor: "loves dinosaurs" }`

**Proposed:** `{ name: "Luna", role: "primary", descriptor: "8-year-old girl with curly dark brown hair in two short pigtails, light brown skin, big round brown eyes, freckles across nose, wearing a yellow raincoat with a hood pulled down, dark green rain boots, holds a small flashlight" }`

**Required changes:**
- Wizard cast builder: add a longer descriptor mode, optionally pre-fill via a Claude call ("expand this descriptor into 6-10 visual attributes").
- Server: prepend each character's full descriptor to every page's illustration prompt.

**Quality ceiling:** Medium. Prompt-only consistency is fundamentally limited — diffusion models are stochastic and even identical prompts produce different faces. Helps a lot vs. the current state, but won't reach IP-Adapter levels.

**Estimated added cost per book:** Zero.

**Worth doing as a Phase 0 even if we adopt Approach 1** — better descriptors improve IP-Adapter results too. Cheap insurance.

### Approach 3: Per-book LoRA / fine-tune

**The idea:** Train a tiny adapter (LoRA) on each character at book creation. Use it during page generation.

**Required changes:**
- Provider: Fal.ai or Replicate (both expose LoRA training; OpenAI doesn't).
- Training: needs 4-12 reference images per character. Could be generated on the fly with high-variance prompts, or user-uploaded photos.
- Per-character training cost: ~$0.50-$2 on Fal.ai. Per-image inference cost stays at $0.04.
- Time: training takes 2-5 minutes per character. Has to happen before any page can render.

**Quality ceiling:** Highest. Near-perfect character identity preservation.

**Drawback:** Heavyweight. Multi-minute training step blocks book creation. Mostly worth it for "premium" books or when the character is based on a real person/pet (Phase 2 user-photo feature).

**Recommendation:** Defer until after Approach 1 is shipped. Layer this on top as an optional "consistency: premium" mode later.

### Approach 4: Deterministic seeding (incremental, not standalone)

Use the same seed across all pages of a book. Provided we hold the prompt mostly constant (which the character descriptor + style descriptor do), same-seed generation produces noticeably similar (not identical) characters.

**Worth folding into Approach 1.** Minimal cost. Set `seed = hash(book.id)` and pass to every generation call.

---

## Process improvements (provider-agnostic, all cheap)

These reduce the *number of expensive calls* without changing the provider, and stack on top of any of the above.

1. **Editable illustration prompt before sending the AI request.** Already in the backlog. The single biggest cost reducer. Today the only way to influence an image is fire-then-revise, doubling the cost of every imperfect first try.
2. **Show the assembled prompt to the user before they click Generate.** A small expand-to-see-prompt UI element so the user can spot a bad prompt ("she's wearing the wrong color") before paying for an image. Even better when combined with #1.
3. **Cache style-descriptor enrichment.** If we apply the same style descriptor across all pages, we can normalize it once and reuse. Minor speedup, no cost change.
4. **Suggest illustration improvements via Claude before generating.** Send the assembled prompt to Claude (cheap, ~$0.005), ask "are there any composition or clarity issues with this prompt for a children's book illustration?" Use the response as a soft suggestion next to the Generate button. One-shot, optional, gives the user a free quality check.

---

## Implementation phases (suggested sequencing)

### Phase 0 (no provider change, biggest single win)
- [ ] Editable illustration prompt before image gen (already in backlog as #1)
- [ ] Expand character descriptors in the cast builder + auto-suggest helper
- [ ] Show assembled prompt in the UI before Generate

Estimated: 1-2 days of work, zero new infra. Probably halves real cost per book by itself.

### Phase 1 (provider migration)
- [ ] Add `ImageGenerator` interface in `server/src/services/illustrations.ts`, refactor existing OpenAI code behind it
- [ ] Add Fal.ai provider implementation
- [ ] Env var `IMAGE_PROVIDER=fal|openai` to choose at server start (or per-request later)
- [ ] Update the wizard to pick a provider per book (optional — could just env-config it for v1)

Estimated: 1-2 days. Most of the work is the abstraction layer.

### Phase 2 (character consistency via IP-Adapter)
- [ ] Schema: add `imageUrl` to the character entries inside `characters_json`
- [ ] New endpoint to generate a single character portrait
- [ ] Wizard cast builder shows portraits + per-row regenerate
- [ ] Page generation passes the relevant character portraits to the provider as references

Estimated: 3-5 days. Most of the work is the wizard UI and threading reference images through the request lifecycle.

### Phase 3 (premium consistency — LoRA per character)
- [ ] Optional "premium consistency" toggle at book creation
- [ ] Per-character LoRA training step at creation time
- [ ] Inference uses the LoRA

Estimated: 1-2 weeks. Defer until Phase 2 lands and we know whether IP-Adapter alone is enough.

---

## Open questions

1. **Who manages the Fal.ai API key?** Same pattern as `OPENAI_API_KEY` — env var, server-side. Cheap to sign up; offers $1 of free credit.
2. **Do we expose provider choice to end users?** Probably not initially. Pick the best default (Fal Flux Pro), and let users toggle via a dev-only setting until we have telemetry to compare.
3. **What happens to existing books generated on OpenAI when we switch?** Nothing — their `illustration_url` values still point at PNG files on disk. Only *new* generations and *regenerations* use the new provider.
4. **How do we evaluate the migration?** Suggested A/B: generate the same 3 demo books on both providers, post side-by-side in a Slack/Linear discussion, let the team vote on which set is closer to "a real children's book". Cost is small (~$0.50).
5. **Does Approach 1 (character sheet) close the consistency gap for non-human characters?** (e.g., the dragon antagonist). IP-Adapter generalizes to non-faces but performance varies. Worth a 1-image test as part of evaluation.

---

## Files this work will touch (when implemented)

For the maintainer who picks this up next session:

| File | Change |
|---|---|
| `server/src/services/illustrations.ts` | Refactor into `ImageGenerator` interface; add Fal provider |
| `server/src/services/providers/fal.ts` | NEW — Fal.ai Flux Pro implementation |
| `server/src/services/providers/openai.ts` | NEW — extracted current code |
| `server/src/routes/generate.ts` | Generate character portraits on book creation |
| `server/src/routes/books.ts` | New `/characters/:role/portrait` endpoint; pass refs into illustrate |
| `server/src/types.ts` | Add optional `imageUrl` to `Character` |
| `client/src/types.ts` | Mirror |
| `client/src/pages/CreateBook.tsx` | Show character portraits after generation; regenerate button |
| `client/src/pages/BookDetail.tsx` | Pass character refs through revise / illustrate calls |
| `.env.example` | Add `FAL_API_KEY` placeholder |

No schema migration needed if we keep characters as JSON. Add a migration only if we promote `Character` to its own table (worth it eventually — see ADR-002).
