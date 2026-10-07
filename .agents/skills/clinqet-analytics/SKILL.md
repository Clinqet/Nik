---
name: clinqet-analytics
description: |
  **CROSS-CUTTING SKILL** — Clinqet's unified user-interaction analytics pipeline.
  One pipeline, two source apps: customer app (`clinqetwebuserapp`) and partner/provider
  app (`clinqetwebpartnerapp`). 35 EventType values flow through a shared
  `/api/analytics/track` endpoint → `analytics-events` Service Bus queue →
  `AnalyticsProcessorFunction` → Hive-partitioned Parquet
  (`user-interactions/appType={Customer|Provider}/type={EventType}/year=…/month=…/day=…`)
  → nightly `AnalyticsCompactionFunction` (2 AM UTC). PII guardrails (regex scrub +
  lat/lng rounding + metadata caps + auth-route suppression), sampling, rate limiting,
  end-to-end attribution via LinkedSearchId, and explicit AppType differentiation so
  customer recommendations never consume provider events. Distinct from
  `clinqet-search-discovery` which owns the `/search/track` + `/search/services`
  pipelines.

  USE FOR: adding a new tracked event/surface (either app), tuning sampling, adjusting
  rate limit, debugging dropped events, expanding metadata fields, modifying PII scrub,
  wiring a new conversion funnel, changing AppType behavior, adding a new AppType value.
  Applies to clinqetapi Controllers/Analytics/AnalyticsController.cs,
  clinqetinfrastructure/Services/Analytics/UserInteractionAnalyticsService.cs +
  ParquetStorageService.cs + ParquetReaderService.cs (UserInteraction stream),
  clinqetshared/Enums/AnalyticsEventType.cs + AnalyticsAppType.cs +
  DTOs/Analytics/TrackEventRequestDto.cs +
  Models/Analytics/UserInteractionEventData.cs + Models/AnalyticsSettings.cs +
  Constants/AnalyticsBlobPaths.cs + Constants/AnalyticsAllowLists.cs, clinqetfunctions
  Functions/AnalyticsProcessorFunction.cs + AnalyticsCompactionFunction.cs +
  RecommendationEngineFunction.cs (UserInteraction read path),
  clinqetwebuserapp services/analyticsTracker.js + hooks/useAnalyticsEngagement.js +
  components/analytics/PageViewTracker.jsx + services/searchService.js
  (LinkedSearchId capture), clinqetwebpartnerapp src/services/analyticsTracker.js +
  src/hooks/useAnalyticsEngagement.js + src/components/analytics/PageViewTracker.jsx +
  src/utils/apiHeaders.js.
---

# CLINQET ANALYTICS — COMPREHENSIVE SKILL

## ARCHITECTURE OVERVIEW

```
Customer UI action OR Partner UI action
  ↓
analyticsTracker.js (queue 20, flush 2s, sampling, scrub, surface, LinkedSearchId, 429 backoff)
  Customer app hardcodes appType="Customer" + eventScope="customer".
  Partner app  hardcodes appType="Provider" + eventScope="provider".
  ↓
POST /api/analytics/track  (anonymous allowed; rate-limited per-user/per-IP)
  ↓
AnalyticsController → IUserInteractionAnalyticsService.TrackBatchAsync (fire-and-forget)
  ↓ allow-list (35 EventTypes via the shared `AnalyticsAllowLists.UserInteractionEventTypes`) + AppType normalization + auth-route suppression
  ↓ sampling + lat/lng round + PII scrub + metadata caps + rate limit
Service Bus queue %ServiceBusSettings:AnalyticsQueueName% (default "analytics-events")
  ↓
AnalyticsProcessorFunction (batched ServiceBusTrigger) → classifies by EventType
  ↓
ParquetStorageService.AppendUserInteractionAnalyticsBatchAsync
  → blob user-interactions/appType={Customer|Provider}/type={EventType}/year=YYYY/month=MM/day=DD/…parquet
  ↓
RecentlyViewedService.ProcessRecentlyViewedAsync (only for ServiceView / ProviderProfileView)
  ↓
AnalyticsCompactionFunction (Timer 0 0 2 * * *) — UserInteraction substreams discovered
  via two-layer Hive listing (appType=…/, then type=…/), one work item per substream-day.
  ↓
RecommendationEngineFunction (Timer %RecommendationSettings:TimerSchedule%) → IRecommendationEngineService →
  ParquetReaderService.ReadUserInteractionSignalsAsync(from, to, "Customer", ct).
  Customer partition only — provider events are skipped at the storage layer.
  Since Phase C (2026-07-03) the reader also feeds ResultClick + CartInteraction(add) signals — see
  "RECOMMENDATION ENGINE COUPLING" below for the full contract.
```

## APP DIFFERENTIATION

Every UserInteraction record carries an `AppType` discriminator. Two surfaces use it:

1. **Parquet column `AppType`** (column 42 in schema v2). Self-describing for ad-hoc queries.
2. **Hive path partition `appType=<value>/`** (leading segment of the blob path). Query engines (Synapse / Fabric / Athena / Databricks) and the recommendation reader prune by AppType at the storage layer without opening file footers.

`AnalyticsAppType` (`clinqetshared/Enums/AnalyticsAppType.cs`):

```csharp
public enum AnalyticsAppType { Customer = 1, Provider = 2, Admin = 3 }
```

`[JsonConverter(typeof(JsonStringEnumConverter))]` — always serialized as the canonical name.

`AnalyticsAppType.Admin` is reserved for future admin-app tracking; no events are emitted with `AppType="Admin"` today.

Server normalization (in `UserInteractionAnalyticsService.NormalizeAppType`): null / empty / unknown values fall back to `"Customer"`. v1 clients (pre-2026-05-19) never sent an `AppType` field and were customer-only — this default preserves their semantics.

## EVENT TAXONOMY (35 EventTypes through this pipeline)

Verbs live in `EventSubType` (snake_case). EventTypes are coarse families; new verbs do NOT require enum additions.

### Legacy / recommendation-engine signals (kept for RecommendationEngine + RecentlyViewedService)
| EventType | Typical EventSubType | Owner side |
|---|---|---|
| `PageView` | (none) | Auto-emitted by `PageViewTracker` on both apps. 6 auth-token routes suppressed. |
| `ServiceView` | `direct`, `from_search`, `from_recommendation`, `from_provider_profile` | Customer — drives RecentlyViewedService. Web emits `from_provider_profile` on a profile service-row click and `from_search`/`direct` (per LinkedSearchId) on a `?service=` deep-link arrival (surface `service_detail`). |
| `ProviderProfileView` | `direct`, `from_search`, `from_share_link` | Customer — drives RecentlyViewedService |
| `BookingInitiated` | (none) | Both — drives RecommendationEngine signal weighting |
| `QuoteRequested` | (none) | Both — drives RecommendationEngine signal weighting |
| `FilterApplied` | (none) | Both — search/filter signals. Customer batch apply (mobile FilterScreen since A4; WEB `/services` + `/service/provider` Apply since A2-P2 2026-07-03) with byte-identical metadata keys `category, subcategory, min_rating, distance, has_active_offers, min_price, max_price, city, state, min_experience, availability` (empties omitted), surface `search_results`. |
| `ProfileView` | (none) | Both — self-view |

### Cross-app interaction events
| EventType | Surface examples | Typical EventSubType (action) values |
|---|---|---|
| `CartInteraction` | `cart`, `cart_checkout`, `service_detail` | `view`, `add`, `remove`, `qty_change`, `offer_view`, `promo_apply`, `address_select`, `date_pick`, `timeslot_pick`, `checkout_submit`, `checkout_success`, `checkout_fail` (customer-only feature) |
| `BookingAction` | `booking_list`, `booking_detail` | Customer: `view_detail`, `reschedule_init/confirm`, `cancel_init/confirm`, `contact_provider`, `download`. Provider: `accept`, `reject`, `reschedule_propose/accept`, `mark_complete`, `mark_no_show`, `cancel`, `add_notes`, `attachment_upload`, `contact_customer`. |
| `QuoteAction` | `quote_form`, `quote_list`, `quote_detail` | Customer: `form_open`, `draft_save`, `attachment_add`, `submit`, `bid_view`, `bid_accept`, `bid_reject`, `withdraw`, `contact_provider`. Provider (`myQuotes`): `view_detail`, `edit_open/submit`, `send`, `resend`, `convert_to_booking`, `mark_accepted/rejected`, `archive`. |
| `MessagingAction` | `messaging_inbox`, `messaging_thread`, `lead_thread` | `inbox_open`, `tab_switch`, `conversation_open`, `message_sent`, `attachment_sent`, `mute_toggled`, `hide`, `mark_read`, `older_load` |
| `ReviewAction` | `review_form`, `my_reviews`, `provider_profile.reviews_tab`, `profile.reviews` | Customer: `prompt_view`, `prompt_cta`, `form_open`, `submit`, `edit`, `delete`, `vote`, `report`. Provider: `reply_open`, `reply_submit`, `reply_edit`, `reply_delete`, `vote`, `report`. |
| `AuthAction` | `auth.login_email`, `auth.register`, `auth.login_passkey` | `login_submit`, `login_success`, `login_fail`, `mfa_required`, `register_submit`, `register_success`, `register_fail`, `otp_sent`, `otp_verified`, `social_click`, `passkey_login_attempt`, `passkey_login_success`, `passkey_login_fail`, `forgot_submit`, `forgot_complete`, `logout` |
| `SettingsAction` | `settings.profile`, `settings.notifications`, `settings.delete_account`, `profile.security`, `profile.change_password` | `profile_save`, `avatar_upload`, `email_change_init/verify`, `phone_change_init/verify`, `address_*`, `mfa_enable_init/success`, `mfa_disable`, `passkey_add_init/success/delete`, `notif_pref_change`, `password_change_submit`, `account_delete_init/confirm`, `data_download_request`, `marketing_pref_change` |
| `NavigationAction` | any | `tab_switch`, `menu_open`, `menu_click`, `dropdown_open`, `share_open`, `share_method`, `outbound_link`, `back_click`, `cta_click` + the notifications baseline on surface `notifications` (web + mobile): `list_view`, `notification_click` {type}, `mark_all_read`, `mark_read` (web-only per-item affordance) |
| `SearchAction` | `search_results`, `search_box`, lead inbox search | `query_submit`, `suggestion_view`, `suggestion_select`, `suggestion_abandon`, `sort_change`, `clear_filters`, `filter_toggle`, `no_results_view`, `radius_expand_view`, `did_you_mean_accept` |
| `ResultClick` | `search_results`, `home`, `categories`, `lead_list`, `explore_list` | resultType: `search_result`, `recommendation`, `recently_viewed`, `trending`, `related`, `category_browse`, `lead_card`, `explore_card` |
| `ContentEngagement` | any | `scroll_depth`, `dwell`, `faq_expand`, `gallery_view`, `gallery_swipe`, `portfolio_open`, `policy_view`, `help_article_view`, `spotlight_view`, `tour_*` |
| `ConsentAction` | `cookie_banner`, any | `cookie_accept`, `cookie_reject`, `cookie_customize`, `location_granted`, `location_denied`, `notif_permission_granted/denied` |
| `ErrorEncountered` | `global`, surface of origin | `api_error`, `validation_error`, `not_found`, `unhandled_error` |

