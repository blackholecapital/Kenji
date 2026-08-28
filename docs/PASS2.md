# Pass 2 — HighLevel bridge + agency view

Pass 2 keeps the deployed Pass 1 call-center core intact and adds a direct HighLevel integration lane around it.

## What this pass adds

- `kenji-highlevel-worker` with the existing `kenji-call-center-db` as its data plane
- current HighLevel webhook verification using `X-GHL-Signature` / Ed25519 before payload processing
- Contact create/update ingestion into the existing Kenji lead tiles
- Opportunity create/update ingestion and optional HighLevel-stage → Kenji-stage mapping
- sub-account/location registry and aggregate agency summary
- contact/opportunity pull for a configured HighLevel location
- automatic completed-call writeback ledger
- contact-note writeback with the AI call transcript
- opportunity status/stage writeback when a linked opportunity and stage map exist
- two-minute writeback sweep on `kenji-highlevel-worker`
- authenticated HighLevel control surface inside the existing Integrations page
- no HighLevel credential is ever accepted by or returned to the browser

## Deployment

Pass 1 must already be deployed.

```bash
cd ~/Kenji
git fetch origin
git checkout build/pass2-highlevel-bridge
git pull origin build/pass2-highlevel-bridge

npm run check
CLOUDFLARE_PLATFORM_DIR="$HOME/cloudflare-platform" npm run deploy:pass2
```

The deploy script:

1. resolves the existing `kenji-call-center-db`;
2. applies `0002_highlevel_bridge.sql`;
3. deploys `kenji-highlevel-worker` with the shared internal capability from `default_secrets_store`;
4. redeploys Kenji Overwatch with the new private HighLevel service binding and UI assets.

The deployment is intentionally valid even with no HighLevel token. CSV ingest, the Kenji Bearer lead API, AI calls, callbacks and Isla continue to work independently.

## Connecting a real HighLevel location

The bridge supports a HighLevel Private Integration token or OAuth access token. For the first live design-partner location, keep the token only as a Worker secret:

```bash
cd ~/Kenji
npx --yes wrangler@latest secret put HIGHLEVEL_PRIVATE_TOKEN --name kenji-highlevel-worker
```

Do not commit the token and do not paste it into the dashboard.

Then open the Kenji Command Center → **Integrations → Direct HighLevel Bridge** and save:

- Location ID
- friendly sub-account name
- optional Pipeline ID
- optional Business ID
- optional HighLevel User ID for note authorship
- optional stage map JSON

Example stage map:

```json
{
  "highlevel-stage-id-for-qualified": "Qualified",
  "highlevel-stage-id-for-booked": "Booked",
  "highlevel-stage-id-for-won": "Won"
}
```

Click **Pull now** to ingest the first contact/opportunity slice.

## Webhook

Configure the HighLevel application webhook URL as:

```text
https://kenji-highlevel-worker.cryptocapitalgroupfl.workers.dev/webhooks/highlevel
```

Pass 2 accepts the current `X-GHL-Signature` Ed25519 signature and rejects unsigned or invalid payloads before they touch D1.

The initial event handlers cover:

- `ContactCreate`
- `ContactUpdate`
- `OpportunityCreate`
- `OpportunityUpdate`
- opportunity status/stage update variants

Webhook deliveries are idempotency-ledgered in `highlevel_webhooks`.

## Writeback behavior

Every two minutes the HighLevel worker checks terminal Kenji calls that belong to a linked HighLevel lead and have not already been written back.

For a linked contact it attempts to create a `Kenji AI call follow-up` note containing the call status, duration and bounded transcript.

For a linked opportunity it also writes the local outcome back to the opportunity. If a stage-map entry exists for the current Kenji stage, the matching HighLevel `pipelineStageId` is applied. `Won` and `Lost` also map to HighLevel opportunity status.

Every attempt is recorded in `highlevel_writebacks` as pending, sent or failed so a bad provider response does not disappear into logs.

## Important multi-location boundary

Pass 2 is deliberately the first real location bridge, not the final 800-subaccount credential architecture. A single private integration token is appropriate for a controlled initial location. Agency-scale distribution should move to the HighLevel OAuth install flow so each authorized location gets a scoped credential lifecycle without copying tokens around.

That is the next connector pass after the live bridge is proven with one real Kenji sub-account.
