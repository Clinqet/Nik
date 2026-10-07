# PHASE 1 PART 2 (P1.5) — Voice input · multi-script retrieval · and every open P1 audit item

You are implementing **Phase 1 Part 2 of the Business Search programme** for the Clinqet platform.
Planning is COMPLETE and OWNER-APPROVED. Do not re-plan and do not re-open settled decisions — build P1.5.

> ‼️ **PRECEDENCE:** `PLAN.md` **§18** is the authority for the voice/multi-script half and overrides every
> other sentence in every document, **including this one**. `AUTHORIZATION-DESIGN.md` §6b (C1–C6) and
> `PLAN.md` §15c (S1–S11) remain in force everywhere they apply. For the audit half, **§B below is the
> authority** — the owner answered every open item on 2026-09-02 and those answers are recorded in
> `findings/AUDIT-P1-2026-09-02.md` §13.
>
> ‼️ **Phase 1 is DONE and AUDITED.** `findings/AUDIT-P1-2026-09-02.md` **EXISTS** (491 lines, written
> 2026-09-02). An earlier draft of this prompt told you to check whether it existed and to stop if not —
> **that instruction is obsolete, delete it from your plan.** Read the file instead; §12 and §13 are the parts
> that change what you build.
>
> ‼️ **P1.5 runs now, BEFORE P2.**

---

## 0. READ FIRST, IN FULL, IN THIS ORDER

1. `C:\Nik\Data\provider-ai-search\PLAN.md` — **§18 entirely** (23 subsections; §18.21 is the gate list and
   §18.22 lists seven claims an earlier draft got WRONG — do not re-derive them). Plus §5.1, §7, §9b, §14.