### Provider-app additions (2026-05-19 — values 44–55)
| EventType | Surface examples | Typical EventSubType (action) values |
|---|---|---|
| `LeadAction` | `lead_list`, `lead_detail` | `view_detail`, `bid_submit`, `bid_update`, `bid_withdraw`, `bid_message_send`, `mute`, `hide`, `convert_to_booking`, `contact_customer`, `mark_won`, `mark_lost` |
| `OnboardingAction` | `onboarding.step1..step5`, `onboarding.ai_modal`, `onboarding.ai_nudge` | `step_view`, `step_next`, `step_back`, `step_skip`, `step_complete`, `wizard_resume`, `wizard_abandon`, `ai_modal_open`, `ai_file_upload`, `ai_extract_apply`, `ai_extract_discard`, `ai_nudge_dismiss`, `ai_nudge_accept` |
| `CalendarAction` | `calendar` | `view_mode_change`, `weekly_hours_save`, `copy_day`, `mark_unavailable`, `clear_unavailable`, `category_filter` |
| `ServiceCatalogAction` | `profile.manage_services` | `create_open/submit`, `edit_open/submit`, `delete`, `publish`, `unpublish`, `image_upload`, `image_delete`, `price_edit`, `bulk_upload` |
| `PortfolioAction` | `profile.portfolio`, `profile.gallery` | `add_open/submit`, `delete`, `reorder`, `caption_edit`, `gallery_open`, `gallery_swipe`. metadata: `{scope: 'global' \| 'per_service'}` |
| `LicenseAction` | `profile.licenses` | `upload_open/submit`, `delete`, `view`, `expiry_alert_view` |
| `OfferAction` | `profile.offers` | `create_open/submit`, `edit`, `delete`, `activate`, `deactivate` |
| `CustomerCrmAction` | `customer_crm` | `list_view`, `search`, `filter_apply`, `open_detail`, `view_history`, `note_add` |
| `AIAssistantAction` | `ai.text_enhance`, `ai.speech`, `ai.doc_intel` | `text_enhance_open/apply/discard`, `speech_start/stop/apply`, `doc_intel_open/upload/extract_success/extract_fail/extract_apply/discard` |
| `InvoiceAction` | `invoice_list`, `invoice_detail`, `invoice_edit`, `invoice_create` | `create_open/submit`, `edit_open/submit`, `send`, `mark_paid`, `download_pdf`, `print`, `soft_delete`, `view_detail` |
| `ProfileEditAction` | `profile.business_information`, `profile.contact_information`, `profile.business_address`, `profile.service_area`, `profile.qualities`, `profile.business_category` | `edit_open/submit`, `save`, `address_verify`, `service_area_save`, `qualities_save`, `category_change`, `friendly_name_set` |
| `NotificationAction` | `notifications` | `list_view`, `filter`, `mark_read`, `mark_all_read`, `delete`, `click` |

### Later additions (56–58) — provider-web emitters LIVE since A3, provider-MOBILE emitters mirrored byte-exactly since A5 (both 2026-07-02)
| EventType | Surface examples | EventSubType (action) values ACTUALLY EMITTED on web |
|---|---|---|
| `VoiceCallAction` (56) | `call_followups` (default), `profile.ai_assistant` (settings) | Live-call funnel (CallFollowUpsPage + useBrowserCall): `join_attempt`, `join_call` {result: success\|fail, latency_ms}, `quality` — with carrier + join_method metadata. History (surface `call_followups`): `history_view`, `history_filter` {filter: path\|needs_review, value}, `detail_expand` {path, has_transcript}, `recording_play` {path}, `recording_download` {path}. Settings (VoiceAssistantPage family, surface `profile.ai_assistant`): `settings_view` {status}, `enable_toggle` {enabled} (pause), `private_toggle` {enabled}, `hours_mode_change` {mode}, `language_change` {language}, `voice_preview` {voice}, `recording_toggle` {enabled}, `instructions_save`/`settings_save` {has_instructions} (manage save — instructions_save when the text changed), `application_save`, `application_submit`, `number_share_open` {method: copy}, `assistant_cancel`. Vocabulary-reserved, NO web call site (do not invent one): `test_call`, `transcript_view` (web has no transcript UI — details = `detail_expand`), `access_request_click` (the promo deep-links to Billing ⇒ emits BillingAction `upgrade_cta_click` instead). **SERVER-emitted OUTCOME subtypes (2026-07-03, `VoicePostCallProcessorFunction` post-create side-effects step, functions host): one per completed call by CallSummaryPath — `call_missed` (Missed), `call_voicemail` (Voicemail), `call_ai_handled` (Receptionist), `call_whisperer` (Whisperer) — plus a SECOND `call_ai_booked` event when the receptionist created a booking LIVE on the call (a PendingSuggestions DraftBooking carrying CreatedEntityNumber; post-call auto-applies do NOT count). Business-scoped: AppType Provider, ProviderId=businessId, UserNumber/DeviceId null — never the caller's number. Metadata {path, duration_bucket: 0_30/30_120/120_300/300_plus, model_tier (from the MESSAGE only — the CallSummary entity fabricates "mini"), has_transcript}. Deterministic EventId = first 16 bytes of SHA256("voice-outcome:{callId}:{subtype}") + messageId vpc-analytics-{eventId:N} ⇒ redelivery / side-effects-recovery re-emits are absorbed by downstream EventId dedup; the send is fail-quiet (a throw never fails post-call processing). Emitted via IServiceBusService.SendMessageAsync to ServiceBusSettings:AnalyticsQueueName (the functions host has no IUserInteractionAnalyticsService). Feeds the Insights VoiceSubtypeBuckets breakdown — see clinqet-smart-analytics.** |
| `BillingAction` (57) | `dashboard.billing` (helper default); explicit `call_followups` / `profile.ai_assistant` on the two upsell CTAs | `page_view` {plan_tier, is_promo}, `plan_card_view` {plan_tier, is_current} (once per card per mount), `plan_upgrade_open/confirm/success/fail` {plan_tier, interval, is_trial?, reason on fail: card_declined\|setup_failed\|api_error}, `plan_downgrade_open/confirm` {plan_tier, kind?: auto_renew_off\|trial_cancel}, `plan_resume` {kind: auto_renew_on\|undo_pending_switch}, `ai_addon_view` {state: enrolled\|catalog\|unavailable, model_tier?}, `ai_addon_purchase_open/success/fail` {model_tier, interval, is_trial?}, `ai_addon_cancel` {model_tier, is_trial}, `ai_addon_resume`, `ai_addon_tier_change` {from_tier, to_tier, kind?: undo}, `payment_method_add_open/add_success/add_fail` {reason}/`delete`/`set_default`, `topup_open/select/confirm/success/fail` {minutes}, `auto_recharge_toggle` {enabled}, `promo_enter/apply_success/apply_fail` {source: box\|offer}/`promo_remove` (NEVER the code string), `history_view` {has_transactions}, `history_page_change`, `receipt_download`, `upgrade_cta_click` {product, source, cta?} (emitted OUTSIDE billing: AiAssistantUpsellCard on `call_followups`, VoiceAssistantPromo on `profile.ai_assistant`). `payment_retry` stays vocabulary-reserved (dunning has no retry button — "Update card" rides payment_method_add_*). Metadata is tier/pack/interval names only — never card data, never raw currency amounts. |
| `InsightsAction` (58) | `dashboard.analytics` (helper default) | `page_view` {tier, empty}, `empty_state_view` {tier}, `card_view` {metric} (once per rendered card per mount — 20 metric names since the 2026-07-03 audit session (17 at B2, 19 mid-audit), byte-identical web+mobile: profile_views, lead_win_rate, conversion, price_benchmark, rating_benchmark, inquiries, top_searched, leads_posted, lead_competition, response_speed, bid_rate, lead_open_rate, search_visibility, view_to_inquiry, lead_funnel, time_to_bid, peak_times, voice_calls, unmet_demand, profile_view_trend), `locked_card_view` {metric} (Free tier — 4 metrics: lead_win_rate, conversion, search_visibility, view_to_inquiry), `area_tab_switch` {area_index}, `upgrade_cta_click` {tier} (BOTH locked-hero variants since B2 — empty-state AND non-empty; the A5-flagged web gap on the non-empty button is CLOSED), `refresh` {from: error}. + `useDwell("dashboard.analytics")`. `benchmark_expand`/`trend_hover` stay vocabulary-reserved (no expand/hover affordance on web). Non-upgrade CTAs on this page ride NavigationAction `cta_click` {widget: insights_empty_actions\|insights_leads_posted, target}. |

### Customer-web A2 additions on EXISTING families (2026-07-02) — verified against code; byte-parity with customer mobile
- `ServiceView` deep-link emitter: `businessProfile.jsx` fires ServiceView when the profile resolves a `?service=`/`serviceId=` deep link (how every search/rec/recently-viewed card lands) — surface `service_detail`, subtype `from_search` when LinkedSearchId is live else `direct`. The profile service-row click keeps `from_provider_profile`.
- Notifications baseline mirrored byte-exactly from mobile on `/notifications` (surface `notifications`): NavigationAction `list_view` (mount, ref-guarded) / `notification_click` {type} (page-layout rows in `NotificationItem` — the header dropdown intentionally does NOT emit) / `mark_all_read` + web-only per-item `mark_read` (mobile has no per-item affordance) + `useDwell("notifications")`.
- `SettingsAction`, surface `settings.payments` (flag-gated receipts page): `payments_view` {has_payments} (once per mount after load), `receipt_download` + dwell. `payment_method_*` stays vocabulary-reserved — the customer page lists booking receipts, saved payment methods have no customer-web affordance (BillingAction remains provider-only).
- `QuoteAction`, surface `quote_detail`: added `withdraw` (cancel-broadcast success, mirrors mobile) + `contact_provider` (Message-provider link per response). `bid_view` stays reserved (bids render inline — no expand affordance).
- Legal surfaces ×8 now carry `useDwell` + ContentEngagement `policy_view` (partner-web shape) on the existing mobile-parity surface strings: `privacy_policy`, `terms`, `cookie_policy`, `community_guidelines`, `verification_policy`, `data_deletion`, `about_us`, `do_not_sell_share` (that page also gained its missing `useScrollDepth`).
- `help_center`: `useDwell` + NavigationAction `outbound_link` {target: phone\|email\|whatsapp} on the support-channel links. `help_article_view` stays reserved (no articles exist).
- `my_reviews`: `useDwell` added (write-flow was ALREADY fully tracked: form_open/submit/submit_success/submit_fail on `review_form`; edit/delete/delete_success/delete_fail on `my_reviews`; vote/vote_fail/report/report_fail in `useReviews`).
- Customer tracker `inferSurfaceFromPath`: any single-segment path outside `STATIC_TOP_SEGMENTS` now resolves to `provider_profile` (mirrors Next.js `[friendlyName]` routing — previously PageView surface leaked the provider slug); explicit additions `/details`→`provider_profile`, `/about-us`→`about_us`, `/data-deletion`→`data_deletion`, `/do-not-sell-share`→`do_not_sell_share`, `/change-password`→`settings.change-password`.
- Stale-audit rows found ALREADY instrumented (no change): reviews write-flow, `/my-profile` (settings.profile verbs), passkey management (`auth.passkey_management`), FAQ `faq_expand`, legal scroll-depth ×7, quote-detail view/bid_accept/bid_reject(+fails), messages, bookings. `/reviews` is a static demo page — deliberately NOT instrumented. Share on service detail: the ServiceDetailModal has NO share affordance — `share_open/share_method` stay provider-profile-only.

