# WhatsApp templates — the one place that says what still needs creating

**Every Meta message template that has to be created, recreated or promoted is tracked HERE.** If a template
is outstanding and it is not in this file, it will be forgotten.

| Job | State |
|---|---|
| AI Assistant number lifecycle — three Utility notices | 🟡 **NOT CREATED.** The design was approved by the owner 2026-09-30 and finalised 2026-10-01 ([final design](../voice-number-lifecycle/FINAL-DESIGN.md) §11). [Notification specification](../voice-number-lifecycle/NOTIFICATIONS.md) holds the draft wording for a hold notice, a removal notice and a forwarding-change notice. Proposed names have not been checked against the accounts and nothing has been submitted. The code ships with these templates sending in no language until each is `APPROVED / UTILITY`. No Meta/account change is authorised by this entry. |
| 1 — `clinket_info_picture` | ✅ **DONE** 2026-08-25 |
| 2 — four Utility recreations | 🟡 all four submitted 2026-08-28; 1 approved Utility, 2 landed MARKETING, 1 in review; proofs NOT yet deleted |
| 3 — accent corruption + MARKETING fallout | � all texts repaired byte-exact; 3 locales stuck MARKETING |
| 4 — gaps from the full 2026-08-28 audit | 🟡 4a+4b+4c CLOSED 2026-09-01 (see below); 4d resolved-by-filter; 4e (secrets) still open |
| 5 — rename the 3 poisoned templates | 🟡 24 new variants created 2026-08-28, **all in review** — decide nothing until APPROVED |
| 7 — trial reminders: five new templates, four retired | 🟡 created 2026-10-02 (40 variants), the four old ones deleted at Meta the same day; see JOB 7 — Canada `hi` of `clinket_ai_number_on_hold` landed **MARKETING** and needs an appeal |

Both jobs follow the same law, learned the hard way:

> 🛑 **OBSOLETE SINCE 2025-04-09 — `allow_category_change:false` NO LONGER PROTECTS YOU.**
> Meta's own docs: *"Effective April 9, 2025 – The `allow_category_change` property... Previously, if set
> to `true`, this allowed us to update a template's category to marketing... **This is now the default
> behavior**"* and *"If you selected `UTILITY` and WhatsApp determined it should be `MARKETING`, **the
> template is approved as `MARKETING`**."*
> The old belief that Meta would REFUSE rather than downgrade was true when this folder was written and is
> **false now**. Every template below that predates April 2025 is **grandfathered** — its wording would not
> necessarily earn UTILITY if resubmitted today.
> Source: <https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/>

> ‼️ **The ONLY thing that earns UTILITY now is the wording.** It must be **non-promotional** AND either
> specific to the user's account/transaction or essential to them. Meta explicitly classes as MARKETING:
> *"attempt to renew subscriptions... **these are marketing even if requested by users**"*, mixed
> utility+promotional content, and conversations the business initiates that the user did not ask to move
> to WhatsApp.

> ‼️ **DO NOT retry a UTILITY submission that came back MARKETING.** Meta penalises the pattern:
> warning → utility rate-limiting → **ALL approved utility templates on the WABA recategorised to
> MARKETING** (7 days, 30 for repeats) → the same across **every WABA in the portfolio** (30 days).
> On 2026-08-28 we submitted 24 as UTILITY and 16 came back MARKETING. That is the pattern. Stop, fix the
> wording, and use the appeal route instead.

> ‼️ **Appeal is free and non-destructive.** A template that is `MARKETING` + `APPROVED` can be appealed
> for **60 days** via WhatsApp Manager → Business Support → Template Category Updates → Request Review.
> This is the correct first response to a bad category — never delete-and-retry.

> ‼️ **Prove the wording under a throwaway PROOF name first** (`…_v1`, or a distinct descriptive name — never
> a runtime template name). Only when every locale is `APPROVED / UTILITY` do you create the real name, and
> only when the real name is live do you delete the proof.

