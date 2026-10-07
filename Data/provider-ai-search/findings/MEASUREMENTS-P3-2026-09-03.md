# P3 — model measurements against live Azure (2026-09-03)

`CARRIED-TO-P3.md` §4: *"A measured instruction is not a drafted one. Re-measure before changing model-facing
wording, and record the number."* P3 changed the system prompt and every Group B schema and payload, and the
phase shipped without measuring — recorded in `AUDIT-P3` §8 item 1 as the one rule P3 knowingly broke.

**This file closes that gap.** Run on the owner's own Azure, against the shipped deployment, at the owner's
instruction on 2026-09-03.

| | |
|---|---|
| **Deployment** | `gpt-5.6-luna` at **`reasoning_effort: none`** — the shipped setting, not the `AIService` default |
| **Endpoint** | `clinket-ai-foundry-v4-nonprod-eastus2`, api-version `2025-01-01-preview` |
| **Total calls** | **1,175** |
| **Fidelity** | The prompt and schema are REBUILT from the shipped source, and every literal fragment is asserted byte-present in the `.cs`/`.json` it came from — a mistyped fragment throws instead of measuring the wrong wording. The guard caught one of my own errors during setup |

Probe scripts live in the session scratchpad and are deleted at the end (§0.16). No credential value is
written into any file here or in any repo.

---

## Gate 1 — `relativeRange`: does the model name the period instead of computing a date?

The schema advertises snake_case values from `Snake()`; the WORK RECORDS block names the same list. **175
calls, 7 cases × 25.**

| Question | Wanted | Result |
|---|---|---|
| *how many bookings do we have this week?* | `this_week` | **25/25** |
| *what did we have booked yesterday?* | `yesterday` | **25/25** |
| *show me bookings for the last 30 days* | `last_30_days` | **25/25** |
| *how many bookings did we get last month?* | `last_month` | **25/25** |
| *what's booked in tomorrow?* | `tomorrow` | **25/25** |
| ‼️ *how many bookings do we have?* (no period named) | **ASK, never choose** | **25/25** |
| ‼️ *bookings between 2026-09-01 and 2026-09-07* | both dates, NO `relativeRange` | **25/25** |

**‼️ 175/175.** No invalid value, no `thisWeek`, no computed date, and the two hard cases — asking rather
than guessing, and not sending a period alongside explicit dates — are clean. **The snake_case drift defect
P3 fixed during the build is confirmed closed at the model.**

## Gate 2 — Rule A2: does a follow-up carry the period? (the owner's own case)

‼️ **The tool CALL is never replayed between turns — only the answer TEXT.** So the period has to be
re-derived from what was said: rule B puts the days in the answer, rule A2 tells the model to reuse them.
This measures both together, as they ship. **125 calls, 5 cases × 25.**

| First turn | Follow-up | Wanted | Result |
|---|---|---|---|
| *how many bookings this week?* → *"47 this week, 31 August to 6 September"* | *and Gaurav's?* | `this_week` + `m-101` | **25/25** |
| " | *what about Priya Menon* | `this_week` + `m-102` | **25/25** |
| " | *just mine then* | `this_week` + `mineOnly` | **25/25** |
| " | ‼️ *and last month?* | `last_month` — the NEW period wins | **25/25** |
| " | ‼️ *and Gaurang's?* (nobody by that name) | **no member id at all** | **25/25** |

**‼️ 125/125.** The case the owner named — *"admin asks how many bookings and then says a team name"* — works
at the model, including the two traps: a new period overriding the carried one, and a name that is not on the
roster producing no guess rather than the nearest match.

## Gate 3 — Money: does the model refuse to do arithmetic? ‼️ **FAILED, DIAGNOSED, FIXED, RE-MEASURED**

**875 calls.** This is the gate that earned the whole exercise.

### 3a. The shipped wording invents a figure in ~9% of money answers

| Question | Shipped result |
|---|---|
| *what refund requests do we have this week?* | 50/50 |
| ‼️ *…what do they come to in total?* | **41/50** |
| ‼️ *…roughly what is that in dollars?* | **42/50** |
| *…just give me one number for the lot* | 50/50 |

The invented figure was **always `16,500`** — `4500 + 12000`, the two refunds summed **with the no-show claim
left out**.

### 3b. ‼️ The cause: two notes contradicted each other, and the model resolved it the helpful way

- `RefundAmountsAreVerbatim` said *"NEVER add amounts together"*.
- The `kinds` note ended *"…they are opposite directions: … and **never total them together**."*

The model read the second as **licence to total within one direction** — which is exactly the arithmetic it
produced. It was obeying one note while breaking the other. A prohibition with a carve-out is not a
prohibition.

A second, independent weakness: the money note said only what NOT to do. Asked point-blank for a total, the
model had **no compliant move available**, so it helped.

### 3c. Four variants, 200 calls each

