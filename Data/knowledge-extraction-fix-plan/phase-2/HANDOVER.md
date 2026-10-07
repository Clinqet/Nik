# ‼️ PHASE 2 — HANDOVER (2026-09-14 08:30 UTC)

**Read this first, then `COMPLETION-GATE.md`, then `PROGRESS-SESSION2.md` §15 (the gotcha file) before
writing any code.**

---

## 1. WHERE PHASE 2 STANDS, AGAINST ITS OWN GATE

| Gate step | State |
|---|---|
| **1 — every code item built** | ✅ **DONE.** `PROGRESS-SESSION2.md` §31.2 is empty: E-21 and E-25 were the last two, and the audit added five more fixes on top |
| **2 — every item tested** | ✅ **DONE.** E1 and R-5 owed integration tests and now have them, against real engines. Every suite green: Functions 4,600 · API 12,137 · MCP 919 · Identity 983 · index-setup 195 · web knowledge 429 · mobile knowledge 478 |
| **3 — every item proven LIVE** | 🟡 **14 proven, 2 half, 2 waiting on a clock, 18 unreachable — and no row is blank.** Each unreachable row says why and what would prove it. **11 of the 18 wait on one thing: a fresh refresh token** |
| **4 — the multidimensional audit** | ✅ **DONE.** `AUDIT.md` — 15 dimensions, 6 findings |
| **5 — every finding fixed** | ✅ **5 of 6 fixed**, each with a test and a sabotage that fails it. **F-6 is a decision, not a defect to fix quietly** — §5 of `AUDIT.md` puts it to the owner with the copy written and ready |
| **6 — every fix re-reviewed** | ✅ **DONE.** `AUDIT.md` §6. The re-review found **two more things**: F-5 (a whole new finding) and a bug inside my own F-3 fix |

‼️ **Phase 2 is therefore NOT marked complete**, and the only honest reasons are external: a dead token, a
nightly timer, one owner decision, and a deploy for the audit's own fixes. Nothing is waiting on more code.

---

## 2. ‼️ WHAT THE OWNER CAN UNBLOCK, IN ORDER OF VALUE

| | What | Unblocks |
|---|---|---|
| ~~**1**~~ | ~~A fresh refresh token~~ | ✅ **GIVEN 2026-09-14 11:40.** It turned ⛔ rows green in the first hour (E9.3, D3, C4, U-16-server, D7, P3-A) and **found audit finding F-7 in the first request**. ‼️ **CORRECTION 2026-09-14:** an earlier version of this line also claimed the approved tombstone. It does NOT: register row 31 is still ⛔ with no evidence in the row, and §7 records no tombstone run. It must be re-run (approve ⇒ re-run ⇒ must not return; delete the service ⇒ re-run ⇒ must return). ‼️ The token is in the session scratchpad only, never a repo |
| **2** | **A deploy** carrying the audit's fixes (`f884a49`, `eace2e0`, `680bf3f`, `bab01a0`, `e6c10a4`, `fe8c8bd`, `47f9fde`) | Re-running the **18-format sweep** to confirm G-L1 no longer cries wolf at the sample size that produced the defect, and the **17-fixture replay** (row 33), which is also E12-E's reuse proof |
| **3** | ~~An answer on F-6~~ | ✅ **ANSWERED 2026-09-14: "one rule, no exceptions"** — implemented in `238db07` + `5ede3fc`, three tests corrected, one added, sabotage-proven |
| **4** | **Nothing — just time** | The 03:45 UTC nightly timer settles E9.2 and L-11. ‼️ The DLQ holds **2 messages from 2026-08-18 whose documents no longer exist**, which is exactly the set L-11 removes: both gone tomorrow ⇒ L-11 works; both still there ⇒ the drain is not running |

---

## 3. WHAT CHANGED, IN ONE TABLE