2. ‼️ `C:\Nik\Data\provider-ai-search\findings\AUDIT-P1-2026-09-02.md` — **§12 (the truthfulness class),
   §13 (the owner's decisions), §6, §7 and §11.** This is half your scope. Read it before you plan.
3. `C:\Nik\Data\provider-ai-search\AUTHORIZATION-DESIGN.md` §6b — C1–C6.
4. `C:\Nik\Data\provider-ai-search\PHASE-2-PROMPT.md` — P1's own handover; the most accurate record of the
   wire contract P1 shipped.
5. `C:\Nik\.claude\skills\clinqet-business-search\SKILL.md` — the living contract for what already exists.
6. `C:\Nik\CLAUDE.md` — **in full**. §0 is zero-tolerance and overrides everything.
7. The approved mockup: `C:\Nik\Data\mockups\business-search-sources\index.html` — **owner-approved 2026-09-02**.
   It is the authority for how a cited source renders and for the no-download rule (§B1, §B2).
8. The code you will change, end to end, before touching it:
   - `clinqetinfrastructure\Services\AI\SpeechService.cs`
   - `clinqetapi\Clinqet.API\Controllers\AI\AIAssistantController.cs` (`speech-to-text`, ~line 222)
   - `clinqetshared\Enums\AudioLanguage.cs`, `clinqetshared\Models\AIAssistantSettings.cs`
   - `clinqetcore\Entities\AISearch\KnowledgeSearchDocument.cs` + `ServiceSearchDocument`
   - `cosmosindexsetup\KnowledgeSearchIndexInitializer.cs` (`FieldBuilder` at :110) + `Program.cs`
   - `clinqetinfrastructure\Services\Knowledge\ProviderKnowledgeSearchService(.Provider).cs`
   - `clinqetinfrastructure\Services\Knowledge\KnowledgeManagementService.cs` (`Language = null` at :816)
   - `clinqetinfrastructure\Services\Voice\ProviderCatalogSearchService.cs`
   - `clinqetinfrastructure\Services\BusinessSearch\**` (the whole folder — §B is mostly here)
   - Mobile callers: `clinqetmobilepartnerapp\apiManager\constant.tsx:132`, `hooks\useSpeechToText.ts`,
     `components\SpeechToTextButton.tsx`, `components\FloatingTextarea.tsx:262,280`
   - Web's **separate** enhancement path (never merge it): `clinqetwebpartnerapp\...\FloatingAIButtons.jsx:60-71`

---

## 1. ABSOLUTE RULES (breaking one fails the phase)

- **Approval gate**: §18 and §B are approved. If you find something that changes the DESIGN, stop and ask.
- **§0.7**: the ONLY approved schema changes are the two index changes in **§18.18** (knowledge: drop dead
  `language`, add `scripts`; services: **add** `scripts`). Anything else needs the §0.7 table and an explicit
  owner yes in your conversation. `inputMode` needs no gate — it rides the existing `Metadata` blob (§18.17).
- **Never** `git checkout/restore/reset/stash/clean` anywhere under `C:\Nik` — other AI sessions hold
  uncommitted work. **Never commit, never push** — the owner does that.
- **No feature flags, no shadow modes, no second engine selected by config.** One engine (§18.3b).
- **No stubs.** The mic works in all five languages by the end of the phase.
- **No hardcoded user-facing text** — keys in all 5 API + 5 web + 5 mobile files.
- **No hardcoded numbers** — every limit a dial with a mirrored class default (§18.16).
- **Every `IMemoryCache` write sets `Size`** (§18.12 — a size-less `Set` is a runtime 500).
- **Comments**: default none; one short line only for a non-obvious WHY.
- **Tests live with the runtime consumer (§0.18)**: this code runs in `Clinqet.API` ⇒
  `Clinqet.API.UnitTests` / `.IntegrationTests`. **Never** the MCP or Functions suites.
- **RED first, then green, then sabotage each guard once.**
- **Mockup gate**: `C:\Nik\Data\mockups\`, web **and** mobile, every state in §18.5, **owner-approved before any
  integrated UI code**. (The SOURCE-rendering mockup is already approved — see §0.7 above.)
- **Mobile mirrors web in this same session.**
- **Leave the tree clean (§0.16)** — delete every scratch file, inspect `git status`, say what you removed.

---

## 2. ‼️ THE SEVEN THINGS MOST LIKELY TO BE GOT WRONG

**(a) `ai/speech-to-text` is NOT dead code.** Mobile calls it in four places (§18.2). You are **moving those
call sites to the new route and then deleting the old one** — not deleting it out from under them.

**(b) The problem is cross-SCRIPT, not cross-language.** English reaches French (0.477) and Spanish (0.487)
perfectly. It fails on Gujarati (0.192). **Never add a query leg for a Latin-script language.**

**(c) The rule is "asked language + every alphabet the business uses"** — NOT "add English for non-English
questions" (§18.9). A three-alphabet business asking in **English** still needs three renderings.

**(d) Never auto-detect speech with an empty `locales` array** — that model's candidate list excludes `gu-IN`.
Always send the per-provider candidate list (§18.4).

**(e) Dictation is not enhancement.** The transcript comes back **verbatim** and is **never auto-sent**.

**(f) Every query leg carries the tenant filter AND the audience allow-list.** A leg without either is a
cross-business or cross-role leak. One test **per leg**, not one overall.
‼️ **P1 pushes the audience allow-list INTO the OData filter** (`search.in(docId, …)`) — see §12 C-6 of the
audit. Every new leg you add must carry that clause too. Copy the filter construction; do not rebuild it.

**(g) ‼️ THE TRUTHFULNESS CLASS — read `AUDIT-P1-2026-09-02.md` §12 before writing a line.**
P1 shipped a bug where a 3-row **sample** from a shared voice service was handed to the model as the complete
catalogue. Eleven instances of the same class were found and fixed. **P1.5 adds parallel query legs and a
merge — the single easiest place to reintroduce it.** The rule, stated once:

> **Anything partial, bounded, filtered, merged or failed must SAY SO in the payload. A capped list, a
> dropped leg, a timed-out facet, a partial merge — the model must be told, or it states the partial result
> as fact to the business's own team.**

Concretely for this phase: if a query leg fails or times out, the answer must say the search was partial —
**not** silently return the surviving legs as if they were the whole search.

---

## 3. WHAT TO BUILD — PART A: voice input + multi-script (in this order, §18.19)

1. **Add `scripts` to BOTH indexes** (`Collection(Edm.String)`, `IsFilterable`, `IsFacetable`) and run
   `cosmosindexsetup` **in both regions**. Additive ⇒ no rebuild, nothing breaks.
   ‼️ `cosmosindexsetup` **ignores the shell's `CLINKET_REGION`** — **always `--launch-profile`**.
2. **Script detector** (§18.11) — Unicode range count, no AI. ‼️ **Gurmukhi U+0A00–0A7F sits directly below
   Gujarati U+0A80–0AFF** — pin both boundaries with real characters. Threshold dials.
3. **Populate `scripts`** — knowledge chunks from `content`; services from **name + description**.
   **No backfill** (owner-confirmed, pre-prod).
4. **Alphabet set + cache** (§18.12) — faceted query per index, union, in-memory with `Size`, keyed **per
   business**, invalidated on ingest/re-ingest/delete, fail-open on retrieval but **never** on tenancy.
   ‼️ **§18.12a is a hard requirement, not advice.** This lookup is needed **before the first model call**
   (the tool schema ships with that request), so it cannot be hidden behind the turn. **Warm it
   fire-and-forget when the session/page opens** so the ask path costs **0 ms**; a cold miss runs both facets
   in **one `Task.WhenAll`** under `LookupTimeoutMs` (250) and **on timeout proceeds with
   `[asked script, Latn]`** rather than waiting. **Single-flight** it — concurrent asks from several members
   of one business must cause **one** lookup, not N. Cache negative results too. Assert in the audit: the warm
   path issues **no** search call.
5. **Dynamic tool schema** (§18.13) — per-request named required scalar fields, one per alphabet; server-side
   script verification of every returned string, one bounded retry, then partial-leg fallback + counter.
   ‼️ A partial-leg fallback is a **partial search** — say so in the payload (§2g).
6. **Parallel retrieval** (§18.10, §18.14) — one `SearchAsync` per rendering via `Task.WhenAll`, merge by
   chunk id keeping max score, `MaxQueryLegs` cap, a failed leg never fails the answer.
   **A Latin-only business must issue exactly ONE search** — assert it.
   ‼️ Every leg carries the tenant filter **and** the audience `search.in(docId, …)` clause (§2f).
7. **Structured tools** (§18.15) — `relativeRange` enum computed **server-side** in the business time zone;
   exactly one of enum vs explicit dates; member names resolved to ids, **server-validated**, and **the answer
   names the member it used**.
8. **Engine migration** — `SpeechService` from the real-time SDK to **Fast Transcription** REST
   (`POST https://…/speechtotext/transcriptions:transcribe?api-version=2025-10-15`, multipart, `locales`
   always populated), via `IHttpClientFactory`. If the resource endpoint cannot be derived from `Region`, add
   `Speech:Endpoint` to appsettings **+ ARM + `deploy.ps1`** in this change. Leave `SpeechTranslationConfig` /
   `EnableTranslation` alone — if it looks orphaned, **report it, do not delete it**.
