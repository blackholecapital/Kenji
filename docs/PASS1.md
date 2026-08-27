# Kenji Pass 1 — AI Call Center + Isla Overwatch

## Goal

Give Kenji a working lead-operations demo without trying to replace HighLevel on day one. Leads can enter by CSV or authenticated API, move through CRM-style tiles, enter an automated callback queue, and be called by the AI voice pipeline. Isla Overwatch sits above that data plane as the owner/operator interface and can discuss a fresh pipeline snapshot in chat or as a live LemonSlice avatar.

## Runtime layout

```text
Kenji / HighLevel / ads / CSV / webhook
                 |
                 v
          kenji-data-worker
       D1 leads + events + calls
       callback cron + call Queue
                 |
                 v
          kenji-call-jobs
                 |
                 v
         kenji-voice-worker
     Twilio -> Deepgram -> EILA runtime
                 |
                 v
        transcripts + call state
                 |
                 v
       kenji-overwatch-worker
      dashboard + owner login + Isla
                 |
                 +--> blackhole-video-worker
                       -> LiveKit blackhole-avatar
                       -> LemonSlice
                       -> EILA runtime voice
```

### Worker 1: `kenji-data-worker`

Owns the Pass 1 operational records and public lead-ingest API.

- D1 lead pipeline
- CRM-style lead CRUD
- CSV import, max 5,000 rows/request
- Bearer-key external API with rotate/revoke behavior
- call records and call job producer
- callback records
- 5-minute callback dispatcher cron
- events and Overwatch snapshot
- source/conversion aggregates

### Worker 2: `kenji-voice-worker`

Dedicated Kenji voice pipeline using the existing shared provider credentials.

- consumes `kenji-call-jobs`
- originates Twilio outbound calls
- auto-selects the first voice-capable incoming Twilio number when no number is pinned
- Twilio bidirectional Media Stream
- Deepgram `nova-3` realtime STT, mulaw/8000
- EILA runtime `/chat` for short sales/follow-up turns
- EILA runtime `/tts/twilio` for mulaw/8000 audio return
- transcripts written back into D1
- Twilio lifecycle callback reconciliation
- basic `contactable` / DNC stop-call gate

### Worker 3: `kenji-overwatch-worker`

Owner-facing application and Isla control plane.

- first-run owner bootstrap and normal login thereafter
- PBKDF2-hashed passcode, random HttpOnly session token
- Overview, Lead Pipeline, Calls, Callbacks, Integrations and Isla Overwatch views
- 8-second live snapshot refresh while the tab is active
- external API-key generation
- Isla chat with a fresh D1 snapshot on every turn
- live Isla video session through the existing shared `blackhole-video-worker`
- typed LiveKit chat and microphone share the same room
- final video transcript persisted to D1

## Centralized secrets

No values are copied into this repository.

Deployment uses the existing Cloudflare store `default_secrets_store` through `blackholecapital/cloudflare-platform/scripts/deploy-with-secrets-store.mjs`.

Mappings used by Pass 1:

| Kenji Worker binding | Central store name |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | `XYZ_DEMO_TWILIO_ACCOUNT_SID` |
| `TWILIO_AUTH_TOKEN` | `XYZ_DEMO_TWILIO_AUTH_TOKEN` |
| `DEEPGRAM_API_KEY` | `XYZ_DEMO_DEEPGRAM_API_KEY` |
| `EILA_RUNTIME_TOKEN` | `XYZ_DEMO_EILA_RUNTIME_TOKEN` |
| `INTERNAL_CALL_SECRET` | `XYZ_DEMO_EILA_RUNTIME_TOKEN` |
| `BLACKHOLE_CAPABILITY_TOKEN` | `XYZ_DEMO_EILA_RUNTIME_TOKEN` |

The shared `blackhole-video-worker` keeps its already-working LiveKit and LemonSlice provider credentials. Kenji receives only a service binding to it. The LemonSlice provider key is intentionally not copied into this repository or the central handoff.

