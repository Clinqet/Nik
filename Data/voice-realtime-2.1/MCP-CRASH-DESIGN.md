# India AI calls when the MCP host restarts, crashes or hangs — design for owner review

Status: ✅ **OWNER-APPROVED 2026-09-26** — "Approve all three layers" and the §6 Cosmos TTL change "Approve" (owner, in
conversation). Owner direction when approving: "super solid… no loophole… handle every single edge case… no workaround, no
shortcut. Quality over speed." Date: 2026-09-26.
Scope: India (Plivo) only. Canada/US is not affected: there the caller's audio runs Telnyx ⇄ Azure SIP directly and the MCP
monitor only watches, so an MCP failure never silences a Canada/US caller.

## 1. The problem

On an India AI call the caller sits in a Plivo conference (MPC). The AI is a second participant whose audio is a WebSocket
stream into **our MCP host**, which relays it to Azure. The relay is the only thing that can talk to the caller or hand them
on. If the MCP process stops running that relay, the caller is left alone in silence until they give up.

Already handled (built 2026-09-26): an Azure drop mid-call (reconnect, else voicemail), a refused setup, a failed Plivo
stream while the relay is alive. What is NOT handled is anything where **the relay itself stops running**:

| # | Failure | How often | What happens today (verified in code) |
|---|---|---|---|
| F1 | **Planned restart**: deploy, slot swap, scale-in, platform recycle | Every deploy | `PlivoVoiceRelay` is not a hosted service; the container disposes it, `_stoppingCts` cancels every session, the finally block deliberately skips the call-end message. **Every live India caller is left in silence.** |
| F2 | **Crash / kill**: out-of-memory, process killed, VM lost | Rare | No code runs. The AI's stream socket dies with the process. Caller left in silence. |
| F3 | **Hang**: deadlock, thread starvation, long GC pause, network cut between MCP and Plivo | Rare | The socket may stay half-open, so Plivo may report nothing. Caller left in silence, possibly with no event at all. |

## 2. Industry-standard principles this design follows

1. **Supervise from outside the process.** A process cannot report its own death, so failure detection must come from an
   independent party — here the **carrier** (authoritative call-state events) and a **liveness lease** (a heartbeat that
   expires on its own when nobody renews it).
2. **Defence in depth.** One layer per failure class: graceful drain for planned restarts (F1), carrier events for crashes and
   network loss (F2), an expiring lease for silent hangs (F3). No single signal is trusted to cover everything.
3. **Confirm, then act.** An event only *triggers* a check; the action happens after a short confirmation against the real
   state (call still live, caller still present, AI gone). This is what stops a normal goodbye, hand-over or hang-up from ever
   being mistaken for a failure.
4. **Idempotent and bounded.** Deterministic message ids + the existing phase check (CAS) mean any number of duplicate events
   rescue a caller at most once. Every wait has a configured ceiling; nothing polls forever.
5. **One rescue path.** Every layer ends in the SAME hand-off already built and tested: `VoicePostCallKind.AiSessionLost` →
   Functions host checks the caller is still in the conference → voicemail (or hang-up when no disclaimer was played, §19).

## 3. The three layers

### L1 — Graceful drain on planned restart (fixes F1)
The standard "connection draining" pattern, done by the MCP host itself while it still can:
- Make the relay a hosted service with a `StopAsync`. On shutdown it **stops accepting new AI streams** (Plivo is told no, so
  the existing AI-join confirmation sends that caller to voicemail as it does today for a failed join).
- For each live call: if the AI is mid-sentence, let that sentence finish (bounded); then the AI says ONE short line in the
  caller's language — that it has to pass them to voicemail to leave a message — and the relay enqueues `AiSessionLost`.
  A call already saying goodbye just completes its hang-up.
- The whole drain is bounded by a setting (default 20 s, inside the host's shutdown grace period). Anything still running
  when the bound expires is handed off without the spoken line.
- Why not "keep the call alive until it ends": calls last up to 30 minutes; no host waits that long, and a half-drained host
  blocks the deploy. The bounded hand-off is what production contact-centre platforms do.

### L2 — Carrier events for crash and network loss (fixes F2, most of F3)
Two independent Plivo signals, both of which already reach (or can reach) the **Functions host**, which does not depend on MCP:
- **AI stream status callback** — Plivo's `ai_agent_stream_status_callback_url` on the AI participant (documented by Plivo;
  **we do not set it today**). We add it, pointing at a new route on the existing Plivo webhook function.
- **Participant-left event** — `ParticipantExit` for the `ai-agent` role on the conference's status callback (the conference
  already subscribes to `participant-state-changes`; the code records these events arrive live; **we ignore them today**).

Either event, while the session is still live (phase `AiHandoff`/`Active`), schedules ONE confirmation check a few seconds
later (setting, default 5 s; deterministic id per call). The check rescues only if all hold: phase still live, the caller is
still in the conference, and the AI member is gone or its stream is down. A normal end moves the phase or removes the caller
inside that window, so the check does nothing.

