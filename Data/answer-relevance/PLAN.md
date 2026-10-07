# Answer relevance — the authority for P4-E-26 and everything it uncovered

> Started 2026-09-25. Owner: "user only seeing the relevant information … and it need to show all the correct
> search result as well … extraction, saving to the knowledge index and how we are displaying it … end to end".
> This file is the register, the decisions, the design and the evidence. `phase-4/FINAL-AUDIT.md` row P4-E-26
> points here.

## 0. Owner decisions (2026-09-25, in the conversation)

| # | Decision | Scope |
|---|---|---|
| O-1 | **Show only what the answer used.** A source card, its picture and the "From …" line appear only for a source the answer's words cite. Supersedes approved sheet M9 on one point: parts of a used document that the answer did NOT quote are no longer listed. | Ask Clinket, web + mobile, live + reopened |
| O-2 | **D27b reversed: a relevance floor.** Only passages actually close to the question reach the model; nothing close ⇒ an honest "not found". Measured on real documents before it ships. | Knowledge search, both the phone and Ask Clinket |
| O-3 | **Several sources that differ are all given, and the answer says they differ.** Ask Clinket: every one, as a table. Phone: says how many, reads the one the caller means, or offers to send them. Never quietly one. | Both answer surfaces |
| O-4 | **Phone service check keeps giving the caller something, worded honestly.** When nothing meets the requirement: "we don't have one that exactly meets that — the closest we have is …". A judge's "can't tell" is never "typically"; it is "the owner can confirm it suits you". | Phone expert check |
| O-5 | **Schema approval, standing for this programme** (§0.7): any field that is genuinely needed — correct, best practice, solving the real problem, production-ready. No backfill (sandbox). Includes `KnowledgeBlock.SourceImageId` (§4.X5). Every item added under it is listed in §5 with its §0.7 table. | This programme |
| O-6 | **No manual index wipe.** After the deploy, affected documents are rebuilt through the product's own "Read again". The owner deletes test data. | — |

## 1. Root cause (evidence: `live/`)

The saved conversation for "What is the week rate for rentals?" (NKN607, 2026-09-25 20:33) holds exactly what the
member was shown: 14 sources, ONE cited. Search handed the model 8 passages — rate card 5 and seven passages from a
Gujarati price list and a Hindi beauty-parlour rate card — and the services search added 6 unrelated beauty
services. The picture under the answer was the Gujarati price-list photo.

Three independent code defects combine, none of them data:

1. **Display** — every Citation and Image frame was streamed the moment a tool returned, cited or not.
2. **Search** — the business writes in three alphabets, so every question is searched three times, and the merge
   gave each alphabet's search equal seats by rank. The Gujarati and Hindi searches found nothing relevant (vector
   similarity ≤ 0.30) but still took the seats, while the English search's five rate cards (0.45–0.52) lost them.
   Replayed live: `live/rental-legs.txt`.
3. **Services** — the catalogue's "meaning match" fallback returns the nearest services with no similarity floor,
   so a salon's beauty services were returned as matches for "rentals".

## 2. Register

Status: OPEN · FIXED (built, unit + integration tested, break-it checked — §4) · VERIFIED LIVE (after the owner's
deploy and "Read again", §7).

### Display — Ask Clinket
| ID | Sev | Defect | Status |
|---|---|---|---|
| AR-D1 | High | A picture was shown for a passage the answer never cited (the E-26 photo) | FIXED |
| AR-D2 | High | Every source any tool returned was listed — 14 sources under a 1-source answer | FIXED |
| AR-D3 | Medium | "From N …" counted every returned PART, cited or not, and called parts documents | FIXED |
| AR-D4 | Medium | A reopened conversation replayed all of it (the store kept every frame) | FIXED |
| AR-D5 | Low | A number the model invented was drawn as a pill that opens nothing; a number minted for a row the payload cap dropped could still resolve | FIXED |
| AR-D6 | Low | Read links were minted for pictures nobody sees | FIXED |