9. **New route** `POST api/v1/speech/transcribe`, permission **`ai.assistant.use` unchanged**; move mobile's
   four call sites; **delete `ai/speech-to-text`**.
10. **Web dictation client** (new) + **mic and language-correction chip in the ask box on both apps**, all
    states in §18.5, localized ×15.
11. **Analytics** — `inputMode`, detected locale, transcript-edited, leg count, inside `Metadata` (§18.17).
12. ‼️ **MANDATORY — DELETE the `language` property from `KnowledgeSearchDocument`**, delete the
    `Language = null` write at `KnowledgeManagementService.cs:816`, and delete every other reference.
    **The owner does NO code changes — if you don't remove it, it never gets removed.** Leaving it is a failed
    phase and a §22.2 dead-code violation. After this the column still exists in the *live* index, unwritten
    and harmless; that is expected, not a defect.
    ‼️ **You do NOT delete or recreate any index.** The owner recreates the **knowledge** index later on their
    own schedule. **P1.5 must be complete, green and shippable without that ever happening** — no test may
    depend on it.
    ‼️ **THE SERVICES INDEX IS NEVER DELETED BY ANYONE.** `ServiceSearchDocument` backs the **customer-facing
    marketplace search**. It is only ever **extended** (no rebuild). Deleting it takes customer search down.

