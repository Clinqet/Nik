# Phase 5 — AI curation, verification, bank (handoff, 2026-10-07)

DONE: `clinqetinfrastructure/Services/ProviderImport/Ai/` — `CurationAnswer.cs`, `CurationPrompt.cs` (input + strict schemas,
chunking), `ProviderImportCurator.cs` (keyed "ProviderImport" AI client, bank, truncation split, schema retry, cost from
TokenPricing, meter), `CurationVerifier.cs` (§9.4). System prompts in Functions appsettings = class defaults. Tests 396/396
under `ProviderImport|BankRulesVersion`: CurationVerifierTests 97, CurationPromptTests 25, ProviderImportCuratorTests 20,
ProviderImportAiPromptSettingsTests 6, BankRulesVersion pin `(1, "64f4a480857ce7ee")` for both versions. Two bugs fixed:
empty serviceIndex enum; VerifyHours missing finding.

NOT done:
1. Sabotage ≥ 3: remove the `numbers.Any(n => n <= 0 …)` guard in `CurationVerifier.VerifyPrice`; drop `WriteBankAsync` in
   `ProviderImportCurator.CallAsync`; put `scrapedAt` into `CurationPrompt.Input`.
2. `ProviderImportCurator` is NOT yet registered in DI (`AddProviderImportWorker`) — register it (Scoped/Transient; it takes
   the keyed AI client).
3. `AiModelPinConventionTests` registry: add the two import deployment names if that test requires every deployment string.
4. Two CS8601 warnings in `ProviderImportProfileWriter.cs` (~L487-490, offer Description/Conditions) — decide null handling.
