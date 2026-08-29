# Pass 5 — Campaign Execution + Follow-up Orchestration

Pass 5 attacks the original Kenji pain point directly: more leads than humans can call back fast enough.

## What it adds

### Campaign worker
`kenji-campaign-worker` is a dedicated orchestration worker with a one-minute scheduler. It does not duplicate the voice runtime. It selects eligible campaign members and sends call jobs into the existing `kenji-call-jobs` queue consumed by `kenji-voice-worker`.

### Audience preview
Before a campaign exists, the operator can preview the exact eligible population using:

- source contains
- source-account / HighLevel subaccount contains
- stage
- minimum lead score

The audience always excludes DNC, non-contactable, Won/Lost, and leads without a phone number.

### Explicit launch
Campaigns start as drafts. Creating a campaign does not place calls. The owner must click **Launch** after reviewing the audience and rate controls.

### Rate control
Each active campaign has an independent `callsPerTick` limit, currently 1–25 calls per minute. The dispatcher also refuses to create a duplicate active call for the same lead within the recent call window.

### Disposition-driven retries
Campaign members reconcile against the real call row plus the Pass 3 `call_outcomes` ledger.

- `qualified`, `appointment-request`, `callback`, `connected`, `dnc`, `not-interested`, and `wrong-number` stop campaign retries
- `busy`, `no-answer`, `failed`, and `canceled` move into a timed retry window
- reaching max attempts marks the member exhausted
- DNC/non-contactable/Won/Lost hard-stop a member even if the campaign remains active

Callback requests are intentionally handed off to the existing callback queue rather than being hammered again by the campaign timer.

### Kill switch
**Pause all active** immediately stops new campaign dispatch. Calls already in progress are not terminated.

## New UI
The Command Center gets a **Campaigns** page with:

- aggregate campaign KPIs
- audience preview and lead sample
- draft creation
- explicit launch
- pause/resume
- pause-all kill switch
- manual dispatcher tick for demos
- per-campaign member/call/qualification stats
- member inspection with attempt and disposition state

## Deploy

```bash
cd ~/Kenji
git fetch origin
git checkout build/pass5-campaign-orchestration
git pull origin build/pass5-campaign-orchestration
npm run check
CLOUDFLARE_PLATFORM_DIR="$HOME/cloudflare-platform" npm run deploy:pass5
```

No new credential values are required. `kenji-campaign-worker` only receives the existing internal capability secret from `default_secrets_store` and writes call jobs to the existing Cloudflare Queue.

## Demo path

1. Import or sync leads.
2. Open **Campaigns**.
3. Set a source/subaccount and score floor.
4. Click **Preview audience**.
5. Create the draft.
6. Review rate / retry / max-attempt settings.
7. Click **Launch** and confirm.
8. Watch Calls, Campaigns, Agency Ops, and Isla Overwatch update as outcomes land.

This pass is voice-first by design. SMS/email nurture should only be added with explicit channel-consent fields and a separate communications policy instead of silently treating generic call contactability as SMS consent.
