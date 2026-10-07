# P1.5 — measurements against live Azure (2026-09-02)

`PLAN.md` §18.21 names five things that were NOT measured during planning and are **gates, not footnotes**.
This file records what was actually run, on the owner's own Azure, with the numbers.

Probe scripts live in the session scratchpad and are deleted at the end of the phase (§0.16). No credential
value is written into any file here or in any repo.

---

## Gate 3 — Fast Transcription: does it work, how fast, and is `gu-IN` real?

**Resources** (both verified live by the owner on 2026-09-02):

| Region | Account | Endpoint host | Location |
|---|---|---|---|
| Canada | `clinket-speech-ca-v4-nonprod` | `clinket-speech-ca-v4-nonprod.cognitiveservices.azure.com` | `canadacentral` |
| India | `clinket-speech-in-v4-nonprod` | `clinket-speech-in-v4-nonprod.cognitiveservices.azure.com` | (India) |

### 3a. API version

`POST https://<host>/speechtotext/transcriptions:transcribe?api-version=<v>` — multipart (`definition` JSON +
`audio`).

| `api-version` | Result |
|---|---|
| `2024-11-15` | **200** — works |
| `2025-05-15-preview` | **404 Resource not found** — does not exist on this account |
| **`2025-10-15`** | **200** — works. ‼️ **CHOSEN** (the version PLAN §18.6 names) |

### 3b. Language identification from a per-provider candidate list

Audio produced by Azure TTS on the SAME Speech resource (neural voices), then transcribed back.
‼️ **Synthetic speech is cleaner than a provider speaking in a workshop, so the accuracy below is an UPPER
BOUND, not a field measurement.** Direction and language-ID behaviour are what this proves.

| Spoken | Voice | `locales` sent | Detected | Transcript | Verdict |
|---|---|---|---|---|---|
| English | `en-CA-ClaraNeural` | `en-CA,gu-IN,hi-IN` | **`en-CA`** ✅ | *"What does a facial cost and what is the cancellation policy?"* | exact |
| **Gujarati** | `gu-IN-DhwaniNeural` | `gu-IN,hi-IN,en-IN` | **`gu-IN`** ✅ | *"ફેશિયલ ની કિંમત કેટલી છે અને રદ કરવાની નીતિ શું છે?"* | exact but for one space (`ફેશિયલ ની` vs `ફેશિયલની`) |
| **Hindi** | `hi-IN-SwaraNeural` | `gu-IN,hi-IN,en-IN` | **`hi-IN`** ✅ | *"फेशियल की कीमत कितनी है और रद्द करने की नीती क्या है?"* | one diacritic (`नीती` vs `नीति`) |
| **Punjabi** | `pa-IN-OjasNeural` | `gu-IN,hi-IN,en-IN,pa-IN` | ‼️ **`hi-IN`** ❌ | *"फेशियल दी। कीमत कितनी है?"* | **mis-identified, and transliterated Gurmukhi into DEVANAGARI** |

‼️ **NEW FINDING — Punjabi is not safe on language identification.** With `pa-IN` explicitly in the candidate
list, Gurmukhi speech was identified as Hindi and written out in Devanagari. It did not fail; it produced
readable, wrong-script text. This is the transcription-layer instance of the truthfulness class.
**Consequence for the design:** the language-correction chip (§18.5) is not a nicety for Punjabi — it is the
only recovery. Recorded as a named residual; a single-locale request (`locales: ["pa-IN"]`) is the corrective
path once the member picks Punjabi on the chip.

### 3c. ‼️ The claim that drives the whole rule — an empty `locales` array

`PLAN` §18.4 says: *`locales: []` or omitted — the multilingual model, whose candidate list excludes `gu-IN`
⇒ **never do this***. **Measured, and it is worse than the plan predicted.**

| `definition` | HTTP | Detected | Transcript |
|---|---|---|---|
| `{}` (omitted) | 200 | `en-US` | *"Facial ni kimmat ketili chhe \*\*\* Rud Karvani niti shoo chhe."* |
| `{"locales":[]}` | 200 | `en-US` | *"Facial ni kimmat ketili chhe \*\*\* Rud Karvani niti shoo chhe."* |

