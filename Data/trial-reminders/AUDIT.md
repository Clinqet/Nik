# Trial reminders — closing multi-dimensional audit (2026-10-02)

Scope: every line this programme added or changed in clinqetshared, clinqetcore, clinqetinfrastructure,
clinqetfuncations, clinqetapi, clinqetwebadmin and azureautomation, plus the copy (5 languages), the email
templates, the WhatsApp templates at Meta and the skills. The audit is a gate: every finding below was fixed in this
session, re-tested and, where it guards a rule, proven by sabotage. A finding that turned out not to be a defect is
closed with the evidence.

## 1. Findings — all fixed

| # | Dimension | What was wrong | Fix | Proof |
|---|---|---|---|---|
| A1 | Correctness / money | Nothing tied the reminder's amount to the amount the trial-end charge really takes. `TrialChargeQuoteService` copies the conversion step by step, but a later change to either side alone would have passed every test while reminders quoted the wrong amount — the exact failure the card networks' trial rules exist to prevent. | New theory `TrialChargeQuoteServiceTests.Quote_IsExactlyWhatTheConversionCharges`: one row is quoted as its trial ends, then really converted by `SubscriptionBillingService`; the captured charge request (amount − discount, then tax) must equal the quote. 5 cases: AI monthly, AI yearly + scheduled raise, AI + promo + raise, plan + raise, plan yearly + promo. | Sabotage (quote ignores a scheduled raise) → 2 of 5 fail. |
| A2 | Reliability / ordering | The trial-START amount was quoted AFTER the trial row was committed. A failure in the quote (promo, tax) returned an error for a trial that had in fact started, and the retry found the trial already running, so the "trial started" message never went. | Both `SubscriptionService.SubscribeAsync` and `AiAddOnService.PurchaseAddOnAsync` quote before the commit. | `Subscribe_QuoteFails_NoTrialIsStarted`, `PurchaseAddOn_QuoteFails_NoTrialIsStarted`; sabotage of the plan path (S18) → fails. |
| A3 | Reliability / ordering | Same shape on "turn auto-renewal back on" during a trial: the quote ran after the save, and a retry returns early ("already renewing") — the notice would be lost. | Both `ResumeAsync` and `ResumeAddOnAsync` quote before the save. | `TrialHolder_ResumeQuoteFails_AutoRenewalStaysOff`, `ResumeDuringTrial_QuoteFails_AutoRenewalStaysOff`; sabotage of the AI path (S15) → fails. |
| A4 | Copy correctness | Resuming during a trial that ends WITHOUT a charge (a plan trial while the promo is on — the sunset cohort) had no quote, so the message fell back to the bare pre-tax catalog price with no period: "After that, it's $29.00." Wrong amount (no tax) and, under the promo, not what happens. | New variant `TrialAutoRenewalResumed_NoCharge` ("Your {0} free trial continues until {1}.") in en/es/fr/gu/hi, in-app + email (shell `Content` form), chosen when `TrialCharge` is null. | `ResumedDuringATrialWithNoCharge_NamesNoPrice` (plan + AI); sabotage → fails; parity script: 0 problems over 5 languages. |
| A5 | Code quality | `IsolatedAsync`'s filter excluded `DbUpdateConcurrencyException`, which can never reach it (every save inside catches it) — dead logic, and different from the house idiom `when (ex is not OperationCanceledException)`. | Simplified to the house idiom. | `OneRowFailing_OthersStillReminded`; sabotage of the boundary → fails. |
| A6 | Comments (§0.14) | 9 production and 10 test comment blocks I wrote ran 2–4 lines; two comments said reminders never run "at the billing hour", false for India (both 04:00 UTC). | Each cut to one line carrying only the why; the two false ones corrected. The two remaining multi-line blocks are pre-existing paragraphs edited inside. | `comments.js` listing re-run. |
| A7 | Test coverage | E8 (a trial end deferred for a pending India mandate keeps its stamp, so the longer trial is not reminded twice) was right in code but pinned by nothing. | `TrialReminderSweepTests.TrialEndDeferredForAPendingMandate_IsNotRemindedAgain` drives the real conversion's deferral, then the sweep. | Passes; asserts the deferral really happened (Trialing, end moved, one extension, stamp kept); sabotage (deferral clears the stamp) → fails. |
| A8 | Hygiene | The script that inserted the A4 copy left a stray blank line before each new key in all five language files. | Removed; every file re-parsed as JSON. | Byte check: 0 `\r\n\n` joins left. |
| A9 | Config hygiene (§4) | PLAN §2 said the settings live in "API + Functions appsettings"; only the Functions host reads them (the sweep and the sunset heal run there). | PLAN corrected; the block is in Functions `appsettings.json` only, class defaults mirror it. | `HealOverdueCohortTrialsAsync` caller is `SubscriptionBillingSchedulerFunction`. |

