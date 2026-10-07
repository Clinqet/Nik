# PHASE 3 of 4 — AI Knowledge: findable in every language, and clean

> ‼️ **Rewritten by the Phase-2 session, 2026-09-14.** Read `phase-1\HANDOVER.md`, `phase-1\AUDIT.md`,
> `phase-2\HANDOVER.md` and `phase-2\AUDIT.md` first and treat them as part of this prompt.

## 0.0 ‼️ WHAT PHASE 2 HANDS YOU (read `phase-2\HANDOVER.md` in full — this is the summary)

> Updated 2026-09-14 ~20:00 UTC, at the end of the Phase-2 session. The earlier version of this section was
> written that morning and is superseded on every number below.

> ‼️ **SECOND SESSION, 2026-09-15 — SEVEN MORE DEFECTS, ALL FIXED, ALL PUSHED.** Phase 2 was declared
> code-complete above and then a night of live probing found seven more. Read this list before anything else;
> five of the seven were **invisible** until something was instrumented to say so.
>
> | # | Defect | How it was found |
> |---|---|---|
> | 1 | A timer bound to a setting the Functions HOST cannot read — `TranscriptionVerificationAlertReplay` **had never run once** | surveying all 60 `%bindings%`, not reading the function |
> | 2 | 64 admin alerts for ONE fact — the cooldown keyed by document, the fact being the business's address | §7.5, counting alerts |
> | 3 | §7.7 fixed at ONE of three completion paths; a redelivery still kept the client's declared size | auditing all five Ready paths |
> | 4 | **A timed-out AI call raised NOTHING, anywhere** | two investigations that could not name their own failure |
> | 5 | **X-07: the judge inherited the 90s INTERACTIVE ceiling for a bulk reasoning call** — every judge call timed out, so no document could finish its analytics | bracketing live: 8 candidates ✅ / 60 ❌ |
> | 6 | The typed `HttpClient` capped every per-call deadline at 90s — **the fix for #5 would have been a NO-OP in production** | auditing where the fix actually lands. Unit tests passed anyway (a bare HttpClient defaults to 100s) |
> | 7 | The job budget and the judge ceiling are coupled through three more settings and nothing checked they agreed | doing the arithmetic |
>
> | 8 | **Truncation recovery was OPT-IN and the knowledge path never opted in** — the AI spent all 25,000 tokens *reasoning*, answered with nothing, and the rescue that splits the batch was gated on the last optional parameter, defaulting to off | three live cut-off alerts in one hour |
> | 9 | The draft extractor ran on the **Interactive** lane, which `AiBudgetGovernor` does not pace at all (it returns a no-op lease) — unbounded AI spend the moment several providers upload at once | reading the governor |
>
> ‼️ **#8 IS THE DEFECT CLASS TO HUNT FOR IN PHASE 3: a safety mechanism behind an opt-in optional
> parameter.** No compile error, no failing test, and the integration test that proved the recovery worked
> passed the value EXPLICITLY — so it certified the mechanism, never that callers enable it. The fix was to
> make the default SAFE (the service defaults the floor from its own settings; an explicit 0 is still a
> deliberate opt-out), not to pass it at the one guilty call site. **On this interface every other optional
> parameter means "use the service default" — that one alone meant "switch a safety net off".**
>
> ‼️ **#6 IS THE ONE TO CARRY INTO PHASE 3.** A correct, tested, sabotage-checked fix that production
> configuration silently defeats is worth nothing, and its tests will not tell you — they build their own
> HttpClient. **After fixing a setting, go and check where that setting is actually consumed.**
>
> **And one thing was DELETED rather than fixed:** the verification-alert replay store was 1 of ~115 admin-alert
> sites with its own durability mechanism, its pending store measured **empty**, and it had never saved an alert.
> Owner ruled it unnecessary complexity. **Finding a mechanism broken is not evidence it should exist.**

**Phase 2 is code-complete, audited, and 24 of its 34 live rows are proven on the deployed CA stamp.**
Its multidimensional audit (`phase-2\AUDIT.md`) ran across **15 dimensions** and found **7 findings — all 7
fixed**, each with a test and a sabotage that fails without the fix, and each re-read a second time (§6).
An **eighth defect, F-8, was found LIVE after the audit closed**, fixed the same day, and **proven fixed on the
deployed API**. Nothing from the audit is outstanding.

