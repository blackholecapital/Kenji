# Pass 19 — Nurture customer desk + auth branding

## Purpose
Finish the last customer-facing inconsistencies without changing provider/runtime architecture.

## Nurture
- Surface every lead whose pipeline stage is `Nurture` as a customer ticket at the top of the Nurture page.
- Explain Nurture as long-term follow-up for viable leads who are not ready to buy now.
- Tickets expose score/heat, company, source, account, last contact and notes.
- `Open lead` returns to Lead Pipeline filtered to that customer.
- `Use in sequence` preloads Sequence Builder with Stage = Nurture plus the lead source/account segment.
- `Consent` jumps to the existing explicit per-channel consent record when one exists.
- No direct SMS/email bypass is introduced. Existing consent-aware Nurture execution remains the only send path.

## Callbacks
- Keep lead score in the top-right corner.
- Put heat beside the customer name: 80–89 = one flame; 90+ = two flames.
- Normalize compact metadata to Due / Stage / Queue.
- Preserve the existing call/text/email/calendar action deck and Done control.

## Branding / login
- Sidebar uses the repo-owned Kenji logo with `AI CALL CENTER` below it.
- Login uses the Kenji logo at the top.
- Remove the old Command Center title/copy and `Checking demo access…` hint.
- Keep Name / Email / Passcode and the enter button.
- Footer uses repo-owned `EILA-small-chat.jpg` with `Powered by EILA OS`.

## Boundary
No D1 schema, queue, provider, secret, routing, Durable Object, worker topology or shared-repository changes.

Deploy after merge:

```bash
npm run deploy:pass19
```
