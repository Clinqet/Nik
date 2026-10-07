# AI Knowledge — receptionist access per item · BUILD PLAN

> **Build authority for this programme.** `ANALYSIS.md` is the design (its §5.0 rules are binding); this file is the
> ordered work, the exact words, the measurements and the audit. Written 2026-09-07 after the owner approved the design
> and waived a separate mockup approval ("no mockup is needed as long as you do it carefully"). Sheet K1 is therefore the
> drawing the build follows, not a gate still owed.
>
> **State: PLANNED. Nothing built.** §9 lists what the owner must still answer before the first line of code.

---

## 0. Register

| # | Sheet | Status |
|---|---|---|
| K1 | `C:\Nik\Data\mockups\knowledge-receptionist-access\index.html` (v3) | **APPROVED BY WAIVER 2026-09-07** — owner: *"no mockup is needed as long as you do it carefully and good looking, utilise the UI, responsive, modern looking, easy to understand and follow, not confusing… don't forget about the mobile app at all"*. Governs every state in ANALYSIS §5.6. Supersedes M6 §1 on the "Phone receptionist" box, and `knowledge-document-sharing/v3-upload-and-list.html` Decisions 1 and 3 |

## 1. Decisions on record (owner, 2026-09-07, in conversation)

| # | Decision | Owner's words / ruling |
|---|---|---|
| 1 | Option C — one new bit `usedByReceptionist`, ONE three-way choice on the wire and screen | approved |
| 2 | Field name `usedByReceptionist`, default true, absent = today's behaviour | approved |
| 3 | Words: "AI receptionist" · "Answers callers and can send them the details" · "Answers callers, never sends anything" · "Not used by the receptionist" · marks `Details can be sent` · `Answers only` · `Not for callers` | approved |
| 4 | Changeable while the file is Processing | approved |
| 5 | Fold the two voice registry reads into one sweep — **now** | approved ("no… not leave this… in place") |
| A | Typed FAQs carry the same choice, hidden the same way | approved |
| B | Delivery-time re-check of each item's row | approved ("if no performance/cost impact") — cost stated in ANALYSIS §6: ≤ 4 point reads per send |
| C | Copy for a page both kinds of business read: 3 sentences get a no-receptionist variant, the rest become neutral | approved — "super important… best practice and standard way" |
| D | "Answers only": the receptionist may still write a price it read into a quote or booking it authors and send THAT; it may never turn the file's text or pictures into a PDF and send those | **closed as the design already is** — no prompt change |
| E | The two index paths on `KnowledgeBase` | approved **conditionally**: measured on the Canada sandbox first; added only if results are not degraded (must be identical) and cost/performance improve. Detailed testing owed |
| F | "Has the receptionist" = **subscription-based, not invitation-based** — the same switch the AI Assistant settings page uses: paid or in trial ⇒ the form; otherwise the marketing content. A number need not be assigned | approved — implemented as the page's own switch, §3.3 |
| G | Default when the receptionist is not available: control hidden, stored **Not used**; when available: **Answers and can send** | approved |
| H | No separate mockup approval; quality over speed; no workaround; ask if unsure; mobile mirrors web; web responsive; multi-dimensional audit at the end with every finding fixed | owner's standing instruction for this build |

---

## 2. Preconditions before the first edit

1. ‼️ **No other session may be building or testing in `C:\Nik` while this build runs** (owner rule). Six peer sessions were
   live at planning time and five repos carried their uncommitted work (Ask Clinket "topic" work in `clinqetapi`,
   `clinqetinfrastructure`, `clinqetcore`, `clinqetshared`, `clinqetwebpartnerapp`). I build only after the owner confirms
   a window, and I `git status` twice (the first call is stale in these repos) before and after every phase.
2. ‼️ **Never `git checkout/restore/reset/stash/clean`** in any tree. Sabotage copies go to the session scratchpad.
3. Canada sandbox credentials are read at runtime from `C:\Nik\cosmosindexsetup\appsettings.ca.json` (Cosmos, Search,
   Storage) and `clinqetfuncations\Clinqet.Communications\appsettings.json` (embeddings) — never copied into a file.
   Probe scripts live in the scratchpad only.
4. Heads at planning: `clinqetinfrastructure d13222f` · `clinqetapi 9f776d6` · `clinqetwebpartnerapp 230a134f` ·
   `clinqetmobilepartnerapp 380a7e2f`. Repos can skew mid-session; a build error in a file I never touched means a
   sibling moved — re-pull, never assume.

---

## 3. The design, pinned for the build (deltas from ANALYSIS are marked)

### 3.1 One rule, `clinqetcore/Interfaces/Knowledge/KnowledgeReceptionistRule.cs`

