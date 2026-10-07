---
name: clinqet-voice-assistant
description: |
  **CORE FEATURE SKILL** — Work on the Voice AI Assistant (AI phone receptionist)
  end-to-end. This is the INBOUND-CALL / telephony AI: a caller dials the provider's
  dedicated Clinket number, the line rings the provider first, and if they miss it
  (or it is outside business hours / they decline / hang up mid-call) an Azure
  GPT-Realtime voice agent takes over, answers in the caller's language, and can book,
  quote, verify, take messages and send WhatsApp/email — all via a brand-new dedicated
  MCP server (clinqetmcp / Clinqet.Mcp) that exposes Clinqet operations as MCP tools.
  Two telephony regions behind one VoiceCarrier seam: **Telnyx = Canada/US** (imperative
  Call Control + bridge/AMD join, shipped + the parity spec), **Plivo = India** (shipped — GA;
  MPC + ai-agent member + a WSS AI-media relay, behind the same seam). A live MCP monitor streams the transcript to the provider over SignalR; the
  provider can barge-in / join the live call from the browser (Telnyx WebRTC) or by phone.
  Post-call, a function summarizes every call, produces follow-up suggestions, and meters
  usage. Distinct from `clinqet-ai-assistant`, which is the in-app TEXT/voice CHAT assistant.
  USE FOR: MCP server (clinqetmcp) tools/auth/rate-limit/audit, per-call token + binding
  doc auth, the inbound call state machine (Telnyx VoiceCallControlFunction; India =
  PlivoVoiceCallControlFunction + PlivoVoiceRelay), AI-takeover triggers (HoursMode), the realtime "first prompt"
  (RealtimeSessionPayloadBuilder) + Azure realtime accept webhook, the live monitor
  (VoiceSessionMonitor) + provider-join/barge-in/transfer, SignalR live streaming, post-call
  summary + suggestions + usage (VoicePostCallProcessorFunction), provider setup lifecycle
  (admin invite → application → number provisioning → Active), call recording / Call
  Follow-ups UI, number provisioning (Telnyx + Plivo), OTP verification, deployment of the
  MCP App Service per region. Applies to: clinqetmcp/** (whole project), clinqetfuncations/
  Clinqet.Communications/Functions/Voice*.cs + RealtimeCallWebhookFunction.cs +
  Services/McpSessionSignalClient.cs + Services/PlivoRelaySupervisor.cs,
  clinqetinfrastructure/Services/Voice/** + Services/Communication/{Telnyx*,Plivo*}.cs,
  clinqetapi Controllers/Voice/** + Controllers/Admin/AdminVoiceAssistantController.cs +
  Services/VoiceLiveCallClient.cs, clinqetcore/Entities/COSMOS/{VoiceCallSession,Voiceline,
  VoiceAssistantState,VoiceBusinessLiveCall,VoiceTranscript}.cs, clinqetshared Enums/Voice*.cs
  + Models/{VoiceCallSettings,AzureRealtimeSettings,VoiceAssistantSettings,TelnyxSettings}.cs
  + DTOs/Voice/**, clinqetwebpartnerapp voiceAssistant + callFollowUps UI,
  clinqetwebadmin voice UI, azureautomation (MCP App Service + carrier provisioning).
---

> ‼️ **SUPERSEDED IN PART (2026-09-02) — the in-app CHAT assistant was DELETED.**
> `POST /api/v1/ai/chat`, its three `ai/sessions` endpoints, `IMcpAIService`/`McpAIService`,
> `IMcpToolGateway`/`McpToolGateway`, `ChatToolSessions`, `Mcp:ChatToolAllowlist`, the chat branch in the
> MCP's `McpToolGuard` and both repos' `ChatToolAllowlistConventionTests` no longer exist. Every passage
> below describing the chat assistant, its tool gateway or its allowlist is HISTORY, not current behaviour.
> The provider-facing replacement is **Business Search** — see `clinqet-business-search`.
> Still live and unchanged: speech-to-text, enhance-text, provider-setup document intelligence, the whole
> VOICE path, and `IMcpSessionService`/`McpSessionService`/`AiSession` (rewritten as the Business Search
> conversation store, member-scoped and CAS-guarded).

# CLINQET VOICE AI ASSISTANT — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (the receptionist never books a job at $0)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- ‼️ **A listed service with no price books with `PriceTypes.OnRequest` and NO amount**, never an empty type and never 0 — so no document the caller or the owner reads prints a $0 that looks like "free".
- **The service's own description is KEPT and the subject-to-confirmation note is ADDED to it** — it used to REPLACE it, leaving the customer with a booking document that no longer said what they had booked.
- **`get_quote_estimate` answers "no listed price"** for such a service rather than quoting nothing.
- ‼️ **`UnlistedItemNote` reads the English catalog ON PURPOSE**, at every call site: the text is STORED on the booking or quote line, and both documents that render it force English (`QuestPdfService.DocumentLanguage`). Translating it per caller would put one sentence in a second language inside an English PDF.
- ‼️ **The MCP service-write tools now obey the price rules** (`ServicePricingRules.Normalize` + `Validate`): `price: 0` is refused, and `priceType: "on request"` keeps no amount.
- **`IPreparedProviderEmailFooter` is deliberately NOT registered in this host** — the one email it sends is a verification code.

## RECENT CHANGES — 2026-09-26b (‼️ INDIA: THE MCP HOST CAN RESTART, CRASH OR HANG MID-CALL — the caller is supervised from OUTSIDE it. BUILT + GREEN + SABOTAGE-VERIFIED, owner deploys)

Authority: `C:\Nik\Data\voice-realtime-2.1\MCP-CRASH-DESIGN.md` (owner-approved 2026-09-26: all three layers + the §6
Cosmos TTL change). India (Plivo) only — on Canada/US the caller's audio never passes through MCP. Where an older
paragraph below disagrees, this section is current.

**The rule:** the relay (`clinqetmcp/.../PlivoVoiceRelay`) never has the last word about a live caller. Every path that
finds a caller no relay serves ends in ONE hand-off, owned by the Functions host's `PlivoRelaySupervisor`
(`Clinqet.Communications/Services/`): caller still in the conference ⇒ hang up the AI leg ⇒ voicemail (§19: a hangup
when no disclaimer was played). The phase CAS makes every path single-winner.

- **L1 — planned restart (drain).** The relay is a hosted service implementing `IHostedLifecycleService`; the drain runs
  in `StoppingAsync` (every `StoppingAsync` precedes every `StopAsync`, so the callers' streams are still open — Kestrel
  would otherwise wait on them and cut them dead). Per live call: arm a **dead man's switch** FIRST (a scheduled
  `PlivoRelayCheck`, id `vpc-ail-{callId}-d{sessionTicks}`, at `AiDrainSeconds + AiLostConfirmSeconds`, fenced to this
  session), speak ONE hand-off line when it can (greeted, setup confirmed, no reconnect, no ringing join, no goodbye
  under way), mute the caller, enqueue `AiSessionLost`, cancel the switch. Bounded by `Plivo:AiDrainSeconds` (20); past
  the bound every caller still served is handed on without the line. A call that ends by itself during the drain (the
  caller hangs up while the line plays, or its teardown is still running at the bound) is NEVER handed on — its own
  teardown already asks the Functions host to check, and a hand-off would have stamped a finished call as voicemail.
  Admission and the drain's snapshot share one lock, so a stream can never slip in after the drain looked; new streams
  and provider joins are refused while draining. A goodbye already under way ends by its own hangup. Host budget:
  `Mcp:HostShutdownSeconds` (45, validated `> AiDrainSeconds + max(0, Azure:Realtime:MonitorShutdownTimeoutSeconds)`)
  sets `HostOptions.ShutdownTimeout`; `deploy.ps1` sets the platform's `WEBSITES_CONTAINER_STOP_TIME_LIMIT` from
  `-McpContainerStopSeconds` (60; the default is 5 s); the host logs an ERROR at startup if that limit does not exceed the
  budget. **Registration lives in ONE place:** `AddPlivoVoiceRelay` (`Clinqet.Mcp/Monitor/PlivoVoiceRelayRegistration.cs`)
  owns the Plivo options + both timing rules, the stop budget, the singleton, its interface and the hosted lifetime —
  Program.cs only calls it. Every relay unit test calls `StoppingAsync` by hand, so ONLY the registration tests notice
  the hosting or the budget going missing.
- **L2 — carrier events (crash, network cut).** `AddAiAgentMemberAsync` now sets Plivo's documented
  `ai_agent_stream_status_callback_url` (+ `_method` POST), pointing at the new route `voice/plivo/ai-stream-status`
  (function `PlivoVoiceAiStreamStatus`, V3-validated like every Plivo route). Plivo documents the callback but NOT its
  fields: ANY report only schedules a check (id bucketed per `AiLostConfirmSeconds`), and the allow-listed form log is
  how the fields get learned on the wire. `EventName=ParticipantExit` for anyone but the caller (correlated MPC) also
  schedules one check. Neither ever rescues on its own.
- **L3 — the lease (silent hang).** The India live-call marker (`VoiceBusinessLiveCall`) is now a LEASE:
  `Ttl = Plivo:AiLeaseSeconds` (45), renewed every `AiLeaseRenewSeconds` (15) — only while the session can reach the
  caller (`CanReachCaller`: Plivo socket open and its pump alive), so a session stuck after its stream died stops
  vouching even though its loop runs. The teardown awaits the lease loop BEFORE deleting the marker (a late renewal
  would resurrect it). The Telnyx monitor keeps `LiveCallRegistryTtlHours`. **Expiry is computed, never trusted to the
  store:** the entity maps Cosmos's `_ts` read-only (`WrittenAtEpochSeconds`, `ShouldSerialize…() => false`) and
  `IsExpired(now) = _ts + ttl <= now` — the emulator was seen both returning expired items and purging them on its own
  schedule, so every reader computes expiry itself and agrees whatever the store does. The live-calls
  list and the cross-instance provider-join check both drop a lapsed lease.
- **The periodic check.** The hand-off (`TryReceptionistHandoffAsync`) calls `WatchAsync` ⇒ tick 1 of a per-AI-leg chain
  (`PlivoRelayCheck`, `vpc-ail-{callId}-{leg}-t{n}`, every `AiLivenessCheckSeconds` = 20). A tick with a fresh lease
  asks Plivo nothing. The chain stops when the call leaves `AiHandoff`/`Active`, when its leg is superseded, or past
  `MaxCallDurationSeconds + AiActivationTimeoutSeconds` (logged as an error).
- **Confirm, then act (`EvaluateAsync`).** Order: phase/leg gates → a ringing provider join DEFERS (bounded by ring +
  AMD + confirm + one check; a stuck claim cannot suspend supervision) → lease → member list via the NEW
  `ReadMpcParticipantsAsync` → caller gone ⇒ nothing (arms `vpc-endbs-{callId}-sup`) → AI member absent (no ai-agent at
  all; another ai-agent leg is UNKNOWN, maybe a reconnect) ⇒ lost at once → fenced lease ⇒ lost at once → lapsed lease ⇒
  a SECOND look `AiLostConfirmSeconds` later (`{id}-c`, `RelayCheckConfirming`), lost only if still lapsed. Before the
  relay first comes up (`AiHandoff` inside `AiActivationTimeoutSeconds` = 30, validated to outlast the ai-agent join
  checks) an absent lease is expected, and a member that never joined is the join check's to decide. A rescue that
  loses every CAS while the call is still live THROWS so Service Bus redelivers it; a periodic check arms its next tick
  FIRST (deterministic id, so redeliveries collapse), because the processor dead-letters on the final delivery and a
  dead-lettered tick would otherwise end the call's supervision. A tick whose store read fails outright schedules the
  next tick instead of throwing. Alert `RealtimeRelayLost`, once per hour (dedupe key
  `realtime-relay-lost:{yyyyMMddHH}`); the relay's own hand-offs raise none.
- **‼️ `ReadMpcParticipantsAsync` is tri-state.** The old `GetMpcParticipantsAsync` returns EMPTY on any failure, so the
  2026-09-26 "unreadable list counts as present" rule was dead code: a Plivo API failure read as "caller left" and
  skipped the rescue. Now: read OK ⇒ the list; 404 ⇒ Available + empty (Plivo no longer knows the conference); any
  other refusal, transport failure or unrecognised body ⇒ `Unavailable` ⇒ the caller counts as present. The join
  confirmations keep `GetMpcParticipantsAsync` (empty = "not confirmed", unchanged).
- **Fencing, two kinds.** (1) A relay session that declares itself gone sends `FencedInstanceId` + `FencedSessionStartedAt`;
  a marker matching BOTH (the start time to the millisecond — a new session on the same instance is a different, live
  owner) vouches for nothing. (2) The resource owner refuses a stale actor: on Plivo, `ProcessHangupCallAsync` ignores a
  `HangupCall` unless the phase is `AiHandoff`/`Active`, so a relay that wakes from a stall cannot hang up a caller
  already in voicemail. The relay's activation CAS now flips ONLY `AiHandoff`/`Active` (it used to overwrite anything but
  `Ended`); a moved-on call makes it stand down without greeting or a lease.
- **‼️ The relay NEVER sends `CallEnded` any more.** Its old scheduled copy shared `vpc-end-{callId}` and was SENT before a
  rescue in the failure cases, so it won the 40-minute dedup and the voicemail was never transcribed. Every session now
  ends with `PlivoCallEndBackstop` (`vpc-endbs-{callId}-{sessionTicks}`, +`MonitorPostCallDelaySeconds`, fenced), which
  the supervisor decides: phase not live ⇒ nothing; a fresh lease from another session ⇒ nothing; caller present ⇒
  rescue; caller gone ⇒ `CallEnded` (`vpc-end-{callId}`, built by `PlivoCallEndedMessage.Build` — the SAME builder the
  caller-hangup webhook uses) + `Ended` + end the MPC; list unreadable ⇒ retry up to `MonitorPostCallDelaySeconds /
  AiLivenessCheckSeconds`, then summarize WITHOUT ending the call. The caller-hangup primary now always wins the dedup.
- **How a session ends (teardown classification).** Confirmed relay hangup (Plivo ended the stream) ⇒ backstop only.
  Hand-off (`HandedToVoicemail`) ⇒ backstop only. Bridge (`DroppedForBridge`) ⇒ nothing. Anything else — a clean
  close, a `stop`, a faulted stream, a bring-up exception, a hangup Plivo never carried out — ⇒ backstop + a fenced
  `PlivoRelayCheck` (`vpc-ail-{callId}-e{sessionTicks}`, +`AiLostConfirmSeconds`). A faulted Plivo stream no longer sends
  `AiSessionLost` directly (Plivo may reconnect the stream to another instance).
- **‼️ Relay hangups keep the stream until Plivo ends it (`EndCallByHangupAsync`).** end_call, idle goodbye, farewell
  close, max duration and a drop during the goodbye all mute the caller, enqueue `HangupCall`, and wait for Plivo to end
  the stream (at most `Plivo:AiHangupWaitSeconds` = 20). An AI that dropped first looked exactly like a lost relay: the
  AI's `ParticipantExit` check would have sent a caller who was being hung up to voicemail. Only a pump that
  RanToCompletion (a Plivo stop/close) counts as confirmed.
- **Joins and rescues.** `AiSessionLost` waits out a ringing join (`RescheduleAttempt`, `DeferredSinceUtc`, id
  `vpc-ailost-{callId}-{leg}-r{n}`) — the provider may still give the caller a person. Voicemail entry now ABANDONS a
  live join in its CAS (clears `ProviderJoinLegCallControlId` + `ProviderJoinAttemptCallUuid`, hangs up a real join leg)
  so a late answer can never bridge into a conference the caller left. A redirect Plivo refuses now hangs the caller up
  instead of leaving them in silence. `AiSessionLost` is keyed per AI leg (`vpc-ailost-{callId}-{leg}`) and discarded
  for a superseded leg.
- **Messages:** new kinds `PlivoRelayCheck`, `PlivoCallEndBackstop`; new fields `RelayCheckTick`, `RelayCheckConfirming`,
  `FencedInstanceId`, `FencedSessionStartedAt`, `DeferredSinceUtc`, `RescheduleAttempt`; `AiAgentJoinCallUuid` now
  carries the AI leg for the relay checks and `AiSessionLost` too. **Deploy the Functions host BEFORE MCP** (an old
  Functions host dead-letters the new kinds as `UnknownKind`).
- **Settings** (class defaults mirror each host's appsettings; each host carries only what it reads): MCP
  `Plivo:AiLeaseSeconds` 45 (validated `> 2 × AiLeaseRenewSeconds`), `AiLeaseRenewSeconds` 15, `AiDrainSeconds` 20,
  `AiHangupWaitSeconds` 20, `AiLostConfirmSeconds` 5, `Mcp:HostShutdownSeconds` 45; Functions `Plivo:AiLivenessCheckSeconds`
  20, `AiLostConfirmSeconds` 5, `AiActivationTimeoutSeconds` 30 (validated `>` the join chain's decision point
  `PlivoSettingsRegistration.AiAgentJoinDecidedAfterSeconds`, which applies the chain's OWN `Math.Max(1, …)` clamps). The Functions rules live in
  `AddFunctionsPlivoSettings` (`Clinqet.Communications/Configuration/PlivoSettingsRegistration.cs`). The Functions host
  now registers `IVoiceBusinessLiveCallRepository` (point reads only) and `PlivoRelaySupervisor`. Convention tests pin
  each host's timing keys to their class defaults (`PlivoRelayTimingSettingsConventionTests`,
  `PlivoRelaySupervisionSettingsConventionTests`).
- **Tests (§0.18):** supervisor matrix `Clinqet.Communications.UnitTests/Services/PlivoRelaySupervisorTests.cs`; processor +
  webhook + adapter tests in their suites; real-Cosmos `VoicePostCallProcessorIntegrationTests` (the store's `_ts` comes
  back and drives expiry; lapsed lease ⇒ second look ⇒ one rescue across redelivery; fence round-trips to the tick;
  backstop summarizes once) and signed-callback `PlivoVoiceCallControlFunctionIntegrationTests`; relay lease/drain/hangup
  tests in `PlivoVoiceRelayTests`; MCP integration `VoiceLiveBackplaneE2ETests` (a lapsed lease leaves the live list and
  never routes a join) and `PlivoVoiceRelayHostingIntegrationTests` (the REAL Program.cs hosts the relay, sets the stop
  budget, and refuses to start with a lease one missed renewal could lapse); Functions `FunctionHostCompositionIntegrationTests`
  resolves the Plivo options on the REAL Program.cs under every stamp and proves it rejects a too-short activation window.
  ‼️ The lease-lapse endpoint tests move the HOST's clock (`ClinqetMcpFactory.Clock`, a `ShiftableTimeProvider`; the
  active-calls and provider-join endpoints read `TimeProvider`), never wait for a real lapse: the emulator purges expired
  items on its own schedule, so a waited-out lapse let a sabotaged `IsExpired` pass one of the two tests.
  31 sabotages, one per guard, each caught by its named test (incl. deleting the hosted-service line, the stop budget,
  each timing rule, both drain skips, the contended-tick re-arm and both endpoint lease checks).
- **‼️ Still to confirm on a dev India call (design §7, nothing in code depends on guesses):** which callbacks arrive when
  the MCP process is killed / frozen and their fields (then the stream-status handler can filter by event), and that a
  deploy mid-call plays the hand-off line and reaches voicemail (proves `WEBSITES_CONTAINER_STOP_TIME_LIMIT` is honoured
  for this Linux code app).

## RECENT CHANGES — 2026-09-25b (‼️ GPT-REALTIME 2.1 ON BOTH TIERS + "sound more human": notice voice, calm pace, voice samples — BUILT, owner deploys)

> ‼️ **Models, truncation and reasoning effort: superseded by the owner's commit `7ffe152` "Realtime call model fixes"
> (2026-09-26).** The code now has Standard = `gpt-realtime-mini`, Advanced = `gpt-realtime-2.1`, the truncation settings
> back (`TruncationEnabled` …), and `StandardReasoningEffort` (empty) / `PremiumReasoningEffort` (`low`). For those three
> points read the code, not the first three bullets below. Everything else in this section stands.

Authority: `C:\Nik\Data\voice-realtime-2.1\PLAN.md` (decisions D1–D8, dev-call checklist §11). Where an older
paragraph below disagrees, this section is current.

- **Models (D1), identical in Canada/US and India:** Standard = `gpt-realtime-2.1-mini`, Advanced = `gpt-realtime-2.1`
  (both GA 2026-07-07, on Azure's realtime SIP list since 2026-09-23, priced exactly like what they replace).
  `gpt-realtime-mini` and the retiring Preview `gpt-realtime-2` are gone from code, config, `deploy.ps1`
  (both versions now `2026-07-07`) and the scripts. India's Advanced tier no longer runs the Standard model,
  and `deploy.ps1` no longer falls back to Standard when the India premium deployment is missing (origin, 2026-09-26).
  `TokenPricing` keys renamed, prices unchanged. Emergency fallback: `gpt-realtime-1.5` with `ReasoningEffort` EMPTY.
- **‼️ `truncation` is DELETED, not switched off.** Microsoft: "GPT Realtime 2.x models don't support the
  `truncation` property" — and one malformed field fails the whole SIP accept or India `session.update`. It had been
  sent on every call since 2026-08-07, which is the likely cause of the 2026-08-11 "2.1 fails on SIP" probe (D5,
  superseded). `TruncationEnabled` / `TruncationRetentionRatio` / `TruncationPostInstructionsTokens` no longer exist.
  Pinned by `Build_NeverSendsTruncation_OnEitherTierOrTransport` and the accept-body webhook integration test.
- **`Azure:Realtime:ReasoningEffort` (was `PremiumReasoningEffort`) = `low`, sent on EVERY call**, both tiers and both
  transports; trimmed + lowercased; empty ⇒ omitted. The "never for the standard model" special case is gone.
- **`RealtimeCallService.AcceptAsync`** now logs Azure's reply body on 404/410/422 (a retired model answers 410, which
  used to read as "the caller hung up"). Outcome mapping unchanged, no new alert.
- **Tone and pace (B2):** the opening line is "…answering its phone like a friendly, experienced receptionist: warm,
  calm and unhurried." (no more "CRISPLY"), plus one "Tone and pace:" line after "Be brief". Both transports, pinned.
- **‼️ Notice voice (B3, Canada/US only; India unchanged).** Every carrier-read Telnyx line — disclaimer, both
  line-unavailable lines, the provider hold line, the voicemail invite, the dial reassurance — now goes through ONE
  Functions-host service, `Clinqet.Communications/Services/VoiceNoticeSpeaker`: spoken language after
  `SpeakLanguageFallbacks` (gu/pa ⇒ hi), then `VoiceCall:SpeakVoices[lang].Female|Male` chosen by the AI voice's
  gender in `Azure:Realtime:VoiceGenders` (neutral/unmapped ⇒ Female; a line with no voice ⇒ `DefaultVoice`'s gender);
  an empty value ⇒ the generic `SpeakVoice`. Values: en Ava/Andrew `:DragonHDLatestNeural`, fr-CA Sylvie/Thierry,
  es-MX Dalia/Jorge, hi-IN Swara/Madhur, all `Azure.`-prefixed (Telnyx's API reference form). The two duplicated
  language resolvers in the functions were deleted — the service is the only copy.
  - ‼️ **A named voice that is not accepted is spoken ONCE more in `SpeakVoice`** (Warning logged). A notice that never
    plays switches off recording and the AI for the whole call (§19), so this retry is mandatory.
  - ‼️ **Telnyx ignores a repeated `command_id` on the same call**, so the speak `command_id` is now keyed by voice
    (`speak:{voice}`, like `dial-bi`); a replay of the SAME speak still dedups. Without it the retry was dropped.
  - Guards: `VoiceSpeakLanguageSettingsConventionTests` pins the `SpeakVoices` mirror both ways AND that every voice
    speaks its language's Telnyx locale; `VoiceNoticeSpeakerTests`; call-site tests; the webhook integration test
    drives the REAL `TelnyxCallControlService` over a fake Telnyx that refuses Azure voices ⇒ generic retry with its
    own id ⇒ recording starts on the real Cosmos session. Rollback: set the `SpeakVoices` values empty.
- **India prompts know the AI's gender (F1):** `clinqetmcp/Clinqet.Mcp/appsettings.json` now carries the same
  `Azure:Realtime:VoiceGenders` (config only; the class default stays empty because the binder merges into a
  populated default), so India says "she/her" / "he/him" like Canada — Hindi and Punjabi verbs change with gender.
  Pinned by `RealtimeVoiceGendersConventionTests` (MCP), which builds the real India payload from the host's file.
- **Voice samples (B1.4):** `clinqetwebpartnerapp/scripts/generate-voice-samples.mjs` (GA `/openai/v1/realtime`,
  env-only credentials, the model's transcript checked against the script with 3 attempts, Hindi/Punjabi wording by
  gender, two-pass ffmpeg loudness ⇒ within 1 LU) wrote 60 clips — 10 voices × en/fr/es/hi/pa/gu, 7–17 s, 5.8 MB — to
  web `public/voice-samples/<lang>/<voice>.mp3`, copied byte-identical to mobile `src/assets/voice-samples/`. The hero
  scripts moved to the GA endpoint too; all three share `scripts/lib/realtimeSession.mjs`.
- **‼️ Voice samples fixed 2026-09-27 (owner heard Marin/Cedar say "I, thanks for calling").** Measured, not guessed: all
  60 clips started speaking within 20 ms of the file start (the 80 ms "pad" only KEEPS silence the model made, and the
  realtime model makes none), so a player or headset waking up swallowed the first sound; and the "h" of "Hi" was 0 ms
  on marin/cedar/alloy and 10 ms on echo (sage/verse/ballad: 60–90 ms). Ten takes also began inside a loud voiced sound
  (cut "¡Hola"/"Namaste"). The harness now (quality gates in `scripts/lib/sampleQuality.mjs`):
  - puts **200 ms of silence before and 150 ms after** every clip, with 5 ms fades at the trimmed edges (300 ms would
    be a pause felt on every tap; 200 covers the 20–150 ms players and headsets drop);
  - re-records a take that starts or ends inside a loud VOICED sound (`cutEdge`: within 20 dB of the loudest speech and
    zero-crossing rate < 0.3). ‼️ A hiss is exempt: sage's Punjabi "ਸਤ" always starts on its "s" at once, and a plain
    level rule rejected every take;
  - English only: keeps the take whose opening "h" is clearly heard (`openingAspiration`/`hiClarity`: ≥ 30 ms of
    breath AND enough energy, measured FROM THE FIRST SOUND against the vowel), rejects an inaudible (< 20 ms) or an
    exaggerated one (breath within 6 dB of the vowel, or > 250 ms before it). No instruction nudge: asking for an audible
    "h" made marin exaggerate ("Hhhi", 880 ms before the vowel) and barely helped cedar/echo;
  - checks every take ON THE FINISHED MP3 (framing, loudness within 1.5 LU of −16, the "h") — MP3 coding tipped soft
    "h" frames across the line — and has a SECOND LISTENER: the finished file transcribed by `gpt-4o-mini-transcribe`
    on the same resource (deployments route, api-version 2024-10-21; `/openai/v1` answers 404 DeploymentNotFound for
    it). Word-perfect takes win; if none is, the clip is kept and printed as "needs a listen" with what was heard —
    the listener rewrites Gujarati "મૂકવામાં" as "મોકલવામાં", so Gujarati usually lands there by design;
  - the self-check fails an ADDED word too (it only caught missing ones), and loudnorm's claim of "one exact gain" was
    false (peaks force its dynamic mode) — the finished file is measured instead.
  Result: 15 clips re-recorded (en marin/cedar/alloy/echo/sage/coral, es/fr/gu/hi/pa sage, fr/ballad, gu/coral, gu/verse,
  pa/verse); the other 45 got the same silence by MP3 FRAME COPY (no re-encode) and decode bit-exact to the approved
  audio. Verified in Chromium, Firefox and WebKit (all 60 play; WebKit reports up to +94 ms — it keeps the MP3 encoder
  padding, same on the old files). The web serves `/voice-samples` no-store, so a deploy is heard at once; mobile gets
  them with its next build.
- **Voice order:** `VoiceAssistant:Voices` (API) now starts Marin, Cedar (OpenAI's recommended voices), then the rest.
- **Voice list contract (F2/F3):** `VoiceAssistantVoiceOption` / `VoiceOptionDto` are `{ Id, Recommended }`; the English
  `Label` is gone. Names and one-line descriptions are copy keys (web `voiceAssistant.voice.<id>` + `.description`,
  mobile `VOICE_NAME.<id>` / `VOICE_DESCRIPTION.<id>`); Marin and Cedar carry `Recommended: true`. Mobile's
  `VoiceOption.previewUrl` and `resolvePreviewUri` are gone: the samples ship inside the apps and are never fetched.
- **Voice picker (B1; mockup `Data/mockups/voice-picker/`, approved as drawn 2026-09-25).** Web
  `Profile/voiceAssistant/VoicePicker.jsx` (+ `useVoicePreview.js`, `voiceSamples.js`): one radiogroup: a
  "Recommended" heading over the recommended cards (side by side from ~500 px; the heading is each card's
  `aria-describedby`, no per-card badge since 2026-09-26), then "More voices" in a denser grid; every card has its own 44 px play/stop with a
  progress ring; arrow keys move the choice and never play. Mobile `VoicePicker.tsx`: the chosen voice as a card (the only
  place with the badge) that opens a bottom sheet with the same two headings, recommended rows' labels ending "Recommended"; `useVoiceSamplePlayer` (nitro-sound) plays one sample at a time and stops on
  background and unmount. Both play the sample in the line's primary language (en/fr/es/hi/pa/gu; anything else ⇒
  English with a one-line note). A new line defaults to the first listed voice, even when the options arrive late. A
  saved voice that is no longer offered stays saved and flagged, and a save asks for a new choice first (the server
  refuses unlisted voices).
- **‼️ India: Azure refuses the relay's setup (owner: "the proper way as a standard").** The relay's `session.update`
  carries `event_id = RealtimeSessionPayloadBuilder.SessionSetupEventId`, and Azure echoes it as `error.event_id` when
  it refuses that setup; any other error stays a Warning. On a refusal `PlivoVoiceRelay` logs an Error, raises the
  cooldown-bounded `RealtimeSessionSetupRejected` admin alert (deployment, code, field, reason), cancels the queued
  greeting, enqueues `VoicePostCallKind.AiSessionLost` (`vpc-ailost-{callId}-{aiLeg}` since 2026-09-26b) and ends itself.
  The Functions host (`PlivoRelaySupervisor.HandleSessionLostAsync` since 2026-09-26b) first confirms the caller is still
  in the MPC (`ReadMpcParticipantsAsync`, role `customer`; an unreadable list counts as
  present, a caller who already hung up is left alone so a normal end is never re-labelled a voicemail), then
  hangs up the AI leg and moves the caller to voicemail through `PlivoRelaySupervisor.EnterVoicemailAsync(fromLiveAi: true)`, whose CAS
  also accepts `Active` in that case; with no disclaimer played it hangs up instead (§19); a redelivery is a no-op.
  ‼️ The relay never enqueues its own `CallEnded` (since 2026-09-26b, not even as a backstop — see that section): that copy
  shared `vpc-end-{callId}` with the one sent at hangup, would win the dedup, and lacks `TranscribeFromRecording`, so the
  voicemail would never be transcribed. Canada/US has no equivalent:
  a refused SIP accept surfaces as the accept's HTTP status (400 ⇒ Failed ⇒ admin alert; 404/410/422 ⇒ CallGone, a
  Warning carrying Azure's body) — superseded 2026-09-26, see the next bullet.
- **‼️ India: a mid-call Azure drop never leaves the caller in silence (2026-09-26, owner-approved).** `PlivoVoiceRelay`
  runs the Azure side through `RunAzureSessionAsync`: when the socket closes or faults on a live call it reopens it with
  the SAME URI and setup payload (kept on the session at bring-up), replays the conversation so far as one system item
  (last `Azure:Realtime:RelayReconnectHistoryTurns` lines, 40), then a short apology turn (`ReconnectResumePayload`) —
  or the plain greeting if nobody had spoken, and nothing during a provider-join ring. Budget per call
  `RelayReconnectAttempts` (2), each try after `RelayReconnectDelayMs` (750) × its number; the watchdog pauses and
  caller frames are dropped (never fatal) while it reconnects. When it cannot reopen: `RealtimeSessionLost` admin alert +
  `AiSessionLost` ⇒ voicemail. A drop during the goodbye drain hangs up instead (it was ending). A FAULTED Plivo stream
  now asks the Functions host to check on the caller instead of sending `AiSessionLost` (2026-09-26b), and the MCP
  process itself dying mid-call is covered by the supervision in 2026-09-26b. Settings live only in the MCP host's appsettings.
- **‼️ Canada/US refused accept (owner-approved "fix it properly", 2026-09-26).** Azure documents only `200` for
  `/realtime/calls/{id}/accept`, so `RealtimeCallService.AcceptAsync` now returns `RealtimeAcceptResult(Outcome,
  StatusCode, Reply)`: `Accepted` · `CallGoneOrRefused` (404/410/422: the call ended OR our setup was refused, e.g.
  a retired/missing model or a rejected field) · `Refused` (any other 4xx) · `Failed` (5xx/408/429, retried as
  before). `RealtimeCallWebhookFunction` settles the ambiguity from its OWN record: a session still in `AiHandoff`
  means the caller is waiting, so it is a refusal. A refusal raises `RealtimeCallRefused` (tier, HTTP status, Azure's
  reply; `dedupeKey` per tier+status+hour from the injected `TimeProvider`), calls the new `RejectAsync` (Azure
  answers SIP 603, so the transfer leg ends and the existing "AiHandoff B-leg died ⇒ voicemail" path runs at once
  instead of after `SipTransferTimeoutSeconds`), marks the webhook processed and returns 200 — never a retry, which
  would be refused again. A session that already left `AiHandoff` stays a quiet Warning. Pinned by the classification
  matrix, the webhook unit tests (incl. the hour bucket) and two real-Cosmos integration tests; sabotage-verified.
- **Picker playing marker has a fixed slot (web + mobile).** The equalizer beside the name renders on every card and
  is only hidden while idle (`styles.idle` / `voiceEqualizerIdle`); drawing it only on play re-wrapped the badge on a
  390 px phone and made the card jump taller. Pinned on both platforms.

## RECENT CHANGES — 2026-10-04 (b) (‼️ AI Knowledge — one print written once; table titles above their table; `AdjudicationRulesVersion` = 4. NOT deployed — Functions and API in ONE release)

- **Why:** after the version-3 deploy, NKN607 auto p1 ("2018 HONDA ACCORD", row "Rates") raised `ReadingRuleFallback`. DI read the
  rates table's values into its header; the tables matched but did not line up, so the machine's "43 57" (settled by the PDF text)
  was restored INTO the AI's AB cell ("37 43 57") while the AI's confirmed "43 | 57" stood — the audit then put the garbled row back.
- **One print, written once (`PageDecision.PrintedOnce`):** a machine-only table value whose every number the AI's check-confirmed
  copy carries IN THE SAME TABLE (`PageAlignment.MatchedTables` / `SameTable` — every matched pair, lined up or not) is dropped
  as `LayoutDifferenceKept`. Never across tables; each AI token is used once.
- **Title words (`PageTable.Titles(row)`):** a header row, or a row printing one cell alone, titles its table. Such a word left
  over from a table that did not line up goes as a line just BEFORE its AI table, never inline into the text above it
  (`PageAligner…Restored`; "(021303 Rates )" was the bug). In the placeless write-back a title word — or a side title that is its
  own row label ("Totals") — goes above the table, bare; every other word is a VALUE and keeps its labels after the table
  ("Seatbelt Reminder: All Seats" — a bare value above the table was a regression the replay caught and the rule now forbids).
- **Stacked tables (`PageTable.Parts` / `PlaceOf(row)`):** when one reader's tables are stacked against the other's, a line goes
  before/after the PRINTED table holding its row — never the first or last of the stack ("Middle Name" went above Co-Insured).
  `PutBack` uses the same place.
- **`AdjudicationRulesVersion` = 4** (raw bank untouched: pages are re-decided from answers already bought). Picture text rules pin
  moved with it (descriptions are not re-bought).
- **Proof:** replay of all 17 raw-banked NKN607 pages, pushed vs new: the alert's loss gone (1 → 0), 3 pages changed, all better.
  Replay of 321 more published pages (ZEKIKT, 6TCWOI, E2F04R, HG3QFI) as a stress test: losses 5 → 4, no crash, 2 pages changed
  (duplicate put-back lines gone; the values still print in their cells). 5 sabotages, each caught. Functions unit 9,654 / 9,654.
- **Tests:** `PageDecisionTests.ATableValueTheAiConfirmedInTheSameTable_IsPrintedOnce…`, `PageAlignerTests.ATitleWordOfATableThatDoesNotLineUp…`,
  `PageWriteBackTests` (`AHeaderWordOfAStackedTable…`, `ASideTitleThatIsItsOwnRowLabel…`, `ABodyWordOfAStackedTable_KeepsItsLabel…`,
  `ALostNumberOfAStackedTable…`).

## RECENT CHANGES — 2026-10-04 (‼️ AI Knowledge — what the reading rules write back never breaks a page; a decision that could not be written is alerted; the PDF's own text never outvotes a correct word. Pushed; NOT deployed — Functions and API in ONE release)

Authority: `C:\Nik\Data\knowledge-reading-accuracy\BUILD-STATE.md` (section "2026-10-04"). Where an older paragraph disagrees,
this is current.

- **Why:** NKN607's four insurance quotes raised three "check against the original" alerts (markup on cards on company1 home p2
  and company2 home p7; a TOTALS zero put back on company2 auto p2). The AI page was right each time — writing the rulings back
  broke it: a line put back between a table's header and its `|---|` line, a short row read by position, a header-label ruling
  written at offsets re-read from the label text. A replay of every banked page then found more of the same class (below).
- **`Reading/PageBlocks`** (new): the lines that mean something only together — a pipe table with its header and `|---|` line (by
  the structure reader's rule, or the card reader's declared header, without outer pipes too), an HTML table, a `<figure>`, a
  fence, a comment, a setext heading, a quote, a list item and its indented lines. Every table — inside a list item too — knows
  its own bounds, header and `|---|` line. A line goes before or after a block; a row inside its table, below the `|---|` line.
- **`PageWriteBack`** rewritten: one `RowEdit` per table row, written once (no ruling undoes another); a span is used only where
  it holds its own tokens (`Spans`); a token is in place only where the page's own reading of its cell or line finds it
  (`InPlace`); a cell is written whole only when the text loses none of its other words (`CellFor`; a third reading is always a
  whole cell, `CellOf`), otherwise the difference's own machine tokens replace its own AI tokens; a value that cannot go into
  its cell goes after the table AND is reported (the cell still prints the AI's); a row wider than the reader reads (64 cells)
  is never written anew; a row put back hugs its table (`Edit.HugsAnchor`); a deleted last line takes the newline before it
  when a line is put in after it; edits inside an AI HTML table are HTML-encoded and never cross markup; cell text is one line,
  spaces single, pipes escaped once; every edit carries all its rulings. Shape guard on tables, figures and fences.
- **HTML tables (`PageStructure.HtmlTable`):** a cell printed plainly carries its tokens' real page positions; one with an entity
  or a tag inside carries none (`Unplaced`) — never offsets that point elsewhere on the page (they crashed a document and could
  delete the page heading).
- **Short rows (`PageAligner`):** the AI's padded places never pair (`WrittenCells`; the machine's blank cells still do, so F-03
  holds); the column map comes from rows at the table's usual width (`UsualWidth`, one stray pipe never decides it); a short
  data row is re-seated (`Reseat`) only as the AI's own header was (`HeaderLed` — the header's labels prove the skipped blank),
  and `PageDecision.Compare` aligns the re-seated page again, which is what is published.
- **Amounts split across a line (`PageAligner.JoinSplitAmounts`):** leftover consecutive tokens of one reading that print exactly
  a leftover amount of the other ("10⏎years" / "10 years") are that amount. Evidence-based: a form's next field never lends its
  label to the value above (re-tokenising the machine reading did exactly that on NKN607 p2 — rejected).
- **The PDF's own text (`TextLayerAuthority`):** a glyph the PDF has no character for comes out as a control or private-use
  character ("Noti\u001Fcations", ligatures at 0x1E/0x1F) or as nothing ("Illustraon"); a clipped box drops a letter
  ("AWD" → "WD", "₹" lost). The layer never "corrects" the machine reading into that (`Misread` refuses an unmapped glyph or
  letters only dropped) and settles nothing where its text holds one. A machine word that lost ligature runs against the AI's
  full word: the AI's reading stands, unasked (`PageDifference.LigaturesLost` via `PageTokens.LigaturesLost`, whole ligature
  runs only — a typo the page really prints, like "considred", is kept).
- **Placeless words** (`PageDifference.Placeless`): AI words of a row group the readers split differently stand (no place to
  check); machine-only words keep their path, written as their own tokens only.
- **A decision not written is alerted:** `DecidedPage.NotWritten` → `PageDecision.Review` reports each one as
  `TranscriptionVerificationDisposition.RulingNotWritten` (appended, clinqetshared) instead of its normal entry: `SelectedReading`
  = the AI's text, `Reason` = what was decided, `RemainingUncertainty` set, `AmountsAtStake` = every disputed figure — or, where
  both readings print the same figure (a moved value), that figure — so `TranscriptionDisputeIndex` never lets a service take it
  as a confirmed price → `ReadingOutcomeKind.RulingNotWritten` (always sent, importance 1, "fix the reading rule").
  `ReadingOutcomeReviews.Apply` never lets a consumer outcome replace a rule fault (`ReadingRuleFallback`, `RulingNotWritten`).
- **`AdjudicationRulesVersion` = 3** (raised once for all of this; banked pages are re-decided free from the raw bank; production
  is still on 1). The pin `ThePageReadingRules_AreVersioned` covers `PageBlocks.cs` too.
- **Proof:** Replay of all 337 banked pages (NKN607 + 15 India documents) on the final code, from the banked answers (no model call): 0 numbers lost (the old rules lost 3), 0 rulings not written, 0 crashes (the old rules crashed MG Windsor p15). Every changed page was read by hand: NKN607's three alert pages fixed; 12 ligature words, a clipped "AWD" and a lost "₹" as printed; stray unit words gone ("10 years", "3.3 litre", "20 mg"); a feature list's ticks restored; a truncated row's words recovered. 44 sabotages, each caught by a named test (two in the integration test). Functions unit suite 9,648 / 9,648.
- **Tests:** `PageWriteBackTests`, `PageBlocksTests`, `PageAlignerTests` (short rows, usual width, header-led, split amounts, F-03
  on short machine rows), `PageDecisionTests` (re-seat, placement, placeless, ligatures, not written, moved value at stake),
  `PageTokensTests.AWordPrintedWithoutItsLigatureGlyphs…`, `TextLayerAuthorityTests` (lost glyphs, unmapped places),
  `ReadingOutcomeAlertsTests.ADecisionNotWrittenIntoThePage…`, `ReadingOutcomeReviewsTests.ARuleThatFailed_*`; integration
  `KnowledgeReadingWriteBackIntegrationTests` (the real reading service on an Azurite page bank, then parser, chunker, card check).

## RECENT CHANGES — 2026-10-03 (‼️ AI Knowledge — reading rules, raw AI bank, section scope, overview seats, "Report wrong answers". Pushed 2026-10-03, NOT deployed)

Authority: `C:\Nik\Data\knowledge-reading-accuracy\BUILD-STATE.md` (+ `plans\PLAN-B/C/D-*.md`). Continues the 2026-10-02 section
below; where any older paragraph disagrees, this is current.

- **Raw AI bank (§0.23):** every transcript attempt and every source-check answer is banked BEFORE any rule decides
  (`Reading/PageReadingRawBank`, `PageReadingRawKeys`; `KnowledgeBlobPaths.OcrRawTranscriptBlob` / `OcrRawCheckAnswerBlob` /
  `OcrRawCheckCallBlob` under `_ocr/{biz}/{doc}/{hash}/raw/`). A rules change re-decides from answers already bought. An answer
  is banked only when replaying it gives back the same page. Page policy = `{ValidationFingerprint}:v{AdjudicationRulesVersion}:r{RenderRulesVersion}`
  (`VisionDocumentTranscriptionService.PageCachePolicy`); `AdjudicationRulesVersion` = **4** (since 2026-10-04), `RenderRulesVersion` = 1 (raise it only
  when what the model is SHOWN changes). Pins: `BankRulesVersionConventionTests` (`ThePageReadingRules_AreVersioned`,
  `ThePageRenderRules_AreVersioned`). No separate assembly version: assembly stays under the reading version.
- **Reading rules (`clinqetinfrastructure/Services/AI/Reading/`):** `PageTokens` (one tokenizer), `PageAmounts`, `PageStructure`,
  `PageAligner` (a number agrees only by its LABEL), `PageDecision`, `CheckQuestions` / `CheckAnswers`, `TextLayerAuthority`,
  `PageWriteBack`, `PageConservationAudit`. `DocumentTranscriptComparer` and `DocumentValueEquivalence` are DELETED; every
  paragraph below that names them is history. `VerificationsSpent` / `VerificationsAlreadySpent` are deleted end to end.
- **Per-check alerts are gone.** `ITranscriptionVerificationAlerts` has one member, `PublishReadingOutcomeAsync`.
  `AdminAlertType.DocumentTranscriptionVerification` stays only for stored alerts. Consumer items
  (`ReadingConsumerItemKind`, clinqetshared) ride the same alert: setup and drafts pricing items, `FactWithheld`, `TextNotCarried`,
  `ReadByAnOlderReader`, `PriceReadDifferently`, and three that are always sent: `PageCountMismatch` (`ReadingPageCount.Mismatch`:
  the file's page count ≠ the reading's page splits), `WordsNotOnCards` / `MarkupOnCards` (`KnowledgeCardCheck`: every kept word
  reaches a card body or section path; no markup on a card). The ingest checks both on a fresh reading and on the retell.
- **Section scope** (`Services/Knowledge/KnowledgeSectionScope.cs`, used by the chunker AND the inventory): nearest 3 headings,
  " › "-joined, at most 120 chars. Page rule: when a page opens on non-heading words that do not carry on
  (`KnowledgeBlock.ContinuesPreviousPage`, set by the parser, stored only in the content artefact blob) and the page before did not
  end on a heading, the path closes. Sources without pages never reset. "Coverages" under two parents is two inventory groups.
- **Banners** (`KnowledgeSectionScope.SortBanners` → `Banners(OwnCard, Riding, ContextByPage)`): a banner on EVERY content page
  is its own card once. A banner on SOME pages rides the section path of every block on those pages WHOLE, after the headings
  (`"{headings} › {banners}"`, several joined " · "); headings never give way. A riding banner that does not fit whole in 120
  chars (a long disclaimer) is its own card once instead. A banner on one page stays with its words. Tests
  `KnowledgeCardInvariantSweepTests.ALongDisclaimer_IsItsOwnCard_AndNeverPushesTheHeadingsOut`,
  `MgWindsor_AQualifierBanner_RidesEveryPriceCardOfItsPages`, `KnowledgeSectionScopeTests`.
- **Chunker:** a heading with no words of its own is a Text card under its parent (`FromHeadings`); `IsRidingCaption` is the one
  caption rule (same page, same source, no record lines, no measure, not furniture/figure text, ≤ 200 chars).
- **Tables (PLAN-C):** one span rule for HTML, Word, PowerPoint and Excel (`KnowledgeDocumentParser.TableGrid.cs`, `BuildTable`);
  `LooksLikeAHeader`; the chunker unlabels rows wider than their header (`UnlabelRowsWiderThanTheHeader`); figure text a
  neighbouring line already prints is dropped (`DropFigureEchoes`).
- **Overview cards (inventory):** aggregate cards only when a group's table cards exceed `CardTargetTokens`;
  `Voice:Knowledge:DocAggregateMinRangeValues` (3), `DocAggregateCardsWarning` (8) / `DocAggregateCardsLimit` (12) ⇒
  `KnowledgeAggregateCardsWarning` / `KnowledgeAggregateCardsLimit`. When the business space is full, overviews give way first
  ⇒ `KnowledgeOverviewsLeftOutSpaceFull`.
- **Overview seats (P1-6):** `DocSummary` / `DocAggregate` cards never take a record's seat nor count toward a document's cap.
  Phone: `Voice:Knowledge:RetrievalLookupOverviewSeats` (1) / `RetrievalBrowseOverviewSeats` (3, browse questions);
  `KnowledgeRelevanceRanker.Seat(..., countsAsSeat)` cuts only records. Business Search seats the lookup allowance.
- **Pictures:** `KnowledgePlacementCeiling.Apply` is the one placement rule (parser + the ingest's `CaptionPlacements`): one
  placement per section; past `Images:MaxSectionsPerImage` (8) the first only ⇒ `KnowledgePictureSectionsLimit`; past
  `Images:SectionsPerImageWarning` (5) ⇒ `KnowledgePictureSectionsWarning`. `KnowledgeImageExtractor` pairs figure markers with
  Document Intelligence figures PAGE BY PAGE, so a mismatch costs only that page's places.
- **Oversize pages:** `SectionStitcher` merges a cut HTML table's half only when its words outside its rows are none or equal.
- **Describe bank (AS-15):** `KnowledgeDocumentDescriber` banks {title, summary, language} at
  `KnowledgeBlobPaths.DescribeBank` (`_ocr/{biz}/{doc}/describe-{key}.json`), key = `DescribeRulesVersion` (1) + deployment +
  effort + max chars + both prompts; never the fallback. Pin `TheDocumentDescriptionRules_AreVersioned`.
- **Prune:** at both commit points the ingest deletes the other bytes' `_ocr` version folders
  (`KnowledgeVersionPruner.PruneFoldersAsync`, `IAzureStorageService.ListBlobFoldersAsync`, `KnowledgeBlobPaths.OcrVersionPrefix`);
  top-level picture and describe bank files stay.
- **"Report wrong answers"** (sheet `knowledge-wrong-answers-report`, approved): `POST api/v1/knowledge/documents/{docId}/report-wrong-answers`
  `{source: Web|Mobile}` (`KnowledgeWrongAnswerReportDto`, `KnowledgeReportSource`), `[RequiresPermission("voice.read")]`. A Ready
  file only (not FAQ, not Deleting, no replacement in flight). ‼️ NOTHING is stored: one tap = one `KnowledgeWrongAnswersReported`
  admin alert (Medium, new EventId per tap) from `KnowledgeWrongAnswerReports`; `AdminAlertProcessor` keys it by event. Bound
  `Voice:Knowledge:WrongAnswerReportsPerMemberPerHour` (10, API) via `IAiRateLimitingService`; 400/404/429 carry
  `Knowledge_ReportNotAllowed` / `_NotReady` / `_TooMany` / `_SourceRequired` (×5).
- **Tests:** `PageReadingRawBankTests`, `PageAlignerTests`, `KnowledgeTableSpanRuleTests`, `KnowledgePlacementCeilingTests`,
  `KnowledgeImageExtractorTests.AMarkerMismatchOnOnePage_CostsOnlyThatPagesPlaces`; integration
  `KnowledgeIngestPageScopeIntegrationTests`, `KnowledgeIngestOverviewCardsIntegrationTests`,
  `KnowledgePageReadingPruneIntegrationTests`; API `ProviderKnowledgeOverviewSeatTests`, `KnowledgeWrongAnswerReportsTests`.

## RECENT CHANGES — 2026-10-02 (‼️ AI Knowledge — the reader never loses what it read; ONE alert per reading. Pushed 2026-10-03, NOT deployed)

Authority: `C:\Nik\Data\knowledge-reading-accuracy\PLAN.md` + `BUILD-STATE.md`. Continued 2026-10-03 (section above).
Where an older paragraph below disagrees, this is current.

- **Why:** a logo `<figure>` whose closing mark shared a text line, plus the repeated-page-line cleanup deleting that line, left
  the figure open — pages 1–3 of a quote (43 prices) were swallowed as figure words and cleared, the row said Ready, no alert
  (NKN607 `company1_home_quote.pdf`; India MG Windsor p36 the same).
- **Repetition is never deletion** (`KnowledgeDocumentParser`): running headers, footers and logos are MARKED per page
  (`KeptFurniturePrefix` → blocks with `IsPageFurniture`), never removed; only page numbers are dropped, and recorded as
  removed. Never furniture: tag lines, open blocks, table body rows, headings, value-only lines, non-pipe lines carrying a
  price or measure. `KnowledgeChunker` carries each distinct furniture text in ONE card (`furnitureSeen`).
- **Figures and page breaks:** figure tags move onto their own lines before parsing; a new figure closes the open one (never
  clears it); a page break closes an open figure / table / code block and flushes a finished paragraph; figure text is
  `IsFigureText` and never a table caption.
- **The conservation gate** (`KnowledgeContentConservation.Missing`): every word and number of the source must be in the blocks
  (counted; NFKC; any digit to ASCII; recorded removals subtracted). A loss ⇒ `RebuildPageByPage` ⇒ a page still losing is
  saved by `PlainPage` (lossless). `KnowledgeExtractionOutput.Conservation` reports it, the content artefact banks it, and the
  ingest raises the notice `Info_KnowledgeContentNotSaved` only when something is STILL lost.
- **Tables and text:** text beside a table on the same line, and a second table on that line, are kept; markup is stripped per
  line and inside pipe cells with escapes shielded; a continuation table inherits a header only when the column kinds agree;
  price runs put each banner back at its own page edge (`AddRunWithBanners`).
- **Assembly:** `PageMarkdownSplicer.CarryFigures` and `SectionStitcher.AddToFigure` write figure marks on their own lines,
  never inside a table, anchored on markup-free text with an occurrence rank; `KnowledgeText.JoinAtHyphen` never joins onto a
  list, table or markup line. Pinned under `AdjudicationRulesVersion` (2 since 2026-10-03).
- **One alert per reading:** `ReadingOutcomeReport` → `TranscriptionVerificationAlerts.PublishReadingOutcomeAsync` (items from
  `ReadingOutcomeItems`): content lost or a rule broke (always sent), values nobody confirmed, a value only one reading has, a
  line dropped, setup's pricing items. Types `KnowledgeReadingNeedsReview` / `ProviderSetupReadingNeedsReview`; deterministic
  EventId (flow, business, document, hash, reader build, SHA-256 of every reading and loss count, sorted); `AdminAlertProcessor`
  keys both by EventId. Bounded for the queue (readings cut to `MaxDiscrepancyExcerptCharacters`, at most
  `MaxDiscrepanciesPerVerification` items, body ≤ 192 KB). The knowledge ingest sends it right after the committed-row check,
  never on a replay, and the "already Ready" exit re-tells it; a page past the check limit alerts only a number or a whole
  line (`ValueNotChecked`). The per-check alerts were removed 2026-10-03; AI setup and the drafts job send this alert too.
- **Picture text:** the loss report of text read out of a picture joins the document's (`KnowledgeReadingConservation.Combine`).
- **Notices:** `Info_KnowledgeValueUnconfirmed` retired (it fired on any unsettled label); new `Info_KnowledgeContentNotSaved`
  and `Info_KnowledgeDraftPricesToCheck` (+`_One`, restated on every drafts outcome, removed once nothing from the file waits),
  five languages; the API falls back from `_One` to the plural, then skips a notice no language file words; a duplicate upload
  keeps the survivor's notices.
- **Screens (partner web + phone):** the moving "Reading" bar is gone; picture Delete confirms inside the viewer; access sentences
  follow the file's real access (`receptionistReachesCallers`, `pictureSendBlock`); the notice ✕ and "Read again" need
  `voice.settings.manage`.
- **Storage:** the `_ocr/` page bank cools after 30 days unused and is deleted after 180 days unused (last-access tracking).
- **Tests:** Communications `KnowledgeReadingLossRegressionTests`, `KnowledgeContentConservationTests`, `ReadingOutcomeAlertsTests`,
  `AdminAlertProcessorTests`, the ingest's `ContentTheReaderLost_*`; API `KnowledgeControllerTests`.

## RECENT CHANGES — 2026-09-25 (AI Knowledge — Phase 4 closing audit, fixes BUILT + GREEN, owner pushes and deploys)

Authority: `C:\Nik\Data\knowledge-extraction-fix-plan\phase-4\FINAL-AUDIT.md` (ids `P4-*`). Where an older
paragraph below disagrees, this section is current.

### Ingest (`KnowledgeIngestProcessorFunction`, Functions host)
- ‼️ **A terminal failure mid-rewrite never keeps the mixture (P4-C-01).** `FailAsync` with `CardsRewriting == true`
  deletes the cards, stamps `Failed` with `PassageCount` 0 and raises `KnowledgeFailedMidRewrite`
  (`ReportCapacityPressureAsync`). The only exception to "a document whose cards still answer stays Ready".
- ‼️ **Every transient ingest failure rides the SCHEDULED retry (P4-C-05).** `KnowledgeAnalyticsFailureClassifier.IsTransient`
  now also covers embedding / search / Cosmos / storage transport failures and `SearchAiCacheUnavailableException`;
  an embedding result whose `Failure` is Throttled/Unavailable throws `KnowledgeIngestRetryableException`. Both go to
  `ShouldRetryLater` (bounded by `IngestRetryAttempts` 5), never an instant redelivery. The attempt-budget alert is
  raised on that path too.
- ‼️ **Vision outage: retry, then alert (P4-B-21, owner decision).** A page lost to a throttle / timeout / transport /
  AI HTTP 401·403·404·408·429·5xx (`AiTransientFailure.IsTransient`) counts in
  `VisionDocumentTranscription.PagesFailedTransiently` (a subset of `PagesUnreadable`). While
  `Attempt < IngestRetryAttempts` the document throws `KnowledgeIngestRetryableException` and waits (read pages stay
  cached); after that it keeps the machine reading with the `PagesUnread` notice and a FORCED, ungated admin alert.
  A burst outage can hold a document in Processing ~70 min. An outage-empty reading ends `Error_KnowledgeGenericRetry`,
  never `Error_KnowledgeUnreadable`.
- **Kept-previous notices name an outage (P4-C-06).** `Info_KnowledgeReplacementNotFinishedKeptPrevious` /
  `Info_KnowledgeReReadNotFinishedKeptPrevious` (×5) for `Error_KnowledgeGenericRetry` and
  `Error_KnowledgeImageDescriptionsUnavailable` (`KnowledgeReadingNotices.KeptPreviousFor`); `ReadingAgainWouldHelp`
  offers Read again for the re-read one.
- ‼️ **The index must show THIS run's cards (P4-C-08; owner: no nightly job).** `TheIndexShowsThemAsync` needs count > 0
  AND the last card's stored `updatedAt` to be this write (`IKnowledgeSearchIndexer.GetCardUpdatedAtAsync`, point
  lookup, ±1 s); otherwise one re-upsert, then not Ready + `KnowledgeIndexDidNotTakeCards`.
- **Password-protected PDF (P4-B-31):** `DocumentPageCounter.TryCountPdfPages(bytes, out passwordProtected)` (PdfPig
  `PdfDocumentEncryptedException`) ⇒ `Error_KnowledgePasswordProtected` BEFORE Document Intelligence is paid.
- Metadata merge measures cards with `KnowledgeChunker.ApproxTokens` (script-aware), not chars/4 (P4-C-07). A container
  parser's `InProcessParseException` ⇒ `Error_KnowledgeUnreadable`, never an outage retry (P4-B-12). A continuation
  pass never reads or replays the banked artefact (P4-B-09).
- ‼️ **A follow-up message is DERIVED, never rebuilt (P4-B-27).** `KnowledgeIngestQueue.Retry` / `.Continuation` are
  `current with { … }`: a retry is the same message one `Attempt` later, a continuation the next `Continuation` with
  the SAME `Attempt` (one back-off per READING — `StaleProcessingMinutes` is derived from exactly that). Both carry
  `ForceFresh`, `PagesBankedSoFar`, `AiAttemptsSpent` and `VerificationsSpent` (the reading's totals, this delivery
  included) and `ReadingEpoch` = the row's `UpdatedAt.Ticks` when the reading was queued (`KnowledgeIngestQueue.NewReading`,
  which the API's `KnowledgeManagementService` uses too). Ids: `{biz}:{doc}:{mode}:{ticks}` first, then
  `…:{epoch}:retry{attempt}` / `…:{epoch}:continue{n}` — two readings of one document never share a follow-up id.
- ‼️ **ForceFresh belongs to the READING (P4-B-27 / P4-J-21).** Every cache on the repair path stamps the reading that
  banked it — the vision page (`CachedPage.Reading`), the whole-document and the picture Document Intelligence reads
  (`KnowledgeExtractionCacheKey.Reading`, stored in the entry) — and a forced-fresh reading reuses ONLY its own
  (`ThisReadingOnly`; an unstamped 0 is never "its own"). Fresh survives a continuation without re-reading every page,
  and the pass that reaches the pictures still skips the business-wide caption map.
- (2026-10-03: `VerificationsSpent`, `VerificationsAlreadySpent` and `DeliveryVerifications` are deleted; check answers are
  banked per question in the raw bank and replay free. The two bullets mentioning them are history.)
- ‼️ **The source-check ceiling is per DOCUMENT reading (P4-B-23).** `VisionDocumentRequest.VerificationsAlreadySpent` =
  `message.VerificationsSpent`; `PagesVerified` is reported on a budget cut too; a retry adds what this delivery bought
  through `DeliveryVerifications` (a `StrongBox<int>` in an AsyncLocal, set in `Run`, filled when the vision call
  returns). A page past the ceiling that kept the machine reading is banked with its unsettled review. `PagesBanked`
  counts every page actually banked — blank and machine-kept pages included, a failed cache write excluded — or a pass
  whose new pages were all blank looked like no progress and stopped the reading.
- ‼️ **A storage hiccup while reading the file waits and retries (P4-C-19).** A download failure that
  `KnowledgeAnalyticsFailureClassifier.IsTransient` calls transient (408 / 429 / 5xx, I/O) throws
  `KnowledgeIngestRetryableException` ⇒ the scheduled retry. A missing blob, or one whose size changed mid-read
  (`EndOfStreamException`), still ends the reading.
- **"Descriptions unavailable" goes through D-1 like every other failure (P4-C-15).** No private keep branch:
  `TerminalFailureAsync(…, "Error_KnowledgeImageDescriptionsUnavailable")` ⇒ `FailAsync` keeps the answering version
  with its notice and lets a replacement's candidate go. The admin alert stays (raised when `PassageCount > 0`).
- ‼️ **`ContentHash` is never cleared (P4-C-12).** It names the version still answering. Read again, an admin reindex
  and a re-cut (`BeginRecutAsync`) keep it; the identical-content exit (Case C) is for a REPLACEMENT only
  (`PendingBlobPath != null` + same hash + `PassageCount > 0`), so a re-read of unchanged bytes still reads. The twin
  lookup `FindByContentHashAsync(businessId, hash, excludeDocId)` never finds the document itself.
- ‼️ **Saved versions are per set of BYTES (P4-C-13).** The saved parse `{biz}/_artifacts/{docId}/{hash}.json.gz` and
  the whole-file Document Intelligence read `{biz}/_di/{docId}/{hash}.json.gz`, so a replacement being read never
  overwrites the version still answering. `KnowledgeBlobPaths.*Prefix` has no trailing slash: a canonical docId is
  fixed-length, so the prefix also sweeps the earlier single-file layout. After a Ready commit
  `PruneAsync(biz, docId, keepHash)` deletes every other version (fail-soft, `KnowledgeVersionPruner`, ≤ 32 listed); an
  abandoned replacement prunes to the KEPT hash; the purger deletes both prefixes. ‼️ No read falls back to the old
  single-file path (pre-prod, no old paths): a document read before this build has no stored text until it is read
  again.
- ‼️ **Reading runs on `gpt-5.6-luna` (P4-B-38, owner 2026-09-25).** `AiModels.Reader` for every call that LOOKS AT a
  provider's page or picture: page transcription (knowledge + setup), picture descriptions (knowledge + setup), the draft
  picture checks (`ImageMatchVerify*`), setup `ServiceVerify`/`ProfileVerify` and `VisionAiDeploymentName`. Text-only work
  stays on `gpt-6-luna`, the verifier on `gpt-6.1-sol`. Live, `gpt-6-luna` invented Gujarati service names and dropped a
  price digit. The reader rejects temperature 0, so it is the one entry in `AIService:DefaultTemperatureOnlyDeployments`.
  `deploy.ps1` provisions it (RAI filter) and maps `Voice__Knowledge__Vision__TranscribeDeploymentName` and
  `AzureDocumentIntelligence__VisionAiDeploymentName` to it; those app settings override `appsettings.json`. The model
  name is part of the page-cache key, so a switch re-transcribes every page once. The quote-photo category check (C3,
  `BroadcastClassification:VisionDeploymentName`) runs on the reader too: 90.1% right on 29 labelled photos (2026-09-02).
- **Picture reserve (P4-B-29).** `VisionDocumentRequest.PicturesToDescribe` = min(Document Intelligence figures,
  `Images:MaxImagesPerDocument`), 0 when descriptions are off. The reading leaves `PipelineReserveFor(n)` =
  `PipelineReserveSeconds` (180) + `PipelineReservePerPictureSeconds` (10) × n before the delivery deadline. After the
  Ready commit, work that outran it raises `KnowledgePipelineReserve` (capacity pressure) though the document
  committed; running out of time is still `KnowledgeIngestTimeout` + retry. The reading's own `TimeBudgetSeconds` (900)
  usually stops it first.

### Vision and pictures
- **Verifier (P4-B-01):** a separate `notOnPage` in the schema; `DocumentVerificationReading(RegionId, Text, Unreadable,
  NotOnPage = false)`; `AnsweredNotOnPage` requires `NotOnPage`; an unreadable or over-long answer is "no reading"
  (line kept); answer bound = max(`MaxDiscrepancyExcerptCharacters`, 2 × the longer reading).
- Document Intelligence 401/403/404 and the 400s `ContentSourceNotAccessible` / `UnsupportedApiVersion` /
  `ModelNotFound` are transient, not "unreadable" (P4-B-11). `AiAttemptBudgetExhaustedException` is never swallowed —
  classifier, verifier, picture transcription, image lane, top-up and describer rethrow it (P4-B-28). The describer
  fences file name / headings / text in `<document_text>` and the re-ask quotes in `<left_out>`, as DATA (P4-B-35).
- ‼️ **Page-cache key moved once.** The transcribe prompt asks for a header row only where the page prints one
  (P4-A-02) and `VisionTranscriptionSettings.ValidationFingerprint` gained 8 acceptance dials (P4-B-22): every banked
  OCR page is re-read once on its next reprocess. API `AIAssistant:ProviderAttachmentProcessing:Vision:TranscribePromptTemplate`
  is byte-identical to the Functions copy (`OcrPageCacheKeyTests`).
- A JPEG past the decode ceiling is decoded at a reduced DCT scale (≤ 1/8 per axis), a PNG is still refused (P4-B-04);
  a TIFF source check decodes only the frames up to the asked page (P4-B-32).
- Pictures: a photographed table goes through `ParseLayoutMarkdown` at its marker's page (P4-B-06); every STORED
  picture carries a ref while descriptions are on, none while off (P4-B-07); a picture reads as text only with
  `ImageCaptioningEnabled` (P4-B-15); a throttled description keeps the previous caption on the card and the ref and
  is never banked as `CaptionRefused` (P4-B-14/20); caption reuse needs only the exact context-hash match (P4-B-24);
  a picture transcript is cached under `_ocr/{businessId}/{docId}/{pictureHash}/…`, inside the purger's prefix
  (P4-B-25); `MaxTranscribedPictures` counts ATTEMPTS (P4-B-26); the in-run look-alike fingerprint is DELETED — a
  description is reused only for the same bytes beside the same words (P4-E-26 AR-X1).
- **A picture's Document Intelligence read is banked (P4-B-26 / J-12)** at `_ocr/{biz}/{docId}/di-{pictureHash}.json.gz`
  (`KnowledgeBlobPaths.PictureDocumentIntelligenceCache`, inside the purger's prefix), matched on the SHA-256 of the
  NORMALIZED bytes it was handed + model + format — a normalization change reads again.
- **Pages are read upright (P4-B-37.3).** `PageOrientation.QuarterTurnsToUpright(angle)` turns a page Document
  Intelligence measured at |angle| ≥ 45° by the nearest quarter turn (angle clockwise, (-180, 180]); a slight skew is
  never resampled. Applied to the reading model's page (`VisionDocumentRequest.PageAngles`) and to the verifier's
  render (`DocumentVerificationRequest.PageAngle`).
- One layout-difference alert per DOCUMENT, pages in order, capped by `MaxDiscrepanciesPerVerification` (P4-B-37.4).
  A pass that will be carried on never pays to bind its pictures — `CarriesOn` is the one pure rule both the
  extraction and the continuation ask (P4-B-37.1).
- **Two notices, not one (P4-B-37.6):** pages an outage kept from the model (`PagesUnread`, Read again helps) vs pages
  the model refused or cut off (`Info_KnowledgePagesNotReadable`, `_One` singular, Read again does NOT help);
  `VisionPagesFailedTransiently` is banked in the artefact so a replay says the same.
- A replay reports the pictures its run could not read (`KnowledgeContentArtifact.UnreadablePictures`, P4-B-30). TIFF
  decode ceilings use EACH frame's declared size (`TiffFrameSizes.TryRead`, classic + BigTIFF, P4-B-32). A PDF page
  whose letters are ≥ 80 % invisible (render mode Neither/NeitherClip — a scanner's OCR overlay) has no trusted text
  layer (P4-B-19). The summary fact check ends sentences at 。！？ ؟ ۔ with no space after them (P4-B-37.5).

### Parsers (`clinqetinfrastructure\Services\Knowledge\`)
- One header rule `DeclaredHeaderRowIndex` (P4-A-12): up to 2 one-value TITLE rows may sit above the first declared
  label row (XLSX freeze now declares every frozen row, plus filter and table; DOCX a contiguous `w:tblHeader` block;
  HTML th/thead per row); title rows become the table Caption, and the chunker's context line skips them.
- The one-item-per-paragraph coalescing now fires on PDF / image / .md / .txt (`IsOneLineParagraph` trims) (P4-H-03);
  the EX-24 count is per ENTRY, a mixed priced/terms heading gets no count (P4-A-10); `!important` and CSS comments no
  longer defeat hidden-content removal (P4-A-14); XLSX built-in formats 1–4 and any plain numeric format show their own
  decimals, a currency in letters (`[$Rs.-4009]`, `[$CAD]`, `"kr"`) is kept (P4-A-18); phonetic runs (`rPh`) are never
  glued into a cell (P4-A-19); a declared legacy charset decodes via `CodePagesEncodingProvider.Instance`, nothing
  registered process-wide (P4-A-20); a floating box holding a table or heading is read by the body rules (P4-A-21);
  JSON booleans read `true`, a scalar root is its value (P4-A-30); outline and section cuts end on a text element
  (`KnowledgeText.CutAtTextElement`, P4-A-31); `MergeSmallTail` never merges a tail from another page (P4-H-36).
- `KnowledgeTokenEstimate` weights each script at its own rate (P4-A-26): mixed-script text budgets MORE, one-script text
  is unchanged. Shared with retrieval and MCP.
- DocumentFormat.OpenXml 3.3.0 repairs a malformed relationship URI itself on a SEEKABLE stream (every lane passes a
  MemoryStream); `RelationshipErrorHandlerFactory` is a 2.x API and does not exist here (P4-B-12).

### Drafts (Clinket AI Data Analytics)
- ‼️ `ServiceDrafts:TimeoutSeconds` 3600 → **2400** (below the 45-min host `functionTimeout`; clamp 1..3600 unchanged) and
  `QueuedStaleAfterMinutes` 180 → **240**, class + both hosts; the convention test reads `host.json`. Never keep
  `Voice__Knowledge__ServiceDrafts__TimeoutSeconds` as a standing app setting: it was a one-off test dial (2026-09-15, set to 30 to prove the timeout branch, absent on the refreshed sandbox), and a portal value silently overrides the file.
- `KnowledgeServiceDraftBuilder.CarryProviderAnswers` carries only when `EditedAt != null`, and now carries
  `TaxIncluded`, `TaxRate`, `PlacementEditedAt`, `EditedAt`; `NeedsReview` / `CurrencyMismatch` only widen (OR) (P4-D-02/04).
- A draft the pending cap trimmed is never remembered as decided (P4-D-03). Approve-update keeps the live service's
  `TaxIncluded`/`TaxRate` on a price change (P4-D-11). The job re-judges `PriceBeyondReviewCeiling` in the business's
  own currency after extraction — the strict extractor schema has no currency (P4-H-05).
- DELETED (owner: do not build): `AdminAlertPriceMultiplier`, `MaxAllowedPriceByCurrency`,
  `PriceReviewCeiling.AdminAlertFor` and the `overrides` parameter — it is `PriceReviewCeiling.For(laneDefault, currency)`
  over `DefaultMultipliers` (P4-D-10/G-05).

### Settings and housekeeping
- `Voice:Knowledge:StaleProcessingMinutes` 160 → 330 → **560** (2026-09-30, W4 picture passes; class + both hosts): above
  (1 + `MaxReadingContinuations` + `Images:MaxPicturePasses`) deliveries × `IngestTimeoutSeconds` + back-off,
  convention-tested in both hosts (P4-C-09/B-36).
- Orphan-upload sweep (P4-J-02): counts SOURCE blobs only (`{businessId}/{docId}/…`) and resumes from
  `_maintenance/unconfirmed-upload-sweep.marker`; `ListBlobNamesOlderThanAsync(container, prefix, olderThan, max,
  startAfter, include, ct)`.

### Retrieval (`ProviderKnowledgeSearchService` + MCP `KnowledgeTools`)
- ‼️ **Four new scripts (P4-E-02):** `Orya` (Odia), `Knda` (Kannada), `Mlym` (Malayalam), `Sinh` (Sinhala) — 19 in
  `TextScriptDetector.KnownScripts`, native digits for the first three (modern Sinhala writes ASCII). `search_knowledge`
  gains `queryInOdia` / `queryInKannada` / `queryInMalayalam` / `queryInSinhala`. ‼️ **PDF faces shipped 2026-09-25:** Noto Sans Kannada,
  Malayalam, Oriya (Odia) and Sinhala, Regular + Bold (8 files, ~1.15 MB, official notofonts build), one render test per
  script in `MaterialInfoPdfTests`. Han/Japanese/Hangul stay CLOSED
  (owner, 2026-09-16). `SpeechCandidateLocales.ByScript` has no kn/ml/or/si locale yet.
- **Leg cap (P4-E-01):** over `RetrievalMaxQueryLegs`, the business's resolved alphabets keep their seats and a
  caller-only language gives way (`KnowledgeTools.PreferTheBusinessAlphabetsAsync`); a business alphabet the cap still
  leaves out is named in `NotSearchedIn`. An unresolved lookup changes nothing.
- **`KnowledgeSearchQuery.WidenWhenNarrowedFindsNothing`** (P4-E-08, init-only, default false): F5's unnarrowed retry runs
  ONLY for a caller that sets it — the phone's `search_knowledge` does; `ProviderCatalogAnswerService` does not.
- ‼️ **Per-call search cutoff (P4-J-14):** once the call's catalogue allowance refuses, `search_knowledge` stores
  `mcp:knowledge-lookups-exhausted:{callId}` in `IMemoryCache` (`Size = 1`, TTL `Mcp:SessionTtlMinutes`) and every later
  search in that call returns the exhausted result before any embedding or leg.
- ‼️ **`IsScopedTo` (P4-H-14):** the business scope must be the whole filter or be followed by ` and `, with NO top-level
  `or` after it (quote- and paren-aware) — else `CatalogIsolationException`.
- `MaxDocIdsInFilter` 500 → **5,000** (P4-E-06). The envelope is costed per passage at its own script's rate (P4-E-07).
  `FoldDigitsToAscii` folds every Unicode decimal digit and an Arabic-script leg searches both zeros U+0660/U+06F0
  (P4-A-25). A widened search whose every leg fails is Unavailable, never None (P4-E-15). A cell lookup that failed
  (`Unavailable`/`UnknownCell`) makes the alphabet set Unresolved, never "Latin only" (P4-E-05).
- ‼️ **The alphabet set re-checks the registry (P4-J-07).** `BusinessAlphabetService` (a singleton in the API, MCP and
  Functions hosts) keeps a set until `CacheMinutes`, but at most every `BusinessSearch:Scripts:RevalidateSeconds` (60,
  all three hosts) it reads the registry's newest write — `IKnowledgeDocumentRepository.GetLatestChangeAsync` =
  `SELECT VALUE MAX(c.updatedAt)` over the business's document rows, one partition, served by the existing
  `/updatedAt/?` path — through `IServiceScopeFactory` (the repository is scoped), inside the single-flight lookup,
  BEFORE the facets. Same stamp, or a failed read with a set in hand ⇒ the set stands and only its check time moves;
  a new stamp ⇒ the facets are asked again. A business's first document in a new alphabet is searched in it about a
  minute after it is Ready, not up to 30; the phone's first prompt carries the set inside the provider context, which
  keeps its own `ProviderContextCacheMinutes` (5) on top. A delete that leaves the newest row in place can leave one
  empty leg until `CacheMinutes` (cost only, never a missing leg).
- The picture allow-list follows R-10 like every other read (`ListSendableImageRefsAsync` uses
  `KnowledgeAnswerableRule.CosmosStatusFilter`), so a document being re-read still sends its pictures (P4-E-14).
- A material PDF is right-to-left when right-to-left words are ≥ 40 % of its directional words
  (`QuestPdfService.IsRightToLeft`, the Closure/Google `estimateDirection` rule); each span still gets its own direction,
  so one Arabic or Hebrew word no longer flips an English sheet (P4-E-23). The layout is pinned by reading the printed
  page back (P4-H-16, `MaterialInfoPdfTests.ARightToLeftSheet_IsPrintedRightToLeft`). ‼️ **The business phone is its
  own left-to-right line on a right-to-left sheet (P4-E-25):** digits take the page's direction, so it printed
  `+1 905 555 0100` as `0100 555 905 1+`. `ComposeMaterialHeader(…, rightToLeft)` right-aligns it under the name with
  `ContentFromLeftToRight()`. Measured dead ends: QuestPDF's per-span `DirectionFromLeftToRight()` changes nothing
  here, and LRI/PDI isolates leave a space glyph at each end of the number in the PDF's text.
- Indexer: `HasEmbedding` is set by the indexer after its vector check (P4-E-19); `contentCjk` is also written when the
  body holds ANY Han/Kana (P4-E-24); the card hash covers docTitle + sectionTitle + content (P4-E-13); prune and delete
  take the per-document lease (P4-E-12); a zero-card AI-cache artefact is deleted (P4-E-24).
- ‼️ **D-26 (P4-E-09):** the knowledge `contentVector` is `IsHidden = true, IsStored = false` — no vector can be read back
  from the index. A rebuild re-embeds (`reindex-knowledge`) or, from search-topology Phase 5, reads the blob AI cache.
  See `clinqet-search-discovery`.

## RECENT CHANGES — 2026-09-15 (‼️ KEEP YOUR OWN NUMBER — the provider's existing mobile forwards to their Clinket DID. BUILT + GREEN, owner deploys)

Authority: `Data\myequal-call-forwarding-review\PLAN.md` §17 (rulings §14). Sheet:
`Data\mockups\voice-keep-your-number\index.html` (registered, PLAN §16).

**What a provider now does.** Keeps advertising the number they already have, dials two carrier codes, and every call
they miss lands on their assistant. The Clinket number keeps working unchanged.

### The two rules that must never move

1. **Loop safety is keyed on INTENT, never on verification** — `VoicelineProjection` (infrastructure,
   `Services/Voice`) is the ONE place the application decides how a `Voiceline` routes. `NumberMode ==
   ForwardExisting` ⇒ `ForwardTo = ""` **from the moment the codes are issued**, and `AlwaysOnMiss → AiFirst`
   (`AfterHoursOnly` kept; answers-all ⇒ `AiFirst`). The provider's phone is the forwarding SOURCE, so dialling it
   loops the call back onto this DID (§5.1). `AiFirst`/`NeverAnswer` are LOCKED in own-number mode
   (`IsModeLockedForOwnNumber`), and connect normalises a locked mode to `AlwaysOnMiss`.
2. **The verification call IS the proof of ownership** — no code, no SMS. The API writes ONE
   `voicecheck_{businessId}` doc (SystemData, id = pk, TTL `Voice:OwnNumber:CheckTtlSeconds`, create-if-absent =
   the single flight, ETag CAS for every transition) and enqueues `VoicePostCallKind.StartOwnNumberCheck`. The
   Functions coordinator dials the provider; **arrival on the DID from the verification caller, WITH a live doc, is the
   proof** — both conditions, always. A spoofed `From` alone proves nothing.
3. ‼️ **A DISCONNECT IS PROVEN BY A CARRIER EVENT, NEVER BY SILENCE** (round-2 audit, 2026-09-16) —
   `VoiceOwnNumberOutcomes.Succeeded` requires `state == Failed` for `Disconnect`: the carrier ended the call and it
   did not reach us. `TimedOut` means NO event arrived at all, which is exactly what a lost webhook on a line that is
   STILL forwarding looks like; calling that proof re-points the DID at a phone that forwards back to it (§5.1).
4. ‼️ **A FORWARD THAT ARRIVES AFTER THE VERDICT IS STILL OUR LEG** — `TryMarkArrivedAsync` returns true for a
   terminal check whose `VerificationCaller` matches, so the ingress declines it. Answering it would open a session,
   meter minutes and send the provider a summary of a call the platform placed itself. The whole probe is also
   wrapped fail-soft: it runs on EVERY inbound call before a session exists, so a store outage must cost the
   verification verdict, never the customer's call.
5. ‼️ **EACH CARRIER'S WEBHOOK DECIDES "MACHINE", THE COORDINATOR NEVER PARSES ONE** —
   `HandleOutboundMachineDetectionAsync(..., bool machineDetected, ...)`. Telnyx's premium screening EVENT carries no
   result field and Plivo answers `"true"`, not `"machine"`. The test call also uses premium iOS-screening whenever
   `VoiceCall:PremiumAmdEnabled` is on — plain "detect" cannot see an iPhone voicemail, and a wrong verdict offers the
   one fix that cannot work. On Plivo the verify-answer hold always outlives `Plivo:AmdDecisionTimeMs`.
6. ‼️ **THE OWN NUMBER CHANGES IN THE WIZARD OR NOWHERE** — `SaveApplicationAsync` throws
   `Error_VoiceOwnNumberChangeViaWizard` when an ACTIVE assistant in `ForwardExisting` mode is handed a different
   `ForwardingTarget`, and both settings forms render that field read-only. That field IS the verified line: the
   carrier, the dial codes, the measured ring and the proof all hang off it, and none of them are re-derived there.

### ‼️ A VERIFICATION CALLER IS NEVER BORROWED ACROSS CALLING CODES (owner ruling 2026-09-15, relaxed 2026-09-16)

`voicecfg_{iso}.verificationCallerNumber` (file value `Voice:OwnNumber:Countries:<ISO>:VerificationCallerNumber` until a document exists), **API stamp only**. The API stamps the business's country
caller onto the check document; **the Functions host holds no number and dials from the document**. Every configured
caller is auto-refused as a connect target without being listed in `BlockedNumbers`.

**Countries that share a calling code MAY share one number** — CA and US both carry `+18449254651` (owner ask
2026-09-16), because to a Canadian or American provider it is a local +1 caller either way. **A country on a
DIFFERENT calling code never may**: `VerificationCallers_AreValidE164_AndNeverBorrowedAcrossCallingCodes`
(`Clinqet.API.UnitTests`) fails the build if India's caller starts `+1`, so a provider in Ahmedabad can never be
rung from a North-American number.

‼️ **India's `+919999999999` is a PLACEHOLDER** (owner instruction 2026-09-16: open every region now, replace
the number when it lands). It is valid E.164, so the country reports available and the whole flow runs — but Plivo
will refuse to dial from a number the India account does not own, so **every India check fails at the dial** and
the coordinator raises the unplaced-dial admin alert. An EMPTY caller still makes a country report
`UnavailableReason = NotConfigured` (fail-closed); that is what US carried before this change.

### ‼️ THE OPERATIONAL SETTINGS LIVE IN COSMOS, ONE SET PER STAMP (owner 2026-09-17, §0.7 approved)

The file (`Voice:OwnNumber`) keeps only what a country IS — `CallingCode`, `NationalNumberLength`, `Aliases`,
`BlockedPrefixes`, `CdmaCarriers`, `Codes` — plus the timers/limits both hosts read. What an admin changes without a
deploy lives in **SystemData, id = pk, point reads only**: `voicecfg_{iso}` (`enabled`, `verificationCallerNumber`,
`certifiedCarriers` as a LIST of `{carrier, seconds}`) and `voicecfg_platform` (`ringSeconds`, `ringSecondsOptions`,
`untestedMaxRingSeconds`, `blockedNumbers`). Absent doc ⇒ the file's values; present ⇒ REPLACED whole
(`VoiceOwnNumberConfigResolution.Resolve`, the ONE merge), an empty stored caller stays empty (fail-closed).

- ‼️ **TWO STAMPS, TWO STORES, TWO ADMIN PORTALS.** A stamp serves `PaymentSettings.Regions` ∩ the file's countries
  (`VoiceOwnNumberConfigResolution.ServedCountries`) — NA = US+CA, India = IN, set per stamp by deploy.ps1. An
  unserved country KEEPS its numbering plan (so a business whose primary address is in India resolves to India on the
  NA stamp, never to its Canadian branch) but loses its caller and carriers and is never enabled; its document is never
  read. Admin ⇒ 403; provider ⇒ `UnavailableReason = Region`; the India blocked list refuses a +1
  (`ValidatePlatform` takes the served list).
- ‼️ **`Payments:Regions` has an EMPTY class default and NO base appsettings value** (proven 2026-09-17: the old
  `us,ca,in` default + base list bound India's `in` as `us,ca,in,in,ca,in` — every stamp served every region, for
  billing too). Local runs get it from `appsettings.{ca,in}.json`; `PaymentServedRegions.Validator` (API only)
  refuses to boot on an empty, repeated or unknown list. Guard: `PaymentServedRegionsConventionTests` binds the
  REAL file through the real binder.
- ‼️ **`certifiedCarriers` is a list, never a dictionary**: `ClinqetCosmosSerializer` camel-cases dictionary KEYS, so
  "Rogers" was stored as "rogers" and "AT&T" would be "aT&T". A case-insensitive lookup in the test HID it.
- **Runtime** `IVoiceOwnNumberConfigProvider`: 24 h cache (`ConfigCacheHours`), Size = 1, static reset token captured
  BEFORE the reads, Cancel-never-Dispose. ‼️ A failed read NEVER mixes store and file values (that resurrected a retired
  caller or a disabled country): it serves the last good snapshot, or the file WHOLE on a cold start, cached only
  `ConfigRetrySeconds`. Other instances see a save within `ConfigCacheHours` (owner's RU trade-off); a 409/412 save
  also invalidates, because a retried write that had committed lands there. Input limits are
  `ConfigMaxCertifiedCarriers`/`ConfigMaxCarrierNameLength`/`ConfigMaxBlockedNumbers`.
  **Admin** `api/v1/admin/voice-config` reads the store directly and fails hard (a form built on file values would
  overwrite the record); no ETag ⇒ Create (409 if it exists), ETag ⇒ Replace IfMatch; 409/412/404 ⇒ 409. Audit
  partitions `auditcfg_voice_{iso}` / `auditcfg_voice_platform`.
- **`VoiceClinketNumbers`** is the one definition of "our numbers" (resolved callers + blocked list) — refused as a
  connect target, a ring-through forward target, and an assignable/quotable DID. `VoiceOwnNumberConfigRules`:
  ring times 5–30 step 5 (3GPP TS 22.082), caller must carry the country's calling code and length, not blocked, not
  a business's voiceline; a caller can be REPLACED but never REMOVED (connected providers need it to disconnect).
- **Turning a country off stops NEW connections only**: `RequireDialable` still lets a Disconnect check run, and both
  cards show the Disconnect control in the gated state when `intended && codes.clear` (`canDisconnectWhileUnavailable`).
- **Seeding** (`cosmosindexsetup/VoiceOwnNumberConfigSeeder`, from `VoiceOwnNumberDefaults`): region-scoped, create if
  absent, KEEP what exists in every environment (the store is the authority once a doc exists), throw on a foreign
  document type under the id. Tests pin the file defaults to `VoiceOwnNumberDefaults`.

### The pieces

| Layer | What |
|---|---|
| Shared | `VoiceOwnNumberSettings` (+`VoiceOwnNumberCountrySettings`/`…CodeTemplates`), 6 enums (`VoiceOwnNumberCheckPurpose/State/Outcome`, `VoicePhoneLineType`, `VoiceDialCodeFamily`, `VoiceOwnNumberUnavailableReason`), `PhoneNumberLookupResult`, `VoiceOwnNumberDtos`, 2 `VoicePostCallKind` members, 3 `NotificationType` members, `AnalyticsEventType.VoiceOwnNumberAction` |
| Core | `VoiceOwnNumberCheck` entity · `VoiceAssistantApplication.OwnNumber` (§0.7 (A)+(B), approved) · 4 interfaces |
| Infrastructure | `VoiceOwnNumberService` (gates, intent, single flight, limits) · `VoiceOwnNumberStatusBuilder` (the card model on EVERY state response — no second read) · `VoiceOwnNumberDialCodes` (renders `*004*{did}#` / `**61*{did}**{seconds}#` / `##002#`, CDMA `*71{did}`/`*73`; `{did}` = the Clinket number in NATIONAL digits) · `VoiceOwnNumberCountryResolver` · `VoiceOwnNumberOutcomes` · `VoicelineProjection` · `PhoneNumberFormat` · `VoiceAssistantProfileMutator` · `VoiceOwnNumberCheckRepository` · `{Telnyx,Plivo}NumberLookupService` |
| API | 7 routes under `voice-assistant/own-number` (mutations = SENSITIVE `voice.number.manage` + live re-check; reads = `voice.read`) + 2 admin answers-all routes |
| Functions | `VoiceOwnNumberCheckCoordinator` · arrival short-circuit in BOTH ingress functions · 3 Plivo routes (`verify-answer`/`verify-amd`/`verify-hangup`) · 2 processor kinds |
| UI | web `components/Profile/voiceAssistant/ownNumber/*` (wizard in a modal) · provider app `Screen/ProfileFlow/VoiceAssistant/ownNumber/*` (wizard is its own gated SCREEN `VoiceOwnNumberConnect`) |

### What the settings mean (asked 2026-09-15, answered here so nobody guesses)

- `CallingCode` — strips the country code so the dial code carries NATIONAL digits (proven live:
  `*004*2364767193#`), and refuses a number that does not belong to the business's country.
- `VerificationCallerNumber` — E.164 **with the `+`**; it is the `from` of the test call.
- `BlockedPrefixes` — matched against the START of the national number (premium/service ranges): CA/US `900`,
  IN `0`, `1800`, `1860`.
- ‼️ **EACH REFUSAL RULE SAYS WHICH RULE REFUSED** (live-debugged on the CA stamp 2026-09-16, owner-reported).
  Typing our OWN verification number answered "that looks like a premium or service number", which sends a provider
  hunting for a fault in a line that is fine. Our numbers (verification callers + `BlockedNumbers`) now answer
  `Error_VoiceOwnNumberIsClinketNumber`; only a real premium/service prefix answers the premium sentence. Same
  400, different sentence — the shape of the response did not change.
- ‼️ **`BlockedNumbers` SHIPS EMPTY, and only a line Clinket OWNS may ever go in it** (owner 2026-09-17, PLAN
  D-36). `+12896981655` is the owner's number: it once stood in as the CA verification caller, got "blocked" when
  the caller moved to `+18449254651`, and locked the owner out of connecting it. **A number that used to sit in a
  config slot is not thereby ours** — ask. Test fixtures use the real caller `+18449254651`, and
  `OwnNumber_Connect_ANumberClinketDoesNotOwn_IsAccepted` connects `+12896981655` against the real appsettings.
- `CertifiedCarriers` — carrier ⇒ the longest no-reply timer MEASURED to beat that carrier's voicemail. **Not a
  whitelist**: an unlisted carrier still works, it just gets the "we haven't finished testing" panel and the default
  ring time only. CA has Rogers: 15. US/IN have none yet — a measurement backlog, not a gap.
- `UntestedMaxRingSeconds` (15) — a carrier we have NOT measured still offers the choice up to this cap (owner ask
  2026-09-15); the untested banner still says we have not proven it, and a voicemail-first failure offers the shorter
  ring as its fix. 0 turns the choice off and leaves such carriers the default ring time only.
- `RingSeconds` (**10** — ‼️ back from 15 on 2026-09-17, PLAN D-42) — the no-reply timer written into
  `**61*{did}**{seconds}#` for a NEW connection. 15 beat voicemail on the owner's line on 14 Sep and lost to it on
  17 Sep: voicemail timing drifts, so the default sits one step below the measured edge. ‼️ **The class default
  (`VoiceOwnNumberSettings`), the seed (`VoiceOwnNumberDefaults`) and the API appsettings are all 10** (§0.12), and a
  stamp whose `voicecfg_platform` document already exists keeps its STORED value until the admin Voice Settings page
  changes it. A provider already connected keeps the time they chose, and so does connecting the same line again.
- ‼️ **THE UI NEVER PRINTS A RING COUNT** (owner ask 2026-09-16). "About two rings" was a guess printed as a
  fact: a ring is a carrier CADENCE, not a constant — 10 seconds is about two rings in North America and nearer three
  where the cadence is shorter. The options say the seconds and one sentence of consequence, nothing else.
- **The ring time is chosen in TWO places, both writing the same route** (`PUT own-number/ring-seconds`): inside
  connect step 3 **above code 2**, because code 2 IS the ring time and the choice belongs where that code is read;
  and in the adjust dialog afterwards. **Selecting IS the save** in both — there is no second confirm — and the
  screen re-reads so the rendered code and the saved seconds can never disagree. The SERVER renders the codes from
  the saved `RingSeconds`; the client never composes one.
- `CdmaCarriers` — carriers that speak `*71`/`*73` instead of the GSM family. US only, because only the US has
  CDMA-legacy carriers; substring-matched, hence both spellings of US Cellular.
- ‼️ **A carrier the provider TYPES wins over the lookup** (audit fix, same day): the code FAMILY follows the carrier,
  so a mis-read carrier would hand out codes that cannot work. The lookup still answers for the line type.

### The card's actions and one type scale (2026-09-18, sheet `voice-own-number-card-actions`, PLAN D-68 … D-70) — do not undo these

- ‼️ **THE ROW IS "TEST IT, TUNE IT" AND NOTHING ELSE.** A connected card's row is `Check again · Adjust ring time`. "Change"
  sits beside the number (web `status.change` / app `STATUS_CHANGE`, opens step 1) in EVERY intended state except when
  `failure?.next === "number"` — that card's own button already opens the number step. The locked settings field says
  "change it on your number card", so removing "Change" re-opens the Round-3 dead end. "Call your assistant to hear it"
  is the last line of How it works (open on arrival); "No, I didn't pick up" is an inline link inside
  `status.lastCheckAnswered` on a connected card (a failed card keeps it as the second control). `status.useDifferent`
  is DELETED. The old four-link row had no test; `the card's actions` (web) / `the card's actions on the phone` pin it.
- ‼️ **A REFUSED DISCONNECT RE-READS THE LINE.** `CheckRunner` (both apps) calls `refresh()` / `loadVoiceAssistantState(true)`
  when a Disconnect start is refused, and renders `disconnect.done` + `disconnect.alreadyOffBody` while
  `ownNumber.intended` is false — so a check started earlier that finishes behind the refusal is shown as the good news it
  is. For a live assistant, own-number mode ends ONLY by a disconnect check that proved the forward off (a settings save
  that changes the mode is refused with `Error_VoiceAssistantNumberModeLocked`).
- ‼️ **ONE TYPE SCALE, WEB AND APP.** Card: number 16 on a phone / 18 wider (app `cardNumber`), links 13/600, notes 12/18
  (app `noteWarn` for amber — `panelWarnText`'s 12.5 is for panels), How-it-works 13/600 + 12.5 (app `howTitle`/`howBody`),
  the tip unframed (app `tip`). Dialog headers: title 18 on a 24 line with a 6 offset beside a 36 icon, aligned to the FIRST
  line (web `items-start leading-6 pt-1.5`, app `verdictRow` + `verdictTitle`); the checking state puts web's pulse dot /
  the app's spinner in that same 36 circle. Colours stay each platform's own tokens. App links carry `HIT_SLOP` (44pt).
- ‼️ **THE WAY OUT IS NEVER LIMITED FOR A PROVEN NUMBER** (PLAN D-71). `StartCheckAsync` picks a `CheckAllowance`: `Checking`
  (connect/recheck/answers-all: the shared hourly bucket + `MaxChecksPerDay`), `None` (a Disconnect of a number whose
  `VerifiedAtUtc` is set — proven to be the provider's own phone: spends and refunds nothing), `Leaving` (a Disconnect of a
  never-proven number: its OWN hourly bucket `voice-own-number-leave-hour:` + `MaxChecksPerDay + DisconnectExtraChecksPerDay`).
  ‼️ Never make `Leaving` unlimited: the number was typed before anything proved whose it is, so an unlimited exit is a
  stranger-ringing loop (type, disconnect, repeat) and gets our verification number flagged as spam. A day refusal gives
  back the hour's slot. A Disconnect of a number already out of own-number mode answers
  `Error_VoiceOwnNumberAlreadyDisconnected`. `VoiceOwnNumberOutcomes.ForgetProof` runs on EVERY number change — connect
  AND the settings form — or a new number inherits the old one's proof and with it the unlimited exit.

### What a caller waits (2026-09-17, PLAN D-64 … D-67) — do not undo these

The owner read "about 25 seconds" beside "your phone rings for 15 seconds" as a bug. It was neither a bug nor a ring.

- ‼️ **THE MEASUREMENT IS THE CALLER'S WHOLE WAIT, NOT A RING TIME.** `VoiceOwnNumberOutcomes.CallerWaitSeconds(check)`
  spans `PlacedUtc` (the carrier accepting our dial) → `ArrivedUtc` (the forwarded call reaching us), rounded to 5 s,
  so it is ALWAYS longer than the chosen ring by the carrier's handover (typically 3–9 s). It is `callerWaitSeconds`
  on both DTOs, in the live-update payload, and in both apps. **The stored Cosmos field is still
  `VoiceOwnNumberState.MeasuredRingSeconds`** — renaming it is a §0.7 schema change and was NOT taken; the builder maps.
- ‼️ **NEVER PRINT IT AS A BARE STOPWATCH.** `verify.callerWait` names it as the caller's wait AND says why it exceeds
  the ring ("your ring time, plus a moment for your carrier to pass the call over"); `status.callerWait` adds
  "— a normal wait". Both fall back to `verify.testedNoAnswer` when there is no measurement or it is 0 (the line
  forwards before it rings). The old `verify.testedNoAnswerIn` / `status.lastTestIn` keys are DELETED.
- ‼️ **THE HEALTH VERDICT IS THE SERVER'S, ONCE.** `VoiceOwnNumberStatusBuilder` sets `CallerWaitAtRisk` =
  connected ∧ wait > `Voice:OwnNumber:CallerWaitHealthySeconds` (30, API appsettings only — no other host reads it)
  ∧ answers-all not enabled. Neither app does the arithmetic. Telephony answers within 3–4 rings (~20–24 s) and
  abandonment climbs past half a minute, so the mark is business-grounded, not arbitrary.
- ‼️ **THE WARNING NEVER PROMISES A SHORTER RING THAT DOES NOT EXIST.** `callerWaitCopy` (both apps) picks
  `status.callerWaitAtRiskFixed` unless `!isCdmaFamily(own) && shorterRingOptions(...).length` — **ring options are the
  same list for every family**, so a CDMA line at 15 s has "shorter" options its carrier will never honour.
- ‼️ **THE CHOOSER SAYS WHAT EACH CHOICE COSTS A CALLER.** `RingTimePicker` takes `handoverSeconds` (from
  `carrierHandoverSeconds(own)` = wait − ring, clamped ≥ 0, null without a measurement) and renders
  `ring.callerWaitPreview` for `value + handoverSeconds`, live as they tap. The handover belongs to the carrier, not
  the ring, so it carries to every option; with no measurement it predicts nothing rather than inventing a number.

### A check something answered (2026-09-17, PLAN D-64) — do not undo these

- ‼️ **ANSWERED IS RECORDED BUT NEVER MOVES THE BADGE.** `WritesAVerdict` now returns true for a non-disconnect
  `Answered` check, and `Apply` writes `LastCheckOutcome = Answered` and returns false: connected, the verified date
  and the measurement all stand, because the no-reply forward never ran. A `Disconnect` that ended `Answered` still
  writes nothing.
- ‼️ **THE PROVIDER IS ASKED, BECAUSE DETECTION CANNOT SEE IT.** Premium-iOS detection is the only mode that hears an
  iPhone voicemail, so "you answered" may be a voicemail we are deaf to. The result screen asks "Did you pick up?"
  (`fail.answeredYes` retries, `fail.answeredNo` → `POST own-number/answered-by-voicemail`), and the card repeats
  `status.lastCheckAnswered` with the same link until they answer.
- ‼️ **THE CORRECTION MAY ONLY TAKE A LINE OFF CONNECTED.** `ReportAnsweredByVoicemailAsync` refuses with
  `Error_VoiceOwnNumberNoAnsweredCheck` unless `LastCheckOutcome == Answered`, is idempotent once it is
  `VoicemailFirst`, and sets `Connected = false`. It is an answer to a question we asked, never a switch.
- **An undecided detection verdict raises an admin alert.** `VoiceAmdVerdicts` (clinqetshared) is the ONE home for the
  result strings both hosts act on; the coordinator alerts (hourly dedupe, `forceAdminAlert`) when detection ran and
  could not decide, naming the line — a voicemail we cannot hear is the one failure a provider cannot diagnose.

### Honest status after every check (2026-09-17, sheet `voice-own-number-honest-status`, PLAN D-42 … D-49) — do not undo these

Found by the owner testing connect and disconnect on their own phone. Each bullet is a rule a later change must keep.

- ‼️ **ONLY A RESULT THAT EXERCISED THE FORWARD MAY MOVE THE CARD.** `VoiceOwnNumberOutcomes.WritesAVerdict` decides once,
  and `VoiceOwnNumberCheckCoordinator.CompleteAsync` passes `skipWriteWhen: () => !writesVerdict`, so a result with no
  verdict costs no profile write and no ETag churn (the read stays: the failure alerts name the stored carrier). No
  verdict: `TimedOut` (silence proves nothing), `Answered` (a picked-up call never reached the forward), and a
  `Disconnect` that ended `Answered` or `CouldNotConnect`. A `Disconnect` that `Arrived` proves the forward is STILL
  ON: `Connected = true`, `VerifiedAtUtc` now, the measured time stored.
- ‼️ **CHANGING THE RING TIME RETIRES A VOICEMAIL-FIRST VERDICT AND CLEARS THE MEASURED TIME** (`ChangeRingSeconds`, the one
  helper behind connect and the ring route), because that verdict was about the OLD time; other verdicts stay. The
  ring route answers `Error_VoiceOwnNumberCheckInProgress` while a live (non-terminal, non-stale) check exists, so no
  result is measured against a time that changed mid-call. `ConnectAsync` on the SAME line keeps the chosen ring
  when the carrier still offers it; a new line gets the default.
- ‼️ **THE CARD NAMES THE TIME THEY CHOSE, AND SEPARATELY WHAT A CALLER WAITS.** `ringsFor` takes
  `ownNumber.ringSeconds`. `ringChangedSinceLastCheck` (connected ∧ `callerWaitSeconds` == null ∧ not answers-all ∧
  not CDMA) says "dial the new code" with a "Show me the code" button instead of claiming the new time.
- ‼️ **VOICEMAIL FIRST ⇒ THE LOCK** (owner ruling "Lock it", per business and number). `voicemailVariant`: `shorter`
  (a shorter option exists) opens the ring choice with the losing time and every longer one LOCKED — visible, greyed,
  a lock icon, the `adjust.voicemailWon` label, never `disabled`, never pickable by press OR arrow key — and
  `recommendedRing` (the longest shorter time) pre-selected; "Use N seconds" saves and opens code 2. `shortest` and
  `carrier` (CDMA) get "Check again" with advice. **There is no "Try again as is"**: `fail.voicemailAlt` is deleted.
  The same lock sits on the result (`CheckRunner` → `onNext("adjust", { failedAt })`), the card, the ring
  dialog/sheet (`failedAt` prop; the phone carries it through the `VoiceAssistant` route as `failedAt`) and step 3.
- ‼️ **THE LOCK IS SESSION STATE, KEYED TO THE NUMBER.** Saving the shorter time retires the verdict the lock was read
  from, so the dialog/wizard/screen HOLDS it (`ringLock = { line, seconds }`) and a different `own.number` drops it.
  `voicemailLockAt` locks only where a shorter option exists AND the family is not CDMA: a CDMA line still receives an
  options list, and locking it would leave no way forward. Nothing is stored, so once the window closes a deliberate
  return to the losing time is caught by the next check.
- ‼️ **STEP 3 WHILE THE SAVED TIME IS THE ONE THAT LOST** (`ringBlocked`): the picker value is `null` (nothing selected —
  the picker never locks its own value), code 2's digits are hidden, its dial button reads `connect.dial2AfterRing`
  through `CodeRow`'s `lockedLabelId` / `lockedLabelKey`, and "I've done both" is disabled. The first build selected
  15 and left its code dialable.
- **The disconnect check's words and endings.** `progressStepKeys(purpose)` gives the disconnect strip `disconnect.p3`
  ("Voicemail or rings out"); `disconnectResult(check)` gives each ending its own sentence: `offVoicemail`,
  `offRangOut` (+ the note that the carrier can switch voicemail on), `stillOn` (the clear code again + "I've dialled
  it again"), `answered`, `unreachable`, `noResult` (the number stays connected here). "Answered" and "unreachable"
  must never say "still connected".
- **A check that finishes after its window closed.** One app-wide listener re-reads the assistant on a FINAL update
  (web `VoiceAssistantContext` via `onVoiceOwnNumberCheckUpdated`; phone `SignalRProvider` via `isFinishedCheckUpdate`
  → `refreshVoiceAssistantStateIfLoaded`) and swallows the stale "Checking your number" pop-up/banner. The runner
  re-reads only when its result came from `poll` or `expired`, plus one late re-read. Nothing polls.
- **The read-only "Number to reach you on" field follows `application.forwardingTarget`** (`VoiceApplicationForm` and
  `ApplicationForm`), or a save sends the replaced number back to be refused.
- **Tests:** the server rules in `VoiceOwnNumberOutcomesTests`, `VoiceOwnNumberCheckCoordinatorTests` (+ its integration
  test: the ETag is unchanged when no verdict is written), `VoiceOwnNumberServiceTests` and
  `VoiceAssistantControllerIntegrationTests.OwnNumber`; the screens in `ownNumberHonestStatus` and
  `ownNumberVoicemailLock` (web `.test.jsx`, phone `.test.tsx`), `ownNumberCopy`, and web `voiceAssistantCheckRefresh`.

### What the independent audit of that change found (2026-09-17, PLAN D-50 … D-61) — 18 findings, 16 fixed

An adversarial reader took the decisions above and the code, not the tests. Each of these is now a rule:

- ‼️ **A TEST CALL THAT NEVER LEFT IS NOT A VERDICT ABOUT THEIR LINE.** With no verification caller for the country, or with
  the carrier refusing OUR caller (India's placeholder does exactly that), the check ends `Failed/CouldNotConnect` — and a
  CONNECTED provider pressing "Check again" was told to go and fix a number that was fine, losing their Connected badge on
  the way. The finalize now clears `PlacedUtc`, `WritesAVerdict` refuses a check that was never placed, `ToDto` carries
  `NotPlaced`, the live update carries `notPlaced`, and `isNoResult` on both apps reads it as "we didn't get a result".
  A call the carrier refused AFTER it left is still a verdict, and stays one.
- ‼️ **THE SETTINGS FORM MUST FOLLOW EVERY FIELD THE CONNECT FLOW OWNS** — the number, the number MODE and the answering
  mode. It sends all of them on save, and the server refuses a live assistant's mode change, so a stale copy refused every
  save after a connect or disconnect until the page was reloaded.
- **A lock is read through one rule** (`ringLockFor` + `mustShortenFirst`): it drops for another line and for a carrier-set
  ring, and it only shuts code 2 when a shorter time exists. Two dead ends came from missing that — a carrier corrected to
  Verizon after a voicemail loss (no picker, no code, disabled button), and a loss at the shortest ring.
- **"Check again" on a ring time that changed goes through the code first.** The line still forwards on the OLD timer until
  the new code is dialled, so a check from there measured the old time and stated the new one.
- **No own-number check update is ever a pop-up** (web `VoiceAssistantContext`, phone `SignalRProvider` claim them all).
  In-progress ones said "we're checking that calls reach your assistant" to teammates, after a Stop, and word for word
  during a DISCONNECT check.
- ‼️ **A READ THAT BEGAN BEFORE A SAVE MUST NEVER REPLACE IT** (a write counter on both apps' state holders), and on the
  phone a forced refresh during a read in flight queues exactly one more read instead of returning the older one — dropped if
  the session is swept in between, or it would read the next account's assistant on the last one's behalf.
- **The phone keeps the check result at step 4** (the connected card has neither the measured line nor How-it-works), and a
  disconnect dialog/sheet stays rendered while it is open even after the refresh that ends own-number mode.
- **The who-answers panel names a ring time only once a check has proved the line** — `who.ownRingsFirstUnchecked` /
  `…NoTime` otherwise, the carrier sentence on a carrier-set ring, the straight-through sentence for answers-all.
- **The ring time belongs to a phone:** typing a different number in settings clears it, so the next connect starts at the
  default; reconnecting the same phone still keeps it.
- **A verdict that applies to nothing writes nothing** (`AppliesTo`), so a number replaced mid-check no longer costs an RU
  and an ETag; and the admin alert says whether a write was even due.
- **No developer word ever reaches the provider:** an empty answer from the start route used to show "empty check".
- **Judged and NOT changed:** two cross-device races of a few milliseconds (closing them needs the ring time stamped on the
  check document — §0.7), a disconnect answered by voicemail still reading as "off" (owner ruling 4), and a never-placed
  call still spending one of the day's checks (the allowance lives in the API, the failure in Functions).

### What the owner asked for after the second live test (2026-09-17, PLAN D-62, D-63)

- **"What changes when you connect your number" ends on what the assistant DOES**, not on a thing we do not do:
  `changes.handlesCall` / `CHANGES_HANDLES_CALL` — it answers, takes the details, books, deals with whatever the caller
  needs; watch it live in the app, join in, full summary at the end. The old `joinFromApp` keys are deleted.
- ‼️ **THE OPTIONAL VOICEMAIL NOTE ON STEP 2 IS A NOTE, NEVER A TICK** (`checks.optionalPill` + `checks.voicemailTitle` +
  `checks.voicemailBody`, both apps, both platforms). Voicemail is a CARRIER setting: a third box would gate "Both done,
  continue" behind something a provider cannot do in phone settings. Its tests assert exactly two checkboxes.
### The assistant page after the owner's live test (2026-09-16, sheet `voice-assistant-page-density`)

Every one of these came from the owner using the built screen, so a future session does not "tidy" them back:

- **The number card opens on "How it works".** A provider who has just connected asks how it works next, not
  whether to disconnect.
- ‼️ **Disconnect is a red outline button directly under the card's actions**, before the expanders:
  actions · Disconnect · line · How it works (owner 2026-09-17, PLAN D-35 + D-38 — it replaced both the header-row
  link and a card-foot button; NO rule above it, because it is one of the number's actions and spacing groups it
  with them). The "Cancel assistant" treatment, left-aligned. Never its own expander. The phone does the same.
- ‼️ **"Use a different number" lives on the CONNECTED card** and reopens the wizard at its first step. The
  settings field is read-only by design (§6 above — that field IS the verified line), and its hint points at this
  card; before this, the hint pointed at a card that had no such control. **A read-only field whose hint names
  another surface must find a control there** — that gap was created and closed in the same session.
- **The page is a two-column grid from 1024, `items-start`, so neither column stretches**: the RIGHT column holds
  only the two number cards; usage, who-answers, **Pause assistant and Private mode** ride in the LEFT column (owner
  2026-09-17, PLAN D-32 — the switches had stretched the right column past a screen of white space). The numbers
  lead the markup so a phone-width layout shows them first.
- ‼️ **The knowledge line ("Your assistant already knows your Clinket profile…") sits AFTER the settings section,
  just above Cancel assistant** — where it was before the number cards existed (owner 2026-09-17, PLAN D-37). Beside
  the number cards it read as out of place: it describes what the assistant answers with, so it closes the settings.
  Web and phone alike; both `knowledgeNudgePlacement` tests pin it.
- **The same two numbers are named ONCE.** The "Your numbers" line repeated the pair a third time, with no role
  attached; it is gone, and who-answers (which does attach a role) moved up to where it was.
- ‼️ **The settings form is ONE full-width row per section, EXCEPT Phone setup and Languages, which share a row**
  (owner 2026-09-17, PLAN D-31 — a two-column form squeezed the voice cards into one narrow column and pulled
  recording, retention and consent into half-width cells). The grid stays `lg:grid-cols-2` only so that pair can
  sit side by side; everything else carries `lg:col-span-2`, in the ORIGINAL order: voice (`md:grid-cols-2` cards),
  greeting, instructions, hours, call recording, data & retention, help improve. **Do not move a section into a
  half-width cell to "use the space" — that is the change the owner reversed.**
- **The modal's close control is a real target** — `w-9 h-9` circle, border, white fill, `z-10` — because the
  step strip was drawn over the flat icon and swallowed it (`pr-10` keeps the strip clear of it too).
- **The phone mirrors every one of these** with native shapes: the adjust flow is a bottom sheet, the ring picker is
  the same segmented control with brand green filling the chosen segment (§ the brand-colour mandate), the connect
  wizard stays its own gated screen, Pause/Private are one grouped card with native switches, and the screen
  **pulls to refresh** (brand green, the Activity screen's shape) and uses `Util/haptics` — light on copy,
  selection on a switch, error when one fails, success or warning when a check finishes (PLAN D-34). Its settings
  form was never two columns, so D-31 needed nothing there.

### What the closing audit of round 3 found (2026-09-16) — do not undo these

- ‼️ **THE RING DEFAULT IS CLAMPED TO WHAT THE CARRIER OFFERS** (`VoiceOwnNumberDialCodes.DefaultRingSeconds`).
  Raising `RingSeconds` to 15 armed a latent refusal: a carrier certified at 10 offers only `[10]`, `ConnectAsync`
  ran at step 1 with the platform default and threw `Error_VoiceOwnNumberRingSecondsInvalid` — and the picker that
  would have offered 10 lives DOWNSTREAM of the call that threw. **A platform default is not a carrier's cap.**
- ‼️ **THE RING PICKER IS NEVER `disabled`** (both apps). The browser blurs a disabled element, so the option a
  provider just pressed threw focus to the page body on every save; and a saved value the carrier no longer offers
  (they re-declared a carrier certified lower) left the single option unselected AND unpressable. The press is
  guarded instead, the group has a label, and it roves focus with the arrow keys.
- ‼️ **EACH CARRIER ADAPTER MUST REPORT A REFUSAL AS A REFUSAL.** Only Telnyx ever returned
  `DialResult.RejectedByCarrier`; Plivo collapsed "the carrier said no" into "we never placed it", so every India
  failure raised the admin alert naming the carrier ADAPTER as the suspect when the suspect is the verification
  number. `PlivoCallControlService` now carries that distinction out of its HTTP helper.
- **One name for a document across both apps** — `?docId=` on the laptop, `docId` on the phone. The phone claimed
  the universal link and could not read `?id=` off it, so every tap opened the viewer with nothing to view.
- **A refusal with N causes needs N sentences.** `Error_VoiceOwnNumberWrongLength` split from
  `Error_VoiceOwnNumberInvalid` for the same reason `…IsClinketNumber` split from `…Blocked`: "+1416555011" IS in
  international format. `VoiceOwnNumberRefusalSentenceTests` now holds the five refusal SENTENCES distinct in all
  five languages — distinct keys were never the contract and always passed.
- ‼️ **A SOURCE-SCANNING GUARD MUST STRIP COMMENTS FIRST.** `sessionCGuards` asserted a CCPA-style menu row was
  reachable by matching `onPress={OnClickDataPrivacy}` in the file — text that sat inside `{/* … */}` for weeks.
  Green meant "the words are in the file", not "a provider can reach it".

### Judged and deliberately NOT changed (round-2 audit, 2026-09-16)

- **The streak / carrier alerts count in per-instance `IMemoryCache`**, so a scaled-out Functions host under-counts
  them. A shared counter is a schema the owner has not approved (§0.7); the alerts are pattern hints, never the
  product's correctness.
- **One verification caller per country** means a caller who spoofs it at a provider's DID *while a check is live*
  can decide that check (§17.2). Documented in the design, unchanged: the alternative is a per-check caller number.
- **A LOST machine-detection event reports a voicemail as "you picked up"** — the leg answered either way, and no
  other signal separates them. Premium detection narrows it; nothing closes it.

### Deliberately NOT built (do not "fix" these)

No DELETE own-number route (the codes come from `GET own-number`) · no "tell me when it's ready" CTA (no backend) ·
iOS cannot dial `*`/`#` from an app ⇒ copy-only there, `tel:` on Android · the admin console UI for answers-all
(the API exists; the mockup gate governs the screen) · `state`+`outcome` represent the approved `Failed:{cause}`.

### Tests (§0.18 — the host that runs the code)

`Clinqet.API.UnitTests`: projection table, dial codes, country resolver, phone format, status builder, the service's
gates/limits/stamping, controller permission attributes. `Clinqet.Communications.UnitTests`: outcomes, the
coordinator state machine, both ingress short-circuits, the processor kinds, the appsettings contract.
Integration: the Cosmos single-flight/CAS/TTL + the whole API flow; the coordinator against the real emulator.
**Sabotage-verified**: re-arm `ForwardTo` ⇒ the loop tests fail; drop the caller condition ⇒ the spoof test fails.

---

## RECENT CHANGES — 2026-09-11 (‼️ AI KNOWLEDGE EXTRACTION FIX PROGRAMME **PHASE 1 of 4** — read the document right: parsers, passages, the image lane, the vision judge. BUILT + GREEN, owner deploys)

Authority: `C:\Nik\Data\knowledge-extraction-fix-plan\PLAN.md`; findings
`C:\Nik\Data\knowledge-extraction-audit\FINDINGS-2026-09-10.md`; this phase's evidence and its own audit in
`Data\knowledge-extraction-fix-plan\phase-1\` (`AUDIT.md`, `HANDOVER.md`, `baseline\`, `after\`,
`live-replay\`). Owner rulings: **every extraction finding is High/Critical whatever badge it carries and
none may be deferred**; the 17 fixture documents in Canada business `SX3SG2` are **retained**.

**Green:** Communications **4,292** · API **11,946** · MCP **918** · the table harness
`C:\Nik\knowledge-table-hunt` **103/103** · 0 build errors. 10 sabotages inverted, each failed.

### ‼️ THE JUDGE — one implementation, three callers (the heart of it)

(2026-10-03: `DocumentTranscriptComparer` is deleted; `Services/AI/Reading/` decides now — see the 2026-10-03 section.)
`DocumentTranscriptComparer` + `VisionDocumentTranscriptionService` adjudicate **three readings of a page**:
**A** = Document Intelligence OCR markdown (the machine reading — it IS handed to B, as a whole-line prefix
via `Reference()`, and a partial flag when it is cut), **B** = the vision page transcription
(`gpt-5.6-luna`), **C** = the third-reader verifier (`gpt-6.1-sol` since 2026-10-02). The same code serves **ingest**,
**service-draft re-derivation** and **AI profile setup** — a fix here lands in all three at once.

**The policy (owner-approved 2026-09-11, `AdjudicationPolicyVersion = "2"` inside `ValidationFingerprint`):**

1. **B wins on layout.** A two-column page read across by the machine is not a dispute at all and costs no
   third reading (`shapeDiffers` must hold before Rule 1 can excuse anything).
2. **A wins on a value B dropped**, but only where C confirms the value is on that page — and never by
   pasting A's row over a richer B span (`ConservesWords`, `MaxRepairWordLossPercent` = 25).
3. **"Answered: not on this page" is not "no answer".** `AnsweredNotOnPage` separates them; collapsing the
   two into one null is what reverted a whole Gujarati page to OCR garbage (L-2).
4. **An invented price is removed only when C cannot find it** — deleting a real price is worse than keeping
   an unconfirmed one (`AddedValues`, compared through `KnowledgeFigures.Numbers` so a re-format is not an
   invention).
5. **A revert needs evidence about the WHOLE page**, not one region (`WithoutEvidence()` returns null to
   signal it; `pageRevert` needs `resolvedToSource >= 2` and every group resolved that way).

Tests: `Clinqet.Communications.UnitTests\Knowledge\DocumentTranscriptionAdjudicationTests.cs` (43).

### One header rule, one line-structure rule, one continuation rule — for EVERY lane and script

R1 is absolute: **a label attaches to a value only where the source DECLARED it** — `<th>`/`<thead>`, a GFM
delimiter row, JSON keys, Word's `w:tblHeader`, Excel's Format-as-Table / AutoFilter / **frozen top row**
(`VerticalSplit >= 1`, which also composes `Price · Short hair` from a two-row freeze). Undeclared ⇒ **no
labels**, and a table large enough to split across cards gets a CONTEXT line instead. The deleted middle tier
that INFERRED a header from cell shapes is never coming back: `Consultation | free | on request` is
shape-identical to a real header and only vocabulary could separate them.

Line structure is one set of rules over the BLOCK STREAM, so a price list reads the same whether it arrived
as DOCX paragraphs, PPT lines, `<div><br>`, a .txt file or DI's flattened OCR:
`CoalesceValueLineRuns` · `IsSelfContainedLine` · `IsValueOnlyLine` · `MergeThreeLineRecords` (name /
description / price, run-level, ≥2 candidates) · `IsWrappedContinuation`.

‼️ **Three money rules worth knowing before you touch them:**
- `45,00 €` — a comma decimal with the symbol as its OWN token — is how France, Sweden and most of
  continental Europe write money. `IsLoneCurrencyMark` recognises it; without it the entire price list read
  as prose and arrived as one glued line (found by the adversarial battery, 2026-09-11).
- `800/-` and a bare `250` are prices too (`IsMeasureToken`, `EndsInABareNumber` + `MinBareNumberedLines`).
- A phone number is deliberately NOT a value: it carries no currency, percentage or unit.

‼️ **THE HYPHEN AT A LINE BREAK (EX-32, settled 2026-09-11) — the rule is decided by the LANE, never by the
text.** `Kera-` / `tin` and `anti-` / `ageing` are the same bytes and mean opposite things, so the old
"always drop the hyphen" rule turned every real compound into a non-word: `antiageing`, `Dtan`, `blowdry`.

| Where the line break came from | `-` + a lowercase next line | Why this is a fact, not a probability |
|---|---|---|
| **A RENDERED page** — `ParseLayoutMarkdown` (DI OCR + the vision transcript) and the picture-text pass | join and **DROP** the hyphen (`KnowledgeText.DehyphenateRenderedPage`) | a printed line break splits words; that is what hyphenation IS in typeset text |
| **A TYPED document** — DOCX, XLSX, PPTX, HTML, TXT, MD, JSON | join and **KEEP** the hyphen, no space (`KnowledgeText.Dehyphenate`) | a newline there is a break the AUTHOR pressed, and nobody types a hard break mid-word |

Two guards inside the rendered lane, neither a dictionary nor a language rule: **three letters minimum**
before the hyphen (no compositor breaks a word after one or two — so `D-tan`, `X-ray`, `e-bike`, `T-shirt`
survive a scan), and **the document is its own dictionary** (the hyphenated form appearing intact anywhere
else in the same document keeps the hyphen). ‼️ **Only a hyphen break is joined — every other newline
SURVIVES.** An earlier version replaced all newlines with spaces, which was invisible inside
`KnowledgeText.Normalize` (that collapses whitespace anyway) and flattened a whole page at document level.


‼️ **Case is a three-state signal, not a boolean** (`IsWrappedContinuation`): a **cased run** uses
`char.IsLower`; a **caseless script** (Gujarati, Devanagari, Arabic, CJK) uses the structural rule; a **cased
script typed all in lower case** must refuse BOTH — the case bit is noise and the structural rule welds
records (it made `french tips` + `classic pedicure with` one offering at the first one's price).

### What else changed, by file

| File | What |
|---|---|
| `KnowledgeOoxmlText.cs` | newline-aware `Flatten` vs collapsing `FlattenInline`; **`OoxmlNotes`** — a footnote/endnote is inlined `[at its reference]`, keyed `f<id>`/`e<id>` because the two id spaces are separate; a note nobody referenced keeps its place at the end |
| `KnowledgeDocumentParser.OpenXml.cs` | `w:tblHeader`; the letterhead is **inserted before the first block** and the footer appended after; `AppendLayoutTableBlocks` (a resume built as a one-row table is a LAYOUT); per-parse `SkipTally`; **`UnclaimedImageParts`** — the package's own media swept once at the end, by CONTENT TYPE (Excel's rich-value picture arrives as an untyped `ExtendedPart`), excluding THEME/NUMBERING/STYLE/FONT/THUMBNAIL/LAYOUT/MASTER/HEADER/FOOTER |
| `KnowledgeDocumentParser.Pptx.cs` | `ZipValueColumnBoxes` (side-by-side boxes are zipped, not read column-major); **`CollectPptxBackground`** — `p:bg` behind text is the backdrop and costs nothing, on a slide with no text it IS the slide; `Refuse()` records a judged part so the sweep can never resurrect it |
| `KnowledgeDocumentParser.cs` | `BestHtmlImageSource` — `data-src` and friends beat `src` (a lazy page's `src` is a 1×1 GIF), then `srcset`/`<picture><source>` by the **widest** candidate, split on WHITESPACE never the comma (a CDN URL carries its own commas); hidden-HTML removal; `IsFetchable` mirrors the fetcher's policy so a refusal is a skip, not a LOST picture |
| `KnowledgeChunker.cs` | `KnowledgeTokenEstimate` (ONE chars-per-token factor, shared with `ProviderKnowledgeSearchService.TrimToTokenBudget`); CJK/Arabic sentence terminators; a card closes at a page change; `HoldsAValue` guards the H1 first-cell carry |
| `KnowledgeSearchIndexer.cs` | byte-bounded upload paging (12 MB) and 413 ⇒ halve-and-split: 500 cards × 3,072-float vectors was over Azure Search's 16 MB request cap |
| `KnowledgeIngestProcessorFunction.cs` | **a picture that reads as text is transcribed**, not just captioned (`MaxTranscribedPictures` = 5), and its text is spliced in **at the picture**; caption reuse only for the same bytes beside the same words (P4-E-26 — the fingerprint is deleted); EMF/WMF counted as Bounded, never LOST; the author's alt text earns a card when the description fails |

### Settings added (class default mirrors appsettings; no `local.settings.json`, so no ARM change)

| Key | Host |
|---|---|
| `…:Vision:MaxRepairWordLossPercent` = 25 | **both** vision owners: Functions `Voice:Knowledge:Vision` and API `AIAssistant:ProviderAttachmentProcessing:Vision` |
| `Voice:Knowledge:Images:MaxTranscribedPictures` = 5 | Functions only — the API host does not run the ingest image lane |
| `.tif` in `StorageConfiguration:{ProviderKnowledge,ProviderSetupDocuments}:AllowedExtensions` | API — the pipeline read `.tif` while the upload gate refused it |

### Tools (not product code, all under `Data\knowledge-extraction-audit\tools\`)

`khead <file> [outDir]` replays any born-digital file through the HEAD parser + chunker.
**`kreplay --all <evidenceRoot>`** (new) replays a LIVE artefact's own block stream through the HEAD chunker —
real Document Intelligence + vision output, no deploy needed. `kaudit` drives the deployed Canada pipeline.

### Open questions the owner still owes a ruling on

`AUDIT.md` §11: the cross-document caption-reuse field (my recommendation: **do not add it**), `.csv` and the
legacy/macro Office families, a multi-frame TIFF's pages 2..n as sendable pictures, the four remaining §9
declared limits (EX-32 is now FIXED — see the hyphen rule above), and the one-wrapped-lowercase-name split.

‼️ **AND ONE HANDED TO PHASE 2 AS MANDATORY (D10).** A price list typed all in lower case where one service
name wraps (`gel manicure with` / `french tips` / `$45`) keeps every word in one card and answers a caller
correctly ($45) — but the **Clinket AI Data Analytics draft is named `french tips`, not `gel manicure with
french tips`**. The parser cannot decide it (byte-identical to `services` / `haircut` / `$25`); the drafts
lane can, because `KnowledgeServiceDraftAnalyticsJob.BuildExtractorText` already marks a real section as
`## <section>`. The actual defect is that `ExtractorLine` emits one line per CANDIDATE and a candidate must
carry a price, so the name's first half never reaches the model at all. Full statement with the data:
`PHASE-2-PROMPT.md` §1A.2, `phase-1\AUDIT.md` §11.5, harness case ADV08.

## RECENT CHANGES — 2026-09-09 (AI Voice setup gate: BusinessDetails + BusinessAddress only)

Owner: incomplete category / services / availability / service area no longer block AI Voice setup
(Knowledge / Call Follow-ups / Finish setup). **Required set is BusinessDetails + BusinessAddress.**
Portfolio stays excluded. The 7-step wizard (`OnboardingProgressService` / `ONBOARDING_STEP_LABEL_IDS`)
and the dashboard setup-incomplete redirect were **not** changed.

- Authority: `VoiceAssistantOnboardingReadiness` — consumed by `ToStateDto` (`OnboardingComplete` /
  `MissingOnboardingSteps`) and `ValidateSubmissionGates` (`Error_VoiceAssistantOnboardingIncomplete`).
- Country (`Error_VoiceAssistantCountryNotSupported`) and the application form (forwarding, language, voice,
  HoursMode, recording, consent) remain **separate** gates.
- Runtime already safe with empty catalog/hours/area: empty weekly hours ⇒ `VoiceHoursVerdict.AfterHours`
  (`VoiceHoursEvaluator`); unlisted bookings from knowledge; inbound DID does not need category/area.
- Web: `OnboardingChecklist.jsx` `STEP_ROUTES` two keys. Mobile: `VoiceAssistant/index.tsx` `STEP_ROUTES` two keys
  (unknown step falls through to business details, matching web). Dropped-step locale keys kept — the go-live
  strip / wizard still uses them.
- Tests: `VoiceAssistantOnboardingReadinessTests`, `VoiceAssistantServiceTests` (submit succeeds with catalog/
  hours/area missing), integration `Submit_WithoutCategoryServicesAvailabilityOrServiceArea_ReturnsOK` +
  `Submit_BusinessAddressStepMissing_Returns400`, web `OnboardingChecklist.test.jsx`, mobile
  `voiceOnboardingGate.test.ts`.

## ‼️ KNOWLEDGE IMAGE EXTRACTION & DELIVERY — PHASE A (P1+P2+P3), BUILT 2026-08-25, SHIPS DARK

**No kill switch.** `Voice:Knowledge:Images:Enabled` was deleted in the AI cost programme's Phase 6
(2026-09-01, no-flags rule) together with the F3 legacy caption path it guarded; the picture lane is
unconditional in every host. There is no migration — documents pick pictures up on their next Reprocess/replace.

### What it does
Clinket AI now keeps the PICTURES inside an uploaded knowledge file, so the receptionist can send a caller a
photo of the thing being discussed. Extraction runs in the ingest lane, the provider curates on the Knowledge
page, and the send rides the EXISTING material-info PDF (one vehicle, one template, WhatsApp + email).

### Extraction — `KnowledgeImageExtractor` (infrastructure), driven by the Functions ingest lane
- **PDF = the §6.3.1 hybrid.** One billed Document Intelligence `prebuilt-layout` call with
  `output=figures` gives figure crops; PdfPig recovers the NATIVE raster with its original bytes; they are
  matched by **rect IoU** after an inch(top-left) → points(bottom-left) conversion. A DI page whose `unit`
  is not `inch` **skips native matching for its figures** and degrades to the crop (`PageUnitIsInch`).
  Whole-page figures above `MaxFigureAreaRatio` are dropped (F7 — a scanned page is not a picture).
- **DOCX** images were already collected pre-feature and stay unconditional; **XLSX** takes worksheet
  `DrawingsPart` pictures; **HTML** takes absolute http(s) `<img>` (fetched through the SAME `PublicHost`
  policy chain as the storing path, `RemoteImageIngestionService`) and inline `data:` URIs.
- ‼️ `MaxRemoteImagesPerHtmlDoc` bounds **network fetches only** — it must never `break` the loop, or a
  document whose 13th `<img>` is remote would also lose every free inline `data:` image after it. Per-URL
  fetch dedupe lives in the same dictionary.
- **`imageId` = SHA-256 of the extracted bytes, first 16 hex.** Content-addressed ⇒ re-upload is convergent
  and a tombstone is durable (below).
- ‼️ **`Page` is recorded ONLY for a paginated source.** `KnowledgeBlock.PageNumber` defaults to 1, so a
  DOCX/XLSX picture would otherwise be labelled "p.1" — a number the document does not have.

### Normalization — `KnowledgeImageNormalizer` (§6.4 ladder)
EXIF auto-orient, metadata strip, edge cap `MaxStoredEdgePixels` (2048), GIF first frame, decompression-bomb
guard via `IdentifyAsync` before decode. **R2 fidelity pass-through**: a clean in-cap JPEG/PNG is stored
byte-identical rather than re-encoded. Renditions are **original + thumbnail only — no medium** (locked).

### ‼️ Repairing a picture the AI would not describe (2026-08-26)
A failed description used to be **permanent**. The replay path (`RecomposeImageLaneFromArtifact`) re-registers
banked pointers and makes **no vision call**, so reprocessing — which is exactly what the panel tells the
provider to do — could never fix it, and the artefact cached the absence forever.
`TopUpMissingDescriptionsAsync` runs on the replay, BEFORE the recompose so that stays pure:
- one vision call per still-undescribed picture, on the **banked blob**, which IS the normalized image the
  first ingest captioned — nothing is re-extracted, re-decoded or re-normalized;
- **skips tombstones** (never resurrect a deleted picture) and **skips any picture whose ROW already holds a
  description** (an earlier top-up whose artefact write failed, or the business-wide reuse map) — that case
  fills the cache and spends nothing;
- one picture referenced at several indexes is described ONCE and fills every index it holds;
- successes are banked back into the artefact AND reach the row, so the next reprocess pays nothing and even
  a full re-parse after a deploy finds the description through the reuse map;
- a picture still refused after a second attempt raises the `KnowledgeImageDescription` alert. Almost always
  the content filter refusing again — **which is exactly the picture that must never reach a caller, so
  nothing is written and it stays unsendable. There is deliberately NO provider-typed description anywhere:
  it would be a route around the safety filter and would put unvetted text into the retrieval index.**
- **A repaired picture is NOT auto-ticked.** `MergeRegistry`/the recompose preserve the stored toggle, so the
  repair makes it *tickable* and the provider decides. The platform never starts sending a picture to callers
  without the provider having said yes.

### ‼️ The thumbnail patch — READ THIS BEFORE TOUCHING `UpdateImageDerivativeAsync` (2026-08-26)
The ingest enqueues **one derivative message per picture** and `host.json` runs `maxConcurrentCalls: 16`, so
a catalogue puts sixteen writers on ONE row. It was a whole-document read-modify-REPLACE with three ETag
attempts and no backoff: losers returned `false`, `ProcessKnowledgeImageAsync` **discarded** it, Service Bus
completed the message, and the thumbnail was lost for good — the tile stranded on "Processing…".
**Measured on the emulator: 1 of 20 landed.**
- Now an **atomic PATCH of two paths inside one element, with NO precondition** — and that absence IS the
  design. Sixteen writers touch sixteen DIFFERENT elements, so any precondition serialises them for nothing
  (~10-20× the RU and a seconds-long fan-out). The guard is taken from the patch **RESPONSE**, which is the
  updated document and therefore free: if `images[index]` is no longer this picture, a re-ingest re-cut the
  registry mid-flight ⇒ the displaced neighbour is restored from the pre-patch snapshot, then retry.
- ‼️ **`false` means exactly ONE thing: the picture is gone.** A write that could not be applied **THROWS**,
  because only an exception is impossible for a caller to discard. Same rule now in the shared base helper
  `CosmosDbRepository.PatchStableArrayItemByIdAsync` — which is why `AzureSearchIndexer`'s best-effort
  geocode persist had to gain a try/catch.
- ‼️ **Do NOT "fix" this back to a `FilterPredicate` on `c.images[i].imageId`.** It is the textbook guard and
  was the first design, but the `vnext` Cosmos emulator answers **HTTP 500 `PostgresError(42601)`** to ANY
  array-aware patch filter, and returns a **WRONG 412** for `ARRAY_CONTAINS` and for `IS_DEFINED` on an
  object key. It is unverifiable in CI and takes two green tests red. (Same probe: `FROM i IN c.images` over
  an OBJECT is a 400, which is why re-keying the registry as a map is also ruled out — it would break
  `ListSendableImageRefsAsync`'s ARRAY subquery, the thing that keeps the hot voice path's payload to ids.)

### The registry (Cosmos, §0.7-approved) — `KnowledgeDocument.Images`
`List<KnowledgeDocumentImage>?` (`NullValueHandling.Ignore` ⇒ an imageless row is byte-identical to the
pre-feature shape) + `int DroppedImages`. Entry: imageId · page? · anchorPath? · blobPath · thumbPath? ·
contentHash · kind · caption? · **quality** · **sendable** · width · height · bytes · source · **status**.
`quality` (§0.7 approved 2026-08-26 — `KnowledgeImageQuality { Ok, Blurry, Tiny }`, `DefaultValueHandling.Ignore`
⇒ an absent field reads `Ok`, so existing rows keep today's sendability) is the vision call's own verdict, which
we were paying for and binning. **Never indexed, never searched.** `KnowledgeArtifactImage` carries it too, or an
artefact replay would recompute a DIFFERENT default than the first ingest did.
Blobs live in the EXISTING `ProviderKnowledge` container under `{businessId}/_images/{docId}/{imageId}.ext`
— zero new Azure resources, and the business-closure purge already sweeps that prefix.
‼️ Deletes use the **EXACT-CASED** stored paths (the 2026-08-21 lower-casing lesson).

### Sendability — TWO gates, and the second one is live
`a picture is sendable ⇔ KnowledgeReceptionistRule.Decide(document).Sendable AND image.Sendable` (before 2026-09-07: `document.ShareWithCallers AND image.Sendable`)
- `DefaultSendable(kind, caption, quality)` — defaults by kind (LOCKED §13.2): `Product`/`Photo`/`Diagram`
  **on**; `Logo`/`Decorative`/`TextSnapshot` **off**. Two further conditions, both load-bearing:
  - ‼️ **No caption ⇒ off, and that check is what holds the failure paths closed.** All three caption
    failures (captioning switched off, the re-decode failing, the AI call failing **or being
    content-filtered**) return `(null, Photo)` — and `Photo` is INSIDE the sendable set, so the caption check
    is the only thing between an AI outage and every logo and letterhead being marked sendable. It pairs with
    `BuildCards`, which emits no ImageCaption card without a caption: **no card ⇒ no `imageRef` ⇒ the model
    can never learn the picture exists.** Both halves are pinned together by `KnowledgeImageSendabilityTests`
    (2026-08-26) — before that, changing either one alone went green and started lying to providers.
  - `Blurry`/`Tiny` ⇒ off by default, still manually tickable (an explicit provider tick always wins).
    ‼️ `BuildBusinessImageMapAsync` carries `quality` with the contentHash caption reuse, or the same tile is
    withheld in the catalogue and ticked in the price list.
- ‼️ **The API REFUSES a tick that cannot send.** `SetImageSendableAsync` returns `ImageHasNoDescription`
  (⇒ 400, localized) for a tick-ON with no caption, and `NotFound` for a tick on a `Deleted` tombstone.
  Web and mobile withhold the control and show the reason. An already-ON picture keeps its own label — the
  provider must always be able to turn OFF what an earlier ingest turned on.
- ‼️ **`ListSendableImageRefsAsync` — the live ALLOW-LIST, and the ONLY gate on sendability.**
  `ProviderKnowledgeSearchService` reads, per retrieval and IN PARALLEL with the embedding + search, the refs
  that are stored and ticked, and suppresses any `imageRef` not on it. An untick, a delete tombstone or a
  malformed entry is simply absent ⇒ **fails closed**, as does a failed read (no refs at all). The query is
  skipped entirely while the switch is dark.
- ‼️ **EVERY described picture's card carries its `imageRef`, ticked or not (corrected 2026-08-26).** It used
  to be stamped only when the picture was sendable AT INGEST, and that quietly made the provider's tick
  **one-way**: `BuildImageRef` bails on a blank `doc.ImageRef`, so the read side can only ever SUBTRACT refs.
  A picture the default left OFF — every `Logo`, `Decorative`, `TextSnapshot`, `Unclassified`, and now every
  `Blurry`/`Tiny` one — could be ticked, would save, would read "Can be sent", and the assistant would never
  learn it existed until somebody reprocessed the document. The read-side test
  `Search_ImageNotOnTheLiveAllowList_StampsNoImageRef_EvenThoughTheCardCarriesOne` was already written for
  the corrected model; the ingest gate was the anomaly. **Do not re-add it** — it bought nothing the
  allow-list does not already do, and cost the tick.
  ‼️ **`Failed` IS on the allow-list (corrected 2026-08-26).** `Failed` marks the THUMBNAIL, not the asset —
  the enum and `MediaDerivativeFailureMarker` both say the stored original keeps serving sends — so
  excluding it silently withdrew a provider-ticked, perfectly good picture from everything the assistant can
  offer, purely because a grid tile could not be generated. Only `Deleted` is truly gone, and
  `ResolveSendableImages` gates on the status as well as the toggle because a tombstone KEEPS its `blobPath`.

### Delete — a TOMBSTONE, never a row removal (owner-requested 2026-08-25)
`DELETE knowledge/documents/{docId}/images/{imageId}` (`voice.settings.manage`). Assets are deleted FIRST
(the reverse order can leave a live entry whose picture is gone), then the entry becomes
`Status = Deleted`, `Sendable = false`, no thumb, no caption, `Bytes = 0`, in the same CAS.
‼️ **Why a tombstone:** `imageId` is the hash of the picture's bytes, so a plain removal would let the very
next Reprocess re-extract, re-caption (a paid vision call) and re-upload exactly what the provider deleted.
The lane drops tombstoned assets **before the cap** (a deleted picture must not hold a slot, nor count as
"dropped by the cap"), the artifact-replay path carries them forward untouched, and `MergeRegistry` refuses a
run's live entry for a tombstoned id — the commit is the last gate. Refused with 400 while the document is
`Processing`, exactly as the sendable toggle is. **There is no ADD**: every picture came out of the
provider's own file, and the panel is the truth about that file.

### The API (`KnowledgeController`)
| Endpoint | Permission | Note |
|---|---|---|
| `GET knowledge/documents` | existing | ‼️ **COUNTS ONLY** (`imageCount`, `sendableImageCount`, `droppedImages`) + `imagesEnabled`. This list is POLLED and `GetUrlForReadAsync` ensures the container exists ⇒ a read-SAS is a storage round trip; projecting URLs here would have made ~1,600 storage calls per poll. |
| `GET knowledge/documents/{docId}/images` | `voice.read` | The ONLY SAS-minting path. Bounded `Parallel.ForEachAsync` at `ImageSasConcurrency` = 8, indexed by position so registry order survives completion order. 404 while dark. |
| `PATCH …/images/{imageId}/sendable` | `voice.settings.manage` | Registry field merge, CAS, 400 while Processing. |
| `DELETE …/images/{imageId}` | `voice.settings.manage` | The tombstone above. |

‼️ **Wire names are the platform image shape — `thumbnailUrl` and `url`** — so the apps' shared
`getThumbSrc`/`getOriginalSrc` helpers work on these unchanged. A tombstone is excluded by `LiveImages(row)`
from every count, tile and SAS.

### Send — `MaterialExcerptBuilder`, and the budget rule
Photo items are `VoiceMaterialItemKind.Photo`, capped by `MaxSendImagesPerExcerpt` (4).
‼️ **Photos RESERVE their room before the text is packed**, bounded to half the budget and always allowing
at least one: packing them last let a single large table starve every picture the caller asked for. Two
passes — the shipped break-at-first-overflow TEXT contract is byte-identical, then pictures are emitted in
document order after their own document's text. `send_material_info` re-checks the registry live (R3), so a
stale ref fails soft.

### The provider UI — inside the document, never a third tab (owner decision 2026-08-25)
Owner considered a "Pictures" tab like *Service suggestions* and chose **Option A**: suggestions are a QUEUE
that arrives on its own with a pending count and batch actions; pictures are PART OF A FILE, arrive already
decided, and are governed by that file's own sharing switch. A tab would reprint the document name above
every group and put the governing switch on another tab.
- **Row line, closed by default**: `6 pictures · 4 can be sent · Show pictures` — the same "quiet line +
  underlined action" idiom the row already uses for offerings and suggested services. Drawn only when
  `imagesEnabled && status === Ready && count > 0`. One document open at a time; "Hide" closes it.
- **Panel**: square tiles (web `grid-cols-3 sm:4 lg:6`, mobile 3 across), `object-cover`, rounded-10 —
  lifted from `PortfolioCard.jsx` / mobile `PhotoCard.tsx`. **12 tiles, then "Show N more"** with the exact
  remainder. ONE control per tile: the brand-green tick.
- ‼️ **The tile PREFERS `thumbnailUrl` and FALLS BACK to `url` (corrected 2026-08-26).** A grid must never
  pull full-size originals as its FIRST choice (40 × 2048px is tens of megabytes), but the thumbnail is an
  optimisation, never the gate on a provider seeing their own picture: a derivative that never landed, or a
  read-SAS that dies between mint and paint, falls through via `onError` rather than stranding the tile on a
  veil nothing resolves. "Picture unavailable" only when NEITHER source exists. The old `image.processing`
  veil is gone from this panel — it was permanent whenever a thumbnail was lost, and the full image was in
  the same API response the whole time. The VIEWER, one picture at a time, takes `getOriginalSrc`.
- The kind line also names `Blurry` / `Very small` when the vision call said so — that verdict is what
  withholds the default tick, and an unticked picture with no explanation is worse than no verdict.
- **Tick is never optimistic** — a tick that looks saved and is not is the worst outcome here. Disabled and
  the grid dimmed while the document switch is off, with one line saying why; the ticks are **remembered**,
  not erased.
- **Delete lives in the viewer, always behind the dialog** (the portfolio's red-circle dialog, brand-green
  outline on the safe button), showing the picture and the line "it stays deleted even if this file is
  processed again".
- `canManage` (`voice.settings.manage`) hides ticks and Delete entirely — never a disabled control.
- Files: web `components/Profile/knowledge/KnowledgeImagesPanel.jsx`; mobile
  `Screen/ProfileFlow/Knowledge/KnowledgeImagesPanel.tsx` + `knowledgeImagesStyle.ts`.

### Two copy/behaviour changes shipped alongside (owner, 2026-08-25)
- `knowledge.drafts.row.review` / `KNOWLEDGE.DRAFTS_ROW_REVIEW`: **"Review below" → "Review"** in all five
  catalogs on both apps — the link switches TAB, so "below" was stale.
- ‼️ **The suggestions-tab attention ring is gated on the COUNT, not only on the arming.** Approving the
  last suggestion inside the cue window drops the badge to zero while the timer still runs; a ring around a
  tab with nothing waiting is a nudge toward an empty room. Both apps: `cueVisible && count > 0 && !on`.

### The dark path (every seam pinned by a named test)
`ImagesDisabled_TheLaneNeverRuns_AndTheRowCarriesNoRegistry` (Functions) ·
`Build_ImagesDisabled_MaterialRuleIsByteIdenticalToTheShippedParagraph` (MCP) ·
`Search_ImagesDisabled_NeverSelectsImageRef_AndStampsNone` + `Search_ImagesDisabled_NeverReadsTheAllowList`
(MCP) · `ListKnowledge_ImagesDisabled_CarriesNoCounts_AndMintsNoSas`,
`UpdateImageSendable_ImagesDisabled_Is404_AndNeverReachesTheService`,
`DeleteImage_ImagesDisabled_Is404_AndNeverReachesTheService`, `SasUrls_ImagesDisabled_GifIsStillUnsupported`
(API). ‼️ Selecting `imageRef` while the index does not declare it is a query-time 400 — that is why the
field is only added to `options.Select` behind the switch.

### Where the tests live (§0.18 — the HOST that runs the code)
Functions unit `Knowledge/KnowledgeImage{Normalizer,Extractor,Store}Tests` + `KnowledgePdfFixture` (writes
real PDFs with DCTDecode image XObjects at known rects) · Functions integration
`KnowledgeImageLaneIntegrationTests` (real Cosmos + Azurite; **mixed-case business/doc ids on purpose** so a
lower-casing regression fails loudly) · API unit `KnowledgeControllerTests` + `KnowledgeManagementServiceTests`
· API integration `KnowledgeImagesIntegrationTests` · MCP unit `ProviderKnowledgeSearchServiceTests` +
`MaterialExcerptBuilderTests` · web `knowledgeImages.test.jsx` + `knowledgeGuards.test.js` · mobile
`__tests__/knowledgeImagesParity.test.ts`.
‼️ Mobile i18next pluralizes on `count` ONLY via `_one`/`_other` siblings — a single `"{{count}} pictures"`
key reads "1 pictures". The web app uses ICU plurals in the same catalogs.

### Delivered in Phase B — see the next section
PPTX picture extraction and WhatsApp-native image messages are BUILT (2026-08-25). Programme record:
`C:Nikknowledge-image-extraction`.

## ‼️ KNOWLEDGE IMAGE EXTRACTION & DELIVERY — PHASE B (P4 PPTX + P5 WhatsApp pictures), BUILT 2026-08-25

**No switch here either** (deleted 2026-09-01): `.pptx`, `.webp` and `.gif` sit in the always-on
`StorageConfiguration:ProviderKnowledge` allow-list and picture messages always ride the send.

### P4 — the deck lane (`KnowledgeDocumentParser.Pptx.cs`, its own partial)

- **A deck is uploadable ONLY behind the switch**, like `.webp`/`.gif`. `KnowledgeController` now carries one
  `FeatureExtensionMimeTypes` map (`.pptx`/`.webp`/`.gif` → the exact content types each may declare); the
  ingest routes `case ".pptx" when imagesEnabled` and otherwise falls to the unsupported-format failure.
  ‼️ `.pptx` is deliberately NOT in `StorageConfiguration.AllowedExtensions` — that list is the always-on
  contract, and these three appear and disappear with the feature.
- **$0 in Document Intelligence.** `.pptx` is not in `DiExtensions`: the text is OpenXml, in-process. The only
  new spend is a vision caption per UNIQUE contentHash, reused business-wide.
- **One section per slide** — its own title when it has one, else `Slide N` (structural, the same posture as
  the XLSX lane's `"Sheet"` fallback). ‼️ **A slide's own title IS content** — unlike a sheet's NAME, somebody
  typed it — so a cover or divider slide carrying nothing else still contributes its heading. The synthetic
  `Slide N` label is NOT content: a deck with neither real text nor a picture fails honestly as unreadable.
- **`Page` = the slide number, and that is honest here** in a way it never was for DOCX/XLSX: a deck really is
  numbered. A **hidden slide is skipped but keeps its number** — PowerPoint does not renumber around it.
- ‼️ **Only SLIDE parts are read.** Layout and master parts hold the template furniture; reading them would
  turn one template logo into sixty "product photos", a paid vision call each. **Speaker notes are skipped**:
  they are the author's private prompts and this material is SENT to callers.
- ‼️ **Two dedupe layers, both earned**: the parser keys on the IMAGE PART's `Uri` (one part reused on sixty
  slides is read once), and the lane still collapses identical bytes on contentHash (the same picture stored
  as separate parts). A **linked** picture (`<a:blip>` with no `r:embed`) has no bytes in the package — it is
  COUNTED as skipped, never silently dropped.
- Slide tables become Table blocks (vertical merges carry, exactly like the DOCX reader); a multi-paragraph
  text body becomes ONE List block, preserving the grouping the author gave it; group shapes recurse.
- **Provider UI**: a deck's picture is labelled **`Slide N`**, everything else `Page N`, chosen from the file
  name (`knowledge.images.slide` / `KNOWLEDGE.IMAGES_SLIDE`). The upload hint and invalid-type message gain
  `…WithSlides` variants naming PowerPoint — shown ONLY when `imagesEnabled`, because a hint that promises a
  format the API would refuse is a lie the switch creates.
- ‼️ **Phase-A gap closed in passing**: the web and mobile clients rejected `.webp`/`.gif` unconditionally, so
  the owner-approved capability was unreachable through the product. Both now mirror the server's rule
  (`isAcceptedKnowledgeExtension` / `acceptAttributeFor`; mobile `checkMediaFile(..., extraExtensions)`), and
  the "convert it to PNG or JPG" message only fires while the lane is dark.

### P5 — the picture as a picture on WhatsApp

**One image per message is a platform fact, not a choice.** A Meta template header carries exactly ONE media
object, and the Cloud API has no multi-image message; **carousel templates are marketing-only**, so they
cannot carry a caller-requested transactional send. N pictures = N messages.

- **The PDF never changes.** One render, byte-identical for WhatsApp and email, every picture inside it. The
  chat pictures are **ADDITIVE** — so an oversize picture, a closed window, an unapproved template or a Meta
  rejection loses nothing. The two channels can never disagree about what the caller received.
- **In an open 24h window** the pictures go as free-form `SessionImage` messages (free). **Outside it** each is
  the new UTILITY template `clinket_info_picture` (IMAGE header, one body variable), **live APPROVED/UTILITY
  in all five languages since 2026-08-25** (`ApprovedLanguages: ["en","es","fr","hi","gu"]` in the API and
  Functions hosts). `HasApprovedTemplate` remains the gate: empty ⇒ no picture messages and today's
  document-only behaviour, so a language Meta later rejects degrades instead of failing.
  The free-form caption is `WhatsApp_MaterialInfo_PictureCaption`, deliberately the SAME sentence as the
  template body, so the caller cannot tell which path ran.
- ‼️ **Reused templates are impossible**: `clinket_info_ready` declares `format: DOCUMENT` and a header format
  is fixed at creation. Making it take an image means EDITING it — re-review, and the 30-day name lock.
- ‼️ **Meta subcode 2388299 — a variable may not be the first or last element of a body.** The first English,
  French and Spanish drafts ended on `{{1}}.` and were refused; every locale now has `{{1}}` mid-sentence.
- **Caps, both appsettings, both tunable** (`Voice:Knowledge:Images`): **`MaxImagesPerSend`** (renamed from
  `MaxSendImagesPerExcerpt`) is how many pictures the DOCUMENT carries; **`MaxWhatsAppImageMessages`** is how
  many of those also arrive as chat photos. `0` turns the billed leg off.
  Worst case per send = 1 document + 4 pictures; `MaxMaterialSendsPerCall` (2) bounds a call at 10.
- **Eligibility is checked before a round trip**: `WhatsAppMediaLimits.IsSendableImage` (image/jpeg|png,
  ≤5 MB — Meta's documented limit). ‼️ R2 fidelity pass-through means a clean in-cap PNG is stored
  byte-identical, so a 2048px PNG CAN exceed 5 MB; it simply rides the document only.
- ‼️ **The read SAS is minted per picture and ONLY once the message will be enqueued** — it is a storage round
  trip (`EnsureContainerExistsAsync`), so a closed window with an unapproved template spends zero.
- ‼️ **The Service Bus dedup id is keyed on the picture's IDENTITY** (`p{contentHash[..8]}`), never its
  position: if a redelivery finds one blob gone the survivors shift down, and a positional key would then
  suppress a DIFFERENT picture under an id the queue has already seen.
- **The picture leg is fail-soft by construction**: it runs only AFTER the document is enqueued, and any
  failure is logged and swallowed — the caller was already promised the details and the PDF carries them.
  A consent block stops everything, document and pictures alike.
- The same picture named by two refs is sent to the chat ONCE (the PDF still lays out what the model asked
  for); a picture with no resolved bytes never reaches the leg.

### CSV — SHIPPED in knowledge-extraction Phase 2 (2026-09-13); the 2026-08-25 deferral is SUPERSEDED

‼️ **Corrected 2026-09-25 (P4-I-04).** `.csv` is an accepted knowledge upload
(`StorageConfiguration:ProviderKnowledge:AllowedExtensions` in the API appsettings) and both provider apps
accept it. The ingest routes it to `KnowledgeDocumentParser.ParseCsv` after `KnowledgeTextDecoder.Decode`
(a BOM first, then BOM-less UTF-16, then strict UTF-8, then windows-1252), and the draft analytics job reads
it the same way. The deferral's fear — a mis-read CSV silently shredding a price list — is answered by
reading it as ONE table, never as lines:

- **Delimiter chosen by evidence, never by platform**: among `,` `;` tab `|`, the candidate that gives the
  same field count on the most of the first 20 rows of an 8 KB sample (a continental export writes `45,00`
  and separates with `;`).
- **RFC 4180 quoting**: a quoted field may hold the separator, a line break, and `""` for a quote.
- **Header by the detector's own evidence rule** (A-22): row 1 is a header only when it carries no digit,
  something follows it, and it passes the label veto (`LooksLikeALabelRow`) — a one-cell title line such as
  `Price List` never becomes the column labels.

**Refused at the gate with their own sentence** (`KnowledgeRefusedFormats`): legacy `.doc/.xls/.ppt`
(+ `.dot/.xlt/.pot`) → `Error_KnowledgeLegacyOfficeFormat`; macro-enabled `.docm/.xlsm/.pptm`
(+ `.dotm/.xltm/.potm/.xlsb/.ppsm`) → `Error_KnowledgeMacroEnabledFormat`. The apps' convert hints
(`convertHintFor` in web `knowledgeMeta.js`, `CONVERT_HINTS` in mobile `Knowledge/index.tsx`) map only
`.tsv`/`.xls` → *"save it as Excel (.xlsx)"* and `.doc` → *"save it as Word (.docx)"*; **`.csv` must never
be in either map** — the server reads it. Every convert target must be an accepted extension.

### The AI side — deliberately unchanged
`send_material_info` is ONE tool for both: text refs and picture refs ride the same `refs` list, so there is
nothing for the model to choose between. The picture rule lives in the **gated** first prompt
(`RealtimeSessionPayloadBuilder`) and is byte-identity pinned — it was NOT copied into the tool's static
`[Description]`, because that attribute cannot be gated and would leak picture vocabulary into the dark path.
Template names are invisible to the model and to the caller; they exist only in appsettings and Meta.

### Where the tests live (§0.18)
Functions unit `KnowledgeDocumentParserPptxTests` (18, incl. positive controls that prove the layout image,
the notes part and the shared image part really exist before asserting they were ignored) ·
`MaterialDeliveryTests` picture region · `WhatsAppPictureWireTests` (the Meta wire shape — the outbound
processor in THIS host is the only runtime consumer of the session verbs) · `WhatsAppOutboundProcessorTests`
SessionImage · `VoicePostCallProcessorFunctionTests.SelectWhatsAppPictures*` · `KnowledgeIngestProcessorFunctionTests`
deck routing · Functions integration `KnowledgeImageLaneIntegrationTests.ADeck_ExtractsNormalizesStoresAndRegisters_WithTheSlideAsItsPage`
(real Azurite + Cosmos) · API unit `KnowledgeControllerTests` pptx gate · web `knowledgeGuards.test.js` ·
mobile `__tests__/knowledgeImagesParity.test.ts`.
`MetaWhatsAppServiceTests` lives in `Clinqet.Communications.UnitTests/WhatsApp` — the API host never registers
`IWhatsAppService` (only Functions, Identity and MCP do), and Functions is the primary consumer. Moved
2026-09-22 in the repo-wide §0.18 migration; the API's only mention of the class is a comment.

### Two pre-existing defects found and fixed while building this
1. ‼️ **Three terminal throws inside `ExtractAsync` left the row on `Processing` forever.** The outer handler
   completes the message because "the row already says Failed" — true only for `FailTerminalAsync` callers.
   `Error_KnowledgeUnreadable` (×2) and `Error_KnowledgeUnsupportedFormat` threw the bare exception, so the
   document span forever and the provider was never told. All three now go through `TerminalFailureAsync`.
2. ‼️ **`MaterialPdfStub` in the Functions integration suite still set up the 5-argument
   `GenerateMaterialInfoPdfAsync`** after Phase A added the `imageBytes` parameter, so Moq returned a NULL
   Attachment and three material-send integration tests were silently red (trap #3).

### The Meta templates
`clinket_info_picture_v1` submitted 2026-08-25 on both WABAs, all **PENDING / UTILITY**, `allow_category_change:false`
(Canada `en_US`/`hi`/`gu`/`fr_CA`/`es`; India `en_US`/`hi`/`gu`). Wording, ids and the promotion procedure —
proof approved ⇒ create the production name ⇒ delete the proof ⇒ only then set `ApprovedLanguages` — live in
`C:\Nik\knowledge-image-extraction\WHATSAPP-PICTURE-TEMPLATE.md`.
## RECENT CHANGES — 2026-09-04 (‼️ EXTRACTION FIDELITY: image placements, image grounding, worksheet regions, overview figures, one analyzer — SHIPPED, owner deploys)

Session B of the knowledge-flow source review. Findings **EX-13, EX-14, EX-15, EX-20, EX-33** of
`C:\Nik\Data\knowledge-flow-source-review\EXTRACTION-PASSAGE-AUDIT.md`. **21 sabotages**; suites green
in-tree: **API 11 539 · Communications 3 838 · MCP 856 · cosmosindexsetup 181 · 0 build errors**.

### EX-14 — one picture, MANY placements (`KnowledgeDocumentParser.*`)

A part reused in three sections emitted ONE marker, so sections two and three could never reach the
picture. Every placement now emits its own `ImageMarker` **at the same image index**: one payload, one
upload, one description call, a card per placement.

- DOCX/PPTX/XLSX each keep a `Dictionary<string,int> indexByImagePart` (was a `HashSet` that skipped).
  ‼️ XLSX's map is now **document-level**, so a logo on six sheets is read ONCE (it used to be read per
  sheet) — a cost improvement that came free with the fix.
- **`KnowledgeDocumentParser.CollapseRepeatedImageMarkers`** is the ONE shared rule, run at the end of
  each parser, and it enforces two bounds:
  - a repeat inside ONE section is dropped — `ImageCaption` cards are exempt from the chunker's dedupe,
    so its card would be byte-identical to its twin and would occupy a passage slot a real answer needed;
  - a picture in more sections than **`Voice:Knowledge:Images:MaxSectionsPerImage`** (owner-set **8**,
    2026-09-04) is template furniture and collapses to its first placement.
  ‼️ The ceiling RAISES AN ADMIN ALERT (since 2026-10-03 `KnowledgePictureSectionsLimit`, plus `KnowledgePictureSectionsWarning`
  past `Images:SectionsPerImageWarning`; `KnowledgeSectionsPerImage` is now only the limit name), owner-required 2026-09-04: it keeps
  sections OUT of the index, and the owner sized it on no corpus evidence, so the alert IS how that number
  earns a second look. `KnowledgeExtractionOutput.CeilingCollapsedPlacements` carries the count; a
  same-section duplicate is never counted, because its card would have been byte-identical to its twin.
- `CollectMarkers` still returns ONE marker per index: the lane's job is the ASSET, and page/anchor come
  from the first placement exactly as before.
- ‼️ **MEASURED on the eight sample decks by running the parser**: placements 91 → 139, and **only one deck
  of eight loses placements today** (Scene Ecosystem Data Flows, 28 → 76). No picture in any file we hold
  reaches the ceiling of 8, so that dial is a precaution with no corpus evidence behind it — say so.
  ‼️ An earlier probe reported "191 lost across 7 of 8 decks"; it was WRONG. Relationship ids are scoped
  to ONE part, and keying them per directory made every slide resolve to the last `.rels` read.

### EX-13 — the picture nobody could find (`KnowledgeBlock.ImageAltText` → `BuildCards` → the vision prompt)

A picture card was searchable by document title + section + the AI's own words only, so a photo beside
`Model X | $500 | 2-year warranty` was reachable by "machine" and never by "Model X".

- **`KnowledgeBlock.ImageAltText`** (a MODEL field — no store, no §0.7 gate) carries the author's own alt
  text PER PLACEMENT: DOCX `wp:docPr/@descr` (then `@title`), PPTX/XLSX `cNvPr/@descr`, HTML `<img alt>`
  (then `title`). It rides the banked artefact for free, so a replay grounds identically.
- The **neighbouring line** needs no model field: `BuildCards` walks chunks in document order and uses the
  previous non-`ImageCaption` chunk's body. One place, every format.
- ‼️ Grounding rides **EmbedText only, never Content** — the words a caller hears and a send delivers are
  byte-identical to what they were. That is what makes this a recall gain with zero output change.
- ‼️ The grounding's room is **RESERVED from the piece budget** before `SplitIntoBoundedPieces` runs.
  Sized against the budget alone, every piece of a split description filled it and the grounding was then
  dropped from all of them — so exactly the text-heavy pictures with the least specific descriptions were
  the ones left unfindable. Caught by this session's own guard, not by review.
- **The describer is given the same words** (owner: "output and result is the most important thing"),
  quoted between `<document_text>` markers, angle brackets neutralised, bounded to 600 chars, with an
  explicit instruction that it is DATA and may only be used to NAME what is visible (finding #10).
  ‼️ **A picture that HAS source context never reuses a business-wide caption** — the reuse map is keyed on
  bytes alone and would hand the catalogue's photo the price list's product name. `BuildBusinessImageMapAsync`
  is skipped outright when every asset has context.
- Dial: **`Voice:Knowledge:Images:ImageGroundingMaxChars`** (300). Zero turns it off completely.

### EX-15 — a worksheet is not one table (`KnowledgeDocumentParser.OpenXml.cs`)

A price list, a blank row, then a warranty table arrived as ONE table whose header was the price list's,
so the warranty's "7" serialized as `Price: 7`.

- `BuildSheetRegionBlocks` cuts regions at a run of blank rows (**`Voice:Knowledge:XlsxRegionBlankRowGap`**,
  default 1) and at the edge of a declared table range; header detection is **per region**.
- ‼️ **The property that makes it shippable: a region that declares no header INHERITS the previous
  region's row.** Splitting can change which labels a row is read under, never whether it has any.
- ‼️ **A row WE dropped is not a row the author left empty.** A hidden row leaves a gap in the row indexes,
  and reading that gap as a blank separator split one table in two — the rows below then lost their labels.
  `notBlank` records every row the sheet actually wrote, hidden or emptied by the hidden-column strip.
- ‼️ **THE DECLARED LIMIT.** Blocks separated by blank rows with NO declared header anywhere still inherit.
  Promoting a region's first row on its SHAPE was tried and rejected: `LooksLikeALabelRow` answers **yes**
  to `Colour | 60.00`, because a bare number carrying no unit is not a value-only line (R1's ban on shape
  inference is not decoration). A named Excel table contributes its name as a section; `TableN` never does.

### EX-20 — the overview that sounded sure of itself (`KnowledgeSummaryFactCheck`, Functions host)

The AI-written overview is indexed BESIDE the document's own rows and answers with the same authority, so
"prices start at around $4,000" against a list that says $4,500 is a wrong price a caller hears.

- Every figure in the overview must be traceable to something the describer was SHOWN: the computed
  inventory and its aggregates, the document's blocks, the file name, the title. One traceable to nothing
  was invented, and **the SENTENCE carrying it is dropped** — never a number rewritten, never a number
  deleted mid-sentence, because the result is spoken. Nothing survives ⇒ the computed figures ship alone,
  which is the existing D11b path. Admin alert either way; a clean overview ships byte-identical.
- ‼️ **ANY reading, not every reading.** `$1,200.00` reads as 1200 in English and 1.2 where a comma is the
  decimal point; demanding both made the check STRICTER than a plain digit match and dropped true
  sentences. Ranges, `/hr`, `%`, `₹1,00,000`, European `4.500`, and Gujarati/Devanagari digits are all
  covered by a sweep.
- ‼️ **A space ENDS a number, it never groups one** — reading `25 services and 60 items` as 2560 removes
  25 and 60 from the supported set and drops the provider's own true sentence.
- ‼️ A terminator ends a sentence only when whitespace or the end follows it; that ONE rule keeps `$25.00`
  whole. A separate is-the-next-char-a-digit test was written, **sabotaged, and PASSED** — it was
  unreachable, and was deleted.

### EX-33 — one analyzer across every searchable field (`cosmosindexsetup/KnowledgeSearchIndexInitializer`)

`docTitle`, `sectionTitle`, `docName` and `linkedServiceNames` were the last searchable fields on
`standard.lucene`, so the same word was analyzed two ways in two fields of one card: "price lists" reached
`content` and missed a section titled "Price List", and "cafe" missed "Café" (standard.lucene does not fold
accents; en.microsoft emits BOTH). All seven searchable fields now use **en.microsoft**.

- ‼️ **MEASURED on the live Analyze API, not assumed**: Gujarati, Hindi and Punjabi tokenize
  **byte-identically** under `standard.lucene` and `en.microsoft` — neither stems them — so the change is
  provably neutral for those scripts.
- ‼️ **It does NOT fix Indic stemming.** `gu.microsoft` does stem Gujarati (દુકાનો → દુકાન|દુકો|દુકાનો) but
  then stops stemming English, and a field carries ONE analyzer. Serving both needs per-language fields —
  a separate proposal.
- ‼️ **An analyzer change is NOT additive**: index drop + recreate + re-ingest of every document. Owner
  approved 2026-09-04 and schedules the rebuild.

### Evidence

- **Corpus (8 sample decks + 9 live Word files): 28 103 characters in, 28 103 out — delta 0**, and the
  per-character census is byte-identical on **17 of 17**. The only change anywhere is image placements.
- **Live: 9 of 9 live `.docx` produce byte-identical CARDS** before and after this session (parse → chunk,
  run against the real source blobs, nothing written).
- ‼️ **A live-index/HEAD drift found on the way, NOT from this session**: `Shree_AutoCare_..._Test.docx`'s
  live cards differ from what the current code produces by 719 characters, and the live text runs cells
  together (`"GarageService location: IndiaCurrency"`) where the current code spaces them. A fix already in
  `main` is not deployed. Reprocessing that document after the next deploy improves it.
- ‼️ **What live data CANNOT cover, stated plainly**: there is no live `.xlsx` and no live `.pptx` in either
  region, and all nine live `.docx` contain **zero pictures**. EX-13, EX-14 and EX-15 are proven on the
  sample decks and synthetic fixtures only. All 843 live cards are Latin-script, so EX-33 has no live
  exposure today either.

## RECENT CHANGES — 2026-08-24 (caller-ID choice RETIRED from the UI + drafts link-chips removed + the URL-capture class fix)

- **The "whose number shows?" picker is GONE from the UI on every stamp (owner).** `VoiceAssistantSettings.CallerIdChoiceEnabled`
  default `false` (class + API appsettings, both pinned by `CallerIdChoice_IsRetiredByDefault_ClassAndAppsettingsAgree`); the web
  form section, its prop threading and its 7 `voiceAssistant.form.callerId*` keys ×5 are deleted (mobile never rendered it and
  never sent the field). Every save persists `Application.CallerIdMode = null` ⇒ voiceline null ⇒ **Telnyx dials with
  `bridge_intent` (caller's number) — the CA/US behaviour the owner wants**; India/Plivo unchanged (DID-locked, DoT). The enum,
  entity/DTO fields, `bridge_intent` branch and the plain-DID fallback ALL stay — a pre-retirement stored `ClinketNumber` is
  honoured until its next save (the one CA sandbox voiceline already held `CallerNumber`, so nothing needed fixing). The India
  `PostConfigure` hard-disable in API `Program.cs` stays as the DoT belt-and-braces.
- **Voice settings layout**: the four "When should the assistant answer?" cards render as a 2×2 grid (`sm:grid-cols-2`) with the
  Call recording toggle below — matching the order mobile always had.
- **Drafts UI: the "Link found in the document" chips are REMOVED (web + mobile + 10 catalogs) and
  `KnowledgeServiceDraftDto.SourceUrls` is dropped** — the entity keeps `sourceUrls` as write-only provenance (owner may drop it
  later). ‼️ The chips were showing WRONG data: `KnowledgeServiceCandidateDetector.CollectUrls` swept lines ±1 unconditionally, so
  on the live Hamilton feed every draft carried its NEIGHBOURS' links (a dozer holding forklift PDFs — 4 of 6 chips foreign), and
  because the sweep started at −1 a neighbour's photo would have BEATEN the row's own photo in `SelectImageUrl` on any feed with
  per-row image URLs. **The class fix: a row that names its own links OWNS them; neighbours only fill silence** (preserves the
  flyer case — image line beside a priced row). Pinned by two detector tests + harness D06.
- Web test repair: `voiceApplicationValidation.test.jsx`'s consent helper clicked the FIRST label-role checkbox — the training-
  consent box, which sits above the submission consent — so 3 tests failed on the untouched tree; it now finds the box through
  its own row text.

### The AI Knowledge page REDESIGN — v4 then v5 (both owner-approved) — SHIPPED web + mobile
Mockups (design authority for words/states): v4 `C:\Nik\Data\mockups\knowledge-page-redesign\index.html`, then
**v5 `C:\Nik\Data\mockups\knowledge-page-layout-v5\index.html` (current)**.

**v5 structure — TWO PAGE-LEVEL TABS, and TILES inside (v4's inner tabs and its "All" tab are GONE).**
The page splits into "Documents & FAQs" and "Service suggestions" (web `knowledge.tabs.*`, mobile
`KNOWLEDGE.TABS_*`; mobile says "Suggestions" for width). The suggestions tab carries a lime pending-count
badge plus a **short-lived arrival ring**. ‼️ TWO deliberate departures from the workspace chip it
descends from: it **PULSES** (`.attention-ring` web / an `Animated` scale + `AccessibilityInfo.isReduceMotionEnabled`
mobile — 3 cycles then hold; a static ring on a tab that already has borders reads as decoration), and it uses a
**LIGHTER green** (`#C8F49E` ring on `#F7FFEF`, `#DCF6B8` badge) instead of brand `#97EF29`. The workspace chip sits
on white chrome with nothing green near it; this cue lands on a page already carrying brand green on the sidebar
pill, Upload documents and every Ready chip, where the same ring competes instead of inviting — the motion carries
the attention, so the colour steps back. ‼️ **Never lighten the workspace chip itself: it has no motion and needs
the weight.** The full-strength green stays for SELECTED/pressed state everywhere (brand rule) — the workspace chip's `ring-2 #97EF29` / `#F4FEE9`, armed once per
visit and released by a timer (`KNOWLEDGE_CUE_MS` = 5000, web `knowledgeMeta.js`, mobile `knowledgeSurface.ts`).
‼️ The timer is keyed on an ARMED flag, never on the pending count — a background refresh inside the window
would otherwise clear it and strand the ring on. A document row's "Review" switches tab AND seeds `focusDocId`
as that section's initial `docId` filter (seeded in `useState`, never adopted afterwards, or every tap costs
two identical requests).

Inside the queue, New vs Changes are **two tiles that state what approving does**, not tabs:
`resolveDraftTiles` renders a tile only for a kind with work — two tiles, ONE full-width tile, or none.
`resolveDraftSection`/`sectionToKind` replace `resolveDraftTab`; there is no "All". ‼️ The active section is an
INVARIANT, re-checked on every payload, not a one-time default: emptying a kind removes its tile, and a
provider left on a tile-less section has no cards, no tile to leave by and no empty state. The check stands
down while a ghost confirmation is on screen. At 0 pending the tab shows its own empty state (`drafts.empty.*`)
— it never vanishes.

**Mass actions — `resolveMassActions` is the single rule (web `.js` + mobile `.ts`, both jest-pinned).**
ONE accept button per section, plus a kind-wide dismiss:
- New: "Add all new services (N)" + "Dismiss all new (N)". Additive and reversible ⇒ business-wide is safe.
- Changes: **"Update the N shown"** (page-scoped ALWAYS; label becomes "Update all N changes" when the section
  fits one page) + "Dismiss all changes (N)". ‼️ There is still deliberately **NO business-wide update-all** —
  an update overwrites a service the provider configured, and the live SX3SG2 queue proved why (43/43 changes
  were category downgrades). The v5 endpoint is page-scoped precisely so one human glance stays in the loop.
- ‼️ Any secondary filter (document / search / please-check) downgrades New to the view-scoped "Add the N
  shown" and HIDES both kind-wide dismisses — a mass button must never touch a card the provider cannot see.
- The whole bar hides while loading and while a bulk run is paused (the "Continue adding" banner is then the
  accept control — two would be two accept buttons for one job).

‼️ **THE CROSS-LAYER COUNT CONTRACT — the defect class a layer-by-layer review CANNOT see.**
Every number on a mass button must equal what the SERVER will actually do, and both must come from ONE list.
The server refuses amber and stamped cards in bulk (`ResolveAmberSkip`), so the client mirrors that rule
exactly in **`isBulkApplicable` / `resolveBulkTargets`** (web `.js` + mobile `.ts`, jest-pinned) — the DTO
maps each amber flag one-to-one, so the client's copy is authoritative, not a guess. `shownCreateTargets` /
`shownUpdateTargets` feed the label, the confirm dialog AND the request ids; deriving them separately is
exactly how three defects shipped in one session:
1. "Add all new services (N)" took N from `totals.creates`, which COUNTS amber — clicking added 0 while the
   button kept promising N. Fixed by `bulkExhausted`: the server's own `remaining` from the last run says
   nothing is auto-approvable, the button withdraws, and `drafts.allNeedCheck` says why. Any later
   edit/approve/dismiss/re-run clears it.
2. "Update the N shown" / "Add the N shown" SENT the amber cards; the server skipped them and returned
   failures, so a perfectly normal action raised a partial-FAILURE toast.
3. "Approve it as a change" moved the card to the other section with NO ghost and NO toast — it simply
   vanished. Now `drafts.asChangeMovedToast` / `…asChangeAlreadyToast` (the returned DTO's `kind` is the
   discriminator: `Update` ⇒ converted, `Create` ⇒ identical and dismissed).
**When adding any control here, answer all three: where does the displayed number come from, where does the
action's real effect come from, and can they disagree?** A second audit pass with that lens (plus a
journey walk) found five more of the same family, all now fixed and pinned:
4. **The N-shown buttons ignored the server's cap.** Paging twice offered "Update the 75 shown" against
   `ApproveBatchSize` 25 — 25 applied, 50 returned as `Error_KnowledgeDraftBatchLimit`. The cap is now
   SERVED on the list response (`batchSize`) and `resolveBulkTargets` slices to it.
5. ‼️ **A SKIP is not a FAILURE.** Bulk skips are not stamped on the draft, but "Couldn't be added (N) →
   Show those N" filters on `IS_DEFINED(c.approveErrorKey)` — so it opened an empty list. `KnowledgeDraftFailedItemDto`
   now carries **`Stamped`** (true only from `StampFailureAsync` or an already-stamped row); the client
   counts stamped ones as failures and the rest as left-to-check.
6. **Chip and dropdown counts were business-wide over a kind-scoped list** — "Please check 4" → 0 cards,
   "Price list (12)" → 1 card. `GetTotalsAsync`/`CountPendingByDocumentAsync` now take the requested kind
   and scope **only** NeedsReview/Failed/per-document; Pending/Creates/Updates stay whole (they drive the
   tiles, which are the way BETWEEN kinds).
7. **Stuck states**: mobile's solo tile was `disabled` AND unselected, stranding the provider after
   approving a section's last card (web was right: `solo || active`, always tappable); a stale bulk-done
   banner held the panel open at "0 to review" with no cards and no empty state (the banner now renders
   INSIDE the empty state); a stored run whose creates were gone was only hidden, so a later upload
   resurrected "Continue adding (19)" against dead ids (it is now deleted).
8. **Mobile's footer lacked `!hasBulkResume`**, so it sat beside "Continue adding" and, when pressed,
   restarted the run at `done:0` with the stored `excludeIds` discarded.
9. **A "show more" could overtake a post-mutation reload** — the append takes a newer sequence, the reload
   is dropped by its own guard, and page 2 merges onto the PRE-mutation list, resurrecting approved cards
   into the cache. Both platforms now refuse to append while a mutation is in flight (mobile matters most:
   it fires from every throttled scroll event).

**Per-visit response cache** (`knowledgeDraftCache` — web `.js` + mobile `.ts`, jest-pinned, LRU 10 entries,
60 s fresh then stale-while-refresh, browser/device memory only). ‼️ Two guards make it safe: an **epoch**
bumped by `clear()` so a read that started before a mutation can never be stored afterwards, and a **request
sequence** bumped on every filter change *including a cache hit* and by `invalidate()` — a mutation supersedes
a read already in flight, or a pre-approve payload renders the approved card back to life and wipes its
confirmation. Cleared by every mutation, every re-run, the live document signal and a workspace switch.
A single approve/dismiss deliberately does not refetch (the ghost card IS the confirmation), so it decrements
the totals by hand — otherwise the tile, the "N to review" pill and the page's tab badge disagree.

**Confirm-first is unchanged and now 11 dialogs**: approve one / update one / approve-as-change / dismiss one /
add-the-shown / **update-the-shown** / dismiss-the-shown / add-all-new / **dismiss-all-new** /
dismiss-all-changes / dismiss-all-from-doc — ONE `confirmAction` state per platform (web `ConfirmationModal`,
mobile `ConfirmDialog` bottom sheet, same words); the amber edit-first intercept still precedes any dialog and
"Save and approve" stays single-step. Mobile puts the mass actions in a **fixed footer** (wrapping, one button
per row — two labelled buttons cannot share a 320pt row) that renders only on the suggestions tab; the upload
footer is gated to the documents tab so the two never stack.

Cards: category · where · area on ONE line for creates; update cards show ONLY the changed diff rows; `sectionPath`
renders only on amber cards (beside "written as"); the "Link found in the document" chips are gone. Document rows:
"{n} services suggested · Review" (switches to the suggestions tab, filtered to that document) / "No services found
in this document · Run again" / "AI Data Analytics failed · Try again"; the brand renders once, on the box.
Backend for the redesign:
- **`POST knowledge/service-drafts/dismiss-by-kind`** (`voice.settings.manage`, body `{kind, docId?}`):
  collects the WHOLE pending set of that kind first (paged walk at the repo's 100-item ceiling — never dismiss
  while walking), then rides `DismissBatchAsync` (same tombstone+TTL semantics). Unit (controller row + service
  walk) + real-emulator integration test.
- **Category-only updates are SUPPRESSED at the ingest tail** (owner decision, mockup §8.3): an extractor update
  whose `Changes` carry no "price" never becomes a draft and counts into `AlreadyInCatalogCount` instead. The
  user-initiated approve-as-change path is deliberately NOT filtered. Existing category-only Pending rows vanish on
  the next re-ingest (reconcile) or via Dismiss all changes.
- Key surgery ×15 catalogs: web 5700 keys/file (12 removed, 13 reworded, 33 added — count-bearing copy is ICU
  plural), mobile 258 KNOWLEDGE keys/file (14 removed incl. the `_one/_other` splits of BULK_CONFIRM_TITLE/ACTION,
  13 reworded, 41 added); backend `Error_KnowledgeDraftKindRequired` ×5. fr strings keep the space before `?`.
- Removed as unused: web `filter.show/all/newServices/changes`, `drafts.header`, `subtitleLarge`,
  `approveThese`, `approveAllRemaining`, `settings.title` (web only — the mobile sheet keeps its title),
  `card.categoryLine`, `card.areaLine`, `diff.noChange` + mobile counterparts.

## ‼️ KNOWLEDGE → DRAFT SERVICES ("Clinket AI Data Analytics"), SHIPPED AT CODE LEVEL 2026-08-21 (P0–P8 + audit; owner deploys)

**What it is.** After a knowledge document's CONTENT ingest commits `Ready`, a tail proposes **draft services** from the
priced lines of the document: the provider reviews them in a queue on the AI Knowledge page (web + mobile) and
**approves** (creates the service exactly like Profile Setup does, through the shared writer), **approves as a change**
(name clash → an UPDATE-kind draft with the diff), **edits** or **dismisses**. "Ingest proposes, approve acts" —
nothing touches the catalogue until a person says so. Design authority (do NOT re-open): mockup
`C:\Nik\Data\mockups\knowledge-service-drafts\index.html` **v3.1** (the ONLY source of user-facing words),
`C:\Nik\knowledge-service-extraction\NEXT-SESSION-PROMPT-BUILD.md` + `DECISIONS-LOCKED-2026-08-21.md`. Status/hand-over
blocks live in those files' §10/§5.

### The pipeline (Functions host — `KnowledgeServiceDraftAnalyticsJob`; since 2026-08-29 its OWN queue ticket posted by the Ready commit, never a tail inside the ingest — see the dedicated section below)
1. **Detector** (`KnowledgeServiceCandidateDetector`, code only, zero AI): every unit (table row / self-contained line /
   list item / prose sentence) with a CURRENCY-marked number and a word-bearing name, cut with the chunker's own
   primitives. Bare numbers and `%` are NOT prices. Capped in DOCUMENT ORDER (`MaxCandidatesPerDocument`, overflow
   surfaced as "we checked the first part", `NotFullyScanned`); identical name+price twice = ONE candidate (the
   deterministic id collides); rows already decided (Dismissed tombstones) are skipped.
2. **Offering Judge** (`KnowledgeOfferingJudge`, AI pass #1, **remove-only**): batches of `JudgeBatchSize`, temperature 0;
   an omitted id is DROPPED, an invented id IGNORED, `Unclear` is kept + `needsReview`; it can never change a number or a
   name because it never returns one. A batch failing after `JudgeMaxAttempts` throws ⇒ **ZERO drafts + Failed analytics
   row + one admin alert**, never unjudged candidates. The SYSTEM prompt is the setting `OfferingJudgePromptTemplate`
   (‼️ no industry noun anywhere — §3.7).
3. **Extractor**: the REUSED Profile Setup extractor (`IDocumentIntelligenceService.ExtractFromTextAsync`) over the
   survivors' lines + headings + the head/tail slice where addresses live (`HeaderFooterSampleChars`) — so category
   pairs, price shapes and service areas come from the same code Profile Setup uses. Taxonomy is labelled READ-ONLY
   here (`IProviderSetupTaxonomyResolver`, `allowCustomCreation:false`); custom categories are only ever CREATED at approve.
4. **Anchor** (`KnowledgeServiceDraftBuilder`, pure, no I/O, no clock): an extractor item survives only when a judge-kept
   candidate carries its exact numbers (±0.005, compound "$50/70" splits) AND ≥ `AnchorNameTokenOverlap` (0.60) of its
   normalized name tokens; 1:1 greedy, best overlap first, **mutual overlap breaks ties** (so "Gel manicure" is not
   starved by "Manicure"); a labelled PRICE cell never leaks into the description lines. Then within-document dedupe
   on (normalized name, price text) and materialization.
5. **Reconcile** (D-J): upsert new/refreshed Pending rows (a refreshed row keeps `CreatedAt` and its fetched image),
   delete Pending rows whose line vanished, leave Approved/Dismissed untouched; the business-wide cap
   (`MaxPendingDraftsPerBusiness`) trims THIS document's new set by confidence, counted never silent. Then
   `ServiceDraftAnalytics` is committed on the document row (Queued while a ticket is live → Ran/Disabled/Failed + counts) and ONE
   `KnowledgeServiceDraftsReady` notification per document per ingest generation (durable EventId) goes out.
   ‼️ NOTHING in the tail may fail the document: every failure is contained, alerted once (not on a host-shutdown
   cancellation — stamped Failed only), and stamped so the row offers **Re-run**.

### The rows
- Entity `KnowledgeServiceDraft` in the **KnowledgeBase** container (pk `/businessId`, `type = KnowledgeServiceDraft`),
  id = `{docId}_sd_{sha256(normalizedName|priceText)[..16]}`, **ttl = DraftTtlDays (30) × 86400 on EVERY write** (the
  repository refuses a write without it). Fields per DECISIONS-LOCKED; `queueRank = (needsReview ? 2e13 : 0) +
  round(confidence×10000)×1e9 + (1e9−1−minutesSince2026-01-01)` ⇒ ORDER BY DESC gives **please-check first, then
  confidence desc, then OLDEST first** (FIFO — nothing starves at the back of a 600-draft queue). Status
  Pending | Dismissed (tombstone until TTL so a re-ingest cannot resurrect it) | **Approved**. ‼️ The Approved state was
  removed 2026-08-21 (an approved row was DELETED) and **came back 2026-09-14 with P3-A**: a deleted row is re-detected
  on the next run and spends a cap slot again, so a file too long to read in one pass could never be finished.
  `StampApprovedAsync` writes the tombstone with `approvedServiceId` + `approvedAt` and `ApprovedTtlDays` (730) — long
  enough that a re-run does not re-propose a line the owner has already answered — and clears `approveErrorKey` /
  `approveAttemptedAt` / `needsReview`, so a row that once failed does not read as "couldn't be added" for the rest of
  its life. The write is an **unconditional upsert** (a recorded fact, not a claim), and `DismissCoreAsync` refuses to
  downgrade it: rewriting an Approved tombstone as Dismissed would lose the service it stands for.
- Index (`CosmosContainerPolicies.KnowledgeBase`, applied by `cosmosindexsetup` — ‼️ owner runs it per region with
  `--launch-profile "Dev (Canada)"` / `"Dev (India)"`): `/kind/?`, `/needsReview/?`, `/queueRank/?` + composite
  `(type, status, queueRank DESC)`; `approveErrorKey` / `displayName` CONTAINS / `rowHash` are residual predicates over
  the ≤2000 pending set by design. Every query is partition-scoped and type-filtered; there is NO change feed on
  KnowledgeBase; only TWO classes read the container (`KnowledgeDocumentRepository`, `KnowledgeServiceDraftRepository`).
- **Invisibility proven byte-identical on the live POC partition** (`SX3SG2`, CA): the harness `--invisibility`
  snapshots every `IKnowledgeDocumentRepository` read, writes 25 synthetic drafts into the real partition, re-snapshots
  (sha256 identical), deletes them, re-snapshots (identical) — positive control 0→25→0 through the draft repository.

### The API (`KnowledgeServiceDraftsController`, `api/v1.0/knowledge/service-drafts`) — ONE permission key per endpoint
| Endpoint | Permission | Notes |
|---|---|---|
| `GET ` (list) | `voice.read` | queue page (`DraftsPageSize` 25, `MaxItemCount` ≤100) + totals + per-document counts + served `pendingCap`; ONE services read only when an UPDATE draft is on the page, ONE areas read only when an existing-area draft is. ‼️ **E-21: the five totals are ONE aggregate**, and the `kind` rides INSIDE the two chip sums (`needsReview`, `failed`) — in the WHERE it would narrow the three that must stay whole. Never `SELECT VALUE { … COUNT(1) … }`: the engine refuses an object literal built out of aggregates ("Compositions of aggregates and other expressions are not allowed") and only the emulator test catches it, because the source-shape test asserts wording |
| `PUT {id}` | `voice.settings.manage` | edit; the client's own ETag authorizes the write — stale ⇒ **412**; every "please check" state is answered by the save |
| `POST {id}/dismiss`, `dismiss-batch`, `dismiss-by-document` | `voice.settings.manage` | tombstone (+ blob delete); idempotent; batch capped at `MaxPendingDraftsPerBusiness` (extras reported with `Error_KnowledgeDraftBatchLimit`) |
| `POST {id}/approve` | `catalog.service.create` | CREATE-kind only; ServiceId = `DeterministicGuid(businessId,"knowledge-draft",draftId)` ⇒ twice is once (`AlreadyApproved`); name clash ⇒ **409** stamped on the draft (never a silent rename); price incomplete / category missing / wrong kind / target gone ⇒ 400 |
| `POST {id}/approve-update` | `catalog.service.update` | UPDATE-kind only; CAS-claims the draft (double-apply guard ⇒ 409), applies ONLY the listed changes, the service re-enters review (PendingAIValidation / PendingApproval + alert), a deleted/renamed target ⇒ 400 `Error_KnowledgeDraftTargetGone` |
| `POST {id}/approve-as-change` | `catalog.service.update` | the exact Phase-2 matcher decides; identical ⇒ dismissed + `AlreadyApproved` (returns the dismissed card, never a null body); else the draft becomes UPDATE with the diff |
| `POST approve-batch` | `catalog.service.create` | ≤ `ApproveBatchSize` (25) per request — ids beyond it are reported with `Error_KnowledgeDraftBatchLimit`, never dropped; per-item isolation; the AMBER SKIP below, then `Error_KnowledgeDraftUpdateOneByOne` for a wrong kind and the stamped key for a past failure |
| `POST approve-update-batch` | `catalog.service.update` | **"Update the N shown" — page-scoped ONLY** (the client sends exactly the ids on screen; there is no server-side `remaining`, so no loop can widen it business-wide). Same cap + same AMBER SKIP; one shared `ApprovalContext` so 25 changes cost ONE profile read; each item rides the single-item `approve-update` core (its CAS double-apply guard included) |
| `POST approve-all` | `catalog.service.create` | server selects the next auto-approvable CREATEs (not needsReview, **not currencyMismatch**, no stamped error, not excluded), approves them, returns a fresh `remaining` from a **projection read** (id + completeness fields, never the documents). ‼️ **E-21: the selected rows are HANDED to the approve core**, not point-read again — the select is `SELECT *`, so re-reading bought a whole batch of point reads for bytes it already held. Same for `dismiss-by-document` and `dismiss-by-kind`. A handed-over row is stale-safe (success upserts unconditionally, failure re-reads before it stamps) and in the dismiss CAS loop it serves the **first attempt only** — a conflict means it moved |
| `POST knowledge/documents/{docId}/rerun-analytics` ("Refresh suggestions"; the run-for-all route is GONE) | `voice.settings.manage` | deletes every draft of the document except approved ones, stamps Queued, posts ONE analytics ticket — never a reprocess; Processing ⇒ 400 `Error_KnowledgeReprocessInvalidState`, missing/FAQ ⇒ 404, live ticket ⇒ 400 `Error_KnowledgeAnalyticsRunning`, the day's allowance ⇒ 400 `Error_KnowledgeRefreshTurnedOff` / 429 + `Retry-After` |

‼️ **THE AMBER SKIP — `ResolveAmberSkip`, the ONE rule every mass path shares.** A card the queue paints amber
is never bulk-applied: `NeedsReview` → `…NeedsReview`, `CurrencyMismatch` → `Error_KnowledgeDraftCurrencyMismatch`,
`IsDraftPriceIncomplete` → `…PriceIncomplete`, `IsDraftCategoryMissing` → `…CategoryMissing` — **amber is reported
BEFORE a stamped failure**, so both bulk lists explain the same card the same way. Skipped cards stay Pending and
are answered by hand in the editor (the single-item endpoints deliberately still allow them). ‼️ `currencyMismatch`
was the one amber condition the bulk path missed until 2026-08-24; it is now also a residual predicate on BOTH
auto-approve queries (`ListPendingCreatesForAutoApproveAsync` + `ListAutoApprovableProjectionAsync`), unindexed by
design exactly like `approveErrorKey`, and pinned by `KnowledgeServiceDraftRepositoryQueryShapeTests`.
‼️ `remaining` is counted in memory over the PROJECTION, which omits both stored flags (the WHERE already excluded
them) — it must therefore use only `IsDraftPriceIncomplete`/`IsDraftCategoryMissing`, never `ResolveAmberSkip`, or
Newtonsoft's default `false` makes every row read "not amber" and the count over-reports.

Approve = `KnowledgeDraftApprovalService` (API host): request settings (where / service-area choice) shape THIS approve
only — a failure stamp re-reads the stored row, so they never persist; the default/oldest area is attached when none is
chosen (a business with no areas attaches none, so a brand-new business can still approve); the image is stream-copied
inside storage (`serviceimages/{businessId}/{serviceId}/{imageId}/…`) and derivatives queued; the shared
`ProviderSetupServiceWriter` writes with `ApprovalStatus=Approved`; the subcategory selection + counts + onboarding step
follow. A post-write bookkeeping failure is logged + **forced admin alert (SystemError/High)** and still returns Ok (the
service exists) — never misreported as AlreadyApproved; a pre-write exception falls back to the deterministic-id probe.
Bulk calls share a per-request memo (profile + areas once, onboarding step once).

### Settings (`VoiceKnowledge:ServiceDrafts`, **43 keys on the class** — each host carries ONLY what it reads, owner
decision 2026-08-21: Functions the whole block, API **seven** (`MaxPendingDraftsPerBusiness` · `MaxDecidedRowsPerDocument` ·
`ApprovedTtlDays` · `DraftsPageSize` · `ApproveBatchSize` · `TimeoutSeconds` · `QueuedStaleAfterMinutes`), MCP none.
‼️ **The count here is a convenience, never the contract** — `VoiceKnowledgeSettingsConventionTests` in EACH host is,
and it is two tests, not one: the hand-written registry (add an unread key, or stop configuring a read one, and the
build fails) AND `EveryServiceDraftsKeyThisHostReadsInCode_IsConfiguredHere`, which reads the SOURCE. The second exists
because the first can agree with appsettings while neither agrees with the code — which is exactly what happened to
`MaxDecidedRowsPerDocument`, read by the approval service in the API host and configured in neither, silently falling
back to its class default while the Functions host could tune it.)
`Enabled` (tail only — "stop producing"; the review endpoints stay live) · `MaxCandidatesPerDocument` 1000 ·
`JudgeBatchSize` 100 · `JudgeReasoningEffort` Medium · `JudgeMaxAttempts` 2 · `OfferingJudgePromptTemplate` ·
`NeedsReviewConfidenceThreshold` 0.7 · `ExtractorBatchSize` 50 (first attempt; a truncated batch splits) ·
`MaxAllowedPrice` 5000000 (per-currency REVIEW threshold for THIS path — marks a price worth a look, never deletes it, never in a prompt) · `TimeoutSeconds` 2400 (the job's own clock; 2026-09-25, below the 45-min host timeout) ·
`Concurrency` 4 · `MaxAttempts` 4 · `RetryBackoffSeconds` 180 · `QueuedStaleAfterMinutes` 240 · `ImageMatchVerifyReasoningEffort` Medium ·
`PriceFieldLabels` (money words only — see the price-mark rules) · `HeaderFooterSampleChars` 3000 ·
`AnchorNameTokenOverlap` 0.6 · `MaxDraftsPerDocument` 1000 · `MaxPendingDraftsPerBusiness` 2000 · `DraftTtlDays` 30 ·
`DraftsPageSize` 25 · `ApproveBatchSize` 25 · `MaxImageFetchesPerDocument` 50 ·
`NotificationEnabled` true. Image fetch = `RemoteImageIngestionService` PublicHost policy (https/443 only, no userinfo,
DNS-name host, `RemoteImageIngestion:BlockedHosts`, public-IP check AND re-check in the connect callback, redirects
refused, streamed size cap, MIME allow-list, signature check, **`Image.IdentifyAsync` against
`RemoteImageIngestion:MaxDecodedPixels` (40 MP) BEFORE decoding, one frame, re-encode**). The Functions host carries the
`StorageConfiguration:ServiceImages` constraints the tail uses for the image-extension rule (added 2026-08-21 — the class
defaults would have allowed video extensions and 100 MB).

### The UI (partner WEB `KnowledgeServiceDraftsSection.jsx` + `KnowledgeDraftEditModal.jsx` + `knowledgeDraftMeta.js`;
partner MOBILE `KnowledgeServiceDraftsSection.tsx` + `KnowledgeDraftEditSheet.tsx` + `knowledgeDraftMeta.ts` — ported
1:1 with identical jest suites; see the partner-app and provider-mobile skills)
Rendering rules live in `knowledgeDraftMeta` (chips / actions / approve-intercept / analytics line) — change them in BOTH
files and both tests. Approve on an amber card opens **ONLY the field in question** ("Before we add “{name}” · Written as
“…” — is this an hourly price or a fixed one?" · note "Everything else is already filled in…" · "Save and approve");
the name-clash card carries "Approve it as a change to your existing “X”, or dismiss it."; the approve-all confirm names
the live settings ("…using the settings above (At my location · Hamilton, ON)"); mobile carries its own mockup wording
for the confirm body and the progress line ("…keep the app open."). 128 web keys (`knowledge.drafts.*`) ×5 + 139
mobile leaves (`KNOWLEDGE.DRAFTS_*`, i18next `_one/_other` plurals) ×5 + 22 backend keys ×5. Real-time:
`KnowledgeServiceDraftsReady` (in `SignalRSettings:EnabledNotificationTypes`, routing/echo/preference catalogues,
`Notification_KnowledgeServiceDraftsReady_*` ×5) bumps the queue on both apps.

### Tests (all taken red→green or sabotage-verified; never `--no-build` for proof — it reported false green AGAIN this session)
- Functions unit (`Clinqet.Communications.UnitTests/Knowledge/*`): detector shapes, judge contract, builder
  ids/rank/anchor/price-cell/dedupe, tail never-fails-the-doc (81). Functions integration
  (`KnowledgeServiceDraftAnalyticsJobIntegrationTests`, real emulator + Azurite, 12 since 2026-08-29): first run from the
  artefact, superseded ticket, idempotent re-run, tombstones, cascade, registry image copy, disabled, terminal judge
  failure, transient retry, no-artefact re-derive from the source blob, category-only updates, labelled inventory row.
- API unit: controller permission rows by reflection + every status mapping (sabotage: flipping one row fails exactly
  that test), approval-service branches incl. the audit fixes, string-shape SQL pins for every queue query (130+).
  API integration (real pipeline on the emulator): approve like Profile Setup + twice-is-once + image copy/derivative,
  409 clash, approve-update price-only/target-gone, approve-as-change, batch/all + remaining, dismiss, 412 edit,
  dispatcher/catalog_manager permission rows, cross-tenant 404, rerun; queue order/walk/filters/totals/select/ttl/CAS/
  partition isolation (23).
- Harness `C:\Nik\knowledge-table-hunt` (NOT a git repo): `--precision` (labelled set, LIVE judge + extractor; gate
  ≥0.95 — measured 1.000 on 2026-08-22: flyer 35/35, hamilton 50/50 with the ceiling fix, toromont 0 false drafts;
  `--only <name>` runs one labelled document), `--invisibility` (the POC battery), `--analytics [biz]`, `--blobs`,
  `--indexpolicy`, `--region in|ca`, `--di <file> [--drafts]`, group D D01–D13 shapes.

### ‼️ THE PRICE-MARK RULES (`KnowledgePriceMarks`, owner-approved 2026-08-22) — how a number becomes a price
Until 2026-08-22 a number was a price only when the SAME token carried a currency symbol or the Indian `/-`. The owner
approved closing the explicit gaps — and nothing else: **a bare number that nothing marks stays "not a price"** (the
footer-only flyer "Haircut 30 · prices in CAD" is out by decision; guessing there mints junk drafts). The rules are
deterministic, script-neutral, closed lists only — never industry vocabulary:
- **R1 symbol beside the number**: `$ 30`, `₹ 800`, `1,50 €`, `26 699 $` (fr-CA grouping rejoined ONLY in the
  symbol-after shape; `$ 50 100 150` and `Rs 500 700` are lists), `CA$ 45` / `US$45` (region prefix dropped).
- **R2 supported currency CODES and aliases**: UPPER-CASE ISO codes from `KnowledgePriceMarks.SymbolsByCode` (THE
  platform list — add a currency there and it is detected everywhere; `cad 45` in prose never marks) glued or beside
  the number (`CAD 45`, `45 CAD`, `USD45`, `INR 800`, `800 INR`) + the closed alias list (`Rs`, `Rs.`, `Rupee(s)`,
  `INR.`, `रु`, `रु.`, `रू`, `रुपये`, `રૂ`, `રૂ.`, `રૂપિયા`, `ரூ`, `dollar(s)`, `euro(s)` — **NOT `pound(s)`**, a weight on
  spec sheets). A year-shaped number beside a code is prose (`CAD 2019`, `CAD2019`).
- **R3 price-labelled fields** (`label: number`: JSON keys, DI key/value lines): the label's WORDS (split on
  non-letters, combining marks kept, camelCase split ⇒ `price_cad`, `listPrice`, `Price (CAD)`, `Price (Rs.)`) must hit
  `ServiceDrafts:PriceFieldLabels` — money words only (`price(s)`, `pricing`, `mrp/msrp/rrp`, `fee(s)`, `charge(s)`,
  `precio(s)`, `tarifa(s)`, `prix`, `tarif(s)`, `कीमत`, `मूल्य`, `शुल्क`, `भाव`, `ભાવ`, `કિંમત`, `ફી`); ‼️ deliberately
  NOT `rate/amount/cost` (measurement/quantity labels on spec sheets — `Flow rate: 30` must never mint a price).
  Currency = the label's code/alias word, else the business currency, else `¤` (never a mismatch). On a LINE only the
  price word and the value are consumed — `Haircut price: 30` keeps `Haircut` as the name.
- **R4 price-labelled columns**: a cell of ≤3 tokens with exactly one number under a price-labelled column
  (`Price`, `Price (CAD)`, `MRP`, `Fee`): `30`, `30-45`, `from 30`; its own symbol/code wins when present. An UNDECLARED
  table gets a header only by evidence — row 1 has no digit, holds a price label, ≥2 rows below are numeric in that
  column — a priced data row can never satisfy it (the chunker's no-guess rule is kept); a header word inherited into a
  blank cell is never a name.
- Ranges: `$50 - 70`, `$50 to 70`, `₹500 – 700` share the mark; native-script digits (`₹५००`) carry ASCII into the mark.
- Every mark is normalised to `{symbol}{number}` (one shape for the anchor, the currency chip and the row hash);
  `SourceLine` stays verbatim for "written as". Glued tokens (`$30`, `₹800`, `800/-`) hash exactly as before, so
  existing drafts are not re-identified; `CA$45` (now `$45`) and a mark repeated in two cells (now deduped) do change —
  pre-prod, accepted.
- **Purity** (`ScanResult.IsPureValue`): a cell that is NOTHING BUT its marks (`30`, `$ 30`, `30.00 CAD`, `Rs 800`) is a
  `PriceSourceCell` — out of the description and of what the extractor reads; a cell with a qualifier (`from 30`,
  `$30 per hour`, `$30 incl. tax`) and a cell where a code adds nothing (`$500.00 CAD` — the deposit) stay description,
  exactly as before.
- **Labelled price ⇒ certain shape**: when the document labelled the number (R3/R4 ⇒ `LabelledPriceTokens`) and the
  extractor returned that number, the judge's "ambiguous price shape" flag is cleared (an `Unclear` verdict still stays
  amber) — otherwise every dealer record (price + labelled deposit) would be "please check" and excluded from approve-all.
- **Adaptive extractor batching**: a batch whose output the model TRUNCATED (`Error_ProviderSetupExtractionTruncated`)
  is split in two and retried down to one line (then terminal) — found live on the 685-record Toromont feed, where a
  batch of 100 long records always overflowed; `ExtractorBatchSize` default 100 → 50 (the first attempt, not a ceiling).
- **The job's own clock**: `ServiceDrafts:TimeoutSeconds` (2400 since 2026-09-25, bounded 1..3600) linked only to HOST
  shutdown; the analytics is its OWN Service Bus ticket (dedicated section below), never inside the ingest invocation
  (the ingest's own deadline is `IngestTimeoutSeconds`, 1800 today). The 300 s tail clock is what failed Toromont at 300.1 s.
- Extractor lines for table rows are `name | marks | cells` with every cell (and the name) bounded to 200 chars — a
  dealer record's inspection report is context, never a 2000-char line; plain lines go verbatim.
- ‼️ **The price ceiling is NEVER written into a prompt** (owner ruling L-9, 2026-09-12; corrected here 2026-09-25,
  P4-I-03): `DocumentIntelligenceService.ApplyPromptTokens` substitutes `{categoryList}` only, and
  `ExtractionPricePromptConventionTests` fails if either prompt copy (class default, API appsettings) names `{maxAllowedPrice}`. Told a number, the
  model nulled every amount above it — in one currency's units, against every currency alike (found live 2026-08-22:
  20 of 54 Hamilton machines and 338 of 685 Toromont records lost their price). The caller's number is now a
  per-currency REVIEW threshold applied in C# AFTER extraction (`PriceReviewCeiling.For`, `clinqetshared\Models\`): the
  chat setup passes `ProviderAttachmentProcessing.MaxAllowedPrice` (99,999.99), the draft tail
  `ServiceDrafts:MaxAllowedPrice` (5,000,000). A price above it is KEPT and marked worth a look — never nulled. Do not
  reintroduce a `{maxAllowedPrice}` token.
- **A claimed global category pair the CACHED list lacks is confirmed by two point reads** before the name fallback
  (`ProviderSetupTaxonomyResolver.ResolveClaimedGlobalPairByPointReadAsync`, parent first, only on a miss, never an
  eviction of the shared cache): the cache is fetch-then-Set, so a parallel warm that started before a write lands a
  stale list AFTER any invalidate — approve of a draft bound to a category approved moments ago must not 400 for the
  cache window. This also made `KnowledgeServiceDraftsIntegrationTests` deterministic under class-parallel CI.
- **What still stays unmarked, by design**: a bare number with no symbol/code/label/column; a currency the platform
  does not support (`AED 50` until AED is added to `SymbolsByCode`); `rate/amount/cost` labels; `pound(s)`; the fr-CA
  "Dinner for 2 150 $" (ambiguous by nature — reads 2150).
- Tests: `KnowledgePriceMarksTests` (every variation above, positive and negative), detector/builder/tail additions,
  a Functions integration case (labelled inventory row → draft at its labelled price on the real emulator), the
  host-token function test; the live gate re-run on the labelled set — see the 2026-08-22 line in the traps below.

### Traps this build paid for (add to the permanent list)
- ‼️ The vnext emulator does not honour `MaxItemCount` like prod — assert the continuation WALK (every row once, in
  order), never the page size. ‼️ The setup resolver's cached global list is fetch-then-Set — a parallel class can land a
  STALE list after your invalidate (the WithImage approve flaked 1-in-3 full runs); since 2026-08-22 a claimed pair is
  confirmed by point read, and a seed still uses UNIQUE names or approve name-matches a pair another class seeded. ‼️ `Moq` cannot proxy `FeedIterator<T>` over a
  repository-private row type — capture the query and throw. ‼️ The real host returns LOCALIZED messages, not keys —
  assert the English value. ‼️ A "re-run" design detail the code owns: equal-confidence drafts are OLDEST first.
  ‼️ A patch script that returns its parameter discards the closure's edits (one lost definition, one false-green run).
- ‼️ 2026-08-22: `String.replace(a, b)` with a ``-containing replacement corrupts the file (`$\`` = "text before the
  match") — always pass a function replacer. ‼️ A FAILED build + `--no-build` reports on STALE binaries (63 "passed"
  with two compile errors) — read the build's error count first. ‼️ A LIVE symptom with zero code-visible cause (half a
  feed never anchors) can be the PROMPT: grep the templates for literals before touching the pipeline. ‼️ An extractor
  batch of long records TRUNCATES (`Error_ProviderSetupExtractionTruncated`) — the tail now splits and retries down to
  one line; a flyer never showed it. ‼️ The ingest's shared 480 s deadline cancelled the tail mid-AI on a 54-record file
  and stamped Failed — the tail now has its own clock (`TimeoutSeconds`), linked only to host shutdown.

## ‼️ CLINKET AI DATA ANALYTICS IS ITS OWN QUEUE JOB (2026-08-29) — the Toromont root cause and the cut-off class

> Record: `C:\Nik\knowledge-analytics-job\PLAN.md` (design authority, D1–D10) + `SESSION-2026-08-29-CHANGES.md`; mockup
> `C:\Nik\Data\mockups\knowledge-analytics-status\index.html` (web + mobile, every state). Owner approved D1–D8 in-session.

**Why.** The 685-record Toromont feed ALWAYS showed "AI Data Analytics failed": the analytics ran INSIDE the ingest
invocation as a tail and its own clock (`ServiceDrafts:TimeoutSeconds` = 300) expired at **300.1 s** — the admin alert's
timestamps prove it (Queued 14:11:46.4 → Failed 14:16:46.5). The same session proved the second defect class on the dev
deployment: the picture caption and the pixel verify ran at **200 completion tokens on a reasoning deployment**, and
reasoning tokens share `max_completion_tokens`, so the model returned `finish_reason: "length"` with EMPTY content —
read as "no description" ("1 picture · 0 can be sent") and as a silent "no" on every verify. Neither was a model
opinion; both were budgets.

**What it is now.**
- **Its own ticket.** The ingest's Ready commit stamps `ServiceDraftAnalytics = Queued` (`RunAt` = the ticket's
  GENERATION) and drops `KnowledgeIngestQueueMessage { Mode = Analytics, Attempt }` on the SAME `knowledge-ingest` queue in
  its own session `{businessId}:analytics` (`KnowledgeAnalyticsQueue`; message id `{biz}:{doc}:Analytics:{generationTicks}:{attempt}`,
  so a redelivery dedupes and a re-run never collides). The ingest returns at once; the receptionist answers from the
  document the whole time. A Ready row re-read by the ingest with a Queued stamp re-posts its ticket (self-heal).
- **The job** (`KnowledgeServiceDraftAnalyticsJob`, Functions host, replaces `KnowledgeServiceDraftIngestTail`): gates
  (row gone/Deleting ⇒ cascade delete; not File / not Ready / stamp not Queued ⇒ return; feature off ⇒ Disabled), its OWN
  budget (`TimeoutSeconds` 2400 since 2026-09-25, clamped 1..3600, linked to host shutdown), inputs from the content ARTEFACT by content
  hash (`TryReadForAnalyticsAsync` — fingerprint-agnostic) or, with no artefact, a text-only re-derive of the source
  (`RederiveBlocksAsync`: DI read for PDFs/photos, parsers for born-digital, never banks an artefact), then the unchanged
  detector → judge → extractor → anchor → reconcile → image match → stamp → notification core, with
  `EnsureNotWithdrawnAsync` checkpoints. Extractor batches run `Concurrency` (4) wide with FAIL-FAST (the first failure
  cancels its siblings — `Task.WhenAll` alone kept spending); the judge batches run the same width and a cut-off judge
  batch retries with a DOUBLED budget. Results are assembled in document order whatever order they finish.
- **Failures.** `KnowledgeAnalyticsFailureClassifier.IsTransient` (throttle/timeout/socket/IO/Service Bus transient/
  Cosmos+Azure 408/429/449/5xx/"AI service error"/extraction-failed) ⇒ a SCHEDULED retry on the same lane at
  `RetryBackoffSeconds` × 2^(attempt−1) (180/360/720 s) up to `MaxAttempts` (4), row stays Queued; anything else, the
  budget expiring, or the last attempt ⇒ `Failed` + `Error_KnowledgeDraftAnalyticsFailed` + ONE
  `KnowledgeServiceDraftAnalytics` system-failure alert (`forceAdminAlert`, dedupe key per generation+attempt). Host
  shutdown rethrows (the lock lapses, the ticket redelivers). The commit is CAS-guarded to the ticket's generation — a
  superseded ticket (re-run, replace, delete) lands nothing.
- **The stale rule.** A Queued stamp older than `QueuedStaleAfterMinutes` (240) has no run behind it (dead-lettered,
  lost lock chain): the API's list DTO serves it as `Failed` + `Error_KnowledgeDraftAnalyticsStalled` (Try again), and
  the same rule (`KnowledgeDraftAnalyticsRules`) lets Re-run accept it. Never "Analysing" forever.
- **Re-run** (`KnowledgeDraftApprovalService.RerunDocumentAsync`): Ready only; `AnalyticsRunning` (400
  `Error_KnowledgeAnalyticsRunning`) while a fresh ticket is live (D7); otherwise delete every draft (tombstones too) →
  stamp Queued → enqueue. **Never a reprocess** — no re-read, no re-embed. A send failure stamps Failed and rethrows.
- ‼️ **The daily refresh allowance** (owner, 2026-10-04 — every refresh pays judge + extractor + image match again; nothing is
  banked). `IKnowledgeRefreshLimiter` (`KnowledgeRefreshLimiter`, Scoped) is asked AFTER the state checks and BEFORE anything is
  deleted: a pre-read refuses without writing (document first, then business), then `IKnowledgeRefreshCounter.ReserveAsync` (one
  atomic PATCH raising `/count` and `/docs/{docId}` together; create on 404, re-patch on 409) is what holds under a race — an
  overdraw gives itself back and refuses. The run's own failure (stamp Gone, enqueue throws) releases the reservation in a
  `finally`; a started run keeps it. Release is floored by a point read + the read's ETag with a bounded retry — ‼️ NOT a patch
  predicate: the vnext emulator 500s on a predicate over a nested path (`c.docs["x"]`).
  - Counter: SystemData, pk = businessId, id `knowledgerefresh_{businessId}_{yyyyMMdd}` (UTC, InvariantCulture, TimeProvider),
    per-item `ttl` = `RefreshCounterTtlSeconds` (172800). Settings `Voice:Knowledge:ServiceDrafts`:
    `RefreshDailyLimitPerBusiness` 5, `RefreshDailyWarningPerBusiness` 3, `RefreshDailyLimitPerDocument` 1.
  - Override: `BusinessProfile.KnowledgeRefreshDailyLimit` (int?, absent = default, 0 = off), Newtonsoft-only (STJ-ignored, so no
    partner response carries it), written ONLY by `TrySetKnowledgeRefreshDailyLimitAsync` (field-scoped ETag patch; null removes).
  - Admin: `GET/PUT admin/voice-assistant/{businessId}/knowledge-refresh-limit` (`{ dailyLimit }`, negative ⇒ 400
    `Error_KnowledgeRefreshLimitInvalid`, unchanged ⇒ no write, bounded 412 retry) → `AdminKnowledgeRefreshLimitDto`.
  - Alerts via `IPlatformLimitAlerts.ReportFileLimitAsync`: `KnowledgeRefreshWarning` (Low) when today's count reaches the
    warning AND the limit is above it; `KnowledgeRefreshLimit` (Medium) when it reaches the limit. Both name the business, the
    document title + id, the count and the limit.
  - The list response carries `suggestionRefresh` (`KnowledgeSuggestionRefreshDto`) so both apps grey the action out first.
  - ‼️ **The provider's Read again spends from the SAME day** (`IKnowledgeManagementService.ReadAgainAsync`, called by
    `POST knowledge/documents/{docId}/reprocess`): reserve → `ReprocessCoreAsync` → release in a `finally` unless it returned Ok →
    `ReportStartedAsync(..., KnowledgeRefreshAction.ReadAgain)` (the alert reads "Last action: Read again"). Refusals map through
    `KnowledgeRefreshReservation.ToRefusal()` to the same 400/429s. `ReprocessAsync` itself is NOT limited — the admin
    `reindex-knowledge` repair rides it and must never spend the provider's day.
  - Proof: `KnowledgeRefreshLimiterTests`, `KnowledgeDraftApprovalServiceTests` (refusals touch nothing; release on failure),
    `KnowledgeRefreshCounterCosmosIntegrationTests` + `KnowledgeRefreshLimitIntegrationTests` (real emulator, frozen limiter clock).
- **The cut-off class** (`AiCompletionBudgetGuard.RunWithCutoffRetryAsync`): a structured answer with
  `finish_reason == "length"` is retried ONCE at 3× the budget; a second cut-off degrades the ITEM (caption null / verify
  "no" / summary = filename / proposer skipped) and raises ONE `AdminAlertType.AiCompletionBudgetExhausted` (High,
  15-min cooldown per call kind + business + context, metadata names the setting to raise) via `IAiBudgetCutoffAlerts`.
  `AICompletionService` logs a central Warning on every truncated answer. Budgets raised on evidence: caption
  `ImageCaptionMaxTokens` 200→1500 (+`ImageCaptionReasoningEffort` Medium), `ImageMatchVerifyMaxCompletionTokens`
  200→600 (+`ImageMatchVerifyReasoningEffort` Medium), `ImageMatchMaxCompletionTokens` 2000→4000,
  `DocSummaryMaxCompletionTokens` 1200 (new), setup images `CaptionMaxTokens` 200→1500 + `VerifyMaxCompletionTokens` 600 +
  `ImageReasoningEffort` Medium. Owner: accuracy first, cost second — Medium stays.
- **Clocks.** Ingest `IngestTimeoutSeconds` 480→900 (1800 today); analytics 1500 (2400 since 2026-09-25); Functions `host.json` `functionTimeout` 00:45:00
  (Flex Consumption; `maxAutoLockRenewalDuration` 1 h already covered the lock).
- **The artefact is unconditional.** `ContentArtifactEnabled` is GONE — the artefact is written for EVERY document
  (born-digital included) because the job reads its inputs from it.
- **UI, web + mobile (identical rules).** A Ready row with a Queued stamp wears an **Analysing** chip beside Ready (spinner
  only while the page still checks; hover, or a TAP on a phone / tap-only device, opens the explanation naming what it
  does and `analyticsMaxMinutes` from the list response = ⌈TimeoutSeconds/60⌉); the row's line reads
  "Checking for services and pictures to suggest…"; Re-run / Run again / Try again are ABSENT while pending (D7); the
  page watches on its own ladder `ANALYTICS_POLL_SCHEDULE_MS = [30s,60s,120s,180s,300s×5]` (9 checks, ~31.5 min) then
  STOPS with its own stalled notice + Refresh; ONE visibility/AppState listener serves both ladders. The picture tick
  that cannot send is no longer a dead disabled control: dashed, a hover hint ("Cannot be sent yet — no description"), a
  press/tap opens a dismissable notice with the reason and BOTH remedies (reprocess the file / add it as a photo on the
  matching service in Manage Services & Price); the viewer shows the same copy. Web tooltips share ONE themed
  `AppTooltip` (the `TruncatedText` look; `openOnClick` on `(hover: none)` devices). Keys ×5 both apps:
  `knowledge.status.analysing`, `knowledge.analysing.explain` (ICU plural on `minutes`; mobile `ANALYSING_EXPLAIN_one/_other`
  + `_NO_MAX`), `knowledge.drafts.row.pending`, `knowledge.poll.analysingStalled`, `knowledge.images.tick.noDescriptionHint`,
  `knowledge.images.noDescriptionFeedback` (replaces `noDescription`), `knowledge.images.dismissNotice`; API
  `Error_KnowledgeAnalyticsRunning`, `Error_KnowledgeDraftAnalyticsStalled`.
- **Ask 1 answer (flyer → nothing in Portfolio/Profile).** The flyer is a `text_snapshot` (a picture OF text), which AI
  Setup correctly places nowhere (only Product/Photo/Logo route); the "1 picture · 0 can be sent" in Knowledge was the
  cut-off class above, not a routing rule. After deploy, documents whose pictures say "Cannot be sent" must be
  reprocessed once (the deploy changes the artefact fingerprint, so captions are re-attempted).

**Tests.** Functions unit: `KnowledgeServiceDraftAnalyticsJobTests` (gates, artefact/re-derive incl. the REAL parser on
a plain .txt, terminal/transient/backoff/last-attempt/budget-expiry/host-shutdown/superseded/withdrawn, parallel
extractor order + cap + fail-fast + truncation split), `KnowledgeAnalyticsFailureClassifierTests`,
`KnowledgeAnalyticsQueueTests`, `AiBudgetCutoffAlertsTests`, `KnowledgeDocumentDescriberTests`, classifier/matcher/judge
cut-off tests, ingest-function ticket tests. Functions integration `KnowledgeServiceDraftAnalyticsJobIntegrationTests`
(12, real emulator + Azurite). API unit: approval-service re-run branches, controller stale/budget mapping, setup-image
cut-off tests, settings convention. Web: `knowledgeDraftMeta/knowledgeGuards/knowledgeImages` suites; mobile:
`knowledgeDraftMeta/knowledgeImagesParity` + locale parity/integrity.

**Traps.** ‼️ Plain candidate lines reach the extractor VERBATIM ("Haircut $20"); only table rows are "name | marks" — a
mock that parses only the pipe shape reports ZERO drafts for a .txt and looks like a pipeline bug. ‼️ `Task.WhenAll`
never fails fast. ‼️ A `describe.skip`/`Mock` fixture that hands the job the SAME row instance makes a generation check
see its own write — snapshot on every read. ‼️ The Functions test factory registers storage + repositories only — build
knowledge services the way Program.cs does. ‼️ `node -e` with a JS template turns `\n` into a real newline inside C#.

## ‼️ PER-ITEM RECEPTIONIST ACCESS — what the receptionist may do with EACH file and typed FAQ (BUILT + AUDITED 2026-09-07; replaces the "Send relevant details to callers" switch)

> Authority: `C:\Nik\Data\knowledge-receptionist-access\` (`ANALYSIS.md` design + rules, `PLAN.md` build order/words/tests/audit, `findings\MEASUREMENTS.md` RU numbers); sheet K1 approved by waiver. Owner rulings: **zero degradation of any receptionist or Ask Clinket result**; "if not used by the AI assistant it can never read the document; answers-only can answer but never send"; web + phone in one session; ONE rule for every gate; cost and performance first-class.

- **Three answers per item, files AND typed FAQs** — `KnowledgeReceptionistAccess { NotUsed, AnswersOnly, AnswersAndSends }` (clinqetshared, string-serialised). ‼️ **ONE field on `KnowledgeDocument`: `receptionistAccess`** — the row's own WORD (`string?`, §0.7 approved 2026-09-07), exactly like `searchAudience` beside it and for the same reason: a build that resolved a word it did not know would write the resolved value back and destroy the provider's choice. **The two-bit shape this feature was first built with (`usedByReceptionist` + `shareWithCallers`) is GONE from the entity, the DTOs, the queries and both sandboxes** — one field, one meaning, no combination rule, no absent-field ambiguity (the owner rejected the additive shape on sight: "one field in cosmos handle all three choice is best solution"). **`KnowledgeReceptionistRule`** (`clinqetcore/Interfaces/Knowledge/KnowledgeReceptionistRule.cs`) is the ONLY thing that reads it: `Access(word)` matches by NAME, ordinally — absent, blank, differently-cased, numeric or unknown all read **NotUsed** (fail-closed); `Format(access)` is the one spelling that reaches Cosmos; `Decide(status, word) ⇒ (Answerable = Ready ∧ word ≠ NotUsed, Sendable = Answerable ∧ word = AnswersAndSends)`; `Tighter(a, b)` is the merge's narrower-wins; `CosmosSendableFilter`/`Parameter`/`Value` is the one SQL-side use (the picture allow-list) — an ALLOW-list `c.receptionistAccess = @sendableAccess`, never a NOT over a field that may be absent, so SQL and C# agree on an absent row by construction. Three convention guards — `KnowledgeReceptionistGateConventionTests` in the API, MCP and Functions unit suites, each scanning ITS OWN host (the API one also the three libraries, like `MemoryCacheSizeConventionTests`) — fail on any COMPARISON, negation, `??` default, `switch`/`is`, `string.Equals` or SQL naming of the word outside the rule, and each asserts a NON-EMPTY scan so a rename can never quietly empty it. Registered exemptions: API only — the CAS unchanged-value compare, and the sweep's projection of `c.receptionistAccess`; MCP and Functions have NONE.
- **ONE sweep per voice search** — `IKnowledgeDocumentRepository.ListReceptionistGatesAsync(businessId)` → `KnowledgeReceptionistGates { AnswerableDocIds, SendableDocIds, IsAnswerable(), IsSendable(), None }` (one partition query, 3 projected fields — docId, status, the word — ≤220 rows; REPLACES `ListRetrievableDocIdsAsync` + `ListRefSuppressedDocIdsAsync`, which are gone). `ProviderKnowledgeSearchService.SearchAsync`: fail-CLOSED (a failed sweep fails the retrieval, exactly as the retrievable read did), `ApplyReceptionistGates` drops passages of non-answerable documents from the main AND companion lists and strips `Ref`/`ImageRef` from answerable-but-not-sendable ones — with every document answerable and sendable the output is **byte-identical** to before (pinned in `ProviderKnowledgeSearchServiceTests`). `GetByRefsAsync` (send + neighbours) resolves refs against SENDABLE docs only. `ListSendableImageRefsAsync` adds the SQL filter. `FullProviderContextService.HasKnowledge` = answerable count > 0 (fail-soft `KnowledgeReceptionistGates.None`) — a business that keeps every document from the receptionist gets no `search_knowledge` tool and no §7.10 prompt block. MCP `KnowledgeTools.IsSendable(row)` = the rule on the live row, files and FAQs alike.
- **Delivery re-check (closes the last window)** — `VoiceMaterialItem.DocId` (required; stamped by `MaterialExcerptBuilder`); `VoicePostCallProcessorFunction.DropWithdrawnMaterialAsync` point-reads each distinct document under the call's business and applies the rule BEFORE rendering: a piece whose document was withdrawn since the call (answers only · not used · deleted) is dropped (`Truncated = true` ⇒ the existing "continues" line, NO admin alert — the owner's own change is not a failure); every piece withdrawn ⇒ the existing delivery-failed notice + alert reason `material_withdrawn_by_owner`; a transient read failure rethrows (nothing sent yet, the redelivery retries). Ingest duplicate-merge TIGHTENS `usedByReceptionist` exactly like `shareWithCallers` (Ruling 3, never widens); both `MarkDeleting` paths clear both bits.
- **Availability = the AI Assistant page's own switch (owner Q2, 2026-09-07)** — `IReceptionistAvailability.IsAvailableAsync` (`ReceptionistAvailability`: `PaymentSettings.Enabled && AiAssistantEnabled` first — no read when off — then the profile POINT READ `VoiceAssistant.Status is not NotInvited`; null block/profile ⇒ false). Paid, trial, paused, cancelled, lapsed all still show and keep their saved choices; only a business that never set the receptionist up sees no choice. Registered in the API host only (`Program.cs`, beside the management service). `KnowledgeManagementService`: no receptionist ⇒ EVERY write stores NotUsed whatever the client sent (upload, replace, FAQ create AND edit) and a direct choice is refused (`KnowledgeMutationOutcome.ReceptionistUnavailable` → 400 `Error_KnowledgeReceptionistUnavailable`, ×5 languages); with it ⇒ the client's choice or `AnswersAndSends`; a replace/edit without a value leaves the choice alone. `SetReceptionistAccessAsync` = row-only CAS write of both bits, **ACCEPTED while Processing** (the ingest commit re-reads under CAS, so neither write is lost), InvalidState only for Deleting, no write when unchanged (the one registered conditional read).
- **Wire** — `PATCH /api/v1.0/knowledge/documents/{docId}/receptionist` body `{ access }` (`KnowledgeReceptionistAccessDto`: nullable + `[Required]` → `Error_KnowledgeReceptionistAccessRequired`, so an omitted body is never NotUsed by accident; `voice.settings.manage`); `KnowledgeDocumentDto.ReceptionistAccess` (the INTERPRETED value via `ToAccess`, never the bits); `KnowledgeListResponseDto.ReceptionistAvailable` (last positional, default false); `KnowledgeConfirmFileDto.ReceptionistAccess?`; `KnowledgeFaqRequestDto.ReceptionistAccess?` (rides the FAQ's own Save). GONE: the `/sharing` route, `KnowledgeSharingDto`, `SetShareWithCallersAsync`, `ShareWithCallers` on every DTO, `knowledge.sharing.*` / `KNOWLEDGE.SHARING_*` / `knowledge.images.notShared` / the `bulletReceptionist*` keys, the `sharing_toggle` event, web `knowledgeSharing.test.jsx` (→ `knowledgeReceptionistAccess.test.jsx`), API `KnowledgeSharingIntegrationTests` (→ `KnowledgeReceptionistAccessIntegrationTests`).
- **Ask Clinket is untouched** — its retrieval never read these bits (diff of its files is empty except the profile tool). Its one knowledge fact, `get_business_profile.hasKnowledgeDocuments`, is the PROVIDER's fact ("any Ready document, whoever may use it") from **`IKnowledgeDocumentRepository.AnyReadyAsync`** — index-only `SELECT TOP 1 VALUE c.docId … status = Ready`, ~3 RU flat where the retired `CountReadyAsync` cost 8.59 RU at the caps — fail-soft false; NEVER the voice `HasKnowledge`, which would read an all-internal library as "no documents".
- **UI (web + phone, same session; parity = rendering rules)** — twin rule files `src/lib/knowledge/receptionistAccess.{js,ts}` (import-free; `knowledgeReceptionistAccessParity.test.ts` diffs them and SKIPS loudly when the web tree is absent, reads inside `it()`). Web `ReceptionistAccessBox` (details editor: saves on tap like Team search, reverts + `knowledge.audience.saveFailed` on failure, ONE `role="status"` live region, four control states from `receptionistControlState` — loading/locked/readonly/editable — editable while Processing with `knowledge.receptionist.processing`) + `ReceptionistAccessPicker` (`role="radiogroup"`/`radio` + `aria-checked`; upload rows compact, FAQ editor — those save with their own button). Phone: `Knowledge/index.tsx` `renderReceptionistBox` / `renderReceptionistChoices` / `commitReceptionist` (busy REF against double taps, `reconcileDetails` re-reads the list on success AND failure, `Toast` on failure), the same `accessibilityRole="radiogroup"`/`radio` + `accessibilityState.selected`, `accessibilityLiveRegion="polite"`, 44 px hit slop on both row marks. Marks on every file AND FAQ row: `Details can be sent` (indigo/`info`) · `Answers only` (navy) · `Not for callers` (dashed grey/`neutral`) — read-only, open the editor, absent when the business has no receptionist or the row is Deleting, drawn on Processing too (the SETTING is true whatever the status). Pictures: `canSendPictures = receptionistSends(doc, materialSharingEnabled)` — a tick means something only under "answers and sends" (`knowledge.images.notSendable`). With `materialSharingEnabled` OFF the choice folds to TWO ("Answers callers" / "Not used"); a stored AnswersAndSends sits on "Answers callers" and re-tapping it writes nothing. No receptionist ⇒ no box, no picker, no marks, the `*NoReceptionist` copy variants (page subtitle, FAQ subtitle, empty title + BOTH empty bodies, audience helper) and "Clinket" as the actor in the shared sentences (delete confirms, processing hint, analysing lines, re-run bullets `bulletAnswering*`). AI Assistant page: `countUsedByReceptionist` feeds the "already knows" summary; Ready material none of which the receptionist may use shows the `choose` nudge (`knowledge.nudge.choose*`) in the invite's slot. Analytics `receptionist_access_change { access }`.
- **Cost (Canada, `findings\MEASUREMENTS.md`)** — per voice search 6.12 → 2.92 RU (3 rows) and 13.21 → 9.67 RU (220 rows, and the sweep now covers the 200 FAQs the old suppression read never saw); images 5.24 → 5.13; Ask Clinket's "has documents" line 8.59 → 3.14 (a COUNT became an index-only TOP 1, flat at any library size). **Experiment E — one IncludedPath `/receptionistAccess/?` — measured 5.13 → 4.67 RU on the images query ONLY (0.46 RU, ~9%, on a query that runs when a caller asks for pictures), with the sweep, the ready check and both write shapes IDENTICAL ⇒ NOT shipped** (a §0.7 index change for 0.46 RU on an infrequent read; the numbers are in MEASUREMENTS so the owner can say otherwise). `CosmosContainerPolicies.KnowledgeBase` keeps its 11 paths. The synthetic partition K1PROBE0000 was purged after each measurement.
- **Tests (all green 2026-09-08 after the single-field rewrite)** — API unit 1,568 in the knowledge/business-search/convention set (`KnowledgeManagementServiceTests`, `KnowledgeControllerTests`, `ReceptionistAvailabilityTests` — every status × the platform flag, guard), API integration `KnowledgeReceptionistAccessIntegrationTests` (real Cosmos PATCH/confirm/list/refusal/isolation; the FAQ write is unit-only because the fixture keeps the knowledge index unreachable) + `KnowledgeDocumentCasIntegrationTests` + the BusinessSearch suites; MCP unit 918 (`KnowledgeReceptionistRuleTests` — the truth table, the fail-closed word table incl. a numeric and a mis-cased word, `Tighter` symmetry and a never-widens sweep over every pair, the SQL allow-list drift guard; `ProviderKnowledgeSearchServiceTests` byte-identity + one-sweep-per-search, `KnowledgeToolsTests`, `FullProviderContextServiceTests`, guard) + `KnowledgeReceptionistGatesCosmosIntegrationTests` (real emulator: every status × five stored words including an unknown and a mis-cased one, and a row with the property genuinely REMOVED, which must read NotUsed on every gate); Functions unit 2,421 (`VoicePostCallProcessorFunctionTests` re-check theory, `KnowledgeIngestProcessorFunctionTests` merge, guard) + integration (material tests seed a real knowledge row). Web 26 suites / 468; phone `knowledgeReceptionistAccess`, `…Parity`, `…Screen` (33) + locale integrity. Every scan guard proven red by sabotage from scratchpad snapshots (never git).
- **Known residuals (recorded, not hidden)** — the live retrieval battery could not run: the Canada knowledge index held 0 documents (pre-existing; the owner's resync repopulates it) — a post-deploy sanity check; the voice `HasKnowledge` refreshes with the context cache (`ProviderContextCacheMinutes`) while the sweep itself is live on every search (a cheaper TOP-1 "any answerable" read is expressible now that one word is stored, and was deliberately NOT added: the context is cached per business, so it would buy ~7 RU on a rare read at the price of a second SQL statement of the rule).

## ‼️ SEND DETAILS TO CALLERS — `send_material_info` (PART 2, BUILT 2026-08-21; kill switch ships ON - owner decision 2026-08-21)

> ‼️ **2026-09-07: the per-document "Send relevant details to callers" SWITCH described below is GONE** — replaced by the per-item receptionist choice in the section above. The MATERIAL-SEND mechanics (refs, tool, excerpt, PDF, processor) are unchanged; every mention of `ShareWithCallers`/`ListSharingOffIdsAsync`/`/sharing` below is history.

> Record: `C:\Nik\knowledge-delivery\PART-2.md` (+ `DESIGN.md`, mockup `C:\Nik\Data\mockups\knowledge-document-sharing\index.html`).
> The caller asks to be SENT what the receptionist found in the owner's material. The model passes only the `ref`s of the
> 1–4 `search_knowledge` results that answered; the platform fetches those exact cards, validates them under the bound
> business + the row state + the per-document switch, lays them out (NO AI text), and the Functions host renders a 1–3 page
> PDF and delivers it by WhatsApp (DOCUMENT template) or email (details in the body + PDF attached). **Never the whole file,
> never AI-written text, never SMS.** Everything is behind ONE kill switch — `Voice:Knowledge:MaterialSharingEnabled` —
> which ships **ON in all three hosts** (owner decision 2026-08-21; a stamp can switch it off); with it off every wire shape is byte-identical to the pre-feature build.

### The pieces (read these before touching anything)
- **Refs** — `clinqetcore/Models/Knowledge/KnowledgeMaterialRef.cs`: `"{first 12 hex of docId}:{chunkNo}"`; `TryParse`/`Format`/`ResolveDocId`
  (prefix resolves ONLY against the bound business's own rows). `KnowledgeSearchQuery.IncludeRefs` is set by the MCP tool
  from the kill switch; `ProviderKnowledgeSearchService.BuildRef` stamps `KnowledgePassage.Ref` only for Text/Table/FaqPair
  cards whose document is NOT switched off (`IKnowledgeDocumentRepository.ListSharingOffIdsAsync`, read in PARALLEL with the
  embedding, fail-soft ⇒ no refs); `PassagesSendable` swaps the result note. `GetByRefsAsync(businessId, refs)` reads the
  cards back by KEY under the full D22 isolation contract (scope clause first, `search.in(id, …)`, per-row check).
- **Per-item receptionist choice (2026-09-07, replaces the per-document switch)** — `ShareWithCallers` is GONE; the row
  stores ONE word, `receptionistAccess`, read ONLY through `KnowledgeReceptionistRule`; written by
  `KnowledgeManagementService.SetReceptionistAccessAsync` (row-only CAS, accepted while Processing) through
  `PATCH /api/v1.0/knowledge/documents/{docId}/receptionist`. The list carries `receptionistAccess` per row (files AND FAQs),
  `receptionistAvailable` and `materialSharingEnabled`. Full contract: the section above.
- **MCP tool** — `clinqetmcp/Clinqet.Mcp/Tools/KnowledgeTools.cs::SendMaterialInfo(refs[], channel?, email?)`. Order:
  kill switch (McpException) → `sms`/`text` channel ⇒ `smsUnavailable` DATA → session → per-call cap (`MaxMaterialSendsPerCall`,
  counted from `SharedDetails` markers with payload `kind=material`) ⇒ `sendsExhausted` → `NormalizeRefs` (parse/dedupe;
  all-invalid ⇒ `notSendable`; > `MaxPassagesPerMaterialSend` ⇒ `tooMany`) → `GetByRefsAsync` + `FilterSendableAsync`
  (LIVE row: kind ∈ Text/Table/FaqPair and the document SENDABLE by `KnowledgeReceptionistRule` — files and FAQs alike) → `MaterialExcerptAssembler`
  (neighbour pieces ±10 for record completion, ONE extra key read) → `VoiceMaterialSharingGate.WhatsAppTemplateApproved`
  (WhatsApp refused as `whatsAppUnavailable` DATA until `clinket_info_ready` has ≥1 `ApprovedLanguages`) →
  `VoiceSendChannelResolver.Resolve(wantsEmail, wantsSms:false, ani, callerEmail, smsEligible:false, canAskForEmail:true)` →
  enqueue `VoicePostCallMessage{Kind=SendMaterialInfo, Material, MaterialSendWhatsApp/Email, MaterialRecipientEmail}` with
  messageId `vpc-info-{callId}-{refsKey}-{w|e}` (refsKey = 8 hex of SHA-256 over the sorted refs) → marker LAST
  (`SharedDetails` payload `subject/channel/kind=material`; a lost marker raises `ShareMarkerWrite`). Every dead-end the
  model must explain is DATA (`sent=false` + a flag + a `note`); only the kill switch, a missing session, an isolation
  alarm and an enqueue failure throw. `ChatToolAllowlist` never contains it (pinned in MCP unit + integration).
- **Excerpt layout (pure, deterministic)** — `clinqetinfrastructure/Services/Knowledge/MaterialExcerptBuilder.cs` + `MaterialExcerptAssembler.cs`
  → `VoiceMaterialExcerpt{Items[Heading,Kind Record|Prose|Faq,Lines[Label?,Text]],CharCount,Truncated}`. Rules: `"label: value | label: value"`
  record lines → one label/value line per pair; a record split across oversize-row pieces is joined from its neighbours (same
  doc + section, consecutive chunks, same identity head) and the head printed once; FAQ = question as heading, answer as the
  line; adjacent prose cards show the chunker's sentence overlap once; whitespace-free runs > 40 chars get a ZWSP; control
  chars stripped; items grouped by document in first-named order then chunk order. **The cap is a PAGE budget in chars**:
  `MaxMaterialSendChars` (12,000) counted as RENDERED LINES — every line costs ≥ `RenderedLineMinChars` (110) and a heading
  `HeadingCost` (165) — so record-heavy and prose-heavy material both land at ≤ 3 pages; rows are kept WHOLE (never cut
  inside a row's pairs), paragraphs whole, a first paragraph/FAQ answer that alone overflows is cut at a SENTENCE end, and the
  first item always lands (≥ 1 row / 1 sentence) so an item is never empty. `Truncated` ⇒ the "… continues — {Business} can
  send the rest" line on the PDF/email.
- **Prompt** — `RealtimeSessionPayloadBuilder.MaterialSendRule(callerPhone)`: OFF ⇒ the pre-feature "You CANNOT send the
  owner's material…" sentence **byte for byte** (pinned in `RealtimeSessionPayloadBuilderTests`); ON ⇒ the sendable
  paragraph ("a result that carries a ref is a piece the owner allows to be sent… ONE to FOUR refs… never a whole document…
  a text message is never an option…"), WhatsApp named only when the template is approved in config AND the caller has an
  ANI, else "by email — ask once for the address and read it back". `ResolveAllowedTools(..., knowledgeEnabled,
  materialSharingEnabled)` adds `send_material_info` beside `search_knowledge` only.
- **Functions processor** — `VoicePostCallProcessorFunction.ProcessSendMaterialInfoAsync`: payload/channel/recipient guards
  ⇒ DLQ `InvalidMessageFormat`; profile missing ⇒ DLQ `BusinessProfileNotFound`; language = provider preferred (the
  ServiceDetails precedent); business phone = the DNIS (E.164) else the profile phone; `IPdfGenerationService.GenerateMaterialInfoPdfAsync`
  → WhatsApp via `IDocumentDeliveryService.DeliverMaterialInfoWhatsAppAsync(excerpt, profile, pdf, ani, autoConsent, language,
  callId, refsKey)` (blob `provider-knowledge/_sent/{businessId}/{callId}-{refsKey}.pdf - a TOP-LEVEL prefix so the storage lifecycle rule `provider-knowledge-sent-lifecycle-policy` (delete after `invoiceDocumentRetentionDays`, like the other transactional PDFs) can address it, and the business teardown sweeps `_sent/{businessId}/` too`, SAS `WhatsApp:MaterialDocumentSasExpiryMinutes`=720,
  in-window `SessionDocument` else template `clinket_info_ready` [`businessName`, `infoPdfUrl`, `infoFileName`], CapExempt,
  **no SmsFallback of any kind**, dedup `wa:VoiceMaterialInfo:{callId}:{refsKey}:{phone}`, NotificationType marker
  `VoiceMaterialExcerpt.NotificationTypeMarker`="VoiceMaterialInfo") → and/or email `MaterialInfoEmail` (×5 languages;
  data `Greeting` ("Hi {FirstName}," when caller-ID matched, else anonymous), `BusinessName`, `BusinessPhone`,
  `DetailsHtml` = `MaterialInfoEmailRenderer.RenderHtml` — an `HtmlFragment` with EVERY text node encoded; subject
  `MaterialInfo_Subject`; PDF attached; communicationType `VoiceMaterialInfo`; registered in
  `EmailHtmlFragmentsAreDeclaredTests.DeclaredFragments`). A delivery miss ⇒ forced admin alert + in-call
  `DocumentDeliveryNotice` with `VoiceDocumentKind.KnowledgeInfo` (the model already said "it's on its way").
- **PDF** — `QuestPdfService.GenerateMaterialInfoPdfAsync` ("Information from {Business}", provider logo via the invoice
  loader else text branding, date, phone, headings + label/value tables / paragraphs, Clinket footer + "Provided by … from
  their own material. Prices and availability may change — … will confirm. Sent by Clinket at your request.", page x / y).
  **Fonts are embedded** (`PdfFonts`: Noto Sans + Noto Sans Devanagari + Noto Sans Gujarati as EmbeddedResource, registered
  once via `FontManager.RegisterFont`, `FontFamily(PdfFonts.MaterialFamilyChain)` fallback) so hi/gu material never renders as
  boxes; an unknown glyph (tick, emoji) never kills the document. File name `MaterialFileName(title)` keeps letters/digits
  AND combining marks (Devanagari/Gujarati vowel signs — `char.IsLetterOrDigit` is FALSE for them) ⇒
  `Information-from-Hamilton-Equipment.pdf`, bounded to 80 chars + `.pdf`.
- **Settings (all §0.12, class defaults mirror appsettings, pinned per host):** `Voice:Knowledge:{MaterialSharingEnabled=true,
  MaxMaterialSendsPerCall=2, MaxPassagesPerMaterialSend=4, MaxMaterialSendChars=12000}` in API + Functions + MCP;
  `WhatsApp:MaterialDocumentSasExpiryMinutes=720` (Functions, beside its siblings); `WhatsApp:Templates:clinket_info_ready`
  (`ApprovedLanguages ["en","es","fr","hi","gu"]`, `BodyParams ["businessName"]`, `DocumentLinkKey "infoPdfUrl"`,
  `DocumentFileNameKey "infoFileName"`) in API + Functions (byte-identical pin) + MCP; `WhatsAppTemplateNames.InfoReady`.
  Enums: `VoicePostCallKind.SendMaterialInfo`, `VoiceDocumentKind.KnowledgeInfo`. Localization (en/es/fr/hi/gu):
  `MaterialInfo_{Subject,GreetingNamed,GreetingAnonymous,Continues}`, `PDF_MaterialInfo{Title,Footer,PagePrefix}`,
  `WhatsApp_MaterialInfo_DocumentCaption`.
- **UI (web + mobile, same session) — SUPERSEDED 2026-09-07 by the receptionist choice (section above):** details editor row "Send details to callers" (`knowledge.sharing.*` / `KNOWLEDGE.SHARING_*`)
  — saves on tap (PATCH), spinner while writing, revert + toast on failure, disabled unless the row is `Ready`, drawn only
  while `materialSharingEnabled`; list pill "Not shared" only where the switch is OFF; the Call Follow-ups "Details sent" card
  hides the `kind` payload key (web `HIDDEN_PAYLOAD_KEYS`, mobile `PAYLOAD_FIELDS` whitelist). Web `knowledgeSharing.test.jsx`.

### Tests (all green 2026-08-21; every new guard was taken red→green)
- API unit 9,558 (`KnowledgeControllerTests` sharing endpoint + permission row + list flags, `KnowledgeManagementServiceTests`
  switch rules + Replace keeps it) · Functions unit 2,628 (`RealtimeSessionPayloadBuilderTests` off/on split, processor
  `Run_SendMaterialInfo_*`, `Voice/MaterialDeliveryTests`, `Voice/MaterialInfoPdfTests` (Noto chain, ≤ 3 pages for
  record-heavy AND prose-heavy at the full cap, logo fallback, filename, unknown glyphs), `Voice/MaterialInfoEmailRendererTests`,
  conventions) · MCP unit (`KnowledgeToolsTests`, `MaterialExcerptBuilderTests`, `ProviderKnowledgeSearchServiceTests` incl.
  the `PreSharingNote` byte-identity pin, allowlist + settings conventions) · integration: API `KnowledgeSharingIntegrationTests`
  (real Cosmos PATCH + `ListSharingOffIdsAsync`), Functions `VoicePostCallProcessorIntegrationTests` SendMaterialInfo (real
  Azurite upload under `provider-knowledge`, real Cosmos `wa:` dedup, real LocalizationService, no SMS ever), MCP
  `MaterialInfoToolIntegrationTests` + catalog + chat-refusal. §0.18: rail/PDF/renderer tests live in the FUNCTIONS suite
  (the host that invokes them), builder/tool tests in MCP.

### ‼️ Traps this build paid for
- A Table card can be ONE item of hundreds of rows; "the first item always lands whole" made a 4,000-char excerpt a
  7-page PDF. The budget must bound the first item too (rows/sentences), and the page promise is only provable by rendering
  (`MaterialInfoPdfTests` counts `/Type /Page` in the bytes).
- `char.IsLetterOrDigit` drops Devanagari/Gujarati vowel signs ⇒ a Hindi title became "ह-म-ल-टन" in the file name.
- `EmailHtmlFragmentsAreDeclaredTests` is a REGISTRY: a new block-shaped placeholder (`…Html`) fails the Functions suite
  until its producer is declared there.
- `businessId` is NOT facetable in the knowledge index — scan `$select=businessId` instead.
- The dev index held ONE business with material (SX3SG2) on 2026-08-21 — the PDF previews were rendered from it.
- Admin alerts carry localization KEYS as Title/Description in unit tests (the helper localizes) — assert `AlertType`.

### 2026-08-21b — DISCOVERY: the switch at UPLOAD time, a pill on every Ready row, and the copy rewrite

> ‼️ **SUPERSEDED 2026-09-07.** The upload-time switch, the two-state pill, `KnowledgeConfirmFileDto.ShareWithCallers` and the
> `knowledge.sharing.*` copy are all gone — the per-item receptionist choice (three radios at upload, in both editors, three
> row marks on files AND FAQs, `KnowledgeConfirmFileDto.ReceptionistAccess`) replaced them. Kept as history.

> The owner deployed the partner web, opened Knowledge, and could not find the feature. Two real gaps behind
> that: (a) the switch lived ONLY in Document details, so a provider who never opens Edit never learns their
> material can be sent; (b) an INTERNAL document was sendable from the moment it turned Ready — the switch is
> refused while Processing, so there was no way to say "not this one" before it went live. Mockup
> `C:\Nik\Data\mockups\knowledge-document-sharing\v3-upload-and-list.html` (options drawn side by side, owner
> picked upload=per-file-line, list=pill-both-states, wording=Set B).

- **Upload time (web + mobile):** one line per file under the two pickers — the same label, the knob, nothing
  else; the sentence explaining it rides the existing blue note ONCE. `KnowledgeConfirmFileDto.ShareWithCallers`
  (`bool?`) carries it: `ConfirmUploadsAsync` writes `file.ShareWithCallers ?? true` on a new row and, on a
  REPLACE, overrides only `if (file.ShareWithCallers.HasValue)` — absent always means "leave alone", never
  "off by omission". Web seeds a replace from the document it replaces; mobile omits the field on a replace
  (its existing posture — the server preserves). No §0.7 item: the Cosmos field already existed.
- **List (web + mobile):** a pill for BOTH states — `Details can be sent` / `Not shared` — and ONLY on a
  `Ready` row (nothing is sendable before that, so a pill on Processing would promise what the platform cannot
  do), never on FAQs, absent while the kill switch is off. ‼️ The pill is READ-ONLY and opens Document details
  (`knowledge.sharing.changeHint`): a live knob would sit beside Delete on a phone with an instant server write.
  Without `voice.settings.manage` it renders as plain text, not a button.
- **Copy (owner-locked, all 10 catalogs).** `knowledge.sharing.label` = "Send relevant details to callers"
  (the old "Send details to callers" read as if the whole file went out) · `.helper` = "While your AI
  receptionist is on a call with someone, it can send them just the relevant details from this document — to
  their WhatsApp or email, never the whole file. Turn this off for internal material you don't want sent to
  callers." · NEW `.uploadHint` (same, "…from these files…") · NEW `.shared` = "Details can be sent" · NEW
  `.changeHint` = "Change in Document details" · `.notShared` unchanged. The helper names the ACTOR ("your AI
  receptionist") and the MOMENT ("on a call") — a passive draft lost both. ‼️ "Not shared" must NOT become
  "Internal only": switching it off stops the SENDING, the receptionist still answers from the document aloud.
- **On the call.** The model was told never to send a whole document but was never told to make that clear to
  the CALLER, and had no rule for "send me the whole price list". `MaterialSendRule` now adds: "Tell the caller
  what is coming in their own words — the details on what they asked about — so they never expect the whole
  thing", and "If they ask for everything rather than the part they need, tell them plainly you can send the
  details on what they need now, and offer a message or callback so the owner can follow up with the rest."
  The tool's success note names THE THING THEY ASKED ABOUT "so they expect the details they asked for and not
  the whole thing". Deliberately NOT a disclaimer on every send — the scope rides in the naming.
- ‼️ **§3.7 — NO PRODUCT OR SERVICE NAME IN THE PROMPT, EVER.** A drafted example read "I'm sending you the
  details on the 2016 D6 to your WhatsApp now". A Caterpillar model number in the first prompt of a salon's,
  a plumber's and a lawyer's receptionist. Every other example in this prompt is domain-free by construction
  ("the photos", "our timings", "all the details", "everything about us"). It now reads "I'm sending you those
  details now", and the rule's list of kinds mirrors `KnowledgeDocType` instead of one trade: "a price, a
  policy, a spec, an item from a list or inventory, anything at all from the material".
  **Guard:** `RealtimeSessionPayloadBuilderTests.MaterialSendRule_CarriesNoProductOrModelExample_SoItServesEveryBusiness`
  asserts the rule contains NO DIGIT — model codes, years and sizes all carry them. Sabotage-verified.
- **Tests:** API unit (`ConfirmUploads_NewDocument_StoresTheUploadTimeSwitch` ×3,
  `ConfirmUploads_Replace_OverridesOnlyWhenSent` ×4) · API integration against real Cosmos
  (`ConfirmUploads_StoresTheUploadTimeSwitch_OnTheRealRow` ×3, incl. `ListSharingOffIdsAsync`) · Functions
  payload-builder pins + the generality guard · MCP note pin · web jest (upload payload + both-state pill +
  the button contract) · mobile locale parity.

## ‼️ CONTENT ⇄ METADATA SEPARATION — a type/link edit is a FIELD MERGE, not a re-ingest (2026-08-21)

**The defect:** editing a document's type or its linked offerings triggered a FULL re-ingest — Document
Intelligence re-billed per page, the AI describe call re-run, every embedded image re-captioned, every card
re-embedded, and the editor locked on `Processing` for the whole run. Cause: `BuildPrefix` baked
`{docTitle} — {typeLabel} — {sectionPath} — {names (group)}` into every card's `Content` **and** `EmbedText`,
so the only way to refresh metadata was to rebuild the card. Correct, and fused.

**The fix — the header moved out of the stored text and is composed at READ time from index fields.**

| Layer | What | Changes when |
|---|---|---|
| **Content** | parsed blocks · AI title/summary/language · image captions · chunk bodies · vectors | the FILE changes |
| **Metadata** | `docType` · `linkedServiceIds`/`linkedServiceNames` · `linkedGroupName` | the provider edits |

- **`KnowledgeCardPrefix`** (`clinqetcore/Models/Knowledge/`) is the ONE definition of the header, with four
  callers: the chunker's sizing, the ingest's caption prefix, the index writer, and
  `ProviderKnowledgeSearchService.ComposeCardText`. Byte-identity is **structural**, not two implementations
  agreeing. Pinned by `KnowledgeCardPrefixTests` (the exact strings) and from the read side by
  `Composition_RecordCard_CarriesTheHeaderTheIngestSizedAgainst`.
- **Stored `content` is the BODY alone. The vector embeds the CONTENT half of the header** (`docTitle — 
  sectionPath` + body); the type label and offering names are deliberately absent from it.
- ‼️ **The chunker still sizes against the FULL header, metadata included** — bodies are packed exactly as
  before, so a re-ingest reproduces the old cards byte for byte. That is why the merge has a ceiling check.
- ‼️ **OVERVIEW cards (`DocSummary`/`DocAggregate`) never carried a header** and are passed through
  untouched; prefixing them would double the title in front of the counts a browse answer needs.

### The merge path

`UpdateDetailsAsync` no longer sets `Processing`, no longer nulls `ContentHash`, and no longer refuses an
edit while a run is in flight. It CAS-updates the row and enqueues **the existing `knowledge-ingest` queue**
with `KnowledgeIngestMode.MetadataOnly` (**no new queue ⇒ no ARM/deploy.ps1 change**). The queue session is
the `businessId`, so a merge and an ingest of the same business can never interleave and **both orders
converge** — an ingest queued behind a merge re-reads the current row.

`KnowledgeMetadataMergeService.ApplyAsync` (Functions host; `ResolveLinkedServicesAsync` moved here out of
the ingest function) lists the document's cards, then:

- **shrinking or equal header ⇒ merge, and the bodies are never read.** Every card already fits the header
  it carries, so a header no longer than the current one cannot overflow. That is the ordinary edit.
- **growing header ⇒ one extra read WITH bodies**, and every non-overview card is checked against
  `ChunkMaxTokens`.
- ‼️ **a card that would no longer fit ⇒ `RequiresReingest`**, and the ingest function re-cuts that ONE
  document (`BeginRecutAsync`; since P4-C-12 the hash is kept and the identical-content exit is a replacement's alone,
  so a re-cut still re-reads). Worst case is exactly what every details edit used to cost.
- **`Merge`, never `MergeOrUpload`** — MergeOrUpload would CREATE a card with metadata, no body and no
  vector. And a **`SearchDocument`, never the typed model**: serializing `KnowledgeSearchDocument` emits
  explicit nulls for `content`/`contentVector`, and Azure reads an explicit null in a merge as "set to null".
- **D22 on the write side**: `MergeCardMetadataAsync` re-proves every card id starts with the bound
  business's prefix. It is handed ids, so scope is verified there and not assumed from the caller.

### Index changes (‼️ drop + recreate, owner-run per region)

- **`docType` keeps its NAME but stores the model-facing LABEL** (`Price list`, not `PriceList`) and is now
  **searchable** (`en.microsoft`, synonym set, `searchFields`, TextWeights **1.0**), still filterable and
  facetable. The enum name is one glued token no analyzer splits — *"do you have a price list"* matched
  nothing. The enum stays the source of truth on the Cosmos row. **Zero new fields for the type.**
- **`linkedGroupName`** (NEW, searchable, `en.microsoft`) — the bracketed tail, `Underarms (Waxing Services)`.
  It is stored nowhere else; resolving it during a call would cost two Cosmos reads per passage, and dropping
  it loses the vocabulary bridge the group exists for. Empty unless 1–3 offerings share one group.
- ‼️ **`id` is now SORTABLE**, and every Skip-paging loop orders by it. Azure guarantees no ordering across
  pages without `$orderby`, so an unordered loop can repeat one page and miss another — on a 664-card
  document that silently left orphans answering callers after a delete. (Verified live: Azure DOES permit a
  sortable key field.)
- TextWeights: `docTitle` 3.0 · `sectionTitle` 2.0 · `content` 1.0 · **`docType` 1.0 · `linkedGroupName` 1.0**.
  Content weight is deliberate — these carry words that used to be scored inside `content`. **These are the
  dials to turn if a probe drops. NEVER put metadata back into the vectors.**

### The content artefact — ‼️ UNCONDITIONAL since 2026-08-29 (ON since 2026-08-25)

`KnowledgeContentArtifactStore` persists the parsed document (blocks + AI doc info + image captions) as
`provider-knowledge/{businessId}/_artifacts/{docId}.json.gz`, so a retry, a Try-again or an admin reindex
costs embeddings only — and, since 2026-08-29, so the analytics JOB (its own queue ticket) reads its inputs from
it by content hash (`TryReadForAnalyticsAsync`, fingerprint-agnostic). **`ContentArtifactEnabled` no longer
exists**: the artefact is written for EVERY document, born-digital included (a few KB of gzip per document is
cheaper than one re-parse). Only the Functions host reads the settings; the API host holds the store solely to
delete the artefact with its document.

- ‼️ **Written for every document** — with pictures on, a PDF is billable (a page read per page plus a vision
  call per image), and the analytics job must never re-buy that; a born-digital file's artefact is what lets a
  re-run skip the parse entirely.
- ‼️ **`PipelineFingerprint`** = the MVIDs of the assemblies that shape it. Deploy a parser fix, reindex, and
  a cached parse would hand back the OLD cards while looking deployed — the same silent-no-op class as a re-read
  taking the identical-content exit (a replacement's alone since P4-C-12). A mismatch can only cause extra work, never
  a stale reuse.
- Deliberately NOT cached: the inventory, the aggregates, the chunk plan (recomputed in-process for free, so
  a settings change takes effect) and **the vectors** (a metadata edit keeps them in place, so there is
  nothing to back up).
- A cached caption still answers to `ImageCaptioningEnabled` — turning captioning off removes them from the
  cards, not merely stops paying for new ones.

### Two live defects found on the way through, both fixed

1. ‼️‼️ **`AzureStorageService.DeleteBlobAsync(container, directory, blob)` LOWER-CASED the blob name.**
   Azure blob names are case-sensitive, so `SX3SG2/...` was deleted as `sx3sg2/...` and `DeleteIfExists`
   quietly returned false: **every deleted knowledge document left its source file in storage.** This is the
   "~12 orphaned blobs under SX3SG2" that had been written off as "delete is best-effort". Only the CONTAINER
   may be lower-cased. Its only production callers are the knowledge delete and the hash-twin cleanup, so the
   blast radius was exactly this feature. Pinned against real Azurite in
   `AzureStorageBlobCasingIntegrationTests`, sabotage-verified.
2. **The hash-twin refresh renamed the row and left the CARDS holding the old filename** — a row-only edit
   leaving stale cards, the mirror image of the defect this programme removes. It now runs the merge.

### The editor is no longer locked (web + mobile, same session)

`canEditDetails` is unconditional on web and the mobile actions sheet drops its `Processing` gate. **Replace
still waits — that genuinely is another run.** Pinned in `knowledgeGuards.test.js`. Also fixed: the offering
picker said *"Link to one offering"* on a MULTI-select in all ten catalogues, left behind by the 2026-08-18
multi-link change.

### ‼️ VERIFIED LIVE (CA, 2026-08-21) — and the harness traps it cost

737 cards / 3 documents · 54+685+26 source records all present · 0 over-ceiling, 0 dupes, 0 blanks,
hasEmbedding 737/737 · every card carries a LABEL in docType · no card still holds its header in
`content` · composed max 2040 of 2048. **Battery 15/15 — answer found on every probe before AND after; THREE identical
post-change runs: 2 probes BETTER, 11 unchanged, 2 moved for CORPUS reasons, 0 regressions.** Both moves
traced with evidence, neither is retrieval: the owner re-uploaded hamilton with the `Inventory` type and a
NEW TITLE (toromont is now `Other`), so "what is in your inventory" correctly ranks the document actually
typed Inventory — the probe's hardcoded `want: toromont` is the stale half — and "price range" swapped one
`price_cad` aggregate for another (toromont's 685 records over hamilton's 54). ‼️ **A probe expectation
pinned to a document is a claim about the CORPUS, not the engine; re-read it before calling a move a loss.**

**The merge, proven on the deployed Function App** (row edited in Cosmos + MetadataOnly enqueued, exactly
what the API does): type change landed in 25s cold / 4s warm, **0 cards re-chunked, 0 re-embedded, content
byte-identical, card `updatedAt` untouched** — that stamp is the proof no ingest ran — row never left
Ready, contentHash preserved. Offering tail proven by writing name+group onto live cards: the header
composes `… — 2014 CATERPILLAR TL1255C (MB067620) (Telehandlers)`, and clearing the links clears the group.

‼️ **A test business can have ZERO services in Cosmos while its services INDEX holds hundreds.** SX3SG2 has
677 indexed services and none in `ProviderData`, so every link resolves to an empty name — which is correct
X2 behaviour, not a bug, and it means the offering path cannot be exercised there through the product at all.

‼️ **Four harness traps, each of which produced a confident wrong answer before being caught:**
1. **A document map keyed on docId prefixes.** docIds change on every re-upload ⇒ five phantom FAILures on
   a perfectly correct system. Key on the FILENAME, resolved live.
2. **A field missing from `select`** (`linkedGroupName`) ⇒ the reader never asked for it, and the check
   `x === undefined || typeof x === string` PASSED on undefined. A vacuous guard.
3. ‼️ **The replay did not compose the header at all** — it measured stored bodies, so the token-budget trim
   ran on text ~55 chars per card shorter than the model actually receives.
4. ‼️ **The replay searched 4 fields while the service searches 6.** It was measuring a NARROWER engine than
   the one answering real calls; two probes changed rank once it was aligned.
   **Any replay of the retrieval path must mirror `SearchFields`, `SelectFields` AND the composition —
   pin the port against the C# golden strings before trusting a single number it prints.**

### ‼️ SECOND LIVE PASS (CA, 2026-08-21) — the edge cases a happy-path run never reaches

Everything below ran against the deployed Function App and the live index, then restored.

- **A document BIGGER than one search page.** `toromont_machines.json` is 664 cards; the page size is 500.
  A type flip relabelled **all 664 across 2 pages in 27s cold / 5s warm — none left behind, 0 content drift,
  0 restamped, 0 vanished mid-enumeration**, registry row untouched apart from the type. This is the case
  that silently half-applies if ordered paging or multi-batch merge is wrong, and it leaves a provider's
  LARGEST document answering under the old metadata — the failure nobody notices.
- **All five offering header rules**, driven by temporary INACTIVE service rows so the search change feed
  treats them as delete-eligible (no enrichment call, no services-index pollution):
  one offering ⇒ name + group both resolve · three sharing a group ⇒ all three named, group kept ·
  **mixed groups ⇒ the group is DROPPED, names stay** · **four (past the cap) ⇒ the header names NONE while
  all four names are still STORED for the tool result**, and the header is byte-identical to an unlinked doc.
- ‼️ **The ceiling fall-through fires and is not theoretical.** A 140-character offering name made the header
  stop fitting; the merge refused, fell through to a re-ingest, and **every composed card still landed inside
  2048**. Without that check the merge would have written cards the model cannot receive whole.
- **Reprocess** rebuilt 6 cards to 5 in 5s, clean. **Two edits enqueued back-to-back converge** — all cards
  agree on ONE label, the LAST edit wins, no half-applied state, row stays Ready.

‼️ **The seeded services INDEX carries GUID ids that do not exist in the live category container.** A group
lookup against them correctly resolves to nothing. Two hours were spent reading that as a resolver bug before
it turned out to be wrong test data — use REAL catalogue ids (`cat_010_sub_003`) when exercising the group path.
### ‼️ Traps this adds to the permanent list

- **Azure blob names are CASE-SENSITIVE; only container names are not.** A lower-casing "normalization" on a
  path deletes nothing and reports nothing.
- **`$skip` paging with no `$orderby` has no ordering guarantee** — it can repeat and miss across pages.
- **A merge with a typed model writes explicit nulls**, which Azure treats as "clear this field".
- **`as IReadOnlyList<T>` on an `IList<T>` can return null** and silently drop a header segment — materialise.
- **A comment can go stale the moment a flag flips.** "cheap because the artefact means no extraction" became
  false the instant the artefact shipped off; a false comment is worse than none.
- **A test that only proves the guard REJECTS proves nothing if the write silently no-oped** — three artefact
  rejection tests passed while nothing was ever written, because Azurite had no container. Assert the
  accepted case first, in the same test.

## ‼️ `RetrievalTopK` 5 → 8 (2026-08-20) — deferred item O-1, CLOSED on measured numbers

`RetrievalTopK` is **how many cards the model may see per `search_knowledge` call.** It was 5, and the owner
had deferred any change (PHASE-4 **O-1**: *"measure, present, then wait"*). Now **8**, in all three places
that must agree — the class default in `VoiceKnowledgeSettings.cs` plus the MCP and Functions appsettings
(`VoiceAnswerLadderSettingsConventionTests` fails the build if they diverge).

**Why 8 — measured on the live index, not reasoned:**
- ‼️ **`RetrievalMaxTokens` (1500) binds FIRST and is UNCHANGED**, so topK can never raise the per-call
  ceiling. Only `RetrievalMaxTokens` could — that is the real cost lever; do not raise it casually.
- ‼️ **The vector leg already fetches 10** (`KNearestNeighborsCount = Math.Max(10, RetrievalTopK)`), so
  5 → 8 adds **no vector work at all** — it only widens the gate on results already retrieved.
- A typical provider's whole knowledge base is under 8 cards (price list + FAQ + policy sheet). At 5, **two
  of the real flyer's seven cards — FACIAL and WAXING — never reached the model on any question**; they
  depended on winning the top-5 ranking. At 8 the model always holds the complete price list.
- **Cost**: a small base pays **+77 tokens/call**. A LARGE catalogue pays **+0** — the budget had already
  trimmed it to 4 cards (`what excavators do you have` measured identical at 5 and 8). ‼️ **A business
  holding TWO unrelated documents pays more (+189…+366/call)** because the spare slots fill with whatever
  ranks next — on a pedicure question that was an 895-char paver spec. That is test-data shape, not a normal
  provider, but it is exactly why estimating from one document's card sizes gave the wrong number.
- ‼️ **Cards are ALL-OR-NOTHING**: `SanitizePassage` never shortens and `TrimToTokenBudget` drops whole
  passages, so every card sent is sent in FULL, header line included. Half a machine spec beats nothing is
  FALSE here — the design prefers dropping the card.
- **Do NOT raise it further.** Past ~8 a small base already has everything and a large one is already
  trimmed, so it buys nothing and only lengthens the list to discard.
- **Read-time only: NO reindex, NO reseed.** Effective on a Functions + MCP deploy; the API never reads it.
- Still open, and NOT topK problems: the big-catalogue case ("what excavators do you have?" → 4 of 656) needs
  an aggregate/count answer path. ‼️ D27b was REVERSED by the owner on 2026-09-25 (O-2): a relevance floor on
  each passage's cosine now drops the weak filler card (P4-E-26 section below).

## ‼️ D11b — THE COMPUTED DOCUMENT INVENTORY (browse answers), SHIPPED 2026-08-20

**The defect:** `search_knowledge` returns passages — right for a LOOKUP ("how much is a pedicure"), wrong
for a BROWSE ("what excavators do you have"): the model received 8 records of 97 with nothing saying it was
a sample. **Root cause (verified):** the DocSummary AI saw only the FIRST 6,000 of 640,831 chars (0.9%), so
the summary described the document's SHAPE, never its CONTENTS — "excavator" was not in the card, and a term
absent from a document is unreachable by any ranking. ⇒ **counts are COMPUTED, never asked of an LLM.**

Three parts, all deployed with the **Function App** (effective on **RE-INGEST only**; no index change):

1. **`KnowledgeInventoryBuilder`** (`clinqetinfrastructure/Services/Knowledge/`, DI in Functions only) —
   pure/deterministic over the whole `KnowledgeBlock` stream. **Tier A**: leaf heading names with entry
   counts (table data rows + list items + self-contained lines + paragraphs), top-N by count + "+M more";
   a section whose entries all sit in a Tier-B table is not re-listed. **Tier B**: column shapes for tables
   whose labels the source DECLARED or the shape PROVED (R1) — identical label signatures MERGE across
   tables (paginated sources). Per column: coverage <0.5 drop · single-distinct drop · numeric (parse share
   ≥0.9): bare ~unique (>0.9 distinct ratio) = identifier drop, **but a currency/%/"/-"-marked column is a
   MEASURE even when every value is unique** · range = **VERBATIM source tokens** at nearest-rank p5–p95
   (‼️ floor-index percentiles collapse a 2-row range to its LOW value; nearest-rank excludes an extreme
   exactly when it is <5% of the mass, so `year: 9999` falls out of 685 rows while a 2-row table keeps its
   true min-max) · else ≤40 distinct listed as `value (count)` + "+M more". ‼️ **No vocabulary anywhere**;
   number parsing is order-only and refuses gluable lists (`2008 2010`), codes (`TL1255C`), compounds
   (`$50/70`). It reuses the chunker's own table planning (`PlanTableForInventory`) so the inventory can
   never describe different rows than the cards show.
2. **The DocSummary card** = title line + AI prose + **the computed inventory verbatim, always**. The AI
   call gets the inventory as authoritative context (it may describe, never invent a figure) and its sample
   is now **5 strata spread across the document** (U1; docs ≤ `DocSummarySampleChars` pass through whole,
   byte-identical to before). ‼️ **An AI failure still ships the card** (filename title + inventory) — the
   browse vocabulary never depends on a model call. Card stays under the 512-token ceiling by budget
   (70 + 400 + 1,400 chars) plus a whole-line-trim belt.
3. **§7.10 prompt** (`RealtimeSessionPayloadBuilder`, knowledge block): the partial-result rule — results
   are the closest matches, NEVER a complete list; a browse question is answered from a returned overview's
   counts/ranges/sections, then narrowed; bare records are examples only.

**Settings** (`Voice:Knowledge`, mirrored in ALL THREE hosts' appsettings): `DocSummarySampleChars` 6000 ·
`DocInventoryEnabled` true · `DocInventoryMaxSections` 12 · `DocInventoryMaxColumns` 12 ·
`DocInventoryMaxValuesPerColumn` 8 · `DocInventoryMaxChars` 1400. `VoiceKnowledgeSettingsConventionTests`
(Functions repo) pins the FULL section against class defaults BOTH ways. The API appsettings
`RetrievalTopK` 5→8 drift was fixed in the same change.

**Measured on the real files:** Toromont's card now carries `685 records · subcategory: Wheel Loaders (130),
Forklifts (126), Excavators (98), … +19 more · price_cad: 26500 to 479800 (typical)` (1,074 chars computed);
the salon flyer yields `Sections: <its six headings with counts>`; structureless prose yields nothing (the
floor case: U1 + prompt rule only). Harness: `knowledge-table-hunt` group **INV** (6 cases) + `--di` now
prints the computed inventory for any replayed document.

**Verified LIVE (CA, 2026-08-20, after deploy + re-ingest):** 661 cards (654 + 7) · 685/685 records present ·
0 over-ceiling / entities / dupes / missing embeddings / price-row anomalies · both DocSummary cards carry
their inventory · hybrid probes: "how many machines" → overview at RANK 1 · "what do you sell" and "what
services do you offer" → overview in the model's set · all 4 price lookups right price on top ·
‼️ **Known residual (the §8 aggregate-path item, owner-aware): a TYPE-SCOPED browse ("what excavators do
you have") ranks 98 type-specific records above the whole-catalog overview on BOTH legs (its vector is
"everything", the query is specific; not in top 50), so the model gets records-as-examples + the §4.7 rule
(never implies completeness) rather than the count.** A static DocSummary scoring boost was considered and
REJECTED: it would outrank real price rows on LOOKUP queries — a regression worse than the gap.

**Rejected — do not rebuild:** handing the model raw match counts (a fuzzy card count ≠ an item count — same
class as speaking the CARD count, which is why the inventory speaks RECORDS/entries, never cards) ·
facetable index fields (§0.7 schema gate) · raising `RetrievalTopK`/`RetrievalMaxTokens` · pseudo-sections
from card text · term-frequency "prominent terms" · AI-generated counts.

## 2026-08-25 — UNLISTED ITEMS: NAME-RESOLVED OR NOTE-STAMPED (bookings AND written quotes from knowledge)

Owner directive (supersedes the Phase-1 "no written quote from material prices" rule): the service
catalog stays the ONLY full-confidence price source, but a caller may now get a WRITTEN quote or a
booking line for something from the owner's material — always stamped subject to the owner's
confirmation. Three moving parts, all shipped together:

- **`IServiceNameResolver`** (`clinqetinfrastructure\Services\Catalog\ServiceNameResolver.cs`,
  registered in API + MCP hosts, settings `ServiceNameResolution:{Enabled,CacheTtlMinutes,
  MaxServicesPerBusiness}` in both hosts' appsettings): exact-name match — case, whitespace and
  punctuation insensitive, NEVER contains/fuzzy — against a cached per-business name→id map
  (`IMemoryCache` key `svc:namemap:{businessId}`, `Size=1`, TTL-bounded). A hit is verified by a
  live point-read (name re-compared) so a stale map can never attach a renamed id; ambiguous
  normalized names and over-cap catalogs resolve to nothing. `Invalidate(businessId)` is called by
  every same-host Service name/active/delete mutation (ServiceController create/update/duplicate/
  delete/bulk, CategoryController cascade deletes, ProviderSetupServiceWriter, MCP
  ServiceManagementTools); cross-host writes age out via TTL. ‼️ Approval-status-only and
  image/currency-only writes deliberately do NOT invalidate (the map keys name+active only).
- **The confidence ladder in the tools** (`BookingTools`, `PartnerTransactionTools`): every
  create/quote tool takes tail-appended `serviceName` (+ `priceEstimate`/`price`). serviceId ⇒
  catalog path unchanged, and a stray serviceName beside a valid id is IGNORED (pinned).
  serviceName alone ⇒ resolver; an APPROVED+active match becomes the catalog path (voice re-gates
  approval via `TryResolvePublicServiceByNameAsync`; partner scope accepts any active match).
  Unresolved ⇒ an UNLISTED line: caller's words as ServiceName/JobTitle, sanitized price
  (>0, ≤99,999,999, else treated absent), and the localized note `Voice_UnlistedItemNote`
  ("Prices and details are subject to change until confirmed by {business}", en/es/fr/hi/gu,
  resolved in "en" to match the entity PDFs' `DocumentLanguage`). The note rides the BOOKING line's
  `JobDescription` (the PDF Details column + both dashboards) and the QUOTE's `QuoteDescription`
  (the PDF's prominent description block). Partner-authored unlisted lines get NO note — the
  provider IS the confirmation. `send_quote` with an unlisted item and NO price returns a
  `priceRequired` DATA result (no orphan quote, before any channel/email ask); `get_quote_estimate`
  still requires a serviceId (it is a calculator over catalog pricing).
- **Prompt + Note rewrites (pinned):** the payload builder's knowledge block now teaches
  send_quote-with-serviceName+price and request_booking-with-serviceName/priceEstimate (pinned in
  `RealtimeSessionPayloadBuilderTests`); the `ProviderKnowledgeSearchService` passages Note carries
  the same rule (pinned in `Clinqet.Mcp.UnitTests`). ‼️ "Never invent a price the material does not
  name" is load-bearing in both.

Same session, Task 1 (UI path): the four `BookingController` service loops (create/draft/
draft-update/update) and `QuoteController` create/update run the SAME resolver over "Other" lines
(serviceId null + typed name) — a match attaches the real serviceId (+ category ids when absent),
Taxable/payment-override follow the catalog path on bookings; text and typed price are NEVER
touched, and no note is added (the provider typed it). Web + partner mobile already send
`serviceId: null` + the wording for Other rows, so no client changed. Proven against real Cosmos in
`ServiceNameResolutionIntegrationTests` (incl. the rename→immediate-invalidation round trip) and
`UnlistedServiceLineIntegrationTests` (unchanged, still green).

## 2026-08-20e — PHASE 1: KNOWLEDGE-GROUNDED BOOKINGS + ESTIMATE-FRAMED MATERIAL PRICES (SHIPPED)

Owner directive: a booking must never require a listed service, and a price found in knowledge is ALWAYS
shared but NEVER with full confidence — services stay the only full-confidence, quotable price source.
Three prompt-level rules + one tool-description change; **no schema, no tool signature change**
(`request_booking`'s `serviceId` was already optional — a null service yields `Services = []` with the
notes in `BookingDescription`, status AwaitingProviderConfirmation):

- **`RealtimeSessionPayloadBuilder` knowledge block** (`clinqetinfrastructure\Services\Voice\`): (1) a
  material price "is an ESTIMATE, not a confirmed price" — share it, say the owner will confirm; (2)
  "NEVER create or send a written quote from a price found in the material, and never pass a different
  service's serviceId to make one"; (3) "A BOOKING does not require a listed service — create it with
  request_booking WITHOUT a serviceId and put exactly what they are booking in notes… Never refuse a
  booking just because the thing is not a listed service."
- **`ProviderKnowledgeSearchService.Passages()` Note** repeats the estimate rule per search call ("A price
  in these passages is an ESTIMATE the owner will confirm — share it with that caveat, and never build a
  written quote from it").
- **`BookingTools` `request_booking` description**: "Pass serviceId when it is a listed service; when it
  is something from the owner's material or otherwise unlisted, omit serviceId and describe exactly what
  they are booking in notes." `send_quote`/`get_quote_estimate` still REQUIRE a serviceId — the
  no-knowledge-quotes rule is tool-enforced, not just prompted. **(SUPERSEDED 2026-08-25 for
  `send_quote` — see the unlisted-items block above; `get_quote_estimate` still requires a
  serviceId.)**
- Guards (sabotage-verified red then green): `Build_HasKnowledge…` in
  `Clinqet.Communications.UnitTests\Voice\RealtimeSessionPayloadBuilderTests` pins all three prompt
  sentences; `PassagesNote_CarriesTheMaterialPriceEstimateRule` in
  `Clinqet.Mcp.UnitTests\Services\ProviderKnowledgeSearchServiceTests` pins the Note.
- **SEND GUARDRAIL (same day, after a live demo)**: the model offered to WhatsApp an inspection report it
  found in knowledge — **no tool can deliver knowledge content on ANY channel**. The sendable set is
  exactly `send_my_details` (booking/invoice PDF), `send_quote`, `send_service_info` (a LINK the TOOL
  composes to the business's/offering's page). New prompt rules, both sabotage-verified: the payload
  builder's knowledge block ("You CANNOT send the owner's material to anyone… NEVER offer to send a
  report, list, specification… What you CAN send is unchanged: …") and the Passages Note ("You CANNOT
  send this material to the caller by WhatsApp, text or email… Sending a booking, a quote or a listed
  offering's page with your send tools is still fine."). ‼️ The still-fine clause is deliberate — a
  knowledge hit that names a linked offering must NOT inhibit `send_service_info`. ‼️ If a real delivery
  path ever ships, UPDATE these sentences + their pinned assertions FIRST (they would suppress the new
  tool) — the delivery design programme lives in `C:\Nik\knowledge-delivery\NEXT-SESSION-PROMPT.md`
  (recommendation: email the provider-authored DOCUMENT behind a per-doc "shareable" flag, never
  AI-composed prose; WhatsApp later via one static utility template carrying a link; SMS never).
- **Next programmes (documented, NOT built; each opens with a NO-CODE-BEFORE-OWNER-CONFIRMS gate)**:
  draft-service extraction — `C:\Nik\knowledge-service-extraction\NEXT-SESSION-PROMPT.md`; knowledge
  delivery — `C:\Nik\knowledge-delivery\NEXT-SESSION-PROMPT.md`; **content/metadata layer separation**
  (owner-approved direction 2026-08-20: a type/link edit today triggers a FULL re-ingest — DI re-billed,
  AI describe + vision captions re-run, every card re-embedded, editor locked while Processing — because
  `BuildPrefix` bakes the type label + offering names into every card's content AND embed text; the fix
  is a persisted content artefact per content hash + metadata as index fields only (new searchable
  `docTypeLabel`) + read-time prefix composition byte-identical to today + content-only vectors, proven
  on the battery before the flip) — `C:\Nik\knowledge-metadata-separation\NEXT-SESSION-PROMPT.md`.

## 2026-08-20d — D11d: OVERVIEW COMPANION + PER-DOCUMENT FAIRNESS (multi-document retrieval)

The 4-document stress corpus (746 cards; toromont's 653 records beside three other docs) exposed the
documented multi-source flooding: one loud document filled the whole top-K. Two mechanisms shipped, both
owner-approved, both keyed ONLY on structures our own pipeline stamps (docId, chunkKind) — never on any
content dimension (location, category, brand), so every provider's document mix behaves identically:

- **Overview companion** (`RetrievalOverviewCompanionEnabled`, `RetrievalOverviewTopK` 3): a parallel
  chunkKind-filtered query — same text, same embedding (embedded ONCE), same round trip, fail-soft —
  so overview cards compete only with each other. The browse guarantee ("what excavators…" gets the
  computed counts) is now DETERMINISTIC at any corpus size, ending the boundary-luck era for good.
  ‼️ The companion is awaited BEFORE the main read so a cross-tenant leak it saw always fails the call
  closed — never an unobserved faulted task.
- **Per-document fairness** (`RetrievalPerDocCap` 6, window = topK×2, vector k untouched): one document's
  RECORDS may hold at most the cap's seats while other documents still have ranked candidates in the
  window; unused seats flow BACK (which is what makes a single-document business byte-identical by
  construction — pinned by `Diversity_SingleDocumentBusiness_IsByteIdenticalToPlainTopK`). Overviews are
  cap-exempt. Cap 0 disables.

**Measured on the 4-doc corpus: 13/15** (from 12/15), every browse shape now answered with computed
figures. ‼️ The two residuals are RANKING-quality, not mechanism gaps, and both are self-recoverable by
the model's follow-up search: (a) "D6 inspection" — hamilton's card wins a SEAT but the budget goes
rank-first to toromont's D6 records; the kept hamilton DocSummary itself says the doc includes inspection
reports, and a narrowed second search_knowledge call surfaces the card at the top; (b) "TL1055 lift" —
the spec card ranks >30 on that phrasing (record-term flooding); "TL1055 lift capacity specs" finds it
directly. Both belong to future relevance work (§8), not to more seat-allocation rules.

Three separately-measured ceiling leaks (oversize row split between cells · oversize cell with the
identity aboard · near-ceiling sentence vs the prefix) were ONE CLASS: **every budget packer admitted the
first unit of a group whatever its size, so any atomic unit bigger than its budget WAS a card over the
512-token ceiling.** Latent at five sites — preformatted lines (a minified/base64 line in a fence), list
items (a JSON array of long strings), self-contained-line blocks, sentence packing (both the paragraph
and FAQ paths split sentences at the RAW ceiling while packing against ceiling-minus-prefix). Fixed at
the primitives: `CapUnits` word-boundary-splits any oversize unit inside `SplitByUnits` /
`SplitListByItems`, and `SplitSentences` takes the caller's EFFECTIVE budget. The inventory also drops
columns whose LABEL exceeds 80 chars (a 4K-char JSON key must never become an aggregate title).

**The enforcement is a PROPERTY SWEEP, not per-case tests**:
`KnowledgeChunkerCeilingPropertyTests` drives 16 pathological shapes (solid 40K no-whitespace text, CJK
with no word boundaries, Devanagari, emoji, giant cells/items/lines/keys, 50 nested headings,
whitespace-only docs) + the FAQ path + the real JSON parser paths, asserting per card: **token ceiling,
real content, determinism**. ‼️ **13 of the 18 cases FAIL against the pre-fix chunker** — proof the sweep
catches the class, not the instance. Any future packing change must keep this sweep green; extend it
with the pathology, never weaken the invariant.

## 2026-08-20b — two-document audit (mixed shapes), the oversize-row IDENTITY rule, `Inventory` doc type

**Audit of two new SX3SG2 uploads** (`hamilton_inventory.json`: 54 units with booleans, a per-unit
3.7K-char inspection STRING, a root `counts` object; `cat_model_specs.json`: a keyed OBJECT of 26 prose
spec strings — no array, no headings): **no parsing or algorithm bugs.** 54/54 + 26/26 records present,
0 anomalies. The hamilton DocSummary computes `54 records`, per-category/manufacturer counts, price range,
and even `sold: true (38), false (16)` / `delisted:` counts — booleans are just low-cardinality categoricals,
no vocabulary needed. The keyed-object doc lands as line-per-model Text cards (`models.Cat 262D: …`) —
each model retrievable; its DocSummary is prose-only (floor case: no headings, no declared columns).
**Cross-document synthesis works live**: "how much is the 2016 Cat 262D" returns the stock record AND the
spec card together. ‼️ Probe traps that faked bugs: JS `Object.keys(someString)` returns char indices and
`typeof null === 'object'` — two stacked JS traps made a clean source string look like a char-spread
object; verify against the RAW JSON text, never JS introspection.

**Oversize-row identity (chunker):** when one CELL exceeds the card budget, `SplitOversizeRow`'s
continuation pieces now carry the row's FIRST cell line (column 1 = the row's identity — the same
convention H1 leans on). Measured live before the fix: a unit's inspection-report fragments retrieved as
orphans no caller question could attribute to a machine. A first cell over ~40 tokens cannot serve as an
identity and pieces ship as before. Sabotage-verified. ‼️ **The identity's room must be reserved BEFORE
the oversize cell is split** — cutting at the unreserved budget produced pieces the identity-reserving
packer could not hold, and first-unit-always-admitted let them through: the 512-token ceiling leaked by
the identity's own size (measured live at 516; three cards). Pinned by
`OversizeRow_NoPieceExceedsTheTokenCeiling_IdentityIncluded`, which was red before the fix.

**D11c — per-column aggregate cards (`KnowledgeChunkKind.DocAggregate`).** The holistic DocSummary card
loses ranking to individual records on value-scoped browse ("what excavators do you have" — measured, not
in top 50). Fix: each ELIGIBLE Tier-B column (same rules as the inventory lines) also ships as ONE dense
stand-alone card: `"{docTitle} — overview — {label}"` + `"{n} records — {label}: v1 (c1), v2 (c2), …"`
(categorical, ALL values within `DocAggregateMaxChars` 1200 + honest "+M more") or the p5–p95 range
(numeric). The column label rides `sectionTitle` (searchable). ‼️ **Per-VALUE cards were considered and
deliberately NOT built**: choosing WHICH column deserves per-value expansion cannot be done without
vocabulary, and expanding all columns is ~150 extra cards on a 685-row doc — per-column is ≤`MaxColumns`
(~4-10) tiny cards, and ZERO for docs without labeled tables, so typical providers pay nothing. Per-value
is the documented escalation if measurement still shows value-scoped misses. Gated by
`DocAggregatesEnabled` (under `DocSummaryEnabled` + `DocInventoryEnabled`); effective on re-ingest.

**D11c trim refinement (`ProviderKnowledgeSearchService`, deploys with the MCP host) — OVERVIEW
RESERVATION.** Live measurement after the aggregate cards shipped: the category aggregate reached the
top-K for "what excavators do you have" but **died to the token trim** — the record cards packed 5,552 of
the 6,000-char budget and the ~460-char aggregate missed the leftover by a hair. ‼️ **A leftover-only rule
was tried first and is NOT enough** — whenever records pack tight, the leftover is arbitrarily small, so
the size bias survives as margin-of-luck. The trim now SEATS in three stages, emitting in rank order:
(1) rank 1 always, whatever its kind; (2) top-K OVERVIEW cards (DocSummary/DocAggregate) in rank order
under the same cumulative budget; (3) records with their exact legacy break-at-first-overflow contract.
With no overview in the top-K the kept set is **byte-identical** to the original trim (pinned by
`TokenBudget_SmallRecordAfterOverflow_IsNeverCherryPicked`); the reservation itself is pinned by
`TokenBudget_OverviewIsSeatedBeforeRecordsFinishPacking`, which a leftover-only implementation fails.
`chunkKind` rides `SelectFields` for the trim ONLY — never surfaced to the model. **Measured after
deploy + reseed: 15/15 probes across 3 consecutive runs** — all lookups unchanged, every browse shape
(count, price range, brands, ages, per-type) answered from computed figures. D27's invariants hold:
budget binds first, whole cards, top passage always kept, rank-ordered output.
‼️ Verification traps hit here: right after a reseed the index replicas CONVERGE for a few minutes and
boundary ranks flip run-to-run — do not measure until updatedAt is fresh AND a repeat run agrees; and
when a replay disagrees with a direct probe, instrument the replay's RAW hits first — the bug was in the
replay's own trim, not the service.

**`KnowledgeDocType.Inventory` added** (6th value; still a deliberate ENUM, not a Cosmos taxonomy — §7.4b):
enum + both prefix-label switches (chunker `DocTypeLabel`, ingest `BuildCaptionPrefix`) + partner web
`DOC_TYPE_META` + 5 web catalogs (`knowledge.docType.inventory`) + partner mobile `DOC_TYPE_LABEL` + 5
mobile locales (`KNOWLEDGE.DOC_TYPE_INVENTORY`). A reflection test
(`Prefix_EveryDeclaredDocType_CarriesItsOwnLabel`) fails the build for any FUTURE enum value that lacks a
prefix label. Old mobile builds fall back to the Other label on unknown values — graceful.

## ‼️‼️ PERMANENT RUNBOOK — AUDIT THE KNOWLEDGE BASE (blob ⇄ index). NEVER DELETE THIS SECTION.

> **Owner-mandated, 2026-08-19.** This exists so that in a fresh session the owner can say only
> *"I have more knowledge documents — review them all from blob storage: what does the original file look
> like, and what do we have in the index?"* and you can run the whole audit from here without asking a
> single setup question. Keep it current when anything below moves. **Do not delete or summarise it away.**

### ‼️ RULE ZERO — FIX THE CLASS, NEVER THE INSTANCE
> **Every defect found by this audit must be fixed GENERICALLY.** The document in front of you is one
> provider's flyer; the fix ships to every provider, in every category, in every language, for documents
> nobody has uploaded yet. Before writing a fix, ask: *what is the CLASS of this bug, and what else in that
> class exists?* Then fix the class.
>
> This is not advice — it is how every real defect in this pipeline was found. Chasing one cosmetic
> duplicated price surfaced **column-major flattening** (every price one service late) and **a wrong price
> on every non-Latin script**. Neither was in the owner's test data. Both would have shipped.
>
> Corollaries, each learned the hard way:
> - **No vocabulary.** No English word lists, no currency lists, no category names. Rules key on structure
>   (digits, separators, sequence shape) so a Gujarati price list behaves like an English one.
> - **A rule whose safety depends on today's corpus is not safe** — the corpus is user-supplied and
>   unbounded. If safety cannot be argued WITHOUT looking at the data, it does not ship.
> - **Never guess structure; never destroy structure.** Split only when the source PROVES the split point.
>   But "I cannot pair these" must never mean "throw the line boundaries away".
> - **A guard that degrades working documents is worse than the gap it closes.** Prefer the failure that
>   loses formatting over the one that states a wrong price — and measure the cost of the refusal path.

### Step 1 — credentials (ONE file has all four; never copy a value into any file you create)
`C:\Nik\cosmosindexsetup\appsettings.ca.json` (and `appsettings.in.json` for India) — read at runtime:

| Need | Key |
|---|---|
| Azure AI Search endpoint + key | `Search.ServiceEndpoint`, `Search.ApiKey` |
| Cosmos | `CosmosDb.ConnectionString` |
| Blob storage (the ORIGINAL uploads) | `AzureStorage.ConnectionString` |

Embeddings, for replaying the REAL hybrid query, live in
`C:\Nik\clinqetfuncations\Clinqet.Communications\appsettings.json` → `AzureAIFoundry.ApiUrl` / `.ApiKey` /
`.EmbeddingModel`; call `POST {ApiUrl}/openai/deployments/{EmbeddingModel}/embeddings?api-version=2024-10-21`.
‼️ **Write probe scripts to the session scratchpad, never inside a repo (§0.16), and never echo a secret
into a file.**

### Step 2 — the names
| Thing | Value |
|---|---|
| Search alias (what the app queries) | `private-knowledge-cell1-dev` → physical `private-knowledge-cell1-dev-v2` (both stamps; corrected 2026-09-25, P4-I-06 — `clinket-knowledge-dev-*` no longer exists). Read it from `GET /aliases` at api-version 2026-04-01 rather than trusting this row |
| ‼️ Search api-version | **`2026-04-01`** — an ALIAS 404s on `2024-07-01`; match the SDK or measure a lie |
| Blob container (original files) | `provider-knowledge` (`AzureStorage:Containers:ProviderKnowledge`) |
| Cosmos container (doc rows) | `KnowledgeBase-dev`, partition key **`/businessId`** (§0.6: always pass it) |
| Retrievable index fields | `id, businessId, docId, docName, docType, linkedServiceIds, linkedServiceNames, linkedGroupName, sectionTitle, content, contentCjk, docTitle, chunkKind, pageNumber, scripts, updatedAt, imageRef` (`KnowledgeSearchDocument`). ‼️ `hasEmbedding` and `contentVector` are HIDDEN and cannot be selected; `language`, `kind`, `sectionPath` do NOT exist — a bad `select` returns no `value` and looks like an outage |

### Step 3 — the harness (already written, keep it)
`C:\Nik\knowledge-table-hunt` — `bughunt.csproj` + `Program.cs`.
- `dotnet run -c Release --no-launch-profile` → **all 69 cases** (36 shapes + adversarial + the R7 group)
  with PASS/FAIL per group. **Run this before AND after any parser change.**
- `dotnet run -c Release --no-launch-profile -- --di <file>` → replay ONE real document (`.md`/`.txt` via
  layout-markdown, `.json` via the JSON path) through the real parser + chunker and print **the CARDS**.
  This is how you see what the index WOULD get, without deploying.
- To get DI's own markdown for a photo/PDF, call `prebuilt-layout` with `outputContentFormat=markdown` and
  save it as `.md`, then `--di` it. ‼️ **Delete that file afterwards — it is provider data.**

### Step 4 — the audit, and what each check is for
Fetch every card (`search=*`, `top=1000`, count) and group by `docName`. Then:

| Check | Pass condition | Why it exists |
|---|---|---|
| Cards per document, `updatedAt` | matches a recent ingest | ‼️ **A card count that does NOT move is not proof a re-parse failed** — a doc can yield the same count with different content |
| Every source record present | 100% | The real "nothing dropped" test. For a JSON catalogue, compare distinct `id:` values against the source file |
| Card size | ≤ `ChunkMaxTokens` (512) | ‼️ Sizes in CHARS ≈ 4× tokens — do not report a 4× "regression" that is a unit change |
| Markup / entities / blanks | 0 | `<table>`, `\|---\|`, `&amp;`, `\u003C`. ‼️ A real product code (`MS302 ** L3`) trips a naive `**` regex — LOOK at the match |
| Duplicate cards | 0 | Hash `sectionTitle + content`; TABLE cards dedupe section-scoped |
| `hasEmbedding` | 0 false | It is hidden, so COUNT it: `$filter=businessId eq '<id>' and hasEmbedding eq false`, `$top=0`, `$count=true`. A false one silently drops out of every hybrid query (the filter carries `hasEmbedding eq true`) |
| **Price-row anomalies** | 0 | For every `label \| value` line: the label must not repeat the value, and must not hold two values |
| **Retrieval** | right price on the TOP card | See Step 5 — this is the only check that reflects what a caller hears |

### Step 5 — ‼️ MEASURE THE HYBRID QUERY, NOT A BM25 CURL
A keyword-only `curl` **understates the product** and its artefacts read as live defects (this happened —
`blow dry` and `upper lips` "returned 0" and both actually resolve). The service issues BOTH legs:

```
POST /indexes/private-knowledge-cell1-dev/docs/search?api-version=2026-04-01
{ "search": "<query>", "top": 16, "count": true, "queryType": "simple", "searchMode": "any",
  "scoringProfile": "knowledgeRelevance",
  "searchFields": "content,contentCjk,sectionTitle,docTitle,linkedServiceNames,docType,linkedGroupName",
  "filter": "businessId eq '<id>' and hasEmbedding eq true",
  "vectorQueries": [{ "kind": "vector", "vector": <real embedding of the query>, "fields": "contentVector", "k": 16 }] }
```
‼️ Corrected 2026-09-25 (P4-I-06) to the query `ProviderKnowledgeSearchService` issues: the SEVEN `SearchFields`
(four of them missed every Chinese/Japanese card — `contentCjk` — and the header words), `top` and `k` both
`RetrievalTopK × RetrievalWindowFactor` (8 × 2 = 16), and **NO `vectorFilterMode`** — the private index is
exhaustive KNN (D-2 branch A), where pre/post-filter describes nothing.
Probe with real caller phrasings ("how much is a pedicure", "do you have any dozers") and assert the
expected value appears in the **top** card. ‼️ **A rising hit COUNT is not a win — open the documents.**

‼️‼️ **PROBE BOTH QUESTION SHAPES — LOOKUP *AND* BROWSE. THIS IS A MANDATORY CHECK.**
A LOOKUP ("how much is a pedicure", "do you have a TL1055C") wants one passage, and passages answer it well.
A BROWSE ("what excavators do you have", "how many machines", "what's your cheapest", "what do you sell")
wants **counts and ranges**, and passages answer it BADLY — the model receives 8 records out of 97 and has
nothing telling it that is a sample. **12/12 lookup probes passed green while this sat underneath**, because
every probe I wrote was a lookup. For each browse probe, assert the retrieved set can actually support a
complete-shaped answer (a summary/aggregate card present, or a count), not merely that a relevant card
returned. **Green on lookups is not evidence about browses.** Since D11b (2026-08-20) the DocSummary card
carries a COMPUTED inventory (sections/counts/ranges) — a browse probe should assert that card is IN the
retrieved set and that its figures answer the question.

### Step 6 — the report
Per document: source file (name, type, size) → cards produced → the checks above → any anomaly quoted with
its card. Then, for every anomaly: **what CLASS is it, what else is in that class, and is the fix structural?**

### ‼️ Traps that have each cost real time
- **`tee <file> | head -n`** SIGPIPEs and truncates the capture — it looked like 40 lost lines. Redirect, then read.
- **`dotnet test`/`build` MSB1009** is a WRONG-DIRECTORY error and counts as 1 in a `grep -c ": error"` gate.
- **A `[Theory]` row in a non-Latin script is worth more than ten English cases** — that is what found the
  combining-marks wrong price.
- **Sabotage every guard**, and if a sabotage PASSES the test is vacuous — that has happened five times here,
  including a fixture that had the `$2`/`$20` substring risk backwards and was testing nothing.

## RECENT CHANGES — 2026-08-18b (‼️ TABLE CORRECTNESS + `en.microsoft` on knowledge `content` + a GENERATED synonym map, SHIPPED)

> ‼️ **BREAKING INDEX CHANGE — `clinket-knowledge` was DROPPED and RECREATED in BOTH regions** (an analyzer
> cannot be retyped in place). The definitions are byte-identical CA↔IN (verified field-by-field). **Both
> knowledge indexes are EMPTY: every existing document must be deleted and re-uploaded**, and the stored
> card TEXT changes anyway — `Ready` rows do not heal themselves.

### ‼️ THE DEFECT: row 1 of a table became column labels, so a real price row was destroyed

`ResolveHeaders` accepted row 1 as a header unless it parsed as ALL-numeric. `$15`, `9:00`, `Model`,
`₹800` are not numeric, so **row 1 was consumed almost always** — its data lost, and a false label stamped
on every row beneath it. `HasHeaderRow` is only ever true for **HTML `<th>` and JSON keys**: Document
Intelligence markdown (every PDF and photo), `ReadDocxTable` and the XLSX reader ALL set it **false**, so
this hit the dominant provider upload path.

**Seen in the owner's own live data** (`gopi.jpeg`, read off the index before the rebuild):

```
Eyebrows: Upperlips | $7: $2                 <- Eyebrows costs $7. Upperlips costs $2. Both destroyed.
Chemical peels: 03 plus bridal facial | $80: $70
Half/full hands: Underarms | $10/15: $5
Full hands polish $30 Full back polish with $40 scrub and massage D-tan hands treatment $25   <- one blob
```

**The governing principle now, and it is the whole guarantee:**
> **A label attaches to a value only when the source DECLARED it, or when ≥2 columns PROVE it. Everything
> else emits plain `value | value`. Unlabelled truth over labelled fiction.** An unrecognised future shape
> loses a little richness; it can never quote a wrong price.

### The rules (`KnowledgeChunker` + `KnowledgeDocumentParser`) — all 28 sabotage-verified

| Rule | What |
|---|---|
| **R1 tiers** ‼️ | **Tier 1** the source DECLARED it — `<th>`, `<thead>`, JSON keys, the GFM delimiter row, `w:tblHeader`, `a:tblPr/@firstRow`, an XLSX table/autofilter/frozen-row, or a header the parser carried across a real page break (see **R8**). **Tier 3** undeclared ⇒ **NO LABELS**. ‼️ **There is no Tier 2 any more** — the shape-inference tier was DELETED because it broke this module's own guarantee by construction: a fragment opening on `Consultation \| free \| on request` is shape-identical to a genuine `Service \| Price \| Duration` header, and only vocabulary could separate them, which this file bans by design. Tightening it only made it invent less often. The one shape-keyed rung that survives is `IsCrossTabHeader` — an EMPTY column 0 in row 0, which is positive structural evidence a data row can never show (a data row always carries its identity there), guarded so a rowspan-carried `["","$30","$40"]` can never promote three PRICES into labels |
| **R2** | An **undeclared** single-row table is DATA. It used to be eaten as a header, leaving zero rows: "By appointment only" vanished with no card and no warning. A **declared** single-row table is still header-only and yields nothing |
| **R3** | A row under the header whose first cell is EMPTY and whose other cells are all non-data merges into compound labels — `Price (Short hair)`, `Duration (min)`. ‼️ **Guard: one data-shaped cell means it is a DATA row with a blank first column** (`["","with peel","$95"]`), and consuming it would delete a real price. Never consumes the only data row |
| **R4** | A row with ONLY its first cell filled is a section title or a footnote ⇒ a **bare line**, never `Service: * prices vary by length`. A group may not open or close between a section label and its rows. ‼️ **Guard: never on a single-column table**, where first-cell-only IS the data |
| **R5** | `SelfContainedLines` also accepts a **value-terminated** line: short, no terminal punctuation, ending in a **MEASURE**. ‼️ The tail must carry a currency symbol, `%`, `/-` or a short unit token — **merely ending in digits is what PROSE does** ("…serving this neighbourhood since 2019"). A token count alone is not enough: the live flyer line "Full back polish with scrub and massage $40" is EIGHT tokens |
| **R6** | GFM `\| … \|` pipe tables parse into a real Table with `HasHeaderRow = true` (Tier 1). Previously stored as RAW TEXT **including the `\| --- \|` row**. Paired `**`/`__`/`*`/`_`/backtick emphasis stripped — ‼️ **paired only** (a lone `*` is a footnote marker) and ‼️ **markdown path only** (in a `.txt` an asterisk is content). A `: definition` line joins its term, but never after a finished sentence |
| **R7** ‼️ | **THE FLATTENED TWO-COLUMN LAYOUT — the commonest shape a photographed price list arrives in.** When Document Intelligence cannot resolve two columns into a grid it emits **no table at all**: the label and its value become SEPARATE PARAGRAPH LINES, which the sentence packer then joined into one running blob (`Full hands polish $30 Full back polish with $40 scrub and massage …`) so a caller asking one price heard all of them. `PairLabelValueRuns` reconstructs the table from the line stream. **Runs on DI markdown, `.txt`/`.md`, DOCX and HTML** — every format that emits Paragraph blocks; a real `<table>`/`<w:tbl>` breaks the run, so structured documents are untouched. JSON/CSV/XLSX never reach it |
| **R7 layout repairs** ‼️ | **Two shapes where the source states a value TWICE or emits the columns SEPARATELY.** (a) **Inline echo** — `Hair cut $20` in the name column AND `$20` in the price column gave `Hair cut $20 \| $20`. The repeat **CONFIRMS where the name ends**, so the label is SPLIT there (`Hair cut \| $20`) — read from the document, never guessed. ‼️ Matching is **token-exact, never substring**: a label holding `$20` CONTAINS `$2`, and both are real prices on one live list. ‼️ And it must **split, not discard** — a one-cell row is read by R4 as a section LABEL and breaks the card there, fragmenting the price list (caught by the harness, not by reasoning). (b) **Column-MAJOR flattening** — both names then both prices, so every price lands one service late. The simple case is already refused (it can only ever yield ONE pair); a flyer with side-by-side blocks per section clears the minimum, so the signal is **a SECOND value arriving while the label directly above still has none**. ‼️ Two tighter discriminators were REJECTED for false-firing on a leading footnote line — **a guard that degrades working documents is worse than the gap it closes** |
| **R7 refusal fallback** ‼️‼️ | **A REFUSAL MUST KEEP THE LINE BOUNDARIES — and for three guards it did not.** "Refuse ⇒ verbatim" was FALSE: leaving the blocks as Paragraphs hands them to the sentence packer, which glues them into one running blob — `$25 Haircut $40 Colour $60 Perm` — **the exact defect R7 exists to remove**. Measured on all THREE refusal reasons (value-first, column-major, misaligned) before the fix. A refused run now becomes a **ONE-COLUMN table, one row per source line**: nothing paired, nothing glued, nothing dropped, and `ResolveTableLayout` cannot eat a row as a header because width < 3. ‼️ **"Cannot pair these" and "this is not a list" are DIFFERENT verdicts** — only the first keeps line boundaries; the min-pairs/share refusal still yields Paragraphs, because prose must keep its sentence chunking and overlap. ‼️ **I asserted "fails safe to verbatim" three times before measuring it** — a fallback path is a behaviour, so run it and look |
| **R7 guards** ‼️ | **Five, and each one closes a way to state a WRONG PRICE.** (1) A "value" needs a **currency symbol, `%`, `/-` or a short unit token** — so `289-887-8496` is never a price (`IsValueOnlyLine`; a **bare integer is not a value either**, so an inventory list of counts is not misread). (2) **≥2 pairs** — one is a coincidence. (3) Pairs must be **≥¼ of the run** — prose carrying a stray price stays prose, keeping its sentence chunking and overlap. (4) ‼️ **A run that OPENS with a bare value REFUSES** — that is a value-FIRST flattening (price column left of the service column) where pairing downward attaches every price to the NEXT service; the direction is unknowable from text, so it fails safe. (5) A **lowercase-initial** line is a wrapped continuation of the label above (capped, so it cannot grow without bound) — this is what puts `scrub and massage` back on its own service. **Anything unpaired survives VERBATIM as its own line: nothing is ever dropped** |
| **H1** | A blank first cell inherits the row above ("with peel $95" keeps its "Facial"). Blank rows are skipped BEFORE this so they cannot break the chain; a header row is never inherited from |
| **H2** | A data row identical to the header row is dropped (the OCR page-break repeat that read `Service: Service`) |
| **H3** | A blank header cell means the column is **UNLABELLED** — never an invented `col 3`, which stamps a POSITION onto a value as if it were its name |
| **H4** | A card with **no alphanumeric character at all** is dropped (`\|\|\| ~~~ ¤¤`). ImageCaption placeholders are exempt — they are deliberately empty until D26 fills them |
| **H5** | Duplicate header labels get a positional suffix (`Price (2)`) when no sub-header row disambiguates them |
| **R8** ‼️ | **A DECLARED HEADER ROW IS HONOURED IN EVERY FORMAT THAT CAN DECLARE ONE — added 2026-09-03.** R1 Tier 1 read `<th>`, JSON keys and the GFM delimiter row, and **nothing else**: DOCX/XLSX/PPTX hardcoded `HasHeaderRow = false`, so every office price list indexed unlabelled (`Haircut \| 25 \| 30 min`, nothing saying what 25 was). The declarations now read are **`w:tblHeader`** ("Repeat as header row"), **`a:tblPr/@firstRow`** ("Header Row"), an XLSX **table part / autofilter / frozen top row**, and HTML **`<thead>`** (which every spreadsheet-to-HTML exporter writes with `<td>` cells). ‼️ **Each is VETOED by `LooksLikeALabelRow`** — an author sets those on a TITLE row too, and labelling from `2026 Price List` states a price for an offering that does not exist. A label row holds **≥2 DIFFERENT** words and **no bare value**; anything else stays unlabelled, exactly as before. The veto is a refusal, never an inference — R1's guarantee is intact |
| **R9** ‼️ | **OOXML TEXT IS READ BY `KnowledgeOoxmlText`, NEVER BY `InnerText` — added 2026-09-03.** `InnerText` concatenates straight across every structural element, so `Gel manicure<w:br/>with polish` became the non-word `Gel manicurewith polish` and a **tab-aligned** Word price list became `Haircut$25`. This is the C4 defect (fixed for HTML table cells 2026-08-18) applied at last to its whole CLASS: Word paragraphs, Word cells, PowerPoint paragraphs, PowerPoint cells. The reader also removes three things `InnerText` wrongly includes — a tracked **deletion** (`w:del`/`w:delText`), a field **instruction** (`w:instrText`, e.g. a raw `HYPERLINK "…"` the agent would read aloud), and the second branch of an **`mc:AlternateContent`** (a text box's words arrived TWICE). ‼️ **The SDK gives NO type to anything inside `mc:Choice`** — a text box's own `w:p`/`w:r`/`w:t` all arrive as `OpenXmlUnknownElement`, so a purely typed walk reads a text box as EMPTY. Local names are read by the same rules. Iterative, so a hostile package cannot overflow the stack |
| **R10** ‼️ | **EXCEL RENDERS WHAT THE OWNER SEES, NOT THE SERIAL UNDERNEATH — added 2026-09-03 (`XlsxCellFormatter`).** A `$25.00` cell stores `25`; the `$` lives in the number FORMAT. So no price mark existed on any spreadsheet, **no draft service could ever be proposed from an .xlsx**, and a date read out as `45678`. Only the three formats that change a number's MEANING are rendered — currency, percentage, date/time; a plain number passes through byte for byte, so nothing that reads correctly today moves. ‼️ Excel serial 1 is 1900-01-01 while OLE day 1 is 1899-12-31, and both keep the phantom 1900-02-29 at serial 60: ≥61 line up, ≤59 are one day apart, 60 ships raw. ‼️ `m` is MONTH or MINUTE and only its neighbours say which. The shared-string table is materialised ONCE — `ElementAtOrDefault` per cell was O(cells × strings) |
| **R11** ‼️ | **A TEXT UPLOAD IS DECODED, NOT GUESSED — added 2026-09-03 (`KnowledgeTextDecoder`).** `.txt`/`.md`/`.json`/`.html` were read as `Encoding.UTF8.GetString`, in **THREE** call sites (ingest, the AI-setup reader, the analytics re-derive — so one document could be read two different ways in two lanes). Notepad's "Save as → Unicode" writes UTF-16 and every character came back with a NUL beside it; a Word/Excel "Save as Web Page" writes windows-1252 and every `£ € ½ – ’` became U+FFFD. Order is **BOM → BOM-less UTF-16 → strict UTF-8 → declared charset → windows-1252**. ‼️ **The UTF-16 test MUST precede the UTF-8 test**: ASCII in UTF-16 is `H\0a\0i\0…` and every one of those bytes is LEGAL UTF-8, so the strict decode succeeds and returns NUL-laced rubbish — a self-validating encoding cannot rule out the one that embeds it. windows-1252 is hand-rolled (27 code points) rather than adding `System.Text.Encoding.CodePages` |
| **R12** ‼️ | **DEPTH SAFETY — a page must not be able to KILL THE WORKER (added 2026-09-03).** 40,000 nested `<div>` overflowed the stack in `WalkHtml`, and a `StackOverflowException` **cannot be caught**: every fail-soft rung, the image lane's `catch`, `ParseSafely` — all bypassed, the worker dies with every other document, email and notification in flight, and the redelivered message kills the next one. ‼️ **Making only the TEXT walk iterative was NOT enough**: HtmlAgilityPack's own `Descendants()` is a NESTED ITERATOR (one MoveNext frame per level) and the picture sweep still crashed — proven by a second test AFTER the first fix. Every descendant sweep now goes through the iterative `DescendantElements`. ‼️ **A guard is vacuous unless it runs the REAL configuration**: the first version of this test passed only because it used `collectImages: false`, which the ingest never does |
| **R13** | **HTML inline elements no longer fragment a sentence (2026-09-03).** `<div>The deposit is <b>$50</b> per booking</div>` recursed into `<b>` and made THREE blocks out of one sentence, leaving the price in a block of its own with nothing around it to say what it was for. Text and inline elements now accumulate into one paragraph; a container holding a picture still recurses so the image is collected |
| **R14** ‼️ | **AN OFFICE PACKAGE IS A ZIP, SO THE UPLOAD CAP BOUNDS THE CONTAINER AND NOT THE PARSE — added 2026-09-03 (`OpenXmlPackageInspector`).** MEASURED: a heavy-formatting `.docx` at the 2.6 M character cap is **63.8 MB of uncompressed XML and expands 109×**, so a 30 MB upload can carry **390 MB–3.3 GB**, materialised as a DOM (another 5–10×) on a worker running several documents. Running out of memory kills the worker exactly as the uncatchable stack overflow does. ‼️ **The size comes from the ZIP CENTRAL DIRECTORY — no decompression at all** — which is what lets the refusal happen **before any Document Intelligence, vision or model spend**; a ceiling enforced after paying for extraction protects the worker and wastes the money anyway. Ceiling **128 MB** = 2× the worst legitimate document; live `.docx` measure 799–819 KB, a **160× margin**. Three call sites (ingest, analytics re-derive, `ProviderSetupDocumentReader`); media parts excluded (already bounded per image); no new localization key — `Error_KnowledgeTooManyCharacters` is accurate. ‼️ **Scope stated honestly**: this bounds an HONESTLY DECLARED size. A crafted package that under-declares its own part sizes still expands past the ceiling; that needs bounded streaming decompression |
| **R15** ‼️ | **HIDDEN IS NOT FOR THE AUDIENCE — added 2026-09-03, owner-ruled.** Hidden **sheets** were already skipped; hidden **rows and columns** were indexed. They are now skipped too. The decisive argument is that this material is not merely indexed, **it is SENT** — by WhatsApp and by email via `send_material_info` — and a hidden column is usually a supplier cost, a margin, an internal code or a superseded price. The harm is one-directional: skipping a useful hidden note is recoverable (unhide, reprocess), emailing a supplier's cost to a customer is not. Removed **by absolute source index, descending, AFTER the row is padded**, so every row loses the same columns and the grid stays aligned. No counter — matching the hidden-sheet precedent, because this is a documented policy and not an unexpected loss |
| **R16** ‼️ | **A DECLARED CHARSET IS SCANNED WITH NUL BYTES DROPPED — added 2026-09-03, found by sabotage.** `DeclaredEncoding` read the document head as single-byte text, but **in a UTF-16 document every letter of `<meta charset=…>` carries a NUL beside it**, so `<meta` never matched and the branch could never fire — on the one case it exists for. The NUL heuristic (R11) only sees UTF-16 in **LATIN** text: Gujarati, Devanagari and every other script we support have a NON-ZERO high byte, so a page whose non-Latin content outweighs its markup carries almost no NUL and the heuristic goes silent. The declaration is then the only thing that can decode it. ‼️ And `iso-8859-1` is deliberately **NOT** honoured literally — 0x80–0x9F are C1 controls in Latin-1 and the curly quotes and dashes a real page actually uses in cp1252, so every browser decodes it as windows-1252 and so does our fallback; the literal mapping was strictly worse than doing nothing |
| **R17** | **Markdown SETEXT headings are headings (2026-09-03).** `Title` over `=====` is as common as `#` in a hand-written `.md`; unrecognised, the heading became body text carrying `------------` and its whole section lost its path. Three guards, and ‼️ the load-bearing one: **a line carrying a MEASURE is never promoted** — a heading emits no card of its own, so reading `Total: $500` as one would DELETE that price from the body and leave it only in the section path. The buffer must also hold exactly ONE line, so a horizontal rule can never promote a paragraph's last line |
| **R18** ‼️ | **THE UPLOAD SIZE IS THE ONE THE BLOB ACTUALLY HOLDS — added 2026-09-04.** Every size check read `file.FileSize` out of the REQUEST BODY, and a blob SAS cannot cap what is written through it, so a caller could declare 2 MB, upload 3 GB, and the worker would buffer the whole blob into memory. Confirmation now reads the real `ContentLength`, and the ingest re-checks it against `MaxFileSizeBytes` **before a single byte is buffered** — the worker never trusts a gate it does not own. ‼️ Without this, R14's 128 MB expansion gate is unreachable: a 3 GB upload OOMs before the ZIP directory is ever read |
| **R19** ‼️ | **A PER-IMAGE CAP IS NOT A PER-DOCUMENT CAP — added 2026-09-04.** `MaxSourceImageBytes` bounds ONE picture at 64 MB, but an Office package can hold hundreds — each under the cap, GIGABYTES together — and `MaxImagesPerDocument` (300 since 2026-09-29; 40 when written) is applied only AFTER the parser has materialised every candidate. `MaxTotalMediaBytes` (256 MB, 8× the whole upload limit) bounds the document. ‼️ The parser is a **SINGLETON**, so the running total is derived from the per-parse list and never held in a field — an instance counter would leak across concurrent documents and across BUSINESSES |
| **R20** ‼️ | **EXCEL MERGED CELLS EXPAND, AND A FORMULA NEVER LEAKS ITS SOURCE — added 2026-09-04.** A merged cell stores its value ONLY in the top-left cell, so a merged section header ("HAIRCUTS" over A5:A10) reached the chunker as one value and a column of blanks — every other reader in this file expands spans (§7.8b case 14) and XLSX was the one that did not. Separately, `cell.InnerText` was the fallback when `CellValue` was absent, which on a formula cell whose cached result was never written returns the FORMULA SOURCE — the sheet would speak "SUM(B2:B10)" to a caller as a price, directly contradicting the comment above it |
| **R21** ‼️ | **WORD: NOTES ARE CONTENT, HEADERS ARE NOT, AND A STYLE CHAIN IS A HEADING — added 2026-09-04.** Footnotes and endnotes are read: the author wrote each once, and a price list's conditions ("* evening rate", "prices exclude VAT") live there. ‼️ Headers and footers stay EXCLUDED — they are one line repeated on every page and the PDF lane strips exactly that as furniture, so reading them would put sixty copies of a phone number in the index and make the two lanes disagree (owner-ruled). And `basedOn` chains are now walked with a visited set: a custom style ("Section Title") based on Heading 2 IS a heading, which is how every branded Word template is built |
| **R22** ‼️ | **POWERPOINT READS IN VISUAL ORDER, AND A BACKDROP IS ONLY A BACKDROP WITH SOMETHING IN FRONT — added 2026-09-04.** File order is the order shapes were CREATED; on a hand-built price list (dragged text boxes) that is arbitrary and a price lands away from the service it names. Shapes now sort by position (row band 228,600 EMU ≈ ¼ inch, then left to right). ‼️ **Reordering only fires when EVERY orderable shape carries an explicit offset** — a placeholder inherits its position and has none, so a normally-built deck is never touched. ‼️ **The gate must skip `nvGrpSpPr`/`grpSpPr`**: a shape tree always opens with those two property elements, which carry no offset, so testing every child made the gate bail on EVERY slide and the feature could never fire — caught by the first fixture that exercised it, NOT by eight real decks that all looked "unchanged" for the wrong reason. Separately a full-slide picture is dropped as a backdrop **only when the slide also has text**: ‼️ live data proved the size-only rule wrong — `Dwij.pptx` is 41 slides, each a single full-slide photo with no text, an ALBUM, and a size-only rule deletes all 41 |
| **R23** | **A JPEG COMMENT IS METADATA THIS LADDER PROMISES TO STRIP (2026-09-04).** The byte-for-byte passthrough returns the ORIGINAL bytes, so a COM segment survived into storage and into every WhatsApp and email send. ImageSharp 3.1.12 exposes no comment API, so the segment header is read from the bytes directly — the scan stops at the first scan header and never walks compressed data. The GPS guarantee was never at risk (that is EXIF, checked since the beginning) |
| **R24** | **A data: URI is bounded BEFORE decoding (2026-09-04).** Base64 costs 3 bytes for every 4 characters and the character length is free to read, so an over-size embedded image now costs nothing at all. Every other image source in the pipeline was already capped; this was the one that decoded whatever it was handed |
| **R25** ‼️ | **RETRIEVED KNOWLEDGE IS QUOTED DATA, NEVER AN INSTRUCTION — added 2026-09-04.** Providers routinely upload documents they did not write (a supplier's catalogue, a manufacturer's spec sheet, an insurer's policy), and without this a sentence inside one is read as an instruction from the owner. Business Search has carried this rule since it shipped (its rule 8); the VOICE prompt — the lane a stranger can dial into — did not |
| **R26** ‼️ | **A DOCUMENT IS QUIET UNTIL IT IS READY, AND A MATERIAL HANDLE NAMES WORDS RATHER THAN A POSITION — added 2026-09-04.** A document mid-reprocess could be retrieved and read to a caller from half an index. One `KnowledgeAnswerableRule` is now the single gate on retrieval, used by Cosmos and by search alike, and its SQL stays **index-only** (`status` is in the indexing policy; `passageCount` is NOT, so never filter or sort on that). Separately a ref was `{docId}:{chunkNo}` — a POSITION — so between the model reading a passage and the caller asking for it to be sent, a reprocess could re-cut the document and chunk 3 could be different words entirely: the caller was sent something nobody had read out. The ref now carries an **8-hex fingerprint of the stored content** (`{docId}:{chunkNo}:{fp}`), and the send REFUSES a piece whose words changed rather than sending the substitute. ‼️ The fingerprint is over the **stored** content on both sides, never the sanitized display value, or the two ends would never agree. ‼️ A malformed third segment is a malformed handle, never "no fingerprint supplied" — the fallback direction matters, because the permissive reading silently restores the defect. MEASURED on live data: 843 cards, **0 cross-card fingerprint clashes** |
| **R27** ‼️ | **A PER-CALL SEND CAP IS ONLY A CAP IF THE SLOT IS TAKEN INSIDE THE CAS — added 2026-09-04.** Both send tools counted the markers, sent, then wrote the marker, so two overlapping tool calls read the same count and both sent, and a marker-write failure forgot a send entirely. The slot is now RESERVED inside the ETag-guarded mutation that checks the cap, PROMOTED once the send is away, and RELEASED if it fails — one shared `VoiceSendSlotWriter` for `send_material_info` and `send_service_info`, so the two caps cannot drift apart. A marker still holding its reservation **counts against the cap and never becomes a Call Follow-ups card**: a consumed slot is invisible, where a card claiming material was sent when it never left is a lie the provider acts on. ‼️ A reservation that cannot be WRITTEN is deliberately not a refusal — turning a caller away because our own bookkeeping hiccuped is worse, so the send goes and the admin is alerted that the cap now under-counts. ‼️ **The compensating release must NOT take the request's token.** The commonest reason to land there is the caller hanging up, which cancels it — and a rollback on a cancelled token throws before undoing anything, leaking the slot AND replacing the original failure with its own. ‼️ `MaxConcurrentToolCallsPerBusiness` (4) refuses the fifth concurrent tool call before it reads the session, so a fan-out test above 4 hangs |
| **R28** ‼️ | **A REPAIR MUST BE ABLE TO REDO THE INTERPRETATION, NOT JUST THE PARSE — added 2026-09-04.** Two caches make a reprocess replay an earlier run's judgement: the banked extraction artefact, and the business-wide caption reuse keyed on a picture's BYTES. Both are correct for cost, and together they made a corrected caption prompt or model **unreachable for every picture already described** — the fix deploys, the operator reprocesses, and nothing changes. `KnowledgeIngestQueueMessage.ForceFresh` (off by default) bypasses BOTH, exposed as `?forceFresh=true` on the two admin repair endpoints. ‼️ A provider's own reprocess and every upload pass `false` **explicitly, not by default**, so re-describing a whole document is never paid for by accident; the interface parameter is deliberately non-optional so each call site states its intent. ‼️ If a third cache is ever added it must honour this flag too, or the switch quietly stops meaning what it says. The automatic half — invalidating a caption when the PROMPT changes — needs a per-caption lineage field and is an open schema decision |
| **R29** ‼️ | **A COUNT PROVES A CARD EXISTS, NEVER THAT IT SAYS THE RIGHT THING — added 2026-09-04.** Index health compared a stored `passageCount` with a live count and nothing else, so a superseded FAQ, a metadata change that landed on some cards and not others, and one document carrying two ingest generations were all invisible. The report now also carries **content drift** over the cards themselves. ‼️ **Reverse containment**: an oversized answer is SPLIT across several cards, each repeating the question, so asking whether one card holds the WHOLE answer accuses every long FAQ — a health report that accuses a healthy document sends an admin re-ingesting a catalogue for nothing. Asking instead whether the SAVED answer still holds each indexed fragment survives both shapes, and whitespace is collapsed because the chunker joins sentences with a single space where the saved text holds newlines. A body with no `A:` marker is reported as an earlier generation rather than skipped. ‼️ **A wrong vector of the right length is NOT detectable here** — that needs a re-embed to compare against, which a diagnostic must not spend — so it is deliberately not claimed. Admin-only surface, so the reason is plain English by design. Separately the document cap is re-checked **at confirm against a live count**, because the check made when the upload URL was minted is minutes stale; ‼️ a row already carrying THIS blob is our own earlier attempt and is EXEMPT, or at the boundary the retry that the confirm exists to allow becomes a limit refusal and a registered document is unconfirmable. MEASURED: 54 live documents, **0 falsely accused** |
| **R30** ‼️ | **THE TWO PER-CALL SEND ALLOWANCES ARE INDEPENDENT, AND A DOCUMENT BEING DELETED HOLDS NO SLOT — added 2026-09-04, owner-ruled.** Both send tools write a `SharedDetails` marker and only the material one carried a `kind`, so `CountShares` counted material sends too: a caller sent their two pieces of material could then be sent **no page link at all**, even though `MaxMaterialSendsPerCall` and `MaxSharesPerCall` are separate settings and two allowances were plainly intended. The kind now lives in the shared `VoiceSendSlot` contract (`material` / `page`) and each counter matches **its own**. ‼️ Guarded from **BOTH** directions AND at the boundary — a counter that is too GENEROUS is the other way to get this wrong, and "the allowances are independent" would otherwise be satisfied by never counting at all. No frontend reads `payload.kind` (checked in both partner apps), so the added key is inert for the UI. Separately the document-cap count now excludes `Deleting` rows: deletion is asynchronous and the provider's own list already hides such a row, so counting it told them they were full while their screen showed room — at the one moment they were trying to make room. ‼️ Pinned by a **SQL SHAPE test** on `KnowledgeDocumentRepository.CountSql`, not by behaviour, because the emulator is more permissive than production about what an index-only count may filter on; `status` IS in the indexing policy so the count stays index-only. MEASURED live: **0 `Deleting` rows in either region and old count == new count for every business**, so the trap is removed without moving anybody's ceiling |

- **Shape classifier** is language-neutral by construction: digits PLUS a symbol or a short separate unit
  token, so `₹800`, `$800`, `1,50 €`, `800/-`, `50%`, `30 min`, `52 ft` all classify alike and a Gujarati
  price list behaves exactly like an English one. ‼️ An alphanumeric CODE (`336EL`, `C7.1`) reads as
  **TEXT** deliberately — a false header is the bug being fixed, so the classifier errs that way.
- ‼️ **Dedupe is now section-scoped for TABLE cards only.** Repeated boilerplate is PROSE and still
  collapses across sections (case 19), but two sections of one price list can legitimately hold the same
  rows ("Upper lips $2" under both THREADING and WAXING) and those cards are NOT duplicates — each carries
  a different section in its prefix, so they embed differently. Unlabelled rows collide far more often.
- **Harness**: `C:\Nik\knowledge-table-hunt\` drives the REAL chunker + parser over **59 cases** —
  23 broken shapes, 16 already-correct, 13 adversarial, DOCX + XLSX fixtures, and 5 cards lifted verbatim
  from the live `gopi.jpeg`. **20/59 before the fix, 59/59 after.**

### ‼️ What the harness found that the plan had wrong

- The plan listed **20** broken shapes; the real number is **24**. "heading-then-table prefixing" was on
  the ALREADY-CORRECT list — its prefix is right, but its ROWS were corrupted by the same header bug.
  **A shape checked only at the prefix looks fine while its data is destroyed.**

### Index changes (`cosmosindexsetup`)

- ‼️ **`content` → `en.microsoft`.** `standard.lucene` does NO stemming, so `dozer` matched **0 of 31**
  live cards saying "Dozers". **Measured live after the rebuild: 0 → 2 of 2 probe cards.** Every OTHER
  searchable field stays `standard.lucene` — the approved change is scoped to `content`, where the prose is.
- **A semantic configuration** (`knowledge-semantic-config`) is now declared. Naming a configuration the
  index does not declare is a query-time ERROR, not a silent fallback, so the capability must exist even
  though `Voice:Knowledge:SemanticRankerEnabled` ships **false** (measured 88.5% → 83.6% — it HURT).
- `KnowledgeSearchIndexInitializer.BuildIndex()` is separated from the publish so the whole definition is
  assertable at build time.

### ‼️ THE GENERATED SYNONYM MAP — `CategorySynonymGenerator`, and why there are TWO maps

- ‼️ **The services map is NOT reused for knowledge.** `clinket-synonyms` is **719 hand-curated marketplace
  lines** that already include semantic equivalences between DIFFERENT offerings (`taxi, cab`,
  `ac, air conditioning`) — the exact class measured corrupting **18 real knowledge cards**. Knowledge gets
  its own `clinket-knowledge-synonyms`.
- ‼️ **THE KNOWLEDGE MAP IS DERIVED FROM THE CURATED FILE, NOT MAINTAINED BESIDE IT.** It is the generated
  catalogue block **plus the spacing-variant half of the curated file**, extracted by
  `CategorySynonymGenerator.ExtractSpacingVariantGroups` — group each curated line's terms by their LETTERS,
  keep any group with ≥2 spellings, discard the rest. `haircut, hair cut, hair trim, hair styling` keeps
  `hair cut, haircut` and drops `hair trim`/`hair styling`; `taxi, cab` and `landscaping, gardening` can
  never survive, because different concepts are spelled with different letters.
- ‼️ **THIS FIXED A REAL MISS AND ENDED A REAL DRIFT.** Two maps hand-maintained separately meant the
  curated `haircut, hair cut` never reached knowledge, so a caller saying "haircut" scored **0** on the
  keyword leg against a card reading "Hair cut" (same for `blow dry`/"blowdry", `upper lips`/"Upperlips" —
  all three on one real provider's price list). Deriving one map from the other makes re-drift impossible.
- **Live: knowledge 350 rules (171 generated + 179 curated-spacing), services 890 (719 curated + 171
  generated), identical in both regions.**
- **Five stages, no human judgement in the loop**: enumerate the LIVE catalogue (partition-scoped, pk =
  `global`) + every distinct service name on the services index (ordered `serviceId asc` paging, never
  facets) → generate → **analyze-verify against the LIVE analyzer** → collision-screen → report the funnel.
- **Only two rule families, and a rule only ever relates two forms of ONE name.** That single constraint is
  what makes cross-concept corruption structurally impossible: linking two DIFFERENT names would require
  knowing what words MEAN, and no rule here knows meaning.
- ‼️‼️ **ONLY SPACING SHIPS. THE WHOLE AGENT/ACTIVITY MORPHOLOGY FAMILY IS OFF** —
  `Search:IncludeAgentActivitySynonyms` = **false**, build-pinned by `SynonymSafetyGateTests`. It was built,
  screened, narrowed twice, and then switched off on live evidence: **`pet sitter` returned 39 FORKLIFTS**,
  because `sitter => sitting` and the word "sitting" appears in forklift text. The domain screen dropped 31
  of 59 such rules, and that was still not enough — because the screen can only test the ACTIVITY side
  against **today's** corpus. **The TRIGGER side is the unscreenable half:** `parker` is a hydraulics BRAND,
  `planner` is a stationery PRODUCT, `cutter` is a plasma cutter — and which meaning wins depends on
  providers who have not signed up yet. A global synonym map rewrites every query for every provider, so a
  rule that is safe today and wrong next month is not acceptable at any measured gain.
- ‼️ **THE SURVIVING RULE FAMILY IS SAFE BY IDENTITY, NOT BY SCREENING.** Every shipped rule relates
  spellings **with the same letters** (`hair cut ≡ haircut`, `air-conditioning ≡ airconditioning`). Two
  spellings with the same letters are the same word — that is not a heuristic, and it means a rule
  **cannot** substitute one offering for another. **Verified against the LIVE maps: all 350 knowledge rules
  are identity groups, 0 semantic; shortest term 4 chars.** This is the answer to "can a synonym return the
  wrong data" — structurally no, for all 350, not for a sample.
- **What the evidence killed, in order**: `-er → -ing` wholesale (`breaker≡breaking`, `dryer≡drying`,
  `toner≡toning`, `career≡careing`, `upper≡upping`); `-eer` (junk only); then the domain screen; then the
  family. **Bare stems are never generated. ZERO two-letter codes by construction** — minimum term length
  is 4, so ON/IN/OR/HP/CA can never enter and no exclusion list ever has to be complete.
- ‼️ **A homograph screen that can only see TODAY's data is not a safety property.** This is the general
  lesson: when a rule's safety depends on corpus content, and the corpus is user-supplied and unbounded,
  the rule needs a safety argument that holds **without** looking at the corpus — or it does not ship.
- ‼️ **The collision screen indexes catalogue WORDS, not just whole names.** "Sewing" derives "sewer", and
  "sewer" is a word inside "Sewer Line Repair" — a plumbing drain silently equated with tailoring.
- **Funnel**: **40 categories + 300 subcategories = 340 enumerated (= N)**, proved by an independent
  partition-scoped `SELECT VALUE COUNT(1)` that **throws** on mismatch — the coverage claim is never the
  generator's own bookkeeping. Of 340: multi-word names yield a spacing variant, single-word names yield
  nothing, and the screen rejects short/stopword/duplicate forms ⇒ **171 shipped**. With the agent family
  off the funnel is identical in **both regions** (it no longer reads any per-region corpus), which is why
  the maps are now byte-identical CA↔IN rather than "different by design".
- **`Search:AttachGeneratedSynonymsToServices` ships TRUE**, and the isolated live gate is what earned it:
  every one of the 171 is an identity group, so the services map's **semantic-rule count is unchanged at
  exactly the curated file's 716** — measured against the live map, not assumed. The generated block cannot
  add a meaning claim to live customer search because it contains none.

### Query side (`ProviderKnowledgeSearchService`)

- **§7.7 partial-code wildcard**: a token that MIXES letters and digits, 4–12 chars, max 3 per query, gets
  a lowercase trailing `*`. **Measured live: `tl1255` → 0 hits, `tl1255*` → 1.** ‼️ Ordinary words are never
  wildcarded — prefix-matching prose is how precision dies.
- **§7.6 English query**: the §7.10 prompt block and the tool's `query` description now say to write the
  search in ENGLISH while copying names, brands and product codes VERBATIM, and to keep speaking to the
  caller in their language (measured 40% → 87% on the Hindi-caller path).

### ‼️ THE FULL MULTI-DIMENSIONAL AUDIT — 9 defects found in my OWN code, all fixed

Every one of these was found by reading the finished diff end to end, not by a test failing.

| # | Dimension | Defect | Why it mattered |
|---|---|---|---|
| 1 | **Output quality** | `UndoDoubling` produced the WRONG agent noun: `cutting`→`cuter`, `sitting`→`siter`, `planning`→`planer` | Misspellings match nothing, so the pair was dead — and a "planer" is a woodworking TOOL, a different concept. The doubling in the `-ing` form IS the signal and is now kept: `cutter`, `sitter`, `planner`, `swimmer`, `babysitter`. **Live proof: `hair cutter` → 116 hits returning Hair Cut.** ‼️ Two other forms this fix enabled (`sitter`, `planner`) later proved to be WRONG results and were removed by the domain screen — see defect 10. |
| 2 | **Logic / flow** | The generator ran BEFORE the services index was created, but READS that index (names + the live `analyze` verdict) | On a fresh stamp the tool could never bootstrap: the index it needs is the one it has not built yet. It now runs after the services index and before the knowledge map |
| 3 | **The unexpected** | The coverage proof was VACUOUS — "enumerated == categories + subcategories" is true by construction | It could never notice a dropped Cosmos continuation page, the one failure it exists to catch. It now compares against an **independent `SELECT VALUE COUNT(1)`** and THROWS on a mismatch. Same for the service-name walk vs `@odata.count` |
| 4 | **Output quality** | Semantic ranking + the partial-code wildcard **conflict**: Azure rejects wildcards in a semantic query | Two separately-approved features that would 400 every call the moment the flag was turned on, degrading to "the material could not be checked". The wildcard is now suppressed when the ranker is on |
| 5 | **Output quality** | The per-word stoplist rejected SPACING variants of any name containing a stoplisted word | "Personal Training" lost `personaltraining` for containing "training" — a safe orthographic variant killed by a rule that exists to stop DERIVED forms. The per-word check is now morphology-only; it recovered `personaltraining`, `powertools`, `sportscoaching`, `partyrentals`, `partymakeup` |
| 6 | **The unexpected** | The generated map was **non-deterministic**: a `HashSet` decided which form represents each token class | A build-time artifact that differs run to run cannot be reviewed or diffed, and would show as phantom CA↔IN drift. Forms are now iterated sorted |
| 7 | **Performance / resilience** | ~900 deploy-time HTTP calls with no retry | One transient 503 or a 429 aborted a whole region's map. Bounded retry (4 attempts) honouring `Retry-After`; a request that never succeeds still THROWS, because a partial map is a silently weaker one |
| 8 | **Output quality** | H1 carried the last service name ACROSS a section label | A blank first cell under "WAXING" inherited the previous section's service — a price attached to the wrong offering, the exact class this change exists to remove |
| 9 | **Logic / flow** | Cross-section dedupe could drop a legitimate card, and a `$skip` ceiling break reported partial coverage as full | Table cards are section-scoped now (prose still collapses across sections, case 19 intact); the `$skip` ceiling throws |

**Also swept and clean**: every yield site walked; H4 verified against Devanagari/Arabic/CJK/digit-only bodies; the ceiling re-proved for R3's LONGER compound labels; a **10,000-row** undeclared table proved to keep all 10,000 rows with every card inside the ceiling; no static mutable state anywhere (the chunker stays pure); `HttpClient` disposed, `CosmosClient` deliberately not (caller-owned); no control bytes in any touched file.

**Considered and deliberately NOT changed** (recorded so it is not re-litigated): sampling the first N rows for shape inference (an unrepresentative head would change the verdict — the full scan is milliseconds against an embedding call); dropping the `-or` agent suffix (it yields `contractor`, and the junk forms are provably inert); a table whose every row is first-cell-only still emits its content (dropping it would lose real data); a malformed GFM table with mismatched cell counts stays text rather than being guessed at.

### ‼️‼️ DEFECT 10 — THE ONE THAT ACTUALLY RETURNED WRONG DATA, and the screen that closes it

A one-way rule expands the agent noun INTO the activity noun. If that activity noun is a **homograph in
real content**, the agent query inherits documents that have nothing to do with the offering.

**Measured live, on the published map**: "Pet Sitting" derived `sitter => sitter, sitting`, and "sitting"
appears in FORKLIFT descriptions (the operator's seated position) — so **`pet sitter` returned 39 forklifts**.
`groomer` returned 90 eyebrow-threading rows; `cleaner` pulled 46 salon rows that only mention "cleansing".
‼️ **This was reported as a WIN in the first pass of this document. It was a wrong result.** The hit COUNT
went up, and a count going up was mistaken for the feature working — the documents themselves were never
looked at until the owner asked whether the map could return incorrect data.

**Neither orthographic screen could see it**: the collision is not between two catalogue NAMES, it is
between one catalogue name and unrelated CORPUS TEXT.

**THE DOMAIN SCREEN** — corpus-relative, still no semantics: the activity word must reach at least one
`categoryName` that the offering's own NAME reaches. Reaches only OTHER categories ⇒ homograph here ⇒ the
rule is DROPPED. Reaches nothing ⇒ inert and harmless ⇒ kept (that is the caller-vocabulary case).
It dropped **31 of 59** one-way rules on this corpus, every wrong-result producer among them:
`sitter`, `cleaner`, `groomer`, `mover`, `lighter`, `landscaper`, `driver`, `builder`, `framer`, `packer`…
`cutter => cutting` SURVIVED, because both live in Salon & Beauty — and `hair cutter` correctly returns
`Hair Cut`. **After: `pet sitter` 39 → 0, `groomer` 90 → 0, `cleaner` 58 → its own 12.**

‼️ **The map is now CORPUS-DEPENDENT by design.** Most trades have no services in this dev corpus, so their
rules are dropped today; as real providers onboard, the activity word starts reaching its own category and
the next run brings the rule back. That is the screen working, not drift — but it does mean **the generated
block must be regenerated after significant onboarding**, and the CA/IN knowledge maps legitimately differ
(271 vs 275) because each reflects its own corpus. The services map is file-driven and **919 in both**.

### ‼️ EXHAUSTIVE VERIFICATION — every shipped entry, not a sample

The owner's bar was "compare against ALL the categories and subcategories". Every one of the 271 shipped
entries was probed individually: for each expansion target, the set of `categoryName` values it reaches was
compared with the set its source name reaches. **Result: 0 entries reach only foreign categories.** A
38-query sample had missed the `pet sitter` defect entirely, because the defective query was not in it.

### The generated block lives in its OWN file

`cosmosindexsetup/synonyms-generated.txt` — **171 catalogue entries**, registered in the `.csproj` with
`CopyToOutputDirectory`. ‼️ **Without that csproj entry the file is not copied to the output directory, the
loader finds nothing, and the services map ships 171 rules lighter — silently.** With
`AttachGeneratedSynonymsToServices` true and the file missing, the run now THROWS rather than shipping a
quietly weaker map.

- Curated `synonyms.txt` stays purely human; the generated file is never hand-edited. Neither can clobber
  the other, and turning the whole block off is one setting.
- Refresh with `--write-generated-synonyms`, which rewrites the file AND republishes the services map in
  the same run, so the file and the service can never disagree.
- `GeneratedSynonymsFileTests` pins the committed artifact: not empty, no term under 4 characters (so zero
  two-letter codes by construction), every one-way rule repeats its triggers on the right-hand side, no bare
  stem inside a rule, well-formed Solr syntax. **All four sabotage-verified against a deliberately corrupted file.**

### The generated block now ALSO ships on the services index (owner-directed)

The **171 catalogue-derived entries** ship on the services map too, from `synonyms-generated.txt` (a separate
file at the owner's direction, so the curated list stays purely human and the cosmos-setup project has one
place to look). **Provider SERVICE-NAME entries are deliberately NOT generated at all** —
`Search:IncludeProviderServiceNames` = **false**, build-pinned: a provider's own words are one business's
text and belong in that document's AI-enriched fields, which are business-scoped; and reading them cannot
scale past Azure's 100,000-document `$skip` ceiling anyway.

- **Services map: 890 rules (719 curated + 171 generated), byte-identical in both regions**, file-driven.
- **Knowledge map: 350 (171 generated + 179 curated-spacing), byte-identical in both regions.**
- ‼️ **THE SAFETY GATE THAT ACTUALLY SETTLES IT** — not a query sample, a structural property. Strip every
  non-alphanumeric from each term of each LIVE rule and count distinct results: **1 ⇒ identity group,
  incapable of substituting one offering for another.** Knowledge: **350/350 identity, 0 semantic.** Services:
  **716 semantic — exactly the curated file's own 716**, so the generated block added none. Shortest generated
  term 4 chars. ‼️ **A 38-query sample had previously missed the `pet sitter`/forklift defect entirely**,
  because the defective query was not in it — which is why the gate is now a property over all rules, not a
  measurement over chosen queries.
- ‼️ **A snapshot in a file cannot self-update.** A category added later is NOT covered until the block is
  regenerated: re-run `--synonyms-only --write-generated-synonyms`, which rewrites the file AND republishes
  in the same run so file and service can never disagree.

### ‼️ Traps this adds to the permanent list

- ‼️ **Index ALIASES resolve only at a recent api-version.** The knowledge alias (then `clinket-knowledge-dev`, now `private-knowledge-cell1-dev`) 404s at
  `api-version=2024-07-01` and works at `2026-04-01` (what SDK 12.0.0 sends). A curl probe at an old
  api-version reports a live outage that does not exist — **match the SDK's api-version or measure a lie.**
- ‼️ **An index cannot be deleted while an alias points at it** (HTTP 400). Delete the alias first; the
  tool recreates both, idempotently.
- ‼️ **A fail-soft analyze call reported a total outage as a clean result.** With the wrong index name every
  `analyze` returned 404, the helper swallowed it, and all 298 candidate sets were reported "already bridged
  by the analyzer" — a 100% failure printed as an empty, healthy funnel. It THROWS now.
- ‼️ **A measurement harness can have the same hole.** The gate filtered report lines by their label and a
  label rename silently excluded the 15 riskiest entries — the gate measured the map MINUS the only rows
  that could do harm.
- ‼️ **A `Contains` assertion cannot see an empty label.** `": Facial | Small: $30"` CONTAINS
  `"Facial | Small: $30"`, so the first H3 guard passed against deliberately broken code. Sabotage found it;
  the rebuilt test compares the whole body exactly.
- ‼️ **A NUL byte reached a source file through an editing round-trip** and made it BINARY to grep. Check
  `[...bytes].filter(b => b < 32 && b !== 9 && b !== 10 && b !== 13)` after any programmatic edit.
- ‼️‼️ **A BM25-ONLY CURL IS NOT THE PRODUCT'S RETRIEVAL PATH — it understates it, and I reported its
  artefacts as live defects.** `blow dry` and `upper lips` "returning 0" were **curl** results; the real
  path is HYBRID (BM25 **+ vector RRF**), and replaying it with a REAL embedding from the Functions
  `AzureAIFoundry` config returned **10 hits with the right card on top for every one of them**. The vector
  leg carries spelling variants the keyword leg cannot. **Measure the composed query the service actually
  issues** (`search` + `vectorQueries` + the `businessId` filter, and since D-2 NO `vectorFilterMode` on the private knowledge index — the Step 5 body) or the
  measurement is about a query nobody makes. The synonym fix is still correct — it repairs the KEYWORD leg,
  which is what carries exact price lookups — but the severity was mine, not the product's.
- ‼️ **`dotnet test` MSB1009 is a WRONG-DIRECTORY error, not a broken project**, and it counts as one
  "error" in a `grep -c` gate — so a build-check pipeline can report a failure that is purely a `cd`.
  It happened three times this programme; run from the repo that owns the `.csproj`.
- ‼️‼️ **`char.IsLetter` IS FALSE FOR DEVANAGARI / TAMIL / ARABIC VOWEL SIGNS — they are combining MARKS.**
  An "is this token all letters?" test therefore never reached the `length > 4 ⇒ not a unit` guard for a
  non-Latin word, so **`मैनीक्योर ₹300` classified as a bare VALUE** — which attached मैनीक्योर's ₹300 to
  फेशियल above it as a second column and lost मैनीक्योर as a service entirely. **A WRONG PRICE on every
  non-Latin script, and India is a live region.** An English price list was never exposed to it, so no
  English test could find it — the Devanagari row of a `[Theory]` did. **A word is "has a letter and no
  digit", never "all letters"** (`IsWordToken`). Anywhere script-neutrality is claimed, check the marks.
- ‼️ **`HasHeaderRow` is FALSE for DOCX and XLSX as well as DI** — an assertion that a real Word table
  "declares" its header fails against correct code. Only `<th>`, JSON keys and a GFM delimiter row declare.

## RECENT CHANGES — 2026-08-18 (‼️ MANY OFFERINGS PER KNOWLEDGE DOCUMENT + the knowledge UI polish, SHIPPED)

> ‼️ **BREAKING INDEX CHANGE — `clinket-knowledge` was DROPPED and must be RECREATED** (owner deleted it
> 2026-08-18). Azure cannot retype a field in place, so `linkedServiceId`/`linkedServiceName` (single) became
> `linkedServiceIds`/`linkedServiceNames` (**collections**). Run `cosmosindexsetup` **per region**
> (`--launch-profile "Dev (Canada)"` AND `"Dev (India)"`, never bare `dotnet run`), then **delete and
> re-upload every existing knowledge document** — an old registry row still says `Ready` with a passageCount
> while its cards no longer exist, and nothing re-ingests a Ready document by itself.

### ‼️ THE BUG THIS FIXES — narrowing EXCLUDED the document that held the answer

One shared price list covers a provider's whole catalogue (verified on real data: business `MEE3IC` has
**36 services under 2 categories / 8 subcategories**, and its one uploaded price list OCRs into sections
`THREADING · WAXING · FACIAL · HAIR TREATMENT · POLICING`). It could be linked to **one** offering. So
`search_knowledge(query, linkedServiceId: svc-backstomach)` filtered `linkedServiceId eq 'svc-backstomach'`
and the price list — linked to something else, or to nothing — **was filtered out**, and the caller was told
*"the owner's material doesn't cover that."* A wrong answer manufactured by the schema.

### The shape (flat collections — NO complex types, matching the rest of the index)

```jsonc
{
  "linkedServiceIds":   ["2cd3bad1-…", "ac6a430b-…"],   // filterable collection, server-issued GUIDs
  "linkedServiceNames": ["Back/Stomach", "03 Plus Bridal Facial"],  // searchable + retrievable collection
  "content": "Complete Hair & Beauty Price List — Price list — WAXING\n<table>…"
}
```

- **INDEX-ALIGNED by contract.** One writer fills both from one ordered source; an offering that no longer
  resolves keeps its slot as an **empty string** so the ID is preserved (X2) and only the NAME is lost.
  `BuildLinkedOfferings` zips by index and **DROPS anything ragged rather than guessing** — a name paired
  with a foreign serviceId would book the caller onto a different offering. Pinned on real Cosmos
  (`LinkedServiceIds_RoundTripAsAnOrderedArray_AgainstRealCosmos`).
- ‼️ **NOTHING category/subcategory-shaped is stored — no ids, no names, no breadcrumb, not even in the
  prefix past the cap.** Rejected after checking the real data: the hierarchy is ALREADY in the model's
  prompt in BOTH regimes — Full mode emits `category: SubcategoryName ?? CategoryName` per service
  (`BuildCompactContext`), Map mode emits the two-level catalog map. Copying it into cards duplicates what
  the model already has, and inside a **businessId-scoped** index (~7-100 cards, top 3-5 kept) it actively
  hurts: the same taxonomy words stamped on EVERY card of one document move its vectors toward each other,
  making the right card harder to pick.

### The filter — two clauses, and the second one is the caller-facing half

```odata
businessId eq 'X' and (linkedServiceIds/any(t: search.in(t, 'a|b|c', '|')) or not linkedServiceIds/any())
```

‼️ **`or not linkedServiceIds/any()` is NOT optional.** Unlinked material is BUSINESS-WIDE by definition —
the deposit policy, the terms, the hours sheet. Without it, *"do you take a deposit for the keratin?"*
narrows to keratin-linked cards and the general deposit policy becomes invisible. **Narrowing may PREFER
material, never conceal it.** (This gap pre-dated the collection change and got worse as linking became
common; found in the end-of-build audit, sabotage-verified.) The scope clause still LEADS and `AssertScoped`
is unchanged — D22 layers 1-4 intact.

### The prefix (what gets EMBEDDED) — the anti-dilution rule

`KnowledgeChunkContext.PrefixNameCap = 3` (in **clinqetcore**, shared with the ingest caption prefix):

| Links | Prefix tail |
|---|---|
| 0 | nothing |
| 1–3 | `— Underarms, Half/Full Legs (Waxing Services)` — names + the group, **only when all linked offerings share ONE group** |
| 4+ | **nothing — byte-identical to an unlinked document's prefix** |

A document about one thing needs its offering named because that is vocabulary its own content may lack
("Underarms" only meets "underarm waxing" once "Waxing Services" rides along). A shared document must NOT
name them: the same list on every card differentiates none of them. BM25 still sees all the names via the
`linkedServiceNames` field, which is a separate field and therefore does not touch the vector.

### The tool result — what actually reaches the model

`KnowledgePassage.LinkedOfferings` = `[{serviceId, name}]`, capped by
`Voice:Knowledge:MaxLinkedOfferingsPerPassage` (**5**) and **omitted entirely past the cap** (business-wide
material names no single offering; the model falls back to `find_services` exactly as before).

‼️ **This is the biggest caller-experience win, and it matters MOST in Map mode (>60 offerings)**, where the
model holds no serviceIds until `find_services` returns: knowledge answers a question → caller says "book
it" → the passage already carries the GUID → `request_booking` directly, with no extra tool call and no
seconds of dead air. The §7.10 prompt gained one sentence for it: *"A result may name the offerings that
material belongs to, each with its serviceId — when the caller then wants to book or be quoted for one of
them, use that serviceId straight away and do NOT look the offering up again."*

- **The tool ARGUMENT stays a single optional `linkedServiceId`** — simplest contract for the model; the
  multi-id list stays server-side (`KnowledgeTools` wraps it, `answer_catalog_question` passes its candidate
  ids straight in via `MaxLinkedPassageServiceIds`).
- `ProviderCatalogAnswerService` passes `offerings` (NAMES only) into its judge prompt — that prompt scores
  rows it was already given, so a serviceId there is spend with nothing to spend it on.

### Cosmos + API + settings

- `KnowledgeDocument.LinkedServiceId` → **`LinkedServiceIds` (List<string>)**. `KnowledgeConfirmFileDto` and
  `KnowledgeDocumentDetailsDto` take `LinkedServiceIds`; `KnowledgeDocumentDto` returns
  `LinkedServiceIds` + `LinkedServiceNames` index-aligned (an unresolved name keeps its slot as `""`).
- **Save = FULL REPLACE, never a diff** — the editor always sends the complete set it is showing.
  `NormalizeLinkedIds` (server) drops blanks, collapses duplicates and enforces
  `Voice:Knowledge:MaxLinkedServicesPerDocument` (**25**).
- `KnowledgeListResponseDto` gained **`MaxLinkedServices`** so both editors STOP at the cap — the server
  silently keeping the first 25 of 30 would leave a provider with no idea which five went.
- New settings mirrored in **all three hosts** (API, Functions, MCP) per §0.12. **No ARM/deploy.ps1 change** —
  `Voice:Knowledge:*` lives in committed appsettings, not `local.settings.json` (verified: deploy.ps1 wires
  only `ContainerNames:KnowledgeBase`).

### ‼️ A DETAILS EDIT NOW RE-INGESTS (found the same session, separate defect)

`UpdateDetailsAsync` used to write the registry row **only** — so the type label and offering names baked
into every card's prefix, and the `linkedServiceIds` the voice tools filter by, stayed at their OLD values
until somebody happened to press Reprocess. Editing details now does exactly what Reprocess does (Processing
+ clear `ContentHash` + enqueue; case G's comment already said re-ingest is how a prefix is refreshed).
**Superseded:** a details edit now merges metadata in place (`KnowledgeIngestMode.MetadataOnly`, re-cutting only a
card that no longer fits), and since P4-C-12 nothing clears `ContentHash`.
Guards: a save that changed nothing spends nothing (order-insensitive set compare), and a row already
`Processing` is refused with `InvalidState` → the **Reprocess** message, not the FAQ-conflict one.

### The knowledge UI (web + mobile, same session)

- ‼️ **ONE CONTROL PER ACTION** (`resolveKnowledgeCtas` in `knowledgeMeta.js`, unit-pinned across every
  combination): the header **Upload documents** and the middle empty-state **Upload documents** were both on
  screen, and **Add FAQ** appeared twice the same way. Empty state owns Upload while there are no documents;
  it owns Add FAQ only while there are also no FAQs; every flag starts from `canManage` so no layout
  condition can revive a control permission removed.
- **Upload modal = the platform `wide` (760px)** and the file row was rebuilt into two zones — identity +
  ✕ on top (**the ✕ is structurally incapable of wrapping**; it used to orphan onto its own line), pickers
  underneath: stacked below `sm` (480px), side by side above (option **M1**, owner-chosen — at 360px a
  half-width trigger truncates nearly every real service name).
- **Both raw `<select>`s became the platform dropdown** (`FloatingOptionSelect`), which gained
  `searchable` (auto above `SEARCH_MIN_OPTIONS` = **8**), a pinned **"Currently linked"** group that
  survives filtering, and `multiple` (checkbox rows, panel **stays open** — ticking eight offerings must be
  eight taps, not eight round trips). Mobile mirrors all of it in `OfferingPickerSheet.tsx`.
- **Mobile reached full web parity**: the linked-offering picker and the post-upload **details editor** did
  not exist there at all (`KNOWLEDGE.LINK_TO_OFFERING` had been sitting unused in all five catalogues).
- Row display: `Linked to A, B +6 more` — on web the summary is a button that opens the details dialog, so
  "+6 more" is answerable rather than a dead end.

### Two live defects found on the way through (both web-only, both fixed)

1. **Replacing a document reset its type to "Other"** — the confirm payload always resent `docType` while
   the replace row defaulted to Other, and the server only preserves an omitted field. The row now seeds
   from the document it replaces.
2. **Clearing an offering link during a replace was impossible** — the client omitted the field when empty,
   which the server reads as "leave unchanged". `linkedServiceIds` is now always sent (the DTO comment
   already documented `null` = unchanged, `[]` = clear).

### ‼️ POLLING IS A SHORT LADDER THAT ENDS — the status UI no longer claims what it cannot back up

The page discovered "Ready" with a **5-second `setInterval`** that ran for as long as the page stayed open.
One document stuck Processing (a dead ingest run, a poison message, a queue backlog) therefore cost **720
list calls an hour, indefinitely, per open tab** — and each of those calls is a Cosmos partition query PLUS
a point-read per distinct linked offering, which multi-link had just widened from ≤20 to catalogue-sized.

- **`POLL_SCHEDULE_MS = [20s, 45s, 90s, 180s]` then STOP** (`resolveKnowledgePollDelay(attempt)` in
  `knowledgeMeta.js`, mirrored as `pollDelayFor` on mobile). **Four calls, ever** — the first two land
  inside the "usually under a minute" case. Indexed by ATTEMPT, not elapsed time, so the schedule reads as
  exactly what it is.
- **The analytics run has its OWN ladder** (2026-08-29): `ANALYTICS_POLL_SCHEDULE_MS = [30s, 60s, 120s, 180s,
  300s ×5]` — nine checks over ~31.5 minutes — keyed on `analysingKey` (Ready rows whose stamp is Queued), its
  own exhausted flag and stalled notice; ONE visibility/AppState listener serves both ladders.
- **Hidden ⇒ no call.** Web gates on `document.visibilityState`, mobile on `AppState`; both re-read
  immediately on return, which also gave the web page its first focus-refresh.
- **Keyed on WHICH documents are processing** (`processingKey` = sorted docIds), so a document queued
  behind a stuck one gets its own window instead of inheriting a spent clock. A manual Refresh bumps
  `pollEpoch` and earns a fresh ladder.
- ‼️ **The spinner is a CLAIM that something is being watched.** Once checking stops it is a lie, so
  `StatusChip` only spins while `watching`, and an info banner with **Refresh** takes over
  (`knowledge.poll.stalled` / `knowledge.poll.refresh`; mobile `KNOWLEDGE.POLL_STALLED` / `POLL_REFRESH`).
- **`ListAsync`'s offering-name lookups run CONCURRENTLY** (`Task.WhenAll`), not sequentially — multi-link
  turned that loop from ≤20 into catalogue-sized at ~3ms each, on every one of those polls.

‼️ **SignalR was considered and deliberately DEFERRED, not overlooked.** The `ConversationRead` rail
(`SignalRHttpClient` → the API's `/internal/notifications/*` endpoints → hub group) would make this
zero-call, and the Functions host already has that client. But **SignalR groups do not replay**: a dropped
connection, a reconnect, or a backgrounded phone loses the "Ready" push and the row would sit Processing
forever with NO recovery. Push therefore still needs a focus-refresh fallback — it MOVES the failure rather
than removing it. Revisit when volume justifies the endpoint + hub method + DTO + tenancy gating.

‼️ **A test that walks the ladder until null must be BOUNDED.** Proven by sabotage: with the stop condition
broken, the unbounded version HUNG the jest runner instead of failing it. A test that freezes CI instead of
failing it teaches nobody anything — the bounded version fails in 3ms.

### Proof

API unit **9397** · Functions unit **2298** · MCP unit **650** · cosmosindexsetup **76** (+6 new index-schema
pins) · API integration incl. **4 real-Cosmos knowledge tests** · MCP integration **81** · Functions
integration **459** · web jest **45** + ESLint 0 · mobile tsc clean + **143 suites / 2521 tests**.
**Sabotage-verified ×5**: the `any()` filter, the `or not …/any()` business-wide clause, the prefix cap, the
per-passage offering cap, and the details-edit re-ingest each FAILED against deliberately broken code and
re-greened after restore.

### Traps this adds to the permanent list

- ‼️ **Azure Search cannot retype a field** — a single-value → collection change is drop + recreate + full
  re-ingest, and existing `Ready` rows do NOT heal themselves.
- ‼️ **`any()` over an empty collection is FALSE**, so any narrowing filter over a collection silently hides
  unlinked/business-wide rows unless you add `or not field/any()`.
- ‼️ **Two parallel collections are only trustworthy while ONE writer fills both in one order** — zip
  defensively and drop what does not align rather than pairing by guess.
- ‼️ **`describe`-level convention: check what the model ALREADY has before enriching an index.** The
  category/subcategory names were about to be duplicated into every card; the embedded profile and the
  catalog map already carry them on every single call.

## RECENT CHANGES — 2026-08-17/18 (ANSWER LADDER **PHASES 2+3 of 3**: the MCP tools + the full-program audit — **PROGRAM CLOSED**)

> Program plan: `C:\Nik\voice-answer-ladder\PLAN.md` (D1–D33). Phase 1 (below) shipped the knowledge stack;
> Phase 2 shipped the two MCP tools + prompt wiring; Phase 3 audited the whole program end-to-end as a
> stranger, fixed 20+ findings, and closed it. **Open items**: the owner's deploy steps (cosmosindexsetup per
> region — `--launch-profile "Dev (Canada)"` AND `"Dev (India)"`, never bare `dotnet run` — then `deploy.ps1`
> per stamp) and live probe calls (no dev voiceline reachable from the build environment — the excavator
> scenario over a real phone line has never been exercised).

### The two Phase-2 tools (both spend the ONE 8-unit `VoiceCallSession.CatalogLookupCount` allowance, D6)

- **`search_knowledge`** (`clinqetmcp\Clinqet.Mcp\Tools\KnowledgeTools.cs` → `ProviderKnowledgeSearchService`
  in `clinqetinfrastructure\Services\Knowledge\`): retrieval-only, rung 4 of the ladder. ONE hybrid request
  (BM25 over content/sectionTitle/docName/docTitle/linkedServiceName + vector over contentVector in a single
  call); the query embedding gets an `EmbeddingBudgetShare` (0.4) slice of `RetrievalTimeoutMs` and **fails
  soft to keyword-only in the same round trip** (the embedding service returns EMPTY on failure — never
  throws); `hasEmbedding eq true` guard rides ONLY hybrid requests; **the token budget binds FIRST**
  (`RetrievalMaxTokens`×4 chars, top passage always kept); ‼️ a relevance FLOOR on each passage's cosine since
  P4-E-26 (D27b reversed — never a cutoff on the hybrid SCORE); **NO LLM
  — pinned STRUCTURALLY** (a ctor-reflection test refuses any `*Completion*` dependency); timeout ⇒ honest
  degrade + `RaiseLookupTimeout`; zero results ⇒ the honest None ("NOT proof either way… leave_message");
  optional `linkedServiceId` narrowing (escaped scalars AFTER the scope clause; ‼️ SUPERSEDED 2026-08-18 —
  the stored field is a COLLECTION and the filter is `linkedServiceIds/any(t: search.in(…,'|')) or not
  linkedServiceIds/any()`; `|` stripped from ids). Consumes **1 unit**, concurrently with the search (the
  find_services pattern — the lookup itself is $0 marginal).
- **`answer_catalog_question`** (in `CatalogTools.cs` → `ProviderCatalogAnswerService` in
  `Services\Voice\`): the Move-2 expert check, **Map mode only**. Consumes **`AllowanceUnits` (2) BEFORE any
  retrieval or LLM spend** ⇒ max 4/call. Ladder: plain `LookupAsync` FIRST → **D8 short-circuit** (Matches ≤
  `LookupTooBroadThreshold` AND **no digit** in the requirement — a digit marks the measurement-shaped ask
  and forces the judgment) → `RetrieveCandidatesAsync` (a NEW `IProviderCatalogSearch` member implemented
  inside `ProviderCatalogSearchService`'s isolation fortress: scope-led filter + `AssertScoped` + per-row
  verification that THROWS on a foreign row; `SearchMode.Any` wide read with FULL descriptions clamped at
  `CandidateDescriptionMaxChars`; fallback = capped partition read with EMPTY terms) → knowledge-passage
  synergy (candidates' serviceIds → `search_knowledge`'s multi-id filter, fail-soft empty) → ONE
  `GetStructuredCompletionAsync` (strict schema `{priceOrAvailability, matches[{id, confidence
  stated|likely|unknown, reason}]}`, temp 0, effort/tokens/deployment from `Voice:ExpertCheck`) → invented
  ids DROPPED, ordered Stated→Likely→Unknown, capped `MaxResults`, D20 hedging note. **Every §6.5 degrade
  lands on the PLAIN result** (LLM error/timeout/malformed-after-one-`JsonRepairHelper`-repair/zero
  candidates); `priceOrAvailability` ⇒ the refusal note steering to listed priceText;
  `CatalogIsolationException` **rethrows** — isolation never degrades; caller cancellation propagates.
- Allowance mechanics: `Tools\CatalogLookupAllowance.cs` — CAS mutate on the session doc; **fail-open on a
  lost write** (the cap stops runaway loops, not Cosmos hiccups), with the cap-vs-lost-write re-read
  distinction. Proven against the REAL session document in `AnswerLadderToolIntegrationTests` (2 then +1).

### Prompt wiring + the hasKnowledge signal

- `RealtimeSessionPayloadBuilder.ResolveAllowedTools(context, sharing, includeCtx, expertCheckEnabled,
  knowledgeEnabled)`: `answer_catalog_question` = Map mode × `Voice:ExpertCheck:Enabled`; `search_knowledge`
  = `context.HasKnowledge` × `Voice:Knowledge:Enabled` (any catalog mode — knowledge is orthogonal to size).
  The §6.3 ladder-order rule rides INSIDE the map branch, gated on the expert switch (never name a tool the
  model cannot see). The §7.10 knowledge block (+ X13: speak table VALUES, never markup/separators/the word
  "table"; never say "document"/"passage"/"index"/"link") is emitted ONLY when `hasKnowledge && enabled` —
  **zero added tokens otherwise, pinned byte-for-byte**. Owner standing instructions still end the prompt.
- `hasKnowledge`: `ProviderContext`/`PublicProviderContext.HasKnowledge`, fed since 2026-09-07 by the ONE receptionist
  sweep `IKnowledgeDocumentRepository.ListReceptionistGatesAsync` (**answerable** documents — Ready AND used by the
  receptionist — never the plain Ready count) **riding the existing cached context fan-out** (fail-soft
  `KnowledgeReceptionistGates.None` — a lost read means a call without the tool, never a failed handoff). ‼️ A newly-Ready
  FIRST document surfaces after the context cache expires (`ProviderContextCacheMinutes`) — by design. Ask Clinket's
  `hasKnowledgeDocuments` is a DIFFERENT fact (`AnyReadyAsync`, the provider's own).
- **Both tools stay OFF `Mcp:ChatToolAllowlist`** (a chat session has no catalog binding and no live
  caller) — pinned in `ChatToolAllowlistConventionTests` + two refused integration rows.
- MCP host (`Program.cs`): binds `Voice:Knowledge` + `Voice:ExpertCheck` + `AIService`; registers the
  knowledge repo, `ISearchTopology` whose `ResolvePrivate(businessId).KnowledgeClient` is NULL on an unprovisioned stamp (⇒ honest degrade),
  `IProviderKnowledgeSearch`, `IProviderCatalogAnswer`, and `IAICompletionService` via a **NAMED** HttpClient
  `"ai-completion"` — ‼️ typed `AddHttpClient<,>` is BANNED in this host
  (`TypedHttpClientLifetimeConventionTests`). `ServiceApprovalSettings` deliberately unbound.

### ‼️ WHAT THE PHASE-3 AUDIT FOUND AND FIXED (read before trusting any pre-audit description)

1. **Purge paging (correctness):** `KnowledgeSearchIndexer.CollectCardIdsAsync` sent ONE request with
   `Size = 500` — but Size is `$top`, so any purge over 500 cards (business closure at the 2,000-passage
   cap; a big doc; a long prune tail) **silently orphaned the remainder**, and orphaned cards of a deleted
   document keep answering callers. Fixed with the services indexer's Skip-paging loop; pinned by a
   501-card two-page test.
2. **D22 write-side:** `ConfirmUploads` accepted any existing `BlobName` — a hostile provider confirming
   another business's blob path would have had that content ingested and SPOKEN as their own knowledge.
   Now every confirmed BlobName must lead with `{businessId}/`; pinned (storage is never even consulted).
3. **‼️ MCP `CosmosDb:ContainerNames:KnowledgeBase` was MISSING** (appsettings + both deploy.ps1 MCP
   blocks) — the repo fell back to a bare `KnowledgeBase` name that exists in no non-prod stamp, the
   fail-soft count returned 0, and **`search_knowledge` was silently never offered on the MCP-built (Plivo)
   path**. The class of bug fail-soft design hides — fixed in all three places.
4. **deploy.ps1's emitted `$mcpAppSettings` block** was missing the whole AI family
   (`Search__Topology__*`, `AzureAIFoundry__*`, `AIService__*`, the KnowledgeBase container) — an MCP stood up from
   the emitted paste ran both tools permanently degraded. Mirrored from the applied block.
5. **D26 violation:** an unreadable image (no OCR, caption under the pixel floor) still shipped **one lone
   `DocSummary` card and flipped Ready** — the summary was appended before the no-readable-content check.
   Now substance cards must exist before the summary is added; pinned.
6. **Case-A at retrieval:** passages carried the RAW filename (`scan_001.pdf`) as the source name; now
   `DocTitle ?? DocName` — the D11 title is what the receptionist attributes aloud. Pinned.
7. **Parser data loss ×2:** single-line `<figure>text</figure>` dropped its text; a ≤200-char caption
   paragraph was consumed even when the following table was empty (text vanished). Both fixed + pinned.
8. **V11 server localization:** the FAQ DTO had NO `ErrorMessage` keys — raw English DataAnnotations
   sentences went out in all five languages. Now `Error_KnowledgeFaqQuestionLength`/`…AnswerLength`
   (16 `Error_Knowledge*` keys ×5 catalogues).
9. **V9 server half:** the SAS endpoint 400'd the WHOLE batch on one bad file; now per-file failed SLOTS in
   request order (clients index-match `isSuccess` per slot already) — only batch-level failures (doc cap)
   400. **MIME fallback both clients**: browsers report an empty type for `.md` (and pickers for
   `.txt`/`.json`) → `application/octet-stream` → rejected — a supported type could not upload at all.
   `resolveContentType`/`EXTENSION_MIME` on web + mobile, used consistently for SAS request AND the PUT
   (the SAS signature pins Content-Type).
10. **V17 both clients:** write controls (upload, Replace/Delete/Try-again, ⋯ menu, FAQ add/edit/delete)
    now HIDDEN without `voice.settings.manage` (web `can()` from BusinessContext; mobile `useBusiness()` +
    the no-business-context passthrough). **V18 mobile**: the full three-way gate (redirect / promo /
    finish-setup banner) — `FinishSetupBanner` extracted to a shared module CallFollowUps now also uses.
    **V2 mobile**: webp-specific message (`KNOWLEDGE.WEBP_NOT_SUPPORTED` ×5). **Mobile picker**:
    `types.allFiles` + `checkMediaFile` (the preset list made `.md`/`.json`/`.html` UNPICKABLE on iOS and
    let legacy `.doc`/`.xls` through to a rejection). **V10 mobile**: per-row Try-again on failed upload
    rows (in the approved mockup contract). Mobile `'document'` filename fallback → `KNOWLEDGE.UNNAMED_FILE`
    ×5; mobile analytics verb aligned to web (`view`, not `knowledge_view`).
11. **Web modal shell** now delegates to the tenancy `Modal` primitive (real bottom sheet under `sm`,
    `dvh`, safe-area, stacked full-width footer) — the hand-rolled shell violated the primitives mandate
    and could overflow at 320px.
12. **Vacuous pins rebuilt:** case 21 overlap (the old fixture repeated ONE sentence 40× — deleting the
    whole overlap mechanism stayed green; now two real pins incl. the skip-when-trailing-sentence-exceeds-
    the-window rule); case 35 prune (now EXACT-count in the function test + a selective 25-of-40 indexer
    test); case 30 (a real `CellFormula` + cached-value fixture); case 14 (a real `colspan` fixture);
    case 16 (figure text); case 18 (NFC via char-code-built fixtures); case 31 (`InvalidDataException` →
    `Error_KnowledgePasswordProtected`); case 32 (pixel floor never burns a vision call, both sides);
    doc-F (D11 input ≤~6k, temp 0, summary truncation); doc-B (duplicate filenames = two rows); X5
    (a failed card purge THROWS and the registry row survives); reprocess keeps `ContentHash` (P4-C-12).
    **Real-Cosmos CAS integration tests** (`KnowledgeDocumentCasIntegrationTests`): TryReplace
    Replaced/Conflict/Gone + idempotent delete + partition-scoped counts/hash lookup — the primitive every
    lifecycle race rests on, proven on the real engine (the API integration fixture now provisions
    `KnowledgeBase`).
13. **Sabotage-verified ×4 with fresh eyes**: D22 row verification, the D8 economy pin, the tombstone CAS,
    and the prune exact-count each FAILED against deliberately broken code and re-greened after restore.

### Accepted divergences / known limits (documented, not bugs)

- **HEIC/HEIF caption degrade**: ImageSharp 3.1 has no HEIF decoder — a standalone HEIC photo gets DI OCR
  but its vision caption is skipped with a logged warning (additive-only loss; adding decode = a native
  codec dependency).
- Web responsive collapse fires at this app's own `sm` = **480px**, not the plan's literal 640px — the
  app-wide breakpoint convention wins; no overflow exists down to 360px.
- Every table card, from every format, is `Kind=Table` holding the span-expanded grid serialized as
  `label: value | label: value`. No path stores source markup any more.
- A single whitespace-free token > `ChunkMaxTokens`×4 chars (base64 blob) cuts intra-word — no word
  boundary exists; the embed cap forces it. Reachable from a table CELL as well as a sentence.
- Doc-G (rename) is inert in v1 — no rename endpoint exists; `PATCH documents/{docId}` edits type/link only.
- Mobile has **no post-upload details editor and no offering-link picker** — the approved mockup scopes
  details editing to the web page (the native frames show none); `KNOWLEDGE.LINK_TO_OFFERING` sits unused
  in all five catalogues awaiting the owner's call.
- Polling (5s while a row is Processing) has no total cap and no hidden-tab pause, both platforms.

### Proof (Phase 3 close, all with real rebuilds — never trust `--no-build`, it reported false green AGAIN this session)

Functions unit **2295/2295** · MCP unit **647/647** · API unit **9389/9389** · cosmosindexsetup **70/70** ·
MCP integration **81/81** · Functions integration **459/459** · API integration **1772/1772** (incl. the
new real-Cosmos CAS tests; real emulators via Testcontainers) · web jest gates **132/132** + ESLint 0 ·
mobile `tsc` clean (one pre-existing unrelated module error) + jest **142 suites / 2505 tests**.

### Traps this program adds to the permanent list

- ‼️ **`--no-build` reported green on stale binaries a THIRD time** — a build failure scrolled past a
  `tail` filter and the follow-up `--no-build` run "passed" tests that did not compile. Always confirm the
  build step's own summary line.
- ‼️ **The shell layer collapses `\\u` to `\u` even inside single-quoted heredocs** — patching source
  through any shell pipe with backslash-u in the payload silently corrupts; build escape strings from char
  codes (`String.fromCharCode(92)+'u0007'`) or use the Edit tool.
- **Raw control bytes in test fixtures make the file BINARY to grep/ripgrep** — write `\u0007`-style
  escapes, never literal control characters, in .cs fixtures.
- **Azure Search `Size` is `$top`** — an unlooped "collect then delete" caps at one page; mirror
  `DeleteAllServicesForBusinessAsync`'s Skip loop.
- **A fail-soft signal hides a missing config key** — `hasKnowledge` returning false looked like "no
  documents", not "wrong container name". When a feature is gated on a fail-soft read, verify the read's
  config in EVERY host that performs it.


## RECENT CHANGES — 2026-08-18 (ANSWER LADDER **PHASE 1 of 3**: knowledge policy + the whole AI-Knowledge stack outside `clinqetmcp`, SHIPPED)

> Program: `C:\Nik\voice-answer-ladder\PLAN.md` (single source of truth, decisions D1–D33). Phase 2 (the MCP
> tools) has its own copy-paste prompt at `PHASE-2-PROMPT.md`; Phase 3 is the full-program audit. **Phase 1
> deliberately touched `clinqetmcp` exactly ONCE** — the `find_services` `[Description]`.

- **‼️ THE TRIGGER: the prompt was banning intelligence.** A caller asked an equipment dealer "which machines
  can dig 50 feet" and the AI froze. Three stacked gaps, not one bug: (1) `BuildInstructions` said *"Never
  reveal … anything not in the profile below"* — written for PRIVACY, read by the model as a **total
  knowledge ban**; (2) BM25/vector search structurally **cannot evaluate a numeric spec** ("52 ft max depth"
  never matches "50 feet"); (3) nothing reads full descriptions and judges a requirement. **Move 1 fixes (1)
  and ships here; (2)/(3) are Phase 2.**
- **MOVE 1 — the knowledge policy (prompt-only, $0).** The privacy line is **RESCOPED**: it now forbids
  revealing other customers' details and stating *a price, availability, an offering or a commitment not in
  the profile or a tool result* — the blanket clause is GONE and a test asserts it stays gone. A ~200-token
  block sits **above the Map/Full branch** (so both regimes AND both carriers carry it): translate a
  REQUIREMENT into the expert terms it implies and try more than one phrasing before concluding absence ·
  answer general trade questions briefly, hedged, steered back to the business · **never infer price,
  availability, stock or a commitment** · professional-judgment questions get information, "never a verdict
  or a diagnosis", steered to the booking · grade honesty out loud ("typically" + the owner's confirmation).
  `find_services`' description now invites the expert term explicitly. ‼️ **No industry noun anywhere** — the
  excavator was only the trigger; every mechanism is trade-agnostic by construction (D21).
- **‼️ NEW COSMOS CONTAINER `KnowledgeBase`, pk `/businessId`** (D12, owner-directed; §7.3c has the RU math —
  it is container #9 of the 25 that share the 1000 RU/s autoscale max, so **$0 marginal**, ~30-40% cheaper
  per write than `ProviderData` on a trimmed index policy, and — decisive — **it stays OFF the `ProviderData`
  change feed**, which drives `SearchIndexSyncFunction`; folding the registry in would wake the services-index
  sync on every status flip forever). Registry row per document/FAQ; **the row IS the ingestion work order**.
- **‼️ NEW SEARCH INDEX `clinket-knowledge`** on the existing service (D9 — the services index is
  contract-frozen). One card per ~350-token passage. ‼️ **`content` is `en.microsoft` (SHIPPED 2026-08-18); every OTHER searchable field stays `standard.lucene`** — the approved change is scoped to the one field holding prose. `standard.lucene` does NO stemming, so `dozer` matched **0 of 31** cards saying "Dozers"; after the change, **32**. The services index is untouched (all 23 fields were already `en.microsoft`). ‼️ The **services synonym map remains rejected here** — it is marketplace-category vocabulary and would make `CAB PACKAGE PRO PLUS` ≡ `taxi` on 18 real cards; knowledge gets its own identity-only map instead. ‼️ `docName` (the RAW filename) is deliberately OUT of the query's `searchFields`; `docTitle` does that job (D27 —
  one shared field holds EN/FR/ES/HI/GU, a deliberate documented divergence from services' `en.microsoft`),
  a TextWeights-only `knowledgeRelevance` profile, **NO scoring functions** (freshness/rating are meaningless
  inside one provider's documents — the `voiceCatalogScoring` lesson), **NO suggester, NO semantic config, NO
  vectorizer** (nothing in this codebase has integrated vectorization; we write vectors ourselves).
  ‼️ Its initializer lives in **its OWN file** (`cosmosindexsetup\KnowledgeSearchIndexInitializer.cs`)
  because `ProviderIndexDefinitionConventionTests` reads `Program.cs` as TEXT and splits it on
  `"class ProviderSearchIndexInitializer"`.
- **‼️ D22 IS IMPLEMENTED IN THE INDEXER, NOT ASSUMED.** One index holds every business's passages, so scope
  is a query-time filter **plus** row-level verification: every filter LEADS with `businessId eq '…'`
  (quote-escaped), and **every returned row's businessId is re-verified — one mismatch throws and deletes
  NOTHING**. Sabotage-verified: disabling the row check failed all three isolation pins.
- **‼️ THE THREE LIFECYCLE RACES, in code and pinned** — this is the part to read before touching ingestion:
  - **Gapless REPLACE (§7.8b#35)**: old cards keep serving throughout re-ingestion; the final commit upserts
    over the SAME deterministic ids `{businessId}_{docId}_{chunkNo}` **and prunes `chunkNo ≥ newCount` in the
    same commit** (a 40-card doc replaced by 25 leaves exactly 25). Replace is **disabled while Processing**.
  - **DELETE-DURING-PROCESSING = deletion wins (§7.8b#34)**: ingest re-reads the registry before its Ready
    commit and again after the analytics tail. A missing row invokes the same full purger and exits; no cards,
    drafts, artifact, image, thumbnail or source blob may be recreated. The draft tail cleans rows written
    after deletion, and a stale media-derivative message may delete only from the configured knowledge
    container and the exact direct image prefix owned by its canonical business/document identity.
  - **DURABLE DELETE + IMMEDIATE HIDE**: the API accepts only a canonical server-issued GUID-N document id,
    proves the row exists by business-partition point read, enqueues `Delete` on the existing session queue,
    then CAS-marks the row `Deleting` and turns sharing off. A missing external route id returns NotFound and
    can never start prefix repair. Lists, reprocess/edit/image mutations, send-by-ref and search all refuse
    `Deleting`; search also applies a required post-search allow-list of existing non-deleting registry ids,
    so a missing-row orphan card cannot be spoken. This costs one projected, single-partition Cosmos query per
    knowledge search; it is deliberately after Azure Search to close the deletion race.
  - **DELETE ORDER IS LOAD-BEARING (X5)**: `KnowledgeDocumentDataPurger` removes exact business/document
    index cards, every service draft, the trailing-slash source/draft prefix, extracted-image prefix and exact
    OCR/content artifact **before** an ETag-guarded Cosmos row delete. Conflict ⇒ re-read and repeat; success
    ⇒ sweep again for late writers. Only an already-authorized queue retry may repair a now-missing row.
    Source confirmations, duplicate-hash source cleanup, registered image deletes and draft-image deletes all
    verify exact direct ownership; foreign/colliding paths are retained and alarmed, never deleted. The real
    Cosmos + Azurite deletion integrations cover the API purger and an idempotently redelivered worker message.
  - **FAILURE CONTRACT**: any index/storage failure leaves the row `Deleting` and hidden, then abandons for a
    bounded Service Bus retry. Retry exhaustion raises the administrator alert and dead-letters as
    `KnowledgeDocumentDeletionFailed`; it never marks the provider's row `Failed` or sends a false ingest
    failure. Queue publication failure uses the bounded inline purger; if that also fails, the API fails and
    preserves the `Deleting` retry handle.
- **D25 — a document is ALL-IN or ALL-OUT.** The cap check runs **after chunking, before any embed/index
  spend**: fits ⇒ index fully; over cap but within `OverflowGraceFactor` (1.10) ⇒ index FULLY; beyond ⇒ the
  WHOLE document `Failed` ("knowledge space is full"), nothing partial, blob retained so Try-again needs no
  re-upload. ‼️ **The queue is SESSION-ENABLED with `sessionId = businessId`** (`requiresSession: true`,
  `IsSessionsEnabled = true` on the trigger) so one business's documents process strictly one-at-a-time and
  the concurrent-upload cap race cannot happen. `Ready` means 100% searchable; `Failed` means 0%.
- **D28 — LOCAL-FIRST EXTRACTION cuts typical cost ~60-90%.** Document Intelligence is paid for ONLY where
  OCR/layout genuinely needs it: **PDFs and photos** (`prebuilt-layout` + `outputContentFormat=markdown`,
  $10/1k pages — tables survive as HTML incl. rowspan, and WSDM'24 measured LLMs reading HTML tables ~6.8%
  better). **Everything born-digital parses in-process at $0**: DOCX/XLSX via `DocumentFormat.OpenXml`,
  HTML via HtmlAgilityPack, TXT/MD/JSON via plain .NET. A realistic 20-doc provider ≈ **$0.85 one-time**.
  ‼️ Knowledge carries its OWN `ExtractionModelId` — **the shared onboarding `AzureDocumentIntelligence:ModelId`
  is never touched**. New public seam: `ExtractRawTextFromUrlAsync(fileUrl, modelId, outputContentFormat, ct)`
  + `ExtractRawTextFromBytesAsync(...)` → `{Content, PageCount}` (the old private raw-OCR method was a
  three-LLM-phase onboarding pipeline; do NOT fish `RawText` out of the DTO).
  ‼️ **DI fetches the blob BY URL, and the container is private ⇒ hand it a read-SAS.**
- ‼️ **The searchable-space cap is now VISIBLE and checked BEFORE upload (2026-08-18).**
  `KnowledgeListResponseDto` carries `PassageCount`/`MaxPassages` — summed from the registry rows the
  endpoint already fetched (**free**; and it counts FAQs, which are passages too), never a search-index round
  trip. The SAS endpoint rejects when already full, because the cap used to be enforced ONLY inside the ingest
  function — **after** Document Intelligence extraction, the AI title call and image captions had all been
  paid for. Both platforms show a second counter + clamped meter (the grace band means the count can
  legitimately exceed the max), disable Upload on **either** cap, and the banner names **which** cap is full.
  Provider-facing wording is **"searchable parts"**, never "passages"; `Error_KnowledgeSpaceFull` states the
  cap — ‼️ and `FailureReason` must be resolved through the format-aware helper, because the row-failure path
  used `GetLocalizedString` with no `string.Format` and would print a literal `{0}`.
- ‼️ **Model-facing JSON sets `Encoder = UnsafeRelaxedJsonEscaping` explicitly** in all four places
  (`Clinqet.Mcp/Program.cs` toolJsonOptions, `RealtimeSessionPayloadBuilder.ContextSerializerOptions`,
  `ProviderCatalogAnswerService.PromptJsonOptions`, `McpAIService`). The STJ default is the HTML-safe
  encoder, which escapes every non-ASCII char — a Hindi profile reached the model as `\uXXXX` escapes, **54%
  larger**, and table cards as `\u003Ctd\u003E`. This was degrading every non-English call, not just knowledge.
- **D24 — the chunking contract**, in a **pure, dependency-free, deterministic** `KnowledgeChunker`
  (§7.8b's 35 cases ARE its test list): ~350 target / 512 hard max / 120 min-merge tokens (~4 chars/token
  consistently), **15% overlap composed of whole trailing sentences**, cutting order heading → paragraph →
  **sentence end** → word boundary, **never intra-word**; danda `।`/`॥` terminators; decimals and `v2.1`
  never split (the period is followed by a digit); an abbreviation guard; OCR dehyphenation; lists split BETWEEN items;
  per-document dedupe; a tiny document is one card. **The structural prefix
  `docTitle — docType — sectionPath — offering (group)` lives INSIDE `content`**, so BM25 and the vector both
  reach it — which is what makes a stray "Max depth: 52 ft" findable.
- ‼️ **TABLES STORE THE SAME TEXT THEY EMBED — no markup, ever (rev 2026-08-18).** `KnowledgeTableModel` has
  **no `Html`**. A table card is `label: value` pairs joined by **` | `** (never `; `, which is already the
  separator INSIDE a multi-value cell), one record per line. Why it changed: storing HTML while sizing row
  groups on plain row text undercounted nine characters per cell, so **261 of 314 live cards sat over their own
  512 ceiling** (avg 580, max 788) and the retrieval trimmer returned **2 passages instead of 5**; markup was
  **31% of every card** and 1.69× on the wire. A/B on a clone of the real 685-record file: precision
  **51.4% → 73.8%**, wire tokens **−46%**, "do you have a Caterpillar 336" **0% → 80%**, cards over the
  ceiling **261 → 0**. A table whose grid cannot be read is emitted as a **Paragraph of its text**, never an
  empty table block.
- ‼️ **EVERY BUDGET EXCLUDES THE PREFIX.** The prefix is prepended AFTER packing, so each path spends
  `ceiling − prefixTokens` (recomputed per section, since the section path changes its length). Sizing the
  body alone let every card overshoot by its own header line.
- ‼️ **Row GROUPS pack to the TARGET; the oversize-single-row trigger AND its split budget stay on the HARD
  MAX.** The row width self-selects — a dense 23-column record is ~230 tokens so one lands per card, a thin
  4-column price row is ~30 so twenty do, and a small table stays atomic. Cell-splitting strands a row's tail
  with **no id or title**, so it only ever happens to a row bigger than a whole card (~60+ columns).
  ‼️ `groupEnd > groupStart` is **load-bearing**: the first row of a group is always admitted however big it
  is — without it a row over the target closes an empty group and **vanishes from the document**
  (sabotage-verified; the first guard test written for this was VACUOUS and passed against broken code).
- ‼️ **A single CELL over the budget** has no smaller unit, so it takes the same last-resort as an oversize
  sentence: word boundary + a warning. **A table with no readable data yields NO card** — header-only or
  all-blank used to emit a card whose whole body was the document prefix (retrieval bait that matches on the
  title then answers with silence). Category/subcategory ride the **prefix
  only**; there is deliberately **no category index field** (knowledge narrows by `linkedServiceIds`, never by
  category). ‼️ Since 2026-08-18 the prefix names offerings only up to `PrefixNameCap` (3) — see the top block.
- **D11 — ONE `gpt-5.4-mini` call PER DOCUMENT** (~$0.002): `{title ≤60, summary ≤400, language}` from the
  first ~6k chars + the heading outline, temp 0. It feeds `docTitle`, every card's prefix, one `DocSummary`
  card, and the display name — and fixes junk filenames (`scan_001.pdf`) for every trade. **Degrade =
  filename title, no summary; ingestion NEVER blocks on the nicety.** ‼️ **Per-CHUNK LLM enrichment stays
  REJECTED** — Snowflake measured it **negative (−5.8 pts)** while doc-level context prepended to chunks
  gained +15-25.
- **D26 — images become WORDS; there is no image-vector search.** DI layout OCR (the same call — OCR is DI
  itself, not a separate product) **plus** one `gpt-5.4-mini` vision caption per real image, **downscaled
  first** (a reported large-PNG token anomaly). Embedded DOCX images are found automatically via OpenXML
  image parts — **no user checkbox** — and decorative ones are skipped under `EmbeddedImageMinBytes` (10 KB)
  / `ImageCaptionMinPixels` (200), so a letterhead logo never burns a caption call. OCR empty AND caption
  empty ⇒ `Failed` ("no readable content"). A voice channel can never speak a vector.
- **FAQs are SYNCHRONOUS (D30)** — `POST /knowledge/faqs` writes the registry row and embeds+upserts **one
  card inside the request**, live instantly; an edit re-embeds that card and prunes; **concurrent edits
  resolve by ETag ⇒ 412 ⇒ a friendly reload-and-retry toast (X7)**. FAQ cards **count toward the passage
  cap** (X8), though the 200-FAQ cap binds first. A FAQ never rides the queue and never touches DI or blob.
- **‼️ Ingestion is SERVICE-BUS-TRIGGERED, and the change-feed variant was evaluated and REJECTED (D30)** on
  four hard facts: the standard change feed **carries no deletes** (a TTL expiry emits nothing ⇒ orphaned
  cards forever); a poison document **STALLS the lease partition** with no DLQ, no delivery count, no
  abandon; a minutes-long dollar-spending OCR inside the function that keeps the customer-facing services
  index fresh would queue marketplace freshness behind somebody's 100-page scan; and our own status flips
  would re-trigger the very feed that started them.
- **The queue message carries ONLY `{businessId, docId, mode}`** — the registry row supplies blobPath,
  docType, linkedServiceIds and contentHash, so **a redelivery re-reads CURRENT state** and a concurrent edit
  or delete is honoured rather than overwritten. Ingest sends use
  `{businessId}:{docId}:{mode}:{updatedAt.Ticks}`; the tick is required because a 10-minute dedup window
  would otherwise swallow Reprocess/Replace. Delete sends use a unique id so a repeat owner action can repair
  after an earlier delivery was exhausted; only the API path that point-read an existing row may create one.
- **Cost guards that are pinned by tests**: `contentHash` short-circuits an identical re-ingest (no
  re-extraction, no re-spend); **X9** — the same bytes under a different filename **refresh the EXISTING
  document** and delete the duplicate row rather than paying twice; empty extraction fails **before** the D11
  call; beyond-grace overflow fails **before** any embedding.
- **Teardown (three additions that are easy to miss)**: `BusinessClosureTeardown` now purges the **knowledge
  index cards** explicitly (the change feed carries no deletes — same reason the services delete is
  explicit), adds **`KnowledgeBase`** to the container purge list, and purges the **blob prefix**
  `{businessId}/`. Its ctor grew two dependencies ⇒ `ServiceRegistrationSelfContainmentTests`' declared
  contract and the integration construction site both needed updating.
- **API**: `KnowledgeController` (`api/v{v}/knowledge`) — batch `sas-urls` (V1–V8 incl. a **WEBP-specific**
  message; XLSX/HTML/JSON are ACCEPTED per D14/D28; the doc cap re-checks server-side so a stale client gets
  the limit error, and a **Replace never consumes a slot**), `confirm` (verifies the blob landed, writes
  `Processing`, enqueues), list, delete, reprocess, `PATCH` details, FAQ create/edit/delete.
  ‼️ **Gates REUSE `voice.read` / `voice.settings.manage` (D17) — NO new permission key**, which is what
  avoids the whole grant-change playbook (CatalogVersion bump, pin update, screen-combination sweep).
- ‼️ **ADMIN REPAIR — `SearchAdminController` (`api/v{v}/admin/search`, `[Authorize(Roles = "Admin")]`)**:
  `GET knowledge-health/{businessId}`, `POST reindex-knowledge/{businessId}`, `POST reindex-knowledge/{businessId}/{docId}`.
  ‼️ **`Ready` records that an ingest ONCE succeeded and is NEVER re-validated against the index.** The ingest
  path cannot produce Ready-over-zero-cards (empty extraction, zero cards and partial embeddings all fail
  terminally BEFORE the flip, and the cards are written before it) — but an index rebuilt or emptied **out of
  band** leaves every row saying Ready over nothing, and no code path notices. `knowledge-health` is the only
  view that asks the index what it holds NOW: it pairs the row's stored `PassageCount` with a LIVE
  `CountCardsAsync` and flags the drift. **Ready + zero live cards is drift by definition**; an unknown count
  (the probe threw) accuses nobody, because reading it as zero would send an admin re-embedding a whole
  catalogue during a search outage.
  ‼️ **Reindex MUST route through `ReindexAsync`, never a raw enqueue**: `ReprocessAsync` refuses anything that
  is not `SourceKind.File`, so a **typed FAQ was previously UNRECOVERABLE** once its cards were gone — it has no
  blob and never rides the ingest queue. `ReindexAsync` sends a file document through `ReprocessAsync` (which
  **keeps `ContentHash`** since P4-C-12 — the identical-content exit is a replacement's alone, so the repair still
  re-reads) and rebuilds a FAQ inline through the same three steps an edit runs.
  Concurrency needs no new lock: the CAS refuses a second run while `Processing`, and the ingest `messageId`
  (`business:doc:updatedAtTicks`) dedupes identical sends — so a provider's Try-again racing an admin's Reindex
  is one run, never two. `ReindexAllAsync` is **sequential** (a FAQ embeds inline and each ingest re-reads the
  per-business passage cap) and reports **per document**, because a partial repair that reads as success is how
  a broken document stays broken. `GetIndexHealthAsync` probes at **bounded** concurrency writing **by
  position** — an unbounded fan-out would aim hundreds of queries at the search service live traffic uses.
  **Operational rule in place of a reconciliation sweep: after ANY knowledge index rebuild, reindex every
  document.** Nothing detects that drift automatically.
- **UI, both platforms in the same session (§0.7.1)**: web `/dashboard/profile/knowledge` (Profile-menu entry
  immediately after the AI entry, inside the same `aiAssistantEnabled` conditional; the three-way
  `CallFollowUpsGate` shape; `putFileWithProgress` batch choreography **confirming only what landed**;
  per-row Try-again/Replace/Delete per V19; "Your FAQs" with Add/Edit/Delete; usage meter; polling **only
  while a Processing row exists**; flawless at 360px with actions in a ⋯ menu) and the mobile Knowledge
  screen (the five-file registration, `allowMultiSelection` + `keepLocalCopy`, **`putBlobToSasUrl` XHR —
  fetch rewrites Content-Type and Azure 403s the SAS signature**). Plus the **D31 nudge** on the AI Voice Assistant settings
  page, both platforms, reading the SAME list endpoint the page uses (X15). **‼️ ONE block on screen, ever
  (2026-08-17)**: no knowledge ⇒ the **invite in the TOP slot** (directly under the page title + status chip,
  above the usage/number row — never above the `<h2>`, which would break heading order); has knowledge ⇒
  nothing at top and the quiet **summary at the BOTTOM** by the settings it describes. Two instances would
  double the `widget: knowledge_nudge` impression and wreck the conversion denominator. The top slot lives in
  **`VoiceAssistantPage`, not `ActivePanel`**, because it also renders while WAITING for a number
  (`KNOWLEDGE_PROMPT_STATUSES` = Active | Submitted | NumberPending, and `onboardingComplete !== false`) —
  the one moment adding knowledge is the only useful act. The list read lives on the page and is passed down as
  `knowledgeSlot` (mirroring `usageSlot`) so the two slots share ONE call; it is tri-state — `undefined`
  renders nothing (in flight), `null` falls through to the invite (read failed). **‼️ Counts: the summary
  renders when docs OR FAQs exist, so a single both-counts string said "0 FAQs" to docs-only providers, and
  mobile had NO plurals at all ("1 documents"). Three shells picked in code — `summaryBoth`/`summaryDocs`/
  `summaryFaqs` — never nested ICU; on mobile i18next pluralizes only ONE `count` per key, so compose
  `NUDGE_DOCS_one/_other` + `NUDGE_FAQS_one/_other` into the shell.** Summary copy names the umbrella, not a
  file count: "already knows your **Clinket** profile — services, prices, hours, offers — plus the {docs} and
  {faqs} you have added" (the profile really does carry all of that into the first prompt, §6.2). **Invite copy
  is owner-frozen verbatim** — pinned by test, do not "improve" it.
  **Nav label and page title are "AI Knowledge" (D32)**; the section inside is **"Your FAQs" (D29)**;
  **status chips are D33** — green Ready · **blue + spinner Processing** (never yellow, never a gradient:
  amber means "needs your attention" in this system) · red Failed · amber only for limit/space warnings.
- **Settings**: `Voice:Knowledge` (every §7.15 knob, class defaults mirroring appsettings in the API and
  Functions hosts) + `Storage:ProviderKnowledge` + `Containers:ProviderKnowledge` +
  `Search:Topology:Private:Cells:<cellId>:KnowledgeAlias` (‼️ the read side is **the router** while `cosmosindexsetup` uses
  **`Search:`** — a new index needs its name in BOTH). ‼️ **The MCP host does not bind `Voice:Knowledge` yet
  — Phase 2 must, or the retrieval knobs run on class defaults.**
- **Localization**: 14 `Error_Knowledge*` keys in all five `clinqetinfrastructure` catalogues (failure
  reasons are stored on the registry row **as keys, never English**, and resolved per caller language);
  68 `knowledge.*` keys in all five web catalogues; a `KNOWLEDGE` block in all five mobile catalogues
  (SCREAMING_SNAKE, `{{}}`, **no inline ICU plural anywhere on mobile**).
- **New packages** (`clinqetinfrastructure`): `DocumentFormat.OpenXml` 3.3.0 (3.1.0 pulls a vulnerable
  `System.IO.Packaging`), `HtmlAgilityPack` 1.11.71.
- **Proof**: Functions unit **2271/2271** · API unit **9384/9384** · MCP unit **574/574** · cosmosindexsetup
  **70/70** · web jest 76 + 26 across four gates, ESLint 0 · mobile tsc clean + **123** across six gates.
  **Sabotage-verified**: tombstone CAS, gapless-replace prune, and all three D22 isolation pins each FAILED
  against deliberately broken code and re-greened after restore.
- **Two guards caught real omissions during Phase 1 and are worth knowing about**:
  `CosmosCompositeIndexContractTests.RepositoryToContainer` **fails the build for any repository file not
  mapped to a container**, and `ServiceRegistrationSelfContainmentTests` **fails when a registered type's
  ctor grows a dependency the extension's declared contract does not list**.
- **NOT in Phase 1 (Phase 2 owns them)**: `search_knowledge`, `answer_catalog_question`,
  `ResolveAllowedTools` additions, the §7.10 knowledge prompt block, the ladder-order rule, the X13
  table-reading rule, and the `hasKnowledge` signal. **Nothing retrieves knowledge on a live call yet** —
  the index is written and correct, and no tool reads it.

## RECENT CHANGES — 2026-08-21 (‼️ SPEAK-LANGUAGE FALLBACK — Gujarati/Punjabi lines were DEAD on Telnyx, SHIPPED)

- **‼️ THE DEFECT:** `VoiceCall:SpeakLanguageMap` emitted `gu-IN`/`pa-IN`, which are NOT in the Telnyx speak
  `language` enum (developers.telnyx.com/api-reference/call-commands/speak-text; en-US/fr-CA/es-MX/hi-IN are).
  Telnyx REJECTED the disclaimer speak → `spoke=false` → **§19 disabled recording AND the AI for the whole
  call** → plain transfer, Missed/Voicemail cards with the misleading "Recording was off" note even with the
  recording toggle ON. English worked; every Gujarati/Punjabi Telnyx line was silently dead end-to-end. The
  SAME class was fixed on Plivo in 2026-06 (`PlivoSpeakSettings.VoiceMap`) and never on Telnyx.
- **THE RULE (both carriers): a language the carrier's TTS cannot pair substitutes TEXT AND VOICE TOGETHER —
  a Hindi voice never reads Gujarati script.** `Clinqet.Shared.Utilities.SpeakLanguageFallback.Resolve(iso,
  carrierSpeaks, fallbacks)` is the ONE implementation. Unmapped-WITHOUT-fallback keeps today's shape (own
  text + default voice), so the substitution only ever fires where a fallback is configured.
- **Settings (§0.12 mirrored, Functions appsettings + class defaults; API/MCP bind none of these — no change
  there, NO ARM/deploy.ps1):** `VoiceCall:SpeakLanguageMap` is now {en,fr,es,hi} ONLY (gu/pa REMOVED; the
  empty-class-default-vs-populated-appsettings drift was fixed at the same time); NEW
  `VoiceCall:SpeakLanguageFallbacks` {gu→hi, pa→hi}; NEW `Plivo:Speak:LanguageFallbacks` {gu→hi, pa→hi}
  (owner decision: a HINDI disclaimer for gu/pa on BOTH carriers — India previously degraded gu/pa to
  Gujarati/Punjabi script read by WOMAN/en-US).
- **Sites covered, all via `ResolveSpokenLanguage` in each host file:** Telnyx disclaimer + record-only
  variant, `Voice_LineUnavailable` (both sites), `Voice_ProviderHoldConnecting`, the voicemail invite, the
  cap-unavailable line, and `VoicePostCallProcessorFunction`'s `Voice_DialReassurance` (which carried its own
  duplicated resolver); Plivo answer applet + voicemail applet (substituted where `language` pairs with
  `ResolveSpeak`). The AI session language is untouched — it derives from the voiceline elsewhere.
- **Guards:** `VoiceSpeakLanguageSettingsConventionTests` (Functions repo) pins Telnyx-enum membership of
  every map value + the §0.12 mirror both ways + fallback-target closure + no-key-in-both; function tests pin
  gu/pa ⇒ Hindi text+hi-IN on the disclaimer/voicemail/reassure (Telnyx) and Polly.Aditi/hi-IN applet (Plivo)
  + the terminal no-fallback shapes. **Sabotage-verified both ways**: resolver reverted ⇒ 3 pins fail alone;
  gu-IN reintroduced in appsettings ⇒ all 3 convention tests fail.
- ‼️ **The AI conversation itself was never the problem** — Azure GPT-Realtime speaks Gujarati natively; only
  the carrier-TTS lines have a Telnyx language enum. A REAL Gujarati carrier voice stays available as a
  config flip: Telnyx accepts fully-qualified `Azure.<VoiceId>` voices (e.g. `Azure.gu-IN-DhwaniNeural`) —
  verify on one live call before mapping it.
- ‼️ **Trap re-proven: a FAILED `dotnet build` leaves the previous DLL and `--no-build` test runs then report
  on STALE binaries** — a concurrent session's non-compiling in-flight file made a restored fix look broken.
  Check the build's own error count before trusting any test result.

## RECENT CHANGES — 2026-08-16 (Telnyx carrier noise suppression + VadEagerness low — the anti-interruption fix, SHIPPED)

- **‼️ THE FIX for the owner-confirmed "AI interrupts callers" problem, two levers.** (1) `VadEagerness` medium → **low** ("will let the user take their time to speak" — OpenAI's wording): Functions appsettings + the `AzureRealtimeSettings` class default + the builder's blank-value fallback, so the MCP host (India relay) — which binds NO VadEagerness key — moves too. Pinned by `Build_DefaultSettings_SemanticVadEagernessIsLow_OnBothCarrierPayloads`. (2) **Telnyx carrier noise suppression on the caller leg**, engine **Krisp** — the only engine with speaker isolation (removes OTHER people's voices; background voices on speakerphone/busy-place calls are the real problem, not hiss).
- **‼️ `suppression_start` is a Telnyx BETA API (owner-accepted 2026-08-16).** `POST /v2/calls/{ccid}/actions/suppression_start`, billed per leg per direction per minute (Krisp $0.005/leg/min ⇒ ~$2.50/mo at 500 min; AiCoustics $0.003; Denoiser/DeepFilterNet $0.002). Beta posture: fail-soft by contract (a rejected command logs a Warning and the call continues — NEVER a call failure), `Voice:NoiseSuppression:Enabled` is the instant kill switch, and every engine/model/level is an appsettings flip, never a deploy.
- **‼️ THE VOCABULARY TRAP (why Part-0.5-style live verification is mandatory):** Telnyx's noise-suppression GUIDE page still shows STALE names (`suppression_lev`, `attenuation_lim`, `enhancement_lev`, `krisp-nlsv-*` models). The real API contract (OpenAPI spec + rendered API reference + TeXML doc, all concordant) is `noise_suppression_engine` (`Denoiser`|`DeepFilterNet`|`Krisp`|`AiCoustics`) + `noise_suppression_engine_config` with `suppression_level` (0.0–100.0) / `attenuation_limit` (0–100) / `mode` (standard|advanced) / `enhancement_level` (0.0–1.0) / `voice_gain` (0.1–4.0) / `family` (sparrow|quail) / `size` (s|l|xs|xxs|vf_l|vf_1_1_l; xs/xxs sparrow-only, vf_* quail-only — pairing enforced in code) / Krisp `model` ∈ `krisp-viva-tel-v2.kef`|`krisp-viva-tel-lite-v1.kef`|`krisp-viva-pro-v1.kef`|`krisp-viva-ss-v1.kef`. NEVER trust the guide page for this API.
- **Where it fires:** `VoiceCallControlFunction.TryStartNoiseSuppressionAsync`. `StartMode=OnAnswer` (default) fires in `HandleCallerLegAnsweredAsync` AFTER the disclaimer speak + record commands (zero greeting latency; the denoiser profiles the room through the disclaimer + ring, so the AI's first heard sentence is already clean). `OnAiHandoff` fires in `TryReceptionistHandoffAsync` CONCURRENT with the SIP transfer (zero handoff latency). Gated on the SAME "AI takeover possible" predicate as the context warm — never on cap/private/NeverAnswer/receptionist-off/no-SipUri, so a call the AI can never hear spends nothing. Exactly-once: the `DisclaimerPlayedAt` duplicate guard / the handoff phase CAS, plus the deterministic `command_id` (Telnyx server-side dedup). **NO `suppression_stop` anywhere** — suppression is a live-call media property and ends with the call (commands to an ended call reject 90018); the first invoice should show suppressed minutes ≈ eligible call minutes.
- **The seam:** `IVoiceTelephonyProvider.StartNoiseSuppressionAsync(callControlId, clientState)`. Telnyx builds the payload in `TelnyxCallControlService.BuildSuppressionStartPayload`: numeric ranges clamped + logged (never sent out-of-range), `Direction=Both` clamped to `Inbound` + Warning (billed per direction — owner rule: impossible by accident), ONLY the selected engine's config keys ever emitted, an unknown engine value (e.g. a raw number bound into the enum) logs a Warning and SKIPS — never a malformed command, never an aborted call. The Krisp `Model` is deliberately a pass-through string (undocumented id ⇒ Warning but sent) so a Telnyx model rename is a config flip. Plivo's implementation is a documented no-op.
- **‼️ INDIA HAS NO CARRIER NOISE CANCELLATION — vendor-blocked, owner-accepted 2026-08-16.** Plivo's `noiseCancellation`/`noiseCancellationLevel` (camelCase; default "false"; level 60–100 default 85) exist ONLY on the Audio-Streams `<Stream>` element. The MPC ai-agent surface India actually rides — the Add Participant API AND the `<MultiPartyCall>` XML element (including all six `aiAgentStream*` attributes) — carries NO noise-cancellation parameter (verified against the live Plivo references). Deliberately NO `PlivoEnabled`/`PlivoLevel` keys exist (a setting nothing reads violates §4/§0.12). Re-check Plivo's MPC docs before any future India noise work; the locked MPC+ai-agent design is NOT to be traded for `<Stream>` (it cannot do the live human join).
- **Double-denoise guard `Voice:NoiseSuppression:DisableModelNoiseReduction`** (default false): true ⇒ `RealtimeSessionPayloadBuilder.BuildAcceptPayload` omits the model-side `noise_reduction` (omitted == off) so carrier-suppressed audio is not scrubbed twice — the second pass risks the prosody the model reads emotion from. ‼️ **Scoped to the Telnyx accept path ONLY**: `BuildWebSocketSessionPayload` (India) deliberately ignores the flag because `far_field` is India's ONLY denoiser; pinned by `BuildWebSocket_DisableModelNoiseReduction_NeverStripsIndiasOnlyDenoiser`.
- **Settings** (`VoiceNoiseSuppressionSettings`, bound in the Functions host only; the MCP host's builder deliberately resolves unbound class defaults — which is why the §0.12 mirror matters doubly here, pinned by `VoiceNoiseSuppressionSettingsConventionTests`, sabotage-verified): `Enabled=true · StartMode=OnAnswer · Engine=Krisp · Direction=Inbound · DisableModelNoiseReduction=false · Krisp{Model=krisp-viva-tel-v2.kef, SuppressionLevel=40} · AiCoustics{EnhancementLevel=0.5, VoiceGain=1.0, Family=sparrow, Size=s} · DeepFilterNet{AttenuationLimit=50, Mode=standard}`. Level 40 is the deliberate cautious start (suppression removes signal, including the breath/tremor cues the model reads emotion from) — owner ladder plan 40→60→80 with tone checks at each step. NO ARM/deploy.ps1 change (committed non-secret appsettings; deploy.ps1 wires neither these keys nor VadEagerness — verified).
- **Owner post-deploy tasks:** ladder the Krisp level (interruptions stopped AND post-call summaries still read caller tone); A/B `DisableModelNoiseReduction` vs far_field-only; check the next Telnyx invoice for a suppression cost code, the Plivo invoice for the unconfirmed ~$0.004/min audio-streaming line, and an August premium-AMD code at $0.0065/call.
- **Proof:** Functions unit **2189/2189** — ‼️ per §0.18 EVERY Telnyx call-control + payload-builder test now lives in THIS repo: the pre-existing `TelnyxCallControlServiceTests` + `RealtimeSessionPayloadBuilderTests` were MIGRATED OUT of the API suite (2026-08-16, owner-ordered) into `Clinqet.Communications.UnitTests/Voice/`, joining the new `TelnyxNoiseSuppressionCommandTests`, `RealtimeSessionPayloadBuilderNoiseSuppressionTests`, the function gating tests and the §0.12 convention mirror; the API repo kept only a standalone `RecordingHandler` helper for its two legitimately-API-owned Telnyx suites (number provisioning + WebRTC cred) and LOST the never-resolved `MockTelnyxCallControlService` + its dead `RemoveAll<IVoiceTelephonyProvider>` fixture pair (the API host never registers the seam) · Communications integration **8/8** (+2 on REAL Cosmos: suppression exactly once across a webhook redelivery; a rejected suppression command still dials the provider) · MCP host boots (health integration test) with the widened builder ctor. **NINE sabotages run — every new pin failed against its deliberately broken behavior and re-greened after restore** (Both-clamp, level clamp, eagerness default, accept-path omission, WS-path protection, StartMode gating, cap/private two-layer, redelivery guard, fail-soft). NO new container/query/index/queue/schema field; NO SQL/Cosmos change.

## RECENT CHANGES — 2026-08-14 (WhatsApp+SMS review Phase 3: one-channel invariant, chat tool allowlist, OTP gate, FULL voice cap bypass, auto-apply parity, suggestion ping)

- **‼️ DR-9 — EMAIL MEANS EMAIL on every voice document send.** The voice email leg re-enters the booking/quote/invoice email processors, which used to ALSO send an additive WhatsApp copy (the booking leg even auto-consented the caller). The three email messages (`BookingEmailMessage`/`QuoteEmailMessage`/`InvoiceEmailMessage`) gained `EmailOnly` (twin of `WhatsAppOnly`); `VoicePostCallProcessorFunction`'s three `vpc-doc-email-*` enqueues set it TRUE and the processors skip their WhatsApp add-on when set. Normal web/booking email flows are byte-unchanged (default false). The `VoiceSendChannelResolver` one-channel rule now genuinely holds END-TO-END.
- **‼️ DR-10 — the in-app CHAT assistant gets a tool ALLOWLIST; voice is untouched.** `Mcp:ChatToolAllowlist` (16 names — bookings/quotes/services/catalog/context reads; class default mirrored in the MCP **and** API appsettings, each pinned to the class default by its own repo's `ChatToolAllowlistConventionTests`). Enforced in TWO layers: `McpToolGuard` refuses a non-allowlisted tool on a chat session ("This tool is not available in chat sessions.", Refused audit row), and the API `McpToolGateway.ListCatalogAsync` filters the catalog the chat model ever sees. Chat sessions are identified STRUCTURALLY by the call-id prefix — `Clinqet.Shared.Constants.ChatToolSessions.CallIdPrefix` ("chat-"), minted only by the gateway; carrier call ids can never carry it. **send/verify/OTP + voice-call-only tools (send_my_details, send_quote, send_service_info, request_booking_verification, verify_booking_code, request_action_otp, verify_action_otp, prepare_action, leave_message, request_callback, end_call) are chat-refused** — a chat session could previously text OTPs to a business's booking customers. A NEW tool stays chat-invisible until deliberately added to the list.
- **DR-11 — the voice WhatsApp OTP leg respects a stored BLOCK.** `WhatsAppOtpService` (shared with the Identity login-OTP rail) now resolves the contact via `IWhatsAppConsentService` (alias-aware) and returns false on `Blocked` — the channel ladder falls straight to the next transport instead of paying a doomed Meta send. **OptedOut still receives the code** (auth traffic the caller just requested — same posture as SMS OTP); a consent-read blip fails OPEN (a Cosmos hiccup must never block a login). The MCP host now registers `IWhatsAppConsentService` + the two WhatsApp repos for this. Duplicate protection stays the existing state-before-send + `OtpMaxSendsPerCall` (verified sufficient — the send is synchronous, no redelivery exists); the all-channels-failed `VoiceOtpTransport` ops alert now rides a FORCED Service-Bus fallback (see AI-F5 below).
- **‼️‼️ DR-12 (owner: MUST) — AI-phone-call WhatsApp is FULLY CAP-BYPASSED end to end.** Every voice egress is now provably exempt from the provider plan cap: document rail (`DocumentDeliveryService` — BOTH branches now `CapExempt = true`; the free-form branch used to carry `BusinessId` un-exempted ⇒ a Free provider's caller-requested PDF was plan-blocked), link rail (already exempt), OTP (direct send, never touches the gate), and the booking fan-out — because **the ENTIRE `CommunicationDispatcher` WhatsApp rail is now `CapExempt = true`** (it is transactional by construction; the capped perk producers — provider new-message ping, CRM outreach, router provider-notify — all enqueue directly and stay capped). ‼️ The dispatcher was silently reusing `NotificationData["BusinessId"]` (deep-link metadata) as the billing key, plan-gating booking confirms. The WABA monitor still counts every send. **Free tier `whatsapp_template_cap` 0 → 10/day** (billing catalog v9 — owner: "free plan should not have a 0"); the ladder lives in `BillingCatalogDefinition.cs` → seeded to SQL entitlements, admin-tunable.
- **‼️ DR-13 — post-call AUTO-applied bookings behave exactly like live-call bookings.** `ICallFollowUpApplyService.ApplyAsync` gained `autoApplied`; the auto path creates the booking live-call-shaped (`AwaitingProviderConfirmation`, `CreatedBy=Customer`, `ConfirmedByCustomer=true`) instead of a silent Draft, and `AutoCreateSuggestionsAsync` enqueues the SAME `ActionSideEffects{BookingCreated}` message the MCP tools use (dedup `vpc-act-{callId}-BookingCreated-{bookingId}`) ⇒ provider one-tap Confirm/Decline + confirmation timeout + customer notified on confirm. A failed enqueue after a successful apply raises a FORCED SystemError alert (a booking nobody was asked to confirm must never be silent). MANUAL applies stay Draft (the provider is present). The strict full-date+time auto-apply gate is unchanged.
  - **D9 (2026-09-29) — no auto-apply for a business not taking bookings** (`BookingIntake.IsTakingBookings(profile)` = listed AND Active). `VoicePostCallProcessorFunction.AutoCreateSuggestionsAsync` drops every `DraftBooking` from the auto-apply set, and `CallFollowUpApplyService` throws `Error_BusinessNotTakingBookings` when `autoApplied` and the pause races (claim reverted). Either way it stays a Pending review card and the `CallSuggestionPending` ping below fires. Manual applies are not gated.
- **NEW `NotificationType.CallSuggestionPending`** (owner-requested): when a call leaves a Pending DraftBooking/DraftQuote suggestion the pipeline did NOT auto-apply (low confidence / incomplete date-time / failed auto-apply), the provider gets an in-app + push ping (`WorkIntake`, permission `voice.transcript.read`, `BusinessEventId.ForCall` durable id, `SkipEmail/SkipSms/SkipWhatsApp`), deep-linking to Call Follow-ups on web (`notificationNavigation.js`) AND mobile (`notificationNavigation.ts` + `PUSH_DEEPLINK_TYPES`) — review cards are never discovered by accident. Keys `Notification_CallSuggestionPending_*` in all five languages; catalog + echo-catalog + preference + SignalR whitelist entries all added (both hand-written test contract maps too). CreateCustomer-only pending suggestions do NOT ping.
- **3B fix pack:** the `send_service_info` failure notice now names `VoiceDocumentKind.ServicePage` (was hardcoded `Booking` — a live caller was told a nonexistent booking failed, AI-S4); `McpSecurityAlertService.SendAlertAsync` is now `forceAdminAlert: true` (a security/ops alert whose queue send fails still lands in Cosmos — one config flip can no longer silence the last line of defense, AI-F5); a failed share-marker write raises a cooldown-bounded ops alert (cap under-count + missing Call Follow-ups card were log-only, AI-F6); a delivery-outcome notice dropped for a LIVE session with no monitor logs a Warning (AI-F3); `DocumentDeliveryService` failure reasons carry the exception TYPE, never `ex.Message` (alert-dedupe + no internals, AI-F8); the dead `shared.SendWhatsApp && !shared.SendSms` term in `ServiceInfoTools.BuildResult` is gone (AI-S8 — the two `VoicePostCallProcessorFunction` "S8" sites are a DIFFERENT, live shape: `!SendSms && Channel==Sms` = fallback detection).
- **Verified COVERED BY PHASE 1 (recon predated it):** AI-S5 (ticketed claim-then-fail now alerts with `ticketConsumed:true` at both variants — `WhatsAppStatusProcessorFunction`) and AI-F2 (ticket-mint failure raises a Medium alert via `RecordAsync → Task<bool>` at the outbound processor).
- **Perf (AI-P1/P2 shipped; P3/P7 already-cached false positives; P4 net-negative):** `TryAutoConsentForSendAsync` gained a contact-passing overload — `DocumentDeliveryService` + `ServicePageDeliveryService` no longer resolve the contact twice (2 point-reads saved per send); a failed caller-requested SMS hands its uploaded SAS URL to the WhatsApp degrade (upload once). P3 (currency) sits behind `CountryResolutionService`'s IMemoryCache; P7 (per-iteration ListTools) sits behind the gateway's 5-min catalog cache; P4 (CRM ensure per quote send) would cost a marker write to save a rare redelivery find.
- **AI-S9:** committed `clinqetmcp/appsettings.in.json` now carries `WhatsApp:DocumentSms*=false` + `Voice:Sharing:SmsEnabled=false` — honest about the India posture deploy.ps1 forces (was inheriting base `true`s locally).
- Corrections to THIS skill made in the same pass: §14.2 premium deployment (2.1→2), §3.1 tool classes (9, `CatalogTools` + `ServiceInfoTools` in, `MarketplaceSearchTools` gone), §3.2 tool census (30 names — `find_services`/`send_service_info` in, `search_services` deleted), the 2026-07-31 "no deploy.ps1 change"/"mirrors exactly" lines, and the 2026-07-31 channel-rules claim that send_quote/send_my_details "still carry the older wantsEmail divert" (they don't — all three ride `VoiceSendChannelResolver`).

> **Brand vs code names.** Customer-facing brand is **"Clinket"**; the codebase/feature is
> **Clinqet / Voice Assistant**. The partner-app route is `/dashboard/profile/ai-assistant`
> but everything in code is `VoiceAssistant*` / `Voice*`.
>
> **Two different "AI assistants" — do not confuse them:**
> 1. **`clinqet-ai-assistant`** = the in-app **chat** assistant (text + speech, SSE streaming,
>    `AIAssistantController`, `McpService`/`McpAIService` in `Services/AI/`). Its "MCP" is an
>    in-process tool-orchestration layer over Azure OpenAI chat.
> 2. **`clinqet-voice-assistant` (THIS skill)** = the **inbound phone-call AI receptionist**.
>    Its "MCP" is a **separate ASP.NET web app** (`clinqetmcp/Clinqet.Mcp`) that speaks the real
>    Model Context Protocol over HTTP, to which the **Azure GPT-Realtime** voice model connects
>    directly during a live call.
>
> §-references below are to `CLAUDE.md` zero-tolerance rules.

---

## 0. WHAT THIS FEATURE IS (one paragraph)

A provider is invited (by an admin) to the Voice Assistant, fills out an application in the
partner app, and is assigned a **dedicated phone number** (a "voiceline"). Customers call that
number. The platform answers, plays a recording/AI disclaimer, then **rings the provider's real
phone** (forwarding number). If the provider answers, the two are bridged and the call is
transcribed in the background ("whisper"). If the provider **misses / declines / hangs up**, or
the call is **outside business hours** (per the line's `HoursMode`), an **Azure GPT-Realtime**
voice agent takes over the live call as an AI receptionist. The AI uses the **MCP server** to do
real work (look up/create bookings, quote prices, verify the caller, take messages, send a
WhatsApp/email). While the AI is live, an MCP **monitor** holds a WebSocket to Azure, persists
the transcript, and — only when the provider opens the **Call Follow-ups** page (or taps the
push) — streams it live over **SignalR**; the provider can **join** the call (browser WebRTC or
phone), at which point the AI announces the handoff and transfers the caller. After the call, a
function generates a **summary + follow-up suggestions** and meters minute usage. Two regions:
**Telnyx (Canada/US)** — shipped and the parity spec — and **India (Plivo)** — also shipped (GA),
running on Plivo's Multiparty Call + a WSS AI-media relay behind the same `VoiceCarrier` seam (see §10).

---

## RECENT CHANGES — 2026-08-11 (Phase B: catalog pre-resolve + India known-caller parity; D5 = 2.1 NOT SIP-supported, proven)

> **SUPERSEDED 2026-09-25 (D5 only):** the probe was confounded — our payload had sent `truncation` since 2026-08-07,
> which 2.x rejects (Microsoft, 2026-09-02). 2.1 and 2.1-mini joined the SIP list on 2026-09-23 and both tiers now run
> them. See RECENT CHANGES 2026-09-25b.

- **‼️ D5 RESOLVED EMPIRICALLY: `gpt-realtime-2.1`/`2.1-mini` FAIL on the Azure SIP path; `gpt-realtime-mini` works** (owner live probe, 2026-08-11). The SIP how-to's model list was the truthful doc; the 2.x overview's "same connection patterns" wording was wrong. **Model refresh waits for Microsoft** — standard stays `gpt-realtime-mini`, premium stays `gpt-realtime-2`, never a per-region tier split; re-check the SIP list at every phase boundary.
- **B1 — the handoff no longer pays the Map-mode index probe inline.** NEW `IVoiceCatalogBindingResolver`/`VoiceCatalogBindingResolver` (`clinqetinfrastructure/Services/Voice/`, functions-host-only registration): caches the `ResolveSourceAsync` verdict (`voice_catsrc_{businessId}`, Size=1; Index → `Mcp:ProviderContextCacheMinutes` TTL, **Cosmos → 60 s const** — a Cosmos verdict also covers a probe FAILURE inside ResolveSourceAsync, and pinning that for the full window would route calls off the index for minutes). **The REGIME always derives from the (cached) context read, never from this cache** — regime staleness stays the documented 5-min window (pinned by `RegimeAlwaysDerivesFromTheContext_NeverFromTheCache`). Both function twins' `ResolveCatalogBindingAsync` are now thin fail-soft wrappers over it (duplicated logic deleted); both warm paths pre-run it during the ring.
- **‼️ FOUND ON THE WAY: the Plivo FUNCTIONS host never warmed its own caches.** `WarmMcpContextIfEligible` fired only the cross-process MCP POST (for the relay's prompt), so the functions-host handoff-time resolve (context + probe) was ALWAYS COLD on India. It now also runs the in-process warm (context + known caller + catalog binding), mirroring Telnyx's `WarmAiContext`.
- **B2 — India callers finally get the known-caller experience.** The relay passed `knownCaller: null` since Plivo shipped. Fix is the courier pattern (the identity service needs SQL via `IDbContextFactory<AppDbContext>`; the MCP host has NO SQL): the Plivo handoff resolves the caller (parallel with the catalog resolve — one wait, not two; warm makes both memory hits) and stamps `KnownCaller*` onto the session in the SAME handoff CAS; `PlivoVoiceRelay` builds the `KnownCaller` from the binding doc it already loads for auth and hands it to the SHARED `BuildWebSocketSessionPayload` ⇒ the existing pinned known-caller prompt block now emits on India. Zero new I/O anywhere.
- **B3 (voiceline read caching) REJECTED (D10):** ~1 RU/~2 ms × 8 hops is negligible, and caching would serve stale `Status`/`PrivateMode`/cap state to CALL-CONTROL decisions — a paused/private line could keep getting AI-answered for the TTL.
- **Proof:** Functions unit 1893/1893 (+5 resolver tests, +2 Plivo known-caller pins) · MCP relay pins `HandleStream_KnownCallerOnBinding_ReachesThePayloadBuilder` + null-case. Sabotage-verified BOTH ways: relay reverted to `null` ⇒ the pin failed alone; resolver cache write disabled ⇒ both memory-hit pins failed. NO new container/query/index/queue/setting/schema field.
- **C1 (same day, owner decision D12): the English-transcript translation is OPT-IN, DEFAULT OFF** — `Voice:VoiceCall:StoreEnglishTranscript = false` (class default mirrored). The original-language transcript is the record; the post-call SUMMARY still arrives in the partner's preferred language (separate call, unchanged). Kills the second AI call (up to 8,000 output tokens) on every non-English call. Key lives ONLY in the Functions appsettings. Pinned both ways + sabotage-verified. **C4:** unused `Microsoft.Extensions.Http.Polly` removed from the MCP csproj (zero usage in Clinqet.Mcp source; infrastructure's resilience flows transitively).
- **C2 (same day, owner GO — D14): TRANSCRIPT WRITE BATCHING, both carriers.** The per-line `AppendSegmentAsync` is GONE — `IVoiceTranscriptRepository.AppendSegmentsAsync(list)` writes chunked patches (≤9 appends + `updatedAt` Set = the Cosmos 10-op cap; `EnableContentResponseOnWrite=false` — the doc grows every turn), 412-cap stops the whole batch, 404→create carries the chunk, 409→re-patch. Lines buffer per call in `Monitor/TranscriptFlushBuffer` (single-flight `SemaphoreSlim`; failure RE-QUEUES AT THE FRONT so order survives). Flush triggers: count ≥ `Azure:Realtime:TranscriptFlushMaxSegments` (5) · age ≥ `TranscriptFlushIntervalMs` (2500; dedicated 1s per-call poll loop — ‼️ deliberately NOT the idle watchdog, which `IdleRepromptSeconds<=0` can turn off; the try sits INSIDE the loop so one bad tick never kills it) · every OUTBOUND line (a completed exchange is always durable) · **teardown `DrainAsync` (3 attempts × 750ms — the LAST writer; a single transient would otherwise lose the tail) FIRST in both finallys, before even the marker delete**. Kill switch: MaxSegments≤1 or IntervalMs≤0 ⇒ one write per line. Live SignalR fan-out stays per-line.
- **‼️ ORDERING IS CHECKED, NOT TIMED — two half-guarantees:** (1) AI-engaged A-leg `CallEnded` (session.`AzureCallId != null`) is SCHEDULED +`VoiceCall:PostCallTranscriptSettleSeconds` (5; 0=off; same `vpc-end-{callId}` dedup id; non-AI immediate); (2) `ProcessCallEnded` gates Receptionist summaries on the TEARDOWN MARKER — `GreetingSentAtUtc`/`RealtimeUsage` on the session doc are written by `RealtimeUsagePersistence` AFTER the drain, so their presence PROVES the drain landed; absent ⇒ bounded reschedule (`TeardownWaitAttempt` on `VoicePostCallMessage`, ≤2 × settle-seconds, dedup `vpc-end-{callId}-t{n}`), then summarize as-is (a monitor that never attached never produces the marker — those calls just wait ~10s extra).
- **Audit fixes shipped with it (2 hostile audit agents over ALL A/B/C changes):** Plivo relay drains BEFORE the live-marker delete (was after — carrier asymmetry); relay finally no longer enqueues `CallEnded` on HOST SHUTDOWN (`_stoppingCts` gate — a mid-call snapshot would dedup away the REAL one for 40 min; Telnyx already gated); ‼️ Plivo hangup stamps `Phase=Ended` ONLY when the enqueue landed (Plivo can't 500-replay; a swallowed enqueue + Ended stamp made the relay's +120s backstop skip ⇒ summary lost forever); relay `ActivateBindingAsync` now OBSERVES the CAS result (loud stable marker on failure — join routing + stamps degraded, call continues).
- **Accepted residuals (recorded in DECISIONS.md):** hard process crash loses ≤ the unflushed window (recording-based transcription covers recording-on calls); a Cosmos outage outlasting the drain budget loses the re-queued tail (logged with count); cap overshoot ≤ 1 chunk; ‼️ **OPEN runtime pin: SB duplicate-detection semantics for SCHEDULED messages (send-time vs activation-time registration) are UNVERIFIED — three code comments assume the A-leg copy beats the monitor's +120s copy; verify on dev (schedule two same-id messages) before trusting settle timing on AI-terminated ends** (worst case = correct-but-120s-late summaries, never loss); the vnext emulator 500s on FilterPredicate PATCH so the cap/chunk semantics are unit-pinned only — exercise live on the next dev probe calls; Plivo stamps KnownCaller PII at handoff (Telnyx at accept) — engagement-failure calls carry it until doc TTL; the catalog Index verdict's staleness can compound to ~2× the context window (probe consumes a cached count) — bounded, fail-soft.
- Program tracker updated (`C:\Nik\ai-assistant-improvement\DECISIONS.md` D9–D14). Open carryovers: protocol-revision probe, eval harness (A4), latency baseline → they unlock C3 (prompt-token audit) + B5 (reasoning `minimal`).

## RECENT CHANGES — 2026-08-10 (MCP SDK v2.1.0 + answer-latency stamps — improvement program Phase A, SHIPPED at code level)

- **Program tracker: `C:\Nik\ai-assistant-improvement\`** (README/FINDINGS/PLAN/DECISIONS). Objectives: MCP stateless v2 migration · performance · cost · quality — **zero degradation, both regions**.
- **‼️ MCP SDK `ModelContextProtocol.AspNetCore` 1.4.0 → 2.1.0** (server + IntegrationTests). The host was ALREADY stateless (`Stateless = true` since inception), so this adopts the **2026-07-28 protocol revision** (discovery-first, no initialize, per-request metadata) with ZERO source changes to production code — the whole solution compiled with 0 errors and 0 MCP900x deprecation warnings. MCP unit 548/548 · integration 65/65. The `McpClient`-driven integration tests now negotiate the NEW revision (primary contract); the pre-2026-07-28 `initialize` body is retained ONLY as the named `LegacyInitializeBody` compat probe in `McpChannelSecurityTests` (the Azure realtime MCP connector's revision is UNVERIFIED — probe pending, Phase A3). `RawProtocolBindingTests` pins the bare-`tools/call` stateless shape AND the DI-string schema-drop guard, both green on v2.
- **‼️ ANSWER-PATH LATENCY IS NOW MEASURED (it never was before — zero instrumentation existed).** 4 owner-approved nullable UTC fields on `VoiceCallSession`, each riding an EXISTING write: `HandoffAtUtc` (handoff CAS, both carriers) · `RealtimeWebhookAtUtc` (Telnyx `realtime.call.incoming` arrival / Plivo relay stream arrival) · `AcceptedAtUtc` (accept POST returned / relay `session.update` sent, in the accept/activate CAS) · `GreetingSentAtUtc` (**rides the `RealtimeUsagePersistence` teardown courier write** — the monitor/relay `MarkGreetingSent` in-memory tick, persisted at teardown; `PersistAsync` now takes `greetingSentAtUtc` and writes when usage OR greeting exists). `ProcessCallEnded` reads the session once (`ReadSessionTelemetryAsync` — unconditional; usage still gated on `UsageTelemetryEnabled`), logs one structured line **"Voice answer latency for call …"** (handoff→webhook / webhook→accept / accept→greeting / total) and adds additive analytics key **`answer_ms`** to the outcome metadata. **Negative (cross-host clock-skew) legs are DROPPED, never charted.** Pinned at all 4 sites + sabotage-verified (3/4 pins failed against a broken write).
- **Fixture hardening:** `ClinqetMcpFactory` no longer claims fixed host port 8081 (collided with another project's emulator) — random host port + **`LimitToEndpoint = true`** on BOTH fixture Cosmos clients (‼️ the vnext emulator advertises its in-container port in account topology; without LimitToEndpoint the Gateway SDK follows it onto whatever owns 8081 on the host).
- **Known facts re-verified for the program:** premium model is `gpt-realtime-2` (code + appsettings; §14.2 below was corrected 2026-08-14); `Voice:Catalog:EmbedThreshold` = 60; **India relay passes `knownCaller: null`** (parity gap — Phase B fix); the SIP how-to model list (updated 2026-07-31) still omits `2.1`/`2.1-mini` while the 2.x overview implies transport parity — **contradiction resolved by a live dev probe call, not by either doc** (DECISIONS.md D5).

## RECENT CHANGES — 2026-07-31 (`send_service_info` — "send me the photos/details" → the provider's own public page, SHIPPED)

- **The gap:** callers kept asking the receptionist to SEND them things — *"can you send me the details / the photos of this machine / your timings / your business profile"* — and the only send tools were `send_my_details` (the caller's OWN booking/invoice PDF) and `send_quote` (a priced document). Neither fits, and the FULL-mode prompt actively said *"do NOT treat the word 'details' as a reason to call a tool"*, so the model answered out loud and sent nothing. **Owner's ranking: a hit on the provider's public service page is worth far more than a quote** (provider analytics + Google indexing) — but the quote must NOT be demoted.
- **NEW MCP tool `send_service_info`** (`clinqetmcp/Clinqet.Mcp/Tools/ServiceInfoTools.cs`, Scope-C, 9th tool class): `serviceId? · channel? · email?`. With a serviceId it sends the offering's public page; **omit it and the BUSINESS's own Open Page goes instead** (covers "send me your profile / your timings / where are you"). Channel ladder mirrors `send_my_details` (whatsapp default → email → 'sms'/'text') — *(correction)* not "exactly": the link rail's SMS leg carries the extra `Voice:Sharing:SmsEnabled` AND-term (`VoiceLinkSmsGate`).
- **‼️ The URL is composed EXACTLY as `ServicesSitemapService` builds sitemap URLs** — NEW `clinqetcore/Utilities/ServicePageLink.cs` (`ServicePageLinkBuilder`) over the existing `SeoSlug` + `Sitemap:CanonicalOrigin`. A shared link is therefore **byte-identical to the canonical we hand Google**, so every tap reinforces the page we are ranking instead of splitting signal across a variant. `{origin}/{Uri.EscapeDataString(providerSlug)}/services/{SeoSlug.BuildServiceSlug(name, serviceId)}`; providerSlug = `BusinessProfile.FriendlyName ?? BusinessId` (businessId always resolves and 301s to the canonical, so it is the correct fallback, not a reason to refuse).
- **‼️ NEVER a 404: both gates are the SHARED ones, not re-stated predicates** — `ProviderPublicVisibility.IsPubliclyListed` + `ServiceIndexGates.IsIndexable`. A link is offered for exactly the pages that render. An unpublished offering returns a DATA result whose note says *"Do NOT tell the caller it does not exist"* (it exists — it just has no public page).
- **‼️ SPEECH RULE — the caller asked for photos, not a URL.** The prompt now BANS the words *link / page / website / URL / address / site* to the caller, and both the prompt and the tool's returned note tell the model to name **what they asked for in their own words**: *"I'm sending you the photos now" / "…all the details now" / "…our timings now"*. Naming the transport is what makes an assistant sound like a website instead of a person. Pinned by `Build_Instructions_NeverLetTheAssistantSayLinkOrPageToTheCaller` + `SentNote_TellsTheModelToUseTheCallersOwnWords_AndBansLinkJargon`.
- **Quote vs details resolved by ORDERING, never by interrogating the caller** (owner-locked): a SEND request for information/photos/timings ⇒ `send_service_info`; a request for a **PRICE IN WRITING** ⇒ `send_quote`; genuinely ambiguous ⇒ send the page (it already shows the price) and offer the written quote in ONE short line. The prompt explicitly forbids *"do you want a quote or the details?"* as a gate. The pre-existing "answer 'details' from the profile" rule is retained byte-identical and carved: *"that is when they are ASKING you out loud; being asked to SEND them something is a different request."*
- **Quote pull-through (owner decision — NOT a silently-created Quote):** a service-page share records a **Pending `SuggestedActionType.SendQuote`** card the provider applies with one tap in Call Follow-ups. Zero junk entities, zero extra cost (rides the existing pending-suggestions array), and it is suppressed when the same offering was already booked or quoted live on the call. `Voice:Sharing:QuoteFollowUpEnabled` toggles it.
- **‼️ `SuggestedActionType.SharedDetails` needs its OWN branch in `AppendPendingSuggestions`** — it carries no `CreatedEntityNumber` (the thing sent is a public URL, not a record), so without the branch it fell through to the generic **Pending** path and rendered as a dismissible draft with no link. It now lands `AutoCreated` + `Verified=true`. Caught by the end-of-build audit, pinned by `Run_CallEnded_SharedDetails_LandsAsAnInformationalCard_NotAnApplicableDraft`.
- **‼️ Every send is `CapExempt = true`.** Without it, a **Free-tier provider (WhatsApp cap 0) would PLAN-BLOCK a page the CUSTOMER asked for** and fire an upgrade nudge + admin alert at the provider. This is the D8 "customer-is-king" rule; `BusinessId` is retained purely for attribution and the WABA monitor still counts the send. Pinned both window states.
- **Delivery = NEW `IServicePageDeliveryService`** (`clinqetinfrastructure/Services/Communication/ServicePageDeliveryService.cs`), deliberately SEPARATE from `IDocumentDeliveryService`: there is no PDF, no blob and no SAS, and **in an open 24h window a link is a FREE interactive CTA-URL message** (`WhatsAppMessageKind.InteractiveCtaUrl` — no template, no Meta approval, no send-cap cost), not a document. Folding it into the PDF rail would have pushed a link-shaped branch through five methods on the money path. Consent gate, window snapshot, idempotency and SMS behaviour are otherwise identical. Missing/key-echoed in-window copy ⇒ degrade to the TEMPLATE (whose copy lives at Meta) rather than ship an empty body Meta rejects.
- **Queue: NEW `VoicePostCallKind.SendLink`** + `VoicePostCallMessage.Link` (`VoiceSharedLink{Kind,Url,Path,Subject,ServiceId,Send*,RecipientEmail}`). The MCP tool resolves + visibility-gates the link ON THE LIVE CALL and carries it; the functions host only delivers. Url/Path/Subject are carried rather than re-derived so the WhatsApp message, the email, the SMS and the provider's Call Follow-ups card can never disagree. Dedup id `vpc-link-{callId}-{pageKey}-{channelTag}`, page-scoped so a caller comparing two offerings receives both.
- **Email = STRUCTURED ONLY (owner decision — no free-form AI-authored email).** New localized `ServiceDetailsEmail.html` in en/es/fr/gu/hi on the generic `EmailNotificationMessage` rail (`PreferenceCategory = null` — the caller is not a platform user with preferences and asked for it on the call). Rejected: a tool letting the model compose subject+body — it would be the only unlocalized customer-facing copy in the platform (§0.10), it is forwardable/screenshot-able in the PROVIDER's name (a prompt-injected caller could manufacture a written commitment), and nothing model-authored has ever left the platform in writing (`leave_message` stores the caller's words as DATA).
- **SMS = Canada/Telnyx only.** *(Superseded detail — see the 2026-07-31 "Link-share SMS" section: the link rail gained its OWN `Voice:Sharing:SmsEnabled` switch + `VoiceLinkSmsGate`, which ANDs with the shared `DocumentSmsGate`.)* +91 stays excluded unconditionally (2Factor/DLT). WhatsApp + email work in BOTH regions.
- **India (Plivo) works by construction**: `send_service_info` is added inside `ResolveAllowedTools`, which feeds BOTH `BuildAcceptPayload` (Telnyx SIP accept) and `BuildWebSocketSessionPayload` (the Plivo relay's `session.update`), and `BuildInstructions` is shared. Pinned by a `[Theory]` over both carriers. `Voice:Sharing:{Enabled,MaxSharesPerCall,QuoteFollowUpEnabled}` + `Sitemap` are committed base appsettings; *(correction)* `Voice__Sharing__SmsEnabled` IS deploy.ps1-wired (5 places, forced "false" on the `in` stamp — see the Link-share SMS section).
- **Kill switch `Voice:Sharing:Enabled`** (default true) removes the tool from `allowed_tools` **AND every mention of it from the prompt** — including the "Staying responsive" line, which named the tool unconditionally in the first implementation and was caught by its own test. An AI that knows a capability exists will promise it. `MaxSharesPerCall` (4) bounds per-call cost/reputation; the counter IS the SharedDetails marker count, so the cap read is free.
- **In-call outcome notices**: `VoiceDocumentKind.ServicePage` added (notice payload only) so `VoiceDocumentDeliveryNoticeItem` words a SentAsText/DeliveryFailed update as *"what you sent the caller about X"* instead of "document"; `DocumentKindFromNotificationType` maps the shared marker `VoiceSharedLink.NotificationTypeMarker` ("VoiceDetailsLink") so an ASYNC SMS fallback announces the right thing.
- **Meta templates — `clinket_details_ready`, UTILITY, LIVE on BOTH WABAs** (CA `1302322178177914`: en_US/es/fr_CA/gu/hi · IN `2518598361929331`: en_US/gu/hi). Body `Hi! As you asked on your call with {{1}}, here is everything about {{2}} in one place — photos, full description, prices and opening hours. Tap below to see it all.` · footer `Sent by Clinket at your request.` · URL button `See full details` → `https://www.clinket.com/{{1}}` (the PATH is the send-time param). ‼️ **`"you asked for on your call"` is what earns UTILITY** — it states the agreed request Meta's utility test requires; the proof file shows sales framing is exactly what got earlier templates classed MARKETING.
- **‼️ A dynamic URL button variable whose VALUE contains `/` IS accepted by Meta** (`https://www.clinket.com/{{1}}` + `sparkle-salon/services/keratin-…-3d4e5f6a`) — verified at creation AND through approval. No link-shortener or extra redirect route is needed.
- **‼️ THE PROOF PROTOCOL EARNED ITS KEEP: Gujarati came back APPROVED but as MARKETING** while en/es/fr/hi all landed UTILITY from a structurally identical body. Fix was lexical — `ભાવ` (market rate) → `કિંમત` (price), `બધી માહિતી` → `પૂરી માહિતી`, mirroring the Hindi that passed — resubmitted under a fresh throwaway name and approved UTILITY. **Never submit a production template name in a language you have not proven; `allow_category_change:false` did NOT force a rejection, Meta simply approved it into MARKETING.** All 3 proof names deleted after production approval; they were never in runtime config.
- **Tests:** API unit **7655** · MCP unit **511** (+14 `ServiceInfoToolsTests`) · Functions unit **1726** (+6). New: `ServicePageLinkBuilderTests` (15 — both gates, slug parity, non-Latin names, URL escaping), `ServicePageDeliveryServiceTests` (13 — in-window CTA vs template, SMS gate both directions, CapExempt, idempotency, page-scoped dedup, empty-copy degrade), payload-builder theory over both carriers + kill-switch. ESLint 0 on `callFollowUps/`, mobile `tsc` 0.
- **NO new Cosmos container, query, index or queue. NO ARM/deploy.ps1 change.** New settings: `Voice:Sharing:{Enabled,MaxSharesPerCall,QuoteFollowUpEnabled}` (Functions + MCP), `Sitemap` bound in the MCP host (already in API + Functions).
- **Accepted residuals (documented, not bugs):** `ApprovedLanguages` is one shared config while the India WABA carries only en/gu/hi — a French/Spanish-preferring recipient on the `in` stamp would resolve a template that WABA lacks (identical to the shipped `clinket_ai_autorecharge_failed` posture; the registry otherwise falls back to `en`, which exists on both). The model-supplied `email` parameter is an email-send primitive to an arbitrary address, bounded by `MaxSharesPerCall` + `McpToolRateLimiter` — the same shape `send_quote` has carried since it shipped, not a new exposure. A stale denormalized `FriendlyName` yields a businessId URL that 301s (same staleness the search index accepts).

## RECENT CHANGES — 2026-07-30b (tier/model DECOUPLING + gpt-realtime-2.1 premium + gpt-4o-mini-transcribe sidecar, SHIPPED)

> **SUPERSEDED IN PART 2026-09-25:** the model names below (premium `gpt-realtime-2`, standard `gpt-realtime-mini`,
> "2.1 is NOT on the SIP list") are history — both tiers run 2.1 now (2026-09-25b). The tier decoupling and the
> "check Azure's SIP list before any model bump" rule still stand.

- **‼️ Voice tier ids are now MODEL-AGNOSTIC: `standard` | `advanced`** (`Clinqet.Shared.Constants.VoiceTierIds`, the ONE comparison authority — `IsStandard()`/`Canonical()`). The old ids (`mini`/`realtime-1.5`) baked a MODEL NAME into stored data and admin UI; every model upgrade would have re-touched both. Now the tier→model map lives ONLY in `Azure:Realtime:DeploymentDefault/DeploymentPremium` + deploy.ps1. **Legacy stored ids keep their exact semantics forever** (`mini` ⇒ standard, anything else ⇒ advanced — identical to the old `!= "mini"` rule; null/blank ⇒ standard) — no data migration, test-pinned via legacy theories. All five comparison sites now use the helper: `RealtimeSessionPayloadBuilder` ×2, `PlivoVoiceRelay`, and BOTH `ResolveAmdDetectionMode` copies. `AllowedModelTiers` = `["standard","advanced"]`, `DefaultModelTier` = `standard` (API appsettings + class defaults + integration fixtures). Analytics `model_tier` metadata is **canonicalized at write** (legacy ids land as standard/advanced — new partition values; historical mini/realtime-1.5 rows remain, additive-only reader contract holds).
- **‼️ THIS FIXES A REAL LATENT BILLING BUG:** `AiAddOnService.EnsureProvisioningAsync` provisions the voice tier as `VoiceModelTier.ToString().ToLowerInvariant()` = `"standard"`/`"advanced"` — which the OLD allow-list (`mini`/`realtime-1.5`) ALWAYS REJECTED, and the exception was swallowed at Information level. **Paying for the Advanced AI add-on never actually upgraded the voiceline's model.** With aligned vocabularies the billing→voice hand-off works as the enum's own doc always claimed ("maps to Voiceline.ModelTier on provisioning") — pinned by `SetModelTierAsync_AcceptsEveryLowercasedVoiceModelTierEnumName`. **Behavior activation:** an Advanced add-on purchase/upgrade now REALLY flips the line to the premium model (and the admin endpoint remains the manual override).
- **‼️‼️ MODEL-BUMP RULE — DEPLOYABLE IN FOUNDRY ≠ USABLE ON THE VOICE PATH.** The Telnyx CA/US leg terminates on the **Azure SIP trunk**, which validates the realtime model server-side at accept, and Azure keeps a SEPARATE, SHORTER **SIP supported-models list** than its general model catalog. `gpt-realtime-2.1` / `gpt-realtime-2.1-mini` (2026-07-07) deploy cleanly in Foundry and are priced identically to their predecessors — **but are NOT on the SIP list** (checked 2026-07-30; the list IS actively maintained — it carried a 2026-07-29 model version that same day — so this is a real gap, not doc lag). Pointing `DeploymentPremium` at 2.1 would have failed every CA/US premium call at accept. **Before ANY realtime model bump, check the list first: learn.microsoft.com/azure/foundry/openai/how-to/realtime-audio-sip.** The constraint is now written at both decision points (`AzureRealtimeSettings.DeploymentPremium` + deploy.ps1's realtime deployment list). India (Plivo) is EXEMPT — its WSS relay carries no such restriction, so a model can be India-only usable; do not let that tempt you into a per-region split of the same tier.
- **Premium is `gpt-realtime-2` (version `2026-05-06` per the live portal; the SIP doc prints 2026-05-07 — the portal is authoritative).** SIP-listed, adds configurable reasoning effort + response phases (useful on complex catalog calls), and costs **exactly what 2.1 costs**: $4 text-in / $32 audio-in / $0.40 cached / $24 text-out / $64 audio-out per 1M. vs the old 1.5 only TEXT-OUT differs ($16→$24) — spoken replies bill as AUDIO, so the real delta is tool-call arguments only, pennies per hundred calls. `gpt-realtime-1.5` is retained as `$openAiRealtimePremiumPreviousName`, the guard's fallback, until 2 is verified on a live call.
- **Standard stays `gpt-realtime-mini`.** `gpt-realtime-2.1-mini` is a **$0.00 delta** — every one of the six unit prices is identical to gpt-realtime-mini (Azure Retail Prices API, both regions, Global + Data Zone) — so it is a free quality upgrade *on paper*, but it is blocked by the SAME SIP gap; taking it now would upgrade India only and split one tier's behavior across regions. Deploy Global Standard, never Data Zone (DZ meters exist but no realtime model appears in the DZ availability table, and DZ is ~10% dearer).
- **‼️ NEVER "upgrade" to `gpt-4o-realtime-preview` / `gpt-4o-mini-realtime-preview` because they appear on the SIP list** — they are the **Dec 2024 first-generation preview** models, ~18 months older than the GA gpt-realtime family, and they **predate `semantic_vad`**, the word-aware turn detection that is the platform's main defense against background speech. They are on that list for backwards compatibility only; adopting them would silently undo the noise work.
- **‼️ `whisper-1` may never have been valid on Azure.** The Azure realtime reference carries an explicit deviation: `input_audio_transcription.model` takes **the name of a model DEPLOYMENT**, "not a raw model ID like `whisper-1`" (Microsoft staff confirmed, 2026-07) — and there was no Whisper deployment in the account. Azure's own realtime how-to still shows `whisper-1` in an example, so it is contradictory; whether it was silently accepted or caller-side transcription was quietly empty is **UNVERIFIED — check a recent AI-answered call for inbound/caller transcript lines**. Either way `gpt-4o-mini-transcribe` (a real deployment, passed by name, version 2025-12-15) is correct by the documented contract AND half the price.
- **Transcription sidecar → `gpt-4o-mini-transcribe`** (version 2025-12-15): ~90% fewer noise hallucinations than whisper AND **half the price** ($0.003/min vs $0.006+). ‼️ **The realtime model's HEARING is untouched — it consumes raw caller audio natively (speech-to-speech, tone/emotion intact); the sidecar only produces OUR text** (live transcript, VoiceTranscript, summary, suggestions) and is never fed back into the model. On Azure the sidecar is now OUR deployment (whisper-1 was built-in) — deployed to BOTH voice Foundry accounts (shared East US 2 + India Sweden Central), capacity `-OpenAiTranscribeModelCapacity` (50K default, standard quota pool).
- **‼️ deploy.ps1 effective-deployment guard (`Resolve-VoiceDeploymentEffective`)** — the model-deployment loop only WARNS on failure, and the app settings used to blindly wire the variable name: a failed 2.1 create would have pointed every premium call at a NONEXISTENT deployment. Now the script GET-probes what actually landed per account and wires that: premium ⇒ 2.1 if present, else `gpt-realtime-1.5` while it exists ([DEGRADED] red warning), else preferred-name + warning (the pre-existing fresh-stamp "voice unwired until quota" semantics — never a hard abort); transcribe ⇒ deployment if present, else literal `whisper-1` (yesterday's behavior). Per-stamp resolution (`$script:realtimePremiumDeploymentEffective`/`realtimeTranscribeModelEffective`) — CA and IN probe their own accounts. The 1.5 deployment is **deliberately never deleted by the script**; retire it manually after 2.1 burn-in (quota: both premium deployments allocate realtime TPM while coexisting).
- **MCP app-settings gap closed:** the MCP host consumed `DeploymentDefault/DeploymentPremium` (Plivo relay) via silent C# class defaults — deploy.ps1 now wires `Azure__Realtime__DeploymentDefault/DeploymentPremium/InputTranscriptionModel` to the MCP app (live + paste blocks), and `clinqetmcp/appsettings.json` carries them for local dev.
- **Admin UI (`VoiceAssistantRequestsPage.jsx`)**: MODEL_TIERS = Standard/Advanced — **no model names anywhere**; the raw-id detail row now renders the normalized label; select/save/compare all normalize legacy stored ids (`normalizeModelTier`). Partner web `billingTiers.js` + mobile `tierDisplay.ts` mappers updated (`'mini' || 'standard'` ⇒ Standard — ‼️ without this every new standard line would have displayed as "Advanced").
- **NO new container / query / index / queue.** New deploy params: `-OpenAiRealtimePremiumModelVersion`, `-OpenAiTranscribeModelCapacity`. Owner deploy step required: run deploy.ps1 per stamp (creates the 2 new deployments + rewires app settings); verify `[OK] gpt-realtime-2.1` + `[OK] gpt-4o-mini-transcribe` and NO `[DEGRADED]` lines; then one dev test call per tier.
- **‼️ END-OF-SESSION AUDIT — activating the billing→voice hand-off had activated only its UPGRADE half; 4 findings fixed + pinned.** (1) **A scheduled Advanced→Standard downgrade flipped the paid tier in SQL at the period boundary and NEVER re-provisioned the voiceline** — the provider paid Standard while the line kept running the premium model, forever, with no expiry (direct margin leak). (2) The mirror case: the settled end-trial-upgrade **crash-recovery** branch recovered `ModelTier`/`Interval` in SQL but never provisioned ⇒ a provider who PAID for Advanced ran Standard. Both fixed via a new `IAiAddOnService.ProvisionVoiceTierAsync` (best-effort by contract, never throws/fails billing) called from `FinalizeAddOnRenewalAsync`'s new `provisionVoiceTier` flag — passed only on the paths where the tier actually CHANGED (a plain renewal must not spend a Cosmos write re-asserting an unmoved tier; pinned both ways). ‼️ **Rule: any future path that changes the PAID tier must provision the runtime line — SQL-only tier changes are silent mis-serving in one direction and margin leak in the other.** (3) `CallSummaryUsageRow` groups by the RAW stored tier id ⇒ a transition month yielded two rows for the same (path, tier) — the web list keyed safely but **mobile used `key={row.path}` = duplicate React keys**; `GetUsageAsync` now folds on `VoiceTierIds.Canonical` (also heals history) and both `VoiceUsageDto.ModelTier` + breakdown rows are canonical; mobile keys by `path-modelTier` and its `VoiceUsage.breakdown` type gained `modelTier` (caught by tsc). (4) A failed tier write after a SUCCESSFUL charge was logged at Information — now a Warning with a stable greppable marker (a not-yet-provisioned assistant stays the benign common case).
- **Known/accepted:** legacy `mini`/`realtime-1.5` ids linger in old Cosmos docs (resolved forever by `VoiceTierIds`, decaying as admins re-save); a business with calls under both a legacy and canonical id shows two usage-breakdown rows with the same label (cosmetic, pre-prod); `CallSummaryUsageRow` groups by the RAW stored tier id.

## RECENT CHANGES — 2026-07-30 (playout-anchored watchdogs — the AI no longer talks over itself + live-call UX fix pack, SHIPPED)

- **‼️ THE BUG: every watchdog clock measured from GENERATION end, not PLAYOUT end.** The model generates several× faster than the phone plays out (a 16 s spoken answer finishes generating in ~2 s), so the idle clock saw "silence" while the caller was still HEARING the answer, sent the idle reprompt mid-playout, and Azure queued its audio BEHIND the still-playing answer ⇒ **"just checking you're still there?" spoken back-to-back with the AI's own sentence** (the 2026-07-30 dealer-call incident, twice in one call, premium tier). The join ring filler had this exact fix since 2026-07-09 ("response.done is NOT when the caller stops hearing it") — the idle ladder, farewell-grace close, and end-call drain did not.
- **Playout anchor on every clock, both carriers.** Telnyx (`VoiceSessionMonitor`, text-only observer socket — never sees audio): playout is ESTIMATED per spoken turn (`AccrueSpokenPlayout`: words × `Azure:Realtime:SpokenPlayoutMsPerWord` — NEW setting, default 480, <=0 disables — from response.created + TTFB, queuing behind audio already playing), released EARLY by the server-paced `output_audio_buffer.stopped`/`cleared` events (empirically present on SIP sideband sockets but occasionally seconds LATE — a hint, never the sole gate) and by a caller barge-in (`speech_started` ⇒ the server truncates SIP playback). India (`PlivoVoiceRelay` — the relay forwards every audio delta itself): playout is EXACT byte math (`AccruePlayoutMs`: μ-law = bytes/8 ms, PCM16-24k = bytes/48 ms; barge-in clearAudio resets). Anchored clocks: **idle ladder** (idle = silence from `IdleAnchorUtc` = max(last event, playout end); never acts while `SpeakingRemainingMs > 0`), **farewell grace** (`ArmFarewellClose` stamps playout end), **end-call drain** (`BeginHangup`/`OnTurnComplete` pull to playout-end + drain, ceiling-capped — a generation-end drain clipped long goodbyes at `EndCallAudioDrainMs`=1500).
- **‼️ Watchdog gate is now true in-flight counting.** `ResponseActive` is cleared EARLY at transcript.done while an MCP tool call still runs inside the same response — gating on it let the idle ladder burn through and HANG UP a live call mid-tool-call (~36 s into a slow lookup, then enqueue a normal-looking summary) and made the slow-reply reassure fire into a rejected `response.create`, consuming its one-shot arm. Both watchdogs now also gate on `ResponsesInFlight > 0`.
- **Farewell-close hardening (premature-hangup class, both carriers):** (1) the arm reflects the LATEST model turn — a later non-farewell turn DISARMS (was sticky: "…call back anytime — morning or afternoon?" hung up on a caller thinking about the model's own question after the 6 s grace); (2) `IsFarewell` matches only the transcript TAIL (const 80 chars — a genuine goodbye ENDS the turn; the relay copy was missed on the first pass and caught by its own new test); (3) `input_audio_buffer.speech_started` disarms immediately — input transcription lags real speech by seconds and the old transcription-only disarm hung up on callers mid-sentence.
- **Caller speech-in-progress suppression:** during one long caller monologue the observer sees NO events between speech_started and commit, so the event clock read as silence and the idle reprompt talked over the caller. `speech_started` (without stopped/committed/transcription) now suppresses the whole ladder, bounded at a 120 s const so a lost speech_stopped can never idle a zombie call to the billing ceiling.
- **Noise fixes:** (1) a WHITESPACE input transcription is line noise — it no longer counts as "the caller has spoken" (which unlocked farewell arming + disabled the opening guard) and no longer CONSUMES the one-shot suppressed-opening recovery (the short-circuit order bug that answered a noisy caller's first words with silence); (2) `ReenableVadAsync` now re-enables turn detection via the NEW `IRealtimeSessionPayloadBuilder.BuildTurnDetection()` (the ONE authority, shared with both accept payloads) — it hardcoded `server_vad`, silently downgrading every post-join-miss call off semantic_vad's noise robustness; (3) first-prompt background-speech discipline (`RealtimeSessionPayloadBuilder`): callers are often on speakerphone/in a busy place — an utterance that does not fit the conversation is background: never answer it, never change topic, CONTINUE a cut-off answer where it left off, ask "was that meant for me?" only when genuinely unsure; plus a consecutive-unclear cap (say ONCE the line is noisy, then wait for a clear full sentence — no "didn't catch that" loops). The pinned "ignore background noise" sentence is retained byte-identical.
- **Provider-join fixes:** announce delivery is now correlated — `Delivered` requires the completed turn to have actually SPOKEN after the send (the transcript is reset to null pre-send), so a dirty slot's stale `response.done` can no longer produce an announce-less handoff; the Plivo join silence-start also sends `input_audio_buffer.clear` so a stale un-committed caller tail can't auto-trigger a reply into the "please hold" ring.
- **NO new container / query / index / queue / ARM change.** One new setting `Azure:Realtime:SpokenPlayoutMsPerWord` (read by the MCP host only — clinqetmcp appsettings + class default in sync). `BuildTurnDetection()` added to `IRealtimeSessionPayloadBuilder`.
- **‼️ END-OF-SESSION AUDIT (same day) — one MEDIUM defect found in the first implementation + two parity patches, all fixed + pinned.** (1) **The Telnyx word-estimate anchored at response.created (+TTFB) — but a turn whose speech follows an in-response MCP tool call starts PLAYING tens of seconds after created** (the codebase's own 81 s tool-gap evidence), so the estimate collapsed into the past and the self-interrupt bug partially survived on tool-heavy turns (booking/quote confirmations — the exact scenario of the live incident). Fix: `MarkItemAudioStarted` stamps the item's own FIRST `response.output_audio_transcript.delta` (CAS-from-0, reset per item at its done) as the playout-start anchor, falling back to created+TTFB when no delta arrives; pinned by a test simulating a 4 s tool gap. Plivo was immune (bytes-exact). **Rule for anyone extending this: on the text-only observer socket, response.created is NOT when audio starts — an item's first transcript delta is.** (2) Telnyx `input_audio_buffer.committed` now clears speech-in-progress (Plivo already did — undocumented asymmetry), and `conversation.item.input_audio_transcription.failed` clears it on BOTH carriers (a lost speech_stopped + failed transcription otherwise pinned the flag to the 120 s cap). (3) The Telnyx idle-goodbye now ARMS the hangup ceiling BEFORE sending the goodbye (Plivo's safe order — no window where the goodbye's turn events land unarmed). Accepted edge (documented, unfixed): a VAD noise blip after the model's goodbye disarms the farewell backstop, so that call ends via the idle ladder instead — still a graceful close, inherent to disarming at speech_started.
- **Proof:** full MCP unit suite 497/497 (15 new pins incl. the audit's tool-gap anchor test: playout-anchored idle on BOTH carriers, in-flight tool-call gate on both, farewell tail/latest-turn/speech_started-disarm, empty-transcription recovery, dirty-slot announce refusal, end-call drain-waits-for-playout, join input-buffer clear); Functions + API test projects build clean; the API builder-instruction pins are retained.
- **Deliberately NOT changed (owner decisions, web-research-backed 2026-07):** `input_audio_noise_reduction` has ONLY near_field/far_field on our API surface — `azure_deep_noise_suppression` is Voice Live-only, and Voice Live still has **NO SIP** (the Telnyx leg cannot adopt it without an ACS/gateway re-architecture; the Plivo WSS-relay leg COULD front Voice Live and gain deep noise suppression + `azure_semantic_vad_multilingual` incl. Hindi, at a resample + second-hop cost). `near_field` may fit phone handsets BETTER than our `far_field` (docs define the split purely by mic distance; no telephony benchmark exists — A/B in dev via the existing `NoiseReductionMode` setting). Input transcription `whisper-1` → a `gpt-4o-mini-transcribe` deployment is the biggest documented noise-hallucination win (~90% fewer; affects OUR transcripts/summaries, not the model's hearing; needs a Foundry deployment + ARM). `gpt-realtime-2` (2026-05) is Azure-SIP-listed (premium-tier bump candidate); `gpt-realtime-2.1` (2026-07) explicitly improves "silence and noise handling, and interruption behavior" but is NOT yet on Azure — watch whats-new. `idle_timeout_ms` (server-side idle that already excludes playout) exists but is server_vad-only — irrelevant while we default semantic_vad.

## RECENT CHANGES — 2026-07-28 (LARGE-CATALOG lookup `find_services` + 4th answer mode `AiFirst`, SHIPPED)

- **The bug this fixes was not "too many tokens", it was a lie.** `BuildCompactContext` took the FIRST 60 services in **arbitrary order** (no ORDER BY anywhere; `DisplayOrder` existed and was unused), emitted `servicesTruncated:true`, and the very next prompt paragraph said *"The business profile below is complete and authoritative… NEVER call a tool to look up information that is already in the profile."* Any provider past 60 offerings had a random subset presented as complete, so the model confidently told callers **"we don't do that"** about offerings the business sells. There was also **no customer-scope tool that could find one** (`search_services` was marketplace-wide AND `partnerOnly`), and the only Scope-C escape hatch, `get_provider_context`, returned the **full untruncated** context — a multi-second context bomb its own description recommended for exactly this case.
- **Two regimes, decided ONCE per call, never re-derived.** `Voice:Catalog:EmbedThreshold` (default **60**) is the single authority. **≤ threshold ⇒ Full**: byte-identical to today, whole catalog embedded, `find_services` **not even in `allowed_tools`**. **> threshold ⇒ Map**: the offering list is replaced by a **two-level catalog map** (owner rule: category AND subcategory, always) — categories always complete, subcategories trimmed WITHIN a category, remainder explicitly counted (`OtherCategoryCount`/`OtherOfferingCount`), exact counts + 2-3 example names per subcategory. **Everything else (hours, offers, service areas, address, currency, rating) stays embedded and authoritative in BOTH regimes.** ‼️ `servicesTruncated` is **DELETED** and `AzureRealtimeSettings.InstructionsMaxServices` is **deleted as an orphan** — there is no cap in the builder any more, because a cap there is what created the lying middle state. Pinned by `Build_FullMode_NeverTruncates_EvenPastTheOldCap`.
- **`find_services` (new, Scope-C, `CatalogTools`)** — `query? · group? · minPrice? · maxPrice? · skipIds?`. **No businessId parameter, by construction.** Returns one of four shapes, each carrying a `note` telling the model what to SAY: `Matches` · **`TooBroad`** (facet groups + count + top 3 + "ask ONE narrowing question", never a list) · `None` (+ `didYouMean` nearest groups) · `Unavailable`. The tool returns **the shape of the ambiguity**, not just rows — that is what lets the AI ask the one question that splits the set instead of guessing. Deliberately **no paging/cursor** (a phone caller will not sit through 200 results); "any others?" is served statelessly by `skipIds`. Per-call cap `MaxLookupsPerCall` (8) on `VoiceCallSession.CatalogLookupCount`, incremented **in parallel** with the search so it costs ~0ms; a lost cap write never refuses a legitimate lookup.
- **‼️ TENANT ISOLATION — the index holds EVERY provider's offerings, so scope there is a query-time FILTER, not a partition boundary (unlike Cosmos, where `businessId` IS the partition key).** `IProviderCatalogSearch` carries the contract; `ProviderCatalogSearchService` keeps it in 5 layers: (1) **sealed construction** — one method taking the CallContext-supplied businessId, no overload accepts a caller-built filter; (2) **model input never reaches the filter** — caller text goes to `search` (OData meaningless there), prices are typed, `group` is a NAME resolved to an id we own and **DROPPED if unresolvable, never concatenated**; (3) **pre-send assert** — the filter must LEAD with `businessId eq '…'` or we throw instead of sending (this also protects facet counts); (4) **‼️ per-row post-verification** — `businessId` is always in `select` and every returned doc is compared; ONE mismatch discards the WHOLE result set, falls back to Cosmos and raises a forced `ICatalogIsolationAlarm` (MCP → `McpSecurityAlertService`, Functions → `FailureNotificationHelper`); (5) test-pinned by `ProviderCatalogIsolationTests` (8 tests incl. a foreign doc in the response, quote-escaped business id, `businessId` always selected). **Layer 4 is what makes a filter bug unable to leak** — it is independent of the filter logic. `CatalogIsolationException` ⇒ `Unavailable`, never "we don't have it".
- **Engine: Azure AI Search primary + Cosmos fallback, routed by a handoff-time probe.** The index carries six AI-enrichment recall fields (`searchKeywords/synonyms/alternativeNames/broadMatchTerms/commonSearchPhrases/userIntentPhrases`) + a synonym map + `en.microsoft` lemmatisation — that is what makes *"any diggers?"* find **Excavators** and *"colour"* find **Balayage**, generically, with **zero hardcoded industry vocabulary**. ‼️ Cosmos `CONTAINS` is literal substring: it fails the **plural** ("excavators" vs "Excavator"), fails multi-word ("cat 320" vs "Caterpillar 320") and fails every vocabulary mismatch — which is why it is the fallback, not the engine. **Precision-first ladder**: `SearchMode.All` → (0 results) `Any` → (0) vector → (0) **Cosmos confirm before ever telling a caller we don't have it** (`ConfirmEmptyAgainstCosmos`, default on). Whole ladder bounded by ONE `LookupTimeoutMs` (2500) deadline. Identifier-shaped tokens are asked for as **phrase OR prefix** so a model number survives either analyser tokenisation.
- **‼️ NEW scoring profile `voiceCatalogScoring`** (`cosmosindexsetup`, `SearchIndexInitializer.VoiceCatalogScoringProfileName`, must match `ProviderCatalogSearchService.ScoringProfileName`): same text weights, **NO scoring functions**. The index's `DefaultScoringProfile` (`serviceRelevanceScoring`) boosts **createdAt freshness + serviceRating + reviewCount** — signals for ranking providers AGAINST EACH OTHER, meaningless inside one catalog, where they rank the provider's newest machine above the one whose name the caller actually said. Adding a scoring profile is a **query-time index update — NO reindex, NO schema change** (run with `--launch-profile "Dev (Canada)"`).
- **‼️ Semantic reranking is an owner kill switch: `Voice:Catalog:SemanticRerankEnabled` default FALSE** (billed per query + 300-800ms on a turn the caller cannot be spoken over). Vector is `VectorMode` (`Off|OnEmptyResult|Always`, default **OnEmptyResult** — the embedding round trip is paid only when the lexical pass found nothing, i.e. exactly where the alternative is a wrong "no"). Both external legs are **optional by deployment** (`CatalogSearchDependencies` holds `ISearchTopology`, never null, plus a nullable `IEmbeddingService`; it is `ResolvePrivate(businessId).CatalogClient` that comes back null): a stamp with AI Search unprovisioned writes blank settings and the lookup **degrades to Cosmos instead of failing to construct**.
- **‼️ THE AI CANNOT BE MADE TO SPEAK DURING A TOOL CALL — this is a hard platform constraint, not a tuning problem.** An MCP tool call runs INSIDE an active response and the realtime API rejects a `response.create` while one is in flight (already established at `VoiceSessionMonitor.cs` idle-watchdog: *"a tool wait runs inside an active response and can't be spoken over"*). So there is **no** mid-call "hang on, still looking" injection. The guarantee is instead: (a) most turns need **no tool call at all** — the map answers "what do you do / do you have X-type things" instantly; (b) the prompt makes the model speak the action line BEFORE the call; (c) the hard `LookupTimeoutMs` deadline bounds the worst case. Do not attempt an injected reassurance here.
- **Prompt (`RealtimeSessionPayloadBuilder`)** — Map mode gets its own source-of-truth block: hours/offers/areas stay authoritative, the catalog is a map, **"offering" is framed generically** (service/treatment/package/plan/product/equipment/rental/repair/policy — *use the caller's own word, never the word "offering"*), and **"NEVER tell a caller that something does not exist … only ever after find_services has come back with nothing"**. Full-mode prompt is unchanged and byte-pinned. `allowed_tools` is regime-aware via `ResolveAllowedTools(providerContext)` — one edit covers BOTH carriers because Telnyx accept + Plivo WS share `BuildInstructions`.
- **4th answer mode `VoiceHoursMode.AiFirst`** — the provider is **never dialled**; the assistant answers immediately after the disclaimer. Telnyx: skip `StartEarlyPartnerDialAsync`, warm the AI context at `call.answered` so it loads through the whole disclaimer (**reaches first-word sooner than any other mode**), hand off at `speak.ended` via `TryAiFirstHandoffAsync`. Plivo: skip `StartProviderDialAsync`; engagement rides the caller-joined status callback for the same structural reason a missing forwarding number does (the MPC does not exist until the answer applet returns). ‼️ **§19 absolute**: no disclaimer ⇒ no AI. ‼️ **A lost `speak.ended` on AiFirst has no dial in flight to rescue it**, so the disclaimer backstop is scheduled at `call.answered` AND `CompleteDisclaimerAsync`'s no-dial-in-flight branch routes to the AiFirst handoff instead of dialling (pinned by `CompleteDisclaimer_AiFirst_BackstopReachesTheAssistant_WithoutDialing`) — this was caught by the end-of-session audit, not by the first implementation.
- **AiFirst decisions (owner-locked):** handoff failure ⇒ **voicemail** + forced alert (respects "never ring me"; the caller still leaves a message that reaches the provider with a summary). **Cap spent ⇒ ring the provider anyway + forced async admin alert** — that path skips the disclaimer, so §19 makes voicemail unavailable and the only alternative is turning the caller away; a spent cap is a billing state, not a preference. Private mode unchanged (deliberate full bypass). The AI's opening line drops *"the owner is unavailable"* in this mode — it would be a lie the caller can catch.
- **‼️ `search_services` / `MarketplaceSearchTools` DELETED** (owner decision) along with its HttpClient, `FakeSearchApiServer` and its tests. It was reachable ONLY from the provider's own in-app chat assistant (`McpToolGateway` mints the only `VoiceCallScope.Partner` token in production — **every phone path hardcodes `Customer` on both carriers**), and returned public marketplace listings, so it was never a leak. Tool count 29 → 29 (`find_services` in, `search_services` out). `ClinketApi:PublicBaseUrl` is **retained** — `VoiceLiveEventClient` still reads it.
- **Also fixed on the way through:** deterministic `DisplayOrder`-then-name ordering (the old `Take(60)` was order-undefined); `get_provider_context` bounded the same way so the **chat** assistant does not inherit the bomb; `IMemoryCache` size now proportional to content (a 1,200-offering context was accounted as `Size = 1` against the shared `SizeLimit`); every `serviceId` tool description now says "from your embedded profile or from find_services"; provider-authored names/descriptions are control-char stripped + clamped before reaching the model as tool results.
- **Cost/perf:** Full mode unchanged. Map mode is **cheaper at handoff** than before (bounded page + one GROUP BY instead of loading the whole catalog) and adds one small search query per lookup. The regime decision is one single-partition `VALUE COUNT(1)`; the catalog binding (`CatalogMode`/`CatalogSource`) is stamped on `VoiceCallSession` and read by the MCP off the doc it **already loads for auth** ⇒ **zero extra I/O per tool call**. `find_services` emits **no search analytics** and does not proxy the marketplace endpoint — phone traffic must never enter the recommendation pipeline.
- **NO new Cosmos container · NO partition-key change · NO cross-partition query · NO index schema change · NO reindex.** New infra: `Search__Topology__Services__Private__{Endpoint,ApiKey}` + `Search__Topology__Private__Cells__cell1__{CatalogAlias,KnowledgeAlias}` + `AzureAIFoundry__{ApiUrl,ApiKey,EmbeddingModel,EmbeddingDimensions}` on the **MCP App Service** in `deploy.ps1` (blank-safe).
- **‼️ END-OF-SESSION AUDIT — FIVE defects found in the first implementation, all fixed + pinned. Four were the SAME class: a dependency failing produced a WRONG CALLER OUTCOME instead of a degrade.** (1) **AiFirst had no disclaimer backstop** — it places no dial, and the backstop is only scheduled inside `StartEarlyPartnerDialAsync`, so a lost `speak.ended` left the caller in silence until the call time limit. (2) **An Azure Search exception never fell back to Cosmos** — it escaped past the fallback to the catch-all, so a search outage told every caller "the catalog could not be searched" while the partition-scoped leg sat there able to answer; the index leg now catches and degrades, and `CatalogIsolationException` is deliberately re-thrown so isolation still fails CLOSED. (3) **A HUNG search still starved Cosmos** — the fallback existed but inherited a spent clock, so the index leg now gets only `IndexLegBudgetShare` (60%) of the budget and its own deadline expiring is a degrade, not a timeout (only the OUTER token expiring is a real timeout). (4) **A failed quotable-count read failed the whole context build** ⇒ failed handoff; it now degrades to Full mode (the pre-map behaviour — slower on a huge catalog, but it can never present a partial list as complete). (5) **A failed catalog-map read (group counts / sample) failed the call** ⇒ now fail-soft: the model keeps the total + `find_services` and only loses the menu. **Rule for anyone extending this: every external read on the catalog path must have a defined degrade, and "tell the caller we can't" is NOT one.**
- **Timeout raised 2500ms → 8000ms after owner review.** A 2.5s ceiling does not merely cause silence — it tells the caller the catalog cannot be searched about an offering that EXISTS, which is a wrong answer caused by impatience. Every lookup now logs elapsed ms + source + outcome under a stable marker (so the real p99 is chartable, not guessed), anything over `LookupSlowWarnMs` (2500) logs a warning even when it SUCCEEDS, and a genuine timeout logs an error and raises a cooldown-gated forced alert via `ICatalogAlarm.RaiseLookupTimeout`. `ICatalogIsolationAlarm` was renamed `ICatalogAlarm` to carry both signals honestly.
- Also from the audit: `CallContext.CatalogMode` was written and never read ⇒ deleted (the regime lives on `VoiceCallSession` as the call record; the tool branches only on `CatalogSource`, because a Full-mode call is simply never offered the lookup). The `tooBroad` preview count is now the named `TooBroadPreviewCount` const tied to the prompt's "at most three at a time", not a literal.
- **Proof**: API 7246/7246 · Functions 1713/1713 · MCP 482/482 (+37 new: 11 isolation/degradation, 9 catalog-map/regime, 10 lookup behaviour, 7 AiFirst incl. **3 Plivo/India** — the first AiFirst pass pinned Telnyx ONLY, which the audit caught). ‼️ **India/Plivo is fully covered by the same code**: `PlivoVoiceRelay` fetches the same `GetPublicContextAsync` (so the catalog map is embedded) and builds its session through `BuildWebSocketSessionPayload` → the SHARED `BuildInstructions` + `ResolveAllowedTools`, so `find_services` is offered identically; `PlivoVoiceCallControlFunction` stamps the same catalog binding. The India MCP needs its OWN `Search__Topology__*` (separate per-stamp search service); `AzureAIFoundry__*` is the env-global shared account and is IDENTICAL on both stamps — never use India's Sweden Central realtime key for it. · mobile locale parity + source-integrity 29/29 · ESLint 0 errors · all 7 affected projects build clean.
- **Known limitations (honest, unfixed by design):** a **per-business custom category name** does not resolve in `ResolveGroupAsync` (global catalog only) so the group filter is dropped and the text search carries it — degrades, never fails. **Cross-language lookup** relies on the vector leg; with `VectorMode=Off` a Hindi caller against an English catalog matches only via enrichment synonyms. The regime is cached with the context (`ProviderContextCacheMinutes`, 5) so a provider crossing the threshold takes up to 5 minutes to switch. Plivo AiFirst inherits the pre-existing exposure of the caller-joined status callback (same as the no-forwarding-number path).

## RECENT CHANGES — 2026-07-24b (cross-business number reassignment: `Returned` mode + binding guard + quarantine, SHIPPED)

- **Third `VoiceNumberReleaseMode.Returned`** — keep paying the carrier for the DID but DETACH the business, so another one can take it. Fills the gap between `Released` (carrier gets it back, billing stops) and `Parked` (we keep it, RESERVED for that same business). `FreeVoicelineAsync` replaces `ParkVoicelineAsync` and serves both non-release modes; the `Released` branch is untouched. ‼️ Same pre-apply discipline as before: the mutation runs BEFORE the first `UpsertVoicelineWithRetryAsync` (the reapply lambda only fires on a 412).
- **`VoicelineStatus.Returned`** (inert by construction — every runtime gate is `Status != Active`). ‼️ **`BusinessId` stays as the LAST owner** — `VoicelineRepository.UpsertAsync` enforces a non-empty `BusinessId` on every voiceline, and blanking it throws (caught by the integration test, NOT the unit test — the mocked repo has no such invariant). `Status == Returned` is what releases the claim; there is deliberately NO `previousBusinessId` field on the Voiceline. Return DOES wipe everything operational (`ForwardTo`, persona, operating instructions, callerIdMode, privateMode, timeZoneId, **MonthlyMinuteCap + every usage/notified counter**) so the next business can never inherit the departing one's minutes, cap, or prompt.
- **`EvaluateBinding` — the guard is now status-aware** (was: any foreign `BusinessId` ⇒ blanket `Error_VoiceAssistantNumberInUse`). New `VoiceNumberBindingState`: `Unbound` · `BoundToThisBusiness` · `LiveOnAnotherBusiness` (Active/Paused ⇒ **hard block, NOT overridable**) · `ReservedForAnotherBusiness` (Parked) · `InQuarantine` (Returned, still aging). Two bugs fixed by the same change: a **released** number's 30-day tombstone no longer blocks a fresh purchase by anyone (`Cancelled` ⇒ `Unbound`), and the previous owner is never gated (only its OWN former callers can reach it ⇒ no wrong-party risk going back).
- **Reassignment quarantine = carrier-style number aging.** `VoiceAssistant:NumberReassignmentQuarantineDays` (default **30**, `0` disables) is stamped as `Voiceline.QuarantineUntil` at BOTH Park and Return; cleared when a business claims the line. The rationale is caller-facing, not technical: the previous owner published that DID (Open Page, QR code, invoices, call history), so their callers keep dialing it for months and would reach a DIFFERENT business's AI. Tenant isolation is structural (`businessId` comes from the call binding), so there is no data leak — the risk is wrong-party contact, which is exactly what carrier aging + the FCC Reassigned Numbers Database exist for.
- **Admin override, one flag, always audited.** `AssignVoiceNumberDto`/`ChangeVoiceNumberDto` gain `OverrideNumberBinding` + a **required** `OverrideReason` (≤500, internal-only). It bypasses a reservation AND the remaining quarantine, but NEVER a line live on another business. `VoiceAssistantNumberAudit` gains `PreviousBusinessId` + `BindingOverridden`, and `AssignNumberAsync` now writes an `Added` row **even on a first-time activation** when the DID came from another business — the handoff ledger has two halves (the loser's `Removed` row + the taker's `Added` row).
- **The quote no longer lies (the dead-end bug).** `GetNumberQuoteAsync` took only `e164` and asked the carrier "do we own this?", so a DID we own but another business holds rendered "ALREADY IN OUR INVENTORY · No charge · Assign" and then 400'd on submit. It now takes `businessId` (the route already had it), runs the SAME binding evaluation in parallel with the carrier quote, and returns `BindingState`/`BoundBusinessId`/`BoundBusinessName`/`QuarantineUntil`/`CanOverrideBinding` + a single server verdict **`CanAssign`**. The admin UI gates its buttons on `CanAssign` (via `canSubmitNumber`) instead of re-deriving the rule client-side — that duplication was the original defect.
- **Admin UI** (`VoiceAssistantRequestsPage.jsx`): shared `ReleaseModeChoice` (3 radios, used by both remove + change), `BindingOverride` (checkbox + required reason, rendered only when `CanOverrideBinding`), binding-aware `QuoteResult` states, override reset on every number edit, and audit rows showing the release mode + "Taken from {businessId} · hold overridden".
- **NO new Cosmos container, NO new Cosmos doc, NO new query, NO index change, NO ARM change.** `QuarantineUntil` is a field on the existing per-DID `Voiceline`; the handoff fields ride the existing `VoiceAssistantNumberAudit`. The guard reads the same voiceline the assign already point-read ⇒ **zero extra RU**. New keys `Error_VoiceAssistantNumberReserved` / `Error_VoiceAssistantNumberQuarantined` / `Error_VoiceAssistantOverrideReasonRequired` in en/gu/hi (fr is a deliberate 310-key subset that never carried the sibling `Error_VoiceAssistantNumberInUse`).
- **Proof**: 333 voice unit tests + **29 integration** (real Cosmos emulator) green, full API suite 6645/6645, Functions + MCP build clean, admin ESLint 0. Integration coverage: Returned detach → quarantine block → previous-owner bypass, override handoff with both audit halves, parked-refused-then-overridden, and live-on-another-business refused even with override.

## RECENT CHANGES — 2026-07-24 (ADMIN dedicated-number management: remove / change / re-add + durable audit, SHIPPED)

- **Admin can now REMOVE, CHANGE, or RE-ADD a provider's dedicated number** on a LIVE assistant (previously only assign-from-`NumberPending` + release-from-`Cancelled` existed). Three new `AdminVoiceAssistantController` endpoints (`[Authorize(Roles="Admin")]`): `POST {businessId}/remove-number` (`RemoveVoiceNumberDto{ReleaseMode,Reason,ReasonNote?,ProviderMessage?}`), `POST {businessId}/change-number` (`ChangeVoiceNumberDto{E164,ReleaseMode,Reason,ReasonNote?,ProviderMessage?,ConfirmPurchase}` — one-click swap, billing-gated like assign), `GET {businessId}/number-audit`. Service: `VoiceAssistantService.RemoveNumberAsync / ChangeNumberAsync / GetNumberAuditAsync`.
- **Release vs Park (admin choice per action, `VoiceNumberReleaseMode`).** `Released` = release the carrier DID + tombstone the Voiceline (reuses `ReleaseNumberAndTombstoneVoicelineAsync`; re-add must re-purchase). `Parked` = KEEP the carrier DID, Voiceline → **new `VoicelineStatus.Parked`** (inert for inbound — the runtime gate is `Status != Active` everywhere; `Ttl=null`, `BusinessId` retained) so the SAME business re-adds it FREE (`OwnedByUs`) while a foreign assign stays blocked. **Superseded 2026-07-24b:** a third mode `Returned` now exists and the guard is status-aware — see the 2026-07-24b block above. Remove/Change send the assistant back to **`NumberPending`** so the existing `AssignNumberAsync` re-adds. ‼️ `ParkVoicelineAsync` must apply its mutation BEFORE `UpsertVoicelineWithRetryAsync` (the reapply lambda only fires on a 412) — same discipline as `SyncVoicelineFromApplicationAsync`.
- **Re-add detected via `VoiceAssistantState.ActivatedAt`** (deliberately KEPT through a removal): assigning to a previously-live assistant fires **`VoiceAssistantNumberAdded`** ("back online") + a durable `Added` audit row, instead of the first-time `VoiceAssistantActivated` welcome. `AssignNumberAsync` gained an optional trailing `adminUserId` (audit actor) + clears `NumberReleasedAt` on re-add.
- **Durable audit — NEW `DocumentType.VoiceAssistantNumberAudit`** (`VoiceAssistantNumberAudit` entity, **ProviderData**, pk `/businessId`, id `{businessId}_vanumberaudit_{guid:N}`, mirrors `McpAudit`), fixed **365-day TTL** (`VoiceAssistant:NumberAuditRetentionDays`), append-only, **never deletable, no resolve field on the doc**. Read-only history on the admin page; single-partition list with in-memory sort ⇒ **NO composite index / NO cosmosindexsetup change**. "Resolve" lives on the Alerts page: remove/change also raise `AdminAlertType.VoiceAssistantNumberRemoved/Changed` (forced).
- **5 provider channels from one path**: email + in-app + push + SignalR via `ICommunicationDispatcher` (the 3 `NotificationType.VoiceAssistantNumberRemoved/Changed/Added` are mapped to `PreferenceCategory.VoiceAssistant` since 2026-07-24 — they shipped UNMAPPED, which took the `DispatchAllChannelsAsync` fallback and bypassed the provider email/push opt-out (finding E1) while logging "No preference category mapped…" on every dispatch. The category is neither SMS- nor WhatsApp-eligible, so mapping adds NO channel and cannot duplicate the direct SMS below. Added to `SignalRSettings:EnabledNotificationTypes`; deep-link → AI Assistant settings on web `notificationNavigation.js` + mobile `notificationNavigation.ts` + `PUSH_DEEPLINK_TYPES`). **SMS is sent DIRECTLY** via `ISmsService.SendTemplatedSmsAsync` (Transactional, NOT consent-gated — a critical account event; the dispatcher's SMS is opt-in/default-off), gated by **`VoiceAssistant:NumberLifecycleSmsEnabled` (default true)** + **+91/India excluded in code** (`SmsRoutingSettings.IndiaCountryCode`), best-effort. The provider-facing reason is a **localized `Voice_NumberReason_*`** sentence (structured `VoiceNumberChangeReason` — **10 values**, incl. `SpamFlagged/ServiceAreaChange/CarrierMigration/BillingIssue/AssignedInError`); **`Other` has NO preset** ⇒ the admin's REQUIRED `ProviderMessage` (≤200, un-localized like a rejection reason) IS the reason shown to the provider via BOTH the email AND the in-app/push/SignalR notification body (the Removed/Changed `Notification_*_Body` strings gained a trailing `Reason: {1}`, all 4 langs) — it is NOT stored in the number-audit doc (no Cosmos field was added), only in the persisted notification record; `ReasonNote` stays internal-only. `RequireOtherProviderMessage` enforces Other-needs-message server-side, fail-fast before any carrier op (unit + integration covered). **Admin UI (`VoiceAssistantRequestsPage`): the lookup panel now offers Assign/Re-add for a `NumberPending` provider (fixes the re-add-after-removal gap — the assign flow previously only existed on alert cards) via a lookup-scoped assign modal reusing the number-quote/purchase path; the remove/change dialogs show an extra provider-message textarea ONLY when `Other` is selected.**
- **Brand emails** `VoiceAssistantNumberRemoved/Changed/Added.html` in en/fr/gu/hi (VoiceAssistantOnHold house style; navy `#032858` / lime `#97EF29`; user-approved mockup at `clinqetwebadmin/mockups/voice-number-management/`) + SMS templates `Resources/SmsTemplates/en/VoiceAssistantNumber*.json`.
- **NO new container / NO cross-partition query / NO ARM change** (API-only appsettings; class defaults mirror appsettings). Tests: **+14 unit** (`VoiceAssistantServiceTests` — caught+fixed the park pre-apply bug) + **4 integration** (real Cosmos: remove→audit→re-add, park round-trip, change swap, authz). Admin UI: `VoiceAssistantRequestsPage.jsx` number/email/phone lookup (via Identity `admin/users/lookup`; `UserNumber == businessId`, same as WhatsApp Admin) + remove/change dialogs + read-only audit panel.

## RECENT CHANGES — 2026-07-23b (EARLY PARTNER DIAL during the caller disclaimer — Telnyx, SHIPPED DEFAULT-ON, hostile-audited)

- **`VoiceCall:EarlyPartnerDialEnabled` (default TRUE; `false` = kill-switch restoring the speak.ended dial byte-identically)**: the provider dial fires at `call.answered` (right after the `DisclaimerPlayedAt` stamp lands — stamp-before-dial is gated on a dedicated this-attempt-stamped boolean, NOT the combined CAS result, so a duplicate answered whose write is recording-flag-only can never double-dial) instead of at `speak.ended` — the ring overlaps the disclaimer, cutting **~5-8s off time-to-AI on every no-answer call** (ring timer starts ~0.5s in, vs after the full disclaimer TTS). India/Plivo has always overlapped; this is Telnyx convergence.
- **Two new nullable `VoiceCallSession` fields** (point-ops only, never queried ⇒ NO index/container change): `disclaimerCompletedAt` (event-confirmed "disclaimer finished"; `DisclaimerPlayedAt` = the legal consent stamp, untouched with all readers) and `pendingConnectOutcome` (`VoicePendingConnectOutcome` BridgeHuman|Miss). A verdict landing pre-completion PARKS (machine/decline: B-leg hung immediately, park Miss — a decline overwrites a parked BridgeHuman; human/undetermined/AMD-disabled-answer: park BridgeHuman + ONE `Voice_ProviderHoldConnecting` line on the B-leg, en/fr/hi/gu); the disclaimer `speak.ended` (or the `vpc-disc-{callId}` backstop at +max(5,`DisclaimerCompletionBackstopSeconds`=15)s on the existing dedup-on voice-postcall queue) stamps completion AND claims the parked outcome in ONE ETag CAS — exactly-once by construction (same claim-inside-CAS discipline as the join-miss clear). The backstop executes through `IVoiceDisclaimerCompletionHandler` → the state machine's single `CompleteDisclaimerAsync` (VoiceCallControlFunction registered Scoped in the Functions host — clean seam, audited).
- **Flag OFF = byte-identical critical path**: a pure flag-off call writes the completion stamp BEST-EFFORT and dials unconditionally via `ConnectViaGatedDialAsync` — the dial has ZERO dependency on winning a write. Strict-path CAS exhaustion (3×412) is distinguished from dedupe by a fresh point-read and logs `"Disclaimer completion CAS exhausted"` / `"Connect-outcome park CAS exhausted"` before the safe fallback. Two unconditional hardenings shipped with it: the A-leg hangup now explicitly releases any live un-bridged partner-attempt leg (fixes a pre-existing held-leg leak), and a lost `speak.ended` is rescued by the backstop (flag-on) instead of dead air.
- **§19 stays absolute**: no bridge/AI-handoff/voicemail-invite executes before `disclaimerCompletedAt` (the old protection was incidental sequencing; it is now an explicit test-pinned gate). Cap/private/plain-transfer and failed-disclaimer rescue paths bypass ALL new code; NeverAnswer record-only lines early-dial with miss⇒voicemail-at-claim (test-pinned). Plivo/MCP/API hosts untouched.
- **Proof**: 1662/1662 Communications unit tests (22+6 new: every S/V ordering, duplicate deliveries, park-overwrite, CAS-exhaustion fallbacks, floor guard, undetermined-hold, NeverAnswer e2e, flag-off byte-identity re-pins) + 12/12 integration incl. two REAL-Cosmos park→claim races. Cost: flag-off +1 stamp write/call; flag-on +1 scheduled backstop + park write only on the pre-completion race; caller legs shorter ⇒ net cheaper. No new API/endpoint/query.
- ‼️ **ROLLOUT RULE (audit M3, updated for default-ON)**: the flag now ships ON with the code. During the FIRST rolling deploy a call spanning old/new hosts can lose a parked verdict (old binaries drop the unknown fields; old hosts DLQ `DisclaimerBackstop`) — deploy in a quiet window, or pre-set `VoiceCall__EarlyPartnerDialEnabled=false` and flip after full rollout; NEVER roll back to pre-early-dial binaries without setting the flag false first. **Burn-in monitoring**: the three degraded signals (early dial rejected · either CAS-exhaustion fallback · backstop actually firing) raise FORCED `AdminAlertType.SystemError` alerts, context in the title (AlertsPage already lists the type) — retirement criterion: ZERO of them across 2-4 weeks of live traffic ⇒ delete the setting + collapse the off-path (the structural lost-stamp fallback stays). Enable procedure: one dev POC call — provider phone must ring WHILE the caller still hears the disclaimer; watch for absence of "Early dial command rejected"/"CAS exhausted" and presence of the backstop+reassurance schedules; post-call the `vcall_` doc has both stamps and no pendingConnectOutcome. Known residuals (audited, accepted): claim-then-execute is not crash-atomic (host-teardown-only window; backstop rescues its own entry), and the park/claim last-resort after CAS exhaustion executes mid-disclaimer with a dedicated log.

## RECENT CHANGES — 2026-07-23 (latency + observability fix pack, "next possible time" smartness)

- **"Earliest possible" delegation carve-out in the first prompt** (`RealtimeSessionPayloadBuilder` Date/time block, now-anchor branch ONLY — without the clock the model cannot compute "earliest"): a caller asking for the earliest / next available / soonest possible time HAS told you when — the model works out the next in-hours time itself from the now-anchor + the embedded `weeklyAvailability` (later today if in-hours time remains, else the next working day's opening), proposes that concrete day+time, and never asks such a caller to pick a date. ~70 tokens; pinned by `Build_Instructions_EarliestPossibleDelegation_ProposesSlotItself_AnchorOnly`. Root cause was the 2026-07-16 "never guess a day the caller did not indicate" rule having no delegation exception. Deliberately NO availability/free-slot tool was added — slot conflicts stay deferred to owner confirmation (BookingTools' documented design).
- **Provider ring window 30s → 25s** (`VoiceCall:PartnerTransferTimeoutSeconds`, appsettings + class default kept in sync per §0.12).
- **Handoff latency parallelization** (miss→AI-first-word path): `RealtimeCallWebhookFunction` runs the idempotency mark + ANI-binding delete CONCURRENT with the MCP session-start signal (all awaited before the 200 — idempotency/ANI guarantees unchanged; a failure still 500s into the duplicate-ack guard); `VoiceSessionMonitor.StartSessionAsync` runs the owner-stamp/live-marker writes concurrent with the Azure WS connect (awaited before reporting success; the connect-failure path awaits the stamp BEFORE `DeleteLiveMarkerAsync` so the delete can never lose the race and leak a marker). ~150–450 ms saved on every AI answer.
- **`McpToolGuard` now logs deliberate tool failures**: a McpException from a tool action previously left ZERO log trace (fire-and-forget audit row only) — the "AI promised a WhatsApp copy, nothing arrived, nothing logged" incident. Now LogWarning with tool + businessId + callId + the caller-safe reason. Pinned by `ExecuteAsync_McpExceptionFromAction_LogsWarningWithReason`.
- **Latency truth (investigated end-to-end — NO bug found)**: caller-perceived 30–40 s to AI-first-word = ~6–8 s answer+disclaimer (the provider dial starts only at `speak.ended`) + the ring window + 3–6 s handoff masked as ringing (ringback WAV, then Telnyx default transfer ringback during the SIP window). A decline that diverts to carrier voicemail additionally waits for the premium-AMD verdict (bounded by `Telnyx:PremiumAmdPromptEndTimeoutMillis` = 30 s); a genuine decline-hangup enters the miss branch immediately. Dev first-call failure = FlexConsumption (FC1) scale-to-zero cold start on `call.initiated`, which **Telnyx never replays** (`functions.json` configures no `alwaysReady`; dev instance memory 512 MB). OPEN OWNER DECISIONS (deliberately not changed): alwaysReady HTTP instance (cost), dial-during-disclaimer overlap (~5 s/call, changes the state machine's disclaimer-gating proof), AMD prompt-end-timeout cap (trades iPhone Live Voicemail detection), pointing the dev Meta status webhook at dev (async WhatsApp delivery failures are invisible in dev today), unclaimed `wafb_` ticket sweep.

## RECENT CHANGES — 2026-07-17 (voice-doc SMS two-switch kill switch + in-call delivery-outcome awareness)

- **Two owner switches over voice-document SMS** (send-side detail + behavior matrix in clinqet-whatsapp): A `WhatsApp:DocumentSmsFallbackEnabled` (WhatsApp failed → SMS, hardened to be authoritative at SEND time) and NEW B `WhatsApp:DocumentSmsOnRequestEnabled` (caller declines WhatsApp → direct one-hop SMS). Both class-default true, both forced "false" on the `in` deploy stamp; +91 recipients are excluded unconditionally in code (2Factor/DLT — NOT Plivo; Plivo is India VOICE only). ONE shared predicate (static `DocumentSmsGate`) gates every SMS egress AND every AI knowledge surface — when a switch is off (or the recipient is +91) the AI never learns texting exists, by construction.
- **Channel 'sms' on `send_my_details`/`send_quote`**: accepts 'sms' and 'text' (case-insensitive) → `VoicePostCallMessage.DocumentSendSms` → `Deliver*SmsAsync` (one hop, no WhatsApp dance; the deterministic enqueue id gained an "s" channel tag). CRITICAL: the static `[McpServerTool]`/`[Description]` attributes NEVER name sms/text (static = would leak when switched off) — the model learns the 'sms' channel value ONLY from the per-call conditional prompt; an ineligible 'sms' returns `{sent:false, smsUnavailable:true}` with a warm "temporarily unavailable" note steering to WhatsApp/email (defense in depth), and a no-ANI 'sms' falls through to the existing email paths. `send_quote` returns the unavailable note BEFORE creating the quote.
- **Per-call prompt variants** (`RealtimeSessionPayloadBuilder` — ctor gained `IOptions<WhatsAppSettings>` + `IOptions<SmsRoutingSettings>`; one edit covers BOTH carriers since Telnyx accept + Plivo WS share `BuildInstructions`): (1) ALWAYS clarify-first — "text me / message me / to my phone" ≠ SMS; ask ONCE "is WhatsApp okay?" unless the caller named WhatsApp; never re-ask; (2) B-eligible: send as a text by passing channel 'sms'; (3) B-off + A-on: reassure and send the same way — it arrives as a regular text when WhatsApp isn't on the number; never bring up texts first; (4) both-ineligible: email is the only other way — the ENTIRE prompt then contains NO "text message"/"channel 'sms'" (drift-pinned by whole-instructions DoesNotContain tests, incl. +91-ANI and null-ANI shapes); (5) ALWAYS outcome-awareness — mention a sent-as-text update once, warmly; on a could-not-deliver update apologize once and offer email or owner follow-up; answer "did it arrive?" from updates; no update ⇒ it's on its way. The SentAsText half of rule 5 exists ONLY when some SMS is possible — the both-ineligible shape gets a failure-only wording (this keeps the never-know-texting census absolute).
- **Gated tool fallback notes** (supersedes the always-on "arrives as a text message" note from 2026-07-16): FallbackEligible(ani) ⇒ that note byte-identical; ineligible ⇒ " If the caller says they don't use WhatsApp, offer to send it by email instead — that is the only other way to get it to them." (never introduces the SMS concept).
- **In-call delivery-outcome notices — NOT gated by the switches (they report what actually happened)**: new `VoiceMonitorCommandKind.DocumentDeliveryNotice` with `{DocumentType, EntityNumber, DeliveryOutcome ∈ SentAsText|DeliveryFailed}` on the existing voice-monitor-commands session topic (SessionId = `MonitorInstanceId`, published via `VoiceDocumentDeliverySignals` — best-effort, swallow+log, skips when the session is Ended/unowned). Publishers: `VoicePostCallProcessorFunction` (WhatsApp-requested delivery that resolved as `Channel==Sms` ⇒ SentAsText; `!Delivered` ⇒ DeliveryFailed, alongside the UNCHANGED forced admin alert) and both WhatsApp processors on an async fallback-SMS success (via the new `WhatsAppSmsFallback.LiveCallId`; the voice processor passes `message.CallId` as the new optional `liveCallId` arg on `Deliver*`). `VoiceMonitorCommandListener` carrier-routes to `VoiceSessionMonitor` / `PlivoVoiceRelay` `InjectDocumentDeliveryNoticeAsync`: live session ⇒ ONE factual SYSTEM `conversation.item.create` (shared `VoiceDocumentDeliveryNoticeItem` builder) — NEVER a forced `response.create` (the model mentions it at its next natural turn per prompt rule 5); session gone ⇒ silent drop (the post-call summary still records the outcome).
- **Caller-experience contract** (owner priority #1): never a false promise (knowledge == egress by the shared gate), never a dead end (degrade ladder WhatsApp → SMS → email → owner follow-up), clarify once never twice, sends stay fire-and-forget, honesty on outcomes. Failure reasons gain "; sms_fallback_unavailable" when the gate withheld the SMS. Performance: zero added I/O on tool/prompt paths (gate is in-memory, ANI already in hand); notices cost 1 session point-read + 1 topic message on rare events only; on-request SMS is cheaper than the fallback dance; suppressed ticket claims SAVE RU.
- Polish: `VerificationTools` OTP description dropped the "(WhatsApp, then SMS)" parenthetical — behavior unchanged; the OTP rail stays deliberately SMS-capable in BOTH regions.

## RECENT CHANGES — 2026-07-16 (hybrid booking time)

- Voice booking display remains business-local wall time. `BookingTools` and `PartnerTransactionTools` stamp `TimeZoneId` and derive `ScheduledStartUtc` / `EstimatedEndUtc` only through `BookingTimeHelper`; reschedule shifts the wall end by the existing duration and recomputes both instants.
- `request_booking` preserves the ≥14-hour no-read prefilter. When its near-time past guard already point-reads the Voiceline, that exact `Voiceline.TimeZoneId` is threaded into booking create/update; far-future requests use the already-loaded BusinessProfile zone and add no live-call read.
- `cancel_my_booking` enforcement and the `cancellationByPhone` hint share one UTC window calculation. Toronto boundary coverage pins 23 hours as too soon and 25 hours as available; the old wall-vs-UTC comparison fails the 25-hour case.
- `CallFollowUpApplyService` derives UTC for valid draft suggestions and clears derived instants for the unset sentinel. MCP find/read-back and working-hours/local-day logic intentionally remain wall based.
- State/IANA defaults moved from `VoiceAssistant` to shared `BusinessTime` settings bound in API, Functions, and MCP. Do not restore the old keys.

## RECENT CHANGES — 2026-07-16 (production fix pack: CRM auto-create + real booking dates + WhatsApp→SMS document fallback + spelled input + mobile links)

- **Every voice-created booking/quote/named message grows the provider CRM.** The functions host find-or-creates a `BusinessCustomer` by email-or-phone (`CustomerService.CreateOrUpdateCustomerFromQuoteAsync` — phone-only callers included; the email-keyed `CustomerIdentitySync` pipeline is email-mandatory and never served them) at: the `BookingCreated` ActionSideEffects, `SendQuoteDocumentAsync` (before the identity sync), `CallFollowUpApplyService` DraftBooking/DraftQuote applies, and named message/callback callers in `IngestPendingMessagesAsync` (once per contact per call). **Shared-number guard:** a phone-only match whose existing first name differs from the caller-stated one is NEVER renamed (same-email match ⇒ same person ⇒ update allowed) — spoken names are lower-trust data. The post-call Customer card (`AppendCustomerCardFromCreatedTransaction`) now links for phone-only unknown callers too (canLink = email OR phone; the isKnownCrm requirement is gone). All best-effort — a CRM hiccup never fails the pipeline or the apply.
- **The Jan-01-0001 draft-booking bug is dead at every layer.** (1) `IVoiceCallSummaryService.SummarizeAsync` gained `callLocalTimeAnchor` (e.g. "Tuesday, 2026-07-14 at 19:52" — built by `ResolveCallLocalTimeAsync` from the voiceline `TimeZoneId` + `CallStartedAt`, 1 extra point read post-call) so the summarizer resolves "Friday"/"tomorrow" into a concrete `requestedDate` (a resolved relative day is a stated date, not an invention; omit only when no day was indicated). (2) `AutoCreateSuggestionsAsync` never auto-applies a DraftBooking without a strict `requestedDate`+`requestedTime` at/after the business-local call clock (FULL-datetime floor) — it stays a Pending review card. (3) `CallFollowUpApplyService` sets `ScheduledStartDateTime` (business-local wall time, Kind Unspecified — same convention as live voice bookings) from a valid payload; unusable or past-in-every-timezone (UTC−14h floor) stays description-only ⇒ `DateTime.MinValue` as before. (4) MCP `ParseLocalDateTime` is strict `yyyy-MM-dd'T'HH:mm[:ss]` TryParseExact (a bare "10:00" can never silently become "today at 10:00"); `request_booking` + `reschedule_my_booking` run a **past-date guard** returning a structured `startInPast` result with the business-local `localNow` (voiceline point-read ONLY for starts < UtcNow+14h; timezone-unknown blocks only what is past in every timezone; repo/timezone errors skip the guard). The session read moved into request_booking's parallel batch (net latency improved). (5) Partner web renders a localized "No date set" for sentinel dates (`src/utils/bookingDate.js` `isUnsetBookingDate` — null/invalid/pre-1970) across detail/list/cards/home widgets, and the Draft **Confirm** gate + edit-form prefill treat the sentinel as missing.
- **Voice document delivery is no longer fire-and-forget.** `IDocumentDeliveryService.Deliver{Booking,Quote,Invoice}WhatsAppAsync` return `DocumentDeliveryResult` (WhatsApp/Sms/Failed+reason) and gained **`smsFallbackOptIn`** — VOICE sends pass true; the email processors stay false (platform users' SMS is dispatcher-preference-gated; the hostile review caught that an ungated fallback would text every web invoice/quote/booking email recipient, including WhatsApp-opted-out ones). With opt-in, the previously-SILENT consent-block drop and the window-closed+template-unapproved skip now LogWarning and fall back to a **direct Telnyx SMS carrying the PDF SAS link** (`ISmsService.SendTemplatedSmsAsync`, new en SMS templates `{Booking,Quote,Invoice}DocumentLink` with `{{Number}}/{{BusinessName}}/{{DocumentUrl}}`; gated by `WhatsApp:DocumentSmsFallbackEnabled` (default true) + recipient NOT `SmsRouting:IndiaCountryCode` (DLT); idempotency-marked `smsfb:{type}:{ctxId}:{phone}` via `IWhatsAppIdempotencyStore` so a redelivered SendDocument never double-texts; per-recipient rate-limit bucket, never "anonymous"). Enqueued WhatsApp sends carry **`SmsFallback{Direct=true}`** — the TEMPLATE path now enqueues the outbound message DIRECTLY (same `wa:{type}:{ctxId}:{phone}` dedup id; the dispatcher's preference-gated fallback could never fire for an anonymous caller, and its in-app leg never fired from here) — and the outbound processor: (a) sends Direct fallbacks via ISmsService (not the dispatcher) on send-time Meta failures; (b) on SUCCESS writes a **wamid→SMS-fallback ticket** (`wafb_{wamid}` in SystemData, `IWhatsAppSmsFallbackTicketStore`, TTL `WhatsApp:SmsFallbackTicketTtlSeconds`=72h). `WhatsAppStatusProcessorFunction` claims the ticket on a `failed` status (ETag-conditional delete = exactly-once; claim-before-send is a deliberate at-most-once trade) and sends the SMS — so **131026 "not on WhatsApp" async failures now deliver by SMS**; this supersedes the 2026-06-10 "no async re-send" decision FOR TICKETED SENDS ONLY (everything else stays alert-only). A total failure (WhatsApp AND SMS) raises a forced "Voice Document Delivery" admin alert with the reason. The `send_my_details`/`send_quote` notes + docs tell the model the copy arrives as a text message when the number has no WhatsApp (mention only if the caller says they don't use it).
- **Spelled input is exact data (the "Mets→Metz" fix).** The first prompt now rules: letter-by-letter or letter-word spelling ("N as in Nancy"), in any language, is reconstructed EXACTLY and never "corrected" to a familiar name; read back letter-by-letter once and use exactly what the caller confirms. Emails get a build → full read-back (spell the local part, say the domain naturally, "at"=@ "dot"=.) → confirm-before-use protocol; never guess/autocomplete an address. Plus: "a booking always needs the FULL calendar date and time — never pass only a time, never guess a day the caller did not indicate."
- **Mobile Call Follow-ups entity links (web parity).** The "Created {number}" text on Applied/AutoCreated suggestion cards is now a tappable link: DraftBooking → `BookingDetails{bookingId: appliedEntityNumber}`, DraftQuote → `QuotesDetails{quoteInfo:{quoteId: appliedEntityId}}`, CreateCustomer → `CustomersScreen`.
- **Remaining unrelated flags:** SMS templates are en-only (platform convention); `NormalizedAniOrNull` still region-defaults US.

---

## RECENT CHANGES — 2026-07-11 (mobile post-join in-call UI: phone controls + Speaker + "Before you joined" sheet)

- **Post-join the Live Call screen is now a full phone-call UI** (`clinqetmobilepartnerapp/src/Screen/ProfileFlow/LiveCall/`; user-approved "Option C" design — mockup folder deleted after approval at the user's request). When `joinMode==='app' && appPhase==='live'` the monitoring layout is replaced by: pulsing-ring caller hero (person icon — the bot icon leaves with the AI) + masked number + `Connected · mm:ss` timer + an "AI answered first" chip; a one-line **"Before you joined" peek card** (the caller's last words) opening a **bottom-sheet Modal** with the frozen transcript; round **Mute / Speaker** controls + a red **End** circle ("Ending the call hangs up for both of you" hint); an amber **"You're muted"** strip while muted. Rationale (code-verified): the join commit drops the AI leg on BOTH carriers ⇒ live transcription STOPS at join (human portion is transcribed post-call from the recording, §11.1) — the on-screen transcript is frozen pre-join context, so it must not own the screen nor pretend to be live. Late Azure segments (~1-2s after join) still merge — the SignalR subscription stays focus-gated, NOT join-gated. Pre-join / connecting / phone-join / ended states are UNCHANGED.
- **Speaker toggle = `react-native-incall-manager@4.2.1`** behind the optional-native-module seam: NEW `services/liveCall/audioRoute.ts` (`isSpeakerControlSupported`/`startCallAudio`/`setSpeakerphone`/`stopCallAudio`) + `hasNativeInCallManagerModule()` in `optionalNativeModule.ts` — the lib's JS never throws at import (it dereferences `NativeModules.InCallManager` only at CALL time), so support is gated on native presence, same as WebRTC. `startCallAudio()` fires inside `useInAppJoin.markLive` (AFTER answer/SDP — can never disturb the join) = `start({media:'audio'})` (earpiece-first, auto proximity: screen blanks at the ear) + keep-screen-on; `stopCallAudio()` in `teardown` restores auto routing (`setForceSpeakerphoneOn(null)` ⇒ the lib's tri-state 0) + screen idle. Unlinked binary ⇒ Speaker button HIDES and the retained `LIVE_OS_NOTE` line returns (shipped behavior). Android manifest gained **`MODIFY_AUDIO_SETTINGS` + `WAKE_LOCK`** (both normal install-time permissions; ‼️ `AudioManager.setSpeakerphoneOn`/`setMode` are SILENT no-ops without MODIFY_AUDIO_SETTINGS — no exception, just a logcat permission-denial — and no library manifest supplies it); Bluetooth permissions deliberately NOT added — the lib permission-guards and skips BT management gracefully (Android 12+ checks `BLUETOOTH_CONNECT` and bails without crashing). The join orchestration (generation-cancellation, funnel, mic flow, credential release) is UNTOUCHED.
- **Leave-guard = `usePreventRemove`** (NEVER a raw `beforeRemove` listener): post-join, leaving the screen hangs up the provider leg which ENDS the call for the caller (by design, see the 2026-07-09 post-join-End entry). `usePreventRemove` is the ONLY API native-stack v7 wires into `preventedRoutes` → `preventNativeDismiss`, so the iOS swipe-back is blocked UP FRONT (a raw listener lets the native dismiss complete, then snaps the screen back — verified against the installed `@react-navigation/native-stack@7.3.4` source). Confirming ("End & leave") stores the blocked action in state; prevention drops on the next commit and an effect re-dispatches it — the screen keeps rendering the live call until the pop, and the focus cleanup performs the actual teardown (idempotent). An alert-open ref + `cancelable:false` stops rapid double-back from stacking alerts or stranding the guard. Not active pre-live: cancelling a connecting join is safe (join-miss resumes the AI).
- **Motion (all native-driver):** sheet = custom backdrop-fade + translateY slide (Modal `animationType="none"` + `statusBarTranslucent` per the app's modal convention — the built-in slide would slide the dimmed backdrop too), mounted ONLY while open (`{sheetMounted && …}` — the invisible subtree is never rebuilt on timer ticks) and unmounted only after the close animation; segment bubbles are `useMemo`'d on `[segments, styles, t]` (append-only list; the 1s tick re-renders only the timer strings); in-call UI mounts with a FadeInUp; hero ring is an Animated.loop. Sheet auto-scrolls to the newest line; Android back inside the sheet closes the sheet only (`onRequestClose`).
- **Keys:** 15 new `CALL_FOLLOW_UPS.*` (LIVE_CONNECTED / LIVE_HANDOFF_CHIP / LIVE_BEFORE_YOU_JOINED / LIVE_BEFORE_SHEET_SUB / LIVE_STILL_IN_CALL / LIVE_TRANSCRIPTION_ENDED_NOTE / LIVE_MUTED_STRIP / LIVE_SPEAKER / LIVE_END_CALL / LIVE_END_HINT / LIVE_LEAVE_* / LIVE_CLOSE) in **en/es/gu/hi**; orphans REMOVED everywhere: `LIVE_IN_CALL_WITH`, `LIVE_END`, and the legacy unreferenced `LIVE_JOIN_PHONE`/`LIVE_LISTEN_APP`/`LIVE_CONNECTING`/`LIVE_LEAVE` + the shadowed legacy `LIVE_CONNECTED:"Live"` (which had silently become a DUPLICATE JSON key — last-wins today, one tooling pass from flipping the label). es additionally gained the sibling in-call keys (LIVE_MUTE/LIVE_UNMUTE/LIVE_IN_CALL/LIVE_OS_NOTE/LIVE_UNKNOWN_CALLER/LIVE_CALLER/LIVE_ASSISTANT) so the entire post-join surface + sheet renders fully in Spanish (the rest of the screen keeps the established es en-fallback). New test `__tests__/liveCallAudioRoute.test.ts` (support gating, session idempotency, speaker gating, native-fault swallowing); jest 111/111, tsc 0 errors.
- **Independently audited** (hostile reviewer over the full diff + invariants): 3 major (MODIFY_AUDIO_SETTINGS, duplicate LIVE_CONNECTED, raw-beforeRemove iOS gesture) + 4 minor (statusBarTranslucent, eager sheet evaluation, "Not now" close label, locale orphans) — ALL fixed as above; the 10 join-safety invariants (orchestration untouched, state parity, teardown idempotency, animation cleanup, no new API calls) CONFIRMED against the diff.
- ‼️ **incall-manager rides the SAME pending native rebuild as the voice SDKs** (pods on a Mac / gradle; autolinks, no manual native setup). Until that build ships, Speaker hides and everything else works exactly as before.

## RECENT CHANGES — 2026-07-10 (mobile join: react-native-permissions mic flow + granular failure toasts)

- **Mobile mic permission = react-native-permissions v5 behind the optional-require seam.** `ensureMicPermission` (`clinqetmobilepartnerapp/src/Screen/ProfileFlow/LiveCall/useInAppJoin.ts`) now prefers `react-native-permissions@^5.6.0` — `check` → GRANTED/LIMITED⇒ok · BLOCKED⇒mic-blocked · UNAVAILABLE⇒mic-not-found · DENIED⇒`request(mic, rationale)` (the library shows the existing Android `LIVE_MIC_RATIONALE_*` Alert on a re-ask itself) — loaded via `optionalNativeModule.REACT_NATIVE_PERMISSIONS`: v5's `TurboModuleRegistry.getEnforcing` THROWS at import when the native RNPermissions module isn't in the binary, so shipped binaries fall back to the previous bespoke logic (Android PermissionsAndroid / iOS getUserMedia probe) UNCHANGED. `MicResult` + the `handleMicFailure` contract (mic-blocked|mic-denied|mic-not-found) unchanged. iOS Podfile gained the v5 `scripts/setup` require + `setup_permissions(['Microphone'])`; RECORD_AUDIO + NSMicrophoneUsageDescription already existed.
- **Granular in-app join-failure toasts (web reason-map parity).** `useInAppJoin.start()` tags thrown stage errors with `reason` = `mint-failed` | `connect-failed` (incl. Plivo `sip_identity_unavailable`; the funnel emits keep the specific transport reasons) | `join-failed` | `leg-timeout`; the LiveCall screen maps them to NEW keys `CALL_FOLLOW_UPS.LIVE_MINT_FAILED / LIVE_CONNECT_FAILED / LIVE_JOIN_CALL_FAILED / LIVE_LEG_TIMEOUT` (en/es/gu/hi — es gained its first `CALL_FOLLOW_UPS` block), unknown reason ⇒ the retained `LIVE_AUDIO_FAILED`. Silent-cancel + mic paths unchanged.
- ‼️ **Telnyx in-app join autolink gap (pre-existing, now diagnosed):** `@telnyx/react-native-voice-sdk@1.0.0` is pure JS but its `lib/connection.ts` hard-requires the NATIVE `react-native-websocket-self-signed` — a transitive-only dep, and RN CLI autolinking scans ONLY root package.json deps (`cli-config/build/findDependencies.js`). It must be added as a DIRECT dependency before the next native build or the Telnyx signaling socket has no native module and app-join dies at connect.

## RECENT CHANGES — 2026-07-09 (bridge-only caller-ID via bridge_intent + warm-while-ringing + join fixes)

- **The Transfer connect mode is GONE — the parked AMD-gated Bridge is the ONLY Telnyx connect model.** Telnyx-verified (OpenAPI spec + the external-call-transfers support article + a support ticket): a dial with `link_to` (already sent) + **`bridge_intent=true`** makes Telnyx **overwrite the dial's `from` with the linked caller leg's number** — the sanctioned external-transfer caller-ID, NO Diversion authorization needed (plan-17 Phase 4 dropped). `VoiceProviderConnectMode` → **`VoiceCallerIdMode` (`CallerNumber` default | `ClinketNumber`)** across `Voiceline.CallerIdMode` / `VoiceCallSession.CallerIdMode` (call.initiated snapshot) / `VoiceAssistantApplication.CallerIdMode` + DTOs + the UI toggle (labels unchanged; option values now `CallerNumber`/`ClinketNumber`). The dial's `from` STAYS the owned DID ⇒ a dropped/ignored flag degrades to the DID display, never a rejected dial; a sync-rejected bridge_intent dial retries ONCE as a plain DID dial (variant-keyed `command_id` `dial-bi` vs `dial` so the retry is never deduped by Telnyx). The PHONE provider-join dial gets the same bridge_intent treatment; browser join keeps `from`=caller (on-net SIP). Both toggle choices now have AIRTIGHT voicemail (caller parked until the AMD human verdict — Transfer used to auto-bridge on answer and leak the first seconds of the provider's VM before the verdict). Cap/private plain forwarding still uses the transfer primitive. India/Plivo untouched (always dials from the owned DID — DoT); `CallerIdChoiceEnabled` region gating unchanged. `HandleVoiceAmdUndeterminedAsync` dropped its connect-mode arg (one connect model now).
- **Warm-while-ringing is REAL (build the first prompt while the provider rings).** Telnyx: `WarmAiContext` (provider context ∥ known-caller identity, fire-and-forget, owned scope) fires at **provider-dial start** (`HandleSpeakEndedAsync`, gated on the AI-takeover conditions known at dial time: ReceptionistEnabled · !cap · !private · line Active · hours≠NeverAnswer · SipUri) AND still at the handoff (idempotent cache hit; covers the WhisperActive takeover). `VoiceCallerIdentityService` gained a 5-min `IMemoryCache` (`VoiceCall:KnownCallerCacheMinutes`, caches resolved-null too) so the warm sticks — the accept webhook's parallel fan-out is now cache hits. Plivo: the relay fetches voiceline ∥ context in PARALLEL (was serial), and `PlivoVoiceCallControlFunction` fires a cross-process warm at provider-dial time via the NEW S2S **`POST /internal/{secret}/warm-context`** MCP endpoint (X-Internal-Api-Key; added to the middleware ServerToServerRoutes; 202 + background warm; Cosmos-only, ZERO AI cost) through `IMcpSessionSignalClient.WarmProviderContextAsync` (one shot, no retries, fail-quiet) — deploy.ps1 wires `Mcp__InternalApiKey` to the Functions app (same shared internal key as the API).
- **Web browser-join End fixed (was: End during "Connecting…" did nothing / the join resurrected after End).** `useBrowserCall` has a join GENERATION (`sessionSeqRef`): `end()` bumps it FIRST, every post-await checkpoint in `start()` bails out silently (cleans up post-End mints/clients; a cancelled join never throws ⇒ no bogus error toast), a straggler INVITE after End is hung up (the backend join-miss resumes the AI), and teardown lets the BYE flush (bounded ≤1.5s call-state wait) before `client.disconnect()`.
- **End-to-end hostile audit (same day) — 6 verified fixes on top:** (1) the plain-DID retry after a failed bridge_intent dial now fires ONLY on `DialResult.Rejected` (a definitive non-2xx carrier refusal ⇒ no leg exists) — an AMBIGUOUS failure (2xx-without-call_control_id / transport exhausted) may have created a live leg, and a fresh-command_id re-dial would ring the provider TWICE (worst case: the loser leg's ring-timeout hangup in WhisperActive triggered the takeover and handed a live human↔human call to the AI). `TelnyxCallControlService` classifies: sync non-2xx non-call-ended ⇒ `RejectedByCarrier`; call-ended / 2xx-no-id / exhausted ⇒ `Failed` (never retried). (2) Web: a stale cancelled `start()` can no longer clobber a newer join's held mic (acquire→local, cancel-check BEFORE assigning the shared ref). (3) Web now matches mobile on remote-end-mid-connect: rejectable `live`/`plivoLive` promises fail fast with `remote-ended` (silent — no 20s-late error toast). (4) Web `teardown` captures + CLEARS the shared refs before its slow tail (BYE wait/disconnect/release) so an End→re-Join can never have its fresh client/credential torn down by the old teardown. (5) Mobile `start()` returns a boolean; the LiveCall screen resets `joinMode` on a silently-cancelled join (no stranded "Connecting you…" spinner). (6) Cancelled joins no longer pollute the VoiceCallAction funnel with fake register/leg failures. Plus: Android mic re-ask now shows a localized RATIONALE dialog (`LIVE_MIC_RATIONALE_*`, en/gu/hi) via `PermissionsAndroid.request(perm, rationale)` — the OS-recommended deny-once-retry flow; permanent denial keeps the Open-Settings alert. New tests: middleware warm-context route theory, MCP integration warm-context (202/400/401), `McpSessionSignalClient.WarmProviderContextAsync` (3), Plivo warm gating (3), `VoiceCallerIdentityServiceTests` cache suite, bridge_intent reject-retry + ambiguous-never-redial, DialResult classification.
- **Mobile in-app join fixed (was: "Could not connect audio" ~20s after tapping Join from the app).** (1) `isInAppJoinSupported` now ALSO requires the NATIVE WebRTC module (`NativeModules.WebRTCModule != null` — react-native-webrtc only throws at import when it is exactly `null`; `undefined` = unlinked binary silently "loads") ⇒ a JS-only install shows phone-join only, never a dead button; (2) both transports' async `answer()`/`accept()` rejections now FAIL the join fast (`failLive` → awaitLive rejects with `answer_failed`/`remote_ended`) instead of an unhandled rejection + silent 20s timeout; the post-ready Telnyx socket error also fails fast; (3) the same End-cancellation generation as web (`useInAppJoin.sessionSeqRef`); (4) Android mic = `PermissionsAndroid.check()` then `request()` at JOIN time only — never at app start; once granted it never prompts again (iOS prompts once ever via the getUserMedia probe); NEVER_ASK_AGAIN → the Open-Settings alert; (5) a caller hangup mid-join runs the summary flow, never an "audio failed" toast on top (`endedFiredRef` guard).

- **Post-join provider End now ENDS the call (2026-07-09, both carriers).** `EnterPartnerHangupTakeoverAsync` (Telnyx + Plivo): when `ReferredToPartnerAt != null` (the provider JOINED the live call from browser/app/phone) a provider-leg hangup hangs up the CALLER leg immediately — never voicemail, never an AI re-engage (was: the takeover gate could fall to the voicemail invite, e.g. AfterHoursOnly within hours). The caller A-leg hangup then owns the normal post-call summary (joined human portion appended). The join commit now ALSO re-stamps `PartnerCallControlId` = the joined provider leg, and the end branch is LEG-GATED (`hungLeg == PartnerCallControlId`) so a remnant B-leg death (the abandoned Azure SIP leg on Telnyx / the departing ai-agent member callback on Plivo) can NEVER end — or previously voicemail — a live joined call. Caller hangup after a join is the unchanged authoritative A-leg path (summary with the joined human portion appended via the `ReferredToPartnerAt − RecordingStartedAt` window; the abandoned provider leg is auto-hung by the carrier). Pre-join whisper hangups keep the AI-rescue takeover unchanged. Trade (user-accepted): an ACCIDENTAL provider-side drop post-join (network/tab death) also ends the call — indistinguishable at the carrier from a deliberate End.

## RECENT CHANGES — 2026-07-07 (voice plan 17: AMD premium-iOS + noise + per-provider caller-ID)

- **AMD now defaults to Telnyx PREMIUM iOS-screening** (`VoiceCall:PremiumAmdEnabled`, default **true**) — the ONLY mode that detects an iPhone (iOS Live Voicemail / Call Screening) that standard `detect` can't, so the AI takes over instead of the caller hearing the provider's iPhone voicemail. `false` = kill-switch back to `AnsweringMachineDetection` ("detect"); the **Advanced** tier (`ModelTier != "mini"`) always gets premium. A resolver `ResolveAmdDetectionMode(voiceline)` feeds every dial/transfer + the provider-join dial. `TelnyxWebhookParser` maps `call.machine.premium.call_screening.detected` + `call.machine.premium.greeting.ended` → `MachineDetectionEnded`. Verdict classifier: `machine`/`fax_detected`/**`screening`**/`beep_detected` → miss/AI; `not_sure`/`silence`/`prompt_ended`/`no_beep_detected` → **keep bridge/whisper (never hang up on a possible human) + fire an async Service-Bus `AdminAlertType.VoiceAmdUndetermined` monitoring alert** (idempotent). `TelnyxCallControlService` attaches `answering_machine_detection_config.prompt_end_timeout_millis` (`Telnyx:PremiumAmdPromptEndTimeoutMillis`=30000) only in premium-iOS mode.
- **Noise: `semantic_vad` is now the DEFAULT turn detection** (`AzureRealtimeSettings.VadType`, default `semantic_vad`; `VadEagerness`=`medium` ≈ 4s max-wait ceiling) — word-based ⇒ ignores non-speech white/background noise. `VadThreshold` 0.6→**0.75** (server_vad fallback). **`far_field` kept** (correct for telephony noise). New shared `RealtimeSessionPayloadBuilder.BuildTurnDetection()` feeds BOTH the Telnyx accept + Plivo WebSocket payloads. (Git-proven: the Plivo commit did NOT regress the Telnyx audio path.) Voice Live API migration = NOT cheaper for our native S2S; its value would be Azure-native deep noise suppression, not price.
- **Per-provider caller-ID (`ProviderConnectMode`) is now per-Voiceline**, region-gated. Nullable `Voiceline.ProviderConnectMode?` (per-provider, set from the UI ONLY — NO global appsetting; null ⇒ code default Bridge (defensive edge)); function `ResolveConnectMode(voiceline)`. Provider sets it via `VoiceAssistantApplicationDto.ConnectMode` → `VoiceAssistantApplication.ConnectMode` → synced to the voiceline. `VoiceAssistantSettings.CallerIdChoiceEnabled` (per-stamp; Telnyx/CA-US **true**, Plivo/India **false**) drives `VoiceAssistantStateDto.AllowCallerIdChoice` (UI shows the toggle only when true) and forces `ConnectMode=null` on India. **Hard DoT guarantee: the Plivo runtime never reads the field ⇒ India is always Bridge regardless.** UI (mockup-first, `clinqetwebpartnerapp/mockups/caller-id-toggle/`): CA/US toggle "Show the caller's number" (Transfer, default) vs "Show your Clinket number" (Bridge); hidden for India. Admin app: `VoiceAmdUndetermined` added to the Alerts filter. Phase 4 (Bridge caller-ID via Telnyx Diversion authorization) drafted in `voice-handoff/18-*`.

---

## 1. WHERE EVERYTHING LIVES (component map)

| Layer | Project / path | Role |
|---|---|---|
| **MCP server (NEW)** | `clinqetmcp/Clinqet.Mcp/` | Standalone ASP.NET web app; MCP tools + per-call auth + live monitor + provider-join + OTP verification |
| **Telephony orchestration** | `clinqetfuncations/Clinqet.Communications/Functions/Voice*.cs`, `RealtimeCallWebhookFunction.cs`, `PlivoVoiceCallControlFunction.cs` | Telnyx imperative state machine, Azure realtime accept; India = the carrier-gated `PlivoVoiceCallControlFunction` (§10) |
| | `…/Services/McpSessionSignalClient.cs` | Function → MCP monitor wake-up |
| | `…/Functions/VoicePostCallProcessorFunction.cs` | Call summary, suggestions, usage, recording copy |
| **Carrier adapters** | `clinqetinfrastructure/Services/Communication/Telnyx*.cs` + `Plivo*.cs` | Call control, webhook parse/validate, number provisioning, WebRTC creds. CA/US = Telnyx; IN = the Plivo adapter (shipped, §10) |
| **Voice services** | `clinqetinfrastructure/Services/Voice/` | `RealtimeCallService`, `RealtimeSessionPayloadBuilder` (the "first prompt"), `VoiceCallTokenService`, `FullProviderContextService`, `VoiceAssistantService`, hours evaluator, caller identity |
| **API** | `clinqetapi/Clinqet.API/Controllers/Voice/VoiceAssistantController.cs` | Provider endpoints (`/voice-assistant/*`): state, application, live calls, join, WebRTC cred, call summaries |
| | `…/Controllers/Voice/InternalVoiceTriggerController.cs` | MCP → API live-event → SignalR fan-out (`X-Internal-Api-Key`) |
| | `…/Controllers/Admin/AdminVoiceAssistantController.cs` | Admin invite/approve/reject/assign-number/hold/resume (`[Authorize(Roles="Admin")]`) |
| | `…/Services/VoiceLiveCallClient.cs` | API → MCP S2S bridge (active-calls + provider-join) |
| **Cosmos entities** | `clinqetcore/Entities/COSMOS/` | `VoiceCallSession`, `Voiceline`, `VoiceAssistantState`, `VoiceBusinessLiveCall`, `VoiceTranscript`, `McpAudit`, `CallSummary` |
| **Shared** | `clinqetshared/Enums/Voice*.cs`, `Models/{VoiceCallSettings,AzureRealtimeSettings,VoiceAssistantSettings,TelnyxSettings,PlivoSettings,SmsRoutingSettings}.cs`, `DTOs/Voice/**`, `DTOs/Messages/{VoicePostCallMessage,VoiceMonitorCommand}.cs` | Enums, settings, DTOs, queue messages |
| **Partner UI** | `clinqetwebpartnerapp/src/components/Profile/voiceAssistant/` | Setup wizard (apply → status timeline → active panel) |
| | `…/src/components/callFollowUps/` + `…/app/dashboard/call-follow-ups/` | Live call cards, browser-join (`@telnyx/webrtc`), recordings, summaries, suggestions |
| | `…/src/services/voiceAssistantServices.js`, `…/services/signalRService.js` | API client + SignalR voice events |
| **Admin UI** | `clinqetwebadmin/src/pages/voice/VoiceAssistantRequestsPage.jsx`, `…/services/voiceAssistantService.js` | Invite / approve / assign number |
| **Deployment** | `azureautomation/deploy.ps1` + `apps.json` + `events.json` + `storage.json`; `clinqetmcp/.github/workflows/` | MCP App Service per region, queues, storage, realtime Foundry, carrier wiring |

---

## 2. END-TO-END CALL FLOW (the spine)

```
Caller dials the Clinket DID (voiceline.e164)
        │
        ▼  carrier webhook → POST /api/voice/webhook  (VoiceCallControlFunction, Anonymous)
 ┌───────────────────────────────────────────────────────────────────────┐
 │ Telnyx (CA/US): imperative state machine   (the shipped path + spec)    │
 │  call.initiated → create VoiceCallSession                               │
 │  answer → speak DISCLAIMER → start RECORDING                            │
 │  dial provider (caller PARKED + ringback)                              │
 │  AMD verdict:                                                          │
 │    human  → BRIDGE caller↔provider (post-call recording STT, §11.1)    │
 │    machine/no-answer/decline → MISS branch                            │
 │  India = Plivo: PlivoVoiceCallControlFunction — same flow, MPC anchor  │
 │    + AMD report-then-react + a WSS AI-media relay (§10)                │
 └───────────────────────────────────────────────────────────────────────┘
        │ provider missed / declined / after-hours / hung-up-bridged
        ▼  TryReceptionistHandoff / ShouldEngageReceptionist  (the AI-takeover gate)
   mint per-call token · Phase=AiHandoff · WARM provider context cache
        │
        ▼  Telnyx: transfer_to_sip(Azure SIP, header X-Clinket-Call=token)
           India (Plivo): AI engaged as an MPC ai-agent member → PlivoVoiceRelay → Azure realtime
        ▼
 Azure GPT-Realtime receives the SIP INVITE → POST /api/voice/realtime
   (RealtimeCallWebhookFunction): resolve binding → RealtimeSessionPayloadBuilder
   builds the "first prompt" (embedded provider profile + MCP tool wiring) →
   AcceptAsync → Phase=Active → SignalSessionStart → notify provider (live card)
        │
        ▼  the AI now talks to the caller; mid-call it calls MCP tools:
 ┌───────────────────────────────────────────────────────────────────────┐
 │ Azure Realtime  ──MCP over HTTP (Bearer per-call token)──▶  Clinqet.Mcp │
 │   server_url = {Mcp:PublicUrl}/mcp/{Mcp:SecretPath}                     │
 │   tools: get_provider_context, find_booking, request_booking, …        │
 └───────────────────────────────────────────────────────────────────────┘
        │  in parallel, Clinqet.Mcp VoiceSessionMonitor holds a WS to Azure realtime:
        ▼  persists transcript segments + POSTs live-event to API → SignalR → provider
   Provider opens Call Follow-ups → WatchVoiceLive → live transcript streams in
        │  provider taps "Join" (browser/phone) → API → MCP /provider-join
        ▼  monitor announces "{business} would like to join", then:
           Telnyx → mute AI (VAD off) + StartProviderJoinDial → function dials provider (AMD);
                    human → bridge caller↔provider + drop AI; miss → resume AI (caller stays bridged)
           India (Plivo) → same announce→silence→resume model (MPC participant add/remove; AI media on the relay)
        │  call ends (caller hangup / end_call tool / deadline / idle backstop)
        ▼  enqueue voice-postcall → VoicePostCallProcessorFunction:
   summarize transcript · suggestions · usage metering · recording copy · CallSummaryReady
```

**The "three levels of settings" the provider controls call-handling with** = `Voiceline.HoursMode`
(`VoiceHoursMode`):
- **`AlwaysOnMiss`** — AI engages on *every* missed/declined call (24×7).
- **`AfterHoursOnly`** — AI engages only when the call is *outside* the business's weekly working
  hours (evaluated via `IVoiceHoursEvaluator` against `Availability` + `Voiceline.TimeZoneId`);
  inside hours → voicemail.
- **`NeverAnswer`** — the AI never converses; a missed call goes to voicemail (the disclaimer is
  the record-only variant). Plus two orthogonal runtime states: **Pause** (`VoicelineStatus.Paused`
  → line plays "unavailable") and **Private** (`PrivateMode` → rings the provider but NEVER records/
  transcribes/AI-handles/summarizes — confidential passthrough; §6: when `VoiceCall:PrivateModeReferEnabled`
  is on (default OFF), a Telnyx **SIP REFER** (`IVoiceTelephonyProvider.ReferAsync`, Diversion = the Clinket DID)
  hands the caller off and removes the platform from the media path — falls back to the parking transfer if the
  REFER is rejected, so it never breaks).

---

## 3. THE MCP SERVER — `clinqetmcp/Clinqet.Mcp`  (the brand-new MCP API)

### 3.1 Project shape (`Clinqet.Mcp.csproj`, `Program.cs`)
- **`Microsoft.NET.Sdk.Web`**, **.NET 10**. NOT a function app — a normal ASP.NET web app.
- Key packages: **`ModelContextProtocol.AspNetCore` 1.4.0** (the official MCP SDK), `Azure.Monitor.OpenTelemetry.AspNetCore`, `Microsoft.Extensions.Http.Polly`.
- References `clinqetshared`, `clinqetcore`, `clinqetinfrastructure` (reuses repos/services). Build composes those sibling repos in CI (see §15).
- **No Dockerfile** — deployed as a framework-dependent ZIP to an Azure App Service.
- `CLINKET_REGION=(in|ca)` layers `appsettings.{region}.json` on top (dev only; unset in Azure).
- MCP registration (`Program.cs`): `AddMcpServer().WithHttpTransport(opts => opts.Stateless = true)` then `.WithTools<…>()` for **9 tool classes**: `ProviderContextTools`, `TransactionTools`, `BookingTools`, `VerificationTools`, `MessageTools`, `ServiceManagementTools`, `PartnerTransactionTools`, `CatalogTools`, `ServiceInfoTools` (`MarketplaceSearchTools` was DELETED 2026-07-28).
- **Stateless transport** — no MCP session state; each request carries its own per-call bearer
  token and the binding doc is the source of truth (`CallContext` flows via `AsyncLocal`).
- Mounted at **`/mcp/{Mcp:SecretPath}`** (`app.MapMcp(...)`). The secret path is a 64-hex string.
- Cosmos client: connection-string OR endpoint + `DefaultAzureCredential` (managed identity in
  Azure — the MCP is the ONLY app that reaches Cosmos via AAD). Repos registered **Scoped** with the
  database name injected via `WithDatabaseName<>` (NEVER register a bare `string` in DI — the MCP
  tool factory drops DI-resolvable parameter types from tool schemas and would swallow string args).
- Hosted services: `VoiceSessionMonitor` (live-call WS), `VoiceMonitorCommandListener` (backplane),
  `AdminAlertCooldownService`.

### 3.2 The 30 MCP tools (curated, alphabetical — verified by `McpToolIntegrationTests`)
`calculate_quote, cancel_my_booking, confirm_booking, create_booking, create_quote, create_services,
delete_service, end_call, find_booking, find_booking_by_details, find_services, get_booking,
get_categories, get_provider_context, get_quote, get_quote_estimate, get_transactions, leave_message,
prepare_action, request_action_otp, request_booking, request_booking_verification, request_callback,
reschedule_my_booking, send_my_details, send_quote, send_service_info, update_service,
verify_action_otp, verify_booking_code`. (`search_services` was deleted 2026-07-28.) ‼️ A CHAT session
(call id prefixed `chat-`, minted by the API gateway) is refused everything outside
`Mcp:ChatToolAllowlist` — see the 2026-08-14 block.

- Tools are declared with `[McpServerToolType]` on the class and `[McpServerTool(Name=…, …)]` +
  `[Description(…)]` on methods. Tool **names are explicit** (snake_case) — the older reflection
  names (`SearchServices`, `DeleteService`, `BulkCreateServices`) must NEVER reappear.
- **Scope split** (`VoiceCallScope`): a **customer** call sees a narrow set; a **partner** call sees
  partner-only tools (`get_booking`, `get_transactions`, `delete_service`,
  `create_booking`, `confirm_booking`, `create_quote`, `create_services`, `update_service`).
  Partner-only tools called in customer scope are **refused** ("not available for this caller").
- `get_provider_context`: **customer** scope returns a public subset (no license number, no
  unreviewed services, a `licenseSummary` instead); **partner** scope returns the full context.

### 3.3 `McpToolGuard` — every tool runs through it (`Tools/McpToolGuard.cs`)
`ExecuteAsync(toolName, partnerOnly, action, ct)`:
1. Require an authenticated `CallContext` (from `ICallContextAccessor.Current`) — **`businessId`
   ALWAYS comes from the server-side binding, NEVER from the model**. A model-supplied `businessId`
   argument is silently ignored (tenant isolation is structural).
2. **Rate limit** (`McpToolRateLimiter`, per-business token-bucket + concurrency cap) BEFORE scope —
   a refusal consumes the window and writes **no** audit row (RU amplifier guard).
3. Scope check (`partnerOnly && context.Scope != Partner` → refused).
4. Run the action; emit a **metadata-only** `McpAudit` row (tool name, scope, outcome, durationMs,
   TTL `Mcp:AuditTtlDays`) fire-and-forget (owned scope, never blocks the live call).
- Tool failures log the stable marker `"MCP tool execution failed"` (drives the `*-voice-failures`
  alert) and surface a **classified, model-facing `McpException`** naming the tool + the failure class (timeout /
  data-service / unreachable / internal) and stating plainly whether the action completed ("did NOT go through —
  do not tell the caller it worked; take a message"), so the model reacts truthfully instead of stalling or claiming
  success. Never internals/PII. Per-tool McpExceptions + structured data results (`note`/`message`) stay the
  specific first-line guidance.

### 3.4 Rate limiting (`RateLimiting/McpToolRateLimiter.cs`)
Per-business token bucket from `Mcp:RateLimiting`: `RequestsPerWindow` (default 60) / `WindowMinutes`
(1) + `MaxConcurrentToolCallsPerBusiness` (4). Refusals return `RequestLimit` (with `RetryAfter`) or
`ConcurrencyLimit`. Disabled → always allowed. Idle buckets reaped, never while a call is in-flight.

### 3.5 `ProviderContextTools.get_provider_context` — the "do NOT call me on a phone call" tool
On a **phone** call the full profile is ALREADY embedded in the realtime instructions (see §7), so
the tool's own `[Description]` tells the model to answer service/price/hours/offers/area questions
directly from the embedded profile and **not** call this tool (it would make the caller wait in
silence). The text **chat** assistant, which has no embedded profile, may call it freely.

---

## 4. AUTH & AUTHORIZATION (the 3-tier channel model) — `Middleware/McpChannelAuthMiddleware.cs`

Every request to the MCP server passes `McpChannelAuthMiddleware`, which **fails closed** and alerts
on rejection (`McpSecurityAlertService`, cooldown-gated).

| Tier | Used by | Gate |
|---|---|---|
| **Open** | `/health`, `/ping` | none |
| **Tool channel** | `POST /mcp/{secret}` (Azure realtime model), `POST /internal/{secret}/session-start` (function wake-up) | secret path (fixed-time compare) **+** per-call **Bearer** token **+** server-side **binding doc** |
| **Server-to-server** | `GET /internal/{secret}/active-calls`, `POST /internal/{secret}/provider-join` (the Main API) | secret path **+** `X-Internal-Api-Key` (SHA-256, fixed-time) — **no** per-call bearer (the API is the trust boundary; it validated the provider JWT and passes `businessId`) |

**Secret-path mismatch → 404** (not 401), so the endpoint is invisible to probes. Missing/invalid
bearer → 401. Cosmos outage during the binding lookup → **503** (fail closed).

### 4.1 Per-call token (`Services/Voice/VoiceCallTokenService.cs`)
A JWT (HMAC-SHA256) minted at handoff. Claims: `businessId`, `callId`, `scope`
(`VoiceCallScope`), `jti`. `Issuer=Mcp:TokenIssuer` (`clinket-voice`), `Audience=Mcp:TokenAudience`
(`clinket-mcp`). Signing key = `Mcp:TokenSigningKey` (≥32 chars). Lifetime =
`VoiceCall:CallTimeLimitSeconds` + `TokenLifetimeBufferMinutes`. **Every mint gets a fresh `jti`** —
this is the revocation primitive.

### 4.2 Binding doc cross-check (`VoiceCallSession`)
After the token validates, the middleware loads `VoiceCallSession` by `callId` and verifies:
- session exists (else 401 `UnknownCallBinding`),
- **`session.Jti == token.jti`** (else 401 `TokenJtiMismatch` — a re-minted token revokes the old),
- `session.BusinessId == token.businessId` **and** `session.Scope == token.scope` (else 401
  `BindingClaimMismatch`).

On success it stamps `CallContext { BusinessId, CallId, Scope, Verified, CustomerId,
VerifiedBookingNumber }` (`AsyncLocal`, cleared after the request). Validation failure reasons:
`EmptyToken`, `MissingClaims` (incl. unknown scope), expired, wrong issuer/audience, `alg:none`,
HS384≠HS256, tampered sig.

---

## 5. PROVIDER SETUP LIFECYCLE (invite → application → number → Active)

State machine — `VoiceAssistantStatus`: `NotInvited, Invited, Draft, Submitted, NumberPending,
Active, Rejected, OnHold, Cancelled`. State is **embedded on `BusinessProfile.VoiceAssistant`**
(`VoiceAssistantState`), NOT a standalone container; mutated with **ETag CAS** (3 retries) via
`VoiceAssistantService` (`clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs`).

```
NotInvited ──(admin Invite)──▶ Invited ──(provider SaveApplication)──▶ Draft
   ▲  │                                         │
   │  └──(admin RevokeInvite, from Invited/Draft)│ (provider Submit; gates pass)
   │                                             ▼
Cancelled ◀──(provider Cancel, any invited)── Submitted ──(admin Approve)──▶ NumberPending
                                                 │  ▲                              │
                                  (admin Reject) │  │(provider re-Submit)          │(admin AssignNumber)
                                                 ▼  │                              ▼
                                              Rejected                           Active
   any of {Invited,Draft,Submitted,NumberPending,Active} ──(admin Hold)──▶ OnHold ──(Resume)──▶ PreviousStatus
```

**Entry is enroll-first (Part 3):** paying for / starting the AI add-on trial calls
`IVoiceAssistantService.EnrollAsync` from `AiAddOnService.EnsureProvisioningAsync`, moving
`NotInvited/Cancelled → Invited` (idempotent, `InvitedBy="billing"`, reuses the `VoiceAssistantInvited`
notification). Admin `InviteAsync` is kept as a comp path; both call the private `TransitionToInvitedAsync`.
The internal enum value `Invited` is unchanged and now means "enrolled" (UI shows localized labels).

### 5.1 Admin side — `AdminVoiceAssistantController` (`[Authorize(Roles="Admin")]`, route `api/v{v}/admin/voice-assistant`)
| Endpoint | Effect |
|---|---|
| `POST {businessId}/invite` | `→ Invited` + dispatch `VoiceAssistantInvited` (in-app+SignalR+push+email; email links the setup page) |
| `DELETE {businessId}/invite` | `Invited/Draft → NotInvited` (keeps Draft data) |
| `POST {businessId}/approve` | `Submitted → NumberPending` |
| `GET {businessId}/billing-status` | AI add-on payment snapshot (`AdminVoiceBillingStatusDto` — `None/Trialing/Paid/Lapsed`, tier, price, trial-days-left, `CanAssignNumber`) read from SQL `ProviderAddOn` via `IAiAddOnService.GetVoiceAddOnBillingStatusAsync` (Decision F; the admin client never calls the provider billing API) |
| `GET {businessId}/number-quote?e164=` | carrier price + availability **and our internal binding** for a specific DID (`VoiceNumberQuoteDto`: `OwnedByUs/Available/InUseElsewhere/NotAvailable`, monthly/setup minor, `TooExpensive`, `MaxMonthlyCostMinor`, plus `BindingState`/`BoundBusinessId`/`BoundBusinessName`/`QuarantineUntil`/`CanOverrideBinding` and the single verdict `CanAssign`) shown BEFORE any purchase. The UI MUST gate on `CanAssign` — re-deriving that rule client-side is what produced the "No charge, Assign" dead-end |
| `POST {businessId}/assign-number` (`AssignVoiceNumberDto` = `{E164 required, ConfirmPurchase}`) | quote-then-assign: `OwnedByUs`⇒free assign, `Available`≤`MaxNumberMonthlyCostMinor`⇒purchase that exact DID, over-limit/in-use/not-available⇒refused (localized); REFUSED for `Lapsed` billing (`Error_VoiceAssistantProviderLapsed`) → `Active` + `VoiceAssistantActivated` |
| `POST {businessId}/reject` (`{Reason}`) | `Submitted/NumberPending → Rejected` + `VoiceAssistantRejected` |
| `POST {businessId}/hold` (`{Reason?,Silent}`) | any invited → `OnHold` (pauses live line); `Silent` suppresses notify |
| `POST {businessId}/resume` | `OnHold → PreviousStatus` + `VoiceAssistantHoldLifted` |
| `POST {businessId}/model-tier` (`{ModelTier}`) | set `mini`/`realtime-1.5`, re-sync voiceline |
| `POST {businessId}/release-number` | `Cancelled` only → release the DID, tombstone the voiceline (TTL) |

The **submitted application surfaces to admins** as an `AdminAlertType.VoiceAssistantApplicationSubmitted`
admin alert (forced, deterministic `EventId`); the admin app's "Voice Assistant Requests" page
(`clinqetwebadmin/src/pages/voice/VoiceAssistantRequestsPage.jsx`) lists these via `getPendingVoiceAlerts`.
The admin assign UI is a single required E.164 input + **Look up** (calls `number-quote`) + a mandatory purchase-confirm dialog; the blind "buy any available number" mode is gone. Every request card shows the provider payment status and disables **Assign** for `Lapsed`.

### 5.2 Provider side — `VoiceAssistantController` (`[Authorize]`, route `api/v{v}/voice-assistant`)
`businessId` = the authenticated provider's user number (`GetCurrentUserNumberAsync`).
- `GET /` → `VoiceAssistantStateDto`; `GET /options` → voices, languages, allowed countries,
  persona max length, retention days.
- `PUT /application` (`VoiceAssistantApplicationDto`) — draft autosave (`Invited→Draft`).
- `POST /application/submit` — `Draft/Rejected→Submitted` after `ValidateSubmissionGates`
  (**AI readiness** — `VoiceAssistantOnboardingReadiness.IsReady`, address country ∈ `AllowedCountries`, complete application, consent). UI label = **"Finish setup"**.
  ‼️ **AI readiness is NOT the 7-step onboarding progress.** `VoiceAssistantOnboardingReadiness` (clinqetinfrastructure/Services/Voice) is the ONE definition of the AI setup gate — **BusinessDetails + BusinessAddress only** (2026-09-09) — and it is used by BOTH this gate and `ToStateDto`. Category, services, availability and service area are used when present and do **not** block setup. **Portfolio is deliberately excluded**: a gallery answers no caller question, and gating on `OnboardingStatus.Progress == 100` (which counts it) made the AI setup demand a portfolio before it would go live. The 7-step wizard (`OnboardingProgressService` / `ONBOARDING_STEP_LABEL_IDS`) is a different contract and was not changed.
- There is **NO** `request-access` endpoint — enrolling (pay / start the AI trial) is the single entry that moves `NotInvited → Invited` and unlocks setup (`EnrollAsync`; see §5.5).
- `POST /cancel` `→ Cancelled`; `POST /pause` `{Paused}`; `POST /private` `{Private}`; `GET /usage`.

### 5.3 The application (`VoiceAssistantApplicationDto`) — what the provider configures
`NumberMode` (`VoiceNumberMode`: **both are selectable since 2026-09-15** — `ForwardExisting` is keep-your-own-number,
see the section at the top of this file), `ForwardingTarget` (E.164, validated
`^\+[1-9]\d{7,14}$`, must not loop back to a platform DID), `LanguageProfile.Primary`, `Voice`,
`GreetingPersona?` (≤ `PersonaMaxLength`, default **150**), `OperatingInstructions?` (owner **standing instructions** — embedded verbatim in the realtime first prompt as absolute, caller-proof rules that override the assistant's defaults but never its verification/privacy rules; ≤ `OperatingInstructionsMaxLength`, default **1000**), `HoursMode` (the 3 levels), `RecordingEnabled` (default
true), `ConsentAccepted`, `TrainingConsentAccepted` (optional, see below). On AssignNumber/save the application is projected into the runtime
`Voiceline` via `SyncVoicelineFromApplicationAsync` (sets `ForwardTo`, `HoursMode`, `ModelTier`,
`Voice`, `LanguageProfile`, `GreetingPersona`, `OperatingInstructions`, `RecordingEnabled`, `PrivateMode`,
`TimeZoneId` from state→IANA map, `Status`). ‼️ It does NOT touch `MonthlyMinuteCap` — the billing ledger owns it (`ProjectCapToVoicelineAsync`, called right after `AssignNumberAsync` syncs the line); stamping a default there handed a lapsed provider free minutes.

**‼️ `TrainingConsentAccepted` — the OTHER consent, and it is nothing like `ConsentAccepted` (2026-08-18).**
`ConsentAccepted` is the MANDATORY one-time authorisation to answer calls: apply-mode only, gates
**Finish setup**. `TrainingConsentAccepted` is an OPTIONAL, reversible **setting** — permission to use
call recordings to improve the Clinket AI assistant. It renders in **both** apply and manage mode,
**defaults ON for a new application**, and **never gates any button**. Storage is the nullable
`VoiceAssistantApplication.TrainingConsentAcceptedAt` (null ⇒ never granted or withdrawn); the DTO
exposes it as the bool `TrainingConsentAccepted` (`HasValue`), defaulting **false** so an omitted field
can never grant it. Granting re-uses the existing timestamp (`?? UtcNow`) so re-saving does not restamp.

**Evidence — written only on a REAL change, only AFTER the profile write commits:**
`SaveApplicationAsync` captures `trainingConsentChanged` INSIDE the CAS lambda (so it describes the
attempt that actually won), then post-commit calls `RecordTrainingConsentChangeAsync`, which writes two
things and lets neither failure strand the provider's save:

| Record | Retention | Why |
|---|---|---|
| `UserActivityTypes.VoiceTrainingConsent` ledger entry | **never expires** (`Ttl = -1`, hard-coded in `UserActivityProcessorFunction.ConsentNeverExpireActivityTypes`) | the durable proof; no UI can delete it |
| `AdminAlertType.VoiceTrainingConsentChanged` (Severity `Low`, both directions) | **`DocumentTtl:VoiceTrainingConsentAuditTtlDays` = 2555 days (7 years)** | the visible, filterable surface on the Alerts page |

- The alert is a **DIRECT `IAdminAlertRepository.CreateAlertAsync` write, NOT the alert queue** — a queued
  message cannot carry a ttl and would silently take the 90-day default. Same technique as
  `AdminProviderController.WriteVerificationAuditAlertAsync`.
- ‼️ **LEGAL, no override:** `VoiceTrainingConsentChanged` is in `AdminAlertController.IsImmutableAuditAlert`
  ⇒ **delete is refused** (400 `Error_AlertNotDeletable`), and the button is hidden in `clinqetwebadmin`
  `AlertsPage.jsx` (`ALERT_TYPES` + `IMMUTABLE_AUDIT_ALERT_TYPES`). The only other mutating routes are
  `mark-read` and `resolve`; neither can shorten retention, because Cosmos expiry is `_ts + ttl` and every
  write bumps `_ts` ⇒ triage can only ever push expiry LATER.
- ‼️ **`PatchOperation.Set("/ttl", …)` is a SILENT NO-OP — proven 2026-08-18** by a direct-repository probe:
  the patched resource echoes the pre-patch ttl while the sibling `/isResolved`, `/resolvedAt`, `/resolvedBy`,
  `/updatedAt` ops all apply and the call returns 200. So the `ttlSeconds` re-pin threaded through
  `AdminAlertRepository.MarkAsResolvedAsync` (pre-existing product code, also used by `AdminAccessGranted` /
  `AdminAccessRevoked` / `ProviderVerificationChanged`) does nothing. It was only ever a data-minimisation
  nicety (cancel the `_ts` drift), never the survival guarantee. The seven-year ttl that actually governs
  expiry is stamped at CREATE time by `CreateAlertAsync` — an upsert, which does persist it. **Assert the
  invariant, not the pin:** retention after triage must stay within `[7y − age, 7y]`.
- An unchanged save writes **nothing**. A failed save writes nothing — we must never evidence a
  permission that did not persist.
- Copy is locked and legally reviewed: it must say "the **Clinket** AI assistant" (improvement is
  platform-wide; a narrower purpose invalidates the permission under GDPR/DPDP and misleads under FTC
  Act §5 / Canada's Competition Act), must **not** say "train our model" (over-claims, drags in US
  biometric rules), and must **not** claim data never leaves our ecosystem (the live privacy policy
  already discloses third-party hosting). Keys: web `voiceAssistant.trainingConsent.{title,label,helper}`,
  mobile `VOICE_ASSISTANT.TRAINING_CONSENT_{TITLE,LABEL,HELPER}` — 5 languages each.
- Guards: `VoiceAssistantServiceTests` → `#region TrainingConsent` (grant/withdraw/unchanged/ttl/
  evidence-failure), `AdminAlertControllerTests` (unit + integration) → delete refused + resolve keeps
  seven years, `UserActivityProcessorFunctionTests` → never-expire theory,
  `__tests__/voiceApplicationValidation.test.tsx` → default-on, saved-opt-out respected, changeable in
  manage mode, never gates submit.

**Clear semantics (`SaveApplicationAsync`):** the partner form posts the COMPLETE current state on
every save (it is NOT a partial PATCH), so the two optional free-text fields — `GreetingPersona` +
`OperatingInstructions` — are **full-replaced** (empty/whitespace ⇒ null) so a provider can actually
CLEAR them; a `null` is an intentional clear, never "leave unchanged". Do NOT reintroduce the
`if (dto.X != null)` skip — it silently keeps the old text on clear (the original 2026-06 bug). The
fixed selections (`NumberMode`/`Voice`/`HoursMode`/`LanguageProfile`) + the required `ForwardingTarget`
stay apply-when-provided (the UI can't empty them).

**‼️ Required-field validation — BLANK IS "NOT CHOSEN YET", NEVER "INVALID" (2026-08-17).**
`ValidateApplicationFormats` normalises `ForwardingTarget`/`LanguageProfile.Primary`/`Voice` through
`NormalizeOptionalText` and only format-checks a NON-blank value; `SaveApplicationAsync` then applies
only the non-blank ones, so a blank can never wipe a stored selection. Completeness is decided in ONE
place — `MissingApplicationFieldKey(application)` — which returns the localization key of the FIRST
field still owed, in form order:
`Error_VoiceAssistantNumberModeRequired` → `…ForwardingTargetRequired` → `…LanguageRequired` →
`…VoiceRequired` → `…HoursModeRequired` (a null application ⇒ the generic
`Error_VoiceAssistantApplicationIncomplete`). `ValidateSubmissionGates` throws that key.
- **Never re-lump these into one "incomplete" error.** The old single key told the provider nothing,
  and blank values reached the format checks, so an unchosen language answered "not supported" and an
  unchosen voice "not available" — both about fields the provider had never touched.
- **A draft is allowed to be partial.** Only submit — and, on the clients, a `manage`-mode save, which
  edits a LIVE assistant — requires the full set.
- **Clients validate the same three fields before calling** (`ForwardingTarget` E.164, `primaryLanguage`,
  `voice`) and render the error ON the field. The action buttons sit far below them: web scrolls the
  first offending field into view, mobile also repeats the first message beside the button. An error
  that only renders at the top of the form reads as "the button does nothing".
- **The mobile DTO sends `null`, never `''`, for an unset selection** — an empty string used to reach
  the server as a rejected value and fail the first draft save with a generic toast.
- Regression guards: `SubmitApplicationAsync_IncompleteApplication_ThrowsFieldSpecificError` +
  `SaveApplicationAsync_BlankSelections_*` (Clinqet.API.UnitTests),
  `voiceApplicationValidation.test.jsx` (partner web), `__tests__/voiceApplicationValidation.test.tsx`
  (partner mobile).

### 5.4 Partner UI (`src/components/Profile/voiceAssistant/`, route `/dashboard/profile/ai-assistant`)
`VoiceAssistantPage` renders by status: `NotInvited`→`VoiceAssistantPromo` (enroll promo, §5.5); `onboardingComplete=false`
→`OnboardingChecklist` (deep-links BusinessDetails + BusinessAddress; never Portfolio, category, services, area or hours); `Invited/Draft/Rejected`→
`VoiceApplicationForm` (apply mode, consent gate, Save draft / **Finish setup**; `Rejected` shows a friendly **"One quick fix needed"** banner + reason); `Submitted/NumberPending`→
`StatusTimeline` (titled **"Setting up your number"**); `Active`→`UsagePanel`+`ActivePanel` (assigned
number with copy, Pause toggle, Private toggle, in-place settings editor, Cancel); `OnHold`→banner.
The **view flips to the live "ActivePanel"/call-recording experience purely when `status==="Active"`.**
All strings via **react-intl** under the `voiceAssistant.*` namespace. API client:
`src/services/voiceAssistantServices.js` (all `{NEXT_PUBLIC_BASE_API}/voice-assistant/*`,
envelope `response.data.data`).
- **Settings-page layout (2026-07-09, design-only — ZERO copy changes on web):** the page card is
  `max-w-[1080px]` (was 740, the whitespace root cause); the Active view is `lg:grid-cols-12` —
  `UsagePanel` (span 7) rides `ActivePanel`'s new `usageSlot` prop beside the number card +
  pause/private toggles (span 5); the usage-card header gained "View call follow-ups →" (REUSES
  `billing.plan.viewCallFollowUps`; `trackNav` cta_click widget `va_usage` — web↔mobile parity,
  mobile already had the link). In the form: hours-mode + caller-ID + recording pair at `lg:` with
  options as STACKED rows (a long description can no longer stretch a 3-card row), linear sections cap
  at `lg:max-w-[820px]`, and the number-mode radio pair renders in APPLY mode only (manage keeps just
  the forwarding input — the assigned-number card already answers it). Below `lg` nothing changed.
  Mobile mirrors: number-mode radios apply-only, `scrollContent` maxWidth 640 centered (tablet fix),
  and the screen's `VOICE_ASSISTANT.*` strings were aligned to the WEB wording as the standard
  (en 24 / hi 25 / gu 28 keys — including the Private-mode meaning fix and the accurate
  "Summarize only" framing for NeverAnswer).

### 5.5 The NotInvited promo + enroll-first entry (`VoiceAssistantPromo`)
A `NotInvited` provider sees a full **marketing promo** (`VoiceAssistantPromo`) on both the AI-assistant
settings page (`VoiceAssistantPage`) **and** the Call Follow-ups page — hero, how-it-works, capabilities,
"you're in control" band, example booking/quote/WhatsApp cards. There is **no** "Request access" step: the
CTA is **trial-aware** (Decision B, fully API-driven from the shared billing overview) — "Start free trial"
when an AI trial is offered, else "Get AI Assistant · {price}/mo", else a neutral "Set up your assistant" —
and deep-links to **Billing `#billing-ai`** (`dashboardRoute.billing + '#billing-ai'`), where paying /
starting the trial enrolls (`AiAddOnService.EnsureProvisioningAsync → EnrollAsync`). After enroll, Billing +
Call Follow-ups show a slim **"Finish setup →"** banner (post-enroll, pre-live VA states) linking to the setup
form. No emojis / no AI-looking icons anywhere (neutral `lucide-react` web / Ionicons mobile).
- **Web:** `src/components/Profile/voiceAssistant/VoiceAssistantPromo.jsx` (lucide-react + react-intl);
  `src/components/callFollowUps/CallFollowUpsGate.jsx` gates the route (not-invited ⇒ promo; enrolled-not-live
  ⇒ page + finish-setup banner). Keys under `voiceAssistant.promo.*` / `voiceAssistant.finishSetup.*` in
  **all 4** `public/lang/*.json` (`en-US/hi-IN/gu-IN/ja-JP`). No `RequestVoiceAccess` service / URL.
- **Shared billing overview (kills the N× fetch):** `src/context/BillingOverviewContext.jsx`
  (`useBillingOverview()`, mounted app-wide in `app/layout.js`) is the ONE lazily-loaded, in-flight-deduped
  `GetBillingOverview` read; `Billing.jsx`, `AiAssistantUpsellCard.jsx`, `AiSetupPricing.jsx`,
  `PlanStatusCard.jsx` and the promo all consume it via `ensureLoaded()` — no component fetches the overview
  directly. `Billing.jsx` refreshes it on any billing mutation.
- **Mobile (React Native, store digital-goods compliant):** parallel `VoiceAssistantPromo.tsx` + a Call
  Follow-ups **gate** (finish-setup banner when enrolled-not-live). Prices are DELIBERATELY stripped from the
  mobile billing projection and `/billing` is never deep-linked (no in-app purchasing mechanism), so the
  mobile CTA is the neutral **"Set up your assistant"** → the in-app **Plan & Billing** screen, whose
  not-enrolled action opens the web **/dashboard** (`onOpenWeb`) to enroll. No `requestVoiceAccess` service /
  URL. Keys under `VOICE_ASSISTANT.PROMO.*` + `VOICE_ASSISTANT.FINISH_SETUP_*` in `en/gu/hi` (es partial ⇒ en
  fallback for the promo).
- **Region-derived currency + phone — NEVER hardcode foreign data:** the promo renders ONE region so a
  Canadian provider never sees ₹/+91 (and vice-versa). `VoiceAssistantPromo` computes it from `useCurrency()`
  (the provider's real symbol) + the deployment jurisdiction (web `getClientJurisdiction()` / mobile
  `getActiveRegion()`): India ⇒ ₹/+91, else (CA/US) ⇒ $/+1. A single `REGION_EXAMPLE` object supplies the
  example phones, caller names and amounts; the five amount strings carry a `{price}` (web react-intl) /
  `{{price}}` (mobile i18next) placeholder filled with `${symbol}${amount}`. Real quotes/bookings already
  derive currency server-side from the provider's country.
- **Personalization (cached 3 days, best-effort, never blocks/breaks the promo):** greets with the business
  name (`Tailored for {name}`) and shows the provider's REAL services as a coherent `Already briefed on your
  services: [chips]` row in the hero. **Do NOT inject the real service into the demo cards' "Service ·"
  field** — that produced an incoherent "Book a haircut … Service · General Appliance Repair" mismatch; the
  two demo cards stay self-consistent (haircut booking + cleaning quote with region currency), and the real
  services live only in the briefed chip row. Web: name from `useBusinessProfile()` (in-memory, free) + services from
  `GetSelectedCategoriesWithServicesAPI` cached in `localStorage` (`clinket_va_promo_services`, 3-day TTL).
  Mobile: `business/profile` + `categories/selections/services` fetched once, cached in `AsyncStorage`
  (`clinket_va_promo_personalization`). `collectServices` is defensive about the nested category shape and
  returns `{ names: first 3, total }` so the chip row shows 3 real services + a `+N more` count (scales to
  large catalogs — no silent truncation; services come from the real API, never hardcoded);
  everything is wrapped in try/catch so a failure silently falls back to the generic example.
  **Multi-tenant: both caches are keyed by `businessId`** (`..._{businessId}`) — neither app's logout clears
  this key, so the per-business suffix is what stops a second provider on the same device/browser from seeing
  the first's cached name/services. Mobile reads `businessId` from AsyncStorage; web from
  `useBusinessProfile().profile.businessId`. Never use an unsuffixed global key here.
- **Nav is ALWAYS visible — do NOT re-gate on `NotInvited`:** the AI Assistant entry (web
  `dashboard/profile/layout.jsx` profile menu + mobile `ProfileScreen`) and Call Follow-ups (web
  `Sidebar.jsx` main nav + mobile `ProfileScreen`) previously hid when `status==="NotInvited"`, which made the
  promo unreachable for the exact audience it targets. They now render unconditionally. (The mobile FAB
  quick-action Call Follow-ups stays gated to set-up providers — a quick-action launcher is not a discovery surface.)
- **Admin:** the alert carries `businessId` + `businessName`, is filterable on the Alerts console
  (`AlertsPage` alertTypes), and the admin invites via the Voice Assistant Requests page **Invite Management**
  lookup (`inviteVoiceAssistant(businessId)`), moving the provider `NotInvited → Invited`.
- ‼️ **Invite Management is keyed on the BusinessId, NEVER the owner's UserNumber (fixed 2026-08-20).** Its
  three User #/Email/Phone tabs resolved a PERSON and passed that person's 5-char `userNumber` as the
  businessId, so `GET /admin/voice-assistant/{businessId}` 404'd for every provider — including live ones —
  and the page said "No voice assistant record for this business". It now mounts
  `components/tenancy/BusinessLookupField.jsx` (one box, any handle) over a directly-editable Business ID
  field. **A 404 from `GetStateAsync` means the BUSINESS does not exist**; a business with no assistant
  returns `NotInvited` with a **200**. The alert-card path was never affected — `SendApplicationSubmittedAlertAsync`
  stamps `profile.BusinessId`. Details in the `clinqet-admin-app` skill.

---

## 6. INBOUND CALL — TELNYX (Canada / US): the imperative state machine

`VoiceCallControlFunction` (`HttpTrigger` `POST voice/webhook`, Anonymous). Webhook validated
Ed25519 (`TelnyxWebhookHandler`/parser; signature only — X-Forwarded-For is spoofable). Events →
`VoiceTelephonyEventType` → handlers. `client_state` is base64 JSON `{callId,businessId,phase}`,
echoed on every command to disambiguate legs. Session mutations use a CAS loop (412 retry,
`MaxSessionCasAttempts=3`).

**Phases (`VoiceCallPhase`):** `PartnerAttempt → AiHandoff → Active`, plus `WhisperActive`,
`Voicemail`, `Ended`.

Flow:
1. **`call.initiated`** → point-read `Voiceline` by DNIS (`To`). Not `Active` → answer + speak
   `Voice_LineUnavailable` + hang up (no session). Active → create `VoiceCallSession`
   (`Phase=PartnerAttempt`, `CallPath=Missed`, `CapExceeded`, `Private`) → answer.
2. **`call.answered` (caller leg)** → speak the disclaimer (`Voice_Disclaimer`, or
   `Voice_DisclaimerRecordOnly` when `HoursMode==NeverAnswer`); if `RecordingEnabled` **and the speak
   succeeded**, `record_start` (mp3, dual). **§19 invariant: no spoken disclaimer ⇒ no capture** —
   recording/transcription/voicemail/receptionist are all gated on `DisclaimerPlayedAt != null`.
3. **`call.speak.ended`** (disclaimer done) → connect the provider — ONE model, the parked AMD-gated
   **Bridge**: warm the AI context in the background (`WarmAiContext` — provider context ∥ known caller,
   §6.1), keep the caller **parked** with a looped **ringback** (`VoiceCall:RingbackAudioUrl`), `dial` the
   provider on a **separate** AMD-gated leg **from the owned Clinket DID**, schedule one `DialReassurance`
   line; on a human verdict, **bridge** caller↔provider. **Caller-ID on the provider's phone is the
   per-voiceline `VoiceCallerIdMode`** (snapshotted onto `VoiceCallSession.CallerIdMode` at call.initiated;
   null ⇒ `CallerNumber`; the UI choice was retired 2026-08-24 — every save persists null): `CallerNumber`
   (CA/US default) ⇒ the dial carries **`bridge_intent=true`** and
   Telnyx OVERWRITES `from` with the caller's number (the sanctioned external-transfer caller-ID — no
   Diversion auth; a sync reject retries once as a plain DID dial); `ClinketNumber` ⇒ plain DID dial.
   India (Plivo) never reads it — always the owned DID (DoT). Cap/private plain forwarding uses a
   transfer (auto-bridges, natively carries the caller's CLI).
   (A browser/WebRTC provider-join dials an on-net SIP credential, which accepts the caller's number as `from`.)
4. **`call.machine.detection.ended`**:
   - **human** (or AMD-disabled/not-sure/silence) → stop ringback + **bridge** caller↔provider
     (`Phase=WhisperActive`, `CallPath=Whisperer`); a cap/private transfer is already auto-bridged ⇒ just
     claim the Whisperer phase. NO live STT — the human conversation is transcribed
     post-call from the recording (§11.1).
   - **machine/fax** → hang up the provider leg → **MISS branch**.
5. **MISS branch** (`EnterMissBranchAsync`) → `TryReceptionistHandoffAsync` (§6.1) or `EnterVoicemail`.
6. **`call.hangup`** — the **caller A-leg hangup is authoritative**: enqueue `VoicePostCallMessage`
   (`Kind=CallEnded`, messageId **`vpc-end-{callId}`**) BEFORE marking `Ended` (enqueue throws → 500
   so Telnyx replays; processor dedups). B-leg hangups branch by phase/`client_state` (AiHandoff
   B-leg death → voicemail; PartnerAttempt partner hangup → miss; `WhisperActive` partner hangup →
   **PRE-join** (`ReferredToPartnerAt == null`): **takeover** — hand the still-connected caller to the AI;
   **POST-join** (`ReferredToPartnerAt != null`, the provider deliberately Ended a call they JOINED): **hang
   up the caller leg — the call ENDS for everyone**, never voicemail/AI re-engage (2026-07-09; the caller
   used to hear the voicemail invite after the provider ended a joined call). Same rule on Plivo.
7. **`call.recording.saved`** → enqueue `Kind=RecordingSaved` (messageId **`vpc-rec-{callId}`**).
8. **`call.machine.detection.ended` / `call.answered` / `call.hangup` carrying `client_state` phase
   `provider-join-dial`** → the Telnyx bridge-join verdict (§9.2): routed BEFORE the PartnerAttempt/Active
   phase guards (the AI is live). Human → bridge caller↔provider + drop AI; machine/no-answer/decline →
   hang up the provider leg + publish `ResumeAfterJoinMiss`. (`call.refer.*` now drives only §6 private-mode REFER.)

### 6.1 `TryReceptionistHandoffAsync` — THE AI-TAKEOVER GATE (Telnyx)
Engages the AI only if **all**: `ReceptionistEnabled` · voiceline `Active` · `HoursMode!=NeverAnswer`
· (if `AfterHoursOnly`) the hours verdict is *not* `WithinHours` · disclaimer played ·
`Azure:Realtime:SipUri` configured · not `CapExceeded`/`Private`. Then: mint the per-call token, CAS
`Phase=AiHandoff`/`Jti`/`ModelTier`/`CallPath=Receptionist`, write a `vcallani_` ANI binding
(fallback), **`WarmAiContext`** (pre-loads `FullProviderContextService.GetPublicContextAsync` + the
known-caller identity into `IMemoryCache` — usually already warm: the SAME warm fired at provider-dial
start, so this is the idempotent backstop), then
**`TransferToSipAsync(callControlId, SipUri, caller, header "X-Clinket-Call"=token, …)`**.
Failure → voicemail (`AiHandoff` is voicemail-eligible).

---

## 7. THE "FIRST PROMPT" — `RealtimeSessionPayloadBuilder` + `RealtimeCallWebhookFunction`

When the carrier transfers the leg to the Azure realtime SIP trunk, Azure GPT-Realtime fires
**`realtime.call.incoming`** → `POST /api/voice/realtime` (`RealtimeCallWebhookFunction`, Anonymous,
standard-webhooks signature, idempotent on `webhook-id`).

1. **Resolve the binding** (precedence): (a) `X-Clinket-Call` JWT header (Telnyx) → validate token →
   session; (b) **ANI fallback** via the `vcallani_` doc (mint fresh token, rotate jti). Session must
   be in `AiHandoff`. (India = Plivo does NOT use this SIP-incoming webhook — `PlivoVoiceRelay` binds the
   per-call token itself when the `ai-agent` member's WSS stream connects; see §10.2.)
2. **In parallel** (latency-critical — caller is in SIP limbo): fetch the `Voiceline`,
   `FullProviderContextService.GetPublicContextAsync` (the embedded profile), and the **known caller**
   (`IVoiceCallerIdentityService.ResolveAsync` → name/email from CRM/Identity, fail-soft).
3. **Build the accept payload** = `IRealtimeSessionPayloadBuilder.BuildAcceptPayload(voiceline,
   providerContext, bearerToken, callerPhone, knownCaller, reengagedAfterFailedJoin)` — **this is the
   "first prompt"**. It returns the Azure realtime session config:
   - `type:"realtime"`, `model` = `Azure:Realtime:DeploymentDefault` (`gpt-realtime-2.1-mini`) when
     `VoiceTierIds.IsStandard(voiceline.ModelTier)` else `DeploymentPremium` (`gpt-realtime-2.1`).
   - `audio.input`: transcription sidecar (`gpt-4o-mini-transcribe`) + language hint;
     **`semantic_vad`** turn detection (default; `VadEagerness` low since 2026-08-16 — most patient, the anti-interruption fix; word-aware, ignores
     non-speech noise; `server_vad` with `VadThreshold` 0.75/300/700 is the fallback via `VadType`);
     `noise_reduction` (`far_field`). `audio.output.voice` = the line's voice.
   - `max_output_tokens` (`MaxResponseOutputTokens` 1200).
   - **No `truncation`** (removed 2026-09-25): Azure's 2.x models reject it, and one malformed field fails the
     WHOLE accept / `session.update`. The 2026-08-07 `Truncation*` settings are deleted, not parked.
   - **`reasoning`**: `{effort: ReasoningEffort ("low")}` on EVERY call — both tiers, both transports (Azure 2.x:
     minimal|low|medium|high). Empty ⇒ omitted, which the 1.5 emergency fallback requires.
   - **`tools`: exactly ONE entry** `{ type:"mcp", server_label:"clinket",
     server_url:"{Mcp:PublicUrl}/mcp/{Mcp:SecretPath}", headers:{Authorization:"Bearer {token}"},
     allowed_tools: <16 Scope-C tools + conditional>, require_approval:"never" }`. **The Azure model
     connects directly to the MCP server over HTTP using the per-call token** and calls tools mid-call.
     Conditional additions: `find_services` (Map catalog mode only), `send_service_info`
     (`Voice:Sharing:Enabled`), and `get_provider_context` ONLY when
     `Azure:Realtime:IncludeProviderContextTool=true` — excluded by default since 2026-08-07 (its
     content is already embedded, the prompt forbade calling it, and its schema cost ~200 prompt
     tokens per call for a tool that never fires).
   - **`instructions`** = a large English system prompt (`BuildInstructions`) that **embeds the full
     provider profile** (`BuildCompactContext`: services with spoken-ready `priceText`, weekly
     availability, active offers, service areas, addresses, rating, currency — bounded by
     `InstructionsMaxServices`/`…Offers`/`…ServiceAreas`/`…ServiceDescriptionChars`). It encodes the
     receptionist persona, the owner's **standing instructions** (`OperatingInstructions` — the ABSOLUTE, HIGHEST-AUTHORITY source of truth: obey literally, and crucially **apply them to the model's OWN actions** — before any booking/quote/price/commitment, check it against the rules + working hours and REFUSE violations with exact range logic (3 PM ∈ 1–4 PM), and proactively surface owner-stated offers/facts/services even if unasked; caller-proof; the ONLY carve-out is verification/privacy; the actual rule text is **restated verbatim at the prompt end** for recency. Free-text covers ANY scenario ⇒ **prompt-enforced, deliberately NO server-side gate** (a code gate could only cover structured booking constraints). The live-test failure was the block being framed only at resisting callers, not at the model's own actions), a single opening greeting in the line's primary language ("the owner is
     unavailable… how can I help"), a strict **reply-language lock**, caller-ID usage, known-caller
     soft-confirm, booking rules (one booking, update via `updateBookingNumber`; truth-state discipline (2026-07-07) — a booking
     exists ONLY once request_booking returns a booking number, never claim/imply it earlier, never say "I'm
     working on it" twice in a row, and relay an out-of-hours tool result IMMEDIATELY; hours are checked from the
     embedded profile BEFORE verbally accepting any named time; a booking/quote REQUIRES a name (refusal ⇒ offer a
     message/callback, never a fake booking); the post-booking WhatsApp copy is sent NOW via send_my_details as the
     pending-confirmation record — never a promised future/"once the owner confirms" send), the **verification
     rules** (booking-code vs action-OTP, `cancellationByPhone` hints), quote/send rules, offer-fit
     rules, a **local "now" anchor** (`BuildLocalNowAnchor` from `Voiceline.TimeZoneId`) so the model
     can resolve "tomorrow"/"at 9", working-hours self-judgement, "mask the wait" (speak one action
     line *before* each tool call), and **`end_call` discipline** (say the farewell AND call
     `end_call` in the same turn; zombie-line rule — if the line is somehow still open after end_call, NEVER
     re-greet/re-introduce: same call, brief acknowledgement, one goodbye + end_call again). The `Scope-C` allowed-tools list is `ScopeCAllowedTools` in the
     builder. The "do NOT call `get_provider_context`" prompt lines are emitted ONLY when the tool is
     actually in `allowed_tools` (`IncludeProviderContextTool=true`) — telling the model not to call a
     tool it cannot see is pure token spend.
4. **`RealtimeCallService.AcceptAsync`** → `POST {Azure:Realtime:Endpoint}/openai/v1/realtime/calls/{id}/accept`
   (header `api-key`). On accept: CAS `Phase=Active` + stamp `AzureCallId` + known-caller fields.
5. **`McpSessionSignalClient.SignalSessionStartAsync`** → `POST {Mcp:PublicUrl}/internal/{secret}/session-start`
   with `Bearer {token}` + `{azureCallId}` — wakes the MCP `VoiceSessionMonitor`. **Bounded-retried**
   (`Mcp:SessionStartSignalAttempts`=3 / `SessionStartSignalRetryDelayMs`=750ms; retries 5xx/408/429/network only —
   401/403/404 fail fast): a lost signal runs the call UNMONITORED (no greeting nudge ⇒ dead air until the caller
   speaks, no live transcript, no watchdogs) — the exact "AI never greeted + summary said missed call" live failure.
6. **`DispatchLiveCallStartedAsync`** → `NotificationType.VoiceLiveCallStarted` to the provider
   (push + in-app only, deep-links to Call Follow-ups). Best-effort.

---

## 8. THE LIVE MONITOR — `clinqetmcp Monitor/VoiceSessionMonitor.cs`

A hosted service holding **one long-lived text-event WebSocket per call** to Azure realtime
(`wss://{endpoint}/openai/v1/realtime?call_id={azureCallId}`, header `api-key`). Started by the
`/internal/{secret}/session-start` endpoint (`StartSessionAsync`), which validates the binding doc
(phase `AiHandoff`/`Active`, `AzureCallId` matches), **stamps `MonitorInstanceId`** on the session,
and writes a per-business `VoiceBusinessLiveCall` marker (TTL `VoiceCall:LiveCallRegistryTtlHours`).

**Responsibilities:**
- **Greeting nudge** (sends `response.create` so the model speaks first — no dead air). **Connect-before-200
  (2026-07-07):** `StartSessionAsync` opens the Azure socket + sends the nudge BEFORE returning success; a socket
  that can't open (bad `Azure:Realtime` endpoint/api-key) FAILS the session-start request so the function host's
  bounded retries protect the greeting — a session can no longer die asynchronously after a 200 (the "AI silent
  until the caller speaks" live failure).
- **Transcript capture**: on `…input_audio_transcription.completed` (caller, track `inbound`) and
  `response.*audio_transcript.done` (model, track `outbound`) it appends a `VoiceTranscriptSegment`
  to `VoiceTranscript` AND fires **live fan-out** via `IVoiceLiveEventClient.BroadcastTranscriptAsync`.
- **Idle/UX watchdogs** (all `Azure:Realtime` settings-driven): idle re-engage ladder
  (`IdleRepromptSeconds`, `MaxIdleReprompts`) → spoken goodbye → hang up; slow-reply reassurance
  (`ToolCallReassureSeconds`); farewell backstop (`EndCallFarewellGraceSeconds` + `FarewellPhrases`);
  opening-greeting double-greet guard (`OpeningGreetingGuardSeconds`).
- **`end_call`** (`RequestHangup`) → graceful hangup after the farewell drains (`EndCallAudioDrainMs`,
  `EndCallMaxWaitSeconds`). Max-duration ceiling = `MaxCallDurationSeconds`. **Hangup is never trusted blindly
  (2026-07-07):** `RealtimeCallService.HangupAsync` returns FALSE on an API rejection (no throw) — the end_call
  watchdog + the max-duration ceiling treat false/throw as failure and enqueue a **carrier-side hangup**
  (`VoicePostCallKind.HangupCall`, id `vpc-hangup-{callId}`; `ProcessHangupCallAsync` is carrier-AGNOSTIC — Telnyx
  hangs the caller leg too). The `end_call` MCP tool does the same when no monitor/relay owns the socket and the
  direct Azure hangup is rejected (scheduled +`EndCallMaxWaitSeconds` so the farewell drains), and surfaces an
  honest "tell the caller they can simply hang up" error if even the enqueue fails — the model is NEVER told
  "ending" on a lie (the zombie-call bug: goodbye loops while the line stays open and keeps billing).
- **MCP tool-call latency tracing** (`mcp_list_tools.*`, `response.mcp_call.*`).
- **Post-call**: on a clean end, `BroadcastCallEndedAsync`, delete the live marker, and enqueue a
  *scheduled* belt-and-suspenders `Kind=CallEnded` (`MonitorPostCallDelaySeconds`, dedup
  `vpc-end-{callId}`) **only if** the Telnyx A-leg hangup didn't already own it (skips when
  `Phase==Ended` or `ReferredToPartnerAt!=null`).
- Concurrency alert when active sessions approach `MaxConcurrentCalls * QuotaAlertThresholdPercent`.

### 8.1 Live streaming to the provider (SignalR) — the gating detail
`VoiceLiveEventClient` (MCP) POSTs to the **API** `POST /api/v1/internal/voice/live-event`
(`X-Internal-Api-Key`) → `InternalVoiceTriggerController` → `ISignalRNotificationService` →
SignalR hub **`/hubs/notifications`**:
- `Kind="transcript"` → `SendVoiceLiveTranscriptAsync` → client event **`ReceiveVoiceLiveTranscript`**
  (`{callId, t, track, text}`, ephemeral — never persisted, never gated by `EnabledNotificationTypes`).
- `Kind="ended"` → **`ReceiveVoiceLiveCallEnded`** (`{callId}`).

**The provider only receives the live stream while ON the Call Follow-ups page** (or after tapping
the `VoiceLiveCallStarted` push, which navigates there): the page invokes `WatchVoiceLive` on mount
(and on every SignalR reconnect — groups don't auto-rejoin) and `UnwatchVoiceLive` on unmount. The
initial snapshot (caller identity, masked phone, transcript-so-far) comes from the REST
`GET /voice-assistant/active-calls` (`VoiceLiveCallClient.GetActiveCallsAsync` → MCP
`/internal/{secret}/active-calls?businessId=` — aggregates markers **across all MCP instances**,
masks caller phone, drops stale-marker "ghost" calls).

---

## 9. PROVIDER JOIN / BARGE-IN / TRANSFER (the "conference" / takeover)

The provider taps **Join** on a live card → two paths, same backend endpoint with a `method` discriminator.

### 9.1 API → MCP routing
`POST /voice-assistant/calls/{callId}/join` (`{method:"phone"|"browser"}`) →
`VoiceLiveCallClient.JoinCallAsync` → `POST {Mcp}/internal/{secret}/provider-join`
(`{businessId, callId, method, carrier}`, `X-Internal-Api-Key`). The MCP endpoint (`Program.cs`):
- Verifies the call belongs to the business (`VoiceCallSession`), the method (`browser` requires a
  stored `ProviderJoinSipTarget`), and finds the **owning instance** (`session.MonitorInstanceId`).
- If **this** instance owns the socket → run `monitor.InjectProviderJoinAnnouncementAsync` in-process
  (synchronous 200).
- Else → publish a **`VoiceMonitorCommand{Kind=ProviderJoin, callId, businessId, method, referTarget,
  carrier}`** to the Service Bus **topic** `VoiceMonitorCommandsTopicName` with `SessionId =
  ownerInstanceId` → the owner's `VoiceMonitorCommandListener` (a held-open session processor keyed to
  its own instance id) receives it and runs the join (202 Accepted). This is the **cross-instance
  backplane** (the live socket lives in exactly one process).

### 9.2 `InjectProviderJoinAnnouncementAsync` — announce, then carrier-branch
1. Resolve the target: browser → `session.ProviderJoinSipTarget` (the minted SIP address); phone →
   `tel:{voiceline.ForwardTo}` (validation; the function re-derives the dial target from the voiceline).
2. **Announce** to the caller ("{business} would like to join… please hold") via a directed
   `response.create`. **Telnyx mutes the AI (`turn_detection: null`) BEFORE this announce** so it is silent
   the instant the announce ends — without it, the caller's reply during the announce playout makes the
   un-muted AI talk over the handoff (live-test fix); the announce itself is an explicit `response.create`
   that still plays. Retry if undelivered (`ProviderJoinAnnounceRetries`), wait out the estimated
   **playout** (`ProviderJoinAnnounceMsPerWord`/`Min`/`Max`). Re-assert once on a barge-in
   (`ProviderJoinReAssertOnBargeIn` — relevant when the AI is not already VAD-muted; Telnyx VAD is already off). Never hand off on an
   undelivered announcement; re-enable VAD on any abort that leaves the caller live. One join at a time
   (`TryBeginProviderJoin`).
3. **Carrier branch** (`VoiceMonitorCommand.Carrier`):
   - **Telnyx = bridge+AMD anchor, NOT REFER (2026 re-architecture).** The caller STAYS bridged to the
     live AI (context preserved, session warm). The AI is muted in step 2 (`turn_detection: null`, BEFORE
     the announce) — VAD OFF ⇒ the model **cannot** auto-respond, so silence is bulletproof **by
     construction** (a literal `null`, never dropped by a WhenWritingNull serializer). The monitor then
     enqueues `VoicePostCallKind.StartProviderJoinDial` (`vpc-join-dial-{callId}`) to hand the Telnyx
     call-control to the **function host**. It does NOT REFER, does NOT hang up the Azure leg, and does NOT
     stamp `ReferredToPartnerAt` (the function stamps it on a human answer).
     `VoicePostCallProcessorFunction.ProcessStartProviderJoinDialAsync` (Telnyx-gated, **atomic claim**
     on `ProviderJoinLegCallControlId` so a redelivery/double-tap can't double-dial) dials the provider
     on a SEPARATE leg (`DialAsync link_to=callerLeg`, AMD `detect` for phone / `disabled` for browser,
     timeout `ProviderJoinRingTimeoutSeconds`, `client_state` phase `provider-join-dial`; **phone `from`=the CALLER's
     number + a Diversion header (owned DID) — the OPT-IN caller-ID passthrough (same gate, default OFF) with automatic
     DID fallback on a rejected dial (§6); browser `from`=caller's number** since the SIP credential is on-net). **Ring filler
     (live-test fix): NO carrier ringback** — the caller is bridged to the muted AI, so a playback on that
     leg doesn't reach the caller (and can leak to Azure); instead the **monitor's idle watchdog has the AI
     speak a directed "still connecting you, please hold"** through the announce-delivery path
     (`DeliverAnnouncementTurnAsync`) so it WAITS OUT the line's estimated **playout** before the gap clock
     starts — generation runs several seconds ahead of audio, so `response.done` is NOT when the caller stops
     hearing it. The next filler comes after `ProviderJoinReassureSeconds` of **actual silence measured from
     playout-end**, so the lines never run back-to-back (gating on generation-end alone produced
     near-continuous speech — a real live-test bug). A resume landing mid-filler waits the audio out
     (`SpeakingRemainingMs`) and cancels a still-generating one, so it never talks over the filler. Explicit
     `response.create` ⇒ plays with VAD off, never a reply to the caller — the ring is never dead air. **Language pin (live-test fix):** every spoken join turn (announce, re-assert, ring filler, resume nudge) pins the call's primary ISO language via `LanguageLock(MonitorSession.PrimaryLanguage)` — a `response.create`'s instructions OVERRIDE the session prompt's language lock for that turn, and a filler during the muted ring (no fresh caller audio) drifted to Spanish; language comes from `voiceline.LanguageProfile.Primary`, cached on the session. The AMD/answer verdict lands in `VoiceCallControlFunction` and **MUST be
     routed BEFORE the existing PartnerAttempt/AiHandoff/Active phase guards** (else it's silently
     dropped — the AI is live during a join): **human** (AMD human / browser `call.answered`) →
     CAS-commit `ReferredToPartnerAt`+`Phase=WhisperActive` **before** `bridge(caller,provider,
     park='self')` + `RealtimeCallService.HangupAsync` (drop the AI). `ReferredToPartnerAt` makes the A-leg-hangup
     `CallEnded` set `AppendRecordingToTranscript` ⇒ the human-join portion is transcribed post-call from the
     recording, time-windowed from the join (§11.1) — NO live STT, NO `StartHandoffTranscription`. A failed bridge falls
     back to resume-AI (never strands). **miss** (machine / no-answer / decline / dial fail) → hang up
     the provider leg + bump `ProviderJoinReengageCount` (bounded by `MaxProviderJoinReengagements`,
     enforced at `/provider-join`) + publish `VoiceMonitorCommand{Kind=ResumeAfterJoinMiss}` → the
     monitor's `ResumeAfterProviderJoinMissAsync` does `input_audio_buffer.clear` → re-enable `server_vad`
     → **injects a persistent SYSTEM `conversation.item.create`** recording the failed attempt (so the AI
     OWNS it for the rest of the call and never later denies calling the owner — live-test fix; system-role
     items persist + take precedence) → **active** resume nudge ("I tried to reach {business} but they
     couldn't pick up") — **same session, full context, no re-feed** (the context item is ~2 sentences,
     NOT the first prompt). A monitor ring backstop (`ProviderJoinRingTimeoutSeconds` + margin,
     single-winner with the signal) self-resumes if the verdict signal is ever lost. The caller anchor leg
     never moves ⇒ its recording captures the provider conversation and its A-leg hangup owns the
     `CallEnded` summary.
   - **India (Plivo)** → reproduces the same announce→silence→resume provider-join behind the
     `VoiceCarrier` seam. The relay announces then withholds caller frames (bulletproof silence);
     `PlivoVoiceCallControlFunction` dials the provider into the MPC with AMD, carrying our own `?join=1`
     marker — **human** (AMD human) → `AddParticipantByCallUuid` + **`DropAiForBridge`** (the relay closes
     its Azure session ⇒ the `ai-agent` member leaves, caller + provider stay bridged) / **miss** (AMD
     machine **or** a never-answered `?join=1` ring-out hangup, matched by the marker — §10.1) →
     `ResumeAfterJoinMiss` (same session, full context, no re-feed). AI media rides the WSS relay, not SIP.

> **The Azure-realtime far-end REFER is gone for the join** — `IRealtimeCallService.ReferAsync` and the
> join's REFER-reclaim were removed (the bridge model needs none of them). The `VoiceTelephonyEventType.
> ReferCompleted/ReferFailed` events + `call.refer.*` parser mappings + `HandleReferFailed/CompletedAsync`
> now serve **only the §6 private-mode carrier REFER** (a Telnyx Call-Control `refer`, not the Azure one).

### 9.3 Browser join (Telnyx only) — WebRTC (`useBrowserCall.js`)
SDK **`@telnyx/webrtc`** (`TelnyxRTC`). Sequence: hold the mic (`getUserMedia`) → **mint** a per-call
WebRTC credential `POST /voice-assistant/calls/{callId}/webrtc-credential` (API
`MintWebRtcCredential` → `IVoiceWebRtcCredentialService` (`TelnyxVoiceWebRtcCredentialService`) →
returns a `login_token`; the API **stamps `ProviderJoinSipTarget`/`…WebRtcCredentialId`** on the
session server-side so a join can only connect the caller to a credential we own) → register the
softphone → `JoinCall(callId,"browser")`. In the bridge model the function **dials the minted WebRTC
sip target** (no AMD) → the softphone still receives an **inbound INVITE** and answers exactly as before
(so `useBrowserCall.js` needs **no change**) → on `call.answered` the function bridges caller↔WebRTC +
drops the AI → in-call mute/end via `BrowserCallBar`. **Release** the credential `POST
…/webrtc-credential/release` on end / `pagehide`; server backstop is the credential `expires_at`. Browser
join is wired **per carrier**: Telnyx uses `@telnyx/webrtc`; **India = Plivo** uses the `plivo-browser-sdk`
branch in `useBrowserCall.js` (`PlivoVoiceWebRtcCredentialService` mints the Plivo Endpoint cred). The
Plivo app-join is code-complete + tsc-verified but **Plivo-account-gated** — the endpoint SIP-identity DTO
projection lands once an account exists (§10.5 carry-forward (c)).
- **Mic-failure root cause + fix (audited + browser-verified 2026-06-30):** the partner `next.config.mjs` had `Permissions-Policy: microphone=()` app-wide with a single-route exception for `/dashboard/call-follow-ups`, which **silently broke EVERY first-party mic feature** — live-call browser-join AND AI voice input (`common/FloatingAIButtons.jsx`) AND voice dictation (`common/floatingTextarea.jsx`, used across onboarding/booking/invoice/service/profile forms). With permission genuinely granted, `getUserMedia` throws `NotAllowedError "Permission denied"` while `navigator.permissions.query`=`granted` and `document.featurePolicy.allowsFeature("microphone")`=`false` (all proven in headless Chromium vs the real build). **FIX: default `microphone=(self)` app-wide** (first-party only; third-party iframes still blocked; also the browser default; `camera=()` kept) + removed the redundant per-route override — re-proven post-`npm run build` on the join, AI-voice (`/dashboard`) and dictation (`/onboarding`) routes (all `getUserMedia` ok). Full prod header path audited clean: Azure Front Door (`networking.json`) does only ModifyRequestHeader + X-Robots-Tag + cache (NO Permissions-Policy); IIS `web.config` adds only Cache-Control; `src/middleware.js` is auth-only. Safety net: `useBrowserCall.acquireMicrophone` classifies a policy block via `document.featurePolicy.allowsFeature("microphone")===false` ⇒ reason `mic-policy` (reload/ring-phone message) so a future regression self-explains + phone-join always works. ‼️ The partner web app must be REDEPLOYED for the next.config fix to reach users. Do NOT revert the default to `microphone=()`, do NOT re-add a single-route override or `permissions.query` gating.

### 9.4 Phone join — `JoinCall(callId,"phone")` → the function dials `voiceline.ForwardTo` (AMD on)
on a separate leg (from the owned DID; `bridge_intent` when the line's `CallerIdMode` is `CallerNumber`, so
the provider's phone shows the caller) and, on a human verdict, bridges the caller to it (the AI is
dropped). No mic, no credential; the conversation continues on the provider's real phone.

---

## 10. INBOUND CALL — INDIA (PLIVO) — GA

India runs on **Plivo**, **shipped (GA)** behind the same `VoiceCarrier` seam as Telnyx. The carrier
DECISION + architecture are LOCKED and the code is complete: the legacy India carrier (Exotel) is fully
removed, the seam + `PlivoSettings` are first-class, the five Plivo carrier-adapter services are built,
the India inbound **state machine** (`PlivoVoiceCallControlFunction`) + the AI-media **WSS relay**
(`PlivoVoiceRelay`) + the live **provider-join** are built, and the web + mobile join SDK branches are in
place. The Plivo state machine + relay are **SEPARATE carrier-gated components** (NOT branches inside the
Telnyx `VoiceCallControlFunction`/`VoiceSessionMonitor`), so the Telnyx (CA/US) path stays
byte-for-byte untouched; every shared-file change is carrier-gated. India is **pre-prod / account-gated
for live traffic** — the *code* is GA; three external/account gates remain before real India calls
(§10.5). Canonical design + full phase history live in `voice-handoff/` (the migration ran Phases 1–10).

**Locked design (verbatim — do not change):** KEEP the Plivo **MPC + `ai-agent` member** design (Plivo's
simple `<Stream>` cannot do the live human-join). AI-stream format default = **`audio/x-mulaw;rate=8000`**
(μ-law passthrough — Plivo-confirmed, `PlivoSettings.AiMediaFormat=pcmu`, half the streaming bandwidth);
`l16` (documented `audio/x-l16;rate=8000` ⇄ PCM16-24k resample) is the flagged fallback. India
media-anchoring = **Azure-India-region relay** (the IN MCP host runs in Central India) + **legal sign-off**
(§10.5). India OTP/SMS stays decoupled (2Factor / WhatsApp / email — NEVER Plivo SMS).

### 10.1 The India state machine — `PlivoVoiceCallControlFunction` (carrier-gated answer_url/callbacks)
A SEPARATE function (not a branch in the Telnyx `VoiceCallControlFunction`) exposing **7 routes**
`voice/plivo/{answer|provider-answer|amd|voicemail|hangup|recording|status}`. **X-Plivo-Signature-V3
fail-closed** on every callback. It reproduces the Telnyx behavior on Plivo's **MultiPartyCall (MPC)**
primitive:
- **`answer`** → point-read the `Voiceline` by DNIS → not `Active` → `<Speak>` `Voice_LineUnavailable` +
  `<Hangup>` (no session); Active → create the SAME `VoiceCallSession` → `<Speak>` the localized disclaimer
  FIRST (§19 holds — Speak is element #1 of the applet; record-only variant for `NeverAnswer`) → caller
  joins as the **anchor** `<MultiPartyCall role="Customer">` (stereo `record="true"`) → `MakeProviderCall`
  + **AMD** (`from` = the owned DID `session.Dnis`).
- **`amd`** (report-then-react) → **human** → `AddParticipantByCallUuid(Agent)` whisper (CallPath
  Whisperer) / **machine / no-answer** → MISS branch → `TryReceptionistHandoff` gate (carrier-agnostic;
  all `HoursMode` conditions, disclaimer, not Cap/Private) → on engage
  `AddAiAgentMember(StreamWssUrl?ct={token}&callId={callId})`.
- **`voicemail`** → `RedirectCall` to a `<Speak>` + `<Record>` applet (post-call STT).
- **Cap/Private** → plain `<Dial>` forward (no disclaimer/record/AI/summary), `from` = owned DID.
- **`hangup`** — the **caller A-leg is authoritative**: enqueue `VoicePostCallMessage` (`Kind=CallEnded`,
  messageId **`vpc-end-{callId}`**); `recording` callback → `vpc-rec-{callId}`. Deterministic ids match
  the Telnyx contract; the carrier-agnostic `VoicePostCallProcessorFunction` consumes them unchanged.
- **Live provider-join** (`?join=1` marker): the join dial leg carries our own `?join=1` callback marker.
  **No-answer/declined join resume (Phase-9 fix):** a never-answered leg never fires `provider-answer`
  (so the real provider CallUUID is never stamped), so `HandleHangupAsync` matches the join leg by the
  **`?join=1` marker** too (deterministic, independent of any Plivo verdict semantics) →
  `EnterPlivoJoinMissAsync` resumes the SAME AI session (single-winner CAS, idempotent with the AMD
  verdict) instead of stranding the caller in AI-silence (the relay has no ring-timeout backstop, unlike
  the Telnyx monitor — hence the marker match).

### 10.2 The AI-media relay — `clinqetmcp Monitor/PlivoVoiceRelay.cs`
A hosted WS endpoint **`/voice/plivo/stream`** (in the IN MCP, Central India) that bridges the Plivo
`ai-agent` member stream ↔ **Azure GPT-Realtime**. **Per-call-token fail-closed** — it binds the `ct`
query token + cross-checks the binding doc exactly like the Telnyx middleware (missing/invalid ⇒ socket
closed, `ActiveSessionCount==0`, Azure never opened; not under the V3 secret path — Plivo can't send it).
It opens Azure via the **reused** `IRealtimeSessionPayloadBuilder.BuildWebSocketSessionPayload` (the SAME
instructions as the Telnyx SIP accept — embedded provider profile + the MCP `server_url` + Bearer +
Scope-C tools), stamps `AzureCallId`/`Phase=Active`/`MonitorInstanceId` + the live-call marker, and fans
the transcript out over the **SAME** `IVoiceLiveEventClient` → `/internal/voice/live-event` → SignalR path
as Telnyx. Features:
- **Bulletproof silence** — during the provider-join ring the relay **withholds caller frames** by
  construction ⇒ **zero Azure tokens** during the ring (matches the Telnyx VAD-off guarantee).
- **`DropAiForBridge`** — closes the Azure session ⇒ the `ai-agent` member leaves the MPC; caller +
  provider stay bridged (the Plivo equivalent of Telnyx's "drop the AI on a human join", NO new field).
- Barge-in (`speech_started` → clear audio); **L16-8k default ⇄ PCM16-24k resample** (`G711MuLawCodec`
  is the μ-law-opt-in / transcode path); `PlivoRelaySession : IAsyncDisposable` — both sockets + lock +
  CTS torn down on every exit path.

### 10.3 The Plivo carrier-adapter services (registered behind the `Voice:Carrier==Plivo` DI branch)
Wired via the host helpers `AddFunctionsVoiceTelephonySeam` (`clinqetfuncations`) +
`AddApiVoiceProvisioningSeam` (`clinqetapi`) — the Telnyx branch is byte-for-byte unchanged.
- **`PlivoCallControlService`** (`clinqetinfrastructure/Services/Communication/`) — `IVoiceTelephonyProvider`
  for the REST verbs Plivo drives mid-call (Speak / stereo Record / Play ringback / Hangup /
  GetRecordingDownloadUrl); the SIP-only Telnyx verbs no-op with a warning (never invoked on IN). It ALSO
  implements **`IPlivoMultipartyCallService`** (Make-Call+AMD, add-participant-by-`call_uuid`, add/remove
  `ai-agent` member, mute/hold, MPC stereo record). *(Remove/Update-participant + Start/Stop-MPC-record
  are implemented + unit-tested but reserved for the §C live-verify POC — see §10.5; NOT dead code.)*
- **`PlivoWebhookValidator`** — `IVoiceWebhookValidator`; **X-Plivo-Signature-V3** (HMAC-SHA256 over
  URL+sorted-params+nonce, multi-token CSV rotation, `FixedTimeEquals`, nonce-replay reject), fail-closed,
  optional `CidrMatcher` IP allowlist.
- **`PlivoWebhookParser`** (+ `PlivoWebhookForm`) — lifts the **form-urlencoded** Plivo callback (incl.
  `RecordingUUID`/`RecordingURL`, 90-day retention) → `VoiceTelephonyEvent`.
- **`PlivoNumberService`** — `IVoiceNumberProvider`; search / buy (+app assign) / confirm / release India
  DIDs; `RoutingConnectionId` = `PlivoSettings.ApplicationId`.
- **`PlivoVoiceWebRtcCredentialService`** — `IVoiceWebRtcCredentialService`; mints/revokes a per-call
  Plivo **Endpoint** credential for the browser / app join.

### 10.4 Web + mobile provider-join (carrier-selected, carrier never rendered)
- **Web** (`clinqetwebpartnerapp useBrowserCall.js`): the `carrier === "plivo"` branch uses
  **`plivo-browser-sdk`** (`loginWithAccessToken(jwt)` → `onIncomingCall` → `answer()`); the Telnyx branch
  (`@telnyx/webrtc`) is unchanged. Carrier comes from the live-call DTO.
- **Mobile** (`clinqetmobilepartnerapp`, Variant A): ONE app, ONE shared `react-native-webrtc@124` behind
  a `LiveCallTransport` seam — **Telnyx** via `@telnyx/react-native-voice-sdk` + **Plivo** via `sip.js`.
  The join CTA lives on the dedicated Live Call screen; the carrier is never rendered
  (`ActiveCall.carrier` is data-model only).

### 10.5 Open items / account-gated (carry-forwards — code is GA; these gate real India TRAFFIC)
These are **pre-existing / external gates, NOT code defects** — the Phase-9 exhaustive audit passed with
zero outstanding findings. They MUST be cleared before live India calls.

**2026-06-29 — Plivo Q&A answers applied (carrier-gated; Telnyx byte-for-byte untouched):**
- **AI-media format default flipped `l16` → `pcmu`.** Plivo CONFIRMED the MPC ai-agent
  `ai_agent_stream_content_type=audio/x-mulaw;rate=8000` is supported, so μ-law 8 kHz passthrough (zero
  transcode, half the streaming bandwidth) is now the default in all three appsettings + the
  `PlivoSettings.AiMediaFormat` class default; the relay then declares `audio/pcmu` to Azure end-to-end. `l16`
  (documented L16-8k ⇄ PCM16-24k resample) is kept as the flagged fallback. **POC-verify:** confirm Azure
  GPT-Realtime ingests `audio/pcmu` INPUT cleanly; if it ever drifts, set `AiMediaFormat=l16`.
- **(c) Plivo app-join SIP-identity DTO — DONE in code.** `WebRtcCredentialDto` already projects
  `SipUser`/`SipTarget`/`SignalingServer` (controller + mint), and `PlivoEndpointSettings.SignalingUrl` is now
  the Plivo-confirmed `wss://phone.plivo.com` (SIP domain `phone.plivo.com`). The ONLY remaining gate is the
  Plivo account creds (`AuthId`/`AuthToken`) so `IsSupported` is true and a credential is actually minted.
- **AMD verdict field — CONFIRMED, no code change.** Plivo's machine-detection callback (sync + async) sends
  the `Machine` parameter (`true` on machine). `PlivoWebhookParser` already lifts exactly `Machine` →
  `AmdResult`, and `IsMachineVerdict` treats empty/absent as human (bridge — never hang up on a real caller).
  This is no longer an open §C unknown.
- **IP-allowlist deploy plumbing added** for (b) + the webhook list — see below.

Remaining gates:
- **(a) Pre-prod KV migration (CLAUDE.md §19).** The committed `Azure:Realtime:ApiKey` (in `clinqetmcp`
  **and** `clinqetfuncations` appsettings) + the plaintext `deploy.ps1` Plivo creds must migrate to
  per-stamp **Key Vault** refs, and every committed real secret emptied. De-scoped for the sandbox per the
  user ("it's sandbox, commit real values") — a pre-prod MUST-DO.
- **(b) IN-MCP Plivo streaming-IP allowlist (deploy-time).** Plumbed: `deploy.ps1 -PlivoStreamingAllowedIpRanges`
  (CSV, IN-gated) appends Allow rules to the IN MCP `ipSecurityRestrictions` so Plivo's ai-agent `<Stream>`
  reaches `/voice/plivo/stream` (the app default-denies). Supply Plivo's PUBLISHED media/streaming IP list at
  deploy time (runbook §3) — values not hardcoded (no account yet; never guess IPs).
- **Webhook IP allowlist (defense-in-depth, Plivo Q6).** Plumbed: `deploy.ps1 -PlivoWebhookAllowedIpRanges`
  (CSV, IN-gated, Functions host only) → `Plivo:WebhookAllowedIpRanges` (the `CidrMatcher` allowlist). A
  SEPARATE list from the streaming IPs. X-Plivo-Signature-V3 already fail-closes; this is belt-and-suspenders.
  Supply Plivo's published webhook IPs at deploy time.
- **Legal sign-off (non-POC human gate).** India media-anchoring via the Azure-India relay + streaming the
  caller's audio to Azure needs a regulatory sign-off — a non-POC external gate, not code.
- **Pricing (Plivo Q12, still open).** Inbound/outbound/browser-SIP per-min + number rental unconfirmed;
  confirm AMD/conference/recording are free in India. Follow up with Plivo.
- **Plivo joined-call human-portion append (parity edge — DONE 2026-06-29).** A Plivo call where the provider
  JOINS a live AI call now summarizes the human portion too (full Telnyx parity), no longer AI-portion-only.
  The post-call append machinery was already carrier-agnostic (`VoicePostCallProcessorFunction` reads
  `session.ReferredToPartnerAt` + `session.RecordingStartedAt` ⇒ time-windowed `skipBeforeOffsetMs`); three
  edits closed the gap, all mirroring Telnyx exactly: (1) `PlivoWebhookParser` lifts the recording-start field
  into `evt.RecordingStartedAt` — the MPC recording callback's `RecordingStartTime` (`yyyy-MM-dd HH:mm:ss±hh:mm`,
  normalised to UTC) **and** the `<Record>` callback's `RecordingStartMs` (epoch ms), both VERIFIED against
  Plivo's official docs; (2) `HandleRecordingAsync` conditionally stamps `s.RecordingStartedAt`; (3)
  `EnqueueCallEndedAsync` sets `AppendRecordingToTranscript = joined && SummarizeFullCallAfterHandoff` and
  `TranscribeFromRecording = !joined && (Whisperer|Voicemail)`. Safe fallbacks unchanged: recording off ⇒ no
  transcript + the note; missing start anchor ⇒ append skipped (AI-portion-only), never a whole-recording
  re-transcribe. Covered by 2 Functions-unit + 3 API-parser tests.
- **Reserved-for-POC adapter surface (NOT dead code):** the `IPlivoMultipartyCallService`
  Remove/Update-participant + Start/Stop-MPC-record methods + several §C wire shapes (V3 base-string byte
  order, MPC `name_` addressing, single-member-removal 4020, the `<Wait>`→MPC move) are isolated + flagged
  for the first live POC — do not delete pre-POC.

> **Both regions share the SAME AI brain** (Azure GPT-Realtime + the MCP server + the
> `VoiceSessionMonitor`/relay live transcript + SignalR streaming + the post-call pipeline). Only the
> telephony orchestration differs. India OTP/SMS stays decoupled (2Factor / WhatsApp / email) — no Plivo SMS.

---

## 11. POST-CALL — `VoicePostCallProcessorFunction` (the side-effects engine)

A single Service-Bus-triggered function on **`ServiceBusSettings:VoicePostCallQueueName`**
(`voice-postcall`). `VoicePostCallMessage.Kind` (`VoicePostCallKind`): `CallEnded, RecordingSaved,
ActionSideEffects, SendDocument, DialReassurance, EndWatchdog, StartHandoffTranscription`.

- **`CallEnded`**: order the transcript by time → **recording-based transcription** (§11.1) — whole recording
  for whisper/voicemail (`TranscribeFromRecording`), or the time-windowed human-join portion appended after the
  AI vtrans (`AppendRecordingToTranscript`); recording read from the session, bounded-rescheduled until it lands;
  recording-off ⇒ no transcript + `TranscriptUnavailableRecordingOff`; a **Receptionist call whose vtrans is EMPTY** (monitor never attached) **with recording on ⇒ whole-recording fallback transcription** (nothing to duplicate; the join append-window is skipped in this mode) so the provider still gets a REAL summary instead of the canned missed-call line → optional **translate to English** (`StoreEnglishTranscript`) → summarize (Azure OpenAI,
  `SummaryDeploymentName`; both calls pass `VoiceCall:SummaryReasoningEffort` — default **Low** since
  2026-08-07: summaries are extraction, and inheriting `AIService:ReasoningEffort` Medium was silently
  billing reasoning tokens on every call; null ⇒ inherit as before) → upload transcript JSON to the **`voice-transcripts`** blob container →
  create a **`CallSummary`** via `CreateIfAbsentAsync` (deterministic id **`{businessId}_call_{callId}`**,
  TTL `CallSummaryTtlDays`) with intent/summary/suggested actions/masked+full caller phone/duration →
  dispatch **`CallSummaryReady`** (Awareness — activity feed only) → record consent user-activities
  (`AiAssistantDisclosure`, `VoiceRecordingConsent`) → auto-apply suggestions (returns the applied ids) →
  dispatch **`CallSuggestionPending`** (in-app + push) when a Pending DraftBooking/DraftQuote card remains →
  delete the transcript buffer. **Two-phase
  idempotency**: summary `CreateIfAbsentAsync` + a `SideEffectsAppliedAt` marker so a redelivery never
  re-summarizes or double-applies side-effects.
- **Suggested actions** are pre-`Verified=true` for `Receptionist`/`Whisperer` paths (the partner
  witnessed the call) and **not** verified for `Voicemail`. Bookings the AI created live become an
  `AutoCreated` card (link-only). Auto-apply applies the first confident suggestion of each type
  (`AutoCreateConfidenceThreshold`).
- **Outcome analytics** (2026-07-03): the post-create side-effects step also emits `VoiceCallAction` OUTCOME
  events to `ServiceBusSettings:AnalyticsQueueName` — `call_missed/call_voicemail/call_ai_handled/call_whisperer`
  by `CallSummaryPath` (+ `call_ai_booked` when a PendingSuggestions DraftBooking carries `CreatedEntityNumber`).
  Business-scoped (ProviderId only — never the caller's number), metadata `{path, duration_bucket, model_tier?,
  has_transcript}`, deterministic EventId sha256("voice-outcome:{callId}:{subtype}"), fail-quiet. Powers the
  Insights Voice-Calls breakdown via `SmartAnalytics:VoiceSubtypeBuckets` — see `clinqet-analytics` +
  `clinqet-smart-analytics`.
- **`ActionSideEffects`** (`VoiceBookingActionKind`: `BookingCreated/Rescheduled/Cancelled/Confirmed`)
  → drives `IBookingService` in the partner's language (these are enqueued by the MCP tools, e.g.
  `request_booking` → `BookingCreated`).
- **Usage metering**: `TryAccumulateUsageAsync` adds AI-engaged seconds to
  `Voiceline.UsageSeconds`/`UsageMonth` (vs `MonthlyMinuteCap`); cap reached → `VoiceMinuteCapReached`
  (claim-once). A cap-exceeded line at the next `call.initiated` does **plain forwarding only** (no AI).
  ‼️ **`MonthlyMinuteCap == 0` means NO GRANT, not "uncapped"** (2026-09-18): the ledger projects 0 for a lapsed
  or never-bought add-on, and `Voiceline.IsCapExceeded` returns `cap <= 0 || used >= cap*60`. Reading 0 as
  unlimited is what let a cancelled assistant keep answering, unmetered — and `SyncVoicelineFromApplicationAsync`
  re-stamping a 500 default over it renewed that every time the provider saved a setting. The ledger
  (`ProjectCapToVoicelineAsync`) is now the cap's only writer, and `AssignNumberAsync` calls it once the line exists.
- ‼️ **`IVoiceModelTierProjector` / `VoiceModelTierProjector` — the ONE writer of the billed AI engine** (2026-09-18). It exists because the billing engine runs in the FUNCTIONS host, which does not (and should not) register the full `IVoiceAssistantService` — carrier number ordering, invites, SMS. `AiAddOnService.ProvisionVoiceTierAsync` resolved it optionally there, got `null`, and **silently skipped the stamp: a scheduled Advanced↔Standard switch was CHARGED at renewal while the line kept answering on the old engine** (`SubscriptionBillingService` → `ProvisionVoiceTierAsync`). The projector depends only on `IBusinessProfileRepository` + `IVoicelineRepository` (both hosts have them) and is registered by **`AddPaymentServices`**, so no host can bill without being able to stamp. `VoiceAssistantService.SetModelTierAsync` keeps the `AllowedModelTiers` admission check and then DELEGATES the write to it ⇒ one implementation, two callers. Validated against `VoiceTierIds` (standard/advanced + legacy mini/realtime-1.5), never the config list the Functions host does not bind; an unknown id THROWS rather than being canonicalised to Advanced. A **Cancelled** assistant keeps the tier on the profile but its voiceline is a tombstone and is never written. Writes via the new atomic `IVoicelineRepository.TrySetModelTierAsync` (targeted `/modelTier` Set, never a whole-document re-sync).
- ‼️ **Call Follow-ups: the strip owns a LIVE assistant, the promo owns no assistant — they can no longer talk over each other** (2026-09-18). `AssistantStatusStrip` used to return `null` whenever `entitlements.aiVoice !== true` and hand the page to `AiAssistantUpsellCard` — which is precisely the LAPSED state, so the one surface that could explain the silence was the one that vanished, and a provider whose assistant was Active read "Never miss a call again · Get AI Assistant". Now: `VA_LIVE` (Active/OnHold) ⇒ the strip renders, always; anything else ⇒ the promo (NotInvited is `AiSurfaceGate`'s). The strip gained a **no-minutes** state (`callFollowUps.strip.noMinutes`) because `out` was gated on `capMinutes > 0` and a cap of 0 now means NO GRANT: a live add-on that ran dry gets **Top up**, no live add-on gets **Turn it back on** (`callFollowUps.strip.restart`), both to `/dashboard/ai-billing` — never the settings page, which cannot sell. Copy says the line STILL FORWARDS, or "no minutes" reads as "my number is dead". Mobile mirrors it exactly (`AssistantInfoRow`, `CALL_FOLLOW_UPS.STRIP_NO_MINUTES` / `STRIP_RESTART_WEB`, `hasAiAddOn: true|false|null` where null = no `billing.read` ⇒ state shown, no action offered; both CTAs ride `SHOW_DIGITAL_GOODS_WEB_PURCHASE_CTA`).
- **Realtime token telemetry** (2026-08-07, cost): the live monitor/relay sum every `response.done`
  `usage` block (`RealtimeUsageAccumulator` — input/output split by text/audio + the CACHED subsets,
  i.e. whether the ~97–99% prompt-cache discount actually applied) and stamp the totals onto
  `VoiceCallSession.realtimeUsage` at teardown (`RealtimeUsagePersistence`, before the post-call
  enqueue) — the session doc is the COURIER: the winning `CallEnded` message comes from the function
  host, which never sees usage. `ProcessCallEnded` reads it LAST (after summarization, so the teardown
  write has landed), stamps `CallSummary.costMeta.realtime*` + `realtimeEstimatedCost` (USD, from the
  config `Azure:Realtime:TokenPricing` map via `RealtimeCostCalculator` — model resolved from the
  tier), logs one structured cost line per call, adds `realtime_turns`/`realtime_cached_pct`/
  `realtime_est_cost_usd` to the outcome-analytics metadata (additive), and raises the
  **`VoiceUsageAnomaly` admin alert** (deterministic per call) when the cached ratio is below
  `VoiceCall:UsageAlertMinCachedInputRatio` on a call with ≥ `UsageAlertMinTurns` turns (cache
  discount not applying = systemic margin risk) or the estimate crosses
  `UsageAlertMaxEstimatedCostUsd`. Every piece is settings-gated: `Azure:Realtime:UsageTelemetryEnabled`
  (capture+read) and `VoiceCall:UsageAdminAlertEnabled` (the alert); off ⇒ byte-identical to before.
- **`RecordingSaved`**: copy the carrier recording to **`voice-recordings`** blob, patch
  `CallSummary.RecordingBlobUrl` (refresh-by-id on expired URL; reschedule if the summary isn't there
  yet). **`SendDocument`**: deliver a booking/invoice/quote PDF over WhatsApp, direct SMS (caller-requested, `DocumentSendSms`), or re-enqueue email (`EmailOnly` — no WhatsApp add-on).

---

### 11.1 Post-call human-audio transcription (cost optimization, 2026-06) — NO live carrier STT

Telnyx no longer pays live carrier STT (~$0.015/min) for ANY human audio; it transcribes the **recording**
post-call via Azure Fast Transcription (~$0.003/min), at full parity with Plivo. The AI↔caller transcript is
unchanged (Azure realtime monitor — already free of carrier STT). All live `StartTranscriptionAsync` call
sites are gone (whisper, voicemail, and the provider-join handoff).
- **Whisper** (you answered) + **Voicemail**: `CallEnded` sets `TranscribeFromRecording`; the whole recording
  is transcribed post-call. (Voicemail moved to post-call too — the handoff's "voicemail already cheap" was a
  Plivo-only truth; Telnyx voicemail had been on live STT.)
- **Provider JOIN** of an AI call (`ReferredToPartnerAt != null`): `CallEnded` sets `AppendRecordingToTranscript`;
  ONLY the post-join human portion is transcribed (time-windowed: `joinOffsetMs = ReferredToPartnerAt −
  carrier recording_started_at + VoiceCall:HandoffAppendOffsetGuardMs`, passed as `skipBeforeOffsetMs` to
  `IVoiceRecordingTranscriptionService.TranscribeAsync`) and appended AFTER the AI vtrans, so the AI portion
  (already in vtrans) is never duplicated. **Missing anchor (no `RecordingStartedAt`/`ReferredToPartnerAt`) ⇒
  append SKIPPED (AI-portion-only summary)** — transcribing the whole recording would double-count the AI.
- **Recording delivery**: the carrier `recording.saved` callback stamps `RecordingId/RecordingUrl/RecordingFormat/
  RecordingStartedAt` onto `VoiceCallSession`; `ProcessCallEnded` reads the recording FROM THE SESSION and
  **bounded-reschedules** (reusing the `SttAttempt` counter + `vpc-end-{callId}-s{n}` ids) until it lands — it
  arrives at/after the authoritative caller-A-leg hangup — then transcribes. Two-phase idempotency
  (`CreateIfAbsent` + `SideEffectsAppliedAt`) preserved; recording enabled-but-never-reported ⇒ bounded give-up,
  summarize without the recording transcript (NOT flagged recording-off — recording was on).
- **Recording OFF ⇒ NO transcript** (no live-STT fallback) for whisper / voicemail / the human-join portion.
  `CallSummary.TranscriptUnavailableRecordingOff` is set so the **Call Follow-ups** card shows a note + a
  "turn on recording" link (Voice Assistant settings + the read-only summary also explain it); **AI-answered
  calls are NEVER flagged** (their transcript is Azure → always a full summary + suggested actions).
- **Removed**: `VoicePostCallKind.StartHandoffTranscription` + `ProcessStartHandoffTranscriptionAsync` + the
  live-STT handoff path; the dead `HandoffRecordingUrl/Id/Format` + `HandoffTranscriptionStarted` session fields;
  the orphaned `VoiceCall:TranscriptionEngine`/`IndicTranscriptionEngine`/`IndicLanguages` settings; and the now-dead
  `IVoiceTelephonyProvider.Start/StopTranscriptionAsync` carrier verbs (removed from the interface + both carrier
  impls + the integration mock + their carrier-service tests — no live STT anywhere ⇒ no dead seam surface). Plivo is UNCHANGED
  in behavior — the shared session-stamp + reconcile actually FIXES its previously-inert whisper/voicemail STT.
- **Edge**: a whisper→provider-hangup→AI takeover summarizes the AI portion only (`CallPath=Receptionist`, no
  `ReferredToPartnerAt`); the brief pre-takeover whisper stays in the recording for playback, not the transcript.

## 12. CALL RECORDING / FOLLOW-UPS UI (partner app)

Route `/dashboard/call-follow-ups` (`callFollowUps/CallFollowUpsPage.jsx`). Path labels are
re-skinned: **Receptionist="AI answered"**, **Whisperer="You answered"**, **Voicemail**, **Missed**.
- **Live cards** (top) from `GetActiveCalls()` + the SignalR transcript stream; each card offers
  **Join in browser** / **Join by phone** (§9). A page-level `BrowserCallBar` survives the live card's
  removal when the AI leg ends.
- **History**: `GetCallSummaries(page,pageSize,{path,needsReview})`, `…/counts`,
  `…/needs-review-count`, lazy `…/{callId}` (detail incl. a short-lived **inline** SAS `recordingUrl` for
  playback). **SAS-or-nothing guard (2026-07-07):** `voice-recordings` is always private, so both the inline and
  the download endpoints verify the transformed URL actually carries a SAS query — a bare URL (SAS mint failure or
  `StorageConfiguration:FrontDoorBaseUrl` misconfig) is logged as an ERROR and returned as unavailable (null/404),
  never handed to the UI as a dead link; `AzureStorageService.AppendReadSas` failures now log Error too. **Recording download** is a SEPARATE endpoint
  `GET …/call-summaries/{callId}/recording-download-url` → `IAzureStorageService.TransformToDownloadUrl`
  mints a fresh **attachment-disposition** SAS (`rscd` ⇒ `Content-Disposition: attachment;
  filename=call-{callId}.{ext}`) the browser/OS downloads **directly from storage** (full bytes, no API
  byte-proxying). It is a DIFFERENT URL from the inline `recordingUrl` ON PURPOSE — reusing the player's
  cacheable, range-streamed URL truncated the file (web `downloadImage` now also sets `cache:no-store`;
  web uses `triggerBrowserDownload`, mobile uses `Linking.openURL`).
  `RecordingPlayer` (HTML5 audio, speed cycle, download); `CallSummaryCard` (intent, summary,
  booking-created/recording/transcript chips, + a **recording-off note** with a "turn on recording" link when
  `transcriptUnavailableRecordingOff`, §11.1); `SuggestionItem` (apply/dismiss; types `DraftBooking`,
  `CreateCustomer`, `DraftQuote`, `SendQuote`, `RescheduleRequest`, `CancelRequest`; statuses
  `Pending/Applied/Dismissed/AutoCreated`). Suggestion apply/dismiss →
  `POST …/suggestions/{id}/{apply|dismiss}`. Delete → `DELETE …/{callId}` (soft-delete, TTL
  `DeletedCallSummaryTtlDays`). All strings via react-intl `callFollowUps.*`. Dashboard-home widget:
  `dashboard/home/CallFollowUps.jsx` (top-3, gated on `profile.voiceAssistant.status`).
- **Assistant status strip (2026-07-09)**: `callFollowUps/AssistantStatusStrip.jsx` renders under the
  page header for a LIVE line only (the gate passes `vaStatus`; shows for `Active`/`OnHold` — never
  beside the promo / finish-setup banner / upsell card, one assistant surface per lifecycle state).
  Content: tier chip (shared `utils/billingTiers.js` `TIER_LABEL_IDS` + the session-cached
  `useBillingOverview()` — zero duplicate overview calls) + live minutes from `GetVoiceUsage()`
  (remaining = cap − round(usedSeconds/60)) + "Assistant settings →" (`/dashboard/profile/ai-assistant`).
  States: low (remaining ≤ 15 — a DELIBERATE frontend constant approved 2026-07-09, mirrors the
  auto-recharge default trigger; amber chip + "Top up →" → `/dashboard/billing#billing-ai`, suppressed
  while auto-recharge is armed), out (`capReached` ⇒ red chip + Top up), paused ("Turn on in settings →"),
  on-hold. **The tier chip HIDES whenever the top-up link shows** (approved: the row must never wrap to a
  second line). Usage fetch failure ⇒ chip + settings only; billing/AI flags off ⇒ minutes + settings only.
  Analytics: `trackNav cta_click` widget `ai_strip`, target `settings|topup|turn_on`. Keys
  `callFollowUps.strip.*` in en-US/hi-IN/gu-IN.

### 12.1 Mobile (React Native partner app — at web parity, 2026-06)
`clinqetmobilepartnerapp` mirrors both pages. Setup = `Screen/ProfileFlow/VoiceAssistant/` (ApplicationForm
incl. the **standing instructions** `operatingInstructions` field). Call Follow-ups = `Screen/ProfileFlow/
CallFollowUps/` (history list, filters, recording player, suggestions) + a **dedicated full-screen Live Call
screen** `Screen/ProfileFlow/LiveCall/` (route `LiveCall`, param `{callId}`). Differences from web that matter:
- **Live transcript is its own screen**, not inline cards. The list shows a push-driven **presence banner**
  (no polling) → taps into `LiveCall`. `WatchVoiceLive`/`UnwatchVoiceLive` are invoked ONLY on the focused
  `LiveCall` screen (the cost gate); re-asserted via `onSignalRConnected` (fires on initial connect AND
  reconnect). SignalR wiring lives in `services/signalRService.ts` (`onVoiceLiveTranscript`/
  `onVoiceLiveCallEnded`/`onVoiceLiveCallStarted`/`onCallSummaryReady`).
- **`VoiceLiveCallStarted` deep-links** to `LiveCall` (notificationNavigation + a direct tray-tap special-case
  in `pushNotificationService`). Post-call the screen shows **preparing → ready → timeout** (CallSummaryReady
  push + bounded `getCallSummary` poll) so "View summary" is never a dead link.
- **Join from the live call = in-app WebRTC (primary, when the native build carries the SDKs) + phone-join
  (always available)**; carrier is NEVER rendered (technology-agnostic — `ActiveCall.carrier` is data-model
  only). In-app join = `useInAppJoin.ts` (mic → `mintWebRtcCredential` → `LiveCallTransport.connect` →
  `joinCall(callId,'browser')` → awaitLive → teardown+release; generation-cancelled by End/screen-leave)
  over `services/liveCall/` (Telnyx RN SDK / sip.js transports + `audioRoute.ts`). **Post-join the screen
  is a full phone-call UI** (hero + timer + "Before you joined" peek/sheet + round Mute/Speaker + End +
  muted strip + leave-guard — see the 2026-07-11 block). **Mic permission:** `ensureMicPermission` resolves
  mic access UP FRONT, before mint/join — react-native-permissions v5 behind the optional-require seam,
  falling back to Android `PermissionsAndroid.RECORD_AUDIO` / iOS `getUserMedia` probe on unlinked binaries.
  On `mic-blocked` the LiveCall screen shows an Alert with **Open Settings** (`Linking.openSettings`);
  retryable otherwise. iOS `Info.plist` carries `NSMicrophoneUsageDescription` + the `audio`
  `UIBackgroundMode`. Do NOT restore the old optimistic iOS `{ok:true}` no-op. Do NOT re-add a
  guarded-require/inert engine — production code only.
- **AI settings entry + assistant info row (2026-07-09)**: `CallFollowUpsList` takes `vaStatus` from the
  gate; when `Active`/`OnHold` the `CommonHeader` right slot gets a green-circle gear →
  `navigations.VOICEASSISTANT`, and a read-only `AssistantInfoRow` (plan `ProBadge` +
  "{remaining}/{total} AI min left" — `VoiceUsage` now projects `status`/`paused`) sits between the
  live banner and the review banner. Low (≤ 15, same UI constant as web) / out states go amber/red and gain
  **"Top up on web"** = the Plan & Billing `onOpenWeb` handler (`PARTNER_HOSTING_URL + "/dashboard"`,
  store-compliant — never an in-app purchase); paused/on-hold rows show "Turn on" → the VoiceAssistant
  screen. The pill hides whenever the web button shows (no wrap). Data refreshes on focus, pull-to-refresh
  and `CallSummaryReady`; tier via the cached `getProviderPlanSummary()` gated on
  `payments.billingUiEnabled`. Keys `CALL_FOLLOW_UPS.STRIP_*` (en/gu/hi); analytics mirrors web
  (`trackNav` `ai_strip` + `source: header|row`).
- Keys under `VOICE_ASSISTANT.*` / `CALL_FOLLOW_UPS.*` in `src/Locales/{en,gu,hi}.json` (es carries a partial
  `CALL_FOLLOW_UPS` block — join-failure + in-call keys — with en-fallback for the rest). Verify types with
  `node ./node_modules/typescript/bin/tsc --noEmit` (NOT `npx tsc` — it no-ops); repo has no root ESLint
  config. Original screen mockup: `Data/mockups/voice-live-call/index.html`. (Known minor
  gap: OnHold ApplicationSummary. The voice-call join analytics funnel IS emitted on mobile since Phase 8.)

---

## 13. COSMOS ENTITIES (reuse existing containers — NO new container was added)

| Entity | Container / pk / id | Notes |
|---|---|---|
| `VoiceCallSession` | `Transactions` family, **pk `/pk`**, `type=VoiceCallSession` | per-call binding doc + state machine; `Jti` (revocation), `Phase`, `Scope`, `MonitorInstanceId`, `ReferredToPartnerAt`, `ProviderJoinSipTarget`, `ProviderJoinLegCallControlId` (Telnyx bridge-join in-flight dial leg), `RecordingId/RecordingUrl/RecordingFormat/RecordingStartedAt` (stamped at `recording.saved` ⇒ post-call STT, §11.1), OTP state, pending suggestions/messages, TTL |
| `Voiceline` | **`SystemData`**, `id=pk=voiceline_{e164}` | per-DID runtime config; point-read on every `call.initiated`; `HoursMode`, `ForwardTo`, `ModelTier`, `RecordingEnabled`, `PrivateMode`, `Status`, `MonthlyMinuteCap`/`UsageSeconds`/`UsageMonth`, `TimeZoneId` |
| `VoiceAssistantState` | embedded on `BusinessProfile` (`ProviderData`) | the setup lifecycle (status, application, assigned number, model tier, rejection/hold history) |
| `VoiceBusinessLiveCall` | per-business live-call marker (TTL `LiveCallRegistryTtlHours`) | lets `active-calls` aggregate across MCP instances; owner-guarded delete |
| `VoiceTranscript` | transcript segments per call (`AppendSegmentAsync`) | live transcript buffer; deleted after the summary is built |
| `CallSummary` | id **`{businessId}_call_{callId}`**, TTL `CallSummaryTtlDays` | the durable summary + suggestions + recording URL; `CreateIfAbsentAsync` for idempotency; `TranscriptUnavailableRecordingOff` (human call, recording off ⇒ no transcript → Call Follow-ups note, §11.1) |
| `McpAudit` | partitioned by businessId, TTL `AuditTtlDays` | **metadata only** (tool name, scope, outcome, duration) — never PII |

**All voice Cosmos access is single-partition** (callId/businessId/e164 point-reads + CAS).
`VoiceCallSession` is partitioned by callId → there is **no by-businessId query** for live calls (hence
the `VoiceBusinessLiveCall` marker + the MCP `active-calls` aggregation). The `voice-transcripts` /
`voice-recordings` blob retention must equal `VoiceCall:CallSummaryTtlDays` ==
`VoiceAssistant:VoiceDataRetentionDays` == ARM `voiceArtifactRetentionDays`.

---

## 14. ENUMS, SETTINGS, QUEUES (verbatim)

### 14.1 Enums (`clinqetshared/Enums/`, all `[JsonStringEnumConverter]`)
- `VoiceCarrier`: `Telnyx, Plivo`
- `VoiceCallScope`: `Customer, Partner`
- `VoiceCallPhase`: `PartnerAttempt, AiHandoff, Active, WhisperActive, Voicemail, Ended`
- `CallSummaryPath`: `Missed, Receptionist, Whisperer, Voicemail`
- `VoiceHoursMode`: `AlwaysOnMiss, AfterHoursOnly, NeverAnswer`
- `VoicelineStatus`: `Active, Paused, Parked, Returned, Cancelled` (only `Active` answers inbound; `Parked` = reserved for its business, `Returned` = back in our pool with `BusinessId` retained as the LAST owner)
- `VoiceAssistantStatus`: `NotInvited, Invited, Draft, Submitted, NumberPending, Active, Rejected, OnHold, Cancelled`
- `VoiceNumberMode`: `NewDedicated, ForwardExisting`
- `VoiceCallerSource`: `Crm, Identity`
- `VoicePostCallKind`: `CallEnded, RecordingSaved, ActionSideEffects, SendDocument, DialReassurance, StartProviderJoinDial` (Telnyx bridge-join dial handoff)`, HangupCall` (Plivo end-of-call). `TranscribeFromRecording`/`AppendRecordingToTranscript` flags ride the `CallEnded` message (§11.1). `StartHandoffTranscription` REMOVED (live-STT handoff gone).
- `VoiceBookingActionKind`: `BookingCreated, BookingRescheduled, BookingCancelled, BookingConfirmed`
- `VoiceMonitorCommandKind`: `Keepalive, ProviderJoin, ResumeAfterJoinMiss` (Telnyx bridge-join miss → resume the muted AI)
- `VoicePendingMessageKind`: `Message, Callback`
- `VoiceDocumentKind`: `Booking, Invoice, Quote`
- `VoiceTelephonyEventType`: `Unknown, CallInitiated, CallAnswered, SpeakEnded, MachineDetectionEnded, Transcription, Hangup, RecordingSaved, ReferCompleted, ReferFailed`

### 14.2 Settings sections (keys + defaults; **secrets are Key Vault refs — never commit real values**)
- **`Mcp`** (`McpServerSettings`): `PublicUrl`, `SecretPath` (≥16, validated), `TokenSigningKey`
  (≥32), `InternalApiKey`, `TokenIssuer=clinket-voice`, `TokenAudience=clinket-mcp`,
  `SessionTtlMinutes=120`, `ProviderContextCacheMinutes=5`, `AuditTtlDays=30`,
  `SessionStartSignalAttempts=3`/`SessionStartSignalRetryDelayMs=750` (monitor wake-up retry),
  `TransactionsMaxPageSize=25`, `AlertCooldownMinutes=15`, `OtpExpiryMinutes=5`, `OtpMaxAttempts=3`,
  `OtpMaxSendsPerCall=3`, `OtpChannelOrder` (`email,whatsapp,sms`; IN: `whatsapp,email,sms`),
  `RateLimiting{Enabled,RequestsPerWindow=60,WindowMinutes=1,MaxConcurrentToolCallsPerBusiness=4}`,
  plus booking/search caps.
- **`Azure:Realtime`** (`AzureRealtimeSettings`): `Endpoint`, `ApiKey`, `DeploymentDefault=gpt-realtime-2.1-mini`,
  `DeploymentPremium=gpt-realtime-2.1` (both on Azure's SIP list since 2026-09-23), `ReasoningEffort=low` (every call),
  `VoiceGenders` (Functions AND MCP), `SipUri`, `DefaultVoice=marin`, `WebhookSecret`,
  `MaxCallDurationSeconds=1800`, `MaxConcurrentCalls=20`, `QuotaAlertThresholdPercent=80`,
  `MonitorPostCallDelaySeconds=120`, `EndCall*`, `Idle*`, `OpeningGreetingGuardSeconds=4`,
  `FarewellPhrases[]` (en/hi/gu/fr), `ProviderJoinAnnounce*`, `ProviderJoinReassureSeconds=5` (bridge-join
  ring filler — seconds of SILENCE between AI "please hold" lines, measured from playout-end; keep <~8s),
  `Instructions*` bounds, `Vad*`,
  `NoiseReductionMode=far_field`, `MaxResponseOutputTokens=1200`, `VoiceGenders{}`,
  `AniBindingTtlSeconds=900`, `WebhookIdempotencyTtlSeconds=86400`.
- **`VoiceCall`** (`VoiceCallSettings`): `PartnerTransferTimeoutSeconds=25`, `RingbackAudioUrl`, `KnownCallerCacheMinutes=5` (warm-while-ringing known-caller cache),
  `DialReassuranceSeconds=18`, `CallTimeLimitSeconds=1800`, `AnsweringMachineDetection=detect`,
  `RecordingFormat=mp3`, `RecordingChannels=dual`, `ReceptionistEnabled=true`, `TokenLifetimeBufferMinutes=5`,
  `SipTransferTimeoutSeconds=15`, `ReceptionistTakeoverOnPartnerHangup=true` (PRE-join whisper hangups only — a POST-join provider hangup always ENDS the call),
  `SummarizeFullCallAfterHandoff=true` (now gates the post-call human-join append, §11.1, not live STT),
  `HandoffAppendOffsetGuardMs=0` (join append-window guard, §11.1),
  `RecordingTranscriptionMaxAttempts=5`/`RecordingTranscriptionRetryDelaySeconds=30` (recording-wait + STT retry),
  `MaxProviderJoinReengagements=2`, `ProviderJoinRingTimeoutSeconds=30` (Telnyx bridge-join provider ring), `PrivateModeReferEnabled=false`+`ReferSipDomain=sip.telnyx.com` (§6 private-mode REFER),
  `LiveCallRegistryTtlHours=6`, `CallSummaryTtlDays=90`,
  `AutoCreateConfidenceThreshold=0.7`, `Summary*`.
- **`VoiceAssistant`** (`VoiceAssistantSettings`, API only): `AllowedCountries[]`, `SupportedLanguages[]`,
  `Voices[]`, `PersonaMaxLength=500`, `DefaultModelTier=mini`, `AllowedModelTiers[]`,
  `CallSummariesPageSize=20`/`Max=50`, `DeletedCallSummaryTtlDays=1`,
  `VoiceDataRetentionDays=90`, `VoicelineTombstoneTtlDays=30`, `NumberReassignmentQuarantineDays=30`,
  `NumberOrderPoll*`. Business timezone keys live under shared `BusinessTime`, not `VoiceAssistant`.
- **`Telnyx`**/**`SmsRouting`**/**`TwoFactor`**: carrier creds, `Voice:Carrier` seam. India **`PlivoSettings`** (`clinqetshared/Models/PlivoSettings.cs`, mirrors `TelnyxSettings`; `BaseUrl`/`AuthId`/`AuthToken`/`ApplicationId`/`SignatureAuthTokens`/`WebhookAllowedIpRanges`/`StreamWssUrl`/`CallbackBaseUrl`/`AiMediaFormat` (default `l16`; `pcmu` = μ-law opt-in)/`AmdDecisionTimeMs`/`RecordChannelType`/`MpcMaxParticipants`/`WebhookNonceTtlMinutes`/`Endpoint`/`Retry`; every key has a live runtime reader; class defaults mirror the empty-secret `"Plivo"` appsettings block in BOTH the Functions and API `appsettings.json`) — bound unconditionally next to `TelnyxSettings` in the API + Functions `Program.cs`; the consuming Plivo adapter is registered behind the `Voice:Carrier==Plivo` DI branch. Plivo creds are plaintext `deploy.ps1` params today; the per-stamp KV migration is a pre-prod MUST-DO (§10.5(a)).

### 14.3 Service Bus (per-stamp, `events.json`)
- Queue **`voice-postcall`** (dedup on, TTL 14d, DLQ-on-expire, maxDelivery 5).
- Topic **`voice-monitor-commands`** + subscription **`monitor`** (`requiresSession:true`, TTL 5m) —
  the provider-join backplane.
- Reuses `admin-alerts` and `user-activities`.

---

## 15. DEPLOYMENT (`azureautomation/` + `clinqetmcp/.github/workflows/`)

- **MCP App Service** (`apps.json`, gated `deployMcp`): a **dedicated** Linux App Service plan
  (`clinket-mcp-plan`, SKU `P0v3` on every stamp) off the shared API plan, app `clinket-mcp` →
  per-stamp `clinket-mcp-{ca|in}[-{dev|uat}]` (prod omits the env suffix). `linuxFxVersion
  DOTNETCORE|10.0`, `alwaysOn`, **SystemAssigned identity**, **default-deny `ipSecurityRestrictions`**
  (only `AzureCloud` + `ApplicationInsightsAvailability`; app-layer channel auth is the real boundary)
  with the API + Functions outbound IPs appended.
- **Deployed on BOTH the `ca` and `in` stamps** (`deploy.ps1: $script:DeployMcp = RegionStamp -in ("ca","in")`).
  *(The ARM/param comments saying "CA-only" are stale — trust the code.)*
- **Managed-identity RBAC** (PHASE 4e): Cosmos *Built-in Data Contributor*, Service Bus *Data
  Sender* + *Receiver*, Key Vault *Secrets User* per-secret on `voice-call-token-key` + `mcp-secret-path`.
- **App settings** wired via `deploy.ps1` (`__` nesting): `CosmosDb__*` (managed identity, 4
  containers — **NOT** the `Communications` container), `ServiceBusSettings__*` (incl.
  `VoiceMonitorCommandsTopicName`/`SubscriptionName=monitor`), `Azure__Realtime__*`,
  `ClinketApi__PublicBaseUrl`, `Mcp__InternalApiKey`/`ClinketApi__InternalApiKey` (shared), Telnyx/2Factor/WhatsApp/ACS.
- **Realtime Foundry** (the only region-split AI resource): CA → shared **East US 2**; IN → dedicated
  **Sweden Central** (realtime SIP is only in those two). Model deployments `gpt-realtime-2.1-mini` +
  `gpt-realtime-2.1` (since 2026-09-25; earlier mini + 1.5, then mini + 2). Realtime webhook auto-registered to `…/api/voice/realtime`; secret in KV
  `azure-realtime-webhook-secret`.
- **Storage**: `voice-transcripts` + `voice-recordings` (private, 90-day lifecycle), `assets` (public;
  hosts `voice-ringback.wav`).
- **Carrier seam**: `Voice__Carrier` = `plivo` (IN) / `telnyx` (else) on the API + Functions.
  Telnyx KV: api key, call-control app id, WebRTC credential connection id, webhook public key.
  **India Plivo** is wired on the `in` stamp (`deploy.ps1`, gated `RegionStamp -eq "in"`):
  `Plivo__AuthId`/`AuthToken`/`ApplicationId`/`SignatureAuthTokens` (the API gets no `SignatureAuthTokens`
  — it validates no webhooks), `Plivo__StreamWssUrl` = `wss://clinket-mcp-in[-env].azurewebsites.net/voice/plivo/stream`
  (the in-India relay, DERIVED per stamp) + `Plivo__CallbackBaseUrl`. The Plivo creds are **plaintext params
  today** (sandbox) — the per-stamp **Key Vault** migration is a pre-prod MUST-DO (§10.5(a)). The IN MCP
  hosts the `/voice/plivo/stream` relay; its default-deny IP allowlist must admit Plivo's streaming IPs
  before live India traffic — plumbed via `deploy.ps1 -PlivoStreamingAllowedIpRanges` (IN-gated, appends to
  the MCP `ipSecurityRestrictions`); the webhook allowlist rides `-PlivoWebhookAllowedIpRanges` →
  `Plivo:WebhookAllowedIpRanges` (§10.5(b)). The `voice-postcall` queue + `voice-monitor-commands` topic are
  reused (no new queue for Plivo).
- **CI/CD** (`clinqetmcp/.github/workflows/`): `_build.yml` (composes clinqetcore/shared/infrastructure
  via cross-repo checkout, Testcontainers + Cosmos emulator integration tests, `dotnet publish
  linux-x64` framework-dependent) + `_deploy.yml` (`azure/webapps-deploy@v3` ZIP, `/health` check).
  Per-(env × region) deploy callers (`deploy-{dev|uat|prod}-{ca|in}.yml`); prod is `workflow_dispatch`-only.
- **Failure alerting**: `*-clinket-voice-failures` scheduled-query alert fires on the stable log
  markers (e.g. `"MCP channel auth rejected"`, `"Realtime webhook signature validation failed"`,
  `"SIP transfer command rejected"`, `"Failed to enqueue post-call message"`, `"MCP tool execution failed"`).

---

## 16. VERIFICATION & OTP (caller identity on the phone) — `Verification/VoiceVerificationService.cs`

Two-tier authorization for destructive actions on a caller's booking:
- **Caller-ID (ANI) auto-verify**: if the calling number matches the booking, the caller is verified
  with **no code sent** (`VerifiedByCallerId`). But ANI is spoofable → it does **not** clear a cancel
  (a confirming **action-OTP** must still be sent). **Code-verify** (a real `verify_booking_code`)
  *does* clear cancel directly.
- **OTP send** order = `Mcp:OtpChannelOrder` (email → WhatsApp template → SMS; IN reorders to
  WhatsApp-first), in the contact's preferred language, to the **contact on file** (never the caller's
  line). Session stores only an HMAC **hash**. Caps: `OtpMaxAttempts=3` (consumed before compare →
  lockout), `OtpMaxSendsPerCall=3`, `OtpExpiryMinutes=5`. Terminal bookings
  (Cancelled/Completed/Rejected/NoShow) → `BookingNotActionable`, no send. Tools:
  `request_booking_verification`/`verify_booking_code` (access) and
  `request_action_otp`/`verify_action_otp` (one-shot `action:cancel:{number}` grant).

---

## 17. NOTIFICATIONS & ADMIN ALERTS

- Provider `NotificationType`: `VoiceLiveCallStarted` (live card; **must** be in
  `SignalRSettings:EnabledNotificationTypes` for real-time), `CallSummaryReady`, `VoiceAssistantInvited`,
  `VoiceAssistantActivated`, `VoiceAssistantRejected`, `VoiceAssistantOnHold`,
  `VoiceAssistantHoldLifted`, `VoiceMinuteCapReached`. Dispatched via `ICommunicationDispatcher` (see
  `clinqet-notifications`). The live transcript/ended events are **NOT** notifications — they ride the
  dedicated `ReceiveVoiceLiveTranscript`/`ReceiveVoiceLiveCallEnded` SignalR channel and are never
  persisted.
- `AdminAlertType`: `VoiceAssistantApplicationSubmitted`, `VoiceAssistantCancelled`, plus operational
  alerts from `McpSecurityAlertService` (`McpAuthRejected:*`, `McpOps:*`) and
  `FailureNotificationHelper` (realtime webhook/accept/binding, provider-join/handoff). Admin
  alert wording may be hardcoded English (§3.6).

---

## 18. TESTS (where the contracts are pinned)

- **`clinqetmcp/Clinqet.Mcp.UnitTests` + `.IntegrationTests`**: channel auth (secret/bearer/binding/jti),
  call-token mint/validate, rate limiter, tool catalog (29 tools) + scope + tenant isolation + caller
  masking, `FullProviderContextService`, `VoiceSessionMonitor` lifecycle + watchdogs + provider-join
  (announce→VAD-off+`StartProviderJoinDial`, resume-on-miss), backplane routing (202/404), `VoiceVerificationService`.
- **`clinqetfuncations/Clinqet.Communications.UnitTests` + `.IntegrationTests`**:
  `VoiceCallControlFunctionTests` (Telnyx state machine, AMD bridge, disclaimer-or-nothing, takeover
  triggers, idempotent enqueue), `RealtimeCallWebhookFunctionTests` (binding precedence, accept
  outcomes), `VoicePostCallProcessorFunctionTests` (summary, STT, suggestions, usage, idempotency).
- **`clinqetapi/Clinqet.API.UnitTests` + `.IntegrationTests`**: `VoiceAssistantServiceTests` (full
  lifecycle), `VoiceLiveCallClientTests`, `Telnyx/TelnyxCallControlServiceTests`,
  `VoiceAssistantControllerIntegrationTests` (401/403/404, cross-tenant isolation).
- **India = Plivo** (shipped): carrier-mocked unit tests for `PlivoVoiceCallControlFunction` (state machine,
  AMD gate, voicemail, recording-callback `RecordingUUID` lift, caller-hangup, the no-answer-join resume via
  the `?join=1` marker), `PlivoVoiceRelay` (token-bind fail-closed, L16-8k vs μ-law, barge-in, bulletproof
  silence, `DropAiForBridge`), `PlivoCallControlService` AI-agent format, `PlivoVoiceXmlBuilder`,
  `G711MuLawCodec`, plus the affected `~Voice`/`~Plivo` integration tests. All carrier-gated; Telnyx is
  provably un-regressed.

**Key invariants the tests enforce** (preserve these): disclaimer-or-nothing (§19); deterministic
idempotency (`vpc-end-{callId}`, `vpc-rec-{callId}`, `vpc-watch-{callId}`, CallSummary id, token jti);
two-tier destructive auth; structural tenant isolation (model `businessId` ignored; foreign data →
"not found", no PII, no code); premature-summary guards (referred/handed-off defer to the A-leg
hangup); caller-PII masking on every customer-scope tool result.

---

## 19. CROSS-LINKS

- Chat AI assistant (different feature, shared `AIServiceSettings`): `clinqet-ai-assistant`.
- Notifications + admin alerts + SignalR hub: `clinqet-notifications`.
- Booking/quote/invoice side-effects driven by the MCP tools: `clinqet-booking-lifecycle`,
  `clinqet-quote-lead-broadcast`, `clinqet-invoice-generation`.
- Provider profile/services/availability/offers feeding `FullProviderContextService`:
  `clinqet-provider-onboarding`, `clinqet-service-listing`, `clinqet-availability-calendar`.
- WhatsApp send rails (OTP + document delivery): `clinqet-whatsapp`.
- Provisioning, ARM, region stamps: `clinqet-deployment`. Cosmos containers/partition keys:
  `clinqet-cosmos-data`. Analytics (`VoiceCallAction` join funnel): `clinqet-analytics`.

---

## 20. CHECKLIST BEFORE MERGE

- [ ] All voice Cosmos access is **single-partition** (callId / businessId / e164). No cross-partition (§0.6).
- [ ] No new Cosmos container without explicit approval (§0.7) — voice reuses existing containers.
- [ ] **§19 disclaimer-or-nothing** preserved: no recording/transcription/receptionist/voicemail unless `DisclaimerPlayedAt != null`.
- [ ] AI-takeover gate keeps **all** conditions: `ReceptionistEnabled`, voiceline `Active`, `HoursMode` (incl. `AfterHoursOnly` evaluation), disclaimer, `SipUri`, not Cap/Private.
- [ ] Per-call **token jti** rotation + binding-doc cross-check intact (the revocation primitive).
- [ ] **Tenant isolation**: `businessId` only from the binding `CallContext`, never a tool argument; foreign data → structured "not found" with no PII.
- [ ] **Caller-PII masking** on every customer-scope tool result (`CallerMasking`); `McpAudit` rows metadata-only; `businessId` never serialized into a tool result.
- [ ] Deterministic Service Bus `messageId`s preserved (`vpc-end-/vpc-rec-/vpc-watch-{callId}`); CallSummary `CreateIfAbsentAsync` + `SideEffectsAppliedAt` two-phase idempotency.
- [ ] Carrier parity: Telnyx is the shipped spec; the India = Plivo adapter (GA) reproduces each Telnyx path behind the `Voice:Carrier` seam — do NOT regress Telnyx (every shared change carrier-gated, Telnyx byte-for-byte).
- [ ] New MCP tool: explicit snake_case `[McpServerTool(Name=…)]`, runs through `McpToolGuard`, correct `partnerOnly` scope, added to `ScopeCAllowedTools` if a customer call may use it, AND registered in `Program.cs WithTools<>`.
- [ ] New `NotificationType` added to `SignalRSettings:EnabledNotificationTypes` for real-time delivery (§16 CLAUDE.md).
- [ ] No hardcoded user-facing text — `Voice_*` localization keys (API/functions), `voiceAssistant.*`/`callFollowUps.*` react-intl (UI). Admin alert English is the only exception.
- [ ] No magic numbers — everything in `Mcp`/`Azure:Realtime`/`VoiceCall`/`VoiceAssistant`/`Telnyx`/`Plivo` settings; class defaults mirror `appsettings.json` on every host (memory `feedback_appsettings_class_defaults`).
- [ ] Retention parity: `VoiceCall:CallSummaryTtlDays` == `VoiceAssistant:VoiceDataRetentionDays` == ARM `voiceArtifactRetentionDays`.
- [ ] New `local.settings.json`/app-setting → ARM + `deploy.ps1` env var (§25 CLAUDE.md); new Service Bus queue/topic → `events.json` + `deploy.ps1`.
- [ ] **NEVER commit real secrets** — the dev `appsettings.json` in `clinqetmcp` carries live keys; prod uses Key Vault refs. Use placeholders in code/docs.
- [ ] Unit + integration tests for every new endpoint / tool / function path (§0.8); ESLint clean on UI.

---

## 21. GOTCHAS / NON-OBVIOUS FACTS

- The **"first prompt" is built by the function app** (`RealtimeSessionPayloadBuilder` in
  `clinqetinfrastructure`), not by the MCP server. The MCP server only *serves tools* once the model
  is live. "Gather info while ringing" = `WarmAiContext` pre-warming the `FullProviderContextService`
  cache + the known-caller identity at PROVIDER-DIAL start (and again, idempotently, at the takeover
  gate), so the realtime accept is a fast cache hit. India: the Plivo function fires the same warm
  cross-process via the MCP `/internal/{secret}/warm-context` endpoint (the relay builds the first
  prompt in the MCP process).
- The Azure realtime model talks **directly to the MCP server over HTTP** (it is configured as an
  `mcp` tool with `server_url` + a `Bearer` per-call token) — the function app/API do NOT proxy tool
  calls.
- The MCP **monitor socket lives in exactly one MCP instance** (stamped `MonitorInstanceId`); a
  provider-join landing on any instance is routed to the owner via the Service Bus **session topic**
  backplane. `WEBSITE_INSTANCE_ID` is the instance id; a restart is a *new* owner (its in-memory
  sockets are gone — that's correct).
- **Live transcript streaming is OFF unless the provider is on the Call Follow-ups page** (or arrives
  via the push) — `WatchVoiceLive`/`UnwatchVoiceLive` gate it, re-asserted on every reconnect.
- **Browser-join is wired per carrier**: Telnyx `@telnyx/webrtc`, India = Plivo `plivo-browser-sdk`. The Plivo app-join's SIP-identity DTO projection is DONE (`WebRtcCredentialDto` carries `SipUser`/`SipTarget`/`SignalingServer`; `SignalingUrl=wss://phone.plivo.com`); it activates once the Plivo account creds exist so a credential is minted (§10.5(c)).
- The folder/route is `…/profile/ai-assistant` but the FEATURE is **Voice Assistant** — don't confuse
  it with the chat `clinqet-ai-assistant`.
- The function-app project is named **`Clinqet.Communications`** (under `clinqetfuncations/`) and hosts
  ALL functions (voice + the rest), not just voice.
- The dev `clinqetmcp/appsettings.json` contains **real secrets** — a pre-existing condition; do not
  propagate them and do not add new ones (use KV refs).

## Phone-cancel policy = the platform booking-day gate (2026-07-17)

- `BookingTools` no longer uses `Booking:CancellationWindowHours` (deleted). `cancel_my_booking` and the `find_booking` `cancellationByPhone` hint use the shared `BookingCancellationPolicy` (clinqetcore) with `Booking:SelfCancelCutoff` (default `BeforeBookingLocalDate`): callers cancel free BEFORE the booking's local calendar day; ON the day the tool returns structured `cancelled:false, code:"bookingDay"` steering the model to offer prepare_action (owner relay) or a reschedule; non-cancellable states return `notCancellable`. Hint codes: `available | bookingDay | notApplicable`. The action grant is never consumed by a blocked cancel (unchanged).

### Link-share SMS: its OWN switch, Canada only (2026-07-31)

‼️ `Voice:Sharing:SmsEnabled` (default **true**) is a DEDICATED kill switch for the SMS leg of `send_service_info` — deliberately NOT the platform `WhatsApp:DocumentSms*` pair, so texting a service page can be killed without touching booking/quote/invoice document SMS.

- **One authority: `VoiceLinkSmsGate`** (`clinqetinfrastructure/Services/Communication/VoiceLinkSmsGate.cs`). It **ANDs** with `DocumentSmsGate` rather than replacing it, so the platform switches and the unconditional +91/DLT recipient exclusion still hold — turning `SmsEnabled` ON can never re-enable a channel those forbid. Every AI knowledge surface (tool notes) AND every egress on this rail calls it, so what the model believes and what actually sends cannot disagree.
- **Canada/Telnyx only, two layers:** deploy.ps1 forces `Voice__Sharing__SmsEnabled` to `"false"` on the `in` stamp (5 wiring points, mirroring the `WhatsApp__DocumentSms*` pattern: `$script:RequiredFunctionAppSettings`, the `$voiceDocSmsForStamp` MCP dict, the Functions live-apply, and both MCP emit-mirror dicts) **plus** the in-code +91 exclusion.
- ‼️ **The prompt's SMS block is SHARED with `send_my_details`/`send_quote`** — gating it on this switch would regress the document rail. The switch is therefore scoped to the LINK rail only: the tool's channel decision, its fallback note wording, and the egress. An 'sms' ask with the switch off returns the existing warm `smsUnavailable` steer.
- Pinned: delivery (off ⇒ caller-requested SMS degrades to WhatsApp; off ⇒ no SMS fallback on WhatsApp failure; off ⇒ the queued send carries NO `SmsFallback` descriptor so the outbound processor cannot text around it; ON cannot override the platform switches) + tool (off ⇒ `smsUnavailable` and nothing enqueued; off ⇒ the note never says "arrives as a text message"; on ⇒ it does).

### Channel rules the caller actually experiences (2026-07-31)

- **EMAIL means email.** `send_service_info` returns `needEmail` and asks once for the address; it NEVER silently diverts to WhatsApp just because an ANI exists, and never sends to both unless asked. All three send tools ride `VoiceSendChannelResolver` (the older `wantsEmail ⇒ sendWhatsApp` divert is gone — the "still carry it" line that used to sit here was stale, contradicting the resolver section below), and since 2026-08-14 the email leg is one-channel END-TO-END: the voice enqueues stamp `EmailOnly` so the email processors' WhatsApp add-on never fires for a voice send.
- **A text message is a RESCUE, never a menu option.** The AI clarifies ONCE whether WhatsApp is okay when a caller says "text me"/"message me"/"to my phone" (people say "text" loosely). SMS is used only after the caller says they don't have WhatsApp, don't use it, **or that their WhatsApp is on a DIFFERENT number** — and it always goes to the number they are CALLING FROM, never to a caller-dictated number (§15 invariant). The prompt states outright: *"NEVER offer a text message up front or list it as a choice."*
- **Link-rail SMS scoping.** `Voice:Sharing:SmsEnabled=false` while the platform document switches are ON adds ONE sentence: texting is unavailable for an offering's/business's information, *"Text messages remain available for a booking, invoice or quote copy."* Emitted only when `onRequestEligible && !linkSmsEligible`, so the +91 never-learns-texting census stays absolute (pinned by `Build_IndiaCaller_NeverLearnsTextingExists_EvenWithSharingOn`).

### ‼️ ONE channel rule — `VoiceSendChannelResolver` (2026-07-31)

`clinqetmcp/Clinqet.Mcp/Tools/VoiceSendChannelResolver.cs` is the ONE place a voice send picks its channel, shared by **send_my_details, send_quote and send_service_info**.

**THE RULE: a send goes to the channel the caller CHOSE, or it does not go at all.** When that channel is impossible the tool REFUSES with a structured result naming the one alternative that IS possible; the model offers it in one short question and sends only once the caller agrees. Exactly ONE channel is ever returned — a send is never fanned out across two.

- **What this replaced:** all three tools carried `if (wantsEmail && !sendEmail && ani != null) sendWhatsApp = true;` — a caller asked for email and was told it went to their WhatsApp, having never been asked. `send_quote`'s `needEmail` guard was effectively dead code (it required no email AND no phone, and the caller is by definition on the phone).
- **Refusal shapes:** `needEmail` (ask for the address, read it back, offer WhatsApp if they decline) · `emailUnavailable` (no address on record and the tool may not accept one) · `whatsAppUnavailable` (no number — offer email) · `smsUnavailable`. Each names its alternative; none dead-ends.
- **‼️ `canAskForEmail: false` for send_my_details is a SECURITY boundary, not an oversight.** That tool has no email parameter because a booking/invoice PDF is existing customer PII and may only reach the address already on record — never one dictated on the call (a social-engineered booking number would otherwise exfiltrate it). It therefore OFFERS WhatsApp instead of asking for an address it is not permitted to use. `send_quote`/`send_service_info` may ask: a quote/page is not stored PII.
- **Ordering matters in send_quote:** the resolution runs BEFORE `CreateQuoteAsync`, so a refusal leaves no orphan quote. Pinned by `SendQuote_EmailChannel_NoEmailKnown_AsksForIt_AndCreatesNoQuote`.
- **Email read-back at the point of use:** the `needEmail` note itself carries "spell the part before the @ one letter at a time, say the domain naturally, use only what they confirm" — the instruction fires when the model actually needs it, not only in a general rule thousands of tokens earlier. The prompt carries the same rule globally.
- **Prompt (applies to every send):** *"HOW SOMETHING IS SENT IS THE CALLER'S CHOICE, NEVER YOURS TO CHANGE… it goes to ONE of them, never two… OFFER that alternative in one short question, and send it only once they agree."*
- Dead code removed with it: `SmsUnavailableResult()` and the unreachable `sendWhatsApp && sendEmail ⇒ "WhatsApp and email"` wording in both BookingTools sends and ServiceInfoTools (single-channel by construction).
- Pinned by `VoiceSendChannelResolverTests` (14) + tool-level tests on all three rails.

---

## ‼️ MULTI-USER TENANCY — PHASE 7 (2026-08-03). Voice notifications + branch-aware rejection.

### Voice notifications now fan out to members, not to the business id

`RealtimeCallWebhookFunction` (`VoiceLiveCallStarted`) and `VoicePostCallProcessorFunction`
(`CallSummaryReady`, `VoiceMinuteCapReached`) route through `IBusinessCommunicationDispatcher`. Before
this they dispatched to `RecipientUserNumber = businessId`, which under tenancy reaches no in-app
partition, no device tag and no SignalR group.

`CallSummaryReady` is an **`Awareness`** type: zero recipients, one activity-feed row (L91), factory
never invoked — so the call site legitimately passes `_ => new CommunicationRequest()`, and a test that
asserts on the **raw** dispatcher for it can only ever sit at zero. Count redelivery idempotency at the
business layer instead:

```csharp
Assert.Equal(1, businessDispatcher.CountFor(NotificationType.CallSummaryReady));
```

`VoiceMinuteCapReached` uses `BusinessEventId.ForBusinessPeriod(businessId, "yyyy-MM", …)` — the cap is
monthly, so the month **is** the durable period key and a redelivery inside the month deduplicates.

### The out-of-hours rejection now names the open branches (05-BRANCHES §8.6 case 9)

`clinqetmcp\Clinqet.Mcp\Tools\BookingTools.cs` gained `DescribeBranchHoursAsync(...)`. When a caller asks
for a time the requested location is closed, the AI can now say **which other branches are open and
when**, instead of a flat "we're closed".

Behaviour is deliberately conservative — the hint is **unchanged** at 0 or 1 branch, or when every
branch shares the same grid. Only when branches genuinely differ does it append:

```
{fallbackHint} By location on {dayName} — {Downtown: 09:00-17:00; Mall Unit: closed Monday}.
```

`IBranchDirectory` is an **optional trailing constructor parameter** (following the existing
`businessTimeOptions` precedent) because branch **names** are a SQL-only fact and **the MCP host has no
SQL** (L113). There it resolves to `WarmedBranchDirectory`, an `IMemoryCache` view populated by the
warm-context POST that fires while the phone is still ringing. Absent ⇒ the rejection simply does not
name branches, exactly as before.

**Absent availability rows mean INHERIT, never CLOSED** — `BranchAvailabilityResolver`
(`EffectiveHours` / `SearchUnion` / `SameSchedule` / `BranchIdsWithOwnHours`). A branch with no own row
follows the business grid; it is not shut.

### Sabotage-verified

Disabling branch naming (`if (branches.Count < 999)`) made
`CreateBooking_OutsideHoursWithDifferingBranches_NamesEachBranchAndItsHours` **fail** while the
single-site test correctly still passed — proving the pair is directional, not decorative. Restored and
re-verified green.

### ‼️ Live-call watch is re-authorized on a cadence, server-side (L120, edge case 11)

Authorizing only at JOIN left a member **suspended mid-call** still receiving the transcript, because
SignalR group membership has no TTL. `NotificationHub.StartVoiceWatchRevalidation` now re-checks the
**cached** authorization snapshot every `SignalRSettings:VoiceLiveWatchRevalidationSeconds` (default 60)
and removes the connection from `voicelive:{businessId}` itself.

**The server drives it**, so a client that simply stops calling in cannot evade it — that is what makes it
a control rather than UX. It needs **no distributed cache**: a SignalR connection is server-affine, so the
server that owns it can act on it. Only *finding* a connection owned by another server would need shared
state, and nothing here does.

‼️ `IAuthorizationSnapshotProvider` is **scoped** — the loop resolves it per pass via
`IServiceScopeFactory`. Capturing the hub's injected instance would be a captive dependency.

A warm snapshot check costs **zero SQL**, which is what makes a cadence affordable at all (L61).

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). Voice under teams: the final state.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.**

**Phase 9 changed NOTHING in the voice stack.** This section is the closing inventory, plus the one
sensitive-operation change that touches voice.

### ‼️ `voice.number.manage` is a SENSITIVE OPERATION with ZERO endpoints today

`Clinqet.Shared.Constants.SensitiveOperations` lists seven permission keys that must re-verify against
**live SQL** rather than the ≤60 s cached snapshot (H2). Two of them — `voice.number.manage` and
`payout.export` — are **catalogue keys granted to roles but carried by no controller.**

**Not a hole** — an unreachable permission grants nothing. But ‼️ **the day a voice-number endpoint appears
it MUST carry `[RequiresPermission(..., RequiresLiveAuthorization = true)]`**, and
`ProviderEndpointAuthorizationTests` will **fail the build** until it does. `00-SOLUTION` §7.4 names
voice-number changes explicitly as a sensitive operation; **transcript viewing deliberately is not**.

### ‼️ The live-watch group is BUSINESS-keyed, and this fixed a total break

`NotificationAudience.VoiceLiveWatchGroupName(businessId)` → `voicelive:{businessId}`.

The SEND side was **already** business-keyed — `VoiceSessionMonitor` / `PlivoVoiceRelay` →
`BroadcastTranscriptAsync(session.BusinessId, …)` → `InternalVoiceTriggerController` →
`SignalRNotificationService` → `voicelive:{businessId}` — while `NotificationHub.WatchVoiceLive()` joined
`voicelive:{UserNumber claim}`. **Phase 1 made those values differ, so for every tenancy-path business the
provider watched an EMPTY group and no live transcript ever arrived. No test covered it.**

**Found by tracing the group name end to end**, not by reading the phase file's description of it.

`WatchVoiceLive()` now reads the signed `BusinessId` claim and requires **`voice.livecall.join`** plus
`BusinessAccessScope.Full`, resolved through the **cached** `IAuthorizationSnapshotProvider.GetAsync` (L116)
— a warm check costs **zero SQL**, which is the property that makes a revalidation cadence affordable.
‼️ **`UnwatchVoiceLive()` is deliberately NOT permission-gated**, so a membership that just lost the grant
can still unsubscribe.

‼️ **ZERO client change was needed, and `PHASE-07` §6's claim that both provider apps must be updated is
FALSE.** `clinqetwebpartnerapp/src/services/signalRService.js` and
`clinqetmobilepartnerapp/src/services/signalRService.ts` both `invoke('WatchVoiceLive')` with **no
arguments** — the group name is derived server-side, and `grep voicelive` across both apps returns **zero**.

### ‼️ Mid-call revocation IS met, and it needs no distributed cache (L120 supersedes L116)

`NotificationHub.StartVoiceWatchRevalidation` re-checks the **cached** snapshot on an appsetting cadence —
`SignalRSettings:VoiceLiveWatchRevalidationSeconds`, default **60 s** — and **the SERVER** calls
`IHubContext.Groups.RemoveFromGroupAsync`. Because the server drives it, **a client that simply stops
calling in cannot evade it** — that is what makes it a control rather than UX.

L116 had recorded edge case 11 as **not met**, reasoning that force-removing a live connection needs shared
cross-instance state. ‼️ **That reasoning was wrong in one respect: a SignalR connection is SERVER-AFFINE**,
so the server that owns it can act on it with no shared store. Only *finding* a connection owned by another
server would need one, and nothing here does.

Three alternatives rejected: a **distributed cache / Redis** (a new Azure resource, ARM + `deploy.ps1`, and
L61's decision is not one phase's to make); a **client-side heartbeat** (client-cooperative, so a modified
client keeps streaming); a **whole-connection max-age abort** (would force every client on the platform to
reconnect periodically and re-fire `SendHistoricalOnConnect` — duplicate toasts for every user to fix one
voice edge case).

‼️ **`IAuthorizationSnapshotProvider` is SCOPED**, so the loop resolves it per pass via
`IServiceScopeFactory`. Capturing the hub's injected instance would be a **captive dependency**.
Sabotage-verified: removing the `StartVoiceWatchRevalidation` call failed
`WatchVoiceLive_WhenAccessIsRevokedMidCall_ServerRemovesTheConnectionFromTheGroup`.

**What remains deferred is only the UX of telling the removed watcher WHY** — client work.

### ‼️‼️ THE MCP HOST HAS NO SQL. This is the single most important architectural fact here.

Verified: `clinqetmcp\Clinqet.Mcp\Program.cs` contains **no `AppDbContext`, no `AddDbContext`**, and none of
`AddTenancyServices` / `AddTenancyAuthorization` / `AddNotificationRouting` / `AddBranchResolution`.
It is **Cosmos-only**, plus Service Bus and the internal HTTP seam. **No earlier plan document stated this.**

Consequences a later phase must not rediscover the hard way:

- Anything living **only** in SQL — `BusinessMembership`, `BusinessBranch` (branch **name**, `IsActive`,
  `IsDefault`), seats, entitlements, the authorization snapshot — **cannot be read here.**
- `IBranchResolver` / `BranchResolver` **IS** usable (Cosmos-only: `IServiceAreaRepository` +
  `IMemoryCache`). ‼️ **`IBranchDirectory` / `BranchDirectory` is NOT** — it needs
  `IDbContextFactory<AppDbContext>`.
- The host has a **bidirectional** internal seam with the Main API guarded by `X-Internal-Api-Key`: it
  EXPOSES `/internal/{Mcp:SecretPath}/{warm-context, active-calls, provider-join}` and CALLS the Main API's
  `/api/v1/internal/voice/live-event`. ‼️ **That seam, not a new dependency, is how SQL-only facts get here.**
- ‼️ **`IFullProviderContextService` is registered in BOTH this host and the Functions host** —
  `PlivoVoiceRelay` (India) builds the first prompt HERE, while `VoiceCallControlFunction` and
  `RealtimeCallWebhookFunction` (Telnyx, CA/US) build it in the Functions host. **Any change to the AI's
  embedded profile must be correct in both.**

### Branch identity reaches MCP inside the warm-context POST that already fires (L113, ✅ owner-approved)

The Functions host (which has SQL) resolves `(BranchId, Name, IsDefault)` and adds an **optional `branches`
array** to the existing `/internal/{secret}/warm-context` body, which stores it **before** triggering the
warm. `Clinqet.Mcp\Context\WarmedBranchDirectory` implements the **same** `IBranchDirectory` over
`IMemoryCache` (`Size = 1`, TTL `Mcp:ProviderContextCacheMinutes` = 5), so `FullProviderContextService` is
**host-agnostic: one code path, two transports.**

**Costs: zero new HTTP calls** (`McpSessionSignalClient.WarmProviderContextAsync` already runs,
fire-and-forget, at provider-dial time), **zero new Azure config**, **zero schema.**

‼️ **The wire body stays BYTE-IDENTICAL below two branches**, because the serializer uses `WhenWritingNull`.
That was deliberate: adding `branches` broke `WarmProviderContextAsync_Success_Posts...`, which pins the
exact body — and **keeping the wire identical beat editing the test.** An existing test that changes
meaning is a red flag; this one did not have to.

‼️ **Degradation is SAFE BY CONSTRUCTION:** no `branches` in the body ⇒ empty cache ⇒
`FullProviderContextService` resolves the permissive hours **UNION**, never "closed".

Two rejected alternatives: registering `AppDbContext` in MCP (a SQL connection string per region in ARM +
`deploy.ps1`, EF startup inside a latency-critical voice host, and it destroys MCP's clean Cosmos-only
property); a dedicated branch-lookup endpoint (a second HTTP call during the ring for data this one carries
free).

### ‼️ THE AI-FACING SHAPE (L114) — four rules a later phase must not undo

The owner's binding condition on L113 was *"make sure it is super easy and not confusing at all for AI …
fully end to end"*:

1. **At 0 or 1 branch, and whenever every active branch resolves to the SAME grid, the branch block does
   not exist** — no key, no sentence, no token. **The model never learns the word "location".**
2. **`WeeklyAvailability` IS the default branch's hours**, pre-resolved — so every existing instruction
   sentence ("Working hours are in the profile below", the earliest-slot rule, the 9pm-vs-close rule) stays
   true **with no rewording**, and §8.6 case 14 ("answer for the default branch") falls out for free.
3. **`ProviderContextLocation` carries a NAME and finished HOURS** — no id, no `isDefault`, no "inherits"
   marker, no nulls. The model reads an **answer**, never a rule it must apply.
4. **Only branches that actually DIFFER from the default are listed.**

**Rejected:** a `branches[]` array beside `weeklyAvailability` — the model would have to JOIN two
structures to answer "are you open?".

‼️ **A branch list can never be large, so it is always EMBEDDED and must never get a lookup tool** — the
opposite conclusion to `GetPublicCatalogCountAsync` / the `EmbedThreshold = 60` regime, and for the right
reason.

‼️ **Prompt-token cost: ZERO at 0/1 branch and zero when branches share hours**; roughly 15-25 tokens per
**differing** location.

### Per-branch hours on the voice path

`BookingTools.EvaluateWorkingHours` (both call sites) resolves through
`Clinqet.Core.…BranchAvailabilityResolver`, and `BookingTools.DescribeBranchHoursAsync` **names which
branches are open and when** (05-BRANCHES §8.6 case 9).

> ‼️ **`effectiveHours(B) = rows WHERE branchId = B ELSE rows WHERE branchId IS NULL`.
> ABSENT ROWS MEAN INHERIT, NEVER CLOSED.** An explicit `isAvailable = false` row is how a branch is shut.
> **This is the single most dangerous regression in the feature** and has been sabotage-verified in three
> separate sessions.

‼️ **§8.6 case 9 is largely MOOT on the voice path anyway** (L117): a phone booking carries no
`serviceAreaId` and no service address, so the serving branch is **unknown** and **case 10** is the
operative rule — validate against the **UNION**, let a human assign the branch later. And ‼️ **the Main API
booking path deliberately does NOT validate working hours at all** — `BookingService` and
`BookingController` never reference `IAvailabilityRepository`, so adding it would start **rejecting
bookings both customer apps currently create successfully.** Out of scope without its own mandate.

‼️ **`05-BRANCHES` §8.4 named `Services\AI\McpService.cs` as a site that must "answer for the named branch".
WRONG FILE** — it uses `IAvailabilityRepository` only to WRITE extracted hours during document-intelligence
onboarding and to test `.Any()` for onboarding progress. Corrected in §8.4.

### Voice under teams — the rest, briefly

- **A voice-taken booking is stamped `BusinessActorType.System`**, never a human member (L29/L115), so it
  can never look like Sarah made it. ‼️ **But it writes no ACTIVITY row today** — only the Main API
  registers `AddBusinessActivityFeed()`. The provider apps render a *Clinket AI* pill for `System` anyway
  (**AD6**), so a future row can never read as an employee's action; **wiring the feed into this host is the
  switch, and a cost decision.**
- **Voice minutes are ONE shared business pool** — `MinuteLedger.BusinessId`, and `VoiceMinuteCapReached` is
  keyed `ForBusinessPeriod(businessId, "yyyy-MM", …)`. Five members draw from one pool; a contractor in two
  organisations bills each separately.
- **The MCP per-call token stays bound to one business.** `McpChannelAuthMiddleware` rejects unless
  `session.BusinessId == claims.BusinessId`; `PlivoVoiceRelay` performs the same check against the binding
  document. ‼️ **The platform's oldest tenant guard — extended, never relaxed.** Cross-tenant tests are
  present and green: `CrossTenant_FindBookingWithForeignNumber_NotFound`,
  `CrossTenant_VerificationAgainstForeignBooking_NotFound_NoCodeSent`.
- ‼️ **`FullProviderContextService` sets `Size = Math.Clamp(1 + services/25, 1, 64)`, NOT `Size = 1`** — a
  deliberate, commented exception, because a flat 1 let a large catalog occupy an entry the shared
  `SizeLimit` believed was tiny. `MemoryCacheSizeConventionTests` requires **a** size, not literally 1.
  **Do not "fix" it.**
- **Live phone-call verification was never performed** — it cannot be done from a development environment.
  The code paths are verified; the live call is not. Stated rather than claimed.

---

## PHASE 10 PART 1 — THE DATA/SCHEMA/PERSISTENCE AUDIT (2026-08-04)

> Phase 10 is the first **AUDIT** phase (10-14 FIND AND FIX). Part 1 ran four of the seven sweeps and
> fixed two live defects. ‼️ **Phase 10 PART 2 is the FINAL part** and owns S1 (orphan), S4
> (index-binding), S6 (persistence), the N+1 half of S7, and FINDING 3.
> **Baseline after Part 1: 13,802 passed / 0 failed / 0 skipped across all nine suites.**

### ‼️ Two live defects found and fixed

**1. Eight voice-lifecycle notifications reached the wrong Cosmos partition; two reached NOBODY (DA1).**
`VoiceAssistantService.DispatchPartnerNotificationAsync` and `DispatchNumberLifecycleNotificationAsync`
passed `RecipientUserNumber = profile.BusinessId` to the **raw single-recipient** `ICommunicationDispatcher`.
A `BusinessId` is not a `UserNumber`, so `NotificationProcessor` wrote the in-app document into a
`Communications` partition **`NotificationController` never reads**, push tagged `userNumber:{businessId}`
(zero devices) and SignalR targeted `notif:{businessId}:Provider` (zero connections). Email was the only
surviving leg — and **`VoiceAssistantActivated` and `VoiceAssistantRejected` carry no email template**, so
those two reached nobody at all.

‼️ **`NotificationRoutingCatalog` already classified all eight as `Business`/`BusinessSecurity`** — the
catalogue and the producer disagreed, and the catalogue was right. **The fix:**
`IBusinessCommunicationDispatcher`, a per-recipient factory, and a durable `EventId`
(`BusinessEventId.For("voiceassistant", businessId, type, VersionOf(profile))` — **L88**), with the
**L94** guard retained because the profile mutation is already committed.

‼️ **How it hid, and the rule it produces:** Phase 7's producer sweep was scoped to the **Functions host**
and evidenced by a 68-row table of `[Function]` attributes. This producer is an infrastructure **service**
and could not appear in it. **A sweep bounded by a directory or an attribute is bounded by the wrong
thing** — casebook **CASE 21**.

**2. Deleting a team orphaned booking 101+ onto the deleted team (DA2).**
`BusinessTeamStructureService.ReleaseTeamBookingsAsync` read exactly one page —
`GetAssignedToTeamAsync` is bounded by `CosmosDb:MaxItemCount` (100) per **L84** — and neither looped nor
reported a ceiling, while `DeleteTeamAsync`'s own comment states the invariant it was breaking
(*"a conversation pointing at a team that no longer exists would match no view at all"*). Now a drain
loop bounded by the existing `Tenancy:Lifecycle:MaxReassignmentItems` (1000), logging a Warning at the
ceiling. ‼️ **A bound is only safe if the caller either DRAINS it or REPORTS it** — casebook **CASE 21b**.

### ‼️ What the sweeps CLEARED, and by what method

- **Cross-partition (S3): CLEAR.** `grep` for `PartitionKey.None` / `EnableCrossPartitionQuery` /
  `CrossPartition` across all seven backend projects returns **zero production matches**.
  `CosmosDbRepository`'s 14 data entry points all throw on a blank partition key, and the two that look
  unguarded (`ExecuteScalarQueryAsync(QueryDefinition,…)`, `GetFilteredItemsAsync`) delegate to guarded
  methods. ‼️ **19 of the 53 repositories do NOT derive from the base** and hold their own `Container`, so
  all **23** production `GetItemQueryIterator` call sites were enumerated individually — every
  `QueryRequestOptions` carries a concrete `PartitionKey`. ‼️ **`AdminAlertRepository.GetAlertsPagedAsync`
  is a per-MONTH fan-out of single-partition queries, not a cross-partition query**, despite a test whose
  name says "CrossPartitionQueries".
- **Migrations (S2): CLEAR.** All six tenancy `Up` blocks read line by line; every
  `DropIndex`/`DropColumn`/`DropTable`/`AlterColumn` accounted for. `SeedDbContext` matches
  `AppDbContext` for every column it declares, and every column it omits is nullable, DB-generated or
  defaulted. `cosmosindexsetup` applies all 8 container policies through `ReplaceContainerAsync`, so a
  re-run genuinely updates an existing container.
- **L81: CLEAR.** The only `c.branchId` query predicate is `BookingRepository.cs:439`, on `Transactions`,
  which **does** carry `/branchId/?`. `ProviderData` still needs none.
- **`UX_BusinessBranch_Business_Default`:** the index is correct (**filtered `[IsDefault] = 1`**, so many
  branches and at most one default) — **and it was completely untested until now.**

### ‼️ FINDING 3 — OPEN, owned by Phase 10 Part 2

The six provider-inbox conversation queries (`BuildUnassignedQuery`, `BuildAssignedToMembershipQuery`,
`BuildAssignedToTeamsQuery`, `BuildWatchedQuery`, `BuildAllForBusinessQuery`, overdue) are **unbounded
`SELECT *` over a business partition**, and `ProviderInboxService` pages them **in memory** with
`.Skip().Take()`. The bookings side got `SELECT TOP` in L84; conversations never did.

### ‼️ Traps for anyone touching this area

1. ‼️ **The API integration host has NO SQL container** (**L70**), so a business-routed notification
   resolves **zero recipients** and publishes **no `NotificationMessage` at all**. Assert against an
   injected dispatcher double, never against the emitted Service Bus message.
2. ‼️ **Ten `VoiceAssistantControllerIntegrationTests` assertions ENCODED THE DEFECT**
   (`n.RecipientId == businessId`). They are now `Assert.DoesNotContain(...)` regression guards.
   **When a fix turns a test red, ask FIRST whether the test was asserting the bug.**
3. ‼️ **Use `Clinqet.API.UnitTests.Helpers.BusinessDispatcherTestDouble`**, never
   `Mock.Of<IBusinessCommunicationDispatcher>()` — the real dispatcher invokes the per-recipient factory
   and a bare mock never does, so content assertions pass vacuously (casebook CASE 4).
4. ‼️ **`Bind for 0.0.0.0:8081 failed: port is already allocated` is INFRASTRUCTURE, not a regression** —
   a leftover Cosmos-emulator container. Run `docker ps` before believing a Testcontainers failure.
5. ‼️ **53 Cosmos repositories, not 52**; `Cosmos.cs` is **3,395** lines, not 3,331. Both figures are
   still quoted stale in `PHASE-10` §1. **Treat every inherited count as a hypothesis and measure it.**

---

## ‼️ PHASE 4 — KNOWLEDGE INGEST + SEARCH-INDEX RESILIENCE (2026-08-18)

The 2026-08-17 incident: a 792 KB JSON knowledge upload settled **Failed**. **Not a quota problem.** The
ingest sent every card of the document in **ONE** `/embeddings` request — 539 inputs, ~276,000 estimated
tokens — against Azure's **300,000-token-per-request PROTOCOL cap** (an HTTP 400 no backoff can clear), and
the retry then fired three times inside four seconds while Azure's body asked for 40.

### What changed

| Area | Now |
|---|---|
| **Request sizing** | `AzureAIFoundryEmbeddingService` is the ONE owner of the rule: batches split by input count **AND** an estimated-token ceiling (`AzureAIFoundry:MaxTokensPerRequest`, 40,000 — an engineering precaution, **not** a documented Microsoft rule). Per-input clamp, in-batch dedup, poison isolation, and **adaptive halving on a token-cap 400** (an over-size request is a 400, never a 429 — it must be SPLIT, never backed off) |
| **Retry** | Honours `retry-after-ms` AND `Retry-After` (delta **and** HTTP-date). 429 is split from 408/5xx; 400 is never retried. Bulk gets a real floor (`Retry429FloorMs` 4 s) and a 60 s per-attempt cap; **Interactive gets at most one fast retry, then degrades** |
| **Lanes** | `AiWorkloadLane.Interactive` (default) / `Bulk` on `IEmbeddingService` **and** `IAICompletionService`. Interactive **never** queues |
| **The pacer** | `AiBudgetGovernor` (`AiBudget:*`), process-wide singleton. **Header-driven**: it reads `x-ratelimit-limit-tokens` / `-remaining-tokens` / `-limit-requests` / `-remaining-requests` and treats the observed limit as authoritative; a configured per-minute ceiling is only a bootstrap. ‼️ Never build a timer on `x-ratelimit-reset-*` — Microsoft publish no units for it. ‼️ Per-PROCESS: a scaled-out Functions host multiplies the pace, and `retry-after-ms` is the backstop |
| **Batched change feed** | Single **Bulk** embeds coalesce into batched requests inside the embedding client (`BulkCoalesceWindowMs`). 5,000 change-feed services become ~100 requests, not 5,000. A sequential caller pays nothing: the buffer flushes as soon as every live producer is parked. ‼️ **Enrichment is NEVER batched** — one prompt per service, or listings cross-contaminate |
| **Throttle ≠ outage** | A surviving 429 is a typed `AiThrottledException` on the completion side and `AiFailureKind.Throttled` on the embedding side. It **bubbles**, so the document rides the retry ladder and comes back COMPLETE. An empty enrichment or a zero-vector is reserved for a genuine outage |
| **Which leg failed** | `IAzureSearchIndexer.IndexServiceAsync` returns `ServiceIndexOutcome` (indexed / enrichment degraded / embedding degraded / reason). A bare bool could not say which leg died, so no alert could name a reason |
| **Recovery order** | Degraded ⇒ the change feed enqueues onto `change-feed-failures` (silent). The replay processor retries with backoff. ONLY when its deliveries are exhausted does `SearchLegFailureAggregator` raise **ONE aggregated alert per leg**, with counts, a capped sample list, and an explicit "N more not listed" |
| **Chunking (D-04)** | A homogeneous array of objects **IS a table** — union of keys = header, each element = a row — so it rides the chunker's mature Table path. And a **line-structured** multi-line `Paragraph` keeps its line units instead of having its newlines collapsed. Measured on the real incident file: **539 → 316 cards, 55 warnings → 0, 1 request → 4, no card straddles a record** |
| **Provider notice** | `NotificationType.KnowledgeDocumentFailed` — **failure only, terminal outcome only**, routed to `voice.settings.manage` holders. In-app + push + SignalR; no email/SMS/WhatsApp. While the Knowledge page/screen is open it CLAIMS the event, refreshes silently and suppresses the toast; the bell and the push still land |
| **Compression** | Both vector indexes carry `bq-mrl`: binaryQuantization + `truncationDimension: 1024` + `enableRescoring: true` + `defaultOversampling: 10` + `preserveOriginals`. ONE definition, in `cosmosindexsetup/VectorCompressionProfile.cs`. ‼️ **Since search topology, PUBLIC plane only** — both private indexes (catalogue AND knowledge) are exhaustive KNN with NO compression (`cosmosindexsetup/PrivateVectorSearch.cs`) |
| **Index aliases** | The alias takes the name the apps already read; the physical index is `{alias}-{version}` (`Search:IndexVersions:{Kind}`, D-124). **Zero consumer, deploy.ps1 or ARM changes** |
| **`vectorFilterMode`** | Now set EXPLICITLY to `preFilter` on every filtered vector query. It was set nowhere, so every query ran on a default nobody chose. ‼️ **Public plane only** (`AzureSearchQuery`): private-plane knowledge queries set NO FilterMode — exhaustive KNN (D-2 branch A) |

### ‼️ Gotchas that cost something

- **A search-service 429 is NOT an Azure-OpenAI 429.** During indexing Microsoft document it as running low on
  storage — backoff never clears it. `SearchServiceStatusClassifier` keeps the two domains apart: 429 is
  excluded from the retry predicate and raises a capacity alert; 409/422/503/5xx retry; 400/403/404 do not.
- **‼️ NEVER enable `exhaustive: true`** on a vector query as a latency fix. It silently disables oversampling
  AND rescoring, which is the entire mechanism behind the compression decision. Re-open D-13/D-19 first.
- **NEVER `discardOriginals`** — measured here: pure-vector recall@10 68%, and the top result changed in 12 of
  20 queries. **NEVER `enableRescoring: false`** — Microsoft's own table drops MRL+BQ to 0.89.
- The embedding cache's `SizeLimit` counts ENTRIES while one 3,072-float vector is ~12 KB, so the entry cap is
  now derived from `Search:EmbeddingCache:MaxMemoryMegabytes`. Every `IMemoryCache` write still sets `Size = 1`.
- `AdminAlertSettings` moved to `Clinqet.Shared.Models` so the indexer and the enrichment failure tracker are
  gated by the SAME appsettings regime as everything else. There is no longer a cooldown-only regime.

---

### ‼️ ADDENDUM 2026-08-27 — knowledge-image programme items 2/4/5/6/7/8/3 built (audit still owed)

Full line-by-line record: `C:\Nik\knowledge-image-extraction\SESSION-2026-08-27-CHANGES.md`.

- **Config trap closed.** The API and MCP `Voice:Knowledge` blocks each configured 49 scalars.
  Every configured value was **verified programmatically to equal its class default before a
  single key was cut**, so the trim is a runtime no-op. The API reads **16** keys (not the seven
  the earlier note claimed — `KnowledgeManagementService`, `KnowledgeContentArtifactStore` and
  `KnowledgeDraftApprovalService` read nine more); MCP reads **20**. A convention test in each
  host now pins the block to exactly the keys that host consumes, and §0.12 value parity.
  **Use those tests as the settings audit; never hand-check parity.**
- **PDF extraction losses alert.** Three counters replace one; only genuine losses raise ONE
  admin alert per document (`KnowledgeImageExtractionLoss`), and a whole-binder failure now
  counts every stripped picture instead of logging silently.
- **Two PDF/image defects fixed, both MEASURED not assumed:** PdfPig returns the placed rect
  INVERTED on `/Rotate` 90 and 270, which made every figure on a rotated page pay for a DI crop
  while its own raster was materialized again beside it (duplicate pictures, double vision
  calls); and a CMYK JPEG was stored byte-identical as CMYK, which some decoders render inverted
  — and the re-encode branch alone re-encoded it back to CMYK because the encoder infers its
  colour type from the decoded image's metadata.
- **`ImageLaneResult.Empty`/`.Faulted`** are fresh instances, not shared statics holding mutable
  collections.
- **‼️ STILL UNPROVEN** (the next session's starting list): `/Rotate` inherited from `/Pages`;
  several rasters on one rotated page; mixed rotations; whether Document Intelligence really
  reports the ROTATED page size (the tests assume it does); YCCK; a real Adobe APP14 CMYK JPEG;
  and §5 step 9 — no human eye has watched a migrated tile fall through to its next source in a
  real browser.

## Sessions 4–5 (2026-09-01/02) — AI cost programme: knowledge ingest vision + attempt budget (BUILT + TESTED; owner deploys)
- Attempt budget (§12.2 F-C): `KnowledgeIngestProcessorFunction.Run` binds an ambient `AiAttemptBudgetScope` per delivery (Voice:Knowledge:AiAttemptBudgetPerDocument 6000 / RetrySettings:MaxDeliveryCount 5). `AICompletionService` consumes one unit per HTTP attempt; a refusal throws `AiAttemptBudgetExhaustedException`; the wrapper fires `AdminAlertType.AiAttemptBudgetExhausted` (L15) on complete / abandon / dead-letter. `AiAttemptBudgetConventionTests` pins slice >= (1 + MaxImagesPerDocument + MaxPagesPerDocument) x 2 cutoff passes x (AIService:MaxRetries + 1). ‼️ Superseded 2026-10-01: the budget is 23,500 and the convention counts section reads and one picture pass per delivery (clinqet-function-app, "Post-ranking follow-ups").
- Vision transcription (plan §3, mode Always, luna @ Medium): every Document Intelligence caller (ingest `ExtractAsync`, draft re-derive, setup reader) routes the DI markdown through `IVisionDocumentTranscriptionService` (page rasterizer — Docnet.Core then, PDFium through the own binding `Services/AI/Pdfium` since W2 2026-09-30 -> `IVisionPageTranscriber` per page -> splice on `<!-- PageBreak -->`, DI figure anchors carried as empty `<figure></figure>`), cached as blobs `_ocr/{businessId}/{docKey}/{contentHash}/{deployment}/v{PromptFingerprint}/pNNN.json` (lifecycle by last use: Cool after 30 d unused, delete after 180 d unused; deleted by `KnowledgeDocumentDataPurger.PurgeAsync`; swept by `BusinessClosureTeardown` in both containers). Settings: `Voice:Knowledge:Vision` (FN, 900 s) and `AIAssistant:ProviderAttachmentProcessing:Vision` (API, 300 s). Character gate `MaxExtractedCharacters` 2600000 in both lanes (`Error_KnowledgeTooManyCharacters`, `Error_ProviderSetupTooManyCharacters`). Sub-flows F3-knowledge-transcribe-vision / D4-setup-transcribe-vision.
- `.heif/.heic` are refused in BOTH lanes. `Voice:Knowledge:Images:Enabled` no longer exists (F3 deleted 2026-09-01); pictures and .webp/.gif/.pptx are always on.
- Session 5 finished Phase 4 with fail-first tests (every one proven RED by an exact-line sabotage of the production code, then reverted): FN `Knowledge/DocumentPageRasterizerTests` (9), `VisionPageTranscriberTests` (12), `VisionDocumentTranscriptionServiceTests` (12), `KnowledgeIngestProcessorFunctionTests` character gates (+5), `KnowledgeServiceDraftAnalyticsJobTests` re-derive (+1); FN integration `Tests/Services/KnowledgeOcrPageCacheIntegrationTests` (real Azurite: a redelivery reads every page from the cache and transcribes nothing, a bumped `TranscribePromptVersion` misses and banks beside the old pages, the setup lane banks under `provider-setup-docs`), `_ocr` purge in `KnowledgeIngestDeletionIntegrationTests`; API `ProviderSetupDocumentReaderTests` (+5), `McpServiceTests` character-cap alert (+1). The red `KnowledgeServiceDraftAnalyticsJobIntegrationTests` was a test-side Moq trap since session 3 (an optional parameter omitted from a `Setup` binds to a null constant in the expression tree ⇒ no match ⇒ null return): every optional parameter is now matched explicitly.
- Live LOCAL proof (real Docnet + Document Intelligence + luna, 2026-09-02; 9 pages: a 5-page pixel-only PDF with EN dense / menu / Hindi / Gujarati / small-print pages, the Gujarati scanned PDF, the Gujarati and Hindi flyers, a real photo): service names found 164→194 of 194 after vision, prices 190→190 of 190, no price DI had was lost; DI rendered the Gujarati flyer as Devanagari garbage, vision returned the Gujarati script exactly; 0 page failures, 0 alerts, 0 cut-offs; median 10 s per page (max 19 s), ≈2.5–3.6k input + 0.5–1.2k output tokens per page, $0.014 for the 9 pages (≈$0.0015 per page at luna pricing). Harness command `p4vision` (`P4Vision.cs` beside the `ai-cost-quality/test-harness` copy in the session-5 scratchpad; recreate from `SESSION5-HANDOVER.md`).
- Every terminal failure in `KnowledgeIngestProcessorFunction` is `throw await TerminalFailureAsync(...)`; the statement-form wrapper `FailTerminalAsync` is gone. `ProviderSetupDocumentReader` no longer carries the unreachable `.tif` branch (only `.tiff` is accepted).
- Upload pre-flight (plan §3.7) shipped on partner web + partner mobile (mockup gate WAIVED by the owner — a recorded exception); rules in the `clinqet-partner-app` / `clinqet-provider-mobile` skills (2026-09-02 sections).
- `KnowledgeSearchIndexer` deliberately has NO Polly layer: the router hands it a default-options `SearchClient` from `AiSearchClientFactory`, so Azure.Core's built-in retry (3 attempts, exponential back-off, 408/429/5xx) already covers `IndexDocumentsAsync`; `AzureSearchIndexer`'s Polly wraps a multi-step process (embedding + geocoding + upload). A second stack would be layered manual retry.
- Still owed after session 5: proofs against the DEPLOYED environment (owner deploys first), Docnet's `pdfium.so` executing on the Linux hosts themselves (the CI-shape publishes of both hosts were run locally on 2026-09-02 and place the native where .NET probes: API RID publish → app root; Functions portable → `runtimes/linux/native/`). ‼️ Superseded 2026-09-30: Docnet is removed (W2); the bblanchon PDFium native loaded inside a Linux container in the W1 memory proof (`Data/post-ranking-followups/findings/W1-MEMORY-PROOF.md`).

## Gate 3 audit (2026-09-02) — the knowledge vision contract as it now stands
- ‼️ **The per-page cache key carries the MODEL**: `_ocr/{businessId}/{docKey}/{contentHash}/{deployment}/v{PromptFingerprint}/pNNN.json`. Changing `TranscribeDeploymentName` MISSES the cache and banks beside the old model's pages — the same trap the search enrichment hash closed by including its deployment. `TranscribePromptVersion` alone never covered a model swap.
- ‼️ **A DEGRADED vision pass is recorded and retried, never frozen.** `VisionDocumentTranscription.Degraded` (time budget expired · unrenderable file · pages the model could not read) rides `KnowledgeExtractionOutput.VisionDegraded` into `KnowledgeContentArtifact.VisionDegraded`. A FRESH delivery (`deliveryCount <= 1`) re-extracts — so Try-again and Reindex really do re-read the pages the alert says they will — while a redelivery of the same attempt still replays the artefact. Same shape as `ImageLaneDegraded`.
- ‼️ **A blank Document Intelligence result is judged AFTER vision, in BOTH lanes.** Vision exists to read exactly the documents DI cannot; refusing on empty OCR first threw away the only reader that could have read them. Blank after vision too is still a terminal `Error_KnowledgeUnreadable` / `Error_ProviderSetupNoTextExtracted`.
- **The rasterizer takes a page ceiling and REFUSES past it** (`RasterizeAsync(..., int maxPages, ct)`), never truncates: half a transcript reads worse than the OCR text the caller keeps. Each lane passes its own cap (`Voice:Knowledge:MaxPagesPerDocument`, `ProviderAttachmentProcessing:MaxPdfPages`). This is the last bound for a file whose page count neither the free pre-count nor DI could establish.
- ‼️ **`RasterizationOutcome(Pages, Refusal, PageCount)` — the refusal REASON is part of the contract.** An unrenderable file and a document past the page cap are different causes with different dials, so they raise different alerts: `VisionRasterizationFailed` (naming `PageRenderMaxEdgePixels`, and saying no dial changes it) versus `VisionPageCapExceeded` (naming the lane's page cap and quoting the real page count). Returning a bare empty list for both made the page-cap refusal borrow the unrenderable alert and tell ops to look at the wrong dial.
- **Page tallies are exclusive**: transcribed + fromCache + keptFromOcr == the page count. A page the model reads as `NO_TEXT` belongs to keptFromOcr only. `PagesUnreadable` counts hard failures plus twice-truncated pages (its transient part is `PagesFailedTransiently` since 2026-09-25 — see P4-B-21 at the top), and `Degraded` is derived from it; a truncated page raises only its own budget alert (naming the token dial), never a second one naming the deployment.
- **The TIFF decode ceiling bounds the whole file** (width × height × frames), because `LoadAsync` materialises every frame at once.
- `AIService:ImagePromptTokenEstimate` (3000) is what the AI budget governor charges for ONE embedded image. Measuring the base64 length at one token per four characters priced a rendered page near 150,000 tokens and stalled the bulk lane.
- `Voice:Knowledge:StaleProcessingMinutes` is **560** (2026-09-30; was 330, before that 160) — it must exceed the longest LIVE reading, (1 + `MaxReadingContinuations` + `Images:MaxPicturePasses`) deliveries × `IngestTimeoutSeconds` plus the retry back-off, or Reprocess is accepted on a row whose ingest is still legitimately running.
- ‼️ **(2026-09-02) A typed FAQ can no longer be stuck at all.** `CreateFaqAsync` indexes the cards FIRST and then writes the row ONCE already `Ready` with its `PassageCount` — the only writers of `Processing` left are `ConfirmUploadsAsync` (×2) and `ReprocessAsync`, all File-only. A failure now leaves cards with no row, and cards without a row are INERT (the retrieval allow-list is built from rows); both branches purge them on `CancellationToken.None`, and a failed purge raises `KnowledgeOrphanFaqCards` against `Voice:Knowledge:MaxPassagesPerBusiness`. No added latency — the create was already synchronous, and this is one Cosmos write instead of two.
- ‼️ **(2026-09-07: `ListRetrievableDocIdsAsync` is GONE — the `ListReceptionistGatesAsync` sweep applies `KnowledgeAnswerableRule` (Ready only) plus the two receptionist bits in C#; read those two classes, not this paragraph, for the current rule.)** **`ListRetrievableDocIdsAsync` excluded `Failed` as well as `Deleting`** — a failed document could still answer callers from whatever fragments reached the index, against the enum's own "Failed means 0%". ‼️ **`Processing` is deliberately STILL retrievable — DECIDED 2026-09-02, do not "fix" it.** Cards are written in ONE batch immediately before the `Ready` flip, so a first ingest holds ZERO cards for essentially its whole `Processing` window; and a replace/reprocess keeps the OLD cards live by design (`KnowledgeIngestProcessorFunction.cs:883` calls it a **"gapless swap"**), so excluding `Processing` would take every replaced document silent for the entire re-ingest while preventing nothing. `Processing` means "a newer version is coming", not "this content is wrong". Proven against a real Cosmos emulator in `Clinqet.Mcp.IntegrationTests` (§0.18 — MCP is the only runtime consumer).
- ‼️ **§2.5f (2026-09-02): TEN paths can leave a row reading `Processing`, and every one now raises `KnowledgeStuckProcessing` naming that dial.** Five in `KnowledgeIngestProcessorFunction` (non-`File` row on the queue · a final delivery whose `Failed` write fails · a body that is not JSON · a body with no usable identity · a non-canonical identity) and five in `KnowledgeManagementService` (upload / replace / reprocess each commit `Processing` and only then enqueue, so a failed send strands the row — the Service Bus alert names the QUEUE, never the document · a typed FAQ whose indexing and whose `TryPurgeFaqAsync` both fail · `FinalizeFaqRowAsync` losing three consecutive CAS races, which writes no status at all). ‼️ **`ReprocessAsync` refuses any non-`File` row — but `ReindexAsync` + `POST /api/v1/admin/search/reindex-knowledge/{businessId}/{docId}` (admin) repair a stuck typed FAQ inline** (it refuses only `Deleting`), so the loop closes: alert → admin reindex → `Ready`. The alert names THAT endpoint for a non-`File` row and Reprocess for a `File` one. Tests: FN `KnowledgeIngestProcessorFunctionTests` (5) + API `KnowledgeManagementServiceTests` (4, the API host being the runtime consumer, §0.18).
## ‼️ SESSION C (2026-09-05) — THE VISION LANE IS NO LONGER ALLOWED TO LOSE A FACT (EX-04/05/09/12/15/20, #9)

**The defect, measured on LIVE data, not reasoned about.** The vision transcript replaced Document
Intelligence's reading of a page whenever it was non-empty. Across the **10 live vision-lane files** (2 PDFs
and 8 photos — images take the same lane): **38 facts lost, 9 invented, 4 of the 8 readable files damaged.**
On one provider's supplement label the model deleted **7 whole rows** (iron, vitamin C, B12, magnesium),
turned **0.138 g of fat into 0.398 g**, rewrote the provider's own words (`Ajmo`→`Ajwain`, `Jeeru`→`Jeera`,
`Sanchal`→`Saindhava`) and dropped the product name and "200 gm". All accepted, silently, because the answer
was not empty.

### The three layers, each measured, each doing a different job

| Layer | Where | Measured effect |
|---|---|---|
| **1. GROUND the model** | `VisionPageTranscriber.BuildPrompts` — the machine reading rides the **SAME call**, fenced as untrusted data with angle brackets neutralised (finding #10 / EX-13's fence) | invented **11 → 0**; every wrong value on the live label corrected |
| **2. Check, then RE-ASK ONCE naming what it left out** | `VisionDocumentTranscriptionService` | facts lost **40 → 1** |
| **3. GATE it** | `DocumentTranscriptComparer` — rows and clauses ALIGNED, then a typed diff; disagreements go to `gpt-5.6-sol` (replaced the page-wide bag 2026-09-10) | net **0 lost, 0 invented** |

‼️ **Telling the model to be careful does NOTHING.** A prompt-only variant ("transcribe EVERY row") measured
*worse* than the baseline (42 vs 40). Only grounding and the gate moved the number.

‼️ **The model is NOT reproducible.** The same page, same prompt, same settings, twice, gave 31 lost facts
and then 12. That alone is why the gate is mandatory rather than a nicety.

### ‼️ CHARACTERS ARE NOT A FIDELITY MEASURE (D15) — never use a coverage ratio on length

A faithful transcript of the live `AutoFix_Price_List.pdf` lost **32.5% of its characters and not one fact**:
an HTML table becoming a pipe table is a huge character loss and a perfect transcription. The audit's own
recommended "minimum text coverage ratio" would have failed that good page. **Conserve FACTS.**

- **Numbers: exact, zero tolerance, count-sensitive.** A figure written twice and returned once has lost a
  column. A number is spoken aloud to a caller; there is no acceptable loss.
- **Words: a floor, not exact.** Measured: every complete page scored **1.00**, every incomplete one
  **0.20–0.68**. 0.95 sits in an empty gap with margin both ways.

### ‼️ THE PAGE IMAGE DROPPED TO 1024 px, AND THAT IS WHY THE FIX IS CHEAPER THAN THE BUG

The page image is ~90% of the bill. A grounded model reads *layout* from the image and its *characters* from
the machine reading, so 2048 px bought nothing. Measured totals over the live corpus:

| | tokens | facts lost | invented |
|---|---|---|---|
| Today (2048, ungrounded) | 24 131 | 38 | 9 |
| Grounded 2048 | 25 574 | 10 | 0 |
| Grounded 1536 | 23 526 | 10 | 0 |
| **Grounded 1024 (shipped)** | **16 455 (−32%)** | 10 | 0 |

Even with the re-asks the shipped shape lands **below** the old cost. ‼️ Every dial is in appsettings so a
degradation is corrected without a deploy: `PageRenderMaxEdgePixels`, `ReferenceMaxChars`,
`MaxConservationRetries` (clamped to 3 in code whatever the dial says), and the 2026-09-10 comparison/verification dials: `MaxUnitsPerPage`, `MaxTokensPerUnit`, `AlignmentWindow`, `MinUnitSimilarity`, `MaxDiscrepanciesPerPage`, `MaxComparedTextCharacters`, `MinMissingContentWords`, `VerifyDeploymentName` (`gpt-5.6-sol`), `VerifyReasoningEffort`, `VerifyMaxCompletionTokens`, `VerifyTimeoutSeconds`, `VerifyPageRenderMaxEdgePixels`, `MaxVerifiedPagesPerDocument`, `MaxDiscrepanciesPerVerification`, `MaxDiscrepancyExcerptCharacters`, `VerificationAlertReplaySchedule`, `MaxReplayedVerificationAlertsPerSweep`. ‼️ `MinTextConservation` was REMOVED — the coverage floor it set is not how the gate works any more. All of these feed `ValidationFingerprint`, which the page cache entry carries.

‼️ **`TranscribePromptVersion` is part of the page-cache key and was bumped 1 → 2.** Change the prompt and
bump it, or banked pages from the old prompt replay for ever. Only CONSERVED pages are ever cached.

### The paths that must NOT change, and are pinned

| Situation | Behaviour |
|---|---|
| Document Intelligence read **nothing** (2 of 10 live files) | No baseline ⇒ vision accepted **unconditionally** |
| Model returned **blank** | Page keeps the machine reading, **not** a rejection, **no** alert, **no** re-ask. ‼️ A sabotage PASSED here because the merged text is identical either way — only the counter and the alert distinguish it |
| Model **truncated** by the token budget | Unchanged: keeps the machine reading, its own alert |
| Transcript reads **more** than the machine did | **Kept.** Only what went MISSING fails; otherwise every scanned page vision exists for would be refused |
| A page is **rejected** | Keeps the machine reading, counted in `PagesRejected`, alerted — and deliberately **NOT** `Degraded`: the page holds correct text, and re-running a non-deterministic model to win back a nicer LAYOUT spends money for nothing |

### EX-09 — a figure goes back where it stood, and keeps its own words

`CarryFigures` used to append **empty** `<figure></figure>` anchors at the page end, so a photo beside
"Model X | $500" was filed under the page's last heading and its own text was thrown away. Now each anchor is
spliced back after the line it followed. ‼️ **Order is load-bearing** — the PDF image lane binds markers to
DI's figures by reading-order ordinal — so the insert position is clamped to never overtake the previous
figure. A figure that OPENED the page goes to the FRONT (appending it put a product's name after the whole
nutrition table). ‼️ **Exact match before containment**: "Line 1" contains-matches an anchor of "Line 10".
‼️ **A figure's own text is excluded from the conservation baseline** — `CarryFigures` preserves it, so
holding the transcript to it rejected good pages for text that was already safe. The two fixes must compose.

### EX-05 + EX-20 — the model is told which words are the provider's

Every passage carries `Source`: `KnowledgeSourceChannel.DocumentText` / `PictureDescription` /
`GeneratedOverview`. ‼️ **The default for an unclassified kind is NOT DocumentText** — a card kind invented
later must not inherit the authority of a price list. `TrimToTokenBudget` seats the document's own rows
before anything generated (what is retrieved is unchanged; only the order the model reads it in).
The prompt states: every price, number, date, name and code must come from a `document` result; an overview
gives shape only; a picture description is never proof of a brand, model or price.
‼️ **And it is an AFFORDANCE, not just a warning label** (owner, 2026-09-05): when a picture answers the
caller the model says *"I've got a photo of that — shall I send it?"* rather than reading our AI's words
aloud as though the owner wrote them.

### EX-12 — one description per PICTURE, identity unchanged

‼️ **SUPERSEDED 2026-09-25 (P4-E-26 AR-X1): `KnowledgeImageFingerprint` is DELETED** — a 9×8 dHash cannot see a
label, so the NX-295 photo was described as the NX-290. A description is reused only for the same BYTES beside the
same words. What follows is the history. `KnowledgeImageFingerprint` (a 9×8 dHash) was computed from the
already-normalized bytes and reused a description across visually identical pictures in one run. ‼️ **It is NEVER identity**: `imageId` stays the
first 16 hex of the BYTE hash because the delete-tombstone and `IsOwnedImageBlob` are keyed on it. ‼️ **Exact
equality, never a near-match tolerance** — a tolerance would eventually hand one product's photo the
description of a similar-looking different one, and that description is read to a caller. Same guard as the
byte reuse: a description written WITH the words beside the picture (EX-13) is never reused.

### EX-15 typed sheets — the finding was NOT REAL as written; the real one was narrower

A sheet with **no** header declaration anywhere gets **no labels at all**, so "Price: 7" cannot happen there.
The real defect: once a block declared a header, every later block **inherited those labels unconditionally**
— so `Warranty | 7 days` under a price list became `Price: 7`. A block now inherits only when its SHAPE
matches the one that owns the labels (same width, same kinds of values per column); otherwise **no labels
rather than false ones** (D19), and once the labels stop carrying they never return to a later block.
‼️ This governs **INHERITANCE only** — promoting a row to a header still needs the author's own declaration
(R1), which stays banned to infer, because `LooksLikeALabelRow` answers YES to `Colour | 60.00`.

### One figure vocabulary for the whole lane

`KnowledgeFigures` (infrastructure) is now the ONE place a figure is read out of provider text —
Indic digits, lakh grouping, European decimals, ambiguous readings. `KnowledgeSummaryFactCheck` (EX-20,
Functions) delegates to it. A second reader would let a price that is a fact to one lane be invisible to the
other. ‼️ `MissingFrom` is a **budget, not a set**: a figure written twice and returned once is a loss.

### #9 — the draft is the retry, and one case still needs a schema decision

The draft is **kept** when a post-write follow-up fails, so the provider's own Approve finishes the job (the
deterministic service id makes the retry converge on the service that exists). On an update that moved
category, a counter-refresh failure is **Ok + alerted**, never "failed" — the provider's change landed.
‼️ **Still open:** once the service has moved, a retry re-reads it and finds the new category on both sides,
so the OLD category's counter can never be refreshed. Closing that needs the old pair persisted on the draft
— **a §0.7 schema change nobody has approved.** Do not build it without the table and a yes.

### Caps

`CountAsync` (documents) and `SumPassageCountAsync` (searchable space) both exclude `Deleting` rows — a row
being purged no longer holds a slot the provider's own list already hides (D12, D22). `CountShares` and
`CountMaterialSends` filter on `VoiceSendSlot` kinds, so the two per-call allowances are genuinely separate
(D11). Both SQL shapes are pinned by tests because the emulator is more permissive than production.

### ‼️ #9 UPDATE (D23) — the counters are refreshed WHOLESALE, and no field was added

The earlier shape ("keep the draft, and one day persist the old category") is **superseded**. On a category
move, `RefreshEveryCountForBusinessAsync` refreshes **every category the business has selected**, not the two
the operation happens to know about.

**Why this instead of a schema field.** The field existed only to REMEMBER which category the service left —
because once it has moved, a retry re-reads it and finds the new category on both sides. Visiting them all
means nothing has to be remembered. It also repairs drift already sitting in the data, which a field could
never do, and it needs no §0.7 approval.

‼️ **The sizing that made this look expensive was WRONG, and was corrected by measurement.** A whole-business
recount was described to the owner as "a business-wide sweep". Live: a business has **1–5 selected-category
documents** (avg 2 in Canada, 1 in India; max 5, max 24 subcategories). It is **one extra Cosmos read** on a
path that already makes several.

‼️ **Two traps this code is shaped around, both proven by sabotage:**

- **The delta is a MARKER, never an amount.** `RefreshSubcategoryCountsAsync` recomputes every count from the
  real services and uses the delta only to choose which pairs to visit — and it **drops a zero delta**. Mixing
  `+1` and `-1` made the pair the service moved INTO sum to zero when it was already selected, so the very
  category it arrived in was skipped. Every pair now carries the same non-zero marker.
- **Both ends of the move are added EXPLICITLY**, so this can only ever refresh MORE than the targeted pair it
  replaced, never less. The old pair must not depend on the selection read having returned it.

### ‼️ EX-13's nearby text — CLOSED, and it needed nothing (D24)

The idea was to let the model say *"the Model X, five hundred dollars — I have a photo of it"*. Checked in
code: **it already can.** The line "Model X | $500" is its OWN result (a text card from the same document),
and the EX-20 seating puts it FIRST, before the photo. A field would hand the model the same words twice.

‼️ **A smaller, different gap is NOT closed and is deliberately left open**: the nearby words ride the
EmbedText (the vector) only — they never reach the searchable `content` — so an exact product CODE like
`TL1255C`, which embeddings handle poorly, may not pull the photo up reliably. That is **search recall**, not
"let the model say it". Revisit it as part of the index rebuild (D6), when the field costs nothing extra.

## ‼️ SESSION D (2026-09-06) — WHAT IS TEXT, AND WHAT IS ONLY THE DRAWING (EX-07 / EX-17, and three the audit never found)

**Scope was EX-07 (reading order), EX-17 (Word fidelity) and EX-18 (charts). EX-18 is NOT DONE, and it is not
work that was skipped — it is UNPROVABLE on every file we hold** (see "What the corpus cannot prove"). The
biggest defects closed here were found by MEASURING, not from the audit text.

### ‼️ 1. `Flatten` was reading a drawing's GEOMETRY as the document's prose

`KnowledgeOoxmlText.Flatten` used a DENY-list — it appended every `OpenXmlLeafTextElement` it had not been
told to drop. A census over 54 `.docx` + 8 `.pptx` found **exactly two** element types carry author text
(`w:t` 25 710 occurrences · `a:t` 581) and **seven** carry metadata that was being indexed as words:

| leaked element | what it is | live example |
|---|---|---|
| `wp:posOffset` (108) | an EMU coordinate | `"-40640019875500Current state BOND loyalty engine architecture"` |
| `a:tableStyleId` (5) | a style GUID | `{7E9639D4-E3E2-4D34-9284-5A2195B3D0D7}` |
| `wp:align` (26) | `"bottom"`, `"left"` | `-238125bottom00` |
| `wp14:pctWidth` / `pctHeight` (115) | `"0"` | `95257556500` |
| `o:FieldCodes` (1) | VML `\s` | — |

‼️ **It is now an ALLOW-list: `leaf is W.Text or A.Text`.** That is strictly SAFER than the deny-list it
replaces — `w:delText` / `w:instrText` / `w:delFieldCode` are SIBLINGS of `w:t` under `TextType`, never
subclasses, so tracked deletions and field instructions stay excluded. The untyped `mc:Choice` path was made
symmetric: the blanket "childless unknown element then append its InnerText" fallback is GONE, because
`case "t"` already takes the real text.

‼️ **Measured on the corpus: 436 characters of geometry removed, ZERO characters of real text lost**, across
7 of 54 documents. It also emptied 16 of the 28 files whose headers held nothing BUT this junk — which is why
reading headers (below) became safe.

### 2. `w:vanish` — hidden text reached the index and could be READ ALOUD to a caller

No `w:vanish` handling existed anywhere. A run the author marked Hidden (a superseded price, an internal
note) became an ordinary card. `IsDroppedSubtree` now drops a `W.Run` whose `RunProperties.Vanish` is present
and not `val="false"`. ‼️ **Declared limit: DIRECT formatting only.** Hiding via a STYLE is not resolved —
`Flatten` is a static utility with no `StyleDefinitionsPart` — and no file in the corpus uses it.

### 3. `w:ptab` — a table of contents welded its page number onto the heading

`IsWhitespaceElement` accepted `w:tab` but not `w:ptab`, the tab Word writes for a right-aligned dot leader.
`"Phase 2 - Cosmos DB"` + ptab + `"12"` became **`"Phase 2 - Cosmos DB12"`** — naming a system that does not
exist, and the product name then tokenizes as the single term `DB12`. Same class as the `w:tab` fix this file
exists for.

### ‼️ 4. THE MONEY CASE — a partial horizontal merge put a RATIO in the price column

EX-16 suppressed the duplicate-across-spanned-columns only for a **single-cell full-width band**. A PARTIAL
merge still copied its value into every column it covered, shifting every later value one column right.
Measured on a real cost summary (`tblGrid` = 6 columns; the header row fills 5, the data rows fill 6):

```
before   | Partner | Total Requests | RP | Total Cost | Total Cost
         | BNS | 177,535,862 | 0.7418 | 0.7418 | $341,570.00 | $341,570.00
         card: "... RP: 0.7418 | Total Cost: 0.7418 | ..."      <-- the ratio, spoken as the price
after    | BNS | 177,535,862 | 0.7418 |  | $341,570.00 |
         card: "Partner: BNS | Total Requests: 177,535,862 | RP: 0.7418 | $341,570.00"
```

‼️ **The rule is now uniform in BOTH readers (DOCX and PPTX): a merged cell holds ONE value — the first
spanned column takes it, the rest are padded.** This document is genuinely self-inconsistent, so no pairing
is perfect; the money is now **unlabelled rather than mislabelled** (the D19 principle — a gap beats a lie).
‼️ **This deliberately overrides `Docx_APartialSpan_StillCoversTheColumnsItSpans`**, a prior session's
judgement ("the value genuinely applies to them") that was never an owner ruling. Its replacement pins the
new contract.

### 5. EX-07 — a PLACEHOLDER now takes its position from the layout

`InReadingOrder` (Session B) sorts shapes by row-band then left-to-right, but bailed to file order unless
**every** shape carried its own `a:off`. A placeholder never does — it inherits the layout's. So a single
placeholder disabled ordering for the whole slide: **21 of 87 sample slides, including all 12 of one deck.**
`InheritedOffset` resolves it from the slide's layout and then its master, matching on `idx` when the slide's
placeholder declares one and otherwise on type (an absent type means `body`).

**Measured: 26 of 26 unpositioned shapes resolve; slides left partial 21 to 0; slides whose order changes
32 to 44.** On the one deck whose content moved the change is pure reordering (sorted content byte-identical),
and it is unambiguously right — every slide had its own number wedged between the heading and its body:

```
before   "Objective"  ->  "3"  ->  "Create a new Scene+ Campaign Management Automation..."
after    "Objective"  ->  "Create a new Scene+ Campaign Management Automation..."  ->  "3"
```

‼️ Noted, NOT fixed, out of the approved scope: a slide-number placeholder ("3", "8") is still emitted as its
own card-sized block. It is furniture and belongs in a later session's scope.

### 6. Word headers and footers are READ ONCE (owner-approved 2026-09-06, reversing the 2026-09-03 ruling)

‼️ **The old exclusion rested on a claim that is FALSE, and it was measured rather than argued**: the comment
said reading them "would put sixty copies of a phone number in the index". A 60-page document with one header
stores **ONE `HeaderPart`** — proven by building one and counting. Reading it yields the phone number once.
The HTML lane had already been reversed the other way (EX-29 keeps `<header>`/`<footer>`).

`AppendHeaderFooterBlocks` emits each part's text once, deduplicated case-insensitively (default / first-page
/ even-page and per-section parts repeat a line). ‼️ **It runs AFTER `PairLabelValueRuns`** — header text is
not part of the body's flow, so two adjacent headers must never be read as one label-value run (proven
output-identical on all 54 documents; the ordering is for safety, not for a measured difference).
‼️ **Header IMAGES are still not collected**: a letterhead logo is template furniture, exactly what the PPTX
lane already refuses.

Recovered from the corpus: `Risk Acceptance & Sign-Off Scene+ / BNS — Point Consolidation`,
`Confidential — for Scene+ review`, `© 2022 Proprietary and Confidential`. ‼️ **No junk filter was needed or
written** — fix 1 removed the junk at its root, taking header parts from 47 (10 with no letters at all) to
**18, none junk**. Since 2026-10-02 the PDF lane KEEPS page furniture as well (marked per page, never deleted; the cards carry each one
once), so all three lanes keep it.

### ‼️ WHAT THE CORPUS CANNOT PROVE — EX-18 IS OPEN, AND SO IS EX-07's HEADLINE CASE

The owner expanded `C:\Nik\Data\SampleData` to ~150 files (54 `.docx`, 15 `.xlsx`, 8 `.pptx`, plus PDFs).
Counted with the shipping parser:

| condition | files containing it |
|---|---|
| charts (docx **and** xlsx **and** pptx) | **0** |
| a picture used as a shape fill or slide background | **0** |
| SmartArt | 1 (its text extracts correctly) |
| multi-column (`w:cols`) sections — the resume case | **0** |
| hidden text (`w:vanish`) | **0** — fix 2 is proven on a synthetic fixture only |
| header/footer text | 28 |
| floating text boxes | 5 |

**EX-18 is real by code reading** — `TextPointsOf` walks only `a:p`, but a chart's series names, categories
and values live in `c:v`, so a chart yields its title and nothing else; the XLSX lane reads only
`Drawing.Spreadsheet.Picture`; a DOCX chart has no blip and yields nothing at all. **It was not built because
it cannot be validated against a single real file, and shipping unvalidated chart extraction into a lane that
speaks prices to callers is the wrong trade.**

### Guards (all in `Clinqet.Communications.UnitTests` — ingest runs in the Functions host, §0.18)

12 added to `KnowledgeExtractionFidelityTests`; **9 sabotages, every one RED on exactly the right test with
its controls green.** ‼️ One guard was written and DELETED before it shipped: a `tableStyleId` assertion that
would have passed identically before and after, because the parser never walks a table's properties — the
corpus diff, not the element census, is what proved it vacuous.

### ‼️ SESSION D PART 2 (2026-09-06) — EX-18 BUILT AFTER ALL, on files created for the purpose

The owner authorised creating the missing evidence rather than waiting for it, so five files were written
into `C:\Nik\Data\SampleData` (`Clinket_Chart_Deck.pptx`, `Clinket_ShapeFill_Deck.pptx`,
`Clinket_Chart_Prices.xlsx`, `Clinket_Chart_Report.docx`, `Clinket_TwoColumn_CV.docx`), each carrying the
real OOXML structure Office writes — a cached series name, cached category labels and cached numeric values.
**Measured before the fix:**

| file | what reached the index |
|---|---|
| PPTX chart | the title and two axis names. **Every service and every price lost** |
| DOCX chart | **nothing at all** — the lane never traversed a chart part |
| XLSX chart | the chart's own title lost (cells survived) |
| shape-fill / background photo | `images=0` — both invisible |
| two-column CV | ‼️ **read correctly** — see below |

#### `KnowledgeChartReader` — one reader, three lanes

‼️ **A chart's numbers are `c:v`, never `a:t`**, which is why a walk over drawing paragraphs found the title
and nothing else. Office caches every plotted category and value inside the chart part precisely so the
chart still reads without its source workbook; that cache is what is read now.

‼️ **A chart IS a small table** (one row per category, one column per series) and is emitted as one, so it
inherits every rule tables already have — declared labels, the compact `header: value` serialization, and
the money handling. One class shared by PPTX, DOCX and XLSX, so a chart cannot read differently depending on
which file it was pasted into.

- **Points are keyed by the plotted `idx`, never by arrival order** — a gap in the cache must not shift a
  later value onto an earlier category. Sabotage-proven.
- **A series that cached no values is skipped**, or it would add a column of blanks under its own name.
- **A series name is a cached `c:v` when it came from a cell and rich text when the author typed it** — both
  are read.
- `HasHeaderRow` is true only when the axis title or a series name actually exists. Nothing is inferred from
  shape (R1).

#### ‼️ The XLSX duplicate guard — and why it is not vacuous

A spreadsheet chart almost always plots cells that are **already on the sheet**; indexing both says the same
thing twice and spends the provider's searchable space on a copy. A chart is skipped when **every** plotted
label and figure is already a cell value on that sheet — exact containment, never a guess. It is therefore
still read when its figures are **not** there: a linked workbook, or a sheet the author hid (which this lane
skips by contract). ‼️ **Both directions are pinned by their own test**, because a guard that simply never
read a chart would have passed the first one alone.

#### Shape fills are pictures; slide backgrounds are not

A photo dropped into a shape is a picture **fill**, not a `p:pic`, so the image lane never saw it — a product
panel reached the caller with nothing to send. `CollectPptxShapeFill` routes it through the **same** collector
as a `p:pic`, including the byte floor, the media budget, the part dedupe (EX-14) **and the backdrop rule** —
so a full-slide photo panel behind text still costs no paid description. ‼️ **A slide BACKGROUND is
deliberately still not collected**: the author declared it as background, which is the backdrop signal
itself, and the lane already refuses layout and master furniture on the same reasoning.

#### ‼️ EX-07's headline example is NOT REAL for Word — proven

The audit's own illustration was "a two-column résumé interleaves employment history with skills". Built and
measured: a genuine `w:cols` two-column CV extracts **in perfect order**. Word columns are a *flow*, not a
layout — the text is already linear and the columns are only how it is rendered. **The failure it describes
cannot occur in the DOCX lane.** It remains plausible for a scanned PDF, where the reading order is Azure's
layout model's to get right and our code only consumes its markdown.

### ‼️ THE THREE CORPUS-AUDIT FINDINGS — ALL THREE DELIBERATELY NOT FIXED (owner-approved 2026-09-06)

The 49-agent corpus audit confirmed five findings; two were fixed (the money merge, `w:ptab`). The other
three were each examined against real data and **each fix would have been worse than the defect**:

| finding | why not |
|---|---|
| **XLSX side-by-side tables weld into one** | Nothing is LOST — every figure stays present and findable; only attribution blurs. The fix would change how **every** spreadsheet is cut, and a blank spacer column is far commoner than genuinely side-by-side tables. The safe variant (split only on a *declared* table edge) does not fix the file that exposed it, which declares none |
| **A "Cons" list read under the column name "Pros"** | ‼️ **Recommendation REVERSED by measurement.** The only structural trigger available is "a data row with exactly one non-empty cell". Measured across the corpus: **26 such rows in 3 headed tables — and they include `[ \| \| \| \| $0.00 \| \| \| \| \| ]`, a real money row in a real money table.** Acting on that trigger would strip labels from live prices. Promoting "Cons" to a new label is vocabulary inference, banned by R1 since it put a price into a column name |
| **XLSX labels stranded by a region cut** | It IS a one-line setting (`XlsxRegionBlankRowGap`, default 1), so the fix looks free — but that setting is **load-bearing for EX-15/D19**: blocks split by a blank row are different tables and must not share labels. Raising it re-merges them and re-creates the false-label bug (`Price: 7`) that D19 exists to remove |

**The rule these three share: a fix that trades a narrow wrong answer for a broad loss of correct ones is not
a fix.** Each is recorded so a later session does not re-derive the same reasoning.

---

## SESSION E — the ETag programme (#7 / Q3-A), 2026-09-06

**`CosmosDbRepository.UpdateItemAsync` re-read the document to obtain its CURRENT etag, then wrote the
caller's STALE object with it.** The precondition passed *by construction*, and the 412 retry repeated the
same pattern — a *detected* conflict turned back into a *silent overwrite*. **131 production call sites, 26
wrappers, 22 repositories.**

### How a fake guard survived this long

- ‼️ **The `clinqet-cosmos-data` SKILL documented the bug as a feature** — *"UpdateItemAsync automatically
  handles ETag … NEVER silently overwrite"* — in all four AI-tool copies. Corrected 2026-09-06.
- **Four authors wrote around it rather than fixing it**: `BookingRepository.TryReplaceBookingAsync`,
  `ProviderInvoicePaymentSettingsRepository.TryReplaceAsync` (*"unacceptable on a payee bank account"*),
  `BookingPaymentService.MutateBookingPaymentAsync` (a hand-rolled copy of the very helper this session
  added), and `AiProposedCategoryMergeService`'s "narrows the lost-update window" comment.
- ‼️ **Three catch blocks handled a 412 that could never arrive**, and their unit tests passed against mocks
  that behaved the way the authors *expected* the repository to behave. **No test double in any of the three
  hosts modelled an etag on this path, and no test drove the real base method at all** — the whole suite was
  blind to it.

### What was actually happening in production

| path | consequence |
|---|---|
| `BookingAutoCompletionProcessor` | a customer's cancellation landing in the read→write window was overwritten with `Completed` — **and `Completed` emits a Sent invoice with a payment link** |
| `BookingTimeoutProcessor` | a customer's confirmation replaced by `RejectedTimeout` |
| `KnowledgeDraftApprovalService` | the *draft* was claimed with a real CAS one line earlier; the *service* was written across an AI call through the broken path, so a provider's price edit vanished |
| `ReviewRepository` rating aggregates | concurrent reviews lost increments outright — provider star ratings drifted with no repair path |
| `BroadcastService:1433` | `CreateBookingAsync`'s return value was discarded, so the booking carried **no etag at all** and three downstream money writes were blind |
| `BusinessProfile` form saves | a whole-document replace could silently revert `paymentConfig` (tax rate, registration number) |

### The contract now

- `UpdateItemAsync(item, pk)` — conditional on **`item.ETag`**. 412 ⇒ throw, never retry. **No etag ⇒
  `InvalidOperationException`**; a deliberate unconditional write uses `UpsertItemAsync`. The fresh etag is
  **stamped back onto the caller's instance**.
- ‼️ **The restamp is not an optimisation.** `BookingService.HandleConfirmedAsync` replaced the same instance
  twice (reminder sequence, then auto-completion sequence). Without the restamp the second write 412s **every
  time, with no concurrent writer** — auto-completion would silently stop being scheduled platform-wide.
- `UpdateItemWithRetryAsync(id, pk, mutate)` — a REAL read-modify-write, modelled on
  `PatchStableArrayItemByIdAsync`: `mutate` is re-applied to a **fresh** document each attempt, `false` means
  no change, exhaustion **throws** because the write is still owed.
- **`ReadForUpdateAsync` refuses a document-type mismatch**, which `GetItemAsync` and `DeleteItemAsync`
  already did and the update path never had. Containers are shared and ids collide by shape
  (`{businessId}_{entityId}`), so without it another type deserializes into `T`, is re-typed by the write and
  destroyed.

### ‼️ The rule this session earned

**Making a conflict visible is only half a fix. The other half is asking what the caller can do about it.**
Of 136 surveyed sites only 58 could simply inherit a 412; **58 needed a read-modify-write** because the write
happens *after* something irreversible — a notification sent, a blob uploaded, the authoritative row already
committed — so a bare 412 would tell a provider an operation failed that in fact succeeded. That is D31 in a
different costume: *a fix that trades a narrow wrong answer for a broad loss of correct ones is not a fix.*

### Traps found by adversarially reviewing this session's own conversions

- ‼️ **A CAS mutate must be idempotent.** `AddAddressAsync` did `list.Add` with no existence check: a write
  that lands but whose acknowledgement is lost is re-sent by Polly, 412s, re-reads, and **adds the address a
  second time**. `DeleteAddressAsync` reported a *successful* delete as **404** for the same reason.
- ‼️ **An edge-triggered follow-up must not be moved after the write that arms it.** Re-stamping catalogue
  currency after the address commit made `oldCurrency == newCurrency` on the provider's retry, so one
  conflicted service kept the old currency **for ever**. Level-trigger it and isolate each item.
- **A CAS that declines still falls through to the side effects** unless a flag stops it — that shipped a
  second invoice email and a media-derivative job for an image never recorded.
- **Do not thread the request `CancellationToken` into a write whose blob is already stored** — the provider
  closing the tab then loses the write the change exists to protect.

---

## SESSION F — 2026-09-07: the write path, and the last four extraction residuals

**13 sabotages, every one RED on exactly the right guard, each gated on a zero-error build and restored
byte-identical. In-tree: API 11 815 · Communications 4 020 · MCP 878 · emulator 10 API + 2 Communications
+ 29 Cosmos CRUD · partner-web jest 153.**

### The write path (all owner-approved)

- ‼️ **`UpsertItemAsync` was the one write path with no attribution carry-forward and no document-type
  guard.** Session E’s handover said the only `ProviderOwnedEntity` upsert target was `BusinessCustomer`;
  **`Availability` is one too**, upserted from three API sites, and the weekly-hours save and copy-day-times
  both construct a FRESH object over `{businessId}_{day}` — so `StampCreatedBy`’s `??=` re-attributed all
  seven rows to whoever edited last. It now reads the stored document on every upsert of a caller-supplied id.
- ‼️ **`AddItemAsync` never restamped the etag**, so **create → mutate → update on the same instance** hit
  D32’s no-etag guard and threw every time. Found by 8 emulator CRUD tests Session E never ran.
- ‼️ **A programming error printed its own developer sentence to the provider.** In this codebase
  `InvalidOperationException`’s Message **IS a localization key** — 65 controller catch blocks pass it to
  `GetLocalizedString`, which returns an unknown key **verbatim** — so the no-etag guard showed
  *"…use UpdateItemWithRetryAsync…"* as a **400 “invalid input”**, in English at any locale.
  `PersistenceContractException` derives from `Exception` and falls to the generic localized 500.
- ‼️ **`GlobalExceptionHandler` answered 500 unconditionally**, so a 412 escaping a controller without
  `HandleException` told the provider the server had broken. `StorageFailureMapping` is now the ONE mapping
  for all three sites (the same five-arm switch was written twice in `BaseController` and nowhere here).
- ‼️ **The CRM identity sync destroyed provider data.** It built a fresh `BusinessCustomer` and wrote it over
  the row; the producers send `LastName` as `""` and `Phone` as `null`, so a quote for an already-recorded
  customer **blanked their surname and phone**. `MergeBusinessCustomerAsync` applies only what a sync owns,
  never blanks a stored value with a blank one, writes nothing when nothing changed, and merges rather than
  throws when a create loses its race.
- ‼️ **Seven partner-web service modules each dropped the HTTP status.** Session E fixed one seam; the other
  six had the same shape, so every `if (status === 412)` outside knowledge was dead code. One shared
  `apiError.js` plus a repo-local scan test so no module can grow its own copy again.

### The extraction residuals

- **`w:vanish` via a STYLE** — character style, paragraph style and the `basedOn` chain, resolved once per
  package. ‼️ **UNION across the two style levels, deliberately NOT the spec’s toggle XOR**: reading a toggle
  wrong speaks a price the author hid to a caller, so the fail-closed answer wins. Document defaults are
  excluded (one stray attribute would empty a whole document) and a run inside an `mc:Choice` is untyped, so
  neither this nor D26 reaches it. ‼️ **A census of 54 corpus `.docx` found `w:vanish` NOWHERE** — both rest
  on created evidence.
- **SmartArt** — `KnowledgeDiagramReader` walks the `parOf` connections by `srcOrd`, reads a connector label
  where the author drew it, skips the renderer’s `pres` copy, keeps a repeated step label, and ‼️ **appends
  anything the walk cannot reach, so a malformed model degrades to the old flat sweep and never loses a word**.
  ‼️ **Word read diagrams NOT AT ALL** — the chart collector looks for a `ChartReference` and the image
  collector for a blip, so a Word SmartArt contributed not one word.
- **A Word floating text box** was WELDED into the sentence it was anchored to — measured:
  `"Our services include Cut 30 Colour 60"` as ONE line. Each box is now its own block at the anchor, ordered
  by `wp:positionV`/`positionH`, keeping its lines; `wp:inline` stays in the sentence. Covers the
  `mc:AlternateContent` shape Word really writes.
- **EX-07’s PDF half is PROVEN NOT REAL.** One billed `prebuilt-layout`/markdown call on a two-column PDF
  created for it: **DI’s reading order is perfect**, and its own `paragraphs` array is row-major so “prefer
  DI’s order” is dead too. What IS real: DI sometimes reads a column flow as a 2-column TABLE, and the
  markdown lane trusted an all-`<th>` row 0 **with no label gate** while `<thead>`, Word and PowerPoint all
  gate theirs — `Cut and finish - 30` became the COLUMN LABEL of `Full head colour - 85`, Session D’s money
  defect. One gate now serves all four declarations. ‼️ **Polygon column detection was REFUSED: on the
  measured page a column flow and a real table are geometrically IDENTICAL (y values to 0.01in), so any
  further fix is shape inference, banned by R1.**

### ‼️ The rules this session earned

1. **An exception TYPE can be part of the user-facing contract.** Here `InvalidOperationException` means
   “my Message is a localization key” in 65 places, so choosing it for a caller bug leaks the message.
2. **Run the suites that touch what you changed, not only the ones you wrote.** A class the previous session
   never ran was hiding its own regression.
3. **Measure before building, even when the fix looks obvious.** Polygon column-sorting was the “obvious”
   EX-07 fix; the measurement showed it would have been a regression.
4. **Never lose a word to a filter.** Excluding floating boxes from a header’s text without re-emitting them
   deleted a letterhead panel — found by this session’s own audit, not by a test.

## ‼️ MULTILINGUAL RETRIEVAL ON THE PHONE (Phase 3, 2026-09-15) — F1/F2/F3/F4/F5/F6/F7/F9/F10

**The receptionist used to search ONE rendering, forced into English.** A document written in another
alphabet shares no token with an English question, so BM25 returned nothing and the vector leg carried it
alone. MEASURED LIVE on the deployed CA index, on the retained `SX3SG2` fixture (a Hindi rate card whose
answer is `सेवा: बाल कटवाना | कीमत: ₹250`):

| Leg | keyword-only (pure BM25) | hybrid |
|---|---|---|
| English "what is the haircut price" | **1 hit, and it is the one ENGLISH sentence in the file** | the ₹250 row at rank 2, by vector alone |
| Hindi "बाल कटवाने की कीमत क्या है" | **4 hits, 26.76 / 24.47 / 17.15** | the ₹250 row at rank 2 |

### What the tool takes now
`search_knowledge(query, queryInHindi, queryInGujarati, queryInPunjabi, queryInBengali, queryInTamil,
queryInTelugu, queryInOdia, queryInKannada, queryInMalayalam, queryInSinhala, queryInUrdu, queryInChinese,
queryInJapanese, queryInKorean, queryInThai, queryInRussian, queryInGreek, queryInHebrew, linkedServiceId,
askingWhatTheBusinessHas)` (Odia/Kannada/Malayalam/Sinhala added 2026-09-25, P4-E-02).

- The field names are **exactly** `BusinessSearchScriptPlan.FieldNameFor(script)` — one vocabulary with
  Business Search, whose measured 25/25 accuracy came from naming the LANGUAGE rather than offering an array.
- ‼️ **Every rendering is VERIFIED server-side** with `TextScriptDetector.ContainsScript` before it becomes a
  leg. A field claiming to be Gujarati with no Gujarati character in it is DROPPED, not searched — searching
  Gujarati content with Latin text is the measured 0.040 case.
- ‼️ **The per-call prompt names the business's OWN non-Latin alphabets** (`ProviderContext.KnowledgeLanguages`,
  from the index `scripts` facet via `IBusinessAlphabetService`, optional + fail-soft). That is the only thing
  that makes an ENGLISH-speaking caller able to reach a Gujarati price list.
- Legs are capped by `Voice:Knowledge:RetrievalMaxQueryLegs` (3); over the cap the business's own alphabets keep
  their seats and a caller-only language gives way (P4-E-01). A leg that fails or times out does NOT fail
  the answer — the result carries `LegsRequested`/`LegsSucceeded`/`NotSearchedIn` and the note SAYS which
  alphabet went unsearched.

### ‼️ FUSION IS BY RANK, NEVER BY SCORE (F7)
‼️ **Since P4-E-26 the legs meet by CLOSENESS** (`KnowledgeRelevanceRanker`, below); rank fusion (k=60,
contributions SUMMED) remains only for keyword-only or unreported legs, shared by the phone and Business
Search. A hybrid leg returns Azure's own RRF numbers (~0.03); a leg whose embedding failed returns raw BM25.
**Measured live: 26.76 vs 0.033 — about 800×.** The old max-score merge gave the keyword-only leg every seat.
A single-leg search is byte-identical to the old plain rank order.

### The other retrieval rules that changed
- **F6** — the answerable docIds go in the FILTER (≤5,000 since P4-E-06; was 500), not only the post-check. A 500-card "not used"
  catalogue used to fill the whole 16-row window and the answerable document sat at rank 17.
- **F5** — a narrowing that finds **literally nothing** retries once unnarrowed inside the same budget — only when
  the query sets `WidenWhenNarrowedFindsNothing` (the phone does; P4-E-08).
- **F4** — at most ONE overview unless `askingWhatTheBusinessHas`. Three were force-seated on every query.
- **F3** — the envelope is subtracted in **TOKENS**, not Latin characters. The note is always English prose
  (~1,700 chars ≈ 425 tokens); subtracting 1,700 from a budget already converted to Chinese characters left a
  CJK business less than half its entitlement. Since P4-E-07 each passage is costed at its OWN script's rate
  (the old single factor from the LONGEST passage is gone).
- **G-12/G-13/G-14/G-16/G-20** — the caller's words escaped for simple query syntax (`-20` was a NOT clause);
  both digit forms searched (`૫૦૦` ⇄ `500`, neither analyzer folds them); vector k = the window; the ref cap
  derived from settings with truncation logged; surrogate-safe 200-char cut.
- **F9** — Noto **Bengali, Tamil, Telugu and Arabic** embedded (8 faces, OFL) and **RTL for Arabic script**,
  decided from the provider's OWN words. ‼️ **Corrected 2026-09-25 (P4-E-18):** Thai and Hebrew faces shipped
  2026-09-16 and Hebrew is RTL (`QuestPdfService.RightToLeftScripts` = Arabic + Hebrew). The real gaps are Han,
  Japanese and Hangul — CLOSED by the owner (a CJK Noto is 10–16 MB). Odia (family "Oriya"), Kannada, Malayalam and Sinhala
  faces shipped 2026-09-25. Guarded by
  `EveryScriptTheDetectorCanEmit_HasAFontInTheMaterialChain` and a render test per script.
- **F10** — a BLANK topology endpoint now yields a route whose `KnowledgeClient` is **null** in all three
  hosts. ‼️ Conditional REGISTRATION is NOT the fix and was tried first: four services take the client as
  required, so it turns an unresolvable factory into an unresolvable service — the same dead host. And
  ‼️ **read the configuration inside the factory, never at registration time**: under `WebApplicationFactory`
  the test host's configuration is layered on AFTER the app's own builder code runs.

## Shared AI resource alerts (2026-09-15)

MCP registers the shared resource-alert publisher, observers on three AI HTTP clients, and the Search factory for its two optional Search clients. `RealtimeSocketFactory` supplies `IIntegrationHealthAlerts` to sockets: rejected resource-limit/timeout handshakes and structured realtime error/response.done events report the Model alert without changing the frame or exception. Real local-WebSocket integration tests cover handshake status and fragmented error messages. Speech SDK service timeouts report HTTP-equivalent 408. This does not infer a provider timeout from caller cancellation. See the infrastructure skill and the resource-alert audit for cooldown and diagnostics. â¼ï¸ SUPERSEDED 2026-09-19: the AI-only publisher was generalised into `IIntegrationHealthAlerts` over 14 resources and `AiResourceLimitAlerts`/`IAiResourceLimitAlerts`/`AiResourceKind`/`AiResourceLimitAlertSettings` were DELETED â see the `clinqet-integration-health` skill.

## Own-number test calls: queue, provider message, admin alerts (2026-09-17)

- ‼️ **The API enqueues `StartOwnNumberCheck` on `VoicePostCallQueueName`.** Before this feature only the Functions host
  used that queue, so deploy.ps1 never gave the API its suffixed name and every check 404ed on nonprod. Fixed by the
  shared Service Bus name list (see `clinqet-deployment`).
- **A check that cannot be enqueued** releases the single flight, refunds the allowance, raises the Service Bus admin
  alert and now answers the provider `Error_VoiceOwnNumberCheckNotStarted` (5 languages; web `showError` and the
  phone toast both show the server sentence) instead of a generic 500.
- **Every failed check raises an admin alert** (owner 2026-09-17), naming purpose, check, business, outcome, line,
  carrier and the caller, and saying "N failed checks in a row" from `ConsecutiveFailureAlertThreshold`. A dial that
  never happened (no caller, not placed, carrier refused) keeps its own more specific alert and is not doubled. The
  carrier-wide window alert stays. A timeout safety net that cannot be scheduled also alerts.

---

## ‼️ ASSIGN-NUMBER READS SQL — the billing ledger owns `MonthlyMinuteCap` (2026-09-19)

`VoiceAssistantService.AssignNumberAsync` calls `IMinuteLedgerService.ProjectCapToVoicelineAsync` on both the
activation path and the idempotent repair branch, and that SUMs the **SQL** `MinuteLedgers` table before atomically
patching `Voiceline.MonthlyMinuteCap`. Consequences to hold on to:

- **The voice admin surface is no longer Cosmos-only.** Any host or test harness driving `POST
  /admin/voice-assistant/{businessId}/assign-number` needs a real `AppDbContext` connection, not just the doubled
  `IAiAddOnService` billing gate. It cost 31 integration tests that answered a raw
  `"The ConnectionString property has not been initialized."` as a 400.
- **No ledger grant ⇒ cap 0 ⇒ `Voiceline.IsCapExhausted` is TRUE** (`MonthlyMinuteCap <= 0`), so a newly assigned
  number whose provider has no `IncludedGrant` row goes quiet by design. `SyncVoicelineFromApplicationAsync`
  deliberately never touches the cap.
- A projection failure **throws** and fails the whole assign; the repair branch re-syncs and re-projects on retry.

## ‼️ A voice refusal reaches the caller through `DomainRefusal<T>`, never a raw `ex.Message`

Both voice controllers now answer `catch (InvalidOperationException ex)` with
`BaseController.DomainRefusal<T>(ex, businessId)`. The services throw **two** kinds of `InvalidOperationException`:
59 `Error_*` localization keys (real refusals ⇒ 400 + localized copy) and **twelve developer sentences**
(`"Azure:Realtime:Endpoint is not configured."`, `"Mcp:SecretPath must be configured…"`, `"Voice call summary model
returned empty content."`) which are infrastructure failing ⇒ 500 + `Error_InternalServerError`. Four of those
sentences **name internal config keys** and used to ship to the caller as a 400.

`VoiceAssistantController.LocalizedBadRequest<T>(key)` survives for the **four** sites that pass a literal key
(`Error_VoiceJoinMethodUnsupported`, `Error_VoiceWebRtcUnavailable`) — those are refusals by construction, not
caught exceptions.


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

## ‼️ PHASE 3 AUDIT — prices the receptionist quotes (2026-09-24)

- `request_booking` prices a listed service with `ServiceBookingPrice` (the booking's rule) and adds the visit fee
  once (`BookingTools.BuildBookingPrice`). Booking REQUESTS for an unpriced item stay allowed — the owner confirms them.
- `QuotePriceCalculator`: the minimum charge floors the BASE only; an advertised discount is then honoured and never
  lifted back to the minimum (UW-5) — the same order the booking uses. The price type is `ServiceBookingPrice.TypeOf`
  (declared, else inferred), and a range stored with only its ceiling is that one figure.
- The narrator says **"visit fee"** — never "call-out charge" (Q-21).

## ‼️ PHASE 3C CLOSE-OUT — the receptionist's prices (search-topology, 2026-09-25)

Record: `Data\search-topology\findings\PHASE-3C-CLOSEOUT.md` (M3–M6, M11, M1).

- **M3 — a stored 0 is not a price.** `QuotePriceCalculator.Calculate` returns null unless
  `ServiceBookingPrice.HasSetPrice(pricing)` (the booking's rule, UW-21); a zero price with a minimum charge quotes the
  minimum. A quote-only service is never read as free.
- **M5 — the estimate applies an offer exactly as the booking does.** The offer arrives as `QuoteOfferDiscount(OfferName,
  Amount)`, measured by `OfferValidationService` on the service's own price (`estimate.ServicePrice`, never the visit
  fee), and comes off BEFORE tax inside the calculator (`ApplyPricingRules`: minimum floors the base → fees → offer →
  tax). The service-level `Pricing.DiscountEnabled` is no longer quoted — no checkout applies it — and is no longer
  carried in `ProviderContextPricing`.
- **M6 / UW-29 — a range with only a ceiling is "Up to"**: the calculator's line reads "Up to" with the ceiling as the
  figure (the booking holds that figure).
- **M4 — `CatalogPriceNarrator.Listed` types by `ServiceBookingPrice.TypeOf`**: an unknown or blank type is read from the
  amounts, never assumed "fixed"; a ceiling-only range says "up to X".
- **`ServiceBookingPrice.StampedTypeOf(pricing)`** is the ONE rule for the type a booking/quote line records (the
  provider's word, else the type read from the amounts, else "fixed") — web checkout (`BookingMappingExtensions`) and
  the phone's booking/transaction paths (`BookingTools`, `PartnerTransactionTools`).
- **M11 — `find_services` budgets use `ServicePriceBandFilter`** (`ProviderCatalogSearchService`), the same OData the
  marketplace filter uses — a budget means the same on the phone and the screen.
- **M1 / B-11 — live offers are decided in the business's zone**: `BookingTools` and `FullProviderContextService` read
  `GetCurrentOfferCandidatesAsync` and keep `OfferWindow.IsLive(offer, now, BookingTimeHelper.ResolveTimeZone(...))`.

## ‼️ ANSWER RELEVANCE ON THE PHONE — P4-E-26 (2026-09-25/26; authority `Data\answer-relevance\PLAN.md`)

- ‼️ **Knowledge search meets by RELEVANCE, not rank** (`KnowledgeRelevanceRanker`, shared with Ask Clinket; O-2
  reversed D27b). `debug=vector` gives each passage its cosine; a passage needs ≥ `RetrievalMinSimilarity` (0.25)
  AND ≥ `RetrievalRelativeSimilarity` (0.60) × the closest. One language keeps the index order; several fuse
  closeness with position. Keyword-only / unreported legs fall back to rank fusion. Overview companions are held
  to the same floor and seated after the records. Nothing close ⇒ the honest None.
- **F5's retry without the offering filter** now says so: `KnowledgeSearchResult.Widened` + a note that the material
  is about other offerings or the business in general.
- **find_services' meaning-match** keeps rows only at ≥ max(`VectorRescueMinSimilarity` 0.28,
  `VectorRescueRelativeSimilarity` 0.75 × closest), labelled `ClosestNotExact` — the nearest offerings, never a match.
- **Groups:** the business's OWN groups resolve (`GetCustomCategoriesAsync`, partition-scoped); a group-only ask for
  a group the business does not use is None with its groups listed; with words it searches everything and the note
  says so (`GroupIgnored`, carried on the expert path too — `CatalogGroupNotes.Ignored`).
- **Expert check (O-4):** none meets the requirement ⇒ the plain rows are offered as the closest, never as a fit; an
  Unknown match is a possibility the owner can confirm, never "typical"; the short-circuit never passes meaning-only
  rows unjudged; passages say which judged rows they belong to (`rows`) and whose words they are (`kind`).
- **Several differing sources (O-3):** the prompt says there are several and what tells them apart, then asks which
  one the caller means or reads the ones that apply.
- ‼️ **Pictures ↔ words at ingest:**
  - A picture's words are only what the source ties to it (cell — the row only when alone in its cell; its own
    paragraph; a layout figure's caption + inner text), riding `KnowledgeBlock.ImageNeighbourText`; a figure ends
    the words before it.
  - Its card and its registry `anchorPath` are filed under those words (bounded by `ImageGroundingMaxChars`); the
    heading only when it has none or its placements disagree (AR-X2 — the anchor heads the photo in sent material).
  - Descriptions are reused ONLY for the same bytes beside the same words; `KnowledgeImageFingerprint` is DELETED
    (AR-X1: it described the NX-295 photo as the NX-290). One photo placed beside different words is described from
    its pixels, first reading and "Read again" alike.
  - Words read from a picture carry `SourceImageIndex` → the picture's handle on their cards; they never share a
    passage with the document's own words; a deleted picture's description and words never return.
  - `SourceKey` (file content hash + figure/raster box) keeps a deletion or untick when a re-read produces the same
    picture as other bytes; never across file versions; a refilled spot's old entry is retired.
  - A replacement never carries the old file's pictures; the page's text names an undescribed picture only when it
    is alone on its page; PDF position binding needs the same pages; a saved reading re-binds only to the same figures.
- **Unchanged on purpose:** the phone is told a picture exists only through its description card (§6.12); words
  read from a picture do not make the phone offer it.
- ‼️ **Misplaced captions (AR-X12).** Document Intelligence sometimes leaves a caption OUTSIDE its figure — as a heading,
  which filed every following item under it, or as bare text. `LayoutFigureCaptions.Attach(reading, ct)`
  (Infrastructure/Services/AI) runs on every layout reading before the parser: knowledge ingest, a photographed page,
  the draft re-read and the setup reader. A caption-less figure takes the paragraph directly beneath it as its
  `<figcaption>` when it is on the same page, ≤ 3% of the page height below, ≥ 80% column overlap, not page furniture,
  not beneath two figures, only blank space between them in the text, and it repeats a code, price or number the
  picture shows (so a real heading under a banner stays a heading). Offsets come from the reading's own index type
  (grapheme-safe). Live catalogue: pictures named by their own words 31 → 40 of 40; text filed under another item 10 → 0.
- **Running titles (AR-X13).** A heading that opens a page and repeats an open heading re-enters that section — the
  reader levelled one catalogue title H1, H2, H3 on successive pages; a same-named subsection within a page still nests.
- **Keyword text and passage size (AR-S5, AR-S4)** — Hindi/Gujarati grammar words are dropped from the keyword half
  (`QueryFillerWords`), and one-item-per-line text packs to `ChunkRecordMaxTokens` (120); business-search skill §30.
- **Catalogue terms keep their vowel signs (AR-S7).** `TrimTermEdges` trimmed combining marks as punctuation, so
  "क्या" became "क्य" and "साड़ी" "साड़"; marks are now word characters.

## Closest seat and code questions — phone path (post-ranking follow-ups, audit 2026-10-01)

Evidence `C:\Nik\Data\post-ranking-followups\findings\closest-seat\`; audit `findings/AUDIT.md` §7 (A-M1, A-L5, A-L6).
The knowledge-reading changes of the same programme (heavy-work gate, PDFium, long pages, picture passes, dead-letter
handler, `StaleProcessingMinutes` 560, `AiAttemptBudgetPerDocument` 23,500) are in clinqet-infrastructure and
clinqet-function-app under "Post-ranking follow-ups".

- `Voice:Knowledge:RetrievalClosestSeats` (2; MCP and API appsettings only — Functions registers no
  `IProviderKnowledgeSearch`): the closest passages in meaning keep a seat the fused order withheld. 0 disables. Shared
  with Ask Clinket through `KnowledgeRelevanceRanker` (clinqetinfrastructure `Services/Knowledge`).
- `ClosestWithheld`: among passages at or above the relevance floor, the `seats` closest by cosine; the closest is
  returned whenever it is not already seated, the next only when its leg's shortlist (first topK × 2 rows) never held
  it. Returns the closest card's key. Nothing when the ranking is not gated (keyword-only or unreported legs).
- `Seat`: the closest cards go straight after the first seated card; the cut back to topK runs from the end, never
  removes the closest card, and removes a document's last card (its fairness seat) only when nothing else is left (A-M1).
- `FetchSize`: with a vector and seats > 0 a leg fetches max(topK × 2, `RetrievalVectorCandidates` (50)); else topK × 2.
- `ProviderKnowledgeSearchService.NamesACode` (A-L6): a question naming a code gets no closest seat (its closest passage
  in meaning is another code). Latin runs only, so CJK/Thai never match; a letter+digit token is a code unless a quantity
  (`2BHK`, `1.2L`, `9am`) or a size (`4x4`); 2–4 capitals followed by a 2+ digit token is one (`NX 195`). `i20` and
  `XUV700` stay codes on purpose (the sibling hazard the rule exists for).
- `SearchAsync` (MCP `search_knowledge`, `WidenWhenNarrowedFindsNothing = true`): the F5 unnarrowed retry runs only when
  the narrowed search found nothing AND (the question names a code OR no closest card would be seated) — it never widens
  when a closest card would be seated, so the "nothing about that offering" note stays true (A-L5). Closest cards pass
  `ApplyReceptionistGates` like every other.
- Tests: MCP `Services/ProviderKnowledgeSearchServiceTests` (seats), API `Services/BusinessSearch/ProviderKnowledgeRelevanceTests`
  (`AQuestion_NamesACode_OnlyWhenItDoes`).

## Subscription and assistant state refresh (2026-09-27)

- Provider web and native both use `services/providerStateEvents`: subscription, AI add-on, minute-balance and voice lifecycle notifications invalidate the corresponding demanded caches. SignalR single, batch and replay handlers dispatch once per payload; unrelated notifications do not trigger these reads.
- Web `VoiceAssistantContext` and `BillingOverviewContext` serialize forced refreshes behind an existing request and reject responses from an older mutation or workspace/session. Native `hooks/useVoiceAssistantState` and `services/billingOverviewService` mirror that rule; native plan-summary listeners update mounted Profile, Plan & Billing, dashboard and Call Follow-ups readers.
- AI gates revalidate when entered again, including when a cached promo prevents the screen content mounting. Web visibility/online and native foreground refresh recover missed notifications. An unused cache stays lazy; a previously failed requested cache can recover on the next event. Package/access gates remain in effect.
- A cached `NotInvited` is cleared during enrollment revalidation, so a failed refresh becomes unknown/retry instead of retaining the purchase promo. A known assigned/active state and known allowance survive transient read failures. `hooks/useVoiceUsage` updates mounted usage readers without remounting; an unavailable read is not evidence of no plan.
- Successful web subscription client mutations refresh assistant lifecycle; their existing callers still refresh the billing overview. No gateway, price, ledger, endpoint, schema or charge behavior changed.
- Dashboard lifecycle/setup widgets read the shared assistant state, not the stale business-profile projection. Native activity uses the server status `Active`.
- Setup layout uses available content width: number mode on the left, language plus reach-you phone on the right when space allows; one column on narrow screens. Manage mode preserves its separate layout. Assigned web number/actions move to the right at 800px container width and lead on narrow layouts. Native form columns use measured width and font scale, retaining native phone keyboard/pickers. Revalidation preserves unsaved form edits.
- Regression coverage: web `src/context/providerStateRefresh.test.jsx`, `src/hooks/useVoiceUsage.test.jsx`, SignalR teardown tests and voice-form validation; native `__tests__/providerStateRefresh.test.ts`, `aiSurfaceFocusRefresh.test.tsx`, `voiceUsageRefresh.test.tsx` and `voiceApplicationValidation.test.tsx`. These exercise real caches/gates with mocked transports, stale in-flight responses, notification batches, offline recovery, workspace purge, feature/access gating and unsaved edits.

---

## ‼️ Who holds a number, what it costs, when it goes back → `clinqet-voice-number-lifecycle`

Since 2026-10-02 the number itself has a lifecycle of its own and ONE writer, `VoiceNumberCoordinator`. This
skill still owns what a number does when it rings. Before touching anything that assigns, removes, buys, holds
or returns a number — or `VoiceAssistantState.AssignedNumber`, `NumberAssignmentGeneration`, the admin
assign / remove / change / release flows, or the dedicated-mode "number we ring you on" — read that skill.
Three facts that changed here:
- In dedicated mode the number we ring is SERVER-OWNED: adopted at submit from the primary owner's confirmed
  phone (and held to the destination rules), changed only by an admin applying a reviewed request. The form
  never carries it.
- A line write carries the number's generation; an older one is refused (`VoicelineProjector`).
- Parked is a reservation on the NUMBER (`ReservedForLastBusiness`), not a date on the line.
