# ‼️‼️ PHASE 2 COMPLETION GATE — read this before claiming anything is finished

> **Owner instruction, 2026-09-14, recorded verbatim so a compacted context cannot lose it:**
>
> *"once all the task is done, tested, and correct, then you'll start the multidimensional audit. And we
> can't miss this multidimensional audit and fixing all the finding of the multidimensional audit as well.
> And also checking and making sure those fix for those findings of those audit are correct and no bug in it.
> And then and then we'll mark this task as a complete. … do not stop until all of those are done. Quality
> over speed. … Doesn't matter how long it will take."*

## The gate — SIX steps, in order. None may be skipped, reordered, or declared "close enough".

| # | Step | Done when |
|---|---|---|
| **1** | **Every code item built** | The list in `PROGRESS-SESSION2.md` §31.2 is empty, and each item was verified by READING THE CODE, not by trusting a table (§31.5) |
| **2** | **Every item TESTED** | Unit + sabotage for each, and the integration tests E1 and R-5 written |
| **3** | ‼️ **Every item PROVEN LIVE on the CA sandbox** | `LIVE-ACCEPTANCE-2026-09-14.md` has no ⬜ left. A row that genuinely cannot be proven says so, says why, and says what WOULD prove it — it never says ✅. **No assumption. No "it should work".** |
| **4** | ‼️ **THE MULTIDIMENSIONAL AUDIT** | `phase-2\AUDIT.md`, 15 dimensions, covering **all of Phase 2 AND the Phase-1 items handed to it**. Bugs · gaps · missing functionality · logical gaps · regression · sabotage sweep · live pipeline · idempotency · Cosmos/RU · alerts · localisation web **and** mobile · config/ARM/deploy · comments · docs & memory · gaps |
| **5** | ‼️ **EVERY AUDIT FINDING FIXED** | Not triaged, not deferred — fixed, with a test each |
| **6** | ‼️ **EVERY FIX RE-REVIEWED** | A second pass over the fixes themselves: are they correct, do they carry a bug, did any of them break something else. **Only then** is Phase 2 complete |

Then, and only then: mark Phase 2 complete, and produce `PHASE-3-PROMPT.md` **plus its copy-paste starter in chat**.

## ‼️ Standing rules that apply to every step

- **No shortcut. No workaround.** A fix must work for every case, not the one in front of me. The owner has
  twice named "cache it" and "add a test hook" as workarounds and rejected both.
- **Quality over speed, however long it takes.**
- **Nothing is ✅ on a unit test.** Live, on the deployed stamp, with the evidence written down.
- ‼️ **A failed BUILD silently leaves the OLD code running** (§15.1). Before proving anything, run the deploy
  probe in `LIVE-ACCEPTANCE-2026-09-14.md` §0.
- **Every mockup frame is implemented** — `knowledge-document-row-truth`, audited mechanically (§30.1), not
  by eye. A6 was drawn, approved and never built; only reading the sheet against the build found it.

## Where the live state lives

| | |
|---|---|
| The pending list that is actually true | `PROGRESS-SESSION2.md` §31 |
| The live acceptance register | `LIVE-ACCEPTANCE-2026-09-14.md` — 34 rows |
| The owner's decisions | `PROGRESS-SESSION2.md` §32 + §32.1 (all four answered 2026-09-14) |
| The mockup-vs-build audit | `PROGRESS-SESSION2.md` §30 |
| The gotcha file — read BEFORE writing code | `PROGRESS-SESSION2.md` §15 |

---

## ‼️ WHERE THE GATE STANDS — 2026-09-14 08:40 UTC

| # | Step | State |
|---|---|---|
| **1** | Every code item built | ✅ **DONE** — §31.2 is empty |
| **2** | Every item tested | ✅ **DONE** — E1 and R-5 have their integration tests; every suite green |
| **3** | ‼️ Every item PROVEN LIVE | 🟡 **20 of 35 proven · 2 half · 2 on a clock · 1 red (F-7, fixed, needs a deploy) · 10 unreachable, none blank.** The token and the deploy closed six; what is left needs a forced outage, a settings change, or a browser |
| **4** | ‼️ THE MULTIDIMENSIONAL AUDIT | ✅ **DONE** — `AUDIT.md`, 15 dimensions, **7 findings** |
| **5** | ‼️ Every finding fixed | ✅ **7 of 7.** F-6 was put to the owner, answered "one rule, no exceptions", and implemented; F-7 was found by the first live API call the token made possible |
| **6** | ‼️ Every fix re-reviewed | ✅ **DONE** — `AUDIT.md` §6, and it found two more things |

**‼️ Phase 2 is NOT marked complete, and will not be until step 3 closes.** Steps 1, 2, 4, 5 and 6 are DONE.
What is left on step 3 needs things no amount of code can supply from here: a **forced Document Intelligence
outage** (R-5 transient, E2), a **settings change plus a deploy** (X-07), a **browser session** (the four
client-side rules), **two documents sharing one picture** (C7), and **one deploy** to re-run row 5 against
audit fix F-7. **Nothing is waiting on more code.** `HANDOVER.md` §2 lists what unblocks what.
