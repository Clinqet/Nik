# Build state — AI Assistant number lifecycle

Resume point. `IMPLEMENTATION-PROMPT.md` is still the entry point; this file records what is built, what is not,
and the decisions taken while building.

**Nothing is committed. Nothing is deployed.** No number was purchased, reserved, released or modified at
Telnyx or Plivo — every test uses fixtures and fakes. Meta templates WERE created and deleted, under explicit
owner authorisation (see §5).

## 1. Status in one line

**Everything in `NEXT-SESSION-PROMPT.md` is built (2 October 2026):** the four screens, the alert-type endpoint
(R-1), dedicated unit AND integration suites for every number service (R-2), the skills and memory, and the
second multidimensional audit with every finding fixed — `IMPLEMENTATION-AUDIT.md` part two, which also carries
the final suite figures (§9). **Nothing is committed, pushed or deployed.**

Still with the owner: `businessName` on the request record (not in schema revision 3), and P1 / P2 from
`DECISIONS-2026-10-01.md`, which were built as recommended.

## 2. Built and proven

| Area | What landed |
|---|---|
| Schema | Exactly SCHEMA-APPROVAL-REQUEST rev 3 — `VoiceNumberAsset`, `VoiceNumberRequest`, `VoiceNumberDailyCounter` in SystemData (pk `voiceinv_{carrier}`); `numberAssignmentGeneration` on `VoiceAssistantState` + `Voiceline`; `verificationMethod`/`verificationReference` on the audit; three limits on `voicecfg_platform`; one `/dueAt/?` index path; every TTL |
| Enums | 8 new; `RenewalDateUnknown` added to `VoiceNumberReviewReason`; **13** admin alert types (12 approved + `VoiceNumberRenewalDateUnknown`, added on owner instruction 2026-10-01); 4 notification types |
| Carrier adapters | Both rewritten. Lossless decimal prices with an explicit *unknown*; `TryParseAmount` (signed) for ledger figures; local-only + exclude-held search; Telnyx 400/10031 as "no inventory"; `customer_reference` + order lookup; owned-number listing with a Complete flag; delete with outcome; balance; charges breakdown. ‼️ The purchase POST is sent OUTSIDE the retry policy on both |
| Core services | `VoiceNumberCoordinator` (the single number writer: ETag claim + generation fence, projection, detach, billing tails, `PreviewAtRiskAsync`), `VoicelineProjector`, `VoiceNumberPurchaseService`, `VoiceNumberAllocationService`, `VoiceNumberLifecycleService` (hourly job) |
| Billing hooks | `OnServiceEndedAsync` / `OnServiceRecoveredAsync` / `OnBusinessClosedAsync`; `Trial:AiReminderLeadDays`; the trial reminder now carries the at-risk number and its release moment |
| API | `VoiceNumberController` + `AdminVoiceNumberController`; the three limits on the Voice Settings endpoints |
| Functions | `VoiceNumberOperationProcessorFunction` (queue) + `VoiceNumberLifecycleFunction` (hourly timer) |
| Deployment | `voice-number-operations` queue, per-stamp `VoiceNumbers__*` on both hosts, retired keys removed |
| Localization | 46 keys × 5 languages |
| **WhatsApp** | **§3** |
| **Email** | **§3** |

## 3. Communication layer — the rule and the inventory

### The rule now in code

> **One moment reaches the provider ONCE, on each channel.** When an assistant number is at stake the NUMBER
> notice carries the whole story (assistant off AND the deadline) and billing sends no WhatsApp of its own.
> Where no number is assigned the assistant was never answering calls, so nothing is at risk and the at-risk
> channel stays quiet; email and in-app still carry the billing story.

`BillingNotificationService.BuildWhatsApp` returns `(null, null)` for `SubscriptionDowngraded`,
`SubscriptionTrialEnded` and `SubscriptionCanceled` when `Product == AiAssistant`. One owner per message.

**There is no AI free tier.** The AI is paid or switched off, never "moved to free" — that phrase belongs to the
regular plan only, and no AI template or email uses it.

### WhatsApp at Meta — CA `1302322178177914`, IN `2518598361929331`

Created (CA en_US/es/fr_CA/hi/gu · IN en_US/hi/gu):

| Template | Fires on | Replaced |
|---|---|---|
| `clinket_ai_number_at_risk` | AI trial ending, no card, a number IS at stake | `clinket_ai_add_payment_method` |
| `clinket_ai_number_held` | AI switched off, any reason, number on the clock | `clinket_ai_trial_ended` + `clinket_ai_billing_failed` |
| `clinket_ai_number_kept` | paid in time, number saved | — (new) |
| `clinket_ai_number_removed` | hold expired / admin removal | — (new) |
| `clinket_ai_call_routing_changed` | admin changed the phone we ring | — (new) |
| `clinket_plan_renewal_notice` | plan renewal / trial ending with a card | `clinket_plan_renewal_reminder` (it named the cancel route and shipped with NO button) |

