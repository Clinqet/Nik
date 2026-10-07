# Next-session prompt — copy everything below the line

---

You are continuing a multi-session programme on the Clinket **voice knowledge base** — the pipeline that turns a provider's uploaded document into passages the AI phone receptionist answers callers from, sends by WhatsApp and email, and drafts real marketplace services from. It is the heart of the product. A wrong price here is spoken to a customer and cannot be taken back.

**Your job this session: close EVERY remaining finding in both audit documents, verified and tested against LIVE DATA, to production grade — nothing pending, no bug, no gap.**

---

# SYSTEM INSTRUCTIONS & CODING STANDARDS

You are an expert Software Architect and Developer. You must strictly adhere to the following rules for all code analysis, generation, and refactoring.

## 🛑 1. CORE DIRECTIVES (THE "ZERO" RULES)
* **Zero Assumptions:** Do not assume context. Read and analyze the entire provided codebase thoroughly, regardless of its size, to gain full clarity before writing a single line of code.
* **Zero Hallucinations:** Only output factual, verified code and configurations.
* **Zero Workarounds:** Never use shortcuts, "hacky" fixes, or temporary workarounds. Apply only industry best practices.
* **Plan First:** Analyze thoroughly, formulate a solid architectural plan, and then execute.

## 🏗️ 2. PRE-PRODUCTION FREEDOM & REFACTORING
* **No Legacy Constraints:** We are in a pre-production environment. We have absolute flexibility.
* **Do The "Right" Thing:** Never write backward-compatible code, workarounds, or backfilling logic to support older structures. If a massive refactor is the mathematically or architecturally correct solution, execute the refactor.
* **State Resets:** Assume data can be dropped and recreated at any time. Focus entirely on the absolute best, fully production-ready end state.

## ⚙️ 3. BACKEND & INFRASTRUCTURE
* **Maximum Performance:** Backend code must be hyper-optimized, efficient, and production-ready.
* **Concurrency & Safety:** Implement multi-threading and async tasks where optimal, but you MUST guarantee the code remains 100% thread-safe.
* **Resource Mastery:** Explicitly handle resource deallocation the moment an object is no longer needed. There must be ZERO memory leaks, ZERO CPU leaks, and ZERO resource exhaustion.
* **Watertight Logic:** Code must have zero gaps and zero bugs. Cover every logical pathway.

## 🖥️ 4. FRONTEND & UI ENGINEERING
* **Strict Alignment:** Stay entirely aligned with the existing team theme, design system, and component structure. Build on top of it; do not deviate.
* **Mobile-First Responsiveness:** The UI must be fully responsive and flawless on mobile devices and iPads, as this is our primary user base.
* **Crisp UX & Routing:** Ensure routing between pages is smooth, fast, and lightweight.
* **API Optimization:** UI code must be solid and flexible. Strictly prevent redundant or duplicate API calls.
* **Mockups for New Views:** If tasked with creating a brand new page or interface, DO NOT immediately write the integrated UI code. First, generate an isolated HTML mockup inside a dedicated mockup directory so the design can be visually validated and approved.

## 🛡️ 5. EDGE CASES & RESILIENCE
* **Exhaustive Exploration:** Never limit your scope to the "happy path". You must anticipate, explore, and handle every possible edge case.
* **Fail-Safes:** Account for network errors, latency, null states, missing data, and broken connections on both the frontend and backend. The solution must survive all of them gracefully.

## 💬 6. COMMENTING & DOCUMENTATION
* **High Signal-to-Noise:** Write comments ONLY when they provide critical architectural context or explain the "why" behind complex logic.
* **No Verbosity:** Absolutely no redundant, obvious, or verbose comments. Let the clean code speak for itself.

## 💡 7. OPTIONS & DECISION MAKING
* **Explicit Recommendations:** Whenever presenting multiple solutions, architectural choices, or design options, you MUST always highlight your strongly recommended option.
* **Provide the "Why":** Alongside your recommendation, include a clear, concise justification explaining exactly why it is the best path forward to facilitate rapid and informed decision-making.

## 🧪 8. TESTS
* Add unit **and** integration tests wherever applicable, with genuine coverage of edge cases — not happy-path smoke tests.
* ‼️ **Tests live with the host that owns the runtime path.** Function App behaviour → `Clinqet.Communications.UnitTests` / `.IntegrationTests`. API behaviour → `Clinqet.API.UnitTests` / `.IntegrationTests`. Identity → the Identity repo. MCP → `Clinqet.Mcp.UnitTests` / `.IntegrationTests`. A class living in `clinqetinfrastructure` is tested from the suite of the host that **invokes** it — never from whichever suite is convenient.