## 2. Checked and closed — not defects (evidence)

| Dimension | Question | Evidence |
|---|---|---|
| Consistency | Does "card on file" mean the same thing at trial start and in the sweep? | `GetDefaultAsync` returns any ACTIVE method (ordered by default); `HasCardAsync` = any active method. Same set. |
| Copy | Can a trial START with no quote (blank price in the start message)? | No: plan trials start only when `BillingChargesEnabled && !PromoEnabled && PriceMinor > 0`; AI trials only when charges are on and the engine is priced. |
| Correctness | Can a trial row's start move mid-trial (the trial length drives the notice)? | Every `CurrentPeriodStart =` writer is a paid path (charge, annual switch, renewal) or the trial start itself. |
| Completeness | Does every way a provider's saved method appears or disappears re-arm the reminder? | Writers of `PaymentMethods.IsActive`/insert: `ConfirmSetupIntentAsync`, `RemoveAsync`, webhook `FailMandateAsync`, `RevokeMandateAsync`, `CreateMandateOnActivateAsync` — all five call `AfterCardChangeAsync`. Pause and set-default leave the active set unchanged. |
| Concurrency | Sweep vs re-arm vs a second sweep. | Stamp is a RowVersion CAS (`TwoRunsRacing_SendOneReminder`, real SQL); re-arm has its own context and one re-read retry (`CardStateChange_*` real SQL); the sweep detaches a conflicted row and leaves it for the next run. |
| Idempotency | A redelivered or re-run reminder. | Deterministic EventId including card state, amount and interval; once-only stamp; India marker `RenewalReminderSentForChargeAt`. |
| Money | The pre-existing renewal pre-debit (`DebitAfterDiscountAndTaxAsync`) uses the same discount-then-tax order as the trial quote. | Untouched pre-existing path with its own tests; the trial quote is now pinned to the real conversion (A1). |
| Timing | India: trial notice and billing both run at 04:00 UTC — is the notice a day ahead? | The pre-debit window is `(now, now + 1 day]`; the charge happens at the next day's billing run (after queue processing), so ≈ 24 h. |
| Contracts | Does any client still read `reminderLeadDays`? | `git grep` across 13 repos: only the unrelated `DebitReminderLeadDays`. |
| W11 | Do number emails greet differently from billing emails? | Both greet with the business name; only the English word differs ("Hi" vs "Hello"). Not a defect; changing ~60 templates would collide with the email-modernisation branch for no reader benefit. |
| W7 | WhatsApp for a hold that ran out uses `clinket_ai_number_removed`. | That template was designed for exactly this case (`Data/voice-number-lifecycle/WHATSAPP-TEMPLATES.md` §4.2) and its text is neutral. |
| Cost | Per-row work in the sweep. | Rows are bounded to unstamped trials ending within 8 days; the quote runs only for rows already due (`IsDue` first). |
| Tenancy | Cross-business reads. | Every query is keyed by business id or is the global SQL sweep; no Cosmos is touched. |
| Schema | Anything beyond the approved drop? | Only `RemoveTrialOfferReminderLeadDays`; `TrialOfferTable_NoLongerHasAReminderColumn` on real SQL. |
| Infra | New Azure resource or host setting without deploy entry? | One host setting, `TrialReminders__TimerSchedule`: local.settings ×3 + deploy.ps1 required list + both settings blocks (same three places as every timer). |
| Test placement (§0.17/§0.18) | Do tests live with their runtime consumer? | Sweep, quote, schedule, webhook, sunset, notifier → Functions suites; trial start/cancel/resume, renderer, payment methods → API suites; no test reads another repo. |
| WhatsApp | `ApprovedLanguages` vs Meta. | All five languages in both hosts, like every template (owner ruling 2026-10-02: pre-launch, treat every template as approved; the owner handles Meta review). CA `hi` of `clinket_ai_number_on_hold` came back MARKETING — owner appeals; never deleted. |
| Skipped tests | 18 skipped in the API integration run. | All are sandbox/search-index tests that skip by design when their sandbox is absent; none is in this programme. |

