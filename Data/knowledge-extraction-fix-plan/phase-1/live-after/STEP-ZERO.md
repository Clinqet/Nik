# Step zero — Phase 1 verified on the DEPLOYED Canada pipeline (2026-09-11, by the Phase-2 session)

Read-only with respect to Phase-2 scope. Every one of the 17 retained `SX3SG2` fixtures plus `MEE3IC`
`gopi.jpeg` was re-run in place with `kaudit reprocess` → `wait` → `pull` → `alerts`, then `kaudit drift ca`.
Nothing was deleted. The 2026-09-10 before-state in `evidence\ca-live-batch\` was not overwritten.

**Deploy confirmed live before the batch:** `docx_two_column_table_resume.docx` reprocessed 2 cards → 7
(A8, a pure parser change with no AI in the path).

## 1. The four checks `HANDOVER.md` §5 names

| Check | Result |
|---|---|
| `cards.txt` vs the deployed before-state | **Large, correct gains on 12 of 17.** Table below. |
| `## reviews`: the 9-discrepancy `ResolvedToSourceReading` shape on `pdf_two_column_prose_resume` | **GONE** — 1 discrepancy, and every fact the old run deleted is back. |
| `## reviews`: the 5 `SourceReadingRetained` "no usable source reading" on `pdf_hindi_gujarati_english_pricelist` | **GONE** — all five are now `SourceUnitNotOnPage`; the Gujarati list is indexed perfectly and `scripts` carries `Gujr`. |
| `kaudit alerts` — nothing false | **3 alert families are now true where they used to be silent**; one document alerts on a real new defect (below). No alert fires about an EMF/WMF picture or an unfetchable remote `<img>`. |
| `kaudit drift ca` — row `passageCount` == index count | **23 / 23 `ok`**, `gopi.jpeg` included (was 7/0 — L-12 healed). |

## 2. What healed

| Document | Before → after |
|---|---|
| `pdf_two_column_prose_resume` (**L-1**) | `SKILLS \| PROFILE - Bridal styling …` → 7 sectioned cards; `Balayage`, `Redken Colour Specialist (2021)`, `Olaplex Pro (2022)`, `Stylist with 12 years…`, `now sold at $450`, `City Cuts — Stylist (2013–2019)` all restored |
| `pdf_hindi_gujarati_english_pricelist` (**L-2**) | `1 5 \| ₹250`, `WISSEL 78244 \| ₹5,000`, `scripts=["Deva","Latn"]` → the Hindi table labelled `સેવા`/`કિંમત`, the five Gujarati rows exact, `lang=gu` |
| `pdf_table_across_pages_header_once` (**L-3**) | 43 of 72 rows bare → page 2/3 continuations carry the inherited header |
| `pdf_price_shapes_tiers_units` (**L-4**) | one 449-char glued card → 16 lines, one record each |
| `img_pricelist_lowercase_inline` (**L-4**) | one glued line → 6 records |
| `docx_paragraph_pricelist` (**A1/A14**) | 1 glued card → 2 sectioned cards, one record per line |
| `xlsx_merged…` (**A11/X-03**) | unlabelled grid + invented `Service` → `Price (Short hair): $25.00 \| Price (Long hair): $35.00` |
| `Microsoft Pricing Structure.xlsx` (**L-6**) | `Microsoft (2024 Costs (CAD))` labels stamped on 2025/2026 rows → year bands, no invented labels |
| `pptx_two_textbox_columns` (**L-7/A7**) | names card + prices card → zipped records |
| `docx_two_column_table_resume` (**A8**) | one 584-char card → 6 sections |
| `pdf_footer_disclaimer_repeated` (**A16/L-5**) | 3 near-duplicate footer cards → 1 |
| `gopi.jpeg` (**C12/C12-L**) | `captions=0`, undescribed, 7/0 drifted → a real description **and** the full transcription, 9 content cards, 20/20 |

## 3. Four Phase-1 defects this run found (none of them visible to a unit test)

| # | Sev | Defect | Evidence |
|---|---|---|---|
| **P1-A** | 🔴 | **A repeated table HEADER at the top of a continuation page is stripped as page furniture, destroying the table.** `StripRepeatedPageLines` removed `\| Service \| Price \|` from pages 2 and 3; the orphaned GFM delimiter row then stops the table parsing at all, so 36 priced rows are indexed as one prose paragraph of raw markdown: `\|---\|---:\| \| Transmission service — bay 2 \| $265 \| …`. FINDINGS §8.4 lists this document's per-page headers under "what worked — do not regress". | `pdf_footer_disclaimer_repeated.pdf.726e13b3/artifact-blocks.txt` block 5; `cards.txt` cards `_2`, `_3` |
| **P1-B** | 🔴 | **A picture that IS the document's own page is transcribed a second time.** C3 routes any `TextSnapshot` picture through DI + vision — including the single image of a photo/scan upload, whose pixels the page extraction has already read. Every image document now indexes its whole content twice, the second copy as raw unparsed markdown. | `img_gujarati_pricelist.png` card `_3`, `img_pricelist_two_columns_photo.jpg` card `_2`, `img_pricelist_lowercase_inline.jpg` card `_2`, `gopi.jpeg` card `_8` (1,272 chars) |
| **P1-C** | 🔴 | **`SourceUnitRestored` restores unreadable OCR into the index.** On `img_gujarati_pricelist.png` — the reference document L-2 had to match — `1, 54 \| ₹250`, `$22144 \| ₹800`, `4211% \| ₹500`, `WIE 24 \| ₹5,000`, `3 โรงเ \| ₹50` and the heading `# 2 414` were correctly **dropped** on 2026-09-10 and are now **kept**, and `2 414` became the section title of three cards. The same five rows on the PDF version were dropped, because there the third reader happened to answer "not on this page" — the outcome turns on the wording of one model reply. | `img_gujarati_pricelist.png.6fcd9c32/cards.txt` card `_1`; `kaudit alerts` 2026-09-11 10:52:21 |
| **P1-D** | 🟠 | **The restore appends a source line the page already carries.** The resume's EDUCATION card ends `… \| now sold at $450; trained four apprentices to full-time stylists. City Cuts - Stylist (2013-2019)` — a two-column DI row whose every word is already correctly placed in cards `_2` and `_5`. Same on the Hindi list: the page's own title is appended a second time as a trailing H1. Nothing is lost; content is stated where the document does not print it. | `pdf_two_column_prose_resume…/cards.txt` card `_6` + `## reviews` (`SourceUnitRestored`); `pdf_hindi_gujarati…/artifact-blocks.txt` block 5 |

Also noted, 🔵: `Page 1 of 3` / `Page 2 of 3` / `Page 3 of 3` still reach the index (they never repeat
*identically*, so the repeated-line count gate refuses them before `PageOrdinalLine` is consulted), although
L-5's fix states a page ordinal is dropped.

## 4. Other live state

- `kqueue knowledge-ingest-dev`: `active=0 dlq=2` — the two 2026-08-18 tickets (**L-11**) are still there.
- No document regressed in content anywhere else; 12 of 17 improved materially, 5 are unchanged or equal.