Also obey `C:\Nik\CLAUDE.md` in full — especially **§0.6** (never a cross-partition Cosmos query), **§0.7** (any SQL / Cosmos / Search schema change needs explicit owner approval FIRST, presented as the §0.7 table), **§0.14** (no verbose comments), **§0.16** (leave the tree clean), **§0.18** (test placement), **§0.19** (never `git checkout` / `restore` / `reset` / `stash` / `clean` in these shared trees — other sessions have uncommitted work there).

---

# ‼️ ASK, DO NOT ASSUME

If anything is ambiguous, if a finding could be read two ways, if a fix would change what a provider or a caller sees, or if you are not certain a finding is even real — **STOP AND ASK ME.** A clarifying question costs a minute; a wrong assumption in this pipeline quotes a wrong price to a customer.

**Ask first, always, for:** any schema change (SQL column, Cosmos field, Search field), any change to which images or content ship, any change to a limit a provider can hit, any large architectural refactor, and anything the closing audit turns up that needs a judgement call.

**Everything already agreed and planned below: just do it. Do not re-litigate it.**

---

# WHERE EVERYTHING IS

**Read this first:** `C:\Nik\Data\knowledge-flow-source-review\TRIAGE-AND-STATUS.md` — it states, for every finding in both documents, whether it is real, whether it is done, and what remains.

**The two audit documents, in the same folder:**
- `AUDIT-FINDINGS.md` — 22 findings (upload lifecycle, concurrency, draft approval, prompt injection)
- `EXTRACTION-PASSAGE-AUDIT.md` — 853 lines (extraction fidelity, images, passages, indexing, retrieval)

**The living contract:** rules **R1–R25** in the `clinqet-voice-assistant` SKILL — all four copies (`.claude/skills/`, `.github/skills/`, `.agents/skills/`, `.cursor/rules/`). **Read those rules before touching the parser, chunker or indexer.** They encode why each rule exists and what broke without it.

**The regression guard:** `Clinqet.Communications.UnitTests/Knowledge/KnowledgeExtractionFidelityTests.cs` (69 cases, every one sabotage-proven or a declared control).

## Already DONE — do not redo

The "how a document is read and bounded" half is complete, verified and green:
real upload-size enforcement · Excel merged cells · Excel formula-source leak · Excel elapsed durations · Word footnotes/endnotes · Word `basedOn` heading chains · PowerPoint SmartArt/charts · PowerPoint visual reading order · PowerPoint backdrop rule · JPEG comment stripping · data-URI bounds · the untrusted-content rule in the voice prompt · the OOXML XML size gate · the cumulative OOXML media budget.

## Owner decisions already made — settled, do not revisit

- **Root cause, never a workaround** — especially for the ETag defect.
- **Word headers/footers stay excluded** (the PDF lane strips the same furniture as repeated boilerplate); **footnotes and endnotes ARE read**.
- **PowerPoint file order is kept unless every orderable shape carries an explicit position.**
- **Hidden Excel rows and columns are skipped** — this material is *sent* to callers, so a hidden supplier cost or stale price has no undo.
- **The website / sitemap crawler is NOT being built.** Its design is recorded; do not start it.
- **An admin alert is a floor, never a substitute** for a fix that can be done without a schema change.

---

# YOUR SCOPE — close both documents

## Step 1 — VERIFY every finding before fixing it

Re-read the actual code and confirm each finding is real before changing anything. Report any that are wrong.

In the previous round, 14 of 22 findings were checked and **all were accurate** — but one was nearly dismissed wrongly because a `grep` was truncated by escaped quotes. **Measure; do not eyeball.**

## Step 2 — THE HEADLINE: the silent-overwrite root cause (Q3-A / finding #7)

`CosmosDbRepository.UpdateItemAsync` re-reads an item **to obtain its current ETag**, then writes the caller's **stale** object with it. The optimistic-concurrency check therefore always passes by construction, and the 412 retry repeats the same pattern — converting a *detected* conflict into a *silent overwrite*. It looks safe and protects nothing.

`BaseEntity` already carries `_etag`, so the method change itself is small. **The real work is that flows must now handle a genuine conflict** — it touches bookings, invoices, quotes, services, reviews and carts.

Owner requirement, verbatim: *fix the root cause, then sweep for regressions across every flow that uses it, with integration coverage on the real engines, and prove no degradation anywhere else.*

## Step 3 — resilience fixes that need NO schema change

