# ‼️ PHASE 2 — THE MULTIDIMENSIONAL AUDIT (2026-09-14)

> **Owner instruction, recorded verbatim in `COMPLETION-GATE.md`:** *"once all the task is done, tested, and
> correct, then you'll start the multidimensional audit. And we can't miss this multidimensional audit and
> fixing all the finding of the multidimensional audit as well. And also checking and making sure those fix
> for those findings of those audit are correct and no bug in it."*

**Scope:** every Phase-2 change across three sessions, **and** the Phase-1 items handed to Phase 2
(D10, E1/F-01, X-02, `.csv`, X-05, X-07, G-L1, L-9, L-10, L-11). **210 files** across seven repositories,
`2026-09-13 12:00` → `2026-09-14 08:00`.

**Method:** fifteen dimensions, each with its own instrument. Where a dimension has a mechanical check, the
check was RUN and its output is quoted. Where it does not, the code was read against the decision it
implements. ‼️ **Nothing in this document is "looks fine"** — a dimension either names what was run, or names
what it could not reach and why.

---

## 0. RESULT

| | |
|---|---|
| **Findings** | **7** |
| **Fixed** | **7 — every one**, with a test each and a sabotage that fails it |
| **Owner decisions taken** | **1** — F-6 was put to the owner and answered **"one rule, no exceptions"** (§5); implemented |
| Dimensions clean on first inspection | 10 of 15 |

Two of the seven are **money defects**, three are **owner decisions not fully implemented**, one is **a guard
that cried wolf at a live batch**, and one is **a sentence that told providers to wait for something that will
never happen**. None was findable by the tests that existed: two came from reading the code against the
DECISION rather than against itself, one from reading the alerts a live run produced, one from asking what a
rule does to inputs nobody had written a case for, one from re-reviewing the first fix, and one from calling
the real endpoint the minute a token arrived.

---

## 1. ‼️ THE FINDINGS

### F-1 — D-1 said EVERY terminal failure, and one was still excluded ‼️ CRITICAL

| | |
|---|---|
| **Dimension** | Logical gaps · owner decisions |
| **Where** | `KnowledgeIngestProcessorFunction.FailAsync` |
| **Found by** | Reading the implementation against the owner's words, not against its own tests |

`FailAsync` excluded `Error_KnowledgeNoReadableContent` from the unified rule. The reasoning written beside it
was that reading as nothing is "a statement about the FILE" — which it is, about the file that **just
arrived**, which is exactly what A6 was drawn for. What the exclusion actually produced on a document that
still had live cards was:

```
status = Failed      passageCount = 7      seven cards still answering callers
```

The row said *"Not read"* while the receptionist answered from it, and the provider had no way to learn
either fact. **That is the shape D-1 exists to end**, and the owner's decision admits no exception:

> *"ONE rule for every terminal failure on a document whose cards still answer: Ready + a notice naming what
> failed. A6 becomes an instance of it rather than a special case beside it."*

‼️ **The guard was pinning the defect.** `H12_ADocumentWithNoPicturesAndNoText_IsStillFailedTerminally` set
`PassageCount = 7` and asserted Failed. A rule written before a decision does not get to outlive it.

**Fixed** (`680bf3f`): the exclusion is gone. H12's real content is intact and pinned — a document with
NOTHING to fall back on still fails honestly, with its reason and no notice — and the other half is pinned
beside it: live cards ⇒ Ready, the answering version kept, `Info_KnowledgeReplacementKeptPrevious`.
A first upload is excluded by the `passageCount > 0` condition itself, so nothing about an honest
"we could not read this file" changed. **Sabotage:** restoring the exclusion fails the second test.

‼️ **This also closes §30.4**, the one open state the mockup audit found and would not decide unilaterally.

### F-2 — a currency nobody could work out, and nobody was told ‼️ HIGH

| | |
|---|---|
| **Dimension** | Alerts · owner decisions |
| **Where** | `KnowledgeDraftApprovalService.ApproveCoreAsync` |
| **Found by** | Tracing every caller of `KnownPrimaryCurrency` |

D-2 was answered with an addition the owner emphasised: *"an admin alert whenever a country cannot be
resolved, with its own type — we cant miss that it is must and important"*. The alert was built in the
**reading** lane (`KnowledgeBusinessCurrencyUnknown`, on the analytics job) and nowhere else. Approve is the
moment the same silence becomes **durable catalogue data** — a service row written with no currency at all —
which is a different consequence, and "whenever" does not admit a quiet one.

