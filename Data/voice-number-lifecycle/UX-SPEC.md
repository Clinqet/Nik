# Experience contract — web, iPad and native

> **1 October 2026 — superseded in part.** The owner's final decisions are in `DECISIONS-2026-10-01.md` and the design to build is `FINAL-DESIGN.md` (its section 14 lists what changed). Read those first; **where this file differs, they win.** This file stays for the detail they do not repeat.

**MANDATORY CARRIER RESEARCH — COST IS SUPER IMPORTANT. The implementation session MUST research official Telnyx (Canada/US) and Plivo (India) billing online AGAIN: first and subsequent charges, proration/refunds, renewal calendar, month-end/leap dates, billing cutoff/timezone and available renewal APIs. Resolve conflicting information against the exact product/account and primary documentation, using authorized read-only evidence and written carrier confirmation when needed; ask the owner rather than guess. Read CARRIER-RESEARCH.md and RENEWAL-AUTOMATION.md fully. Save verified evidence and conservative UTC deadlines in the proposed partition-scoped Cosmos design after itemized schema approval; return eligible unused numbers with a default 24-hour lead. No unverified financial automation or promised refund.**

**Owner approved solution and mockup, 30 September 2026.** Read [final approved handoff](APPROVED-HANDOFF.md) first: any trial duration, historical regular billing even at zero dollars, national 10-digit entry, and existing admin queue integration. Itemized schema approval remains separate.

**Current revision:** [Renewal automation and owner-requested controls](RENEWAL-AUTOMATION.md) governs automatic returns, Keep, regional caps, country lock, configurable choices and protected approval history. Earlier manual-return/fixed-five review notes below are superseded where they conflict.

30 September 2026 · owner-approved design/mockup · supplements the [interactive mockup](../mockups/voice-number-lifecycle/index.html).

## Visual direction

**Recommendation:** a calm, modern extension of the existing AI Assistant page. Navy `#032858`, action green `#97EF29`, pale brand background `#F4FFE4`, Lufga Regular/Semibold from the current partner app, and the existing blue/amber/danger status palette. Green is a deliberate primary action/selected state, not decoration on every card. Keep flat surfaces, clear status and generous spacing; avoid new gradients, neon, unrelated fonts or decorative “AI” controls.

The mockup bundles copies of the existing two Lufga webfonts, so it works without a third-party font service. Fonts are final mockup assets, not scratch. The native design maps to the app's existing Lufga theme, Sheet, Notice, Button and haptics patterns. The browser illustration of a phone is not a claim that React Native has been implemented.

## Simple language

Provider copy says “your number”, “our team”, “held until”, “choose a number”, “request a change”, “we’re checking”, and “no purchase was made” only when confirmed. It does not expose partitions, operation IDs, carrier budgets, API failures or rental optimization. Carrier costs belong in the admin view. Admins see currencies, price evidence and reasons because those affect spending decisions.

Never call a carrier return a refund. Never call an assigned own-number assistant “ready” before the forwarding test passes. Never show a countdown that contradicts the server deadline; display a date, time and timezone as the durable reference. A holding banner must explain actual call behavior for that number mode.

## Responsive behavior

| Surface | Layout and controls |
|---|---|
| Wide desktop | Existing app shell. Main content stays bounded; related phone fields share a row when they fit. Five candidates remain a simple vertical list; full row is selectable. Admin inventory uses a table. Web dialogs have a readable maximum width |
| iPad portrait, around 768 px | Same information and actions; no hover-only controls. Field groups stack before labels collide. Admin rows turn into cards when columns no longer fit. Dialog fits the viewport, scrolls internally if required, and respects the on-screen keyboard |
| Phone browser, 360–430 px | Single column, full-width primary action, preserved number/date text, wrapping badges. Review-only navigation wraps. Web dialogs become bottom-aligned sheets. Page never requires horizontal scrolling |
| Native provider | Single-column operational form, bottom sheet for requests/number actions, telephone keyboard, safe-area action placement, contextual long press with visible menu alternative, haptic selection/confirmation through existing helper |
| Native admin | Search and actionable requests; inventory cards. Long press opens details/copy/review actions. Selecting multiple eligible items is an explicit selection mode; never swipe to return a number or apply a security change |

The mockup includes web-canvas width controls and simultaneous native frames. Real browser viewports must still be inspected at 360, 390, 768, 1024 and desktop, since a narrowed child element does not test browser media queries. Production text scales to the OS setting; truncation cannot hide number, cost, deadline or the primary action. Long translations and supported dark-mode tokens require their own implementation QA.

## Native interactions that earn their place