> ‼️ **NEVER send a request body that contains raw non-ASCII.** PowerShell 5.1 `ConvertTo-Json` emits raw
> `é`/`à`/`ó`, and `Invoke-RestMethod` then encodes the string with the ANSI codepage (**Windows-1252**),
> so every accent reaches Meta as a literal `?`. Escape all non-ASCII to `\uXXXX` before sending — a pure
> ASCII payload cannot be corrupted by any encoding layer. See JOB 3 for the incident this cost.
>
> ‼️ **Never render template text to the console.** `Write-Host`/redirection transcodes through the console
> codepage and destroys Devanagari and Gujarati (they have no Windows-1252 equivalent). Read Meta responses
> with `[System.IO.File]::ReadAllText(path, [Text.Encoding]::UTF8)` and pass component objects straight
> through.
>
> ‼️ **The `category` of a `PENDING` template is PROVISIONAL.** Two reads of the same 24 templates minutes
> apart returned **1** MARKETING and then **6**, with one locale moving MARKETING → UTILITY in between.
> Only the category at `APPROVED` is real. Never judge an outcome, and never delete anything, while a
> variant is still in review.
>
> ‼️ **A guard that passes while checking nothing is worse than no guard.** A lossless-encoding proof here
> reported "PASSED" while reading **zero** characters, because its helper took `$C` but was called with
> `-Components`. Every integrity check in this folder now asserts a non-empty read and a minimum non-ASCII
> count before it is allowed to report success.

---

## JOB 7 — trial reminders and the number notices — **CREATED 2026-10-02**

Programme: `C:\Nik\Data\trial-reminders\PLAN.md`. Owner rule (2026-10-02): an UPDATE is a brand-new template; once at least one
language of it is `APPROVED / UTILITY`, the one it replaces is deleted from Meta AND from the code, so only one copy exists.

| New template | Why | Body params | Button |
|---|---|---|---|
| `clinket_trial_ending_paid` | the card networks' trial notice: date, amount WITH its period, how to cancel (the old renewal text said "subscription begins", doubled "Clinket" and always "per month") | firstName, product, date, price | `https://business.clinket.com/dashboard/{{1}}` = `billing` / `ai-billing` |
| `clinket_subscription_renews_soon` | India's day-before renewal notice, its own wording | firstName, product, date, price | same dynamic button |
| `clinket_ai_number_trial_ending` | byte copy of `clinket_ai_number_at_risk` | firstName, date, number, releaseDate | static → `/dashboard/ai-billing` |
| `clinket_ai_number_on_hold` | byte copy of `clinket_ai_number_held` | firstName, number, releaseDate | static → `/dashboard/ai-billing` (the old one opened the plan page) |
| `clinket_payment_retry_billing` | byte copy of `clinket_payment_retry_notice` | firstName, product | dynamic → the product's billing page |

Retired: `clinket_plan_renewal_notice`, `clinket_ai_number_at_risk`, `clinket_ai_number_held`, `clinket_payment_retry_notice` —
removed from code (pushed 2026-10-02) and DELETED at Meta 2026-10-02 (Canada 5 + India 3 variants each, 32 in all). ‼️ Stamps still
running the earlier build send those four names and get a Meta error until the new build is deployed.

Submitted pure-ASCII (`\uXXXX`), every variant read back and compared ordinally: identical. Four first submissions were refused
("variables can't be at the start or end") and resubmitted with a fixed ending — a refusal, not a MARKETING verdict.

Status read 2026-10-02 (`APPROVED/UTILITY` unless noted): Canada `trial_ending_paid` es PENDING; `subscription_renews_soon` en, es,
fr PENDING; `ai_number_trial_ending` en, es PENDING; `ai_number_on_hold` es PENDING and ‼️ **hi APPROVED/MARKETING**;
`payment_retry_billing` en, fr PENDING. India: `trial_ending_paid` hi PENDING; the rest approved.