### Provider-web A3 additions on EXISTING families (2026-07-02) — A5 mirrors these strings
- `ProfileEditAction`, surface `profile.payment_settings`: `payment_settings_view`, `payout_account_add` (Connect onboarding start), `verification_status_view` {status} (on ?connect=return sync), `settings_save` {setting: online_payments\|tax, enabled}. (`payout_account_edit/delete` reserved — Stripe-hosted, no in-app affordance.)
- `NavigationAction` dashboard-home widget contract: `cta_click` (or `tab_switch`/`outbound_link`) with surface `dashboard_home.<widget>` + metadata `{widget, target}`. Widget names in code: `new_requests`, `upcoming_bookings`, `services_list`, `complete_setup`, `upload_portfolio`, `share_profile` (pre-A3) + A3: `plan_status` {call_followups\|get_ai_assistant\|manage_plan}, `call_followups` {view_all\|call_detail}, `earnings` (tab_switch, target `week_{i}`), `quick_actions` {book_service\|create_quote_invoice\|create_offer\|my_bookings\|update_availability\|manage_services}, `mobile_app_promo` (outbound_link, {app_store\|play_store}), `ai_nudge` {finish_setup} (FinishSetupBanner — surface auto-inferred from its host page). The phase-doc names `setup_progress`/`services` were superseded by the pre-existing code strings `complete_setup`/`services_list` (actual code wins).
- Partner tracker surface-map additions: `/dashboard/call-follow-ups` → `call_followups`, `/dashboard/profile/ai-assistant` → `profile.ai_assistant`, `/dashboard/profile/payment-settings` → `profile.payment_settings`.
- Scroll-depth status: `booking_list`, `invoice_list`, `quote_list`, `lead_list` all carry `useScrollDepth`; the inbox scrolls an inner container (the window-based hook would never fire) so it deliberately has dwell only.

### Provider-mobile A5 additions (2026-07-02) — verified against code; byte-parity with provider web
- RN tracker (`clinqetmobilepartnerapp/src/services/analyticsTracker.ts`) gained `trackBilling` + `trackInsights` (web signatures; surface defaults `dashboard.billing`/`dashboard.analytics`) + surface-map entries `PlanAndBilling→dashboard.billing`, `Insights→dashboard.analytics`, `VoiceAssistant→profile.ai_assistant`, `CallFollowUps→call_followups`, `LiveCall→call_followups`.
- Insights screen mirrors the web InsightsView snapshot byte-exactly: `page_view` {tier, empty}, `empty_state_view` {tier}, `card_view` per rendered metric (20 metric names since the 2026-07-03 audit — B2 added the four lead-competition cards, the audit added lead_open_rate + search_visibility + view_to_inquiry, on BOTH platforms with identical render conditions), `locked_card_view` ×4 on Free (×2 pre-audit), `area_tab_switch` {area_index}, `refresh` {from: error}, `upgrade_cta_click` {tier} on the locked-hero CTA, NavigationAction `cta_click` {widget: insights_leads_posted, target: leads} + `useDwell('dashboard.analytics')`. Mobile's empty state has NO action rows ⇒ `insights_empty_actions` has no mobile emitter. The formerly-flagged web gap (NON-empty locked upgrade button untracked) was CLOSED in B2 (2026-07-03) — both web variants now emit `upgrade_cta_click` {tier}.
- Plan & Billing (P4 info-only): once-per-mount snapshot `page_view` {plan_tier, is_promo} + `plan_card_view` {plan_tier, is_current:"true"} (the single current-plan card) + `ai_addon_view` {state: enrolled|catalog} (enrolled = plan.aiAddOn OR VA Active/OnHold; `model_tier` never present — the price-free projection drops it). AI card's not-enrolled action → `upgrade_cta_click` {product: ai_addon, source: plan_billing_ai_card}; mobile-only verb `open_web_cta_click` on the "Open the Clinket web app" button (web cannot have that affordance). Never a price/vendor in metadata.
- Mobile VoiceAssistantPromo CTA (→ PlanAndBilling) emits `upgrade_cta_click` {product: ai_addon, source: voice_promo, cta: setup}; surface prop = `profile.ai_assistant` on the VA screen, `call_followups` when it renders as the follow-ups NotInvited gate.
- Voice settings/history mirror the frozen strings for every real mobile affordance: `settings_view` {status} (ref-guarded), `enable_toggle` {enabled: String(!paused)}, `private_toggle` {enabled}, `assistant_cancel`, `number_share_open` {method: copy}, `voice_preview` {voice}, `language_change` {language}, `hours_mode_change` {mode}, `recording_toggle` {enabled}, `instructions_save`|`settings_save` {has_instructions}, `application_save`, `application_submit`; `history_view` (list mount), `history_filter` {filter: path|needs_review, value}, `detail_expand` {path, has_transcript}, `recording_play` {path}, `recording_download` {path}. `transcript_view` stays reserved on mobile too (expanded details = languages + suggestions, no transcript UI); suggestion apply/dismiss deliberately untracked (web parity).
- SecurityPasskeys: the PROVIDER pair rides SettingsAction on `profile.security` (provider-web strings win): `passkey_add_init` / `passkey_add_success` {passkey_type: Biometrics} / `passkey_add_fail` {reason: cancelled|not_supported|other} / `passkey_delete` / `passkey_delete_fail` {status}. The CUSTOMER pair uses AuthAction on `auth.passkey_management` — the two sides intentionally differ; never "unify" one to the other.
- ProductTour (TourContext): ContentEngagement `tour_start` {act, total_steps} on the first successful spotlight measure; `tour_complete`|`tour_skip` {act, step, total_steps} on EVERY termination exactly once (Done on last step / Skip / mid-advance target loss), surface `tour.{act}`; act values byte-identical with web (`onboarding.step1`, `dashboard`). `tour_step` is emitted on NEITHER platform (reserved).
- Lead funnel RE-ALIGNED to web (pre-A5 mobile strings fragmented): bid verb = `bid_update`|`bid_replace`|`bid_submit`|`bid_message_send` emitted at submit start (hasAmount metadata: amount_bucket, message_length, has_duration, has_available_from, has_notes; question metadata: message_length), then `${verb}_success` {amount_bucket} / `${verb}_fail` {status}; the question path's success ALSO emits MessagingAction `message_sent` {context: broadcast_question, body_length_bucket} on `lead_thread`; withdraw = `bid_withdraw` (at confirm) / `bid_withdraw_success` / `bid_withdraw_fail` {status}; `view_detail` now carries categoryId/subcategoryId + {lead_status}; amount buckets now the web values (unknown/0_100/100_500/500_2000/2000_10000/10000_plus). Dead pre-A5 strings still present in old builds' data: `question_sent`, `bid_fail`, `bid_withdraw_init`, `bid_withdraw`-as-success, buckets none|low|mid|high, view_detail {category}.
- Lead LIST now mirrors web: `list_view` {result_count_bucket: 0|1_9|10_24|25_plus} once per mount after the first load, `list_load_more`, `tab_switch` {tab} + FilterApplied {status_filter} (⚠ mobile's New tab filters status Opened ⇒ value "opened"; web's New tab requests Delivered ⇒ "delivered" — a pre-existing PRODUCT divergence, group both as the "new" tab when analyzing), `cta_click` {target: refresh} (refresh icon AND pull-to-refresh), ResultClick `lead_card` {position, broadcastId, categoryId?, subcategoryId?, metadata: {lead_status}}.
- Quote verbs RE-ALIGNED to web: status changes now `mark_accepted`/`mark_rejected` (+`_init` {from_status, to_status} / success {to_status} / `_fail` {to_status, status}) — was approved/rejected; email send now the `send`|`resend` trios (verb by status Pending) — was send_email; + `edit_open`, `create_open`, `delete_init`/`delete`/`delete_fail` {status}, `convert_to_booking_init`/`_success` on BOTH `quote_list` and `quote_detail`. Mobile has no WhatsApp quote send ⇒ `send_whatsapp`/`resend_whatsapp` stay web-only.
- Deliberately NOT instrumented: Explore screens (`Screen/exploreTab/*`) — the Explore tab is COMMENTED OUT in `BottomNavigation-Route.tsx` and the screens are hardcoded static demos (mock data, dead filters) ⇒ unreachable; `explore_card` stays vocabulary-reserved on mobile. linkedSearchId — the ambient `setLinkedSearchId` store is still never called on either provider app (both trackers keep the plumbing), but the field itself is **LIVE since 2026-09-04 on the Ask Clinket surface**, passed EXPLICITLY per event: the server-minted answer id rides `linkedSearchId` on `SearchAction/ask`, on `AIAssistantAction answer_helpful|answer_not_helpful|answer_copy`, and on every `ResultClick` from that answer, so a rating joins to the question it judged. Explicit, not ambient, for two reasons: a 30-minute ambient window would attribute unrelated provider activity to an answer, and mobile's FINAL (background) flush drops the ambient value by design (`isFinal ? undefined : await getLinkedSearchId()`) while `event.linkedSearchId` survives it. ‼️ It must NEVER be moved into metadata — `SanitizeMetadata`'s phone scrub mangles 23.9% of 32-hex ids (measured, 200k samples). See `clinqet-business-search` §13.11.
- A5 collects no new data category ⇒ no privacy-card reseed; the 01-LEGAL §2 store declarations remain standing release-checklist items for both mobile apps.

### Customer rec-delivery Phase D additions (2026-07-03) — delivery-audit fixes, web ↔ mobile byte-parity
- Web home "Service Providers Near You" rail (`dashboardServiceProviders.jsx`, consumes `discovery/recommended-providers`) now emits ResultClick `recommendation` {position, providerId} on surface `home` — byte-identical with the mobile home providers rail (mobile emitted it since A4; web was the gap).
- Web `/service/[id]` discovery grid (the recently-viewed View-All target) emits ResultClick on surface `discovery`: `recently_viewed` for the recently-viewed section, `recommendation` otherwise — mirrors mobile `DiscoveryScreen` exactly.
- Customer-web disc cache is now `clinket_disc_rec_v3_*`: IDENTITY-SCOPED (djb2-hashed userId | `anon`) + **1h TTL** (was un-scoped v2 @ 6h, which kept serving the pre-login anonymous payload for up to 6h after the device→user merge); stale v2 entries purged once per session; logout still wipes localStorage entirely, so only the login transition needed the key change.
- Customer MOBILE discovery calls (`discoveryService.ts` recommended-services/providers) now use the AUTH client (`apiClient.getwithUrl`) — the old anonymous client kept recommendations device-keyed, so after merge-on-login the emptied device doc served generic rails forever. Web parity (web `getApi` always attached the bearer). Endpoints are AllowAnonymous ⇒ no 401/logout side-effects.
- Discovery read API hardening: `DiscoveryController` sanitizes out-of-range/NaN/±∞ lat/lng query params to null on all 5 endpoints (they bypass `SearchRequestDto` model validation and would otherwise reach the Azure Search geo filter and fail the rail); pair-or-nothing — a lone coordinate is dropped too.