```
KnowledgeReceptionistRule.Decide(string? status, bool? usedByReceptionist, bool? shareWithCallers)
    => (bool Answerable, bool Sendable)

Answerable = KnowledgeAnswerableRule.IsAnswerable(status) && (usedByReceptionist ?? true)
Sendable   = Answerable && (shareWithCallers ?? false)      // absent share ⇒ no handle: the shipped ref-gate posture
KnowledgeReceptionistRule.Access(bool used, bool share) => NotUsed | AnswersOnly | AnswersAndSends   // the wire value
KnowledgeReceptionistRule.Bits(KnowledgeReceptionistAccess) => (used, share)                       // NotUsed ⇒ (false,false)
```

Every gate calls `Decide`; `ToDto` and the setter call `Access`/`Bits`. A convention test (§6) asserts no other file
compares `UsedByReceptionist` or `ShareWithCallers` by hand.

### 3.2 One sweep, `IKnowledgeDocumentRepository.ListReceptionistGatesAsync(businessId)`

```sql
SELECT c.docId, c.status, c.usedByReceptionist, c.shareWithCallers FROM c WHERE c.type = @type
```

Returns `IReadOnlyList<KnowledgeReceptionistGate { DocId, Answerable, Sendable }>`. Replaces `ListRetrievableDocIdsAsync`
and `ListRefSuppressedDocIdsAsync` (both deleted with their tests rewritten). Fail-closed. `ListSendableImageRefsAsync`
keeps its own read (the picture array) and adds `c.usedByReceptionist` to its projection, evaluated through `Decide`.
`CountReadyAsync` stays (Ask Clinket's profile line). A new `CountReceptionistReadyAsync` is **not** added — `HasKnowledge`
derives from the sweep.

### 3.3 One seam, `IReceptionistAvailability` (‼️ F as ruled)

```
IsAvailableAsync(businessId)
  = PaymentSettings.Enabled && PaymentSettings.AiAssistantEnabled             // the platform, the AppConfig expression
  && profile.VoiceAssistant?.Status is not null and != NotInvited             // the AI Assistant page's own switch:
                                                                              // payment or trial enrols NotInvited/Cancelled → Invited,
                                                                              // so "not NotInvited" IS "has paid or is in trial"
```

- Implemented in `clinqetinfrastructure/Services/Knowledge/ReceptionistAvailability.cs`, registered in the **API host only**.
- Consumers: `KnowledgeController.ListKnowledge` → `ReceptionistAvailable` on the list; `KnowledgeController` confirm and FAQ
  create → fills a **null** access with the default (`available ? AnswersAndSends : NotUsed`) **before** calling the
  service, for new rows only. The service keeps today's `?? AnswersAndSends` fallback for callers that bypass the
  controller (tests). Nothing else consults it.
- ‼️ Two nuances stated for the owner (§9 Q2): `Cancelled` and a **lapsed** trial or subscription keep the status off
  `NotInvited`, so they read as **available** — exactly as the AI Assistant page keeps showing its form for them today.
  Billing's own truth (`AiAddOnService.GetVoiceAddOnBillingStatusAsync`: Paid/Trialing vs Lapsed/None) is one swap of this
  class away if the owner wants lapse to hide the choice.

### 3.4 Delivery re-check (B)

- `VoiceMaterialItem.DocId` (required) — stamped by `MaterialExcerptBuilder` from the card's `DocId` (photo items from the
  selection's `DocId`).
- `VoicePostCallProcessorFunction.ProcessSendMaterialInfoAsync`: after the payload guards and before rendering, one
  `GetAsync` per distinct `DocId` (≤ 4), `Decide(...).Sendable`; items that fail are dropped; an item with no `DocId` is
  dropped; nothing left ⇒ `NotifyMaterialDeliveryFailedAsync` + `RaiseMaterialDeliveryFailedAsync(..., "material_no_longer_shared")`.
  The function gains `IKnowledgeDocumentRepository` (already registered in the Functions host) — its
  `ServiceRegistrationSelfContainmentTests` contract row is updated.

### 3.5 FAQs (A)

- `KnowledgeFaqRequestDto.ReceptionistAccess?`; `CreateFaqAsync(..., KnowledgeReceptionistAccess access)`,
  `UpdateFaqAsync(..., KnowledgeReceptionistAccess? access)` (null = leave alone).
- `PATCH documents/{docId}/receptionist` accepts FAQ rows too (the row mark opens the FAQ editor; the editor saves the
  choice with its own Save through the FAQ endpoints).
- `ToDto` derives the same wire value for FAQ rows; `hasKnowledge` counts a FAQ only when Answerable.

### 3.6 Wire (unchanged from ANALYSIS §5.2)

`KnowledgeReceptionistAccess` enum · `PATCH …/receptionist` (`KnowledgeReceptionistAccessDto { Access? [Required] }`) replaces
`/sharing` · `KnowledgeConfirmFileDto.ReceptionistAccess?` replaces `ShareWithCallers?` · `KnowledgeDocumentDto.ReceptionistAccess`
replaces `ShareWithCallers` · `KnowledgeListResponseDto.ReceptionistAvailable` · `Error_KnowledgeReceptionistAccessRequired` ×5.

### 3.7 Found while planning — one pre-existing defect, one line, adjacent (§9 Q3)

`clinqetwebpartnerapp/src/components/businessSearch/BusinessSearchPage.jsx:111` reads `response?.data?.data` and tests
`Array.isArray(rows)`. The knowledge list endpoint returns an OBJECT (`KnowledgeListResponseDto`), so the check is always
false, `hasDocuments` stays `null`, and the "You have no documents yet" state can never render on web. The phone reads
`list?.documents` and is correct. Fix: `response?.data?.data?.documents`. It is Ask Clinket's file, not this feature's;
proposed for this build because the same list DTO is being changed and the audit would otherwise "find" it again.

---

## 4. Build order (one repo at a time, in the platform's pipeline order)

| Phase | Repo | Work | Exit criterion |
|---|---|---|---|
| **P0** | — (Canada sandbox, read-only) | Baseline: battery ×2 identical (`C:\Nik\knowledge-metadata-separation\battery\battery.js`, business SX3SG2 or the richest CA business live today); RU of today's `ListRetrievableDocIdsAsync` and `ListRefSuppressedDocIdsAsync` queries on the same partition, 10 runs each, via a scratchpad probe reading `x-ms-request-charge` | numbers recorded in `findings/MEASUREMENTS.md` |
| **P1** | `clinqetshared` → `clinqetcore` | enum · DTO fields · `VoiceMaterialItem.DocId` · entity bit (`[JsonProperty("usedByReceptionist")] = true`) · `KnowledgeReceptionistRule` · `IReceptionistAvailability` · repository interface (sweep in, two methods out) · management interface (setter renamed, FAQ signatures) · `KnowledgeReceptionistGate` record | both build; rule unit tests green (truth table incl. absent) |
| **P2** | `clinqetinfrastructure` | repository sweep + images read · `ReceptionistAvailability` · `KnowledgeManagementService` (confirm/replace posture, setter, FAQ create/edit, `MarkDeletingAsync` both false) · `ProviderKnowledgeSearchService` (one sweep, refs from `Sendable`, `GetByRefsAsync` from `Answerable`) · `FullProviderContextService.HasKnowledge` = any Answerable · `GetBusinessProfileTool` reads `CountReadyAsync` · `MaterialExcerptBuilder` stamps `DocId` · ingest merge line · 5 catalogues `Error_KnowledgeReceptionistAccessRequired` | builds |
| **P3** | `clinqetapi` | controller: `/receptionist` (delete `/sharing`), `ReceptionistAvailable`, default fill, `ToDto`, FAQ endpoints · DI · **tests**: rule truth table · DTO validation (`Validator.TryValidateObject`, not a status code) · controller rows · service (defaults, replace null, setter mapping, FAQ) · availability matrix (every `VoiceAssistantStatus` × platform flag) · **real Cosmos**: the sweep with rows in every combination and with absent fields; images read; the merge; the FAQ row · `BusinessSearchKnowledgeIsolationIntegrationTests` still green · profile tool prints `hasKnowledgeDocuments: true` for an all-NotUsed library · convention: every gate calls the rule; no `/sharing`, no `KnowledgeSharingDto`, no old repository methods | API unit + integration green |
| **P4** | `clinqetmcp` | `FilterSendable` / `ResolveSendableImages` through the rule (file and FAQ alike) · `ProviderKnowledgeSearchServiceTests`: a NotUsed row never reaches the model, the companion or `GetByRefsAsync`; byte-identity when every row is used; **exactly one sweep issued per search**; AnswersOnly ⇒ no `ref`/`imageRef` · `KnowledgeToolsTests` truth table · fakes updated (compile-required) | MCP unit + integration green |
| **P5** | `clinqetfuncations` | delivery re-check + tests (one item dropped; all dropped ⇒ notice + alert; missing `DocId` ⇒ dropped) · `ApplyProviderChoices` + unit and real-Cosmos merge tests · `RealtimeSessionPayloadBuilderTests` untouched | Functions unit + integration green |
| **P6** | `clinqetwebpartnerapp` | `DocumentDetailsModal` (box replaces switch; hidden when unavailable) · `KnowledgeFaqModal` (box, saved with Save) · `UploadKnowledgeModal` (picker; hidden) · `KnowledgePage` (three marks on files and FAQs; hidden; copy variants; images panel prop) · `KnowledgeNudge`/`VoiceAssistantPage` (used-only counts; the "choose" state) · `knowledgeServices` · twins `lib/knowledge/receptionistAccess.js` (`accessOf`, `markOf`, `optionsFor(materialSharingEnabled)`, `controlState`, `copyKey(base, available)`) · copy ×5 (§5) · `knowledge.sharing.*` deleted ×5 · tests replaced/added · analytics literal `receptionist_access_change` · §3.7 fix · ESLint `--quiet` 0 errors | jest green, lint 0 |
| **P7** | `clinqetmobilepartnerapp` | `Knowledge/index.tsx` (file editor box, FAQ editor box, upload `PickerField`, row pills, hidden state, copy variants) · voice-assistant knowledge slot · `knowledgeService.ts` types · twin `lib/knowledge/receptionistAccess.ts` · copy ×5 · `SHARING_*` deleted ×5 · parity + screen-scan tests · `tsc --noEmit` 0 · jest green | green |
| **P8** | Canada sandbox | RU of the new sweep (no paths) · apply `/usedByReceptionist/?` + `/shareWithCallers/?` to the CA `KnowledgeBase` container **through the tool's own policy** (`CosmosContainerPolicies.KnowledgeBase` edited, applied by a scratchpad probe that calls `ReplaceContainer` with that exact policy — the tool's bare run seeds sample data and has no containers-only switch) · RU with paths · **decision E**: keep the paths only if results are identical AND RU is lower; otherwise revert the CA policy and the code · battery after: every probe identical to P0 · sabotage every new guard (by line number, copy-restore from the scratchpad, never git) | `findings/MEASUREMENTS.md` complete |
| **P9** | all | **Multi-dimensional audit** (§7) by fresh eyes per dimension; every finding fixed; re-run every affected suite | all findings closed |
| **P10** | skills ×4 + memory | voice skill (knowledge + send + delivery), business-search skill §5/§16, partner-app, provider-mobile; memory entry; `git status` twice per repo; commits prepared per repo, **never pushed** (owner pushes in pipeline order: shared → core → infra → hosts) | clean trees, summary states what was deleted |