| Finding | What it was | State |
|---|---|---|
| **F-1** | the unified rule still excluded "read as nothing" | fixed |
| **F-2** | the D-2 currency alert existed only in the reading lane | fixed |
| **F-3** | floor markers matched anywhere in the line (`Hair from root to tip $60` ⇒ "from $60") | fixed — and the re-review found a bug **inside the fix** |
| **F-4** | G-L1 cried wolf at an index one second behind | fixed — **proven conclusively**, see below |
| **F-5** | the widened rule told providers LESS than the lie it replaced | fixed |
| **F-6** | a document refused at the space cap read Failed while its cards answered | owner answered **"one rule, no exceptions"**; implemented |
| **F-7** | one sentence for four situations, telling providers to wait for a document that does not exist | fixed, **proven live** |
| **F-8** | ‼️ a suggestion whose service was soft-deleted could **never** be approved again | fixed, **proven live** |

### ‼️ F-8 is the one to read before you touch anything (`phase-2\AUDIT.md`, register §7.4)

`DeterministicServiceId(businessId, draftId)` is stable, and `DeleteServiceAsync` only SOFT-deletes — the
document survives at `{businessId}_{serviceId}` with `IsDeleted` + a TTL. So re-approving created onto the
surviving document, 409'd, and landed in a catch whose own "did it already exist?" probe is
`GetServiceByIdAsync`, **which hides `IsDeleted` rows**. The recovery could never fire, and the provider was
told *"Try approving it again"* for something that could not succeed until the TTL expired.

**The lesson generalises and you will meet it:** wherever a deterministic id, a soft delete and a create meet,
*the existence check must see exactly what the write collides with.* Ask it of every id you generate.

### What is still open, and what it needs

> Rewritten 2026-09-15 04:00 UTC at the end of the second Phase-2 session. Every line above this that
> describes X-07 or rows 6/7 as open is superseded here.

| Rows | State |
|---|---|
| **27 (X-07)** | ✅ **CLOSED — PROVEN LIVE 2026-09-15 03:21 UTC.** The cause was never the cap: the judge inherited the 90s INTERACTIVE ceiling for a bulk reasoning call. The document that had failed 4/4 returned `Ran`, 210 candidates, 210 drafts, in ~3 minutes on the same settings. See §7.12, §7.14, §7.16 and register row 27 |
| **7 (L-11)** | ✅ **CLOSED — PROVEN LIVE 2026-09-15 03:45 UTC**, watched happening: `dlq=2` all night, `dlq=0` after the sweep, with both documents confirmed already deleted. Also proves `KnowledgeMaintenance__TimerSchedule` IS bound on the deployed app |
| **6 (E9.2)** | 🕐 **BAITED, decisive on the NEXT nightly run.** An orphan source blob with no document row sits at `MEE3IC/1ae59240f6064ba4bc0e812fb331f41e/e92_orphan-20260915-032358-e250b07cb07f.csv` (both halves verified). ‼️ It correctly survived the 2026-09-15 sweep because `UnconfirmedUploadSweepDays` is **1** — only blobs older than a day are taken. **Gone after the next 03:45 ⇒ proven** |
| ~~22 (R-5), 23 (E2)~~ | ✅ CLOSED 2026-09-14 — see §7.8 |
| ~~the replay timer~~ | ✅ CLOSED — **DELETED**, not fixed (§7.15). Nothing to configure; the setting no longer exists. ‼️ The binding SURVEY in gotcha 19 is still the reusable part — run it whenever a trigger is added |
| **29's last rule (U-04)** | a row in **Stopped**; a forced read failure is the likeliest way to make one |
| **2, 4, 12, 13, 15, 26** | Not reachable from a dev machine. Each row states why and what WOULD prove it. **These are proof obligations, not unfixed defects — every one has its code built and unit-tested** |

‼️ **Rows 29, 30 and 33 kept their verdicts but LOST their evidence prose** when the register file was
destroyed and rebuilt (gotcha 17). Re-verify them before relying on them.

### ‼️ HOW TO TEST LIVE — this is the single biggest time-saver Phase 2 found

**The Functions host builds config as `.AddJsonFile(appsettings.json).AddEnvironmentVariables()`, env LAST.**
So **any** setting can be changed on the deployed stamp as a Function App application setting, with **no code
change and no deploy**, and reverted in seconds. Use `__` for `:` —
`Voice__Knowledge__ServiceDrafts__MaxCandidatesPerDocument`. Phase 2 nearly spent two deploys on what one app
setting did. **Never change appsettings.json to test a behaviour.**

‼️ **But the ingest queue is SESSION-ENABLED per business** (`IsSessionsEnabled = true`). Two probes against
the SAME business serialise: a document retrying against a dead endpoint held an analytics ticket queued for
40+ minutes. **One probe per business at a time, or use different businesses.**

### ‼️ Credentials — read this before asking the owner for anything

