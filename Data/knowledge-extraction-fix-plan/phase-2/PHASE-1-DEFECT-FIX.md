# Phase-1 defect repair — its own change, before any Phase-2 work

Written 2026-09-11 by the Phase-2 session. Found by the step-zero live re-run of the 17 retained fixtures on
the deployed pipeline (`phase-1\live-after\STEP-ZERO.md`). Nothing committed, pushed or deployed.

Five defects, all shipped by Phase 1, none reachable by a unit test written at the time. Each fix is a rule
decided by evidence the document itself carries — not a patch for the file that exposed it.

---

## 1. What changed

| File | Change |
|---|---|
| `clinqetinfrastructure\Services\Knowledge\KnowledgeDocumentParser.cs` | **P1-A** `IsATableHeader` — a pipe line a delimiter row declares, that reads as labels, and whose cell count is the shape of the rows it labels, is a table header and never furniture (either side of the delimiter, so the real header below a stripped banner is covered too) · the **declaration rides down**: when a stripped line was carrying a table's delimiter row, the delimiter moves under the line that now heads the table · **P1-E** `DigitRuns` + `CountsThePage` + `IsWrittenLine` — a page ordinal is a shape that repeats across pages **whose digits equal the page**, scanned without the furniture character minimum |
| `clinqetinfrastructure\Services\AI\DocumentTranscriptComparer.cs` | **`IsWordCharacter`** — a word keeps the marks that spell it (Indic vowel signs, virama, Thai/Khmer marks, ZWJ/ZWNJ), applied to tokenisation, the word test in `Keys`, the word share in the repair gate and `CarriesLosableContent` · **`IsSignOrDash`** + the range guard — a dash between digits is a range, not a sign, and one spelling for the sign · **`PageCarries`** — the page-wide containment the layout rule already used, exposed for the verifier |
| `clinqetinfrastructure\Services\AI\VisionDocumentTranscriptionService.cs` | **P1-C/P1-D** — a source-only line is dropped (`SourceUnitUnconfirmed`) only when the source check read that region and came back with content **the transcript already holds**; with no usable check, or a check that answers with something nobody else has, the line is still kept |
| `clinqetshared\Enums\TranscriptionVerificationDisposition.cs` | `SourceUnitUnconfirmed` |
| `clinqetcore\Models\Knowledge\KnowledgeBlocks.cs` | `KnowledgeExtractionOutput.RenderedPages` — the lane states whether it rendered the pages |
| `clinqetfuncations\...\KnowledgeIngestProcessorFunction.cs` | **P1-B** — a picture is transcribed only where the document's own text could not reach it (`!RenderedPages`); on a rendered source a picture the describer refused is still described, from the page's own already-extracted words (`DescribeFromItsOwnWords`, `PageText`) so C12-L holds at zero cost |

## 2. Tests (all in the consuming host's suite, §0.18)

`KnowledgeDocumentParserTests` +5 · `DocumentTranscriptionAdjudicationTests` +9 · `KnowledgeIngestProcessorFunctionTests` +2.

| Suite | Result |
|---|---|
| `Clinqet.Communications.UnitTests` | **4,328 / 4,328** (Phase 1 left 4,307) |
| `Clinqet.API.UnitTests` | **11,946 / 11,946** |
| `Clinqet.Mcp.UnitTests` | **918 / 918** |
| `C:\Nik\knowledge-table-hunt` | **103 / 103** |
| `kreplay --all` over the 17 live artefacts | every `cards-HEAD.txt` **byte-identical** to Phase 1's — the live content still conserves exactly |

## 3. Sabotage sweep — and the two it exposed

Each guard inverted once from a scratchpad snapshot, never through git (§0.19).

| # | Guard inverted | Result |
|---|---|---|
| S-A1 | `IsATableHeader` always false | **FAILS** `…SurvivesWhereNothingCanInheritIt` |
| S-A2 | the delimiter move removed | **FAILS** `…AStrippedLineAboveADelimiter…` |
| S-A3 | `CountsThePage` always true | **FAILS** `…ABareAmountAtEveryPageEdge…` |
| S-A4 | `picturesCarryUnreadText` forced true | **FAILS** `AStandaloneImage_IsNotReadASecondTimeAsAPicture` |
| S-A5 | the `SourceUnitUnconfirmed` branch disabled | **FAILS** `AnOcrRowTheSourceCheckReadsAsSomethingElse_IsNotRestored` |
| S-A6 | `PageCarries` forced true | **FAILS** `AConfirmedRowThatWouldDeleteWordsAroundIt…` — the safety half |
| S-A7 | `IsWordCharacter` reduced to `char.IsLetter` | **FAILS 3** `AnIndicHeading_…` |
| S-A8 | the dash-range guard removed | **FAILS 2** `ARangeWrittenDifferently_…` |
| S-A9 | `CarriesLosableContent` back to bare letters | **FAILS 3** `AnIndicHeading_…` |

‼️ **S-A1 and S-A8 PASSED on the first attempt and each exposed a test that proved nothing:**

- **S-A1.** The header case was being covered by the **cross-page header inheritance**, which quietly
  repaired what the strip had broken — so the exemption could be deleted and every test stayed green. The
  new case puts a *different* table between the fragments, where nothing can inherit labels, and the
  sabotage then fails as it must.
- **S-A8.** Widening the dash family alone made the one-dash case pass, so the "a dash between digits is a
  range" guard was unreached. The case is now a theory over four real spellings (`2013-2019`, `2013 - 2019`,
  `2013 — 2019`, `2013−2019`); two of them fail without the guard.

## 4. Two further defects this work found, both general

- **Indic/Thai/Khmer words were shredded into bare consonants** everywhere the comparer counts words. Two
  consequences, both live: unrelated words scored as near-matches, so a page title aligned to an unrelated
  price row (the Hindi heading carried back onto the page); and `CarriesLosableContent` could never count a
  word in those scripts, so **a whole line the transcript dropped was never even reported as missing** unless
  it happened to carry a number.
- **`PageCount` is not the same question as "was this page rendered"** — a web page has a page count and no
  pixels. The lane now states `RenderedPages` itself, so the two cannot drift.

## 5. What still needs the owner

`kaudit reprocess` drives the DEPLOYED host, so these fixes cannot be proven end to end until the deploy.
After **shared → core → infrastructure → Functions → API**, from `C:\Nik\Data\knowledge-extraction-audit\tools\kaudit`:

```
dotnet run -- reprocess ca SX3SG2 726e13b338ae4b829598f23508bf6e77   # P1-A: pages 2-3 must be labelled TABLES, no raw |---| in any card
dotnet run -- reprocess ca SX3SG2 6fcd9c32ee6e4c8397c7babc7121a462   # P1-B + P1-C: no duplicate raw transcript card, no `1, 54 | ₹250`, section is not `2 414`
dotnet run -- reprocess ca SX3SG2 c425468ec8c34f0890587e62f0136e72   # P1-B: the photo list indexed once
dotnet run -- reprocess ca SX3SG2 e20a44eb9cce470abf36e0f05b3b0d89   # P1-B: the same
dotnet run -- reprocess ca SX3SG2 bfb6dfba8dfb472d97ffeefbaae0b25d   # P1-D: EDUCATION must not repeat the experience tail
dotnet run -- reprocess ca SX3SG2 4eeae96e1e0549538283705897ca3bc0   # P1-D: no trailing duplicate title block
dotnet run -- reprocess ca MEE3IC be07d747c73944a587a3a1029cb5717f   # C12-L still holds: described, and indexed once
```

Then `wait` → `pull` → `alerts` per document, and `kaudit drift ca`.