### L3 — Liveness lease for silent hangs (fixes the rest of F3)
For the case where the process is alive-but-stuck and Plivo sees nothing wrong:
- The relay already writes a per-call **live-call marker** document at activation. It gets a SHORT expiry (default 45 s) and
  the relay re-writes it every 15 s while the call is healthy. Cosmos stops returning an expired document on reads, so a
  stuck or dead relay makes its marker disappear on its own.
- The Functions host runs a per-call **liveness check chain** (a scheduled Service Bus message every 20 s, started at the AI
  hand-off, stopping when the phase leaves `AiHandoff`/`Active`). A check that finds the marker gone on a live call triggers
  the same confirm-then-rescue as L2.
- Side benefit: the live-calls list and the provider-join "is this call really live" check stop trusting stale markers after
  a crash (today a dead call's marker lives for hours).

Detection targets: L1 immediate (planned); L2 about 5–10 s after Plivo reports; L3 at most about 65 s (lease + one interval) —
the backstop for the rarest case.

## 4. Edge cases and what happens

| Case | Result |
|---|---|
| AI says goodbye (`end_call`) → relay hangs up the caller → AI leaves | Phase/caller gone before the check → nothing |
| Provider joins, AI dropped for the bridge | `ReferredToPartnerAt`/phase moved → nothing |
| Relay already reconnecting Azure (built today) | AI participant does not leave; marker still renewed → nothing |
| Relay already handed off (refused setup / lost Azure) | Phase `Voicemail` → nothing |
| Caller hangs up during the check window | Caller not in conference → nothing |
| Both L2 events and an L3 expiry for the same call | Same deterministic hand-off id + phase CAS → one rescue |
| Participant read fails at the check | Treated as present (rescue a live caller) — same rule as today's hand-off |
| No disclaimer played yet | Existing §19 rule: hang up, never record |
| Stream status callback arrives for an unknown or finished call | Logged, ignored |
| MCP restarts and Plivo retries the AI stream to a new instance | New stream binds as today; marker renewed by the new owner → nothing |
| Every India AI call failing (systemic) | One admin alert per hour (deterministic dedupe), not one per caller |

## 5. What changes (proposal)

- MCP: relay becomes a hosted service with a bounded drain (L1); marker renewal loop (L3).
- Infrastructure: `AddAiAgentMemberAsync` sets `ai_agent_stream_status_callback_url` (+ method).
- Functions: new route on the existing Plivo webhook function for the stream status callback; `ParticipantExit` handling for
  the `ai-agent` role; a scheduled confirmation check; the liveness check chain. All end in the existing `AiSessionLost`
  hand-off.
- Settings (appsettings only; no `local.settings.json` key, so no ARM/`deploy.ps1` change): drain bound, confirmation delay,
  lease length, renewal interval, liveness interval. Class defaults mirror appsettings.
- Admin alert: `RealtimeRelayLost` — "India AI receptionist stopped serving a live call" (deduped hourly).
- No new Azure resource, queue, container or Service Bus topic.

## 6. Needs your explicit approval (CLAUDE.md §0.7)

| What | Detail |
|---|---|
| **Cosmos TTL change** on the existing live-call marker (`VoiceBusinessLiveCall`) | From `LiveCallRegistryTtlHours` (hours) to a short lease (default 45 s) renewed every 15 s. No new field, no new container, no new index. |
| **Who reads it** | The new liveness check (L3), plus the existing live-calls list and provider-join check, which become more accurate. |
| **Who writes it** | The relay: at activation (as today) and on each renewal. |
| **Cost** | One small upsert per live India call every 15 s (about 4/min, about 120 for a 30-minute call); one point read per liveness check (every 20 s). Service Bus: about 3 scheduled messages per call-minute. |
| **What breaks if omitted** | L3 cannot exist: a hung relay (F3 with no carrier event) leaves the caller in silence. L1 and L2 still work. |

## 7. What a dev call must confirm before we trust L2 (Plivo does not document it)

Plivo's multiparty-call docs list the stream status callback and the participant events, but not their exact fields, nor
what happens to the AI participant when its stream server disappears. On a dev India call we will:
1. Kill the MCP process mid-call → record which callbacks arrive (stream status and/or `ParticipantExit`), their fields
   (member id, call UUID, role, reason) and how many seconds after the kill.
2. Freeze the MCP process (no crash) → confirm whether any event arrives (decides how much L3 carries).
3. Deploy (planned restart) mid-call → hear the L1 line and reach voicemail.

The handler will be written to the fields we observe, never to guessed ones.

## 8. Tests (all mandatory, per §0.8)
- Unit: drain ordering and bounds; confirmation-check matrix (every row of §4); marker renewal cadence; lease-expiry check.
- Integration (real Cosmos + Service Bus processor): event → scheduled check → voicemail on the real session, once across
  redelivery; normal-end rows leave the real session untouched; marker expiry → rescue.
- Sabotage checks on the confirm step, the presence check and the lease expiry.

## 9. As built (2026-09-26) — what the build added to, or changed in, the approved text

All three layers and the §6 TTL change are built as approved. Building them to "no loophole" surfaced these, each fixed
in the same change (the skill `clinqet-voice-assistant` 2026-09-26b carries the full detail):

1. **‼️ The India fix committed earlier today had a dead guard.** `GetMpcParticipantsAsync` returns an EMPTY list on any
   failure, so "an unreadable list counts as present" never ran: a Plivo API failure read as "the caller left" and the
   rescue was skipped. New `ReadMpcParticipantsAsync` is tri-state (404 = nobody there; any other failure = Unavailable).
2. **‼️ The relay's own call-end copy would have lost the voicemail transcript after an outside rescue.** It shared
   `vpc-end-{callId}` and was sent BEFORE a rescue in the failure cases, winning the 40-minute dedup. The relay now never
   sends `CallEnded`; every session ends with a deferred `PlivoCallEndBackstop` the Functions host decides (phase, lease,
   member list), so the caller-hangup message always wins.
3. **‼️ A normal goodbye would have been read as a lost relay.** The relay used to close the AI stream right after asking
   for a hangup, and the AI's `ParticipantExit` check could then move a caller who was being hung up to voicemail. Relay
   hangups now keep the stream (caller muted) until Plivo ends it, bounded by `Plivo:AiHangupWaitSeconds`.
4. **The relay's activation flipped ANY phase but `Ended` to `Active`** — a stream coming up late could pull a rescued
   caller back to the AI. It now flips only `AiHandoff`/`Active` and otherwise stands down.
5. **Fencing on both sides.** A relay session that declares itself gone fences its own marker (instance + start time), and
   on Plivo a `HangupCall` is ignored unless the phase is still `AiHandoff`/`Active` (a relay waking from a stall cannot
   hang up a caller already in voicemail).
6. **Joins.** A rescue waits out a ringing provider join (bounded, so a stuck claim cannot suspend supervision), and entering
   voicemail abandons the join in the same CAS, so a late answer cannot bridge into a conference the caller left.
7. **A faulted Plivo stream no longer hands off blind** — it asks the host to check, because Plivo may reconnect the stream
   to another instance (§4 "MCP restarts and Plivo retries").
8. **§5 said "no deploy.ps1 change".** L1 needs the platform to allow the drain: App Service kills a Linux container 5 s
   after the stop signal by default. `deploy.ps1` now sets the existing app's `WEBSITES_CONTAINER_STOP_TIME_LIMIT`
   (`-McpContainerStopSeconds`, 60) — an app setting on an existing resource, not a new resource or `local.settings` key —
   and `Mcp:HostShutdownSeconds` (45) sets the host's own budget; the host logs an error at start if the platform limit
   is shorter. Whether this setting is honoured for a code (non-container) Linux app is dev-call check §7.3.
9. **Expiry is computed, not trusted.** The marker maps Cosmos's `_ts` read-only and every reader uses `_ts + ttl`; the
   emulator was seen both returning expired items and purging them on its own schedule, so computing expiry makes every
   reader agree whatever the store does. No new stored field, no index change.
10. **A call that ended during the drain would still have been handed on.** The drain sent `AiSessionLost` after the
    spoken line even when the caller hung up while it played, and past the bound for a session still tearing itself down.
    That session's own teardown already asks the host to check; the extra hand-off could, with an unreadable member list,
    stamp a finished call as voicemail. Both places now skip a session that is already ending.
11. **A rescue that kept losing would have ended supervision.** The processor dead-letters on the final delivery, so a
    periodic check whose rescue lost every compare-and-set five times took the chain down with it. The next tick is now
    armed (deterministic id) before the retry is asked for.
12. **The drain's hosting and every timing rule were untested wiring.** They sat inline in both `Program.cs` files, and
    every relay test calls `StoppingAsync` by hand, so deleting the hosted-service line would have switched the drain off
    with every test green. They now live in `AddPlivoVoiceRelay` (MCP) and `AddFunctionsPlivoSettings` (Functions), each
    unit-tested, and each real host is tested for them (MCP `PlivoVoiceRelayHostingIntegrationTests`; Functions
    `FunctionHostCompositionIntegrationTests` under every stamp).
13. **Two lease tests depended on the emulator's purge timing** (a sabotaged `IsExpired` passed one of them). They now move
    the host's clock — the two MCP endpoints read `TimeProvider` — while the store, on the real clock, still holds the marker.

Deploy the Functions host before MCP (an old Functions host would dead-letter the two new message kinds).
