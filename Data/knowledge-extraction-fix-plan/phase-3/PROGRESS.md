# PHASE 3 — progress, measurements and decisions

> Started 2026-09-15. Owner approved D1–D4 and the §0.7 index table, then stepped out with the
> instruction to finish end to end: code → test → push → deploy → live proof → multidimensional audit →
> fix every finding → re-review → handover + Phase-4 prompt.

## 0. Owner decisions, given in conversation 2026-09-15

| Id | Decision |
|---|---|
| **D1** | Voice tool gets **one question-field per language**, the Business Search shape (measured 25/25), server-verified by the Unicode detector. NOT a single generic field |
| **D2** | ✅ **The §0.7 search-index table is APPROVED**: `generation`, `contentCjk`, `contentVector` → not stored, drop unused facetable/sortable. One rebuild. **No SQL, no Cosmos change.** Sandbox: no backfill needed, nothing to delete |
| **D3** | Sending is **already ON** — the audit's premise was wrong (see §2). Fix the latent default-safety bug only |
| **D4** | Mockups produced + registered but **NOT a blocking gate**; they ship alongside the code. UI must be modern, on-theme, responsive on laptop + iPad + phone, **tested live**, and the mobile app must use native strengths |
| — | **NEVER delete the 17 SX3SG2 fixture documents** (Phase 4 deletes them) |
| — | CI tests may be skipped for fast deploy cycles, **but must be re-enabled before the final push** |

## 1. ‼️ LIVE MEASUREMENTS — taken before any code was written

### 1.1 EX-33 is CLOSED, proven live
`GET /indexes/clinket-knowledge-dev` on the CA search service returns `en.microsoft` on
`content, docTitle, sectionTitle, docName, docType, linkedGroupName, linkedServiceNames`.
**The rebuild PLAN.md recorded as "pending owner action" has happened.** Same read confirms G-18
(`contentVector` retrievable+stored) and G-19 (`updatedAt` filterable+sortable, `docType`/`chunkKind`
facetable — all unused).

### 1.2 ‼️ How `en.microsoft` really tokenises — and why Chinese/Japanese need their own field
Analyze API against the PHYSICAL index, with REALISTIC unspaced CJK:

| text | `en.microsoft` (today) | `standard.lucene` | custom `standard_v2 + lowercase + asciifolding + cjk_width + cjk_bigram` |
|---|---|---|---|
| `剪发价格120元烫发380元` (menu line) | **`['剪发价格120元烫发380元']` — ONE token** | per character | `['剪发','发价','价格','120','元烫','烫发','380','元']` |
| `烫发多少钱` (the question) | **`['烫发多少钱']` — ONE token** | per character | `['烫发','发多','多少','少钱']` |
| **do they match?** | ❌ **NEVER - zero overlap** | partially (noisy single chars) | ✅ `烫发` matches |
| `ヘアカットは3500円です` | one token | `['ヘアカット','は','3500','円','で','す']` | `['ヘア','アカ','カッ','ット','トは','3500','円で','です']` |
| `Price lists for the cafe` | `['price','list','lists','cafe','café','cafe']` — **stems + folds accents** | `['price','lists','for','the','cafe']` | `['price','lists','for','the','cafe']` |

**Conclusions, and they decide the design:**
1. `en.microsoft` tokenises Indic, Arabic, Thai, Cyrillic and Korean into words **perfectly well** — BM25 is
   NOT dead for those. Only **Chinese and Japanese** collapse to one token.
2. `en.microsoft` is the only one that **stems English** (`list`+`lists`) and **folds accents**
   (`cafe`+`café`). It cannot be replaced — hence a SECOND field, not a swap.
3. `cjk_bigram` **works on this Azure service** — verified by inline Analyze, no index change needed to test.
4. **Indic digits are NOT folded** by either analyzer: `૫૦૦` stays `૫૦૦`. G-13 confirmed live.

### 1.3 Cross-script embedding, measured on the live deployment
`text-embedding-3-large`, 3072 dims, cosine:

| question ↓ / document → | Gujarati | English | Chinese |
|---|---|---|---|
| English | 0.263 | **0.524** | 0.482 |
| Gujarati | **0.230** | 0.040 | −0.027 |
| Chinese | 0.248 | 0.481 | **0.603** |

