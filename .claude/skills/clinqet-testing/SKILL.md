---
description: |
  **TESTING SKILL** — Work on unit tests and integration tests for the Clinqet platform. USE FOR: writing/modifying xUnit unit tests with Moq, integration tests with Testcontainers, test fixtures, WebApplicationFactory setup, test token generation, assertion helpers. Applies to ALL test files across the solution.
---

# CLINQET TESTING — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (what this programme's tests proved, and how)

See the `clinqet-prepared-providers` skill for the whole feature. Patterns worth reusing:

- ‼️ **An integration test that asserts "this is refused" must also assert the route is NOT 404.** A mistyped route answers 404 and makes any refusal test pass for the wrong reason — it happened here, and the real routes had to be read from the controllers.
- ‼️ **Sabotage from the TEST side when the production side is a security attribute.** To prove `SetupSessionReachIntegrationTests` was sensitive, the token's actor claim was removed (3 of 7 failed) and restored — never by weakening an `[AllowedInSetupSession]` mark in source.
- ‼️ **A convention pin that enumerates METHODS cannot see a CLASS-level attribute.** The fix was to restrict `AttributeUsage` to methods, so the compiler refuses what the pin could not look at — stronger than widening the test.
- ‼️ **A guard reads a WINDOW of lines, so a comment can break it.** A two-line explanation pushed a `when (ex is not OperationCanceledException)` outside the catch-shape scanner's three-line window and failed a correct change.
- **A test double must mirror production, not the convenient default.** `SessionSnapshot.GrantsRecentSignIn` went fail-closed, and 26 tests failed because the doubles had relied on the fail-open default — the doubles were wrong, not the change.
- **A mock of a slice must carry every selector the screen reads**, or the real `useAppSelector` is handed undefined.
- **A fail-fast setting belongs in every fixture in the same change** — `PreparedProvider:SigningKey` stopped both integration hosts booting until it was added to `IdentityApiFactory` and `ClinqetApiFactory`.
- **`clinqetwebadmin` tests run only as `CI=true npx react-scripts test --watchAll=false`.** Bare `npx jest` fails all 84 suites on ESM — that is the runner, not a defect.
## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

- **Comments — terse, only when they earn their place.** Default to no comments; let naming carry the meaning. **However**, write a comment when it captures non-obvious context the code itself cannot show: a hidden invariant, a subtle ordering constraint, a deliberate workaround for a known bug, a defensive choice with a real reason, or an RFC/spec citation that explains *why*. Prefer a single short line. Forbidden: restating WHAT the code does (e.g. `// increment counter` above `counter++`); multi-line narrative blocks explaining design rationale; XML doc summaries on properties whose names already convey intent; commented-out code; `// TODO` without an issue link. When in doubt, delete the comment — but don't strip a *real* WHY-comment just to chase zero.
- **No verbose docstrings on self-evident members.** A property named ``EnableAISpellCorrection`` does NOT need a doc summary. A field named ``_searchEnableAISpellCorrection`` does NOT need a multi-line ``//`` block above it. Trust naming.
- **No commented-out code, no leftover symbols, no ``// TODO`` without an issue link.**

---


## OVERVIEW

The Clinqet platform uses xUnit for testing with Moq for mocking and Testcontainers for integration tests. All tests MUST pass 100% — no skipped, no flaky, no ignored.

## ‼️ NEVER ASSERT FIRE-AND-FORGET STATE AFTER A FIXED `Task.Delay` (2026-08-25)

Integration classes run **in PARALLEL against one Cosmos emulator**, so any guessed sleep before an
assertion is a coin flip, not a wait. If the value under assertion is produced AFTER the HTTP
response — `TaskExtensions.SafeFireAsync` (literally `_ = Task.Run(...)`), a queue-mock side effect
(`MockServiceBusService` persists every `AdminAlertMessage` to Cosmos, standing in for the Functions
`AdminAlertProcessor`), or any other detached work — **poll to a deadline**:

```csharp
var alert = await Eventually.FindAsync(async () =>
{
    using var scope = _factory.Services.CreateScope();            // ‼️ own scope PER probe
    var repo = scope.ServiceProvider.GetRequiredService<IAdminAlertRepository>();
    var alerts = await repo.GetRecentAlertsAsync(from, to);
    return alerts.FirstOrDefault(a => /* match */);
});
Assert.NotNull(alert);
```

`Clinqet.API.IntegrationTests\Helpers\Eventually.cs` — `FindAsync(probe, timeout=15s, interval=200ms)`
returns on the first non-null probe. This is FASTER than a blind sleep (it returns the moment the
write lands) and only spends the budget on a genuine failure. A scope must be created inside the
probe — one held across attempts outlives its request.

Legitimately different (do NOT convert): short `Task.Delay(20)` between creates to force distinct
`createdAt` for ordering assertions; a trailing delay that drains fire-and-forget work and asserts
nothing after it. `AnalyticsPipelineIntegrationTests` and `ContentModerationSendTests` already used
the deadline-poll idiom — `Eventually` generalizes it.

‼️ **A flake exposed by an unrelated new test class is still the TEST's defect.** Verify the actual
chain (`git show --stat` the suspect commit; trace the producer) before blaming or reverting
unrelated work — memory `assert-fire-and-forget-with-bounded-poll-2026-08-25`.

---

## ‼️‼️ NEVER ASSERT A WALL-CLOCK ELAPSED TIME AGAINST A BUDGET — drive the clock, or gate the dependency (2026-09-22)

A `Stopwatch` assertion measures **the runner, not the code**. Two tests asserted one and both failed
only inside a loaded full-suite run — `TheRetryBudget_CannotOutliveTheOverallTimeout` (6 s alone, 13 s
loaded, bound `< 12 s`) and the alphabet lookup (1 s alone, 9 s loaded, bound `< 500 ms`). Passing alone
and failing in the suite IS the signature. §0.8: that test is broken, not unlucky.

**A loose bound is not the fix** — it only moves the number the runner has to beat. Remove the clock
from the assertion entirely, one of two ways.

### A. Drive the clock — when the code under test schedules its own waits

Inject `TimeProvider` (the pattern `RealtimeSessionPayloadBuilder` already uses; every host registers
`AddSingleton(TimeProvider.System)`). The BCL routes **both** of these through `provider.CreateTimer`:

```csharp
using var budget   = new CancellationTokenSource(TimeSpan.FromSeconds(n), _timeProvider);
using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, budget.Token);
await Task.Delay(backoff, _timeProvider, deadline.Token);
```

- ‼️ **`CancelAfter()` ignores the TimeProvider** — it always uses the system timer queue. A deadline
  must be **constructed** with the provider and then linked; `CreateLinkedTokenSource(ct)` +
  `CancelAfter(...)` cannot be driven and silently keeps waiting real seconds.
- ‼️ **The pump fires the next due timer only when MORE THAN ONE is scheduled.** The call schedules its
  overall deadline up front and holds it for its whole life, so a *second* timer is the signal that it
  is genuinely waiting. Firing on one cancels the call before its first retry has been scheduled.
- The pump waits on a **timer-registration event**, never a yield or a sleep — no race with the runner.
- **A regression that stops using the injected clock does not hang**: the pump races the work task, the
  work completes on the real clock, and `clock.Elapsed` is `0` — so the assertion fails cleanly.
- Keep the double **private to the test file** (as `FixedTimeProvider` is). `Microsoft.Extensions.
  TimeProvider.Testing` is NOT referenced anywhere — do not add it for this.
- ‼️ **A double that models one-shot timers must REFUSE a repeating period**, not fire once and report
  success. A lying test double is worse than a missing one.

### B. Gate the dependency — when the wait belongs to a collaborator

Hold the slow leg open on a `TaskCompletionSource` and prove the caller came back **while it was still
held** — the collaborator demonstrably had not finished, which is strictly stronger than "it returned
inside 500 ms" and contains no timing at all. Then release, `await` the same in-flight work (joining it
beats polling for it), and assert the settled state.

- ‼️ **A budget setting often derives a SECOND bound — find it before you pick a small number.**
  `BusinessAlphabetService` gives its detached lookup a ceiling of `LookupTimeoutMs × 20`, so a 60 ms
  budget chosen to keep the ask quick leaves that lookup only 1.2 s to finish a real round trip; a
  stalled runner kills it and the "still warms the cache" half fails. Derive the budget from the
  generous one instead (`GenerousBudgetMs / 20`), and set `UnresolvedCacheSeconds = 0` so a killed
  lookup caches nothing and the next ask simply runs again. **No stall may decide any assertion.**

**Prove it under the condition that broke it**: re-run the fix on a fully saturated machine. The
retry-budget test was measured identical across 2,000 runs on 22 saturated cores (~35 ms each, against
6–13 s before) and both classes ran 10/10 green under load, including runs stretched 4.7 s → 20.3 s.


### C. ‼️ A `TimeProvider` double that overrides only `GetUtcNow()` SILENTLY KEEPS REAL TIME (2026-09-22)

Measured with a probe, not assumed: the base `TimeProvider.GetTimestamp()` falls through to the **real
`Stopwatch`**, at the real `TimestampFrequency`. A double shaped like the house one above — `GetUtcNow()`
+ `CreateTimer()` only — read a 120 ms real sleep back as **130.2 ms**.

So when the code under test paces on `GetTimestamp()`/`GetElapsedTime()` (which it should — see below),
the double MUST override **both**:

```csharp
public override long TimestampFrequency => TimeSpan.TicksPerSecond;
public override long GetTimestamp() { lock (_gate) return _ticks; }
```

- ‼️ **Replacing `Environment.TickCount64` with `GetUtcNow()` is a CORRECTNESS REGRESSION.** TickCount64
  is monotonic; `GetUtcNow()` is wall-clock and an NTP step would move a live pacing window. Use
  `GetElapsedTime(originTimestamp, GetTimestamp())`, capturing the origin in the constructor.
- ‼️ **The pump's "how many timers" rule is PER-SUBJECT, never copied.** `AzureFastTranscriptionService`
  holds its overall deadline open for its whole life, so **>1** scheduled timer means "now waiting". A
  poll loop like `AiBudgetGovernor` has exactly **1** timer outstanding at a time — copying the `>1` rule
  there hangs forever. Decide from the subject's own shape.
- **Prove the double actually drives**: delete the two overrides, rebuild, and confirm the virtual-time
  tests FAIL. On `AiBudgetGovernor` exactly 3 of 8 failed and the run stretched 0.6 s → 15 s. A double
  that is not wired in does not fail loudly — it passes, having measured nothing.
- ‼️ **A build error means the test result is VOID.** A locked `apphost.exe` failed a rebuild while
  `dotnet test --no-build` happily ran the STALE dll and printed `Passed! 8`. Read the build's
  `0 Error(s)` before believing any run that followed it.

### D. Two assertions that beat every millisecond bound — reach for these FIRST

Before injecting anything, check whether the claim is already provable structurally. Often it is, and the
timing line was only ever a weaker restatement:

| Claim | Clock-free proof |
|---|---|
| "it never queues / never waits" | `Assert.True(task.IsCompletedSuccessfully)` on the **un-awaited** task — proves it never yielded at all, and fails instantly instead of waiting out the regression |
| "the short-circuit was taken" | `Assert.Same(a, b)` — a no-op singleton vs a freshly allocated lease per call |
| "no back-off was slept" | the attempt COUNT, when the retry gate `break`s before its `Task.Delay` |
| "the leg's own deadline fired, not the outer one" | which alarm was raised (`Times.Once` / `Times.Never`) |
| "it stopped at its cap" | `clock.Elapsed` once the clock is driven — virtual time is a deterministic statement about the code's own scheduling, not about the runner |

‼️ **A timing bound often hides a test that pins NOTHING.** Two `AiBudgetGovernor` tests asserted `< 500 ms`
on paths whose arrangement never created the condition they named: the sliding window was empty, so
`EvaluateWait` returned 0 and **both tests still passed with the lane check and the `Enabled` flag deleted**.
Fixing the clock is the moment to check the arrangement actually bites — otherwise a green wall-clock
assertion is replaced by a green virtual one, and neither guards anything.

### E. Adding a required ctor parameter to a shared-library type is a TWO-REPO change

`AiBudgetGovernor` lives in `clinqetinfrastructure` but is constructed directly in **14** places across
`Clinqet.API.UnitTests`, `Clinqet.API.IntegrationTests`, `Clinqet.Communications.UnitTests`,
`Clinqet.Communications.IntegrationTests` and a loose harness. Because the library is referenced by both
hosts, the peer repo stops compiling the instant the constructor changes — it CANNOT be split across
sessions (§0.16: never leave code in the tree that has not compiled).

- Enumerate `new <Type>(` across every repo BEFORE choosing required vs optional. `grep` for the
  target-typed `new(...)` form too — it does not match `new <Type>(`.
- **Required beats `TimeProvider? = null`.** House pattern is required in 4 of 5 infrastructure services,
  and an optional default fails *silently* to system time if a host ever stops registering the provider.
  All three hosts already register `AddSingleton(TimeProvider.System)`, so DI needs no Program.cs edit.
- ‼️ **PRODUCTION HOSTS ARE NOT THE ONLY DI CONTAINERS — this bit, 2026-09-22.** Confirming all three
  `Program.cs` files register the provider is NOT enough. `FunctionAppFactory` (Communications
  integration tests) composes its OWN container and registers `IAiBudgetGovernor` in it, with no
  `TimeProvider` — so **13 integration tests died at fixture setup while all 19,645 unit tests passed
  green**. Same shape as the Phase-1 "no host able to start" defect, one level down and invisible to
  every unit suite. Grep `AddSingleton<...I<Type>` across TEST projects too, not just hosts, and add the
  dependency to every container that registers the type.
---

## TEST PROJECTS

### Main API Tests