### 2026-07-03 full-audit session — new/updated instrumented surfaces (verified against code)
- **Flow-B pay funnel** (customer web + customer mobile, byte-parity): BookingAction `pay_open` (ref-guarded) / `pay_submit` / `pay_success` / `pay_fail` {reason: card_declined\|validation\|api_error}; base metadata `amount_bucket` (unknown/0_100/100_500/500_2000/2000_10000/10000_plus, major units) + `currency` (ISO code, never amounts); surface per host: `booking_detail` (in-app), `booking_pay`, `invoice_pay` (web public pages — new tracker surface-map entries). `pay_success` = gateway accepted (paid OR pending — the webhook finalizes). `payment_method_kind` (card\|apple_pay\|google_pay) is web-Stripe-only (not cheaply known on RN/Cashfree).
- Partner web `public_track_bookings` guest funnel: `guest_lookup_submit/success/fail` {reason: not_found\|otp_invalid\|api_error}, `view_detail` {status} per rendered booking, `cancel_init/cancel_confirm/cancel_success/cancel_fail` — no guest email/phone/OTP ever.
- Partner web `do_not_sell_share`: ConsentAction `data_processing_restrict` {enabled} + surface-map fix (was hyphenated).
- Customer web standalone `/change-password` mirrors the settings twin byte-identically (`password_change`/`_success`/`_fail` {error_code} on `settings.changePassword`).
- Customer mobile: `help_center` dwell + `outbound_link` {target: phone\|email\|whatsapp} (web parity); IntroScreen `cta_click` {target: get_started\|login} on `auth.intro`.
- Provider mobile G2 batch (web-mirrored strings): invoice detail/create/edit full verb sets (`view_detail`, send trio incl. the previously-missing `send_init` legs, mark_paid/soft_delete trios, create/edit trios with `items_count`/`amount_bucket`/`send_immediately`), booking `send_email_init`, calendar `view_mode_change` + FilterApplied set, inbox `inbox_open`/`conversation_open` {context}, booking list (`query_submit`, `tab_switch`+FilterApplied, `create_open`, view-toggle cta, ResultClick `booking_card` {position, bookingId}), AddQuote emits the web-mirror success-side QuoteRequested, NotificationItem `click`/`mark_read`/`delete` (+fails), CRM create/edit submit trios, portfolio CreateProject add/edit trios, SocialLinks profile-edit save, ChangeLanguage `language_change`, `bulk_upload` (+`_fail`), Terms/CommunityGuidelines `policy_view`+dwell.
- Provider manual-booking `trackBookingInitiated` now carries the REAL `providerId` (payload-root businessId) on BOTH platforms; the hollow `customerId` was dropped (never existed on manual bookings).
- Phase-D ResultClick emitters fixed: bubble-phase onClick (capture-phase previously counted `tel:`/arrow clicks into the rec-engine click signal) + keyboard Enter/Space emission; `/service/[id]` unified on surface `discovery` for dwell + PageView.
- Known documented divergences: mobile invoice LIST uses `delete` where web uses `soft_delete` and lacks web's `_init` legs on its confirmations (pre-existing — group both when analyzing); mobile EditWebsite's save stub was FIXED post-audit (real persistence via the social-links PUT preserving other platforms + ProfileEditAction analytics on profile.contact_information).

### A2-P2 enrichment additions (2026-07-03) — filter granularity + suggestion impressions + dwell; web ↔ customer-mobile byte-parity
- `SearchAction` `filter_toggle` {metadata: filter, value}, surface `search_results` — one event per individual filter-control interaction in the DRAFT panels: customer web `/services` (ServicePageContent) + `/service/provider` (ProviderPageContent) + the mobile FilterScreen. `filter` names = the FilterApplied metadata keys; values are the picked option values with cleared-state constants `all` (category/subcategory/city/state), `any` (min_rating/min_experience/availability), `none` (min_price/max_price); booleans as "true"/"false"; category/subcategory carry IDs. Spam guards: web radius emits on pointer/key RELEASE only (value-deduped ref), mobile radius on `onSlidingComplete`; prices emit on commit (web debounced `onCommit`, change-only) / blur with a same-value guard (mobile `onEndEditing`). Unsampled (SearchAction — discrete user actions).
- `SearchAction` `suggestion_view` {searchQuery, resultCount}, surface `search_box` — ONCE per resolved NON-EMPTY suggestion set per distinct query (web SearchBox dedupes on query+context; mobile SearchScreen on the trimmed query); re-opens of the same set never re-emit. `suggestion_select ÷ suggestion_view` = the suggestion CTR.
- Customer WEB batch `FilterApplied` is now LIVE on both search pages' Apply (keys byte-identical to the mobile batch — taxonomy row above); the web panel Clear-All now emits `clear_filters` (mobile FilterScreen parity; the chip-row Clear-All already did).
- Dwell: web `useDwell("search_results")` mounted ABOVE ServicePageContent's keyed remount boundary (one dwell per visit, not per URL commit) + `useDwell("categories")` in categoriesList; mobile `useDwell('search_results')` (SearchResultScreen) + `useDwell('categories')` (CategoriesScreen). `/service/provider` is deliberately NOT double-dwelled — the `/service/[id]` page-level `useDwell("discovery")` already covers it.
- Dead code deleted: `components/customer/filter/` (filter.jsx + FilterModel/filterModel.jsx — an unrouted hardcoded-string demo modal holding the only pre-P2 web `trackFilterApplied` call site).

## PARQUET SCHEMA — 42 columns (schema v2 / 2026-05-19)

`BuildUserInteractionSchema()` in `ParquetStorageService.cs`. **Never reorder. New columns only at the end. `UserInteractionSchemaVersion = 2`. v1 files (no `AppType` column) are still readable — the reader treats missing AppType as `"Customer"`.**

Cols 1–41 unchanged from v1. Col 42:
| # | Field | Type | Nullable | Notes |
|---|---|---|---|---|
| 42 | AppType | string | Y | `"Customer"` / `"Provider"` / (future) `"Admin"`. Also leading Hive partition (`appType=<value>/`). |

## BLOB LAYOUT

```
analytics/                                     ← container (AnalyticsSettings.StorageContainerName)
  user-interactions/                           ← AnalyticsBlobPaths.UserInteractions
    appType=Customer/
      type=ServiceView/year=2026/month=05/day=19/interactions-…parquet
      type=BookingAction/year=2026/month=05/day=19/interactions-…parquet
      ...
    appType=Provider/
      type=LeadAction/year=2026/month=05/day=19/interactions-…parquet
      type=BookingAction/year=2026/month=05/day=19/interactions-…parquet
      type=AIAssistantAction/year=2026/month=05/day=19/interactions-…parquet
      ...
```

Path builders in `AnalyticsBlobPaths`:
- `BuildUserInteractions(appType, eventType, eventDate)` — full filename for writes.
- `BuildUserInteractionsStream(appType, eventType)` — `user-interactions/appType=…/type=…` stream root (no date) used by compaction and the reader.
- `BuildUserInteractionsDatePrefix(appType, eventType, eventDate)` — date-rooted folder prefix.

## SERVER-SIDE GUARDRAILS (`UserInteractionAnalyticsService.BuildMessage`)

| Guardrail | Setting | Default | Purpose |
|---|---|---|---|
| Allow-list (EventType) | `AnalyticsAllowLists.UserInteractionEventTypes` (`clinqetshared/Constants/AnalyticsAllowLists.cs`) — single-sourced for the service gate AND the processor routing since 2026-07-02 | 35 types | Reject server-emitted types (SearchQuery, BroadcastCreated, etc.) and unknown values; log warning, no DLQ |
| Allow-list (AppType) | code constant | Customer, Provider, Admin | Normalize unknown values to `"Customer"`; case-insensitive lookup returns canonical name |
| PageView suppression | `SuppressedPageViewPathPrefixes` | 6 auth-token routes | Avoid storing reset/verify tokens in PageUrl. Identical paths exist in both apps; one list covers both. |
| Sampling | `SamplingRates: Dictionary<string,double>` | **EMPTY** (B1 2026-07-03) | Default sampling lives in the FOUR client trackers (ContentEngagement 0.1, NavigationAction 0.25). A server rate here MULTIPLIES with the client rate (the pre-B1 duplicate 0.1/0.25 entries silently made effective capture 1%/6.25%) — keep empty except as an emergency per-env cost override. `SmartAnalyticsAggregationService.WeightFor` inverse-corrects by the SERVER rate only. |
| Lat/Lng rounding | `LatLngDecimalPrecision` | 2 (≈ 1.1 km) | Keeps analytics outside CPRA "precise geolocation" SPI threshold (~565m). Live search unaffected. NaN/Inf → null. |
| SearchQuery PII scrub | `EmailPattern` + `PhonePattern` regexes (code constants) | n/a | Replace `john@example.com` and `+1 (555) 123-4567` with `[REDACTED_PII]`. |
| Metadata key pattern | `^[a-z][a-z0-9_]{0,63}$` | n/a | Drops non-snake_case keys (defense against accidental PII like `userEmail`) |
| Metadata caps | `MaxMetadataKvPairs` / `MaxMetadataValueLength` | 20 pairs / 256 chars | Bound payload size, scrub values |
| URL/field caps | `MaxUrlLength` / `MaxTextFieldLength` | 2048 / 256 chars | PageUrl + ReferrerUrl are PII-scrubbed then truncated to `MaxUrlLength`; ComponentName + EventSubType truncated to `MaxTextFieldLength`. Truncate server-side, never reject. |
| Rate limit | `RateLimitPerMinuteAnonymous` / `RateLimitPerMinuteAuthenticated` | 1200 / 3600 | Denominated in EVENTS: `TryAcquire(key, limit, weight)` charges the validated batch's event count (weighted sliding window on `ISearchRateLimitService`); key = userNumber if auth, anonymized IP otherwise. Returns 429 with `Retry-After: 60`. |
| Correlation-id fallback | code (`ResolveCorrelationId`) | n/a | A non-Guid/absent `X-Correlation-Id` resolves to ONE `Guid.NewGuid()` per batch (resolved once, reused for every event in the batch) — the whole request still correlates. |
| IP anonymization | hard-wired `IpAnonymizer.Anonymize` (no flag) | n/a | /24 IPv4 (last octet zeroed); /64 IPv6 (low 64 bits zeroed via `IPAddress` parse, canonical output); IPv4-mapped IPv6 → IPv4 /24; unparsable input passed through trimmed |
| Capture toggle | `EnableAnalytics` + `EnableUserInteractionAnalytics` | true | Kill switch |

## CLIENT-SIDE BEHAVIOR

Customer (`clinqetwebuserapp/services/analyticsTracker.js`) and partner (`clinqetwebpartnerapp/src/services/analyticsTracker.js`) trackers are byte-for-byte equivalent except:
- `APP_TYPE = "Customer"` vs `"Provider"` constant, always added at the enrichment step.
- `EVENT_SCOPE = "customer"` vs `"provider"` default on each helper.
- `inferSurfaceFromPath` maps to app-specific routes.
- Provider tracker exports an additional 15 helpers (`trackLead`, `trackOnboarding`, `trackCalendar`, `trackServiceCatalog`, `trackPortfolio`, `trackLicense`, `trackOffer`, `trackCustomerCrm`, `trackAIAssistant`, `trackInvoice`, `trackProfileEdit`, `trackNotification`, `trackVoiceCall`, `trackBilling`, `trackInsights`) covering the provider-only EventTypes. `trackBilling`/`trackInsights` default their surface to `dashboard.billing`/`dashboard.analytics` — pass an explicit surface when emitting from any other page.
- Customer tracker has `trackCart`, `trackServiceView`, `trackProviderProfileView` (not in partner — those are consumer-side concepts).