The **same Gujarati audio** that transcribes perfectly with a candidate list comes back as **romanized
English**, labelled `en-US`, with a profanity mask over a word that is not profane. **It returns 200. It does
not fail. It produces confident nonsense**, which a member would then send as their question and be answered
on. The rule "never send an empty `locales`" is therefore pinned by a test, not left to a code comment.

### 3d. Latency

| Call | Canada endpoint | India endpoint (from a Canada dev machine) |
|---|---|---|
| English, ~4 s clip | **496–610 ms** | — |
| Gujarati, ~7 s clip | **843 ms** | 2,469 ms |
| Hindi, ~5 s clip | 5,251 ms (cold/contended) → **782 ms** warm | 2,116 ms |

Sub-second in-region for a 10-second question, which is the §18.5 "speak-then-see" budget. India's figures are
measured across the Atlantic from a Canadian dev machine and are **not** what an in-region API instance sees.

### 3e. ‼️ 429 is a real, everyday response

One burst of four requests in a few seconds returned
`HTTP 429 {"code":"TooManyRequests","message":"Resource Exhausted"}` — **after 10.7 seconds of holding the
connection**. So the retry policy must (a) treat 429 as retryable with backoff, and (b) not let a queued 429
blow the request timeout. Both are dials, and both are tested.

---

## Gate 1 — the THREE-FIELD tool shape ‼️ FAILED FIRST, THEN FIXED

`PLAN` §18.21: *"25/25 was on **two** fields. Same mechanism, unproven at N=3."* Run against the real
deployment — **`gpt-5.6-luna` at `reasoning_effort: none`**, the shipped setting — with the schema this phase
actually generates and the server's own Unicode check applied to every returned rendering. 25 runs, eight
questions in English, Gujarati and Hindi.

### ‼️ The planning-approved instruction wording scores 3/25

| Wording | Tool called | Fully compliant | Fields in the wrong script |
|---|---|---|---|
| ‼️ §18.13's phrasing — *"render the SAME question in each field"* | 25/25 | **3/25** | **44** |
| **The shipped phrasing** — *"TRANSLATED INTO {language} and written in the {language} script"* | 25/25 | **25/25** | **0** |

**What the model actually did with the approved wording:** it read *"the same question"* as *"the same
string"* and copied one **English** sentence into all three fields. Worse, given a **Gujarati** question it
translated it **into English** first and put that in `queryInGujarati`:

```
run 3 (gu) "ફેશિયલની કિંમત કેટલી છે?"
   → queryInGujarati: "What is the price of a facial?"
   → queryInHindi:    "What is the price of a facial?"
```

**What that would have shipped.** Every non-Latin rendering fails the server's script check, so a
three-alphabet business would have: paid for three searches, searched **one** alphabet three times, dropped
two legs on every question, and **hedged every single answer as a partial search**. The feature would have
cost triple and delivered nothing — and it would have *looked* like it was working.

**The fix is the field DESCRIPTION alone** (the system-prompt rule was re-worded to match, but the
description carries it). Verified at every arity, because a Latin-only business must not regress:

| Fields | Tool called | Fully compliant | Wrong script | Missing |
|---|---|---|---|---|
| **1** (`queryInEnglish`) | 25/25 | **25/25** | 0 | 0 |
| **2** (+ `queryInGujarati`) | 25/25 | **25/25** | 0 | 0 |
| **3** (+ `queryInHindi`) | 25/25 | **25/25** | 0 | 0 |

‼️ **This wording is now MEASURED, not drafted.** The code says so at the site, and the instruction to a
future editor is: re-measure before changing a word of it.

---

## Gates 2, 4, 5 — the retrieval half

### ‼️ FIRST, THE FACT THAT REFRAMES ALL THREE: production content is entirely Latin

Both live knowledge indexes were surveyed card by card with the same Unicode rule the detector uses:

| Region | Businesses with cards | Cards | Scripts found |
|---|---|---|---|
| Canada (`clinket-knowledge-dev-v1`) | 2 | 744 | **`Latn` only** |
| India (`clinket-knowledge-dev-v1`) | 7 | 99 | **`Latn` only** |

