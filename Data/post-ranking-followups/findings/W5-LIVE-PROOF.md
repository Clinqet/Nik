# W5 — the knowledge dead-letter handler, proven on the sandbox (2026-09-30)

Run through the live harness (`scratchpad/proof/live`, the REAL Functions composition captured from the host's own
`Program`) with the NEW handler: `deadletters` receives every message in the region's `knowledge-ingest` dead-letter
queue and runs `HandleDeadLetterAsync` on it exactly as `ProcessKnowledgeIngestDeadLetter` does, completing on success.
The admin alert goes through the real `admin-alerts` queue and is stored by the DEPLOYED alert processor.

## India (`knowledge-ingest-dev/$DeadLetterQueue`) — the two messages PLAN §2A named

| Message | Reason | Row now | Expected (PLAN §2A) | What happened |
|---|---|---|---|---|
| `6TCWOI:d1ec7d72…:Full:639262710023643373` | `KnowledgeIngestProcessingFailed` (dead-lettered 2026-09-29 by the old handler — no `KnowledgeAlertPublished` property) | SBI Life brochure, Ready, 102 passages | removed, no second alert, row untouched | **removed, no alert, row untouched** |
| `6TCWOI:a3d2d508…:Full:639262710022808681` | `MaxDeliveryCountExceeded` (killed 5 times — the out-of-memory incident) | Glanza, Ready (re-read by the W3 proof, 110 passages) | ONE alert with the body; the row is failed only if still on that reading | **one alert; row untouched** — the row's reading had ended, so there was nothing to fail |

The stored alert (sandbox admin list, 15:13:43 UTC):
`SystemError · Critical · "Critical system failure in KnowledgeIngestProcessing. Details: Knowledge work item dead-lettered
with no alert: Reason=MaxDeliveryCountExceeded; Description=Message could not be consumed after 5 delivery attempts.;
DeliveryCount=6; Mode=Full; BusinessId=6TCWOI; DocId=a3d2d508…; Document='Toyota Glanza E-Brochure'; Row=Ready;
ReadingEpoch=639262710022808681; MessageId=…"` followed by the outcome sentence and the body.

After the run: India dead-letter queue **0** messages. Canada's was already empty.

Found while running it, fixed before commit: the alert's outcome sentence said "marked Failed if it is still on this
reading" even for a row whose reading had long ended. It now states what applies — the reading has ended (with its status),
a newer reading has begun, or this reading is marked Failed — and the unit tests pin each sentence.

The Failed stamp itself (a row still on the dead reading) and a concurrent Read again winning inside the commit are proven
on the real Cosmos emulator (`KnowledgeDeadLetterIntegrationTests`); the sandbox had no row in that state to use.