⇒ the native-script leg is what makes **Indic** reachable at all (0.04 → 0.23 **plus exact BM25**).
⇒ Chinese is well served by the vector leg; its gap is BM25 only, which `contentCjk` closes.

### 1.4 F10 is TWO hosts, not one
`clinqetapi/Clinqet.API/Program.cs:1007` **and**
`clinqetfuncations/Clinqet.Communications/Program.cs:877` both register `KnowledgeSearchClient` with
`configuration["AISearch:Endpoint"] ?? throw` — `??` catches null, and deploy writes the key **blank**.
Only `clinqetmcp/Clinqet.Mcp/Program.cs:283` does it correctly.

### 1.5 F3 is half-built already
Phase 1 shipped `KnowledgeTokenEstimate`. The retrieval calls
`CharsPerToken(passages[0].Passage.Content)` — the factor comes from **rank 1 alone**, so a mixed-script
result sizes a Gujarati card at 4 chars/token. A finding, not a rebuild.

### 1.6 D3 — sending is ON, the audit's premise was wrong
Live CA API: `materialSharingEnabled = True`, `receptionistAvailable = True`. All three hosts' appsettings
say `true`; the class default is `true` (owner decision 2026-08-21). **Nothing to turn on.**
The real bug is one line: `receptionistUploadDefault(seed)` returns `AnswersAndSends` **ignoring the
switch**, so on a stamp where sending is OFF a new upload stores "and sends" while showing "answers only".
Latent, stamp-conditional, invisible on CA today. Fix = the default follows the switch.

### 1.7 The index version suffix is SHARED by all three indexes
`cosmosindexsetup/Program.cs:1031-1033` builds all three physical names from one `Search:IndexVersion`.
Bumping it to ship the knowledge schema would needlessly rebuild the services and providers indexes and
force a full re-stream of both. ⇒ the knowledge index needs **its own version key**.

## 2. ‼️ NEW GOTCHAS — add to phase-2/PROGRESS-SESSION2.md §15 at handover

25. **The Analyze API 404s on an ALIAS.** `GET /indexes/{alias}` resolves the alias (200), but
    `POST /indexes/{alias}/analyze` does not — it needs the PHYSICAL name (`clinket-knowledge-dev-v1`).
    Get it from `GET /aliases` with api-version **2026-04-01** (2024-07-01 has no aliases endpoint).
26. ‼️ **My first tokenisation probe printed `[]` for all eight scripts** because it read
    `b.get('tokens', [])` off an **error** body. It looked like "en.microsoft tokenises nothing" — a
    spectacular false finding, caught only by re-probing with the status printed. **Gotcha 6 again: green
    can mean "I could not look". Print the HTTP status beside every result.**
27. ‼️ **A CJK probe with SPACES in it measures nothing.** My first Chinese sample was
    `美发沙龙价格表 剪发 120` — the spaces did the tokenising. Real Chinese has none. **Probe a script the
    way the script is actually written**, or you measure your own test data.
28. **Line endings are per FILE, not per repo.** Gotcha 25 says clinqetcore is CRLF and
    clinqetinfrastructure LF; measured today, `clinqetcore/Utilities/TextScriptDetector.cs` is **LF** and
    `clinqetinfrastructure/.../ProviderKnowledgeSearchService.cs` is **CRLF** — the opposite. **Detect per
    file**, never per repo.
29. **The Bash tool collapses `\\` inside a quoted heredoc.** `'\\'` reached Python as `'\'` and
    `C:\Nik` in a docstring became a `\N` unicode-escape SyntaxError. Write Python patch files with the
    editor tool, or keep backslashes out of them entirely.
30. ‼️ **A BACKTICK INSIDE A DOUBLE-QUOTED SHELL STRING IS COMMAND SUBSTITUTION, AND IT EATS YOUR PROSE.**
    `py -c "…`contentCjk` carries…"` ran `contentCjk` as a command and substituted **nothing**. It shipped a
    comment whose subject was missing into `KnowledgeSearchIndexer.cs`, and it emptied **six** backticked
    terms out of the `MEMORY.md` index line. The shell says `command not found` on stderr and carries on.
    **Never pass prose through a shell string — write the script to a file with the editor tool.** And after
    any scripted edit, grep every added line for empty backtick pairs, doubled spaces, tripled quotes and
    stray `\uXXXX`; this session found five scars that way, four of them already pushed.