**Fixed** (`bab01a0`, `47f9fde`): approve raises its own alert naming the business, the draft and the
unrecognised country string. The alert cooldown collapses a batch of approvals into one, and a business the
runtime CAN place stays silent — **noise is how a real alert stops being read**, so that half is pinned too.
**Sabotage:** removing the alert fails the first test and leaves the second green.

### F-3 — the floor markers turned flat prices into open-ended ones ‼️ HIGH

| | |
|---|---|
| **Dimension** | Bugs · money |
| **Where** | `KnowledgeServiceDraftBuilder.TheDocumentSaysStartingFrom` |
| **Found by** | Asking what the rule does to inputs nobody had written a case for |

The floor words were matched **anywhere in the line**:

```csharp
foreach (var marker in StartingFromMarkers)
    if (line.Contains(marker, StringComparison.Ordinal)) return true;
```

So a salon menu reading `Hair from root to tip $60` was about to show a card saying **"from $60"**, and
`Deep tissue and upper back $80` the same. D9 exists to stop the provider's own document being contradicted
about money; contradicting it in the other direction is not an improvement, and `and up` matching inside
`and upper` / `and upkeep` is not a rare shape in a real price list.

**Fixed** (`bab01a0`): a price list writes the marker **hard against the amount**, and on a particular SIDE of
it — `from $60` before, `$60 and up` after. Each list is matched only on its own side, as a whole word, with
the trailing markers required to END the entry so `$60 and up to 3 hours` stays a sentence about duration.
Five false-positive cases pinned, three more real floors added. **Sabotage:** restoring contains-anywhere
fails `Hair from root to tip $60`.

### F-4 — G-L1 cried wolf at an index that was a second behind ‼️ HIGH

| | |
|---|---|
| **Dimension** | Live pipeline · alerts |
| **Where** | `KnowledgeIngestProcessorFunction.EnsureTheIndexTookThemAsync` |
| **Found by** | Reading the admin alerts the 18-format live sweep produced |

Five of sixteen documents raised *"The index still holds nothing … after 3 card(s) were written TWICE. The
document was NOT marked Ready"* — and **every one of them is Ready and correctly indexed.** `CountCardsAsync`
is a SEARCH; Azure AI Search accepts an upsert and makes the cards searchable a moment later, so counting in
that same instant can legitimately answer zero.

Cost of the false alarm: a complete reading discarded and re-paid (Document Intelligence, vision,
embeddings), a High alert per document, and — worst — the real signal trained away.

**Fixed** (`e6c10a4`, `fe8c8bd`): a bounded poll (250 ms doubling to 2 s, ceiling
`Voice:Knowledge:IndexVisibilityWaitSeconds` = 15) before concluding anything. The common case returns on the
FIRST look and costs exactly what it did before. **Sabotage:** restoring the single look fails the
wait test. ‼️ Its test is keyed on **time**, not on a call count, because the overflow gate counts the same
document and would drain a queued answer — the trap §15.8's gotcha 13 already records.

### F-5 — the widened rule told providers LESS than the lie it replaced ‼️ HIGH

| | |
|---|---|
| **Dimension** | Logical gaps · localisation |
| **Where** | `FailAsync` → `KeepTheAnsweringVersionAsync`, and the five catalogues |
| **Found by** | Re-reviewing F-1 — enumerating every terminal reason the widened rule now catches |

D-1's words are *"Ready + a notice **naming what failed**"*. The notice said one thing:

> *"The new file you uploaded couldn't be read, so we kept the one you already had."*

Three refusals reach it that are **not** "couldn't be read": `Error_KnowledgeTooManyPages` (3 sites),
`Error_KnowledgeTooManyCharacters` (the OpenXML ceiling) and `Error_KnowledgeUnsupportedFormat`. Before D-1
those rows stamped their own reason key and the screen said *"too many pages"*. **After D-1 the provider
learned LESS than the old lie had told them** — and would upload the same 400-page file again.

**Fixed** (`f884a49`, `eace2e0`): the reason chooses the sentence. Two new keys in all five catalogues, one
for a replacement and one for a re-read, saying the file is too long and to split it. An unknown reason still
reads as unreadable, which is the honest default. ‼️ **The two A6 tests were themselves page-cap scenarios
asserting the generic sentence** — they now assert the one that matches what they do. **Sabotage:** routing
the caps back to the generic sentence fails the new test.

### F-6 — a refused document reads Failed while it answers ✅ OWNER ANSWERED, IMPLEMENTED

| | |
|---|---|
| **Dimension** | Logical gaps |
| **Where** | `FailAsync`.s `refusedDeliberately` boundary |
| **Status** | ✅ **Put to the owner, answered "one rule, no exceptions", implemented.** See §5 for the question and §8 for what shipped |

