# Two decisions for the owner — refund email, notification outbox (2026-09-26)

Both come from read-only investigations of the code (the file and line references are in the session record).
**Nothing in either section is built.** Each waits for your yes. The outbox table also needs your explicit yes on
the §0.7 table below, because approving the idea is not approving the table.

---

## 1 · The refund email — my recommendation: switch it on, properly (email + in-app notice)

### What happens today
- **Clinket never refunds a provider by itself.** The only way is someone pressing "refund" in the Stripe or Razorpay
  dashboard.
- When that happens, Clinket only changes the charge's status to "Refunded". It does not:
  - record how much was refunded, so a partial refund looks like a full one;
  - notice an India minute-pack refund at all (those rows have no charge id to match);
  - reverse the tax (GST/HST/QST, GST) collected on it;
  - change the receipt, which still says **PAID**;
  - tell anyone: no email, no app notice, no admin alert, and the admin refunds list skips it.
- A late "payment succeeded" message from the bank can flip "Refunded" back to "Succeeded", which erases the only
  trace of the refund.
- The "your refund was processed" email exists in all 5 languages, but nothing ever sends it.
- Customer refunds (Flow B) are built well, but when the money actually goes back the customer gets only an app notice,
  with no amount and no email.

### What the industry does
For every refund:
- an **email receipt** stating the amount, which charge it reverses (its receipt number), where the money goes (the
  card), and roughly when it arrives. Stripe, Shopify, Apple and Google all do this;
- the refund shown **as its own line** in billing history;
- where tax was charged, a **credit note**: the tax document that reverses part of the original receipt (Canada
  GST/HST/QST, India GST);
- the original receipt showing it was refunded or partly refunded.

An app notice alone is not enough. People match refunds against their bank statement, and the charge itself was
confirmed by email.

### What I recommend
1. **Record every refund as its own money line** from the gateway's own refund event: amount, tax share, refund id, and
   a link to the charge it reverses. The same refund event arriving twice creates one line, because the existing unique
   `IdempotencyKey` guarantees it (**no new table or column**).
2. **Keep the charge's status true:** "Partially refunded" or "Refunded" from the running total. A late "succeeded"
   can never undo it.
3. **Match India minute-pack refunds** by their order id as well.
4. **Send one refund email** to the business's billing email (the existing `RefundProcessed` template, 5 languages,
   amount in the reader's format, with the original receipt number), **plus the app notice** to team members who can
   see billing. This is the same audience as the charge receipt.
5. **Attach a refund receipt PDF**, which is a credit note where tax was charged. In Canada it is French and English,
   like the new receipts.
6. **The original receipt says REFUNDED or PARTIALLY REFUNDED**, never PAID.
7. **Tell the admins:** an alert when a dashboard refund lands, and provider refunds listed in the admin refunds list.
8. **Customers (Flow B):** email the customer when their refund completes, with the amount.

**What a refund should NOT do automatically:** cancel the plan, switch off the AI Assistant, or take back minutes.
Those stay separate decisions an admin makes. Stripe does not cancel a subscription on refund either.

**Why not just an app notice, or delete the template?** Refunds do happen (through the dashboard), and today they are
recorded wrongly and silently. Deleting the email would leave that exactly as it is.

**Size:** medium, with no schema change. Payments code, one webhook path, the receipt PDF, two email senders, plus
tests on real SQL.

---

## 2 · Notification outbox (decision 4) — the easy explanation

### The problem, in plain words
When something important happens (a charge, a failed payment, a reminder coming due), the code works in two steps:
1. it saves the change;
2. it separately asks the message queue to deliver the notice.

If step 2 fails (the queue is unreachable for a moment, or the server restarts at that second), **the notice is gone.
Nothing remembers that it still has to be sent.**

The timer jobs are worse. They write "reminder sent" **before** sending, so a failed send is never retried.

Most at risk, from the investigation:
1. a new booking's "please confirm" request to the provider (the booking then waits forever);
2. "your plan / AI Assistant was switched off";
3. India's day-before-debit reminder;
4. the trial-ending reminder;
5. the promo-sunset notices, where one failure loses the notice for the whole group;
6. the price-rise notice;
7. receipts.

This is rare, because it needs a hiccup at the wrong second. But one outage hits every flow at once, and nobody gets a
list of what was lost.

### The industry-standard fix: a "transactional outbox"
- In the **same database save** as the change, also save a row saying "this notice must go out". It is one save, so
  either both exist or neither does.
- A small background job runs every minute. It sends the waiting rows and marks them sent. If a send fails it tries
  again later, with a limit and an alert.
- Sending twice is harmless: every notice already has a fixed id, and every channel already skips duplicates.

### Is it overkill? Honestly:
- **For billing: no.** It is one table, one timer and one health check. The platform already runs this exact pattern
  for team access changes (`AccessChangeQueue`), so it is proven here. Hundreds of rows a day costs next to nothing,
  and the notices it protects are money and legal notices.
- **For everything (bookings, chat, quote requests): a SQL table cannot protect those.** They are saved in Cosmos, not
  SQL, and one save cannot cover both databases. They need a different tool (Cosmos's change feed, or a repair check).
  Doing that for every flow now *would* be overkill. The one worth doing next is #1, the new-booking confirmation,
  because a lost one leaves a booking stuck.

### My recommendation
Build the outbox **for billing first**:
- the SQL-saved notices from subscriptions, the AI Assistant, minutes and the promo sunset;
- the receipt email hand-off.

Use the table below. Then, as its own small change, protect the new-booking confirmation request with a Cosmos-side
repair check.

### ‼️ §0.7 — the table I am asking you to approve (NOT built)

| | |
|---|---|
| **What** | New SQL table `NotificationOutbox` (AppDbContext): `Id` nvarchar(64) PK, a fixed id made from the notice's event id · `Kind` nvarchar(40), an enum saved as a string (`BillingNotice`, `ReceiptEmail`) · `Payload` nvarchar(max), the notice as JSON (the same `BillingNotification` the code builds today) · `CreatedAt` datetimeoffset · `NextAttemptAt` datetimeoffset · `Attempts` int · `LastError` nvarchar(1000) null · `DispatchedAt` datetimeoffset null. One filtered index `(NextAttemptAt) WHERE DispatchedAt IS NULL` |
| **Who reads it** | A new timer function in the Functions host, every minute. It sends waiting rows through the existing billing notice / receipt path, stamps `DispatchedAt`, and deletes rows sent more than N days ago (appsettings). Plus a backlog health check, the lesson from `AccessChangeQueue`'s silent outage |
| **Who writes it** | `SubscriptionBillingService`, `SubscriptionService`, `AiAddOnService`, `MinuteLedgerService`, `PromoSunsetService`, `BillingChargeService`, each in the same `SaveChanges` as its change |
| **Why not a column** | One business change can raise several notices, and one row per notice is a one-to-many fact |
| **Why not an enum/constant** | It is runtime data (the notices waiting to go out) |
| **Why not an existing table** | `AccessChangeQueue` is shaped for access changes (its columns and its handler); putting notices in it would change a working pipeline. Cosmos cannot hold it: the changes being protected are SQL saves, so the row must be in the same SQL transaction |
| **Cost** | One row per billing notice (hundreds a day at launch). One small filtered index, one query a minute on an index that is usually empty. A migration that only adds; no new Azure resource, queue or `local.settings.json` key |
| **What breaks if omitted** | The notices above can be lost for good on a queue or SQL blip or a restart, including India's day-before-debit courtesy notice and "your AI Assistant was switched off" |
