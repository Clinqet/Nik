# WhatsApp — the three AI Assistant number notices

> **Status: DRAFT, AWAITING OWNER APPROVAL OF THE WORDING. Nothing has been submitted to Meta.**
> Read-only `GET`s against both WABAs were used to gather the evidence below. No template was created,
> edited or deleted.

## 1. Evidence read live from the accounts (2026-10-01)

| Account | WABA id | Templates | Verdict spread |
|---|---|---|---|
| Canada "Clinket" | `1302322178177914` | 229 rows, 49 distinct names, 5 locales (`en_US`, `es`, `fr_CA`, `hi`, `gu`) | **219 APPROVED/UTILITY + 10 APPROVED/AUTHENTICATION** |
| India "Clinket" | `2518598361929331` | 139 rows, 3 locales for billing (`en_US`, `hi`, `gu`) | **133 APPROVED/UTILITY + 6 APPROVED/AUTHENTICATION** |

**Zero MARKETING. Zero PENDING. Zero REJECTED, in either account.** The `README.md` statuses for
JOB 2 / JOB 3 / JOB 5 ("stuck MARKETING", "all in review") are **stale** — those appeals and renames
have landed.

No template named for a number, a hold, forwarding, voice or the assistant exists yet, so none of the
three names below collides.

## 2. The already-approved siblings the wording is built from

Read live, English, Canada account — all `APPROVED / UTILITY`:

| Name | Body | Button |
|---|---|---|
| `clinket_plan_trial_ending` | "Hi {{1}}, your free trial of the Clinket {{2}} plan ends on {{3}}. **Add a payment method before then to keep** your {{2}} plan. Without one, you'll move to the free Clinket plan when your trial ends." | URL "Add payment method" → `/dashboard/billing` |
| `clinket_ai_trial_ended` | "Hi {{1}}, your free trial of the Clinket AI Assistant has ended, **so it's now switched off**. Add a payment method to turn it back on anytime." | URL "Add payment method" → `/dashboard/billing` |
| `clinket_plan_trial_ended` | "… Since no payment method was added, you've moved to the free Clinket plan, and **everything in your account stays exactly as it is**. Add a payment method to get {{2}} back anytime." | URL "Add payment method" → `/dashboard/billing` |
| `clinket_ai_minutes_empty` | "Hi {{1}}, your Clinket AI Assistant has used all its minutes for this month, **so it's paused until you top up**. Add minutes on your Clinket dashboard to start it answering your calls again." | URL "Top up" → `/dashboard/billing` |
| `clinket_provider_tax_updated` | HEADER "Tax settings updated" · "Hi {{1}}, **a Clinket administrator has updated** the booking tax configuration on your account. This affects the tax shown on your customer bookings. **Tap below to review the changes, or contact support if anything looks wrong.**" · FOOTER "Clinket Payments" | URL "Review tax settings" → `/dashboard/profile/payment-settings` |

Every bolded clause below is lifted from one of those live-approved bodies. The house pattern is:
`Hi {{1}},` → the factual account event → the plain consequence → one neutral next step → static URL
button to the authenticated partner **web** page. Headers and footers are static text (the registry has
no header-parameter support, so a header can never carry a variable).

## 3. PDF or just a button? — **Button only. No PDF.**

| Option | Verdict |
|---|---|
| **Static URL button, no media** ✅ | What all 11 approved billing templates do. The provider needs exactly one thing: to land on the page where they can act. |
| DOCUMENT header (a PDF) ❌ | There is no document in this story — no invoice, no statement, nothing to keep. `clinket_info_ready` carries a PDF only because a caller **asked on the call** for the owner's own material; that consent does not exist here. A PDF costs a render, a blob and a signed link, makes the message slower, and hands Meta extra surface to judge on a message whose whole value is a deadline and a link. |
| Dynamic URL button ❌ | Needs `ButtonUrlParamKey` and a runtime button component. Nothing here is per-record: one fixed page per notice is correct, and a static button is the shape Meta has already approved 11 times in these accounts. |

## 4. The three templates

All three: **category `UTILITY`**, `allow_category_change: false` (belt-and-braces only — since 2025-04-09
Meta downgrades rather than refuses), locales **CA `en_US`, `es`, `fr_CA`, `hi`, `gu`** and
**IN `en_US`, `hi`, `gu`** = 8 submissions each, 24 in total.

### 4.1 `clinket_ai_number_held` — the trial/service ended and the number is on a clock

Fires on `VoiceNumberHeld`. The one message in this set with a deadline the provider can miss.

- **HEADER** (TEXT, static): `Your assistant number is on hold`
- **BODY**:
  > Hi {{1}}, your Clinket AI Assistant is switched off, so your assistant number {{2}} is no longer answering calls. We're holding that number for you until {{3}}. Add a payment method before then to keep it.
- **FOOTER**: `Clinket AI Assistant`
- **BUTTON** (URL, static): `Manage billing` → `https://partner.clinket.com/dashboard/billing`
- **Parameters**: `{{1}}` first name · `{{2}}` the assistant number in full · `{{3}}` the hold deadline,
  already rendered in the provider's own language and time zone by `LocalTimeFormatter`
- **Samples**: `Raj Patel` · `+1 647 555 0100` · `14 October 2026, 6:00 pm EDT`

### 4.2 `clinket_ai_number_removed` — the hold expired, the number is gone

Fires on `VoiceAssistantNumberRemoved` with the retention reason.