### F-7 — one sentence for four situations, and only two of them are "wait" ‼️ MEDIUM

| | |
|---|---|
| **Dimension** | Bugs · localisation |
| **Where** | `KnowledgeController` grant + confirm, `KnowledgeManagementService` |
| **Found by** | ‼️ Calling the real endpoint the minute the owner.s token arrived — it took one request. See §7 |

---

## 2. THE FIFTEEN DIMENSIONS

| # | Dimension | Instrument | Result |
|---|---|---|---|
| 1 | **Bugs** | every Phase-2 change read against the decision it implements | **F-1, F-3** |
| 2 | **Gaps** | the Phase-2 item list (30 items) checked for code or a recorded disposition | clean — `R-7`, `R-11`, `X-05` show no code reference because they were **answered** or **closed by removal**, which §24.1 and PROGRESS §134 record |
| 3 | **Missing functionality** | the mockup sweep of §30.1, re-run on the two frames the owner asked about | clean — **Download is on BOTH apps** behind the §B3/B4 confirm (`KnowledgePage.jsx:774`, `Knowledge/index.tsx:1098`), including the previous-version variant |
| 4 | **Logical gaps** | composition traced end to end for every new shape | **F-1**; and D9's open-ended range **verified clean** through four layers — `IsDraftPriceIncomplete` allows a range with no maximum, `resolveMissingPriceField` never asks for one, `IsPricingUsable` accepts it, the catalogue stores it |
| 5 | **Regression** | every suite in every repository | clean — API 12,137 · Functions 4,599 · MCP 919 · Identity 983 · index-setup 195 · web knowledge 429 · mobile knowledge 478 · the integration suites for both hosts |
| 6 | **Sabotage sweep** | every guard this phase added, broken deliberately | clean — 11 sabotages run, each failing exactly its own guard. ‼️ TWO sabotages **passed** and both taught something: one proved I had broken dead code (`!wantFigures` is unreachable), the other that a call-count fake is drained by the overflow gate |
| 7 | **Live pipeline** | `LIVE-ACCEPTANCE-2026-09-14.md` | **14 rows proven live**, 2 half, 2 waiting on the nightly timer, 18 unreachable with the reason and the unlock named. **No row is blank.** F-4 was found here |
| 8 | **Idempotency** | every new write path re-entered | clean — the cache overwrites one blob, the index check re-upserts once, `KeepTheAnsweringVersionAsync` removes-then-adds so a notice never stacks, the E-21 hand-over is CAS-guarded and a conflict re-reads |
| 9 | **Cosmos / RU** | every knowledge query | clean — **15 of 15 iterators partition-scoped**, five COUNTs became one aggregate, approve-all and both dismiss sweeps no longer re-read rows they hold |
| 10 | **Alerts** | every new failure path | **F-2, F-4** |
| 11 | **Localisation (web AND mobile)** | all five catalogues, three surfaces | clean — **51 of 51** backend knowledge keys in en/es/fr/gu/hi; web `localeParity` 12 green; mobile `localeParity` + `sourceLocalizationIntegrity` 30 green |
| 12 | **Config / ARM / deploy** | both hosts' settings convention tests | clean — Functions 69 and API 321 convention tests green. The one new key (`IndexVisibilityWaitSeconds`) is in the Functions appsettings with a matching class default; it is not a `local.settings.json` key, so §4 needs no ARM entry |
| 13 | **Comments (§0.14)** | the whole phase diff | clean — **zero** commented-out code added; one duplicated line removed in `KeepTheAnsweringVersionAsync` |
| 14 | **Docs & memory (§0.9)** | the SKILLs ×4 and the memory index | fixed during the audit — `clinqet-business-search` §27 now carries all ten Phase-2 items and the three method lessons; `clinqet-voice-assistant` carries the Approved state, the 43 settings keys and the E-21 shapes. All four copies byte-identical |
| 15 | **Gaps (catch-all)** | `IMemoryCache` sizes · disposal · thread safety | clean — **no cache write added this phase** (the `Size = 1` convention test scans all backend source and is green); every new stream is `await using`; the bounded poll honours its token |

---

## 3. ‼️ WHAT THE AUDIT ALSO CONFIRMED — things that could have been findings and are not

These were checked because they LOOK like defects, and writing down that they are not is worth as much as a
finding: it stops the next session re-deriving them.

