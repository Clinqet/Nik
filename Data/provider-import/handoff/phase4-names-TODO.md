# Phase 4 — names (N1/N2/N4/N5) + friendly-name service (handoff, 2026-10-07)

DONE and tested (each behaviour sabotage-checked):
- `IFriendlyNameService.TrySetAsync` (`clinqetinfrastructure/Services/Auth/FriendlyNameService.cs`) on the shared
  `FriendlyNameRules.cs` + `FriendlyNameMirror.cs` (Cosmos copy + `FriendlyNameProjectionFailure` alert, moved out of
  `UserProfileController` unchanged). AlreadyHeld, candidates in order, `Tried`, clash at save ⇒ next candidate, concurrent
  same request ⇒ the winner's name, never `FriendlyNameUpdated`. `AuthService` PUT UserProfile uses the shared rules.
  Registered in Identity `Program.cs`.
- N1: `HandleExternalLoginAsync` after a take-over fills only placeholder halves from verified claims
  (`ProposedPersonName.FromClaim`).
- N2: `TemplateService.ProcessTemplate` fills `{{Greeting}}` (`PersonName.Greeting`, HTML-encoded); 295 templates (59 × 5
  languages) moved to `{{Greeting}}`; keys `Greeting_Named`, `Greeting_Anonymous`, `MemberDisplayName_AccountOwner` in 5
  languages; AuthService call sites pass First/Last; `MemberDisplayName.Of` real halves → email → label; take-over alert text;
  Razorpay contact uses the business name for a placeholder person.
- N4: `VerifyMfaDto.ProposedFirstName/ProposedLastName` (no validation attributes on purpose); applied only on `TakenOver`.
- N5: the "name differs" take-over alert is Medium; `NameDiffers` compares only real halves.
- Identity integration fixture: `ProviderImportInternal:ApiKey = integration-test-provider-import-internal-key-0001`.
Tests: Identity unit (ProposedPersonNameTests 25, FriendlyNameServiceTests 14, TakeoverNamesTests 13,
ProviderTakeoverAlertTests 8, GreetingRenderTests 17), Identity integration real SQL (FriendlyNameServiceIntegrationTests 3,
TakeoverNamesIntegrationTests 4), Communications EmailGreetingRenderTests 4, API MemberDisplayNameTests 8 + 3 + 3.

NOT done:
1. Run each touched unit suite IN FULL once: `Clinqet.Identity.UnitTests`, `Clinqet.API.UnitTests`,
   `Clinqet.Communications.UnitTests` (a processor test asserting a rendered "Hello X" may now fail because of `{{Greeting}}`).
2. Sabotage the integration clash path: change the `continue` after the clash catch in `FriendlyNameService` to `throw;` and
   confirm `FN6_ACandidateTakenAtSaveTime…` fails.
3. The localized "Account owner" label is wired only in `TeamLifecycleNotifier`. Still empty for a member with no real name
   and no email: `ProviderInboxService` (~L270, ~L630), `MemberLifecycleService` (~L129, ~L804), `BusinessMemberDirectory`
   (~L262), `WorkAssignmentService` (~L125), `BusinessNotificationSettingsService` (~L686), admin tenancy services — needs a
   per-recipient label or the client's own label.
4. `GET friendlyname check` (`UserProfileController` ~L504-558) keeps its own copy of the rules and does not lower-case before
   the format check — move it onto `FriendlyNameRules` (a small behaviour change: say so).
5. Skills ×4 (identity-api, prepared-providers, auth-sessions, notifications) + memory not updated for these.
6. UI greetings by name (N2 client side) — behind the N3 mockup gate: provider web
   `src/components/dashboard/layout/Header.jsx` L109-142 (`src/utils/displayName.js` `displayFirstName`); provider phone
   `src/Screen/homeTab/MyDashboardScreen/index.tsx` L170, L663 (`MY_DASHBOARD.WELCOME_BACK`); customer web
   `components/layout/customer/header.jsx` L314, L691 (`header.hello`); admin `src/utils/adminIdentity.js` L9. N4 client side:
   send `proposedFirstName/proposedLastName` from provider web `registerForm.jsx` / `PreparedProfileReady.jsx` and provider
   phone `RegisterScreen`.
