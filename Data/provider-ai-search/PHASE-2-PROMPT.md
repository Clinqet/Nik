# PHASE 2 — Business Search UI: provider WEB and provider MOBILE, together (copy-paste kickoff prompt)

You are implementing **Phase 2 of 5** of the Business Search programme for the Clinqet platform. Planning is
COMPLETE and OWNER-APPROVED, and **Phase 1 (the whole backend) is BUILT, GREEN and AUDITED** — a
ten-dimension audit ran on 2026-09-02, found ~30 defects in code that already passed every test, and fixed
them; `findings/AUDIT-P1-2026-09-02.md` §6 lists the items that need an OWNER DECISION and that P2 inherits.
Do not re-plan, do not re-open settled decisions, do not rebuild the backend. Build the two UIs.

‼️ **Read `findings/AUDIT-P1-2026-09-02.md` §6 and §7 BEFORE you plan.** Two of those open items change what
P2 can promise a member: follow-up turns replay answer PROSE that is never re-authorized (O1), and
`.docx/.xlsx/.html/.txt` get a passage plus a DOWNLOAD rather than the "link, not a download" the owner
asked for (O3). Do not design UI copy that claims otherwise.

‼️ **Web and mobile ship in the SAME session.** That is the owner's standing rule — mobile never lags web.
A P2 that delivers only the web page has FAILED, however good the web page is.

---

## 0. READ THESE FIRST, IN THIS ORDER, IN FULL

1. `C:\Nik\Data\provider-ai-search\PLAN.md` — v3, the authority. §5.2 (streaming), §5.3 (rendering), §5.4
   (citations), §5.5 (the three view levels), §7 (**analytics + anonymisation — mandatory, both platforms**),
   §8 (web), §9 (mobile), §9b (**the limits + the copy table for every state**), §15 (locked decisions),
   §15c S9/S10 (the mockup states still to draw, and the four registry traps).
2. `C:\Nik\Data\provider-ai-search\AUTHORIZATION-DESIGN.md` §6b — C1-C6. C2, C3 and C6 shape what the UI may
   render and what it must never imply.
3. `C:\Nik\Data\provider-ai-search\findings\AUDIT-P1-2026-09-02.md` — what P1 built, what was found, what was
   fixed, and the OPEN ITEMS P2 inherits. Read the open items before you plan.
