# VOICE RECEPTIONIST — THE ANSWER LADDER

**Program plan · authored 2026-08-17 · status: ‼️ OWNER-APPROVED FOR IMPLEMENTATION 2026-08-18 — all
decisions (D1–D31), the §11 schema table (including the `KnowledgeBase` container on `/businessId`), and
the mockup (rev 4 + the AI-setup nudge) are APPROVED. Execution runs in THREE PHASES (§10): Phase 1
everything-except-MCP → Phase 2 the MCP surface → Phase 3 full end-to-end audit; every phase ends with a
multi-dimensional audit of its own output and writes the next phase's copy-paste prompt file.**

This document is the single source of truth for this program. It carries everything explored, every
decision the owner locked and why, and the full end-to-end implementation design for every move.
A future session must be able to execute from this file alone.

- Companion mockup (built, awaiting owner approval): `C:\Nik\mockups\voice-knowledge-base\knowledge-base.html`
  *(revised 2026-08-18: **multi-file upload unified on BOTH platforms** — mobile's picker already supports
  `allowMultiSelection`, so mobile is no longer one-by-one; the §7.11b validation contract is embedded in the
  mockup; a **responsive proof frame** shows the SAME web page at phone width — web must be flawless on
  phones and iPads)*
- Companion artifact (owner-facing summary): https://claude.ai/code/artifact/cc22a5fb-6880-49b4-9ef8-24a65622208f
- Memory entry: `voice-out-of-scope-answers-design-2026-08-16.md`
- Living contract to update at the end: the `clinqet-voice-assistant` SKILL (all four AI-tool copies)

---

# 0. MANDATORY STANDARDS — READ BEFORE ANY CODE

## 0.1 Owner's system instructions & coding standards (verbatim, non-negotiable)

> # SYSTEM INSTRUCTIONS & CODING STANDARDS
>
> You are an expert Software Architect and Developer. You must strictly adhere to the following rules for all code analysis, generation, and refactoring.
>
> ## 🛑 1. CORE DIRECTIVES (THE "ZERO" RULES)
> * **Zero Assumptions:** Do not assume context. Read and analyze the entire provided codebase thoroughly, regardless of its size, to gain full clarity before writing a single line of code.
> * **Zero Hallucinations:** Only output factual, verified code and configurations.
> * **Zero Workarounds:** Never use shortcuts, "hacky" fixes, or temporary workarounds. Apply only industry best practices.
> * **Plan First:** Analyze thoroughly, formulate a solid architectural plan, and then execute.
>
> ## 🏗️ 2. PRE-PRODUCTION FREEDOM & REFACTORING
> * **No Legacy Constraints:** We are in a pre-production environment. We have absolute flexibility.
> * **Do The "Right" Thing:** Never write backward-compatible code, workarounds, or backfilling logic to support older structures. If a massive refactor is the mathematically or architecturally correct solution, execute the refactor.
> * **State Resets:** Assume data can be dropped and recreated at any time. Focus entirely on the absolute best, fully production-ready end state.
>
> ## ⚙️ 3. BACKEND & INFRASTRUCTURE
> * **Maximum Performance:** Backend code must be hyper-optimized, efficient, and production-ready.
> * **Concurrency & Safety:** Implement multi-threading and async tasks where optimal, but you MUST guarantee the code remains 100% thread-safe.
> * **Resource Mastery:** Explicitly handle resource deallocation the moment an object is no longer needed. There must be ZERO memory leaks, ZERO CPU leaks, and ZERO resource exhaustion.
> * **Watertight Logic:** Code must have zero gaps and zero bugs. Cover every logical pathway.
>
> ## 🖥️ 4. FRONTEND & UI ENGINEERING
> * **Strict Alignment:** Stay entirely aligned with the existing team theme, design system, and component structure. Build on top of it; do not deviate.
> * **Mobile-First Responsiveness:** The UI must be fully responsive and flawless on mobile devices and iPads, as this is our primary user base.
> * **Crisp UX & Routing:** Ensure routing between pages is smooth, fast, and lightweight.
> * **API Optimization:** UI code must be solid and flexible. Strictly prevent redundant or duplicate API calls.
> * **Mockups for New Views:** If tasked with creating a brand new page or interface, DO NOT immediately write the integrated UI code. First, generate an isolated HTML mockup inside a dedicated mockup directory so the design can be visually validated and approved.
>
> ## 🛡️ 5. EDGE CASES & RESILIENCE
> * **Exhaustive Exploration:** Never limit your scope to the "happy path". You must anticipate, explore, and handle every possible edge case.
> * **Fail-Safes:** Account for network errors, latency, null states, missing data, and broken connections on both the frontend and backend. The solution must survive all of them gracefully.
>
> ## 💬 6. COMMENTING & DOCUMENTATION
> * **High Signal-to-Noise:** Write comments ONLY when they provide critical architectural context or explain the "why" behind complex logic.
> * **No Verbosity:** Absolutely no redundant, obvious, or verbose comments. Let the clean code speak for itself.
>
> ## 💡 7. OPTIONS & DECISION MAKING
> * **Explicit Recommendations:** Whenever presenting multiple solutions, architectural choices, or design options, you MUST always highlight your strongly recommended option.
> * **Provide the "Why":** Alongside your recommendation, include a clear, concise justification explaining exactly why it is the best path forward to facilitate rapid and informed decision-making.
>
> ## 8. Test cases
> * ** Add the unit and intigratino tests where it is applicable so function app should be added inside the function app not in the api and this is same for all identity, API, function app, and mcp api and make sure good coverage and cover all the edge case in it as well

## 0.2 Platform rules that bite this program specifically

`C:\Nik\CLAUDE.md` governs in full. The clauses this program touches most:

| Rule | What it means here |
|---|---|
| **§0.7 schema approval** | The new search index, the new Cosmos document family + fields, the new blob container, the new queue — **all require an owner-approved table BEFORE any code or migration.** A plan saying "add X" is NOT approval. §11 pre-fills the table. |
| **§0.7.1 mockup gate** | The Knowledge page mockup must be owner-approved before any integrated UI code. **Mockup is built** (path above) — approval still outstanding. |
| **§0.7.1 mobile mirrors web** | Provider mobile ships the Knowledge screen in the **same session** as provider web. Parity = matching rendering rules, not a same-named component. |
| **§0.10 localization** | Every provider-facing and caller-facing string is a key in `en.json` **and every other language file**. No inline English. |
| **§0.6 no cross-partition Cosmos** | Every knowledge registry read/write passes `businessId`. |
| **§0.12 settings not constants** | Every cap, threshold, model name, and toggle is an appsettings value with class defaults mirroring it. |
| **§0.14 comments** | Default is NO comment. Only a terse WHY/invariant earns a line. |
| **§0.15 / §0.17 test isolation** | A test may only read its OWN repo. Never add a peer-repo checkout to CI. |
| **§0.18 test placement** | A library class is tested from the **host suite that invokes it at runtime**. Full map in §9. |
| **§0.16 leave the tree clean** | Delete every scratch file. Never write scratch inside a repo. `git status --porcelain` must be clean of them. |
| **§14 IMemoryCache** | Every cache write sets `Size = 1`. The convention test will fail the build otherwise. |
| **§25** | Any new Azure resource or `local.settings.json` key → ARM + `deploy.ps1` in the SAME change. |

---

# 1. WHY THIS PROGRAM EXISTS

## 1.1 The failure that started it

Internal test call. An equipment-rental provider with ~800 machines. Sequence:

1. Caller: *"I'm looking for a small excavator."* → **worked.** Catalog is over the 60-item embed threshold, so the
   call runs in **Map mode**; `find_services` keyword-searched and returned matches.
2. Caller: *"Send me those machines on WhatsApp."* → **worked.** `send_service_info` delivered the pages.
3. Caller: *"Great — but I need ones that can dig 50 feet."* → **FROZE.** The AI could not act.

## 1.2 Root cause — three stacked gaps, not one bug

**Gap A — the prompt muzzles the model.** `RealtimeSessionPayloadBuilder.BuildInstructions`
(`clinqetinfrastructure\Services\Voice\RealtimeSessionPayloadBuilder.cs`) contains:

- line ~377: *"NEVER invent or guess prices, availability, services, the caller's name, or phone digits."*
- line ~378: *"Never reveal information about other customers, full contact details, **or anything not in the profile below**."*

The second clause was written for **privacy** but reads to the model as a **total knowledge ban**. And
`CatalogTools.FindServices`' `[Description]` says *"Pass the caller's own words as query."* So the model did
exactly as instructed: searched the literal string "dig 50 feet". The model **already knows** that a 50-foot
dig depth implies a long-reach excavator class — we forbade it from using that knowledge.

**Gap B — search structurally cannot answer a spec question.** `ProviderCatalogSearchService` is BM25 over
`serviceName, searchKeywords, synonyms, commonSearchPhrases, subcategoryName, userIntentPhrases,
categoryName, broadMatchTerms, alternativeNames, tags, serviceDescription`, with a vector leg on empty
result. **No keyword or embedding search performs numeric comparison.** A machine whose description says
"52 ft max dig depth" will never match a query for "50 feet". Worse, `LookupSummaryMaxChars = 160` clamps
each returned summary, so even retrieved machines often lose the spec text.

**Gap C — nothing can reason over the catalog.** Answering needs something to read the FULL descriptions of
candidate machines and judge which meet a requirement. Today: the realtime model sees at most
`LookupMaxResults = 5` clamped rows, and no server-side reasoning step exists.

## 1.3 The generalisation — this is not an excavator problem

The owner's key challenge: the platform serves 300+ categories — dentists, carpenters, fence companies,
mechanics, salons. The design must work for all of them with **zero industry-specific code**.

The resolution: **stop designing for business types; design for question types.** Across every trade,
callers ask exactly five kinds of question, and each has exactly one correct answerer:

| Kind | Examples across trades | Answered by |
|---|---|---|
| **1. A fact the provider listed** | "how much is a cleaning?" · "do you do brake jobs?" · "price for 6-ft cedar?" | Embedded profile / `find_services` — **exists today** |
| **2. A requirement, not a name** | "my kid is terrified of the drill" · "car shakes at highway speed" · "keeps a husky in" · "digs 50 feet" | **Move 1** (translation) + **Move 2** (expert check) |
| **3. General trade knowledge** | "does whitening damage enamel?" · "how often should brakes be checked?" · "cedar or vinyl?" | **Move 1** — the model's own expertise, hedged |
| **4. Provider-specific, not in the catalog** | "do you take Delta Dental?" · "do you use OEM parts?" · "licensed for pool enclosures?" | **Move 3** — the knowledge base |
| **5. A current external fact** | "is there a government rebate this year?" | **Nothing** — take a message (Move 4 DROPPED) |

Two consequences worth internalising:

- **Kind 4 is the argument against web search.** "Do you take Delta Dental?" can never be answered by any
  search engine — only by the provider. This is why every serious voice platform standardised on
  per-business knowledge bases, and why Move 3 is the real end-game.
- **Kind 2 includes triage.** "My car shakes at highway speed" → model's general expertise suggests
  balancing/alignment → maps to that shop's listed services → books the inspection. Same mechanism as the
  excavator, different trade, zero new code.

---

# 2. WHAT WE EXPLORED AND VERIFIED

Everything in this section was verified on **2026-08-16/17**. Do not re-research it.

## 2.1 There is no built-in browsing on any realtime surface

- **Azure OpenAI GPT-Realtime and OpenAI Realtime**: the only extension mechanisms are **function calling**
  and **remote MCP servers**. No web search, no browsing, no grounding tool.
  (https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio)
- Azure's `web_search` tool exists **only on the Responses API** (text models), powered by Bing grounding.
  (https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/web-search)
- Realtime session hard limits: **32,000 input tokens, 4,096 output tokens, 60-minute max session.**
- Contrast (informational only): Google's Gemini Live API *does* have built-in Search grounding and
  non-blocking async function calls. Not relevant — we are not migrating off Azure.

## 2.2 Azure Voice Live API — evaluated and rejected for this purpose

Voice Live is Microsoft's separate managed voice-agent product
(`wss://<resource>.services.ai.azure.com/voice-live/realtime`), GA since Oct 2025.

| Finding | Consequence |
|---|---|
| **Model mode has NO web search** — tools are function calling + remote MCP, identical to what we run | Migrating buys **nothing** for this problem |
| **Agent mode** (bind a Foundry Agent) reportedly does run Bing grounding in voice — but only at *forum-moderator* evidence level, no official per-tool matrix | Unverifiable dependency |
| **Agent mode is NOT available in `canadacentral` or `centralindia`** (regions table, updated 2026-07-28) | Our two stamps cannot use it at all |
| **Agent mode ignores session `instructions`** | Our entire per-call first prompt (embedded profile, owner's standing instructions, caller-ID handling) would stop applying |
| Agent invocation is **Entra-ID only** | Our per-call bearer-token pattern dies |
| **"SIP is currently not supported"** | We lose the Azure OpenAI SIP connector; Telnyx would need ACS in front or a hand-built SIP→WSS gateway. Telnyx and Plivo are not among its supported audio connectors |
| Models top out at **`gpt-realtime-1.5`** (no `-2`/`-2.1`) | Premium tier regresses |
| Verified Pro text rates ~10% above raw AOAI, with far worse cache pricing ($1.375 vs $0.40 per 1M) | Costs more |

**VERDICT: rejected.** *One genuine nugget for a different program:* Voice Live's
`azure_deep_noise_suppression`, Hindi-aware multilingual semantic VAD with filler-word removal, and
Indian-accent native voices could justify a **contained model-mode experiment behind the existing Plivo WSS
relay** if India audio quality ever becomes the driving problem (Plivo MPC has no carrier noise
cancellation — see memory `voice-noise-suppression-vadeagerness-2026-08-16`). That is NOT this program.

## 2.3 What the industry actually does

No major voice-AI platform ships a first-party live web-search tool. The universal pattern is
**curated knowledge-base RAG + custom tools + spoken filler while tools run**:

- **Vapi** — Query Tool over uploaded KB files; custom/code tools; per-tool "Request Start / Complete /
  Failed / Delayed" spoken messages.
- **Retell AI** — KB RAG; custom functions with `speak_during_execution`; MCP support.
- **Bland.ai** — KB ingestion incl. help-centre web scraping *at index time*, not call time.
- **ElevenLabs Agents** — KB + RAG (~250 ms added); MCP servers; no first-party web search.
- **Play.ai** — gone (Meta acqui-hire 2025; platform shut down).

**OpenAI's own reference architecture for exactly our problem** is the **chat-supervisor pattern**
(`openai/openai-realtime-agents`): the realtime agent handles conversation and speaks a short filler
("give me a moment to check on that"), then calls ONE tool — `getNextResponseFromSupervisor` — and a
**smarter text model** does the reasoning and returns text the realtime agent speaks. Observed ~2 s between
the filler ending and the answer starting. **Move 2 is this pattern, scoped to the provider's catalog.**

Supporting guidance: OpenAI's realtime prompting guide defines **preambles** (spoken updates before slow
tool calls, with a no-repetition rule). Anthropic's "Building effective agents" blesses routing easy work to
small models and hard work to capable ones, and "Writing effective tools for agents" stresses that tool
descriptions are a top-leverage steering surface and results must be context-efficient.

**On parametric knowledge:** no vendor publishes a formal policy for "use model knowledge to *reformulate* a
query vs to *assert* a fact", but the consensus across Microsoft's grounding docs, ElevenLabs' RAG
reformulation, and typed function schemas is: **let model knowledge do translation and disambiguation; let
tools do assertion.** Realtime models also carry a stale knowledge cutoff (gpt-realtime: Oct 2023) — fine
for timeless trade knowledge, wrong for anything current.

## 2.4 Verified prices — pulled from Azure's official Retail Prices API on 2026-08-17

Query used (no auth required — use this instead of the JS-blocked pricing page):

```
https://prices.azure.com/api/retail/prices?$filter=contains(tolower(meterName),'realtime') and priceType eq 'Consumption'
```

Region `eastus2`, Global (`Gl`) deployment meters, USD per 1M tokens:

| Model / meter | Audio in | Audio cached in | Audio out | Text in | Text cached in | Text out |
|---|---|---|---|---|---|---|
| `gpt-realtime-2.1` | **$32.00** | **$0.40** | **$64.00** | $4.00 | $0.40 | $24.00 |
| `gpt-realtime-2` | *(see note)* | *(see note)* | *(see note)* | **$4.00** | **$0.40** | **$24.00** |
| `gpt-realtime-2.1-mini` | **$10.00** | **$0.30** | **$20.00** | $0.60 | $0.06 | $2.40 |

> **Precision note (do not overstate):** the API returned **text and image** meters for `gpt-realtime-2` and
> the **full audio set** for `gpt-realtime-2.1`. The `-2` text meters match `-2.1` exactly, so audio parity is
> the reasonable read, but the `-2` audio meters were not directly observed in that query. Re-run the query
> filtered on `gpt-realtime-2 Audio` before quoting `-2` audio rates as gospel.

Other verified meters (same API, `eastus2`):

| Meter | Rate |
|---|---|
| `text-embedding-3-large` (Global) | **$0.13 per 1M tokens** ($0.00013/1K) |
| `text-embedding-3-small` (Global) | $0.02 per 1M tokens |
| Document Intelligence **S0 Read Pages** | **$1.50 per 1,000 pages** (a $0.60/1k meter also exists — per the pricing-page structure it is the 1M+/month volume tier) |
| Document Intelligence **S0 Layout Pages** | **$10.00 per 1,000 pages** (verified via retail API 2026-08-18 — the D13 extraction model) |

GPT-5.4 family (per Microsoft Q&A — not in the retail API under a matched name; re-verify at build):
`gpt-5.4-mini` **$0.75 in / $4.50 out** per 1M · `gpt-5.4-nano` **$0.20 in / $1.25 out** per 1M.

**Token↔time conversion (Microsoft-published, via Voice Live docs):** ~**10 audio tokens/second heard**,
~**20 audio tokens/second spoken** ⇒ ~600 in + ~1,200 out per fully-spoken minute. This officially confirms
the figure previously treated as community lore.

---

# 3. LOCKED DECISIONS

Every row below is decided. Do not reopen without the owner.

