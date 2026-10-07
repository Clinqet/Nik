# Business Search — SESSION STATE / HANDOVER (read this first)

> ‼️ **The feature is named `BusinessSearch`**, route `api/v{version:apiVersion}/business/search`, user-facing
> label **"Ask Clinket"**. It was called "Provider AI Search" during research — that name is RETIRED, because
> `ProviderSearch*` already means the CUSTOMER-side "search for providers" feature (218 references). The folder
> and the mockup filename keep the old word for continuity; nothing in code should.
>
> Programme folder: `C:\Nik\Data\provider-ai-search\`. Last updated 2026-09-03.

## 0. Where things stand — P1 + P1.5 ARE BUILT, GREEN AND AUDITED; **P2 IS IN PROGRESS**

| # | Item | State |
|---|---|---|
| 1 | Owner's ask, verbatim + the 2026-09-02 feedback | `00-ORIGINAL-PROMPT.md` |
| 2 | Research — 11 evidence files | `findings/A` … `findings/K` — all complete, no banners, every claim cited `path:line` |
| 3 | The plan | **`PLAN.md` v3** — ONE project, 5 phases, a multi-dimensional audit closing every phase |
| 4 | ‼️ The authorization design | **`AUTHORIZATION-DESIGN.md`** — golden rule, threat model (14 threats), 6 rejected alternatives, every edge case incl. the solo provider, 12 owed tests |
| 5 | ‼️ The mockups | **`PLAN.md` §0 — THE MOCKUP REGISTER** is the list, and `CLAUDE.md` §0.20 fixes the home: **`C:\Nik\Data\mockups\`**, nowhere else. **M1** `C:\Nik\Data\mockups\business-search-page` v3 (the page, its core states, header **A**, the team-search box) · **M2** `C:\Nik\Data\mockups\business-search-sources` (source cards; nothing is downloadable) · **M3** `C:\Nik\Data\mockups\business-search-voice` (the microphone) · **M4** `C:\Nik\Data\mockups\business-search-states` (the eleven states the others left out). ‼️ A sheet in no register is LOST, not approved |
| 6 | Owner decisions | **ALL LOCKED** — see `PLAN.md` §15. Nothing is open. |
| 7 | Model | **`gpt-5.6-luna` @ `reasoning_effort: none`**, chosen on live measurement (`findings/K`) |
| 8 | Phase prompts | `PHASE-1-PROMPT.md` · `PHASE-1-PART-2-PROMPT.md` · **`PHASE-2-PROMPT.md` + its P1.5 DELTA (current)** · ‼️ **`CARRIED-TO-P3.md` is REQUIRED scope for P3** |
| 9 | Code written | ‼️ **P1 (whole backend) and P1.5 (voice input + multi-script retrieval) are BUILT, GREEN and AUDITED** — `findings/AUDIT-P1-2026-09-02.md`, `findings/AUDIT-P1.5-2026-09-03.md`. **P2 (both UIs) is in progress.** The owner pushes and deploys; nothing here is ever committed |

### The six phases — one session each, each ending with its own audit and the next session's prompt
1. **P1** backend foundation + delete the dormant `/ai/chat` assistant
1b. ‼️ **P1.5 voice input + transcription-engine consolidation** (`PLAN.md` §18, `PHASE-1-PART-2-PROMPT.md`) —
    added 2026-09-02. Runs **after P1, before P2**: it edits `SpeechService`, a shared service P1 leaves alone
    and provider mobile already depends on. Engine → Azure Speech **Fast Transcription** (2.8× cheaper than
    today's real-time SDK). ‼️ `ai/speech-to-text` is **consolidated, never deleted** — mobile uses it in four
    places. ‼️ Locale is **always explicit**; auto-detect is capped at 4 languages and excludes **Gujarati**.
2. **P2** web **and** mobile UI together (the owner's standing rule: mobile never lags web)
3. **P3** team answers end to end (permissions, narrowing, refusals)
4. **P4** document audience end to end (the one approved new Cosmos field)
5. **P5** whole-programme adversarial audit + SKILL ×4 + MEMORY + the deploy order

## 0b. CLEARED — the concurrent vision/OCR work is finished and committed (2026-09-02, owner-confirmed)

Earlier in the day another tool/session held 12 uncommitted files in the vision/OCR path, which overlapped the
"Show page N" citation design. **That work is now DONE and committed** (owner-confirmed and verified here):
`git status --porcelain` is empty in all eleven repos, at fresh HEADs — `clinqetcore 05957a7`,
`clinqetinfrastructure c038d6e`, `clinqetapi 6c908f9`, `clinqetmcp fcfac97`, `clinqetfuncations 8eb8460`,
`clinqetshared c523554`, `clinqetwebpartnerapp faf5be57`, `clinqetmobilepartnerapp 7b2cf9d0`,
`azureautomation 08c1cf3` (commits "AI search model cost cutting and saving opportunity" / "final AI cost
improvements").

**The whole codebase is available to this project, and any uncommitted change from here on is OURS.**

The one fact the citation design depends on is now settled code rather than a moving target:
`KnowledgeBlobPaths.OcrPageBlob(businessId, documentKey, contentHash, deploymentName, promptVersion, pageNumber)`
→ `_ocr/{businessId}/{documentKey}/{contentHash}/{deploymentName}/v{promptVersion}/p{NNN}.md`.
Build the key ONLY through that helper. The fallback chain still stands: a document over the page ceiling
rasterizes zero pages and therefore has no cached page.

## 1. Rules for whoever resumes (owner-mandated; full detail in `C:\Nik\CLAUDE.md` §0)
- The SOLUTION is approved. If something you discover would change the DESIGN, stop and ask the owner first.
- §0.7: the ONLY approved schema change is `KnowledgeDocument.searchAudience` + `searchAudienceRoleKeys`.
  ‼️ **Decision 6b moved it into P1 and it is BUILT and enforced** — do NOT re-add it. Only its provider-facing
  control is still owed (P4). Anything else needs the §0.7 table and an explicit yes.
- Mockup gate: **`PLAN.md` §0** lists every approved sheet. Anything NEW and visual needs the owner's eyes
  first, and an approved sheet is added to §0 the same day — a sheet nothing references is a sheet the next
  session loses.
- Mobile ships with web in the same session (that is why P2 is both apps).
- No feature flags, no stubs, no hardcoded copy (5 API + 5 web + 5 mobile files), no hardcoded numbers
  (every limit is an appsettings dial with a mirrored class default), no AI-looking icons.
- Every `IMemoryCache` write sets a **Size** — a blanket `1` is NOT the rule; `FullProviderContextService`
  deliberately sizes by content.
- Tests live with the runtime consumer (§0.18) — P1's code runs in `Clinqet.API`, so its tests go in that
  host's suites. RED first, then green, then sabotage.
- NEVER `git checkout/restore/reset/stash/clean` under `C:\Nik`. Never commit, never push — the owner deploys.
- Scratch files only in the session scratchpad, never inside a repo. Leave the tree clean and say what you removed.
- Tooling: the Bash tool cannot parse a heredoc containing an apostrophe — author files with the Write tool;
  Glob times out on `C:\Nik` — use `ls` / `grep --include` / `sed -n` with explicit paths.

## 2. What the owner asked for (the verbatim text in `00-ORIGINAL-PROMPT.md` is the authority)
A search surface in provider web + mobile that answers from the business's **whole** world — knowledge
documents, typed FAQs, services, **offers**, availability, profile, and every work record (bookings, quotes,
invoices, leads, customers, inbox, insights, team) the asking member is allowed to see — streamed like an AI
search, rendering tables and the pictures extracted from documents, ending with citations to the source
document (+ page) and to services with a Category › Subcategory › Service breadcrumb. No other business's data,
ever. The phone receptionist must be completely unaffected. Per-document "who on my team can find this", in
non-technical wording that never confuses the caller-facing switch. Analytics (question text stored,
anonymised) on web and mobile so the feature can be improved. And a full multi-dimensional audit after every
phase — mandatory, never skipped.

## 3. Design tokens for the mockups (house style)
`--navy:#032858 --green:#97EF29 --green-soft:#F4FFE4 --green-pick:#DFFABD --ink:#101010 --muted:#5F5F5F
--faint:#919191 --border:#E7E7E7 --hair:#F0F0F0 --bg:#F7F7F8 --card:#FFFFFF --field:#F5F5F5 --info-bg:#E4EEFB
--info-border:#C7DBF6 --warn:#9A5B00 --warn-bg:#FFF7E8 --warn-border:#F1D9A7 --danger:#B3261E
--danger-bg:#FCECEA --danger-border:#F2C4C0 --ok-bg:#EAFBF0 --ok-ink:#0e7a3a`; font `'Lufga','Segoe UI'`;
pills/chips/buttons `border-radius:999px`; primary button = green fill with ink text; cards 12–16px radius;
page tabs with a 3px green underline; Processing = info-blue + spinner, **never** amber (amber is for limits);
a 360px frame proves the web page on phones.
