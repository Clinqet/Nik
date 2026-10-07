# Questions for carrier support — for the owner to send

Prepared 1 October 2026. **Nothing has been sent.** The implementation session does not contact carriers. These
are the facts that neither the published documentation nor the read-only account data could settle. Each one
names what the system does until it is answered, so no answer is blocking; an answer only lets a margin be
tightened or a restriction lifted. Record each reply in `IMPLEMENTATION-CARRIER-EVIDENCE.md` with its date.

## Telnyx (Canada / US account)

Context to give them: we rent local numbers for our customers, release unused ones, and want to avoid paying a
further month for a number we no longer need.

1. Our monthly number charge posted on 1 October (UTC). What is the exact time and timezone of the monthly run,
   and what is the latest moment a number can be deleted and not be charged for the next month?
   *Until answered: we delete at least 24 hours before the earliest possible start of the 1st.*
2. If a number is deleted partway through a month, is any part of that month's rent credited?
   *Until answered: we budget no credit.*
3. A deleted number is held on the account for about 15 days. If we buy that same number again in that time, is
   the one-time fee charged again as well as the prorated rent?
   *Until answered: we never re-buy our own held numbers automatically.*
4. Is the amount charged for an order always the `cost_information` returned by the search just before it? Can
   the price differ, and does a number reservation hold the price?
   *Until answered: we re-quote immediately before ordering, check the charge afterwards and cap orders per day.*
5. When a number has its deletion lock on, what does `DELETE /v2/phone_numbers/{id}` return? Is that call always
   complete when it answers?
6. Are taxes or regulatory fees added to the monthly rent of a Canadian or US local number with no features on?

## Plivo (India account)

Context to give them: India data-region account, numbers rented through the Numbers API, one accepted compliance
application in our company's name.

1. **Compliance.** We provide an AI phone receptionist to other Indian businesses, each using one of the numbers
   we rent. May numbers rented under our own compliance application be used this way, or must each end business
   have its own application? May a number be moved from one end business to another, and what must we do when it is?
   *Until answered: India numbers are assigned by our admin only, never automatically handed to a different business.*
2. The number API returns `monthly_rental_rate` "2.50000" for India numbers while our account is charged ₹200
   plus GST. In which currency are `monthly_rental_rate`, `setup_rate` and `cash_credits` for an INR account?
   *Until answered: we compare prices in the API's own unit and verify the rupee charge from the usage report.*
3. At what time of day (UTC) does the renewal charge run on `renewal_date`, and what is the latest moment a number
   can be released to avoid it? Is releasing it on `renewal_date` itself too late?
   *Until answered: we release at least 24 hours before the earliest possible start of that date.*
4. If the balance is too low at renewal, what happens to the number — kept with a negative balance, suspended,
   or released — and after how long?
5. For a number rented on the 29th, 30th or 31st, what is its renewal date in a shorter month, and does the day
   then stay shifted?
   *Until answered: we read `renewal_date` after every renewal and never calculate it.*
6. Does the account's monthly usage limit include number rental, and can reaching it block a release request?
7. After a number is released, is it held for a period, and is renting it again charged as a new full month?
8. When a purchase answers `pending`, has the first month already been charged?
