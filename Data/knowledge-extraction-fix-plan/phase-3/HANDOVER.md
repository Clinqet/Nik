# PHASE 3 — HANDOVER

> Written 2026-09-15. Read `PROGRESS.md` beside this file for the working detail, the measurements and the
> gotchas; this is what changed, what is proven, and what the next session must not assume.

## 1. The one-line summary

The knowledge path can now be searched in the alphabet a document is actually written in — on the phone as
well as on the screen — the two surfaces share one query contract and one rank-fusion rule, the material PDF
renders every script the detector recognises, an AI-written source says so on both apps, and thirteen
provider-UI defects are closed on web and mobile together.

**Two things are deliberately NOT built and are waiting on the owner. Both are §0.7 asks and both are written
out in full in `PROGRESS.md` §7 and §8.** Neither is a regression: each leaves today's behaviour in place.

## 2. What changed, file by file

### `clinqetcore`
| File | Change |
|---|---|
| `Utilities/TextScriptDetector.cs` | **+7 script families** (Han, Japanese, Hangul, Thai, Cyrillic, Greek, Hebrew). The **CJK precedence rule**: Kana or Hangul present ⇒ the Han beside it belongs to that language, so a Japanese menu is ONE alphabet and a mostly-kanji document is not labelled Chinese. **A dense-script character floor** — 12 characters is ~3 English words but ~12 Chinese ones, so an 11-character Chinese menu read as Latin. **Digit folding both ways** (`૫૦૦` ⇄ `500`) |
| `Interfaces/BusinessSearch/BusinessSearchScriptPlan.cs` | A tool field and a language name for each new script |
| `Interfaces/Knowledge/IProviderKnowledgeSearch.cs` | The two `SearchForProviderAsync` overloads collapse to ONE; the performance contract now describes the fan-out honestly and says why fusion is by rank |
| `Interfaces/Search/KnowledgeSearchClient.cs` | The wrapper may be **present and empty** — see F10 below |
| `Models/Knowledge/KnowledgeQueryRenderings.cs` | **New.** The one factory for the single-leg rendering list; the script is DETECTED, never assumed |
| `Entities/AISearch/KnowledgeSearchDocument.cs` | `contentCjk` added; `updatedAt` filterable/sortable and `docType`/`chunkKind` facetable dropped |

### `clinqetshared`
`KnowledgeSearchQuery.Text` → **`Renderings`** (N per-script legs) · `KnowledgeQueryRendering` · the result
carries `LegsRequested` / `LegsSucceeded` / `NotSearchedIn` · `IsBrowseQuestion` · `KnowledgeSourceChannel.Of()`
— **one implementation of "whose words is this", shared by phone and screen** · `BusinessSearchCitationDto.Channel`
· `ProviderContext.KnowledgeLanguages` · `RetrievalMaxQueryLegs` (‼️ `CjkFieldEnabled` was here and was
**DELETED 2026-09-16** — see `AUDIT.md` §14) · `TextScriptDetector.NeedsCjkTokenisation` · the Business
Search prompt's rule 9.

### `clinqetinfrastructure`
| File | Change |
|---|---|
| `ProviderKnowledgeSearchService.cs` | The phone fans out **one leg per rendering**, concurrently; embeddings coalesce into one request; per-leg failure and timeout are reported, never fatal, and a timed-out leg still alarms. **F6** answerable docIds in the FILTER. **F5** one unnarrowed retry on a completely empty narrowed result. **F4** one overview unless browsing. **G-12** the caller's words escaped for simple query syntax. **G-13** both digit forms. **G-14** vector k = the window. **G-16** the ref cap derived from settings, truncation logged. **G-20** surrogate-safe cut. **The envelope reserved in TOKENS, not Latin characters** |
| `…Service.Provider.cs` | One entry point; **`FuseByRank`** replaces the max-score merge |
| `KnowledgeSearchIndexer.cs` | Writes `contentCjk` for CJK cards only, behind the gate; holds a nullable client and refuses in words when there is no index |
| `BusinessAlphabetService.cs` | Takes the settings section it actually reads, so the voice hosts can resolve an alphabet set without binding a forty-key block they never touch |
| `RealtimeSessionPayloadBuilder.cs` | The per-call prompt **names the business's own non-Latin alphabets** and orders the model to fill those question fields |
| `FullProviderContextService.cs` | `KnowledgeLanguages`, from the index facet, optional and fail-soft |
| `PdfFonts.cs` / `QuestPdfService.cs` | **Noto Bengali, Tamil, Telugu and Arabic embedded** (8 faces, OFL) + **RTL for Arabic script**, decided from the provider's own words |
| `Tools/SearchKnowledgeTool.cs` | `channel` in the model payload and on the citation |