## 3. Sabotage — each key rule broken once, its guard must fail

Each mutation was applied to a copy-protected file (snapshot in the session scratchpad, restored by copy, never through
git — §0.19), the owning test project rebuilt, only the guard run. After the battery every file's MD5 matched its
pre-run value.

| # | Rule broken | Guard | Result |
|---|---|---|---|
| S1 | A 7-day card trial treated as "longer than 7 days" (`>` → `>=`) | `LeadDays_FollowTheApprovedTable` | CAUGHT (1 of 12 cases) |
| S2 | The card networks' 7-day notice made to wait out the quiet hours | `EightDayCardTrial_GetsItsSevenDayNotice_EvenRightAfterTheStart` | CAUGHT |
| S3 | Minimum trial length removed (a 1-day trial reminded) | `OneDayTrial_IsNeverReminded` | CAUGHT |
| S4 | W10: auto-renewal-off trials selected again | `TrialWithAutoRenewalOff_IsNeverReminded` | CAUGHT |
| S5 | E24: reminders sent with charges off | `ChargesSwitchedOff_SendsNoReminder` | CAUGHT |
| S6 | Event id loses the card state (re-armed reminder de-duplicated away) | `CardAddedAfterTheNoCardReminder_SendsTheCardVersionNext` | CAUGHT |
| S7 | India: near-duplicate check removed | `India_MainReminderWasRecent_NoSecondNotice` | CAUGHT |
| S8 | Per-row error boundary removed | `OneRowFailing_OthersStillReminded` | CAUGHT |
| S9 | W5: AI switch-off notice sent beside the number notice | `AiTrialEnds_NoCard_TheNumberNoticeTellsIt_WhenANumberIsHeld` | CAUGHT |
| S10 | E6: trialing holders dropped from the price-change notice | `PriceRaise_TellsTrialingProviders_AndSkipsAutoRenewalOff` | CAUGHT |
| S11 | Re-arm on ANY card event, not only card ↔ no card | `Rearm_UnchangedCardState_LeavesTheStamp` | CAUGHT |
| S12 | E13: sunset runway ignores the card (always the short notice) | `PromoSunsetServiceTests` (runway theory) | CAUGHT |
| S13 | Webhook revoke stops re-arming | `Run_LastWayToPayGone_RearmsTheTrialReminder` | CAUGHT |
| S14 | W5 renderer short-circuit removed | `SwitchOffToldByTheNumberNotice_DeliversNothing_ButStillAlertsTheAdmins` | CAUGHT |
| S15 | A3: resume quote moved back after the save | `ResumeDuringTrial_QuoteFails_AutoRenewalStaysOff` | CAUGHT |
| S16 | A4: no-charge variant replaced by the priced one | `ResumedDuringATrialWithNoCharge_NamesNoPrice` | CAUGHT (2 of 2) |
| S17 | A1: quote ignores a scheduled raise | `Quote_IsExactlyWhatTheConversionCharges` | CAUGHT (2 of 5) |
| S18 | A2: trial-start quote moved back after the commit | `Subscribe_QuoteFails_NoTrialIsStarted` | CAUGHT |
| S19 | E8: the mandate deferral clears the reminder stamp | `TrialEndDeferredForAPendingMandate_IsNotRemindedAgain` | CAUGHT |

19 of 19 caught.

## 4. Final suites

After every fix, one rebuild and one run:

| Suite | Result |
|---|---|
| Functions unit | 8,766 passed, 0 failed (8,760 before the audit + 6 new) |
| API unit | 15,703 passed, 0 failed (15,697 + 6 new) |
| Functions integration (real SQL) | 893 passed, 0 failed |
| API integration (real SQL) | 2,528 passed, 0 failed, 18 skipped (sandbox-only, §2) |
| Admin web ESLint (`--max-warnings=0`) | clean |
| Admin web offer tests | 27 passed earlier in the session; the admin file did not change after that run |

Committed and pushed 2026-10-02: shared `5b08940`, core `818b4ed`, infrastructure `6088d448`, funcations `b6d063e`,
webadmin `42045cc`, azureautomation `e0563a0`, api `734c7408` (last). No merge commit in any of the seven.

Meta: the four retired templates DELETED 2026-10-02 — 32 variants across both accounts.