4. `C:\Nik\Data\provider-ai-search\01-SESSION-STATE.md` — handover state and house rules.
5. `C:\Nik\CLAUDE.md` — **in full**. §0 is zero-tolerance and overrides everything.
6. Evidence as needed: `findings/E-partner-web-ui.md` (the web app's registries, gates and patterns),
   `findings/F-partner-mobile-ui.md` (the mobile app's five-file screen registration and `streamSetupOnce`),
   `findings/C-ai-assistant-models-streaming.md` (the SSE precedent).
7. The mockup: `C:\Nik\Data\mockups\business-search-page\provider-ai-search.html` (v3). The owner picked
   **header Option A**.

---

## 1. ABSOLUTE RULES (owner-mandated — breaking one fails the phase)

- **Approval gate.** The SOLUTION is approved. ‼️ Anything NEW and visual needs the owner's eyes BEFORE it is
  implemented (§0.7.1 MOCKUP GATE). PLAN §15c **S9** lists states the mockup does **not** yet draw — the
  "Show page N" panel, no-documents-yet, offline, a very long answer, restricted-document, mobile
  keyboard-open. **Draw those into `C:\Nik\Data\mockups\` and get the owner's yes before building them.**
- **Mobile mirrors web** — same session, unprompted. Parity means matching the **rendering rules**, not
  shipping a same-named component.
- **No feature flags, no stubs, no backward-compat branches.** Pre-prod: every change goes live.
- **No hardcoded user-facing text** — every string is a key in **all 5 web files AND all 5 mobile files**
  (en, es, fr, hi, gu). The API's five files are already done for P1's server-side copy.
- **No hardcoded numbers** — the limits are already dials on the server; the UI must render the number the
  SERVER sent, never a copy of it.
- **Comments**: default none; one short line only for a non-obvious WHY.
- **Tests live with the runtime consumer (§0.18)** — web jest in `clinqetwebpartnerapp`, mobile jest in
  `clinqetmobilepartnerapp`. ‼️ **A test may only read paths inside its OWN repo (§0.17)** — no
  `../clinqetapi`, ever, and remember `describe.skip` STILL RUNS ITS BODY.
- **RED first, then green, then sabotage each guard once.** A guard that has never failed is not evidence.
- **NEVER `git checkout` / `restore` / `reset` / `stash` / `clean` anywhere under `C:\Nik` (§0.19).** Other AI
  sessions hold uncommitted work in these trees. **Never commit, never push — the owner does that.**
- **Leave the tree clean (§0.16)**: scratch files only in the session scratchpad, never inside a repo; say
  what you removed; review `git status` before you report done.
- **Do not touch `clinqetmcp` voice behaviour.** The phone receptionist must stay provably unaffected.

---

## 2. WHAT P1 BUILT — the contract your UI codes against (do not rediscover)

### 2.1 The four endpoints (base `api/v{version:apiVersion}/business/search`)

| Method + route | Returns |
|---|---|
| `POST ask` | **SSE stream** (`text/event-stream`). Body `{ question, sessionId?, language? }` |
| `GET documents/{docId}/pages/{page}` | `ApiResponse<BusinessSearchDocumentPageDto>` |
| `GET documents/{docId}/view-url` | `ApiResponse<BusinessSearchDocumentViewDto>` |
| `GET sessions/{sessionId}` | `ApiResponse<BusinessSearchSessionDto>` — **member-scoped** |

Every one carries `[RequiresPermission("business.profile.read", PermissionScope.Business)]`. **All ten system
roles hold that key**, so every member can search — but that also means the surface returns the standard
tenancy failures: `403 business_context_mismatch`, `403 billing_only_access`, `403 permission_denied`,
`401 business_context_stale` (→ refresh the token and retry once).

### 2.2 ‼️ THE WIRE SHAPE — read this twice

- Frames are `data: {json}\n\n`. **There is no `event:` line anywhere on this platform.** A client written
  against `event:` will silently receive nothing.
- **`: ping\n\n` comment frames arrive every 15 s while a tool is running.** They are not JSON. Skip any line
  that does not start with `data:`. This is what lets the mobile stall guard stay short.
- Property names are **camelCase**. ‼️ **Enum VALUES keep their declared PascalCase** — `"Meta"`, `"Status"`,
  `"Delta"`, `"Citation"`, `"Image"`, `"Done"`, `"Error"`. That is how every SSE stream on this platform
  emits enums; do not lower-case them. (Pinned by
  `BusinessSearchControllerIntegrationTests.TheStream_IsDataFramesWithAnInJsonEventType`.)
- Null fields are omitted entirely (`WhenWritingNull`).

```jsonc
// eventType is ALWAYS present. Everything else depends on the kind.
{ "eventType": "Meta",     "sessionId": "3f2a…" }            // first frame, always
{ "eventType": "Status",   "text": "Searching your documents…" }   // already localized by the server
{ "eventType": "Delta",    "text": "The deposit is " }        // append; markdown accumulates
{ "eventType": "Citation", "citation": { … } }                // arrives BEFORE the deltas that cite it
{ "eventType": "Image",    "image": { … } }
{ "eventType": "Done" }                                       // success terminator
{ "eventType": "Error",    "text": "…", "errorCode": "AI_ERROR" }  // terminal; NO Done follows
```

`citation`:
```jsonc
{
  "number": 1,                       // the [n] the answer text uses
  "kind": "Document" | "Faq" | "Service" | "Offer" | "Profile" | "Availability",
  "title": "Complete price list",
  "subtitle": "Deposits",            // document: section. service: "Category › Subcategory". optional
  "docId": "…",                      // Document/Faq only
  "page": 4,                         // ‼️ PRESENT ONLY when the page is real — see 2.3
  "serviceId": "…",                  // Service only
  "offerId": "…"                     // Offer only
}
```

`image`: `{ "docId", "imageId", "thumbUrl"?, "url"?, "caption"? }` — the URLs are short-lived read SAS.

### 2.3 ‼️ The page rule — do not re-derive it on the client

`citation.page` is **absent** unless the source is genuinely paginated (PDF · JPG/JPEG/PNG/TIF/TIFF/BMP/HEIC/
HEIF/WEBP/GIF · PPTX). Word/Excel/HTML/text store a placeholder `1` and the server strips it. **If `page` is
absent, do not offer "Show page N" and do not invent a page number** — you would send the member to a page
that does not exist. The server decides; the client obeys.

### 2.4 The three view levels (§5.5), cheapest first

1. **The cited passage** — already on screen, free.
2. **"Show page N"** → `GET documents/{docId}/pages/{page}` → `{ docId, page, pageCount?, markdown }`.
   A few KB of markdown, no PDF viewer, no egress. **404 is NORMAL** (a document over the page ceiling
   rasterized nothing, and cached pages are swept after 180 days) — fall back to level 1, then offer level 3.
   The copy is `BusinessSearch_Error_PageUnavailable`.
3. **"Open the original file"** → `GET documents/{docId}/view-url` → `{ url, fileName, inline, expiresAt }`.
   ‼️ **`inline` is false for anything that is not a PDF or an image** (S1 — `.html` is an allowed upload and
   its Content-Type comes from the client's PUT, so it is served `attachment`). When `inline` is false the
   browser downloads rather than renders; word the action accordingly and never embed it in an iframe.
   The URL expires (`DocumentViewSasMinutes`, default 10) — mint it on click, never on render.

### 2.5 Sessions and follow-ups

- `sessionId` comes back on the `Meta` frame. Send it on the next `ask` to continue the conversation.
- ‼️ Sessions are per **MEMBER**, not per business. A colleague's session id resolves to 404. A session id the
  member does not own silently starts a NEW conversation (the server does not tell you it existed).
- `GET sessions/{sessionId}` replays `{ sessionId, createdAt, lastActivity, turns[{role, content, timestamp}] }`.
- ‼️ **HONEST CORRECTION (audit O1).** The design says only opaque handles cross a turn and every turn
  re-authorizes. The IMPLEMENTATION replays the assistant prose verbatim, and `GET sessions/{id}` returns it,
  with no re-authorization of the sources that produced it. A document restricted (or a role downgraded)
  between turns does NOT remove that content from turn 2. **Do not write UI copy promising otherwise**, and
  do not build a feature on top of the stronger claim. Owner decision pending — see AUDIT-P1 §6 O1.
- The replay window is `FollowUpTurns` (6 exchanges) — older turns are trimmed server-side.

### 2.6 Limits and what the member is told

| Dial (server) | Value | Client behaviour |
|---|---|---|
| `BusinessSearch:Limits:QuestionsPerMinute` | 6, **per member** | 429 + `Retry-After` |
| `BusinessSearch:Limits:QuestionsPerBusinessPerDay` | 200 | 429 + `Retry-After` (seconds to midnight UTC) |
| `BusinessSearch:Limits:QuestionsPerMemberPerDay` | 60 | 429 + `Retry-After` |

The 429 body carries the **already-localized message with the number substituted**. ‼️ **Render the server's
message. Never hardcode 200 / 60 / 6 in the UI** — that is the §0.12 trap this design exists to avoid.

### 2.7 Server-side copy already in all five API localization files

`Error_BusinessSearchQuestionRequired`, `Error_BusinessSearchQuestionTooLong`,
`BusinessSearch_Error_TooFast`, `BusinessSearch_Error_BusinessDailyLimit` (`{0}`),
`BusinessSearch_Error_MemberDailyLimit` (`{0}`), `BusinessSearch_Error_Unavailable`,
`BusinessSearch_Error_Generic`, `BusinessSearch_Error_TookTooLong`,
`BusinessSearch_Error_PageUnavailable`, `BusinessSearch_Error_FileUnavailable`,
`BusinessSearch_Status_SearchingDocuments`, `_SearchingServices`, `_CheckingOffers`, `_CheckingProfile`,
`_CheckingHours`, `_Working`, `BusinessSearch_Citation_UntitledDocument`, `_BusinessProfile`, `_WorkingHours`.

**Status and error text arrive already localized on the wire — render it, do not re-key it.** Everything the
CLIENT itself says (empty state, placeholders, buttons, "Helpful / Not helpful", offline, the page panel's
chrome) needs NEW keys in all 5 web + all 5 mobile files.

### 2.8 What P1 deliberately did NOT build (do not "fix" it)

- **Group B tools** (bookings, quotes, invoices, leads, customers, inbox, insights, team) — **P3**.
- ‼️ **CORRECTED 2026-09-02 — `KnowledgeDocument.searchAudience` IS BUILT.** The owner moved the field and
  its ENFORCEMENT into P1 (§0.7 granted) so the restriction mechanism exists from the first line of code.
  Built and green: the `KnowledgeSearchAudience { Team, Roles }` enum, `searchAudience` +
  `searchAudienceRoleKeys` on the entity, the three-state fail-closed
  `ListSearchVisibleDocIdsAsync` (`AllVisible | Restricted(ids) | ReadFailed`), enforcement in BOTH the
  retrieval and the page/view-url endpoints, and `PATCH knowledge/documents/{docId}/audience`
  (`voice.settings.manage`). **Do NOT re-add the field and do NOT assume the enforcement is missing.**
  What is still outstanding is only the **UI** — the "Team search" box (Everyone on my team / Only these
  roles + role chips) in the document details editor, web AND mobile, per PLAN §6.3. That remains a LATER
  phase unless the owner moves it; if you are told to build it, the endpoint is already there.
- **Knowledge search is OPEN TO EVERY MEMBER** (owner, 2026-09-02) — it is NOT gated on `voice.read`. What
  bounds an answer is the per-document audience above. Do not render anything implying a library-wide gate.
- No UI at all — that is this phase.

---

## 3. PHASE 2 SCOPE

### 3.1 Mockup first (S9)
Draw the missing states into `C:\Nik\Data\mockups\` (web AND mobile frames, house tokens in
`01-SESSION-STATE.md` §3) and **get the owner's approval before building them**: the "Show page N" panel
(now the PRIMARY citation action), no-documents-yet, offline, a very long answer, a restricted document,
mobile keyboard-open. Reuse the approved v3 mockup for everything it already draws.

### 3.2 Web — `clinqetwebpartnerapp`
- Route `/dashboard/search` (+ `FULL_HEIGHT_ROUTES`), rail surface key **`businessSearch`**, `permission: null`,
  **positioned directly under Dashboard** (locked decision 13).
- Header entry: **Option A** — a button in the header right cluster opening a panel; the panel is an ENTRY
  POINT: Enter/arrow opens `/dashboard/search` with the answer already streaming (one answer surface,
  bookmarkable, Back works).
- ‼️ **The build-failing registries (S10 — update all of them together):** `SURFACE_PERMISSIONS` (+ the
  controller/method/route literal the API convention test verifies), `PAGE_FOR_SURFACE`, `SELF_GATED`,
  `Access.Surface.businessSearch` ×5 language files, `ANIM_KEYS` + `[data-anim]` + keyframes, the rail
  tail-order test, `Header.jsx` title case, `inferSurfaceFromPath`, `PAGE_SEO`/`createMetadata`, AASA +
  mobile `linking.ts`/`types.ts` parity. ‼️ A **second `permission: null` surface breaks two hard-coded
  ordered-array assertions** — expect them and fix them in the same change.
- Components: `BusinessSearchPage`, `SearchAnswerMarkdown` (react-markdown + remark-gfm, **no raw HTML**,
  brand CSS, citation + image marker components), `SourceCard` per citation kind, the page viewer,
  `DocumentPreviewModal` reuse.
- Streaming client: `fetch` + `getReader` + `AbortController` + a **20 s stall timer** + 401 refresh-and-retry
  + 403 → `raiseAccessDenied` + 429 → the server's message. **Cancels on `contextEpoch` change** (workspace
  switch). Skip non-`data:` lines (the `: ping` comments).
- ‼️ **"Recent questions" storage MUST be keyed by businessId** and swept on workspace switch and sign-out —
  a member of two businesses must never see business A's questions inside business B.

### 3.3 Mobile — `clinqetmobilepartnerapp`
- Screen `BusinessSearch`; the **five-file registration**: `constant.tsx`, `types.ts`, `linking.ts` →
  `dashboard/search`, `MyDashboard-Route.tsx`, `analyticsTracker.screenMap`.
- Entrances: dashboard header magnifier + a Profile row beside "AI Knowledge". ‼️ **That row must NOT inherit
  the AI-package flag (`payments.aiAssistantEnabled`)** the neighbouring rows use — Business Search is not an
  AI add-on feature.
- Streaming: generalise `streamSetupOnce` into `streamSse(endpoint, headers, body, {onEvent, stallMs, signal})`
  with cancel, typed frames and the 401/403/429 contract, **keeping the existing provider-setup caller
  byte-compatible**.
- Rendering: `react-native-markdown-display` with theme tokens; custom rules for the citation and image
  markers; "Show page N" renders in the same markdown component; "Open the original file" →
  `Linking.openURL` (respect `inline === false` — it is a download).
- Backgrounding suspends the XHR stream: ship an explicit "continue" state rather than a stalled spinner.
- Parity pinned by a jest source-scan test: same states, same keys, **same page-only-for-paginated rule**.

### 3.4 ‼️ Analytics + anonymisation — both platforms, not optional (PLAN §7)
- Store the question text **after client-side redaction**: (a) the existing PII scrub (emails, phones, long
  digit runs), then (b) money amounts → `<amount>`, (c) team-member names → `<member>` (resolved against the
  roster the client already holds — no server round trip), (d) customer names from the answer's own citations
  → `<customer>`. **The unredacted text never leaves the device.**
- Also capture: question length, language, which tools ran, result counts per source type, whether an answer
  was produced, time to first token, total time, tokens + cost, follow-up depth, which citation was opened,
  helpful/not-helpful.
- Events: `SearchAction` (ask — **no sampling**, every question counts), `ResultClick` (citation opened),
  `AIAssistantAction` (helpful/not helpful), `ContentEngagement` (dwell). Surface `dashboard.search` on both
  platforms; mobile's `screenMap` must carry it and `analyticsWebParity` requires the same verbs.
- ‼️ Redaction gets its **own unit tests on both platforms, same rules, same fixtures**, plus a server-side
  assertion that a stored question contains no e-mail/phone pattern.

### 3.5 Localization
New client copy in **all 5 web + all 5 mobile files**. Reuse the server's already-localized status/error text
rather than duplicating it.

### 3.6 Tests
- Web jest: renderer sanitization (no raw HTML reaches the DOM), citation + page actions, the page-only-for-
  paginated rule, streaming abort/stall/429/401, every registry, the redaction rules.
- Mobile jest: `streamSse` (including that the existing setup caller is unchanged), markdown rules, the
  parity source-scan, the screen-registration spine, the redaction rules.
- Sabotage each guard once.

---

## 4. MEASURED TRAPS (do not rediscover)

- The Bash tool cannot parse a heredoc containing an apostrophe; backticks inside a double-quoted `node -e`
  string are eaten by the shell. **Author files with the Write tool.**
- `Glob` times out on `C:\Nik` — use `ls` / `grep --include` / `sed -n` with explicit paths, excluding
  `bin/`, `obj/`, `node_modules/`.
- These trees are **mixed LF/CRLF**. A script that detects the line ending from the first `\r\n` it finds will
  corrupt a file. Split on `/\r?\n/` and write back with ONE ending.
- ‼️ **A restored file does not always rebuild.** After reverting a sabotage, `dotnet build --no-incremental`
  (or `npm test` with the cache cleared) before trusting a green run — a stale binary reports the sabotage's
  result. This bit P1 once and cost a confusing half-hour.
- `describe.skip(...)` **still executes its callback**; only the `it()` bodies are skipped. Any peer-file read
  must sit INSIDE an `it()`.
- Enum values on the wire are **PascalCase**; property names are camelCase. Do not "fix" either.

---

## 5. DEFINITION OF DONE — all four, or the phase is not done

1. Everything in §3 built on **both** apps, both projects building, **ESLint zero errors**, all affected
   jest suites green on a real run.
2. ‼️ **The multi-dimensional audit has RUN** across every dimension — correctness & contracts · tenant
   isolation and authorization · data safety & idempotency · cost & performance · memory/resource leaks &
   thread safety · config hygiene · localization ×10 client files · **web/mobile parity** · tests (placement
   §0.17/§0.18, fail-first evidence, sabotage) · deployment · **UI/UX against the approved mockup** · and
   "did we miss anything the owner asked for". Use independent agents per dimension, then skeptics who try to
   REFUTE each finding. Every finding fixed or refuted with evidence, written to
   `C:\Nik\Data\provider-ai-search\findings\AUDIT-P2-<date>.md`.
3. `C:\Nik\Data\provider-ai-search\PHASE-3-PROMPT.md` written for the next session (P3 = Group B team answers,
   end to end, both apps) — **and the same text pasted into the chat reply**, because a file path alone is not
   delivery.
4. The tree is clean of scratch files, `git status` reviewed, **nothing committed or pushed**, and the summary
   says plainly what was built, what was audited, what was fixed, and what remains.

---

# ‼️ P1.5 DELTA — READ THIS BEFORE §2 ABOVE

> Appended 2026-09-03 by the P1.5 session. **Everything above was written by P1 and is still true except
> where this section corrects it.** Where they disagree, THIS SECTION WINS.
>
> Full detail: `findings/AUDIT-P1.5-2026-09-03.md` · `findings/MEASUREMENTS-P1.5-2026-09-02.md` ·
> ‼️ `CARRIED-TO-P3.md` (work the owner ordered that P2 must not lose).

---

## D1. ‼️ THE ENDPOINT LIST HAS CHANGED — one route REMOVED, two ADDED

| Method + route | State |
|---|---|
| `POST ask` | unchanged |
| `GET documents/{docId}/pages/{page}` | unchanged |
| ~~`GET documents/{docId}/view-url`~~ | ‼️ **DELETED.** Returns 404. §2.4 level 3 above is GONE |
| **`GET documents/{docId}/text`** | ‼️ **NEW** — the replacement |
| **`POST prepare`** | ‼️ **NEW** — call it when the ask surface OPENS |
| `GET sessions/{sessionId}` | unchanged |

### D1.1 ‼️ NO DOWNLOAD LINK EXISTS ANYWHERE (owner's ruling, audit O3)

*"Never give any link to download the document; cite it as a source with the page number when known."*

The route, its DTO, the service method, the `DocumentViewSasMinutes` dial and the storage seam behind it are
all **deleted**. A reflection guard fails the build if a `ViewUrl`/`DownloadUrl` member reappears.

**Do not build an "Open the original file" action. Do not ask for one back.** ‼️ This also dissolves audit O7
(a minted SAS outliving revoked access): with no link minted, there is nothing to expire.

### D1.2 `GET documents/{docId}/text` — what "Show text" opens

```jsonc
{ "docId": "…", "title": "Terms of service", "markdown": "## Deposits\n\nA deposit of 20%…", "truncated": false }
```

- Same authorization as `pages/{page}` — nothing new to handle.
- **404 is NORMAL** (the extract was never banked, or the document is outside this member's audience). Copy:
  `BusinessSearch_Error_TextUnavailable`.
- ‼️ **`truncated: true` means you are showing PART of the document.** Say so in the panel. Rendering a cut
  extract as the whole of it is the same confident-partial defect the tool payloads guard against.
- ‼️ There is **no URL in this payload**, by design. Nothing to open in a new tab, nothing to iframe.

### D1.3 ‼️ `POST prepare` — call it on page/screen OPEN, and do not await it

Returns **204**. It warms the business's alphabet set, which the server needs **before the first model call**
because the tool schema ships with that request. Warm ⇒ the ask path costs **zero** extra search calls; cold
⇒ it is bounded at 250 ms and the answer proceeds one leg short.

**Fire it when the surface mounts and ignore the response.** Never block the UI on it, never call it per ask.

---

## D2. ‼️ SOURCE-CARD RULES — from the approved mockup, and they are BINDING

`C:\Nik\Data\mockups\business-search-sources\index.html` (owner-approved 2026-09-02), §06:

| Uploaded as | `citation.page` | Card shows | Action |
|---|---|---|---|
| PDF | present | name · section · page | **Show page N** |
| JPG PNG HEIC TIF BMP WEBP GIF | present | name · page | **Show page N** |
| PPTX | present | name · section · page | **Show page N** |
| DOCX | absent | name · section | **Show text** |
| XLSX | absent | name · sheet | **Show text** |
| HTML TXT | absent | name · section | **Show text** |
| Typed FAQ | absent | the question | — nothing to open |
| Service · Offer · Hours | absent | record name | open the record |

‼️ **`page` absent ⇒ offer "Show text", never a page number.** §2.3 above still holds: the server decides,
the client obeys, and the client never invents a page.

---

## D3. ‼️ THE ANSWER PANEL — the excerpt is now STRUCTURED, not a flat string

Audit O2 is fixed: the provider's screen and the phone caller's excerpt are formatted by the SAME renderer
(`MaterialExcerptBuilder`). The model now receives, per cited card, an ARRAY of lines rather than one
flattened string:

```jsonc
"text": [ { "label": "Deposit", "text": "20%" }, { "label": "Refundable", "text": "Yes, to 48h" }, { "text": "Balance due on completion." } ]
```

That is a MODEL-facing payload, not a wire contract you read — but it is why answers now contain proper
markdown tables where they used to contain `a | b | c`. **Render the model's markdown; do not re-flatten it.**

---

## D4. ‼️ VOICE INPUT IS ALREADY BUILT — mount it, do not rebuild it

### D4.1 What exists on WEB (`clinqetwebpartnerapp`)

| File | What it is |
|---|---|
| `src/hooks/useDictation.js` | the whole state machine. 11 states, offline/unsupported detection, cap enforcement, correction, retry |
| `src/components/common/DictationMic.jsx` | the mic + the state strip + the correction chips, drawn to the approved mockup |
| `src/services/aiServices.js` → `TranscribeSpeech` | the call |
| `src/api/url.js` → `SpeechTranscribeAPI` | the route |
| `src/hooks/useDictation.test.js` | 11 tests, including *"never exposes anything that could send the transcript"* |
| `public/lang/*.json` → `Dictation.*` | 11 keys ×5 languages |

**How P2 mounts it in the ask box:**

```jsx
const dictation = useDictation({
  maxRecordingSeconds: appConfig.dictation.maxRecordingSeconds, // ‼️ DELIVERED — never a constant
  language: locale,                                            // orders the candidate list, not a picker
  surface: "business_search_ask",                              // analytics
});

// When a transcript lands, put it in the FIELD. ‼️ Do NOT submit.
useEffect(() => { if (dictation.transcript) { setQuestion(dictation.transcript); focusEnd(); } }, [dictation.transcript]);

<DictationMic dictation={dictation} maxRecordingSeconds={appConfig.dictation.maxRecordingSeconds} />
```

‼️ **THE ONE RULE: the mic never sends.** Speech fills the field; the member presses Ask. A mis-heard trade
term must be correctable before it spends one of their daily questions. A test asserts the hook exposes no
`send`/`submit`/`ask`/`autoSend`.

### D4.2 What exists on MOBILE (`clinqetmobilepartnerapp`)

> ‼️ **REVISED 2026-09-03 (audit A-11/A-13).** An earlier draft of this section described a `useSpeechToText`
> that took **no arguments** and a mobile mic with no cap and no state strip. Both were true when written and
> are wrong now. **If you started from that draft, re-read this section.**

| File | What it gives you |
|---|---|
| `hooks/useSpeechToText.ts` | the state machine + the recorder. **Takes options** — see below |
| `components/SpeechToTextButton.tsx` | mic, `elapsed / cap` duration, the state strip, Try again, the chips |
| `components/DictationLanguageChips.tsx` | the correction chips |
| `services/appConfigService.ts` | `DictationLimits` on `AppRuntimeConfig` |
| `__tests__/dictationNeverSends.test.ts` | 12 guards (Q1–Q6 sabotage-proved) |
| `Locales/*.json` → `dictation.*` | 11 keys ×5 languages, **all rendered** |

‼️ **THE SIGNATURE TAKES OPTIONS. Calling it bare gives you NO CAP:**

```tsx
const { dictation } = useAppConfig();                       // ‼️ the cap is SERVER-delivered
const stt = useSpeechToText({ maxRecordingSeconds: dictation.maxRecordingSeconds });

// state · retry · canRetry are NEW, alongside detectedLocale · candidateLocales · correctLocale · canCorrect
const { state, retry, canRetry, ...rest } = stt;
```

`DictationState` is exported from the hook and mirrors web's names exactly: `Idle` `Listening`
`Transcribing` `Ready` `Empty` `PermissionDenied` `Failed` `TooLong` `Offline`.

- **Offline is refused BEFORE recording** (NetInfo) — never discovered at upload.
- **413 is `TooLong`**, not a generic failure.
- **`retry()` re-sends the clip already held**; `canRetry` is false for silence and a blocked mic.
- **Mounting `SpeechToTextButton` gives you all of it.** Do not rebuild the strip or the cap.

The provider app's existing mic in `FloatingTextarea` already runs on the new route — **that is live today**,
not waiting for P2.

### D4.3 ‼️ AppConfig carries the mic's caps — use them, never a constant

```jsonc
"dictation": { "enabled": true, "maxRecordingSeconds": 60, "maxAudioBytes": 4194304, "supportedFormats": ["wav","mp3","m4a","webm","ogg","flac"] }
```

‼️ **`maxAudioBytes` is 4 MB, not the 10 MB an earlier draft of this section quoted.** 10485760 was the
options-class DEFAULT, which had drifted from the shipped 4194304; the default now mirrors appsettings
(audit A-18) and a convention test pins the pair. 60 s of the 16 kHz mono PCM both clients record is
~1.9 MB, so the cap is roughly 2× headroom — but read it, never assume it.

A client that stops recording on its own constant will happily record past what the server accepts, and the
member finds out only after speaking. Mobile did exactly that until A-13.

### D4.4 The transcribe route

`POST api/v{version}/speech/transcribe` · multipart · permission `ai.assistant.use` **unchanged** ·
fields `AudioFile` (required), `Language` (the APP language — it ORDERS the candidate list), `ForceLocale`
(‼️ **the correction chip ONLY**, never a first attempt).

```jsonc
{ "text": "…", "detectedLocale": "gu-IN", "confidence": 92.5, "candidateLocales": ["en-CA","gu-IN","hi-IN"] }
```

‼️ **`candidateLocales` IS the chip's option list.** Never hardcode a language list in a client.

### D4.5 ‼️ TWO MEASURED FACTS THAT SHAPE THE UI

1. **An empty `locales` array turns Gujarati speech into romanized English labelled `en-US`** — HTTP 200,
   confident nonsense. The server refuses to send one. Nothing a client does can produce that call.
2. ‼️ **Punjabi is identified as Hindi and written in Devanagari**, even with `pa-IN` in the candidate list.
   **The correction chip is the only recovery a Punjabi-speaking provider has.** Never hide it, never gate it
   behind a menu, never open it automatically on low confidence.

---

## D5. `language` ON THE ASK BODY NOW MEANS SOMETHING SLIGHTLY DIFFERENT

It is still "answer in this language". But when the question was **spoken**, the member may have spoken a
language other than the UI locale. Send **the language of the question text**, not the UI locale, when they
differ — the answer follows the question, and the server already keys everything off the question's script.

---

## D6. ANALYTICS — `inputMode` and friends, no schema change

Inside the EXISTING free-form `Metadata` (§18.17), so no new Parquet column and no §0.7 gate:
`input_mode` (`voice`|`typed`) · `detected_locale` · `candidate_count` · `corrected` · `transcript_length`.

The web hook already emits `speech_start` / `speech_apply` / `speech_empty` / `speech_fail`.
‼️ **P2 must add `input_mode` to the ASK event itself** — the hook cannot know whether the member edited the
transcript before pressing Ask.

‼️ **Never send the transcript.** What a provider dictates is their own business content.

---

## D7. ONE MORE STORED-ANSWER RULE — the `[[partial-answer]]` marker

An answer cut short (`finish_reason: length`, the answer budget, a client abort) is now **stored** with the
literal ASCII sentinel `\n\n[[partial-answer]]` appended, and the `Status` frame carries `"partial": true`.

- **On the live stream:** use `frame.partial === true`, not the translated status text.
- ‼️ **On session REPLAY (`GET sessions/{id}`):** strip the sentinel and render your own localized "this
  answer was cut short" notice. It is deliberately not prose — an unstripped marker reads as an obvious
  marker rather than as a lie in the business's own words.

---

## D8. ‼️ CARRIED TO P3 — P2 MUST NOT ABSORB THESE, AND MUST NOT LOSE THEM

Full detail in **`CARRIED-TO-P3.md`**. Summary:

1. ‼️ **`search_call_followups` + `search_refund_requests`** — the owner's *"must and super important"*
   (audit O4). **P3**, because Group B's machinery does not exist yet and refunds touch money.
2. **`relativeRange` + member-name resolution** (§18.15) — P1.5 shipped the guard that structured tools carry
   **no** rendering fields, and carried the resolvers rather than shipping code nothing calls.
3. **`IsSolo`** — removed from the authorization context (it cost a roster read on every ask and nothing
   consumed it). It returns with the first tool that narrows by member.
4. **O9** — whether `search_services` should read the AI Search index. The dial ships; the measurement did not run.

---

## D9. CORRECTIONS TO §2 ABOVE

| §2 says | Now |
|---|---|
| §2.1 lists `view-url` | ‼️ **DELETED.** Two new routes — see D1 |
| §2.4 level 3 "Open the original file" | ‼️ **GONE.** Level 3 is now **"Show text"** — see D1.2 |
| §2.5 "audit O1 — owner decision pending" | ‼️ **The owner CLOSED O1: not a defect, no action.** The prose replay stands as designed |
| §2.6 dials | unchanged, and still: render the server's message, never hardcode 200/60/6 |
| §2.7 keys | ‼️ `BusinessSearch_Error_FileUnavailable` is **REMOVED**; `BusinessSearch_Error_TextUnavailable` and `BusinessSearch_NoAccessToTopic` are **NEW**; `BusinessSearch_Error_PageUnavailable` is **RE-WORDED** (it used to say "open the original file instead", which became a lie) |
| §2.8 "no UI at all" | ‼️ **Voice input UI EXISTS on both platforms** — see D4. P2 mounts it; it does not rebuild it |

---

## D10. WHAT THE MEMBER CAN NOW BE TOLD THAT THEY COULD NOT BEFORE

Three new honest states P2's UI should be ready to render, all arriving as ordinary `Status`/answer text:

1. **"part of your information could not be searched"** — a query leg failed, or the alphabet set could not be
   read. The answer is narrower than it set out to be and says so.
2. **"you don't have access to that"** — a permission-gated topic. ‼️ It is now a FIXED localized sentence,
   not the model's improvisation, and it is never the "nothing found" copy (audit O5). Dispatcher, technician,
   finance and contractor hit this today on offers; finance on hours.
3. **a catalogue answer with NO total** — across several renderings the per-leg counts overlap, so the model
   is told to state no count rather than a wrong one.
