---
name: clinqet-messaging
description: |
  **CORE FEATURE SKILL** — Work on the Messaging feature end-to-end. Direct messages,
  context-bound conversations (Direct / Broadcast / Quote / Booking), composite keyset
  pagination on messages (cursor = base64(createdAt|id)), per-side soft-hide with TTL,
  mute parity (provider + customer), attachments via the media-derivatives pipeline,
  read receipts via SignalR, DirectMessage email enabled.
  USE FOR: conversation/message CRUD, pagination, mute/unmute, archive, hide (per-side
  soft-delete), block/unblock, send/upload/attach, SignalR `ConversationRead`,
  `DirectMessageReceived` notification, MessagingSettings tuning. Applies to clinqetcore
  Entities (Conversation, Message, MessageAttachment, BidMessageData), clinqetinfrastructure
  Data/COSMOS/MessageRepository.cs + ConversationRepository.cs, Services/Messaging/,
  clinqetapi Controllers/Messaging/, clinqetwebuserapp + clinqetwebpartnerapp messages UIs.
---

# CLINQET MESSAGING — COMPREHENSIVE SKILL

## ENTITIES (`clinqetcore\Entities\COSMOS\Cosmos.cs`)

### `Conversation` (~line 2946)
- Container: `Communications`. Partition key: `/userNumber` — **per-side ownership**: each conversation has TWO Conversation docs, one per participant.
- Document id: `{userNumber}_{conversationId}`.
- Key fields:
  - `conversationId` (deterministic — see `ConversationService.GenerateConversationId`)
  - `userNumber` (pk, owner side), `otherParticipantId`, `otherParticipantName`, `otherParticipantType: SenderType`, `otherParticipantProfilePicUrl` + derivative URLs (`ThumbUrl`, `MediumUrl`, `Width`, `Height`)
  - `context: ConversationContext` (Direct, Broadcast, Quote, Booking), `contextId?`, `contextTitle?`
  - `status: ConversationStatus` (Active, Archived, Blocked, Closed)
  - `unreadCount` (per-side)
  - `lastMessagePreview`, `lastMessageAt`, `lastMessageSenderId`, `lastMessageType`
  - `broadcastData?: BroadcastConversationData`
  - `activeChannels: List<MessageChannel>`, `externalChannelIds: Dict`
  - **`isMuted`** + **`mutedUntil?`** — per-side mute
  - **`isHidden`** — per-side soft-delete
  - **`ttl?`** — Cosmos auto-delete; set on active Direct (365 days) or after Close (90 days); null for Broadcast/Quote/Booking
  - `slaDueAt?`, `firstReplyAt?`, **`replyCycles?: List<ReplyCycle>`** (`{ wroteAt, answeredAt? }`) — business side only, `[System.Text.Json.JsonIgnore]`, see the customer-wait clock and REPLY CYCLES sections

### `Message` (~lines 2393-2457)
- Container: `Messages`. Partition key: `/conversationId` — all messages in one conversation live together.
- Document id: `{conversationId}_{messageId}`.
- Key fields:
  - `messageId`, `conversationId` (pk)
  - `senderId`, `senderType: SenderType` (Customer, Provider, System), `senderName`
  - `messageContentType: MessageType` (Text, Bid, BidUpdate, BidWithdrawal, BidAccepted, BidRejected, System, Attachment)
  - `content?` (nullable; required if no attachments)
  - **`attachments: List<MessageAttachment>`**
  - `bidData?: BidMessageData` (when messageType is Bid*)
  - `channel: MessageChannel` (default Platform), `externalMessageId?`, `externalChannelData?`
  - `isRead`, `readAt?`
  - `systemEventType?` (for System type)
  - `replyToMessageId?` (reply chain)
  - `isEdited`, `editedAt?`
  - **`ttl?`** — 365 days for active Direct, null otherwise

### `MessageAttachment` (~lines 2459-2495) — uses media-derivatives pipeline
`attachmentId`, `url` (original blob), `fileName`, `mediaType`, `fileSizeBytes`, **`thumbnailUrl?`**, **`mediumUrl?`**, `width?`, `height?`, **`processingStatus: MediaProcessingStatus`** (`Pending`→`Processing`→`Completed`/`Failed` — note: messaging uses `Completed`, while reviews use `Ready` per agent map; the enum string-set is shared), `processedAt?`.

### `BidMessageData` (~lines 2497-2518)
`amount: decimal`, `currency` (default "USD"), `estimatedDuration?`, `availableFrom?`, `notes?`, `status: BroadcastBidStatus`.

---

## CONTAINERS & INDEXES

`C:\Nik\clinqetcore\Cosmos\Setup\CosmosContainerPolicies.cs` ~lines 512-549:

**Communications** (Conversation): pk `/userNumber`, TTL -1 (per-doc).

**Messages**: pk `/conversationId`, TTL -1 (per-doc).
- Included: `/type/?`, `/createdAt/?`, `/messageType/?`, `/senderId/?`, `/isRead/?`, `/attachments[]/attachmentId/?`.
- Composite indexes:
  1. `(/type ASC, /messageType ASC, /createdAt DESC)` — filter + order
  2. **`(/type ASC, /createdAt DESC, /id DESC)`** — **KEYSET PAGINATION** index
  3. `(/type ASC, /isRead ASC, /senderId ASC)` — read-status queries

**Hard rule (memory `feedback_cosmos_emulator_vs_prod_matcher.md`):** filter columns must lead in `ORDER BY` so the prod composite index binds. Add string-shape SQL unit tests; the emulator is more permissive than prod.

---

## ENUMS

`MessageType`: Text, Bid, BidUpdate, BidWithdrawal, BidAccepted, BidRejected, System, Attachment.
`ConversationContext`: Direct, Broadcast, Quote, Booking.
`ConversationStatus`: Active, Archived, Blocked, Closed.
`MessageChannel`: Platform, SMS, …
`SenderType`: Customer, Provider, System.
`NotificationType` (subset): `DirectMessageReceived`, `BroadcastMessageReceived`.
All have `[JsonConverter(typeof(JsonStringEnumConverter))]`.

---

## DTOs (`clinqetshared\DTOs\Messaging\`)

**MessageDtos.cs**
- `SendMessageRequestDto { messageId?, content, messageType, attachments[], replyToMessageId? }`
- `MessageAttachmentUploadUrlRequestDto { files[] }` (FileName, ContentType, FileSize)
- `MessageAttachmentUploadUrlResponseDto { isSuccess, messageId, uploadUrls[] }`
- `MessageAttachmentUploadUrlDto { uploadUrl, fileUrl, attachmentId, blobName, expiresAt, isSuccess, errorMessage? }`
- `MessageAttachmentDto { attachmentId?, url, fileName, mediaType, fileSizeBytes, thumbnailUrl?, mediumUrl?, width?, height?, processingStatus, processedAt? }`
- `MessageResponseDto`, `MessagePagedResultDto { messages[], continuationToken? }`, `BidMessageDataDto`

**ConversationDtos.cs**
- `CreateConversationRequestDto`, `ConversationResponseDto` (includes profile-pic derivatives + `isMuted`, `isHidden`), `MuteConversationRequestDto { isMuted, mutedUntil? }`, `ConversationPagedResultDto`, `MarkConversationAsReadResult`.

---

## REPOSITORIES

### `MessageRepository.cs` (`clinqetinfrastructure\Data\COSMOS\`)

- `CreateMessageAsync(message)` — composite id `{conversationId}_{messageId}`.
- **`GetByConversationIdAsync(conversationId, pageSize, continuationToken, cancellationToken)`** → `(IEnumerable<Message>, string?)`
  - **Keyset pagination, NOT offset**. Cursor = base64 of `"{createdAt:o}|{id}"`. Decoded → `WHERE c.type = 'Message' AND (c.createdAt < @at OR (c.createdAt = @at AND c.id < @id)) ORDER BY c.type, c.createdAt DESC, c.id DESC`.
  - `id` tiebreaker is **intentional** — it prevents cross-replica tick-collision skips (memory `project_message_keyset_pagination`).
  - Page size: `Math.Min(requested, _maxPageSize)` where `_maxPageSize = MessagingSettings.MessageMaxPageSize` (200).
- `GetLatestBidAsync(conversationId)` — TOP 1 Bid/BidUpdate by createdAt DESC.
- `MarkAsReadAsync(conversationId, messageId)` — patch `/isRead=true`, `/readAt=now`.
- `MarkAllAsReadByRecipientAsync(conversationId, recipientId)` — transactional batch patch (25 per batch); per-item fallback on failure. Returns count.
- `UpdateAttachmentDerivativesByIdAsync(conversationId, messageCompositeId, attachmentId, update)` — patches `/attachments[idx]/processingStatus`, `/thumbnailUrl`, `/mediumUrl`, `/width`, `/height`, `/processedAt`. Conditional on attachmentId match to prevent race.
- `SetTtlForConversationAsync(conversationId, ttlSeconds)` — batch-patch `/ttl` on all messages.

