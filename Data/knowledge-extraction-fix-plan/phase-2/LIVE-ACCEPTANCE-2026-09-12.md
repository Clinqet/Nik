# Live acceptance run — 2026-09-12, after the owner deployed the page-cache-identity fix

**What this run was for.** `PROGRESS.md` §6 listed two Phase-1 defects as *fixed, green, but NOT proven live*:
**P1-C** (`SourceUnitRestored` putting OCR soup back into the index) and **P1-D** (a restore duplicating what
the page already carried). Their first live run proved nothing because every page was served from the vision
page cache under an unchanged policy key (`PROGRESS.md` §4.1). The owner deployed **shared → core →
infrastructure → Functions → API** on 2026-09-12; this is the acceptance test.

Fixtures re-run **in place** with `kaudit reprocess` (never deleted — PLAN.md ruling 2):

| docId | file | why |
|---|---|---|
| `6fcd9c32ee6e4c8397c7babc7121a462` | `img_gujarati_pricelist.png` | P1-B + **P1-C** |
| `bfb6dfba8dfb472d97ffeefbaae0b25d` | `pdf_two_column_prose_resume.pdf` | **P1-D** |
| `4eeae96e1e0549538283705897ca3bc0` | `pdf_hindi_gujarati_english_pricelist.pdf` | **P1-D** |

---

## 1. ✅ P1-C is PROVEN LIVE — and the cache-identity mechanism works

The single most important line of evidence is the same document's alert on two consecutive days. Same
fixture, same six regions, **different dispositions**:

```
2026-09-11 10:52:21  …source check '???? ?????? ??????', used '# 2 414' [SourceUnitRestored]
2026-09-12 02:58:00  …first AI reading '',                used ''        [SourceUnitNotOnPage]
```

The OCR soup that was being written into the index yesterday is discarded today. Because `reprocess` does not
force-fresh, this also proves the second thing it had to prove: **the page cache re-read the pages on its own**,
purely because `PageCachePolicy` now carries the compiled identity of the assembly holding the rules. The
mechanism that failed twice in two phases (a version number a human had to remember) is working.

The cards are now a correct Gujarati price list where yesterday they were machine noise:

```
--- …_0 [Table] section='શ્રી બ્યુટી પાર્લર' page=1 chars=147
    સેવા: વાળ કપાવવા | કિંમત: ₹250
    સેવા: ફેશિયલ | કિંમત: ₹800
    સેવા: 4211% | કિંમત: ₹500        ← ‼️ see §2
    સેવા: બ્રાઇડલ મેકઅપ | કિંમત: ₹5,000
    સેવા: થ્રેડિંગ | કિંમત: ₹50
```

`1, 54 | ₹250` · `$22144 | ₹800` · `11 24 | ₹5,000` · `3 โรงเ | ₹50` · the `# 2 414` heading — **all gone**,
and none of them is a section title any more. Five of the six garbage readings are correctly discarded.

Row `status=Ready cards=5 images=2 drafts=0 analytics=Ran candidateCount=4 judgeRemovedCount=4` — drafts 0 is
**correct** on `SX3SG2`: a construction-equipment dealer does not sell facials, and the judge removed all four
(PLAN.md ruling 3 — this is exactly why drafts must be proven on a matching business).

---

## 2. ‼️ NEW LIVE DEFECT — **P2-A: the machine reading wins the characters even when it is reading pixels**

**The sixth region did not behave.** One table cell still carries OCR garbage, and the judge **said so in its
own words** before writing it anyway:

```json
{"fields":["service name"],
 "reason":"'4211%' reads 'મસાજ'",
 "location":"page 1, table 1, row '4211%', column 1",
 "ocrReading":"4211%",
 "firstAiReading":"મસાજ",
 "selectedReading":"4211%",
 "disposition":"SourceReadingRetained",
 "remainingUncertainty":"no usable source reading"}
```

The source image genuinely says **`મસાજ`** (massage) — confirmed in the generator,
`tools\kaudit\GenImage.cs:29`: `("મસાજ", "₹500")`. The vision reader got it right. The picture's own caption
got it right (`…મસાજ ₹500…`). **Only the OCR was wrong, and only the OCR was published.**

### Why it happened — the premise is false for a rendered page