**Deleted at Meta: 32 versions** (4 retired names × 5 CA + × 3 IN), behind two gates — nothing in the solution
may still reference the name, and the replacement must be APPROVED in that language. Re-verified clean.

**Plan templates left untouched because they are correct:** `clinket_plan_trial_ending`,
`clinket_plan_trial_ended`, `clinket_subscription_payment_failed`, `clinket_payment_retry_notice`, and the
three AI minute templates.

Submission discipline (from `Data/whatsapp/README.md`): pure-ASCII payloads with every non-ASCII escaped, never
render template text to a console, read back and compare ordinally. The validator was **sabotage-proved five
ways** including stripping every Devanagari and Gujarati character.

### Email

- **A shared shell exists**: `clinqetshared/Rendering/EmailShell.cs` (public, pure). A template carrying
  `Content` instead of `HtmlContent` is composed at load by `TemplateService`. Responsive frame, `'Lufga'`
  stack, `#032858` ink, `#97EF29` CTA, 600px card on `#F4F6F8`, full-width button under 480px, hidden preheader.
- **5 new voice templates × 5 languages (25 files)**: `VoiceNumberHeld`, `VoiceNumberKept`,
  `VoiceNumberBeingArranged`, `VoiceForwardingNumberChanged`, `VoiceForwardingChangeDeclined`. Four of these the
  code already named and none existed, so those notices previously sent no email at all.
- **Route settled**: email CTAs use `{{AppBaseUrl}}/dashboard/billing`, matching every approved WhatsApp button.
  The AI emails previously used `/dashboard/ai-billing`, so the two channels disagreed.
- **The other 102 templates are a separate task** (owner split, 2026-10-01):
  `Data/email-modernisation/TASK-PROMPT.md`. 455 of 535 files are not responsive.

## 4. Built in the second session (2 October 2026)

| Area | What landed |
|---|---|
| Provider web (`clinqetwebpartnerapp`) | Number choice, setup progress, the removal card, held / checking / recovered, request-a-change, the specific-number note; rules in `src/lib/voiceNumber/numberRules.js`; five languages |
| Provider app (`clinqetmobilepartnerapp`) | The same rules, native: `src/Screen/ProfileFlow/VoiceAssistant/number/`; copy / share on the number; polling paused in the background and offline |
| Admin web (`clinqetwebadmin`) | Requests · Numbers · Activity on the AI Assistant page; the selected-business view; Keep / Return; the three limits and their history; alert → request links |
| Admin app (`clinqetmobileadminapp`) | The same, mirrored |
| R-1 | `GET api/v1/admin/alerts/types` returns `Enum.GetNames<AdminAlertType>()`; both admin apps read it; both hard-coded lists are deleted |
| Backend, second pass | Every finding of audit part two: the removal the provider can see and cannot undo, the pending carrier order, the late confirmation, the stranded request, the worker / hourly-job race, the parked number, the owner's phone rules, the limits cache, the missing host registration — see the audit |
| New pieces | `VoiceForwardingTargetRules`, `VoiceNumberErrorCodes`, `VoiceNumberRefusalExtensions`, admin `POST …/requests/{businessId}/setup/close`, `VoiceNumbers:LimitsCacheSeconds`, `CarrierListingGraceMinutes`, `PendingOrderRechecks` / `PendingOrderRecheckSeconds`, the enum value `VoiceNumberReviewReason.ReservedForLastBusiness`, the refusal `Error_VoiceAssistantOwnerPhoneNotUsable` ×5 |
| Removed | The asset status `Reserved`; the settings `QuoteMaxAgeSeconds` and `AlertCooldownMinutes`; three unused repository methods |
| Tests | Unit suites in the host that runs each service; integration suites on the Cosmos emulator (production index policy) and SQL Server in both hosts; the number lifecycle over real HTTP; a sabotage round |
| Skills / memory | New skill `clinqet-voice-number-lifecycle` in all four tool directories, registered in the four instruction files; pointers in six related skills; memory entry `voice-number-lifecycle-built-2026-10-02` |
| Screen review | Each of the four apps was reviewed against the contract by an independent reviewer, then the four were checked against each other. 60 defects fixed (audit part two §8) — among them: every purchase price shown as $0.00 on the admin app; both admin apps telling the server it may buy above the price limit on every purchase; a timed-out "confirm" that could send a second request |
| Price approval | `ConfirmPurchase` is deleted. Assign / change carry `ApprovedMonthlyRental` + `ApprovedSetupFee`; `VoiceNumberPriceApproval` is checked against the quote taken just before the order; new refusal `Error_VoiceNumberPriceChanged` ×5; three admin-facing purchase refusals reworded ×5 |

**The contract for the four screens is `UI-CONTRACT.md`.** It was amended on 2 October for the parked number
and the owner-phone refusal, and again after the screen reviews.