---

## 5. Every word (web key · phone key · text). Five languages each, authored in the catalogue's own idiom (fr-CA: no space before `?`/`!`, space before `:` kept; Latin "Clinket" in every script; ICU plurals on web, `_one/_other` on the phone)

### 5.1 New — the choice

| Web key | Phone key | English |
|---|---|---|
| `knowledge.receptionist.label` | `KNOWLEDGE.RECEPTIONIST.LABEL` | AI receptionist |
| `knowledge.receptionist.helper` | — | What your AI receptionist may do with this file when someone calls. This does not change who on your team can find it. |
| — | `KNOWLEDGE.RECEPTIONIST.HELPER_PHONE` | What your AI receptionist may do with this file when someone calls. Your team is not affected. |
| `knowledge.receptionist.faqHelper` | — | What your AI receptionist may do with this answer when someone calls. Your whole team can always find it. |
| `knowledge.receptionist.answersAndSends` | `…ANSWERS_AND_SENDS` | Answers callers and can send them the details |
| `knowledge.receptionist.answersAndSendsHint` | — | It answers from this file, and can send a caller just the relevant details to their WhatsApp or email — never the whole file. |
| `knowledge.receptionist.answersOnly` | `…ANSWERS_ONLY` | Answers callers, never sends anything |
| `knowledge.receptionist.answersOnlyHint` | — | It answers from this file aloud. Nothing from it is ever sent in writing. |
| `knowledge.receptionist.notUsed` | `…NOT_USED` | Not used by the receptionist |
| `knowledge.receptionist.notUsedHint` | — | Callers never hear anything from this file. Your team can still find it when they ask Clinket. |
| `knowledge.receptionist.answersCallers` (+ `Hint`) | `…ANSWERS_CALLERS` | Answers callers · It answers from this file aloud. (drawn only while platform sending is off) |
| `knowledge.receptionist.badgeAnswersAndSends` / `badgeAnswersOnly` / `badgeNotUsed` / `badgeAnswersCallers` | `…BADGE_*` | Answers & sends details · Answers only · Not used · Answers callers |
| `knowledge.receptionist.pickerAnswersAndSendsHint` / `pickerAnswersOnlyHint` / `pickerNotUsedHint` | `…PICKER_*_HINT` | Answers callers from this file and can send them just the relevant details. · Answers callers aloud. Nothing from this file is ever sent. · Callers never hear from this file. Your team can still find it. |
| `knowledge.receptionist.markAnswersAndSends` / `markAnswersOnly` / `markNotUsed` | `…MARK_*` | Details can be sent · Answers only · Not for callers |
| `knowledge.receptionist.changeHint` | `…CHANGE_HINT` | Change what the receptionist may do with this file |
| `knowledge.receptionist.uploadHint` | `…UPLOAD_HINT` | Your AI receptionist can answer callers from these files and, if you allow it, send a caller just the relevant details to their WhatsApp or email — never the whole file. Choose “Not used” for internal material callers must never hear. |
| `knowledge.receptionist.readOnlyAnswersAndSends` / `readOnlyAnswersOnly` / `readOnlyNotUsed` | `…READ_ONLY_*` | Your receptionist answers callers from this file and can send them the details. · …and never sends anything from it. · Your receptionist does not use this file. |
| `knowledge.receptionist.processing` | `…PROCESSING` | You can choose this now. It takes effect as soon as the file is Ready. |
| reused from the audience box | reused | Saving… · That did not save. Your choice was put back. Try again. · You are offline… · This file is being removed… · Only the owner and administrators can change this. |
| `knowledge.images.notShared` (reworded) | `KNOWLEDGE.IMAGES_NOT_SHARED` (reworded) | Pictures can be sent only when your receptionist may send details from this file. Change that under AI receptionist. |
| `knowledge.nudge.chooseTitle` / `chooseBody` / `chooseCta` | `KNOWLEDGE.NUDGE_CHOOSE_TITLE` / `_BODY` / `_CTA` | Choose what your receptionist may answer from · You’ve added documents or FAQs, but your receptionist isn’t using any of them yet. Choose which ones it may answer callers from. · Choose now |