`VisionDocumentTranscriptionService.cs:476-483`, the `third == null` branch:

```csharp
else if (third == null)
{
    // No evidence. The machine reading decides the CHARACTERS of one value — that is what it is
    // good at — and `Correct` below refuses the write if this span holds anything else.
    disposition = TranscriptionVerificationDisposition.SourceReadingRetained;
    selected = discrepancy.SourceText;
    uncertainty = offTarget ? "…" : verification.FailureCategory ?? "no usable source reading";
```

*"The machine reading decides the characters — that is what it is good at"* is true when the machine reading
is reading **text**: a `.docx`, a PDF with a text layer. It is **false when the machine reading is OCR of
pixels**. On a rasterized page the two readers are peers — both are looking at the same pixels — and in a
script OCR handles poorly (Gujarati here; equally Hindi, Thai, Khmer, Arabic, CJK) the vision reader is the
*better* one. The code grants authority to the weaker reader precisely where it is weakest.

### This is the same shape as every defect this programme has actually fixed

- EX-32: **the hyphen is decided by the LANE, not the text.**
- P1-B: whether to re-read a picture is decided by **whether the lane already rendered it**.
- The cache: staleness is decided by **the compiled identity of the code**, not a remembered number.

⇒ The discriminator almost certainly already exists: **`KnowledgeExtractionOutput.RenderedPages`**, added
during the Phase-1 defect fix for exactly this class of question ("did this lane produce pixels?"). A page the
lane rendered has no typed source, so nothing in that region is entitled to be called *the* source reading.

### Severity and scope

**High.** It is the heart of the functionality (owner: *"We cannot have any loophole"*), it is silent to the
provider, and it publishes a wrong service name into the index and into the overview — note the `DocSummary`
card and the `DocAggregate` card both repeat `4211%`, so one bad cell propagates to three cards. Any
non-Latin-script document a provider photographs can hit it.

**What it is NOT:** not a P1-C regression (P1-C is proven fixed above), and not a cache problem. It is a
sixth, previously-invisible branch of the same adjudication that P1-C/P1-D repaired — invisible until P1-C
stopped flooding the same page with `SourceUnitRestored` noise.

### ‼️ NOT FIXED IN THIS SESSION — and why

The correct fix needs: the discriminator chosen on evidence, `Correct()` understood (it refuses a write when
the span holds something else — that guard must not be lost), a sabotage-proven test, the three suites
(Communications 4,347 · API 11,947 · MCP 918) re-run, a deploy, and a live re-run. Started at the end of a
session, that is a rushed change to the most load-bearing code in the pipeline. **It is item 1 of §0A in
`PHASE-2B-PROMPT.md`.** A half-finished patch here is exactly the "workaround" §1A.1 forbids.

**Do not accept a fix that simply flips the branch to prefer the candidate.** That would break the case the
branch was written for (a typed document where OCR genuinely decides digits). The fix must key on a fact the
lane already states.

### A second, lesser observation on the same card

Row 1 reads `વાળ કપાવવા`; the source says `વાળ કાપવા` (`GenImage.cs:29`) and the caption says `વાળ કાપવા`.
No discrepancy was raised at all, so this is a **vision transcription fidelity** wobble, not an adjudication
defect — the vision reader paraphrased one word. Lower severity, different lane. Record it, measure it on the
next run, do not conflate it with P2-A.

---

## 2B. ✅ P1-D is PROVEN LIVE — the two-column resume is clean

`bfb6dfba8dfb472d97ffeefbaae0b25d` (`pdf_two_column_prose_resume.pdf`) → `status=Ready cards=8 passageCount=8`,
and the artefact reports **`reviews=0`, zero content discrepancies**. The audit of 2026-09-10 found **nine**.

The alert ladder on this one document across three days is the whole Phase-1 story in four lines:

```
2026-09-10 08:35  [High]  unresolved reading · 9 regions · used 'SKILLS | PROFILE' [ResolvedToSourceReading]
2026-09-11 10:49  [High]  unresolved reading · 1 region  · 'Redken Colour Specialist (2021) Olaplex Pro (2022)
                            | now sold at $450; trained four apprentices … City Cuts - Stylist (2013-2019)'
2026-09-12 03:02  [Low]   ‼️ LAYOUT DIFFERENCE ONLY · 9 regions · all [LayoutDifferenceKept]
```