- **The refresh token is SINGLE-USE, and reuse revokes every session on the account**
  (`AuthService.RefreshTokenAsync`: `if (storedRefreshToken.IsUsed) { RevokeAllOnReuse ⇒ InvalidateRefreshTokensAsync }`).
  The owner's browser usually spends it first. **Ask for a JWT, not a refresh token**, and expect ~1–2 hours.
- **An ADMIN token is a separate ask** and is what reads `/admin/alerts` (a provider token gets 403). That
  endpoint is how F-4 was finally proven — 800 alerts scanned across a window, zero of the offending type
  after the fix, **while other alerts still fired**, so the check was not vacuous.
- Never copy any token into a repo, an appsettings file, a SKILL or a memory entry. Session scratchpad only.

### ‼️ THE TRAPS PHASE 2 PAID FOR — they will be laid again

1. **A source-shape test certifies WORDING, never that the engine will run it.** Cosmos refuses
   `SELECT VALUE { pending: COUNT(1), … }`; the text test was green throughout. **You are changing a SEARCH
   INDEX in this phase** — the same rule applies twice over.
2. **A live probe during a deploy measures a BUILD, not a behaviour.** Re-run every negative on fresh content.
3. **A guard that asks a near-real-time store to confirm a write it just accepted must WAIT.** Azure AI Search
   accepts an upsert and makes it searchable a moment later — and you will be writing to that index.
4. **Read the code against the DECISION, not against its own tests.** Two findings were "the owner said X, the
   code does X-minus-one-case", and one guard was PINNING the defect it was written to prevent.
5. ‼️ **A SABOTAGE THAT PASSES IS A FINDING.** Phase 2's first F-8 test passed with the fix removed — it
   could not tell "revived and rewritten" from "found and shrugged at". Break every half of a fix separately
   and make sure the test fails for each.
6. ‼️ **GREEN CAN MEAN "I COULD NOT LOOK."** `kaudit drift` is hard-capped at 100 rows and reported
   "100 ok" while containing **none** of the 18 documents being tested. Always prove the check saw the thing.
7. ‼️ **READ THE CODE BEFORE FILING A DEFECT.** Two near-misses in one day: a caption that "wasn't reused"
   (reuse is per-document **by design**) and a size guard that "didn't fire" (its window is microseconds
   inside one instance). Both would have been false findings; the source settled both in minutes.