### 5.2 Two variants (chosen by `ReceptionistAvailable`)

| Base key (with the receptionist — text unchanged) | `…NoReceptionist` / `…_NO_RECEPTIONIST` |
|---|---|
| `knowledge.pageSubtitle` · `KNOWLEDGE.SUBTITLE` | Your business’s own material beyond your services: policies, price lists, spec sheets, FAQs. Your team can ask Clinket about all of it. |
| `knowledge.faq.subtitle` · `KNOWLEDGE.FAQ_SUBTITLE` | Quick answers about your business, typed right here, no file needed. Your team can ask Clinket about them. |
| `knowledge.empty.title` · `KNOWLEDGE.EMPTY_TITLE` | Teach Clinket about your business |
| `knowledge.audience.helper` · `KNOWLEDGE.AUDIENCE.HELPER_PHONE` | Who can find this file when they ask Clinket a question. · Who can find this file when they ask Clinket. (the callers clause dropped) |

### 5.3 Neutral rewrite, one sentence each, for everyone

| Key (web · phone) | New English |
|---|---|
| `knowledge.upload.processingHint` · `KNOWLEDGE.PROCESSING_HINT` | Processing usually takes under a minute per document. It can be searched the moment it shows Ready. |
| `knowledge.deleteConfirm.body` · `KNOWLEDGE.DELETE_CONFIRM_BODY` | Clinket stops using it immediately. This can’t be undone. (phone keeps its `Delete "{{name}}"?` lead) |
| `knowledge.faq.deleteConfirm` · `KNOWLEDGE.FAQ_DELETE_CONFIRM` | Clinket stops using it immediately. (phone keeps its `Delete this FAQ?` lead) |
| `knowledge.offering.unlinkedHint` · `KNOWLEDGE.OFFERING_UNLINKED_HINT` | Leave this empty and Clinket uses this material for any question. Link offerings only to point it at the right material faster. |
| `knowledge.poll.analysingStalled` · `KNOWLEDGE.POLL_ANALYSING_STALLED` | …Clinket already answers from these documents. |
| `knowledge.drafts.row.failed` · `KNOWLEDGE.DRAFTS_ROW_FAILED` | AI Data Analytics failed. Clinket still uses this document. |
| `knowledge.analysing.explain` · `KNOWLEDGE.ANALYSING_EXPLAIN_one/_other/_NO_MAX` | …Clinket already answers from this document. |
| `knowledge.drafts.rerun.bulletReceptionistOne/All` → renamed `bulletAnsweringOne/All` · `KNOWLEDGE.DRAFTS_RERUN_BULLET_ANSWERING_ONE/_ALL` | Clinket keeps answering from this document / your documents the whole time. |

