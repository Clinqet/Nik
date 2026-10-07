# Phase 5 — cleaner, skip rules, in-file merge (handoff, 2026-10-07)

DONE: 188 tests pass (`ProviderRecordNormalizerTests`, `ProviderImportSkipRulesTests`, `ProviderImportDeduplicatorTests`,
`ProviderImportNormalizationSettingsTests`). Files: `NormalizedProvider.cs`, `ImportTextRules.cs`, `ProviderRecordNormalizer.cs`,
`ProviderImportSkipRules.cs`, `ProviderImportDeduplicator.cs`, `ProviderImportMerger.cs` (clinqetinfrastructure/Services/
ProviderImport); `clinqetshared/Utilities/SocialPlatformHosts.cs` (moved out of `ProviderSetupProfileService`, same
behaviour — the API suite covering it was NOT run); new enums `ProviderImportNormalizationEnums.cs`;
`ProviderImportReviewReason.PriceDropped` appended; `Normalization.DirectoryHosts` setting; Functions appsettings
`AdminProviderImport:Normalization` lists filled (SharedContactBlocklist empty until the pilot).

Readings taken (not stated by the plan): MG4 same name in different cities ⇒ `PossibleDuplicateInFile`; a merge member with no
hours is ignored, stated hours must match exactly else no hours + `HoursConflict`; franchise rule = brandName on any member
and names or primary cities differ; a missing contact purpose = main; an extension phone links only on number + extension;
added flags `StaleSource`, `PossiblyClosed` (temporarily closed), `ConflictsInSource`; CA/US provinces → 2-letter codes, an
Indian state kept as written; closed every day ⇒ `HoursIncomplete`.

NOT done:
1. Sabotage (six breaks: gmail dot key, conflict check, franchise rule, toll-free linking, home-street rule, zero price) — never
   ran (build blocked at the time). Copy the three files to scratch, apply, run only these classes, copy back, diff.
2. Full Communications unit suite run.
3. DI: `ProviderRecordNormalizer` (IOptions<AdminProviderImportSettings>, IOptions<DiscoverySettings>, TimeProvider) and
   `ProviderImportDeduplicator` as singletons in Functions `Program.cs` AND `FunctionAppFactory` (trap T-5).
4. Skills/memory.
