# Admin dropdown consistency

Status: implemented after owner reviewed the preview and instructed “continue where you left off and lets do it all” on 2026-09-25. Implementation and local verification complete; not deployed.

## Mockup register

| Sheet | Path | Approval | Governs | Supersedes |
|---|---|---|---|---|
| Admin dropdowns | C:/Nik/Data/mockups/admin-dropdowns/index.html | Owner continuation after preview, 2026-09-25: “continue where you left off and lets do it all” | Shared admin choice controls, compact/form variants, desktop/mobile states and matching action-menu styling | Mixed native OS dropdown panels and per-page styles |

## Verified inventory

55 native select instances across 18 JSX files: BillingConfigPage, CategoriesPage, CountryPage, ProviderPaymentsPage, RazorpayTaxonomyPage, AlertsPage, AiCategoryCorrectionsTab, ContentReportsPage, ReviewsManagementPage, ProviderLedgerPage, BookingDisputesPage, LoginAttemptsPage, VoiceConfigPage, VoiceAssistantRequestsPage, ProviderTrustPage, onboarding StepBusinessDetails, StepServiceArea and StepServices. AdminLayout also has two profile action menus, which should keep action-menu semantics.

The pictured billing region control is a native select inside a styled pill. Its expanded list is OS-rendered. Shared CSS on that select cannot reliably brand the expanded menu across browsers.

Partner references: floatingOptionSelect.jsx (compact/form variants, search, selected rows) and floatingSingleSelect.jsx. Use their visual language, not a blind code copy: admin has different form contracts and React version, and the partner implementation contains positioning/keyboard decisions that require independent verification. Admin already depends on react-select; assess that supported primitive before introducing another dependency or hand-writing a combobox.

## Approved-scope implementation after mockup approval

- One shared admin selection component/theme with compact and field variants; navy #032858, lime #97EF29, neutral borders, rounded panels, clear selection indicator and visible keyboard focus.
- Preserve every existing option value/type, empty sentinel, disabled option, change handler, form name/id, label association, validation and permission rule. Read complete owning files and tests before migration. Never silently choose an option when choices arrive or a value disappears.
- Searchable choices, keyboard interaction, Escape/outside dismissal, touch targets, bounded scrolling and viewport-aware placement. Menus must work inside current scrolling dialogs and avoid clipping.
- Distinguish loading, no available choices, no search matches and loading failures. Render permission/limit states only where the caller actually supplies those facts; do not invent business rules.
- Inventory non-select action menus separately; share brand styling while preserving navigation/action semantics. No provider/customer code changes.
- Unit tests for the shared control and behavior; real-page/browser integration across billing region switching, filters, onboarding, dialog nesting, long lists/labels, keyboard and small viewports. Preserve existing tests and add a nonempty source guard for unmanaged select instances if appropriate.
- Build, strict lint, affected/full admin tests and visual inspection. Preserve other sessions' working changes; no reset, blanket staging or deployment. Update skill copies and memory when implemented; remove only this session's scratch.

## Gate

AGENTS.md §0.7.1: “Any new page, screen or interface needs an isolated HTML mockup … approved by the owner BEFORE any integrated UI code is written.” This shared replacement dropdown is a new interface; prior approval of the search-health mockup does not cover it.

## Completion and verification (2026-09-25)

All 55 choice controls across 18 files use AdminSelect, backed by the existing react-select dependency. Both profile action menus share the theme and support Escape/focus restoration. Search is typed directly into the combobox trigger rather than a separate search row inside the illustrative mockup menu; this retains the library's accessible keyboard interaction.

An AST comparison confirmed original option children, values, change handlers, names, IDs, disabled and required rules for all 55 controls. Selection never silently falls back when the saved value disappears. Menus are portalled and bounded using available viewport space, including inside dialogs.

Validation passed: production build; strict full-source ESLint; 405 tests across 37 suites; 19 Playwright checks across dropdown, dialog viewport and search-health suites. Browser coverage includes 320px/390px widths, 844x390 landscape, long labels/lists, scrolling, search/no-match, Escape/outside dismissal, billing region requests and nested dialogs. Desktop/mobile screenshots were visually reviewed. Browser checks used local fixtures and blocked mutations; deployed behavior has not been validated.

Shared admin/UI skills updated in all four tool locations and project memory recorded. Concurrent changes were preserved. No commit, push or deployment performed. Temporary build, browser results and screenshots are removed at closeout; mockup, plan and regression tests remain as deliverables.
