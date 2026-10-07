# Approved components and reuse guide

**THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED, INCLUDING ITS SCREENS, COMPONENT DESIGNS, STATES, INTERACTIONS, NAVIGATION, SPACING, TYPOGRAPHY AND BRAND TREATMENT. NO FURTHER MOCKUP OR DESIGN APPROVAL IS REQUIRED. REUSE THE APPROVED COMPONENTS AND PATTERNS WHERE THEY FIT. IMPLEMENTERS MAY IMPROVE THEM WITHOUT ASKING AGAIN WHEN THAT PRODUCES A CLEARER, MORE RESPONSIVE, EASIER-TO-FOLLOW EXPERIENCE. READ THE MANDATORY [IMPLEMENTATION CHARTER](../IMPLEMENTATION-CHARTER.md).**

**DROPDOWNS, TEXT BOXES, TEXT AREAS, CHECKBOXES, RADIO CHOICES, BUTTONS, TABS, DIALOGS AND SHEETS MUST FOLLOW THE APPROVED MOCKUP'S THEME, DESIGN, COLORS, FONT AND INTERACTION QUALITY. START FROM THE OWNING APP'S EXISTING SHARED COMPONENTS; REUSE OR IMPROVE THEM TO ACHIEVE THE APPROVED RESULT. DO NOT CREATE AN UNRELATED CONTROL STYLE OR DUPLICATE AN EXISTING COMPONENT JUST FOR OUTBOUND CALLS.**

## What is provided for reuse

The mockup includes working browser component source, shared styles, layout patterns, brand assets and example state handling. These can be reused in isolated prototypes and serve as concrete implementation references. The production React/Next.js and React Native apps already have shared controls: use those as the integrated foundation. The prototype's DOM event wiring and synthetic data are not production React components or API integrations.

| Reusable source in this folder | Provides | Production use |
|---|---|---|
| [controls.js](controls.js), [controls.css](controls.css) | Branded searchable dropdown, selected/disabled/error states, keyboard selection, Escape/focus behavior, viewport positioning; native-pattern picker sheet; floating input/textarea treatment; checkboxes/radios | Reuse the approved interaction and visual contract through the app's shared controls. Keep native components native. Do not mount the prototype's global MutationObservers beside React forms. |
| [ui.js](ui.js) | Shared field, select, textarea, checkbox, toggle, button, tab, notice, card, metric, row and definition renderers; role-aware examples | Reuse component structure, states, hierarchy and content requirements; bind actual application state, localization and real operations. |
| [styles.css](styles.css) | Brand variables, Lufga typography, responsive grids, cards, toolbars, navigation, dialogs, native-pattern layouts and safe areas | Map to existing app theme/Tailwind/native tokens rather than importing an entire prototype stylesheet into production. Preserve responsive intent, contrast and touch targets. |
| [navigation.js](navigation.js) | Business and AI Assistant rail placement, feature tabs, native entry/return patterns | Extend the actual navigation and rendering rules with the same information hierarchy, correct record IDs and back context. |
| [builder-tools.js](builder-tools.js) | Conversation sections, inline information choices, voice catalogue/sample UI, saved-brief review, draft protection, handout preview/copy/protected deletion | Reuse the interaction model. Use real versioned drafts, approved files, permissions and existing audio resources. Never copy simulated drafting or sends as working AI/backend behavior. |
| [audience-ui.js](audience-ui.js) | Summary-first calling hours, per-person source detail, search/filter/paging, selection preservation and relevant country explanations | Use authoritative bounded server queries/aggregates; retain stable IDs and return state. Do not fetch 5,000 records just to paginate them in the browser. |
| [quick-calls.js](quick-calls.js), [quick-calls.css](quick-calls.css) | One shared one-or-small-group form, bounded picker, explicit schedule/local-time review, partial/uncertain receipt, independent request list/history/cancel, booking lock and dirty close | Follow QUICK-CALLS.md / C25. Reuse shared web/native components and real request IDs/APIs; do not copy demo contacts, the preview clock, local date/eligibility arithmetic or simulated saves as backend rules. No hidden campaign or separate engine. |
| [record-ui.js](record-ui.js) | Number-specific permission records, source-protected block history/removal, pending link requests, signed evidence and visible admin decisions | Reuse forms and authoritative-result behavior; replace session-local records with real authorized, concurrency-safe contracts. |
| [campaign.js](campaign.js), [call-results.js](call-results.js) | Results hierarchy, history tabs, bounded campaign people, summary/answer/transcript/next-step patterns | Bind the selected record and actual history/media. Distinguish confirmed, unknown, refused, pending and unavailable values. |
| [assets](assets) | Existing Clinket marks, local Lufga files, Lucide source/license and existing voice samples | Prefer the owning app's existing assets/resources. Preserve licenses and brand proportions; avoid duplicate downloads, fonts or recordings. |