| # | Decision | Rationale |
|---|---|---|
| **D1** | **Build the answer ladder** (§4): profile → catalog → expert check → knowledge base. Escalation on demand, never "always think hard". | Cheap by default; brains only on the turns that need them. |
| **D2** | **WEB SEARCH IS DROPPED.** No Move 4, no Bing grounding, no third-party search API, not behind a flag. | Owner decision 2026-08-17. It would not have fixed the trigger case; no competitor ships it live; it is the only rung piping third-party text into a voice speaking in the provider's name. Kind-5 questions take a message. |
| **D3** | **Stay on the current stack** — Azure GPT-Realtime + Telnyx SIP (CA/US) + Plivo WSS relay (India) + remote MCP. No Voice Live migration. | §2.2. |
| **D4** | **Move 2 model default = `gpt-5.4-mini`**, deployment name held in **settings** (`Voice:ExpertCheck:DeploymentName`); `gpt-5.4-nano` is a config-flip A/B, not a code change. | The tool's whole job is judgment (inferring unstated specs) — exactly where nano is weaker. Both prices trivial; speed gap <1 s. Owner locked mini 2026-08-17. |
| **D5** | **No nano-first→mini-escalate cascade in v1.** | Two model calls to save ~1¢ is complexity with no payoff. Revisit only on real data. |
| **D6** | **Move 2 consumes 2 units of the EXISTING 8-unit per-call allowance** (`VoiceCallSession.CatalogLookupCount`), weighted consumption on the same field. **Zero schema change.** Max 4 checks/call. | Keeps Move 2 entirely outside the §0.7 gate. A dedicated counter field was considered and rejected as not worth a Cosmos schema change. |
| **D7** | **Expert check available on BOTH model tiers** (`standard`/`advanced`), not premium-gated. | It matters *more* on the standard tier, where the realtime model is weaker — the supervisor adds the brains server-side. |
| **D8** | **Move 2 runs the cheap catalog search FIRST and short-circuits** — the LLM leg only fires when plain search cannot resolve the ask. | Economy is enforced server-side, never trusted to the model. A misfired call costs the same as a normal lookup. |
| **D9** | **Knowledge base = SEPARATE new Azure AI Search index** (`clinket-knowledge-{region}-…`) on the **existing search service**. | The services index is contract-frozen (additive-only, analytics-coupled) and must not be disturbed; a passage has a different shape and lifecycle. No new Azure resource, no new cost meter. |
| **D10** | **Records are CHUNKS + embeddings**, one uniform shape for uploaded files AND typed FAQs (an FAQ is a chunk whose content is "Q: … A: …", `docType: Faq`). **NOT** a question→answer key-value store. | Q&A pairs only answer questions the provider predicted; chunk retrieval answers unanticipated phrasings of anything the documents contain. One schema, both input styles, no second system. |
| **D11** *(refined 2026-08-18, evidence-backed)* | **NO per-chunk LLM enrichment — but ONE per-document LLM call at ingest** (gpt-5.4-mini, structured: `{title ≤60 chars, summary ≤400 chars, language}` from the first ~6k chars + heading outline, ~$0.002/doc, degrade = filename title + no summary). Every chunk is embedded with a **short structural prefix**: `docTitle — docType — sectionPath (+ linked offering name)`. The summary also becomes one `DocSummary` card per document. | The best quantified evidence says this exact split is optimal: **Snowflake's finance-RAG eval found per-chunk LLM metadata HURT accuracy (−5.8 pts) while document-level context prepended to every chunk raised it +15–25 pts**; Microsoft's chunking guidance explicitly recommends appending the document title to mid-document chunks; Anthropic's contextual-retrieval numbers (−35% failures) show the gain comes from context *presence*, which the structural prefix supplies at ~4× lower cost with ~50× fewer calls. Also fixes the junk-filename edge case (`scan_001.pdf`) generically. Prefix stays ~10–20% of the chunk (long prefixes dilute the vector — Chroma). |
| **D12** | ‼️ **OWNER DIRECTIVE 2026-08-17 — a BRAND NEW Cosmos container `KnowledgeBase`, partitioned by `/businessId`.** (This supersedes the earlier recommendation to reuse `ProviderData` with a new `DocumentType`.) | Owner's call. It buys clean lifecycle isolation: a provider's knowledge can be purged, TTL'd, throughput-tuned and change-fed independently of the shared provider partition. **⚠️ One point to confirm at the §0.7 gate before any code:** the owner's note said *"partition by the businessId which is the userNumber"* — in this codebase `/userNumber` is the partition key of the **`Communications`** container and is NOT the same value as `businessId`. Every provider-scoped container (`ProviderData`, `Reviews`, `Transactions`) uses `/businessId`, and the voice binding supplies `businessId`. **This plan therefore specifies `/businessId`, and the partition key is PERMANENT — get an explicit yes on that exact string before creating the container.** |
| **D13** *(revised 2026-08-18; routing superseded by D28 — DI now serves PDF + IMAGES ONLY)* | **Extraction = Document Intelligence `prebuilt-layout` with `outputContentFormat=markdown`** (v4.0 GA API `2024-11-30`) for **PDFs and standalone images** (DOCX moved to local OpenXML per D28). **`.txt`/`.md` skip DI entirely** ($0). Typed FAQs never touch a file. `prebuilt-read` remains a **settings fallback** (`Voice:Knowledge:ExtractionModelId`) — knowledge carries its OWN model setting; the shared `AzureDocumentIntelligence:ModelId` (used by onboarding) is untouched. | **Tables are where spec data lives, and `read` flattens them into garble** — the #1 question class this feature exists for would silently fail. Layout markdown emits real tables as HTML (`rowspan`/`colspan`/captions preserved), headings as `#`–`######`, and page headers/footers/numbers as strippable HTML comments. Microsoft's own table-QA research (WSDM'24) found **HTML table format beats plain text by ~6.8%** for LLM comprehension. Cost: $10/1k pages (verified, retail API) vs $1.50 — one-time, ~$0.10 per 10-page doc; the setting is the escape hatch if `read` proves adequate. Open-source parsers stay rejected (fail scanned docs + tables). |
| **D14** *(revised again 2026-08-18 with D28)* | **V1 accepted types: PDF, DOCX, XLSX, TXT, MD, JSON, HTML/HTM, and IMAGES (JPG/JPEG/PNG/TIFF/BMP/HEIF; HEIC via the existing client-side conversion)** — scanned PDFs included. **The ONLY exclusion: WEBP** (nothing in the pipeline reads it — client transcodes to PNG/JPG or it is rejected with a localized reason). | XLSX is back in because D28 parses it locally (the old exclusion reason — DI's missing XLSX table analysis — is moot when DI is never used for it). HTML and JSON are in because they parse locally at $0 and are genuinely useful sources (a provider's own site page; an exported price list). See D26 for what images become. |
| **D15** | **Upload = SAS direct-to-blob, BATCH shape** — one `sas-urls` call returning an array, then a PUT per file, then **one `confirm` call carrying only the files that actually landed**. Mirrors the **licenses/portfolio** flow (`UploadLicenseDocumentsViaSas`, `profileServices.js:443-515`), not the single-file AI-setup endpoint. | *(Revised 2026-08-17 after verifying the UI layer.)* Knowledge is inherently multi-file, and the batch shape is the platform's established multi-file precedent — it already handles per-file `Promise.allSettled` isolation, a count-mismatch guard, real XHR progress, and partial-success confirm. The single-file AI endpoint would force N round trips and re-invent the partial-failure handling. |
| **D16** | **Knowledge is its OWN menu item, directly BELOW the AI Receptionist entry** — web sidebar and mobile menu. NOT a tab inside AI settings. | Owner placement decision 2026-08-17. |
| **D17** | **Permission gate reuses `voice.settings.manage`** (manage) and `voice.read` (view). **No new permission key.** | Both already exist in `TenancyRoleCatalogDefinition`. A new key would trigger the full grant-change playbook (CatalogVersion bump = cache epoch, pin update, screen-combination sweep, mobile 403 gate) — avoided entirely. |
| **D18** *(revised 2026-08-18)* | **Caps are settings, defaults**: 20 documents · 20 MB/file · 100 pages/doc · 2,000 passages/business · 200 typed FAQs · **retrieval top-5** ≤1.5k tokens. **Every retrieval/ceiling knob is an appsetting** (owner mandate): `RetrievalTopK` (5), `RetrievalMaxTokens` (1500), `RetrievalTimeoutMs` (4000), `RetrievalSlowWarnMs` (1500). | 20 MB matches `Storage:ProviderSetupDocuments:MaxFileSizeBytes` exactly. **Top-5 is the evidenced number**: Microsoft's own VoiceRAG reference sample injects `top=5`; answer-quality studies peak at K=3–5 and decline beyond ("lost in the middle"); without a semantic reranker, RRF ordering is coarser, so 5 (not 3) hedges rank noise; 5 × ~300 tokens lands exactly on the 1.5k voice budget. The Move-2 expert check (text path) may take 8–10. |
| **D19** | **Every rung has a defined degrade, and "tell the caller we can't" is never one** — extends the existing catalog-path rule. Isolation failures alone fail CLOSED. | Direct carry-over of the 2026-07-28 audit lesson. |
| **D20** | **Honesty grading is contractual**: provider data stated plainly; expert inference hedged ("typically… the owner will confirm"); prices/availability/stock NEVER inferred. Professional-judgment questions (health/safety/legal) get general framing + steer to booking, never a verdict. | Safety, and it converts hard questions into bookings. |
| **D21** | **No hardcoded industry vocabulary anywhere** — prompts and tool descriptions stay generic across all 300+ categories. | Platform rule §3.7; also what makes one design serve dentists and excavator dealers alike. **The excavator was only the trigger example — every mechanism in this plan (context prefix, hybrid retrieval, expert check) is trade-agnostic by construction and must stay that way.** |
| **D22** | ‼️ **OWNER MANDATE 2026-08-17: a knowledge query outside the bound `businessId` must be IMPOSSIBLE, not just avoided.** The AI never supplies a businessId; the scope filter is stamped server-side from the call binding; an `AssertScoped`-style guard refuses to send any query whose filter does not lead with the bound business; every returned row's `businessId` is re-verified in code; one mismatch discards the entire result set, alarms, and **fails closed**. | Owner's explicit instruction ("never ever search with other businessId"). Same 4-layer structure `ProviderCatalogSearchService` already proves. Isolation is the one failure that never degrades. |
| **D23** | ‼️ **OWNER MANDATE 2026-08-17: the live-call retrieval path is performance-first — NO LLM inside `search_knowledge`.** One single hybrid request (BM25 + vector together, one round trip — not sequential legs); the query embedding is cached and **fails soft to keyword-only** in the same request rather than waiting; top-5 passages ≤1.5k tokens (K per D18/D27); hard timeout (default 4,000 ms, a setting) with the honest degrade ("the owner will confirm" + message) — never silence, never a guess. Target: sub-second typical, ceiling 4 s. | A caller is waiting through every millisecond and the model cannot speak during the call. Cost ≈ half a cent per lookup (almost all of it the injected passages); the search itself is $0 marginal. The expert check (Move 2) is the ONLY tool that runs a text LLM, with its own caps. |
| **D24** *(locked 2026-08-18 — THE CHUNKING CONTRACT, evidence-backed; full spec §7.8)* | **Granularity = small structure-aware cards**: target **~350 tokens**, hard max **512**, tails **<120 tokens merge into the previous sibling**, overlap **15% composed of whole trailing sentences**. Cutting order: section heading → paragraph → **sentence end** → word boundary; **never mid-word, and a card only ever ends where a sentence ends**. **Tables are atomic** up to the max, else split by row-groups **with the header rows repeated in every part** + the nearest heading carried; table cards **store** the HTML table (what the LLM reads) but **embed** a compact text serialization + prefix (flagged as practitioner-technique — A/B later). One FAQ = one card, always. Plus **one `DocSummary` card per document** (from the D11 call) to catch broad asks ("tell me about your warranty"). | Sits at the intersection of every credible eval: Chroma's best recall band (recursive 200–400 tokens; big overlaps HURT), NVIDIA's factoid bracket (256–512), Snowflake's ~450-token optimum, Azure's 512/25% starting guidance, Microsoft's flagship hybrid eval built on 512-token chunks. **Discarded**: one-card-per-document (embedding cap 8,191 tokens; retrieval mush; blows the voice budget), one-card-per-page (a page is a layout artifact that cuts mid-sentence *by definition* — the exact failure the owner asked to prevent; NVIDIA's page-level win applies to whole-page corpora, not spec tables), embedding-similarity "semantic chunking" (NAACL 2025: doesn't beat structural splitting; costs more), per-chunk LLM context (Snowflake: negative), small-to-big neighbor expansion (no vendor-grade benchmark; adds a hop inside a sub-second budget — **deterministic ids `{businessId}_{docId}_{chunkNo}` make neighbors a later point-read, no schema needed**). |
| **D25** *(locked 2026-08-18 — THE CAP-OVERFLOW CONTRACT)* | **A document is ALL-IN or ALL-OUT — a half-indexed document must be impossible.** Enforcement: (1) upload-time gate — no new SAS when doc count or passage usage is at cap (meter visible in UI); (2) ingest-time decision AFTER chunking, BEFORE any embed/index spend: fits under cap ⇒ index fully; over cap but ≤ cap × `OverflowGraceFactor` (default **1.10**) ⇒ index FULLY (the owner's grace band); beyond grace ⇒ **whole document Failed** with localized "knowledge space is full" — nothing partial ever lands, blob kept so delete-then-retry works; (3) any mid-pipeline failure ⇒ delete-by-`docId` cleanup, then Failed — `Ready` means 100% searchable, `Failed` means 0%; (4) ‼️ **the ingestion queue is SESSION-ENABLED with `sessionId = businessId`** (`requiresSession: true` in ARM; `SendMessageWithSessionAsync` already exists; host `maxConcurrentSessions: 8`) so one business's documents process strictly one-at-a-time — the concurrent-upload cap race cannot happen, and replace-after-upload keeps order. | Owner's stated instinct (grace band, never break a document halfway) made precise. A half-indexed spec sheet gives confidently wrong answers — the worst possible outcome for a voice agent speaking in the provider's name. |
| **D26** *(locked 2026-08-18 — THE IMAGE CONTRACT)* | **Images become WORDS at ingest; there is no image-vector search.** Pipeline per image: DI layout OCR (a photographed price board becomes normal text cards) **plus, when `ImageCaptioningEnabled` (default true), ONE gpt-5.4-mini vision call** producing a factual structured caption (what it shows, brands/models, any legible text — no speculation) stored as a `chunkKind: ImageCaption` card (~$0.001/image; **downscale before captioning** — a reported GPT-5.4-mini anomaly can massively over-count image tokens on large PNGs). OCR and caption both empty ⇒ document **Failed** with localized "no readable content". | The output channel is VOICE — an image is only useful once it is speakable text, so index the text surrogate directly. This matches Microsoft's own direction (the new Content Understanding skill does AI image descriptions for RAG). Multimodal image embeddings (Azure AI Vision / Cohere Embed v4) were evaluated and **discarded**: a second vector space + new dependency to enable "find similar images" — a capability a phone call can never use. |
| **D27** *(locked 2026-08-18 — RETRIEVAL TUNING; re-examined independently 2026-08-18 at the owner's request — the number was chosen on evidence, not on anyone's suggestion)* | **The real decision is the PAIR (`RetrievalTopK` = 5, `RetrievalMaxTokens` = 1500), and the token budget binds FIRST** — so the effective card count self-adjusts: ~5 small text cards, or ~3 when big table cards dominate. Why not 3: one study's F1-peak-at-3 assumed a reranker/strong reader; our RRF-only ordering is coarser, and K=3 leaves no headroom for rank noise — a right answer at rank 4 would be silently dropped. Why not 6+: measurable decline ("lost in the middle" — plausible-but-wrong passages dilute), more context re-billed every turn, zero evidence of gain. 5 is also exactly Microsoft's own VoiceRAG reference (`top=5`). Both knobs are settings — tune on transcript evidence, not taste. | Owner explicitly asked for an un-anchored re-pick (2026-08-18); this is it — 3 and 6 were genuinely evaluated and rejected for the stated reasons. |
| **D28** *(locked 2026-08-18 — LOCAL-FIRST EXTRACTION ROUTING; refines D13's scope and CUTS typical cost ~60-90%)* | **Document Intelligence is paid for ONLY where OCR/layout genuinely needs it: PDFs and photos. Everything born-digital parses LOCALLY at $0.** Routing: **PDF (any)** → DI layout markdown ($10/1k pages — D13 stands, tables + scans need it) · **Images** → DI layout OCR + D26 caption (~$0.011) · **DOCX** → **local OpenXML parse** (headings from styles, native tables, lists — $0; **embedded images are extracted and routed through the D26 image path individually**, so a Word file with 5 photos costs ~$0.055 instead of full-document paging) · **XLSX** → **now ALLOWED, local OpenXML** (per-sheet sections; first row = headers heuristic; rows flattened `header: value`; cached formula VALUES read, never formulas; row-group chunking like tables — $0) · **HTML/HTM** → **now ALLOWED, local parse** (strip script/style/nav/footer noise; h1–h6 → headings; `<table>` kept as table cards; $0) · **TXT/MD** → local ($0; a body that parses entirely as JSON is flattened to readable `key path: value` lines) · **JSON** → **now ALLOWED**, same flatten ($0). New deps: `DocumentFormat.OpenXml` (Microsoft) + an HTML parser (HtmlAgilityPack-class) — standard, small; verify existing repo references at build. | Owner's constraint verbatim: "cost is key but no compromise on the data." Local parsing of born-digital formats is BETTER data (native structure, zero OCR errors) AND $0. This also deletes D14's XLSX exclusion — the old reason ("DI doesn't table-analyze XLSX") is moot because XLSX never touches DI now. WEBP remains the only rejected type (nothing reads it; client transcodes). A realistic 20-doc provider (say 8 PDFs, rest Office/text) now costs **~$0.85 one-time instead of ~$2.06**. |
| **D29** *(locked 2026-08-18 — FAQ SECTION NAMING)* | The section is titled **"Your FAQs"** with subtitle *"Quick answers your receptionist gives callers — typed right here, no file needed."* NOT the business name ("Smart Hair and Beauty FAQ") and NOT bare "FAQs". | Inside the provider's own dashboard, prefixing their business name is redundant and breaks on long names ("Sri Lakshmi Narasimha Swamy Cleaning Services FAQ" wraps everywhere, 10 locales × mobile). "Your" personalizes at 4 characters, and the subtitle's "gives callers" cleanly separates it from the PLATFORM's own Help-Center FAQ catalog (which exists — the owner's stated concern). Dynamic name insertion via interpolation was considered and rejected for length/wrapping across locales. |
| **D31** *(owner-added and APPROVED 2026-08-18 — THE AI-SETUP NUDGE, full spec §7.11c)* | A friendly, zero-jargon card at the bottom of the AI Voice Assistant settings page (web + mobile) invites the provider to add knowledge and navigates to the Knowledge page; swaps to a quiet counts one-liner once ≥1 Ready document exists; same flag+permission gates; reads the SAME list endpoint the page uses (no new endpoint). | Owner: prompt providers plainly to feed the receptionist for the best caller experience — never technical wording. |
| **D32** *(locked 2026-08-18 — NAV LABEL; owner asked "AI Assistant Knowledge" vs "Knowledge Base")* | The menu entry and page title are **"AI Knowledge"** (route stays `/dashboard/profile/knowledge` — a label is not a slug). | An honest third option beat both candidates: "AI Assistant Knowledge" is redundant sitting directly under the AI Assistant entry and wraps badly across 10 locales; bare "Knowledge" reads ambiguous on out-of-context surfaces (deep-link chips, analytics, tour steps); **"Knowledge Base" is exactly the technical wording D29/D31 banned for providers**. "AI Knowledge" is 12 characters, self-explaining anywhere it appears, and translates compactly. The FAQ section inside stays "Your FAQs" (D29). |
| **D33** *(locked 2026-08-18 — STATUS-CHIP COLOR SEMANTICS; owner asked whether Processing should be the yellow/gradient treatment)* | **Processing = the calm info-blue chip WITH the spinner** (`--info-bg #E4EEFB` / navy text) — NOT yellow, NOT a gradient. The full chip language: **green = Ready** (`--green-soft`/#3F7A00), **blue + spinner = Processing**, **red = Failed** (`--danger`), **amber = true warnings only** (limit-reached, knowledge-space-full — `--warn #FFF7E8/#9A5B00`). | Three reasons: (1) in this design system (and generally) **amber/yellow means "needs your attention"** — Processing is benign and automatic, and painting it amber makes providers think action is required; the platform's own `SurfaceAccess` precedent deliberately chose info-navy over amber for non-error states. (2) The **spinner already communicates "working"** — motion is the in-progress signal, color stays calm. (3) **A gradient on an 11px pill fights the flat soft-background pill language** used across all four apps; brand green stays reserved for pressed/selected/CTA per the standing color mandate. If the owner ever prefers yellow semantics, the flat amber token is the variant — never a gradient chip. |
| **D30** *(locked 2026-08-18 — TRIGGER TRANSPORT: SERVICE BUS, NOT THE CHANGE FEED; owner proposed the change-feed variant and asked for the honest answer)* | Ingestion stays **Service-Bus-queue-triggered**. The change-feed variant (registry write in `ProviderData` → the existing `SearchIndexSyncFunction` also builds the knowledge index; deletes via TTL) was evaluated seriously and fails on four hard facts: **(1) the standard change feed does NOT carry deletes — a TTL expiry emits NO event**, so TTL-based deletes would silently orphan every card in the index (the services sync survives deletes only via soft-delete-marker upserts, extra states we'd have to replicate); **(2) a poison document STALLS the change-feed lease** — a CosmosDBTrigger failure blocks the partition's feed and retries forever; there is no DLQ, no delivery count, no abandon/backoff — Service Bus gives all three and the platform's media pipeline was deliberately refactored TO Service Bus for exactly this; **(3) OCR is a minutes-long, dollar-spending job — putting it inside the function that keeps the customer-facing services index fresh means marketplace search freshness queues behind somebody's 100-page scan**; **(4) our own status flips (Processing→Ready) are registry writes that would re-trigger the very feed that started them.** The change feed is the RIGHT pattern when the Cosmos document IS the searchable content (services); here the source of truth is a BLOB and the registry is bookkeeping. **FAQs also stay synchronous** (record + one card in the API request): a change-feed hop would replace "live instantly" with an eventual-consistency lag for zero benefit on a one-card write. And confirming the owner's aside: there was never a blob trigger in this design. | Platform rule §2 ("ALL processing async via Service Bus") + the media-derivatives refactor precedent. Respecting the idea: it correctly identifies that change feed avoids a queue — but it trades away deletes, poison isolation, and services-search freshness to do it. |
| **D27b** *(same lock)* | **NO minimum-score cutoff on hybrid results — ever** **NO minimum-score cutoff on hybrid results — ever**: Azure documents that RRF scores are rank-derived, bounded, and not comparable across queries ("hybrid queries aren't conducive to minimum thresholds") — the same lesson this platform already learned as "NEVER floor raw RRF". Zero results ⇒ the honest degrade, never a threshold guess. **Semantic reranker stays OFF for the voice path** (adds 300-800 ms + $1/1k queries on a turn nobody can speak over); it is the documented A/B lever for the Move-2 expert check later ($1/1k, +11.7 NDCG@3 in Microsoft's eval, and its `rerankerScore` is the only legitimate confidence gate if one is ever wanted). **Analyzer for knowledge text fields = `standard.lucene`** (language-neutral) — one shared field holds EN/FR/ES/HI/GU text and Microsoft's guidance for mixed-language single fields is the language-agnostic analyzer with the vector leg carrying semantics; a deliberate, documented divergence from the services index's `en.microsoft`. ‼️ Gujarati is absent from the embedding model's public benchmarks — build a small Gujarati eval set before trusting vector recall there (BM25 still carries lexical recall). | Every number here traces to Microsoft's own evals, their VoiceRAG sample, or a platform memory. |
---

# 4. ARCHITECTURE — THE ANSWER LADDER

Every caller question walks down the ladder and stops at the first rung that answers it.

```
Rung 1  Embedded profile  ─────────── hours, offers, areas, address, prices        ~0 ms      $0        EXISTS
Rung 2  find_services  ───────────── named things; Move 1 makes it smarter      0.3-1 s    ~$0       EXISTS + Move 1
Rung 3  answer_catalog_question  ─── requirements & comparisons over the catalog  2-4 s   ~$0.013    MOVE 2 (new)
Rung 4  search_knowledge  ────────── provider-specific facts from their documents ~1-2 s   ~$0       MOVE 3 (new)
        ↓
        leave_message  ───────────── the floor. Never changes.                                        EXISTS
```

**Invariants across all rungs:**

1. The realtime model **cannot speak during a tool call** — proven and settled (2026-07-28). The only levers
   are the **preamble spoken before** the call, the map/profile answering most turns with no tool call at
   all, and each rung's hard timeout. Do not revisit.
2. Every rung returns **trimmed, spoken-ready results** — never raw dumps. This protects the 32k session
   ceiling and the caller's patience equally.
3. Every rung is **tenant-bound server-side** via `McpToolGuard` (`businessId` comes from the call binding,
   never from the model) and, for search-backed rungs, **row-level verification** of every returned document.
4. Every rung is **individually kill-switchable** in settings.

---

# 5. MOVE 1 — THE KNOWLEDGE POLICY (prompt-only, $0, ship first)

## 5.1 Goal

Stop the prompt from banning intelligence, without loosening a single safety rule.

## 5.2 File

`clinqetinfrastructure\Services\Voice\RealtimeSessionPayloadBuilder.cs` → `BuildInstructions(...)`.
This method is shared by **both** carriers (`BuildAcceptPayload` for Telnyx SIP, `BuildWebSocketSessionPayload`
for the Plivo relay), so one edit covers CA/US and India. **Verify both payload paths in tests.**

## 5.3 Changes

**(a) Rescope the privacy line.** Current text (~line 378):

> "Never reveal information about other customers, full contact details, or anything not in the profile below."

Replace the trailing clause so it forbids inventing **business facts**, not using **world knowledge**. New
intent: *never reveal other customers' information or contact details, and never state a price, availability,
offering, or commitment that is not in the profile or a tool result.*

**(b) Add a compact knowledge-policy block** (target ≈200 tokens, generic across all trades):

- *You are experienced in this business's trade.* When a caller describes a **requirement** instead of naming
  something, translate it into the terms an expert would search — the type, class, or common makes and
  models — and try more than one phrasing before concluding the business does not offer it.
- **General trade questions deserve a brief, helpful answer**, framed as general guidance, then steered back
  to what the business offers: *"…for your specific case, the owner can confirm."*
- **Never** infer or estimate a price, availability, stock, or a commitment. Those come only from the profile
  or a tool.
- **Professional-judgment questions** (health, safety, legal) get general information only, never a verdict,
  and always a steer to the assessment/booking the business actually offers.
- Grade honesty out loud: stated facts plainly; inferences hedged ("typically", "usually") with the owner's
  confirmation offered.

**(c) Update `CatalogTools.FindServices`' `[Description]`** (`clinqetmcp\Clinqet.Mcp\Tools\CatalogTools.cs`):
change *"Pass the caller's own words as query"* → *"Pass the caller's words **or the expert terms their
requirement implies**"*, and add: *"If the first phrasing returns nothing, try the expert term for it before
telling the caller it isn't offered."*

## 5.4 Edge cases to cover

- Owner's standing instructions must still **override** everything (they are appended last for recency
  weight, and re-stated at the top). The knowledge policy must never contradict or dilute them.
- Map mode vs Full mode both need the policy — it sits above the mode branch.
- The policy must not encourage tool calls for things already in the profile (the existing anti-tool-call
  rules stay intact).
- No industry nouns anywhere in the wording (D21).

## 5.5 Tests — `Clinqet.Communications.UnitTests\Voice\RealtimeSessionPayloadBuilderTests.cs` (existing file)

Per §0.18 this is the correct home: the Functions host drives Telnyx call control, and the existing
payload-builder tests already live there.

- Policy block present in **both** `BuildAcceptPayload` and `BuildWebSocketSessionPayload` output.
- Present in **Map mode and Full mode**.
- Privacy clause still forbids customer data (assert the surviving wording).
- Price/availability inference still forbidden (assert wording).
- Owner standing instructions still emitted last and still marked supreme.
- Token-budget guard: assert the instructions length stays under the existing ceiling assertion, if one
  exists; otherwise add a soft assertion so the prompt cannot balloon unnoticed.

---

# 6. MOVE 2 — THE EXPERT-CHECK TOOL (the real fix)

## 6.1 Shape

A new MCP tool, working name **`answer_catalog_question`**, offered **only in Map mode** (a fully embedded
catalog needs no round trip — same rule that gates `find_services`).

The realtime model hands over the caller's requirement in their own words. The server does the thinking:

1. **Short-circuit (D8).** Run the existing catalog search first. If it returns a small, clearly-matching set
   (≤ `LookupTooBroadThreshold`, and the query is not requirement-shaped), return those rows and **never call
   the LLM**.
2. **Retrieve wide.** Group-scoped or capped partition read of up to ~100–200 candidates **with FULL
   descriptions** — the 160-char clamp exists only to protect the realtime context, and this path never
   touches it.
3. **Reason once.** One structured `AICompletionService` call: *"Which of these meet: `<requirement>`? Use
   expert knowledge of typical specs where the descriptions are silent. Return ids, confidence
   (stated / likely / unknown), and a one-line spoken reason each."* Strict JSON schema, `reasoning_effort:
   low`, `max_completion_tokens ≈ 500`, `temperature 0`.
4. **Return small.** ≤5 results, spoken-ready, plus a `note` instructing the model to hedge anything marked
   `likely` and to offer the owner's confirmation.
5. **(After Move 3 ships)** If the business has knowledge documents, pull the linked spec passages for the
   candidates and feed them in — this is the `linkedServiceId` synergy where the two moves compound.

## 6.2 Files

| Repo | File | Work |
|---|---|---|
| `clinqetmcp` | `Clinqet.Mcp\Tools\CatalogTools.cs` | New `[McpServerTool]` method (or a sibling tool class if it grows) |
| `clinqetmcp` | `Clinqet.Mcp\Program.cs` | Register `IAICompletionService` + its named `HttpClient` in the MCP host (currently only the embedding service is wired via `AzureAIFoundry`) |
| `clinqetinfrastructure` | `Services\Voice\ProviderCatalogAnswerService.cs` (new) | The retrieve→reason→shape ladder |
| `clinqetcore` | `Interfaces\Voice\IProviderCatalogAnswer.cs` (new) | Contract incl. the isolation obligation |
| `clinqetshared` | `Models\Voice\VoiceCatalogSettings.cs` (extend) or a new `VoiceExpertCheckSettings` | Settings (§6.4) |
| `clinqetinfrastructure` | `Services\Voice\RealtimeSessionPayloadBuilder.cs` | Add the tool to `ResolveAllowedTools` (Map mode only) + the prompt's ladder-order rule |
| all hosts | `appsettings.json` | Settings block, class defaults mirrored (§0.12) |

## 6.3 Usage control — four layers (the owner's explicit requirement)

1. **Prompt ladder order.** "Answer from the profile instantly. For anything the caller NAMES, use
   `find_services`. Call the expert check ONLY when the caller states a requirement, constraint or comparison
   that keyword search cannot express, or after `find_services` found nothing for a requirement-shaped ask.
   Never for prices, hours, availability or booking."
2. **Tool description** repeats the same boundary in its own words (highest-leverage steering surface).
3. **Server short-circuit (D8)** — economy enforced in code, not trusted to the model.
4. **Hard caps** — 2 units of the existing 8-unit allowance (D6) ⇒ max 4/call; plus `McpToolRateLimiter`
   (per-business token bucket + concurrency cap) and `Voice:ExpertCheck:Enabled` kill switch; plus an
   `McpAudit` row per use so real usage is measurable from day one.

**Worst case is bounded:** 4 × ~$0.013 ≈ 5¢ extra on a maximally tool-happy call, and every check announces
itself out loud. No silent runaway is possible.

## 6.4 Settings (`Voice:ExpertCheck`, class defaults mirroring appsettings)

| Key | Default | Purpose |
|---|---|---|
| `Enabled` | `true` | Kill switch |
| `DeploymentName` | `gpt-5.4-mini` | D4 — config-flip to nano |
| `MaxCandidates` | `150` | Upper bound on rows fed to the LLM |
| `CandidateDescriptionMaxChars` | `600` | Per-row clamp (generous; not the 160 spoken clamp) |
| `MaxResults` | `5` | Rows returned to the model |
| `TimeoutMs` | `8000` | Whole-ladder ceiling, mirroring `Voice:Catalog:LookupTimeoutMs` |
| `SlowWarnMs` | `3000` | Warn-but-succeed threshold |
| `AllowanceUnits` | `2` | D6 weighted consumption |
| `ReasoningEffort` | `low` | Latency |
| `MaxCompletionTokens` | `500` | Cost/latency bound |

## 6.5 Degrade ladder (D19) and edge cases

| Failure | Behaviour |
|---|---|
| LLM call times out or errors | Degrade to the plain `find_services` result set for the same query — **never** "we don't have that" |
| Zero candidates retrieved | Standard `None` outcome with nearest groups (existing shape) |
| Allowance exhausted | Existing `Exhausted` note: take a message, do not claim absence |
| Isolation violation | **Fail closed** — rethrow `CatalogIsolationException`, alarm, safe non-answer (never degrade) |
| Malformed LLM JSON | Strict schema + one bounded repair attempt (`JsonRepairHelper` exists); then degrade as above |
| Requirement is about price/availability | Tool refuses with guidance to use the listed price / existing flow |
| Caller asks a professional-judgment question | Prompt handles it (D20); the tool is not the safety layer |
| Cancellation / caller hangs up | Honour `CancellationToken` everywhere; no orphaned LLM calls |

## 6.6 Tests

**`Clinqet.Mcp.UnitTests`** (§0.18 — MCP is the runtime consumer):
short-circuit fires and skips the LLM; LLM leg fires when it should; confidence grading maps to the right
`note`; timeout degrades to plain results; isolation violation rethrows; allowance weighting consumes 2;
malformed JSON repaired then degraded; settings honoured (deployment name, caps); cancellation propagates.

**`Clinqet.Mcp.IntegrationTests`**: tool present in the curated tool-catalog contract
(`McpToolIntegrationTests.cs` — the list at ~line 47 currently contains `find_services`; **it must be
updated or the suite goes red** — this exact trap bit the 2026-07-31 session); scope refusal for partner-only
paths; rate-limit refusal path; end-to-end against the emulator with a seeded catalog.

**`Clinqet.Communications.UnitTests`**: `ResolveAllowedTools` includes the tool in Map mode and excludes it
in Full mode, on **both** payload builders.

---

# 7. MOVE 3 — THE PROVIDER KNOWLEDGE BASE (end to end)

The definitive answer to kind-4 questions, and the platform's long-term differentiator.

## 7.1 Storage map — what lives where and why

| Thing | Where | Why |
|---|---|---|
| **Original files** | New blob container `provider-knowledge`, path `{businessId}/{docId}/{sanitizedFileName}` | Mirrors `provider-setup-docs`. Needs ARM + `deploy.ps1` (§25) |
| **Searchable passages** | **New Azure AI Search index** on the **existing** search service (D9) | No new resource/meter; services index untouched |
| **Document registry** (what exists, status, counts) | ‼️ **NEW Cosmos container `KnowledgeBase`, partition key `/businessId`** (D12, owner directive) | Independent lifecycle, purge, TTL and throughput; every query is partition-scoped by construction |
| **Ingestion trigger** | New Service Bus queue `knowledge-ingest` | Matches the platform's async-everything rule |

## 7.2 The index — schema

**Name (verified convention):** the region is **NOT** in the index name — it is in the *service endpoint*
(`clinket-search-{ca|in}-v4-nonprod.search.windows.net`, supplied per region by
`cosmosindexsetup\appsettings.{ca|in}.json`). Index names are `base + envSuffix`, where
`envSuffix = isProd ? "" : "-{Environment}"` (`Program.cs:786-788`). So: base `"clinket-knowledge"` →
**`clinket-knowledge-dev`**, identical in both regions (mirrors `clinket-dev` / `clinket-providers-dev`).

| Field | Type | Attributes | Purpose |
|---|---|---|---|
| `id` | string (key) | — | Deterministic: `{businessId}_{docId}_{chunkNo}` (sanitised to the key charset). Redelivery overwrites; never duplicates |
| `businessId` | string | filterable | Isolation filter **and** row-level verification target. **Never remove from `select`** |
| `docId` | string | filterable | Replace/delete by document |
| `docName` | string | searchable, retrievable | Cited to the model ("from your rental terms") |
| `docType` | string | filterable, facetable | Enum: `SpecSheet, Faq, Policy, PriceList, Other` |
| `linkedServiceId` | string | filterable | Optional — the offering a spec sheet belongs to; filter/join key (retrieval narrowing + Move-2 spec pull) |
| `linkedServiceName` | string | searchable, retrievable | **Both id AND name are stored (decided 2026-08-18):** the id filters; the name lets BM25 match a caller saying the machine's name straight onto its spec cards, and attribution needs no runtime lookup. Resolved at ingest anyway for the prefix (one partition point read); platform-standard denormalization (cf. `Voiceline.businessName`); rename staleness handled by Reprocess (§7.8b case H) |
| `sectionTitle` | string | searchable | Heading context; part of the embedding prefix |
| `content` | string | searchable | The passage text — what the model reads |
| `contentVector` | Collection(Single) | vector-searchable | Embedding (3,072 dims). ‼️ For table cards the vector is computed from a compact serialization, NOT the stored HTML (D24) |
| `docTitle` | string | searchable | The D11 LLM-derived title — the prefix's anchor and the display name when the filename is junk |
| `chunkKind` | string | filterable, facetable | Enum: `Text · Table · FaqPair · ImageCaption · DocSummary` — retrieval tuning + debugging |
| `pageNumber` | int | retrievable | Provenance for the provider UI/debugging |
| `language` | string | filterable | Multilingual retrieval |
| `updatedAt` | DateTimeOffset | filterable, sortable | Freshness / housekeeping |

**Analyzer (D27):** `standard.lucene` on the searchable text fields (`content`, `sectionTitle`, `docTitle`,
`docName`) — one shared field holds EN/FR/ES/HI/GU text, and Microsoft's guidance for mixed-language single
fields is the language-agnostic analyzer with the vector leg carrying semantics. **A deliberate, documented
divergence from the services index's `en.microsoft`.** Scoring: one `knowledgeRelevance` profile with
TextWeights only (`docTitle` 3.0, `sectionTitle` 2.0, `content` 1.0) and **no scoring functions** — same
reasoning as `voiceCatalogScoring`. No suggester. No semantic configuration in v1 (D27).

**Vector config — mirror the services index exactly** (`Program.cs:222-230`, field at `534-543`):
`HnswAlgorithmConfiguration("hnsw-algo")` with `M=10, EfConstruction=400, EfSearch=500`, a
`VectorSearchProfile("textVectorProfile", "hnsw-algo")`, metric left unset (Azure default = cosine), and the
vector field declared **manually** with `VectorSearchDimensions = 3072` (matching
`text-embedding-3-large`) — the POCO property carries `[FieldBuilderIgnore]` so `FieldBuilder` does not
double-emit it.

‼️ **There is NO integrated vectorization anywhere in this codebase** — no `Vectorizers`, no skillset, no
`SearchIndexer`. Azure will **not** call an embedding model for us. Our ingestion function generates the
vector and writes it with the document, exactly as `AzureSearchIndexer` does for services.

**Also required:** a `hasEmbedding`-style hidden filterable guard field is worth mirroring
(`SearchDocument.cs:425-432`) so a vector query can exclude passages whose embedding failed. **No scoring
functions** — freshness/rating boosts are meaningless inside one provider's documents (exactly the trap that
made `voiceCatalogScoring` necessary). A **semantic configuration** only if we later enable reranking
(default OFF — billed per query, 300-800 ms on a turn nobody can speak over).

‼️ **Set `DefaultScoringProfile` deliberately or not at all.** On the services index it defaults to
`serviceRelevanceScoring`, whose functions then multiply into any query that names no profile — the exact
hazard documented at `SearchScoringProfiles.cs:10-18`.

## 7.3 `cosmosindexsetup` — who creates the index (verified map)

| Fact | Detail |
|---|---|
| **Project references** | `clinqetcore` + `clinqetshared` **only — NOT `clinqetinfrastructure`** (`.csproj:49-50`). The new document POCO must therefore live in `clinqetcore\Entities\AISearch\` |
| **Config section** | `Search:` in this tool (`Program.cs:40-49`) — add `KnowledgeIndexName` + base value in `appsettings.json`, and `+= envSuffix` beside `Program.cs:836-837` |
| ‼️ **Dual section names** | The read side uses **`AISearch:`** (`clinqetapi appsettings.json:703-708`), not `Search:`. A new index needs its name in **both** |
| **Create/update** | `SearchIndexClient.CreateOrUpdateIndexAsync(index)` — unconditional PUT, no existence check, no ETag, no `allowIndexDowntime`. Additive changes are online no-ops; a breaking change returns 400, is logged with status/error code, and **rethrows, aborting the run** |
| **Invocation** | Add a third `await …CreateOrUpdateIndexAsync()` beside `Program.cs:902-909`. ‼️ **No `--index-only` / `--skip-cosmos` flag exists** — every run does Cosmos containers → synonym map → indexes → sample data |
| ‼️ **Put the new initializer in its OWN .cs file** | `ProviderIndexDefinitionConventionTests` **reads `Program.cs` as raw text** and splits it at the literal marker `"class ProviderSearchIndexInitializer"`, attributing everything before/after to the service/provider index. A third class added inside `Program.cs` lands in one of those halves and will trip guards that have nothing to do with it |
| **Shared name constants** | Profile/semantic-config names belong in `clinqetcore\Utilities\SearchScoringProfiles.cs`, not as bare strings (`voiceCatalogScoring` being a bare const is the outlier, not the pattern) |
| **Container policies** | The new `KnowledgeBase` container's policy goes in `clinqetcore\Cosmos\Setup\CosmosContainerPolicies.cs` (the 8 existing containers each have a method there) and is added to `CosmosDbInitializer.InitializeAsync()` (`Program.cs:78-112`). Update strategy is `ReplaceContainerAsync` → fallback `CreateContainerIfNotExistsAsync` |
| **Run command** | `cd C:\Nik\cosmosindexsetup` then `dotnet run --launch-profile "Dev (Canada)"` **and** `--launch-profile "Dev (India)"` — both regions are separate search services |
| ‼️ **Never bare `dotnet run`** | Without `--launch-profile` it silently applies the FIRST profile (`Dev (India)`), and a profile's `environmentVariables` **override the shell** — so `set CLINKET_REGION=ca` does nothing |
| **Verification** | REST-verify with `api-version=2026-04-01` or newer; older versions omit unknown properties and produce confident false negatives |
| **Deploy wiring** | `deploy.ps1:1594-1595` builds `$searchIndexName` / `$providerSearchIndexName` from `$envResourceSuffix`; add `$knowledgeSearchIndexName` beside it and wire `AISearch__KnowledgeIndexName` into the **four** app-settings blocks (`~6814, ~6957, ~7374, ~7602`) |
| **A second `SearchClient` cannot be DI-registered by concrete type** | Wrap it the way `ProviderSearchClient` is wrapped |

> **Also true and worth remembering:** dropping and recreating an index does **not** repopulate it — the index
> is a projection, and only a write puts documents back. And Azure **rejects an index update that drops a
> field**, which is why retired fields are kept emitting (`SearchDocument.cs:110-115`). Design the passage
> schema as if fields are permanent.

## 7.3c Container economics — the verified math (owner demanded data, not feelings — 2026-08-18)

The owner re-opened D12: new `KnowledgeBase` container vs folding into `ProviderData` (semantically "it's
provider data") vs any other container. Analysis against the REAL provisioning model:

**Fact 1 — how throughput is actually provisioned (verified in this repo):**
`azureautomation\database.json:118` states it verbatim: on the Provisioned stamp *"all its throughput is the
autoscale shared DB"*; the alternative stamp mode is **Serverless** (pay-per-request). `CosmosDbInitializer`
creates ONE database at autoscale 1000 RU/s (serverless fallback) holding all 8 containers.

**Fact 2 — the "new container divides the RUs" premise is inverted.** In a shared-throughput database the
RU pool is **shared dynamically across all containers** — a new container neither reserves nor fragments
throughput. Static RU *division* happens across physical partitions of a large container (>50 GB / >10k
RU/s), which nothing here approaches. And per Azure's documented rule, **the first 25 containers share the
1000 RU/s autoscale max with NO minimum increase** — the forced minimum only rises at container #26
(min = 1000 + max(N−25,0)×1000). `KnowledgeBase` is container **#9 of 25**. On the Serverless stamp,
containers carry no throughput cost at all.

**Fact 3 — marginal cost of the new container: $0.** Container #9 in the shared pool: no minimum bump.
Serverless: no per-container cost. The one future watch-item: at container #26 the minimum jumps — we are
17 containers away.

**Fact 4 — per-operation RU favors the NEW container.** RU per write is a function of item size ×
**indexing policy**, not of which container hosts it. `KnowledgeBase` gets a trimmed policy (businessId,
docId, status, docType, updatedAt) ⇒ a ~1.5 KB registry write ≈ **8–12 RU**; the same document in
`ProviderData` (whose policy serves 15+ families) ≈ **12–20 RU**. Reads are identical (point/partition).
Total volume is noise either way: ~4 writes per document lifecycle ⇒ even 1,000 providers × 20 docs ≈ 80k
writes ≈ ~1M RU **lifetime** ≈ under $0.30 on serverless rates.

**Fact 5 — the decisive architectural reason: ProviderData's change feed is production plumbing.**
`SearchIndexSyncFunction` is a CosmosDBTrigger on `ProviderData`. Folding the registry in means **every
registry write and status flip wakes the search-sync function forever**, to be recognized and discarded —
wasted invocations + change-feed RU + a new document family inside a function that syncs the contract-frozen
services index. `KnowledgeBase` has no change-feed consumer: zero coupling.

**Fact 6 — the other containers disqualify on partition key alone:** `Communications` (`/userNumber`),
`Messages` (`/conversationId`), `CustomerData` (`/customerId`), `SystemData` (`/pk`, platform docs). Only
`ProviderData` was ever a real alternative.

**VERDICT (data-confirmed, D12 stands): the NEW `KnowledgeBase` container, `/businessId`.**
It costs $0 more, writes ~30–40% cheaper per operation, stays off the search-sync change feed, and keeps
lifecycle (purge/TTL/growth) independent. Folding into `ProviderData` would save nothing measurable and buy
permanent change-feed coupling. Registry storage stays tiny regardless — the FILES live in blob, never in
Cosmos.

## 7.4 The `KnowledgeBase` container and its registry document

**Container:** `KnowledgeBase`, partition key **`/businessId`** (D12 — confirm the exact key at the gate).
Policy method in `CosmosContainerPolicies.cs`; indexing policy trimmed to what we actually filter/sort on
(`businessId`, `docId`, `status`, `docType`, `updatedAt`) per §0.11; no TTL by default (documents live until
deleted), with the option reserved.

**Registry document** (one per uploaded file or typed FAQ): `id`/`docId`, `businessId` (pk), `docName`,
`docType`, `linkedServiceId?`, `status` (`Processing | Ready | Failed`), `failureReasonKey?` (a
**localization key**, never English), `sizeBytes`, `pageCount?`, `passageCount?`, `contentHash`, `blobPath`,
`sourceKind` (`File | TypedFaq`), `faqQuestion?`, `faqAnswer?`, `createdAt`, `updatedAt`, plus
`BaseEntity`/ETag. A `DocumentType.KnowledgeDocument` discriminator value is still added (append-only —
never reorder; enums serialize as strings) because every repository in this codebase filters on it.

## 7.4b Upload UX + metadata — the final shape (locked 2026-08-18, owner-questioned and re-confirmed)

**Multi-file, with metadata that NEVER blocks an upload.** The upload path is always just "pick files →
done": each file uploads immediately and independently. The two optional details — **type** (Spec sheet /
FAQ / Policy / Price list / Other — a fixed 5-value C# enum, deliberately NOT a manageable taxonomy or
category tree; default Other) and **link to one offering** (mainly spec sheets) — are settable inline at
upload OR later from the document's row. Post-upload edits update the registry (display truth) immediately;
the embedded cards refresh on *Reprocess* (§7.8b cases G/H — index truth follows one tap). One-at-a-time was
considered and rejected: providers arrive with several documents at setup, per-file independence removes all
batch fragility, and optional-deferred metadata keeps multi exactly as simple as single.

**Where each thing lives:** original file → blob `provider-knowledge/{businessId}/{docId}/…` · the document
record (name, docType, linkedServiceId, status, counts) → the **`KnowledgeBase` Cosmos container** · the
searchable cards (with `docType` + `linkedServiceId` copied onto each) → the **`clinket-knowledge` index**.
**A typed FAQ** is entered, edited and deleted inline in the Knowledge page's FAQ section — stored as a
registry record (`sourceKind: TypedFaq`, holding `faqQuestion`/`faqAnswer`) plus exactly one index card,
live the moment it is saved (no processing wait); editing it re-embeds that one card immediately (an FAQ has
no Reprocess concept — it IS its own source).

## 7.5 API endpoints (`clinqetapi` — new `KnowledgeController`)

Modelled directly on `AIAssistantController.GenerateProviderSetupUploadUrl` (verified pattern: permission
attribute → `ForbidUnlessPartnerAsync()` → `GetCurrentBusinessId()` → validation with localized errors →
`SasUrlRequest` → `_storageService.GenerateSasUrlAsync` → `ApiResponse<T>`).

| Endpoint | Purpose | Notes |
|---|---|---|
| `POST /knowledge/documents/sas-urls` | **Batch** SAS issuance (D15) — request `[{ fileName, contentType, fileSize }]`, response `{ uploadSessionId, uploadUrls[] }` | Per-file validation (extension, MIME, size, filename sanitisation via `FileValidationHelper`, extension↔MIME consistency) **and the 20-doc cap** enforced before issuing. Mirror `LicensesServices/{id}/documents/sas-urls` |
| `POST /knowledge/documents/confirm` | Confirm **only the files that landed** | Writes one registry row per file (`Processing`), enqueues one `knowledge-ingest` message each. Idempotent on `contentHash` + `docId` |
| `GET /knowledge/documents` | List for the page | Registry read, partition-scoped |
| `DELETE /knowledge/documents/{docId}` | Full purge | Passages → registry → blob |
| `POST /knowledge/documents/{docId}/reprocess` | "Try again" on a failed doc | Re-enqueues; no re-upload needed |
| `POST /knowledge/faqs` · `PUT /{id}` · `DELETE /{id}` | Typed FAQs | Indexed immediately (single passage, no DI, no queue wait) |

All gated by `voice.settings.manage` (write) / `voice.read` (read) — **D17, no new permission key**.

## 7.6 The ingestion function (`clinqetfuncations`)

New Service-Bus-queue-triggered function following the `MediaDerivativeProcessorFunction` pattern
(`clinqetfuncations\Clinqet.Communications\Functions\MediaDerivativeProcessorFunction.cs`).

**Verified trigger shape** (L90): queue names are **settings-bound**, not constants —
`[ServiceBusTrigger("%ServiceBusSettings:KnowledgeIngestQueueName%", Connection = "ServiceBusConnection")]`.
Deserialization failure **explicitly dead-letters** with a reason (L108-116) rather than throwing; copy that.
The function takes the raw message so it can access `MessageId` for logging and dedup.

‼️ **No general-purpose text-chunking utility exists in the solution** (verified — the `Chunk` hits in
`AzureSearchIndexer` are index-write batching, not text splitting). The chunker is new code: put it in
`clinqetinfrastructure\Services\Voice\` (or `…\Knowledge\`) as a pure, dependency-free, unit-testable class,
and test it from the **Functions** suite (§0.18 — Functions is the runtime consumer).

**How the work order flows (owner question 2026-08-18 — confirmed: SERVICE BUS trigger, and the queue
message is deliberately minimal):** the message carries only `{businessId, docId}` (+ correlation). The
function's first act is a **partition-scoped point read of the registry row — the registry IS the work
order**: `blobPath`, `docType`, `linkedServiceId`, `contentHash`, `sourceKind` all come from there, never
from the blob name and never trusted from the message body (redelivery-safe: a retried message re-reads
CURRENT state, so an edit or delete between attempts is honored). `docType` and `linkedServiceId` enter the
system in the **confirm API call** (the UI's optional selects) and land on the registry before the message
is ever sent. The function then resolves `linkedServiceId → offering name` with ONE point read
(`ServiceRepository`, same partition) for the prefix and the index field; a missing/deleted offering just
means no link (§7.8b case H).

Pipeline: **read registry (work order) → download blob → extract → chunk → embed → upsert passages →
update registry.**

Non-negotiables:

- **Idempotent** — deterministic passage ids; a redelivered message overwrites. `contentHash` short-circuits
  identical re-ingest. Re-upload deletes that `docId`'s passages first (delete-by-filter), then upserts.
- **Every step has a degrade** — extraction/embedding/index failure ⇒ registry `Failed` +
  `failureReasonKey` + `FailureNotificationHelper` admin alert. **Never a half-indexed document.**
- **Bounded, with the D25 overflow contract** — page cap checked at extraction; then, AFTER chunking and
  BEFORE any embedding/index spend: existing passages (a $0 count query on the index, business-filtered) +
  this document's chunk count decide the outcome — fits ⇒ index fully; over cap but within
  `OverflowGraceFactor` (1.10) ⇒ index FULLY; beyond ⇒ whole document `Failed` ("knowledge space is full",
  localized), nothing partial, blob retained so delete-then-retry works. **A document is all-in or all-out.**
  The session-enabled queue (D25) means one business's documents process one-at-a-time, so two concurrent
  uploads cannot race past the cap.
- **Thread-safe and leak-free** — `await using` on blob streams; batch embedding calls; no unbounded
  parallelism (respect `host.json` concurrency); honour the function's `CancellationToken`.
- **DLQ** on unprocessable messages, per platform standard.

## 7.7 Extraction (D13) — and the three gaps that will stop you

**Model (D13 revised, routing per D28): `prebuilt-layout` with `outputContentFormat=markdown`** (v4.0 GA API
`2024-11-30`) — **paid for ONLY where OCR/layout genuinely needs it: PDFs and standalone images.** It
returns **structured markdown**: headings as `#`–`######`, **tables as HTML** (`rowspan`/`colspan`/
`<caption>` preserved), figures as `<figure>` blocks, and page furniture (`PageHeader`/`PageFooter`/
`PageNumber`) as HTML comments the chunker strips. **Everything born-digital parses LOCALLY at $0 (D28):**
DOCX via OpenXML (native headings/tables/lists; embedded images routed through the D26 path one by one),
XLSX via OpenXML (sheet sections, header-row heuristic, cached values), HTML via a local sanitizing parser,
TXT/MD/JSON directly (full-JSON bodies flattened to `key: value` lines). Typed FAQ → no file at all.
DI returns **text — never embeddings** (we embed).
The shared service today defaults to `prebuilt-read` (`DocumentIntelligenceService.cs:406-412`) and that
default is used by provider onboarding — so the new public raw-extract method takes **model + output-format
parameters**, and knowledge reads its own `Voice:Knowledge:ExtractionModelId` (default `prebuilt-layout`) /
`ExtractionOutputFormat` (default `markdown`), leaving `AzureDocumentIntelligence:ModelId` untouched.
Formats DI accepts: PDF, JPEG/JPG, PNG, BMP, TIFF, HEIF + DOCX (‼️ **WEBP is NOT accepted** — client
transcodes or the upload is rejected with a localized reason). ‼️ XLSX never touches DI — it parses locally
per D28. Limits: 500 MB, 2,000 pages — far above our caps.

‼️ **Gap 1 — there is no public raw-text method.** The only public member is
`ExtractContentFromUrlAsync(...)`, a full *provider-onboarding* pipeline returning
`AttachmentExtractionResultDto` (business name, hours, services…) that runs three LLM phases. The raw OCR
text comes from `private async Task<string> ExtractTextFromDocumentUrlAsync(string fileUrl, ...)` (L398).
**Add a new public member** to `IDocumentIntelligenceService` exposing it (e.g.
`ExtractRawTextFromUrlAsync`). Do **not** fish `RawText` out of the DTO — it is unset on the vision path and
would run the whole LLM pipeline for nothing.

‼️ **Gap 2 — DI is not registered in the Functions host.** `IDocumentIntelligenceService` and the
`AzureDocumentIntelligence` settings section are bound only in `clinqetapi\Clinqet.API\Program.cs:766-771`.
The Functions host has `IEmbeddingService` (L716), `IAICompletionService` (L584-590),
`IAzureSearchIndexer` (L766), `IAzureStorageService` (L571), `IServiceBusService` (L337) — but **not DI**.
Add both the `Configure<AzureDocumentIntelligenceSettings>` binding and the typed `AddHttpClient`.
‼️ The host runs `ValidateOnBuild = true` (`Program.cs:73-88`) — **an unresolvable dependency is a boot
failure for the entire function app**, not a runtime error in one function.

‼️ **Gap 3 — DI settings are not deployed to the Function App.** `AzureDocumentIntelligence__Endpoint`,
`__ApiKey`, `__AiDeploymentName` are set only in the **API** blocks of `deploy.ps1` (applied ~L6970-6976,
emitted ~L7387-7393). Add all three to the Function App blocks (applied ~L6680, emitted ~L7518). The
resource itself already exists per stamp (PHASE 2c, `ai.json`), and `AzureAIFoundry__*` + `AISearch__*` are
already on the Function App — so embeddings and search need no infra change.

‼️ **Private container + DI = a read SAS.** DI fetches the document itself via `urlSource` (a plain URL
string). Our container is private, so the function must hand DI a **read-SAS URL**
(`IAzureStorageService.GetUrlForReadAsync` / `UploadDocumentAndGetReadSasUrlAsync`;
`StorageConfiguration:ReadSasExpiryMinutes` defaults to 30).

**The engine-per-type table (owner question 2026-08-18 — exactly what runs where, and in what C#):**

| Type | Engine | What it is | Network? | Cost |
|---|---|---|---|---|
| PDF (any) | `DocumentIntelligenceService` → Azure DI `prebuilt-layout`, markdown out | Existing service, HTTP call to Azure | Yes | $10/1k pages |
| Images (standalone) | Same DI call (OCR is built in) + `AICompletionService` vision caption | Existing services | Yes | ~$0.011 |
| DOCX / XLSX | **`DocumentFormat.OpenXml`** (Microsoft's official NuGet) — reads the file's own XML: headings from styles, native tables, lists, embedded image parts | New library, **in-process**, runs inside the ingestion function | **No** | **$0** |
| HTML / HTM | **HtmlAgilityPack-class parser** — DOM walk | New library, **in-process** | **No** | **$0** |
| TXT / MD / JSON | Plain .NET (`System.Text.Json` for the JSON flatten) | Nothing new | **No** | **$0** |

**HTML — what "kept" means precisely:** structure is preserved, raw tags are NOT stored as text.
`h1–h6` become section headings (they drive `sectionPath` and split points — never the literal string
`<h1>` in a card); paragraph/list text is kept as clean text; **`<table>` is the one element stored AS
HTML** (inside table cards, per D24 — LLMs read HTML tables best); `script/style/nav/header/footer/iframe`
are deleted; inline tags (`b`, `span`, `a`) are unwrapped to their text — anchor TEXT is kept, `href` URLs
are dropped (a URL is unspeakable noise on a phone call).

**Word with images — NO checkbox, fully automatic (owner question):** OpenXML exposes embedded images as
enumerable parts. The parser walks them: none found ⇒ pure-text path; found ⇒ each image is routed through
the D26 caption path at its position in the document. To avoid captioning logos and decorative flourishes,
embedded images below `EmbeddedImageMinBytes` (10 KB) or `ImageCaptionMinPixels` (200×200) are skipped —
both settings. The provider is never asked anything (consistent with "metadata never blocks", §7.4b).

**Behaviour to design around:** blank endpoint/key makes DI **silently return empty string** (L400-404) —
treat empty text as a `Failed` document, never as a successful empty one. Polling is exponential-backoff to
`PollMaxDelayMs`, with `maxAttempts = max(10, TimeoutSeconds / 2)` — the wall clock can exceed
`TimeoutSeconds`, so the function needs its own deadline. Exhausted retries throw
`InvalidOperationException("Document URL analysis failed after maximum retries")`.

**Images (D26) — what does the OCR, exactly:** the OCR engine is **built into Azure Document Intelligence
itself** — the SAME `prebuilt-layout` call that processes PDFs reads the text out of a photo (printed AND
handwritten), at the same $10/1k-pages price, with **no separate OCR product, dependency, or setting**. So
"OCR" here is not a new thing to provision — it is what DI already does when handed an image. Then, when
`ImageCaptioningEnabled` (default true), each image gets ONE
gpt-5.4-mini vision call (`GetStructuredCompletionWithImageAsync` already exists on `AICompletionService`)
producing a factual caption — what it shows, brands/models, any legible text, no speculation — stored as a
`chunkKind: ImageCaption` card alongside any OCR cards. **Downscale before captioning** (flagged GPT-5.4-mini
image-token anomaly). OCR empty AND caption empty ⇒ `Failed` ("no readable content"). No image vectors, ever
— voice can only speak text (full rationale in D26).

**Edge cases → distinct localized `failureReasonKey`:** password-protected, corrupt/unreadable, zero-text
scan with nothing captionable, page count over cap, knowledge space full beyond grace (D25), unsupported
format slipped past the client (WEBP/XLSX), DI throttled/timed out, embedding failure or wrong-dimension
vector, index write failure.

**Extraction BILLING edge cases (documented so nobody re-litigates):** (a) the page cap is enforceable only
POST-analyze (DI reveals the page count by analyzing) ⇒ an oversized upload bills its analyzed pages once and
then fails the cap — bounded waste ≤ ~$1–2 for the largest file that fits in 20 MB, rare, accepted; a local
PDF page pre-count is a documented later optimization, not v1. (b) `contentHash` means a re-upload of
identical bytes bills **nothing**. (c) DI submit retries are bounded by `MaxRetries` (3) — worst duplicate
billing is a failed doc's pages × retries, cents. (d) A `Failed` document can be retried with "Try again"
WITHOUT re-uploading (the blob is retained) — it re-bills extraction for that document only.

## 7.8 Chunking + embedding — the design, and why it differs from service enrichment

> **In plain words (owner-approved framing — keep this rationale alive):** every document is cut into small
> **cards** (a few hundred words). Each card is stored by its **exact words** and by its **meaning**. Before
> storing the meaning we write **one free header line** on the card — *document name — section — linked
> offering* — so a stray sentence like "Max depth: 52 ft" becomes findable. We do NOT AI-enrich cards the
> way we enrich services: a service is three sparse words needing invented vocabulary; a card is already a
> paragraph of the provider's own words. The header mechanism is identical for every trade — a dentist's
> card reads "Insurance policy — Accepted plans: …", a fence company's "Warranty terms — Wood fences: …" —
> with **zero industry-specific code** (D21). The excavator was only an example.

**This is the question the owner asked explicitly. The answer:**

Services get **AI enrichment** (`commonSearchPhrases`, `userIntentPhrases`, `broadMatchTerms`,
`alternativeNames`, `synonyms`…) because a service document is **short and sparse** — a name plus a brief
description. "Balayage" contains none of the words a caller says ("hair colouring", "highlights"), so an LLM
must manufacture the vocabulary bridge.

A knowledge passage is the **opposite**: 200–500 words of the provider's own natural language, already
containing its own vocabulary. Running an LLM enrichment pass per passage would cost **one LLM call per
chunk** (a 100-page document ≈ 250 chunks ≈ 250 calls) for marginal retrieval gain. **Rejected (D11).**

**What we do instead — the structural context prefix (free, high value):**

A passage reading *"Max dig depth: 52 ft"* is meaningless in isolation and embeds poorly. Before embedding,
prepend the structural context the passage came from:

```
CAT 340 Long-Reach Excavator — Spec sheet — Working ranges
Max dig depth: 52 ft. Max reach at ground level: 57 ft 3 in. …
```

That is `linkedServiceName — docName — sectionTitle` + the passage text. Zero extra LLM calls, dramatically
better embeddings and BM25 hits. The prefix is embedded and searchable; the **spoken** answer still uses the
clean passage text plus its source name.

**Category/subcategory in the prefix (owner question 2026-08-18 — YES, prefix-only, NO new index fields):**
when a document has a linked offering, that offering's **subcategory (and category) NAME rides in the prefix
line** — e.g. `CAT 340 Long-Reach Excavator (Excavators) — Spec sheet — Working ranges`. The names come free
with the ingest-time point read (the global category list is already cached platform-wide). Why prefix-only:
the prefix is stored inside `content`, which is **searchable — so BM25 and the vector both already reach the
category words** ("do you have excavator specs?" matches); separate index fields would add only
*filterability* we never use (knowledge narrows by `linkedServiceId`, never by category) and permanent schema
for it. Unlinked documents (policies, FAQs, price lists) get nothing — there is nothing truthful to add.
Guard unchanged: the whole prefix stays ~10–20% of the card.

**The chunking algorithm — locked as D24 (evidence-backed, 2026-08-18):**

*Granularity decision matrix — all options considered:*

| Option | Verdict | Why |
|---|---|---|
| One card per **document** | **Discarded** | Embedding input caps at 8,191 tokens (a 100-page doc doesn't fit); a whole-doc vector is retrieval mush; returning it blows the 1.5k voice budget |
| One card per **page** | **Discarded** | A page is a *printing artifact*, not a meaning unit — it cuts mid-sentence **by definition** (the exact failure the owner asked to prevent); pages mix topics; 500-800 tokens each crowds the budget. `pageNumber` survives as metadata |
| **Small structure-aware cards** (~350 tokens) | **LOCKED** | The convergence zone of every credible eval: Chroma 200-400 recursive best; NVIDIA factoid bracket 256-512; Snowflake ~450 optimum; Azure's 512/25% starting guidance; Microsoft's flagship hybrid eval ran on 512-token chunks; 5 cards × ~300 ≈ the 1.5k voice budget exactly |
| Embedding-similarity "semantic chunking" | **Discarded** | NAACL Findings 2025: does not consistently beat structural splitting on real documents; costs more compute |
| Small-to-big / neighbor expansion | **Deferred, zero-cost option kept open** | No vendor-grade benchmark; adds a second lookup inside a sub-second budget; deterministic ids `{businessId}_{docId}_{chunkNo}` make neighbors a later point-read — **no schema needed now** |
| Per-doc **summary card** (`DocSummary`) | **LOCKED (included)** | Nearly free (rides the D11 call); catches broad asks ("tell me about your warranty policy") that no fine card matches |

*Cutting mechanics (never a meaningless cut — the owner's explicit concern):*
1. Split on the **layout markdown structure** first: `#`–`######` section headings, then blank-line
   paragraphs, then **sentence ends** (Unicode-aware, abbreviation-guarded), then word boundaries as the
   absolute last resort. **Never intra-word; a card only ever ends where a sentence ends.**
2. Targets (all settings): `ChunkTargetTokens` **350**, `ChunkMaxTokens` **512** hard,
   `ChunkMinTokens` **120** — a tail smaller than this **merges into the previous sibling** within the same
   section (OpenAI enforces a similar floor; Unstructured's `combine_text_under_n_chars` is the same idea).
   Token counts are char-approximated (~4 chars/token) — chunk sizing never needs tokenizer precision and
   the 8,191 embedding cap has 15× headroom at these sizes.
3. **Overlap 15%, composed of whole trailing sentences** — never raw characters. (Azure's fixed-size
   guidance says 10-15%; Chroma's eval shows large overlaps — OpenAI's 50% default included — actively hurt
   precision.)
4. **Tables:** atomic if ≤ max. Oversized ⇒ split by **row-groups with the header rows repeated in every
   part** + the nearest section heading carried (the uniform practitioner standard). A short paragraph
   immediately preceding a table rides along as its caption. Table cards **store the HTML table** exactly as
   layout emits it — Microsoft's WSDM'24 research shows LLMs read HTML tables ~6.8% better than plain text —
   while the **vector is computed from a compact text serialization** (headers + row values + prefix),
   because markup tokens are noise to the embedder but signal to the generator. (The serialization choice is
   flagged: no rigorous public benchmark — A/B against raw-markdown embedding later.)
5. **Strip page furniture before chunking:** layout emits `PageHeader` / `PageFooter` / `PageNumber` as HTML
   comments — drop them (repeated boilerplate pollutes BM25 and wastes cards).
6. **A typed FAQ is exactly one card**, always (if a huge answer exceeds `ChunkMaxTokens`, split the ANSWER
   at sentence ends and repeat the question line at the top of every part).

### 7.8b THE CHUNKER EDGE-CASE CONTRACT (owner-mandated 2026-08-18 — every case named, every case handled)

The chunker is pure, dependency-free, and unit-tested case by case in the Functions suite. This table IS the
test list — the next session implements each row as at least one test.

| # | Edge case | Rule |
|---|---|---|
| 1 | **Sentence boundary detection** | A boundary is a terminator (`. ! ? …` **and the Indic danda `।` / double-danda `॥`**) **followed by whitespace**. No whitespace after the terminator ⇒ NOT a boundary. |
| 2 | **Decimals and versions** (`52.5 ft`, `v2.1`, `1,200.50`) | Covered by rule 1 — the period is followed by a digit, not whitespace ⇒ never a boundary. |
| 3 | **Abbreviations** (`Dr.`, `e.g.`, `No. 5`, `U.S.A.`) | Small built-in Latin abbreviation guard list (language mechanics, not industry vocabulary — D21-safe) + single-letter-plus-period never ends a sentence. Imperfect by nature ⇒ worst case is a slightly early cut AT A WORD BOUNDARY, never mid-word. |
| 4 | **OCR line-break hyphenation** (`instal-\nlation`) | Dehyphenate when a line ends with `-` and the next starts lowercase (join, drop hyphen); keep the hyphen when the next line starts with uppercase/digit (likely a real compound). Heuristic — flagged in code. |
| 5 | **A single paragraph longer than `ChunkMaxTokens`** | Split at sentence ends inside it. |
| 6 | **A single SENTENCE longer than `ChunkMaxTokens`** (legal boilerplate) | Split at the last word boundary under the max, with sentence-fragment overlap; log a warning marker. The only case a card may end mid-sentence — and still never mid-word. |
| 7 | **Headings with no body / consecutive headings** | Fold into the next card's section path; never emit a heading-only card. |
| 8 | **A document with NO headings** (flat TXT, plain letters) | Paragraph → sentence splitting only; `sectionPath` empty; prefix = `docTitle — docType`. |
| 9 | **Deep heading nesting** | `sectionPath` = nearest headings up to depth 3 (mirrors Azure's `h3` guidance), joined `" › "`, clamped to 120 chars. |
| 10 | **Bulleted/numbered lists** | A list is atomic up to the max (a list item is a sentence-equivalent unit); oversized lists split BETWEEN items, never inside one; the list's intro line repeats in each part. |
| 11 | **Tables — no header row detectable** (no `<th>`) | Treat row 1 as the header heuristically; if row 1 looks like data (all numeric), fall back to positional labels (`col 1: …`) in the serialization. |
| 12 | **A single table ROW exceeding the max** | Serialize that row cell-by-cell (`header: value` lines) and split between cells. |
| 13 | **Nested tables** | Flatten inner tables into their cell's text (rare; layout mostly pre-flattens). |
| 14 | **`rowspan`/`colspan` merged cells** | The stored HTML keeps them verbatim (the LLM reads HTML well); the embedded serialization repeats the spanned value into each covered position. |
| 15 | **Table caption** | A `<caption>`, or a short paragraph (≤200 chars) immediately preceding the table, rides along with every part of that table. |
| 16 | **`<figure>` blocks** | Any text inside is kept; the figure otherwise contributes nothing (image content arrives via the D26 caption path). |
| 17 | **Page break mid-sentence** | `<!-- PageBreak -->` comments are removed BEFORE splitting, so text joins across pages; `pageNumber` = the page the chunk STARTS on. |
| 18 | **Whitespace/control chars/encoding** | NFC Unicode normalization; collapse runs of whitespace; strip control chars (mirror the catalog `Sanitize`); never emit an empty or whitespace-only card. |
| 19 | **Duplicate cards within one document** (repeated boilerplate the furniture-strip missed) | Per-document content-hash dedupe — identical normalized text keeps only the first card. |
| 20 | **Tiny documents** (< `ChunkMinTokens` total) | One card, whatever its size. A document always yields ≥1 card or fails honestly. |
| 21 | **Overlap on tiny cards** | Overlap is skipped when the previous card is smaller than the overlap window — overlap must never dominate a card. |
| 22 | **Chunk numbering stability** | `chunkNo` is assigned in document order in one pass ⇒ deterministic ids; a re-ingest of identical content produces identical ids (idempotent overwrite, D25). |
| 23 | **Token counting** | Char-approximation (~4 chars/token) everywhere, consistently — sizing needs consistency, not tokenizer precision; the 8,191 embedding cap has 15× headroom at these sizes. |
| 24 | **Mixed languages inside one document** | Language is detected per document (D11 call), not per card; retrieval is language-agnostic anyway (`standard.lucene` + multilingual vectors). |
| 25 | **RTL scripts** | Out of scope — the platform's five languages are all LTR; flag, don't build. |
| 26 | **Markdown source files** (`.md`) | Same pipeline, headings native; fenced code blocks are treated as atomic preformatted paragraphs. |
| 27 | **TXT whose body is entirely JSON** | Detected by a full parse attempt; flattened to readable `key path: value` lines (arrays indexed), then chunked normally. Mixed text+JSON stays plain text. Same for `.json` files (D28). |
| 28 | **HTML noise** | `script`/`style`/`nav`/`header`/`footer`/`iframe` stripped BEFORE structure mapping; `h1–h6` → headings; `<table>` kept as a table card; entities decoded; nothing executable is ever stored. |
| 29 | **DOCX embedded images** | Extracted during the local parse and routed through the D26 image path individually (caption + OCR), placed as cards at their document position; the text around them parses locally at $0. A DOCX with zero text and only images degrades to the pure-image path. |
| 30 | **XLSX mechanics** | One section per sheet (sheet name = section title); first row = header heuristic (all-numeric row 1 ⇒ positional labels); cached formula VALUES read, never formula strings; empty cells skipped; hidden sheets skipped; oversized sheets split by row-groups with headers repeated (same as tables); a workbook with no cell values fails honestly. |
| 31 | **Encrypted/password-protected Office files** | OpenXML parse throws ⇒ the same localized password-protected failure as PDFs. |
| 32 | **Decorative/tiny embedded images** (logos, divider flourishes in DOCX) | Skipped when below `EmbeddedImageMinBytes` (10 KB) or `ImageCaptionMinPixels` (200×200) — both settings — so a letterhead logo never burns a caption call. |
| 33 | **HTML anchor links** | Anchor TEXT kept, `href` dropped (URLs are unspeakable noise); `script/style/nav/header/footer/iframe` deleted before any structure mapping; `h1–h6` become headings, never literal tag strings in a card. |
| 34 | **Delete lands while the document is Processing** | Tombstone rule: the delete endpoint purges immediately; the ingestion run re-reads the registry row (ETag CAS) **before its final commit** — gone/tombstoned ⇒ purge own writes for that `docId`, exit without committing. No resurrection, no half-delete. |
| 35 | **Replace with a SHORTER new version** | New cards upsert over the same deterministic ids (0…N−1); stale old ids with `chunkNo ≥ N` are pruned in the same commit — a 40-card doc replaced by a 25-card version leaves exactly 25 cards. Old cards serve callers until that commit (gapless swap). |

**Doc-level (D11 call + prefix) edge cases — same rigor:**

| # | Edge case | Rule |
|---|---|---|
| A | Junk filename (`scan_001.pdf`, `WhatsApp Image….jpg`) | The D11 title replaces it everywhere the model sees a name; registry keeps the original filename for the provider's own recognition. |
| B | Two documents with the same filename | Allowed — `docId` disambiguates; the D11 titles will usually differ; the UI shows upload dates. |
| C | Identical file re-uploaded | `contentHash` short-circuit: no re-extraction, no re-spend; registry row refreshed. |
| D | Non-English document | The D11 call answers in the DOCUMENT's language; title/summary/prefix stay in that language (retrieval is cross-language via vectors; a Hindi card is spoken by a model that reads Hindi natively). |
| E | D11 call fails or times out | Degrade: title = cleaned filename, no summary, no `DocSummary` card — ingestion NEVER blocks on the nicety. |
| F | Summary hallucination risk | Structured output, temperature 0, input clamped to the first ~6k chars + heading outline, summary clamped to `DocSummaryMaxChars`; the summary card is retrieval bait, never quoted as a fact source over the underlying cards. |
| G | Provider renames a document later | Display name changes freely in the registry; the embedded prefix keeps the ingest-time title (re-embedding on rename is not worth it). A "Reprocess" re-ingests with the new name if the provider cares. |
| H | Linked offering later deleted/renamed | `linkedServiceId` filter simply matches nothing (dangling id is inert); the prefix keeps the ingest-time offering name — acceptable staleness, fixed by Reprocess. |
| I | Empty extraction (blank/black scan) | Failed BEFORE the D11 call — no LLM spend on unreadable documents. |

**Embedding:** `IEmbeddingService` (`AzureAIFoundryEmbeddingService`, `text-embedding-3-large` per
`appsettings.json:1941`) — already registered in the MCP host (`Program.cs:249`); confirm/add registration in
the **Functions** host for the ingestion side. Batch requests; respect its timeout; a failed batch fails the
document (never a partial index).

**Why hybrid search closes the remaining gap:** embeddings blur exact tokens. "Delta Dental", "52 ft", a part
number — those are caught by the **BM25 leg** over `content`/`sectionTitle`/`docName`. Vector catches
meaning ("insurance" → "we accept Delta Dental and Sun Life"). Running both is what makes this work across
every trade.

**The per-document LLM call is now v1 (D11 refined, 2026-08-18)** — one gpt-5.4-mini structured call per
document at ingest (`{title, summary, language}` from the first ~6k chars + heading outline, ~$0.002,
degrade = filename title + no summary). It feeds the `docTitle` field, every card's prefix, the `DocSummary`
card, and the registry display name — and fixes the junk-filename edge case (`scan_001.pdf`) for every trade.
**Per-chunk LLM context stays rejected**: Snowflake's eval measured it *negative* (−5.8 pts) while doc-level
context prepended to chunks gained +15–25 pts; Anthropic's contextual-retrieval numbers (−35% to −49% failed
retrievals) show the win comes from context *presence*, which the structural prefix supplies at ~4× lower
cost. If retrieval quality ever measurably lags, full per-chunk contextualization is the documented,
settings-gated escalation — evidence first.

## 7.9 Retrieval — the `search_knowledge` MCP tool

> **In plain words:** one library, one **locked lane per business**. The server locks the lane when the call
> starts (from the phone-line binding — the AI never chooses it). Every search: our code stamps the
> "only this business" wall onto the query (and refuses to run a query without it); **one** request checks
> exact words and meaning together; the top 5 cards come back with their document names; our code re-checks
> the business stamp on every card — one wrong card throws the whole answer away and alarms. Searching
> another business is **structurally impossible at four layers**, not a policy (D22).

How the AI searches across many spec sheets, and how `businessId` scopes it (the owner's question):

- **One index holds every business's passages.** Isolation is a **query-time filter plus row-level
  verification** — the exact 5-layer pattern `ProviderCatalogSearchService` already implements and which
  the 2026-07-28 audit hardened. Layer 4 is the one that matters: every returned document's `businessId` is
  compared to the bound one, and a single mismatch **discards the whole result set, alarms, and fails
  closed**. (Cosmos is structurally safe because `businessId` IS the partition key; the search index is not,
  so verification is mandatory.)
- **Hybrid query — ONE round trip (D23)**: BM25 over `content`, `sectionTitle`, `docName` **and** the vector
  over `contentVector` are sent together in a **single** Azure AI Search request (the standard hybrid shape),
  filtered `businessId eq '<bound>'`, top-K 5 (D27), ≤1.5k tokens returned. This deliberately differs from the
  catalog service's sequential lexical-then-vector ladder: knowledge retrieval is simpler, and one request is
  both faster and cheaper than two.
- **Query embedding — cached, and fail-soft**: the caller's phrase is embedded once
  (`AzureAIFoundryEmbeddingService` already caches by `emb_{deployment}_{sha256}` with single-flight, so
  repeated phrasings are free). ‼️ The embedding service **returns an empty array on failure rather than
  throwing** — when that happens, or when it is slow, send the request **keyword-only in the same round
  trip**; never make the caller wait on the vector leg. (Semantic reranking stays OFF — billed per query,
  300-800 ms.)
- **Latency budget (D23)**: query embedding ~50-200 ms (often a cache hit) + search ~50-150 ms + in-memory
  row verification ⇒ **sub-second typical**. Hard ceiling `Voice:Knowledge:RetrievalTimeoutMs` (default
  4,000 ms), slow-but-successful lookups warn at `RetrievalSlowWarnMs` (1,500 ms) under a stable log marker
  so the tail is tunable on data — the same observability discipline the catalog lookup ships with.
- ‼️ **NO LLM anywhere in this path (D23).** `search_knowledge` is retrieval only. The Move-2 expert check is
  the single tool that runs a text model, with its own allowance and caps.
- **Optional narrowing**: when the conversation is anchored on one offering, pass `linkedServiceId` to bias
  or filter — this is how "what's the dig depth on THAT one" resolves against the right spec sheet.
- **Returns**: passages with `docName` (+ `sectionTitle`) so the model can attribute naturally.
- **Consumes 1 unit** of the per-call allowance; `McpToolGuard` applies rate limit, scope, and audit.
- **Degrade**: index unavailable/timeout ⇒ the honest "the owner will confirm" + message — never "we don't
  have that", never a guess.

## 7.10 Prompt wiring

Add a knowledge block to `BuildInstructions` **only when the business has ≥1 `Ready` document** — zero tokens
for everyone else. Content: what the tool is for (provider-specific facts not in the offering list), the
absolute rule that **provider-specific claims come ONLY from returned passages**, the preamble requirement,
and natural attribution ("our rental terms say…") — never the words "document", "passage", "index", or
"link" to the caller (consistent with the existing `send_service_info` speech rule).

The `PublicProviderContext` build path (`FullProviderContextService`) gains a cheap `hasKnowledge` signal
(count read, cached alongside the existing catalog binding resolve — do not add a per-call round trip).

## 7.11 Provider web UI (`clinqetwebpartnerapp`)

‼️ **PLACEMENT — VERIFIED CORRECTION.** "AI Receptionist" is **not** in the main dashboard rail. On both
platforms it lives in the **Profile/Settings menu**, in the *Business Management* group, at route
`/dashboard/profile/ai-assistant`. The owner's instruction ("not inside the AI assistant setting, but below
that menu") therefore means: **one new entry appended immediately after the AI-assistant entry in that same
Profile menu group**, with its own route `/dashboard/profile/knowledge`.

| Concern | Exact location / pattern |
|---|---|
| **Menu entry** | `src\app\dashboard\profile\layout.jsx` — the AI entry is lines **133–144** inside the `aiAssistantEnabled` conditional; insert Knowledge immediately after (same conditional, same `sections` array). Icons here are **image assets** via `next/image` from `src\assets\images\images.jsx`; active row is `bg-[#97EF29] text-black font-medium` |
| **Route constant** | `src\routes\routeConfig.jsx` — add `Knowledge: "/dashboard/profile/knowledge"` to `ProfileRoute` (beside `AiAssistant`, line 84) |
| **Page composition** | Copy the AI-assistant trio exactly: thin client `page.jsx` (gate only) + `layout.js` (`createMetadata({ …, noIndex: true })`) + the real component under `src\components\Profile\knowledge\` |
| **Gate** | `<CapabilityGate permission="voice.read">` (from `src\components\tenancy\SurfaceAccess.jsx:111`); gate write controls on `can("voice.settings.manage")` |
| ‼️ **Mandatory test registration** | `src\app\dashboard\profile\profileScreensAreCapabilityGated.test.js` **sweeps every `/dashboard/profile/*` directory containing a `page.jsx`**. A new page absent from both its `GATED` map and `UNGATED_WITH_REASON` **fails the suite**. Register the exact literal `'CapabilityGate permission="voice.read"'` |
| **Feature flag** | `useAiAssistantEnabled()` from `@/context/AppConfigContext` — flag decides the product *has* it, permission decides this person may *open* it; **both must say yes**. Follow `CallFollowUpsGate.jsx`'s three-way gate (package off ⇒ redirect; `NotInvited` ⇒ promo; setup incomplete ⇒ `FinishSetupBanner` + page) |
| **UI primitives** | `src\components\tenancy\primitives.jsx` — `Pill` (status chip), `Card`, `PageHeader`, `StateCard` (empty/error/denied), `Skeleton`, `Modal` (bottom sheet <sm, centred ≥sm), `PrimaryButton`/`SecondaryButton`/`DangerButton`, `TONES`, `FIELD_CLASS`. **Do not hand-roll any of these** |
| **Closest structural precedent** | `src\components\Profile\Licenses.jsx` — file rows with thumbnail, per-status sub-render (failed/uploading with % + green bar/success), preview + red trash actions, delete-confirm modal, and the `onClick={e => e.currentTarget.value = ""}` trick so re-picking the same file still fires `change` |
| **Upload primitive** | `putFileWithProgress(uploadUrl, file, onProgress)` — `src\services\profileServices.js:410-441`. **XHR, not `fetch`** (fetch cannot report upload progress). Sets `x-ms-blob-type: BlockBlob` + explicit `Content-Type`. Full choreography to copy: `UploadLicenseDocumentsViaSas` (lines 443-515) — request SAS → `Promise.allSettled` per file → **confirm only the files that actually landed** |
| **API layer** | `src\api\url.js` — add Knowledge endpoints in the Voice Assistant block (after line 299). New `src\services\knowledgeServices.js` following `voiceAssistantServices.js`: `getAuthHeaders()` + `handleRequest()` (unwraps `err.response.data` then **re-throws**). Reads use `getApi.get` (it de-duplicates concurrent identical GETs). Response envelope is **`response.data.data`** |
| ‼️ **Memory correction** | The note "apiClient RESOLVES errors" is **WRONG** for this app — `src\lib\apiClient.js` **rejects on every path** (403 rejects and explicitly never logs out; 401 refreshes once then clears). Plan for `try/catch` |
| **Analytics** | `trackVoiceCall({ action, surface, metadata })` (`src\services\analyticsTracker.js:819`); nav clicks `trackNav({ action:"menu_click", surface, metadata:{ item } })`. Surface strings are asserted by registration/parity tests — register the new one on **both** platforms |

Behaviour: one list fetch, optimistic row updates, and polling for `Processing` rows **only while such a row
exists**, with a bounded interval and cleanup on unmount — no redundant calls. ‼️ **The web page must be
fully responsive as a first-class requirement** — the SAME page flawless at phone and iPad widths (stacked
rows, meter under the title, full-width buttons ≤640px; the mockup carries a 360px proof frame). Brand green
`#97EF29` on pressed/selected, navy headings, Lufga. ESLint zero errors. **Upload is multi-file on BOTH
platforms** (D15 note: mobile uses `allowMultiSelection: true`, already proven in `AddLicenseScreen`) —
same rows, same statuses, same validation contract (§7.11b).

## 7.11c THE AI-SETUP NUDGE (owner-added and APPROVED 2026-08-18 — D31)

At the **bottom of the AI Voice Assistant settings page** (the `Active` panel, and also shown once setup
completes), a friendly card points providers to the Knowledge page. **Wording is deliberately non-technical
— no "index", "upload pipeline", "knowledge base" jargon:**

> **Help your receptionist know your business inside out**
> The more it knows, the better it helps your callers. Add your price lists, policies, spec sheets or
> FAQs — it answers from your own material, in your own words.
> **[Add your knowledge →]** *(button navigates to `/dashboard/profile/knowledge`)*

Rules: shown only when the Knowledge surface itself is available (same flag + permission gates, V17/V18);
when the business already has ≥1 Ready document it swaps to a quieter one-liner ("Your receptionist knows
4 documents and 12 FAQs — **manage your knowledge →**") so it never nags; localization keys in all 10
files; same card on provider mobile (navigates to the Knowledge screen); brand-standard `Card` + green
`PrimaryButton`. Mockup §2c shows it. Recorded as **D31**.

## 7.11b THE VALIDATION CONTRACT — one table, both platforms, no wondering (owner-mandated 2026-08-18)

Client validates for instant feedback; **the API re-validates everything** (the client is never the
authority). Every message is a localization key on both platforms. This table is mirrored visually in the
mockup (§6 there) and is the acceptance list for UI tests.

| # | Rule | Where enforced | Behaviour / message intent |
|---|---|---|---|
| V1 | Allowed types: `.pdf .docx .xlsx .txt .md .json .html .htm .jpg .jpeg .png .tiff .bmp .heif` (+ `.heic` converted client-side) — D28 | client + SAS endpoint | Rejected file named with its extension; other picked files proceed |
| V2 | **WEBP** rejected (the only excluded type) | client + SAS endpoint | Specific message: convert to PNG/JPG |
| V3 | HTML uploads are content-sanitized at ingest (scripts/styles never stored) | server | Invisible to the provider; a page with no readable text fails honestly |
| V4 | Extension ↔ MIME consistency + filename sanitization | SAS endpoint (`FileValidationHelper`) | Generic invalid-file message |
| V5 | ≤ 20 MB per file | client + SAS endpoint | Per-file message with the limit |
| V6 | ≤ 20 documents per business | client (meter + disabled button) + SAS endpoint | Meter always visible; at cap the upload control disables with the limit-reached banner |
| V7 | ≤ 100 pages per document | **server only** (page count known post-extraction) | Document flips to `Failed` with the page-limit reason |
| V8 | Passage cap + grace (D25) | **server only** | `Failed` "knowledge space is full — remove a document you no longer need" |
| V9 | Multi-file batch: per-file independence | client + API | One bad file never blocks the others; each row shows its own outcome |
| V10 | Upload network failure | client | Row shows failed with per-row retry; already-uploaded rows unaffected; confirm sends only what landed |
| V11 | FAQ question 5–200 chars, answer 10–1,000 chars, both required | client + API | Inline field errors; Save disabled until valid |
| V12 | ≤ 200 FAQs | client + API | Counter near the Add button; disabled at cap |
| V13 | Duplicate filenames allowed | — | `docId` disambiguates; UI shows dates; no error |
| V14 | Identical content re-uploaded | server (`contentHash`) | Silently refreshes the existing document — no duplicate row |
| V15 | Delete requires confirm | client | "Your receptionist stops using it immediately. This can't be undone." |
| V16 | Replace keeps the same `docId` | server | Old passages purged, new indexed, one row throughout |
| V17 | Permission: view `voice.read`, manage `voice.settings.manage` | client gate + API attribute | Manage controls hidden without the permission; API still enforces |
| V18 | AI package off / not set up | client gate | Same three-way gate as Call Follow-ups (redirect / promo / finish-setup banner) |
| V19 | Actions while a document is Processing | client + server | **Delete: allowed** (immediate, tombstone rule §7.8b#34). **Replace AND Reprocess: disabled** until Ready/Failed (X6). Try-again: Failed rows only |
| V20 | FAQ edit + delete | client + API | Every FAQ row has Edit (reopens the same modal, prefilled; save re-embeds that one card) and Delete (confirm: "Delete this FAQ? Your receptionist stops using it immediately.") |

## 7.12 Provider mobile (`clinqetmobilepartnerapp`) — SAME SESSION (§0.7.1)

Registering a screen is a **five-file operation**, each enforced by a test:

1. **Route constant** — `src\appNavigation\constant.tsx`, AI Assistant block (lines 135-139, beside
   `VOICEASSISTANT: 'VoiceAssistant'`). Casing must match the stack registration exactly.
2. **Screen folder** — `src\Screen\ProfileFlow\Knowledge\` with `index.tsx` + `style.ts`
   (`createStyles(theme)` factory pattern).
3. **Permission gate** — `src\appNavigation\gatedScreens.tsx`: `export const GatedKnowledgeScreen =
   gateOn('voice.read', KnowledgeScreen);` (line 70 is the voice twin).
4. **Stack registration** — `src\appNavigation\MyDashboard-Route.tsx`, AI Assistant block (lines 199-203).
   ‼️ `__tests__/navigationDerivedFromPermissions.test.ts` scans for any raw (ungated) component registration
   and fails.
5. **Deep link** — `src\appNavigation\linking.ts`: the mobile path **mirrors the web URL 1:1**
   (`VoiceAssistant: 'dashboard/profile/ai-assistant'` at line 103) ⇒ Knowledge must be
   `'dashboard/profile/knowledge'`. Also update `src\appNavigation\types.ts` (param list).

Menu entry: `src\Screen\ProfileFlow\ProfileScreen\index.tsx`, Business-Management group — the AI entry is
lines **1067-1075**; insert Knowledge immediately after (before the group's closing `]}` at 1076), visible
on `payments.aiAssistantEnabled === true`, Ionicons at `size={20} color={menuIconColor}`.

Upload: `putBlobToSasUrl` from `src\Util\fileUpload.ts:33` — ‼️ **XHR, never `fetch`**: the SAS signature
pins `Content-Type` and RN's fetch rewrites it from the Blob's type, which Azure then **403s**. Use
`readUriAsBlob` and `normalizeMimeType` (iOS reports `image/jpg` or UTIs like `com.adobe.pdf`, both of which
the API rejects). Picker: `@react-native-documents/picker` with `keepLocalCopy` on iOS and the 500 ms delay
after dismissing a modal. **Add a `knowledgeDocuments` entry to `MEDIA_LIMITS`** (`src\Util\mediaLimits.ts`,
which mirrors the API's storage config) and surface rejections via `mediaRejectionMessage(rejection, t)`.

UI: `src\components\common\ui.tsx` — `Pill`, `Banner`, `Card`, `SectionTitle`, buttons, `SegmentedFilter`;
plus `common\StateView.tsx`, `Skeleton.tsx`, `ConfirmDialog.tsx`, `Toast`. Theme tokens from
`src\theme\index.ts` — **use `theme.space.md`, never a hardcoded `12`**.

‼️ **The two rendering-rules files are line-for-line twins** (`src\lib\tenancy\renderingRules.js` web /
`renderingRules.ts` mobile) and `__tests__/tenancyRenderingParity.test.ts` evaluates both in a sandbox and
fails on any divergence (and on any new `import` in the web file). Any derived Knowledge rule (chip tone,
empty-state key, row actions) goes there as a pure function **returning localization keys, never rendered
English**.

## 7.13 Localization — 10 files, two different conventions

| | Web (`clinqetwebpartnerapp\public\lang\`) | Mobile (`clinqetmobilepartnerapp\src\Locales\`) |
|---|---|---|
| Files | `en-US, es-US, fr-CA, gu-IN, hi-IN` (5) | `en, es, fr, gu, hi` (5) |
| Convention | **flat dot keys**, e.g. `voiceAssistant.navTitle` | **nested SCREAMING_SNAKE**, e.g. `VOICE_ASSISTANT.MENU_LABEL` |
| Interpolation | ICU | i18next `{{name}}` |
| Quirk | `es-US` is authored + parity-tested but **not wired into the runtime picker** — author it anyway | `es` likewise authored but **not registered** |

‼️ **Mobile forbids inline ICU `plural`/`select`/`selectordinal` in every catalogue including English**
(`localeParity.test.ts`). Count-bearing copy must be **separate keys** (the `Invitation.Expiry.Today /
.Tomorrow / .Days` pattern). Write the Knowledge copy so one sentence serves both conventions.

Guard tests that will fail on a miss: web `localeParity`, `icuMessageIntegrity`,
`sourceLocalizationIntegrity` (AST-scans for raw English in JSX text and in `alt`/`aria-label`/`label`/
`placeholder`/`title`, and asserts every id exists in all five catalogues); mobile `localeParity`,
`sourceLocalizationIntegrity`, `tenancyLocalizationKeys`.

Plus API-side localized keys in `clinqetinfrastructure\Resources\Localization\en.json` **and every sibling
language file** for validation errors and the failure reasons (`password-protected`, `unreadable`,
`too-many-pages`, `generic-retry`) — these are stored as keys on the registry document and resolved for
display.

## 7.14 Lifecycle and teardown

- **Replace — KEPT, with GAPLESS swap semantics (owner questioned it 2026-08-18; delete-only was considered
  and rejected):** replace preserves the `docId`, the type, the offering link, and the row's history — and,
  decisively, it can be **gapless**: the OLD cards keep serving callers throughout re-ingestion; the final
  commit **upserts the new cards over the same deterministic ids** (`{businessId}_{docId}_{chunkNo}`) and
  then **prunes stale ids with `chunkNo ≥ newCount`** (the shorter-new-version case). Delete-then-re-upload
  would leave a knowledge GAP while processing and force the provider to re-pick type/link. **UI rule:
  Replace is disabled while a document is Processing** (Ready/Failed only) — sessions would make a queued
  replace safe, but a visibly stacked run is confusing for zero benefit.
- **Delete — how the index knows what to remove:** every card carries `docId` as a **filterable field** (and
  ids are deterministic), so delete = one filtered query `businessId eq X and docId eq Y` → batch-delete the
  returned ids → registry row → blob, in that order (an orphan blob is cheap; an orphan passage is a
  correctness bug).
- ‼️ **Delete WHILE Processing — the tombstone rule (§7.8b case 34):** the delete endpoint acts immediately
  (purge cards by `docId`, remove registry row, delete blob) and never waits for the in-flight run. The
  ingestion function closes the race: **immediately before its final commit** (index upsert + registry
  `Ready` write) it **re-reads the registry row via ETag CAS** — row gone or tombstoned ⇒ it purges anything
  it already wrote for that `docId` and exits without committing. Net effect: a mid-processing delete can
  never resurrect cards, and nothing is ever half-deleted.
- **Business closure**: `BusinessClosureTeardown` purges a fixed list of containers
  (`ProviderData`, `Reviews`, `Transactions` — `BusinessClosureTeardown.cs:143-148`) and already holds
  `IAzureSearchIndexer`/`IProviderSearchIndexer`. **Three additions are mandatory and easy to miss:**
  add **`KnowledgeBase`** to that container list, purge the **knowledge index passages** for the business,
  and purge the **blob prefix** `{businessId}/`.
- **Voice assistant disabled / plan downgrade**: documents remain; retrieval simply is not offered.

## 7.14b Embedding + index write — the failure contracts that bite

**`IEmbeddingService`** (`clinqetcore\Interfaces\Search\IEmbeddingService.cs`) exposes
`GenerateTextEmbeddingAsync(text, ct)` and **`GenerateBatchTextEmbeddingsAsync(List<string>, ct)`** —
index-aligned batch output, exactly what a chunk pipeline needs. Registered Singleton in the Functions host
(`Program.cs:716`) with the named client `AzureAIFoundryEmbedding` (L705-713).

‼️ **It does NOT throw on failure — it returns an empty `float[]`** for the failed indices (L254-268), and
it **truncates** input over `AzureAIFoundry:MaxTextLength` (30 000 chars) rather than rejecting it. **Check
`embedding.Length == expectedDimensions` before indexing** — exactly what `AzureSearchIndexer` does at
L315-317. A silently-empty vector is a passage that can never be found by meaning.
‼️ **Do not add DI-level retry** — the service owns an internal Polly pipeline and is the single retry owner
(comment at `Program.cs:704`). Dimensions (3072) are asserted at indexer construction:
`AzureAIFoundry:EmbeddingDimensions` must equal `AzureSearchIndex:VectorSearchDimensions`.

**Index write** — mirror `AzureSearchIndexer.UploadDocumentsAsync` (L302-341):
`IndexDocumentsBatch.Upload(docs)` → `IndexDocumentsAsync` → **inspect every per-document result**, because
*Azure returns 200 for a batch even when individual documents failed*; any failure must throw
(`SearchIndexUploadPartialFailureException`), since there is no reconciliation job. Copy
`UploadDocumentsIsolatingPoisonAsync` (L349-386) too: retry the batch, and on failure retry each document
singly so one poison passage cannot fail the whole document.

‼️ **A second bare `SearchClient` cannot be DI-registered** — wrap it in a dedicated type the way
`ProviderSearchClient` is wrapped (`Program.cs:610-623`).

## 7.14c New-queue wiring — five edits, one of which is always forgotten

| # | Where | What |
|---|---|---|
| 1 | `clinqetshared\Models\ServiceBusSettings.cs` | Add `KnowledgeIngestQueueName { get; set; } = "knowledge-ingest";` (default = the **unsuffixed prod** name, kebab-case) |
| 2 | ‼️ `clinqetinfrastructure\Services\Communication\ServiceBusService.cs:54-96` | **Add the sender-dictionary entry.** `SendMessageAsync` throws `InvalidOperationException($"Sender for queue '{queueName}' not found.")` (L160-161) if you skip this. **This is the #1 forgotten step.** |
| 3 | `local.settings.json`, `local.settings.ca.json`, `local.settings.in.json` | `"ServiceBusSettings:KnowledgeIngestQueueName": "knowledge-ingest-dev"` — the `%…%` trigger token is resolved by the **host**, which cannot see the worker's `appsettings.json` |
| 4 | `azureautomation\events.json` | New queue resource — copy the **`media-derivatives` block (L252-276)**: `lockDuration: "PT5M"` (heavy processor), `requiresDuplicateDetection: true`, `duplicateDetectionHistoryTimeWindow: "PT10M"`, `maxDeliveryCount: 5`, `defaultMessageTimeToLive: "P7D"` — **plus `requiresSession: true` (D25)**: sessions serialize ingestion per business (`sessionId = businessId`, sent via the existing `SendMessageWithSessionAsync`; precedent queues `broadcast-status-updates`/`customer-identity-sync`; host `maxConcurrentSessions: 8`), which kills the concurrent-upload cap race and keeps replace-after-upload ordered |
| 5 | `azureautomation\deploy.ps1` | (a) `$qKnowledgeIngest = "knowledge-ingest$queueSuffix"` in the queue-name block (~L1532-1574); (b) `ServiceBusSettings__KnowledgeIngestQueueName` in the applied Function App block (~L6730); (c) the same in the emitted `$functionAppSettings` (~L7518); (d) consider `$script:RequiredFunctionAppSettings` (~L1852) since a missing value would silently fall back to the prod-named default |

**Message DTO:** a `public record KnowledgeIngestQueueMessage : ServiceBusMessageBase` in
`clinqetshared\DTOs\Messages\`, `[Required]` `{ get; init; }` properties. ‼️ `SchemaVersion = 2` and a
consumer meeting an unexpected version **rejects it** — queues are drained at deploy and version-compat code
is forbidden on this platform.

**Send with a deterministic `messageId`** so Service Bus duplicate detection actually works — mirror
`BuildDedupMessageId` (`ServiceBusService.cs:451-462`, 128-char cap with a SHA-256 fallback), e.g.
`{businessId}:{docId}`.

**host.json is global** — `maxConcurrentCalls: 16`, `prefetchCount: 100`, `autoComplete: false`,
`maxAutoLockRenewalDuration: "01:00:00"` (which is what makes a long OCR + embed + index handler safe).
There are **no per-queue overrides anywhere** in this platform; if the ingestion function needs lower
concurrency, gate it in code.

**Handler skeleton to copy** (`MediaDerivativeProcessorFunction`): `ServiceBusReceivedMessage` +
`ServiceBusMessageActions` (manual settlement) → deserialize with case-insensitive + enum-string options →
null/invalid payload ⇒ **explicit dead-letter** with a reason → log with `DeliveryCount` + `MessageId` →
work → `CompleteMessageAsync`. On exception: `catch (OperationCanceledException) { throw; }` **first** (host
shutdown is not a failure — take this from `VoicePostCallProcessorFunction:297-300`), then mark the registry
row `Failed`, then `IsFinalRetry(deliveryCount)` ⇒ `HandleSystemFailureAsync(..., forceAdminAlert: true)` +
dead-letter, else `AbandonMessageAsync`.

## 7.15 Settings (`Voice:Knowledge`) and infrastructure wiring

Settings (every knob the owner named is here — all appsettings, class defaults mirroring, §0.12):
`Enabled` · `MaxDocumentsPerBusiness` (20) · `MaxFileSizeBytes` (20971520) · `MaxPagesPerDocument` (100) ·
`MaxPassagesPerBusiness` (2000) · **`OverflowGraceFactor` (1.10)** (D25) · `MaxTypedFaqs` (200) ·
`ChunkTargetTokens` (350) · **`ChunkMaxTokens` (512)** · **`ChunkMinTokens` (120)** ·
`ChunkOverlapPercent` (15) (D24) · **`RetrievalTopK` (5)** · `RetrievalMaxTokens` (1500) ·
`RetrievalTimeoutMs` (4000) · `RetrievalSlowWarnMs` (1500) (D23/D27) ·
**`ExtractionModelId` (`prebuilt-layout`)** · **`ExtractionOutputFormat` (`markdown`)** (D13) ·
**`ImageCaptioningEnabled` (true)** · **`ImageCaptionMaxTokens` (200)** (D26) ·
**`DocSummaryEnabled` (true)** · **`DocSummaryMaxChars` (400)** (D11) ·
**`EmbeddedImageMinBytes` (10240)** · **`ImageCaptionMinPixels` (200)** (§7.8b case 32) ·
`AllowedExtensions` (.pdf, .docx, .xlsx, .txt, .md, .json, .html, .htm, .jpg, .jpeg, .png, .tiff, .bmp, .heif — D28) · `AllowedMimeTypes` ·
`UploadSasExpiryMinutes` · `IngestTimeoutSeconds` · `IndexName`.

Storage config: add `Storage:Containers:ProviderKnowledge = "provider-knowledge"` and a
`Storage:ProviderKnowledge` constraints block, mirroring `ProviderSetupDocuments`.

**ARM + `deploy.ps1` in the same change (§25):** the new blob container, the new Service Bus queue, and every
new `local.settings.json` key as an environment variable, per region stamp (`ca`, `in`).

---

## 7.16 CROSS-CUTTING EDGE CASES — the final brainstorm sweep (owner-mandated 2026-08-18; every case bold, every case handled, every case a test where testable)

| # | Edge case | Rule |
|---|---|---|
| X1 | **Business closes while a document is Processing** | `BusinessClosureTeardown` purges the `KnowledgeBase` partition + knowledge-index passages + blob prefix; the in-flight run's tombstone CAS (§7.8b#34) finds the row gone ⇒ aborts and self-purges. Double-safe by construction. |
| X2 | **Linked offering is deleted mid-ingestion** | The name point-read returns null ⇒ proceed UNLINKED (no prefix suffix, no `linkedService*` fields). Never fail a document over a vanished link. |
| X3 | **Blob missing when the function runs** (deleted between confirm and dequeue) | If the registry row is also gone ⇒ tombstone path (normal delete). Row present but blob missing ⇒ storage anomaly ⇒ `Failed` with the generic-retry reason — never silent success. |
| X4 | **SAS URL expires mid-upload** (15-min window, slow connection) | Per-file failure only (V10): that row shows failed with retry — the client re-requests a fresh URL for THAT file; landed files are unaffected. |
| X5 | **Index outage during DELETE** | ‼️ **Order is cards → registry row → blob, and the row is NEVER removed before the card purge succeeds** — a failed purge returns an error and leaves the row, so the user's retry re-runs an idempotent delete. No path leaves orphaned cards with no row pointing at them. |
| X6 | **Reprocess clicked while Processing** | Disabled — Reprocess is available on `Ready`/`Failed` only (extends V19). Sessions would serialize it safely, but a stacked run is confusing UX for zero benefit. |
| X7 | **Two people edit the same FAQ simultaneously** | Registry ETag ⇒ second save gets 412 ⇒ friendly "someone else just changed this — reload and try again" toast. Never last-write-wins silently. |
| X8 | **Do FAQs count toward the passage cap?** | **Yes — a FAQ card is a passage** (consistency beats a special case), but the 200-FAQ cap binds long before it matters (200 ≪ 2,000). |
| X9 | **Same content re-uploaded under a DIFFERENT filename** | `contentHash` match ⇒ treated as a refresh of the EXISTING document; the display name updates to the new filename; never a duplicate row (sharpens V14). |
| X10 | **Failed-document blob retention** | Kept indefinitely so "Try again" works without re-upload; deleted with the document. No auto-TTL in v1 (a provider's file silently vanishing is worse than pennies of storage) — revisit only with data. |
| X11 | **Session-slot contention** | `host.json` `maxConcurrentSessions: 8` is GLOBAL and already shared with `broadcast-status-updates` + `customer-identity-sync`. Knowledge ingestion joins that pool — acceptable at launch scale; the slow-ingest log marker makes contention visible if it ever matters. No per-queue override exists on this platform. |
| X12 | **Replace with MORE cards than before** | Upsert covers all new ids; nothing to prune (the symmetric case of §7.8b#35 needs no special handling — assert it in the same test). |
| X13 | **The voice model reading a TABLE card aloud** | A Phase-2 prompt rule (goes with the `search_knowledge` block): speak the VALUES naturally ("the CAT 340's dig depth is 52 feet"), never read markup, column separators, or the word "table". |
| X14 | **HEIC from an iPhone on mobile** | DI accepts HEIF natively ⇒ mobile can upload as-is, no conversion step; web keeps its existing `ensureNonHeic` conversion (it also serves the preview). Both paths land in V1's allowed list. |
| X15 | **The nudge's counts (D31)** | Read from the SAME list endpoint the Knowledge page uses — no new endpoint, no drift between the nudge's numbers and the page. |
| X16 | **Upload attempted the instant the business hits the doc cap from another device** | The SAS endpoint re-checks the cap server-side (V6) — the stale client gets the limit-reached error, not a broken upload. |

# 8. COST MODEL (verified rates from §2.4)

| Scenario | Cost | Working |
|---|---|---|
| **Ingest a 10-page document** (one-time; D13 layout) | **~$0.10** | Layout 10 pages × $10/1k = $0.10 + doc title/summary (D11) ~$0.002 + embed ~6.5k tokens × $0.13/1M ≈ $0.001. On the `read` fallback setting: ~$0.017 |
| **A `.txt`/`.md` document** | **~$0.003** | No DI — one summary call + embeddings |
| **One image** (photo of a menu/price board/equipment) | **~$0.011** | Layout OCR $0.01 + vision caption ~$0.001 (D26; downscaled before captioning) |
| **A provider with 20 documents — realistic mix under D28** (8 PDFs ×10pp; the rest DOCX/XLSX/HTML/TXT = local $0) | **~$0.85 one-time** | Layout 80 pages × $10/1k = $0.80 + 20 summaries $0.04 + embeddings ~$0.01. Zero ongoing — retrieval is free; re-charged only on replace |
| **Same 20 documents if ALL were PDFs** (~10pp each — the ceiling of the realistic case) | **~$2.06 one-time** | Layout $2.00 + summaries $0.04 + embeddings ~$0.02 |
| **A provider with 50 documents** (if the 20-doc cap is ever raised — it's a setting; same all-PDF ceiling) | **~$5.14 one-time** | Layout $5.00 + summaries $0.10 + embeddings $0.04; realistic mixed ≈ $2 |
| **A business maxed to every current cap** (20 × 100 pages) | **~$20 worst case, one-time** | Layout $20 + summaries $0.04 + embeddings ~$0.09. A typical business (≤60 pages): **~$0.60, once**. On `read`: $3.10 worst case. **This is the one real cost of the table-fidelity decision (D13) — and `ExtractionModelId` is the escape hatch** |
| **Call with TWO knowledge lookups — advanced tier** | **+~$0.02** | 2 × 1.5k passage tokens fresh = 3k × $4/1M = $0.012; later-turn re-reads at the cached rate ($0.40/1M) ≈ $0.007. Search queries themselves: $0 marginal (AI Search is capacity-priced) |
| **Same, standard tier** | **+~$0.002** | mini text-in $0.60/1M |
| **Move 2 expert check** | **~$0.013** (nano ~$0.004) | ~15k in × $0.75/1M + ~400 out × $4.50/1M; capped at 4/call |
| **Baseline 5-min call, advanced tier** | **~$0.29–0.36** (~$0.06–0.07/min) | audio in 1.5k × $32/1M + audio out 3k × $64/1M + ~5k prompt × $4/1M + mostly-cached history |
| **Baseline 5-min call, standard tier** | **~$0.10** (~$0.02/min) | mini audio $10/$20 per 1M |

**Shape of the economics:** the conversation is ~95%+ of every call's cost; knowledge lookups add ~2¢ when
they happen; ingestion is a dime per typical document, once — the price of tables that survive extraction.

**Two clarifications the owner asked for, kept here permanently:**

- **A "passage" is not a "page."** A passage is a few hundred words (~350 tokens); one page typically yields
  2–3 passages. The 2,000-passage cap ≈ **700–1,000 pages per business** — a guard rail, not a quota.
- **The 32k figure is a session HOLD ceiling, not a bill.** You pay for tokens processed; re-read history
  bills at the **cached** rate ($0.40 vs $32 per 1M on advanced — 80× cheaper). The ≤1.5k retrieval cap keeps
  each lookup under a cent and long calls far from the ceiling.

**Tier vocabulary (the owner's question — precise):** `Voiceline.ModelTier` holds
`VoiceTierIds.Standard = "standard"` or `Advanced = "advanced"` (legacy `"mini"`/`"realtime-1.5"` still
resolve). `IsStandard()` picks `Azure:Realtime:DeploymentDefault` = **`gpt-realtime-mini`** ("mini");
otherwise `DeploymentPremium` = **`gpt-realtime-2`** ("premium"/advanced). It is the billing contract:
`AiAddOnService` provisions the tier by lowercasing the payments enum `VoiceModelTier`.

---

# 9. TEST PLAN — §0.18 PLACEMENT MAP (get this right)

**The rule:** a library class in `clinqetinfrastructure`/`clinqetshared`/`clinqetcore` is tested from the
suite of the **HOST that invokes it at runtime**, never wherever is convenient. (Owner-mandated after voice
tests were wrongly parked in the API suite: *"never ever should this type of mistake happen."*)

| Component | Runtime consumer | Test home |
|---|---|---|
| `RealtimeSessionPayloadBuilder` prompt changes (Move 1) | Functions (Telnyx accept) + MCP (Plivo relay) | **`Clinqet.Communications.UnitTests\Voice\`** — existing `RealtimeSessionPayloadBuilderTests.cs` |
| `ProviderCatalogAnswerService` + `answer_catalog_question` (Move 2) | MCP | **`Clinqet.Mcp.UnitTests`** + `.IntegrationTests` |
| Knowledge **ingestion** (chunker, extraction orchestration, embed+index writer) | Functions | **`Clinqet.Communications.UnitTests`** + `.IntegrationTests` |
| Knowledge **retrieval** (`ProviderKnowledgeSearchService`, `search_knowledge`) | MCP | **`Clinqet.Mcp.UnitTests`** + `.IntegrationTests` |
| `KnowledgeController`, SAS issuance, caps, permission gating | API | **`Clinqet.API.UnitTests`** + `.IntegrationTests` |
| Provider web / mobile UI | — | ESLint zero errors; mobile locale-parity test |

**Integration tests are MANDATORY** (§0.8) for: the unique/deterministic-id idempotency of passage upserts,
the queue processor's redelivery behaviour, the caps enforced against a real store, and the isolation
verification. EF InMemory and mocks cannot prove those.

**Also required:**
- Update the curated MCP tool-catalog contract list in `McpToolIntegrationTests.cs` for **each** new tool —
  omitting this turns the integration suite red (2026-07-31 scar).
- Grep **every construction site** when adding a constructor parameter (unit factories *and* integration call
  sites) — "unit green" is not an audit.
- Convention tests must scan **their own repo only** (§0.15/§0.17); never add a peer checkout.
- Confirm the test project actually **recompiled** before trusting a pass (`--no-build` on stale binaries has
  reported false green twice).
- **Sabotage-verify** the important pins: break the behaviour deliberately and confirm the test fails.

---

# 10. SEQUENCING — THE THREE-PHASE EXECUTION MODEL (owner-restructured and APPROVED 2026-08-18)

**All gates are CLEARED**: the owner approved the full program, the §11 schema table (container
`KnowledgeBase` on `/businessId` confirmed), and the mockup (rev 4 + the §7.11c nudge). Prior P1–P6
sequencing is superseded by:

| Phase | Scope | Ends with (MANDATORY) |
|---|---|---|
| **PHASE 1 — everything except MCP** | **Move 1** (knowledge-policy prompt changes + `find_services` description — no tool dependency) **+ the ENTIRE knowledge stack outside `clinqetmcp`**: `KnowledgeBase` container (+ policy + `cosmosindexsetup`), the `clinket-knowledge` index (own initializer file, full §7.2 schema incl. `linkedServiceName`), blob container + session-enabled queue + ARM/`deploy.ps1` + all three `local.settings*.json` + sender-dictionary entry, `KnowledgeController` (batch sas-urls/confirm/list/delete/reprocess/FAQ CRUD incl. **edit**), the ingestion function (D28 local-first engines, D24 chunker + ALL 35 §7.8b cases as tests, D25 overflow + sessions, **gapless replace + tombstone-CAS delete race §7.8b#34-35**, D11 doc call, D26 images), the **web page + Profile-menu entry + the §7.11c AI-setup nudge** and the **mobile screen in the SAME session** (five-file registration), full §7.11b V1–V20 validation, all 10 localization files, business-closure teardown additions | **(a)** a multi-dimensional audit of Phase-1 code (correctness, races, isolation, cost paths, localization, responsiveness, tests green, tree clean §0.16); **(b)** WRITE `C:\Nik\voice-answer-ladder\PHASE-2-PROMPT.md` — a complete copy-paste prompt (file paths, what exists now, what Phase 2 builds, standards pointer) — and tell the owner its path |
| **PHASE 2 — the MCP surface** | **Move 2** `answer_catalog_question` (+ `ProviderCatalogAnswerService`, DI of `IAICompletionService` in the MCP host, allowance weighting, short-circuit) **+ `search_knowledge`** (+ retrieval service per D22/D23/D27, one hybrid request, keyword fail-soft, row verification) **+ the realtime prompt's knowledge/expert blocks + `ResolveAllowedTools` additions + `hasKnowledge` signal** + the curated tool-contract list update + MCP unit/integration tests + dev-voiceline probe calls (excavator scenario + 2–3 other trades) if the number is available | **(a)** multi-dimensional audit of Phase-2 code; **(b)** WRITE `C:\Nik\voice-answer-ladder\PHASE-3-PROMPT.md` (same completeness bar) and tell the owner its path |
| **PHASE 3 — the full-program audit** | **Multi-dimensional, end-to-end audit of EVERYTHING both phases shipped**, as if reviewing a stranger's work: correctness + edge cases against §7.8b/§7.11b line by line; race conditions (tombstone, gapless replace, session serialization, cap grace) exercised, not assumed; tenant isolation adversarially (D22 — attempt cross-business retrieval); cost paths (no double-billing, hash skip, decorative-image skip); performance (retrieval budget, no LLM in `search_knowledge`); localization parity suites; web responsiveness at 360/768/1024; mobile parity; ALL suites green with recompilation confirmed; sabotage-verify the critical pins; §0.9 close-out — update the `clinqet-voice-assistant` SKILL in **all four** AI-tool directories + memory; §0.16 tree clean with removals reported | Final report to the owner: what shipped, what the audits found and fixed, proof of green |

**Phase rules:** each phase starts by reading THIS plan in full; each phase's own audit happens before its
next-prompt file is written; a phase never starts work belonging to a later phase; the next-prompt file must
be self-contained enough that a fresh session executes from it + this plan alone.

**Why this split:** Phase 1 has zero `clinqetmcp` compile surface (the retrieval/expert services are
Phase 2 with their consumer, per §0.18's spirit); Phase 2 is small and sharply scoped to the MCP host + the
prompt wiring that names its tools; Phase 3 audits with fresh eyes across the whole program.

---

# 11. OWNER GATES — PRE-FILLED §0.7 TABLE FOR MOVE 3

**Present this and WAIT.** Moves 1 and 2 need no schema approval (D6).

| Column | Answer |
|---|---|
| **What** | (1) ‼️ **NEW Cosmos container `KnowledgeBase`, partition key `/businessId`** — registry document per §7.4 (owner-directed D12; **PK is permanent — confirm the exact key string**). (2) New Azure AI Search index `clinket-knowledge` (+`-dev` suffix) with the fields in §7.2 **including `docTitle` + `chunkKind`** (D11/D24), `standard.lucene` analyzer (D27). (3) New blob container `provider-knowledge`. (4) New Service Bus queue `knowledge-ingest` — **session-enabled, `sessionId = businessId`** (D25). (5) New `DocumentType.KnowledgeDocument` enum value (append-only). (6) `Voice:Knowledge` + `Storage:ProviderKnowledge` settings blocks, and `Search:KnowledgeIndexName` + `AISearch:KnowledgeIndexName`. |
| **Who reads it** | `search_knowledge` MCP tool during live calls (§7.9); the provider Knowledge page (registry list); Move 2's expert check for linked spec passages. **All in this change.** |
| **Who writes it** | The API confirm endpoint (registry row) and the ingestion function (passages, status). **All in this change.** |
| **Why not a column** | The registry is one row per uploaded document — inherently one-to-many per business. Passages are many-per-document and require vector search, which Cosmos cannot serve. |
| **Why not a constant/enum** | `docType` **is** a C# enum; only provider-authored content is stored. |
| **Why not already stored** | Checked: `Service` (catalog offerings — different lifecycle, no free text, contract-frozen index), `Voiceline` (call config), `BusinessProfile` (structured profile), `ProviderData` (would work technically — **owner chose a dedicated container for lifecycle isolation**). None can hold arbitrary provider documents or serve passage-level vector search. |
| **Cost** | Cosmos: a 9th container — shared-throughput database (autoscale 1000 RU/s), one small doc per upload, point-reads by partition, trimmed index policy. Search index: no new resource/meter; a few MB per business at cap. Ingestion: **~$0.10 per 10-page doc one-time on `prebuilt-layout`** (the table-fidelity choice, D13 — `read` fallback setting drops it to ~$0.017); maxed business $20 worst case, typical ~$0.60. Retrieval: $0 marginal per query. |
| **What breaks if omitted** | Kind-4 questions ("do you take Delta Dental?", exact specs) are permanently unanswerable — no other mechanism can serve them, and web search is dropped (D2). |

**Also required at P4:** mockup approval (`C:\Nik\mockups\voice-knowledge-base\knowledge-base.html`) — web
AND mobile, every state.

---

# 12. RISKS, TRAPS, AND EXPLICIT NON-GOALS

**Traps carried from prior sessions (all real, all cost time before):**

- A tool added without updating the **curated tool-catalog contract** turns the MCP integration suite red.
- A constructor parameter added without grepping **every** construction site breaks integration compilation.
- `cosmosindexsetup` **ignores a shell `CLINKET_REGION`** — always `--launch-profile`.
- `--no-build`/filtered test runs can report green on **stale binaries**.
- PowerShell `Get-Content`/`Set-Content` **corrupts** UTF-8-no-BOM `.cs` files — use the Edit tool.
- A guard that scans a missing root and `continue`s **passes on zero files and then invents bugs**.
- `IMemoryCache` writes without `Size = 1` are a **runtime 500** and a build-failing convention test.
- The environment **auto-commits and pushes** — never leave scratch files in a repo (§0.16).

**The build gap list — what does NOT exist and must be written (each with the thing to mirror):**

| # | Gap | Mirror |
|---|---|---|
| 1 | Text chunker — nothing in the solution splits text | New interface in `clinqetcore\Interfaces\`, impl in `clinqetinfrastructure\Services\`, options class with class defaults mirroring appsettings |
| 2 | Public raw-text extraction | Expose `DocumentIntelligenceService.ExtractTextFromDocumentUrlAsync` (private, L398) |
| 3 | DocIntel DI + config in the **Functions** host | `clinqetapi\Clinqet.API\Program.cs:766-771` |
| 4 | DocIntel app settings on the Function App | `deploy.ps1` API blocks ~L6975-6976 / ~L7392-7393 → duplicate into the function blocks |
| 5 | The knowledge AI Search index | `cosmosindexsetup` `ProviderSearchIndexInitializer` (in its **own new file**) + a `ProviderSearchClient`-style wrapper type |
| 6 | A chunk indexer service | `AzureSearchIndexer.UploadDocumentsAsync` L302-341 + `UploadDocumentsIsolatingPoisonAsync` L349-386 |
| 7 | Queue + DTO + **sender entry** | `ServiceBusSettings.cs`, `ServiceBusService.cs:54-96`, `MediaDerivativeQueueMessage.cs`, `events.json:252-276` |
| 8 | Ingestion-status persistence | `MediaProcessingStatus` + the `UpdateXxx…ByIdAsync` point-patch repository pattern |
| 9 | The `KnowledgeBase` container policy | `clinqetcore\Cosmos\Setup\CosmosContainerPolicies.cs` (8 existing methods) |

**⚠️ Unrelated security finding, surfaced while mapping `cosmosindexsetup` (raise with the owner separately —
NOT part of this program):** `cosmosindexsetup\appsettings.ca.json` and `appsettings.in.json` are
**git-tracked** and contain **live Azure Search admin keys, Cosmos account keys, a SQL password and a Pexels
API key in plaintext**. `.gitignore` covers only `bin`/`obj`/`.vs`. This violates §19 (secrets management).
Remediation is its own change: move them to user-secrets/Key Vault, purge from history, rotate the keys.

**Design risks and mitigations:**

| Risk | Mitigation |
|---|---|
| Model over-calls the expert check | Four-layer control (§6.3), server short-circuit is the real guard |
| Retrieval returns the wrong passage | Hybrid (BM25 + vector) + context prefix; measure on real transcripts before adding per-document enrichment |
| Provider uploads junk / a 100-page catalogue of images | Caps enforced pre-spend; OCR-empty ⇒ explicit `Failed` reason |
| Provider expects the AI to quote uploaded prices as bookable | Prompt rule: listed catalog prices remain the only bookable prices; document prices are informational |
| Latency creep on calls | Preamble before every call; hard timeouts; retrieval capped at 4 passages |
| Cross-tenant leak via the shared index | Filter **plus** row-level verification, fail closed, alarm (§7.9) |

**Explicit non-goals:** web search of any kind (D2); Voice Live migration (D3); per-chunk LLM enrichment
(D11 — Snowflake measured it negative); multimodal image embeddings (D26 — unspeakable on a voice channel);
XLSX and WEBP inputs in v1 (D14); semantic reranking on the voice path (D27 — expert-check A/B lever only);
a nano→mini cascade (D5); RRF score floors (D27); any industry-specific vocabulary or logic (D21).

**Build-time verification flags (from the 2026-08-18 evidence pass — check these during Move 3, do not
assume):** (1) confirm `outputContentFormat=markdown` behaves on DOCX input in our API version; (2) Gujarati
is absent from the embedding model's public multilingual benchmarks — build a ~50-query Gujarati eval set
before trusting vector recall (BM25 + `standard.lucene` carries lexical recall meanwhile); (3) a community
thread reports GPT-5.4-mini occasionally over-counting image tokens on large PNGs — **downscale images
before captioning and monitor per-call usage**; (4) the $0.60 Read meter appears to be the 1M+ pages/month
volume tier; (5) table-card vector serialization (row-sentences vs raw markdown) has no public benchmark —
A/B with our own transcript-derived eval set; (6) if a "don't answer" confidence gate is ever wanted, the
only legitimate signal is the semantic ranker's `rerankerScore` — never raw RRF (D27).

---

# 13. APPENDIX — VERIFIED FILE INVENTORY

Everything below was read directly on 2026-08-16/17.

| Path | Relevance |
|---|---|
| `clinqetinfrastructure\Services\Voice\RealtimeSessionPayloadBuilder.cs` | The first prompt. `ScopeCAllowedTools` (~L21), `ResolveAllowedTools` (~L48), tier→deployment (~L101), `BuildInstructions` (~L270), hard rules (~L376-390), Map/Full branch (~L436-459) |
| `clinqetmcp\Clinqet.Mcp\Tools\CatalogTools.cs` | `find_services`, its description, `ConsumeLookupAllowanceAsync`, the `Exhausted` note |
| `clinqetinfrastructure\Services\Voice\ProviderCatalogSearchService.cs` | Search fields, select fields, 5-layer isolation (`AssertScoped`, row verification ~L329), degrade ladder, `IndexLegBudgetShare` |
| `clinqetshared\Models\VoiceCatalogSettings.cs` | `EmbedThreshold` 60, `LookupMaxResults` 5, `LookupTooBroadThreshold` 8, `LookupSummaryMaxChars` 160, `LookupTimeoutMs` 8000, `MaxLookupsPerCall` 8 |
| `clinqetshared\Constants\VoiceTierIds.cs` | `standard`/`advanced`, `IsStandard()`, billing contract note |
| `clinqetfuncations\Clinqet.Communications\appsettings.json` (~L1184) | `DeploymentDefault: gpt-realtime-mini`, `DeploymentPremium: gpt-realtime-2` |
| `clinqetapi\Clinqet.API\Controllers\AI\AIAssistantController.cs` (L550-653) | **The upload-URL template**: permission attr, validation, `SasUrlRequest`, `GenerateSasUrlAsync`, response DTO |
| `clinqetapi\Clinqet.API\appsettings.json` (~L2748, ~L2796) | `Storage:ProviderSetupDocuments` constraints (20 MB) and `Storage:Containers` map |
| `clinqetapi\Clinqet.API\appsettings.json` (L1941) | `EmbeddingModel: text-embedding-3-large` |
| `clinqetinfrastructure\Services\AI\DocumentIntelligenceService.cs` (L407) | `prebuilt-read` default modelId |
| `clinqetinfrastructure\Services\AI\AICompletionService.cs` | `max_completion_tokens`, `reasoning_effort`, strict `json_schema` support |
| `clinqetmcp\Clinqet.Mcp\Program.cs` (L237-258) | `AzureAIFoundry` key/HttpClient, `IEmbeddingService` singleton, `CatalogSearchDependencies` |
| `clinqetinfrastructure\Data\SQL\TenancyRoleCatalogDefinition.cs` (L145-152) | `voice.read`, `voice.settings.manage`, `voice.livecall.join`, `voice.transcript.read`, `voice.number.manage`, `ai.assistant.use`, `ai.document_intelligence.use` |
| `clinqetshared\Enums\DocumentType.cs` (L39-51) | Append-only enum; `ProviderData` document families |
| `clinqetinfrastructure\Services\Tenancy\BusinessClosureTeardown.cs` (L22-24, L142-148) | `IAzureSearchIndexer`, partition purge list — **extend for knowledge** |
| `clinqetcore\Entities\COSMOS\Voiceline.cs` | `ModelTier`, `HoursMode`, `pk`/`businessId` |
| `clinqetmcp\Clinqet.Mcp.IntegrationTests\Tests\McpToolIntegrationTests.cs` (~L47) | The curated tool list — **must be updated per new tool** |
| `clinqetfuncations\Clinqet.Communications.UnitTests\Voice\RealtimeSessionPayloadBuilderTests.cs` | Move 1's test home (§0.18) |
| `cosmosindexsetup\Program.cs` (L182-613 service index, L628-761 provider index, L767-976 `Main`) | Index definition patterns, envSuffix naming, create-or-update, invocation point |
| `cosmosindexsetup\Properties\launchSettings.json` | `Dev (India)` is FIRST — always pass `--launch-profile` |
| `cosmosindexsetup\ClinqetCosmosAIIndexSetup.UnitTests\ProviderIndexDefinitionConventionTests.cs` | ‼️ Reads `Program.cs` as TEXT and splits on `"class ProviderSearchIndexInitializer"` — put a new initializer in its own file |
| `clinqetcore\Entities\AISearch\SearchDocument.cs` / `ProviderSearchDocument.cs` | Document POCO patterns; `[FieldBuilderIgnore]` vector opt-out (L379-381); `hasEmbedding` guard (L425-432); the never-drop-a-field note (L110-115) |
| `clinqetcore\Utilities\SearchScoringProfiles.cs` / `SearchSuggesterFields.cs` | Where shared index name constants belong |
| `clinqetcore\Cosmos\Setup\CosmosContainerPolicies.cs` | The 8 existing container policies — the `KnowledgeBase` policy goes here |
| `clinqetinfrastructure\Services\Search\AzureSearchIndexer.cs` / `AzureAIFoundryEmbeddingService.cs` | The write path and embedding service (`text-embedding-3-large`, 3072 dims) to mirror |
| `azureautomation\deploy.ps1` (L1594-1595 index names, ~L6814/6957/7374/7602 settings blocks) | Where `AISearch__KnowledgeIndexName` must be wired |
| `clinqetwebpartnerapp\src\app\dashboard\profile\layout.jsx` (L133-144) | ‼️ The real AI-Receptionist menu entry — Knowledge goes immediately after |
| `clinqetwebpartnerapp\src\app\dashboard\profile\profileScreensAreCapabilityGated.test.js` | ‼️ Sweeps every profile page; a new page must be registered or the suite fails |
| `clinqetwebpartnerapp\src\services\profileServices.js` (L410-441, L443-515) | `putFileWithProgress` (XHR, real progress) + the batch SAS choreography to copy |
| `clinqetwebpartnerapp\src\components\Profile\Licenses.jsx` | Closest structural precedent: file rows, per-status render, progress bar, delete-confirm |
| `clinqetwebpartnerapp\src\components\tenancy\primitives.jsx` · `SurfaceAccess.jsx` | Design-system primitives; `CapabilityGate` |
| `clinqetwebpartnerapp\src\lib\tenancy\renderingRules.js` ↔ `clinqetmobilepartnerapp\src\lib\tenancy\renderingRules.ts` | ‼️ Line-for-line twins, parity-tested in a sandbox |
| `clinqetmobilepartnerapp\src\appNavigation\{constant,gatedScreens,MyDashboard-Route,linking,types}.tsx` | The five files a new mobile screen touches |
| `clinqetmobilepartnerapp\src\Screen\ProfileFlow\ProfileScreen\index.tsx` (L1067-1075) | The mobile AI entry — Knowledge goes immediately after |
| `clinqetmobilepartnerapp\src\Util\fileUpload.ts` (L33) · `mediaLimits.ts` | ‼️ `putBlobToSasUrl` (XHR — fetch breaks the SAS signature); add `knowledgeDocuments` limits |
| `clinqetmobilepartnerapp\src\components\common\ui.tsx` · `src\theme\index.ts` | Mobile primitives and design tokens |

**Glossary:** *Map mode* — catalog > 60 offerings, prompt carries a category map + `find_services` instead of
the full list. *Full mode* — ≤60, everything embedded. *Passage/chunk* — a ~350-token slice of a document.
*Preamble* — the one-line spoken sentence before a tool call. *Expert check* — Move 2's supervisor tool.

---

*End of plan. Nothing in this document has been implemented.*