Config `ApprovedLanguages` (both hosts) = **all five** (`en, es, fr, hi, gu`), like every other template. Owner ruling 2026-10-02:
pre-launch, every template is treated as APPROVED/UTILITY and the owner gets each pending or MARKETING language approved at Meta;
the code is NEVER trimmed to Meta's progress (a trimmed list is a change somebody must remember to undo).
Open with the owner: Canada `hi` of `clinket_ai_number_on_hold` came back MARKETING → appeal (WhatsApp Manager → Business Support →
Template Category Updates → Request Review). Never delete it and never resubmit it.

## JOB 6 — `clinket_chat_reply_customer` / `clinket_chat_reply_provider` — **CREATED 2026-09-20, AWAITING REVIEW**

Programme: `C:\Nik\Data\whatsapp-chat-messages\PLAN.md` §7.7. Purpose: the closed-window chat notice gains a **dynamic**
"Open chat" URL button (`…/messages?conversationId={{1}}` customer · `…/dashboard/inbox?conversationId={{1}}` provider)
so the tap opens the exact thread. Bodies and button text are **byte-identical** to the live APPROVED/UTILITY
`clinket_new_message_customer` / `_provider` variants (read live the same day: all 16 UTILITY) — nothing re-worded.
Submitted via the Graph API with `category: UTILITY`, `allow_category_change: false`, body sample `Sarah's Salon` /
`Raj Patel`, URL sample `…conversationId=c1b2d3e4f5a6b7c8d9e0f1a2`. Canada: en_US/es/fr_CA/hi/gu; India: en_US/hi/gu.
**All 16 accepted as PENDING / UTILITY at creation**; read back and compared with ordinal equality: 0 mismatches
(ids in the programme plan). Old templates stay live until the new ones are APPROVED and config is switched
(`WhatsApp:Templates` ×2 hosts + `ConversationNotifyTemplate` + `WhatsAppTemplateNames`), then the old two are deleted.
A MARKETING verdict on any locale is appealed via Template Category Updates within 60 days — never deleted.

## JOB 5 — the rename attempt — ❌ **FAILED AND FULLY REVERTED 2026-08-28**

The three JOB 3 templates each have one locale stuck on `MARKETING`, and an approved category cannot be
edited (`3835031`). The plan was to recreate each under a new name (a fresh name carries no 30-day lock),
verify UTILITY, repoint config, then delete the old names.

**24 variants were created with byte-perfect text — and 16 of them came back MARKETING.** The wording was
copied **verbatim** from templates that are `APPROVED / UTILITY` today. Identical words, opposite verdict.

**That is the proof that the old templates are grandfathered**, and that this wording cannot re-earn
UTILITY under the April 2025 rules. It was never really about the accents for these three.

**All 24 were deleted** on both WABAs the same day. The three original names were never touched and remain
fully intact (Canada 5 locales each, India 3 each). Net change to production: **none**.

‼️ **Do not retry this approach with the same wording.** See the misuse-restriction warning above — the
16-of-24 result is exactly the signal Meta acts on.

---


## JOB 3 — accent corruption + MARKETING fallout — ‼️ **PARTIALLY REPAIRED, STILL OPEN**

On **2026-08-28**, immediately after the 30-day lock lifted, all four JOB 2 locales were submitted. Three of
them reached Meta with **every accented character replaced by `?`**, because the submitting script sent a
Windows-1252 body (root cause above, now fixed in `Submit-WhatsAppUtilityRecreations.ps1`).

**All three of the corrupted locales were then classified `MARKETING`. The one that was never corrupted
stayed `UTILITY`.** That is a 4-for-4 correlation and it is the whole lesson of this incident:
`Actualizaci?n de tu cuenta… no se registr? ning?n m?todo de pago` is not readable Spanish, so Meta's
classifier could not see the utility intent. **Garbled text is not a cosmetic problem — it changes the
category Meta assigns, and an approved category can never be edited back.**