---

## B. WHAT TO BUILD — PART B: the open P1 audit items (owner-decided 2026-09-02)

> Authority: `findings/AUDIT-P1-2026-09-02.md` §13. Every one of these has an owner answer. **None is
> optional and none needs a further decision.**

### B1 ‼️ No download link anywhere — remove `view-url`, add "Show text" (audit O3, O7)

**Owner decision, verbatim in intent:** *never give any link to download the document; cite it as a source
with the page number when known.* Approved against the mockup at
`C:\Nik\Data\mockups\business-search-sources\index.html`.

- **DELETE** `GET api/v{version}/business/search/documents/{docId}/view-url`, its DTO
  (`BusinessSearchDocumentViewDto`), `IBusinessSearchDocumentService.GetViewUrlAsync` and its implementation,
  the `DocumentViewSasMinutes` dial, and `IAzureStorageService.TransformToViewUrl` **if nothing else uses it**
  (check first — §0.16: never clobber a shared seam).
  ‼️ Removing it also closes audit **O7** (a minted SAS outliving revoked access): with no link minted, there
  is nothing to expire. Say so in the audit.
- **ADD** `GET api/v{version}/business/search/documents/{docId}/text` — same authorization as the page
  endpoint (`business.profile.read` + the per-document audience rule + canonical-id check), returning the
  extract already stored at ingest. **No new storage, no new blob, no egress.**
- The card rules are in the mockup §06 and are **binding**: page number **only** when genuinely paginated
  (PDF · images · PPTX); Word shows the section, Excel the sheet name, FAQ nothing to open, service/offer
  links to the record.
- ‼️ **Do not invent a page number for a non-paginated type.** P1 already strips the placeholder; keep it.

### B2 One excerpt renderer (audit O2, S3)

Reuse `MaterialExcerptBuilder` so the passage a provider reads on screen and the excerpt a caller is sent are
formatted by the **same** code. Its useful members are private/internal and only `Build(...)` is public —
either use `Build(...)` or widen the surface **deliberately, with the reason stated in a comment**. Mockup §04
shows the before/after.

### B3 ‼️ A permission refusal must not read as "nothing found" (audit O5 — MOVED TO P1.5)

The owner asked whether this needed fixing sooner than P3. **It does, and here is why:** three Group A tools
already ship with permissions — `search_services` (`catalog.service.read`), `list_offers`
(`catalog.offer.read`), `get_availability` (`availability.read`) — and **dispatcher, technician, finance and
contractor do not hold `catalog.offer.read`; finance does not hold `availability.read`.** Gate 1 drops the
tool from the model's list entirely, so nothing downstream knows the question was asked, and the model answers
with rule 3: *"I couldn't find anything in your business's information."* **That is a false statement to a
member about their own business** — the truthfulness class (§2g), live today.

Fix: tell the model, in the system prompt for that request, which topics this member cannot reach and the
exact localized sentence to use. New keys in all five API files. **Do not** simply re-offer the tool.

### B4 Close the remaining §7 items

- **`tokensUsed: 0`** — `AiSession.TotalTokensUsed` is permanently zero for Business Search. Either plumb the
  real figure (the agent has it) or remove the dead parameter. Do not leave it lying.
- **A partial answer is persisted with no truncation marker**, so a follow-up replays half a sentence as if it
  were the finished answer. Mark it. (Related to O1, which the owner closed — this is the *storage* half, and
  it is a truthfulness-class defect in its own right.)
- **`: ping` keep-alive frames have no test.** Add one.
- **No controller-level SSE round trip against a fake model server.** Add one: stub
  `IBusinessSearchModelClient` in `ClinqetApiFactory` and prove `Meta → Status → Citation → Delta → Done`
  through the real HTTP endpoint. Today the factory points the API at an unresolvable AI host, so **no
  integration test has ever exercised a successful answer end to end.**