| Checked | Verdict |
|---|---|
| **A non-session receive on a session-required queue's dead-letter** | ‼️ **Suspected, probed, DISPROVED.** `knowledge-ingest` is `requiresSession: true`, and `DrainDeadLetterAsync` opens a plain receiver. A probe against the real service (`kqueue … receiveprobe`) answered **`RECEIVE ok: 1 message(s)`** — the dead-letter sub-queue accepts a non-session receive. A fix shipped on my recollection would have been wrong |
| **E-21 hands a possibly-stale row to a writer** | Safe by construction: approve's success path tombstones with an **unconditional** upsert and its failure path RE-READS before stamping; dismiss's CAS rejects a stale row and the retry re-reads. Proved against the real emulator — a query-loaded row carries the `_etag`, writes once, and the second holder conflicts |
| **`DismissByKindAsync` now holds up to 2,000 full rows** | A considered trade: ~6 MB transient on a rare provider action against **2,000 point reads** removed. The rows were already materialised by the page walk; only their retention changed |
| **The approve/dismiss race widened by the hand-over** | Pre-existing and unchanged in KIND. The dominant window has always been the write itself (a taxonomy resolve plus a service write), not the read; the deterministic service id makes a double approve converge, and `DismissCoreAsync` refuses to downgrade an Approved tombstone |
| **D9's open-ended range** | Verified through four layers (see dimension 4). Nothing asks the provider to invent a maximum their file never gave |
| **The `_di` bank outliving its document** | Purged — `KnowledgeDocumentDataPurger` deletes it beside the content artefact, with the reason stated: *"a cache of the provider's own file — leaving it behind is the same lie as leaving the source"* |

---

## 4. ‼️ THE METHOD LESSONS (they belong in the next phase's prompt)

1. **Read the code against the DECISION, not against its own tests.** F-1 and F-2 were both "the owner said
   X; the code does X-minus-one-case". No suite can find that, because the suite was written from the code.
2. **Read the alerts a live run produces, not just its rows.** F-4 was sitting in the admin alerts of a sweep
   whose documents all looked perfect.
3. **Ask what a rule does to inputs nobody wrote a case for.** F-3 came from one question: *what else contains
   the word "from"?*
4. **Probe before fixing.** The session-queue theory was confident, specific, and wrong. Two minutes of
   `receiveprobe` beat an afternoon of a wrong fix.
5. **A sabotage that PASSES is a finding about the test, and sometimes about the code** — it found unreachable
   code in `ExtractAsync` and a fake drained by a caller nobody had counted.

---

## 5. ‼️ F-6 — THE ONE DECISION THIS AUDIT WILL NOT TAKE ALONE

**The observation.** A document whose cards are live is refused at the **searchable-space cap** or the
**character cap**. The row is stamped **Failed** while those cards go on answering callers. That is the same
shape D-1 removes everywhere else: the status word says the document does not answer, and it does.

**Why it is not simply fixed.** Two reasons, and both are real:

1. ‼️ **A limit refusal is a DESIGNED state on the approved sheet.** The sheet draws it and writes its copy —
   *"delete something to make room"*. Turning it into a Ready row with a notice changes a frame the owner
   approved, which §0.7.1's mockup gate exists to stop me doing on my own.
2. ‼️ **D-1 was answered about a different question.** It was asked about a REPLACEMENT that could not be read
   and a REPROCESS that failed — a reading that did not work. A refusal at a limit is not a reading that
   failed; it is the system declining before it starts.

**What implementing it looked like** (done, measured, then backed out): the condition loses
`!refusedDeliberately`, two more sentences join the catalogues, and **five existing tests fail** — three of
which pin the refusal contract directly. Five tests pinning the opposite is not one stale rule; it is a
contract someone affirmed repeatedly.

**The copy is ready if the answer is yes** (it was written, validated in all five languages, and removed
again rather than left as an orphan key):

> **Replacement:** *"There is no room left for a new file, so we kept the one you already had. Callers are
> still being answered from it. Delete a file you no longer need, then upload this one again."*
> **Re-read:** *"There is no room left to read this file again, so we kept the version you already had.
> Callers are still being answered from it. Delete a file you no longer need, then try again."*

| If the owner says | The change |
|---|---|
| **Yes — one rule, no exceptions** | Delete `&& !refusedDeliberately` from `FailAsync`, re-add the two sentences, and update the five tests that pin Failed for a refusal. ~30 minutes |
| **No — a limit must be the loud word** | Nothing to do. The boundary and this reasoning are already written beside the code |

‼️ **Either answer is defensible and the code says so.** What was NOT acceptable was leaving the question
undiscovered, which is what the first pass did with §30.4 — and the owner had already answered that one.

---

## 6. ‼️ THE RE-REVIEW (gate step 6) — every fix read a second time

Each fix was re-read asking three questions: is it correct, does it carry a bug of its own, did it break
something else. **Two of the five fixes had something to answer for, and both were dealt with.**

