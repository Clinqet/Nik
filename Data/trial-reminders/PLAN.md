# Trial reminders and trial messages — build checklist

Owner approval: decisions 1–9, 2026-10-02 (in the session that built this). Schema change approved: drop
`TrialOffers.ReminderLeadDays`. Nothing else in SQL, Cosmos or Search is approved — none is needed.

A row is ticked only with evidence (test name, file:line, or a Meta read-back). Closing audit: `AUDIT.md`.

## 1. The rule, in plain words

Trials now follow ONE platform rule. The admin no longer picks a reminder per offer.

| Situation at the time of the reminder | Reminder goes |
|---|---|
| Card on file, trial longer than 7 days | at least 7 days before the trial ends (card-network rule) |
| Card on file, trial 7 days or shorter | at least 3 days before |
| No card | at least 3 days before |
| Trial no longer than that notice (e.g. 2 or 3 days) | about 1 day before |
| 1-day trial | no reminder; the trial-started message says everything |
| Trial switched off (auto-renewal off) | no reminder; the "auto-renewal off" message is the notice |

* Sent by a separate morning job: CA/US 14:00 UTC (10 am Eastern), India 04:00 UTC (9:30 am).
* The job sends at the last morning that still leaves the notice above. A missed run sends late rather than never.
* Never within 12 hours of the trial-started message, EXCEPT the 7-day card notice, which card rules require on time.
* Card added after a no-card reminder → the card reminder (with the amount) is sent. Card gone after a card
  reminder → the no-card reminder is sent. Only a real change (card ↔ no card) re-sends.
* The amount quoted is what the charge will take: the price on the day the trial ends, yearly if yearly, minus a
  promo code, plus tax. If a promo makes the first charge different: "X for the first month, then Y per month".
* India: one extra branded notice about 24 hours before the first charge after a trial (RBI e-mandate practice),
  unless the main reminder already went in the last 2 days.
* A price change scheduled during a trial is told to the trialing provider too.
* Charges switched off (`BillingChargesEnabled=false`) → no reminders (the trial cannot end, so the date would be false).

## 2. Settings (`Payments:TrialReminders`, Functions appsettings only — the only host that reads them; class defaults mirror)

| Key | Value | Ticked |
|---|---|---|
| `CardLongTrialMinDays` (a trial LONGER than this gets the long notice) | 7 | [x] `PaymentSettings.cs` `TrialReminderSettings` + Functions `appsettings.json` |
| `CardLongLeadDays` | 7 | [x] same; `LeadDays_FollowTheApprovedTable` |
| `CardShortLeadDays` | 3 | [x] same |
| `NoCardLeadDays` | 3 | [x] same |
| `ShortTrialLeadDays` | 1 | [x] same |
| `MinTrialDaysForReminder` (shorter trials get none) | 2 | [x] same; `OneDayTrial_IsNeverReminded` |
| `QuietHoursAfterStart` | 12 | [x] same; `TwoDayTrial_WaitsOutTheQuietHoursAfterTheStart` |
| Validator: every value in range, leads ordered, fails startup when wrong | — | [x] `PaymentSettingsValidator`; `Validator_AcceptsTheDefaults_AndRefusesARuleThatCannotWork` |
| `TrialReminders:TimerSchedule` — host setting: local.settings*.json ×3 + deploy.ps1 both stamps | CA `0 0 14 * * *`, IN `0 0 4 * * *` | [x] local.settings ×3; deploy.ps1 required list + both settings blocks |

## 3. Schema (approved)

| Item | Ticked |
|---|---|
| Remove `TrialOffer.ReminderLeadDays` (entity) | [x] `clinqetcore/Entities/SQL/TrialOffer.cs` |
| New EF migration dropping the column (never edit the applied one) | [x] `20261002172320_RemoveTrialOfferReminderLeadDays`; `TrialOfferTable_NoLongerHasAReminderColumn` (real SQL) |
| Apply the migration to CA and IN | [x] 2026-10-02 via cosmosindexsetup --all-regions --sql-only; `migrations list` shows it applied in both |
| `ResolvedTrialOffer`, `TrialOfferService.Map`, DTOs (`TrialOfferDto`, upsert DTO), `AdminOffersController` | [x] all four; no client in 13 repos reads the field (git grep) |
| `PromoSunsetService`: cohort seed no longer sets it; late-flip heal runway = the rule's lead for that row + 1 day | [x] `Phase2_LateFlip_RunwayFitsTheRowsReminderNotice` (sabotage-proven) |
| Admin web `TrialOfferFormPage.jsx`: dropdown, `REMINDER_LEADS`, payload | [x] removed; hint under Free days; ESLint clean. No admin offer form page has page tests (services/components only) |

## 4. Findings to fix (from the review)