8. ‼️ **NEVER OPEN A FILE FOR WRITING UNTIL THE NEW CONTENT IS BUILT IN MEMORY.** A truncating open plus a
   later exception destroyed the 34-row Phase-2 register outright. `Data\` is **not** a git repository and the
   machine has no shadow copies. Build the whole string, encode it, write a temp file, `os.replace()`.

9. ‼️ **A `%binding%` IS RESOLVED BY THE FUNCTIONS HOST, WHICH CANNOT SEE `appsettings.json`.** A timer
   whose schedule lives only there never starts — and **only that one function** stays dead while the app
   looks perfectly healthy. Phase 2 found one that had never run since it shipped. **Survey every binding in
   one pass** (`grep -rhoP '%[A-Za-z0-9_:.-]+%'` over `Functions/`, then check each against
   `local.settings.json` AND `deploy.ps1`) — 60 bindings, 59 fine, 1 dead. Reading the function you already
   suspect never finds it.
10. ‼️ **"IT IS IN `deploy.ps1`" IS NOT "IT IS SET".** `deploy.ps1` is a script somebody runs; pushing it
   deploys nothing (gotcha 20, the companion to 18). Give the owner **the exact setting name and value**, not
   a task.
11. ‼️ **A CLAMP IS NOT THE VALUE.** `Math.Clamp(_settings.TimeoutSeconds, 1, 3600)` reads like an hour and
   is 25 minutes. **Read the setting, never the clamp beside it.**
11b. ‼️‼️ **READ WHAT THE FAILURE SAYS BEFORE EXPLAINING WHY IT HAPPENED.** Phase 2's last act was very
   nearly shipping a confident, fully-reasoned, **wrong** diagnosis of X-07 — built from a real mechanism
   (the 1500s budget) and even a wall-clock "confirmation" that was coincidence. **The admin alert had named
   the cause the whole time** (`transiently … 444s`), and the token to read it was already in hand. A
   mechanism you can derive is not evidence. **Go and look first.**
12. ‼️ **DIALS ARE COUPLED.** Raising a limit enlarges the work *while the clock stays still* — and the
   work divides by settings you did not touch (`JudgeBatchSize`, `Concurrency`) before it meets the budget.
   Before changing any limit, name every other setting its work divides by and the clock it must fit inside.
13. ‼️ **AN ALERT COOLDOWN MUST BE KEYED BY THE IDENTITY OF THE FACT, not of the run that noticed it.**
   64 alerts for one business's address, because the docId was in the key. **And fix it at the CALL SITE** —
   that key is built by a shared method with 15 callers and the other 14 are correctly per-document.
14. ‼️ **PRESERVE THE BOM.** Python `utf-8-sig` read + `utf-8` write silently strips it; PowerShell 5.1
   then reads the file as ANSI and every `‼️`/`§` in it mojibakes. **Look at `git diff` line 1** after any
   scripted edit.

Everything above is in `phase-2\PROGRESS-SESSION2.md` §15 (gotchas 1–24) in full detail. **Read §15 before
writing code** — it is the file that saves the most time in this programme.

## 0.2 ‼️ THE WORKING NOTES — mechanics that cost real time to learn. Read once, save hours.

### Reuse these instead of rebuilding them
| Tool | Does |
|---|---|
| `tools\api.py` | Drives the CA API as the provider (`MEE3IC`). **Self-refreshing** — a 401 mints a new JWT from the stored refresh token. You never ask the owner for a provider JWT |
| `tools\adminapi.py` | Same, as admin. The admin token IS owner-supplied (no refresh stored) |
| `tools\listblobs.py` | Lists a blob prefix by Shared Key. No azure SDK needed — it signs the request itself |
| `Data\knowledge-extraction-audit\tools\kaudit` | `list · pull · drift · alerts · sql · push · batch · reprocess · delete · measure · indexinfo · wait` |
| `Data\knowledge-extraction-audit\tools\kqueue` | Queue depths + a DLQ peek. `kqueue <queue> peek` also shows ACTIVE/scheduled messages — the fastest way to see which ATTEMPT a retry ladder is on |

See `CANADA-SANDBOX-ACCESS.md` for credentials. **Test businesses:** `MEE3IC` is *Complete Hair & Beauty*
(Salon & Beauty) — the judge correctly REMOVES non-salon lines from it as "not sold here", so a cleaning or
equipment price list returns **0 drafts and that is the judge working**. Match the document to the trade, or
you will debug a non-bug. (This cost a full run.) `ZZSALON` is FULL at 76 documents and **silently discards**
pushes. `SX3SG2` is heavy equipment — never use it for drafts proof.

### Shell and file-writing mechanics on this machine
- **`python` is not on PATH — use `py`.** Set `PYTHONIOENCODING=utf-8` or any heavy-punctuation print crashes.
- ‼️ **NEVER open a file for writing until the new content is built in memory.** A truncating open plus a
  later exception destroyed the 34-row register outright. Build the whole string → temp file → `os.replace()`.
- ‼️ **Preserve the BOM.** Python `utf-8-sig` read + `utf-8` write silently strips it, and PowerShell 5.1 then
  reads `deploy.ps1` as ANSI and mojibakes every accented character. **Look at `git diff` line 1.**
- ‼️ **Normalise line endings before matching.** Anchors containing newlines never match a CRLF file. Decode,
  replace CRLF with LF, edit, restore on write.
- ‼️ **Writing a Python patch script inside a shell heredoc: use a RAW triple-quoted string for any text
  containing Windows paths, and never let the payload contain a triple quote.** A backslash followed by N in
  `C:\Nik` is a unicode-name escape and a hard SyntaxError; a nested triple quote ends the string early.
  Both bit me while writing THIS file.
- **Do not pipe a background command through `tail`** — it buffers until the process exits, so you see
  nothing at all. Redirect to the file and read that.
- **`sed`/`awk` here strip carriage returns**; check `git diff --ignore-cr-at-eol` before believing a diff.
- **kaudit's `sql` deserialises into JObject**, so a scalar `SELECT VALUE COUNT(1)` throws. Alias it instead.

### Live-testing mechanics that will bite you
- ‼️ **Every push to a host repo restarts the Function App.** Batch commits, THEN verify. I lost ~40 minutes
  to my own deploys restarting the host mid-run, leaving messages sitting active with zero deliveries.
- **The knowledge queue is session-serialised per business** (`MEE3IC`, `MEE3IC:analytics`). Two probes on one
  business QUEUE BEHIND each other — they do not run in parallel. One test at a time.
- **A retry ladder is slow and that is normal.** `MaxAttempts` 4 with exponential backoff
  (`RetryBackoffSeconds` 180 doubling each attempt) is ~35+ minutes before a final failure. **Check the queue
  for which attempt is live** before concluding anything is stuck.
- **The analytics job only alerts on the FINAL attempt.** Attempts 1-3 fail silently. Do not wait for an alert
  that cannot come yet.
- **A/B on the SAME document is the strongest proof available here** — re-run its analytics
  (`POST /knowledge/documents/{docId}/rerun-analytics`) after a deploy and compare. Same file, same business,
  same settings, only the build changed. That is how X-07 was closed.

### Things I got WRONG — the reasoning errors, not the typos
1. **I explained a failure from a mechanism I could derive instead of reading what it SAID.** The admin alert
   named the cause the whole time and I had the token to read it. **Go and look first.**
2. **I read meaning into a field that is structurally always zero.** `aiAttemptsSpent` is never written on the
   analytics path. **Check who WRITES a field before interpreting it.**
3. **I trusted a summary table over the rows it summarised** — twice, and it was stale both times.
4. **My passing tests hid a production no-op.** They built their own `HttpClient` (default 100s ceiling), so a
   90s DI-configured ceiling never appeared. **After fixing a setting, go and check where it is CONSUMED.**
5. **I nearly repaired a mechanism instead of asking whether it should exist.** The replay store had never
   saved anything; one blob list answered it. **Ask what it has done for anyone before fixing it.**

## 0. Read these completely before anything else

1. `C:\Nik\CLAUDE.md` (every §0 rule), `PLAN.md`, both earlier handovers and audits.
2. `C:\Nik\Data\knowledge-extraction-audit\FINDINGS-2026-09-10.md` — the owner rulings box at the top, then your scope: **F1–F11, H1, H3, H4, B3**, the cross-check item **X-01** (§9 — Business Search presents AI-written picture descriptions and overviews as the document's own words; the channel label exists on the voice path only), the provider-UI items **U-05, U-06, U-12, U-14, U-15, U-18, U-19, U-20, U-21, U-22, U-23, U-24, U-25** (§10 — web AND mobile in the same session), plus whatever Phases 1–2 deferred to you (their handovers list it). Read `evidence/agent-G-retrieval-index.md`, `evidence/agent-U-provider-ui.md` (the file:line for every U item and the verified-OK list) and `evidence/agent-X-prior-audit-crosscheck.md` (X-01, EX-33) in full. The retained fixture in `SX3SG2` (`PLAN.md` §"Owner rulings") gives you a Gujarati PDF (`4eeae96e…`) and a Gujarati PNG (`6fcd9c32…`) whose cards Phase 1 made identical — your Gujarati retrieval proof runs against them; do not delete them.
3. Skills: `clinqet-voice-assistant` (RUNBOOK — especially "MEASURE THE HYBRID QUERY, NOT A BM25 CURL", `RetrievalTopK` 5→8 rationale, D11b/D11d, the generated synonym map section), `clinqet-business-search` (the provider path's per-alphabet legs — the model for the voice fix), `clinqet-search-discovery` (index conventions; analytics collection must never break), `clinqet-deployment` (index recreate is owner-run per region via `cosmosindexsetup --search-only`; never `--recreate-aliases`).
4. Memory: `knowledge-audit-runbook.md`, `business-search-*` entries, `voice-speak-language-fallback-2026-08-21.md`, the `feedback-*` entries in `PLAN.md`.
5. Code, end to end: `clinqetinfrastructure\Services\Knowledge\ProviderKnowledgeSearchService.cs` + `.Provider.cs`, `MaterialExcerptBuilder.cs`, `MaterialExcerptAssembler.cs`; `clinqetmcp\Clinqet.Mcp\Tools\KnowledgeTools.cs`, `Program.cs`; `clinqetinfrastructure\Services\BusinessSearch\Tools\SearchKnowledgeTool.cs`, `BusinessSearchQueryRenderings.cs`, `BusinessAlphabetService.cs`; `clinqetcore\Utilities\TextScriptDetector.cs`, `Interfaces\BusinessSearch\BusinessSearchScriptPlan.cs`; `clinqetcore\Entities\AISearch\KnowledgeSearchDocument.cs`; `cosmosindexsetup\KnowledgeSearchIndexInitializer.cs`, `SearchAliasInitializer.cs`; `clinqetinfrastructure\Services\Voice\RealtimeSessionPayloadBuilder.cs` (knowledge paragraphs), `FullProviderContextService.cs` (`hasKnowledge`); `clinqetinfrastructure\Services\Documents\QuestPdfService.cs` + `PdfFonts.cs`; `clinqetapi\Clinqet.API\Program.cs` (search client factory); the three hosts' `appsettings.json` `Voice:Knowledge` blocks; `KnowledgeChunker.ApproxTokens` and whatever shared token factor Phase 1 introduced.
6. Tests: `Clinqet.Mcp.UnitTests\**\*Knowledge*`, `Clinqet.API.UnitTests\Services\BusinessSearch\BusinessSearchToolBehaviourTests.cs`, `Clinqet.Communications.UnitTests\Knowledge\KnowledgeSearchIndexer*`, `ProviderKnowledgeSearchServiceTests.cs` and the payload-budget tests, `cosmosindexsetup` index-definition tests.
7. Tools: `C:\Nik\Data\knowledge-extraction-fix-plan\CANADA-SANDBOX-ACCESS.md` (read it fully — the Service Bus connection string is already stored at `C:\Nik\Data\knowledge-extraction-fix-plan\secrets\ca-servicebus.txt` and the tools read it automatically; never copy the value anywhere) and `C:\Nik\Data\knowledge-extraction-audit\tools\kaudit` (extend it with a `probe` command that replays the service's EXACT hybrid query — text + vector + filter — against the live index, per the runbook; the deployed MCP host cannot be probed from a dev machine — `403 Ip Forbidden` — so the replay of the service's own logic is the proof).

## 1. Approval gate — before you change a single line

| Decision | Recommendation |
|---|---|
| **R-8 Voice path multilingual (F1, F2, F3).** Per-alphabet legs on `search_knowledge` merged by card id (the provider path's shape), the missing script blocks (Han, Hiragana/Katakana, Hangul, Thai, Cyrillic, Greek, Hebrew) with "keep the caller's own words as a leg when the script is unknown", and a script-aware token factor shared with the chunker. The tool gains a second argument (the caller's words in their own script) — the realtime prompt changes with it. | Do it; the pieces exist on the provider path. |
| **R-10 Generation isolation (F8).** A filterable `generation` field on the card, written per run, flipped in the Ready CAS, filtered at read time, old generation pruned afterwards. Index schema change ⇒ versioned index + alias swap, owner-run per region. | Worth doing; present the §0.7-style table (field, who reads/writes, cost) and let the owner decide whether it ships in this phase or is deferred to a later programme. |
| **Index version bump.** F11's schema items (non-stored vector, unused facetable/sortable attributes, Indic digit folding via a char filter) can only ship with a new physical index and alias swap. | Bundle them with R-10 if approved; otherwise defer and document. |

Sandbox access is in `CANADA-SANDBOX-ACCESS.md` (no need to ask). Ask the owner only for what is not there: a **provider login for the Canada partner app** so Business Search can be exercised through the real API and the web/mobile citation cards can be seen live, and for the deployment of your code to the Canada stamp when the live proof is ready.

## 2. Scope

F1 + F2 + F3 (per R-8), F4 (one overview card unless the question is a browse; keep D11b/D11d semantics), F5 (retry unnarrowed on `None`, or preference leg), F6 (answerable docIds in the receptionist filter, exactly as the provider path does; keep the post-check), F7 (rank fusion across legs), F8 (per R-10), F9 (embed Noto Bengali/Tamil/Telugu/Arabic; RTL for Arabic script; verify on the deployed OS), F10 (blank endpoint ⇒ null client in the API host, as the MCP host does), F11 (`|` or explicit query syntax + escaping; vector k = window; FAQ edit stamp; ref cap derived from settings + logged truncation; surrogate-safe query cut; orphan `Retrieval*` keys removed per host per §4 of CLAUDE.md; the two stale comments; the missing cited test — add it or drop the citation), H1 (the cross-cutting multilingual list — make the chunker factor, the retrieval budget and the material PDF agree), H3 (every test that pinned a defect fixed in Phases 1–3 has been changed deliberately, not deleted), H4 (SKILL settings list regenerated from the class; parser/indexer comments corrected), B3.
**X-01:** carry the card kind (document text / picture description / generated overview) into the Business Search tool payload and the citation DTO, add the voice path's channel rule to the Business Search system prompt, and render caption/overview citations with a "described by AI" label on web and mobile (mockup gate if the card changes; no schema change — `chunkKind` is already selected). **EX-33 live proof:** an Analyze-API call on the live alias showing the multilingual analyzer on `docTitle`/`content`, or the owner-run rebuild recorded as pending with the exact command.
**Provider UI polish (FINDINGS §10, file:line in `evidence/agent-U-provider-ui.md`; keys in all five files; no technical words; mobile mirrors web):** **U-05** keep the server's per-file refusal sentence on the upload row instead of "Try again"; **U-06** the mobile Knowledge screen surfaces every server sentence (reuse the drafts section's `failureMessage`; stop swallowing the confirm refusal); **U-12** map every accepted extension to a MIME type on mobile; **U-14** decide with the owner whether a new upload/FAQ may default to "Answers & sends" while sending is off; **U-15** the pictures-kept sentence from the registry count, not the live tiles; **U-18** a real hit target on the picture tick; **U-19** full names visible (wrap or title); **U-20** one price-range rule on both platforms and the server; **U-21** loading skeletons on mobile as on web; **U-22** align the copy (no "word for word", no "(s)", same cancel word); **U-23** route constant + client navigation; **U-24** one refresh path; **U-25** honest "Show N more".

**Out of scope:** anything Phases 1–2 own unless their handover deferred it to you.

## 3. Owner's coding standards (verbatim — they apply to every line you write)

# SYSTEM INSTRUCTIONS & CODING STANDARDS
You are an expert Software Architect and Developer. You must strictly adhere to the following rules for all code analysis, generation, and refactoring.
## 🛑 1. CORE DIRECTIVES (THE "ZERO" RULES)
* **Zero Assumptions:** Do not assume context. Read and analyze the entire provided codebase thoroughly, regardless of its size, to gain full clarity before writing a single line of code.
* **Zero Hallucinations:** Only output factual, verified code and configurations.
* **Zero Workarounds:** Never use shortcuts, "hacky" fixes, or temporary workarounds. Apply only industry best practices.
* **Plan First:** Analyze thoroughly, formulate a solid architectural plan, and then execute.
## 🏗️ 2. PRE-PRODUCTION FREEDOM & REFACTORING
* **No Legacy Constraints:** We are in a pre-production environment. We have absolute flexibility.
* **Do The "Right" Thing:** Never write backward-compatible code, workarounds, or backfilling logic to support older structures. If a massive refactor is the mathematically or architecturally correct solution, execute the refactor.
* **State Resets:** Assume data can be dropped and recreated at any time. Focus entirely on the absolute best, fully production-ready end state.
## ⚙️ 3. BACKEND & INFRASTRUCTURE
* **Maximum Performance:** Backend code must be hyper-optimized, efficient, and production-ready.
* **Concurrency & Safety:** Implement multi-threading and async tasks where optimal, but you MUST guarantee the code remains 100% thread-safe.
* **Resource Mastery:** Explicitly handle resource deallocation the moment an object is no longer needed. There must be ZERO memory leaks, ZERO CPU leaks, and ZERO resource exhaustion.
* **Watertight Logic:** Code must have zero gaps and zero bugs. Cover every logical pathway.
## 🖥️ 4. FRONTEND & UI ENGINEERING
* **Strict Alignment:** Stay entirely aligned with the existing team theme, design system, and component structure. Build on top of it; do not deviate.
* **Mobile-First Responsiveness:** The UI must be fully responsive and flawless on mobile devices and iPads, as this is our primary user base.
* **Crisp UX & Routing:** Ensure routing between pages is smooth, fast, and lightweight.
* **API Optimization:** UI code must be solid and flexible. Strictly prevent redundant or duplicate API calls.
* **Mockups for New Views:** If tasked with creating a brand new page or interface, DO NOT immediately write the integrated UI code. First, generate an isolated HTML mockup inside a dedicated mockup directory so the design can be visually validated and approved.
## 🛡️ 5. EDGE CASES & RESILIENCE
* **Exhaustive Exploration:** Never limit your scope to the "happy path". You must anticipate, explore, and handle every possible edge case.
* **Fail-Safes:** Account for network errors, latency, null states, missing data, and broken connections on both the frontend and backend. The solution must survive all of them gracefully.
## 💬 6. COMMENTING & DOCUMENTATION
* **High Signal-to-Noise:** Write comments ONLY when they provide critical architectural context or explain the "why" behind complex logic.
* **No Verbosity:** Absolutely no redundant, obvious, or verbose comments. Let the clean code speak for itself.
## 💡 7. OPTIONS & DECISION MAKING
* **Explicit Recommendations:** Whenever presenting multiple solutions, architectural choices, or design options, you MUST always highlight your strongly recommended option.
* **Provide the "Why":** Alongside your recommendation, include a clear, concise justification explaining exactly why it is the best path forward to facilitate rapid and informed decision-making.

QUALITY OVER SPEED. Never break analytics collection; never `--recreate-aliases`; an index field is permanent once shipped.

## 4. Method

1. Design the multilingual retrieval as ONE contract shared by voice and provider paths (renderings → legs → fusion → gates → trim), then map both callers onto it. Get the R-decisions approved.
2. Implement with existing patterns; every new setting mirrors `appsettings.json` and lives only in the hosts that read it; every `IMemoryCache` write has `Size = 1`.
3. **Tests (§0.8):** MCP host tests for the voice path (`Clinqet.Mcp.UnitTests`), API host tests for Business Search, indexer tests for any write change; the payload-budget measurement test the settings comment cites; red→green then sabotage. 100% green. No builds while another session works.
4. **Live proof — mandatory:** use the retained Gujarati fixture documents in `SX3SG2` (`4eeae96e1e0549538283705897ca3bc0` PDF, `6fcd9c32ee6e4c8397c7babc7121a462` PNG — a Gujarati caller asking for the haircut price must get `₹250` from BOTH) and upload a Hindi policy, a Chinese menu and a Tamil flyer to a Canada test business; replay the receptionist's exact hybrid query for caller phrasings in each language and in English and show the right value on the TOP card; ask Business Search a question whose best card is a picture description and show the answer labels it as AI-written on web and mobile (X-01); replay browse questions and show the overview card is present but no longer force-seated three times; measure real token counts of the trimmed payload with the model's own usage numbers for each script and show the budget holds; render the material PDF for each and open it (no boxes, RTL correct); verify F6 with a large "Not used" document beside a small answerable one; if R-10 shipped, reprocess a document while replaying queries every 10 s and show the previous version keeps answering until the new one is whole. Delete every test document YOU created through the real purger and confirm — the 17 fixture documents in `SX3SG2` stay for Phase 4 (owner ruling).
5. Clean up (§0.16); SKILL ×4 (`clinqet-voice-assistant`, `clinqet-business-search`, `clinqet-search-discovery` where touched); memory entry `knowledge-extraction-fix-phase3-<date>.md` + `MEMORY.md` line; mark the phase-3 row in `PLAN.md`.

## 5. Phase-3 multidimensional audit (the phase is not complete without it)

Write `phase-3\AUDIT.md`: finding closure per id; regression (every knowledge suite in all hosts green; the Phase-1 corpus cards unchanged; the 69-case table harness green); adversarial live probes invented after implementing (mixed-script question, a code like `TL1255` in Devanagari context, a caller in French for a Gujarati document, an emoji-terminated 200-char question); sabotage sweep; latency (every voice query under `RetrievalTimeoutMs` with legs measured); cost (embedding calls per query per business alphabet count; RU); security/tenancy (scope clause still leads every request; row-level verification intact); analytics collection untouched; config/deploy hygiene (index version + alias documented as owner-run; orphan keys gone); comments; docs & memory; gaps left for Phase 4.

## 6. Handover — the last thing you do (none of it optional)

1. Write `C:\Nik\Data\knowledge-extraction-fix-plan\phase-3\HANDOVER.md`: what changed, file by file; what was deferred and why; where the evidence is; open questions for the closing audit.
2. **Rewrite `C:\Nik\Data\knowledge-extraction-fix-plan\PHASE-4-FINAL-AUDIT-PROMPT.md`** (replace the draft; remove its "DRAFT" header) so that Phase 4 is self-contained and keeps its skeleton — nothing dropped: **§0** read-first list (CLAUDE.md, `PLAN.md`, FINDINGS with §7–§10, all three `HANDOVER.md` + `AUDIT.md`, skills, memory, every file the phases touched AND the whole knowledge path, tools, `CANADA-SANDBOX-ACCESS.md`) · **§1** the closing-audit method (the dimensions A–J, prove by execution on the retained fixture and real documents, the adversarial pass, fix what it finds, then delete the fixture) · **§2** the owner's coding standards block above, verbatim, with "QUALITY OVER SPEED" · **§3** deliverables · **§4** the closing multidimensional self-audit of whatever Phase 4 itself fixes, and the instruction that Phase 4 produces no next prompt — it closes the programme with the final report in the chat.
3. **Paste a copy-paste STARTER for the Phase-4 session in the chat**, in this order: **(1)** the path `C:\Nik\Data\knowledge-extraction-fix-plan\PHASE-4-FINAL-AUDIT-PROMPT.md` and the instruction to read it completely, then `PLAN.md`, FINDINGS and all three `HANDOVER.md` + `AUDIT.md`, before doing anything else; **(2)** the basic details — what Phases 1–3 changed and proved, what each deferred and why, where the evidence lives, what still needs an owner decision, the fixture rule (Phase 4 re-runs the 17 documents one last time and then deletes them), and that sandbox access is in `CANADA-SANDBOX-ACCESS.md`; **(3)** the explicit requirement that Phase 4 is the end-to-end multidimensional audit of all four phases and of the whole pipeline, fixes what it finds, self-audits its own fixes, and closes the programme (no next prompt); **(4)** the owner's coding standards block above, verbatim, followed by "QUALITY OVER SPEED".
4. Report honestly what is verified (counts, file paths, docIds) and what is not, and what the owner must deploy, run or decide.
