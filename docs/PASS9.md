# Pass 9 — Handoff + Launch Gate

Pass 9 packages the deployed Kenji control plane for an owner handoff without adding another provider/runtime worker.

## Launch surface

The new **Launch** view aggregates readiness across the systems already deployed:

- owner authentication
- D1/data worker
- Twilio + Deepgram + EILA voice runtime
- dedicated SMS and email workers
- nurture dispatcher
- voice, SMS, email and video governor lanes
- governed Isla Live video worker
- lead inventory
- Twilio voice routing
- SMS sender selection
- email sender selection

The page reports two independent states:

- **Platform ready** — all required workers, runtimes and governed queue lanes are healthy.
- **Go-live ready** — platform ready plus lead data, a routed voice number, SMS sender and verified email sender.

## Safe demo seed

The owner may explicitly load ten synthetic CRM leads. The seed uses NANP reserved `+1 202-555-0100` through `0109` numbers and `example.com` email addresses. Every synthetic lead is created with `contactable=0`, so campaign and direct-call gates block outbound contact.

The operation is idempotent by email address and records a seed batch in D1.

## Acceptance ledger

**Run acceptance** captures the current checklist in `launch_acceptance_runs`. Results are classified as:

- `needs-attention`
- `platform-ready`
- `go-live-ready`

Acceptance runs never generate provider traffic.

## Handoff profile

The owner can store company, operator, handoff phase and notes. No provider credentials or secret values are stored in the profile.

## Deploy

```bash
cd ~/Kenji
git fetch origin refs/heads/build/pass9-handoff-launch:refs/remotes/origin/build/pass9-handoff-launch
git checkout -B build/pass9-handoff-launch origin/build/pass9-handoff-launch
npm run check
CLOUDFLARE_PLATFORM_DIR="$HOME/cloudflare-platform" npm run deploy:pass9
```

No new secret values, queues, Durable Objects or external providers are required.