**No High. No unresolved reading. No glued row.** The certifications row that had the experience tail welded
onto it is gone, and every section is now its own card with its own content:

```
_2 [Text] section='PRIYA SHARMA › CERTIFICATIONS'  Redken Colour Specialist (2021) Olaplex Pro (2022)
_5 [Text] section='PRIYA SHARMA › EXPERIENCE'      Glow Salon — Senior Stylist (2019–present) … City Cuts …
_6 [Text] section='PRIYA SHARMA › EDUCATION'       Marvel Beauty School, Diploma in Hairstyling (2012)   ← 51 chars
```

The EDUCATION card carries **only** education. That is the P1-D assertion, met.

Note the artefact says `reviews=0` while the alert says 9 regions: `LayoutDifferenceKept` discrepancies change
no content, so they are not written into the artefact's reviews. Consistent, not a discrepancy-count bug.

**‼️ P2-A did not appear on this document** — an English, digitally-typed PDF, where the machine reading
genuinely *is* good at characters. That is a second piece of evidence that the P2-A discriminator is the
**lane** (typed source vs rendered pixels) and not the script or the content: the same branch behaves
correctly here and wrongly on the PNG.

## 2C. ✅ The trilingual price list — the shape the owner named is GONE

`4eeae96e1e0549538283705897ca3bc0` (`pdf_hindi_gujarati_english_pricelist.pdf`) → `Ready cards=6 passageCount=6`.

The opening Phase-2 instruction was that *"the 5 'no usable source reading' shapes on
`pdf_hindi_gujarati_english_pricelist` must be GONE."*

```
remainingUncertainty  :  (none — zero occurrences)
dispositions          :  5 × SourceUnitNotOnPage, all with selectedReading ""
```

**Zero.** All five are now correctly discarded instead of being kept with no usable reading. The document
reads as three clean sections in three scripts:

```
_0 [Table] Hindi      सेवा: बाल कटवाना ₹250 · दाढ़ी ट्रिम ₹150 · फेशियल (गोल्ड) ₹1,200 ·
                      मैनीक्योर ₹300 · पेडीक्योर ₹450 · हेयर स्पा ₹1,500
_1 [Text]  Gujarati   વાળ કપાવવા ₹250 · ફેશિયલ ₹800 · મસાજ ₹500 ·
                      સંપૂર્ણ પીઠ પોલિશ સ્ક્રબ સાથે ₹400 · બ્રાઇડલ મેકઅપ ₹5,000
_2 [Text]  English    prices include GST. Home visit adds ₹200. Call 98765 43210 to book.
```

The Hindi title appears **once** (its duplication was the other half of P1-D).

### ‼️ This is the decisive evidence for P2-A's discriminator

The **same Gujarati word** in the **same pipeline** on the **same day**:

| Fixture | Lane | `મસાજ` came out as |
|---|---|---|
| `img_gujarati_pricelist.png` | **rendered pixels** (OCR of a raster) | ❌ `4211%` |
| `pdf_hindi_gujarati_english_pricelist.pdf` | **typed text** (a real text layer) | ✅ `મસાજ` |
| `pdf_two_column_prose_resume.pdf` (English) | **typed text** | ✅ correct, P2-A absent |

**The script is not the variable. The lane is.** A fix that keys on Gujarati, on Indic scripts, or on
"looks like garbage" is a heuristic and is forbidden by §1A.1. The fact that decides this is whether the
machine reading was reading **text** or **pixels** — which the lane already states.

---

## 2D. Drift

`kaudit drift ca` → **23 / 23 ok, zero drift.** Every document's row `passageCount` equals its index count,
including all three re-run fixtures. No document was stranded by the re-runs.

---

## 3. What alerted (and what did not)

`kaudit alerts ca 6fcd9c32ee6e4c8397c7babc7121a462` — the run raised, correctly:

- **High** — *"Source check left an unresolved reading"* (the `4211%` region among them)
- **Medium** — *"Source check required"*

So **an admin is told. The provider is not.** That gap is exactly E7/R-9 (`PHASE-2B-PROMPT.md` §2.2.1) — and
this run is a concrete argument for it: a provider whose price list has a mangled service name currently has
no way to learn it.

No false alert was raised.