- **HEADER** (TEXT, static): `Your assistant number was removed`
- **BODY**:
  > Hi {{1}}, the assistant number {{2}} has been removed from your Clinket account, so calls to it are no longer answered for your business. Everything else in your account stays exactly as it is. You can set up a new assistant number whenever you're ready.
- **FOOTER**: `Clinket AI Assistant`
- **BUTTON** (URL, static): `Manage AI Assistant` → `https://partner.clinket.com/dashboard/profile/ai-assistant`
- **Parameters**: `{{1}}` first name · `{{2}}` the number that was removed
- **Samples**: `Raj Patel` · `+1 647 555 0100`

### 4.3 `clinket_ai_contact_number_changed` — where their calls ring has changed

Fires on `VoiceForwardingNumberChanged`. Deliberately the closest wording to the approved
`clinket_provider_tax_updated`, because it is the same kind of event: an administrator changed a
setting on their account.

- **HEADER** (TEXT, static): `Where your calls ring has changed`
- **BODY**:
  > Hi {{1}}, a Clinket administrator has updated the number your AI Assistant rings to reach you. It changed from {{2}} to {{3}}. Your assistant number is unchanged, so customers still call you on the same number. Tap below to review it, or contact support if anything looks wrong.
- **FOOTER**: `Clinket AI Assistant`
- **BUTTON** (URL, static): `Review AI Assistant` → `https://partner.clinket.com/dashboard/profile/ai-assistant`
- **Parameters**: `{{1}}` first name · `{{2}}` the old number, masked · `{{3}}` the new number, masked
- **Samples**: `Raj Patel` · `+1 416 ••• •222` · `+1 416 ••• •333`

## 5. The two notices that deliberately get NO WhatsApp

| Type | Why not |
|---|---|
| `VoiceNumberBeingArranged` | "We're arranging your number, we'll let you know" — no deadline, nothing to act on, no consequence. A WhatsApp here is noise, and it costs a conversation. In-app, push and email carry it. |
| `VoiceForwardingChangeDeclined` | The reason is an admin's reviewed text. Putting free-form review wording into a Meta parameter is how a template body stops matching its approved category. In-app and email say it properly, where the text is localised and escaped. |

## 6. Why each should land UTILITY, and how confident I am

Meta's test is: **non-promotional**, and either **specific to the user's account** or **essential to them**.

| Test | These three |
|---|---|
| Specific to the account? | Yes — each carries that business's own number and, for the hold, its own deadline. |
| Essential? | Yes — calls stopping, a number being lost, and where calls ring are all facts the provider must know. |
| Promotional? | No offer, no discount, no price, no "upgrade", no urgency language, no benefit pitch. |
| The one risk | Meta classes "attempt to renew subscriptions" as MARKETING. §4.1's last sentence is a payment prompt. **It is word-for-word the construction in `clinket_plan_trial_ending` ("Add a payment method before then to keep your {{2}} plan"), which is APPROVED/UTILITY in all 5 CA locales and all 3 IN locales today.** That is the strongest evidence available: the same accounts, the same reviewer pool, the same clause. |

**Confidence: high — about 85–90% that all 24 land UTILITY on the first submission.**
Reasoning: both accounts currently hold 352 UTILITY templates and **zero** MARKETING ones; every clause
here is lifted from a live-approved sibling; and 4.3 is a near-copy of an approved administrator-changed-a-setting
body. The residual 10–15% sits almost entirely on 4.1's payment sentence and on the `hi`/`gu` machine-review
path, which is where the August 2026 downgrades happened.

If any locale does land MARKETING: **appeal it** (WhatsApp Manager → Business Support → Template Category
Updates → Request Review, free, non-destructive, 60 days). **Never delete and resubmit** — that is the
pattern Meta penalises with portfolio-wide recategorisation.

## 7. Proof name first, or straight to the real name? — **straight to the real name**

`README.md`'s law is to prove new wording under a throwaway `…_v1` first. That law was written for
*new* wording. These are derivative bodies, clause by clause, from siblings already approved in these
same accounts — the same situation as JOB 6 on 2026-09-20, which created the real names directly and had
all 16 locales accepted. A MARKETING verdict is recoverable for free by appeal, so the proof step buys
only the avoidance of a brief MARKETING window, at the cost of 24 throwaway templates to create, watch
and delete.

**If the owner prefers the proof route, say so and it is `clinket_ai_number_held_v1` etc. first.**

## 8. What gets wired once they exist (coded as fully approved, per the owner's instruction)

1. `WhatsAppTemplateNames`: three new constants, added to `All`.
2. `WhatsApp:Templates` in **both** hosts' `appsettings.json` (Main API + Functions), each with the
   **full** `ApprovedLanguages` list for its stamp and the `BodyParams` above. No `ButtonUrlParamKey`
   (static button), no `DocumentLinkKey`, no `ImageLinkKey`.
3. `CommunicationPreferenceConfig.WhatsAppEligibleCategories` gains `VoiceAssistant`. Only the three
   types that carry a template name can actually send — the others have no template and the dispatcher's
   rail refuses without one, exactly as `MessagesChats` already works.
4. The three notice producers set `WhatsAppTemplateName` and `RecipientWhatsApp`, and supply the body
   parameters already formatted for the provider's language and time zone.
5. The Meta-side submission payloads are pure ASCII with every non-ASCII character escaped to `\uXXXX`,
   and no template text is ever written to a console.