| Item | Where it landed |
|---|---|
| **E-21** the drafts queue's cost | `ab934fe` (infra) · `4d92742` (api) — five COUNTs → one aggregate; approve-all and both dismiss sweeps hand their rows over |
| **E-25** a setting nothing configured | `aeced4d` — plus a second convention test that reads the SOURCE, because the hand-written registry agreed with appsettings while neither agreed with the code |
| **E1 / R-5** the integration tests they owed | `251a377` (api) · `40e2d90` (functions) |
| **E-19** five hand-built readings | `c24652d` · `4aa6fc4` — every reading is `output with { … }`, the artefact banks the count, two guards hold it |
| **G-L1** the false alarm | `e6c10a4` · `fe8c8bd` — a bounded poll, `IndexVisibilityWaitSeconds` |
| **Audit F-1** the unified rule's last exclusion | `680bf3f` |
| **Audit F-2/F-3** the currency alert and the floor markers | `bab01a0` · `47f9fde` |
| **Audit F-5** the notice names what failed | `f884a49` · `eace2e0` |
| **Docs** | `AUDIT.md` (new) · `LIVE-ACCEPTANCE-2026-09-14.md` (36 rows, none blank) · `PROGRESS-SESSION2.md` §15.9/§15.10 (gotchas 14 and 15) · SKILL ×4 §27 |

---

## 4. ‼️ THE FOUR TRAPS, FOR WHOEVER PICKS THIS UP

1. **A source-shape test certifies WORDING, never that the engine will run it.** E-21's aggregate compiled,
   read correctly, passed its text test and **400'd on a real account**. Every new query shape needs the
   emulator test.
2. **A live probe during a deploy measures a BUILD, not a behaviour.** Re-run every negative result on fresh
   content before calling it a defect, and prefer a probe that exercises the new signal and an older one in
   ONE document — a single reading cannot be served by two instances.
3. **A guard that asks a near-real-time store to confirm a write it just accepted must WAIT.** And a guard
   that cries wolf is worse than no guard: it burns the work AND trains the reader.
4. **Read the code against the DECISION, not against its own tests.** Two of six findings were "the owner said
   X, the code does X-minus-one-case", and one guard was pinning the defect it was written to prevent.

Plus the two the sabotage sweep taught: **a sabotage that PASSES is a finding** (it found unreachable code and
a fake drained by a caller nobody had counted), and **`Assert` the actual value out of a deliberately failing
test** rather than trusting a green one when local and live disagree.

---

## 5. ‼️ THE STATE OF THE PROBE BUSINESS (`ZZSALON`)

**It now holds 60 documents against a `MaxDocumentsPerBusiness` of 20.** `kaudit push` writes through the
queue and never sees that gate, so the probes went in freely — but **an API upload for this business will be
refused**, which matters the moment anyone drives the provider app against it.

| Keep — the register cites these by docId | |
|---|---|
| `232fbd22…` `empty2.pdf` | row 1 (E9.1) |
| `809acd6f…` `d8_probe.md` · `b5a8b12d…` `d8_probe_v2.md` | rows 8, 9, 10 (A6, E-12, E-13) |
| `22135fcf…` `d9_floors_v3.md` | row 19 (D9, five outcomes in one file) |
| `4b53d1f9…` `e19_exact.md` · `69c4d8fa…` `e19_artifactprobe.md` | row 21 and §6 (E-19, and the banked count) |
| `359a3e4e…` `e15_overcap.md` | rows 11 and 17 (E-15, P3-A's half) — ‼️ **the only over-cap document on the stamp**, and X-07 needs it |
| `41103149…` and the other 15 `fmt_pricelist.*` | row 28 (the 18-format sweep) and row 5b (the `_di` bank) |
| **Disposable** | every other `e19_*`, `d9_startingfrom`, `d9_floors_v2`, `e96_small`, `batch_1…6` — iterations kept only as the §5.1 narrative, safe to remove with `kaudit delete ca ZZSALON <docId>` |

Clearing the disposable set frees ~20 slots; clearing everything but the cited set would still leave ~24, so
**a Phase-3 session that needs API uploads should either prune deliberately or use a fresh test business.**
‼️ Never `kaudit delete` anything in `SX3SG2`: the 17 fixtures are retained until Phase 4 by owner ruling.