| Template | Locale | Meta id | Was corrupt | Text now | Category |
|---|---|---|---|---|---|
| `clinket_ai_minutes_low` | `es` | `2268299900406476` | ✅ no (wording has no accents) | ✅ byte-exact | ✅ **UTILITY** |
| `clinket_ai_minutes_low` | `fr_CA` | `1364185725384338` | ❌ yes | ✅ repaired, byte-exact | ‼️ MARKETING |
| `clinket_plan_trial_ended` | `es` | `1645334837599889` | ❌ yes | ✅ repaired, byte-exact | ‼️ MARKETING |
| `clinket_optin_first_contact` | `es` | `1368692198246897` | ❌ yes | ❌ still corrupt — `PENDING`, cannot edit | ‼️ MARKETING |

**Blast radius is exactly those three.** `Verify-WhatsAppTemplates.ps1` scans every readable field of every
variant on both WABAs — **1,580 fields across 352 variants** — for six corruption signatures (charset loss,
isolated `?`, `U+FFFD`, double-encoded UTF-8, smart-quote mojibake, control characters) and additionally
asserts every Hindi and Gujarati body actually contains its own script. **Nothing else on either WABA is
damaged.** India is entirely clean and every pre-existing production variant is still `APPROVED / UTILITY`.

### The three Meta rules this cost us, all verified by experiment

| Rule | Subcode | Consequence |
|---|---|---|
| A `PENDING` template cannot be edited at all | `2388003` | You must wait out the review before repairing anything |
| An `APPROVED` template's **category** cannot be changed | `3835031` | Sending `category` on an edit fails the whole request |
| An `APPROVED` template's **components** *can* be edited | — | ✅ this is the repair route; it resets status to `PENDING` for re-review |

> ‼️ **`allow_category_change:false` did NOT prevent the MARKETING downgrade.** Both templates were
> submitted with it and Meta approved them as MARKETING anyway. Treat that flag as a partial safeguard, not
> a guarantee. The only reliable defence is **submitting clean, unambiguous, correctly-encoded wording.**

### The fix

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Repair-WhatsAppTemplateAccents.ps1 -Mode Repair
```

`-Mode Status` (the default) mutates nothing and reports every locale — it never throws on a bad row,
because a status tool that dies on the first problem hides the state of everything after it. `-Mode Repair`
takes the wording from `whatsapp-utility-recreation-plan.json` — the single source of truth — sends it as a
pure-ASCII `\uXXXX` payload, then **re-reads Meta and refuses to report success unless the stored text
matches the plan byte-for-byte** (ordinal, including footer and every button label). It **never sends
`category`** on an edit, because that fails with `3835031`.

Re-run it until `optin_first_contact_es` reports `REPAIRED`. It is a no-op on anything already exact.

### Verifying the whole estate

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Verify-WhatsAppTemplates.ps1
```

Read-only. Reports character integrity, category/status discrepancies, locale completeness against the
Canada-5 / India-3 rule, India rule violations, and names present in only one region. It seeds the expected
name list from `clinqetshared\Constants\WhatsAppTemplateNames.cs`, so a template the runtime references but
Meta has never seen shows up as `NAME ABSENT ENTIRELY` instead of being invisible.

‼️ It deliberately skips `example` values that are URLs — Meta rewrites media examples to CDN links whose
`?` query separator otherwise fires the charset-loss rule ~40 times. A scanner that cries wolf gets ignored.

### Still to decide once re-review lands

If Meta keeps `fr_CA`/`es` on those two names as MARKETING even with correct wording, the category cannot be
edited away. ‼️ **Do not delete them to "start clean"** — that arms the 30-day name lock that JOB 2 just
spent a month waiting out, and it would take the healthy `en_US`/`hi`/`gu` variants' name with it. Raise a
Meta appeal instead, or accept the two locales as MARKETING and keep `ApprovedLanguages` excluding them.

‼️ **The proofs must NOT be deleted until JOB 3 is closed.** `Submit-WhatsAppUtilityRecreations.ps1` already
enforces this on its own: its `Assert-Components` check compares live text against the plan and throws on
any mismatch, so it will refuse to clean up a corrupted locale. That guard is working as designed — if
`-Mode Status` throws a "components mismatch", that is the safety net, not a bug.