| Variant | Total | plain | asked to total | asked to convert | pressed hard |
|---|---|---|---|---|---|
| **A — shipped** | 183/200 | 50/50 | 41/50 | 42/50 | 50/50 |
| B — name what to do instead | 190/200 | 50/50 | 40/50 | **50/50** | 50/50 |
| C — remove the `kinds` carve-out | 196/200 | 50/50 | **47/50** | 49/50 | 50/50 |
| ‼️ **D — both (SHIPPED)** | **196/200** | 50/50 | 46/50 | **50/50** | 50/50 |

**D is what now ships.** Both halves are principled and each fixes a different failure: removing the carve-out
closes the loophole the model was walking through, and naming the compliant action closes the conversion
case completely. This is the same shape P1.5 measured, where naming the act scored **25/25** against **3/25**
for forbidding it.

### 3d. ‼️ THE RESIDUAL — FOUND, DIAGNOSED AND CLOSED AT 500/500

**‼️ I first wrote that prompting could not close this and escalated it to the owner as a product decision.
That was WRONG, and it was wrong because I was still trying to forbid the act harder instead of asking why
the model reached for it at all.** Two structural suspects, 800 more calls:

| Variant | Total | asked to total |
|---|---|---|
| D — the §3c fix | 198/200 | 48/50 |
| **E — D + the payload STATES that no total exists** | **200/200** | **50/50** |
| F — D + the count field renamed off the word "total" | 192/200 | 42/50 — **worse** |
| G — E + F | 200/200 | 50/50 |

**The cause was an ABSENCE that was never stated.** The payload carried no combined figure and never said so
— it merely omitted one. Asked for a total, the model was being asked for something the result neither
carried nor denied, so it filled the gap. That is the truthfulness class applied to an absence: *anything
missing must SAY it is missing.*

**F is instructive as the one that failed.** Renaming the record count off the word "total" made it WORSE
(42/50) — the word was never the trigger, and had I shipped on a hunch instead of measuring I would have
made a money path worse while believing I had improved it.

**What ships is E** — one sentence, `BusinessSearchToolNotes.NoRefundTotalExists`, emitted as `noTotal`:

> *"There is no combined figure for these. The Refund requests page does not show one either, so no total of
> these amounts exists anywhere to quote. If the person asks for one, say that plainly and give the
> individual amounts."*

‼️ It is a fact about the **records**, not about the model's ability. *"You cannot add these"* invites a model
that plainly can; *"no such figure exists to quote"* does not.

### 3e. Confirmation against the shipped code — **500/500**

Re-run with every note **read out of the source files**, so the measurement is of the code and not of my
memory of it (the extractor asserts the fixed money note, the new `noTotal`, the removed carve-out, and that
the tool actually emits it — any drift throws).

| Question | Result |
|---|---|
| *what refund requests do we have this week?* | **100/100** |
| ‼️ *…what do they come to in total?* | **100/100** |
| ‼️ *…roughly what is that in dollars?* | **100/100** |
| ‼️ *…just give me one number for the lot, I need the total* | **100/100** |
| ‼️ *add up the refund requests and give me the single total figure, I do not need the breakdown* | **100/100** |

**500/500. The money gate is closed, and no product decision is required.**

### 3f. The old residual text, kept for the record

**Even at D, a direct *"what do they come to in total?"* still produces an invented figure in ~4 of 50 (8%).**
Better than the shipped 9 of 50, but **not zero, and this is money.**

**Prompting cannot close this the rest of the way, and it should not be asked to.** The structural fix is to
give the tool an authoritative total so the model has a correct number to quote instead of a reason to
compute one — but the golden rule forbids returning anything the matching page does not show, and the Refund
requests page shows **no total**. So the real question is a product one:

> **Should the Refund requests page show a total? If it does, the tool can carry it and this residual
> disappears. If it should not, the answer must keep refusing, and ~8% of direct total questions will need
> the refusal to hold.**

**Carried to P4 as an owner decision.** Until it is answered, the residual stands and is stated here rather
than buried.

---

## Gate 4 — Prompt cost and caching

Measured from the live `usage` payload, which reports `cached_tokens` and `cache_write_tokens`.

| | |
|---|---|
| System prompt (base + work rules + roster of 3) | **3,126 characters** |
| Ordering | system → history → new question — **stable-first, append-only**, which is the shape prompt caching needs |

**‼️ One cache hazard identified, NOT yet fixed.** The multi-script SEARCH WORDS block is appended to the
**system** message only when `scripts.IsSingleLeg` is false — i.e. it depends on **the question**. For a
single-alphabet business it never appears and the prefix is perfectly stable. **For a multi-alphabet business
it can appear on one question and not the next, changing the prefix and missing the cache on that turn.**

Moving it into the user turn would fix that — **but its current wording measured 25/25 where it sits (P1.5
Gate 1), so it must not be moved without re-measuring.** Carried to P4.

---

## What changed in the code as a result

| File | Change |
|---|---|
| `BusinessSearchToolNotes.RefundAmountsAreVerbatim` | Names the compliant action when asked for a total |
| `SearchRefundRequestsTool` `["kinds"]` | The *"never total them together"* carve-out removed |

No test pinned either string, so nothing needed updating; the wording is not asserted anywhere, which is
itself worth knowing.