31. ‼️‼️ **A SNAPSHOT RESTORE THAT KEEPS THE ORIGINAL TIMESTAMP DOES NOT RESTORE THE BUILD.**
    `shutil.copy2` (and `cp -p`, and `robocopy` by default) **preserves mtime**. After a sabotage test
    restores a file that way, MSBuild sees a source **older** than the binary it just built *from the
    sabotage* and does not rebuild — so every later test run exercises sabotaged code while the source on
    disk is innocent. It produced **two false "the sabotage PASSED" verdicts** and then failed a brand-new,
    correct test with an arithmetically impossible result. **Touch every file you restore** (`os.utime(path,
    None)`), or build with `--no-incremental`. The tell: a result the code on disk cannot produce.
32. **`git log -S` on a `.env` tells you which commit introduced a line, and it is often the same commit
    that added the guard forbidding it.** `productIdentityFollowsPreference` was red on master for a day
    because one commit shipped both the rule and its violation. **A test that is red at HEAD is not
    automatically yours — but it is automatically your problem**, because your push inherits its CI.

## 3. Build order

| Stage | Contents | State |
|---|---|---|
| **A** | shared multilingual contract: script blocks, one query shape, rank fusion, token factor, Indic digits | in progress |
| **B** | voice path legs + per-call prompt naming the business's alphabets | |
| **C** | F4, F5, F6, F10 (×2 hosts), F11 hygiene | |
| **D** | F9 fonts + RTL; X-01 card kind + prompt + web/mobile label | |
| **E** | provider UI: U-05, U-06, U-12, U-14, U-15, U-18…U-25, web + mobile | |
| **F** | index v2 + `kaudit probe`, live proof, audit, handover | |

## 4. Live testing — the session is OPEN
The owner signed in at `business.dev.clinket.com` in the Browser pane (tab `seed`) at 2026-09-15.
`/dashboard/profile/knowledge` renders with 14 documents. **Responsive proof is unblocked** — no need to
ask again unless the session expires.

---

## 5. BUILT SO FAR (2026-09-15, stages A–C)

| Item | What landed | Where |
|---|---|---|
| **F2** | 7 script families added (Han, Japanese, Hangul, Thai, Cyrillic, Greek, Hebrew) + the CJK precedence rule: Kana or Hangul present ⇒ the Han beside it is that language's, so a Japanese menu is ONE alphabet and a mostly-kanji Japanese document is not labelled Chinese | `TextScriptDetector`, `BusinessSearchScriptPlan` |
| **contract** | `KnowledgeSearchQuery.Text` (one string) → `Renderings` (N per-script legs). **Both surfaces now take the same type**; the two `SearchForProviderAsync` overloads collapsed to one | `KnowledgeSearchModels`, `IProviderKnowledgeSearch` |
| **F1** | Voice path fans out one leg per rendering, concurrently; embeds coalesce into one request; per-leg failure/timeout is reported, never fatal | `ProviderKnowledgeSearchService` |
| **F1 (tool)** | `search_knowledge` gained 14 named per-language question fields; every one is VERIFIED with the Unicode detector before it becomes a leg | `KnowledgeTools` |
| **F1 (prompt)** | The per-call realtime prompt now NAMES the business's own non-Latin alphabets and orders the model to fill those fields. Alphabets come from the index facet via `IBusinessAlphabetService`, optional + fail-soft | `RealtimeSessionPayloadBuilder`, `FullProviderContextService` |
| **F7** | Max-score merge → **reciprocal rank fusion** (k=60), shared by both surfaces. Single-leg output is byte-identical | `FuseByRank` |
| **F3** | (already half-built by Phase 1) — see finding §1.5, still to fix | — |
| **F4** | At most ONE overview unless the caller is browsing; `askingWhatTheBusinessHas` carries it | `TrimToTokenBudget`, `KnowledgeTools` |
| **F5** | A narrowed search that finds NOTHING retries once unnarrowed inside the same budget | `SearchAsync` |
| **F6** | Answerable docIds go in the FILTER (≤500), not only the post-check; gates awaited with the embeddings so nothing serialises | `WithAnswerableDocuments` |
| **F10** | Blank endpoint ⇒ **no registration** ⇒ null client, in the API **and Functions** hosts (the audit named one) | both `Program.cs` |
| **G-12** | Caller text ESCAPED for simple query syntax (`-20` was a NOT clause); `" OR "` → a plain space | `BuildSearchText` |
| **G-13** | Both digit forms searched, keyed on the leg's own script | `TextScriptDetector.FoldDigitsToAscii` / `MapAsciiDigitsTo` |
| **G-14** | Vector `k` = the fusion window, not the seat count — both surfaces | both leg runners |
| **G-16** | Ref cap DERIVED from `MaxPassagesPerMaterialSend` × the neighbour window, and truncation is logged | `GetByRefsAsync` |
| **G-17** | API host: 6 orphan keys removed. Functions host: **14** removed (it registers no `IProviderKnowledgeSearch` at all). Both convention registries updated with the audited reader | 3 appsettings + 2 convention tests |
| **G-20** | Surrogate-safe 200-char cut | `NormalizeText` |
| **stale comment** | `imageRef` "selected only while the feature is on" was 3 releases stale | `ProviderKnowledgeSearchService` |