### Not built, on purpose

- The heartbeat alert rule's **deployment** is in `analytics-alerts.json`; nothing was deployed.
- No number was bought at a carrier, so the first live purchase is unproven against the real thing.

## 5. Decisions taken while building

| # | Decision | Why |
|---|---|---|
| B1 | Plivo's rate unit is the literal `"PLIVO"`, not INR or USD | The API quotes 2.50 while the account is charged ₹236. Naming the unit after the carrier makes a cap comparison honest and a currency mismatch visible |
| B2 | Park = Quarantined + `keepForReuse` **+ review reason `ReservedForLastBusiness`** (amended 2 October); Returned = the reuse wait; Released = carrier delete | The first form did not reserve anything: for a trial business the reuse wait is zero, so a "parked" number was available to anyone the same second. The reason is a new enum VALUE in the existing field — no new field |
| B9 | The three admin-set limits are cached for 60 seconds per host (`LimitsCacheSeconds`), not the 24 hours of the own-number settings | They stop spending, and the host that enforces them is not the one the admin saves on |
| B10 | The provider's request id is letters, digits, `-` and `_` | It is sent to the carrier as our order reference and into a queue message id |
| B11 | An approval to buy above the price limit names the price (two DTO fields), not a yes/no | The server quotes again just before the order. With a flag, a screen that sent it on every purchase — both admin apps did — let any price that rose above the limit be bought unseen |
| B12 | The trial end on the number picker is a day, not a moment | The billing page already shows it as a day; one fact, one form |
| B13 | An answer a screen does not know is the error state, never "our team is arranging your number" | The app can be older than the server, and that sentence is a promise |
| B3 | The four new provider notices sit in the existing `VoiceAssistant` preference category | A new mandatory mechanism was never approved |
| B4 | `Plivo:Currency` retired, `Plivo:ComplianceApplicationId` added | The currency field was the defect; the compliance id is what an India rental needs |
| B5 | `IBusinessMemberDirectory.GetPrimaryOwnerConfirmedPhoneAsync` added | §6 A1 needs the owner's confirmed phone server-side |
| B6 | `VoiceAssistant` added to `WhatsAppEligibleCategories`; only the number notices carry a template | Same mechanism as `MessagesChats` — the template gate does the real work, so call summaries cannot reach WhatsApp |
| B7 | A 13th admin alert type, `VoiceNumberRenewalDateUnknown` | Owner instruction. It is the only review an admin must resolve OUTSIDE Clinket, and it bills every cycle until they do |
| B8 | The release moment has ONE definition, `ReleaseMomentFor`, shared by the warning and the hold | Two copies would drift and the provider would be told a deadline we did not keep |

## 6. Defects found and fixed (beyond the designed scope)

From porting `VoiceAssistantServiceTests` and from building:

| # | Defect |
|---|---|
| T1 | `GetNumberQuoteAsync` could not name the business holding a number |
| T2 | `ServiceBusService` had no sender for the new queue — every queued operation would have failed to send |
| T3 | `GetChoices` carried `voice.number.manage` without the mandated live-SQL re-check |
| T4 | **Telnyx charge lines were parsed with the price parser, which rejects negatives. Telnyx reports every debit as negative, so the daily charge comparison read ZERO lines every day and always reported "all fine"** |
| T5 | Same bug on the balance: an **overdrawn** account read as "unknown", silencing the low-balance alert exactly when the account was empty |
| T6 | The single-column Cosmos ORDER BY guard demanded a composite index Cosmos cannot define for a single path. Rewritten to the real rule and sabotage-proved |
| T7 | `AddPaymentServices` reached `IVoiceNumberCoordinator` undeclared in the self-containment contract |
| T8 | **A number with no renewal boundary was skipped with a silent `continue`** under a comment claiming an admin handled it. Nothing told any admin, and the number would renew forever. Now a dedicated alert |
| T9 | `clinket_ai_number_at_risk` could never fire — nothing populated `AtRiskNumber` |
| T10 | The held email had **no deadline token** — the one fact it exists to deliver |
| T11 | Voice email data was built once for all recipients, so a date would ship in one language for everybody |
| T12 | The logo guard scanned the raw file, so it could not see a logo the shell supplies — and could never notice a shell that lost the logo for all 107 templates at once |
| T13 | Two alert review reasons fell through to a generic fallback, giving an admin no instruction |

## 7. Hard lines observed

No carrier purchase, reservation, release or modification — not even on sandbox. No deployment. No real message
sent. No `git checkout --`, `restore`, `reset`, `stash` or `clean` in any tree; the one file I needed to mutate
for a sabotage proof was snapshotted to the scratchpad and restored from that copy. No commit, no push. No
scratch file left in any repository. Nothing written outside `SCHEMA-APPROVAL-REQUEST.md` revision 3.