---



## JOB 1 — `clinket_info_picture` (knowledge pictures, Phase B) — ✅ **DONE 2026-08-25**

Full record, wording in all five languages and every template id:
**[`clinket_info_picture.md`](./clinket_info_picture.md)**

| Step | State |
|---|---|
| 1. Proof `clinket_info_picture_v1`, 8 locales | ✅ APPROVED / UTILITY |
| 2. Production `clinket_info_picture`, 8 locales | ✅ **APPROVED / UTILITY** on both WABAs |
| 3. Delete the 8 proofs | ✅ deleted, absence verified by re-reading Meta |
| 4. `ApprovedLanguages` in the API **and** Functions appsettings | ✅ identical in both, parity-tested |

Nothing is outstanding. ‼️ The picture leg is wired but still **DARK** — nothing sends until
`Voice:Knowledge:Images:Enabled` is turned on. Approving a template does not enable a feature.

‼️ **Do NOT add this template to `whatsapp-utility-recreation-plan.json`.** That plan and its script are
scoped to the **Canada WABA only, with no India changes** — a deliberate safety property.
`clinket_info_picture` spans BOTH WABAs, so putting it there would break the script's own guarantees.

---

## JOB 2 — four Utility recreations — **SUBMITTED 2026-08-28, AWAITING REVIEW**

Four production locales were deleted during an earlier category incident and must be recreated from proofs
that are already `APPROVED / UTILITY`. The plan, the frozen components and every safety check live in
`whatsapp-utility-recreation-plan.json` + `Submit-WhatsAppUtilityRecreations.ps1`.

The Meta lock lifted as predicted. On **2026-08-28** all four were submitted and accepted with
`allow_category_change:false` — the 2388025 refusal did not recur. **But only one landed Utility:**

| Entry | Production locale | New Meta id | Outcome | Its approved proof (still present) |
|---|---|---|---|---|
| `ai_minutes_low_fr` | `clinket_ai_minutes_low` / `fr_CA` | `1364185725384338` | ‼️ MARKETING — text repaired, re-review pending | `clinket_ai_minutes_balance_notice_fr` |
| `ai_minutes_low_es` | `clinket_ai_minutes_low` / `es` | `2268299900406476` | ✅ `APPROVED / UTILITY`, byte-exact | `clinket_ai_minutes_balance_notice_es` |
| `optin_first_contact_es` | `clinket_optin_first_contact` / `es` | `1368692198246897` | 🟡 PENDING / UTILITY — text still corrupt | `clinket_contact_permission_notice_es` |
| `plan_trial_ended_es` | `clinket_plan_trial_ended` / `es` | `1645334837599889` | ‼️ MARKETING — text repaired, re-review pending | `clinket_plan_trial_status_update` |

**Remaining work on JOB 2 is blocked behind JOB 3.** No proof may be deleted until its production locale is
both `APPROVED / UTILITY` **and** byte-exact against the plan.

Once JOB 3 is closed and all four are approved, finish the cleanup with repeated runs of:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Submit-WhatsAppUtilityRecreations.ps1
```

`RemoteSigned` applies to that process only; it does not change the machine or user policy. The default
`Auto` mode validates the plan and the protected production locales, then performs exactly **one** safe
action per run:

1. Submit one missing production locale from its frozen Utility-approved components.
2. Stop without mutating while Meta reviews it.
3. Once it is `APPROVED / UTILITY`, delete only its matching proof.
4. Continue with the next locale on the next run.
5. Finish only when all four are approved Utility and all four proofs are gone.

So expect to run it several times across a day or two. Re-run it whenever Meta is still reviewing.

Read-only checks that mutate nothing:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Submit-WhatsAppUtilityRecreations.ps1 -Mode Status
```

The script takes the token from `-AccessToken`, `CLINKET_WHATSAPP_ACCESS_TOKEN`, or a secure prompt.
**No token is stored in this folder** — keep it that way.