### ‼️ A DEFECT I INTRODUCED AND CAUGHT — worth keeping
Reserving the coverage sentence at its WORST case (every alphabet unsearched) charged **every ordinary call**
for a sentence it would never carry. At `RetrievalMaxTokens` 600 it cost a whole seated card, and three
`TokenBudget_*` tests went red. **The trim knows this result's coverage before it seats anything**, so the
reserve is now exact. *A worst-case reserve on a shared budget is a tax on the common path.*

### Test state at this checkpoint
`Clinqet.Mcp.UnitTests` **921/921** · `Clinqet.API.UnitTests` **12,274/12,274** · all nine test projects build.

## 6. STAGE C/D COMPLETE — and three defects the TESTS found in my own work

| # | What I got wrong | How it was caught |
|---|---|---|
| 1 | **The coverage sentence reserved at its WORST case** charged every ordinary call for a sentence it would never carry — a whole seated card at 600 tokens | three `TokenBudget_*` tests went red |
| 2 | ‼️ **F10's first fix made the API host UNBOOTABLE.** Conditional registration turns an unresolvable factory into an unresolvable service, and FOUR services take the client as required. Worse than the bug | the whole integration suite died at DI validation |
| 3 | ‼️ **Reading `builder.Configuration` at REGISTRATION time does not see a `WebApplicationFactory`'s configuration** — it is layered on after the app's own builder code runs. Every such read must be inside the factory lambda | same failure; the fixture DID set the endpoint |
| 4 | ‼️ **The envelope was subtracted in Latin CHARACTERS from a budget expressed in another script's characters.** The note is always English (~1,700 chars ≈ 425 tokens) but 1,700 was taken off a 3,000-TOKEN budget — a Chinese or Japanese business got less than half its entitlement. Latin is arithmetically unchanged | writing the measurement test the settings comment had cited for months |
| 5 | **A 12-character floor is a LATIN floor.** An 11-character Chinese menu read as `Latn`; in CJK one character is one word, so the floor was 4× stricter there than for English | the first F2 test |

### Sabotage results
- `FuseByRank` → old max-score merge: **caught** by `AKeywordOnlyLegsBm25Scores_DoNotOutrankEveryCardOfAHybridLeg` (API integration).
- ‼️ An earlier voice-path sabotage **PASSED** — the phone's fusion never sees a score, so it could not regress that way. The test was renamed to what it actually pins and the real F7 test moved to the host where the defect lived (§0.18).