### hosts
`clinqetmcp` — `search_knowledge` gains **14 named per-language question fields**, each verified with the
Unicode detector before it becomes a leg, plus `askingWhatTheBusinessHas`. `clinqetapi` / `clinqetfuncations`
— **F10**, both of them. `cosmosindexsetup` — the v2 index and **its own version key**.

### apps
`clinqetwebpartnerapp` and `clinqetmobilepartnerapp` — the thirteen UI items and X-01's chip, with keys in
all five language files on both apps.

## 2b. ‼️ OWNER-APPROVED AFTER THE FIRST AUDIT — two Cosmos fields, and a defect found by looking

The owner approved both open §0.7 asks in conversation on 2026-09-15, in the narrowed shapes below. **Neither
touches AI Search.** Full reasoning, edge cases and sabotage results are in `AUDIT.md` §12.9.

| Item | Where | What it does |
|---|---|---|
| **R-10** | `KnowledgeDocument.cardsRewriting` (Cosmos, nullable bool) | A re-read no longer silences the document for its whole run — only for the seconds its cards are actually being overwritten. Written before the first card write, cleared **inside `CommitAsync`** so no terminal path can forget. ‼️ The flag is only read while the row is `Processing`, which answered nothing before, so it can only ADD answerability — a stranded `true` is exactly the old behaviour |
| **X-01's other half** | `AiTurnCitation.channel` (Cosmos, nullable string) | A REOPENED answer keeps the "described by AI from a photo" / "summary written by AI" mark. Absent = the provider's own words, so a turn stored before the field renders as it does today. **No UI change was needed** on either app |
| **Plural defect** | 4 reading notices × 5 languages | *"We left 1 sentences out…"* — found on the live screen, not by a test. `_One` siblings, the spelling already in use. The server resolves the sentence, so **both apps get it with no client change** |

‼️ **A fourth item was proposed and WITHDRAWN**: a stuck-run sweeper. `KnowledgeProcessingRules.HasStoppedPartWay`
(U-04) already alerts, already tells the provider's screen the run stopped, and already permits a re-read. A
second mechanism would have duplicated it. **Not building it was the decision.**

## 3. ‼️ What the next session must NOT assume

1. ✅ **DONE 2026-09-16 — `contentCjk` is LIVE in both regions and the switch is DELETED.** Do not look for
   `Voice:Knowledge:CjkFieldEnabled`; it no longer exists. v2 was refilled by COPYING every card out of v1
   (vectors byte-identical) rather than re-ingesting. ‼️ **The permanent rule:** the code names `contentCjk`
   on EVERY query, and naming a field an index does not declare is a 400 on every search — so an index
   rebuild ALWAYS precedes the deploy that names a new field, in every region.
2. ‼️ **The retained fixture is BOTH, and a mid-phase note in this folder saying "Hindi, not Gujarati" was an
   over-correction — read live from the index on 2026-09-15 and corrected here.** `4eeae96e…` is a
   `श्री ब्यूटी पार्लर रेट कार्ड` whose six cards carry **Devanagari** (`सेवा: बाल कटवाना | कीमत: ₹250`),
   **Gujarati** (`વાળ કાપવા — ₹250`) and an English note — one document, three alphabets, which is exactly why
   it is the right fixture. `6fcd9c32…` is Gujarati throughout. The answer under test is `₹250` either way.
3. **`kprobe` is a replay, not the receptionist.** It proves the index and the ranking; the gates, the trim
   and the note need the deployed hosts.
4. **The one web test failure is not this phase's.** `productIdentityFollowsPreference.test.js` reads `.env`
   and `.env.example`, both tracked and both carrying `NEXT_PUBLIC_API_PLATFORM=partner` **at HEAD**. Neither
   file was touched here.

## 4. Open questions for the closing audit

- Both §0.7 asks (`PROGRESS.md` §7 and §8) — the citation `Channel` on the stored turn, and generation
  isolation's two halves.
- **Japanese has not been measured** the way Chinese was. Chinese scores 0.603 on the vector leg, which is
  why `contentCjk` was argued as a recall improvement rather than a rescue; Japanese may be weaker.
- **Han, Japanese and Hebrew still render as boxes in the material PDF.** Declared, not discovered: a CJK Noto
  is 10–16 MB against 70–240 KB for an Indic one, and that is an owner decision about assembly size.
- `RetrievalMaxQueryLegs` is 3 and the tool offers 14 fields. A business writing in four alphabets gets three
  legs and an honest "not searched in" note. Nobody has measured whether that happens.