Safety properties it enforces: Canada WABA `1302322178177914` only · Graph `v25.0` only · no India changes ·
no Marketing request and no accepted Marketing state · exact placeholder and component checks · the live
English/French/Hindi/Gujarati production variants are protected by id, status and category · a proof is
never deleted until its production locale is live `APPROVED / UTILITY` with exact components.

---

## JOB 4 — gaps found by the 2026-08-28 full audit — **OPEN, NEEDS A DECISION**

Config audited: `clinqetfuncations\Clinqet.Communications\appsettings.json` and
`clinqetapi\Clinqet.API\appsettings.json`, both under `WhatsApp:Templates`, against the live inventory of
both WABAs. **API↔Functions `ApprovedLanguages` parity is OK** — every entry identical in both hosts.

### 4a. `clinket_notification_digest` — ✅ CLOSED 2026-09-01 (en UTILITY both WABAs; 6 locales stuck MARKETING, appeals filed)

Created on BOTH WABAs (India en_US/hi/gu, Canada en_US/hi/gu/fr_CA/es), byte-exact verified. Wording:
`Here is the summary you asked for: {{2}} new updates in {{1}} on Clinket. Tap below to review them.`
(+ static URL button → business.clinket.com/dashboard/notifications). The "summary you asked for" anchor
flipped **en_US to APPROVED/UTILITY on both WABAs** — the original "You have N new updates" wording had
been classified MARKETING under the `_v1` proof. But **every non-English locale landed APPROVED/MARKETING**
(IN hi/gu; CA hi/gu/fr_CA/es) despite identical structure — the non-English classifiers again. Owner is
appealing those via Template Category Updates (argument: user-chosen digest mode; the body itself states
the request; identical en wording approved UTILITY on both WABAs). Config `ApprovedLanguages` = **all five**
`["en","es","fr","hi","gu"]` in both hosts (parity-tested) — **owner's explicit order 2026-09-01**: platform
is pre-launch, appeals are expected to land before go-live, and a trimmed list risks being forgotten. Known
consequence until each appeal lands: a send in that locale uses the MARKETING-categorised variant
(marketing-billed, still delivers). **Never delete a MARKETING variant** (30-day name lock). Verify the
appeals actually flipped before launch. Proofs `clinket_notification_digest_v1` deleted from India,
absence verified.

### 4b. `clinket_booking_updated` — ✅ CLOSED 2026-09-01 (APPROVED/UTILITY, all locales, both WABAs)

Created and live: India en_US/hi/gu + Canada en_US/hi/gu/fr_CA/es, **all APPROVED/UTILITY first pass**
(wording mirrored from the approved `clinket_booking_updated_provider`, customer voice; dynamic URL button
→ www.clinket.com/bookings/{{1}}). Config `ApprovedLanguages` flipped to `["en","es","fr","hi","gu"]` in
both hosts. Dispatch site `BookingService.HandleBookingUpdatedAsync` verified end-to-end (params match
BodyParams order; `bookingId` button param supplied). Proofs `clinket_booking_updated_v1` deleted from
India, absence verified.

### 4c. Four templates APPROVED on Meta but switched off in config — ✅ CLOSED 2026-09-01

