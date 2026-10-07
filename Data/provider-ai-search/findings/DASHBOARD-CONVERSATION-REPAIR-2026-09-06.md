# Dashboard and conversation repair — implementation and audit

Updated 2026-09-07. M10 approved by the owner in this conversation. Source changes are local; no deployment was performed. Other tasks changed backend and source/dictation components concurrently; their changes were preserved. This is an audit of the affected flow, not a claim that the entire platform or every physical device was verified.

Mockup: [M10](../../mockups/business-search-conversations/index.html), registered in [PLAN](../PLAN.md). M10 supersedes M7 for the transcript and Back/New controls, and M1 for history reopening.

## Video evidence

Reviewed sampled frames from the 1:53 recording at `C:\Users\nik.adhaduk\Downloads\Video.810330072.396493_0547.mp4`. Blank pull-down space and loading appear around 8 and 20 seconds; later frames show the dashboard, search dialog and drawer. Tap positions are not consistently visible, so the recording cannot prove the cause or number of missed taps. No audio transcription. The original video is untouched; extracted review frames were removed.

## Delivered behavior

- The web dashboard has one viewport shell and one main content scroller. Search/inbox own their internal scroll area. Visual viewport resize/offset updates are animation-frame scheduled without React scroll renders.
- Search and drawer use a native top-layer dialog portal with immediate open/close, browser focus/inert behavior, Escape and backdrop dismissal. Close/send/menu targets are at least 44px.
- WebKit testing exposed an actual 320px hit-target overlap: the workspace chip covered the hamburger. A responsive grid now places title/workspace above actions below md, preserving all controls and the title.
- Removed production DOM/event monkeypatches (`devErrorSuppressor.js` and imports). They altered event-listener identity and suppressed genuine rendering failures.
- Sidebar prefetch happens on intent, not in a bulk effect when a hidden sidebar mounts. Header catalog reads are lazy and business/member scoped.
- Anchored panels clamp to the visible viewport, including keyboard and zoom offsets.
- Service rows render without mount staggering. The promo card uses a static border, removes stacked backdrop blur, and pauses its timer off-screen or in a hidden document. Native promo pauses on app background and navigation blur. Observers, subscriptions and timers are released.
- Web and native Ask render a continuous transcript. Follow-ups append under prior answers. Back returns to the list; New clears session and composer; Android Back follows the native conversation/list flow. Leaving aborts active work.
- Recent history is eight device-local conversations scoped by business and member, with stable first-question titles. History performs a free session GET; it never re-asks the question. Full saved text reopens. Saved records do not carry source/feedback identities, so replay does not invent them.
- Sources, feedback and answer IDs belong to each live exchange. Older rows remain stable while new deltas are batched to rendering frames. New/reopen remounts the speech composer; late responses cannot populate another workspace or conversation.

## Limits and consistency

| Boundary | Implemented contract |
|---|---|
| Readable transcript | Up to 50 question/answer exchanges, or the independent history size ceiling |
| Model context | Most recent 6 exchanges, projected by the agent; older UI history remains readable |
| Stored history | Maximum 1 MiB serialized History; worst-case escaped next pair is reserved before admission |
| Answer text | Maximum 32,768 UTF-16 code units; never split a surrogate pair; mark output-bound answers partial |
| Retention | Existing seven-day inactivity TTL unchanged |
| Usage allowances | Existing minute/day limits unchanged; New does not reset them |
| Save concurrency | Client expectedTurns + one ETag CAS against the exact context used for the answer |
| Completion | Done.saved acknowledges durable write and carries authoritative turnCount/maxTurns/canContinue |
| Uncertain write | Block another ask until a free GET reload; never silently create a replacement conversation |
| Post-disconnect persistence | Independent configured 15-second timeout |

Fifty is an initial product setting, not an industry standard. Keeping six model exchanges bounds cost; it does not promise perfect recall of arbitrary older details. No new schema, container, index, queue or TTL change was introduced by this repair.

## Audit findings fixed during implementation

1. A saved partial answer lost its warning when Done acknowledged the write. Both clients now preserve frame.partial independently of save success.
2. Native SSE swallowed callback failures and reported success; it now rejects, aborts and releases handlers/listeners/timers. Web stream reader cleanup also releases its reader lock.
3. Preparation before the agent's inner try could leave the channel reader waiting forever. The outer producer wrapper completes the channel with that failure; a bounded regression test exercises it.
4. Stopping output immediately at the character cap lost the model's final usage frame. The model leg is drained for usage while further text is suppressed; Unicode-boundary and usage assertions cover it.
5. A fresh PeriodicTimer wait per delayed answer frame overlapped the previous pending wait. The controller now retains one pending tick across frames and cancels pending producer work on abnormal exit. Delayed scripted chunks reproduce the original failure.
6. Generic Task<bool>.ConfigureAwait(SuppressThrowing) is invalid; cleanup observes the non-generic Task instead. This was found while testing the timer repair.
7. Another task made media allow-lists mandatory. The integration fixture now imports only the API's MediaConstraints sections while keeping all connections pointed at its local containers; validation is not bypassed.
8. The production bundler found FloatingTextarea.jsx on disk while Git and imports use floatingTextarea.jsx. Disk casing now matches the tracked path, without changing component contents.

## Verification

VERIFICATION_PENDING

## Practical limits

Browser tests use the real local application with isolated API fixtures; backend integration separately exercises the HTTP pipeline and Cosmos emulator. These checks do not measure physical iPhone/iPad Safari frame rate, OS keyboard/VoiceOver behavior, real-network latency or native release rendering on iOS/Android. Those device acceptance checks remain necessary before claiming universally smooth production behavior. No device performance number is invented.

## Cleanup

Deliverable regression tests, mockup and this audit remain. Temporary video frames, test logs, browser captures and diagnostic-only code are removed at close-out. Existing unrelated working changes are preserved.