### Also landed
- **F9**: Noto Bengali/Tamil/Telugu/Arabic embedded (OFL, 8 faces, 1.4 MB) + RTL for Arabic script, decided from the provider's OWN words. The old guard was keyed by **localization language** while its comment claimed **script** — replaced with the script-keyed one, which is the claim actually made. Han/Japanese/Hebrew are DECLARED gaps (a CJK Noto is 10–16 MB; owner's call).
- **X-01**: one `KnowledgeSourceChannel.Of()` shared by phone and screen; `channel` in the tool payload; `Channel` on the citation DTO (absent for the document's own words); rule 9 in the Business Search prompt, in appsettings **and** the class default, now pinned byte-identical by a new convention test that also proves the rule numbering has no gaps.
- **Cited test now exists**: `RetrievalPayloadSizeMeasurementTests` (it was cited by name for months and was in no repo).

### Suites after stage D
`Clinqet.Mcp.UnitTests` **954** · `Clinqet.API.UnitTests` **12,303+** · `Clinqet.Communications.UnitTests` **4,613** · API integration knowledge **17** — all green.

## 7. ‼️ ONE §0.7 ASK IS OPEN — NOT WRITTEN, AWAITING THE OWNER

X-01 marks an AI-written source on the LIVE answer. A **reopened** answer replays from
`AiTurnCitation` (`clinqetcore/Entities/COSMOS/AiSession.cs`), which maps field by field in
`McpSessionService.ToStored`/`FromStored` — so the mark silently disappears when a member reopens the same
answer, and the product then tells them two different things about the same words depending on when they
look. That is exactly the replay-parity defect the programme already paid to fix once.

Carrying it needs **one nullable string on a Cosmos entity**, and the owner's D2 ruling was explicitly
"No SQL change. No Cosmos change." **So it is not written.** The table, per §0.7:

| Column | Answer |
|---|---|
| **What** | `AiTurnCitation.Channel` — `string?`, values `picture-description` / `generated-overview`, absent for the document's own words |
| **Who writes it** | `McpSessionService.ToStored`, beside `Published` and `Reason`, in this same change |
| **Who reads it** | `McpSessionService.FromStored` → `BusinessSearchCitationDto.Channel` → the source card's chip, on web and mobile |
| **Why not a column** | It IS a field on an existing document, not a new entity |
| **Why not a constant/enum** | It varies per cited card |
| **Why not already stored** | Checked every field on `AiTurnCitation`: `Kind` is the SOURCE TYPE (which icon, which page it opens) and overloading it would break both; nothing else carries the chunk kind. Re-deriving on replay would need an index read per reopen and would contradict the deliberate "store the excerpt, never re-read it" rule beside the entity |
| **Cost** | ~25 bytes per cited source on a document already capped at 1.8 MB; no index, no new query |
| **What breaks if omitted** | A reopened answer drops the "described by AI" mark that the live answer showed. Not nothing — but the LIVE path, which is where a member reads an answer for the first time and decides whether to repeat a figure to a customer, is fully covered |

**Recommendation: yes, add it** — it is one nullable field and it closes the only remaining gap in X-01.
Until then the live path carries the mark and the replay does not.

## 8. ‼️ A SECOND §0.7 ASK — AND MY OWN TABLE UNDER-SPECIFIED IT

> ✅ **SUPERSEDED THE SAME DAY — the owner approved it and it is BUILT and PROVEN LIVE.** The section below
> is kept as the record of what was asked and why the first table was wrong; what actually shipped is
> **smaller than either version described**: ONE nullable Cosmos boolean, `KnowledgeDocument.cardsRewriting`,
> and **no search-index field at all**. The measurement that shrank it — a re-read only makes its cards
> unsafe for the SECONDS of the card write, not the minutes of the run — and the full edge-case analysis are
> in `AUDIT.md` §12.9.

**R-10 (generation isolation) is NOT built.** The §0.7 table I put to the owner listed one **search-index**
field and I wrote "No Cosmos change" beside it. That was wrong, and I found it while building: the index
field alone is useless. The reader has to know WHICH generation is live for a document, and that pointer can
only live on the Cosmos row — nothing else on the read path knows it.

I checked whether it can be derived instead of stored, and it cannot:

| Candidate | Why not |
|---|---|
| `UpdatedAt` | Moves on unrelated writes — that is finding E6, already logged |
| `ProcessingSince` | Belongs to the run in flight, not to the committed one |
| `ContentHash` | A re-run of identical content must still produce a NEW generation |
| Ask the index for `max(generation)` per search | An extra round trip inside a 4-second phone budget |
| Let both generations answer during the window | A caller could be read an old price and a new one in one answer — worse than the blackout it replaces |

**The complete ask, both halves:**

| | Search index | Cosmos |
|---|---|---|
| **What** | `generation` — `Edm.Int32`, filterable, on `KnowledgeSearchDocument` | `KnowledgeDocument.ActiveGeneration` — `int`, no index |
| **Who writes** | the indexer, on every card of a run | the Ready CAS, in the same write that commits the run |
| **Who reads** | every search filter | the gates sweep the search already makes |
| **Cost** | one filterable int; card ids carry the generation so a run writes alongside the live one instead of over it — 2× cards for the duration of a run only | ~4 bytes per row, no new query, no new index |
| **What breaks if omitted** | A provider who re-uploads or re-runs a document makes it **unanswerable to callers for the length of the run — up to 30 minutes.** It is today's behaviour, so nothing regresses; it simply stays broken |

**What IS being built now** (no Cosmos change, so it needs no further approval): `contentCjk` + its custom
analyzer, `contentVector` non-stored, and the unused facetable/sortable attributes dropped — all on a new
physical index with an alias swap, plus the knowledge index getting **its own version key** so bumping it no
longer drags the services and providers indexes into a full re-stream.

## 9. STAGE E (UI) AND STAGE F (INDEX v2) — BUILT

### Provider UI, web AND mobile, keys in all five language files
| Item | What changed |
|---|---|
| **U-05** | The server's per-file refusal (size, type, name, replace target) stays on the upload row. It used to be replaced by "This file didn't upload. Try again." — advice that can never work for any of those |
| **U-06** | Every swallowing `catch {}` on the mobile Knowledge screen and pictures panel now shows the server's own localized sentence. `failureMessage` moved out of the drafts section into `lib/knowledge/serverMessage.ts`, so the two halves of one screen cannot drift again |
| **U-12** | Mobile maps EVERY accepted extension to a MIME type, mirroring the web table — an Android picker returning no type for a `.tiff`, `.bmp`, `.webp` or `.pptx` signed octet-stream and the server refused the slot |
| **U-14** | The receptionist default FOLLOWS the sending switch, on both apps. It was hardcoded to "answers and sends", so with sending off the provider saw one thing and the product stored another — and switching sending on later would have made every such file sendable without them choosing it |
| **U-15** | The pictures sentence states what the cap LEFT OUT, not a total derived from live tiles that rewrote history after a delete |
| **U-18** | The 22 px "can be sent" tick keeps its size and gains a real touch target (`hitSlop` on mobile, a padded `::before` on web) |
| **U-19** | Long file names wrap to two lines and carry the full name in `title` |
| **U-20** | Mobile accepts a range whose top EQUALS its start, as web and the server always did |
| **U-21** | Mobile draws a skeleton for the two access boxes instead of nothing, so the sheet stops jumping under a finger |
| **U-22** | Subtitle, tab name, delete-cancel word and the count-limit plural aligned with web; **"(s)" is gone** — it cannot be localized in gu, hi, fr or es |
| **U-23** | `Link` + the route constant instead of a hardcoded `<a href>` that forced a full page load out of the dashboard |
| **U-24** | One coalescing gate between the mobile focus effect and the AppState listener — returning to the app read the list twice for one gesture |
| **U-25** | Under a secondary filter the button says "Show more" rather than inventing the page size |
| **X-01** | The "described by AI" chip on the source card, web and mobile, beside the existing not-published chip |

### Index v2 (the approved §0.7 table, minus generation)
`contentCjk` + its custom analyzer · `contentVector` non-stored and hidden · `updatedAt` filterable/sortable
and `docType`/`chunkKind` facetable dropped · **the knowledge index gets its own version key** so a knowledge
schema change no longer drags the services and providers indexes into a full re-stream.

‼️ **SUPERSEDED 2026-09-16 — the switch is DELETED and `contentCjk` is live in both regions.** What remains
true, permanently: Azure rejects an upsert naming a field the index does not declare (it fails the whole
document, not the field) and searching one is a query-time 400 on EVERY search — so an index rebuild ALWAYS
precedes the deploy that names a new field, in every region. This is the rule the stale `imageRef` comment
was written for. See `AUDIT.md` §14.

### ‼️ Proven live before it was written
Both tokenizer spellings the SDK could emit were replayed against the deployed CA index:

| | tokens | overlap with the question |
|---|---|---|
| `剪发价格120元烫发380元` vs `烫发多少钱` | `剪发 发价 价格 120 元烫 烫发 380 元` vs `烫发 发多 多少 少钱` | ✅ `烫发` |
| `ヘアカットは3500円です` vs `ヘアカットの料金` | bigrams | ✅ `ヘア アカ カッ ット` |
| `Price lists for the cafe` | unchanged | — |

### Test state
Mobile **4,841/4,841** · web **4,021 of 4,022** · MCP **954** · API **12,317** · Communications **4,624** ·
cosmosindexsetup **198**. ESLint 0 errors, `tsc --noEmit` clean.

‼️ **The one web failure is NOT mine and is pre-existing**: `productIdentityFollowsPreference.test.js`
("declares no product-selecting variable in .env or .env.example") reads `.env` and `.env.example`, both
tracked, both carrying `NEXT_PUBLIC_API_PLATFORM=partner` **at HEAD**. I touched neither file. Left alone —
deleting an env var to green a test I did not break is exactly the wrong move.

## 10. ‼️ LIVE BASELINE ON THE RETAINED FIXTURE — measured with `kprobe` BEFORE the deploy

Fixture: `SX3SG2` documents `4eeae96e…` + `6fcd9c32…` (the retained pair). The answer under test is
`सेवा: बाल कटवाना | कीमत: ₹250`.

‼️ **CORRECTED 2026-09-15 by the audit, from the live index — this line first said "a Hindi rate card, not
Gujarati", which over-corrected an earlier note that said "Gujarati". BOTH were wrong.** `4eeae96e…` carries
**six** cards in **three alphabets**: Devanagari (`सेवा: बाल कटवाना | कीमत: ₹250`), Gujarati
(`વાળ કાપવા — ₹250`) and an English note — one document, three writing systems, which is exactly what makes
it the right fixture for this phase. `6fcd9c32…` is Gujarati throughout (3 cards).

| Leg | keyword-only (pure BM25) | hybrid |
|---|---|---|
| **English** "what is the haircut price" | **1 hit, score 1.49 — and it is the ONE English sentence in the file** ("English notes: prices include GST"). The ₹250 row is unreachable by word | ₹250 row at **rank 2**, carried by the vector alone |
| **Hindi** "बाल कटवाने की कीमत क्या है" *(the leg F1 adds)* | **4 hits, scores 26.76 / 24.47 / 17.15** — the ₹250 row found by WORD | ₹250 row at **rank 2** |

**Three findings fall straight out of one measurement:**

1. ✅ **F1 is real and the fix is the only thing that closes it.** English word-search reaches exactly one
   English sentence inside a Hindi document. Everything else in that file is invisible to BM25 from English —
   and the phone, today, sends nothing but English.
2. ✅ **F7's numbers are WORSE than the test assumed.** Keyword-only returns **26.76** where hybrid returns
   **0.033** — a ratio of about **800×**, not the ~400× the unit test models. Under the old max-score merge,
   one leg whose embedding failed would have owned every seat in the answer, every time.
3. ✅ **F4 is visible in the raw ranking.** In the hybrid Hindi result, `DocSummary` and `DocAggregate`
   overviews take ranks 1 and 3 and push the actual ₹250 price row to rank 2 — on a question that is as
   specific as a question gets.

‼️ **This is a REPLAY of the query, not the receptionist.** It proves the index and the ranking. What it
cannot show is the gates, the trim and the note — those need the deployed hosts.

## 11. ‼️ A PRE-EXISTING RED SUITE, FROM PHASE 2, THAT BLOCKED MY OWN DEPLOY

`Clinqet.Communications.IntegrationTests` was **13 red before I started**, all with the same message:

```
System.InvalidOperationException : No service for type 'Clinqet.Core.Interfaces.AI.IAiBudgetGovernor'
has been registered.
```

`KnowledgeServiceDraftAnalyticsJob` gained `IAiBudgetGovernor` as a **required** constructor argument in
Phase 2's second session (commits `de9bf78` / `7d5c1eb`, 2026-09-15 — defect #9, "the draft extractor ran on
the Interactive lane, which the governor does not pace"). The job's integration tests were updated to
`sp.GetRequiredService<IAiBudgetGovernor>()`. **`FunctionAppFactory` was never told to register it.**

‼️ **This is gotcha 37 happening to the session that wrote gotcha 37** — *"BUILD EVERY TEST PROJECT IN EVERY
REPO — `dotnet test` on the unit suite is NOT a check."* The unit suite was green; the integration suite was
never run.

**Why it became mine:** a failed BUILD silently leaves the old code running and nothing says so (gotcha 11).
With this suite red, **no Functions deploy of my work could ever have happened** — I would have pushed,
watched nothing change, and debugged code that was not running. Exactly the two hours Phase 2 lost.

**Fix:** register `IAiBudgetGovernor` as a singleton in `FunctionAppFactory`, the way `Program.cs` does,
with the `IPlatformLimitAlerts` it depends on. Five lines, in the fixture, where the gap was.