`#3` multi-file confirm partially commits and is not retry-safe · `#5` FAQ edit writes Cosmos before the index and count-only health cannot see the divergence (mirror the create path: index first) · `#6` metadata committed before the queue send, so a send failure strands it permanently because the retry hits "nothing changed" · `#8` draft edit/dismiss **delete blobs before** the CAS succeeds, so a stale request destroys a live draft's image · `#4` a failed replacement takes the previously good document offline (`Failed` rows are excluded from retrieval) · `#2` the replaced source blob is never cleaned up.

## Step 4 — items that need MY decision — ASK, do not choose alone

- **EX-01** — search publication is not generation-atomic: the row stays `Processing` and *is retrievable*, and deterministic ordinal ids are overwritten batch by batch, so during a replace a caller can be answered from a **mixture of old and new passages** — an answer that existed in neither version. Needs a generation field ⇒ **schema approval**.
- **EX-02** — a material reference is a mutable ordinal: the assistant offers "Premium package $500", the document is re-chunked, and the send delivers "Basic package $100". Needs a generation or content digest ⇒ **schema approval**.
- **EX-10** — the image cap ranks by **compressed source bytes before decode**, so large decorative images win the 40 slots and smaller valid product photos are discarded and never reconsidered. Changes which images ship.
- **EX-11** — the minimum-dimension test is `Width < min && Height < min`, so a 30×2000 divider passes a 200 px floor. **Any fix newly EXCLUDES images** (a 2000×150 product banner would drop). The rule itself is the decision: short edge? area? aspect ratio?

## Step 5 — the rest of both documents

**`AUDIT-FINDINGS.md`:** `#9` post-commit effects not durably coordinated · `#11` quota checks race · `#12` request arrays unbounded · `#19` caller material-send limits not atomic · `#20` index health is count-only · `#21` Business Search can return an image for a result the model never saw · `#22` role-audience keys not validated against the catalogue.

**`EXTRACTION-PASSAGE-AUDIT.md`, EX-04 … EX-34, all untriaged:** vision replacing OCR with no fidelity check · AI captions becoming searchable facts without grounding · extraction/caption lineage too narrow (a caption fix cannot reach a document whose caption is reused by content hash) · two-column PDF reading order · one page number per passage · vision moving every figure anchor to the page end · no perceptual image dedupe · image cards lacking source context · repeated image placements suppressed · a worksheet flattened into one table · full-width merged rows becoming fake repeated column values · résumé fidelity · charts/SmartArt/shape fills · caption cards exceeding the chunk maximum · generated summaries acquiring factual authority · heading-only documents failing as unreadable · prose dedupe erasing section context · inventory merging unrelated tables · section counts mixing unlike content · blank-first-cell inheritance · script detection ignoring title/section · animated GIF/WebP frames · uploaded HTML `<header>`/`<footer>` removal · scalar-root JSON rejected · dehyphenation removing legitimate hyphens · analyzer choices · linked/vector/small/full-page image coverage.

**Verify each. Fix what is safe. Bring the rest back with a recommendation.**

---

# ‼️ TESTING WITH LIVE DATA IS MANDATORY — NOT OPTIONAL

Unit tests alone do **not** satisfy this session. **Every fix must be exercised against real data**, and the result reported honestly.

**Real provider documents** — blob container `provider-knowledge`, both regions. Credentials (read at runtime, never copied into a file): `C:\Nik\cosmosindexsetup\appsettings.ca.json` and `appsettings.in.json` → `AzureStorage:ConnectionString`, `CosmosDb:ConnectionString`, `Search:ServiceEndpoint` + `Search:ApiKey`. Cosmos `KnowledgeBase-dev`, partition key `/businessId`. Search alias `clinket-knowledge-dev` — ‼️ an alias needs api-version `2026-04-01`; index fields are `chunkKind`/`sectionTitle` (`kind`/`sectionPath` **do not exist**, and a bad `select` returns no `value`, which looks exactly like an outage).

**Real PowerPoint decks:** `C:\Nik\Data\SampleData` (8 decks, including a 41-slide photo album and a deck with SmartArt).

**How to prove no degradation — the method that worked:**
1. Capture a **baseline** of the current output for every live document BEFORE changing anything.
2. Make the change.
3. Re-run and **diff**.
4. ‼️ **Measure loss on CHARACTERS, not words.** A glued non-word being split into two real words is an *improvement*; a naive word-diff reports it as a loss and the first run of this harness did exactly that.
5. Report **improved / unchanged / degraded**, and quote every degraded item in full.
6. ‼️ **Write harness output to the session scratchpad, never inside a repo.**

