# Knowledge reading accuracy — PLAN (2026-10-02)

> **Status (2026-10-02): APPROVED by the owner and BEING BUILT** — see §1B for the decisions and `BUILD-STATE.md` for
> the work register. Option D-b ("Tell our team") was REJECTED by the owner on 2026-10-02 and its sheet deleted (§0A);
> its replacement requirement is in `NEXT-SESSION-PROMPT.md` §6. The remaining build continues in a NEW session from that file.
> Evidence: `evidence\` beside this file (replay tool, scan tool, the alert texts, the replayed markdown).

---

## 0. The short version

The owner uploaded four insurance quotes to business `NKN607` (Canada sandbox). I compared every priced row of
the four originals (`Data\sample\`) with what was saved for search, Ask Clinket and the receptionist.

| File | Prices on the page | Saved correctly | What went wrong |
|---|---|---|---|
| **company1_home_quote.pdf** (Able, 5 pages) | 43 | **0** | ‼️ **Pages 1–3 are gone** — every premium, the $2,009.88 total, both coverage tables. The row says *Ready*. No notice. **No admin alert.** |
| company1_auto_quote.pdf (Able, 2 pages) | 51 | all values | ‼️ Page 2 labels shifted one column: the card says *Bodily Injury — Principal: $1,000,000 — TOTALS: $352* (truth: limit $1,000,000, premium $352). |
| company2_auto_quote.pdf (Definity, 2 pages) | 18 | all values | Page 1 fell back to the weaker reading: scrambled rate groups, one message copied 6×, the quote link has a wrong letter (`F8S` → `F85`), 9 junk summary cards. |
| company2_home_quote.pdf (Chase, 8 pages) | 65 | 64 | One invented value (`Deductible — Inc.` where the page is blank); the primary dwelling's premiums filed under "Secondary Dwelling"; raw markup (`<br><i>`) in 16 cards; form fields paired wrong (`Kathiria: Middle Name`). |

**The same "pages disappear" bug was found in India too:** *MG Windsor EV – Brochure* (`6TCWOI`), page 36 — the whole
variant price table (₹9,99,000 … ₹13,99,999 and the ₹3.99 / ₹4.50 per-km battery rental) is not saved.
Blast radius measured by a scan of every Ready document in both regions: **2 of 31** documents with page readings
lost content, and **both times what vanished was the prices**.

No limit was reached. The 26 admin alerts are all source-check alerts; none of them is about the lost pages.

---

## 0A. Mockup register (CLAUDE.md §0.20)

| Sheet | Path | Status | Governs | Supersedes |
|---|---|---|---|---|
| knowledge-document-row-truth | `Data/mockups/knowledge-document-row-truth/` | Approved 2026-09-12 (earlier programme) | The document row | — |
| knowledge-reading-progress | `Data/mockups/knowledge-reading-progress/` | Approved 2026-09-29 (earlier programme) | Reading progress on the row | — |
| *(owner change, 2026-10-02 — no sheet)* | — | **Owner approved in conversation** | The moving bar under "Reading" is removed, web + phone | **Supersedes BOTH sheets above on the moving bar only**; every other point of both stands |
| knowledge-tell-our-team | ~~`Data/mockups/knowledge-tell-our-team/index.html`~~ (deleted) | ‼️ **REJECTED by the owner 2026-10-02 and DELETED; never approved, nothing built** | Was option D-b: "Something wrong in this file? Tell our team" inside the file menu | Replaced by the requirement in `NEXT-SESSION-PROMPT.md` §6, which needs a NEW sheet |
| knowledge-wrong-answers-report | `Data/mockups/knowledge-wrong-answers-report/index.html` | ✅ **OWNER APPROVED 2026-10-03** in conversation, wording **W1**: "Report wrong answers" → "Reported. We'll check this file." (W2/W3 not taken) | The visible one-tap "Report wrong answers" error report on every Ready file, web + phone, every state, the admin alert, the server rules | Nothing; it is the requirement of NEXT-SESSION-PROMPT §6 that replaced the rejected knowledge-tell-our-team. **The sheet itself is superseded in part by owner rulings 2026-10-03:** NOTHING stored, no "already reported" state, every tap is its own alert bounded per member per hour (`Voice:Knowledge:WrongAnswerReportsPerMemberPerHour`, 10), §07's per-day rule dropped; focus ring navy `#032858` (brand mandate, green ring superseded); sending spinner in each app's own tone |
| ai-setup-reading-honesty | `Data/mockups/ai-setup-reading-honesty/index.html` | ✅ **OWNER APPROVED 2026-10-03** in conversation (the PLAN-D §5 "Setup complete" rows); sheet drawn 2026-10-03 for the record | The seven new cards on the AI Quick Setup "Setup complete" screen, web + phone, every state: prices not added because the reading did not finish, prices without a name, lines not added as services, saved prices kept, prices worth a look, part of the file not read, very long pages; the copy keys and where each word comes from | Nothing; adds cards after today's "needs a price", "needs a category" and "offers skipped" cards, which are unchanged |