| # | Fix | Ticked |
|---|---|---|
| W1 | Trial started: card and no-card versions, real amount with period | [x] `TrialStarted_SaysWhatHappensAtTheEnd_ByCardAndProduct`, `Subscribe_TrialStart_FiresTrialStartedNotification_NotCharged` |
| W2 | Trial ending, card: date, amount with period, how to cancel | [x] `CardOnFile_SendsTheCardVersion_WithTheQuotedAmount`, `TrialCharge_RendersAsOnePhraseWithItsPeriod` |
| W3 | WhatsApp card reminder → `clinket_trial_ending_paid`; renewal → `clinket_subscription_renews_soon` | [x] `TrialEndingWithCard_Ai_OpensTheAiBillingPage`, `RenewalReminder_*_UsesRenewsSoonTemplate*` |
| W4 | Trial ending, no card, AI with a number: in-app and email name the number and the release day | [x] `AiTrialEndingNoCard_WithANumber_NamesTheNumberInEveryChannel` |
| W5 | Every AI switch-off with a number held: only the number notice goes (no second billing notice) | [x] `AiTrialEnds_NoCard_TheNumberNoticeTellsIt_WhenANumberIsHeld`, `SwitchOffToldByTheNumberNotice_DeliversNothing_ButStillAlertsTheAdmins` (both sabotage-proven) |
| W6 | Number held: email and WhatsApp buttons open the AI billing page | [x] `Held_UsesTheTemplateWhoseButtonOpensTheAiBillingPage`; `VoiceNumberHeld.json` ×5 CtaHref |
| W7 | Number removed: wording by reason (service ended vs our team) | [x] `ServiceEnded_ReadsAsARelease_NotATeamRemoval`, `TeamRemoval_CarriesTheReasonIntoTheEmail` |
| W8 | Auto-renewal off during a trial: trial wording, nothing charged, number sentence for AI | [x] `AiAutoRenewalOff_PicksTheVersionThatIsTrue`, `DuringATrial_UsesTheTrialVersion`, `TrialHolder_AutoRenewalOffAndOn_SendTheTrialVersions` |
| W9 | Reminder amount = what the charge takes; price change notifies trialing providers | [x] `Quote_IsExactlyWhatTheConversionCharges` (sabotage-proven), `PriceRaise_TellsTrialingProviders_AndSkipsAutoRenewalOff` |
| W10 | No reminder for a trial with auto-renewal off | [x] `TrialWithAutoRenewalOff_IsNeverReminded` (sabotage-proven) |
| W11 | Number emails greet the same way as billing emails | [x] closed as NOT a defect: both greet with the business name; only English "Hi"/"Hello" differ (AUDIT.md) |
| W12 | WhatsApp button domain — belongs to the WhatsApp domain question, NOT this change | n/a |

## 5. Edge cases

| # | Case | Expected | Ticked |
|---|---|---|---|
| E1 | 1-, 2-, 3-day trials | none / ~1 day / ~1 day | [x] `LeadDays_FollowTheApprovedTable`, `OneDayTrial_IsNeverReminded`, `TwoDayTrial_WaitsOutTheQuietHoursAfterTheStart` |
| E2 | 8-day card trial | 7-day notice, even on the first morning | [x] `EightDayCardTrial_GetsItsSevenDayNotice_EvenRightAfterTheStart` (sabotage-proven) |
| E3 | Card added after the no-card reminder | card reminder sent | [x] `CardAddedAfterTheNoCardReminder_SendsTheCardVersionNext`; `PaymentsIntegrationTests.CardStateChange_RearmsTheTrialReminder_OnlyOnARealChange_OnRealSql` |
| E4 | Card gone after the card reminder | no-card reminder sent | [x] `Rearm_CardGone_ClearsTheStamp_OnTrialRowsOnly`, `CardGone_RearmsTheReminder_OnRealSql`, `Run_LastWayToPayGone_RearmsTheTrialReminder` |
| E5 | Auto-renewal turned off | no reminder | [x] `TrialWithAutoRenewalOff_IsNeverReminded` |
| E6 | Price change during a trial | notice to trialing providers; reminder quotes the new price | [x] `PriceRaise_TellsTrialingProviders_AndSkipsAutoRenewalOff`, `ScheduledRaise_AppliesOnlyWhenEffectiveByTheTrialEnd` |
| E7 | Yearly | yearly amount, "per year" | [x] `Ai_Yearly_IsTheYearsPriceWithTax_PerYear`, `PurchaseAddOn_YearlyTrialStart_SaysTheYearsPriceIsPerYear`, parity Year rows |
| E8 | Trial end deferred (mandate pending) | no second reminder | [x] `TrialEndDeferredForAPendingMandate_IsNotRemindedAgain` |
| E9 | Missed run | sends late, never twice | [x] `IsDue_LateRunStillSends_UntilTheTrialEnds`, `ProcessTrialReminders_SecondCall_DoesNotReDispatch` |
| E10 | Two job instances | one send (row-version claim) | [x] `TwoRunsRacing_SendOneReminder` (real SQL) |
| E11 | Admin edits/ends the offer | reminder unaffected (rule is platform-wide) | [x] the sweep reads no `TrialOffers` row (`SubscriptionBillingService.ProcessTrialRemindersAsync`) |
| E12 | Trial row without an offer | still reminded | [x] `ProcessTrialReminders_RowWithoutAnOffer_IsStillReminded` |
| E13 | Sunset late-flip heal | runway = that row's lead + 1 day; reminder re-armed | [x] `Phase2_LateFlip_RunwayFitsTheRowsReminderNotice`; `ApplyHeal` clears `TrialReminderSentAt` |
| E14 | Promo period | plan trials dormant (no reminder); AI reminded | [x] `ProcessTrialReminders_SubReminderSuppressedUnderPromo_ButAddOnStillSent`; resumed copy `_NoCharge` |
| E15 | Team members | every billing recipient, each in their own language and zone | [x] business fan-out renders per recipient (`BuildRecipientRequest`); `TrialCharge_RendersAsOnePhraseWithItsPeriod` |
| E16 | Number assigned after the reminder | nothing extra (the number notices cover the end) | [x] by design: the reminder is once per trial; number notices are the number lifecycle's |
| E17 | Trial ended early / engine switch | reminder never sent for a row no longer trialing | [x] sweep selects `Status == Trialing` only; engine/plan/interval switch re-arm tests |
| E18 | Time of day | regional morning | [x] `TrialReminderFunction` timer; deploy.ps1 per stamp |
| E19 | Day shown vs real moment | the day in the business's zone | [x] `RenderDates` per recipient zone (dates travel as values: `Subscribe_TrialStart_FiresTrialStartedNotification_NotCharged`) |
| E20 | India first charge after a trial | 24-hour branded notice, no near-duplicate | [x] `India_FirstChargeAfterATrial_GetsTheDayBeforeNotice_Once`, `India_MainReminderWasRecent_NoSecondNotice` (sabotage-proven), `India_DayBeforeNotice_SentOnce_AndRecorded` (real SQL) |
| E21 | AI trial, no card, no number | no-card AI reminder without a number | [x] `_AiNoCard` variant; renderer tests |
| E22 | India mandate not active | no "you'll be charged" pre-debit notice | [x] `India_MandateNotActive_NoPreDebitNotice` |
| E23 | Conversion amount is zero | no reminder | [x] `NoConversionCharge_NoReminder_AndNotStamped` |
| E24 | Charges switched off | no reminders | [x] `ChargesSwitchedOff_SendsNoReminder` (sabotage-proven), `TrialReminderFunctionTests` |