| Project | Path | Purpose |
|---------|------|---------|
| Unit Tests | `C:\Nik\clinqetapi\Clinqet.API.UnitTests\` | Controller, service, repository, middleware unit tests |
| Integration Tests | `C:\Nik\clinqetapi\Clinqet.API.IntegrationTests\` | Full API endpoint tests with real containers |

### Identity API Tests

| Project | Path | Purpose |
|---------|------|---------|
| Unit Tests | `C:\Nik\clinqetidentity\Clinqet.Identity.UnitTests\` | Auth service, controller unit tests |
| Integration Tests | `C:\Nik\clinqetidentity\Clinqet.Identity.IntegrationTests\` | Full identity endpoint tests |

---

## ‼️‼️ WHICH SUITE DOES A LIBRARY CLASS'S TEST BELONG IN? (§0.18 — method + the 3 traps, 2026-09-22)

`clinqetinfrastructure` / `clinqetshared` / `clinqetcore` have **no test projects**. A class living there is
tested from the suite of the **HOST whose runtime path invokes it**. A repo-wide sweep on 2026-09-22 moved
**39** misplaced files (36 → Communications, 3 → Mcp, 4 → Identity).

### The method that actually works

1. **Find the registration site of the concrete class**, not just its name. Search **host `Program.cs`** *and*
   `clinqetinfrastructure/Configuration/*.cs`.
2. If it is registered inside an **infra DI extension** (`AddPaymentServices`, `AddNotificationRouting`,
   `AddAccountNotifications`, `AddIntegrationHealthAlerts`, `AddTenancyServices`, …), the owners are **every
   host that CALLS that extension method** — grep the hosts for the method name.
3. For a class with **no DI registration** (a `static` helper), find its callers **inside the libraries**, then
   ask which hosts drive *those*. Repeat until you reach a host.
4. Two hosts legitimately own it ⇒ §0.18 **rule 2**: test **once**, in the suite of the PRIMARY orchestrator.
   The strongest tells, in order: which host **binds its settings section**; which host **writes** vs merely
   reads; and **which host exercises the surface the tests actually assert** (read the test names — that is
   usually decisive, and it is evidence rather than a heuristic).

### ‼️ Three traps that make a naive scan INVENT violations

A scan of the form *"the host never names the class ⇒ the host never runs it"* is **wrong three ways**. All
three bit during the 2026-09-22 sweep; **13 files were moved on that faulty basis and reverted byte-exact**
before the change landed.

| Trap | What it looks like | Example |
|---|---|---|
| **Infra DI extension** | The host's `Program.cs` never names the class; it calls `AddPaymentServices()` and the registration lives in `PaymentServiceRegistration.cs` | `SubscriptionBillingService`, `TierLimitAlertService`, `NotificationRecipientResolver` — all resolved by the **API**, which was about to lose their tests |
| **Static helper reached through infrastructure** | No host names it; an infrastructure service calls it internally | `TextScriptDetector` (via `BusinessSearchAgent`/`BusinessAlphabetService` — API-exclusive), `PhoneNumberFormat` + `VoicelineProjection` (via `VoiceOwnNumberService`/`VoiceAssistantService`), `ServiceMatchingHelper`, `IntegrationFailureClassifier`, `AiResourceLimitClassifier`, `WhatsAppErrorClassifier`, `InvoiceLineDiscountFormatter`, `DescriptionTextCut` |
| **A comment is not a reference** | The host's only mention is a code comment, so a word-count says "owned" and the violation is **hidden** | `MetaWhatsAppService` — the API's sole mention is a comment in `Program.cs`; it was found only after re-scanning with comment-only lines stripped |

Counting **`IFoo` as well as `Foo`** is also mandatory — a host that names only the interface (e.g.
`IProviderConnectedAccountService`) still owns the class.

### Two more things the sweep proved

- **Same short name, two classes.** `AzureFastTranscriptionService` exists **twice**:
  `Services/Voice/` on `IVoiceRecordingTranscriptionService` (Functions-only, `VoicePostCallProcessorFunction`)
  and `Services/AI/` on `IAudioTranscriptionService` (API-only, `SpeechController`). Name-based ownership is
  blind here — resolve the **namespace**. Only the Voice one moved.
- **A departing file may own a nested helper others use.** `PlivoCallControlServiceTests` nested the
  `RecordingHandler` harness that the two legitimately-API-owned Plivo suites (number provisioning, WebRTC
  credential mint) aliased. Same shape as the 2026-08-16 Telnyx migration: the harness was lifted to a
  standalone `Services/Communication/RecordingHandler.cs` in the API suite and now serves both carriers.

### Verifying a migration

Every moved file must build **and** its origin host must score **0 class refs + 0 interface refs** on
comment-stripped source. Sweep for now-false placement comments in BOTH directions — files left behind that
said "…lives in the API suite" become lies the moment the move lands, and no build catches a stale comment.

---

## UNIT TEST PATTERNS

### Framework & Libraries
- **Test Runner**: xUnit 2.9.3 (parallel collection execution enabled)
- **Mocking**: Moq 4.20.72
- **Test Data**: AutoFixture 4.18.1
- **Naming**: `{ClassName}Tests` (e.g., `BookingControllerTests`)

### Structure: Arrange/Act/Assert (AAA)

```csharp
public class BookingControllerTests
{
    private readonly Mock<IBookingRepository> _mockBookingRepo;
    private readonly Mock<ILocalizationService> _mockLocalization;
    private readonly Mock<IServiceBusService> _mockServiceBus;
    private readonly Mock<ILogger<BookingController>> _mockLogger;
    private readonly BookingController _controller;

    public BookingControllerTests()
    {
        _mockBookingRepo = new Mock<IBookingRepository>();
        _mockLocalization = new Mock<ILocalizationService>();
        _mockServiceBus = new Mock<IServiceBusService>();
        _mockLogger = new Mock<ILogger<BookingController>>();

        _controller = new BookingController(
            _mockBookingRepo.Object,
            _mockLocalization.Object,
            _mockServiceBus.Object,
            _mockLogger.Object
        );

        // Set up controller context with claims
        SetupControllerContext();
    }

    [Fact]
    public async Task GetBooking_ValidId_ReturnsOk()
    {
        // Arrange
        var bookingId = "test-booking-id";
        var businessId = "test-business-id";
        var booking = new Booking { BookingId = bookingId, BusinessId = businessId };

        _mockBookingRepo
            .Setup(r => r.GetByIdAsync(bookingId, businessId))
            .ReturnsAsync(booking);

        // Act
        var result = await _controller.GetBooking(bookingId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<BookingDto>>(okResult.Value);
        Assert.True(response.Success);
        Assert.NotNull(response.Data);
    }

    [Fact]
    public async Task GetBooking_NotFound_Returns404()
    {
        // Arrange
        _mockBookingRepo
            .Setup(r => r.GetByIdAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync((Booking?)null);

        _mockLocalization
            .Setup(l => l.GetLocalizedString(It.IsAny<string>(), It.IsAny<string>()))
            .Returns("Booking not found");

        // Act
        var result = await _controller.GetBooking("nonexistent");

        // Assert
        var notFoundResult = Assert.IsType<NotFoundObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<BookingDto>>(notFoundResult.Value);
        Assert.False(response.Success);
    }

    private void SetupControllerContext()
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user-id"),
            new Claim("UserNumber", "test-business-id"),
            new Claim("UserType", "Provider"),
            new Claim("Locale", "en")
        };

        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };

        // Set Accept-Language header
        _controller.ControllerContext.HttpContext.Request.Headers["Accept-Language"] = "en";
    }
}
```

### Test Naming Convention

```
MethodName_Scenario_ExpectedResult
```

Examples:
- `GetBooking_ValidId_ReturnsOk`
- `GetBooking_NotFound_Returns404`
- `CreateBooking_InvalidInput_ReturnsBadRequest`
- `UpdateBooking_ETagMismatch_ReturnsConflict`

### Mocking Patterns

```csharp
// Setup with specific input
_mockRepo.Setup(r => r.GetByIdAsync("specific-id", "partition-key"))
    .ReturnsAsync(entity);

// Setup with any input
_mockRepo.Setup(r => r.GetByIdAsync(It.IsAny<string>(), It.IsAny<string>()))
    .ReturnsAsync(entity);

// Setup throws
_mockRepo.Setup(r => r.GetByIdAsync(It.IsAny<string>(), It.IsAny<string>()))
    .ThrowsAsync(new KeyNotFoundException());

// Verify called
_mockRepo.Verify(r => r.GetByIdAsync(bookingId, businessId), Times.Once);

// Verify Service Bus message sent
_mockServiceBus.Verify(s => s.SendMessageAsync(
    It.Is<string>(q => q == "booking-emails"),
    It.IsAny<BookingEmailMessage>(),
    It.IsAny<CancellationToken>(),
    It.IsAny<bool>()), Times.Once);
```

### AutoFixture for Test Data

```csharp
var fixture = new Fixture();
var booking = fixture.Create<Booking>();
var bookings = fixture.CreateMany<Booking>(10);
```

---

## INTEGRATION TEST PATTERNS

### Framework & Libraries
- **Test Runner**: xUnit v3 3.2.2 — **class-level PARALLEL** (`MaxParallelThreads=4`, `ParallelizeTestCollections=true`). threads=4 is optimal; 8 was measured slightly slower (the Cosmos emulator saturates ~4 concurrent). Tests are I/O-bound on the emulator, so this transfers to the 2-core CI runner.
- **Containers**: Testcontainers 4.11.0
  - Cosmos DB emulator (vnext, port 8081, partition count 4)
  - Azurite (Azure Storage emulator)
  - SQL Server (money-path collections only)
- **HTTP Mocking**: WireMock.Net

### PARALLEL EXECUTION MODEL (read before adding an integration class)

The suite runs class-parallel against ONE shared emulator. Preserve this or you re-serialize everything (15min) or introduce flakiness:

- **`ClinqetApiFactory` is an ASSEMBLY fixture** (`[assembly: AssemblyFixture(typeof(ClinqetApiFactory))]` in `Fixtures/ClinqetApiFactory.cs`) — one Cosmos emulator + Azurite for the whole assembly, injected into every test class constructor. NOT a collection fixture (the emulator binds fixed host port 8081, so a second collection with its own factory would collide).
- **Most classes carry NO `[Collection]`** ⇒ each is its own collection ⇒ they run in parallel. Isolate by data: unique `Guid`/`CosmosRepositoryTestData.NewSuffix(...)` per test for every partition key (`businessId`/`customerId`/…), and scope every count/`Assert.Empty`/`DoesNotContain` to your own ids. NEVER re-add a blanket `[Collection("Integration Tests")]`.
- **`[Collection("Search Serial")]`** groups the classes that touch the process-static `MockAzureSearchQuery` seed store (`SearchController*` + `RecommendationsEndpointTests`) so they run serially among themselves. Any new class that reads/writes a shared process-static or singleton store must either be thread-safe + snapshot-on-read (see `MockServiceBusService`, `MockAdminAlertRepository`) or join this collection.
- **SQL collections** (`Payments SQL`, `Billing Seeder SQL`, `Billing Catalog V3 SQL`) keep `DisableParallelization=true` ⇒ only one SQL container is ever live at a time ⇒ memory stays within the 7GB CI runner (Cosmos + Azurite + ≤1 SQL).
- Config lives in `integration-tests.runsettings` (`<xUnit>` block) + `xunit.runner.json` + `AssemblyInfo.cs`. CI needs no YAML change for parallelism — it passes the runsettings via `--settings`.

**Unit tests:** already parallel; a "unit" test that constructs a REAL Azure/Cosmos SDK client against an unreachable endpoint pays the full retry timeout (~17s each). Always mock the client (see `AzureSearchQueryFusionTests.BuildSearchClientMock` for the `Mock<SearchClient>` template).

### WebApplicationFactory (ClinqetApiFactory.cs)

```csharp
public class ClinqetApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private CosmosDbContainer _cosmosContainer;
    private AzuriteContainer _azuriteContainer;

    public async Task InitializeAsync()
    {
        // 1. Start containers in parallel
        _cosmosContainer = new CosmosDbBuilder()
            .WithImage("mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview")
            .WithPortBinding(8081)
            .Build();

        _azuriteContainer = new AzuriteBuilder().Build();

        await Task.WhenAll(
            _cosmosContainer.StartAsync(),
            _azuriteContainer.StartAsync());

        // 2. Pre-create database + containers
        // ProviderData, Reviews, Transactions, CustomerData,
        // Communications, SystemData, Messages

        // 3. Pre-create storage containers
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((context, config) =>
        {
            // 150+ in-memory test settings
            config.AddInMemoryCollection(new Dictionary<string, string>
            {
                ["CosmosDb:ConnectionString"] = _cosmosContainer.GetConnectionString(),
                ["StorageConfiguration:ConnectionString"] = _azuriteContainer.GetConnectionString(),
                // JWT, ServiceBus, AI Search, Search, Broadcast, etc.
            });
        });

        builder.ConfigureTestServices(services =>
        {
            // Mock external dependencies:
            // ServiceBusService, EmbeddingService, AzureSearchQuery,
            // BroadcastClassificationService, RecaptchaService,
            // AdminAlertRepository, CommunicationPreferenceService
        });
    }
}
```

### Test Token Helper (TestTokenHelper.cs)

Generates JWT tokens matching production AuthService claims:

```csharp
// Business owner (Provider) token
var token = TestTokenHelper.GenerateBusinessOwnerToken(
    userId: "user-guid",
    businessId: "business-guid"
);
// Claims: UserId, UserNumber=businessId, UserType="Provider", roles

// Customer token
var token = TestTokenHelper.GenerateCustomerToken(
    userId: "user-guid",
    customerId: "customer-guid",
    customerNumber: "customer-number"
);
// Claims: UserId, UserNumber=customerNumber, UserType="Customer"
```

### Integration Test Pattern

```csharp
public class BookingEndpointTests : IClassFixture<ClinqetApiFactory>
{
    private readonly HttpClient _client;
    private readonly ClinqetApiFactory _factory;

    public BookingEndpointTests(ClinqetApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateBooking_ValidInput_Returns201()
    {
        // Arrange
        var token = TestTokenHelper.GenerateBusinessOwnerToken("user1", "business1");
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        _client.DefaultRequestHeaders.Add("Accept-Language", "en");

        var dto = new CreateBookingDto { /* ... */ };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1.0/bookings", dto);

        // Assert
        response.EnsureSuccessStatusCode();
        var apiResponse = await response.Content.ReadFromJsonAsync<ApiResponse<BookingDto>>();
        Assert.True(apiResponse.Success);
        Assert.Equal(201, (int)response.StatusCode);
    }

    [Fact]
    public async Task GetBooking_Unauthorized_Returns401()
    {
        // No auth header
        var response = await _client.GetAsync("/api/v1.0/bookings/test-id");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetBooking_CrossTenant_Returns404()
    {
        // Arrange
        var ownerToken = TestTokenHelper.GenerateBusinessOwnerToken("user1", "business1");
        var otherToken = TestTokenHelper.GenerateBusinessOwnerToken("user2", "business2");

        // Create booking as user1
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);
        var createResponse = await _client.PostAsJsonAsync("/api/v1.0/bookings", dto);
        var created = await createResponse.Content.ReadFromJsonAsync<ApiResponse<BookingDto>>();

        // Try to access as user2
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);
        var getResponse = await _client.GetAsync($"/api/v1.0/bookings/{created.Data.BookingId}");

        // Assert — must NOT access another tenant's data
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }
}
```

---

## TEST CATEGORIES TO COVER

### Unit Tests
- [ ] Controller action returns correct ApiResponse for each scenario
- [ ] Validation errors returned correctly
- [ ] Authorization checked (claims, roles)
- [ ] Multi-tenant isolation (partition key filtering)
- [ ] Service methods handle edge cases
- [ ] Repository methods build correct queries
- [ ] Service Bus messages sent with correct queue and data
- [ ] Localization keys resolved (mock returns expected text)

### Integration Tests
- [ ] Full endpoint lifecycle (CRUD)
- [ ] Auth required on protected endpoints
- [ ] Cross-tenant access denied
- [ ] Pagination returns correct results
- [ ] Query filters work correctly
- [ ] Cosmos operations succeed with real emulator
- [ ] File upload/download with Azurite

---

## BUILD & RUN COMMANDS

```bash
# Build all
dotnet build C:\Nik\clinqetapi\Clinqet.API.sln

# Run unit tests
dotnet test C:\Nik\clinqetapi\Clinqet.API.UnitTests\ --no-build --verbosity normal

# Run integration tests (requires Docker for Testcontainers)
dotnet test C:\Nik\clinqetapi\Clinqet.API.IntegrationTests\ --no-build --verbosity normal

