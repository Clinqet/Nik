# AI Knowledge — what the receptionist may do with each file

> **Status 2026-09-07 (evening): ANALYSIS v3. No code written.** The owner approved the five decisions of v2 (§11) and
> re-opened the "receptionist not enabled" question with a direction (§12). This version designs that world in full:
> the choice is **hidden** when a business has no receptionist, the stored value is then **Not used**, the choice appears
> with the saved value the day the receptionist is enabled, and **every backend gate follows the stored choice with no
> gap** (§5.0). Typed FAQs carry the same choice (§5.5). The delivery window of a send is closed (§5.3).
>
> Authority for this programme. Mockup register is §0. Sheet K1 is a DRAFT until approved (`CLAUDE.md` §0.20).
> Living contracts touched: `clinqet-voice-assistant` SKILL (knowledge + send_material_info), `clinqet-business-search`
> SKILL §5/§16, `clinqet-partner-app`, `clinqet-provider-mobile`.

---

## 0. Mockup register (this programme)

| # | Sheet | Approved | Governs | Status |
|---|---|---|---|---|
| K1 | `C:\Nik\Data\mockups\knowledge-receptionist-access\index.html` | **by waiver, 2026-09-07 round 3** (owner: no mockup approval needed, build carefully, phone too) | The "AI receptionist" choice in the document editor **and the FAQ editor** (web + phone, every state) · the same choice at upload · the three row marks on files **and FAQs** · the pictures panel under a non-sendable answer · **the page when the business has no receptionist (choice hidden, neutral words)** · **the "choose what your receptionist may use" moment when it is enabled** · where every word comes from | **BUILT + AUDITED 2026-09-07 (web + phone; `PLAN.md` §10).** Supersedes **M6 §1** on the "Phone receptionist" box only, and `knowledge-document-sharing/v3-upload-and-list.html` Decisions 1 and 3. Everything else in both stands |

---

## 1. What exists today (read from the code, not from the skills)