- **Long press on a number:** opens contextual actions. Candidate: select/copy/request help; assigned provider number: copy/share; admin number: copy/view details/review eligibility. A visible “Number actions” button exposes the same actions for accessibility and discoverability. Sharing uses the native share sheet only after assignment; the mockup simulates it and sends nothing.
- **Haptics:** existing selection tick for selecting a number; light tick opening actions; success only after server-confirmed completion; warning/error on a failed action. Respect OS vibration/reduced-motion settings. Haptics supplement text, never replace it.
- **One sheet at a time:** existing admin VoiceActionSheet explicitly avoids stacking React Native Modals. Switch content inside the sheet. Request confirmation is the submission form itself; carrier return has a deliberate review/confirm step because it loses a rented asset.
- **Keyboard and paste:** telephone keypad, country-aware number parsing, paste normalization, a persistent visible country, no “E.164” jargon. Keep the error at the field and focus it. Changing input clears only that field's error. A business’s permitted service country comes from the server; profile area code is a preference, not country authority.
- **Pull to refresh / foreground:** coalesce into one refresh, retain last known data with a timestamp, revalidate before spending or applying. Returning from email/push opens the matching business context; workspace mismatch prompts a switch and re-authorizes instead of leaking details.
- **App lifecycle:** stop view polling/background animation on background or unmount; retain request ID and server progress. Reopening resumes the same request. If a modal closes while work continues, the page shows its pending state. Back/swipe-dismiss never cancels a submitted carrier purchase.
- **Gestures are optional:** cancel long-press activation when scrolling/moving; provide screen-reader actions and keyboard buttons. No long-press-to-buy, swipe-to-delete or silent automatic clipboard copy. Destructive actions require an explicit button and reviewed details.

The prototype demonstrates the context sheet via long press/right-click and an explicit menu button. Browser clipboard/share/haptics are intentionally represented by preview feedback, not real native calls. Pull-to-refresh, native keyboard avoidance and OS share/dynamic-type behavior are implementation contracts, not features falsely claimed as implemented in HTML.

## Accessibility and interaction detail

Use one focus owner per dialog, trap keyboard focus, support Escape/Back, return focus to the opening control, and give every icon a label. Keep a visible close button with an adequate touch target. Initial focus goes to the dialog heading or first field as appropriate; return to the page heading if the opener disappeared after a successful transition. Radio candidates expose checked state and keyboard navigation. Status uses words plus color. Announce asynchronous success/error once, and suppress duplicate announcements from the same event.

Aim for at least 44×44 native targets and comfortable 44 px phone-web controls; do not shrink critical text to fit a row. Respect reduced motion, and never animate a money or deadline value to imply live backend confirmation. The two frames in the design mockup deliberately repeat content for review; production exposes only the active surface.

## Cost-aware flexibility without confusing providers

Owner-confirmed allocation switch: lower environments default off; production defaults on. Off shows the existing submit-for-admin-allocation journey instead of number choices. Use “Our team will arrange your number” and retain status/notifications. Do not show an environment name, feature flag or technical toggle to providers. Web and native follow the same effective backend capability. Trial/removal/recovery and forwarding-change screens remain available in both modes. A stale open choice screen switches to the admin-review outcome if automatic allocation is disabled before submission.

Use policy settings for currency/caps, trial duration, hold, quarantine, deadlines and request limits. Expose a small number of honest provider choices. No unlimited “refresh numbers” shopping loop that generates carrier calls. If a requested locality is unavailable, explain the alternative area and offer a manual request. A quote that is stale or above allowance routes to review without revealing internal margin.

For a short remaining trial, show the real end date rather than a new full-duration badge. If fewer eligible numbers than the configured limit exist, show the real count. If exactly one exists, it may be selected by default but the provider still confirms. No results trigger manual review; never silently buy a premium number. A custom request does not reserve a number or guarantee a port.

Number selection survives UI refresh only while the server choice is still valid. A taken/expired candidate is removed, the list refreshes once and the provider confirms an alternative. A carrier timeout shows checking status; it does not invite repeated purchasing. Admin details show whether a number is only in Clinket's pool, actually owned at the carrier, or awaiting reconciliation.

## Revised quarantine policy

See RENEWAL-AUTOMATION.md, “Owner-requested quarantine revision”: independent trial-only (default 0 days after the 24h hold) and paid-service (default 15 days after detachment) appsettings. Quarantine never blocks safe pre-renewal carrier return. Include classification, saved policy/deadline, converted trials, unknown history, late payment, Keep and overdue-return cases. Schema proposals remain unapproved.