Both have:
- 20-event queue, 2-second flush, sampling, scrub regex, surface inference, LinkedSearchId capture+TTL, 429 backoff (parse `Retry-After`, pause 60s default), visibilitychange(hidden) + beforeunload FINAL flush.
- **Sampling ownership (B1, 2026-07-03): the client trackers ARE the sampling layer** — each hardcodes `SAMPLING_RATES = {ContentEngagement: 0.1, NavigationAction: 0.25}` and drops at enqueue. The server's `AnalyticsSettings:SamplingRates` is now EMPTY; before B1 it duplicated these rates and the two multiplied (effective 1%/6.25% — unintended).
- Final flush (2026-07-02, A2): `flushEvents(true)` → `sendEventsFinal` posts via `fetch(..., { keepalive: true })` — the browser drops in-flight XHR at teardown, so the last batch rides keepalive with `applyObservabilityHeaders` (X-Device-Id / X-Session-Id / X-Analytics-Consent / Accept-Language…) + the bearer token re-applied manually (a bare `sendBeacon` would silently strip identity + consent headers — never "simplify" to it). Partner-side caveat: the final path reads `cachedLocation` synchronously (an awaited geolocation promise never survives unload). Normal periodic flushes keep the axios path (429 backoff intact).
- Metadata caps at enqueue (2026-07-03 audit): all FOUR client trackers cap metadata at 20 pairs / 256 chars, mirroring the server caps — the web keepalive final batch can never exceed the ~64KB fetch limit.

### Engagement hooks
Both apps have identical `hooks/useAnalyticsEngagement.js` exporting `useDwell(surface, {disabled, minDurationMs})` and `useScrollDepth(surface, {disabled, milestones})`. Hook emits go through the local tracker — AppType is inferred there.

### PageView auto-tracker
Both apps have `components/analytics/PageViewTracker.jsx` wired in `app/layout.js`. Emits one `PageView` per pathname change; skips 6 auth-token route prefixes.