- **`IsSolo` costs a live roster read on every ask and nothing consumes it.** Either consume it or stop
  paying for it.
- **The flaky test** `ProviderSetupUsageCounterCosmosIntegrationTests.TwentySimultaneousIncrements_LoseNothing`
  — failed once under full-suite parallelism, passed alone and on a re-run. Not Business Search code. §0.8
  says a flaky test is a broken test: harden it.

### B5 ‼️ Carry the truthfulness class forward

Read `AUDIT-P1-2026-09-02.md` §12 in full. Then, in **this** phase:

- Apply §12.6's rule to every new seam P1.5 introduces — especially the **parallel-leg merge** and the
  **alphabet-set cache timeout**, both of which produce partial results by design.
- **Extend the exhaustiveness guard.** P1 added a `[Theory]` over `Enum.GetValues<VoiceCatalogOutcome>()` that
  fails on any unhandled value. If P1.5 consumes another pre-existing service with a result enum, add the
  same guard for it.
- ‼️ **Build a fixture for EVERY outcome value, not only the happy one.** The P1 bug survived because every
  mock returned `Matches` or empty — **the tests inherited the code's blind spot.**

### B6 ‼️ The OCR page-cache key is built from two independently configured copies (audit §10 N1)

`Voice:Knowledge:Vision:TranscribeDeploymentName` and `TranscribePromptVersion` are read by **two hosts, from
two appsettings files, in two repositories**: the API builds the blob key to **READ** a cached page, and the
Functions host — the only **WRITER** — builds it to store one. The class comment tells the next engineer to
bump `TranscribePromptVersion` when the prompt changes.

**Bump it on one side only and every cached page becomes unreadable.** The miss path is `LogDebug` +
`return null`, so nothing alarms: every "Show page N" silently degrades to a fallback, forever, and the first
symptom is a provider saying the feature "stopped working".

‼️ This matters MORE after §B1, because "Show page N" becomes the **primary** action on a cited PDF.

**Do:**
1. Stamp **both** values from ONE source in `deploy.ps1` so the two hosts cannot drift.
   (`Voice__Knowledge__Vision__TranscribeDeploymentName` is already stamped on both hosts;
   `TranscribePromptVersion` is **not** — that is the open half.)
2. Add `Voice__Knowledge__Vision__TranscribePromptVersion` to `$script:RequiredFunctionAppSettings` as well
   as the API manifest. Audit §10 notes the asymmetry: the host that WRITES the cache is the one not verified.
3. Raise the cache-miss log above `Debug` so a drift is visible instead of silent.
4. A test that a read key and a write key built from the same settings are byte-identical.

---

## C. CARRIED FORWARD — owner-mandated, NOT built in this phase, and must not be lost

### C1 ‼️ Two new Group B tools the owner called "must and super important" (audit O4)

**Call follow-ups** (the phone receptionist's own call summaries — the most natural provider question there
is) and **refund requests**. `PLAN.md` §4.0 excluded six dashboard surfaces; that was the **planner's**
decision and appears nowhere in §15. The owner has now ruled: **these two are in scope.** The other four
(billing, ai-billing, activity, notifications) stay out.

**They are NOT built in P1.5.** They are Group B tools — permission-gated, `WorkListNarrowing`-bounded, with
the whole Group B shape — and that is what **P3** exists for. Adding them here would bloat a phase already
carrying voice, multi-script and six audit items.

‼️ **Your obligation in this phase is to make them impossible to lose:**
1. Record them in the **P1.5 DELTA** section you append to `PHASE-2-PROMPT.md` (§6.3), under a clear
   "carried to P3" heading.
2. State them again in your own `findings/AUDIT-P1.5-<date>.md` under "did we miss anything the owner asked
   for", as **carried, not done**.
3. If you are the session that writes `PHASE-3-PROMPT.md`, they are a **required** part of its scope.

**A carried item that appears in no downstream prompt has been dropped, not carried.**

### C2 Open but not blocking