### 5.4 Deleted, both apps, five languages, tests included in the orphan sweep

`knowledge.sharing.*` (label, helper, notReady, notShared, saveFailed, uploadHint, shared, changeHint) ·
`KNOWLEDGE.SHARING_*`. The nudge's `knowledge.nudge.*` stay (that page exists only with the receptionist).

---

## 6. Test matrix (what proves each rule)

| Rule / claim | Test | Host |
|---|---|---|
| The rule's truth table incl. absent fields | `KnowledgeReceptionistRuleTests` | API unit (the API host owns the wire mapping) |
| Not used ⇒ never read (main, companion, GetByRefs, hasKnowledge) | `ProviderKnowledgeSearchServiceTests` + `FullProviderContextServiceTests` | MCP unit / Functions unit |
| Answers only ⇒ no `ref`, no `imageRef`, dropped at send | `ProviderKnowledgeSearchServiceTests`, `KnowledgeToolsTests` | MCP unit |
| Delivery re-check | `VoicePostCallProcessorFunctionTests` (+ integration on real Cosmos) | Functions |
| The sweep on the real engine (every combination × file/FAQ × present/absent) | `KnowledgeReceptionistGatesCosmosIntegrationTests` | API integration |
| The images read | existing `KnowledgeImagesIntegrationTests` + the used bit | API integration |
| Defaults by availability; replace/edit leave-alone | `KnowledgeControllerTests`, `KnowledgeManagementServiceTests`, real-Cosmos confirm test | API |
| Availability matrix | `ReceptionistAvailabilityTests` (every status × platform flag) | API unit |
| Merge tightening | `KnowledgeIngestProcessorFunctionTests` + `KnowledgeDuplicateUploadIntegrationTests` | Functions |
| Every gate calls the rule; no hand comparison of the two bits outside it | `KnowledgeReceptionistRuleConventionTests` (scans API repo + the shared libraries, never a peer host) | API unit |
| Ask Clinket untouched; profile line true for an all-NotUsed library | existing isolation/audience suites + `GetBusinessProfileToolTests` | API |
| One sweep per search | `ProviderKnowledgeSearchServiceTests` counting repository calls | MCP unit |
| Web: hidden state, FAQ box, upload payload, marks, nudge state, twins, keys ×5, orphan sweep incl. tests, analytics literal, §3.7 | `knowledgeReceptionist.test.jsx`, `receptionistAccess.test.js`, `knowledgeGuards.test.js`, `askKeys`/locale parity, `BusinessSearchPage.emptyLibrary.test.jsx` | web |
| Phone: parity twins, screen scans (`renderDetailsEditor`, `renderFaqEditor`, upload, rows, nudge), keys ×5 | `knowledgeReceptionistAccess.test.ts`, `knowledgeReceptionistAccessParity.test.ts`, `knowledgeReceptionistScreen.test.ts` | mobile |
| Sabotage | each new guard broken by line number from a scratchpad copy; restored from that copy; every break must fail exactly its guard | all |