### Knowledge search — phone + Ask Clinket
| ID | Sev | Defect | Status |
|---|---|---|---|
| AR-S1 | Critical | Multi-alphabet fusion by summed rank: equal seats per alphabet, a passage found by two searches outranks the best of one | FIXED |
| AR-S2 | High | No relevance floor anywhere (D27b) — nothing close still returns 8 passages | FIXED (O-2) |
| AR-S3 | Medium | Overviews are appended, and one is seated before the records, whatever their relevance | FIXED |
| AR-S4 | Medium | A short answer line inside a long mixed passage scores below the floor (Q06: the "$50 deposit" line in a 16-line card, 0.241) | FIXED — §3.11 |
| AR-S5 | Low | Hindi and Gujarati keyword search matches filler words, so those searches return noise | FIXED — §3.9 |
| AR-S6 | High | Phone: the retry without the offering filter returned material about OTHER offerings with no word that it was | FIXED |
| AR-S7 | Medium | Phone catalogue search trimmed Hindi/Gujarati vowel signs as punctuation ("क्या" → "क्य", "साड़ी" → "साड़"), so those words never matched | FIXED — §3.9 |
| AR-S8 | High | (2026-09-30, post-ranking follow-ups W3 live proof) A card FIRST by meaning never reached the fused shortlist when every picture repeated the product name — 8 of 22 Glanza/Baleno spec questions answered | FIXED — §3.2, last bullet; evidence and the measuring tool in `Data/post-ranking-followups` (PLAN §10 row "the facts W3 recovered were stored but mostly NOT FOUND") |

### Services search — phone + Ask Clinket
| ID | Sev | Defect | Status |
|---|---|---|---|
| AR-C1 | Critical | The "meaning match" fallback returns the nearest services with no floor, as "real, bookable offerings" or a phantom "too many" count | FIXED |
| AR-C2 | High | Expert check: when the judge finds no fit, the rows it rejected go back as real bookable offerings | FIXED (O-4) |
| AR-C3 | Medium | A judge's "can't tell" is spoken as "typically" | FIXED (O-4) |
| AR-C4 | Medium | The expert check's short-circuit passes fallback rows unjudged | FIXED |
| AR-C5 | High | Phone: the business's OWN groups never resolved, so the search ran over everything and read it out as that group; a group-only ask for an unknown group answered with the whole catalogue | FIXED |
| AR-C6 | Medium | Phone expert check: every passage was presented as "about these rows", the business's general material and the AI's own wording included | FIXED |

### Answer rules
| ID | Sev | Defect | Status |
|---|---|---|---|
| AR-P1 | High | No rule for several sources that differ — the answer quietly picks one | FIXED (O-3) |

### Extraction — picture ↔ words
| ID | Sev | Defect | Status |
|---|---|---|---|
| AR-X1 | High | Look-alike pictures share one description: a 9×8 gradient fingerprint cannot see a label, so NX-295 $80,750 was described as NX-290 $79,000 (verified by eye on the stored photo, both catalogues) | FIXED |
| AR-X2 | High | A picture is filed under the last heading before it: 0 of 35 catalogue photos sit under their own item. That label heads the photo in material sent to customers, reaches the phone's photo tool and the draft-photo matcher | FIXED |
| AR-X3 | High | A picture's search text carries the words BEFORE it — the previous item's name in a product grid | FIXED |
| AR-X4 | High | A deleted picture's description is indexed again by "Read again" (`BuildCards` emits a card for any saved description) | FIXED |
| AR-X5 | Medium | Text read from a picture carries no link to it: deleting the picture leaves its prices answering, and the answer cannot show the photo | FIXED (O-5) |
| AR-X6 | High | PDF figure ↔ marker binding checked only the COUNT: markers on other pages were bound by position; a saved reading was re-bound to a fresh one that found different figures | FIXED |
| AR-X7 | High | Every undescribed picture on a page was given the whole page's text — identical cards on different pictures | FIXED |
| AR-X8 | High | A replacement file carried the old file's pictures forward whenever its own reading lost one, or its picture lane failed | FIXED |
| AR-X9 | High | Deletions and unticks were matched by bytes alone: a re-read that produced the same picture as other bytes brought back a picture the provider deleted | FIXED (O-5) |
| AR-X10 | High | One photo placed under two items was described beside the FIRST item's words — first reading and "Read again" alike | FIXED |
| AR-X11 | Low | A page's words, used to name a lone picture, took only the LAST row of a table | FIXED |
| AR-X12 | Low | A text passage under a heading the layout reader made out of ANOTHER item's caption keeps that heading | FIXED — §3.10 |
| AR-X13 | Medium | A catalogue's running title, levelled H1, H2, H3 on successive pages, nested under itself, so every passage's section repeated the title | FIXED — §3.10 |

### Models (owner, 2026-09-26)
| ID | Sev | Defect | Status |
|---|---|---|---|
| AR-M1 | High | The quote-photo category check (C3) read pictures on gpt-6-luna after the rename; it was measured at 90.1% on gpt-5.6-luna and never on 6-luna | FIXED — §3.8 |
| AR-M2 | High | The rename moved search enrichment onto gpt-6-luna without a measurement; Gate 1 had kept it on mini (Recall@10 72.3% vs 67.9%) | FIXED — §3.8 |
| AR-M3 | Low | The OCR page-cache integration test still expected gpt-6-luna in the cache path after the reader switch | FIXED |
| AR-M4 | Low | gpt-5.4-mini was priced in appsettings but not in the class default, so the pricing mirror test failed | FIXED — §3.8 |