## Existing application components to start from

Paths below were verified during this review. Read the current component and its tests before integration; other sessions may have changed them. This is a reuse map, not permission to assume their APIs or bypass their behavior.

| Surface/control | Existing source |
|---|---|
| Provider web searchable dropdown | `C:\Nik\clinqetwebpartnerapp\src\components\common\floatingOptionSelect.jsx` |
| Provider web text field and floating label | `C:\Nik\clinqetwebpartnerapp\src\components\common\floatingInput.jsx`, `floatingLabel.jsx` in the same folder |
| Provider web checkbox | `C:\Nik\clinqetwebpartnerapp\src\components\common\customCheckbox.jsx` |
| Provider native picker | `C:\Nik\clinqetmobilepartnerapp\src\components\FloatingOptionSelect.tsx` |
| Provider native input and checkbox | `C:\Nik\clinqetmobilepartnerapp\src\components\FlotingInput.tsx` (existing spelling), `CustomCheckbox.tsx` in the same folder |
| Admin web dropdown | `C:\Nik\clinqetwebadmin\src\components\ui\AdminSelect.jsx` |
| Customer web fields and checkbox | `C:\Nik\clinqetwebuserapp\components\common\floatingInput.jsx`, `floatingSelect.jsx`, `floatingLabel.jsx`, `customCheckbox.jsx` |

Provider web's current searchable picker supports search even for a short nonempty list; native uses a titled searchable sheet. Admin uses a bordered external-label field or compact pill. Customer web currently has floating styling around a native select: the mockup's searchable customer picker is an approved interaction improvement, not a claim that the customer app already has that implementation. Implement or reuse a suitable shared enhancement while keeping the customer theme and accessibility. Inspect the actual customer native booking/permission form controls when integrating that surface; do not assume provider TSX can be copied unchanged across apps.

## Reuse acceptance checklist

**REUSE THE APPROVED DESIGN AND THE REAL APP COMPONENTS, INCLUDING DEFAULT, FOCUS, SELECTED, DISABLED, LOADING, EMPTY, ERROR AND PERMISSION STATES. CHANGING THE COMPONENT IMPLEMENTATION DOES NOT REQUIRE DESIGN REAPPROVAL; IT DOES REQUIRE PROVING THE RESULT STILL WORKS.**

- Preserve navy `#032858`, lime `#97EF29`, Lufga and the app's supported light/dark theme. Use existing tokens rather than scattering new constants.
- Preserve floating labels, useful validation messages, search/no-match states, selected ticks, keyboard operation, accessible labels and focus return. Small inline choices should not gain an unnecessary dialog or extra Save click.
- Use proper native sheets, keyboard avoidance, safe areas and accessible gestures with visible alternatives. Browser-native simulations do not replace device testing.
- Keep one clear root-dialog close action and meaningful Back for nested work; preserve dirty form values and the campaign's step. Lists and results remain bounded.
- Every production control must invoke the real operation, persist where required and render the authoritative response, including failure, retry, conflict, permissions and limits. Reuse mockup patterns, never fake success or synthetic records.
- Put all user-facing strings in every app locale. Mockup review copy and draft translations are not a substitute for complete localization or required legal validation.
- Record which shared components were reused/extended and why in the phase build state, with responsive, keyboard, role and native verification. This record is documentation, not another approval gate.

**CREATIVE FREEDOM REMAINS ACTIVE EVEN AFTER REUSE: IF A COMPONENT OR FLOW CAN BE SIMPLER, CLEARER, MORE RESPONSIVE OR BETTER FOR PROVIDERS/CUSTOMERS, IMPROVE IT WITHOUT WAITING FOR OWNER APPROVAL. AVOID SPECULATIVE ABSTRACTIONS AND UNNECESSARY COMPONENT LIBRARIES. ASK ONLY WHEN A GENUINELY UNRESOLVED DECISION NEEDS THE OWNER, AFTER COMPARING OPTIONS AND RECOMMENDING ONE.**


## Preview and two-way implementation map

Read [COVERAGE-AUDIT.md](COVERAGE-AUDIT.md) for the exact local preview commands, all C01–C25 implementation owners and the mockup-to-plan refinements. The latest reference is version 4.2. Reusable code includes complete structured brief editing/copy/deletion, six-format result rendering, status-aware CSV patterns and effective-window/number-specific record examples. Copy the useful visual/interaction contracts into the owning app’s existing controls; never import the mockup’s fixtures, local persistence or global DOM handlers as production functionality.