| Fix | Re-review | Outcome |
|---|---|---|
| **F-1** (the widened rule) | Enumerated **all seven terminal reasons** against the rule: which stay Failed, which now go Ready, and what each tells the provider | ‼️ **Found F-5** — three reasons were being given the wrong sentence. Fixed |
| **F-2** (the currency alert) | Checked every other `KnownPrimaryCurrency` caller (`McpService`, `ProviderSetupProfileService`, approve-update) | The reading lane and approve now alert; the receptionist and profile-setup readers only READ a currency, they do not write one, so they are covered by the two writers that do |
| **F-3** (marker adjacency) | Asked what the price search does when the amount appears inside a longer number | ‼️ **Found a bug in my own fix** — `IndexOf("500")` matches inside `1500`. Fixed with a whole-number search, and the comment says honestly that the shape is not reachable through today's detector |
| **F-4** (the bounded poll) | Walked the boundary values: 0, negative, an index that never answers, a cancelled token | Correct — 0 costs exactly one count (so every existing test is unchanged), negative is clamped, a dead index costs 2 × the ceiling against a 1,800 s budget, and the delay honours the token |
| **F-5** (the sentence) | Checked what an UNKNOWN reason key does, and whether any app change is needed | Correct — unknown reads as unreadable, and `KnowledgeReadingNoticeDto` carries **finished sentences**, so no app change is needed for a new key |

**And the suites after every fix:** Functions unit **4,600**, API unit **12,137**, MCP **919**, Identity
**983**, index-setup **195**, web knowledge **429**, mobile knowledge **478** — all green, plus the
integration suites for both hosts.

---

## 7. ‼️ F-7 — ONE SENTENCE FOR FOUR SITUATIONS, AND ONLY TWO OF THEM ARE "WAIT"

**Found 2026-09-14 11:45 UTC, by running the real endpoint with the owner's token** — the first thing the
token made possible, and it found a defect in the first minute.

Asking to replace a document that does not exist answered:

> *"'menu.csv' can't replace that document right now — wait until it finishes processing."*

The document does not exist. **Nothing will ever finish.** One sentence covered four situations —

| Situation | Is "wait" the answer? |
|---|---|
| The docId never existed, or the document was deleted in another tab | ❌ it will never finish |
| It is a typed FAQ, not a file | ❌ it will never become one |
| It is `Processing` someone else's file | ✅ |
| It is `Deleting` | ✅ it is finishing something |

**Fixed** (`8bb9b55` core, `238db07` infra, `03142b2` api): `KnowledgeReplaceTargetException` carries whether
the target is BUSY, both the grant and the confirm choose the sentence from it, and a gone target gets its own
in five languages — *"'{0}' can't replace that document — it isn't there any more. Upload it as a new file
instead."* Three existing tests now name the busy case they actually set up; three new ones cover gone,
not-a-file and the confirm path.

---

## 8. ‼️ F-6 — THE OWNER ANSWERED: ONE RULE, NO EXCEPTIONS

> *"I will go with your recommendation but remember no shortcut and workaround and all the audit finding
> should be fixed and those should be fully fully checked as well"* — owner, 2026-09-14

**Implemented** (`238db07` infra, `5ede3fc` functions). The `refusedDeliberately` boundary is gone: a document
whose cards still answer is **Ready with a notice**, whatever refused the incoming file — including the
searchable-space cap and the character cap. Two sentences in five languages carry the instruction
(*"…Delete a file you no longer need, then upload this one again."*), so nothing about the refusal is
softened; what changed is the status word beside it, which now tells the truth.

**Three tests asserted the old shape and each now asserts the true one** — including
`Overflow_BeyondGrace_LeavesThePreviouslyIndexedVersionAlone`, which was asserting **Failed about a document
with forty live cards**. A fourth test was added for the half that does NOT change: a FIRST upload with
nothing to fall back on still fails with the reason the provider must act on, because the rule is about
documents that ANSWER, not about limits. **Sabotage:** restoring the boundary fails both the new test and the
overflow one.

---

## 9. THE FINAL TALLY

| | |
|---|---|
| Findings | **7** |
| Fixed | **7** |
| Sabotage-verified | **7** (11 sabotages run in total across the phase; 2 passed and both taught something) |
| Suites after the last fix | Functions **4,605** · API **12,186** · MCP 919 · Identity 983 · index-setup 195 · web knowledge 429 · mobile knowledge 478 — all green |
| Proven live afterwards | F-1 (a whitespace replacement leaves a Ready row answering) · F-4 (a 16-file burst, zero false alarms where five fired before) · F-2 (correctly silent on a resolvable country) |