### Infrastructure
| ID | Sev | Defect | Status |
|---|---|---|---|
| AR-I1 | Medium | Every read-link mint sent a create-container request to storage (a billed write per picture shown, platform-wide) | FIXED |

## 3. Design

### 3.1 Display (AR-D1…D6) — `BusinessSearchAgent.CitedAnswerStream`
A tool's citations and picture candidates are HELD. As the answer streams, each `[n]` marker is resolved: a number
the model was handed becomes a Citation frame sent just before the words that cite it, renumbered 1, 2, 3 in reading
order; the picture that source carries is built (read links minted) and sent with it, up to `MaxImagesPerAnswer`
pictures shown, each picture once. A number the model was never handed is removed with its space. A tail that may
still become a marker ("[", "[1") is held and always written before the answer ends. The controller stores what was
sent, so a reopen matches.

Both clients apply the same rule to what they are given (`citedSources` in `askRules.js` / `askRules.ts`), so a
conversation saved before the server change also draws only what its answer cites. Cards, their grouping and every
count come from that one list; the count of documents is of distinct files. M9's "Show N more" roll-up is gone (O-1;
the M9 register row in `provider-ai-search/PLAN.md` records it).

### 3.2 Knowledge relevance (AR-S1…S3, S6) — `KnowledgeRelevanceRanker`, both surfaces
- Every vectorised search asks for `debug=vector`, so each passage comes back with its cosine to that rendering.
- A passage is kept when it reaches BOTH `RetrievalMinSimilarity` (0.25) and `RetrievalRelativeSimilarity` (0.60) ×
  the closest passage's cosine, on its best cosine over the renderings.
- One language keeps the search's own keyword-plus-meaning order. Several languages fuse closeness with each
  passage's best position (reciprocal rank), so an exact code the keywords put first is not buried.
- A keyword-only search (embedding failed) or one that reports no closeness falls back to rank fusion — never
  "nothing close" because a service was down.
- `RetrievalVectorCandidates` (50) widens k so every returned passage carries its closeness (k is at least the window).
- ‼️ AR-S8: each search returns `RetrievalVectorCandidates` rows; the first `TopK × 2` are the shortlist this
  section describes, unchanged. Then the closest passage in meaning always keeps a seat, and the next closest keeps one
  only when the shortlist never held it (`RetrievalClosestSeats` 2), after the first seat, through the floor and every
  document gate. A question naming a code keeps the order alone. 84 questions, both paths: 13 more answered, none worse.
- Overview companions are held to the main result's floor and seated after the records.
- Phone: when the retry without the offering filter is what found the material, the result says `Widened` and the
  note tells the model the material is about other offerings or the business in general.

### 3.3 Services (AR-C1…C6)
- Meaning-match fallback keeps a row only at ≥ max(`VectorRescueMinSimilarity` 0.28, `VectorRescueRelativeSimilarity`
  0.75 × closest); kept rows are `ClosestNotExact` — the nearest offerings, never a match, never a "too many" count.
- Ask Clinket's multi-language merge drops the meaning-only legs when any leg found the offering by name.
- Phone expert check: none meets the requirement ⇒ the plain rows are offered as the closest (O-4); an Unknown match
  is worded as a possibility the owner can confirm; the short-circuit never passes meaning-only rows unjudged.
- Groups: a group resolves against the business's own groups as well as the shared ones; a group-only ask for a
  group the business does not use is None with its groups listed; with words it searches everything and says so
  (`GroupIgnored` + note), on the expert path too.
- The expert check's passages say which judged rows they belong to (`rows`) and whose words they are (`kind`).

### 3.4 Answer rules (AR-P1, O-3)
Ask Clinket rule 11: several results that answer differently are all given, as a table when more than two, with
what tells them apart. Phone: says there are several and what tells them apart, then asks which one the caller means
or reads the ones that apply — never quietly one.

### 3.5 Extraction — picture ↔ words (AR-X1…X11)
- **Own words.** A picture's words are only what the source ties to it: its table cell (the row only when it is alone
  in its cell), its own paragraph, a layout figure's caption and inner text. They ride the marker
  (`KnowledgeBlock.ImageNeighbourText`); a figure ends the words before it.
- **Filed under them.** A picture's card and its registry anchor are its own words (bounded by
  `ImageGroundingMaxChars`); the heading only when it has none, or when its placements disagree. A spreadsheet's cell
  hint still comes first.