| Fact | Where |
|---|---|
| `KnowledgeDocument.shareWithCallers` (bool, default **true**). Meaning: the receptionist may **SEND** the relevant details of this file to a caller. It does **not** decide whether the receptionist may read the file — every Ready file is answerable aloud | `clinqetcore/Entities/COSMOS/KnowledgeDocument.cs`; enforced in `KnowledgeDocumentRepository.ListRefSuppressedDocIdsAsync` + `ListSendableImageRefsAsync`, MCP `KnowledgeTools.FilterSendable` / `ResolveSendableImages` (live row), ingest `ApplyProviderChoices` (tightening only), `MarkDeletingAsync` (forced false) |
| `KnowledgeDocument.searchAudience` (+ `searchAudienceRoleKeys`). Meaning: who on the **team** may **FIND** the file in Ask Clinket. Independent of callers by design | `KnowledgeSearchAudienceRule.Decide`; `ListSearchVisibleDocIdsAsync`; `BusinessSearchDocumentService.ResolveAsync` |
| **Nothing** says "may the receptionist use this file at all" | — |
| **Every receptionist read of knowledge goes through two seams and nothing else:** `IProviderKnowledgeSearch.SearchAsync` (called by the `search_knowledge` tool and by `answer_catalog_question`) and `IProviderKnowledgeSearch.GetByRefsAsync` (the send tool and the excerpt assembler's neighbour read). The first prompt embeds no document or FAQ text — only a yes/no `HasKnowledge`. The indexer's two other index reads are maintenance (count, purge/merge listing) | grep of `SearchAsync<KnowledgeSearchDocument>` and `IProviderKnowledgeSearch` across all hosts; `RealtimeSessionPayloadBuilder` |
| Voice retrieval post-filters by the registry: `ListRetrievableDocIdsAsync` (Ready rows, fail-closed) for the main results, the overview companion and `GetByRefsAsync`; `ListRefSuppressedDocIdsAsync` + `ListSendableImageRefsAsync` (fail-soft) decide which passages carry a send handle | `ProviderKnowledgeSearchService.cs` |
| Ask Clinket retrieval has **its own** allow-list (Ready + audience) and never consults the caller bits | `ProviderKnowledgeSearchService.Provider.cs` |
| The receptionist is offered `search_knowledge` (+ ~200 prompt tokens) only when `HasKnowledge` = `CountReadyAsync > 0`, cached 5 min | `FullProviderContextService` 176/293; `RealtimeSessionPayloadBuilder` 65/506 |
| Ask Clinket reads that same voice `HasKnowledge` in exactly ONE place: the `hasKnowledgeDocuments` line inside the business-profile payload the model reads. It does **not** gate Ask Clinket's document search | `GetBusinessProfileTool.cs:114` |
| A material send: the tool validates the live rows, builds the excerpt, enqueues it; the Functions processor renders and delivers 3–10 s later **without re-reading the rows**, and the excerpt items carry **no document identity** | `KnowledgeTools.SendMaterialInfo`; `VoicePostCallProcessorFunction.ProcessSendMaterialInfoAsync`; `VoiceMaterialItem` |
| The knowledge index carries no per-document access field; both surfaces filter by document ids from the registry | `KnowledgeSearchDocument.cs` |
| Registry container `KnowledgeBase`, pk `/businessId`, trimmed index policy; `shareWithCallers` and `searchAudience` are not indexed and are evaluated in C# | `CosmosContainerPolicies.KnowledgeBase` |
| A business's receptionist status sits on its profile: `BusinessProfile.VoiceAssistant.Status` (`VoiceAssistantStatus`: NotInvited · Invited · Draft · Submitted · NumberPending · Active · Rejected · OnHold · Cancelled). The platform switch is `PaymentSettings.Enabled && PaymentSettings.AiAssistantEnabled`, the expression `AppConfigController` already serves the apps | `Cosmos.cs:133`; `VoiceAssistantStatus.cs`; `PaymentSettings.cs`; `AppConfigController.cs:80` |
| Typed FAQs: always sendable, no audience, no switch — "for callers by construction" | `CreateFaqAsync`; `KnowledgeController.ToDto` |
| UI today (web + phone): Document details = Type · Link to offerings · "Send relevant details to callers" switch · "Team search" box. Upload = one switch line per file. Row marks "Details can be sent" / "Not shared". FAQ editor = question + answer only | `DocumentDetailsModal.jsx`, `KnowledgeFaqModal.jsx`, `UploadKnowledgeModal.jsx`, `KnowledgePage.jsx`; mobile `Knowledge/index.tsx` |
| The page itself is behind the receptionist enrolment gate on both apps — **out of scope** (owner: one AI subscription will cover both; design as if the lock is absent) | `AiSurfaceGate.jsx` / `.tsx`; §7 |

---

## 2. The one missing distinction

The owner's customer shapes need exactly **one new fact per knowledge item**: *may the AI receptionist use it at all?*

```
                       may READ (answer callers)   may SEND details        team may FIND
 today                 always                      shareWithCallers        searchAudience
 needed                usedByReceptionist (NEW)    shareWithCallers        searchAudience (unchanged)
```

"Send" only makes sense when "read" is allowed, so the two receptionist facts are **one question with three answers**:

| Answer | read | send | Who wants it |
|---|---|---|---|
| **Answers callers and can send them the details** (default when the business has the receptionist) | yes | yes | the receptionist customer, today's behaviour |
| **Answers callers, never sends anything** | yes | no | today's "Not shared" — owner-locked 2026-08-21 |
| **Not used by the receptionist** (default when the business has **no** receptionist) | no | no | internal / proprietary material; every item of a search-only business |

Team search stays a separate axis; both helpers say the other is unaffected.

---

## 3. Every scenario, end to end

| # | Scenario | Today | With this design |
|---|---|---|---|
| 1 | Receptionist customer uploads a price list | answers + sends | same — default unchanged |
| 2 | Receptionist customer uploads an internal cost sheet | **read aloud to callers**; only the sending can be stopped | picks "Not used" on the file card at upload or later; never read, never sent; team still finds it |
| 3 | "Quote it aloud, never send it in writing" | "Not shared" | "Answers callers, never sends anything" — same behaviour, clearer words |
| 4 | **Business with no receptionist** (not invited, or the plan/platform does not include it) uploads files and types FAQs | cannot reach the page today (out of scope) | **no receptionist choice is drawn anywhere** — not in the editors, not at upload, no marks on rows, no receptionist words on the page. Every item is stored **Not used**. The team finds everything through Ask Clinket |
| 5 | That business later gets the receptionist (invited / plan upgrade / platform switch on) | n/a | the choice **appears with the saved value — "Not used" on every item**. Nothing becomes audible by itself. The AI Voice Assistant page shows one message: *"You've added documents or FAQs, but your receptionist isn't using any of them yet — choose which ones it may answer callers from."* They go and choose, item by item |
| 6 | A receptionist customer loses the receptionist (cancelled / plan downgrade) | n/a | the choice hides; saved values stay; no receptionist runs, so nothing is read. Items uploaded meanwhile default to Not used. If the receptionist returns, every saved value reappears as it was |
| 7 | Both kinds of material in one business | only the send half controllable | three answers per item, at upload and in the editors |
| 8 | A Team-search-restricted file that callers may be sent | allowed | still allowed — two axes |
| 9 | **Typed FAQ** | always for callers, no control | **carries the same choice** (§5.5): a FAQ typed by a business without the receptionist is Not used until they say otherwise; a receptionist customer's FAQs default to Answers and can send |
| 10 | Duplicate upload (same bytes) folded onto the existing document (X9) | `shareWithCallers=false` crosses over, true never widens | `Not used` / `Answers only` cross over; `Answers & sends` never widens the survivor |
| 11 | Replace a document / edit a FAQ | keeps the switch unless the client sends a value | same posture: a missing value leaves the saved choice alone |
| 12 | Change the choice while the file is Processing | caller switch refuses; Team search allows | allowed (approved decision 4); takes effect the moment the file is Ready |
| 13 | Delete | `shareWithCallers=false` + Deleting | both bits false + Deleting; every gate refuses |
| 14 | Platform switch `Voice:Knowledge:MaterialSharingEnabled` off | no send control drawn | two answers instead of three; a stored "Answers & sends" displays as "Answers callers"; refs never stamped anyway |
| 15 | A business whose used items are none (all Not used, no used FAQ) | tool offered, prompt block paid | `search_knowledge` **not offered**, prompt block **not emitted** — zero tokens, exactly like a business with no documents |
| 16 | How fast a flip reaches the phone | — | reading/sending: the registry is read live per search ⇒ immediate. Whether the tool is offered at all: within `ProviderContextCacheMinutes` (5) |
| 17 | Flip to "Not used" **during a live call** | — | the next search no longer returns it; a handle already offered is refused at the send (live row) **and again at delivery** (§5.3). ‼️ Bound: words the receptionist already read earlier **in the same call** are in its memory for that call — no code can un-say them |
| 18 | Flip between the send tool call and the delivery (3–10 s) | today the excerpt is delivered as built | the delivery processor re-reads each item's document and drops what may no longer be sent; nothing left ⇒ the existing "could not deliver" notice + admin alert |
| 19 | Ask Clinket | — | **untouched**: Not used items stay findable; the receptionist bits are never consulted (C3) |
| 20 | Ask Clinket's profile line `hasKnowledgeDocuments` | copies the voice `HasKnowledge` | keeps **"any Ready item"** through its own count (`CountReadyAsync`, unchanged) — the model is never told a searchable library is empty |
| 21 | The knowledge summary on the AI Voice Assistant page | counts Ready items | counts **used** items only; one new state when items exist and none is used (scenario 5) |
| 22 | Pictures panel ticks | enabled while `shareWithCallers` | enabled only under "Answers & sends"; dimmed with one sentence otherwise |
| 23 | "Answers only" and the receptionist's OWN writing | — | ‼️ **Boundary to accept or forbid:** the receptionist may still put a price it read aloud into a written quote (`send_quote`) or a booking note — that is the receptionist's own document, not the file. Today's behaviour, and the knowledge prompt encourages it. Code cannot enforce a ban on remembering; only a prompt rule could discourage it (decision D, §11) |
| 24 | Admin knowledge-health / reindex, teardown, Clinket AI Data Analytics (draft services) | — | unaffected — they act on rows and cards, not on who may hear them; a draft becomes public only when the provider approves it |
| 25 | Search index, cosmosindexsetup, Service Bus queues, ARM, deploy.ps1 | — | **no change** (one optional index-policy item, measured first — §5.3) |
| 26 | Region where voice knowledge is switched off (`Voice:Knowledge:Enabled=false`) | Ask Clinket's document search is ALSO unavailable (existing coupling) | unchanged by this work — recorded so it is not "found" later |

---

## 4. The options (decided — Option C approved 2026-09-07)

| | A · Repurpose `shareWithCallers` | B · New bit + nested switch | **C · New bit, ONE three-way choice (approved)** | D · One enum field replaces both bits |
|---|---|---|---|---|
| Provider sees | one switch | two stacked switches | one question, three answers | same as C |
| Flexibility | loses "answers aloud, never sends" (owner-locked) | keeps it | keeps it | keeps it |
| Storage | rename + every gate re-read | +1 bool | **+1 bool; every shipped gate on `shareWithCallers` stays byte-identical** | one new field, `shareWithCallers` deleted |
| Risk to shipped, audited behaviour | medium | low | **lowest — additive** | highest |

Rejected outright: a receptionist pseudo-audience inside `searchAudience`; using `docType`; a bit on the index card.

---

## 5. The design, precisely

### 5.0 ‼️ THE RULES THE BACKEND MUST FOLLOW — and where each one is enforced

> Written in the owner's words, then mapped to the exact code. **Every gate calls ONE rule**, so a gap cannot open in
> one place without opening everywhere — the same construction `KnowledgeSearchAudienceRule` gives Team search.

```
KnowledgeReceptionistRule.Decide(status, usedByReceptionist, shareWithCallers)
    => (Answerable, Sendable)

Answerable = status is Ready  AND  usedByReceptionist
Sendable   = Answerable       AND  shareWithCallers          (Sendable ⇒ Answerable, by construction)
```

**RULE 1 — "NOT USED BY THE RECEPTIONIST" ⇒ THE RECEPTIONIST CAN NEVER READ A WORD OF IT.**

| Path | Enforcement |
|---|---|
| `search_knowledge` and `answer_catalog_question` (`SearchAsync`, main results **and** the overview companion) | post-filtered by the registry sweep's `Answerable` set — fail-closed: a failed read fails the retrieval |
| the send handle resolution (`GetByRefsAsync`, used by the send tool **and** the excerpt assembler's neighbour read) | resolves refs only against the `Answerable` set |
| whether the tool and the prompt block exist at all (`HasKnowledge`) | any `Answerable` row in the sweep — none ⇒ no tool, no prompt tokens |
| the send tool's live re-check (`FilterSendable`, `ResolveSendableImages`) | `Answerable && Sendable` on the row read at that moment |
| the delivery processor | re-reads each item's row before rendering (§5.3) |
| Ask Clinket | never consults the bits — an internal file stays findable by its team |

**RULE 2 — "ANSWERS CALLERS, NEVER SENDS ANYTHING" ⇒ IT MAY READ AND QUOTE ALOUD; THE PLATFORM NEVER SENDS ITS TEXT OR
PICTURES IN WRITING.**

| Path | Enforcement |
|---|---|
| the search result | no `ref` and no `imageRef` is stamped on any passage of a row with `Sendable=false` (sweep + images allow-list), so the model cannot name it to the send tool |
| the send tool | `FilterSendable` / `ResolveSendableImages` drop the row's cards and pictures at the call (live row) |
| the delivery processor | drops the item at render if the row changed since (§5.3) |
| pictures | the per-picture tick is honoured only under `Sendable` |

**RULE 3 — "ANSWERS CALLERS AND CAN SEND THEM THE DETAILS" ⇒ today's behaviour, unchanged: the relevant pieces only,
never the whole file, pictures per tick.**

**RULE 4 — TEAM SEARCH AND THE RECEPTIONIST NEVER MOVE EACH OTHER.** Two rules, two allow-lists, two endpoints.

**RULE 5 — A TYPED FAQ OBEYS THE SAME THREE RULES.** No special case (§5.5).

**RULE 6 — AN ABSENT FIELD BEHAVES EXACTLY AS THAT ROW BEHAVES TODAY.** Every writer stamps both bits, so absence exists
only on rows written before the deploy (sandbox rows): `usedByReceptionist` absent ⇒ answerable (every row is today);
`shareWithCallers` absent ⇒ no send handle (the shipped ref gate). Nothing existing changes behaviour by the deploy alone.

### 5.1 Data — §0.7 table (owner approved the field 2026-09-07; two items are new in v3 and marked)

| Column | Answer |
|---|---|
| **What** | `KnowledgeDocument.usedByReceptionist` : `bool`, JSON `usedByReceptionist`, default **true** in the class, **always written**, on **every row — files AND typed FAQs** (v3: FAQs added) |
| **Who reads it** | `KnowledgeDocumentRepository.ListReceptionistGatesAsync` (v3: the ONE sweep behind `SearchAsync`, `GetByRefsAsync` and `HasKnowledge`) · `ListSendableImageRefsAsync` · MCP `FilterSendable` / `ResolveSendableImages` · `VoicePostCallProcessorFunction` delivery re-check (v3) · `KnowledgeController.ToDto` · ingest `ApplyProviderChoices` — **all through `KnowledgeReceptionistRule`** |
| **Who writes it** | `ConfirmUploadsAsync` (create + replace) · `CreateFaqAsync` / `UpdateFaqAsync` (v3) · `SetReceptionistAccessAsync` · `MarkDeletingAsync` (false) · ingest `ApplyProviderChoices` (tightening only) |
| **Why not a column / enum / constant** | a Cosmos row, one-to-one, per-item provider choice |
| **Why not already stored** | `shareWithCallers` = may SEND; `searchAudience` = the team; `docType` = a searchable label; `status` = lifecycle |
| **Cost** | ~30 bytes per row · no search-index field · no RU on Ask Clinket · the voice path's registry reads go from two queries to **one** (§6) |
| **What breaks if omitted** | a business's internal document or FAQ is read aloud to phone callers |
| **v3 — optional index item, MEASURED FIRST** | `IncludedPath /usedByReceptionist/?` and `/shareWithCallers/?` on `KnowledgeBase` make the single sweep index-served. Added **only if** the RU measurement in the build shows the projection loads documents without them; if it does not, they are not added. The measurement and the decision are reported in the audit |
| **v3 — Service Bus message shape (not §0.7, listed for completeness)** | `VoiceMaterialItem.DocId` (required) rides the existing `VoicePostCallMessage` so delivery can re-check the row. No new queue, no ARM |

### 5.2 Wire — one enum, one endpoint, one flag

- `KnowledgeReceptionistAccess { NotUsed, AnswersOnly, AnswersAndSends }` (string JSON).
- `PATCH knowledge/documents/{docId}/receptionist` body `{ access }` — nullable `[Required]` enum. `voice.settings.manage`.
  Accepts file rows **and FAQ rows**. **Replaces** `PATCH …/sharing` (deleted with `KnowledgeSharingDto` and both clients'
  callers — no old paths).
- `KnowledgeConfirmFileDto.ReceptionistAccess?` replaces `ShareWithCallers?` (null = leave alone on a replace; on a new row
  the server default of §5.4 applies).
- `KnowledgeFaqRequestDto.ReceptionistAccess?` (v3) — null = default on create, leave alone on edit.
- `KnowledgeDocumentDto.ReceptionistAccess` replaces `ShareWithCallers` — the **derived** value from the two bits, for
  files and FAQs alike (one fact on the wire, never two booleans a client combines).
- `KnowledgeListResponseDto.ReceptionistAvailable` (v3) — the server's answer to "does this business have the AI
  receptionist" (§5.4). The apps draw the choice, the marks and the receptionist words **only when true**.
- Server mapping, one CAS write, row-only: `NotUsed` ⇒ `usedByReceptionist=false` **and** `shareWithCallers=false` (belt
  and braces: a path that only knows the old bit still cannot send) · `AnswersOnly` ⇒ true/false · `AnswersAndSends` ⇒
  true/true. Unchanged ⇒ no write. `Deleting` ⇒ refused. `Processing` ⇒ allowed.

### 5.3 Gates — voice path only, one sweep, one rule, one closed window

| Gate | Change |
|---|---|
| **The sweep** `ListReceptionistGatesAsync(businessId)` (v3 — decision 5 approved: fold now) | ONE partition query projecting `docId, status, usedByReceptionist, shareWithCallers` over every row; C# applies `KnowledgeReceptionistRule` and returns `{DocId, Answerable, Sendable}` per row. **Replaces** `ListRetrievableDocIdsAsync` and `ListRefSuppressedDocIdsAsync`. Fail-closed: a failed read fails the retrieval (today the ref half was fail-soft — an answer without handles on a partial failure no longer exists; both reads hit the same partition, so the case was theoretical) |
| `SearchAsync` (main + companion) | `Answerable` set as the post-filter; `Sendable=false` ⇒ no `ref` |
| `GetByRefsAsync` | resolves against the `Answerable` set |
| `ListSendableImageRefsAsync` | stays its own read (needs the picture array, fail-soft); projects `usedByReceptionist` and applies the rule in C# |
| `HasKnowledge` (`FullProviderContextService`) | `any(Answerable)` from the same sweep. `CountReadyAsync` **stays** for Ask Clinket's profile line (scenario 20) |
| MCP `FilterSendable`, `ResolveSendableImages` | the rule on the live row, file or FAQ alike |
| **Delivery re-check** (v3) `VoicePostCallProcessorFunction.ProcessSendMaterialInfoAsync` | before rendering: one point read per distinct `DocId` in the excerpt (≤ 4), `Sendable` per item; items that fail are dropped; nothing left ⇒ the existing `NotifyMaterialDeliveryFailedAsync` + admin alert with reason `material_no_longer_shared`. An item without `DocId` (a message from a pre-deploy producer) is dropped, never delivered blind |
| Ingest `ApplyProviderChoices` | `if (!incoming.UsedByReceptionist) survivor.UsedByReceptionist = false;` — tightening only |
| `RealtimeSessionPayloadBuilder`, prompt text, `MaterialSendRule` | **no change** |
| Ask Clinket (`SearchForProviderAsync`, `ResolveAsync`, `SearchKnowledgeTool`) | **no change**; `GetBusinessProfileTool` reads `CountReadyAsync` itself |

### 5.4 "Does this business have the receptionist?" — ONE seam, and the defaults that follow from it

The owner's future is undecided (a receptionist subscription, a search subscription, plans that include one and not the
other). So the platform asks that question in **exactly one place**, and nothing else ever decides it:

```
IReceptionistAvailability.IsAvailableAsync(businessId)
  today  = PaymentSettings.Enabled && PaymentSettings.AiAssistantEnabled            (the platform, same expression AppConfig serves)
           && profile.VoiceAssistant.Status != NotInvited                            (the business — THE AI ASSISTANT PAGE'S OWN SWITCH:
                                                                                      a payment or a trial enrols NotInvited/Cancelled → Invited,
                                                                                      so "not NotInvited" is "has paid or is in trial", number or not)
  later  = the plan entitlement — swap the implementation, touch nothing else
```

‼️ **Ruled by the owner 2026-09-07 (round 3): subscription-based, not invitation-based, and the same switch the AI
Assistant settings page uses** (paid or trial ⇒ the form; otherwise the marketing content; a number need not be assigned).
The page's switch is `status !== "NotInvited"` on both apps (`AiSurfaceGate.jsx:96`, `AiSurfaceGate.tsx:110`), and
`AiAddOnService.EnsureProvisioningAsync` is what moves the status off NotInvited on purchase or trial. Nuance stated in
`PLAN.md` §9 Q2: `Cancelled` and a lapsed subscription therefore still read as available, exactly as the page still shows
its form for them.

Registered in the API host only. Its consumers, all of them:

| Consumer | Uses it for |
|---|---|
| `KnowledgeController.ListKnowledge` | `ReceptionistAvailable` on the list — the apps draw or hide the choice, the marks and the receptionist words from this flag alone, never from their own voice screens |
| `ConfirmUploadsAsync` (new row), `CreateFaqAsync` | the **default** when the client sent no value: available ⇒ `AnswersAndSends` · not available ⇒ `NotUsed` |
| nothing else | the gates never consult availability — they follow the **stored** bits, so a business that gains or loses the receptionist changes nothing about what its items say until somebody chooses |

Why hide rather than disable: the owner's rule — a provider must not see something they do not have and cannot
understand. Why `NotUsed` when hidden: the owner's rule — nothing an internal document says may become audible the
day a receptionist appears; the provider chooses item by item, and the enable moment tells them so (§5.6).

The client always sends the value it showed; when the choice is hidden it sends nothing and the server default rules.
Cost: one profile point read per list or confirm request (~1 RU; the list is polled four times per ladder).

### 5.5 FAQs, the platform switch, pictures

- **Typed FAQs carry the choice** (v3). The FAQ editor gets the same "AI receptionist" box under the answer; it saves
  **with the FAQ's own Save** (a FAQ is written and saved as one thing; the Document editor's box saves on tap because
  that editor's Save belongs to the type and links). FAQ rows carry the same three marks; FAQs are always Ready.
  `hasKnowledge` counts a FAQ only when used. Why: a FAQ typed by a business without the receptionist is internal
  knowledge exactly like its files, and Rule 5 says no special case. Team search still does not apply to FAQs (M6 §7).
- `MaterialSharingEnabled=false`: two answers instead of three; a stored "Answers & sends" displays as "Answers callers";
  only the exclusion mark is drawn.
- Pictures: ticks live only under Answers & sends; otherwise the panel is dimmed with one sentence naming the choice.

### 5.6 The provider-facing design (sheet K1)

**With the receptionist** — Document editor: the "AI receptionist" box (three radios, save-on-tap) above the unchanged
Team search box. FAQ editor: the same box under the answer, saved with the FAQ. Upload: a third picker per file. Rows:
`Details can be sent` · `Answers only` · `Not for callers` on files **and FAQs**. Phone: same rules, its own components.

**Without the receptionist** — no box in either editor, no picker at upload, no receptionist marks, and the page speaks
of *Clinket* and *your team*, never of a receptionist. Everything stored is `Not used`.

**The enable moment** — the AI Voice Assistant page's knowledge slot gains ONE state: items exist and none is used ⇒
*"Choose what your receptionist may answer from"* with the sentence of scenario 5 and a button to AI Knowledge. The
existing summary counts **used** items only. A business that has already chosen (some used, some not) sees the plain
summary — no reminder about a choice it made.

**Copy plan for a page both kinds of business read** (18 web + 19 phone sentences name the receptionist today):

| Sentence | Treatment |
|---|---|
| page subtitle · FAQ section subtitle · empty-state title | **two variants**, chosen by `ReceptionistAvailable` — these three define what the page is for |
| upload processing hint · delete confirms (file, FAQ) · unlinked-offering hint · analysing / stalled notes · drafts "still uses" / "keeps answering" lines | **one neutral sentence each**, for everyone: *Clinket* is the actor (*"It can be searched the moment it shows Ready"*, *"Clinket keeps answering from this document the whole time"*). A receptionist customer loses an incidental mention; nothing else |
| the nudge on the AI Voice Assistant page | unchanged words — that page exists only with the receptionist |
| `knowledge.sharing.*` (switch label, helper, upload hint) | retired, replaced by `knowledge.receptionist.*`, drawn only when available |

Exact words: sheet K1 §9.

---

## 6. Cost and performance

| Path | Today | After | Note |
|---|---|---|---|
| Voice search — registry reads | `ListRetrievableDocIdsAsync` (index-only) ∥ `ListRefSuppressedDocIdsAsync` (loads ≤20 file rows) ∥ images | **one sweep** ∥ images | one round trip fewer per search. The sweep projects two unindexed fields over ≤220 small rows; whether Cosmos serves it from the index with two added paths, or loads the rows either way, is **measured** on the CA sandbox during the build (RU headers, before/after) and decides the optional index item of §5.1 |
| Voice — prompt tokens | knowledge block + tool when any Ready item | same when any **used** item; **zero** when none | strictly ≤ today |
| Voice — `HasKnowledge` | one COUNT per 5-min cache | `any(Answerable)` from the sweep, per 5-min cache | negligible |
| Material delivery | render + send | + ≤ 4 point reads | closes the window of scenario 18 |
| Knowledge list / confirm / FAQ create | — | + 1 profile point read (availability) | ~1 RU |
| Ask Clinket | — | **unchanged** | no retrieval code touched |
| Search index / ingest / embeddings / Service Bus queues / ARM | — | **unchanged** | a flip never touches a card |

---

## 7. The page gate — OUT OF SCOPE (owner, 2026-09-07)

Today the AI Knowledge page and its menu entry sit behind the receptionist enrolment on both apps. The owner's
direction: one AI subscription will cover search and the receptionist, and the gate is opened as part of that change.
This programme touches **no** gate, menu entry or `AiSurfaceGate`. It designs every control as if the lock were absent,
which is exactly what §5.4 does: the page may be reached by a business without the receptionist, and then it hides the
choice and stores `Not used`.

---

## 8. Change list by repository (after approval)

| Repo | Change |
|---|---|
| `clinqetshared` | `KnowledgeReceptionistAccess` enum · `KnowledgeConfirmFileDto.ReceptionistAccess` (replaces `ShareWithCallers`) · `KnowledgeFaqRequestDto.ReceptionistAccess` · `KnowledgeDocumentDto.ReceptionistAccess` (replaces `ShareWithCallers`) · `KnowledgeListResponseDto.ReceptionistAvailable` · `KnowledgeReceptionistAccessDto` (replaces `KnowledgeSharingDto`) · `VoiceMaterialItem.DocId` |
| `clinqetcore` | `KnowledgeDocument.UsedByReceptionist` · `KnowledgeReceptionistRule` (beside `KnowledgeSearchAudienceRule`) · `IReceptionistAvailability` · `IKnowledgeDocumentRepository.ListReceptionistGatesAsync` (replaces the two ids methods) · `IKnowledgeManagementService.SetReceptionistAccessAsync` (replaces `SetShareWithCallersAsync`), `CreateFaqAsync` / `UpdateFaqAsync` gain the value · repository interface comments |
| `clinqetinfrastructure` | repository sweep + images read + `CountReadyAsync` kept · `ReceptionistAvailability` (payments settings + profile status) · `FullProviderContextService.HasKnowledge` from the sweep · `GetBusinessProfileTool` reads `CountReadyAsync` · `KnowledgeManagementService`: defaults by availability, replace/edit posture, the new setter, FAQ create/edit, `MarkDeletingAsync` · `MaterialExcerptBuilder` stamps `DocId` per item · 5 backend catalogues: `Error_KnowledgeReceptionistAccessRequired` |
| `clinqetapi` | `KnowledgeController`: `/receptionist` endpoint (deletes `/sharing`), `ReceptionistAvailable` on the list, `ToDto` derivation, FAQ endpoints pass the value · DI for the availability seam · unit + integration tests (real Cosmos: the sweep's truth table incl. absent fields; defaults by availability; FAQ rows; the merge) |
| `clinqetmcp` | `KnowledgeTools.FilterSendable` / `ResolveSendableImages` through the rule (file and FAQ alike) · `ProviderKnowledgeSearchServiceTests` (a NotUsed row never reaches the model, the companion or `GetByRefsAsync`; byte-identity when all rows are used; one sweep issued, not two) · `KnowledgeToolsTests` |
| `clinqetfuncations` | delivery re-check in `ProcessSendMaterialInfoAsync` + tests (drop one item; drop all ⇒ notice + alert; missing `DocId` ⇒ dropped) · `KnowledgeIngestProcessorFunction.ApplyProviderChoices` + real-Cosmos merge tests · `RealtimeSessionPayloadBuilderTests` unchanged |
| `clinqetwebpartnerapp` | `DocumentDetailsModal` (box replaces switch, hidden when unavailable) · `KnowledgeFaqModal` (box, saved with the form) · `UploadKnowledgeModal` (picker, hidden when unavailable) · `KnowledgePage` (three marks on files and FAQs, hidden when unavailable; copy variants) · `VoiceAssistantPage` / `KnowledgeNudge` (used-only counts + the "choose" state) · `KnowledgeImagesPanel` (dim rule) · `knowledgeServices` · twins `lib/knowledge/receptionistAccess.js` · `knowledge.receptionist.*` ×5, `knowledge.sharing.*` deleted ×5, neutral rewrites ×5 · tests · analytics `receptionist_access_change` (literal) · **no gate or menu change** |
| `clinqetmobilepartnerapp` | `Knowledge/index.tsx` editors (file + FAQ), upload `PickerField`, row pills, hidden state, copy variants · voice-assistant knowledge slot · `knowledgeService.ts` · twin `lib/knowledge/receptionistAccess.ts` · `KNOWLEDGE.RECEPTIONIST.*` ×5, `SHARING_*` deleted ×5, neutral rewrites ×5 · parity + screen-scan tests · **no gate or menu change** |
| `cosmosindexsetup` | **nothing**, unless the §5.1 measurement earns the two index paths (then `CosmosContainerPolicies.KnowledgeBase` + the owner runs the tool per region) |
| `azureautomation` | **nothing** |
| Skills ×4 + memory | voice skill (knowledge + send + delivery sections), business-search skill §5/§16, partner-app, provider-mobile |

---

## 9. Proof that nothing degrades, and that no gap exists

1. **Voice, by construction**: with every item used, the sweep's `Answerable` set equals today's Ready set and every
   `Sendable` equals today's ref gate. Re-run the runbook battery (`C:\Nik\knowledge-metadata-separation\battery\`, 15
   probes) on the CA sandbox before and after: every probe finds the same passage, same handles.
2. **Rule 1 and Rule 2 on the real engine**: integration tests with rows in every combination (used/unused × share on/off
   × Ready/Processing × file/FAQ × field present/absent) prove the sweep, the images read, `GetByRefsAsync`, the MCP live
   check and the delivery re-check all agree with `KnowledgeReceptionistRule`. A sabotage on each gate must fail its test.
3. **One rule, structurally**: a convention test asserts every gate site calls `KnowledgeReceptionistRule` and that no
   file outside it compares `UsedByReceptionist` or `ShareWithCallers` by hand.
4. **Ask Clinket**: retrieval untouched; existing isolation and audience suites green; a NotUsed file asserted findable by
   its audience; `GetBusinessProfileTool` asserted to print `hasKnowledgeDocuments: true` for an all-NotUsed library.
5. **Availability seam**: unit matrix over every `VoiceAssistantStatus` × platform flag; defaults asserted per branch.
6. **Cost**: RU of the sweep measured before/after; the index-path decision recorded with its numbers.
7. **UI**: every sheet state on web and phone, including the hidden state and the enable moment; the orphan-key sweep in
   both directions including test folders.

---

## 10. The audit owed after the build (mandatory)

Every gate against the rule (read / send / pictures / `HasKnowledge` / merge / delete / delivery) · the availability seam
as the only place that asks · Ask Clinket byte-identity · the battery · RU before/after · every sheet state on web **and**
phone (with and without the receptionist) · localization completeness and the orphan direction · accessibility (a real
`radiogroup`, one live region, 44px on the hit slop) · config hygiene (no `/sharing`, no `KnowledgeSharingDto`, no
`knowledge.sharing.*`, no `sharing_toggle`, no `ListRetrievableDocIdsAsync`/`ListRefSuppressedDocIdsAsync`) · skills ×4 +
memory · `git status` clean in every repo.

---

## 11. Decisions

**Approved 2026-09-07:** (1) Option C · (2) `usedByReceptionist` · (3) the words of v2 · (4) editable while Processing ·
(5) fold the two registry reads now.

**Approved 2026-09-07 (round 3), all six — see `PLAN.md` §1 for the owner's words:**

| # | Decision | Ruling |
|---|---|---|
| A | Typed FAQs carry the same choice (§5.5) | approved |
| B | The delivery-time re-check (§5.3) | approved (no cost or performance impact: ≤ 4 point reads per send) |
| C | Copy for a page both kinds of business read (§5.6) | approved — do it to the best standard; every word in `PLAN.md` §5 |
| D | The boundary of "Answers only" | **closed**: a quote or booking the receptionist writes itself is fine; it may never turn the file's text or pictures into a PDF and send those — which is exactly what the design enforces |
| E | The two index paths | approved conditionally — measured on the Canada sandbox; kept only if results are identical and cost/performance improve; detailed testing owed |
| F | "Has the receptionist" | **subscription-based**: the AI Assistant page's own switch (§5.4) |

The mockup gate was **waived** by the owner for this programme ("no mockup is needed as long as you do it carefully…");
sheet K1 stands as the drawing the build follows.

---

## 12. Owner feedback, and what it changed

| When | The owner said | Changed |
|---|---|---|
| 2026-09-07 round 1 | The gate is a recent change; one AI subscription will handle both; design as if the lock is not there | §7 out of scope; no gate/menu work; the choice is designed for every business on the page |
| round 1 | "No backfill — is the Not used default backfill?" | It was a forward default. v2 withdrew it for one default |
| round 1 | "If that flag is not set, search won't work too — fix it" | Corrected: today the flag never gates Ask Clinket's search; its one Ask Clinket use (the profile line) keeps "any Ready item" through its own count |
| **round 2** | Future plans may include search without the receptionist; **hide the choice when the business has no receptionist, store the safe value, show it with the saved value when enabled; the provider may then choose item by item; backend must follow every flag with no gap; extremely user-friendly, no technical words** | **v3**: the availability seam (§5.4) with hide + `NotUsed`; the enable moment (§5.6); the rules in bold with their enforcement map (§5.0); one rule for every gate; FAQs included (§5.5); the delivery window closed (§5.3); the hidden-state copy plan; the sheet redrawn |
| **round 3** | Hidden + Not used agreed · B agreed · C "super important, best practice" agreed · D fine as long as no PDF/pictures are sent · E: do it if results are not degraded and cost/performance improve, test in detail on Canada · **F is subscription-based, the AI Assistant page's own switch** · A agreed · **no mockup approval needed**, build carefully, mobile too, web responsive, multi-dimensional audit at the end | §5.4 F rewritten to the page's switch; §11 closed; `PLAN.md` written (order, words, tests, measurements, audit, open questions); sheet §8/§11 updated; K1 approved by waiver |
| **round 5 (2026-09-08)** | Shown the two-bit storage: "one field in cosmos handle all three choice is best solution" · no backfill, it is all sandbox · no workaround, no backward compatibility, no shortcut · and check whether the same mistake was made anywhere else | The row now stores ONE word `receptionistAccess` (fail-closed on anything it does not recognise); the two bits are gone from the entity, DTOs, queries, tests and both sandboxes; `Tighter` replaces the two tightening lines; the guards gained a non-empty-scan assertion; two profile reads moved off doomed paths; five test fixtures that leaned on a permissive default now state their shape. `PLAN.md` §11 is the record |
| **round 4 (build, 2026-09-07 night)** | Q2 confirmed as recommended — the choice shows exactly when the AI Assistant page shows its form (platform flags AND a receptionist state other than NotInvited; cancelled/paused/lapsed keep their saved choices); then: confirm and continue, finish it all, no degradation of any output, the multidimensional audit at the end with every finding fixed before closing | P1–P10 built and audited on web AND phone; experiment E measured identical on every read and write ⇒ REJECTED (policy unchanged); the Ask Clinket profile fact moved to an index-only `AnyReadyAsync`; `PLAN.md` §10 is the build record, `findings/MEASUREMENTS.md` the numbers |