## 7. The audit (P9) — dimensions, each read by fresh eyes

1. Rule 1–6 against every gate, by reading the code, not the tests.
2. Ask Clinket byte-identity (diff of its retrieval files must be empty except `GetBusinessProfileTool`).
3. The battery before/after and the RU numbers (P0/P8).
4. Every sheet state on web and phone, with and without the receptionist, at 360 · 768 · 1024 · 1440.
5. Localization: completeness ×5 both apps and the ORPHAN direction including `__tests__`/`*.test.*`; fr-CA punctuation; Latin brand.
6. Accessibility: `radiogroup`/`radio` with `aria-checked`; one `role="status"` live region; 44 px on the hit slop, not the paint.
7. Config hygiene: no `/sharing`, no `KnowledgeSharingDto`, no `SetShareWithCallersAsync`, no `ListRetrievableDocIdsAsync`/`ListRefSuppressedDocIdsAsync`, no `knowledge.sharing.*`, no `sharing_toggle`; no orphan settings; DI contracts declared.
8. Cost: the sweep's RU and the decision on the two paths, with numbers.
9. Skills ×4 say what the code does; memory entry written; `git status` twice per repo shows only intended files.

## 8. Not in scope (recorded so it is not "found")

The page gate and menu entry (the subscription change owns them) · Team search on FAQs · bulk changes · a disabled
receptionist box for a business without one · Ask Clinket's retrieval · any Service Bus queue, ARM or deploy.ps1 change.

## 9. Questions for the owner before the first edit

| # | Question | My recommendation |
|---|---|---|
| Q1 | **When may I build?** Six sessions are live and five repos carry their uncommitted work. I need a window in which nobody else builds or tests in `C:\Nik`, or your go-ahead to coordinate directly with them | tell me when |
| Q2 | **F nuance:** "has the receptionist" = the AI Assistant page's own switch (status not NotInvited). That means a Cancelled or lapsed subscription still shows the choice, exactly as the page still shows its form today. Keep it identical to the page, or hide the choice on lapse as well (billing's Paid/Trialing truth)? | identical to the page — one switch, one behaviour; the class is one swap if you change your mind |
| Q3 | **§3.7:** may I fix the one-line web defect that keeps Ask Clinket's "You have no documents yet" state from ever showing? | yes, in P6, with its own test |
| Q4 | **E on Canada:** applying the two index paths to the CA `KnowledgeBase` container is a live change to the sandbox (a background re-index of a small container, seconds). I revert it if the numbers say no. Confirm I may apply it | yes, as you said |

## 10. Build record and audit (2026-09-07 night — BUILT, GREEN, AUDITED; the owner pushes)

**Owner rulings in the build session.** Q2 confirmed as recommended: the Knowledge page shows the receptionist choice exactly
when the AI Assistant page shows its form (`PaymentSettings.Enabled && AiAssistantEnabled` AND `VoiceAssistant.Status !=
NotInvited`; paid/trial/paused/cancelled/lapsed keep their saved choices; ONE class, `ReceptionistAvailability`, to swap for a
subscription tier later). Then: confirm and continue, finish it all, no degradation of any output, the multidimensional audit
at the end with every finding fixed before closing.