- **Descriptions.** Reused only for the same bytes beside the same words — never a look-alike. A photo placed beside
  different words is described from its pixels, on the first reading and on "Read again".
- **Words read from a picture** carry `SourceImageIndex` → the card's picture handle. They never share a passage
  with the document's own words; the picture's headings scope only them; when both say the same thing the document's
  copy is kept. Deleting the picture in the panel removes every card carrying its handle.
- **Deleted pictures** — their description and their words are never indexed again, fresh or replayed.
- **Identity across readings** (`SourceKey` = file content hash + place): deletions and unticks match by id OR the same
  spot in the same file version (0.15 in for a layout figure, 2 pt for a raster); never across versions. An entry
  whose spot a re-read refilled with other bytes is retired, even when the reading lost another picture.
- **Replacements** never carry the old file's pictures; a failed picture lane keeps only the provider's deletions.
- **Page text** names an undescribed picture only when the picture is alone on its page and its placements agree;
  tables are read from the top.
- **PDF binding** by position needs the same pages; a saved reading is re-bound only to a fresh one with the same
  figures (count, pages, places within 0.05 in).

### 3.6 Storage (AR-I1)
A read-only link never creates a container. Upload links still do.

### 3.8 Models (AR-M1…M4)
- Every call that LOOKS AT a page or picture runs on `AiModels.Reader` (gpt-5.6-luna): knowledge, profile setup, service
  drafts, and the quote-photo category check (`BroadcastClassification:VisionDeploymentName`, pinned in the API's
  `AiModelPinConventionTests`, mapped by deploy.ps1 in both regions).
- Search enrichment (B1) is back on `AiModels.Mini` = gpt-5.4-mini: `SearchIndexEnrichment:DeploymentName` in both hosts
  and the ca/in files; deploy.ps1 `$openAiEnrichmentDeploymentName` is in `$modelDeployments` (RAI filter) and sets the
  4 app settings, which override appsettings. No public evidence says 5.6-luna beats mini at this task, and our own
  112-search Gate 1 says mini is better, so the measured choice stands.
- `AIService:TokenPricing` lists gpt-5.4-mini in the class default and in all three hosts.

### 3.9 Keyword text without grammar words (AR-S5, AR-S7) — `QueryFillerWords`
Every field is analysed by `en.microsoft`, which keeps Hindi and Gujarati grammar words, so a whole-question keyword search
matched every passage on "है", "के", "છે". `QueryFillerWords` (clinqetcore) drops grammar words only — never a number or
a content word — from each rendering's KEYWORD text (`BuildSearchText`, phone and Ask Clinket alike) and from the
catalogue terms. The meaning half keeps the whole question; a question made only of such words keeps them. Query-side, so
no index rebuild. The catalogue's term trim keeps combining marks (AR-S7).

### 3.10 What a passage is filed under (AR-X12, AR-X13)
- `LayoutFigureCaptions.Attach(reading)` runs on every Document Intelligence reading before the parser (knowledge ingest, a
  photographed page, the draft re-read, the setup reader). A caption-less figure takes the paragraph directly beneath it as
  its `<figcaption>` — same page, within 3% of the page height, 80% column overlap, not page furniture, not beneath two
  figures, nothing but blank space between them in the text, and only when the line repeats a code, price or number the
  picture shows (a real heading under a banner stays a heading). Offsets use the reading's own index type.
- A heading that opens a page and repeats an open heading re-enters that section; a same-named subsection within a page
  still nests.

### 3.11 One-item-per-line text is cut small (AR-S4)
A self-contained-lines paragraph (rate card, `key: value` list) packs to `Voice:Knowledge:ChunkRecordMaxTokens` (120,
Functions only; the header each passage carries counts) instead of 512. The small ceiling only decides how many LINES share
a passage: a line is still cut only at `ChunkMaxTokens`, and such a passage is never space-joined to its neighbour by the
small-tail merge (a one-line piece no longer shows its newline). Tables and lists are unchanged — measured (§4.1).

### 3.7 Deliberately unchanged
- The phone offers a picture only from its description card (§6.12). Words read from a picture do not make the phone
  offer it; Ask Clinket shows it when the answer cites those words.
- "Read again" keeps the anchor the first reading recorded (C9).

## 4. Evidence and tests

### 4.1 Measured before shipping (O-2) — `eval/`
38 live NKN607 questions (English, Hindi, Gujarati), `debug=vector` on the live index:

| | Before | After |
|---|---|---|
| One language — right passages seated | 94 / 103 | 94 / 103 |
| One language — unrelated passages seated | 155 | 98 |
| One language — honest "not found" where nothing matches | — | 2 / 3 |
| Three languages — right passages seated | 74 / 142 | 115 / 142 |
| Three languages — unrelated passages seated | 221 | 140 |
| Three languages — first result right | 15 / 35 | 31 / 35 |