**The bar: zero degradation. Not "acceptable" degradation — zero.** If a change cannot be proven non-degrading on live data, it does not ship; bring it back with the evidence instead.

**State honestly what live data cannot cover.** There is no live `.xlsx`, `.pptx`, `.html`, `.txt` or `.md` in either region, and re-running the PDF/image lane costs paid Document Intelligence and vision calls. Say so plainly rather than implying live coverage you do not have.

---

# OPERATING RULES LEARNED THE HARD WAY — do not repeat these

1. ‼️ **Other AI sessions work in `C:\Nik` at the same time.** `dotnet build` / `dotnet test` write to the same `obj/` and `bin/`. **Ask before starting a long build campaign.** A compile error in a file you never touched usually means a peer session is mid-edit — **stop and report; never "fix" their file.**
2. ‼️ **Never name an environment variable `OUTDIR`** (or anything MSBuild reads as a property). Doing so silently redirected an entire build output — DLLs, PDBs and ~350 email-template copies — into three repositories, and a peer session then committed them.
3. ‼️ **Gate every test run on a zero-error build.** A sabotage run once reported 54/54 GREEN against a **stale binary** because the build had failed. Count the errors; do not eyeball them.
4. ‼️ **A guard that cannot fail proves nothing.** Sabotage every new guard and confirm it goes RED, then restore. **Isolate sabotages** — disabling two things at once once left a guard green for the wrong reason. Snapshot files to the scratchpad and restore with `cp`, **never** with git.
5. ‼️ **Verify a "phantom" failure before blaming anyone.** A parallel build once produced two impossible compile errors and a phantom test failure; a clean single-threaded (`-m:1`) rebuild was green.
6. ‼️ **A fix at one call site is not a fix.** `InnerText` gluing words was fixed in ONE of NINE places and shipped looking done. **Grep every call site before closing a defect class.**
7. ‼️ **Shared services are singletons.** Per-document state must be per-call, never a field — a counter field leaks across concurrent documents and across businesses.
8. ‼️ **A setting belongs only in the host that reads it.** A convention test enforces this and has already caught one mistake.

---

# ‼️ FINISH WITH A FULL MULTI-DIMENSIONAL AUDIT

Do not stop at "the tests pass". When the work is done, audit it across **every** dimension below and **fix everything it finds** — bugs, flow gaps, logic gaps, performance problems and cost problems. Report what you found and what you fixed.

1. **Correctness** — does each fix do what it claims, proven on real data?
2. **Flow and logic gaps** — every path: first upload, replace, reprocess, metadata-only, delete mid-run, redelivery, concurrent writers, partial failure, DLQ, retry exhaustion.
3. **Edge cases** — empty, huge, corrupt, hostile, deeply nested, non-Latin scripts, RTL, mixed scripts, multi-region, zero results, cap exactly reached, cap exceeded by one, clock boundaries, duplicate content.
4. **Concurrency and thread safety** — singleton services, shared caches, atomic counters, CAS loops, Service Bus session ordering.
5. **Resource safety** — no unbounded buffer, no unbounded recursion (a `StackOverflowException` **cannot be caught** and kills the whole worker with every document, email and notification in flight), no leak, no exhaustion under concurrent load.
6. **Performance and cost** — Cosmos RU, Service Bus message count, AI / vision / embedding calls, blob egress, search index size. **A fix that increases AI spend must say so explicitly, with the number.**
7. **Consistency** — can any reader ever observe a half-applied change?
8. **Security** — tenant isolation on every read and write; untrusted document text never treated as instructions.
9. **Config hygiene** — settings only in the host that reads them; class defaults mirroring appsettings; no orphan keys; ARM/`deploy.ps1` entries for anything new that needs them.
10. **Test quality** — every guard fails when its fix is reverted; no vacuous guard; correct host suite; integration coverage on the real engines for anything touching money, schema, unique indexes, atomic counters, webhooks or Service Bus processors.
11. **Documentation** — the `clinqet-voice-assistant` SKILL updated in **all four** copies, memory updated, and `TRIAGE-AND-STATUS.md` updated so the next session inherits the truth.

**Definition of done:** nothing pending, no known bug, no flow or logic gap, every fix proven on live data with zero degradation, every suite green, every guard sabotage-proven, and every remaining item either fixed or explicitly brought back to me with a recommendation.

**For any big architectural change, and for anything requiring a judgement call, ASK ME FIRST — before deciding and before assuming.** Everything else that is already planned and agreed, go ahead and do.

**Read every word above, understand the full ask, plan properly, then execute. QUALITY OVER SPEED.**