### DeviceId pipeline
Both apps: `utils/apiHeaders.js` populates `X-Device-Id` from `localStorage` (created with `crypto.randomUUID()`), `X-Session-Id` from `sessionStorage`, plus `X-Correlation-Id`, `X-Client-Version`, `Accept-Language`. The persistence model is identical, so cross-app device-id collisions are impossible (each app's localStorage is origin-scoped).

### Provider MOBILE app (clinqetmobilepartnerapp) — FULL coverage since 2026-07-02 (analytics-recs Phase A5)
`src/services/analyticsTracker.ts` mirrors the web partner tracker (queue 20 / 2s flush, consent + jurisdiction gate, AppState background flush via `AnalyticsProvider`, PII scrub, sampling mirror, screen-name→surface map, `eventSource: "mobile"`, `APP_TYPE = "Provider"`), exporting the full provider helper set incl. `trackBilling`/`trackInsights`; `AnalyticsProvider` auto-emits PageView per navigation state change; `src/hooks/useDwell.ts` is the RN dwell port (no scroll-depth hook — RN lists scroll inner containers). Every EventSubType/surface string is byte-identical to provider web (see "Provider-mobile A5 additions"); jest suite 106/106, tsc + eslint vs baseline clean. The only pre-A5 fragmented strings (lead bid/withdraw/question verbs, quote status/send verbs, amount buckets) were re-aligned in A5 — old app builds keep emitting the dead strings until users update.

### Customer MOBILE app (clinqetmobileuserapp) — FULL coverage since 2026-07-02 (analytics-recs Phase A4)
`src/services/analyticsTracker.ts` mirrors the web tracker (24 helpers, queue 10 / 2s flush, consent + jurisdiction gate, AppState background flush, PII scrub, sampling mirror, route→surface map, `eventSource: "mobile"`, `componentName` instead of pageUrl). Search attribution is live: `searchService` sets LinkedSearchId from every search response and posts web-parity `/search/track` payloads; `src/hooks/useSearchInteractionTracking.ts` (FlatList-viewability impressions) + `src/hooks/useAnalyticsEngagement.ts` (useDwell / useScrollDepth) are RN ports of the web hooks. Every EventSubType/surface string is byte-identical to web. The two former client `trackBookingInitiated` double-count call sites were replaced with `trackCart checkout_*` (BookingInitiated/QuoteRequested are server-emitted only). Mobile-only taxonomy additions (verbs only, no enum changes): CartInteraction `address_select/date_pick/timeslot_pick/offer_view/promo_apply`, SearchAction `query_submit`, SettingsAction `language_change`, and the notifications baseline `NavigationAction list_view/notification_click/mark_all_read` (surface `notifications`) — **web /notifications mirrors these exact strings since Phase A2 (2026-07-02)**. Details in the `clinqet-customer-mobile` skill.

### Mobile tracker hardening (2026-07-03 audit session)
- Provider RN tracker posts WITH the bearer via a new `postWithStatus` (its events were previously anonymous — attribution loss); BOTH RN trackers now have working 429 backoff (the HTTP layers previously never surfaced statuses).
- The background (AppState) flush uses only the in-memory cached location and defers one microtask so same-turn dwell enqueues are included (fresh-location awaits previously lost the final batch).
- Customer RN tracker calls `Geolocation.setRNConfiguration({skipPermissionRequests:true})` so an analytics flush can never pop the OS location dialog (the app's own location flows request authorization explicitly).
- Provider PageView de-dups on active route name (navigation 'state' fires on every mutation); provider `scrubPii` returns non-strings unchanged (no more `searchQuery:""` skew).
- Both RN apps strip console.* in release builds (babel-plugin-transform-remove-console); token/payload logging removed.

## RECOMMENDATION ENGINE COUPLING — DO NOT BREAK

`ParquetReaderService.ReadUserInteractionSignalsAsync(fromDate, toDate, appTypeFilter, cancellationToken)` — `appTypeFilter` is REQUIRED. The recommendation engine passes `nameof(AnalyticsAppType.Customer)`. Reads ONLY these UserInteraction columns (**13 since the 2026-07-03 audit session** — Phase C added `EventSubType`, the audit added `EventId` as the de-dup key; the contract is additive-only, never remove/rename):

`EventId, EventTimestamp, EventType, EventSubType, UserNumber, DeviceId, IsAuthenticated, CategoryId, CategoryIds, SubcategoryId, SubcategoryIds, ServiceId, ProviderId`.

Filters to **six** event types (4 legacy + 2 added in Phase C 2026-07-03): `ServiceView, ProviderProfileView, BookingInitiated, QuoteRequested` + `ResultClick` (all resultType subtypes) + `CartInteraction` (the reader keeps ONLY rows with `EventSubType == "add"` — view/remove/checkout_* never reach the engine; checkout intent is already covered by the server-emitted `BookingInitiated`).

When `appTypeFilter == "Customer"`, the reader ALSO sweeps the legacy v1 prefix `user-interactions/type={EventType}/` (no appType segment) — those v1 files contain customer-only traffic. The sweep covers all six types.

Signal weights (`RecommendationSettings:SignalWeights` in the FUNCTIONS `appsettings.json`; class defaults mirror it — memory `feedback_appsettings_class_defaults`): BookingInitiated 10, **CartInteraction 9** (strongest pre-booking intent, just under booking), QuoteRequested 8, BroadcastCreated 7, ServiceView 6, ProviderProfileView 5, SearchQuery 3, **ResultClick 2**. ResultClick is deliberately LOW: a card click is near-always followed by the ServiceView/ProviderProfileView it triggers, so the click+view pair (8 / 7) must stay under BookingInitiated — no click→view dedup machinery (decided in Phase C; revisit only with data). ResultClick stays UNSAMPLED client-side; CartInteraction is unsampled too — weight math needs no sampling correction. A KnownSignalTypes entry missing from `SignalWeights` logs ONE warning per run and its signals are skipped (never silently).

Audit-session hardening (2026-07-03): the engine de-dups signals by `EventId` across all three lanes at grouping time — a redelivered Service Bus batch can no longer double-score. Events younger than `RecommendationSettings:LateArrivalGraceMinutes` (default 15, class↔appsettings mirrored) are deferred to the next run and the reader re-reads one extra day, closing the boundary race where a concurrently-landing file's older-stamped events were permanently dropped by the per-user watermark. Per-file Parquet read failures surface as `FileReadFailures` → the run holds the watermark and raises a forced admin alert ("Signal loss risk"). Merge-on-login is an ATOMIC claim: the device doc is replaced with an emptied stub conditioned on its ETag (one winner; losers defer — the old unconditioned delete + separate stub write allowed double-merges that permanently doubled scores); on user-doc 412 exhaustion the device history is RESTORED for a lossless retry. RecentlyViewed merge got the same ETag claim + a 412-retry loop + restore (a single 412 previously destroyed the anonymous history). `DiscoveryController`'s merge cooldown is an atomic TryAdd/TryUpdate claim, released on merge failure.

Phase C read-path hardening (2026-07-03): `RecommendationReadService.GetRecommendationsAsync` falls back to the DEVICE doc when the authenticated user's doc doesn't exist yet and a deviceId is present (closes the merge-on-login race window — merge is fire-and-forget); default `LastComputedAt` timestamps are decay-guarded to 1.0 in all three decay sites (engine carry-forward, read-time last-mile, merge normalize) — an unset timestamp would underflow `exp` to exactly 0 and wipe the history. Read-time last-mile decay is mathematically inert on the normalized output (uniform per-level multiplier cancels in score/max normalization) — kept as documented design, locked by `GetRecommendationsAsync_ReadTimeDecayCancelsInNormalization_OutputsAgeInvariant`.

Constraints:
- Never remove or rename any of those 13 columns (the original 11 are the sacred legacy set). `ParquetReaderContractTests` asserts all 13 signal properties.
- Never remove or rename those 6 event types from the controller allow-list and the function processor allow-list (they must stay in sync); the 4 legacy types are locked by `ParquetReaderContractTests` (API unit) + `Reader_ContractRegression_LegacyTypesColumnsAndV1SweepIntact` (functions integration, real Parquet + Azurite).
- Lat/Lng rounding does NOT affect recommendations (the reader doesn't load Lat/Lng).
- DeviceId is the partition key for anonymous recommendations (`RecommendationReadService.GetByPkAsync(deviceId)`).
- The partner-app DeviceId is a separate localStorage entry from the customer-app DeviceId (different origins). Cross-app correlation is intentionally not possible. Provider-app events (e.g. lead_card ResultClicks) live under `appType=Provider/` and are excluded from customer recommendations at the storage layer.

## COMPACTION

`AnalyticsCompactionFunction` runs nightly (`AnalyticsCompactionSettings.CronExpression` default `"0 0 2 * * *"` — 2 AM UTC). For UserInteractions, it discovers `appType=…/type=…/` substreams at runtime via two-layer Hive listing (`GetBlobsByHierarchyAsync` with delimiter), then adds one work item per (substream, day). Each work item is processed identically to other flat streams: lock blob → list originals → union-schema merge → write `compacted-YYYYMMDD.parquet` → write marker → delete originals.

Marker file `_compacted.json` and lock file `_compaction.lock` live inside each `…/day=DD/` folder. The lock prevents split-brain across function instances.

**Late-arrival re-compaction sweep (B1, 2026-07-03):** a compacted day is no longer final. Within the `LookbackDays` window (default **3** — at 1 the sweep would never revisit a compacted day), the marker-exists path splits post-marker parquet files by `CreatedOn` vs `marker.CompactedAt`: older = orphans of a failed delete pass (removed, as before); newer or unknown = late arrivals (DLQ resubmissions, redeliveries, outage backlog) that are **re-compacted under the same lease** — the existing `compacted-*.parquet` is folded back in as an input, EventId dedup absorbs overlap, the compacted blob is overwritten in place, the marker rewritten, late originals deleted. Late files older than the window: raise `LookbackDays` via config for one night. Marker semantics: `CompactedAt` = **listing-start minus a 5-minute clock-skew margin** (`CompactedAtSkewMargin`) — NOT compaction-end time; the old end-time stamp let a file landing during compaction be deleted as an "orphan" on the next run (real data-loss race, fixed in B1). Over-inclusion is safe (dedup); never move `CompactedAt` later than listing start.

**DLQ visibility (B1, 2026-07-03):** `AnalyticsProcessorFunction` dead-letters with reasons `MalformedJson` / `MissingEventType` / `UnknownEventType` / `DeserializationFailed`, and now raises ONE aggregated admin alert per trigger invocation that dead-letters anything (`FailureNotificationHelper.HandleAnalyticsDeadLetterAsync`: severity High, reason→count map + ≤5 sample MessageIds; gated on `AdminAlertSettings:EnableSystemFailureAlerts` OR `forceAdminAlert`; flood-controlled via `IAdminAlertCooldownService` key `analytics:dlq:{source}`, window `AnalyticsSettings:AdminAlertCooldownMinutes` default 15). Covers both triggers (`AnalyticsProcessor` + `BroadcastAnalyticsProcessor`). Ops flow after an alert: inspect the DLQ, fix the producer, resubmit — resubmitted events land as late files and the re-compaction sweep folds them in.

**Audit-session hardening (2026-07-03):** a dataless (stream × day) no longer creates a lock blob + empty marker (they accrued forever and kept dead substreams discoverable); substream discovery skips legacy v1 prefixes (`user-interactions/type=…` without an appType segment) instead of generating garbage work-item paths; the compacted-blob upload is ETag-FENCED on the state observed at listing (IfMatch existing / IfNoneMatch * when new) — a writer that silently lost its lease can no longer overwrite a competitor's output while deleting originals it never folded in (contention → skip without deleting); the compacted file's metadata carries the MAX `clinqet.analytics.schemaVersion` of its inputs (the documented migration mechanism survives compaction); a CLR-type conflict in the union schema fails LOUDLY instead of silently nulling one side (nullability mismatches keep the nullable variant); the lease renewal loop renews at 1/3-lease cadence and aborts before expiry (the old half-lease + 2-failures policy aborted at/after expiry). Upstream of compaction: `AnalyticsProcessorFunction` now splits every batch per event DAY before appending (a batch straddling midnight/backlog drain previously filed all events under the FIRST message's day, mis-windowing readers and escaping the late-arrival sweep) and parses each message body once (classification + typed deserialization share one JsonDocument); `ServiceBusService.SendBatchAsync` mints bodies + MessageIds ONCE and resumes from a cursor across retries — a retried multi-sub-batch send no longer re-delivers earlier sub-batches with fresh MessageIds.

## COMPLIANCE POSTURE (India + USA + Canada)

### Consent gating — first-party analytics honors the cookie choice (2026-05-30, Posture C)

First-party analytics is gated on the user's cookie-banner Analytics choice (it previously fired regardless — only GA/GTM was gated). Enforcement is **server-authoritative + header-driven**, zero DB/Cosmos on the request path:
- Clients send `X-Analytics-Consent: granted|denied` on every request (`applyObservabilityHeaders`, from the consent cookie via `getAnalyticsConsentSignal()`). Constants: `clinqetshared/Constants/AnalyticsConsentHeader.cs`.
- `IAnalyticsConsentResolver.ShouldKeepIdentified(country, signal)` = `country ∈ AnalyticsSettings.NoticeBasedCountries (["us"])` **OR** `signal=="granted"`. `BaseController.GetAnalyticsConsent()` reads the header.
- **US = notice-only**: keeps identified analytics (device id + user number) even when declined (decline only turns off GA/GTM). Lawful under notice + opt-out across all US state laws given our non-sensitive design.
- **India + Canada**: when declined/undecided, **de-identify** = pass `null` device id + `null` user number to the capture (both already nullable on the anonymous path). Aggregate row kept (honors §2 "never break search analytics"). DPDP needs consent; Quebec Law 25 needs opt-in.
- Applied at EVERY first-party emitter (sweep `.TrackAsync`/`.TrackBatchAsync`/`.Capture*` before adding a new one): `AnalyticsController.TrackEvents`; `SearchController` (`RequestContextSnapshot` build point covers search + suggestion; inline in `/track`); `DiscoveryController.ResolveUserIdentifierAsync` (returns `(null,null)` → generic recommendations/recently-viewed); and the server-emitted events `BookingController.TrackBookingInitiated`, `QuoteController` QuoteRequested (null userNumber+deviceId+isAuthenticated), `AIAssistantController` provider-setup (null deviceId, businessId kept). Each injects `IAnalyticsConsentResolver` and computes `keepIdentified` on the request thread (headers gone inside the fire-and-forget `Task.Run`). Marketing-sync device id is out of scope (separate marketing-email opt-in). **Any new server-side analytics emit MUST gate the same way.** The functions-host voice-outcome emit (`VoicePostCallProcessorFunction`) carries no personal identifiers by construction (businessId only; null UserNumber/DeviceId — the declined-consent shape), so there is nothing to de-identify and no request headers exist there to resolve.
- Client tracker (`analyticsTracker.js trackEvent`) additionally skips sending when `!(isAnalyticsConsentGranted() || getClientJurisdiction()==='us')` — a minimization optimization; the server is authoritative.
- Bundled "accept Terms" is NOT valid analytics consent in India/Quebec (must be specific/unbundled/not a service precondition); it IS sufficient notice for the US. Keep the disclosure in policy — never remove it.

### General
- **California CPRA**: "Do Not Sell or Share My Personal Information" link in footer + opt-out routing.
- **Precise geolocation** (CPRA SPI): dodged by rounding Lat/Lng to 2 decimals (~1.1 km) in analytics. Live search/booking unaffected.
- **Persistent DeviceId**: random `dev-<uuid>` GUID — still a "persistent identifier" (personal data). Dual-purpose: anonymous **cart** key (essential, always kept) + analytics/personalization (consent-gated per above). Drives the recommendation engine for anonymous customer users; partner-app DeviceId is collected on the same basis but not used by the customer-side recommendation engine. **Never add sensitive fields to analytics** — that keeps the US in the opt-out (notice) lane in all state laws.
- **SearchQuery**: kept raw at capture under legitimate interest. Email + phone patterns regex-scrubbed at the boundary.
- **Privacy-policy disclosure**: a single `userapp` CodeDesc record per country (`in`, `us`, `ca`) covers BOTH Consumer and Partner usage — `policyService.js` routes every privacy lookup to the `userapp` record via `SHARED_USERAPP_POLICY_TYPES`. Source HTML lives in `cosmosindexsetup/Documents/clinket-legal-center.html` cards `india-privacy` (India-only) and `north-america-privacy` (shared by `us` + `ca`; `LegalPolicyManifest.ResolveCardId` maps both country codes to the same source card so the body is byte-identical, while the two Cosmos docs remain per-country).

## BEFORE-MERGE CHECKLIST

- [ ] New event has an `EventType` value in `AnalyticsEventType` enum (or reuses one). Verb goes in `EventSubType` (snake_case).
- [ ] New EventType added to the single shared `AnalyticsAllowLists.UserInteractionEventTypes` (`clinqetshared/Constants/AnalyticsAllowLists.cs`) — both the service accept-gate and the processor routing consume it, so drift is structurally impossible. Extend the allow-list regression test (`AnalyticsControllerTests.UserInteractionAllowList_…`, asserts count=35) and the accept-theory InlineData sets in BOTH test projects.
- [ ] AppType set explicitly only on direct callers (tests, etc.); the tracker handles it automatically per app.
- [ ] No free-text user content captured (no message body, review body, address, name, email, phone, OTP, password).
- [ ] Metadata keys snake_case ASCII; values bucketed/categorical, ≤ 256 chars.
- [ ] If new event is high-frequency, add the sampling rate to the FOUR client trackers' `SAMPLING_RATES` (web customer/partner + RN customer/partner — keep byte-identical). Do NOT also add a server `AnalyticsSettings:SamplingRates` entry — server rates MULTIPLY with client rates (the server dict is an emergency override only).
- [ ] Tracker helper present in the relevant `analyticsTracker.js` (or reuse `trackCustom`). Customer + partner trackers stay in lockstep where they share helpers.
- [ ] Call sites pass an explicit `surface` when more specific than the auto-inferred path.
- [ ] Tests: unit tests for any new server-side behavior. Allow-list parity test exercises every new EventType.
- [ ] Privacy disclosure: if you collect a new categorical field, update both `…-privacy` and `…-privacy-partner` cards in `clinket-legal-center.html` and reseed.
- [ ] `ParquetReaderService.ReadUserInteractionSignalsAsync` columns and event-type filter extended ADDITIVELY only, never removed/renamed (recommendation engine contract); any extension updates `ParquetReaderContractTests` + the functions integration contract test.
- [ ] No new Cosmos container or partition-key change (would require explicit user approval per §0.7).
- [ ] If you add a new AppType value, update the `AnalyticsAppType` enum, expand `UserInteractionAnalyticsService.ValidAppTypes`, and confirm Hive path-builder produces a usable folder name.

## CROSS-LINKS

- Search analytics (81-col Parquet, /search/services + /search/track): `clinqet-search-discovery` SKILL.
- Recommendation engine consumer of UserInteraction Parquet: `clinqet-function-app` SKILL (RecommendationEngineFunction).
- RecentlyViewedService: `clinqet-infrastructure` SKILL.
- Frontend UI patterns + Surface taxonomy: `clinqet-user-app` SKILL (customer) and `clinqet-partner-app` SKILL (provider).
- Service Bus + queue config: `clinqet-deployment` SKILL.

## SETTINGS SUMMARY

`AnalyticsSettings` (`clinqetshared/Models/AnalyticsSettings.cs`). Class defaults mirror `appsettings.json` per memory `feedback_appsettings_class_defaults`.

```
AnalyticsSettings:EnableAnalytics                       = true
AnalyticsSettings:EnableSearchAnalytics                 = true
AnalyticsSettings:EnableUserInteractionAnalytics        = true
AnalyticsSettings:CaptureUserInfo                       = true
AnalyticsSettings:HashSalt                              = (rotate per env)
AnalyticsSettings:MaxBatchSize                          = 50
AnalyticsSettings:LatLngDecimalPrecision                = 2
AnalyticsSettings:MaxMetadataKvPairs                    = 20
AnalyticsSettings:MaxMetadataValueLength                = 256
AnalyticsSettings:MaxUrlLength                          = 2048  (PageUrl/ReferrerUrl: scrub then truncate)
AnalyticsSettings:MaxTextFieldLength                    = 256   (ComponentName/EventSubType: truncate)
AnalyticsSettings:RateLimitPerMinuteAnonymous           = 1200  (counts EVENTS — a batch charges its event count; trackers batch ≤20/2s ⇒ ≤600 events/min worst case)
AnalyticsSettings:RateLimitPerMinuteAuthenticated       = 3600
AnalyticsSettings:SamplingRates                         = {}    (empty since B1 — clients own default sampling; a server rate MULTIPLIES with the client rate)
AnalyticsSettings:SuppressedPageViewPathPrefixes        = [6 auth-token routes]
ServiceBusSettings:AnalyticsQueueName                   = "analytics-events"
AnalyticsCompactionSettings:Enabled                     = true
AnalyticsCompactionSettings:CronExpression              = "0 0 2 * * *"
AnalyticsCompactionSettings:LookbackDays                = 3     (≥2 required for the late-arrival re-compaction sweep)
AnalyticsCompactionSettings:ParallelStreams             = 3
AnalyticsCompactionSettings:RowGroupTargetSize          = 50000
```

> **Payments Phase 7 (Smart Analytics / "Insights") is SHIPPED** — see the `clinqet-smart-analytics` skill. It CONSUMES the analytics pipeline read-only (a dedicated `ProviderInsightsParquetReader`, the existing producers/reader unchanged) and the search index (price/rating benchmark), and is the final phase of the payments chain (P0→P7 complete).

---

## Discovery-surface instrumentation — session 8, 2026-07-27

The per-service page (`/{friendlyName}/services/{slug}`) shipped with a dwell timer and **zero
interaction events** — the newest and most SEO-important page could not report whether it converted.
Also found untracked: the landing card's Message and Call, and the city page's search submit.

No API change was needed for any of it: `EventSubType` is free text ≤512 and `Surface` ≤64 in
`TrackEventRequestDto`.

### Events added
| Surface | Event | Notes |
|---|---|---|
| `provider_service` | `BookingInitiated` | `metadata.placement` = `sidebar` \| `sticky_bar` |
| `provider_service` | `NavigationAction/cta_click` | `metadata.target = call`, same placement split |
| `provider_service` | `MessagingAction/conversation_open` | fires **before** navigating away |
| `provider_service` | `ResultClick/provider_profile` | `metadata.placement` = `business_name` \| `provider_card` |
| `provider_service` | `ResultClick/sibling_service` | with position + ids |
| `provider_service` | `ResultClick/{category_city_browse,category_browse,city_browse}` | each related link labelled by where it goes, not one generic type |
| `category_landing` / `category_hub` | `SearchAction/sort_change`, `FilterApplied` | landing sort + offers + subcategory |
| `search_results` / `provider_search` | `SearchAction/load_more` | `metadata.trigger` = `scroll` \| `click`/`tap`, plus the page |
| `city_page` | `SearchAction/search_submit` | |
| landing card (all surfaces) | `MessagingAction/conversation_open`, `cta_click` (call) | with position |

**Book and Call each render twice** on the service page — desktop sidebar and mobile sticky bar — so
without `metadata.placement` a mobile-first audience is invisible in the funnel. Pinned by
`components/customer/providerService/providerService.analytics.test.jsx`.

### Page attribution under progressive loading
`hooks/useSearchInteractionTracking.js` derives the reported `page` from the absolute `position`
(`floor((position - 1) / pageSize) + 1`) rather than the hook-level `page`. Load-more puts several
pages into one list, so the anchor page would attribute every click in a session to page 1 and quietly
corrupt search analytics. Identical to the old behaviour when only one page is loaded.

### What was deliberately NOT instrumented
The service page's photo strip and the landing page's written-answer cards **have no click handlers** —
they are not interactive. Attaching an event to a non-interactive element would fabricate engagement.
The cities-index search box fires **once per visit on focus**, not per keystroke: the filter is
client-side and one event per character would flood the pipeline for a single intent.

The RN app mirrors every one of these with the same `surface` values, so customer web and customer
mobile aggregate together.

## ‼️ 2026-07-30 (session 24) — SURFACE COVERAGE IS A TESTABLE INVARIANT

**A route with no surface still emits a PageView — with `surface: undefined`.** Fifteen customer-mobile
routes were in that state (all four discovery screens, both invoice screens, payment history).
`clinqetmobileuserapp/__tests__/analyticsParity.test.ts` now enumerates the navigators and fails on any
registered route that `inferSurfaceFromRoute` cannot answer; deliberately suppressed OTP screens are
asserted as suppressed rather than silently missing. **Add the same guard anywhere a route→surface map
exists.**

‼️ **Web bug fixed:** `/my-invoices` was absent from `STATIC_TOP_SEGMENTS` in
`clinqetwebuserapp/services/analyticsTracker.js`, so `inferSurfaceFromPath` fell through to the
"single unknown segment ⇒ provider deep link" rule and labelled **every invoice-list PageView
`provider_profile`** (the detail page reported `my-invoices`). Now `invoices` / `invoice_detail`, with the
segment registered. **Any new top-level customer route must be added to `STATIC_TOP_SEGMENTS` in the same
change** or it is silently mislabelled as a provider page.

**Cross-platform diff method (repeatable):** parse every `track*(…)` call in both apps with a
balanced-paren scan, pull `action:` and `surface:`, and diff by `(helper, action)`. One pass surfaced
every mobile gap: `policy_view` on the 8 legal screens · `location_nudge_cta` · `mark_read` (explicit
control only; a row tap is `notification_click`) · `contact_provider` on a quote's Message link ·
`payments_view` + `has_payments` · the service page's **`placement`** dimension (web tags Book/Call/Profile
because each exists twice on web) · `register_policy_stale` · `trackCart add` on `cart_add_item_sidebar`.

**Mobile surfaces now match web's names exactly:** `category_landing` · `city_landing` · `cities_index` ·
`invoices` · `invoice_detail` · `settings.payments`.

⏳ **Open owner decision:** web's service page calls `trackBookingInitiated` **client-side** while
BookingInitiated is documented as SERVER-emitted — a possible double count. Mobile deliberately reports
`cta_click {target:'book'}` there instead.

## ‼️ 2026-07-31 (provider sync, session E) — PROVIDER-MOBILE ↔ PROVIDER-WEB PARITY, RE-MEASURED

Web is the source of truth. The cross-platform `(helper, action)` diff was re-run with a
balanced-paren scanner that resolves ternaries, template literals and same-file `const` bindings —
**a naive scan under-reports badly**, because both apps build verbs like `` `${verb}_init` `` and
`STATUS_TO_ACTION[x]` and those never match as literals.

**Result: web 598 call sites / mobile 553 → 597. Web-only pairs still unexplained: ZERO.** The 53
remaining are all accounted for — 33 billing (out of scope), 7 the public guest booking page, 4
regex false positives (`trackFail`/`trackStoreClick`/`trackStripCta`/`trackWidgetCta` are LOCAL
functions, not tracker helpers — never "add" them), 1 the mobile-app promo card, 8 a verify flow
mobile does not have as a feature, 2 the onboarding wizard's `step_next`/`step_back`.

### ‼️ SURFACE COVERAGE WAS THE BIGGEST LOSS — 34 routes reported `surface: undefined`
A route absent from `inferSurfaceFromPath`'s `screenMap` **still emits a PageView**, with no surface,
so every record from it is unattributable. Fixed, along with **11 dead map keys** and **2 screens
reporting two different surfaces** (the map said `booking_create` while the screen passed
`booking.create`; `RefundRequests` used an invented `refund_requests` where web's path inference
yields `dashboard.refund-requests`).

‼️ **`clinqetmobilepartnerapp/__tests__/analyticsSurfaceRegistration.test.ts` now closes the map in
BOTH directions over EVERY registered route** (no route without a surface, no key that is not a
route) rather than per-session lists — and its extractor resolves `name={navigations.X}`, which the
old string-literal scan missed entirely (two real routes had escaped the guard).

### ‼️ THE DRIFT GUARD IS NOW A TEST
`clinqetmobilepartnerapp/__tests__/analyticsWebParity.test.ts` re-runs the whole diff inside jest and
fails the build on any new web-only pair outside a recorded exclusion list. It also fails on a
**stale** exclusion (one web stopped emitting) and a **contradictory** one (one mobile already
satisfies), so the list cannot rot into a blanket suppression. **Add the same spec anywhere two
platforms are supposed to share a vocabulary.**

### Verbs realigned — mobile had invented a second name for actions web already names
One concept, one verb. Old strings keep arriving from un-updated app builds; group both when
analysing.

| Was (mobile-only) | Now (web's name) |
|---|---|
| `approve` / `approve_init` / `approve_fail` | `accept` / `accept_init` / `accept_fail` |
| `voice_record_start`, `voice_transcribe_open/apply/fail`, `voice_enhance_open/apply/fail` | `speech_start` / `speech_stop` / `speech_apply` / `speech_fail` (the two audio paths stay separable via the existing `enhancement_type`; `duration_bucket` now uses web's `0_5s`/`5_15s`/`15_plus`) |
| `trackEngagement rdp_toggle` | `trackConsent data_processing_restrict` `{enabled}` |
| `whatsapp_enable` / `whatsapp_disable` | `notif_pref_change` `{channel, enabled, type}` (+ a `notif_pref_change_fail` leg that did not exist) |
| `portfolio_delete` | `delete` + `{scope: global\|project}` — the documented PortfolioAction shape |
| `save_success {mode: set_default}` | `set_default` |
| `onboarding_complete` | deleted — `wizard_complete` already marks the end, and it fired alongside `step_complete` on the same save (a double count) |

Dashboard widget surfaces were bare `dashboard_home` at all 11 mobile sites; web's contract is
`dashboard_home.<widget>` and mobile now matches (`new_requests`, `services_list`, `share_profile`,
`rank_higher`, `promo_carousel`).

### Newly instrumented on provider mobile (web-mirrored strings)
`trackNav` **confirm_open/confirm_yes/confirm_no** `{variant}` on the shared `common/ConfirmDialog`
(surface prop, default `confirmation_modal`) · **menu_click** `{item}` on all 35 ProfileScreen rows
(surface `profile`) · **back_click** `{target}` on booking/quote/lead detail · **share_method**
`{channel}` ×8 channels · `trackProfileEdit` **friendly_name_submit/set/fail** `{is_initial}` and
**address_save** · `trackSettings` **passkey_reminder_view/accept/dismiss** `{trigger}` ·
`trackCustomerCrm` **search** `{has_query}` / **edit_open** `{has_email, has_phone}` / **delete_init**
· `trackBookingAction` **edit_open**, **contact_customer** `{channel}` · `trackOnboarding`
**ai_nudge_view/accept/dismiss** · `trackCalendar` **copy_day** `{to_days_count}`,
**mark_unavailable**/**clear_unavailable** · `trackPortfolio` **tab_switch** `{scope}` ·
`trackLicense` **view** · `trackAuth` **logout**, **passkey_login_success** `{identifier_type}` ·
`trackMessaging` **block**/**unblock** `{context}` · `trackResultClick` **quote_card**,
**service_card** · `trackVoiceCall` **join_attempt**/**join_call** on the PHONE-join leg (the
in-app leg was already instrumented; the phone leg emitted nothing) · `trackError`
**unhandled_error** (ErrorBoundary) and **api_error** (external-login screen) · `trackEngagement`
**scroll_depth** on `booking_list` / `invoice_list` / `quote_list` / `lead_list` via a new
`useScrollDepth` in `src/hooks/useDwell.ts` (RN port — the caller feeds `onScroll`, since RN has no
window scroll).

### ‼️ Client-tracker drift closed
The provider RN tracker was the ONLY one of the four without the **20-pair / 256-char metadata cap**
mirroring `AnalyticsSettings`. Added at enqueue. **All four trackers now cap; keep them identical.**

### ‼️ FALSE-SUCCESS TRAPS CONFIRMED AGAIN
- **`Share.share` RESOLVES with `dismissedAction` when the user cancels.** Mobile emits
  `share_method` only when `result.action === Share.sharedAction`. **Web emits BEFORE awaiting
  `navigator.share`, so web's share numbers are inflated by every cancel** — known divergence.
- **An effect whose gate depends on async-loaded state fires first with the default.** The AI
  Quick Setup nudge starts `visible = true` and reads its dismissal from AsyncStorage, so an
  unguarded view effect reports a view of a nudge the provider had **already dismissed**. Gate on a
  `loaded` flag, not just on `visible`.

### Known web-side defects found while diffing (owner's call, not fixed here)
- **`trackResultClick` silently drops `quoteId`.** `components/quotes/Quotes.jsx` passes it; neither
  tracker's helper accepts the field. The quote id has never reached the pipeline.
- Web's `share_method` at-intent emission, above.

---

## ‼️ MULTI-USER TENANCY — PHASE 7 / L118 (owner-approved 2026-08-03). Three new Parquet columns.

### What was added

`BusinessId` · `MembershipId` · `BranchId` — all `DataField<string?>`, **appended** to the schema in
`clinqetinfrastructure\Services\Analytics\ParquetStorageService.cs` so no existing column moves (L17 is
additive-only), and declared on `clinqetshared\Models\Analytics\UserInteractionEventData.cs`.

Without them a provider-side event could be attributed to a person but not to the **business** they acted
for, so no per-business or per-branch analytics were possible once one person can belong to several
businesses.

### ‼️ SERVER-DERIVED ONLY — never from the client payload

All three come from the **validated `TenantContext`**, never from the request body. A client-asserted
`BusinessId` in an analytics row is an attribution-injection vector (§12.1: the active `BusinessId` comes
only from the token). `TrackEventRequestDto` — the client DTO — deliberately carries **none** of them,
and that absence is the guard. Do not add them to it.

```csharp
// AnalyticsController — tenancy attribution comes from the VALIDATED TenantContext, never the body.
var analyticsBusinessId   = keepIdentified ? Tenant?.BusinessId : null;
var analyticsMembershipId = keepIdentified ? Tenant?.MembershipId : null;
var analyticsBranchId     = keepIdentified ? Tenant?.BranchIds.FirstOrDefault() : null;
```

They ride the **same de-identification switch** as the user number: a `MembershipId` is a stable
per-person identifier, so a declined consent must drop it too.

### ‼️ ABSENT means `null`, never `""`

For customer and system events all three are **absent**. `""` and `null` are different values to a
Parquet reader, and writing `""` would change the column's null semantics for every existing reader.
`ParquetStorageService` funnels all three through:

```csharp
private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;
```

### Conversion events

`BookingController` and `QuoteController` pass
`Tenant?.BusinessId, Tenant?.MembershipId, Tenant?.BranchIds.FirstOrDefault()` at their conversion-event
call sites, so a booking or quote conversion is attributable to the acting business.

Covered by `ParquetStorageServiceTests` (3 L118 tests), `AnalyticsControllerTests`, and
`UserInteractionAnalyticsServiceTests`. The 81-field analytics contract is otherwise **unchanged** —
never break or reorder it.

---

## ‼️ PHASE 8 PART D (2026-08-04) — the activity feed's analytics footprint is a SCREEN REGISTRATION and nothing more.

**No new `AnalyticsEventType`, no new field, no Parquet schema change, no sampling or rate-limit change.**

What Part D added is one `screenMap` entry in `clinqetmobilepartnerapp/src/services/analyticsTracker.ts`:

```
Activity: 'business_activity'
```

‼️ **A registered route missing from that map reports `surface: undefined` on every PageView** — Session E's
finding, still live. The surface name deliberately matches provider web's `/dashboard/activity` route so a
cross-platform funnel is ONE name, not two (the six mobile-only verb sets Session E had to merge).

‼️ **The business activity feed is NOT an analytics surface.** It reads `GET /business/activity` out of the
Cosmos `ProviderData` partition — a provider-facing operational record with a 90-day TTL
(`Tenancy:Activity:RetentionDays`). It has nothing to do with the `user-interactions` Parquet pipeline, and
adding it to that pipeline would be a category error: the feed carries **visibility**, analytics carries
**measurement**.

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). Analytics is FINAL. Nothing was added.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.**

**Phase 9 added NO Parquet column, NO event type, NO field and NO schema change.** The
`user-interaction` stream is final at **45 columns** for this programme. This section exists so a later
audit phase can confirm that in one place rather than re-deriving it.

### The three tenancy columns, and the rule that made them safe (L118, ✅ owner-approved)

`BusinessId` · `MembershipId` · `BranchId`, **appended after `AppType`** so **no existing column moves** —
L17's additive-only rule and the fixed Hive partition layout
`appType=/type=/year=/month=/day=` are both untouched.

‼️ **All three are SERVER-DERIVED from the validated `TenantContext` ONLY.** `TrackEventRequestDto`
carries none of them, which structurally closes the attribution-injection path — a client cannot claim to
be acting for a business it does not hold.

‼️ **They are ABSENT (null), never `""`, for customer and system events.** Sabotage-verified: making
`NullIfBlank` return its value unchanged failed the `""` and `"   "` cases while **correctly** still
passing `null` — a directional guard, not a decorative one.

‼️ **The "81-field Parquet schema" everyone cites DOES NOT EXIST.** Measured:
`SearchAnalyticsSchema` = **91** · `UserInteractionSchema` = **42 before L118, 45 after** · plus six
others. The figure is repeated in `CLAUDE.md`, `01-MASTER-PLAN.md` §3.3 and `02-CODE-REALITY.md` §11 and
is wrong in all of them. **The rule it stands for — additive only, never a rename or reorder — is
correct and absolute; only the number is fiction.**

**No existing analytics test required modification** — the three L118 tests are additions. The suggestion
(43) and search (91) schemas are untouched and their assertions were not edited.

### ‼️ The business activity feed is NOT an analytics surface

It reads `GET /business/activity` out of the Cosmos `ProviderData` partition — a **provider-facing
operational record** with a 90-day TTL (`Tenancy:Activity:RetentionDays`). It has nothing to do with the
`user-interactions` Parquet pipeline, and adding it there would be a **category error**:
**the feed carries VISIBILITY; analytics carries MEASUREMENT.**

The feed's only analytics footprint is a **screen registration** — `Activity → business_activity` in
provider mobile's `analyticsTracker` `screenMap`, matching provider web's `/dashboard/activity` surface
name so a cross-platform funnel is **ONE name, not two**.

‼️ **A registered route missing from that map reports `surface: undefined` on every PageView** — Session
E's finding, still live, and it recurred on every tenancy screen added since. **A new provider-mobile
screen is a FIVE-file registration**: `constant.tsx` · `types.ts` · `linking.ts` · the owning `*-Route.tsx`
· **and `screenMap`.**

### What is deliberately NOT instrumented, named rather than silently dropped

`00-SOLUTION` §17 lists observability targets. These tenancy-adjacent ones ship **uninstrumented, by
decision**:

| Signal | Why not, and who owns it |
|---|---|
| Unassigned conversation count · time-to-claim · **412 collision rate** | **Inbox PRODUCT metrics, not tenancy-security signals.** Named for **Phase 12** to decide |
| Businesses at/near `team.seats` · invites blocked by limit | A **billing/growth** metric. Same standing |
| RU per business · hot partitions · Service Bus dead-letter count and oldest-message age | **Azure PLATFORM metrics.** No application code can produce them better, and per-business tagging would be **unbounded cardinality** |
| Cross-partition query count | **Structurally 0** — there is no query to count |

What **was** instrumented is authorization only, in
`Clinqet.Infrastructure.Observability.TenancyMetrics` — ‼️ **the platform's FIRST
`System.Diagnostics.Metrics.Meter`**, meter name `Clinket.Tenancy`. See `clinqet-main-api`.

‼️ **HARD RULE for anyone extending it: no metric tag may carry a `businessId`, `membershipId` or
`userId`.** Those are unbounded, and unbounded metric cardinality is a **cost incident**. The permission
key is a fixed catalogue of 89, so it is safe. **This is the same discipline the Parquet PII scrub
already enforces, applied to a different pipeline.**

## SEARCH-TOPOLOGY PHASE 3 — analytics v2, append-only (2026-09-22/24)

- `SearchRequestAnalytics` + the search Parquet schema gained, at the END (append-only, pinned by
  `ParquetStorageServiceTests`): **`ResolvedRoutingCountry`** — the country that ANSWERED (the searched place's,
  not the visitor header in `Country`; empty when nothing said where and every country answered, or when the
  place is outside our countries) — and **`PublicFanOut`** (true when every country of the stamp answered, D-7).
- The broadcast funnel gained **`DroppedByEligibilityRecheck`** and **`EligibilityUnverified`** (D6), also appended.
- An outside-our-countries search on `/services` and `/providers` is STILL recorded (honest empty, true invocation
  mode, zero results) — demand from a country we do not serve is exactly what BI needs. `/suggest` records nothing
  for it, the same as for too-short text.

## Post-ranking follow-ups (audit 2026-10-01) — fresh Parquet fields per write (W12 / E-1)

- ‼️ Parquet.Net mutates a `DataField` when a `ParquetSchema` takes it, so a field list shared by writers running side by
  side races (probe: 2,000 parallel writes from one shared list ⇒ 49 corrupted row groups, 16 failed writes). The
  analytics processor writes batches in parallel, so this was live for every stream. `ParquetStorageService`
  (`.cs`, `.Batch.cs`, `.Detail.cs`) now builds each write's fields per call with its `private static List<DataField>
  Build*Schema()` methods. Columns, names and order are UNCHANGED — no schema version bump; append-only still rules.
- Guard (Functions unit, `ParquetStorageServiceTests`): `NoParquetFieldOrSchemaIsHeldInAStaticField` — reflection over
  the infrastructure + Functions assemblies; fails on any static field holding a `Field`, a `ParquetSchema`, or an
  array/generic of them; asserts > 1000 types scanned and ≥ 12 `List<DataField>` builders found. Regression:
  `ParallelWrites_EachReadBackExactlyWhatTheyWrote`. ‼️ Never cache a field list in a static, even "read-only".
- The Insights day summaries (`InsightsParquet`, `insights-daily/` in the analytics container) are a CONSUMER of these
  streams with the same rule — see `clinqet-smart-analytics` W12. No producer, event or column changed.