Losses: Q06 (AR-S4, fixed since — below) and one NX-195 card on Q38. Catalogue fallback (`eval/catalog-rescue.json`): real paraphrases
0.287–0.625, unrelated asks 0.106–0.224; grey cases tattoo 0.314, dog grooming 0.406.

**AR-S5 (2026-09-26)** — same 38 questions, live legs, production floor, grammar words removed vs kept: right passages
114 / 141 both, unrelated seated 143 both, first result right 30 → 31 / 35, and Q37 gained a right passage.

**AR-X12 (2026-09-26)** — the equipment catalogue's saved Document Intelligence reading, before → after: pictures named by
their own words 31 → 40 of 40; text passages filed under another item's name 10 → 0.

**AR-S4 (2026-09-26)** — NKN607's 19 saved parses re-cut by the real chunker per variant, embedded, searched by one
emulation of the production hybrid query and scored with the production floor on the 38 questions:

| Variant | Passages | Facts found | First right | Unrelated seated |
|---|---|---|---|---|
| Today (512) | 276 | 62 / 116 | 30 / 35 | 139 |
| **Lines 120 (shipped)** | 277 | **63 / 116** (Q06 answered) | **31 / 35** | 142 |
| Lines 80 | 278 | 63 / 116 | 31 / 35 | 142 |
| Lines 50 | 291 | 65 / 116 | 31 / 35 | 145 (Q36 lost a fact) |
| Lines 25 | 419 | 67 / 112 | 30 / 35 | 156 |
| Lines + lists, 80 or 50 | same as lines | same | same | same |
| Lines + lists + tables 80 | 433 | 63 / 116 | 31 / 35 | 146 |
| Everything 50 | 938 | 53 / 108 | 29 / 35 | 150 |

At 120 exactly one passage changed: the ProFix rate card became two, and "Deposit $50" sits in the four-line one. The three
extra "unrelated" seats are that same rate-card text counted as two pieces on the weekly-rate questions; no fact was lost.

### 4.2 Test suites (isolated copy; other sessions' unfinished payments work held at its committed version)
Closing run 2026-09-26, after every break-it switch was removed (0 left) and with AR-S4, AR-S5, AR-X12, AR-X13 and the
model moves in:

| Suite | Result |
|---|---|
| Functions unit | 6,723 / 6,723 |
| Functions integration — knowledge + storage (Cosmos emulator + Azurite) | 80 / 80 (the OCR page-cache test included — AR-M3) |
| API unit | 13,996 passed, 42 skipped (peer-absent guards), 1 failed — NOT this programme: `MinuteLedgerServiceTests.CarryTrialForward_CarriesWhatIsLeft_MonthByMonth_Once` (carry-over key `…_trial` vs `…_included`), the payments session's work in progress |
| API integration — Business Search + Knowledge (SQL + Cosmos) | 274 passed, 2 skipped (`SearchIndexSchemaParityIntegrationTests`, which need the live search service) |
| MCP unit | 1,222 / 1,222 |
| MCP integration | 110 / 110 |
| Partner web — Business Search (Jest) | 22 suites, 379 / 379 |
| Partner mobile — Business Search (Jest) | 23 suites, 486 / 486 |
| AI token pricing mirror (API, Functions, MCP) | green in all three after AR-M4 |

One pre-existing integration test encoded the OLD rule — `AnImageRefOnANonCaptionCard_IsIgnored` ("a picture handle on a text card is stale data"). AR-X5 reversed that on purpose, so it now asserts the new rule (`AnImageRefOnWordsReadFromAPicture_IsCarried`). Isolation is unchanged: Ask Clinket builds a picture only from the card's OWN document, never a deleted one, never outside that document's picture folder (`SearchKnowledgeTool.BuildImageAsync`).

### 4.3 Break-it checks — each fix removed on purpose, its test must go red, and green again when restored
Display and search: 7 / 7 red (earlier in the session). Extraction, phone, Ask Clinket and storage: every fix below sits
behind a switch in the isolated copy (one build), run alone, then the same test with no switch.

