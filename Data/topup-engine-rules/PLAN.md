# Minute packs follow the AI engine — PLAN (2026-09-25)

Owner approval: 2026-09-25, in session "Enforce top-up pack engine check on the server" — "yes, go ahead… do all three of
them"; conversion at **today's price**; `MinuteLedger.ModelTier` label **approved** ("Yes, add the label"); mockup approval
**waived** ("you don't need to approve the mock-up with me").

## The three rules

1. **Only the right pack can be bought.** A pack is priced for ONE engine. Card top-up, India order, price preview,
   auto-recharge save — and the auto-recharge charge itself — refuse a pack for the other engine (`pack_engine_mismatch`).
2. **Auto-recharge never buys the wrong pack and never costs more than agreed.** After an engine change it follows with the
   same-size pack when that costs the same or less; a pricier one needs the provider's yes in the switch dialog (and a
   monthly budget that still covers it); otherwise it turns off, charges nothing, keeps the old pack id so the page can say
   why, and sends one notice.
3. **Leftover pack minutes keep their money value.** On every engine change they move to the live engine at today's
   best-per-minute pack prices, rounded down (never created). Included plan minutes never move. The switch dialog shows the
   numbers first; a move made with nobody present (renewal, late payment) is announced in-app, push and email.

## Schema (approved)

| Table | Column | Why |
|---|---|---|
| `MinuteLedger` | `ModelTier nvarchar(20) NULL` | the engine a pack minute serves; conversion rows (`PackConversion`) move it |
| `BillingTransaction` | `TopUpModelTier nvarchar(20) NULL` | an India order settling after a switch knows what it bought |

Migration `20260925214559_AddMinuteEngineLabels`.

## Mockup register

| Sheet | Path | Approved | Governs | Supersedes |
|---|---|---|---|---|
| AI engine switch — minutes & auto-recharge | `Data/mockups/ai-engine-switch-minutes/index.html` | Approval waived by owner 2026-09-25; sheet records what shipped | Switch dialog section (web + phone sheet), top-up paused note, stale-pack recovery, the two notices | — |