### `ConversationRepository.cs`

- `CreateConversationAsync(conversation)` — composite id `{userNumber}_{conversationId}`.
- `GetByUserNumberAsync(userNumber, pageSize, continuationToken, context?, status?)` — paged inbox. Filter `(NOT IS_DEFINED(isHidden) OR isHidden = false)`. Order `c.lastMessageAt DESC`. Cosmos continuation token (not keyset — fine because per-user inbox isn't multi-page-deep).
- `GetByIdAsync(conversationId, userNumber)` — owner-side read.
- `ResetUnreadAsync`, `IncrementUnreadAsync(userNumber, conversationId, CustomerWaitStart? waitStart)`, `EndCustomerWaitAsync(userNumber, conversationId, CustomerWaitEnd waitEnd)` — the wait clock + reply cycles (below).
- `GetReplyCyclesAsync(userNumber, activeSince, activeBefore?, maxItems)` → `ConversationReplyRow { conversationId, replyCycles }` — the nightly scoring read (below).
- `SetMuteAsync(userNumber, conversationId, isMuted, mutedUntil?)` — `/isMuted`, `/mutedUntil` (null when off).
- `SetHiddenAsync(userNumber, conversationId, isHidden)` — `/isHidden`, also clears `/unreadCount=0`.
- `BlockAsync`, `UnblockAsync`, `UpdateStatusAsync`.
- `UpdateSummaryAsync(userNumber, conversationId, preview, messageAt, senderId, messageType, activeTtlSeconds?)` — patches `/lastMessagePreview` (truncated 100 chars), `/lastMessageAt`, `/lastMessageSenderId`, `/lastMessageType`, `/isHidden=false`, `/updatedAt`, optionally `/ttl` (restore active TTL when message arrives on hidden conversation).
- `GetUnreadTotalAsync(userNumber)` — SUM over active conversations.

---

## SETTINGS — `MessagingSettings` (`clinqetshared\Models\MessagingSettings.cs`)

```csharp
Enabled = true
MaxMessageLength = 2000
MaxAttachments = 5
MaxAttachmentSizeMB = 10
MaxVideoSizeMB = 25
MaxVideosPerMessage = 1
AllowedAttachmentExtensions = [".jpg",".jpeg",".png",".webp",".gif",".heic",".heif",".pdf",".doc",".docx",".xls",".xlsx",".txt",".mp4",".mov"]
AllowedAttachmentMimeTypes = ["image/jpeg",...,"video/mp4","video/quicktime"]
ConversationPageSize = 25
MessagePageSize = 50
MessageMaxPageSize = 200
SendMessageTimeoutSeconds = 10
LoadThreadTimeoutSeconds = 15
DirectConversationTtlDays = 365
DirectMessageTtlDays = 365
ClosedDirectConversationTtlDays = 90
ClosedDirectMessageTtlDays = 90
NonDirectTtlFloorEnabled = true
NonDirectTtlFloorDays = 365
SendEmailOnBroadcastMessage = false
RateLimiting = MessagingRateLimitingSettings { ... }
```

Keep class defaults in sync with `appsettings.json` (memory: `feedback_appsettings_class_defaults`).

---

## SERVICES (`clinqetinfrastructure\Services\Messaging\`)

### `ConversationService.cs`
- `GenerateConversationId(context, contextId?, userA, userB)` → 24-hex SHA256 — alphabetically sorts users, then hashes `conv_direct_{a}_{b}` (Direct) or `conv_{context}_{contextId}_{a}_{b}`.
- `GetOrCreateAsync(currentUserNumber, name, type, profilePic, request)` — race-safe (retries on conflict). Creates BOTH side-docs. Sets TTL on Direct (365 days); every other context gets the 365-day non-Direct floor (create only).
- `GetInboxAsync(userNumber, pageSize, continuationToken, context?, status?)` — enriches with provider profile + customer display names via `ResolveDisplayNameAsync`.
- `MarkAsReadAsync(conversationId, userNumber)` — resets unread + marks recipient messages read + **broadcasts `ConversationRead` via SignalR to sender** (`SafeFireAsync` → `NotifyConversationReadAsync`; skips self-read).
- `ArchiveAsync(conversationId, userNumber)` — status=Archived; on Direct, apply 90-day TTL on conversation + messages.
- `HideAsync(conversationId, userNumber)` — `/isHidden=true`; messages remain (not deleted) for archival. **Per-side only**: the other participant's side is unaffected.
- `MuteAsync(conversationId, userNumber, isMuted, mutedUntil?)` — toggles mute state per side.
- `UpdateSummaryForBothParticipantsAsync` (internal, on send) — updates both side-docs' last-message + unread counts.
- `ResolveDisplayNameAsync` — backfills weak names (user IDs / phone numbers) from Customer / BusinessProfile.

### `MessageService.cs`
- `SendMessageAsync(conversationId, senderNumber, senderName, senderType, request, context)` — creates Message, applies TTL (365 for Direct; otherwise the 365-day non-Direct floor), maps attachments, publishes `MediaDerivativeQueueMessage` per image/video attachment.
- `SendBidMessageAsync`, `SendSystemMessageAsync`.
- `GetMessagesAsync(conversationId, userNumber, pageSize, continuationToken)` — keyset paginate; **reverses results** so the client renders oldest-first.
- `MarkAsReadAsync(conversationId, userNumber)` — delegates to repo helper.
- `ProcessPostSendActionsAsync` — updates summaries, dispatches `DirectMessageReceived` notification, broadcasts SignalR.
- **Message-sent admin alert (temporary, post-launch monitoring):** `RaiseMessageSentAdminAlertAsync` raises a gated `AdminAlertType.MessageSent` (Low) inside `ProcessPostSendActionsAsync` (the fire-and-forget `SafeFireAsync` path ⇒ zero request-path cost). Gate `Messaging:SendAdminAlertOnMessageSent` (default true) via the NEW optional trailing `IConfiguration?` ctor param, read once into a readonly bool. Covers genuine customer↔provider chat (controller already rejects System/Bid types). Provider/customer mapped by `SenderType`; both numbers + names come from the method params + `ConversationResponseDto` (OtherParticipant*) — ZERO extra DB calls. NO message content; `MessageId` is embedded in the Description so each distinct message alerts (the `AdminAlertProcessor` dedup key is content-based and excludes Metadata). See memory `project_quote_message_admin_alert_gates_2026_06_07`.

---

## CONTROLLERS (`clinqetapi\Clinqet.API\Controllers\Messaging\`)

### `ConversationController.cs`
Base `/api/v{version}/conversations`. `[Authorize]` (JWT). CORS `B2CPolicy`.

| Verb | Route | Body | Notes |
|------|-------|------|-------|
| POST | `/` | `CreateConversationRequestDto` | 10s timeout |
| GET | `/` | — | `pageSize`, `continuationToken`, `context?`, `status?`; 15s |
| GET | `/{conversationId}` | — | 15s |
| PATCH | `/{conversationId}/read` | — | broadcasts `ConversationRead` |
| PATCH | `/{conversationId}/archive` | — | |
| DELETE | `/{conversationId}` | — | **soft-hide per side** (not destructive) |
| PATCH | `/{conversationId}/block` / `/unblock` | — | |
| PATCH | `/{conversationId}/mute` / `/unmute` | `MuteConversationRequestDto` | |

### `MessageController.cs`
Base `/api/v{version}/conversations/{conversationId}/messages`. `[Authorize]`. CORS `B2CPolicy`.

| Verb | Route | Notes |
|------|-------|-------|
| POST | `/upload-urls` | `MessageAttachmentUploadUrlRequestDto`; validates conversation exists + open + attachment count/sizes/MIME; returns SAS URLs. |
| GET | `/` | `pageSize` (1-100), `continuationToken?`; keyset pagination; 15s |
| POST | `/` | `SendMessageRequestDto`; rate-limited (30/min); validates length, attachments, conversation open; publishes media derivatives. |

---

## ATTACHMENT FLOW (media derivatives)

1. Client → `POST /messages/upload-urls` → server validates open conversation, returns SAS URLs (container `messageattachments`, `_storageConfig.MessageAttachments.UploadSasExpiryMinutes`, permissions Create|Write, metadata ConversationId/MessageId/UploadedBy).
2. Client → uploads blob via SAS.
3. Client → `POST /messages` with attachment metadata; server creates Message with attachments[], publishes `MediaDerivativeQueueMessage` for each image/video:
   - `ParentEntity = MediaParentEntity.Message`
   - `ParentContainer = "Messages"`
   - `ParentDocId = {conversationId}_{messageId}`
   - `ParentPartitionKey = conversationId`
   - `ParentArrayField = "attachments"`, `ParentArrayIdField = "attachmentId"`
   - `BlobContainer = messageattachments`, `BlobName`, `OriginalUrl`, `ContentType`
4. `MediaDerivativeProcessorFunction` generates WebP thumb + medium, uploads, patches via `UpdateAttachmentDerivativesByIdAsync`. PDFs/docs leave `processingStatus = null`/`Skipped`.

See `clinqet-media-derivatives` skill for the full cross-entity pipeline.

---

## REAL-TIME — SignalR

`SignalRNotificationService.cs` (`clinqetinfrastructure\Services\SignalR\`):

- `ConversationRead(conversationId, readerUserNumber, readAtUtc)` — sent to the **sender** when the other side marks read. Skips self-read (same user on multiple devices won't double-fire). Invoked via `SafeFireAsync` after the controller response.
- `ReceiveNotification(NotificationDto)` / `ReceiveNotificationBatch(...)` — used for `DirectMessageReceived` notifications. Filtered by `SignalRSettings:EnabledNotificationTypes`.

`DirectMessageReceived` MUST be in the whitelist or real-time delivery silently drops.

**Read-receipt reconciliation (client) — added 2026-06-06.** `ConversationRead` is ephemeral: never persisted and NOT replayed by `RequestMissedNotifications` (that replays Notifications only). If the sender's socket is down at the read instant (common on mobile — lock / background / Wi-Fi↔cellular handoff), the green tick is lost until a manual refetch. Both chat pages (user `messages/page.js`, partner `dashboard/inbox/page.jsx`) reconcile the OPEN conversation's read state on three triggers: `onReconnected` (forced) + window `focus` + `document` `visibilitychange→visible` (the latter two throttled to `RECONCILE_MIN_INTERVAL_MS`=8s, in-flight-guarded, and reset whenever a conversation is opened so opening never double-fetches). Reconcile = ONE `getMessages(pageSize=RECONCILE_PAGE_SIZE=30)` → forward read-watermark merge: flip `isRead` on viewer messages whose `createdAt ≤` the newest server-confirmed read viewer message; never unflips, never touches optimistic (`sending`/`failed`) messages, never disturbs scroll. `signalRService` exposes `onReconnected(cb)` for this. NOTE: `SignalRProvider` does NOT restart the socket on foreground, so once `withAutomaticReconnect` gives up (60s) and the socket fully closes, the focus/visibility path is the real backstop (it runs over plain HTTP, independent of socket state).

---

## PER-SIDE SOFT-HIDE + TTL

- Hide stored as `isHidden` on the **owner's** Conversation doc; the partner's doc is untouched.
- Inbox query: `WHERE (NOT IS_DEFINED(isHidden) OR isHidden = false)`.
- TTL:
  - Direct active: 365 days (set on create + restored on new message via `UpdateSummaryAsync`).
  - Direct archived/closed: 90 days.
  - Broadcast / Quote / Booking: a 365-day floor stamped AT CREATE only (`MessagingSettings.NonDirectTtlFloor*`). Never re-stamped on a later message, so a terminal-status patch `Set`s the shorter real window over it.
- On new message: `UpdateSummaryAsync` un-hides (`isHidden=false`), restores active TTL — so a hidden conversation pops back when the other side messages.
- Messages inherit per-conversation TTL via `SetTtlForConversationAsync` when conversation is archived.

Memory: `project_dm_per_side_delete_2026_05_08` — visible trash for direct + kebab for broadcast; provider has Mute parity UI.

---

## MUTE

- Stored as `isMuted` (+ optional `mutedUntil`) on the owner's Conversation doc.
- Notification dispatcher consults mute state when generating per-channel routes (see `clinqet-notifications`); email/push skipped if muted.

---

## FRONTEND

### User app (`clinqetwebuserapp`)
- Routes: `app/(customer)/messages/layout.js`, `messages/page.js`, `messages/loading.js`.
- Conversation list (last preview, unread badge, mute icon, hide kebab on phone, visible trash on direct).
- Chat thread: keyset pagination on scroll (uses `continuationToken`).
- Attachment upload with progress + processing-status placeholder.
- SignalR client subscribes to `ReceiveNotification` (`DirectMessageReceived`) + `ConversationRead`.

### Partner app (`clinqetwebpartnerapp`)
- Same surfaces; provider parity for Mute UI.
- Provider-profile "Message" button bootstraps conversation via `POST /conversations` (memory: `project_messaging_polish_2026_05_07`).
- iPad-responsive chat header.

### Shared rule
- All copy via `react-intl` keys.
- React 18 batching note (memory `feedback_react_promise_batching`): `setState` in `.then`/`.finally` is NOT batched — gate render bodies on the `ready` condition; include all relevant state in effect deps.
- **Message ownership = identity, never `senderType`.** A message is the other party's iff `senderId === conversation.otherParticipantId`; otherwise (and not a System event) it is the viewer's. `senderType` is stamped from the account `UserType` claim (`BaseController.GetCurrentSenderType`), so a provider-type account messaging from the customer app — or a customer-type account from the partner app — produces a mismatched `senderType`; a `senderType === "customer"/"provider"` check then mis-renders the viewer's own message as the other party's (and breaks read-receipt ticks). Both chat pages use the shared `isMessageFromViewer(message, otherParticipantId)` helper for the bubble side AND the `ConversationRead` handler. Optimistic local echoes carry no `senderId` ⇒ treated as the viewer's.

---

## TESTS

Unit (xUnit + Moq + AutoFixture):
- `MessageRepositoryTests` — keyset cursor encoding/decoding, page size capping, partition isolation, attachment derivative patch race.
- `ConversationRepositoryTests` — per-side hide, TTL restoration on new message, summary patch.
- `ConversationServiceTests`, `MessageServiceTests` — race-safe creation, dispatcher integration.

Integration (Testcontainers):
- Cosmos emulator end-to-end for composite-index ORDER BY (with the string-shape unit-test guard).
- SAS upload + `MediaDerivativeProcessorFunction` end-to-end.

---

## MESSAGE CONTENT ENCRYPTION AT REST (server-managed, NOT end-to-end)

Message content is encrypted at rest with AES-256-GCM. This is application-layer encryption at rest with a **server-managed key** — NOT end-to-end encryption (the server holds the key and can still build previews, notifications, and emails).

- **Key**: `MessageEncryption:Key` (base64 AES-256). In Azure the app setting is a **Key Vault reference** (`@Microsoft.KeyVault(SecretUri=...)`) that App Service resolves to the value via the app's **managed identity** — the code never calls the Key Vault SDK, it just reads the resolved config value. Local dev puts raw values in `MessageEncryption:Keys:N:Value` + `MessageEncryption:ActiveKeyId` (printed by `deploy.ps1` on dev/uat). Settings class `MessageEncryptionSettings` (`Enabled`, `ActiveKeyId`, `Keys[]` of {Id,Value}). Layering: base `appsettings.json` = shared `Enabled` only; `ActiveKeyId` + `Keys[]` are region-specific → API `appsettings.<region>.json` + Functions `local.settings.<region>.json` (`:` notation), committed with empty `Value` (paste the real value from the deploy.ps1 dev/uat printout for local). Infra: **Key Vault is the source of truth — NO `.deploy-secrets`**. The SAME per-region Key Vault also holds the env-scoped JWT signing key (secret `jwt-signing-key`, mirrored identically into every stamp's vault so a geo-routed token validates on either region) and the per-stamp SQL admin password (secret `sql-admin-password`); `.deploy-secrets` was DELETED and must never be reintroduced. PHASE 2e runs AFTER apps+functions deploy (so a clean first deploy resolves secrets via managed identity) and BEFORE PHASE 4. `azureautomation/keyvault.json` creates vault + RBAC only (Secrets User → API+Identity+Function MIs, Secrets Officer → deploy principal); `deploy.ps1` PHASE 2e does **create-if-not-exists** (`Get-AzKeyVaultSecret` with RBAC-propagation retry → generate + `Set-AzKeyVaultSecret` only if absent; never overwrites an existing key; rotate via `-RotateMessageEncryptionKey`), sets `MessageEncryption__ActiveKeyId` + `MessageEncryption__Keys__N__{Id,Value}` to KV references, removes the obsolete `MessageEncryption__Key`, and prints the keyset for local dev (non-prod only).
- **Protector**: `IMessageContentProtector` / `MessageContentProtector` (`clinqetinfrastructure/Services/Security/`) — pure AES-256-GCM over the configured key, **no Key Vault SDK**. Envelope `enc:v1:<keyId>:<nonce>:<tag>:<cipher>` (base64). `Protect`/`Unprotect` pass through null/empty and non-enveloped values; disabled → pass-through. **Fail-open**: empty/invalid key → `Protect` stores plaintext + `LogError` (never blocks sends); repo reads decrypt **per-row in try/catch** (`SafeDecrypt`) so one corrupt/undecryptable row can't 500 the whole conversation/inbox. Key rotation IS supported via a key-id keyset: `MessageEncryption:Keys` ({Id,Value}) + `MessageEncryption:ActiveKeyId` (key for new writes); all prior keys are retained so their records still decrypt. Rotate with `deploy.ps1 -RotateMessageEncryptionKey` (mints next `vN` secret, flips active). **Performance + thread-safety (2026-05-30 rewrite)**: the keyset is decoded/validated **once in the constructor** into immutable `readonly` fields (replacing a lazy double-checked lock that had a latent stale-read race on weak memory models) so reads are lock-free and race-free; per message = an O(1) keyset lookup + one AES-GCM op (stackalloc nonce/tag, pooled + cleared plaintext/cipher buffers, fresh random 96-bit nonce per write). Page reads use `CreateBatchDecryptor()` -> `IMessageBatchDecryptor` (single-use, single-thread, `IDisposable`) which **reuses one `AesGcm` per key id across the whole loop** (handles mixed-key pages after rotation; disposes every cipher together) instead of constructing a cipher per row. No intra-request parallelism (payloads are tiny and the server already serves requests concurrently). Keys resolved once at startup → **zero per-message Key Vault calls**. Registered as a **Singleton** in BOTH `Clinqet.API` and `Clinqet.Communications` Program.cs (the repos require it as a ctor dependency).
- **Choke points** (derived repos ONLY — never the generic base, which serves all entities):
  - `MessageRepository.CreateMessageAsync` encrypts `content` before write and restores plaintext on the returned object; `GetByConversationIdAsync` (page loop reuses one cipher per key via `CreateBatchDecryptor`) / `GetLatestBidAsync` / `MarkAsReadAsync` decrypt on read.
  - `ConversationRepository.UpdateSummaryAsync` encrypts the (already-truncated) `lastMessagePreview`; `GetByUserNumber` + `GetByContext` (page loops reuse one cipher per key via `CreateBatchDecryptor`), `GetById` / `Create` and every patch return decrypt via `DecryptPreview` / `SafeDecrypt`.
- **Only `content` + its `lastMessagePreview` copy are encrypted.** Bid amounts, names, timestamps, attachment metadata are NOT.
- **Notification payload**: the live message body rides `NotificationMessage.TransientData` (delivered via SignalR, NEVER persisted) — set from `CommunicationRequest.TransientNotificationData`. `NotificationProcessor` persists only `Data` and pushes `Data`+`TransientData` merged. The persisted notification keeps only its localized title/body, so no message text lives at rest in the Notifications container.
- **UI**: a truthful "Encrypted" lock badge (lock icon + `messages.encryptedTooltip` / `inbox.encryptedTooltip`) sits in both chat headers. Never label it "end-to-end".
- **Privacy policy**: india-privacy + north-america-privacy Security sections state encryption at rest with managed keys (explicitly NOT end-to-end).

## CHECKLIST BEFORE MERGE

- [ ] Every query specifies its partition key (`/userNumber` on Communications, `/conversationId` on Messages). No cross-partition.
- [ ] Keyset pagination cursor is encoded base64(createdAt|id); filter columns lead in ORDER BY.
- [ ] Composite index in `cosmosindexsetup\Program.cs` covers any new sort path; add a string-shape SQL unit test.
- [ ] Both side-docs updated atomically when summary/read state changes; one side is never left stale.
- [ ] TTL set on Direct (365 active, 90 closed/archived). Restored on new message. Non-Direct gets the create-time 365-day floor; the restore path stays Direct-only.
- [ ] Per-side hide; the other side untouched.
- [ ] `SafeFireAsync` used for any post-response SignalR fan-out.
- [ ] `DirectMessageReceived` (and any new types) in `SignalRSettings:EnabledNotificationTypes`.
- [ ] Attachments: SAS validated against MessagingSettings allowed lists + sizes; `MediaDerivativeQueueMessage` published.
- [ ] Localized labels/errors only — no hardcoded English in DTO annotations.
- [ ] Unit + integration tests covering the new path.

## WhatsApp channel on Conversation/Message — Phase 2 COMPLETE (2026-06-02)

The messaging model scaffolds WhatsApp (`MessageChannel.WhatsApp`, `Message.channel/externalMessageId`, `Conversation.activeChannels/externalChannelIds`, `IChannelRouter` + no-op `PlatformChannelRouter`). Phase 1 changed NO messaging entities (transactional notifications + Sign-in-OTP only). **Phase 2 made the two-way path live — full detail in `clinqet-whatsapp`:**
- **Inbound** `IMessageService.IngestInboundExternalMessageAsync` writes into the existing `Conversation`/`Message` thread (`channel=WhatsApp`, encrypted via `IMessageContentProtector`, deterministic `MessageId=SHA256(wamid)[..24]` ⇒ idempotent; 409→continue), stamps `activeChannels`+`externalChannelIds["WhatsApp"]` on BOTH side-docs (`AddExternalChannelForBothParticipantsAsync`, read-merge-patch **OrdinalIgnoreCase** — Cosmos camelCases dict keys), writes the `waconv_{wamid}` pointer, then reuses `ProcessPostSendActionsAsync` (recipient=Provider ⇒ echo guard skips the router). `SendMessageAsync` stays BYTE-UNCHANGED.
- **Outbound** `WhatsAppChannelRouter : IChannelRouter` runs inside `ProcessPostSendActionsAsync` (background fan-out, NOT the hot path), gated on `OtherParticipantType==Customer` (echo) + a non-Platform `activeChannels` entry (cost): window-open→session text, closed→debounced notify template.
- **Window banner + receipts** `ConversationResponseDto.WindowExpiresAt` is point-read in `ConversationService.GetByIdAsync` (provider-view only; LIST path untouched) for the partner 24h-window banner (no ticking timer). WhatsApp `read`→`waconv_` lookup→`POST /api/v1.0/internal/notifications/conversation-read` mirrors `MarkAsRead` (in-app `ConversationRead` SignalR; no new schema).
- **Webhook** (`WhatsAppWebhookFunction`) handles statuses + STOP/START consent + phone↔BSUID alias; non-keyword inbound enqueues to `WhatsAppInboundProcessorFunction` (the §9.7-D resolver routes it to the right provider).

---

## ‼️ MULTI-USER TENANCY — PHASE 6 (2026-08-03). Read before touching messaging or notifications.

### The routing rule that changed (L106, owner-decided)

`ConversationContext.Direct` does **NOT** mean "a private 1:1 between two people". It is what **every**
customer↔business chat uses, including WhatsApp inbound. `DirectMessageReceived` on **any** conversation
context now resolves to **`NotificationRoutingClass.ContextMessage`**:

```
unassigned thread  ->  everyone with conversation.read  +  admin
claimed thread     ->  the assignee + their team + watchers  +  admin
```

Before this, `Direct` routed to the `DirectMessage` class, which resolves `Subject.DirectTargetMembershipId`
and nothing else — **null on a shared thread, so an unclaimed customer message notified NOBODY.**

‼️ `NotificationRoutingClass.DirectMessage` is **retained but currently unreachable** (L111). Do not delete
it: `BusinessEventCategory.DirectMessage` is a SQL-persisted enum value on
`MembershipNotificationPreference.EventCategory`, and the class encodes owner-locked rule **L21** for the
member-to-member messaging that does not exist yet.

### Adding a NotificationType requires FIVE edits, and one of them is a test

1. the `NotificationType` enum member
2. a `NotificationRoutingCatalog` entry
3. ‼️ **`BuildExpected()` in `NotificationRoutingCatalogTests`** — the test keeps its OWN contract map, and its
   failure message reads as if the catalogue is stale when it is the test that is incomplete
4. a `CommunicationPreferenceConfig` category mapping
5. a `SignalRSettings:EnabledNotificationTypes` entry + title/body keys in **all five** language files

‼️ If the affected person is **not an Active membership** when the event fires (suspension, removal, an
outgoing owner after a transfer), business scope reaches the admins and **never** them —
`NotificationRecipientResolver.LoadGraphAsync` loads Active members only. Those types set
`SupportsPersonal = true` and are dispatched **twice**, once per audience, with separate
`Notification_{type}_Self_*` copy.

### The provider inbox

The provider-side `Conversation` is keyed on **`BusinessId`**, the customer-side mirror on the customer's
`UserNumber`. Controllers resolve their side through `BaseController.GetCurrentConversationParticipantId()` —
never `GetCurrentUserNumber()`.

- **Five views** (plus the Overdue filter), all single-partition: Unassigned / Assigned to me / My team / Watching / All. ‼️ `Overdue`
  (`ProviderInboxView.Overdue`) is a FILTER across those five, served by `GetOverdueForBusinessAsync`, never by keyset.
- Every view is filtered by the caller's own `conversation.read` **scope**, so the view name describes the
  query and never escalates what a member may see.
- **Atomic claim**: `IConversationRepository.TryClaimAsync` — a conditional PATCH guarded by BOTH the document
  ETag AND a `conditionExpression` asserting it is still unassigned. Never read-then-write. The 412 loser is
  told **who** holds it.
- ‼️ Unread count, mute, hide and TTL are **business-wide** on the provider side (L107). That is what makes it
  a shared queue.

### ‼️‼️ The cross-business write guard (L85)

**Every** assignment surface calls `IBusinessAssignmentGuard.TargetsBelongToBusinessAsync` before writing a
membership or team id onto a record. There is exactly **ONE** implementation, deliberately — a second copy is
where the check goes missing. Without it an assignment API is a cross-tenant write primitive.

Assignment writes currently ship for **`Conversation` and `Booking` only** (L108). `Quote`, `Invoice` and
leads are Phase 8, which adds the `ProviderData` index path in the same change as its query.

### Member lifecycle

- ‼️ **The primary owner can be neither suspended nor removed.** Ownership must be transferred first.
- Removal is a **workflow, not a delete** — the membership row survives so the business keeps its record of
  who did what, and historical actor attribution is **never** rewritten.
- Reassignment is **batched** (`Tenancy:Lifecycle:ReassignmentBatchSize`) and reports
  `ReachedBatchCeiling` rather than truncating silently.
- ‼️ Any membership/role/team/branch change must bump `AuthorizationVersion` **and** write an
  `AccessChangeQueue` row **in the same transaction**. Use `AccessChangeStaging.Stage` — it does both, so they
  can never be written apart.

### Per-branch opening hours

`BranchAvailabilityResolver` (in `clinqetcore`) is the one place the rule lives:

```
effectiveHours(branch B) = rows WHERE branchId = B  ELSE  rows WHERE branchId IS NULL
```

‼️‼️ **ABSENT ROWS MEAN INHERIT, NEVER CLOSED.** A branch that is genuinely shut carries an explicit row with
`isAvailable = false`. Treating "no rows" as "closed" would silently shut every branch nobody customised.

The search index publishes the **UNION** across active branches and its **shape is unchanged — zero new
fields**. `IBranchDirectory` supplies the active branch ids and is consulted **only** when a provider actually
has branch-tagged rows, so the common path costs nothing.

### Invitations

The token is a **credential**: ≥256 bits, **only its SHA-256 hash is persisted**, compared with
`CryptographicOperations.FixedTimeEquals`, single-use, and **both resend and revoke ROTATE the hash** so the
emailed link dies immediately. It travels in the request **body**, never a route segment. Acceptance requires
the signed-in person's **verified** email to equal the invited address — a correct token in the wrong hands
still fails. Seats are checked at issue (`CanGrantSeat`) and at accept (`IsOverTierLimit` — accepting is
**seat-neutral**, so `CanGrantSeat` there would refuse the last legitimate joiner).

### Infrastructure obligations that ship in the same change

A new `local.settings.json` key needs a `deploy.ps1` entry in the required-settings list **and** both host
blocks, plus the ARM template. ‼️ **Never edit `deploy.ps1` with `perl`** — a single non-ASCII character
corrupted it into 426 parse errors that `grep` could not see. Back it up and validate afterwards with
`[System.Management.Automation.Language.Parser]::ParseFile`.

---

## ‼️ THE CUSTOMER-WAIT CLOCK (`Conversation.slaDueAt`) — Phase 8B1, 2026-08-03

**A conversation is overdue when the customer is waiting on us and has waited longer than the target for that
kind of work.** The clock **starts** when a customer's message becomes the last one in the thread and **stops the
moment anyone at the business REPLIES — not when somebody claims it.**

```
stored as   Conversation.slaDueAt   DateTime?, NullValueHandling.Ignore, [System.Text.Json.JsonIgnore]
indexed by  /slaDueAt/?  on Communications      ‼️ NO COMPOSITE — the overdue set sorts IN MEMORY
targets     Tenancy:Inbox:SlaHoursLead 2 · SlaHoursQuote 4 · SlaHoursBooking 8 · SlaHoursDirect 24
            fallback Tenancy:Inbox:DefaultSlaHours (24) via SharedInboxSettings.SlaTargetHoursFor(context)
```

An answered thread carries **no property, no index entry, no RU**. The targets live in **both** the Main API
(which reads) and the Functions host (which writes) `appsettings.json`.

### ‼️ Rules you must not break when touching this area

| Rule | Why |
|---|---|
| **`UpdateSummaryAsync` must NEVER stamp `slaDueAt` or `firstReplyAt`** | The documents it returns are the ONLY source of the pre-message state, which is what decides whether a wait is beginning or ending. Stamping either there destroys the signal |
| **Starting the clock rides `IncrementUnreadAsync`, conditional on `FROM c WHERE NOT IS_DEFINED(c.slaDueAt)`** | It already runs on every inbound message ⇒ zero extra requests. Of two messages racing to begin one wait only the first opens it; the 412 loser re-sends the bare `/unreadCount` increment (one extra patch, race only) — the "D11 race" fix |
| **Clearing it is its own patch, conditional on the READ's ETag AND `conditionExpression: IS_DEFINED(c.slaDueAt)`** | `PatchOperation.Remove` on an absent path is a **400 that fails the whole patch**. `Set(path, null)` is NOT an alternative — it writes a JSON null, keeps an index entry, and breaks the approved cost basis. The ETag stops a reply that read an older wait from removing the NEXT wait's due date |
| **A chasing customer does NOT move the due date** | It is set from the message that BEGAN the wait. Guarded in `ResolveWaitStart`, pinned by `CustomerWritesAgainWhileWaiting_DoesNotMoveTheDueDate` |
| **`SenderType.System` neither starts nor stops it** | This is how SLA-3 ("an automated reply does not stop the clock") is satisfied **structurally**. The voice assistant writes as `Customer`; WhatsApp templates never touch this path. **Do not add an `isAutomated` flag — nothing would set it** |
| **Muted / archived / closed are excluded IN MEMORY, but the clock is still WRITTEN** | `/isMuted` has no index path. Mute is reversible: suppressing the write would silently forgive a wait that resumes on unmute |

### ‼️ FOUR summary write paths, not three

`ConversationService.UpdateSummaryForBothParticipantsAsync` (called by `MessageService`,
`BroadcastService` ×2, `BroadcastProviderService`) **and `BroadcastStatusUpdateFunction`, which calls
`UpdateSummaryAsync` / `IncrementUnreadAsync` on the repository directly.** Any signature change must account
for the fourth.

### ‼️ A defect this fixed — do not reintroduce it

`Conversation.firstReplyAt` was **never written in production**: every caller passes a synthetic stub
(`new Conversation { ConversationId, UserNumber, Context }`), so the old `stampFirstReply` flag was permanently
`false` — while `SmartAnalyticsAggregationService` read `FirstReplyAt` for the provider's average
response time. That Insights metric was empty. `firstReplyAt` is now stamped by `EndCustomerWaitAsync`, and the
`stampFirstReply` parameter is gone. ‼️ Since D11 (2026-09-29) **nothing in scoring or Insights reads
`firstReplyAt` or `lastMessageSenderId`** — both read `replyCycles` (next section). `firstReplyAt` is still written
and surfaces only as `InboxConversationDto.FirstReplyAt` (`ProviderInboxService`).

---

## ‼️ REPLY CYCLES (`Conversation.replyCycles`) — D11, 2026-09-29

**The response score and the Insights inquiry count are measured per customer wait, not per thread.** Each wait is
one `ReplyCycle { wroteAt, answeredAt? }` on the **business-side** document only, opened at the CUSTOMER'S message and
closed at the business's reply. A returning customer counts again; a thread opened without a word has no cycle and is
no inquiry (N12); a System message (`senderId = "system"`) neither opens nor closes one, so winning or losing a lead
no longer reads as "not replied" (F1 — the old rule was `lastMessageSenderId == provider`).

```
stored as   Conversation.replyCycles   List<ReplyCycle>?, NullValueHandling.Ignore, [System.Text.Json.JsonIgnore]
            absent until the first wait; NO index path (never filtered or sorted on)
capped at   Tenancy:Inbox:MaxReplyCycles  50  (SharedInboxSettings; API + Functions appsettings), oldest dropped first
types       clinqetcore/Models/Messaging/CustomerWait.cs — CustomerWaitStart(WroteAt, SlaDueAt, ExistingCycles, MaxCycles)
                                                          CustomerWaitEnd(AnsweredAt, StampFirstReplyAt, OpenCycleIndex,
                                                                          SlaDueAt, OpenCycleWroteAt, ReadETag)
            clinqetcore/Models/Messaging/ConversationReplyRow.cs — the scoring projection
```

| Write | How |
|---|---|
| **Open** (`IncrementUnreadAsync` + `CustomerWaitStart`) | Same patch as `/slaDueAt`, same `NOT IS_DEFINED(c.slaDueAt)` condition. `ExistingCycles` (from the pre-message summary doc) null ⇒ `Set /replyCycles [cycle]`; else up to 7 `Remove /replyCycles/0` trims (Cosmos's 10-op patch limit) then `Add /replyCycles/-`. A list more than 7 over the cap converges over later waits |
| **Close** (`EndCustomerWaitAsync` + `CustomerWaitEnd`) | Same guarded patch that removes `/slaDueAt` (`ifMatchEtag: ReadETag` + `IS_DEFINED(c.slaDueAt)`): `Set /replyCycles/{OpenCycleIndex}/answeredAt`. `OpenCycleIndex` is null (no cycle op, the clear still happens) when the last cycle is already answered or none exists — a wait that began before cycles existed. On 412 it re-reads and retries (fresh ETag; `firstReplyAt` only if still unset) ONLY while it is the SAME open wait (`IsTheSameOpenWait`: same `slaDueAt`, and the cycle at the index has the same `wroteAt` and no `answeredAt` — a start at the cap shifts indexes); anything else ⇒ harmless null. Bounded by `MaxConcurrencyRetries` (`CosmosDbRepository`, default 3), then a 412 `CosmosException`, which `ConversationService.EndCustomerWaitIfAnsweredAsync` logs |

**The one read — `GetReplyCyclesAsync`**, single-partition on `userNumber` (the business id on the provider side):

```sql
SELECT TOP {maxItems} c.conversationId, c.replyCycles FROM c
WHERE c.type = 'Conversation' AND c.lastMessageAt >= @since [AND c.lastMessageAt < @before]
ORDER BY c.lastMessageAt DESC
```

- Served by the existing `(type ASC, lastMessageAt DESC)` composite on `Communications` — **no index change**.
- ‼️ **Hidden threads ARE read (F9)** — hiding is a display preference, not a way out of being measured.
- Newest activity first, so a capped read is the most recent threads (S1). A wait that began in the window is a message
  in it, so `lastMessageAt` bounds every cycle that counts.
- Sole caller: `SmartAnalyticsAggregationService.ReadCustomerWaitsAsync` (nightly, Functions host), capped by
  `SmartAnalytics:MaxInquiryConversations` (500) with a warning log when hit. It feeds the Insights `Inquiries`
  (received = cycles whose `wroteAt` is in the window, replied = those with `answeredAt`) and
  `ProviderScoreEvaluator.Response` (latency from `wroteAt`, in the provider's opening hours when their schedule allows).
- It REPLACED `GetCreatedInWindowByUserNumberAsync` (conversations created in a window), which is gone.

### The shared inbox now ships SIX views

`Unassigned · AssignedToMe · MyTeam · Watching · All · Overdue`. **Overdue is a FILTER across the others, not a
sixth exclusive queue** — every row keeps its assignment state so the action offered matches it (Claim when
unassigned, Take over when held, gated on `conversation.assign`).

`GET /business/inbox` also accepts **`?context=`** (Broadcast / Booking / Quote / Direct — `/context/?` was
already indexed) and returns **`Counts` for all six views** from one narrow projection
(`GetInboxTabProjectionAsync`). ⛔ **Free-text `?q=` is CUT** and must not be drawn.
`GET /business/inbox/assignment-targets` serves the reassign dialog's workload numbers, **on demand only**.

---

## THE PROVIDER SHARED INBOX — the UI contract (Phase 8 Part B2, 2026-08-04)

The provider side of `Conversation` is a **shared team queue**, not a mailbox. Both provider apps render it
from **ONE list source** and from **ONE set of rendering rules**.

### ‼️ The list source

**`GET /api/v1/business/inbox?view=&page=&pageSize=&context=`** → `InboxPageDto`. Nothing else.

- `view` ∈ `Unassigned · AssignedToMe · MyTeam · Watching · All · Overdue`.
- `context` ∈ `Broadcast · Booking · Quote · Direct` (indexed; free-text `?q=` is **cut** and must never be drawn).
- ‼️ **`Counts` carries ALL SIX view counts on every response.** Never issue a count call per tab — and the
  "Overdue tab is absent at zero" rule is only implementable because the client knows the count before it renders.
- ‼️ **Do NOT also call `GET /conversations`** (the customer-facing list). It is not tenancy-scope-filtered, so a
  Technician would see the whole partition, and it is the duplicate list request the audit fails a part for.

`InboxConversationDto` is a deliberate superset of a row. It names the counterparty **`customer*`**; the thread
screens speak `otherParticipant*`, so both apps normalise once (`toInboxRow`).

### ‼️ What the list DTO does not carry — and why the point-read stays

`broadcastData.latestBid` and the WhatsApp 24h window are **absent** from `InboxConversationDto` and are
rendered by the thread HEADER. Both come from `GET /conversations/{id}`, which the apps already called for
WhatsApp threads. **Broadcast and WhatsApp threads keep that point-read on open; Direct/Booking/Quote cost
nothing extra** (decision B13).

### ‼️ There is NO realtime event for an assignment

`ProviderInboxService` dispatches **nothing** on claim / reassign / release / follow / unfollow, and no
`NotificationType` covers them. The only conversation push is `DirectMessageReceived`.

**So the "somebody just claimed it" state is a DIFF of the refreshed list** — refreshed on focus/foreground, on
reconnect, on an inbound message and on pull-to-refresh (decision B15). Do not plan a screen around a push that
does not exist. ‼️ **The owner decided on 2026-08-04 to LEAVE IT: the push is NOT to be built, and its absence is a
DECISION, not a gap (B15, closed).** The double-answer protection is already complete — a simultaneous claim
has exactly one winner and the loser is told instantly, by name — so the only cost is a colleague queue being
a few seconds stale while nobody is clicking. **Do not build it and do not report it as a defect.**

If a later phase ever revisits it: adding one is NOT a new `NotificationType` — that path persists a Cosmos notification and fans out a
PUSH for every claim. A claim is **visibility, not responsibility**. Clone the **voice-live watch group**
instead: `SendVoiceLiveTranscriptAsync` + `NotificationHub.WatchVoiceLive` +
`NotificationAudience.VoiceLiveWatchGroupName` — a business-keyed SignalR group with no Cosmos write, no push
and no `EnabledNotificationTypes` gate.

### ‼️ The claim race is a 409, and it must NEVER look like an error

`ProviderInboxController.Respond` maps `conversation_already_claimed` to **409** (not 412, whatever the mockup
notes say) and formats the holder's NAME into the localized message. Both clients branch on the **error code**,
never the status.

`claimRefusal(errorCode, heldByDisplayName)` returns the tone and the three ways forward — **Follow /
Take over / Back**. No red, no code, no "precondition failed". The UI prefers the server's already-localized
sentence when present, so it never needs a second round trip to learn the name.

### The rules that decide every pixel

All of them live in **`clinqetwebpartnerapp/src/lib/tenancy/renderingRules.js`** and its line-for-line twin
`clinqetmobilepartnerapp/src/lib/tenancy/renderingRules.ts`. **39 exports, identical behaviour, proved by the
build-failing `__tests__/tenancyRenderingParity.test.ts` (162 cases).**

`INBOX_VIEWS` · `INBOX_CONTEXTS` · `contextLabel` · `assignmentState` · `claimRefusal` · `unreadBadge` ·
`followLabel` · `channelMarks` · `overdueState` · `inboxScope` · `inboxTabs` · `rowAction` ·
`inboxStatusBanners` · `inboxEmptyState`.

| Rule | The thing to get right |
|---|---|
| `assignmentState` | Unassigned **REPLACES** the composer with a claim prompt. **Never disables it** |
| `inboxTabs` | The **Overdue tab is ABSENT at zero** — never a permanent zero badge |
| `inboxScope` | Only **Business** or **Branch** `conversation.read` scope can see an unassigned thread, so the shared-queue tabs are **absent** for anyone narrower — not permanently empty |
| `rowAction` | **Claim** when unassigned, **Take over** when held (gated on `conversation.assign`), nothing otherwise |
| `overdueState` | Warm tint **and** an amber pill **and** the words `"{over} over · target {target}"`. Colour is never the only carrier |

‼️ **Keep both rule files dependency-free and side-effect-free.** The parity spec evaluates the web copy in a
`vm` sandbox; a single `import` turns a build-failing diff test into a silent skip (it throws instead — keep it
that way).

### Localization

Web ids are flat react-intl (`Inbox.Tab.Unassigned`, `{name}`); mobile keys are nested i18next
(`SHARED_INBOX.TAB_UNASSIGNED`, `{{name}}`, **no inline ICU — plurals are `_one`/`_other`**).
`clinqetmobilepartnerapp/src/lib/tenancy/localizationKeys.ts` (`tenancyKey`) is the ONE mechanical translation
between them, and `__tests__/tenancyLocalizationKeys.test.ts` resolves every id the rules can return against
the English bundle. **The mobile bundles are GENERATED from the web catalogs**, so the two apps cannot say
different things (decision B17).

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). The inbox is final; the missing push is a DECISION.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.**

**Phase 9 changed NOTHING here.** This section closes the messaging story so a later phase does not
re-litigate it.

### ‼️‼️ THE MISSING REALTIME PUSH IS CLOSED BY OWNER DECISION (B15, 2026-08-04). Do NOT build it.

`ProviderInboxService` dispatches **nothing** on claim, reassign, release, follow or unfollow — no
`ICommunicationDispatcher` call, no SignalR send — and **no `NotificationType` value covers any of them**
(grepped: no `ConversationClaimed`, `ConversationAssigned` or `AssignmentChanged`). The only conversation
push is `DirectMessageReceived`, which fires on a **MESSAGE**.

Both provider apps therefore render the *claimed-live* state from a **DIFF of the refreshed list** —
refreshed on focus/foreground, on reconnect, on an inbound message and on pull-to-refresh. A row that was
unassigned and is now held renders *"{name} just took this conversation"* with an offer to follow.

‼️ **The owner decided on 2026-08-04 to LEAVE IT.** Why it is safe: **the double-answer protection is
already complete** — a simultaneous claim has exactly one winner and the loser is told **instantly, by
name** — so the only cost is a colleague's queue being a few seconds stale while nobody is clicking.
**A wasted click at worst; never a customer answered twice.**

‼️ **And a new `NotificationType` is the WRONG SHAPE, recorded so nobody reaches for it.** That path
**persists a Cosmos notification and fans out a PUSH for every claim** — everyone's feed and everyone's
phone. **A claim is visibility, not responsibility** (the same principle SLA-4 used to refuse an overdue
alert). The right shape already exists in this codebase: the **voice-live watch group** — a business-keyed
SignalR group with **no Cosmos write, no push and no `EnabledNotificationTypes` gate**
(`SignalRNotificationService.SendVoiceLiveTranscriptAsync` + `NotificationHub.WatchVoiceLive` /
`UnwatchVoiceLive` + `NotificationAudience.VoiceLiveWatchGroupName(businessId)`). Full recipe in
`02-CODE-REALITY.md` §7.1, **kept for reference only.**

### The six views and the atomic claim, restated

`IProviderInboxService` + `ProviderInboxController` (`api/v1/business/inbox`). **Six views** —
`Unassigned` · `AssignedToMe` · `MyTeam` · `Watching` · `All` · `Overdue` — each a **single-partition**
query, each filtered by the caller's own `conversation.read` scope, **so the view name describes the QUERY
and never escalates what a member may see.**

‼️ **Overdue is a FILTER across the others**, not a seventh state — every row keeps its assignment state so
the action offered matches it (Claim vs Take over). Its query carries **no `ORDER BY`** and the service
sorts the bounded set **in memory**, because no composite was approved.

**Atomic claim:** `TryClaimAsync` — a conditional Cosmos PATCH guarded by **BOTH** the document ETag **and**
a `conditionExpression` asserting the thread is still unassigned. Exactly one write wins; the loser is told
**who** holds it. ‼️ **It surfaces as HTTP 409 `conversation_already_claimed`, not 412** —
`ProviderInboxController.Respond` maps it. **The clients branch on the ERROR CODE, never the status**, so
the approved mockup's "412" wording is simply wrong about a status the API does not return.

### ‼️ The SLA clock — four invariants that must not drift

1. ‼️ **`IConversationRepository.UpdateSummaryAsync` must NEVER stamp `slaDueAt` or `firstReplyAt`.** The
   documents it returns are the **only** source of pre-message state, and the clock is derived from them.
   Do not "helpfully" make that patch stamp either field.
2. ‼️ **Starting the clock costs ZERO extra requests** — `ResolveWaitStart` rides `IncrementUnreadAsync`,
   which already runs on every inbound message (conditional on `NOT IS_DEFINED(c.slaDueAt)` since D11; only a
   losing racer pays a second, bare increment). **Ending it costs ONE extra patch, and only when a wait
   was genuinely running**, because `PatchOperation.Remove` on an absent path is a **400 that takes the
   WHOLE patch down with it**. It is its own request guarded by
   the read's ETag + `conditionExpression: IS_DEFINED(c.slaDueAt)`; a 412 re-reads and closes only the SAME
   open wait, so a concurrent second reply produces a harmless null and a stale reply never closes a newer wait. `Set(path, null)` was **rejected**: it writes a JSON null, which keeps an index entry.
3. ‼️ **There are FOUR conversation-summary write paths, not three.** `ConversationService`
   (`MessageService` + `BroadcastService` ×2 + `BroadcastProviderService`) **and**
   `BroadcastStatusUpdateFunction`, which calls `UpdateSummaryAsync` / `IncrementUnreadAsync` on the
   **repository directly**, bypassing `ConversationService` entirely. Anything added to those signatures
   must account for it — a compile break is the only reason it was ever found.
4. ‼️ **Muted, archived and closed threads are excluded from Overdue IN MEMORY, and the clock is STILL
   WRITTEN on them** (B8). Mute is reversible, so a thread muted and unmuted while a customer waits must
   become overdue **with its original due date**. Suppressing the write would silently forgive the wait.
   (`/isMuted` carries no `IncludedPath`, and filtering in memory is free because the set is bounded.)

‼️ **`InboxConversationDto.SlaDueAt` and `SlaTargetHours` are BOTH null on a muted or closed thread**, so
the same conversation can never read late in one view and not in another.

### ‼️ `Conversation.firstReplyAt` was NEVER written in production, and it had a real reader

All five callers of `UpdateSummaryForBothParticipantsAsync` pass a **synthetic stub** with no
`LastMessageSenderId`, so `stampFirstReply` was permanently `false`.
`SmartAnalyticsAggregationService` computed the provider's average response time from it ⇒ **that Insights
metric was permanently EMPTY** (since D11 it reads `replyCycles` instead). The full suite passed before and after — no test covered it, which is
exactly how it shipped. It is now stamped by `EndCustomerWaitAsync`, on the clock's own stop signal, and
the dead `stampFirstReply` parameter was **removed** rather than left beside a working replacement (B12).

### ‼️ SLA-3 is satisfied STRUCTURALLY — no `isAutomated` flag exists (B7)

The clock is cleared **only** when `senderId` equals the business side's own `userNumber`. Verified by
reading every writer: the **voice assistant** writes through `IngestInboundExternalMessageAsync` as
`SenderType.Customer` (it records the *caller's* message, so the clock correctly **starts**);
**WhatsApp templates** never call the summary path at all; and **System** writes carry
`senderId = "system"`, which matches neither participant. **A flag nothing ever sets would be dead code.**

### The provider identity fix, and why it was NOT a re-key (L99, casebook CASE 1)

**Four** service-layer writers stored the provider side under the **`BusinessId`** partition while
`ConversationController` (11 sites) and `MessageController` (4) read the **person's `UserNumber`**
partition. Phase 1 made those differ ⇒ **every tenancy-path provider's inbox was EMPTY.** 13,515 tests
passed, because every unit test built a context where the two values were identical.

‼️ **`GenerateConversationId` SORTS the participant pair before hashing** and both sides already passed
`(businessId, customerUserNumber)`, so **the ids already matched and every document was already in the
correct partition.** Re-keying "both sides" as the phase file literally read would have **moved correct
documents and broken the customer mirror.**

One helper — `BaseController.GetCurrentConversationParticipantId()` — at all 15 sites.
`IBusinessMemberDirectory` expands a business-addressed read receipt to its members before SignalR
delivery, and `MarkConversationAsReadResult.OtherParticipantType` decides the expansion by **TYPE**.
‼️ **A length heuristic was written and REJECTED** — seeded ids like `TEST-BUSINESS-001` defeat it, and the
document already carried the truth.

### L107 — unread, mute, hide, archive and TTL are BUSINESS-WIDE (✅ owner-approved)

One member reading a thread clears the badge for the team; one member muting mutes it for the team. **The
provider-side `Conversation` is partitioned by `BusinessId`, so `GetUnreadCountAsync` sums the business's
partition — that is what makes it a SHARED inbox rather than N private ones.** A queue where each member
sees a different unread count is not a shared queue. **Do not "fix" this to per-member read state** — it
would need a new document family or a per-member map on every conversation.

### ⛔ CUT and undrawn: free-text search (M7b / B16)

The pre-existing client-side box was **REMOVED** from both apps' inbox, not left drawn. It filtered **only
the 25 rows already loaded**, so a member searching a 300-thread queue got a confident, wrong "no results".
The context chips filter **server-side** on `/context/?`, which was already indexed.

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

### ‼️ ADDENDUM 2026-08-05 — four nested-media index paths REMOVED, and one that LOOKED identical was KEPT

Owner-approved (**DA13**). Deleted from `CosmosContainerPolicies`: `ProviderData` `/serviceImages/[]/imageId/?`,
`/images/[]/imageId/?`, `/documents/[]/documentId/?`; `Reviews` `/images/[]/imageId/?`; `Messages`
`/attachments/[]/attachmentId/?`. An **array** path costs one index entry **per element** on every parent write,
forever — and every one of these served a lookup `PatchStableArrayItemByIdAsync` performs **in memory**.

‼️ **`/pricing/priceType/?` was in the same finding and is KEPT.** `ServiceRepository.GetServicesByPricingTypeAsync`
queries it through a **LINQ predicate**, which the Cosmos provider turns into `WHERE c.pricing.priceType` at
runtime — **an expression tree names no path in any string**, so the literal-SQL sweep that produced the finding
could not see it. Removing it would have demoted a live query to a partition scan.

> ‼️ **THE RULE: before deleting an index because "nothing queries it", enumerate every way a query can be
> EXPRESSED here — literal `QueryDefinition`, `GetItemsByLinqAsync` (expression tree),
> `GetFilteredItemsAsync(whereClause:)`, and server-side scripts (none exist). Treat an expression tree as a
> query.** And note which failure you are risking: an unindexed **filter** degrades to a scan, but an unindexed
> **sort** is a hard **400** — so the `ORDER BY` check must be exhaustive.

Guard: `Clinqet.API.UnitTests.Repositories.NestedMediaIdPathsAreNotIndexedTests` — it asserts the four are
absent from `IncludedPaths` **and** every composite, and carries the `priceType` counter-example beside them.
Deployment: `cosmosindexsetup` applies the policy via `ReplaceContainerAsync`, so a re-run updates the live
index online — ‼️ pass `--launch-profile`; the tool ignores the shell `CLINKET_REGION`.

---

## ‼️ PHASE 12 CORRECTION BLOCK (parts 1 & 2, 2026-08-05/06)

### 1. ‼️ Every conversation message is its own notification event (Part 1, NX2 · casebook CASE 30)

`MessageService.DispatchToBusinessAsync` takes **`messageId` as an explicit parameter** and builds
`EventId = $"conversation-message:{conversationId}:{messageId}"`.

It used to read `notificationData.GetValueOrDefault("MessageId")` — **a key that dictionary never carries**. The
EventId therefore collapsed to a constant per conversation, the per-recipient `IdempotencyKey` collapsed with
it, and **only the FIRST customer message on a thread ever reached the provider team**; every later one was
suppressed on in-app, push, email, SMS and WhatsApp for `DeliveryIdempotencyTtlDays` (**35 days**).

‼️ **Do not "tidy" this back into the dictionary.** `notificationData` is the CLIENT payload; adding a key there
to feed a producer-side identity is a wire-contract change to fix the wrong layer.

### 2. ‼️ A conversation read receipt has exactly ONE publisher (Part 1, NX1 · casebook CASE 31)

SignalR addresses a **person** (`Clients.User(userNumber)`), and the other side of a provider conversation is a
**BUSINESS** — so a receipt aimed at a `BusinessId` reaches **zero connections**.

`Clinqet.Core.Interfaces.Messaging.IConversationReadReceiptNotifier` /
`Clinqet.Infrastructure.Services.Messaging.ConversationReadReceiptNotifier` (Scoped, Main API only) is the
**only** publisher. Both call sites — `ConversationController` and
`InternalNotificationTriggerController.ConversationRead` (the WhatsApp read-status relay) — use it.

**Guard:** `Conventions/ReadReceiptExpansionIsSingleSourcedTests` fails the build if any other production file
publishes a receipt, and also fails if the sole permitted site stops expanding a business recipient.
‼️ **Its boundary is the BEHAVIOUR (a file that references `ISignalRNotificationService`), not the method name**
— `SignalRHttpClient` exposes an identically-named method that is the Functions host's HTTP hop and cannot
address a group at all.

### 3. Routing, as it actually is

- **`DirectMessageReceived` resolves to `ContextMessage` for EVERY conversation context** (L106). The
  `DirectMessage` class is retained (L111) and is **unreachable** — pinned by six guards in
  `NotificationRecipientMatrixTests`.
- Unassigned thread yields everyone with `conversation.read` plus admin. Claimed yields assignee + team +
  watchers + admin.
- `Conversation.WatcherMembershipIds` rides `ScopedResource.ParticipantMembershipIds`, which `ResolveAssigned`
  already unions with the assignees — so "assignee + watchers + admin" needs no resolver change.
- An admin who is the assignee, a watcher, or the affected member is in the subject's related set and therefore
  uses their **OWN** preferences, never the team-activity surface.

## ‼️ THE CHAT RELAY AND THE HELD-BACK EMAIL (2026-09-21) — read before touching `ProcessPostSendActionsAsync`

Authority: `C:\Nik\Data\whatsapp-chat-messages\PLAN.md`. Mechanics: `clinqet-whatsapp`.

**The ordering rule that everything else hangs off:** the WhatsApp decision now runs **BEFORE** the dispatcher inside
`MessageService.ProcessPostSendActionsAsync`, because its answer is what decides whether the email goes alongside the
message or waits behind it. Inside an open 24 h window WhatsApp IS the live channel — the person just wrote to us
there — so sending both is two pings for one message.

```
ProcessPostSendActionsAsync
  1. summaries (unchanged)          → recipientConversation gives recipientMuted AND the unread count BEFORE this message
  2. recipient language/email/phone (unchanged reads)
  3. RunWhatsAppRelayAsync          → ChatRelayPlan { Decision, HeldBackEmail, HeldMemberUserId }   ‼️ NEW, and it NEVER throws
  4. dispatcher                      → customer: SkipEmail = skipEmail || the plan held it
                                       business: DispatchToBusinessAsync suppresses ONLY heldMemberUserId's email
```

- `RunWhatsAppRelayAsync` returns `ChatRelayPlan.Nothing` on ANY failure (router threw, notifier threw, enqueue
  threw). ‼️ **The hold is only ever a PROMISE made by a successful enqueue** — if nothing was enqueued the email is
  sent exactly as it is today.
- **Business recipient** ⇒ `IWhatsAppProviderNotifier`, never the router (the router's echo guard exists for inbound).
  **Customer recipient** ⇒ the `IChannelRouter` fan-out, gated on `ActiveChannels` so a pure in-app chat costs nothing.
- `unreadBeforeMessage == 0` is what makes a message "first of a burst" — it is the state BEFORE this message, which
  is exactly what the summary patch returns, and it is what earns the "Open chat" button.
- `MapRelayAttachments` deliberately drops the DTO's SAS: the queue carries container + blob name only, and the read
  link is minted at send time.
- `IChatEmailBuilder` / `ChatEmailBuilder` is the chat email, extracted from `MessageService` so the producer and
  `ChatEmailReleaseService` build the SAME Direct/Broadcast email. ‼️ It is still built **inside** the per-recipient
  factory on the business side — building it once outside ships one language to the whole team.
- `Message.whatsAppOutcome` / `whatsAppOutcomeAt` ride `MessageResponseDto` (and are deliberately absent from the
  `IsRemoved` branch — a removed message shows no delivery line).

**Do not "simplify" these:**
- ‼️ The relay must stay BEFORE the dispatcher. Moving it after makes `SkipEmail` unknowable.
- ‼️ `DispatchToBusinessAsync` must keep taking `heldMemberUserId` and comparing it per recipient. Exactly one
  member's email is ever held (the one whose own phone is the business WhatsApp number); everybody else is untouched.
- ‼️ In-app mute now silences the WhatsApp relay too (D-8). It is read from the RECIPIENT's conversation document.

## Direct-message email greeting (2026-09-26)
- `ChatEmailBuilder` sends `{{Greeting}}` = `DirectMessage_GreetingNamed` ("Hi {0},") or `_GreetingAnonymous` ("Hi there,") when no name is on record — never "Hi ,". The WhatsApp release rebuilds through the same builder, so both agree. Guard: `ChatEmailBuilderTests`.