| # | Fix switched off | Test that went red |
|---|---|---|
| F1 | O3 — one photo under two items keeps the first item's words | `OnePictureUnderTwoItems_IsDescribedFromItsPixels_NeverWithOneItemsWords` |
| F2 | O3 on "Read again" | `ContentArtifact_OnePictureUnderTwoItems_IsDescribedFromItsPixels` |
| F3 | AR-X2 — the card filed under the heading | `APicture_IsFiledUnderItsOwnWords_AndUnderTheHeadingOnlyWhenItHasNone` |
| F4 | AR-X2 — the anchor from the heading | `APicturesAnchor_IsItsOwnWords_AndTheHeadingOnlyWhenItHasNone` |
| F5 | AR-X4 — a card for a picture the run does not keep | `ADescriptionOfAPictureThisRunDoesNotKeep_NeverBecomesACard`, the replay test (2 red) |
| F6 | AR-X5 — a deleted picture's words return | `WordsReadFromADeletedPicture_NeverReturn_AndALivePicturesCarryIt`, the replay test (2 red) |
| F7 | AR-X5 — words lose the picture's handle | `ContentArtifact_Replay_TheWordsReadFromALivePicture_CarryIt` (the other test covers the splice) |
| F8 | AR-X8 — a replacement that lost a picture carries the old album | `AReplacementThatLostAPicture_RetiresTheOldFilesPictures` |
| F9 | AR-X8 — a failed lane keeps the old album | `AReplacementWhosePictureLaneFailed_KeepsOnlyTheProvidersDeletions` |
| F10 | AR-X9 — a refilled spot's old entry kept | `ARereadThatLostAPicture_StillRetiresTheEntryItsSamePictureReplaced` |
| F11 | AR-X7 — page text without the alone test | `TwoUndescribedPicturesOnOnePage_AreNeverNamedByThePagesText` |
| F12 | AR-X11 — a table's last row only | `ALonePictureNamedByItsPage_ReadsTheTableFromTheTop` |
| F13 | AR-X6 — a saved reading re-bound to different figures | `ABankedReadIsNeverReboundToAFreshReadThatFoundDifferentFigures` |
| F14 | AR-X9 — first reading: deletions by bytes only | `APictureTheProviderDeleted_StaysDeleted_WhenAReadingProducesItAsOtherBytes` |
| F15 | AR-X9 — the registry merge by id only | `MergeRegistry_ThePicturesPlace_KeepsTheProvidersDeletionAndTick`; real Cosmos: `APicturesPlace_RoundTripsThroughRealCosmos_AndHoldsTheProvidersChoicesAgainstOtherBytes` |
| F16 | AR-X9 — a place matched across file versions | `TheSameSpotInAnotherVersionOfTheFile_IsNeverTheSamePicture`; `ADeletionFromAnotherVersionOfTheFile_NeverMatchesByPlace` |
| F17 | AR-X6 — position binding across pages | `MarkersOnOtherPagesThanTheirFigures_AreNeverBoundByPosition` |
| F18 | AR-X5 — a picture's words share passages | `PictureText_NeverSharesAPassage_WithTheDocumentsOwnWords`, `APicturesHeadings_ScopeOnlyItsOwnWords` |
| F19 | AR-X5 — the picture's copy kept over the document's | `TheDocumentsOwnCopy_OutlivesAPicturesCopy` |
| F20 | AR-X3 — a figure queued behind the open paragraph | `LayoutMarkdown_AFiguresOwnWords_RideItsMarker_AndNeverJoinTheNextItem` |
| F21 | AR-X3 — a grid picture takes the row's words | `ARX3_APictureInAGridCell_CarriesItsOwnCellsWords_NeverItsNeighbours` |
| F22 | AR-X3 — a picture borrows the heading | `TheDescriberIsHandedOnlyThePicturesOwnWords` |
| F23 | AR-X1 — a description reused across different pictures | `LookAlikePictures_UnderTheSameWords_AreEachDescribed` |
| F24 | AR-X9 — "Read again": deletions by bytes only | `ContentArtifact_ReplayKeepsADeletionMadeOnTheSamePictureAsOtherBytes` |
| I1 | AR-I1 — a read link creates the container (Azurite) | `AReadLink_NeverCreatesAContainer_ButAnUploadLinkStillDoes` |
| M1 | AR-S6 — the widened retry unmarked | `ANarrowedSearchThatFindsNothing_AsksAgainWithoutTheNarrowing` |
| M2 | AR-C5 — the business's own groups never resolve | `ABusinessesOwnGroup_Resolves` |
| M3 | AR-C5 — a group-only unknown group reads the catalogue | `AGroupOnlyAskForAnUnknownGroup_IsNone_NeverTheWholeCatalogue` |
| M4 | AR-C5 — the "searched everything" note dropped | `AnUnknownGroupWithWords_SearchesEverything_AndSaysSo` |
| M5 | AR-C5 — the expert path loses the flag | `AnUnknownGroup_IsCarriedToTheModel_OnTheExpertPath` |
| M6 | AR-C6 — passage labels dropped | `KnowledgePassages_SayWhichRowsTheyBelongTo_AndWhoseWordsTheyAre` |
| A1 | AR-X5 — Ask Clinket: words lose the picture | `WordsReadFromAPicture_CarryIt` |
| — | AR-X7 — a picture repeated on another page not counted there | `APictureRepeatedOnAnotherPage_MeansTheOtherPictureThereIsNotAlone` — red against the code before that fix |
| X1 | AR-X12 — the caption not moved | `LayoutFigureCaptionsTests` (5 red) |
| X2 | AR-X12 — a line that repeats nothing the picture shows | `AHeadingThatNamesNothingThePictureShows_StaysAHeading` |
| X3 | AR-X12 — a line beneath two pictures | `ALineBeneathTwoPictures_NamesNeither` |
| X4 | AR-X12 — page furniture | `APageFooter_IsNeverACaption` |
| X5 | AR-X12 — offsets not by the reading's index type | `AGujaratiCaption_MovesByGraphemeOffsets`; real storage: `TheWholeFileRead_KeepsItsLayoutEvidence` |
| X6 | AR-X12 — text order ignored | `ALineTheReadingPutsElsewhere_IsLeftWhereItIs` |
| X7, X8 | AR-X12 — the gap / the column | `ALineNotDirectlyUnderThePicture_IsLeftWhereItIs` |
| X9 | AR-X12 — a picture that already has a caption | `APictureTheReaderAlreadyCaptioned_KeepsItsOwnCaption` |
| X10–X13 | AR-X12 — each hand-over: ingest, photographed page, draft re-read, setup reader | `ACaptionTheLayoutReaderMadeAHeading_ReachesTheReaderInsideItsPicture_AndFilesNothingUnderIt`, `APhotographedPagesMisplacedCaption_ReachesTheReaderInsideItsPicture`, `NoArtefact_ForAPdf_HandsTheReaderEachMisplacedCaptionInsideItsPicture`, API `ReadAsync_Pdf_HandsTheReaderEachMisplacedCaptionInsideItsPicture` |
| T1–T3 | AR-X13 — the running title nests / a real subsection stops nesting | `ARunningTitleLevelledDifferentlyOnEachPage_NeverNestsUnderItself`, `ASubsectionNamedLikeItsParent_WithinAPage_StillNests` |
| W1, W4 | AR-S5 — the word list / a question made only of grammar words | `QueryFillerWordsTests` |
| W2 | AR-S5 — catalogue terms keep grammar words | `AHindiAsk_SearchesTheServiceWords_NotTheGrammar` — NOT caught at first; the test now asserts the exact search sent, and goes red |
| W3 | AR-S5 — the knowledge keyword text keeps them | MCP `EachRendering_IssuesItsOwnSearch_WithItsOwnWords_WithoutItsGrammarWords`, API `TheHindiAndGujaratiSearches_SendTheirMeaningWords_NotTheirGrammar` |
| V1 | AR-S7 — vowel signs trimmed | `AWordEndingInAVowelSign_IsSearchedWhole` |
| S1 | AR-S4 — packed to the card ceiling | `ALongRateCard_IsCutIntoShortPassages_OfWholeLines_InOrder`, `TheDepositLine_NoLongerSharesItsPassageWithTheWholeCard`; real Cosmos + Azurite: `KnowledgeIngestRecordLinesIntegrationTests` |
| S2 | AR-S4 — a line cut at the record ceiling | `ALineLongerThanTheRecordCeiling_IsKeptWhole_AndStandsAlone` |
| S3 | AR-S4 — a record ceiling above the card ceiling | `ARecordCeilingAboveTheCardCeiling_PacksToTheCardCeiling` |
| S4 | AR-S4 — record passages space-joined by the small-tail merge | `ALineLongerThanTheRecordCeiling_IsKeptWhole_AndStandsAlone` |
| S5 | AR-S4 — the ingest ignores `ChunkRecordMaxTokens` | `ARateCardsDepositLine_IsIndexedInAShortPassage`; integration at 60 |
| — | AR-M4 — the price missing from the class default | `TokenPricing_InAppSettings_MirrorsTheClassDefaults_BothWays` — red as the owner reported, green in all three hosts after |

