# WhatsApp template issues — for the owner's separate session (2026-09-26)

Read live from Meta (Graph API, read-only) on 2026-09-26 for both WhatsApp business accounts: Canada
`1302322178177914` and India `2518598361929331`. Nothing was changed at Meta or in code. Template text is held by
Meta. It changes only when a new template is submitted and approved, or when an approved one is edited (an edit is
reviewed again and can change its category).

## 1 · `clinket_plan_renewal_reminder`

**Sent for two notices** (`BillingNotificationService.BuildWhatsApp`, `clinqetinfrastructure/Services/Payments`):
- `SubscriptionRenewalReminder`: India's 24-hour pre-debit notice before a renewal
  (`SubscriptionBillingService.ProcessDebitRemindersAsync`).
- `SubscriptionTrialEndingSoon` when a card is on file: the trial is about to convert.

Parameters: `{{1}}` first name · `{{2}}` product (plan or AI Assistant) · `{{3}}` date · `{{4}}` price. No button.

| Account | Language | Status | Current wording |
|---|---|---|---|
| both | en_US | APPROVED · UTILITY | Hi {{1}}, a reminder that your Clinket {{2}} subscription begins on {{3}} and you'll be charged {{4}} **per month**. If you'd prefer not to continue, you can cancel on your Clinket dashboard anytime before {{3}} at no cost. |
| Canada | fr_CA | APPROVED · UTILITY | Bonjour {{1}}, nous vous rappelons que votre abonnement Clinket {{2}} commence le {{3}} et coûtera {{4}} **par mois**. Si vous préférez ne pas continuer, vous pouvez l’annuler sans frais dans votre tableau de bord Clinket avant le {{3}} afin d’éviter le renouvellement. |
| Canada | es | APPROVED · UTILITY | Hola, {{1}}. Te recordamos que tu suscripción a Clinket {{2}} comienza el {{3}} y tendrá un costo de {{4}} **al mes**. Si prefieres no continuar, puedes cancelarla sin costo desde tu panel de Clinket antes del {{3}} para evitar la renovación. |
| both | hi | APPROVED · UTILITY | नमस्ते {{1}}, यह एक रिमाइंडर है कि आपकी Clinket {{2}} सदस्यता {{3}} को शुरू होती है और आपसे **हर महीने** {{4}} लिया जाएगा। अगर आप जारी नहीं रखना चाहते, तो आप {{3}} से पहले कभी भी अपने Clinket डैशबोर्ड पर बिना किसी शुल्क के इसे रद्द कर सकते हैं। |
| both | gu | APPROVED · UTILITY | નમસ્તે {{1}}, આ એક રિમાઇન્ડર છે કે તમારી Clinket {{2}} સબ્સ્ક્રિપ્શન {{3}} ના રોજ શરૂ થાય છે અને તમારી પાસેથી **દર મહિને** {{4}} લેવામાં આવશે. જો તમે ચાલુ રાખવા ન માગતા હો, તો તમે {{3}} પહેલાં ગમે ત્યારે તમારા Clinket ડેશબોર્ડ પર કોઈ પણ ખર્ચ વગર તેને રદ કરી શકો છો. |

**Where the issues are**
1. **"per month" is fixed text.** For a yearly holder the server correctly sends the YEAR's price in `{{4}}`, so the
   provider reads "₹11,988 per month": twelve times the real rate in words. Since 2026-09-26 the server sends the
   exact amount the renewal will debit; only the fixed word is wrong.
2. **"your subscription begins on {{3}}" is right for a trial converting, but wrong for a renewal.** India's
   pre-debit notice goes to someone who has paid for months, and tells them it "begins".