- **Audit O9** — whether `search_services` should read the AI Search index instead of the Cosmos leg. The
  dial `BusinessSearch:ServiceLookupSource` exists and defaults to `Cosmos` (today's behaviour). This is a
  measurement, not a decision. Measure it only if §5's five gates leave room.
- **`get_business_profile` returns more than `AUTHORIZATION-DESIGN` C5 enumerates** (adds email, phone,
  description, listed, onlineBookings, defaultLocation, hasKnowledgeDocuments). No licence numbers, and it is
  the business's own data shown to its own team. **Kept unless the owner objects** — do not "fix" it silently.

---

## C3. ‼️ COMPLETENESS CHECKLIST — every P1 audit item, and where it goes

Tick every row before you report done. **A row with no home is a dropped finding.**

| Audit item | Owner decision | This phase? |
|---|---|---|
| O1 replayed answer prose | NOT a defect | Closed — no action |
| O2 shared excerpt renderer | Approved | **§B2** |
| O3 no download link, "Show text" | Approved, stronger than proposed | **§B1** |
| O4 call follow-ups + refund requests | Must-have | **§C1 — carried to P3** |
| O5 refusal reads as "nothing found" | Fix, and move it earlier | **§B3** |
| O6 solo → first hire | NOT a bug | Closed — no action |
| O7 SAS not revocable | Dissolved by O3 | Closed by §B1's removal |
| O8 `Voice:Catalog` divergence | Re-derived from call sites | **Already applied in P1** — verify, do not redo |
| O9 service index unused | Dial shipped, default unchanged | **§C2** — optional measurement |
| §7 eight un-namespaced test ids | — | **Already fixed in P1** |
| §7 `tokensUsed: 0` | — | **§B4** |
| §7 partial answer stored unmarked | — | **§B4** |
| §7 `: ping` untested | — | **§B4** |
| §7 no end-to-end SSE round trip | — | **§B4** |
| §7 `IsSolo` read but unused | — | **§B4** |
| §7 profile projection wider than C5 | Kept | **§C2** |
| §7 F-1 flaky provider-setup test | — | **§B4** |
| §12 the truthfulness class (11 instances) | — | **Fixed in P1; §B5 carries the RULE forward** |
| §10 N1 page-cache key drift across two repos | — | **§B6** |
| §5 + §10 refuted claims (7) | — | **§C4 — do not re-raise** |
| §8 committed secrets | Owner: **sandbox credentials, closed** | No action |
| §2 H1–H6, §3 M1–M17, §4 T1–T6, §11 | — | **Already fixed in P1** — verify, do not redo |
| §9 verified-as-holding (C1–C6, S1/S2/S11, partitioning, §0.18) | — | **Do not regress**; re-assert in your audit |

## C4. ‼️ ALREADY REFUTED — do NOT re-raise, and do NOT "fix" these

Audit §5 and §10 disproved these with evidence. Re-opening them wastes the phase; "fixing" some of them
would BREAK something. If your own audit surfaces one, cite the refutation and move on.

| Claim | Why it is wrong |
|---|---|
| The five `Voice:Knowledge` retrieval keys are orphans — remove them | **All five are read** by `ProviderKnowledgeSearchService`, which the API host instantiates for Business Search |
| The four `ChatInteractionType_*` localization keys are orphans | **Bound by `[Display(Name = ...)]`** on an enum that is a persisted Cosmos property. Deleting them breaks the Display contract |
| `GetBusinessCountAsync` / `GetMemberCountAsync` are dead interface surface | They are the **production pre-check** for the daily caps (audit H4) |
| `Voice:Catalog` does not exist in the API appsettings | It exists with **18 keys**. That report was ~2h stale |
| `RequestsPerWindow` was lost / falls back to 30 | It was present at 6, and has since been **deliberately removed** as a genuine orphan — the burst dial is `BusinessSearch:Limits:QuestionsPerMinute` |
| `TranscribeDeploymentName` has no `deploy.ps1` mapping | It has **four**. (`TranscribePromptVersion` is the one that does not — see §B6) |
| Business Search introduced committed secrets | `git log -S` dates them to 2026-08-07, before this programme — **and the owner has confirmed they are SANDBOX credentials. Closed, no action.** |

---

## 4. TESTS OWED

**`PLAN.md` §18.23 is the checklist — every line of it.** Script boundaries (Gurmukhi/Gujarati especially),
alphabet-set caching and invalidation, tool-schema arity 1/2/3, wrong-script retry and fallback, parallel-leg
merge, **tenant filter AND audience clause on every leg**, voice states, quota parity between voice and typed,
date enum both ways, unknown-person rejection, and the two regressions: existing mobile dictation, and the
phone receptionist's knowledge path unchanged.

**Plus §B's own tests**: the removed `view-url` route returns 404; `documents/{docId}/text` honours the
audience rule (restricted member ⇒ not found, named role ⇒ served, owner ⇒ served); the shared excerpt
renderer produces identical output for the provider and the caller path; a permission-refused topic produces
the fixed refusal and **never** the "nothing found" copy; the `: ping` frame; the end-to-end SSE round trip.

Build affected projects; 100% pass; ESLint zero errors on both apps.

---

## 5. ‼️ MEASURE THE FIVE UNPROVEN THINGS BEFORE SHIPPING (§18.21)

The owner's standard is **no degradation in any language, in any scenario**. These are gates, not footnotes:

1. The **three-field** tool shape (25/25 was measured at **two** fields).
2. **Parallel-merge on the live index** (planning measured raw embedding cosines only).
3. **Fast Transcription latency + accuracy on `gu-IN`/`hi-IN`** with real speech.
4. Whether **3 legs dilute or improve top-K** versus 2 on real documents.
5. Re-measure §18.8's numbers against the live index rather than the standalone embeddings.

Write the numbers into the audit. A P1.5 that ships without them has failed.

---

## 6. HOW THIS PHASE ENDS — three deliverables

1. **The code, green**, on **real rebuilds** (`--no-incremental`; a `--no-build` pass is not evidence, and a
   restored file does not always rebuild — this cost P1 a confusing half-hour twice).
2. ‼️ **`findings/AUDIT-P1.5-<date>.md` — audit your OWN work.** Full multi-dimensional audit, dimensions per
   `PLAN.md` §14: correctness & contracts · tenant isolation and authorization · data safety & idempotency ·
   cost & performance · memory/resource leaks & thread safety · config hygiene · localization ×15 ·
   web/mobile parity · tests (placement §0.18, fail-first evidence, sabotage) · deployment & infrastructure ·
   UI/UX against the approved mockup · **did we miss anything the owner asked for**.
   ‼️ **Add one dimension P1 did not have, because its absence is exactly why P1 shipped a bug:**
   **"REUSED-SERVICE SEAMS — for every pre-existing service this phase calls, enumerate every state it can
   return and prove each one is handled."** See §12.2 of the P1 audit for what it costs to skip it.
   Every finding fixed or explicitly refuted with evidence. Audit this phase's own risks by name: the five
   measurements above; no cross-business or cross-role leak through any leg, the audio, or the transcript; no
   regression to existing mobile dictation or to the phone receptionist; no PII in logs; the common English
   case no slower than P1.
   **The phase is not done until this file exists.**
3. ‼️ **The Phase 2 prompt.** `PHASE-2-PROMPT.md` **already exists — P1 wrote it. DO NOT overwrite it**
   (§0.16: check before you clobber). **Append a clearly-marked "P1.5 DELTA" section** covering what P2's UI
   work must now account for: the mic + language-correction chip already in the ask box on both apps,
   `language` on the ask body now sometimes the **spoken** language rather than the UI locale, the analytics
   fields added, the **removal of `view-url` and the new `documents/{docId}/text` endpoint**, the source-card
   rules from the approved mockup, and any UI state P1.5 introduced. Then **paste that delta text into the
   chat reply** and give the owner the **file path**, a short summary of what changed, and confirmation that
   the recording standard is unchanged — a file path alone is not delivery (owner-mandated).

Then update the affected `SKILL.md` ×4 (`clinqet-business-search`, `clinqet-ai-assistant`, `clinqet-knowledge*`,
`clinqet-provider-mobile`) and the memory index (§0.9).