## 5. Schema and contract items added under O-5

No SQL change. No search-index field change: `imageRef` already existed; it is now also stamped on the text of a
picture it was read from.

### 5.1 Cosmos — `KnowledgeDocument.images[].sourceKey` (string, optional)
| | |
|---|---|
| **What** | `KnowledgeDocumentImage.SourceKey`, JSON `sourceKey`, `NullValueHandling.Ignore` |
| **Who reads it** | `KnowledgeIngestProcessorFunction` (fresh-lane and replay tombstone match, `Previous`, the commit's retirement of a refilled spot), `KnowledgeImageStore.MergeRegistry` |
| **Who writes it** | `KnowledgeIngestProcessorFunction` — every picture entry a reading stores, and the replay registry from the saved pointer |
| **Why not a column** | It is one fact about one picture entry — a field on the existing nested entry |
| **Why not a constant/enum** | Per picture: the file version's hash and the picture's place |
| **Why not already stored** | `imageId`/`contentHash` are the bytes — they change when the same picture is rendered again; `page` + `anchorPath` do not identify one of several pictures on a page |
| **Cost** | ≈ 90 bytes per picture entry on a row already rewritten each reading; no RU change beyond that; the KnowledgeBase container excludes `/*`, so no index growth |
| **What breaks if omitted** | A picture the provider deleted or unticked comes back, described and sendable, when a reading produces it as other bytes |

### 5.2 Saved reading (blob artefact) and in-memory models
| Item | Reads | Writes | Why |
|---|---|---|---|
| `KnowledgeArtifactImage.SourceKey` | replay tombstone match, replay registry | fresh lane pointer | "Read again" must match deletions exactly as the first reading did |
| `KnowledgeBlock.SourceImageIndex` (O-5's "SourceImageId") | `KnowledgeChunker` (boundary, headings, dedupe), `BuildCards` (skip deleted, stamp handle) | the picture-text splice | A picture's id exists only after its bytes are hashed; the index is known at splice time and resolves to the live handle when cards are built |
| `KnowledgeChunk.SourceImageIndex`, `KnowledgeChunk.ImageNeighbourText` | `BuildCards` | `KnowledgeChunker` | carry the block's facts to the card builder |
| `KnowledgeExtractedImage.Locator` | the lane's `SourceKey` | `KnowledgeImageExtractor` (figure box, raster box) | the picture's place in the file |

### 5.3 Wire (model-facing tool results) and settings
- `KnowledgeSearchResult.Widened`; `CatalogLookupResult.ClosestNotExact`; `CatalogAnswerResult.ClosestNotExact`,
  `CatalogAnswerResult.GroupIgnored` — absent from the wire when false.
- `Voice:Knowledge`: `RetrievalMinSimilarity` 0.25, `RetrievalRelativeSimilarity` 0.60, `RetrievalVectorCandidates` 50.
  `Voice:Catalog`: `VectorRescueMinSimilarity` 0.28, `VectorRescueRelativeSimilarity` 0.75. `BusinessSearch` rule 11.

## 6. Open — not fixed, with the recommendation

Nothing is open. AR-S4, AR-S5 and AR-X12 were closed on 2026-09-26 (owner: fix them if there is a better way). Their
earlier entries, kept for the record:

| ID | Evidence | Why not fixed here | Recommended next step |
|---|---|---|---|
| AR-S4 | Q06: ProFix's "$50 deposit" is one line of a 16-line card; cosine 0.241 < floor 0.25. One-language right passages are unchanged overall (94/103 before and after), so this is an existing recall limit the floor makes visible | Any rule that keeps it (lower floor, keyword exemption) re-admits the unrelated passages this programme removed; the root is passage size | Measure smaller, topical passages for list-like documents on the same 38 questions before changing the chunker |
| AR-S5 | Hindi/Gujarati keyword search matches filler words (e.g. "છે", "है"), so those searches return noise | The floor removes it from answers already; the root fix is an analyzer change on the index (a rebuild) | Stop-word handling for Indic fields, measured on the same set, as its own change |
| AR-X12 | A text passage whose heading the layout reader made from the previous item's caption keeps that heading | Each passage names its own item and price, so the harm is bounded; demoting headings needs a rule that cannot misfire on real headings | Revisit with more layouts |

## 7. After the owner's deploy

1. Run deploy.ps1 (it creates the gpt-5.4-mini deployment and sets the enrichment and quote-photo model app settings),
   then deploy API, MCP, Functions, the partner web app and the partner mobile app.
2. "Read again" every NKN607 document. The reading pipeline and the passage cutting changed, so "Read again" reads each
   file afresh; the search changes (grammar words, the floor) need no re-reading.
3. Then, live: the rental question shows only its cited rate cards and no unrelated photo; the NX-135 photo is
   anchored and described as the NX-135; the phone's service check and catalogue answers are worded as §3.3.
4. Transition, no backfill (O-5): a picture deleted BEFORE this deploy has no recorded place, so if "Read again"
   produces it as other bytes it can return once. Deleting it again records its place, and it stays deleted.