## 1. What happened, in plain words

### 1.1 The pages that disappeared (the critical one)
Each page is read twice — once by the layout reader ("machine reading") and once by the AI reader. Both readings of
company1_home pages 1–3 were **perfect** (every premium, every row). The loss happens in our own code, afterwards,
when the page readings are glued into one document:

1. The Able logo (with the words "ABLE / INSURANCE") sits at the top of page 1 **and** page 4. We write it back as
   `<figure>A / ABLE / INSURANCE</figure>` — the closing mark on the same line as the last word.
2. A cleanup step removes text that repeats at the top of several pages (running headers). It saw "INSURANCE" at the
   top of pages 1 and 4, kept the first copy as "repeated header" and **deleted the second** — closing mark included.
3. The line reader handles "repeated header" lines **before** it checks for the closing mark, so the page-1 logo never
   closes. Everything after it (pages 1–3) is collected as "the logo's words".
4. When page 4's logo opens, the reader **throws the collected words away** (`figureWords.Clear()`).

Proven, not guessed: a replay of the exact production code on the real saved readings
(`evidence\tools\replay-at-discovery\`) reproduces the saved document byte for byte (same 6,568-character page-4 paragraph) and
reports **43 of 43 amounts missing**. With only the closing mark moved onto its own line, the same readings give
**0 missing**. MG Windsor: same steps with the repeated "Battery-as-a-Service" banner on pages 35 and 36.

Code: `KnowledgeDocumentParser.cs` (`StripRepeatedPageLines` ~L248, the line loop ~L549-614, `CloseFigure`),
`PageMarkdownSplicer.CarryFigures`. The same parser also serves **AI quick setup from a document**
(`ProviderSetupDocumentReader`, API) and **draft services** (`KnowledgeServiceDraftAnalyticsJob`) — so a lost price
list also means no suggested services and a wrong setup.

### 1.2 Why nothing told anyone
- The check that would have caught it does not exist: nothing compares "what the pages say" with "what we saved".
- The 26 admin alerts were all about small disagreements between the two readings (a label, a line break). The loss
  of 43 prices produced **zero** alerts.

### 1.3 The wrong values (the reading rules)
In `VisionDocumentTranscriptionService.cs`, when the two readings disagree a third, stronger AI looks again:
- **Side labels force the weaker reading.** These quotes print vertical tabs ("Totals", "Breakdown", "Rates") at the
  left of each box. The machine reading treats the tab as a table column; the AI reading rightly leaves it out. The
  rule "the confirmed reading has more cells than this table's row" (`Correct()` ~L1276-1298) then throws away the
  **whole AI page** and keeps the machine reading — which brought the scrambled labels, the copied message, the wrong
  link letter and the wrong section titles (company2_auto p1, company2_home p6).
- **A guess that matches neither reading is used anyway** (`UncertainThirdReadingUsed`): on company1_auto the third
  reading read the header one cell to the left, and every price on the page got the wrong label.
- **An empty cell gets an invented value** (`Unsettled()` ~L1244-1248): the machine cell is blank, the AI wrote
  `Inc.`, the page does not print it — and the AI's value is kept.
- **An added number is called "layout"**: company2_auto p2 `Property Damage — PRIN.: 0` (blank on the page) was
  classed *LayoutDifferenceKept* instead of a content change.

### 1.4 The provider notice "Some numbers in this file couldn't be confirmed"
- It appears when **any** disagreement stays unsettled — a label, a paragraph, a table shape — not only numbers
  (`KnowledgeIngestProcessorFunction.cs` ~L1275). In all four files the trigger was a label or a paragraph, so the
  sentence was untrue for at least three of them.
- The provider cannot act on it: they cannot see or edit what we saved. "Check against your original" has no button.
- The one real disaster (43 lost prices) showed **nothing**.

### 1.5 Other things found on the way
| # | Problem | Where |
|---|---|---|
| O-1 | **Admin alert details show `[]`** instead of values, for every alert type with nested details (also breaks the Search Operations deep link on admin web and admin mobile). Stored correctly; broken when the API sends it (Newtonsoft values written by System.Text.Json). | `Clinqet.API` `Program.cs` JSON options, `AdminAlertController.ToDto` |
| O-2 | 30 junk summary cards (`Insured Information — Female: Gender (1), Date Hired (1)`) built from forms and short totals tables. They **outrank the real coverage table** in search ("bodily injury premium" → junk first) and use the business's searchable space. | `KnowledgeInventoryBuilder` (D11b aggregates) |
| O-3 | Raw markup (`<br><i>…</i>`, `<em>`, `<sub>`) left inside table cards (16 cards). | pipe-table reader in `KnowledgeDocumentParser` |
| O-4 | "Value above its label" forms (Policy Information) turned into tables that pair values with values (`Kathiria: Middle Name`, `2 Scarletwood St: Last Name`). | pipe-table header rule |
| O-5 | A message spanning several columns is copied once per column (company2_auto MSG text 6×). | layout-table reader (colspan) |
| O-6 | Machine-reading letter errors on born-digital PDFs (`F8S`→`F85`, `oSVl`→`oSVI` in quote links) when a page keeps the machine reading, although the PDF's own text layer has the exact letters. | vision page fallback |
| O-7 | "No services to suggest … **callers can still be told** about anything in this file" shown on files marked **Not for callers**. | web `knowledge.drafts.row.noneAllAside`, mobile `DRAFTS_ROW_NONE_ALL_ASIDE_*` |
| O-8 | "Change that under AI receptionist" shown where it cannot be changed (platform switch off; no receptionist). | web `knowledge.images.notSendable`, mobile `IMAGES_NOT_SENDABLE` |
| O-9 | The notice's ✕ and "Read again" are shown to team members without permission (server refuses them). | web `KnowledgePage.jsx` ~L272-294, mobile `index.tsx` ~L1741-1762 |
| O-10 | Unrelated, for awareness: 21:13 UTC alert "SQL rejected our credentials: identity-dev" — a deployed host still uses the old database name until the rename is deployed. | deploy |

### 1.6 The two screen issues
- **The moving bar under "Reading"** — `ReadingTrack` (web `KnowledgePage.jsx` L169-184 / L529-531; mobile
  `ReadingMotion.tsx` L61-88, `index.tsx` L1679-1681). Decorative only (hidden from screen readers); the pill and the
  "12 of 46 pages" count already say everything. It was an owner change of 2026-09-12 (sheet
  `knowledge-document-row-truth`) and also drawn on `knowledge-reading-progress` (approved 2026-09-29), so removing it
  **supersedes both sheets on that point** — two register rows.
- **Delete in the picture viewer does nothing** — web: the viewer (yet-another-react-lightbox) sits on its own top
  layer and makes the rest of the page unclickable; the "Delete this picture?" box is drawn on the page underneath,
  so it can never be seen or pressed (raising its z-index cannot fix it). After the viewer closes, the forgotten box
  pops up. **iOS: the same box is a second window beside the viewer, which iOS refuses to show.** Android works.
  Also: error toasts are invisible while the viewer is open on mobile.

---

## 1A. THE SOLUTION, in plain words (PENDING owner approval — my recommendation)

**Why it went wrong, in one sentence:** we trust each step to be right and never check the RESULT — so when a step
breaks (the page glue lost 43 prices; a rule moved labels; a rule kept an invented value), nothing notices.

**The fix is two layers, for every document, every language, every consumer (knowledge, AI setup, draft services):**

**Layer 1 — four guarantees checked on EVERY reading before it goes live** (pure code, no AI cost):
| # | Guarantee | Would have caught |
|---|---|---|
| G1 | **Nothing lost** — every number and word in the page readings is in what we save | the 43 Able prices; the MG Windsor price table |
| G2 | **Nothing invented** — every number we save is printed on the page (the PDF's own text when it has one, otherwise both readings agree) | `Inc.` in a blank cell; the `0` in a blank cell |
| G3 | **Nothing moved** — every number keeps the row and column label it has on the page | "Principal: $1,000,000" (really the limit) |
| G4 | **Nothing garbled** — no markup, no copied cells, no summary card that adds nothing | `<br><i>`, a message copied 6×, 30 junk summary cards |

When a guarantee fails: repair it automatically from the reading we already have (the other reading of that page);
if it still fails, publish only what is correct, and raise **one** admin alert naming the exact values and pages, and
tell the provider one true sentence. Never "Ready" with silent loss again.

**Layer 2 — fix every root cause found** (sections A–C below, plus whatever the five audits running now add).

**How we know it works for documents nobody has uploaded yet:**
1. **A test bench of document SHAPES** (not these four files): a logo/letterhead on every page, side labels, value-
   over-label forms, multi-row and blank-cell headers, merged cells, two-column text, tables across pages, scans,
   non-Latin scripts. Each shape has its known correct answer; every code change must pass all of them.
2. **The guarantees run on every real upload**, so an unexpected new shape is caught and reported, not saved wrong.
3. **A free re-check of every saved document** in both regions after each fix (`evidence\tools\scan\`).

**Cost, best practice:**
- Today the page bank keeps only our final decision; the AI's raw page readings (what we paid for) are thrown away,
  so every rule fix forces paying again. **Save the raw AI readings** (a few KB per page) and re-run our free rules
  on them → after this, fixing a rule costs **no AI money**; only new uploads pay.
- Nothing re-reads by itself (verified: only upload, replace, "Read again" and admin reindex queue a reading), so
  we decide when money is spent. Documents read before the change pay one more AI read, only when someone reads
  them again. Sandbox today, so it is small.
- The guarantees are free. Fewer, money-only source checks spend less than today.

**Alerts (recommended: D-a + D-b below):** drop the "check required / resolved / layout only" alerts (they become
logs). One alert per document reading, only when a guarantee still fails after the automatic repair. ~~Plus a
"Something wrong in this file? Tell our team" item in each file's menu.~~ Rejected by the owner 2026-10-02 — see
`NEXT-SESSION-PROMPT.md` §6 for the visible one-click "this document gives wrong answers" report that replaces it.

## 1B. Owner decisions recorded
- **2026-10-02 — UI APPROVED** (owner: "the UI you have my approval … remove that bar and also the other
  suggestion … don't forget … the mobile app"): E1 bar removed, E2 picture delete, E3 sentences that follow the
  file's real access, E4 hide controls a member cannot use — web and mobile.
- **2026-10-02 — BACKEND APPROVED** (owner: "you have my approval. Just go for it … quality over speed … full permission
  of our sandbox"; then "you don't need to wait for my approval as long as you follow all the standards and practices").
  Covers §1A, A–D and F, the one-time re-read from the rules version raise (decision 3), and the bar removal (decision 4).
  Alerts + notice: **D-a**. D-b is drawn (§0A) and waits for its own approval under the mockup gate.
- **2026-10-02 (late) — D-b REJECTED, sheet deleted; remaining build moves to a NEW session.** Owner: the sheet is wrong
  at the root — it must not sit inside the file menu, must not say "tell our team" and is not feedback. It is an ERROR
  report ("this document is producing incorrect output"), visible on the document, one click, one admin alert, nothing
  else. Full requirement: `NEXT-SESSION-PROMPT.md` §6. The owner also asked to stop starting new items here: finish
  and audit this session's work, and hand everything still open to a new session through `NEXT-SESSION-PROMPT.md`.
- **2026-10-02 — FINAL MULTIDIMENSIONAL AUDIT** required by the owner after all code (BUILD-STATE H).

## 2. The fix plan (each item: problem → what breaks → fix → needed? → recommendation)

### A. Never lose what was read — the parser (P0, money)
- **A1 Figure + repeated-header bug.** Breaks: whole pages / price tables vanish silently. Fix (class, three locks):
  (1) a line inside an open figure is the figure's line even when it is a repeated header — the closing mark is always
  seen; (2) opening a figure while one is open **closes the open one first** — never `Clear()` words;
  (3) the repeat-cleanup never treats a line carrying markup (`<figure>`/`</figure>`) as a header, and `CarryFigures`
  writes the marks on their own lines like the layout reader does. Needed: yes. **Recommend: all three.**
- **A2 The safety net (conservation check).** Breaks without it: the next bug of this kind is silent again. Fix: after
  a document is put together, every amount/number the page readings contain must be in the saved document; if any is
  missing, the page is rebuilt from the other reading, and if still missing, a High admin alert
  (dedicated type, one per reading) names the pages and amounts, and the provider sees a true notice. Applies to
  knowledge, AI setup and draft services. Needed: yes — this is the owner's "always tell the team behind the scene",
  aimed at real loss. **Recommend: build.**

### B. Right value under the right label — the reading rules (P0, money)
- **B1** A side label (a column with a header and no values) is layout, not content — the AI page is kept.
- **B2** A third reading that matches neither reading is never used for a table row or header when it only moves a
  word that the row already holds in another cell.
- **B3** An empty machine cell + an AI value the page does not print = **leave it empty** (never publish an unconfirmed
  value — the runbook rule "a lost format beats a wrong price").
- **B4** A number added where the page has none is a content difference, never "layout".
- **B5 (O-6)** When a page does keep the machine reading and the PDF has a trusted text layer, letters of links, codes
  and numbers are taken from the text layer where they line up one-to-one. Exact mechanism decided at build time on
  measured cases; it ships in this programme.
- These change what a page reading decides ⇒ **raise `AdjudicationRulesVersion` 1 → 2** (CLAUDE.md §0.23).
  Cost: every saved page is read again once, the next time its document is read (real AI cost; sandbox only today).

### C. Clean cards (P1)
O-2 junk summaries only for real lists (enough rows, header reads as labels, adds information); O-3 strip markup in
table cells; O-4 value-above-label forms become `Label: value`; O-5 a spanning cell is written once.

### D. The notice and the admin alerts — end to end (owner's question)
What I found: today the provider is told something untrue and unactionable, and the team gets 26 alerts for 4 files
while the real loss gets none. Options:

| Option | Provider sees | Team gets | My view |
|---|---|---|---|
| D-a | Nothing about readings we settled ourselves; a true sentence only when content was really lost (A2), plus "Our team has been told and will look at it." | **One** alert per document reading, only when a human is needed (lost content, a price left unconfirmed); no "required"/"resolved"/"layout only" alerts | **Recommended.** Honest, nothing to do for the provider, nothing missed for the team. |
| D-b | ~~D-a **plus** a small "Something wrong in this file? Tell our team" link on every ready file, with an optional note; sends one alert with the file, page and note~~ | as D-a + provider reports | ‼️ **REJECTED by the owner 2026-10-02** (sheet deleted). Replaced by the one-click error report in `NEXT-SESSION-PROMPT.md` §6. |
| D-c | Keep today's notice, add "Contact support" | 26 alerts as today | Not recommended — still untrue and noisy. |

The provider notice copy (if any remains) is plain, in all 5 languages, server-translated as today.

### E. Screens — web AND mobile in the same change
E1 remove the moving bar (both apps; its animation, styles, tests, skill lines; register rows superseding the two
sheets). E2 picture delete: the confirm becomes part of the viewer itself (web: inside the viewer layer, focus kept
in it, Escape closes only the confirm; iOS/Android: inside the viewer window, with its own toast host); the pending
delete is cleared when the viewer closes. E3 O-7 / O-8 copy follows the file's real access. E4 O-9 hide controls a
member cannot use. No new screen ⇒ no mockup needed for E1–E4.

### F. Admin
F1 (O-1) API writes Newtonsoft values correctly (one converter in the API's JSON options) — fixes admin web and
admin mobile with no app change; integration test on the real response. F2 the admin alert type list gets the new
A2 / D-b types. F3 correct the stale memory entry that called the `[]` output "not a defect".

### G. Tests and proof (CLAUDE.md §0.8 / §0.18)
Unit + integration in the host that runs the code (Functions for the reading; API for provider setup and admin
alerts). Every new guard sabotaged once. Regression fixtures are **synthetic** shapes of the two failures (repeated
logo; repeated banner over a price table), never provider files. Live proof after the owner deploys: Read again the
four NKN607 files and MG Windsor; re-run the scan (`evidence\tools\scan\`) — target **0 documents losing numbers**
in both regions, and the row-by-row check of §0 all correct.

### H. Schema
None expected: notices reuse the existing `ReadingNotices` list; alerts reuse `AdminAlert`; new alert types are enum
values. If D-b needs to remember "already reported", that would be a new field — I will bring the §0.7 table first.

---

## 3. Decisions for the owner (PENDING — nothing below is approved)
1. Approve sections A, B, C, E, F as written?
2. Notice + alerts: **D-a** or **D-a + D-b** (the "Tell our team" link)? → **Decided: D-a built; D-b rejected 2026-10-02**
   and replaced by the requirement in `NEXT-SESSION-PROMPT.md` §6.
3. Accept the one-time re-read of every saved page caused by B (rules version 1 → 2)?
4. Remove the moving bar on both apps, superseding the two approved sheets on that point?

## 4. Evidence index
- `evidence\tools\replay-at-discovery\` — runs the production path (Attach → Split → CarryFigures → Join →
  ParseLayoutMarkdown) on banked readings, as it was when the loss was found; `fixClose` shows the counter-check.
  `evidence\tools\replay\` — the same path on today's code, printing the conservation report. `evidence\tools\scan\` —
  both-region lost-numbers scan. `evidence\tools\cb\` / `cq\` — read-only blob and Cosmos helpers (sandbox only). How to
  run them: `NEXT-SESSION-PROMPT.md` §2.4.
- `evidence\replay\c1home-replay.*.md` — the joined page readings before/after the repeat cleanup (lines 1-5, 154).
- `evidence\alerts-NKN607-2026-10-02.txt` — all 26 alert texts.
- Sandbox rows: CA `NKN607` docs `e79abbd8…` (lost pages), `c619e403…`, `3c01a137…`, `1b5eed6a…`; IN `6TCWOI`
  `55af3e34…` (MG Windsor p36).