**Built (P1–P7), all uncommitted in eight repos.** clinqetshared (`KnowledgeReceptionistAccess`, the DTOs,
`VoiceMaterialItem.DocId`) · clinqetcore (`usedByReceptionist`, `KnowledgeReceptionistRule` + `KnowledgeReceptionistGates`,
`IReceptionistAvailability`, the repository/service interfaces) · clinqetinfrastructure (the sweep, the images filter,
`AnyReadyAsync`, the search-service gates, the management-service policy, `ReceptionistAvailability`, `MaterialExcerptBuilder`,
the voice context, the profile tool, five localization files, the missing `BusinessSearchTopic` budget dial) · clinqetapi
(controller, DI, unit + integration tests, guard) · clinqetmcp (`KnowledgeTools.IsSendable`, unit + real-Cosmos tests, guard) ·
clinqetfuncations (merge tightening, the delivery re-check, unit + integration tests, guard) · clinqetwebpartnerapp ·
clinqetmobilepartnerapp (both documented in their skills). Every word ×5 in both apps; every retired key deleted in both.

**Measured (findings/MEASUREMENTS.md).** The sweep: 6.12 → 2.92 RU per voice search on 3 rows, 13.21 → 10.08 on 220 rows
(now covering the 200 FAQs the old suppression read never saw); images 5.24 → 4.82; experiment E identical on every read AND
write ⇒ REJECTED, `CosmosContainerPolicies.KnowledgeBase` unchanged; `AnyReadyAsync` 3.14 RU vs a COUNT of 8.59 at 220 rows.
The synthetic partition K1PROBE0000 was purged; the sandbox policy was restored and re-read.

**Tests green.** API unit 1,543 (the knowledge/business-search/conventions set) · API integration 179 then 123 (the touched
suites re-run) · MCP unit 908 then 237 · MCP integration 17 then 7 · Functions unit 1,895 then 561 · Functions integration 71 ·
web 26 suites / 468 then 13 / 297 · phone 6 suites / 130 + 33 + 2 · `tsc --noEmit` clean · ESLint 0 warnings on every touched
file in both apps. Sabotage: each convention guard (API / MCP / Functions) failed with a placed file and passed after its
removal; the web `knowledgeGuards` and lib tests and the phone parity and screen-scan tests failed under snapshot-restored
mutations and passed once restored, the restored bytes identical to the snapshot.

**§7 audit — findings, all fixed before close.**
1. Rules 1–6 read against every gate in the source hold. Companion passages now pass through `ApplyReceptionistGates` like the
   main list (no behaviour change today; an asymmetry removed).
2. Ask Clinket byte-identity: the only changed retrieval-side file is `GetBusinessProfileTool` (its own fact), as required.
3. Cost: `hasKnowledgeDocuments` was a partition COUNT (8.59 RU at the caps) — now `AnyReadyAsync`, an index-only `TOP 1`
   (3.14 RU flat). `CountReadyAsync` removed everywhere (interface, repository, tests).
4. Copy: the web empty-state body ignored its `*NoReceptionist` twin (a business without the receptionist read "answer callers").
   Fixed. No technical word in any of the 37 new sentences; fr-CA punctuation and the Latin brand verified in gu/hi.
5. Tests: the API integration test created a FAQ through the real service, which indexes into the fixture's deliberately
   unreachable knowledge index; the FAQ policy stays unit-proven and the integration test covers confirm / list / refusal.
6. Hygiene: three comments still named `ListRetrievableDocIdsAsync` / `SetShareWithCallersAsync`; four ESLint warnings (an unused
   `useIntl`, two import orders, a pre-existing dead `GetVoiceAssistant` import); a pre-existing act() warning in
   `voiceApplicationValidation.test.jsx`. No retired route / DTO / method / key / event remains in any of the eight repos.
7. Accessibility: `radiogroup` / `radio` + `aria-checked` on web and `accessibilityRole` / `accessibilityState` on the phone; one
   live region per box; the 44 px hit slop on both phone marks, pinned.
8. Skills ×4 (voice-assistant, business-search, partner-app, provider-mobile), the memory entry, the register rows, this record.

**Deviations from the plan, recorded.** `KnowledgeReceptionistRuleTests` live in the MCP unit suite (the primary voice consumer,
§0.18), not the API as §6 first said. The live retrieval battery (§7.3) could not run: the Canada knowledge index held 0
documents before the build (pre-existing; `local.settings.json` points at Central India and no admin token is forged) — it is
the owner's post-deploy sanity check. The four-width visual pass (§7.4) was not performed in a browser for the same reason;
every state is component-tested and the layout classes mirror the audited audience box.