The EILA runtime token is also used as the demo-only internal capability value, matching the existing EILA Overwatch centralized deployment pattern. Split it into a dedicated capability secret before multi-customer production.

## One-command deploy

From the Kenji repository root on the Factory host:

```bash
npm run deploy:pass1
```

The script:

1. resolves or creates `kenji-call-center-db`
2. resolves or creates `kenji-call-jobs` and `kenji-call-jobs-dlq`
3. generates temporary Wrangler configs with the real D1 UUID
4. applies the D1 migration
5. deploys Data with Secrets Store bindings
6. deploys Voice with Secrets Store bindings
7. deploys Overwatch with Secrets Store bindings
8. deletes all generated configs

The default platform helper path is:

```text
/mnt/eila-hot-sidecar/workspace/cloudflare-platform
```

Override it with `CLOUDFLARE_PLATFORM_DIR` when necessary.

## First-run demo flow

1. Open `https://kenji-overwatch-worker.cryptocapitalgroupfl.workers.dev`.
2. First run shows **Initialize Demo Owner**. Enter the owner name, email and a passcode of at least six characters.
3. Open **Integrations** and upload `samples/kenji-demo-leads.csv`, or add a lead manually.
4. Generate the API key. Save it when it is shown because only its SHA-256 hash remains in D1.
5. Open a lead tile and choose **Call now**. The call is queued and picked up by `kenji-voice-worker`.
6. Schedule a callback from the lead tile. Due callbacks are dispatched every five minutes.
7. Ask Isla questions such as “Which leads should we call first?” or “Where is follow-up backing up?”
8. Click **Isla Live** for the LiveKit / LemonSlice video session using the current pipeline snapshot.

## External ingest contract

### Endpoint

```text
POST https://kenji-data-worker.cryptocapitalgroupfl.workers.dev/v1/leads
Authorization: Bearer <generated key>
Content-Type: application/json
```

Single lead:

```json
{
  "firstName": "Alex",
  "lastName": "Morgan",
  "phone": "+15551234567",
  "email": "alex@example.com",
  "company": "Morgan Roofing",
  "source": "Kenji / HighLevel",
  "sourceAccount": "Roofing - Tampa",
  "score": 86,
  "stage": "New",
  "tags": ["roofing", "hot"],
  "notes": "Requested estimate follow-up"
}
```

An array or `{ "leads": [...] }` is also accepted, up to 5,000 leads per request.

Duplicate detection uses matching non-empty phone or email and refreshes the existing lead rather than generating a second tile.

## CSV headers

The importer normalizes common variants. Recommended headers:

```text
first_name,last_name,phone,email,company,source,source_account,stage,score,tags,notes,contactable,dnc
```

`tags` may be comma, semicolon or pipe separated.

## Pass 1 guardrails

This demo deliberately avoids the large Healthcare Solutions compliance control plane, but it does not remove basic operational safety:

- a lead can be marked `contactable=false`
- a lead can be marked DNC
- calls are blocked for either state
- if a caller says “stop calling”, “do not call”, “remove me”, etc., the voice worker marks DNC and confirms the stop
- no provider secret reaches the browser
- external ingest uses a rotatable Bearer key
- owner passcodes are never stored in plaintext

Production rollout should add tenant-specific consent policy, contact windows, number ownership, rate limits, HighLevel webhook signing, hardened SSO/Access and a dedicated internal capability secret.

## Pass 2 targets

- direct HighLevel OAuth/API adapter and webhook ingestion
- source-account hierarchy for Kenji’s agency/subaccounts
- call disposition extraction and automatic next-action writeback
- appointment/calendar actions
- live event stream rather than polling
- aggregate agency view across accounts
- Isla action tools with confirmation gates
- writeback of stage, notes and outcomes into HighLevel
- dedicated Kenji Twilio number / pool when the demo becomes production traffic
