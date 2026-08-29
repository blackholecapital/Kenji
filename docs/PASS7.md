# Pass 7 — Orchestration Governor + Scale Lab

Pass 7 inserts a real control plane between the high-volume producers and the existing channel execution workers.

## Architecture

```text
Campaigns ──> kenji-orch-voice-ingress ──┐
                                         │
Nurture ───> kenji-orch-sms-ingress ─────┼─> kenji-orchestrator-worker
                                         │        │
Nurture ───> kenji-orch-email-ingress ───┘        ├─> kenji-call-jobs  ─> Voice Worker
                                                  ├─> kenji-sms-jobs   ─> SMS Worker
                                                  └─> kenji-email-jobs ─> Email Worker
```

The campaign and nurture business logic is unchanged. Their queue bindings now point to orchestration ingress queues. The orchestrator consumes ingress, obtains a permit from a sharded Durable Object governor, then forwards allowed jobs into the existing execution queues.

## Lane controls

Each lane stores:
- enabled / disabled state
- circuit breaker state
- per-minute orchestration ceiling
- burst allowance
- governor shard count
- operator note

Default demo ceilings are intentionally conservative:
- voice: 120/min + 20 burst across 4 shards
- SMS: 300/min + 50 burst across 4 shards
- email: 600/min + 100 burst across 4 shards
- video: 20/min + 5 burst across 2 shards, advisory only

These are orchestration ceilings, not provider guarantees. Twilio, Resend, LemonSlice/renderer and account-level limits still apply downstream.

## Circuit breakers

Opening a queue-lane circuit does not delete work. Messages remain in the orchestration ingress queue and are retried while the lane is paused. The **Open all circuits** control pauses voice, SMS and email together without taking down Overwatch or the individual workers.

## Sharding

The orchestrator hashes campaign/sequence/lead identifiers across the configured shard count. Each shard uses a Durable Object to serialize permit decisions for its minute bucket. This avoids one global hot counter while keeping deterministic backpressure.

## Scale Lab

The new **Scale Lab** page lets the owner change lane ceilings and run synthetic dry-load calculations. Dry runs write only a small test record into D1. They never enqueue provider traffic.

For a one-million-job target the model shows:
- configured jobs/minute
- theoretical jobs/day
- jobs/minute required to clear the target inside 24 hours
- estimated hours at the current orchestration ceiling

This is useful for sizing the control plane before provider throughput is raised.

## Deploy

```bash
cd ~/Kenji

git fetch origin \
  refs/heads/build/pass7-orchestration-governor:refs/remotes/origin/build/pass7-orchestration-governor

git checkout -B build/pass7-orchestration-governor \
  refs/remotes/origin/build/pass7-orchestration-governor

npm run check
CLOUDFLARE_PLATFORM_DIR="$HOME/cloudflare-platform" npm run deploy:pass7
```

Pass 7 creates six ingress/DLQ queues, applies `0007_orchestration_governor.sql`, deploys the orchestrator Durable Object worker, repoints Campaign and Nurture to ingress, and deploys the Scale Lab surface.

No new secret values are required.
