# Kenji AI Call Center + Isla Overwatch

Pass 1 is a dedicated Kenji demo/control plane built on Black Hole's proven call-center, EILA runtime, LiveKit and LemonSlice patterns.

The objective is **not** to replace Kenji/HighLevel in the first demo. It gives Kenji a workload relief layer that can ingest its lead firehose, call and follow up those leads, expose clean CRM-style lead tiles, and let the owner talk to Isla Overwatch about the live operation.

## Pass 1 surfaces

- **Overview** — live lead, callback, call, conversion and source metrics
- **Lead Pipeline** — CRM-style lead tiles with score, source, account, stage, call-now and callback controls
- **Calls** — outbound AI call lifecycle and transcript-backed activity
- **Callbacks** — scheduled follow-up queue with a five-minute dispatcher
- **Integrations** — CSV import plus a rotatable Bearer-auth lead endpoint
- **Isla Overwatch** — fresh-snapshot chat plus live LiveKit/LemonSlice video assistant
- **Owner login** — first-run bootstrap, PBKDF2 passcode hashing and HttpOnly sessions

## Worker topology

```text
Lead sources / Kenji / HighLevel / CSV / webhook
                       |
                       v
                kenji-data-worker
              D1 + callback scheduler
                       |
                       v
                kenji-call-jobs
                       |
                       v
               kenji-voice-worker
          Twilio -> Deepgram -> EILA runtime
                       |
                       v
              call state + transcripts
                       |
                       v
            kenji-overwatch-worker
              dashboard + Isla chat
                       |
                       v
             blackhole-video-worker
          LiveKit -> LemonSlice -> EILA voice
```

## Centralized credentials

Secret values are never committed here. Deployments consume Cloudflare `default_secrets_store` through the existing `blackholecapital/cloudflare-platform` helper.

Pass 1 references only central secret **names**:

- `XYZ_DEMO_TWILIO_ACCOUNT_SID`
- `XYZ_DEMO_TWILIO_AUTH_TOKEN`
- `XYZ_DEMO_DEEPGRAM_API_KEY`
- `XYZ_DEMO_EILA_RUNTIME_TOKEN`

The existing shared `blackhole-video-worker` retains the LiveKit and LemonSlice provider credentials already attached to it.

## Check

```bash
npm run check
```

## Deploy Pass 1

On the Factory host with Cloudflare authentication already configured:

```bash
npm run deploy:pass1
```

The deploy script creates/resolves the Kenji D1 database and call queues, applies the migration, generates temporary Wrangler configs with the real D1 UUID, deploys all three workers through `default_secrets_store`, and deletes the generated configs.

Default dashboard after deploy:

```text
https://kenji-overwatch-worker.cryptocapitalgroupfl.workers.dev
```

First load initializes the demo owner login. From **Integrations**, import `samples/kenji-demo-leads.csv` or generate the external lead-ingest API key.

## Full Pass 1 handoff

See [`docs/PASS1.md`](docs/PASS1.md) for the architecture, API contract, CSV fields, call flow, centralized secret mapping, demo runbook, safety gates and Pass 2 HighLevel integration targets.