## 6. WhatsApp (Meta)

| Template | Action | Status (read back 2026-10-02) | Ticked |
|---|---|---|---|
| `clinket_trial_ending_paid` | new (CA ×5, IN ×3) | CA en/fr/gu/hi APPROVED·UTILITY, es PENDING; IN en/gu APPROVED, hi PENDING | [x] |
| `clinket_subscription_renews_soon` | new (CA ×5, IN ×3) | CA gu/hi APPROVED, en/es/fr PENDING; IN all APPROVED | [x] |
| `clinket_ai_number_trial_ending` | new copy of `clinket_ai_number_at_risk`, AI billing button | CA fr/gu/hi APPROVED, en/es PENDING; IN all APPROVED | [x] |
| `clinket_ai_number_on_hold` | new copy of `clinket_ai_number_held`, AI billing button | CA en/fr/gu APPROVED, es PENDING, **hi APPROVED as MARKETING (owner to appeal)**; IN all APPROVED | [x] |
| `clinket_payment_retry_billing` | new copy of `clinket_payment_retry_notice`, button to the right billing page | CA es/gu/hi APPROVED, en/fr PENDING; IN all APPROVED | [x] |
| Wire all five in code (both hosts' `WhatsApp:Templates`, `WhatsAppTemplateNames`) | — | `ApprovedLanguages` = all five languages in both hosts (owner: treat every template as approved; the owner handles Meta) | [x] |
| Delete `clinket_plan_renewal_notice`, `clinket_ai_number_at_risk`, `clinket_ai_number_held`, `clinket_payment_retry_notice` at Meta and in code — only once ≥1 language of its replacement is APPROVED as UTILITY | — | code: removed; Meta: DELETED 2026-10-02 (32 variants, both WABAs; each replacement re-checked APPROVED·UTILITY first) | [x] |
| `Data/whatsapp/README.md` updated | — | JOB 7 | [x] |

## 7. Tests, docs, audit

| Item | Ticked |
|---|---|
| Unit tests: every rule row, E1–E24, message variants, WhatsApp mapping | [x] §4 and §5 above |
| Integration tests (real SQL): reminder sweep, re-arm on card change, migration | [x] `TrialReminderIntegrationTests` (5), `PaymentsIntegrationTests.CardStateChange_*` |
| Sabotage each key rule once | [x] AUDIT.md §3 |
| Full suites green: Communications unit + integration, API unit + integration, admin web lint + tests | [x] AUDIT.md §4 |
| Skills ×4 (payments, notifications, function-app, admin-app, voice-number-lifecycle) | [x] copies verified identical |
| Memory entry + index | [x] `trial-reminders-2026-10-02.md` |
| `AUDIT.md`: multi-dimensional audit of the new code, every finding fixed | [x] 9 findings fixed, 19/19 sabotages caught |
| Tree clean, scratchpad emptied (incl. the Meta token file), linear history, commit and push | [x] 7 repos pushed 2026-10-02, 0 merge commits, trees clean |
