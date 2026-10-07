# Phase 9 — name prompt (N3), greetings (N2 UI), names into the code check (N4 clients) (handoff, 2026-10-07)

Mockup `Data/mockups/provider-name-prompt` registered; owner waived waiting for approval (2026-10-07).

DONE:
- Server: snoozable dismissal (`SpotlightTypeRules.IsSnoozable`, only `ProviderNamePrompt`; `UserMetadataService.DismissSpotlightAsync`
  moves DismissedAt/UpdatedAt — no new column); `UserProfileDto.ClaimedAt` filled in Identity `UserProfileController` GET (DTO
  only); `NamePromptSettings` (`NamePrompt:SnoozeDays` 7) → `AppConfigDto.NamePrompt`. Unit tests pass (Identity 92/92, API 17/17).
- Provider web: `src/lib/namePrompt.js`, `src/components/dashboard/NamePrompt.jsx` (mounted in `src/app/dashboard/layout.jsx`),
  `src/utils/personName.js` greeting, `src/lib/proposedNames.js` + register/PreparedProfileReady/verifyLoginPhoneForm (phone code
  only); keys in 5 languages; `Dashboard.WelcomePrefix` removed. Tests pass; ESLint 0.
- Customer web: N4 (`lib/proposedNames.js` …) + N2 (`utils/personName.js`, header). Tests pass; ESLint 0.
- Provider phone: `src/lib/namePrompt.ts`, `src/hooks/useNamePrompt.ts`, `src/components/NamePromptSheet.tsx` (on
  `BookingSheet`), N2 greeting, N4 params RegisterScreen → LoginOTPScreen; keys in 5 languages. tsc clean; tests pass
  (684 regression tests over touched shared files).

NOT done:
1. Provider phone N4 tests (LoginOTPScreen sends the params with the phone verify only; RegisterScreen navigates with them).
2. Customer phone (`clinqetmobileuserapp`): N4 (PreparedProfileReady.tsx + RegisterScreen → LoginOTP params → phone verify) and
   the home greeting (`src/screen/homeTab/homeScreen/index.tsx` ~L379 `HOME_SCREEN.HELLO`) must filter "Guest"/"User"; jest tests.
3. Run the two integration tests written but not run: Identity
   `UserMetadataControllerIntegrationTests.DismissSpotlight_NamePromptAgain_MovesDismissedAtInSql`, API
   `AppConfigEndpointTests.GetAppConfig_ServesTheNamePromptSnoozeDaysBoundFromConfiguration`.
4. Sabotage proofs for every new suite (4 apps + 2 hosts).
5. Viewport checks 320/375/768/1024/1440 (web prompt) and simulator light/dark (phone sheet).
6. Skills ×4 + memory (spotlight snoozable type, partner app, provider mobile, user app, customer mobile, auth sessions N4).
7. Stale comments: `preserveAccountSettings` (provider web `src/services/authServices.js`) and `withAccountSettings` (mobile
   `editProfileAPI.tsx`) still say a missing `ReceiveMarketingEmails` is saved as true — no longer true after the null-keeps fix.
8. DECIDED (owner, 2026-10-07): "Not now" on web OR phone snoozes both — keep it; test it on both apps.