# Run all tests
dotnet test C:\Nik\clinqetapi\Clinqet.API.sln --verbosity normal
```

---

## CART / BASKET TESTS

### Test Files
- **Service tests**: `C:\Nik\clinqetapi\Clinqet.API.UnitTests\Services\CartServiceTests.cs` (~25+ tests)
- **Controller unit tests**: `C:\Nik\clinqetapi\Clinqet.API.UnitTests\Controllers\CartControllerTests.cs` (~15+ tests)
- **Integration tests**: `C:\Nik\clinqetapi\Clinqet.API.IntegrationTests\Controllers\CartControllerTests.cs` (~10+ tests)

### Key Test Patterns
- **Concurrency retry**: Tests verify `SaveCartAsync` retries on PreconditionFailed (412) via `SetupSequence` on the repository mock
- **Identity resolution**: Tests cover both authenticated (userNumber) and anonymous (deviceId) paths
- **Merge testing**: Validates device→user cart merge, device cart deletion, reminder scheduling
- **Rate limiting**: Integration tests verify 429 responses with correct `ApiResponse` envelope
- **Remove optimization**: Verifies that `RemoveCartItemAsync` skips Cosmos upsert when item not found (`Times.Never` for UpsertAsync)
- **Cart expiry**: Tests verify TTL calculation from `CartExpiryDays` setting

---

## CHECKLIST FOR TEST CHANGES

- [ ] Tests follow AAA pattern (Arrange/Act/Assert)
- [ ] Naming: `MethodName_Scenario_ExpectedResult`
- [ ] Controller context set up with correct claims
- [ ] All dependencies mocked (Moq)
- [ ] Both success and failure paths covered
- [ ] Multi-tenant isolation verified
- [ ] Integration tests use ClinqetApiFactory
- [ ] Test tokens generated via TestTokenHelper (match production claims)
- [ ] No hardcoded test data that could cause flakiness
- [ ] All tests pass 100% — zero skipped, zero flaky
- [ ] Build succeeds before running tests

## Integration-suite speed rules (2026-07-10 — suite went 14 min → ~3 min; NEVER regress these)

- **NEVER create a derived `WithWebHostBuilder` host per TEST.** xUnit constructs the test class per test — a derived factory in the ctor boots a FULL API host (~44s+ each; it was ~92s before the spell-check fix and made ten tests eat 15.5 of 17.7 minutes). Share ONE static derived host per class (`static` field + lock; deliberately never disposed), seed once, and flip per-test behavior at runtime (e.g. ContentModerationSendTests registers a shared MUTABLE `ContentModerationSettings` via `Options.Create(instance)` — live-read fields flip per test, ctor-frozen regex terms stay identical).
- **`ClinqetApiFactory` sets `Search:SpellCheck:Catalog:RefreshOnStartup=false`** — the catalog-dictionary startup refresh (search-index + Cosmos scan with retries) BLOCKED every host boot for ~48s; the layered spell checker tolerates an empty dictionary. Never turn it back on in tests; a test that needs the dictionary calls `ICatalogDictionaryService.RefreshAsync` itself.
- **The factory `Sources.Clear()`s ALL host configuration** — `builder.UseSetting(...)` on a derived host is WIPED. Feature-flag overrides (e.g. `Payments:BillingUiEnabled` for the receipt endpoint) must ride `ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(...))`, which runs after the factory's and wins.
- Sharing checklist for a static host: tests within the class are already serial (xUnit); cross-test state must be keyed by unique ids (the analytics tests filter the ServiceBus mock by per-test deviceId) or reset per test; classes in a serial collection ("Payments SQL") may use plain static init without locks.

## Password-management coverage (2026-07-22)

- Unit coverage pins passwordless external account creation, custom password-validator blocklist/personal-data behavior, `HasPassword` mapping, set-password conflict/success, token response shape, and notification/activity dispatch.
- SQL Testcontainers coverage must prove passwordless set-password, linked-login preservation, all-old-refresh-token revocation with one current replacement token, password-set notification emission, and `HasPassword` true/false profile behavior.

---

## AN ENABLED-BY-DEFAULT SETTING THAT CALLS OUT MUST BE PINNED OFF IN THE FIXTURE (2026-07-26)

`ClinqetApiFactory` calls `config.Sources.Clear()`, so `appsettings.json` never loads and **the options
class default is what applies in integration tests**. The moment `IndexNowSettings.Enabled` became
`true` with a real key (committed values are the PROD values, per §0.12), every reindex and
provider-projection test would have POSTed to the **live api.indexnow.org**.

Pinned `["IndexNow:Enabled"] = "false"` in the fixture, beside the identical
`Payments:SmartAnalyticsEnabled` precedent whose comment already spelled out the rule.

**The rule:** when a setting's class default flips to enabled, ask *does anything behind it leave the
process?* If yes, it must be pinned off in the fixture in the same change. §0.12 forces the class
default to mirror prod; the fixture is the only correct place to opt out.

The Identity host needs no pin — it never references IndexNow.

---

## A SHARED-FIXTURE TEST MUST NEVER ASSERT A GLOBAL COUNT (CI dev-958, 2026-07-26)

`ServicesSitemapIntegrationTests.Build_SplitsAGroupThatExceedsThePerFileCap` seeded 5 services and
asserted the sitemap held exactly 5 URLs. CI: **expected 5, actual 9.**

**Why it passed locally and failed in CI — and why a filtered re-run cannot reproduce it.** Four classes
share the `Seo SQL` collection fixture: `ServicesSitemapIntegrationTests`, `SitemapProjectionSqlTests`
(**18 providers**), `FriendlyNameHistorySqlTests`, `FriendlyNameResolutionSqlTests`. Each sitemap test
gets its own **blob container**, so output is isolated — but that also means **no watermark exists, so
every build is a FULL rebuild over the SQL the whole collection shares.** Run the class alone and only
its own data exists; run the full suite and the other classes' providers are already there.

‼️ **`dotnet test --filter` on the failing class will pass and tell you nothing.** The extra rows come
from classes the filter excluded. Reproducing needs the collection, or the full suite.

**The rule:** in a shared-fixture integration test, assert on data you can prove is yours. Every test in
this class already carries a unique `_suffix` in its seeded names — count only URLs containing it:

    var mine = locs.Count(loc => loc.Contains(_suffix, StringComparison.Ordinal));

Then "did it split?" becomes "how many chunks hold MY suffix", which no other class can perturb. Absolute
totals, `Assert.Single`, and "the manifest has N chunks" are all order-dependent in a shared fixture —
they pass until someone adds a test to a sibling class, then fail somewhere unrelated.

Self-relative assertions are also safe: comparing two consecutive builds to each other
(`Assert.Equal(first.TotalUrls, second.TotalUrls)`) needs no isolation at all.
## Localization conventions (2026-07-26)

- Frontend parity tests compare every authored locale to English for exact key structure and placeholders. Backend localization convention tests do the same for `en`/`fr`/`es`/`hi`/`gu`.
- Email-template convention tests require exact filename parity with English and exact template-token parity. FAQ tests require 15 documents and exact North America (`en`/`fr`/`es`) and India (`en`/`hi`/`gu`) region sets. PDF tests pin English attachment generation until the multilingual-PDF phase.

---

## ‼️ MULTI-USER TENANCY (2026-08-01 → 2026-08-04) — the doubles, the convention tests, and how green suites hid real bugs

> **The whole model is one skill: read `clinqet-provider-teams` before any tenancy change.**

**Baseline at the end of the programme: 13,788 passed / 0 failed / 0 skipped across all nine suites.**
`Clinqet.API.UnitTests` 8,076 · `Clinqet.API.IntegrationTests` 1,637 · `Clinqet.Identity.UnitTests` 868 ·
`Clinqet.Identity.IntegrationTests` 385 · `Clinqet.Communications.UnitTests` 1,758 ·
`Clinqet.Communications.IntegrationTests` 420 · `Clinqet.Mcp.UnitTests` 535 ·
`Clinqet.Mcp.IntegrationTests` 65 · `ClinqetCosmosAIIndexSetup.UnitTests` 44.

### ‼️‼️ EVERY SERIOUS DEFECT THIS PROGRAMME SHIPPED WAS INVISIBLE TO A GREEN SUITE

At the moment each one shipped the full regression was passing — 13,149 → 13,245 → 13,361 → 13,416 →
13,515 → 13,764. **A green suite is the state in which these bugs were WRITTEN.** If your method is "run
the tests and read the diff", you find none of them. See `member-provider/06-AUDIT-CASEBOOK.md` for all 20
worked cases; the transferable part is the **method**, not the defect.

**The evidence standard:** a count · a failing test (break the code on purpose) · a real engine · **both
sides of an identifier traced** · the generated artefact read. ‼️ **Forbidden as evidence:** *"looks
correct"* · *"should be fine"* · *"the tests pass"* · *"the plan says so"* · *"it was done in Phase N"*.

### ‼️ The four test doubles, and how each one lied before it was fixed

| Double | The lie it told |
|---|---|
| `Mock.Of<IBusinessCommunicationDispatcher>()` | ‼️ **Never invokes `requestFactory`**, so **every assertion about the CONTENT of a business notification passes vacuously.** Use `BusinessDispatcherTestDouble` (unit) or `PassThroughBusinessDispatcher` (integration) — recording doubles that **do** invoke it |
| `PassThroughBusinessDispatcher`, first version | ‼️ **MORE permissive than production.** It invoked the factory unconditionally, but `Awareness` resolves **zero recipients by design** (L91) and its call sites legitimately pass `_ => new CommunicationRequest()` — so the double forwarded an **empty** request and **manufactured a dispatch production never makes.** ‼️ **The double must model the routing RULE, not just the interface** |
| `MockAuthorizationSnapshotProvider` | ‼️ **Resolved `GetAsync` and `GetLiveAsync` from the SAME dictionary**, so every sensitive-operation assertion would have passed **whether or not the endpoint re-checked**. It gained `RegisterLive(...)` and `LiveReadCount` so a **stale cache is expressible** |
| A bare `Times.Never` on the raw dispatcher, for an `Awareness` producer | ‼️ **Proves nothing** — it sits at zero whether the producer worked perfectly or **never ran at all.** Three tests in the tree were asserting exactly that. Assert on the **business-layer request** instead |

‼️ **`requestFactory` runs ONCE PER RECIPIENT and must render in `recipient.PreferredLanguage`.** Building
the `CommunicationRequest` outside the factory ships one language to everybody — **no compiler error, no
test failure** unless a test asserts two languages.

### ‼️ Tests that pass on data production never creates

`Evaluate_CountsInvitedAlongsideActive` seeded `MembershipStatus.Invited` **membership rows** and asserted
the seat count. ‼️ **Nothing in the platform ever creates such a row** — a pending invitation is a
`BusinessInvitation` row and nothing else — so the test **passed on fictional data** while the real seat
limit was **inert** and 100 invitations against a 3-seat tier were all allowed.

> ‼️ **A green test on a shape production never creates is WORSE than no test: it actively signals
> "covered".** For every predicate a decision depends on, **grep for who WRITES that value.** A reader with
> no writer is a dead predicate.

### ‼️ When two mechanisms produce the same outcome, assert WHICH one fired

Breaking the invitation acceptance's guarded status flip left the sequential "accept twice" test **green**,
because a status pre-check catches the second attempt long before the flip runs. Worse, the first REAL-SQL
concurrency test **also stayed green**, because the filtered unique index
`UX_BusinessMembership_Business_User_Live` independently prevents the second membership.

**The fix: assert the distinguishable effect.** The losing racer must receive
`invitation_already_accepted` (the guarded flip), **not** `member_already_active` (the index catching a
duplicate insert). That distinction is also the user-facing difference, so it is **behaviour, not
implementation detail**.

### ‼️ A sabotage that bites in ONE app is a finding about your TESTS

Breaking `locationHoursState` failed **3 mobile tests and 0 web ones**, because every web test rendered the
panel directly while mobile drove it **through the rule**. The web suite gained a harness that picks the
panel from the rule as the page does, and the same sabotage then bit both.
**The app that stayed green is the one with the gap — never conclude the code is fine there.**

The escalated form is the real test: breaking `activityActor` on web failed 1 web test + 1 parity case, and
applying the same break to the **mobile twin** (as a regeneration would) **also failed the mobile SCREEN
test** — proving the screen genuinely drives the pill through the rule rather than around it.

### ‼️ Assert an exact count, not `> 0`

`StateCard` rendered its heading **TWICE** across four screens for two whole parts. The test that covered
it asserted `getAllByText(...).length > 0` — **which passes with 1 or 2.** That is exactly how it shipped
unnoticed. It now asserts **exactly 1**.

### The convention tests — they FAIL THE BUILD. Fix the call site, never the test.

| Test | Guards |
|---|---|
| `Conventions\ProviderEndpointAuthorizationTests` | admin/anonymous exclusions · `[AllowedWhenBillingOnly]` placement · every referenced permission exists **and is granted by at least one role** · ‼️ **`NoProviderEndpointAcceptsABodyThatAssertsABusinessId`** · the three `RequiresLiveAuthorization` invariants |
| `NotificationRoutingCatalogTests` | every `NotificationType` classified — ‼️ **and it keeps its OWN hand-written `BuildExpected()` map**, so a new type needs **THREE** additions. Its failure message reads as if the catalogue were stale when it is the **test** that is incomplete |
| `MemoryCacheSizeConventionTests` | every `IMemoryCache` write carries a size. ‼️ It requires **a** size, **not literally 1** — `FullProviderContextService` deliberately uses `Math.Clamp(1 + services/25, 1, 64)`. **Do not "fix" it** |
| `Conventions\RecordNumberShapeConventionTests` | ‼️ **D-108: every seeded booking/quote/invoice number is a shape `RecordNumbers` can still produce** — it scans BOTH API test projects (its own repo only, §0.17) for seeds, `Get*ByNumber*` arguments, `*Number` parameters and `[InlineData]` rows, dictionary entries and JSON fixture properties. Canonical is decided by `RecordNumbers` + `TransactionNumberNormalizer` themselves, never a pattern in the test. Seed via `TestRecordNumbers.NextBooking()/NextQuote()/NextInvoice()`, or leave the number **empty** where the repository allocates it. A hand-built or interpolated number FAILS — ‼️ and so does an id used as a number |
| `Conventions\RouteAttributesBindToPublicActionsTests` | no routing attribute on a **non-public** member |
| `CosmosTenancyContractTests` | index paths · `[JsonIgnore]` on assignment/attribution · permissions with no resource check stay `Business`-scoped |
| `CosmosCompositeIndexContractTests` | every repository file is registered in the container map |
| `TenancyConventionTests` | claim names · `UserProfile` no longer carries the four business columns · `CanGrantSeat` uses the TIER limit |
| `PermissionsAndGrants_AreCodeOnly_AndNeverSQLEntities` | the permission catalogue never returns to SQL |
| `AuthorizationNeverReadsBusinessProfileTests` | L18 — authorization never reads `BusinessProfile.UserId` |
| `EmailTemplateAssetConventionTests` | filename + token parity across all five languages |
| `tenancyRenderingParity` (mobile) | all **64** rendering rules answer identically — **286** cases |
| `tenancyLocalizationKeys` (mobile) | **every id the rules can return** resolves — 127 checks |
| `tenancyForbiddenIsNotLogout` (mobile) | 29 tenancy URLs + one unrelated 403 that **must** still sign out |
| `zeroLocationSilence` (web) | a zero-location provider never sees the word |
| `routeConfig.test.js` (admin) | **exhaustive** route map (`toEqual`) — never weaken to a subset |
| `navigationSpine` · `deepLinking` · `analyticsSurfaceRegistration` (mobile) | reachability **per stack** · Universal Links · no `surface: undefined` |

### ‼️ What EF InMemory CANNOT do — and the one thing it actively lies about

It cannot enforce a unique index, a **filtered** index, a relational constraint, EF→SQL translation, or
Cosmos atomic-PATCH semantics. **Integration tests are MANDATORY** for money, schema, unique indexes,
atomic counters, webhooks and Service Bus processors.

‼️ **Refresh cannot be unit-tested on EF InMemory AT ALL.** `RefreshTokenAsync` claims its token with
`ExecuteSqlInterpolatedAsync` inside a `try/catch` that returns `(false, null)` — so **every** InMemory
refresh test "passes" as a **rejection**, including the ones that must succeed. Six such tests were
written, failed for this reason, and moved to **real SQL over HTTP**.

### Fixture facts

- ‼️ **The API integration host has NO SQL container**, so `IAuthorizationSnapshotProvider` is **doubled**
  there (L70) — the moment the middleware began resolving a real snapshot, **487 of 1,499** integration
  tests became 500s. **Only the LOOKUP is doubled**: `TenantContextMiddleware`, `[RequiresPermission]`, the
  D9 gate, the mismatch guard and `BusinessAccessPolicy` are all **production code** in those tests. The
  SQL semantics moved to the real-SQL `"Seo SQL"` fixture.
- ‼️ **`SeoSqlFixture` is SHARED, so every real-SQL test file needs its OWN `BusinessId` prefix** —
  `E` seats · `N` provisioning + notification settings · `H` member handover · `Z` authorization.
  A shared prefix makes the tests observe each other's rows.
- ‼️ **Prefer self-relative assertions in a shared fixture.** "How many chunks hold MY suffix" is safe;
  absolute totals, `Assert.Single` and "the manifest has N chunks" are order-dependent and fail somewhere
  unrelated when a sibling class adds a test.
- ‼️ **`IdentityApiFactory.CleanupDatabaseAsync` SWALLOWS its exception.** The
  `BusinessMembership → UserProfile` `Restrict` FK made the user delete throw, and the swallow turned that
  into **55 later failures** reading *"Email is already in use"*. **Delete `Business` rows first.**
- ‼️ **`UserProfile.FirstName`/`LastName` are NOT NULL in SQL** — seeding without them fails at INSERT, not
  at compile time.
- ‼️ **A directly-constructed controller has no middleware**, so any unit test must call
  `HttpContext.AttachTenantFromClaims()` (`Helpers\TenantContextTestExtensions`). ‼️ **A claim-based
  fallback in `BaseController` was considered and REJECTED**: in production the middleware deliberately
  leaves the context unset for suspended/removed/stale members, so a fallback would hand exactly those
  callers a working `businessId`.
- ‼️ **`TestTokenHelper.GenerateBusinessOwnerToken` now stamps BOTH claims**, which is what a real provider
  token carries.
- ‼️ **Adding an OPTIONAL parameter silently breaks Moq.** It is source-compatible for callers but **not**
  for `Setup`/`Verify` expression trees — the mock stops matching and returns `default`. It broke 13 setups
  at once. Adding an **overload** breaks reflection that selects a method by name
  (`AmbiguousMatchException`).

### ‼️ RUNNING THE SUITES — four traps that produce a FALSE result

1. ‼️ **Run the four Testcontainers suites SERIALLY** — `Clinqet.API.IntegrationTests`,
   `Clinqet.Identity.IntegrationTests`, `Clinqet.Communications.IntegrationTests` and
   `Clinqet.Mcp.IntegrationTests` each start their own containers and **two at once collide on the
   Cosmos-emulator port 8081**. ‼️ **A total-failure pattern is an infrastructure signal, not a
   regression — diagnose before reporting.**
2. ‼️ **A test result is only evidence if the build that produced it returned `0 Error(s)` in the same
   step.** `dotnet test --filter` reported **`Passed! 11/11`** against a build that had just failed with 1
   error — the filter executed the **previous assembly**, so six brand-new tests **silently did not
   exist**. Chain `dotnet build … && dotnet test --no-build …`.
3. ‼️ **`grep -c` EXITS 1 WHEN THE COUNT IS ZERO**, so `dotnet build … | grep -cE ": error" && dotnet test …`
   prints `0` and **silently skips the entire test run** — a false FAILURE that reads like a broken suite.
   Chaining with `;` instead gives the inverse: a **stale assembly reporting `Passed!`**.
   **Read the build result BEFORE the test result.**
4. ‼️ **A piped build masks MSBuild's exit code.** `dotnet build a.csproj b.csproj | tail -25` reported
   **exit 0** for a build that failed with `MSB1008`. **Read the build OUTPUT, never a pipeline's exit
   code.** And ‼️ **building the production project is NOT evidence the test projects compile** — a new
   constructor parameter broke four sites the production build could not see.

### ‼️ Bulk edits — the count guard has fired FOURTEEN times

**State the EXPECTED count and fail the script when it differs. Printing the count is not enough** — one
session read past a `5` where it expected `4` and had "fixed" the fixture that must deliberately omit a
prop to prove a throw.

‼️ **The guard earns its keep most when the count is HIGHER than expected.** A low count means the edit did
not apply **and you notice**; a high count means it applied somewhere you did not intend **and you do
not**. Once it found 2 occurrences where 1 was expected — the sabotaged `case "System":` **and** the
`default:` case, which legitimately returns the same object. A blind replace would have silently broken the
default branch. **The fix is to regenerate from the source of truth, not to patch the copy.**

Causes seen: **CRLF vs LF differing between SIBLING files** (always `\r?\n`) · a different continuation
line · a wrong line number · **a backtick inside `node -e` eaten by bash** · **a heredoc broken by
apostrophes in prose** · **`perl -0pi` with one non-ASCII character corrupting `deploy.ps1` into 426 parse
errors that grep could not see.**
**Use the editor tool for source edits, then re-grep to PROVE the count.**

### Sabotage discipline

Every phase broke its own code on purpose and confirmed a test failed — **34 sabotages across the
programme.** ‼️ **A sabotage harness that cannot SEE a failure must never report a pass**: one sabotage
**PASSED against broken code** because a `Times.Never` filtered on a `NotificationType` the broken path
leaves **empty**. Another **failed to apply at all** because the file was CRLF and the pattern used `\n` —
**a sabotage that silently does not apply produces a green run that looks like proof.**

### ‼️ 2026-08-04 — three test-integrity lessons from the team-name-conflict fix (SK5)

**1. ‼️ A shared-fixture prefix must be proved against EVERY idiom, not the one you use.**
`TeamNameConflictSqlTests` first claimed **"T"** after grepping for `"T" + Interlocked` — which returned
zero. It was wrong: `BusinessTenancySqlTests` takes "T" via **`NextId("T")`**, a *parameterised* form the
grep could not match. The result was **5 failures in a file I never touched**
(`Violation of PRIMARY KEY constraint 'PK_Business' … (T000002)`), and `BusinessTenancySqlTests` **passed
33/33 in isolation** — so the failure only existed in the full run.

> **The correct check covers all forms at once:**
> ```
> grep -rhoE 'NextId\("[A-Z]+"\)|"[A-Z]+" \+ Interlocked|BusinessId = "[A-Z]+[0-9]' --include=*.cs .
> ```
> **Claimed today: D E G H N R S T U V.** This file now uses **"Q"**.
> ‼️ **A failure in a file you did not touch is a FIXTURE COLLISION until proven otherwise — run the
> suspect file alone before you believe you broke it.**

**2. ‼️ A race test must actually reach the race.** The first version seeded the target name onto a third
team, so **both** concurrent renames stopped at the `AnyAsync` pre-check and the test failed with **zero**
winners. The pre-check is precisely what the test has to get **past** to reach the unique index.
**Rename onto a name nobody holds**, so both callers pass the pre-check and the database arbitrates.

**3. ‼️ The count guard fires on YOUR OWN new code too.** The sabotage script expected **3**
`TeamNameInUse` sites and found **4** — the fourth being the rename-path catch the fix had just added.
It **refused to write** rather than half-applying. Occurrence **16** in this programme.
‼️ **And a `sed` replacement containing `&` expands to the whole match** — it corrupted the target line
into gibberish, and the file had to be restored from the backup taken first. **Use the editor tool for
source edits; take a backup before any scripted one.**

---

## PHASE 10 PART 2 — the data/schema/persistence audit closed (2026-08-05)

> Phase 10 is **DONE**. Tree green at **13,842 / 0 / 0**. Schema added: **one** owner-approved Cosmos composite
> and nothing else. Full record: `member-provider/PROGRESS.md` → *PHASE 10 PART 2*; decisions **DA7–DA12**.

### ‼️‼️ A `BusinessId` CAN NEVER EQUAL A `UserNumber` — and a build-failing guard now enforces it

**D1** makes them disjoint by construction: six characters versus five, allocated from one shared namespace. So
`u.UserNumber == businessId` is **never** true — and it fails in the quiet direction, "not found".

**Four production sites asked it anyway**, all in the payments surface. The worst was
`AdminProviderPayoutsController.BusinessExistsAsync`, where it was **not a fallback but the only check**, so
Clinket support looking up any tenancy-path provider without a payout account was told **"No business found for
that ID"** — false, on a money question. Its own comment asserted the dead invariant as fact.

- ✅ The tenant is the SQL **`Business`** row. Resolve existence from `db.Businesses`, never from `Users`.
  `Business` has **no** global query filter (**L43**), so a suspended or closed business still resolves — which
  is what an admin lookup needs.
- ‼️ **The guard:** `Clinqet.API.UnitTests.Conventions.NoCodeResolvesAPersonFromABusinessIdTests` fails the build
  on the comparison in either direction, across all seven production projects. **Fix the call site, never the
  test.** One named exemption exists (`BroadcastMatchingService`, deferred to Phase 11) and it is pinned to its
  own defect, so it cannot outlive it.
- ‼️ **How it hid:** both fixtures seeded a `UserProfile` whose `UserNumber` WAS the businessId, so the two
  identifiers could not diverge. **Casebook CASE 1 / CASE 23.**

### ‼️ The provider inbox is KEYSET-paged — never add an offset page here

`GET /business/inbox` takes **`continuationToken`**, not `page`. `InboxPageDto` carries `NextCursor` and the six
tab counts, and **no** `TotalCount` / `Page` / `PageSize`.

- `IConversationRepository.GetInboxPageAsync(businessId, InboxPageQuery)` → `ConversationKeysetPage(Items, NextCursor)`.
- SQL: `SELECT TOP n * FROM c WHERE … ORDER BY c.type, c.lastMessageAt DESC, c.id DESC`, cursor
  `(c.lastMessageAt < @cursorAt OR (c.lastMessageAt = @cursorAt AND c.id < @cursorId))`.
- ‼️ **Why the `/id` tiebreaker exists:** `(type, lastMessageAt DESC)` alone cannot separate two conversations
  written in the same tick, so a cursor repeats or skips them — **and the sort would not bind in production**
  even though the emulator permits it (L12). The composite `(type ASC, lastMessageAt DESC, id DESC)` on
  `Communications` is owner-approved (**DA5**) and is the ONLY schema Part 2 added.
- ‼️ **Why not `OFFSET`:** Cosmos charges RU for the documents an offset skips, so offset paging is
  O(page depth). `SELECT TOP (page × pageSize)` was proposed, rejected and must not return.
- ‼️ **The query NARROWS; `IResourceScopeEvaluator` DECIDES** (DA8). Only `Assigned` and `Team` become SQL
  predicates because only those paths are indexed. `Branch` / `CreatedByMe` / `Participating` get **no** query
  narrowing and are decided entirely by the evaluator, with a bounded top-up loop refilling the page.
  **Never move an access decision into the query.**
- **Overdue is unchanged** (B8): a bounded read, sorted in memory, sliced by its own `(slaDueAt, id)` cursor.
  `GetInboxTabProjectionAsync` is still a full-partition read, by the owner's explicit choice.
- Cursor encoding lives once, in `Clinqet.Infrastructure.Data.COSMOS.Base.KeysetCursor` —
  `BusinessActivityRepository` delegates to it. **Do not write a second encoder.**
- A stale or mangled cursor is **400 + `invalid_continuation_token`**, never a silent ignore (AD8).

### ‼️ The composite-index guard is now self-verifying — trust it, but know what it checks

`CosmosCompositeIndexContractTests` had drifted: **five of 53 repositories were validated against the wrong
container's index policy** (`AiSession`, `BroadcastDispatch`, `Broadcast` are **`Communications`**; `Cart` and
`RecentlyViewed` are **`SystemData`**). Three changes:

1. `TheContainerMap_MatchesTheContainerEachRepositoryActuallyResolves` derives each container from the repository
   source and fails on divergence — the hand map can no longer drift silently.
2. `EverySingleColumnOrderByQuery_HasMatchingCompositeIndex` — ‼️ **`TypeFilterSql` puts `c.type = 'X'` on every
   repository query, so a ONE-column sort still needs a `(type, sortColumn)` composite.** 27 queries validated.
3. Line comments are blanked before scanning: writing the words of a sort clause in a comment between two string
   literals was being parsed as SQL.

> ‼️ **The lesson that cost the most: a wrong guard does not merely fail to catch bugs — it PROPOSES them.**
> Acting on the mis-mapped result, the audit first deleted a correctly-indexed sort from `AiSessionRepository`.
> **Verify the guard before you change the code it accuses.**

### ‼️ OPEN — owner decisions, NOT unfinished work. Do not "fix" either unilaterally

- **`BusinessStatus.Suspended` and `.Closed` are UNREACHABLE.** `Business.Status` is written in exactly one
  place (`BusinessProvisioningService:130`, `Active`, at creation). **D9's entire billing-only regime reads a
  state nothing produces.** The admin "suspend provider" action sets `BusinessProfileStatus.Suspended` on the
  **Cosmos** profile (marketplace visibility) and never touches SQL `Business.Status` (tenancy access) — and its
  own guard leaves outstanding bookings live, which argues they are deliberately separate axes.
- **Five indexed paths serve no query** (four of them array paths, costing one index entry per element on every
  write, forever): `ProviderData` `/serviceImages/[]/imageId`, `/images/[]/imageId`, `/documents/[]/documentId`,
  `/pricing/priceType`; `Reviews` `/images/[]/imageId`; `Messages` `/attachments/[]/attachmentId`. The nested-id
  lookups are done **in memory** by `PatchStableArrayItemByIdAsync`. Removing an `IncludedPath` is RULE ZERO.

### Two sweep techniques worth reusing

- ‼️ **A C#-property orphan scan LIES about Cosmos.** Any field written by `PatchOperation.Set("/jsonPath", …)`
  looks orphaned. Scan for the **JSON name too** — it moved this sweep's result from 18 false hits to 14 real ones.
- ‼️ **Widening a race is not fixing it.** A banner test gave an offer 2 seconds of life and slept it out; a
  loaded full-suite build outlasts 2 seconds, so it failed intermittently — and its own comment recorded that the
  window had already been widened once, from 120 ms. **Remove the elapsed time, do not lengthen it.**

---

## PHASE 11 PART 2 — test-integrity lessons (2026-08-05)

### ‼️‼️ RE-VERIFY THE EVIDENCE OF AN INHERITED FINDING, NOT JUST ITS CONCLUSION (casebook CASE 26)

Phase 11 Part 1's finding F1 stated its proof as *"`grep -c "new ResolvedRecipient"` returning **1** is the
whole proof."* **There are TWO constructions** — the second is `TeamLifecycleNotifier:292`, one directory away.
Part 1 counted **within one file** and reported a **platform-wide** count.

The conclusion survived only because both constructions happen to default a blank language to `"en"`. **Had
the second not, executing the inherited fix would have shipped an unlocalized billing notification**, and the
session doing it would have believed it had a proof. Two further errors in the same finding: "30 sites" was
**31** (one wrapped across lines, invisible to a `new X(` grep) and "nine database reads" was **eleven**.

‼️ **An inherited finding arrives pre-argued** — severity, cost table, recommended fix, named guard. Nothing
in the shape of a well-written finding invites you to re-run its grep, and **the better-written it is, the
less it invites you.**

‼️ **Prefer a STRUCTURAL proof to a count.** `ResolvedRecipient.PreferredLanguage` is **`required` and
`init`-only**, so construction is the only place it can be set — that constrains every *future* site as well
as every present one, which `grep -c` never does.

### ‼️ THE COUNT GUARD EARNS ITS KEEP IN THE *HIGHER* DIRECTION

Deleting a record's 5th positional parameter meant moving 31 call sites. `, language,` appears **23** times in
`AiAddOnService` and only **15** are the target; across three files a blind `replace_all` would have corrupted
**17 unrelated call sites**.

What made the edit safe was **proving the pattern's line numbers were exactly the compiler's error line
numbers** before writing anything, then anchoring the `sed` on the line ending and re-counting the mid-line
occurrences afterwards to confirm they survived. **A low count means the edit did not apply and you notice; a
high count means it applied where you did not intend and you do not.**

### ‼️ A raw `grep -c` OVER-counts a guard by its declaration

`grep -c "IsSelfDealing("` returns **3**; the truth is **2 endpoint sites plus the `BaseController`
declaration**. CASE 25b warned that a guard factored into a per-controller helper **under**-reports; this is
the inverse, and both are fixed the same way: **open the file before filing anything.**

### ‼️ VERIFY THE GUARD BEFORE YOU CHANGE THE CODE IT ACCUSES (CASE 22)

The first draft of the F1 guard flagged `LoadUserProfileAsync` in `BookingPaymentService` and
`PaymentMethodService`. **Both are legitimate** — a CUSTOMER's own language on the Flow-B path, and Razorpay
name/email/phone prefill. The guard was too broad; **it was narrowed, and the code was left alone.**

### ‼️ A FOURTH encoded-defect test (the S8 class, now at four occurrences)

`SubscriptionBillingServiceTests:247` asserted `Assert.Equal("gu", sent!.Language)` with the comment
*"provider language, not hardcoded en"* — **asserting a field nothing ever read.** It read exactly like a
regression guard and gave false confidence that a payment-failure notice was delivered in Gujarati.

The four so far: 9A's `InvoiceServiceTests` (compared the result against the attacker-controllable input),
Part 1's ten `VoiceAssistantControllerIntegrationTests` assertions, AZ3's eight product-label tests, and this.
‼️ **When a fix turns a test red, ask FIRST whether the test was asserting the bug.**

### ‼️ A PLAN DOCUMENT SAYING "ENFORCED BY A TEST" IS A CLAIM ABOUT A TEST

`03-DECISIONS.md` L40 and the `clinqet-provider-teams` ABSOLUTE RULES both stated L19/L40 were *"enforced by
build-failing convention tests"*. **Neither existed.** `ls` the `Conventions/` directory before you trust the
sentence — this is the documentary form of CASE 20.

### Writing a permission test that cannot drift from the catalogue

Drive the caller's permission set from the **real** catalogue rather than a hand-written dictionary:

```csharp
_controller.HttpContext.AttachTenantFromClaims(
    permissions: AuthorizationSnapshotProvider.ResolvePermissions([roleKey]));
```

`BookingWritePermissionTests` uses this with `[Theory]` over `catalog_manager` / `read_only_auditor` /
`finance` / `sales_representative`, so a grant change moves the tests with it instead of leaving them
asserting a stale copy.

‼️ **And make the assertion DIRECTIONAL.** When the F2 gates were sabotaged, **10 of 13** failed and the 3
that stayed green were exactly the should-succeed cases (primary owner, technician on their **own** assigned
booking, and the customer) — which is what proves the tests refuse the right callers rather than everyone.

### Environment facts

- ‼️ **`python3` is NOT available** (`Python was not found`). Use the editor tool, or `sed` behind a pre-count
  guard that exits non-zero on a mismatch.
- ‼️ **All four `clinqetinfrastructure/Services/Payments` files are LF** while most of the tree is CRLF.
  Check `grep -c $'\r' <file>` before any scripted edit.
- ‼️ **`SubscriptionBillingService`'s constructor is now 12 arguments, not 13** (F1 removed
  `IBusinessProfileRepository`). Four unit-test `Build(...)` helpers were updated;
  **`Clinqet.API.IntegrationTests` has not been compiled against it yet.**

---

## PHASE 11 PART 4 — CONVENTION-TEST BOUNDARIES AND FOUR HARNESS TRAPS (2026-08-05)

### ‼️ A CONVENTION TEST IS A SWEEP THAT RUNS FOREVER — distrust its boundary

Casebook **CASE 29**. H3's `NoProviderEndpointAcceptsABodyThatAssertsABusinessId` enumerated
`[RequiresPermission]` actions — **structurally excluding the shared customer-and-provider endpoints where the
defect class actually lives**, because such an endpoint cannot carry the attribute at all (CASE 7).

‼️ **Ask of every guard you write or trust: what does it ENUMERATE, and can the behaviour occur outside that
enumeration?** An attribute, a directory, a file pattern and a namespace are all the WRONG boundary for a
behaviour. Where the fact can be derived from the code, derive it and assert the hand-written table against the
derivation (CASE 22).

**The registry pattern this programme now uses everywhere** — and it must fail in BOTH directions:

```csharp
var appeared = found.Except(registered);      // a new offender
var gone     = registered.Except(found);      // an exemption that outlived its reason
```

A one-directional registry rots into a list of things that used to be true.

### ‼️ FOUR HARNESS TRAPS FOUND IN THIS PART

1. **A "Seo SQL" test finishing in ONE SECOND has not run.** `SeoSqlFixture` starts a real SQL container. The
   first run of an 8-test file reported 8 passes in 1 s; watching `docker ps` during a second run showed the
   real duration was **1.36 minutes**. ‼️ **A suspiciously fast pass is a harness question, not a result.**
2. **`CachedUsageCounter` decorates `IUsageCounter` in DI.** A quota test resolving the interface measures the
   read cache rather than the atomic Cosmos PATCH. Resolve the concrete `AiUsageCounterRepository`.
   ‼️ And the two counters do **not** share an interface — lead volume has its own `ILeadUsageCounter` — so a
   theory iterating `UsageMeter` and resolving `IUsageCounter` **covers one of the two while reporting both**.
3. **A brace-walking source scanner cannot follow a lambda into its wrapper.** `TeamLifecycleNotifier` hands its
   dispatch to `SafeDispatchAsync`, whose body carries the guard. Three correctly-guarded sites are invisible to
   lexical enclosure — **register them, do not "fix" them.**
4. **A SqlClient reader fault with NO xUnit assertion in the trace is the CONTAINER, not the code.** An
   unchanged assembly returned 1,679 / 1,678+1 / 1,679 across three runs; the middle failure was
   `AffectedCountModificationCommandBatch.ConsumeResultSetAsync` **after EF had burned its three configured
   retries**. ‼️ **Diagnose it — never re-run it away — but learn the signature: a logic defect produces an
   ASSERTION.**

### ‼️ WHEN A TEST YOU JUST WROTE RETURNS AN UNEXPECTED STATUS, SUSPECT THE CODE FIRST

Casebook **CASE 29b**. A new cross-tenant matrix row expecting `403` returned **500** — a live defect
(`BookingController.CreateBooking` dereferenced a `[Required]` body member before checking `ModelState`).
‼️ **Tuning the fixture until the assertion passes is how a live defect becomes a green test.**

### ‼️ RE-RUN THE SWEEP THAT FOUND A DEFECT AGAINST THE FIXED CODE

Casebook **CASE 28**. The dead-predicate sweep that found CASE 2's seat hole **still fired** on the fixed
codebase — because L100 added the correct query *beside* the dead clause, and added the correct tests *beside*
the fictional one. **A casebook case is a DETECTOR, not a history entry. If the detector still fires, the fix
was a workaround.**

### New guards worth copying

| Guard | Shape worth reusing |
|---|---|
| `Conventions/EndpointIdentityClassificationTests` | Classifies **466 actions from SOURCE**, because the compiled attributes cannot say which identity helper an action's BODY calls; a third test asserts the source scan and the reflection scan find the same population |
| `Conventions/BusinessDispatchGuardShapeTests` | **Brace-aware**: walks UP to the enclosing `try`, then DOWN to its own `catch`. A per-file `grep -c` counts unrelated catches; a forward scan attributes a different method's |
| `Conventions/PermissionCatalogueLocalizationTests` | Derives the expected key set **from the catalogue** and diffs all five language files, in both directions |
| `Services/StatusTransitionMatrixTests` | Drives **every** (from × to × actor) cell against an **independently written** expectation — if the expectation is derived from the implementation, the test proves nothing |
| `Tests/RevocationAtomicitySqlTests` | Asserts BOTH halves of a two-part invariant, plus the **inverse** (a refused change writes neither), which is what makes the positive assertions mean something |

---

## ‼️‼️ PEER HOSTS NEVER SCAN EACH OTHER — a convention test belongs in the repo it scans (2026-08-07)

> **API / Functions / MCP / Identity are PEER HOST projects. None may reference another — in code OR in a
> test's source scan.** Core, Shared and Infrastructure are LIBRARIES every host compiles in, so a host's own
> suite scanning those is correct and needs no checkout.

**‼️ Never "fix" a cross-repo scan by adding `actions/checkout` steps for the other repos.** That was proposed
during dev-998 and rejected outright: it couples one host's build to N repos and hides the design error.

### The layout trap that caused it

Every project is its **OWN git repo**; they only sit together under `C:\Nik` on a dev machine. **CI has a
different shape**: the owning repo is checked out as **`main/`**, its .NET dependencies are **copied INSIDE
it**, and nothing else is present.

So `<root>/clinqetapi/Clinqet.API/...` — the local shape — **does not exist on CI**, and `main/` itself matches
a naive root probe that looks for a sibling like `clinqetinfrastructure`. **Anchor on markers unique to THAT
repo**, never on a sibling directory name.

‼️ **And anchor on the PROJECT FILES, never on the folder names** (`Clinqet.Mcp/Clinqet.Mcp.csproj` +
`Clinqet.Mcp.UnitTests/Clinqet.Mcp.UnitTests.csproj`, not `Clinqet.Mcp` + `Clinqet.Mcp.UnitTests`). A
`dotnet --artifacts-path` build lays its output out as `<artifacts>/bin/Clinqet.Mcp/` and
`<artifacts>/bin/Clinqet.Mcp.UnitTests/`, so a folder probe anchors on `bin` and every guard below it scans
the build output. An artifacts layout cannot contain a `.csproj`.

### What it cost: 47 of 8,672 API unit tests, all ONE defect

Five hand-rolled root finders each anchored on the local shape. Worse, three scanners wrote
`if (!Directory.Exists(dir)) continue;` — on CI they **read zero files and reported GREEN**, and
`OrphanPermissionRegistryTests` then accused **11 real permissions** of having no consumer.

> ‼️ **A guard that skips an unresolved root does not merely fail to catch bugs — it INVENTS them.**

### The rules

- **Put the guard in the repo that owns the source.** Each host gets its own copy with its **own exemption
  registry** — the mechanism may be shared, but *which sites are deliberately exempt* is per-repo policy.
- **Never `continue` past a missing scan root.** Fail loudly (`WorkspaceLayout.RequireDirectory`), or
  `Assert.SkipWhen` with a stated reason. **Never let an empty scan report success.**
- **One root resolver per suite, never one per guard.** `WorkspaceLayout` in each unit-test project owns it
  (`ApiRepoRoot` / `FunctionsRepoRoot` / `McpRepoRoot`, each with a `Try…` variant for the guards that
  legitimately skip). A private copy inside a guard is how one of them keeps the old anchor.
- **A guard spanning two artefacts by nature** (a URL composed in the backend vs the Next.js route that must
  serve it) has no home inside one repo: `Assert.SkipWhen` the peer is absent, so it runs fully on every dev
  machine and reports **Skipped** — never **Passed** — in CI.
- **Reading another host's `appsettings` to assert a config contract is NOT a project reference.** That is the
  one legitimate cross-repo test, and it is why the `clinqetfuncations` checkout exists in the API workflow.
- **A lowered floor must say where the coverage went.** `BusinessDispatchGuardShapeTests` went 33 → 18 sites
  when peer hosts left its scan; the other 15 moved to `Clinqet.Communications.UnitTests`, and the failure
  message says so. **A floor lowered silently is a coverage loss disguised as a passing test.**
- **Before deleting a guard as "unneeded", measure what it finds per repo.** `cosmosindexsetup` appeared in one
  scan with **0** hits and was correctly cut; `clinqetfuncations` carried **15** dispatch sites and had to be
  re-homed, not dropped.

### Proving a layout fix — the local layout proves NOTHING

Junction a fake CI tree and run against it:

```powershell
mklink /J "$sim\main" "C:\Nik\clinqetapi"          # CI names the owning repo "main"
mklink /J "$sim\clinqetinfrastructure" "C:\Nik\clinqetinfrastructure"   # only the repos CI really checks out
```
```bash
dotnet vstest "$sim/main/Clinqet.API.UnitTests/bin/Debug/net10.0/Clinqet.API.UnitTests.dll" \
  --TestCaseFilter:"FullyQualifiedName~Conventions"
```

Then **delete one junction and confirm the test FAILS**. If it still passes, the tree is being canonicalized
back to the real path and you have proved nothing.

### ‼️ Read the BUILD result before the TEST result

A `dotnet test --filter` after a failed build runs the **previous** assembly. It reported
`No test matches the given testcase filter` for a brand-new test that had simply failed to compile
(`Moq.Match` vs `System.Text.RegularExpressions.Match` — the funcations suite globally imports Moq and needs
`using Match = System.Text.RegularExpressions.Match;`). The other direction is worse: a stale assembly reporting
`Passed!`.

### Docker Hub is a single point of failure for EVERY Testcontainers suite

The Identity integration suite failed **385/385** with
`Get "https://registry-1.docker.io/v2/": Client.Timeout exceeded`. SQL Server, Cosmos and Azurite all come from
`mcr.microsoft.com` — the **only** Docker Hub image was `testcontainers/ryuk`, the resource reaper, and the
pre-pull step swallowed its failure with `|| true`.

> ‼️ **A total-failure pattern is an infrastructure signal, not a regression — diagnose before reporting.**

Fix: `TESTCONTAINERS_RYUK_DISABLED: 'true'` in CI. GitHub runners are ephemeral, so the reaper collects nothing
the VM teardown and the existing `docker system prune` step do not already collect.

---

## ‼️ AN ATOMIC COUNTER'S READ CACHE MUST BE MONOTONIC (CI dev-1000, 2026-08-07)

CI failed **exactly one of 1,679** API integration tests:
`CosmosTenancyIntegrationTests.ConcurrentConsumption_LosesNoIncrement` — **`Expected: 20, Actual: 19`**.

The Cosmos `PatchOperation.Increment("/count", 1)` underneath is genuinely atomic and loses nothing. But
`CachedUsageCounter.Store` did a plain `_cache.Set(key, count, …)`, and **two concurrent increments can RETURN
in a different order than they committed** — so the task holding `19` sets after the task holding `20`, and the
cache serves **19 for the whole TTL**. `IUsageCounter` gates AI usage and lead volume against tier caps, so an
under-reporting cache **lets a business past its cap**.

Fixed by storing under a lock and refusing to lower an existing value — the interface exposes only
`GetCountAsync` + `IncrementAsync` (no reset, no decrement), so the count is monotonically non-decreasing per
`(businessId, periodKey)` and refusing to lower is always correct. `Size = 1` preserved (§14).

### The transferable rules

- ‼️ **An assertion failure is a LOGIC defect; a fixture/container error is INFRASTRUCTURE.** This one carried
  real values (`Expected 20, Actual 19`) — never dismiss that as flake. Contrast the same day's Identity
  **385/385** wipe-out, which was a Docker Hub outage (`registry-1.docker.io` timeout).
- ‼️ **Check WHICH LAYER is defective before relocating a test.** A prior lesson says a quota test resolving
  `IUsageCounter` measures the cache rather than the atomic PATCH — but here the **cache was genuinely wrong**,
  so the fix was the decorator, not re-pointing the test at `AiUsageCounterRepository`.
- ‼️ **Reproduce a race DETERMINISTICALLY before believing a fix.** A Moq `SetupSequence` returning `20` then
  `19` pins out-of-order completion with no threading at all. Reverting `Store` to the plain `Set` reproduced
  the CI message **exactly** — that is the proof, not a green re-run.
- ‼️ **Looping `dotnet test` is NOT a race harness.** Back-to-back runs produced intermittent "failures" that
  were really `Bind for 0.0.0.0:8081 failed: port is already allocated` — the previous run's Cosmos emulator
  still held the port, the **assembly fixture threw**, and the test never executed (**1 ms**, no
  Expected/Actual). Between repeated integration runs:

  ```bash
  docker ps -q | xargs -r docker rm -f
  until ! (netstat -ano | grep -q ":8081 .*LISTENING"); do sleep 2; done
  ```

  **A suspiciously fast result is a harness question, not a result.**

## Integration test timeout policy (2026-08-11)

All four peer-host integration suites (Main API, Identity, MCP, Functions) use the same layered limits:

- Testcontainer startup receives a real 5-minute cancellation token in the fixture. A `TestRunParameters` value that fixture code never reads is decorative and forbidden.
- CI runs `dotnet test --blame-hang --blame-hang-timeout 6m --blame-hang-dump-type mini`.
- `TestSessionTimeout` is 1,140,000 ms (19 minutes), leaving time to finalize TRX and blame output.
- The GitHub Actions integration-test step is the outer 20-minute deadline.
- Build the solution once, then run unit and integration projects with `--no-build --no-restore`.

Keep the ordering 5 < 6 < 19 < 20. Moving an inner deadline to or beyond the GitHub step timeout loses diagnostic artifacts.

---

## ‼️‼️ SUITE SPEED (2026-08-15) — API 8m10s → 2m15s, and the traps that hid the cause

> API **1,768/0 in 2m15s** (was 8m10s) · Functions **453/0 in 3m04s** · Identity **420/0 in 1m25s**.
> Every behavioural change was sabotage-proven; production code is byte-identical after each revert.

### ‼️‼️ THE DOMINANT COST: `Program.cs` awaits preloads BEFORE `app.Run()`

`Clinqet.API/Program.cs` awaited `PreloadCategoryEmbeddingsAsync()` + `PreloadVocabularyAsync()` **before**
`app.Run()`. `WebApplicationFactory` blocks in `DeferredHostBuilder+DeferredHost.StartAsync` until Main reaches
`app.Run()`, so **EVERY host boot — the assembly fixture AND every derived `WithWebHostBuilder` host — paid the
full Azure SDK retry backoff** against an unreachable endpoint. **~45s each, ~10 boots per run.**

Gated behind **`Search:PreloadOnStartup` (default `true`, so production is unchanged)** and pinned `false` in
`ClinqetApiFactory`. **45s → 880ms per boot.** This completes the pattern the two sibling gates already used
(`Search:SpellCheck:Catalog:RefreshOnStartup`, `Suggestion:PrefixStore:Enabled`).

‼️ **Open production question:** every API cold start blocks on those preloads, so a degraded Search/Foundry
delays readiness ~45s+. Making it fire-and-forget changes production semantics — owner decision, NOT done.

### ‼️‼️ A STACK SAMPLER CANNOT SEE AN AWAIT THAT OWNS NO THREAD — reach for `dumpasync`

The signature was: blocked in `IHost.StartAsync`, **zero CPU on any thread, zero outbound TCP, zero log output**.
`dotnet-stack` found nothing, because the block was `Azure.Core.Pipeline.RetryPolicy.WaitAsync` — a retry
*backoff*. Four experiments failed to explain it; one dump did:

```
dotnet-dump collect -p <pid> -o boot.dmp --type Heap
dotnet-dump analyze boot.dmp -c "dumpasync" -c "exit"
```

- ‼️ **`dumpasync --stats` lists pending state machines but does NOT prove causality** — two chains can be
  pending independently. Plain `dumpasync` gives the nesting, and the nesting named the caller (`Program+<<Main>$>`).
- ‼️ **xUnit v3 runs tests in the test EXE** (`Clinqet.API.IntegrationTests`), **not `testhost`**. A profiler
  that filters on `testhost` attaches to the wrong process and silently finds nothing.

### ‼️ AN ELIMINATION EXPERIMENT CAN BE A FALSE DISPROOF — grep for a SECOND call site

Setting `Search:SpellCheck:Enabled=false` moved the boot by 3s, "eliminating" spell-check. **Wrong.** That flag
gates only `CatalogDictionaryRefreshHostedService`; the preload is a **second, ungated call site** into the same
`CatalogDictionaryService.RefreshAsync`. The component was guilty — only the path under test was innocent.
**Before believing a negative result, grep every caller of what you think you disabled.**

### ‼️ FIXTURES MUST NEVER CONFIGURE A RESOLVABLE HOST — `.invalid` (RFC 6761)

`ClinqetApiFactory` shipped the **real** `clinqetai.search.windows.net` and the **real**
`nikun-mcmfx84w-eastus2.cognitiveservices.azure.com`, both with real keys. Search had been deleted (NXDOMAIN) so
it only *looked* safe; **Foundry still resolved.** `IdentityApiFactory` carried three more (Telnyx, 2Factor, ACS).

Two ways it bites: an unmocked path calls production, and **a live service answering can make a broken local path
return plausible data — a green test covering nothing.**

- Every fixture endpoint is now `*.invalid`.
- Guard: **`Conventions/NoFixtureConfiguresALiveEndpointTests`**, one copy per repo (API + Identity today; peer
  hosts never scan each other, §0.15). It **derives** the endpoint list from source
  (`Endpoint|ApiUrl|BaseUrl|PublicUrl`) so a newly-added setting is caught with no one updating the test, and it
  **fails when the scan matches nothing**. Sabotage-proven.
- ‼️ It scans SOURCE at runtime, so it catches an offending change **without a rebuild**.

### ‼️ MOCKING THE INTERFACE DOES NOT COVER A CONCRETE Azure CLIENT

‼️ REWRITTEN 2026-09-21. `SearchClient`, `ProviderSearchClient` and `KnowledgeSearchClient` are GONE from DI —
the only concrete client comes from `ISearchTopology`, which every search-reading service now takes. Doubling
`IAzureSearchQuery` / `IAzureSearchIndexer` / `IAzureSearchFacetService` still leaves the ~13 direct readers with
a **real** client, because the router really does build one.

- **Unit tests** hand the service a `TestSearchTopology` (`Helpers/TestSearchTopology.cs`, one copy per test
  project): `WithServiceIndex` / `WithProviderIndex` / `WithPublicPair` / `WithPrivateCell` / `Unconfigured`. The
  slot a test is NOT exercising gets a `NotUnderTest()` client on an unresolvable host, so a misroute FAILS
  instead of quietly passing against the same mock.
- **Integration** runs the REAL router, the REAL binder and the REAL factory, and overrides only
  `SearchClientOptions` through `FastFailAiSearchClientFactory` (`Retry.MaxRetries = 0`): **80 Search/Discovery
  tests went 141s → 2s.** The call still FAILS identically, so the same production fallback branch runs and no
  assertion changed. Before this the fixture built raw clients and bypassed the factory entirely.

‼️ **COVERAGE GAP (open):** because search has always been unreachable in tests, `SearchProviders_*` and
`GetRecommendedProviders_*` (~80 tests) exercise the **failure fallback**, not search. They do **not** prove
provider search works. Mocking success would swap the branch under 80 tests — do it per-test, deliberately.

### ‼️ THE PER-TEST `WithWebHostBuilder` ANTI-PATTERN RECURRED IN FOUR CLASSES

xUnit constructs the class **per test**, so a derived host in the constructor boots a full API host every time:
`PaymentEndpoints`, `AdminBookingPayments`, `PayDirectToProvider`, `ProviderBookingPaymentStatus` —
**497s → 186s**. Timing tells you which is which: **class total ≈ its slowest test ⇒ shared; class total ≈ N×45s
⇒ per-test.**

The shape: `static` mocks + a `static` host behind a lock, `Reset()` the mocks per test.
‼️ **`Mock.Reset()` leaves `.Object` identity intact**, so the host keeps pointing at the same instance while each
test still gets a blank mock — including **zeroed invocation counts**, which `Times.Once`/`Times.Never` rely on.
The shared host is deliberately never disposed.

### ‼️ A SHARED-FIXTURE TEST MUST NOT INTERSECT OVER DATA IT DOES NOT OWN

`AdminAlertControllerTests.GetAlerts_CursorPaging_...` asserted `Assert.Empty(page1 ∩ page2)` over **every** item
on each page. It failed on an alert the class never created — a parallel sibling wrote it into the process-static
`MockAdminAlertRepository` **between the two page requests**. It had passed for months and could equally have
gone green while paging was broken.

Rewritten to seed 4 alerts into a **private 5-day-old window** and assert the **exact ids and order** — strictly
stronger than "disjoint". Sabotage (`ContinuationToken = null` in the controller) makes it fail.

### Fixture hygiene (applied to API, Functions, Identity)

- **Fixed `Task.Delay(5s)` startup sleeps → poll `ReadAccountAsync` until it answers.** Faster *and* stricter: a
  fixed sleep is a guess that is too short on a loaded runner and wasted on a fast one. Identity already had a
  poll, so its sleep was pure waste.
- Cosmos + blob container creation now concurrent, and **`catch { }` removed** (§0.3) — a swallowed creation
  failure surfaced later as unrelated-looking test failures. In Functions this path runs **per test** via
  `CleanupCosmosAsync`.
- 187 lines of dead code deleted from `ClinqetApiFactory`.
- ‼️ **All nine `.runsettings` declared `DOCKER_HOST` / `TESTCONTAINERS_RYUK_DISABLED` as `TestRunParameters` that
  NOTHING reads** — decoration that reads like Docker configuration, so a Ryuk problem "fixed" there changes
  nothing. Only the CI `env:` block works. Deleted.
- Ryuk disabled in **Functions + MCP** CI (API + Identity already had it).

### Parallelising Identity + Functions — measured, deliberately NOT done

Identity: **22 of 25 classes call the global `CleanupDatabaseAsync()` wipe**, and there are **215 hardcoded email
literals** (vs 59 unique). Functions: 43 classes, and `CleanupCosmosAsync()` **drops the whole database per test**.

‼️ **The payoff shrank as the fixture work landed** — Identity is now 1m25s, so parallelising it buys ~45s for a
215-site conversion; Functions ~2 min. The false-green shapes to hunt are `Assert.Empty` over a global query,
"no X was recorded", and any absolute count: each passes when a sibling's wipe removed the data.
**Re-derive the payoff before spending the risk.**
### The rule for NEW tests, and the three guards that now enforce the invariants

**RULE: every new integration test OWNS ITS DATA.** Unique `Guid`-suffixed ids for every key, and every assertion
scoped to those ids. Never assert a global count, `Assert.Empty` over an unfiltered query, or "nothing was sent"
against a shared store — those are the shapes that pass because a SIBLING removed the data. This is the API
suite's model and it is the target state everywhere; convert a class opportunistically when you are already in it,
never as a big-bang rewrite (rewriting hundreds of assertions in one pass is itself the likeliest way to introduce
a false green).

| Guard | Repo | Protects |
|---|---|---|
| `NoFixtureConfiguresALiveEndpointTests` | API, Identity | No fixture setting may name a resolvable host. Endpoint list is DERIVED from source, so a new setting is covered automatically |
| `WipeBasedTestsMustStaySerialTests` | Identity, Functions | Parallelism stays OFF while classes still call the global wipe. Fails in BOTH directions, so it cannot rot into a pointless pin |
| `SharedStaticSeedStoreStaysSerialTests` | API | Every class touching the process-static `MockAzureSearchQuery` store carries `[Collection("Search Serial")]` |

‼️ **The API needs the OPPOSITE guard from Identity/Functions.** The API is already parallel with **zero** global
wipes — its safety comes from tests owning their data, so a serial pin is not what protects it. What protects it
is the `Search Serial` quarantine around the one shared process-static store. Do not copy the wipe guard there.

‼️ **A source-scanning guard MUST strip line comments before it matches.** `SharedStaticSeedStoreStaysSerialTests`
**passed against sabotaged code** on its first run: the attribute had been commented out, and a raw `Contains()`
found the text inside the comment. Stripping comments both fixed that AND removed a false positive — a file whose
only mention of the mock was in prose. **Every guard in this table was sabotage-proven; the one that was not would
have shipped inert.**

---

## ‼️‼️ OWN-YOUR-DATA, PART 2 (2026-08-15) — Identity is PARALLEL; Functions is 17/42 converted

> Identity **420/0 in 57s** class-parallel (was 1m30s serial). Functions **453/0 in 2m11s** (was 4m31s), still
> serial — 25 classes deliberately keep their wipe. Every change sabotage-proven; production byte-identical.

### ‼️‼️ ISOLATION HAS TWO AXES — and clearing the DATABASE one is only half

Converting all 25 Identity classes to own-your-data made the suite green **serially**. Turning parallelism on then
exposed the second axis: **~24 assertions across 6 classes identified a message by POSITION in a shared singleton
mock** — `SentEmails.Count` captured as a before/after baseline, or `SentMessages.Last()`. Serially correct;
concurrently the window holds OTHER tests' messages, so *"an admin alert was queued"* passes because a **different
test** queued one. ‼️ **Only 2 of the ~24 failed loudly** — the rest would have gone green proving nothing.

**Parallel-safe form: filter the shared collection by something the test OWNS.** The owner keys that exist today:

| Key | Where it comes from |
|---|---|
| `NotificationMessage.RecipientId` | `AccountNotificationService:69` sets it from `RecipientUserNumber` |
| `EmailMessage/SmsMessage.AuditUserId` | producers pass `auditUserId: user.Id` |
| `.To` / `.PhoneNumber` | a Guid-unique address or a counter-minted number |
| `ServiceBusMessageRecord.MessageBody` | contains the user id (`EmailNotificationMessage.UserId`, `AdminAlertMessage.Metadata["UserId"]`, `LoginAttemptMessage.UserId`) |

Owner-filtering is usually **strictly stronger**: `Assert.Single(SentEmails.Where(e => e.AuditUserId == user.Id))`
proves *exactly one* mail reached this user, where `.Skip(n).Last()` proved only that *something* arrived.

### ‼️ THREE UNSCOPED READS THE GUARD'S REGEX CANNOT SEE

`WipeBasedTestsMustStaySerialTests` matches `Sent(Emails|Messages|Notifications)\s*\.\s*(Count|Last\s*\()`. It
cannot see these, and all three were real:

1. `Assert.Contains(mock.SentMessages, m => m.MessageType == "UserActivityMessage")` — satisfied by **any** class's
   activity message.
2. `Assert.True(mock.SentEmails.Count > 0)` — cannot fail once **any** test has sent anything.
3. `Assert.True(newMessages.Count > 0, "login attempt was recorded")` — same shape, one queue message of any type.

**Grep for every shared-mock read, not just the ones the guard names.** The guard orders the queue; reading decides.

### ‼️ `\s*` SPANS NEWLINES — a line-based grep does NOT agree with the guard

`grep -rnE "Sent(Emails|...)\s*\.\s*Last\("` returned **NONE** while the guard still failed, because the call was

```csharp
emailService.SentEmails
    .Last(x => x.To == email);
```

`Regex.IsMatch` over the whole file text matches across the newline; a line-oriented grep never can.
**Fix the shape, not the guard:** `SentEmails.Where(pred).Last()` puts the owner filter first — which is the
discipline being enforced — and no longer matches.

### ‼️ A SHARED SINGLETON MOCK BACKED BY `List<T>` IS A DATA RACE, NOT JUST A SCOPING PROBLEM

All five Identity mocks (`MockServiceBusService`, `MockEmailService`, `MockSmsService`,
`MockDeviceRegistrationService`, `MockPushNotificationService`) exposed a raw `List<T>`. Concurrent `Add` corrupts
it, and enumerating while a sibling dispatches throws *"collection was modified"*. They now mutate under a `_gate`
lock and expose `IReadOnlyList<T>` returning a **snapshot**, mirroring the API's `MockServiceBusService`.
**Do this BEFORE enabling parallelism, not after the first flake.**

### ‼️ `new Random()` FOR A UNIQUE-CONSTRAINED FIELD IS A BIRTHDAY BUG

`IdentityApiFactory` minted test phones as `$"555{new Random().Next(1000000, 9999999)}"`. Registration then **rejected**
any duplicate (`DuplicatePhoneNumber`; today only a proven one, auth-sessions §11), so ~500 users per run carried a **~1.4%** collision — surfacing as
`Failed to create test user`, which reads like a product bug. Now an `Interlocked` counter.
**Any generated value checked against a unique index must come from a counter, never from `Random`.** A seeded PROVEN phone too: a shared real-SQL fixture refuses a second active proven holder (API: `Helpers/TestPhoneNumbers`).

### ‼️ STRENGTHENING AN ASSERTION CAN ENCODE A CLAIM PRODUCTION NEVER MADE

`MockEmailService_TracksSentEmails` scanned **all** emails for a "password-related" one, then asserted ITS
recipient — and fell through to *"any email to this user"* when it found none. That fallback was the branch that
actually ran, because **the reset request sends an OTP, not a password template**
(`RequestPasswordResetAsync → SendVerificationCodeAsync`). Rewriting it to demand a password-ish subject failed —
correctly. ‼️ **When a strengthened assertion fails, ask whether the CLAIM is wrong before touching the code.**
It now asserts what production does: exactly one mail to that address, subject `MFA Code`, body `Your MFA code: `.

### Functions — what converted, and the two landmines the wipe was hiding

17 of 42 wiping classes converted (the WhatsApp store/gate/status family, Voiceline, MediaDerivativeFailureRecovery,
the four email processors, IdentityProfileSync, the two Broadcast notification/expiry classes, ChangeFeedFailureReplay,
RealtimeCallWebhook, LoginAttemptProcessor, UserActivityProcessor).

1. ‼️ **`BookingTimeoutProcessor` seeded the ONLY document in the suite with a fixed `Id` — `"CUST-1"`** — and
   **nine** other classes name `CUST-1` as the customer in their queue messages. The per-test wipe was the only
   reason a resident `CUST-1` never answered one of THEIR lookups. A scan for `^\s+Id = "[A-Za-z0-9_-]+",` (minus
   Guid lines) found it, and exactly one other.
2. ‼️ **Uniquifying it FAILED the test, and that was the point:** the processor resolves the customer from the
   **booking document's** `CustomerUserNumber`, not from the queue message. `BuildBooking` had to name the same id.
   **A seeded doc and the document that POINTS at it must be uniquified together.**

### ‼️ WHY THE FUNCTIONS SUITE IS ONLY PART-CONVERTED — and why that is correct

The largest remaining group asserts over `IAdminAlertRepository.GetRecentAlertsAsync`, a test helper that reads
**one 100-item page** across the whole container. `AdminAlertQuery` has **no `BusinessId` field**, so the read
cannot be scoped without a production/schema change (§0.7 — owner approval). Two consequences without a wipe:
`Assert.DoesNotContain(alerts, a => a.AlertType == X)` becomes a **false failure** the moment any sibling raises
that alert type, and a `Contains` can miss its own alert once >100 accumulate in the window.
**Those classes keep their wipe.** Fixing them needs a drain-all-pages helper plus per-assertion `businessId`
scoping — deliberately not done piecemeal.

‼️ **Partial conversion is SAFE by construction**: `WipeBasedTestsMustStaySerialTests` keeps parallelism OFF while
**any** class still wipes, so a half-converted suite cannot produce a fake pass. Convert in any order, at any pace.
Removing a wipe still pays even while serial — it removes a full database drop + 7 container creates **per test**
(Functions 4m31s → 2m11s from 17 classes alone).

### ‼️‼️ PARALLELISM IS CONFIGURED IN **THREE** PLACES — the csproj is the one you will miss

`integration-tests.runsettings` and `xunit.runner.json` are the obvious two. The third is the **csproj**:

```xml
<xUnitMaxParallelThreads>1</xUnitMaxParallelThreads>
<xUnitParallelizeTestCollections>false</xUnitParallelizeTestCollections>
```

‼️ **These are baked into the assembly at BUILD time**, so they are invisible to anyone reading the two obvious
files, and the effective setting becomes a question of runner **precedence** rather than intent. Identity shipped
"parallel" with the csproj still pinned to 1; aligning it took the suite **57s → 45s** with no other change.
`WipeBasedTestsMustStaySerialTests` now reads the csproj in both repos and fails if the three disagree **in either
direction**. `<BuildInParallel>` / `<MaxCpuCount>` are MSBuild **compilation** settings — unrelated, leave them.

### ‼️‼️ A REPORTING STEP WITH `continue-on-error` CAN FAIL FOREVER, GREEN

All four .NET pipelines logged `fatal: not a git repository … exit code 128` on **every** run and passed.
`actions/checkout` uses **`path: main`**, so `$GITHUB_WORKSPACE` is not a git repo, and `dorny/test-reporter` runs
`git ls-files` from its working directory. Fix: **`working-directory: main`** + `path: 'test-results/**/*.trx'` —
the action `process.chdir()`s to `working-directory` **before** reading `path` (verified in its `action.yml` and
`src/main.ts`; `working-directory:` at STEP level does nothing for a `uses:` step, only for `run:`).
**A green tick on a step that swallows its own errors is not evidence the step did anything.**

### ‼️ DRAINING A PAGED READ — and why the bound must THROW

`AdminAlertQueryHelper` read ONE 100-item page. Alerts are partitioned by **month**, so once the per-test wipe is
gone every test shares one bucket and a single page silently stops short of the caller's own alert. The helper now
follows the continuation token to exhaustion and **throws** if it fails to drain within its runaway bound —
truncating there would let a `DoesNotContain` pass on data it never read, the exact fake-pass shape.
‼️ **Do not add a `BusinessId` filter to the production query to make this easier.** `AdminAlertQuery` has no such
field; building product surface to serve tests is the wrong direction. Scope it in the test.
‼️ **Some alerts carry no BusinessId at all** — `HandleSystemFailureAsync → CreateAdminAlertAsync` never passes
one, storing a `ContextIdentifier` in metadata instead. Two alert shapes ⇒ two owner keys, so this is not a
find-and-replace.
‼️ **An unidentifiable subject cannot be owner-filtered.** A *null* message has no identity, so
`AdminAlertProcessor`'s "persisted nothing" became a **before/after delta** — it keeps the original meaning and can
never fake-pass, because a persisted alert always moves the count.

### ‼️ A SYMMETRIC SABOTAGE PROVES NOTHING

Renaming `WhatsAppSendCounterRepository.BuildId`'s private format changed the **write and the read together**, so
all 7 tests still passed. That is not evidence the tests are blind — it is a broken probe.
`PatchOperation.Increment("/count", 1 → 2)` — an **observable** behaviour change — turned **4 of 7** red, and the 3
that stayed green were exactly the ones with no multi-increment path. **Sabotage an OUTPUT, never an internal
encoding used identically on both sides.**

---

## ‼️‼️ OWN-YOUR-DATA, PART 3 (2026-08-16) — Functions is PARALLEL. Zero wipes remain anywhere

> Functions **453/0 in 22s** class-parallel (was 3m36s serial with a per-test database drop; 1m10s serial once
> the wipes were gone). All 42 classes own their data. Identity **420/0 in 45s**, API **1,768/0 in 2m15s**.
> Every change sabotage-proven; production byte-identical in both repos after each revert.

### ‼️‼️ PARALLELISM NEEDS **FOUR** PLACES IN FUNCTIONS — the fourth is the fixture, and it is not optional

The three config points are known (`integration-tests.runsettings`, `xunit.runner.json`, and the **csproj's**
build-time `<xUnitMaxParallelThreads>` / `<xUnitParallelizeTestCollections>`). The fourth is the fixture itself:

```csharp
[assembly: AssemblyFixture(typeof(Clinqet.Communications.IntegrationTests.Fixtures.FunctionAppFactory))]
```

‼️ **Setting the three config points to 4/true changes NOTHING while every class carries one
`[Collection("…")]` attribute.** `ParallelizeTestCollections` parallelises **across** collections; tests inside
one collection are serial by definition. All 57 classes shared a single collection because that is how they were
handed the `FunctionAppFactory` collection fixture. The attribute must come off every class, and only an
**assembly** fixture can then still give them one Cosmos emulator + SQL + Azurite. Identity did exactly this;
Functions had to as well.

### ‼️ AN IRREDUCIBLY GLOBAL CLAIM IS NOT RESCOPABLE — quarantine it, never weaken it

`DeviceRegistrationRetryFunction`'s timer calls `GetUnregisteredDevicesAsync(100)` — **the oldest 100 unregistered
rows in the whole table**. Two of its tests assert that set is **empty** (`MockBehavior.Strict` +
`VerifyNoOtherCalls()`). There is no per-test id that scopes "the database contains nothing": filtering to the
test's own devices makes the assertion **vacuous**, which is worse than the original. Deleting it loses the
coverage. Three things made it honest instead:

1. **Per-test self-cleanup, not a wipe.** `DisposeAsync` deletes exactly the `DeviceId`s the test recorded —
   never a sibling's row. That is own-your-data cleanup, and it is also what stops an accumulated backlog from
   pushing a later test's own 50 devices out of the 100-row batch.
2. **A serial quarantine for the only writers.** `DeviceRegistrationRetry` + `DeviceTokenCleanup` (and, since 2026-09-29, `DeviceSessionSweepIntegrationTests`, whose rows the retry sweep's retired-device job also reads) share
   `[Collection("Device Tokens Serial")]` (`DisableParallelization = true`, **no fixture of its own** — the
   assembly fixture still injects). One DeviceTokenCleanup test leaves a row unregistered for a moment while
   proving a pruned device re-registers; concurrently that window lands inside the emptiness assertion. This is
   the API suite's `[Collection("Search Serial")]` pattern, applied for correctness rather than speed.
3. **A guard test pinning the quarantine**, because losing it would not fail loudly — it would make an emptiness
   assertion *occasionally* pass for the wrong reason.

‼️ The sabotage confirmed the design: a no-op `MarkAsRegisteredWithHubAsync` turned **9** device tests red
**including both emptiness claims**, because the broken mark leaves a resident unregistered row.

**Proving a guard between a read and a write (2026-09-30).** A write that re-checks what an earlier SELECT judged (the
nightly device retire) is only proven if something changes the row in between. Build the repository on its own
`AppDbContext` with a `DbCommandInterceptor` whose `NonQueryExecutingAsync` runs the concurrent change ONCE, before the
first `UPDATE` of that table, through a second context from the factory (`DeviceSessionSweepIntegrationTests`
`BeforeFirstDeviceUpdate`). Assert the interceptor fired, or the test proves nothing. The same shape for a stale TRACKED
read: load the row in context A, change it through context B with `ExecuteUpdate`, then call the repository on A
(`DeviceTokenRepositoryIntegrationTests.UpsertAndRefresh_…`) — EF returns the stale tracked copy and skips unchanged
columns unless the code forces them modified.

### ‼️ A MID-TEST WIPE IS USUALLY A RESET — convert it to a DELTA

`NotificationRoutingIntegrationTests` called `CleanupCosmosAsync()` **inside** two tests, purely to zero the
counts between two dispatch phases (`Assert.Equal(1, Count(member))` twice). The read was already scoped to a
Guid-minted recipient partition; only the *reset* needed the wipe. Capturing `before` and asserting
`before[x] + 1` keeps the claim ("this dispatch reached exactly these two") verbatim, needs no reset, and cannot
be perturbed by a sibling. **A wipe used as a reset is the easiest kind to remove — look for it before assuming
a class is hard.**

### ‼️ A LITERAL ARRIVING THROUGH A LOCAL VARIABLE IS INVISIBLE TO THE FIXED-ID GREP

The recorded scan `grep -rnE '^\s+Id = "[A-Za-z0-9_-]+",' | grep -v Guid` reported **0 hits** — and it was right.
`BookingAutoCompletionProcessor` still **created a `Customer` document under the fixed id `"CUST-1"`** in two
tests, because the literal reached `Id =` through `var customerId = "CUST-1";`. Consequences without the wipe:
the second `CreateCustomerAsync` **conflicts**, and the nine other classes naming CUST-1 in a booking start
resolving that document. **Grep the literal itself across the suite, not the assignment shape.**

### The collision classes a shared store exposes, and the namespace that fixes each

| Shape | Where it bit | Fix |
|---|---|---|
| Two classes running the **same counter format** for a UNIQUE-indexed column | `DeviceTokenCleanup` and `DeviceRegistrationRetry` both minted `"U"+4-base36` `UserNumber`s | one prefix per class — cleanup took **"K"**, the session sweep **"S"** |
| `Random.Shared` for a **document key** | `InboundReply` minted contact phones; a repeat makes two tests share one contact | `Interlocked` counter in a range the class owns |
| A **fixed phone shared by two tests in one class** | `WhatsAppInbound` used `+15557778888` twice; the contact doc is keyed by phone | counter in its own **+1557** range |
| A **hash-derived bucket id** with a pinned clock | `NotificationDigest`'s bucket hashes `(businessId, userNumber, category, channel, windowStart)` and `FixedTimeProvider` pins the window ⇒ every test in the class shared ONE bucket and their event counts added up | per-test `businessId` |

**Phone ranges now claimed:** `+1416` InboundReply · `+1555` VoicelineRepository + WhatsAppPendingInboundStore ·
`+1557` WhatsAppInbound · `+1888` RealtimeCallWebhook · `+1999555` VoiceCallControl.

### ‼️ TWO BROKEN PROBES IN ONE SESSION — a sabotage that does not apply looks exactly like a passing test

1. **The repository overwrote the field being sabotaged.** Making `NotificationProcessor` persist a second
   document via `notification.Id += "-dup"` bit **nothing** — `CreateIfAbsentAsync` **assigns**
   `notification.Id = $"{UserNumber}_{NotificationId}"` before writing, so the mutation was discarded and the
   second create merely conflicted. Mutating `NotificationId` instead turned **6** NotificationRouting tests red,
   including both new deltas. **Read the write path before choosing the field to corrupt.**
2. **`perl -0pi -e` silently did not match** a CRLF file, and the grep that "confirmed" it was matching a
   different line. Use the editor tool for source edits and re-read the region.
3. ‼️ **A `cd` inside a compound command made `dotnet test` exit 1 with `MSB1009: Project file does not exist`** —
   which reads exactly like the guard failing. **Twice.** An exit code is not a result; read the output.

### The guard now checks three files and pins the quarantine

`WipeBasedTestsMustStaySerialTests` (Functions) previously read only the runsettings + csproj. It now also reads
**`xunit.runner.json`** (the Identity copy already did), asserts the three agree **in both directions**, strips
line comments before matching the wipe names (so a class *explaining* why it no longer wipes cannot pin the suite
serial forever), and carries a second test asserting both device-token classes still declare the serial
collection. All three failure modes were sabotage-proven: re-adding a wipe names the offender; setting the runner
json back to 1 thread while the csproj says 4 fails the agreement assert; deleting the quarantine attribute fails
the second test.

‼️ **It no longer reads `DisableParallelization` out of the fixture source.** That flag still appears there —
it is now the device-token quarantine — so treating it as "the suite is serial" would have made the guard
permanently wrong. **When a signal changes meaning, a guard that still reads it is worse than one that does not.**

### ‼️‼️ ONE SABOTAGE PROBE PER **BRANCH**, NOT PER METHOD

`BookingReminderProcessor` resolves the customer into a local that starts `null`:

```csharp
string? customerPreferenceLookupUserId = null;          // probe A lands here
if (…) { var customer = …; if (customer != null) {
        customerPreferenceLookupUserId = customer.UserId;   // probe B must land HERE
```

Corrupting the **declaration** turned only the `Assert.Null(...)` test red. The other test *finds* a customer,
so the assignment **overwrote the sabotage before the assertion ever saw it** — that test stayed green while
its (recently changed) assertion was entirely unproven. A second probe on the assignment line turned it red,
and the failure message named the per-test id, confirming the changed assertion was the one that bit.
**A single red does not mean the method is covered; enumerate the branches the assertions actually traverse.**

### Housekeeping the conversion leaves behind

When the last class stops wiping, the fixture's `CleanupCosmosAsync` / `CleanupDatabaseAsync` become **dead
code with zero callers** — delete them (§22.2), and re-read every comment that mentions them: the one on
`PreCreateCosmosContainersAsync` still said it "runs per test via CleanupCosmosAsync", which is a false claim
about the code the moment the last wipe goes. The guard keeps working because it scans the **test** sources for
those names, so a re-introduced call site is still caught.

‼️ **CI inherits parallelism for free here, but check it.** `_build.yml` passes
`--settings …/integration-tests.runsettings`, and the csproj + `xunit.runner.json` travel with the build — so
all three config points apply on the runner. **Confirm this rather than assume it**: the owner has previously
caught a suite that was "parallel" locally and unchanged in DevOps.
---

## ‼️ THE VOICE ASSIGN-NUMBER PATH NEEDS REAL SQL — the API fixture's "no SQL container" is not a promise (2026-09-19)

`VoiceAssistantControllerIntegrationTests` failed **31 of 59** with
`BadRequest: {"message":"The ConnectionString property has not been initialized."}` on a clean tree. The cause was
**not** the doubled `IAiAddOnService` billing gate (that mock already existed): `VoiceAssistantService.AssignNumberAsync`
calls `IMinuteLedgerService.ProjectCapToVoicelineAsync`, which SUMs the **SQL** `MinuteLedgers` table before patching
`Voiceline.MonthlyMinuteCap`. The Cosmos-only host has no connection string, so the whole endpoint threw.

- The class now joins **`[Collection("Payments SQL")]`** and re-points the pooled `AppDbContext` at that fixture's
  migrated container in **ONE static derived host** (`RemoveAppDbContext()` + `AddAppDbContextPooled(UseSqlServer(...))`),
  the `ReceiptEndpointIntegrationTests` shape. **No third SQL container** — a 2-core/7 GB CI runner already carries
  Cosmos + Azurite + one SQL.
- `SeedProfileAsync` writes one `IncludedGrant` `MinuteLedger` row (**137 minutes — deliberately not round**), because a
  provider invited to the assistant has bought the add-on. `usage.MonthlyMinuteCap` now asserts **exactly 137** where it
  used to assert `> 0`, which proves the ledger→voiceline projection end to end instead of tolerating any default.
- ‼️ **Mocking the narrow seam was the wrong instinct here.** §0.8 names "minute-ledger→Voiceline projection" as a path
  that MUST be proven against a real engine; a `Mock<IMinuteLedgerService>` would have made the suite green while
  covering nothing.
- ‼️ **A derived host has its OWN DI container**, so every `_factory.Services` in the class must move with it — including
  helpers typed to `ClinqetApiFactory` (`VoiceOwnNumberConfigTestHelper` was widened to `WebApplicationFactory<Program>`).
  Resolving a mock from the base factory while the requests run on the derived one drives a singleton nobody reads.

### ‼️ A WHITE-BOX CACHE KEY OUTLIVES THE CACHE — assert the behaviour, not the key

`BusinessProfileControllerTests.UpdateBusinessAddresses_..._InvalidatesCachedEntitlementRegion` primed
`entitlements_{businessId}` in the singleton `IMemoryCache` and asserted the address write evicted it. It failed because
**`EntitlementService` deliberately stopped snapshotting a provider's entitlements** (the Functions host owns those rows
and this host's cache can never reach them) — so nothing writes that key, nothing removes it, and the test was pinning a
mechanism that no longer exists while the guarantee got *stronger*.

Rewritten black-box: resolve `ICountryResolutionService` (the seam `EntitlementService` derives its region from) before
and after the address PUT and assert the ISO-2 flips. It seeds its **own** two `country` lookup rows with per-test names —
the whole `country` partition is read to match an address, so a real country name lets a sibling class's row answer.


---

## ‼️ A LOCALIZATION DOUBLE THAT RETURNS THE KEY IS PRODUCTION'S ANSWER FOR A KEY IT LACKS (2026-09-19)

`LocalizationService` answers an **unknown key VERBATIM**. So
`Setup(x => x.GetLocalizedString(...)).Returns((key, _) => key)` is not a neutral stub — it is *exactly* what
production does when the catalogue is missing the key. Any controller that decides something by asking
"did this message resolve?" therefore sees **every** key as missing, and every assertion about which answer it
gave is vacuous.

- Classes exercising `BaseController.ResolveCallerFailure` use **`Helpers/TestLocalization.Real`**, a real
  `LocalizationService` over the real `en.json` **from the test project's own output directory** — no path leaves
  the repo (§0.17). One copy per repo; Identity has its own.
- Assertions then compare against `TestLocalization.En("Error_X")`, which proves the controller **localized** the
  key rather than echoing it. `Assert.Equal("Error_X", response.Message)` was asserting the unlocalized key
  reaching the caller — the encoded-defect shape.
- ‼️ **Do NOT convert every double.** Converting all 70 in the API suite broke 62 tests and was reverted: most
  classes use the identity double **deliberately**, to assert WHICH KEY was chosen (notification body keys, tool
  refusal keys, rendering rules). That is a legitimate and useful idiom. Convert only the classes the rule touches
  — the suite names them precisely.

### Three assertion traps this exposed

1. ‼️ **`Assert.Throws<T>` is EXACT.** A refusal that gained a derived type (`LocalizedRefusalException` :
   `InvalidOperationException`) fails it, although every real `catch` still matches. The fix is to assert the
   derived type **and its `MessageKey`** — strictly stronger than the original.
2. ‼️ **`Assert.IsType<ObjectResult>` fails on `NotFoundObjectResult`.** Returning idiomatic typed results from a
   shared handler is the right production change; the assertions become the specific type, not looser.
3. ‼️ **A fixture that throws a message production never throws proves nothing.** Several tests threw
   `new InvalidOperationException("Customer already exists")` — a sentence no service emits. They now throw what
   the service throws, so the fixture and production cannot drift.

### ‼️ The audit's most useful finding was in my own change

The allocation budget was rewritten as `Calls / 100` = **1,000 bytes** — *stricter* than the 1,024 it replaced, so
the flake it was meant to fix would still fire. It is `Calls / 2` ("half a byte per call"), and sabotage measures
**48 bytes per call**, failing by 96×. **Re-read the number a refactor produces, not the intent behind it.**

### Scripted-edit traps that cost time here

- `perl -0ne 'print scalar(() = /…/g)'` with **two capture groups counts 2 per match** — a 7-match pattern reported
  14 and tripped the count guard. Use a `while (/…/g) { $c++ }` loop.
- A non-anchored replacement landed on the **first of two identical call sites**: it rewrote
  `ConvertCustomToGlobalAsync_NotFound_Throws` while meaning `_NotCustom_Throws`, and the suite caught it only
  because the two expectations were incompatible. **Anchor on the test name, not the call.**
- `$"` inside a `perl -0pi -e` replacement is the `$"` special variable and silently eats the interpolation; a
  `'\'` char literal in a quoted heredoc becomes `'\'`. **Use the editor tool for anything with escapes.**


---

## ‼️ THE SEARCH TOPOLOGY ROUTER (search-topology Phase 1, 2026-09-21)

**No code outside `Clinqet.Infrastructure.Services.Search.Topology` may name a search endpoint or an index
alias.** Every read and every write resolves a route from `ISearchTopology` (`clinqetcore/Interfaces/Search/ISearchTopology.cs`):

| Call | Answers | Use it for |
|---|---|---|
| `ResolvePublic(countryName)` | a `PublicRoute` of `PublicIndexPair` (services + providers client, country code, `Launching`/`Live`) | marketplace search, SEO, banners, the broadcast matcher, the service/provider indexers |
| `ResolvePrivate(businessId)` | a `PrivateRoute` (`CatalogClient`, `KnowledgeClient`, both NULLABLE) | the phone receptionist, Ask Clinket, the knowledge indexer |
| `EnumeratePlane(SearchPlane)` | every index of that plane | global scans: health checks, the audit function, the suggestion prefix scan, the spell-dictionary refresh |
| `EnumerateForBusiness(businessId)` | every index a business can be in, both planes | teardown / cascade delete |

- `route.Single` THROWS when a route carries more or fewer than one pair — a single-query reader handed a
  fan-out must fail, never silently read the first index. A global scan enumerates instead.
- `PublicRoute` and `PrivateRoute` are **distinct types on purpose**: Phase 0 measured the two planes needing
  OPPOSITE vector algorithms (tenant filter ⇒ exhaustive 2.8× faster; country filter ⇒ HNSW 2.1× faster), so a
  misroute is a 2× regression the compiler now prevents.
- **A nullable private client means the stamp has AI Search unprovisioned** — `deploy.ps1` writes the endpoint
  as an EMPTY STRING there. Readers degrade to their Cosmos leg; the host still boots.
- `AiSearchClientFactory` is the ONLY place a `SearchClient` is constructed and the router is its only caller.
  Both facts are pinned by `SearchTopologyConventionTests` in **each host's own** unit suite (§0.15/§0.17), with
  its own exemption registry and a zero-hit guard so an unresolved root fails loudly instead of reporting green.
- Settings: `Search:Topology:Services:{Public,Private}:{Endpoint,ApiKey}`,
  `Search:Topology:Public:Countries:<ISO2>:{ServiceAlias,ProviderAlias,Status}`,
  `Search:Topology:Private:Cells:<cellId>:{CatalogAlias,KnowledgeAlias}`, `Search:Topology:Private:OpenCells`.
  ‼️ **The base appsettings of every host ships NO countries and a BLANK endpoint**: the .NET binder MERGES a
  dictionary rather than replacing it, so a non-empty base would widen whatever the per-stamp file sets.
- `AddSearchTopology(configuration, requiresPublicPlane)` binds, `ValidateOnStart`s and registers the router,
  its alarm, the alias-not-found policy and a `SearchTopologyPlaneScope`. MCP passes **false** (private plane
  only). Validation refuses to boot on: an empty country list, an unparseable ISO key, a blank alias, one alias
  for both grains, a duplicate alias across countries, no private cell, an `OpenCells` entry naming no cell, a
  `CrossBorderPairs` entry naming an unserved country or itself.
- ‼️ **`Search:Topology:Public:Countries` means "the countries that have their OWN index pair on this stamp"**,
  not "the countries this stamp serves" — the permanent definition that makes the duplicate-alias guard
  unambiguous in every phase (PLAN §5.4.1, E73).
- A configured alias that does NOT exist answers 404 forever and every reader treats empty as legitimately
  empty. `SearchAliasNotFoundPolicy` (PerCall, so it sees the outcome the caller sees) raises one Critical
  `AdminAlertType.SearchTopologyMisconfigured` at first use, **excluding `GetDocumentAsync`'s 404**, which is
  the normal answer for a document not indexed yet.
- The unconfigured-plane alarm fires only for a plane this host READS and that has something to serve — MCP's
  permanently-blank public endpoint is the design, and alerting on it would be a Critical on every healthy boot.
- Clients are cached per **(endpoint, API key, alias)** for the process lifetime, built through a
  `Lazy<SearchClient>` in `ExecutionAndPublication` mode. The key includes the API key because two planes may
  share a host and hold different keys.
- **Tests**: `TestSearchTopology` (one copy per test project; a hand-built `ISearchTopology`, deliberately not
  a Moq double) gives a service the route it needs in one line. The slot a test is NOT exercising gets a
  `NotUnderTest()` client pointing at an unresolvable host, so a misroute FAILS instead of quietly passing.

### ‼️ PHASE 2 — THE PRIVATE PLANE IS ITS OWN INDEX NOW (2026-09-22)

The private catalogue and the private knowledge index are **no longer the public indexes under another name**.
`cosmosindexsetup` creates one pair per cell — `private-catalog-<cell><env>` / `private-knowledge-<cell><env>` —
and `deploy.ps1`'s `Add-SearchTopologySettings` points every host at them from one `$privateSearchCells` list.
‼️ The cell comes BEFORE the environment in the name; suffixing the grain first produced `private-catalog-dev-cell1`,
which no host's alias-shape guard recognises.

**Which cell a business lives on** is `BusinessProfile.searchCell`, written once at profile creation by
`ISearchCellAllocator` (SHA-256 of the business id over the OPEN cells — never `GetHashCode`, which is randomised
per process). `ISearchCellDirectory` is the only thing that reads it: a singleton, `IMemoryCache` (`Size = 1`),
single-flight per business, 15 min for a found cell / 30 s unassigned / 10 s unavailable.
‼️ **A failed lookup is `Unavailable`, NEVER `NotAssigned`** — a Cosmos blip read as "no cell" would fail every
tenant closed for a whole cache window and the repair would be the wrong one. A cell this stamp does not
configure is **refused, never substituted**: answering from another cell reads and writes another tenant's shelf.
Callers that already hold the profile call `Remember(businessId, cell)`, so the write path costs no extra read.

**The two planes hold DIFFERENT populations (D-35).** The private catalogue holds **every service that still
exists** — pending and inactive included, each carrying `approvalStatus` and `isActive` — so "not sellable" is a
FILTER (`isActive eq true and approvalStatus eq 'Approved'`), never a missing row. The public index keeps
membership-by-ABSENCE. `ServiceIndexGates.BelongsInPrivateCatalog(isDeleted)` and `IsIndexable(...)` are the two
rules, and only a DELETED service leaves the private plane.

- **One document class, two materialisations.** `ServiceSearchDocumentProjector.ForPrivateCatalog` /
  `ForPublicServiceRows`. ‼️ Azure rejects the WHOLE batch with 400 when a document carries a field the index does
  not declare, so every field a plane does not declare must be nullable AND `JsonIgnore(WhenWritingNull)` —
  pinned by `SearchPlaneConventionTests`.
- **The receptionist's second lock (D-36)**: every returned row is checked against the scope the filter
  promised, on the lookup leg AND the expert-check candidate leg. One bad row discards the whole set and alarms.
- **`find_services` and `answer_catalog_question` state the same facts as the embedded profile** —
  `VoiceServiceCardFields` declares the model-visible keys and names every deliberate divergence; the parity
  test lives in `Clinqet.Communications.UnitTests`. ‼️ `CatalogLookupItem.Price` is `[JsonIgnore]`d: the
  structured amounts are the SCREEN's shape, and a model given `fixedPrice: 80` beside `chargePerVisit: 40`
  states 120. The ear gets `priceText` + `extraChargesText`, composed by `CatalogPriceNarrator`.
- **Ask Clinket's `search_services` runs ONE leg** (D-6). The paired Cosmos `CONTAINS` leg is gone with
  `CatalogLookupQuery.UnapprovedOnly` — the index now holds the drafts that leg existed for.

**The AI cache (D-21/D-29/D-60)** lives in the EXISTING `provider-knowledge` container under
`{businessId}/ai-cache/…`, so it adds no Azure resource and the business-closure prefix purge already sweeps it.
`ISearchAiCacheStore` holds the enrichment text, the vector and the content hashes; a rebuild that hits it makes
**zero model calls**. Invariants: the artifact is durable BEFORE any index write (I1); a write lock is a blob
LEASE, **per business** for services and **per document** for knowledge (D-60), with a `Lost` token that cancels
a rebuild whose lease expired. ‼️ The lease registry is keyed by **blob name**, and the store looks the lease up
itself — the knowledge lane leases the very blob it then writes, so a caller-supplied key would 412 every ingest.
A 404 is a MISS; a transport failure THROWS. The miss rate alerts on a **tumbling window**, never a lifetime
total, or a long-lived host could never notice a purged container.

**The nightly audit is a ROTATION SWEEP (D-51).** The old index↔index scan is deleted: it never read Cosmos, so
it could not see "Cosmos has a service the index never received", and above 5,000 providers it skipped its own
check while reporting all-clear. Now: `SELECT TOP (batch) FROM Business WHERE Id > @cursor ORDER BY Id`
(a clustered-PK seek), one single-partition Cosmos read + one per-business query per plane + the artifact check,
with `batch = ceil(total / SearchAudit:TargetCoverageDays)` capped by `MaxBusinessesPerRun`. The cursor is ONE
`SearchAuditWatermark` in `SystemData` (id `search_audit_watermark`, pk `system`), advanced only after a batch
fully succeeds. ‼️ **When the ceiling binds an admin alert states the REAL coverage period** — it must never go
quiet, which is exactly how the old one failed. Closed and Suspended businesses are expected to hold ZERO
documents in both planes, so the sweep is also a standing check that closures completed.

**Admin health** (`GET /admin/search/health`) now enumerates BOTH planes and each row carries its `plane`: a
stamp whose private cells are unreachable answers no phone calls at all while the marketplace looks fine.

### ‼️ 2026-09-22 — THERE IS NO SECOND CATALOGUE STORE, AND THE PRIVATE PLANE IS EXHAUSTIVE EVERYWHERE

**The Cosmos fall-through on every catalogue search path is DELETED** (owner, amending D-33). It matched raw
substrings on `name` and `description` alone: measured live, *"skid steers"* found **0 offerings where the index
found 43** — and it then handed the model a `None` result whose note says *"Tell the caller warmly that you
cannot find that one."* A broken search became the business denying its own stock, and nobody could see it,
because a partial answer reads exactly like a complete one.

- **What a caller hears now**: *"I can't check right now — let me take a message."* `VoiceCatalogSource.Cosmos`
  is renamed **`Unavailable`**; `LookupAsync` ends `result ??= Unavailable()`; `RetrieveCandidatesAsync`
  returns `[]`, which `ProviderCatalogAnswerService` already maps to the same thing.
- **‼️ AND AN ADMIN ALERT IS MANDATORY** (owner: *"that is a must"*). `ICatalogAlarm.RaiseCatalogueUnreachable`
  is implemented in all three hosts. It is **silent when `IndexAvailable` is false** — an unprovisioned stamp
  is configuration, not an outage, and alerting there would Critical on every healthy boot.
- **Deleted with it**: `IServiceRepository.SearchPublicCatalogAsync`, `CatalogRepositoryQuery`,
  `CatalogRepositoryPage`, `BuildCatalogPredicate`, `BuildPriceClause`, and the `Voice:Catalog:CosmosFallbackMaxScan`
  setting from all three hosts. `LoadNearestGroupsAsync` is an index **facet** now — the last Cosmos read on a
  search path, at 30–41 RU a call.
- **The only repository call left** on that path is `GetGlobalCategoriesAsync`, which is CACHED and is a
  SECURITY control: the model's group name is resolved to an id we own, so model text never reaches a filter.

**‼️ BOTH private indexes are `exhaustiveKnn`, uncompressed — the knowledge one was not, for a whole phase.**
`KnowledgeSearchIndexInitializer` takes no plane parameter (every knowledge index is a private-cell index), so
it silently built the PUBLIC plane's HNSW + `bq-mrl`. Exhaustive KNN **cannot rescore**, and rescoring against
the full-precision originals is the whole mechanism that makes binary quantisation safe — without it recall@10
fell to 68 % here. The private plane's vector configuration now lives in ONE place,
**`cosmosindexsetup\PrivateVectorSearch.cs`**, which both initializers read.

**‼️ A cell alias is a PRIVATE alias.** All three hosts had shipped
`Cells.cell1.CatalogAlias = "clinket-dev"` — the customer-facing index. `PrivateCellAliasConventionTests`
(one copy per host) now fails on that. `deploy.ps1` was always right: `private-catalog-$cell$EnvSuffix`.

**D-2 GATE 2 IS CLOSED — PASS** (`Data\search-topology\findings\PHASE-2-QUALITY-PARITY.md`). 1,335 cards from
87 real documents, two indexes differing only in the vector configuration: recall IDENTICAL, MRR within 0.5 %,
sign test **p = 1.000**, and the private arm uses ZERO vector-index quota. The gate was proven able to FAIL.

**Two traps this phase paid for, which will be laid again:**

1. **A counter on a SCOPED service cannot say "on this host".** `_consecutiveCatalogueUnreachable` was an
   instance field, so a stamp-wide outage reported *"1 in a row"* five hundred times. Static now.
2. **A name in a guard's registry is not evidence.** `IndexCoverageMinRatio` named a reader that IS compiled
   into the API host — but its only caller is registered ONLY in Functions, so the API tuned a value nothing
   read, for months, with a written reason for the divergence.

## Patterns proven in search-topology Phase 3 (2026-09-24)

- **A REAL `SearchClient` over a fake transport** beats a Moq double when the code deserializes into a private
  type or builds filters: `new SearchClient(uri, index, new AzureKeyCredential("unit"), new SearchClientOptions
  { Retry = { MaxRetries = 0 }, Transport = new HttpClientTransport(new HttpClient(handler)) })`, the handler
  reading the request body's `filter` / `top`. `OfferExpirySweepFunctionTests.FakeIndex` even applies the
  code's own `not search.in(...)` exclusion, so a multi-round loop is exercised as the service would answer it.
- **Wait on a fire-and-forget with a `TaskCompletionSource` set in the mock's callback**, awaited with a generous
  bound (`WaitAsync(30 s)`) — never a short polling loop that silently returns and lets a `Verify` race the work.
- **An `Assert.All` over a collection that can be empty proves nothing** — assert `NotEmpty` first (the
  suggestion-filter test's vector leg).
- **Only the emulator evaluates a Cosmos patch CONDITION or a TTL** — write-once (`firstPublishedAt`) and soft
  delete (`isDeleted` + `ttl`) are proven in integration suites, including a concurrent-writers race.
- **A fixed future date in a test is a time bomb** (the MCP `create_booking` test died the day after its date):
  compute dates from `DateTime.UtcNow`.
- **Sabotage without git** (§0.19): copy the file to the scratchpad, break it with the Edit tool, run the
  targeted tests, reverse the edit, and `cmp` against the copy — every fix in Phase 3 was proven this way.

---

## Lessons from the voice number lifecycle audit (2026-10-02)

- **A test double must behave like the real store.** Two in-memory inventories set the ETag on the written
  instance while the real repository did not; every test passed and every second write would have failed in
  production. Prove a double's contract on the real engine at least once.
- **Boot the real host.** A convention test that fakes outside dependencies cannot see a missing registration:
  the API host could not start and no unit test knew. Run one integration test per host after any DI change.
- **Run the integration suite after a contract change, not only the unit suite.** An endpoint suite that was
  never re-run hid a start-up failure and five stale expectations.
- **Break the fix, watch the test fail.** A sabotage round found two new tests that passed against broken code
  (the "other writer" was injected at the wrong moment; an ETag was never asserted on the written instance).
- **Restoring a file by copy keeps its old timestamp** — touch it, or the build reuses the broken binary.
- **The emulator treats page size as a hint and runs sorted queries no composite covers.** Pin SQL text and
  page-filling behaviour in unit tests with a mocked `Container`.
- Per-test isolation for a partition-wide read: `VoiceNumberSandbox` creates a SystemData container of its own
  from the production policy and deletes it afterwards.