**No provider has uploaded a single non-Latin document.** So §18.8's cross-script numbers **cannot** be
re-measured against production content, and this whole phase is pre-emptive rather than corrective. That is
worth the owner knowing plainly: the multi-script half fixes a failure nobody has hit yet, because nobody has
yet written a document in a non-Latin script. The **voice** half, by contrast, is live for every provider the
day it ships.

Measurements below therefore run on a **temporary index built on the same search service** — same field
shape, same `text-embedding-3-large` 3072-dim vectors, same composed hybrid query (BM25 `search` +
`vectorQueries` + `preFilter` on `businessId`) — and deleted afterwards. **No live index was written to.**

### Gate 2 — the parallel merge on a live engine: ‼️ RUN, and it validates "keep the MAX score"

Per-leg scores came back in the band **0.0164 – 0.0333**, which is the RRF signature: `1/(60+rank)` ≈ 0.0164
for a rank-1 hit on one leg, doubling to ≈ 0.0333 for a card that ranked first on **both** the BM25 and the
vector legs.

‼️ **This matters because the codebase warns that RRF scores are rank-derived and not comparable across
queries (D27b).** Measured, they are on the **same scale** for every leg, so `max score` across legs is
equivalent to **best rank** across legs — a card is ranked by the leg that found it best, which is exactly
what §18.10 specifies. **The shipped merge is correct**, and it is correct for a reason now written down
rather than assumed.

### Gate 4 — do three legs dilute or improve top-K? Measured twice, and the two corpora disagree

**Corpus A — every fact written in all three alphabets** (8 cards, 6 questions):

| | wrong-topic top hit | recall@3 |
|---|---|---|
| 1 leg | 0/6 | 12/18 |
| 2 legs | 0/6 | **10/18** |
| 3 legs | 0/6 | **15/18** |

Three legs improve; two legs are *worse than one*, because the merge promotes a second alphabet's copy and
pushes a third out of the window. **No leg count ever produced a wrong TOPIC.**

**Corpus B — each fact written ONCE, in ONE alphabet, among 30 plausible near-miss documents (33 cards).**
This is the realistic shape, and it is the one that matters: a real business writes each policy once.

| case | asked in | answer written in | 1 leg | all legs |
|---|---|---|---|---|
| GU question, English-only answer | `Gujr` | `Latn` | **ABSENT** | **#5** |
| HI question, English-only answer | `Deva` | `Latn` | #5 | #5 |
| EN question, Gujarati-only answer | `Latn` | `Gujr` | ABSENT | ABSENT |
| EN question, Hindi-only answer | `Latn` | `Deva` | ABSENT | ABSENT |

‼️ **I do NOT claim this corpus proves the feature works.** Opening the per-leg dump shows why: the thirty
synthetic noise documents are short, uniform "salon policy" texts, and the RRF fusion of BM25 + vector over
near-identical material produces near-ties — the *noise* out-ranks the answers on every leg, in every
alphabet, including the answer's own. **The corpus is measuring its own uniformity, not the product.** The
runbook's standing warning applies exactly: *a rising hit count is not a win — open the documents.*

**What Corpus B does establish**, because it is directional and one-sided:
- A Gujarati question reached an English-only answer at **rank #5 with the extra legs and not at all
  without them** — the §18.8 failure, reproduced on a live engine.
- The extra legs **never made a case worse**. Two cases that were unreachable stayed unreachable; none
  regressed.

### Gate 5 — re-measure §18.8 against the live index: ‼️ NOT POSSIBLE, and why

§18.8's numbers were raw embedding cosines. Re-measuring them "against the live index" requires non-Latin
content in the live index, and there is none in either region (above). The direction is confirmed on the
temporary index; **the exact numbers remain unverified against production content, and will stay so until a
provider uploads a non-Latin document.** Recorded as unmet rather than quietly approximated.

**The honest summary for the owner:** gate 1 is met and caught a real defect; gate 2 is met and validated a
design choice; gate 3 is met; gate 4 is met in direction but not in magnitude; gate 5 cannot be met with
today's data.