- `clinket_booking_updated_provider` — LIT, all five languages, **actor-gated**: sends only when the
  CUSTOMER updated the booking (a provider's own edit never WhatsApp-pings the business).
- `clinket_booking_cancelled_provider` — LIT, all five languages, **actor-gated**: sends on customer
  cancellation and the 48h SystemTimeout, never on the business's own manual cancellation.
- `clinket_quote_expired` — LIT, all five languages (customer, terminal broadcast fan-out).
- `clinket_quote_cancelled` — **DELIBERATELY DARK** (`ApprovedLanguages: []`): its only trigger is the
  customer cancelling their own quote request, so the message would echo their own action. Do not flip on
  without a non-customer cancellation path existing first.

Same change: **every** `WhatsApp:Templates` entry now lists all five languages (a live Meta audit verified
every claim APPROVED before the sweep), and the new per-stamp `WhatsApp:WabaLanguages` allow-list
(IN `en,hi,gu` via committed appsettings.in.json + deploy.ps1; CA all five) keeps es/fr off India at the
registry choke point.

### 4d. India carries four `fr_CA` templates it should not have

`clinket_quote_cancelled` `1728938578281943` · `clinket_quote_expired` `1567843381532000` ·
`clinket_booking_cancelled_provider` `2049255782630696` · `clinket_booking_updated_provider`
`27296713389968792`

India is meant to carry `en_US`/`hi`/`gu` only. These four are the **only** rule violations on that WABA —
there is no Spanish anywhere on India, and no other stray French.

‼️ **Recommendation: leave them** (unchanged 2026-09-01, now doubly safe). Deleting them would arm a
**30-day name lock** on those names on the India WABA. Since 2026-09-01 the per-stamp
`WhatsApp:WabaLanguages` filter (`en,hi,gu` on IN) makes fr structurally unreachable on the India stamp
regardless of config — the stray rows are permanently inert.

**2026-09-01 audit note for JOB 2/3:** the three locales that were stuck (`clinket_plan_trial_ended` es ·
`clinket_ai_minutes_low` fr_CA · `clinket_optin_first_contact` es) now read **APPROVED/UTILITY** on live
Meta — the re-reviews landed. JOB 2/3 cleanup (proof deletion) can proceed via
`Submit-WhatsAppUtilityRecreations.ps1` per its own protocol. Also: `Verify-WhatsAppTemplates.ps1` crashed
on a `'Properties' cannot be found` error on 2026-09-01 (Graph response shape) — needs repair before its
next use.

### 4e. Secrets committed in `appsettings.json` (§19 violation)

`clinqetfuncations\Clinqet.Communications\appsettings.json` contains live values, not placeholders or Key
Vault references: `WhatsApp:Token`, `WhatsApp:AppSecret`, `WhatsApp:WebhookVerifyToken`, a Stripe
`WebhookSecret`, and an `AzureCommunicationServices:ConnectionString` including its access key. Dev-stamp
values, but they are real credentials in a tracked file. Rotate and move to Key Vault references.

### Templates live on Meta but absent from config (expected, no action)

`clinket_login_code` and `clinket_verify_phone` are `AUTHENTICATION` category and handled outside
`WhatsApp:Templates`; `clinket_booking_confirmed` is UTILITY on both WABAs but referenced by neither the
config nor `WhatsAppTemplateNames.cs` — worth confirming it is not an orphan. The four
`clinket_*_notice_*` / `clinket_plan_trial_status_update` names are the JOB 2 proofs and disappear when
JOB 2 closes.

---


## History

- **2026-08-20 ~23:55** — all four locales attempted before `safeNotBeforeUtc`; all refused with 2388025
  ("try again in 6 days"). No change made.
- **2026-08-25** — all four attempted again; all refused (36–37 hours left). No change made. The same day,
  `clinket_info_picture_v1` was proven `APPROVED / UTILITY` across 8 locales and the production name was
  submitted, using exactly the proof-first discipline above.
- **2026-08-28** — the lock lifted. All four JOB 2 locales submitted; the 2388025 refusal did not recur.
  `ai_minutes_low_es` reached `APPROVED / UTILITY` and is byte-exact. **Three arrived accent-corrupted**
  because `Invoke-RestMethod` sent a Windows-1252 body, and **two of those were then approved MARKETING
  despite `allow_category_change:false`** — the garbled text almost certainly caused the misclassification.
  Root cause fixed in `Submit-WhatsAppUtilityRecreations.ps1`, which now escapes every payload to pure-ASCII
  `\uXXXX` and refuses to send anything non-ASCII. `Repair-WhatsAppTemplateAccents.ps1` added; two of the
  three texts restored byte-exact. A byte-accurate sweep of all 352 variants on both WABAs confirmed **no
  other template is damaged**. The same day, the first full config-vs-Meta audit across both regions
  produced JOB 4.