**Recommendation for the separate session**
- Submit two new templates. Keep the old one until both are approved, then switch the code in the same change:
  - a *renewal* template ("…your Clinket {{2}} subscription **renews** on {{3}} and you'll be charged {{4}}…");
  - a *trial-ending* template ("…your free trial ends on {{3}}; your Clinket {{2}} subscription then starts and
    you'll be charged {{4}}…").
- Put the period **inside the price parameter** and delete the fixed "per month": the server sends "₹999 per month"
  or "₹11,988 per year" already in the reader's language. The words exist: `Billing_PricePeriod_Month/_Year`.
- Languages: en/hi/gu on both accounts, and fr/es on Canada only (the house rule).

## 2 · `clinket_notification_digest`

**Sent by** `NotificationDigestService.BuildCommunicationRequest`
(`clinqetinfrastructure/Services/Communication`) for a team member's grouped notifications.

Parameters: `{{1}}` business name · `{{2}}` count (`EventCount`, capped at 100 by `DigestMaxEventsPerBucket`).
Static button → `https://partner.clinket.com/dashboard/notifications`.

| Account | Language | Status | Current wording |
|---|---|---|---|
| both | en_US | APPROVED · UTILITY | Here is the summary you asked for: {{2}} new updates in {{1}} on Clinket. Tap below to review them. |
| Canada | fr_CA | APPROVED · UTILITY | Voici le résumé que vous avez demandé : {{2}} nouvelles mises à jour dans {{1}} sur Clinket. Touchez ci-dessous pour les consulter. |
| Canada | es | APPROVED · UTILITY | Aquí está el resumen que pediste: {{2}} novedades nuevas en {{1}} en Clinket. Toca el botón para revisarlas. |
| both | hi | APPROVED · UTILITY | जैसा आपने चुना था, यह रहा {{1}} का सारांश: आपके लिए {{2}} नई सूचनाएँ हैं। इन्हें देखने के लिए नीचे टैप करें। |
| both | gu | APPROVED · UTILITY | તમે પસંદ કર્યા મુજબ, આ રહ્યો {{1}} નો સારાંશ: તમારા માટે {{2}} નવી સૂચનાઓ છે. તે જોવા માટે નીચે ટૅપ કરો. |

Good news: **every language is now UTILITY.** The MARKETING appeals landed; the skill still says otherwise and has
been corrected.

**Where the issues are**
1. **One update reads as plural:** "1 new updates", "1 nouvelles mises à jour", "1 नई सूचनाएँ", "1 નવી સૂચનાઓ".
   The count comes from code, but the noun is fixed text in the template.
2. **A capped digest is under-counted:** above 100 events the message says "100", never "100 or more".
   The email and SMS already say "100 or more" since 2026-09-26.
3. Spanish "novedades nuevas" repeats itself ("new news").
4. The button's domain — see §3.

**Recommendation:** submit a replacement whose count phrase is ONE parameter the server writes in the reader's
language: "Here is the summary you asked for in {{1}} on Clinket: {{2}}. Tap below to review them." with `{{2}}` =
"1 new update" / "12 new updates" / "100 or more new updates". The server already has these three sentences for
email and SMS (`NotificationDigest_BodyOne/_Body/_BodyCapped`). Keep the "the summary you asked for" opening: it is
what earned UTILITY.

## 3 · Every provider button points at a domain the platform does not use

On both accounts, **every provider template with a button (24 in Canada, 21 in India) links to
`partner.clinket.com`**. The provider web app's domain is `business.clinket.com`: the Front Door custom domain in
`azureautomation/networking.json` and the provider URLs in the API/Identity settings. No tracked file in any repo
mentions `partner.clinket.com`. Customer templates correctly use `www.clinket.com`.

Neither domain resolves today (pre-launch), so nothing is broken yet. At launch, every provider WhatsApp button
would open a site that does not exist.

Templates affected (both accounts unless noted): clinket_chat_reply_provider · clinket_notification_digest ·
clinket_booking_confirm · clinket_booking_new · clinket_booking_updated_provider · clinket_booking_confirmed_provider ·
clinket_booking_cancelled_provider · clinket_service_request · clinket_quote_accepted · clinket_review_received ·
clinket_provider_tax_updated · clinket_subscription_payment_failed · clinket_payment_retry_notice ·
clinket_plan_trial_ending · clinket_plan_trial_ended · clinket_plan_trial_status_update (Canada) · clinket_ai_trial_ended ·
clinket_ai_minutes_low · clinket_ai_minutes_empty · clinket_ai_billing_failed · clinket_ai_autorecharge_failed ·
clinket_ai_add_payment_method · clinket_ai_minutes_balance_notice_es / _fr (Canada).

**Two ways to fix — your call:**
- **A (recommended): add `partner.clinket.com` as a redirect domain on Front Door** (301 to the same path on
  `business.clinket.com`). One ARM + `deploy.ps1` change. No Meta review, no risk of a category flip, and it also
  covers every message already delivered.
- B: resubmit all ~45 templates with `business.clinket.com` buttons. Each one is re-reviewed per language, and some
  may come back as MARKETING (this happened to the digest).