**Accepted residuals.** An ABSENT `shareWithCallers` reads false in the sweep (fail-closed, as before) and true on a point read
(the entity default) — identical on every stored row, pre-prod, no backfill (§22.10). The voice `HasKnowledge` refreshes with
the context cache (`ProviderContextCacheMinutes`); the sweep itself is live on every search.

## 11. ‼️ 2026-09-08 — ONE FIELD, and the audit for the same mistake everywhere else

**The owner's ruling.** Shown the two-bit storage, the owner rejected it outright: *"one field in cosmos handle
all three choice is best solution"* · *"we fucking dont need to worry about fucking backfill at all it is all
sandbox"* · *"no fucking workaround or backward compatible and no fucking short cut at all"* · *"did you screw up
anywhere else in this solution"*. They were right: the additive shape existed only to avoid touching stored rows,
which is a constraint that does not exist here.

### What changed

| Before (2026-09-07) | After (2026-09-08) |
|---|---|
| `usedByReceptionist` (bool, default true) + `shareWithCallers` (bool) | ONE `receptionistAccess` (the row's own WORD, `string?`) |
| `Decide(status, used, share)`, `ToAccess`, `ToBits` | `Access(word)`, `Format(access)`, `Decide(status, word)`, `Tighter(a, b)` |
| absent `usedByReceptionist` read TRUE (a compatibility reading) | absent, blank, mis-cased, numeric or unknown reads **NotUsed** — fail-closed, no guessing |
| SQL `(NOT IS_DEFINED(c.usedByReceptionist) OR c.usedByReceptionist = true)` + `c.shareWithCallers = true` | SQL `c.receptionistAccess = @sendableAccess` — an ALLOW-list that agrees with the C# reading on an absent row by construction |
| merge: two independent "tighten a bit" lines | merge: `Tighter(incoming, survivor)` — the narrower word wins, symmetric, proven never to widen |
| entity default = the permissive value | entity default = `NotUsed`, the safe value; every writer sets it explicitly |

The word is matched by NAME, ordinally, exactly like `searchAudience` one field above it in the same entity — and
for the recorded reason: a build that resolved a word it did not know would write the resolved value back and
destroy the provider's choice. Nothing else in the platform reads the field: three convention guards (API, MCP,
Functions) fail on any comparison, negation, `??`, `switch`/`is`, `string.Equals` or SQL naming of it outside the
rule, and each now asserts a NON-EMPTY scan, so a rename can never quietly empty the guard — a hole the previous
version had.

### The audit for the same class of mistake, everywhere else in this change

Read with fresh eyes, looking only for compatibility readings, workarounds and shortcuts:

1. **The storage** — fixed above. It was the only compatibility reading in the change.
2. **`CountReadyAsync` → `AnyReadyAsync`** — already fixed on 2026-09-07 (a COUNT answering a yes/no).
3. **Two profile reads were spent on doomed calls**: `CreateFaqAsync` read availability before the FAQ and passage
   caps, `UpdateFaqAsync` before the ETag compare. Both moved to just before first use.
4. **`ApplyReceptionistAccess` helper** deleted — with one field a helper that sets one property is noise.
5. **Retired names**: no `usedByReceptionist` / `shareWithCallers` / `ToBits` / `ToAccess` /
   `CosmosUsedByReceptionistFilter` remains in any of the eight repositories, in source, tests or comments; the
   stale "never two raw bits" wording in the phone's service and its screen test was corrected too.
6. **A test-fixture habit worth naming**: five suites seeded rows WITHOUT the receptionist field and relied on the
   entity default being permissive. Under a fail-closed default they failed loudly (which is the point) and each
   fixture now states the live shape explicitly.
7. **A collision my own new test introduced**: the real-engine matrix built docIds by lower-casing the stored word,
   so `AnswersAndSends` and `answersAndSends` produced the same id and one seeded row silently replaced another.
   Keyed by index now, and the matrix asserts its own non-degeneracy.
8. **Not done, deliberately**: a TOP-1 "any answerable" read for the voice context's `hasKnowledge` is expressible
   now that one word is stored, but the context is cached per business, so it would buy ~7 RU on a rare read at the
   price of a second SQL statement of the rule. Recorded rather than built.

### Data (no backfill code exists — the owner ruled it out, and none was written)

Both sandboxes were migrated in place by a scratchpad probe so nothing goes silent: CA 4 rows, IN 53 rows, each
carrying its OWN effective setting across (23 answers-and-sends, 30 answers-only), the two retired properties
removed. `KnowledgeServiceDraft` documents share the container and were untouched. No production data exists.

### Verification after the rewrite

API unit 1,568 · MCP unit 918 · Functions unit 2,421 · the three knowledge integration suites re-run against real
Cosmos/Azurite · web and phone untouched by the rewrite (they only ever saw the one interpreted word on the wire)
and their knowledge suites re-run green. RU re-measured on Canada and recorded in `findings/MEASUREMENTS.md`,
including experiment E re-run for the single field (0.46 RU on one infrequent query — measured, not shipped).
