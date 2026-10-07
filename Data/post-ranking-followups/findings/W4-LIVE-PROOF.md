# W4 — pictures beyond 40: live proof (India sandbox, business 6TCWOI)

The NEW code, never deployed: the worktree Functions composition (`W:\clinqetfuncations`) driven in-process by the scratch
harness `proof/live` (real Cosmos, Blob, Document Intelligence, reading model `gpt-5.6-luna` — the production reader), against
the India sandbox. Nothing reached the deployed Functions app.

## MG Windsor EV brochure (46 pages, 20 read in sections for their fine print)

| Reading | Build | Pictures in the album | What was wrong |
|---|---|---|---|
| Before W4 (album `mgwindsor-before.tsv`) | master | 98 (40 cap) | — |
| First W4 reading | W4 as first built | **208** | every clipped placement drawn as its own picture — slices of one photo, near-black strips (reversed: `d6127b2`) |
| Re-read | own bytes restored | **213** | 75 stale slices carried back with no card — one icon under the floor kept every earlier picture (retirement fixed: `6f299ae`) |
| Re-read | retirement fixed | **136** (60 file pictures + 76 crops) | 22 feature icons of pp. 27/29 stored at 2,048 px: a figure cut from a sectioned page was fitted to 2,048 px whatever its size |
| Re-read | crops drawn at 150 dpi (`c03e921`) | 136 shown, **113 chosen** | the reading chose 113, but the 22 stretched icons were carried back: the floor's spot rule protected any earlier copy of a spot it now withheld |
| Re-read | floor spot rule narrowed (`0500ae2`, `784050d`) | **113** (60 + 53) | album = exactly what the reading chose. **But page 39's car photo is gone** (see below) |

### Pictures on sectioned pages — the car of page 39

Page 39 (A4, the price list with a full-width photo of the car below it) is read in two sections for its 4–6 pt fine print.
The planner cut straight after the price table, so the car sits whole in the lower section — which is then almost all car,
and a section's machine reading does not report a picture that fills its image (it takes it for the picture itself): it
reported one wheel. Before W3 the whole-page reading stored the car as a 1,227 × 740 crop.

Survey of every sectioned page of the India corpus from the saved readings (tool `proof/bughunt`, no paid call): 46 pages;
93 whole-view figures matched a section figure; **8** section figures were fragments inside a larger whole-view figure;
**20** whole-view figures had no section figure at all (several of them large photos with no picture of the file's own
behind them — Baleno pp. 5 and 8, Hilux pp. 5 and 17, MG Windsor pp. 29 and 39); 27 section figures had no whole-view
counterpart (kept as they are).

Fix (PLAN §10 "pictures a section cannot see"): the page's planning readings complete what the sections found — a lone
fragment grows to its picture, a picture no section touched is added with its marker after the text above it.
Unit tests (reader, rule, caption pass) + 12 sabotages. Live result: see the next re-read below.

### Re-read with the fix (2026-09-30, `mgwindsor-read6.log`, album `mgwindsor-album6.tsv`)

| | Result |
|---|---|
| Pictures in the album | **115** = the 113 chosen before + the two pictures no section saw |
| Page 39's car | **back**: a 1,224 × 722 crop of the page, described as "Side-view promotional image of a dark blue multi-purpose vehicle…" |
| Time | 578 s over 3 deliveries (281 + 132 + 165); 2 new descriptions, the rest replayed from the bank |

## Pictures beyond 40 — the measured set (`photos-12/40/108/320.html`, production reader `gpt-5.6-luna`)

| File | Pictures kept | Deliveries | Elapsed | Description calls | Picture-text reads | Model cost |
|---|---|---|---|---|---|---|
| 12 photos | 12 | 1 | 56 s | 12 | 0 | $0.0033 |
| 40 photos | 40 | 1 | 171 s | 28 | 3 (+1 check) | $0.0283 |
| 108 photos | 108 | 3 | 407 s | 68 | 3 (+1 check) | $0.0525 |
| 320 photos | **300** (the ceiling) — the provider was told: `Info_KnowledgePicturesOverLimit` [320, 300] | 8 | 1,496 s | 204 | 0 | $0.0547 |

- **Per 100 described pictures:** ≈ $0.027 and ≈ 210 s of model time (204 calls, 430 s in calls). Each delivery stayed
  well inside its 30-minute limit; the longest was 309 s.
- Every file reached Ready with no failed call. The chain carried on exactly one pass per 40 pictures (`PicturesPerPass`).
- Fewer description calls than pictures: a picture this business already had described — the same bytes beside the
  same words (`BuildBusinessImageMapAsync`) — is reused, never paid twice.

## Re-reads on the audited build (2026-10-01, `mgwindsor-read7/8/9.log`, albums 7 and 9)

| Read | What it paid for | Result |
|---|---|---|
| 7 — audited build | every page and section transcribed again: the sandbox's reading model is now `gpt-6-luna` (read 6 used `gpt-5-6-luna`; the bank names the model). 0 picture descriptions — all 114 replayed from the picture bank across builds (B-M1) | Ready, 114 pictures, 357 passages, 632 s |
| 8 — rebuilt | every page again (a new build: the page bank keys on the build by design, P4-I-10) | Ready, 416 s |
| 9 — same build | nothing | Ready, **31 s** — every page replayed |

**One picture fewer than read 6:** a 665 × 396 crop of page 29's language-menu screen. Page 29's sections and their
machine readings are byte-identical before and after (same geometry keys, region readings from 2026-09-30), so no code
change reached it. The new model reads page 29 without that figure. The same screen stays in the album as the
869 × 380 native photo, and the receptionist still finds the infotainment pictures.

**"Show me" (receptionist and Ask Clinket, `ask-showme.log`):**
- "Show me the MG Windsor car" → the car pictures (front, rear, interior).
- "What is the battery range" → "449 km in a single charge" from pages 3 and 18.
- "Show me the infotainment screen language menu" → the infotainment passages and the voice-language pictures.

Evidence (logs, albums, "show me" answers): `findings/w4live-evidence/`.
